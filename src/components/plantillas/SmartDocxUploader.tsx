"use client";
import React, { useEffect, useRef, useState } from "react";
import { FileText, ArrowLeft, ArrowRight, Loader2, Download } from "lucide-react";
import type { AssistantDraft } from "@/lib/ai/documentAssistant";
import type { TemplateStructure } from "@/lib/docx/templateEditor";
import { DataStore } from "@/lib/store/dataStore";
import type { Adquisicion } from "@/types";

type Draft = AssistantDraft & { structure: TemplateStructure; fingerprint: string };
const steps = ["Documento", "Formato", "Información", "Completar", "Revisar"];
const kinds = ["TDR", "Solicitud de inicio", "Solicitud de cotización", "Informe de conformidad", "Solicitud de pago", "Otro documento"];
const input = "w-full rounded-lg border border-outline-variant bg-white p-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary";
const button = "inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-base font-semibold text-white disabled:opacity-50";
const pending = (value: string) => /\[PENDIENTE[^\]]*\]/i.test(value) || !value.trim();

export function SmartDocxUploader({ onSuccess }: { onSuccess?: (url: string) => void }) {
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState("TDR");
  const [custom, setCustom] = useState(false);
  const [template, setTemplate] = useState<File | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [context, setContext] = useState("");
  const [records, setRecords] = useState<Adquisicion[]>([]);
  const [recordId, setRecordId] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [initialPending, setInitialPending] = useState<string[]>([]);
  const [savedMessage, setSavedMessage] = useState("");
  const [savedModels, setSavedModels] = useState<{ name: string; path: string; kind: string }[]>([]);
  function loadRecords() {
    setRecords(DataStore.getAdquisiciones());
    const models = new Map<string, { name: string; path: string; kind: string }>();
    DataStore.getAllCarpetas().forEach(c => c.documentos.forEach(d => {
      if (d.metadata?.assistant && d.metadata.templatePath) models.set(d.metadata.fingerprint, { name: d.metadata.templateName || "Modelo guardado", path: d.metadata.templatePath, kind: d.metadata.documentKind });
    }));
    setSavedModels(Array.from(models.values()));
  }
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRecordId(params.get("expediente") || "");
    const k = params.get("documento");
    if (k && kinds.includes(k)) { setKind(k); setCustom(k !== "TDR"); }
    loadRecords();
    void DataStore.syncWithSupabase().then(loadRecords);
  }, []);
  useEffect(() => { heading.current?.focus(); }, [step]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if ((draft && !downloaded) || busy) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [draft, downloaded, busy]);
  const invalidate = () => { setDraft(null); setReviewed(false); setDownloaded(false); setError(""); setSavedMessage(""); };
  const unresolved = draft ? draft.changes.filter(c => pending(c.value)).length + draft.tables.reduce((n, t) => n + t.rows.flat().filter(pending).length, 0) : 0;
  const record = records.find(r => r.id === recordId || r.codigo === recordId);
  async function prepare() {
    setBusy(true); setError(""); setReviewed(false); setDownloaded(false);
    try {
      let file = template;
      if (!custom) {
        const res = await fetch("/TDR_7Paginas_Oficial_ENDE_Deoruro.docx");
        if (!res.ok) throw Error("No se pudo abrir el modelo institucional.");
        file = new File([await res.blob()], "TDR_institucional.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
      }
      if (!file) throw Error("Selecciona tu plantilla Word.");
      if (file.size + attachments.reduce((n, f) => n + f.size, 0) > 4 * 1024 * 1024) throw Error("Los archivos juntos deben pesar como máximo 4 MB.");
      setTemplate(file);
      const form = new FormData();
      form.append("template", file); form.append("documentType", kind);
      const previousTdr = record && kind !== "TDR" ? DataStore.getCarpetasByAdquisicion(record.id).find(c => c.numero === 1)?.documentos.find(d => d.metadata?.assistant)?.contenido_texto : "";
      form.append("context", [context, record ? `DATOS REGISTRADOS DEL EXPEDIENTE (los valores pendientes no están confirmados):\n${JSON.stringify(record)}` : "", previousTdr ? `TDR PREPARADO EN ESTE MISMO EXPEDIENTE (si contradice la petición actual, pregunta):\n${previousTdr}` : ""].filter(Boolean).join("\n\n"));
      attachments.forEach(f => form.append("attachments", f));
      const res = await fetch("/api/document-assistant", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw Error(data.error || "No se pudo preparar el documento.");
      setDraft(data); setInitialPending(data.changes.filter((c: { value: string }) => pending(c.value)).map((c: { target: string }) => c.target)); setShowCompleted(false); setStep(3);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo preparar el documento. Intenta de nuevo."); }
    finally { setBusy(false); }
  }
  async function download() {
    if (!draft || !template) return;
    setBusy(true); setError("");
    try {
      const form = new FormData();
      form.append("action", "download"); form.append("template", template);
      form.append("fingerprint", draft.fingerprint); form.append("plan", JSON.stringify({ changes: draft.changes, tables: draft.tables }));
      const res = await fetch("/api/document-assistant", { method: "POST", body: form });
      if (!res.ok) { const data = await res.json(); throw Error(data.error || "No se pudo descargar."); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url;
      a.download = `${kind}_para_revision.docx`; a.click();
      onSuccess?.(url); setTimeout(() => URL.revokeObjectURL(url), 60000); setDownloaded(true);
      if (record && !downloaded) {
        const number = ({ TDR: 1, "Solicitud de inicio": 5, "Solicitud de cotización": 6, "Informe de conformidad": 7, "Solicitud de pago": 8 } as Record<string, number>)[kind];
        const folder = DataStore.getCarpetasByAdquisicion(record.id).find(c => c.numero === number);
        if (folder) {
          const upload = new FormData(); upload.append("file", blob, `${kind}_para_revision.docx`); upload.append("adquisicion_id", record.id);
          const storedResponse = await fetch("/api/files", { method: "POST", body: upload });
          const stored = await storedResponse.json();
          if (!storedResponse.ok) { setSavedMessage("El Word se descargó, pero no se pudo guardar la copia en el expediente. Puedes adjuntarla desde la carpeta."); }
          else {
            let templatePath = "";
            try {
              const originalUpload = new FormData(); originalUpload.append("file", template); originalUpload.append("adquisicion_id", record.id);
              const originalResponse = await fetch("/api/files", { method: "POST", body: originalUpload });
              if (originalResponse.ok) templatePath = (await originalResponse.json()).path;
            } catch { /* Save the generated document even if model upload fails. */ }
            await DataStore.addDocumentToCarpeta(folder.id, {
              id: crypto.randomUUID(), carpeta_id: folder.id, adquisicion_id: record.id, tipo: "GENERADO_DOCX", nombre_original: `${kind}_para_revision.docx`,
              ruta_storage: stored.path, mime: blob.type, tamano: blob.size, estado: "Borrador", version: folder.documentos.length + 1, creado_por: "Asistente de documentos",
              fecha_creacion: new Date().toISOString(), contenido_texto: [...draft.changes.map(c => `${c.label}: ${c.value}`), ...draft.tables.map(t => `${t.label}:\n${t.rows.map(r => r.join(" | ")).join("\n")}`)].join("\n\n"),
              metadata: { assistant: true, documentKind: kind, templatePath, templateName: template.name, sources: draft.sources, warnings: draft.warnings, consultedAt: draft.consultedAt, fingerprint: draft.fingerprint, changes: draft.changes, tables: draft.tables, normativeStatus: draft.normativeStatus },
            }, false);
            await DataStore.flushPending();
            setSavedMessage(DataStore.pendingCount() ? "Copia registrada en este equipo; el expediente tiene cambios pendientes de sincronización." : "Copia guardada como borrador en el expediente, junto con su fundamento.");
            loadRecords();
          }
        }
      }
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo completar la descarga o el guardado."); }
    finally { setBusy(false); }
  }
  function downloadReview() {
    if (!draft) return;
    const content = { documento: kind, expediente: record?.codigo || null, plantilla: template?.name, huellaPlantilla: draft.fingerprint, fechaConsulta: draft.consultedAt,
      estado: "Borrador para revisión; no constituye aprobación normativa", cambios: draft.changes, tablas: draft.tables, fuentes: draft.sources, observaciones: draft.warnings };
    const url = URL.createObjectURL(new Blob([JSON.stringify(content, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "Fundamento_y_revision.json"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className="mx-auto max-w-4xl space-y-6 text-base">
    <ol aria-label="Pasos para preparar el documento" className="flex flex-wrap gap-3">
      {steps.map((label, i) => <li key={label} aria-current={i === step ? "step" : undefined} className={`flex items-center gap-2 text-sm ${i === step ? "font-bold text-primary" : "text-slate-500"}`}><span className={`flex h-8 w-8 items-center justify-center rounded-full ${i === step ? "bg-primary text-white" : "bg-slate-100"}`}>{i + 1}</span>{label}</li>)}
    </ol>
    <fieldset disabled={busy} className="min-w-0 rounded-2xl border border-outline-variant bg-white p-5 md:p-8 space-y-6">
      <h2 ref={heading} tabIndex={-1} className="text-2xl font-bold text-primary outline-none">{["¿Qué documento necesitas?", "Elige el formato", "Cuéntanos qué necesitas", "Completa y corrige los datos", "Revisa antes de descargar"][step]}</h2>
      {step === 0 && <div className="grid gap-3 sm:grid-cols-2">{kinds.map(k => <button key={k} type="button" aria-pressed={kind === k} onClick={() => { setKind(k); setCustom(k !== "TDR"); setTemplate(null); invalidate(); }} className={`flex gap-3 items-center rounded-xl border-2 p-5 text-left ${kind === k ? "border-primary bg-blue-50" : "border-slate-200"}`}><FileText className="h-5 w-5 shrink-0" />{k}</button>)}</div>}
      {step === 1 && <div className="space-y-5">
        {savedModels.some(m => m.kind === kind) && <label className="block space-y-2"><span className="font-semibold">Volver a usar un modelo guardado</span><select disabled={busy} className={input} value="" onChange={async e => {
          const model = savedModels.find(m => m.path === e.target.value); if (!model) return;
          setBusy(true); invalidate();
          try { const res = await fetch(`/api/files?path=${encodeURIComponent(model.path)}`); if (!res.ok) throw Error("No se pudo recuperar el modelo. Puedes subirlo de nuevo."); setTemplate(new File([await res.blob()], model.name)); setCustom(true); }
          catch (e) { setError(e instanceof Error ? e.message : "No se pudo recuperar el modelo."); } finally { setBusy(false); }
        }}><option value="">Elegir un modelo anterior…</option>{savedModels.filter(m => m.kind === kind).map(m => <option key={m.path} value={m.path}>{m.name}</option>)}</select></label>}
        {kind === "TDR" && <label className="flex items-start gap-3 rounded-xl border p-4 cursor-pointer"><input className="mt-1" type="radio" name="format" checked={!custom} onChange={() => { setCustom(false); setTemplate(null); invalidate(); }} /><span><strong>Modelo institucional</strong><span className="block text-slate-600 mt-1">El formato habitual de TDR de ENDE Deoruro.</span></span></label>}
        <label className="flex items-start gap-3 rounded-xl border p-4 cursor-pointer"><input className="mt-1" type="radio" name="format" checked={custom} onChange={() => { setCustom(true); setTemplate(null); invalidate(); }} /><span><strong>Usar mi propio Word</strong><span className="block text-slate-600 mt-1">Puedes subir un modelo vacío o un documento anterior. Revisaremos qué datos hay que cambiar.</span></span></label>
        {custom && <label className="block space-y-2"><span className="font-semibold">Selecciona tu plantilla (.docx, hasta 3 MB)</span><input type="file" accept=".docx" className={input} onChange={e => { const f = e.target.files?.[0]; invalidate(); setTemplate(null); if (f && (!/\.docx$/i.test(f.name) || f.size > 3 * 1024 * 1024)) { setError("Selecciona un Word (.docx) de hasta 3 MB."); return; } setTemplate(f || null); }} /></label>}
        {custom && template && <p className="text-primary">Modelo seleccionado: {template.name}</p>}
        <p className="text-sm text-slate-600">El asistente trabaja sobre una copia. Las tablas con celdas combinadas o diseños especiales pueden necesitar un ajuste manual.</p>
      </div>}
      {step === 2 && <div className="space-y-5">
        {!!records.length && <label className="block space-y-2"><span className="font-semibold">Usar datos de una compra existente (opcional)</span><select className={input} value={recordId} onChange={e => { setRecordId(e.target.value); invalidate(); }}><option value="">Documento independiente</option>{records.map(r => <option key={r.id} value={r.id}>{r.codigo} · {r.titulo_proceso}</option>)}</select></label>}
        <label className="block space-y-2"><span className="font-semibold">¿Qué necesitas preparar?</span><textarea rows={6} maxLength={30000} className={input} value={context} onChange={e => { setContext(e.target.value); invalidate(); }} placeholder="Describe qué se compra, para qué se necesita y las cantidades. Agrega los plazos y responsables si ya los conoces." /></label>
        <label className="block space-y-2"><span className="font-semibold">Adjuntar antecedentes (opcional)</span><input type="file" multiple accept=".pdf,.docx,.txt" className={input} onChange={e => { invalidate(); const files = Array.from(e.target.files || []); if (files.length > 3) { setAttachments([]); setError("Selecciona como máximo tres antecedentes."); return; } setAttachments(files); }} /><span className="block text-sm text-slate-600">Hasta tres archivos PDF, Word o texto. Máximo 4 MB entre plantilla y antecedentes. Usa PDF con texto seleccionable.</span></label>
        {attachments.length > 0 && <p className="text-sm text-slate-600">Adjuntos: {attachments.map(f => f.name).join(", ")}</p>}
        <p className="text-slate-600">Consultaremos las normas institucionales automáticamente. Los datos de la compra saldrán de esta información y del expediente elegido.</p>
      </div>}
      {step === 3 && draft && <div className="space-y-5">
        <p className="text-slate-600">{unresolved ? `Hay ${unresolved} campos pendientes. Completa los que conozcas; los demás quedarán marcados en el borrador.` : "No se detectaron campos vacíos en la propuesta. Comprueba que los datos sean correctos."}</p>
        <label className="flex items-center gap-3"><input type="checkbox" checked={showCompleted} onChange={e => setShowCompleted(e.target.checked)} />Revisar también los datos que ya se completaron</label>{draft.changes.map((c, i) => (showCompleted || initialPending.includes(c.target)) && <label key={c.target} className="block space-y-2"><span className="font-semibold">{c.label}</span><textarea className={`${input} ${pending(c.value) ? "border-amber-500 bg-amber-50" : ""}`} rows={c.value.length > 150 ? 4 : 2} value={c.value} onChange={e => { setDraft({ ...draft, changes: draft.changes.map((v, j) => j === i ? { ...v, value: e.target.value, sourceIds: [] } : v) }); setReviewed(false); setDownloaded(false); }} />{c.sourceIds.length > 0 && <span className="block text-sm text-slate-600">Fundamento propuesto: {c.sourceIds.join(", ")}</span>}</label>)}
        {draft.tables.map((t, ti) => <div key={t.target} className="space-y-3"><h3 className="font-semibold">{t.label}</h3><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{draft.structure.tables.find(s => s.id === t.target)?.headers.map((h, hi) => <th className="p-2 text-left" key={hi}>{h}</th>)}</tr></thead><tbody>{t.rows.map((row, ri) => <tr key={ri}>{row.map((cell, ci) => <td key={ci} className="p-1 align-top"><textarea aria-label={`Fila ${ri + 1}, columna ${ci + 1}`} className={`${input} min-w-[140px]`} value={cell} rows={2} onChange={e => { setDraft({ ...draft, tables: draft.tables.map((v, j) => j === ti ? { ...v, rows: v.rows.map((r, k) => k === ri ? r.map((x, l) => l === ci ? e.target.value : x) : r) } : v) }); setReviewed(false); setDownloaded(false); }} /></td>)}</tr>)}</tbody></table></div></div>)}
      </div>}
      {step === 4 && draft && <div className="space-y-5">
        <div className="rounded-xl bg-slate-50 p-4 space-y-2"><p><strong>{kind}</strong> · {template?.name}</p><p>{draft.changes.length} campos y {draft.tables.length} tablas preparados.</p><p>{unresolved ? `${unresolved} campos pendientes: se descargará como borrador.` : "Datos preparados para tu revisión."}</p><p>{draft.sources.length ? `${draft.sources.length} fuentes recuperadas. Revisa su aplicabilidad y vigencia.` : "Sin fuentes normativas recuperadas: requiere revisión normativa."}</p></div>
        <details className="rounded-xl border p-4"><summary className="cursor-pointer font-semibold">Ver contenido que se colocará en el Word</summary><div className="mt-4 space-y-4">{draft.changes.map(c => <div key={c.target}><h3 className="font-semibold">{c.label}</h3><p className="whitespace-pre-wrap text-slate-700">{c.value}</p></div>)}{draft.tables.map(t => <div key={t.target}><h3 className="font-semibold">{t.label}</h3>{t.rows.map((r, i) => <p key={i}>{r.join(" · ")}</p>)}</div>)}</div><p className="mt-4 text-sm text-slate-600">Esta es una revisión de contenido. Comprueba la paginación y el formato final abriendo el Word descargado.</p></details>
        <details className="rounded-xl border p-4"><summary className="cursor-pointer font-semibold">Ver fundamento y observaciones</summary><div className="mt-4 space-y-4">{draft.warnings.map((w, i) => <p key={i} className="text-amber-900">{w}</p>)}{draft.sources.map(s => <div key={s.id} className="border-t pt-3"><strong>{s.id}: {s.title}</strong><p className="text-sm">Página: {s.page} · Versión: {s.version}</p><p className="mt-2 whitespace-pre-wrap text-slate-700">{s.excerpt}</p></div>)}<p className="text-sm">Consulta: {new Date(draft.consultedAt).toLocaleString("es-BO")}</p><button type="button" onClick={downloadReview} className="text-primary underline">Guardar fundamento y revisión</button></div></details>
        <label className="flex items-start gap-3"><input type="checkbox" className="mt-1 h-5 w-5" checked={reviewed} onChange={e => setReviewed(e.target.checked)} /><span>He revisado los datos y entiendo que el documento requiere revisión antes de su firma o uso oficial.</span></label>
        {record && kind !== "Otro documento" && <p className="text-sm text-slate-600">Al descargar, guardaremos una copia como borrador en este expediente.</p>}{savedMessage && <p role="status" className="text-primary">{savedMessage}</p>}{downloaded && <p role="status" className="text-emerald-800">Word descargado. Puedes corregir los datos y descargar otra copia.</p>}
      </div>}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">{error}</p>}
      {busy && <p role="status" aria-live="polite" className="flex gap-2 text-primary"><Loader2 className="h-6 w-6 animate-spin shrink-0" />{step === 2 ? "Estamos leyendo la plantilla, consultando las normas y preparando los datos. Puede tardar hasta dos minutos." : "Preparando tu Word…"}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
        {step > 0 ? <button type="button" disabled={busy} onClick={() => { setStep(step - 1); setError(""); }} className="inline-flex items-center gap-2 rounded-lg px-4 py-3 text-primary disabled:opacity-50"><ArrowLeft className="h-5 w-5" />Atrás</button> : <span />}
        {step < 2 && <button type="button" className={button} disabled={step === 1 && custom && !template} onClick={() => { setStep(step + 1); setError(""); }}>Continuar<ArrowRight className="h-5 w-5" /></button>}
        {step === 2 && <button type="button" className={button} disabled={busy || (!context.trim() && !record)} onClick={prepare}>Preparar documento<ArrowRight className="h-5 w-5" /></button>}
        {step === 3 && <button type="button" className={button} onClick={() => setStep(4)}>Revisar documento<ArrowRight className="h-5 w-5" /></button>}
        {step === 4 && <button type="button" className={button} disabled={busy || !reviewed} onClick={download}><Download className="h-5 w-5" />Descargar Word para revisión</button>}
      </div>
    </fieldset>
  </section>;
}
