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
 const manual={...draft,fields:{...draft.fields,objeto:'Nombre elegido por el usuario'},editedFields:['objeto']};assert.equal((await renderFixedWord(1,manual,adq)).draft.fields.objeto,manual.fields.objeto);
 const {POST}=require('../src/app/api/fixed-documents/route.ts');const form=new FormData();form.append('request',JSON.stringify({action:'export',number:1,adquisicion:adq,draft}));
 const response=await POST(new Request('http://test/api/fixed-documents',{method:'POST',body:form}));const result=await response.json();assert.equal(response.status,200,result.error);assert.equal(result.draft.fields.objeto,adq.titulo_proceso);assert.ok(result.docx);
 console.log('PASS TDR línea viva: título específico en portada y cabecera, reparación del borrador antiguo al exportar, siete ítems y edición manual conservados sin llamadas IA ni escrituras.');
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
