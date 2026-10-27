import { validateAttachmentSelection, type AttachmentUpload, type PurchaseAttachmentRef } from './attachmentPolicy';

// This threshold chooses a transport only. The shared policy defines the limits.
const INLINE_ATTACHMENT_BYTES = 2.5 * 1024 * 1024;

export type AttachmentUploadProgress = { completed: number; total: number; fileName: string };
type UploadOptions = { signal?: AbortSignal; onProgress?: (progress: AttachmentUploadProgress) => void };

function checkCancelled(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Proceso cancelado.', 'AbortError');
}

function isSignedAttachment(value: unknown, file: File): value is AttachmentUpload {
  if (!value || typeof value !== 'object') return false;
  const upload = value as Partial<AttachmentUpload>, ref = upload.ref;
  return typeof upload.signedUrl === 'string' && !!upload.signedUrl && !!ref &&
    typeof ref.path === 'string' && !!ref.path && ref.name === file.name && ref.size === file.size &&
    typeof ref.type === 'string' && !!ref.type && Number.isFinite(ref.expiresAt) && ref.expiresAt > Date.now() &&
    typeof ref.proof === 'string' && !!ref.proof;
}

async function removeUploads(acquisitionId: string, refs: PurchaseAttachmentRef[]): Promise<void> {
  if (!refs.length) return;
  const controller = new AbortController(), deadline = setTimeout(() => controller.abort(), 5000);
  try {
    // Cleanup must still run when the read/upload request was cancelled.
    await fetch('/api/attachments', { method: 'DELETE', keepalive: true, signal: controller.signal,
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acquisitionId, refs }) });
  } catch {} finally { clearTimeout(deadline); }
}

export async function cleanupPurchaseAttachmentUploads(form: FormData, acquisitionId: string): Promise<void> {
  const value = form.get('attachmentRefs');
  if (typeof value !== 'string') return;
  try {
    const refs: unknown = JSON.parse(value);
    if (Array.isArray(refs)) await removeUploads(acquisitionId, refs);
  } catch {}
}

export async function appendPurchaseAttachments(form: FormData, files: File[], acquisitionId: string, options: UploadOptions = {}): Promise<void> {
  const { signal, onProgress } = options;
  checkCancelled(signal);
  const problem = validateAttachmentSelection(files);
  if (problem) throw Error(problem);
  if (!files.length) return;
  if (files.reduce((total, file) => total + file.size, 0) <= INLINE_ATTACHMENT_BYTES) {
    files.forEach(file => form.append('attachments', file));
    return;
  }
  if (!acquisitionId) throw Error('No se encontró la compra para subir los archivos.');

  // Large file bytes go directly to storage; application requests carry only refs.
  let uploads: AttachmentUpload[];
  try {
    const response = await fetch('/api/attachments', { method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acquisitionId, files: files.map(({ name, size, type }) => ({ name, size, type })) }) });
    if (!response.ok) throw Error('sign');
    const result: unknown = await response.json();
    const candidates = result && typeof result === 'object' ? (result as { uploads?: unknown }).uploads : undefined;
    if (!Array.isArray(candidates) || candidates.length !== files.length || !candidates.every((upload, index) => isSignedAttachment(upload, files[index]))) throw Error('sign');
    uploads = candidates;
  } catch {
    checkCancelled(signal);
    throw Error('No se pudo iniciar la subida de los archivos. Vuelve a intentar.');
  }

  try {
    for (let index = 0; index < files.length; index++) {
      checkCancelled(signal);
      const file = files[index], upload = uploads[index];
      onProgress?.({ completed: index, total: files.length, fileName: file.name });
      try {
        const response = await fetch(upload.signedUrl, { method: 'PUT', body: file, signal, credentials: 'omit', referrerPolicy: 'no-referrer',
          headers: { 'Content-Type': upload.ref.type, 'cache-control': 'max-age=0', 'x-upsert': 'false' } });
        if (!response.ok) throw Error('upload');
      } catch {
        checkCancelled(signal);
        throw Error(`No se pudo subir el archivo ${index + 1} de ${files.length}. Los archivos seleccionados se conservan para volver a intentar.`);
      }
      checkCancelled(signal);
      onProgress?.({ completed: index + 1, total: files.length, fileName: file.name });
    }
    checkCancelled(signal);
    form.append('attachmentRefs', JSON.stringify(uploads.map(upload => upload.ref)));
  } catch (cause) {
    await removeUploads(acquisitionId, uploads.map(upload => upload.ref));
    throw cause;
  }
}
