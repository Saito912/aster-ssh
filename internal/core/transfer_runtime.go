package core

import (
	"context"
	"errors"
	"io"
	"os"
	"path"
	"path/filepath"
	"sort"
	"sync"
	"time"
)

func (m *Manager) newTransfer(s *remoteSession, name, direction, local, remote string, total int64) *transferJob {
	ctx, cancel := context.WithCancel(s.ctx)
	j := &transferJob{ctx: ctx, cancel: cancel, value: Transfer{ID: newID(), SessionID: s.id, HostName: s.host.Name, Name: name, Direction: direction, LocalPath: local, RemotePath: remote, Total: total, Status: "queued", Started: time.Now().UnixMilli()}}
	m.mu.Lock()
	m.jobs[j.value.ID] = j
	for id, old := range m.jobs {
		old.mu.Lock()
		remove := len(m.jobs) > 300 && old.value.Status != "running" && old.value.Status != "queued"
		old.mu.Unlock()
		if remove {
			delete(m.jobs, id)
		}
	}
	m.mu.Unlock()
	m.emit("transfer:progress", j.snapshot())
	return j
}
func (j *transferJob) snapshot() Transfer { j.mu.Lock(); defer j.mu.Unlock(); return j.value }
func (m *Manager) updateTransfer(j *transferJob, status string, done int64, err error) {
	j.mu.Lock()
	j.value.Status = status
	j.value.Done = done
	if err != nil {
		j.value.Error = err.Error()
	}
	value := j.value
	j.mu.Unlock()
	m.emit("transfer:progress", value)
}
func (m *Manager) runTransfer(j *transferJob, work func(context.Context, func(int64)) error) {
	defer j.cancel()
	select {
	case m.transferSlots <- struct{}{}:
		defer func() { <-m.transferSlots }()
	case <-j.ctx.Done():
		m.updateTransfer(j, "cancelled", 0, nil)
		return
	}
	m.updateTransfer(j, "running", 0, nil)
	var done int64
	last := time.Now()
	err := work(j.ctx, func(n int64) {
		done = n
		if time.Since(last) > 100*time.Millisecond {
			m.updateTransfer(j, "running", n, nil)
			last = time.Now()
		}
	})
	if j.ctx.Err() != nil {
		m.updateTransfer(j, "cancelled", done, nil)
	} else if err != nil {
		m.updateTransfer(j, "failed", done, err)
	} else {
		m.updateTransfer(j, "completed", done, nil)
	}
}
func copyTransfer(ctx context.Context, dst io.Writer, src io.Reader, progress func(int64)) error {
	buffer := make([]byte, 128*1024)
	var done int64
	for {
		if err := ctx.Err(); err != nil {
			return err
		}
		n, readErr := src.Read(buffer)
		if n > 0 {
			written, err := dst.Write(buffer[:n])
			done += int64(written)
			progress(done)
			if err != nil {
				return err
			}
			if written != n {
				return io.ErrShortWrite
			}
		}
		if readErr == io.EOF {
			return nil
		}
		if readErr != nil {
			return readErr
		}
	}
}

// Closing only this transfer's file handles interrupts a blocked read/write
// without tearing down the terminal or other transfer channels.
func interruptOnCancel(ctx context.Context, closers ...io.Closer) func() {
	done := make(chan struct{})
	var once sync.Once
	go func() {
		select {
		case <-ctx.Done():
			for _, c := range closers {
				c.Close()
			}
		case <-done:
		}
	}()
	return func() { once.Do(func() { close(done) }) }
}
func (m *Manager) Download(id, remote, local string) (Transfer, error) {
	s, c, err := m.sftp(id)
	if err != nil {
		return Transfer{}, err
	}
	remote, err = remotePath(s, remote)
	if err != nil {
		return Transfer{}, err
	}
	info, err := c.Stat(remote)
	if err != nil {
		return Transfer{}, err
	}
	if !info.Mode().IsRegular() {
		return Transfer{}, errors.New("请选择普通文件下载")
	}
	if !filepath.IsAbs(local) {
		return Transfer{}, errors.New("下载位置必须为绝对路径")
	}
	j := m.newTransfer(s, path.Base(remote), "download", local, remote, info.Size())
	go m.runTransfer(j, func(ctx context.Context, progress func(int64)) error {
		input, err := c.Open(remote)
		if err != nil {
			return err
		}
		defer input.Close()
		tmp := local + ".aster-" + newID() + ".part"
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
		return os.Rename(tmp, local)
	})
	return j.snapshot(), nil
}
func (m *Manager) CancelTransfer(id string) error {
	m.mu.RLock()
	job := m.jobs[id]
	m.mu.RUnlock()
	if job == nil {
		return errors.New("传输任务不存在")
	}
	job.cancel()
	return nil
}
func (m *Manager) Transfers() []Transfer {
	m.mu.RLock()
	jobs := make([]*transferJob, 0, len(m.jobs))
	for _, j := range m.jobs {
		jobs = append(jobs, j)
	}
	m.mu.RUnlock()
	out := []Transfer{}
	for _, j := range jobs {
		out = append(out, j.snapshot())
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Started > out[j].Started })
	return out
}
