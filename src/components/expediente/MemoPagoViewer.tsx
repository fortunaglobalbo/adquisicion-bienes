"use client";

import React, { useState } from "react";
import { Adquisicion } from "@/types";
import {
  Download,
  Save,
  Maximize2,
  Minimize2,
  Sparkles,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  CreditCard,
  Building,
  ReceiptText,
} from "lucide-react";
import { getFechaTextoActual } from "@/lib/utils/dateUtils";

interface MemoPagoViewerProps {
  adquisicion: Adquisicion;
  onDownloadDocx: (liveData?: Adquisicion) => void;
  onAdquisicionUpdated?: (updated: Adquisicion) => void;
}

export const MemoPagoViewer: React.FC<MemoPagoViewerProps> = ({
  adquisicion,
  onDownloadDocx,
  onAdquisicionUpdated,
}) => {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  const [docData, setDocData] = useState<Adquisicion>({
    ...adquisicion,
    memo_pago_cite: adquisicion.memo_pago_cite || "GG-SPA-26/070002",
    memo_pago_fecha: adquisicion.memo_pago_fecha || getFechaTextoActual(),
    memo_pago_a_nombre:
      adquisicion.memo_pago_a_nombre || "LIC. VICENTE PAUL VEGA RAMIREZ",
    memo_pago_a_cargo:
      adquisicion.memo_pago_a_cargo || "SUPERINTENDENTE DE ADMINISTRACIÓN Y FINANZAS a.i.",
    memo_pago_de_nombre:
      adquisicion.memo_pago_de_nombre || "ING. TATIANA TORRES ANDRADE",
    memo_pago_de_cargo:
      adquisicion.memo_pago_de_cargo || "SUPERVISOR DE SEGURIDAD INDUSTRIAL a.i.",
    memo_pago_proveedor:
      adquisicion.memo_pago_proveedor ||
      adquisicion.informe_conf_empresa_ganadora ||
      adquisicion.proveedor_adjudicado ||
      "MOVICLEAN S.R.L.",
    memo_pago_objeto:
      adquisicion.memo_pago_objeto ||
      `SOLICITUD DE PAGO ${(adquisicion.titulo_proceso || "SERVICIO DE LIMPIEZA").toUpperCase()} DE ${(adquisicion.memo_pago_proveedor || adquisicion.informe_conf_empresa_ganadora || "MOVICLEAN S.R.L.").toUpperCase()}`,
    memo_pago_nro_factura: adquisicion.memo_pago_nro_factura || "2",
    memo_pago_monto_total:
      adquisicion.memo_pago_monto_total ||
      adquisicion.informe_conf_monto_adjudicado ||
      58333.0,
    memo_pago_monto_literal:
      adquisicion.memo_pago_monto_literal ||
      "Cincuenta y ocho mil trescientos treinta y tres 00/100 Bolivianos",
    memo_pago_items:
      adquisicion.memo_pago_items && adquisicion.memo_pago_items.length > 0
        ? adquisicion.memo_pago_items
        : [
            {
              cantidad: "1.00",
              unidad: "Unidad (Servicios)",
              descripcion: (adquisicion.titulo_proceso || "SERVICIO DE LIMPIEZA MES DE JUNIO 2026").toUpperCase(),
            },
          ],
    memo_pago_banco_cite_solicitud:
      adquisicion.memo_pago_banco_cite_solicitud || "CITE: MOVICLEAN-LIM-ADM-No113/2026",
    memo_pago_banco_nombre: adquisicion.memo_pago_banco_nombre || "Banco Económico",
    memo_pago_banco_titular:
      adquisicion.memo_pago_banco_titular ||
      adquisicion.memo_pago_proveedor ||
      "Moviclean SRL",
    memo_pago_banco_cuenta: adquisicion.memo_pago_banco_cuenta || "1041-505958",
    memo_pago_conformidad_texto:
      adquisicion.memo_pago_conformidad_texto ||
      `Así mismo, informamos que el proveedor ha cumplido satisfactoriamente con la prestación del servicio contratado.`,
  });

  const handleFieldChange = (field: keyof Adquisicion, value: any) => {
    setDocData((prev) => ({ ...prev, [field]: value }));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const list = [...(docData.memo_pago_items || [])];
    list[index] = { ...list[index], [field]: value };
    setDocData((prev) => ({ ...prev, memo_pago_items: list }));
  };

  const handleAddItem = () => {
    const list = [...(docData.memo_pago_items || [])];
    list.push({
      cantidad: "1.00",
      unidad: "Unidad (Servicios)",
      descripcion: "CONCEPTO O ÍTEM FACTURADO",
    });
    setDocData((prev) => ({ ...prev, memo_pago_items: list }));
  };

  const handleRemoveItem = (index: number) => {
    const list = (docData.memo_pago_items || []).filter((_, idx) => idx !== index);
    setDocData((prev) => ({ ...prev, memo_pago_items: list }));
  };

  const handleGenerateWithAi = async () => {
    setIsAiProcessing(true);
    try {
      const res = await fetch("/api/ai/generate-memo-pago", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adquisicion: docData }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Error al procesar con IA");

      if (result.data) {
        const updated: Adquisicion = {
          ...docData,
          memo_pago_cite: result.data.cite || docData.memo_pago_cite,
          memo_pago_fecha: result.data.fecha || docData.memo_pago_fecha,
          memo_pago_a_nombre: result.data.a_nombre || docData.memo_pago_a_nombre,
          memo_pago_a_cargo: result.data.a_cargo || docData.memo_pago_a_cargo,
          memo_pago_de_nombre: result.data.de_nombre || docData.memo_pago_de_nombre,
          memo_pago_de_cargo: result.data.de_cargo || docData.memo_pago_de_cargo,
          memo_pago_objeto: result.data.objeto || docData.memo_pago_objeto,
          memo_pago_nro_factura: result.data.nro_factura || docData.memo_pago_nro_factura,
          memo_pago_proveedor: result.data.proveedor || docData.memo_pago_proveedor,
          memo_pago_monto_total: result.data.monto_total || docData.memo_pago_monto_total,
          memo_pago_monto_literal: result.data.monto_literal || docData.memo_pago_monto_literal,
          memo_pago_items: result.data.items || docData.memo_pago_items,
          memo_pago_banco_cite_solicitud:
            result.data.banco_cite_solicitud || docData.memo_pago_banco_cite_solicitud,
          memo_pago_banco_nombre: result.data.banco_nombre || docData.memo_pago_banco_nombre,
          memo_pago_banco_titular: result.data.banco_titular || docData.memo_pago_banco_titular,
          memo_pago_banco_cuenta: result.data.banco_cuenta || docData.memo_pago_banco_cuenta,
          memo_pago_conformidad_texto:
            result.data.conformidad_texto || docData.memo_pago_conformidad_texto,
        };
        setDocData(updated);
        onAdquisicionUpdated?.(updated);
        setSavedFeedback(true);
        setTimeout(() => setSavedFeedback(false), 3000);
      }
    } catch (err: any) {
      alert("Error al generar con IA: " + err.message);
    } finally {
      setIsAiProcessing(false);
    }
  };

  const handleSave = () => {
    onAdquisicionUpdated?.(docData);
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2500);
  };

  return (
    <div
      className={`flex flex-col space-y-4 ${
        isFullScreen ? "fixed inset-0 z-50 bg-surface p-4 overflow-y-auto" : "w-full"
      }`}
    >
      {/* Friendly Toolbar matching App Design Tokens */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3 shadow-md sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Direct 1-Click AI Generation */}
          <button
            onClick={handleGenerateWithAi}
            disabled={isAiProcessing}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white font-sans text-sm font-bold rounded shadow transition-all active:scale-95 disabled:opacity-50"
            title="Generar y estructurar el Memorándum de Pago con IA"
          >
            {isAiProcessing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-yellow-100" />
                <span>Generando Memorándum con IA...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-yellow-100" />
                <span>Generar con IA (1-Clic)</span>
              </>
            )}
          </button>

          {/* Direct Word Export Button */}
          <button
            onClick={() => onDownloadDocx(docData)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 text-on-primary font-sans text-sm font-semibold rounded shadow transition-all active:scale-95"
            title="Descargar memorándum en Word (.docx) oficial"
          >
            <Download className="w-4 h-4" />
            <span>Descargar Word (.docx)</span>
          </button>

          {/* Save Button */}
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-surface-container hover:bg-surface-container-high text-on-surface font-sans text-sm font-medium rounded border border-outline-variant transition-colors"
            title="Guardar cambios realizados en el memorándum"
          >
            {savedFeedback ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-700 dark:text-emerald-300 font-semibold">
                  ¡Guardado!
                </span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4 text-on-surface-variant" />
                <span>Guardar Cambios</span>
              </>
            )}
          </button>

          {/* Add Item Button */}
          <button
            onClick={handleAddItem}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-secondary-fixed hover:bg-secondary-fixed-dim text-on-secondary-fixed font-sans text-sm font-medium rounded transition-colors"
            title="Añadir una fila a la tabla de concepto"
          >
            <Plus className="w-4 h-4" />
            <span>Añadir Ítem</span>
          </button>
        </div>

        {/* Right: Badges & View Controls */}
        <div className="flex items-center gap-2 text-xs">
          <span className="hidden sm:inline-flex px-2.5 py-1 bg-primary-container text-on-primary-container font-mono text-[11px] rounded font-semibold border border-primary/20">
            Tamaño Carta (Letter)
          </span>
          <span className="hidden md:inline-flex px-2.5 py-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-medium rounded border border-emerald-500/20">
            100% Editable
          </span>

          <button
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="p-2 hover:bg-surface-container text-on-surface-variant rounded border border-outline-variant transition-colors"
            title={isFullScreen ? "Salir de pantalla completa" : "Pantalla completa"}
          >
            {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Central Workbench with Realistic Carta Sheet */}
      <div className="flex-1 bg-surface-container-low p-4 md:p-8 rounded-xl border border-outline-variant/60 overflow-x-auto flex justify-center shadow-inner">
        {/* Exact Carta Paper Sheet (8.5in x 11in standard scale) */}
        <div className="w-full max-w-[816px] min-h-[1056px] bg-white text-slate-900 shadow-2xl p-[48px] md:p-[64px] font-sans text-[13px] leading-relaxed border border-slate-300 relative rounded-sm flex flex-col justify-between">
          <div>
            {/* Header Document & Logo */}
            <div className="flex justify-between items-start border-b border-slate-300 pb-4 mb-6">
              <div className="flex items-center gap-3">
                <img
                  src="/logo-ende-deoruro.png"
                  alt="ENDE Deoruro"
                  className="h-12 w-auto object-contain"
                  onError={(e) => {
                    (e.target as any).style.display = "none";
                  }}
                />
                <div>
                  <h2 className="text-xs font-bold text-[#001E40] tracking-wide">
                    DISTRIBUIDORA DE ELECTRICIDAD ENDE DEORURO S.A.
                  </h2>
                  <p className="text-[10px] text-slate-500">Memorándum Institucional de Pago</p>
                </div>
              </div>
              <div className="text-right space-y-1">
                <div className="flex items-center justify-end gap-1">
                  <span className="text-xs font-bold text-[#003366]">No.</span>
                  <input
                    type="text"
                    value={docData.memo_pago_cite || ""}
                    onChange={(e) => handleFieldChange("memo_pago_cite", e.target.value)}
                    className="text-right text-xs font-bold text-[#003366] border-b border-dashed border-transparent hover:border-slate-400 focus:border-blue-500 focus:bg-blue-50/50 outline-none w-40 transition-colors"
                    placeholder="GG-SPA-26/070002"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    value={docData.memo_pago_fecha || ""}
                    onChange={(e) => handleFieldChange("memo_pago_fecha", e.target.value)}
                    className="text-right text-xs text-slate-600 border-b border-dashed border-transparent hover:border-slate-400 focus:border-blue-500 focus:bg-blue-50/50 outline-none w-44 transition-colors"
                    placeholder="Oruro, 23 de Julio de 2026"
                  />
                </div>
              </div>
            </div>

            {/* Destinatarios Table (A, DE, OBJETO) - Fully Editable */}
            <div className="grid grid-cols-[70px_1fr] gap-y-3 text-xs mb-6 bg-slate-50/80 p-4 rounded border border-slate-200">
              <span className="font-bold text-slate-800 pt-1">A:</span>
              <div className="space-y-0.5">
                <input
                  type="text"
                  value={docData.memo_pago_a_nombre || ""}
                  onChange={(e) => handleFieldChange("memo_pago_a_nombre", e.target.value)}
                  className="w-full font-bold text-slate-900 border-b border-dashed border-transparent hover:border-slate-400 focus:border-blue-500 focus:bg-white outline-none px-1 py-0.5 rounded transition-colors"
                  placeholder="LIC. VICENTE PAUL VEGA RAMIREZ"
                />
                <input
                  type="text"
                  value={docData.memo_pago_a_cargo || ""}
                  onChange={(e) => handleFieldChange("memo_pago_a_cargo", e.target.value)}
                  className="w-full text-slate-600 text-[11px] border-b border-dashed border-transparent hover:border-slate-400 focus:border-blue-500 focus:bg-white outline-none px-1 py-0.5 rounded transition-colors"
                  placeholder="SUPERINTENDENTE DE ADMINISTRACIÓN Y FINANZAS a.i."
                />
              </div>

              <span className="font-bold text-slate-800 pt-1">DE:</span>
              <div className="space-y-0.5">
                <input
                  type="text"
                  value={docData.memo_pago_de_nombre || ""}
                  onChange={(e) => handleFieldChange("memo_pago_de_nombre", e.target.value)}
                  className="w-full font-bold text-slate-900 border-b border-dashed border-transparent hover:border-slate-400 focus:border-blue-500 focus:bg-white outline-none px-1 py-0.5 rounded transition-colors"
                  placeholder="ING. TATIANA TORRES ANDRADE"
                />
                <input
                  type="text"
                  value={docData.memo_pago_de_cargo || ""}
                  onChange={(e) => handleFieldChange("memo_pago_de_cargo", e.target.value)}
                  className="w-full text-slate-600 text-[11px] border-b border-dashed border-transparent hover:border-slate-400 focus:border-blue-500 focus:bg-white outline-none px-1 py-0.5 rounded transition-colors"
                  placeholder="SUPERVISOR DE SEGURIDAD INDUSTRIAL a.i."
                />
              </div>

              <span className="font-bold text-slate-800 pt-1">OBJETO:</span>
              <div>
                <textarea
                  rows={2}
                  value={docData.memo_pago_objeto || ""}
                  onChange={(e) => handleFieldChange("memo_pago_objeto", e.target.value)}
                  className="w-full font-bold text-slate-900 border-b border-dashed border-transparent hover:border-slate-400 focus:border-blue-500 focus:bg-white outline-none px-1 py-0.5 rounded text-xs leading-relaxed transition-colors uppercase resize-y"
                  placeholder="SOLICITUD DE PAGO..."
                />
              </div>
            </div>

            {/* Solicitud de Pago Paragraph */}
            <div className="text-xs leading-relaxed text-justify mb-5 text-slate-800 bg-white">
              <div className="flex flex-wrap items-center gap-1.5">
                <span>Solicitamos instruir el pago de la</span>
                <span className="font-bold">Factura N°</span>
                <input
                  type="text"
                  value={docData.memo_pago_nro_factura || ""}
                  onChange={(e) => handleFieldChange("memo_pago_nro_factura", e.target.value)}
                  className="font-bold text-slate-900 border-b border-dashed border-slate-400 focus:border-blue-500 outline-none px-1 py-0.5 w-16 text-center"
                  placeholder="2"
                />
                <span>al proveedor</span>
                <input
                  type="text"
                  value={docData.memo_pago_proveedor || ""}
                  onChange={(e) => handleFieldChange("memo_pago_proveedor", e.target.value)}
                  className="font-bold text-slate-950 border-b border-dashed border-slate-400 focus:border-blue-500 outline-none px-1 py-0.5 w-44"
                  placeholder="MOVICLEAN S.R.L."
                />
                <span>por un monto total de</span>
                <span className="font-bold">Bs</span>
                <input
                  type="number"
                  value={docData.memo_pago_monto_total || 0}
                  onChange={(e) => handleFieldChange("memo_pago_monto_total", parseFloat(e.target.value) || 0)}
                  className="font-bold text-slate-950 border-b border-dashed border-slate-400 focus:border-blue-500 outline-none px-1 py-0.5 w-28 text-right"
                />
                <span>(</span>
                <input
                  type="text"
                  value={docData.memo_pago_monto_literal || ""}
                  onChange={(e) => handleFieldChange("memo_pago_monto_literal", e.target.value)}
                  className="font-bold text-slate-900 border-b border-dashed border-slate-400 focus:border-blue-500 outline-none px-1 py-0.5 w-72"
                  placeholder="Monto en literal..."
                />
                <span>), por el concepto de:</span>
              </div>
            </div>

            {/* Concept / Items Table (Fully Editable with Add/Remove) */}
            <div className="mb-6 overflow-hidden border border-slate-300 rounded shadow-sm">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-[#001E40] text-white">
                    <th className="p-2.5 border border-slate-400 text-center w-20">CANT.</th>
                    <th className="p-2.5 border border-slate-400 text-center w-36">UNIDAD</th>
                    <th className="p-2.5 border border-slate-400">DESCRIPCIÓN</th>
                    <th className="p-2.5 border border-slate-400 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {(docData.memo_pago_items || []).map((it, idx) => (
                    <tr key={idx} className={idx % 2 === 1 ? "bg-slate-50/70" : "bg-white"}>
                      <td className="p-2 border border-slate-300">
                        <input
                          type="text"
                          value={it.cantidad}
                          onChange={(e) => handleItemChange(idx, "cantidad", e.target.value)}
                          className="w-full text-center font-bold text-slate-900 border-b border-dashed border-transparent hover:border-slate-400 focus:border-blue-500 focus:bg-white outline-none px-1 py-0.5"
                        />
                      </td>
                      <td className="p-2 border border-slate-300">
                        <input
                          type="text"
                          value={it.unidad}
                          onChange={(e) => handleItemChange(idx, "unidad", e.target.value)}
                          className="w-full text-center text-slate-700 border-b border-dashed border-transparent hover:border-slate-400 focus:border-blue-500 focus:bg-white outline-none px-1 py-0.5"
                        />
                      </td>
                      <td className="p-2 border border-slate-300">
                        <input
                          type="text"
                          value={it.descripcion}
                          onChange={(e) => handleItemChange(idx, "descripcion", e.target.value)}
                          className="w-full font-medium text-slate-900 border-b border-dashed border-transparent hover:border-slate-400 focus:border-blue-500 focus:bg-white outline-none px-1 py-0.5"
                        />
                      </td>
                      <td className="p-2 border border-slate-300 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 text-red-400 hover:text-red-600 transition-colors"
                          title="Eliminar fila"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Datos Bancarios Box (Fully Editable) */}
            <div className="mb-5 bg-slate-50/80 p-4 rounded-lg border border-slate-200 text-xs space-y-2">
              <div className="flex flex-wrap items-center gap-1.5 font-bold text-slate-900">
                <CreditCard className="w-4 h-4 text-[#003366]" />
                <span>Datos Bancarios para Transferencia (solicitados mediante</span>
                <input
                  type="text"
                  value={docData.memo_pago_banco_cite_solicitud || ""}
                  onChange={(e) => handleFieldChange("memo_pago_banco_cite_solicitud", e.target.value)}
                  className="font-bold text-slate-900 border-b border-dashed border-slate-400 focus:border-blue-500 outline-none px-1 py-0.5 w-64"
                />
                <span>):</span>
              </div>
              <div className="pl-6 space-y-2 text-slate-800">
                <div className="flex items-center gap-2">
                  <span className="font-bold w-36">• Entidad Bancaria:</span>
                  <input
                    type="text"
                    value={docData.memo_pago_banco_nombre || ""}
                    onChange={(e) => handleFieldChange("memo_pago_banco_nombre", e.target.value)}
                    className="flex-1 font-medium text-slate-900 border-b border-dashed border-slate-300 hover:border-slate-400 focus:border-blue-500 outline-none px-1 py-0.5"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold w-36">• Titular de la Cuenta:</span>
                  <input
                    type="text"
                    value={docData.memo_pago_banco_titular || ""}
                    onChange={(e) => handleFieldChange("memo_pago_banco_titular", e.target.value)}
                    className="flex-1 font-medium text-slate-900 border-b border-dashed border-slate-300 hover:border-slate-400 focus:border-blue-500 outline-none px-1 py-0.5"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold w-36">• Número de Cuenta:</span>
                  <input
                    type="text"
                    value={docData.memo_pago_banco_cuenta || ""}
                    onChange={(e) => handleFieldChange("memo_pago_banco_cuenta", e.target.value)}
                    className="flex-1 font-mono font-bold text-slate-950 border-b border-dashed border-slate-300 hover:border-slate-400 focus:border-blue-500 outline-none px-1 py-0.5"
                  />
                </div>
              </div>
            </div>

            {/* Conformidad del Servicio */}
            <div className="text-xs leading-relaxed text-justify mb-5 text-slate-800">
              <textarea
                rows={2}
                value={docData.memo_pago_conformidad_texto || ""}
                onChange={(e) => handleFieldChange("memo_pago_conformidad_texto", e.target.value)}
                className="w-full border-b border-dashed border-transparent hover:border-slate-400 focus:border-blue-500 outline-none px-1 py-0.5 text-xs resize-y"
              />
            </div>

            <p className="text-xs text-slate-700 mb-6">
              En cuanto tenemos a bien informar, para los fines consiguientes.
            </p>

            <p className="text-xs font-semibold text-slate-900 mb-8">Atentamente,</p>
          </div>

          {/* Firma Block at Bottom of Carta Sheet */}
          <div className="text-center text-xs w-64 mx-auto pt-4 border-t border-slate-300">
            <input
              type="text"
              value={docData.memo_pago_de_nombre || ""}
              onChange={(e) => handleFieldChange("memo_pago_de_nombre", e.target.value)}
              className="w-full text-center font-bold text-slate-900 border-b border-dashed border-transparent hover:border-slate-400 focus:border-blue-500 outline-none"
            />
            <input
              type="text"
              value={docData.memo_pago_de_cargo || ""}
              onChange={(e) => handleFieldChange("memo_pago_de_cargo", e.target.value)}
              className="w-full text-center text-[10px] text-slate-500 border-b border-dashed border-transparent hover:border-slate-400 focus:border-blue-500 outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
