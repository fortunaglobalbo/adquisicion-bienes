"use client";

import React, { useState, useRef } from "react";
import {
  FolderPlus,
  ArrowUp,
  ArrowDown,
  Trash2,
  Edit2,
  FileText,
  Upload,
  Check,
  X,
  Sparkles,
  Layers,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { Carpeta, Adquisicion } from "@/types";
import { DataStore } from "@/lib/store/dataStore";
import { Modal } from "@/components/ui/Modal";

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

  // Estado para subir plantilla
  const [uploadingFolderId, setUploadingFolderId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [targetUploadCarpeta, setTargetUploadCarpeta] = useState<Carpeta | null>(null);

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
    if (confirm(`¿Estás seguro de eliminar la carpeta "${folder.numero}. ${folder.nombre}"?`)) {
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

  const triggerUploadTemplate = (folder: Carpeta) => {
    setTargetUploadCarpeta(folder);
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !targetUploadCarpeta) return;

    try {
      setUploadingFolderId(targetUploadCarpeta.id);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("fk_carpeta", String(targetUploadCarpeta.numero));
      formData.append("nombre_plantilla", file.name);

      const res = await fetch("http://85.31.230.163:8080/api/convertir-plantilla", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Error al convertir la plantilla en el VPS");

      const result = await res.json();

      DataStore.updateCarpeta(targetUploadCarpeta.id, {
        plantilla_asociada_nombre: file.name,
        plantilla_asociada_url: result.download_docx,
      });

      // Actualizar también en Plantillas de DataStore
      const plantillas = DataStore.getPlantillas();
      const existing = plantillas.find((p) => p.fk_carpeta === targetUploadCarpeta.numero);
      if (existing) {
        await DataStore.updatePlantilla(existing.id, {
          nombre_archivo: result.nombre_archivo,
          descripcion: `Plantilla personalizada convertida con pdf2docx (${file.name})`,
          tipo_doc: file.name.toLowerCase().endsWith(".pdf") ? "PDF_CONVERTIDO" : "DOCX",
        });
      }

      const updated = DataStore.getCarpetasByAdquisicion(adquisicion.id);
      onCarpetasUpdated(updated);
      setSuccessMsg(`Plantilla "${file.name}" convertida a Word y asignada a la Carpeta ${targetUploadCarpeta.numero}`);
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      alert("Error al procesar plantilla: " + err.message);
    } finally {
      setUploadingFolderId(null);
      setTargetUploadCarpeta(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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
                Puedes añadir nuevas carpetas, cambiar su orden (subir/bajar) y asignarles plantillas oficiales en PDF o Word.
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

        {/* Input Oculto para Subir Plantillas */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.docx,.doc"
          onChange={handleFileSelected}
        />

        {/* Lista Reordenable de Carpetas */}
        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {carpetas
            .sort((a, b) => a.numero - b.numero)
            .map((folder, index) => {
              const isEditing = editingId === folder.id;
              const isFirst = index === 0;
              const isLast = index === carpetas.length - 1;
              const isUploading = uploadingFolderId === folder.id;

              return (
                <div
                  key={folder.id}
                  className="p-3 bg-surface border border-outline-variant hover:border-primary/50 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all"
                >
                  {/* Número y Controles de Orden (Subir/Bajar) */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-8 h-8 rounded-lg bg-surface-container-high border border-outline-variant flex items-center justify-center font-bold text-xs text-primary">
                      {folder.numero}
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

                  {/* Nombre y Descripción de la Carpeta */}
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

                  {/* Plantilla Asignada y Botones de Acción */}
                  <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-between sm:justify-end">
                    {/* Botón Subir Plantilla */}
                    <button
                      type="button"
                      disabled={isUploading}
                      onClick={() => triggerUploadTemplate(folder)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border transition-all ${
                        folder.plantilla_asociada_nombre
                          ? "bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                          : "bg-surface-container border-outline-variant hover:border-primary text-on-surface"
                      }`}
                      title="Asignar plantilla oficial en PDF o Word"
                    >
                      {isUploading ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin text-primary" />
                          <span>Procesando...</span>
                        </>
                      ) : folder.plantilla_asociada_nombre ? (
                        <>
                          <FileText className="w-3 h-3 text-emerald-600" />
                          <span className="max-w-[110px] truncate">{folder.plantilla_asociada_nombre}</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-3 h-3 text-primary" />
                          <span>Subir Plantilla</span>
                        </>
                      )}
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
