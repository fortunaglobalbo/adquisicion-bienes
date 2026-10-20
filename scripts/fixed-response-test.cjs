const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),Module=require('module'),ts=require('typescript');
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const resolve=Module._resolveFilename;Module._resolveFilename=function(name,...args){return resolve.call(this,name.startsWith('@/')?path.join(process.cwd(),'src',name.slice(2)):name,...args)};
const {extractJsonFromText}=require('../src/lib/ai/openCodeClient.ts');
let reply='',goCalls=0;
const load=Module._load;Module._load=function(name,...args){
 if(name.endsWith('/ai/openCodeClient'))return {extractJsonFromText,callOpenCodeGo:async(messages)=>{if(messages[0].content.includes('EXTRACT_DOCUMENT_EVIDENCE'))return JSON.stringify({facts:[],missing:[],conflicts:[]});goCalls++;return reply;}};
 if(name.endsWith('/ai/anythingLlmClient'))return {AnythingLlmClient:{searchWorkspaceSources:async()=>({sources:[]})}};
 return load.call(this,name,...args);
};
const {seedFixedDraft,completeFixedDocument,normalizeFixedDraft}=require('../src/lib/server/fixedDocuments.ts');
const {fixedModel}=require('../src/lib/docx/fixedModels.ts');
const items=['Amortiguador de impacto','Arnés de cuerpo completo','Casco rojo','Casco blanco','Barbiquejo con mentonera','Guante protector de cuero','Lente de seguridad oscuro','Guante de cabretilla'].map((descripcion,i)=>({descripcion,cantidad:String(i+8),unidad:'Pza',especificaciones:'Referencia declarada '+i,precio:'10'}));
const adq={id:'safe-response-test',empresa_id:'ende',titulo_proceso:'Compra de EPP',categoria:'Bienes',responsable_proceso:'Responsable conocido',unidad_solicitante:'Seguridad Industrial',lugar_entrega:'',plazo_entrega_dias:0,prevision_presupuesto:0,items:items.map((item,i)=>({id:'epp-'+i,item:i+1,descripcion:item.descripcion,unidad:item.unidad,cantidad:Number(item.cantidad),precioUnitarioEstimado:10,especificacionMinima:item.especificaciones})),asistente_compra:{revision:'eight-items',confirmedAt:null,preparedAt:'2026-10-12',purpose:'Dotar al personal de equipos de protección personal.',notes:'',location:'',deliveryDays:'',items,facts:[],conflicts:[],clarification:'',details:{}}};
const current=seedFixedDraft(1,adq);const fields={...current.fields,antecedentes:'ENDE DEORURO S.A. requiere estos equipos para las tareas de operación y mantenimiento de sus redes.',justificacion:'Los elementos de protección personal contribuyen al desarrollo seguro de las actividades del personal.'};
async function generation(value,draft=current,acquisition=adq,number=1){reply=typeof value==='string'?value:JSON.stringify(value);const before=goCalls;const result=await completeFixedDocument(number,acquisition,draft,'');assert.equal(goCalls,before+1,'Ninguna segunda llamada para reparar el formato');return result;}
const exactRows=result=>assert.deepEqual(result.items.map(item=>[item.descripcion,item.cantidad,item.unidad]),items.map(item=>[item.descripcion,item.cantidad,item.unidad]));
async function main(){
 for(const response of [{fields,items:[]},{draft:{fields,items:[]}},{result:{fields,items:[]}},{data:{draft:{fields,items:[]}}},{...fields,items:[]}]){
  const result=await generation(response);assert.equal(result.fields.antecedentes,fields.antecedentes);exactRows(result);
 }
 for(const malformed of [null,{rows:[]},'ignorar',[{cantidad:999}]]){const result=await generation({fields,items:malformed});exactRows(result);}
 const partial=await generation({draft:{fields:{objeto:'Adquisición de equipos de protección personal'},items:null}});
 exactRows(partial);assert.match(partial.fields.antecedentes,/sector eléctrico/);assert.match(partial.fields.justificacion,/desarrollo seguro/);
 for(const key of ['antecedentes','justificacion']){assert.ok(partial.fields[key].length>200,'El párrafo '+key+' debe quedar redactado');assert.ok(!/PENDIENTE|cotizaci[oó]n|\bBs\b|16998|ANSI|certificados/i.test(partial.fields[key]),'No rellenar '+key+' con cotización o afirmaciones inventadas');}
 const manualBlank={...current,fields:{...current.fields,antecedentes:'',justificacion:''},editedFields:['antecedentes','justificacion']};
 const blank=await generation({data:{fields:{objeto:'Adquisición de equipos de protección personal'},items:null}},manualBlank);assert.equal(blank.fields.antecedentes,'');assert.equal(blank.fields.justificacion,'');exactRows(blank);
 const manual={...current,fields:{...current.fields,antecedentes:'Párrafo que el usuario corrigió.'},editedFields:['antecedentes'],items:current.items.map((item,i)=>({...item,cantidad:String(i+25)})),editedItems:true};
 const conserved=await generation({result:{fields,items:null}},manual);assert.equal(conserved.fields.antecedentes,manual.fields.antecedentes);assert.deepEqual(conserved.items,manual.items);
 const {parseFixedDocumentResponse}=require('../src/lib/server/fixedDocumentResponse.ts');
 const numeric=parseFixedDocumentResponse(JSON.stringify({fields:{numero:24,objeto:'Compra de equipos'},items:[{numero:1,empresa:'Proveedor',cotizacion:'Oferta',precio:68562,respaldo:'Documento adjunto'}]}),fixedModel(3),{authoritativeItems:false,allowMissingItems:false});
 assert.equal(numeric.fields.numero,'24');assert.equal(numeric.items[0].numero,'1');assert.equal(numeric.items[0].precio,'68562');
 const duplicate='```json\n'+JSON.stringify({fields,items:[]})+'\n```\n```json\n'+JSON.stringify({fields,items:[]})+'\n```';exactRows(await generation(duplicate));
 const ambiguous=JSON.stringify({fields,items:[]})+'\n'+JSON.stringify({fields:{...fields,antecedentes:'Otra versión distinta del documento.'},items:[]});
 await assert.rejects(()=>generation(ambiguous),/documento válido|versiones.*distintas/);
 await assert.rejects(()=>generation('{"fields":{"antecedentes":"Texto incompleto'),/documento válido|incompleta/);
 await assert.rejects(()=>generation(JSON.stringify({fields,items:[]})+'\n{"fields":{"antecedentes":"Final truncado'),/documento válido|incompleta/);
 await assert.rejects(()=>generation({fields:{desconocido:'Otro dato'},items:[]}),/documento válido/);
 const oversized={...current,fields:{...fields,antecedentes:'a'.repeat(16001)}};await assert.rejects(()=>generation({fields:oversized.fields,items:[]}),/demasiado extenso/);
 const plain={...adq,asistente_compra:undefined};const rows=Array.from({length:101},(_,i)=>({numero:i+1,descripcion:'Cable '+i,cantidad:4,unidad:'m',especificaciones:'Dato declarado'}));
 await assert.rejects(()=>generation({fields,items:rows},seedFixedDraft(1,plain),plain),/100/);
 assert.throws(()=>normalizeFixedDraft(fixedModel(1),{...current,items:Array.from({length:101},()=>({...current.items[0]}))}),/100/);
 console.log('PASS formatos root/wrappers, tabla autoritativa de ocho ítems, números, correcciones manuales, duplicado idéntico y rechazo seguro de ambiguo/truncado/límites, sin nuevas llamadas IA.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1});
