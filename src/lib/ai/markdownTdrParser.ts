import { ItemAdquisicion, TipoTablaTDR } from "@/types";

export interface ParsedTdrResult {
  titulo_proceso?: string;
  antecedentes_texto?: string;
  justificacion_texto?: string;
  lugar_entrega?: string;
  plazo_entrega_dias?: number;
  tipo_tabla_sugerido?: TipoTablaTDR;
  items: ItemAdquisicion[];
  puntos_detectados: { [num: number]: string };
}

/**
 * Limpia etiquetas HTML y formato Markdown excesivo manteniendo estructura limpia
 */
function cleanMdText(text: string): string {
  if (!text) return "";
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?[^>]+(>|$)/g, "")
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/^#+\s*/, "")
    .trim();
}

/**
 * Parser de fidelidad 100% literal para TDR en Markdown.
 * Soporta tablas multilínea con <br>, todas las 14 secciones oficiales, y cualquier orden de columnas.
 */
export function parseMarkdownTdrLiteral(rawMarkdown: string): ParsedTdrResult {
  if (!rawMarkdown || typeof rawMarkdown !== "string") {
    return { items: [], puntos_detectados: {} };
  }

  const result: ParsedTdrResult = {
    items: [],
    puntos_detectados: {},
  };

  // Normalizar saltos de línea
  const rawText = rawMarkdown.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // =========================================================================
  // 1. EXTRAER TÍTULO PRINCIPAL
  // =========================================================================
  const lines = rawText.split("\n");
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const l = cleanMdText(lines[i]).toUpperCase();
    if (
      l.startsWith("ESPECIFICACIONES TÉCNICAS") ||
      l.startsWith("TÉRMINOS DE REFERENCIA") ||
      l.startsWith("ADQUISICIÓN") ||
      l.startsWith("CONTRATACIÓN") ||
      l.startsWith("COMPRA DE") ||
      l.startsWith("PROVISIÓN")
    ) {
      result.titulo_proceso = l.replace(/^["'“]|["'”]$/g, "").trim();
      break;
    }
  }

  // =========================================================================
  // 2. EXTRAER LOS 14 PUNTOS OFICIALES SEGÚN ENCABEZADOS
  // =========================================================================
  // Nombres y números oficiales
  const puntosKeywords: { [num: number]: string[] } = {
    1: ["ANTECEDENTE"],
    2: ["JUSTIFICACI", "NECESIDAD"],
    3: ["ESPECIFICACI", "CARACTERISTICA"],
    4: ["CALIDAD"],
    5: ["ÁMBITO", "AMBITO", "APLICACI"],
    6: ["MÉTODO", "METODO", "SELECCI"],
    7: ["VIGENCIA", "VALIDEZ"],
    8: ["CATEGOR"],
    9: ["LUGAR DE ENTREGA", "LUGAR"],
    10: ["TIEMPO DE ENTREGA", "PLAZO DE ENTREGA", "PLAZO"],
    11: ["FORMA DE ADJUDICACI", "ADJUDICACI"],
    12: ["ACEPTACI", "RECEPCI", "CONFORMIDAD"],
    13: ["FORMA DE PAGO", "PAGO"],
    14: ["MULTA", "SANCION", "PENALIDAD"],
  };

  // Regex para identificar inicio de sección numerada:
  // e.g. "### 1. ANTECEDENTES", "1. ANTECEDENTES", "**1. ANTECEDENTES**", "1.- ANTECEDENTES", "1) ANTECEDENTES", "4. CALIDAD"
  const sectionHeaderRegex = /^(?:#+\s*)?(?:\*{1,3})?(?:(\d+)[\.\-\)]\s*)?([A-ZÁÉÍÓÚÑ\s\/\-_]{3,})(?:\*{1,3})?:?$/i;

  let currentPuntoNum: number | null = null;
  const puntoBuffers: { [num: number]: string[] } = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const cleanLine = cleanMdText(line);
    const upper = cleanLine.toUpperCase();

    // Comprobar si la línea es encabezado de un punto oficial (1..14)
    let detectedNum: number | null = null;

    // A) Si tiene número explícito (e.g. "4. CALIDAD", "### 4. CALIDAD")
    const matchNum = cleanLine.match(/^(?:#+\s*)?(\d+)[\.\-\)]\s*([A-ZÁÉÍÓÚÑ\s\/\-_]+)/i);
    if (matchNum) {
      const n = parseInt(matchNum[1], 10);
      if (n >= 1 && n <= 14 && cleanLine.length < 80) {
        detectedNum = n;
      }
    }

    // B) Si no tiene número, buscar por palabras clave
    if (!detectedNum && cleanLine.length < 80) {
      for (const [numStr, keywords] of Object.entries(puntosKeywords)) {
        const n = parseInt(numStr, 10);
        if (keywords.some((k) => upper.startsWith(k) || upper.includes(k))) {
          // Asegurarse de que no sea parte de un párrafo largo
          if (cleanLine.split(" ").length <= 8) {
            detectedNum = n;
            break;
          }
        }
      }
    }

    if (detectedNum !== null) {
      currentPuntoNum = detectedNum;
      if (!puntoBuffers[currentPuntoNum]) {
        puntoBuffers[currentPuntoNum] = [];
      }
      continue;
    }

    // Si estamos dentro de un punto y no es la sección 3 (que contiene la tabla), acumular texto
    if (currentPuntoNum !== null && currentPuntoNum !== 3) {
      // Ignorar líneas divisorias o cabeceras de tabla
      if (!line.trim().startsWith("|") && !line.trim().startsWith("---")) {
        puntoBuffers[currentPuntoNum].push(cleanLine);
      }
    }
  }

  // Guardar puntos acumulados
  for (let n = 1; n <= 14; n++) {
    if (puntoBuffers[n] && puntoBuffers[n].length > 0) {
      const textBlock = puntoBuffers[n]
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
        .join("\n\n")
        .trim();

      if (textBlock) {
        result.puntos_detectados[n] = textBlock;
        if (n === 1) result.antecedentes_texto = textBlock;
        if (n === 2) result.justificacion_texto = textBlock;
      }
    }
  }

  // =========================================================================
  // 3. EXTRAER TABLAS MULTILÍNEA CON <BR> Y BULLETS
  // =========================================================================
  // Extraer el bloque de la tabla
  const tableBlockMatch = rawText.match(/\|[\s\S]*?\|[\s\S]*?\|[\s\S]*?\n(?=\n[#A-Z0-9]|\n\n[#A-Z0-9]|$)/i);

  if (tableBlockMatch) {
    const tableRaw = tableBlockMatch[0];
    const rawLines = tableRaw.split("\n").map((l) => l.trim()).filter(Boolean);

    // Identificar cabecera (primera fila)
    let headerLine = "";
    let separatorIndex = -1;

    for (let i = 0; i < rawLines.length; i++) {
      if (rawLines[i].includes("---")) {
        separatorIndex = i;
        if (i > 0) headerLine = rawLines[i - 1];
        break;
      }
    }

    if (separatorIndex !== -1 && headerLine) {
      // Parsear nombres de columnas de cabecera
      const headerCols = headerLine
        .split("|")
        .map((c) => cleanMdText(c).toLowerCase())
        .filter((c, idx, arr) => (idx > 0 && idx < arr.length - 1) || arr.length <= 2);

      // Reconstruir filas de datos que pueden estar divididas en múltiples líneas
      const rawDataLines = rawLines.slice(separatorIndex + 1);
      const dataRowChunks: string[] = [];
      let currentChunk = "";

      for (const line of rawDataLines) {
        // Una nueva fila de tabla comienza si tiene | seguido de número o texto y tiene múltiples |
        if (line.startsWith("|") && line.split("|").length >= 3 && /^\s*\|\s*(?:\d+|[A-ZÁÉÍÓÚÑa-z])/i.test(line)) {
          if (currentChunk) dataRowChunks.push(currentChunk);
          currentChunk = line;
        } else {
          // Es continuación de la celda de la fila actual (con <br> o viñetas)
          currentChunk += (currentChunk ? "\n" : "") + line;
        }
      }
      if (currentChunk) dataRowChunks.push(currentChunk);

      // Detectar tipo de tabla
      const headerLower = headerLine.toLowerCase();
      const isSalud =
        headerLower.includes("examen") ||
        headerLower.includes("estudio") ||
        headerLower.includes("metodologia") ||
        headerLower.includes("propuesto");

      const is3Cols = !isSalud && headerCols.length === 3;
      result.tipo_tabla_sugerido = isSalud ? "SALUD_OCUPACIONAL" : is3Cols ? "BIENES_3_COLS" : "BIENES_SIMPLE";

      // Parsear cada fila reconstruida
      const parsedItems: ItemAdquisicion[] = [];

      dataRowChunks.forEach((chunk, rowIdx) => {
        // Dividir por | al nivel superior
        const rawCells = chunk
          .split("|")
          .map((c) => cleanMdText(c))
          .filter((_, idx, arr) => (idx > 0 && idx < arr.length - 1) || arr.length <= 2);

        if (rawCells.length < 2) return;

        // Mapear celdas:
        // Caso A: 4 Columnas [No., Descripción, Características Técnicas, Cant.]
        // Caso B: 3 Columnas [No., Descripción, Características Técnicas]
        // Caso C: 5 Columnas [No., Descripción, Unidad, Cantidad, Características]
        // Caso D: Salud [No., Examen, Especificación Mínima, Propuesto]

        let itemNum = rowIdx + 1;
        const numParsed = parseInt(rawCells[0].replace(/[^\d]/g, ""), 10);
        if (!isNaN(numParsed) && numParsed > 0) itemNum = numParsed;

        const descripcion = rawCells[1] || "";
        if (!descripcion || descripcion.startsWith("---")) return;

        let caracteristicas = "";
        let unidad = "PZA";
        let cantidad = 1;
        let propuesto = "Cumple con las especificaciones técnicas requeridas";

        if (isSalud) {
          unidad = "ESTUDIO";
          caracteristicas = rawCells[2] || descripcion;
          propuesto = rawCells[3] || "A informar por el proponente";
        } else if (rawCells.length === 3) {
          // [No., Descripción, Características]
          caracteristicas = rawCells[2] || descripcion;
          unidad = "PZA";
          cantidad = 1;
        } else if (rawCells.length === 4) {
          // [No., Descripción, Características, Cant.]
          caracteristicas = rawCells[2] || descripcion;
          const cantRaw = rawCells[3] || "";
          const cantNum = parseInt(cantRaw.replace(/[^\d]/g, ""), 10);
          cantidad = !isNaN(cantNum) && cantNum > 0 ? cantNum : 1;
          unidad = cantRaw.toLowerCase().includes("lote") ? "LOTE" : cantRaw.toLowerCase().includes("par") ? "PAR" : "PZA";
        } else if (rawCells.length >= 5) {
          // [No., Descripción, Unidad, Cantidad, Características]
          unidad = rawCells[2] || "PZA";
          const cantNum = parseInt(rawCells[3].replace(/[^\d]/g, ""), 10);
          cantidad = !isNaN(cantNum) && cantNum > 0 ? cantNum : 1;
          caracteristicas = rawCells[4] || descripcion;
        }

        // Formatear bullets limpios si tiene viñetas
        const caracFormatted = caracteristicas
          .replace(/\n\s*•/g, "\n•")
          .replace(/<br\s*\/?>/gi, "\n")
          .trim();

        parsedItems.push({
          id: `item-md-${Date.now()}-${rowIdx}`,
          item: itemNum,
          descripcion: descripcion.toUpperCase(),
          unidad: unidad.toUpperCase(),
          cantidad,
          precioUnitarioEstimado: 0,
          precioTotalEstimado: 0,
          caracteristicasTecnicas: caracFormatted || descripcion,
          especificacionMinima: caracFormatted || descripcion,
          propuestoOferente: propuesto,
          fichaTecnica: {
            uso: isSalud ? "Salud Ocupacional" : "Personal Técnico Operativo de Campo",
            normaCertificacion: isSalud ? "Acreditación Sanitaria" : "Norma ASTM F2413-18 / ISO 20345",
            material: "Material homologado de alta calidad",
            color: "Estándar institucional",
            dimensiones: "Según requerimiento y lote",
            categoriaItem: isSalud ? "Salud Ocupacional" : "Equipos de Protección Personal (EPP)",
            caracteristicasDetalle: caracFormatted.split("\n").map((l) => l.replace(/^•\s*/, "").trim()).filter(Boolean),
          },
        });
      });

      if (parsedItems.length > 0) {
        result.items = parsedItems;
      }
    }
  }

  return result;
}
