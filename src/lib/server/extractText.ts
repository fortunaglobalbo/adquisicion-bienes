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
