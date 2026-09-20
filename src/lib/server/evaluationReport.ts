import { Document, Packer, Paragraph, Table, TableCell, TableLayoutType, TableRow, TextRun, WidthType } from 'docx';
import { evaluateQuotes, methodLabels, QuoteEvaluation } from '../procurement/selection';

export async function evaluationReport(title:string,evaluation:QuoteEvaluation) {
  const {plan,quotes}=evaluation,rows=evaluateQuotes(plan,quotes);
  const p=(text:string,bold=false)=>new Paragraph({children:[new TextRun({text,bold,font:'Arial',size:20})],spacing:{after:120},keepNext:bold});
  const table=(data:string[][])=>{
    const widths=data[0].length===6?[1700,1000,800,1300,800,3760]:[3300,1300,4760];
    return new Table({width:{size:9360,type:WidthType.DXA},columnWidths:widths,layout:TableLayoutType.FIXED,
      rows:data.map((cells,i)=>new TableRow({tableHeader:i===0,cantSplit:true,children:cells.map((text,j)=>new TableCell({
        width:{size:widths[j],type:WidthType.DXA},margins:{top:70,bottom:70,left:70,right:70},shading:i===0?{fill:'E8EEF5'}:undefined,
        children:text.split('\n').map(line=>new Paragraph({children:[new TextRun({text:line,bold:i===0,font:'Arial',size:19})],spacing:{after:70}}))
      }))}))});
  };
  const children:(Paragraph|Table)[]=[p('ENDE DEORURO S.A.',true),p('CUADRO COMPARATIVO DE COTIZACIONES',true),p(title),p(`Método: ${methodLabels[plan.method]}. Reglas confirmadas: ${plan.confirmedAt||'Sin confirmar'}.`),p('Resultado de apoyo a la evaluación. Requiere revisión del responsable; no constituye adjudicación automática.')];
  for(const group of plan.groups){const groupRows=rows.filter(r=>r.quote.groupId===group.id),best=groupRows.filter(r=>r.rank===1),incomplete=groupRows.some(r=>r.status==='pending');
    children.push(p(group.label,true),p(`Previsión de precio: ${group.referencePrice||'No consignada'} Bs.`),table([['Proveedor','Precio Bs','PP','ERA / PRA','PT','Resultado'],...groupRows.map(r=>[r.quote.provider,r.quote.price,r.pp===null?'—':r.pp.toFixed(2),r.era===null?'—':`${r.era.toFixed(2)} / ${r.pra!.toFixed(2)}`,r.total===null?'—':r.total.toFixed(2),`${r.rank?`Posición ${r.rank}. `:''}${r.reason}`])]),p(!groupRows.length?'Sin cotizaciones para esta unidad.':incomplete?'Comparación provisional: existen ofertas por verificar.':best.length>1?'Empate: requiere resolución documentada.':best.length===1?`Mejor resultado evaluado: ${best[0].quote.provider}.`:'No hay propuestas habilitadas.'));
    for(const row of groupRows){children.push(p(`Evidencia de ${row.quote.provider}`,true),p(`Fuente: ${row.quote.source}`),p(`Precio y alcance: ${row.quote.evidence.precio||'Consignado por el evaluador.'}`));for(const m of plan.minimums)children.push(p(`${m.label}: ${{yes:'Cumple',no:'No cumple',unknown:'Por verificar'}[row.quote.minimums[m.id]||'unknown']}. ${row.quote.evidence[m.id]||'Sin evidencia.'}`));if(plan.method==='calidad_precio')for(const c of plan.criteria){const l=c.levels.find(l=>l.id===row.quote.levels[c.id]);children.push(p(`${c.label} (${c.weight}%): ${l?`${l.label}, ${l.score} puntos`:'Por verificar'}. ${row.quote.evidence[c.id]||'Sin evidencia.'}`));}}
  }
  children.push(p('REGLAS UTILIZADAS EN ESTA COMPARACIÓN',true),p(`Versión: ${plan.revision}. Especialidad: ${plan.categoryDescription}.`));
  if(plan.method==='calidad_precio')children.push(
    p('Precio (P) y previsión (PvP) corresponden a la misma unidad, alcance, impuestos y moneda (Bs). Precio: 50 puntos máximos. Requisitos adicionales: 50 puntos máximos.'),
    p('P ≤ 0,8 × PvP: PP = 50. Entre 0,8 × PvP y 1,2 × PvP: PP = 50 × (3 − 2,5 × P / PvP). P > 1,2 × PvP: descalificación.'),
    p('ERA = suma de (puntaje del nivel × ponderación / 100). PRA = ERA × 0,50. PT = PP + PRA. Sin redondeos intermedios; total presentado con dos decimales. Los empates requieren resolución documentada.'),
    table([['Criterio adicional','Ponderación','Escala fijada'],...plan.criteria.map(c=>[c.label,`${c.weight} %`,c.levels.map(l=>`${l.label}: ${l.score} puntos`).join('\n')])])
  );
  else children.push(p('Se ordenan por menor precio las ofertas revisadas que cumplen los requisitos mínimos. Los empates requieren resolución documentada.'));
  return Packer.toBuffer(new Document({sections:[{children}]}));
}
