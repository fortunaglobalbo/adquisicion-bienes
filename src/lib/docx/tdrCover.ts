import type { Adquisicion } from '@/types';
import type { FixedDraft } from './fixedModels';
import { availablePurchaseBrief } from './purchaseBrief';

const summaryReason = 'Resumen redactado a partir de los ítems del expediente.';
const oldCountSummary = /^Se requiere la provisión de \d+ ítems(?: de equipos de protección personal)?, en las cantidades, unidades y características detalladas en la tabla de especificaciones técnicas\.$/i;
const missing = /^(?:\[pendiente[^\]]*\]|pendiente|[_–—\s]+)$/i;

function clean(value: unknown): string {
  const wording = String(value ?? '').replace(/\s+/g, ' ').trim();
  return missing.test(wording) ? '' : wording;
}

const units: Record<string, [string, string]> = {
  par: ['par', 'pares'], pares: ['par', 'pares'],
  pza: ['pieza', 'piezas'], pzas: ['pieza', 'piezas'], pieza: ['pieza', 'piezas'], piezas: ['pieza', 'piezas'],
  und: ['unidad', 'unidades'], unid: ['unidad', 'unidades'], unidad: ['unidad', 'unidades'], unidades: ['unidad', 'unidades'],
};

type SummaryItem = { descripcion?: string; cantidad?: number | string; unidad?: string; especificaciones?: string; especificacionMinima?: string; caracteristicasTecnicas?: string };
function details(item: SummaryItem): string[] {
  const specs = item.especificaciones || item.especificacionMinima || item.caracteristicasTecnicas || '';
  return specs.split(/\r?\n/).map(clean).filter(line => line && line.length <= 140 && line.toLowerCase() !== clean(item.descripcion).toLowerCase());
}

function itemQuantity(item: SummaryItem): string {
  const quantity = clean(item.cantidad);
  if (!quantity || Number(quantity.replace(',', '.')) === 0) return '';
  const unit = clean(item.unidad);
  if (!unit) return `una cantidad de ${quantity}`;
  const forms = units[unit.toLowerCase().replace(/\.$/, '')];
  const displayUnit = forms ? forms[Number(quantity.replace(',', '.')) === 1 ? 0 : 1] : unit;
  return `${quantity} ${displayUnit}`;
}

// Lowercase ordinary technical nouns in running text without altering brands, standards or acronyms.
const ordinaryNouns = /^(?:Bot[ií]n(?:es)?|Botas?|Guantes?|Arn[eé]s(?:es)?|Cascos?|Tipo|Resistencia|Construcción|Puntera|Plantilla|Capellada|Caña|Cuero|Forro|Protección|Tallas?|Dimensiones|Color|Material|Peso|Capacidad|Altura|Ancho|Largo)\b/;
const inline = (text: string) => text.replace(ordinaryNouns, noun => noun.toLocaleLowerCase('es'));

function shorten(text: string, limit: number): string {
  return text.length > limit ? text.slice(0, limit - 1).trimEnd() + '…' : text;
}

function summary(draft: FixedDraft, adq: Adquisicion): string {
  const brief = availablePurchaseBrief(adq);
  const groups: SummaryItem[][] = [draft.items, brief?.items || [], adq.items || []];
  const rows = groups.find(items => items.some(item => clean(item.descripcion))) || [];
  const entries = rows.map(item => ({item, name:clean(item.descripcion).toLowerCase(), features:details(item)}));
  const variants = entries.filter(entry => entry.name).map(entry => {
    const peers = entries.filter(other => other !== entry && other.name === entry.name);
    const shared = new Set(peers.flatMap(other => other.features));
    const distinct = entry.features.filter(detail => !shared.has(detail));
    return {
      label:clean(entry.item.descripcion).replace(/[.\s]+$/, ''),
      quantity:itemQuantity(entry.item),
      features:distinct.slice(0, rows.length <= 3 ? 2 : peers.length ? 1 : 0).map(inline),
    };
  });
  if (!variants.length) return clean(brief?.purpose) || clean(draft.fields.objeto) || clean(adq.titulo_proceso) || 'El alcance del requerimiento se describe en las especificaciones técnicas de este documento.';
  // Keep every row identifiable even when the table contains a hundred long descriptions.
  const limit = Math.floor(14500 / variants.length);
  const listFormat = new Intl.ListFormat('es', {type:'conjunction'});
  const sameProduct = variants.length > 1 && variants.length === rows.length && variants.every(row => row.label.toLowerCase() === variants[0].label.toLowerCase() && row.quantity);
  let wording: string;
  if (sameProduct) {
    const distinguishesModels = variants.every(row => row.features.length);
    const count = ['','una','dos','tres'][variants.length] || String(variants.length);
    const label = shorten(inline(variants[0].label), 250);
    const heading = `Se requieren ${count} ${distinguishesModels ? 'variantes' : 'ítems'} de ${label}.`;
    const lines = variants.map((row, i) => {
      const characteristics = row.features.length ? ` (${listFormat.format(row.features)})` : '';
      return shorten(`El ítem ${i + 1} comprende ${row.quantity}${characteristics}`, limit) + '.';
    });
    wording = [heading, ...lines].join(' ');
  } else {
    const list = variants.map(row => {
      const qualifiers = [row.quantity, ...row.features].filter(Boolean);
      return shorten(qualifiers.length ? `«${row.label}» (${qualifiers.join(', ')})` : `«${row.label}»`, limit);
    });
    const action = ['Servicios', 'Consultorías', 'Obras'].includes(adq.categoria) ? 'La contratación' : 'La adquisición';
    wording = `${action} comprende ${listFormat.format(list)}.`;
  }
  const destination = clean(brief?.details?.destino).replace(/[.\s]+$/, '');
  // A breakdown by recipient belongs only to the items and quantities for which it was recorded.
  const sameRows = brief?.items && rows.length === brief.items.length && rows.every((row, i) => {
    const item = brief.items[i];
    return clean(row.descripcion).toLowerCase() === clean(item.descripcion).toLowerCase()
      && clean(row.cantidad) === clean(item.cantidad) && clean(row.unidad).toLowerCase() === clean(item.unidad).toLowerCase();
  });
  if (!destination || destination.length > 500 || !sameRows) return wording;
  // When the brief explicitly gives one distinct quantity for each group of staff, preserve
  // their order without repeating the quantities already stated for the variants.
  const distribution = destination.match(/^((?:personal\s+[^(),]+)\s*)\(([^()]+)\)\s+y\s+(personal\s+[^(),]+)\s*\(([^()]+)\)(\s+de\s+[^()]*)?$/i);
  if (sameProduct && variants.length === 2 && distribution && variants[0].quantity !== variants[1].quantity
      && [distribution[2], distribution[4]].every((value, i) => clean(value).toLowerCase() === variants[i].quantity.toLowerCase())) {
    const first = distribution[1].trim().replace(/^personal/i, 'personal');
    const second = distribution[3].trim().replace(/^personal/i, 'personal');
    return `${wording} Los ítems 1 y 2 se destinan, respectivamente, al ${first} y al ${second}${distribution[5] || ''}.`;
  }
  const recipient = destination.replace(/^personal\b/i, 'el personal');
  return `${wording} El requerimiento está destinado ${/^el\s/i.test(recipient) ? 'al ' + recipient.slice(3) : 'a ' + recipient}.`;
}

function documentMonth(adq: Adquisicion): string {
  if (clean(adq.mes_anio_documento)) return clean(adq.mes_anio_documento);
  const source = adq.fecha_inicio || adq.fecha_creacion || '';
  // A date without a time identifies a local calendar day, including the first of the month.
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(source) ? source + 'T12:00:00Z' : source);
  const month = new Intl.DateTimeFormat('es-BO', {month:'long', year:'numeric', timeZone:'America/La_Paz'})
    .format(Number.isNaN(date.getTime()) ? new Date() : date);
  return month.charAt(0).toUpperCase() + month.slice(1);
}

export function fillTdrCover(draft: FixedDraft, adq: Adquisicion) {
  const previous = draft.proposals?.resumen;
  const value = clean(draft.fields.resumen);
  const derived = previous?.reason === summaryReason && previous.value === draft.fields.resumen;
  if (!draft.editedFields?.includes('resumen') && !draft.confirmedFields?.includes('resumen') && (!value || derived || oldCountSummary.test(value))) {
    draft.fields.resumen = summary(draft, adq);
    draft.proposals = {...draft.proposals, resumen: {value:draft.fields.resumen, reason:summaryReason}};
  }
  if (!clean(draft.fields.mes_anio) && !draft.editedFields?.includes('mes_anio') && !draft.confirmedFields?.includes('mes_anio')) {
    draft.fields.mes_anio = documentMonth(adq);
  }
}
