const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),Module=require('module'),ts=require('typescript');
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const resolve=Module._resolveFilename;Module._resolveFilename=function(name,...args){return resolve.call(this,name.startsWith('@/')?path.join(process.cwd(),'src',name.slice(2)):name,...args)};
let calls=0,reply={changes:{lugar:'Almacén central'}};
const load=Module._load;Module._load=function(name,...args){if(name.endsWith('/ai/openCodeClient'))return {callOpenCodeGo:async()=>{calls++;return JSON.stringify(reply)},extractJsonFromText:JSON.parse};return load.call(this,name,...args)};
const {fixedModel}=require('../src/lib/docx/fixedModels.ts');
const {seedFixedDraft}=require('../src/lib/server/fixedDocuments.ts');
const {reviseFixedDocument}=require('../src/lib/server/reviseFixedDocument.ts');
async function main(){
 const adq={id:'revision-test',empresa_id:'ende',titulo_proceso:'Compra ficticia',items:[],plazo_entrega_dias:10};
 const draft=seedFixedDraft(1,adq);draft.fields.plazo='10 días calendario desde la orden de compra.';draft.editedFields=['plazo'];draft.sources=[{id:'fuente-1',title:'Referencia',excerpt:'Texto de referencia',page:'1',version:'1'}];
 const original=JSON.stringify(draft);
 const changed=await reviseFixedDocument(fixedModel(1),draft,'cambiar plazo a 45 dias por favor');
 assert.equal(changed.fields.plazo,'45 días calendario desde la orden de compra.');assert.equal(calls,0);assert.equal(JSON.stringify(draft),original);assert.deepEqual(changed.sources,draft.sources);assert.deepEqual(changed.items,draft.items);
 for(const key of Object.keys(draft.fields))if(key!=='plazo')assert.equal(changed.fields[key],draft.fields[key]);
 const {POST}=require('../src/app/api/fixed-documents/route.ts');
 const form=new FormData();form.append('request',JSON.stringify({action:'revise',number:1,adquisicion:adq,draft,context:'cambiar plazo a 45 dias por favor'}));
 const res=await POST(new Request('http://localhost/api/fixed-documents',{method:'POST',body:form}));assert.equal(res.status,200);const result=await res.json();assert.ok(result.html.includes('45 días calendario desde la orden de compra.'));assert.equal(calls,0);
 const general=await reviseFixedDocument(fixedModel(1),draft,'Cambiar lugar a Almacén central');assert.equal(general.fields.lugar,'Almacén central');assert.equal(general.fields.plazo,draft.fields.plazo);assert.equal(calls,1);
 reply={changes:{multas:'Multa inventada'}};await assert.rejects(()=>reviseFixedDocument(fixedModel(1),draft,'Cambiar las multas'),/no es válida/);
 await assert.rejects(()=>reviseFixedDocument(fixedModel(1),draft,'cambiar plazo a 0 dias'),/mayor que cero/);
 console.log('PASS petición exacta sin adjuntos ni llamadas IA; vista actualizada, cláusula preservada, corrección acotada y normativa protegida');
}
main().catch(e=>{console.error(e);process.exitCode=1});
