package core

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/pkg/sftp"
	"golang.org/x/crypto/ssh"
)

type remoteSession struct {
	id         string
	host       Host
	client     *ssh.Client
	ctx        context.Context
	cancel     context.CancelFunc
	stream     *outputStream
	mu         sync.Mutex
	shell      *ssh.Session
	stdin      io.WriteCloser
	sftpMu     sync.Mutex
	sftpClient *sftp.Client
	home       string
	started    bool
	closed     bool
	writeMu    sync.Mutex
	statsMu    sync.Mutex
	sample     counterSample
	once       sync.Once
}
type transferJob struct {
	mu     sync.Mutex
	value  Transfer
	ctx    context.Context
	cancel context.CancelFunc
}
type tunnelState struct {
	value    Tunnel
	listener net.Listener
	cancel   context.CancelFunc
}
type Manager struct {
	store         *Store
	emit          EventSink
	mu            sync.RWMutex
	sessions      map[string]*remoteSession
	jobs          map[string]*transferJob
	tunnels       map[string]*tunnelState
	transferSlots chan struct{}
	shutdown      bool
}

func NewManager(store *Store, emit EventSink) *Manager {
	if emit == nil {
		emit = func(string, any) {}
	}
	return &Manager{store: store, emit: emit, sessions: make(map[string]*remoteSession), jobs: make(map[string]*transferJob), tunnels: make(map[string]*tunnelState), transferSlots: make(chan struct{}, 3)}
}
func (m *Manager) get(id string) (*remoteSession, error) {
	m.mu.RLock()
	s := m.sessions[id]
	m.mu.RUnlock()
	if s == nil {
		return nil, errors.New("会话不存在或已断开")
	}
	s.mu.Lock()
	closed := s.closed
	s.mu.Unlock()
	if closed {
		return nil, errors.New("会话已断开")
	}
	return s, nil
}
func (m *Manager) Connect(req ConnectRequest) (ConnectResult, error) {
	h, saved, err := m.store.HostAndCredentials(req.HostID)
	if err != nil {
		return ConnectResult{}, err
	}
	c := req.Credentials
	if c.Password == "" {
		c.Password = saved.Password
	}
	if c.Passphrase == "" {
		c.Passphrase = saved.Passphrase
	}
	var auth []ssh.AuthMethod
	if h.Auth == "key" {
		key, err := os.ReadFile(h.KeyPath)
		if err != nil {
			return ConnectResult{}, fmt.Errorf("私钥读取失败：%w", err)
		}
		if len(key) > 1<<20 {
			return ConnectResult{}, errors.New("私钥文件过大")
		}
		var signer ssh.Signer
		if c.Passphrase != "" {
			signer, err = ssh.ParsePrivateKeyWithPassphrase(key, []byte(c.Passphrase))
		} else {
			signer, err = ssh.ParsePrivateKey(key)
		}
		if err != nil {
			return ConnectResult{}, fmt.Errorf("私钥解析失败（可能需要私钥口令）：%w", err)
		}
		auth = []ssh.AuthMethod{ssh.PublicKeys(signer)}
	} else {
		if c.Password == "" {
			return ConnectResult{}, errors.New("请输入登录密码")
		}
		auth = []ssh.AuthMethod{ssh.Password(c.Password)}
	}
	address := net.JoinHostPort(h.Address, strconv.Itoa(h.Port))
	config := &ssh.ClientConfig{User: h.User, Auth: auth, Timeout: 12 * time.Second, HostKeyCallback: func(hostname string, remote net.Addr, key ssh.PublicKey) error {
		return m.store.CheckHostKey(hostname, remote, key, req.ApprovedFingerprint)
	}}
	started := time.Now()
	conn, err := net.DialTimeout("tcp", address, 12*time.Second)
	if err != nil {
		return ConnectResult{}, fmt.Errorf("无法连接 %s：%w", address, err)
	}
	conn.SetDeadline(time.Now().Add(15 * time.Second))
	clientConn, chans, requests, err := ssh.NewClientConn(conn, address, config)
	if err != nil {
		conn.Close()
		var challenge *HostKeyChallenge
		if errors.As(err, &challenge) {
			return ConnectResult{Host: h, Challenge: challenge}, nil
		}
		return ConnectResult{}, fmt.Errorf("SSH 连接失败：%w", err)
	}
	conn.SetDeadline(time.Time{})
	client := ssh.NewClient(clientConn, chans, requests)
	ctx, cancel := context.WithCancel(context.Background())
	id := newID()
	s := &remoteSession{id: id, host: h, client: client, ctx: ctx, cancel: cancel}
	s.stream = newOutputStream(ctx, id, m.emit)
	m.mu.Lock()
	if m.shutdown {
		m.mu.Unlock()
		cancel()
		s.stream.Close()
		client.Close()
		return ConnectResult{}, errors.New("应用正在退出")
	}
	m.sessions[id] = s
	m.mu.Unlock()
	go m.keepAlive(s)
	return ConnectResult{ID: id, Host: h, LatencyMS: time.Since(started).Milliseconds()}, nil
}
func (m *Manager) StartShell(id string, cols, rows int) error {
	s, err := m.get(id)
	if err != nil {
		return err
	}
	s.mu.Lock()
	if s.started {
		s.mu.Unlock()
		return errors.New("终端已启动")
	}
	if s.closed {
		s.mu.Unlock()
		return errors.New("会话已断开")
	}
	s.started = true
	s.mu.Unlock()
	shell, err := s.client.NewSession()
	if err != nil {
		return err
	}
	cols, rows = terminalDimensions(cols, rows)
	if err = shell.RequestPty("xterm-256color", rows, cols, ssh.TerminalModes{ssh.ECHO: 1, ssh.TTY_OP_ISPEED: 14400, ssh.TTY_OP_OSPEED: 14400}); err != nil {
		shell.Close()
		return fmt.Errorf("服务器拒绝分配 PTY：%w", err)
	}
	_ = shell.Setenv("COLORTERM", "truecolor")
	stdin, err := shell.StdinPipe()
	if err != nil {
		shell.Close()
		return err
	}
	shell.Stdout = s.stream
	shell.Stderr = s.stream
	if err = shell.Shell(); err != nil {
		shell.Close()
		return err
	}
	s.mu.Lock()
	if s.closed {
		s.mu.Unlock()
		shell.Close()
		return errors.New("会话已断开")
	}
	s.shell = shell
	s.stdin = stdin
	s.mu.Unlock()
	go func() {
		err := shell.Wait()
		s.stream.Finish()
		select {
		case <-s.stream.drained:
		case <-time.After(2 * time.Second):
		}
		message := "远程 Shell 已退出"
		if err != nil {
			message = err.Error()
		}
		m.end(s, message)
	}()
	m.emit("session:status", SessionEvent{id, "connected", ""})
	return nil
}
func terminalDimensions(cols, rows int) (int, int) {
	if cols < 10 {
		cols = 80
	}
	if rows < 2 {
		rows = 24
	}
	if cols > 1000 {
		cols = 1000
	}
	if rows > 400 {
		rows = 400
	}
	return cols, rows
}
func (m *Manager) Write(id, data string) error {
	if len(data) > 1<<20 {
		return errors.New("单次输入不能超过 1 MB")
	}
	return m.writeBytes(id, []byte(data))
}
func (m *Manager) WriteBinary(id, data string) error {
	b, err := base64.StdEncoding.DecodeString(data)
	if err != nil {
		return err
	}
	if len(b) > 1<<20 {
		return errors.New("输入过大")
	}
	return m.writeBytes(id, b)
}
func (m *Manager) writeBytes(id string, data []byte) error {
	s, err := m.get(id)
	if err != nil {
		return err
	}
	s.mu.Lock()
	stdin := s.stdin
	s.mu.Unlock()
	if stdin == nil {
		return errors.New("终端尚未启动")
	}
	s.writeMu.Lock()
	defer s.writeMu.Unlock()
	_, err = stdin.Write(data)
	return err
}
func (m *Manager) Ack(id string, n int) {
	m.mu.RLock()
	s := m.sessions[id]
	m.mu.RUnlock()
	if s != nil {
		s.stream.Ack(n)
	}
}
func (m *Manager) Resize(id string, cols, rows int) error {
	s, err := m.get(id)
	if err != nil {
		return err
	}
	s.mu.Lock()
	shell := s.shell
	s.mu.Unlock()
	if shell == nil {
		return nil
	}
	cols, rows = terminalDimensions(cols, rows)
	return shell.WindowChange(rows, cols)
}
func (m *Manager) end(s *remoteSession, message string) {
	s.once.Do(func() {
		s.mu.Lock()
		s.closed = true
		s.mu.Unlock()
		s.cancel()
		s.stream.Close()
		s.client.Close()
		m.mu.Lock()
		delete(m.sessions, s.id)
		var listeners []*tunnelState
		for id, t := range m.tunnels {
			if t.value.SessionID == s.id {
				listeners = append(listeners, t)
				delete(m.tunnels, id)
			}
		}
		var jobs []*transferJob
		for _, j := range m.jobs {
			if j.value.SessionID == s.id {
				jobs = append(jobs, j)
			}
		}
		m.mu.Unlock()
		for _, t := range listeners {
			t.cancel()
			t.listener.Close()
		}
		for _, j := range jobs {
			j.cancel()
		}
		m.emit("session:status", SessionEvent{s.id, "disconnected", message})
	})
}
func (m *Manager) Disconnect(id string) error {
	m.mu.RLock()
	s := m.sessions[id]
	m.mu.RUnlock()
	if s != nil {
		m.end(s, "连接已关闭")
	}
	return nil
}
func (m *Manager) keepAlive(s *remoteSession) {
	ticker := time.NewTicker(25 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-s.ctx.Done():
			return
		case <-ticker.C:
			result := make(chan error, 1)
			go func() { _, _, err := s.client.SendRequest("keepalive@openssh.com", true, nil); result <- err }()
			select {
			case err := <-result:
				if err != nil {
					m.end(s, "网络连接已断开")
					return
				}
			case <-time.After(8 * time.Second):
				m.end(s, "服务器心跳超时")
				return
			case <-s.ctx.Done():
				return
			}
		}
	}
}
func (m *Manager) SessionCount() int { m.mu.RLock(); defer m.mu.RUnlock(); return len(m.sessions) }
func (m *Manager) Close() {
	m.mu.Lock()
	m.shutdown = true
	sessions := make([]*remoteSession, 0, len(m.sessions))
	for _, s := range m.sessions {
		sessions = append(sessions, s)
	}
	m.mu.Unlock()
	for _, s := range sessions {
		m.end(s, "应用已退出")
	}
}
func (m *Manager) SetLog(id, path string) error {
	s, err := m.get(id)
	if err != nil {
		return err
	}
	return s.stream.SetLog(path)
}
func (m *Manager) StartTunnel(id string, localPort int, destination string, remotePort int) (Tunnel, error) {
	s, err := m.get(id)
	if err != nil {
		return Tunnel{}, err
	}
	if localPort < 0 || localPort > 65535 || remotePort < 1 || remotePort > 65535 || strings.TrimSpace(destination) == "" || strings.ContainsAny(destination, "\r\n\x00 /\\") {
		return Tunnel{}, errors.New("端口或目标主机无效")
	}
	listener, err := net.Listen("tcp", net.JoinHostPort("127.0.0.1", strconv.Itoa(localPort)))
	if err != nil {
		return Tunnel{}, err
	}
	ctx, cancel := context.WithCancel(s.ctx)
	t := Tunnel{newID(), id, listener.Addr().String(), net.JoinHostPort(strings.Trim(destination, "[]"), strconv.Itoa(remotePort))}
	m.mu.Lock()
	m.tunnels[t.ID] = &tunnelState{t, listener, cancel}
	m.mu.Unlock()
	go func() {
		slots := make(chan struct{}, 32)
		for {
			local, err := listener.Accept()
			if err != nil {
				return
			}
			select {
			case slots <- struct{}{}:
			case <-ctx.Done():
				local.Close()
				return
			}
			go func() {
				defer func() { <-slots }()
				defer local.Close()
				dialCtx, stop := context.WithTimeout(ctx, 10*time.Second)
				defer stop()
				remote, err := s.client.DialContext(dialCtx, "tcp", t.Destination)
				if err != nil {
					return
				}
				defer remote.Close()
				done := make(chan struct{})
				go func() {
					select {
					case <-ctx.Done():
						local.Close()
						remote.Close()
					case <-done:
					}
				}()
				go func() { io.Copy(remote, local); remote.Close() }()
				io.Copy(local, remote)
				close(done)
			}()
		}
	}()
	return t, nil
}
func (m *Manager) StopTunnel(id string) error {
	m.mu.Lock()
	t := m.tunnels[id]
	delete(m.tunnels, id)
	m.mu.Unlock()
	if t != nil {
		t.cancel()
		return t.listener.Close()
	}
	return nil
}
func (m *Manager) Tunnels() []Tunnel {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := []Tunnel{}
	for _, t := range m.tunnels {
		out = append(out, t.value)
	}
	return out
}
