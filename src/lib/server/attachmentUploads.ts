import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { database } from "./database";
import { companyKnowledge } from "./companyKnowledge";
import {
  attachmentContentType, MAX_ATTACHMENT_FILE_BYTES, validateAttachmentSelection,
  type AttachmentUpload, type PurchaseAttachmentRef,
} from "../uploads/attachmentPolicy";

const BUCKET = "purchase-inputs";
const UPLOAD_LIFETIME_MS = 2 * 60 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_REF_JSON_LENGTH = 64 * 1024;
const CLEANUP_BUDGET_MS = 3000;

export class AttachmentUploadError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); }
}

function acquisitionId(value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) throw new AttachmentUploadError("El expediente tiene un identificador inválido.");
  return value.toLowerCase();
}

function signingSecret(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  let role = "";
  try { role = JSON.parse(Buffer.from(key?.split(".")[1] || "", "base64url").toString()).role || ""; } catch { /* New secret keys are not JWTs. */ }
  if (!key || key.startsWith("sb_publishable_") || role === "anon" || role === "authenticated" ||
      key === process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || key === process.env.SUPABASE_ANON_KEY ||
      (!process.env.SUPABASE_SERVICE_ROLE_KEY && role !== "service_role" && !key.startsWith("sb_secret_"))) {
    throw new AttachmentUploadError("Las cargas grandes requieren SUPABASE_SERVICE_ROLE_KEY o una SUPABASE_KEY privada de servicio en el servidor.", 503);
  }
  return key;
}

function safeName(name: string): string {
  return name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-150);
}

function proof(ref: Omit<PurchaseAttachmentRef, "proof">, secret: string): string {
  return createHmac("sha256", secret).update(JSON.stringify([
    "purchase-input-v1", BUCKET, ref.path, ref.name, ref.size, ref.type, ref.expiresAt,
  ])).digest("base64url");
}

async function assertAcquisition(db: ReturnType<typeof database>, id: string) {
  const found = await db.from("adquisiciones").select("*").eq("id", id).maybeSingle();
  if (found.error) throw new AttachmentUploadError("No se pudo verificar el expediente. Intenta nuevamente.", 503);
  if (!found.data) throw new AttachmentUploadError("Expediente no encontrado. Guarda el expediente antes de adjuntar archivos grandes.", 404);
  try { companyKnowledge(found.data.empresa_id || "ende"); }
  catch { throw new AttachmentUploadError("Los archivos de esta empresa aún no están habilitados.", 403); }
}

async function ensurePrivateBucket(db: ReturnType<typeof database>) {
  const info = await db.storage.getBucket(BUCKET);
  if (info.error) {
    if (!/not found|not exist/i.test(info.error.message) && String((info.error as { statusCode?: string }).statusCode) !== "404") {
      throw new AttachmentUploadError("No se pudo acceder al almacenamiento de adjuntos.", 503);
    }
    const created = await db.storage.createBucket(BUCKET, {
      public: false, fileSizeLimit: MAX_ATTACHMENT_FILE_BYTES,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"],
    });
    if (created.error && !/already|exist/i.test(created.error.message)) throw new AttachmentUploadError("No se pudo preparar el almacenamiento privado de adjuntos.", 503);
    // Another request may have created the bucket concurrently; verify its privacy.
    const checked = await db.storage.getBucket(BUCKET);
    if (checked.error || !checked.data || checked.data.public) throw new AttachmentUploadError("El almacenamiento de adjuntos debe ser privado.", 503);
    return;
  }
  if (!info.data || info.data.public) throw new AttachmentUploadError("El almacenamiento de adjuntos debe ser privado.", 503);
  if (Number(info.data.file_size_limit) !== MAX_ATTACHMENT_FILE_BYTES) {
    const updated = await db.storage.updateBucket(BUCKET, { public: false, fileSizeLimit: MAX_ATTACHMENT_FILE_BYTES });
    if (updated.error) throw new AttachmentUploadError("No se pudo configurar el límite de 50 MB por adjunto.", 503);
  }
}

/** The browser receives only upload permissions and signed references, never a storage key. */
export async function createPurchaseAttachmentUploads(idValue: unknown, input: unknown): Promise<AttachmentUpload[]> {
  const id = acquisitionId(idValue);
  if (!Array.isArray(input) || !input.length || input.some(file => !file || typeof file !== "object")) {
    throw new AttachmentUploadError("Selecciona los archivos que deseas adjuntar.");
  }
  const files = input as Array<{ name: string; size: number; type: string }>;
  const issue = validateAttachmentSelection(files);
  if (issue) throw new AttachmentUploadError(issue);
  for (const file of files) {
    const declared = typeof file.type === "string" ? file.type.toLowerCase() : "";
    if (declared && declared !== "application/octet-stream" && declared !== attachmentContentType(file.name) && !(declared === "image/jpg" && attachmentContentType(file.name) === "image/jpeg")) {
      throw new AttachmentUploadError(`El tipo del archivo «${file.name}» no corresponde a su extensión.`);
    }
  }
  const secret = signingSecret();
  const db = database();
  await assertAcquisition(db, id);
  await ensurePrivateBucket(db);
  const uploads: AttachmentUpload[] = [];
  // Signing creates permissions, not objects. Keep the manifest order while
  // avoiding twenty consecutive round trips for a full selection.
  for (let start = 0; start < files.length; start += 4) {
    const batch = await Promise.all(files.slice(start, start + 4).map(async file => {
      const ref = { path: `${id}/${randomUUID()}/${safeName(file.name)}`, name: file.name, size: file.size,
        type: attachmentContentType(file.name), expiresAt: Date.now() + UPLOAD_LIFETIME_MS };
      const signed = await db.storage.from(BUCKET).createSignedUploadUrl(ref.path, { upsert: false });
      if (signed.error || !signed.data) throw new AttachmentUploadError("No se pudo autorizar la carga de los adjuntos. Intenta nuevamente.", 503);
      return { ref: { ...ref, proof: proof(ref, secret) }, signedUrl: signed.data.signedUrl };
    }));
    uploads.push(...batch);
  }
  return uploads;
}

function validatedRefs(form: FormData, id: string, allowExpired = false): PurchaseAttachmentRef[] {
  const values = form.getAll("attachmentRefs");
  if (!values.length) return [];
  if (values.length !== 1 || typeof values[0] !== "string" || values[0].length > MAX_REF_JSON_LENGTH) throw new AttachmentUploadError("La referencia de los adjuntos es inválida.");
  let input: unknown;
  try { input = JSON.parse(values[0]); } catch { throw new AttachmentUploadError("La referencia de los adjuntos es inválida."); }
  if (!Array.isArray(input)) throw new AttachmentUploadError("La referencia de los adjuntos es inválida.");
  const issue = validateAttachmentSelection(input.filter(file => file && typeof file === "object"));
  if (issue) throw new AttachmentUploadError(issue);
  if (!input.length) return [];
  const secret = signingSecret(), seen = new Set<string>();
  return input.map(value => {
    if (!value || typeof value !== "object") throw new AttachmentUploadError("La referencia de un adjunto es inválida.");
    const ref = value as PurchaseAttachmentRef;
    const segments = typeof ref.path === "string" ? ref.path.split("/") : [];
    if (segments.length !== 3 || segments[0] !== id || !UUID.test(segments[1]) || segments[2] !== safeName(ref.name) ||
        !/^[a-zA-Z0-9._-]{1,150}$/.test(segments[2]) || seen.has(ref.path) || ref.type !== attachmentContentType(ref.name) ||
        !Number.isSafeInteger(ref.expiresAt) || ref.expiresAt > Date.now() + UPLOAD_LIFETIME_MS + 60_000 ||
        typeof ref.proof !== "string" || !/^[a-zA-Z0-9_-]{43}$/.test(ref.proof)) {
      throw new AttachmentUploadError("La referencia de un adjunto no corresponde al expediente.");
    }
    const expected = proof(ref, secret);
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(ref.proof))) throw new AttachmentUploadError("La autorización de un adjunto no es válida. Vuelve a adjuntarlo.");
    if (!allowExpired && ref.expiresAt <= Date.now()) throw new AttachmentUploadError("La carga de los adjuntos venció. Vuelve a enviarlos.");
    seen.add(ref.path);
    return ref;
  });
}

async function downloadAttachment(db: ReturnType<typeof database>, ref: PurchaseAttachmentRef, signal?: AbortSignal): Promise<File> {
  signal?.throwIfAborted();
  const signed = await db.storage.from(BUCKET).createSignedUrl(ref.path, 300);
  if (signed.error || !signed.data) throw new AttachmentUploadError(`No se pudo recuperar «${ref.name}». Vuelve a adjuntarlo.`, 400);
  const timeout = AbortSignal.timeout(120_000);
  const response = await fetch(signed.data.signedUrl, { cache: "no-store", signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  if (!response.ok || !response.body) throw new AttachmentUploadError(`No se pudo recuperar «${ref.name}». Vuelve a adjuntarlo.`, 400);
  const length = response.headers.get("content-length");
  if (length !== null && Number(length) !== ref.size) {
    await response.body.cancel();
    throw new AttachmentUploadError(`El tamaño de «${ref.name}» cambió durante la carga. Vuelve a adjuntarlo.`);
  }
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > ref.size || size > MAX_ATTACHMENT_FILE_BYTES) {
        await reader.cancel();
        throw new AttachmentUploadError(`El tamaño de «${ref.name}» cambió durante la carga. Vuelve a adjuntarlo.`);
      }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  if (size !== ref.size) throw new AttachmentUploadError(`La carga de «${ref.name}» está incompleta. Vuelve a adjuntarlo.`);
  return new File(chunks as BlobPart[], ref.name, { type: ref.type });
}

/** Validate the whole manifest before downloading, then hold at most one stored file at a time. */
export async function* readPurchaseAttachments(form: FormData, idValue: string, signal?: AbortSignal): AsyncGenerator<File> {
  const inline = form.getAll("attachments");
  if (inline.some(file => !(file instanceof File))) throw new AttachmentUploadError("Uno de los adjuntos es inválido.");
  const files = inline as File[];
  const hasRefs = form.has("attachmentRefs");
  const id = hasRefs ? acquisitionId(idValue) : idValue;
  const refs = validatedRefs(form, id);
  const issue = validateAttachmentSelection([...files, ...refs]);
  if (issue) throw new AttachmentUploadError(issue);
  const db = refs.length ? database() : undefined;
  if (db) await assertAcquisition(db, id);
  for (const file of files) { signal?.throwIfAborted(); yield file; }
  for (const ref of refs) yield await downloadAttachment(db!, ref, signal);
}

/** Only temporary, signed paths in purchase-inputs are eligible for removal. */
export async function deletePurchaseAttachmentUploads(idValue: unknown, input: unknown): Promise<void> {
  const id = acquisitionId(idValue);
  if (!Array.isArray(input)) throw new AttachmentUploadError("La referencia de los adjuntos es inválida.");
  const form = new FormData();
  form.set("attachmentRefs", JSON.stringify(input));
  const refs = validatedRefs(form, id, true);
  if (!refs.length) return;
  // A valid proof is the capability to remove this temporary object, including
  // after the expediente was removed or the two-hour upload permission expired.
  const removed = await database().storage.from(BUCKET).remove(refs.map(ref => ref.path));
  if (removed.error) throw new AttachmentUploadError("No se pudieron eliminar algunos adjuntos temporales.", 503);
}

export async function cleanupPurchaseAttachments(form: FormData, idValue: string): Promise<void> {
  if (!form.has("attachmentRefs")) return;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const refs = validatedRefs(form, acquisitionId(idValue), true);
    if (!refs.length) return;
    // Cleanup is best effort. Do not spend the document response's remaining
    // execution budget waiting on storage; the browser also requests cleanup.
    const removed = await Promise.race([
      database().storage.from(BUCKET).remove(refs.map(ref => ref.path)),
      new Promise<null>(resolve => { timeout = setTimeout(() => resolve(null), CLEANUP_BUDGET_MS); }),
    ]);
    if (removed?.error) console.warn("No se pudieron eliminar algunos adjuntos temporales.");
  } catch { /* Cleanup must never replace the result of document processing. */ }
  finally { if (timeout) clearTimeout(timeout); }
}
