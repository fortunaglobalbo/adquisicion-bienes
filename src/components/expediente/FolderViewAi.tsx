"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Download,
  FileText,
  Clock,
  RefreshCw,
} from "lucide-react";
import { Adquisicion, Carpeta, Documento } from "@/types";
import { TdrDocumentViewer } from "./TdrDocumentViewer";
import { SolicitudInicioViewer } from "./SolicitudInicioViewer";
import { FormS2Viewer } from "./FormS2Viewer";
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

  // Determinar tipo de documento a generar
  const getDocType = (): "TDR" | "SOLICITUD_INICIO" | "FORM_S2" => {
    if (carpeta.numero === 1) return "TDR";
    if (carpeta.numero === 5) return "SOLICITUD_INICIO";
    return "FORM_S2";
  };

  // Helper para descargar docx generado
  const handleDownloadDocx = async (doc?: Documento) => {
    try {
      setDownloadingDocId(doc?.id || "direct");
      const tipo = getDocType();

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
          adquisicion,
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
    onAdquisicionUpdated?.(updated);
  };

  return (
    <div className="flex flex-col h-full space-y-4 w-full">
      {/* For Carpeta 1: Full-Screen Direct Document Editor & Viewer (TDR) */}
      {carpeta.numero === 1 ? (
        <TdrDocumentViewer
          adquisicion={adquisicion}
          onDownloadDocx={() => handleDownloadDocx()}
          onAdquisicionUpdated={handleDocumentUpdate}
        />
      ) : carpeta.numero === 5 ? (
        /* For Carpeta 5: Full-Screen Direct Document Editor & Viewer (Solicitud de Inicio Oficial) */
        <SolicitudInicioViewer
          adquisicion={adquisicion}
          onDownloadDocx={() => handleDownloadDocx()}
          onAdquisicionUpdated={handleDocumentUpdate}
        />
      ) : carpeta.numero === 6 ? (
        /* For Carpeta 6: Full-Screen Direct Document Editor & Viewer (Formulario S2-N014 Oficial) */
        <FormS2Viewer
          adquisicion={adquisicion}
          onDownloadDocx={() => handleDownloadDocx()}
          onAdquisicionUpdated={handleDocumentUpdate}
        />
      ) : (
        /* For Other Folders */
        <div className="space-y-4 flex-1 flex flex-col">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-3 border-b border-outline-variant gap-3">
            <div>
              <h3 className="font-headline-md text-base md:text-lg font-bold text-on-surface flex items-center gap-2.5">
                <span className="p-1.5 bg-primary/10 text-primary rounded">
                  <Sparkles className="w-5 h-5 text-secondary-fixed-variant" />
                </span>
                <span>
                  {carpeta.numero}. {carpeta.nombre}
                </span>
              </h3>
              <p className="font-sans text-xs text-on-surface-variant mt-0.5">
                {carpeta.descripcion}
              </p>
            </div>

            <button
              onClick={handleGenerateAi}
              disabled={isGenerating}
              className="flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded font-sans text-xs font-bold hover:bg-primary-container transition-colors shadow-institutional disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-secondary-container" />
                  <span>Generando con OpenCode Go...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-secondary-container fill-secondary-container" />
                  <span>Generar con IA (.docx)</span>
                </>
              )}
            </button>
          </div>

          {/* Context Banner */}
          <div className="p-3.5 bg-surface border border-outline-variant rounded text-xs">
            <p className="font-mono font-bold text-primary mb-1">
              Consolidación Automática para {carpeta.nombre}:
            </p>
            <p className="text-on-surface-variant">
              Genera el Formulario S2-N014 de invitación y cotización formal a proponentes con especificaciones técnicas del proceso.
            </p>
          </div>

          {/* Documents List */}
          <div className="flex-1">
            <h4 className="font-mono text-xs text-on-surface-variant uppercase tracking-wider mb-3 flex items-center justify-between">
              <span>Documentos Oficiales Generados (.docx)</span>
              <span className="bg-primary-container text-on-primary-container px-2 py-0.5 rounded-full font-mono text-[10px]">
                {carpeta.documentos.length} Archivos
              </span>
            </h4>

            {carpeta.documentos.length === 0 ? (
              <div className="p-8 border-2 border-dashed border-outline-variant rounded-lg text-center flex flex-col items-center justify-center bg-surface-container-low/50">
                <Sparkles className="w-8 h-8 text-outline mb-2 opacity-50" />
                <p className="font-sans text-xs text-on-surface-variant font-medium">
                  Aún no se ha generado el documento para esta carpeta.
                </p>
                <button
                  onClick={handleGenerateAi}
                  className="mt-3 px-4 py-1.5 bg-primary text-on-primary rounded font-bold text-xs"
                >
                  Generar Ahora con IA
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {carpeta.documentos.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-start justify-between p-4 bg-surface-container-lowest border border-outline-variant border-l-4 border-l-primary rounded hover:shadow-institutional transition-all"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <FileText className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                      <div className="min-w-0">
                        <h5 className="font-bold text-sm text-on-surface truncate">
                          {doc.nombre_original}
                        </h5>
                        <p className="text-xs text-on-surface-variant line-clamp-2 mt-1">
                          {doc.contenido_texto}
                        </p>
                        <div className="flex items-center gap-3 mt-2 font-mono text-[11px] text-outline">
                          <span>{(doc.tamano / 1024).toFixed(1)} KB</span>
                          <span>{new Date(doc.fecha_creacion).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDownloadDocx(doc)}
                      className="p-2 border border-outline-variant rounded text-primary hover:bg-surface-container-high transition-colors ml-2"
                      title="Descargar archivo .docx"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
