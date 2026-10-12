export async function extractText(buffer: Buffer, name: string): Promise<string> {
  const extension = name.toLowerCase().split(".").pop();
  if (["txt", "md", "csv"].includes(extension || "")) return buffer.toString("utf8");
  if (extension === "docx") {
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
export async function extractPurchaseAttachment(buffer: Buffer, name: string, imageBudget = 6): Promise<{text:string; images:string[]}> {
  if (!/\.pdf$/i.test(name)) return {text:await extractText(buffer,name), images:[]};
  const { CanvasFactory, getData } = await import('pdf-parse/worker');
  const { PDFParse } = await import('pdf-parse');
  PDFParse.setWorker(getData());
  const parser = new PDFParse({data:new Uint8Array(buffer),CanvasFactory});
  try {
    const content = await parser.getText({pageJoiner:''});
    const lettersAndNumbers = new RegExp('[\\p{L}\\p{N}]', 'gu');
    const scanned = content.pages.filter(page => (page.text.match(lettersAndNumbers) || []).length < 40).map(page=>page.num);
    if (scanned.length > imageBudget) throw Error(`El PDF ${name} contiene demasiadas páginas escaneadas para una lectura completa. Adjunta hasta seis páginas escaneadas por consulta.`);
    let images:string[]=[];
    if (scanned.length) {
      const result=await parser.getScreenshot({partial:scanned,desiredWidth:1400,imageBuffer:false,imageDataUrl:true});
      images=result.pages.map(page=>page.dataUrl);
      if(images.some(url=>!url.startsWith('data:image/png;base64,')) || images.length!==scanned.length) throw Error(`No se pudieron preparar todas las páginas de ${name} para leerlas con visión.`);
      if(images.reduce((total,url)=>total+url.length,0)>10*1024*1024) throw Error(`Las páginas de ${name} son demasiado grandes. Divide el PDF en archivos más pequeños.`);
    }
    return {text:content.pages.filter(page=>!scanned.includes(page.num)).map(page=>`Página ${page.num}:\n${page.text}`).join('\n'),images};
  } finally {await parser.destroy();}
}
