import { esc, bytes } from "./ui.js";

export function storageView(stats, inventoryOpen = false) {
  if (!stats)
    return {
      count: "—",
      html: '<p class="storage-empty">连接服务器后显示磁盘和挂载点</p>',
    };
  const disks = stats.disks || [];
  const devices = stats.diskDevices || [];
  const physical = devices.filter(
    (d) => d.kind === "disk" || d.kind === "mpath",
  );
  const unused = devices.filter((d) => d.state === "unmounted");
  let html =
    disks
      .map((disk) => {
        const percent = Math.max(0, Math.min(100, Number(disk.percent) || 0));
        const severity =
          percent >= 90 ? "critical" : percent >= 80 ? "high" : "";
        return `<div class="disk-volume"><div class="disk-volume-heading"><strong title="${esc(disk.mountpoint)}">${esc(disk.mountpoint)}</strong><span>${disk.usageKnown ? disk.percent.toFixed(0) + "%" : "占用未知"}</span></div><div class="disk-device-name" title="${esc(disk.device)}">${esc(disk.device)}${disk.filesystem ? " · " + esc(disk.filesystem) : ""}</div>${disk.usageKnown ? `<div class="disk-capacity"><strong>${bytes(disk.used)}</strong><span> / ${bytes(disk.total)}</span></div><div class="disk-bar ${severity}"><span style="width:${percent}%"></span></div><div class="disk-available">可用 ${bytes(disk.available)}</div>` : '<p class="disk-available">已挂载，容量占用暂不可用</p>'}</div>`;
      })
      .join("") || '<p class="storage-empty">未读取到已挂载的存储空间</p>';
  if (stats.diskInventoryAvailable) {
    const stateText = {
      mounted: "使用中",
      unmounted: "未挂载",
      partitioned: "已分区",
      swap: "交换分区",
      member: "存储池成员",
      encrypted: "加密容器",
    };
    html += `<details class="disk-inventory" data-storage-inventory ${inventoryOpen ? "open" : ""}><summary>物理磁盘 ${physical.length}${unused.length ? " · 未挂载设备 " + unused.length : ""}</summary><div>${devices.map((device) => `<div class="disk-inventory-row ${device.kind === "part" ? "partition" : ""}"><div><strong title="${esc(device.device)}">${esc(device.device)}</strong><span>${bytes(device.size)}</span></div><div><small>${esc(device.filesystem || (device.kind === "part" ? "分区" : "块设备"))}${device.parent ? " · " + esc(device.parent) : ""}</small><span class="device-state ${device.state === "unmounted" ? "unmounted" : ""}">${stateText[device.state] || "未知"}</span></div></div>`).join("") || '<p class="storage-empty">当前环境没有可见的物理磁盘</p>'}</div></details>`;
  } else {
    html +=
      '<p class="storage-note">当前仅显示挂载点，未挂载设备信息不可用</p>';
  }
  return { count: `${disks.length} 个挂载点`, html };
}
