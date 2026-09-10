import fs from "fs/promises";
import path from "path";
import { createHash } from "crypto";
import { fixedModel, FixedDraft, FixedModel, missingValue } from "../docx/fixedModels";
import { inspectTemplate, fillTemplate, DocumentChange, TableChange } from "../docx/templateEditor";
import { AnythingLlmClient } from "../ai/anythingLlmClient";
import { callOpenCodeGo, extractJsonFromText } from "../ai/openCodeClient";
import { companyKnowledge } from "./companyKnowledge";
import type { Adquisicion } from "@/types";
import { extractDocumentEvidence, verifiedQuotes } from './documentEvidence';
import { fixedDocumentPrompt } from './fixedDocumentPrompt';

import { officialPeople } from "../docx/officialPeople";

const text = (value: unknown): string => typeof value === "string" ? value.trim() : "";
export function seedFixedDraft(number: number, adq: Adquisicion): FixedDraft {
  const model = fixedModel(number);
  companyKnowledge(adq.empresa_id || "ende");
  const people = officialPeople(number, adq.responsables_oficiales?.[number]);
  const values: Record<string, string> = {
    objeto: adq.titulo_proceso, solicitante: adq.responsable_proceso, area: adq.unidad_solicitante,
    lugar: adq.lugar_entrega, elaborado: adq.elaborado_por || "", revisado: adq.revisado_por || "", aprobado: adq.aprobado_por || "",
    antecedentes: adq.antecedentes_texto || "", justificacion: adq.justificacion_texto || "",
    plazo: adq.plazo_entrega_dias > 0 ? `${adq.plazo_entrega_dias} días calendario` : "",
    presupuesto: adq.prevision_presupuesto > 0 ? adq.prevision_presupuesto.toFixed(2) : "",
    ...(adq.asistente_compra?.confirmedAt ? adq.asistente_compra.details : {}),
    ...people,
  };
  // Receiving a new good is a fact to confirm; previous item quantities are not evidence of receipt.
  const items = number === 7 || !model.columns.length ? [] : (adq.items || []).map((item, i) => Object.fromEntries(model.columns.map(c => [c.key,
    ({ numero: String(i + 1), descripcion: item.descripcion, unidad: item.unidad,
      cantidad: item.cantidad > 0 ? String(item.cantidad) : missingValue,
      especificaciones: item.especificacionMinima || item.caracteristicasTecnicas || missingValue,
      precio: item.precioUnitarioEstimado > 0 ? String(item.precioUnitarioEstimado) : missingValue,
      precio_oferta: "", total_oferta: "" } as Record<string, string>)[c.key] ?? missingValue,
  ])));
  return { modelVersion: model.version, companyId: adq.empresa_id || "ende", fields: Object.fromEntries(model.fields.map(f => [f.key, f.normative ? missingValue : text(values[f.key]) || missingValue])),
    editedFields: Object.keys(people), items, sourceIds: {}, sources: [], warnings: [], consultedAt: null, normativeStatus: "pending" };
}

export function validateFixedDraft(model: FixedModel, draft: FixedDraft) {
  if (!draft || draft.modelVersion !== model.version || !draft.fields || !Array.isArray(draft.items)) throw Error("El borrador no corresponde a la versión actual del modelo.");
  companyKnowledge(draft.companyId);
  if (Object.keys(draft.fields).some(key => !model.fields.some(f => f.key === key))) throw Error("El documento contiene campos que no pertenecen al modelo.");
  if (model.fields.some(f => typeof draft.fields[f.key] !== "string" || draft.fields[f.key].length > 16000)) throw Error("Revisa los campos del documento: falta un valor o su texto es demasiado extenso.");
  if (draft.items.length > 100 || draft.items.some(row => !row || model.columns.some(c => typeof row[c.key] !== "string" || row[c.key].length > 5000) || Object.keys(row).some(k => !model.columns.some(c => c.key === k)))) throw Error("Revisa las columnas o la cantidad de ítems (máximo 100).");
  if (!model.columns.length && draft.items.length) throw Error("Este modelo no utiliza una tabla de ítems.");
}

export function normalizeFixedDraft(model: FixedModel, draft: FixedDraft): FixedDraft {
  validateFixedDraft(model, draft);
  const result: FixedDraft = { ...draft, fields: { ...draft.fields }, items: draft.items.map((r, i) => ({ ...r, numero: String(i + 1) })) };
  if (model.number === 3) {
    // Monetary inputs use a single decimal separator; never guess ambiguous thousands separators.
    const decimal = (s: string) => /^\d+(?:[.,]\d{1,2})?$/.test(s.trim()) ? Number(s.replace(",", ".")) : NaN;
    const totals = result.items.map(r => decimal(r.cantidad) * decimal(r.precio));
    result.fields.presupuesto = totals.length && totals.every(Number.isFinite) ? (totals.reduce((sum, n) => sum + Math.round(n * 100), 0) / 100).toFixed(2) : missingValue;
  }
  return result;
}

export async function renderFixedWord(number: number, input: FixedDraft) {
  const model = fixedModel(number), draft = normalizeFixedDraft(model, input);
  const buffer = await fs.readFile(path.join(process.cwd(), "templates", "ende", model.file));
  if (createHash("sha256").update(buffer).digest("hex") !== model.sha256) throw Error("El modelo cambió sin registrar una nueva versión.");
  const structure = await inspectTemplate(buffer);
  const changes: DocumentChange[] = [];
  const tables: TableChange[] = [];
  const itemTable = structure.tables.find(t => t.rows.some(row => row.some(cell => cell.includes("{{items."))));
  const excluded = new Set(itemTable?.paragraphIds || []);
  for (const p of structure.paragraphs) {
    if (excluded.has(p.id) || !/\{\{[a-z_]+\}\}/.test(p.text)) continue;
    const marks:Record<string,string> = {};
    for (const [key,yes,no] of [['almacen','con saldo','sin saldo'],['publicar_precio','si','no'],['con_presupuesto','si','no']]) {
      const value=(draft.fields[key] || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
      marks[`${key}_si`]=value===yes?'☒':'☐';marks[`${key}_no`]=value===no?'☒':'☐';
    }
    const display=(key:string)=>marks[key] || (draft.fields[key] && !/^\[PENDIENTE[^\]]*\]$/.test(draft.fields[key]) ? draft.fields[key] : number===2 ? '\u00a0' : '________________');
    changes.push({ target: p.id, label: "Campo fijo", value: p.text.replace(/\{\{([a-z_]+)\}\}/g, (_m, key) => display(key)), sourceIds: [] });
  }
  if (itemTable) {
    const rows = draft.items.length ? draft.items : [Object.fromEntries(model.columns.map(c => [c.key, c.key.endsWith("oferta") ? "" : missingValue]))];
    tables.push({ target: itemTable.id, label: "Ítems", rows: rows.map(r => model.columns.map(c => /^\[PENDIENTE[^\]]*\]$/.test(r[c.key] || '') ? '________' : r[c.key] || '')) });
  }
  return { buffer: await fillTemplate(buffer, changes, tables), draft };
}

export async function completeFixedDocument(number: number, adq: Adquisicion, current: FixedDraft, context: string, images: string[] = []) {
  const company = companyKnowledge(adq.empresa_id || "ende"), model = fixedModel(number);
  validateFixedDraft(model, current);
  if (current.companyId !== company.id) throw Error("El borrador corresponde a otra empresa.");
  const session = `ende-document-${createHash('sha256').update(`${company.id}:${adq.id}:${number}`).digest('hex').slice(0,32)}`;
  const hasNormativeFields=model.fields.some(f=>f.normative);
  let sources: FixedDraft["sources"] = [], answer = "", status: FixedDraft["normativeStatus"] = hasNormativeFields ? "unavailable" : "not_applicable", partialSearch = false;
  if(hasNormativeFields) try {
    const queries: Record<string,string> = {calidad:'Especificaciones técnicas características fundamentales capacidad calidad rendimiento requisitos normalizados',seleccion:'MÉTODOS DE SELECCIÓN Menor precio cumplimiento requisitos mínimos',vigencia:'validez vigencia propuesta oferta plazo presentación',categoria:'CATEGORÍAS Y SUS CUANTÍAS nivel materialidad',adjudicacion:'ADJUDICACIÓN POR ITEMS LOTES TRAMOS PAQUETES',aceptacion:'recepción bienes verificación parcial total actas disconformidad',pago:'forma de pago moneda documento contractual',multas:'APLICACIÓN DE MULTAS incumplimiento plazos documento contractual',garantias:'GARANTÍAS SEGÚN EL OBJETO bienes cumplimiento contrato'};
    const groups = model.fields.filter(f=>f.normative).map(f=>queries[f.key]||f.label);
    const results = await Promise.allSettled(groups.map(topic=>AnythingLlmClient.searchWorkspaceSources(
      topic, company.workspace, 3)));
    partialSearch = results.some(r=>r.status==='rejected');
    const seen = new Set<string>(); let characters = 0;
    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      for (const source of result.value.sources) {
        const signature = `${source.title}:${source.excerpt}`;
        if (seen.has(signature) || characters + source.excerpt.length > 28000 || sources.length >= 24) continue;
        seen.add(signature); characters += source.excerpt.length;
        sources.push({...source,id:`fuente-${sources.length+1}`});
      }
    }
    answer = "Fragmentos recuperados por temas. Evalúa su aplicabilidad y excepciones; no son una respuesta normativa validada.";
    status = sources.length ? "sources_found" : results.every(r=>r.status==='rejected') ? "unavailable" : "no_sources";
  } catch { /* Preserve the data; missing regulatory evidence remains visible. */ }
  const brief = adq.asistente_compra?.confirmedAt ? adq.asistente_compra : null;
  const evidence = brief && !context.trim() && !images.length
    ? { facts: brief.facts, missing: [], conflicts: brief.clarification ? [] : brief.conflicts }
    : await extractDocumentEvidence({expediente:adq,antecedentes:context,borrador:{fields:current.fields,items:current.items}},images,`${session}-extract`);
  const { borradores_ia: _prepared, asistente_compra: _brief, ...purchase } = adq;
  const raw = await callOpenCodeGo([
    { role: "system", content: fixedDocumentPrompt(company.name) },
    { role: "user", content: [{ type: "text", text: JSON.stringify({ model: { number, fields: model.fields, columns: model.columns }, expediente: purchase, fichaConfirmada:brief, tdrCompartido:number!==1?{fields:adq.borradores_ia?.['1']?.draft.fields,items:adq.borradores_ia?.['1']?.draft.items}:undefined, evidence, current: { fields: current.fields, items: current.items }, context,
      imageInstructions: "Las imágenes adjuntas son antecedentes de esta compra, no normas. Lee sus datos visibles. Si algo es ilegible o contradice los datos actuales, déjalo pendiente y explica la discrepancia. No copies firmas ni supongas aprobación.",
      normativeAnswer: sources.length ? answer : "Sin fuentes recuperadas", sources }) }, ...images.map(url => ({ type: "image_url" as const, image_url: { url } }))] },
  ], 0.1, 16000, 85000, session, {strict:true,disableThinking:true});
  if (!raw) throw Error("OpenCode GO devolvió una respuesta vacía. Vuelve a intentar; el borrador se conserva.");
  const result = extractJsonFromText(raw);
  if (!result || typeof result.fields !== "object" || !result.fields || Array.isArray(result.fields)) throw Error("La IA no entregó un documento válido. El borrador anterior se conserva.");
  // Some GO responses omit the table when the confirmed brief already supplies it.
  // Reuse those confirmed rows; never infer a receipt or accept a malformed table object.
  if(result.items===undefined && (!model.columns.length || (brief && [1,3,6].includes(number)))) result.items=[];
  if(!Array.isArray(result.items)) throw Error('La IA no entregó una tabla válida. El borrador anterior se conserva.');
  const validIds = new Set(sources.map(s => s.id));
  const decisionKeys = ['seleccion','vigencia','adjudicacion','pago'];
  const decisions = brief?.decisions || {};
  const proposals: NonNullable<FixedDraft['proposals']> = {};
  const sourceIds: Record<string, string[]> = {};
  const sourceQuotes: Record<string,{sourceId:string;quote:string}[]> = {};
  const reviewWarnings: string[] = [...evidence.conflicts];
  const fields = Object.fromEntries(model.fields.map(f => {
    sourceIds[f.key] = Array.isArray(result.sourceIds?.[f.key]) ? result.sourceIds[f.key].filter((id: unknown) => typeof id === "string" && validIds.has(id)) : [];
    const value = text(result.fields[f.key]).replace(/\s*\(\s*fuente-\d+(?:\s*[,;]\s*fuente-\d+)*\s*\)/gi, "");
    if(f.normative){
      sourceQuotes[f.key]=verifiedQuotes(value,sourceIds[f.key],result.sourceQuotes?.[f.key],sources);
      sourceIds[f.key]=Array.from(new Set(sourceQuotes[f.key].map(q=>q.sourceId)));
      if(value && !/PENDIENTE/.test(value) && !sourceIds[f.key].length) reviewWarnings.push(`${f.label}: el texto propuesto no tiene un extracto verificable suficiente; se dejó pendiente.`);
    }
    if(decisionKeys.includes(f.key) && text(result.proposals?.[f.key]?.value) && !decisions[f.key]) proposals[f.key]={value:text(result.proposals[f.key].value).slice(0,4000),reason:text(result.proposals[f.key].reason).slice(0,1500)};
    if(f.key==='categoria' && [1,2].includes(number) && !/categor[ií]a\s+(?:I{1,3}|especial)\b/i.test(value)) return [f.key,missingValue];
    return [f.key, decisionKeys.includes(f.key) && decisions[f.key] ? decisions[f.key] : f.normative && !sourceIds[f.key].length ? missingValue : value || missingValue];
  }));
  let items: Record<string,string>[] = model.columns.length ? result.items.map((r: Record<string, unknown>) => Object.fromEntries(model.columns.map(c => [c.key, c.key.endsWith('oferta') ? '' : text(r?.[c.key]) || missingValue]))) : [];
  if (brief && [1,3,6].includes(number)) items = brief.items.map((item,i)=>Object.fromEntries(model.columns.map(c=>[c.key, ({numero:String(i+1),descripcion:item.descripcion,cantidad:item.cantidad,unidad:item.unidad,especificaciones:item.especificaciones,precio:item.precio,precio_oferta:'',total_oferta:''} as Record<string,string>)[c.key] || text(items[i]?.[c.key]) || (c.key.endsWith('oferta')?'':missingValue)])));
  if(brief){
    for(const [key,value] of Object.entries({...brief.details,lugar:brief.location,plazo:brief.deliveryDays?`${brief.deliveryDays} días calendario`:''})) if(value && model.fields.some(f=>f.key===key&&!f.normative)) fields[key]=value;
  }
  // User-authored paragraphs remain editable and survive subsequent automatic completion.
  for(const key of current.editedFields || []) if(model.fields.some(f=>f.key===key)) {
    fields[key]=current.fields[key];sourceIds[key]=[];sourceQuotes[key]=[];
  }
  const warnings: string[] = Array.isArray(result.warnings) ? result.warnings.filter((w: unknown) => typeof w === "string").slice(0, 30) : [];
  warnings.unshift(...reviewWarnings);
  if (hasNormativeFields && !sources.length) warnings.unshift("No se recuperó fundamento normativo. Requiere revisión antes de su uso oficial.");
  if (partialSearch && sources.length) warnings.unshift("Parte de las búsquedas no respondió. El fundamento recuperado puede estar incompleto.");
  if(sources.length) warnings.push("Las fuentes recuperadas son propuestas de fundamento; revisa su aplicabilidad y vigencia antes de firmar.");
  return normalizeFixedDraft(model, { companyId: company.id, modelVersion: model.version, fields, items: current.editedItems ? current.items : items, editedItems: current.editedItems, sources, sourceIds, sourceQuotes, proposals, warnings, editedFields:current.editedFields || [], consultedAt: new Date().toISOString(), normativeStatus: status });
}
