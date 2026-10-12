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
const mammoth=require('mammoth');
const url=process.env.ASSISTANT_UI_URL||'http://127.0.0.1:3000';
const output='test-results/assistant-ui';fs.mkdirSync(output,{recursive:true});
const now=new Date().toISOString();
function fixture(id){const adquisicion={id,codigo:'PRUEBA-UI',titulo_proceso:'Adquisición de papel tamaño carta',empresa_id:'ende',categoria:'Bienes',modalidad:'Por definir',partida_presupuestaria:'',estado:'Iniciado',prevision_presupuesto:350,moneda:'BOB',fecha_inicio:now.slice(0,10),unidad_solicitante:'Administración',responsable_proceso:'Responsable de prueba',creado_por:'Prueba',fecha_creacion:now,fecha_actualizacion:now,lugar_entrega:'Almacén de Oruro',plazo_entrega_dias:10,items:[]};return {adquisicion,carpetas:[1,2,3,4,5,6,7,8].map(n=>({id:`${id}-folder-${n}`,adquisicion_id:id,numero:n,nombre:['TDR','Solicitud S1','Cuadro de justificación','Solicitud de cotización','Inicio','Evaluación','Conformidad','Pago'][n-1],tipo_generacion:'IA',estado:'Pendiente',documentos:[],orden:n})),campos:[],firmas:[],logs:[]};}
function requestPayload(request){const body=request.postData()||'';const match=body.match(/name="request"\r?\n(?:Content-Type:[^\r\n]+\r?\n)?\r?\n([\s\S]*?)\r?\n--/);assert.ok(match,'Se espera la petición JSON en el formulario');return JSON.parse(match[1]);}
async function setup(browser,id,{quantity='10',conflicts=[],failure=0}={}){
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
 let snapshot=fixture(id),templates=[],revision='initial';const errors=[],calls=[],reads=[];let failNumber=failure;
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',route=>route.fulfill({status:403,json:{error:'Servicio bloqueado en la prueba aislada'}}));
 await page.route('**/api/db/sync',async route=>{
  if(route.request().method()==='POST'){const body=route.request().postDataJSON();if(body.action==='SAVE_PLANTILLA')templates=[{...body.data,contenido_plantilla:body.data.datos_completos}];else{assert.equal(body.action,'SAVE_EXPEDIENTE');assert.equal(body.data.adquisicion.id,id);snapshot=body.data;}revision=crypto.randomUUID();await route.fulfill({json:{success:true,revision}});}
  else await route.fulfill({json:{success:true,adquisiciones:[snapshot.adquisicion],carpetas:snapshot.carpetas,documentos:[],logs:[],plantillas:templates,states:[{revision,snapshot}]}});
 });
 await page.route('**/api/files',async route=>{assert.equal(route.request().method(),'POST');await route.fulfill({json:{path:'test/S1.docx'}});});
 await page.route('**/api/fixed-documents',async route=>{
  const body=requestPayload(route.request());
  if(body.action==='analyze'){
   reads.push(body);assert.ok((route.request().postData()||'').includes('filename="cotizacion.pdf"'));
   await route.fulfill({json:{brief:{revision:'',confirmedAt:null,notes:body.context,purpose:'Impresión de documentos administrativos',location:'Almacén de Oruro',deliveryDays:'10',items:[{descripcion:'Papel tamaño carta',cantidad:quantity,unidad:'resma',especificaciones:'75 g/m², 500 hojas por resma',precio:'35'}],facts:[],conflicts,clarification:'',details:{},suggestions:[{field:'purpose',value:'Impresión de documentos administrativos',reason:'Finalidad propuesta a partir del producto; editable.'}]}}});return;
  }
  let draft=body.draft||seedFixedDraft(body.number,body.adquisicion);
  if(body.action==='complete'){
   calls.push(body.number);if(body.number===failNumber){failNumber=0;await route.fulfill({status:503,json:{error:'Fallo temporal simulado'}});return;}
   draft=seedFixedDraft(body.number,body.adquisicion);if(body.number===1){draft.fields.justificacion=body.adquisicion.asistente_compra.purpose;draft.fields.seleccion='Menor precio entre propuestas que cumplan los requisitos mínimos.';draft.proposals={seleccion:{value:draft.fields.seleccion,reason:'Sugerencia para revisar; no es una decisión del usuario.'}};}
  }
  if(body.action==='revise'){assert.match(body.context,/45/);draft={...draft,fields:{...draft.fields,plazo:'45 días calendario'},editedFields:[...(draft.editedFields||[]),'plazo']};}
  const rendered=await renderFixedWord(body.number,draft);const html=body.number===2?await wordFormPreview(rendered.buffer):(await mammoth.convertToHtml({buffer:rendered.buffer})).value;
  await route.fulfill({json:{draft:rendered.draft,html,pdf:null,previewWarning:'',...(body.action==='revise'?{revised:true,revisionSummary:['Plazo actualizado a 45 días']}:{}),...(body.action==='export'?{docx:rendered.buffer.toString('base64')}: {})}});
 });
 await page.goto(`${url}/expediente/${id}`);
 return {page,context,errors,calls,reads,get snapshot(){return snapshot;},get templates(){return templates;}};
}
async function uploadAndCreate(page){await page.getByLabel('Cotización, PDF o foto',{exact:true}).setInputFiles({name:'cotizacion.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nCotización ficticia para test de interfaz')});await page.getByRole('button',{name:'Crear documentos con IA',exact:true}).click();}
async function main(){
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const missing=await setup(browser,'assistant-missing',{quantity:''});await uploadAndCreate(missing.page);
  await missing.page.getByRole('alert').filter({hasText:'Completa el bien'}).waitFor();assert.equal(missing.calls.length,0);assert.equal(missing.reads[0].context,'');
  await missing.page.getByRole('textbox',{name:'Cantidad 1',exact:true}).fill('10');await missing.page.getByRole('button',{name:'Preparar documentos con estos datos',exact:true}).click();
  await missing.page.getByText('TDR y solicitudes preparados.',{exact:false}).waitFor({timeout:20000});assert.deepEqual(missing.calls,[1,2,3,4,5]);assert.ok(missing.snapshot.adquisicion.asistente_compra.confirmedAt);assert.equal(missing.snapshot.adquisicion.asistente_compra.reviewMode,'reviewed');assert.equal(missing.snapshot.adquisicion.items[0].cantidad,10);
  assert.deepEqual(missing.errors,[]);await missing.context.close();
  const automatic=await setup(browser,'assistant-automatic'),page=automatic.page;await page.getByLabel('Cotización, PDF o foto',{exact:true}).waitFor();await page.screenshot({path:`${output}/asistente-simplificado.png`,fullPage:false});await uploadAndCreate(page);
  await page.getByText('TDR y solicitudes preparados.',{exact:false}).waitFor({timeout:20000});assert.deepEqual(automatic.calls,[1,2,3,4,5]);assert.equal(automatic.reads[0].context,'');
  const purchase=automatic.snapshot.adquisicion;assert.equal(purchase.asistente_compra.confirmedAt,null);assert.ok(purchase.asistente_compra.preparedAt);assert.equal(purchase.asistente_compra.reviewMode,'automatic');assert.equal(purchase.prevision_presupuesto,350);assert.equal(Object.keys(purchase.borradores_ia).length,5);assert.ok(!purchase.asistente_compra.decisions?.seleccion,'La lectura automática no confirma el método de selección');
  await page.getByText('Datos propuestos por la IA',{exact:true}).waitFor();await page.frameLocator('iframe[title="Vista de contenido del Word"]').getByText('Papel tamaño carta',{exact:false}).first().waitFor({timeout:20000});await page.locator('iframe[title="Vista de contenido del Word"]').scrollIntoViewIfNeeded();await page.locator('iframe[title="Vista de contenido del Word"]').screenshot({path:`${output}/tdr-vista-previa.png`});await page.screenshot({path:`${output}/archivo-a-documentos.png`,fullPage:true});
  await page.getByRole('button',{name:'Editar estos datos',exact:true}).click();await page.getByRole('textbox',{name:'¿Para qué se necesita?',exact:true}).fill('Impresión para el archivo institucional');await page.getByRole('button',{name:'Preparar documentos con estos datos',exact:true}).click();await page.getByText('TDR y solicitudes preparados.',{exact:false}).waitFor({timeout:20000});
  assert.equal(automatic.snapshot.adquisicion.asistente_compra.purpose,'Impresión para el archivo institucional');assert.equal(automatic.snapshot.adquisicion.asistente_compra.suggestions.length,0);
  await page.getByRole('button',{name:'Completar o corregir con IA',exact:true}).click();await page.getByText('Describe lo que necesitas o los datos que cambian',{exact:true}).locator('..').getByRole('textbox').fill('cambiar plazo a 45 dias por favor');await page.getByRole('button',{name:'Aplicar cambios con IA',exact:true}).click();await page.getByText('Cambios aplicados:',{exact:false}).waitFor({timeout:20000});await page.frameLocator('iframe[title="Vista de contenido del Word"]').getByText('45 días calendario',{exact:false}).first().waitFor();
  await page.getByRole('button').filter({hasText:'Solicitud S1'}).first().click();await page.getByRole('heading',{name:'Solicitud de adquisición S1-N014',exact:true}).waitFor();const frame=page.frameLocator('iframe[title="Vista de contenido del Word"]');await frame.getByRole('table',{name:'Formulario S1 en Word'}).waitFor({timeout:20000});await page.getByRole('button',{name:'Editar documento',exact:true}).click();await page.getByText('Nombre del solicitante',{exact:true}).filter({has:page.locator('xpath=self::span')}).locator('..').getByRole('textbox').fill('Solicitante corregido');await page.getByRole('button',{name:'Actualizar vista',exact:true}).first().click();await frame.getByText('Solicitante corregido',{exact:true}).waitFor({timeout:20000});await page.getByRole('checkbox',{name:'Usar estos responsables como datos oficiales en próximos expedientes'}).check();await page.getByRole('button',{name:'Guardar cambios',exact:true}).first().click();await page.getByRole('button',{name:'Editar documento',exact:true}).waitFor({timeout:20000});
  assert.equal(automatic.snapshot.adquisicion.borradores_ia[2].draft.fields.solicitante,'Solicitante corregido');assert.equal(automatic.templates[0].contenido_plantilla.officialPeopleByCompany.ende.fields.solicitante,'Solicitante corregido');await page.reload();await page.getByRole('button').filter({hasText:'Solicitud S1'}).first().click();await frame.getByText('Solicitante corregido',{exact:true}).waitFor({timeout:20000});const download=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar Word',exact:true}).click();await(await download).saveAs(`${output}/S1-descargado.docx`);assert.deepEqual(automatic.errors,[]);await automatic.context.close();
  const conflict=await setup(browser,'assistant-conflict',{conflicts:['La cantidad difiere entre los antecedentes.']});await uploadAndCreate(conflict.page);await conflict.page.getByRole('alert').filter({hasText:'Aclara la diferencia'}).waitFor();assert.deepEqual(conflict.calls,[]);await conflict.context.close();
  const partial=await setup(browser,'assistant-partial',{failure:3});await uploadAndCreate(partial.page);await partial.page.getByText('Los documentos preparados se conservaron.',{exact:false}).waitFor({timeout:20000});assert.deepEqual(Object.keys(partial.snapshot.adquisicion.borradores_ia),['1','2','4','5']);await partial.page.getByRole('button',{name:'Volver a intentar esta carpeta',exact:true}).click();await partial.page.getByText('Documento preparado. Abre su carpeta',{exact:false}).waitFor({timeout:20000});assert.deepEqual(partial.calls,[1,2,3,4,5,3]);assert.equal(partial.snapshot.adquisicion.asistente_compra.confirmedAt,null);assert.equal(Object.keys(partial.snapshot.adquisicion.borradores_ia).length,5);await partial.context.close();
  console.log('PASS UI: archivo sin relato -> cinco carpetas editables, faltantes y conflictos esenciales, propuestas sin confirmación ficticia, revisión, recuperación parcial, S1 institucional, responsables oficiales y descarga Word.');
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
