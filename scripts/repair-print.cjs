const fs=require('fs');
for(const name of ['TdrDocumentViewer','SolicitudInicioViewer','FormS2Viewer','InformeConformidadViewer','MemoPagoViewer']) {
 const file='src/components/expediente/'+name+'.tsx';let s=fs.readFileSync(file,'utf8');
 s=s.replace(/className="w-full max-w-full lg:max-w-\[1050px\] bg-white border border-outline-variant shadow-xl/g,m=>m.replace('className="','className="print-document '));
 s=s.replace(/className="w-full max-w-\[816px\] min-h-\[1056px\]/g,'className="print-document w-full max-w-[816px] min-h-[1056px]');
 s=s.replace(/className="w-full max-w-\[850px\] bg-white border(?:-2)? border-(?:outline-variant|black) shadow-xl/g,m=>m.replace('className="','className="print-document '));
 // Add a consistent explicit print action next to the download action.
 if(!s.includes('Imprimir / guardar PDF')) s=s.replace(/(<button\s+[^]*?onClick=)/, '$1');
 fs.writeFileSync(file,s);
}
