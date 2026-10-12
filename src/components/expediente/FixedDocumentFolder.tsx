"use client";
import React, { useEffect, useRef, useState } from "react";
import { Download, Loader2, Save, Sparkles, RefreshCw } from "lucide-react";
import type { Adquisicion, Carpeta, Documento } from "@/types";
import { fixedModel, FixedDraft, compatibleFixedDraft, upgradeFixedDraft } from "@/lib/docx/fixedModels";
import { DataStore } from "@/lib/store/dataStore";
import { officialPeople, officialPeopleKeys } from "@/lib/docx/officialPeople";
import { initialBrief } from '@/lib/docx/purchaseBrief';
import { EditableDocument } from './EditableDocument';

const control = "w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900 focus:ring-2 focus:ring-blue-600";
const action = "inline-flex items-center gap-2 rounded-lg border border-amber-500 bg-amber-400 hover:bg-amber-500 text-slate-950 shadow-sm px-4 py-2 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer";
const purchaseSnapshot = (adq: Adquisicion) => JSON.stringify({ title: adq.titulo_proceso, items: adq.items, background: adq.antecedentes_texto, reason: adq.justificacion_texto });
function documentFrame(html: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><style>body{max-width:760px;margin:0 auto;padding:20px;font:14px Arial;color:#151515;background:white;line-height:1.45}img{display:block;max-width:180px;max-height:100px;width:auto;height:auto;object-fit:contain;margin:0 auto 16px}table{border-collapse:collapse;width:100%;margin:18px 0;table-layout:auto}td,th{border:1px solid #888;padding:7px;overflow-wrap:anywhere}p{white-space:pre-wrap}h1,h2{text-align:center}a{color:inherit}</style></head><body>${html}</body></html>`;
}
export function FixedDocumentFolder({ adquisicion, carpeta, onSaved, assistantBusy=false }: { adquisicion: Adquisicion; carpeta: Carpeta; onSaved: () => void; assistantBusy?:boolean }) {
  const model = fixedModel(carpeta.numero);
  const latest = [...carpeta.documentos].sort((a,b)=>b.fecha_creacion.localeCompare(a.fecha_creacion)).find(d => compatibleFixedDraft(model.number,d.metadata?.fixedDraft));
  const purchaseChanged = model.number !== 1 && ((latest?.metadata?.purchaseSnapshot && latest.metadata.purchaseSnapshot !== purchaseSnapshot(adquisicion)) || (adquisicion.borradores_ia?.[model.number] && adquisicion.borradores_ia[model.number].briefRevision !== adquisicion.asistente_compra?.revision));
  const prepared = adquisicion.borradores_ia?.[model.number];
  const storedInitial = compatibleFixedDraft(model.number,prepared?.draft) && prepared && (!latest || prepared.updatedAt > latest.fecha_creacion) ? prepared.draft : latest?.metadata?.fixedDraft;
  const initial = storedInitial ? upgradeFixedDraft(model.number,storedInitial) : undefined;
  const [recovery] = useState(() => {
    try {
      const value = JSON.parse(localStorage.getItem(`fixed-draft:${adquisicion.id}:${carpeta.numero}`) || 'null');
      const storedAt = Math.max(Date.parse(prepared?.updatedAt || '') || 0, Date.parse(latest?.fecha_creacion || '') || 0);
      return compatibleFixedDraft(model.number,value?.draft) && value.draft.companyId === (adquisicion.empresa_id || 'ende') && value.updatedAt > storedAt ? {...value,draft:upgradeFixedDraft(model.number,value.draft)} : null;
    } catch { return null; }
  });
  const [draft, setDraft] = useState<FixedDraft | null>(recovery?.draft || initial || null);
  const [context, setContext] = useState(recovery?.context || "");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(!!recovery);
  const [stale, setStale] = useState(false);
  const [html, setHtml] = useState("");
  const [editableHtml,setEditableHtml]=useState('');
  const [pdf, setPdf] = useState<string | null>(null);
  const [previewWarning, setPreviewWarning] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [edit, setEdit] = useState(!!recovery);
  const [aiEdit, setAiEdit] = useState(false);
  const [clarification, setClarification] = useState('');
  const [pendingInstruction, setPendingInstruction] = useState('');
  const [undoDraft, setUndoDraft] = useState<FixedDraft | null>(null);
  const [saveOfficial, setSaveOfficial] = useState(false);
  const mounted = useRef(true);
  const requestVersion = useRef(0);
  const pdfUrl = useRef<string | null>(null);
  const storedVersion=useRef(`${prepared?.updatedAt||''}:${latest?.fecha_creacion||''}`);
  const pendingNorms = model.fields.filter(f=>f.normative && !draft?.confirmedFields?.includes(f.key) && !adquisicion.asistente_compra?.decisions?.[model.number===2&&f.key==='categoria'?'categoria_s1':f.key] && (!draft?.sourceIds[f.key]?.length || /PENDIENTE/.test(draft?.fields[f.key] || ''))).map(f=>f.label);
  const evaluationChanged=model.number===6&&!!draft&&!!adquisicion.quote_evaluation&&draft.evaluationRevision!==adquisicion.quote_evaluation.updatedAt;
  async function request(kind: string, selectedDraft=draft) {
    const form = new FormData();
    form.append("request", JSON.stringify({ action: kind, number: model.number, adquisicion, draft:selectedDraft, context: pendingInstruction ? `${pendingInstruction}\nRespuesta del usuario: ${context}` : context }));
    if (kind === "complete" || kind === "revise") files.forEach(f => form.append("attachments", f));
    const res = await fetch("/api/fixed-documents", { method: "POST", body: form });
    if (!res.ok) { let message = "No se pudo preparar el documento."; try { message = (await res.json()).error || message; } catch {} throw Error(message); }
    return res;
  }
  async function refresh(kind = "preview", selectedDraft=draft) {
    const version = ++requestVersion.current;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await (await request(kind,selectedDraft)).json();
      if (!mounted.current || version !== requestVersion.current) return;
      if (result.question) { setClarification(result.question); setPendingInstruction(result.instruction || context); setContext(''); setAiEdit(true); return; }
      if (kind === 'complete' || kind === 'revise' || kind === 'refresh-evaluation') {setUndoDraft(draft);setClarification('');setPendingInstruction('');}
      setDraft(result.draft); setHtml(result.html);setEditableHtml(result.editableHtml||''); setPreviewWarning(result.previewWarning); setStale(false);
      if (pdfUrl.current) URL.revokeObjectURL(pdfUrl.current);
      pdfUrl.current = result.pdf ? URL.createObjectURL(new Blob([Uint8Array.from(atob(result.pdf), c => c.charCodeAt(0))], { type: "application/pdf" })) : null;
      setPdf(pdfUrl.current);
      if (kind === "complete" || kind === "revise" || kind === 'refresh-evaluation') { setDirty(true); setAiEdit(false); setContext(""); setFiles([]); setMessage(kind==='refresh-evaluation'?'Cuadro y conclusiones actualizados desde las cotizaciones guardadas. Puedes editarlos y guardar el informe.':result.revised ? `Cambios aplicados: ${(result.revisionSummary || []).join(", ") || "el documento ya contiene los datos solicitados"}. Revisa la vista y pulsa Guardar cambios.` : "Datos incorporados al borrador. Revisa los campos pendientes antes de guardarlo."); }
    } catch (e) { if (mounted.current && version === requestVersion.current) setError(e instanceof Error ? e.message : "No se pudo actualizar."); }
    finally { if (mounted.current && version === requestVersion.current) setBusy(false); }
  }
  useEffect(() => {
    mounted.current = true; void refresh();
    return () => { mounted.current = false; requestVersion.current++; if (pdfUrl.current) URL.revokeObjectURL(pdfUrl.current); };
  }, []);
  useEffect(()=>{
    const version=`${prepared?.updatedAt||''}:${latest?.fecha_creacion||''}`;
    if(storedVersion.current===version)return;
    if(busy||assistantBusy)return;
    storedVersion.current=version;
    if(initial&&!dirty)void refresh('preview',initial);
  },[prepared?.updatedAt,latest?.fecha_creacion,assistantBusy,busy]);
  // Persist the draft locally on edits; server-backed versioning occurs only on explicit Save.
  useEffect(() => {
    if (!dirty || !draft) return;
    const key = `fixed-draft:${adquisicion.id}:${carpeta.numero}`;
    try { localStorage.setItem(key, JSON.stringify({ draft, context, updatedAt: Date.now() })); } catch { setMessage("No se pudo guardar la recuperación local. Guarda el borrador antes de salir."); }
  }, [draft, context, dirty, adquisicion.id, carpeta.numero]);
  async function recover() {
    try {
      const value = JSON.parse(localStorage.getItem(`fixed-draft:${adquisicion.id}:${carpeta.numero}`) || "null");
      if (!compatibleFixedDraft(model.number,value?.draft)) { setMessage("No hay cambios locales de esta versión para recuperar."); return; }
      const recovered=upgradeFixedDraft(model.number,value.draft);
      setDraft(recovered); setContext(value.context || ""); setDirty(true); setStale(true); setEdit(true);
      await refresh('preview',recovered);
      setMessage("Cambios recuperados en el documento. Pulsa «Guardar cambios» para conservarlos en el expediente.");
    } catch { setError("No se pudo recuperar el borrador local."); }
  }
  function changeField(key: string, value: string) {
    setDraft(previous=>previous?{ ...previous, fields: { ...previous.fields, [key]: value }, sourceIds: { ...previous.sourceIds, [key]: [] }, sourceQuotes: {...previous.sourceQuotes,[key]:[]}, editedFields: Array.from(new Set([...(previous.editedFields || []),key])) }:previous); setDirty(true); setStale(true); setMessage("");
  }
  function changeItem(row:number,key:string,value:string){
    setDraft(previous=>{
      if(!previous)return previous;
      const items=previous.items.length?previous.items:[Object.fromEntries(model.columns.map(c=>[c.key,c.key==='numero'?'1':'']))];
      return {...previous,editedItems:true,items:items.map((item,index)=>index===row?{...item,[key]:value}:item)};
    });
    setDirty(true);setStale(true);setMessage('');
  }
  function replaceItems(items:FixedDraft['items']){
    if(!draft)return;
    const next={...draft,editedItems:true,items:items.map((item,index)=>({...item,numero:String(index+1)}))};
    setDraft(next);setDirty(true);setStale(true);void refresh('preview',next);
  }
  function toggleEditing(){
    setEdit(!edit);
    if((edit&&stale)||(!edit&&!editableHtml))void refresh();
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
          if ((adquisicion.asistente_compra?.confirmedAt || adquisicion.asistente_compra?.preparedAt) && updates.items) {
            const previous=adquisicion.asistente_compra;
            const next={...previous,items:updates.items.map(i=>({descripcion:i.descripcion,cantidad:String(i.cantidad),unidad:i.unidad,especificaciones:i.especificacionMinima||'',precio:i.precioUnitarioEstimado>0?String(i.precioUnitarioEstimado):''})),
              purpose:savedDraft.editedFields?.includes('justificacion')?savedDraft.fields.justificacion:previous.purpose,
              location:savedDraft.fields.lugar&&!/PENDIENTE/.test(savedDraft.fields.lugar)?savedDraft.fields.lugar:previous.location,
              deliveryDays:savedDraft.fields.plazo?.match(/^(\d+)\s+d[ií]as?\s+calendario/i)?.[1]||previous.deliveryDays};
            if(JSON.stringify({...next,revision:''})!==JSON.stringify({...previous,revision:''})) await DataStore.updateAdquisicion(adquisicion.id,{asistente_compra:{...next,revision:crypto.randomUUID()},lugar_entrega:next.location,plazo_entrega_dias:Number(next.deliveryDays)||0});
          }
        }
        const currentAdq = DataStore.getAdquisicionById(adquisicion.id) || adquisicion;
        if(model.number===2)await DataStore.updateAdquisicion(adquisicion.id,{solicitud_numero:savedDraft.fields.numero});
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
          const refreshed=DataStore.getAdquisicionById(adquisicion.id)||adquisicion;
          await DataStore.updateAdquisicion(adquisicion.id,{responsables_oficiales:{...refreshed.responsables_oficiales,[model.number]:people}});
        }
        await DataStore.flushPending();
        await refresh('preview',savedDraft);
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

  // Show recommended clauses in older drafts too, without treating them as user decisions.
  useEffect(() => {
    if (draft?.proposals && Object.keys(draft.proposals).length > 0) {
      const pendingKeys = Object.keys(draft.proposals).filter(k => draft.proposals![k]?.value && !draft.editedFields?.includes(k) && (!draft.fields[k] || draft.fields[k] === '[PENDIENTE]'));
      if (pendingKeys.length > 0) {
        const mergedFields = { ...draft.fields };
        for (const k of pendingKeys) {
          mergedFields[k] = draft.proposals![k].value;
        }
        setDraft(d => d ? { ...d, fields: mergedFields } : null);
        setDirty(true);setStale(true);
      }
    }
  }, [draft?.proposals]);

  const suggestedKeys=Object.keys(draft?.proposals||{}).filter(key=>draft?.proposals?.[key]?.value===draft?.fields[key]&&!draft?.confirmedFields?.includes(key));
  async function confirmSuggestions() {
    if(!draft)return;
    setError('');
    try {
      const decisions=Object.fromEntries(suggestedKeys.map(key=>[model.number===2&&key==='categoria'?'categoria_s1':key,draft.fields[key]]));
      const current=DataStore.getAdquisicionById(adquisicion.id)||adquisicion;
      const brief=initialBrief(current);
      const result=await DataStore.updateAdquisicion(adquisicion.id,{asistente_compra:{...brief,decisions:{...brief.decisions,...decisions},revision:crypto.randomUUID()}});
      if(!result.success)throw Error(result.error);
      setDraft({...draft,confirmedFields:Array.from(new Set([...(draft.confirmedFields||[]),...suggestedKeys]))});
      setDirty(true);setMessage('Condiciones elegidas para esta compra. Guarda los cambios del documento.');
    }catch(e){setError(e instanceof Error?e.message:'No se pudieron conservar las condiciones.');}
  }

  return <section className="space-y-4 text-base">
    <div><h2 className="text-xl font-bold text-primary">{model.title}</h2><p className="mt-1 text-sm text-slate-600">Modelo institucional fijo · Word editable · {dirty ? "Cambios sin guardar en el expediente" : "Documento para revisión"}</p></div>
    {purchaseChanged && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm">El TDR o los datos de la compra cambiaron desde esta versión. Revisa el objeto y los ítems en «Editar documento» antes de utilizar este documento.</p>}
    <fieldset disabled={busy || assistantBusy} className="space-y-4 min-w-0">
      {!!suggestedKeys.length&&<details className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm"><summary className="cursor-pointer font-semibold">Condiciones sugeridas ya incluidas en el documento</summary><p className="mt-2">Puedes usarlas o cambiarlas en «Editar documento». Son propuestas para esta compra.</p><div className="my-3 space-y-3">{suggestedKeys.map(key=><div key={key}><strong>{model.fields.find(f=>f.key===key)?.label||key}</strong><p className="whitespace-pre-wrap">{draft!.fields[key]}</p><p className="text-slate-600">{draft!.proposals![key].reason}</p></div>)}</div><button className={action} onClick={confirmSuggestions}>Usar estas condiciones para esta compra</button></details>}
      {model.number===2&&<p className="text-sm text-slate-600">El número se propone desde el código del expediente. Cargo, área y responsable de recepción se completan con los datos oficiales disponibles. Todo se puede editar.</p>}
      {model.number===6&&<div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2 text-sm"><p>Informe técnico de evaluación basado en el modelo aportado. Puedes editar libremente los párrafos y el cuadro de proveedores.</p>{evaluationChanged&&<p className="font-semibold">Las cotizaciones cambiaron desde esta versión del informe.</p>}{adquisicion.quote_evaluation?.quotes.length?<button className={action} onClick={()=>refresh('refresh-evaluation')}>Actualizar cuadro y conclusiones desde cotizaciones</button>:<p>Guarda la comparación en la carpeta 4 para incorporar sus proveedores, precios y resultados automáticamente.</p>}</div>}
      {model.number>4&&(adquisicion.asistente_compra?.confirmedAt||adquisicion.asistente_compra?.preparedAt)&&<button className={action} onClick={()=>refresh('complete')}><Sparkles size={16}/>Redactar con los datos de esta compra</button>}
      <div className="flex flex-wrap gap-2">
        <button className={action} onClick={toggleEditing}>
          <RefreshCw size={16} />{edit ? "Cerrar edición" : "Editar documento"}
        </button>
        <button className={action} onClick={() => setAiEdit(v => !v)}>
          <Sparkles size={16} />Completar o corregir con IA
        </button>
        <button className={action} disabled={!draft} onClick={() => download(true)}>
          <Save size={16} />Guardar cambios
        </button>
        <button className={action} disabled={!draft} onClick={() => download(false)}>
          <Download size={16} />Descargar Word
        </button>
      </div>
      {aiEdit && <div className="rounded-xl border border-slate-300 p-4 space-y-4 bg-slate-50">
        {clarification && <div role="status" className="rounded-lg border border-blue-200 bg-blue-50 p-3"><p className="font-semibold">{clarification}</p><p className="text-sm mt-1">Responde abajo; conservaré tu petición anterior. El documento sigue igual.</p></div>}
        <label className="block space-y-2"><span className="font-semibold">Describe lo que necesitas o los datos que cambian</span><textarea className={control} rows={4} value={context} onChange={e => {setContext(e.target.value);setDirty(true);}} placeholder="Ejemplo: cambia la entrega a 45 días, pon a María Pérez como responsable y cambia la cantidad del ítem 2 a 20 pares." /></label>
        <label className="block space-y-2"><span>Antecedentes de esta compra (opcional)</span><input className={control} type="file" multiple accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp" onChange={e => setFiles(Array.from(e.target.files || []))} /><span className="text-sm text-slate-600">Hasta tres archivos, 3 MB en total. PDF con texto o escaneado, Word, TXT o fotos JPG, PNG y WebP. La IA lee las imágenes con visión. No se incorporan a la biblioteca normativa.</span></label>
        <button className={action} onClick={() => refresh(context.trim() || pendingInstruction ? "revise" : "complete")}><Sparkles size={16} />{clarification ? "Responder al asistente" : "Aplicar cambios con IA"}</button>
      </div>}
      {edit && draft && !!officialPeopleKeys[model.number]?.length && <details className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm">
          <summary className="cursor-pointer font-semibold">Responsables para próximos expedientes</summary>
          <label className="flex gap-2 items-start"><input type="checkbox" checked={saveOfficial} onChange={e=>setSaveOfficial(e.target.checked)} className="mt-1"/><span className="font-semibold">Usar estos responsables como datos oficiales en próximos expedientes</span></label>
          <p className="mt-2">Se guardan al pulsar «Guardar cambios», para esta empresa y este formulario. Los expedientes anteriores conservan sus datos.</p>
          <ul className="mt-2 space-y-1">{model.fields.filter(f=>officialPeopleKeys[model.number].includes(f.key)).map(f=><li key={f.key}><strong>{f.label}:</strong> {draft.fields[f.key] || 'Sin completar'}</li>)}</ul>
      </details>}
      {stale && !edit && <div className="flex flex-wrap items-center gap-3 bg-amber-50 p-3"><span className="text-sm">La vista aún no incluye los últimos cambios.</span><button className={action} onClick={() => refresh()}><RefreshCw size={16} />Actualizar vista</button></div>}
      {!!draft?.warnings.length && <div className="rounded-lg bg-amber-50 p-3 text-sm"><p>{suggestedKeys.length?'El borrador está redactado con condiciones sugeridas editables. Revisa los detalles antes de firmar.':pendingNorms.length ? `Por revisar: ${pendingNorms.join(', ')}. Los datos disponibles se muestran en el documento.` : draft.sources.length ? 'El borrador incluye fuentes normativas propuestas. Comprueba su aplicación antes de firmar.' : draft.warnings[0]}</p></div>}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
      {message && <p role="status" className="text-sm text-primary">{message}</p>}
      {undoDraft && <button className={action} onClick={async()=>{setDraft(undoDraft);setUndoDraft(null);setDirty(true);setStale(true);await refresh('preview',undoDraft);setMessage('Último cambio deshecho en el documento. Guarda para conservar esta versión.');}}>Deshacer último cambio del asistente</button>}
      {busy && <p role="status" className="flex items-center gap-2 text-primary"><Loader2 size={18} className="animate-spin" />Preparando documento… Conservaremos la última vista hasta terminar.</p>}
      {previewWarning && <p className="text-sm text-slate-600">{previewWarning}</p>}
      <h3 className="font-semibold text-lg">{edit?'Documento editable':'Vista previa del documento'}</h3>
      {edit&&draft ? editableHtml ? <EditableDocument html={editableHtml} draft={draft} model={model} disabled={busy||assistantBusy}
        onFieldChange={changeField} onItemChange={changeItem}
        onAddItem={()=>replaceItems([...draft.items,Object.fromEntries(model.columns.map(c=>[c.key,c.key==='numero'?String(draft.items.length+1):'']))])}
        onRemoveItem={row=>replaceItems(draft.items.filter((_,index)=>index!==row))}/>
        : !busy&&<div role="status" className="rounded-lg border p-4">No se cargó el documento editable. <button className={action} onClick={()=>refresh()}>Cargar documento</button></div>
        : pdf ? <iframe title="Vista previa del Word en PDF" src={pdf} className="w-full min-h-[900px] rounded-lg border bg-white" /> : html ? <iframe title="Vista de contenido del Word" sandbox="" srcDoc={documentFrame(html)} className="w-full min-h-[900px] rounded-lg border bg-white" /> : !busy && <div role="status" className="border rounded-lg p-5"><p>No se cargó la vista del documento. Puedes volver a cargarla sin generar con IA.</p><button className={action} onClick={() => refresh()}>Mostrar documento</button></div>}
      {draft && <details className="text-sm border rounded-lg p-3"><summary className="cursor-pointer font-semibold">Fuentes y observaciones</summary><div className="mt-3 space-y-3">{draft.warnings.map((w,i)=><p key={i}>{w}</p>)}{draft.sources.map(s=><div key={s.id}><strong>{s.id} · {s.title}</strong><p>Página {s.page} · versión {s.version}</p><p className="whitespace-pre-wrap mt-1">{s.excerpt}</p></div>)}<p>{draft.consultedAt?`Consulta: ${new Date(draft.consultedAt).toLocaleString('es-BO')}`:'Aún no se han consultado las normas.'}</p></div></details>}
      <details className="text-sm"><summary className="cursor-pointer">Versiones y recuperación</summary><button className="underline my-3" onClick={recover}>Recuperar últimos cambios de este equipo</button>{carpeta.documentos.filter(d=>d.ruta_storage).map(d=><p key={d.id} className="py-1"><a className="text-primary underline" href={`/api/files?path=${encodeURIComponent(d.ruta_storage!)}`}>{d.nombre_original} · {d.estado}</a></p>)}</details>
    </fieldset>
  </section>;
}
