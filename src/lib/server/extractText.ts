export async function extractText(buffer: Buffer, name: string): Promise<string> {
  const extension = name.toLowerCase().split(".").pop();
  if (["txt", "md", "csv"].includes(extension || "")) return buffer.toString("utf8");
  if (extension === "docx") {
    const mammoth = await import("mammoth");
    return (await mammoth.extractRawText({ buffer })).value;
  }
  if (extension === "pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try { return (await parser.getText()).text; } finally { await parser.destroy(); }
  }
  return "";
}
