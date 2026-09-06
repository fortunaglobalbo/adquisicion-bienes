const fs = require('fs');
const path = require('path');
function walk(dir) { return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]); }
for(const file of walk('src/app/api')) {
  if(!file.endsWith('.ts')) continue;
  let s=fs.readFileSync(file,'utf8');
  if(s.includes('http://85.31.230.163:8080')) {
    s='import { engineUrl } from "@/lib/server/config";\n'+s;
    s=s.replace(/"http:\/\/85\.31\.230\.163:8080([^"\n]*)"/g,(_,suffix)=>suffix?'`${engineUrl}'+suffix+'`':'engineUrl');
    s=s.replace(/process\.env\.VPS_DOCX_ENGINE_URL \|\| engineUrl/g,'engineUrl');
  }
  if(/fetch\(/.test(s) && !s.includes('AbortSignal.timeout')) s=s.replace(/body: (vpsFormData|vpsFd),/g,'body: $1,\n      signal: AbortSignal.timeout(60000),');
  fs.writeFileSync(file,s);
}
for(const file of ['src/components/expediente/FolderSidebar.tsx','src/components/expediente/FolderProgressBar.tsx','src/components/expediente/FolderManagerModal.tsx']) {
  let s=fs.readFileSync(file,'utf8').replace(/\.sort\(\(a, b\) => a\.numero - b\.numero\)/g,'.slice().sort((a, b) => (a.orden || a.numero) - (b.orden || b.numero))'); fs.writeFileSync(file,s);
}
let ai=fs.readFileSync('src/lib/ai/openCodeClient.ts','utf8');
ai=ai.replace(/const DEFAULT_OPENCODE_KEY = "[^"]*";/,'const DEFAULT_OPENCODE_KEY = "";');
ai=ai.replace('const apiKey = process.env.OPENCODE_GO_API_KEY || DEFAULT_OPENCODE_KEY;', 'const apiKey = process.env.OPENCODE_GO_API_KEY || DEFAULT_OPENCODE_KEY;\n  if (!apiKey) return "";');
ai=ai.replace('method: "POST",','method: "POST",\n      signal: AbortSignal.timeout(45000),');
fs.writeFileSync('src/lib/ai/openCodeClient.ts',ai);
let rag=fs.readFileSync('src/lib/ai/anythingLlmClient.ts','utf8');
rag='import { ragUrl } from "@/lib/server/config";\n'+rag.replace(/const BASE_URL = [^;]+;/,'const BASE_URL = ragUrl;').replace(/const API_KEY = [^;]+;/,'const API_KEY = process.env.ANYTHINGLLM_API_KEY || "";');
rag=rag.replace(/headers: this.getHeaders\(\),/g,'headers: this.getHeaders(),\n      signal: AbortSignal.timeout(45000),');
fs.writeFileSync('src/lib/ai/anythingLlmClient.ts',rag);
for(const file of ['README.md','.env.example','vps-engine/app.py']) {
  let s=fs.readFileSync(file,'utf8');
  // Remove copied credentials; never print their values.
  s=s.replace(/sk-[A-Za-z0-9_-]{24,}/g,'<CONFIGURAR_EN_ENTORNO>').replace(/JWYTE8H-[A-Za-z0-9-]+/g,'<CONFIGURAR_EN_ENTORNO>');
  fs.writeFileSync(file,s);
}
