"use client";

import { useEffect, useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import Swal from 'sweetalert2';
import type { Adquisicion, Carpeta } from '@/types';
import type { FixedDraft } from '@/lib/docx/fixedModels';
import { fixedModel } from '@/lib/docx/fixedModels';
import type { ComparativeReport } from '@/lib/procurement/comparativeReport';
import { DataStore } from '@/lib/store/dataStore';
import { comparativeHistoryWithPrevious, previousComparativeDrafts } from '@/lib/docx/comparativeHistory';
import { appendPurchaseAttachments, cleanupPurchaseAttachmentUploads } from '@/lib/uploads/attachmentClient';
import { ATTACHMENT_HELP_TEXT, validateAttachmentSelection } from '@/lib/uploads/attachmentPolicy';

type ReportResponse = { data: ComparativeReport; draft: FixedDraft; summary: string; warnings: string[] };
type Work = { token: string; controller: AbortController; committing: boolean; persisted: boolean };

export function ComparativeReportPanel({ adquisicion, carpetas, onSaved, onBusyChange }: {
  adquisicion: Adquisicion; carpetas: Carpeta[]; onSaved: () => void; onBusyChange: (busy: boolean) => void;
}) {
  const [files, setFiles] = useState<File[]>([]), [busy, setBusy] = useState(false), [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState(''), [error, setError] = useState(''), [retry, setRetry] = useState<'read' | 'sync' | null>(null);
  const [result, setResult] = useState<ReportResponse | null>(null);
  const input = useRef<HTMLInputElement>(null), zone = useRef<HTMLButtonElement>(null), depth = useRef(0);
  const mounted = useRef(true), active = useRef<Work | null>(null);
  const props = useRef({ adquisicion, carpetas, onSaved }); props.current = { adquisicion, carpetas, onSaved };
  const current = (work: Work) => mounted.current && active.current === work && !work.controller.signal.aborted;
  const ownsModal = (work: Work) => Swal.getPopup()?.dataset.comparativeTask === work.token;

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; const work = active.current; work?.controller.abort('unmount'); if (work && ownsModal(work)) Swal.close(); }; }, []);
  useEffect(() => { onBusyChange(busy); return () => onBusyChange(false); }, [busy, onBusyChange]);

  function progress(work: Work, committing = false, uploadText?: string) {
    if (!current(work)) return;
    const titleText = committing ? 'Preparando informe…' : 'Leyendo cotizaciones…';
    const text = uploadText || (committing ? 'Conservando el informe y sus versiones anteriores.' : 'La IA está leyendo los proveedores y los importes de los archivos.');
    if (ownsModal(work) && Swal.isVisible()) { Swal.update({ titleText, text, showCancelButton: !committing }); Swal.showLoading(); return; }
    if (Swal.isVisible()) return;
    const modal = Swal.fire({ titleText, text, showConfirmButton: false, showCancelButton: !committing, cancelButtonText: 'Cancelar lectura', allowOutsideClick: false, allowEscapeKey: false, heightAuto: false, returnFocus: false, cancelButtonColor: '#64748b',
      didOpen: popup => { if (current(work) && Swal.getPopup() === popup) { popup.dataset.comparativeTask = work.token; Swal.showLoading(); } },
      didClose: () => { if (mounted.current && !active.current && !Swal.isVisible()) zone.current?.focus(); },
    });
    const popup = Swal.getPopup(); if (popup) popup.dataset.comparativeTask = work.token;
    void modal.then(answer => { if (answer.dismiss === Swal.DismissReason.cancel && current(work) && !work.committing) work.controller.abort('user'); });
  }

  async function notice(work: Work, titleText: string, text: string, icon: 'success' | 'warning' | 'error' | 'info') {
    if (!mounted.current || active.current !== work || Swal.isVisible() && !ownsModal(work)) return;
    const modal = Swal.fire({ titleText, text, icon, confirmButtonText: 'Continuar', confirmButtonColor: '#00264a', heightAuto: false, returnFocus: false, allowOutsideClick: false });
    const popup = Swal.getPopup(); if (popup) popup.dataset.comparativeTask = work.token;
    await modal;
  }

  async function run(selected: File[], synchronizeOnly = false) {
    if (active.current) return;
    const work: Work = { token: crypto.randomUUID(), controller: new AbortController(), committing: synchronizeOnly, persisted: synchronizeOnly };
    active.current = work; setBusy(true); setError(''); setStatus(''); setRetry(null);
    let deadline: ReturnType<typeof setTimeout> | undefined;
    let attachmentForm: FormData | undefined;
    let attachmentAcquisition='';
    try {
      if (synchronizeOnly) {
        progress(work, true);
        const synced = await DataStore.flushPending();
        if (!current(work)) return;
        if (!synced.success) throw Error('Todavía no se pudo sincronizar. El informe sigue guardado en este equipo.');
        const saved = DataStore.getAdquisicionById(props.current.adquisicion.id);
        if (saved?.comparative_report) localStorage.removeItem(`fixed-draft:${saved.id}:3`);
        setStatus('Informe preparado. Puedes corregirlo directamente en el documento.'); props.current.onSaved();
        await notice(work, 'Informe preparado', 'El cuadro comparativo ya está sincronizado y se puede editar.', 'success');
        return;
      }
      progress(work);
      const latest = DataStore.getAdquisicionById(props.current.adquisicion.id) || props.current.adquisicion;
      const previous = previousComparativeDrafts(latest, props.current.carpetas);
      const form = new FormData(); attachmentForm = form; attachmentAcquisition=latest.id;
      form.append('request', JSON.stringify({ adquisicion: latest, context: '', draft: previous.latest }));
      await appendPurchaseAttachments(form, selected, latest.id, { signal: work.controller.signal,
        onProgress: ({ completed, total }) => progress(work, false, `Subiendo archivos… (${completed} de ${total})`) });
      if (!current(work)) return;
      progress(work);
      deadline = setTimeout(() => { if (!work.committing) work.controller.abort('timeout'); }, 175000);
      const response = await fetch('/api/comparative-report', { method: 'POST', body: form, signal: work.controller.signal });
      let prepared: ReportResponse & { error?: string };
      try { prepared = await response.json(); } catch { throw Error('La lectura se interrumpió. Los documentos anteriores se conservan.'); }
      if (!current(work)) return;
      if (!response.ok) throw Error(prepared.error || 'No se pudieron leer las cotizaciones.');
      if (!prepared.data?.revision || !prepared.data.updatedAt || !prepared.draft?.fields || !Array.isArray(prepared.draft.items) || prepared.draft.modelVersion !== fixedModel(3).version || prepared.draft.companyId !== (latest.empresa_id || 'ende')) throw Error('No llegó un informe válido. Los documentos anteriores se conservan.');
      work.committing = true; clearTimeout(deadline); progress(work, true);
      const newest = DataStore.getAdquisicionById(latest.id) || latest;
      const preserved = comparativeHistoryWithPrevious(newest, props.current.carpetas);
      if (!current(work)) return;
      const stored = await DataStore.updateAdquisicion(latest.id, {
        comparative_report: prepared.data, comparative_report_history: preserved,
        borradores_ia: { ...newest.borradores_ia, '3': { draft: prepared.draft, briefRevision: prepared.data.revision, updatedAt: prepared.data.updatedAt } },
      });
      if (!stored.success) throw Error(stored.error || 'No se pudo conservar el informe.');
      work.persisted = true;
      const synced = await DataStore.flushPending();
      if (!current(work)) return;
      setResult(prepared); props.current.onSaved();
      if (!synced.success) {
        setRetry('sync'); setStatus('Informe preparado en este equipo. Falta sincronizarlo.');
        await notice(work, 'Informe preparado en este equipo', 'Lo preparado se conservó. Pulsa «Volver a intentar» cuando tengas conexión.', 'warning');
      } else {
        localStorage.removeItem(`fixed-draft:${latest.id}:3`);
        setStatus('Informe preparado. Puedes corregirlo directamente en el documento.');
        await notice(work, 'Informe preparado', 'Revisa y corrige el cuadro comparativo directamente en el documento. Las versiones anteriores se conservan.', 'success');
      }
    } catch (cause) {
      if (!mounted.current || active.current !== work) return;
      setRetry(work.persisted ? 'sync' : 'read');
      if (work.controller.signal.aborted && work.controller.signal.reason !== 'timeout') {
        setStatus('Lectura cancelada. Los archivos y los documentos anteriores se conservan.');
        await notice(work, 'Lectura cancelada', 'Puedes volver a intentarlo con los archivos seleccionados.', 'info');
      } else {
        const message = work.controller.signal.reason === 'timeout' ? 'La lectura no terminó a tiempo. Los documentos anteriores se conservan.' : cause instanceof Error ? cause.message : 'No se pudo preparar el informe.';
        setError(message); await notice(work, 'No se pudo preparar el informe', message, 'error');
      }
    } finally {
      clearTimeout(deadline);
      if (attachmentForm) void cleanupPurchaseAttachmentUploads(attachmentForm, attachmentAcquisition);
      if (mounted.current && active.current === work) { active.current = null; setBusy(false); queueMicrotask(() => { if (mounted.current && !Swal.isVisible()) zone.current?.focus(); }); }
    }
  }

  async function selectFiles(selected: File[]) {
    if (active.current || !selected.length) return;
    setFiles(selected); setError(''); setStatus(''); setRetry(null);
    const message = validateAttachmentSelection(selected);
    if (message) {
      setError(message); await Swal.fire({ titleText: 'Revisa los archivos', text: message, icon: 'warning', confirmButtonText: 'Entendido', confirmButtonColor: '#00264a', heightAuto: false }); zone.current?.focus(); return;
    }
    await run(selected);
  }

  return <section className="mb-5 rounded-xl border border-blue-200 bg-blue-50/50 p-4" aria-label="Asistente del cuadro comparativo">
    <h2 className="text-lg font-bold text-primary">Preparar cuadro comparativo</h2>
    <p className="mt-1 text-sm text-slate-600">Sube las solicitudes y cotizaciones de los proveedores. La IA preparará el informe con los datos disponibles; después podrás corregirlo en el documento.</p>
    <input ref={input} tabIndex={-1} className="sr-only" type="file" multiple disabled={busy} accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp" aria-label="Solicitudes y cotizaciones de proveedores" onChange={event => { const selected = Array.from(event.target.files || []); event.target.value = ''; void selectFiles(selected); }} />
    <button ref={zone} type="button" aria-label="Subir solicitudes y cotizaciones" disabled={busy} className={`mt-3 flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-5 py-6 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 ${dragging ? 'border-blue-600 bg-blue-100' : 'border-blue-300 bg-white hover:border-blue-500 hover:bg-blue-50'}`}
      onClick={() => input.current?.click()} onDragEnter={event => { event.preventDefault(); if (!busy) { depth.current++; setDragging(true); } }} onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = busy ? 'none' : 'copy'; }} onDragLeave={event => { event.preventDefault(); depth.current = Math.max(0, depth.current - 1); if (!depth.current) setDragging(false); }} onDrop={event => { event.preventDefault(); depth.current = 0; setDragging(false); if (!busy) void selectFiles(Array.from(event.dataTransfer.files)); }}>
      <UploadCloud aria-hidden="true" size={28} className="text-primary" />
      <span className="font-semibold text-primary">Arrastra los archivos aquí o haz clic para elegirlos</span>
      <span className="text-xs text-slate-600">Puedes incluir varios proveedores · {ATTACHMENT_HELP_TEXT}</span>
      {!!files.length && <span className="mt-1 break-all text-sm text-slate-700">{files.map(file => file.name).join(' · ')}</span>}
    </button>
    {result?.summary && <p className="mt-3 text-sm text-slate-700">{result.summary}</p>}
    {status && <p role="status" className="mt-3 text-sm text-primary">{status}</p>}
    {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {retry && <button type="button" disabled={busy} className="mt-3 rounded-lg border border-amber-500 bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-500 disabled:opacity-50" onClick={() => void run(files, retry === 'sync')}>Volver a intentar</button>}
  </section>;
}
