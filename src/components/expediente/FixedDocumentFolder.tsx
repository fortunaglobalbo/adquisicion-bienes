"use client";
import React, { useEffect, useRef, useState } from "react";
import { Download, Loader2, Save, Sparkles } from "lucide-react";
import type { Adquisicion, Carpeta, Documento } from "@/types";
import { fixedModel, FixedDraft, compatibleFixedDraft, upgradeFixedDraft, fixedDocumentBelongsToModel, newFixedItem } from "@/lib/docx/fixedModels";
import { DataStore } from "@/lib/store/dataStore";
import { officialPeople, officialPeopleKeys } from "@/lib/docx/officialPeople";
import { comparativeSnapshot } from '@/lib/procurement/comparativeReport';
import { EditableDocument } from './EditableDocument';
import { appendPurchaseAttachments, cleanupPurchaseAttachmentUploads } from '@/lib/uploads/attachmentClient';
import { ATTACHMENT_HELP_TEXT, validateAttachmentSelection } from '@/lib/uploads/attachmentPolicy';
import { displayFolderNumber, TECHNICAL_JUSTIFICATION_MODEL } from '@/lib/store/folderOrder';

const control = "w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900 focus:ring-2 focus:ring-blue-600";
const action = "inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-primary hover:bg-slate-100 focus-visible:outline-2 disabled:opacity-50 disabled:cursor-not-allowed";
const purchaseSnapshot = (adq: Adquisicion) => JSON.stringify({ title: adq.titulo_proceso, items: adq.items, background: adq.antecedentes_texto, reason: adq.justificacion_texto });
export function FixedDocumentFolder({ adquisicion, carpeta, modelNumber=carpeta.numero, onSaved, assistantBusy=false }: { adquisicion: Adquisicion; carpeta: Carpeta; modelNumber?: number; onSaved: () => void; assistantBusy?:boolean }) {
  const model = fixedModel(modelNumber);
  const modelDocuments = carpeta.documentos.filter(document => {
    if (modelNumber !== carpeta.numero) return fixedDocumentBelongsToModel(modelNumber, document);
    if (carpeta.numero === 5 && fixedDocumentBelongsToModel(TECHNICAL_JUSTIFICATION_MODEL, document)) return false;
    return !Number.isInteger(document.metadata?.fixedModelNumber) || document.metadata?.fixedModelNumber === modelNumber;
  });
  const latest = modelDocuments
    .filter(document => fixedDocumentBelongsToModel(modelNumber, document) && compatibleFixedDraft(modelNumber, document.metadata?.fixedDraft))
    .sort((a,b)=>b.fecha_creacion.localeCompare(a.fecha_creacion))[0];
  const recoveryKey = `fixed-draft:${adquisicion.id}:${modelNumber}`;
  const purchaseChanged = ![1,3].includes(model.number) && ((latest?.metadata?.purchaseSnapshot && latest.metadata.purchaseSnapshot !== purchaseSnapshot(adquisicion)) || (adquisicion.borradores_ia?.[model.number] && adquisicion.borradores_ia[model.number].briefRevision !== adquisicion.asistente_compra?.revision));
  const prepared = adquisicion.borradores_ia?.[model.number];
  const storedInitial = compatibleFixedDraft(model.number,prepared?.draft) && prepared && (!latest || prepared.updatedAt > latest.fecha_creacion) ? prepared.draft : latest?.metadata?.fixedDraft;
  const initial = storedInitial ? upgradeFixedDraft(model.number,storedInitial) : undefined;
  const [recovery] = useState(() => {
    try {
      const value = JSON.parse(localStorage.getItem(recoveryKey) || 'null');
      const storedAt = Math.max(Date.parse(prepared?.updatedAt || '') || 0, Date.parse(latest?.fecha_creacion || '') || 0);
      return compatibleFixedDraft(model.number,value?.draft) && value.draft.companyId === (adquisicion.empresa_id || 'ende') && value.updatedAt > storedAt ? {...value,draft:upgradeFixedDraft(model.number,value.draft)} : null;
    } catch { return null; }
  });
  const [draft, setDraft] = useState<FixedDraft | null>(recovery?.draft || initial || null);
  const [context, setContext] = useState(recovery?.context || "");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(true);
  const [dirty, setDirty] = useState(!!recovery);
  const [editableHtml,setEditableHtml]=useState('');
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [aiEdit, setAiEdit] = useState(!!recovery?.context);
  const [clarification, setClarification] = useState('');
  const [pendingInstruction, setPendingInstruction] = useState('');
  const [undoDraft, setUndoDraft] = useState<FixedDraft | null>(null);
  const [saveOfficial, setSaveOfficial] = useState(false);
  const mounted = useRef(true);
  const requestVersion = useRef(0);
  const requestController = useRef<AbortController | null>(null);
  const storedVersion=useRef(`${prepared?.updatedAt||''}:${latest?.fecha_creacion||''}`);
  const comparisonRevision=adquisicion.comparative_report && (!adquisicion.quote_evaluation || adquisicion.comparative_report.updatedAt>adquisicion.quote_evaluation.updatedAt)?adquisicion.comparative_report.revision:adquisicion.quote_evaluation?.updatedAt;
  const evaluationChanged=model.number===6&&!!draft&&!!comparisonRevision&&draft.evaluationRevision!==comparisonRevision;
  const comparativeChanged=model.number===3&&!!draft&&!!adquisicion.comparative_report&&(draft.evaluationRevision!==adquisicion.comparative_report.revision || !!draft.comparativeSnapshot&&draft.comparativeSnapshot!==comparativeSnapshot(adquisicion));
  async function request(kind: string, selectedDraft=draft, signal?: AbortSignal) {
    const form = new FormData();
    form.append("request", JSON.stringify({ action: kind, editorOnly:true, number: model.number, adquisicion, draft:selectedDraft, context: pendingInstruction ? `${pendingInstruction}\nRespuesta del usuario: ${context}` : context }));
    try {
      if (kind === "complete" || kind === "revise") await appendPurchaseAttachments(form, files, adquisicion.id, { signal,
        onProgress: ({ completed, total }) => { if (mounted.current && !signal?.aborted) setMessage(`Subiendo archivos… (${completed} de ${total})`); } });
      const res = await fetch("/api/fixed-documents", { method: "POST", body: form, signal });
      if (!res.ok) { let message = "No se pudo preparar el documento."; try { message = (await res.json()).error || message; } catch {} throw Error(message); }
      return res;
    } finally { void cleanupPurchaseAttachmentUploads(form, adquisicion.id); }
  }
  async function refresh(kind = "preview", selectedDraft=draft) {
    requestController.current?.abort();
    const controller = new AbortController(); requestController.current = controller;
    const version = ++requestVersion.current;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await (await request(kind,selectedDraft,controller.signal)).json();
      if (!mounted.current || version !== requestVersion.current) return;
      if (result.question) { setClarification(result.question); setPendingInstruction(result.instruction || context); setContext(''); setAiEdit(true); return; }
      const assigned = result.solicitudNumeroAsignado;
      if (modelNumber === 2 && typeof assigned === 'string' && assigned === result.draft?.fields.numero) {
        const current = DataStore.getAdquisicionById(adquisicion.id);
        if (current && current.solicitud_numero !== assigned && current.solicitud_numero === adquisicion.solicitud_numero) {
          await DataStore.updateAdquisicion(adquisicion.id, { solicitud_numero: assigned });
        }
        if (!mounted.current || version !== requestVersion.current) return;
      }
      if (kind === 'complete' || kind === 'revise' || kind === 'refresh-evaluation' || kind === 'refresh-comparative') {setUndoDraft(draft);setClarification('');setPendingInstruction('');}
      setDraft(result.draft);
      setEditableHtml(result.editableHtml || '');
      if (kind === "complete" || kind === "revise" || kind === 'refresh-evaluation' || kind === 'refresh-comparative') {
        setDirty(true);
        const keepAttachments = model.number === 7 && !!result.generationNotice && files.length > 0;
        setAiEdit(keepAttachments);
        if (!keepAttachments) { setContext(""); setFiles([]); }
        setMessage(keepAttachments ? 'La IA no completó la lectura. Los archivos siguen seleccionados para volver a generar el informe.' : result.generationNotice || (kind==='refresh-evaluation'||kind==='refresh-comparative'?'Cuadro y conclusiones actualizados desde las cotizaciones guardadas. Puedes editarlos y guardar el informe.':result.revised ? `Cambios aplicados: ${(result.revisionSummary || []).join(", ") || "el documento ya contiene los datos solicitados"}. Revisa la vista y pulsa Guardar cambios.` : "Documento actualizado. Pulsa «Guardar cambios» para conservarlo."));
      }
    } catch (e) { if (mounted.current && version === requestVersion.current) setError(e instanceof Error ? e.message : "No se pudo actualizar."); }
    finally { if (requestController.current === controller) requestController.current = null; if (mounted.current && version === requestVersion.current) setBusy(false); }
  }
  useEffect(() => {
    mounted.current = true; void refresh();
    return () => { mounted.current = false; requestVersion.current++; requestController.current?.abort(); };
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
    const key = recoveryKey;
    try { localStorage.setItem(key, JSON.stringify({ draft, context, updatedAt: Date.now() })); } catch { setMessage("No se pudo guardar la recuperación local. Guarda el borrador antes de salir."); }
  }, [draft, context, dirty, recoveryKey]);
  function changeField(key: string, value: string) {
    setDraft(previous=>previous?{ ...previous, fields: { ...previous.fields, [key]: value }, sourceIds: { ...previous.sourceIds, [key]: [] }, sourceQuotes: {...previous.sourceQuotes,[key]:[]}, editedFields: Array.from(new Set([...(previous.editedFields || []),key])) }:previous); setDirty(true); setMessage("");
  }
  function changeItem(row:number,key:string,value:string){
    setDraft(previous=>{
      if(!previous)return previous;
      const items=previous.items.length?previous.items:[newFixedItem(model,0)];
      return {...previous,editedItems:true,items:items.map((item,index)=>index===row?{...item,[key]:value}:item)};
    });
    setDirty(true);setMessage('');
  }
  function replaceItems(items:FixedDraft['items']){
    if(!draft)return;
    const next={...draft,editedItems:true,items:items.map((item,index)=>({...item,numero:String(index+1)}))};
    setDraft(next);setDirty(true);void refresh('preview',next);
  }
  async function download(save: boolean) {
    if (!draft) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const exported = await (await request("export")).json();
      const savedDraft: FixedDraft = exported.draft;
      const blob = new Blob([Uint8Array.from(atob(exported.docx), c => c.charCodeAt(0))], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
      setDraft(savedDraft);
      const fileLabel = modelNumber === TECHNICAL_JUSTIFICATION_MODEL ? 'informe_tecnico' : displayFolderNumber(modelNumber);
      const version = modelDocuments.length + 1;
      const fileName = `${adquisicion.codigo}_${fileLabel}_v${version}.docx`;
      if (save) {
        const form = new FormData(); form.append("file", blob, fileName); form.append("adquisicion_id", adquisicion.id);
        const res = await fetch("/api/files", { method: "POST", body: form });
        const data = await res.json(); if (!res.ok) throw Error("No se pudo guardar el Word en el expediente. Tu borrador se conserva; puedes descargarlo e intentar guardar después.");
        const doc: Documento = { id: crypto.randomUUID(), carpeta_id: carpeta.id, adquisicion_id: adquisicion.id, tipo: "GENERADO_DOCX", nombre_original: fileName,
          ruta_storage: data.path, mime: blob.type, tamano: blob.size, estado: "Borrador", version, creado_por: "Operador", fecha_creacion: new Date().toISOString(),
          contenido_texto: Object.entries(savedDraft.fields).map(([k,v]) => `${k}: ${v}`).join("\n"), metadata: { fixedModelNumber: model.number, fixedDraft: savedDraft, templateVersion: model.version, companyId: savedDraft.companyId, purchaseSnapshot: purchaseSnapshot(adquisicion), generatedWith: savedDraft.consultedAt ? "OpenCode GO / edición del usuario" : "Datos del expediente / edición del usuario" } };
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
        const stored = await DataStore.updateAdquisicion(adquisicion.id, {borradores_ia: {...currentAdq.borradores_ia, [model.number]: {draft: savedDraft, briefRevision: model.number===3?currentAdq.comparative_report?.revision||'':currentAdq.asistente_compra?.revision || '', updatedAt: new Date().toISOString()}}});
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
        setDirty(false); setSaveOfficial(false); setMessage(DataStore.pendingCount() ? "Documento guardado en este equipo. Falta sincronizarlo." : saveOfficial ? "Documento y responsables oficiales guardados para próximos expedientes." : "Cambios guardados.");
        if (!DataStore.pendingCount()) localStorage.removeItem(recoveryKey);
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
        setDirty(true);
      }
    }
  }, [draft?.proposals]);

  return <section className="space-y-4 text-base">
    <div className="flex flex-wrap items-baseline gap-x-3">
      <h2 className="text-xl font-bold text-primary">{model.title}</h2>
      {dirty && <span role="status" className="text-sm text-slate-600">Cambios sin guardar</span>}
    </div>
    {purchaseChanged && <p role="status" className="text-sm text-amber-800">Los datos de la compra cambiaron. Revisa el objeto y los ítems.</p>}
    <fieldset disabled={busy || assistantBusy} className="space-y-4 min-w-0">
      {model.number===3&&comparativeChanged&&<div className="rounded-lg bg-amber-50 p-3 text-sm"><p>Las cotizaciones o el requerimiento cambiaron desde esta versión. Tus correcciones manuales se conservarán.</p><button className={action} onClick={()=>refresh('refresh-comparative')}>Actualizar cuadro desde cotizaciones</button></div>}
      <div className="flex flex-wrap gap-2">
        <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-container disabled:opacity-50" disabled={!draft} onClick={() => download(true)}>
          <Save size={16} />Guardar cambios
        </button>
        <button className={action} disabled={!draft} onClick={() => download(false)}>
          <Download size={16} />Descargar Word
        </button>
        <button className={action} aria-expanded={aiEdit} onClick={() => setAiEdit(v => !v)}>
          <Sparkles size={16} />{model.number === 7 ? 'Adjuntar respaldos' : model.number === 8 ? 'Subir nota de petición de pago' : 'Completar o corregir con IA'}
        </button>
        {(model.number===7 ? !aiEdit : model.number>4&&model.number!==8&&(adquisicion.asistente_compra?.confirmedAt||adquisicion.asistente_compra?.preparedAt))&&<button className={action} onClick={()=>refresh('complete')}>Redactar con los datos de esta compra</button>}
        {model.number===6 && (adquisicion.quote_evaluation?.quotes.length || adquisicion.comparative_report) ? <button className={action} onClick={()=>refresh('refresh-evaluation')}>Actualizar cuadro y conclusiones desde cotizaciones</button> : null}
      </div>
      {evaluationChanged && <p role="status" className="text-sm text-amber-800">Las cotizaciones cambiaron. Puedes actualizar el cuadro y las conclusiones.</p>}
      {model.number === 8 && carpeta.documentos.filter(document => document.ruta_storage && !fixedDocumentBelongsToModel(8, document)).map(document =>
        <a key={document.id} className="block w-fit text-sm text-primary underline"
          href={`/api/files?path=${encodeURIComponent(document.ruta_storage!)}`}>{document.nombre_original}</a>
      )}
      {aiEdit && <div className="rounded-xl border border-slate-300 p-4 space-y-4 bg-slate-50">
        {clarification && <div role="status" className="rounded-lg border border-blue-200 bg-blue-50 p-3"><p className="font-semibold">{clarification}</p><p className="text-sm mt-1">Responde abajo; conservaré tu petición anterior. El documento sigue igual.</p></div>}
        <label className="block space-y-2"><span>{model.number === 7 ? 'Factura, carta del proveedor o acta (PDF, Word o foto)' : model.number === 8 ? 'Nota de petición de pago (Word, PDF o foto)' : 'Antecedentes de esta compra (opcional)'}</span><input className={control} type="file" multiple accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp" onChange={e => {
          const chosen = Array.from(e.target.files || []);
          const additions = model.number === 7 ? chosen.filter(file=>!files.some(existing=>existing.name===file.name && existing.size===file.size && existing.lastModified===file.lastModified)) : chosen;
          const selected = model.number === 7 ? [...files,...additions] : additions;
          const issue = validateAttachmentSelection(selected);
          if (!issue || model.number !== 7) setFiles(selected);
          setError(issue || '');
          if (model.number === 7) e.target.value='';
        }} /><span className="text-sm text-slate-600">{ATTACHMENT_HELP_TEXT} </span></label>
        {model.number === 7 && files.length > 0 && <ul className="space-y-1 text-sm">{files.map((file,index)=>
          <li key={`${file.name}:${file.lastModified}`} className="flex flex-wrap items-center gap-2">
            {file.name}<button type="button" className="underline text-primary" aria-label={`Quitar ${file.name}`} onClick={()=>{setFiles(files.filter((_,i)=>i!==index));setError('');}}>Quitar</button>
          </li>
        )}</ul>}
        <label className="block space-y-2"><span className="font-semibold">{model.number === 7 ? 'Datos adicionales (opcional)' : 'Describe lo que necesitas o los datos que cambian'}</span><textarea className={control} rows={model.number === 7 ? 2 : 4} value={context} onChange={e => {setContext(e.target.value);setDirty(true);}} placeholder={model.number === 7 ? 'Ej. Número de orden o indicación para el informe.' : 'Ejemplo: cambia la entrega a 45 días o modifica la cantidad del ítem 2.'} /></label>
        <button className={action} disabled={[7,8].includes(model.number) && (!draft || (model.number === 8 ? !files.length : !files.length && !context.trim()) || !!validateAttachmentSelection(files))}
          onClick={() => refresh(model.number === 7 && files.length ? "complete" : model.number === 8 || context.trim() || pendingInstruction ? "revise" : "complete")}>
          <Sparkles size={16} />{clarification ? "Responder al asistente" : model.number === 7 && files.length ? 'Generar informe con los archivos' : model.number === 8 ? 'Leer nota y completar solicitud' : "Aplicar cambios con IA"}
        </button>
      </div>}
      {draft && model.number !== TECHNICAL_JUSTIFICATION_MODEL && !!officialPeopleKeys[model.number]?.length &&
        <label className="flex w-fit items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={saveOfficial} onChange={e=>setSaveOfficial(e.target.checked)} />
          Usar estos responsables como datos oficiales en próximos expedientes
        </label>}
      {model.number===2 && draft?.warnings?.filter(warning=>warning.startsWith('No se pudo asignar el correlativo')).map(warning=><p key={warning} role="status" className="text-sm text-amber-800">{warning}</p>)}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
      {message && <p role="status" className="text-sm text-primary">{message}</p>}
      {undoDraft && <button className={action} onClick={async()=>{setDraft(undoDraft);setUndoDraft(null);setDirty(true);await refresh('preview',undoDraft);setMessage('Último cambio deshecho en el documento. Guarda para conservar esta versión.');}}>Deshacer último cambio del asistente</button>}
      {busy && <p role="status" className="flex items-center gap-2 text-primary"><Loader2 size={18} className="animate-spin"/>Preparando documento…</p>}
      {draft && editableHtml
        ? <EditableDocument html={editableHtml} draft={draft} model={model} disabled={busy||assistantBusy}
            onFieldChange={changeField} onItemChange={changeItem}
            onAddItem={()=>replaceItems([...draft.items,newFixedItem(model,draft.items.length)])}
            onRemoveItem={row=>replaceItems(draft.items.filter((_,index)=>index!==row))}/>
        : !busy && <button className={action} onClick={()=>refresh()}>Volver a cargar el documento</button>}
    </fieldset>
  </section>;
}
