package core

import (
	"bytes"
	"encoding/json"
	"math"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

// POSIX df is explicitly requested so each filesystem occupies one line.
// Capture the numeric columns, allowing spaces in both device and mount names.
var dfColumns = regexp.MustCompile(`^(.+?)\s+(\d+)\s+(\d+)\s+(-?\d+)\s+(\d+(?:\.\d+)?%)\s+(.+)$`)
var mountEscapes = strings.NewReplacer(`\040`, " ", `\011`, "\t", `\012`, "\n", `\134`, `\`)

type diskBytes uint64

func (n *diskBytes) UnmarshalJSON(raw []byte) error {
	if bytes.Equal(raw, []byte("null")) {
		*n = 0
		return nil
	}
	text := strings.Trim(string(raw), `"`)
	value, err := strconv.ParseUint(text, 10, 64)
	if err != nil {
		return err
	}
	*n = diskBytes(value)
	return nil
}

type blockNode struct {
	Name       string      `json:"name"`
	KernelName string      `json:"kname"`
	Path       string      `json:"path"`
	Kind       string      `json:"type"`
	Size       diskBytes   `json:"size"`
	Filesystem string      `json:"fstype"`
	Mountpoint string      `json:"mountpoint"`
	Children   []blockNode `json:"children"`
}

func blockPath(node blockNode) string {
	if node.Path != "" {
		return node.Path
	}
	if strings.HasPrefix(node.Name, "/") {
		return node.Name
	}
	return "/dev/" + node.Name
}
func blockAliases(node blockNode) []string {
	out := []string{blockPath(node)}
	if node.KernelName != "" {
		out = append(out, "/dev/"+node.KernelName)
	}
	if node.Name != "" {
		out = append(out, "/dev/"+node.Name)
	}
	return out
}
func ignoredDevice(device string) bool {
	switch device {
	case "tmpfs", "devtmpfs", "udev", "none", "shm":
		return true
	}
	return strings.HasPrefix(device, "/dev/loop") || strings.HasPrefix(device, "/dev/ram") || strings.HasPrefix(device, "/dev/zram")
}
func hiddenBlock(node blockNode) bool {
	return node.Kind == "loop" || node.Kind == "rom" || ignoredDevice(blockPath(node))
}

func parseStorage(dfText, blockText string) ([]DiskUsage, []DiskDevice, bool) {
	disks := []DiskUsage{}
	devices := []DiskDevice{}
	seenMounts := map[string]bool{}
	for _, line := range strings.Split(dfText, "\n") {
		match := dfColumns.FindStringSubmatch(strings.TrimSpace(line))
		if match == nil {
			continue
		}
		device := mountEscapes.Replace(strings.TrimSpace(match[1]))
		mount := mountEscapes.Replace(strings.TrimSpace(match[6]))
		if ignoredDevice(device) || !strings.HasPrefix(mount, "/") {
			continue
		}
		total, errTotal := strconv.ParseUint(match[2], 10, 64)
		used, errUsed := strconv.ParseUint(match[3], 10, 64)
		available, errAvailable := strconv.ParseInt(match[4], 10, 64)
		percent, errPercent := strconv.ParseFloat(strings.TrimSuffix(match[5], "%"), 64)
		if errTotal != nil || errUsed != nil || errAvailable != nil || errPercent != nil || total == 0 || total > math.MaxUint64/1024 || used > math.MaxUint64/1024 {
			continue
		}
		if available < 0 {
			available = 0
		}
		if uint64(available) > math.MaxUint64/1024 {
			continue
		}
		key := device + "\x00" + mount
		if seenMounts[key] {
			continue
		}
		seenMounts[key] = true
		disks = append(disks, DiskUsage{Device: device, Mountpoint: mount, Total: total * 1024, Used: used * 1024, Available: uint64(available) * 1024, Percent: percent, UsageKnown: true})
	}
	var inventory struct {
		Devices []blockNode `json:"blockdevices"`
	}
	inventoryAvailable := strings.TrimSpace(blockText) != "" && json.Unmarshal([]byte(blockText), &inventory) == nil && inventory.Devices != nil
	if inventoryAvailable {
		mountedAliases := map[string]bool{}
		byAlias := map[string]blockNode{}
		byMount := map[string]blockNode{}
		for _, disk := range disks {
			mountedAliases[disk.Device] = true
		}
		var index func(blockNode)
		index = func(node blockNode) {
			if hiddenBlock(node) {
				return
			}
			for _, alias := range blockAliases(node) {
				byAlias[alias] = node
			}
			if strings.HasPrefix(node.Mountpoint, "/") {
				byMount[node.Mountpoint] = node
			}
			for _, child := range node.Children {
				index(child)
			}
		}
		for _, node := range inventory.Devices {
			index(node)
		}
		for i, disk := range disks {
			node, ok := byAlias[disk.Device]
			if !ok {
				node, ok = byMount[disk.Mountpoint]
			}
			if ok {
				disks[i].Filesystem = node.Filesystem
				for _, alias := range blockAliases(node) {
					mountedAliases[alias] = true
				}
			}
		}
		var inUse func(blockNode) bool
		inUse = func(node blockNode) bool {
			if node.Mountpoint != "" {
				return true
			}
			for _, alias := range blockAliases(node) {
				if mountedAliases[alias] {
					return true
				}
			}
			for _, child := range node.Children {
				if inUse(child) {
					return true
				}
			}
			return false
		}
		seenDevices := map[string]bool{}
		var visit func(blockNode, string)
		visit = func(node blockNode, parent string) {
			if hiddenBlock(node) {
				return
			}
			device := blockPath(node)
			used := inUse(node)
			state := "unmounted"
			if node.Filesystem == "swap" || node.Mountpoint == "[SWAP]" {
				state = "swap"
			} else if used {
				state = "mounted"
			} else if node.Filesystem == "LVM2_member" || node.Filesystem == "linux_raid_member" || node.Filesystem == "zfs_member" || node.Filesystem == "bcache" {
				state = "member"
			} else if node.Filesystem == "crypto_LUKS" {
				state = "encrypted"
			} else if len(node.Children) > 0 {
				state = "partitioned"
			}
			// Physical disks remain visible even when their space is provided via
			// partitions, LVM or RAID. Only unused leaves are added as extra rows.
			if (node.Kind == "disk" || node.Kind == "mpath" || len(node.Children) == 0 && !used) && uint64(node.Size) > 0 && !seenDevices[device] {
				devices = append(devices, DiskDevice{Device: device, Parent: parent, Kind: node.Kind, Filesystem: node.Filesystem, Size: uint64(node.Size), State: state})
				seenDevices[device] = true
			}
			if strings.HasPrefix(node.Mountpoint, "/") && !mountedAliases[device] {
				key := device + "\x00" + node.Mountpoint
				if !seenMounts[key] {
					disks = append(disks, DiskUsage{Device: device, Mountpoint: node.Mountpoint, Filesystem: node.Filesystem, UsageKnown: false})
					seenMounts[key] = true
				}
			}
			nextParent := parent
			if node.Kind == "disk" || node.Kind == "mpath" {
				nextParent = device
			}
			for _, child := range node.Children {
				visit(child, nextParent)
			}
		}
		for _, node := range inventory.Devices {
			visit(node, "")
		}
	}
	sort.SliceStable(disks, func(i, j int) bool {
		if disks[i].Mountpoint == "/" {
			return disks[j].Mountpoint != "/"
		}
		if disks[j].Mountpoint == "/" {
			return false
		}
		return disks[i].Mountpoint < disks[j].Mountpoint
	})
	return disks, devices, inventoryAvailable
}
