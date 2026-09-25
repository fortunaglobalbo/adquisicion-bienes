import type { Adquisicion } from '@/types';
import type { FixedDraft } from './fixedModels';

export const hasAdministrativeValue = (value: unknown): value is string =>
  typeof value === 'string' && !!value.trim() && !/PENDIENTE|_{3,}/i.test(value);

export function requestNumber(adq: Adquisicion): string {
  const existing = adq.solicitud_numero || adq.borradores_ia?.['2']?.draft.fields.numero;
  if (hasAdministrativeValue(existing)) return existing.trim();
  const code = adq.codigo?.trim() || '';
  const match = code.match(/^ENDE-D-(\d{4})-(\d+)$/i);
  return match ? `${Number(match[2])}/${match[1]}` : code;
}

export function administrativeDefaults(adq: Adquisicion): Record<string, string> {
  const people = adq.responsables_oficiales?.['2'] || {};
  const details = adq.asistente_compra?.confirmedAt ? adq.asistente_compra.details : {};
  const previous = adq.borradores_ia?.['2']?.draft.fields || {};
  const first = (...values: unknown[]) => values.find(hasAdministrativeValue)?.trim() || '';
  const solicitante = first(previous.solicitante, people.solicitante, adq.responsable_proceso);
  return {
    numero: requestNumber(adq), solicitante,
    cargo: first(previous.cargo, details.cargo, people.cargo, adq.elaborado_cargo),
    area: first(previous.area, people.area, adq.unidad_solicitante),
    responsable_recepcion: first(previous.responsable_recepcion, details.responsable_recepcion, people.responsable_recepcion),
  };
}

// Fill absent values only. A deliberate edit (including clearing a field) always wins.
export function fillAdministrativeBlanks(draft: FixedDraft, adq: Adquisicion, number: number): FixedDraft {
  if (number !== 2) return draft;
  const fields = {...draft.fields}, filled: string[] = [];
  for (const [key, value] of Object.entries(administrativeDefaults(adq))) {
    if (hasAdministrativeValue(value) && !hasAdministrativeValue(fields[key]) && !draft.editedFields?.includes(key)) {
      fields[key] = value; filled.push(key);
    }
  }
  return {...draft, fields, editedFields: Array.from(new Set([...(draft.editedFields || []), ...filled]))};
}
