const assert = require('node:assert/strict');
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const mammoth = require('mammoth');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
async function request(path, body) {
 const res = await fetch(base+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(120000)});
 const json=await res.json(); assert.ok(res.ok, JSON.stringify(json)); return json;
}
async function main() {
 const initial=await request('/api/db/sync'); console.log('PASS carga de expedientes:',initial.adquisiciones.length);
 const blocked=await fetch(base+'/api/db/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'DELETE',table:'adquisiciones'})}); assert.equal(blocked.status,400); console.log('PASS rechazo de operaciones masivas');
 const id=randomUUID(); const now=new Date().toISOString();
 const adq={id,codigo:'TEST-'+Date.now(),titulo_proceso:'PRUEBA AUTOMATIZADA - NO TRAMITAR',categoria:'Bienes',modalidad:'Prueba',partida_presupuestaria:'39500',estado:'Iniciado',prevision_presupuesto:250,moneda:'BOB',fecha_inicio:now.slice(0,10),unidad_solicitante:'Pruebas',responsable_proceso:'OPERADOR DE PRUEBA',creado_por:'Prueba automatizada',fecha_creacion:now,fecha_actualizacion:now,plazo_entrega_dias:17,multa_diaria_porcentaje:0.25,lugar_entrega:'ALMACEN DE PRUEBA',antecedentes_texto:'ANTECEDENTE DE VERIFICACION PERSISTENTE',memo_pago_proveedor:'PROVEEDOR DE PRUEBA',memo_pago_nro_factura:'PRUEBA-1',memo_pago_monto_total:250,memo_pago_banco_cuenta:'CUENTA DE PRUEBA',items:[{id:randomUUID(),item:1,descripcion:'ITEM DE VERIFICACION',unidad:'Pza',cantidad:5,precioUnitarioEstimado:50,precioTotalEstimado:250,caracteristicasTecnicas:'ESPECIFICACION DE PRUEBA'}]};
 let created=false; let uploadedPath;
 try {
  const createdResult=await request('/api/db/sync',{action:'CREATE_EXPEDIENTE',data:adq}); created=true;
  assert.equal(createdResult.carpetas.length,8); assert.ok(createdResult.carpetas.every(c=>c.adquisicion_id===id && c.estado==='Pendiente'));
  console.log('PASS creación de ocho carpetas vinculadas');
  const snapshot={adquisicion:adq,carpetas:createdResult.carpetas.map(c=>({...c,documentos:[]})),campos:[],firmas:[],logs:[]};
  const saved=await request('/api/db/sync',{action:'SAVE_EXPEDIENTE',data:snapshot}); assert.ok(saved.revision);
  snapshot.adquisicion.memo_pago_banco_cuenta='CUENTA MODIFICADA';
  const updated=await request('/api/db/sync',{action:'SAVE_EXPEDIENTE',data:snapshot,revision:saved.revision});
  const conflict=await fetch(base+'/api/db/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'SAVE_EXPEDIENTE',data:snapshot,revision:saved.revision})}); assert.equal(conflict.status,409);
  const loaded=await request('/api/db/sync'); const state=loaded.states.find(s=>s.snapshot.adquisicion.id===id);
  assert.equal(state.revision,updated.revision); assert.equal(state.snapshot.adquisicion.memo_pago_banco_cuenta,'CUENTA MODIFICADA'); assert.equal(state.snapshot.adquisicion.items[0].cantidad,5);
  console.log('PASS persistencia completa y conflicto de edición');
  const text='Proveedor: EMPRESA DE PRUEBA\nNIT: 123456789\nTotal: 250.00 Bs.\nPlazo de entrega: 17 días';
  const form=new FormData();form.append('file',new Blob([text],{type:'text/plain'}),'prueba.txt');form.append('adquisicion_id',id);
  const uploadRes=await fetch(base+'/api/files',{method:'POST',body:form}); const upload=await uploadRes.json();assert.ok(uploadRes.ok,JSON.stringify(upload));uploadedPath=upload.path;
  const original=await fetch(base+upload.url);assert.equal(await original.text(),text);console.log('PASS almacenamiento y descarga íntegra del original');
  const ocr=new FormData();ocr.append('file',new Blob([text],{type:'text/plain'}),'prueba.txt');ocr.append('adquisicionCodigo',adq.codigo);ocr.append('carpetaNumero','4');ocr.append('adquisicionTitulo',adq.titulo_proceso);
  const extraction=await (await fetch(base+'/api/ocr/extract',{method:'POST',body:ocr})).json();assert.equal(extraction.result.campos.find(c=>c.clave==='NIT_PROVEEDOR').valor,'123456789');assert.ok(!extraction.result.campos.some(c=>c.clave==='ESTADO_NIT'));console.log('PASS extracción basada en el archivo');
  fs.mkdirSync('test-results',{recursive:true});
  for(const tipo of ['TDR','SOLICITUD_INICIO','FORM_S2','INFORME_CONFORMIDAD','MEMO_PAGO']) {
   const res=await fetch(base+'/api/docx/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tipo,adquisicion:adq})});assert.ok(res.ok,tipo+' '+res.status);
   const buffer=Buffer.from(await res.arrayBuffer()); assert.equal(buffer.subarray(0,2).toString(),'PK');
   const {value}=await mammoth.extractRawText({buffer}); assert.ok(value.length>150); assert.ok(!value.includes('undefined'),tipo+' undefined');
   fs.writeFileSync('test-results/'+tipo+'.docx',buffer);console.log('PASS Word',tipo,buffer.length,'bytes');
  }
  const inspectForm=new FormData();inspectForm.append('file',new Blob([fs.readFileSync('test-results/TDR.docx')]),'TDR.docx');
  const inspect=await (await fetch(base+'/api/docx/inspect',{method:'POST',body:inspectForm})).json();assert.ok(inspect.success,JSON.stringify(inspect));console.log('PASS inspección de plantilla Word');
 } finally {
  if(created) await request('/api/db/sync',{action:'DELETE_EXPEDIENTE',id});
  if(uploadedPath) {
   require('@next/env').loadEnvConfig(process.cwd());
   const {createClient}=require('@supabase/supabase-js');const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/rest\/v1\/?$/,''),process.env.SUPABASE_SERVICE_ROLE_KEY);
   const cleanup=await db.storage.from('expedientes-docs').remove([uploadedPath]); if(cleanup.error) console.log('Aviso: archivo de prueba pendiente de limpieza');
  }
 }
 const final=await request('/api/db/sync');assert.equal(final.adquisiciones.length,initial.adquisiciones.length);console.log('PASS limpieza de datos de prueba; expedientes originales conservados');
}
main().catch(e=>{console.error('FAIL',e.message);process.exitCode=1;});
