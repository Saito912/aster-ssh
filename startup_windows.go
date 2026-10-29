//go:build windows

package main

import "golang.org/x/sys/windows"

func showStartupError(message string) {
	text, _ := windows.UTF16PtrFromString(message)
	title, _ := windows.UTF16PtrFromString("Aster SSH 启动失败")
	windows.MessageBox(0, text, title, windows.MB_OK|windows.MB_ICONERROR)
}
