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
  const [activeTab, setActiveTab] = useState<"preview" | "edit">("preview");

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
      `Así mismo, informamos que el proveedor ha cumplido satisfactoriamente con la prestación del servicio/adquisición contratado.`,
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
      unidad: "Unidad",
      descripcion: "CONCEPTO O ÍTEM DE ADQUISICIÓN",
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
        if (onAdquisicionUpdated) onAdquisicionUpdated(updated);
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
    if (onAdquisicionUpdated) {
      onAdquisicionUpdated(docData);
    }
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 3000);
  };

  return (
    <div
      className={`bg-slate-900 border border-slate-800 rounded-2xl flex flex-col transition-all duration-300 ${
        isFullScreen ? "fixed inset-4 z-50 shadow-2xl" : "h-[850px]"
      }`}
    >
      {/* Header Bar */}
      <div className="px-6 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 bg-slate-950/40 rounded-t-2xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
            <ReceiptText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-100 text-base">
                Carpeta 8: Memorándum de Solicitud de Pago
              </h3>
              <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">
                Word Oficial
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Solicitud formal de pago, detalle de facturación, datos de transferencia bancaria y conformidad
            </p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/50 text-xs">
          <button
            onClick={() => setActiveTab("preview")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === "preview"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Vista Previa (A4)
          </button>
          <button
            onClick={() => setActiveTab("edit")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === "edit"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Editar Datos
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerateWithAi}
            disabled={isAiProcessing}
            className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-purple-900/20 transition-all disabled:opacity-50"
          >
            {isAiProcessing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 text-yellow-300" />
            )}
            <span>{isAiProcessing ? "Procesando..." : "Generar con IA"}</span>
          </button>

          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium border border-slate-700 transition-colors"
          >
            {savedFeedback ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <Save className="w-4 h-4 text-slate-400" />
            )}
            <span>{savedFeedback ? "¡Guardado!" : "Guardar"}</span>
          </button>

          <button
            onClick={() => onDownloadDocx(docData)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-900/20 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Descargar Word (.docx)</span>
          </button>

          <button
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="p-2 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-xl border border-slate-800 transition-colors"
            title={isFullScreen ? "Salir de pantalla completa" : "Pantalla completa"}
          >
            {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 bg-slate-950/50">
        {activeTab === "preview" ? (
          /* A4 Sheet Preview */
          <div className="max-w-3xl mx-auto bg-white text-slate-900 shadow-2xl rounded-sm p-12 font-sans text-sm border border-slate-300">
            {/* Header Document */}
            <div className="flex justify-between items-start border-b border-slate-300 pb-4 mb-8">
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
                  <p className="text-[11px] text-slate-500">Memorándum Oficial</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-[#003366]">No. {docData.memo_pago_cite}</p>
                <p className="text-xs text-slate-600">{docData.memo_pago_fecha}</p>
              </div>
            </div>

            {/* Destinatarios Box */}
            <div className="grid grid-cols-[80px_1fr] gap-y-3 text-xs mb-8 bg-slate-50 p-5 rounded border border-slate-200">
              <span className="font-bold text-slate-800">A:</span>
              <div>
                <p className="font-bold text-slate-900">{docData.memo_pago_a_nombre}</p>
                <p className="text-slate-600">{docData.memo_pago_a_cargo}</p>
              </div>

              <span className="font-bold text-slate-800">DE:</span>
              <div>
                <p className="font-bold text-slate-900">{docData.memo_pago_de_nombre}</p>
                <p className="text-slate-600">{docData.memo_pago_de_cargo}</p>
              </div>

              <span className="font-bold text-slate-800">OBJETO:</span>
              <div className="font-bold text-slate-900 leading-relaxed uppercase">
                {docData.memo_pago_objeto}
              </div>
            </div>

            {/* Solicitud de Pago Text */}
            <div className="text-xs leading-relaxed text-justify mb-6 text-slate-800">
              <p>
                Solicitamos instruir el pago de la <strong>Factura N° {docData.memo_pago_nro_factura}</strong> al
                proveedor <strong>{docData.memo_pago_proveedor}</strong> por un monto total de{" "}
                <strong className="text-slate-950">
                  Bs{" "}
                  {Number(docData.memo_pago_monto_total || 0).toLocaleString("es-BO", {
                    minimumFractionDigits: 2,
                  })}{" "}
                  ({docData.memo_pago_monto_literal})
                </strong>
                , por el concepto de:
              </p>
            </div>

            {/* Items Table */}
            <div className="mb-8 overflow-hidden border border-slate-300 rounded">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-[#001E40] text-white">
                    <th className="p-2.5 border border-slate-400 text-center w-20">CANT.</th>
                    <th className="p-2.5 border border-slate-400 text-center w-36">UNIDAD</th>
                    <th className="p-2.5 border border-slate-400">DESCRIPCIÓN</th>
                  </tr>
                </thead>
                <tbody>
                  {(docData.memo_pago_items || []).map((item, idx) => (
                    <tr key={idx} className={idx % 2 === 1 ? "bg-slate-50" : "bg-white"}>
                      <td className="p-2.5 border border-slate-300 text-center font-bold">
                        {item.cantidad}
                      </td>
                      <td className="p-2.5 border border-slate-300 text-center text-slate-700">
                        {item.unidad}
                      </td>
                      <td className="p-2.5 border border-slate-300 font-medium text-slate-900">
                        {item.descripcion}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Datos Bancarios Box */}
            <div className="mb-6 bg-slate-50 p-5 rounded-lg border border-slate-200 text-xs space-y-2">
              <p className="font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#003366]" />
                Datos Bancarios para Transferencia ({docData.memo_pago_banco_cite_solicitud}):
              </p>
              <div className="pl-6 space-y-1.5 text-slate-800">
                <p>
                  • <strong>Entidad Bancaria:</strong> {docData.memo_pago_banco_nombre}
                </p>
                <p>
                  • <strong>Titular de la Cuenta:</strong> {docData.memo_pago_banco_titular}
                </p>
                <p>
                  • <strong>Número de Cuenta:</strong>{" "}
                  <span className="font-mono font-bold text-slate-900">
                    {docData.memo_pago_banco_cuenta}
                  </span>
                </p>
              </div>
            </div>

            {/* Conformidad */}
            <div className="text-xs leading-relaxed text-justify mb-6 text-slate-800">
              <p>{docData.memo_pago_conformidad_texto}</p>
            </div>

            <p className="text-xs text-slate-700 mb-12">
              En cuanto tenemos a bien informar, para los fines consiguientes.
            </p>

            <p className="text-xs font-semibold text-slate-900 mb-16">Atentamente,</p>

            {/* Firma */}
            <div className="text-center text-xs w-64 mx-auto pt-6 border-t border-slate-300">
              <p className="font-bold text-slate-900">{docData.memo_pago_de_nombre}</p>
              <p className="text-slate-600">{docData.memo_pago_de_cargo}</p>
            </div>
          </div>
        ) : (
          /* Form Editor Tab */
          <div className="max-w-4xl mx-auto space-y-6 text-slate-200 text-xs">
            {/* Header Data */}
            <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-4">
              <h4 className="font-semibold text-slate-100 text-sm flex items-center gap-2">
                <ReceiptText className="w-4 h-4 text-emerald-400" />
                Datos del Memorándum y Destinatarios
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1">CITE Memorándum</label>
                  <input
                    type="text"
                    value={docData.memo_pago_cite || ""}
                    onChange={(e) => handleFieldChange("memo_pago_cite", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Fecha</label>
                  <input
                    type="text"
                    value={docData.memo_pago_fecha || ""}
                    onChange={(e) => handleFieldChange("memo_pago_fecha", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-slate-400 mb-1">A (Destinatario)</label>
                  <input
                    type="text"
                    value={docData.memo_pago_a_nombre || ""}
                    onChange={(e) => handleFieldChange("memo_pago_a_nombre", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 mb-1"
                  />
                  <input
                    type="text"
                    value={docData.memo_pago_a_cargo || ""}
                    onChange={(e) => handleFieldChange("memo_pago_a_cargo", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-400 text-[11px]"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">DE (Remitente)</label>
                  <input
                    type="text"
                    value={docData.memo_pago_de_nombre || ""}
                    onChange={(e) => handleFieldChange("memo_pago_de_nombre", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 mb-1"
                  />
                  <input
                    type="text"
                    value={docData.memo_pago_de_cargo || ""}
                    onChange={(e) => handleFieldChange("memo_pago_de_cargo", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-400 text-[11px]"
                  />
                </div>
              </div>
            </div>

            {/* Facturación y Monto */}
            <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-4">
              <h4 className="font-semibold text-slate-100 text-sm flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-400" />
                Facturación y Monto de Pago
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1">Factura N°</label>
                  <input
                    type="text"
                    value={docData.memo_pago_nro_factura || ""}
                    onChange={(e) => handleFieldChange("memo_pago_nro_factura", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Proveedor / Titular</label>
                  <input
                    type="text"
                    value={docData.memo_pago_proveedor || ""}
                    onChange={(e) => handleFieldChange("memo_pago_proveedor", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Monto Total (Bs)</label>
                  <input
                    type="number"
                    value={docData.memo_pago_monto_total || 0}
                    onChange={(e) =>
                      handleFieldChange("memo_pago_monto_total", parseFloat(e.target.value) || 0)
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Monto en Literal</label>
                <input
                  type="text"
                  value={docData.memo_pago_monto_literal || ""}
                  onChange={(e) => handleFieldChange("memo_pago_monto_literal", e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100"
                />
              </div>
            </div>

            {/* Datos Bancarios */}
            <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-4">
              <h4 className="font-semibold text-slate-100 text-sm flex items-center gap-2">
                <Building className="w-4 h-4 text-emerald-400" />
                Datos Bancarios para Transferencia
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1">Entidad Bancaria</label>
                  <input
                    type="text"
                    value={docData.memo_pago_banco_nombre || ""}
                    onChange={(e) => handleFieldChange("memo_pago_banco_nombre", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Número de Cuenta</label>
                  <input
                    type="text"
                    value={docData.memo_pago_banco_cuenta || ""}
                    onChange={(e) => handleFieldChange("memo_pago_banco_cuenta", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Titular de la Cuenta</label>
                  <input
                    type="text"
                    value={docData.memo_pago_banco_titular || ""}
                    onChange={(e) => handleFieldChange("memo_pago_banco_titular", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">CITE Solicitud Bancaria</label>
                  <input
                    type="text"
                    value={docData.memo_pago_banco_cite_solicitud || ""}
                    onChange={(e) =>
                      handleFieldChange("memo_pago_banco_cite_solicitud", e.target.value)
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Items Table Editor */}
            <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-semibold text-slate-100 text-sm flex items-center gap-2">
                  <ReceiptText className="w-4 h-4 text-purple-400" />
                  Concepto del Servicio / Adquisición
                </h4>
                <button
                  onClick={handleAddItem}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Añadir Fila</span>
                </button>
              </div>

              <div className="space-y-3">
                {(docData.memo_pago_items || []).map((it, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-950 rounded-xl border border-slate-800 grid grid-cols-[100px_140px_1fr_40px] gap-3 items-center"
                  >
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5">Cantidad</label>
                      <input
                        type="text"
                        value={it.cantidad}
                        onChange={(e) => handleItemChange(idx, "cantidad", e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-slate-100 text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5">Unidad</label>
                      <input
                        type="text"
                        value={it.unidad}
                        onChange={(e) => handleItemChange(idx, "unidad", e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-slate-100 text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5">Descripción</label>
                      <input
                        type="text"
                        value={it.descripcion}
                        onChange={(e) => handleItemChange(idx, "descripcion", e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-slate-100 font-medium"
                      />
                    </div>
                    <div className="pt-3">
                      <button
                        onClick={() => handleRemoveItem(idx)}
                        className="p-1.5 text-red-400 hover:text-red-300 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
