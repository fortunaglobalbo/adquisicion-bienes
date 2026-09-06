import { NextRequest, NextResponse } from "next/server";
import { inspectTemplate, fillTemplate } from "@/lib/docx/templateEditor";
import { prepareDocument } from "@/lib/ai/documentAssistant";
import { extractText } from "@/lib/server/extractText";
import { createHash } from "crypto";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("template");
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".docx") || file.size > 3 * 1024 * 1024) {
      return NextResponse.json({ error: "Selecciona un Word (.docx) de hasta 3 MB." }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const fingerprint = createHash("sha256").update(buffer).digest("hex");
    if (form.get("action") === "download") {
      if (form.get("fingerprint") !== fingerprint) throw Error("La plantilla cambió. Prepara de nuevo el documento.");
      const planText = String(form.get("plan") || "{}");
      if (planText.length > 350000) throw Error("El documento tiene demasiado contenido. Reduce el texto antes de descargar.");
      const plan = JSON.parse(planText);
      const output = await fillTemplate(buffer, plan.changes, plan.tables);
      return new Response(new Uint8Array(output), { headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": 'attachment; filename="Documento_para_revision.docx"',
        "Cache-Control": "no-store",
      } });
    }
    let context = String(form.get("context") || "").trim();
    if (!context || context.length > 30000) throw Error("Describe la compra en un texto de hasta 30.000 caracteres.");
    const attachments = form.getAll("attachments");
    if (attachments.length > 3) throw Error("Adjunta como máximo tres antecedentes.");
    let totalSize = file.size;
    for (const attachment of attachments) {
      if (!(attachment instanceof File)) continue;
      totalSize += attachment.size;
      if (totalSize > 4 * 1024 * 1024) throw Error("Los archivos juntos deben pesar como máximo 4 MB.");
      if (!/\.(docx|pdf|txt)$/i.test(attachment.name)) throw Error("Los antecedentes deben ser PDF, Word o texto.");
      const text = await extractText(Buffer.from(await attachment.arrayBuffer()), attachment.name);
      if (!text.trim()) throw Error(`No se pudo leer ${attachment.name}. Si es un escaneo, copia su información en la descripción.`);
      if (context.length + text.length > 50000) throw Error("Los antecedentes son demasiado extensos. Adjunta solo las páginas de esta compra.");
      context += `\n\nANTECEDENTE DE ESTA COMPRA (${attachment.name}):\n${text}`;
    }
    const structure = await inspectTemplate(buffer);
    const draft = await prepareDocument(structure, context, String(form.get("documentType") || "TDR").slice(0, 120));
    return NextResponse.json({ ...draft, structure, fingerprint }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo preparar el documento." }, { status: 400 });
  }
}
