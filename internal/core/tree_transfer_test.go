package core

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"asterssh/internal/testserver"
)

func TestDirectoryTransfersKeepNamesAndStructure(t *testing.T) {
	server, err := testserver.Start("127.0.0.1:0", "folder-password", nil)
	if err != nil {
		t.Fatal(err)
	}
	defer server.Close()
	store := mustStore(t)
	h := fixtureHost(t, store, server, "password", "")
	m := NewManager(store, nil)
	defer m.Close()
	id := connectFixture(t, m, h, "folder-password")
	source := filepath.Join(t.TempDir(), "项目文件夹")
	if err = os.MkdirAll(filepath.Join(source, "子目录", "空目录"), 0700); err != nil {
		t.Fatal(err)
	}
	payload := []byte{0, 1, 2, 3, 128, 200, 255}
	os.WriteFile(filepath.Join(source, "子目录", "binary.dat"), payload, 0600)
	os.WriteFile(filepath.Join(source, "说明.txt"), []byte("保留原始名称\n"), 0600)
	checks, err := m.CheckUploads(id, "/", []string{source})
	if err != nil || len(checks) != 1 || !checks[0].Directory || checks[0].Exists {
		t.Fatalf("upload planning: %+v %v", checks, err)
	}
	jobs, err := m.Upload(id, "/", []string{source}, false)
	if err != nil {
		t.Fatal(err)
	}
	uploaded := waitTransfer(t, m, jobs[0].ID)
	if uploaded.Status != "completed" || uploaded.EntriesDone != 5 {
		t.Fatalf("directory upload: %+v", uploaded)
	}
	remote := "/项目文件夹"
	checks, err = m.CheckUploads(id, "/", []string{source})
	if err != nil || !checks[0].Exists || checks[0].Conflicts != 2 {
		t.Fatalf("merge preflight: %+v %v", checks, err)
	}
	if _, err = m.Upload(id, "/", []string{source}, false); err == nil {
		t.Fatal("upload merged without consent")
	}
	destination := t.TempDir()
	targets, err := m.CheckDownloads(id, destination, []string{remote})
	if err != nil || len(targets) != 1 || !targets[0].Directory || targets[0].LocalPath != filepath.Join(destination, "项目文件夹") {
		t.Fatalf("download target: %+v %v", targets, err)
	}
	jobs, err = m.DownloadEntries(id, destination, []string{remote}, false)
	if err != nil {
		t.Fatal(err)
	}
	downloaded := waitTransfer(t, m, jobs[0].ID)
	if downloaded.Status != "completed" || downloaded.EntriesDone != 5 {
		t.Fatalf("folder download: %+v", downloaded)
	}
	got, err := os.ReadFile(filepath.Join(destination, "项目文件夹", "子目录", "binary.dat"))
	if err != nil || !bytes.Equal(got, payload) {
		t.Fatalf("binary download mismatch %v", err)
	}
	if info, err := os.Stat(filepath.Join(destination, "项目文件夹", "子目录", "空目录")); err != nil || !info.IsDir() {
		t.Fatal("empty directory missing")
	}
	if _, err = m.DownloadEntries(id, destination, []string{remote}, false); err == nil {
		t.Fatal("download overwrote without consent")
	}
	os.WriteFile(filepath.Join(destination, "项目文件夹", "说明.txt"), []byte("local old content"), 0600)
	jobs, err = m.DownloadEntries(id, destination, []string{remote}, true)
	if err != nil {
		t.Fatal(err)
	}
	if result := waitTransfer(t, m, jobs[0].ID); result.Status != "completed" {
		t.Fatalf("confirmed merge: %+v", result)
	}
	got, _ = os.ReadFile(filepath.Join(destination, "项目文件夹", "说明.txt"))
	if !strings.Contains(string(got), "保留原始名称") {
		t.Fatal("confirmed overwrite failed")
	}
}
func TestUnsafeWindowsNamesAreRejected(t *testing.T) {
	for _, name := range []string{"..", "../escape", "CON", "nul.txt", "COM1.dat", "trailing.", "a:b", "x\\y", "end ", "control\n"} {
		if err := windowsEntryName(name); err == nil {
			t.Errorf("accepted unsafe name %q", name)
		}
	}
	for _, name := range []string{"报告.txt", ".env", "folder", "COM10.txt"} {
		if err := windowsEntryName(name); err != nil {
			t.Errorf("rejected valid name %q: %v", name, err)
		}
	}
}
