"use client";
import { useEffect, useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import Swal, { type SweetAlertOptions } from 'sweetalert2';
import type { Adquisicion, Carpeta } from '@/types';
import { compatibleFixedDraft, fixedModel, FixedDraft } from '@/lib/docx/fixedModels';
import { comparativeHistoryWithPrevious } from '@/lib/docx/comparativeHistory';
import { initialBrief, briefProblems, briefUpdates, suggestedCurrentPurpose, PurchaseBrief } from '@/lib/docx/purchaseBrief';
import { readPurchaseResponse } from '@/lib/ai/purchaseReadingResponse';
import { DataStore } from '@/lib/store/dataStore';
import { appendPurchaseAttachments, cleanupPurchaseAttachmentUploads } from '@/lib/uploads/attachmentClient';
import { ATTACHMENT_HELP_TEXT, validateAttachmentSelection } from '@/lib/uploads/attachmentPolicy';

const initialFolders = [1, 2, 3, 4, 5];
const readyMessage = 'Documentos preparados. Edita el texto directamente en cada documento.';
const cancelledMessage = 'Proceso cancelado. Los archivos y los documentos preparados se conservan.';
type RetryAction = 'read' | 'prepare' | 'sync' | null;
type Work = { token: string; controller: AbortController; phase: 'reading' | 'question' | 'generating' | 'sync'; remaining: number[]; reread: boolean };

function latestDraft(adq: Adquisicion, carpetas: Carpeta[], number: number): FixedDraft | undefined {
  const model = fixedModel(number);
  const company = adq.empresa_id || 'ende';
  const saved = carpetas.find(folder => folder.numero === number)?.documentos.filter(document => compatibleFixedDraft(number, document.metadata?.fixedDraft) && document.metadata?.fixedDraft?.companyId === company).sort((a,b) => b.fecha_creacion.localeCompare(a.fecha_creacion))[0];
  const candidate = adq.borradores_ia?.[number];
  const prepared = compatibleFixedDraft(number, candidate?.draft) && candidate?.draft.companyId === company ? candidate : undefined;
  let draft = prepared && (!saved || prepared.updatedAt > saved.fecha_creacion) ? prepared.draft : saved?.metadata?.fixedDraft;
  const storedTime = Math.max(Date.parse(prepared?.updatedAt || '') || 0, Date.parse(saved?.fecha_creacion || '') || 0);
  try { const local = JSON.parse(localStorage.getItem(`fixed-draft:${adq.id}:${number}`) || 'null'); if (compatibleFixedDraft(number, local?.draft) && local.draft.companyId === company && local.updatedAt > storedTime) draft = local.draft; } catch {}
  return draft;
}
function startingBrief(adq: Adquisicion, carpetas: Carpeta[]): PurchaseBrief {
  const brief = initialBrief(adq); if (adq.asistente_compra) return brief;
  const draft = latestDraft(adq, carpetas, 1); if (!draft) return brief;
  const known = (value: string | undefined) => value && !/PENDIENTE/.test(value) ? value : '';
  return { ...brief, purpose: known(draft.fields.justificacion) || brief.purpose,
    items: draft.items.length ? draft.items.map(item => ({ descripcion: known(item.descripcion), cantidad: known(item.cantidad), unidad: known(item.unidad), especificaciones: known(item.especificaciones), precio: brief.items.find(previous => previous.descripcion === item.descripcion)?.precio || '' })) : brief.items,
    facts: [...brief.facts, ...['antecedentes','justificacion'].filter(key => known(draft.fields[key])).map(key => ({ topic: key, value: draft.fields[key], origin: 'borrador' }))] };
}
function unfinishedFolders(adq: Adquisicion): number[] {
  const brief = adq.asistente_compra;
  return brief?.preparedAt ? initialFolders.filter(number => !(number === 3 && adq.comparative_report) && (!adq.borradores_ia?.[number] || adq.borradores_ia[number].briefRevision !== brief.revision)) : [];
}
const positiveQuantity = (value: string) => /^\d+(?:[.,]\d+)?$/.test(value.trim()) && Number(value.replace(',', '.')) > 0;

export function PurchaseAssistant({ adquisicion, carpetas, onUpdated, onBusyChange }: { adquisicion: Adquisicion; carpetas: Carpeta[]; onUpdated: () => void; onBusyChange: (busy: boolean) => void }) {
  const initial = useRef(startingBrief(adquisicion, carpetas));
  const pendingBrief = useRef<PurchaseBrief | null>(unfinishedFolders(adquisicion).length ? initial.current : null);
  const [files, setFiles] = useState<File[]>([]), [busy, setBusy] = useState(false), [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState(unfinishedFolders(adquisicion).length ? 'No se completaron todos los documentos. Lo preparado se conservó.' : adquisicion.asistente_compra?.preparedAt ? readyMessage : '');
  const [error, setError] = useState('');
  const [retryAction, setRetryAction] = useState<RetryAction>(unfinishedFolders(adquisicion).length ? 'prepare' : null);
  const [remaining, setRemaining] = useState<number[]>(unfinishedFolders(adquisicion));
  const fileInput = useRef<HTMLInputElement>(null), dropZone = useRef<HTMLButtonElement>(null), dragDepth = useRef(0);
  const active = useRef<Work | null>(null), mounted = useRef(true);
  const latestProps = useRef({ adquisicion, carpetas, onUpdated }); latestProps.current = { adquisicion, carpetas, onUpdated };
  const ownsModal = (work: Work) => Swal.getPopup()?.dataset.purchaseTask === work.token;
  const isCurrent = (work: Work) => mounted.current && active.current === work && !work.controller.signal.aborted;
  const checkCurrent = (work: Work) => { if (!isCurrent(work)) throw Error('Proceso cancelado.'); };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; const work = active.current; work?.controller.abort('unmount'); if (work && ownsModal(work)) Swal.close(); }; }, []);
  useEffect(() => { onBusyChange(busy); return () => onBusyChange(false); }, [busy, onBusyChange]);
  useEffect(() => {
    if (active.current) return;
    initial.current = startingBrief(adquisicion, carpetas);
    const incomplete = unfinishedFolders(adquisicion);
    if (incomplete.length) { pendingBrief.current = initial.current; setRemaining(incomplete); setRetryAction('prepare'); setStatus('No se completaron todos los documentos. Lo preparado se conservó.'); }
  }, [adquisicion.asistente_compra?.revision]);

  function modalOptions(work: Work): SweetAlertOptions {
    return { allowOutsideClick: false, allowEscapeKey: false, showCloseButton: false, heightAuto: false, confirmButtonColor: '#00264a', cancelButtonColor: '#64748b', returnFocus: false,
      didOpen: popup => { if (active.current === work && mounted.current && Swal.getPopup() === popup) popup.dataset.purchaseTask = work.token; },
      didClose: () => { if (mounted.current && !active.current && !Swal.isVisible()) dropZone.current?.focus(); } };
  }
  function showProgress(work: Work, text: string) {
    checkCurrent(work);
    const titleText = work.phase === 'reading' ? 'Leyendo el archivo…' : work.phase === 'sync' ? 'Guardando documentos…' : 'Preparando documentos…';
    const cancelButtonText = work.phase === 'reading' ? 'Cancelar lectura' : 'Cancelar proceso';
    if (ownsModal(work) && Swal.getPopup()?.dataset.purchaseMode === 'progress' && Swal.isVisible()) { Swal.update({ titleText, text, cancelButtonText, showCancelButton: true }); Swal.showLoading(); return; }
    // A late response can update this task's dialog only, never another component's modal.
    if (Swal.isVisible() && !ownsModal(work)) return;
    const dialog = Swal.fire({ ...modalOptions(work), titleText, text, showConfirmButton: false, showCancelButton: true, cancelButtonText,
      didOpen: popup => { if (isCurrent(work) && Swal.getPopup() === popup && popup.dataset.purchaseMode === 'progress') { popup.dataset.purchaseTask = work.token; Swal.showLoading(); } } });
    const popup = Swal.getPopup(); if (popup) { popup.dataset.purchaseTask = work.token; popup.dataset.purchaseMode = 'progress'; }
    void dialog.then(result => { if (result.dismiss === Swal.DismissReason.cancel && isCurrent(work)) work.controller.abort('user'); });
  }
  async function notice(work: Work, titleText: string, text: string, icon: 'success' | 'warning' | 'error' | 'info', confirmButtonText = 'Continuar') {
    if (!mounted.current || active.current !== work || Swal.isVisible() && !ownsModal(work)) return;
    const dialog = Swal.fire({ ...modalOptions(work), titleText, text, icon, confirmButtonText, showCancelButton: false });
    const popup = Swal.getPopup(); if (popup) { popup.dataset.purchaseTask = work.token; popup.dataset.purchaseMode = 'notice'; }
    await dialog;
  }
  async function ask(work: Work, titleText: string, label: string, text: string, value: string, validate: (value: string) => string | undefined, multiline = false): Promise<string> {
    checkCurrent(work); work.phase = 'question';
    if (Swal.isVisible() && !ownsModal(work)) throw Error('No se pudo abrir la pregunta. Vuelve a intentar.');
    const dialog = Swal.fire<string>({ ...modalOptions(work), titleText, text, input: multiline ? 'textarea' : 'text', inputValue: value, inputAttributes: { 'aria-label': label },
      inputValidator: (input: string) => validate(input.trim()), confirmButtonText: 'Continuar', showCancelButton: true, cancelButtonText: 'Cancelar proceso' });
    const popup = Swal.getPopup(); if (popup) { popup.dataset.purchaseTask = work.token; popup.dataset.purchaseMode = 'question'; }
    const result = await dialog;
    if (!result.isConfirmed) { work.controller.abort('user'); throw Error('Proceso cancelado.'); }
    checkCurrent(work); return (result.value || '').trim();
  }
  async function analyze(work: Work, selected: File[], candidate: PurchaseBrief, context = ''): Promise<PurchaseBrief> {
    checkCurrent(work); work.phase = 'reading'; showProgress(work, 'La IA está leyendo la información del archivo.');
    const props = latestProps.current, current = DataStore.getAdquisicionById(props.adquisicion.id) || props.adquisicion;
    const { borradores_ia, ...purchase } = current; const tdr = latestDraft(current, props.carpetas, 1);
    const form = new FormData(); form.append('request', JSON.stringify({ action: 'analyze', stream: true, number: 1, adquisicion: { ...purchase, asistente_compra: candidate,
      borradores_ia: tdr ? { '1': { updatedAt: borradores_ia?.[1]?.updatedAt || '', briefRevision: borradores_ia?.[1]?.briefRevision || '', draft: { ...tdr, sources: [], sourceQuotes: {} } } } : undefined }, context }));
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
      await appendPurchaseAttachments(form, selected, current.id, { signal: work.controller.signal,
        onProgress: ({ completed, total }) => { if (isCurrent(work)) showProgress(work, `Subiendo archivos… (${completed} de ${total})`); } });
      checkCurrent(work); showProgress(work, 'La IA está leyendo la información de los archivos.');
      deadline = setTimeout(() => work.controller.abort('timeout'), 175000);
      const response = await fetch('/api/fixed-documents', { method: 'POST', body: form, signal: work.controller.signal }); const found = await readPurchaseResponse(response, message => { if (isCurrent(work)) showProgress(work, message); }); checkCurrent(work); pendingBrief.current = found; return found;
    } finally { clearTimeout(deadline); void cleanupPurchaseAttachmentUploads(form, current.id); }
  }
  async function resolveEssentials(work: Work, selected: File[], candidate: PurchaseBrief): Promise<PurchaseBrief> {
    let resolved: PurchaseBrief = { ...candidate, items: candidate.items.map(item => ({ ...item })), details: { ...candidate.details } };
    const retain = () => { pendingBrief.current = resolved; };
    if (resolved.conflicts.length) {
      const answer = await ask(work, 'Necesito aclarar un dato', 'Aclaración', resolved.conflicts.join(' '), resolved.clarification, value => value ? undefined : 'Escribe la aclaración para continuar.', true);
      resolved.clarification = answer; retain(); work.reread = true;
      resolved = await analyze(work, selected, resolved, `Aclaración expresa del usuario: ${answer}`);
      if (resolved.conflicts.length) { resolved.clarification = answer; retain(); throw Error('La información todavía es contradictoria. Revisa el archivo o aclara el dato al volver a intentar.'); }
      resolved.clarification = answer; retain();
    }
    if (!resolved.items.length) { const description = await ask(work, '¿Qué necesitas comprar?', 'Bien o servicio', 'No pude identificar el bien o servicio en el archivo.', '', value => value ? undefined : 'Indica el bien o servicio.'); resolved.items = [{ descripcion: description, cantidad: '', unidad: '', especificaciones: '', precio: '' }]; retain(); }
    for (let index = 0; index < resolved.items.length; index++) {
      const item = resolved.items[index];
      if (!item.descripcion.trim()) { item.descripcion = await ask(work, `¿Cuál es el bien del ítem ${index + 1}?`, `Bien o servicio del ítem ${index + 1}`, '', '', value => value ? undefined : 'Indica el bien o servicio.'); retain(); }
      if (!positiveQuantity(item.cantidad)) { item.cantidad = await ask(work, `¿Cuántos necesitas del ítem ${index + 1}?`, `Cantidad del ítem ${index + 1}`, item.descripcion, item.cantidad, value => positiveQuantity(value) ? undefined : 'Escribe una cantidad mayor que cero.'); retain(); }
      if (!item.unidad.trim()) { item.unidad = await ask(work, `¿En qué unidad se compra el ítem ${index + 1}?`, `Unidad del ítem ${index + 1}`, 'Por ejemplo: pares, unidades o metros.', '', value => value ? undefined : 'Indica la unidad.'); retain(); }
      // Optional prices and schedules never send the user back to a technical form.
      if (item.precio && (!/^\d+(?:[.,]\d{1,2})?$/.test(item.precio.trim()) || Number(item.precio.replace(',', '.')) <= 0)) item.precio = '';
    }
    if (resolved.deliveryDays && (!/^\d+$/.test(resolved.deliveryDays) || Number(resolved.deliveryDays) <= 0)) resolved.deliveryDays = '';
    if (!resolved.purpose.trim()) resolved.purpose = suggestedCurrentPurpose(resolved.items, latestProps.current.adquisicion.unidad_solicitante);
    if (briefProblems(resolved).length) throw Error('Falta aclarar un dato del archivo. Vuelve a intentar para completarlo.');
    retain(); return resolved;
  }
  async function prepare(work: Work, candidate: PurchaseBrief, numbers: number[]) {
    checkCurrent(work); const props = latestProps.current, now = new Date().toISOString();
    // A retry reuses the brief revision; completed folders must not become obsolete.
    const saved: PurchaseBrief = candidate.preparedAt && candidate.revision ? candidate : { ...candidate, revision: crypto.randomUUID(), preparedAt: now, reviewMode: 'automatic', confirmedAt: null };
    pendingBrief.current = saved;
    const latest = DataStore.getAdquisicionById(props.adquisicion.id) || props.adquisicion, updates = briefUpdates(latest, saved);
    checkCurrent(work); const stored = await DataStore.updateAdquisicion(props.adquisicion.id, updates); if (!stored.success) throw Error(stored.error); checkCurrent(work);
    let working: Adquisicion = { ...latest, ...updates }; const failed: number[] = []; work.phase = 'generating'; work.remaining = [...numbers];
    for (let position = 0; position < numbers.length; position++) {
      checkCurrent(work); const number = numbers[position]; showProgress(work, `Redactando documentos… (${position + 1} de ${numbers.length})`);
      if (number === 3 && working.comparative_report) { work.remaining = work.remaining.filter(value => value !== number); continue; }
      try {
        const form = new FormData(); form.append('request', JSON.stringify({ action: 'complete', draftOnly: true, number, adquisicion: working, draft: latestDraft(working, props.carpetas, number), context: '' }));
        const response = await fetch('/api/fixed-documents', { method: 'POST', body: form, signal: work.controller.signal }); const result = await response.json(); checkCurrent(work);
        if (!response.ok || !result?.draft) throw Error(result.error || 'No se pudo preparar el documento.');
        const history = number === 3 ? comparativeHistoryWithPrevious(DataStore.getAdquisicionById(props.adquisicion.id) || working, props.carpetas) : undefined;
        working = { ...working, ...(history ? { comparative_report_history: history } : {}), borradores_ia: { ...working.borradores_ia, [number]: { draft: result.draft, briefRevision: saved.revision, updatedAt: new Date().toISOString() } } };
        checkCurrent(work); const storedDraft = await DataStore.updateAdquisicion(props.adquisicion.id, { borradores_ia: working.borradores_ia, ...(history ? { comparative_report_history: history } : {}) }); if (!storedDraft.success) throw Error(storedDraft.error || 'No se pudo conservar el borrador.');
        work.remaining = work.remaining.filter(value => value !== number);
      } catch { checkCurrent(work); failed.push(number); }
    }
    checkCurrent(work); setRemaining(failed); work.phase = 'sync'; showProgress(work, 'Conservando los documentos preparados.');
    const sync = await DataStore.flushPending(); checkCurrent(work); props.onUpdated();
    if (failed.length) { setRetryAction('prepare'); setStatus('No se completaron todos los documentos. Lo preparado se conservó.'); await notice(work, failed.length === 1 ? 'Quedó un documento por preparar' : 'Quedaron documentos por preparar', 'Lo preparado se conservó. Pulsa «Volver a intentar» para completar lo que falta.', 'warning'); }
    else if (!sync.success) { setRetryAction('sync'); setStatus('Documentos preparados en este equipo. Falta sincronizarlos.'); await notice(work, 'Documentos preparados en este equipo', 'Falta sincronizarlos. Pulsa «Volver a intentar» cuando tengas conexión.', 'warning'); }
    else { setRetryAction(null); setStatus(readyMessage); await notice(work, 'Documentos preparados', 'Puedes corregir el texto directamente en cada documento y guardar los cambios.', 'success'); }
  }
  async function run(selected: File[], resume: boolean) {
    if (active.current) return;
    const work: Work = { token: crypto.randomUUID(), controller: new AbortController(), phase: resume && retryAction !== 'read' ? 'generating' : 'reading', remaining: resume && retryAction === 'sync' ? [] : resume && remaining.length ? [...remaining] : [...initialFolders], reread: false };
    active.current = work; setBusy(true); setError(''); setStatus('');
    try {
      if (resume && retryAction === 'sync') { work.phase = 'sync'; showProgress(work, 'Sincronizando los documentos preparados.'); const sync = await DataStore.flushPending(); checkCurrent(work); if (!sync.success) throw Error('No se pudo sincronizar todavía. Tus documentos siguen guardados en este equipo.'); setRetryAction(null); setStatus(readyMessage); latestProps.current.onUpdated(); await notice(work, 'Documentos preparados', 'Los documentos ya están sincronizados.', 'success'); }
      else { let candidate = resume && pendingBrief.current ? pendingBrief.current : await analyze(work, selected, startingBrief(DataStore.getAdquisicionById(adquisicion.id) || latestProps.current.adquisicion, latestProps.current.carpetas)); candidate = await resolveEssentials(work, selected, candidate); await prepare(work, candidate, work.remaining); }
    } catch (error) {
      if (!mounted.current || active.current !== work) return;
      setRemaining([...work.remaining]); setRetryAction(!work.remaining.length && ['sync','generating'].includes(work.phase) ? 'sync' : pendingBrief.current ? 'prepare' : 'read');
      if (work.controller.signal.aborted && work.controller.signal.reason !== 'timeout') { setStatus(cancelledMessage); latestProps.current.onUpdated(); await notice(work, 'Proceso cancelado', 'Puedes volver a intentar. Los archivos y los documentos preparados se conservan.', 'info'); }
      else { const message = work.controller.signal.reason === 'timeout' ? 'La lectura no terminó a tiempo. El archivo se conserva para volver a intentar.' : error instanceof Error ? error.message : 'No se pudo completar el proceso. Los datos se conservan.'; setError(message); latestProps.current.onUpdated(); await notice(work, 'No se pudo completar', message, 'error'); }
    } finally {
      if (mounted.current && active.current === work) { active.current = null; setBusy(false); queueMicrotask(() => { if (mounted.current && !Swal.isVisible()) dropZone.current?.focus(); }); }
    }
  }
  async function selectFiles(selected: File[]) {
    if (active.current || !selected.length) return;
    setFiles(selected); setError(''); setStatus(''); pendingBrief.current = null; setRetryAction(null); setRemaining([]);
    const message = validateAttachmentSelection(selected);
    if (message) { setError(message); await Swal.fire({ titleText: 'Revisa el archivo', text: message, icon: 'warning', confirmButtonText: 'Entendido', confirmButtonColor: '#00264a', heightAuto: false }); dropZone.current?.focus(); return; }
    await run(selected, false);
  }

  return <section className="mb-5 rounded-xl border border-blue-200 bg-blue-50/50 p-4" aria-label="Asistente de esta compra">
    <h2 className="font-bold text-lg text-primary">Asistente de esta compra</h2>
    <p className="mt-1 text-sm text-slate-600">Sube tu archivo y la IA preparará los documentos de las carpetas 1 a 5. Después podrás corregirlos directamente en el documento.</p>
    <input ref={fileInput} className="sr-only" type="file" multiple tabIndex={-1} disabled={busy} accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp" aria-label="Cotización, PDF o foto" onChange={event => { const selected = Array.from(event.target.files || []); event.target.value = ''; void selectFiles(selected); }} />
    <button ref={dropZone} type="button" aria-label="Subir cotización, PDF o foto" disabled={busy} className={`mt-3 flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-5 py-6 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 ${dragging ? 'border-blue-600 bg-blue-100' : 'border-blue-300 bg-white hover:border-blue-500 hover:bg-blue-50'}`}
      onClick={() => fileInput.current?.click()} onDragEnter={event => { event.preventDefault(); if (!busy) { dragDepth.current++; setDragging(true); } }} onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = busy ? 'none' : 'copy'; }} onDragLeave={event => { event.preventDefault(); dragDepth.current = Math.max(0,dragDepth.current - 1); if (!dragDepth.current) setDragging(false); }} onDrop={event => { event.preventDefault(); dragDepth.current = 0; setDragging(false); if (!busy) void selectFiles(Array.from(event.dataTransfer.files)); }}>
      <UploadCloud aria-hidden="true" className="text-primary" size={28} />
      <span className="font-semibold text-primary">Arrastra tus archivos aquí o haz clic para elegirlos</span>
      <span className="text-xs text-slate-600">{ATTACHMENT_HELP_TEXT}</span>
      {!!files.length && <span className="mt-1 break-all text-sm text-slate-700">{files.map(file => file.name).join(' · ')}</span>}
    </button>
    {status && <p role="status" className="mt-3 text-sm text-primary">{status}</p>}
    {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {retryAction && <button type="button" disabled={busy} className="mt-3 rounded-lg border border-amber-500 bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-500 disabled:opacity-50" onClick={() => void run(files,true)}>Volver a intentar</button>}
  </section>;
}
