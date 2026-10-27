import { NextRequest, NextResponse } from 'next/server';
import { assertPlan, evaluateQuotes, Quote } from '@/lib/procurement/selection';
import { suggestCriteria, readQuote } from '@/lib/server/quoteAssistant';
import { evaluationReport } from '@/lib/server/evaluationReport';
import { extractPurchaseAttachment } from '@/lib/server/extractText';
import { readPurchaseAttachments, cleanupPurchaseAttachments } from '@/lib/server/attachmentUploads';
import { prepareVisionImage } from '@/lib/server/visionImages';
import { MAX_VISION_IMAGES } from '@/lib/uploads/attachmentPolicy';
export const runtime='nodejs';
export const maxDuration=180;
export async function POST(req:NextRequest) {
  let attachmentForm:FormData|undefined,attachmentAcquisition='';
  try {
    const form=await req.formData(),raw=String(form.get('request')||'');if(raw.length>400000)throw Error('La evaluación es demasiado extensa.');
    attachmentForm=form;
    const body=JSON.parse(raw),plan=body.plan;
    attachmentAcquisition=typeof body.acquisitionId==='string'?body.acquisitionId:'';
    if(!plan||!Array.isArray(plan.groups))throw Error('Selecciona las reglas del TDR.');
    if(body.action==='suggest')return NextResponse.json(await suggestCriteria(plan,String(body.context||''),req.signal));
    assertPlan(plan,true);if(!plan.confirmedAt||!plan.revision)throw Error('Confirma las reglas antes de evaluar cotizaciones.');
    if(body.action==='read') {
      const attachmentSignal=AbortSignal.any([req.signal,AbortSignal.timeout(30_000)]);
      let context=String(body.context||'').slice(0,20000);const images:string[]=[],names:string[]=[];
      for await (const file of readPurchaseAttachments(form,attachmentAcquisition,attachmentSignal)){
        names.push(file.name);
        const data=Buffer.from(await file.arrayBuffer());
        if(/\.(jpe?g|png|webp)$/i.test(file.name)){
          if(images.length>=MAX_VISION_IMAGES)throw Error(`La lectura admite hasta ${MAX_VISION_IMAGES} fotos o páginas escaneadas.`);
          images.push(await prepareVisionImage(data,file.name));
        }else{
          const content=await extractPurchaseAttachment(data,file.name,MAX_VISION_IMAGES-images.length);
          context+=`\nARCHIVO ${file.name}:\n${content.text}`;images.push(...content.images);
        }
        if(context.length>60000)throw Error('La cotización es demasiado extensa. Adjunta solo sus páginas relevantes.');
      }
      attachmentSignal.throwIfAborted();
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
  }catch(e){return NextResponse.json({error:e instanceof Error&&e.name==='TimeoutError'?'La preparación de los archivos tardó demasiado. Los archivos seleccionados y la evaluación anterior se conservan; vuelve a intentar.':e instanceof Error?e.message:'No se pudo evaluar.'},{status:400});}
  finally{if(attachmentForm&&attachmentAcquisition)await cleanupPurchaseAttachments(attachmentForm,attachmentAcquisition).catch(()=>{});}
}
