import type { Adquisicion } from '@/types';
import type { FixedDraft } from '../docx/fixedModels';
import { administrativeDefaults, requestNumber, hasAdministrativeValue } from '../docx/administrativeDefaults';
import { evaluateQuotes, methodLabels } from '../procurement/selection';
import { formatCurrencyBs } from '../docx/formatters';

const amount=(value:number)=>formatCurrencyBs(value).replace(/\.$/,'');

export function technicalEvaluationData(adq: Adquisicion) {
  const admin = administrativeDefaults(adq);
  const roles = adq.responsables_oficiales?.['6'] || {};
  const startRoles = adq.responsables_oficiales?.['5'] || {};
  const first = (...values: unknown[]) => values.find(hasAdministrativeValue)?.trim() || '';
  const fields: Record<string, string> = {
    fecha: new Intl.DateTimeFormat('es-BO', {timeZone:'America/La_Paz',day:'numeric',month:'long',year:'numeric'}).format(new Date()),
    numero: adq.codigo, solicitud: requestNumber(adq), objeto: adq.titulo_proceso,
    destinatario: first(roles.destinatario, startRoles.destinatario), via: first(roles.via, startRoles.via),
    solicitante: first(roles.solicitante, [admin.solicitante, admin.cargo].filter(Boolean).join('\n')),
    antecedentes: `El presente informe evalúa las ofertas registradas para «${adq.titulo_proceso}», correspondiente a la solicitud ${requestNumber(adq)}.${adq.prevision_presupuesto > 0 ? ` La previsión de precio del expediente es de ${amount(adq.prevision_presupuesto)}.` : ''} Se consideran las condiciones del TDR y la documentación disponible para sustentar la recomendación.`,
    recepcion: 'Aún no se ha guardado una comparación de cotizaciones en este expediente.',
    evaluacion: 'La evaluación técnica y económica se completará con las ofertas y su evidencia. No se ha establecido un resultado de selección.',
    conclusiones: 'La información disponible todavía no permite determinar una oferta recomendada.',
    recomendaciones: 'Incorporar y revisar las cotizaciones en la carpeta 4, o registrar aquí el cuadro de evaluación respaldado con los antecedentes de la compra.',
  };
  const evaluation = adq.quote_evaluation;
  if (!evaluation?.quotes.length) return {fields, items: [] as Record<string,string>[], revision: '', warnings: [] as string[]};
  const {plan,quotes} = evaluation;
  const rows = evaluateQuotes(plan, quotes);
  const changed = !!adq.selection_plan && adq.selection_plan.revision !== plan.revision;
  const providers = Array.from(new Set(quotes.map(q=>q.provider.trim()).filter(Boolean)));
  fields.recepcion = `Se registraron ${quotes.length} ofertas para evaluación, correspondientes a ${providers.length} proponentes: ${providers.join(', ')}. El cuadro identifica la unidad cotizada, el importe y el respaldo documental de cada oferta.`;
  fields.evaluacion = `Método utilizado: ${methodLabels[plan.method]}. Se verifican los requisitos mínimos y la evidencia por unidad de adjudicación. ${plan.method === 'calidad_precio' ? 'Se consideran hasta 50 puntos por precio y 50 por requisitos adicionales; los puntajes del cuadro proceden de las reglas confirmadas de la comparación.' : 'Se ordenan por precio las ofertas revisadas que cumplen los requisitos mínimos.'} La falta de evidencia queda por verificar y los empates requieren resolución documentada.`;
  const conclusions: string[] = [], recommendations: string[] = [];
  for (const group of plan.groups) {
    const groupRows = rows.filter(r=>r.quote.groupId===group.id), best = groupRows.filter(r=>r.rank===1);
    if (!groupRows.length || groupRows.some(r=>r.status==='pending')) {
      conclusions.push(`${group.label}: evaluación incompleta; no se establece una oferta recomendada.`);
      recommendations.push(`${group.label}: completar las ofertas y la verificación de su evidencia antes de recomendar adjudicación.`);
    } else if (best.length > 1) {
      conclusions.push(`${group.label}: empate entre ${best.map(r=>r.quote.provider).join(', ')}.`);
      recommendations.push(`${group.label}: documentar la resolución del empate conforme a las reglas aplicables.`);
    } else if (!best.length) {
      conclusions.push(`${group.label}: ninguna oferta evaluada quedó habilitada.`);
      recommendations.push(`${group.label}: remitir los antecedentes al responsable de contratación para determinar la continuidad del proceso.`);
    } else {
      const winner = best[0];
      conclusions.push(`${group.label}: ${winner.quote.provider} presenta el mejor resultado entre las ofertas habilitadas, por ${amount(Number(winner.quote.price.replace(',','.')))}${winner.total!==null?`, con ${winner.total.toFixed(2)} puntos`:''}.`);
      recommendations.push(`${group.label}: se recomienda considerar la adjudicación a ${winner.quote.provider} por el importe evaluado, sujeta a la revisión y aprobación del responsable de contratación. Esta recomendación no constituye una adjudicación emitida.`);
    }
  }
  fields.conclusiones = conclusions.join('\n\n');
  fields.recomendaciones = changed ? 'El TDR cambió después de guardar esta comparación. Revisar y actualizar las reglas y cotizaciones antes de emitir una recomendación de adjudicación.' : recommendations.join('\n\n');
  const items = rows.map((row,i)=>({numero:String(i+1),empresa:row.quote.provider || 'Proveedor por identificar',
    cotizacion: `${plan.groups.find(g=>g.id===row.quote.groupId)?.label || 'Unidad sin identificar'}. ${row.reason}${row.rank?` Posición ${row.rank}.`:''}${row.total!==null?` PP: ${row.pp?.toFixed(2)}; ERA: ${row.era?.toFixed(2)}; PRA: ${row.pra?.toFixed(2)}; PT: ${row.total.toFixed(2)}.`:''}\nFuente: ${row.quote.source}`,
    precio: row.quote.price ? `${row.quote.price} Bs` : 'No determinado',
    respaldo: [...plan.minimums.map(m=>`${m.label.replace(/[.:]+$/,'')}: ${{yes:'Cumple',no:'No cumple',unknown:'Por verificar'}[row.quote.minimums[m.id] || 'unknown']}. ${row.quote.evidence[m.id] || 'Sin evidencia registrada.'}`),
      ...plan.criteria.filter(()=>plan.method==='calidad_precio').map(c=>`${c.label}: ${row.quote.evidence[c.id] || 'Sin evidencia registrada.'}`)].join('\n').slice(0,4900),
  }));
  return {fields,items,revision:evaluation.updatedAt,warnings:changed?['La comparación utiliza una versión anterior de las reglas del TDR.']:[]};
}

export function updateTechnicalEvaluation(draft:FixedDraft,adq:Adquisicion):FixedDraft {
  const data=technicalEvaluationData(adq),keys=['recepcion','evaluacion','conclusiones','recomendaciones'];
  return {...draft,fields:{...draft.fields,...Object.fromEntries(keys.map(k=>[k,data.fields[k]]))},items:data.items,
    evaluationRevision:data.revision,editedItems:false,editedFields:draft.editedFields?.filter(k=>!keys.includes(k)),
    warnings:[...draft.warnings.filter(w=>!w.startsWith('La comparación utiliza')), ...data.warnings]};
}
