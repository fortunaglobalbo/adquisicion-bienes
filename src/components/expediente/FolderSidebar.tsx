"use client";

import React from "react";
import {
  Sparkles,
  FileText,
  Table,
  ReceiptText,
  CheckCircle2,
  FileCheck2,
  FileSignature,
  FolderOpen,
} from "lucide-react";
import { Carpeta } from "@/types";

interface FolderSidebarProps {
  carpetas: Carpeta[];
  activeNumero: number;
  onSelectNumero: (num: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8) => void;
}

export const FolderSidebar: React.FC<FolderSidebarProps> = ({
  carpetas,
  activeNumero,
  onSelectNumero,
}) => {
  const getFolderIcon = (numero: number) => {
    switch (numero) {
      case 1:
        return Sparkles;
      case 2:
        return FileText;
      case 3:
        return Table;
      case 4:
        return ReceiptText;
      case 5:
        return Sparkles;
      case 6:
        return Sparkles;
      case 7:
        return FileCheck2;
      case 8:
        return FileSignature;
      default:
        return FolderOpen;
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between px-2 mb-1">
        <h3 className="font-mono text-xs font-bold text-on-surface-variant uppercase tracking-wider">
          Carpetas del Expediente
        </h3>
        <span className="text-[10px] font-mono bg-surface-container-high px-1.5 py-0.5 rounded text-on-surface-variant">
          8 Fijas
        </span>
      </div>

      {carpetas.map((folder) => {
        const isActive = folder.numero === activeNumero;
        const isAI = folder.tipo_generacion === "IA";
        const hasDocs = folder.documentos.length > 0;
        const Icon = getFolderIcon(folder.numero);

        return (
          <button
            key={folder.id}
            onClick={() => onSelectNumero(folder.numero as any)}
            className={`w-full flex items-center justify-between p-3 text-left rounded transition-all duration-150 group ${
              isActive
                ? "bg-surface-container-lowest border-l-4 border-primary shadow-sm border border-outline-variant"
                : "border border-transparent hover:bg-surface-container-low"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0 pr-2">
              <Icon
                className={`w-4 h-4 flex-shrink-0 ${
                  isActive
                    ? isAI
                      ? "text-secondary-fixed-variant"
                      : "text-primary"
                    : isAI
                    ? "text-secondary opacity-70"
                    : "text-outline"
                }`}
              />
              <span
                className={`font-sans text-xs truncate ${
                  isActive ? "text-primary font-bold" : "text-on-surface-variant"
                }`}
              >
                {folder.numero}. {folder.nombre}
              </span>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              {hasDocs && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Contiene documentos"></span>
              )}
              {isAI ? (
                <span
                  className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
                    isActive
                      ? "bg-primary-container text-on-primary-container font-semibold"
                      : "border border-outline-variant text-outline bg-surface-container-low"
                  }`}
                >
                  AI
                </span>
              ) : (
                <span className="font-mono text-[10px] text-outline border border-outline-variant px-1.5 py-0.5 rounded bg-surface-container-low">
                  Manual
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};
