import { NextRequest, NextResponse } from 'next/server';
import { assertPlan, evaluateQuotes, Quote } from '@/lib/procurement/selection';
import { suggestCriteria, readQuote } from '@/lib/server/quoteAssistant';
import { evaluationReport } from '@/lib/server/evaluationReport';
import { extractText } from '@/lib/server/extractText';
export const runtime='nodejs';
export const maxDuration=120;
export async function POST(req:NextRequest) {
  try {
    const form=await req.formData(),raw=String(form.get('request')||'');if(raw.length>400000)throw Error('La evaluación es demasiado extensa.');
    const body=JSON.parse(raw),plan=body.plan;
    if(!plan||!Array.isArray(plan.groups))throw Error('Selecciona las reglas del TDR.');
    if(body.action==='suggest')return NextResponse.json(await suggestCriteria(plan,String(body.context||''),req.signal));
    assertPlan(plan,true);if(!plan.confirmedAt||!plan.revision)throw Error('Confirma las reglas antes de evaluar cotizaciones.');
    if(body.action==='read') {
      let context=String(body.context||'').slice(0,20000),size=0;const images:string[]=[],names:string[]=[];const files=form.getAll('attachments');
      if(files.length>3)throw Error('Adjunta hasta tres archivos de un mismo proveedor.');
      for(const file of files){if(!(file instanceof File)||! /\.(pdf|docx|txt|jpe?g|png|webp)$/i.test(file.name))throw Error('Usa PDF, Word, TXT, JPG, PNG o WebP.');
        size+=file.size;if(size>3*1024*1024)throw Error('Los archivos deben pesar hasta 3 MB en total.');names.push(file.name);
        const data=Buffer.from(await file.arrayBuffer());
        if(/\.(jpe?g|png|webp)$/i.test(file.name)){const mime=data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':data[0]===255&&data[1]===216&&data[2]===255?'image/jpeg':data.subarray(0,4).toString()==='RIFF'&&data.subarray(8,12).toString()==='WEBP'?'image/webp':null;if(!mime)throw Error('La imagen no tiene un formato válido.');images.push(`data:${mime};base64,${data.toString('base64')}`);}
        else context+=`\nARCHIVO ${file.name}:\n${await extractText(data,file.name)}`;
      }
      if(!context.trim()&&!images.length)throw Error('Adjunta una cotización o pega su texto.');
      if(context.length>60000)throw Error('La cotización es demasiado extensa. Adjunta solo sus páginas relevantes.');
      const quote=await readQuote(plan,String(body.groupId||''),context,images,req.signal);quote.source=names.join(', ')||'Texto aportado por el usuario';
      return NextResponse.json({quote});
    }
    if(!Array.isArray(body.quotes)||body.quotes.length>100)throw Error('La comparación admite hasta 100 ofertas.');
    const quotes:Quote[]=body.quotes;
    if(quotes.some(q=>!q||typeof q.id!=='string'||!q.id||typeof q.groupId!=='string'||typeof q.source!=='string'||typeof q.provider!=='string'||typeof q.price!=='string'||!q.minimums||!q.levels||!q.evidence||Object.values(q.evidence).some(v=>typeof v!=='string')||typeof q.reviewed!=='boolean')||new Set(quotes.map(q=>q.id)).size!==quotes.length)throw Error('Revisa los datos de las cotizaciones.');
    if(body.action==='export'&&!quotes.length)throw Error('Añade una cotización antes de descargar la comparación.');
    const rows=evaluateQuotes(plan,quotes);
    if(body.action==='export'){const buffer=await evaluationReport(String(body.title||'').slice(0,1000),{plan,quotes,updatedAt:new Date().toISOString()});return new Response(new Uint8Array(buffer),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','Content-Disposition':'attachment; filename="Cuadro_comparativo.docx"','Cache-Control':'no-store'}});}
    if(body.action!=='calculate')throw Error('Acción desconocida.');
    return NextResponse.json({rows},{headers:{'Cache-Control':'no-store'}});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'No se pudo evaluar.'},{status:400});}
}
