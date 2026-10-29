package core

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/pkg/sftp"
)

const maxTransferEntries = 50000

type treeEntry struct {
	local, remote                                  string
	directory, existed                             bool
	size, modified, originalSize, originalModified int64
	mode                                           os.FileMode
}
type treePlan struct {
	name, local, remote string
	directory, exists   bool
	total               int64
	conflicts           int
	entries             []treeEntry
}

func checkEntryLimit(entries int) error {
	if entries >= maxTransferEntries {
		return fmt.Errorf("单次传输最多支持 %d 个文件与目录，请拆分后传输", maxTransferEntries)
	}
	return nil
}
func remoteEntryName(name string) error {
	if name == "" || name == "." || name == ".." || strings.ContainsAny(name, "/\x00") {
		return errors.New("服务器返回了无效文件名")
	}
	return nil
}
func windowsEntryName(name string) error {
	if err := remoteEntryName(name); err != nil {
		return err
	}
	if strings.ContainsAny(name, "<>:\"\\|?*") || strings.TrimRight(name, " .") != name {
		return fmt.Errorf("Windows 无法保存文件名 %q", name)
	}
	for _, r := range name {
		if r < 32 {
			return fmt.Errorf("Windows 无法保存文件名 %q", name)
		}
	}
	stem := strings.ToUpper(strings.SplitN(name, ".", 2)[0])
	reserved := stem == "CON" || stem == "PRN" || stem == "AUX" || stem == "NUL"
	if len(stem) == 4 && (strings.HasPrefix(stem, "COM") || strings.HasPrefix(stem, "LPT")) && stem[3] >= '1' && stem[3] <= '9' {
		reserved = true
	}
	if reserved {
		return fmt.Errorf("Windows 保留文件名 %q，无法按原名下载", name)
	}
	return nil
}
func localName(name string) error {
	if runtime.GOOS == "windows" {
		return windowsEntryName(name)
	}
	return remoteEntryName(name)
}
func localDestination(directory string) (string, error) {
	if !filepath.IsAbs(directory) {
		return "", errors.New("请选择本地接收目录")
	}
	actual, err := filepath.EvalSymlinks(directory)
	if err != nil {
		return "", err
	}
	info, err := os.Stat(actual)
	if err != nil {
		return "", err
	}
	if !info.IsDir() {
		return "", errors.New("接收位置必须是文件夹")
	}
	return actual, nil
}
func (m *Manager) planUpload(s *remoteSession, c *sftp.Client, directory, source string) (treePlan, error) {
	var plan treePlan
	if !filepath.IsAbs(source) {
		return plan, errors.New("上传路径必须为绝对路径")
	}
	source = filepath.Clean(source)
	info, err := os.Lstat(source)
	if err != nil {
		return plan, err
	}
	if info.Mode()&os.ModeSymlink != 0 || (!info.IsDir() && !info.Mode().IsRegular()) {
		return plan, errors.New("暂不支持上传符号链接和特殊文件")
	}
	plan = treePlan{name: filepath.Base(source), local: source, remote: path.Join(directory, filepath.Base(source)), directory: info.IsDir(), entries: []treeEntry{}}
	if err = remoteEntryName(plan.name); err != nil {
		return plan, err
	}
	cache := map[string]map[string]os.FileInfo{}
	lookup := func(target string) (os.FileInfo, error) {
		parent := path.Dir(target)
		items, ok := cache[parent]
		if !ok {
			items = map[string]os.FileInfo{}
			list, err := c.ReadDir(parent)
			if err != nil && !os.IsNotExist(err) {
				return nil, err
			}
			for _, f := range list {
				items[f.Name()] = f
			}
			cache[parent] = items
		}
		return items[path.Base(target)], nil
	}
	err = filepath.WalkDir(source, func(local string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if err := s.ctx.Err(); err != nil {
			return err
		}
		if err := checkEntryLimit(len(plan.entries)); err != nil {
			return err
		}
		if entry.Type()&os.ModeSymlink != 0 {
			return fmt.Errorf("目录包含符号链接，未开始传输：%s", local)
		}
		info, err := entry.Info()
		if err != nil {
			return err
		}
		if !info.IsDir() && !info.Mode().IsRegular() {
			return fmt.Errorf("目录包含特殊文件：%s", local)
		}
		relative, err := filepath.Rel(source, local)
		if err != nil {
			return err
		}
		if len(strings.Split(filepath.ToSlash(relative), "/")) > 128 {
			return errors.New("目录层级过深")
		}
		remote := plan.remote
		if relative != "." {
			remote = path.Join(plan.remote, filepath.ToSlash(relative))
		}
		existing, err := lookup(remote)
		if err != nil {
			return err
		}
		item := treeEntry{local: local, remote: remote, directory: info.IsDir(), size: info.Size(), modified: info.ModTime().UnixMilli(), mode: info.Mode()}
		if existing != nil {
			if existing.Mode()&os.ModeSymlink != 0 || existing.IsDir() != info.IsDir() {
				return fmt.Errorf("目标类型冲突或为符号链接：%s", remote)
			}
			item.existed = true
			item.originalSize = existing.Size()
			item.originalModified = existing.ModTime().UnixMilli()
			if relative == "." {
				plan.exists = true
			}
			if !info.IsDir() {
				plan.conflicts++
			}
		}
		if !info.IsDir() {
			plan.total += info.Size()
		}
		plan.entries = append(plan.entries, item)
		return nil
	})
	return plan, err
}
func (m *Manager) uploadPlans(id, directory string, paths []string) (*remoteSession, *sftp.Client, []treePlan, error) {
	s, c, err := m.sftp(id)
	if err != nil {
		return nil, nil, nil, err
	}
	directory, err = remotePath(s, directory)
	if err != nil {
		return nil, nil, nil, err
	}
	if len(paths) == 0 || len(paths) > 200 {
		return nil, nil, nil, errors.New("每次请选择 1–200 个文件或文件夹")
	}
	plans := []treePlan{}
	seen := map[string]bool{}
	for _, source := range paths {
		plan, err := m.planUpload(s, c, directory, source)
		if err != nil {
			return nil, nil, nil, err
		}
		if seen[plan.remote] {
			return nil, nil, nil, fmt.Errorf("同一批传输包含重名条目：%s", plan.name)
		}
		seen[plan.remote] = true
		plans = append(plans, plan)
	}
	return s, c, plans, nil
}
func (m *Manager) CheckUploads(id, directory string, paths []string) ([]LocalFile, error) {
	_, _, plans, err := m.uploadPlans(id, directory, paths)
	if err != nil {
		return nil, err
	}
	out := []LocalFile{}
	for _, p := range plans {
		out = append(out, LocalFile{Path: p.local, Name: p.name, Size: p.total, Exists: p.exists, Directory: p.directory, Conflicts: p.conflicts})
	}
	return out, nil
}
func (m *Manager) describeTree(j *transferJob, p treePlan) {
	j.mu.Lock()
	j.value.Directory = p.directory
	j.value.Entries = len(p.entries)
	j.mu.Unlock()
	m.emit("transfer:progress", j.snapshot())
}
func (m *Manager) entryProgress(j *transferJob, index int, current string) {
	j.mu.Lock()
	j.value.EntriesDone = index
	j.value.Current = current
	j.mu.Unlock()
}
func (m *Manager) Upload(id, directory string, paths []string, replace bool) ([]Transfer, error) {
	s, c, plans, err := m.uploadPlans(id, directory, paths)
	if err != nil {
		return nil, err
	}
	for _, p := range plans {
		if p.exists && !replace {
			return nil, fmt.Errorf("目标已存在：%s，请确认合并或覆盖", p.name)
		}
	}
	out := []Transfer{}
	for _, p := range plans {
		p := p
		j := m.newTransfer(s, p.name, "upload", p.local, p.remote, p.total)
		m.describeTree(j, p)
		out = append(out, j.snapshot())
		go m.runTransfer(j, func(ctx context.Context, progress func(int64)) error {
			var completed int64
			for index, item := range p.entries {
				if err := ctx.Err(); err != nil {
					return err
				}
				m.entryProgress(j, index, item.remote)
				if item.directory {
					info, err := c.Lstat(item.remote)
					if os.IsNotExist(err) {
						if err = c.Mkdir(item.remote); err != nil {
							return err
						}
					} else if err != nil {
						return err
					} else if !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
						return fmt.Errorf("目标目录类型冲突：%s", item.remote)
					}
				} else {
					if err := uploadEntry(ctx, c, item, replace, func(n int64) { progress(completed + n) }); err != nil {
						return err
					}
					completed += item.size
					progress(completed)
				}
				m.entryProgress(j, index+1, item.remote)
			}
			return nil
		})
	}
	return out, nil
}
func uploadEntry(ctx context.Context, c *sftp.Client, item treeEntry, replace bool, progress func(int64)) error {
	input, err := os.Open(item.local)
	if err != nil {
		return err
	}
	defer input.Close()
	info, err := input.Stat()
	if err != nil {
		return err
	}
	if info.Size() != item.size || info.ModTime().UnixMilli() != item.modified {
		return fmt.Errorf("上传源文件已变化：%s", item.local)
	}
	tmp := path.Join(path.Dir(item.remote), ".aster-upload-"+newID())
	output, err := c.OpenFile(tmp, os.O_CREATE|os.O_EXCL|os.O_WRONLY)
	if err != nil {
		return err
	}
	defer c.Remove(tmp)
	defer output.Close()
	stop := interruptOnCancel(ctx, input, output)
	defer stop()
	if err = copyTransfer(ctx, output, input, progress); err != nil {
		return err
	}
	if err = output.Close(); err != nil {
		return err
	}
	if err = ctx.Err(); err != nil {
		return err
	}
	mode := item.mode.Perm()
	if runtime.GOOS == "windows" {
		mode = 0644
	}
	if item.existed {
		if !replace {
			return errors.New("覆盖尚未确认")
		}
		if err = checkVersion(c, item.remote, item.originalModified, item.originalSize); err != nil {
			return err
		}
		old, err := c.Lstat(item.remote)
		if err != nil {
			return err
		}
		if !old.Mode().IsRegular() {
			return errors.New("不能覆盖符号链接或特殊文件")
		}
		mode = old.Mode().Perm()
	}
	if err = c.Chmod(tmp, mode); err != nil {
		return err
	}
	return commitRemote(c, tmp, item.remote, item.existed && replace)
}
func (m *Manager) planDownload(s *remoteSession, c *sftp.Client, directory, remote string) (treePlan, error) {
	var p treePlan
	remote, err := remotePath(s, remote)
	if err != nil {
		return p, err
	}
	name := path.Base(remote)
	if err = localName(name); err != nil {
		return p, err
	}
	p = treePlan{name: name, remote: remote, local: filepath.Join(directory, name), entries: []treeEntry{}}
	seen := map[string]bool{}
	var walk func(string, string, int) error
	walk = func(source, local string, depth int) error {
		if err := s.ctx.Err(); err != nil {
			return err
		}
		if depth > 128 {
			return errors.New("目录层级过深")
		}
		if err := checkEntryLimit(len(p.entries)); err != nil {
			return err
		}
		info, err := c.Lstat(source)
		if err != nil {
			return err
		}
		if info.Mode()&os.ModeSymlink != 0 || (!info.IsDir() && !info.Mode().IsRegular()) {
			return fmt.Errorf("暂不跟随符号链接或特殊文件：%s", source)
		}
		if depth == 0 {
			p.directory = info.IsDir()
		}
		key := filepath.Clean(local)
		if runtime.GOOS == "windows" {
			key = strings.ToLower(key)
		}
		if seen[key] {
			return fmt.Errorf("文件名在本地系统发生冲突：%s", local)
		}
		seen[key] = true
		item := treeEntry{local: local, remote: source, directory: info.IsDir(), size: info.Size(), modified: info.ModTime().UnixMilli(), mode: info.Mode()}
		existing, err := os.Lstat(local)
		if err == nil {
			if existing.Mode()&os.ModeSymlink != 0 || existing.IsDir() != info.IsDir() {
				return fmt.Errorf("本地目标类型冲突或为符号链接：%s", local)
			}
			item.existed = true
			item.originalModified = existing.ModTime().UnixMilli()
			item.originalSize = existing.Size()
			if depth == 0 {
				p.exists = true
			}
			if !info.IsDir() {
				p.conflicts++
			}
		} else if !os.IsNotExist(err) {
			return err
		}
		p.entries = append(p.entries, item)
		if !info.IsDir() {
			p.total += info.Size()
			return nil
		}
		entries, err := c.ReadDir(source)
		if err != nil {
			return err
		}
		for _, entry := range entries {
			if err := localName(entry.Name()); err != nil {
				return err
			}
			if err := walk(path.Join(source, entry.Name()), filepath.Join(local, entry.Name()), depth+1); err != nil {
				return err
			}
		}
		return nil
	}
	err = walk(remote, p.local, 0)
	return p, err
}
func (m *Manager) downloadPlans(id, directory string, remotes []string) (*remoteSession, *sftp.Client, []treePlan, error) {
	directory, err := localDestination(directory)
	if err != nil {
		return nil, nil, nil, err
	}
	if len(remotes) == 0 || len(remotes) > 200 {
		return nil, nil, nil, errors.New("每次请选择 1–200 个远程条目")
	}
	s, c, err := m.sftp(id)
	if err != nil {
		return nil, nil, nil, err
	}
	plans := []treePlan{}
	seen := map[string]bool{}
	for _, remote := range remotes {
		p, err := m.planDownload(s, c, directory, remote)
		if err != nil {
			return nil, nil, nil, err
		}
		key := p.local
		if runtime.GOOS == "windows" {
			key = strings.ToLower(key)
		}
		if seen[key] {
			return nil, nil, nil, errors.New("同一批下载包含重名条目")
		}
		seen[key] = true
		plans = append(plans, p)
	}
	return s, c, plans, nil
}
func (m *Manager) CheckDownloads(id, directory string, remotes []string) ([]DownloadTarget, error) {
	_, _, plans, err := m.downloadPlans(id, directory, remotes)
	if err != nil {
		return nil, err
	}
	out := []DownloadTarget{}
	for _, p := range plans {
		out = append(out, DownloadTarget{p.remote, p.local, p.name, p.total, p.directory, p.exists, p.conflicts})
	}
	return out, nil
}
func (m *Manager) DownloadEntries(id, directory string, remotes []string, replace bool) ([]Transfer, error) {
	s, c, plans, err := m.downloadPlans(id, directory, remotes)
	if err != nil {
		return nil, err
	}
	for _, p := range plans {
		if p.exists && !replace {
			return nil, fmt.Errorf("本地目标已存在：%s，请确认合并或覆盖", p.name)
		}
	}
	out := []Transfer{}
	for _, p := range plans {
		p := p
		j := m.newTransfer(s, p.name, "download", p.local, p.remote, p.total)
		m.describeTree(j, p)
		out = append(out, j.snapshot())
		go m.runTransfer(j, func(ctx context.Context, progress func(int64)) error {
			var completed int64
			for index, item := range p.entries {
				if err := ctx.Err(); err != nil {
					return err
				}
				m.entryProgress(j, index, item.remote)
				if item.directory {
					info, err := os.Lstat(item.local)
					if os.IsNotExist(err) {
						if err = os.Mkdir(item.local, 0700); err != nil {
							return err
						}
					} else if err != nil {
						return err
					} else if !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
						return errors.New("本地目录类型已变化")
					}
				} else {
					if err := downloadEntry(ctx, c, item, replace, func(n int64) { progress(completed + n) }); err != nil {
						return err
					}
					completed += item.size
					progress(completed)
				}
				m.entryProgress(j, index+1, item.remote)
			}
			return nil
		})
	}
	return out, nil
}
func downloadEntry(ctx context.Context, c *sftp.Client, item treeEntry, replace bool, progress func(int64)) error {
	input, err := c.Open(item.remote)
	if err != nil {
		return err
	}
	defer input.Close()
	info, err := input.Stat()
	if err != nil {
		return err
	}
	if info.Size() != item.size || info.ModTime().UnixMilli() != item.modified {
		return errors.New("远程文件在下载开始前已变化，请重新传输")
	}
	tmp := filepath.Join(filepath.Dir(item.local), ".aster-download-"+newID()+".part")
	output, err := os.OpenFile(tmp, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	defer os.Remove(tmp)
	defer output.Close()
	stop := interruptOnCancel(ctx, input, output)
	defer stop()
	if err = copyTransfer(ctx, output, input, progress); err != nil {
		return err
	}
	if err = output.Sync(); err != nil {
		return err
	}
	if err = output.Close(); err != nil {
		return err
	}
	if err = ctx.Err(); err != nil {
		return err
	}
	existing, err := os.Lstat(item.local)
	if item.existed {
		if !replace {
			return errors.New("覆盖尚未确认")
		}
		if err != nil {
			return err
		}
		if !existing.Mode().IsRegular() || existing.Size() != item.originalSize || existing.ModTime().UnixMilli() != item.originalModified {
			return errors.New("本地文件在传输期间已变化，未覆盖")
		}
	} else if err == nil {
		return errors.New("本地出现同名文件，未覆盖")
	} else if !os.IsNotExist(err) {
		return err
	}
	return os.Rename(tmp, item.local)
}
