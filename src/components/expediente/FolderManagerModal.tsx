"use client";

import React, { useState } from "react";
import {
  FolderPlus,
  ArrowUp,
  ArrowDown,
  Trash2,
  Edit2,
  Check,
  X,
  Sparkles,
  Layers,
  CheckCircle2,
  RefreshCw,
  HelpCircle,
  Link2,
} from "lucide-react";
import { Carpeta, Adquisicion } from "@/types";
import { DataStore } from "@/lib/store/dataStore";
import { Modal } from "@/components/ui/Modal";
import { displayFolderNumber } from "@/lib/store/folderOrder";

interface FolderManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  adquisicion: Adquisicion;
  carpetas: Carpeta[];
  onCarpetasUpdated: (updated: Carpeta[]) => void;
}

export const FolderManagerModal: React.FC<FolderManagerModalProps> = ({
  isOpen,
  onClose,
  adquisicion,
  carpetas,
  onCarpetasUpdated,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // Estado para crear nueva carpeta
  const [isAdding, setIsAdding] = useState(false);
  const [creationMode, setCreationMode] = useState<"manual" | "ai">("ai");
  const [newNombre, setNewNombre] = useState("");
  const [newDesc, setNewDesc] = useState("");

  // Estado para Asistente IA
  const [aiPrompt, setAiPrompt] = useState("");
  const [isAnalyzingAi, setIsAnalyzingAi] = useState(false);

  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Estado de guía expandida
  const [expandedGuideId, setExpandedGuideId] = useState<string | null>(null);

  // Guías predefinidas para carpetas 1 a 8
  const defaultGuides: Record<number, { queHace: string; deQuienDepende: string; pasos: string[] }> = {
    1: {
      queHace: "Especificaciones Técnicas oficiales de los bienes y herramientas a adquirir.",
      deQuienDepende: "Insumo inicial o nota técnica de requerimiento cargada por el solicitante.",
      pasos: ["1. Cargar requerimiento", "2. Generar con IA", "3. Descargar Word Oficial (.docx)"],
    },
    2: {
      queHace: "Solicitud de Inicio de proceso formal (Formulario S1-N014) y partida presupuestaria.",
      deQuienDepende: "Carpeta 1 (TDR / Especificaciones Técnicas).",
      pasos: ["1. Subir Formulario S1-N014", "2. Verificar partida", "3. Guardar en expediente"],
    },
    3: {
      queHace: "Cuadro comparativo de solicitudes y ofertas documentadas, con informe técnico editable.",
      deQuienDepende: "Carpeta 1 (TDR) y Carpeta 2 (S1-N014).",
      pasos: ["1. Añadir las cotizaciones", "2. Revisar los datos de los proveedores", "3. Guardar el cuadro comparativo"],
    },
    4: {
      queHace: "Prepara la solicitud de cotización que se remitirá a los proveedores.",
      deQuienDepende: "Carpeta 1 (TDR con lista de ítems a cotizar).",
      pasos: ["1. Revisar los ítems del TDR", "2. Completar destinatario y condiciones", "3. Guardar o descargar la solicitud"],
    },
    5: {
      queHace: "Contiene la Solicitud de Inicio y el Informe Técnico de Justificación.",
      deQuienDepende: "Carpeta 1 (TDR), Carpeta 2 (Solicitud de adquisición) y antecedentes de la compra.",
      pasos: ["1. Presionar Generar con IA", "2. Revisar borrador", "3. Descargar documento"],
    },
    6: {
      queHace: "Informe técnico de evaluación de ofertas y cuadro comparativo.",
      deQuienDepende: "Carpeta 1 (TDR) y Carpeta 4 (Cotizaciones y comparación revisada).",
      pasos: ["1. Revisar cotizaciones", "2. Preparar informe de evaluación", "3. Editar y guardar Word"],
    },
    7: {
      queHace: "Informe Técnico de Conformidad y Recepción Definitiva (Formulario A6-N014).",
      deQuienDepende: "Carpeta 1 (TDR), Carpeta 4 (Cotizaciones) y Carpeta 6 (Evaluación).",
      pasos: ["1. Generar con IA", "2. Certificar 100% de cumplimiento", "3. Descargar acta"],
    },
    8: {
      queHace: "Memorándum de Solicitud de Pago y Desembolso contable con documentos de respaldo.",
      deQuienDepende: "Carpeta 7 (Informe de Conformidad) y Carpeta 6 (Evaluación).",
      pasos: ["1. Generar con IA", "2. Verificar adjuntos", "3. Remitir a Finanzas"],
    },
  };

  const handleCreateWithAi = async () => {
    if (!aiPrompt.trim()) return;
    setIsAnalyzingAi(true);
    try {
      const res = await fetch("/api/ai/folder-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          peticion_usuario: aiPrompt.trim(),
          adquisicion,
          carpetas_existentes: carpetas,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error en el asistente");

      const { nombre_carpeta, descripcion_clara } = json.data || {};
      const folderName = nombre_carpeta || aiPrompt.trim();
      const folderDesc = descripcion_clara || `Fase sugerida por la IA para: ${aiPrompt.trim()}`;

      DataStore.addCarpeta(adquisicion.id, folderName, folderDesc);
      const updated = DataStore.getCarpetasByAdquisicion(adquisicion.id);
      onCarpetasUpdated(updated);

      setSuccessMsg(`✨ ¡Carpeta "${folderName}" creada y configurada exitosamente por el Asistente IA!`);
      setAiPrompt("");
      setIsAdding(false);
      setTimeout(() => setSuccessMsg(null), 6000);
    } catch (e: any) {
      alert("Error del asistente: " + e.message);
    } finally {
      setIsAnalyzingAi(false);
    }
  };

  const handleMoveUp = (folder: Carpeta) => {
    const updated = DataStore.moveCarpetaUp(adquisicion.id, folder.id);
    onCarpetasUpdated(updated);
  };

  const handleMoveDown = (folder: Carpeta) => {
    const updated = DataStore.moveCarpetaDown(adquisicion.id, folder.id);
    onCarpetasUpdated(updated);
  };

  const handleStartEdit = (folder: Carpeta) => {
    setEditingId(folder.id);
    setEditNombre(folder.nombre);
    setEditDesc(folder.descripcion || "");
  };

  const handleSaveEdit = (folderId: string) => {
    if (!editNombre.trim()) return;
    DataStore.updateCarpeta(folderId, {
      nombre: editNombre.trim(),
      descripcion: editDesc.trim(),
    });
    const updated = DataStore.getCarpetasByAdquisicion(adquisicion.id);
    onCarpetasUpdated(updated);
    setEditingId(null);
  };

  const handleDelete = (folder: Carpeta) => {
    if (folder.numero <= 8) { alert("Las ocho carpetas oficiales forman parte del expediente y no se eliminan. Puedes cambiar su nombre y orden."); return; }
    if (confirm(`¿Estás seguro de eliminar la carpeta "${displayFolderNumber(folder.numero)}. ${folder.nombre}"?`)) {
      DataStore.deleteCarpeta(folder.id);
      const updated = DataStore.getCarpetasByAdquisicion(adquisicion.id);
      onCarpetasUpdated(updated);
    }
  };

  const handleAddFolder = () => {
    if (!newNombre.trim()) return;
    DataStore.addCarpeta(adquisicion.id, newNombre.trim(), newDesc.trim());
    const updated = DataStore.getCarpetasByAdquisicion(adquisicion.id);
    onCarpetasUpdated(updated);
    setNewNombre("");
    setNewDesc("");
    setIsAdding(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Gestión de Carpetas del Expediente" maxWidth="4xl">
      <div className="space-y-6">
        {/* Banner Explicativo */}
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 text-primary rounded-lg">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-on-surface">Estructura Dinámica de Carpetas</h4>
              <p className="text-xs text-on-surface-variant">
                Puedes crear carpetas y cambiar su nombre u orden.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-on-primary text-xs font-bold rounded-lg shadow-sm hover:opacity-90 transition-all shrink-0"
          >
            <FolderPlus className="w-4 h-4" />
            <span>Nueva Carpeta</span>
          </button>
        </div>

        {/* Formulario para Crear Nueva Carpeta */}
        {isAdding && (
          <div className="p-4 bg-surface-container-low border border-primary/30 rounded-xl space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between">
              <h5 className="text-xs font-bold text-primary flex items-center gap-2">
                <FolderPlus className="w-4 h-4" />
                Crear Nueva Carpeta para este Expediente
              </h5>

              {/* Selector de Modo */}
              <div className="flex bg-surface-container p-0.5 rounded-lg border border-outline-variant text-[11px]">
                <button
                  type="button"
                  onClick={() => setCreationMode("ai")}
                  className={`px-3 py-1 rounded-md font-bold transition-all flex items-center gap-1.5 ${
                    creationMode === "ai"
                      ? "bg-primary text-on-primary shadow-sm"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  <Sparkles className="w-3 h-3" />
                  <span>🪄 Asistente Inteligente (Fácil)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCreationMode("manual")}
                  className={`px-3 py-1 rounded-md font-bold transition-all flex items-center gap-1.5 ${
                    creationMode === "manual"
                      ? "bg-primary text-on-primary shadow-sm"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  <Edit2 className="w-3 h-3" />
                  <span>Modo Manual</span>
                </button>
              </div>
            </div>

            {/* MODO ASISTENTE INTELIGENTE */}
            {creationMode === "ai" ? (
              <div className="space-y-3 bg-surface p-3.5 rounded-lg border border-primary/20">
                <div>
                  <label className="block text-[11px] font-bold text-on-surface mb-1">
                    ¿Qué documento o fase necesitas crear? (Escribe con tus propias palabras)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Ej. Necesito una orden de compra para entregar al proveedor ganador, o un acta de apertura de ofertas..."
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    className="w-full text-xs p-2.5 bg-surface-container border border-outline-variant rounded-md focus:border-primary focus:outline-none"
                  />
                </div>

                {/* Sugerencias Rápidas */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                    Sugerencias frecuentes de ENDE DEORURO:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      "Acta de Apertura de Sobres",
                      "Orden de Compra / Servicio",
                      "Carta de Notificación de Adjudicación",
                      "Póliza de Garantía de Cumplimiento",
                      "Acta de Recepción Provisional",
                    ].map((sug, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setAiPrompt(sug)}
                        className="px-2 py-1 bg-surface-container hover:bg-primary/10 hover:border-primary border border-outline-variant text-[10.5px] rounded-md text-on-surface-variant transition-colors"
                      >
                        + {sug}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/40">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="px-3 py-1.5 text-xs text-on-surface-variant hover:bg-surface-container rounded-md"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={isAnalyzingAi || !aiPrompt.trim()}
                    onClick={handleCreateWithAi}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-xs bg-primary text-on-primary font-bold rounded-md shadow-sm hover:opacity-90 transition-all disabled:opacity-50"
                  >
                    {isAnalyzingAi ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Analizando y Creando Carpeta...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Crear con Asistente IA</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              /* MODO MANUAL */
              <div className="space-y-3 bg-surface p-3.5 rounded-lg border border-outline-variant">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-on-surface mb-1">Nombre de la Carpeta *</label>
                    <input
                      type="text"
                      placeholder="Ej. Acta de Apertura de Sobres"
                      value={newNombre}
                      onChange={(e) => setNewNombre(e.target.value)}
                      className="w-full text-xs p-2 bg-surface-container border border-outline-variant rounded-md focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-on-surface mb-1">Descripción / Propósito</label>
                    <input
                      type="text"
                      placeholder="Ej. Documento de verificación de ofertas recibidas"
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      className="w-full text-xs p-2 bg-surface-container border border-outline-variant rounded-md focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/40">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="px-3 py-1.5 text-xs text-on-surface-variant hover:bg-surface-container rounded-md"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleAddFolder}
                    disabled={!newNombre.trim()}
                    className="px-4 py-1.5 text-xs bg-primary text-on-primary font-bold rounded-md disabled:opacity-50"
                  >
                    Guardar Carpeta
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-lg text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Lista Reordenable de Carpetas */}
        <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
          {carpetas.map((folder, index) => {
              const isEditing = editingId === folder.id;
              const isFirst = index === 0;
              const isLast = index === carpetas.length - 1;
              const isGuideOpen = expandedGuideId === folder.id;

              return (
                <div
                  key={folder.id}
                  className="p-3.5 bg-surface border border-outline-variant hover:border-primary/50 rounded-xl space-y-2.5 transition-all shadow-sm"
                >
                  {/* Fila Principal de la Carpeta */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    {/* Número y Controles de Orden (Subir/Bajar) */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-8 h-8 rounded-lg bg-surface-container-high border border-outline-variant flex items-center justify-center font-bold text-xs text-primary font-mono">
                        {displayFolderNumber(folder.numero)}
                      </div>

                      <div className="flex flex-col gap-0.5">
                        <button
                          type="button"
                          disabled={isFirst}
                          onClick={() => handleMoveUp(folder)}
                          title="Subir posición"
                          className="p-1 hover:bg-surface-container rounded text-on-surface-variant hover:text-primary disabled:opacity-20"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={isLast}
                          onClick={() => handleMoveDown(folder)}
                          title="Bajar posición"
                          className="p-1 hover:bg-surface-container rounded text-on-surface-variant hover:text-primary disabled:opacity-20"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Nombre y Descripción */}
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={editNombre}
                            onChange={(e) => setEditNombre(e.target.value)}
                            className="w-full text-xs font-bold p-1.5 bg-surface-container border border-primary rounded"
                          />
                          <input
                            type="text"
                            value={editDesc}
                            onChange={(e) => setEditDesc(e.target.value)}
                            className="w-full text-[11px] p-1.5 bg-surface-container border border-outline-variant rounded"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(folder.id)}
                              className="px-2 py-1 bg-primary text-on-primary text-[11px] font-bold rounded flex items-center gap-1"
                            >
                              <Check className="w-3 h-3" /> Guardar
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="px-2 py-1 text-on-surface-variant text-[11px] hover:bg-surface-container rounded flex items-center gap-1"
                            >
                              <X className="w-3 h-3" /> Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-on-surface">{folder.nombre}</span>
                            <span className="px-2 py-0.5 text-[10px] font-mono bg-surface-container text-on-surface-variant rounded">
                              {folder.documentos?.length || 0} docs
                            </span>
                          </div>
                          <p className="text-[11px] text-on-surface-variant truncate mt-0.5">
                            {folder.descripcion || "Sin descripción"}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Acciones de la carpeta */}
                    <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-between sm:justify-end">
                      {/* Botón Ver Guía */}
                      <button
                        type="button"
                        onClick={() => setExpandedGuideId(isGuideOpen ? null : folder.id)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border transition-all ${
                          isGuideOpen
                            ? "bg-primary text-on-primary border-primary shadow-sm"
                            : "bg-surface-container border-outline-variant hover:border-primary text-on-surface-variant hover:text-on-surface"
                        }`}
                        title="Ver propósito, dependencias y pasos de esta carpeta"
                      >
                        <span>💡 Guía</span>
                      </button>

                      {/* Editar */}
                      {!isEditing && (
                        <button
                          type="button"
                          onClick={() => handleStartEdit(folder)}
                          title="Editar nombre y descripción"
                          className="p-1.5 hover:bg-surface-container text-on-surface-variant hover:text-primary rounded-lg"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Eliminar (si hay más de 1 carpeta) */}
                      {carpetas.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDelete(folder)}
                          title="Eliminar carpeta"
                          className="p-1.5 hover:bg-red-50 text-on-surface-variant hover:text-red-600 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Panel de Guía Paso a Paso y Dependencias (Expandible) */}
                  {isGuideOpen && (
                    <div className="pt-2 border-t border-outline-variant/60 space-y-2 animate-fadeIn text-xs">
                      {(() => {
                        const guide = defaultGuides[folder.numero] || {
                          queHace: folder.descripcion || "Documento oficial del expediente.",
                          deQuienDepende: "Documentos de respaldo de este expediente.",
                          pasos: [
                            "1. Abrir la carpeta",
                            "2. Adjuntar el documento correspondiente",
                            "3. Consultarlo desde la lista de archivos",
                          ],
                        };

                        return (
                          <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div className="p-2.5 bg-surface-container-low rounded-lg border border-outline-variant/40">
                                <span className="font-bold text-primary flex items-center gap-1 text-[11px] mb-1">
                                  <HelpCircle className="w-3.5 h-3.5" /> ¿Para qué sirve esta carpeta?
                                </span>
                                <p className="text-[11.5px] text-on-surface leading-relaxed">
                                  {guide.queHace}
                                </p>
                              </div>

                              <div className="p-2.5 bg-surface-container-low rounded-lg border border-outline-variant/40">
                                <span className="font-bold text-secondary flex items-center gap-1 text-[11px] mb-1">
                                  <Link2 className="w-3.5 h-3.5" /> ¿De qué información depende?
                                </span>
                                <p className="text-[11.5px] text-on-surface-variant leading-relaxed">
                                  {guide.deQuienDepende}
                                </p>
                              </div>
                            </div>

                            <div className="p-2.5 bg-surface-container-low rounded-lg border border-outline-variant/40">
                              <span className="font-bold text-on-surface flex items-center gap-1 text-[11px] mb-1.5">
                                🚶‍♂️ Pasos a seguir (1, 2, 3):
                              </span>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                {guide.pasos.map((p, idx) => (
                                  <div
                                    key={idx}
                                    className="p-1.5 bg-surface rounded text-[11px] text-on-surface border border-outline-variant/30"
                                  >
                                    {p}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-3 border-t border-outline-variant">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-bold rounded-lg transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </Modal>
  );
};
