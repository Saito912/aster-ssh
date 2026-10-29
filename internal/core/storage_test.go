package core

import (
	"asterssh/internal/testserver"
	"strings"
	"testing"
	"time"
)

const multiDiskDF = `Filesystem 1024-blocks Used Available Capacity Mounted on
/dev/mapper/ubuntu--vg-root 205835264 162642944 32700416 84% /
/dev/nvme1n1 1953500000 400000000 1553500000 21% /data
/dev/sdb1 976750000 100000000 876750000 11% /media/data disk
server:/shared 4000000000 1000000000 3000000000 25% /mnt/shared
tmpfs 1000000 2000 998000 1% /run
/dev/loop0 10240 10240 0 100% /snap/core
`
const multiDiskBlocks = `{"blockdevices":[
 {"name":"nvme0n1","kname":"nvme0n1","path":"/dev/nvme0n1","type":"disk","size":256000000000,"children":[{"name":"nvme0n1p3","type":"part","size":255000000000,"children":[{"name":"ubuntu--vg-root","kname":"dm-0","path":"/dev/mapper/ubuntu--vg-root","type":"lvm","size":210775310336,"fstype":"ext4","mountpoint":"/"}]}]},
 {"name":"nvme1n1","path":"/dev/nvme1n1","type":"disk","size":"2000000000000","fstype":"xfs","mountpoint":"/data"},
 {"name":"sdb","type":"disk","size":1000204886016,"children":[{"name":"sdb1","type":"part","size":1000200000000,"fstype":"ext4","mountpoint":"/media/data disk"}]},
 {"name":"sdc","type":"disk","size":"4000000000000","fstype":null,"mountpoint":null},
 {"name":"sdd","type":"disk","size":2000000000000,"children":[{"name":"sdd1","type":"part","size":1000000000000,"fstype":"ext4","mountpoint":null}]},
 {"name":"loop0","type":"loop","size":10485760,"mountpoint":"/snap/core"}
]}`

func TestStorageAllMountsAndUnmountedDrives(t *testing.T) {
	disks, devices, available := parseStorage(multiDiskDF, multiDiskBlocks)
	if !available || len(disks) != 4 {
		t.Fatalf("expected all four persistent mounts: %+v available=%v", disks, available)
	}
	if disks[0].Mountpoint != "/" || disks[0].Percent != 84 || disks[0].Filesystem != "ext4" {
		t.Fatalf("root fields: %+v", disks[0])
	}
	mounted := map[string]DiskUsage{}
	for _, disk := range disks {
		mounted[disk.Mountpoint] = disk
	}
	if mounted["/data"].Total != 1953500000*1024 || mounted["/media/data disk"].Device != "/dev/sdb1" {
		t.Fatal("data disks or mount containing spaces missing")
	}
	physical, unused := 0, map[string]string{}
	for _, device := range devices {
		if device.Kind == "disk" {
			physical++
		}
		unused[device.Device] = device.State
	}
	if physical != 5 || unused["/dev/sdc"] != "unmounted" || unused["/dev/sdd1"] != "unmounted" || unused["/dev/nvme0n1"] != "mounted" {
		t.Fatalf("inventory: %+v", devices)
	}
	if _, ok := unused["/dev/loop0"]; ok {
		t.Fatal("loop device was included")
	}
}
func TestStorageFallbackAndUnavailableUsage(t *testing.T) {
	disks, devices, available := parseStorage(multiDiskDF, "lsblk: not found")
	if available || len(devices) != 0 || len(disks) != 4 {
		t.Fatalf("df fallback lost filesystems: %+v", disks)
	}
	disks, _, available = parseStorage("", multiDiskBlocks)
	if !available || len(disks) != 3 {
		t.Fatalf("inventory-only mounts: %+v", disks)
	}
	for _, disk := range disks {
		if disk.UsageKnown {
			t.Fatal("missing usage was presented as zero percent")
		}
	}
	disks, _, _ = parseStorage("/dev/a 10 4 6 40% /media/a\\040b\n/dev/a 10 4 6 40% /media/a\\040b\n/dev/b invalid 4 6 40% /bad\n", "")
	if len(disks) != 1 || disks[0].Mountpoint != "/media/a b" {
		t.Fatalf("escape/dedup: %+v", disks)
	}
}
func TestMonitorCarriesAllDiskData(t *testing.T) {
	sample := strings.Replace(testserver.StatsFixture, "/dev/test 104857600 41943040 62914560 40% /", strings.TrimSpace(multiDiskDF)+"\n__ASTER_BLOCKS__\n"+multiDiskBlocks, 1)
	stats, _, err := parseStats(sample, counterSample{}, time.Now())
	if err != nil || len(stats.Disks) != 4 || len(stats.DiskDevices) != 6 {
		t.Fatalf("monitor storage fields: %+v err=%v", stats, err)
	}
	if strings.Contains(statsCommand, "df -Pk /") {
		t.Fatal("monitor still restricts df to the root filesystem")
	}
}

func TestStorageMembersAreNotCalledUnusedDrives(t *testing.T) {
	_, devices, available := parseStorage("", `{"blockdevices":[{"name":"sda","type":"disk","size":1000000000000,"fstype":"zfs_member"},{"name":"sdb","type":"disk","size":1000000000000,"fstype":"LVM2_member"},{"name":"sdc","type":"disk","size":1000000000000,"fstype":"crypto_LUKS"}]}`)
	if !available || len(devices) != 3 || devices[0].State != "member" || devices[1].State != "member" || devices[2].State != "encrypted" {
		t.Fatalf("storage member states: %+v", devices)
	}
}
