const ICONS = {
  search:'<circle cx="10.8" cy="10.8" r="6.5"/><path d="m16 16 4.2 4.2"/>',
  sun:'<circle cx="12" cy="12" r="3.8"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon:'<path d="M20.5 13.2A8.8 8.8 0 0 1 10.8 3.5 8.8 8.8 0 1 0 20.5 13.2Z"/>',
  panels:'<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16m-6-11h6"/>',
  code:'<path d="m8 7-5 5 5 5m8-10 5 5-5 5M14 4l-4 16"/>',
  transfer:'<path d="M7 3v16m-4-4 4 4 4-4M17 21V5m-4 4 4-4 4 4"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.8 8.5a2.5 2.5 0 0 1 4.8.9c0 2-2.6 2-2.6 4M12 17h.01"/>',
  settings:'<path d="m9.4 3-.6 2.2-2.2 1.3-2.2-.6-2 3.4L4 10.9v2.3l-1.6 1.6 2 3.4 2.2-.6 2.2 1.3.6 2.1h4l.6-2.1 2.2-1.3 2.2.6 2-3.4-1.6-1.6v-2.3l1.6-1.6-2-3.4-2.2.6L14 5.2 13.4 3Z"/><circle cx="11.4" cy="12" r="3.2"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  star:'<path d="m12 3 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3-5.6-3-5.6 3 1.1-6.3L3 9.6l6.2-.9Z"/>',
  shield:'<path d="m12 3 8 3v5c0 5.1-3.6 8.4-8 10-4.4-1.6-8-4.9-8-10V6Z"/><path d="m8.5 12 2.4 2.4 4.6-4.8"/>',
  terminal:'<rect x="3" y="4" width="18" height="16" rx="3"/><path d="m7 8 4 4-4 4m6 0h4"/>',
  layout:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18m-7 0v10"/>',
  split:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/>',
  chart:'<path d="M4 4v16h17M7 13l4-5 4 4 5-7"/>',
  x:'<path d="m6 6 12 12M18 6 6 18"/>',
  folder:'<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10H3Z"/>',
  'folder-plus':'<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10H3Z"/><path d="M12 10v6m-3-3h6"/>',
  'arrow-up':'<path d="M12 20V4m-6 6 6-6 6 6"/>',
  'arrow-down':'<path d="M12 4v16m-6-6 6 6 6-6"/>',
  home:'<path d="m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9"/>',
  upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6"/>',
  download:'<path d="M12 3v13m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  refresh:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.5 7A7.5 7.5 0 0 1 18 5.5L20 9M4 15l2 3.5A7.5 7.5 0 0 0 18.5 17"/>',
  'chevron-down':'<path d="m6 9 6 6 6-6"/>',
  'chevron-right':'<path d="m9 6 6 6-6 6"/>',
  server:'<rect x="4" y="3" width="16" height="8" rx="2"/><rect x="4" y="13" width="16" height="8" rx="2"/><path d="M7 7h.01M7 17h.01m4-10h6m-6 10h6"/>',
  cpu:'<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4"/><rect x="9" y="9" width="6" height="6" rx="1"/>',
  memory:'<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 9v4m5-4v4m5-4v4M7 18v3m5-3v3m5-3v3"/>',
  disk:'<path d="m5 3-3 9v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-7l-3-9Z"/><path d="M2 12h20M6 17h.01M10 17h.01"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  file:'<path d="M14 3H5v18h14V8Z"/><path d="M14 3v6h5M8 13h8m-8 4h5"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  play:'<path d="m8 4 12 8-12 8Z"/>',
  copy:'<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  edit:'<path d="m15 5 4 4M4 20l5-1L21 7l-4-4L5 15Z"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
  heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0l-1 1-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>'
};
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.file}</svg>`;
const decorate = root => $$('[data-icon]', root).forEach(el => el.innerHTML = icon(el.dataset.icon));
function stored(key, fallback) { try { return JSON.parse(localStorage.getItem(`aster-${key}`)) ?? fallback; } catch { return fallback; } }
function save(key, value) { try { localStorage.setItem(`aster-${key}`, JSON.stringify(value)); } catch { /* Private storage may be disabled. */ } }
const defaults = [
  { id:'web', name:'prod-web-01', address:'10.24.8.12', user:'root', port:22, group:'生产环境', favorite:true, os:'Ubuntu 24.04 LTS', latency:24 },
  { id:'api', name:'prod-api-01', address:'10.24.8.16', user:'deploy', port:22, group:'生产环境', favorite:false, os:'Ubuntu 24.04 LTS', latency:26 },
  { id:'db', name:'prod-db-01', address:'10.24.8.20', user:'admin', port:22, group:'生产环境', favorite:false, os:'Debian 12', latency:25 },
  { id:'dev', name:'dev-server', address:'192.168.1.108', user:'developer', port:22, group:'开发环境', favorite:true, os:'Ubuntu 24.04 LTS', latency:3 },
  { id:'test', name:'staging-app', address:'192.168.1.112', user:'deploy', port:22, group:'开发环境', favorite:false, os:'Debian 12', latency:5 },
  { id:'personal', name:'my-cloud', address:'203.0.113.42', user:'ubuntu', port:22, group:'个人服务器', favorite:false, os:'Ubuntu 22.04 LTS', latency:48 }
];
const extraHosts = stored('hosts', []);
const state = { hosts:defaults.concat(Array.isArray(extraHosts) ? extraHosts.filter(h => h && typeof h.id === 'string' && typeof h.name === 'string' && typeof h.address === 'string') : []), active:'web', sessions:new Map(), filter:'all', collapsed:new Set(), panel:'files', split:null, sort:{key:'name',direction:1}, transfers:[], monitoring:stored('monitoring',true), theme:stored('theme','light'), fontSize:stored('font-size','12'), modalReturn:null, fileSystems:new Map() };
const host = id => state.hosts.find(h => h.id === id) || state.hosts[0];
const activeHost = () => host(state.active);
const activeSession = () => state.sessions.get(state.active);
const dateLabel = () => new Date().toLocaleString('sv-SE').slice(0,16);
function prompt(h,path) { return `<span class="prompt-user">${esc(h.user)}@${esc(h.name)}</span> <span class="prompt-path">${esc(path)}</span><span class="prompt-symbol">❯</span>`; }
function initialOutput(h) {
  return `<div class="terminal-line dim">Welcome to ${esc(h.os)} · x86_64</div><div class="terminal-banner"><div class="banner-logo">✳</div><div class="banner-info"><b>Everything you need. Nothing in your way.</b><div class="dim">Connected to <span class="purple">${esc(h.name)}</span> · Aster SSH</div><div class="spec-row"><span>CPU <span class="white">4 cores</span></span><span>Memory <span class="white">8 GiB</span></span><span>Disk <span class="white">100 GiB</span></span></div></div></div><div class="terminal-command">${prompt(h,'/var/www')}<span class="white">ls</span></div>${lsOutput(h,'/var/www',false)}<div class="terminal-line dim" style="margin-top:14px"># 连接已就绪。试试 help、docker ps 或 cd app。</div>`;
}
function createSession(id) { const h=host(id); return { hostId:id, path:'/var/www', output:initialOutput(h), history:[], historyIndex:0, draft:'', selectedFiles:new Set() }; }
function initialFileSystem(h) {
  const file=(name,type,size='—',content='')=>({name,type,size,content,date:'2026-10-29 09:32',permission:type==='folder'?'drwxr-xr-x':'-rw-r--r--'});
  return {
    '/':[file('var','folder'),file('home','folder'),file('etc','folder'),file('tmp','folder')],
    '/var':[file('www','folder'),file('log','folder')],
    '/var/www':[file('app','folder'),file('backups','folder'),file('logs','folder'),file('nginx.conf','file','2.4 KB',`# Aster demo · ${h.name}\nserver {\n    listen 80;\n    server_name example.com;\n    root /var/www/app;\n\n    location / {\n        try_files $uri $uri/ /index.html;\n    }\n}\n`),file('deploy.sh','script','1.2 KB','#!/usr/bin/env bash\nset -euo pipefail\n\necho "Starting deployment..."\ncd /var/www/app\necho "Build completed"\necho "Deployment ready"\n'),file('README.md','file','864 B',`# ${h.name}\n\nThis is an Aster SSH prototype.\nAll files and commands are simulated.\n\nUse the terminal, try split view, and explore SFTP.\n`)],
    '/var/www/app':[file('public','folder'),file('src','folder'),file('package.json','file','682 B','{\n  "name": "aster-demo-app",\n  "version": "1.0.0",\n  "private": true\n}\n'),file('index.html','file','1.8 KB','<!DOCTYPE html>\n<html lang="zh-CN">\n  <head><title>Hello Aster</title></head>\n  <body><h1>Welcome aboard.</h1></body>\n</html>\n')],
    '/var/www/app/public':[file('robots.txt','file','26 B','User-agent: *\nDisallow:\n')],'/var/www/app/src':[file('main.js','script','1.1 KB','console.log("Hello, Aster!");\n')],
    '/var/www/backups':[file('app-2026-10-28.tar.gz','file','24.8 MB','Aster prototype: this is a demo placeholder, not an actual archive.\n')],
    '/var/www/logs':[file('access.log','file','128 KB','192.168.1.10 - - [29/Oct/2026:09:41:08 +0800] "GET / HTTP/1.1" 200 1082\n192.168.1.10 - - [29/Oct/2026:09:41:09 +0800] "GET /app.js HTTP/1.1" 200 24018\n'),file('error.log','file','0 B','')],
    '/var/log':[file('syslog','file','256 KB','Oct 29 09:41:08 server systemd[1]: Started Aster demo service.\n')],
    '/home':[file(h.user,'folder')],[`/home/${h.user}`]:[file('.ssh','folder'),file('.bashrc','file','3.7 KB','# Demo shell configuration\nexport TERM=xterm-256color\n')],
    [`/home/${h.user}/.ssh`]:[file('config','file','182 B','# Demo SSH configuration\nHost example\n    HostName 203.0.113.10\n    User deploy\n')],'/etc':[file('hostname','file','12 B',`${h.name}\n`)],'/tmp':[]
  };
}
function fsFor(id=state.active) { if(!state.fileSystems.has(id)) state.fileSystems.set(id,initialFileSystem(host(id))); return state.fileSystems.get(id); }
function normalizePath(input,base) { const parts=(input.startsWith('/')?input:`${base}/${input}`).split('/');const out=[];for(const p of parts){if(p==='..')out.pop();else if(p&&p!=='.')out.push(p);}return '/'+out.join('/'); }
function lsOutput(h,path,long=false) { const entries=fsFor(h.id)[path]||[];if(!long)return `<div class="terminal-line">${entries.map(f=>`<span class="${f.type==='folder'?'blue':f.type==='script'?'green':'white'}">${esc(f.name)}${f.type==='folder'?'/':''}</span>`).join('    ')||'<span class="dim">（空目录）</span>'}</div>`;return `<div class="terminal-line dim">total ${entries.length*4}</div>`+entries.map(f=>`<div class="terminal-line"><span class="dim">${f.permission}  ${f.type==='folder'?'4':'1'} ${esc(h.user.padEnd(9))} ${esc(h.user.padEnd(9))} ${esc((f.type==='folder'?'4096':f.size).padStart(7))} Oct 29 09:32 </span><span class="${f.type==='folder'?'blue':f.type==='script'?'green':'white'}">${esc(f.name)}${f.type==='folder'?'/':''}</span></div>`).join(''); }
state.sessions.set('web',createSession('web'));state.sessions.set('dev',createSession('dev'));

function toast(message) { const el=document.createElement('div');el.className='toast';el.innerHTML=icon('check')+`<span>${esc(message)}</span>`;$('#toasts').append(el);setTimeout(()=>el.remove(),3200); }
function renderHosts() {
  const query=$('#host-search').value.trim().toLowerCase();const filtered=state.hosts.filter(h=>(state.filter!=='favorites'||h.favorite)&&`${h.name} ${h.address} ${h.group}`.toLowerCase().includes(query));
  const groups=[...new Set(filtered.map(h=>h.group))];$('#host-count').textContent=state.hosts.length;
  $('#host-groups').innerHTML=groups.map(group=>`<section class="host-group"><button class="group-title" data-group="${esc(group)}" aria-expanded="${!state.collapsed.has(group)}">${icon(state.collapsed.has(group)?'chevron-right':'chevron-down')}<span>${esc(group)}</span><span class="group-count">${filtered.filter(h=>h.group===group).length}</span></button><div ${state.collapsed.has(group)?'hidden':''}>${filtered.filter(h=>h.group===group).map(h=>`<button class="host-card ${h.id===state.active?'active':''}" data-host="${esc(h.id)}" title="打开 ${esc(h.name)}" aria-label="连接 ${esc(h.name)} ${esc(h.address)}" ${h.id===state.active?'aria-current="true"':''}><span class="host-symbol">${icon('server')}<i class="${state.sessions.has(h.id)?'connected':''}"></i></span><span class="host-detail"><strong>${esc(h.name)}</strong><span>${esc(h.address)}</span></span><span class="host-type">${h.favorite?'★':'SSH'}</span></button>`).join('')}</div></section>`).join('') || '<div class="search-empty">没有找到匹配的连接<br>试试名称、IP 或切换筛选</div>';
}
function renderTabs() {
  $('#tabs').innerHTML=[...state.sessions.keys()].map(id=>`<div class="session-tab ${id===state.active?'active':''}" role="tab" aria-selected="${id===state.active}" tabindex="${id===state.active?'0':'-1'}" data-tab="${esc(id)}"><i></i><span>${esc(host(id).name)}</span><button data-close-tab="${esc(id)}" title="关闭会话" aria-label="关闭 ${esc(host(id).name)}">${icon('x')}</button></div>`).join('');
  $('#connection-count').textContent=`${state.sessions.size+(state.split?1:0)} 个活跃会话`;
}
function renderSession() {
  const h=activeHost(),s=activeSession();$('#toolbar-name').textContent=h.name;$('#session-address').textContent=`${h.user}@${h.address}`;$('#environment-label').textContent=h.group;$('#latency').textContent=`${h.latency} ms`;$('#pane-host-name').textContent=h.name;
  $('#terminal-output').innerHTML=s.output;$('#prompt-label').innerHTML=prompt(h,s.path);$('#terminal-input').value=s.draft;$('#monitor-host').textContent=h.name;$('#monitor-os').textContent=h.os;
  renderTabs();renderHosts();renderFiles();renderSplit();applyFont();scrollTerminal();
}
function openHost(id) { if(!state.hosts.some(h=>h.id===id))return;const existing=state.sessions.has(id);if(!existing)state.sessions.set(id,createSession(id));state.active=id;renderSession();if(!existing)toast(`已打开 ${host(id).name} 的模拟会话`);$('.connections-sidebar').classList.remove('mobile-visible'); }
function closeTab(id) { if(!state.sessions.has(id))return;if(state.sessions.size===1){toast('保留最后一个演示会话；可新建连接继续体验');return;}const ids=[...state.sessions.keys()],index=ids.indexOf(id);state.sessions.delete(id);if(state.active===id)state.active=ids[index+1]||ids[index-1];renderSession(); }
function scrollTerminal(){requestAnimationFrame(()=>{const pane=$('#primary-terminal .terminal-scroll');pane.scrollTop=pane.scrollHeight;});}
function appendOutput(s,html){s.output+=html;if(s.output.length>90000){s.output=s.output.slice(s.output.indexOf('</div>',s.output.length-60000)+6);} }
function runCommand(command,s=activeSession(),secondary=false) {
  const h=host(s.hostId),raw=command.trim();s.draft='';if(!raw)return;
  s.history.push(raw);s.historyIndex=s.history.length;
  const parts=raw.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)||[];const cmd=parts[0],arg=parts.slice(1).join(' ').replace(/^['"]|['"]$/g,'');
  appendOutput(s,`<div class="terminal-command">${prompt(h,s.path)}<span class="white">${esc(raw)}</span></div>`);
  let result='';
  const line=(value,cls='')=>`<div class="terminal-line ${cls}">${esc(value)}</div>`;
  switch(cmd){
    case 'help':result=line('Aster SSH · 交互演示','purple')+line('这里的命令仅操作模拟文件系统，不会连接或修改真实服务器。','dim')+line('')+line('  ls [-la]       查看当前目录       cd <目录>    切换目录')+line('  pwd            当前路径           cat <文件>   查看文件')+line('  whoami         当前用户           uname -a     系统信息')+line('  docker ps      容器列表           uptime       运行时间')+line('  free -h        内存概览           df -h        磁盘概览')+line('  top / htop     进程快照           echo <文本>  输出文本')+line('  clear          清空终端           date         当前时间')+line('')+line('提示：↑ / ↓ 查看命令历史，Tab 补全命令或文件名。','dim');break;
    case 'ls':result=lsOutput(h,s.path,arg.includes('l'));break;
    case 'pwd':result=line(s.path,'blue');break;
    case 'cd':{const path=normalizePath(!arg||arg==='~'?`/home/${h.user}`:arg.replace(/^~\//,`/home/${h.user}/`),s.path);if(fsFor(h.id)[path])s.path=path;else result=line(`cd: ${arg}: No such directory`,'yellow');break;}
    case 'cat':{const target=normalizePath(arg,s.path),name=target.split('/').pop(),parent=target.slice(0,-name.length).replace(/\/$/,'')||'/';const f=fsFor(h.id)[parent]?.find(f=>f.name===name);result=!f?line(`cat: ${arg}: No such file`,'yellow'):f.type==='folder'?line(`cat: ${arg}: Is a directory`,'yellow'):line(f.content);break;}
    case 'whoami':result=line(h.user,'green');break;
    case 'uname':result=line(`Linux ${h.name} 6.8.0-51-generic #52-Ubuntu SMP x86_64 GNU/Linux`);break;
    case 'uptime':result=line(' 10:24:08 up 28 days, 16:42,  2 users,  load average: 0.12, 0.18, 0.16');break;
    case 'docker':result=arg==='ps'?line('CONTAINER ID   IMAGE               STATUS         PORTS                  NAMES','dim')+line('a8f4c2d19b31   nginx:1.27-alpine    Up 12 days     0.0.0.0:80->80/tcp      web','green')+line('b19d7a22ef04   node:22-alpine      Up 12 days     0.0.0.0:3000->3000/tcp  app','green')+line('c82aa31490fe   redis:7-alpine      Up 28 days     6379/tcp               cache','green'):line('演示命令：docker ps','yellow');break;
    case 'free':result=line('               total        used        free      shared  buff/cache   available','dim')+line('Mem:           8.0Gi       2.9Gi       3.2Gi       120Mi       1.9Gi       5.1Gi')+line('Swap:          2.0Gi          0B       2.0Gi');break;
    case 'df':result=line('Filesystem      Size  Used Avail Use% Mounted on','dim')+line('/dev/sda1       100G   43G   57G  43% /')+line('tmpfs           4.0G     0  4.0G   0% /dev/shm');break;
    case 'top':case 'htop':result=line('进程快照 · 模拟数据','purple')+line('  PID USER       CPU%   MEM%  COMMAND','dim')+line(' 1842 deploy      4.2    3.8  node /app/server.js','green')+line('  981 www-data    1.1    0.4  nginx: worker process')+line(' 1108 redis       0.6    1.2  redis-server *:6379')+line('  702 root        0.1    0.2  sshd: listener')+line('快照已完成；本原型未运行持续交互进程。','dim');break;
    case 'echo':result=line(arg);break;
    case 'date':result=line(new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})+' CST');break;
    case 'clear':s.output='';break;
    case 'exit':if(secondary){state.split=null;renderSession();return;}closeTab(h.id);return;
    default:result=line(`${cmd}: 演示终端暂不支持此命令，输入 help 查看可用命令。`,'yellow');
  }
  appendOutput(s,result);if(secondary){renderSplit();}else{renderSession();}requestAnimationFrame(()=>$(secondary?'#split-input':'#terminal-input')?.focus());
}
function bindTerminalInput(input,sessionGetter,isSecondary=false){
  input.addEventListener('input',()=>sessionGetter().draft=input.value);
  input.addEventListener('keydown',event=>{const s=sessionGetter();if(event.key==='ArrowUp'||event.key==='ArrowDown'){event.preventDefault();if(!s.history.length)return;s.historyIndex=Math.max(0,Math.min(s.history.length,s.historyIndex+(event.key==='ArrowUp'?-1:1)));input.value=s.history[s.historyIndex]||'';s.draft=input.value;setTimeout(()=>input.setSelectionRange(input.value.length,input.value.length),0);}if(event.key==='Tab'){event.preventDefault();const text=input.value;const segment=text.split(/\s+/).pop();const choices=text.includes(' ')?(fsFor(s.hostId)[s.path]||[]).map(f=>f.name+(f.type==='folder'?'/':'')):['help','ls','pwd','cd','cat','whoami','uname','uptime','docker ps','free -h','df -h','htop','clear','date','echo'];const matches=choices.filter(c=>c.startsWith(segment));if(matches.length===1){input.value=text.slice(0,text.length-segment.length)+matches[0];s.draft=input.value;}}if(event.ctrlKey&&event.key.toLowerCase()==='l'){event.preventDefault();s.output='';if(isSecondary)renderSplit();else renderSession();input.focus();}if(event.ctrlKey&&event.key.toLowerCase()==='c'&&!window.getSelection()?.toString()){event.preventDefault();appendOutput(s,`<div class="terminal-command">${prompt(host(s.hostId),s.path)}${esc(input.value)}^C</div>`);s.draft='';if(isSecondary)renderSplit();else renderSession();}});
}
function renderSplit(){
  const area=$('#terminal-area');area.classList.toggle('is-split',!!state.split);$('#primary-terminal .terminal-pane-heading').hidden=!state.split;$('[data-action="split"]').setAttribute('aria-pressed',String(!!state.split));$('[data-action="split"]').classList.toggle('selected',!!state.split);$('#secondary-terminal')?.remove();
  if(!state.split){$('#connection-count').textContent=`${state.sessions.size} 个活跃会话`;return;}
  const s=state.split,h=host(s.hostId),pane=document.createElement('section');pane.id='secondary-terminal';pane.className='terminal-pane';pane.setAttribute('aria-label','第二个模拟 SSH 终端');pane.innerHTML=`<div class="terminal-pane-heading"><span>02</span><span>${esc(h.name)}</span><span>SSH</span><button data-action="split" title="关闭分屏" aria-label="关闭分屏">${icon('x')}</button></div><div class="terminal-scroll"><div class="terminal-output" role="log">${s.output}</div><form id="split-form" class="terminal-prompt"><span>${prompt(h,s.path)}</span><input id="split-input" aria-label="分屏终端命令" autocomplete="off" spellcheck="false" value="${esc(s.draft)}"></form></div><div class="terminal-footnote"><span><i></i>独立模拟会话</span></div>`;area.append(pane);$('#split-form').addEventListener('submit',e=>{e.preventDefault();runCommand($('#split-input').value,state.split,true);});bindTerminalInput($('#split-input'),()=>state.split,true);const scroll=$('.terminal-scroll',pane);scroll.scrollTop=scroll.scrollHeight;$('#connection-count').textContent=`${state.sessions.size+1} 个活跃会话`;applyFont();
}
function toggleSplit(){if(state.split)state.split=null;else{state.split=createSession(state.active);state.split.output=`<div class="terminal-line dim">New split session · ${esc(activeHost().name)}</div><div class="terminal-line green" style="margin-top:12px">独立终端已就绪。</div><div class="terminal-line dim">试试 docker ps 或 htop</div>`;}renderSplit();}
function applyFont(){ $$('.terminal-pane').forEach(p=>{p.style.fontSize=`${state.split?Math.max(9,Number(state.fontSize)-1):state.fontSize}px`;}); }

function renderFiles(){
  const path=activeSession().path,fs=fsFor(),parts=path.split('/').filter(Boolean);$('#file-path').innerHTML=`<button data-path="/">/</button>`+parts.map((part,i)=>`${icon('chevron-right')}<button data-path="/${esc(parts.slice(0,i+1).join('/'))}">${esc(part)}</button>`).join('');
  const files=[...(fs[path]||[])].sort((a,b)=>{if(a.type==='folder'&&b.type!=='folder')return -1;if(b.type==='folder'&&a.type!=='folder')return 1;const key=state.sort.key;const value=key==='size'?sizeNumber(a.size)-sizeNumber(b.size):String(a[key]).localeCompare(String(b[key]));return value*state.sort.direction;});
  $('#file-list').innerHTML=files.map(f=>`<tr><td><button class="file-name ${f.type}" data-file="${esc(f.name)}" title="${f.type==='folder'?'打开文件夹':'预览和编辑演示文件'}">${icon(f.type==='folder'?'folder':f.type==='script'?'code':'file')}<span>${esc(f.name)}</span></button></td><td>${esc(f.size)}</td><td>${esc(f.date)}</td><td>${esc(f.permission)}</td><td class="file-row-actions"><div>${f.type==='folder'?`<button class="icon-button" data-file="${esc(f.name)}" title="打开文件夹" aria-label="打开 ${esc(f.name)}">${icon('chevron-right')}</button>`:`<button class="icon-button" data-download="${esc(f.name)}" title="下载演示文件" aria-label="下载 ${esc(f.name)}">${icon('download')}</button><button class="icon-button" data-file="${esc(f.name)}" title="预览文件" aria-label="预览 ${esc(f.name)}">${icon('edit')}</button>`}</div></td></tr>`).join('')||'<tr><td colspan="5" class="empty-row">此文件夹为空，可以上传文件或新建文件夹</td></tr>';
  $('#file-summary').textContent=`${files.filter(f=>f.type==='folder').length} 个文件夹，${files.filter(f=>f.type!=='folder').length} 个文件`;
}
function sizeNumber(value){const m=String(value).match(/([\d.]+)\s*(B|KB|MB|GB)/);return m?Number(m[1])*({B:1,KB:1024,MB:1048576,GB:1073741824}[m[2]]):0;}
function navigateFiles(path){if(!fsFor()[path])return;activeSession().path=path;$('#prompt-label').innerHTML=prompt(activeHost(),path);renderFiles();}
function setPanel(panel){state.panel=panel;$('.files-panel').classList.remove('collapsed');$$('[data-panel]').forEach(b=>b.classList.toggle('active',b.dataset.panel===panel));['files','transfers','snippets'].forEach(key=>$(`#${key}-view`).hidden=key!==panel);if(panel==='transfers')renderTransfers();if(panel==='snippets')renderSnippets();$$('.rail-top .rail-button').forEach(b=>b.classList.toggle('active',b.dataset.action===(panel==='files'?'sessions':panel)));}
function fileSize(bytes){if(bytes<1024)return `${bytes} B`;if(bytes<1048576)return `${(bytes/1024).toFixed(1)} KB`;return `${(bytes/1048576).toFixed(1)} MB`;}
function addTransfer(name,direction,bytes,callback){const entry={id:crypto.randomUUID(),name,direction,bytes,progress:0,status:'active',address:activeHost().address,path:activeSession().path,callback};state.transfers.unshift(entry);setPanel('transfers');$('.rail-notification').hidden=false;$('#transfer-count').textContent=state.transfers.length;const timer=setInterval(()=>{if(entry.status==='cancelled'){clearInterval(timer);return;}entry.progress=Math.min(100,entry.progress+14+Math.floor(Math.random()*12));if(entry.progress===100){entry.status='done';clearInterval(timer);callback?.();toast(`${direction==='upload'?'上传':'下载'}演示完成：${name}`);}if(state.panel==='transfers')renderTransfers();},280);renderTransfers();}
function renderTransfers(){const list=$('#transfers-view');if(!state.transfers.length){list.innerHTML=`<div class="empty-state">${icon('transfer')}<span>所有文件，都有迹可循</span><p>上传或下载文件后，传输进度会显示在这里</p><button class="text-button primary-soft" data-action="upload">${icon('upload')}选择文件体验上传</button></div>`;return;}list.innerHTML=`<div class="transfer-list">${state.transfers.map(t=>`<div class="transfer-item"><span>${icon(t.direction==='upload'?'upload':'download')}</span><div class="transfer-info"><div><span>${esc(t.name)}</span><small>${t.status==='cancelled'?'已取消':t.status==='done'?'已完成':`${t.progress}%`} · ${fileSize(t.bytes)}</small></div><div class="progress-track"><span style="width:${t.progress}%;${t.status==='cancelled'?'background:#b6bdce':''}"></span></div><div class="transfer-direction">${t.direction==='upload'?'本地 →':'← 本地'} ${esc(t.address)}${esc(t.path)} · 模拟传输</div></div>${t.status==='active'?`<button class="icon-button" data-cancel-transfer="${t.id}" title="取消传输" aria-label="取消 ${esc(t.name)} 的传输">${icon('x')}</button>`:icon(t.status==='done'?'check':'x')}</div>`).join('')}</div>`;}
const snippets=[{name:'查看容器',cmd:'docker ps'},{name:'磁盘空间',cmd:'df -h'},{name:'内存概览',cmd:'free -h'},{name:'进程快照',cmd:'htop'},{name:'系统信息',cmd:'uname -a'},{name:'运行时间',cmd:'uptime'}];
function renderSnippets(){$('#snippets-view').innerHTML=`<div class="snippet-grid">${snippets.map((s,i)=>`<button class="snippet-card" data-snippet="${i}"><strong>${s.name}${icon('play')}</strong><code>${esc(s.cmd)}</code></button>`).join('')}</div>`;}
async function uploadFiles(files){if(!files?.length)return;const id=state.active,path=activeSession().path;for(const file of files){let content=file.size<=1048576?await file.text():'此文件大于 1 MB，原型仅保存名称和大小，不保留文件内容。\n';const entry={name:file.name,type:file.name.endsWith('.sh')?'script':'file',size:fileSize(file.size),content,date:dateLabel(),permission:'-rw-r--r--'};addTransfer(file.name,'upload',file.size,()=>{const entries=fsFor(id)[path];const index=entries.findIndex(f=>f.name===entry.name);if(index>=0)entries[index]=entry;else entries.push(entry);if(state.active===id)renderFiles();});}$('#upload-input').value='';}
function downloadFile(name){const file=fsFor()[activeSession().path]?.find(f=>f.name===name);if(!file||file.type==='folder')return;const content=file.content;addTransfer(name,'download',sizeNumber(file.size),()=>{const url=URL.createObjectURL(new Blob([content],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});}

function modal(html,{palette=false}={}){state.modalReturn=document.activeElement;$('#modal').className=`modal${palette?' palette':''}`;$('#modal').innerHTML=html;$('#modal-backdrop').hidden=false;decorate($('#modal'));requestAnimationFrame(()=>$('#modal input, #modal textarea, #modal button')?.focus());}
function closeModal(){$('#modal-backdrop').hidden=true;$('#modal').innerHTML='';state.modalReturn?.focus();}
function modalHeader(title){return `<div class="modal-header"><h2 id="modal-title">${esc(title)}</h2><button class="icon-button" data-action="close-modal" aria-label="关闭弹窗">${icon('x')}</button></div>`;}
function newHost(){modal(`${modalHeader('新建连接')}<p class="modal-description">为下一次连接，留一个顺手的入口。</p><form id="new-host-form" class="modal-form"><label>连接名称<input name="name" placeholder="例如：我的开发服务器" maxlength="40" required></label><div class="form-row"><label style="flex:3">主机地址<input name="address" placeholder="IP 地址或域名" maxlength="253" required></label><label style="flex:1">端口<input name="port" type="number" value="22" min="1" max="65535" required></label></div><div class="form-row"><label>用户名<input name="user" value="root" maxlength="32" required></label><label>分组<select name="group"><option>生产环境</option><option selected>开发环境</option><option>个人服务器</option></select></label></div><div class="form-note">${icon('info')}原型将创建模拟会话，不需要密码或私钥。</div><div class="modal-actions"><button type="button" class="button-secondary" data-action="close-modal">取消</button><button type="submit" class="button-primary">创建并打开</button></div></form>`);$('#new-host-form').addEventListener('submit',event=>{event.preventDefault();const f=new FormData(event.target),name=f.get('name').trim(),address=f.get('address').trim(),user=f.get('user').trim();if(!name||!user||!/^[a-zA-Z0-9.:[\]_%\-]+$/.test(address)){toast('请填写连接名称、有效主机地址和用户名');return;}const h={id:crypto.randomUUID(),name,address,user,port:Number(f.get('port')),group:f.get('group'),favorite:false,os:'Ubuntu 24.04 LTS',latency:18};state.hosts.push(h);save('hosts',state.hosts.filter(item=>!defaults.some(d=>d.id===item.id)));closeModal();state.filter='all';$$('[data-filter]').forEach(b=>b.classList.toggle('active',b.dataset.filter==='all'));$('#host-search').value='';state.collapsed.delete(h.group);openHost(h.id);});}
function newFolder(){modal(`${modalHeader('新建文件夹')}<p class="modal-description">位置：${esc(activeSession().path)} · 演示文件系统</p><form id="folder-form" class="modal-form"><label>文件夹名称<input name="name" placeholder="例如：releases" maxlength="80" required></label><div class="modal-actions"><button type="button" class="button-secondary" data-action="close-modal">取消</button><button type="submit" class="button-primary">创建文件夹</button></div></form>`);$('#folder-form').addEventListener('submit',e=>{e.preventDefault();const name=new FormData(e.target).get('name').trim();if(!name||/[\/\\]/.test(name)||name==='.'||name==='..'){toast('请输入有效文件夹名称');return;}const s=activeSession(),files=fsFor()[s.path];if(files.some(f=>f.name===name)){toast('此名称已存在，请换一个名称');return;}files.push({name,type:'folder',size:'—',content:'',date:dateLabel(),permission:'drwxr-xr-x'});fsFor()[normalizePath(name,s.path)]=[];closeModal();renderFiles();toast('演示文件夹已创建');});}
function openFile(name){const path=activeSession().path,file=fsFor()[path]?.find(f=>f.name===name);if(!file)return;if(file.type==='folder'){navigateFiles(normalizePath(name,path));return;}modal(`${modalHeader(file.name)}<p class="modal-description">${esc(path)}/${esc(name)} · 演示文件编辑器</p><form id="edit-file-form" class="modal-form"><label>文件内容<textarea name="content" spellcheck="false">${esc(file.content)}</textarea></label><div class="form-note">${icon('info')}修改仅保留在当前原型会话中。</div><div class="modal-actions"><button type="button" class="button-secondary" data-action="close-modal">关闭</button><button type="submit" class="button-primary">保存修改</button></div></form>`);$('#edit-file-form').addEventListener('submit',e=>{e.preventDefault();file.content=new FormData(e.target).get('content');file.size=fileSize(new Blob([file.content]).size);file.date=dateLabel();closeModal();renderFiles();toast('演示文件已保存');});}
function palette(){modal(`<div class="palette-input"><span>${icon('search')}</span><input id="palette-search" placeholder="搜索连接，或输入操作…" aria-label="搜索连接或操作"><kbd>Esc</kbd></div><h2 id="modal-title" style="position:absolute;width:1px;height:1px;overflow:hidden">快速查找</h2><div id="palette-results" class="palette-results"></div><div class="palette-footer"><span>↑ ↓ 选择 · Enter 打开</span><span>Aster SSH</span></div>`,{palette:true});const render=()=>{const q=$('#palette-search').value.toLowerCase();const items=[...state.hosts.map(h=>({title:h.name,sub:`${h.address} · ${h.group}`,icon:'server',attribute:`data-host="${esc(h.id)}"`})),{title:'新建连接',sub:'添加到当前工作空间',icon:'plus',attribute:'data-action="new-host"'},{title:'切换终端分屏',sub:'并排处理多个任务',icon:'split',attribute:'data-action="split"'},{title:'切换深浅主题',sub:'选择适合当下的工作氛围',icon:'sun',attribute:'data-action="theme"'},{title:'偏好设置',sub:'字体与监控设置',icon:'settings',attribute:'data-action="settings"'}].filter(item=>`${item.title} ${item.sub}`.toLowerCase().includes(q));$('#palette-results').innerHTML=items.map(item=>`<button class="palette-result" ${item.attribute}><span>${icon(item.icon)}</span><div><strong>${esc(item.title)}</strong><small>${esc(item.sub)}</small></div>${icon('chevron-right')}</button>`).join('')||'<div class="empty-state">没有匹配的连接或操作</div>';};render();$('#palette-search').addEventListener('input',render);$('#modal').addEventListener('keydown',e=>{if(!['ArrowDown','ArrowUp','Enter'].includes(e.key))return;const results=$$('.palette-result');if(!results.length)return;const i=results.indexOf(document.activeElement);if(e.key==='Enter'&&i<0){e.preventDefault();results[0].click();}else if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();results[(i+(e.key==='ArrowDown'?1:-1)+results.length)%results.length].focus();}});}
function setTheme(theme){state.theme=theme;document.body.classList.toggle('dark',theme==='dark');save('theme',theme);$('[data-action="theme"]').innerHTML=icon(theme==='dark'?'moon':'sun');}
function setMonitoring(on){state.monitoring=on;document.body.classList.toggle('monitor-hidden',!on);$$('[data-action="monitor"]').forEach(b=>{b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on));});save('monitoring',on);}
function settings(){modal(`${modalHeader('让工作台更合你意')}<p class="modal-description">一点调整，找到舒服的工作状态。</p><div class="setting-row"><div><strong>界面主题</strong><p>终端始终保持深色，照顾长时间阅读</p></div><select id="setting-theme" aria-label="界面主题"><option value="light" ${state.theme==='light'?'selected':''}>浅色</option><option value="dark" ${state.theme==='dark'?'selected':''}>深色</option></select></div><div class="setting-row"><div><strong>终端字号</strong><p>Cascadia Code / Consolas</p></div><select id="setting-font" aria-label="终端字号">${[10,11,12,13,14,15].map(n=>`<option ${String(n)===String(state.fontSize)?'selected':''} value="${n}">${n} px</option>`).join('')}</select></div><div class="setting-row"><div><strong>服务器概览</strong><p>关闭后暂停模拟数据刷新</p></div><button id="setting-monitor" class="toggle ${state.monitoring?'on':''}" role="switch" aria-label="服务器概览" aria-checked="${state.monitoring}"></button></div><div class="setting-row"><div><strong>连接收藏</strong><p>为当前连接添加或取消收藏</p></div><button id="setting-favorite" class="toggle ${activeHost().favorite?'on':''}" role="switch" aria-label="收藏当前连接" aria-checked="${activeHost().favorite}"></button></div><div class="form-note" style="margin-top:20px">${icon('info')}这是交互原型，全部连接与监控均为模拟。</div><div class="modal-actions"><button class="button-primary" data-action="close-modal">完成</button></div>`);$('#setting-theme').addEventListener('change',e=>setTheme(e.target.value));$('#setting-font').addEventListener('change',e=>{state.fontSize=e.target.value;save('font-size',state.fontSize);applyFont();});$('#setting-monitor').addEventListener('click',e=>{setMonitoring(!state.monitoring);e.currentTarget.classList.toggle('on',state.monitoring);e.currentTarget.setAttribute('aria-checked',String(state.monitoring));});$('#setting-favorite').addEventListener('click',e=>{const h=activeHost();h.favorite=!h.favorite;e.currentTarget.classList.toggle('on',h.favorite);e.currentTarget.setAttribute('aria-checked',String(h.favorite));save('favorites',state.hosts.filter(h=>h.favorite).map(h=>h.id));renderHosts();});}
function shortcuts(){modal(`${modalHeader('指尖之间，更快一步')}<p class="modal-description">也可以直接点击界面上的按钮探索。</p>${[['快速查找 / 打开连接','Ctrl K'],['搜索终端','Ctrl F'],['新建连接','Ctrl Shift N'],['清空终端','Ctrl L'],['命令历史','↑ / ↓'],['补全命令与文件名','Tab'],['搜索连接','/'],['关闭弹窗','Esc']].map(([label,key])=>`<div class="shortcut-row"><span>${label}</span><kbd>${key}</kbd></div>`).join('')}<div class="modal-actions"><button class="button-primary" data-action="close-modal">开始探索</button></div>`);}
function terminalSearch(show=true){$('#terminal-search-bar').hidden=!show;if(show)$('#terminal-search-input').focus();else{$('#terminal-search-input').value='';$('#terminal-output').innerHTML=activeSession().output;}}
function findInTerminal(query){const output=$('#terminal-output');output.innerHTML=activeSession().output;if(!query){$('#terminal-search-count').textContent='';return;}const walker=document.createTreeWalker(output,NodeFilter.SHOW_TEXT);const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);let count=0;for(const node of nodes){const text=node.textContent,lower=text.toLowerCase();let at=0,index=lower.indexOf(query.toLowerCase()),fragment=document.createDocumentFragment();if(index<0)continue;while(index>=0){fragment.append(document.createTextNode(text.slice(at,index)));const mark=document.createElement('mark');mark.className='search-match';mark.textContent=text.slice(index,index+query.length);fragment.append(mark);count++;at=index+query.length;index=lower.indexOf(query.toLowerCase(),at);}fragment.append(document.createTextNode(text.slice(at)));node.replaceWith(fragment);}$('#terminal-search-count').textContent=`${count} 处`;$('mark',output)?.scrollIntoView({block:'center'});}

document.addEventListener('click',event=>{
  const button=event.target.closest('button,[data-tab]');if(!button)return;
  if(button.dataset.closeTab){event.stopPropagation();closeTab(button.dataset.closeTab);return;}
  if(button.dataset.host){const id=button.dataset.host;if(!$('#modal-backdrop').hidden)closeModal();openHost(id);return;}
  if(button.dataset.tab){openHost(button.dataset.tab);return;}
  if(button.dataset.group){const group=button.dataset.group;state.collapsed.has(group)?state.collapsed.delete(group):state.collapsed.add(group);renderHosts();return;}
  if(button.dataset.filter){state.filter=button.dataset.filter;$$('[data-filter]').forEach(b=>b.classList.toggle('active',b===button));renderHosts();return;}
  if(button.dataset.panel){setPanel(button.dataset.panel);return;}
  if(button.dataset.path){navigateFiles(button.dataset.path);return;}
  if(button.dataset.file){openFile(button.dataset.file);return;}
  if(button.dataset.download){downloadFile(button.dataset.download);return;}
  if(button.dataset.sort){const key=button.dataset.sort;state.sort={key,direction:state.sort.key===key?-state.sort.direction:1};renderFiles();return;}
  if(button.dataset.snippet!==undefined){runCommand(snippets[Number(button.dataset.snippet)].cmd);toast(`已在模拟终端运行 ${snippets[Number(button.dataset.snippet)].cmd}`);return;}
  if(button.dataset.cancelTransfer){const t=state.transfers.find(t=>t.id===button.dataset.cancelTransfer);if(t)t.status='cancelled';renderTransfers();return;}
  const action=button.dataset.action;if(!action)return;
  if($('#modal').classList.contains('palette')&&action!=='close-modal')closeModal();
  switch(action){
    case 'theme':setTheme(state.theme==='light'?'dark':'light');break;
    case 'palette':palette();break;
    case 'new-host':newHost();break;
    case 'settings':settings();break;
    case 'shortcuts':shortcuts();break;
    case 'close-modal':closeModal();break;
    case 'split':toggleSplit();break;
    case 'monitor':setMonitoring(!state.monitoring);break;
    case 'terminal-search':terminalSearch();break;
    case 'close-terminal-search':terminalSearch(false);break;
    case 'files-collapse':$('.files-panel').classList.toggle('collapsed');break;
    case 'new-folder':newFolder();break;
    case 'upload':$('#upload-input').click();break;
    case 'file-up':navigateFiles(normalizePath('..',activeSession().path));break;
    case 'file-home':navigateFiles(`/home/${activeHost().user}`);break;
    case 'file-refresh':renderFiles();toast('演示文件列表已刷新');break;
    case 'sessions':setPanel('files');if(innerWidth<=720)$('.connections-sidebar').classList.toggle('mobile-visible');break;
    case 'snippets':setPanel('snippets');break;
    case 'transfers':setPanel('transfers');break;
  }
});
$('#terminal-form').addEventListener('submit',e=>{e.preventDefault();runCommand($('#terminal-input').value);});bindTerminalInput($('#terminal-input'),activeSession);
$('#host-search').addEventListener('input',renderHosts);$('#terminal-search-input').addEventListener('input',e=>findInTerminal(e.target.value));$('#upload-input').addEventListener('change',e=>uploadFiles(e.target.files));
$('#modal-backdrop').addEventListener('click',e=>{if(e.target===$('#modal-backdrop'))closeModal();});
document.addEventListener('keydown',e=>{
  const editing=/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
  if(e.key==='Escape'){if(!$('#modal-backdrop').hidden)closeModal();else if(!$('#terminal-search-bar').hidden)terminalSearch(false);else $('.connections-sidebar').classList.remove('mobile-visible');return;}
  if(!$('#modal-backdrop').hidden){if(e.key==='Tab'){const focusables=$$('button,input,select,textarea,[tabindex="0"]',$('#modal')).filter(el=>!el.disabled&&!el.hidden);const first=focusables[0],last=focusables.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}return;}
  if(e.ctrlKey&&e.key.toLowerCase()==='k'){e.preventDefault();palette();}
  else if(e.ctrlKey&&e.key.toLowerCase()==='f'){e.preventDefault();terminalSearch();}
  else if(e.ctrlKey&&e.shiftKey&&e.key.toLowerCase()==='n'){e.preventDefault();newHost();}
  else if(e.key==='/'&&!editing){e.preventDefault();$('.connections-sidebar').classList.add('mobile-visible');$('#host-search').focus();}
  else if(e.key==='?'&&!editing){e.preventDefault();shortcuts();}
  else if(document.activeElement.matches('[data-tab]')&&['ArrowLeft','ArrowRight','Enter',' '].includes(e.key)){e.preventDefault();const ids=[...state.sessions.keys()],i=ids.indexOf(state.active);openHost(ids[(i+(e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:0)+ids.length)%ids.length]);$(`[data-tab="${state.active}"]`).focus();}
});
const dropZone=$('#files-view');let dragDepth=0;dropZone.addEventListener('dragenter',e=>{e.preventDefault();dragDepth++;dropZone.classList.add('drop-active');});dropZone.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='copy';});dropZone.addEventListener('dragleave',()=>{if(--dragDepth<=0)dropZone.classList.remove('drop-active');});dropZone.addEventListener('drop',e=>{e.preventDefault();dragDepth=0;dropZone.classList.remove('drop-active');uploadFiles(e.dataTransfer.files);});
const resizer=$('.files-resizer');resizer.addEventListener('pointerdown',e=>{const start=e.clientY,height=$('.files-panel').offsetHeight;resizer.setPointerCapture(e.pointerId);const move=ev=>{const max=$('.main-workspace').clientHeight-300;$('.files-panel').style.height=`${Math.max(120,Math.min(max,height+start-ev.clientY))}px`;$('.files-panel').classList.remove('collapsed');};resizer.addEventListener('pointermove',move);resizer.addEventListener('pointerup',()=>resizer.removeEventListener('pointermove',move),{once:true});});resizer.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const height=$('.files-panel').offsetHeight;$('.files-panel').style.height=`${Math.max(120,Math.min($('.main-workspace').clientHeight-300,height+(e.key==='ArrowUp'?20:-20)))}px`;}});
const cpuSeries=[22,21,24,23,29,27,31,24,26,23,29,32,25,18,24,22,25,20,23,20,22,19,24,21,29,22,25,18,23,21,23,22,26,23,27,24,25,20,25,23];
const netSeries=[25,20,22,15,21,26,20,15,21,18,28,23,25,21,30,28,33,24,30,25,31,26,29,21,27,20,29,25,31,23,28,26,34,29,33,26,30,28,35,29];
function drawCharts(){const path=values=>values.map((v,i)=>`${i?'L':'M'}${(i*220/(values.length-1)).toFixed(1)},${52-v}`).join(' ');const cpu=path(cpuSeries);$('.cpu-chart .line').setAttribute('d',cpu);$('.cpu-chart .area').setAttribute('d',`${cpu} L220,52 L0,52 Z`);$('.network-chart .line').setAttribute('d',path(netSeries));$('.network-chart .secondary').setAttribute('d',path(netSeries.map((v,i)=>v*.48+Math.sin(i)*3)));}
setInterval(()=>{if(!state.monitoring||document.hidden)return;cpuSeries.shift();cpuSeries.push(18+Math.random()*14);netSeries.shift();netSeries.push(22+Math.random()*14);drawCharts();$('#cpu-value').textContent=(10+Math.random()*6).toFixed(1);$('#network-down').innerHTML=`${(1+Math.random()*.5).toFixed(2)} <small>MB/s</small>`;$('#network-up').innerHTML=`${Math.floor(240+Math.random()*90)} <small>KB/s</small>`;},2400);
const favorites=stored('favorites',null);if(Array.isArray(favorites))state.hosts.forEach(h=>h.favorite=favorites.includes(h.id));
decorate(document);setTheme(state.theme);if(innerWidth<=1050)setMonitoring(false);else setMonitoring(state.monitoring);drawCharts();renderSession();
