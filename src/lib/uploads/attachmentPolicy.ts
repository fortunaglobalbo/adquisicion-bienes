export const MAX_ATTACHMENT_FILES = 20;
export const MAX_ATTACHMENT_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_VISION_IMAGES = 24;
export const SUPPORTED_ATTACHMENT_PATTERN = /\.(?:jpe?g|png|webp|pdf|docx|txt)$/i;
export const ATTACHMENT_HELP_TEXT = "Hasta 20 archivos: fotos JPG, PNG o WebP, PDF, Word o TXT. Máximo 50 MB por archivo.";

export interface PurchaseAttachmentRef {
  path: string;
  name: string;
  size: number;
  type: string;
  /** UTC expiry in milliseconds, matching the two-hour upload permission. */
  expiresAt: number;
  proof: string;
}

export interface AttachmentUpload {
  ref: PurchaseAttachmentRef;
  signedUrl: string;
}

export function attachmentContentType(name: string): string {
  const extension = name.toLowerCase().split(".").pop();
  const types: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
    pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    txt: "text/plain",
  };
  return types[extension || ""] || "application/octet-stream";
}

export function validateAttachmentSelection(files: ReadonlyArray<{ name: string; size: number }>): string | undefined {
  if (files.length > MAX_ATTACHMENT_FILES) return `Adjunta como máximo ${MAX_ATTACHMENT_FILES} archivos.`;
  for (const file of files) {
    if (typeof file.name !== "string" || !file.name || file.name.length > 255 || /[\u0000-\u001f\u007f/\\]/.test(file.name)) {
      return "Uno de los archivos tiene un nombre inválido.";
    }
    if (!SUPPORTED_ATTACHMENT_PATTERN.test(file.name)) return `El archivo «${file.name}» no es compatible. Usa JPG, PNG, WebP, PDF, DOCX o TXT.`;
    if (!Number.isSafeInteger(file.size) || file.size <= 0) return `El archivo «${file.name}» está vacío o tiene un tamaño inválido.`;
    if (file.size > MAX_ATTACHMENT_FILE_BYTES) return `El archivo «${file.name}» supera los 50 MB por archivo.`;
  }
}
