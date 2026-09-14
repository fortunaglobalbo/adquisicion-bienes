"use client";

import React, { useState, useEffect } from "react";
import {
  HojaRuta,
  HojaRutaFormData,
  HojaRutaEstado,
  HojaRutaPase,
} from "@/lib/types/hojaRuta";
import { HojaRutaService } from "@/lib/services/hojaRutaService";
import {
  Plus,
  RefreshCw,
  Send,
  CheckCircle2,
  AlertCircle,
  TableProperties,
  ChevronDown,
  ChevronUp,
  Trash2,
  FileCheck,
} from "lucide-react";

interface Props {
  onCreated: (hoja: HojaRuta) => void;
}

const AREAS_SUGERIDAS = [
  "DISTRIBUCION",
  "COMERCIAL",
  "ADMINISTRACION",
  "TICs",
  "SEGURIDAD INDUSTRIAL",
  "SISTEMA RURAL",
  "ALMACENES",
  "ASESORIA LEGAL",
  "GERENCIA GENERAL",
];

const TIPOS_DOC = [
  "SOLICITUD/TDR",
  "ADQUISICIONES",
  "SERVICIOS",
  "CONSULTORIAS",
];

const CATEGORIAS_SUGERIDAS = [
  "CAT 1",
  "CAT 2",
  "MENOR",
  "MAYOR",
  "EMERGENCIA",
];

export const FormularioHojaRuta: React.FC<Props> = ({ onCreated }) => {
  const [cite, setCite] = useState("");
  const [fechaIngreso, setFechaIngreso] = useState("");
  const [horaIngreso, setHoraIngreso] = useState("");
  const [tipoDocumento, setTipoDocumento] = useState("SOLICITUD/TDR");
  const [areaOrigen, setAreaOrigen] = useState<string>("DISTRIBUCION");
  const [categoria, setCategoria] = useState<string>("CAT 1");
  const [asunto, setAsunto] = useState("");
  const [ubicacionActual, setUbicacionActual] = useState("DISTRIBUCION");
  const [estadoActual, setEstadoActual] = useState<HojaRutaEstado>("En Circulación");

  // Pases dinámicos libres (sin límite de 1 a 7)
  const [pases, setPases] = useState<HojaRutaPase[]>([
    {
      pase: 1,
      destino: "DISTRIBUCION",
      fecha: new Date().toISOString().split("T")[0],
      hora: new Date().toTimeString().slice(0, 5),
      firma: "",
    },
  ]);

  const [mostrarPases, setMostrarPases] = useState(false);
  const [loadingCite, setLoadingCite] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const loadCorrelativo = async () => {
    setLoadingCite(true);
    try {
      const res = await HojaRutaService.getNextCorrelativo();
      setCite(res.correlativo);
      if (!fechaIngreso) setFechaIngreso(res.fechaSugerida);
      if (!horaIngreso) setHoraIngreso(res.horaSugerida);

      setPases((prev) =>
        prev.map((p) =>
          p.pase === 1
            ? {
                ...p,
                fecha: p.fecha || res.fechaSugerida,
                hora: p.hora || res.horaSugerida,
              }
            : p
        )
      );
    } catch {
      // Fallback
    } finally {
      setLoadingCite(false);
    }
  };

  useEffect(() => {
    loadCorrelativo();
  }, []);

  const handleAreaSelect = (nuevaArea: string) => {
    setAreaOrigen(nuevaArea);
    if (ubicacionActual === areaOrigen || !ubicacionActual) {
      setUbicacionActual(nuevaArea);
    }
    setPases((prev) =>
      prev.map((p) => (p.pase === 1 && (!p.destino || p.destino === areaOrigen) ? { ...p, destino: nuevaArea } : p))
    );
  };

  const handlePaseChange = (
    index: number,
    field: keyof HojaRutaPase,
    value: string
  ) => {
    setPases((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const agregarPase = () => {
    setPases((prev) => [
      ...prev,
      {
        pase: prev.length + 1,
        destino: "",
        fecha: "",
        hora: "",
        firma: "",
      },
    ]);
    if (!mostrarPases) setMostrarPases(true);
  };

  const eliminarPase = (index: number) => {
    setPases((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((p, idx) => ({ ...p, pase: idx + 1 }))
    );
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!asunto.trim()) {
      setFeedback({ type: "error", msg: "Debe ingresar el Asunto / Descripción Corta." });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    const formData: HojaRutaFormData = {
      cite_correlativo: cite,
      fecha_ingreso: fechaIngreso || new Date().toISOString().split("T")[0],
      hora_ingreso: horaIngreso || new Date().toTimeString().slice(0, 5),
      tipo_documento: tipoDocumento,
      institucion_area_origen: areaOrigen.trim() || "DISTRIBUCION",
      categoria: categoria.trim() || "CAT 1",
      asunto_descripcion: asunto.trim(),
      ubicacion_actual: ubicacionActual.trim() || areaOrigen.trim() || "DISTRIBUCION",
      estado_actual: estadoActual,
      pases: pases,
    };

    const res = await HojaRutaService.create(formData);
    setSubmitting(false);

    if (res.success && res.data) {
      setFeedback({
        type: "success",
        msg: `¡Trámite ${res.data.cite_correlativo} creado exitosamente! Listo para imprimir la carátula.`,
      });
      onCreated(res.data);

      // Limpiar formulario y sugerir nuevo CITE
      setAsunto("");
      const now = new Date();
      setPases([
        {
          pase: 1,
          destino: areaOrigen,
          fecha: now.toISOString().split("T")[0],
          hora: now.toTimeString().slice(0, 5),
          firma: "",
        },
      ]);
      loadCorrelativo();
    } else {
      setFeedback({
        type: "error",
        msg: res.error || "Error al enviar la hoja de ruta.",
      });
    }
  };

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden flex flex-col">
      {/* Cabecera Azul Corporativo ENDE con Logo */}
      <div className="bg-[#001e40] text-white px-5 py-3 flex items-center justify-between border-b-2 border-[#feb316]">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-ende-deoruro.png"
            alt="ENDE DEORURO S.A."
            className="h-8 w-auto bg-white p-1 rounded"
          />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black tracking-wide uppercase">HOJA DE RUTA</h2>
              <span className="bg-[#feb316] text-[#001e40] text-[10px] font-mono font-bold px-2 py-0.5 rounded">
                NUEVO TRÁMITE
              </span>
            </div>
            <p className="text-xs italic text-blue-100 mt-0.5">
              Adjuntar al frente de la carpeta circulante
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleSubmit()}
          disabled={submitting || !asunto.trim()}
          className="flex items-center gap-2 bg-[#feb316] hover:bg-[#e09c0d] text-[#001e40] font-black text-xs px-3.5 py-2 rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
        >
          {submitting ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          <span>+ ENVIAR A LISTA</span>
        </button>
      </div>

      {/* Banner de Feedback */}
      {feedback && (
        <div
          className={`px-4 py-2.5 text-xs flex items-center gap-2 font-medium border-b ${
            feedback.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800"
              : "bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span className="flex-1">{feedback.msg}</span>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs underline hover:opacity-80"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
        {/* Fila 1: CITE Correlativo y Fecha */}
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-7">
            <label className="block text-[11px] font-bold text-neutral-700 dark:text-neutral-300 mb-1">
              Nº de Trámite / Correlativo:
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                value={cite}
                onChange={(e) => setCite(e.target.value)}
                placeholder="ADQ - 08-09-01"
                className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 font-mono font-bold text-neutral-900 dark:text-neutral-100 text-sm focus:ring-2 focus:ring-[#001e40] focus:border-transparent outline-none"
              />
              <button
                type="button"
                onClick={loadCorrelativo}
                disabled={loadingCite}
                title="Generar siguiente CITE automático"
                className="absolute right-2 p-1.5 text-neutral-500 hover:text-[#001e40] transition-colors"
              >
                <RefreshCw
                  className={`w-4 h-4 ${loadingCite ? "animate-spin" : ""}`}
                />
              </button>
            </div>
            <span className="text-[10px] text-neutral-500 mt-0.5 block">
              Generado automáticamente según la fecha y secuencia diaria
            </span>
          </div>

          <div className="col-span-5">
            <label className="block text-[11px] font-bold text-neutral-700 dark:text-neutral-300 mb-1">
              Fecha de ingreso a la unidad:
            </label>
            <input
              type="date"
              value={fechaIngreso}
              onChange={(e) => setFechaIngreso(e.target.value)}
              className="w-full bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-900 dark:text-neutral-100 font-mono text-xs focus:ring-2 focus:ring-[#001e40] outline-none"
            />
          </div>
        </div>

        {/* Fila 2: Tipo de Documento y Categoría (Campo Libre) */}
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-6">
            <label className="block text-[11px] font-bold text-neutral-700 dark:text-neutral-300 mb-1">
              Tipo de Documento:
            </label>
            <select
              value={tipoDocumento}
              onChange={(e) => setTipoDocumento(e.target.value)}
              className="w-full bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-900 dark:text-neutral-100 font-semibold focus:ring-2 focus:ring-[#001e40] outline-none"
            >
              {TIPOS_DOC.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-6">
            <label className="block text-[11px] font-bold text-neutral-700 dark:text-neutral-300 mb-1">
              CATEGORIA (Texto libre):
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                list="categorias-sugeridas"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value.toUpperCase())}
                placeholder="Ej: CAT 1, CAT 2, MENOR..."
                className="w-full bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-2.5 py-1.5 font-bold uppercase text-xs text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-[#001e40] outline-none"
              />
              <datalist id="categorias-sugeridas">
                {CATEGORIAS_SUGERIDAS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            {/* Accesos rápidos de categoría */}
            <div className="flex items-center gap-1 mt-1">
              {["CAT 1", "CAT 2"].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategoria(c)}
                  className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold border ${
                    categoria === c
                      ? "bg-[#001e40] text-white border-[#001e40]"
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 border-neutral-300"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Fila 3: Institución / Área de Origen (Campo Libre con Sugerencias) */}
        <div>
          <label className="block text-[11px] font-bold text-neutral-700 dark:text-neutral-300 mb-1">
            Institución / Área de Origen (Escriba o seleccione):
          </label>
          <input
            type="text"
            list="areas-sugeridas"
            value={areaOrigen}
            onChange={(e) => handleAreaSelect(e.target.value.toUpperCase())}
            placeholder="DISTRIBUCION, COMERCIAL, ADMINISTRACION, O NUEVA ÁREA..."
            className="w-full bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 font-semibold uppercase text-xs text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-[#001e40] outline-none"
          />
          <datalist id="areas-sugeridas">
            {AREAS_SUGERIDAS.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>

          {/* Chips de sugerencias rápidas */}
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            {AREAS_SUGERIDAS.slice(0, 6).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => handleAreaSelect(a)}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-all ${
                  areaOrigen === a
                    ? "bg-[#001e40] text-white border-[#001e40] font-bold"
                    : "bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:border-neutral-400"
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* Fila 4: Asunto / Descripción Corta */}
        <div>
          <label className="block text-[11px] font-bold text-neutral-700 dark:text-neutral-300 mb-1">
            Asunto / Descripción Corta: <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={2}
            value={asunto}
            onChange={(e) => setAsunto(e.target.value)}
            placeholder="SERVICIO DE INSTALACION DE 6 RECONECTADORES DE MEDIA TENCION..."
            className="w-full bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg p-2.5 uppercase font-medium text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-[#001e40] outline-none text-xs"
          />
        </div>

        {/* Fila 5: Ubicación Actual y Estado Inicial */}
        <div className="grid grid-cols-2 gap-3 pt-1 border-t border-neutral-100 dark:border-neutral-800">
          <div>
            <label className="block text-[11px] font-bold text-neutral-700 dark:text-neutral-300 mb-1">
              Ubicación Actual (Área):
            </label>
            <input
              type="text"
              list="areas-sugeridas"
              value={ubicacionActual}
              onChange={(e) => setUbicacionActual(e.target.value.toUpperCase())}
              placeholder="DISTRIBUCION..."
              className="w-full bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs uppercase font-semibold text-neutral-800 dark:text-neutral-200"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-neutral-700 dark:text-neutral-300 mb-1">
              Estado Inicial:
            </label>
            <select
              value={estadoActual}
              onChange={(e) => setEstadoActual(e.target.value as HojaRutaEstado)}
              className="w-full bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-neutral-800 dark:text-neutral-200"
            >
              <option value="En Circulación">En Circulación</option>
              <option value="En Evaluación">En Evaluación</option>
              <option value="Evaluado">Evaluado</option>
              <option value="Adjudicado">Adjudicado</option>
              <option value="Desierto">Desierto</option>
            </select>
          </div>
        </div>

        {/* SECCIÓN OPCIONAL: HISTORIAL DE CIRCULACIÓN Y CONTROL DE PASES */}
        <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center justify-between mb-1.5">
            <button
              type="button"
              onClick={() => setMostrarPases(!mostrarPases)}
              className="flex items-center gap-1.5 text-left group"
            >
              <TableProperties className="w-4 h-4 text-[#001e40] dark:text-[#feb316]" />
              <span className="font-bold text-[11px] text-[#001e40] dark:text-[#feb316] uppercase group-hover:underline">
                Historial de Circulación y Control de Pases ({pases.length} registrados)
              </span>
              {mostrarPases ? (
                <ChevronUp className="w-3.5 h-3.5 text-neutral-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
              )}
            </button>

            <button
              type="button"
              onClick={agregarPase}
              className="flex items-center gap-1 text-[11px] font-bold text-[#001e40] dark:text-[#feb316] hover:underline bg-[#feb316]/20 px-2 py-0.5 rounded"
            >
              <Plus className="w-3 h-3" />
              <span>+ Agregar Pase</span>
            </button>
          </div>

          <p className="text-[10px] text-neutral-500 italic mb-2">
            💡 <strong>Para firmas físicas:</strong> Puede registrar pases iniciales si lo desea, o crear directamente; al imprimir la Hoja de Ruta, los renglones se generan con espacios limpios para que firmen y sellen manualmente al recibir la carpeta.
          </p>

          {mostrarPases && (
            <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-700 rounded-lg">
              <table className="w-full text-[11px] border-collapse text-left">
                <thead>
                  <tr className="bg-[#001e40]/5 dark:bg-[#001e40]/40 text-[#001e40] dark:text-neutral-200 font-bold border-b border-neutral-200 dark:border-neutral-700">
                    <th className="p-1.5 w-8 text-center">Nº</th>
                    <th className="p-1.5 w-36">Area / Depto. Destino</th>
                    <th className="p-1.5 w-24">Fecha Recibo</th>
                    <th className="p-1.5 w-16">Hora</th>
                    <th className="p-1.5">Firma de Recibido</th>
                    <th className="p-1.5 w-8 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                  {pases.map((p, idx) => (
                    <tr key={idx} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                      <td className="p-1.5 text-center font-bold text-neutral-600 dark:text-neutral-400">
                        {p.pase}
                      </td>
                      <td className="p-1">
                        <input
                          type="text"
                          value={p.destino}
                          onChange={(e) =>
                            handlePaseChange(idx, "destino", e.target.value.toUpperCase())
                          }
                          placeholder="Área destino"
                          className="w-full px-2 py-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded text-[11px] uppercase font-semibold text-neutral-800 dark:text-neutral-200 outline-none focus:border-[#001e40]"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          type="date"
                          value={p.fecha}
                          onChange={(e) =>
                            handlePaseChange(idx, "fecha", e.target.value)
                          }
                          className="w-full px-1.5 py-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded text-[10px] font-mono text-neutral-800 dark:text-neutral-200 outline-none"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          type="text"
                          value={p.hora}
                          onChange={(e) =>
                            handlePaseChange(idx, "hora", e.target.value)
                          }
                          placeholder="08:30"
                          className="w-full px-1.5 py-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded text-[10px] font-mono text-neutral-800 dark:text-neutral-200 outline-none"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          type="text"
                          value={p.firma}
                          onChange={(e) =>
                            handlePaseChange(idx, "firma", e.target.value)
                          }
                          placeholder="Nombre / Cargo que recibe"
                          className="w-full px-2 py-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded text-[11px] text-neutral-800 dark:text-neutral-200 outline-none"
                        />
                      </td>
                      <td className="p-1 text-center">
                        {pases.length > 1 && (
                          <button
                            type="button"
                            onClick={() => eliminarPase(idx)}
                            className="p-1 text-neutral-400 hover:text-red-600 rounded"
                            title="Eliminar pase"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Botón Principal de Enviar a Lista */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={submitting || !asunto.trim()}
            className="w-full py-2.5 bg-[#001e40] hover:bg-[#003366] text-white font-bold rounded-lg shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-xs uppercase tracking-wider border-b-2 border-[#feb316]"
          >
            {submitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Registrando en Sistema...</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 text-[#feb316]" />
                <span>Enviar Hoja de Ruta al Control Máster</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
