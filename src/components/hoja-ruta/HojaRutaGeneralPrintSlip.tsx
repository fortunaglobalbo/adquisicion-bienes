"use client";

import React from "react";
import { HojaRuta } from "@/lib/types/hojaRuta";
import { Printer, X } from "lucide-react";

interface Props {
  hojas: HojaRuta[];
  onClose?: () => void;
}

export const HojaRutaGeneralPrintSlip: React.FC<Props> = ({ hojas, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  const total = hojas.length;
  const adjudicados = hojas.filter((h) => h.estado_actual === "Adjudicado").length;
  const enCirculacion = hojas.filter((h) => h.estado_actual === "En Circulación").length;
  const enEvaluacion = hojas.filter((h) => h.estado_actual === "En Evaluación").length;
  const desiertos = hojas.filter((h) => h.estado_actual === "Desierto").length;

  return (
    <div className="bg-neutral-900/70 fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto print:p-0 print:static print:bg-white print:overflow-visible">
      <style dangerouslySetInnerHTML={{
        __html: `
          @media print {
            @page {
              size: letter landscape;
              margin: 8mm;
            }
            body {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
        `
      }} />

      {/* Botones de control en pantalla (ocultos al imprimir) */}
      <div className="fixed top-4 right-6 flex items-center gap-3 print:hidden z-50">
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 bg-[#d9531e] hover:bg-[#b84214] text-white px-5 py-2.5 rounded-lg font-bold shadow-xl transition-all text-sm"
        >
          <Printer className="w-4 h-4" />
          Imprimir Reporte General (Carta Horizontal)
        </button>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2.5 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 shadow-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Documento Carta Horizontal (11 x 8.5 pulgadas / 279.4 x 215.9 mm) */}
      <div className="bg-white text-neutral-900 w-[279.4mm] max-w-full min-h-[205mm] p-6 shadow-2xl rounded-sm print:shadow-none print:w-full print:p-0 print:min-h-0 print:border-none font-sans border border-neutral-300">
        
        {/* Encabezado Superior Naranja */}
        <div className="bg-[#d9531e] text-white px-5 py-3 rounded-t-sm flex items-center justify-between border-b-2 border-[#b84214]">
          <div>
            <h1 className="text-lg font-black tracking-wide uppercase">
              CONTROL DE CORRESPONDENCIA Y SEGUIMIENTO MÁSTER
            </h1>
            <p className="text-xs italic text-orange-100 font-medium">
              Historial acumulado de hojas de ruta enviadas al sistema
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs uppercase font-mono font-bold tracking-wider bg-white/20 px-3 py-1 rounded block">
              ENDE DEORURO S.A.
            </span>
            <span className="text-[10px] text-orange-100 mt-0.5 block font-mono">
              Fecha: {new Date().toLocaleDateString("es-BO")} • {new Date().toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>

        {/* Resumen de Métricas */}
        <div className="bg-[#fcefe8] border-x border-b border-[#f3c8b4] px-4 py-2 flex flex-wrap items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-4 text-neutral-800">
            <span>Total Trámites: <strong className="text-neutral-950 font-bold">{total}</strong></span>
            <span>•</span>
            <span>Adjudicados: <strong className="text-emerald-700 font-bold">{adjudicados}</strong></span>
            <span>•</span>
            <span>En Circulación: <strong className="text-amber-700 font-bold">{enCirculacion}</strong></span>
            <span>•</span>
            <span>En Evaluación: <strong className="text-blue-700 font-bold">{enEvaluacion}</strong></span>
            {desiertos > 0 && (
              <>
                <span>•</span>
                <span>Desiertos: <strong className="text-red-700 font-bold">{desiertos}</strong></span>
              </>
            )}
          </div>
          <span className="text-[11px] text-neutral-600 uppercase font-sans font-bold">
            Formato Oficial F-CC-02 • Papel Tamaño Carta
          </span>
        </div>

        {/* Tabla General de Trámites */}
        <div className="mt-3">
          <table className="w-full border-collapse border border-neutral-300 text-[11px]">
            <thead>
              <tr className="bg-neutral-100 text-neutral-800 font-bold border-b border-neutral-300">
                <th className="border border-neutral-300 px-2 py-2 w-10 text-center">ID</th>
                <th className="border border-neutral-300 px-2.5 py-2 w-32 text-left">Nº Trámite / Correlativo</th>
                <th className="border border-neutral-300 px-2 py-2 w-20 text-center">Fecha Ingreso</th>
                <th className="border border-neutral-300 px-2 py-2 w-16 text-center">Cat.</th>
                <th className="border border-neutral-300 px-3 py-2 text-left">Asunto / Descripción Corta</th>
                <th className="border border-neutral-300 px-2.5 py-2 w-32 text-left">Ubicación Actual (Área)</th>
                <th className="border border-neutral-300 px-2.5 py-2 w-28 text-center">Estado Actual</th>
                <th className="border border-neutral-300 px-2.5 py-2 w-32 text-center">Fecha Adjudicación</th>
              </tr>
            </thead>
            <tbody>
              {hojas.map((item, idx) => (
                <tr key={item.id} className="border-b border-neutral-300 hover:bg-neutral-50 leading-tight">
                  <td className="border border-neutral-300 text-center font-mono font-bold py-2 px-1 text-neutral-600 bg-neutral-50/60">
                    {idx + 1}
                  </td>
                  <td className="border border-neutral-300 font-mono font-bold py-2 px-2.5 text-neutral-900">
                    {item.cite_correlativo}
                  </td>
                  <td className="border border-neutral-300 text-center font-mono py-2 px-2 text-neutral-700">
                    {item.fecha_ingreso}
                  </td>
                  <td className="border border-neutral-300 text-center font-bold py-2 px-1 text-neutral-800">
                    {item.categoria}
                  </td>
                  <td className="border border-neutral-300 py-2 px-3 uppercase text-neutral-900 font-medium">
                    {item.asunto_descripcion}
                  </td>
                  <td className="border border-neutral-300 py-2 px-2.5 uppercase font-semibold text-neutral-800">
                    {item.ubicacion_actual || item.institucion_area_origen}
                  </td>
                  <td className="border border-neutral-300 py-2 px-2 text-center font-bold">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] ${
                      item.estado_actual === 'Adjudicado'
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        : item.estado_actual === 'En Circulación'
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : item.estado_actual === 'En Evaluación'
                        ? 'bg-blue-100 text-blue-900 border border-blue-300'
                        : 'bg-neutral-100 text-neutral-800 border border-neutral-300'
                    }`}>
                      {item.estado_actual}
                    </span>
                  </td>
                  <td className="border border-neutral-300 py-2 px-2 text-center font-mono text-[10px] text-neutral-700">
                    {item.fecha_adjudicacion
                      ? new Date(item.fecha_adjudicacion).toLocaleString("es-BO", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pie de página y firmas de supervisión */}
        <div className="mt-8 pt-4 border-t border-neutral-300 grid grid-cols-3 gap-8 text-center text-xs font-mono">
          <div className="border-t border-neutral-400 pt-1 text-neutral-600">
            Responsable de Adquisiciones
          </div>
          <div className="border-t border-neutral-400 pt-1 text-neutral-600">
            Control de Correspondencia
          </div>
          <div className="border-t border-neutral-400 pt-1 text-neutral-600">
            Supervisión Administrativa
          </div>
        </div>
      </div>
    </div>
  );
};
