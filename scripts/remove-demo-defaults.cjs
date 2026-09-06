const fs=require('fs');const path=require('path');const ts=require('typescript');
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
for(const file of walk('src')){
 if(!/\.(ts|tsx)$/.test(file)||/initialData|tdrGoldStandards|types[\\/]index/.test(file))continue;
 let s=fs.readFileSync(file,'utf8');
 const tree=ts.createSourceFile(file,s,ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 const edits=[];
 function visit(node){
  if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node)){
   const v=node.text;
   if(/MOVICLEAN|Moviclean|ARIOL IMPORT|1041-505958|Cincuenta y ocho mil|Banco Económico|GG-SPA-26\/070002|GG-CTO-26\/040014|INF.DE ORURO N|INF\.DE ORURO|23 de Julio de 2026|19\/06\/2026|30\/06\/2026|Sin observaciones \/|Se concluye que el proveedor cumple|cumplido satisfactoriamente|mes de junio de 2026/i.test(v) || /^(?:Ing\.|ING\.|Lic\.|LIC\.)\s+(?:Heydi|Tatiana|Vicente|Ra[uú]l|Gabriela|Juan|Roberto|M[oó]nica)/i.test(v)) {
    edits.push([node.getStart(tree),node.end,JSON.stringify('[PENDIENTE DE COMPLETAR Y VERIFICAR]')]);
   }
  }
  ts.forEachChild(node,visit);
 }
 visit(tree);for(const [a,b,v] of edits.sort((a,b)=>b[0]-a[0]))s=s.slice(0,a)+v+s.slice(b);
 s=s.replace(/58333\.0\b/g,'0').replace(/DE MOVICLEAN S\.R\.L\./g,'DE [PROVEEDOR PENDIENTE]').replace(/para la empresa MOVICLEAN S\.R\.L\., la cual cumple con las especificaciones técnicas y menor precio que se solicitó en el proceso de adquisición\./g,'para la empresa [PROVEEDOR PENDIENTE]. [REGISTRAR LA EVALUACIÓN DOCUMENTADA].');
 s=s.replace(/adquisicion\.memo_pago_nro_factura \|\| "2"/g,'adquisicion.memo_pago_nro_factura || "[FACTURA PENDIENTE]"');
 fs.writeFileSync(file,s);
}
