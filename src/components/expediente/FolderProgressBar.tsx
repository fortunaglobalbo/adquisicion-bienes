"use client";

import React from "react";
import { Check, Sparkles } from "lucide-react";
import { Carpeta } from "@/types";

interface FolderProgressBarProps {
  carpetas?: Carpeta[];
  activeNumero: number;
  onSelectNumero: (num: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8) => void;
}

export const FolderProgressBar: React.FC<FolderProgressBarProps> = ({
  carpetas = [],
  activeNumero,
  onSelectNumero,
}) => {
  const safeCarpetas = Array.isArray(carpetas) && carpetas.length > 0 ? carpetas : [];

  const shortNames = [
    "TDR",
    "S1-N014",
    "Justificación",
    "Cotización",
    "Solicitud",
    "S2-N014",
    "Conformidad",
    "Contrato",
  ];

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 shadow-institutional">
      <div className="flex justify-between items-center relative">
        {/* Connecting Line */}
        <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-outline-variant -translate-y-1/2 z-0" />

        {/* 8 Stages */}
        {safeCarpetas.map((folder, index) => {
          const num = (folder.numero || index + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
          const isActive = num === activeNumero;
          const docsCount = Array.isArray(folder.documentos) ? folder.documentos.length : 0;
          const isCompleted = folder.estado === "Completado" || docsCount > 0;
          const isAI = folder.tipo_generacion === "IA";

          let circleStyle = "bg-surface-container-high border-outline-variant text-outline";
          if (isActive) {
            circleStyle = "bg-secondary-container border-secondary text-on-secondary-container ring-4 ring-secondary-container/20 scale-110";
          } else if (isCompleted) {
            circleStyle = "bg-primary text-on-primary border-primary";
          }

          return (
            <button
              key={folder.id || `folder-${num}`}
              onClick={() => onSelectNumero(num)}
              className="relative z-10 flex flex-col items-center gap-1.5 bg-surface-container-lowest px-2 py-1 rounded transition-all group"
            >
              <div
                className={`w-8 h-8 rounded border flex items-center justify-center font-mono text-xs font-bold transition-all ${circleStyle}`}
              >
                {isCompleted && !isActive ? (
                  <Check className="w-4 h-4 text-on-primary stroke-[3]" />
                ) : (
                  <span>{num}</span>
                )}
              </div>

              <div className="text-center">
                <span
                  className={`font-mono text-[11px] block transition-colors ${
                    isActive
                      ? "text-primary font-bold"
                      : isCompleted
                      ? "text-on-surface font-medium"
                      : "text-outline"
                  }`}
                >
                  {shortNames[index] || `C${num}`}
                </span>
                {isAI && (
                  <span className="inline-flex items-center gap-0.5 font-mono text-[9px] text-secondary">
                    <Sparkles className="w-2.5 h-2.5" />
                    AI
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
