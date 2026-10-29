package core

import (
	"os"
	"path/filepath"
	"testing"
)

func TestAppearanceMigrationPreservesOtherPreferences(t *testing.T) {
	old := Preferences{Theme: "dark", AppearanceVersion: 1, FontSize: 16, Scrollback: 10000, SidebarCollapsed: true, DownloadDirectory: "D:\\Downloads"}
	updated := normalizePreferences(old)
	if updated.Theme != "light" || updated.AppearanceVersion != 2 {
		t.Fatalf("soft theme migration: %+v", updated)
	}
	if updated.FontSize != old.FontSize || updated.Scrollback != old.Scrollback || updated.DownloadDirectory != old.DownloadDirectory || !updated.SidebarCollapsed {
		t.Fatal("appearance migration changed unrelated preferences")
	}
	updated.Theme = "dark"
	if normalizePreferences(updated).Theme != "dark" {
		t.Fatal("an explicit later theme choice was overwritten")
	}
	store := mustStore(t)
	if store.Config().Preferences.Theme != "light" {
		t.Fatal("new profiles should use the soft light theme")
	}
}

func TestLegacyThemeFileMigratesOnce(t *testing.T) {
	for _, legacy := range []string{
		`{"version":1,"hosts":[],"preferences":{"theme":"light","fontSize":18,"scrollback":3000,"sidebarCollapsed":true}}`,
		`{"version":1,"hosts":[],"preferences":{"theme":"dark","appearanceVersion":1,"fontSize":18,"scrollback":3000,"sidebarCollapsed":true}}`,
	} {
		t.Run(legacy, func(t *testing.T) { checkThemeMigration(t, legacy) })
	}
}

func checkThemeMigration(t *testing.T, legacy string) {
	t.Helper()
	directory := t.TempDir()
	if err := os.WriteFile(filepath.Join(directory, "config.json"), []byte(legacy), 0600); err != nil {
		t.Fatal(err)
	}
	store, err := NewStore(directory)
	if err != nil {
		t.Fatal(err)
	}
	prefs := store.Config().Preferences
	if prefs.Theme != "light" || prefs.AppearanceVersion != 2 || prefs.FontSize != 18 || !prefs.SidebarCollapsed {
		t.Fatalf("legacy file migration: %+v", prefs)
	}
	prefs.Theme = "dark"
	if _, err = store.SavePreferences(prefs); err != nil {
		t.Fatal(err)
	}
	reloaded, err := NewStore(directory)
	if err != nil {
		t.Fatal(err)
	}
	if reloaded.Config().Preferences.Theme != "dark" {
		t.Fatal("explicit saved theme was not preserved")
	}
}
