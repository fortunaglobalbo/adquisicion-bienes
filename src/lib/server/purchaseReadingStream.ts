import type { Adquisicion } from '@/types';
import { analyzePurchaseBrief } from './purchaseAssistant';

export function purchaseReadingStream(adq: Adquisicion, context: string, images: string[], requestSignal: AbortSignal) {
  const cancel = new AbortController();
  const signal = AbortSignal.any([requestSignal, cancel.signal]);
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (value: unknown) => { if (!cancel.signal.aborted) controller.enqueue(encoder.encode(JSON.stringify(value)+'\n')); };
      try {
        const brief = await analyzePurchaseBrief(adq,context,images,{signal,onProgress:message=>send({type:'progress',message})});
        send({type:'result',brief});
      } catch(e) {
        send({type:'error',message:e instanceof Error ? e.message : 'No se pudo completar la lectura. Los datos se conservan.'});
      } finally { if (!cancel.signal.aborted) controller.close(); }
    },
    cancel() { cancel.abort(); },
  });
  return new Response(body,{headers:{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-store, no-transform','X-Accel-Buffering':'no'}});
}
