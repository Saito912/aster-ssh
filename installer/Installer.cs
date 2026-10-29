using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Win32;

internal static class Program {
    internal const string RegistryPath = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\AsterSSH";
    internal static readonly string[] OwnedFiles = { "AsterSSH.exe", "Uninstall.exe", "使用说明.md", "第三方许可证.txt" };
    [STAThread]
    private static void Main(string[] args) {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        try {
            if (args.Length == 2 && args[0] == "--verify-package") {
                ExtractPayload(Path.GetFullPath(args[1]));
                return;
            }
            if (args.Length == 2 && args[0] == "--uninstall-run") {
                string target = Path.GetFullPath(Encoding.UTF8.GetString(Convert.FromBase64String(args[1])));
                using (RegistryKey key = Registry.CurrentUser.OpenSubKey(RegistryPath)) {
                    if (key == null || !String.Equals(target, Path.GetFullPath((string)key.GetValue("InstallLocation", "")), StringComparison.OrdinalIgnoreCase))
                        throw new InvalidOperationException("卸载路径与安装记录不匹配。");
                }
                Application.Run(new SetupWindow(true, target));
                return;
            }
#if UNINSTALLER
            string installed;
            using (RegistryKey key = Registry.CurrentUser.OpenSubKey(RegistryPath)) {
                if (key == null) throw new InvalidOperationException("未找到当前用户的 Aster SSH 安装记录。");
                installed = (string)key.GetValue("InstallLocation");
            }
            string temporary = Path.Combine(Path.GetTempPath(), "AsterSSH-Uninstall-" + Guid.NewGuid().ToString("N") + ".exe");
            File.Copy(Application.ExecutablePath, temporary, false);
            Process.Start(new ProcessStartInfo(temporary, "--uninstall-run " + Convert.ToBase64String(Encoding.UTF8.GetBytes(installed))) { UseShellExecute = false });
#else
            string location = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Programs\Aster SSH");
            using (RegistryKey key = Registry.CurrentUser.OpenSubKey(RegistryPath)) {
                if (key != null) location = (string)key.GetValue("InstallLocation", location);
            }
            Application.Run(new SetupWindow(false, location));
#endif
        } catch (Exception error) {
            MessageBox.Show(error.Message, "Aster SSH", MessageBoxButtons.OK, MessageBoxIcon.Error);
            Environment.ExitCode = 1;
        }
    }
    private static Stream Resource(string name) {
        Stream stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(name);
        if (stream == null) throw new InvalidOperationException("安装包资源缺失：" + name);
        return stream;
    }
    internal static void CheckNotRunning(string directory) {
        string expected = Path.GetFullPath(Path.Combine(directory, "AsterSSH.exe"));
        foreach (Process process in Process.GetProcessesByName("AsterSSH")) {
            try {
                if (String.Equals(Path.GetFullPath(process.MainModule.FileName), expected, StringComparison.OrdinalIgnoreCase))
                    throw new InvalidOperationException("请先关闭正在运行的 Aster SSH，再重试。");
            } catch (System.ComponentModel.Win32Exception) { }
            finally { process.Dispose(); }
        }
    }
    internal static void ExtractPayload(string directory) {
        directory = Path.GetFullPath(directory);
        if (directory == Path.GetPathRoot(directory)) throw new InvalidOperationException("请选择专用安装文件夹。");
        CheckNotRunning(directory);
        Directory.CreateDirectory(directory);
        string temporary = Path.Combine(directory, ".aster-install-" + Guid.NewGuid().ToString("N"));
        try {
            using (Stream input = Resource("Aster.App"))
            using (GZipStream gzip = new GZipStream(input, CompressionMode.Decompress))
            using (FileStream output = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write)) { gzip.CopyTo(output); }
            string actual;
            using (SHA256 hash = SHA256.Create())
            using (FileStream input = File.OpenRead(temporary)) { actual = BitConverter.ToString(hash.ComputeHash(input)).Replace("-", ""); }
            if (!String.Equals(actual, PayloadInfo.Sha256, StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException("安装包内容校验失败。");
            string executable = Path.Combine(directory, "AsterSSH.exe");
            if (File.Exists(executable)) File.Replace(temporary, executable, null); else File.Move(temporary, executable);
            ExtractResource("Aster.Guide", Path.Combine(directory, "使用说明.md"));
            ExtractResource("Aster.Notices", Path.Combine(directory, "第三方许可证.txt"));
            ExtractResource("Aster.Uninstaller", Path.Combine(directory, "Uninstall.exe"));
        } finally { if (File.Exists(temporary)) File.Delete(temporary); }
    }
    private static void ExtractResource(string name, string target) {
        using (Stream input = Resource(name))
        using (FileStream output = new FileStream(target, FileMode.Create, FileAccess.Write)) { input.CopyTo(output); }
    }
    private static void Shortcut(string filename, string target) {
        Directory.CreateDirectory(Path.GetDirectoryName(filename));
        Type shellType = Type.GetTypeFromProgID("WScript.Shell");
        dynamic shell = Activator.CreateInstance(shellType);
        dynamic shortcut = shell.CreateShortcut(filename);
        shortcut.TargetPath = target;
        shortcut.WorkingDirectory = Path.GetDirectoryName(target);
        shortcut.Description = "Aster SSH - SSH / SFTP 客户端";
        shortcut.IconLocation = target + ",0";
        shortcut.Save();
        System.Runtime.InteropServices.Marshal.FinalReleaseComObject(shortcut);
        System.Runtime.InteropServices.Marshal.FinalReleaseComObject(shell);
    }
    internal static void Install(string directory, bool desktop) {
        ExtractPayload(directory);
        string executable = Path.Combine(directory, "AsterSSH.exe");
        string menu = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "Aster SSH");
        Shortcut(Path.Combine(menu, "Aster SSH.lnk"), executable);
        Shortcut(Path.Combine(menu, "卸载 Aster SSH.lnk"), Path.Combine(directory, "Uninstall.exe"));
        if (desktop) Shortcut(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "Aster SSH.lnk"), executable);
        using (RegistryKey key = Registry.CurrentUser.CreateSubKey(RegistryPath)) {
            key.SetValue("DisplayName", "Aster SSH"); key.SetValue("DisplayVersion", PayloadInfo.Version);
            key.SetValue("Publisher", "Aster SSH"); key.SetValue("InstallLocation", directory);
            key.SetValue("DisplayIcon", executable);
            key.SetValue("UninstallString", "\"" + Path.Combine(directory, "Uninstall.exe") + "\"");
            key.SetValue("NoModify", 1, RegistryValueKind.DWord); key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
            key.SetValue("DesktopShortcut", desktop ? 1 : 0, RegistryValueKind.DWord);
            key.SetValue("EstimatedSize", (int)(new FileInfo(executable).Length / 1024), RegistryValueKind.DWord);
        }
    }
    internal static void Uninstall(string directory) {
        CheckNotRunning(directory);
        bool desktop = false;
        using (RegistryKey key = Registry.CurrentUser.OpenSubKey(RegistryPath)) { if (key != null) desktop = (int)key.GetValue("DesktopShortcut", 0) != 0; }
        // Remove exact files owned by this app; never recursively delete a user-selected directory.
        foreach (string name in OwnedFiles) { string file = Path.Combine(directory, name); if (File.Exists(file)) File.Delete(file); }
        string menu = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "Aster SSH");
        foreach (string name in new string[] { "Aster SSH.lnk", "卸载 Aster SSH.lnk" }) { string file = Path.Combine(menu, name); if (File.Exists(file)) File.Delete(file); }
        if (Directory.Exists(menu) && Directory.GetFileSystemEntries(menu).Length == 0) Directory.Delete(menu, false);
        string desktopLink = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "Aster SSH.lnk");
        if (desktop && File.Exists(desktopLink)) File.Delete(desktopLink);
        if (Directory.Exists(directory) && Directory.GetFileSystemEntries(directory).Length == 0) Directory.Delete(directory, false);
        Registry.CurrentUser.DeleteSubKeyTree(RegistryPath, false);
    }
}

internal sealed class SetupWindow : Form {
    private readonly bool removing;
    private readonly TextBox path;
    private readonly CheckBox desktop;
    private readonly CheckBox launch;
    private readonly Button install;
    private readonly Button browse;
    private readonly ProgressBar progress;
    private readonly Label status;
    private bool complete;
    internal SetupWindow(bool uninstall, string directory) {
        removing = uninstall;
        Text = uninstall ? "卸载 Aster SSH" : "安装 Aster SSH";
        ClientSize = new Size(560, 390); FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false; MinimizeBox = false; StartPosition = FormStartPosition.CenterScreen;
        AutoScaleMode = AutoScaleMode.Dpi; BackColor = Color.White; Font = new Font("Microsoft YaHei UI", 9F);
        Panel header = new Panel { Location = new Point(0, 0), Size = new Size(560, 110), BackColor = Color.FromArgb(246, 247, 252) };
        header.Controls.Add(new Label { Text = "✳", Font = new Font("Segoe UI Symbol", 37), ForeColor = Color.FromArgb(103, 115, 222), Location = new Point(28, 18), AutoSize = true });
        header.Controls.Add(new Label { Text = "Aster SSH", Font = new Font("Segoe UI", 23, FontStyle.Bold), Location = new Point(106, 20), AutoSize = true });
        header.Controls.Add(new Label { Text = "轻盈连接，自在掌控。  /  " + PayloadInfo.Version, ForeColor = Color.FromArgb(125, 133, 154), Location = new Point(110, 68), AutoSize = true }); Controls.Add(header);
        Controls.Add(new Label { Text = uninstall ? "将移除应用程序与快捷方式，保留你的连接配置及凭据。" : "为当前 Windows 用户安装，无需管理员权限。", Location = new Point(30, 132), AutoSize = true });
        Controls.Add(new Label { Text = "安装位置", Location = new Point(30, 176), AutoSize = true, ForeColor = Color.Gray });
        path = new TextBox { Text = directory, Location = new Point(30, 201), Size = new Size(413, 27), ReadOnly = uninstall };
        browse = new Button { Text = "浏览…", Location = new Point(452, 199), Size = new Size(78, 29), Enabled = !uninstall };
        browse.Click += delegate { using (FolderBrowserDialog picker = new FolderBrowserDialog { Description = "选择 Aster SSH 安装文件夹", SelectedPath = path.Text }) { if (picker.ShowDialog(this) == DialogResult.OK) path.Text = Path.Combine(picker.SelectedPath, "Aster SSH"); } };
        Controls.Add(path); Controls.Add(browse);
        desktop = new CheckBox { Text = "创建桌面快捷方式", Checked = true, Location = new Point(30, 246), AutoSize = true, Visible = !uninstall };
        launch = new CheckBox { Text = "完成后启动 Aster SSH", Checked = true, Location = new Point(268, 246), AutoSize = true, Visible = !uninstall };
        Controls.Add(desktop); Controls.Add(launch);
        progress = new ProgressBar { Location = new Point(30, 288), Size = new Size(500, 5), Visible = false };
        status = new Label { Text = uninstall ? "配置保留在 %APPDATA%\\AsterSSH" : "运行环境：Microsoft Edge WebView2", ForeColor = Color.Gray, Location = new Point(30, 303), Size = new Size(500, 24) };
        Controls.Add(progress); Controls.Add(status);
        install = new Button { Text = uninstall ? "卸载" : "安装", BackColor = Color.FromArgb(103, 115, 222), ForeColor = Color.White, FlatStyle = FlatStyle.Flat, Location = new Point(425, 343), Size = new Size(105, 32) };
        install.FlatAppearance.BorderSize = 0;
        install.Click += async delegate {
            if (complete) { if (!removing && launch.Checked) Process.Start(Path.Combine(path.Text, "AsterSSH.exe")); Close(); return; }
            if (removing && MessageBox.Show(this, "确认卸载 Aster SSH？连接配置和凭据将保留。", "卸载 Aster SSH", MessageBoxButtons.YesNo, MessageBoxIcon.Question) != DialogResult.Yes) return;
            string target;
            try { target = Path.GetFullPath(path.Text); } catch (Exception error) { MessageBox.Show(this, error.Message, "安装位置无效", MessageBoxButtons.OK, MessageBoxIcon.Error); return; }
            path.Enabled = browse.Enabled = desktop.Enabled = launch.Enabled = install.Enabled = false;
            progress.Visible = true; progress.Style = ProgressBarStyle.Marquee; status.Text = removing ? "正在卸载…" : "正在安装并校验文件…";
            try {
                bool shortcut = desktop.Checked;
                await Task.Run(delegate { if (removing) Program.Uninstall(target); else Program.Install(target, shortcut); });
                complete = true; progress.Style = ProgressBarStyle.Blocks; progress.Value = 100;
                status.Text = removing ? "卸载完成。你的连接配置已保留。" : "安装完成。可以开始连接你的服务器了。";
                install.Text = "完成"; install.Enabled = true;
            } catch (Exception error) {
                progress.Visible = false; status.Text = "操作未完成，请检查后重试。";
                path.Enabled = !removing; browse.Enabled = !removing; desktop.Enabled = launch.Enabled = install.Enabled = true;
                MessageBox.Show(this, error.Message, "Aster SSH", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        };
        Controls.Add(install);
    }
}
