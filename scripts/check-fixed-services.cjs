// Read-only connection check. Never log credentials or retrieved document text.
const fs=require('fs'),path=require('path'),Module=require('module'),ts=require('typescript');
require('@next/env').loadEnvConfig(process.cwd());
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const resolve=Module._resolveFilename;
Module._resolveFilename=function(name,...args){return resolve.call(this,name.startsWith('@/')?path.join(process.cwd(),'src',name.slice(2)):name,...args)};
const {AnythingLlmClient}=require('../src/lib/ai/anythingLlmClient.ts');
const {callOpenCodeGo}=require('../src/lib/ai/openCodeClient.ts');
const {companyKnowledge}=require('../src/lib/server/companyKnowledge.ts');
console.warn=()=>{};console.error=()=>{};
const originalFetch=global.fetch;
global.fetch=async(input,options)=>{
 const host=new URL(typeof input==='string'?input:input.url).hostname;
 try {
  const response=await originalFetch(input,options);
  let detail='';
  if(!response.ok){
   detail=(await response.clone().text()).slice(0,1500);
   const secrets=Object.entries(process.env).filter(([k,v])=>/KEY|TOKEN|SECRET|PASSWORD/.test(k)&&v?.length>8).map(([,v])=>v);
   const bearer=options?.headers?.Authorization?.replace(/^Bearer /,'');if(bearer)secrets.push(bearer);
   for(const secret of secrets)detail=detail.split(secret).join('[oculto]');
   detail=detail.replace(/eyJ[A-Za-z0-9_.-]+/g,'[oculto]').replace(/sk[-_][A-Za-z0-9_-]+/g,'[oculto]');
  }
  console.log(JSON.stringify({host,status:response.status,detail}));return response;
 }
 catch(e){console.log(JSON.stringify({host,error:e.name,code:e.cause?.code||null}));throw e;}
};
async function main(){
 const company=companyKnowledge();
 const checks=await Promise.allSettled([
  AnythingLlmClient.searchWorkspaceSources('Reglamento de adquisiciones de ENDE Deoruro versión condiciones métodos selección',company.workspace).then(r=>({service:'AnythingLLM',responded:true,sources:r.sources.length})),
  callOpenCodeGo([{role:'user',content:'Devuelve únicamente el JSON {"conexion":"ok"}.'}],0.1,128,30000).then(r=>({service:'OpenCode GO',responded:!!r})),
 ]);
 for(let i=0;i<checks.length;i++){const c=checks[i];console.log(JSON.stringify(c.status==='fulfilled'?c.value:{service:i?'OpenCode GO':'AnythingLLM',responded:false}));}
 console.log(JSON.stringify({service:'Vista PDF',configured:!!(process.env.DOCX_PREVIEW_URL&&process.env.DOCX_PREVIEW_KEY)}));
 if(process.argv.includes('--document')){
  const {seedFixedDraft,completeFixedDocument,renderFixedWord}=require('../src/lib/server/fixedDocuments.ts');
  const adq={id:'integration-example-20260910',empresa_id:'ende',codigo:'PRUEBA-NO-OFICIAL',titulo_proceso:'Adquisición de papel tamaño carta',categoria:'Bienes',responsable_proceso:'[PENDIENTE]',unidad_solicitante:'[PENDIENTE]',lugar_entrega:'Oruro',plazo_entrega_dias:10,prevision_presupuesto:0,items:[{id:'paper',item:1,descripcion:'Papel tamaño carta de 75 g/m²',unidad:'Resma de 500 hojas',cantidad:10,precioUnitarioEstimado:0,especificacionMinima:'Tamaño carta, 75 g/m², 500 hojas por resma'}]};
  const draft=await completeFixedDocument(1,adq,seedFixedDraft(1,adq),'Ejemplo de integración, no constituye una compra real. Se requieren diez resmas para impresión de documentos administrativos. No se conocen responsables ni presupuesto. Conserva esos datos pendientes.');
  const output=await renderFixedWord(1,draft);
  fs.mkdirSync('test-results/fixed-models/live',{recursive:true});
  fs.writeFileSync('test-results/fixed-models/live/tdr-prueba.docx',output.buffer);
  fs.writeFileSync('test-results/fixed-models/live/tdr-prueba.json',JSON.stringify(draft,null,2));
  console.log(JSON.stringify({document:'TDR de prueba',sources:draft.sources.length,items:draft.items.length,fields:Object.keys(draft.fields).length,bytes:output.buffer.length,normativeStatus:draft.normativeStatus}));
 }
}
main().catch(()=>{console.log('No se pudo completar la comprobación');process.exitCode=1;});
