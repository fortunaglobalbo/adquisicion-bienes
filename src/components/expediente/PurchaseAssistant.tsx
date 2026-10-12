"use client";
import { useEffect, useState, useRef } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import type { Adquisicion, Carpeta } from '@/types';
import { fixedModel, FixedDraft } from '@/lib/docx/fixedModels';
import { initialBrief, briefProblems, briefUpdates, briefDetailLabels, PurchaseBrief } from '@/lib/docx/purchaseBrief';
import { readPurchaseResponse } from '@/lib/ai/purchaseReadingResponse';
import { DataStore } from '@/lib/store/dataStore';

const input = 'w-full rounded-lg border border-slate-300 bg-white p-2 text-sm';
const button = 'rounded-lg border border-slate-300 px-4 py-2 font-semibold text-sm disabled:opacity-50';
const initialFolders = [1,2,3,4,5];
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
  const [open,setOpen] = useState(!(adquisicion.asistente_compra?.confirmedAt || adquisicion.asistente_compra?.preparedAt));
  const [review,setReview] = useState(!!(adquisicion.asistente_compra?.confirmedAt || adquisicion.asistente_compra?.preparedAt));
  const [notes,setNotes] = useState('');
  const [files,setFiles] = useState<File[]>([]);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [progress,setProgress] = useState('');
  const [reading,setReading] = useState(false);
  const readingController = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;readingController.current?.abort();};},[]);
  const [outcomes,setOutcomes] = useState<Record<number,string>>({});
  useEffect(()=>{onBusyChange(busy);return()=>onBusyChange(false);},[busy,onBusyChange]);
  useEffect(()=>{if(adquisicion.asistente_compra)setBrief(b=>(b.confirmedAt || b.preparedAt)?adquisicion.asistente_compra!:b);},[adquisicion.asistente_compra?.revision]);
  const change = (patch:Partial<PurchaseBrief>)=>setBrief(b=>({...b,...patch,confirmedAt:null,preparedAt:null,
    suggestions:b.suggestions?.filter(s=>!(s.field in patch))}));
  async function read(createDocuments=false) {
    if(readingController.current) return;
    if(!files.length && !notes.trim() && !brief.items.length){setError('Sube una cotización o foto, o escribe qué necesitas.');return;}
    if(files.length>3 || files.reduce((total,file)=>total+file.size,0)>3*1024*1024){setError('Puedes subir hasta tres archivos y 3 MB en total. Tu selección se conserva para que puedas ajustarla.');return;}
    const controller = new AbortController(); readingController.current=controller;
    setBusy(true);setReading(true);setError('');setProgress('Preparando la lectura de los antecedentes…');
    const deadline = setTimeout(()=>controller.abort('timeout'),175000);
    try {
      // Other generated folders and legal citations are not inputs to purchase reading.
      const {borradores_ia, ...purchase} = adquisicion;
      const tdr=borradores_ia?.['1'];
      const form = new FormData(); form.append('request',JSON.stringify({action:'analyze',stream:true,number:1,adquisicion:{...purchase,asistente_compra:brief,
        borradores_ia:tdr ? {'1':{...tdr,draft:{...tdr.draft,sources:[],sourceQuotes:{}}}} : undefined},context:notes}));
      files.forEach(f=>form.append('attachments',f));
      const res=await fetch('/api/fixed-documents',{method:'POST',body:form,signal:controller.signal});
      const found=await readPurchaseResponse(res,message=>{if(mounted.current)setProgress(message);});
      if(!mounted.current)return;
      setBrief(found);setReview(true);setProgress('Ya leí la información. Puedes corregir cualquier dato.');
      if(createDocuments){
        clearTimeout(deadline);setReading(false);readingController.current=null;
        await prepare(initialFolders,found,'automatic');
      }
    } catch(e){
      if(!mounted.current)return;
      setProgress('');
      if(controller.signal.aborted && controller.signal.reason!=='timeout') setProgress('Lectura cancelada. Tu texto y los archivos seleccionados se conservan.');
      else setError(controller.signal.aborted ? 'La lectura no terminó a tiempo. Tu texto y los archivos seleccionados se conservan; puedes volver a intentar.' : e instanceof Error?e.message:'No se pudo leer.');
    } finally {clearTimeout(deadline);readingController.current=null;if(mounted.current){setReading(false);setBusy(false);}}
  }
  async function prepare(numbers:number[],candidate=brief,mode:'automatic'|'reviewed'='reviewed') {
    const problems=briefProblems(candidate); if(problems.length){setError(`Para preparar los documentos solo falta lo siguiente: ${problems.join(' ')}`);setReview(true);setOpen(true);return;}
    setBusy(true);setError('');setOutcomes(previous=>numbers.length>1?{}:previous);
    try {
      const now=new Date().toISOString();
      const saved:PurchaseBrief={...candidate,revision:crypto.randomUUID(),preparedAt:now,reviewMode:mode,
        confirmedAt:mode==='reviewed'?now:null};
      const latest=DataStore.getAdquisicionById(adquisicion.id)||adquisicion;
      const updates=briefUpdates(latest,saved);
      const stored=await DataStore.updateAdquisicion(adquisicion.id,updates);if(!stored.success)throw Error(stored.error);
      setBrief(saved);
      let working:Adquisicion={...latest,...updates};let failures=0;
      for(let position=0;position<numbers.length;position++){
        const number=numbers[position];
        const model=fixedModel(number);setProgress(`Preparando documento ${position+1} de ${numbers.length}: ${model.title}…`);
        try {
          const candidates=carpetas.find(c=>c.numero===number)?.documentos.filter(d=>d.metadata?.fixedDraft?.modelVersion===model.version).sort((a,b)=>b.fecha_creacion.localeCompare(a.fecha_creacion))||[];
          const prepared=working.borradores_ia?.[number];
          let current:FixedDraft|undefined=prepared && (!candidates[0]||prepared.updatedAt>candidates[0].fecha_creacion)?prepared.draft:candidates[0]?.metadata?.fixedDraft;
          // Include unsaved corrections from this browser; never erase them by changing folders.
          let recovery: {draft?:FixedDraft;updatedAt?:number}|null=null;
          try{recovery=JSON.parse(localStorage.getItem(`fixed-draft:${adquisicion.id}:${number}`)||'null');}catch{}
          const draftTime=Math.max(Date.parse(prepared?.updatedAt||'1970-01-01'),Date.parse(candidates[0]?.fecha_creacion||'1970-01-01'));
          if(recovery?.draft?.modelVersion===model.version && (recovery.updatedAt||0)>draftTime)current=recovery.draft;
          const form=new FormData();form.append('request',JSON.stringify({action:'complete',draftOnly:true,number,adquisicion:working,draft:current,context:''}));
          const res=await fetch('/api/fixed-documents',{method:'POST',body:form});const result=await res.json();
          if(!res.ok)throw Error(result.error||'No respondió la IA.');
          const updatedAt=new Date().toISOString();
          working={...working,borradores_ia:{...working.borradores_ia,[number]:{draft:result.draft,briefRevision:saved.revision,updatedAt}}};
          const storedDraft=await DataStore.updateAdquisicion(adquisicion.id,{borradores_ia:working.borradores_ia});
          if(!storedDraft.success)throw Error(storedDraft.error || 'No se pudo conservar este borrador.');
          setOutcomes(o=>({...o,[number]:'Borrador preparado y editable'}));
        }catch(e){failures++;setOutcomes(o=>({...o,[number]:`No se pudo preparar: ${e instanceof Error?e.message:'vuelve a intentar'}`}));}
      }
      const sync=await DataStore.flushPending();
      setProgress(failures?'Los documentos preparados se conservaron. Puedes volver a intentar los que faltan.': numbers.length===initialFolders.length?'TDR y solicitudes preparados. Abre las carpetas 1 a 5 para editar o descargar el Word.':'Documento preparado. Abre su carpeta para editar o descargar el Word.');
      if(!sync.success)setError('Los cambios están guardados en este navegador; falta sincronizarlos con la nube.');
      if(!failures)setOpen(false);
      onUpdated();
    }catch(e){setProgress('');setError(e instanceof Error?e.message:'No se pudo preparar la compra.');}finally{setBusy(false);}
  }
  return <section className="mb-5 rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-3">
    {!!brief.notices?.length&&<div role="status" className="rounded-lg bg-blue-100/60 p-3 text-sm">{brief.notices.map((notice,index)=><p key={index}>{notice}</p>)}</div>}
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-bold text-lg text-primary">Asistente de esta compra</h2><p className="text-sm text-slate-600">Sube una cotización, PDF o foto. La IA preparará el TDR y las solicitudes de las carpetas 1 a 5 en las plantillas de ENDE. Todo se puede editar.</p><p className="mt-1 text-xs text-slate-600">La evaluación se completa con las ofertas recibidas; la conformidad y el pago, cuando existan los datos de recepción.</p></div><button disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-amber-500 bg-amber-400 hover:bg-amber-500 text-slate-950 shadow-sm px-4 py-2 font-bold text-sm disabled:opacity-50 transition-colors cursor-pointer" onClick={()=>setOpen(v=>!v)}>{open?'Ocultar asistente':'Revisar datos de la compra'}</button></div>
    {!!brief.suggestions?.length&&<div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"><p className="font-semibold">Datos propuestos por la IA</p><p className="text-slate-600">Estas propuestas se usarán en el borrador. Puedes cambiarlas al revisar los datos o al editar el documento.</p>{brief.suggestions.map((suggestion,i)=><p key={i} className="mt-2"><strong>{({purpose:'Finalidad',location:'Lugar de entrega',deliveryDays:'Plazo de entrega'} as const)[suggestion.field]}:</strong> {suggestion.value}<span className="block text-xs text-slate-600">{suggestion.reason}</span></p>)}{!open&&<button disabled={busy} className="mt-2 underline" onClick={()=>{setReview(true);setOpen(true);}}>Editar estos datos</button>}</div>}
    {open&&<fieldset disabled={busy} className="min-w-0 space-y-4">
      {!review?<>
        <label className="block text-sm font-semibold">1. Sube la cotización o información del producto<input aria-label="Cotización, PDF o foto" className={`${input} mt-1`} type="file" multiple accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp" onChange={e=>{setFiles(Array.from(e.target.files||[]));setError('');}} /><span className="block mt-1 text-xs font-normal text-slate-600">PDF, Word, texto, JPG, PNG o WebP. Hasta tres archivos y 3 MB en total.</span></label>
        {!!files.length&&<ul className="text-sm space-y-1">{files.map((file,i)=><li className="flex items-center justify-between gap-2" key={`${file.name}-${i}`}><span className="break-all">{file.name}</span><button className="text-red-700 underline shrink-0" onClick={()=>setFiles(selected=>selected.filter((_,n)=>n!==i))} aria-label={`Quitar ${file.name}`}>Quitar</button></li>)}</ul>}
        <label className="block text-sm font-semibold">2. Añade una indicación, si hace falta <span className="font-normal text-slate-600">(opcional)</span><textarea className={`${input} mt-1`} value={notes} rows={2} onChange={e=>setNotes(e.target.value)} placeholder="Por ejemplo: para el personal de mantenimiento. Si el archivo ya explica la compra, puedes dejarlo vacío." /></label>
        <div className="flex gap-2 flex-wrap"><button className={`${button} bg-primary text-white inline-flex items-center gap-2`} onClick={()=>read(true)}><Sparkles size={16}/>Crear documentos con IA</button><button className={button} onClick={()=>read(false)}>Leer y revisar primero</button><button className={button} onClick={()=>setReview(true)}>Usar los datos del expediente</button></div>
        <p className="text-xs text-slate-600">Se usarán los datos del archivo y del expediente. Solo te pediremos completar información indispensable que no aparezca en ellos.</p>
      </>:<>
        <div><p className="text-sm font-semibold">Datos de la compra</p><p className="text-sm text-slate-600">Revisa lo que encontró la IA y cambia lo que necesites. La redacción y el formato se preparan automáticamente.</p></div>
        <label className="block text-sm">¿Para qué se necesita?<textarea rows={2} className={`${input} mt-1`} value={brief.purpose} onChange={e=>change({purpose:e.target.value})} placeholder="Una frase es suficiente; no necesitas redactar la justificación." /></label>
        <div className="space-y-3">{brief.items.map((item,i)=><div key={i} className="rounded-lg border bg-white p-3 space-y-2"><div className="grid grid-cols-1 sm:grid-cols-[1fr_100px_100px] gap-2">{(['descripcion','cantidad','unidad'] as const).map((key,j)=><label key={key} className="text-sm">{['Bien o servicio','Cantidad','Unidad'][j]}<input aria-label={`${['Bien o servicio','Cantidad','Unidad'][j]} ${i+1}`} className={input} value={item[key]} onChange={e=>change({items:brief.items.map((r,n)=>n===i?{...r,[key]:e.target.value}:r)})} placeholder={key==='unidad'?'Pares, unidades…':''} /></label>)}</div><details className="text-sm"><summary className="cursor-pointer">Características y precio estimado</summary><textarea aria-label={`Características ${i+1}`} className={`${input} mt-2`} rows={4} value={item.especificaciones} onChange={e=>change({items:brief.items.map((r,n)=>n===i?{...r,especificaciones:e.target.value}:r)})} /><label>Precio unitario estimado en Bs (si lo tienes)<input className={input} value={item.precio} onChange={e=>change({items:brief.items.map((r,n)=>n===i?{...r,precio:e.target.value}:r)})} /></label></details><button className="text-red-700 text-sm" onClick={()=>change({items:brief.items.filter((_,n)=>n!==i)})}>Quitar ítem</button></div>)}</div>
        <button className={button} onClick={()=>change({items:[...brief.items,{descripcion:'',cantidad:'',unidad:'',especificaciones:'',precio:''}]})}>Añadir ítem</button>
        <details className="text-sm"><summary className="cursor-pointer font-semibold">Lugar y plazo de entrega (opcional)</summary><p className="my-2 text-slate-600">Completa estos datos si ya los conoces. La IA no inventará fechas ni lugares.</p><div className="grid sm:grid-cols-2 gap-3"><label>Lugar de entrega<input className={input} value={brief.location} onChange={e=>change({location:e.target.value})} /></label><label>Plazo en días calendario<input className={input} value={brief.deliveryDays} onChange={e=>change({deliveryDays:e.target.value})} /></label></div></details>
        {!!brief.conflicts.length&&<div className="rounded-lg bg-amber-50 p-3 text-sm"><p className="font-semibold">Necesito aclarar esta información</p>{brief.conflicts.map((s,i)=><p key={i}>{s}</p>)}<label>Tu aclaración<textarea className={`${input} mt-1`} rows={2} value={brief.clarification} onChange={e=>change({clarification:e.target.value})} /></label></div>}
        <details className="text-sm"><summary className="cursor-pointer font-semibold">Otros datos disponibles (opcional)</summary><p className="my-2 text-slate-600">Se reutilizarán donde correspondan. Las firmas y verificaciones de almacén y presupuesto se completan cuando existan.</p><div className="grid sm:grid-cols-2 gap-3">{Object.entries(briefDetailLabels).map(([key,label])=><label key={key}>{label}<input className={input} value={brief.details[key]||''} onChange={e=>change({details:{...brief.details,[key]:e.target.value}})} /></label>)}</div></details>
        <div className="flex flex-wrap gap-2"><button className={`${button} bg-primary text-white inline-flex items-center gap-2`} onClick={()=>prepare(initialFolders)}><Sparkles size={16}/>Preparar documentos con estos datos</button><button className={button} onClick={()=>{setReview(false);setProgress('');setError('');}}>Añadir otro archivo o indicación</button></div>
      </>}
    </fieldset>}
    {reading&&<button className={button} onClick={()=>readingController.current?.abort()}>Cancelar lectura</button>}
    {busy&&<p role="status" className="text-sm flex items-center gap-2"><Loader2 className="animate-spin" size={16}/>{progress}</p>}
    {!busy&&progress&&<p role="status" className="text-sm">{progress}</p>}
    {!!Object.keys(outcomes).length&&<details open={busy||Object.values(outcomes).some(s=>s.startsWith('No se'))} className="text-sm"><summary className="cursor-pointer">Ver resultados por carpeta</summary><ul className="space-y-1 mt-2">{Object.entries(outcomes).map(([n,s])=><li key={n}>{n}. {fixedModel(Number(n)).title}: {s}{!busy&&s.startsWith('No se')&&<button className="underline ml-2" onClick={()=>prepare([Number(n)],brief,brief.reviewMode||'reviewed')}>Volver a intentar esta carpeta</button>}</li>)}</ul></details>}
    {error&&<p role="alert" className="text-sm text-red-800 bg-red-50 rounded-lg p-3">{error}</p>}
  </section>;
}
