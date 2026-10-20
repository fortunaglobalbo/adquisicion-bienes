import type { Adquisicion } from '@/types';
import { administrativeDefaults, requestNumber, hasAdministrativeValue } from '../docx/administrativeDefaults';

export type ComparativeDocumentKind='request'|'offer'|'other';
export interface ComparativeSource {id:string;fileName:string;kind:ComparativeDocumentKind;evidence:string}
export interface ComparativeItem {description:string;quantity:string;unit:string;unitPrice:string;subtotal:string;specifications:string;sourceId:string}
export interface ComparativeCheck {status:'unknown'|'verified'|'not_met';evidence:string}
export interface ComparativeSupplier {
  id:string;name:string;kind:'request'|'offer';sourceIds:string[];
  requestDate:string;quoteDate:string;quoteNumber:string;currency:string;total:string;
  delivery:string;validity:string;payment:string;items:ComparativeItem[];
  checks:{technical:ComparativeCheck;administrative:ComparativeCheck};
  scopeCompatibility:'compatible'|'different'|'unknown';warnings:string[];
}
export interface ComparativeReport {revision:string;updatedAt:string;sources:ComparativeSource[];suppliers:ComparativeSupplier[];warnings:string[]}
export interface ComparativeData {fields:Record<string,string>;items:Record<string,string>[];revision:string;warnings:string[];summary:string}
export type ComparativeAcquisition=Adquisicion&{comparative_report?:ComparativeReport};
export const comparativeSnapshot=(adq:Adquisicion)=>JSON.stringify({title:adq.titulo_proceso,items:adq.items.map(item=>[item.descripcion,item.cantidad,item.unidad]),budget:adq.prevision_presupuesto,method:adq.selection_plan?.confirmedAt?adq.selection_plan.method:''});

const safe=(value:unknown,max=3000)=>typeof value==='string'?value.trim().slice(0,max):'';
const unique=(values:string[])=>Array.from(new Set(values.filter(Boolean)));
const round=(value:number)=>Math.round((value+Number.EPSILON)*100)/100;
export function comparativeNumber(value:unknown):string {
  if(typeof value==='number')return Number.isFinite(value)&&value>0&&value<=1e12&&Math.abs(value*100-Math.round(value*100))<1e-5?String(value):'';
  let input=safe(value,80).replace(/^(?:Bs\.?|BOB)\s*/i,'').replace(/\s*(?:Bs\.?|BOB)$/i,'').trim();
  if(/^\d{1,3}(?:[. ]\d{3})+,\d{1,2}$/.test(input))input=input.replace(/[. ]/g,'').replace(',','.');
  else if(/^\d{1,3}(?:[, ]\d{3})+\.\d{1,2}$/.test(input))input=input.replace(/[, ]/g,'');
  else if(/^\d+(?:[.,]\d{1,2})?$/.test(input))input=input.replace(',','.');
  else return '';
  const number=Number(input);return Number.isFinite(number)&&number>0&&number<=1e12?String(number):'';
}
export function comparativeDate(value:unknown):string {
  const raw=safe(value,30);let year=0,month=0,day=0;
  let match=raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(match){year=Number(match[1]);month=Number(match[2]);day=Number(match[3]);}
  else {match=raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/);if(!match)return '';day=Number(match[1]);month=Number(match[2]);year=Number(match[3]);if(year<100)year+=2000;}
  const date=new Date(Date.UTC(year,month-1,day));
  return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day?`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`:'';
}
const displayDate=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)?value.split('-').reverse().join('/'):'sin fecha visible';
const currency=(value:unknown)=>/^(?:BOB|Bs\.?|Bolivianos?)$/i.test(safe(value))?'BOB':safe(value,25);
const money=(value:string,code='BOB')=>value?`${Number(value).toLocaleString('es-BO',{minimumFractionDigits:2,maximumFractionDigits:2})} ${code==='BOB'?'Bs':code||'(moneda no identificada)'}`:'Sin importe acreditado';
const words=(value:string)=>(value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().match(/[a-z]{4,}/g)||[]).filter(word=>!['adquisicion','compra','equipo','equipos','instrumento','instrumentos','seguridad','industrial','personal','portatil','digital','unidad','unidades','profesional','servicio','servicios','medicion','para','ende','deoruro'].includes(word));
const unitKey=(value:string)=>{
  const normalized=value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/[.\s]/g,'');
  return /^(?:pza|pzas|pieza|piezas|unidad|unidades|und|unid)$/.test(normalized)?'pza':/^(?:par|pares)$/.test(normalized)?'par':normalized;
};
export function compareScope(adq:Adquisicion,items:ComparativeItem[]):'compatible'|'different'|'unknown' {
  const requested=(adq.items||[]).filter(item=>item.descripcion?.trim());if(!requested.length||!items.length)return 'unknown';
  const all=items.map(item=>new Set(words(item.description).map(word=>word.slice(0,6))));
  const matched=requested.filter(item=>{const anchor=words(item.descripcion)[0];return anchor&&all.some(set=>set.has(anchor.slice(0,6)));}).length;
  if(matched===requested.length&&requested.length===items.length){
    const available=new Set(items.map((_item,index)=>index));
    const exact=requested.every(item=>{
      const anchor=words(item.descripcion)[0]?.slice(0,6);
      const match=Array.from(available).find(index=>anchor&&all[index].has(anchor)&&comparativeNumber(item.cantidad)===items[index].quantity&&!!unitKey(item.unidad)&&unitKey(item.unidad)===unitKey(items[index].unit));
      if(match===undefined)return false;available.delete(match);return true;
    });
    if(exact)return 'compatible';
  }
  return matched===0?'different':'unknown';
}

/** Normalize an extraction, retaining unknown amounts and preventing requests from becoming offers. */
export function normalizeComparativeReport(raw:any,sources:ComparativeSource[],adq:Adquisicion,now=new Date()):ComparativeReport {
  for(let depth=0;depth<3&&raw&&typeof raw==='object'&&!Array.isArray(raw)&&!Array.isArray(raw.suppliers);depth++)raw=raw.result||raw.data||raw;
  if(!raw||!Array.isArray(raw.suppliers)||!raw.suppliers.length||raw.suppliers.length>20)throw Error('No se pudieron identificar los proveedores y sus documentos. Los archivos anteriores se conservan.');
  const warnings:string[]=[];const sourceIds=new Set(sources.map(source=>source.id));let totalItems=0;
  const suppliers:ComparativeSupplier[]=raw.suppliers.map((supplier:any,index:number)=>{
    const name=safe(supplier?.name,300);if(!name)throw Error('Una empresa no pudo identificarse. Adjunta una imagen más legible.');
    const refs=Array.isArray(supplier.sourceIds)?unique(supplier.sourceIds.filter((id:unknown):id is string=>typeof id==='string'&&sourceIds.has(id))):[];
    if(!refs.length)throw Error(`No se identificó el archivo que respalda a ${name}. Vuelve a adjuntar el documento legible.`);
    const visibleSource=refs.map(id=>sources.find(source=>source.id===id)?.evidence||'').join(' ');
    const hasEconomicValue=!!comparativeNumber(supplier.total)||(Array.isArray(supplier.items)&&supplier.items.some((item:any)=>comparativeNumber(item?.unitPrice)||comparativeNumber(item?.subtotal)));
    const requestWithoutPrices=/solicitud\s+(?:de\s+)?cotizaci[oó]n/i.test(visibleSource)&&!hasEconomicValue;
    const kind=supplier.kind==='request'||requestWithoutPrices?'request':supplier.kind==='offer'?'offer':null;
    if(!kind)throw Error(`No se pudo distinguir si el documento de ${name} es una solicitud o una oferta.`);
    const ownWarnings:string[]=[];
    if(!Array.isArray(supplier.items)||supplier.items.length>100)throw Error(`Revisa los ítems leídos para ${name} (máximo 100).`);
    totalItems+=supplier.items.length;if(totalItems>100)throw Error('La consulta contiene más de 100 filas de bienes. Divide los archivos.');
    const items:ComparativeItem[]=supplier.items.map((row:any)=>{
      const quantity=comparativeNumber(row?.quantity),unitPrice=kind==='offer'?comparativeNumber(row?.unitPrice):'',subtotal=kind==='offer'?comparativeNumber(row?.subtotal):'';
      const description=safe(row?.description,1000);if(!description)throw Error(`No se pudo identificar un ítem de ${name}. Adjunta una imagen más legible.`);
      if(!quantity)ownWarnings.push(`Revisar la cantidad de «${description}»: no está acreditada de forma inequívoca.`);
      if(!safe(row?.unit,50))ownWarnings.push(`Revisar la unidad de medida de «${description}».`);
      if(kind==='offer'&&row?.unitPrice&&!unitPrice)ownWarnings.push(`Revisar el precio unitario de «${description}»: no se pudo normalizar sin suponer separadores.`);
      if(kind==='offer'&&row?.subtotal&&!subtotal)ownWarnings.push(`Revisar el subtotal de «${description}»: la notación no es inequívoca.`);
      if(quantity&&unitPrice&&subtotal&&Math.abs(round(Number(quantity)*Number(unitPrice))-Number(subtotal))>0.02)ownWarnings.push(`El subtotal de «${description}» no coincide con cantidad por precio unitario; se conserva el importe visible sin corregirlo.`);
      const sourceId=refs.includes(row?.sourceId)?row.sourceId:refs.length===1?refs[0]:'';
      if(!sourceId)ownWarnings.push(`Revisar el archivo de origen del ítem «${description}»: hay varios antecedentes sin una atribución inequívoca.`);
      return {description,quantity,unit:safe(row?.unit,50),unitPrice,subtotal,specifications:safe(row?.specifications,3000),sourceId};
    });
    const total=kind==='offer'?comparativeNumber(supplier.total):'';
    if(kind==='offer'&&!total)ownWarnings.push('No hay un total económico inequívoco acreditado para esta oferta.');
    if(kind==='offer'&&total&&(!items.length||items.some(item=>!item.subtotal)))ownWarnings.push('El total visible no puede verificarse contra todos los subtotales, porque faltan importes de las filas. No se calculan importes ausentes.');
    if(kind==='offer'&&total&&items.length&&items.every(item=>!!item.subtotal)&&Math.abs(round(items.reduce((sum,item)=>sum+Number(item.subtotal),0))-Number(total))>0.02)ownWarnings.push('La suma de subtotales no coincide con el total visible; revisar descuentos, impuestos o transcripción antes de comparar.');
    const code=currency(supplier.currency);if(kind==='offer'&&!code)ownWarnings.push('La moneda no está identificada; no se convierte ni se compara como Bolivianos.');
    if(kind==='offer'&&code&&code!=='BOB')ownWarnings.push('La oferta está expresada en otra moneda; no se convierte sin tipo de cambio documentado.');
    const check=(key:string):ComparativeCheck=>({status:'unknown',evidence:safe(supplier.checks?.[key]?.evidence,1800)});
    const scopeCompatibility=compareScope(adq,items);if(scopeCompatibility==='different')ownWarnings.push('Los bienes de este documento no coinciden con los ítems del expediente. Se conservan separados; revisa que corresponda a esta compra.');
    if(scopeCompatibility==='unknown')ownWarnings.push('La equivalencia completa de bienes, cantidades y unidades con el expediente no está acreditada; no se compara este total con su presupuesto.');
    const quoteDate=kind==='offer'?comparativeDate(supplier.quoteDate):'';
    const requestDate=comparativeDate(supplier.requestDate||(requestWithoutPrices?supplier.quoteDate:''));
    if(kind==='offer'&&supplier.quoteDate&&!quoteDate)ownWarnings.push('La fecha de oferta no pudo identificarse inequívocamente.');
    return {id:`supplier-${index+1}`,name,kind,sourceIds:refs,requestDate,quoteDate,quoteNumber:kind==='offer'?safe(supplier.quoteNumber,100):'',currency:kind==='offer'?code:'',total,
      delivery:kind==='offer'?safe(supplier.delivery,1000):'',validity:kind==='offer'?safe(supplier.validity,1000):'',payment:kind==='offer'?safe(supplier.payment,1000):'',items,
      checks:{technical:check('technical'),administrative:check('administrative')},scopeCompatibility,warnings:unique(ownWarnings)};
  });
  const mappedSources=sources.map(source=>({...source,kind:suppliers.some(supplier=>supplier.kind==='offer'&&supplier.sourceIds.includes(source.id))?'offer' as const:suppliers.some(supplier=>supplier.sourceIds.includes(source.id))?'request' as const:source.kind}));
  return {revision:crypto.randomUUID(),updatedAt:now.toISOString(),sources:mappedSources,suppliers,warnings:unique(warnings)};
}

/** Paragraphs describe the documentary situation; they never turn a quotation into an award. */
export function buildComparativeReport(adq:ComparativeAcquisition,data:ComparativeReport|undefined=adq.comparative_report):ComparativeData {
  const admin=administrativeDefaults(adq),roles=adq.responsables_oficiales?.['3']||{};
  const first=(...values:unknown[])=>values.find(hasAdministrativeValue)?.trim()||'';
  const fields:Record<string,string>={fecha:new Intl.DateTimeFormat('es-BO',{timeZone:'America/La_Paz',day:'numeric',month:'long',year:'numeric'}).format(new Date()),numero:adq.codigo,solicitud:requestNumber(adq),objeto:adq.titulo_proceso,
    destinatario:first(roles.destinatario,'Lic. MIGUEL ANGEL MAMANI CAMACHO\nSUPERINTENDENCIA DE ADMINISTRACIÓN & FINANZAS'),via:first(roles.via,'Lic. RAÚL ALBERTO TORRICO GÓMEZ\nGERENTE GENERAL'),solicitante:first(roles.solicitante,[admin.solicitante,admin.cargo].filter(Boolean).join('\n'),'TATIANA TORRES ANDRADE\nAPOYO A GERENCIA EN SEGURIDAD INDUSTRIAL'),
    antecedentes:`El presente cuadro comparativo corresponde al proceso «${adq.titulo_proceso}», solicitud ${requestNumber(adq)}${adq.unidad_solicitante?`, promovido por ${adq.unidad_solicitante}`:''}. Su objeto es ordenar los antecedentes de solicitud y las ofertas efectivamente aportadas, distinguir la información comercial de la verificación de requisitos y sustentar la continuación del trámite con datos comprobables.`,
    recepcion:'No se han incorporado solicitudes ni ofertas para este cuadro comparativo.',evaluacion:'La comparación económica y la revisión de requisitos se realizarán sobre las ofertas documentadas. No existe un resultado de adjudicación.',conclusiones:'La documentación disponible todavía no permite establecer una propuesta recomendada.',recomendaciones:'Incorporar las solicitudes y ofertas recibidas, verificar su correspondencia con el requerimiento y documentar el cumplimiento de las condiciones de esta adquisición antes de elevar una recomendación.'};
  if(!data)return {fields,items:[],revision:'',warnings:[],summary:'Sube las solicitudes y ofertas para preparar el cuadro comparativo.'};
  // An expediente can change after the files were read. Recheck its current scope instead
  // of reusing the old classification to compare prices against a different purchase.
  const suppliers=data.suppliers.map(supplier=>{
    const scopeCompatibility=compareScope(adq,supplier.items);
    const ownWarnings=(supplier.warnings||[]).filter(warning=>!warning.startsWith('Los bienes de este documento no coinciden')&&!warning.startsWith('La equivalencia completa de bienes, cantidades y unidades')&&!warning.startsWith('El alcance del expediente cambió'));
    if(scopeCompatibility==='different')ownWarnings.push('Los bienes de este documento no coinciden con los ítems actuales del expediente. Se conservan separados; revisa que corresponda a esta compra.');
    if(scopeCompatibility==='unknown')ownWarnings.push('La equivalencia completa de bienes, cantidades y unidades con el expediente actual no está acreditada; no se compara este total con su presupuesto.');
    if(scopeCompatibility!==supplier.scopeCompatibility)ownWarnings.push('El alcance del expediente cambió respecto de la lectura de este documento. Se revisó la correspondencia con los ítems actuales sin modificar el antecedente guardado.');
    return {...supplier,scopeCompatibility,warnings:unique(ownWarnings)};
  });
  const offers=suppliers.filter(supplier=>supplier.kind==='offer'),requests=suppliers.filter(supplier=>supplier.kind==='request');
  const warnings=unique([...(data.warnings||[]),...suppliers.flatMap(supplier=>supplier.warnings||[])]);
  const dated=suppliers.map(supplier=>`${supplier.name}: ${supplier.kind==='offer'?`oferta${supplier.quoteNumber?' N.º '+supplier.quoteNumber:''} de ${displayDate(supplier.quoteDate)}`:`solicitud de cotización de ${displayDate(supplier.requestDate)}`}`).join('; ');
  fields.recepcion=`Se revisaron ${data.sources.length} archivos correspondientes a ${suppliers.length} proveedores: ${dated}. ${requests.length?`Para ${requests.map(supplier=>supplier.name).join(' y ')} solo se adjuntaron solicitudes de cotización; estos documentos no contienen una propuesta económica y no acreditan por sí mismos que no se haya respondido, que exista presentación fuera de plazo o que corresponda una descalificación.`:''} Las fechas señaladas son las visibles en los documentos y no acreditan la fecha de recepción por la entidad.`;
  const method=adq.selection_plan?.confirmedAt?(adq.selection_plan.method==='calidad_precio'?'Calidad y Precio':'Menor precio'):'';
  const priced=offers.filter(supplier=>supplier.total&&supplier.currency==='BOB');
  let economic=offers.map(supplier=>{
    const detail=supplier.items.map((item,index)=>`${index+1}. ${item.description}: ${item.quantity||'cantidad no determinada'} ${item.unit||'unidad por verificar'}${item.unitPrice?`, precio unitario ${money(item.unitPrice,supplier.currency)}`:''}${item.subtotal?`, subtotal ${money(item.subtotal,supplier.currency)}`:''}.`).join('\n');
    const total=supplier.total?`El total visible es de ${money(supplier.total,supplier.currency)}.`:'El total no está acreditado de forma inequívoca.';
    const conditions=[supplier.delivery?`Entrega ofrecida: ${supplier.delivery}.`:'',supplier.validity?`Validez comercial: ${supplier.validity}.`:'',supplier.payment?`Pago ofrecido: ${supplier.payment}.`:''].filter(Boolean).join(' ');
    const budgetDifference=supplier.scopeCompatibility==='compatible'&&supplier.currency==='BOB'&&supplier.total&&adq.prevision_presupuesto>0&&!supplier.warnings.some(warning=>/subtotal|subtotales|cantidad|unidad de medida|total económico/.test(warning))?round(adq.prevision_presupuesto-Number(supplier.total)):null;
    const budgetContrast=budgetDifference===null?'':budgetDifference===0?'El total coincide con la previsión de precio registrada.':`El total ${budgetDifference>0?'es inferior a':'supera'} la previsión de precio en ${money(String(Math.abs(budgetDifference)))}; esta relación no acredita aprobación presupuestaria ni habilitación de la oferta.`;
    return `${supplier.name}${supplier.quoteDate?`, oferta de ${displayDate(supplier.quoteDate)}`:''}: ${total}\n${detail}${conditions?'\n'+conditions:''}${budgetContrast?'\n'+budgetContrast:''}${supplier.warnings.length?'\nObservaciones de lectura: '+supplier.warnings.join(' '):''}`;
  }).join('\n\n');
  if(economic.length>11000){
    economic=offers.map(supplier=>`${supplier.name.slice(0,160)}: ${supplier.total?`total visible ${money(supplier.total,supplier.currency)}`:'total no acreditado'}. ${supplier.items.length} ítems. Fuente: ${supplier.sourceIds.map(id=>data.sources.find(source=>source.id===id)?.fileName||id).join(', ').slice(0,180)}.${supplier.warnings.length?' Se registran observaciones de lectura que deben revisarse antes de comparar.':''}`).join('\n\n')+'\n\nEl desglose íntegro de cantidades, precios por ítem y condiciones comerciales se conserva en los archivos fuente y en los datos de esta comparación; se resume aquí para mantener legible el informe.';
    warnings.push('Por la extensión del detalle, el informe resume los totales por proveedor. Los ítems y condiciones íntegros se conservan en los archivos fuente y en los datos de la comparación.');
  }
  const compatible=offers.filter(supplier=>supplier.scopeCompatibility==='compatible');
  const anyDifferent=suppliers.some(supplier=>supplier.scopeCompatibility==='different');
  const budget=adq.prevision_presupuesto>0?`La previsión de precio registrada en el expediente es de ${money(String(adq.prevision_presupuesto))}; solo puede contrastarse con ofertas del mismo alcance.`:'No se ha utilizado un presupuesto supuesto para la comparación.';
  fields.evaluacion=`${economic||'No se adjuntó una oferta económica que permita comparar precios.'}\n\n${budget} ${method?`El método confirmado para el expediente es ${method}; su aplicación requiere verificar los requisitos y la evidencia previstos en el TDR.`:'No se infiere un método de selección a partir del precio o del número de archivos.'} La lectura de la descripción comercial no acredita por sí sola cumplimiento técnico, NIT, registro de proveedores, habilitación ni otras condiciones administrativas. Estas verificaciones se mantienen sin resultado hasta contar con su respaldo. ${anyDifferent?'Existen documentos cuyos bienes no coinciden con el expediente; sus importes no deben trasladarse a la evaluación de esta compra.':''}`;
  fields.conclusiones=offers.length===0?'Los antecedentes aportados son solicitudes de cotización. Al no existir una oferta económica adjunta, no es posible establecer un precio comparado ni recomendar proveedor.':offers.length===1?`Se identificó una sola oferta económica documentada, correspondiente a ${offers[0].name}${offers[0].total?`, por ${money(offers[0].total,offers[0].currency)}`:''}. Las solicitudes dirigidas a otros proveedores no constituyen ofertas de precio cero ni propuestas rechazadas. La documentación disponible permite registrar esta oferta; aún no permite afirmar que sea la más conveniente ni recomendar una adjudicación, porque no se ha acreditado la evaluación técnica y administrativa${anyDifferent?' y debe resolverse la diferencia de alcance detectada':''}.`:`Se identificaron ${offers.length} ofertas económicas documentadas${priced.length?`, de las cuales ${priced.length} presentan un total en Bolivianos` :''}. La comparación deberá considerar únicamente propuestas del mismo alcance y con requisitos verificados; la tabla no constituye una adjudicación. ${compatible.length!==offers.length?'La correspondencia de todos los bienes con el expediente requiere revisión.':''}`;
  fields.recomendaciones=`Continuar con la verificación de las ofertas efectivamente recibidas y su correspondencia con las especificaciones, cantidades y condiciones del TDR. Documentar el resultado de los requisitos técnicos y administrativos aplicables${method?` y aplicar el método confirmado de ${method}`:''}. ${requests.length?'Completar el respaldo de las respuestas de los proveedores a quienes se solicitó cotización; si se establece un plazo, registrar su comunicación y la recepción correspondiente. ':''}${anyDifferent?'Corregir la asociación de los documentos cuyo alcance es distinto antes de utilizar sus importes. ':''}Elevar una recomendación de selección solo cuando el resultado esté sustentado; este cuadro conserva la situación documental actual sin declarar proveedor adjudicado.`;
  const items=suppliers.map((supplier,index)=>({numero:String(index+1),empresa:supplier.name,cotizacion:supplier.kind==='request'?`Solicitud de cotización — ${displayDate(supplier.requestDate)}. Sin oferta económica adjunta.`:`Oferta${supplier.quoteNumber?' N.º '+supplier.quoteNumber:''} — ${displayDate(supplier.quoteDate)}. ${supplier.items.length} ítems.`,precio:supplier.kind==='request'?'Sin oferta económica':money(supplier.total,supplier.currency),respaldo:[supplier.kind==='request'?'La solicitud no prueba falta de respuesta ni incumplimiento.':'Cumplimiento técnico y administrativo sin verificar.',supplier.scopeCompatibility==='different'?'Alcance distinto del expediente actual.':supplier.scopeCompatibility==='unknown'?'Alcance, cantidades o unidades por verificar contra el expediente actual.':'',...supplier.sourceIds.map(id=>data.sources.find(source=>source.id===id)?.fileName||'')].filter(Boolean).join('\n')}));
  const summary=`${suppliers.length} proveedores: ${offers.length} ${offers.length===1?'oferta económica':'ofertas económicas'} y ${requests.length} ${requests.length===1?'solicitud sin oferta económica adjunta':'solicitudes sin oferta económica adjunta'}.`;
  return {fields,items,revision:data.revision,warnings,summary};
}
