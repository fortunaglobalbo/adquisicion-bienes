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
  FileCheck,
  Building2,
  Check,
  Layers,
} from "lucide-react";
import { getFechaTextoActual } from "@/lib/utils/dateUtils";

interface InformeConformidadViewerProps {
  adquisicion: Adquisicion;
  onDownloadDocx: (liveData?: Adquisicion) => void;
  onAdquisicionUpdated?: (updated: Adquisicion) => void;
}

export const InformeConformidadViewer: React.FC<InformeConformidadViewerProps> = ({
  adquisicion,
  onDownloadDocx,
  onAdquisicionUpdated,
}) => {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  const [docData, setDocData] = useState<Adquisicion>({
    ...adquisicion,
    informe_conf_formulario: adquisicion.informe_conf_formulario || "FORMULARIO A6-N014",
    informe_conf_fecha: adquisicion.informe_conf_fecha || getFechaTextoActual(),
    informe_conf_cite: adquisicion.informe_conf_cite || "INF.DE ORURO N.º 021/2026",
    informe_conf_a_nombre: adquisicion.informe_conf_a_nombre || "Lic. VICENTE PAUL VEGA RAMIREZ",
    informe_conf_a_cargo:
      adquisicion.informe_conf_a_cargo || "SUPERINTENDENCIA DE ADMINISTRACIÓN & FINANZAS",
    informe_conf_via_nombre:
      adquisicion.informe_conf_via_nombre || "Lic. RAÚL ALBERTO TORRICO GÓMEZ",
    informe_conf_via_cargo: adquisicion.informe_conf_via_cargo || "GERENTE GENERAL",
    informe_conf_de_nombre:
      adquisicion.informe_conf_de_nombre || "Ing. TATIANA TORRES ANDRADE",
    informe_conf_de_cargo:
      adquisicion.informe_conf_de_cargo || "SUPERVISOR SEGURIDAD INDUSTRIAL",
    informe_conf_proceso:
      adquisicion.informe_conf_proceso ||
      `REMISIÓN DE INFORME TÉCNICO DE EVALUACIÓN DE COTIZACIONES Y SOLICITUD DE ADJUDICACIÓN - PROCESO "${(adquisicion.titulo_proceso || "ADQUISICIÓN DE BIENES").toUpperCase()}" (${adquisicion.solicitud_inicio_numero ? `Solicitud No. ${adquisicion.solicitud_inicio_numero}` : "Solicitud No. 028/2026 S.I."})`,
    informe_conf_antecedentes_fecha:
      adquisicion.informe_conf_antecedentes_fecha || "24/06/2026",
    informe_conf_antecedentes_nota:
      adquisicion.informe_conf_antecedentes_nota || "Nota No. 057/2026",
    informe_conf_prevision_precio:
      adquisicion.informe_conf_prevision_precio || adquisicion.prevision_presupuesto || 109000.0,
    informe_conf_empresa_ganadora:
      adquisicion.informe_conf_empresa_ganadora || "ARIOL",
    informe_conf_monto_adjudicado:
      adquisicion.informe_conf_monto_adjudicado || 67240.0,
    informe_conf_monto_adjudicado_literal:
      adquisicion.informe_conf_monto_adjudicado_literal ||
      "Sesenta y Siete Mil Doscientos Cuarenta 00/100 Bolivianos",
    informe_conf_proponentes:
      adquisicion.informe_conf_proponentes && adquisicion.informe_conf_proponentes.length > 0
        ? adquisicion.informe_conf_proponentes
        : [
            {
              numero: 1,
              empresa: "MULTI ENERGÍA",
              cotizacion_detalle:
                "Fechas solicitud de cotización: 10/07/2026\nCotización cumple con lo solicitado, de acuerdo a las especificaciones técnicas enviadas",
              precio: "Bs 70.000,00",
              actividad_economica: "No envía NIT",
              cumple_tecnico: true,
              cumple_legal: false,
              es_ganador: false,
              observacion: "No acreditó NIT",
            },
            {
              numero: 2,
              empresa: "HERRACRUZ",
              cotizacion_detalle: "Fechas solicitud de cotización: 10/07/2026\nNo envía cotización.",
              precio: "No envía propuesta",
              actividad_economica: "-",
              cumple_tecnico: false,
              cumple_legal: false,
              es_ganador: false,
              observacion: "No presentó propuesta",
            },
            {
              numero: 3,
              empresa: "ARIOL",
              cotizacion_detalle:
                "Fechas solicitud de cotización: 10/07/2026\nCotización cumple con lo solicitado, de acuerdo a las especificaciones técnicas enviadas",
              precio: "Bs 67.240,00",
              actividad_economica:
                "NIT: 6119531015\nActividad Económica: Comercialización y provisión de bienes",
              cumple_tecnico: true,
              cumple_legal: true,
              es_ganador: true,
              observacion: "Oferta habilitada con menor precio ofertado",
            },
            {
              numero: 4,
              empresa: "FEMCO",
              cotizacion_detalle: "Fechas solicitud de cotización: 10/07/2026\nNo envía cotización.",
              precio: "No envía propuesta",
              actividad_economica: "-",
              cumple_tecnico: false,
              cumple_legal: false,
              es_ganador: false,
              observacion: "No presentó propuesta",
            },
          ],
  });

  const handleFieldChange = (field: keyof Adquisicion, value: any) => {
    setDocData((prev) => ({ ...prev, [field]: value }));
  };

  const handleProponenteChange = (index: number, field: string, value: any) => {
    const list = [...(docData.informe_conf_proponentes || [])];
    list[index] = { ...list[index], [field]: value };
    setDocData((prev) => ({ ...prev, informe_conf_proponentes: list }));
  };

  const handleSetGanador = (index: number) => {
    const list = (docData.informe_conf_proponentes || []).map((p, idx) => ({
      ...p,
      es_ganador: idx === index,
    }));
    const ganador = list[index];
    setDocData((prev) => ({
      ...prev,
      informe_conf_proponentes: list,
      informe_conf_empresa_ganadora: ganador ? ganador.empresa : prev.informe_conf_empresa_ganadora,
      informe_conf_monto_adjudicado:
        typeof ganador?.precio === "number"
          ? ganador.precio
          : parseFloat(String(ganador?.precio || "").replace(/[^0-9.]/g, "")) || prev.informe_conf_monto_adjudicado,
    }));
  };

  const handleAddProponente = () => {
    const list = [...(docData.informe_conf_proponentes || [])];
    list.push({
      numero: list.length + 1,
      empresa: "NUEVA EMPRESA S.R.L.",
      cotizacion_detalle: "Cotización cumple con especificaciones técnicas enviadas",
      precio: "Bs 0.00",
      actividad_economica: "NIT: 0000000000",
      cumple_tecnico: true,
      cumple_legal: true,
      es_ganador: false,
    });
    setDocData((prev) => ({ ...prev, informe_conf_proponentes: list }));
  };

  const handleRemoveProponente = (index: number) => {
    const list = (docData.informe_conf_proponentes || [])
      .filter((_, idx) => idx !== index)
      .map((p, i) => ({ ...p, numero: i + 1 }));
    setDocData((prev) => ({ ...prev, informe_conf_proponentes: list }));
  };

  const handleGenerateWithAi = async () => {
    setIsAiProcessing(true);
    try {
      const res = await fetch("/api/ai/generate-informe-conformidad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adquisicion: docData }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Error al procesar con IA");

      if (result.data) {
        const updated: Adquisicion = {
          ...docData,
          informe_conf_formulario: result.data.formulario || docData.informe_conf_formulario,
          informe_conf_fecha: result.data.fecha || docData.informe_conf_fecha,
          informe_conf_cite: result.data.cite || docData.informe_conf_cite,
          informe_conf_a_nombre: result.data.a_nombre || docData.informe_conf_a_nombre,
          informe_conf_a_cargo: result.data.a_cargo || docData.informe_conf_a_cargo,
          informe_conf_via_nombre: result.data.via_nombre || docData.informe_conf_via_nombre,
          informe_conf_via_cargo: result.data.via_cargo || docData.informe_conf_via_cargo,
          informe_conf_de_nombre: result.data.de_nombre || docData.informe_conf_de_nombre,
          informe_conf_de_cargo: result.data.de_cargo || docData.informe_conf_de_cargo,
          informe_conf_proceso: result.data.proceso || docData.informe_conf_proceso,
          informe_conf_antecedentes_fecha: result.data.antecedentes_fecha || docData.informe_conf_antecedentes_fecha,
          informe_conf_antecedentes_nota: result.data.antecedentes_nota || docData.informe_conf_antecedentes_nota,
          informe_conf_prevision_precio: result.data.prevision_precio || docData.informe_conf_prevision_precio,
          informe_conf_proponentes: result.data.proponentes || docData.informe_conf_proponentes,
          informe_conf_empresa_ganadora: result.data.empresa_ganadora || docData.informe_conf_empresa_ganadora,
          informe_conf_monto_adjudicado: result.data.monto_adjudicado || docData.informe_conf_monto_adjudicado,
          informe_conf_monto_adjudicado_literal: result.data.monto_adjudicado_literal || docData.informe_conf_monto_adjudicado_literal,
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
            title="Generar y redactar automáticamente el Informe de Conformidad con IA"
          >
            {isAiProcessing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-yellow-100" />
                <span>Analizando ofertas con IA...</span>
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
            title="Descargar documento Word (.docx) oficial"
          >
            <Download className="w-4 h-4" />
            <span>Descargar Word (.docx)</span>
          </button>

          {/* Save Button */}
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-surface-container hover:bg-surface-container-high text-on-surface font-sans text-sm font-medium rounded border border-outline-variant transition-colors"
            title="Guardar cambios realizados en el documento"
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

          {/* Add Proponente Button */}
          <button
            onClick={handleAddProponente}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-secondary-fixed hover:bg-secondary-fixed-dim text-on-secondary-fixed font-sans text-sm font-medium rounded transition-colors"
            title="Añadir una empresa proponente al cuadro comparativo"
          >
            <Plus className="w-4 h-4" />
            <span>Añadir Proponente</span>
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
        <div className="w-full max-w-[816px] min-h-[1056px] bg-white text-slate-900 shadow-2xl p-[40px] md:p-[56px] font-sans text-[13px] leading-relaxed border border-slate-300 relative rounded-sm flex flex-col justify-between">
          <div>
            {/* Header Document & Logo */}
            <div className="flex justify-between items-start border-b border-slate-300 pb-3 mb-5">
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
                  <p className="text-[10px] text-slate-500">Sistema Oficial de Contrataciones</p>
                </div>
              </div>
              <div className="text-right space-y-1">
                <input
                  type="text"
                  value={docData.informe_conf_formulario || ""}
                  onChange={(e) => handleFieldChange("informe_conf_formulario", e.target.value)}
                  className="text-right text-xs font-bold text-slate-700 border-b border-dashed border-transparent hover:border-slate-400 focus:border-blue-500 focus:bg-blue-50/50 outline-none w-48 transition-colors"
                  placeholder="FORMULARIO A6-N014"
                />
                <div>
                  <input
                    type="text"
                    value={docData.informe_conf_fecha || ""}
                    onChange={(e) => handleFieldChange("informe_conf_fecha", e.target.value)}
                    className="text-right text-xs text-slate-600 border-b border-dashed border-transparent hover:border-slate-400 focus:border-blue-500 focus:bg-blue-50/50 outline-none w-48 transition-colors"
                    placeholder="Oruro, 29 de julio de 2026"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    value={docData.informe_conf_cite || ""}
                    onChange={(e) => handleFieldChange("informe_conf_cite", e.target.value)}
                    className="text-right text-xs font-bold text-[#003366] border-b border-dashed border-transparent hover:border-slate-400 focus:border-blue-500 focus:bg-blue-50/50 outline-none w-48 transition-colors"
                    placeholder="INF.DE ORURO N.º 021/2026"
                  />
                </div>
              </div>
            </div>

            {/* Document Title */}
            <div className="text-center my-4">
              <h1 className="text-[15px] font-extrabold text-[#001E40] uppercase tracking-wider">
                INFORME DE CONFORMIDAD
              </h1>
              <p className="text-xs font-bold text-slate-600 tracking-wide">(CONTRATACIONES)</p>
            </div>

            {/* Destinatarios Table (A, VIA, DE, PROCESO) - Fully Editable */}
            <div className="grid grid-cols-[70px_1fr] gap-y-2 text-xs mb-5 bg-slate-50/80 p-3.5 rounded border border-slate-200">
              <span className="font-bold text-slate-800 pt-1">A:</span>
              <div className="space-y-0.5">
                <input
                  type="text"
                  value={docData.informe_conf_a_nombre || ""}
                  onChange={(e) => handleFieldChange("informe_conf_a_nombre", e.target.value)}
                  className="w-full font-bold text-slate-900 border-b border-dashed border-transparent hover:border-slate-400 focus:border-blue-500 focus:bg-white outline-none px-1 py-0.5 rounded transition-colors"
                  placeholder="Lic. VICENTE PAUL VEGA RAMIREZ"
                />
                <input
                  type="text"
                  value={docData.informe_conf_a_cargo || ""}
                  onChange={(e) => handleFieldChange("informe_conf_a_cargo", e.target.value)}
                  className="w-full text-slate-600 text-[11px] border-b border-dashed border-transparent hover:border-slate-400 focus:border-blue-500 focus:bg-white outline-none px-1 py-0.5 rounded transition-colors"
                  placeholder="SUPERINTENDENCIA DE ADMINISTRACIÓN & FINANZAS"
                />
              </div>

              <span className="font-bold text-slate-800 pt-1">VIA:</span>
              <div className="space-y-0.5">
                <input
                  type="text"
                  value={docData.informe_conf_via_nombre || ""}
                  onChange={(e) => handleFieldChange("informe_conf_via_nombre", e.target.value)}
                  className="w-full font-bold text-slate-900 border-b border-dashed border-transparent hover:border-slate-400 focus:border-blue-500 focus:bg-white outline-none px-1 py-0.5 rounded transition-colors"
                  placeholder="Lic. RAÚL ALBERTO TORRICO GÓMEZ"
                />
                <input
                  type="text"
                  value={docData.informe_conf_via_cargo || ""}
                  onChange={(e) => handleFieldChange("informe_conf_via_cargo", e.target.value)}
                  className="w-full text-slate-600 text-[11px] border-b border-dashed border-transparent hover:border-slate-400 focus:border-blue-500 focus:bg-white outline-none px-1 py-0.5 rounded transition-colors"
                  placeholder="GERENTE GENERAL"
                />
              </div>

              <span className="font-bold text-slate-800 pt-1">De:</span>
              <div className="space-y-0.5">
                <input
                  type="text"
                  value={docData.informe_conf_de_nombre || ""}
                  onChange={(e) => handleFieldChange("informe_conf_de_nombre", e.target.value)}
                  className="w-full font-bold text-slate-900 border-b border-dashed border-transparent hover:border-slate-400 focus:border-blue-500 focus:bg-white outline-none px-1 py-0.5 rounded transition-colors"
                  placeholder="Ing. TATIANA TORRES ANDRADE"
                />
                <input
                  type="text"
                  value={docData.informe_conf_de_cargo || ""}
                  onChange={(e) => handleFieldChange("informe_conf_de_cargo", e.target.value)}
                  className="w-full text-slate-600 text-[11px] border-b border-dashed border-transparent hover:border-slate-400 focus:border-blue-500 focus:bg-white outline-none px-1 py-0.5 rounded transition-colors"
                  placeholder="SUPERVISOR SEGURIDAD INDUSTRIAL"
                />
              </div>

              <span className="font-bold text-slate-800 pt-1">PROCESO:</span>
              <div>
                <textarea
                  rows={2}
                  value={docData.informe_conf_proceso || ""}
                  onChange={(e) => handleFieldChange("informe_conf_proceso", e.target.value)}
                  className="w-full font-bold text-slate-900 border-b border-dashed border-transparent hover:border-slate-400 focus:border-blue-500 focus:bg-white outline-none px-1 py-0.5 rounded text-xs leading-relaxed transition-colors resize-y"
                  placeholder="REMISIÓN DE INFORME TÉCNICO DE EVALUACIÓN DE COTIZACIONES..."
                />
              </div>
            </div>

            {/* Subtitle */}
            <div className="text-center mb-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase underline tracking-wide">
                INFORME TÉCNICO DE EVALUACIÓN DE OFERTAS Y CUADRO COMPARATIVO
              </h3>
            </div>

            {/* Antecedentes Section */}
            <div className="mb-3 text-xs text-slate-800 space-y-1">
              <h4 className="font-bold text-slate-900">ANTECEDENTES</h4>
              <div className="flex flex-wrap items-center gap-1.5 leading-relaxed">
                <span>En fecha</span>
                <input
                  type="text"
                  value={docData.informe_conf_antecedentes_fecha || ""}
                  onChange={(e) => handleFieldChange("informe_conf_antecedentes_fecha", e.target.value)}
                  className="font-bold text-slate-900 border-b border-dashed border-slate-400 focus:border-blue-500 outline-none px-1 py-0.5 w-24 text-center"
                />
                <span>, mediante Formulario S1-N014 y</span>
                <input
                  type="text"
                  value={docData.informe_conf_antecedentes_nota || ""}
                  onChange={(e) => handleFieldChange("informe_conf_antecedentes_nota", e.target.value)}
                  className="font-bold text-slate-900 border-b border-dashed border-slate-400 focus:border-blue-500 outline-none px-1 py-0.5 w-32 text-center"
                />
                <span>el Área Solicitante inició el trámite con una Previsión de Precio de Bs</span>
                <input
                  type="number"
                  value={docData.informe_conf_prevision_precio || 0}
                  onChange={(e) => handleFieldChange("informe_conf_prevision_precio", parseFloat(e.target.value) || 0)}
                  className="font-bold text-slate-900 border-b border-dashed border-slate-400 focus:border-blue-500 outline-none px-1 py-0.5 w-28 text-right"
                />
                <span>(Categoría I - Art. 31), aprobada por el Responsable de Contratación (Art. 42).</span>
              </div>
            </div>

            {/* Recepción Section */}
            <div className="mb-3 text-xs text-slate-800 space-y-1">
              <h4 className="font-bold text-slate-900">RECEPCIÓN DE LAS OFERTAS / BIENES</h4>
              <p className="text-justify leading-relaxed">
                De acuerdo con el procedimiento regular, el proceso se llevó a cabo mediante la
                invitación selectiva a proveedores potenciales. En cumplimiento del Artículo 34 y
                Artículo 7 Inciso v), se recibieron las cotizaciones correspondientes al requerimiento.
              </p>
            </div>

            {/* Cuadro Comparativo Table (Fully Editable with Add/Remove and Ganador Switch) */}
            <div className="mb-4 overflow-hidden border border-slate-300 rounded shadow-sm">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-[#001E40] text-white">
                    <th className="p-2 border border-slate-400 text-center w-8">N°</th>
                    <th className="p-2 border border-slate-400 w-36">Empresa</th>
                    <th className="p-2 border border-slate-400">Detalle de Cotización</th>
                    <th className="p-2 border border-slate-400 text-right w-28">Precio</th>
                    <th className="p-2 border border-slate-400 w-36">Actividad Económica / NIT</th>
                    <th className="p-2 border border-slate-400 text-center w-14">Ganador</th>
                    <th className="p-2 border border-slate-400 text-center w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {(docData.informe_conf_proponentes || []).map((prop, idx) => (
                    <tr
                      key={idx}
                      className={
                        prop.es_ganador
                          ? "bg-emerald-50 text-emerald-950 font-medium"
                          : idx % 2 === 1
                          ? "bg-slate-50/70"
                          : "bg-white"
                      }
                    >
                      <td className="p-2 border border-slate-300 text-center font-bold">
                        {prop.numero || idx + 1}
                      </td>
                      <td className="p-2 border border-slate-300">
                        <input
                          type="text"
                          value={prop.empresa}
                          onChange={(e) => handleProponenteChange(idx, "empresa", e.target.value)}
                          className="w-full font-bold text-slate-900 border-b border-dashed border-transparent hover:border-slate-400 focus:border-blue-500 focus:bg-white outline-none px-1 py-0.5 text-xs rounded"
                          placeholder="Nombre Empresa"
                        />
                      </td>
                      <td className="p-2 border border-slate-300">
                        <textarea
                          rows={2}
                          value={prop.cotizacion_detalle}
                          onChange={(e) => handleProponenteChange(idx, "cotizacion_detalle", e.target.value)}
                          className="w-full border-b border-dashed border-transparent hover:border-slate-400 focus:border-blue-500 focus:bg-white outline-none px-1 py-0.5 text-[11px] rounded leading-tight resize-y"
                          placeholder="Fechas de cotización y cumplimiento..."
                        />
                      </td>
                      <td className="p-2 border border-slate-300 text-right">
                        <input
                          type="text"
                          value={prop.precio}
                          onChange={(e) => handleProponenteChange(idx, "precio", e.target.value)}
                          className="w-full text-right font-bold text-slate-900 border-b border-dashed border-transparent hover:border-slate-400 focus:border-blue-500 focus:bg-white outline-none px-1 py-0.5 text-xs rounded"
                          placeholder="Bs 0.00"
                        />
                      </td>
                      <td className="p-2 border border-slate-300">
                        <textarea
                          rows={2}
                          value={prop.actividad_economica}
                          onChange={(e) => handleProponenteChange(idx, "actividad_economica", e.target.value)}
                          className="w-full border-b border-dashed border-transparent hover:border-slate-400 focus:border-blue-500 focus:bg-white outline-none px-1 py-0.5 text-[10px] text-slate-600 rounded leading-tight resize-y"
                          placeholder="NIT y actividad..."
                        />
                      </td>
                      <td className="p-2 border border-slate-300 text-center">
                        <button
                          type="button"
                          onClick={() => handleSetGanador(idx)}
                          className={`p-1.5 rounded transition-all ${
                            prop.es_ganador
                              ? "bg-emerald-600 text-white shadow"
                              : "bg-slate-200 text-slate-500 hover:bg-slate-300"
                          }`}
                          title={prop.es_ganador ? "Empresa Ganadora" : "Marcar como Ganadora"}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </td>
                      <td className="p-2 border border-slate-300 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveProponente(idx)}
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

            {/* Conclusiones Section */}
            <div className="mb-3 text-xs text-slate-800 space-y-1">
              <h4 className="font-bold text-slate-900">CONCLUSIONES</h4>
              <p className="text-justify leading-relaxed">
                De acuerdo con la evaluación técnica y económica realizada por la unidad solicitante,
                en marco del Artículo 18 Inciso c) (Método de Selección de Menor Precio) del
                Reglamento SBC:
              </p>
              <ul className="space-y-1 pl-4">
                <li className="flex flex-wrap items-center gap-1.5">
                  <span className="font-bold">• 1. Adjudicación por Menor Precio:</span> La propuesta
                  presentada por la empresa
                  <input
                    type="text"
                    value={docData.informe_conf_empresa_ganadora || ""}
                    onChange={(e) => handleFieldChange("informe_conf_empresa_ganadora", e.target.value)}
                    className="font-bold text-slate-900 border-b border-dashed border-slate-400 focus:border-blue-500 outline-none px-1 py-0.5 w-32"
                  />
                  <span>resulta GANADORA al haber ofertado el menor precio y cumplido las E.T. al 100%.</span>
                </li>
                <li>
                  <span className="font-bold">• 2. Descalificaciones / Declinaciones:</span> Las
                  propuestas que no enviaron cotización o no acreditaron NIT válido quedan
                  inhabilitadas conforme a reglamento.
                </li>
              </ul>
            </div>

            {/* Recomendaciones Section */}
            <div className="mb-4 text-xs text-slate-800 space-y-1">
              <h4 className="font-bold text-slate-900">RECOMENDACIONES</h4>
              <ol className="space-y-1.5 pl-4 list-decimal">
                <li>
                  <strong>Adjudicación Formal:</strong> Recomendar al Responsable de Contratación
                  (Artículo 42) adjudicar el proceso a favor de{" "}
                  <strong>{docData.informe_conf_empresa_ganadora}</strong> por el monto total de Bs{" "}
                  <input
                    type="number"
                    value={docData.informe_conf_monto_adjudicado || 0}
                    onChange={(e) => handleFieldChange("informe_conf_monto_adjudicado", parseFloat(e.target.value) || 0)}
                    className="font-bold text-slate-900 border-b border-dashed border-slate-400 focus:border-blue-500 outline-none px-1 py-0.5 w-28 text-right"
                  />{" "}
                  (
                  <input
                    type="text"
                    value={docData.informe_conf_monto_adjudicado_literal || ""}
                    onChange={(e) => handleFieldChange("informe_conf_monto_adjudicado_literal", e.target.value)}
                    className="font-bold text-slate-900 border-b border-dashed border-slate-400 focus:border-blue-500 outline-none px-1 py-0.5 w-72"
                    placeholder="Monto en literal..."
                  />
                  ).
                </li>
                <li>
                  <strong>Formalización del Trámite:</strong> Remitir antecedentes al Área
                  Administrativa y Financiera para la emisión de la Orden de Compra o Contrato.
                </li>
              </ol>
            </div>

            <p className="text-xs text-slate-700 italic mb-8">
              Es cuanto puedo informar en honor a la verdad, para los fines consiguientes.
            </p>
          </div>

          {/* Firmas Block at Bottom of Carta Sheet */}
          <div className="grid grid-cols-2 gap-8 text-center text-xs pt-4 border-t border-slate-200">
            <div>
              <div className="w-44 border-b border-slate-400 mx-auto mb-1.5"></div>
              <input
                type="text"
                value={docData.informe_conf_de_nombre || ""}
                onChange={(e) => handleFieldChange("informe_conf_de_nombre", e.target.value)}
                className="w-full text-center font-bold text-slate-900 border-b border-dashed border-transparent hover:border-slate-400 focus:border-blue-500 outline-none"
              />
              <input
                type="text"
                value={docData.informe_conf_de_cargo || ""}
                onChange={(e) => handleFieldChange("informe_conf_de_cargo", e.target.value)}
                className="w-full text-center text-[10px] text-slate-500 border-b border-dashed border-transparent hover:border-slate-400 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <div className="w-44 border-b border-slate-400 mx-auto mb-1.5"></div>
              <input
                type="text"
                value={docData.informe_conf_via_nombre || ""}
                onChange={(e) => handleFieldChange("informe_conf_via_nombre", e.target.value)}
                className="w-full text-center font-bold text-slate-900 border-b border-dashed border-transparent hover:border-slate-400 focus:border-blue-500 outline-none"
              />
              <input
                type="text"
                value={docData.informe_conf_via_cargo || ""}
                onChange={(e) => handleFieldChange("informe_conf_via_cargo", e.target.value)}
                className="w-full text-center text-[10px] text-slate-500 border-b border-dashed border-transparent hover:border-slate-400 focus:border-blue-500 outline-none"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
