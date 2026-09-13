"use client";

import React, { useState, useEffect } from "react";
import { HojaRuta, HojaRutaEstado } from "@/lib/types/hojaRuta";
import { HojaRutaService } from "@/lib/services/hojaRutaService";
import { FormularioHojaRuta } from "@/components/hoja-ruta/FormularioHojaRuta";
import { TablaSeguimientoMaster } from "@/components/hoja-ruta/TablaSeguimientoMaster";
import { HojaRutaPrintSlip } from "@/components/hoja-ruta/HojaRutaPrintSlip";
import { HojaRutaGeneralPrintSlip } from "@/components/hoja-ruta/HojaRutaGeneralPrintSlip";
import {
  FileSpreadsheet,
  Columns,
  Maximize2,
  Minimize2,
  RefreshCw,
  Printer,
  Sparkles,
  ExternalLink,
} from "lucide-react";

export default function HojaRutaPage() {
  const [hojas, setHojas] = useState<HojaRuta[]>([]);
  const [loading, setLoading] = useState(true);
  const [printingHoja, setPrintingHoja] = useState<HojaRuta | null>(null);
  const [printingGeneral, setPrintingGeneral] = useState<HojaRuta[] | null>(null);
  const [fullTableView, setFullTableView] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const res = await HojaRutaService.fetchAll();
    if (res.data) {
      setHojas(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreated = (nueva: HojaRuta) => {
    setHojas((prev) => [nueva, ...prev.filter((h) => h.id !== nueva.id)]);
  };

  const handleUpdateEstado = async (id: string, nuevoEstado: HojaRutaEstado) => {
    // Actualización optimista inmediata en UI
    const now = new Date().toISOString();
    setHojas((prev) =>
      prev.map((h) => {
        if (h.id === id) {
          return {
            ...h,
            estado_actual: nuevoEstado,
            fecha_adjudicacion:
              nuevoEstado === "Adjudicado" ? now : h.fecha_adjudicacion,
          };
        }
        return h;
      })
    );

    await HojaRutaService.updateStatus(id, nuevoEstado);
  };

  const handleDelete = async (id: string) => {
    setHojas((prev) => prev.filter((h) => h.id !== id));
    await HojaRutaService.delete(id);
  };

  return (
    <div className="min-h-screen bg-neutral-100 dark:bg-neutral-950 p-4 md:p-6 flex flex-col gap-5">
      {/* Top Banner & Acciones Rápidas */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-neutral-900 px-6 py-4 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm border-l-4 border-l-[#001e40]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#001e40] text-white flex items-center justify-center font-bold shadow-sm">
            <FileSpreadsheet className="w-6 h-6 text-[#feb316]" />
          </div>
          <div>
            <h1 className="text-lg font-black text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center gap-2">
              Hoja de Ruta & Seguimiento Máster
              <span className="text-[11px] font-mono font-bold bg-[#001e40]/10 text-[#001e40] dark:bg-[#feb316]/20 dark:text-[#feb316] px-2 py-0.5 rounded-full">
                ENDE DEORURO S.A.
              </span>
            </h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Generación de carátulas para carpetas circulantes y control en tiempo real de correspondencia
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Sincronizar</span>
          </button>

          <button
            onClick={() => setPrintingGeneral(hojas)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-[#001e40] hover:bg-[#003366] text-white rounded-lg shadow-sm transition-colors"
            title="Imprimir reporte general en tamaño Carta"
          >
            <Printer className="w-3.5 h-3.5 text-[#feb316]" />
            <span>Imprimir General (Carta)</span>
          </button>

          <button
            onClick={() => setFullTableView(!fullTableView)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors"
          >
            {fullTableView ? (
              <>
                <Columns className="w-3.5 h-3.5" />
                <span>Panel Dual</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Solo Tabla Máster</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Vista Principal: Panel Dual o Tabla Completa */}
      <div
        className={`grid gap-5 flex-1 items-start ${
          fullTableView
            ? "grid-cols-1"
            : "grid-cols-1 lg:grid-cols-12"
        }`}
      >
        {/* Lado Izquierdo: Formulario Rápido (40% en desktop) */}
        {!fullTableView && (
          <div className="lg:col-span-5 flex flex-col gap-4">
            <FormularioHojaRuta onCreated={handleCreated} />
          </div>
        )}

        {/* Lado Derecho: Tabla Seguimiento Máster (60% en desktop) */}
        <div className={fullTableView ? "col-span-1" : "lg:col-span-7"}>
          <TablaSeguimientoMaster
            hojas={hojas}
            onUpdateEstado={handleUpdateEstado}
            onPrint={(hoja) => setPrintingHoja(hoja)}
            onPrintGeneral={(items) => setPrintingGeneral(items)}
            onDelete={handleDelete}
          />
        </div>
      </div>

      {/* Modal de Impresión Oficial Individual (Página 1 del documento - Carta Vertical) */}
      {printingHoja && (
        <HojaRutaPrintSlip
          hoja={printingHoja}
          onClose={() => setPrintingHoja(null)}
        />
      )}

      {/* Modal de Impresión General de Todo (Página 2 del documento - Carta Horizontal) */}
      {printingGeneral && (
        <HojaRutaGeneralPrintSlip
          hojas={printingGeneral}
          onClose={() => setPrintingGeneral(null)}
        />
      )}
    </div>
  );
}
