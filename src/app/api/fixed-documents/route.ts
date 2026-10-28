import { completeTdrDraft } from '@/lib/docx/completeTdrDraft';
import { NextRequest, NextResponse } from "next/server";
import { completeFixedDocument, seedFixedDraft, renderFixedWord, validateFixedDraft } from "@/lib/server/fixedDocuments";
import { fixedModel, upgradeFixedDraft } from "@/lib/docx/fixedModels";
import { extractPurchaseAttachment } from "@/lib/server/extractText";
import { companyKnowledge } from "@/lib/server/companyKnowledge";
import type { Adquisicion } from "@/types";
import { purchaseReadingStream } from '@/lib/server/purchaseReadingStream';
import { analyzePurchaseBrief } from '@/lib/server/purchaseAssistant';
import { wordFormPreview } from '@/lib/server/wordFormPreview';

import { reviseFixedDocument, RevisionClarification } from "@/lib/server/reviseFixedDocument";
import { fillAdministrativeBlanks } from '@/lib/docx/administrativeDefaults';
import { updateTechnicalEvaluation, fillEvaluationReferences } from '@/lib/server/technicalEvaluation';
import { evaluationPreview } from '@/lib/server/evaluationPreview';
import { editableDocumentPreview } from '@/lib/server/editableDocumentPreview';
import { updateComparativeReport } from '@/lib/server/comparativeReport';
import { readPurchaseAttachments, cleanupPurchaseAttachments } from '@/lib/server/attachmentUploads';
import { prepareVisionImage } from '@/lib/server/visionImages';
import { MAX_VISION_IMAGES } from '@/lib/uploads/attachmentPolicy';

export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(req: NextRequest) {
  let attachmentForm:FormData|undefined,attachmentAcquisition='';
  try {
    const form = await req.formData();
    attachmentForm=form;
    const json = String(form.get("request") || "{}");
    if (json.length > 500000) throw Error("El documento es demasiado extenso.");
    const body = JSON.parse(json);
    const number = Number(body.number), model = fixedModel(number);
    const adq: Adquisicion = body.adquisicion;
    attachmentAcquisition=adq?.id||'';
    if (!adq?.id || !adq?.titulo_proceso || !Array.isArray(adq.items)) throw Error("Selecciona un expediente válido.");
    const company = companyKnowledge(adq.empresa_id || "ende");
    let draft = upgradeFixedDraft(number,body.draft || seedFixedDraft(number, adq));
    draft = fillAdministrativeBlanks(draft, adq, number);
    if(number===6) draft = fillEvaluationReferences(draft,adq);
    if (draft.companyId !== company.id) throw Error("El borrador pertenece a otra empresa.");
    let context = String(body.context || "");
    if (context.length > 40000) throw Error("Reduce la descripción a 40.000 caracteres.");
    let revisionSummary: string[] = [];
    let revised = false;
    if (["complete", "analyze", "revise"].includes(body.action)) {
      const attachmentSignal=AbortSignal.any([req.signal,AbortSignal.timeout(30_000)]);
      const images: string[] = [];
      for await (const file of readPurchaseAttachments(form,adq.id,attachmentSignal)) {
        const buffer = Buffer.from(await file.arrayBuffer());
        if (/\.(png|jpg|jpeg|webp)$/i.test(file.name)) {
          if(images.length>=MAX_VISION_IMAGES)throw Error(`La lectura admite hasta ${MAX_VISION_IMAGES} fotos o páginas escaneadas. Divide los antecedentes en dos lecturas.`);
          images.push(await prepareVisionImage(buffer,file.name));
          continue;
        }
        const content = await extractPurchaseAttachment(buffer, file.name, MAX_VISION_IMAGES-images.length);
        if (!content.text.trim() && !content.images.length) throw Error(`No se pudo leer ${file.name}. Adjunta una imagen legible o un documento con contenido.`);
        images.push(...content.images);
        context += `\nANTECEDENTE DE ESTE EXPEDIENTE (${file.name}):\n${content.text}${content.images.length?'\nSus páginas escaneadas se adjuntan como imágenes para lectura con visión.':''}`;
        if (context.length > 60000) throw Error("Los antecedentes son demasiado extensos. Adjunta solo la información de esta compra.");
      }
      attachmentSignal.throwIfAborted();
      if(images.reduce((total,url)=>total+url.length,0)>12*1024*1024) throw Error('Las imágenes preparadas son demasiado grandes para una lectura completa. Divide los antecedentes en consultas más pequeñas.');
      if (body.action === 'analyze') {
        if (body.stream === true) return purchaseReadingStream(adq,context,images,req.signal);
        return NextResponse.json({ brief: await analyzePurchaseBrief(adq, context, images, {signal:req.signal}) }, { headers: { 'Cache-Control': 'no-store' } });
      }
      // Decide on the server too: an older open tab may still send "complete" for an edit.
      const revision = body.action === 'revise' || (body.action === 'complete' && !!body.draft && !!context.trim() && body.draftOnly !== true);
      if (revision) {
        validateFixedDraft(model, draft);
        const previous = draft;
        try { draft = await reviseFixedDocument(model, draft, context, images); }
        catch (e) {
          if (e instanceof RevisionClarification) return NextResponse.json({draft:previous,question:e.message,instruction:String(body.context||''),revisionSummary:[]}, {headers:{'Cache-Control':'no-store'}});
          throw e;
        }
        revisionSummary = model.fields.filter(f=>draft.fields[f.key]!==previous.fields[f.key]).map(f=>f.label);
        if (JSON.stringify(draft.items)!==JSON.stringify(previous.items)) revisionSummary.push('Ítems del documento');
        revised = true;
      } else draft = await completeFixedDocument(number, adq, draft, context, images);
    } else if (body.action === 'refresh-evaluation' && number === 6) {
      validateFixedDraft(model,draft);
      draft=updateTechnicalEvaluation(draft,adq);
    } else if (body.action === 'refresh-comparative' && number === 3) {
      validateFixedDraft(model,draft);
      draft=updateComparativeReport(draft,adq);
    } else if (!["preview", "download", "export"].includes(body.action)) throw Error("Acción desconocida.");
    draft=completeTdrDraft(number,draft,adq);
    if (body.draftOnly === true && body.action === 'complete') return NextResponse.json({ draft }, { headers: { 'Cache-Control': 'no-store' } });
    const output = await renderFixedWord(number, draft, adq);
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
    const html = number===2 ? await wordFormPreview(output.buffer) : [3,6].includes(number) ? await evaluationPreview(output.buffer) : (await mammoth.convertToHtml({ buffer: output.buffer })).value;
    const editableHtml=await editableDocumentPreview(output.buffer,output.draft,model,html);
    return NextResponse.json({ draft: output.draft, html, editableHtml, pdf, previewWarning, revised, revisionSummary, modelVersion: model.version }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[fixed-documents]", e instanceof Error ? e.stack : "Error al preparar documento");
    return NextResponse.json({ error: e instanceof Error&&e.name==='TimeoutError' ? 'La preparación de los archivos tardó demasiado. Los archivos seleccionados y el borrador se conservan; vuelve a intentar.' : e instanceof Error ? e.message : "No se pudo preparar el documento." }, { status: 400 });
  } finally {
    if(attachmentForm&&attachmentAcquisition)await cleanupPurchaseAttachments(attachmentForm,attachmentAcquisition).catch(()=>{});
  }
}
