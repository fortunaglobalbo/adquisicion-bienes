"use client";

import React, { useState, useEffect } from "react";
import { Plus, RefreshCw, FolderPlus } from "lucide-react";
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
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const list = DataStore.getAdquisiciones();
    setAdquisiciones(list);
    setLoaded(true);
  }, []);

  const handleCreateAdquisicion = (newAdqData: Adquisicion) => {
    const created = DataStore.createAdquisicion(newAdqData);
    setAdquisiciones(DataStore.getAdquisiciones());
    setIsModalOpen(false);
  };

  const handleDeleteAdquisicion = (id: string) => {
    DataStore.deleteAdquisicion(id);
    setAdquisiciones(DataStore.getAdquisiciones());
  };

  const nextCodigo = `ENDE-D-2026-${String(adquisiciones.length + 1).padStart(3, "0")}`;

  return (
    <>
      <Topbar onSearch={setSearchTerm} title="Plan de Adquisiciones" />

      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-container-max mx-auto space-y-6">
          {/* Page Header & Action */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="font-headline-lg text-2xl font-bold text-on-surface tracking-tight">
                Panel de Control de Adquisiciones
              </h2>
              <p className="font-sans text-xs text-on-surface-variant mt-0.5">
                Distribuidora de Electricidad ENDE Deoruro S.A. • Gestión de Procesos y Expedientes
              </p>
            </div>

            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-primary text-on-primary font-mono text-xs font-bold px-4 py-2.5 rounded hover:bg-primary-container transition-colors shadow-institutional"
            >
              <Plus className="w-4 h-4 text-secondary-container" />
              <span>Nuevo Expediente</span>
            </button>
          </div>

          {/* Metric Summary Cards */}
          <MetricCards adquisiciones={adquisiciones} />

          {/* Acquisitions Table */}
          <div id="expedientes">
            <AcquisitionsTable
              adquisiciones={adquisiciones}
              searchTerm={searchTerm}
              onAdquisicionDeleted={handleDeleteAdquisicion}
            />
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
