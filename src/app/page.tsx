"use client";

import React, { useState, useEffect } from "react";
import { Plus, RefreshCw, AlertCircle, Database, CheckCircle2 } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { MetricCards } from "@/components/dashboard/MetricCards";
import { AcquisitionsTable } from "@/components/dashboard/AcquisitionsTable";
import { NewAcquisitionModal } from "@/components/dashboard/NewAcquisitionModal";
import { DataStore } from "@/lib/store/dataStore";
import { Adquisicion } from "@/types";

export default function DashboardPage() {
  const [adquisiciones, setAdquisiciones] = useState<Adquisicion[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  const fetchDatabaseData = async () => {
    setLoading(true);
    setDbError(null);

    const res = await DataStore.syncWithSupabase();
    if (res.success) {
      setAdquisiciones(DataStore.getAdquisiciones());
    } else {
      setDbError(res.error || "No se pudo establecer conexión con la base de datos Supabase");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDatabaseData();
  }, []);

  const handleCreateAdquisicion = async (newAdqData: Adquisicion) => {
    const res = await DataStore.createAdquisicion(newAdqData);
    if (res.success) {
      setAdquisiciones(DataStore.getAdquisiciones());
      setIsModalOpen(false);
    } else {
      alert(`Error al guardar en base de datos: ${res.error}`);
    }
  };

  const handleDeleteAdquisicion = async (id: string) => {
    const res = await DataStore.deleteAdquisicion(id);
    if (res.success) {
      setAdquisiciones(DataStore.getAdquisiciones());
    } else {
      alert(`Error al eliminar de base de datos: ${res.error}`);
    }
  };

  const calculateNextCodigo = (list: Adquisicion[]): string => {
    const currentYear = new Date().getFullYear();
    let maxNum = 0;
    (list || []).forEach((adq) => {
      if (!adq || !adq.codigo) return;
      const match = adq.codigo.match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    });
    return `ENDE-D-${currentYear}-${String(maxNum + 1).padStart(3, "0")}`;
  };

  const nextCodigo = calculateNextCodigo(adquisiciones);


  return (
    <>
      <Topbar onSearch={setSearchTerm} title="Plan de Adquisiciones" />

      <main className="flex-1 overflow-y-auto p-3 md:p-6 w-full">
        <div className="w-full space-y-6">
          {/* Database Error Banner if Supabase connection fails */}
          {dbError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-red-400">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
                <div>
                  <div className="font-mono text-xs font-bold uppercase tracking-wider text-red-300">
                    Error de Conexión con Supabase
                  </div>
                  <div className="text-xs text-red-200 mt-0.5">{dbError}</div>
                </div>
              </div>
              <button
                onClick={fetchDatabaseData}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 rounded text-xs font-mono font-bold text-red-200 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reintentar
              </button>
            </div>
          )}

          {/* Page Header & Action */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-headline-lg text-2xl font-bold text-on-surface tracking-tight">
                  Panel de Control de Adquisiciones
                </h2>
                {!loading && !dbError && (
                  <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                    <Database className="w-3 h-3" /> Supabase Conectado
                  </span>
                )}
              </div>
              <p className="font-sans text-xs text-on-surface-variant mt-0.5">
                Distribuidora de Electricidad ENDE Deoruro S.A. • Gestión de Procesos y Expedientes
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchDatabaseData}
                title="Refrescar base de datos"
                className="p-2.5 bg-surface-variant/40 hover:bg-surface-variant border border-outline-variant/30 text-on-surface rounded transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 bg-primary text-on-primary font-mono text-xs font-bold px-4 py-2.5 rounded hover:bg-primary-container transition-colors shadow-institutional"
              >
                <Plus className="w-4 h-4 text-secondary-container" />
                <span>Nuevo Expediente</span>
              </button>
            </div>
          </div>

          {/* Metric Summary Cards */}
          <MetricCards adquisiciones={adquisiciones} />

          {/* Acquisitions Table / Loading State */}
          <div id="expedientes">
            {loading ? (
              <div className="bg-surface-variant/10 border border-outline-variant/30 rounded-lg p-12 text-center space-y-3">
                <RefreshCw className="w-8 h-8 mx-auto animate-spin text-primary" />
                <div className="font-mono text-xs text-on-surface font-bold uppercase tracking-wider">
                  Consultando Base de Datos Supabase PostgreSQL...
                </div>
                <p className="text-xs text-on-surface-variant">
                  Cargando registros oficiales desde la nube.
                </p>
              </div>
            ) : (
              <AcquisitionsTable
                adquisiciones={adquisiciones}
                searchTerm={searchTerm}
                onAdquisicionDeleted={handleDeleteAdquisicion}
              />
            )}
          </div>
        </div>
      </main>

      {/* New Acquisition Modal */}
      <NewAcquisitionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={handleCreateAdquisicion}
        nextCodigo={nextCodigo}
      />
    </>
  );
}
