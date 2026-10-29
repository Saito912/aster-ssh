// Package testserver implements a loopback-only SSH protocol fixture. Its SFTP
// filesystem is in memory: it cannot expose files on the developer's computer.
// It is never imported by the production application.
package testserver

import (
	"bufio"
	"crypto/ed25519"
	"crypto/rand"
	"errors"
	"fmt"
	"io"
	"net"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"

	"github.com/pkg/sftp"
	"golang.org/x/crypto/ssh"
)

type Server struct {
	Listener      net.Listener
	Signer        ssh.Signer
	PasswordCalls atomic.Int32
	Resizes       atomic.Int32
	handlers      sftp.Handlers
	mu            sync.Mutex
	conns         map[net.Conn]bool
}

func Signer() (ssh.Signer, error) {
	_, key, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, err
	}
	return ssh.NewSignerFromKey(key)
}
func Start(address, password string, allowedKey ssh.PublicKey) (*Server, error) {
	signer, err := Signer()
	if err != nil {
		return nil, err
	}
	listener, err := net.Listen("tcp", address)
	if err != nil {
		return nil, err
	}
	if !listener.Addr().(*net.TCPAddr).IP.IsLoopback() {
		listener.Close()
		return nil, errors.New("test server must bind loopback")
	}
	s := &Server{Listener: listener, Signer: signer, handlers: sftp.InMemHandler(), conns: map[net.Conn]bool{}}
	config := &ssh.ServerConfig{PasswordCallback: func(c ssh.ConnMetadata, p []byte) (*ssh.Permissions, error) {
		s.PasswordCalls.Add(1)
		if c.User() == "demo" && string(p) == password {
			return nil, nil
		}
		return nil, errors.New("invalid test credentials")
	}, PublicKeyCallback: func(c ssh.ConnMetadata, key ssh.PublicKey) (*ssh.Permissions, error) {
		if c.User() == "demo" && allowedKey != nil && string(key.Marshal()) == string(allowedKey.Marshal()) {
			return nil, nil
		}
		return nil, errors.New("test key rejected")
	}}
	config.AddHostKey(signer)
	go func() {
		for {
			conn, err := listener.Accept()
			if err != nil {
				return
			}
			s.mu.Lock()
			s.conns[conn] = true
			s.mu.Unlock()
			go s.serve(conn, config)
		}
	}()
	return s, nil
}
func (s *Server) Close() {
	s.Listener.Close()
	s.mu.Lock()
	defer s.mu.Unlock()
	for conn := range s.conns {
		conn.Close()
	}
}
func (s *Server) serve(conn net.Conn, config *ssh.ServerConfig) {
	defer func() { conn.Close(); s.mu.Lock(); delete(s.conns, conn); s.mu.Unlock() }()
	sshConn, channels, requests, err := ssh.NewServerConn(conn, config)
	if err != nil {
		return
	}
	defer sshConn.Close()
	go func() {
		for r := range requests {
			r.Reply(r.Type == "keepalive@openssh.com", nil)
		}
	}()
	for channel := range channels {
		switch channel.ChannelType() {
		case "session":
			ch, reqs, err := channel.Accept()
			if err == nil {
				go s.session(ch, reqs)
			}
		case "direct-tcpip":
			var request struct {
				Host       string
				Port       uint32
				Origin     string
				OriginPort uint32
			}
			if ssh.Unmarshal(channel.ExtraData(), &request) != nil || request.Host != "127.0.0.1" {
				channel.Reject(ssh.Prohibited, "loopback fixture only")
				continue
			}
			remote, err := net.Dial("tcp", net.JoinHostPort(request.Host, strconv.Itoa(int(request.Port))))
			if err != nil {
				channel.Reject(ssh.ConnectionFailed, err.Error())
				continue
			}
			ch, reqs, err := channel.Accept()
			if err != nil {
				remote.Close()
				continue
			}
			go ssh.DiscardRequests(reqs)
			go func() {
				defer ch.Close()
				defer remote.Close()
				go func() { io.Copy(remote, ch); remote.Close() }()
				io.Copy(ch, remote)
			}()
		default:
			channel.Reject(ssh.UnknownChannelType, "unsupported")
		}
	}
}
func (s *Server) session(ch ssh.Channel, requests <-chan *ssh.Request) {
	for req := range requests {
		switch req.Type {
		case "pty-req", "env":
			req.Reply(true, nil)
		case "window-change":
			s.Resizes.Add(1)
			req.Reply(true, nil)
		case "shell":
			req.Reply(true, nil)
			go s.shell(ch)
		case "subsystem":
			var payload struct{ Name string }
			ssh.Unmarshal(req.Payload, &payload)
			if payload.Name != "sftp" {
				req.Reply(false, nil)
				continue
			}
			req.Reply(true, nil)
			go func() {
				defer ch.Close()
				server := sftp.NewRequestServer(ch, s.handlers)
				server.Serve()
				server.Close()
			}()
		case "exec":
			req.Reply(true, nil)
			go func() {
				defer ch.Close()
				io.WriteString(ch, StatsFixture)
				ch.SendRequest("exit-status", false, ssh.Marshal(struct{ Status uint32 }{0}))
			}()
		default:
			req.Reply(false, nil)
		}
	}
	ch.Close()
}
func (s *Server) shell(ch ssh.Channel) {
	defer ch.Close()
	io.WriteString(ch, "\x1b[36mAster SSH integration fixture\x1b[0m\r\nReal SSH / PTY / SFTP transport; isolated in-memory files.\r\n\x1b[32mdemo@localhost\x1b[0m ~ $ ")
	reader := bufio.NewReader(ch)
	var command []byte
	for {
		b, err := reader.ReadByte()
		if err != nil {
			return
		}
		switch b {
		case 3:
			command = nil
			io.WriteString(ch, "^C\r\n$ ")
		case 4:
			ch.SendRequest("exit-status", false, ssh.Marshal(struct{ Status uint32 }{0}))
			return
		case 127, 8:
			if len(command) > 0 {
				command = command[:len(command)-1]
				io.WriteString(ch, "\b \b")
			}
		case '\r', '\n':
			io.WriteString(ch, "\r\n")
			line := string(command)
			command = nil
			switch {
			case strings.HasPrefix(line, "echo "):
				io.WriteString(ch, strings.TrimPrefix(line, "echo ")+"\r\n")
			case line == "pwd":
				io.WriteString(ch, "/\r\n")
			case line == "exit":
				ch.SendRequest("exit-status", false, ssh.Marshal(struct{ Status uint32 }{0}))
				return
			case line == "help":
				io.WriteString(ch, "Fixture commands: echo <text>, pwd, seq, exit\r\n")
			case line == "seq":
				for i := 0; i < 10000; i++ {
					if _, err := fmt.Fprintf(ch, "stream line %05d 中文\r\n", i); err != nil {
						return
					}
				}
			default:
				if line != "" {
					io.WriteString(ch, "fixture received: "+line+"\r\n")
				}
			}
			io.WriteString(ch, "\x1b[32mdemo@localhost\x1b[0m ~ $ ")
		default:
			command = append(command, b)
			ch.Write([]byte{b})
		}
	}
}

const StatsFixture = `
__ASTER_OS__
PRETTY_NAME="Ubuntu 24.04 LTS (test fixture)"
__ASTER_CPU__
cpu 100 0 100 800 0 0 0 0 0 0
__ASTER_MEM__
MemTotal: 8388608 kB
MemAvailable: 5242880 kB
__ASTER_DISK__
Filesystem 1024-blocks Used Available Capacity Mounted on
/dev/test 104857600 41943040 62914560 40% /
__ASTER_NET__
Inter-| Receive | Transmit
 eth0: 1048576 10 0 0 0 0 0 0 524288 10 0 0 0 0 0 0
__ASTER_UP__
2476800.00 100000.00
__ASTER_CORES__
4
`
