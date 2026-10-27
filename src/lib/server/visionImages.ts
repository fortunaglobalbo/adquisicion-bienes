// Keep the model request small while retaining document detail from large uploads.
export const MAX_VISION_IMAGE_BYTES = 350 * 1024;
export const MAX_VISION_IMAGE_EDGE = 2200;
// Bound the source RGBA bitmap to 256 MB; callers process images sequentially in a 2 GB function.
export const MAX_SOURCE_IMAGE_PIXELS = 64_000_000;
const MAX_SOURCE_IMAGE_EDGE = 32_768;

type Dimensions = { width: number; height: number };

function assertDimensions({ width, height }: Dimensions, name: string): void {
  if (!width || !height || width > MAX_SOURCE_IMAGE_EDGE || height > MAX_SOURCE_IMAGE_EDGE || width * height > MAX_SOURCE_IMAGE_PIXELS) {
    throw Error(`La imagen ${name} tiene dimensiones demasiado grandes para prepararla con seguridad. Expórtala con hasta 64 megapíxeles y vuelve a adjuntarla.`);
  }
}

function invalidImage(name: string): Error {
  return Error(`La imagen ${name} no contiene un JPG, PNG o WebP válido. Vuelve a exportarla en uno de esos formatos.`);
}

function imageDimensions(buffer: Buffer, name: string): Dimensions {
  if (buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    if (buffer.length < 33 || buffer.readUInt32BE(8) !== 13 || buffer.toString('ascii', 12, 16) !== 'IHDR') throw invalidImage(name);
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length) {
      if (buffer[offset++] !== 0xff) break;
      while (offset < buffer.length && buffer[offset] === 0xff) offset++;
      const marker = buffer[offset++];
      if (marker === 0xda || marker === 0xd9 || marker === undefined) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > buffer.length) break;
      const length = buffer.readUInt16BE(offset);
      if (length < 2 || offset + length > buffer.length) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        if (length < 8) break;
        return { width: buffer.readUInt16BE(offset + 5), height: buffer.readUInt16BE(offset + 3) };
      }
      offset += length;
    }
    throw invalidImage(name);
  }
  if (buffer.length >= 20 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    const end = buffer.readUInt32LE(4) + 8;
    if (end > buffer.length || end < 20) throw invalidImage(name);
    let dimensions: Dimensions | undefined;
    let frame: Dimensions | undefined;
    for (let offset = 12; offset + 8 <= end;) {
      const chunk = buffer.toString('ascii', offset, offset + 4);
      const length = buffer.readUInt32LE(offset + 4);
      const data = offset + 8;
      if (data + length > end) throw invalidImage(name);
      if (chunk === 'VP8X' && length >= 10) {
        dimensions = { width: buffer.readUIntLE(data + 4, 3) + 1, height: buffer.readUIntLE(data + 7, 3) + 1 };
        assertDimensions(dimensions, name);
      } else if (chunk === 'VP8 ' && length >= 10 && buffer.toString('hex', data + 3, data + 6) === '9d012a') {
        frame = { width: buffer.readUInt16LE(data + 6) & 0x3fff, height: buffer.readUInt16LE(data + 8) & 0x3fff };
        assertDimensions(frame, name);
      } else if (chunk === 'VP8L' && length >= 5 && buffer[data] === 0x2f) {
        const bits = buffer.readUInt32LE(data + 1);
        frame = { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
        assertDimensions(frame, name);
      } else if (chunk === 'ANIM' || chunk === 'ANMF') {
        throw Error(`La imagen ${name} es un WebP animado. Adjunta sus páginas como imágenes fijas para poder leerlas completas.`);
      }
      offset = data + length + (length % 2);
    }
    if (frame) return dimensions || frame;
  }
  throw invalidImage(name);
}

export async function prepareVisionImage(buffer: Buffer, name: string): Promise<string> {
  // Only local bytes reach the decoder; filenames/MIME types cannot enable SVG or URLs.
  assertDimensions(imageDimensions(buffer, name), name);
  try {
    const { createCanvas, loadImage } = await import('@napi-rs/canvas');
    // Skia applies EXIF orientation before reporting the decoded dimensions.
    const image = await loadImage(buffer);
    assertDimensions(image, name);
    const originalEdge = Math.max(image.width, image.height);
    let edge = Math.min(MAX_VISION_IMAGE_EDGE, originalEdge);
    const minimumEdge = Math.min(1100, edge);
    while (true) {
      const scale = edge / originalEdge;
      const canvas = createCanvas(Math.max(1, Math.round(image.width * scale)), Math.max(1, Math.round(image.height * scale)));
      try {
        const context = canvas.getContext('2d');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        for (const quality of [88, 78, 68, 58, 48]) {
          const jpeg = await canvas.encode('jpeg', quality);
          if (jpeg.length <= MAX_VISION_IMAGE_BYTES) return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
        }
      } finally {
        // Release each resize surface promptly when preparing many attachments.
        canvas.width = 1;
        canvas.height = 1;
      }
      if (edge === minimumEdge) break;
      edge = Math.max(minimumEdge, Math.floor(edge * 0.8));
    }
    throw Error(`La imagen ${name} sigue siendo demasiado compleja para una lectura completa. Expórtala con menor resolución o divídela en varias imágenes.`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith(`La imagen ${name}`)) throw error;
    throw Error(`No se pudo preparar la imagen ${name} para leerla. Comprueba que el archivo JPG, PNG o WebP se abra correctamente.`);
  }
}
