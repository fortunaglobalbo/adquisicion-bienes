import { MAX_VISION_IMAGES } from '../uploads/attachmentPolicy';
import { prepareVisionImage } from './visionImages';

const MAX_DOCX_ENTRIES = 4096;
const MAX_DOCX_EXPANDED_BYTES = 256 * 1024 * 1024;
const MAX_DOCX_XML_BYTES = 12 * 1024 * 1024;
type CompressedDocxPart = { uncompressedSize: number; compressedSize: number; compressedContent: Uint8Array; compression: { magic: string } };

async function validateDocxExpansion(buffer: Buffer, name: string): Promise<void> {
  const invalid = () => Error(`El documento ${name} no contiene una estructura Word válida y segura. Vuelve a exportarlo como DOCX.`);
  const tooLarge = () => Error(`El documento ${name} tiene demasiado contenido descomprimido para leerlo con seguridad. Divide el texto en varios documentos y conserva las fotografías como adjuntos independientes.`);
  // Bound the actual directory before JSZip creates objects, including duplicate names.
  const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]), buffer.length - 22);
  if (end < 0 || end + 22 > buffer.length || end + 22 + buffer.readUInt16LE(end + 20) !== buffer.length) throw invalid();
  const entryCount = buffer.readUInt16LE(end + 10);
  const directorySize = buffer.readUInt32LE(end + 12);
  const directoryOffset = buffer.readUInt32LE(end + 16);
  // ZIP64/multivolume archives are unnecessary for a 50 MB DOCX and can hide oversized claims.
  if (entryCount > MAX_DOCX_ENTRIES) throw tooLarge();
  if (buffer.readUInt16LE(end + 4) || buffer.readUInt16LE(end + 6) || buffer.readUInt16LE(end + 8) !== entryCount || directoryOffset + directorySize !== end) throw invalid();
  let entries = 0, expandedBytes = 0;
  for (let offset = directoryOffset; offset < end;) {
    if (offset + 46 > end || buffer.readUInt32LE(offset) !== 0x02014b50) throw invalid();
    const next = offset + 46 + buffer.readUInt16LE(offset + 28) + buffer.readUInt16LE(offset + 30) + buffer.readUInt16LE(offset + 32);
    if (next > end || ++entries > MAX_DOCX_ENTRIES) throw tooLarge();
    expandedBytes += buffer.readUInt32LE(offset + 24);
    if (expandedBytes > MAX_DOCX_EXPANDED_BYTES) throw tooLarge();
    if (buffer.readUInt32LE(offset + 20) === 0xffffffff || buffer.readUInt32LE(offset + 42) === 0xffffffff) throw invalid();
    offset = next;
  }
  if (!entries || entries !== entryCount) throw invalid();
  const { default: JSZip } = await import('jszip');
  let zip: Awaited<ReturnType<typeof JSZip.loadAsync>>;
  try { zip = await JSZip.loadAsync(buffer, { checkCRC32: false }); } catch { throw invalid(); }
  const parts = Object.values(zip.files).filter(part => !part.dir);
  let xmlBytes = 0;
  for (const part of parts) {
    // JSZip is pinned to 3.10.1; loadAsync exposes size/codec metadata without inflation.
    const data = (part as typeof part & { _data: CompressedDocxPart })._data;
    if (!data || !Number.isSafeInteger(data.uncompressedSize) || data.uncompressedSize < 0) throw invalid();
    if (/\.(?:xml|rels)$/i.test(part.name)) xmlBytes += data.uncompressedSize;
  }
  if (xmlBytes > MAX_DOCX_XML_BYTES) throw tooLarge();
  const { inflateRaw } = await import('node:zlib');
  const decoded = new Map<string, Buffer>();
  let actualXmlBytes = 0;
  async function readBoundedPart(partName: string): Promise<Buffer | undefined> {
    const cached = decoded.get(partName);
    if (cached) return cached;
    const part = zip.file(partName);
    if (!part) return;
    const data = (part as typeof part & { _data: CompressedDocxPart })._data;
    const remaining = MAX_DOCX_XML_BYTES - actualXmlBytes;
    if (!data || data.uncompressedSize > remaining || !(data.compressedContent instanceof Uint8Array)) throw tooLarge();
    let contents: Buffer;
    if (data.compression.magic === '\x00\x00') {
      if (data.compressedContent.byteLength > remaining) throw tooLarge();
      contents = Buffer.from(data.compressedContent);
    } else if (data.compression.magic === '\x08\x00') {
      try {
        contents = await new Promise<Buffer>((resolve, reject) => inflateRaw(data.compressedContent, { maxOutputLength: Math.max(1, remaining) }, (error, output) => error ? reject(error) : resolve(output)));
      } catch { throw tooLarge(); }
    } else { throw invalid(); }
    if (contents.length !== data.uncompressedSize) throw invalid();
    actualXmlBytes += contents.length;
    if (actualXmlBytes > MAX_DOCX_XML_BYTES) throw tooLarge();
    decoded.set(partName, contents);
    return contents;
  }
  // Verify actual XML output as well as ZIP claims; a forged small size cannot bypass the cap.
  for (const part of parts) if (/\.(?:xml|rels)$/i.test(part.name)) await readBoundedPart(part.name);
  // Word relationships may select parts without an .xml suffix. Bound those reads too.
  const { DOMParser } = await import('@xmldom/xmldom');
  for (const part of parts.filter(part => /\.rels$/i.test(part.name))) {
    const contents = decoded.get(part.name);
    if (!contents) continue;
    const document = new DOMParser({ errorHandler: { warning() {}, error() { throw invalid(); }, fatalError() { throw invalid(); } } }).parseFromString(contents.toString('utf8'), 'application/xml');
    const relationships = document.getElementsByTagNameNS('*', 'Relationship');
    const base = part.name === '_rels/.rels' ? '' : part.name.slice(0, part.name.lastIndexOf('/_rels/') + 1);
    for (let index = 0; index < relationships.length; index++) {
      const relationship = relationships.item(index);
      if (!relationship || !/\/(?:officeDocument|styles|numbering|comments|footnotes|endnotes)$/.test(relationship.getAttribute('Type') || '')) continue;
      const target = relationship.getAttribute('Target') || '';
      const targetName = target.startsWith('/') ? target.slice(1) : base + target;
      await readBoundedPart(targetName);
    }
  }
}

export async function extractText(buffer: Buffer, name: string): Promise<string> {
  const extension = name.toLowerCase().split(".").pop();
  if (["txt", "md", "csv"].includes(extension || "")) return buffer.toString("utf8");
  if (extension === "docx") {
    await validateDocxExpansion(buffer, name);
    const mammoth = await import("mammoth");
    return (await mammoth.extractRawText({ buffer })).value;
  }
  if (extension === "pdf") {
    // Initialize DOMMatrix/canvas before PDF.js, including Vercel's isolated Node runtime.
    const { CanvasFactory, getData } = await import("pdf-parse/worker");
    const { PDFParse } = await import("pdf-parse");
    PDFParse.setWorker(getData());
    const parser = new PDFParse({ data: new Uint8Array(buffer), CanvasFactory });
    try { return (await parser.getText()).text; } finally { await parser.destroy(); }
  }
  return "";
}

// Scanned and mixed PDFs need page images as well as their selectable text.
// A page-number marker from PDF.js is not usable purchase information.
export async function extractPurchaseAttachment(buffer: Buffer, name: string, imageBudget = MAX_VISION_IMAGES): Promise<{text:string; images:string[]}> {
  if (!/\.pdf$/i.test(name)) return {text:await extractText(buffer,name), images:[]};
  const { CanvasFactory, getData } = await import('pdf-parse/worker');
  const { PDFParse } = await import('pdf-parse');
  PDFParse.setWorker(getData());
  const parser = new PDFParse({data:new Uint8Array(buffer),CanvasFactory});
  try {
    const content = await parser.getText({pageJoiner:''});
    const lettersAndNumbers = new RegExp('[\\p{L}\\p{N}]', 'gu');
    const scanned = content.pages.filter(page => (page.text.match(lettersAndNumbers) || []).length < 40).map(page=>page.num);
    const availableImages = Number.isFinite(imageBudget) ? Math.max(0, Math.min(MAX_VISION_IMAGES, Math.floor(imageBudget))) : 0;
    if (scanned.length > availableImages) throw Error(`El PDF ${name} contiene ${scanned.length} páginas escaneadas y quedan ${availableImages} imágenes disponibles en esta consulta (máximo ${MAX_VISION_IMAGES}, incluidas las fotografías). Divide los adjuntos en varias consultas para leerlos completos.`);
    const images:string[]=[];
    for (const pageNumber of scanned) {
      // Render/encode one page at a time instead of retaining every full PNG in memory.
      const result=await parser.getScreenshot({partial:[pageNumber],desiredWidth:1700,imageBuffer:true,imageDataUrl:false});
      if (result.pages.length !== 1 || result.pages[0].pageNumber !== pageNumber || !result.pages[0].data.length) throw Error(`No se pudo preparar la página ${pageNumber} de ${name} para leerla con visión.`);
      images.push(await prepareVisionImage(Buffer.from(result.pages[0].data), `${name}, página ${pageNumber}`));
    }
    return {text:content.pages.filter(page=>!scanned.includes(page.num)).map(page=>`Página ${page.num}:\n${page.text}`).join('\n'),images};
  } finally {await parser.destroy();}
}
