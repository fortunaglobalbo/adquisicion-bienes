"use client";

import React, { useState } from "react";
import { Adquisicion, ItemAdquisicion } from "@/types";
import { formatCurrencyBs, numeroALiteralBs } from "@/lib/docx/formatters";
import {
  Save,
  Plus,
  Trash2,
  Calendar,
  DollarSign,
  UserCheck,
  FileText,
  Wrench,
  Percent,
  CheckCircle2,
  X,
} from "lucide-react";

interface TdrDocumentEditorProps {
  adquisicion: Adquisicion;
  onSave: (updatedAdq: Adquisicion) => void;
  onClose: () => void;
}

export const TdrDocumentEditor: React.FC<TdrDocumentEditorProps> = ({
  adquisicion,
  onSave,
  onClose,
}) => {
  const [titulo, setTitulo] = useState(adquisicion.titulo_proceso || "");
  const [revision, setRevision] = useState(adquisicion.revision || "Rev. N° 1");
  const [mesAnio, setMesAnio] = useState(adquisicion.mes_anio_documento || "Mayo - 2026");
  const [fechaInicio, setFechaInicio] = useState(adquisicion.fecha_inicio || "2026-05-15");
  const [plazoDias, setPlazoDias] = useState(adquisicion.plazo_entrega_dias || 120);
  const [multaPorcentaje, setMultaPorcentaje] = useState(adquisicion.multa_diaria_porcentaje || 0.25);
  const [partida, setPartida] = useState(adquisicion.partida_presupuestaria || "39500 - Herramientas Menores");
  const [lugarEntrega, setLugarEntrega] = useState(adquisicion.lugar_entrega || "Almacenes ENDE DEORURO S.A.");

  const [elaborado, setElaborado] = useState(adquisicion.elaborado_por || "Heydi Canaviri Padilla");
  const [revisado, setRevisado] = useState(adquisicion.revisado_por || "Heydi Canaviri Padilla");
  const [aprobado, setAprobado] = useState(adquisicion.aprobado_por || "Lic. Raul Alberto Torrico Gomez");

  const [antecedentes, setAntecedentes] = useState(adquisicion.antecedentes_texto || "");
  const [justificacion, setJustificacion] = useState(adquisicion.justificacion_texto || "");
  const [formaPago, setFormaPago] = useState(adquisicion.forma_pago_texto || "");
  const [calidad, setCalidad] = useState(adquisicion.calidad_texto || "");

  const [items, setItems] = useState<ItemAdquisicion[]>(adquisicion.items || []);
  const [activeTab, setActiveTab] = useState<"general" | "items" | "clausulas" | "firmas">("general");

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

  const handleFichaTecnicaChange = (id: string, field: string, val: any) => {
    setItems(
      items.map((it) => {
        if (it.id !== id) return it;
        return {
          ...it,
          fichaTecnica: {
            ...it.fichaTecnica,
            [field]: val,
          },
        };
      })
    );
  };

  const handleAddItem = () => {
    const nextNum = items.length + 1;
    setItems([
      ...items,
      {
        id: `item-${Date.now()}`,
        item: nextNum,
        descripcion: `Nueva Herramienta #${nextNum}`,
        unidad: "PZA",
        cantidad: 1,
        precioUnitarioEstimado: 1000,
        precioTotalEstimado: 1000,
        fichaTecnica: {
          uso: "Personal Operativo",
          normaCertificacion: "N/A",
          material: "Acero reforzado",
          color: "N/A",
          aceptacionLote: "El personal de ENDE DEORURO, realizara una evaluación preliminar el día de la entrega.",
          categoriaItem: "Herramienta",
          dimensiones: "Estándar industrial",
          pesoAprox: "2.5 kg",
          caracteristicasDetalle: [
            "Alta resistencia y durabilidad para trabajo en redes de distribución",
          ],
        },
      },
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) return;
    const filtered = items.filter((it) => it.id !== id).map((it, idx) => ({ ...it, item: idx + 1 }));
    setItems(filtered);
  };

  const totalCalculado = items.reduce((sum, it) => sum + (Number(it.precioTotalEstimado) || 0), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: Adquisicion = {
      ...adquisicion,
      titulo_proceso: titulo,
      revision,
      mes_anio_documento: mesAnio,
      fecha_inicio: fechaInicio,
      plazo_entrega_dias: Number(plazoDias),
      multa_diaria_porcentaje: Number(multaPorcentaje),
      partida_presupuestaria: partida,
      lugar_entrega: lugarEntrega,
      elaborado_por: elaborado,
      revisado_por: revisado,
      aprobado_por: aprobado,
      antecedentes_texto: antecedentes,
      justificacion_texto: justificacion,
      forma_pago_texto: formaPago,
      calidad_texto: calidad,
      items,
      prevision_presupuesto: totalCalculado > 0 ? totalCalculado : adquisicion.prevision_presupuesto,
    };

    onSave(updated);
  };

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 shadow-xl">
      {/* Header */}
      <div className="flex justify-between items-center pb-3 border-b border-outline-variant mb-4">
        <div>
          <h3 className="font-headline-md text-base font-bold text-primary flex items-center gap-2">
            <Wrench className="w-4 h-4 text-secondary-fixed-variant" />
            <span>Editor Institucional de Especificaciones Técnicas y Presupuesto</span>
          </h3>
          <p className="font-sans text-xs text-on-surface-variant">
            Edita los datos que se reflejan en las 7 páginas del documento oficial y archivo .docx
          </p>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 text-on-surface-variant hover:bg-surface-container-high rounded transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-outline-variant mb-4 font-mono text-xs gap-1 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("general")}
          className={`px-3 py-2 font-bold border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === "general"
              ? "border-primary text-primary"
              : "border-transparent text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Datos & Presupuesto</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("items")}
          className={`px-3 py-2 font-bold border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === "items"
              ? "border-primary text-primary"
              : "border-transparent text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <Wrench className="w-3.5 h-3.5" />
          <span>Fichas Técnicas de Herramientas ({items.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("firmas")}
          className={`px-3 py-2 font-bold border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === "firmas"
              ? "border-primary text-primary"
              : "border-transparent text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" />
          <span>Firmas & Portada</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("clausulas")}
          className={`px-3 py-2 font-bold border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === "clausulas"
              ? "border-primary text-primary"
              : "border-transparent text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Cláusulas & Textos</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* TAB 1: DATOS & PRESUPUESTO */}
        {activeTab === "general" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="block text-xs font-mono font-bold text-on-surface mb-1">
                  Título / Objeto del Proceso *
                </label>
                <input
                  type="text"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  className="w-full px-3 py-1.5 border border-outline-variant rounded font-sans text-xs bg-surface focus:border-primary font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-on-surface mb-1">
                  Revisión Documental
                </label>
                <input
                  type="text"
                  value={revision}
                  onChange={(e) => setRevision(e.target.value)}
                  placeholder="Rev. N° 1"
                  className="w-full px-3 py-1.5 border border-outline-variant rounded font-mono text-xs bg-surface focus:border-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-mono font-bold text-on-surface mb-1">
                  Mes y Año (Portada)
                </label>
                <input
                  type="text"
                  value={mesAnio}
                  onChange={(e) => setMesAnio(e.target.value)}
                  placeholder="Mayo - 2026"
                  className="w-full px-3 py-1.5 border border-outline-variant rounded font-mono text-xs bg-surface focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-on-surface mb-1">
                  Fecha Inicio Proceso
                </label>
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  className="w-full px-3 py-1.5 border border-outline-variant rounded font-mono text-xs bg-surface focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-on-surface mb-1">
                  Plazo Entrega (Días)
                </label>
                <input
                  type="number"
                  value={plazoDias}
                  onChange={(e) => setPlazoDias(Number(e.target.value))}
                  max={120}
                  className="w-full px-3 py-1.5 border border-outline-variant rounded font-mono text-xs bg-surface focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-on-surface mb-1">
                  Multa Diaria (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={multaPorcentaje}
                  onChange={(e) => setMultaPorcentaje(Number(e.target.value))}
                  className="w-full px-3 py-1.5 border border-outline-variant rounded font-mono text-xs bg-surface focus:border-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-mono font-bold text-on-surface mb-1">
                  Partida Presupuestaria
                </label>
                <input
                  type="text"
                  value={partida}
                  onChange={(e) => setPartida(e.target.value)}
                  className="w-full px-3 py-1.5 border border-outline-variant rounded font-mono text-xs bg-surface focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-on-surface mb-1">
                  Lugar de Entrega
                </label>
                <input
                  type="text"
                  value={lugarEntrega}
                  onChange={(e) => setLugarEntrega(e.target.value)}
                  className="w-full px-3 py-1.5 border border-outline-variant rounded font-sans text-xs bg-surface focus:border-primary"
                />
              </div>
            </div>

            {/* Presupuesto Box */}
            <div className="p-4 bg-primary-fixed/20 border border-primary-fixed-dim rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
              <div>
                <span className="font-mono text-xs font-bold text-primary block">
                  Presupuesto Total Estimado (Cálculo Dinámico de Ítems)
                </span>
                <span className="font-mono text-[11px] text-on-surface-variant">
                  {numeroALiteralBs(totalCalculado)}
                </span>
              </div>
              <div className="font-mono text-lg font-bold text-primary">
                {formatCurrencyBs(totalCalculado)}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: FICHAS TÉCNICAS DE HERRAMIENTAS */}
        {activeTab === "items" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="font-mono text-xs font-bold text-primary">
                Herramientas y Especificaciones Técnicas (Páginas 3 a 6)
              </span>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono bg-primary text-on-primary rounded hover:bg-primary-container"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Añadir Herramienta</span>
              </button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {items.map((it) => (
                <div
                  key={it.id}
                  className="p-3 bg-surface border border-outline-variant rounded space-y-2 text-xs"
                >
                  <div className="flex justify-between items-center font-bold text-primary border-b border-outline-variant pb-1">
                    <span>Ítem #{it.item} - {it.descripcion}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(it.id)}
                      disabled={items.length <= 1}
                      className="text-error hover:text-red-700 disabled:opacity-30"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-mono text-outline">Descripción del Ítem</label>
                      <input
                        type="text"
                        value={it.descripcion}
                        onChange={(e) => handleItemChange(it.id, "descripcion", e.target.value)}
                        className="w-full px-2 py-1 border border-outline-variant rounded text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-outline">Cantidad & Unidad</label>
                      <div className="flex gap-1">
                        <input
                          type="number"
                          value={it.cantidad}
                          onChange={(e) => handleItemChange(it.id, "cantidad", Number(e.target.value))}
                          min={1}
                          className="w-16 px-2 py-1 border border-outline-variant rounded text-xs text-center"
                        />
                        <input
                          type="text"
                          value={it.unidad}
                          onChange={(e) => handleItemChange(it.id, "unidad", e.target.value)}
                          className="w-full px-2 py-1 border border-outline-variant rounded text-xs text-center uppercase"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-outline">Precio Unit. (Bs)</label>
                      <input
                        type="number"
                        value={it.precioUnitarioEstimado}
                        onChange={(e) => handleItemChange(it.id, "precioUnitarioEstimado", Number(e.target.value))}
                        className="w-full px-2 py-1 border border-outline-variant rounded text-xs font-mono text-right"
                      />
                    </div>
                  </div>

                  {/* Ficha Técnica Detallada */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1 border-t border-outline-variant/60">
                    <div>
                      <label className="block text-[10px] font-mono text-outline">Material</label>
                      <input
                        type="text"
                        value={it.fichaTecnica?.material || ""}
                        onChange={(e) => handleFichaTecnicaChange(it.id, "material", e.target.value)}
                        placeholder="Ej. Acero reforzado"
                        className="w-full px-2 py-1 border border-outline-variant rounded text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-outline">Dimensiones / Largo</label>
                      <input
                        type="text"
                        value={it.fichaTecnica?.dimensiones || ""}
                        onChange={(e) => handleFichaTecnicaChange(it.id, "dimensiones", e.target.value)}
                        placeholder="Ej. Largo total: 36 pulgadas (90 cm)"
                        className="w-full px-2 py-1 border border-outline-variant rounded text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-outline">Capacidad de Corte / Carga</label>
                      <input
                        type="text"
                        value={it.fichaTecnica?.capacidadCorte || ""}
                        onChange={(e) => handleFichaTecnicaChange(it.id, "capacidadCorte", e.target.value)}
                        placeholder="Ej. 750 kg / 477 MCM"
                        className="w-full px-2 py-1 border border-outline-variant rounded text-xs"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: FIRMAS & PORTADA */}
        {activeTab === "firmas" && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 bg-surface border border-outline-variant rounded space-y-1.5">
                <span className="font-mono font-bold text-primary block">1. Elaborado Por</span>
                <input
                  type="text"
                  value={elaborado}
                  onChange={(e) => setElaborado(e.target.value)}
                  className="w-full px-2 py-1 border border-outline-variant rounded text-xs font-semibold"
                />
                <span className="text-[10px] text-outline">Supervisora Seguridad Industrial</span>
              </div>

              <div className="p-3 bg-surface border border-outline-variant rounded space-y-1.5">
                <span className="font-mono font-bold text-primary block">2. Revisado Por</span>
                <input
                  type="text"
                  value={revisado}
                  onChange={(e) => setRevisado(e.target.value)}
                  className="w-full px-2 py-1 border border-outline-variant rounded text-xs font-semibold"
                />
                <span className="text-[10px] text-outline">Supervisora Seguridad Industrial</span>
              </div>

              <div className="p-3 bg-surface border border-outline-variant rounded space-y-1.5">
                <span className="font-mono font-bold text-primary block">3. Aprobado Por</span>
                <input
                  type="text"
                  value={aprobado}
                  onChange={(e) => setAprobado(e.target.value)}
                  className="w-full px-2 py-1 border border-outline-variant rounded text-xs font-semibold"
                />
                <span className="text-[10px] text-outline">Gerencia ENDE Deoruro S.A.</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: CLÁUSULAS & TEXTOS */}
        {activeTab === "clausulas" && (
          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-[10px] font-mono text-outline font-bold">1. Antecedentes</label>
              <textarea
                rows={2}
                value={antecedentes}
                onChange={(e) => setAntecedentes(e.target.value)}
                className="w-full px-2 py-1 border border-outline-variant rounded text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono text-outline font-bold">2. Justificación / Necesidad</label>
              <textarea
                rows={2}
                value={justificacion}
                onChange={(e) => setJustificacion(e.target.value)}
                className="w-full px-2 py-1 border border-outline-variant rounded text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono text-outline font-bold">4. Calidad & Certificaciones</label>
              <textarea
                rows={2}
                value={calidad}
                onChange={(e) => setCalidad(e.target.value)}
                className="w-full px-2 py-1 border border-outline-variant rounded text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono text-outline font-bold">10. Forma de Pago</label>
              <textarea
                rows={2}
                value={formaPago}
                onChange={(e) => setFormaPago(e.target.value)}
                className="w-full px-2 py-1 border border-outline-variant rounded text-xs"
              />
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="flex justify-end gap-3 pt-3 border-t border-outline-variant">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-outline-variant rounded text-xs font-mono text-on-surface-variant hover:bg-surface-container-high"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="flex items-center gap-2 px-5 py-2 bg-primary text-on-primary rounded text-xs font-mono font-bold hover:bg-primary-container transition-colors shadow-institutional"
          >
            <Save className="w-4 h-4 text-secondary-container" />
            <span>Guardar Cambios y Actualizar Plantilla (.docx)</span>
          </button>
        </div>
      </form>
    </div>
  );
};
