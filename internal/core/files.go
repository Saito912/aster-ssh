package core

import (
	"errors"
	"fmt"
	"io"
	"os"
	"path"
	"sort"
	"strings"
	"unicode/utf8"

	"github.com/pkg/sftp"
)

const maxTextFile = 2 << 20

func (m *Manager) sftp(id string) (*remoteSession, *sftp.Client, error) {
	s, err := m.get(id)
	if err != nil {
		return nil, nil, err
	}
	s.sftpMu.Lock()
	defer s.sftpMu.Unlock()
	if s.sftpClient == nil {
		client, err := sftp.NewClient(s.client, sftp.MaxPacket(32768))
		if err != nil {
			return nil, nil, fmt.Errorf("SFTP 子系统不可用：%w", err)
		}
		home, err := client.Getwd()
		if err != nil {
			client.Close()
			return nil, nil, err
		}
		s.sftpClient = client
		s.home = home
	}
	return s, s.sftpClient, nil
}
func remotePath(s *remoteSession, p string) (string, error) {
	if strings.ContainsRune(p, 0) {
		return "", errors.New("路径无效")
	}
	if p == "" || p == "." || p == "~" {
		return s.home, nil
	}
	if strings.HasPrefix(p, "~/") {
		p = path.Join(s.home, p[2:])
	}
	if !path.IsAbs(p) {
		p = path.Join(s.home, p)
	}
	return path.Clean(p), nil
}
func fileType(info os.FileInfo) string {
	if info.IsDir() {
		return "folder"
	}
	if info.Mode()&os.ModeSymlink != 0 {
		return "link"
	}
	if info.Mode()&0111 != 0 {
		return "script"
	}
	return "file"
}
func (m *Manager) ListFiles(id, p string) (Directory, error) {
	s, c, err := m.sftp(id)
	if err != nil {
		return Directory{}, err
	}
	p, err = remotePath(s, p)
	if err != nil {
		return Directory{}, err
	}
	entries, err := c.ReadDir(p)
	if err != nil {
		return Directory{}, fmt.Errorf("目录读取失败：%w", err)
	}
	out := Directory{Path: p, Home: s.home, Files: []RemoteFile{}}
	for _, f := range entries {
		kind := fileType(f)
		if kind == "link" {
			if target, err := c.Stat(path.Join(p, f.Name())); err == nil && target.IsDir() {
				kind = "folder"
			}
		}
		out.Files = append(out.Files, RemoteFile{f.Name(), f.Size(), f.ModTime().UnixMilli(), f.Mode().String(), kind})
	}
	sort.Slice(out.Files, func(i, j int) bool {
		a, b := out.Files[i], out.Files[j]
		if (a.Type == "folder") != (b.Type == "folder") {
			return a.Type == "folder"
		}
		return strings.ToLower(a.Name) < strings.ToLower(b.Name)
	})
	return out, nil
}
func (m *Manager) ReadFile(id, p string) (TextFile, error) {
	s, c, err := m.sftp(id)
	if err != nil {
		return TextFile{}, err
	}
	p, err = remotePath(s, p)
	if err != nil {
		return TextFile{}, err
	}
	f, err := c.Open(p)
	if err != nil {
		return TextFile{}, err
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil {
		return TextFile{}, err
	}
	if !info.Mode().IsRegular() {
		return TextFile{}, errors.New("仅支持编辑普通文本文件；符号链接请下载后检查")
	}
	if info.Size() > maxTextFile {
		return TextFile{}, errors.New("在线编辑限 2 MB 以内的 UTF-8 文本，请下载此文件")
	}
	b, err := io.ReadAll(io.LimitReader(f, maxTextFile+1))
	if err != nil {
		return TextFile{}, err
	}
	if len(b) > maxTextFile || !utf8.Valid(b) || strings.ContainsRune(string(b), 0) {
		return TextFile{}, errors.New("此文件不是可编辑的 UTF-8 文本，请下载查看")
	}
	return TextFile{p, string(b), info.ModTime().UnixMilli(), info.Size()}, nil
}
func checkVersion(c *sftp.Client, p string, modified, size int64) error {
	info, err := c.Stat(p)
	if err != nil {
		return err
	}
	if info.ModTime().UnixMilli() != modified || info.Size() != size {
		return errors.New("文件已被其他程序修改，请关闭编辑器并重新打开后再保存")
	}
	return nil
}
func commitRemote(c *sftp.Client, tmp, dest string, replace bool) error {
	if replace {
		if _, ok := c.HasExtension("posix-rename@openssh.com"); ok {
			return c.PosixRename(tmp, dest)
		}
		return errors.New("服务器不支持安全覆盖（posix-rename），原文件保持不变；请另存为新文件")
	}
	if _, err := c.Lstat(dest); err == nil {
		return errors.New("目标文件已存在，未执行覆盖")
	} else if !os.IsNotExist(err) {
		return err
	}
	return c.Rename(tmp, dest)
}
func (m *Manager) WriteFile(id string, file TextFile) (TextFile, error) {
	if len(file.Content) > maxTextFile || !utf8.ValidString(file.Content) || strings.ContainsRune(file.Content, 0) {
		return TextFile{}, errors.New("仅支持 2 MB 以内的 UTF-8 文本")
	}
	s, c, err := m.sftp(id)
	if err != nil {
		return TextFile{}, err
	}
	p, err := remotePath(s, file.Path)
	if err != nil {
		return TextFile{}, err
	}
	if err = checkVersion(c, p, file.Modified, file.Size); err != nil {
		return TextFile{}, err
	}
	info, err := c.Lstat(p)
	if err != nil {
		return TextFile{}, err
	}
	if !info.Mode().IsRegular() {
		return TextFile{}, errors.New("仅支持保存普通文件，不能覆盖符号链接")
	}
	tmp := path.Join(path.Dir(p), ".aster-"+newID()+".tmp")
	f, err := c.OpenFile(tmp, os.O_CREATE|os.O_EXCL|os.O_WRONLY)
	if err != nil {
		return TextFile{}, err
	}
	defer c.Remove(tmp)
	_, writeErr := io.WriteString(f, file.Content)
	closeErr := f.Close()
	if writeErr != nil {
		return TextFile{}, writeErr
	}
	if closeErr != nil {
		return TextFile{}, closeErr
	}
	if err = c.Chmod(tmp, info.Mode().Perm()); err != nil {
		return TextFile{}, err
	}
	if err = checkVersion(c, p, file.Modified, file.Size); err != nil {
		return TextFile{}, err
	}
	if err = commitRemote(c, tmp, p, true); err != nil {
		return TextFile{}, err
	}
	return m.ReadFile(id, p)
}
func (m *Manager) MakeDirectory(id, p string) error {
	s, c, err := m.sftp(id)
	if err != nil {
		return err
	}
	p, err = remotePath(s, p)
	if err != nil {
		return err
	}
	return c.Mkdir(p)
}
func (m *Manager) Rename(id, old, new string) error {
	s, c, err := m.sftp(id)
	if err != nil {
		return err
	}
	old, err = remotePath(s, old)
	if err != nil {
		return err
	}
	new, err = remotePath(s, new)
	if err != nil {
		return err
	}
	if _, err = c.Lstat(new); err == nil {
		return errors.New("目标名称已存在")
	}
	return c.Rename(old, new)
}
func (m *Manager) Remove(id, p string) error {
	s, c, err := m.sftp(id)
	if err != nil {
		return err
	}
	p, err = remotePath(s, p)
	if err != nil {
		return err
	}
	if p == "/" || p == s.home {
		return errors.New("不能删除根目录或主目录")
	}
	info, err := c.Lstat(p)
	if err != nil {
		return err
	}
	if info.IsDir() {
		return c.RemoveDirectory(p)
	}
	return c.Remove(p)
}
