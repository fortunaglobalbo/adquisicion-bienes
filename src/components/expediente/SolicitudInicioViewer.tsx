"use client";

import React, { useState } from "react";
import { Adquisicion } from "@/types";
import {
  Download,
  Save,
  Maximize2,
  Minimize2,
  Settings,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  Layers,
  FileDown,
} from "lucide-react";
import { Modal } from "../ui/Modal";

import { getFechaTextoActual } from "@/lib/utils/dateUtils";

interface SolicitudInicioViewerProps {
  adquisicion: Adquisicion;
  onDownloadDocx: (liveData?: Adquisicion) => void;
  onDownloadPdf?: (liveData?: Adquisicion) => void;
  onAdquisicionUpdated?: (updated: Adquisicion) => void;
}

export const SolicitudInicioViewer: React.FC<SolicitudInicioViewerProps> = ({
  adquisicion,
  onDownloadDocx,
  onDownloadPdf,
  onAdquisicionUpdated,
}) => {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  // Editable Document State
  const [docData, setDocData] = useState<Adquisicion>({
    ...adquisicion,
    solicitud_inicio_fecha: adquisicion.solicitud_inicio_fecha || getFechaTextoActual(),
  });

  // Update field helper
  const handleTextChange = (field: keyof Adquisicion, value: any) => {
    setDocData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Direct 1-Click AI Generation
  const handleConsolidateAndGenerateWithAi = async () => {
    setIsAiProcessing(true);
    try {
      const payload: any = {
        adquisicion: docData,
        insumoTexto: `Redactar la Solicitud de Inicio formal del proceso de compra para "${docData.titulo_proceso}".`,
      };

      const res = await fetch("/api/ai/generate-solicitud-inicio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Error al procesar con IA");

      if (result.data) {
        const updated: Adquisicion = {
          ...docData,
          solicitud_inicio_numero: result.data.numero || docData.solicitud_inicio_numero || "047/2026",
          solicitud_inicio_fecha: result.data.fecha || docData.solicitud_inicio_fecha || "Oruro, 26 de mayo de 2026",
          solicitud_inicio_a_nombre: result.data.a_nombre || docData.solicitud_inicio_a_nombre || "Lic. Vicente Paul Vega Ramirez",
          solicitud_inicio_a_cargo: result.data.a_cargo || docData.solicitud_inicio_a_cargo || "RESPONSABLE DE CONTRATACIONES",
          solicitud_inicio_via_nombre: result.data.via_nombre || docData.solicitud_inicio_via_nombre || "Lic. Raúl Alberto Torrico Gomez",
          solicitud_inicio_via_cargo: result.data.via_cargo || docData.solicitud_inicio_via_cargo || "GERENTE GENERAL",
          solicitud_inicio_de_nombre: result.data.de_nombre || docData.solicitud_inicio_de_nombre || "Ing. Heydi Dunya Canaviri Padilla",
          solicitud_inicio_de_cargo: result.data.de_cargo || docData.solicitud_inicio_de_cargo || "SUPERVISOR DE SEGURIDAD INDUSTRIAL",
          solicitud_inicio_objeto: result.data.objeto || docData.solicitud_inicio_objeto || `SOLICITUD DE INICIO DEL PROCESO DE COMPRA "${docData.titulo_proceso.toUpperCase()}"`,
          solicitud_inicio_parrafo1: result.data.parrafo1 || docData.solicitud_inicio_parrafo1,
          solicitud_inicio_parrafo2: result.data.parrafo2 || docData.solicitud_inicio_parrafo2,
        };

        setDocData(updated);
        onAdquisicionUpdated?.(updated);
        setSavedFeedback(true);
        setTimeout(() => setSavedFeedback(false), 3000);
      }
    } catch (err: any) {
      alert("Error con la IA: " + err.message);
    } finally {
      setIsAiProcessing(false);
    }
  };

  // Save changes
  const handleSave = () => {
    onAdquisicionUpdated?.(docData);
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2500);
  };

  // Document Fields with exact defaults from the photo
  const numeroNota = docData.solicitud_inicio_numero || "047/2026";
  const fechaNota = docData.solicitud_inicio_fecha || "Oruro, 26 de mayo de 2026";
  const aNombre = docData.solicitud_inicio_a_nombre || "Lic. Vicente Paul Vega Ramirez";
  const aCargo = docData.solicitud_inicio_a_cargo || "RESPONSABLE DE CONTRATACIONES";
  const viaNombre = docData.solicitud_inicio_via_nombre || "Lic. Raúl Alberto Torrico Gomez";
  const viaCargo = docData.solicitud_inicio_via_cargo || "GERENTE GENERAL";
  const deNombre = docData.solicitud_inicio_de_nombre || "Ing. Heydi Dunya Canaviri Padilla";
  const deCargo = docData.solicitud_inicio_de_cargo || "SUPERVISOR DE SEGURIDAD INDUSTRIAL";
  const objetoNota =
    docData.solicitud_inicio_objeto ||
    `SOLICITUD DE INICIO DEL PROCESO DE COMPRA "${(docData.titulo_proceso || "ADQUISICIÓN DE HERRAMIENTA PARA CUADRILLAS").toUpperCase()}"`;

  const parrafo1 =
    docData.solicitud_inicio_parrafo1 ||
    `Por medio de la presente, me dirijo a su autoridad para solicitar formalmente el inicio del proceso de compra correspondiente al proceso "${(docData.titulo_proceso || "ADQUISICIÓN DE HERRAMIENTA PARA CUADRILLAS").toUpperCase()}".`;

  const parrafo2 =
    docData.solicitud_inicio_parrafo2 ||
    "Esta solicitud, se realiza en cumplimiento al Reglamento y Manual de Procedimiento de Adquisiciones de Bienes, construcciones de Obras y Contrataciones de Servicio, adjunto a la presente los documentos de respaldo necesarios para el inicio del proceso de contratación:";

  return (
    <div className={`flex flex-col space-y-4 ${isFullScreen ? "fixed inset-0 z-50 bg-surface p-4 overflow-y-auto" : "w-full"}`}>
      {/* Friendly Toolbar */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3 shadow-md sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Direct 1-Click AI Generation */}
          <button
            onClick={handleConsolidateAndGenerateWithAi}
            disabled={isAiProcessing}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white font-sans text-sm font-bold rounded shadow transition-all active:scale-95 disabled:opacity-50"
            title="Generar y redactar automáticamente la Solicitud de Inicio con IA"
          >
            {isAiProcessing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-yellow-100" />
                <span>Generando Solicitud con IA...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-yellow-100 fill-yellow-100" />
                <span>✨ Generar con IA</span>
              </>
            )}
          </button>

          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-sans text-sm font-bold rounded shadow transition-all active:scale-95"
            title="Guardar todos los cambios realizados en el documento"
          >
            <Save className="w-4 h-4 text-emerald-200" />
            <span>Guardar</span>
          </button>

          {savedFeedback && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1.5 rounded animate-bounce border border-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ¡Guardado Correctamente!
            </span>
          )}

          <button
            onClick={() => onDownloadDocx(docData)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary hover:bg-primary-container font-sans text-sm font-bold rounded shadow transition-all active:scale-95"
            title="Descargar la Solicitud de Inicio oficial en formato Microsoft Word (.docx) con texto en tamaño 12"
          >
            <Download className="w-4 h-4 text-secondary-container" />
            <span>Descargar Word (.docx)</span>
          </button>
        </div>

        {/* Right: Quick Options */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowConfigModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-surface-container-high hover:bg-surface-container-highest text-primary font-sans text-xs font-bold rounded border border-outline-variant transition-colors"
            title="Configurar Destinatarios y Fechas"
          >
            <Settings className="w-4 h-4 text-secondary-fixed-variant" />
            <span>Destinatarios & Fecha</span>
          </button>

          <button
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="p-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant rounded border border-outline-variant transition-colors"
            title={isFullScreen ? "Salir de pantalla completa" : "Ver en toda la pantalla"}
          >
            {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Clean Instructions banner for staff */}
      <div className="bg-amber-50 border-l-4 border-amber-500 p-2.5 rounded text-xs text-amber-950 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold uppercase font-mono text-amber-800">✍️ Edición Directa:</span>
          <span>Puedes hacer clic en cualquier texto para corregir número, fecha, nombres, cargos o párrafos directamente.</span>
        </div>
      </div>

      {/* Document Sheet Container (Matching Official Photo 100%) */}
      <div className="w-full flex flex-col items-center py-4 bg-surface-container/60 rounded-lg p-2 md:p-6 overflow-x-auto">
        <div className="w-full max-w-[850px] bg-white border border-outline-variant shadow-xl rounded-sm p-10 md:p-16 text-on-surface font-sans min-h-[1100px] flex flex-col justify-between relative">
          
          {/* Top Page Tag */}
          <div className="absolute top-2 right-4 text-[10px] font-mono text-outline select-none">
            SOLICITUD DE INICIO DE PROCESO DE COMPRA
          </div>

          <div className="space-y-6">
            {/* Header: Logo & Institutional Subtitle */}
            <div className="space-y-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-ende-deoruro.png"
                alt="ENDE DEORURO"
                style={{ maxHeight: "48px", maxWidth: "180px", width: "auto" }}
                className="h-12 w-auto object-contain"
              />
              <p className="text-[11px] font-sans font-bold text-gray-500 tracking-wider pl-12 uppercase">
                DISTRIBUIDORA DE ELECTRICIDAD ENDE DEORURO S.A.
              </p>
            </div>

            {/* No. and Date Row */}
            <div className="flex justify-between items-center text-[12pt] pt-4 font-sans">
              <div className="flex items-center gap-2">
                <span className="font-bold">No.</span>
                <span
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => handleTextChange("solicitud_inicio_numero", e.currentTarget.textContent || "")}
                  className="font-sans px-2 py-0.5 rounded hover:bg-blue-50 focus:outline-none font-bold"
                >
                  {numeroNota}
                </span>
              </div>

              <div
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => handleTextChange("solicitud_inicio_fecha", e.currentTarget.textContent || "")}
                className="font-sans text-right px-2 py-0.5 rounded hover:bg-blue-50 focus:outline-none"
              >
                {fechaNota}
              </div>
            </div>

            {/* Recipient Block (A / VIA / DE / OBJETO) */}
            <div className="space-y-3.5 pt-2 text-[12pt] font-sans">
              {/* A : */}
              <div className="grid grid-cols-12 items-baseline">
                <div className="col-span-2 font-bold text-gray-900">A :</div>
                <div className="col-span-10 space-y-0.5">
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => handleTextChange("solicitud_inicio_a_nombre", e.currentTarget.textContent || "")}
                    className="p-1 rounded hover:bg-blue-50 focus:outline-none"
                  >
                    {aNombre}
                  </div>
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => handleTextChange("solicitud_inicio_a_cargo", e.currentTarget.textContent || "")}
                    className="font-bold text-gray-900 uppercase p-1 rounded hover:bg-blue-50 focus:outline-none"
                  >
                    {aCargo}
                  </div>
                </div>
              </div>

              {/* VIA : */}
              <div className="grid grid-cols-12 items-baseline">
                <div className="col-span-2 font-bold text-gray-900">VIA :</div>
                <div className="col-span-10 space-y-0.5">
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => handleTextChange("solicitud_inicio_via_nombre", e.currentTarget.textContent || "")}
                    className="p-1 rounded hover:bg-blue-50 focus:outline-none"
                  >
                    {viaNombre}
                  </div>
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => handleTextChange("solicitud_inicio_via_cargo", e.currentTarget.textContent || "")}
                    className="font-bold text-gray-900 uppercase p-1 rounded hover:bg-blue-50 focus:outline-none"
                  >
                    {viaCargo}
                  </div>
                </div>
              </div>

              {/* DE : */}
              <div className="grid grid-cols-12 items-baseline">
                <div className="col-span-2 font-bold text-gray-900">DE :</div>
                <div className="col-span-10 space-y-0.5">
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => handleTextChange("solicitud_inicio_de_nombre", e.currentTarget.textContent || "")}
                    className="p-1 rounded hover:bg-blue-50 focus:outline-none"
                  >
                    {deNombre}
                  </div>
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => handleTextChange("solicitud_inicio_de_cargo", e.currentTarget.textContent || "")}
                    className="font-bold text-gray-900 uppercase p-1 rounded hover:bg-blue-50 focus:outline-none"
                  >
                    {deCargo}
                  </div>
                </div>
              </div>

              {/* OBJETO : */}
              <div className="grid grid-cols-12 items-baseline pt-1">
                <div className="col-span-2 font-bold text-gray-900">OBJETO:</div>
                <div className="col-span-10">
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => handleTextChange("solicitud_inicio_objeto", e.currentTarget.textContent || "")}
                    className="font-bold text-gray-950 uppercase underline p-1 rounded hover:bg-blue-50 focus:outline-none leading-snug"
                  >
                    {objetoNota}
                  </div>
                </div>
              </div>
            </div>

            {/* Solid Horizontal Divider Line */}
            <div className="border-b-2 border-gray-900 my-4"></div>

            {/* Letter Body (12 pt font) */}
            <div className="space-y-4 text-[12pt] font-sans leading-relaxed text-justify">
              <p className="font-semibold">De mi mayor consideración:</p>

              <div
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => handleTextChange("solicitud_inicio_parrafo1", e.currentTarget.textContent || "")}
                className="p-1.5 rounded hover:bg-blue-50 focus:outline-none"
              >
                {parrafo1}
              </div>

              <div
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => handleTextChange("solicitud_inicio_parrafo2", e.currentTarget.textContent || "")}
                className="p-1.5 rounded hover:bg-blue-50 focus:outline-none"
              >
                {parrafo2}
              </div>

              {/* Bullet Points of Attached Documents */}
              <div className="space-y-1.5 pl-6">
                <div className="flex items-start gap-2.5">
                  <span className="font-bold text-gray-800">•</span>
                  <span>Formulario S1-N014 de solicitud de Adquisiciones de Bienes, Construcción de Obras o Contratación de Servicios.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="font-bold text-gray-800">•</span>
                  <span>Cuadro de Justificación de solicitud de compra.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="font-bold text-gray-800">•</span>
                  <span>Especificaciones Técnicas o Termino de Referencia.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="font-bold text-gray-800">•</span>
                  <span>Cotizaciones o precio referencial.</span>
                </div>
              </div>

              <p className="pt-2">Sin otra particularidad y con las consideraciones del caso, me despido.</p>

              <p className="pt-2">Atentamente,</p>
            </div>
          </div>

          {/* Footer Area */}
          <div className="pt-16 mt-auto">
            <div className="flex justify-between items-end">
              {/* Bottom Left: Carbon Copy / Attachments */}
              <div className="text-[11px] font-sans text-gray-600 space-y-0.5">
                <div>Cc. Arch.</div>
                <div>Adj. Lo indicado</div>
              </div>

              {/* Clean signature line */}
              <div className="text-center font-sans text-xs text-gray-800">
                <div className="w-48 border-t border-gray-900 mb-1"></div>
                <div className="font-bold">{deNombre}</div>
                <div className="text-[10px] text-gray-600 uppercase">{deCargo}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Configuration Modal for Recipients & Date */}
      <Modal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        title="Configurar Destinatarios, Número y Fecha"
        subtitle="Datos oficiales de la Solicitud de Inicio (Carpeta 5)"
        maxWidth="lg"
      >
        <div className="space-y-4 text-xs font-sans">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-outline font-mono mb-1">Número de Nota:</label>
              <input
                type="text"
                value={docData.solicitud_inicio_numero || "047/2026"}
                onChange={(e) => handleTextChange("solicitud_inicio_numero", e.target.value)}
                className="w-full px-3 py-1.5 border border-outline-variant rounded font-bold"
              />
            </div>
            <div>
              <label className="block text-outline font-mono mb-1">Fecha de la Nota:</label>
              <input
                type="text"
                value={docData.solicitud_inicio_fecha || "Oruro, 26 de mayo de 2026"}
                onChange={(e) => handleTextChange("solicitud_inicio_fecha", e.target.value)}
                className="w-full px-3 py-1.5 border border-outline-variant rounded"
              />
            </div>
          </div>

          <div className="p-3 bg-surface-container-low border border-outline-variant rounded space-y-3">
            <h5 className="font-bold text-primary uppercase font-mono">Destinatarios Oficiales</h5>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-outline">A (Nombre):</label>
                <input
                  type="text"
                  value={docData.solicitud_inicio_a_nombre || "Lic. Vicente Paul Vega Ramirez"}
                  onChange={(e) => handleTextChange("solicitud_inicio_a_nombre", e.target.value)}
                  className="w-full px-2 py-1 border border-outline-variant rounded text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] text-outline">A (Cargo):</label>
                <input
                  type="text"
                  value={docData.solicitud_inicio_a_cargo || "RESPONSABLE DE CONTRATACIONES"}
                  onChange={(e) => handleTextChange("solicitud_inicio_a_cargo", e.target.value)}
                  className="w-full px-2 py-1 border border-outline-variant rounded text-xs uppercase"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-outline">VIA (Nombre):</label>
                <input
                  type="text"
                  value={docData.solicitud_inicio_via_nombre || "Lic. Raúl Alberto Torrico Gomez"}
                  onChange={(e) => handleTextChange("solicitud_inicio_via_nombre", e.target.value)}
                  className="w-full px-2 py-1 border border-outline-variant rounded text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] text-outline">VIA (Cargo):</label>
                <input
                  type="text"
                  value={docData.solicitud_inicio_via_cargo || "GERENTE GENERAL"}
                  onChange={(e) => handleTextChange("solicitud_inicio_via_cargo", e.target.value)}
                  className="w-full px-2 py-1 border border-outline-variant rounded text-xs uppercase"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-outline">DE (Nombre):</label>
                <input
                  type="text"
                  value={docData.solicitud_inicio_de_nombre || "Ing. Heydi Dunya Canaviri Padilla"}
                  onChange={(e) => handleTextChange("solicitud_inicio_de_nombre", e.target.value)}
                  className="w-full px-2 py-1 border border-outline-variant rounded text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] text-outline">DE (Cargo):</label>
                <input
                  type="text"
                  value={docData.solicitud_inicio_de_cargo || "SUPERVISOR DE SEGURIDAD INDUSTRIAL"}
                  onChange={(e) => handleTextChange("solicitud_inicio_de_cargo", e.target.value)}
                  className="w-full px-2 py-1 border border-outline-variant rounded text-xs uppercase"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowConfigModal(false)}
              className="px-4 py-2 bg-primary text-on-primary rounded font-bold text-xs"
            >
              Listo
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
