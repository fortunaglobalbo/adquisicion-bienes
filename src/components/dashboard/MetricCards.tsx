"use client";

import React from "react";
import { TrendingUp, Clock, CheckCircle2 } from "lucide-react";
import { Adquisicion } from "@/types";

interface MetricCardsProps {
  adquisiciones?: Adquisicion[];
}

export const MetricCards: React.FC<MetricCardsProps> = ({ adquisiciones = [] }) => {
  const safeList = Array.isArray(adquisiciones) ? adquisiciones : [];
  const totalActivos = safeList.filter((a) => a && a.estado !== "Concluido" && a.estado !== "Cancelado").length;
  const pendientesIA = safeList.filter((a) => a && (a.estado === "Generación IA" || a.estado === "Iniciado")).length;
  const concluidos = safeList.filter((a) => a && a.estado === "Concluido").length;
  const montoTotalBs = safeList.reduce((sum, a) => sum + (Number(a?.prevision_presupuesto) || 0), 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {/* Stat 1: Total Procesos Activos */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 relative overflow-hidden shadow-institutional">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-secondary-container"></div>
        <p className="font-mono text-xs text-on-surface-variant uppercase tracking-wider mb-1">
          Procesos en Curso
        </p>
        <h3 className="font-headline-lg text-3xl font-bold text-primary">{totalActivos}</h3>
        <p className="font-mono text-xs text-secondary mt-2 flex items-center gap-1">
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Gestión Activa PAC 2026</span>
        </p>
      </div>

      {/* Stat 2: Pendientes de Generación IA */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 relative overflow-hidden shadow-institutional">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary-fixed-dim"></div>
        <p className="font-mono text-xs text-on-surface-variant uppercase tracking-wider mb-1">
          Pendientes IA (Carpetas 1, 5, 6)
        </p>
        <h3 className="font-headline-lg text-3xl font-bold text-on-surface">{pendientesIA}</h3>
        <p className="font-mono text-xs text-on-surface-variant mt-2 flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-primary" />
          <span>Requiere emisión de pliego</span>
        </p>
      </div>

      {/* Stat 3: Concluidos */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 relative overflow-hidden shadow-institutional">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-status-signed"></div>
        <p className="font-mono text-xs text-on-surface-variant uppercase tracking-wider mb-1">
          Expedientes Concluidos
        </p>
        <h3 className="font-headline-lg text-3xl font-bold text-emerald-800">{concluidos}</h3>
        <p className="font-mono text-xs text-emerald-700 mt-2 flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Conformidad y Cierre</span>
        </p>
      </div>

      {/* Stat 4: Presupuesto Global */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 relative overflow-hidden shadow-institutional">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>
        <p className="font-mono text-xs text-on-surface-variant uppercase tracking-wider mb-1">
          Presupuesto Estimado Total
        </p>
        <h3 className="font-headline-lg text-2xl font-bold text-primary truncate">
          Bs. {montoTotalBs.toLocaleString("es-BO", { minimumFractionDigits: 2 })}
        </h3>
        <p className="font-mono text-[11px] text-on-surface-variant mt-2">
          {safeList.length} expedientes registrados
        </p>
      </div>
    </div>
  );
};
