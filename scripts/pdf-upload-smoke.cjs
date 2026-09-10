// Run against Next.js to catch bundler failures that a Node-only parser test misses.
const assert = require('node:assert/strict');
function pdfFixture() {
  const stream = 'BT /F1 12 Tf 72 720 Td (Prueba de lectura de un antecedente PDF.) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i+1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}
async function main() {
  const form = new FormData();
  // A deliberately obsolete draft stops after PDF extraction, before AI or storage.
  form.append('request', JSON.stringify({ action:'complete', number:1,
    adquisicion:{id:'pdf-upload-regression',titulo_proceso:'Prueba sin guardar',items:[]},
    draft:{companyId:'ende',modelVersion:'regression-obsolete-version'},
  }));
  form.append('attachments', new Blob([pdfFixture()], {type:'application/pdf'}), 'antecedente.pdf');
  const response = await fetch(`${process.env.TEST_BASE_URL || 'http://127.0.0.1:3000'}/api/fixed-documents`, {method:'POST',body:form,signal:AbortSignal.timeout(30000)});
  const data = await response.json();
  assert.equal(response.status,400);
  assert.match(data.error,/versión actual del modelo/,`La lectura PDF falló antes de validar el borrador: ${data.error}`);
  console.log('PASS PDF adjunto leído por Next.js; sin llamadas IA ni cambios en expedientes');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
