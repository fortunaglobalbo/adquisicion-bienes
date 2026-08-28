"use client";

import React, { useState, useRef } from "react";
import {
  Sparkles,
  Download,
  FileText,
  RefreshCw,
  Upload,
  CheckCircle2,
  Link2,
} from "lucide-react";
import { Adquisicion, Carpeta, Documento } from "@/types";
import { TdrDocumentViewer } from "./TdrDocumentViewer";
import { SolicitudInicioViewer } from "./SolicitudInicioViewer";
import { FormS2Viewer } from "./FormS2Viewer";
import { InformeConformidadViewer } from "./InformeConformidadViewer";
import { MemoPagoViewer } from "./MemoPagoViewer";
import { DataStore } from "@/lib/store/dataStore";

interface FolderViewAiProps {
  adquisicion: Adquisicion;
  carpeta: Carpeta;
  todasCarpetas: Carpeta[];
  onDocumentGenerated: (doc: Documento) => void;
  onAdquisicionUpdated?: (updated: Adquisicion) => void;
}

export const FolderViewAi: React.FC<FolderViewAiProps> = ({
  adquisicion,
  carpeta,
  todasCarpetas,
  onDocumentGenerated,
  onAdquisicionUpdated,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [insumoExtra, setInsumoExtra] = useState("");
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);
  // Estado para subida manual de archivos (Carpetas 2, 3, 4)
  const [manualUploadName, setManualUploadName] = useState<string | null>(null);
  const [manualUploadSuccess, setManualUploadSuccess] = useState(false);
  const manualFileRef = useRef<HTMLInputElement | null>(null);

  // Determinar tipo de documento a generar
  const getDocType = (): "TDR" | "SOLICITUD_INICIO" | "FORM_S2" | "INFORME_CONFORMIDAD" | "MEMO_PAGO" => {
    if (carpeta.numero === 1) return "TDR";
    if (carpeta.numero === 5) return "SOLICITUD_INICIO";
    if (carpeta.numero === 6) return "FORM_S2";
    if (carpeta.numero === 7) return "INFORME_CONFORMIDAD";
    return "MEMO_PAGO";
  };

  // Helper para descargar docx generado
  const handleDownloadDocx = async (doc?: Documento, liveAdquisicion?: Adquisicion) => {
    try {
      setDownloadingDocId(doc?.id || "direct");
      const tipo = getDocType();
      const currentAdq = liveAdquisicion || adquisicion;

      // Obtener datos de plantilla activa
      let templateData: any = undefined;
      const list = DataStore.getPlantillas();
      const tpl = list.find((p) => p.fk_carpeta === carpeta.numero);
      if (tpl) {
        templateData = tpl.datos_completos || {};
        if (Object.keys(templateData).length === 0 && typeof window !== "undefined") {
          try {
            const b = localStorage.getItem(`ende_plantilla_custom_${tpl.id}`);
            if (b) templateData = JSON.parse(b);
          } catch {}
        }
      }

      const response = await fetch("/api/docx/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo,
          adquisicion: currentAdq,
          justificacionTexto: insumoExtra || undefined,
          templateData,
        }),
      });

      if (!response.ok) {
        throw new Error("Error en la descarga del archivo");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc?.nombre_original || `${tipo}_${adquisicion.codigo}_Oficial.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err: any) {
      alert("Error al descargar documento: " + err.message);
    } finally {
      setDownloadingDocId(null);
    }
  };

  const handleGenerateAi = async () => {
    setIsGenerating(true);
    try {
      const tipo = getDocType();
      let endpoint = "/api/ai/generate-tdr";
      let requestBody: any = { adquisicion, insumoTexto: insumoExtra };

      if (tipo === "SOLICITUD_INICIO") {
        endpoint = "/api/ai/generate-solicitud-inicio";
        const f1 = todasCarpetas.find((c) => c.numero === 1);
        const f2 = todasCarpetas.find((c) => c.numero === 2);
        const f3 = todasCarpetas.find((c) => c.numero === 3);
        const f4 = todasCarpetas.find((c) => c.numero === 4);

        requestBody = {
          adquisicion,
          contextoCarpetas: {
            tdrResumen: f1?.documentos[0]?.nombre_original || "TDR con especificaciones técnicas completas",
            s1Resumen: f2?.documentos[0]?.nombre_original || "Solicitud S1-N014 aprobada con partida 39500",
            justificacionResumen: f3?.documentos[0]?.nombre_original || "Cuadro de Justificación por reposición técnica",
            cotizacionesResumen: f4?.documentos[0]?.nombre_original || "Proformas con NIT verificado y cotización menor precio",
          },
        };
      } else if (tipo === "FORM_S2") {
        endpoint = "/api/ai/generate-s2";
        requestBody = { adquisicion };
      } else if (tipo === "INFORME_CONFORMIDAD") {
        endpoint = "/api/ai/generate-informe-conformidad";
        requestBody = { adquisicion };
      } else if (tipo === "MEMO_PAGO") {
        endpoint = "/api/ai/generate-memo-pago";
        requestBody = { adquisicion };
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al invocar IA");

      const newDoc: Documento = {
        id: `doc-${Date.now()}`,
        carpeta_id: carpeta.id,
        adquisicion_id: adquisicion.id,
        tipo: "GENERADO_DOCX",
        nombre_original: data.nombreArchivo || `${tipo}_${adquisicion.codigo}_v${carpeta.documentos.length + 1}.docx`,
        mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        tamano: data.tamanoEstimado || 48000,
        estado: "Borrador",
        version: carpeta.documentos.length + 1,
        creado_por: "Sistema IA (OpenCode Go)",
        fecha_creacion: new Date().toISOString(),
        contenido_texto: data.contenido,
        metadata: {
          idDoc: data.idDoc || `DOC-${tipo}-${Date.now()}`,
          generadoPorIA: true,
        },
      };

      onDocumentGenerated(newDoc);
    } catch (err: any) {
      alert("Error en la generación: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDocumentUpdate = (updated: Adquisicion) => {
    DataStore.updateAdquisicion(updated.id, updated);

    // Auto-crear o actualizar registro de Documento oficial en la Carpeta
    const tipo = getDocType();
    const docName =
      tipo === "TDR"
        ? `TDR_${updated.codigo || "PROCESO"}_Especificaciones_Oficial.docx`
        : tipo === "SOLICITUD_INICIO"
        ? `SOLICITUD_INICIO_${updated.codigo || "PROCESO"}_Oficial.docx`
        : tipo === "FORM_S2"
        ? `FORM_S2_N014_${updated.codigo || "PROCESO"}_Cotizacion_Oficial.docx`
        : tipo === "INFORME_CONFORMIDAD"
        ? `INFORME_CONFORMIDAD_A6_${updated.codigo || "PROCESO"}_Oficial.docx`
        : `MEMO_PAGO_${updated.codigo || "PROCESO"}_Oficial.docx`;

    const allCarpetas = DataStore.getAllCarpetas();
    const targetFolder = allCarpetas.find((c) => c.id === carpeta.id) || carpeta;

    if (!Array.isArray(targetFolder.documentos)) {
      targetFolder.documentos = [];
    }

    const existingDocIndex = targetFolder.documentos.findIndex(
      (d) => d.nombre_original?.includes(tipo) || d.tipo === "GENERADO_DOCX"
    );

    if (existingDocIndex >= 0) {
      const existing = targetFolder.documentos[existingDocIndex];
      existing.nombre_original = docName;
      existing.fecha_creacion = new Date().toISOString();
      existing.contenido_texto = `${tipo} oficial guardado con ${updated.items?.length || 0} ítems y especificaciones vigentes.`;
      existing.tamano = 48000 + (updated.items?.length || 0) * 1024;
      existing.version = (existing.version || 1) + 1;
      targetFolder.estado = "Completado";
      targetFolder.fecha_proceso = new Date().toISOString();
      DataStore.saveAllCarpetas(allCarpetas);
    } else {
      const newDoc: Documento = {
        id: `doc-${Date.now()}`,
        carpeta_id: carpeta.id,
        adquisicion_id: updated.id,
        tipo: "GENERADO_DOCX",
        nombre_original: docName,
        mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        tamano: 48000 + (updated.items?.length || 0) * 1024,
        estado: "Borrador",
        version: 1,
        creado_por: "Usuario Autenticado",
        fecha_creacion: new Date().toISOString(),
        contenido_texto: `${tipo} oficial guardado con ${updated.items?.length || 0} ítems y especificaciones vigentes.`,
        metadata: {
          generadoPorIA: true,
          itemsCount: updated.items?.length || 0,
        },
      };
      DataStore.addDocumentToCarpeta(carpeta.id, newDoc);
      onDocumentGenerated(newDoc);
    }

    onAdquisicionUpdated?.(updated);
  };

  return (
    <div className="flex flex-col h-full space-y-4 w-full">
      {/* For Carpeta 1: Full-Screen Direct Document Editor & Viewer (TDR) */}
      {carpeta.numero === 1 ? (
        <TdrDocumentViewer
          adquisicion={adquisicion}
          onDownloadDocx={(live?: Adquisicion) => handleDownloadDocx(undefined, live)}
          onAdquisicionUpdated={handleDocumentUpdate}
        />
      ) : carpeta.numero === 5 ? (
        /* For Carpeta 5: Full-Screen Direct Document Editor & Viewer (Solicitud de Inicio Oficial) */
        <SolicitudInicioViewer
          adquisicion={adquisicion}
          onDownloadDocx={(live?: Adquisicion) => handleDownloadDocx(undefined, live)}
          onAdquisicionUpdated={handleDocumentUpdate}
        />
      ) : carpeta.numero === 6 ? (
        /* For Carpeta 6: Full-Screen Direct Document Editor & Viewer (Formulario S2-N014 Oficial) */
        <FormS2Viewer
          adquisicion={adquisicion}
          onDownloadDocx={(live?: Adquisicion) => handleDownloadDocx(undefined, live)}
          onAdquisicionUpdated={handleDocumentUpdate}
        />
      ) : carpeta.numero === 7 ? (
        /* For Carpeta 7: Full-Screen Direct Document Editor & Viewer (Informe de Conformidad A6-N014) */
        <InformeConformidadViewer
          adquisicion={adquisicion}
          onDownloadDocx={(live?: Adquisicion) => handleDownloadDocx(undefined, live)}
          onAdquisicionUpdated={handleDocumentUpdate}
        />
      ) : carpeta.numero === 8 ? (
        /* For Carpeta 8: Full-Screen Direct Document Editor & Viewer (Memorándum de Solicitud de Pago) */
        <MemoPagoViewer
          adquisicion={adquisicion}
          onDownloadDocx={(live?: Adquisicion) => handleDownloadDocx(undefined, live)}
          onAdquisicionUpdated={handleDocumentUpdate}
        />
      ) : (
        /* Carpetas 2, 3, 4 — Subida Manual del Usuario */
        (() => {
          const isManualFolder = [2, 3, 4].includes(carpeta.numero);
          const carpetaDescriptions: Record<number, { from: string; icon: string; hint: string }> = {
            2: { from: "El usuario sube manualmente", icon: "📋", hint: "Formulario S1-N014, Solicitud de inicio de proceso, partida presupuestaria" },
            3: { from: "El usuario sube manualmente", icon: "📊", hint: "Cuadro de justificación, previsión de precio aprobada, informe técnico de necesidad" },
            4: { from: "El usuario sube manualmente", icon: "💼", hint: "Cotizaciones / proformas de proveedores con NIT, precios y especificaciones" },
          };
          const meta = carpetaDescriptions[carpeta.numero];

          const handleManualUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) return;

            const newDoc: Documento = {
              id: `doc-manual-${Date.now()}`,
              carpeta_id: carpeta.id,
              adquisicion_id: adquisicion.id,
              tipo: "SUBIDO_OTRO",
              nombre_original: file.name,
              mime: file.type || "application/octet-stream",
              tamano: file.size,
              estado: "Final",
              version: (carpeta.documentos?.length || 0) + 1,
              creado_por: "Usuario",
              fecha_creacion: new Date().toISOString(),
              contenido_texto: `Documento subido manualmente para la Carpeta ${carpeta.numero}: ${carpeta.nombre}`,
              metadata: { subidoManualmente: true },
            };

            // Guardar en DataStore
            DataStore.addDocumentToCarpeta(carpeta.id, newDoc);
            const allC = DataStore.getAllCarpetas();
            const target = allC.find((c) => c.id === carpeta.id);
            if (target) {
              target.estado = "Completado";
              target.fecha_proceso = new Date().toISOString();
              DataStore.saveAllCarpetas(allC);
            }

            onDocumentGenerated(newDoc);
            setManualUploadName(file.name);
            setManualUploadSuccess(true);
            setTimeout(() => setManualUploadSuccess(false), 4000);
          };

          return (
            <div className="space-y-5 flex-1 flex flex-col">
              {/* Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-3 border-b border-outline-variant gap-3">
                <div>
                  <h3 className="font-headline-md text-base md:text-lg font-bold text-on-surface flex items-center gap-2.5">
                    <span className="p-1.5 bg-primary/10 text-primary rounded text-xl">
                      {meta?.icon || "📁"}
                    </span>
                    <span>{carpeta.numero}. {carpeta.nombre}</span>
                  </h3>
                  <p className="font-sans text-xs text-on-surface-variant mt-0.5">{carpeta.descripcion}</p>
                </div>
                <span className="px-3 py-1 bg-surface-container border border-outline-variant text-on-surface-variant text-xs rounded-full font-mono font-bold">
                  Subida Manual
                </span>
              </div>

              {/* Info Banner */}
              <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-300 dark:border-blue-700 rounded-lg text-xs flex gap-3">
                <Link2 className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-blue-900 dark:text-blue-200">
                    Esta carpeta se completa con documentos subidos manualmente.
                  </p>
                  <p className="text-blue-700 dark:text-blue-300">
                    <strong>Documentos típicos:</strong> {meta?.hint}
                  </p>
                  {carpeta.numero === 4 && (
                    <p className="text-blue-700 dark:text-blue-300 font-semibold mt-1">
                      ⚡ Los documentos de esta carpeta (cotizaciones) serán usados por la IA para generar la Carpeta 7 (Informe de Conformidad).
                    </p>
                  )}
                </div>
              </div>

              {/* Drop Zone / Upload Area */}
              <div
                className="flex-1 border-2 border-dashed border-outline-variant hover:border-primary rounded-xl p-8 flex flex-col items-center justify-center gap-4 bg-surface-container-low/50 hover:bg-surface-container-low transition-colors cursor-pointer group"
                onClick={() => manualFileRef.current?.click()}
              >
                <input
                  ref={manualFileRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xlsx,.xls,.jpg,.jpeg,.png,.txt,.md"
                  onChange={handleManualUpload}
                />
                {manualUploadSuccess ? (
                  <>
                    <CheckCircle2 className="w-14 h-14 text-emerald-500" />
                    <div className="text-center">
                      <p className="font-bold text-emerald-700 dark:text-emerald-400 text-sm">
                        ¡Archivo subido correctamente!
                      </p>
                      <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-1 font-mono">
                        {manualUploadName}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <Upload className="w-14 h-14 text-outline group-hover:text-primary transition-colors" />
                    <div className="text-center space-y-1">
                      <p className="font-bold text-on-surface text-sm group-hover:text-primary transition-colors">
                        Haz clic aquí o arrastra tu documento
                      </p>
                      <p className="text-xs text-on-surface-variant">
                        PDF, Word (.docx), Excel, Imágenes, TXT — hasta 50 MB
                      </p>
                    </div>
                    <button
                      className="px-5 py-2 bg-primary text-on-primary rounded-lg font-bold text-sm shadow hover:bg-primary/90 transition-colors"
                      onClick={(e) => { e.stopPropagation(); manualFileRef.current?.click(); }}
                    >
                      Seleccionar Archivo
                    </button>
                  </>
                )}
              </div>

              {/* Uploaded Documents */}
              {carpeta.documentos.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-mono text-xs text-on-surface-variant uppercase tracking-wider flex items-center justify-between">
                    <span>Documentos Subidos</span>
                    <span className="bg-primary-container text-on-primary-container px-2 py-0.5 rounded-full font-mono text-[10px]">
                      {carpeta.documentos.length} archivos
                    </span>
                  </h4>
                  {carpeta.documentos.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 bg-surface-container-lowest border border-outline-variant rounded-lg hover:shadow-sm transition-all">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-on-surface truncate">{doc.nombre_original}</p>
                          <p className="text-[11px] text-on-surface-variant font-mono">
                            {(doc.tamano / 1024).toFixed(1)} KB · {new Date(doc.fecha_creacion).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-bold border border-emerald-300 ml-2 shrink-0">
                        Subido ✓
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()
      )}
    </div>
  );
};

