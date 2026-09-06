import { NextRequest, NextResponse } from "next/server";
import { parseOcrDocument } from "@/lib/ocr/ocrParser";
import { extractText } from "@/lib/server/extractText";
import { engineUrl } from "@/lib/server/config";
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData(); const file = form.get("file");
    const code = String(form.get("adquisicionCodigo") || "");
    const numero = Number(form.get("carpetaNumero"));
    if (!(file instanceof File) || !code || !numero || file.size > 20 * 1024 * 1024) return NextResponse.json({ error: "Archivo o expediente inválido (máximo 20 MB)." }, { status: 400 });
    let text = "";
    try { text = await extractText(Buffer.from(await file.arrayBuffer()), file.name); } catch { /* Scanned documents use OCR below. */ }
    if (!text.trim()) {
      try {
        const fd = new FormData(); fd.append("file", file);
        const res = await fetch(`${engineUrl}/api/procesar-proforma-ocr`, { method: "POST", body: fd, signal: AbortSignal.timeout(45000) });
        if (res.ok) { const json = await res.json(); text = json.texto_extraido || json.extracted_text || json.raw_text || json.extracted_text_preview || ""; }
      } catch { /* Keep original and surface extraction warning. */ }
    }
    return NextResponse.json({ success: true, text, result: parseOcrDocument(file.name, numero, code, String(form.get("adquisicionTitulo") || ""), text) });
  } catch { return NextResponse.json({ error: "No se pudo leer el archivo." }, { status: 400 }); }
}
