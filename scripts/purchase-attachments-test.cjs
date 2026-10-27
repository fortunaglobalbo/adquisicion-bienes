// Real PDF parsing/rendering, with no AI requests or database access.
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),ts=require('typescript');
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {extractPurchaseAttachment}=require('../src/lib/server/extractText.ts');
const {createCanvas}=require('@napi-rs/canvas');
function pdf(scannedPages=1,mixed=false){
 const canvas=createCanvas(612,792),ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,612,792);ctx.fillStyle='black';ctx.font='22px sans-serif';ctx.fillText('Cotizacion de prueba: 8 cascos, Bs 100',40,80);
 const jpeg=canvas.toBuffer('image/jpeg');
 const objects=[],add=value=>{objects.push(Buffer.isBuffer(value)?value:Buffer.from(value));return objects.length;};
 add('<< /Type /Catalog /Pages 2 0 R >>');add('');
 const font=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
 const image=add(Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width 612 /Height 792 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`),jpeg,Buffer.from('\nendstream')]));
 const pages=[];
 for(let i=0;i<scannedPages+(mixed?1:0);i++){
  const text=mixed&&i===0;
  const stream=text?'BT /F1 14 Tf 40 720 Td (Solicitud de materiales para mantenimiento, cantidad 10 piezas.) Tj ET':`q 612 0 0 792 0 0 cm /Im1 Do Q`;
  const content=add(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
  pages.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${font} 0 R >> /XObject << /Im1 ${image} 0 R >> >> /Contents ${content} 0 R >>`));
 }
 objects[1]=Buffer.from(`<< /Type /Pages /Kids [${pages.map(id=>id+' 0 R').join(' ')}] /Count ${pages.length} >>`);
 const buffers=[Buffer.from('%PDF-1.4\n')],offsets=[0];let offset=buffers[0].length;
 objects.forEach((object,i)=>{offsets.push(offset);const b=Buffer.concat([Buffer.from(`${i+1} 0 obj\n`),object,Buffer.from('\nendobj\n')]);buffers.push(b);offset+=b.length;});
 buffers.push(Buffer.from(`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF`));return Buffer.concat(buffers);
}
(async()=>{
 const scan=await extractPurchaseAttachment(pdf(),'scan.pdf');assert.equal(scan.images.length,1);assert.equal(scan.text,'');assert.ok(scan.images[0].startsWith('data:image/jpeg;base64,'));
 const mixed=await extractPurchaseAttachment(pdf(1,true),'mixed.pdf');assert.equal(mixed.images.length,1);assert.match(mixed.text,/cantidad 10 piezas/);assert.match(mixed.text,/Página 1/);
 const complete=await extractPurchaseAttachment(pdf(24),'complete.pdf');assert.equal(complete.images.length,24);assert.ok(complete.images.every(image=>image.startsWith('data:image/jpeg;base64,')));assert.ok(complete.images.reduce((bytes,url)=>bytes+Buffer.byteLength(url),0)<12*1024*1024);
 await assert.rejects(()=>extractPurchaseAttachment(pdf(25),'too-many.pdf'),/25 páginas escaneadas.*quedan 24 imágenes/);
 await assert.rejects(()=>extractPurchaseAttachment(pdf(7),'shared-budget.pdf',6),/7 páginas escaneadas.*quedan 6 imágenes/);
 await assert.rejects(()=>extractPurchaseAttachment(pdf(),'no-budget.pdf',0),/quedan 0 imágenes/);
 const digital=await extractPurchaseAttachment(pdf(0,true),'digital.pdf',0);assert.equal(digital.images.length,0);assert.match(digital.text,/cantidad 10 piezas/);
 const plain=await extractPurchaseAttachment(Buffer.from('Necesito 12 pares de guantes'),'request.txt');assert.equal(plain.images.length,0);assert.match(plain.text,/12 pares/);
 console.log('PASS PDF escaneado y mixto: texto + imágenes completas, límite explícito sin truncamiento silencioso y TXT conservado');
})().catch(e=>{console.error(e.message);process.exitCode=1});
