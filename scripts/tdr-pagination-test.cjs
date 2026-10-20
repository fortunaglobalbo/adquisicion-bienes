const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const JSZip = require('jszip');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, file);
const { keepTdrHeadingsWithBody } = require('../src/lib/server/wordPagination.ts');
const { invalidatePaginationFields, enableFieldUpdatesOnOpen, WORD_NS: W } = require('../src/lib/server/wordFields.ts');
const elements = (node, name) => Array.from(node.getElementsByTagNameNS(W, name));
const text = node => elements(node, 't').map(element => element.textContent).join('');
const parse = raw => new DOMParser().parseFromString(raw, 'text/xml');
const serialize = xml => new XMLSerializer().serializeToString(xml);

async function main() {
  const original = await JSZip.loadAsync(fs.readFileSync(path.join(__dirname, '../templates/ende/01.docx')));
  const output = await keepTdrHeadingsWithBody(await original.generateAsync({ type: 'nodebuffer' }));
  const zip = await JSZip.loadAsync(output);
  for (const name of Object.keys(original.files).filter(name => !name.endsWith('/') && !/^word\/(document|styles|settings|header\d+|footer\d+)\.xml$/.test(name))) {
    assert.deepEqual(await zip.file(name).async('nodebuffer'), await original.file(name).async('nodebuffer'), `Conservar ${name}`);
  }
  const document = parse(await zip.file('word/document.xml').async('string'));
  const originalDocument = parse(await original.file('word/document.xml').async('string'));
  const fields = elements(document, 'fldSimple').filter(field => /^PAGEREF\b/.test(field.getAttributeNS(W, 'instr')));
  assert.equal(fields.length, 14);
  assert.deepEqual(fields.map(field => field.getAttributeNS(W, 'instr')), elements(originalDocument, 'fldSimple').map(field => field.getAttributeNS(W, 'instr')));
  const tocCodes = elements(document, 'instrText').filter(code => /^\s*TOC\b/.test(code.textContent || ''));
  assert.equal(tocCodes.length, 1, 'Un solo índice nativo envuelve las catorce referencias');
  assert.equal(tocCodes[0].textContent.trim(), 'TOC \\h \\z \\t "TdrIndexSection,1"');
  const firstRow = fields[0].parentNode;
  const firstBoundaries = elements(firstRow, 'fldChar');
  assert.equal(firstBoundaries[0].getAttributeNS(W, 'fldCharType'), 'begin');
  assert.equal(firstBoundaries[0].getAttributeNS(W, 'dirty'), 'true');
  assert.equal(firstBoundaries[1].getAttributeNS(W, 'fldCharType'), 'separate');
  assert.equal(elements(fields.at(-1).parentNode, 'fldChar').at(-1).getAttributeNS(W, 'fldCharType'), 'end');
  const styles = parse(await zip.file('word/styles.xml').async('string'));
  const originalStyles = parse(await original.file('word/styles.xml').async('string'));
  for (const style of elements(originalStyles, 'style').filter(style => !['TOC1', 'TdrIndexSection'].includes(style.getAttributeNS(W, 'styleId')))) {
    assert.equal(serialize(elements(styles, 'style').find(candidate => candidate.getAttributeNS(W, 'styleId') === style.getAttributeNS(W, 'styleId'))), serialize(style), 'Los estilos institucionales ajenos al índice se conservan');
  }
  const tocStyle = elements(styles, 'style').filter(style => style.getAttributeNS(W, 'styleId') === 'TOC1');
  assert.equal(tocStyle.length, 1);
  const originalIndexRow = elements(originalDocument, 'fldSimple')[0].parentNode;
  assert.equal(serialize(elements(tocStyle[0], 'pPr')[0]), serialize(elements(originalIndexRow, 'pPr')[0]), 'TOC1 conserva tabs punteados y espaciado institucional');
  assert.equal(serialize(elements(tocStyle[0], 'rPr')[0]), serialize(elements(originalIndexRow, 'rPr')[0]), 'TOC1 conserva fuente y tamaño institucional');
  assert.equal(elements(styles, 'style').filter(style => style.getAttributeNS(W, 'styleId') === 'TdrIndexSection').length, 1);
  assert.equal(elements(document, 'pStyle').filter(style => style.getAttributeNS(W, 'val') === 'TdrIndexSection').length, 14, 'Solo los catorce títulos de sección entran al índice');
  for (const [index, field] of fields.entries()) {
    assert.equal(text(field), '…', 'Una página aún no calculada no se presenta como 1');
    assert.equal(field.getAttributeNS(W, 'dirty'), 'true');
    assert.equal(elements(field.parentNode, 'keepNext').length, 0, 'El índice no se trata como catorce títulos de cuerpo unidos');
    const bookmark = elements(document, 'bookmarkStart').find(start => start.getAttributeNS(W, 'name') === `section_${index + 1}`);
    assert.ok(bookmark);
    const paragraph = bookmark.parentNode;
    assert.match(text(paragraph), new RegExp(`^${index + 1}\\.\\s+`));
    assert.equal(elements(paragraph, 'keepNext')[0].getAttributeNS(W, 'val'), '1');
    assert.equal(elements(paragraph, 'pStyle')[0].getAttributeNS(W, 'val'), 'TdrIndexSection');
    const originalHeading = elements(originalDocument, 'bookmarkStart').find(start => start.getAttributeNS(W, 'name') === `section_${index + 1}`).parentNode;
    assert.deepEqual(elements(paragraph, 'r').map(serialize), elements(originalHeading, 'r').map(serialize), 'El estilo de índice no cambia el texto ni formato visible del título');
    assert.equal(text(field.parentNode).replace(/…$/, ''), text(elements(originalDocument, 'fldSimple')[index].parentNode), 'Se conserva cada rótulo del índice institucional');
    const children = Array.from(paragraph.childNodes).filter(child => child.nodeType === 1);
    assert.ok(children.indexOf(bookmark) < children.findIndex(child => child.localName === 'r'), 'El marcador comienza antes del texto del título');
    assert.equal(children.at(-1).localName, 'bookmarkEnd');
    assert.equal(children.at(-1).getAttributeNS(W, 'id'), bookmark.getAttributeNS(W, 'id'));
  }
  const header = parse(await zip.file('word/header1.xml').async('string'));
  assert.ok(elements(header, 'instrText').some(element => element.textContent.trim() === 'PAGE'), 'Se conserva el campo nativo de página');
  assert.equal(text(elements(header, 'fldSimple').find(field => field.getAttributeNS(W, 'instr') === 'NUMPAGES')), '…');
  const settings = parse(await zip.file('word/settings.xml').async('string'));
  assert.equal(elements(settings, 'updateFields')[0].getAttributeNS(W, 'val'), 'true');
  const twice = await JSZip.loadAsync(await keepTdrHeadingsWithBody(output));
  assert.equal(await twice.file('word/document.xml').async('string'), serialize(document), 'Volver a preparar el Word no mueve ni duplica marcadores/campos');
  assert.equal(await twice.file('word/styles.xml').async('string'), serialize(styles), 'Volver a preparar el Word no duplica ni cambia estilos del índice');
  console.log('PASS índice TOC nativo: catorce referencias y títulos, formato institucional, estilos y recursos conservados, preparación idempotente sin páginas inventadas');

  const fixture = parse(`<w:document xmlns:w="${W}"><w:body><w:p>
    <w:fldSimple w:instr="PAGEREF section_1 \\h" w:fldLock="true"><w:r><w:rPr><w:b/></w:rPr><w:t>1</w:t></w:r></w:fldSimple>
    <w:r><w:fldChar w:fldCharType="begin" w:fldLock="true"/></w:r><w:r><w:instrText xml:space="preserve"> NUM</w:instrText></w:r><w:r><w:instrText>PAGES </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:rPr><w:i/></w:rPr><w:t>1</w:t><w:t>2</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>
    <w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText>PAGE</w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>
    <w:r><w:fldChar w:fldCharType="begin"/><w:instrText>PAGE</w:instrText><w:fldChar w:fldCharType="separate"/><w:fldChar w:fldCharType="end"/></w:r>
    <w:fldSimple w:instr="REF supplier"><w:r><w:t>Proveedor confirmado</w:t></w:r></w:fldSimple>
    <w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText>REF original</w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>Texto conservado</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>
    <w:r><w:t>Texto exterior</w:t></w:r>
    </w:p></w:body></w:document>`);
  const instructions = elements(fixture, 'instrText').map(element => element.textContent);
  assert.equal(invalidatePaginationFields(fixture), 4);
  assert.deepEqual(elements(fixture, 'instrText').map(element => element.textContent), instructions, 'Preservar instrucciones incluso divididas entre runs');
  assert.equal(text(fixture), '…………Proveedor confirmadoTexto conservadoTexto exterior');
  assert.equal(elements(fixture, 'b').length, 1);
  assert.equal(elements(fixture, 'i').length, 1);
  assert.equal(elements(fixture, 'fldChar').filter(element => element.getAttributeNS(W, 'dirty') === 'true').length, 3);
  const compact = elements(fixture, 'r').find(run => elements(run, 'fldChar').length === 3);
  const compactChildren = Array.from(compact.childNodes).filter(child => child.nodeType === 1);
  assert.equal(compactChildren.at(-2).localName, 't', 'Una caché vacía permanece entre separate y end incluso dentro del mismo run');
  assert.ok(!serialize(fixture).includes('w:fldLock="true"'), 'Los campos de paginación pueden recalcularse');
  const fieldSettings = parse(`<w:settings xmlns:w="${W}"><w:updateFields w:val="false"/><w:updateFields w:val="false"/></w:settings>`);
  enableFieldUpdatesOnOpen(fieldSettings);
  assert.equal(elements(fieldSettings, 'updateFields').length, 1);
  assert.equal(elements(fieldSettings, 'updateFields')[0].getAttributeNS(W, 'val'), 'true');
  console.log('PASS campos simples/complejos, instrucciones divididas, cachés vacías, formato y campos ajenos a paginación conservados');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
