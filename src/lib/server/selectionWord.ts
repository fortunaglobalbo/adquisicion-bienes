import JSZip from 'jszip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { assertPlan, awardLabels, SelectionPlan } from '../procurement/selection';

const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const escape=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const paragraph=(text:string,bold=false)=>`<w:p><w:pPr><w:spacing w:after="100"/>${bold?'<w:keepNext/>':''}</w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="20"/>${bold?'<w:b/>':''}</w:rPr><w:t xml:space="preserve">${escape(text)}</w:t></w:r></w:p>`;
const table=(headers:string[],rows:string[][])=>`<w:tbl><w:tblPr><w:tblW w:w="9000" w:type="dxa"/><w:tblBorders>${['top','left','bottom','right','insideH','insideV'].map(side=>`<w:${side} w:val="single" w:sz="4" w:color="808080"/>`).join('')}</w:tblBorders></w:tblPr><w:tblGrid>${headers.map(()=>`<w:gridCol w:w="${Math.floor(9000/headers.length)}"/>`).join('')}</w:tblGrid>${[headers,...rows].map((row,i)=>`<w:tr><w:trPr><w:cantSplit/>${i===0?'<w:tblHeader/>':''}</w:trPr>${row.map(cell=>`<w:tc><w:tcPr><w:tcW w:w="${Math.floor(9000/headers.length)}" w:type="dxa"/>${i===0?'<w:shd w:fill="E8EEF5"/>':''}</w:tcPr>${cell.split('\n').map(line=>paragraph(line,i===0)).join('')}</w:tc>`).join('')}</w:tr>`).join('')}</w:tbl>`;

export async function addSelectionTables(buffer:Buffer,plan:SelectionPlan):Promise<Buffer> {
  assertPlan(plan,plan.method==='calidad_precio');
  const zip=await JSZip.loadAsync(buffer),xml=new DOMParser().parseFromString(await zip.file('word/document.xml')!.async('string'),'text/xml');
  const body=xml.getElementsByTagNameNS(W,'body')[0];
  // The index repeats section titles. Insert before the actual body heading, after the item table.
  const anchor=Array.from(body.childNodes).filter(n=>(n as Element).localName==='p'&&/^4\.\s*CALIDAD/i.test(Array.from((n as Element).getElementsByTagNameNS(W,'t')).map(t=>t.textContent).join('').trim())).pop();
  if(!anchor)throw Error('No se encontró la sección Calidad para insertar las tablas de evaluación.');
  let block=paragraph('3.2. REQUISITOS MÍNIMOS Y UNIDADES DE ADJUDICACIÓN',true)
    +paragraph('Se verificará cada requisito mínimo mediante Cumple / No cumple. El incumplimiento de un requisito mínimo excluye la propuesta de la evaluación de esa unidad.')
    +table(['N.º','Requisito mínimo'],plan.minimums.map((m,i)=>[String(i+1),m.label]))
    +paragraph(`Evaluación y adjudicación por ${awardLabels[plan.awardMode]}.`)
    +table(['Unidad de adjudicación','Ítems incluidos','Previsión de precio (Bs)'],plan.groups.map(g=>[g.label,(g.itemLabels||[g.label]).join('\n'),g.referencePrice||'No consignada']));
  if(plan.method==='calidad_precio')block+=paragraph('3.3. MÉTODO DE EVALUACIÓN: CALIDAD Y PRECIO',true)
    +paragraph('P es el precio total ofertado para la unidad evaluada. PvP es la previsión de precio de esa misma unidad, en Bolivianos y sobre la misma base de impuestos y alcance. Se aplican 50 puntos máximos por precio y 50 por requisitos adicionales.')
    +paragraph('Si P ≤ 0,8 × PvP: PP = 50. Si 0,8 × PvP < P ≤ 1,2 × PvP: PP = 50 × (3 − 2,5 × P / PvP). Si P > 1,2 × PvP: la propuesta queda descalificada.')
    +paragraph('ERA = suma de (puntaje del nivel alcanzado × ponderación / 100). PRA = ERA × 0,50. PT = PP + PRA. El máximo es 100 puntos. Se calcula sin redondeos intermedios y se presenta el puntaje total con dos decimales. Será seleccionada la propuesta habilitada de mayor PT. Los empates requieren resolución documentada; no se aplicará un desempate automático.')
    +table(['Criterio adicional','Niveles y puntajes','Ponderación'],plan.criteria.map(c=>[c.label,c.levels.map(l=>`${l.label}: ${l.score} puntos`).join('\n'),`${c.weight} %`]))
    +paragraph('La ausencia de evidencia se somete a verificación; no equivale automáticamente a cumplimiento ni a un puntaje de cero. Las escalas y ponderaciones se fijan antes de comparar ofertas.');
  const fragment=new DOMParser().parseFromString(`<w:body xmlns:w="${W}">${block}</w:body>`,'text/xml');
  for(const child of Array.from(fragment.documentElement.childNodes))body.insertBefore(xml.importNode(child,true),anchor);
  // Keep section headings with their following text after inserting the evaluation tables.
  for(const node of Array.from(body.childNodes)) {
    const element=node as Element;
    if(element.localName!=='p')continue;
    const text=Array.from(element.getElementsByTagNameNS(W,'t')).map(t=>t.textContent).join('').trim();
    if(!/^\d{1,2}\.\s+[A-ZÁÉÍÓÚÑ\s/]+$/.test(text))continue;
    let props=element.getElementsByTagNameNS(W,'pPr')[0];
    if(!props){props=xml.createElementNS(W,'w:pPr');element.insertBefore(props,element.firstChild);}
    if(!props.getElementsByTagNameNS(W,'keepNext').length)props.appendChild(xml.createElementNS(W,'w:keepNext'));
  }
  if(plan.profile==='mantenimiento_higiene')for(const text of Array.from(body.getElementsByTagNameNS(W,'t'))) {
    if(text.textContent?.includes('DESCRIPCIÓN DEL BIEN'))text.textContent=text.textContent.replace('DESCRIPCIÓN DEL BIEN','DESCRIPCIÓN DEL SERVICIO');
  }
  zip.file('word/document.xml',new XMLSerializer().serializeToString(xml));
  const settingsFile=zip.file('word/settings.xml');
  if(settingsFile){
    const settings=new DOMParser().parseFromString(await settingsFile.async('string'),'text/xml');
    let compat=settings.getElementsByTagNameNS(W,'compat')[0];
    if(!compat){compat=settings.createElementNS(W,'w:compat');settings.documentElement.appendChild(compat);}
    if(!compat.getElementsByTagNameNS(W,'doNotExpandShiftReturn').length)compat.appendChild(settings.createElementNS(W,'w:doNotExpandShiftReturn'));
    zip.file('word/settings.xml',new XMLSerializer().serializeToString(settings));
  }
  return zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
}
