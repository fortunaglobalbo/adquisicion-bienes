import type { PurchaseBrief } from '../docx/purchaseBrief';

// JSON remains supported for existing deployments; new responses report real reading/retry progress.
export async function readPurchaseResponse(response: Response, onProgress: (message: string) => void): Promise<PurchaseBrief> {
  if (!response.headers.get('content-type')?.includes('application/x-ndjson')) {
    let result;
    try { result = await response.json(); }
    catch { throw Error('La conexión se interrumpió antes de completar la lectura. Tu texto y los archivos seleccionados se conservan.'); }
    if (!response.ok || !result?.brief || !Array.isArray(result.brief.items)) throw Error(result?.error || 'No se pudieron leer los antecedentes.');
    return result.brief;
  }
  if (!response.ok || !response.body) throw Error('No se pudo iniciar la lectura. Los datos se conservan.');
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let pending = '', size = 0, brief: PurchaseBrief | undefined;
  const accept = (line: string) => {
    if (!line.trim()) return;
    let event;
    try { event = JSON.parse(line); } catch { throw Error('La respuesta de lectura llegó incompleta. Los datos se conservan.'); }
    if (event.type === 'progress' && typeof event.message === 'string') onProgress(event.message);
    if (event.type === 'error') throw Error(event.message || 'No se pudo completar la lectura.');
    if (event.type === 'result' && event.brief && Array.isArray(event.brief.items)) brief = event.brief;
  };
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) { pending += decoder.decode(); accept(pending); break; }
      size += value.byteLength;
      if (size > 1500000) throw Error('La respuesta de lectura excede el tamaño permitido. Los datos se conservan.');
      pending += decoder.decode(value, {stream:true});
      const lines = pending.split('\n'); pending = lines.pop() || '';
      for (const line of lines) accept(line);
    }
    if (!brief) throw Error('La conexión terminó antes de completar la lectura. Los datos se conservan.');
    return brief;
  } finally { await reader.cancel().catch(()=>{}); reader.releaseLock(); }
}
