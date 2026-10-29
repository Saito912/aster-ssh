package core

import (
	"context"
	"encoding/base64"
	"errors"
	"io"
	"os"
	"sync"
	"time"
)

// The bounded queue and acknowledged window propagate terminal backpressure
// to SSH instead of accumulating an unbounded WebView event backlog.
type outputStream struct {
	ctx     context.Context
	id      string
	emit    EventSink
	queue   chan []byte
	drained chan struct{}
	finish  sync.Once
	mu      sync.Mutex
	cond    *sync.Cond
	pending int
	closed  bool
	logFile *os.File
}

func newOutputStream(ctx context.Context, id string, emit EventSink) *outputStream {
	s := &outputStream{ctx: ctx, id: id, emit: emit, queue: make(chan []byte, 16), drained: make(chan struct{})}
	s.cond = sync.NewCond(&s.mu)
	go s.pump()
	return s
}
func (s *outputStream) Write(p []byte) (int, error) {
	written := 0
	for len(p) > 0 {
		n := len(p)
		if n > 16384 {
			n = 16384
		}
		chunk := append([]byte(nil), p[:n]...)
		select {
		case s.queue <- chunk:
			written += n
			p = p[n:]
		case <-s.ctx.Done():
			return written, io.ErrClosedPipe
		}
	}
	return written, nil
}
func (s *outputStream) pump() {
	defer close(s.drained)
	ticker := time.NewTicker(8 * time.Millisecond)
	defer ticker.Stop()
	buffer := make([]byte, 0, 32768)
	flush := func() bool {
		if len(buffer) == 0 {
			return true
		}
		s.mu.Lock()
		for s.pending+len(buffer) > 262144 && !s.closed {
			s.cond.Wait()
		}
		if s.closed {
			s.mu.Unlock()
			return false
		}
		s.pending += len(buffer)
		if s.logFile != nil {
			if _, err := s.logFile.Write(buffer); err != nil {
				s.logFile.Close()
				s.logFile = nil
				s.emit("notice", map[string]string{"message": "会话日志写入失败，已停止记录"})
			}
		}
		s.mu.Unlock()
		s.emit("terminal:data", OutputEvent{s.id, base64.StdEncoding.EncodeToString(buffer), len(buffer)})
		buffer = buffer[:0]
		return true
	}
	for {
		select {
		case p, ok := <-s.queue:
			if !ok {
				flush()
				return
			}
			buffer = append(buffer, p...)
			if len(buffer) >= 32768 && !flush() {
				return
			}
		case <-ticker.C:
			if !flush() {
				return
			}
		case <-s.ctx.Done():
			return
		}
	}
}
func (s *outputStream) Ack(n int) {
	s.mu.Lock()
	if n > 0 && n <= s.pending {
		s.pending -= n
		s.cond.Broadcast()
	}
	s.mu.Unlock()
}
func (s *outputStream) Finish() { s.finish.Do(func() { close(s.queue) }) }
func (s *outputStream) Close() {
	s.mu.Lock()
	s.closed = true
	s.cond.Broadcast()
	if s.logFile != nil {
		s.logFile.Close()
		s.logFile = nil
	}
	s.mu.Unlock()
}
func (s *outputStream) SetLog(path string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.logFile != nil {
		s.logFile.Close()
		s.logFile = nil
	}
	if path == "" {
		return nil
	}
	if s.closed {
		return errors.New("会话已断开")
	}
	f, err := os.OpenFile(path, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	s.logFile = f
	return nil
}
