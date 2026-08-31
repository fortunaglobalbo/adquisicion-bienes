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
  FileDown,
} from "lucide-react";
import { getFechaTextoActual, getFechaCortaActual } from "@/lib/utils/dateUtils";

interface InformeConformidadViewerProps {
  adquisicion: Adquisicion;
  onDownloadDocx: (liveData?: Adquisicion) => void;
  onDownloadPdf?: (liveData?: Adquisicion) => void;
  onAdquisicionUpdated?: (updated: Adquisicion) => void;
}

export const InformeConformidadViewer: React.FC<InformeConformidadViewerProps> = ({
  adquisicion,
  onDownloadDocx,
  onDownloadPdf,
  onAdquisicionUpdated,
}) => {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  // Initialize data with official ENDE defaults from template
  const defaultItemsRecepcion =
    adquisicion.informe_conf_items_recepcion && adquisicion.informe_conf_items_recepcion.length > 0
      ? adquisicion.informe_conf_items_recepcion
      : (adquisicion.items && adquisicion.items.length > 0)
      ? adquisicion.items.map((it, idx) => ({
          numero: idx + 1,
          descripcion: it.descripcion || "ITEM O SERVICIO SOLICITADO",
          fecha_recepcion: getFechaCortaActual(),
          observaciones: "Sin observaciones / Servicio prestado a conformidad",
        }))
      : [
          {
            numero: 1,
            descripcion: `SERVICIO DE LIMPIEZA MES DE JUNIO 2026`,
            fecha_recepcion: "30/06/2026",
            observaciones: "Sin observaciones / Servicio prestado a conformidad",
          },
        ];

  const defaultProceso =
    adquisicion.informe_conf_proceso ||
    (adquisicion.titulo_proceso
      ? adquisicion.titulo_proceso.toUpperCase()
      : 'SERVICIO DE LIMPIEZA E HIGIENE PARA LAS DEPENDENCIAS DE ENDE ORURO S.A.');

  const [docData, setDocData] = useState<Adquisicion>({
    ...adquisicion,
    informe_conf_formulario: adquisicion.informe_conf_formulario || "INFORME DE CONFORMIDAD (ADQUISICIONES)",
    informe_conf_fecha: adquisicion.informe_conf_fecha || "Oruro, 23 de Julio de 2026",
    informe_conf_a_nombre: adquisicion.informe_conf_a_nombre || "LIC. VICENTE PAUL VEGA RAMIREZ",
    informe_conf_a_cargo:
      adquisicion.informe_conf_a_cargo || "SUPERINTENDENTE DE ADMINISTRACIÓN Y FINANZAS a.i.",
    informe_conf_de_nombre:
      adquisicion.informe_conf_de_nombre || "ING. TATIANA TORRES ANDRADE",
    informe_conf_de_cargo:
      adquisicion.informe_conf_de_cargo || "SUPERVISOR DE SEGURIDAD INDUSTRIAL a.i",
    informe_conf_proceso: defaultProceso,
    informe_conf_antecedentes:
      adquisicion.informe_conf_antecedentes ||
      "En atención y mantenimiento de las condiciones de orden, higiene y limpieza en las instalaciones de la empresa para dar cumplimiento a los estándares operativos y de seguridad industrial.",
    informe_conf_desarrollo:
      adquisicion.informe_conf_desarrollo ||
      `En este sentido en cumplimiento del Reglamento de Adquisición de Bienes, Construcción de Obras Y Contratación de Servicios, se emite el contrato GG-CTO-26/040014 "${defaultProceso}" para la empresa MOVICLEAN S.R.L., la cual cumple con las especificaciones técnicas y menor precio que se solicitó en el proceso de adquisición.`,
    informe_conf_items_recepcion: defaultItemsRecepcion,
    informe_conf_conclusiones_texto:
      adquisicion.informe_conf_conclusiones_texto ||
      "De acuerdo a la verificación e inspección realizada al desempeño de las tareas desempeñadas durante el mes de junio de 2026, como unidad solicitante se expresa la entera conformidad respecto a la prestación del servicio señalado. Se concluye que el proveedor cumple satisfactoriamente con las especificaciones técnicas exigidas.",
  });

  const handleFieldChange = (field: keyof Adquisicion, value: any) => {
    setDocData((prev) => ({ ...prev, [field]: value }));
  };

  const handleItemRecepcionChange = (index: number, field: string, value: any) => {
    const list = [...(docData.informe_conf_items_recepcion || [])];
    list[index] = { ...list[index], [field]: value };
    setDocData((prev) => ({ ...prev, informe_conf_items_recepcion: list }));
  };

  const handleAddItemRecepcion = () => {
    const list = [...(docData.informe_conf_items_recepcion || [])];
    list.push({
      numero: list.length + 1,
      descripcion: "NUEVO ITEM / SERVICIO ENTREGADO",
      fecha_recepcion: getFechaCortaActual(),
      observaciones: "Sin observaciones / Cumplimiento al 100%",
    });
    setDocData((prev) => ({ ...prev, informe_conf_items_recepcion: list }));
  };

  const handleRemoveItemRecepcion = (index: number) => {
    const list = (docData.informe_conf_items_recepcion || [])
      .filter((_, idx) => idx !== index)
      .map((item, idx) => ({ ...item, numero: idx + 1 }));
    setDocData((prev) => ({ ...prev, informe_conf_items_recepcion: list }));
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
          informe_conf_fecha: result.data.fecha || docData.informe_conf_fecha,
          informe_conf_a_nombre: result.data.a_nombre || docData.informe_conf_a_nombre,
          informe_conf_a_cargo: result.data.a_cargo || docData.informe_conf_a_cargo,
          informe_conf_de_nombre: result.data.de_nombre || docData.informe_conf_de_nombre,
          informe_conf_de_cargo: result.data.de_cargo || docData.informe_conf_de_cargo,
          informe_conf_proceso: result.data.proceso || docData.informe_conf_proceso,
          informe_conf_antecedentes: result.data.antecedentes || docData.informe_conf_antecedentes,
          informe_conf_desarrollo: result.data.desarrollo || docData.informe_conf_desarrollo,
          informe_conf_items_recepcion:
            result.data.items_recepcion && result.data.items_recepcion.length > 0
              ? result.data.items_recepcion
              : docData.informe_conf_items_recepcion,
          informe_conf_conclusiones_texto:
            result.data.conclusiones_texto || docData.informe_conf_conclusiones_texto,
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

  const isDocumentGenerated =
    !!docData.informe_conf_desarrollo ||
    !!docData.informe_conf_antecedentes ||
    (docData.informe_conf_items_recepcion && docData.informe_conf_items_recepcion.length > 0) ||
    (docData.items && docData.items.length > 0);

  return (
    <div
      className={`flex flex-col space-y-4 ${
        isFullScreen ? "fixed inset-0 z-50 bg-surface p-4 overflow-y-auto" : "w-full"
      }`}
    >
      {/* Toolbar */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3 shadow-md sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Direct 1-Click AI Generation */}
          <button
            onClick={handleGenerateWithAi}
            disabled={isAiProcessing}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-primary-container hover:opacity-90 text-white font-sans text-xs font-bold rounded-lg shadow-sm transition-all active:scale-95 disabled:opacity-50"
            title="Redactar automáticamente el Informe de Conformidad con IA"
          >
            {isAiProcessing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-yellow-100" />
                <span>Redactando con IA...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-yellow-300 fill-yellow-300" />
                <span>Generar con IA (1-Clic)</span>
              </>
            )}
          </button>

          {/* Direct Word Export Button */}
          <button
            onClick={() => onDownloadDocx(docData)}
            disabled={!isDocumentGenerated}
            className="flex items-center gap-1.5 px-3 py-2 bg-surface-container-high border border-outline-variant hover:border-primary text-on-surface font-sans text-xs font-semibold rounded-lg shadow-sm transition-all disabled:opacity-40"
            title="Descargar documento Word (.docx) oficial de ENDE"
          >
            <Download className="w-4 h-4 text-primary" />
            <span>Descargar Word (.docx)</span>
          </button>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={!isDocumentGenerated}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-surface-container hover:bg-surface-container-high text-on-surface font-sans text-xs font-medium rounded-lg border border-outline-variant transition-colors disabled:opacity-40"
            title="Guardar cambios realizados"
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
        </div>

        {/* Right: Badges & View Controls */}
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="p-2 hover:bg-surface-container text-on-surface-variant rounded border border-outline-variant transition-colors"
            title={isFullScreen ? "Salir de pantalla completa" : "Pantalla completa"}
          >
            {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Central Workbench with Realistic Carta Sheet (Exact Replica of Scan) */}
      <div className="flex-1 bg-surface-container-low p-4 md:p-8 rounded-xl border border-outline-variant/60 overflow-x-auto flex justify-center shadow-inner">
        {!isDocumentGenerated ? (
          <div className="w-full max-w-[816px] bg-white border border-outline-variant/60 shadow-md rounded-xl p-16 min-h-[550px] flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <FileDown className="w-8 h-8 opacity-60" />
            </div>
            <div className="max-w-md space-y-1.5">
              <h4 className="font-bold text-on-surface text-lg">Vista Previa en Blanco</h4>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                El Informe de Conformidad oficial aún no ha sido redactado para este expediente. Haz clic en el botón para generarlo automáticamente con la IA.
              </p>
            </div>
            <button
              type="button"
              onClick={handleGenerateWithAi}
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
                  <span>✨ Generar Informe de Conformidad con IA</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="w-full max-w-[816px] min-h-[1056px] bg-white text-slate-900 shadow-2xl p-[48px] md:p-[64px] font-sans text-[13px] leading-relaxed border border-slate-300 relative rounded-sm flex flex-col justify-between">
            <div className="space-y-4">
              {/* Header: Logo & Company Name */}
              <div className="flex items-center gap-3">
                <img
                  src="/logo-ende-deoruro.png"
                  alt="ENDE DEORURO"
                  className="h-10 w-auto object-contain"
                  onError={(e) => {
                    (e.target as any).style.display = "none";
                  }}
                />
                <div className="text-xs font-bold text-slate-900 tracking-wide">
                  DISTRIBUIDORA DE ELECTRICIDAD ENDE DEORURO S.A.
                </div>
              </div>

              {/* Document Main Titles */}
              <div className="text-center pt-2 pb-1 space-y-0.5">
                <h1 className="font-black text-lg tracking-wide uppercase text-slate-950">
                  INFORME DE CONFORMIDAD
                </h1>
                <div className="text-sm font-bold text-slate-800">
                  (ADQUISICIONES)
                </div>
              </div>

              {/* Recipient / Sender Meta Table */}
              <div className="space-y-2 text-xs font-sans pt-2">
                {/* Row A: */}
                <div className="grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-1 font-bold text-slate-900">A:</div>
                  <div className="col-span-6 font-bold uppercase text-slate-900">
                    <input
                      type="text"
                      value={docData.informe_conf_a_nombre || ""}
                      onChange={(e) => handleFieldChange("informe_conf_a_nombre", e.target.value)}
                      className="w-full bg-transparent border-b border-dashed border-transparent hover:border-slate-400 focus:border-primary outline-none uppercase font-bold"
                    />
                  </div>
                  <div className="col-span-5 font-bold uppercase text-slate-800 text-[11px] text-right">
                    <input
                      type="text"
                      value={docData.informe_conf_a_cargo || ""}
                      onChange={(e) => handleFieldChange("informe_conf_a_cargo", e.target.value)}
                      className="w-full bg-transparent border-b border-dashed border-transparent hover:border-slate-400 focus:border-primary outline-none uppercase font-bold text-right"
                    />
                  </div>
                </div>

                {/* Row DE: */}
                <div className="grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-1 font-bold text-slate-900">DE:</div>
                  <div className="col-span-6 font-bold uppercase text-slate-900">
                    <input
                      type="text"
                      value={docData.informe_conf_de_nombre || ""}
                      onChange={(e) => handleFieldChange("informe_conf_de_nombre", e.target.value)}
                      className="w-full bg-transparent border-b border-dashed border-transparent hover:border-slate-400 focus:border-primary outline-none uppercase font-bold"
                    />
                  </div>
                  <div className="col-span-5 font-bold uppercase text-slate-800 text-[11px] text-right">
                    <input
                      type="text"
                      value={docData.informe_conf_de_cargo || ""}
                      onChange={(e) => handleFieldChange("informe_conf_de_cargo", e.target.value)}
                      className="w-full bg-transparent border-b border-dashed border-transparent hover:border-slate-400 focus:border-primary outline-none uppercase font-bold text-right"
                    />
                  </div>
                </div>

                {/* Row LUGAR Y FECHA: */}
                <div className="grid grid-cols-12 gap-2 items-center pt-1">
                  <div className="col-span-3 font-bold text-slate-900">LUGAR Y FECHA:</div>
                  <div className="col-span-9 text-slate-800">
                    <input
                      type="text"
                      value={docData.informe_conf_fecha || ""}
                      onChange={(e) => handleFieldChange("informe_conf_fecha", e.target.value)}
                      className="w-full bg-transparent border-b border-dashed border-transparent hover:border-slate-400 focus:border-primary outline-none"
                    />
                  </div>
                </div>

                {/* Row PROCESO: */}
                <div className="grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-3 font-bold text-slate-900">PROCESO:</div>
                  <div className="col-span-9 font-bold uppercase text-slate-900">
                    <textarea
                      rows={2}
                      value={docData.informe_conf_proceso || ""}
                      onChange={(e) => handleFieldChange("informe_conf_proceso", e.target.value)}
                      className="w-full bg-transparent border-b border-dashed border-transparent hover:border-slate-400 focus:border-primary outline-none uppercase font-bold resize-y text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Solid Horizontal Dividing Bar */}
              <div className="w-full h-1 bg-black my-3"></div>

              {/* 1. ANTECEDENTES */}
              <div className="space-y-1 text-xs text-justify font-sans pt-1">
                <h3 className="font-bold text-slate-950 uppercase text-xs">
                  1. ANTECEDENTES
                </h3>
                <textarea
                  rows={3}
                  value={docData.informe_conf_antecedentes || ""}
                  onChange={(e) => handleFieldChange("informe_conf_antecedentes", e.target.value)}
                  className="w-full bg-transparent border border-dashed border-transparent hover:border-slate-300 focus:border-primary outline-none p-1 rounded resize-y text-xs leading-relaxed"
                />
              </div>

              {/* 2. DESARROLLO */}
              <div className="space-y-1 text-xs text-justify font-sans pt-1">
                <h3 className="font-bold text-slate-950 uppercase text-xs">
                  2. DESARROLLO
                </h3>
                <textarea
                  rows={4}
                  value={docData.informe_conf_desarrollo || ""}
                  onChange={(e) => handleFieldChange("informe_conf_desarrollo", e.target.value)}
                  className="w-full bg-transparent border border-dashed border-transparent hover:border-slate-300 focus:border-primary outline-none p-1 rounded resize-y text-xs leading-relaxed"
                />
              </div>

              {/* 3. RECEPCIÓN DE LOS BIENES Y/O SERVICIOS */}
              <div className="space-y-2 text-xs font-sans pt-1">
                <h3 className="font-bold text-slate-950 uppercase text-xs">
                  3. RECEPCIÓN DE LOS BIENES Y/O SERVICIOS
                </h3>
                <p className="text-slate-800 text-xs">
                  Se verificó la prestación del servicio / entrega de bienes correspondiente con el siguiente detalle:
                </p>

                {/* Reception Table */}
                <div className="overflow-x-auto my-2">
                  <table className="w-full border-collapse border border-black text-xs font-sans">
                    <thead>
                      <tr className="bg-white border-b border-black text-center font-bold text-[11px]">
                        <th className="border border-black p-2 w-10">N°</th>
                        <th className="border border-black p-2">DESCRIPCIÓN DEL BIEN O SERVICIO</th>
                        <th className="border border-black p-2 w-40">FECHA DE RECEPCIÓN DEL BIEN O SERVICIO</th>
                        <th className="border border-black p-2 w-48">OBSERVACIONES</th>
                        <th className="border border-black p-1 w-8 print:hidden"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(docData.informe_conf_items_recepcion || []).map((it, idx) => (
                        <tr key={idx} className="border-b border-black hover:bg-slate-50/80">
                          <td className="border border-black p-2 text-center font-bold">
                            {it.numero || idx + 1}
                          </td>
                          <td className="border border-black p-2 text-left">
                            <textarea
                              rows={2}
                              value={it.descripcion}
                              onChange={(e) => handleItemRecepcionChange(idx, "descripcion", e.target.value)}
                              className="w-full bg-transparent border-none outline-none resize-y text-xs uppercase"
                            />
                          </td>
                          <td className="border border-black p-2 text-center">
                            <input
                              type="text"
                              value={it.fecha_recepcion}
                              onChange={(e) => handleItemRecepcionChange(idx, "fecha_recepcion", e.target.value)}
                              className="w-full text-center bg-transparent border-none outline-none text-xs"
                            />
                          </td>
                          <td className="border border-black p-2 text-left text-xs">
                            <textarea
                              rows={2}
                              value={it.observaciones}
                              onChange={(e) => handleItemRecepcionChange(idx, "observaciones", e.target.value)}
                              className="w-full bg-transparent border-none outline-none resize-y text-xs"
                            />
                          </td>
                          <td className="border border-black p-1 text-center print:hidden">
                            <button
                              type="button"
                              onClick={() => handleRemoveItemRecepcion(idx)}
                              className="p-1 text-red-500 hover:bg-red-50 rounded"
                              title="Eliminar fila"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="pt-2 flex justify-start print:hidden">
                    <button
                      type="button"
                      onClick={handleAddItemRecepcion}
                      className="flex items-center gap-1 text-xs text-primary font-bold hover:underline"
                    >
                      <Plus className="w-3.5 h-3.5" /> Añadir Fila a la Recepción
                    </button>
                  </div>
                </div>
              </div>

              {/* 4. CONCLUSIONES */}
              <div className="space-y-2 text-xs text-justify font-sans pt-1">
                <h3 className="font-bold text-slate-950 uppercase text-xs">
                  4. CONCLUSIONES
                </h3>
                <textarea
                  rows={4}
                  value={docData.informe_conf_conclusiones_texto || ""}
                  onChange={(e) => handleFieldChange("informe_conf_conclusiones_texto", e.target.value)}
                  className="w-full bg-transparent border border-dashed border-transparent hover:border-slate-300 focus:border-primary outline-none p-1 rounded resize-y text-xs leading-relaxed"
                />
                <p className="text-xs text-slate-800 pt-1">
                  En cuanto tenemos a bien informar, para los fines consiguientes.
                </p>
              </div>

              {/* Signatures Area (Exact Template Layout) */}
              <div className="pt-12 text-center font-sans text-xs space-y-1">
                <p className="text-xs font-medium text-slate-800 pb-12">Atentamente,</p>
                <div className="w-64 border-b border-black mx-auto mb-1.5"></div>
                <div className="font-bold text-slate-950 uppercase">
                  {docData.informe_conf_de_nombre || "ING. TATIANA TORRES ANDRADE"}
                </div>
                <div className="text-[11px] text-slate-700 uppercase">
                  {docData.informe_conf_de_cargo || "SUPERVISOR DE SEGURIDAD INDUSTRIAL a.i"}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
