"use client";

import React from "react";
import { HojaRuta } from "@/lib/types/hojaRuta";
import { Printer, X } from "lucide-react";

interface Props {
  hoja: HojaRuta;
  onClose?: () => void;
}

export const HojaRutaPrintSlip: React.FC<Props> = ({ hoja, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  // Rellenar exactamente los 7 pases oficiales
  const pases = Array.from({ length: 7 }, (_, index) => {
    const existing = hoja.pases?.[index];
    return (
      existing || {
        pase: index + 1,
        destino: "",
        fecha: "",
        hora: "",
        firma: "",
      }
    );
  });

  return (
    <div className="bg-neutral-900/70 fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto print:p-0 print:static print:bg-white print:overflow-visible">
      <style dangerouslySetInnerHTML={{
        __html: `
          @media print {
            @page {
              size: letter portrait;
              margin: 6mm 8mm;
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
          Imprimir Hoja de Ruta (Tamaño Carta)
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

      {/* Hoja Física Formato Estándar Carta (8.5 x 11 pulgadas / 215.9 x 279.4 mm) */}
      <div className="bg-white text-neutral-900 w-[215.9mm] max-w-full min-h-[268mm] p-6 shadow-2xl rounded-sm print:shadow-none print:w-full print:p-0 print:min-h-0 print:border-none font-sans border border-neutral-300">
        
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
              <h1 className="text-xl font-black tracking-wide uppercase leading-tight">
                HOJA DE RUTA
              </h1>
              <p className="text-[11px] italic text-blue-100 font-medium">
                Adjuntar al frente de la carpeta circulante.
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs uppercase font-mono font-bold tracking-wider bg-white/15 px-3 py-1 rounded block">
              ENDE DEORURO S.A.
            </span>
          </div>
        </div>

        {/* Sección Datos del Documento Original */}
        <div className="bg-[#f0f4fa] text-[#001e40] text-[11px] font-black uppercase tracking-wider px-4 py-1.5 border border-t-0 border-[#c5d6ee]">
          DATOS DEL DOCUMENTO ORIGINAL
        </div>

        <div className="p-3.5 border border-neutral-300 border-t-0 text-xs leading-relaxed space-y-2.5">
          {/* Fila 1: Nº Trámite / Correlativo */}
          <div className="grid grid-cols-12 items-center gap-2">
            <div className="col-span-4 font-bold text-neutral-800">
              Nº de Trámite / Correlativo:
            </div>
            <div className="col-span-8 font-mono font-bold text-sm text-neutral-900 bg-neutral-100 px-3 py-1 rounded border border-neutral-300">
              {hoja.cite_correlativo}
            </div>
          </div>

          {/* Fila 2: Fecha de ingreso a la unidad */}
          <div className="grid grid-cols-12 items-center gap-2">
            <div className="col-span-4 font-bold text-neutral-800">
              Fecha de ingreso a la unidad:
            </div>
            <div className="col-span-8 font-mono text-neutral-800">
              {hoja.fecha_ingreso} {hoja.hora_ingreso ? `• ${hoja.hora_ingreso}` : ""}
            </div>
          </div>

          {/* Fila 3: Tipo de Documento */}
          <div className="grid grid-cols-12 items-center gap-2">
            <div className="col-span-4 font-bold text-neutral-800">
              Tipo de Documento:
            </div>
            <div className="col-span-8 font-semibold uppercase text-neutral-800">
              {hoja.tipo_documento}
            </div>
          </div>

          {/* Fila 4: Institución / Área de Origen y Categoría */}
          <div className="grid grid-cols-12 items-center gap-2">
            <div className="col-span-4 font-bold text-neutral-800">
              Institución / Área de Origen:
            </div>
            <div className="col-span-4 font-semibold uppercase text-neutral-800">
              {hoja.institucion_area_origen}
            </div>
            <div className="col-span-2 font-bold text-neutral-800 text-right">
              CATEGORIA:
            </div>
            <div className="col-span-2 font-bold uppercase text-neutral-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 text-center font-mono">
              {hoja.categoria}
            </div>
          </div>

          {/* Fila 5: Asunto / Descripción Corta */}
          <div className="grid grid-cols-12 items-start gap-2 pt-1.5 border-t border-neutral-200">
            <div className="col-span-4 font-bold text-neutral-800 pt-1">
              Asunto / Descripción Corta:
            </div>
            <div className="col-span-8 font-medium text-neutral-900 uppercase bg-neutral-50 p-2 rounded border border-neutral-200 min-h-[40px]">
              {hoja.asunto_descripcion}
            </div>
          </div>
        </div>

        {/* Sección Historial de Circulación y Control de Pases */}
        <div className="mt-4">
          <div className="bg-[#f0f4fa] text-[#001e40] text-[11px] font-black uppercase tracking-wider px-4 py-1.5 border border-[#c5d6ee]">
            HISTORIAL DE CIRCULACIÓN Y CONTROL DE PASES
          </div>

          <table className="w-full border-collapse border border-neutral-300 text-xs">
            <thead>
              <tr className="bg-neutral-100 text-neutral-800 font-bold border-b border-neutral-300">
                <th className="border border-neutral-300 px-2 py-2 w-14 text-center">
                  Nº Pase
                </th>
                <th className="border border-neutral-300 px-3 py-2 text-left">
                  Area / Departamento de Destino
                </th>
                <th className="border border-neutral-300 px-2 py-2 w-28 text-center">
                  Fecha de Recibo
                </th>
                <th className="border border-neutral-300 px-2 py-2 w-20 text-center">
                  Hora
                </th>
                <th className="border border-neutral-300 px-3 py-2 w-36 text-center">
                  Firma de Recibido
                </th>
              </tr>
            </thead>
            <tbody>
              {pases.map((p) => (
                <tr key={p.pase} className="h-11 text-neutral-800">
                  <td className="border border-neutral-300 text-center font-bold bg-neutral-50">
                    {p.pase}
                  </td>
                  <td className="border border-neutral-300 px-3 font-semibold uppercase">
                    {p.destino}
                  </td>
                  <td className="border border-neutral-300 text-center font-mono">
                    {p.fecha}
                  </td>
                  <td className="border border-neutral-300 text-center font-mono">
                    {p.hora}
                  </td>
                  <td className="border border-neutral-300 px-2 text-center text-[10px] text-neutral-600 font-medium">
                    {p.firma}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pie de página oficial */}
        <div className="mt-6 pt-3 border-t border-dashed border-neutral-300 text-[10px] text-neutral-500 flex justify-between items-center font-mono">
          <span>Sistema Integrado de Adquisiciones y Contrataciones • ENDE Deoruro S.A.</span>
          <span>Impresión Formato Carta • {new Date().toLocaleDateString("es-BO")}</span>
          <span>Formato Oficial F-HR-01</span>
        </div>
      </div>
    </div>
  );
};
