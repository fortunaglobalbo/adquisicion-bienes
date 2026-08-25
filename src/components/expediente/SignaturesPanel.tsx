"use client";

import React, { useState } from "react";
import { Firma } from "@/types";
import { CheckCircle2, ShieldCheck, PenTool, Clock } from "lucide-react";

interface SignaturesPanelProps {
  firmas: Firma[];
  onSign: (firmaId: string) => void;
}

export const SignaturesPanel: React.FC<SignaturesPanelProps> = ({ firmas, onSign }) => {
  const [signingId, setSigningId] = useState<string | null>(null);

  const handleSignClick = (firmaId: string) => {
    setSigningId(firmaId);
    setTimeout(() => {
      onSign(firmaId);
      setSigningId(null);
    }, 400);
  };

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 shadow-institutional">
      <div className="flex items-center justify-between mb-4 border-b border-outline-variant pb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <h4 className="font-headline-md text-sm font-bold text-primary">
            Validación y Firmas del Expediente
          </h4>
        </div>
        <span className="font-mono text-xs text-on-surface-variant">
          {firmas.filter((f) => f.firmado).length} de {firmas.length} Firmados
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {firmas.map((f) => (
          <div
            key={f.id}
            className={`p-4 rounded border transition-all ${
              f.firmado
                ? "bg-emerald-50/60 border-emerald-300"
                : "bg-surface-container-low border-outline-variant"
            }`}
          >
            <div className="flex justify-between items-start mb-2">
              <span className="font-mono text-[10px] uppercase font-bold text-outline">
                Paso {f.orden} • {f.rol}
              </span>
              {f.firmado ? (
                <span className="inline-flex items-center gap-1 font-mono text-[11px] text-emerald-800 font-bold bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Firmado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-mono text-[11px] text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  Pendiente
                </span>
              )}
            </div>

            <p className="font-sans text-xs font-bold text-on-surface">{f.nombre}</p>
            <p className="font-mono text-[11px] text-on-surface-variant mt-0.5">{f.cargo}</p>

            {f.firmado && f.fecha_firma && (
              <p className="font-mono text-[10px] text-emerald-700 mt-2">
                Fecha: {new Date(f.fecha_firma).toLocaleString()}
              </p>
            )}

            {!f.firmado && (
              <button
                onClick={() => handleSignClick(f.id)}
                disabled={signingId === f.id}
                className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-primary text-on-primary rounded font-mono text-xs font-bold hover:bg-primary-container transition-colors disabled:opacity-50"
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>{signingId === f.id ? "Firmando..." : "Firmar Digitalmente"}</span>
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
