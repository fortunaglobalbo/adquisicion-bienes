const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),Module=require('module'),ts=require('typescript');
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const resolve=Module._resolveFilename;
Module._resolveFilename=function(name,...args){return resolve.call(this,name.startsWith('@/')?path.join(process.cwd(),'src',name.slice(2)):name,...args)};
process.env.OPENCODE_GO_API_KEY='unit-test-not-a-key';
process.env.ANYTHINGLLM_API_KEY='unit-test-not-a-key';
const calls=[];
global.fetch=async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify(url.includes('vector-search')?{results:[{text:'Condición normativa de prueba',metadata:{title:'Manual',page:4,version:'02'}}]}:{choices:[{message:{content:'{"ok":true}'}}]}),{status:200});};
const {AnythingLlmClient}=require('../src/lib/ai/anythingLlmClient.ts');
const {callOpenCodeGo}=require('../src/lib/ai/openCodeClient.ts');
async function main(){
 const result=await AnythingLlmClient.searchWorkspaceSources('selección','empresa-autorizada');
 assert.ok(calls[0].url.endsWith('/workspace/empresa-autorizada/vector-search'));
 assert.equal(JSON.parse(calls[0].options.body).topN,8);
 assert.equal(result.sources[0].page,'4');assert.equal(result.sources[0].version,'02');
 await assert.rejects(()=>AnythingLlmClient.searchWorkspaceSources('normas','../otra'));
 assert.equal(calls.length,1);
 for(let i=0;i<2;i++) await callOpenCodeGo([{role:'user',content:'prueba'}],0.1,100,1000,'stable-document-session');
 for(const call of calls.slice(1)){assert.equal(call.options.headers['x-opencode-session'],'stable-document-session');assert.equal(call.options.headers['User-Agent'],'ende-document-assistant/1.0');}
 console.log('PASS recuperación directa sin chat, metadatos, espacio inválido y sesión estable con identidad propia');
 global.fetch=async()=>new Response(JSON.stringify({choices:[{message:{content:''},finish_reason:'length'}],usage:{completion_tokens:100}}),{status:200});
 await assert.rejects(()=>callOpenCodeGo([{role:'user',content:'test'}],0.1,100,1000,'session',{strict:true}),/alcanzó su límite de respuesta/);
 global.fetch=async()=>new Response('{}',{status:429});
 await assert.rejects(()=>callOpenCodeGo([{role:'user',content:'test'}],0.1,100,1000,'session',{strict:true}),/límite de uso/);
 global.fetch=async()=>{throw new DOMException('timeout','TimeoutError');};
 await assert.rejects(()=>callOpenCodeGo([{role:'user',content:'test'}],0.1,100,1000,'session',{strict:true}),/tardó demasiado/);
 console.log('PASS distingue respuesta agotada, cuota y demora sin perder el borrador');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
