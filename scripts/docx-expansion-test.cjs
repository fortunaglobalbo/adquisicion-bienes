// Local DOCX parsing only: no AI requests, database changes or generated files.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const JSZip = require('jszip');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, file);
const { extractText } = require('../src/lib/server/extractText.ts');
const { Document, Packer, Paragraph, ImageRun } = require('docx');
const { createCanvas } = require('@napi-rs/canvas');

async function tinyDocx(text = 'Solicitud de 24 cascos de seguridad', documentName = 'word/document.xml') {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/' + documentName + '" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="' + documentName + '"/></Relationships>');
  zip.file(documentName, '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>' + text + '</w:t></w:r></w:p></w:body></w:document>');
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

function claimSize(buffer, partName, size) {
  const result = Buffer.from(buffer);
  const end = result.lastIndexOf(Buffer.from('504b0506', 'hex'));
  for (let offset = result.readUInt32LE(end + 16); offset < end;) {
    assert.equal(result.readUInt32LE(offset), 0x02014b50);
    const length = result.readUInt16LE(offset + 28);
    if (result.toString('utf8', offset + 46, offset + 46 + length) === partName) {
      result.writeUInt32LE(size, offset + 24);
      return result;
    }
    offset += 46 + length + result.readUInt16LE(offset + 30) + result.readUInt16LE(offset + 32);
  }
  throw Error('Fixture part not found: ' + partName);
}

(async () => {
  const small = await tinyDocx();
  assert.match(await extractText(small, 'solicitud.docx'), /24 cascos/);
  await assert.rejects(() => extractText(claimSize(small, 'word/document.xml', 300 * 1024 * 1024), 'expansion-total.docx'), /demasiado contenido descomprimido/);
  await assert.rejects(() => extractText(claimSize(small, 'word/document.xml', 13 * 1024 * 1024), 'expansion-xml.docx'), /demasiado contenido descomprimido/);
  const manyEntries = Buffer.from(small), end = manyEntries.lastIndexOf(Buffer.from('504b0506', 'hex'));
  manyEntries.writeUInt16LE(4097, end + 8); manyEntries.writeUInt16LE(4097, end + 10);
  await assert.rejects(() => extractText(manyEntries, 'demasiadas-partes.docx'), /demasiado contenido descomprimido/);

  // A tiny compressed file also fails when its directory lies about the expanded size.
  const dishonest = await tinyDocx('A'.repeat(13 * 1024 * 1024));
  assert.ok(dishonest.length < 30 * 1024);
  await assert.rejects(() => extractText(claimSize(dishonest, 'word/document.xml', 100), 'tamano-falso.docx'), /demasiado contenido descomprimido/);
  const renamed = await tinyDocx('A'.repeat(13 * 1024 * 1024), 'word/document.bin');
  await assert.rejects(() => extractText(claimSize(renamed, 'word/document.bin', 100), 'texto-renombrado.docx'), /demasiado contenido descomprimido/);
  await assert.rejects(() => extractText(Buffer.from('Not a ZIP'), 'invalido.docx'), /estructura Word válida y segura/);

  // A real Word document with a valid >3 MB embedded photo remains readable.
  const canvas = createCanvas(1200, 1000), context = canvas.getContext('2d');
  const pixels = context.createImageData(1200, 1000);
  let seed = 108;
  for (let i = 0; i < pixels.data.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    pixels.data[i] = i % 4 === 3 ? 255 : seed >>> 24;
  }
  context.putImageData(pixels, 0, 0);
  const photo = canvas.toBuffer('image/png');
  assert.ok(photo.length > 3 * 1024 * 1024);
  const document = await Packer.toBuffer(new Document({ sections: [{ children: [
    new Paragraph('Cotizacion con fotografia: 24 cascos, total Bs 3600.'),
    new Paragraph({ children: [new ImageRun({ data: photo, type: 'png', transformation: { width: 400, height: 333 } })] }),
  ] }] }));
  assert.ok(document.length > 3 * 1024 * 1024);
  const original = Buffer.from(document);
  assert.match(await extractText(document, 'cotizacion-con-foto.docx'), /24 cascos, total Bs 3600/);
  assert.ok(document.equals(original), 'The archive guard must not alter the uploaded document');
  console.log('PASS DOCX with >3 MB photo, bounded ZIP/XML claims, dishonest expansion, renamed XML parts, entry count and read-only validation');
})().catch(error => { console.error(error); process.exitCode = 1; });
