// Isolated fixture only: no API calls, provider credentials, or production records.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const ts = require('typescript');
require.extensions['.ts'] = (mod, file) => mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText, file);
const {sanitizeDocumentElement, safeDocumentStyle} = require('../src/lib/docx/editableDocumentHtml.ts');
const {DOMParser, XMLSerializer} = require('@xmldom/xmldom');
const unsafe = new DOMParser().parseFromString('<body><script>bad()</script><style>bad</style><svg><script>bad()</script></svg><iframe src="https://example.invalid"/><p class="evaluation-title fixed top-0" onclick="bad()" style="font-size:12pt;position:fixed;background:url(https://example.invalid);color:#123456">Texto <a href="javascript:bad()">normal</a></p><img src="https://example.invalid/x.png"/><table><tr><td colspan="2" rowspan="3" data-fixed-field="objeto" data-fixed-part="name" style="border-bottom:1pt solid #000">Compra</td></tr></table><img src="data:image/png;base64,AA==" alt="Logo"/></body>', 'text/xml');
sanitizeDocumentElement(unsafe.documentElement);
const safe = new XMLSerializer().serializeToString(unsafe);
assert.doesNotMatch(safe, /<script|<style|<svg|<iframe|onclick|href=|position:|url\(|https:/);
assert.match(safe, /colspan="2" rowspan="3"/);
assert.match(safe, /data-fixed-field="objeto"/);
assert.match(safe, /class="evaluation-title"/);
assert.match(safe, /data:image\/png;base64/);
assert.equal(safeDocumentStyle('font-family:Arial;color:red;background:u\\rl(https://example.invalid);font-size:8pt!important;line-height:1.05'), 'font-family:Arial;color:red;line-height:1.05');
assert.equal(safeDocumentStyle('background:image-set("//example.invalid/x.png" 1x);background-color:#efefef'), 'background-color:#efefef');

const output = path.resolve('test-results/editable-document');
fs.mkdirSync(output, {recursive:true});
fs.writeFileSync(path.join(output, 'loader.cjs'), `module.exports=source=>require('typescript').transpileModule(source,{compilerOptions:{module:require('typescript').ModuleKind.ESNext,target:require('typescript').ScriptTarget.ES2020,jsx:require('typescript').JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;`);
fs.writeFileSync(path.join(output, 'entry.tsx'), `
import React,{useMemo,useState}from'react';import{createRoot}from'react-dom/client';
import{EditableDocument}from'../../src/components/expediente/EditableDocument';
const model:any={number:1,title:'Especificaciones de prueba',fields:[{key:'objeto',label:'Objeto'},{key:'antecedentes',label:'Antecedentes'},{key:'destinatario',label:'Destinatario'},{key:'almacen',label:'Existencia en almacén'}],columns:[{key:'numero',label:'Número'},{key:'descripcion',label:'Descripción'},{key:'cantidad',label:'Cantidad'}]};
const initial:any={fields:{objeto:'Equipos de seguridad',antecedentes:'Antecedentes de prueba',destinatario:'María López\\nGerente general',almacen:'Sin saldo'},items:[{numero:'1',descripcion:'Arnés de seguridad',cantidad:'8'}],modelVersion:'test',companyId:'test',sourceIds:{},sources:[],warnings:[],consultedAt:null,normativeStatus:'not_applicable'};
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
function App(){const[draft,setDraft]=useState(()=>JSON.parse(localStorage.getItem('editor-test')||'null')||initial),[revision,setRevision]=useState(0),[disabled,setDisabled]=useState(false),[saved,setSaved]=useState(false);
const html=useMemo(()=>'<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIW2P4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==" alt="Logo de prueba"><h1>ESPECIFICACIONES TÉCNICAS</h1><p>Título fijo institucional</p><p><span data-fixed-field="objeto">'+escape(draft.fields.objeto)+'</span></p><p>Objeto repetido: <span data-fixed-field="objeto">'+escape(draft.fields.objeto)+'</span></p><h2>1. ANTECEDENTES</h2><p><span data-fixed-field="antecedentes">'+escape(draft.fields.antecedentes)+'</span></p><table aria-label="Formato institucional"><tbody><tr><td colspan="2" rowspan="2">Celda combinada fija</td><td><span data-fixed-field="destinatario" data-fixed-part="name">María López</span></td></tr><tr><td><span data-fixed-field="destinatario" data-fixed-part="role">Gerente general</span></td></tr></tbody></table><p><span data-fixed-field="almacen" data-fixed-choice="Con saldo">☐</span> Con saldo <span data-fixed-field="almacen" data-fixed-choice="Sin saldo">☒</span> Sin saldo</p><table aria-label="Ítems institucionales"><tbody>'+draft.items.map((row:any,i:number)=>'<tr data-fixed-row="'+i+'"><td>'+String(i+1)+'</td><td data-fixed-column="descripcion">'+escape(row.descripcion)+'</td><td data-fixed-column="cantidad">'+escape(row.cantidad)+'</td></tr>').join('')+'</tbody></table><script>window.__editorScriptRan=true</script><img src="https://example.invalid/image.png">',[revision]);
return <><button onClick={()=>setDisabled(!disabled)}>Cambiar ocupado</button><button onClick={()=>{localStorage.setItem('editor-test',JSON.stringify(draft));setSaved(true)}}>Guardar cambios de prueba</button>{saved&&<p>Guardado de prueba</p>}<EditableDocument html={html} draft={draft} model={model} disabled={disabled} onFieldChange={(key,value)=>setDraft((d:any)=>({...d,fields:{...d.fields,[key]:value}}))} onItemChange={(row,key,value)=>setDraft((d:any)=>({...d,items:d.items.map((r:any,i:number)=>i===row?{...r,[key]:value}:r)}))} onAddItem={()=>{setDraft((d:any)=>({...d,items:[...d.items,{numero:String(d.items.length+1),descripcion:'Nuevo ítem',cantidad:'1'}]}));setRevision(r=>r+1)}} onRemoveItem={row=>{setDraft((d:any)=>({...d,items:d.items.filter((_:any,i:number)=>i!==row)}));setRevision(r=>r+1)}}/><pre data-testid="draft">{JSON.stringify(draft)}</pre></>}
createRoot(document.getElementById('root')!).render(<App/>);`);

async function build() {
  const compiled = require('next/dist/compiled/webpack/webpack'); compiled.init();
  await new Promise((resolve,reject)=>compiled.webpack({mode:'development',entry:path.join(output,'entry.tsx'),output:{path:output,filename:'bundle.js'},resolve:{alias:{'@':path.resolve('src')},extensions:['.tsx','.ts','.js','.mjs','.json']},module:{rules:[{test:/\.tsx?$/,use:[path.join(output,'loader.cjs')]}]},devtool:false},(err,stats)=>err||stats.hasErrors()?reject(err||Error(stats.toString({all:false,errors:true}))):resolve()));
}
async function main() {
  await build();
  const server = http.createServer((request,response)=>{
    if(request.url==='/bundle.js'){response.setHeader('Content-Type','text/javascript');response.end(fs.readFileSync(path.join(output,'bundle.js')));}
    else if(request.url?.startsWith('/api/')){response.statusCode=403;response.end('No API allowed');}
    else {response.setHeader('Content-Type','text/html');response.end('<!doctype html><html lang="es"><meta charset="utf-8"><body><div id="root"></div><script src="/bundle.js"></script></body></html>');}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const {chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
  const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1100,height:1000}}),errors=[];
    page.setDefaultTimeout(60000);
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:'+server.address().port);
    const document=page.getByLabel('Documento editable: Especificaciones de prueba',{exact:true});
    const object=document.getByRole('textbox',{name:'Objeto',exact:true}).first();
    await object.fill('Equipos de protección personal');
    await object.press('End');await object.pressSequentially(' nuevos');
    assert.equal(await object.textContent(),'Equipos de protección personal nuevos');
    assert.equal(await document.getByRole('textbox',{name:'Objeto',exact:true}).last().textContent(),'Equipos de protección personal nuevos','Campo repetido actualizado sin perder caret');
    await document.getByRole('textbox',{name:'Destinatario: cargo',exact:true}).fill('Superintendente');
    await document.getByRole('textbox',{name:'Destinatario: nombre',exact:true}).fill('Ana Pérez');
    await document.getByRole('radio',{name:'Existencia en almacén: Con saldo',exact:true}).click();
    assert.equal(await document.getByRole('radio',{name:'Existencia en almacén: Con saldo',exact:true}).getAttribute('aria-checked'),'true');
    assert.equal(await document.getByRole('radio',{name:'Existencia en almacén: Sin saldo',exact:true}).getAttribute('aria-checked'),'false');
    const background=document.getByRole('textbox',{name:'Antecedentes',exact:true});await background.fill('Texto ');await background.press('End');
    await background.evaluate(element=>{const clipboard=new DataTransfer();clipboard.setData('text/plain','pegado <script>literal</script>');clipboard.setData('text/html','<img src=x onerror=alert(1)><script>alert(1)</script>');element.dispatchEvent(new ClipboardEvent('paste',{clipboardData:clipboard,bubbles:true,cancelable:true}));});
    assert.equal(await background.textContent(),'Texto pegado <script>literal</script>');
    assert.equal(await background.locator('script,img').count(),0,'Pegar conserva solo texto plano');
    await document.getByRole('textbox',{name:'Cantidad, ítem 1',exact:true}).fill('10');
    await page.getByRole('button',{name:'Añadir ítem',exact:true}).click();
    await document.getByRole('textbox',{name:'Descripción, ítem 2',exact:true}).fill('Casco de seguridad');
    await page.getByRole('button',{name:'Quitar ítem 2',exact:true}).click();
    assert.equal(await document.getByRole('textbox',{name:'Descripción, ítem 2',exact:true}).count(),0);
    assert.equal(await document.getByRole('textbox',{name:'Cantidad, ítem 1',exact:true}).textContent(),'10');
    assert.equal(await document.locator('[rowspan="2"][colspan="2"]').count(),1,'Celdas combinadas se conservan');
    assert.equal(await document.getByText('Título fijo institucional',{exact:true}).getAttribute('contenteditable'),null,'Títulos fijos no editables');
    assert.equal(await document.locator('script,iframe,svg,img[src^="https:"]').count(),0);
    assert.equal(await document.getByRole('img',{name:'Logo de prueba'}).count(),1);
    await page.getByRole('button',{name:'Cambiar ocupado',exact:true}).click();
    assert.equal(await object.getAttribute('contenteditable'),'false');
    await page.getByRole('button',{name:'Cambiar ocupado',exact:true}).click();
    await page.getByRole('button',{name:'Guardar cambios de prueba',exact:true}).click();
    const persisted=JSON.parse(await page.getByTestId('draft').textContent());
    assert.equal(persisted.fields.destinatario,'Ana Pérez\nSuperintendente');
    assert.equal(persisted.fields.objeto,'Equipos de protección personal nuevos');
    await page.reload();
    await page.getByText('Celda combinada fija',{exact:true}).waitFor();
    assert.equal(await document.getByRole('textbox',{name:'Antecedentes',exact:true}).textContent(),'Texto pegado <script>literal</script>');
    assert.equal(await document.getByRole('textbox',{name:'Descripción, ítem 1',exact:true}).textContent(),'Arnés de seguridad');
    assert.equal(await document.getByRole('textbox',{name:'Cantidad, ítem 1',exact:true}).textContent(),'10');
    assert.deepEqual(errors,[]);
    await page.screenshot({path:path.join(output,'editor-documento-prueba.png'),fullPage:true});
    console.log('PASS editor: texto y celdas dentro del formato, cursor y campos repetidos, pegado plano, logo y celdas combinadas, casillas S1, añadir/quitar, bloqueo ocupado y recuperación.');
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
