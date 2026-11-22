import type { Adquisicion } from '@/types';
import type { FixedDraft } from './fixedModels';
import { availablePurchaseBrief } from './purchaseBrief';
import { isInstitutionalRole } from './officialPeople';

export const hasAdministrativeValue = (value: unknown): value is string =>
  typeof value === 'string' && !!value.trim() && !/PENDIENTE|_{3,}/i.test(value);

// A previous version presented the date-coded expediente identifier as a request number.
export const isLegacyRequestNumber = (value: string) => /^(?:19|20)\d{6}\s*\/\s*\d{4}$/.test(value.trim());

export function registeredRequestNumber(adq: Adquisicion): string {
  return [adq.solicitud_numero, adq.borradores_ia?.['2']?.draft.fields.numero]
    .find((value): value is string => hasAdministrativeValue(value) && !isLegacyRequestNumber(value))?.trim() || '';
}

export function requestNumber(adq: Adquisicion): string {
  const existing = registeredRequestNumber(adq);
  if (existing) return existing;
  // Older dossiers with a short sequential code retain their historical display.
  const match = adq.codigo?.trim().match(/^ENDE-D-(\d{4})-(\d{1,6})$/i);
  return match && Number(match[2]) > 0 ? `${Number(match[2])}/${match[1]}` : '';
}

function applicantFromTdr(adq: Adquisicion) {
  const tdr=adq.borradores_ia?.['1']?.draft;
  const authored = [
    (!tdr?.companyId || tdr.companyId===(adq.empresa_id||'ende')) ? tdr?.fields.elaborado : undefined,
    adq.elaborado_por,
    adq.responsables_oficiales?.['1']?.elaborado,
  ].find(hasAdministrativeValue);
  if (!authored) return {};
  if (isInstitutionalRole(authored)) return {role: authored.replace(/^Cargo:\s*/i, '').trim()};
  const parts = /^(.+?)(?:\r?\n+|\s+[-–—]\s+)([\s\S]+)$/.exec(authored.trim());
  return {
    name: (parts?.[1] || authored).trim(),
    role: parts?.[2].trim() || adq.elaborado_cargo,
  };
}

export function administrativeDefaults(adq: Adquisicion): Record<string, string> {
  const people = adq.responsables_oficiales?.['2'] || {};
  const details = availablePurchaseBrief(adq)?.details || {};
  const s1=adq.borradores_ia?.['2']?.draft;
  const sameCompany=!s1?.companyId || s1.companyId===(adq.empresa_id||'ende');
  const previous = sameCompany && s1?.fields || {};
  const first = (...values: unknown[]) => values.find(hasAdministrativeValue)?.trim() || '';
  const applicant = applicantFromTdr(adq);
  const edited = sameCompany && s1?.editedFields || [];
  const solicitante = first(edited.includes('solicitante') ? previous.solicitante : '', applicant.name, previous.solicitante, people.solicitante, adq.responsable_proceso);
  return {
    numero: requestNumber(adq), solicitante,
    cargo: first(edited.includes('cargo') ? previous.cargo : '', applicant.role, previous.cargo, details.cargo, people.cargo, adq.elaborado_cargo),
    area: first(previous.area, people.area, adq.unidad_solicitante),
    responsable_recepcion: first(previous.responsable_recepcion, details.responsable_recepcion, people.responsable_recepcion),
  };
}

// Fill absent values only. A deliberate edit (including clearing a field) always wins.
export function fillAdministrativeBlanks(draft: FixedDraft, adq: Adquisicion, number: number): FixedDraft {
  if (number !== 2) return draft;
  const fields = {...draft.fields}, filled: string[] = [];
  const oldNumber = isLegacyRequestNumber(fields.numero || '');
  const copied = applicantFromTdr(adq);
  for (const [key, value] of Object.entries(administrativeDefaults(adq))) {
    const legacyNumber = key === 'numero' && oldNumber;
    const copyFromTdr = key === 'solicitante' ? !!copied.name : key === 'cargo' && !!copied.role;
    if (legacyNumber || (hasAdministrativeValue(value) && !draft.editedFields?.includes(key) &&
      (!hasAdministrativeValue(fields[key]) || copyFromTdr))) {
      fields[key] = value;
      if (hasAdministrativeValue(value)) filled.push(key);
    }
  }
  const retained = (draft.editedFields || []).filter(key => !(key === 'numero' && oldNumber && !fields.numero));
  return {...draft, fields, editedFields: Array.from(new Set([...retained, ...filled]))};
}
