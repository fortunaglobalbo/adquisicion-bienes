"use client";

import React, { useState } from "react";
import { HojaRuta, HojaRutaEstado } from "@/lib/types/hojaRuta";
import { HojaRutaService } from "@/lib/services/hojaRutaService";
import {
  Search,
  Printer,
  Trash2,
  Clock,
  CheckCircle,
  AlertTriangle,
  FileText,
  Filter,
} from "lucide-react";

interface Props {
  hojas: HojaRuta[];
  onUpdateEstado: (id: string, nuevoEstado: HojaRutaEstado) => void;
  onPrint: (hoja: HojaRuta) => void;
  onPrintGeneral?: (items: HojaRuta[]) => void;
  onDelete: (id: string) => void;
}

export const TablaSeguimientoMaster: React.FC<Props> = ({
  hojas,
  onUpdateEstado,
  onPrint,
  onPrintGeneral,
  onDelete,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterEstado, setFilterEstado] = useState<string>("TODOS");
  const [filterArea, setFilterArea] = useState<string>("TODAS");

  // Filtrado reactivo
  const filtered = hojas.filter((h) => {
    const matchSearch =
      h.cite_correlativo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      h.asunto_descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
      h.ubicacion_actual.toLowerCase().includes(searchTerm.toLowerCase());

    const matchEstado =
      filterEstado === "TODOS" || h.estado_actual === filterEstado;
    const matchArea =
      filterArea === "TODAS" ||
      h.ubicacion_actual === filterArea ||
      h.institucion_area_origen === filterArea;

    return matchSearch && matchEstado && matchArea;
  });

  // Métricas rápidas
  const total = hojas.length;
  const enCirculacion = hojas.filter((h) => h.estado_actual === "En Circulación").length;
  const enEvaluacion = hojas.filter((h) => h.estado_actual === "En Evaluación").length;
  const adjudicados = hojas.filter((h) => h.estado_actual === "Adjudicado").length;
  const desiertos = hojas.filter((h) => h.estado_actual === "Desierto").length;

  const getEstadoBadgeClass = (estado: HojaRutaEstado) => {
    switch (estado) {
      case "Adjudicado":
        return "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300";
      case "En Circulación":
        return "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300";
      case "En Evaluación":
        return "bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-300";
      case "Evaluado":
        return "bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-300";
      case "Desierto":
        return "bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 border-red-300";
      default:
        return "bg-neutral-100 text-neutral-800 border-neutral-300";
    }
  };

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden flex flex-col h-full">
      {/* Encabezado Oficial ENDE Deoruro */}
      <div className="bg-[#001e40] text-white px-5 py-3 flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#feb316]">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-ende-deoruro.png"
            alt="ENDE DEORURO S.A."
            className="h-8 w-auto bg-white p-1 rounded"
          />
          <div>
            <h2 className="text-base font-black tracking-wide uppercase">
              CONTROL DE CORRESPONDENCIA Y SEGUIMIENTO MÁSTER
            </h2>
            <p className="text-xs italic text-blue-100 mt-0.5">
              Historial acumulado de hojas de ruta enviadas al sistema
            </p>
          </div>
        </div>

        {/* Acciones y Métricas en cabecera */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          {onPrintGeneral && (
            <button
              onClick={() => onPrintGeneral(filtered)}
              className="flex items-center gap-1.5 bg-[#feb316] hover:bg-[#e09c0d] text-[#001e40] font-black px-3.5 py-1.5 rounded-lg shadow-sm transition-all text-xs uppercase tracking-wider"
              title="Imprimir el reporte de correspondencia completo en tamaño Carta"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir Todo (Carta)</span>
            </button>
          )}

          <span className="bg-white/15 px-2.5 py-1.5 rounded font-sans">
            Total: <strong>{total}</strong>
          </span>
          <span className="bg-emerald-500/30 text-emerald-100 px-2.5 py-1.5 rounded font-sans">
            Adjudicados: <strong>{adjudicados}</strong>
          </span>
          <span className="bg-amber-500/30 text-amber-100 px-2.5 py-1.5 rounded font-sans">
            En Circulación: <strong>{enCirculacion}</strong>
          </span>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/50 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Buscar por CITE, Asunto o Área..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs outline-none focus:ring-2 focus:ring-[#001e40]"
          />
        </div>

        {/* Filtro de Estados */}
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-neutral-400" />
          <select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value)}
            className="bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs font-medium outline-none"
          >
            <option value="TODOS">Todos los Estados</option>
            <option value="En Circulación">En Circulación</option>
            <option value="En Evaluación">En Evaluación</option>
            <option value="Evaluado">Evaluado</option>
            <option value="Adjudicado">Adjudicado</option>
            <option value="Desierto">Desierto</option>
          </select>
        </div>
      </div>

      {/* Tabla Máster */}
      <div className="flex-1 overflow-x-auto overflow-y-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="bg-neutral-100 dark:bg-neutral-800/60 text-neutral-700 dark:text-neutral-300 font-bold border-b border-neutral-200 dark:border-neutral-800">
              <th className="py-2.5 px-3 w-12 text-center">ID</th>
              <th className="py-2.5 px-3 w-36">Nº Trámite / Correlativo</th>
              <th className="py-2.5 px-3">Asunto / Descripción Corta</th>
              <th className="py-2.5 px-3 w-36">Ubicación Actual (Área)</th>
              <th className="py-2.5 px-3 w-40">Estado Actual</th>
              <th className="py-2.5 px-3 w-28 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-neutral-400">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  No se encontraron trámites registrados con los filtros aplicados.
                </td>
              </tr>
            ) : (
              filtered.map((item, index) => (
                <tr
                  key={item.id}
                  className="hover:bg-orange-50/40 dark:hover:bg-orange-950/10 transition-colors group"
                >
                  {/* ID */}
                  <td className="py-3 px-3 text-center font-mono font-bold text-neutral-500">
                    {index + 1}
                  </td>

                  {/* CITE Correlativo */}
                  <td className="py-3 px-3 font-mono font-black text-neutral-900 dark:text-neutral-100">
                    <div className="flex items-center gap-1.5">
                      <span>{item.cite_correlativo}</span>
                    </div>
                    <span className="text-[10px] text-neutral-400 block font-sans font-normal">
                      Ingreso: {item.fecha_ingreso}
                    </span>
                  </td>

                  {/* Asunto y Categoría */}
                  <td className="py-3 px-3">
                    <div className="font-medium uppercase text-neutral-900 dark:text-neutral-200 line-clamp-2">
                      {item.asunto_descripcion}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 px-1.5 py-0.5 rounded text-[10px] font-bold">
                        {item.categoria}
                      </span>
                      <span className="text-[10px] text-neutral-400">
                        {item.tipo_documento}
                      </span>
                    </div>
                  </td>

                  {/* Ubicación Actual */}
                  <td className="py-3 px-3 font-semibold uppercase text-neutral-700 dark:text-neutral-300">
                    {item.ubicacion_actual || item.institucion_area_origen}
                  </td>

                  {/* Estado Actual y Fecha Adjudicación */}
                  <td className="py-3 px-3">
                    <select
                      value={item.estado_actual}
                      onChange={(e) =>
                        onUpdateEstado(item.id, e.target.value as HojaRutaEstado)
                      }
                      className={`w-full py-1 px-2 rounded-md font-bold text-xs border outline-none cursor-pointer ${getEstadoBadgeClass(
                        item.estado_actual
                      )}`}
                    >
                      <option value="En Circulación">En Circulación</option>
                      <option value="En Evaluación">En Evaluación</option>
                      <option value="Evaluado">Evaluado</option>
                      <option value="Adjudicado">Adjudicado</option>
                      <option value="Desierto">Desierto</option>
                    </select>

                    {item.estado_actual === "Adjudicado" && (
                      <div className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-1 font-mono font-semibold flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>
                          {item.fecha_adjudicacion
                            ? new Date(item.fecha_adjudicacion).toLocaleString("es-BO", {
                                dateStyle: "short",
                                timeStyle: "short",
                              })
                            : "Fecha sellada"}
                        </span>
                      </div>
                    )}
                  </td>

                  {/* Acciones */}
                  <td className="py-3 px-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => onPrint(item)}
                        title="Imprimir Hoja de Ruta para carpeta"
                        className="p-1.5 bg-blue-50 dark:bg-neutral-800 text-[#001e40] dark:text-[#feb316] hover:bg-[#001e40] hover:text-white rounded-md transition-colors"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (
                            confirm(
                              `¿Eliminar la hoja de ruta ${item.cite_correlativo}?`
                            )
                          ) {
                            onDelete(item.id);
                          }
                        }}
                        title="Eliminar registro"
                        className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-neutral-800 rounded-md transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
