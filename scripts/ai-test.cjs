const fs=require('fs');const assert=require('node:assert/strict');
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:3000';
const adquisicion={id:'test',codigo:'PRUEBA-IA',titulo_proceso:'ADQUISICION DE CINCO ALICATES',categoria:'Bienes',modalidad:'Menor Precio',estado:'Iniciado',partida_presupuestaria:'39500',prevision_presupuesto:250,moneda:'BOB',fecha_inicio:'2026-09-06',unidad_solicitante:'Pruebas',responsable_proceso:'OPERADOR DE PRUEBA',plazo_entrega_dias:17,lugar_entrega:'ALMACEN DE PRUEBA',multa_diaria_porcentaje:0.25,items:[{id:'item',item:1,descripcion:'Alicate universal',unidad:'Pza',cantidad:5,precioUnitarioEstimado:50,precioTotalEstimado:250,caracteristicasTecnicas:'Acero; mango aislado'}]};
async function main(){
 for(const route of ['generate-tdr','generate-solicitud-inicio','generate-s2','generate-informe-conformidad','generate-memo-pago']){
  const res=await fetch(base+'/api/ai/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({adquisicion,insumoTexto:'Se requieren 5 alicates universales de acero con mango aislado; cantidad cinco; entrega 17 días. No existe proveedor adjudicado ni factura ni cuenta bancaria. NO inventar datos.'}),signal:AbortSignal.timeout(120000)});
  const data=await res.json();assert.ok(res.ok && data.success,route+': '+JSON.stringify(data));assert.ok(data.data && Object.keys(data.data).length,route);
  fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/'+route+'.json',JSON.stringify(data,null,2));
  console.log('PASS',route,'respuesta estructurada',route==='generate-tdr'?'items='+data.data.items?.length:'');
 }
 const form=new FormData();form.append('file',new Blob([fs.readFileSync('test-results/TDR.docx')]),'TDR.docx');form.append('fk_carpeta','1');
 const transpiled=await (await fetch(base+'/api/docx/transpile',{method:'POST',body:form})).json();assert.ok(transpiled.success && transpiled.data.plantilla);console.log('PASS transpilación');
 const fill=new FormData();fill.append('file',new Blob([fs.readFileSync('test-results/TDR.docx')]),'TDR.docx');fill.append('data_json',JSON.stringify({replacements:{'ANTECEDENTE DE VERIFICACION PERSISTENTE':'TEXTO RELLENADO DE PRUEBA'}}));
 const filled=await (await fetch(base+'/api/docx/smart-fill',{method:'POST',body:fill})).json();assert.ok(filled.success,JSON.stringify(filled));assert.ok(filled.download_url.startsWith('/api/'));
 const download=await fetch(base+filled.download_url);assert.ok(download.ok);const buffer=Buffer.from(await download.arrayBuffer());assert.equal(buffer.subarray(0,2).toString(),'PK');console.log('PASS autollenado y descarga mediante proxy');
 const rag=await (await fetch(base+'/api/anythingllm')).json();assert.ok(rag.success);console.log('PASS conexión AnythingLLM');
}
main().catch(e=>{console.error('FAIL',e.message);process.exitCode=1;});
