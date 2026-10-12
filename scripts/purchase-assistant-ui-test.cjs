// Isolated browser and intercepted services. This test never writes to the real database or calls an AI provider.
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),Module=require('module'),ts=require('typescript');
const {chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const resolve=Module._resolveFilename;Module._resolveFilename=function(name,...args){return resolve.call(this,name.startsWith('@/')?path.join(process.cwd(),'src',name.slice(2)):name,...args);};
const load=Module._load;Module._load=function(name,...args){
 if(name.endsWith('/ai/openCodeClient'))return {callOpenCodeGo:async()=>{throw Error('El test UI no puede llamar a un proveedor de IA.');},extractJsonFromText:JSON.parse};
 if(name.endsWith('/ai/anythingLlmClient'))return {AnythingLlmClient:{searchWorkspaceSources:async()=>{throw Error('El test UI no puede consultar la biblioteca real.');}}};
 return load.call(this,name,...args);
};
const {seedFixedDraft,renderFixedWord}=require('../src/lib/server/fixedDocuments.ts');
const {wordFormPreview}=require('../src/lib/server/wordFormPreview.ts');
const {editableDocumentPreview}=require('../src/lib/server/editableDocumentPreview.ts');
const {fixedModel}=require('../src/lib/docx/fixedModels.ts');
const mammoth=require('mammoth');
const url=process.env.ASSISTANT_UI_URL||'http://127.0.0.1:3000';
const output='test-results/assistant-ui';fs.mkdirSync(output,{recursive:true});
const now=new Date().toISOString();
function fixture(id){const adquisicion={id,codigo:'PRUEBA-UI',titulo_proceso:'Adquisición de papel tamaño carta',empresa_id:'ende',categoria:'Bienes',modalidad:'Por definir',partida_presupuestaria:'',estado:'Iniciado',prevision_presupuesto:350,moneda:'BOB',fecha_inicio:now.slice(0,10),unidad_solicitante:'Administración',responsable_proceso:'Responsable de prueba',creado_por:'Prueba',fecha_creacion:now,fecha_actualizacion:now,lugar_entrega:'Almacén de Oruro',plazo_entrega_dias:10,items:[]};return {adquisicion,carpetas:[1,2,3,4,5,6,7,8].map(n=>({id:`${id}-folder-${n}`,adquisicion_id:id,numero:n,nombre:['TDR','Solicitud S1','Cuadro de justificación','Solicitud de cotización','Inicio','Evaluación','Conformidad','Pago'][n-1],tipo_generacion:'IA',estado:'Pendiente',documentos:[],orden:n})),campos:[],firmas:[],logs:[]};}
function requestPayload(request){const body=request.postData()||'';const match=body.match(/name="request"\r?\n(?:Content-Type:[^\r\n]+\r?\n)?\r?\n([\s\S]*?)\r?\n--/);assert.ok(match,'Se espera la petición JSON en el formulario');return JSON.parse(match[1]);}
function deferred(){let release;const promise=new Promise(resolve=>{release=resolve;});return {promise,release};}
async function setup(browser,id,{quantity='10',conflicts=[],resolvedQuantity='7',failure=0,pauseReading=false,pauseGeneration=0,pauseSync=false,existingDrafts=false}={}){
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
 page.setDefaultTimeout(60000);
 let snapshot=fixture(id),templates=[],revision='initial';const errors=[],calls=[],reads=[],writes=[],attachmentNames=[];let failNumber=failure;
 const readingBlock=deferred(),generationBlock=deferred(),syncBlock=deferred(),readingStarted=deferred(),readingPaused=deferred(),generationPaused=deferred(),syncPaused=deferred(),readingReturned=deferred(),pausedReadingReturned=deferred(),generationReturned=deferred();let syncBlocked=false;
 if(existingDrafts){const draft=seedFixedDraft(3,snapshot.adquisicion);draft.fields.justificacion='Borrador anterior conservado en la prueba';snapshot.adquisicion.borradores_ia={'3':{draft,briefRevision:'old-brief',updatedAt:now}};}
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',route=>route.fulfill({status:403,json:{error:'Servicio bloqueado en la prueba aislada'}}));
 await page.route('**/api/db/sync',async route=>{
  if(route.request().method()==='POST'){const body=route.request().postDataJSON();writes.push(body);if(body.action==='SAVE_PLANTILLA')templates=[{...body.data,contenido_plantilla:body.data.datos_completos}];else{assert.equal(body.action,'SAVE_EXPEDIENTE');assert.equal(body.data.adquisicion.id,id);snapshot=body.data;if(pauseSync&&!syncBlocked&&Object.keys(snapshot.adquisicion.borradores_ia||{}).length===5){syncBlocked=true;syncPaused.release();await syncBlock.promise;}}revision=crypto.randomUUID();await route.fulfill({json:{success:true,revision}});}
  else await route.fulfill({json:{success:true,adquisiciones:[snapshot.adquisicion],carpetas:snapshot.carpetas,documentos:[],logs:[],plantillas:templates,states:[{revision,snapshot}]}});
 });
 await page.route('**/api/files',async route=>{assert.equal(route.request().method(),'POST');await route.fulfill({json:{path:'test/S1.docx'}});});
 await page.route('**/api/fixed-documents',async route=>{
  const body=requestPayload(route.request());
  if(body.action==='analyze'){
   reads.push(body);attachmentNames.push([...(route.request().postData()||'').matchAll(/filename="([^"]+)"/g)].map(match=>match[1]));readingStarted.release();
   const paused=pauseReading===true||pauseReading===reads.length;if(paused){readingPaused.release();await readingBlock.promise;}
   const clarified=conflicts.length>0&&reads.length>1;
   await route.fulfill({json:{brief:{revision:'',confirmedAt:null,notes:body.context,purpose:'Impresión de documentos administrativos',location:'Almacén de Oruro',deliveryDays:'10',items:[{descripcion:'Papel tamaño carta',cantidad:clarified?resolvedQuantity:quantity,unidad:'resma',especificaciones:'75 g/m², 500 hojas por resma',precio:'35'}],facts:[],conflicts:clarified?[]:conflicts,clarification:'',details:{},suggestions:[{field:'purpose',value:'Impresión de documentos administrativos',reason:'Finalidad propuesta a partir del producto; editable.'}]}}}).catch(()=>{});readingReturned.release();if(paused)pausedReadingReturned.release();return;
  }
  let draft=body.draft||seedFixedDraft(body.number,body.adquisicion);
  if(body.action==='complete'){
   calls.push(body.number);if(body.number===pauseGeneration){generationPaused.release();await generationBlock.promise;}if(body.number===failNumber){failNumber=0;await route.fulfill({status:503,json:{error:'Fallo temporal simulado'}});return;}
   draft=seedFixedDraft(body.number,body.adquisicion);if(body.number===1){draft.fields.justificacion=body.adquisicion.asistente_compra.purpose;draft.fields.seleccion='Menor precio entre propuestas que cumplan los requisitos mínimos.';draft.proposals={seleccion:{value:draft.fields.seleccion,reason:'Sugerencia para revisar; no es una decisión del usuario.'}};}
  }
  if(body.action==='revise'){assert.match(body.context,/45/);draft={...draft,fields:{...draft.fields,plazo:'45 días calendario'},editedFields:[...(draft.editedFields||[]),'plazo']};}
  const rendered=await renderFixedWord(body.number,draft);const html=body.number===2?await wordFormPreview(rendered.buffer):(await mammoth.convertToHtml({buffer:rendered.buffer})).value;
  const editableHtml=await editableDocumentPreview(rendered.buffer,rendered.draft,fixedModel(body.number),html);
  await route.fulfill({json:{draft:rendered.draft,html,editableHtml,pdf:null,previewWarning:'',...(body.action==='revise'?{revised:true,revisionSummary:['Plazo actualizado a 45 días']}:{}),...(body.action==='export'?{docx:rendered.buffer.toString('base64')}: {})}}).catch(()=>{});
  if(body.action==='complete'&&body.number===pauseGeneration)generationReturned.release();
 });
 await page.goto(`${url}/expediente/${id}`);
 return {page,context,errors,calls,reads,writes,attachmentNames,releaseReading:readingBlock.release,releaseGeneration:generationBlock.release,releaseSync:syncBlock.release,readingStarted:readingStarted.promise,readingPaused:readingPaused.promise,generationPaused:generationPaused.promise,syncPaused:syncPaused.promise,readingReturned:readingReturned.promise,pausedReadingReturned:pausedReadingReturned.promise,generationReturned:generationReturned.promise,get snapshot(){return snapshot;},get templates(){return templates;}};
}
const quoteFile=()=>({name:'cotizacion.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nCotización ficticia para test de interfaz')});
async function uploadAndCreate(page,files=[quoteFile()]){await page.getByLabel('Cotización, PDF o foto',{exact:true}).setInputFiles(files);}
async function documentsPrepared(page){await page.getByRole('dialog').filter({hasText:'Documentos preparados'}).waitFor({timeout:30000});await page.getByRole('button',{name:'Continuar',exact:true}).click();await page.getByText('Documentos preparados. Edita el texto directamente en cada documento.',{exact:true}).waitFor();}
async function assertSimpleAssistant(page){for(const name of ['Leer y revisar primero','Usar los datos del expediente','Preparar documentos con estos datos','Crear documentos con IA'])assert.equal(await page.getByRole('button',{name,exact:true}).count(),0,`Ya no debe aparecer ${name}`);for(const text of ['Ver resultados por carpeta','Otros datos disponibles (opcional)','Características y precio estimado'])assert.equal(await page.getByText(text,{exact:true}).count(),0);assert.equal(await page.getByRole('textbox',{name:'Cantidad 1',exact:true}).count(),0,'No debe reaparecer el formulario técnico');}
async function dismissCancelled(page){await page.getByRole('dialog').filter({hasText:'Proceso cancelado'}).waitFor();await page.getByRole('button',{name:'Continuar',exact:true}).click();await page.getByText('Proceso cancelado. Los archivos y los documentos preparados se conservan.',{exact:true}).waitFor();}
async function dropFiles(page,files){const transfer=await page.evaluateHandle(files=>{const data=new DataTransfer();for(const file of files)data.items.add(new File([new Uint8Array(file.bytes)],file.name,{type:file.mimeType}));return data;},files.map(file=>({name:file.name,mimeType:file.mimeType,bytes:Array.from(file.buffer)})));const target=page.getByRole('button',{name:'Subir cotización, PDF o foto',exact:true});await target.dispatchEvent('dragover',{dataTransfer:transfer});await target.dispatchEvent('drop',{dataTransfer:transfer});await transfer.dispose();}
async function main(){
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const invalid=await setup(browser,'assistant-invalid');
  for(const files of [[{name:'programa.exe',mimeType:'application/octet-stream',buffer:Buffer.from('Archivo inválido')}],Array.from({length:4},(_value,index)=>({...quoteFile(),name:`cotizacion-${index}.pdf`})),[{...quoteFile(),buffer:Buffer.alloc(3*1024*1024+1)}]]){await uploadAndCreate(invalid.page,files);await invalid.page.getByRole('dialog').filter({hasText:'Revisa el archivo'}).waitFor();await invalid.page.getByRole('button',{name:'Entendido',exact:true}).click();assert.equal(invalid.reads.length,0);assert.equal(invalid.calls.length,0);}
  await assertSimpleAssistant(invalid.page);assert.deepEqual(invalid.errors,[]);await invalid.context.close();
  const cancelRead=await setup(browser,'assistant-cancel-read',{pauseReading:true,existingDrafts:true});const originalReadDraft=JSON.stringify(cancelRead.snapshot.adquisicion.borradores_ia);await uploadAndCreate(cancelRead.page);await cancelRead.readingStarted;await cancelRead.page.getByRole('button',{name:'Cancelar lectura',exact:true}).click();await dismissCancelled(cancelRead.page);const readWriteCount=cancelRead.writes.length;cancelRead.releaseReading();await cancelRead.readingReturned;await cancelRead.page.waitForTimeout(250);assert.equal(cancelRead.writes.length,readWriteCount,'La respuesta tardía no escribe datos');assert.deepEqual(cancelRead.calls,[]);assert.equal(JSON.stringify(cancelRead.snapshot.adquisicion.borradores_ia),originalReadDraft);assert.deepEqual(cancelRead.errors,[]);await cancelRead.context.close();
  const cancelGeneration=await setup(browser,'assistant-cancel-generation',{pauseGeneration:2,existingDrafts:true});const originalThird=JSON.stringify(cancelGeneration.snapshot.adquisicion.borradores_ia[3]);await uploadAndCreate(cancelGeneration.page);await cancelGeneration.generationPaused;await cancelGeneration.page.getByRole('dialog').filter({hasText:'Preparando documentos…'}).waitFor();await cancelGeneration.page.locator('.swal2-loader').waitFor({state:'visible'});await cancelGeneration.page.getByRole('button',{name:'Cancelar proceso',exact:true}).click();await dismissCancelled(cancelGeneration.page);const generatedWriteCount=cancelGeneration.writes.length;cancelGeneration.releaseGeneration();await cancelGeneration.generationReturned;await cancelGeneration.page.waitForTimeout(250);assert.equal(cancelGeneration.writes.length,generatedWriteCount,'Cancelar impide guardar la respuesta tardía de la carpeta 2');assert.deepEqual(cancelGeneration.calls,[1,2]);assert.ok(cancelGeneration.snapshot.adquisicion.borradores_ia[1]);assert.equal(cancelGeneration.snapshot.adquisicion.borradores_ia[2],undefined);assert.equal(JSON.stringify(cancelGeneration.snapshot.adquisicion.borradores_ia[3]),originalThird);assert.deepEqual(cancelGeneration.errors,[]);await cancelGeneration.context.close();
  const cancelClarification=await setup(browser,'assistant-cancel-clarification',{conflicts:['La cantidad difiere entre los antecedentes.'],pauseReading:2,existingDrafts:true});const beforeClarification=JSON.stringify(cancelClarification.snapshot.adquisicion.borradores_ia);await uploadAndCreate(cancelClarification.page);await cancelClarification.page.getByRole('dialog').filter({hasText:'Necesito aclarar un dato'}).waitFor();await cancelClarification.page.getByRole('textbox',{name:'Aclaración',exact:true}).fill('Usar las siete resmas indicadas en la cotización');await cancelClarification.page.getByRole('button',{name:'Continuar',exact:true}).click();await cancelClarification.readingPaused;await cancelClarification.page.getByRole('button',{name:'Cancelar lectura',exact:true}).click();await dismissCancelled(cancelClarification.page);const clarificationWrites=cancelClarification.writes.length;cancelClarification.releaseReading();await cancelClarification.pausedReadingReturned;await cancelClarification.page.waitForTimeout(250);assert.equal(cancelClarification.writes.length,clarificationWrites);assert.deepEqual(cancelClarification.calls,[]);assert.equal(JSON.stringify(cancelClarification.snapshot.adquisicion.borradores_ia),beforeClarification);assert.deepEqual(cancelClarification.errors,[]);await cancelClarification.context.close();
  const dropped=await setup(browser,'assistant-dropped');await dropped.page.getByRole('button',{name:'Subir cotización, PDF o foto',exact:true}).waitFor();await dropFiles(dropped.page,[quoteFile(),{name:'foto.png',mimeType:'image/png',buffer:Buffer.from([137,80,78,71,13,10,26,10])}]);await documentsPrepared(dropped.page);assert.deepEqual(dropped.attachmentNames[0],['cotizacion.pdf','foto.png']);assert.deepEqual(dropped.calls,[1,2,3,4,5]);await assertSimpleAssistant(dropped.page);assert.deepEqual(dropped.errors,[]);await dropped.context.close();
  console.log('PASS carga automática por selección y arrastre PDF/foto; límite/formato inválidos sin IA; cancelar lectura/generación conserva borradores e ignora respuestas tardías.');
  const missing=await setup(browser,'assistant-missing',{quantity:'',pauseGeneration:1});await uploadAndCreate(missing.page);
  await missing.page.getByRole('dialog').filter({hasText:'¿Cuántos necesitas del ítem 1?'}).waitFor();assert.equal(missing.calls.length,0);assert.equal(missing.reads[0].context,'');
  assert.equal(await missing.page.locator('.swal2-popup input:visible,.swal2-popup textarea:visible').count(),1,'La pregunta de cantidad contiene un solo dato');
  await missing.page.getByRole('textbox',{name:'Cantidad del ítem 1',exact:true}).fill('10');await missing.page.getByRole('button',{name:'Continuar',exact:true}).click();
  await missing.generationPaused;await missing.page.getByRole('dialog').filter({hasText:'Preparando documentos…'}).waitFor();await missing.page.locator('.swal2-loader').waitFor({state:'visible'});assert.equal(await missing.page.getByRole('button',{name:'Cancelar proceso',exact:true}).count(),1);missing.releaseGeneration();
  await documentsPrepared(missing.page);assert.deepEqual(missing.calls,[1,2,3,4,5]);assert.equal(missing.snapshot.adquisicion.asistente_compra.confirmedAt,null);assert.equal(missing.snapshot.adquisicion.asistente_compra.reviewMode,'automatic');assert.equal(missing.snapshot.adquisicion.items[0].cantidad,10);await assertSimpleAssistant(missing.page);
  assert.deepEqual(missing.errors,[]);await missing.context.close();
  const automatic=await setup(browser,'assistant-automatic',{pauseReading:true}),page=automatic.page;await page.getByLabel('Cotización, PDF o foto',{exact:true}).waitFor({state:'attached'});await assertSimpleAssistant(page);await page.screenshot({path:`${output}/asistente-simplificado.png`,fullPage:false});await page.getByLabel('Asistente de esta compra',{exact:true}).screenshot({path:`${output}/zona-carga-automatica.png`});await uploadAndCreate(page);
  await page.getByRole('dialog').filter({hasText:'Leyendo el archivo…'}).waitFor();await automatic.readingStarted;await page.locator('.swal2-loader').waitFor({state:'visible'});await page.locator('.swal2-popup').evaluate(popup=>Promise.all(popup.getAnimations().filter(animation=>animation.playState==='running').map(animation=>animation.finished.catch(()=>{}))));await page.screenshot({path:`${output}/asistente-progreso-sweetalert.png`,fullPage:false});assert.equal(await page.getByRole('button',{name:'Cancelar lectura',exact:true}).count(),1);automatic.releaseReading();
  await documentsPrepared(page);assert.deepEqual(automatic.calls,[1,2,3,4,5]);assert.equal(automatic.reads[0].context,'');assert.deepEqual(automatic.attachmentNames[0],['cotizacion.pdf']);await assertSimpleAssistant(page);
  const purchase=automatic.snapshot.adquisicion;assert.equal(purchase.asistente_compra.confirmedAt,null);assert.ok(purchase.asistente_compra.preparedAt);assert.equal(purchase.asistente_compra.reviewMode,'automatic');assert.equal(purchase.prevision_presupuesto,350);assert.equal(Object.keys(purchase.borradores_ia).length,5);assert.ok(!purchase.asistente_compra.decisions?.seleccion,'La lectura automática no confirma el método de selección');assert.ok(purchase.asistente_compra.suggestions.some(s=>s.field==='purpose'),'La finalidad propuesta conserva su procedencia');assert.ok(!purchase.borradores_ia[1].draft.confirmedFields?.includes('seleccion'),'Un método propuesto no queda confirmado');
  await page.frameLocator('iframe[title="Vista de contenido del Word"]').getByText('Papel tamaño carta',{exact:false}).first().waitFor({timeout:20000});await page.locator('iframe[title="Vista de contenido del Word"]').scrollIntoViewIfNeeded();await page.locator('iframe[title="Vista de contenido del Word"]').screenshot({path:`${output}/tdr-vista-previa.png`});await page.screenshot({path:`${output}/archivo-a-documentos.png`,fullPage:true});
  await page.getByRole('button',{name:'Completar o corregir con IA',exact:true}).click();await page.getByText('Describe lo que necesitas o los datos que cambian',{exact:true}).locator('..').getByRole('textbox').fill('cambiar plazo a 45 dias por favor');await page.getByRole('button',{name:'Aplicar cambios con IA',exact:true}).click();await page.getByText('Cambios aplicados:',{exact:false}).waitFor({timeout:20000});await page.frameLocator('iframe[title="Vista de contenido del Word"]').getByText('45 días calendario',{exact:false}).first().waitFor();
  // Edit the actual Word-shaped document, including its item cells. There is no
  // parallel textarea form: values must survive saving, reopening and DOCX export.
  await page.getByRole('button',{name:'Editar documento',exact:true}).click();
  const tdr=page.getByLabel('Documento editable: Especificaciones técnicas',{exact:true});
  const editedBackground='ENDE DEORURO S.A. desarrolla labores de operación y mantenimiento. Esta redacción fue corregida directamente en el documento institucional.';
  const editedDescription='Papel tamaño carta para archivo institucional';
  const editedSpecification='75 g/m²; paquete cerrado de 500 hojas. Texto corregido en la celda del documento.';
  await tdr.getByRole('textbox',{name:'Antecedentes',exact:true}).fill(editedBackground);
  await tdr.getByRole('textbox',{name:'DESCRIPCIÓN DEL BIEN, ítem 1',exact:true}).fill(editedDescription);
  await tdr.getByRole('textbox',{name:'CANTIDAD, ítem 1',exact:true}).fill('12');
  await tdr.getByRole('textbox',{name:'CARACTERÍSTICAS TÉCNICAS REQUERIDAS, ítem 1',exact:true}).fill(editedSpecification);
  await page.getByRole('button',{name:'Añadir ítem',exact:true}).click();
  await tdr.getByRole('textbox',{name:'DESCRIPCIÓN DEL BIEN, ítem 2',exact:true}).fill('Ítem temporal que se quitará');
  await page.getByRole('button',{name:'Quitar ítem 2',exact:true}).click();
  await tdr.getByRole('textbox',{name:'DESCRIPCIÓN DEL BIEN, ítem 2',exact:true}).waitFor({state:'detached'});
  await tdr.getByRole('textbox',{name:'DESCRIPCIÓN DEL BIEN, ítem 1',exact:true}).waitFor();
  assert.equal(await tdr.getByRole('textbox',{name:'DESCRIPCIÓN DEL BIEN, ítem 2',exact:true}).count(),0);
  assert.equal(await tdr.getByRole('textbox',{name:'Antecedentes',exact:true}).textContent(),editedBackground);
  await tdr.scrollIntoViewIfNeeded();await page.screenshot({path:`${output}/tdr-edicion-en-documento.png`,fullPage:true});
  await page.getByRole('button',{name:'Guardar cambios',exact:true}).click();
  await page.getByRole('button',{name:'Editar documento',exact:true}).waitFor({timeout:20000});
  assert.equal(automatic.snapshot.adquisicion.borradores_ia[1].draft.fields.antecedentes,editedBackground);
  assert.equal(automatic.snapshot.adquisicion.borradores_ia[1].draft.items.length,1);
  assert.equal(automatic.snapshot.adquisicion.borradores_ia[1].draft.items[0].descripcion,editedDescription);
  assert.equal(automatic.snapshot.adquisicion.borradores_ia[1].draft.items[0].cantidad,'12');
  await page.reload();await page.getByRole('button',{name:'Editar documento',exact:true}).waitFor();
  await page.getByRole('button',{name:'Editar documento',exact:true}).click();
  await tdr.getByRole('textbox',{name:'Antecedentes',exact:true}).waitFor();
  assert.equal(await tdr.getByRole('textbox',{name:'Antecedentes',exact:true}).textContent(),editedBackground);
  assert.equal(await tdr.getByRole('textbox',{name:'CARACTERÍSTICAS TÉCNICAS REQUERIDAS, ítem 1',exact:true}).textContent(),editedSpecification);
  const tdrDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar Word',exact:true}).click();await(await tdrDownload).saveAs(`${output}/TDR-editado-en-documento.docx`);
  const tdrWord=(await mammoth.extractRawText({path:`${output}/TDR-editado-en-documento.docx`})).value;
  assert.ok(tdrWord.includes(editedBackground));assert.ok(tdrWord.includes(editedDescription));assert.ok(tdrWord.includes(editedSpecification));assert.doesNotMatch(tdrWord,/Ítem temporal que se quitará/);
  await page.getByRole('button').filter({hasText:'Solicitud S1'}).first().click();
  await page.getByRole('heading',{name:'Solicitud de adquisición S1-N014',exact:true}).waitFor();
  const frame=page.frameLocator('iframe[title="Vista de contenido del Word"]');await frame.getByRole('table',{name:'Formulario S1 en Word'}).waitFor({timeout:20000});
  await page.getByRole('button',{name:'Editar documento',exact:true}).click();
  const s1=page.getByLabel('Documento editable: Solicitud de adquisición S1-N014',{exact:true});
  await s1.getByRole('textbox',{name:'Nombre del solicitante',exact:true}).fill('Solicitante corregido');
  await s1.getByRole('radio',{name:'Verificación de existencia en almacén: Sin saldo',exact:true}).click();
  await s1.getByRole('radio',{name:'Publicar precio: Sí',exact:true}).click();
  await s1.getByRole('radio',{name:'Con presupuesto: Sí',exact:true}).click();
  assert.equal(await s1.getByRole('radio',{name:'Verificación de existencia en almacén: Sin saldo',exact:true}).getAttribute('aria-checked'),'true');
  assert.equal(await s1.getByRole('radio',{name:'Publicar precio: No',exact:true}).getAttribute('aria-checked'),'false');
  assert.ok(await s1.locator('[colspan]').count(),'El S1 conserva sus celdas combinadas');
  await page.getByText('Responsables para próximos expedientes',{exact:true}).click();
  await page.getByRole('checkbox',{name:'Usar estos responsables como datos oficiales en próximos expedientes'}).check();
  await s1.scrollIntoViewIfNeeded();await page.screenshot({path:`${output}/s1-edicion-en-documento.png`,fullPage:true});
  await page.getByRole('button',{name:'Guardar cambios',exact:true}).click();await page.getByRole('button',{name:'Editar documento',exact:true}).waitFor({timeout:20000});
  assert.equal(automatic.snapshot.adquisicion.borradores_ia[2].draft.fields.solicitante,'Solicitante corregido');
  assert.equal(automatic.snapshot.adquisicion.borradores_ia[2].draft.fields.almacen,'Sin saldo');assert.equal(automatic.snapshot.adquisicion.borradores_ia[2].draft.fields.publicar_precio,'Sí');assert.equal(automatic.snapshot.adquisicion.borradores_ia[2].draft.fields.con_presupuesto,'Sí');
  assert.equal(automatic.templates[0].contenido_plantilla.officialPeopleByCompany.ende.fields.solicitante,'Solicitante corregido');
  await page.reload();await page.getByRole('button').filter({hasText:'Solicitud S1'}).first().click();await frame.getByText('Solicitante corregido',{exact:true}).waitFor({timeout:20000});
  await page.getByRole('button',{name:'Editar documento',exact:true}).click();await s1.getByRole('textbox',{name:'Nombre del solicitante',exact:true}).waitFor();
  assert.equal(await s1.getByRole('radio',{name:'Verificación de existencia en almacén: Sin saldo',exact:true}).getAttribute('aria-checked'),'true');
  assert.equal(await s1.getByRole('radio',{name:'Publicar precio: Sí',exact:true}).getAttribute('aria-checked'),'true');
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar Word',exact:true}).click();await(await download).saveAs(`${output}/S1-descargado.docx`);
  const s1Word=(await mammoth.extractRawText({path:`${output}/S1-descargado.docx`})).value;assert.ok(s1Word.includes('Solicitante corregido'));assert.ok(s1Word.includes('☒'),'Las opciones elegidas se exportan marcadas al Word');
  assert.deepEqual(automatic.errors,[]);await automatic.context.close();
  const conflict=await setup(browser,'assistant-conflict',{conflicts:['La cantidad difiere entre los antecedentes.']});await uploadAndCreate(conflict.page);await conflict.page.getByRole('dialog').filter({hasText:'Necesito aclarar un dato'}).waitFor();assert.deepEqual(conflict.calls,[]);assert.equal(await conflict.page.locator('.swal2-popup input:visible,.swal2-popup textarea:visible').count(),1);await conflict.page.getByRole('textbox',{name:'Aclaración',exact:true}).fill('Usar las siete resmas indicadas en la cotización');await conflict.page.getByRole('button',{name:'Continuar',exact:true}).click();await documentsPrepared(conflict.page);assert.deepEqual(conflict.calls,[1,2,3,4,5]);assert.equal(conflict.reads.length,2,'La aclaración se aplica mediante una relectura de los antecedentes');assert.match(conflict.reads[1].context,/siete resmas/);assert.deepEqual(conflict.attachmentNames[1],['cotizacion.pdf']);assert.equal(conflict.snapshot.adquisicion.asistente_compra.items[0].cantidad,'7');assert.equal(conflict.snapshot.adquisicion.items[0].cantidad,7);assert.equal(conflict.snapshot.adquisicion.borradores_ia[1].draft.items[0].cantidad,'7');assert.equal(conflict.snapshot.adquisicion.asistente_compra.confirmedAt,null);assert.deepEqual(conflict.errors,[]);await conflict.context.close();
  const partial=await setup(browser,'assistant-partial',{failure:3});await uploadAndCreate(partial.page);await partial.page.getByRole('dialog').filter({hasText:'Quedó un documento por preparar'}).waitFor({timeout:30000});await partial.page.getByRole('button',{name:'Continuar',exact:true}).click();assert.deepEqual(Object.keys(partial.snapshot.adquisicion.borradores_ia),['1','2','4','5']);await partial.page.getByRole('button',{name:'Volver a intentar',exact:true}).click();await documentsPrepared(partial.page);assert.deepEqual(partial.calls,[1,2,3,4,5,3]);assert.equal(partial.snapshot.adquisicion.asistente_compra.confirmedAt,null);assert.equal(Object.keys(partial.snapshot.adquisicion.borradores_ia).length,5);await assertSimpleAssistant(partial.page);await partial.context.close();
  const cancelSync=await setup(browser,'assistant-cancel-sync',{pauseSync:true});await uploadAndCreate(cancelSync.page);await cancelSync.syncPaused;await cancelSync.page.getByRole('dialog').filter({hasText:'Guardando documentos…'}).waitFor();await cancelSync.page.getByRole('button',{name:'Cancelar proceso',exact:true}).click();cancelSync.releaseSync();await dismissCancelled(cancelSync.page);assert.deepEqual(cancelSync.calls,[1,2,3,4,5]);assert.equal(Object.keys(cancelSync.snapshot.adquisicion.borradores_ia).length,5);await cancelSync.page.getByRole('button',{name:'Volver a intentar',exact:true}).click();await documentsPrepared(cancelSync.page);assert.deepEqual(cancelSync.calls,[1,2,3,4,5],'Reintentar el guardado no vuelve a generar las cinco carpetas');assert.equal(cancelSync.reads.length,1);assert.deepEqual(cancelSync.errors,[]);await cancelSync.context.close();
  console.log('PASS UI: subir archivo prepara cinco carpetas sin otro clic; pregunta breve solo cantidad o conflicto; progreso y recuperación parcial; editar párrafos/celdas en documento, guardar/reabrir y DOCX exacto; S1 combinado, casillas y responsables oficiales.');
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
