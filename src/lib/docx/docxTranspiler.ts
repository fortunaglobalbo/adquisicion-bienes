/**
 * Transpilador de Documentos Word (.docx) a Plantillas de Código Nativo
 * DISTRIBUIDORA DE ELECTRICIDAD ENDE DEORURO S.A.
 */

import { Plantilla, SeccionPlantilla, FirmanteDefault, ClausulaDefault, IndiceSeccionPlantilla } from "@/types";

export interface TranspiledTemplateResult {
  plantilla: Plantilla;
  totalParrafos: number;
  totalTablas: number;
  seccionesDetectadas: string[];
  firmantesDetectados: string[];
  camposDetectados: string[];
}

export class DocxTranspiler {
  /**
   * Transpila el resultado de la inspección de un DOCX en una Plantilla de Código Nativa
   */
  static transpileFromInspection(
    inspectData: any,
    fkCarpeta: number,
    nombrePlantilla: string
  ): TranspiledTemplateResult {
    const paragraphs: Array<{ index: number; text: string; placeholders: string[]; is_fillable: boolean }> =
      inspectData.paragraphs || [];
    const tables: Array<{ table_index: number; headers: string[]; sample_first_row: string[] }> =
      inspectData.tables || [];

    const seccionesDetectadas: string[] = [];
    const clausulas: ClausulaDefault[] = [];
    const indiceSecciones: IndiceSeccionPlantilla[] = [];
    const firmantes: FirmanteDefault[] = [];
    const camposDetectados: string[] = [];

    // 1. Detectar Secciones y Cláusulas
    let seccionNum = 1;
    for (let i = 0; i < paragraphs.length; i++) {
      const p = paragraphs[i];
      const text = p.text.trim();

      // Detectar títulos principales (ej. "1. ANTECEDENTES", "JUSTIFICACIÓN", etc.)
      const sectionMatch = text.match(/^(\d+)?[\.\-\s]*([A-ZÁÉÍÓÚÑ\s\/\_]{4,60})$/);
      const isHeaderStyle = sectionMatch && text.length < 80 && !text.includes("......");

      if (isHeaderStyle) {
        const titulo = sectionMatch[2].trim();
        seccionesDetectadas.push(titulo);

        // Buscar contenido en párrafos posteriores
        let contenido = "";
        for (let j = i + 1; j < Math.min(i + 4, paragraphs.length); j++) {
          if (paragraphs[j].text.trim() && !paragraphs[j].text.match(/^(\d+)?[\.\-\s]*([A-ZÁÉÍÓÚÑ\s\/\_]{4,60})$/)) {
            contenido = paragraphs[j].text.trim();
            break;
          }
        }

        clausulas.push({
          id: `clausula-${seccionNum}`,
          numero: seccionNum,
          titulo: titulo,
          contenido: contenido || "Texto oficial de la sección...",
          activo: true,
        });

        indiceSecciones.push({
          id: `ind-${seccionNum}`,
          numero: seccionNum,
          titulo: titulo,
          descripcion_ia: `Redacción oficial según requerimiento institucional para ${titulo}`,
        });

        seccionNum++;
      }

      // Detectar campos rellenables
      if (p.placeholders && p.placeholders.length > 0) {
        p.placeholders.forEach((pl) => {
          if (!camposDetectados.includes(pl)) camposDetectados.push(pl);
        });
      }
    }

    // 2. Detectar Firmantes en tablas o texto
    tables.forEach((tbl) => {
      const allTexts = [...tbl.headers, ...(tbl.sample_first_row || [])].join(" ").toUpperCase();
      if (allTexts.includes("ELABORADO") || allTexts.includes("REVISADO") || allTexts.includes("APROBADO")) {
        firmantes.push(
          {
            id: "firm-1",
            rol: "ELABORADO",
            etiqueta: "ELABORADO POR:",
            nombreDefault: "Ing. Responsable de Adquisición",
            cargoDefault: "SUPERVISOR TÉCNICO",
          },
          {
            id: "firm-2",
            rol: "REVISADO",
            etiqueta: "REVISADO POR:",
            nombreDefault: "Ing. Jefatura de Mantenimiento",
            cargoDefault: "JEFE DE DEPARTAMENTO TÉCNICO",
          },
          {
            id: "firm-3",
            rol: "APROBADO",
            etiqueta: "APROBADO POR:",
            nombreDefault: "Lic. Raul Alberto Torrico Gomez",
            cargoDefault: "GERENTE GENERAL",
          }
        );
      }
    });

    if (firmantes.length === 0) {
      firmantes.push({
        id: "firm-1",
        rol: "ELABORADO",
        etiqueta: "RESPONSABLE DEL PROCESO:",
        nombreDefault: "Personal Designado ENDE DEORURO",
        cargoDefault: "UNIDAD SOLICITANTE",
      });
    }

    // 3. Ensamblar la Plantilla de Código Nativa
    const plantilla: Plantilla = {
      id: `tpl-custom-carpeta-${fkCarpeta}-${Date.now()}`,
      fk_carpeta: fkCarpeta,
      nombre: nombrePlantilla || `Plantilla Maquetada Carpeta ${fkCarpeta}`,
      nombre_archivo: `${nombrePlantilla.replace(/\s+/g, "_")}.docx`,
      tipo_doc: "PLANTILLA_MAQUETADA_CODIGO",
      version: "2.0 (Código Compilado)",
      descripcion: `Plantilla transpilada automáticamente a código nativo con ${seccionesDetectadas.length} secciones y ${tables.length} tablas oficiales.`,
      fecha_creacion: new Date().toISOString(),
      clausulas_default: clausulas.length > 0 ? clausulas : undefined,
      indice_secciones: indiceSecciones.length > 0 ? indiceSecciones : undefined,
      firmantes_default: firmantes,
      datos_completos: {
        origen: "DOCX_TRANSPILER",
        fecha_compilacion: new Date().toISOString(),
        clausulas,
        indiceSecciones,
        firmantes,
        tablasEstructura: tables,
        totalParrafos: paragraphs.length,
        totalTablas: tables.length,
        camposDetectados,
      },
    };

    return {
      plantilla,
      totalParrafos: paragraphs.length,
      totalTablas: tables.length,
      seccionesDetectadas,
      firmantesDetectados: firmantes.map((f) => f.etiqueta),
      camposDetectados,
    };
  }
}
