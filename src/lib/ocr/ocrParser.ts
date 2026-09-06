import { CampoExtraido, ItemAdquisicion } from "@/types";
export interface OcrExtractionResult { campos: CampoExtraido[]; itemsExtraidos: ItemAdquisicion[]; advertencias: string[]; montoDetectado?: number; nitDetectado?: string; esValido: boolean; }

// Extract only explicit source labels. A filename or folder is never evidence of
// approval, tax status, a supplier, a price or successful delivery.
export function parseOcrDocument(fileName: string, carpetaNumero: number, adquisicionCodigo: string, adquisicionTitulo: string, rawText = ""): OcrExtractionResult {
  const campos: CampoExtraido[] = [];
  const advertencias: string[] = [];
  const patterns: [string, RegExp][] = [
    ["NIT_PROVEEDOR", /\bNIT\s*[:#.-]?\s*(\d{5,20})/i],
    ["EMPRESA_PROPONENTE", /(?:raz[oó]n social|proveedor|empresa)\s*:\s*([^\r\n]+)/i],
    ["PARTIDA_PRESUPUESTARIA", /partida(?: presupuestaria)?\s*:\s*([^\r\n]+)/i],
    ["MONTO_COTIZADO_BS", /(?:monto total|total(?: general)?)\s*(?:Bs\.?)?\s*:\s*(?:Bs\.?\s*)?([\d.,]+(?:\s*Bs\.?)?)/i],
    ["PLAZO_ENTREGA", /plazo(?: de)? entrega\s*:\s*([^\r\n]+)/i],
    ["VALIDEZ_PROPUESTA", /(?:validez|vigencia)(?: de la)?(?: propuesta| oferta)?\s*:\s*([^\r\n]+)/i],
    ["SOLICITANTE", /solicitante\s*:\s*([^\r\n]+)/i],
  ];
  for (const [clave, expression] of patterns) {
    const match = rawText.match(expression);
    if (match) campos.push({ id: crypto.randomUUID(), documento_id: "", adquisicion_id: adquisicionCodigo, clave, valor: match[1].trim(), confianza: 0.8, fecha_extraccion: new Date().toISOString() });
  }
  if (!rawText.trim()) advertencias.push("No se pudo extraer texto legible. El original se conserva; revisa el documento manualmente.");
  else if (!campos.length) advertencias.push("Se leyó el archivo, pero no se identificaron campos rotulados. Revisa el original.");
  const code = rawText.match(/ENDE-D-\d{4}-\d+/i)?.[0];
  if (code && code.toUpperCase() !== adquisicionCodigo.toUpperCase()) advertencias.push(`El documento menciona el proceso ${code}, distinto del expediente actual.`);
  return { campos, itemsExtraidos: [], advertencias, nitDetectado: campos.find(c => c.clave === "NIT_PROVEEDOR")?.valor, esValido: !!rawText.trim() && !advertencias.length };
}
