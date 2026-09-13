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
              margin: 0;
              padding: 0;
            }
          }
        `
      }} />

      {/* Botones de control en pantalla (ocultos al imprimir) */}
      <div className="fixed top-4 right-6 flex items-center gap-3 print:hidden z-50">
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 bg-[#001e40] hover:bg-[#003366] text-white px-5 py-2.5 rounded-lg font-bold shadow-xl transition-all text-sm"
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
        
        {/* Encabezado Superior con Colores Oficiales ENDE y Logo */}
        <div className="bg-[#001e40] text-white px-5 py-3 rounded-t-sm flex items-center justify-between border-b-2 border-[#feb316]">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-ende-deoruro.png"
              alt="ENDE DEORURO S.A."
              className="h-10 w-auto bg-white p-1 rounded"
            />
            <div>
              <h1 className="text-lg font-black tracking-wide uppercase leading-tight">
                CONTROL DE CORRESPONDENCIA Y SEGUIMIENTO MÁSTER
              </h1>
              <p className="text-xs italic text-blue-100 font-medium">
                Historial acumulado de hojas de ruta enviadas al sistema.
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs uppercase font-mono font-bold tracking-wider bg-white/15 px-3 py-1 rounded block">
              ENDE DEORURO S.A.
            </span>
          </div>
        </div>

        {/* Tabla Oficial de 5 Columnas Exactas según Documento Original */}
        <div className="mt-4">
          <table className="w-full border-collapse border border-neutral-300 text-xs">
            <thead>
              <tr className="bg-neutral-100 text-neutral-800 font-bold border-b border-neutral-300 text-left">
                <th className="border border-neutral-300 px-3 py-2.5 w-12 text-center">
                  ID
                </th>
                <th className="border border-neutral-300 px-3 py-2.5 w-48">
                  Nº Trámite / Correlativo
                </th>
                <th className="border border-neutral-300 px-4 py-2.5">
                  Asunto / Descripción Corta
                </th>
                <th className="border border-neutral-300 px-3 py-2.5 w-44">
                  Ubicación Actual (Área)
                </th>
                <th className="border border-neutral-300 px-3 py-2.5 w-36 text-center">
                  Estado Actual
                </th>
              </tr>
            </thead>
            <tbody>
              {hojas.map((item, idx) => (
                <tr key={item.id} className="border-b border-neutral-300 hover:bg-neutral-50 h-11">
                  <td className="border border-neutral-300 text-center font-mono font-bold px-2 text-neutral-700 bg-neutral-50/50">
                    {idx + 1}
                  </td>
                  <td className="border border-neutral-300 font-mono font-bold px-3 text-neutral-900">
                    {item.cite_correlativo}
                  </td>
                  <td className="border border-neutral-300 px-4 uppercase text-neutral-900 font-medium">
                    {item.asunto_descripcion}
                  </td>
                  <td className="border border-neutral-300 px-3 uppercase font-semibold text-neutral-800">
                    {item.ubicacion_actual || item.institucion_area_origen}
                  </td>
                  <td className="border border-neutral-300 px-2 text-center font-bold">
                    <span className="inline-block px-2.5 py-1 rounded text-xs font-semibold text-neutral-800">
                      {item.estado_actual}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pie de página institucional simple */}
        <div className="mt-8 pt-3 border-t border-neutral-300 text-[10px] text-neutral-500 flex justify-between items-center font-mono">
          <span>ENDE Deoruro S.A. • Control de Correspondencia y Seguimiento</span>
          <span>Formato Oficial F-CC-02 • Papel Tamaño Carta</span>
        </div>
      </div>
    </div>
  );
};
