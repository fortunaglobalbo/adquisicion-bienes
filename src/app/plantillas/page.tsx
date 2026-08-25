"use client";

import React, { useState, useEffect } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { DataStore } from "@/lib/store/dataStore";
import { Plantilla } from "@/types";
import {
  FileText,
  Sparkles,
  CheckCircle2,
  Edit3,
  Layout,
  HelpCircle,
  FolderOpen,
  ArrowRight,
  Layers,
} from "lucide-react";
import { VisualTemplateEditor } from "@/components/plantillas/VisualTemplateEditor";
import { Modal } from "@/components/ui/Modal";

export default function PlantillasPage() {
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [activeEditorPlantilla, setActiveEditorPlantilla] = useState<Plantilla | null>(null);
  const [selectedInfoPlantilla, setSelectedInfoPlantilla] = useState<Plantilla | null>(null);
  const [globalSavedFeedback, setGlobalSavedFeedback] = useState(false);

  useEffect(() => {
    const list = DataStore.getPlantillas();
    setPlantillas(list);
    // Seleccionar por defecto la Plantilla 1 (TDR) si no hay seleccionada
    if (list.length > 0 && !activeEditorPlantilla) {
      setActiveEditorPlantilla(list[0]);
    }
  }, []);

  const handleSavePlantilla = (updated: Plantilla) => {
    DataStore.updatePlantilla(updated.id, updated);
    const refreshed = DataStore.getPlantillas();
    setPlantillas(refreshed);
    setActiveEditorPlantilla(updated);
    setGlobalSavedFeedback(true);
    setTimeout(() => setGlobalSavedFeedback(false), 2500);
  };

  return (
    <>
      <Topbar title="Taller de Maquetación y Plantillas Oficiales" />

      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-container-max mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-outline-variant pb-4 gap-2">
            <div>
              <h2 className="font-headline-lg text-2xl font-bold text-on-surface tracking-tight flex items-center gap-2">
                <Layout className="w-6 h-6 text-primary" />
                <span>Taller de Maquetación y Plantillas Oficiales</span>
              </h2>
              <p className="font-sans text-xs text-on-surface-variant mt-0.5">
                Distribuidora de Electricidad ENDE Deoruro S.A. • Diseñador Visual de Documentos Word (.docx)
              </p>
            </div>
            {globalSavedFeedback && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-100 px-3.5 py-1.5 rounded-full animate-bounce border border-emerald-300 shadow-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ¡Plantilla actualizada y guardada!
              </span>
            )}
          </div>

          {/* Selector Visual de las 8 Carpetas / Plantillas */}
          <div className="space-y-2">
            <label className="text-xs font-mono font-bold text-outline uppercase tracking-wider block">
              Selecciona el Documento Institucional a Maquetar:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
              {plantillas.map((p) => {
                const isSelected = activeEditorPlantilla?.id === p.id;
                const isAI = p.fk_carpeta === 1 || p.fk_carpeta === 5 || p.fk_carpeta === 6;

                return (
                  <button
                    key={p.id}
                    onClick={() => setActiveEditorPlantilla(p)}
                    className={`p-3 rounded-lg border-2 text-left transition-all flex flex-col justify-between relative overflow-hidden ${
                      isSelected
                        ? "bg-primary text-white border-primary shadow-lg scale-105 z-10"
                        : "bg-surface border-outline-variant hover:border-primary/50 text-on-surface"
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span
                        className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          isSelected ? "bg-white/20 text-white" : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        Carpeta {p.fk_carpeta}
                      </span>
                      {isAI && (
                        <span className={`text-[10px] ${isSelected ? "text-amber-300" : "text-amber-500"}`}>
                          ✨
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-xs line-clamp-2 leading-tight mt-1">
                      {p.fk_carpeta === 1
                        ? "TDR (7 Págs.)"
                        : p.fk_carpeta === 2
                        ? "Form S1"
                        : p.fk_carpeta === 3
                        ? "Justificación"
                        : p.fk_carpeta === 4
                        ? "Cotizaciones"
                        : p.fk_carpeta === 5
                        ? "Solicitud Inicio"
                        : p.fk_carpeta === 6
                        ? "Form S2-N014"
                        : p.fk_carpeta === 7
                        ? "Conformidad"
                        : "Contrato / Orden"}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Editor Visual de la Plantilla Seleccionada */}
          {activeEditorPlantilla && (
            <VisualTemplateEditor
              key={activeEditorPlantilla.id}
              plantilla={activeEditorPlantilla}
              onSave={handleSavePlantilla}
            />
          )}

          {/* Guía Explicativa Inferior */}
          <div className="p-4 bg-surface-container-low border border-outline-variant rounded-lg space-y-2 text-xs">
            <div className="flex items-center gap-2 font-bold text-primary text-sm">
              <HelpCircle className="w-4 h-4 text-secondary-fixed-variant" />
              <span>¿Cómo se aplican estos cambios en los expedientes?</span>
            </div>
            <p className="text-on-surface-variant leading-relaxed">
              Toda modificación en el <strong>orden de páginas</strong>, <strong>firmantes oficiales</strong> (Elaborado, Revisado, Aprobado, Vía Gerencia) o <strong>cláusulas</strong> se almacena de forma centralizada en el sistema. Al ingresar a un expediente o descargar el documento en Word (.docx), el archivo se generará respetando exactamente la maquetación y reglas configuradas aquí.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
