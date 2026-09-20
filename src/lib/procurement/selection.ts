import type { Adquisicion } from '@/types';
import type { FixedDraft } from '../docx/fixedModels';

export type SelectionMethod = 'menor_precio' | 'calidad_precio';
export type AwardMode = 'item' | 'lote' | 'tramo' | 'paquete';
export interface Criterion { id:string; label:string; weight:number; levels:{id:string;label:string;score:number}[] }
export interface SelectionPlan {
  revision:string; confirmedAt:string|null; profile:'general'|'mantenimiento_higiene'; method:SelectionMethod;
  awardMode:AwardMode; categoryDescription:string; amountCategory:string; conditions:Record<string,string>;
  priceWeight:number; minimums:{id:string;label:string}[]; criteria:Criterion[];
  groups:{id:string;label:string;itemIds:string[];itemLabels?:string[];referencePrice:string}[];
}
export interface Quote {
  id:string; provider:string; groupId:string; price:string; source:string; reviewed:boolean;
  minimums:Record<string,'yes'|'no'|'unknown'>; levels:Record<string,string>; evidence:Record<string,string>;
}
export interface QuoteEvaluation { plan:SelectionPlan; quotes:Quote[]; updatedAt:string }
export const methodLabels = {menor_precio:'Menor precio',calidad_precio:'Calidad y Precio'};
export const awardLabels = {item:'ítem',lote:'lote',tramo:'tramo',paquete:'paquete'};
export const maintenanceConditions:Record<string,string> = {
  vigencia:'La propuesta tendrá una vigencia de 30 días calendario computables a partir de la fecha de presentación.',
  pago:'El pago se realizará en moneda nacional (Bolivianos) vía transferencia bancaria a la finalización de la etapa del servicio o según cronograma establecido en contrato, previa presentación de los siguientes documentos:\n1. Certificado de Prestación del Servicio firmado por el Proveedor y la Inspección de ENDE.\n2. Informe Técnico final de ejecución con registro fotográfico.\n3. Factura original emitida a nombre de Distribuidora de Electricidad ENDE DEORURO S.A.\n4. Acta de Conformidad otorgada por el Supervisor SYSO o Unidad Solicitante.',
  multas:'En caso de retraso injustificado en las fechas programadas para la ejecución del servicio o incumplimiento de los plazos estipulados en la Orden de Servicio/Contrato, se aplicará una multa del 0.25% del monto total del contrato por cada día de retraso, la cual será deducida directamente de la liquidación del pago.',
};
export function monetary(value:string):number|null {
  if(!/^\d+(?:[.,]\d{1,2})?$/.test(value.trim()))return null;
  const n=Number(value.replace(',','.'));return Number.isFinite(n)&&n>0&&n<=1e12?n:null;
}
export function initialSelection(adq:Adquisicion):SelectionPlan {
  if(adq.selection_plan)return structuredClone(adq.selection_plan);
  const maintenance=adq.categoria==='Servicios'&&/mantenimiento|higiene|limpieza/i.test(adq.titulo_proceso);
  const decisions=adq.asistente_compra?.decisions||{};
  return {revision:'',confirmedAt:null,profile:maintenance?'mantenimiento_higiene':'general',method:'menor_precio',awardMode:'item',
    categoryDescription:maintenance?'Servicios General / Mantenimiento e Higiene Industrial':adq.categoria,
    amountCategory:'',conditions:{...(maintenance?maintenanceConditions:{}),...Object.fromEntries(Object.entries({vigencia:adq.vigencia_propuesta_texto,pago:adq.forma_pago_texto,multas:adq.multas_texto}).filter((entry):entry is [string,string]=>!!entry[1])),...Object.fromEntries(['vigencia','pago','multas'].filter(k=>decisions[k]).map(k=>[k,decisions[k]]))},
    priceWeight:50,minimums:[{id:'min-tecnico',label:'Cumplimiento de todas las especificaciones técnicas mínimas del TDR.'}],criteria:[],
    groups:adq.items.map(i=>({id:i.id,label:`Ítem ${i.item}: ${i.descripcion}`,itemIds:[i.id],itemLabels:[`Ítem ${i.item}: ${i.descripcion}`],referencePrice:i.precioTotalEstimado>0?String(i.precioTotalEstimado):''}))};
}
export function planProblems(plan:SelectionPlan,requirePrices=false):string[] {
  const errors:string[]=[];
  if(!plan||!['menor_precio','calidad_precio'].includes(plan.method))return ['Elige un método de selección válido.'];
  if(!['general','mantenimiento_higiene'].includes(plan.profile)||!Object.keys(awardLabels).includes(plan.awardMode))errors.push('Revisa el tipo de documento y la forma de adjudicación.');
  if(!plan.categoryDescription?.trim())errors.push('Indica la especialidad o categoría descriptiva.');
  if(!plan.conditions||Object.values(plan.conditions).some(v=>typeof v!=='string'||v.length>16000))errors.push('Revisa las condiciones del documento.');
  const unique=(rows:{id:string}[])=>new Set(rows.map(r=>r.id)).size===rows.length&&rows.every(r=>typeof r.id==='string'&&!!r.id);
  if(!Array.isArray(plan.minimums)||!plan.minimums.length||plan.minimums.length>30||!unique(plan.minimums)||plan.minimums.some(m=>!m.label?.trim()||m.label.length>3000))errors.push('Define los requisitos mínimos, sin duplicados.');
  if(!Array.isArray(plan.groups)||!plan.groups.length||plan.groups.length>100||!unique(plan.groups)||plan.groups.some(g=>!g.label?.trim()||!Array.isArray(g.itemIds)||!g.itemIds.length))errors.push('Define qué ítems incluye cada unidad de adjudicación.');
  else {
    const ids=plan.groups.flatMap(g=>g.itemIds);if(new Set(ids).size!==ids.length)errors.push('Un ítem no puede pertenecer a dos unidades de adjudicación.');
    if(plan.awardMode==='item'&&plan.groups.some(g=>g.itemIds.length!==1))errors.push('La adjudicación por ítem requiere una unidad por cada ítem.');
    if(plan.groups.some(g=>g.referencePrice!==''&&monetary(g.referencePrice)===null))errors.push('La previsión de precio debe ser positiva, con hasta dos decimales y sin separadores de miles.');
    if(requirePrices&&plan.method==='calidad_precio'&&plan.groups.some(g=>monetary(g.referencePrice)===null))errors.push('Completa la previsión de precio de cada unidad antes de evaluar.');
  }
  // The user supplied a 50/50 example. Other weightings require a separately approved model.
  if(plan.method==='calidad_precio') {
    if(plan.priceWeight!==50)errors.push('Este modelo utiliza 50 puntos por precio y 50 por requisitos adicionales.');
    if(!Array.isArray(plan.criteria)||!plan.criteria.length||plan.criteria.length>15||!unique(plan.criteria))errors.push('Define los criterios adicionales.');
    else {
      if(Math.abs(plan.criteria.reduce((s,c)=>s+c.weight,0)-100)>1e-8)errors.push('Las ponderaciones adicionales deben sumar 100 %.');
      for(const c of plan.criteria)if(!c.label?.trim()||!Number.isFinite(c.weight)||c.weight<=0||c.weight>100||!Array.isArray(c.levels)||c.levels.length<2||c.levels.length>8||!unique(c.levels)||c.levels.some(l=>!l.label?.trim()||!Number.isFinite(l.score)||l.score<0||l.score>100)||!c.levels.some(l=>l.score===0)||!c.levels.some(l=>l.score===100))errors.push('Cada criterio necesita niveles definidos entre 0 y 100, incluyendo mínimo (0) y excelente (100).');
    }
  }
  return Array.from(new Set(errors));
}
export function assertPlan(plan:SelectionPlan,requirePrices=false) {const problems=planProblems(plan,requirePrices);if(problems.length)throw Error(problems.join(' '));}
export function selectionText(plan:SelectionPlan) {
  return plan.method==='menor_precio'?'Menor precio. Se seleccionará la propuesta que ofrezca el menor precio entre aquellas que hayan cumplido los requisitos mínimos establecidos en el presente documento, conforme al método de selección previsto para esta adquisición.':
    'Calidad y Precio. Primero se verificará el cumplimiento de todos los requisitos mínimos. Entre las propuestas habilitadas se seleccionará la de mayor puntaje total, sumando el puntaje de precio (PP) y el puntaje de requisitos adicionales (PRA), conforme a las reglas y escalas establecidas en la sección 3 de este documento.';
}
export function planFields(plan:SelectionPlan,number:number):Record<string,string> {
  if(number===1)return {...plan.conditions,seleccion:selectionText(plan),categoria:plan.categoryDescription,
    adjudicacion:`La adjudicación se realizará por ${awardLabels[plan.awardMode]}, evaluándose y adjudicándose separadamente cada unidad definida en el presente documento.`};
  if(number===2)return {seleccion:methodLabels[plan.method],...(plan.amountCategory?{categoria:plan.amountCategory}:{})};
  return {};
}
export function applySelection(draft:FixedDraft,plan:SelectionPlan,number:number):FixedDraft {
  const fields=planFields(plan,number),keys=Object.keys(fields).filter(k=>k in draft.fields);
  return {...draft,fields:{...draft.fields,...Object.fromEntries(keys.map(k=>[k,fields[k].trim()||'[PENDIENTE]']))},selectionPlan:structuredClone(plan),
    confirmedFields:Array.from(new Set([...(draft.confirmedFields||[]).filter(k=>!keys.includes(k)),...keys.filter(k=>!!fields[k].trim())])),
    editedFields:Array.from(new Set([...(draft.editedFields||[]),...keys])),
    sourceIds:{...draft.sourceIds,...Object.fromEntries(keys.map(k=>[k,[]]))},
    sourceQuotes:{...draft.sourceQuotes,...Object.fromEntries(keys.map(k=>[k,[]]))},
    proposals:Object.fromEntries(Object.entries(draft.proposals||{}).filter(([k])=>!keys.includes(k)))};
}
export interface EvaluationRow {quote:Quote;status:'pending'|'excluded'|'eligible';reason:string;pp:number|null;era:number|null;pra:number|null;total:number|null;rank:number|null}
const round=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
export function evaluateQuotes(plan:SelectionPlan,quotes:Quote[]):EvaluationRow[] {
  assertPlan(plan,true);
  const rows:EvaluationRow[]=quotes.map(quote=>{
    const row:EvaluationRow={quote,status:'pending',reason:'',pp:null,era:null,pra:null,total:null,rank:null};
    const group=plan.groups.find(g=>g.id===quote.groupId),price=monetary(quote.price);
    if(!group||price===null||!quote.provider.trim())return {...row,reason:'Revisa proveedor, importe y unidad de adjudicación.'};
    if(!quote.reviewed)return {...row,reason:'Confirma los datos extraídos de esta oferta.'};
    if(plan.minimums.some(m=>['yes','no'].includes(quote.minimums[m.id])&&!quote.evidence[m.id]?.trim()))return {...row,reason:'Falta documentar la evidencia de un requisito mínimo.'};
    if(plan.minimums.some(m=>quote.minimums[m.id]==='no'))return {...row,status:'excluded',reason:'Incumple un requisito mínimo.'};
    if(plan.minimums.some(m=>quote.minimums[m.id]!=='yes'||!quote.evidence[m.id]?.trim()))return {...row,reason:'Falta verificar un requisito mínimo y su evidencia.'};
    if(plan.method==='menor_precio')return {...row,status:'eligible',reason:'Cumple los mínimos; comparación por precio.'};
    const reference=monetary(group.referencePrice)!;
    // Compare integer cents at the exact 80%/120% boundaries; never classify rounded ratios.
    const cents=Math.round(price*100),refCents=Math.round(reference*100);
    if(cents*5>refCents*6)return {...row,status:'excluded',reason:'El precio supera el 120 % de la previsión.'};
    const pp=cents*5<=refCents*4?50:50*(3-2.5*(price/reference));
    let era=0;
    for(const c of plan.criteria){const level=c.levels.find(l=>l.id===quote.levels[c.id]);if(!level||!quote.evidence[c.id]?.trim())return {...row,reason:`Falta verificar el criterio «${c.label}» y su evidencia.`};era+=level.score*c.weight/100;}
    return {...row,status:'eligible',reason:'Puntajes calculados con las reglas del TDR.',pp:round(pp),era:round(era),pra:round(era*.5),total:round(pp+era*.5)};
  });
  for(const group of plan.groups){const eligible=rows.filter(r=>r.quote.groupId===group.id&&r.status==='eligible');eligible.sort((a,b)=>plan.method==='menor_precio'?monetary(a.quote.price)!-monetary(b.quote.price)!:b.total!-a.total!);
    eligible.forEach((r,i)=>{const prev=eligible[i-1];const tied=prev&&(plan.method==='menor_precio'?monetary(prev.quote.price)===monetary(r.quote.price):prev.total===r.total);r.rank=tied?prev.rank:i+1;});
  }
  return rows;
}
