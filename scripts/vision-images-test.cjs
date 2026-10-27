// Real local image decoding/encoding, with no AI requests or database access.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, file);
const { prepareVisionImage, MAX_VISION_IMAGE_BYTES, MAX_VISION_IMAGE_EDGE, MAX_SOURCE_IMAGE_PIXELS } = require('../src/lib/server/visionImages.ts');
const decode = url => Buffer.from(url.split(',')[1], 'base64');

function documentImage(width = 1700, height = 2200) {
  const canvas = createCanvas(width, height), context = canvas.getContext('2d');
  context.fillStyle = 'white'; context.fillRect(0, 0, width, height);
  context.fillStyle = 'black'; context.font = '28px sans-serif';
  context.fillText('COTIZACION: 24 cascos de seguridad, Bs 150 c/u', 50, 80);
  context.fillText('Total: Bs 3600. Plazo de entrega: 10 dias.', 50, 125);
  return canvas;
}

async function assertPrepared(buffer, name, expectedRatio) {
  const url = await prepareVisionImage(buffer, name);
  assert.match(url, /^data:image\/jpeg;base64,/);
  assert.ok(decode(url).length <= MAX_VISION_IMAGE_BYTES, `${name} exceeds the per-image model budget`);
  const image = await loadImage(decode(url));
  assert.ok(Math.max(image.width, image.height) <= MAX_VISION_IMAGE_EDGE);
  assert.ok(Math.abs(image.width / image.height - expectedRatio) < 0.002, `${name} changed aspect ratio`);
  return { url, image };
}

(async () => {
  const source = documentImage();
  await assertPrepared(source.toBuffer('image/png'), 'documento.png', 17 / 22);
  await assertPrepared(source.toBuffer('image/webp'), 'documento.webp', 17 / 22);

  // Entropy makes these genuine encoded images larger than the previous 3 MB cap.
  const large = createCanvas(1900, 1900), context = large.getContext('2d');
  const pixels = context.createImageData(large.width, large.height);
  let seed = 1701;
  for (let i = 0; i < pixels.data.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    pixels.data[i] = i % 4 === 3 ? 255 : seed >>> 24;
  }
  context.putImageData(pixels, 0, 0);
  for (const mime of ['image/png', 'image/jpeg']) {
    const original = large.toBuffer(mime, 100);
    assert.ok(original.length > 3 * 1024 * 1024, `Expected an actual large ${mime} fixture`);
    await assertPrepared(original, mime === 'image/png' ? 'foto-grande.png' : 'foto-grande.jpg', 1);
  }

  // The native decoder must apply the camera's EXIF rotation before resizing.
  const camera = createCanvas(200, 100), cameraContext = camera.getContext('2d');
  cameraContext.fillStyle = 'red'; cameraContext.fillRect(0, 0, 100, 100);
  cameraContext.fillStyle = 'blue'; cameraContext.fillRect(100, 0, 100, 100);
  const jpeg = camera.toBuffer('image/jpeg');
  const exifRotateClockwise = Buffer.from('ffe1002245786966000049492a0008000000010012010300010000000600000000000000', 'hex');
  const rotatedJpeg = Buffer.concat([jpeg.subarray(0, 2), exifRotateClockwise, jpeg.subarray(2)]);
  const rotated = await assertPrepared(rotatedJpeg, 'foto-vertical.jpg', 0.5);
  assert.equal(rotated.image.width, 100); assert.equal(rotated.image.height, 200);
  const oriented = createCanvas(100, 200), orientedContext = oriented.getContext('2d');
  orientedContext.drawImage(rotated.image, 0, 0);
  const top = orientedContext.getImageData(20, 20, 1, 1).data;
  const bottom = orientedContext.getImageData(20, 180, 1, 1).data;
  assert.ok(top[0] > 200 && top[2] < 30 && bottom[2] > 200 && bottom[0] < 30, 'Camera orientation was lost or applied twice');

  const transparent = createCanvas(80, 40);
  const preparedTransparent = await assertPrepared(transparent.toBuffer('image/png'), 'transparente.png', 2);
  const white = createCanvas(80, 40), whiteContext = white.getContext('2d');
  whiteContext.drawImage(preparedTransparent.image, 0, 0);
  assert.ok(whiteContext.getImageData(20, 20, 1, 1).data.slice(0, 3).every(value => value > 245), 'Transparent document backgrounds must remain white');

  for (const buffer of [Buffer.alloc(0), Buffer.from('<svg width="1" height="1"></svg>'), Buffer.from('not a PNG'), Buffer.from([255, 216, 255, 192, 0, 20, 8])]) {
    await assert.rejects(() => prepareVisionImage(buffer, 'falso.png'), /no contiene un JPG, PNG o WebP válido/);
  }
  const pngHeader = Buffer.alloc(33);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(pngHeader);
  pngHeader.writeUInt32BE(13, 8); pngHeader.write('IHDR', 12);
  pngHeader.writeUInt32BE(100_000, 16); pngHeader.writeUInt32BE(100_000, 20);
  await assert.rejects(() => prepareVisionImage(pngHeader, 'bomba.png'), /dimensiones demasiado grandes/);
  pngHeader.writeUInt32BE(10_000, 16); pngHeader.writeUInt32BE(7000, 20);
  assert.ok(10_000 * 7000 > MAX_SOURCE_IMAGE_PIXELS);
  await assert.rejects(() => prepareVisionImage(pngHeader, 'muchos-pixeles.png'), /dimensiones demasiado grandes/);
  const webpHeader = Buffer.alloc(30);
  webpHeader.write('RIFF'); webpHeader.writeUInt32LE(22, 4); webpHeader.write('WEBP', 8);
  webpHeader.write('VP8X', 12); webpHeader.writeUInt32LE(10, 16);
  webpHeader.writeUIntLE(49_999, 24, 3); webpHeader.writeUIntLE(49_999, 27, 3);
  await assert.rejects(() => prepareVisionImage(webpHeader, 'bomba.webp'), /dimensiones demasiado grandes/);

  const document = source.toBuffer('image/png');
  const { MAX_VISION_IMAGES } = require('../src/lib/uploads/attachmentPolicy.ts');
  assert.equal(MAX_VISION_IMAGES, 24);
  const prepared = [];
  for (let i = 0; i < MAX_VISION_IMAGES; i++) prepared.push(await prepareVisionImage(document, `pagina-${i + 1}.png`));
  assert.equal(prepared.length, 24);
  assert.ok(prepared.reduce((bytes, url) => bytes + Buffer.byteLength(url), 0) < 12 * 1024 * 1024, 'Twenty-four prepared images must fit the model request');
  console.log('PASS JPG/PNG >3 MB, WebP, 24 images, EXIF orientation, transparency, format validation and predecode dimension limits');
})().catch(error => { console.error(error); process.exitCode = 1; });
