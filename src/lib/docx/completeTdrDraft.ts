import type { Adquisicion } from '@/types';
import type { FixedDraft } from './fixedModels';

/** Editable drafting proposals, never evidence of a confirmed condition or legal approval. */
export function completeTdrDraft(number:number, input:FixedDraft, adq:Adquisicion):FixedDraft {
  if(number!==1)return input;
  const service=adq.categoria==='Servicios';
  const values:Record<string,string>={
    objeto:adq.titulo_proceso,
    antecedentes:adq.antecedentes_texto || `La unidad solicitante de ENDE DEORURO S.A. requiere ${adq.titulo_proceso}. Los antecedentes y las fichas técnicas adjuntas describen el requerimiento que se desarrolla en este documento.`,
    justificacion:adq.justificacion_texto || adq.asistente_compra?.purpose || 'La contratación tiene por finalidad atender el requerimiento de la unidad solicitante conforme a los bienes o servicios y las características descritos en este documento.',
    especificacion:'Se detallan a continuación los ítems, cantidades y características técnicas requeridos. La propuesta del proveedor deberá identificar su correspondencia con cada requisito.',
    calidad:adq.calidad_texto || (service?'El servicio deberá cumplir el alcance y las características técnicas descritos. La conformidad se verificará respecto de los resultados y condiciones establecidos en el documento contractual.':'Los bienes deberán entregarse nuevos, sin uso y en condiciones adecuadas para su finalidad, cumpliendo las características técnicas descritas. La documentación técnica del proveedor permitirá verificar su correspondencia con el requerimiento.'),
    ambito:`El presente documento comprende ${adq.titulo_proceso}, desde la presentación y evaluación de propuestas hasta la entrega y recepción a conformidad por la unidad solicitante.`,
    seleccion:adq.metodo_seleccion_texto || (adq.selection_plan?.method==='calidad_precio'?'Calidad y precio. Se aplicarán los criterios, ponderaciones y fórmulas definidos en el plan de evaluación, que deberán revisarse antes de la convocatoria.':'Menor precio. Se seleccionará la propuesta de menor precio entre aquellas que cumplan los requisitos mínimos establecidos en el presente documento.'),
    vigencia:adq.vigencia_propuesta_texto || 'La propuesta tendrá una vigencia de 30 días calendario computables a partir de la fecha de presentación.',
    categoria:adq.categoria_texto || adq.categoria || 'Bienes',
    lugar:adq.lugar_entrega || 'La entrega se efectuará en el lugar que la unidad solicitante indique expresamente en la Orden de Compra o de Servicio, antes de su emisión.',
    plazo:adq.plazo_entrega_dias>0?`${adq.plazo_entrega_dias} días calendario, computables desde la recepción de la Orden de Compra o de Servicio, conforme a las condiciones contractuales.`:'El plazo de entrega se definirá con la unidad solicitante considerando la disponibilidad y condiciones ofertadas, y deberá consignarse expresamente en la Orden de Compra o de Servicio antes de su emisión.',
    adjudicacion:'La adjudicación se propone por ítem, evaluándose separadamente el cumplimiento de los requisitos y las condiciones económicas de cada ítem.',
    aceptacion:'Los responsables de recepción verificarán las cantidades, características técnicas y condiciones de entrega. La conformidad se documentará mediante el acta, formulario o informe correspondiente; las observaciones se comunicarán al proveedor para su atención.',
    pago:adq.forma_pago_texto || `El pago se realizará en Bolivianos, mediante transferencia bancaria, previa ${service?'ejecución del servicio':'entrega de los bienes'} a conformidad y presentación de la factura y documentación de recepción correspondientes, según las condiciones del documento contractual.`,
    multas:adq.multas_texto || 'En caso de retraso injustificado u otro incumplimiento, se aplicarán las multas expresamente establecidas en el documento contractual. Su porcentaje, base de cálculo y condiciones deberán definirse y revisarse antes de formalizar la contratación.',
  };
  const draft={...input,fields:{...input.fields},proposals:{...input.proposals},warnings:[...input.warnings]};
  for(const [key,value] of Object.entries(values)) {
    if(!(key in draft.fields)||input.editedFields?.includes(key)||input.confirmedFields?.includes(key))continue;
    if(draft.fields[key]?.trim()&&!/^\[PENDIENTE[^\]]*\]$|^[_–—\s]+$/i.test(draft.fields[key].trim()))continue;
    draft.fields[key]=value;
    draft.proposals[key]={value,reason:'Redacción propuesta para completar el borrador. Revisar y adaptar antes del uso oficial; no acredita aprobación ni fundamento normativo.'};
  }
  if(Object.keys(draft.proposals).length)draft.warnings=Array.from(new Set([...draft.warnings,'Las cláusulas completadas como propuestas son editables y requieren revisión. Los plazos y porcentajes no informados deben definirse antes de emitir la contratación.']));
  return draft;
}
