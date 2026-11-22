const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),Module=require('module'),ts=require('typescript'),JSZip=require('jszip');
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const resolve=Module._resolveFilename;Module._resolveFilename=function(name,...args){return resolve.call(this,name.startsWith('@/')?path.join(process.cwd(),'src',name.slice(2)):name,...args);};
const {seedFixedDraft,normalizeFixedDraft,renderFixedWord}=require('../src/lib/server/fixedDocuments.ts');
const {fixedModel}=require('../src/lib/docx/fixedModels.ts');
const adq={id:'tdr-title-regression',empresa_id:'ende',codigo:'PRUEBA',titulo_proceso:'Adquisición de herramientas para línea viva',categoria:'Bienes',responsable_proceso:'Responsable',unidad_solicitante:'Área técnica',lugar_entrega:'Oruro',plazo_entrega_dias:20,prevision_presupuesto:1000,items:['Montacargas con dos poleas dobles','Cuna para cadena de aisladores','Desarmador plano','Abrazaderas ajustables','Pasteca de una vía','Gancho para pértigas','Tijera cortacable'].map((descripcion,index)=>({id:'item-'+index,item:index+1,descripcion,unidad:'Pza',cantidad:1,precioUnitarioEstimado:0,especificacionMinima:'Dato aportado'}))};
async function main(){
 const draft=seedFixedDraft(1,adq);assert.equal(draft.fields.objeto,adq.titulo_proceso);
 draft.fields.objeto='Adquisición de los bienes detallados en el presente documento';
 const normalized=normalizeFixedDraft(fixedModel(1),draft,adq);assert.equal(normalized.fields.objeto,adq.titulo_proceso);assert.equal(draft.fields.objeto,'Adquisición de los bienes detallados en el presente documento','No modificar la versión guardada');
 const output=await renderFixedWord(1,draft,adq),zip=await JSZip.loadAsync(output.buffer);
 for(const name of ['word/document.xml','word/header1.xml']){const xml=await zip.file(name).async('string');assert.ok(xml.includes(adq.titulo_proceso),name+' usa el mismo título concreto');assert.ok(!xml.includes('los bienes detallados en el presente documento'));}
 const coverPurchase={...adq,fecha_inicio:'2026-11-01',items:[
   {descripcion:'Botín dieléctrico',cantidad:100,unidad:'PAR',especificacionMinima:'Uso industrial\nCaña alta'},
   {descripcion:'Botín dieléctrico',cantidad:150,unidad:'PAR',especificacionMinima:'Uso industrial\nCuero impermeable'},
 ]};
 coverPurchase.asistente_compra={preparedAt:'2026-11-01',details:{destino:'Personal administrativo (100 pares) y personal técnico (150 pares)'},items:coverPurchase.items.map(row=>({...row,cantidad:String(row.cantidad)}))};
 const oldCover=seedFixedDraft(1,coverPurchase);
 oldCover.fields.resumen='[PENDIENTE]';
 oldCover.fields.mes_anio='____________';
 const restored=await renderFixedWord(1,oldCover,coverPurchase);
 const restoredXml=await (await JSZip.loadAsync(restored.buffer)).file('word/document.xml').async('string');
 assert.equal(restored.draft.fields.resumen,
   'Se requieren dos variantes de botín dieléctrico. El ítem 1 comprende 100 pares (caña alta). El ítem 2 comprende 150 pares (cuero impermeable). Los ítems 1 y 2 se destinan, respectivamente, al personal administrativo y al personal técnico.');
 assert.ok(restoredXml.includes(restored.draft.fields.resumen),'Resumen insertado en la portada del Word');
 assert.match(restored.draft.fields.mes_anio,/noviembre.*2026/i);
 assert.equal(oldCover.fields.resumen,'[PENDIENTE]','Se conserva la versión guardada');
 const changed={...restored.draft,items:restored.draft.items.map((row,i)=>i?row:{...row,cantidad:'95'})};
 const revisedSummary=(await renderFixedWord(1,changed,coverPurchase)).draft.fields.resumen;
 assert.match(revisedSummary,/95 pares/);
 assert.ok(!revisedSummary.includes('100 pares'),'Las cantidades de destinatarios antiguos no pasan al nuevo resumen');
 changed.fields.resumen='Resumen elegido por la unidad solicitante';
 changed.editedFields=['resumen'];
 assert.equal((await renderFixedWord(1,changed,coverPurchase)).draft.fields.resumen,changed.fields.resumen);
 const manual={...draft,fields:{...draft.fields,objeto:'Nombre elegido por el usuario'},editedFields:['objeto']};assert.equal((await renderFixedWord(1,manual,adq)).draft.fields.objeto,manual.fields.objeto);
 const {completeTdrDraft}=require('../src/lib/docx/completeTdrDraft.ts');
 const notes=[
   'ANTECEDENTE DE ESTE EXPEDIENTE (TDR de botines.pdf):','ESPECIFICACIONES TÉCNICAS','Botines para ENDE DEORURO S.A.',
   'Elaborado Revisado Aprobado','Ing. Ana Sol - Unidad solicitante','Lic. José Paz - Revisor','Ing. Eva Cruz - Gerencia',
   'RESUMEN','Botines requeridos','7. VIGENCIA DE LA PROPUESTA','Mínimo 15 días desde la apertura.','8. CATEGORÍA','Bienes',
   '13. FORMA DE PAGO','Contra entrega y presentación de factura.','14. APLICACIÓN DE MULTAS',
 ].join('\n');
 const referencePurchase={...coverPurchase,asistente_compra:{...coverPurchase.asistente_compra,notes}};
 const withReference=completeTdrDraft(1,oldCover,referencePurchase);
 assert.match(withReference.fields.elaborado,/Ana Sol/);
 assert.match(withReference.fields.aprobado,/Eva Cruz/);
 assert.equal(withReference.fields.vigencia,'Mínimo 15 días desde la apertura.');
 assert.equal(withReference.fields.pago,'Contra entrega y presentación de factura.');
 const referenceText='La unidad requiere botines para el personal que realiza inspecciones en subestaciones y visitas técnicas a las instalaciones de la empresa.';
 const source=notes.replace('Botines requeridos','100 pares y 150 pares de botines.\n1. ANTECEDENTES\n'+referenceText+'\n2. JUSTIFICACIÓN / NECESIDAD\nUso en campo.');
 const narrativePurchase={...referencePurchase,titulo_proceso:'Botines',asistente_compra:{...referencePurchase.asistente_compra,purpose:'Proteger al personal en campo.',notes:source}};
 const older={...oldCover,fields:{...oldCover.fields,antecedentes:'Se requieren los bienes descritos.',justificacion:narrativePurchase.asistente_compra.purpose},
   proposals:{antecedentes:{value:'Se requieren los bienes descritos.',reason:'Redacción propuesta para completar el borrador.'}}};
 const expanded=completeTdrDraft(1,older,narrativePurchase);
 assert.equal(expanded.fields.antecedentes,referenceText);
 assert.match(expanded.fields.justificacion,/personal en campo/i);
 assert.match(expanded.fields.justificacion,/Caña alta/i);
 assert.match(expanded.fields.justificacion,/Cuero impermeable/i);
 assert.ok(expanded.fields.justificacion.split(/\s+/).length>40);
 assert.equal(completeTdrDraft(1,{...older,editedFields:['justificacion']},narrativePurchase).fields.justificacion,older.fields.justificacion);
 const shortAI={...older,consultedAt:'2026-01-02',fields:{...older.fields,justificacion:'Se requiere uniformar la dotación entre turnos.'}};
 const enriched=completeTdrDraft(1,shortAI,narrativePurchase);
 assert.match(enriched.fields.justificacion,/uniformar la dotación entre turnos/);
 assert.equal(completeTdrDraft(1,enriched,narrativePurchase).fields.justificacion,enriched.fields.justificacion);
 const service={...adq,titulo_proceso:'Mantenimiento de medidores',categoria:'Servicios',items:[{...adq.items[0],descripcion:'Mantenimiento de medidores',especificacionMinima:'Inspección mensual'}]};
 const serviceDraft=completeTdrDraft(1,seedFixedDraft(1,service),service);
 assert.match(serviceDraft.fields.antecedentes,/medidores/);
 assert.match(serviceDraft.fields.justificacion,/mensual/);
 assert.match(serviceDraft.fields.aceptacion,/prestaciones verificadas/);
 assert.doesNotMatch(serviceDraft.fields.antecedentes+serviceDraft.fields.justificacion+serviceDraft.fields.aceptacion,/botines|subestaciones|orden de compra|recibir.*bienes/i);
 for(const unrelated of [notes.replaceAll('Botines','Cables'),notes+'\n'+notes]){
   const independent=completeTdrDraft(1,oldCover,{...referencePurchase,asistente_compra:{...referencePurchase.asistente_compra,notes:unrelated}});
   assert.doesNotMatch(independent.fields.aprobado,/Eva Cruz/);
   assert.notEqual(independent.fields.vigencia,withReference.fields.vigencia);
 }
 const keepManual={...withReference,fields:{...withReference.fields,vigencia:'60 días desde recepción'},editedFields:['vigencia']};
 assert.equal(completeTdrDraft(1,keepManual,referencePurchase).fields.vigencia,keepManual.fields.vigencia);
 const {POST}=require('../src/app/api/fixed-documents/route.ts');const form=new FormData();form.append('request',JSON.stringify({action:'export',number:1,adquisicion:adq,draft}));
 const response=await POST(new Request('http://test/api/fixed-documents',{method:'POST',body:form}));const result=await response.json();assert.equal(response.status,200,result.error);assert.equal(result.draft.fields.objeto,adq.titulo_proceso);assert.ok(result.docx);
 console.log('PASS TDR línea viva: título específico en portada y cabecera, reparación del borrador antiguo al exportar, siete ítems y edición manual conservados sin llamadas IA ni escrituras.');
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
