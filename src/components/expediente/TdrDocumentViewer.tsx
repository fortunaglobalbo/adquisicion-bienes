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
  FileDown,
} from "lucide-react";
import { Adquisicion, ItemAdquisicion, Plantilla, CampoMoldeLibre, TipoTablaTDR } from "@/types";
import { Modal } from "@/components/ui/Modal";
import { InstitutionalLogo } from "../layout/InstitutionalLogo";
import { DataStore } from "@/lib/store/dataStore";
import { parseMarkdownTdrLiteral, cleanInstitutionalText } from "@/lib/ai/markdownTdrParser";
import { getMesAnioActual } from "@/lib/utils/dateUtils";


interface TdrDocumentViewerProps {
  adquisicion: Adquisicion;
  onDownloadDocx: (liveData?: Adquisicion) => void;
  onDownloadPdf?: (liveData?: Adquisicion) => void;
  onAdquisicionUpdated?: (updated: Adquisicion) => void;
}

export const TdrDocumentViewer: React.FC<TdrDocumentViewerProps> = ({
  adquisicion,
  onDownloadDocx,
  onDownloadPdf,
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
  const [docData, setDocData] = useState<Adquisicion>({ 
    ...adquisicion,
    mes_anio_documento: adquisicion.mes_anio_documento || getMesAnioActual() 
  });
  const [tipoTablaTdr, setTipoTablaTdr] = useState<TipoTablaTDR>(
    adquisicion.tipo_tabla_tdr ||
    ((adquisicion.categoria as any) === "Salud Ocupacional" ||
    adquisicion.titulo_proceso.toLowerCase().includes("oftalmo") ||
    adquisicion.titulo_proceso.toLowerCase().includes("laboratorio")
      ? "SALUD_OCUPACIONAL"
      : "BIENES_SIMPLE")
  );

  // Sincronizar docData cuando cambian las props de adquisicion
  useEffect(() => {
    setDocData({
      ...adquisicion,
      mes_anio_documento: adquisicion.mes_anio_documento || getMesAnioActual(),
    });
    if (adquisicion.tipo_tabla_tdr) {
      setTipoTablaTdr(adquisicion.tipo_tabla_tdr);
    }
  }, [adquisicion]);

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
        documentText: markdownTdrText.trim() || aiPrompt.trim(),
        insumoTexto: markdownTdrText.trim() || aiPrompt.trim(),
        nombreArchivo: uploadedAiFile?.name,
      };

      if (uploadedAiFile?.base64) {
        payload.imageBase64 = uploadedAiFile.base64;
        payload.nombreArchivo = uploadedAiFile.name;
      }

      const res = await fetch("/api/ai/generate-tdr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok || result.error) {
        throw new Error(result.error || "Error al generar con IA");
      }

      const aiData = result.data || {};
      const aiItems = aiData.items || [];
      const detectedPuntos = aiData.puntos_14_texto || aiData.puntos_detectados || {};

      if (aiData) {
        const detectedTabla = aiData.tipo_tabla_sugerido || "BIENES_SIMPLE";

        const updated: Adquisicion = {
          ...docData,
          tipo_tabla_tdr: detectedTabla,
          titulo_proceso: aiData.titulo_proceso || docData.titulo_proceso,
          elaborado_por: aiData.elaborado_por || docData.elaborado_por,
          revisado_por: aiData.revisado_por || docData.revisado_por,
          aprobado_por: aiData.aprobado_por || docData.aprobado_por,
          antecedentes_texto: aiData.antecedentes_texto || detectedPuntos[1] || docData.antecedentes_texto,
          justificacion_texto: aiData.justificacion_texto || detectedPuntos[2] || docData.justificacion_texto,
          calidad_texto: aiData.calidad_texto || detectedPuntos[4] || docData.calidad_texto,
          ambito_aplicacion: aiData.ambito_aplicacion || detectedPuntos[5] || docData.ambito_aplicacion,
          metodo_seleccion_texto: aiData.metodo_seleccion_texto || detectedPuntos[6] || docData.metodo_seleccion_texto,
          vigencia_propuesta_texto: aiData.vigencia_propuesta_texto || detectedPuntos[7] || docData.vigencia_propuesta_texto,
          categoria_texto: aiData.categoria_texto || detectedPuntos[8] || docData.categoria_texto,
          lugar_entrega: aiData.lugar_entrega || detectedPuntos[9] || docData.lugar_entrega,
          tiempo_entrega_texto: aiData.tiempo_entrega_texto || detectedPuntos[10] || docData.tiempo_entrega_texto,
          forma_adjudicacion: aiData.forma_adjudicacion || detectedPuntos[11] || docData.forma_adjudicacion,
          aceptacion_lote: aiData.aceptacion_lote || detectedPuntos[12] || docData.aceptacion_lote,
          forma_pago_texto: aiData.forma_pago_texto || detectedPuntos[13] || docData.forma_pago_texto,
          multas_texto: aiData.multas_texto || detectedPuntos[14] || docData.multas_texto,
          puntos_14_texto: Object.keys(detectedPuntos).length > 0 ? detectedPuntos : docData.puntos_14_texto,
          seccion3_introduccion_texto: aiData.seccion3_introduccion_texto || docData.seccion3_introduccion_texto,
          columnas_tabla_tdr: aiData.columnas_tabla_tdr || docData.columnas_tabla_tdr,
          categoria: (aiData.categoria_detectada as any) || docData.categoria,
          items: aiItems.length > 0 ? aiItems : docData.items,
        };

        const totalPresupuesto = updated.items.reduce(
          (sum, it) => sum + (Number(it.precioTotalEstimado) || (Number(it.cantidad) || 1) * (Number(it.precioUnitarioEstimado) || 0)),
          0
        );
        updated.prevision_presupuesto = totalPresupuesto > 0 ? totalPresupuesto : updated.prevision_presupuesto;

        setTipoTablaTdr(detectedTabla);

        // Actualizar todos los 14 puntos inmediatamente en pantalla con COPIA FIEL 100%
        // Si el texto viene del parser directo, usarlo SIN cleanInstitutionalText para no alterar nada
        setPuntosOficiales((prev) =>
          prev.map((p) => {
            const detected = detectedPuntos[p.num];
            if (detected) return { ...p, contenido: detected };
            if (p.num === 1 && updated.antecedentes_texto) return { ...p, contenido: updated.antecedentes_texto };
            if (p.num === 2 && updated.justificacion_texto) return { ...p, contenido: updated.justificacion_texto };
            if (p.num === 4 && updated.calidad_texto) return { ...p, contenido: updated.calidad_texto };
            if (p.num === 5 && updated.ambito_aplicacion) return { ...p, contenido: updated.ambito_aplicacion };
            if (p.num === 6 && updated.metodo_seleccion_texto) return { ...p, contenido: updated.metodo_seleccion_texto };
            if (p.num === 7 && updated.vigencia_propuesta_texto) return { ...p, contenido: updated.vigencia_propuesta_texto };
            if (p.num === 8 && updated.categoria_texto) return { ...p, contenido: updated.categoria_texto };
            if (p.num === 9 && updated.lugar_entrega) return { ...p, contenido: updated.lugar_entrega };
            if (p.num === 10 && updated.tiempo_entrega_texto) return { ...p, contenido: updated.tiempo_entrega_texto };
            if (p.num === 11 && updated.forma_adjudicacion) return { ...p, contenido: updated.forma_adjudicacion };
            if (p.num === 12 && updated.aceptacion_lote) return { ...p, contenido: updated.aceptacion_lote };
            if (p.num === 13 && updated.forma_pago_texto) return { ...p, contenido: updated.forma_pago_texto };
            if (p.num === 14 && updated.multas_texto) return { ...p, contenido: updated.multas_texto };
            return p;
          })
        );

        // Auto-cascada para Carpetas 5 y 6 al generar Carpeta 1
        updated.solicitud_inicio_objeto = `SOLICITUD DE INICIO DEL PROCESO DE COMPRA "${(updated.titulo_proceso || "").toUpperCase()}"`;
        updated.solicitud_inicio_parrafo1 = `Por medio de la presente, me dirijo a su autoridad para solicitar formalmente el inicio del proceso de compra correspondiente al proceso "${(updated.titulo_proceso || "").toUpperCase()}".`;
        updated.form_s2_senores = updated.form_s2_senores || "PROVEEDOR / PROPONENTE";
        updated.form_s2_tiempo_entrega = updated.form_s2_tiempo_entrega || `${updated.plazo_entrega_dias || 30} días calendario`;
        updated.form_s2_validez_oferta = "30 días calendario";
        updated.form_s2_observaciones = "SE ADJUNTA ESPECIFICACIONES TECNICAS";
        updated.form_s2_nota_adicional = "ADJUNTAR FOTOCOPIA SIMPLE DE SU RNC - NIT";

        setDocData(updated);
        onAdquisicionUpdated?.(updated);
        setShowAiModal(false);
        setSavedFeedback(true);
        setTimeout(() => setSavedFeedback(false), 3000);

        // Descarga directa inmediata del archivo Word (.docx) generado
        onDownloadDocx(updated);
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
      antecedentes_texto: puntosOficiales.find((p) => p.num === 1)?.contenido || docData.antecedentes_texto,
      justificacion_texto: puntosOficiales.find((p) => p.num === 2)?.contenido || docData.justificacion_texto,
      tipo_tabla_tdr: tipoTablaTdr,
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

  const getDocPointContent = (num: number): string | undefined => {
    let raw: string | undefined = undefined;
    if (docData.puntos_14_texto?.[num]) raw = docData.puntos_14_texto[num];
    else if (num === 1 && docData.antecedentes_texto) raw = docData.antecedentes_texto;
    else if (num === 2 && docData.justificacion_texto) raw = docData.justificacion_texto;
    else if (num === 4 && docData.calidad_texto) raw = docData.calidad_texto;
    else if (num === 5 && docData.ambito_aplicacion) raw = docData.ambito_aplicacion;
    else if (num === 6 && docData.metodo_seleccion_texto) raw = docData.metodo_seleccion_texto;
    else if (num === 7 && docData.vigencia_propuesta_texto) raw = docData.vigencia_propuesta_texto;
    else if (num === 8 && docData.categoria_texto) raw = docData.categoria_texto;
    else if (num === 9 && docData.lugar_entrega) raw = docData.lugar_entrega;
    else if (num === 10 && docData.tiempo_entrega_texto) raw = docData.tiempo_entrega_texto;
    else if (num === 11 && docData.forma_adjudicacion) raw = docData.forma_adjudicacion;
    else if (num === 12 && docData.aceptacion_lote) raw = docData.aceptacion_lote;
    else if (num === 13 && docData.forma_pago_texto) raw = docData.forma_pago_texto;
    else if (num === 14 && docData.multas_texto) raw = docData.multas_texto;

    return raw ? cleanInstitutionalText(raw) : undefined;
  };

  const [puntosOficiales, setPuntosOficiales] = useState([
    {
      num: 1,
      titulo: "ANTECEDENTES",
      contenido: getDocPointContent(1) || "De acuerdo a la legislación vigente, normas y políticas internas se inicia el presente proceso de adquisición/contratación para el cumplimiento de los objetivos operativos e institucionales de la Distribuidora de Electricidad ENDE DEORURO S.A.",
    },
    {
      num: 2,
      titulo: "JUSTIFICACIÓN / NECESIDAD",
      contenido: getDocPointContent(2) || "La presente contratación se justifica en la necesidad operativa de contar oportunamente con los bienes y servicios requeridos para el adecuado funcionamiento de las áreas de ENDE DEORURO S.A.",
    },
    { num: 3, titulo: "ESPECIFICACION TECNICA", contenido: "Detalle técnico y especificaciones de los requerimientos:" },
    { num: 4, titulo: "CALIDAD", contenido: getDocPointContent(4) || (isSaludDomain ? "El proponente o laboratorio debe cumplir con los estándares de calidad y credenciales sanitarias vigentes ante las autoridades competentes." : "Los bienes deberán ser nuevos, de primer uso y fabricados bajo normas de calidad aplicables, con garantía oficial.") },
    { num: 5, titulo: "ÁMBITO DE APLICACIÓN", contenido: getDocPointContent(5) || "Personal institucional y áreas operativas/administrativas de la Distribuidora de Electricidad ENDE DEORURO S.A." },
    { num: 6, titulo: "MÉTODO DE SELECCIÓN", contenido: getDocPointContent(6) || "Menor Precio (Art. 31 del Reglamento SBC)." },
    { num: 7, titulo: "VIGENCIA DE LA PROPUESTA", contenido: getDocPointContent(7) || "Tendrá una validez mínima de 30 días calendario computables a partir de la fecha de presentación de la propuesta." },
    { num: 8, titulo: "CATEGORÍA", contenido: getDocPointContent(8) || (isSaludDomain ? "Salud Ocupacional y Medicina del Trabajo." : "Bienes y Suministros Oficiales.") },
    { num: 9, titulo: "LUGAR DE ENTREGA", contenido: getDocPointContent(9) || "Instalaciones / Almacén de ENDE DEORURO S.A., Oruro - Bolivia." },
    { num: 10, titulo: "TIEMPO DE ENTREGA", contenido: getDocPointContent(10) || `Máximo ${docData.plazo_entrega_dias || 30} días calendario computables a partir del día siguiente hábil de la recepción de la Orden de Compra.` },
    { num: 11, titulo: "FORMA DE ADJUDICACIÓN", contenido: getDocPointContent(11) || "Por Ítem requerido, formalizada por Orden de Compra (Art. 31 SBC)." },
    { num: 12, titulo: "PARA LA ACEPTACIÓN DEL LOTE / SERVICIO", contenido: getDocPointContent(12) || "El personal técnico de ENDE DEORURO realizará una evaluación técnica de conformidad el día de la entrega." },
    { num: 13, titulo: "FORMA DE PAGO", contenido: getDocPointContent(13) || "El pago se realizará contra entrega satisfactoria del producto o servicio, conformidad emitida por ENDE DEORURO S.A. y entrega de la siguiente documentación: Nota de Entrega / Conformidad, Solicitud de Pago y Factura oficial." },
    { num: 14, titulo: "APLICACIÓN DE MULTAS", contenido: getDocPointContent(14) || `Ante el incumplimiento de los plazos y otras condiciones establecidas en la Orden de Compra y Especificaciones Técnicas, se aplicará la multa del ${docData.multa_diaria_porcentaje || 0.25}% por cada día de retraso injustificado.` },
  ]);

  // Sincronizar: Si el documento tiene contenido literal se prioriza al 100%
  useEffect(() => {
    const tplSecs = activeTemplate?.secciones_prompt || tplData.seccionesPrompt || [];
    setPuntosOficiales((prev) =>
      prev.map((p) => {
        const userContent = getDocPointContent(p.num);
        if (userContent) {
          return { ...p, contenido: userContent };
        }
        const matchingTpl = tplSecs.find((s: any) => s.numero === p.num);
        const tplContent = matchingTpl?.contenido_default?.trim();
        return {
          ...p,
          titulo: matchingTpl?.titulo || p.titulo,
          contenido: tplContent || p.contenido,
        };
      })
    );
  }, [
    activeTemplate,
    docData.antecedentes_texto,
    docData.justificacion_texto,
    docData.calidad_texto,
    docData.ambito_aplicacion,
    docData.metodo_seleccion_texto,
    docData.vigencia_propuesta_texto,
    docData.categoria_texto,
    docData.lugar_entrega,
    docData.tiempo_entrega_texto,
    docData.forma_adjudicacion,
    docData.aceptacion_lote,
    docData.forma_pago_texto,
    docData.multas_texto,
    docData.puntos_14_texto,
  ]);

  // Actualizar contenido de un punto
  const handlePuntoChange = (num: number, field: "titulo" | "contenido", val: string) => {
    setPuntosOficiales((prev) =>
      prev.map((p) => (p.num === num ? { ...p, [field]: val } : p))
    );
    if (field === "contenido") {
      setDocData((prev) => {
        const nextPuntos = { ...(prev.puntos_14_texto || {}), [num]: val };
        const updated: any = { ...prev, puntos_14_texto: nextPuntos };
        if (num === 1) updated.antecedentes_texto = val;
        if (num === 2) updated.justificacion_texto = val;
        if (num === 4) updated.calidad_texto = val;
        if (num === 5) updated.ambito_aplicacion = val;
        if (num === 6) updated.metodo_seleccion_texto = val;
        if (num === 7) updated.vigencia_propuesta_texto = val;
        if (num === 8) updated.categoria_texto = val;
        if (num === 9) updated.lugar_entrega = val;
        if (num === 10) updated.tiempo_entrega_texto = val;
        if (num === 11) updated.forma_adjudicacion = val;
        if (num === 12) updated.aceptacion_lote = val;
        if (num === 13) updated.forma_pago_texto = val;
        if (num === 14) updated.multas_texto = val;
        return updated;
      });
    }
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
            onClick={() => onDownloadDocx(docData)}
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
              className={`px-3 py-1 rounded transition-colors ${viewMode === "continuo" ? "bg-primary text-on-surface-variant hover:text-on-surface" : "text-on-surface-variant hover:text-on-surface"}`}
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
              <span className="px-3 py-1 font-bold text-xs">
                {currentPage} / {totalPages}
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

      {/* Main Pages Container */}
      <div className="flex flex-col items-center gap-8 w-full">
        {/* PÁGINA 1: PORTADA OFICIAL */}
        {(viewMode === "continuo" || currentPage === 1) && (
          <div className="w-full max-w-full lg:max-w-[1050px] bg-white border border-outline-variant shadow-xl rounded-sm p-5 sm:p-10 md:p-14 text-on-surface font-sans min-h-[1050px] flex flex-col justify-between relative">
            <div className="flex justify-between items-center text-xs text-gray-500 font-mono border-b border-gray-200 pb-1 font-bold">
              <span>{adquisicion.codigo}</span>
              <span>PÁGINA 1 DE {totalPages}</span>
            </div>

            <RunningHeader pageNum={1} />

            <div className="text-center my-6 space-y-3">
              <h2 className="font-black text-xl md:text-2xl text-gray-900 uppercase tracking-wide leading-snug">
                {docData.titulo_proceso}
              </h2>
            </div>

            <div className="border border-gray-400 rounded overflow-hidden text-xs my-4">
              <div className="grid grid-cols-3 bg-gray-100 font-bold border-b border-gray-400 text-center text-gray-900 py-1.5">
                <div>ELABORADO POR:</div>
                <div>REVISADO POR:</div>
                <div>APROBADO POR:</div>
              </div>
              <div className="grid grid-cols-3 text-center py-4 divide-x divide-gray-300">
                <div
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => handleTextChange("elaborado_por", e.currentTarget.textContent || "")}
                  className="p-1 hover:bg-blue-50 focus:outline-none font-medium"
                >
                  {docData.elaborado_por || "Ing. Gabriela Bobarin"}
                </div>
                <div
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => handleTextChange("revisado_por", e.currentTarget.textContent || "")}
                  className="p-1 hover:bg-blue-50 focus:outline-none font-medium"
                >
                  {docData.revisado_por || "Ing. Raúl Torrico"}
                </div>
                <div
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => handleTextChange("aprobado_por", e.currentTarget.textContent || "")}
                  className="p-1 hover:bg-blue-50 focus:outline-none font-medium"
                >
                  {docData.aprobado_por || "Ing. Raúl Torrico"}
                </div>
              </div>
            </div>

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

        {/* PÁGINA 2: ÍNDICE GENERAL */}
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

        {/* PÁGINA 3: ANTECEDENTES Y JUSTIFICACIÓN */}
        {(viewMode === "continuo" || currentPage === 3) && (
          <div className="w-full max-w-full lg:max-w-[1050px] bg-white border border-outline-variant shadow-xl rounded-sm p-5 sm:p-10 md:p-14 text-on-surface font-sans min-h-[1050px] flex flex-col justify-between relative space-y-6">
            <div className="flex justify-between items-center text-xs text-gray-500 font-mono border-b border-gray-200 pb-1 font-bold">
              <span>{docData.titulo_proceso}</span>
              <span>PÁGINA 3 DE {totalPages}</span>
            </div>

            <RunningHeader pageNum={3} />

            <div className="space-y-6 flex-1 text-justify font-sans text-xs md:text-sm">
              <div className="space-y-1">
                <h4 className="font-bold text-gray-900 text-sm">
                  1. ANTECEDENTES
                </h4>
                <div
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => handlePuntoChange(1, "contenido", e.currentTarget.textContent || "")}
                  className="text-justify leading-relaxed p-2 rounded hover:bg-blue-50/50 focus:outline-none text-gray-800 whitespace-pre-line space-y-2"
                >
                  {puntosOficiales[0].contenido}
                </div>
              </div>

              <div className="space-y-1">
                <h4 className="font-bold text-gray-900 text-sm">
                  2. JUSTIFICACIÓN / NECESIDAD
                </h4>
                <div
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => handlePuntoChange(2, "contenido", e.currentTarget.textContent || "")}
                  className="text-justify leading-relaxed p-2 rounded hover:bg-blue-50/50 focus:outline-none text-gray-800 whitespace-pre-line space-y-2"
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

        {/* PÁGINA 4: ESPECIFICACIONES TÉCNICAS (TABLA DE ÍTEMS) */}
        {(viewMode === "continuo" || currentPage === 4) && (
          <div className="w-full max-w-full lg:max-w-[1050px] bg-white border border-outline-variant shadow-xl rounded-sm p-5 sm:p-10 md:p-14 text-on-surface font-sans min-h-[1050px] flex flex-col justify-between relative space-y-4">
            <div className="flex justify-between items-center text-xs text-gray-500 font-mono border-b border-gray-200 pb-1 font-bold">
              <span>{docData.titulo_proceso}</span>
              <span>PÁGINA 4 DE {totalPages}</span>
            </div>

            <RunningHeader pageNum={4} />

            <div className="space-y-4 flex-1">
              <div className="flex justify-between items-center border-b pb-2">
                <h4 className="font-bold text-gray-900 text-sm">
                  3. ESPECIFICACIÓN TÉCNICA
                </h4>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="flex items-center gap-1.5 px-3 py-1 bg-primary text-white font-sans text-xs font-bold rounded hover:bg-primary-container shadow-sm no-print"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Añadir Ítem</span>
                </button>
              </div>

              {/* Tabla de Ítems */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-400 text-xs text-left">
                  <thead>
                    <tr className="bg-gray-100 font-bold uppercase text-gray-900 border-b border-gray-400">
                      <th className="border border-gray-400 p-2 text-center w-12">ÍTEM</th>
                      <th className="border border-gray-400 p-2 w-1/3">DESCRIPCIÓN DEL ÍTEM</th>
                      <th className="border border-gray-400 p-2 w-20 text-center">CANT.</th>
                      <th className="border border-gray-400 p-2 w-20 text-center">UNIDAD</th>
                      <th className="border border-gray-400 p-2">CARACTERÍSTICAS / ESPECIFICACIÓN TÉCNICA</th>
                      <th className="border border-gray-400 p-1 text-center w-12 no-print">ACCIÓN</th>
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
                        <td className="border border-gray-400 p-2 font-mono font-bold text-center bg-gray-50/30">
                          <div
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={(e) => handleItemTextChange(item.id, "cantidad", Number(e.currentTarget.textContent) || 1)}
                            className="focus:bg-white focus:outline-none p-1 rounded hover:bg-blue-50/50"
                          >
                            {item.cantidad}
                          </div>
                        </td>
                        <td className="border border-gray-400 p-2 font-mono text-center bg-gray-50/30">
                          <div
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={(e) => handleItemTextChange(item.id, "unidad", e.currentTarget.textContent || "PZA")}
                            className="focus:bg-white focus:outline-none p-1 rounded hover:bg-blue-50/50 uppercase"
                          >
                            {item.unidad || "PZA"}
                          </div>
                        </td>
                        <td className="border border-gray-400 p-2 text-gray-800 leading-relaxed">
                          <div
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={(e) => handleItemTextChange(item.id, "caracteristicasTecnicas", e.currentTarget.textContent || "")}
                            className="focus:bg-white focus:outline-none p-1 rounded hover:bg-blue-50/50 whitespace-pre-wrap"
                          >
                            {item.caracteristicasTecnicas || item.especificacionMinima || "Especificaciones técnicas conforme a requerimiento de ENDE DEORURO S.A."}
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

              {/* Punto 4: Calidad */}
              <div className="space-y-1 pt-2">
                <h4 className="font-bold text-gray-900 text-sm">
                  4. CALIDAD
                </h4>
                <div
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => handlePuntoChange(4, "contenido", e.currentTarget.textContent || "")}
                  className="text-justify leading-relaxed p-2 rounded hover:bg-blue-50/50 focus:outline-none text-gray-800 text-xs md:text-sm whitespace-pre-line space-y-2"
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

        {/* PÁGINA 5: PUNTOS 5 AL 14 */}
        {(viewMode === "continuo" || currentPage === 5) && (
          <div className="w-full max-w-full lg:max-w-[1050px] bg-white border border-outline-variant shadow-xl rounded-sm p-5 sm:p-10 md:p-14 text-on-surface font-sans min-h-[1050px] flex flex-col justify-between relative space-y-4">
            <div className="flex justify-between items-center text-xs text-gray-500 font-mono border-b border-gray-200 pb-1 font-bold">
              <span>{docData.titulo_proceso}</span>
              <span>PÁGINA 5 DE {totalPages}</span>
            </div>

            <RunningHeader pageNum={5} />

            <div className="space-y-4 flex-1 text-justify font-sans text-xs md:text-sm">
              {puntosOficiales.slice(4).map((p) => (
                <div key={p.num} className="space-y-1">
                  <h4 className="font-bold text-gray-900 text-sm">
                    {p.num}. {p.titulo.toUpperCase()}
                  </h4>
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => handlePuntoChange(p.num, "contenido", e.currentTarget.textContent || "")}
                    className="text-justify leading-relaxed p-2 rounded hover:bg-blue-50/50 focus:outline-none text-gray-800 whitespace-pre-line"
                  >
                    {p.contenido}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-300 pt-2 flex justify-between text-xs font-mono text-gray-600 mt-auto">
              <span>{tituloEntidad}</span>
              <span>Página 5 de {totalPages}</span>
            </div>
          </div>
        )}
      </div>

      {/* Modal Simplificado y Directo de Asistente IA */}
      <Modal
        isOpen={showAiModal}
        onClose={() => !isAiProcessing && setShowAiModal(false)}
        title="✨ Asistente IA: Generar Documento Oficial Word (.docx)"
        subtitle="Ingresa el requerimiento o borrador. La IA de DeepSeek estructurará los 14 puntos oficiales de ENDE DEORURO S.A. y descargará directamente tu archivo Word."
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
              📝 Pegar Requerimiento / Texto
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
              📁 Subir Archivo (.pdf, Word, TXT, Foto)
            </button>
          </div>

          {/* Opción 1: Pegar Texto */}
          {aiInputMode === "markdown" ? (
            <div className="space-y-2">
              <label className="font-bold text-primary text-xs">
                Pega o escribe aquí tu requerimiento o borrador:
              </label>
              <textarea
                rows={9}
                value={markdownTdrText}
                onChange={(e) => setMarkdownTdrText(e.target.value)}
                placeholder="Ejemplo: Adquisición de herramientas para cuadrillas: 20 alicates universales 8 pulgadas, 3 carretillas, dos palas, una cinta aislante 1000V y 15 destornilladores planos 6 pulgadas."
                className="w-full p-3 border border-outline-variant rounded font-sans text-xs bg-surface leading-relaxed focus:outline-none focus:border-primary"
              />
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
                </div>
              ) : (
                <div className="space-y-1">
                  <FileUp className="w-10 h-10 text-primary mx-auto opacity-75" />
                  <p className="font-bold text-sm text-primary">Arrastra o haz clic aquí para subir tu documento o foto</p>
                  <p className="text-on-surface-variant text-[11px]">
                    Formatos: Documentos (Word, PDF, TXT), Fotos (JPG, PNG)
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex justify-end gap-3 pt-3 border-t border-outline-variant">
            <button
              type="button"
              disabled={isAiProcessing}
              onClick={() => setShowAiModal(false)}
              className="px-4 py-2 border border-outline-variant rounded font-sans text-xs text-on-surface-variant hover:bg-surface-container-high"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isAiProcessing || (aiInputMode === "markdown" && !markdownTdrText.trim() && !aiPrompt.trim()) || (aiInputMode === "file" && !uploadedAiFile)}
              onClick={async () => {
                await handleRunAi();
              }}
              className="px-6 py-2.5 bg-gradient-to-r from-primary to-primary-container hover:opacity-90 text-white font-sans text-xs font-bold rounded shadow flex items-center gap-2 disabled:opacity-50 active:scale-95"
            >
              {isAiProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Analizando con IA y Generando Word...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-yellow-300 fill-yellow-300" />
                  <span>Generar y Descargar Word Oficial (.docx)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
