"use client";

import React from "react";
import { CampoExtraido } from "@/types";
import { CheckCircle2, AlertCircle, ScanText } from "lucide-react";

interface ExtractedFieldsViewerProps {
  campos: CampoExtraido[];
}

export const ExtractedFieldsViewer: React.FC<ExtractedFieldsViewerProps> = ({ campos }) => {
  if (campos.length === 0) {
    return (
      <div className="p-8 text-center border border-outline-variant rounded bg-surface text-xs font-mono text-on-surface-variant flex flex-col items-center justify-center">
        <ScanText className="w-8 h-8 text-outline mb-2 opacity-60" />
        <p>No se han extraído campos OCR todavía.</p>
        <p className="text-[11px] text-outline mt-1">
          Suba un formulario o documento escaneado para procesar automáticamente los campos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-mono text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Datos Reconocidos por OCR e Inteligencia Artificial</span>
        </h4>
        <span className="font-mono text-[10px] bg-surface-container-high px-2 py-0.5 rounded text-on-surface-variant">
          {campos.length} campos detectados
        </span>
      </div>

      <div className="border border-outline-variant rounded-lg overflow-hidden bg-surface-container-lowest shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low border-b border-outline-variant font-mono text-[11px] text-on-surface-variant uppercase">
              <th className="p-3 font-semibold">Campo / Clave</th>
              <th className="p-3 font-semibold">Valor Extraído</th>
              <th className="p-3 font-semibold text-center">Confianza</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant text-xs">
            {campos.map((c) => (
              <tr key={c.id} className="hover:bg-surface-container-low/50 transition-colors">
                <td className="p-3 font-mono font-bold text-primary whitespace-nowrap">
                  {c.clave}
                </td>
                <td className="p-3 font-sans text-on-surface">
                  {c.clave.includes("NIT") ? (
                    <span className="font-mono font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-300">
                      {c.valor}
                    </span>
                  ) : (
                    c.valor
                  )}
                </td>
                <td className="p-3 text-center font-mono text-[11px]">
                  <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {(c.confianza * 100).toFixed(0)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
