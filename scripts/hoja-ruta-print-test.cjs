// Isolated rendering of the real components and global CSS; no database access or saved records.
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),ts=require('typescript');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const postcss=require('postcss'),tailwind=require('tailwindcss');
const {chromium}=require(require.resolve('playwright',{paths:[process.cwd(),path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')]}));
require.extensions['.tsx']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText,file);
// Toolbar icons never appear on paper; avoid the package's mixed ESM/CJS entry in this Node-only harness.
const Module=require('node:module'),load=Module._load;
Module._load=function(id,...args){if(id==='lucide-react')return{Printer:()=>React.createElement('svg'),X:()=>React.createElement('svg')};return load.call(this,id,...args)};
const {HojaRutaGeneralPrintSlip}=require('../src/components/hoja-ruta/HojaRutaGeneralPrintSlip.tsx');
const {HojaRutaPrintSlip}=require('../src/components/hoja-ruta/HojaRutaPrintSlip.tsx');
Module._load=load;
const root=path.resolve('test-results/hoja-ruta-print');fs.mkdirSync(root,{recursive:true});
const rows=Array.from({length:75},(_,i)=>({id:`fixture-${i+1}`,cite_correlativo:`PRUEBA-${String(i+1).padStart(3,'0')}`,secuencia_numero:i+1,fecha_ingreso:'2026-09-18',hora_ingreso:'09:00',tipo_documento:'SOLICITUD/TDR',institucion_area_origen:'ADMINISTRACION',categoria:'CAT 1',asunto_descripcion:`Solicitud de materiales para mantenimiento, registro ${i+1}.`,ubicacion_actual:'DISTRIBUCION',estado_actual:'En Circulación',pases:[],enviado:true}));
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const cases=[['general',HojaRutaGeneralPrintSlip,{hojas:rows},'landscape'],['individual',HojaRutaPrintSlip,{hoja:rows[0]},'portrait']];
  for(const [name,Component,props,orientation] of cases){
   let report=renderToStaticMarkup(React.createElement(Component,{...props,onClose:()=>{}}));
   const logo='data:image/png;base64,'+fs.readFileSync('public/logo-ende-deoruro.png').toString('base64');report=report.replaceAll('/logo-ende-deoruro.png',logo);
   const shell=`<div class="flex h-screen w-screen overflow-hidden"><aside>NAVEGACION_NO_IMPRIMIR</aside><div class="flex-1 flex flex-col h-screen overflow-hidden md:ml-64"><main class="min-h-screen p-6"><div>FORMULARIO_NO_IMPRIMIR</div>${report}</main></div></div>`;
   const css=(await postcss([tailwind({content:[{raw:shell,extension:'html'}]})]).process(fs.readFileSync('src/app/globals.css','utf8'),{from:'src/app/globals.css'})).css;
   await page.setContent(`<!doctype html><html lang="es" style="zoom:0.85"><head><meta charset="utf-8"><style>${css}</style></head><body>${shell}</body></html>`);
   await page.emulateMedia({media:'print'});
   const visible=await page.locator('h1').isVisible();
   assert.equal(visible,true,`${name}: el título del documento queda oculto al imprimir`);
   assert.equal(await page.locator('.print-document').count(),1);
   assert.equal(await page.getByText('FORMULARIO_NO_IMPRIMIR').isVisible(),false);
   assert.equal(await page.getByText('NAVEGACION_NO_IMPRIMIR').isVisible(),false);
   assert.equal(await page.getByRole('button').first().isVisible(),false);
   assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).zoom),'1','La lupa de pantalla no debe escalar el papel');
   assert.equal(await page.locator('.print-document thead th').count(),5);
   await page.pdf({path:path.join(root,`${name}.pdf`),preferCSSPageSize:true,printBackground:true});
   await page.screenshot({path:path.join(root,`${name}.png`)});
   if(name==='general')assert.equal(await page.locator('.print-document tbody tr').count(),75);
   console.log(`PASS ${name}: visible al imprimir, cinco columnas, sin interfaz ni escala de lupa; PDF ${orientation}`);
  }
  const {CanvasFactory,getData}=require('pdf-parse/worker');const {PDFParse}=require('pdf-parse');PDFParse.setWorker(getData());
  for(const name of ['general','individual']){
   const parser=new PDFParse({data:fs.readFileSync(path.join(root,`${name}.pdf`)),CanvasFactory});
   try{const result=await parser.getText();const info=await parser.getInfo({parsePageInfo:true});
    assert.ok(!result.text.includes('NO_IMPRIMIR'));
    assert.ok(result.pages.every(p=>p.text.trim().length>30),'No debe haber páginas vacías');
    if(name==='general'){assert.ok(result.total>1);for(const row of rows)assert.ok(result.text.includes(row.cite_correlativo),`Falta ${row.cite_correlativo}`);for(const p of result.pages)assert.ok(p.text.includes('Correlativo'),'Cabecera repetida en cada página');}
    else assert.ok(result.text.includes('PRUEBA-001'));
    for(const page of info.pages){assert.ok(Math.abs(page.width-(name==='general'?792:612))<1);assert.ok(Math.abs(page.height-(name==='general'?612:792))<1);}
    console.log(`PASS PDF ${name}: ${result.total} páginas Carta, orientación correcta y contenido completo`);
   }finally{await parser.destroy();}
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1});
