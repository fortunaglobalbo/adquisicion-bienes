"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Trash2, AlertTriangle } from "lucide-react";
import type { Adquisicion, CategoriaAdquisicion } from "@/types";
import { formatCurrencyBs } from "@/lib/docx/formatters";
import { Modal } from "../ui/Modal";
import { EstadoEditable } from '../ui/EstadoEditable';
import { estadoAdquisicion } from '@/lib/adquisicionEstado';
import { adquisicionesRecientes } from '@/lib/adquisicionOrder';

interface AcquisitionsTableProps {
  adquisiciones: Adquisicion[];
  searchTerm?: string;
  activeGroup: ProcessGroup;
  onGroupChange: (group: ProcessGroup) => void;
  onAdquisicionDeleted?: (id: string) => void;
  onUpdateEstado: (id:string, estado:string) => Promise<void>;
}

const processGroups = {
  compras: { title: "Compras", description: "Bienes y obras", categories: ["Bienes", "Obras"] },
  servicios: { title: "Servicios", description: "Servicios y consultorías", categories: ["Servicios", "Consultorías"] },
} satisfies Record<string, { title: string; description: string; categories: CategoriaAdquisicion[] }>;

export type ProcessGroup = keyof typeof processGroups;
const groupKeys: ProcessGroup[] = ["compras", "servicios"];

export function acquisitionProcessGroup(category: CategoriaAdquisicion): ProcessGroup {
  return category === "Servicios" || category === "Consultorías" ? "servicios" : "compras";
}

export const AcquisitionsTable: React.FC<AcquisitionsTableProps> = ({
  adquisiciones,
  searchTerm = "",
  activeGroup,
  onGroupChange,
  onAdquisicionDeleted,
  onUpdateEstado,
}) => {
  const router = useRouter();
  const [categoryFilters, setCategoryFilters] = useState<Record<ProcessGroup, string>>({ compras: "ALL", servicios: "ALL" });
  const [estadoFilter, setEstadoFilter] = useState<string>("");
  const [deletingItem, setDeletingItem] = useState<Adquisicion | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const safeList = adquisicionesRecientes(Array.isArray(adquisiciones) ? adquisiciones : []);
  const estados=Array.from(new Set([...safeList.filter(Boolean).map(estadoAdquisicion),estadoFilter])).filter(Boolean).sort((a,b)=>a.localeCompare(b,'es'));

  const groups: Record<ProcessGroup, Adquisicion[]> = { compras: [], servicios: [] };
  for (const item of safeList) {
    if (!item) continue;
    groups[acquisitionProcessGroup(item.categoria)].push(item);
  }

  const search = searchTerm.trim().toLowerCase();
  const matching = (group: ProcessGroup) => groups[group].filter((item) => {
    const matchSearch =
      !search ||
      (item.codigo || "").toLowerCase().includes(search) ||
      (item.titulo_proceso || "").toLowerCase().includes(search) ||
      (item.partida_presupuestaria || "").toLowerCase().includes(search) ||
      estadoAdquisicion(item).toLowerCase().includes(search);

    const matchCategoria = categoryFilters[group] === "ALL" || item.categoria === categoryFilters[group];
    const matchEstado = estadoFilter === "" || estadoAdquisicion(item) === estadoFilter;

    return matchSearch && matchCategoria && matchEstado;
  });
  const matches = { compras: matching("compras"), servicios: matching("servicios") };
  const filtered = matches[activeGroup];
  const group = processGroups[activeGroup];


  const handleDeleteConfirm = () => {
    if (!deletingItem) return;
    setIsDeleting(true);
    setTimeout(() => {
      onAdquisicionDeleted?.(deletingItem.id);
      setIsDeleting(false);
      setDeletingItem(null);
    }, 400);
  };


  return (
    <>
      <div role="group" aria-label="Tipo de proceso" className="mb-4 grid grid-cols-2 gap-2 sm:gap-3">
        {groupKeys.map((key) => {
          const selected = key === activeGroup;
          const view = processGroups[key];
          return (
            <button
              type="button"
              key={key}
              onClick={() => onGroupChange(key)}
              aria-pressed={selected}
              aria-controls="lista-procesos"
              className={`flex min-w-0 items-start justify-between gap-2 rounded-lg border px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:px-4 ${selected ? "border-primary bg-primary text-on-primary" : "border-outline-variant bg-surface-container-lowest text-on-surface hover:border-primary hover:bg-surface-container-low"}`}
            >
              <span>
                <span className="block text-sm font-bold sm:text-base">{view.title}</span>
                <span className={`block text-xs ${selected ? "text-on-primary" : "text-on-surface-variant"}`}>{view.description}</span>
              </span>
              <span className={`rounded px-2 py-0.5 text-xs tabular-nums ${selected ? "bg-white/20" : "bg-surface-container-high"}`}>{matches[key].length}</span>
            </button>
          );
        })}
      </div>
      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg flex flex-col shadow-institutional">
        {/* Table Header & Filters */}
        <div className="p-4 border-b border-outline-variant flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-surface-bright rounded-t-lg">
          <div>
            <h3 className="font-headline-md text-lg font-bold text-on-surface">
              Expedientes de {group.title.toLowerCase()}
            </h3>
            <p className="font-sans text-xs text-on-surface-variant">
              {filtered.length} de {groups[activeGroup].length} procesos listados
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Categoria Selector */}
            <select
              aria-label="Filtrar expedientes por categoría"
              value={categoryFilters[activeGroup]}
              onChange={(event) => {
                const value = event.target.value;
                setCategoryFilters((filters) => ({ ...filters, [activeGroup]: value }));
              }}
              className="border border-outline-variant rounded bg-surface text-on-surface font-mono text-xs py-1.5 px-3 focus:border-primary focus:ring-0 focus:border-b-2"
            >
              <option value="ALL">Categoría: Todas</option>
              {group.categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>

            {/* Estado Selector */}
            <select
              aria-label="Filtrar expedientes por estado"
              value={estadoFilter}
              onChange={(e) => setEstadoFilter(e.target.value)}
              className="border border-outline-variant rounded bg-surface text-on-surface font-mono text-xs py-1.5 px-3 focus:border-primary focus:ring-0 focus:border-b-2"
            >
              <option value="">Estado: Todos</option>
              {estados.map(estado=><option key={estado} value={estado}>{estado}</option>)}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table id="lista-procesos" aria-label={`Expedientes de ${group.title.toLowerCase()}`} className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline-variant bg-surface-container-low font-mono text-[11px] text-on-surface-variant uppercase tracking-wider">
                <th className="p-3.5 font-semibold whitespace-nowrap">Código</th>
                <th className="p-3.5 font-semibold min-w-[280px]">Título del Proceso</th>
                <th className="p-3.5 font-semibold">Categoría</th>
                <th className="p-3.5 font-semibold">Estado</th>
                <th className="p-3.5 font-semibold text-right whitespace-nowrap">Presupuesto (Bs.)</th>
                <th className="p-3.5 font-semibold text-center whitespace-nowrap">Fecha Inicio</th>
                <th className="p-3.5 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="font-sans text-sm text-on-surface divide-y divide-outline-variant">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-on-surface-variant font-mono text-xs">
                    No se encontraron expedientes con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => router.push(`/expediente/${item.id}`)}
                    className="hover:bg-surface-container-low/70 cursor-pointer transition-colors group"
                  >
                    <td className="p-3.5 font-mono text-xs font-bold text-primary whitespace-nowrap">
                      <span className="bg-surface-container-high px-2 py-0.5 rounded border border-outline-variant group-hover:border-primary transition-colors">
                        {item.codigo}
                      </span>
                    </td>
                    <td className="p-3.5 font-medium">
                      <div className="text-on-surface group-hover:text-primary font-semibold transition-colors">
                        {item.titulo_proceso}
                      </div>
                      <div className="text-xs text-on-surface-variant font-mono mt-0.5">
                        {item.partida_presupuestaria || "Partida 39500"} • {item.unidad_solicitante}
                      </div>
                    </td>
                    <td className="p-3.5 text-xs text-on-surface-variant whitespace-nowrap">
                      {item.categoria}
                    </td>
                    <td className="p-3.5 min-w-[200px] cursor-text" onClick={e=>e.stopPropagation()}>
                      <EstadoEditable value={estadoAdquisicion(item)} label={`Estado de ${item.codigo}`}
                        onSave={estado=>onUpdateEstado(item.id,estado)}
                        className="w-full min-w-[170px] rounded border border-outline-variant bg-surface text-on-surface font-mono text-xs px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary"/>
                    </td>
                    <td className="p-3.5 text-right font-mono text-xs font-semibold text-primary whitespace-nowrap">
                      {formatCurrencyBs(item.prevision_presupuesto)}
                    </td>
                    <td className="p-3.5 text-center text-on-surface-variant font-mono text-xs whitespace-nowrap">
                      {item.fecha_inicio}
                    </td>
                    <td className="p-3.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-1.5">
                        <Link
                          href={`/expediente/${item.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-mono font-semibold text-primary bg-surface-container-high hover:bg-primary hover:text-on-primary rounded transition-all"
                          title="Abrir y gestionar expediente"
                        >
                          <span>Abrir</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>

                        <button
                          type="button"
                          onClick={() => setDeletingItem(item)}
                          className="p-1.5 text-error hover:bg-red-100 hover:text-red-700 rounded transition-colors"
                          title="Eliminar este expediente"
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

        {/* Table Footer */}
        <div className="p-3.5 border-t border-outline-variant flex justify-between items-center bg-surface-container-lowest rounded-b-lg font-mono text-xs text-on-surface-variant">
          <span>Mostrando {filtered.length} expedientes</span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-outline">Distribuidora de Electricidad ENDE DEORURO S.A.</span>
          </div>
        </div>
      </div>

      {/* Confirmation Modal to Delete Acquisition */}
      <Modal
        isOpen={!!deletingItem}
        onClose={() => !isDeleting && setDeletingItem(null)}
        title="¿Eliminar Expediente de Adquisición?"
        subtitle="Esta acción es irreversible y eliminará el expediente completo con sus 8 carpetas y documentos asociados."
        maxWidth="md"
      >
        {deletingItem && (
          <div className="space-y-4 text-xs font-sans">
            <div className="p-3 bg-red-50 border border-red-200 rounded flex items-start gap-3 text-red-900">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm">
                  {deletingItem.codigo}: {deletingItem.titulo_proceso}
                </p>
                <p className="text-[11px] text-red-700 mt-1">
                  Presupuesto: {formatCurrencyBs(deletingItem.prevision_presupuesto)} • Unidad: {deletingItem.unidad_solicitante}
                </p>
              </div>
            </div>

            <p className="text-on-surface-variant">
              ¿Confirmas que deseas eliminar definitivamente este expediente del sistema?
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingItem(null)}
                className="px-4 py-2 border border-outline-variant rounded font-mono text-xs text-on-surface-variant hover:bg-surface-container-high"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
                className="flex items-center gap-1.5 px-4 py-2 bg-error hover:bg-red-700 text-white rounded font-bold text-xs transition-colors shadow-sm disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeleting ? "Eliminando..." : "Sí, Eliminar Expediente"}</span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};
