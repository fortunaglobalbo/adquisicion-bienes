import type { Adquisicion } from '@/types';
import type { FixedDraft } from './fixedModels';
import { fillTdrCover } from './tdrCover';
import { completeTdrPenalty } from './tdrPenalty';
import { fillTdrReference } from './tdrReference';
import { repairAutomaticPurchaseTitle } from './purchaseTitle';
import { developTdrDraft } from './tdrNarrative';

/** Editable drafting proposals, never evidence of a confirmed condition or legal approval. */
export function completeTdrDraft(number:number, input:FixedDraft, adq:Adquisicion):FixedDraft {
  if(number!==1)return input;
  const service=adq.categoria==='Servicios';
  const title=repairAutomaticPurchaseTitle(input.fields.objeto ?? adq.titulo_proceso,{
    title:adq.titulo_proceso, category:adq.categoria,
    items:input.items.length ? input.items.map(row=>({descripcion:row.descripcion || ''})) : adq.items || [],
  },input.editedFields?.includes('objeto') || input.confirmedFields?.includes('objeto'));
  const values:Record<string,string>={
    objeto:title,
    antecedentes:adq.antecedentes_texto || '',
    justificacion:adq.justificacion_texto || '',
    especificacion:'Se detallan a continuación los ítems, cantidades y características técnicas requeridos. La propuesta del proveedor deberá identificar su correspondencia con cada requisito.',
    calidad:adq.calidad_texto || '',
    ambito:adq.ambito_aplicacion || '',
    seleccion:adq.metodo_seleccion_texto || (adq.selection_plan?.method==='calidad_precio'?'Calidad y precio. Se aplicarán los criterios, ponderaciones y fórmulas definidos en el plan de evaluación, que deberán revisarse antes de la convocatoria.':'Menor precio. Se seleccionará la propuesta de menor precio entre aquellas que cumplan los requisitos mínimos establecidos en el presente documento.'),
    vigencia:adq.vigencia_propuesta_texto || 'La propuesta tendrá una vigencia de 30 días calendario computables a partir de la fecha de presentación.',
    categoria:adq.categoria_texto || adq.categoria || 'Bienes',
    lugar:adq.lugar_entrega || 'La entrega se efectuará en el lugar que la unidad solicitante indique expresamente en la Orden de Compra o de Servicio, antes de su emisión.',
    plazo:adq.plazo_entrega_dias>0?`${adq.plazo_entrega_dias} días calendario, computables desde la recepción de la Orden de Compra o de Servicio, conforme a las condiciones contractuales.`:'El plazo de entrega se definirá con la unidad solicitante considerando la disponibilidad y condiciones ofertadas, y deberá consignarse expresamente en la Orden de Compra o de Servicio antes de su emisión.',
    adjudicacion:'La adjudicación se propone por ítem, evaluándose separadamente el cumplimiento de los requisitos y las condiciones económicas de cada ítem.',
    aceptacion:adq.aceptacion_lote || '',
    pago:adq.forma_pago_texto || `El pago se realizará en Bolivianos, mediante transferencia bancaria, previa ${service?'ejecución del servicio':'entrega de los bienes'} a conformidad y presentación de la factura y documentación de recepción correspondientes, según las condiciones del documento contractual.`,
  };
  const draft={...input,fields:{...input.fields},proposals:{...input.proposals},warnings:[...input.warnings]};
  draft.fields.objeto = title;
  fillTdrCover(draft, adq);
  for(const [key,value] of Object.entries(values)) {
    if(!value||!(key in draft.fields)||input.editedFields?.includes(key)||input.confirmedFields?.includes(key))continue;
    const repairTitle = title !== adq.titulo_proceso && ['antecedentes','ambito'].includes(key) &&
      draft.proposals[key]?.value === draft.fields[key] && draft.fields[key]?.includes(adq.titulo_proceso);
    if(!repairTitle && draft.fields[key]?.trim()&&!/^\[PENDIENTE[^\]]*\]$|^[_–—\s]+$/i.test(draft.fields[key].trim()))continue;
    draft.fields[key]=value;
    draft.proposals[key]={value,reason:'Redacción propuesta para completar el borrador. Revisar y adaptar antes del uso oficial; no acredita aprobación ni fundamento normativo.'};
  }
  const completed = completeTdrPenalty(draft,adq);
  fillTdrReference(completed,adq);
  developTdrDraft(completed,adq);
  completed.warnings = completed.warnings.map(warning => {
    if (warning === 'Las cláusulas completadas como propuestas son editables y requieren revisión. Los plazos y porcentajes no informados deben definirse antes de emitir la contratación.') return 'Revisa las condiciones propuestas antes de emitir el documento.';
    if (warning.startsWith('Borrador provisional preparado con los datos disponibles porque la IA no completó la redacción.')) return 'El borrador se preparó con los datos del expediente y sus antecedentes.';
    return warning;
  });
  if (Object.keys(completed.proposals || {}).length) completed.warnings = Array.from(new Set([...completed.warnings,'Revisa las condiciones propuestas antes de emitir el documento.']));
  return completed;
}
