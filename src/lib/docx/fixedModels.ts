import catalogData from "../../../templates/ende/catalog.json";

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

// This revision changes presentation only; retain every field and manual edit in existing reports.
export function compatibleFixedDraft(number: number, draft?: FixedDraft): boolean {
  const version = fixedModel(number).version;
  return !!draft && (draft.modelVersion === version || (number === 6 && version === '2026-09-25.2' && draft.modelVersion === '2026-09-25.1'));
}
export function upgradeFixedDraft(number: number, draft: FixedDraft): FixedDraft {
  return compatibleFixedDraft(number, draft) ? {...draft, modelVersion: fixedModel(number).version} : draft;
}
