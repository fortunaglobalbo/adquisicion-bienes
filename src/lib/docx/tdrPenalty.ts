import type { Adquisicion } from '@/types';
import { maintenanceConditions } from '../procurement/selection';
import { availablePurchaseBrief } from './purchaseBrief';
import type { FixedDraft } from './fixedModels';

const previousDraftClause = 'En caso de retraso injustificado u otro incumplimiento, se aplicarán las multas expresamente establecidas en el documento contractual. Su porcentaje, base de cálculo y condiciones deberán definirse y revisarse antes de formalizar la contratación.';
export const contractualPenaltyClause = 'Ante el incumplimiento de los plazos u otras condiciones establecidas para la provisión, se aplicarán las multas debidamente especificadas en el documento contractual. La tasa, base de cálculo y condiciones de aplicación deberán establecerse en dicho documento.';

function isAutomaticPlaceholder(value: string) {
  const clause = value.trim().replace(/\s+/g, ' ');
  return !clause || /^\[PENDIENTE[^\]]*\]$|^[_–—\s]+$/i.test(clause)
    || clause === previousDraftClause || clause === contractualPenaltyClause;
}

export function tdrPenaltyProposal(adq: Adquisicion): { value: string; reason: string } | undefined {
  const registeredRate = Number.isFinite(adq.multa_diaria_porcentaje) && adq.multa_diaria_porcentaje > 0
    ? adq.multa_diaria_porcentaje : undefined;
  const brief = availablePurchaseBrief(adq);
  const penaltyTopic = /\b(?:multas?|penalidad(?:es)?|penalizaci[oó]n)\b/i;
  const relevantFacts = (brief?.facts || []).filter(f => penaltyTopic.test(f.topic)
    && ['antecedente', 'imagen', 'expediente'].includes(f.origin));
  const conditions = Array.from(new Set(relevantFacts.map(f => f.value.trim().replace(/\s+/g, ' '))));
  const documented = conditions[0] || '';
  const rates = Array.from(documented.matchAll(/(\d+(?:[.,]\d+)?)\s*%/g), m => Number(m[1].replace(',', '.')));
  const exemption = /\b(?:sin multas?|exent[ao] de multas?|no (?:se )?aplica(?:n|r[áa]n?)?\b.{0,15}\bmultas?)\b/i.test(documented);
  const conflict = conditions.length > 1 || !!brief?.conflicts?.some(message => penaltyTopic.test(message))
    || !!registeredRate && (exemption || rates.length > 0 && !rates.includes(registeredRate));
  if (!conflict && (rates.length || exemption)) {
    return {
      value: /^\d/.test(documented) ? `Se aplicará una multa del ${documented}` : documented,
      reason: 'Condición propuesta de acuerdo con los antecedentes de este expediente. El reglamento V04 no fija esta tasa.',
    };
  }
  const maintenance = adq.categoria === 'Servicios' && (adq.selection_plan
    ? adq.selection_plan.profile === 'mantenimiento_higiene'
    : /mantenimiento|higiene|limpieza/i.test(adq.titulo_proceso));
  if (!conflict && maintenance && (!registeredRate || registeredRate === 0.25)) {
    return {
      value: maintenanceConditions.multas,
      reason: 'Condición propuesta a partir del modelo de servicios de mantenimiento e higiene industrial. El reglamento V04 no fija esta tasa.',
    };
  }
  if (adq.categoria !== 'Bienes' && !registeredRate) return;
  const goods = adq.categoria === 'Bienes';
  const period = goods ? 'el plazo de entrega establecido en la Orden de Compra y las Especificaciones Técnicas' : 'el plazo establecido en el documento contractual';
  return {
    value: `En caso de incumplimiento de ${period}, ${goods && !conflict ? 'se aplicará' : 'se propone'} una multa del ${registeredRate ?? 0.25}% por cada día de retraso injustificado.`,
    reason: (registeredRate ? 'Porcentaje diario registrado en el expediente. El reglamento V04 no fija esta tasa.'
      : 'Porcentaje diario propuesto conforme al TDR de botines de seguridad facilitado como modelo de bienes. El reglamento V04 no fija esta tasa.')
      + (conflict ? ' Los antecedentes contienen condiciones de multa diferentes. Revisa la propuesta antes de emitir el documento.' : ''),
  };
}

export function completeTdrPenalty(draft: FixedDraft, adq: Adquisicion): FixedDraft {
  if (!('multas' in draft.fields) || draft.editedFields?.includes('multas') || draft.confirmedFields?.includes('multas')
    || !isAutomaticPlaceholder(draft.fields.multas)) return draft;
  const explicit = [
    adq.selection_plan?.confirmedAt ? adq.selection_plan.conditions.multas : undefined,
    adq.asistente_compra?.decisions?.multas, adq.multas_texto,
  ].find((value): value is string => !!value && !isAutomaticPlaceholder(value));
  const proposal = explicit ? undefined : tdrPenaltyProposal(adq);
  const value = explicit || proposal?.value || contractualPenaltyClause;
  if (value === draft.fields.multas) return draft;
  const proposals = { ...draft.proposals };
  if (proposal) proposals.multas = proposal;
  else delete proposals.multas;
  return {
    ...draft, fields: { ...draft.fields, multas: value }, proposals,
    confirmedFields: explicit ? Array.from(new Set([...(draft.confirmedFields || []), 'multas'])) : draft.confirmedFields,
    sourceIds: { ...draft.sourceIds, multas: [] }, sourceQuotes: { ...draft.sourceQuotes, multas: [] },
  };
}
