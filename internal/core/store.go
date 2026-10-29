package core

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"golang.org/x/crypto/ssh"
	"golang.org/x/crypto/ssh/knownhosts"
)

type hostRecord struct {
	Host
	Secret string `json:"secret,omitempty"`
}
type diskConfig struct {
	Version     int          `json:"version"`
	Hosts       []hostRecord `json:"hosts"`
	Preferences Preferences  `json:"preferences"`
	Snippets    []Snippet    `json:"snippets"`
}
type Store struct {
	mu        sync.Mutex
	directory string
	data      diskConfig
}

func newID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b)
}
func NewStore(directory string) (*Store, error) {
	if err := os.MkdirAll(directory, 0700); err != nil {
		return nil, err
	}
	s := &Store{directory: directory, data: diskConfig{Version: 1, Hosts: []hostRecord{}, Preferences: Preferences{Theme: "light", AppearanceVersion: 2, FontSize: 14, Scrollback: 5000, Monitor: true}, Snippets: []Snippet{{"containers", "查看容器", "docker ps"}, {"disk", "磁盘空间", "df -h"}, {"memory", "内存概览", "free -h"}, {"processes", "进程监控", "htop"}, {"system", "系统信息", "uname -a"}, {"uptime", "运行时间", "uptime"}}}}
	b, err := os.ReadFile(filepath.Join(directory, "config.json"))
	if err == nil {
		// Missing revision in an older file must trigger the one-time theme migration.
		s.data.Preferences.AppearanceVersion = 0
		if err = json.Unmarshal(b, &s.data); err != nil {
			return nil, fmt.Errorf("配置文件无法读取，请先备份再修复：%w", err)
		}
		if s.data.Version != 1 {
			return nil, errors.New("不支持此配置文件版本")
		}
		for _, h := range s.data.Hosts {
			if err := validateHost(h.Host); err != nil {
				return nil, fmt.Errorf("连接配置无效：%w", err)
			}
		}
		s.data.Preferences = normalizePreferences(s.data.Preferences)
	} else if !os.IsNotExist(err) {
		return nil, err
	}
	f, err := os.OpenFile(filepath.Join(directory, "known_hosts"), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0600)
	if err != nil {
		return nil, err
	}
	f.Close()
	return s, nil
}
func normalizePreferences(p Preferences) Preferences {
	if p.AppearanceVersion < 2 {
		p.Theme = "light"
		p.AppearanceVersion = 2
	}
	if p.Theme != "dark" && p.Theme != "light" {
		p.Theme = "light"
	}
	if p.FontSize < 10 || p.FontSize > 24 {
		p.FontSize = 14
	}
	if p.Scrollback < 500 || p.Scrollback > 20000 {
		p.Scrollback = 5000
	}
	return p
}
func validateHost(h Host) error {
	if strings.TrimSpace(h.Name) == "" || len(h.Name) > 80 {
		return errors.New("连接名称需为 1–80 个字符")
	}
	if h.Port < 1 || h.Port > 65535 {
		return errors.New("端口必须在 1–65535 之间")
	}
	if strings.TrimSpace(h.Address) == "" || strings.ContainsAny(h.Address, "\r\n\x00 /\\") || len(h.Address) > 253 {
		return errors.New("请输入有效的 IP 地址或主机名")
	}
	if strings.TrimSpace(h.User) == "" || strings.ContainsAny(h.User, "\r\n\x00") {
		return errors.New("请输入有效用户名")
	}
	if h.Auth != "password" && h.Auth != "key" {
		return errors.New("请选择密码或私钥认证")
	}
	if h.Auth == "key" && h.KeyPath == "" {
		return errors.New("请选择私钥文件")
	}
	return nil
}
func (s *Store) persistLocked() error {
	b, err := json.MarshalIndent(s.data, "", "  ")
	if err != nil {
		return err
	}
	p := filepath.Join(s.directory, "config.json")
	tmp := p + ".tmp"
	if err = os.WriteFile(tmp, b, 0600); err != nil {
		return err
	}
	if err = os.Rename(tmp, p); err != nil {
		os.Remove(tmp)
		return err
	}
	return nil
}
func (s *Store) Config() Config {
	s.mu.Lock()
	defer s.mu.Unlock()
	hosts := make([]Host, 0, len(s.data.Hosts))
	for _, r := range s.data.Hosts {
		h := r.Host
		h.HasSecret = r.Secret != ""
		hosts = append(hosts, h)
	}
	return Config{hosts, s.data.Preferences, append([]Snippet{}, s.data.Snippets...), "1.0.3", s.directory}
}
func (s *Store) SaveHost(input HostInput) (Host, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	h := input.Host
	h.Name = strings.TrimSpace(h.Name)
	h.Address = strings.Trim(strings.TrimSpace(h.Address), "[]")
	h.User = strings.TrimSpace(h.User)
	h.Group = strings.TrimSpace(h.Group)
	if h.Group == "" {
		h.Group = "未分组"
	}
	if err := validateHost(h); err != nil {
		return Host{}, err
	}
	index := -1
	for i, r := range s.data.Hosts {
		if r.ID == h.ID {
			index = i
			break
		}
	}
	if index < 0 {
		h.ID = newID()
	}
	secret := ""
	if input.KeepSecret && index >= 0 {
		secret = s.data.Hosts[index].Secret
	}
	if input.Remember && (input.Credentials.Password != "" || input.Credentials.Passphrase != "") {
		b, _ := json.Marshal(input.Credentials)
		var err error
		secret, err = seal(b)
		if err != nil {
			return Host{}, fmt.Errorf("凭据加密失败：%w", err)
		}
	} else if !input.KeepSecret {
		secret = ""
	}
	h.HasSecret = secret != ""
	record := hostRecord{h, secret}
	before := append([]hostRecord{}, s.data.Hosts...)
	if index >= 0 {
		s.data.Hosts[index] = record
	} else {
		s.data.Hosts = append(s.data.Hosts, record)
	}
	if err := s.persistLocked(); err != nil {
		s.data.Hosts = before
		return Host{}, err
	}
	return h, nil
}
func (s *Store) HostAndCredentials(id string) (Host, Credentials, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, r := range s.data.Hosts {
		if r.ID == id {
			var c Credentials
			if r.Secret != "" {
				b, err := unseal(r.Secret)
				if err != nil {
					return Host{}, c, errors.New("已保存凭据无法解密，请重新输入或编辑连接清除保存的凭据")
				}
				if err = json.Unmarshal(b, &c); err != nil {
					return Host{}, c, err
				}
			}
			h := r.Host
			h.HasSecret = r.Secret != ""
			return h, c, nil
		}
	}
	return Host{}, Credentials{}, errors.New("连接配置不存在")
}
func (s *Store) DeleteHost(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	before := append([]hostRecord{}, s.data.Hosts...)
	for i, h := range s.data.Hosts {
		if h.ID == id {
			s.data.Hosts = append(s.data.Hosts[:i], s.data.Hosts[i+1:]...)
			if err := s.persistLocked(); err != nil {
				s.data.Hosts = before
				return err
			}
			return nil
		}
	}
	return errors.New("连接配置不存在")
}
func (s *Store) SavePreferences(p Preferences) (Preferences, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	old := s.data.Preferences
	s.data.Preferences = normalizePreferences(p)
	if err := s.persistLocked(); err != nil {
		s.data.Preferences = old
		return old, err
	}
	return s.data.Preferences, nil
}
func (s *Store) SaveSnippets(snippets []Snippet) error {
	if len(snippets) > 100 {
		return errors.New("最多保存 100 条快捷命令")
	}
	for i := range snippets {
		if strings.ContainsAny(snippets[i].Command, "\r\n\x00") {
			return errors.New("每条快捷命令仅支持单行，请拆分后保存")
		}
		if len(snippets[i].Name) == 0 || len(snippets[i].Name) > 80 || len(snippets[i].Command) == 0 || len(snippets[i].Command) > 8192 {
			return errors.New("快捷命令名称或内容长度无效")
		}
		if snippets[i].ID == "" {
			snippets[i].ID = newID()
		}
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	old := s.data.Snippets
	s.data.Snippets = snippets
	if err := s.persistLocked(); err != nil {
		s.data.Snippets = old
		return err
	}
	return nil
}
func (s *Store) Export() ([]byte, error) {
	return json.MarshalIndent(struct {
		Version int    `json:"version"`
		Hosts   []Host `json:"hosts"`
	}{1, s.Config().Hosts}, "", "  ")
}
func (s *Store) Import(b []byte) (int, error) {
	var data struct {
		Version int    `json:"version"`
		Hosts   []Host `json:"hosts"`
	}
	if len(b) > 4<<20 {
		return 0, errors.New("配置文件不能超过 4 MB")
	}
	if err := json.Unmarshal(b, &data); err != nil {
		return 0, errors.New("配置文件格式无效")
	}
	if data.Version != 1 || len(data.Hosts) > 1000 {
		return 0, errors.New("配置版本不支持或连接数量过多")
	}
	for _, h := range data.Hosts {
		if err := validateHost(h); err != nil {
			return 0, err
		}
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	old := append([]hostRecord{}, s.data.Hosts...)
	for _, h := range data.Hosts {
		h.ID = newID()
		h.HasSecret = false
		s.data.Hosts = append(s.data.Hosts, hostRecord{Host: h})
	}
	if err := s.persistLocked(); err != nil {
		s.data.Hosts = old
		return 0, err
	}
	return len(data.Hosts), nil
}
func (s *Store) CheckHostKey(address string, remote net.Addr, key ssh.PublicKey, approved string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	filename := filepath.Join(s.directory, "known_hosts")
	check, err := knownhosts.New(filename)
	if err != nil {
		return fmt.Errorf("主机指纹文件读取失败：%w", err)
	}
	err = check(address, remote, key)
	if err == nil {
		return nil
	}
	var keyErr *knownhosts.KeyError
	if !errors.As(err, &keyErr) {
		return err
	}
	challenge := &HostKeyChallenge{Address: address, KeyType: key.Type(), Fingerprint: ssh.FingerprintSHA256(key), Changed: len(keyErr.Want) > 0}
	if challenge.Changed {
		challenge.KnownFingerprint = ssh.FingerprintSHA256(keyErr.Want[0].Key)
		return challenge
	}
	if approved != challenge.Fingerprint {
		return challenge
	}
	f, err := os.OpenFile(filename, os.O_APPEND|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = f.WriteString(knownhosts.Line([]string{knownhosts.Normalize(address)}, key) + "\n")
	return err
}
