// From the repository root:
// 1. node scripts/comparative-report-ui-harness.cjs
// 2. In another terminal: node scripts/comparative-report-ui-test.cjs
// Ctrl+C closes this isolated server. It never exposes a real API or database.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..'),base=path.join(root,'test-results','comparative-report-ui-harness');
const port=Number(process.env.COMPARATIVE_TEST_PORT)||3016;
fs.mkdirSync(base,{recursive:true});
fs.writeFileSync(path.join(base,'entry.tsx'),`
import React,{useCallback,useEffect,useState} from 'react';
import{createRoot}from'react-dom/client';
import{ComparativeReportPanel}from'../../src/components/expediente/ComparativeReportPanel';
import{FixedDocumentFolder}from'../../src/components/expediente/FixedDocumentFolder';
import{DataStore}from'../../src/lib/store/dataStore';
import type{Adquisicion,Carpeta}from'../../src/types';
function App(){
 const[adq,setAdq]=useState<Adquisicion>(),[folders,setFolders]=useState<Carpeta[]>([]),[busy,setBusy]=useState(false);
 const refresh=useCallback(()=>{const id=location.pathname.split('/').pop()!;setAdq(DataStore.getAdquisicionById(id));setFolders(DataStore.getCarpetasByAdquisicion(id));},[]);
 useEffect(()=>{void DataStore.syncWithSupabase().then(refresh);},[refresh]);
 return <main style={{maxWidth:1180,margin:'30px auto',padding:20}}>{adq&&<><h1 className="mb-5 text-xl font-bold">Cuadro comparativo · expediente de prueba</h1><ComparativeReportPanel adquisicion={adq} carpetas={folders} onSaved={refresh} onBusyChange={setBusy}/>{folders.find(folder=>folder.numero===3)&&<FixedDocumentFolder key={adq.borradores_ia?.[3]?.updatedAt||'empty'} adquisicion={adq} carpeta={folders.find(folder=>folder.numero===3)!} onSaved={refresh} assistantBusy={busy}/>}</>}</main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
`);
fs.writeFileSync(path.join(base,'ts-loader.cjs'),`module.exports=function(source){return require('typescript').transpileModule(source,{compilerOptions:{module:require('typescript').ModuleKind.ESNext,target:require('typescript').ScriptTarget.ES2020,jsx:require('typescript').JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;};`);
const compiled=require('next/dist/compiled/webpack/webpack');compiled.init();
compiled.webpack({mode:'development',entry:path.join(base,'entry.tsx'),output:{path:base,filename:'bundle.js'},resolve:{alias:{'@':path.join(root,'src')},extensions:['.tsx','.ts','.js','.mjs','.json']},module:{rules:[{test:/\.tsx?$/,use:[path.join(base,'ts-loader.cjs')]}]},devtool:false},async(error,stats)=>{
 if(error||stats.hasErrors()){console.error(error||stats.toString({all:false,errors:true}));process.exitCode=1;return;}
 try{
  const globals=path.join(root,'src','app','globals.css');
  const css=await require('postcss')([require('tailwindcss')({...require(path.join(root,'tailwind.config.ts')).default})]).process(fs.readFileSync(globals,'utf8'),{from:globals});
  fs.writeFileSync(path.join(base,'style.css'),css.css+'\n'+fs.readFileSync(require.resolve('sweetalert2/dist/sweetalert2.min.css'),'utf8'));
  fs.writeFileSync(path.join(base,'index.html'),'<!doctype html><html lang="es"><meta charset="utf-8"><link rel="stylesheet" href="/test-style.css"><body><div id="root"></div><script src="/test-bundle.js"></script></body></html>');
  const server=http.createServer((request,response)=>{
   if(request.url.startsWith('/api/')){response.writeHead(403,{'content-type':'application/json'});response.end(JSON.stringify({error:'Servicios reales bloqueados en la prueba aislada'}));return;}
   const file=request.url==='/test-bundle.js'?'bundle.js':request.url==='/test-style.css'?'style.css':'index.html';
   response.writeHead(200,{'content-type':file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html'});response.end(fs.readFileSync(path.join(base,file)));
  });
  server.on('error',error=>{console.error(error.message);process.exitCode=1;});
  server.listen(port,'127.0.0.1',()=>console.log('Comparativo aislado preparado en http://127.0.0.1:'+port+'. Ejecuta node scripts/comparative-report-ui-test.cjs en otra terminal.'));
 }catch(error){console.error(error);process.exitCode=1;}
});
