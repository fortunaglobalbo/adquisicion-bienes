import type { Adquisicion } from '@/types';
import type { FixedDraft } from './fixedModels';
import { hasAdministrativeValue } from './administrativeDefaults';
import { availablePurchaseBrief } from './purchaseBrief';

const signatories = ['elaborado', 'revisado', 'aprobado'] as const;
const compact = (value: string) => value.replace(/\s+/g, ' ').trim();
const plain = (value: string) => compact(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// Only use an identifiable TDR for this requirement. An attached quotation, a TDR
// for other goods, or competing versions cannot establish the document's signatories.
function attachedTdr(adq: Adquisicion, draft: FixedDraft): string | undefined {
  const brief = availablePurchaseBrief(adq);
  if (!brief?.notes || draft.editedItems) return;
  const rows = draft.items.length ? draft.items : brief.items;
  if (!rows.length) return;
  const attachments = brief.notes.split(/^ANTECEDENTE DE ESTE EXPEDIENTE \([^\n]+\):[ \t]*\r?$/m).slice(1);
  const matches = attachments.filter(body => {
    const cover = plain(body.split(/índice general|p[aá]gina 2\s*:/i)[0].slice(0, 4000));
    if (!/especificaciones tecnicas|terminos de referencia/.test(cover) || !cover.includes('ende deoruro') || !cover.includes('resumen')) return false;
    const words = new Set((cover.match(/[a-z]{4,}/g) || []).map(word => word.slice(0, 5)));
    return rows.every(item => {
      const names = plain(item.descripcion || '').match(/[a-z]{4,}/g) || [];
      const product = names.find(word => !['adquisicion','compra','servicio','servicios','provision','suministro','para'].includes(word));
      return !!product && words.has(product.slice(0, 5));
    });
  });
  return matches.length === 1 ? matches[0] : undefined;
}

function coverPeople(body: string): string[] {
  const block = /\belaborado(?:\s+por)?\s+revisado(?:\s+por)?\s+aprobado(?:\s+por)?\s+([\s\S]{1,700}?)\s+resumen\b/i.exec(body)?.[1];
  if (!block) return [];
  const people = compact(block).split(/\s+(?=(?:Ing|Lic|Arq|T[eé]c|Dr|Dra)\.\s+)/i);
  return people.length === 3 && people.every(person => /^(?:Ing|Lic|Arq|T[eé]c|Dr|Dra)\.\s+.+?\s+[-–—]\s+\S/i.test(person)) ? people : [];
}

export function fillTdrReference(draft: FixedDraft, adq: Adquisicion): void {
  const reference = attachedTdr(adq, draft);
  const people = reference ? coverPeople(reference) : [];
  const official = adq.responsables_oficiales?.['1'];
  const roleLabels = ['Unidad solicitante', 'Responsable de revisión técnica', 'Autoridad competente para la aprobación'];
  for (let index = 0; index < signatories.length; index++) {
    const key = signatories[index];
    if (draft.editedFields?.includes(key) || draft.confirmedFields?.includes(key)) continue;
    const current = draft.fields[key];
    if (hasAdministrativeValue(current) && !current.startsWith('Cargo: ') && current !== adq[`${key}_por`]) continue;
    const name = adq[`${key}_por`];
    const role = adq[`${key}_cargo`];
    const named = hasAdministrativeValue(name) && hasAdministrativeValue(role) && !/[\n]|\s[-–—]\s/.test(name) ? `${name} - ${role}` : name;
    const known = [official?.[key], named, people[index], key === 'elaborado' ? adq.responsable_proceso : undefined].find(hasAdministrativeValue);
    // A job title identifies the function without certifying who signed the TDR.
    draft.fields[key] = known || `Cargo: ${hasAdministrativeValue(role) ? role : roleLabels[index]}`;
  }
  if (!reference) return;
  // Require the numbered body headings on separate lines to skip the index.
  const sections = [
    { key: 'vigencia', explicit: adq.vigencia_propuesta_texto, match: /(?:^|\n)7[.)]?\s+VIGENCIA DE LA PROPUESTA[ \t]*\r?\n([\s\S]{1,1500}?)\r?\n8[.)]?\s+CATEGOR[IÍ]A\b/i },
    { key: 'plazo', explicit: adq.tiempo_entrega_texto, match: /(?:^|\n)10[.)]?\s+TIEMPO DE ENTREGA[ \t]*\r?\n([\s\S]{1,1000}?)\r?\n11[.)]?\s+FORMA DE ADJUDICACI[OÓ]N\b/i },
    { key: 'pago', explicit: adq.forma_pago_texto, match: /(?:^|\n)13[.)]?\s+FORMA DE PAGO[ \t]*\r?\n([\s\S]{1,2500}?)\r?\n14[.)]?\s+APLICACI[OÓ]N DE MULTAS\b/i },
    { key: 'multas', explicit: adq.multas_texto, match: /(?:^|\n)14[.)]?\s+APLICACI[OÓ]N DE MULTAS[ \t]*\r?\n([^\r\n]+(?:\r?\n[^\r\n]+)*?)\s*$/i },
  ];
  for (const {key, explicit, match} of sections) {
    if (hasAdministrativeValue(explicit) || adq.selection_plan?.confirmedAt && adq.selection_plan.conditions?.[key] || adq.asistente_compra?.decisions?.[key] || draft.editedFields?.includes(key) || draft.confirmedFields?.includes(key)) continue;
    const { proposals, fields } = draft;
    if (hasAdministrativeValue(fields[key]) && proposals?.[key]?.value !== fields[key]) continue;
    const source = compact(reference.match(match)?.[1] || '');
    if (!hasAdministrativeValue(source) || source.length > 2500 || /P[áa]gina\s+\d|\.{4,}|\banexos?\s+\d/i.test(source)) continue;
    if (key === 'plazo' && adq.plazo_entrega_dias > 0 && Number(/\b(\d+)\s+d[ií]as?\b/i.exec(source)?.[1]) !== adq.plazo_entrega_dias) continue;
    if (key === 'multas') {
      // Restore the exact contractual wording only when it agrees with the
      // rate read from the dossier and that evidence is undisputed.
      if (!proposals?.multas?.reason.includes('antecedentes de este expediente')) continue;
      const rates = (value: string) => Array.from(value.matchAll(/(\d+(?:[.,]\d+)?)\s*%/g), m=>m[1].replace(',', '.')).join(' ');
      if (!rates(source) || rates(source) !== rates(fields.multas)) continue;
    }
    fields[key] = source;
    draft.proposals = {...proposals, [key]: {value: source, reason: 'Condición transcrita del TDR adjunto a este expediente.'}};
    draft.sourceIds = {...draft.sourceIds, [key]: []};
    draft.sourceQuotes = {...draft.sourceQuotes, [key]: []};
  }
}
