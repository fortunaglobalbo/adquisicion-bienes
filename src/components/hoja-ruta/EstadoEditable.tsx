"use client";

import { useEffect, useRef, useState } from 'react';
import { HOJA_RUTA_ESTADO_MAX } from '@/lib/types/hojaRuta';

export function EstadoEditable({value, label, className, onSave}: {
  value:string; label:string; className:string; onSave:(value:string)=>Promise<void>;
}) {
  const [text,setText]=useState(value);
  const [status,setStatus]=useState<'idle'|'pending'|'saving'|'saved'|'error'>('idle');
  const [error,setError]=useState('');
  const current=useRef(value), saved=useRef(value), busy=useRef(false), mounted=useRef(true);
  const timer=useRef<ReturnType<typeof setTimeout>>();
  const saveAction=useRef(onSave);saveAction.current=onSave;

  function cancelTimer(){if(timer.current){clearTimeout(timer.current);timer.current=undefined;}}
  async function save(){
    cancelTimer();
    if(busy.current)return;
    const next=current.current.trim();
    if(!next){if(mounted.current){setError('Escribe un estado.');setStatus('error');}return;}
    if(next===saved.current){if(mounted.current)setStatus('idle');return;}
    busy.current=true;
    if(mounted.current){setStatus('saving');setError('');}
    try{
      await saveAction.current(next);
      saved.current=next;
      if(mounted.current&&current.current.trim()===next){current.current=next;setText(next);setStatus('saved');}
    }catch(e){
      if(mounted.current&&current.current.trim()===next){setStatus('error');setError(e instanceof Error?e.message:'No se pudo guardar.');}
    }finally{
      busy.current=false;
      // One write at a time: an earlier response cannot overwrite newer typing.
      if(current.current.trim()!==next)void save();
    }
  }

  useEffect(()=>{
    // Refresh untouched fields after synchronization; keep any unsaved local text.
    if(!busy.current&&current.current.trim()===saved.current){current.current=value;saved.current=value;setText(value);}
  },[value]);
  useEffect(()=>{
    mounted.current=true;
    const beforeUnload=(event:BeforeUnloadEvent)=>{
      if(current.current.trim()!==saved.current){void save();event.preventDefault();event.returnValue='';}
    };
    window.addEventListener('beforeunload',beforeUnload);
    return ()=>{mounted.current=false;window.removeEventListener('beforeunload',beforeUnload);cancelTimer();if(current.current.trim()!==saved.current)void save();};
  },[]);

  return <div>
    <input type="text" value={text} aria-label={label} title={text} maxLength={HOJA_RUTA_ESTADO_MAX}
      placeholder="Escribe el estado" className={className}
      aria-invalid={status==='error'}
      onChange={e=>{current.current=e.target.value;setText(e.target.value);setStatus('pending');setError('');cancelTimer();timer.current=setTimeout(()=>void save(),700);}}
      onBlur={()=>void save()} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void save();}}}/>
    <div role="status" aria-live="polite" className={`mt-1 text-[10px] ${status==='error'?'text-red-700':'text-neutral-500 dark:text-neutral-400'}`}>
      {status==='pending'?'Cambio pendiente…':status==='saving'?'Guardando…':status==='saved'?'Guardado':status==='error'?error:'Se guarda automáticamente'}
      {status==='error'&&text.trim()&&<button type="button" onClick={()=>void save()} className="ml-1 underline font-semibold">Reintentar</button>}
    </div>
  </div>;
}
