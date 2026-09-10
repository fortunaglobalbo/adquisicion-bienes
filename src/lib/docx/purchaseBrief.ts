import type { Adquisicion } from '@/types';
import type { FixedDraft } from './fixedModels';

export interface BriefItem { descripcion: string; cantidad: string; unidad: string; especificaciones: string; precio: string }
export interface PurchaseBrief {
  revision: string;
  confirmedAt: string | null;
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
export function initialBrief(adq: Adquisicion): PurchaseBrief {
  return adq.asistente_compra || { revision: '', confirmedAt: null, notes: '', purpose: adq.justificacion_texto || '',
    location: adq.lugar_entrega || '', deliveryDays: adq.plazo_entrega_dias > 0 ? String(adq.plazo_entrega_dias) : '',
    items: (adq.items || []).map(i => ({ descripcion: i.descripcion, cantidad: i.cantidad > 0 ? String(i.cantidad) : '', unidad: i.unidad,
      especificaciones: i.especificacionMinima || i.caracteristicasTecnicas || '', precio: i.precioUnitarioEstimado > 0 ? String(i.precioUnitarioEstimado) : '' })),
    facts: [], conflicts: [], clarification: '', details: {} };
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
