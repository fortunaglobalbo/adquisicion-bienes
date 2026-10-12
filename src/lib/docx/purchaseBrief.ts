import type { Adquisicion } from '@/types';
import type { FixedDraft } from './fixedModels';

export interface BriefItem { descripcion: string; cantidad: string; unidad: string; especificaciones: string; precio: string }
export interface PurchaseBrief {
  revision: string;
  confirmedAt: string | null;
  /** An automatically prepared brief is usable as a draft, but is not a user confirmation. */
  preparedAt?: string | null;
  reviewMode?: 'automatic' | 'reviewed';
  suggestions?: { field: 'purpose' | 'location' | 'deliveryDays'; value: string; reason: string }[];
  /** Informational changes in scope must not turn an otherwise complete quotation into a questionnaire. */
  notices?: string[];
  scopeChanged?: boolean;
  notes: string;
  purpose: string;
  location: string;
  deliveryDays: string;
  items: BriefItem[];
  facts: { topic: string; value: string; origin: string }[];
  conflicts: string[];
  clarification: string;
  details: Record<string, string>;
  decisions?: Record<string,string>;
}
export interface PreparedDocument { draft: FixedDraft; briefRevision: string; updatedAt: string }
export const briefDetailLabels: Record<string,string> = {
  cargo: 'Cargo del solicitante', destino: 'Destino o personal beneficiario', centro_costo: 'Centro de costo',
  proveedores: 'Posibles proveedores', destinatario: 'Empresa a la que se pedirá cotización', correo: 'Correo de la empresa',
  fecha_limite: 'Fecha límite para recibir cotizaciones', responsable_recepcion: 'Responsable de recepción',
};
export function availablePurchaseBrief(adq: Adquisicion): PurchaseBrief | null {
  const brief = adq.asistente_compra;
  return brief && (brief.confirmedAt || brief.preparedAt) ? brief : null;
}
export function initialBrief(adq: Adquisicion): PurchaseBrief {
  return adq.asistente_compra || { revision: '', confirmedAt: null, notes: '', purpose: adq.justificacion_texto || '',
    location: adq.lugar_entrega || '', deliveryDays: adq.plazo_entrega_dias > 0 ? String(adq.plazo_entrega_dias) : '',
    items: (adq.items || []).map(i => ({ descripcion: i.descripcion, cantidad: i.cantidad > 0 ? String(i.cantidad) : '', unidad: i.unidad,
      especificaciones: i.especificacionMinima || i.caracteristicasTecnicas || '', precio: i.precioUnitarioEstimado > 0 ? String(i.precioUnitarioEstimado) : '' })),
    facts: [], conflicts: [], clarification: '', details: {} };
}

const scopeStopWords = new Set(['adquisicion','compra','provision','dotacion','suministro','equipo','equipos','proteccion','personal','seguridad','industrial','trabajo','trabajos','bien','bienes','material','materiales','servicio','servicios','tecnico','tecnica','tecnicos','tecnicas','para','del','las','los','con','por','una','unos','ende','deoruro','gestion']);
const scopeWords = (value:string) => (value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().match(/[a-z]{4,}/g) || []).filter(word=>!scopeStopWords.has(word));
const scopeKey = (word:string) => word.slice(0,5);
/** Use the leading product noun, rather than shared adjectives such as "seguridad", to catch stale purchases. */
export function obsoletePurchaseMentions(value:string, previousItems:{descripcion:string}[], currentItems:{descripcion:string}[]):string[] {
  const current = new Set(currentItems.flatMap(item=>scopeWords(item.descripcion).map(scopeKey)));
  const wording = new Set(scopeWords(value).map(scopeKey));
  const obsolete = previousItems.map(item=>scopeWords(item.descripcion)[0]).filter((word):word is string=>!!word && !current.has(scopeKey(word)) && wording.has(scopeKey(word)));
  return Array.from(new Set(obsolete));
}
export function purchaseScopeChanged(previousItems:{descripcion:string}[], currentItems:{descripcion:string}[]):boolean {
  if(!previousItems.length || !currentItems.length)return false;
  const previous = new Set(previousItems.map(item=>scopeWords(item.descripcion)[0]).filter(Boolean).map(scopeKey));
  const current = new Set(currentItems.map(item=>scopeWords(item.descripcion)[0]).filter(Boolean).map(scopeKey));
  return previous.size>0 && current.size>0 && (Array.from(previous).some(word=>!current.has(word)) || Array.from(current).some(word=>!previous.has(word)));
}
export function isProtectiveEquipment(items:{descripcion:string}[]):boolean {
  return items.length>0 && items.filter(item=>/\b(?:guantes?|arn[eé]s(?:es)?|cascos?|barbiquejos?|amortiguador(?:es)?|lentes?|gafas?|bot[ií]n(?:es)?|botas?|respirador(?:es)?|mascarillas?|protecci[oó]n personal)\b/i.test(item.descripcion)).length/items.length>=0.6;
}
/** A conservative, explicitly editable purpose when the model repeats a superseded product. */
export function suggestedCurrentPurpose(items:{descripcion:string}[], area:string=''):string {
  if(isProtectiveEquipment(items))return 'Dotar al personal de equipos de protección personal adecuados para el desarrollo seguro de sus actividades.';
  return `Disponer de los bienes o servicios requeridos${area.trim()?` por ${area.trim()}`:''}, conforme a las cantidades y características detalladas en esta compra.`;
}
export function briefProblems(brief: PurchaseBrief): string[] {
  const errors: string[] = [];
  if (!brief.purpose.trim()) errors.push('Indica para qué se necesita la compra con una frase.');
  if (!brief.items.length || brief.items.some(i => !i.descripcion.trim() || !i.unidad.trim() || !/^\d+(?:[.,]\d+)?$/.test(i.cantidad) || Number(i.cantidad.replace(',', '.')) <= 0)) errors.push('Completa el bien, la cantidad y la unidad de cada ítem.');
  if (brief.deliveryDays && (!/^\d+$/.test(brief.deliveryDays) || Number(brief.deliveryDays) <= 0)) errors.push('El plazo debe ser un número de días mayor que cero.');
  if (brief.items.some(i => i.precio && (!/^\d+(?:[.,]\d{1,2})?$/.test(i.precio) || Number(i.precio.replace(',', '.')) <= 0))) errors.push('Revisa los precios estimados: usa números sin separadores de miles.');
  if (brief.conflicts.length && !brief.clarification.trim()) errors.push('Aclara la diferencia detectada en los antecedentes.');
  return errors;
}
export function briefUpdates(adq: Adquisicion, brief: PurchaseBrief): Partial<Adquisicion> {
  const items = brief.items.map((r,i) => {
    const previous = adq.items.find(item => item.descripcion === r.descripcion && item.unidad === r.unidad);
    const cantidad = Number(r.cantidad.replace(',', '.'));
    const precio = r.precio ? Number(r.precio.replace(',', '.')) : 0;
    return { id: previous?.id || crypto.randomUUID(), item: i+1, descripcion: r.descripcion, unidad: r.unidad, cantidad,
      especificacionMinima: r.especificaciones, precioUnitarioEstimado: precio, precioTotalEstimado: Math.round(cantidad * precio * 100) / 100 };
  });
  return { asistente_compra: brief, items, lugar_entrega: brief.location, plazo_entrega_dias: Number(brief.deliveryDays) || 0,
    ...(items.length && items.every(i => i.precioUnitarioEstimado > 0) ? { prevision_presupuesto: Math.round(items.reduce((s,i) => s+i.precioTotalEstimado,0)*100)/100 } : {}) };
}
