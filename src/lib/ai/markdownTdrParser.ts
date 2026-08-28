import { ItemAdquisicion, TipoTablaTDR } from "@/types";

export interface ParsedTdrResult {
  titulo_proceso?: string;
  antecedentes_texto?: string;
  justificacion_texto?: string;
  calidad_texto?: string;
  ambito_aplicacion?: string;
  metodo_seleccion_texto?: string;
  vigencia_propuesta_texto?: string;
  categoria_texto?: string;
  tiempo_entrega_texto?: string;
  forma_adjudicacion?: string;
  aceptacion_lote?: string;
  forma_pago_texto?: string;
  multas_texto?: string;
  puntos_14_texto?: { [num: number]: string };
  seccion3_introduccion_texto?: string;
  columnas_tabla_tdr?: string[];
  elaborado_por?: string;
  revisado_por?: string;
  aprobado_por?: string;
  codigo_documento?: string;
  lugar_entrega?: string;
  plazo_entrega_dias?: number;
  tipo_tabla_sugerido?: TipoTablaTDR;
  items: ItemAdquisicion[];
  puntos_detectados: { [num: number]: string };
}

/**
 * Limpia tags HTML y asteriscos Markdown pero preserva el texto literal y saltos de párrafo
 */
export function cleanFormatting(text: string): string {
  if (!text) return "";
  return text
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/?[^>]+(>|$)/g, "")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/__/g, "")
    .replace(/_/g, "")
    .replace(/^#+\s*/, "")
    .trim();
}

/**
 * Limpia SOLO los marcadores de estructura Markdown (###, |, ---)
 * PRESERVA el contenido de párrafos LITERALMENTE, sin alterar ninguna palabra.
 */
export function cleanInstitutionalText(text: string): string {
  if (!text) return "";

  let res = text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?[^>]+(>|$)/g, ""); // solo elimina HTML

  const lines = res.split("\n");
  const cleanedLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line) {
      if (cleanedLines.length > 0 && cleanedLines[cleanedLines.length - 1] !== "") {
        cleanedLines.push("");
      }
      continue;
    }

    // Encabezados tipo "### 4.1. Perfil..." -> "4.1. Perfil..."
    if (line.startsWith("#")) {
      line = line.replace(/^#+\s*/, "").trim();
      cleanedLines.push(line);
      continue;
    }

    // Viñetas tipo "* **Texto:**" o "* *Texto:*" o "- **Texto:**" o "* Texto"
    if (/^[\*\-\•\+\❖]\s*/.test(line)) {
      let content = line.replace(/^[\*\-\•\+\❖]\s*/, "").trim();
      content = content
        .replace(/\*\*/g, "")
        .replace(/\*/g, "")
        .replace(/__/g, "")
        .replace(/_/g, "");
      cleanedLines.push(`•  ${content}`);
      continue;
    }

    // Párrafos normales: limpiar asteriscos de negrita/cursiva markdown
    line = line
      .replace(/\*\*/g, "")
      .replace(/\*/g, "")
      .replace(/__/g, "")
      .replace(/_/g, "");

    cleanedLines.push(line);
  }

  return cleanedLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Extrae el texto de una sección preservando LITERALMENTE el contenido original.
 * Solo elimina marcadores de estructura (|, ---, líneas vacías de inicio/fin),
 * pero NUNCA altera el texto de los párrafos, ni palabras, ni puntuación.
 * Esta función es para Carpeta 1 (TDR) donde se requiere copia fiel 100%.
 */
export function extractRawSectionContent(bodyLines: string[]): string {
  const meaningful = bodyLines
    .filter((l) => {
      const t = l.trim();
      if (!t) return false;
      if (/^-{3,}$/.test(t)) return false; // separadores ---
      if (/^\|\s*[-:]+\s*\|/.test(t)) return false; // separadores de tabla |---|---|
      if (t.startsWith("|")) return false; // líneas de tabla
      if (/^#+\s*(\d+\.)?\s*(ANTECEDENTES|JUSTIFICACI|ESPECIFICACI|CALIDAD|ÁMBITO|MÉTODO|VIGENCIA|CATEGORÍA|LUGAR|TIEMPO|PLAZO|FORMA|ACEPTACI|MULTA|ADJUDICACI)/i.test(t)) return false;
      return true;
    })
    .map((l) => {
      // Solo elimina el "#" de inicio de línea (encabezados Markdown estructurales)
      // Preserva TODO el contenido textual tal como está
      return l.trim().replace(/^#+\s*/, "");
    });

  return meaningful.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Normaliza tablas Markdown que puedan tener filas cortadas por <br> o saltos de línea
 */
function normalizeMarkdownTables(text: string): string {
  let clean = text.replace(/<br\s*\/?>/gi, " ");
  const lines = clean.split("\n");
  const result: string[] = [];
  let tableBuffer = "";
  let insideTable = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const l = raw.trim();

    if (l.startsWith("|")) {
      if (tableBuffer) {
        result.push(tableBuffer);
      }
      tableBuffer = l;
      insideTable = true;
    } else if (insideTable) {
      if (l.startsWith("#") || (l.startsWith("---") && !tableBuffer.includes("---"))) {
        if (tableBuffer) {
          result.push(tableBuffer);
          tableBuffer = "";
        }
        insideTable = false;
        result.push(raw);
      } else {
        if (l.length > 0) {
          tableBuffer += " " + l;
        }
        if (l.endsWith("|") && (tableBuffer.match(/\|/g) || []).length >= 4) {
          result.push(tableBuffer);
          tableBuffer = "";
          insideTable = false;
        }
      }
    } else {
      result.push(raw);
    }
  }
  if (tableBuffer) {
    result.push(tableBuffer);
  }
  return result.join("\n");
}

/**
 * Parser universal de ultra-fidelidad literal para documentos TDR, Markdown y Tablas copiadas.
 */
export function parseMarkdownTdrLiteral(rawMarkdown: string): ParsedTdrResult {
  if (!rawMarkdown || typeof rawMarkdown !== "string") {
    return { items: [], puntos_detectados: {} };
  }

  const result: ParsedTdrResult = {
    items: [],
    puntos_detectados: {},
  };

  const normalized = normalizeMarkdownTables(rawMarkdown.replace(/\r\n/g, "\n").replace(/\r/g, "\n"));
  const lines = normalized.split("\n");

  // =========================================================================
  // 1. EXTRAER TÍTULO PRINCIPAL DEL PROCESO Y METADATOS DE PORTADA
  // =========================================================================
  for (let i = 0; i < Math.min(lines.length, 35); i++) {
    const l = lines[i].trim();
    const cleanL = cleanFormatting(l).toUpperCase();

    // Objeto o Adquisición específica
    const matchObj = l.match(/\*\*(?:ADQUISICI[OÓ]N(?:\s+Y\s+CONTRATACI[OÓ]N)?|CONTRATACI[OÓ]N|OBJETO(?:\s+GENERAL)?):\*\*\s*(.+)/i);
    if (matchObj) {
      result.titulo_proceso = cleanFormatting(matchObj[1]).toUpperCase();
      break;
    }

    if (
      cleanL.startsWith("CONSULTORÍA") ||
      cleanL.startsWith("SERVICIO DE") ||
      cleanL.startsWith("ADQUISICIÓN") ||
      cleanL.startsWith("COMPRA DE")
    ) {
      result.titulo_proceso = cleanL;
      break;
    }
  }

  // Código de documento
  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    const matchCod = lines[i].match(/\*\*(?:C[OÓ]DIGO(?:\s+DE\s+DOCUMENTO)?):\*\*\s*(.+)/i);
    if (matchCod) {
      result.codigo_documento = cleanFormatting(matchCod[1]);
      break;
    }
  }

  // Firmas de portada si existen en tabla
  for (let i = 0; i < Math.min(lines.length, 40); i++) {
    if (lines[i].includes("ELABORADO POR") && lines[i].includes("APROBADO POR")) {
      for (let j = i + 1; j < Math.min(lines.length, i + 8); j++) {
        if (lines[j].includes("|") && !lines[j].includes("---")) {
          const parts = lines[j].split("|").map(p => cleanFormatting(p).trim()).filter(Boolean);
          if (parts.length >= 3) {
            result.elaborado_por = parts[0];
            result.revisado_por = parts[1];
            result.aprobado_por = parts[2];
            break;
          }
        }
      }
      break;
    }
  }

  // =========================================================================
  // 2. SEGMENTAR EL DOCUMENTO EN LAS 14 SECCIONES OFICIALES
  // =========================================================================
  const sectionKeywords: { [num: number]: string[] } = {
    1: ["ANTECEDENTES"],
    2: ["JUSTIFICACIÓN", "JUSTIFICACION", "NECESIDAD"],
    3: ["ESPECIFICACIÓN", "ESPECIFICACION", "ESPECIFICACIONES", "ITEMS", "ÍTEMS", "CUADRO TÉCNICO", "MATRIZ DE SERVICIOS"],
    4: ["CALIDAD"],
    5: ["ÁMBITO", "AMBITO", "APLICACIÓN", "APLICACION"],
    6: ["MÉTODO", "METODO", "SELECCIÓN", "SELECCION"],
    7: ["VIGENCIA", "VALIDEZ"],
    8: ["CATEGORÍA", "CATEGORIA"],
    9: ["LUGAR DE ENTREGA", "LUGAR"],
    10: ["TIEMPO DE ENTREGA", "PLAZO DE ENTREGA", "PLAZO"],
    11: ["FORMA DE ADJUDICACIÓN", "FORMA DE ADJUDICACION", "ADJUDICACIÓN"],
    12: ["ACEPTACIÓN", "ACEPTACION", "RECEPCIÓN", "CONFORMIDAD"],
    13: ["FORMA DE PAGO", "PAGO"],
    14: ["APLICACIÓN DE MULTAS", "APLICACION DE MULTAS", "MULTAS", "MULTA"],
  };

  interface SectionPos {
    num: number;
    title: string;
    lineIdx: number;
  }
  const detectedSections: SectionPos[] = [];
  let inIndice = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    const cleanL = cleanFormatting(rawLine).toUpperCase();
    if (!cleanL || cleanL.length > 100) continue;
    if (rawLine.startsWith("|")) continue;

    // Detectar si entramos al bloque de Índice para ignorar los 14 ítems listados dentro del índice
    if (cleanL.includes("ÍNDICE") || cleanL.includes("INDICE") || cleanL.includes("TABLA DE CONTENIDO")) {
      inIndice = true;
      continue;
    }

    if (inIndice) {
      if (rawLine.startsWith("---") || rawLine.startsWith("## ") || rawLine.startsWith("# ")) {
        inIndice = false;
      } else {
        continue;
      }
    }

    // Ignorar sub-secciones como "4.1.", "4.2.", etc.
    if (/^\d+\.\d+/.test(cleanL) || /^#+\s*\d+\.\d+/.test(rawLine)) {
      continue;
    }

    // Encabezado de sección tipo "## 3. ESPECIFICACIÓN TÉCNICA", "# 1. ANTECEDENTES", "3. ESPECIFICACIÓN TÉCNICA"
    const matchHeader = rawLine.match(/^(?:#+\s*)?(\d+)[\.\-\)]\s*([A-ZÁÉÍÓÚÑ\s\/\-_\(\)]+)/i);
    if (matchHeader) {
      const num = parseInt(matchHeader[1], 10);
      const titleRest = matchHeader[2].trim().toUpperCase();
      if (num >= 1 && num <= 14) {
        const isRealHeading = rawLine.startsWith("#") || sectionKeywords[num]?.some(kw => titleRest.includes(kw));
        if (isRealHeading) {
          const existingIdx = detectedSections.findIndex(s => s.num === num);
          if (existingIdx >= 0) {
            if (rawLine.startsWith("#")) {
              detectedSections[existingIdx] = { num, title: titleRest, lineIdx: i };
            }
          } else {
            detectedSections.push({ num, title: titleRest, lineIdx: i });
          }
          continue;
        }
      }
    }
  }

  detectedSections.sort((a, b) => a.lineIdx - b.lineIdx);

  const sectionTexts: { [num: number]: string } = {};

  for (let i = 0; i < detectedSections.length; i++) {
    const current = detectedSections[i];
    const nextLineIdx = i < detectedSections.length - 1 ? detectedSections[i + 1].lineIdx : lines.length;
    const bodyLines = lines.slice(current.lineIdx + 1, nextLineIdx);

    // Extraer texto con FIDELIDAD LITERAL 100% para Carpeta 1
    // extractRawSectionContent preserva el texto exactamente como el usuario lo escribió
    const rawBodyText = bodyLines
      .join("\n")
      .replace(/^---\s*$/gm, "")
      .replace(/^[\r\n]+|[\r\n]+$/g, "")
      .trim();

    // Para secciones de contenido (no la tabla de ítems), usar extracción RAW
    const cleanedSection = current.num !== 3
      ? extractRawSectionContent(bodyLines)
      : cleanInstitutionalText(rawBodyText);

    sectionTexts[current.num] = cleanedSection;
    if (current.num !== 3 && cleanedSection) {
      result.puntos_detectados[current.num] = cleanedSection;
    }
  }

  result.puntos_14_texto = { ...result.puntos_detectados };
  if (result.puntos_detectados[1]) result.antecedentes_texto = result.puntos_detectados[1];
  if (result.puntos_detectados[2]) result.justificacion_texto = result.puntos_detectados[2];
  if (result.puntos_detectados[4]) result.calidad_texto = result.puntos_detectados[4];
  if (result.puntos_detectados[5]) result.ambito_aplicacion = result.puntos_detectados[5];
  if (result.puntos_detectados[6]) result.metodo_seleccion_texto = result.puntos_detectados[6];
  if (result.puntos_detectados[7]) result.vigencia_propuesta_texto = result.puntos_detectados[7];
  if (result.puntos_detectados[8]) result.categoria_texto = result.puntos_detectados[8];
  if (result.puntos_detectados[9]) result.lugar_entrega = result.puntos_detectados[9];
  if (result.puntos_detectados[10]) result.tiempo_entrega_texto = result.puntos_detectados[10];
  if (result.puntos_detectados[11]) result.forma_adjudicacion = result.puntos_detectados[11];
  if (result.puntos_detectados[12]) result.aceptacion_lote = result.puntos_detectados[12];
  if (result.puntos_detectados[13]) result.forma_pago_texto = result.puntos_detectados[13];
  if (result.puntos_detectados[14]) result.multas_texto = result.puntos_detectados[14];

  // =========================================================================
  // 3. EXTRAER Y RECONSTRUIR LA TABLA DE ÍTEMS EN SECCIÓN 3
  // =========================================================================
  const section3Raw = sectionTexts[3] || normalized;
  const s3Lines = section3Raw.split("\n");

  const parsedItems: ItemAdquisicion[] = [];

  let tableSeparatorIdx = -1;
  let tableHeaderIdx = -1;

  for (let i = 0; i < s3Lines.length; i++) {
    const l = s3Lines[i].trim();
    if (l.startsWith("|") && l.includes("---")) {
      tableSeparatorIdx = i;
      if (i > 0 && s3Lines[i - 1].trim().startsWith("|")) {
        tableHeaderIdx = i - 1;
      }
      break;
    }
  }

  if (tableHeaderIdx >= 0) {
    const introLines = s3Lines.slice(0, tableHeaderIdx)
      .map((l) => cleanFormatting(l))
      .filter((l) => l.length > 0 && !l.startsWith("#") && !l.startsWith("---"));
    if (introLines.length > 0) {
      result.seccion3_introduccion_texto = introLines.join("\n\n");
    }

    const headerLine = s3Lines[tableHeaderIdx];
    const detectedHeaders = headerLine
      .split("|")
      .map((h) => cleanFormatting(h).toUpperCase())
      .filter((h) => h.length > 0);

    result.columnas_tabla_tdr = detectedHeaders;

    const isMatrizServicios =
      detectedHeaders.some(h => h.includes("ENTREGABLE") || h.includes("PRODUCTO")) ||
      (detectedHeaders.length === 4 && detectedHeaders.some(h => h.includes("COMPONENTE") || h.includes("SERVICIO")));

    const is3ColsBienes =
      !isMatrizServicios &&
      detectedHeaders.length === 3 &&
      (detectedHeaders[1].includes("DESCRIPCI") || detectedHeaders[1].includes("BIEN")) &&
      (detectedHeaders[2].includes("CARACTER") || detectedHeaders[2].includes("ESPECIFIC"));

    const isSimpleBienes =
      !isMatrizServicios &&
      (detectedHeaders.includes("CANTIDAD") || detectedHeaders.includes("UNIDAD") || detectedHeaders.length === 5);

    const isSalud =
      detectedHeaders.some(h => h.includes("EXAMEN") || h.includes("ESTUDIO") || h.includes("LABORATORIO"));

    if (isMatrizServicios) {
      result.tipo_tabla_sugerido = "MATRIZ_SERVICIOS";
    } else if (is3ColsBienes) {
      result.tipo_tabla_sugerido = "BIENES_3_COLS";
    } else if (isSalud) {
      result.tipo_tabla_sugerido = "SALUD_OCUPACIONAL";
    } else if (isSimpleBienes) {
      result.tipo_tabla_sugerido = "BIENES_SIMPLE";
    } else {
      result.tipo_tabla_sugerido = "TABLA_DINAMICA";
    }

    for (let i = tableSeparatorIdx + 1; i < s3Lines.length; i++) {
      const line = s3Lines[i].trim();
      if (!line || !line.startsWith("|")) continue;
      if (line.includes("---")) continue;

      const cells = line.split("|").map((c) => cleanFormatting(c).trim());
      const contentCells = cells.slice(1, cells.length - 1);

      if (contentCells.length >= 2) {
        let itemNum = parsedItems.length + 1;
        const rawNum = contentCells[0].replace(/\D/g, "");
        if (rawNum) itemNum = parseInt(rawNum, 10);

        if (isMatrizServicios) {
          const desc = contentCells[1] || `COMPONENTE ${itemNum}`;
          const carac = contentCells[2] || "";
          const entregable = contentCells[3] || "";

          parsedItems.push({
            id: `item-srv-${Date.now()}-${itemNum}`,
            item: itemNum,
            descripcion: desc.toUpperCase(),
            unidad: "SRV",
            cantidad: 1,
            precioUnitarioEstimado: 0,
            precioTotalEstimado: 0,
            caracteristicasTecnicas: carac,
            especificacionMinima: carac,
            productoEntregable: entregable,
            propuestoOferente: entregable || "Cumple con entregable requerido",
            valores_columnas: [String(itemNum), desc, carac, entregable],
            fichaTecnica: {
              uso: "Servicios Especializados / Consultoría Institucional",
              normaCertificacion: "Normativa Nacional Vigente Aplicable",
              material: "Informes Técnicos, Matrices y Documentación Oficial",
              color: "Estándar",
              dimensiones: "Según alcance técnico",
              categoriaItem: "Servicios Especializados",
              caracteristicasDetalle: [carac],
            },
          });
        } else if (is3ColsBienes) {
          const desc = contentCells[1] || `ÍTEM ${itemNum}`;
          const carac = contentCells[2] || "";

          parsedItems.push({
            id: `item-bien3-${Date.now()}-${itemNum}`,
            item: itemNum,
            descripcion: desc.toUpperCase(),
            unidad: "PZA",
            cantidad: 1,
            precioUnitarioEstimado: 0,
            precioTotalEstimado: 0,
            caracteristicasTecnicas: carac,
            especificacionMinima: carac,
            valores_columnas: [String(itemNum), desc, carac],
            fichaTecnica: {
              uso: "Personal Institucional",
              normaCertificacion: "Norma Técnica Aplicable",
              material: "Según especificación técnica",
              color: "Estándar",
              dimensiones: "Estándar",
              categoriaItem: "Bienes y Suministros",
              caracteristicasDetalle: [carac],
            },
          });
        } else if (isSimpleBienes && contentCells.length >= 4) {
          const desc = contentCells[1] || `ÍTEM ${itemNum}`;
          const unidad = contentCells[2] || "PZA";
          const cantidad = parseInt(contentCells[3].replace(/[^\d]/g, ""), 10) || 1;
          const carac = contentCells[4] || "";

          parsedItems.push({
            id: `item-bien5-${Date.now()}-${itemNum}`,
            item: itemNum,
            descripcion: desc.toUpperCase(),
            unidad: unidad.toUpperCase(),
            cantidad: cantidad,
            precioUnitarioEstimado: 0,
            precioTotalEstimado: 0,
            caracteristicasTecnicas: carac,
            especificacionMinima: carac,
            valores_columnas: [String(itemNum), desc, unidad, String(cantidad), carac],
          });
        } else {
          // Tabla Dinámica
          const desc = contentCells[1] || `ÍTEM ${itemNum}`;
          const rest = contentCells.slice(2).join(" | ");

          parsedItems.push({
            id: `item-dyn-${Date.now()}-${itemNum}`,
            item: itemNum,
            descripcion: desc.toUpperCase(),
            unidad: "PZA",
            cantidad: 1,
            precioUnitarioEstimado: 0,
            precioTotalEstimado: 0,
            caracteristicasTecnicas: rest,
            especificacionMinima: rest,
            valores_columnas: contentCells,
          });
        }
      }
    }
  }

  result.items = parsedItems;
  return result;
}
