const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),Module=require('module'),ts=require('typescript');
const live=process.argv.includes('--live');
if(live)require('@next/env').loadEnvConfig(process.cwd());
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const resolve=Module._resolveFilename;Module._resolveFilename=function(name,...args){return resolve.call(this,name.startsWith('@/')?path.join(process.cwd(),'src',name.slice(2)):name,...args)};
let draftReply={},extractCalls=0;
if(live){const load=Module._load;let responseNumber=0;Module._load=function(name,...args){const actual=load.call(this,name,...args);if(name.endsWith('/ai/openCodeClient'))return{...actual,callOpenCodeGo:async(...params)=>{const raw=await actual.callOpenCodeGo(...params);const dir='test-results/fixed-models/assistant-live';fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(`${dir}/response-${++responseNumber}.txt`,raw);return raw;}};return actual;};}
if(!live){const load=Module._load;Module._load=function(name,...args){
 if(name.endsWith('/ai/openCodeClient'))return{extractJsonFromText:JSON.parse,callOpenCodeGo:async(messages)=>{if(messages[0].content.startsWith('Organiza'))return JSON.stringify({purpose:'Imprimir documentos administrativos',location:'Oruro',deliveryDays:'10',items:[{descripcion:'Papel carta',cantidad:'10',unidad:'Resma',especificaciones:'75 g/m²',precio:'35'}],facts:[],conflicts:[],details:{destino:'Archivo',invalido:'No conservar'}});if(messages[0].content.includes('EXTRACT_DOCUMENT_EVIDENCE')){extractCalls++;return JSON.stringify({facts:[],missing:[],conflicts:[]});}return JSON.stringify(draftReply);}};
 if(name.endsWith('/ai/anythingLlmClient'))return{AnythingLlmClient:{searchWorkspaceSources:async()=>({sources:[]})}};
 return load.call(this,name,...args);
};}
const {analyzePurchaseBrief}=require('../src/lib/server/purchaseAssistant.ts');
const {briefProblems,briefUpdates}=require('../src/lib/docx/purchaseBrief.ts');
const {seedFixedDraft,completeFixedDocument,renderFixedWord}=require('../src/lib/server/fixedDocuments.ts');
async function main(){
 if(process.argv.includes('--render-only')){for(const number of [1,2,3,4]){const dir='test-results/fixed-models/assistant-live';const draft=JSON.parse(fs.readFileSync(`${dir}/${number}.json`));draft.modelVersion=require("../src/lib/docx/fixedModels.ts").fixedModel(number).version;const output=await renderFixedWord(number,draft);fs.writeFileSync(`${dir}/${number}.docx`,output.buffer);fs.writeFileSync(`${dir}/${number}.json`,JSON.stringify(draft,null,2));}return;}
 let adq={id:'assistant-integration-ficticia',codigo:'PRUEBA-NO-OFICIAL',empresa_id:'ende',titulo_proceso:'Adquisición de papel tamaño carta',categoria:'Bienes',responsable_proceso:'Responsable de prueba',unidad_solicitante:'Administración',lugar_entrega:'Almacén de Oruro',plazo_entrega_dias:10,prevision_presupuesto:0,items:[]};
 const brief=await analyzePurchaseBrief(adq,'Caso ficticio para probar el sistema. Se necesitan 10 resmas de papel tamaño carta de 75 g/m², cada resma de 500 hojas, para imprimir documentos administrativos. Precio unitario estimado: 35 Bs. Plazo 10 días calendario. Lugar: Almacén de Oruro. No hay proveedor elegido, no consta verificación de almacén ni aprobación presupuestaria.',[]);
 assert.equal(brief.items.length,1);assert.equal(Number(brief.items[0].cantidad),10);assert.ok(!brief.details.invalido);
 brief.confirmedAt=new Date().toISOString();brief.revision='test-revision';
 assert.deepEqual(briefProblems(brief),[]);
 assert.ok(briefProblems({...brief,purpose:''}).length);assert.ok(briefProblems({...brief,items:[{...brief.items[0],cantidad:'0'}]}).length);
 assert.ok(briefProblems({...brief,conflicts:['Dos cantidades distintas'],clarification:''}).length);
 adq={...adq,...briefUpdates(adq,brief)};
 assert.equal(adq.prevision_presupuesto,350);
 const dir='test-results/fixed-models/assistant'+(live?'-live':'');fs.mkdirSync(dir,{recursive:true});
 for(const number of [1,2,3,4]){
   const current=seedFixedDraft(number,adq);
   if(!live && number===1){current.editedItems=true;current.items[0].especificaciones='Especificación corregida manualmente';}
   if(!live){draftReply={fields:current.fields,sourceIds:{},warnings:[]};if(number===4){current.fields.cuerpo='Texto corregido por el usuario';current.editedFields=['cuerpo'];}}
   const draft=await completeFixedDocument(number,adq,current,'');
   if([1,3].includes(number)){assert.equal(draft.items.length,1);assert.equal(draft.items[0].cantidad,'10');}
   else assert.equal(draft.items.length,0);
   if(!live && number===1){assert.equal(draft.items[0].especificaciones,'Especificación corregida manualmente');assert.equal(draft.editedItems,true);}
   if(number===3)assert.equal(draft.fields.presupuesto,'350.00');
   if(number===4&&!live)assert.equal(draft.fields.cuerpo,'Texto corregido por el usuario');
   const output=await renderFixedWord(number,draft);fs.writeFileSync(`${dir}/${number}.docx`,output.buffer);fs.writeFileSync(`${dir}/${number}.json`,JSON.stringify(draft,null,2));
   adq={...adq,borradores_ia:{...adq.borradores_ia,[number]:{draft,briefRevision:brief.revision,updatedAt:new Date().toISOString()}}};
   console.log(`PASS carpeta ${number}: Word generado, ${draft.items.length} ítems, ${draft.sources.length} fuentes, ${Object.values(draft.fields).filter(v=>/PENDIENTE/.test(v)).length} campos por confirmar`);
 }
 if(!live)assert.equal(extractCalls,0,'No debe repetir la lectura de los mismos antecedentes en cada carpeta');
 console.log('PASS ficha común, cantidades coherentes, totales, conservación de correcciones y generación de las cuatro carpetas');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
