import type { Adquisicion } from '@/types';
import type { FixedDraft } from './fixedModels';
import { availablePurchaseBrief, isProtectiveEquipment, obsoletePurchaseMentions } from './purchaseBrief';
import { attachedTdr } from './tdrReference';

type Row = { descripcion?: string; especificaciones?: string; cantidad?: string; unidad?: string };
type NarrativeKey = 'antecedentes' | 'justificacion' | 'ambito' | 'calidad' | 'aceptacion';

const clean = (value?: string) => (value || '').replace(/\s+/g, ' ').trim().replace(/^(\[PENDIENTE[^\]]*\]|[_–—\s]+)$/i, '');
const wording = (value: string) => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const sentence = (value: string) => /[.!?]$/.test(value) ? value : value + '.';
const narrativeReason = 'Redacción elaborada con el objeto, la finalidad y los requisitos actuales del expediente.';

// An example from another purchase must never become an account of this purchase.
// Reuse a supplied background paragraph only from an identified TDR for the current
// items and quantities. Numbered headings on their own line exclude the index.
function backgroundFromAttachment(adq: Adquisicion, draft: FixedDraft, rows: Row[]): string {
  const brief = availablePurchaseBrief(adq);
  if (!brief || rows.length !== brief.items.length || !rows.length) return '';
  // Selecting compliance in the editor also marks the table as edited.
  if (draft.editedItems && rows.some((row,i) => clean(row.especificaciones) !== clean(brief.items[i].especificaciones))) return '';
  const reference = attachedTdr(adq, {items:draft.items});
  if (!reference) return '';
  const cover = wording(reference.split(/índice general|p[áa]gina 2\s*:/i)[0]);
  const sameRequirement = rows.every((row, i) => {
    const item = brief.items[i];
    return !!row.cantidad && !!row.unidad && clean(row.descripcion) === clean(item.descripcion)
      && row.cantidad === item.cantidad && wording(row.unidad) === wording(item.unidad)
      && cover.includes(wording(row.cantidad + ' ' + row.unidad));
  });
  if (!sameRequirement) return '';
  const match = /(?:^|\n)(?:1[.)]?\s+)?ANTECEDENTES[ \t]*\r?\n([\s\S]{1,2600}?)\r?\n(?:2[.)]?\s+)?JUSTIFICACI[OÓ]N(?:\s*\/\s*NECESIDAD)?[ \t]*\r?(?:\n|$)/i.exec(reference);
  const paragraph = clean(match?.[1]);
  if (!paragraph || /p[áa]gina\s+\d|\.{4,}|\[pendiente|cotizaci[oó]n|certificaci[oó]n|art[ií]culo\s+\d|decreto|ley\s+\d/i.test(paragraph)) return '';
  return paragraph;
}

function technicalCondition(line: string): string {
  const detail = line.replace(/^tipo\s+(?=bota\b)/i, '').replace(/(\d+)"(?=\s|$)/g,'$1 pulgadas').replace(/[.;]+$/, '');
  const nouns = /^(bota|caña|capellada|puntera|plantilla|resistencia|capacidad|longitud|frecuencia|duración|ancho|largo|peso|diámetro)\b[:\s]+(.+)/i.exec(detail);
  if (!nouns) return '«' + detail + '»';
  const noun = nouns[1].toLowerCase();
  const article = /^(?:ancho|largo|peso|diámetro)$/.test(noun) ? 'el' : 'la';
  return article + ' ' + noun + (/^\d/.test(nouns[2]) ? ' de ' : ' ') + nouns[2];
}

export function buildTdrNarrative(adq: Adquisicion, title: string, rows: Row[], purpose: string, referenceBackground = ''): Record<NarrativeKey,string> {
  const entity = 'ENDE DEORURO S.A.';
  const service = adq.categoria === 'Servicios' || adq.categoria === 'Consultorías';
  const works = adq.categoria === 'Obras';
  const receipt = service || works ? 'la ejecución' : 'la entrega';
  const area = clean(adq.unidad_solicitante);
  const requester = area ? 'La unidad solicitante (' + area + ')' : 'La unidad solicitante';
  const purposeText = clean(purpose);
  const names = Array.from(new Set(rows.map(row => clean(row.descripcion)).filter(Boolean)));
  const epp = !service && !works && isProtectiveEquipment(names.map(descripcion => ({descripcion})));
  const scope = clean(title) || names[0] || 'el requerimiento de la unidad solicitante';
  const heading = epp
    ? requester + ' de ' + entity + ', empresa del sector eléctrico, requiere equipos de protección personal para las actividades que motivan la dotación «' + scope + '».'
    : requester + ' de ' + entity + ' presenta el requerimiento «' + scope + '».';
  const purposeSentence = purposeText && (/^\S+(?:ar|er|ir)\b/i.test(purposeText)
    ? sentence('La finalidad es ' + purposeText.charAt(0).toLowerCase() + purposeText.slice(1)) : sentence(purposeText));
  const location = clean(adq.lugar_entrega);
  const reference = names.length && names.length <= 3
    ? 'El alcance comprende ' + new Intl.ListFormat('es').format(names.map(name => '«' + name + '»')) + '.'
    : 'El alcance se organiza por ítem en el cuadro de especificaciones técnicas.';
  const antecedentes = referenceBackground || [
    heading, reference,
    service || works
      ? 'El alcance técnico define qué actividades se solicitan y qué resultados se tomarán en cuenta al evaluar las propuestas. Estos elementos servirán a la unidad solicitante para verificar la ejecución conforme a lo contratado.'
      : 'Las cantidades y las características que se detallan por ítem permiten describir la dotación requerida y comparar lo que ofrezca cada proponente. Los mismos requisitos servirán de referencia al verificar los bienes recibidos.',
    location && !service && !works ? sentence('El lugar previsto para la entrega es ' + location) : '',
  ].filter(Boolean).join(' ');

  // Describe a small number of actual requirements, preserving manufacturer's notation.
  // Commercial terms and codes do not explain the technical need.
  const features = rows.slice(0, 2).flatMap((row, index) => {
    const details = (row.especificaciones || '').split(/\r?\n/).map(clean).filter(value => value && value.length <= 140
      && value !== clean(row.descripcion) && !/^(?:c[oó]digo|sku|marca|referencia|precio|entrega|stock)\b/i.test(value)).slice(0,rows.length<=2?2:1);
    return details.length ? ['El ítem ' + (index + 1) + ' especifica ' + new Intl.ListFormat('es').format(details.map(technicalCondition)) + '.'] : [];
  });
  const rationale = service || works
    ? 'Precisar las actividades y los resultados esperados permite que las propuestas respondan al mismo alcance. La unidad solicitante podrá contrastar la ejecución con los requisitos de cada ítem y documentar la conformidad respecto de las prestaciones efectivamente realizadas.'
    : epp
      ? 'Las características exigidas permiten distinguir las opciones de protección que corresponden al uso previsto y valorar cada oferta frente a las necesidades del personal. Al recibir la dotación, la unidad solicitante podrá contrastar cada variante ofrecida con las características requeridas para esa tarea.'
      : 'Las características solicitadas delimitan la función que debe atender cada bien. Su identificación por ítem permite comparar las alternativas ofrecidas para el mismo uso y verificar en la recepción la correspondencia entre lo solicitado, lo ofertado y lo entregado.';
  const justificacion = [purposeSentence || 'El requerimiento «' + scope + '» define las condiciones que necesita la unidad solicitante para atender sus actividades.', ...features, rationale].join(' ');
  const ambito = 'El presente documento comprende «' + scope + '». Sus requisitos se aplican a la preparación y evaluación de las propuestas y a la verificación de ' + receipt + ' por la unidad solicitante. La correspondencia con las especificaciones se examinará para cada ítem incluido en el cuadro técnico.';
  const calidad = service || works
    ? 'La calidad se evaluará por la correspondencia entre las actividades descritas, los resultados previstos y la prestación ofrecida. Durante la ejecución, la unidad solicitante contrastará los resultados con el alcance de cada ítem y dejará constancia de las diferencias que afecten a la conformidad.'
    : 'La calidad se verificará por ítem, contrastando las características técnicas y funcionales solicitadas con las declaradas por el proponente. En la recepción se comprobará que los bienes correspondan a lo ofertado y que su estado permita el uso previsto. Cuando se hayan especificado materiales, dimensiones o componentes, la verificación también abarcará esos requisitos.';
  const aceptacion = service || works
    ? 'Para otorgar la conformidad, la unidad solicitante verificará que las actividades ejecutadas cubran el alcance contratado y que los resultados coincidan con los requisitos descritos. En el documento de conformidad se identificarán las prestaciones verificadas y se consignarán las observaciones que deban atenderse antes de su aceptación.'
    : 'Los responsables de recepción identificarán los ítems entregados y cotejarán sus cantidades, características y estado con la orden de compra y la propuesta aceptada. El documento de recepción registrará el resultado de esa verificación por ítem. Cuando existan diferencias, se detallarán los bienes observados y el requisito correspondiente para su atención conforme a las condiciones contractuales.';
  return {antecedentes, justificacion, ambito, calidad, aceptacion};
}

export function developTdrDraft(draft: FixedDraft, adq: Adquisicion): void {
  const brief = availablePurchaseBrief(adq);
  const rows = draft.items.length || draft.editedItems ? draft.items : brief?.items || adq.items.map(row => ({
    descripcion:row.descripcion, especificaciones:row.especificacionMinima || row.caracteristicasTecnicas,
    cantidad:String(row.cantidad), unidad:row.unidad,
  }));
  const givenPurpose = clean(brief?.purpose) || clean(adq.justificacion_texto);
  const currentItems = rows.map(row => ({descripcion:row.descripcion || ''}));
  const previousItems = [...adq.items, {descripcion:adq.titulo_proceso}];
  const purpose = obsoletePurchaseMentions(givenPurpose, previousItems, currentItems).length ? '' : givenPurpose;
  const background = backgroundFromAttachment(adq,draft,rows);
  const narrative = buildTdrNarrative(adq, draft.fields.objeto, rows, purpose, background);
  for (const key of ['antecedentes','justificacion','ambito','calidad','aceptacion'] as const) {
    if (draft.editedFields?.includes(key) || draft.confirmedFields?.includes(key)) continue;
    const value = draft.fields[key] || '';
    if (draft.sourceIds[key]?.length && clean(value)) continue;
    const proposal = draft.proposals?.[key];
    const automatic = proposal?.value === value && (proposal.reason.startsWith('Redacción propuesta para completar el borrador.') || proposal.reason === narrativeReason);
    const copiedPurpose = key === 'justificacion' && !!brief && !adq.justificacion_texto && clean(value) === purpose && value.split(/\s+/).length < 45;
    const recorded = {antecedentes:adq.antecedentes_texto, justificacion:adq.justificacion_texto, ambito:adq.ambito_aplicacion,calidad:adq.calidad_texto,aceptacion:adq.aceptacion_lote}[key];
    if (clean(recorded) && clean(recorded) === clean(value)) continue;
    const shortGenerated = !!draft.consultedAt && (key === 'antecedentes' || key === 'justificacion') && value.split(/\s+/).length < 30;
    if (!automatic && !copiedPurpose && !shortGenerated && clean(value)) continue;
    let wording = narrative[key];
    let reason = narrativeReason;
    // Retain a short but specific sentence written by the model when developing it.
    // Edits by the operator and text entered in the acquisition itself take precedence.
    if (shortGenerated && !automatic && !copiedPurpose && clean(value) && !obsoletePurchaseMentions(value,previousItems,currentItems).length) {
      if (key === 'justificacion') wording = buildTdrNarrative(adq,draft.fields.objeto,rows,value).justificacion;
      else if (!background && !wording.includes(value.trim())) wording = sentence(value.trim()) + ' ' + wording;
      reason = 'Redacción de la IA desarrollada con las características del requerimiento.';
    }
    draft.fields[key] = wording;
    draft.proposals = {...draft.proposals, [key]: {value:wording,reason}};
  }
}
