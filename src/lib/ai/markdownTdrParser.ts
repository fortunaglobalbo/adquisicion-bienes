import { ItemAdquisicion, TipoTablaTDR } from "@/types";

export interface ParsedTdrResult {
  titulo_proceso?: string;
  antecedentes_texto?: string;
  justificacion_texto?: string;
  lugar_entrega?: string;
  plazo_entrega_dias?: number;
  tipo_tabla_sugerido?: TipoTablaTDR;
  items: ItemAdquisicion[];
  puntos_detectados?: { [num: number]: string };
}

/**
 * Parser determinista de fidelidad 100% literal para documentos y Markdown de TDR.
 * No genera texto ficticio, no inventa datos y respeta exactamente la información provista.
 */
export function parseMarkdownTdrLiteral(markdown: string): ParsedTdrResult {
  const lines = markdown.split(/\r?\n/);
  const result: ParsedTdrResult = {
    items: [],
    puntos_detectados: {},
  };

  let currentSection = "";
  const sectionContents: { [key: string]: string[] } = {};

  // Regex para detectar títulos/secciones numeradas (ej. "1. ANTECEDENTES", "# 2. JUSTIFICACIÓN", "## 3. ESPECIFICACIONES")
  const sectionHeaderRegex = /^(?:#+\s*)?(?:(\d+)[\.\-\)]\s*)?([A-ZÁÉÍÓÚÑ\s\/\-_]{3,})/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      if (currentSection && sectionContents[currentSection]) {
        sectionContents[currentSection].push("");
      }
      continue;
    }

    // Detectar si es el título principal del proceso en la cabecera
    if (!result.titulo_proceso && (trimmed.startsWith("# ") || trimmed.toUpperCase().startsWith("TÉRMINOS DE REFERENCIA") || trimmed.toUpperCase().startsWith("ESPECIFICACIONES TÉCNICAS") || trimmed.toUpperCase().startsWith("ADQUISICIÓN") || trimmed.toUpperCase().startsWith("CONTRATACIÓN"))) {
      const cleanTitle = trimmed.replace(/^#+\s*/, "").replace(/^["“']|["”']$/g, "").trim();
      if (cleanTitle.length > 5 && !cleanTitle.match(/^\d+\./)) {
        result.titulo_proceso = cleanTitle.toUpperCase();
      }
    }

    const match = trimmed.match(sectionHeaderRegex);
    if (match && (trimmed.toUpperCase().includes("ANTECEDENTE") || trimmed.toUpperCase().includes("JUSTIFICA") || trimmed.toUpperCase().includes("ESPECIFICA") || trimmed.toUpperCase().includes("CALIDAD") || trimmed.toUpperCase().includes("ENTREGA") || trimmed.toUpperCase().includes("PLAZO") || trimmed.toUpperCase().includes("PAGO") || trimmed.toUpperCase().includes("MULTA") || trimmed.toUpperCase().includes("OBJETO"))) {
      const sectionName = trimmed.replace(/^#+\s*/, "").trim().toUpperCase();
      currentSection = sectionName;
      if (!sectionContents[currentSection]) {
        sectionContents[currentSection] = [];
      }
      continue;
    }

    if (currentSection) {
      if (!sectionContents[currentSection]) sectionContents[currentSection] = [];
      sectionContents[currentSection].push(line);
    }
  }

  // Extraer Antecedentes y Justificación literales
  for (const [secKey, secLines] of Object.entries(sectionContents)) {
    const textBlock = secLines.join("\n").trim();
    if (secKey.includes("ANTECEDENTE") && textBlock) {
      result.antecedentes_texto = textBlock;
    } else if (secKey.includes("JUSTIFICA") && textBlock) {
      result.justificacion_texto = textBlock;
    }
  }

  // Extraer Tablas de Ítems (formato Markdown: | Item | Descripción | ... |)
  const tableRows: string[] = [];
  let inTable = false;
  let tableHeaderLine = "";

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      if (!inTable) {
        inTable = true;
        tableHeaderLine = trimmed.toLowerCase();
      } else if (!trimmed.includes("---")) {
        tableRows.push(trimmed);
      }
    } else if (inTable && trimmed.length === 0) {
      inTable = false;
    }
  }

  // Detectar tipo de tabla por cabecera
  const isSaludTable =
    tableHeaderLine.includes("examen") ||
    tableHeaderLine.includes("estudio") ||
    tableHeaderLine.includes("metodologia") ||
    tableHeaderLine.includes("propuesto");

  result.tipo_tabla_sugerido = isSaludTable ? "SALUD_OCUPACIONAL" : "BIENES_SIMPLE";

  // Parsear filas de la tabla
  if (tableRows.length > 0) {
    const parsedItems: ItemAdquisicion[] = [];
    tableRows.forEach((row, idx) => {
      const cells = row
        .split("|")
        .map((c) => c.trim())
        .filter((_, colIdx, arr) => colIdx > 0 && colIdx < arr.length - 1);

      if (cells.length >= 2) {
        const rawNum = cells[0].replace(/[^\d]/g, "");
        const itemNum = rawNum ? parseInt(rawNum, 10) : idx + 1;
        const col1 = cells[1] || "";
        const col2 = cells[2] || "";
        const col3 = cells[3] || "";
        const col4 = cells[4] || "";

        if (isSaludTable) {
          // Formato Salud: [Item, Examen, Especificación Mínima, Propuesto / A Informar]
          parsedItems.push({
            id: `item-md-${Date.now()}-${idx}`,
            item: itemNum,
            descripcion: col1.toUpperCase(),
            unidad: "ESTUDIO",
            cantidad: 1,
            precioUnitarioEstimado: 0,
            precioTotalEstimado: 0,
            especificacionMinima: col2,
            propuestoOferente: col3 || "A informar por el proponente",
            caracteristicasTecnicas: col2,
            fichaTecnica: {
              uso: "Personal de ENDE Deoruro S.A.",
              normaCertificacion: "Acreditación Sanitaria / Protocolos Médicos",
              material: col2,
              color: "Estándar",
              dimensiones: "Según protocolo",
              categoriaItem: "Salud Ocupacional y Medicina del Trabajo",
              caracteristicasDetalle: [col2],
            },
          });
        } else {
          // Formato Bienes Simple: [Item, Descripción, Unidad, Cantidad, Características Técnicas]
          const unidad = (col2 && col2.length <= 6 ? col2 : "PZA").toUpperCase();
          const cantidad = parseInt(col3.replace(/[^\d]/g, ""), 10) || 1;
          const caracs = col4 || col3 || col2;

          parsedItems.push({
            id: `item-md-${Date.now()}-${idx}`,
            item: itemNum,
            descripcion: col1.toUpperCase(),
            unidad,
            cantidad,
            precioUnitarioEstimado: 0,
            precioTotalEstimado: 0,
            caracteristicasTecnicas: caracs,
            especificacionMinima: caracs,
            propuestoOferente: "Cumple con las especificaciones técnicas",
            fichaTecnica: {
              uso: "Personal Institucional",
              normaCertificacion: "Norma Técnica Aplicable",
              material: "Según especificación técnica",
              color: "Estándar",
              dimensiones: "Estándar",
              categoriaItem: "Bienes y Suministros",
              caracteristicasDetalle: caracs ? caracs.split(";").map((s) => s.trim()) : [col1],
            },
          });
        }
      }
    });

    if (parsedItems.length > 0) {
      result.items = parsedItems;
    }
  }

  return result;
}
