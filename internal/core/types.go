package core

import "time"

type Host struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Address   string `json:"address"`
	Port      int    `json:"port"`
	User      string `json:"user"`
	Group     string `json:"group"`
	Auth      string `json:"auth"`
	KeyPath   string `json:"keyPath"`
	Favorite  bool   `json:"favorite"`
	HasSecret bool   `json:"hasSecret"`
}
type Credentials struct {
	Password   string `json:"password"`
	Passphrase string `json:"passphrase"`
}
type HostInput struct {
	Host        Host        `json:"host"`
	Credentials Credentials `json:"credentials"`
	Remember    bool        `json:"remember"`
	KeepSecret  bool        `json:"keepSecret"`
}
type Preferences struct {
	Theme             string `json:"theme"`
	FontSize          int    `json:"fontSize"`
	Scrollback        int    `json:"scrollback"`
	Monitor           bool   `json:"monitor"`
	CopyOnSelect      bool   `json:"copyOnSelect"`
	DownloadDirectory string `json:"downloadDirectory"`
	SidebarCollapsed  bool   `json:"sidebarCollapsed"`
	AppearanceVersion int    `json:"appearanceVersion"`
}
type Snippet struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Command string `json:"command"`
}
type Config struct {
	Hosts         []Host      `json:"hosts"`
	Preferences   Preferences `json:"preferences"`
	Snippets      []Snippet   `json:"snippets"`
	Version       string      `json:"version"`
	DataDirectory string      `json:"dataDirectory"`
}
type ConnectRequest struct {
	HostID              string      `json:"hostId"`
	Credentials         Credentials `json:"credentials"`
	ApprovedFingerprint string      `json:"approvedFingerprint"`
}
type HostKeyChallenge struct {
	Address          string `json:"address"`
	KeyType          string `json:"keyType"`
	Fingerprint      string `json:"fingerprint"`
	KnownFingerprint string `json:"knownFingerprint"`
	Changed          bool   `json:"changed"`
}

func (c *HostKeyChallenge) Error() string {
	if c.Changed {
		return "服务器指纹发生变化，连接已拒绝"
	}
	return "首次连接，请确认服务器指纹"
}

type ConnectResult struct {
	ID        string            `json:"id"`
	Host      Host              `json:"host"`
	LatencyMS int64             `json:"latencyMs"`
	Challenge *HostKeyChallenge `json:"challenge,omitempty"`
}
type SessionEvent struct {
	ID      string `json:"id"`
	Status  string `json:"status"`
	Message string `json:"message"`
}
type OutputEvent struct {
	ID    string `json:"id"`
	Data  string `json:"data"`
	Bytes int    `json:"bytes"`
}
type RemoteFile struct {
	Name     string `json:"name"`
	Size     int64  `json:"size"`
	Modified int64  `json:"modified"`
	Mode     string `json:"mode"`
	Type     string `json:"type"`
}
type Directory struct {
	Path  string       `json:"path"`
	Home  string       `json:"home"`
	Files []RemoteFile `json:"files"`
}
type TextFile struct {
	Path     string `json:"path"`
	Content  string `json:"content"`
	Modified int64  `json:"modified"`
	Size     int64  `json:"size"`
}
type LocalFile struct {
	Path      string `json:"path"`
	Name      string `json:"name"`
	Size      int64  `json:"size"`
	Exists    bool   `json:"exists"`
	Directory bool   `json:"directory"`
	Conflicts int    `json:"conflicts"`
}
type Transfer struct {
	ID          string `json:"id"`
	SessionID   string `json:"sessionId"`
	HostName    string `json:"hostName"`
	Name        string `json:"name"`
	Direction   string `json:"direction"`
	LocalPath   string `json:"localPath"`
	RemotePath  string `json:"remotePath"`
	Total       int64  `json:"total"`
	Done        int64  `json:"done"`
	Status      string `json:"status"`
	Error       string `json:"error"`
	Started     int64  `json:"started"`
	Directory   bool   `json:"directory"`
	Entries     int    `json:"entries"`
	EntriesDone int    `json:"entriesDone"`
	Current     string `json:"current"`
}

type DownloadTarget struct {
	RemotePath string `json:"remotePath"`
	LocalPath  string `json:"localPath"`
	Name       string `json:"name"`
	Size       int64  `json:"size"`
	Directory  bool   `json:"directory"`
	Exists     bool   `json:"exists"`
	Conflicts  int    `json:"conflicts"`
}
type Tunnel struct {
	ID           string `json:"id"`
	SessionID    string `json:"sessionId"`
	LocalAddress string `json:"localAddress"`
	Destination  string `json:"destination"`
}
type Stats struct {
	OS                     string       `json:"os"`
	Cores                  int          `json:"cores"`
	CPU                    float64      `json:"cpu"`
	MemoryPercent          float64      `json:"memoryPercent"`
	MemoryTotal            uint64       `json:"memoryTotal"`
	MemoryUsed             uint64       `json:"memoryUsed"`
	DiskTotal              uint64       `json:"diskTotal"`
	DiskUsed               uint64       `json:"diskUsed"`
	DiskPercent            float64      `json:"diskPercent"`
	Disks                  []DiskUsage  `json:"disks"`
	DiskDevices            []DiskDevice `json:"diskDevices"`
	DiskInventoryAvailable bool         `json:"diskInventoryAvailable"`
	ReceiveRate            float64      `json:"receiveRate"`
	SendRate               float64      `json:"sendRate"`
	Uptime                 float64      `json:"uptime"`
	SampleMS               int64        `json:"sampleMs"`
}

type DiskUsage struct {
	Device     string  `json:"device"`
	Mountpoint string  `json:"mountpoint"`
	Filesystem string  `json:"filesystem"`
	Total      uint64  `json:"total"`
	Used       uint64  `json:"used"`
	Available  uint64  `json:"available"`
	Percent    float64 `json:"percent"`
	UsageKnown bool    `json:"usageKnown"`
}

type DiskDevice struct {
	Device     string `json:"device"`
	Parent     string `json:"parent"`
	Kind       string `json:"kind"`
	Filesystem string `json:"filesystem"`
	Size       uint64 `json:"size"`
	State      string `json:"state"`
}
type EventSink func(string, any)
type counterSample struct {
	at                  time.Time
	total, idle, rx, tx uint64
}
