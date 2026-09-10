"use client";
import { useEffect, useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import type { Adquisicion, Carpeta } from '@/types';
import { fixedModel, FixedDraft } from '@/lib/docx/fixedModels';
import { initialBrief, briefProblems, briefUpdates, briefDetailLabels, PurchaseBrief } from '@/lib/docx/purchaseBrief';
import { DataStore } from '@/lib/store/dataStore';

const input = 'w-full rounded-lg border border-slate-300 bg-white p-2 text-sm';
const button = 'rounded-lg border border-slate-300 px-4 py-2 font-semibold text-sm disabled:opacity-50';
function startingBrief(adq:Adquisicion,carpetas:Carpeta[]):PurchaseBrief {
  const brief=initialBrief(adq);if(adq.asistente_compra)return brief;
  const model=fixedModel(1);
  const documents=carpetas.find(c=>c.numero===1)?.documentos.filter(d=>d.metadata?.fixedDraft?.modelVersion===model.version).sort((a,b)=>b.fecha_creacion.localeCompare(a.fecha_creacion))||[];
  const prepared=adq.borradores_ia?.['1'];
  let draft:FixedDraft|undefined=prepared&&(!documents[0]||prepared.updatedAt>documents[0].fecha_creacion)?prepared.draft:documents[0]?.metadata?.fixedDraft;
  let updatedAt=prepared?.updatedAt||documents[0]?.fecha_creacion||'';
  try{const recovery=JSON.parse(localStorage.getItem(`fixed-draft:${adq.id}:1`)||'null');if(recovery?.draft?.modelVersion===model.version&&recovery.updatedAt>Date.parse(updatedAt||'1970-01-01'))draft=recovery.draft;}catch{}
  if(!draft)return brief;
  const known=(value:string|undefined)=>value&&!/PENDIENTE/.test(value)?value:'';
  return {...brief,purpose:known(draft.fields.justificacion)||brief.purpose,
    items:draft.items.length?draft.items.map(i=>({descripcion:known(i.descripcion),cantidad:known(i.cantidad),unidad:known(i.unidad),especificaciones:known(i.especificaciones),precio:brief.items.find(b=>b.descripcion===i.descripcion)?.precio||''})):brief.items,
    facts:[...brief.facts,...['antecedentes','justificacion'].filter(k=>known(draft!.fields[k])).map(k=>({topic:k,value:draft!.fields[k],origin:'borrador'}))]};
}
export function PurchaseAssistant({ adquisicion, carpetas, onUpdated, onBusyChange }: { adquisicion:Adquisicion; carpetas:Carpeta[]; onUpdated:()=>void; onBusyChange:(busy:boolean)=>void }) {
  const [brief,setBrief] = useState<PurchaseBrief>(()=>startingBrief(adquisicion,carpetas));
  const [open,setOpen] = useState(!adquisicion.asistente_compra?.confirmedAt);
  const [review,setReview] = useState(!!adquisicion.asistente_compra?.confirmedAt);
  const [notes,setNotes] = useState('');
  const [files,setFiles] = useState<File[]>([]);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [progress,setProgress] = useState('');
  const [outcomes,setOutcomes] = useState<Record<number,string>>({});
  useEffect(()=>{onBusyChange(busy);return()=>onBusyChange(false);},[busy,onBusyChange]);
  useEffect(()=>{if(adquisicion.asistente_compra)setBrief(b=>b.confirmedAt?adquisicion.asistente_compra!:b);},[adquisicion.asistente_compra?.revision]);
  const change = (patch:Partial<PurchaseBrief>)=>setBrief(b=>({...b,...patch,confirmedAt:null}));
  async function read() {
    setBusy(true);setError('');setProgress('Leyendo los antecedentes y organizando los datos…');
    try {
      const form = new FormData(); form.append('request',JSON.stringify({action:'analyze',number:1,adquisicion:{...adquisicion,asistente_compra:brief},context:notes}));
      files.forEach(f=>form.append('attachments',f));
      const res=await fetch('/api/fixed-documents',{method:'POST',body:form});const result=await res.json();
      if(!res.ok) throw Error(result.error || 'No se pudieron leer los antecedentes.');
      setBrief(result.brief);setReview(true);setProgress('Revisa los datos que encontré. Basta completar lo esencial.');
    } catch(e){setError(e instanceof Error?e.message:'No se pudo leer.');} finally{setBusy(false);}
  }
  async function prepare(numbers:number[]) {
    const problems=briefProblems(brief); if(problems.length){setError(problems.join(' '));setReview(true);setOpen(true);return;}
    setBusy(true);setError('');setOutcomes({});
    try {
      const saved:PurchaseBrief={...brief,revision:brief.confirmedAt?brief.revision:crypto.randomUUID(),confirmedAt:brief.confirmedAt||new Date().toISOString()};
      const latest=DataStore.getAdquisicionById(adquisicion.id)||adquisicion;
      const updates=briefUpdates(latest,saved);
      const stored=await DataStore.updateAdquisicion(adquisicion.id,updates);if(!stored.success)throw Error(stored.error);
      setBrief(saved);
      let working:Adquisicion={...latest,...updates};let failures=0;
      for(const number of numbers){
        const model=fixedModel(number);setProgress(`Redactando ${number}. ${model.title}…`);
        try {
          const candidates=carpetas.find(c=>c.numero===number)?.documentos.filter(d=>d.metadata?.fixedDraft?.modelVersion===model.version).sort((a,b)=>b.fecha_creacion.localeCompare(a.fecha_creacion))||[];
          const prepared=working.borradores_ia?.[number];
          let current:FixedDraft|undefined=prepared && (!candidates[0]||prepared.updatedAt>candidates[0].fecha_creacion)?prepared.draft:candidates[0]?.metadata?.fixedDraft;
          // Include unsaved corrections from this browser; never erase them by changing folders.
          const recovery=JSON.parse(localStorage.getItem(`fixed-draft:${adquisicion.id}:${number}`)||'null');
          const draftTime=Math.max(Date.parse(prepared?.updatedAt||'1970-01-01'),Date.parse(candidates[0]?.fecha_creacion||'1970-01-01'));
          if(recovery?.draft?.modelVersion===model.version && recovery.updatedAt>draftTime)current=recovery.draft;
          const form=new FormData();form.append('request',JSON.stringify({action:'complete',draftOnly:true,number,adquisicion:working,draft:current,context:''}));
          const res=await fetch('/api/fixed-documents',{method:'POST',body:form});const result=await res.json();
          if(!res.ok)throw Error(result.error||'No respondió la IA.');
          const updatedAt=new Date().toISOString();
          working={...working,borradores_ia:{...working.borradores_ia,[number]:{draft:result.draft,briefRevision:saved.revision,updatedAt}}};
          await DataStore.updateAdquisicion(adquisicion.id,{borradores_ia:working.borradores_ia});
          setOutcomes(o=>({...o,[number]:'Borrador preparado y editable'}));
        }catch(e){failures++;setOutcomes(o=>({...o,[number]:`No se pudo preparar: ${e instanceof Error?e.message:'vuelve a intentar'}`}));}
      }
      const sync=await DataStore.flushPending();
      setProgress(failures?'Las carpetas preparadas se conservaron. Puedes volver a intentar las que fallaron.': 'Borradores preparados. Abre cada carpeta para revisar, corregir y descargar su Word.');
      if(!sync.success)setError('Los cambios están guardados en este navegador; falta sincronizarlos con la nube.');
      if(!failures)setOpen(false);
      onUpdated();
    }catch(e){setError(e instanceof Error?e.message:'No se pudo preparar la compra.');}finally{setBusy(false);}
  }
  return <section className="mb-5 rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-bold text-lg text-primary">Asistente de esta compra</h2><p className="text-sm text-slate-600">Cuéntame qué necesitas. Con los mismos datos prepararé el TDR, el S1, la justificación y la solicitud de cotización.</p></div><button disabled={busy} className={button} onClick={()=>setOpen(v=>!v)}>{open?'Ocultar asistente':'Revisar datos de la compra'}</button></div>
    {open&&<fieldset disabled={busy} className="min-w-0 space-y-4">
      {!review?<>
        <label className="block text-sm font-semibold">¿Qué necesitas comprar y para qué?<textarea className={`${input} mt-1`} value={notes} rows={3} onChange={e=>setNotes(e.target.value)} placeholder="Por ejemplo: botines para el personal de mantenimiento. Adjunto la ficha del producto." /></label>
        <label className="block text-sm">Adjunta la información disponible<input className={`${input} mt-1`} type="file" multiple accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp" onChange={e=>setFiles(Array.from(e.target.files||[]))} /><span className="text-slate-600">PDF, Word, texto o fotos. Hasta tres archivos y 3 MB en total.</span></label>
        <div className="flex gap-2 flex-wrap"><button className={`${button} bg-primary text-white`} onClick={read}>Leer con IA y continuar</button><button className={button} onClick={()=>setReview(true)}>Usar los datos del expediente</button></div>
      </>:<>
        <p className="text-sm font-semibold">Confirma lo esencial una sola vez. La IA redactará los documentos.</p>
        <label className="block text-sm">¿Para qué se necesita?<textarea rows={2} className={`${input} mt-1`} value={brief.purpose} onChange={e=>change({purpose:e.target.value})} placeholder="Una frase es suficiente; no necesitas redactar la justificación." /></label>
        <div className="space-y-3">{brief.items.map((item,i)=><div key={i} className="rounded-lg border bg-white p-3 space-y-2"><div className="grid grid-cols-1 sm:grid-cols-[1fr_100px_100px] gap-2">{(['descripcion','cantidad','unidad'] as const).map((key,j)=><label key={key} className="text-sm">{['Bien o servicio','Cantidad','Unidad'][j]}<input aria-label={`${['Bien o servicio','Cantidad','Unidad'][j]} ${i+1}`} className={input} value={item[key]} onChange={e=>change({items:brief.items.map((r,n)=>n===i?{...r,[key]:e.target.value}:r)})} placeholder={key==='unidad'?'Pares, unidades…':''} /></label>)}</div><details className="text-sm"><summary className="cursor-pointer">Características y precio estimado</summary><textarea aria-label={`Características ${i+1}`} className={`${input} mt-2`} rows={4} value={item.especificaciones} onChange={e=>change({items:brief.items.map((r,n)=>n===i?{...r,especificaciones:e.target.value}:r)})} /><label>Precio unitario estimado en Bs (si lo tienes)<input className={input} value={item.precio} onChange={e=>change({items:brief.items.map((r,n)=>n===i?{...r,precio:e.target.value}:r)})} /></label></details><button className="text-red-700 text-sm" onClick={()=>change({items:brief.items.filter((_,n)=>n!==i)})}>Quitar ítem</button></div>)}</div>
        <button className={button} onClick={()=>change({items:[...brief.items,{descripcion:'',cantidad:'',unidad:'',especificaciones:'',precio:''}]})}>Añadir ítem</button>
        <div className="grid sm:grid-cols-2 gap-3"><label className="text-sm">Lugar de entrega<input className={input} value={brief.location} onChange={e=>change({location:e.target.value})} /></label><label className="text-sm">Plazo de entrega en días calendario<input className={input} value={brief.deliveryDays} onChange={e=>change({deliveryDays:e.target.value})} /></label></div>
        {!!brief.conflicts.length&&<div className="rounded-lg bg-amber-50 p-3 text-sm"><p className="font-semibold">Necesito aclarar esta información</p>{brief.conflicts.map((s,i)=><p key={i}>{s}</p>)}<label>Tu aclaración<textarea className={`${input} mt-1`} rows={2} value={brief.clarification} onChange={e=>change({clarification:e.target.value})} /></label></div>}
        <details className="text-sm"><summary className="cursor-pointer font-semibold">Otros datos disponibles (opcional)</summary><p className="my-2 text-slate-600">Se reutilizarán donde correspondan. Las firmas y verificaciones de almacén y presupuesto se completan cuando existan.</p><div className="grid sm:grid-cols-2 gap-3">{Object.entries(briefDetailLabels).map(([key,label])=><label key={key}>{label}<input className={input} value={brief.details[key]||''} onChange={e=>change({details:{...brief.details,[key]:e.target.value}})} /></label>)}</div></details>
        <div className="flex flex-wrap gap-2"><button className={`${button} bg-primary text-white inline-flex items-center gap-2`} onClick={()=>prepare([1,2,3,4])}><Sparkles size={16}/>Confirmar y preparar carpetas 1 a 4</button><button className={button} onClick={()=>{setReview(false);setNotes('');}}>Añadir o cambiar antecedentes</button></div>
      </>}
    </fieldset>}
    {busy&&<p role="status" className="text-sm flex items-center gap-2"><Loader2 className="animate-spin" size={16}/>{progress}</p>}
    {!busy&&progress&&<p role="status" className="text-sm">{progress}</p>}
    {!!Object.keys(outcomes).length&&<details open={busy||Object.values(outcomes).some(s=>s.startsWith('No se'))} className="text-sm"><summary className="cursor-pointer">Ver resultados por carpeta</summary><ul className="space-y-1 mt-2">{Object.entries(outcomes).map(([n,s])=><li key={n}>{n}. {fixedModel(Number(n)).title}: {s}{!busy&&s.startsWith('No se')&&<button className="underline ml-2" onClick={()=>prepare([Number(n)])}>Volver a intentar esta carpeta</button>}</li>)}</ul></details>}
    {error&&<p role="alert" className="text-sm text-red-800 bg-red-50 rounded-lg p-3">{error}</p>}
  </section>;
}
