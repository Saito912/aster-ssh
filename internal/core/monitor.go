package core

import (
	"bytes"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"
)

const statsCommand = `LC_ALL=C; export LC_ALL
printf '\n__ASTER_OS__\n'; cat /etc/os-release 2>/dev/null
printf '\n__ASTER_CPU__\n'; head -n 1 /proc/stat 2>/dev/null
printf '\n__ASTER_MEM__\n'; cat /proc/meminfo 2>/dev/null
printf '\n__ASTER_DISK__\n'
if command -v timeout >/dev/null 2>&1; then timeout 2s df -Pk 2>/dev/null; else df -lPk 2>/dev/null || df -Pk 2>/dev/null; fi
printf '\n__ASTER_BLOCKS__\n'
if command -v timeout >/dev/null 2>&1; then
 timeout 1s lsblk -bJ -o NAME,KNAME,PATH,TYPE,SIZE,FSTYPE,MOUNTPOINT 2>/dev/null || timeout 1s lsblk -bJ -o NAME,TYPE,SIZE,FSTYPE,MOUNTPOINT 2>/dev/null
else
 lsblk -bJ -o NAME,KNAME,PATH,TYPE,SIZE,FSTYPE,MOUNTPOINT 2>/dev/null || lsblk -bJ -o NAME,TYPE,SIZE,FSTYPE,MOUNTPOINT 2>/dev/null
fi
printf '\n__ASTER_NET__\n'; cat /proc/net/dev 2>/dev/null
printf '\n__ASTER_UP__\n'; cat /proc/uptime 2>/dev/null
printf '\n__ASTER_CORES__\n'; getconf _NPROCESSORS_ONLN 2>/dev/null
`

type boundedBuffer struct {
	bytes.Buffer
	limit int
}

func (b *boundedBuffer) Write(p []byte) (int, error) {
	if b.Len()+len(p) > b.limit {
		return 0, errors.New("服务器输出超过限制")
	}
	return b.Buffer.Write(p)
}
func (m *Manager) Stats(id string) (Stats, error) {
	s, err := m.get(id)
	if err != nil {
		return Stats{}, err
	}
	if !s.statsMu.TryLock() {
		return Stats{}, errors.New("监控采样仍在进行")
	}
	defer s.statsMu.Unlock()
	shell, err := s.client.NewSession()
	if err != nil {
		return Stats{}, err
	}
	defer shell.Close()
	out := &boundedBuffer{limit: 128 << 10}
	stderr := &boundedBuffer{limit: 16 << 10}
	shell.Stdout = out
	shell.Stderr = stderr
	started := time.Now()
	result := make(chan error, 1)
	go func() { result <- shell.Run(statsCommand) }()
	select {
	case err = <-result:
		if err != nil {
			return Stats{}, fmt.Errorf("监控采样失败：%w", err)
		}
	case <-time.After(6 * time.Second):
		return Stats{}, errors.New("服务器监控采样超时")
	case <-s.ctx.Done():
		return Stats{}, errors.New("会话已断开")
	}
	stats, next, err := parseStats(out.String(), s.sample, time.Now())
	if err != nil {
		return Stats{}, err
	}
	s.sample = next
	stats.SampleMS = time.Since(started).Milliseconds()
	return stats, nil
}
func parseStats(output string, previous counterSample, now time.Time) (Stats, counterSample, error) {
	sections := map[string]string{}
	current := ""
	for _, line := range strings.Split(output, "\n") {
		if strings.HasPrefix(line, "__ASTER_") && strings.HasSuffix(line, "__") {
			current = line
			continue
		}
		sections[current] += line + "\n"
	}
	var stats Stats
	sample := counterSample{at: now}
	cpu := strings.Fields(sections["__ASTER_CPU__"])
	if len(cpu) < 5 || cpu[0] != "cpu" {
		return stats, sample, errors.New("实时监控支持提供 /proc 的 Linux 服务器；当前系统暂不支持")
	}
	for i, field := range cpu[1:] {
		n, _ := strconv.ParseUint(field, 10, 64)
		if i < 8 {
			sample.total += n
		}
		if i == 3 || i == 4 {
			sample.idle += n
		}
	}
	if sample.total > previous.total && !previous.at.IsZero() {
		total := sample.total - previous.total
		idle := sample.idle - previous.idle
		if idle <= total {
			stats.CPU = 100 * float64(total-idle) / float64(total)
		}
	}
	for _, line := range strings.Split(sections["__ASTER_OS__"], "\n") {
		if strings.HasPrefix(line, "PRETTY_NAME=") {
			value := strings.TrimPrefix(line, "PRETTY_NAME=")
			if decoded, err := strconv.Unquote(value); err == nil {
				stats.OS = decoded
			} else {
				stats.OS = strings.Trim(value, "'\"")
			}
		}
	}
	if stats.OS == "" {
		stats.OS = "Linux"
	}
	mem := map[string]uint64{}
	for _, line := range strings.Split(sections["__ASTER_MEM__"], "\n") {
		fields := strings.Fields(line)
		if len(fields) >= 2 {
			n, _ := strconv.ParseUint(fields[1], 10, 64)
			mem[strings.TrimSuffix(fields[0], ":")] = n * 1024
		}
	}
	stats.MemoryTotal = mem["MemTotal"]
	available, ok := mem["MemAvailable"]
	if !ok {
		available = mem["MemFree"] + mem["Buffers"] + mem["Cached"]
	}
	if stats.MemoryTotal >= available {
		stats.MemoryUsed = stats.MemoryTotal - available
	}
	if stats.MemoryTotal > 0 {
		stats.MemoryPercent = 100 * float64(stats.MemoryUsed) / float64(stats.MemoryTotal)
	}
	stats.Disks, stats.DiskDevices, stats.DiskInventoryAvailable = parseStorage(sections["__ASTER_DISK__"], sections["__ASTER_BLOCKS__"])
	for _, disk := range stats.Disks {
		if disk.Mountpoint == "/" {
			stats.DiskTotal = disk.Total
			stats.DiskUsed = disk.Used
			stats.DiskPercent = disk.Percent
			break
		}
	}
	for _, line := range strings.Split(sections["__ASTER_NET__"], "\n") {
		parts := strings.SplitN(line, ":", 2)
		if len(parts) != 2 || strings.TrimSpace(parts[0]) == "lo" {
			continue
		}
		fields := strings.Fields(parts[1])
		if len(fields) >= 16 {
			rx, _ := strconv.ParseUint(fields[0], 10, 64)
			tx, _ := strconv.ParseUint(fields[8], 10, 64)
			sample.rx += rx
			sample.tx += tx
		}
	}
	elapsed := now.Sub(previous.at).Seconds()
	if !previous.at.IsZero() && elapsed > 0 {
		if sample.rx >= previous.rx {
			stats.ReceiveRate = float64(sample.rx-previous.rx) / elapsed
		}
		if sample.tx >= previous.tx {
			stats.SendRate = float64(sample.tx-previous.tx) / elapsed
		}
	}
	up := strings.Fields(sections["__ASTER_UP__"])
	if len(up) > 0 {
		stats.Uptime, _ = strconv.ParseFloat(up[0], 64)
	}
	stats.Cores, _ = strconv.Atoi(strings.TrimSpace(sections["__ASTER_CORES__"]))
	return stats, sample, nil
}
