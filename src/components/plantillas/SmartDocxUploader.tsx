"use client";

import React, { useState, useEffect } from "react";
import {
  Upload,
  FileText,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Download,
  Layers,
  ArrowRight,
  RefreshCw,
  Cpu,
  Eye,
  Server,
  Edit3,
} from "lucide-react";

interface SmartDocxUploaderProps {
  onSuccess?: (downloadUrl: string) => void;
}

export const SmartDocxUploader: React.FC<SmartDocxUploaderProps> = ({ onSuccess }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [useOfficialTemplate, setUseOfficialTemplate] = useState<string>("TDR_7Paginas_Oficial_ENDE_Deoruro.docx");
  const [isCustomUpload, setIsCustomUpload] = useState<boolean>(false);

  // Estados de AnythingLLM
  const [llmStatus, setLlmStatus] = useState<"checking" | "connected" | "error">("checking");
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>("adquisiciones-ende");
  const [isExtracting, setIsExtracting] = useState<boolean>(false);

  // Estados de Inspección y Datos de Reemplazo
  const [inspectData, setInspectData] = useState<any | null>(null);
  const [isInspecting, setIsInspecting] = useState<boolean>(false);

  // Datos de adquisición editables extraídos o manuales
  const [acquisitionData, setAcquisitionData] = useState<{
    objeto: string;
    antecedentes: string;
    justificacion: string;
    lugar_entrega: string;
    plazo_entrega: string;
    forma_pago: string;
    multas: string;
    items: Array<{
      item_nro: number;
      descripcion: string;
      unidad: string;
      cantidad: number;
      precio_unitario?: number;
      precio_total?: number;
    }>;
    elaborado_por: string;
    revisado_por: string;
    aprobado_por: string;
  }>({
    objeto: "ADQUISICIÓN DE HERRAMIENTAS Y EQUIPOS PARA MANTENIMIENTO REDES MT",
    antecedentes: "De acuerdo a la legislación vigente y normas internas se inicia el proceso para el mantenimiento de redes MT de ENDE DEORURO S.A.",
    justificacion: "La adquisición tiene el objetivo de prevenir accidentes y garantizar la continuidad del suministro de energía eléctrica.",
    lugar_entrega: "Almacenes Centrales ENDE DEORURO S.A. (Calle Junín Nº 450)",
    plazo_entrega: "Máximo 45 días calendario computables a partir de la orden de proceder.",
    forma_pago: "Contra entrega satisfactoria, conformidad técnica y presentación de factura.",
    multas: "0.25% por día de retraso conforme al reglamento institucional SBC.",
    items: [
      { item_nro: 1, descripcion: "Tijera Corta Cable de Acero 36 pulgadas", unidad: "PZA", cantidad: 4, precio_unitario: 450, precio_total: 1800 },
      { item_nro: 2, descripcion: "Tijera Corta Cable ACSR multi-hebra", unidad: "PZA", cantidad: 1, precio_unitario: 890, precio_total: 890 }
    ],
    elaborado_por: "Ing. Responsable de Adquisición",
    revisado_por: "Ing. Jefatura de Mantenimiento",
    aprobado_por: "Lic. Raul Alberto Torrico Gomez (Gerente General)"
  });

  // Estados de Generación
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedDocUrl, setGeneratedDocUrl] = useState<string | null>(null);
  const [stats, setStats] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Verificar conexión con AnythingLLM
  useEffect(() => {
    checkAnythingLlm();
  }, []);

  const checkAnythingLlm = async () => {
    setLlmStatus("checking");
    try {
      const res = await fetch("/api/anythingllm");
      const data = await res.json();
      if (data.success && data.authenticated) {
        setLlmStatus("connected");
        setWorkspaces(data.workspaces || []);
        if (data.workspaces?.length > 0) {
          const found = data.workspaces.find((w: any) => w.slug === "adquisiciones-ende");
          if (found) setSelectedWorkspace(found.slug);
        }
      } else {
        setLlmStatus("error");
      }
    } catch {
      setLlmStatus("error");
    }
  };

  // Extraer datos desde AnythingLLM
  const handleExtractFromAnything = async () => {
    setIsExtracting(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/anythingllm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "extract_acquisition",
          workspaceSlug: selectedWorkspace,
        }),
      });

      const result = await res.json();
      if (!result.success) {
        throw new Error(result.error || "No se pudieron extraer datos de AnythingLLM");
      }

      const d = result.data;
      setAcquisitionData((prev) => ({
        ...prev,
        objeto: d.objeto_contratacion || prev.objeto,
        antecedentes: d.antecedentes || prev.antecedentes,
        justificacion: d.justificacion || prev.justificacion,
        lugar_entrega: d.lugar_entrega || prev.lugar_entrega,
        plazo_entrega: d.plazo_entrega || prev.plazo_entrega,
        forma_pago: d.forma_pago || prev.forma_pago,
        multas: d.multas || prev.multas,
        items: d.items?.length > 0 ? d.items : prev.items,
        elaborado_por: d.firmas?.elaborado_por || prev.elaborado_por,
        revisado_por: d.firmas?.revisado_por || prev.revisado_por,
        aprobado_por: d.firmas?.aprobado_por || prev.aprobado_por,
      }));
    } catch (err: any) {
      setErrorMessage(`Aviso: ${err.message}. Puedes continuar usando los datos del formulario.`);
    } finally {
      setIsExtracting(false);
    }
  };

  // Manejador de subida de archivo
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.name.endsWith(".docx")) {
        alert("Por favor sube un archivo con extensión .docx");
        return;
      }
      setSelectedFile(file);
      setIsCustomUpload(true);
      inspectFile(file);
    }
  };

  // Inspeccionar plantilla
  const inspectFile = async (file: File) => {
    setIsInspecting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/docx/inspect", { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) {
        setInspectData(data.data);
      }
    } catch (e) {
      console.error("Error al inspeccionar:", e);
    } finally {
      setIsInspecting(false);
    }
  };

  // Ejecutar el llenado inteligente
  const handleSmartFill = async () => {
    setIsGenerating(true);
    setErrorMessage(null);
    setGeneratedDocUrl(null);

    try {
      const fd = new FormData();

      if (isCustomUpload && selectedFile) {
        fd.append("file", selectedFile);
      } else {
        // Cargar la plantilla oficial desde /
        const response = await fetch(`/${useOfficialTemplate}`);
        if (!response.ok) {
          throw new Error(`No se pudo cargar la plantilla oficial: ${useOfficialTemplate}`);
        }
        const blob = await response.blob();
        fd.append("file", blob, useOfficialTemplate);
      }

      // Preparar el paquete JSON de autollenado inteligente
      const payload = {
        replacements: {
          "Almacenes ENDE DEORURO S.A.": acquisitionData.lugar_entrega,
          "Máximo 120 días calendario pudiendo ofertar plazos menores.": acquisitionData.plazo_entrega,
        },
        sections: {
          "ANTECEDENTES": acquisitionData.antecedentes,
          "JUSTIFICACIÓN / NECESIDAD": acquisitionData.justificacion,
          "LUGAR DE ENTREGA": acquisitionData.lugar_entrega,
          "TIEMPO DE ENTREGA": acquisitionData.plazo_entrega,
          "FORMA DE PAGO": acquisitionData.forma_pago,
          "APLICACIÓN DE MULTAS": acquisitionData.multas,
        },
        tables: [
          {
            table_index: 0,
            mode: "direct_cells",
            cells: [
              [1, 0, acquisitionData.elaborado_por],
              [1, 1, acquisitionData.revisado_por],
              [1, 2, acquisitionData.aprobado_por],
            ],
          },
        ],
      };

      fd.append("data_json", JSON.stringify(payload));

      const res = await fetch("/api/docx/smart-fill", {
        method: "POST",
        body: fd,
      });

      const resData = await res.json();
      if (!resData.success) {
        throw new Error(resData.error || "Error al generar el documento");
      }

      setGeneratedDocUrl(resData.download_url);
      setStats(resData.data?.stats);
      if (onSuccess) onSuccess(resData.download_url);
    } catch (err: any) {
      setErrorMessage(err.message || "Error al procesar el autollenado");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-surface border border-outline-variant rounded-xl p-6 shadow-sm space-y-6">
      {/* Encabezado del Módulo */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-outline-variant pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-primary/10 text-primary rounded-lg">
              <Sparkles className="w-5 h-5 text-primary" />
            </span>
            <h3 className="font-headline-md text-xl font-bold text-on-surface">
              Autollenado Inteligente de Plantillas Word (.docx)
            </h3>
          </div>
          <p className="text-xs text-on-surface-variant mt-1">
            Sube cualquier plantilla Word sin etiquetas (o usa la oficial de ENDE) y rellénala automáticamente con datos de AnythingLLM.
          </p>
        </div>

        {/* Estado de Conexión AnythingLLM */}
        <div className="flex items-center gap-2 text-xs bg-surface-container-low px-3.5 py-2 rounded-lg border border-outline-variant">
          <Server className="w-4 h-4 text-primary" />
          <span className="font-semibold text-on-surface">AnythingLLM (VPS):</span>
          {llmStatus === "checking" && (
            <span className="text-amber-500 font-mono flex items-center gap-1">
              <RefreshCw className="w-3 h-3 animate-spin" /> Verificando...
            </span>
          )}
          {llmStatus === "connected" && (
            <span className="text-emerald-700 font-mono font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> En Línea (:3005)
            </span>
          )}
          {llmStatus === "error" && (
            <span className="text-rose-600 font-mono flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> Sin conexión
            </span>
          )}
        </div>
      </div>

      {/* Grid: Selección de Plantilla + Conexión con AnythingLLM */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Columna 1: Plantilla Word a Usar */}
        <div className="space-y-4 bg-surface-container-lowest p-4 rounded-xl border border-outline-variant">
          <label className="text-xs font-mono font-bold text-outline uppercase tracking-wider block">
            1. Seleccionar o Subir Plantilla Word (.docx):
          </label>

          <div className="space-y-3">
            {/* Opción A: Usar plantilla oficial */}
            <div
              onClick={() => setIsCustomUpload(false)}
              className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                !isCustomUpload
                  ? "border-primary bg-primary/5 text-on-surface"
                  : "border-outline-variant bg-surface text-on-surface-variant"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Plantilla Oficial ENDE DEORURO (7 Páginas)
                </span>
                {!isCustomUpload && <CheckCircle2 className="w-4 h-4 text-primary" />}
              </div>
              <p className="text-[11px] text-on-surface-variant mt-1">
                TDR institucional con logos, fuentes, márgenes y tablas oficiales de ENDE.
              </p>
            </div>

            {/* Opción B: Subir plantilla propia */}
            <div
              className={`p-3 rounded-lg border-2 border-dashed transition-all ${
                isCustomUpload
                  ? "border-primary bg-primary/5"
                  : "border-outline-variant hover:border-primary/50"
              }`}
            >
              <label className="cursor-pointer block text-center">
                <Upload className="w-6 h-6 text-primary mx-auto mb-1" />
                <span className="text-xs font-bold text-primary block">
                  {selectedFile ? selectedFile.name : "Subir plantilla personalizada (.docx)"}
                </span>
                <span className="text-[10px] text-on-surface-variant block mt-0.5">
                  No requiere etiquetas predefinidas. La IA detectará los campos automáticamente.
                </span>
                <input
                  type="file"
                  accept=".docx"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>

            {isInspecting && (
              <div className="text-xs text-primary flex items-center gap-1.5 animate-pulse">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Analizando estructura de párrafos y tablas...</span>
              </div>
            )}

            {inspectData && (
              <div className="bg-surface p-2.5 rounded border border-outline-variant text-[11px] text-on-surface-variant space-y-1">
                <div className="font-bold text-on-surface flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Estructura detectada:
                </div>
                <div>• Total párrafos: {inspectData.total_paragraphs}</div>
                <div>• Campos rellenables: {inspectData.fillable_paragraphs_count}</div>
                <div>• Tablas identificadas: {inspectData.tables?.length || 0}</div>
              </div>
            )}
          </div>
        </div>

        {/* Columna 2: Extracción con AnythingLLM */}
        <div className="space-y-4 bg-surface-container-lowest p-4 rounded-xl border border-outline-variant">
          <label className="text-xs font-mono font-bold text-outline uppercase tracking-wider block">
            2. Fuente de Datos (AnythingLLM RAG):
          </label>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-on-surface-variant block mb-1">
                Espacio de Trabajo (Workspace):
              </label>
              <select
                value={selectedWorkspace}
                onChange={(e) => setSelectedWorkspace(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-outline-variant bg-surface text-on-surface font-mono"
              >
                {workspaces.map((w) => (
                  <option key={w.slug} value={w.slug}>
                    {w.name} ({w.slug})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleExtractFromAnything}
              disabled={isExtracting || llmStatus !== "connected"}
              className="w-full py-2.5 px-4 rounded-lg bg-secondary text-on-secondary font-bold text-xs flex items-center justify-center gap-2 hover:bg-secondary/90 transition-all disabled:opacity-50"
            >
              {isExtracting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Consultando PDFs en AnythingLLM...
                </>
              ) : (
                <>
                  <Cpu className="w-4 h-4" />
                  Extraer Datos de los PDFs de Adquisición
                </>
              )}
            </button>

            <p className="text-[11px] text-on-surface-variant leading-relaxed">
              AnythingLLM leerá los documentos PDF subidos a tu espacio en el VPS y extraerá los ítems, precios, plazos y especificaciones técnicas.
            </p>
          </div>
        </div>
      </div>

      {/* Vista Previa y Edición de Datos Extraídos */}
      <div className="space-y-3 bg-surface-container-lowest p-4 rounded-xl border border-outline-variant">
        <div className="flex items-center justify-between border-b border-outline-variant pb-2">
          <h4 className="text-xs font-mono font-bold text-outline uppercase tracking-wider flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-primary" />
            3. Datos de Adquisición a Inyectar en el Documento:
          </h4>
          <span className="text-[11px] text-on-surface-variant">
            Puedes ajustar cualquier campo antes de generar el Word.
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="space-y-1">
            <label className="font-bold text-on-surface">Objeto de Contratación:</label>
            <input
              type="text"
              value={acquisitionData.objeto}
              onChange={(e) => setAcquisitionData({ ...acquisitionData, objeto: e.target.value })}
              className="w-full p-2 rounded border border-outline-variant bg-surface"
            />
          </div>

          <div className="space-y-1">
            <label className="font-bold text-on-surface">Lugar de Entrega:</label>
            <input
              type="text"
              value={acquisitionData.lugar_entrega}
              onChange={(e) => setAcquisitionData({ ...acquisitionData, lugar_entrega: e.target.value })}
              className="w-full p-2 rounded border border-outline-variant bg-surface"
            />
          </div>

          <div className="space-y-1">
            <label className="font-bold text-on-surface">Plazo de Entrega:</label>
            <input
              type="text"
              value={acquisitionData.plazo_entrega}
              onChange={(e) => setAcquisitionData({ ...acquisitionData, plazo_entrega: e.target.value })}
              className="w-full p-2 rounded border border-outline-variant bg-surface"
            />
          </div>

          <div className="space-y-1">
            <label className="font-bold text-on-surface">Forma de Pago:</label>
            <input
              type="text"
              value={acquisitionData.forma_pago}
              onChange={(e) => setAcquisitionData({ ...acquisitionData, forma_pago: e.target.value })}
              className="w-full p-2 rounded border border-outline-variant bg-surface"
            />
          </div>

          <div className="col-span-1 md:col-span-2 space-y-1">
            <label className="font-bold text-on-surface">Justificación / Necesidad Operativa:</label>
            <textarea
              rows={2}
              value={acquisitionData.justificacion}
              onChange={(e) => setAcquisitionData({ ...acquisitionData, justificacion: e.target.value })}
              className="w-full p-2 rounded border border-outline-variant bg-surface"
            />
          </div>
        </div>

        {/* Firmantes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs border-t border-outline-variant">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-on-surface">Elaborado por:</label>
            <input
              type="text"
              value={acquisitionData.elaborado_por}
              onChange={(e) => setAcquisitionData({ ...acquisitionData, elaborado_por: e.target.value })}
              className="w-full p-1.5 rounded border border-outline-variant bg-surface"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-on-surface">Revisado por:</label>
            <input
              type="text"
              value={acquisitionData.revisado_por}
              onChange={(e) => setAcquisitionData({ ...acquisitionData, revisado_por: e.target.value })}
              className="w-full p-1.5 rounded border border-outline-variant bg-surface"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-on-surface">Aprobado por:</label>
            <input
              type="text"
              value={acquisitionData.aprobado_por}
              onChange={(e) => setAcquisitionData({ ...acquisitionData, aprobado_por: e.target.value })}
              className="w-full p-1.5 rounded border border-outline-variant bg-surface"
            />
          </div>
        </div>
      </div>

      {/* Botón de Acción Principal y Descarga */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
        <button
          onClick={handleSmartFill}
          disabled={isGenerating}
          className="w-full sm:w-auto px-6 py-3 rounded-lg bg-primary text-on-primary font-bold text-sm shadow-md hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isGenerating ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              Inyectando datos y maquetando Word...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5 text-amber-300" />
              Autollenar Plantilla y Generar Word (.docx)
            </>
          )}
        </button>

        {generatedDocUrl && (
          <a
            href={generatedDocUrl}
            target="_blank"
            rel="noopener noreferrer"
            download
            className="w-full sm:w-auto px-6 py-3 rounded-lg bg-emerald-700 text-white font-bold text-sm shadow-md hover:bg-emerald-800 transition-all flex items-center justify-center gap-2 animate-bounce"
          >
            <Download className="w-5 h-5" />
            Descargar Word Oficial Generado
          </a>
        )}
      </div>

      {/* Mensajes y Feedback */}
      {stats && (
        <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>
            ¡Documento generado exitosamente! Se actualizaron {stats.updated_sections} secciones, {stats.replaced_placeholders} marcadores y {stats.updated_tables} tablas.
          </span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-rose-50 text-rose-800 border border-rose-300 rounded-lg text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
};
