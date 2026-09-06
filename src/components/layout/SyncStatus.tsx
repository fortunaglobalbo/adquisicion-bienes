"use client";
import { useEffect, useState } from "react";
import { DataStore } from "@/lib/store/dataStore";

export function SyncStatus() {
  const [pending, setPending] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    const update = (event?: Event) => { setPending(DataStore.pendingCount()); setError((event as CustomEvent)?.detail?.error || ""); };
    const retry = () => { void DataStore.flushPending(); };
    const beforeUnload = (event: BeforeUnloadEvent) => { if (DataStore.pendingCount()) { event.preventDefault(); event.returnValue = ""; } };
    update(); retry();
    window.addEventListener("ende-sync-status", update); window.addEventListener("online", retry); window.addEventListener("beforeunload", beforeUnload);
    const timer = setInterval(retry, 30000);
    return () => { clearInterval(timer); window.removeEventListener("ende-sync-status", update); window.removeEventListener("online", retry); window.removeEventListener("beforeunload", beforeUnload); };
  }, []);
  return <div role="status" className="no-print flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm border-b bg-slate-50 text-slate-700">
    <span>{error || (pending ? `${pending} cambio(s) guardados en este navegador, pendientes de sincronización.` : "Sin cambios pendientes de sincronización.")}</span>
    <div className="flex gap-3">
      {!!pending && <button onClick={() => void DataStore.flushPending()} className="underline">Reintentar</button>}
      <button onClick={() => DataStore.exportBackup()} className="underline">Exportar respaldo</button>
    </div>
  </div>;
}
