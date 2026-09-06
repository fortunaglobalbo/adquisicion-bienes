const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const JSZip = require('jszip');
const { DOMParser } = require('@xmldom/xmldom');
const root = path.resolve(__dirname, '..');
require.extensions['.ts'] = (m, file) => m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
}).outputText, file);
const resolve = Module._resolveFilename;
Module._resolveFilename = function(name, ...args) { return resolve.call(this, name.startsWith('@/') ? path.join(root, 'src', name.slice(2)) : name, ...args); };
const { inspectTemplate, fillTemplate, validateChanges } = require('../src/lib/docx/templateEditor.ts');
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const p = text => `<w:p><w:r><w:rPr><w:b/><w:sz w:val="24"/></w:rPr><w:t>${text}</w:t></w:r></w:p>`;
const row = values => `<w:tr>${values.map(v => `<w:tc><w:tcPr><w:shd w:fill="eeeeee"/></w:tcPr>${p(v)}</w:tc>`).join('')}</w:tr>`;
async function fixture(merged = false) {
  const zip = new JSZip();
  zip.file('word/document.xml', `<w:document xmlns:w="${W}"><w:body>${p('Objeto: COMPRA ANTERIOR')}${p('ANTECEDENTES')}${p('Texto anterior')}<w:tbl>${row(['Descripción', 'Cantidad'])}${row(['Ejemplo antiguo', '99'])}</w:tbl>${p('[PENDIENTE otro campo]')}<w:sectPr/></w:body></w:document>`.replace(merged ? '<w:tcPr>' : 'NONEXISTENT', '<w:tcPr><w:gridSpan w:val="2"/>'));
  zip.file('word/header1.xml', `<w:hdr xmlns:w="${W}">${p('Institución')}</w:hdr>`);
  zip.file('word/media/logo.png', Buffer.from([1, 2, 3, 4, 5]));
  zip.file('word/styles.xml', '<styles>unchanged</styles>');
  return zip.generateAsync({ type: 'nodebuffer' });
}
async function main() {
  const source = await fixture();
  const s = await inspectTemplate(source);
  const changes = [{ target: s.paragraphs[0].id, label: 'Objeto', value: 'Objeto: Cable & accesorios <nuevos>', sourceIds: [] }];
  const tables = [{ target: s.tables[0].id, label: 'Ítems', rows: [['Cable', '4'], ['Pinza', '2'], ['Guantes', '6']] }];
  const result = await fillTemplate(source, changes, tables);
  const zip = await JSZip.loadAsync(result);
  const after = await inspectTemplate(result);
  assert.equal(after.paragraphs[0].text, changes[0].value);
  assert.deepEqual(after.tables[0].rows, tables[0].rows);
  assert.equal(after.tables[0].headers[0], 'Descripción');
  assert.equal((await zip.file('word/styles.xml').async('string')), '<styles>unchanged</styles>');
  assert.deepEqual(await zip.file('word/media/logo.png').async('nodebuffer'), Buffer.from([1, 2, 3, 4, 5]));
  assert.equal(await zip.file('word/header1.xml').async('string'), await (await JSZip.loadAsync(source)).file('word/header1.xml').async('string'));
  const xml = new DOMParser().parseFromString(await zip.file('word/document.xml').async('string'));
  assert.ok(xml.getElementsByTagNameNS(W, 'b').length >= 8);
  assert.equal(xml.getElementsByTagNameNS(W, 'shd').length, 8);
  console.log('PASS reemplaza objeto e ítems; conserva encabezados, estilos, formato de celdas y logo');
  const blankZip = new JSZip(); blankZip.file('word/document.xml', `<w:document xmlns:w="${W}"><w:body>${p('ANTECEDENTES')}<w:p/></w:body></w:document>`);
  const blankBuffer = await blankZip.generateAsync({type:'nodebuffer'});
  const blankStructure = await inspectTemplate(blankBuffer);
  assert.equal(blankStructure.paragraphs[1].text,'');
  const blankFilled = await fillTemplate(blankBuffer,[{target:blankStructure.paragraphs[1].id,label:'Antecedentes',value:'Contenido nuevo',sourceIds:[]}],[]);
  assert.equal((await inspectTemplate(blankFilled)).paragraphs[1].text,'Contenido nuevo');
  console.log('PASS rellena espacios vacíos de una plantilla sin etiquetas');
  assert.throws(() => validateChanges(s, [...changes, ...changes], []));
  assert.throws(() => validateChanges(s, [{ ...changes[0], target: 'no-existe' }], []));
  assert.throws(() => validateChanges(s, [], [{ ...tables[0], rows: [['Una sola columna']] }]));
  assert.throws(() => validateChanges(s, [{ ...changes[0], target: s.tables[0].paragraphIds[0] }], tables));
  const merged = await inspectTemplate(await fixture(true));
  assert.equal(merged.tables[0].editable, false);
  assert.throws(() => validateChanges(merged, [], tables));
  await assert.rejects(inspectTemplate(Buffer.from('not a word')));
  console.log('PASS rechaza destinos desconocidos, duplicados, tablas ambiguas y superposición de cambios');
  const official = fs.readFileSync(path.join(root, 'public/TDR_7Paginas_Oficial_ENDE_Deoruro.docx'));
  const officialStructure = await inspectTemplate(official);
  assert.ok(officialStructure.paragraphs.length > 10);
  const officialChanged = await fillTemplate(official, [{ target: officialStructure.paragraphs[0].id, label: 'Prueba', value: 'PRUEBA DE CONSERVACIÓN', sourceIds: [] }], []);
  const oldZip = await JSZip.loadAsync(official), newZip = await JSZip.loadAsync(officialChanged);
  for (const name of Object.keys(oldZip.files).filter(n => !oldZip.files[n].dir && !/^word\/(document|header\d+|footer\d+)\.xml$/.test(n))) {
    assert.deepEqual(await oldZip.file(name).async('nodebuffer'), await newZip.file(name).async('nodebuffer'), name);
  }
  console.log('PASS plantilla institucional real: conserva todos los recursos y relaciones del Word');

  let evidenceFails = false;
  const mockPlan = { changes: [{ ...changes[0], label: 'Multas', category: 'normative', value: 'Regla sin evidencia', sourceIds: ['fuente-inventada'] }], tables: [], warnings: [] };
  const load = Module._load;
  Module._load = function(name, ...args) {
    if (name === './openCodeClient') return { callOpenCodeGo: async () => JSON.stringify(mockPlan), extractJsonFromText: JSON.parse };
    if (name === './anythingLlmClient') return { AnythingLlmClient: { queryWorkspace: async (_prompt, _slug, mode) => { assert.equal(mode, 'query'); if (evidenceFails) throw Error('draft unavailable'); return JSON.stringify(mockPlan); }, queryWorkspaceWithSources: async () => { if (evidenceFails) throw Error('offline'); return { answer: 'regla', sources: [{ id: 'fuente-1', title: 'Norma', excerpt: 'Regla documentada', page: '1', version: '2026' }] }; } } };
    return load.call(this, name, ...args);
  };
  const { prepareDocument } = require('../src/lib/ai/documentAssistant.ts');
  const draft = await prepareDocument(s, 'Compra de cable, 4 unidades', 'TDR');
  assert.match(draft.changes[0].value, /PENDIENTE/);
  assert.deepEqual(draft.changes[0].sourceIds, []);
  assert.ok(draft.warnings.some(w => /fuera del llenado/.test(w)));
  evidenceFails = true;
  const offlineDraft = await prepareDocument(s, 'Compra de cable, 4 unidades', 'TDR');
  assert.equal(offlineDraft.normativeStatus, 'unavailable');
  assert.ok(offlineDraft.warnings.some(w => /No se recuperaron/.test(w)));
  console.log('PASS no acepta fuentes inventadas; señala falta de normativa y campos no cubiertos');
  const { POST } = require('../src/app/api/document-assistant/route.ts');
  const form = new FormData(); form.append('template', new File([source],'modelo.docx')); form.append('context','Compra de 4 cables para mantenimiento');
  const response = await POST(new Request('http://local/api/document-assistant',{method:'POST',body:form}));
  assert.equal(response.status,200);
  const prepared = await response.json();
  const downloadForm = fingerprint => {
    const data = new FormData(); data.append('template',new File([source],'modelo.docx')); data.append('action','download'); data.append('fingerprint',fingerprint); data.append('plan',JSON.stringify({changes:prepared.changes,tables:prepared.tables})); return data;
  };
  const download = await POST(new Request('http://local/api/document-assistant',{method:'POST',body:downloadForm(prepared.fingerprint)}));
  assert.equal(download.status,200); assert.match(download.headers.get('content-type'),/wordprocessingml/);
  const downloadedStructure = await inspectTemplate(Buffer.from(await download.arrayBuffer()));
  assert.equal(downloadedStructure.paragraphs[0].text,prepared.changes[0].value);
  const stale = await POST(new Request('http://local/api/document-assistant',{method:'POST',body:downloadForm('plantilla-distinta')}));
  assert.equal(stale.status,400);
  console.log('PASS recorrido de API con IA simulada: prepara y descarga; rechaza plantilla cambiada');
  console.log('Pruebas del asistente completas.');
}
main().catch(e => { console.error(e); process.exitCode = 1; });
