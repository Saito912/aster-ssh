package main

import (
	"crypto/sha256"
	"embed"
	"fmt"
	"os"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	app, err := NewApp()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		showStartupError(err.Error())
		return
	}
	directoryHash := sha256.Sum256([]byte(app.store.Config().DataDirectory))
	instanceID := fmt.Sprintf("%x-%x-%x-%x-%x", directoryHash[:4], directoryHash[4:6], directoryHash[6:8], directoryHash[8:10], directoryHash[10:16])
	background := &options.RGBA{R: 242, G: 243, B: 245, A: 255}
	if app.store.Config().Preferences.Theme == "dark" {
		background = &options.RGBA{R: 39, G: 49, B: 62, A: 255}
	}
	err = wails.Run(&options.App{
		Title: "Aster SSH", Width: 1440, Height: 900, MinWidth: 1024, MinHeight: 700,
		StartHidden:      os.Getenv("ASTER_UI_TEST") == "1",
		BackgroundColour: background,
		AssetServer:      &assetserver.Options{Assets: assets},
		OnStartup:        app.startup, OnShutdown: app.shutdown, OnBeforeClose: app.beforeClose,
		Bind:        []interface{}{app},
		DragAndDrop: &options.DragAndDrop{EnableFileDrop: true},
		SingleInstanceLock: &options.SingleInstanceLock{UniqueId: instanceID, OnSecondInstanceLaunch: func(_ options.SecondInstanceData) {
			if app.ctx != nil {
				runtime.WindowUnminimise(app.ctx)
				runtime.WindowShow(app.ctx)
			}
		}},
		Windows: &windows.Options{WebviewIsTransparent: false, WindowIsTranslucent: false, DisableWindowIcon: false},
	})
	if err != nil {
		showStartupError(err.Error())
	}
}
