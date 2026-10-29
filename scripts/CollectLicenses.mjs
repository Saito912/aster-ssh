import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..');
const version=JSON.parse(fs.readFileSync(path.join(root,'frontend/package.json'),'utf8')).version;
const outputDirectory=path.resolve(process.argv[2]||path.join(root,'releases',version));
const go=process.env.ASTER_GO||path.join(root,'.tools/go/bin/go.exe');
const modules=execFileSync(go,['list','-deps','-f','{{with .Module}}{{.Path}}|{{.Version}}|{{.Dir}}{{end}}','.'],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
const entries=new Map(modules.map(line=>{const [name,version,dir]=line.split('|');return[name,{name,version,dir}];}));
for(const name of ['@xterm/xterm','@xterm/addon-fit','@xterm/addon-search','@xterm/addon-web-links']){const dir=path.join(root,'frontend/node_modules',name);const pkg=JSON.parse(fs.readFileSync(path.join(dir,'package.json'),'utf8'));entries.set(name,{name,version:pkg.version,dir});}
let output=`Aster SSH ${version} — Third-party software notices\n\nRuntime components and their license texts are listed below.\nMicrosoft Edge WebView2 and the Windows .NET Framework are provided separately by Microsoft.\n\n`;
const goroot=execFileSync(go,['env','GOROOT'],{encoding:'utf8'}).trim();
entries.set('Go standard library',{name:'Go standard library',version:execFileSync(go,['version'],{encoding:'utf8'}).trim(),dir:goroot});
for(const item of [...entries.values()].sort((a,b)=>a.name.localeCompare(b.name))){if(!item.dir||item.name==='asterssh')continue;const candidates=fs.readdirSync(item.dir).filter(name=>/^(LICENSE|LICENCE|COPYING|NOTICE|COPYRIGHT)(\..*)?$/i.test(name)&&fs.statSync(path.join(item.dir,name)).isFile());output+='='.repeat(78)+'\n'+item.name+' '+item.version+'\n';if(!candidates.length)throw new Error('Missing license text: '+item.name);for(const name of candidates)output+='\n'+name+'\n\n'+fs.readFileSync(path.join(item.dir,name),'utf8')+'\n';output+='\n';}
fs.mkdirSync(outputDirectory,{recursive:true});
fs.writeFileSync(path.join(outputDirectory,'第三方许可证.txt'),output);
console.log(`Collected licenses for ${entries.size} runtime components.`);
