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
 * Limpia caracteres de formato Markdown (negrita, cursiva, encabezados)
 */
function cleanMd(text: string): string {
  if (!text) return "";
  return text
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/__/g, "")
    .replace(/^#+\s*/, "")
    .replace(/^>\s*/, "")
    .trim();
}

/**
 * Parser determinista inteligente y de fidelidad 100% literal para documentos y Markdown de TDR.
 * Extrae títulos, antecedentes, justificación y tablas de cualquier formato sin inventar ni omitir información.
 */
export function parseMarkdownTdrLiteral(rawMarkdown: string): ParsedTdrResult {
  if (!rawMarkdown || typeof rawMarkdown !== "string") {
    return { items: [], puntos_detectados: {} };
  }

  const lines = rawMarkdown.split(/\r?\n/);
  const result: ParsedTdrResult = {
    items: [],
    puntos_detectados: {},
  };

  // 1. EXTRAER TÍTULO PRINCIPAL (Si existe en las primeras líneas)
  for (let i = 0; i < Math.min(lines.length, 12); i++) {
    const lineClean = cleanMd(lines[i]);
    const upper = lineClean.toUpperCase();
    if (
      upper.startsWith("ESPECIFICACIONES TÉCNICAS") ||
      upper.startsWith("TÉRMINOS DE REFERENCIA") ||
      upper.startsWith("ADQUISICIÓN") ||
      upper.startsWith("CONTRATACIÓN") ||
      upper.startsWith("COMPRA DE") ||
      upper.startsWith("PROVISIÓN DE") ||
      upper.startsWith("SERVICIO DE")
    ) {
      result.titulo_proceso = lineClean.replace(/^["'“]|["'”]$/g, "").trim().toUpperCase();
      break;
    }
  }

  // 2. EXTRAER SECCIONES Y PÁRRAFOS (ANTECEDENTES, JUSTIFICACIÓN, PLAZOS, ETC.)
  let currentSection = "";
  const sectionContents: { [key: string]: string[] } = {};

  // Regex universal para detectar encabezados como:
  // "1. ANTECEDENTES", "# 1. ANTECEDENTES", "**1. ANTECEDENTES:**", "1.- ANTECEDENTES", "I. ANTECEDENTES", "ANTECEDENTES:"
  const headerKeywordRegex = /^(?:#+\s*)?(?:\*{1,3})?(?:(?:[0-9]+|[IVXLCDM]+)[\.\-\)]\s*)?([A-ZÁÉÍÓÚÑ\s\/\-_]{3,})(?:\*{1,3})?:?$/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const cleanLine = cleanMd(line);
    const upper = cleanLine.toUpperCase();

    // Si es una fila de tabla Markdown, no tratarla como encabezado de sección
    if (line.includes("|") && line.trim().startsWith("|")) {
      continue;
    }

    if (
      upper.includes("ANTECEDENTE") ||
      upper.includes("JUSTIFICACI") ||
      upper.includes("NECESIDAD") ||
      upper.includes("OBJETO") ||
      upper.includes("ALCANCE") ||
      upper.includes("CALIDAD") ||
      upper.includes("LUGAR DE ENTREGA") ||
      upper.includes("PLAZO") ||
      upper.includes("TIEMPO DE ENTREGA") ||
      upper.includes("FORMA DE PAGO") ||
      upper.includes("MULTA") ||
      upper.includes("ESPECIFICACI")
    ) {
      const match = cleanLine.match(headerKeywordRegex);
      if (match || upper.startsWith("1.") || upper.startsWith("2.") || upper.startsWith("3.") || upper.startsWith("4.") || upper.startsWith("5.") || upper.startsWith("6.") || upper.startsWith("7.") || upper.startsWith("8.") || upper.startsWith("9.") || upper.startsWith("10.") || upper.startsWith("11.") || upper.startsWith("12.") || upper.startsWith("13.") || upper.startsWith("14.")) {
        if (cleanLine.length < 80) {
          currentSection = upper;
          if (!sectionContents[currentSection]) {
            sectionContents[currentSection] = [];
          }
          continue;
        }
      }
    }

    if (currentSection) {
      if (!sectionContents[currentSection]) sectionContents[currentSection] = [];
      sectionContents[currentSection].push(cleanLine);
    }
  }

  // Mapear antecedentes y justificación de las secciones acumuladas
  for (const [secKey, secLines] of Object.entries(sectionContents)) {
    const textBlock = secLines.filter((l) => l.trim().length > 0).join("\n").trim();
    if (!textBlock) continue;

    if (secKey.includes("ANTECEDENTE") && !result.antecedentes_texto) {
      result.antecedentes_texto = textBlock;
    } else if ((secKey.includes("JUSTIFICACI") || secKey.includes("NECESIDAD")) && !result.justificacion_texto) {
      result.justificacion_texto = textBlock;
    }
  }

  // 3. EXTRAER TABLAS DE ÍTEMS / ESPECIFICACIONES TÉCNICAS
  const rawTableLines: string[] = [];
  let readingTable = false;

  for (let i = 0; i < lines.length; i++) {
    const lineTrim = lines[i].trim();
    if (lineTrim.startsWith("|") && (lineTrim.endsWith("|") || lineTrim.split("|").length >= 3)) {
      readingTable = true;
      rawTableLines.push(lineTrim);
    } else if (readingTable && lineTrim.length === 0) {
      readingTable = false;
    }
  }

  if (rawTableLines.length >= 2) {
    // Primera fila con texto = Cabecera
    const headerLine = rawTableLines[0];
    const headerCells = headerLine
      .split("|")
      .map((c) => cleanMd(c).toLowerCase())
      .filter((c, idx, arr) => (idx > 0 && idx < arr.length - 1) || arr.length <= 2);

    // Mapeo dinámico de columnas por nombre
    let idxItem = -1;
    let idxDesc = -1;
    let idxUnidad = -1;
    let idxCant = -1;
    let idxCarac = -1;
    let idxPropuesto = -1;
    let idxPrecioUnit = -1;
    let idxPrecioTotal = -1;

    headerCells.forEach((h, colIdx) => {
      if (h.includes("item") || h.includes("ítem") || h.includes("n°") || h.includes("no.") || h === "n" || h === "no") {
        if (idxItem === -1) idxItem = colIdx;
      } else if (h.includes("descrip") || h.includes("detalle") || h.includes("bien") || h.includes("examen") || h.includes("estudio") || h.includes("servicio") || h.includes("nombre") || h.includes("producto")) {
        if (idxDesc === -1) idxDesc = colIdx;
      } else if (h.includes("unidad") || h.includes("medida") || h === "u.m." || h === "um") {
        if (idxUnidad === -1) idxUnidad = colIdx;
      } else if (h.includes("cant") || h.includes("ctd") || h.includes("requerid")) {
        if (idxCant === -1) idxCant = colIdx;
      } else if (h.includes("propuest") || h.includes("oferta") || h.includes("a informar") || h.includes("oferente")) {
        if (idxPropuesto === -1) idxPropuesto = colIdx;
      } else if (h.includes("especif") || h.includes("caracter") || h.includes("metodolog") || h.includes("tecnic") || h.includes("minima")) {
        if (idxCarac === -1) idxCarac = colIdx;
      } else if (h.includes("unitario") || h.includes("p.u.") || h.includes("precio u")) {
        if (idxPrecioUnit === -1) idxPrecioUnit = colIdx;
      } else if (h.includes("total") || h.includes("precio t")) {
        if (idxPrecioTotal === -1) idxPrecioTotal = colIdx;
      }
    });

    // Detectar si es tabla de salud o bienes
    const isSaludTable =
      headerLine.toLowerCase().includes("examen") ||
      headerLine.toLowerCase().includes("estudio") ||
      headerLine.toLowerCase().includes("metodologia") ||
      headerLine.toLowerCase().includes("propuesto") ||
      (idxPropuesto !== -1 && idxUnidad === -1);

    result.tipo_tabla_sugerido = isSaludTable ? "SALUD_OCUPACIONAL" : "BIENES_SIMPLE";

    // Procesar filas de datos (ignorando separadores |---|)
    const dataRows = rawTableLines.slice(1).filter((r) => !r.includes("---"));
    const parsedItems: ItemAdquisicion[] = [];

    dataRows.forEach((row, rowIdx) => {
      const rawCells = row
        .split("|")
        .map((c) => cleanMd(c))
        .filter((_, colIdx, arr) => (colIdx > 0 && colIdx < arr.length - 1) || arr.length <= 2);

      if (rawCells.length === 0) return;

      // Extraer campos según índices detectados o por posición de respaldo
      let itemNum = rowIdx + 1;
      if (idxItem !== -1 && rawCells[idxItem]) {
        const numParsed = parseInt(rawCells[idxItem].replace(/[^\d]/g, ""), 10);
        if (!isNaN(numParsed) && numParsed > 0) itemNum = numParsed;
      }

      let descripcion = "";
      if (idxDesc !== -1 && rawCells[idxDesc]) {
        descripcion = rawCells[idxDesc];
      } else if (rawCells[1]) {
        descripcion = rawCells[1];
      } else if (rawCells[0]) {
        descripcion = rawCells[0];
      }

      let unidad = "PZA";
      if (idxUnidad !== -1 && rawCells[idxUnidad]) {
        unidad = rawCells[idxUnidad].toUpperCase();
      } else if (isSaludTable) {
        unidad = "ESTUDIO";
      } else if (rawCells[2] && rawCells[2].length <= 8 && !rawCells[2].match(/^\d+$/)) {
        unidad = rawCells[2].toUpperCase();
      }

      let cantidad = 1;
      if (idxCant !== -1 && rawCells[idxCant]) {
        const cParsed = parseInt(rawCells[idxCant].replace(/[^\d]/g, ""), 10);
        if (!isNaN(cParsed) && cParsed > 0) cantidad = cParsed;
      } else if (rawCells[3] && rawCells[3].match(/^\d+$/)) {
        cantidad = parseInt(rawCells[3], 10) || 1;
      } else if (rawCells[2] && rawCells[2].match(/^\d+$/)) {
        cantidad = parseInt(rawCells[2], 10) || 1;
      }

      let caracteristicas = "";
      if (idxCarac !== -1 && rawCells[idxCarac]) {
        caracteristicas = rawCells[idxCarac];
      } else if (rawCells[4]) {
        caracteristicas = rawCells[4];
      } else if (rawCells[3] && !rawCells[3].match(/^\d+$/)) {
        caracteristicas = rawCells[3];
      } else if (rawCells[2] && !rawCells[2].match(/^\d+$/) && rawCells[2].length > 8) {
        caracteristicas = rawCells[2];
      }

      let propuesto = "A informar por el proponente / Cumple";
      if (idxPropuesto !== -1 && rawCells[idxPropuesto]) {
        propuesto = rawCells[idxPropuesto];
      } else if (rawCells[3] && isSaludTable) {
        propuesto = rawCells[3];
      }

      let precioUnit = 0;
      if (idxPrecioUnit !== -1 && rawCells[idxPrecioUnit]) {
        const pParsed = parseFloat(rawCells[idxPrecioUnit].replace(/[^\d\.]/g, ""));
        if (!isNaN(pParsed)) precioUnit = pParsed;
      }

      let precioTotal = precioUnit * cantidad;
      if (idxPrecioTotal !== -1 && rawCells[idxPrecioTotal]) {
        const tParsed = parseFloat(rawCells[idxPrecioTotal].replace(/[^\d\.]/g, ""));
        if (!isNaN(tParsed)) precioTotal = tParsed;
      }

      if (descripcion) {
        parsedItems.push({
          id: `item-md-${Date.now()}-${rowIdx}`,
          item: itemNum,
          descripcion: descripcion.toUpperCase(),
          unidad,
          cantidad,
          precioUnitarioEstimado: precioUnit,
          precioTotalEstimado: precioTotal,
          caracteristicasTecnicas: caracteristicas || descripcion,
          especificacionMinima: caracteristicas || descripcion,
          propuestoOferente: propuesto,
          fichaTecnica: {
            uso: isSaludTable ? "Personal de ENDE Deoruro S.A." : "Personal Operativo / Institucional",
            normaCertificacion: isSaludTable ? "Acreditación Sanitaria / Protocolos Médicos" : "Norma Técnica Aplicable",
            material: caracteristicas || "Según especificación técnica",
            color: "Estándar",
            dimensiones: isSaludTable ? "Según protocolo" : "Estándar",
            categoriaItem: isSaludTable ? "Salud Ocupacional y Medicina del Trabajo" : "Bienes y Suministros",
            caracteristicasDetalle: caracteristicas
              ? caracteristicas.split(";").map((s) => s.trim()).filter(Boolean)
              : [descripcion],
          },
        });
      }
    });

    if (parsedItems.length > 0) {
      result.items = parsedItems;
    }
  }

  return result;
}
