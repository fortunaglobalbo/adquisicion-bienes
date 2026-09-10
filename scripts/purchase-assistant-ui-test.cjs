// Isolated browser, fictitious data, and intercepted persistence. No writes to the real database.
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const {chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const id='assistant-ui-test';const now=new Date().toISOString();
const base={id,codigo:'PRUEBA-UI',titulo_proceso:'Adquisición de papel tamaño carta',empresa_id:'ende',categoria:'Bienes',modalidad:'Por definir',partida_presupuestaria:'',estado:'Iniciado',prevision_presupuesto:350,moneda:'BOB',fecha_inicio:now.slice(0,10),unidad_solicitante:'Administración',responsable_proceso:'Responsable de prueba',creado_por:'Prueba',fecha_creacion:now,fecha_actualizacion:now,lugar_entrega:'Almacén de Oruro',plazo_entrega_dias:10,items:[]};
let templates=[];
let snapshot={adquisicion:base,carpetas:[1,2,3,4,5,6,7,8].map(n=>({id:`folder-${n}`,adquisicion_id:id,numero:n,nombre:['TDR','Solicitud S1','Cuadro de justificación','Solicitud de cotización','Inicio','S2','Conformidad','Pago'][n-1],tipo_generacion:'IA',estado:'Pendiente',documentos:[],orden:n})),campos:[],firmas:[],logs:[]};
async function main(){
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/db/sync',async route=>{if(route.request().method()==='POST'){const body=route.request().postDataJSON();if(body.action==='SAVE_PLANTILLA'){templates=[{...body.data,contenido_plantilla:body.data.datos_completos}];}else{assert.equal(body.action,'SAVE_EXPEDIENTE');snapshot=body.data;}await route.fulfill({json:{success:true,revision:crypto.randomUUID()}});}else await route.fulfill({json:{success:true,adquisiciones:[snapshot.adquisicion],carpetas:snapshot.carpetas,documentos:[],logs:[],plantillas:templates,states:[{revision:'test',snapshot}]}});});
  await page.route('**/api/files', async route => {
    assert.equal(route.request().method(), 'POST');
    await route.fulfill({json:{path:'test/S1.docx'}});
  });
  const calls=[];
  await page.route('**/api/fixed-documents',async route=>{
    const text=route.request().postData()||'';
    if(text.includes('"action":"analyze"')){await route.fulfill({json:{brief:{revision:'',confirmedAt:null,notes:'Prueba',purpose:'Impresión de documentos administrativos',location:'Almacén de Oruro',deliveryDays:'10',items:[{descripcion:'Papel tamaño carta',cantidad:'',unidad:'resma',especificaciones:'75 g/m², 500 hojas por resma',precio:'35'}],facts:[],conflicts:[],clarification:'',details:{}}}});return;}
    if(text.includes('"action":"complete"')){
      const number=Number(text.match(/"number":(\d+)/)?.[1]);calls.push(number);
      const draft=JSON.parse(fs.readFileSync(`test-results/fixed-models/assistant-live/${number}.json`));
      if(number===1)draft.proposals={seleccion:{value:'Menor precio entre propuestas que cumplan los requisitos mínimos.',reason:'Sugerencia para confirmar en la prueba.'}};
      await route.fulfill({json:{draft}});return;
    }
    await route.continue();
  });
  await page.goto(`http://127.0.0.1:3000/expediente/${id}`);
  await page.getByRole('button',{name:'Leer con IA y continuar',exact:true}).click();
  await page.getByRole('button',{name:'Confirmar y preparar carpetas 1 a 4',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'Completa el bien'}).waitFor();
  assert.equal(calls.length,0);
  await page.getByRole('textbox',{name:'Cantidad 1',exact:true}).fill('10');
  await page.getByRole('button',{name:'Confirmar y preparar carpetas 1 a 4',exact:true}).click();
  await page.getByText('Borradores preparados. Abre cada carpeta',{exact:false}).waitFor({timeout:20000});
  assert.deepEqual(calls,[1,2,3,4]);assert.equal(snapshot.adquisicion.items[0].cantidad,10);assert.equal(snapshot.adquisicion.prevision_presupuesto,350);assert.equal(Object.keys(snapshot.adquisicion.borradores_ia).length,4);
  await page.getByRole('button',{name:'Completar o corregir con IA',exact:true}).click();
  await page.getByText('Describe lo que necesitas o los datos que cambian',{exact:true}).locator('..').getByRole('textbox').fill('cambiar plazo a 45 dias por favor');
  await page.getByRole('button',{name:'Completar con IA',exact:true}).click();
  await page.getByText('Cambio aplicado. Revisa la vista previa y pulsa Guardar cambios para conservarlo en el expediente.',{exact:true}).waitFor({timeout:20000});
  await page.frameLocator('iframe[title="Vista de contenido del Word"]').getByText('45 días calendario',{exact:false}).first().waitFor();
  assert.deepEqual(calls,[1,2,3,4]);
  await page.getByText('Confirmar condiciones sugeridas por la IA',{exact:true}).click();
  await page.getByRole('button',{name:'Usar esta condición',exact:true}).click();
  await page.waitForTimeout(500);assert.ok(snapshot.adquisicion.asistente_compra.decisions.seleccion.includes('Menor precio'));
  fs.mkdirSync('test-results/assistant-ui',{recursive:true});await page.screenshot({path:'test-results/assistant-ui/assistant.png',fullPage:true});
  const folderButtons=await page.getByRole('button').allTextContents();fs.writeFileSync('test-results/assistant-ui/buttons.json',JSON.stringify(folderButtons));
  await page.getByRole('button').filter({hasText:'Solicitud S1'}).first().click();
  await page.getByRole('heading',{name:'Solicitud de adquisición S1-N014',exact:true}).waitFor();
  const frame=page.frameLocator('iframe[title="Vista de contenido del Word"]');await frame.getByRole('table',{name:'Formulario S1 en Word'}).waitFor({timeout:20000});
  assert.equal(await frame.getByText('Responsable de prueba',{exact:true}).count(),1);
  await page.locator('iframe').scrollIntoViewIfNeeded();
  await page.screenshot({path:'test-results/assistant-ui/s1.png',fullPage:true});
  await page.getByRole('button',{name:'Editar documento',exact:true}).click();
  await page.getByText('Nombre del solicitante',{exact:true}).filter({has:page.locator('xpath=self::span')}).locator('..').getByRole('textbox').fill('Solicitante corregido');
  await page.getByRole('button',{name:'Actualizar vista',exact:true}).first().click();
  await frame.getByText('Solicitante corregido',{exact:true}).waitFor({timeout:20000});
  await page.getByRole('checkbox',{name:'Usar estos responsables como datos oficiales en próximos expedientes'}).check();
  await page.getByRole('button',{name:'Guardar cambios',exact:true}).first().click();
  await page.getByRole('button',{name:'Editar documento',exact:true}).waitFor({timeout:20000});
  assert.equal(snapshot.adquisicion.borradores_ia[2].draft.fields.solicitante,'Solicitante corregido');
  assert.equal(templates[0].contenido_plantilla.officialPeopleByCompany.ende.fields.solicitante,'Solicitante corregido');
  await page.reload();
  await page.getByRole('button').filter({hasText:'Solicitud S1'}).first().click();
  await frame.getByText('Solicitante corregido',{exact:true}).waitFor({timeout:20000});
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar Word',exact:true}).click();const file=await download;await file.saveAs('test-results/assistant-ui/S1-descargado.docx');
  assert.deepEqual(errors,[]);console.log('PASS UI: lectura, dato esencial, cuatro carpetas, condición compartida, S1 con formato, edición visible y descarga Word');
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
