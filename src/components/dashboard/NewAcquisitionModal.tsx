"use client";

import React, { useState, useEffect } from "react";
import { CheckCircle } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Adquisicion, CategoriaAdquisicion } from "@/types";

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
  const [unidad, setUnidad] = useState("Departamento Técnico de Mantenimiento");
  const [responsable, setResponsable] = useState("Ing. Heydi Canaviri Padilla");
  const [plazoDias, setPlazoDias] = useState<number>(30);
  const [lugarEntrega, setLugarEntrega] = useState("Almacenes ENDE DEORURO S.A., Oruro");
  const [presupuestoEstimadoManual, setPresupuestoEstimadoManual] = useState<number>(0);

  // Sincronizar automáticamente el siguiente código cuando abre el modal o cambian los registros
  useEffect(() => {
    if (isOpen) {
      setCodigo(nextCodigo);
    }
  }, [isOpen, nextCodigo]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim() || !codigo.trim()) {
      alert("Por favor complete el código y el título del proceso.");
      return;
    }

    const newAdqData: Omit<Adquisicion, "id" | "fecha_creacion" | "fecha_actualizacion"> = {
      codigo: codigo.trim(),
      titulo_proceso: titulo.trim(),
      categoria,
      modalidad,
      partida_presupuestaria: "",
      estado: "Iniciado",
      prevision_presupuesto: Number(presupuestoEstimadoManual) || 0,
      moneda: "BOB",
      fecha_inicio: new Date().toISOString().split("T")[0],
      unidad_solicitante: unidad,
      responsable_proceso: responsable,
      creado_por: "admin@ende-deoruro.bo",
      plazo_entrega_dias: Number(plazoDias) || 30,
      multa_diaria_porcentaje: 0.25,
      lugar_entrega: lugarEntrega,
      items: [],
    };

    onCreated(newAdqData as Adquisicion);
    setTitulo("");
    setPresupuestoEstimadoManual(0);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Nuevo Expediente de Adquisición"
      subtitle="Distribuidora de Electricidad ENDE Deoruro S.A. - Creación de Proceso"
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
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
              className="w-full px-3 py-2 border border-outline-variant rounded font-mono text-sm bg-surface focus:border-primary focus:border-b-2 font-bold text-primary"
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-mono font-bold text-on-surface mb-1">
              Lugar de Entrega
            </label>
            <input
              type="text"
              value={lugarEntrega}
              onChange={(e) => setLugarEntrega(e.target.value)}
              className="w-full px-3 py-2 border border-outline-variant rounded text-sm bg-surface focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-bold text-on-surface mb-1">
              Presupuesto Estimado (Bs. Opcional)
            </label>
            <input
              type="number"
              value={presupuestoEstimadoManual || ""}
              onChange={(e) => setPresupuestoEstimadoManual(Number(e.target.value))}
              placeholder="0.00"
              className="w-full px-3 py-2 border border-outline-variant rounded font-mono text-sm bg-surface focus:border-primary text-right font-bold"
            />
          </div>
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
