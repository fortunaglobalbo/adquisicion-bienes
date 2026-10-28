import fs from "fs/promises";
import path from "path";
import { createHash } from "crypto";
import { fixedModel, FixedDraft, FixedModel, missingValue, upgradeFixedDraft } from "../docx/fixedModels";
import { inspectTemplate, fillTemplate, DocumentChange, TableChange } from "../docx/templateEditor";
import { AnythingLlmClient } from "../ai/anythingLlmClient";
import { callOpenCodeGo } from "../ai/openCodeClient";
import { parseFixedDocumentResponse } from './fixedDocumentResponse';
import { companyKnowledge } from "./companyKnowledge";
import type { Adquisicion } from "@/types";
import { extractDocumentEvidence, verifiedQuotes } from './documentEvidence';
import { fixedDocumentPrompt } from './fixedDocumentPrompt';

import { officialPeople } from "../docx/officialPeople";
import { applySelection, assertPlan } from '../procurement/selection';
import { addSelectionTables } from './selectionWord';
import { administrativeDefaults, fillAdministrativeBlanks } from '../docx/administrativeDefaults';
import { technicalEvaluationData } from './technicalEvaluation';
import { comparativeReportData, updateComparativeReport } from './comparativeReport';
import { comparativeSnapshot } from '../procurement/comparativeReport';
import { availablePurchaseBrief, obsoletePurchaseMentions, suggestedCurrentPurpose, isProtectiveEquipment, PurchaseBrief } from '../docx/purchaseBrief';
import { currentPurchaseTitle, repairAutomaticPurchaseTitle } from '../docx/purchaseTitle';
import referenceV04 from '../../../templates/ende/normative-v04.json';
import { keepTdrHeadingsWithBody } from './wordPagination';

const text = (value: unknown): string => typeof value === "string" ? value.trim() : "";
const amountCategory = (value:unknown) => /^(?:categor[ií]a\s+)?(?:I{1,3}|especial)\b/i.test(text(value)) ? text(value) : '';
export function seedFixedDraft(number: number, adq: Adquisicion): FixedDraft {
  const model = fixedModel(number);
  companyKnowledge(adq.empresa_id || "ende");
  const people = officialPeople(number, adq.responsables_oficiales?.[number]);
  const values: Record<string, string> = {
    objeto: adq.titulo_proceso, solicitante: adq.responsable_proceso, area: adq.unidad_solicitante,
    lugar: adq.lugar_entrega,
    elaborado: adq.elaborado_por || (number === 1 ? "Ing. Tatiana Torres Andrade - Supervisor de Seguridad Industrial" : ""),
    revisado: adq.revisado_por || (number === 1 ? "Lic. Raul Torrico Gomez - Área Administrativa / Financiera" : ""),
    aprobado: adq.aprobado_por || (number === 1 ? "Lic. Raul Torrico Gomez - Gerencia / Unidades Administrativas" : ""),
    antecedentes: adq.antecedentes_texto || "", justificacion: adq.justificacion_texto || "",
    plazo: adq.plazo_entrega_dias > 0 ? `${adq.plazo_entrega_dias} días calendario` : "",
    presupuesto: adq.prevision_presupuesto > 0 ? adq.prevision_presupuesto.toFixed(2) : "",
    calidad: adq.calidad_texto || "",
    seleccion: adq.metodo_seleccion_texto || "",
    vigencia: adq.vigencia_propuesta_texto || "",
    categoria: number===1 ? adq.categoria_texto || (adq.categoria === "Bienes" ? "Bienes y Herramientas" : adq.categoria || "Bienes y Herramientas") : number===2 ? amountCategory(adq.asistente_compra?.decisions?.categoria_s1) || amountCategory(adq.asistente_compra?.decisions?.categoria) : '',
    pago: adq.forma_pago_texto || "",
    multas: adq.multas_texto || "",
    ...(availablePurchaseBrief(adq)?.details || {}),
    ...people,
    ...(number === 2 ? administrativeDefaults(adq) : {}),
    ...(number === 6 ? technicalEvaluationData(adq).fields : {}),
    ...(number === 3 ? comparativeReportData(adq).fields : {}),
    ...(number === 1 ? {objeto:currentPurchaseTitle({title:adq.titulo_proceso,category:adq.categoria,items:availablePurchaseBrief(adq)?.items||adq.items||[]})} : {}),
  };
  // Receiving a new good is a fact to confirm; previous item quantities are not evidence of receipt.
  const items = number === 3 ? comparativeReportData(adq).items : number === 6 ? technicalEvaluationData(adq).items : number === 7 || !model.columns.length ? [] : (adq.items || []).map((item, i) => Object.fromEntries(model.columns.map(c => [c.key,
    ({ numero: String(i + 1), descripcion: item.descripcion, unidad: item.unidad,
      cantidad: item.cantidad > 0 ? String(item.cantidad) : missingValue,
      especificaciones: item.especificacionMinima || item.caracteristicasTecnicas || missingValue,
      precio: item.precioUnitarioEstimado > 0 ? String(item.precioUnitarioEstimado) : missingValue,
      precio_oferta: "", total_oferta: "" } as Record<string, string>)[c.key] ?? missingValue,
  ])));
  const confirmedNorms = model.fields.filter(f => f.normative && text(values[f.key]) && text(values[f.key]) !== missingValue).map(f => f.key);
  const draft:FixedDraft = { modelVersion: model.version, companyId: adq.empresa_id || "ende", fields: Object.fromEntries(model.fields.map(f => [f.key, text(values[f.key]) || missingValue])),
    confirmedFields: confirmedNorms,
    editedFields: Object.keys(people), items, sourceIds: {}, sources: [], warnings: [], consultedAt: null, normativeStatus: "pending" };
  const prepared = fillAdministrativeBlanks(draft,adq,number);
  if(number===2) prepared.editedFields=Array.from(new Set([...(prepared.editedFields||[]),...Object.keys(administrativeDefaults(adq)).filter(k=>values[k]&&values[k]!==missingValue)]));
  if(number===6){const data=technicalEvaluationData(adq);prepared.evaluationRevision=data.revision;prepared.warnings=data.warnings;prepared.editedFields=Array.from(new Set([...(prepared.editedFields||[]),...['fecha','numero','solicitud','destinatario','via','solicitante'].filter(k=>values[k]&&values[k]!==missingValue)]));}
  if(number===3){const data=comparativeReportData(adq);prepared.evaluationRevision=data.revision;prepared.comparativeSnapshot=comparativeSnapshot(adq);prepared.warnings=data.warnings;prepared.normativeStatus='not_applicable';}
  return adq.selection_plan?.confirmedAt ? applySelection(prepared,adq.selection_plan,number) : prepared;
}

export function validateFixedDraft(model: FixedModel, draft: FixedDraft) {
  if (!draft || draft.modelVersion !== model.version || !draft.fields || !Array.isArray(draft.items)) throw Error("El borrador no corresponde a la versión actual del modelo.");
  companyKnowledge(draft.companyId);
  if(draft.selectionPlan) {
    assertPlan(draft.selectionPlan,draft.selectionPlan.method==='calidad_precio');
    if(model.number===1 && draft.fields.seleccion) {
      draft.selectionPlan.method = /calidad\s+y\s+precio/i.test(draft.fields.seleccion) ? 'calidad_precio' : 'menor_precio';
    }
  }
  if (Object.keys(draft.fields).some(key => !model.fields.some(f => f.key === key))) throw Error("El documento contiene campos que no pertenecen al modelo.");
  if (model.fields.some(f => typeof draft.fields[f.key] !== "string" || draft.fields[f.key].length > 16000)) throw Error("Revisa los campos del documento: falta un valor o su texto es demasiado extenso.");
  if (draft.items.length > 100 || draft.items.some(row => !row || model.columns.some(c => typeof row[c.key] !== "string" || row[c.key].length > 5000) || Object.keys(row).some(k => !model.columns.some(c => c.key === k)))) throw Error("Revisa las columnas o la cantidad de ítems (máximo 100).");
  if (!model.columns.length && draft.items.length) throw Error("Este modelo no utiliza una tabla de ítems.");
}

export function normalizeFixedDraft(model: FixedModel, draft: FixedDraft, adq?: Adquisicion): FixedDraft {
  draft = upgradeFixedDraft(model.number, draft);
  validateFixedDraft(model, draft);
  const result: FixedDraft = { ...draft, fields: { ...draft.fields }, items: draft.items.map((r, i) => ({ ...r, numero: String(i + 1) })) };
  if(model.number===1)result.fields.objeto=repairAutomaticPurchaseTitle(result.fields.objeto,{title:adq?.titulo_proceso||result.fields.objeto,category:adq?.categoria,items:result.items.length?result.items.map(item=>({descripcion:item.descripcion||''})):adq?.items||[]},result.editedFields?.includes('objeto'));
  return result;
}

export async function renderFixedWord(number: number, input: FixedDraft, adq?: Adquisicion) {
  const model = fixedModel(number), draft = normalizeFixedDraft(model, input, adq);
  const buffer = await fs.readFile(path.join(process.cwd(), "templates", "ende", model.file));
  if (createHash("sha256").update(buffer).digest("hex") !== model.sha256) throw Error("El modelo cambió sin registrar una nueva versión.");
  const structure = await inspectTemplate(buffer);
  const changes: DocumentChange[] = [];
  const tables: TableChange[] = [];
  const referenceFields: Record<string,string> = {};
  if([3,6].includes(number)) for(const key of ['destinatario','via','solicitante']) {
    const [name,...role] = (draft.fields[key] || '').split(/\r?\n/);
    referenceFields[`${key}_nombre`] = name;
    referenceFields[`${key}_cargo`] = role.join('\n');
  }
  const itemTable = structure.tables.find(t => t.rows.some(row => row.some(cell => cell.includes("{{items."))));
  const excluded = new Set(itemTable?.paragraphIds || []);
  for (const p of structure.paragraphs) {
    if (excluded.has(p.id) || !/\{\{[a-z_]+\}\}/.test(p.text)) continue;
    const marks:Record<string,string> = {};
    for (const [key,yes,no] of [['almacen','con saldo','sin saldo'],['publicar_precio','si','no'],['con_presupuesto','si','no']]) {
      const value=(draft.fields[key] || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
      marks[`${key}_si`]=value===yes?'☒':'☐';marks[`${key}_no`]=value===no?'☒':'☐';
    }
    const display=(key:string)=>{
      const value=referenceFields[key] ?? draft.fields[key];
      return marks[key] || (value && !/^\[PENDIENTE[^\]]*\]$/.test(value) ? value : number===2 || key.endsWith('_cargo') ? '\u00a0' : '________________');
    };
    changes.push({ target: p.id, label: "Campo fijo", value: p.text.replace(/\{\{([a-z_]+)\}\}/g, (_m, key) => display(key)), sourceIds: [] });
  }
  if (itemTable) {
    const rows = draft.items.length ? draft.items : [Object.fromEntries(model.columns.map(c => [c.key, c.key.endsWith("oferta") ? "" : missingValue]))];
    tables.push({ target: itemTable.id, label: "Ítems", rows: rows.map(r => model.columns.map(c => /^\[PENDIENTE[^\]]*\]$/.test(r[c.key] || '') ? '________' : r[c.key] || '')) });
  }
  const filled=await fillTemplate(buffer, changes, tables);
  const paginated=number===1?await keepTdrHeadingsWithBody(filled):filled;
  return { buffer: number===1&&draft.selectionPlan ? await addSelectionTables(paginated,draft.selectionPlan) : paginated, draft };
}

export async function completeFixedDocument(number: number, adq: Adquisicion, current: FixedDraft, context: string, images: string[] = []) {
  current = upgradeFixedDraft(number, current);
  const company = companyKnowledge(adq.empresa_id || "ende"), model = fixedModel(number);
  validateFixedDraft(model, current);
  if (current.companyId !== company.id) throw Error("El borrador corresponde a otra empresa.");
  if(number===3)return normalizeFixedDraft(model,updateComparativeReport(current,adq));
  const session = `ende-document-${createHash('sha256').update(`${company.id}:${adq.id}:${number}`).digest('hex').slice(0,32)}`;
  const hasNormativeFields=model.fields.some(f=>f.normative);
  let sources: FixedDraft["sources"] = [], answer = "", status: FixedDraft["normativeStatus"] = hasNormativeFields ? "unavailable" : "not_applicable", partialSearch = false;
  // The user selected this exact V04 PDF. Keep audited literal excerpts available even if
  // the workspace is temporarily offline; never present its adoption by Deoruro as verified.
  const referenceKeys = new Set(model.fields.filter(f=>f.normative).map(f=>f.key));
  if(number===1) for(const key of ['marcas','plazo','prevision'])referenceKeys.add(key);
  const referenceSources = hasNormativeFields ? referenceV04.sources.filter(s=>referenceKeys.has(s.key)) : [];
  sources = referenceSources.map((s,i)=>({id:`fuente-${i+1}`,title:`${referenceV04.sourceFile} — ${s.title}`,excerpt:s.excerpt,page:String(s.page),version:s.version}));
  if(sources.length)status='sources_found';
  if(hasNormativeFields) try {
    const queries: Record<string,string> = {calidad:'Especificaciones técnicas características fundamentales capacidad calidad rendimiento requisitos normalizados',seleccion:'MÉTODOS DE SELECCIÓN Menor precio cumplimiento requisitos mínimos',vigencia:'validez vigencia propuesta oferta plazo presentación',categoria:'CATEGORÍAS Y SUS CUANTÍAS nivel materialidad',adjudicacion:'ADJUDICACIÓN POR ITEMS LOTES TRAMOS PAQUETES',aceptacion:'recepción bienes verificación parcial total actas disconformidad',pago:'forma de pago moneda documento contractual',multas:'APLICACIÓN DE MULTAS incumplimiento plazos documento contractual',garantias:'GARANTÍAS SEGÚN EL OBJETO bienes cumplimiento contrato'};
    if((current.selectionPlan||adq.selection_plan)?.method==='calidad_precio')queries.seleccion='Método Calidad y Precio requisitos mínimos adicionales ERA previsión de precio PvP ponderaciones';
    const groups = model.fields.filter(f=>f.normative && !current.confirmedFields?.includes(f.key)).map(f=>queries[f.key]||f.label);
    const results = await Promise.allSettled(groups.map(topic=>AnythingLlmClient.searchWorkspaceSources(
      topic, company.workspace, 3)));
    partialSearch = results.some(r=>r.status==='rejected');
    const seen = new Set(sources.map(s=>`${s.title}:${s.excerpt}`)); let characters = sources.reduce((sum,s)=>sum+s.excerpt.length,0);
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
    status = sources.length ? "sources_found" : results.length && results.every(r=>r.status==='rejected') ? "unavailable" : "no_sources";
  } catch { /* Preserve the data; missing regulatory evidence remains visible. */ }
  const availableBrief = availablePurchaseBrief(adq);
  const previousProducts = [...current.items.map(i=>({descripcion:i.descripcion || ''})),...(adq.items || []),{descripcion:adq.titulo_proceso}];
  const staleMention = (value:string) => !!availableBrief && obsoletePurchaseMentions(value,previousProducts,availableBrief.items).length>0;
  // A previously prepared automatic purpose may already contain the old title. Correct the
  // writing context without changing the saved acquisition or a user's document edits.
  const brief = availableBrief && staleMention(availableBrief.purpose)
    ? {...availableBrief,purpose:suggestedCurrentPurpose(availableBrief.items,adq.unidad_solicitante),scopeChanged:true}
    : availableBrief;
  const narrative = brief ? currentPurchaseNarrative(company.name,adq,brief,number) : null;
  const contextFields = Object.fromEntries(Object.entries(current.fields).map(([key,value])=>[key,
    !current.editedFields?.includes(key) && (staleMention(value) || (number===1&&['antecedentes','justificacion'].includes(key))) ? missingValue : value]));
  const { borradores_ia: _prepared, asistente_compra: _brief, ...storedPurchase } = adq;
  const purchase = brief ? {...storedPurchase,
    titulo_proceso:staleMention(adq.titulo_proceso)?narrative!.objeto:adq.titulo_proceso,
    antecedentes_texto:'',justificacion_texto:brief.purpose,
    items:brief.items} : storedPurchase;
  const evidence = brief && !context.trim() && !images.length
    ? { facts: brief.facts, missing: [], conflicts: brief.provisionalWithConflicts ? brief.conflicts : brief.clarification ? [] : brief.conflicts }
    : await extractDocumentEvidence({expediente:purchase,antecedentes:context,borrador:{fields:contextFields,items:brief?.items || current.items}},images,`${session}-extract`);
  const sharedTdr=adq.borradores_ia?.['1']?.draft;
  const sharedFields=sharedTdr?Object.fromEntries(Object.entries(sharedTdr.fields).map(([key,value])=>[key,!sharedTdr.editedFields?.includes(key)&&staleMention(value)?missingValue:value])):undefined;
  const raw = await callOpenCodeGo([
    { role: "system", content: fixedDocumentPrompt(company.name) },
    { role: "user", content: [{ type: "text", text: JSON.stringify({ model: { number, fields: model.fields, columns: model.columns }, expediente: purchase, fichaCompra:brief, fechaPreparacion:new Intl.DateTimeFormat('sv-SE',{timeZone:'America/La_Paz',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()), tdrCompartido:number!==1?{fields:sharedFields,items:brief?.items || sharedTdr?.items,proposals:sharedTdr?.proposals}:undefined, evidence, current: { fields: contextFields, items:current.editedItems?current.items:brief?.items || current.items }, context,
      provisionalInstructions:brief?.provisionalWithConflicts ? 'Genera el borrador con los datos disponibles aunque haya contradicciones. Conserva las discrepancias como advertencias y propone redacción editable en los campos afectados, identificada expresamente como sugerencia para revisión. No presentes cantidades, precios, certificaciones ni decisiones contradictorias como confirmadas. No inventes datos para resolver diferencias.' : undefined,
      imageInstructions: "Las imágenes adjuntas son antecedentes de esta compra, no normas. Lee sus datos visibles. Si algo es ilegible o contradice los datos actuales, déjalo pendiente y explica la discrepancia. No copies firmas ni supongas aprobación.",
      normativeAnswer: sources.length ? answer || 'Extractos literales del reglamento V04 seleccionado por el usuario.' : "Sin fuentes recuperadas",
      selectedReference:hasNormativeFields?{title:referenceV04.documentTitle,version:referenceV04.version,date:referenceV04.date,applicability:referenceV04.applicability,limitations:referenceV04.limitations}:undefined,
      suggestedConditions:defaultDocumentProposals(number,adq,current), sources }) }, ...images.map(url => ({ type: "image_url" as const, image_url: { url } }))] },
  ], 0.1, 16000, 85000, session, {strict:true,disableThinking:true});
  if (!raw) throw Error("OpenCode GO devolvió una respuesta vacía. Vuelve a intentar; el borrador se conserva.");
  const result = parseFixedDocumentResponse(raw,model,{
    authoritativeItems:!!current.editedItems || !!(brief&&number===1) || !!(number===6&&(adq.comparative_report||adq.quote_evaluation?.quotes.length)),
    allowMissingItems:number===6,
  });
  const validIds = new Set(sources.map(s => s.id));
  const decisionKeys = ['seleccion','vigencia','adjudicacion','pago'];
  const decisions = brief?.decisions || {};
  const proposals: NonNullable<FixedDraft['proposals']> = {};
  const sourceIds: Record<string, string[]> = {};
  const sourceQuotes: Record<string,{sourceId:string;quote:string}[]> = {};
  const reviewWarnings: string[] = [...evidence.conflicts];
  const referenceFor = (key:string) => {
    const record = referenceSources.find(s=>s.key===key);
    return record && sources.find(s=>s.title===`${referenceV04.sourceFile} — ${record.title}`);
  };
  const defaults = defaultDocumentProposals(number,adq,current);
  const technicalEvidence = JSON.stringify({items:brief?.items || adq.items,facts:brief?.facts || evidence.facts,notes:brief?.notes,context,quality:adq.calidad_texto});
  const fields = Object.fromEntries(model.fields.map(f => {
    sourceIds[f.key] = Array.isArray(result.sourceIds?.[f.key]) ? result.sourceIds[f.key].filter((id: unknown) => typeof id === "string" && validIds.has(id)) : [];
    let value = text(result.fields[f.key]).replace(/\s*\(\s*fuente-\d+(?:\s*[,;]\s*fuente-\d+)*\s*\)/gi, "");
    const explicitCondition = current.confirmedFields?.includes(f.key) && current.fields[f.key] !== missingValue && (number!==2 || f.key!=='categoria' || amountCategory(current.fields[f.key])) ? current.fields[f.key] : '';
    const fieldDecision = f.key==='categoria' ? number===2 ? amountCategory(decisions.categoria_s1) || amountCategory(decisions.categoria) : '' : decisions[f.key];
    const proposedVal = f.key==='multas' ? defaults.multas?.value || '' : text(result.proposals?.[f.key]?.value) || defaults[f.key]?.value || '';
    const isProposal = !!proposedVal && !fieldDecision && !explicitCondition;
    if(f.normative){
      sourceQuotes[f.key]=verifiedQuotes(value,sourceIds[f.key],result.sourceQuotes?.[f.key],sources);
      sourceIds[f.key]=Array.from(new Set(sourceQuotes[f.key].map(q=>q.sourceId)));
      const unsupported = f.key==='calidad' && !explicitCondition && !current.editedFields?.includes(f.key)
        ? unsupportedQualityClaims(value,technicalEvidence+' '+sourceQuotes[f.key].map(q=>q.quote).join(' ')) : [];
      if(unsupported.length) {
        value=generalReferenceClause(number,'calidad',adq);
        const source=referenceFor('calidad');
        sourceIds[f.key]=source?[source.id]:[];sourceQuotes[f.key]=source?[{sourceId:source.id,quote:source.excerpt}]:[];
        reviewWarnings.push(`Calidad: se retiraron requisitos no aportados (${unsupported.slice(0,4).join(', ')}). Se conserva la cláusula general; adjunta la ficha técnica si deseas exigirlos.`);
      } else if(value && !/PENDIENTE/.test(value) && !sourceIds[f.key].length && !explicitCondition && !isProposal && f.key!=='categoria') reviewWarnings.push(`${f.label}: se sustituyó el texto sin respaldo verificable por la cláusula general del documento de referencia.`);
    }
    if((decisionKeys.includes(f.key) || (f.key==='multas' && defaults.multas)) && isProposal) proposals[f.key]={value:proposedVal.slice(0,4000),reason:(text(result.proposals?.[f.key]?.reason) || defaults[f.key]?.reason || 'Condición comercial propuesta para revisar.').slice(0,1500)};
    if(f.key==='categoria' && number === 2 && !explicitCondition && !fieldDecision) {
      // Calculate only from a complete, positive reference amount; it is a draft classification,
      // not proof of approval or of the company's separate petty-cash threshold.
      const amount = adq.prevision_presupuesto;
      const completePrices = adq.items.length && adq.items.every(i=>i.cantidad>0&&i.precioUnitarioEstimado>0);
      const sum = adq.items.reduce((total,i)=>total+Math.round(i.cantidad*i.precioUnitarioEstimado*100),0)/100;
      const source = referenceFor('categoria');
      if(completePrices && amount>0 && Math.abs(sum-amount)<0.02 && source) {
        const category = amount<=1500000?'Categoría I':amount<=5000000?'Categoría II':'Categoría III';
        proposals.categoria={value:category,reason:'Clasificación propuesta según la previsión de precio y el artículo 32 del V04 seleccionado; verifica su adopción y el tratamiento de caja chica o fondo rotatorio cuando corresponda.'};
        sourceIds[f.key]=[source.id];sourceQuotes[f.key]=[{sourceId:source.id,quote:source.excerpt}];
        return [f.key,category];
      }
      if(!/categor[ií]a\s+(?:I{1,3}|especial)\b/i.test(value) || !sourceIds[f.key].length)return [f.key,missingValue];
    }
    if(f.key==='categoria' && number === 1) {
      const cat = (value && !/PENDIENTE/.test(value)) ? value : adq.categoria_texto || (adq.categoria === "Bienes" ? "Bienes y Herramientas" : adq.categoria) || "Bienes y Herramientas";
      return [f.key, cat];
    }
    const decisionVal = fieldDecision || explicitCondition || ((decisionKeys.includes(f.key)||(f.key==='multas'&&defaults.multas)) ? proposedVal : '');
    if(decisionVal) {
      if(isProposal){sourceIds[f.key]=[];sourceQuotes[f.key]=[];}
      return [f.key,decisionVal];
    }
    if(f.normative && !sourceIds[f.key].length) {
      const fallback = generalReferenceClause(number,f.key,adq);
      const source = referenceFor(f.key);
      if(fallback && source) {
        sourceIds[f.key]=[source.id];sourceQuotes[f.key]=[{sourceId:source.id,quote:source.excerpt}];
        value=fallback;
      } else return [f.key,missingValue];
    }
    return [f.key,value || missingValue];
  }));
  let items: Record<string,string>[] = model.columns.length ? result.items.map((r: Record<string, unknown>) => Object.fromEntries(model.columns.map(c => [c.key, c.key.endsWith('oferta') ? '' : text(r?.[c.key]) || missingValue]))) : [];
  if (brief && number===1) items = brief.items.map((item,i)=>Object.fromEntries(model.columns.map(c=>[c.key, ({numero:String(i+1),descripcion:item.descripcion,cantidad:item.cantidad,unidad:item.unidad,especificaciones:technicalBriefSpecification(item),precio:item.precio,precio_oferta:'',total_oferta:''} as Record<string,string>)[c.key] || text(items[i]?.[c.key]) || (c.key.endsWith('oferta')?'':missingValue)])));
  if(number===6 && (adq.comparative_report || adq.quote_evaluation?.quotes.length)){
    const evaluation=technicalEvaluationData(adq);items=evaluation.items;
    for(const key of ['recepcion','evaluacion','conclusiones','recomendaciones'])fields[key]=evaluation.fields[key];
  }
  if(brief){
    const order = adq.categoria==='Servicios'?'Orden de Servicio':'Orden de Compra';
    const deadline = brief.deliveryDays ? number===1 ? `El plazo ${brief.confirmedAt?'máximo de entrega':'de entrega propuesto'} es de ${brief.deliveryDays} días calendario, computables a partir de la fecha de recepción y suscripción de la ${order}. El plazo se establecerá en el documento contractual correspondiente.` : `${brief.deliveryDays} días calendario` : '';
    for(const [key,value] of Object.entries({...brief.details,lugar:brief.location,plazo:deadline})) if(value && model.fields.some(f=>f.key===key&&!f.normative)) fields[key]=value;
  }
  if(brief && narrative)for(const key of ['objeto','antecedentes','justificacion','resumen','especificacion','ambito','asunto','cuerpo']) {
    if(!(key in fields) || current.editedFields?.includes(key))continue;
    if(number===1&&['antecedentes','justificacion'].includes(key)&&(!fields[key].trim()||/^\[PENDIENTE[^\]]*\]$/i.test(fields[key].trim()))) fields[key]=narrative[key];
    if(staleMention(fields[key])) {
      fields[key]=narrative[key] || brief.purpose;
      reviewWarnings.push('Se actualizó la redacción automática para que corresponda a los bienes actuales de esta compra.');
    }
    // The quotation remains in brief.facts for prices and commercial correspondence, not
    // as a substitute for the institutional background of the technical specifications.
    if(number===1&&key==='antecedentes'&&/cotizaci[oó]n|\b(?:Bs\.?|BOB)\s*[\d]|impuestos de ley incluidos/i.test(fields[key])) fields[key]=narrative.antecedentes;
    if(['antecedentes','justificacion'].includes(key)) {
      const unsupported=[...unsupportedQualityClaims(fields[key],technicalEvidence),...unsupportedLegalMentions(fields[key],sources.map(source=>source.excerpt).join(' '))];
      if(unsupported.length) {
        fields[key]=narrative[key];
        reviewWarnings.push(`${model.fields.find(f=>f.key===key)!.label}: se retiraron afirmaciones normativas o técnicas no respaldadas (${unsupported.slice(0,3).join(', ')}); se conserva la redacción institucional de la necesidad.`);
      }
    }
  }
  // User-authored paragraphs remain editable and survive subsequent automatic completion.
  for(const key of current.editedFields || []) if(model.fields.some(f=>f.key===key)) {
    fields[key]=current.fields[key];sourceIds[key]=[];sourceQuotes[key]=[];
    if(staleMention(current.fields[key])) reviewWarnings.push(`${model.fields.find(f=>f.key===key)!.label}: se conservó tu corrección manual; menciona bienes distintos de los ítems actuales. Puedes corregirla directamente en el documento.`);
  }
  if(brief && number===1 && current.editedItems && purchaseItemsDiffer(current.items,brief.items)) reviewWarnings.push('Se conservó la tabla modificada manualmente. Revisa su correspondencia con los ítems del archivo actual.');
  const warnings: string[] = relevantWarnings(model,Array.isArray(result.warnings) ? result.warnings : []);
  warnings.unshift(...reviewWarnings);
  if (hasNormativeFields && !sources.length) warnings.unshift("No se recuperó fundamento normativo. Requiere revisión antes de su uso oficial.");
  if (partialSearch && sources.length) warnings.unshift("La biblioteca respondió parcialmente; se conservaron los extractos del reglamento V04 seleccionado.");
  if(hasNormativeFields)warnings.push('El reglamento V04 seleccionado pertenece a ENDE Servicios y Construcciones. Verifica su adopción por ENDE DEORURO antes del uso oficial.');
  const confirmedFields = Array.from(new Set([
    ...(current.confirmedFields || []),
    ...(number===1 && fields.categoria && fields.categoria !== missingValue ? ['categoria'] : []),
  ]));
  const evaluationRevision=number===6&&!current.editedItems&&!current.editedFields?.some(k=>['recepcion','evaluacion','conclusiones','recomendaciones'].includes(k))?technicalEvaluationData(adq).revision:current.evaluationRevision;
  return normalizeFixedDraft(model, { companyId: company.id, modelVersion: model.version, fields, items: current.editedItems ? current.items : items, editedItems: current.editedItems, sources, sourceIds, sourceQuotes, proposals, warnings:Array.from(new Set(warnings)), editedFields:current.editedFields || [], confirmedFields, selectionPlan:current.selectionPlan, evaluationRevision, consultedAt: new Date().toISOString(), normativeStatus: status }, adq);
}

function purchaseItemsDiffer(previous:Record<string,string>[],current:PurchaseBrief['items']):boolean {
  const rows=(items:{descripcion:string;cantidad:string;unidad:string}[])=>items.map(i=>[i.descripcion.trim().toLowerCase(),i.cantidad.trim(),i.unidad.trim().toLowerCase()]);
  return JSON.stringify(rows(previous.map(i=>({descripcion:i.descripcion||'',cantidad:i.cantidad||'',unidad:i.unidad||''}))))!==JSON.stringify(rows(current));
}

/** Conservative wording used only to repair a quotation summary or a superseded product. */
function currentPurchaseNarrative(company:string,adq:Adquisicion,brief:PurchaseBrief,number:number):Record<string,string> {
  const epp=isProtectiveEquipment(brief.items);
  const descriptions=brief.items.map(i=>i.descripcion).join(' ');
  const protection=[
    /casco|barbiquejo/i.test(descriptions)?'la cabeza':'',
    /guante/i.test(descriptions)?'las manos':'',
    /lente|gafa/i.test(descriptions)?'los ojos':'',
    /botin|bota/i.test(descriptions)?'los pies':'',
  ].filter(Boolean);
  const height=/arn[eé]s|amortiguador/i.test(descriptions);
  const protectionText=protection.length?`elementos de protección para ${protection.join(', ')}${height?' y componentes para trabajos en altura':''}`:height?'componentes de protección para trabajos en altura':'los elementos de protección requeridos';
  const objeto=currentPurchaseTitle({title:adq.titulo_proceso,category:adq.categoria,items:brief.items});
  const antecedentes=epp
    ? `${company}, como empresa del sector eléctrico, requiere equipos de protección personal adecuados para las labores de operación y mantenimiento de sus redes de distribución. Según la tarea asignada, estas actividades demandan medidas de prevención frente a riesgos mecánicos${/lente|gafa/i.test(descriptions)?', proyección de partículas':''}${height?' y caídas durante trabajos en altura':''}. En este contexto, se plantea la dotación de ${protectionText}, conforme a las cantidades y características establecidas en el presente documento.`
    : `${company} requiere atender las necesidades operativas de ${adq.unidad_solicitante || 'la unidad solicitante'} mediante la provisión de los bienes o servicios descritos en este documento. La compra se orienta a la siguiente finalidad: ${brief.purpose.replace(/[.\s]+$/,'')}. Las cantidades, unidades y características aportadas se detallan en las especificaciones, para permitir una comparación de las propuestas y una posterior verificación de su cumplimiento.`;
  const justificacion=epp
    ? `La adquisición tiene por finalidad disponer de equipos de protección personal que contribuyan al desarrollo seguro de las labores del personal de ${company}. La dotación de ${protectionText} atiende las necesidades de prevención asociadas a las tareas que correspondan. Se requieren las cantidades y características detalladas en la tabla de especificaciones; la selección y utilización de cada producto deberán corresponder a la tarea y al riesgo identificado, previa verificación de su documentación técnica.`
    : `La adquisición permitirá ${brief.purpose.charAt(0).toLowerCase()+brief.purpose.slice(1).replace(/[.\s]+$/,'')}. Contar con los bienes o servicios en las cantidades y condiciones descritas contribuirá a atender las necesidades de ${adq.unidad_solicitante || 'la unidad solicitante'}, con requisitos concretos para comparar las propuestas y verificar su cumplimiento.`;
  return {objeto,antecedentes,justificacion:number===2?`${brief.purpose.replace(/[.\s]+$/,'')}. Se requieren las cantidades y características detalladas en las especificaciones técnicas para atender esta necesidad.`:justificacion,
    resumen:`Se requiere la provisión de ${brief.items.length} ítems${epp?' de equipos de protección personal':''}, en las cantidades, unidades y características detalladas en la tabla de especificaciones técnicas.`,
    especificacion:'A continuación se describen los bienes requeridos, sus cantidades, unidades de medida y características técnicas mínimas, conforme a la información aportada para esta adquisición.',
    ambito:'El presente documento corresponde a los ítems detallados en la tabla de especificaciones, desde la solicitud de propuestas hasta la verificación de su entrega a conformidad.',
    asunto:`Solicitud de cotización — ${objeto}`,cuerpo:`Señores proveedores:\n\nSolicitamos remitir su cotización para los ítems descritos en las especificaciones técnicas adjuntas, indicando precio unitario y total, impuestos, plazo y lugar de entrega, condiciones de pago y vigencia de la oferta. La propuesta deberá permitir verificar las características de cada producto ofrecido.\n\nAtentamente.`};
}

/** These are draft purchasing choices, not legal requirements or decisions confirmed by a user. */
function defaultDocumentProposals(number:number,adq:Adquisicion,current:FixedDraft):NonNullable<FixedDraft['proposals']> {
  if(![1,2].includes(number))return {};
  const all:NonNullable<FixedDraft['proposals']>={
    seleccion:{value:number===2?'Menor precio':'Menor precio. Se seleccionará la propuesta que ofrezca el menor precio entre aquellas que cumplan los requisitos mínimos establecidos en el presente documento.',reason:'Método propuesto para una comparación objetiva de los requisitos mínimos y el precio; el Área Solicitante puede elegir otro método.'},
    vigencia:{value:'La propuesta tendrá una vigencia de 30 días calendario computables a partir de la fecha de presentación.',reason:'Plazo comercial propuesto como base editable; el reglamento V04 permite definir el plazo y no fija treinta días.'},
    adjudicacion:{value:'La adjudicación se realizará por ítem, evaluándose y adjudicándose separadamente cada ítem requerido en el presente documento.',reason:'Unidad propuesta para mantener separados los bienes solicitados; puede cambiarse por un lote o paquete definido antes de la convocatoria.'},
    pago:{value:adq.categoria==='Servicios'?'El pago se realizará en Bolivianos, previa conformidad de la ejecución del servicio y presentación de la factura correspondiente, según las condiciones establecidas en el documento contractual.':'El pago se realizará en Bolivianos, previa entrega y recepción a conformidad de los bienes y presentación de la factura correspondiente, según las condiciones establecidas en el documento contractual.',reason:'Condición comercial propuesta para revisar; la forma de pago definitiva debe quedar establecida en el documento contractual.'},
  };
  if(number===1 && Number.isFinite(adq.multa_diaria_porcentaje) && adq.multa_diaria_porcentaje>0 && !adq.multas_texto)all.multas={
    value:`En caso de retraso injustificado, se propone una multa del ${adq.multa_diaria_porcentaje}% del monto total del contrato por cada día de retraso, sujeta a aprobación y especificación en el documento contractual.`,
    reason:'Porcentaje ya registrado en este expediente; se conserva como propuesta para revisar. El reglamento V04 no fija esta tasa.',
  };
  return Object.fromEntries(Object.entries(all).filter(([key])=>key in current.fields&&!current.confirmedFields?.includes(key)&&!adq.asistente_compra?.decisions?.[key]&&!current.editedFields?.includes(key)));
}

function generalReferenceClause(number:number,key:string,adq:Adquisicion):string {
  if(number===1 && key==='calidad')return adq.categoria==='Servicios'
    ? 'El servicio deberá cumplir el alcance y las características técnicas establecidos en el presente documento. El proveedor presentará la documentación técnica que permita verificar los materiales, equipos y resultados comprometidos, según corresponda a los requisitos solicitados.'
    : 'Los bienes deberán cumplir las características técnicas, cantidades y requisitos funcionales establecidos en el presente documento. La documentación técnica del proveedor deberá permitir verificar las características ofrecidas y su correspondencia con las especificaciones requeridas.';
  if(number===1 && key==='aceptacion')return 'El Área Solicitante y los responsables de recepción que correspondan verificarán el cumplimiento de las cantidades, características técnicas y demás condiciones establecidas. La conformidad se documentará mediante el formulario, acta o informe que corresponda al objeto y categoría de la adquisición. En caso de disconformidad, se elaborará el informe correspondiente para su atención.';
  if(number===1 && key==='multas')return 'Ante el incumplimiento de los plazos u otras condiciones establecidas para la provisión, se aplicarán las multas debidamente especificadas en el documento contractual. La tasa, base de cálculo y condiciones de aplicación deberán establecerse en dicho documento.';
  if(number===2 && key==='garantias')return 'El Área Solicitante propondrá las garantías que correspondan según el objeto y las condiciones de esta adquisición, para su definición en el documento contractual conforme al reglamento de referencia.';
  return '';
}

function technicalBriefSpecification(item:{descripcion:string;especificaciones:string}):string {
  const specification = item.especificaciones.replace(/;\s*(?:entrega inmediata|(?:disponibilidad de )?stock)\b[^\n]*/gi,'').trim();
  // A SKU is an identifier, not a characteristic. Use the actual description supplied by the
  // source as the minimum wording instead of inventing a manufacturer's technical datasheet.
  const identifierOnly = !specification || /^(?:(?:c[óo]digo|sku|ref(?:erencia)?)[\s:.-]+[^\n;]+[\s;]*)+$/i.test(specification);
  return identifierOnly && item.descripcion ? [item.descripcion,specification].filter(Boolean).join('\n') : specification;
}

function unsupportedQualityClaims(value:string,evidence:string):string[] {
  const normalized=(s:string)=>s.normalize('NFKC').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'').toLocaleLowerCase();
  const known=normalized(evidence),unsupported:string[]=[];
  const patterns=[/\b(?:ANSI(?:\s*\/\s*ISEA)?|ASTM|ISO|IEC|UNE|EN)\s*(?:[:\/-]\s*)?[A-Z]{0,4}\s*\d+(?:[.\/-]\d+)*/gi,/\b(?:ANSI|ISEA|ASTM|OSHA|ISO|IEC|UNE|CE)\b/gi,/\bclase\s*(?:[EGC]|I{1,3}|[0-4]{1,2})\b/gi,/\bcertific(?:ad[oa]s?|aci[oó]n(?:es)?)\b/gi];
  for(const pattern of patterns)for(const claim of value.match(pattern)||[]) {
    const key=normalized(claim);
    const certification=/^certific/i.test(claim);
    if(!(certification ? /certific(?:ad[oa]s?|acion(?:es)?)/i.test(known) : known.includes(key)))unsupported.push(claim);
  }
  const voltages=(text:string)=>Array.from(text.matchAll(/\b(\d+(?:[\s.,]\d+)*?)\s*(kV|V(?:oltios)?)\b/gi),match=>{
    const token=match[1].replace(/\s/g,'');
    const numeric=/^\d{1,3}(?:[.,]\d{3})+$/.test(token)?Number(token.replace(/[.,]/g,'')):Number(token.replace(',','.'));
    return {claim:match[0],value:numeric*(/^kv$/i.test(match[2])?1000:1)};
  });
  const knownVoltages=voltages(evidence).map(v=>v.value).filter(Number.isFinite);
  for(const claim of voltages(value))if(!Number.isFinite(claim.value)||!knownVoltages.includes(claim.value))unsupported.push(claim.claim);
  return Array.from(new Map(unsupported.map(claim=>[normalized(claim),claim])).values());
}

function unsupportedLegalMentions(value:string,evidence:string):string[] {
  const compact=(input:string)=>input.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
  const known=compact(evidence);
  return Array.from(new Set(value.match(/\b(?:D\.?\s*L\.?|Decreto\s+(?:Ley|Supremo)|Ley)\s*(?:N(?:ro|[.º°o])?\s*\.?\s*)?\d{2,}/gi)||[])).filter(reference=>!known.includes(compact(reference)));
}

function relevantWarnings(model:FixedModel,input:unknown[]):string[] {
  // Avoid turning the assistant into a checklist of every optional field in every folder.
  const ownKeys = new Set(model.fields.map(f=>f.key));
  const topics:[RegExp,string[]][]=[[/almac[eé]n|stock|existencias/i,['almacen']],[/presupuest.*aproba|aproba.*presupuest|partida presupuest/i,['con_presupuesto']],[/correo|email|fecha l[ií]mite/i,['correo','fecha_limite']],[/centro de costo/i,['centro_costo']],[/garant[ií]as/i,['garantias']],[/m[eé]todo de selecci[oó]n|vigencia de la propuesta|forma de adjudicaci[oó]n|forma de pago|multas/i,['seleccion','vigencia','adjudicacion','pago','multas']]];
  return input.filter((warning):warning is string=>typeof warning==='string').filter(w=>!topics.some(([pattern,keys])=>pattern.test(w)&&!keys.some(k=>ownKeys.has(k)))).map(w=>w.trim()).filter(Boolean).filter((w,i,all)=>all.findIndex(other=>other.toLocaleLowerCase()===w.toLocaleLowerCase())===i).slice(0,6);
}
