const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');const {randomUUID}=require('node:crypto');
const memory=new Map();const store={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
let templates=[];
let online=true;let cloud=null;let revision;let writes=0;
const fetchMock=async (_url,init)=>{
 if(!online)throw Error('sin conexión');
 if(init.method==='POST'){
  const body=JSON.parse(init.body);
  if(body.action==='SAVE_EXPEDIENTE'){cloud=body.data;revision=randomUUID();writes++;return {ok:true,json:async()=>({success:true,revision})};}
  if(body.action==='SAVE_PLANTILLA'){templates=[{...body.data,contenido_plantilla:body.data.datos_completos}];return {ok:true,json:async()=>({success:true})};}
  if(body.action==='CREATE_EXPEDIENTE')return {ok:true,json:async()=>({success:true,carpetas:[{id:randomUUID(),adquisicion_id:body.data.id,numero:1,documentos:[]}]})};
  throw Error('Unexpected '+body.action);
 }
 return {ok:true,json:async()=>({success:true,adquisiciones:[cloud.adquisicion],carpetas:[],documentos:[],plantillas:templates,logs:[],states:[{revision,snapshot:cloud}]})};
};
function load(file){const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const module={exports:{}};const context={module,exports:module.exports,require:p=>p.includes('initialData')?load('src/lib/store/initialData.ts'):require(p),window:new EventTarget(),localStorage:store,navigator:{},crypto:{randomUUID},Event,CustomEvent,fetch:fetchMock,AbortSignal,console,setTimeout,URL,Blob};vm.runInNewContext(source,context,{filename:file});return module.exports;}
async function main(){
 const {DataStore:db}=load('src/lib/store/dataStore.ts');
 const id=randomUUID();store.setItem('ende_adquisiciones_v2026',JSON.stringify([{id,codigo:'TEST',items:[],titulo_proceso:'Prueba'}]));
 store.setItem('ende_carpetas_v2026',JSON.stringify([{id:'f1',adquisicion_id:id,numero:1,orden:1,documentos:[]},{id:'f5',adquisicion_id:id,numero:5,orden:2,documentos:[]}]));
 online=false;await db.updateAdquisicion(id,{memo_pago_banco_cuenta:'TEST',items:[{descripcion:'conservado'}]});await db.flushPending();assert.equal(db.pendingCount(),1);assert.equal(db.getAdquisicionById(id).memo_pago_banco_cuenta,'TEST');
 const failure=await db.syncWithSupabase();assert.equal(failure.success,false);assert.equal(db.getAdquisicionById(id).items[0].descripcion,'conservado');console.log('PASS sin conexión conserva cambios y cola');
 online=true;await db.flushPending();assert.equal(db.pendingCount(),0);assert.equal(cloud.adquisicion.memo_pago_banco_cuenta,'TEST');
 const moved=db.moveCarpetaUp(id,'f5');await db.flushPending();assert.equal(moved[0].numero,5);assert.equal(db.getAllCarpetas().find(f=>f.id==='f1').numero,1);assert.equal(db.deleteCarpeta('f1'),false);console.log('PASS reordenar no cambia la función oficial');
 const custom=db.addCarpeta(id,'Respaldo');await db.flushPending();assert.equal(custom.tipo_generacion,'MANUAL');assert.equal(db.deleteCarpeta(custom.id),true);await db.flushPending();
 await db.saveCamposExtraidos(id,[{id:'field',documento_id:'document',adquisicion_id:'CODIGO',clave:'NIT',valor:'123'}]);await db.flushPending();assert.equal(cloud.campos[0].adquisicion_id,id);
 const {DataStore:reloaded}=load('src/lib/store/dataStore.ts');await reloaded.syncWithSupabase();assert.equal(reloaded.getAdquisicionById(id).memo_pago_banco_cuenta,'TEST');assert.equal(reloaded.getCamposExtraidos(id).length,1);console.log('PASS recuperación tras recarga y asociación de campos');
 const {parseOcrDocument}=load('src/lib/ocr/ocrParser.ts');const empty=parseOcrDocument('cotizacion.pdf',4,'TEST','Prueba','');assert.equal(empty.campos.length,0);assert.equal(empty.esValido,false);console.log('PASS ningún dato inventado sin texto');
 db.updateCarpeta('f1',{estado:'Pendiente'});
 await db.addDocumentToCarpeta('f1',{id:'assistant-draft',carpeta_id:'f1',adquisicion_id:id,tipo:'GENERADO_DOCX',nombre_original:'Borrador.docx',estado:'Borrador',metadata:{assistant:true,sources:[{id:'norma-1'}]},creado_por:'Prueba'},false);
 assert.equal(db.getAllCarpetas().find(c=>c.id==='f1').estado,'En Proceso');
 await db.flushPending();
 assert.equal(cloud.carpetas.find(c=>c.id==='f1').documentos[0].metadata.sources[0].id,'norma-1');
 console.log('PASS borrador del asistente conserva fundamento y no completa la carpeta');
 const template=db.getPlantillas().find(p=>p.fk_carpeta===2);
 await db.updatePlantilla(template.id,{datos_completos:{officialPeopleByCompany:{ende:{fields:{solicitante:'Oficial A'}}}}});
 const first=await db.createAdquisicion({codigo:'NUEVO-1',titulo_proceso:'Nueva compra',items:[],empresa_id:'ende'});
 assert.equal(first.success,true);assert.equal(first.data.responsables_oficiales[2].solicitante,'Oficial A');await db.flushPending();
 assert.equal(cloud.adquisicion.responsables_oficiales[2].solicitante,'Oficial A');
 await db.updatePlantilla(template.id,{datos_completos:{officialPeopleByCompany:{ende:{fields:{solicitante:'Oficial B'}}}}});
 assert.equal(db.getAdquisicionById(first.data.id).responsables_oficiales[2].solicitante,'Oficial A');
 const second=await db.createAdquisicion({codigo:'NUEVO-2',titulo_proceso:'Otra compra',items:[],empresa_id:'otra'});
 assert.equal(second.success,true);assert.equal(second.data.responsables_oficiales[2].solicitante,undefined);await db.flushPending();
 console.log('PASS datos oficiales sincronizados, próximos expedientes, histórico intacto y separación entre empresas');
 assert.ok(writes>0);console.log('Pruebas locales completas.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
