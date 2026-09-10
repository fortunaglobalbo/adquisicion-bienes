import { NextRequest, NextResponse } from "next/server";
import { completeFixedDocument, seedFixedDraft, renderFixedWord, validateFixedDraft } from "@/lib/server/fixedDocuments";
import { fixedModel } from "@/lib/docx/fixedModels";
import { extractText } from "@/lib/server/extractText";
import { companyKnowledge } from "@/lib/server/companyKnowledge";
import type { Adquisicion } from "@/types";
import { analyzePurchaseBrief } from '@/lib/server/purchaseAssistant';
import { wordFormPreview } from '@/lib/server/wordFormPreview';

import { reviseFixedDocument } from "@/lib/server/reviseFixedDocument";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const json = String(form.get("request") || "{}");
    if (json.length > 500000) throw Error("El documento es demasiado extenso.");
    const body = JSON.parse(json);
    const number = Number(body.number), model = fixedModel(number);
    const adq: Adquisicion = body.adquisicion;
    if (!adq?.id || !adq?.titulo_proceso || !Array.isArray(adq.items)) throw Error("Selecciona un expediente válido.");
    const company = companyKnowledge(adq.empresa_id || "ende");
    let draft = body.draft || seedFixedDraft(number, adq);
    if (draft.companyId !== company.id) throw Error("El borrador pertenece a otra empresa.");
    let context = String(body.context || "");
    if (context.length > 40000) throw Error("Reduce la descripción a 40.000 caracteres.");
    if (body.action === 'revise') {
      validateFixedDraft(model, draft);
      if (form.getAll('attachments').length) throw Error('Para incorporar archivos utiliza Completar con IA.');
      draft = await reviseFixedDocument(model, draft, context);
    } else if (["complete", "analyze"].includes(body.action)) {
      const files = form.getAll("attachments");
      if (files.length > 3) throw Error("Adjunta hasta tres antecedentes por consulta.");
      let bytes = 0;
      const images: string[] = [];
      for (const file of files) {
        if (!(file instanceof File) || !/\.(docx|pdf|txt|png|jpg|jpeg|webp)$/i.test(file.name)) throw Error("Usa PDF, Word, TXT o imágenes JPG, PNG y WebP.");
        bytes += file.size;
        if (bytes > 3 * 1024 * 1024) throw Error("Los antecedentes deben pesar en conjunto menos de 3 MB.");
        const buffer = Buffer.from(await file.arrayBuffer());
        if (/\.(png|jpg|jpeg|webp)$/i.test(file.name)) {
          const mime = buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? "image/png" : buffer[0]===255 && buffer[1]===216 && buffer[2]===255 ? "image/jpeg" : buffer.subarray(0,4).toString()==="RIFF" && buffer.subarray(8,12).toString()==="WEBP" ? "image/webp" : null;
          if (!mime) throw Error(`La imagen ${file.name} no es un JPG, PNG o WebP válido.`);
          images.push(`data:${mime};base64,${buffer.toString("base64")}`);
          continue;
        }
        const content = await extractText(buffer, file.name);
        if (!content.trim()) throw Error(`No se pudo leer ${file.name}. Copia su contenido en la descripción si es un escaneo.`);
        context += `\nANTECEDENTE DE ESTE EXPEDIENTE (${file.name}):\n${content}`;
        if (context.length > 60000) throw Error("Los antecedentes son demasiado extensos. Adjunta solo la información de esta compra.");
      }
      if (body.action === 'analyze') return NextResponse.json({ brief: await analyzePurchaseBrief(adq, context, images) }, { headers: { 'Cache-Control': 'no-store' } });
      draft = await completeFixedDocument(number, adq, draft, context, images);
    } else if (!["preview", "download", "export"].includes(body.action)) throw Error("Acción desconocida.");
    if (body.draftOnly === true && body.action === 'complete') return NextResponse.json({ draft }, { headers: { 'Cache-Control': 'no-store' } });
    const output = await renderFixedWord(number, draft);
    if (body.action === "export") return NextResponse.json({ draft: output.draft, docx: output.buffer.toString("base64") }, { headers: { "Cache-Control": "no-store" } });
    if (body.action === "download") return new Response(new Uint8Array(output.buffer), { headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="Documento_${number}_para_revision.docx"`, "Cache-Control": "no-store",
    } });
    let pdf: string | null = null;
    let previewWarning = "Vista de contenido. La paginación final se comprueba en Word; el convertidor PDF no está configurado.";
    const previewUrl = process.env.DOCX_PREVIEW_URL;
    const previewKey = process.env.DOCX_PREVIEW_KEY;
    if (previewUrl && previewKey) {
      if (!previewUrl.startsWith("https://")) throw Error("El servicio de vista previa debe utilizar HTTPS.");
      try {
        const upload = new FormData(); upload.append("file", new Blob([new Uint8Array(output.buffer)]), "documento.docx");
        const res = await fetch(previewUrl, { method: "POST", headers: { Authorization: `Bearer ${previewKey}` }, body: upload, signal: AbortSignal.timeout(20000) });
        if (res.ok && res.headers.get("content-type")?.includes("application/pdf")) {
          const bytes = Buffer.from(await res.arrayBuffer());
          if (bytes.length > 2 * 1024 * 1024 || bytes.subarray(0, 5).toString() !== "%PDF-") throw Error("Vista PDF inválida o demasiado grande.");
          pdf = bytes.toString("base64"); previewWarning = "";
        } else previewWarning = "No se pudo obtener la vista PDF. Se muestra el contenido; el Word sigue disponible.";
      } catch { previewWarning = "El convertidor PDF no respondió. Se muestra el contenido; el Word sigue disponible."; }
    }
    const mammoth = await import("mammoth");
    const html = number===2 ? await wordFormPreview(output.buffer) : (await mammoth.convertToHtml({ buffer: output.buffer })).value;
    return NextResponse.json({ draft: output.draft, html, pdf, previewWarning, modelVersion: model.version }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[fixed-documents]", e instanceof Error ? e.stack : "Error al preparar documento");
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo preparar el documento." }, { status: 400 });
  }
}
