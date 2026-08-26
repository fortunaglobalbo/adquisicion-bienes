"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  FileText,
  Download,
  Sparkles,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Trash2,
  Plus,
  Maximize2,
  Minimize2,
  FileUp,
  Save,
  BookOpen,
  Edit3,
  Layers,
} from "lucide-react";
import { Adquisicion, ItemAdquisicion, Plantilla, CampoMoldeLibre, TipoTablaTDR } from "@/types";
import { Modal } from "@/components/ui/Modal";
import { InstitutionalLogo } from "../layout/InstitutionalLogo";
import { DataStore } from "@/lib/store/dataStore";
import { parseMarkdownTdrLiteral } from "@/lib/ai/markdownTdrParser";


interface TdrDocumentViewerProps {
  adquisicion: Adquisicion;
  onDownloadDocx: () => void;
  onAdquisicionUpdated?: (updated: Adquisicion) => void;
}

export const TdrDocumentViewer: React.FC<TdrDocumentViewerProps> = ({
  adquisicion,
  onDownloadDocx,
  onAdquisicionUpdated,
}) => {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [viewMode, setViewMode] = useState<"paginado" | "continuo">("continuo");
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [showFirmaPortada, setShowFirmaPortada] = useState(true);

  // Cargar plantilla activa de Carpeta 1 (TDR) desde DataStore
  const [activeTemplate, setActiveTemplate] = useState<Plantilla | null>(null);

  useEffect(() => {
    const list = DataStore.getPlantillas();
    const tpl = list.find((p) => p.fk_carpeta === 1);
    if (tpl) {
      let datos = tpl.datos_completos || {};
      if (Object.keys(datos).length === 0 && typeof window !== "undefined") {
        try {
          const b = localStorage.getItem(`ende_plantilla_custom_${tpl.id}`);
          if (b) datos = JSON.parse(b);
        } catch {}
      }
      setActiveTemplate({ ...tpl, datos_completos: datos });
      if (datos.incluirFirmaPortada !== undefined) {
        setShowFirmaPortada(datos.incluirFirmaPortada);
      }
    }
  }, []);

  // AI assistant states
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiInputMode, setAiInputMode] = useState<"markdown" | "file">("markdown");
  const [markdownTdrText, setMarkdownTdrText] = useState<string>("");
  const [uploadedAiFile, setUploadedAiFile] = useState<{ name: string; base64: string; type: string } | null>(null);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [incluirFotoEnItems, setIncluirFotoEnItems] = useState<boolean>(false);
  const aiFileInputRef = useRef<HTMLInputElement | null>(null);

  // Editable Document State
  const [docData, setDocData] = useState<Adquisicion>({ ...adquisicion });
  const [tipoTablaTdr, setTipoTablaTdr] = useState<TipoTablaTDR>(
    adquisicion.tipo_tabla_tdr ||
    ((adquisicion.categoria as any) === "Salud Ocupacional" ||
    adquisicion.titulo_proceso.toLowerCase().includes("oftalmo") ||
    adquisicion.titulo_proceso.toLowerCase().includes("laboratorio")
      ? "SALUD_OCUPACIONAL"
      : "BIENES_SIMPLE")
  );

  // Update field helper
  const handleTextChange = (field: keyof Adquisicion, value: any) => {
    setDocData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Update item field helper
  const handleItemTextChange = (itemId: string, field: keyof ItemAdquisicion, value: any) => {
    setDocData((prev) => ({
      ...prev,
      items: prev.items.map((it) => (it.id === itemId ? { ...it, [field]: value } : it)),
    }));
  };

  // Update item ficha tecnica helper
  const handleFichaChange = (itemId: string, field: string, value: any) => {
    setDocData((prev) => ({
      ...prev,
      items: prev.items.map((it) => {
        if (it.id !== itemId) return it;
        return {
          ...it,
          fichaTecnica: {
            ...it.fichaTecnica,
            [field]: value,
          },
        };
      }),
    }));
  };

  // Image Upload for a specific tool/item
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  const handleImageUpload = (itemId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      handleFichaChange(itemId, "imagenUrl", base64);
    };
    reader.readAsDataURL(file);
  };

  // AI File Upload (Document or Photo)
  const handleAiFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setUploadedAiFile({
        name: file.name,
        base64,
        type: file.type,
      });
    };
    reader.readAsDataURL(file);
  };

  // Process Document, Markdown or Photo with AI
  const handleRunAi = async () => {
    setIsAiProcessing(true);
    try {
      const payload: any = {
        adquisicion: {
          ...docData,
          tipo_tabla_tdr: tipoTablaTdr,
        },
        insumoTexto: aiPrompt,
        nombreArchivo: uploadedAiFile?.name,
      };

      // 1. Si es modo Markdown, realizar parseo literal determinista inmediato
      let directParsed = null;
      if (aiInputMode === "markdown" && markdownTdrText.trim()) {
        payload.documentText = markdownTdrText;
        directParsed = parseMarkdownTdrLiteral(markdownTdrText);
      } else if (uploadedAiFile?.base64) {
        if (uploadedAiFile.type.startsWith("image/")) {
          payload.imageBase64 = uploadedAiFile.base64;
        } else {
          payload.documentText = `Archivo adjunto: ${uploadedAiFile.name}. Insumo adicional: ${aiPrompt}`;
        }
      }

      const res = await fetch("/api/ai/generate-tdr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok && !directParsed) throw new Error(result.error || "Error al procesar el documento");

      const parsedData = result.data || directParsed;
      if (parsedData) {
        const detectedTabla = directParsed?.tipo_tabla_sugerido || parsedData.tipo_tabla_sugerido || tipoTablaTdr;
        const updated: Adquisicion = {
          ...docData,
          tipo_tabla_tdr: detectedTabla,
          titulo_proceso: directParsed?.titulo_proceso || parsedData.titulo_proceso || docData.titulo_proceso,
          antecedentes_texto: directParsed?.antecedentes_texto || parsedData.antecedentes_texto || docData.antecedentes_texto,
          justificacion_texto: directParsed?.justificacion_texto || parsedData.justificacion_texto || docData.justificacion_texto,
          categoria: (parsedData.categoria_detectada as any) || docData.categoria,
          items: directParsed?.items && directParsed.items.length > 0
            ? directParsed.items
            : parsedData.items && parsedData.items.length > 0
            ? parsedData.items
            : docData.items,
        };

        setTipoTablaTdr(detectedTabla);

        const totalPresupuesto = updated.items.reduce(
          (sum, it) => sum + (Number(it.precioTotalEstimado) || (Number(it.cantidad) || 1) * (Number(it.precioUnitarioEstimado) || 0)),
          0
        );
        updated.prevision_presupuesto = totalPresupuesto > 0 ? totalPresupuesto : updated.prevision_presupuesto;

        setDocData(updated);
        onAdquisicionUpdated?.(updated);
        setShowAiModal(false);
        setSavedFeedback(true);
        setTimeout(() => setSavedFeedback(false), 3000);
      }
    } catch (err: any) {
      alert("Error con la IA: " + err.message);
    } finally {
      setIsAiProcessing(false);
    }
  };

  // Add Item
  const handleAddItem = () => {
    const nextNum = docData.items.length + 1;
    const isSalud = (docData.categoria as string) === "Salud Ocupacional" || docData.titulo_proceso.toLowerCase().includes("oftalmo") || docData.titulo_proceso.toLowerCase().includes("laboratorio");
    
    const newItem: ItemAdquisicion = {
      id: `item-${Date.now()}`,
      item: nextNum,
      descripcion: isSalud ? `NUEVO EXAMEN MÉDICO O ESTUDIO #${nextNum}` : `NUEVA HERRAMIENTA O EQUIPO #${nextNum}`,
      unidad: isSalud ? "ESTUDIO" : "PZA",
      cantidad: 1,
      precioUnitarioEstimado: 200,
      precioTotalEstimado: 200,
      fichaTecnica: {
        uso: isSalud ? "Medicina del Trabajo y Salud Ocupacional" : "Personal Operativo",
        normaCertificacion: isSalud ? "Acreditación y Control de Calidad Sanitario" : "Norma ASTM A36 / ISO 9001 / IEEE",
        material: isSalud ? "Metodología Analítica Validada" : "Acero al silicio manganeso 2X forjado con pavonado",
        color: "Estándar",
        aceptacionLote: "Evaluación técnica preliminar el día de la entrega",
        categoriaItem: isSalud ? "Servicios Médicos" : "Herramientas de cuadrilla",
        dimensiones: isSalud ? "Evaluación individual por persona" : "Corte 9/16 pulg - Largo 36 pulg",
        pesoAprox: isSalud ? "N/A" : "2.5 kg",
        caracteristicasDetalle: [
          "Requisito técnico mínimo 1 de cumplimiento obligatorio",
          "Requisito técnico mínimo 2 de cumplimiento obligatorio",
        ],
      },
    };
    setDocData((prev) => ({
      ...prev,
      items: [...prev.items, newItem],
    }));
  };

  // Remove Item
  const handleRemoveItem = (itemId: string) => {
    if (docData.items.length <= 1) return;
    setDocData((prev) => ({
      ...prev,
      items: prev.items.filter((it) => it.id !== itemId).map((it, idx) => ({ ...it, item: idx + 1 })),
    }));
  };

  // Save changes
  const handleSave = () => {
    const totalPresupuesto = docData.items.reduce(
      (sum, it) => sum + (Number(it.precioTotalEstimado) || (Number(it.cantidad) || 1) * (Number(it.precioUnitarioEstimado) || 0)),
      0
    );
    const updated = {
      ...docData,
      prevision_presupuesto: totalPresupuesto > 0 ? totalPresupuesto : docData.prevision_presupuesto,
    };
    onAdquisicionUpdated?.(updated);
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2500);
  };

  // Helper variables from Template & Document
  const tplData = activeTemplate?.datos_completos || {};
  const logoUrl = activeTemplate?.logo_url || tplData.logoUrl || null;
  const tituloEntidad = tplData.tituloEntidad || "DISTRIBUIDORA DE ELECTRICIDAD ENDE DEORURO S.A.";
  const subtituloDoc = tplData.subtituloDoc || "ESPECIFICACIONES TÉCNICAS";
  const subtituloCabecera = tplData.subtituloCabecera || "REGLAMENTO DE ADQUISICIÓN DE BIENES (SBC)";
  const versionDoc = tplData.versionDoc || docData.revision || "Rev: Nº 1";
  const fechaDoc = tplData.fechaDoc || docData.mes_anio_documento || "Agosto 2026";
  const lugarDoc = tplData.lugarDoc || "Oruro-Bolivia";
  const etiquetaResumen = tplData.etiquetaResumen || "RESUMEN";
  const tituloIndice = tplData.tituloIndice || "Contenido";

  // Campos del Molde Maestro configurados en la Plantilla (/plantillas)
  const camposMolde: CampoMoldeLibre[] = tplData.camposMoldeDirectos || [
    { id: "cmp-1", nombre: "Norma / Certificación Oficial", valorEjemplo: "ASTM A36 / ISO 9001 / IEEE" },
    { id: "cmp-2", nombre: "Material Principal y Acabado", valorEjemplo: "Acero al silicio manganeso 2X forjado con pavonado" },
    { id: "cmp-3", nombre: "Capacidad de Corte / Carga / Dimensión", valorEjemplo: "Corte 9/16 pulg - Largo 36 pulg (90 cm)" },
    { id: "cmp-4", nombre: "Uso Operativo y Destino de Cuadrilla", valorEjemplo: "Personal Operativo Mantenimiento Redes MT" },
    { id: "cmp-5", nombre: "Características y Ventajas Técnicas", valorEjemplo: "Cuchillas templadas y mecanismo de palanca de alto rendimiento" },
  ];
  const incluirFoto = incluirFotoEnItems;

  // 14 Puntos Oficiales de ENDE Deoruro S.A.
  const isSaludDomain = ((docData.categoria as any) === "Salud Ocupacional") || docData.titulo_proceso.toLowerCase().includes("oftalmo") || docData.titulo_proceso.toLowerCase().includes("laboratorio");

  const [puntosOficiales, setPuntosOficiales] = useState([
    {
      num: 1,
      titulo: "ANTECEDENTES",
      contenido: docData.antecedentes_texto || "De acuerdo a la legislación vigente, normas y políticas internas se inicia el presente proceso de adquisición/contratación para el cumplimiento de los objetivos operativos e institucionales de la Distribuidora de Electricidad ENDE DEORURO S.A.",
    },
    {
      num: 2,
      titulo: "JUSTIFICACIÓN / NECESIDAD",
      contenido: docData.justificacion_texto || "La presente contratación se justifica en la necesidad operativa de contar oportunamente con los bienes y servicios requeridos para el adecuado funcionamiento de las áreas de ENDE DEORURO S.A.",
    },
    { num: 3, titulo: "ESPECIFICACION TECNICA", contenido: "Detalle técnico y especificaciones de los requerimientos:" },
    { num: 4, titulo: "CALIDAD", contenido: isSaludDomain ? "El proponente o laboratorio debe cumplir con los estándares de calidad y credenciales sanitarias vigentes ante las autoridades competentes." : "Los bienes deberán ser nuevos, de primer uso y fabricados bajo normas de calidad aplicables, con garantía oficial." },
    { num: 5, titulo: "ÁMBITO DE APLICACIÓN", contenido: "Personal institucional y áreas operativas/administrativas de la Distribuidora de Electricidad ENDE DEORURO S.A." },
    { num: 6, titulo: "MÉTODO DE SELECCIÓN", contenido: "Menor Precio (Art. 31 del Reglamento SBC)." },
    { num: 7, titulo: "VIGENCIA DE LA PROPUESTA", contenido: "Tendrá una validez mínima de 30 días calendario computables a partir de la fecha de presentación de la propuesta." },
    { num: 8, titulo: "CATEGORÍA", contenido: isSaludDomain ? "Salud Ocupacional y Medicina del Trabajo." : "Bienes y Suministros Oficiales." },
    { num: 9, titulo: "LUGAR DE ENTREGA", contenido: "Instalaciones / Almacén de ENDE DEORURO S.A., Oruro - Bolivia." },
    { num: 10, titulo: "TIEMPO DE ENTREGA", contenido: `Máximo ${docData.plazo_entrega_dias || 30} días calendario computables a partir del día siguiente hábil de la recepción de la Orden de Compra.` },
    { num: 11, titulo: "FORMA DE ADJUDICACIÓN", contenido: "Por Ítem requerido, formalizada por Orden de Compra (Art. 31 SBC)." },
    { num: 12, titulo: "PARA LA ACEPTACIÓN DEL LOTE / SERVICIO", contenido: "El personal técnico de ENDE DEORURO realizará una evaluación técnica de conformidad el día de la entrega." },
    { num: 13, titulo: "FORMA DE PAGO", contenido: "El pago se realizará contra entrega satisfactoria del producto o servicio, conformidad emitida por ENDE DEORURO S.A. y entrega de la siguiente documentación: Nota de Entrega / Conformidad, Solicitud de Pago y Factura oficial." },
    { num: 14, titulo: "APLICACIÓN DE MULTAS", contenido: `Ante el incumplimiento de los plazos y otras condiciones establecidas en la Orden de Compra y Especificaciones Técnicas, se aplicará la multa del ${docData.multa_diaria_porcentaje || 0.25}% por cada día de retraso injustificado.` },
  ]);

  // Mantener sincronizados los puntos con el documento
  useEffect(() => {
    setPuntosOficiales((prev) =>
      prev.map((p) => {
        if (p.num === 1 && docData.antecedentes_texto) return { ...p, contenido: docData.antecedentes_texto };
        if (p.num === 2 && docData.justificacion_texto) return { ...p, contenido: docData.justificacion_texto };
        return p;
      })
    );
  }, [docData.antecedentes_texto, docData.justificacion_texto]);

  // Actualizar contenido de un punto
  const handlePuntoChange = (num: number, field: "titulo" | "contenido", val: string) => {
    setPuntosOficiales((prev) =>
      prev.map((p) => (p.num === num ? { ...p, [field]: val } : p))
    );
  };

  const items = docData.items || [];
  const totalPages = 7;

  // Running Header Subcomponent
  const RunningHeader = ({ pageNum }: { pageNum: number }) => (
    <div className="border-2 border-black flex justify-between items-stretch text-center font-sans mb-6 select-none">
      <div className="w-[30%] border-r-2 border-black p-2 flex flex-col items-center justify-center bg-white">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="Logo" className="h-10 w-auto object-contain" />
        ) : (
          <InstitutionalLogo size="sm" showText={false} />
        )}
        <span className="font-bold text-[8.5px] tracking-tight mt-1 text-primary">{tituloEntidad}</span>
      </div>
      <div className="w-[45%] border-r-2 border-black p-2 flex flex-col items-center justify-center">
        <h4 className="font-black text-xs uppercase text-black leading-tight">
          {docData.titulo_proceso}
        </h4>
        <span className="text-[9px] text-gray-700 font-medium mt-0.5">
          {subtituloCabecera}
        </span>
      </div>
      <div className="w-[25%] p-2 flex flex-col justify-center text-[9px] font-mono text-left space-y-0.5 bg-gray-50">
        <div><strong>{versionDoc}</strong></div>
        <div><strong>{fechaDoc}</strong></div>
        <div>Página /{totalPages}</div>
      </div>
    </div>
  );

  return (
    <div className={`space-y-6 select-text text-base ${isFullScreen ? "fixed inset-0 z-50 bg-surface p-4 overflow-y-auto" : ""}`}>
      {/* Top Toolbar */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3 shadow-md sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowAiModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white font-sans text-sm font-bold rounded shadow transition-all active:scale-95"
            title="Subir foto o documento de cualquier rubro (Salud, Herramientas, etc.) para redactar con IA"
          >
            <Sparkles className="w-4 h-4 text-yellow-100 fill-yellow-100" />
            <span>✨ Asistente IA (Foto / Documento)</span>
          </button>

          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-sans text-sm font-bold rounded shadow transition-all active:scale-95"
            title="Guardar todos los cambios realizados en el documento"
          >
            <Save className="w-4 h-4 text-emerald-200" />
            <span>Guardar TDR</span>
          </button>

          {savedFeedback && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1.5 rounded animate-bounce border border-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ¡Guardado Correctamente!
            </span>
          )}

          <button
            onClick={onDownloadDocx}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary hover:bg-primary-container font-sans text-sm font-bold rounded shadow transition-all active:scale-95"
            title="Descargar este documento oficial en formato Microsoft Word (.docx) con los 14 puntos completos"
          >
            <Download className="w-4 h-4 text-secondary-container" />
            <span>Descargar Word (.docx)</span>
          </button>
        </div>

        {/* Center: Page Controls / Mode */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-surface-container-high rounded p-1 border border-outline-variant text-xs font-mono font-bold">
            <button
              onClick={() => setViewMode("paginado")}
              className={`px-3 py-1 rounded transition-colors ${viewMode === "paginado" ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
            >
              Páginas ({totalPages})
            </button>
            <button
              onClick={() => setViewMode("continuo")}
              className={`px-3 py-1 rounded transition-colors ${viewMode === "continuo" ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
            >
              Vista Completa
            </button>
          </div>

          {viewMode === "paginado" && (
            <div className="flex items-center bg-surface-container-high border border-outline-variant rounded p-1 text-sm font-mono">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 hover:bg-surface-container-highest rounded disabled:opacity-30 text-primary"
                title="Página Anterior"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="px-3 font-bold text-primary">
                Pág. {currentPage} de {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 hover:bg-surface-container-highest rounded disabled:opacity-30 text-primary"
                title="Página Siguiente"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Right: Quick Options */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="p-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant rounded border border-outline-variant transition-colors"
            title={isFullScreen ? "Salir de pantalla completa" : "Ver en toda la pantalla"}
          >
            {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Banner de Sincronización y Edición */}
      <div className="bg-blue-50 border-l-4 border-blue-600 p-2.5 rounded text-xs text-blue-950 flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-blue-700 shrink-0" />
          <span><strong>Plantilla Oficial Sincronizada:</strong> Este expediente respeta los campos del molde técnico ({camposMolde.length} campos) y los 14 puntos del reglamento oficial. Todos los textos son editables directamente.</span>
        </div>
        <button
          onClick={handleAddItem}
          className="flex items-center gap-1 px-3 py-1 bg-primary text-on-primary rounded font-bold text-xs hover:bg-primary-container shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ Añadir Ítem / Examen</span>
        </button>
      </div>

      {/* Document Pages Container */}
      <div className="w-full flex flex-col items-center gap-8 py-4 bg-surface-container/60 rounded-lg p-2 md:p-6 overflow-x-auto">

        {/* ============================================================ */}
        {/* PÁGINA 1: PORTADA OFICIAL (FORMATO EXACTO ENDE DEORURO)      */}
        {/* ============================================================ */}
        {(viewMode === "continuo" || currentPage === 1) && (
          <div className="w-full max-w-full lg:max-w-[1050px] bg-white border border-outline-variant shadow-xl rounded-sm p-5 sm:p-10 md:p-14 text-on-surface font-sans min-h-[1050px] flex flex-col justify-between relative group">
            <div className="flex justify-between items-center text-xs text-gray-500 font-mono border-b border-gray-200 pb-1 font-bold">
              <span>{tituloEntidad}</span>
              <span>PÁGINA 1 DE {totalPages} (PORTADA)</span>
            </div>

            {/* Logo Central Oficial */}
            <div className="flex flex-col items-center justify-center pt-8 space-y-2">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="Logo" className="h-24 w-auto object-contain drop-shadow" />
              ) : (
                <InstitutionalLogo size="lg" showText={false} />
              )}
              <h3 className="font-sans text-sm md:text-base font-bold text-gray-700 tracking-widest uppercase mt-4">
                {subtituloDoc}
              </h3>
            </div>

            {/* Título Principal Editable */}
            <div className="text-center space-y-4 my-8">
              <div
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => handleTextChange("titulo_proceso", e.currentTarget.textContent || "")}
                className="font-sans text-xl md:text-2xl font-black text-primary tracking-tight uppercase border border-transparent hover:border-blue-400 hover:bg-blue-50/50 p-2 rounded focus:outline-none"
              >
                “{docData.titulo_proceso}”
              </div>
            </div>

            {/* Tabla de Firmas de Portada (Elaborado / Revisado / Aprobado) */}
            <div className="my-6 border border-gray-300 rounded overflow-hidden">
              <div className="grid grid-cols-3 bg-gray-100 text-center font-bold text-xs py-2 border-b border-gray-300">
                <div>Elaborado</div>
                <div>Revisado</div>
                <div>Aprobado</div>
              </div>
              <div className="grid grid-cols-3 text-center text-xs py-3 bg-white divide-x divide-gray-200">
                <div
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => handleTextChange("elaborado_por", e.currentTarget.textContent || "")}
                  className="p-1 hover:bg-blue-50 focus:outline-none font-medium"
                >
                  {docData.elaborado_por || "Gabriela Bobarin Vargas"}
                </div>
                <div
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => handleTextChange("revisado_por", e.currentTarget.textContent || "")}
                  className="p-1 hover:bg-blue-50 focus:outline-none font-medium"
                >
                  {docData.revisado_por || "Raúl Torrico Gomez"}
                </div>
                <div
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => handleTextChange("aprobado_por", e.currentTarget.textContent || "")}
                  className="p-1 hover:bg-blue-50 focus:outline-none font-medium"
                >
                  {docData.aprobado_por || "Raúl Torrico Gomez"}
                </div>
              </div>
            </div>

            {/* Caja de RESUMEN */}
            <div className="space-y-1 my-4">
              <h4 className="font-bold text-primary font-sans text-xs uppercase tracking-wider font-mono">
                {etiquetaResumen}:
              </h4>
              <div className="p-3 bg-gray-50 border border-gray-300 rounded text-xs leading-relaxed">
                <p className="font-sans text-on-surface">
                  <span className="text-primary font-bold">❖  </span>
                  <span
                    contentEditable
                    suppressContentEditableWarning
                    className="hover:bg-blue-50/50 p-1 rounded focus:outline-none"
                  >
                    “{docData.titulo_proceso}”
                  </span>
                </p>
              </div>
            </div>

            {/* Pie de Portada */}
            <div className="pt-8 border-t border-gray-300 flex justify-between items-end mt-auto text-xs text-gray-600 font-sans">
              <div
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => handleTextChange("mes_anio_documento", e.currentTarget.textContent || "")}
                className="font-bold hover:bg-blue-50/50 p-1 rounded focus:outline-none text-gray-900"
              >
                {fechaDoc}
              </div>
              <div className="text-right font-medium">{lugarDoc}</div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* PÁGINA 2: ÍNDICE GENERAL (14 PUNTOS OFICIALES)               */}
        {/* ============================================================ */}
        {(viewMode === "continuo" || currentPage === 2) && (
          <div className="w-full max-w-full lg:max-w-[1050px] bg-white border border-outline-variant shadow-xl rounded-sm p-5 sm:p-10 md:p-14 text-on-surface font-sans min-h-[1050px] flex flex-col justify-between relative">
            <div className="flex justify-between items-center text-xs text-gray-500 font-mono border-b border-gray-200 pb-1 font-bold">
              <span>{docData.titulo_proceso}</span>
              <span>PÁGINA 2 DE {totalPages}</span>
            </div>

            <RunningHeader pageNum={2} />

            <div className="text-center py-2 mb-4">
              <h3 className="font-bold text-base text-gray-900 underline tracking-wider">
                {tituloIndice}
              </h3>
            </div>

            {/* Lista de 14 Puntos Oficiales */}
            <div className="space-y-2 font-sans text-sm max-w-2xl mx-auto w-full flex-1">
              {puntosOficiales.map((pto) => (
                <div key={pto.num} className="flex justify-between items-center border-b border-dotted border-gray-400 py-1 hover:bg-gray-50 px-2 rounded">
                  <span className="font-bold text-gray-900">
                    {pto.num}.   {pto.titulo}
                  </span>
                  <span className="font-mono text-gray-500 font-bold text-xs bg-white pl-2">
                    {pto.num <= 2 ? 3 : pto.num === 3 ? 4 : pto.num <= 4 ? 4 : pto.num <= 7 ? 5 : 6}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-300 pt-2 flex justify-between text-xs font-mono text-gray-600 mt-auto">
              <span>{tituloEntidad}</span>
              <span>Página 2 de {totalPages}</span>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* PÁGINA 3: ANTECEDENTES Y JUSTIFICACIÓN (PÁRRAFOS COMPLETOS)  */}
        {/* ============================================================ */}
        {(viewMode === "continuo" || currentPage === 3) && (
          <div className="w-full max-w-full lg:max-w-[1050px] bg-white border border-outline-variant shadow-xl rounded-sm p-5 sm:p-10 md:p-14 text-on-surface font-sans min-h-[1050px] flex flex-col justify-between relative space-y-6">
            <div className="flex justify-between items-center text-xs text-gray-500 font-mono border-b border-gray-200 pb-1 font-bold">
              <span>{docData.titulo_proceso}</span>
              <span>PÁGINA 3 DE {totalPages}</span>
            </div>

            <RunningHeader pageNum={3} />

            <div className="space-y-6 flex-1 text-sm font-sans">
              {/* Punto 1: Antecedentes (3 párrafos formales) */}
              <div className="space-y-2">
                <h4 className="font-bold text-gray-900 text-sm">
                  1. ANTECEDENTES
                </h4>
                <div
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => {
                    handlePuntoChange(1, "contenido", e.currentTarget.textContent || "");
                    handleTextChange("antecedentes_texto", e.currentTarget.textContent || "");
                  }}
                  className="text-justify leading-relaxed p-2 rounded hover:bg-blue-50/50 focus:outline-none text-gray-800 whitespace-pre-line space-y-3"
                >
                  {puntosOficiales[0].contenido}
                </div>
              </div>

              {/* Punto 2: Justificación / Necesidad (4 párrafos formales) */}
              <div className="space-y-2">
                <h4 className="font-bold text-gray-900 text-sm">
                  2. JUSTIFICACIÓN / NECESIDAD
                </h4>
                <div
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => {
                    handlePuntoChange(2, "contenido", e.currentTarget.textContent || "");
                    handleTextChange("justificacion_texto", e.currentTarget.textContent || "");
                  }}
                  className="text-justify leading-relaxed p-2 rounded hover:bg-blue-50/50 focus:outline-none text-gray-800 whitespace-pre-line space-y-3"
                >
                  {puntosOficiales[1].contenido}
                </div>
              </div>
            </div>

            <div className="border-t border-gray-300 pt-2 flex justify-between text-xs font-mono text-gray-600 mt-auto">
              <span>{tituloEntidad}</span>
              <span>Página 3 de {totalPages}</span>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* PÁGINA 4: ESPECIFICACIÓN TÉCNICA (RESPETA PLANTILLA OFICIAL) */}
        {/* ============================================================ */}
        {(viewMode === "continuo" || currentPage === 4) && (
          <div className="w-full max-w-full lg:max-w-[1050px] bg-white border border-outline-variant shadow-xl rounded-sm p-5 sm:p-10 md:p-14 text-on-surface font-sans min-h-[1050px] flex flex-col justify-between relative space-y-6">
            <div className="flex justify-between items-center text-xs text-gray-500 font-mono border-b border-gray-200 pb-1 font-bold">
              <span>{docData.titulo_proceso}</span>
              <span>PÁGINA 4 DE {totalPages} (ESPECIFICACIÓN TÉCNICA)</span>
            </div>

            <RunningHeader pageNum={4} />

            <div className="space-y-6 flex-1 text-sm font-sans">
              {/* Header de Sección 3 con Selector de Formato de Tabla */}
              <div className="space-y-2 border-b pb-2">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <h4 className="font-bold text-gray-900 text-sm">
                    3. ESPECIFICACIÓN TÉCNICA ({items.length} ÍTEMS)
                  </h4>
                  <div className="flex items-center gap-2">
                    {tipoTablaTdr === "FICHAS_DINAMICAS" && (
                      <button
                        type="button"
                        onClick={() => setIncluirFotoEnItems(!incluirFotoEnItems)}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-surface-container-high hover:bg-surface-variant text-primary border border-outline-variant rounded text-xs font-bold transition-colors"
                      >
                        <Camera className="w-3.5 h-3.5 text-primary" />
                        <span>{incluirFotoEnItems ? "Ocultar Fotografías" : "Habilitar Fotografías"}</span>
                      </button>
                    )}
                    <button
                      onClick={handleAddItem}
                      className="flex items-center gap-1 px-3 py-1 bg-primary text-white rounded text-xs font-bold shadow hover:bg-primary-container"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Añadir Ítem</span>
                    </button>
                  </div>
                </div>

                {/* Barra de Opciones de Tipo de Tabla */}
                <div className="flex flex-wrap items-center gap-1.5 p-2 bg-surface-container-low border border-outline-variant rounded-lg">
                  <span className="text-[11px] font-mono font-bold text-primary mr-1">Formato de Tabla:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setTipoTablaTdr("BIENES_SIMPLE");
                      handleTextChange("tipo_tabla_tdr", "BIENES_SIMPLE");
                    }}
                    className={`px-2.5 py-1 rounded text-xs font-bold font-mono transition-all ${
                      tipoTablaTdr === "BIENES_SIMPLE"
                        ? "bg-primary text-white shadow-sm ring-1 ring-primary"
                        : "bg-white text-on-surface-variant hover:bg-surface-container-high border border-outline-variant"
                    }`}
                  >
                    📦 Tabla de Bienes (Descripción y Características)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTipoTablaTdr("SALUD_OCUPACIONAL");
                      handleTextChange("tipo_tabla_tdr", "SALUD_OCUPACIONAL");
                    }}
                    className={`px-2.5 py-1 rounded text-xs font-bold font-mono transition-all ${
                      tipoTablaTdr === "SALUD_OCUPACIONAL"
                        ? "bg-primary text-white shadow-sm ring-1 ring-primary"
                        : "bg-white text-on-surface-variant hover:bg-surface-container-high border border-outline-variant"
                    }`}
                  >
                    🩺 Tabla Salud / Laboratorio (Examen, Metodología y Propuesto)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTipoTablaTdr("FICHAS_DINAMICAS");
                      handleTextChange("tipo_tabla_tdr", "FICHAS_DINAMICAS");
                    }}
                    className={`px-2.5 py-1 rounded text-xs font-bold font-mono transition-all ${
                      tipoTablaTdr === "FICHAS_DINAMICAS"
                        ? "bg-primary text-white shadow-sm ring-1 ring-primary"
                        : "bg-white text-on-surface-variant hover:bg-surface-container-high border border-outline-variant"
                    }`}
                  >
                    📑 Fichas Técnicas Individuales
                  </button>
                </div>
              </div>

              {/* RENDERIZADO SEGÚN EL TIPO DE TABLA SELECCIONADO */}

              {/* 1. TABLA SIMPLE DE BIENES */}
              {tipoTablaTdr === "BIENES_SIMPLE" && (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-400 text-xs text-left">
                    <thead>
                      <tr className="bg-gray-100 font-bold uppercase text-gray-900 border-b border-gray-400">
                        <th className="border border-gray-400 p-2 text-center w-12">ÍTEM</th>
                        <th className="border border-gray-400 p-2 w-1/3">DESCRIPCIÓN DEL BIEN</th>
                        <th className="border border-gray-400 p-2 text-center w-20">UNIDAD</th>
                        <th className="border border-gray-400 p-2 text-center w-20">CANTIDAD</th>
                        <th className="border border-gray-400 p-2">CARACTERÍSTICAS TÉCNICAS REQUERIDAS</th>
                        <th className="border border-gray-400 p-1 text-center w-14 no-print">ACCIÓN</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.id} className="hover:bg-blue-50/20 border-b border-gray-300">
                          <td className="border border-gray-400 p-2 font-mono font-bold text-center bg-gray-50/50">
                            {item.item}
                          </td>
                          <td className="border border-gray-400 p-2 font-bold text-primary">
                            <div
                              contentEditable
                              suppressContentEditableWarning
                              onBlur={(e) => handleItemTextChange(item.id, "descripcion", e.currentTarget.textContent || "")}
                              className="focus:bg-white focus:outline-none p-1 rounded hover:bg-blue-50/50"
                            >
                              {item.descripcion}
                            </div>
                          </td>
                          <td className="border border-gray-400 p-2 text-center font-mono">
                            <div
                              contentEditable
                              suppressContentEditableWarning
                              onBlur={(e) => handleItemTextChange(item.id, "unidad", e.currentTarget.textContent || "")}
                              className="focus:bg-white focus:outline-none p-1 rounded hover:bg-blue-50/50"
                            >
                              {item.unidad || "PZA"}
                            </div>
                          </td>
                          <td className="border border-gray-400 p-2 text-center font-mono font-bold">
                            <div
                              contentEditable
                              suppressContentEditableWarning
                              onBlur={(e) => handleItemTextChange(item.id, "cantidad", Number(e.currentTarget.textContent) || 1)}
                              className="focus:bg-white focus:outline-none p-1 rounded hover:bg-blue-50/50"
                            >
                              {item.cantidad}
                            </div>
                          </td>
                          <td className="border border-gray-400 p-2 text-gray-800 leading-relaxed">
                            <div
                              contentEditable
                              suppressContentEditableWarning
                              onBlur={(e) => handleItemTextChange(item.id, "caracteristicasTecnicas", e.currentTarget.textContent || "")}
                              className="focus:bg-white focus:outline-none p-1 rounded hover:bg-blue-50/50 whitespace-pre-wrap"
                            >
                              {item.caracteristicasTecnicas ||
                                (item.fichaTecnica?.caracteristicasDetalle && item.fichaTecnica.caracteristicasDetalle.length > 0
                                  ? item.fichaTecnica.caracteristicasDetalle.join("\n• ")
                                  : `${item.fichaTecnica?.material ? `Material: ${item.fichaTecnica.material}. ` : ""}${item.fichaTecnica?.normaCertificacion ? `Norma: ${item.fichaTecnica.normaCertificacion}. ` : ""}${item.fichaTecnica?.dimensiones ? `Dimensiones: ${item.fichaTecnica.dimensiones}` : ""}`.trim()) ||
                                "Cumplimiento con especificaciones técnicas requeridas por ENDE Deoruro S.A."}
                            </div>
                          </td>
                          <td className="border border-gray-400 p-1 text-center no-print">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="text-red-500 hover:text-red-700 p-1"
                              title="Eliminar ítem"
                            >
                              <Trash2 className="w-4 h-4 mx-auto" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 2. TABLA DE SALUD OCUPACIONAL / LABORATORIO */}
              {tipoTablaTdr === "SALUD_OCUPACIONAL" && (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-400 text-xs text-left">
                    <thead>
                      <tr className="bg-gray-100 font-bold uppercase text-gray-900 border-b border-gray-400">
                        <th className="border border-gray-400 p-2 text-center w-12">ÍTEM</th>
                        <th className="border border-gray-400 p-2 w-1/3">EXAMEN / ESTUDIO REQUERIDO</th>
                        <th className="border border-gray-400 p-2 w-1/3">ESPECIFICACIÓN MÍNIMA / METODOLOGÍA</th>
                        <th className="border border-gray-400 p-2 w-1/4">PROPUESTO / A INFORMAR</th>
                        <th className="border border-gray-400 p-1 text-center w-14 no-print">ACCIÓN</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.id} className="hover:bg-blue-50/20 border-b border-gray-300">
                          <td className="border border-gray-400 p-2 font-mono font-bold text-center bg-gray-50/50">
                            {item.item}
                          </td>
                          <td className="border border-gray-400 p-2">
                            <div
                              contentEditable
                              suppressContentEditableWarning
                              onBlur={(e) => handleItemTextChange(item.id, "descripcion", e.currentTarget.textContent || "")}
                              className="font-bold text-primary focus:bg-white focus:outline-none p-1 rounded hover:bg-blue-50/50"
                            >
                              {item.descripcion}
                            </div>
                            <div className="text-[11px] text-gray-500 font-mono mt-0.5">
                              Cantidad: {item.cantidad} {item.unidad || "ESTUDIO"}
                            </div>
                          </td>
                          <td className="border border-gray-400 p-2 text-gray-800">
                            <div
                              contentEditable
                              suppressContentEditableWarning
                              onBlur={(e) => handleItemTextChange(item.id, "especificacionMinima", e.currentTarget.textContent || "")}
                              className="focus:bg-white focus:outline-none p-1 rounded hover:bg-blue-50/50 whitespace-pre-wrap leading-relaxed"
                            >
                              {item.especificacionMinima ||
                                item.fichaTecnica?.normaCertificacion ||
                                item.fichaTecnica?.material ||
                                "Examen médico / estudio de laboratorio clínico con metodología certificada y acreditación sanitaria."}
                            </div>
                          </td>
                          <td className="border border-gray-400 p-2 text-gray-700">
                            <div
                              contentEditable
                              suppressContentEditableWarning
                              onBlur={(e) => handleItemTextChange(item.id, "propuestoOferente", e.currentTarget.textContent || "")}
                              className="focus:bg-white focus:outline-none p-1 rounded hover:bg-blue-50/50 italic text-gray-600"
                            >
                              {item.propuestoOferente || "Cumple según metodología del oferente / A informar"}
                            </div>
                          </td>
                          <td className="border border-gray-400 p-1 text-center no-print">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="text-red-500 hover:text-red-700 p-1"
                              title="Eliminar examen"
                            >
                              <Trash2 className="w-4 h-4 mx-auto" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 3. FICHAS TÉCNICAS INDIVIDUALES */}
              {tipoTablaTdr === "FICHAS_DINAMICAS" && (
                <div className="space-y-6">
                  {items.map((item) => (
                    <div key={item.id} className="border-2 border-black rounded-lg p-4 bg-white space-y-3 shadow-sm">
                      <div className="flex justify-between items-center border-b border-gray-300 pb-1">
                        <span className="font-mono font-bold text-xs bg-primary text-white px-2.5 py-0.5 rounded">
                          ÍTEM #{item.item}: {item.cantidad} {item.unidad}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-red-600 hover:text-red-800 p-1 text-xs font-bold flex items-center gap-1"
                          title="Eliminar este ítem"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Eliminar</span>
                        </button>
                      </div>

                      <div
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => handleItemTextChange(item.id, "descripcion", e.currentTarget.textContent || "")}
                        className="font-black text-sm text-primary uppercase border-b pb-1 hover:bg-blue-50/50 p-1 rounded focus:outline-none"
                      >
                        {item.descripcion}
                      </div>

                      {/* Contenedor con Foto del Ítem y Campos */}
                      <div className={`grid gap-4 items-start ${incluirFotoEnItems ? "grid-cols-1 md:grid-cols-12" : "grid-cols-1"}`}>
                        {incluirFotoEnItems && (
                          <div className="md:col-span-4 h-44 bg-gray-50 border border-gray-300 rounded flex flex-col items-center justify-center text-gray-500 text-xs font-mono p-2 text-center relative group">
                            {item.fichaTecnica?.imagenUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={item.fichaTecnica.imagenUrl} alt="Foto" className="h-32 w-auto object-contain" />
                            ) : (
                              <>
                                <Camera className="w-7 h-7 text-gray-400 mb-1" />
                                <span className="font-bold">Fotografía Oficial del Ítem</span>
                              </>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              ref={(el) => {
                                fileInputRefs.current[item.id] = el;
                              }}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleImageUpload(item.id, f);
                              }}
                              className="hidden"
                            />
                            <button
                              type="button"
                              onClick={() => fileInputRefs.current[item.id]?.click()}
                              className="mt-1 px-2 py-0.5 bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-bold rounded"
                            >
                              Subir Foto
                            </button>
                          </div>
                        )}

                        <div className={`${incluirFotoEnItems ? "md:col-span-8" : "w-full"} space-y-2`}>
                          {camposMolde.map((campo, cIdx) => (
                            <div key={campo.id} className="p-1.5 border border-gray-200 rounded bg-gray-50/50 text-xs">
                              <strong className="text-primary block font-mono text-[11px] uppercase">{campo.nombre}:</strong>
                              <div
                                contentEditable
                                suppressContentEditableWarning
                                className="p-1 text-gray-800 hover:bg-white focus:bg-white rounded focus:outline-none"
                              >
                                {cIdx === 0
                                  ? item.fichaTecnica?.normaCertificacion || campo.valorEjemplo
                                  : cIdx === 1
                                  ? item.fichaTecnica?.material || campo.valorEjemplo
                                  : cIdx === 2
                                  ? item.fichaTecnica?.dimensiones || campo.valorEjemplo
                                  : cIdx === 3
                                  ? item.fichaTecnica?.uso || campo.valorEjemplo
                                  : item.fichaTecnica?.caracteristicasDetalle?.[0] || campo.valorEjemplo}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Punto 4: Calidad */}
              <div className="space-y-1 pt-2">
                <h4 className="font-bold text-gray-900 text-sm">
                  4. CALIDAD
                </h4>
                <div
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => handlePuntoChange(4, "contenido", e.currentTarget.textContent || "")}
                  className="text-justify leading-relaxed p-2 rounded hover:bg-blue-50/50 focus:outline-none text-gray-800"
                >
                  {puntosOficiales[3].contenido}
                </div>
              </div>
            </div>

            <div className="border-t border-gray-300 pt-2 flex justify-between text-xs font-mono text-gray-600 mt-auto">
              <span>{tituloEntidad}</span>
              <span>Página 4 de {totalPages}</span>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* PÁGINAS 5 Y 6: PUNTOS 5 AL 14 (CONDICIONES, PLAZOS, MULTAS)  */}
        {/* ============================================================ */}
        {(viewMode === "continuo" || currentPage >= 5) && (
          <div className="w-full max-w-full lg:max-w-[1050px] bg-white border border-outline-variant shadow-xl rounded-sm p-5 sm:p-10 md:p-14 text-on-surface font-sans min-h-[1050px] flex flex-col justify-between relative space-y-6">
            <div className="flex justify-between items-center text-xs text-gray-500 font-mono border-b border-gray-200 pb-1 font-bold">
              <span>{docData.titulo_proceso}</span>
              <span>PÁGINA 5 DE {totalPages} (CONDICIONES ADMINISTRATIVAS)</span>
            </div>

            <RunningHeader pageNum={5} />

            <div className="space-y-4 flex-1 text-sm font-sans">
              {puntosOficiales.slice(4).map((pto) => (
                <div key={pto.num} className="space-y-1">
                  <h4 className="font-bold text-gray-900 text-xs md:text-sm uppercase">
                    {pto.num}. {pto.titulo}
                  </h4>
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => handlePuntoChange(pto.num, "contenido", e.currentTarget.textContent || "")}
                    className="text-justify leading-relaxed p-1.5 rounded hover:bg-blue-50/50 focus:outline-none text-gray-800 text-xs md:text-sm"
                  >
                    {pto.contenido}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-300 pt-2 flex justify-between text-xs font-mono text-gray-600 mt-auto">
              <span>{tituloEntidad} • Oruro - Bolivia</span>
              <span>Página 5 de {totalPages}</span>
            </div>
          </div>
        )}

      </div>

      {/* Modal de Asistente IA */}
      <Modal
        isOpen={showAiModal}
        onClose={() => !isAiProcessing && setShowAiModal(false)}
        title="✨ Asistente de IA: Redacción y Estructuración de TDR"
        subtitle="Pega tu TDR en Markdown/Texto o sube tu documento. La IA acomodará la información en nuestra plantilla oficial respetando con fidelidad total tus especificaciones."
        maxWidth="lg"
      >
        <div className="space-y-4 font-sans text-xs">
          {/* Selector de Modo de Entrada */}
          <div className="flex border-b border-outline-variant">
            <button
              type="button"
              onClick={() => setAiInputMode("markdown")}
              className={`flex-1 py-2.5 text-center font-bold text-xs border-b-2 transition-colors ${
                aiInputMode === "markdown"
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-on-surface-variant hover:text-primary"
              }`}
            >
              📝 Pegar TDR (Formato Markdown / Texto)
            </button>
            <button
              type="button"
              onClick={() => setAiInputMode("file")}
              className={`flex-1 py-2.5 text-center font-bold text-xs border-b-2 transition-colors ${
                aiInputMode === "file"
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-on-surface-variant hover:text-primary"
              }`}
            >
              📁 Subir Archivo (.md, .txt, .pdf, Foto, Word)
            </button>
          </div>

          {/* Opción 1: Pegar Markdown / Texto Completo */}
          {aiInputMode === "markdown" ? (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="font-bold text-primary text-xs">
                  Pega aquí el contenido completo del TDR (en Markdown o Texto):
                </label>
                <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-mono font-semibold border border-emerald-200">
                  ✓ Fidelidad 100% Literal (Sin alucinaciones)
                </span>
              </div>
              <textarea
                rows={9}
                value={markdownTdrText}
                onChange={(e) => setMarkdownTdrText(e.target.value)}
                placeholder={`# ESPECIFICACIONES TÉCNICAS (TDR)\n\n## 1. ANTECEDENTES\nEn el marco del plan de mantenimiento anual...\n\n## 2. JUSTIFICACIÓN\nSe requiere la adquisición de los siguientes ítems para garantizar...\n\n## 3. ÍTEMS REQUERIDOS\n| Ítem | Descripción | Cantidad | Unidad | Características Técnicas |\n| 1 | Botas de Seguridad Dieléctricas | 20 | PAR | Conforme a norma ASTM F2413, suela antideslizante... |\n| 2 | Casco Dieléctrico Tipo II | 20 | PZA | Clase E, barboquejo de 4 puntos... |`}
                className="w-full p-3 border border-outline-variant rounded font-mono text-xs bg-surface leading-relaxed focus:outline-none focus:border-primary"
              />
              <p className="text-[11px] text-on-surface-variant italic">
                * La IA acomodará exactamente los antecedentes, justificación y cada ítem en la plantilla de ENDE Deoruro S.A. sin aumentar ni suprimir requisitos.
              </p>
            </div>
          ) : (
            /* Opción 2: Subir Archivo */
            <div
              onClick={() => aiFileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                uploadedAiFile ? "border-primary bg-primary/5" : "border-outline-variant hover:border-primary bg-surface-container-low"
              }`}
            >
              <input
                type="file"
                ref={aiFileInputRef}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleAiFileUpload(f);
                }}
                accept="image/*,.pdf,.doc,.docx,.txt,.md"
                className="hidden"
              />
              {uploadedAiFile ? (
                <div className="space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                  <p className="font-bold text-sm text-primary">{uploadedAiFile.name}</p>
                  <p className="text-[11px] text-outline">Haz clic para seleccionar otro archivo si lo deseas</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <FileUp className="w-10 h-10 text-primary mx-auto opacity-75" />
                  <p className="font-bold text-sm text-primary">Arrastra o haz clic aquí para subir tu documento o foto</p>
                  <p className="text-on-surface-variant text-[11px]">
                    Formatos soportados: Markdown (.md), Fotos (JPG, PNG), Documentos (PDF, Word, TXT)
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Selector de Tipo de Tabla Preferido */}
          <div className="p-3 bg-surface-container-low border border-outline-variant rounded-lg space-y-2">
            <span className="font-bold text-on-surface text-xs block">
              Formato de Tabla de Especificaciones Técnicas deseado:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTipoTablaTdr("BIENES_SIMPLE")}
                className={`p-2 rounded text-left border text-xs transition-all ${
                  tipoTablaTdr === "BIENES_SIMPLE"
                    ? "border-primary bg-white ring-2 ring-primary text-primary font-bold shadow-sm"
                    : "border-outline-variant bg-surface text-on-surface-variant hover:bg-white"
                }`}
              >
                <div className="font-bold">📦 Bienes General</div>
                <div className="text-[10px] text-outline font-normal">Descripción y Características</div>
              </button>

              <button
                type="button"
                onClick={() => setTipoTablaTdr("SALUD_OCUPACIONAL")}
                className={`p-2 rounded text-left border text-xs transition-all ${
                  tipoTablaTdr === "SALUD_OCUPACIONAL"
                    ? "border-primary bg-white ring-2 ring-primary text-primary font-bold shadow-sm"
                    : "border-outline-variant bg-surface text-on-surface-variant hover:bg-white"
                }`}
              >
                <div className="font-bold">🩺 Salud / Laboratorio</div>
                <div className="text-[10px] text-outline font-normal">Examen, Metodología y Propuesto</div>
              </button>

              <button
                type="button"
                onClick={() => setTipoTablaTdr("FICHAS_DINAMICAS")}
                className={`p-2 rounded text-left border text-xs transition-all ${
                  tipoTablaTdr === "FICHAS_DINAMICAS"
                    ? "border-primary bg-white ring-2 ring-primary text-primary font-bold shadow-sm"
                    : "border-outline-variant bg-surface text-on-surface-variant hover:bg-white"
                }`}
              >
                <div className="font-bold">📑 Fichas Técnicas</div>
                <div className="text-[10px] text-outline font-normal">Tarjetas individuales con foto</div>
              </button>
            </div>
          </div>

          {/* Opción de Fotografía Técnica en Ítems */}
          <div className="p-3 bg-surface-container-low border border-outline-variant rounded-lg flex items-center justify-between">
            <div>
              <label htmlFor="check-foto-modal" className="font-bold text-on-surface text-xs cursor-pointer block">
                ¿Incluir recuadro de fotografía para cada ítem?
              </label>
              <p className="text-[11px] text-on-surface-variant">
                Habilita el espacio para subir y mostrar la imagen técnica de cada ítem en las especificaciones.
              </p>
            </div>
            <input
              id="check-foto-modal"
              type="checkbox"
              checked={incluirFotoEnItems}
              onChange={(e) => setIncluirFotoEnItems(e.target.checked)}
              className="w-4 h-4 text-primary rounded cursor-pointer accent-primary ml-3"
            />
          </div>

          {/* Optional Prompt */}
          <div className="space-y-1">
            <label className="block font-bold text-primary text-xs">
              Instrucciones adicionales para la IA (Opcional):
            </label>
            <textarea
              rows={2}
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Ejemplo: Respetar fielmente las cantidades y métodos descritos..."
              className="w-full p-2.5 border border-outline-variant rounded text-xs bg-surface"
            />
          </div>

          {/* Footer Buttons */}
          <div className="flex justify-end gap-3 pt-2 border-t border-outline-variant">
            <button
              type="button"
              disabled={isAiProcessing}
              onClick={() => setShowAiModal(false)}
              className="px-4 py-2 border border-outline-variant rounded font-mono text-xs text-on-surface-variant hover:bg-surface-container-high"
            >
              Cancelar
            </button>

            <button
              type="button"
              disabled={isAiProcessing || (aiInputMode === "markdown" && !markdownTdrText.trim() && !uploadedAiFile)}
              onClick={handleRunAi}
              className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white font-sans text-xs font-bold rounded shadow transition-all active:scale-95 disabled:opacity-50"
            >
              {isAiProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Acomodando datos en Plantilla Oficial...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Acomodar en Plantilla TDR Oficial</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
