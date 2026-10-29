package main

import (
	"errors"
	"os"
	"path/filepath"

	"asterssh/internal/core"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

func (a *App) ChooseUploadFolder() (string, error) {
	p, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{Title: "选择要上传的文件夹（保留目录结构）"})
	if err != nil || p == "" {
		return "", err
	}
	info, err := os.Stat(p)
	if err != nil {
		return "", err
	}
	if !info.IsDir() {
		return "", errors.New("请选择文件夹")
	}
	a.mu.Lock()
	a.uploadGrants[filepath.Clean(p)] = true
	a.mu.Unlock()
	return p, nil
}
func (a *App) ChooseDownloadDirectory() (string, error) {
	prefs := a.store.Config().Preferences
	initial := prefs.DownloadDirectory
	if info, err := os.Stat(initial); err != nil || !info.IsDir() {
		home, _ := os.UserHomeDir()
		initial = filepath.Join(home, "Downloads")
		if info, err := os.Stat(initial); err != nil || !info.IsDir() {
			initial = home
		}
	}
	directory, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{Title: "选择本地接收目录（文件和文件夹按原名传输）", DefaultDirectory: initial})
	if err != nil || directory == "" {
		return "", err
	}
	info, err := os.Stat(directory)
	if err != nil {
		return "", err
	}
	if !info.IsDir() {
		return "", errors.New("接收位置必须是文件夹")
	}
	prefs.DownloadDirectory = directory
	if _, err = a.store.SavePreferences(prefs); err != nil {
		return "", err
	}
	return directory, nil
}
func (a *App) downloadDirectory() (string, error) {
	p := a.store.Config().Preferences.DownloadDirectory
	if p == "" {
		return "", errors.New("请先选择本地接收目录")
	}
	return p, nil
}
func (a *App) CheckDownloads(id string, paths []string) ([]core.DownloadTarget, error) {
	directory, err := a.downloadDirectory()
	if err != nil {
		return nil, err
	}
	return a.manager.CheckDownloads(id, directory, paths)
}
func (a *App) StartDownloads(id string, paths []string, overwrite bool) ([]core.Transfer, error) {
	directory, err := a.downloadDirectory()
	if err != nil {
		return nil, err
	}
	return a.manager.DownloadEntries(id, directory, paths, overwrite)
}
func (a *App) OpenDownloadDirectory() error {
	directory, err := a.downloadDirectory()
	if err != nil {
		return err
	}
	runtime.BrowserOpenURL(a.ctx, directory)
	return nil
}

func (a *App) OpenTransferLocation(id string) error {
	for _, transfer := range a.manager.Transfers() {
		if transfer.ID == id && transfer.Direction == "download" && transfer.Status == "completed" {
			location := transfer.LocalPath
			if !transfer.Directory {
				location = filepath.Dir(location)
			}
			runtime.BrowserOpenURL(a.ctx, location)
			return nil
		}
	}
	return errors.New("未找到已完成的下载任务")
}
