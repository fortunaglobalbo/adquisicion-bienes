"use client";
import React, { useEffect, useRef, useState } from "react";
import { Download, Loader2, Save, Sparkles, RefreshCw } from "lucide-react";
import type { Adquisicion, Carpeta, Documento } from "@/types";
import { fixedModel, FixedDraft } from "@/lib/docx/fixedModels";
import { DataStore } from "@/lib/store/dataStore";
import { officialPeople, officialPeopleKeys } from "@/lib/docx/officialPeople";
import { initialBrief } from '@/lib/docx/purchaseBrief';

const control = "w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900 focus:ring-2 focus:ring-blue-600";
const action = "inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-50";
const purchaseSnapshot = (adq: Adquisicion) => JSON.stringify({ title: adq.titulo_proceso, items: adq.items, background: adq.antecedentes_texto, reason: adq.justificacion_texto });
function documentFrame(html: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><style>body{max-width:760px;margin:0 auto;padding:20px;font:14px Arial;color:#151515;background:white;line-height:1.45}img{display:block;max-width:180px;max-height:100px;width:auto;height:auto;object-fit:contain;margin:0 auto 16px}table{border-collapse:collapse;width:100%;margin:18px 0;table-layout:auto}td,th{border:1px solid #888;padding:7px;overflow-wrap:anywhere}p{white-space:pre-wrap}h1,h2{text-align:center}a{color:inherit}</style></head><body>${html}</body></html>`;
}
export function FixedDocumentFolder({ adquisicion, carpeta, onSaved, assistantBusy=false }: { adquisicion: Adquisicion; carpeta: Carpeta; onSaved: () => void; assistantBusy?:boolean }) {
  const model = fixedModel(carpeta.numero);
  const latest = [...carpeta.documentos].sort((a,b)=>b.fecha_creacion.localeCompare(a.fecha_creacion)).find(d => d.metadata?.fixedDraft?.modelVersion === model.version);
  const purchaseChanged = model.number !== 1 && ((latest?.metadata?.purchaseSnapshot && latest.metadata.purchaseSnapshot !== purchaseSnapshot(adquisicion)) || (adquisicion.borradores_ia?.[model.number] && adquisicion.borradores_ia[model.number].briefRevision !== adquisicion.asistente_compra?.revision));
  const prepared = adquisicion.borradores_ia?.[model.number];
  const initial = prepared?.draft.modelVersion === model.version && (!latest || prepared.updatedAt > latest.fecha_creacion) ? prepared.draft : latest?.metadata?.fixedDraft;
  const [recovery] = useState(() => {
    try {
      const value = JSON.parse(localStorage.getItem(`fixed-draft:${adquisicion.id}:${carpeta.numero}`) || 'null');
      const storedAt = Math.max(Date.parse(prepared?.updatedAt || '') || 0, Date.parse(latest?.fecha_creacion || '') || 0);
      return value?.draft?.modelVersion === model.version && value.draft.companyId === (adquisicion.empresa_id || 'ende') && value.updatedAt > storedAt ? value : null;
    } catch { return null; }
  });
  const [draft, setDraft] = useState<FixedDraft | null>(recovery?.draft || initial || null);
  const [context, setContext] = useState(recovery?.context || "");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(!!recovery);
  const [stale, setStale] = useState(false);
  const [html, setHtml] = useState("");
  const [pdf, setPdf] = useState<string | null>(null);
  const [previewWarning, setPreviewWarning] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [edit, setEdit] = useState(!!recovery);
  const [aiEdit, setAiEdit] = useState(false);
  const [saveOfficial, setSaveOfficial] = useState(false);
  const mounted = useRef(true);
  const requestVersion = useRef(0);
  const pdfUrl = useRef<string | null>(null);
  const pendingNorms = model.fields.filter(f=>f.normative && !adquisicion.asistente_compra?.decisions?.[f.key] && (!draft?.sourceIds[f.key]?.length || /PENDIENTE/.test(draft?.fields[f.key] || ''))).map(f=>f.label);
  const choiceOptions:Record<string,string[]>=model.number===2?{almacen:['Con saldo','Sin saldo'],publicar_precio:['Sí','No'],con_presupuesto:['Sí','No']}:{};
  async function request(kind: string) {
    const form = new FormData();
    form.append("request", JSON.stringify({ action: kind, number: model.number, adquisicion, draft, context }));
    if (kind === "complete") files.forEach(f => form.append("attachments", f));
    const res = await fetch("/api/fixed-documents", { method: "POST", body: form });
    if (!res.ok) { let message = "No se pudo preparar el documento."; try { message = (await res.json()).error || message; } catch {} throw Error(message); }
    return res;
  }
  async function refresh(kind = "preview") {
    const version = ++requestVersion.current;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await (await request(kind)).json();
      if (!mounted.current || version !== requestVersion.current) return;
      setDraft(result.draft); setHtml(result.html); setPreviewWarning(result.previewWarning); setStale(false);
      if (pdfUrl.current) URL.revokeObjectURL(pdfUrl.current);
      pdfUrl.current = result.pdf ? URL.createObjectURL(new Blob([Uint8Array.from(atob(result.pdf), c => c.charCodeAt(0))], { type: "application/pdf" })) : null;
      setPdf(pdfUrl.current);
      if (kind === "complete" || kind === "revise") { setDirty(true); setAiEdit(false); setContext(""); setFiles([]); setMessage(kind === "revise" ? "Cambio aplicado. Revisa la vista previa y pulsa Guardar cambios para conservarlo en el expediente." : "Datos incorporados al borrador. Revisa los campos pendientes antes de guardarlo."); }
    } catch (e) { if (mounted.current && version === requestVersion.current) setError(e instanceof Error ? e.message : "No se pudo actualizar."); }
    finally { if (mounted.current && version === requestVersion.current) setBusy(false); }
  }
  useEffect(() => {
    mounted.current = true; void refresh();
    return () => { mounted.current = false; requestVersion.current++; if (pdfUrl.current) URL.revokeObjectURL(pdfUrl.current); };
  }, []);
  // Persist the draft locally on edits; server-backed versioning occurs only on explicit Save.
  useEffect(() => {
    if (!dirty || !draft) return;
    const key = `fixed-draft:${adquisicion.id}:${carpeta.numero}`;
    try { localStorage.setItem(key, JSON.stringify({ draft, context, updatedAt: Date.now() })); } catch { setMessage("No se pudo guardar la recuperación local. Guarda el borrador antes de salir."); }
  }, [draft, context, dirty, adquisicion.id, carpeta.numero]);
  async function recover() {
    try { const value = JSON.parse(localStorage.getItem(`fixed-draft:${adquisicion.id}:${carpeta.numero}`) || "null"); if (!value?.draft || value.draft.modelVersion !== model.version) { setMessage("No hay cambios locales de esta versión para recuperar."); return; } setDraft(value.draft); setContext(value.context || ""); setDirty(true); setStale(true); setEdit(true); setMessage("Cambios recuperados. Actualiza la vista y guarda el borrador."); } catch { setError("No se pudo recuperar el borrador local."); }
  }
  function changeField(key: string, value: string) {
    if (!draft) return;
    setDraft({ ...draft, fields: { ...draft.fields, [key]: value }, sourceIds: { ...draft.sourceIds, [key]: [] }, sourceQuotes: {...draft.sourceQuotes,[key]:[]}, editedFields: Array.from(new Set([...(draft.editedFields || []),key])) }); setDirty(true); setStale(true); setMessage("");
  }
  async function download(save: boolean) {
    if (!draft) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const exported = await (await request("export")).json();
      const savedDraft: FixedDraft = exported.draft;
      const blob = new Blob([Uint8Array.from(atob(exported.docx), c => c.charCodeAt(0))], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
      if (JSON.stringify(savedDraft.fields) !== JSON.stringify(draft.fields)) setStale(true);
      setDraft(savedDraft);
      const fileName = `${adquisicion.codigo}_${model.number}_v${carpeta.documentos.length + 1}.docx`;
      if (save) {
        const form = new FormData(); form.append("file", blob, fileName); form.append("adquisicion_id", adquisicion.id);
        const res = await fetch("/api/files", { method: "POST", body: form });
        const data = await res.json(); if (!res.ok) throw Error("No se pudo guardar el Word en el expediente. Tu borrador se conserva; puedes descargarlo e intentar guardar después.");
        const doc: Documento = { id: crypto.randomUUID(), carpeta_id: carpeta.id, adquisicion_id: adquisicion.id, tipo: "GENERADO_DOCX", nombre_original: fileName,
          ruta_storage: data.path, mime: blob.type, tamano: blob.size, estado: "Borrador", version: carpeta.documentos.length + 1, creado_por: "Operador", fecha_creacion: new Date().toISOString(),
          contenido_texto: Object.entries(savedDraft.fields).map(([k,v]) => `${k}: ${v}`).join("\n"), metadata: { fixedDraft: savedDraft, templateVersion: model.version, companyId: savedDraft.companyId, purchaseSnapshot: purchaseSnapshot(adquisicion), generatedWith: savedDraft.consultedAt ? "OpenCode GO / edición del usuario" : "Datos del expediente / edición del usuario" } };
        if (!DataStore.getCarpetasByAdquisicion(adquisicion.id).some(c => c.id === carpeta.id)) throw Error("No se encontró la carpeta para registrar el documento.");
        await DataStore.addDocumentToCarpeta(carpeta.id, doc, false); await DataStore.flushPending();
        if (model.number === 1) {
          const validItems = savedDraft.items.length > 0 && savedDraft.items.every(r => r.descripcion && !/PENDIENTE/.test(r.descripcion) && /^\d+(?:[.,]\d+)?$/.test(r.cantidad) && Number(r.cantidad.replace(',', '.')) > 0);
          const updates: Partial<Adquisicion> = {};
          if (savedDraft.fields.objeto && !/PENDIENTE/.test(savedDraft.fields.objeto)) updates.titulo_proceso = savedDraft.fields.objeto;
          if (savedDraft.fields.justificacion && !/PENDIENTE/.test(savedDraft.fields.justificacion)) updates.justificacion_texto = savedDraft.fields.justificacion;
          if (savedDraft.fields.antecedentes && !/PENDIENTE/.test(savedDraft.fields.antecedentes)) updates.antecedentes_texto = savedDraft.fields.antecedentes;
          if (validItems) updates.items = savedDraft.items.map((r,i)=>{ const previous = adquisicion.items.find(item=>item.descripcion===r.descripcion && item.unidad===r.unidad); const cantidad=Number(r.cantidad.replace(',','.')); return {id:previous?.id || crypto.randomUUID(),item:i+1,descripcion:r.descripcion,unidad:r.unidad,cantidad,precioUnitarioEstimado:previous?.precioUnitarioEstimado || 0,precioTotalEstimado:Math.round(cantidad*(previous?.precioUnitarioEstimado || 0)*100)/100,especificacionMinima:r.especificaciones}; });
          if (Object.keys(updates).length) await DataStore.updateAdquisicion(adquisicion.id, updates);
          if (adquisicion.asistente_compra?.confirmedAt && updates.items) {
            const previous=adquisicion.asistente_compra;
            const next={...previous,items:updates.items.map(i=>({descripcion:i.descripcion,cantidad:String(i.cantidad),unidad:i.unidad,especificaciones:i.especificacionMinima||'',precio:i.precioUnitarioEstimado>0?String(i.precioUnitarioEstimado):''})),
              purpose:savedDraft.editedFields?.includes('justificacion')?savedDraft.fields.justificacion:previous.purpose,
              location:savedDraft.fields.lugar&&!/PENDIENTE/.test(savedDraft.fields.lugar)?savedDraft.fields.lugar:previous.location,
              deliveryDays:savedDraft.fields.plazo?.match(/^(\d+)\s+d[ií]as?\s+calendario/i)?.[1]||previous.deliveryDays};
            if(JSON.stringify({...next,revision:''})!==JSON.stringify({...previous,revision:''})) await DataStore.updateAdquisicion(adquisicion.id,{asistente_compra:{...next,revision:crypto.randomUUID()},lugar_entrega:next.location,plazo_entrega_dias:Number(next.deliveryDays)||0});
          }
        }
        const currentAdq = DataStore.getAdquisicionById(adquisicion.id) || adquisicion;
        const stored = await DataStore.updateAdquisicion(adquisicion.id, {borradores_ia: {...currentAdq.borradores_ia, [model.number]: {draft: savedDraft, briefRevision: currentAdq.asistente_compra?.revision || '', updatedAt: new Date().toISOString()}}});
        if (!stored.success) throw Error(stored.error);
        if (saveOfficial) {
          const people = officialPeople(model.number, savedDraft.fields);
          if (!Object.keys(people).length) throw Error('Completa al menos un nombre o cargo para guardarlo como dato oficial.');
          const synced = await DataStore.syncWithSupabase();
          if (!synced.success) throw Error('El documento está guardado localmente, pero no se pudieron sincronizar los datos oficiales. Vuelve a guardar.');
          const template = DataStore.getPlantillas().find(p => p.fk_carpeta === model.number);
          if (!template) throw Error('No se encontró el formulario para guardar sus responsables oficiales.');
          const company = adquisicion.empresa_id || 'ende';
          const result = await DataStore.updatePlantilla(template.id, {datos_completos: {...template.datos_completos, officialPeopleByCompany: {...template.datos_completos?.officialPeopleByCompany, [company]: {fields: people, updatedAt: new Date().toISOString()}}}});
          if (!result.success) throw Error('Los datos oficiales quedaron en este equipo pendientes de sincronizar. Vuelve a guardar cuando haya conexión.');
        }
        await DataStore.flushPending();
        setDirty(false); setSaveOfficial(false); setEdit(false); setMessage(DataStore.pendingCount() ? "Archivo guardado; el registro tiene cambios pendientes de sincronización." : saveOfficial ? "Documento y responsables oficiales guardados para próximos expedientes." : "Cambios guardados. Esta es la versión actual del documento.");
        if (!DataStore.pendingCount()) localStorage.removeItem(`fixed-draft:${adquisicion.id}:${carpeta.numero}`);
        onSaved();
      } else {
        const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = fileName; a.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
        setMessage("Word descargado para revisión. La descarga no guarda una versión en el expediente.");
      }
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar el documento."); }
    finally { setBusy(false); }
  }
  async function useProposal(key:string) {
    if(!draft?.proposals?.[key])return;
    const proposal=draft.proposals[key];
    if(!proposal.value.trim() || /\[PENDIENTE[^\]]*\]/.test(proposal.value)){setError('La condición todavía contiene un dato sin definir. Completa ese dato antes de confirmarla.');return;}
    const proposals={...draft.proposals};delete proposals[key];
    setDraft({...draft,fields:{...draft.fields,[key]:proposal.value},proposals,sourceIds:{...draft.sourceIds,[key]:[]},sourceQuotes:{...draft.sourceQuotes,[key]:[]}});
    setDirty(true);setStale(true);
    const current=DataStore.getAdquisicionById(adquisicion.id)||adquisicion;
    const brief=initialBrief(current);
    const updated=await DataStore.updateAdquisicion(adquisicion.id,{asistente_compra:{...brief,decisions:{...brief.decisions,[key]:proposal.value},revision:crypto.randomUUID()}});
    if(!updated.success){setError(updated.error||'No se pudo guardar la decisión.');return;}
    setMessage('Condición confirmada para esta compra. Actualiza la vista. Al preparar las demás carpetas se utilizará esta decisión.');onSaved();
  }
  return <section className="space-y-4 text-base">
    <div><h2 className="text-xl font-bold text-primary">{model.title}</h2><p className="mt-1 text-sm text-slate-600">Modelo institucional fijo · Word editable · {dirty ? "Cambios sin guardar en el expediente" : "Documento para revisión"}</p></div>
    {purchaseChanged && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm">El TDR o los datos de la compra cambiaron desde esta versión. Revisa el objeto y los ítems en «Editar documento» antes de utilizar este documento.</p>}
    <fieldset disabled={busy || assistantBusy} className="space-y-4 min-w-0">
      {model.number>4&&adquisicion.asistente_compra?.confirmedAt&&<button className={`${action} bg-primary text-white`} onClick={()=>refresh('complete')}><Sparkles size={16}/>Redactar con los datos de esta compra</button>}
      <div className="flex flex-wrap gap-2"><button className={`${action} bg-primary text-white`} onClick={() => setEdit(v => !v)}><RefreshCw size={16} />{edit ? "Cerrar edición" : "Editar documento"}</button><button className={action} onClick={() => setAiEdit(v => !v)}><Sparkles size={16} />Completar o corregir con IA</button><button className={action} disabled={!draft} onClick={() => download(true)}><Save size={16} />Guardar cambios</button><button className={action} disabled={!draft} onClick={() => download(false)}><Download size={16} />Descargar Word</button></div>
      {aiEdit && <div className="rounded-xl border border-slate-300 p-4 space-y-4 bg-slate-50">
        <label className="block space-y-2"><span className="font-semibold">Describe lo que necesitas o los datos que cambian</span><textarea className={control} rows={4} value={context} onChange={e => {setContext(e.target.value);setDirty(true);}} placeholder="Indica la necesidad, cantidades, plazos o la recepción realizada. La IA utilizará también los datos de este expediente." /></label>
        <label className="block space-y-2"><span>Antecedentes de esta compra (opcional)</span><input className={control} type="file" multiple accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp" onChange={e => setFiles(Array.from(e.target.files || []))} /><span className="text-sm text-slate-600">Hasta tres archivos, 3 MB en total. PDF con texto, Word, TXT o fotos JPG, PNG y WebP. La IA lee las fotos con visión. No se incorporan a la biblioteca normativa.</span></label>
        <button className={`${action} bg-primary text-white`} onClick={() => refresh(context.trim() && !files.length ? "revise" : "complete")}><Sparkles size={16} />Completar con IA</button>
      </div>}
      {edit && draft && <div className="rounded-xl border border-slate-300 p-4 space-y-4 bg-slate-50">
        <p className="text-sm">Edita aquí el contenido y los ítems. «Guardar cambios» actualiza el expediente y el Word, conservando el formato institucional.</p>
        {!!officialPeopleKeys[model.number]?.length && <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm">
          <label className="flex gap-2 items-start"><input type="checkbox" checked={saveOfficial} onChange={e=>setSaveOfficial(e.target.checked)} className="mt-1"/><span className="font-semibold">Usar estos responsables como datos oficiales en próximos expedientes</span></label>
          <p className="mt-2">Se guardan al pulsar «Guardar cambios», para esta empresa y este formulario. Los expedientes anteriores conservan sus datos.</p>
          <ul className="mt-2 space-y-1">{model.fields.filter(f=>officialPeopleKeys[model.number].includes(f.key)).map(f=><li key={f.key}><strong>{f.label}:</strong> {draft.fields[f.key] || 'Sin completar'}</li>)}</ul>
        </div>}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">{model.fields.map(f => <label key={f.key} className="block text-sm"><span className="font-semibold">{f.label}</span>{choiceOptions[f.key]?<select className={`${control} mt-1`} value={draft.fields[f.key]} onChange={e=>changeField(f.key,e.target.value)}><option value="[PENDIENTE]">Sin confirmar</option>{!choiceOptions[f.key].includes(draft.fields[f.key]) && draft.fields[f.key]!=="[PENDIENTE]"&&<option value={draft.fields[f.key]}>{draft.fields[f.key]}</option>}{choiceOptions[f.key].map(v=><option key={v}>{v}</option>)}</select>:<textarea rows={draft.fields[f.key]?.length > 140 ? 5 : 2} className={`${control} mt-1 ${/PENDIENTE/.test(draft.fields[f.key] || "") ? "border-amber-500" : ""}`} value={draft.fields[f.key] || ""} onChange={e => changeField(f.key, e.target.value)} />}{f.normative && <span className="text-slate-600">{draft.sourceIds[f.key]?.length ? `Fundamento: ${draft.sourceIds[f.key].join(", ")}` : "Fundamento pendiente de revisión"}</span>}</label>)}</div>
          {!!model.columns.length && <div className="mt-5 space-y-3"><h3 className="font-semibold">Ítems</h3><div className="overflow-x-auto"><table className="text-sm w-full"><thead><tr>{model.columns.map(c => <th className="p-2" key={c.key}>{c.label}</th>)}<th /></tr></thead><tbody>{draft.items.map((row, i) => <tr key={i}>{model.columns.map(c => <td key={c.key} className="p-1"><textarea aria-label={`${c.label}, ítem ${i+1}`} disabled={c.key === "numero"} className={`${control} min-w-[100px]`} value={row[c.key] || ""} onChange={e => { setDraft({...draft,editedItems:true,items:draft.items.map((r,j)=>j===i?{...r,[c.key]:e.target.value}:r)});setDirty(true);setStale(true); }} /></td>)}<td><button className="text-red-700 p-2" onClick={() => {setDraft({...draft,editedItems:true,items:draft.items.filter((_,j)=>j!==i)});setDirty(true);setStale(true);}}>Quitar</button></td></tr>)}</tbody></table></div><button className={action} onClick={() => {setDraft({...draft,editedItems:true,items:[...draft.items,Object.fromEntries(model.columns.map(c=>[c.key,c.key==='numero'?String(draft.items.length+1):'']))]});setDirty(true);setStale(true);}}>Añadir ítem</button>{model.number===6&&<p className="text-sm">Los precios y condiciones de oferta los completa el proveedor.</p>}</div>}
        <div className="flex flex-wrap gap-2"><button className={`${action} bg-primary text-white`} onClick={()=>download(true)}><Save size={16}/>Guardar cambios</button><button className={action} onClick={()=>refresh()}>Actualizar vista</button></div>
      </div>}
      {!!draft?.proposals && !!Object.keys(draft.proposals).filter(k=>!adquisicion.asistente_compra?.decisions?.[k]).length && <details className="rounded-xl border border-blue-200 p-4 space-y-3"><summary className="font-semibold cursor-pointer">Confirmar condiciones sugeridas por la IA</summary><p className="text-sm text-slate-600">Son sugerencias para esta compra. Confirma las que correspondan o cambia el texto; se reutilizarán en las demás carpetas.</p>{Object.entries(draft.proposals).filter(([key])=>!adquisicion.asistente_compra?.decisions?.[key]).map(([key,p])=><div key={key} className="border-t pt-3 space-y-2"><label className="text-sm font-semibold">{model.fields.find(f=>f.key===key)?.label}<textarea className={`${control} mt-1`} rows={3} value={p.value} onChange={e=>{setDraft({...draft,proposals:{...draft.proposals,[key]:{...p,value:e.target.value}}});setDirty(true);}} /></label><p className="text-sm text-slate-600">{p.reason}</p><button className={action} onClick={()=>useProposal(key)}>Usar esta condición</button></div>)}</details>}
      {stale && <div className="flex flex-wrap items-center gap-3 bg-amber-50 p-3"><span className="text-sm">La vista aún no incluye los últimos cambios.</span><button className={action} onClick={() => refresh()}><RefreshCw size={16} />Actualizar vista</button></div>}
      {!!draft?.warnings.length && <div className="rounded-lg bg-amber-50 p-3 text-sm"><p>{pendingNorms.length ? `Falta confirmar: ${pendingNorms.join(', ')}. Los datos disponibles se muestran en el documento.` : draft.sources.length ? 'El borrador incluye fuentes normativas propuestas. Comprueba su aplicación antes de firmar.' : draft.warnings[0]}</p></div>}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
      {message && <p role="status" className="text-sm text-primary">{message}</p>}
      {busy && <p role="status" className="flex items-center gap-2 text-primary"><Loader2 size={18} className="animate-spin" />Preparando documento… Conservaremos la última vista hasta terminar.</p>}
      {previewWarning && <p className="text-sm text-slate-600">{previewWarning}</p>}
      <h3 className="font-semibold text-lg">Vista previa del documento</h3>
      {pdf ? <iframe title="Vista previa del Word en PDF" src={pdf} className="w-full min-h-[900px] rounded-lg border bg-white" /> : html ? <iframe title="Vista de contenido del Word" sandbox="" srcDoc={documentFrame(html)} className="w-full min-h-[900px] rounded-lg border bg-white" /> : !busy && <div role="status" className="border rounded-lg p-5"><p>No se cargó la vista del documento. Puedes volver a cargarla sin generar con IA.</p><button className={action} onClick={() => refresh()}>Mostrar documento</button></div>}
      {draft && <details className="text-sm border rounded-lg p-3"><summary className="cursor-pointer font-semibold">Fuentes y observaciones</summary><div className="mt-3 space-y-3">{draft.warnings.map((w,i)=><p key={i}>{w}</p>)}{draft.sources.map(s=><div key={s.id}><strong>{s.id} · {s.title}</strong><p>Página {s.page} · versión {s.version}</p><p className="whitespace-pre-wrap mt-1">{s.excerpt}</p></div>)}<p>{draft.consultedAt?`Consulta: ${new Date(draft.consultedAt).toLocaleString('es-BO')}`:'Aún no se han consultado las normas.'}</p></div></details>}
      <details className="text-sm"><summary className="cursor-pointer">Versiones y recuperación</summary><button className="underline my-3" onClick={recover}>Recuperar últimos cambios de este equipo</button>{carpeta.documentos.filter(d=>d.ruta_storage).map(d=><p key={d.id} className="py-1"><a className="text-primary underline" href={`/api/files?path=${encodeURIComponent(d.ruta_storage!)}`}>{d.nombre_original} · {d.estado}</a></p>)}</details>
    </fieldset>
  </section>;
}
