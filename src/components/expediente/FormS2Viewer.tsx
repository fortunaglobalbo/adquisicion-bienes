"use client";

import React, { useState } from "react";
import { Adquisicion, ItemAdquisicion } from "@/types";
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
        const cant = Number(field === "cantidad" ? val : updated.cantidad) || 0;
        const pu = Number(field === "precioUnitarioEstimado" ? val : updated.precioUnitarioEstimado) || 0;
        updated.precioTotalEstimado = cant * pu;
        return updated;
      });

      const totalPresupuesto = updatedItems.reduce(
        (sum, it) => sum + (Number(it.precioTotalEstimado) || 0),
        0
      );

      return {
        ...prev,
        items: updatedItems,
        prevision_presupuesto: totalPresupuesto > 0 ? totalPresupuesto : prev.prevision_presupuesto,
      };
    });
  };

  const handleAddItem = () => {
    const nextNum = (docData.items?.length || 0) + 1;
    const newItem: ItemAdquisicion = {
      id: `item-s2-${Date.now()}`,
      item: nextNum,
      descripcion: "NUEVO ÍTEM / SUMINISTRO REQUERIDO",
      unidad: "PZA",
      cantidad: 1,
      precioUnitarioEstimado: 0,
      precioTotalEstimado: 0,
      caracteristicasTecnicas: "Según especificaciones técnicas oficiales",
    };
    setDocData((prev) => ({
      ...prev,
      items: [...(prev.items || []), newItem],
    }));
  };

  const handleDeleteItem = (itemId: string) => {
    const filtered = (docData.items || []).filter((it) => it.id !== itemId).map((it, idx) => ({ ...it, item: idx + 1 }));
    const totalPresupuesto = filtered.reduce(
      (sum, it) => sum + (Number(it.precioTotalEstimado) || (Number(it.cantidad) || 1) * (Number(it.precioUnitarioEstimado) || 0)),
      0
    );
    const updated = {
      ...docData,
      items: filtered,
      prevision_presupuesto: totalPresupuesto,
    };
    setDocData(updated);
    onAdquisicionUpdated?.(updated);
  };

  // Direct 1-Click AI Generation
  const handleConsolidateAndGenerateWithAi = async () => {
    setIsAiProcessing(true);
    try {
      const payload: any = {
        adquisicion: docData,
        insumoTexto: `Emitir el Formulario S2-N014 oficial de Solicitud de Cotización para el proceso "${docData.titulo_proceso}".`,
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
          form_s2_fecha_solicitud: result.data.fecha_solicitud || docData.form_s2_fecha_solicitud || "19/06/2026",
          form_s2_senores: result.data.senores || docData.form_s2_senores || "PROVEEDOR / PROPONENTE",
          form_s2_tiempo_entrega: result.data.tiempo_entrega || docData.form_s2_tiempo_entrega,
          form_s2_validez_oferta: result.data.validez_oferta || docData.form_s2_validez_oferta,
          form_s2_observaciones: result.data.observaciones || docData.form_s2_observaciones,
          form_s2_nota_adicional: result.data.nota_adicional || docData.form_s2_nota_adicional,
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

  // Document Fields matching official photo
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
            title="Generar la Solicitud de Cotización oficial con IA"
          >
            {isAiProcessing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-yellow-100" />
                <span>Generando Solicitud de Cotización...</span>
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
            title="Descargar el Formulario S2 oficial en formato Microsoft Word (.docx) con texto en tamaño 12"
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
            title="Configurar Proveedor y Fechas"
          >
            <Settings className="w-4 h-4 text-secondary-fixed-variant" />
            <span>Proveedor & Fecha</span>
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

      {/* Instructions banner for staff */}
      <div className="bg-amber-50 border-l-4 border-amber-500 p-2.5 rounded text-xs text-amber-950 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold uppercase font-mono text-amber-800">✍️ Edición Directa:</span>
          <span>Haz clic en el nombre del proveedor, fecha u observaciones para editar directamente.</span>
        </div>
      </div>

      {/* Document Sheet Container (Matching Official Photo 100%) */}
      <div className="w-full flex flex-col items-center py-4 bg-surface-container/60 rounded-lg p-2 md:p-6 overflow-x-auto">
        <div className="w-full max-w-[850px] bg-white border border-outline-variant shadow-xl rounded-sm p-10 md:p-14 text-on-surface font-sans min-h-[1050px] flex flex-col justify-between relative">
          
          {/* Top Page Tag */}
          <div className="absolute top-2 right-4 text-[10px] font-mono text-outline select-none">
            FORMULARIO S2-N014 - SOLICITUD DE COTIZACIÓN
          </div>

          <div className="space-y-5">
            {/* Header: Logo and Institutional Info */}
            <div className="flex items-start justify-between">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-ende-deoruro.png"
                alt="ENDE DEORURO"
                style={{ maxHeight: "48px", maxWidth: "160px", width: "auto" }}
                className="h-12 w-auto object-contain"
              />

              <div className="text-right text-xs text-gray-700 font-sans space-y-0.5">
                <div className="font-bold text-gray-900 uppercase">
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
                  className="font-bold text-gray-900 uppercase px-2 py-0.5 rounded hover:bg-blue-50 focus:outline-none"
                >
                  {senores}
                </span>
              </div>

              <p className="text-xs text-gray-800 pt-1">
                Por favor cotizar los siguientes bienes/obras/servicios:
              </p>
            </div>

            {/* Official Quotation Table (Exact Grid Borders with Full Live Editing & Calculation) */}
            <div className="space-y-2 mt-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-mono text-gray-500 font-bold">
                  ÍTEMS DE COTIZACIÓN ({items.length}) • EDICIÓN Y CÁLCULO EN VIVO
                </span>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="flex items-center gap-1.5 px-3 py-1 bg-primary text-white hover:bg-primary-container text-xs font-bold rounded shadow-sm transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Añadir Ítem</span>
                </button>
              </div>

              <div className="border border-gray-900 overflow-hidden">
                <table className="w-full text-xs font-sans border-collapse">
                  <thead>
                    <tr className="border-b border-gray-900 bg-gray-100 text-center font-bold text-gray-900">
                      <th className="border-r border-gray-900 p-2 w-10">N°</th>
                      <th className="border-r border-gray-900 p-2 w-20">CANTIDAD</th>
                      <th className="border-r border-gray-900 p-2 w-20">UNIDAD</th>
                      <th className="border-r border-gray-900 p-2 text-center">DESCRIPCION</th>
                      <th className="border-r border-gray-900 p-2 w-28 text-center leading-tight">PRECIO<br />UNITARIO (Bs)</th>
                      <th className="border-r border-gray-900 p-2 w-28 text-center leading-tight">PRECIO<br />TOTAL (Bs)</th>
                      <th className="p-2 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-900 text-gray-900">
                    {items.map((item, idx) => {
                      const subtotal = (Number(item.cantidad) || 1) * (Number(item.precioUnitarioEstimado) || 0);
                      return (
                        <tr key={item.id || idx} className="h-10 hover:bg-blue-50/20 group">
                          <td className="border-r border-gray-900 p-2 text-center font-bold">{item.item || idx + 1}</td>
                          <td className="border-r border-gray-900 p-2 text-center font-bold">
                            <input
                              type="number"
                              min="1"
                              value={item.cantidad || 1}
                              onChange={(e) => handleItemChange(item.id, "cantidad", parseInt(e.target.value, 10) || 1)}
                              className="w-14 text-center font-bold bg-transparent focus:bg-white focus:outline-none border-b border-transparent hover:border-gray-400"
                            />
                          </td>
                          <td className="border-r border-gray-900 p-2 text-center uppercase">
                            <input
                              type="text"
                              value={item.unidad || "PZA"}
                              onChange={(e) => handleItemChange(item.id, "unidad", e.target.value.toUpperCase())}
                              className="w-14 text-center uppercase font-bold bg-transparent focus:bg-white focus:outline-none border-b border-transparent hover:border-gray-400"
                            />
                          </td>
                          <td className="border-r border-gray-900 p-2.5 uppercase font-medium">
                            <div
                              contentEditable
                              suppressContentEditableWarning
                              onBlur={(e) => handleItemChange(item.id, "descripcion", e.currentTarget.textContent || "")}
                              className="w-full font-medium uppercase min-h-[44px] focus:bg-white focus:outline-none p-1 rounded hover:bg-blue-50/50 leading-relaxed whitespace-pre-wrap text-xs md:text-sm text-left select-text cursor-text"
                            >
                              {item.descripcion}
                            </div>
                          </td>
                          <td className="border-r border-gray-900 p-2 text-center">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.precioUnitarioEstimado || ""}
                              placeholder="0.00"
                              onChange={(e) => handleItemChange(item.id, "precioUnitarioEstimado", parseFloat(e.target.value) || 0)}
                              className="w-20 text-center font-mono font-bold bg-transparent focus:bg-white focus:outline-none border-b border-transparent hover:border-gray-400"
                            />
                          </td>
                          <td className="border-r border-gray-900 p-2 text-center font-mono font-bold bg-gray-50/50">
                            {formatCurrencyBs(subtotal)}
                          </td>
                          <td className="p-2 text-center no-print">
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item.id)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded transition-colors"
                              title="Eliminar ítem"
                            >
                              <Trash2 className="w-3.5 h-3.5 mx-auto" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {/* Total Row with Live Auto Calculation */}
                    <tr className="border-t border-gray-900 h-10 font-bold bg-gray-100">
                      <td colSpan={4} className="border-r border-gray-900 p-2 text-right uppercase font-mono">
                        TOTAL GENERAL COTIZADO (Bs):
                      </td>
                      <td className="border-r border-gray-900 p-2"></td>
                      <td className="border-r border-gray-900 p-2 text-center font-mono font-black text-primary text-sm bg-yellow-50/80">
                        {formatCurrencyBs(totalCotizacion)}
                      </td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Conditions & Observations */}
            <div className="space-y-2 text-[12pt] font-sans pt-4 leading-relaxed">
              <div className="flex items-center gap-3">
                <span>Tiempo de entrega :</span>
                <span
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => handleTextChange("form_s2_tiempo_entrega", e.currentTarget.textContent || "")}
                  className="border-b border-gray-900 min-w-[200px] px-2 py-0.5 inline-block hover:bg-blue-50 focus:outline-none"
                >
                  {tiempoEntrega}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span>Validez de la Oferta :</span>
                <span
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => handleTextChange("form_s2_validez_oferta", e.currentTarget.textContent || "")}
                  className="border-b border-gray-900 min-w-[200px] px-2 py-0.5 inline-block hover:bg-blue-50 focus:outline-none"
                >
                  {validezOferta}
                </span>
              </div>

              <div className="pt-2">
                <span className="font-bold">OBSERVACIONES: </span>
                <span
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => handleTextChange("form_s2_observaciones", e.currentTarget.textContent || "")}
                  className="uppercase px-1 rounded hover:bg-blue-50 focus:outline-none"
                >
                  {observaciones}
                </span>
              </div>

              <div
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => handleTextChange("form_s2_nota_adicional", e.currentTarget.textContent || "")}
                className="font-bold uppercase text-gray-900 p-1 rounded hover:bg-blue-50 focus:outline-none"
              >
                {notaAdicional}
              </div>
            </div>
          </div>

          {/* Supplier Stamp/Signature Area and Legal Note at bottom */}
          <div className="pt-16 mt-auto space-y-6">
            {/* Signature on right */}
            <div className="flex justify-end">
              <div className="w-64 text-center space-y-3">
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
        </div>
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
