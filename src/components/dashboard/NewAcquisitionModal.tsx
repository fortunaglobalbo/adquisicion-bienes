"use client";

import React, { useState } from "react";
import { Plus, Trash2, CheckCircle, Sparkles, AlertCircle } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Adquisicion, CategoriaAdquisicion, ItemAdquisicion } from "@/types";
import { formatCurrencyBs, numeroALiteralBs } from "@/lib/docx/formatters";

interface NewAcquisitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (newAdq: Adquisicion) => void;
  nextCodigo: string;
}

export const NewAcquisitionModal: React.FC<NewAcquisitionModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  nextCodigo,
}) => {
  const [codigo, setCodigo] = useState(nextCodigo);
  const [titulo, setTitulo] = useState("");
  const [categoria, setCategoria] = useState<CategoriaAdquisicion>("Bienes");
  const [modalidad, setModalidad] = useState("Menor Precio (Art. 31 Reglamento SBC)");
  const [partida, setPartida] = useState("39500 - Materiales y Suministros Eléctricos");
  const [unidad, setUnidad] = useState("Departamento Técnico de Mantenimiento");
  const [responsable, setResponsable] = useState("Ing. Heydi Canaviri Padilla");
  const [plazoDias, setPlazoDias] = useState<number>(30);
  const [lugarEntrega, setLugarEntrega] = useState("Almacenes ENDE DEORURO S.A., Oruro");
  const [presupuestoEstimadoManual, setPresupuestoEstimadoManual] = useState<number>(0);

  // Items are completely OPTIONAL
  const [items, setItems] = useState<ItemAdquisicion[]>([]);

  const handleAddItem = () => {
    const nextNum = items.length + 1;
    setItems([
      ...items,
      {
        id: `item-${Date.now()}-${nextNum}`,
        item: nextNum,
        descripcion: "",
        unidad: "PZA",
        cantidad: 1,
        precioUnitarioEstimado: 0,
        precioTotalEstimado: 0,
      },
    ]);
  };

  const handleRemoveItem = (id: string) => {
    const filtered = items.filter((it) => it.id !== id).map((it, idx) => ({ ...it, item: idx + 1 }));
    setItems(filtered);
  };

  const handleItemChange = (id: string, field: keyof ItemAdquisicion, val: any) => {
    setItems(
      items.map((it) => {
        if (it.id !== id) return it;
        const updated = { ...it, [field]: val };
        if (field === "cantidad" || field === "precioUnitarioEstimado") {
          const c = field === "cantidad" ? Number(val) : it.cantidad;
          const pu = field === "precioUnitarioEstimado" ? Number(val) : it.precioUnitarioEstimado;
          updated.precioTotalEstimado = (Number(c) || 0) * (Number(pu) || 0);
        }
        return updated;
      })
    );
  };

  const itemsTotalPresupuesto = items.reduce((sum, it) => sum + (Number(it.precioTotalEstimado) || 0), 0);
  const totalPresupuesto = items.length > 0 ? itemsTotalPresupuesto : presupuestoEstimadoManual;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim() || !codigo.trim()) {
      alert("Por favor complete el código y el título del proceso.");
      return;
    }

    const newAdqData: Omit<Adquisicion, "id" | "fecha_creacion" | "fecha_actualizacion"> = {
      codigo,
      titulo_proceso: titulo,
      categoria,
      modalidad,
      partida_presupuestaria: partida,
      estado: "Iniciado",
      prevision_presupuesto: totalPresupuesto > 0 ? totalPresupuesto : 0,
      moneda: "BOB",
      fecha_inicio: new Date().toISOString().split("T")[0],
      unidad_solicitante: unidad,
      responsable_proceso: responsable,
      creado_por: "admin@ende-deoruro.bo",
      plazo_entrega_dias: Number(plazoDias) || 30,
      multa_diaria_porcentaje: 0.25,
      lugar_entrega: lugarEntrega,
      items,
    };

    onCreated(newAdqData as Adquisicion);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Nuevo Expediente de Adquisición"
      subtitle="Distribuidora de Electricidad ENDE Deoruro S.A. - Creación de Proceso"
      maxWidth="3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Basic Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-mono font-bold text-on-surface mb-1">
              Código Único del Proceso *
            </label>
            <input
              type="text"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              required
              className="w-full px-3 py-2 border border-outline-variant rounded font-mono text-sm bg-surface focus:border-primary focus:border-b-2"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-mono font-bold text-on-surface mb-1">
              Título / Objeto de la Adquisición *
            </label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej: ADQUISICIÓN DE HERRAMIENTA PARA CUADRILLAS"
              required
              className="w-full px-3 py-2 border border-outline-variant rounded text-sm bg-surface focus:border-primary focus:border-b-2 uppercase font-medium"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-mono font-bold text-on-surface mb-1">
              Categoría
            </label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as CategoriaAdquisicion)}
              className="w-full px-3 py-2 border border-outline-variant rounded text-sm bg-surface focus:border-primary font-mono"
            >
              <option value="Bienes">Bienes</option>
              <option value="Servicios">Servicios</option>
              <option value="Obras">Obras</option>
              <option value="Consultorías">Consultorías</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-mono font-bold text-on-surface mb-1">
              Partida Presupuestaria
            </label>
            <input
              type="text"
              value={partida}
              onChange={(e) => setPartida(e.target.value)}
              className="w-full px-3 py-2 border border-outline-variant rounded text-sm bg-surface focus:border-primary font-mono text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-bold text-on-surface mb-1">
              Plazo de Entrega (Días)
            </label>
            <input
              type="number"
              value={plazoDias}
              onChange={(e) => setPlazoDias(Number(e.target.value))}
              max={180}
              className="w-full px-3 py-2 border border-outline-variant rounded text-sm bg-surface focus:border-primary font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-mono font-bold text-on-surface mb-1">
              Unidad Solicitante
            </label>
            <input
              type="text"
              value={unidad}
              onChange={(e) => setUnidad(e.target.value)}
              className="w-full px-3 py-2 border border-outline-variant rounded text-sm bg-surface focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-bold text-on-surface mb-1">
              Responsable del Proceso
            </label>
            <input
              type="text"
              value={responsable}
              onChange={(e) => setResponsable(e.target.value)}
              className="w-full px-3 py-2 border border-outline-variant rounded text-sm bg-surface focus:border-primary"
            />
          </div>
        </div>

        {/* Items Section - COMPLETELY OPTIONAL */}
        <div className="border border-outline-variant rounded-lg p-4 bg-surface-container-low">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-mono text-xs font-bold text-primary uppercase tracking-wider">
                  Ítems del Suministro
                </h4>
                <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded font-mono text-[10px] font-bold">
                  OPCIONAL
                </span>
              </div>
              <p className="text-[11px] text-on-surface-variant mt-0.5">
                Puedes dejarlo vacío. En la <strong>Carpeta 1</strong> podrás subir una <strong>foto o documento</strong> y la IA extraerá todos los ítems automáticamente.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddItem}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono bg-primary text-on-primary rounded hover:bg-primary-container transition-colors shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Añadir Ítem Manual</span>
            </button>
          </div>

          {items.length === 0 ? (
            <div className="p-4 border-2 border-dashed border-outline-variant/60 rounded bg-white text-center space-y-2">
              <Sparkles className="w-6 h-6 text-amber-500 mx-auto" />
              <p className="font-sans text-xs text-on-surface-variant">
                No has agregado ítems manuales (opcional). Podrás <strong>subir una foto o documento en la Carpeta 1</strong> para que la IA extraiga los ítems con sus fichas técnicas.
              </p>
              <div className="pt-2 flex justify-center items-center gap-2">
                <label className="text-[11px] font-mono text-outline">Presupuesto Referencial Estimado (Bs.):</label>
                <input
                  type="number"
                  value={presupuestoEstimadoManual || ""}
                  onChange={(e) => setPresupuestoEstimadoManual(Number(e.target.value))}
                  placeholder="0.00"
                  className="w-32 px-2 py-1 border border-outline-variant rounded font-mono text-xs text-right font-bold"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {items.map((it) => (
                <div
                  key={it.id}
                  className="grid grid-cols-12 gap-2 items-center p-2 bg-surface-container-lowest border border-outline-variant rounded"
                >
                  <div className="col-span-1 text-center font-mono font-bold text-xs text-primary">
                    #{it.item}
                  </div>
                  <div className="col-span-5">
                    <input
                      type="text"
                      value={it.descripcion}
                      onChange={(e) => handleItemChange(it.id, "descripcion", e.target.value)}
                      placeholder="Descripción técnica del ítem"
                      required
                      className="w-full px-2 py-1 border border-outline-variant rounded text-xs uppercase"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="text"
                      value={it.unidad}
                      onChange={(e) => handleItemChange(it.id, "unidad", e.target.value)}
                      placeholder="Unidad (PZA)"
                      className="w-full px-2 py-1 border border-outline-variant rounded text-xs text-center uppercase"
                    />
                  </div>
                  <div className="col-span-1">
                    <input
                      type="number"
                      value={it.cantidad}
                      onChange={(e) => handleItemChange(it.id, "cantidad", e.target.value)}
                      min={1}
                      className="w-full px-1 py-1 border border-outline-variant rounded text-xs text-center font-mono"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      value={it.precioUnitarioEstimado}
                      onChange={(e) => handleItemChange(it.id, "precioUnitarioEstimado", e.target.value)}
                      placeholder="P. Unit (Bs)"
                      className="w-full px-2 py-1 border border-outline-variant rounded text-xs text-right font-mono"
                    />
                  </div>
                  <div className="col-span-1 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(it.id)}
                      className="text-error hover:text-red-700 p-1"
                      title="Quitar ítem"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              <div className="mt-3 pt-2 border-t border-outline-variant flex justify-between items-center">
                <div className="text-xs text-on-surface-variant font-mono">
                  Total Estimado: <span className="text-primary font-bold">{numeroALiteralBs(itemsTotalPresupuesto)}</span>
                </div>
                <div className="font-mono text-base font-bold text-primary">
                  {formatCurrencyBs(itemsTotalPresupuesto)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-3 pt-3 border-t border-outline-variant">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-outline-variant rounded text-xs font-mono text-on-surface-variant hover:bg-surface-container-high transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="flex items-center gap-2 px-5 py-2 bg-primary text-on-primary rounded text-xs font-mono font-bold hover:bg-primary-container transition-colors shadow-institutional"
          >
            <CheckCircle className="w-4 h-4" />
            <span>Crear Expediente e Instanciar 8 Carpetas</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
