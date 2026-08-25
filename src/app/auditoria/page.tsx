"use client";

import React, { useState, useEffect } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { DataStore } from "@/lib/store/dataStore";
import { LogProceso } from "@/types";
import { History, ShieldAlert, Sparkles, Upload, PenTool, PlusCircle, Filter } from "lucide-react";
import Link from "next/link";

export default function AuditoriaPage() {
  const [logs, setLogs] = useState<LogProceso[]>([]);

  useEffect(() => {
    setLogs(DataStore.getLogs());
  }, []);

  const getActionBadge = (accion: LogProceso["accion"]) => {
    switch (accion) {
      case "CREAR":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[10px] bg-blue-100 text-blue-800 border border-blue-300">
            <PlusCircle className="w-3 h-3" />
            Creación
          </span>
        );
      case "GENERAR_IA":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[10px] bg-primary-fixed text-primary border border-primary-fixed-dim">
            <Sparkles className="w-3 h-3 text-secondary-container fill-secondary-container" />
            Generación IA
          </span>
        );
      case "SUBIR":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[10px] bg-surface-container-high text-on-surface-variant border border-outline-variant">
            <Upload className="w-3 h-3" />
            Subida Manual
          </span>
        );
      case "FIRMAR":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300">
            <PenTool className="w-3 h-3" />
            Firma Registrada
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[10px] bg-surface-container text-outline">
            {accion}
          </span>
        );
    }
  };

  return (
    <>
      <Topbar title="Auditoría y Trazabilidad de Procesos" />

      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-container-max mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-outline-variant pb-4 gap-2">
            <div>
              <h2 className="font-headline-lg text-2xl font-bold text-on-surface">
                Historial de Acciones y Auditoría
              </h2>
              <p className="font-sans text-xs text-on-surface-variant mt-0.5">
                Registro inmutable de generación con IA, subidas de documentos y firmas digitales.
              </p>
            </div>
            <span className="font-mono text-xs text-on-surface-variant bg-surface-container-high px-3 py-1 rounded">
              {logs.length} Eventos Registrados
            </span>
          </div>

          {/* Logs Table */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg shadow-institutional overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant font-mono text-[11px] text-on-surface-variant uppercase tracking-wider">
                  <th className="p-3.5 font-semibold whitespace-nowrap">Fecha y Hora</th>
                  <th className="p-3.5 font-semibold">Tipo Acción</th>
                  <th className="p-3.5 font-semibold">Descripción del Evento</th>
                  <th className="p-3.5 font-semibold">Usuario Responsable</th>
                  <th className="p-3.5 font-semibold text-right">Expediente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant font-sans text-xs">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center font-mono text-outline">
                      No hay eventos de auditoría registrados todavía.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="p-3.5 font-mono text-[11px] text-on-surface-variant whitespace-nowrap">
                        {new Date(log.fecha).toLocaleString()}
                      </td>
                      <td className="p-3.5 whitespace-nowrap">{getActionBadge(log.accion)}</td>
                      <td className="p-3.5 font-medium text-on-surface">{log.descripcion}</td>
                      <td className="p-3.5 font-mono text-[11px] text-on-surface-variant whitespace-nowrap">
                        {log.usuario}
                      </td>
                      <td className="p-3.5 text-right font-mono text-xs whitespace-nowrap">
                        <Link
                          href={`/expediente/${log.adquisicion_id}`}
                          className="text-primary font-bold hover:underline"
                        >
                          Ver Expediente
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  );
}
