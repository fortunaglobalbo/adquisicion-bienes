import catalogData from "../../../templates/ende/catalog.json";
import type { Documento } from "@/types";

export interface FixedField { key: string; label: string; normative: boolean; hint: string }
export interface FixedModel { number: number; title: string; file: string; version: string; sha256: string; fields: FixedField[]; columns: { key: string; label: string }[]; source: string }
export const FIXED_MODELS = catalogData as FixedModel[];
export function fixedModel(number: number): FixedModel {
  const model = FIXED_MODELS.find(m => m.number === number);
  if (!model) throw Error("No hay un modelo Word fijo registrado para esta carpeta.");
  return model;
}
export interface FixedSource { id: string; title: string; excerpt: string; page: string; version: string }
export interface FixedDraft {
  evaluationRevision?: string;
  comparativeSnapshot?: string;
  selectionPlan?: import('../procurement/selection').SelectionPlan;
  confirmedFields?: string[];
  modelVersion: string;
  companyId: string;
  fields: Record<string, string>;
  items: Record<string, string>[];
  sourceIds: Record<string, string[]>;
  sourceQuotes?: Record<string,{sourceId:string;quote:string}[]>;
  sources: FixedSource[];
  warnings: string[];
  consultedAt: string | null;
  normativeStatus: "pending" | "sources_found" | "no_sources" | "unavailable" | "not_applicable";
  editedFields?: string[];
  editedItems?: boolean;
  proposals?: Record<string,{value:string;reason:string}>;
}
export const missingValue = "[PENDIENTE]";
export const tdrComplianceOptions = "☐ Cumple\n☐ No cumple";

export function newFixedItem(model: FixedModel, index: number | null, emptyValue = ''): Record<string, string> {
  return Object.fromEntries(model.columns.map(({key}) => {
    if (key === 'numero' && index !== null) return [key, String(index + 1)];
    if (key === 'cumplimiento') return [key, tdrComplianceOptions];
    return [key, key.endsWith('oferta') ? '' : emptyValue];
  }));
}

// This revision changes presentation only; retain every field and manual edit in existing reports.
export function compatibleFixedDraft(number: number, draft?: FixedDraft): boolean {
  const version = fixedModel(number).version;
  return !!draft && (draft.modelVersion === version
    || (number === 1 && version === '2026-11-21.1' && draft.modelVersion === '2026-09-10.1')
    || (number === 6 && version === '2026-09-25.2' && draft.modelVersion === '2026-09-25.1')
    || (number === 7 && version === '2026-11-22.2' && draft.modelVersion === '2026-09-10.1')
    || (number === 8 && version === '2026-11-22.2' && draft.modelVersion === '2026-11-22.1'));
}
export function fixedDocumentBelongsToModel(number: number, document: Documento): boolean {
  const modelNumber = document.metadata?.fixedModelNumber;
  return Number.isInteger(modelNumber) ? modelNumber === number : compatibleFixedDraft(number, document.metadata?.fixedDraft);
}
export function upgradeFixedDraft(number: number, draft: FixedDraft): FixedDraft {
  if (!compatibleFixedDraft(number, draft)) return draft;
  const upgraded = {...draft, modelVersion: fixedModel(number).version};
  if (number === 1 && Array.isArray(upgraded.items)) {
    upgraded.items = upgraded.items.map(row => row && (row.cumplimiento === undefined || row.cumplimiento === '' || row.cumplimiento === missingValue)
      ? {...row, cumplimiento: tdrComplianceOptions} : row);
  }
  return upgraded;
}
