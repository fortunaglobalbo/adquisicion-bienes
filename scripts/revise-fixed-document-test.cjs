const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),Module=require('module'),ts=require('typescript');
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const resolve=Module._resolveFilename;Module._resolveFilename=function(name,...args){return resolve.call(this,name.startsWith('@/')?path.join(process.cwd(),'src',name.slice(2)):name,...args)};
let calls=0,replies=[],reply={changes:{lugar:'Almacén central'}};
const load=Module._load;Module._load=function(name,...args){if(name.endsWith('/ai/anythingLlmClient'))return {AnythingLlmClient:{searchWorkspaceSources:async()=>({sources:[]})}};if(name.endsWith('/ai/openCodeClient'))return {callOpenCodeGo:async()=>{calls++;return JSON.stringify(replies.length?replies.shift():reply)},extractJsonFromText:JSON.parse};return load.call(this,name,...args)};
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
 reply={changes:{multas:'Según el artículo 987 la multa será 9.9%'}};await assert.rejects(()=>reviseFixedDocument(fixedModel(1),draft,'Cambiar las multas'),/con certeza/);
 await assert.rejects(()=>reviseFixedDocument(fixedModel(1),draft,'cambiar plazo a 0 dias'),/mayor que cero/);

 // Old open tabs submit complete: the server must route the same correction to revision.
 const oldForm=new FormData();oldForm.append('request',JSON.stringify({action:'complete',number:1,adquisicion:adq,draft,context:'cambiar plazo a 45 dias por favor'}));
 const oldRes=await POST(new Request('http://localhost/api/fixed-documents',{method:'POST',body:oldForm}));assert.equal(oldRes.status,200);assert.equal((await oldRes.json()).draft.fields.plazo,changed.fields.plazo);
 const itemsDraft=structuredClone(draft);itemsDraft.items=[{numero:'1',descripcion:'Botines',cantidad:'10',unidad:'par',especificaciones:'Dieléctricos'},{numero:'2',descripcion:'Guantes',cantidad:'5',unidad:'par',especificaciones:'Cuero'}];
 reply={changes:{elaborado:'María Pérez'},itemChanges:[{action:'update',item:1,values:{cantidad:20}},{action:'remove',item:2},{action:'add',values:{descripcion:'Casco',cantidad:'3',unidad:'pza'}}]};
 const edited=await reviseFixedDocument(fixedModel(1),itemsDraft,'Cambia responsable, cantidad, elimina guantes y añade cascos');
 assert.equal(edited.fields.elaborado,'María Pérez');assert.equal(edited.items[0].cantidad,'20');assert.equal(edited.items[0].especificaciones,'Dieléctricos');assert.equal(edited.items[1].descripcion,'Casco');assert.equal(edited.items[1].numero,'2');assert.equal(itemsDraft.items.length,2);assert.equal(itemsDraft.items[0].cantidad,'10');
 replies=[{changes:{clave_inventada:'No'}},{fields:{lugar:'Nuevo almacén'}}];assert.equal((await reviseFixedDocument(fixedModel(1),draft,'Cambia el almacén')).fields.lugar,'Nuevo almacén');
 reply={changes:{elaborado:'No debe aplicarse'},itemChanges:[{action:'remove',item:99}]};await assert.rejects(()=>reviseFixedDocument(fixedModel(1),itemsDraft,'Cambia varios datos'),/con certeza/);assert.equal(itemsDraft.fields.elaborado,draft.fields.elaborado);
 reply={question:'¿Cuántos cascos necesitas?',changes:{},itemChanges:[]};
 const qForm=new FormData();qForm.append('request',JSON.stringify({action:'revise',number:1,adquisicion:adq,draft,context:'Añade cascos'}));
 const qRes=await POST(new Request('http://localhost/api/fixed-documents',{method:'POST',body:qForm}));assert.equal(qRes.status,200);const q=await qRes.json();assert.equal(q.question,'¿Cuántos cascos necesitas?');assert.deepEqual(q.draft,draft);
 console.log('PASS edición múltiple, filas añadidas/eliminadas, reparación de respuesta, pregunta conversacional y protección atómica');
 console.log('PASS petición exacta sin adjuntos ni llamadas IA; vista actualizada, cláusula preservada, corrección acotada y normativa protegida');
}
main().catch(e=>{console.error(e);process.exitCode=1});
