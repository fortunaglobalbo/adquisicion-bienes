import { NextRequest, NextResponse } from 'next/server';
import type { Adquisicion } from '@/types';
import { extractPurchaseAttachment } from '@/lib/server/extractText';
import { readComparativeDocuments, createComparativeDraft, comparativeReportData, ComparativeInput } from '@/lib/server/comparativeReport';
import { companyKnowledge } from '@/lib/server/companyKnowledge';

export const runtime='nodejs';
export const maxDuration=180;
export async function POST(req:NextRequest){
  try{
    const form=await req.formData(),request=String(form.get('request')||'{}');
    if(request.length>500000)throw Error('El expediente es demasiado extenso.');
    const body=JSON.parse(request),adq:Adquisicion=body.adquisicion;
    if(!adq?.id||!adq.titulo_proceso||!Array.isArray(adq.items))throw Error('Selecciona un expediente válido.');
    companyKnowledge(adq.empresa_id||'ende');
    const context=typeof body.context==='string'?body.context:'';if(context.length>12000)throw Error('Reduce la indicación a 12.000 caracteres.');
    const files=form.getAll('attachments');if(!files.length||files.length>3)throw Error('Adjunta de uno a tres documentos.');
    let bytes=0,imageCount=0,textCount=0;const inputs:ComparativeInput[]=[];
    for(let index=0;index<files.length;index++){
      const file=files[index];
      if(!(file instanceof File)||!file.size||!/^.+\.(pdf|docx|txt|png|jpg|jpeg|webp)$/i.test(file.name))throw Error('Usa PDF, Word, TXT o imágenes JPG, PNG y WebP legibles.');
      bytes+=file.size;if(bytes>3*1024*1024)throw Error('Los tres archivos deben pesar en conjunto hasta 3 MB.');
      const buffer=Buffer.from(await file.arrayBuffer());let text='',images:string[]=[];
      if(/\.(png|jpg|jpeg|webp)$/i.test(file.name)){
        const mime=buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':buffer[0]===255&&buffer[1]===216&&buffer[2]===255?'image/jpeg':buffer.subarray(0,4).toString()==='RIFF'&&buffer.subarray(8,12).toString()==='WEBP'?'image/webp':null;
        if(!mime)throw Error(`La imagen ${file.name} no es válida.`);images=[`data:${mime};base64,${buffer.toString('base64')}`];
      }else {const extracted=await extractPurchaseAttachment(buffer,file.name,6-imageCount);text=extracted.text;images=extracted.images;}
      imageCount+=images.length;textCount+=text.length;
      if(!text.trim()&&!images.length)throw Error(`No se pudo leer ${file.name}. Adjunta una imagen legible.`);
      if(imageCount>6||textCount>60000)throw Error('Adjunta hasta seis páginas escaneadas y solo el contenido de esta comparación.');
      inputs.push({id:`archivo-${index+1}`,fileName:file.name,text,images});
    }
    if(inputs.reduce((sum,input)=>sum+input.images.reduce((size,url)=>size+url.length,0),0)>12*1024*1024)throw Error('Las imágenes preparadas son demasiado grandes. Reduce su tamaño o divide los antecedentes.');
    const data=await readComparativeDocuments(adq,inputs,context,req.signal);
    const working={...adq,comparative_report:data},draft=createComparativeDraft(working),output=comparativeReportData(working);
    return NextResponse.json({data,draft,summary:output.summary,warnings:output.warnings},{headers:{'Cache-Control':'no-store'}});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'No se pudo preparar el cuadro comparativo. Los archivos anteriores se conservan.'},{status:400,headers:{'Cache-Control':'no-store'}});}
}
