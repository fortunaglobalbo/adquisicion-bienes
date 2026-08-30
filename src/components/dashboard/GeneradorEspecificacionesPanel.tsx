"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Plus,
  Trash2,
  Download,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileDown,
  Zap,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface ItemEspec {
  numero: number;
  descripcion: string;
  unidad: string;
  cantidad: number;
  caracteristicas: string;
}

interface GeneradorResponse {
  status: string;
  message: string;
  docx_file?: string;
  pdf_file?: string;
  download_docx?: string;
  download_pdf?: string;
  error?: string;
}

const BASE_URL = "http://85.31.230.163:8080";

export const GeneradorEspecificacionesPanel: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [resultado, setResultado] = useState<GeneradorResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [titulo, setTitulo] = useState("ADQUISICIÓN DE HERRAMIENTA PARA CUADRILLAS");
  const [justificacion, setJustificacion] = useState(
    "Garantizar la continuidad operativa de las cuadrillas de mantenimiento y cumplimiento normativo institucional"
  );
  const [elaborado, setElaborado] = useState("Ing. Heydi Canaviri Padilla");
  const [plazoEntrega, setPlazoEntrega] = useState("Maximo 30 dias calendario");
  const [lugarEntrega, setLugarEntrega] = useState("Almacenes ENDE DEORURO S.A., Oruro");
  const [vigenciaPropuesta, setVigenciaPropuesta] = useState("30 dias calendario");

  const [items, setItems] = useState<ItemEspec[]>([
    {
      numero: 1,
      descripcion: "Alicate universal 8 pulgadas",
      unidad: "Pza",
      cantidad: 10,
      caracteristicas: "Mango aislado hasta 1000V, acero cromado, cabeza niquelada",
    },
    {
      numero: 2,
      descripcion: "Destornillador plano 6 pulgadas",
      unidad: "Pza",
      cantidad: 15,
      caracteristicas: "Mango aislado, hoja de acero inoxidable, punta endurecida",
    },
  ]);

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        numero: prev.length + 1,
        descripcion: "",
        unidad: "Pza",
        cantidad: 1,
        caracteristicas: "",
      },
    ]);
  };

  const handleRemoveItem = (idx: number) => {
    setItems((prev) =>
      prev.filter((_, i) => i !== idx).map((it, i) => ({ ...it, numero: i + 1 }))
    );
  };

  const handleItemChange = (idx: number, field: keyof ItemEspec, value: any) => {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it))
    );
  };

  const handleGenerar = async () => {
    setIsLoading(true);
    setResultado(null);
    setError(null);

    const payload = {
      titulo_adquisicion: titulo.trim(),
      justificacion: justificacion.trim(),
      items: items.map((it) => ({
        numero: it.numero,
        descripcion: it.descripcion.trim(),
        unidad: it.unidad.trim(),
        cantidad: Number(it.cantidad),
        caracteristicas: it.caracteristicas.trim(),
      })),
      elaborado: elaborado.trim(),
      plazo_entrega: plazoEntrega.trim(),
      lugar_entrega: lugarEntrega.trim(),
      vigencia_propuesta: vigenciaPropuesta.trim(),
    };

    try {
      const res = await fetch(`${BASE_URL}/api/generar-especificaciones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data: GeneradorResponse = await res.json();

      if (!res.ok || data.status !== "success") {
        throw new Error(data.error || data.message || `Error del servidor: ${res.status}`);
      }

      setResultado(data);
    } catch (err: any) {
      setError(err.message || "No se pudo conectar con el servidor de generación.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (path: string, filename: string) => {
    try {
      const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("No se pudo descargar el archivo");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    } catch (err: any) {
      alert("Error al descargar: " + err.message);
    }
  };

  return (
    <div className="w-full rounded-xl border border-outline-variant overflow-hidden shadow-md bg-surface-container-lowest">
      {/* Header / Toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-5 py-4 bg-gradient-to-r from-[#001E40] to-[#003366] text-white hover:from-[#002a57] hover:to-[#004080] transition-all"
      >
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-yellow-400/20 rounded-lg border border-yellow-400/30">
            <Zap className="w-5 h-5 text-yellow-300" />
          </div>
          <div className="text-left">
            <h3 className="font-bold text-sm tracking-wide">
              ⚡ Generador Automático de Especificaciones Técnicas
            </h3>
            <p className="text-xs text-blue-200 mt-0.5">
              DeepSeek IA + python-docx + LibreOffice — ENDE DEORURO S.A.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Servidor Activo
          </span>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-blue-200" />
          ) : (
            <ChevronDown className="w-5 h-5 text-blue-200" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="p-5 space-y-5">
          {/* Campos Generales */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-on-surface-variant mb-1.5 uppercase tracking-wide">
                Título de la Adquisición *
              </label>
              <input
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                className="w-full px-3 py-2.5 bg-surface border border-outline-variant rounded-lg text-sm text-on-surface font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                placeholder="ADQUISICIÓN DE..."
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-on-surface-variant mb-1.5 uppercase tracking-wide">
                Justificación *
              </label>
              <textarea
                rows={2}
                value={justificacion}
                onChange={(e) => setJustificacion(e.target.value)}
                className="w-full px-3 py-2.5 bg-surface border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-y"
                placeholder="Justificación de la necesidad..."
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1.5 uppercase tracking-wide">
                Elaborado por
              </label>
              <input
                type="text"
                value={elaborado}
                onChange={(e) => setElaborado(e.target.value)}
                className="w-full px-3 py-2.5 bg-surface border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1.5 uppercase tracking-wide">
                Plazo de Entrega
              </label>
              <input
                type="text"
                value={plazoEntrega}
                onChange={(e) => setPlazoEntrega(e.target.value)}
                className="w-full px-3 py-2.5 bg-surface border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1.5 uppercase tracking-wide">
                Lugar de Entrega
              </label>
              <input
                type="text"
                value={lugarEntrega}
                onChange={(e) => setLugarEntrega(e.target.value)}
                className="w-full px-3 py-2.5 bg-surface border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1.5 uppercase tracking-wide">
                Vigencia de Propuesta
              </label>
              <input
                type="text"
                value={vigenciaPropuesta}
                onChange={(e) => setVigenciaPropuesta(e.target.value)}
                className="w-full px-3 py-2.5 bg-surface border border-outline-variant rounded-lg text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              />
            </div>
          </div>

          {/* Tabla de Ítems */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wide">
                Ítems / Materiales *
              </label>
              <button
                onClick={handleAddItem}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-lg text-xs font-bold transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar Ítem
              </button>
            </div>

            <div className="border border-outline-variant rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#001E40] text-white">
                    <th className="px-3 py-2.5 text-center w-10">#</th>
                    <th className="px-3 py-2.5 text-left">Descripción</th>
                    <th className="px-3 py-2.5 text-center w-16">Unidad</th>
                    <th className="px-3 py-2.5 text-center w-16">Cant.</th>
                    <th className="px-3 py-2.5 text-left">Características Técnicas</th>
                    <th className="px-3 py-2.5 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr
                      key={idx}
                      className={`border-t border-outline-variant/50 ${idx % 2 === 1 ? "bg-surface-container-low/40" : "bg-white dark:bg-surface"}`}
                    >
                      <td className="px-3 py-2 text-center font-bold text-on-surface-variant">{it.numero}</td>
                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          value={it.descripcion}
                          onChange={(e) => handleItemChange(idx, "descripcion", e.target.value)}
                          className="w-full px-2 py-1 bg-transparent border-b border-dashed border-outline-variant focus:border-primary focus:bg-surface-container-low outline-none rounded transition-colors"
                          placeholder="Nombre del ítem..."
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          value={it.unidad}
                          onChange={(e) => handleItemChange(idx, "unidad", e.target.value)}
                          className="w-full text-center px-2 py-1 bg-transparent border-b border-dashed border-outline-variant focus:border-primary focus:bg-surface-container-low outline-none rounded transition-colors"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          value={it.cantidad}
                          onChange={(e) => handleItemChange(idx, "cantidad", parseInt(e.target.value) || 1)}
                          className="w-full text-center px-2 py-1 bg-transparent border-b border-dashed border-outline-variant focus:border-primary focus:bg-surface-container-low outline-none rounded transition-colors font-bold"
                          min={1}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          value={it.caracteristicas}
                          onChange={(e) => handleItemChange(idx, "caracteristicas", e.target.value)}
                          className="w-full px-2 py-1 bg-transparent border-b border-dashed border-outline-variant focus:border-primary focus:bg-surface-container-low outline-none rounded transition-colors"
                          placeholder="Especificaciones técnicas..."
                        />
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {items.length > 1 && (
                          <button
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1 text-red-400 hover:text-red-600 transition-colors"
                            title="Eliminar ítem"
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
          </div>

          {/* Botón de Generación */}
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <button
              onClick={handleGenerar}
              disabled={isLoading || !titulo.trim() || items.length === 0}
              className="flex-1 flex items-center justify-center gap-2.5 px-6 py-3 bg-gradient-to-r from-[#001E40] to-[#003366] hover:from-[#002a57] hover:to-[#004080] text-white font-bold text-sm rounded-xl shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-yellow-300" />
                  <span>Generando con DeepSeek IA...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 text-yellow-300" />
                  <span>Generar Especificaciones Técnicas (DOCX + PDF)</span>
                </>
              )}
            </button>

            <div className="text-xs text-on-surface-variant text-center sm:text-right space-y-0.5">
              <div className="flex items-center gap-1 justify-center sm:justify-end">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                <span>DeepSeek IA genera los textos formales</span>
              </div>
              <div className="flex items-center gap-1 justify-center sm:justify-end">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>python-docx + LibreOffice → PDF oficial</span>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm text-red-300">Error al generar</p>
                <p className="text-xs mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* Resultado Exitoso */}
          {resultado && resultado.status === "success" && (
            <div className="p-5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                <div>
                  <p className="font-bold text-emerald-300 text-sm">¡Documentos generados exitosamente!</p>
                  <p className="text-xs text-emerald-400/80 mt-0.5">{resultado.message}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Descargar DOCX */}
                {resultado.download_docx && (
                  <button
                    onClick={() => handleDownload(resultado.download_docx!, resultado.docx_file || "especificaciones.docx")}
                    className="flex items-center gap-3 px-4 py-3 bg-[#003366]/80 hover:bg-[#004080] border border-blue-500/30 rounded-xl text-white transition-all active:scale-[0.98] group"
                  >
                    <div className="p-2 bg-blue-500/20 rounded-lg group-hover:bg-blue-500/30 transition-colors">
                      <FileText className="w-5 h-5 text-blue-300" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-sm">Descargar Word (.docx)</p>
                      <p className="text-[10px] text-blue-300 font-mono mt-0.5 truncate max-w-[180px]">
                        {resultado.docx_file}
                      </p>
                    </div>
                    <Download className="w-4 h-4 text-blue-300 ml-auto" />
                  </button>
                )}

                {/* Descargar PDF */}
                {resultado.download_pdf && (
                  <button
                    onClick={() => handleDownload(resultado.download_pdf!, resultado.pdf_file || "especificaciones.pdf")}
                    className="flex items-center gap-3 px-4 py-3 bg-red-900/40 hover:bg-red-900/60 border border-red-500/30 rounded-xl text-white transition-all active:scale-[0.98] group"
                  >
                    <div className="p-2 bg-red-500/20 rounded-lg group-hover:bg-red-500/30 transition-colors">
                      <FileDown className="w-5 h-5 text-red-300" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-sm">Descargar PDF Oficial</p>
                      <p className="text-[10px] text-red-300 font-mono mt-0.5 truncate max-w-[180px]">
                        {resultado.pdf_file}
                      </p>
                    </div>
                    <Download className="w-4 h-4 text-red-300 ml-auto" />
                  </button>
                )}
              </div>

              {/* Preview técnico */}
              <details className="text-[10px] font-mono text-emerald-500/70">
                <summary className="cursor-pointer hover:text-emerald-400 transition-colors">Ver respuesta del servidor</summary>
                <pre className="mt-2 p-3 bg-black/30 rounded-lg text-[10px] overflow-x-auto">
                  {JSON.stringify(resultado, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
