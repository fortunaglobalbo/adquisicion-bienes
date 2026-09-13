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

  // Rellenar hasta 7 pases si vienen menos
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
    <div className="bg-neutral-900/60 fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto print:p-0 print:static print:bg-white">
      {/* Botones de control en pantalla (ocultos al imprimir) */}
      <div className="absolute top-4 right-6 flex items-center gap-3 print:hidden z-50">
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 bg-[#d9531e] hover:bg-[#b84214] text-white px-4 py-2 rounded-lg font-bold shadow-lg transition-all"
        >
          <Printer className="w-4 h-4" />
          Imprimir Carátula A4
        </button>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 rounded-lg hover:bg-neutral-100 shadow"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Hoja Física Formato Estándar */}
      <div className="bg-white text-neutral-900 w-[210mm] min-h-[280mm] p-8 shadow-2xl rounded-sm print:shadow-none print:w-full print:p-4 print:min-h-0 font-sans border border-neutral-200 print:border-none">
        
        {/* Encabezado Superior Naranja */}
        <div className="bg-[#d9531e] text-white px-5 py-3 rounded-t-sm flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black tracking-wide uppercase">HOJA DE RUTA</h1>
            <p className="text-xs italic text-orange-100 font-medium">Adjuntar al frente de la carpeta circulante.</p>
          </div>
          <div className="text-right">
            <span className="text-xs uppercase font-mono tracking-wider bg-white/20 px-2.5 py-1 rounded">
              ENDE DEORURO S.A.
            </span>
          </div>
        </div>

        {/* Sección Datos del Documento Original */}
        <div className="bg-[#fcefe8] text-[#d9531e] text-xs font-black uppercase tracking-wider px-4 py-1.5 border-b border-[#f3c8b4]">
          DATOS DEL DOCUMENTO ORIGINAL
        </div>

        <div className="p-4 border border-neutral-300 border-t-0 text-xs leading-relaxed space-y-3">
          {/* Fila 1: Nº Trámite / Correlativo */}
          <div className="grid grid-cols-12 items-center gap-2">
            <div className="col-span-4 font-bold text-neutral-700">
              Nº de Trámite / Correlativo:
            </div>
            <div className="col-span-8 font-mono font-bold text-sm text-neutral-900 bg-neutral-100 px-3 py-1.5 rounded border border-neutral-300">
              {hoja.cite_correlativo}
            </div>
          </div>

          {/* Fila 2: Fecha de ingreso a la unidad */}
          <div className="grid grid-cols-12 items-center gap-2">
            <div className="col-span-4 font-bold text-neutral-700">
              Fecha de ingreso a la unidad:
            </div>
            <div className="col-span-8 font-mono text-neutral-800">
              {hoja.fecha_ingreso} {hoja.hora_ingreso ? `• ${hoja.hora_ingreso}` : ""}
            </div>
          </div>

          {/* Fila 3: Tipo de Documento */}
          <div className="grid grid-cols-12 items-center gap-2">
            <div className="col-span-4 font-bold text-neutral-700">
              Tipo de Documento:
            </div>
            <div className="col-span-8 font-semibold uppercase text-neutral-800">
              {hoja.tipo_documento}
            </div>
          </div>

          {/* Fila 4: Institución / Área de Origen y Categoría */}
          <div className="grid grid-cols-12 items-center gap-2">
            <div className="col-span-4 font-bold text-neutral-700">
              Institución / Área de Origen:
            </div>
            <div className="col-span-4 font-semibold uppercase text-neutral-800">
              {hoja.institucion_area_origen}
            </div>
            <div className="col-span-2 font-bold text-neutral-700 text-right">
              CATEGORIA:
            </div>
            <div className="col-span-2 font-bold uppercase text-neutral-900 bg-orange-50 px-2 py-0.5 rounded border border-orange-200 text-center">
              {hoja.categoria}
            </div>
          </div>

          {/* Fila 5: Asunto / Descripción Corta */}
          <div className="grid grid-cols-12 items-start gap-2 pt-2 border-t border-neutral-200">
            <div className="col-span-4 font-bold text-neutral-700 pt-1">
              Asunto / Descripción Corta:
            </div>
            <div className="col-span-8 font-medium text-neutral-900 uppercase bg-neutral-50 p-2 rounded border border-neutral-200 min-h-[44px]">
              {hoja.asunto_descripcion}
            </div>
          </div>
        </div>

        {/* Sección Historial de Circulación y Control de Pases */}
        <div className="mt-6">
          <div className="bg-[#fcefe8] text-[#d9531e] text-xs font-black uppercase tracking-wider px-4 py-1.5 border border-[#f3c8b4]">
            HISTORIAL DE CIRCULACIÓN Y CONTROL DE PASES
          </div>

          <table className="w-full border-collapse border border-neutral-300 text-xs">
            <thead>
              <tr className="bg-neutral-100 text-neutral-700 font-bold border-b border-neutral-300">
                <th className="border border-neutral-300 px-2 py-2 w-16 text-center">
                  Nº Pase
                </th>
                <th className="border border-neutral-300 px-3 py-2 text-left">
                  Área / Departamento de Destino
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
                <tr key={p.pase} className="h-12 text-neutral-800">
                  <td className="border border-neutral-300 text-center font-bold bg-neutral-50/50">
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
                  <td className="border border-neutral-300 px-2 text-center text-[10px] text-neutral-500 italic">
                    {p.firma}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pie de página oficial */}
        <div className="mt-8 pt-4 border-t border-dashed border-neutral-300 text-[10px] text-neutral-500 flex justify-between items-center font-mono">
          <span>Sistema Integrado de Adquisiciones y Contrataciones</span>
          <span>Impreso el: {new Date().toLocaleDateString("es-BO")}</span>
          <span>Formato Oficial F-HR-01</span>
        </div>
      </div>
    </div>
  );
};
