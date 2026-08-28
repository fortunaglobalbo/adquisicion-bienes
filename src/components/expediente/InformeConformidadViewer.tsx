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
  const [activeTab, setActiveTab] = useState<"preview" | "edit">("preview");

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

  const handleAddProponente = () => {
    const list = [...(docData.informe_conf_proponentes || [])];
    list.push({
      numero: list.length + 1,
      empresa: "NUEVA EMPRESA",
      cotizacion_detalle: "Cotización cumple con especificaciones técnicas",
      precio: "Bs 0.00",
      actividad_economica: "NIT: 0000000000",
      cumple_tecnico: true,
      cumple_legal: true,
      es_ganador: false,
    });
    setDocData((prev) => ({ ...prev, informe_conf_proponentes: list }));
  };

  const handleRemoveProponente = (index: number) => {
    const list = (docData.informe_conf_proponentes || []).filter((_, idx) => idx !== index);
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
          <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
            <FileCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-100 text-base">
                Carpeta 7: Informe de Conformidad y Evaluación (Form. A6-N014)
              </h3>
              <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">
                Word Oficial
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Evaluación técnica de ofertas, cuadro comparativo y recomendación formal de adjudicación
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
            <span>{isAiProcessing ? "Analizando..." : "Generar con IA"}</span>
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
          <div className="max-w-4xl mx-auto bg-white text-slate-900 shadow-2xl rounded-sm p-10 font-sans text-sm border border-slate-300">
            {/* Header Document */}
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
                  <h2 className="text-sm font-bold text-[#001E40] tracking-wide">
                    DISTRIBUIDORA DE ELECTRICIDAD ENDE DEORURO S.A.
                  </h2>
                  <p className="text-xs text-slate-500">Sistema Oficial de Adquisiciones</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-slate-700">{docData.informe_conf_formulario}</p>
                <p className="text-xs text-slate-600">{docData.informe_conf_fecha}</p>
                <p className="text-xs font-bold text-[#003366]">{docData.informe_conf_cite}</p>
              </div>
            </div>

            {/* Title */}
            <div className="text-center my-6">
              <h1 className="text-base font-extrabold text-[#001E40] uppercase tracking-wider">
                INFORME DE CONFORMIDAD
              </h1>
              <p className="text-xs font-bold text-slate-600 tracking-wide">(CONTRATACIONES)</p>
            </div>

            {/* Destinatarios Box */}
            <div className="grid grid-cols-[80px_1fr] gap-y-2 text-xs mb-6 bg-slate-50 p-4 rounded border border-slate-200">
              <span className="font-bold text-slate-800">A:</span>
              <div>
                <p className="font-bold text-slate-900">{docData.informe_conf_a_nombre}</p>
                <p className="text-slate-600">{docData.informe_conf_a_cargo}</p>
              </div>

              <span className="font-bold text-slate-800">VIA:</span>
              <div>
                <p className="font-bold text-slate-900">{docData.informe_conf_via_nombre}</p>
                <p className="text-slate-600">{docData.informe_conf_via_cargo}</p>
              </div>

              <span className="font-bold text-slate-800">De:</span>
              <div>
                <p className="font-bold text-slate-900">{docData.informe_conf_de_nombre}</p>
                <p className="text-slate-600">{docData.informe_conf_de_cargo}</p>
              </div>

              <span className="font-bold text-slate-800">PROCESO:</span>
              <div className="font-bold text-slate-900 leading-relaxed">
                {docData.informe_conf_proceso}
              </div>
            </div>

            {/* Subtitle */}
            <div className="text-center mb-4">
              <h3 className="text-xs font-bold text-slate-900 uppercase underline tracking-wide">
                INFORME TÉCNICO DE EVALUACIÓN DE OFERTAS Y CUADRO COMPARATIVO
              </h3>
            </div>

            {/* Antecedentes */}
            <div className="mb-4 text-xs leading-relaxed text-slate-800">
              <h4 className="font-bold text-slate-900 mb-1">ANTECEDENTES</h4>
              <p className="text-justify">
                En fecha {docData.informe_conf_antecedentes_fecha}, mediante Formulario S1-N014 y{" "}
                {docData.informe_conf_antecedentes_nota}, el Área Solicitante inició el trámite para la &quot;
                {docData.titulo_proceso}&quot;, con una Previsión de Precio de Bs{" "}
                {Number(docData.informe_conf_prevision_precio || 0).toLocaleString("es-BO", {
                  minimumFractionDigits: 2,
                })}{" "}
                (Categoría I - Art. 31), aprobada por el Responsable de Contratación (Art. 42).
              </p>
            </div>

            {/* Recepcion */}
            <div className="mb-4 text-xs leading-relaxed text-slate-800">
              <h4 className="font-bold text-slate-900 mb-1">RECEPCIÓN DE LAS OFERTAS / BIENES</h4>
              <p className="text-justify">
                De acuerdo con el procedimiento regular, el proceso se llevó a cabo mediante la
                invitación a {docData.informe_conf_proponentes?.length || 4} proveedores potenciales.
                En cumplimiento del Artículo 34 y Artículo 7 Inciso v) (Invitación Selectiva), se
                recibieron las cotizaciones correspondientes al requerimiento.
              </p>
            </div>

            {/* Evaluacion */}
            <div className="mb-4 text-xs leading-relaxed text-slate-800">
              <h4 className="font-bold text-slate-900 mb-1">
                EVALUACIÓN TÉCNICA Y ECONÓMICA (Art. 18, Inciso C - Menor Precio)
              </h4>
              <p className="text-justify">
                Se procedió a la verificación del cumplimiento del 100% de las Especificaciones
                Técnicas y la validación de la Previsión de Precio (Art. 10 y Art. 25 Inciso l):
                presentación de cotización conforme a especificaciones técnicas y documentación tributaria
                básica (NIT y registro correspondiente).
              </p>
            </div>

            {/* Cuadro Comparativo Table */}
            <div className="mb-6 overflow-hidden border border-slate-300 rounded">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-[#001E40] text-white">
                    <th className="p-2 border border-slate-400 text-center w-10">N°</th>
                    <th className="p-2 border border-slate-400 w-32">Empresa</th>
                    <th className="p-2 border border-slate-400">Cotización</th>
                    <th className="p-2 border border-slate-400 text-right w-28">Precio</th>
                    <th className="p-2 border border-slate-400 w-44">Actividad Económica / NIT</th>
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
                          ? "bg-slate-50"
                          : "bg-white"
                      }
                    >
                      <td className="p-2 border border-slate-300 text-center font-bold">
                        {prop.numero || idx + 1}
                      </td>
                      <td className="p-2 border border-slate-300 font-bold flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        <span>{prop.empresa}</span>
                        {prop.es_ganador && (
                          <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.2 rounded font-bold">
                            GANADOR
                          </span>
                        )}
                      </td>
                      <td className="p-2 border border-slate-300 whitespace-pre-line text-[11px]">
                        {prop.cotizacion_detalle}
                      </td>
                      <td className="p-2 border border-slate-300 text-right font-bold text-slate-900">
                        {typeof prop.precio === "number"
                          ? `Bs ${prop.precio.toLocaleString("es-BO", { minimumFractionDigits: 2 })}`
                          : prop.precio}
                      </td>
                      <td className="p-2 border border-slate-300 whitespace-pre-line text-[10px] text-slate-600">
                        {prop.actividad_economica}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Conclusiones */}
            <div className="mb-4 text-xs leading-relaxed text-slate-800">
              <h4 className="font-bold text-slate-900 mb-1">CONCLUSIONES</h4>
              <p className="text-justify mb-2">
                De acuerdo con la evaluación técnica y económica realizada por la unidad solicitante, en
                marco del Artículo 18 Inciso c) (Método de Selección de Menor Precio) del Reglamento SBC,
                se establece:
              </p>
              <ul className="space-y-1 pl-4">
                <li>
                  <span className="font-bold">• 1. Adjudicación por Menor Precio:</span> La propuesta
                  presentada por la empresa{" "}
                  <strong className="text-slate-900">{docData.informe_conf_empresa_ganadora}</strong>{" "}
                  resulta GANADORA al haber ofertado el MENOR PRECIO (Bs{" "}
                  {Number(docData.informe_conf_monto_adjudicado || 0).toLocaleString("es-BO", {
                    minimumFractionDigits: 2,
                  })}
                  ), haber cumplido al 100% con las Especificaciones Técnicas requeridas y encontrarse
                  dentro de la Previsión de Precio.
                </li>
                <li>
                  <span className="font-bold">• 2. Descalificación / Declinación:</span> Las propuestas
                  incompletas o que no enviaron cotización conforme al plazo fijado quedan
                  desestimadas.
                </li>
              </ul>
            </div>

            {/* Recomendaciones */}
            <div className="mb-6 text-xs leading-relaxed text-slate-800">
              <h4 className="font-bold text-slate-900 mb-1">RECOMENDACIONES</h4>
              <p className="mb-2">
                En virtud a los principios de Economía, Eficiencia y Transparencia (Artículo 6) que
                rigen a ENDE Oruro S.A.:
              </p>
              <ol className="space-y-1.5 pl-4 list-decimal">
                <li>
                  <strong>Adjudicación Formal:</strong> Recomendar al Responsable de Contratación
                  (Artículo 42) proceder con la Adjudicación del proceso &quot;{docData.titulo_proceso}&quot; a
                  favor de la empresa{" "}
                  <strong>{docData.informe_conf_empresa_ganadora}</strong> por el monto total de{" "}
                  <strong>
                    Bs{" "}
                    {Number(docData.informe_conf_monto_adjudicado || 0).toLocaleString("es-BO", {
                      minimumFractionDigits: 2,
                    })}{" "}
                    ({docData.informe_conf_monto_adjudicado_literal})
                  </strong>
                  .
                </li>
                <li>
                  <strong>Formalización del Trámite:</strong> Remitir los antecedentes al Área
                  Administrativa y Financiera a efectos de solicitar la documentación legal
                  complementaria para la emisión de la Orden de Compra o Contrato.
                </li>
              </ol>
            </div>

            <p className="text-xs text-slate-700 italic mb-12">
              Es cuanto puedo informar en honor a la verdad, para los fines consiguientes.
            </p>

            {/* Firmas */}
            <div className="grid grid-cols-2 gap-8 text-center text-xs mt-12 pt-6 border-t border-slate-200">
              <div>
                <div className="w-48 border-b border-slate-400 mx-auto mb-2"></div>
                <p className="font-bold text-slate-900">{docData.informe_conf_de_nombre}</p>
                <p className="text-slate-600">{docData.informe_conf_de_cargo}</p>
              </div>
              <div>
                <div className="w-48 border-b border-slate-400 mx-auto mb-2"></div>
                <p className="font-bold text-slate-900">{docData.informe_conf_via_nombre}</p>
                <p className="text-slate-600">{docData.informe_conf_via_cargo}</p>
              </div>
            </div>
          </div>
        ) : (
          /* Form Editor Tab */
          <div className="max-w-4xl mx-auto space-y-6 text-slate-200 text-xs">
            {/* Header Data */}
            <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-4">
              <h4 className="font-semibold text-slate-100 text-sm flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-blue-400" />
                Datos del Encabezado e Informe
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1">Formulario</label>
                  <input
                    type="text"
                    value={docData.informe_conf_formulario || ""}
                    onChange={(e) => handleFieldChange("informe_conf_formulario", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Fecha</label>
                  <input
                    type="text"
                    value={docData.informe_conf_fecha || ""}
                    onChange={(e) => handleFieldChange("informe_conf_fecha", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">CITE Informe</label>
                  <input
                    type="text"
                    value={docData.informe_conf_cite || ""}
                    onChange={(e) => handleFieldChange("informe_conf_cite", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="block text-slate-400 mb-1">A (Destinatario)</label>
                  <input
                    type="text"
                    value={docData.informe_conf_a_nombre || ""}
                    onChange={(e) => handleFieldChange("informe_conf_a_nombre", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 mb-1"
                  />
                  <input
                    type="text"
                    value={docData.informe_conf_a_cargo || ""}
                    onChange={(e) => handleFieldChange("informe_conf_a_cargo", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-400 text-[11px]"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">VÍA</label>
                  <input
                    type="text"
                    value={docData.informe_conf_via_nombre || ""}
                    onChange={(e) => handleFieldChange("informe_conf_via_nombre", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 mb-1"
                  />
                  <input
                    type="text"
                    value={docData.informe_conf_via_cargo || ""}
                    onChange={(e) => handleFieldChange("informe_conf_via_cargo", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-400 text-[11px]"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">DE (Remitente)</label>
                  <input
                    type="text"
                    value={docData.informe_conf_de_nombre || ""}
                    onChange={(e) => handleFieldChange("informe_conf_de_nombre", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 mb-1"
                  />
                  <input
                    type="text"
                    value={docData.informe_conf_de_cargo || ""}
                    onChange={(e) => handleFieldChange("informe_conf_de_cargo", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-400 text-[11px]"
                  />
                </div>
              </div>
            </div>

            {/* Adjudicación y Ganador */}
            <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-4">
              <h4 className="font-semibold text-slate-100 text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-yellow-400" />
                Empresa Ganadora y Monto Adjudicado
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1">Empresa Adjudicada</label>
                  <input
                    type="text"
                    value={docData.informe_conf_empresa_ganadora || ""}
                    onChange={(e) => handleFieldChange("informe_conf_empresa_ganadora", e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Monto Adjudicado (Bs)</label>
                  <input
                    type="number"
                    value={docData.informe_conf_monto_adjudicado || 0}
                    onChange={(e) =>
                      handleFieldChange("informe_conf_monto_adjudicado", parseFloat(e.target.value) || 0)
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Monto en Literal</label>
                  <input
                    type="text"
                    value={docData.informe_conf_monto_adjudicado_literal || ""}
                    onChange={(e) =>
                      handleFieldChange("informe_conf_monto_adjudicado_literal", e.target.value)
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100"
                  />
                </div>
              </div>
            </div>

            {/* Proponentes Table Editor */}
            <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-semibold text-slate-100 text-sm flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-400" />
                  Cuadro de Proponentes y Cotizaciones
                </h4>
                <button
                  onClick={handleAddProponente}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Añadir Proponente</span>
                </button>
              </div>

              <div className="space-y-3">
                {(docData.informe_conf_proponentes || []).map((prop, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border ${
                      prop.es_ganador
                        ? "bg-emerald-950/30 border-emerald-500/40"
                        : "bg-slate-950 border-slate-800"
                    } space-y-3`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-300">#{idx + 1} Proponente</span>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-emerald-400">
                          <input
                            type="checkbox"
                            checked={prop.es_ganador || false}
                            onChange={(e) =>
                              handleProponenteChange(idx, "es_ganador", e.target.checked)
                            }
                            className="rounded border-slate-700 text-emerald-600 focus:ring-0"
                          />
                          <span>Marcar como Ganador</span>
                        </label>
                        <button
                          onClick={() => handleRemoveProponente(idx)}
                          className="p-1 text-red-400 hover:text-red-300 transition-colors"
                          title="Eliminar proponente"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-slate-400 mb-1">Nombre Empresa</label>
                        <input
                          type="text"
                          value={prop.empresa}
                          onChange={(e) => handleProponenteChange(idx, "empresa", e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">Precio Ofertado</label>
                        <input
                          type="text"
                          value={prop.precio}
                          onChange={(e) => handleProponenteChange(idx, "precio", e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100 font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">Actividad Económica / NIT</label>
                        <input
                          type="text"
                          value={prop.actividad_economica}
                          onChange={(e) =>
                            handleProponenteChange(idx, "actividad_economica", e.target.value)
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100 text-[11px]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">Detalle de Cotización / Cumplimiento</label>
                      <textarea
                        rows={2}
                        value={prop.cotizacion_detalle}
                        onChange={(e) =>
                          handleProponenteChange(idx, "cotizacion_detalle", e.target.value)
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100 text-xs"
                      />
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
