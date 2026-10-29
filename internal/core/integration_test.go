package core

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"encoding/pem"
	"io"
	"net"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"asterssh/internal/testserver"
	"golang.org/x/crypto/ssh"
)

func mustStore(t *testing.T) *Store {
	t.Helper()
	store, err := NewStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	return store
}
func fixtureHost(t *testing.T, store *Store, server *testserver.Server, auth, keyPath string) Host {
	t.Helper()
	address, port, _ := net.SplitHostPort(server.Listener.Addr().String())
	n, _ := strconv.Atoi(port)
	h, err := store.SaveHost(HostInput{Host: Host{Name: "test server", Address: address, Port: n, User: "demo", Auth: auth, KeyPath: keyPath}})
	if err != nil {
		t.Fatal(err)
	}
	return h
}
func waitFor(t *testing.T, condition func() bool) {
	t.Helper()
	deadline := time.Now().Add(8 * time.Second)
	for time.Now().Before(deadline) {
		if condition() {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatal("timed out waiting for asynchronous operation")
}
func connectFixture(t *testing.T, m *Manager, h Host, password string) string {
	t.Helper()
	result, err := m.Connect(ConnectRequest{HostID: h.ID, Credentials: Credentials{Password: password}})
	if err != nil {
		t.Fatal(err)
	}
	if result.Challenge == nil || result.Challenge.Changed {
		t.Fatal("expected new host fingerprint challenge")
	}
	result, err = m.Connect(ConnectRequest{HostID: h.ID, Credentials: Credentials{Password: password}, ApprovedFingerprint: result.Challenge.Fingerprint})
	if err != nil || result.ID == "" {
		t.Fatalf("connect: %+v %v", result, err)
	}
	return result.ID
}
func waitTransfer(t *testing.T, m *Manager, id string) Transfer {
	t.Helper()
	var transfer Transfer
	waitFor(t, func() bool {
		for _, v := range m.Transfers() {
			if v.ID == id {
				transfer = v
				return v.Status == "completed" || v.Status == "failed" || v.Status == "cancelled"
			}
		}
		return false
	})
	return transfer
}
func TestPasswordPTYFilesAndTunnel(t *testing.T) {
	server, err := testserver.Start("127.0.0.1:0", "test-password", nil)
	if err != nil {
		t.Fatal(err)
	}
	defer server.Close()
	store := mustStore(t)
	h := fixtureHost(t, store, server, "password", "")
	var m *Manager
	var output strings.Builder
	var outputMu sync.Mutex
	m = NewManager(store, func(name string, data any) {
		if name == "terminal:data" {
			e := data.(OutputEvent)
			b, _ := base64.StdEncoding.DecodeString(e.Data)
			outputMu.Lock()
			output.Write(b)
			outputMu.Unlock()
			m.Ack(e.ID, e.Bytes)
		}
	})
	defer m.Close()
	result, err := m.Connect(ConnectRequest{HostID: h.ID, Credentials: Credentials{Password: "test-password"}})
	if err != nil || result.Challenge == nil {
		t.Fatalf("host key challenge missing: %v", err)
	}
	if server.PasswordCalls.Load() != 0 {
		t.Fatal("password sent before host key trust")
	}
	id := connectFixture(t, m, h, "test-password")
	if err = m.StartShell(id, 100, 30); err != nil {
		t.Fatal(err)
	}
	if err = m.Write(id, "echo 你好 Aster\r"); err != nil {
		t.Fatal(err)
	}
	waitFor(t, func() bool {
		outputMu.Lock()
		defer outputMu.Unlock()
		return strings.Count(output.String(), "你好 Aster") >= 2
	})
	if err = m.Resize(id, 120, 40); err != nil {
		t.Fatal(err)
	}
	waitFor(t, func() bool { return server.Resizes.Load() > 0 })
	if err = m.MakeDirectory(id, "/work"); err != nil {
		t.Fatal(err)
	}
	local := filepath.Join(t.TempDir(), "中文文件.txt")
	payload := []byte("真正的 SSH 和 SFTP 传输\n")
	if err = os.WriteFile(local, payload, 0600); err != nil {
		t.Fatal(err)
	}
	jobs, err := m.Upload(id, "/work", []string{local}, false)
	if err != nil {
		t.Fatal(err)
	}
	if transfer := waitTransfer(t, m, jobs[0].ID); transfer.Status != "completed" {
		t.Fatalf("upload: %+v", transfer)
	}
	listing, err := m.ListFiles(id, "/work")
	if err != nil || len(listing.Files) != 1 {
		t.Fatalf("list: %+v %v", listing, err)
	}
	remote, err := m.ReadFile(id, "/work/中文文件.txt")
	if err != nil || remote.Content != string(payload) {
		t.Fatalf("read: %+v %v", remote, err)
	}
	original := remote
	remote.Content += "edited safely\n"
	updated, err := m.WriteFile(id, remote)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = m.WriteFile(id, original); err == nil {
		t.Fatal("stale remote edit was not rejected")
	}
	download := filepath.Join(t.TempDir(), "download.txt")
	job, err := m.Download(id, updated.Path, download)
	if err != nil {
		t.Fatal(err)
	}
	if transfer := waitTransfer(t, m, job.ID); transfer.Status != "completed" {
		t.Fatalf("download: %+v", transfer)
	}
	got, _ := os.ReadFile(download)
	if string(got) != updated.Content {
		t.Fatal("download mismatch")
	}
	if err = m.Rename(id, updated.Path, "/work/renamed.txt"); err != nil {
		t.Fatal(err)
	}
	if err = m.Remove(id, "/work/renamed.txt"); err != nil {
		t.Fatal(err)
	}
	if err = m.Remove(id, "/work"); err != nil {
		t.Fatal(err)
	}
	echo, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer echo.Close()
	go func() {
		for {
			c, err := echo.Accept()
			if err != nil {
				return
			}
			go func() { defer c.Close(); io.Copy(c, c) }()
		}
	}()
	_, port, _ := net.SplitHostPort(echo.Addr().String())
	remotePort, _ := strconv.Atoi(port)
	tunnel, err := m.StartTunnel(id, 0, "127.0.0.1", remotePort)
	if err != nil {
		t.Fatal(err)
	}
	client, err := net.DialTimeout("tcp", tunnel.LocalAddress, time.Second)
	if err != nil {
		t.Fatal(err)
	}
	client.SetDeadline(time.Now().Add(3 * time.Second))
	if _, err = client.Write([]byte("forwarded")); err != nil {
		t.Fatal(err)
	}
	got = make([]byte, 9)
	if _, err = io.ReadFull(client, got); err != nil || string(got) != "forwarded" {
		t.Fatalf("tunnel: %q %v", got, err)
	}
	client.Close()
	if err = m.StopTunnel(tunnel.ID); err != nil {
		t.Fatal(err)
	}
	stats, err := m.Stats(id)
	if err != nil || stats.Cores != 4 || stats.DiskTotal != 107374182400 {
		t.Fatalf("stats: %+v %v", stats, err)
	}
	m.Disconnect(id)
	if m.SessionCount() != 0 {
		t.Fatal("session leak")
	}
}
func TestKeyAuthentication(t *testing.T) {
	_, private, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	signer, err := ssh.NewSignerFromKey(private)
	if err != nil {
		t.Fatal(err)
	}
	server, err := testserver.Start("127.0.0.1:0", "unused", signer.PublicKey())
	if err != nil {
		t.Fatal(err)
	}
	defer server.Close()
	block, err := ssh.MarshalPrivateKeyWithPassphrase(private, "fixture", []byte("test-passphrase"))
	if err != nil {
		t.Fatal(err)
	}
	keyPath := filepath.Join(t.TempDir(), "id_ed25519")
	os.WriteFile(keyPath, pem.EncodeToMemory(block), 0600)
	store := mustStore(t)
	h := fixtureHost(t, store, server, "key", keyPath)
	m := NewManager(store, nil)
	defer m.Close()
	req := ConnectRequest{HostID: h.ID, Credentials: Credentials{Passphrase: "test-passphrase"}}
	result, err := m.Connect(req)
	if err != nil || result.Challenge == nil {
		t.Fatal(err)
	}
	req.ApprovedFingerprint = result.Challenge.Fingerprint
	result, err = m.Connect(req)
	if err != nil || result.ID == "" {
		t.Fatalf("key auth: %v", err)
	}
	if server.PasswordCalls.Load() != 0 {
		t.Fatal("key login used password")
	}
}
func TestHostKeyChangeAndSavedSecrets(t *testing.T) {
	store := mustStore(t)
	key1, _ := testserver.Signer()
	key2, _ := testserver.Signer()
	addr := &net.TCPAddr{IP: net.ParseIP("127.0.0.1"), Port: 2222}
	if err := store.CheckHostKey("127.0.0.1:2222", addr, key1.PublicKey(), ssh.FingerprintSHA256(key1.PublicKey())); err != nil {
		t.Fatal(err)
	}
	err := store.CheckHostKey("127.0.0.1:2222", addr, key2.PublicKey(), ssh.FingerprintSHA256(key2.PublicKey()))
	challenge, ok := err.(*HostKeyChallenge)
	if !ok || !challenge.Changed {
		t.Fatalf("changed key accepted: %v", err)
	}
	if err = store.CheckHostKey("127.0.0.1:2222", addr, key1.PublicKey(), ""); err != nil {
		t.Fatal("original key was replaced")
	}
	if runtime.GOOS != "windows" {
		return
	}
	h, err := store.SaveHost(HostInput{Host: Host{Name: "encrypted", Address: "example.com", Port: 22, User: "root", Auth: "password"}, Credentials: Credentials{Password: "must-not-be-plaintext"}, Remember: true})
	if err != nil {
		t.Fatal(err)
	}
	disk, _ := os.ReadFile(filepath.Join(store.directory, "config.json"))
	if bytes.Contains(disk, []byte("must-not-be-plaintext")) {
		t.Fatal("plaintext credential on disk")
	}
	reloaded, err := NewStore(store.directory)
	if err != nil {
		t.Fatal(err)
	}
	_, secret, err := reloaded.HostAndCredentials(h.ID)
	if err != nil || secret.Password != "must-not-be-plaintext" {
		t.Fatal("DPAPI round trip failed")
	}
	exported, err := store.Export()
	if err != nil || bytes.Contains(exported, []byte("must-not-be-plaintext")) || bytes.Contains(exported, []byte(`"secret"`)) {
		t.Fatal("export leaked credentials")
	}
}
func TestCancelQueuedTransferAndBackpressure(t *testing.T) {
	store := mustStore(t)
	server, err := testserver.Start("127.0.0.1:0", "password", nil)
	if err != nil {
		t.Fatal(err)
	}
	defer server.Close()
	m := NewManager(store, nil)
	defer m.Close()
	h := fixtureHost(t, store, server, "password", "")
	id := connectFixture(t, m, h, "password")
	for i := 0; i < 3; i++ {
		m.transferSlots <- struct{}{}
	}
	p := filepath.Join(t.TempDir(), "cancel.txt")
	os.WriteFile(p, []byte("never uploaded"), 0600)
	jobs, err := m.Upload(id, "/", []string{p}, false)
	if err != nil {
		t.Fatal(err)
	}
	m.CancelTransfer(jobs[0].ID)
	if job := waitTransfer(t, m, jobs[0].ID); job.Status != "cancelled" {
		t.Fatalf("cancel: %+v", job)
	}
	for i := 0; i < 3; i++ {
		<-m.transferSlots
	}
	listing, err := m.ListFiles(id, "/")
	if err != nil || len(listing.Files) != 0 {
		t.Fatal("cancelled queued transfer wrote a file")
	}
	ctx, cancel := context.WithCancel(context.Background())
	var stream *outputStream
	var ack atomicBool
	stream = newOutputStream(ctx, "test", func(_ string, value any) {
		event := value.(OutputEvent)
		if ack.Load() {
			stream.Ack(event.Bytes)
		}
	})
	done := make(chan struct{})
	go func() { stream.Write(make([]byte, 2<<20)); close(done) }()
	time.Sleep(60 * time.Millisecond)
	select {
	case <-done:
		t.Fatal("unacknowledged stream was not bounded")
	default:
	}
	ack.Store(true)
	stream.mu.Lock()
	pending := stream.pending
	stream.mu.Unlock()
	stream.Ack(pending)
	select {
	case <-done:
	case <-time.After(3 * time.Second):
		t.Fatal("acknowledged stream did not resume")
	}
	stream.Finish()
	<-stream.drained
	cancel()
	stream.Close()
}

type atomicBool struct {
	mu    sync.Mutex
	value bool
}

func (b *atomicBool) Load() bool   { b.mu.Lock(); defer b.mu.Unlock(); return b.value }
func (b *atomicBool) Store(v bool) { b.mu.Lock(); b.value = v; b.mu.Unlock() }
