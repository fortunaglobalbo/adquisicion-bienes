"use client";

import React, { useState } from "react";
import { Adquisicion, ItemAdquisicion } from "@/types";
import {
  Download,
  Save,
  Maximize2,
  Minimize2,
  Settings,
  Sparkles,
  RefreshCw,
  Plus,
  Trash2,
  FileDown,
} from "lucide-react";
import { Modal } from "../ui/Modal";
import { formatCurrencyBs } from "@/lib/docx/formatters";
import { getFechaCortaActual } from "@/lib/utils/dateUtils";

interface FormS2ViewerProps {
  adquisicion: Adquisicion;
  onDownloadDocx: (liveData?: Adquisicion) => void;
  onDownloadPdf?: (liveData?: Adquisicion) => void;
  onAdquisicionUpdated?: (updated: Adquisicion) => void;
}

export const FormS2Viewer: React.FC<FormS2ViewerProps> = ({
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
    form_s2_fecha_solicitud: adquisicion.form_s2_fecha_solicitud || getFechaCortaActual(),
  });

  // Update field helper
  const handleTextChange = (field: keyof Adquisicion, value: any) => {
    setDocData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Item management with live automatic calculation
  const handleItemChange = (itemId: string, field: keyof ItemAdquisicion, val: any) => {
    setDocData((prev) => {
      const updatedItems = (prev.items || []).map((it) => {
        if (it.id !== itemId) return it;
        const updated = { ...it, [field]: val };
        if (field === "cantidad" || field === "precioUnitarioEstimado") {
          const qty = field === "cantidad" ? Number(val) || 0 : Number(it.cantidad) || 0;
          const pu = field === "precioUnitarioEstimado" ? Number(val) || 0 : Number(it.precioUnitarioEstimado) || 0;
          updated.precioTotalEstimado = qty * pu;
        }
        return updated;
      });

      const total = updatedItems.reduce((sum, it) => sum + (Number(it.precioTotalEstimado) || 0), 0);

      return {
        ...prev,
        items: updatedItems,
        prevision_presupuesto: total > 0 ? total : prev.prevision_presupuesto,
      };
    });
  };

  const handleAddItem = () => {
    const newItem: ItemAdquisicion = {
      id: `it-${Date.now()}`,
      item: (docData.items?.length || 0) + 1,
      descripcion: "Nuevo Ítem / Suministro solicitado",
      unidad: "PZA",
      cantidad: 1,
      precioUnitarioEstimado: 0,
      precioTotalEstimado: 0,
    };
    setDocData((prev) => ({
      ...prev,
      items: [...(prev.items || []), newItem],
    }));
  };

  const handleDeleteItem = (itemId: string) => {
    setDocData((prev) => ({
      ...prev,
      items: (prev.items || []).filter((it) => it.id !== itemId),
    }));
  };

  // Direct 1-Click AI Generation
  const handleConsolidateAndGenerateWithAi = async () => {
    setIsAiProcessing(true);
    try {
      const payload: any = {
        adquisicion: docData,
        insumoTexto: `Generar la Solicitud de Cotización (Formulario S2-N014) para el proceso "${docData.titulo_proceso}".`,
      };

      const res = await fetch("/api/ai/generate-s2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Error al procesar con IA");

      if (result.data) {
        const updated: Adquisicion = {
          ...docData,
          form_s2_senores: result.data.senores || docData.form_s2_senores,
          form_s2_fecha_solicitud: result.data.fecha_solicitud || docData.form_s2_fecha_solicitud,
          form_s2_tiempo_entrega: result.data.tiempo_entrega || docData.form_s2_tiempo_entrega,
          form_s2_validez_oferta: result.data.validez_oferta || docData.form_s2_validez_oferta,
          form_s2_observaciones: result.data.observaciones || docData.form_s2_observaciones,
          form_s2_nota_adicional: result.data.nota_adicional || docData.form_s2_nota_adicional,
          items: result.data.items && result.data.items.length > 0 ? result.data.items : docData.items,
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
    const totalPresupuesto = (docData.items || []).reduce(
      (sum, it) => sum + (Number(it.precioTotalEstimado) || (Number(it.cantidad) || 1) * (Number(it.precioUnitarioEstimado) || 0)),
      0
    );
    const updated = {
      ...docData,
      prevision_presupuesto: totalPresupuesto > 0 ? totalPresupuesto : docData.prevision_presupuesto,
    };
    setDocData(updated);
    onAdquisicionUpdated?.(updated);
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2500);
  };

  const fechaSolicitud = docData.form_s2_fecha_solicitud || "19/06/2026";
  const senores = docData.form_s2_senores || "PROVEEDOR / PROPONENTE";
  const tiempoEntrega = docData.form_s2_tiempo_entrega || `${docData.plazo_entrega_dias || 30} días calendario`;
  const validezOferta = docData.form_s2_validez_oferta || "30 días calendario";
  const observaciones = docData.form_s2_observaciones || "SE ADJUNTA ESPECIFICACIONES TECNICAS";
  const notaAdicional = docData.form_s2_nota_adicional || "ADJUNTAR FOTOCOPIA SIMPLE DE SU RNC - NIT";

  const items = docData.items || [];
  const totalCotizacion = items.reduce(
    (sum, it) => sum + (Number(it.precioTotalEstimado) || (Number(it.cantidad) || 1) * (Number(it.precioUnitarioEstimado) || 0)),
    0
  );
  const isDocumentGenerated = (docData.items && docData.items.length > 0) || (!!docData.form_s2_senores && docData.form_s2_senores !== "PROVEEDOR / PROPONENTE");

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-full pb-16">
      {/* Top Floating Toolbar */}
      <div className="sticky top-16 z-20 w-full max-w-[850px] bg-surface/95 backdrop-blur border border-outline-variant/80 rounded-xl p-3 shadow-md flex flex-wrap justify-between items-center gap-3">
        {/* Left: AI & Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleConsolidateAndGenerateWithAi}
            disabled={isAiProcessing}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-primary-container text-white font-sans text-xs font-bold rounded-lg shadow-sm hover:opacity-90 transition-all disabled:opacity-50 active:scale-95"
            title="Generar la Solicitud de Cotización oficial con IA"
          >
            {isAiProcessing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-yellow-100" />
                <span>Generando Solicitud S-2...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-yellow-300 fill-yellow-300" />
                <span>✨ Generar con IA</span>
              </>
            )}
          </button>

          <button
            onClick={handleSave}
            disabled={!isDocumentGenerated}
            className="flex items-center gap-2 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-sans text-xs font-bold rounded-lg shadow-sm transition-all disabled:opacity-40"
            title="Guardar cambios"
          >
            <Save className="w-4 h-4 text-emerald-200" />
            <span>Guardar</span>
          </button>

          <button
            onClick={() => onDownloadDocx(docData)}
            disabled={!isDocumentGenerated}
            className="flex items-center gap-1.5 px-3 py-2 bg-surface-container-high border border-outline-variant hover:border-primary text-on-surface font-sans text-xs font-semibold rounded-lg shadow-sm transition-all disabled:opacity-40"
            title="Descargar Word (.docx)"
          >
            <Download className="w-4 h-4 text-primary" />
            <span>Descargar Word (.docx)</span>
          </button>
        </div>

        {/* Right: Quick Options */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowConfigModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-surface-container-high hover:bg-surface-container-highest text-primary font-sans text-xs font-bold rounded border border-outline-variant transition-colors"
            title="Configurar Parámetros del Formulario S-2"
          >
            <Settings className="w-4 h-4 text-secondary-fixed-variant" />
            <span>Condiciones S-2</span>
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

      {/* Document Sheet Container */}
      <div className="w-full flex flex-col items-center py-4 bg-surface-container/60 rounded-lg p-2 md:p-6 overflow-x-auto">
        {!isDocumentGenerated ? (
          <div className="w-full max-w-[850px] bg-white border border-outline-variant/60 shadow-md rounded-xl p-16 min-h-[550px] flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <FileDown className="w-8 h-8 opacity-60" />
            </div>
            <div className="max-w-md space-y-1.5">
              <h4 className="font-bold text-on-surface text-lg">Vista Previa en Blanco</h4>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                El Formulario S-2 (Solicitud de Cotización) aún no ha sido generado para este expediente. Haz clic en el botón para redactarlo automáticamente con la IA.
              </p>
            </div>
            <button
              type="button"
              onClick={handleConsolidateAndGenerateWithAi}
              disabled={isAiProcessing}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary text-on-primary font-bold text-xs rounded-lg shadow-sm hover:opacity-90 transition-all disabled:opacity-50"
            >
              {isAiProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Generando con IA...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-yellow-300 fill-yellow-300" />
                  <span>✨ Generar Formulario S-2 con IA</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="w-full max-w-[850px] bg-white border-2 border-black shadow-xl rounded-sm p-6 md:p-10 text-on-surface font-sans min-h-[1100px] flex flex-col justify-between relative space-y-4">
            {/* Header Box Table: Exact replica of official ENDE Form S-2 */}
            <div className="border border-black flex justify-between items-stretch text-center font-sans">
              <div className="w-[30%] border-r border-black p-2 flex flex-col items-center justify-center bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo-ende-deoruro.png"
                  alt="ENDE DEORURO"
                  style={{ maxHeight: "42px", maxWidth: "160px", width: "auto" }}
                  className="h-10 w-auto object-contain"
                />
              </div>

              <div className="flex-1 p-2 flex flex-col justify-center items-center border-r border-black">
                <div className="font-bold text-sm uppercase text-gray-900">
                  DISTRIBUIDORA DE ELECTRICIDAD ENDE DEORURO S.A.
                </div>
                <div className="text-[10px] text-gray-600 font-mono">
                  Teléfono: 5252233  Fax: 5113434  Casilla 53  NIT 1009769021
                </div>
              </div>
            </div>

            {/* Title: SOLICITUD DE COTIZACION */}
            <div className="text-center pt-2 pb-1 space-y-0.5">
              <h2 className="font-sans text-lg font-black text-gray-900 tracking-wide uppercase">
                SOLICITUD DE COTIZACION
              </h2>
              <div className="font-sans text-xs font-bold text-gray-800 tracking-wider">
                FORMULARIO S2-N014
              </div>
            </div>

            {/* Date and Recipient Info */}
            <div className="space-y-2 text-[12pt] font-sans pt-1">
              <div className="flex items-center gap-6">
                <span className="text-gray-900 font-medium w-40">Fecha de Solicitud:</span>
                <span
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => handleTextChange("form_s2_fecha_solicitud", e.currentTarget.textContent || "")}
                  className="font-sans px-2 py-0.5 rounded hover:bg-blue-50 focus:outline-none"
                >
                  {fechaSolicitud}
                </span>
              </div>

              <div className="flex items-center gap-6">
                <span className="text-gray-900 font-medium w-40">Señor (es):</span>
                <span
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => handleTextChange("form_s2_senores", e.currentTarget.textContent || "")}
                  className="font-sans px-2 py-0.5 rounded hover:bg-blue-50 focus:outline-none font-bold uppercase"
                >
                  {senores}
                </span>
              </div>

              <div className="text-xs text-gray-700 italic pt-1">
                Agradeceremos a ustedes cotizarnos los siguientes items puestos en nuestros almacenes:
              </div>
            </div>

            {/* Items Table */}
            <div className="overflow-x-auto my-2">
              <table className="w-full border-collapse border-2 border-black text-xs font-sans">
                <thead>
                  <tr className="bg-gray-200 border-b-2 border-black text-center font-bold">
                    <th className="border border-black p-1.5 w-12">ITEM</th>
                    <th className="border border-black p-1.5 w-16">CANT.</th>
                    <th className="border border-black p-1.5 w-16">UNID.</th>
                    <th className="border border-black p-1.5">DETALLE</th>
                    <th className="border border-black p-1.5 w-24">P. UNIT (Bs)</th>
                    <th className="border border-black p-1.5 w-24">P. TOTAL (Bs)</th>
                    <th className="border border-black p-1.5 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={it.id || idx} className="border-b border-black hover:bg-blue-50/40">
                      <td className="border border-black p-1.5 text-center font-mono font-bold">
                        {it.item || idx + 1}
                      </td>
                      <td className="border border-black p-1 text-center font-bold">
                        <input
                          type="number"
                          value={it.cantidad}
                          onChange={(e) => handleItemChange(it.id, "cantidad", e.target.value)}
                          className="w-full text-center bg-transparent outline-none focus:bg-white rounded"
                        />
                      </td>
                      <td className="border border-black p-1 text-center">
                        <input
                          type="text"
                          value={it.unidad || "PZA"}
                          onChange={(e) => handleItemChange(it.id, "unidad", e.target.value)}
                          className="w-full text-center bg-transparent outline-none focus:bg-white rounded uppercase"
                        />
                      </td>
                      <td className="border border-black p-1.5 text-left">
                        <textarea
                          rows={2}
                          value={it.descripcion}
                          onChange={(e) => handleItemChange(it.id, "descripcion", e.target.value)}
                          className="w-full bg-transparent outline-none focus:bg-white rounded resize-y text-xs"
                        />
                      </td>
                      <td className="border border-black p-1 text-right font-mono">
                        <input
                          type="number"
                          step="0.01"
                          value={it.precioUnitarioEstimado || 0}
                          onChange={(e) => handleItemChange(it.id, "precioUnitarioEstimado", e.target.value)}
                          className="w-full text-right bg-transparent outline-none focus:bg-white rounded"
                        />
                      </td>
                      <td className="border border-black p-1.5 text-right font-mono font-bold">
                        {formatCurrencyBs(it.precioTotalEstimado || 0)}
                      </td>
                      <td className="border border-black p-1 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(it.id)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                          title="Eliminar fila"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {/* Total Row */}
                  <tr className="bg-gray-100 font-bold border-t-2 border-black">
                    <td colSpan={5} className="border border-black p-2 text-right uppercase tracking-wider">
                      TOTAL COTIZADO:
                    </td>
                    <td className="border border-black p-2 text-right font-mono text-sm text-primary font-black">
                      {formatCurrencyBs(totalCotizacion)}
                    </td>
                    <td className="border border-black p-1"></td>
                  </tr>
                </tbody>
              </table>
              <div className="pt-2 flex justify-start">
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="flex items-center gap-1 text-xs text-primary font-bold hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" /> Añadir Ítem a la Cotización
                </button>
              </div>
            </div>

            {/* Conditions Section */}
            <div className="space-y-2 text-xs font-sans border-t-2 border-black pt-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-baseline gap-2">
                  <span className="font-bold text-gray-900 w-44">Tiempo de entrega:</span>
                  <span
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => handleTextChange("form_s2_tiempo_entrega", e.currentTarget.textContent || "")}
                    className="border-b border-gray-400 flex-1 px-1 hover:bg-blue-50 focus:outline-none"
                  >
                    {tiempoEntrega}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-bold text-gray-900 w-44">Validez de la oferta:</span>
                  <span
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => handleTextChange("form_s2_validez_oferta", e.currentTarget.textContent || "")}
                    className="border-b border-gray-400 flex-1 px-1 hover:bg-blue-50 focus:outline-none"
                  >
                    {validezOferta}
                  </span>
                </div>
              </div>

              <div className="flex items-baseline gap-2 pt-1">
                <span className="font-bold text-gray-900 w-32">Observaciones:</span>
                <span
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => handleTextChange("form_s2_observaciones", e.currentTarget.textContent || "")}
                  className="border-b border-gray-400 flex-1 px-1 hover:bg-blue-50 focus:outline-none uppercase"
                >
                  {observaciones}
                </span>
              </div>

              <div className="flex items-baseline gap-2 pt-1">
                <span className="font-bold text-gray-900 w-32">Nota Requerimiento:</span>
                <span
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => handleTextChange("form_s2_nota_adicional", e.currentTarget.textContent || "")}
                  className="border-b border-gray-400 flex-1 px-1 hover:bg-blue-50 focus:outline-none font-bold text-red-700 uppercase"
                >
                  {notaAdicional}
                </span>
              </div>
            </div>

            {/* Signature Area */}
            <div className="pt-8 grid grid-cols-2 gap-8 text-center font-sans">
              <div>
                <div className="w-52 border-b border-black mx-auto mb-1"></div>
                <div className="text-xs font-bold text-gray-900">RESPONSABLE DE CONTRATACIONES</div>
                <div className="text-[10px] text-gray-600">DISTRIBUIDORA DE ELECTRICIDAD ENDE DEORURO S.A.</div>
              </div>

              <div>
                <div className="w-52 border-b border-black mx-auto mb-1"></div>
                <div
                  contentEditable
                  suppressContentEditableWarning
                  className="border-t border-gray-900 pt-1 text-xs text-gray-800 font-medium hover:bg-blue-50 focus:outline-none cursor-text"
                >
                  Firma y Sello del Proveedor Proponente
                </div>
                <div className="text-xs text-gray-800 text-left pt-2 flex items-center gap-1">
                  <span>Fecha de Cotizacion:</span>
                  <span
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => handleTextChange("form_s2_fecha_solicitud", e.currentTarget.textContent || "")}
                    className="border-b border-gray-800 inline-block px-1 min-w-[100px] hover:bg-blue-50 focus:outline-none font-bold"
                  >
                    {fechaSolicitud}
                  </span>
                </div>
              </div>
            </div>

            {/* Legal Notice */}
            <div className="border-t border-gray-300 pt-3 text-[10px] text-gray-700 font-sans leading-relaxed">
              <strong>NOTA:</strong> El presente registro no compromete una acción de compra de parte de la Distribuidora de Electricidad ENDE DEORURO S.A.
            </div>
          </div>
        )}
      </div>

      {/* Configuration Modal */}
      <Modal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        title="Configurar Proveedor y Fechas (Formulario S2)"
        subtitle="Datos oficiales para la Solicitud de Cotización"
        maxWidth="lg"
      >
        <div className="space-y-4 text-xs font-sans">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-outline font-mono mb-1">Señor (es) / Empresa:</label>
              <input
                type="text"
                value={docData.form_s2_senores || "ARIOL IMPORT"}
                onChange={(e) => handleTextChange("form_s2_senores", e.target.value)}
                className="w-full px-3 py-1.5 border border-outline-variant rounded font-bold uppercase"
              />
            </div>
            <div>
              <label className="block text-outline font-mono mb-1">Fecha de Solicitud:</label>
              <input
                type="text"
                value={docData.form_s2_fecha_solicitud || "19/06/2026"}
                onChange={(e) => handleTextChange("form_s2_fecha_solicitud", e.target.value)}
                className="w-full px-3 py-1.5 border border-outline-variant rounded"
              />
            </div>
          </div>

          <div className="p-3 bg-surface-container-low border border-outline-variant rounded space-y-3">
            <h5 className="font-bold text-primary uppercase font-mono">Observaciones y Condiciones</h5>
            <div>
              <label className="block text-outline mb-1">Observaciones:</label>
              <input
                type="text"
                value={docData.form_s2_observaciones || "SE ADJUNTA ESPECIFICACIONES TECNICAS"}
                onChange={(e) => handleTextChange("form_s2_observaciones", e.target.value)}
                className="w-full px-3 py-1.5 border border-outline-variant rounded uppercase"
              />
            </div>
            <div>
              <label className="block text-outline mb-1">Nota de Requisito Tributario:</label>
              <input
                type="text"
                value={docData.form_s2_nota_adicional || "ADJUNTAR FOTOCOPIA SIMPLE DE SU RNC - NIT"}
                onChange={(e) => handleTextChange("form_s2_nota_adicional", e.target.value)}
                className="w-full px-3 py-1.5 border border-outline-variant rounded font-bold uppercase"
              />
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
