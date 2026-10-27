import { NextRequest, NextResponse } from "next/server";
import { AttachmentUploadError, createPurchaseAttachmentUploads, deletePurchaseAttachmentUploads } from "@/lib/server/attachmentUploads";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_REQUEST_BYTES = 64 * 1024;

async function boundedRequestText(request: NextRequest): Promise<string> {
  if (Number(request.headers.get("content-length")) > MAX_REQUEST_BYTES) throw new AttachmentUploadError("La solicitud de carga es demasiado grande.");
  if (!request.body) throw new AttachmentUploadError("La solicitud de carga es inválida.");
  const reader = request.body.getReader(), decoder = new TextDecoder();
  let size = 0, text = "";
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > MAX_REQUEST_BYTES) {
        await reader.cancel();
        throw new AttachmentUploadError("La solicitud de carga es demasiado grande.");
      }
      text += decoder.decode(part.value, { stream: true });
    }
  } finally { reader.releaseLock(); }
  return text + decoder.decode();
}

async function requestBody(request: NextRequest): Promise<Record<string, unknown>> {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    throw new AttachmentUploadError("El origen de la solicitud no está permitido.", 403);
  }
  const text = await boundedRequestText(request);
  let body: unknown;
  try { body = JSON.parse(text); } catch { throw new AttachmentUploadError("La solicitud de carga es inválida."); }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new AttachmentUploadError("La solicitud de carga es inválida.");
  return body as Record<string, unknown>;
}

function failure(error: unknown) {
  const known = error instanceof AttachmentUploadError;
  return NextResponse.json({ error: known ? error.message : "No se pudo preparar la carga de los adjuntos. Intenta nuevamente." }, { status: known ? error.status : 503 });
}

export async function POST(request: NextRequest) {
  try {
    const { acquisitionId, files } = await requestBody(request);
    const uploads = await createPurchaseAttachmentUploads(acquisitionId, files);
    return NextResponse.json({ uploads }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return failure(error); }
}

export async function DELETE(request: NextRequest) {
  try {
    const { acquisitionId, refs } = await requestBody(request);
    await deletePurchaseAttachmentUploads(acquisitionId, refs);
    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return failure(error); }
}
