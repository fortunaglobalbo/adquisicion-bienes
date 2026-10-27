import { NextRequest, NextResponse } from 'next/server';
import type { Adquisicion } from '@/types';
import { extractPurchaseAttachment } from '@/lib/server/extractText';
import { readComparativeDocuments, createComparativeDraft, comparativeReportData, ComparativeInput } from '@/lib/server/comparativeReport';
import { companyKnowledge } from '@/lib/server/companyKnowledge';
import { readPurchaseAttachments, cleanupPurchaseAttachments } from '@/lib/server/attachmentUploads';
import { prepareVisionImage } from '@/lib/server/visionImages';
import { MAX_ATTACHMENT_FILES, MAX_VISION_IMAGES } from '@/lib/uploads/attachmentPolicy';

export const runtime='nodejs';
export const maxDuration=180;
export async function POST(req:NextRequest){
  let attachmentForm:FormData|undefined,attachmentAcquisition='';
  try{
    const form=await req.formData(),request=String(form.get('request')||'{}');
    attachmentForm=form;
    if(request.length>500000)throw Error('El expediente es demasiado extenso.');
    const body=JSON.parse(request),adq:Adquisicion=body.adquisicion;
    attachmentAcquisition=adq?.id||'';
    if(!adq?.id||!adq.titulo_proceso||!Array.isArray(adq.items))throw Error('Selecciona un expediente válido.');
    companyKnowledge(adq.empresa_id||'ende');
    const context=typeof body.context==='string'?body.context:'';if(context.length>12000)throw Error('Reduce la indicación a 12.000 caracteres.');
    const attachmentSignal=AbortSignal.any([req.signal,AbortSignal.timeout(30_000)]);
    let imageCount=0,textCount=0;const inputs:ComparativeInput[]=[];
    for await (const file of readPurchaseAttachments(form,adq.id,attachmentSignal)){
      const buffer=Buffer.from(await file.arrayBuffer());let text='',images:string[]=[];
      if(/\.(png|jpg|jpeg|webp)$/i.test(file.name)){
        if(imageCount>=MAX_VISION_IMAGES)throw Error(`La lectura admite hasta ${MAX_VISION_IMAGES} fotos o páginas escaneadas.`);
        images=[await prepareVisionImage(buffer,file.name)];
      }else {const extracted=await extractPurchaseAttachment(buffer,file.name,MAX_VISION_IMAGES-imageCount);text=extracted.text;images=extracted.images;}
      imageCount+=images.length;textCount+=text.length;
      if(!text.trim()&&!images.length)throw Error(`No se pudo leer ${file.name}. Adjunta una imagen legible.`);
      if(imageCount>MAX_VISION_IMAGES||textCount>60000)throw Error(`Adjunta hasta ${MAX_VISION_IMAGES} fotos o páginas escaneadas y solo el contenido de esta comparación.`);
      inputs.push({id:`archivo-${inputs.length+1}`,fileName:file.name,text,images});
    }
    attachmentSignal.throwIfAborted();
    if(!inputs.length)throw Error(`Adjunta de uno a ${MAX_ATTACHMENT_FILES} documentos para preparar el cuadro comparativo.`);
    if(inputs.reduce((sum,input)=>sum+input.images.reduce((size,url)=>size+url.length,0),0)>12*1024*1024)throw Error('Las imágenes preparadas son demasiado grandes. Reduce su tamaño o divide los antecedentes.');
    const data=await readComparativeDocuments(adq,inputs,context,req.signal);
    const working={...adq,comparative_report:data},draft=createComparativeDraft(working),output=comparativeReportData(working);
    return NextResponse.json({data,draft,summary:output.summary,warnings:output.warnings},{headers:{'Cache-Control':'no-store'}});
  }catch(error){return NextResponse.json({error:error instanceof Error&&error.name==='TimeoutError'?'La preparación de los archivos tardó demasiado. Los archivos seleccionados y el informe anterior se conservan; vuelve a intentar.':error instanceof Error?error.message:'No se pudo preparar el cuadro comparativo. Los archivos anteriores se conservan.'},{status:400,headers:{'Cache-Control':'no-store'}});}
  finally{if(attachmentForm&&attachmentAcquisition)await cleanupPurchaseAttachments(attachmentForm,attachmentAcquisition).catch(()=>{});}
}
