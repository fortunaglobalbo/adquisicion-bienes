"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Layers,
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Link2,
  FileText,
  Bot,
} from "lucide-react";
import { Carpeta, Adquisicion } from "@/types";

interface FolderAiGuideBannerProps {
  carpeta: Carpeta;
  adquisicion: Adquisicion;
  todasCarpetas?: Carpeta[];
}

export const FolderAiGuideBanner: React.FC<FolderAiGuideBannerProps> = ({
  carpeta,
  adquisicion,
  todasCarpetas = [],
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  // Guías estructuradas pre-configuradas para las carpetas oficiales
  const defaultGuides: Record<
    number,
    {
      queHace: string;
      deQuienDepende: string[];
      pasos: string[];
      consejo: string;
    }
  > = {
    1: {
      queHace:
        "Define técnicamente qué bienes o servicios se van a comprar con especificaciones y normativas oficiales (ASTM, IEC, ISO).",
      deQuienDepende: ["Insumo o requerimiento inicial cargado por la unidad solicitante."],
      pasos: [
        "Sube tu requerimiento en texto o archivo Word/PDF.",
        "El motor del VPS extrae los ítems y redacta antecedentes y justificación de 5 a 8 líneas.",
        "Descarga el Word Oficial (.docx) para continuar.",
      ],
      consejo: "Asegúrate de revisar las cantidades y unidades de medida antes de continuar a las siguientes carpetas.",
    },
    2: {
      queHace:
        "Registra la Solicitud de Inicio oficial (Formulario S1-N014) y la asignación de la Partida Presupuestaria.",
      deQuienDepende: ["Carpeta 1 (TDR / Especificaciones Técnicas)"],
      pasos: [
        "Sube el Formulario S1-N014 firmado o escaneado.",
        "Verifica que la partida presupuestaria (ej. 39500) coincida con la solicitud.",
      ],
      consejo: "Este documento formaliza que existe presupuesto autorizado para la adquisición.",
    },
    3: {
      queHace:
        "Establece el Cuadro de Justificación de la necesidad técnica y la previsión presupuestaria aprobada en Bs.",
      deQuienDepende: ["Carpeta 1 (TDR) y Carpeta 2 (S1-N014)"],
      pasos: [
        "Sube el informe técnico de justificación o previsión de precio.",
        "El sistema registrará el monto de previsión referencial para la contratación.",
      ],
      consejo: "Fundamental para compras menores y cotizaciones en el sistema SBC de ENDE.",
    },
    4: {
      queHace:
        "Registra y procesa mediante OCR las cotizaciones y proformas presentadas por los proveedores con sus NITs y precios.",
      deQuienDepende: ["Carpeta 1 (TDR con la lista de ítems a cotizar)"],
      pasos: [
        "Sube las proformas o cotizaciones en PDF escaneado o imagen.",
        "El motor VPS (Tesseract OCR) extraerá automáticamente el proveedor, NIT y montos en Bs.",
        "Se seleccionará la propuesta más económica que cumpla las especificaciones.",
      ],
      consejo: "Las cotizaciones registradas aquí se usarán automáticamente para adjudicar el Formulario S-2 y el Informe de Conformidad.",
    },
    5: {
      queHace:
        "Redacta formalmente la Solicitud de Inicio de Proceso dirigida a la Unidad de Contrataciones.",
      deQuienDepende: ["Carpeta 1 (TDR), Carpeta 2 (Partida) y Carpeta 3 (Justificación)"],
      pasos: [
        "Haz clic en 'Generar con IA' para que el VPS redacte el memorándum formal.",
        "Revisa los párrafos generados en el editor interactivo.",
        "Descarga el documento Word listo para su remisión.",
      ],
      consejo: "El sistema unifica automáticamente el objeto y la justificación técnica de las carpetas 1 a 3.",
    },
    6: {
      queHace:
        "Genera la Solicitud de Cotización Oficial (Formulario S2-N014) enviada al proponente adjudicado.",
      deQuienDepende: ["Carpeta 1 (Ítems y TDR) y Carpeta 4 (Proveedor con menor precio)"],
      pasos: [
        "Verifica el proveedor seleccionado de la Carpeta 4.",
        "La IA consolida el cuadro de cotización oficial y plazos de entrega.",
        "Descarga el pliego para invitar formalmente al proponente.",
      ],
      consejo: "Incluye la cláusula de requerimiento de fotocopia simple de NIT y SEPREC/Fundempresa.",
    },
    7: {
      queHace:
        "Genera el Informe Técnico de Conformidad y Recepción Definitiva (Formulario A6-N014) certificando el cumplimiento del 100%.",
      deQuienDepende: ["Carpeta 1 (TDR), Carpeta 4 (Cotizaciones) y Carpeta 6 (Formulario S-2)"],
      pasos: [
        "Haz clic en 'Generar con IA' para elaborar el informe de cumplimiento.",
        "Verifica la conclusión de recepción definitiva a satisfacción de ENDE DEORURO.",
        "Descarga el informe firmado para autorizar el desembolso.",
      ],
      consejo: "Documento indispensable para respaldar que los bienes fueron entregados en calidad y cantidad correctas.",
    },
    8: {
      queHace:
        "Elabora el Memorándum de Solicitud de Pago y Desembolso contable con el detalle de todos los documentos adjuntos.",
      deQuienDepende: ["Carpeta 7 (Informe de Conformidad) y Carpeta 6 (S-2)"],
      pasos: [
        "Haz clic en 'Generar con IA' para estructurar el memorándum oficial de pago.",
        "Comprueba la lista de documentos de respaldo adjuntos.",
        "Descarga el documento para remitir al área de Finanzas/Contabilidad.",
      ],
      consejo: "Con esta carpeta se culmina el ciclo administrativo completo de la adquisición.",
    },
  };

  const currentGuide = defaultGuides[carpeta.numero] || {
    queHace:
      carpeta.descripcion ||
      `Fase personalizada para tramitar y archivar la documentación correspondiente a ${carpeta.nombre}.`,
    deQuienDepende: [
      carpeta.plantilla_asociada_nombre
        ? `Plantilla oficial asignada: ${carpeta.plantilla_asociada_nombre}`
        : "Expediente general del proceso y especificaciones técnicas.",
    ],
    pasos: [
      "Paso 1: Sube la plantilla oficial (.pdf / .docx) o el documento correspondiente.",
      "Paso 2: Usa la IA para estructurar el contenido de esta fase.",
      "Paso 3: Descarga el documento oficial generado.",
    ],
    consejo: "Puedes reordenar o cambiar la plantilla de esta carpeta desde 'Gestionar Carpetas'.",
  };

  return (
    <div className="bg-gradient-to-r from-primary/5 via-surface-container-low to-secondary/5 border border-primary/20 rounded-xl p-4 shadow-sm transition-all">
      {/* Header del Asistente */}
      <div className="flex items-center justify-between gap-3 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-primary/10 text-primary rounded-lg">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-on-surface">
                Asistente Guía: Carpeta {carpeta.numero} — {carpeta.nombre}
              </span>
              <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-full font-mono">
                Paso a Paso
              </span>
            </div>
            <p className="text-[11px] text-on-surface-variant line-clamp-1 mt-0.5">
              {currentGuide.queHace}
            </p>
          </div>
        </div>

        <button
          type="button"
          className="p-1 text-on-surface-variant hover:text-primary rounded"
          title={isExpanded ? "Ocultar guía detallada" : "Mostrar guía detallada"}
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Contenido Detallado Desplegable */}
      {isExpanded && (
        <div className="mt-4 pt-3 border-t border-outline-variant/50 space-y-3 animate-fadeIn text-xs">
          {/* Fila 1: ¿Qué hace? y ¿De quién depende? */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* ¿Qué hace? */}
            <div className="bg-surface/80 border border-outline-variant/60 rounded-lg p-3 space-y-1">
              <span className="font-bold text-primary flex items-center gap-1.5 text-[11px]">
                <HelpCircle className="w-3.5 h-3.5" />
                ¿Qué se hace en esta carpeta?
              </span>
              <p className="text-on-surface text-[11.5px] leading-relaxed">
                {currentGuide.queHace}
              </p>
            </div>

            {/* ¿De quién depende? */}
            <div className="bg-surface/80 border border-outline-variant/60 rounded-lg p-3 space-y-1">
              <span className="font-bold text-secondary flex items-center gap-1.5 text-[11px]">
                <Link2 className="w-3.5 h-3.5" />
                ¿De qué información o carpetas previas depende?
              </span>
              <div className="space-y-1">
                {currentGuide.deQuienDepende.map((dep, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 text-[11.5px] text-on-surface-variant">
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary shrink-0" />
                    <span>{dep}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Fila 2: Pasos a Realizar */}
          <div className="bg-surface/90 border border-outline-variant/60 rounded-lg p-3 space-y-2">
            <span className="font-bold text-on-surface flex items-center gap-1.5 text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Pasos recomendados a realizar:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {currentGuide.pasos.map((paso, idx) => (
                <div
                  key={idx}
                  className="p-2 bg-surface-container-lowest border border-outline-variant/40 rounded-md flex items-start gap-2"
                >
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold font-mono text-[10px] flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <span className="text-[11px] text-on-surface leading-tight">{paso}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Consejo del Asistente */}
          {currentGuide.consejo && (
            <div className="text-[11px] text-on-surface-variant bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 px-3 py-1.5 rounded-md flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>
                <strong>Consejo útil:</strong> {currentGuide.consejo}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
