"use client";

import React, { useState } from "react";
import {
  Upload,
  Sparkles,
  FileText,
  CheckCircle2,
  AlertCircle,
  Download,
  Layers,
  RefreshCw,
  Code2,
  Table,
  Check,
  Save,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { DataStore } from "@/lib/store/dataStore";
import { Adquisicion } from "@/types";
import { CuadernoNormativoEngine } from "@/lib/ai/cuadernoNormativoEngine";

interface TemplateTranspilerModalProps {
  isOpen: boolean;
  onClose: () => void;
  fkCarpetaDefault?: number;
  adquisicionActual?: Adquisicion;
  onTemplateSaved?: (plantillaId: string) => void;
}

export const TemplateTranspilerModal: React.FC<TemplateTranspilerModalProps> = ({
  isOpen,
  onClose,
  fkCarpetaDefault = 1,
  adquisicionActual,
  onTemplateSaved,
}) => {
  const [fkCarpeta, setFkCarpeta] = useState<number>(fkCarpetaDefault);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [nombrePlantilla, setNombrePlantilla] = useState<string>("");

  // Estados de Transpilación a Código
  const [isTranspiling, setIsTranspiling] = useState(false);
  const [transpileResult, setTranspileResult] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Estados de Llenado con Cuaderno Normativo
  const [isGeneratingDocx, setIsGeneratingDocx] = useState(false);
  const [generatedDocxUrl, setGeneratedDocxUrl] = useState<string | null>(null);

  const carpetasNombres: Record<number, string> = {
    1: "1. TDR (Términos de Referencia)",
    2: "2. Form S1-N014 (Solicitud de Adquisición)",
    3: "3. Cuadro de Justificación",
    4: "4. Solicitud de Cotización a Empresas",
    5: "5. Solicitud de Inicio de Proceso",
    6: "6. Form S2-N014 (Solicitud de Cotización)",
    7: "7. Informe de Conformidad",
    8: "8. Memo Solicitud de Pago",
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.name.endsWith(".docx")) {
        alert("Por favor selecciona un archivo con formato Word (.docx)");
        return;
      }
      setSelectedFile(file);
      setNombrePlantilla(file.name.replace(/\.docx$/i, ""));
      setTranspileResult(null);
      setErrorMessage(null);
      setSaveSuccessMsg(null);
    }
  };

  // 1. Ejecutar "Maquetar en Código"
  const handleTranspileToCode = async () => {
    if (!selectedFile) {
      alert("Por favor sube un archivo Word (.docx) primero");
      return;
    }

    setIsTranspiling(true);
    setErrorMessage(null);
    setSaveSuccessMsg(null);

    try {
      const fd = new FormData();
      fd.append("file", selectedFile);
      fd.append("fk_carpeta", String(fkCarpeta));
      fd.append("nombre", nombrePlantilla || selectedFile.name);

      const res = await fetch("/api/docx/transpile", {
        method: "POST",
        body: fd,
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Fallo en la transpilación a código");
      }

      setTranspileResult(json.data);
    } catch (err: any) {
      setErrorMessage(err.message || "Error al maquetar el documento en código");
    } finally {
      setIsTranspiling(false);
    }
  };

  // 2. Guardar Plantilla de Código como Activa en el Sistema
  const handleSaveAsDefaultTemplate = () => {
    if (!transpileResult?.plantilla) return;

    try {
      const tpl = transpileResult.plantilla;
      // Guardar en DataStore
      DataStore.updatePlantilla(tpl.id, tpl);
      // Guardar en LocalStorage para persistencia inmediata en el navegador
      if (typeof window !== "undefined") {
        localStorage.setItem(`ende_plantilla_custom_${tpl.id}`, JSON.stringify(tpl.datos_completos));
        localStorage.setItem(`ende_active_template_carpeta_${fkCarpeta}`, JSON.stringify(tpl));
      }

      setSaveSuccessMsg(
        `¡Plantilla maquetada en código y guardada como predeterminada para ${carpetasNombres[fkCarpeta]}!`
      );
      if (onTemplateSaved) onTemplateSaved(tpl.id);
    } catch (e: any) {
      setErrorMessage(`Error al guardar: ${e.message}`);
    }
  };

  // 3. Llenar con el Cuaderno Normativo de Adquisiciones ENDE
  const handleFillWithCuadernoNormativo = async () => {
    if (!selectedFile) return;

    setIsGeneratingDocx(true);
    setErrorMessage(null);
    setGeneratedDocxUrl(null);

    try {
      // Normalizar datos con el Cuaderno Normativo ENDE
      const normData = CuadernoNormativoEngine.normalizarRequerimiento(
        adquisicionActual?.titulo_proceso || "",
        adquisicionActual
      );

      // Preparar reemplazos y secciones para el inyector
      const payload = {
        replacements: {
          "Almacenes ENDE DEORURO S.A.": normData.lugar_entrega,
          "Máximo 120 días calendario": `Máximo ${normData.plazo_entrega_dias} días calendario`,
        },
        sections: {
          "ANTECEDENTES": normData.antecedentes_normativos,
          "JUSTIFICACIÓN / NECESIDAD": normData.justificacion_tecnica,
          "LUGAR DE ENTREGA": normData.lugar_entrega,
          "FORMA DE PAGO": normData.forma_pago,
        },
        tables: [
          {
            table_index: 0,
            mode: "direct_cells",
            cells: [
              [1, 0, normData.firmas_oficiales.elaborado_por],
              [1, 1, normData.firmas_oficiales.revisado_por],
              [1, 2, normData.firmas_oficiales.aprobado_por],
            ],
          },
        ],
      };

      const fd = new FormData();
      fd.append("file", selectedFile);
      fd.append("data_json", JSON.stringify(payload));

      const res = await fetch("/api/docx/smart-fill", {
        method: "POST",
        body: fd,
      });

      const resJson = await res.json();
      if (!resJson.success) {
        throw new Error(resJson.error || "Error al autollenar plantilla");
      }

      setGeneratedDocxUrl(resJson.download_url);
    } catch (err: any) {
      setErrorMessage(err.message || "Error al generar Word normado");
    } finally {
      setIsGeneratingDocx(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="🪄 Taller de Maquetación en Código y Plantillas Libres"
      maxWidth="3xl"
    >
      <div className="space-y-6 text-on-surface">
        {/* Selector de Carpeta */}
        <div className="bg-surface-container-low p-3.5 rounded-xl border border-outline-variant">
          <label className="text-xs font-mono font-bold text-outline uppercase tracking-wider block mb-1">
            Carpeta Institucional a la que Pertenece esta Plantilla:
          </label>
          <select
            value={fkCarpeta}
            onChange={(e) => {
              setFkCarpeta(Number(e.target.value));
              setTranspileResult(null);
            }}
            className="w-full text-xs p-2.5 rounded-lg border border-outline-variant bg-surface text-on-surface font-bold font-sans"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
              <option key={num} value={num}>
                {carpetasNombres[num]}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-on-surface-variant mt-1.5">
            Cualquiera de las 8 carpetas es libre. Al subir un Word aquí, se maquetará en código nativo para esa fase.
          </p>
        </div>

        {/* Zona de Subida del Archivo Word */}
        <div className="border-2 border-dashed border-outline-variant hover:border-primary/60 rounded-xl p-5 text-center bg-surface transition-all">
          <Upload className="w-8 h-8 text-primary mx-auto mb-2" />
          <div className="font-bold text-xs text-on-surface">
            {selectedFile ? selectedFile.name : "Arrastra o selecciona el archivo Word (.docx)"}
          </div>
          <p className="text-[11px] text-on-surface-variant mt-1">
            Sube el formato de Word original de tu institución (con encabezados, logos y tablas).
          </p>
          <label className="inline-block mt-3 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs rounded-lg cursor-pointer transition-all">
            Seleccionar archivo .docx
            <input type="file" accept=".docx" onChange={handleFileChange} className="hidden" />
          </label>
        </div>

        {/* Botón Principal: Maquetar en Código */}
        {selectedFile && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-surface-container-lowest rounded-xl border border-outline-variant">
            <div className="text-xs space-y-0.5">
              <span className="font-bold text-on-surface block">Nombre de la Plantilla:</span>
              <input
                type="text"
                value={nombrePlantilla}
                onChange={(e) => setNombrePlantilla(e.target.value)}
                className="p-1.5 rounded border border-outline-variant text-xs w-64 bg-surface"
              />
            </div>

            <button
              onClick={handleTranspileToCode}
              disabled={isTranspiling}
              className="px-5 py-2.5 bg-gradient-to-r from-primary to-primary-container text-white font-bold text-xs rounded-lg shadow-sm hover:opacity-90 flex items-center gap-2 disabled:opacity-50 active:scale-95 transition-all"
            >
              {isTranspiling ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Extrayendo estructura y maquetando en código...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>🪄 Maquetar en Código (Transpilar DOCX)</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Resultado de la Maquetación en Código */}
        {transpileResult && (
          <div className="space-y-3 bg-emerald-50/60 border border-emerald-300 rounded-xl p-4 text-xs">
            <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
              <div className="flex items-center gap-2 font-bold text-emerald-900 text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>¡Plantilla Maquetada en Código con Éxito!</span>
              </div>
              <span className="bg-emerald-200/80 text-emerald-900 text-[10px] font-mono px-2 py-0.5 rounded font-bold">
                AST Compilado
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center pt-1 font-mono text-[11px]">
              <div className="p-2 bg-white/70 rounded border border-emerald-200">
                <span className="block text-gray-500">Párrafos:</span>
                <strong className="text-gray-900 text-sm">{transpileResult.totalParrafos}</strong>
              </div>
              <div className="p-2 bg-white/70 rounded border border-emerald-200">
                <span className="block text-gray-500">Tablas:</span>
                <strong className="text-gray-900 text-sm">{transpileResult.totalTablas}</strong>
              </div>
              <div className="p-2 bg-white/70 rounded border border-emerald-200">
                <span className="block text-gray-500">Secciones:</span>
                <strong className="text-gray-900 text-sm">{transpileResult.seccionesDetectadas?.length || 0}</strong>
              </div>
            </div>

            {transpileResult.seccionesDetectadas?.length > 0 && (
              <div className="pt-2">
                <span className="font-bold text-emerald-950 block mb-1">Secciones extraídas en código:</span>
                <div className="flex flex-wrap gap-1.5">
                  {transpileResult.seccionesDetectadas.map((sec: string, idx: number) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 bg-white border border-emerald-300 text-emerald-800 rounded text-[10px] font-mono"
                    >
                      {sec}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Acciones con la Plantilla Maquetada */}
            <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-emerald-200">
              <button
                onClick={handleSaveAsDefaultTemplate}
                className="flex-1 py-2 px-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-lg shadow-sm flex items-center justify-center gap-1.5 transition-all"
              >
                <Save className="w-4 h-4" />
                <span>Establecer como Plantilla Predeterminada de esta Carpeta</span>
              </button>

              <button
                onClick={handleFillWithCuadernoNormativo}
                disabled={isGeneratingDocx}
                className="flex-1 py-2 px-3 bg-primary hover:bg-primary/90 text-white font-bold text-xs rounded-lg shadow-sm flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
              >
                {isGeneratingDocx ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Code2 className="w-4 h-4 text-amber-300" />
                )}
                <span>Llenar con Cuaderno Normativo y Generar Word</span>
              </button>
            </div>
          </div>
        )}

        {/* Descarga Directa si se Generó */}
        {generatedDocxUrl && (
          <div className="p-3.5 bg-primary/10 border border-primary/30 rounded-xl flex items-center justify-between">
            <span className="text-xs font-bold text-primary flex items-center gap-2">
              <Check className="w-4 h-4" /> ¡Documento Word normado listo para descarga!
            </span>
            <a
              href={generatedDocxUrl}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="px-4 py-2 bg-primary text-white font-bold text-xs rounded-lg shadow hover:bg-primary/90 flex items-center gap-2"
            >
              <Download className="w-4 h-4" /> Descargar DOCX
            </a>
          </div>
        )}

        {/* Mensajes de Estado */}
        {saveSuccessMsg && (
          <div className="p-3 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-lg text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 bg-rose-50 text-rose-800 border border-rose-300 rounded-lg text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>
    </Modal>
  );
};
