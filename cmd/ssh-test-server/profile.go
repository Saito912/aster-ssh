package main

import (
	"errors"
	"net"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"asterssh/internal/core"
	"asterssh/internal/testserver"
	"golang.org/x/crypto/ssh"
)

func seedProfile(directory, password string, server *testserver.Server) error {
	if _, err := os.Stat(filepath.Join(directory, "config.json")); err == nil {
		return errors.New("UI test profile must be new; existing data is preserved")
	}
	store, err := core.NewStore(directory)
	if err != nil {
		return err
	}
	address, port, _ := net.SplitHostPort(server.Listener.Addr().String())
	number, _ := strconv.Atoi(port)
	h, err := store.SaveHost(core.HostInput{Host: core.Host{Name: "本地传输验证", Address: address, Port: number, User: "demo", Auth: "password", Group: "隔离验证", Favorite: true}, Credentials: core.Credentials{Password: password}, Remember: true})
	if err != nil {
		return err
	}
	parent := filepath.Dir(directory)
	receiving := filepath.Join(parent, "receiving")
	if err = os.MkdirAll(receiving, 0700); err != nil {
		return err
	}
	prefs := store.Config().Preferences
	prefs.DownloadDirectory = receiving
	if _, err = store.SavePreferences(prefs); err != nil {
		return err
	}
	source := filepath.Join(parent, "source", "传输验证")
	if err = os.MkdirAll(filepath.Join(source, "子目录", "空目录"), 0700); err != nil {
		return err
	}
	if err = os.WriteFile(filepath.Join(source, "说明.txt"), []byte("Aster SSH 目录传输验证\r\n保持原名，保留子目录与空目录。\r\n"), 0600); err != nil {
		return err
	}
	binary := make([]byte, 8192)
	for i := range binary {
		binary[i] = byte(i % 251)
	}
	if err = os.WriteFile(filepath.Join(source, "子目录", "binary.dat"), binary, 0600); err != nil {
		return err
	}
	manager := core.NewManager(store, nil)
	defer manager.Close()
	result, err := manager.Connect(core.ConnectRequest{HostID: h.ID, ApprovedFingerprint: ssh.FingerprintSHA256(server.Signer.PublicKey())})
	if err != nil {
		return err
	}
	jobs, err := manager.Upload(result.ID, "/", []string{source}, false)
	if err != nil {
		return err
	}
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		for _, job := range manager.Transfers() {
			if job.ID == jobs[0].ID {
				if job.Status == "completed" {
					return nil
				}
				if job.Status == "failed" {
					return errors.New(job.Error)
				}
			}
		}
		time.Sleep(10 * time.Millisecond)
	}
	return errors.New("fixture seeding timed out")
}
