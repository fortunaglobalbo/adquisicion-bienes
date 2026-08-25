"use client";

import React, { useState, useRef, useEffect } from "react";
import { Plantilla, CampoMoldeLibre } from "@/types";
import {
  Save,
  CheckCircle2,
  Plus,
  Trash2,
  ZoomIn,
  ZoomOut,
  Camera,
  Sparkles,
  BookOpen,
  ArrowUp,
  ArrowDown,
  Eye,
  Printer,
  X,
  FileText,
  CornerDownRight,
  Edit3,
  Stamp,
} from "lucide-react";
import { InstitutionalLogo } from "../layout/InstitutionalLogo";

export interface SectionWithPrompt {
  id: string;
  numero: number;
  titulo: string;
  prompt_ia: string;
  contenido_default: string;
  pagina_estimada?: number;
  showPrompt?: boolean;
  subindices?: { id: string; codigo: string; titulo: string; prompt_ia: string; pagina_estimada?: number }[];
}

interface VisualTemplateEditorProps {
  plantilla: Plantilla;
  onSave: (updatedPlantilla: Plantilla) => void;
  onClose?: () => void;
}

export const VisualTemplateEditor: React.FC<VisualTemplateEditorProps> = ({
  plantilla,
  onSave,
}) => {
  // Cargar datos guardados previamente de la plantilla o del almacenamiento local
  let savedData = plantilla.datos_completos || {};
  if (Object.keys(savedData).length === 0 && typeof window !== "undefined") {
    try {
      const localBackup = localStorage.getItem(`ende_plantilla_custom_${plantilla.id}`);
      if (localBackup) {
        savedData = JSON.parse(localBackup);
      }
    } catch {}
  }

  // Modal de Vista Previa para Impresión
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // --- CABECERA Y TEXTOS 100% EDITABLES DE PORTADA ---
  const [logoUrl, setLogoUrl] = useState<string | null>(plantilla.logo_url || savedData.logoUrl || null);
  const [tituloEntidad, setTituloEntidad] = useState(
    savedData.tituloEntidad || "DISTRIBUIDORA DE ELECTRICIDAD ENDE DEORURO S.A."
  );
  const [subtituloEntidad, setSubtituloEntidad] = useState(
    savedData.subtituloEntidad || "Oruro, Bolivia"
  );
  const [subtituloDoc, setSubtituloDoc] = useState(
    savedData.subtituloDoc || (plantilla.fk_carpeta === 1 ? "ESPECIFICACIONES TÉCNICAS" : plantilla.nombre.toUpperCase())
  );
  const [subtituloCabecera, setSubtituloCabecera] = useState(
    savedData.subtituloCabecera || "REGLAMENTO DE ADQUISICIÓN DE BIENES (SBC)"
  );
  const [codigoDoc, setCodigoDoc] = useState(
    savedData.codigoDoc || `ENDE-D-2026-00${plantilla.fk_carpeta}`
  );
  const [versionDoc, setVersionDoc] = useState(
    savedData.versionDoc || plantilla.version || "2026"
  );
  const [fechaDoc, setFechaDoc] = useState(
    savedData.fechaDoc || "Mayo - 2026"
  );
  const [lugarDoc, setLugarDoc] = useState(
    savedData.lugarDoc || "Oruro - Bolivia"
  );
  const [etiquetaResumen, setEtiquetaResumen] = useState(
    savedData.etiquetaResumen || "RESUMEN DEL OBJETO DE CONTRATACIÓN:"
  );
  const [contenidoResumen, setContenidoResumen] = useState(
    savedData.contenidoResumen ||
      "Adquisición de herramientas de trabajo y equipos especializados para mantenimiento de redes de Media y Baja Tensión de ENDE DEORURO S.A."
  );

  // Título dinámico
  const [tituloProceso, setTituloProceso] = useState(
    savedData.tituloProceso || (plantilla.fk_carpeta === 1 ? "ADQUISICIÓN DE HERRAMIENTA PARA CUADRILLAS" : plantilla.nombre.toUpperCase())
  );
  const [modalidad, setModalidad] = useState(
    savedData.modalidad || "Modalidad: Menor Precio (Art. 31 Reglamento SBC) • Partida: 39500"
  );

  // Textos del Índice y Pies de página
  const [tituloIndice, setTituloIndice] = useState(
    savedData.tituloIndice || "ÍNDICE GENERAL DEL DOCUMENTO"
  );
  const [piePaginaTexto, setPiePaginaTexto] = useState(
    savedData.piePaginaTexto || "ENDE DEORURO S.A. • Oruro - Bolivia"
  );
  const [piePaginaDocx, setPiePaginaDocx] = useState(
    savedData.piePaginaDocx || "Documento Oficial Word (.docx) • Tamaño 12 pt"
  );

  // --- SELLO Y CUADRO DE FIRMA DE PORTADA (100% PERSONALIZABLE O ELIMINABLE) ---
  const [incluirFirmaPortada, setIncluirFirmaPortada] = useState<boolean>(
    savedData.incluirFirmaPortada !== undefined ? savedData.incluirFirmaPortada : plantilla.incluir_firma_portada !== undefined ? plantilla.incluir_firma_portada : true
  );
  const [firmaNombre, setFirmaNombre] = useState(
    savedData.firmaNombre || plantilla.firma_nombre || "Ing. Heydi Canaviri Padilla"
  );
  const [firmaCargo, setFirmaCargo] = useState(
    savedData.firmaCargo || plantilla.firma_cargo || "SUPERVISORA SEGURIDAD INDUSTRIAL"
  );
  const [firmaEntidad, setFirmaEntidad] = useState(
    savedData.firmaEntidad || plantilla.firma_entidad || "DISTRIBUIDORA DE ELECTRICIDAD"
  );
  const [firmaEmpresa, setFirmaEmpresa] = useState(
    savedData.firmaEmpresa || plantilla.firma_empresa || "ENDE DEORURO S.A."
  );

  // --- SECCIONES OFICIALES DEL DOCUMENTO (11 PUNTOS CRONOLÓGICOS CON PROMPTS) ---
  const [seccionesPrompt, setSeccionesPrompt] = useState<SectionWithPrompt[]>(
    savedData.seccionesPrompt ||
      plantilla.secciones_prompt ||
      (plantilla.fk_carpeta === 1
        ? [
            {
              id: "sec-1",
              numero: 1,
              titulo: "ANTECEDENTES INSTITUCIONALES",
              pagina_estimada: 3,
              showPrompt: false,
              prompt_ia: "Redactar antecedentes citando la normativa de ENDE Corporación, Decreto Supremo 0181 y el Reglamento SBC vigente.",
              contenido_default: "La Distribuidora de Electricidad ENDE DEORURO S.A., en el marco de sus operaciones continuas y mantenimiento del sistema de distribución eléctrica en el Departamento de Oruro, requiere la adquisición de herramientas de trabajo para el personal técnico y cuadrillas de emergencia.",
              subindices: [
                { id: "sub-1-1", codigo: "1.1", titulo: "Marco Normativo Institucional del Sector Eléctrico", pagina_estimada: 3, prompt_ia: "Citar el Reglamento Interno de Contrataciones Art. 31." },
              ],
            },
            {
              id: "sec-2",
              numero: 2,
              titulo: "JUSTIFICACIÓN DE LA NECESIDAD TÉCNICA",
              pagina_estimada: 3,
              showPrompt: false,
              prompt_ia: "Enfocar la necesidad en la reposición por desgaste natural y prevención de accidentes laborales en cuadrillas de Media Tensión.",
              contenido_default: "Debido al desgaste constante por uso intensivo en campo y para dar estricto cumplimiento a las normativas de seguridad industrial y prevención de riesgos laborales, es imprescindible renovar y dotar del lote de herramientas operativas homologadas.",
            },
            {
              id: "sec-3",
              numero: 3,
              titulo: "ALCANCE DEL REQUERIMIENTO",
              pagina_estimada: 3,
              showPrompt: false,
              prompt_ia: "Indicar que el alcance comprende la provisión, embalaje, transporte y entrega formal de los bienes en almacén.",
              contenido_default: "El alcance comprende la provisión, embalaje de fábrica, transporte seguro y entrega formal de herramientas manuales e hidráulicas homologadas en Almacén Central de ENDE DEORURO S.A., Oruro - Bolivia.",
            },
            {
              id: "sec-4",
              numero: 4,
              titulo: "ESPECIFICACIONES TÉCNICAS DETALLADAS (FICHAS DE ÍTEMS)",
              pagina_estimada: 4,
              showPrompt: false,
              prompt_ia: "La IA multiplicará el molde maestro de la Ficha Técnica para todos los ítems detectados en la proforma o imagen.",
              contenido_default: "Cada ítem debe cumplir estrictamente con las características, dimensiones, normas ASTM/ISO y materiales indicados en las fichas técnicas individuales a continuación:",
            },
            {
              id: "sec-5",
              numero: 5,
              titulo: "DOCUMENTOS DE EXPERIENCIA Y CALIDAD",
              pagina_estimada: 5,
              showPrompt: false,
              prompt_ia: "Solicitar certificado de garantía de fábrica y catálogo técnico original del fabricante.",
              contenido_default: "El proponente deberá adjuntar catálogos oficiales del fabricante, certificados de calibración o control de calidad y carta de garantía de fábrica de los equipos ofertados.",
            },
            {
              id: "sec-6",
              numero: 6,
              titulo: "LUGAR DE ENTREGA",
              pagina_estimada: 5,
              showPrompt: false,
              prompt_ia: "Fijar Almacén Central Oruro - Bolivia.",
              contenido_default: "La entrega de los bienes se realizará en Almacén Central de ENDE DEORURO S.A., ubicado en la ciudad de Oruro - Bolivia.",
            },
            {
              id: "sec-7",
              numero: 7,
              titulo: "TIEMPO DE ENTREGA",
              pagina_estimada: 6,
              showPrompt: false,
              prompt_ia: "Instruir plazo máximo de 30 o 120 días calendario con posibilidad de ofertar plazos menores.",
              contenido_default: "Máximo 30 días calendario computables a partir del día siguiente hábil de la recepción formal de la Orden de Compra, pudiendo ofertar plazos menores.",
            },
            {
              id: "sec-8",
              numero: 8,
              titulo: "FORMA DE ADJUDICACIÓN",
              pagina_estimada: 6,
              showPrompt: false,
              prompt_ia: "Modalidad Menor Precio por Ítem según Art. 31 SBC.",
              contenido_default: "Por ítem requerido (Menor Precio - Art. 31 del Reglamento Específico del Sistema de Administración de Bienes y Servicios).",
            },
            {
              id: "sec-9",
              numero: 9,
              titulo: "PARA LA ACEPTACIÓN DEL LOTE",
              pagina_estimada: 6,
              showPrompt: false,
              prompt_ia: "Establecer evaluación física y técnica preliminar el día de la entrega.",
              contenido_default: "El personal técnico de ENDE DEORURO realizará una evaluación técnica preliminar el día de la entrega; en caso de existir observaciones o no cumplir especificaciones, se hará conocer inmediatamente para su subsanación.",
            },
            {
              id: "sec-10",
              numero: 10,
              titulo: "FORMA DE PAGO",
              pagina_estimada: 7,
              showPrompt: false,
              prompt_ia: "Pago 100% contra entrega conforme y entrega de Nota de Entrega, Solicitud de Pago y Factura.",
              contenido_default: "El pago se realizará contra entrega satisfactoria del producto, conformidad técnica emitida por ENDE DEORURO S.A. y entrega de la siguiente documentación: Nota de Entrega, Solicitud de Pago y Factura oficial original.",
            },
            {
              id: "sec-11",
              numero: 11,
              titulo: "APLICACIÓN DE MULTAS POR RETRASO",
              pagina_estimada: 7,
              showPrompt: false,
              prompt_ia: "Multa obligatoria del 0.25% por cada día de retraso injustificado.",
              contenido_default: "Ante el incumplimiento de los plazos establecidos en la Orden de Compra y Especificaciones Técnicas, se aplicará una multa del 0.25% por cada día calendario de retraso injustificado.",
            },
          ]
        : [
            {
              id: `sec-gen-1`,
              numero: 1,
              titulo: `OBJETO Y CONDICIONES DE ${plantilla.nombre.toUpperCase()}`,
              pagina_estimada: 1,
              showPrompt: false,
              prompt_ia: `Redactar los términos institucionales oficiales según el procedimiento de Carpeta ${plantilla.fk_carpeta}.`,
              contenido_default: `Documento oficial correspondiente a Carpeta ${plantilla.fk_carpeta}: ${plantilla.nombre}. Cumple con todas las disposiciones del Reglamento SBC de ENDE DEORURO S.A.`,
            },
          ])
  );

  // --- CAMPOS TÉCNICOS DEL MOLDE (100% EDITABLES) ---
  const [incluirFotoItem, setIncluirFotoItem] = useState<boolean>(
    savedData.incluirFotoItem !== undefined ? savedData.incluirFotoItem : plantilla.incluir_foto_item !== undefined ? plantilla.incluir_foto_item : true
  );

  const [nombreItemMolde, setNombreItemMolde] = useState(
    savedData.nombreItemMolde || "[NOMBRE DE LA HERRAMIENTA O EQUIPO EN MAYÚSCULAS]"
  );
  const [etiquetaItemMolde, setEtiquetaItemMolde] = useState(
    savedData.etiquetaItemMolde || "MOLDE MAESTRO: ÍTEM #[N]"
  );
  const [etiquetaFoto, setEtiquetaFoto] = useState(
    savedData.etiquetaFoto || "Fotografía del Ítem"
  );

  const [camposMoldeDirectos, setCamposMoldeDirectos] = useState<CampoMoldeLibre[]>(
    savedData.camposMoldeDirectos ||
      (plantilla.campos_molde_libres && plantilla.campos_molde_libres.length > 0
        ? plantilla.campos_molde_libres
        : [
            { id: "cmp-1", nombre: "Norma / Certificación Oficial", valorEjemplo: "ASTM A36 / ISO 9001 / IEEE" },
            { id: "cmp-2", nombre: "Material Principal y Acabado", valorEjemplo: "Acero al silicio manganeso 2X forjado con pavonado" },
            { id: "cmp-3", nombre: "Capacidad de Corte / Carga / Dimensión", valorEjemplo: "Corte 9/16 pulg - Largo 36 pulg (90 cm)" },
            { id: "cmp-4", nombre: "Uso Operativo y Destino de Cuadrilla", valorEjemplo: "Personal Operativo Mantenimiento Redes MT" },
            { id: "cmp-5", nombre: "Características y Ventajas Técnicas", valorEjemplo: "Cuchillas templadas y mecanismo de palanca de alto rendimiento" },
          ])
  );

  const [zoomScale, setZoomScale] = useState<number>(0.95);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  // --- REORDENAMIENTO DE SECCIONES ---
  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const newSecs = [...seccionesPrompt];
    const temp = newSecs[index - 1];
    newSecs[index - 1] = newSecs[index];
    newSecs[index] = temp;
    const renumbered = newSecs.map((s, idx) => ({ ...s, numero: idx + 1 }));
    setSeccionesPrompt(renumbered);
  };

  const handleMoveDown = (index: number) => {
    if (index >= seccionesPrompt.length - 1) return;
    const newSecs = [...seccionesPrompt];
    const temp = newSecs[index + 1];
    newSecs[index + 1] = newSecs[index];
    newSecs[index] = temp;
    const renumbered = newSecs.map((s, idx) => ({ ...s, numero: idx + 1 }));
    setSeccionesPrompt(renumbered);
  };

  // Toggle Prompt visibility
  const togglePromptVisibility = (secId: string) => {
    setSeccionesPrompt(
      seccionesPrompt.map((s) => (s.id === secId ? { ...s, showPrompt: !s.showPrompt } : s))
    );
  };

  // --- CAMPOS DIRECTOS ---
  const handleAddCampoDirecto = () => {
    const nextNum = camposMoldeDirectos.length + 1;
    const newField: CampoMoldeLibre = {
      id: `cmp-${Date.now()}`,
      nombre: `Nuevo Campo Técnico #${nextNum}`,
      valorEjemplo: "Especificación técnica requerida...",
    };
    setCamposMoldeDirectos([...camposMoldeDirectos, newField]);
  };

  const handleDeleteCampoDirecto = (id: string) => {
    if (camposMoldeDirectos.length <= 1) return;
    setCamposMoldeDirectos(camposMoldeDirectos.filter((c) => c.id !== id));
  };

  const handleCampoDirectoChange = (id: string, field: "nombre" | "valorEjemplo", val: string) => {
    setCamposMoldeDirectos(
      camposMoldeDirectos.map((c) => (c.id === id ? { ...c, [field]: val } : c))
    );
  };

  // --- SECCIONES ---
  const handleAddSeccionPrompt = () => {
    const nextNum = seccionesPrompt.length + 1;
    const newSec: SectionWithPrompt = {
      id: `sec-${Date.now()}`,
      numero: nextNum,
      titulo: `NUEVA DISPOSICIÓN / CAPÍTULO #${nextNum}`,
      pagina_estimada: 7,
      showPrompt: true,
      prompt_ia: `Instrucción detallada para que la IA genere el contenido oficial de esta sección.`,
      contenido_default: `Texto formal institucional predeterminado para esta sección...`,
      subindices: [],
    };
    setSeccionesPrompt([...seccionesPrompt, newSec]);
  };

  const handleDeleteSeccionPrompt = (id: string) => {
    if (seccionesPrompt.length <= 1) return;
    setSeccionesPrompt(
      seccionesPrompt.filter((s) => s.id !== id).map((s, idx) => ({ ...s, numero: idx + 1 }))
    );
  };

  const handleAddSubIndicePrompt = (secId: string) => {
    setSeccionesPrompt(
      seccionesPrompt.map((s) => {
        if (s.id !== secId) return s;
        const subs = s.subindices || [];
        const nextCod = `${s.numero}.${subs.length + 1}`;
        const newSub = {
          id: `sub-${Date.now()}`,
          codigo: nextCod,
          titulo: `Subsección ${nextCod}: Detalle Técnico`,
          pagina_estimada: s.pagina_estimada,
          prompt_ia: `Instrucción para que la IA redacte este punto específico.`,
        };
        return { ...s, subindices: [...subs, newSub] };
      })
    );
  };

  const handleDeleteSubIndicePrompt = (secId: string, subId: string) => {
    setSeccionesPrompt(
      seccionesPrompt.map((s) => {
        if (s.id !== secId) return s;
        const filtered = (s.subindices || []).filter((sub) => sub.id !== subId);
        const renumbered = filtered.map((sub, idx) => ({ ...sub, codigo: `${s.numero}.${idx + 1}` }));
        return { ...s, subindices: renumbered };
      })
    );
  };

  // Guardar configuración completa con persistencia garantizada
  const handleSave = () => {
    const payloadDatosCompletos = {
      logoUrl,
      tituloEntidad,
      subtituloEntidad,
      subtituloDoc,
      subtituloCabecera,
      codigoDoc,
      versionDoc,
      fechaDoc,
      lugarDoc,
      etiquetaResumen,
      contenidoResumen,
      tituloProceso,
      modalidad,
      tituloIndice,
      piePaginaTexto,
      piePaginaDocx,
      incluirFirmaPortada,
      firmaNombre,
      firmaCargo,
      firmaEntidad,
      firmaEmpresa,
      seccionesPrompt,
      incluirFotoItem,
      nombreItemMolde,
      etiquetaItemMolde,
      etiquetaFoto,
      camposMoldeDirectos,
    };

    const updated: Plantilla = {
      ...plantilla,
      nombre: tituloProceso,
      version: versionDoc,
      logo_url: logoUrl || undefined,
      incluir_foto_item: incluirFotoItem,
      campos_molde_libres: camposMoldeDirectos,
      secciones_prompt: seccionesPrompt,
      incluir_firma_portada: incluirFirmaPortada,
      firma_nombre: firmaNombre,
      firma_cargo: firmaCargo,
      firma_entidad: firmaEntidad,
      firma_empresa: firmaEmpresa,
      datos_completos: payloadDatosCompletos,
      descripcion: `Plantilla oficial de Carpeta ${plantilla.fk_carpeta} 100% editable y guardada con éxito.`,
    };

    // Guardar en Storage y disparar callback
    onSave(updated);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(`ende_plantilla_custom_${plantilla.id}`, JSON.stringify(payloadDatosCompletos));
      } catch (err) {
        console.error("Error al guardar respaldo local:", err);
      }
    }

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="space-y-6 select-text text-base">
      {/* ============================================================ */}
      {/* BARRA SUPERIOR DE ACCIONES Y GUARDADO                        */}
      {/* ============================================================ */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-white p-5 rounded-2xl border-2 border-outline-variant shadow-md gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center font-black text-lg shadow">
            C{plantilla.fk_carpeta}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <span className="font-black text-base text-primary uppercase tracking-wide">
                Plantilla Oficial • Carpeta {plantilla.fk_carpeta}: {plantilla.nombre}
              </span>
              <span className="text-xs font-mono bg-blue-100 text-blue-950 px-2.5 py-1 rounded-lg font-bold border border-blue-300">
                Versión {versionDoc}
              </span>
            </div>
            <p className="text-sm font-medium text-gray-700 mt-1 flex items-center gap-1.5">
              <Edit3 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span><strong>Control Total:</strong> Todos los títulos, membretes, sellos de firmas, campos y textos son 100% editables y guardables.</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Botón Ver Vista Previa Real */}
          <button
            onClick={() => setShowPreviewModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-black text-xs shadow-md transition-all hover:scale-105"
          >
            <Eye className="w-4 h-4 text-amber-300" />
            <span>📄 Vista Previa / Imprimir PDF</span>
          </button>

          {/* Zoom */}
          <div className="flex items-center border-2 border-gray-300 rounded-xl bg-gray-50 px-3 py-1.5 gap-2">
            <button onClick={() => setZoomScale(Math.max(0.7, zoomScale - 0.1))} className="p-1 hover:bg-gray-200 rounded-lg text-gray-800" title="Reducir">
              <ZoomOut className="w-4 h-4 font-bold" />
            </button>
            <span className="text-sm w-12 text-center font-mono font-black text-gray-900">{Math.round(zoomScale * 100)}%</span>
            <button onClick={() => setZoomScale(Math.min(1.2, zoomScale + 0.1))} className="p-1 hover:bg-gray-200 rounded-lg text-gray-800" title="Aumentar">
              <ZoomIn className="w-4 h-4 font-bold" />
            </button>
          </div>

          {savedSuccess && (
            <span className="flex items-center gap-2 text-sm font-black text-emerald-900 bg-emerald-100 border-2 border-emerald-400 px-4 py-2 rounded-xl animate-bounce shadow-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-700" />
              ¡Plantilla Guardada!
            </span>
          )}

          <button
            onClick={handleSave}
            className="flex items-center gap-2.5 px-5 py-2.5 bg-gradient-to-r from-primary to-blue-900 hover:from-blue-900 hover:to-blue-950 text-white rounded-xl font-black text-xs shadow-lg hover:shadow-xl transition-all hover:scale-[1.02]"
          >
            <Save className="w-4 h-4 text-amber-400" />
            <span>Guardar Plantilla</span>
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* HOJA OFICIAL REAL EN PANTALLA (100% EDITABLE EN CADA TEXTO)  */}
      {/* ============================================================ */}
      <div className="flex flex-col items-center justify-center p-4 md:p-8 bg-slate-900/5 dark:bg-black/30 rounded-2xl border border-outline-variant overflow-x-auto space-y-10">
        
        {/* ============================================================ */}
        {/* HOJA 1: PORTADA INSTITUCIONAL REAL (100% EDITABLE)           */}
        {/* ============================================================ */}
        <div
          style={{ transform: `scale(${zoomScale})`, transformOrigin: "top center" }}
          className="w-full max-w-[850px] bg-white border-2 border-gray-300 shadow-2xl rounded-sm p-10 md:p-14 text-black font-sans min-h-[1100px] flex flex-col justify-between space-y-6 relative transition-transform"
        >
          <div className="flex justify-between items-center text-xs text-gray-500 font-mono border-b border-gray-200 pb-1 font-bold">
            <input
              type="text"
              value={tituloEntidad}
              onChange={(e) => setTituloEntidad(e.target.value)}
              className="bg-transparent focus:outline-none w-2/3 border-b border-transparent hover:border-gray-400"
            />
            <span>PÁGINA 1 • PORTADA OFICIAL</span>
          </div>

          {/* Logo Central de Portada con Botón para Cambiarlo */}
          <div className="flex flex-col items-center justify-center pt-6 space-y-3 relative group">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Logo" className="h-24 w-auto object-contain drop-shadow" />
            ) : (
              <InstitutionalLogo size="lg" showText={false} />
            )}

            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={logoInputRef}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = () => setLogoUrl(reader.result as string);
                    reader.readAsDataURL(file);
                  }
                }}
                accept="image/*"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-xs font-bold transition-colors"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Cambiar Logo Institucional</span>
              </button>
              {logoUrl && (
                <button onClick={() => setLogoUrl(null)} className="text-xs text-red-600 font-bold hover:underline">
                  Restablecer Logo
                </button>
              )}
            </div>

            <input
              type="text"
              value={tituloEntidad}
              onChange={(e) => setTituloEntidad(e.target.value)}
              className="font-black text-sm md:text-base text-primary uppercase text-center bg-transparent focus:outline-none w-full border-b border-transparent hover:border-primary"
            />
            <input
              type="text"
              value={subtituloEntidad}
              onChange={(e) => setSubtituloEntidad(e.target.value)}
              className="text-xs font-mono text-gray-600 font-bold text-center bg-transparent focus:outline-none w-full border-b border-transparent hover:border-gray-400"
            />
          </div>

          {/* Título Principal Editable */}
          <div className="text-center space-y-4 my-8 border-y-2 border-primary/30 py-6 bg-primary/5 rounded-xl">
            <input
              type="text"
              value={subtituloDoc}
              onChange={(e) => setSubtituloDoc(e.target.value)}
              className="text-base md:text-lg font-bold tracking-widest uppercase text-gray-800 text-center bg-transparent focus:outline-none w-full border-b border-transparent hover:border-gray-400"
            />
            <textarea
              rows={2}
              value={tituloProceso}
              onChange={(e) => setTituloProceso(e.target.value)}
              className="w-full font-sans text-2xl md:text-3xl font-black text-primary uppercase text-center bg-transparent focus:outline-none resize-none border-b-2 border-transparent hover:border-primary"
            />
            <input
              type="text"
              value={modalidad}
              onChange={(e) => setModalidad(e.target.value)}
              className="w-full text-xs font-mono font-bold text-gray-700 text-center bg-transparent focus:outline-none border-b border-transparent hover:border-gray-400"
            />
          </div>

          {/* Resumen Oficial Editable */}
          <div className="space-y-2 my-4">
            <input
              type="text"
              value={etiquetaResumen}
              onChange={(e) => setEtiquetaResumen(e.target.value)}
              className="font-bold text-xs uppercase tracking-wider text-primary font-mono bg-transparent focus:outline-none w-full border-b border-transparent hover:border-primary"
            />
            <div className="p-4 bg-gray-50 border border-gray-300 rounded-lg text-sm leading-relaxed text-gray-900 font-medium">
              <div className="flex items-start gap-2">
                <span className="text-primary font-bold">❖ </span>
                <textarea
                  rows={2}
                  value={contenidoResumen}
                  onChange={(e) => setContenidoResumen(e.target.value)}
                  className="w-full bg-transparent focus:outline-none resize-none leading-relaxed text-gray-900 font-medium border-b border-transparent hover:border-gray-400"
                />
              </div>
            </div>
          </div>

          {/* Pie de Portada & SELLO DE FIRMA DIGITAL OFICIAL (100% VISIBLE, EDITABLE O ELIMINABLE) */}
          <div className="pt-6 border-t-2 border-gray-300 flex flex-col sm:flex-row justify-between items-start sm:items-end mt-auto text-sm font-sans gap-4">
            <div>
              <input
                type="text"
                value={fechaDoc}
                onChange={(e) => setFechaDoc(e.target.value)}
                className="font-black text-gray-900 bg-transparent focus:outline-none border-b border-transparent hover:border-gray-400"
              />
              <input
                type="text"
                value={lugarDoc}
                onChange={(e) => setLugarDoc(e.target.value)}
                className="text-xs text-gray-600 font-mono block bg-transparent focus:outline-none border-b border-transparent hover:border-gray-400"
              />
              <div className="mt-2 text-xs font-mono text-gray-600 space-y-0.5">
                <div>
                  <strong>CÓDIGO: </strong>
                  <input
                    type="text"
                    value={codigoDoc}
                    onChange={(e) => setCodigoDoc(e.target.value)}
                    className="font-bold text-gray-900 bg-transparent focus:outline-none w-28 border-b border-transparent hover:border-gray-400"
                  />
                </div>
                <div>
                  <strong>VERSIÓN: </strong>
                  <input
                    type="text"
                    value={versionDoc}
                    onChange={(e) => setVersionDoc(e.target.value)}
                    className="font-bold text-gray-900 bg-transparent focus:outline-none w-16 border-b border-transparent hover:border-gray-400"
                  />
                </div>
              </div>
            </div>

            {/* SELLO DE FIRMA OFICIAL (EDITABLE O ELIMINABLE) */}
            <div className="flex flex-col items-end space-y-1">
              {incluirFirmaPortada ? (
                <div className="border-2 border-blue-400 bg-blue-50/90 p-3.5 rounded-xl text-right font-mono text-xs text-primary space-y-1 shadow-sm relative group/firma min-w-[240px]">
                  <button
                    type="button"
                    onClick={() => setIncluirFirmaPortada(false)}
                    className="absolute -top-2.5 -left-2.5 bg-red-600 hover:bg-red-700 text-white rounded-full p-1 shadow transition-transform hover:scale-110 flex items-center gap-1 text-[10px] px-2 font-sans font-bold"
                    title="Eliminar sello de firma de la portada"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Eliminar Sello</span>
                  </button>

                  <input
                    type="text"
                    value={firmaNombre}
                    onChange={(e) => setFirmaNombre(e.target.value)}
                    className="font-bold underline text-right bg-transparent focus:outline-none w-full text-blue-950 border-b border-transparent hover:border-blue-400"
                  />
                  <input
                    type="text"
                    value={firmaCargo}
                    onChange={(e) => setFirmaCargo(e.target.value)}
                    className="text-right bg-transparent focus:outline-none w-full text-[11px] text-gray-800 border-b border-transparent hover:border-blue-400 uppercase font-bold"
                  />
                  <input
                    type="text"
                    value={firmaEntidad}
                    onChange={(e) => setFirmaEntidad(e.target.value)}
                    className="font-bold text-[10px] text-blue-900 text-right bg-transparent focus:outline-none w-full border-b border-transparent hover:border-blue-400 uppercase"
                  />
                  <input
                    type="text"
                    value={firmaEmpresa}
                    onChange={(e) => setFirmaEmpresa(e.target.value)}
                    className="font-bold text-[10px] text-blue-900 text-right bg-transparent focus:outline-none w-full border-b border-transparent hover:border-blue-400 uppercase"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIncluirFirmaPortada(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-950 rounded-lg text-xs font-bold border border-blue-300 shadow-sm"
                >
                  <Stamp className="w-3.5 h-3.5 text-blue-700" />
                  <span>+ Añadir Sello / Cuadro de Firma en Portada</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* HOJA 2: ÍNDICE GENERAL (100% EDITABLE EN CADA LÍNEA)         */}
        {/* ============================================================ */}
        {plantilla.fk_carpeta === 1 && (
          <div
            style={{ transform: `scale(${zoomScale})`, transformOrigin: "top center" }}
            className="w-full max-w-[850px] bg-white border-2 border-gray-300 shadow-2xl rounded-sm p-10 md:p-14 text-black font-sans min-h-[1100px] flex flex-col justify-between space-y-6 relative transition-transform"
          >
            <div className="flex justify-between items-center text-xs text-gray-500 font-mono border-b border-gray-200 pb-1 font-bold">
              <span>{subtituloDoc} • {codigoDoc}</span>
              <span>PÁGINA 2 • ÍNDICE GENERAL</span>
            </div>

            {/* Cabecera Oficial de 3 Celdas 100% Editable */}
            <div className="border-2 border-black flex justify-between items-stretch text-center font-sans">
              <div className="w-[30%] border-r-2 border-black p-2 flex flex-col items-center justify-center bg-white">
                <InstitutionalLogo size="sm" showText={false} />
                <input
                  type="text"
                  value={tituloEntidad}
                  onChange={(e) => setTituloEntidad(e.target.value)}
                  className="font-bold text-[8.5px] tracking-tight mt-1 text-primary text-center bg-transparent focus:outline-none w-full"
                />
              </div>
              <div className="w-[45%] border-r-2 border-black p-2 flex flex-col items-center justify-center">
                <input
                  type="text"
                  value={subtituloDoc}
                  onChange={(e) => setSubtituloDoc(e.target.value)}
                  className="font-black text-xs uppercase text-black leading-tight text-center bg-transparent focus:outline-none w-full"
                />
                <input
                  type="text"
                  value={subtituloCabecera}
                  onChange={(e) => setSubtituloCabecera(e.target.value)}
                  className="text-[9px] text-gray-700 font-medium mt-0.5 text-center bg-transparent focus:outline-none w-full"
                />
              </div>
              <div className="w-[25%] p-2 flex flex-col justify-center text-[9px] font-mono text-left space-y-0.5 bg-gray-50">
                <div>
                  <strong>CÓDIGO:</strong>{" "}
                  <input
                    type="text"
                    value={codigoDoc}
                    onChange={(e) => setCodigoDoc(e.target.value)}
                    className="bg-transparent focus:outline-none w-20 font-bold"
                  />
                </div>
                <div>
                  <strong>VERSIÓN:</strong>{" "}
                  <input
                    type="text"
                    value={versionDoc}
                    onChange={(e) => setVersionDoc(e.target.value)}
                    className="bg-transparent focus:outline-none w-14 font-bold"
                  />
                </div>
                <div>
                  <strong>FECHA:</strong>{" "}
                  <input
                    type="text"
                    value={fechaDoc}
                    onChange={(e) => setFechaDoc(e.target.value)}
                    className="bg-transparent focus:outline-none w-16 font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Contenido del Índice General con Botones de Reordenamiento */}
            <div className="space-y-4 flex-1 py-4">
              <div className="flex justify-between items-center border-b-2 border-primary pb-2">
                <div className="flex items-center gap-2 flex-1">
                  <BookOpen className="w-5 h-5 text-primary" />
                  <input
                    type="text"
                    value={tituloIndice}
                    onChange={(e) => setTituloIndice(e.target.value)}
                    className="font-black text-base text-primary uppercase tracking-widest bg-transparent focus:outline-none flex-1 border-b border-transparent hover:border-primary"
                  />
                </div>
                <button
                  onClick={handleAddSeccionPrompt}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-blue-900 text-white rounded-lg font-bold text-xs shadow"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Añadir Capítulo al Índice</span>
                </button>
              </div>

              <div className="space-y-2 text-sm font-sans pt-2">
                {seccionesPrompt.map((sec, idx) => (
                  <div key={sec.id} className="space-y-1">
                    <div className="flex justify-between items-center font-bold text-gray-900 border-b border-dotted border-gray-400 py-1.5 hover:bg-gray-50 px-2 rounded-lg transition-colors group/idx">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="font-mono text-primary font-black w-6">{sec.numero}.</span>
                        <input
                          type="text"
                          value={sec.titulo}
                          onChange={(e) => {
                            setSeccionesPrompt(
                              seccionesPrompt.map((s) => (s.id === sec.id ? { ...s, titulo: e.target.value } : s))
                            );
                          }}
                          className="font-bold text-sm uppercase bg-transparent focus:outline-none flex-1 border-b border-transparent hover:border-primary text-gray-900"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Controles de Subir / Bajar */}
                        <div className="flex items-center gap-1 opacity-0 group-idx:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleMoveUp(idx)}
                            disabled={idx === 0}
                            className="p-1 bg-gray-200 hover:bg-gray-300 disabled:opacity-30 rounded text-gray-800"
                            title="Subir capítulo"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleMoveDown(idx)}
                            disabled={idx === seccionesPrompt.length - 1}
                            className="p-1 bg-gray-200 hover:bg-gray-300 disabled:opacity-30 rounded text-gray-800"
                            title="Bajar capítulo"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteSeccionPrompt(sec.id)}
                            className="p-1 bg-red-100 hover:bg-red-200 text-red-700 rounded ml-1"
                            title="Eliminar del índice"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <span className="font-mono text-xs font-bold text-gray-600 bg-white pl-2">
                          Pág. {sec.pagina_estimada || sec.numero + 2}
                        </span>
                      </div>
                    </div>

                    {/* Subíndices */}
                    {sec.subindices && sec.subindices.length > 0 && (
                      <div className="pl-8 space-y-1">
                        {sec.subindices.map((sub) => (
                          <div key={sub.id} className="flex justify-between items-center text-xs font-medium text-gray-700 border-b border-dotted border-gray-300 py-0.5 hover:bg-gray-50 px-2 rounded">
                            <span className="flex items-center gap-2">
                              <span className="font-mono text-primary font-bold">{sub.codigo}</span>
                              <input
                                type="text"
                                value={sub.titulo}
                                onChange={(e) => {
                                  setSeccionesPrompt(
                                    seccionesPrompt.map((s) => {
                                      if (s.id !== sec.id) return s;
                                      return {
                                        ...s,
                                        subindices: (s.subindices || []).map((sb) =>
                                          sb.id === sub.id ? { ...sb, titulo: e.target.value } : sb
                                        ),
                                      };
                                    })
                                  );
                                }}
                                className="bg-transparent focus:outline-none flex-1 border-b border-transparent hover:border-gray-400 text-gray-800 text-xs"
                              />
                            </span>
                            <span className="font-mono text-[11px] text-gray-500 bg-white pl-2">
                              Pág. {sub.pagina_estimada || sec.pagina_estimada || 3}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Pie de Página Oficial Editable */}
            <div className="border-t border-gray-300 pt-2 flex justify-between text-xs font-mono text-gray-600">
              <input
                type="text"
                value={piePaginaTexto}
                onChange={(e) => setPiePaginaTexto(e.target.value)}
                className="bg-transparent focus:outline-none w-1/2"
              />
              <span>Página 2 de 7</span>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* HOJA 3 A 7: CAPÍTULOS 1 AL 11 (100% EDITABLES)               */}
        {/* ============================================================ */}
        <div
          style={{ transform: `scale(${zoomScale})`, transformOrigin: "top center" }}
          className="w-full max-w-[850px] bg-white border-2 border-gray-300 shadow-2xl rounded-sm p-10 md:p-14 text-black font-sans min-h-[1100px] flex flex-col justify-between space-y-6 relative transition-transform"
        >
          <div className="flex justify-between items-center text-xs text-gray-500 font-mono border-b border-gray-200 pb-1 font-bold">
            <span>{subtituloDoc} • {codigoDoc}</span>
            <span>PÁGINAS 3 A 7 • CAPÍTULOS Y ESPECIFICACIONES TÉCNICAS</span>
          </div>

          {/* Cabecera Oficial de 3 Celdas */}
          <div className="border-2 border-black flex justify-between items-stretch text-center font-sans">
            <div className="w-[30%] border-r-2 border-black p-2 flex flex-col items-center justify-center bg-white">
              <InstitutionalLogo size="sm" showText={false} />
              <input
                type="text"
                value={tituloEntidad}
                onChange={(e) => setTituloEntidad(e.target.value)}
                className="font-bold text-[8.5px] tracking-tight mt-1 text-primary text-center bg-transparent focus:outline-none w-full"
              />
            </div>
            <div className="w-[45%] border-r-2 border-black p-2 flex flex-col items-center justify-center">
              <input
                type="text"
                value={subtituloDoc}
                onChange={(e) => setSubtituloDoc(e.target.value)}
                className="font-black text-xs uppercase text-black leading-tight text-center bg-transparent focus:outline-none w-full"
              />
              <input
                type="text"
                value={subtituloCabecera}
                onChange={(e) => setSubtituloCabecera(e.target.value)}
                className="text-[9px] text-gray-700 font-medium mt-0.5 text-center bg-transparent focus:outline-none w-full"
              />
            </div>
            <div className="w-[25%] p-2 flex flex-col justify-center text-[9px] font-mono text-left space-y-0.5 bg-gray-50">
              <div>
                <strong>CÓDIGO:</strong>{" "}
                <input
                  type="text"
                  value={codigoDoc}
                  onChange={(e) => setCodigoDoc(e.target.value)}
                  className="bg-transparent focus:outline-none w-20 font-bold"
                />
              </div>
              <div>
                <strong>VERSIÓN:</strong>{" "}
                <input
                  type="text"
                  value={versionDoc}
                  onChange={(e) => setVersionDoc(e.target.value)}
                  className="bg-transparent focus:outline-none w-14 font-bold"
                />
              </div>
              <div>
                <strong>FECHA:</strong>{" "}
                <input
                  type="text"
                  value={fechaDoc}
                  onChange={(e) => setFechaDoc(e.target.value)}
                  className="bg-transparent focus:outline-none w-16 font-bold"
                />
              </div>
            </div>
          </div>

          {/* Capítulos en Orden Cronológico con Todos los Textos Editables */}
          <div className="space-y-6 flex-1 py-2 font-sans">
            {seccionesPrompt.map((sec, idx) => (
              <div key={sec.id} className="space-y-3 p-4 rounded-xl border border-gray-200 bg-white hover:border-primary transition-colors group/sec shadow-sm">
                {/* Encabezado del Capítulo */}
                <div className="flex justify-between items-center border-b border-gray-300 pb-1.5">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="font-black text-primary font-mono text-sm w-7 text-right">
                      {sec.numero}.
                    </span>
                    <input
                      type="text"
                      value={sec.titulo}
                      onChange={(e) => {
                        setSeccionesPrompt(
                          seccionesPrompt.map((s) => (s.id === sec.id ? { ...s, titulo: e.target.value } : s))
                        );
                      }}
                      className="font-black text-sm uppercase text-gray-900 bg-transparent focus:outline-none flex-1 border-b border-transparent hover:border-primary"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Botón Plegar/Desplegar Prompt */}
                    <button
                      onClick={() => togglePromptVisibility(sec.id)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                        sec.showPrompt ? "bg-amber-100 text-amber-900 border border-amber-300" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                      title="Ver/Ocultar Prompt de la IA"
                    >
                      <Sparkles className="w-3 h-3 text-amber-600" />
                      <span>{sec.showPrompt ? "Ocultar Prompt" : "✨ Prompt IA"}</span>
                    </button>

                    {/* Botones Subir / Bajar */}
                    <button
                      onClick={() => handleMoveUp(idx)}
                      disabled={idx === 0}
                      className="p-1 bg-gray-100 hover:bg-gray-200 disabled:opacity-30 rounded text-gray-800"
                      title="Subir capítulo"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleMoveDown(idx)}
                      disabled={idx === seccionesPrompt.length - 1}
                      className="p-1 bg-gray-100 hover:bg-gray-200 disabled:opacity-30 rounded text-gray-800"
                      title="Bajar capítulo"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleAddSubIndicePrompt(sec.id)}
                      className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-primary rounded text-xs font-bold"
                    >
                      + Subíndice
                    </button>

                    {seccionesPrompt.length > 1 && (
                      <button
                        onClick={() => handleDeleteSeccionPrompt(sec.id)}
                        className="text-red-500 hover:text-red-700 p-1 opacity-0 group-sec:opacity-100 transition-opacity"
                        title="Eliminar capítulo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Subíndices */}
                {sec.subindices && sec.subindices.length > 0 && (
                  <div className="pl-6 space-y-2 border-l-2 border-primary/40 ml-2">
                    {sec.subindices.map((sub) => (
                      <div key={sub.id} className="p-2.5 bg-gray-50 rounded-lg border border-gray-200 space-y-1 group/sub">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2 flex-1">
                            <CornerDownRight className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span className="font-black text-primary text-xs w-8">{sub.codigo}</span>
                            <input
                              type="text"
                              value={sub.titulo}
                              onChange={(e) => {
                                setSeccionesPrompt(
                                  seccionesPrompt.map((s) => {
                                    if (s.id !== sec.id) return s;
                                    return {
                                      ...s,
                                      subindices: (s.subindices || []).map((sb) =>
                                        sb.id === sub.id ? { ...sb, titulo: e.target.value } : sb
                                      ),
                                    };
                                  })
                                );
                              }}
                              className="text-xs font-bold text-gray-900 bg-transparent focus:outline-none flex-1 border-b border-transparent hover:border-gray-400"
                            />
                          </div>
                          <button
                            onClick={() => handleDeleteSubIndicePrompt(sec.id, sub.id)}
                            className="text-red-500 hover:text-red-700 p-0.5 opacity-0 group-sub:opacity-100"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* PROMPT DE LA IA (Plegable y Sutil) */}
                {sec.showPrompt && (
                  <div className="bg-amber-50/80 border border-amber-300 p-3 rounded-lg space-y-1 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-amber-950">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      <span>Instrucción / Prompt de la IA para este Capítulo:</span>
                    </div>
                    <input
                      type="text"
                      value={sec.prompt_ia}
                      onChange={(e) => {
                        setSeccionesPrompt(
                          seccionesPrompt.map((s) => (s.id === sec.id ? { ...s, prompt_ia: e.target.value } : s))
                        );
                      }}
                      className="w-full text-xs text-amber-950 bg-white p-2 rounded border border-amber-300 focus:outline-none italic"
                    />
                  </div>
                )}

                {/* TEXTO OFICIAL INSTITUCIONAL EDITABLE DIRECTAMENTE EN LA HOJA */}
                <textarea
                  rows={2}
                  value={sec.contenido_default}
                  onChange={(e) => {
                    setSeccionesPrompt(
                      seccionesPrompt.map((s) => (s.id === sec.id ? { ...s, contenido_default: e.target.value } : s))
                    );
                  }}
                  className="w-full p-2.5 text-sm leading-relaxed text-gray-900 bg-gray-50/50 hover:bg-white focus:bg-white border border-gray-200 focus:border-primary rounded-lg resize-none font-medium transition-colors"
                />

                {/* CAPÍTULO 4: MOLDE MAESTRO DE FICHA TÉCNICA 100% EDITABLE */}
                {sec.numero === 4 && (plantilla.fk_carpeta === 1 || plantilla.fk_carpeta === 6) && (
                  <div className="mt-4 pt-4 border-t-2 border-dashed border-gray-300 space-y-3">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs font-mono font-bold text-primary uppercase">
                      <span className="flex items-center gap-2">
                        🟨 MOLDE MAESTRO DE FICHA TÉCNICA (LA IA LO MULTIPLICARÁ AUTOMÁTICAMENTE PARA N ÍTEMS)
                      </span>
                      <button
                        type="button"
                        onClick={() => setIncluirFotoItem(!incluirFotoItem)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-bold text-xs transition-all ${
                          incluirFotoItem
                            ? "bg-emerald-50 text-emerald-950 border-emerald-400 shadow-sm"
                            : "bg-gray-100 text-gray-700 border-gray-300"
                        }`}
                      >
                        <Camera className="w-3.5 h-3.5 text-emerald-700" />
                        <span>¿Incluir Fotografía en cada Ítem?: {incluirFotoItem ? "SÍ (Activo)" : "NO"}</span>
                      </button>
                    </div>

                    {/* FICHA TÉCNICA OFICIAL */}
                    <div className="border-2 border-black p-4 rounded-lg bg-white space-y-3 shadow-sm">
                      <div className="flex justify-between items-center border-b border-gray-300 pb-1.5">
                        <input
                          type="text"
                          value={etiquetaItemMolde}
                          onChange={(e) => setEtiquetaItemMolde(e.target.value)}
                          className="font-mono font-bold text-xs bg-primary text-white px-2.5 py-0.5 rounded focus:outline-none"
                        />
                        <span className="text-xs font-mono text-gray-500 italic">
                          (Se multiplicará idéntico para cada herramienta detectada)
                        </span>
                      </div>

                      <input
                        type="text"
                        value={nombreItemMolde}
                        onChange={(e) => setNombreItemMolde(e.target.value)}
                        className="font-black text-sm text-primary uppercase border-b pb-1 w-full bg-transparent focus:outline-none hover:border-primary"
                      />

                      <div className={`grid gap-4 items-start ${incluirFotoItem ? "grid-cols-1 md:grid-cols-12" : "grid-cols-1"}`}>
                        {incluirFotoItem && (
                          <div className="md:col-span-4 h-36 bg-gray-50 border border-gray-300 rounded flex flex-col items-center justify-center text-gray-500 text-xs font-mono p-2 text-center">
                            <Camera className="w-7 h-7 text-gray-400 mb-1" />
                            <input
                              type="text"
                              value={etiquetaFoto}
                              onChange={(e) => setEtiquetaFoto(e.target.value)}
                              className="font-bold text-center bg-transparent focus:outline-none w-full text-xs text-gray-700"
                            />
                          </div>
                        )}

                        {/* LISTA DE CAMPOS TÉCNICOS EDITABLES CON BOTÓN 🗑️ */}
                        <div className={`${incluirFotoItem ? "md:col-span-8" : "w-full"} space-y-1.5`}>
                          {camposMoldeDirectos.map((campo) => (
                            <div
                              key={campo.id}
                              className="flex items-center gap-2 p-1.5 border border-gray-200 rounded hover:border-gray-400 transition-colors group/row bg-gray-50/50"
                            >
                              <div className="w-5/12">
                                <input
                                  type="text"
                                  value={campo.nombre}
                                  onChange={(e) => handleCampoDirectoChange(campo.id, "nombre", e.target.value)}
                                  placeholder="Nombre del campo..."
                                  className="font-bold text-xs text-gray-900 bg-transparent focus:outline-none w-full border-b border-transparent hover:border-primary"
                                />
                              </div>
                              <div className="w-6/12">
                                <input
                                  type="text"
                                  value={campo.valorEjemplo}
                                  onChange={(e) => handleCampoDirectoChange(campo.id, "valorEjemplo", e.target.value)}
                                  placeholder="Ejemplo de especificación..."
                                  className="text-xs text-gray-700 italic font-mono bg-white px-2 py-0.5 rounded border border-gray-300 w-full focus:outline-none"
                                />
                              </div>
                              <div className="w-1/12 flex justify-end">
                                {camposMoldeDirectos.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCampoDirecto(campo.id)}
                                    className="text-red-500 hover:text-red-700 p-0.5 opacity-0 group-row:opacity-100 transition-opacity"
                                    title="Eliminar este campo"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}

                          {/* BOTÓN PARA AÑADIR CAMPO AL MOLDE */}
                          <button
                            type="button"
                            onClick={handleAddCampoDirecto}
                            className="w-full flex items-center justify-center gap-1.5 py-1.5 border-2 border-dashed border-primary/50 hover:border-primary bg-primary/5 hover:bg-primary/10 text-primary font-bold rounded text-xs transition-colors shadow-sm mt-2"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>+ Añadir Nuevo Campo Técnico a esta Ficha</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pie de Página Oficial Editable */}
          <div className="pt-6 border-t-2 border-gray-300 flex justify-between items-end mt-auto text-xs font-mono text-gray-600">
            <div>
              <input
                type="text"
                value={tituloEntidad}
                onChange={(e) => setTituloEntidad(e.target.value)}
                className="font-bold text-gray-900 bg-transparent focus:outline-none w-64 block"
              />
              <input
                type="text"
                value={lugarDoc}
                onChange={(e) => setLugarDoc(e.target.value)}
                className="bg-transparent focus:outline-none w-32 block text-gray-500"
              />
            </div>
            <div className="text-right">
              <input
                type="text"
                value={piePaginaDocx}
                onChange={(e) => setPiePaginaDocx(e.target.value)}
                className="bg-transparent focus:outline-none text-right w-64 text-gray-500"
              />
            </div>
          </div>
        </div>

      </div>

      {/* ============================================================ */}
      {/* MODAL EMERGENTE DE VISTA PREVIA LISTO PARA IMPRIMIR          */}
      {/* ============================================================ */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-6 overflow-y-auto">
          <div className="bg-gray-100 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden border-2 border-gray-400">
            {/* Cabecera del Modal */}
            <div className="bg-primary text-white p-4 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-amber-300" />
                <h3 className="font-black text-sm uppercase tracking-wide">
                  Vista Previa Oficial del Documento Real ({codigoDoc})
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir / PDF</span>
                </button>
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Contenido de Hojas Limpias para Imprimir */}
            <div className="p-4 md:p-8 overflow-y-auto space-y-8 bg-gray-300 flex flex-col items-center">
              {/* Hoja 1: Portada Real */}
              <div className="w-full max-w-[780px] bg-white border border-gray-300 shadow-xl p-10 text-black font-sans space-y-6">
                <div className="flex justify-between items-center text-[10px] text-gray-400 font-mono border-b pb-1">
                  <span>{tituloEntidad}</span>
                  <span>PÁGINA 1 DE 7</span>
                </div>
                <div className="flex flex-col items-center justify-center pt-4 space-y-2">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt="Logo" className="h-20 w-auto object-contain" />
                  ) : (
                    <InstitutionalLogo size="lg" showText={false} />
                  )}
                  <span className="font-black text-xs text-primary uppercase mt-1 text-center">
                    {tituloEntidad}
                  </span>
                </div>
                <div className="text-center space-y-3 my-6">
                  <h3 className="text-base font-bold uppercase tracking-widest text-gray-800">
                    {subtituloDoc}
                  </h3>
                  <div className="font-black text-xl text-primary uppercase">
                    {tituloProceso}
                  </div>
                  <div className="text-xs font-mono text-gray-600">{modalidad}</div>
                </div>
                <div className="p-3 bg-gray-50 border rounded text-xs leading-relaxed">
                  <p><strong>❖ {etiquetaResumen}</strong> {contenidoResumen}</p>
                </div>
                <div className="pt-6 border-t flex justify-between items-end text-xs text-gray-600">
                  <div>
                    <div>{fechaDoc} • {lugarDoc}</div>
                    <div>CÓDIGO: {codigoDoc}</div>
                  </div>
                  {incluirFirmaPortada && (
                    <div className="border border-blue-400 bg-blue-50/80 p-2.5 rounded text-right font-mono text-[10px] text-primary space-y-0.5">
                      <div className="font-bold underline">{firmaNombre}</div>
                      <div>{firmaCargo}</div>
                      <div className="font-bold text-[9px] text-blue-900">{firmaEntidad}</div>
                      <div className="font-bold text-[9px] text-blue-900">{firmaEmpresa}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Hoja 2: Índice General */}
              <div className="w-full max-w-[780px] bg-white border border-gray-300 shadow-xl p-10 text-black font-sans space-y-4">
                <div className="flex justify-between items-center text-[10px] text-gray-400 font-mono border-b pb-1">
                  <span>{subtituloDoc} • {codigoDoc}</span>
                  <span>PÁGINA 2 DE 7</span>
                </div>
                <div className="text-center border-b-2 border-primary pb-1">
                  <h4 className="font-black text-sm text-primary uppercase tracking-widest">
                    {tituloIndice}
                  </h4>
                </div>
                <div className="space-y-2 text-xs">
                  {seccionesPrompt.map((sec) => (
                    <div key={sec.id} className="flex justify-between items-end border-b border-dotted border-gray-300 py-1">
                      <span className="font-bold">{sec.numero}. {sec.titulo}</span>
                      <span className="font-mono text-gray-500">Pág. {sec.pagina_estimada || sec.numero + 2}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Pie del Modal */}
            <div className="bg-white p-3 border-t flex justify-end">
              <button
                onClick={() => setShowPreviewModal(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-800 text-white rounded-lg font-bold text-xs"
              >
                Cerrar Vista Previa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
