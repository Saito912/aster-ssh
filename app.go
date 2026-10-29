package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"asterssh/internal/core"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx          context.Context
	store        *core.Store
	manager      *core.Manager
	mu           sync.Mutex
	uploadGrants map[string]bool
}

func NewApp() (*App, error) {
	dir := os.Getenv("ASTER_DATA_DIR")
	if dir == "" {
		base, err := os.UserConfigDir()
		if err != nil {
			return nil, err
		}
		dir = filepath.Join(base, "AsterSSH")
	}
	if !filepath.IsAbs(dir) {
		return nil, errors.New("数据目录必须是绝对路径")
	}
	store, err := core.NewStore(dir)
	if err != nil {
		return nil, err
	}
	a := &App{store: store, uploadGrants: map[string]bool{}}
	a.manager = core.NewManager(store, func(name string, data any) {
		if a.ctx != nil {
			runtime.EventsEmit(a.ctx, name, data)
		}
	})
	return a, nil
}
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	runtime.OnFileDrop(ctx, func(x, y int, paths []string) {
		a.mu.Lock()
		for _, p := range paths {
			if info, err := os.Stat(p); err == nil && (info.Mode().IsRegular() || info.IsDir()) {
				a.uploadGrants[filepath.Clean(p)] = true
			}
		}
		a.mu.Unlock()
		runtime.EventsEmit(ctx, "files:dropped", map[string]any{"x": x, "y": y, "paths": paths})
	})
}
func (a *App) shutdown(ctx context.Context) { a.manager.Close() }
func (a *App) beforeClose(ctx context.Context) bool {
	count := a.manager.SessionCount()
	if count == 0 {
		return false
	}
	answer, err := runtime.MessageDialog(ctx, runtime.MessageDialogOptions{Type: runtime.QuestionDialog, Title: "退出 Aster SSH", Message: fmt.Sprintf("当前有 %d 个 SSH 会话。退出会断开连接，并取消进行中的传输。\n\n是否退出？", count), Buttons: []string{"Yes", "No"}, DefaultButton: "No", CancelButton: "No"})
	return preventClose(answer, err)
}
func preventClose(answer string, err error) bool {
	return err == nil && (strings.EqualFold(answer, "No") || strings.EqualFold(answer, "Cancel"))
}
func (a *App) GetConfig() core.Config                           { return a.store.Config() }
func (a *App) SaveHost(input core.HostInput) (core.Host, error) { return a.store.SaveHost(input) }
func (a *App) DeleteHost(id string) error                       { return a.store.DeleteHost(id) }
func (a *App) SavePreferences(p core.Preferences) (core.Preferences, error) {
	p.DownloadDirectory = a.store.Config().Preferences.DownloadDirectory
	return a.store.SavePreferences(p)
}
func (a *App) SaveSnippets(snippets []core.Snippet) error { return a.store.SaveSnippets(snippets) }
func (a *App) Connect(req core.ConnectRequest) (core.ConnectResult, error) {
	return a.manager.Connect(req)
}
func (a *App) StartShell(id string, cols, rows int) error {
	return a.manager.StartShell(id, cols, rows)
}
func (a *App) WriteSession(id, data string) error            { return a.manager.Write(id, data) }
func (a *App) WriteBinary(id, data string) error             { return a.manager.WriteBinary(id, data) }
func (a *App) AckOutput(id string, n int)                    { a.manager.Ack(id, n) }
func (a *App) ResizeSession(id string, cols, rows int) error { return a.manager.Resize(id, cols, rows) }
func (a *App) Disconnect(id string) error                    { return a.manager.Disconnect(id) }
func (a *App) ListFiles(id, path string) (core.Directory, error) {
	return a.manager.ListFiles(id, path)
}
func (a *App) ReadRemoteFile(id, path string) (core.TextFile, error) {
	return a.manager.ReadFile(id, path)
}
func (a *App) WriteRemoteFile(id string, file core.TextFile) (core.TextFile, error) {
	return a.manager.WriteFile(id, file)
}
func (a *App) MakeDirectory(id, path string) error    { return a.manager.MakeDirectory(id, path) }
func (a *App) RenameRemote(id, old, new string) error { return a.manager.Rename(id, old, new) }
func (a *App) RemoveRemote(id, path string) error     { return a.manager.Remove(id, path) }
func (a *App) GetStats(id string) (core.Stats, error) { return a.manager.Stats(id) }
func (a *App) GetTransfers() []core.Transfer          { return a.manager.Transfers() }
func (a *App) CancelTransfer(id string) error         { return a.manager.CancelTransfer(id) }
func (a *App) ChoosePrivateKey() (string, error) {
	return runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{Title: "选择 SSH 私钥", Filters: []runtime.FileFilter{{DisplayName: "SSH 私钥", Pattern: "*"}}})
}
func (a *App) ChooseUploadFiles() ([]core.LocalFile, error) {
	paths, err := runtime.OpenMultipleFilesDialog(a.ctx, runtime.OpenDialogOptions{Title: "选择要上传的文件"})
	if err != nil {
		return nil, err
	}
	out := []core.LocalFile{}
	a.mu.Lock()
	defer a.mu.Unlock()
	for _, p := range paths {
		info, err := os.Stat(p)
		if err != nil {
			return nil, err
		}
		if !info.Mode().IsRegular() {
			return nil, errors.New("请选择普通文件")
		}
		a.uploadGrants[filepath.Clean(p)] = true
		out = append(out, core.LocalFile{Path: p, Name: info.Name(), Size: info.Size()})
	}
	return out, nil
}
func (a *App) granted(paths []string) bool {
	a.mu.Lock()
	defer a.mu.Unlock()
	for _, p := range paths {
		if !a.uploadGrants[filepath.Clean(p)] {
			return false
		}
	}
	return true
}
func (a *App) CheckUploads(id, dir string, paths []string) ([]core.LocalFile, error) {
	if !a.granted(paths) {
		return nil, errors.New("请先通过文件选择器选择上传文件")
	}
	return a.manager.CheckUploads(id, dir, paths)
}
func (a *App) StartUploads(id, dir string, paths []string, overwrite bool) ([]core.Transfer, error) {
	if !a.granted(paths) {
		return nil, errors.New("上传文件未授权")
	}
	return a.manager.Upload(id, dir, paths, overwrite)
}
func (a *App) StartLogging(id string) (string, error) {
	filename, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{Title: "保存会话日志（从现在开始记录）", DefaultFilename: "aster-" + time.Now().Format("20060102-150405") + ".log"})
	if err != nil || filename == "" {
		return "", err
	}
	if err = a.manager.SetLog(id, filename); err != nil {
		return "", fmt.Errorf("日志必须保存到新文件（不能覆盖现有文件）：%w", err)
	}
	return filename, nil
}
func (a *App) StopLogging(id string) error { return a.manager.SetLog(id, "") }
func (a *App) StartTunnel(id string, localPort int, dest string, remotePort int) (core.Tunnel, error) {
	return a.manager.StartTunnel(id, localPort, dest, remotePort)
}
func (a *App) StopTunnel(id string) error { return a.manager.StopTunnel(id) }
func (a *App) GetTunnels() []core.Tunnel  { return a.manager.Tunnels() }
func (a *App) ExportConnections() (bool, error) {
	p, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{Title: "导出连接（不含密码和私钥口令）", DefaultFilename: "aster-connections.json", Filters: []runtime.FileFilter{{DisplayName: "JSON", Pattern: "*.json"}}})
	if err != nil || p == "" {
		return false, err
	}
	b, err := a.store.Export()
	if err != nil {
		return false, err
	}
	err = os.WriteFile(p, b, 0600)
	return err == nil, err
}
func (a *App) ImportConnections() (int, error) {
	p, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{Title: "导入 Aster SSH 连接配置", Filters: []runtime.FileFilter{{DisplayName: "JSON", Pattern: "*.json"}}})
	if err != nil || p == "" {
		return 0, err
	}
	info, err := os.Stat(p)
	if err != nil {
		return 0, err
	}
	if info.Size() > 4<<20 {
		return 0, errors.New("配置文件不能超过 4 MB")
	}
	b, err := os.ReadFile(p)
	if err != nil {
		return 0, err
	}
	return a.store.Import(b)
}
func (a *App) OpenDataDirectory() { runtime.BrowserOpenURL(a.ctx, a.store.Config().DataDirectory) }
func (a *App) OpenExternal(url string) error {
	if !strings.HasPrefix(url, "https://") && !strings.HasPrefix(url, "http://") {
		return errors.New("仅支持打开 http/https 链接")
	}
	runtime.BrowserOpenURL(a.ctx, url)
	return nil
}
