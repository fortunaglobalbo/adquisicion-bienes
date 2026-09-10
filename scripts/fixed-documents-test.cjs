const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),Module=require('module'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const resolve=Module._resolveFilename;
Module._resolveFilename=function(name,...args){return resolve.call(this,name.startsWith('@/')?path.join(root,'src',name.slice(2)):name,...args)};
let goResponse='',queried='',goCalls=0,offline=false,goMessages=[];
const load=Module._load;
Module._load=function(name,...args){
 if(name.endsWith('/ai/openCodeClient')) return {callOpenCodeGo:async(messages)=>{if(messages[0].content.includes("EXTRACT_DOCUMENT_EVIDENCE"))return JSON.stringify({facts:[],missing:[],conflicts:[]});goMessages=messages;goCalls++;return goResponse;},extractJsonFromText:JSON.parse};
 if(name.endsWith('/ai/anythingLlmClient')) return {AnythingLlmClient:{searchWorkspaceSources:async(_p,slug)=>{queried=slug;if(offline)throw Error('offline');return{answer:'Fundamento',sources:[{id:'fuente-1',title:'Reglamento',excerpt:'Condiciones verificables',page:'18',version:'04'}]};}}};
 return load.call(this,name,...args);
};
const {FIXED_MODELS}=require('../src/lib/docx/fixedModels.ts');
const {seedFixedDraft,renderFixedWord,completeFixedDocument,normalizeFixedDraft}=require('../src/lib/server/fixedDocuments.ts');
const {inspectTemplate}=require('../src/lib/docx/templateEditor.ts');
const adq={id:'test',empresa_id:'ende',codigo:'PRUEBA',titulo_proceso:'COMPRA DE CABLE',categoria:'Bienes',responsable_proceso:'Responsable',unidad_solicitante:'Unidad',lugar_entrega:'Oruro',plazo_entrega_dias:20,prevision_presupuesto:10,items:[{id:'i1',item:1,descripcion:'Cable',unidad:'m',cantidad:4,precioUnitarioEstimado:2.5,especificacionMinima:'Características aportadas'}]};
async function main(){
 const official=seedFixedDraft(2,{...adq,responsables_oficiales:{2:{solicitante:'Nombre oficial',cargo:'Cargo oficial',objeto:'No corresponde'}}});
 assert.equal(official.fields.solicitante,'Nombre oficial');assert.ok(official.editedFields.includes('solicitante'));assert.equal(official.fields.objeto,adq.titulo_proceso);
 assert.equal(seedFixedDraft(2,adq).fields.solicitante,'Responsable');
 assert.equal(seedFixedDraft(4,{...adq,responsables_oficiales:{4:{destinatario:'Proveedor anterior'}}}).fields.destinatario,'[PENDIENTE]');
 console.log('PASS responsables por formulario; expedientes anteriores y proveedores separados');
 fs.mkdirSync('test-results/fixed-models/filled',{recursive:true});
 for(const model of FIXED_MODELS){
  const draft=seedFixedDraft(model.number,adq);
  for(const field of model.fields)draft.fields[field.key]=field.normative?'[PENDIENTE: fundamento normativo]':field.key==='objeto'?adq.titulo_proceso:'Dato de prueba '+field.label;
  draft.items=model.columns.length?Array.from({length:3},(_,i)=>Object.fromEntries(model.columns.map(c=>[c.key,c.key==='numero'?String(i+1):c.key==='cantidad'?'4':c.key==='precio'?'2.50':c.key.endsWith('oferta')?'':c.key==='descripcion'?'Cable para mantenimiento '+(i+1):'Dato de prueba']))):[];
  const {buffer}=await renderFixedWord(model.number,draft);
  fs.writeFileSync(`test-results/fixed-models/filled/${model.file}`,buffer);
  const result=await inspectTemplate(buffer),all=result.paragraphs.map(p=>p.text).join('\n');
  assert.ok(!all.includes('{{'),'No deben quedar etiquetas internas en '+model.number);
  assert.ok(!/TREPADERAS|BOTAS DE SEGURIDAD|HERRAMIENTA PARA CUADRILLAS|SEPTIEMBRE - 2026|047\/2026|143.500/.test(all));
  if(model.columns.length){const found=result.tables.find(t=>t.headers.join('|')===model.columns.map(c=>c.label).join('|'));assert.ok(found);assert.equal(found.rows.length,3);}
 }
 console.log('PASS siete modelos: campos completos, sin datos heredados, tablas de tres filas');
 const d=seedFixedDraft(3,adq);d.items=[{numero:'1',cantidad:'4',precio:'2,50',unidad:'m',descripcion:'Cable',activo:'Nuevo'}];
 assert.equal(normalizeFixedDraft(FIXED_MODELS[2],d).fields.presupuesto,'10.00');
 d.items[0].precio='1.234,56';assert.equal(normalizeFixedDraft(FIXED_MODELS[2],d).fields.presupuesto,'[PENDIENTE]');
 d.items=[];d.fields.presupuesto='10.00';assert.equal(normalizeFixedDraft(FIXED_MODELS[2],d).fields.presupuesto,'[PENDIENTE]');
 const long=seedFixedDraft(1,adq);long.items=Array.from({length:30},(_,i)=>({...long.items[0],numero:String(i+1),descripcion:'Cable para mantenimiento '+(i+1)}));
 const longOutput=await renderFixedWord(1,long);fs.writeFileSync('test-results/fixed-models/filled/tdr-30-items.docx',longOutput.buffer);
 const longStructure=await inspectTemplate(longOutput.buffer);assert.equal(longStructure.tables.find(t=>t.headers.includes('CANTIDAD')).rows.length,30);
 const s2=seedFixedDraft(6,adq);s2.items[0].precio_oferta='99';assert.equal(normalizeFixedDraft(FIXED_MODELS[5],s2).items[0].precio_oferta,'99');
 for(const n of [2,4,5]) { const empty=seedFixedDraft(n,adq);assert.equal(empty.items.length,0);await renderFixedWord(n,empty); }
 const formDraft=seedFixedDraft(2,adq);formDraft.fields.almacen='Con saldo';formDraft.fields.publicar_precio='No';formDraft.fields.con_presupuesto='[PENDIENTE]';formDraft.fields.solicitante='<script>no ejecutar</script>';
 const formWord=await renderFixedWord(2,formDraft);const {wordFormPreview}=require('../src/lib/server/wordFormPreview.ts');const formHtml=await wordFormPreview(formWord.buffer);
 assert.ok(formHtml.includes('&lt;script&gt;'));assert.ok(!formHtml.includes('<script>'));assert.ok(formHtml.includes('rowspan="4"'));assert.equal((formHtml.match(/☒/g)||[]).length,2,'Solo las dos decisiones confirmadas se marcan');
 const letter=seedFixedDraft(4,adq);letter.fields.cuerpo='Saludo\n\nPrimer párrafo\nSegundo párrafo';
 const letterWord=await renderFixedWord(4,letter);const letterHtml=(await require('mammoth').convertToHtml({buffer:letterWord.buffer})).value;
 assert.ok(letterHtml.includes('Saludo<br /><br />Primer párrafo<br />Segundo párrafo'),'Word debe conservar párrafos y saltos de línea');
 assert.equal(seedFixedDraft(7,adq).items.length,0);
 assert.throws(()=>seedFixedDraft(1,{...adq,empresa_id:'otra-empresa'}));
 console.log('PASS importes, precios del proveedor vacíos, recepción no supuesta y empresa ajena rechazada');
 const tdr=seedFixedDraft(1,adq);
 goResponse=JSON.stringify({fields:{...tdr.fields,multas:'Regla inventada'},items:tdr.items,sourceIds:{multas:['fuente-no-existe']},warnings:[]});
 const drafted=await completeFixedDocument(1,adq,tdr,'Compra de cable');
 assert.equal(queried,process.env.ANYTHINGLLM_WORKSPACE||'adquisiciones-ende');
 assert.equal(drafted.fields.multas,'[PENDIENTE]');assert.equal(goCalls,1);
 offline=true;const noSources=await completeFixedDocument(1,adq,tdr,'Compra');assert.equal(noSources.normativeStatus,'unavailable');assert.ok(noSources.warnings.length);
 goResponse='';await assert.rejects(()=>completeFixedDocument(1,adq,tdr,'Compra'),/OpenCode GO/);
 console.log('PASS GO como único redactor; fuente inexistente y biblioteca caída no certifican normas');
 const {POST}=require('../src/app/api/fixed-documents/route.ts');
 const request=(data)=>{const form=new FormData();form.append('request',JSON.stringify(data));return new Request('http://local/api/fixed-documents',{method:'POST',body:form});};
 const exported=await POST(request({action:'export',number:1,adquisicion:adq,draft:tdr}));assert.equal(exported.status,200);assert.ok((await exported.json()).docx);
 const wrong=await POST(request({action:'export',number:1,adquisicion:adq,draft:{...tdr,companyId:'otra'}}));assert.equal(wrong.status,400);
 const obsolete=await POST(request({action:'export',number:1,adquisicion:adq,draft:{...tdr,modelVersion:'anterior'}}));assert.equal(obsolete.status,400);
 console.log('PASS API exporta DOCX y rechaza empresa o versión incompatibles');
 goResponse=JSON.stringify({fields:tdr.fields,items:tdr.items,sourceIds:{},warnings:[]});
 const imageForm=new FormData();imageForm.append('request',JSON.stringify({action:'complete',number:1,adquisicion:adq,draft:tdr}));
 const png=Buffer.from([137,80,78,71,13,10,26,10]);
 imageForm.append('attachments',new Blob([png],{type:'image/png'}),'foto.png');
 const vision=await POST(new Request('http://local/api/fixed-documents',{method:'POST',body:imageForm}));assert.equal(vision.status,200);
 assert.ok(goMessages[1].content.some(p=>p.type==='image_url'&&p.image_url.url==='data:image/png;base64,'+png.toString('base64')));
 console.log('PASS adjunto de imagen enviado a visión junto con contexto y fuentes');
}
main().catch(e=>{console.error(e);process.exitCode=1});
