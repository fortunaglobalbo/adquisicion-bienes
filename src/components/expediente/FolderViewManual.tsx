"use client";

import React, { useState, useRef } from "react";
import {
  Upload,
  FileCheck,
  AlertTriangle,
  FileText,
  Clock,
  Trash2,
  ScanText,
  CheckCircle2,
  Info,
} from "lucide-react";
import { Adquisicion, Carpeta, Documento, CampoExtraido } from "@/types";
import { ExtractedFieldsViewer } from "./ExtractedFieldsViewer";

interface FolderViewManualProps {
  adquisicion: Adquisicion;
  carpeta: Carpeta;
  camposExtraidos: CampoExtraido[];
  onDocumentUploaded: (doc: Documento, campos: CampoExtraido[]) => void;
}

export const FolderViewManual: React.FC<FolderViewManualProps> = ({
  adquisicion,
  carpeta,
  camposExtraidos,
  onDocumentUploaded,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [alertaDiscordancia, setAlertaDiscordancia] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"documentos" | "ocr">("documentos");

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = async (file: File) => {
    setIsUploading(true);
    setAlertaDiscordancia(null);

    try {
      // 1. Invocar Endpoint OCR
      const ocrRes = await fetch("/api/ocr/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          carpetaNumero: carpeta.numero,
          adquisicionCodigo: adquisicion.codigo,
          adquisicionTitulo: adquisicion.titulo_proceso,
        }),
      });

      const ocrData = await ocrRes.json();
      const extractedCampos: CampoExtraido[] = ocrData.result?.campos || [];
      const warnings: string[] = ocrData.result?.advertencias || [];

      if (warnings.length > 0) {
        setAlertaDiscordancia(warnings.join("\n"));
      }

      // 2. Crear documento
      const newDoc: Documento = {
        id: `doc-${Date.now()}`,
        carpeta_id: carpeta.id,
        adquisicion_id: adquisicion.id,
        tipo: file.type.includes("pdf")
          ? "SUBIDO_PDF"
          : file.type.includes("image")
          ? "SUBIDO_IMAGEN"
          : "SUBIDO_OTRO",
        nombre_original: file.name,
        mime: file.type || "application/octet-stream",
        tamano: file.size,
        estado: "Final",
        version: carpeta.documentos.length + 1,
        creado_por: "Usuario Operador",
        fecha_creacion: new Date().toISOString(),
        metadata: {
          camposExtraidosCount: extractedCampos.length,
          advertencias: warnings,
        },
      };

      onDocumentUploaded(newDoc, extractedCampos);
      if (extractedCampos.length > 0) {
        setActiveTab("ocr");
      }
    } catch (err: any) {
      alert("Error procesando archivo: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 pb-4 border-b border-outline-variant gap-3">
        <div>
          <h3 className="font-headline-md text-lg font-bold text-on-surface flex items-center gap-2.5">
            <span className="p-1.5 bg-surface-container-high rounded text-primary">
              <FileCheck className="w-5 h-5" />
            </span>
            <span>
              {carpeta.numero}. {carpeta.nombre}
            </span>
          </h3>
          <p className="font-sans text-xs text-on-surface-variant mt-1">
            {carpeta.descripcion}
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="px-2 py-1 bg-surface-container border border-outline-variant rounded text-on-surface-variant">
            Carpeta de Sola Subida
          </span>
        </div>
      </div>

      {/* Alerta de discordancia (Regla de negocio 2) */}
      {alertaDiscordancia && (
        <div className="mb-5 p-4 bg-amber-50 border-l-4 border-amber-500 rounded text-xs text-amber-900 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold uppercase font-mono">Advertencia de Coincidencia de Proceso</p>
            <p className="mt-0.5 whitespace-pre-line">{alertaDiscordancia}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-outline-variant mb-5 font-mono text-xs">
        <button
          onClick={() => setActiveTab("documentos")}
          className={`px-4 py-2 font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "documentos"
              ? "border-primary text-primary"
              : "border-transparent text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Archivos Subidos ({carpeta.documentos.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("ocr")}
          className={`px-4 py-2 font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "ocr"
              ? "border-primary text-primary"
              : "border-transparent text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <ScanText className="w-4 h-4 text-secondary-fixed-variant" />
          <span>Campos Extraídos OCR ({camposExtraidos.length})</span>
        </button>
      </div>

      {activeTab === "documentos" ? (
        <div className="space-y-5 flex-1 flex flex-col">
          {/* Drag and Drop Zone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center ${
              dragActive
                ? "border-primary bg-primary-fixed/20"
                : "border-outline-variant bg-surface hover:bg-surface-container-low"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileInputChange}
              accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx"
              className="hidden"
            />
            <div className="p-3 bg-surface-container-high rounded-full mb-2 text-primary">
              <Upload className="w-6 h-6" />
            </div>
            <p className="font-mono text-xs font-bold text-primary">
              {isUploading ? "Procesando archivo y extrayendo OCR..." : "Arrastre el archivo aquí o haga clic para subir"}
            </p>
            <p className="text-[11px] text-on-surface-variant font-mono mt-1">
              Soporta PDF, Escaneos PNG/JPG y Documentos Oficiales (Máx 20MB)
            </p>
          </div>

          {/* List of uploaded files */}
          <div className="flex-1">
            <h4 className="font-mono text-xs text-on-surface-variant uppercase tracking-wider mb-3">
              Documentos en esta carpeta
            </h4>

            {carpeta.documentos.length === 0 ? (
              <div className="p-6 text-center text-xs font-mono text-outline border border-outline-variant rounded bg-surface-container-low/30">
                No hay documentos subidos en esta carpeta.
              </div>
            ) : (
              <div className="space-y-2">
                {carpeta.documentos.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 bg-surface-container-lowest border border-outline-variant rounded hover:shadow-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="font-sans text-xs font-bold text-on-surface truncate">
                          {doc.nombre_original}
                        </p>
                        <p className="font-mono text-[10px] text-on-surface-variant">
                          {(doc.tamano / 1024).toFixed(1)} KB • Subido el{" "}
                          {new Date(doc.fecha_creacion).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 font-mono text-[10px] bg-emerald-100 text-emerald-800 rounded border border-emerald-300">
                        Procesado OK
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <ExtractedFieldsViewer campos={camposExtraidos} />
      )}
    </div>
  );
};
