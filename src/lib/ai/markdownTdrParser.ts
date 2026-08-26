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
 * Limpia tags HTML y asteriscos Markdown
 */
function cleanFormatting(text: string): string {
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
 * Formatea un bloque de texto que contiene viñetas (* o - o • o ❖) en párrafos limpios con '❖'
 */
function formatBulletParagraphs(text: string): string {
  if (!text) return "";
  const lines = text.split("\n");
  const formattedLines = lines.map((line) => {
    const cleanL = cleanFormatting(line);
    if (!cleanL) return "";
    if (cleanL.startsWith("*") || cleanL.startsWith("-") || cleanL.startsWith("•") || cleanL.startsWith("❖")) {
      return `❖  ${cleanL.replace(/^[\*\-\•\❖]\s*/, "")}`;
    }
    return cleanL;
  }).filter(Boolean);

  return formattedLines.join("\n\n");
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

  const rawText = rawMarkdown.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = rawText.split("\n");

  // =========================================================================
  // 1. EXTRAER TÍTULO PRINCIPAL DEL PROCESO
  // =========================================================================
  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const cleanL = cleanFormatting(lines[i]).toUpperCase();
    if (
      cleanL.startsWith("ESPECIFICACIONES TÉCNICAS") ||
      cleanL.startsWith("TÉRMINOS DE REFERENCIA") ||
      cleanL.startsWith("ADQUISICIÓN") ||
      cleanL.startsWith("CONTRATACIÓN") ||
      cleanL.startsWith("COMPRA DE") ||
      cleanL.startsWith("PROVISIÓN") ||
      cleanL.startsWith("SERVICIO DE") ||
      cleanL.startsWith("CONSULTORÍA")
    ) {
      result.titulo_proceso = cleanL.replace(/^["'“]|["'”]$/g, "").trim();
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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const cleanL = cleanFormatting(line).toUpperCase();
    if (!cleanL || cleanL.length > 90) continue;
    if (line.startsWith("|")) continue;

    // Encabezado tipo "3. ESPECIFICACIÓN TÉCNICA (OPCIÓN A...)", "### 4. CALIDAD", "4. CALIDAD"
    const matchNum = cleanL.match(/^(?:#+\s*)?(\d+)[\.\-\)]\s*([A-ZÁÉÍÓÚÑ\s\/\-_\(\)]+)/i);
    if (matchNum) {
      const num = parseInt(matchNum[1], 10);
      if (num >= 1 && num <= 14) {
        detectedSections.push({ num, title: matchNum[2].trim(), lineIdx: i });
        continue;
      }
    }

    // Por palabra clave
    for (const [numStr, kwList] of Object.entries(sectionKeywords)) {
      const num = parseInt(numStr, 10);
      if (kwList.some((kw) => cleanL === kw || cleanL.startsWith(kw + ":") || cleanL.startsWith(kw + " -") || cleanL.endsWith(kw))) {
        if (!detectedSections.some((s) => s.num === num)) {
          detectedSections.push({ num, title: cleanL, lineIdx: i });
          break;
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

    const bodyText = bodyLines
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("---"))
      .join("\n");

    sectionTexts[current.num] = bodyText;
    if (current.num !== 3) {
      result.puntos_detectados[current.num] = formatBulletParagraphs(bodyText);
    }
  }

  if (result.puntos_detectados[1]) result.antecedentes_texto = result.puntos_detectados[1];
  if (result.puntos_detectados[2]) result.justificacion_texto = result.puntos_detectados[2];

  // =========================================================================
  // 3. EXTRAER Y RECONSTRUIR LA TABLA DE ÍTEMS (MARKDOWN O TEXTO PLANO)
  // =========================================================================
  const section3Raw = sectionTexts[3] || rawText;
  const s3Lines = section3Raw.split("\n");

  const parsedItems: ItemAdquisicion[] = [];

  // 3.A. Intento 1: Tabla Markdown con Pipes |
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

  if (tableSeparatorIdx !== -1) {
    const headerLine = tableHeaderIdx !== -1 ? s3Lines[tableHeaderIdx] : "";
    const headerLower = headerLine.toLowerCase();
    const isSalud =
      headerLower.includes("examen") ||
      headerLower.includes("estudio") ||
      headerLower.includes("metodologia") ||
      headerLower.includes("propuesto");

    const tableDataLines = s3Lines.slice(tableSeparatorIdx + 1);

    const itemChunks: string[] = [];
    let currentItemChunk = "";
    const rowStartRegex = /^\|\s*(?:\*{1,2})?\s*\d+[\.\-\)]?\s*(?:\*{1,2})?\s*\|/i;

    for (let i = 0; i < tableDataLines.length; i++) {
      const line = tableDataLines[i];
      const trimmed = line.trim();

      if (rowStartRegex.test(trimmed)) {
        if (currentItemChunk) {
          itemChunks.push(currentItemChunk);
        }
        currentItemChunk = trimmed;
      } else if (currentItemChunk) {
        currentItemChunk += "\n" + line;
      }
    }
    if (currentItemChunk) {
      itemChunks.push(currentItemChunk);
    }

    itemChunks.forEach((chunk, chunkIdx) => {
      const normalizedChunk = chunk
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/?[^>]+(>|$)/g, "");

      const pipeParts = normalizedChunk.split("|");

      if (pipeParts.length >= 4) {
        const itemNumStr = cleanFormatting(pipeParts[1]).trim();
        const itemNum = parseInt(itemNumStr.replace(/[^\d]/g, ""), 10) || chunkIdx + 1;
        const descripcion = cleanFormatting(pipeParts[2]).trim().toUpperCase();

        let caracteristicasRaw = "";
        let cantidadStr = "";
        let unidad = "PZA";
        let cantidad = 1;

        if (pipeParts.length === 4) {
          caracteristicasRaw = pipeParts[3].trim();
        } else if (pipeParts.length >= 5) {
          cantidadStr = cleanFormatting(pipeParts[pipeParts.length - 2]).trim();
          caracteristicasRaw = pipeParts.slice(3, pipeParts.length - 2).join("|").trim();

          const cantParsed = parseInt(cantidadStr.replace(/[^\d]/g, ""), 10);
          if (!isNaN(cantParsed) && cantParsed > 0) cantidad = cantParsed;

          const cantLower = cantidadStr.toLowerCase();
          if (cantLower.includes("lote")) unidad = "LOTE";
          else if (cantLower.includes("par")) unidad = "PAR";
          else if (cantLower.includes("jgo") || cantLower.includes("juego")) unidad = "JGO";
          else if (cantLower.includes("global")) unidad = "GLB";
          else if (cantLower.includes("servicio")) unidad = "SRV";
          else if (isSalud) unidad = "ESTUDIO";
        }

        const cleanLines = caracteristicasRaw
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.length > 0 && l !== "<br>");

        const formattedCaracs = cleanLines
          .map((l) => {
            const noMd = cleanFormatting(l);
            if (noMd.startsWith("•") || noMd.startsWith("-") || noMd.startsWith("*") || noMd.startsWith("❖")) {
              return `❖  ${noMd.replace(/^[\•\-\*\❖]\s*/, "")}`;
            }
            return noMd;
          })
          .join("\n\n");

        const finalCaracs = formattedCaracs || descripcion;

        parsedItems.push({
          id: `item-tdr-${Date.now()}-${chunkIdx}`,
          item: itemNum,
          descripcion: descripcion || `ÍTEM #${itemNum}`,
          unidad: unidad.toUpperCase(),
          cantidad,
          precioUnitarioEstimado: 0,
          precioTotalEstimado: 0,
          caracteristicasTecnicas: finalCaracs,
          especificacionMinima: finalCaracs,
          propuestoOferente: "Cumple con la totalidad de especificaciones técnicas requeridas",
          fichaTecnica: {
            uso: isSalud ? "Salud Ocupacional" : "Personal Institucional / Técnico",
            normaCertificacion: isSalud ? "Acreditación Sanitaria" : "Normas de Calidad y Eficiencia Aplicables",
            material: "Material homologado de alta calidad",
            color: "Estándar",
            dimensiones: "Según requerimiento técnico",
            categoriaItem: isSalud ? "Salud Ocupacional" : "Bienes y Suministros Oficiales",
            caracteristicasDetalle: cleanLines.map((l) => cleanFormatting(l).replace(/^[\•\-\*\❖]\s*/, "").trim()),
          },
        });
      }
    });
  }

  // 3.B. Intento 2: Parser para Tablas en Texto Plano o Copiadas de Word / PDF
  if (parsedItems.length === 0) {
    const isHeaderLine = (l: string) => {
      const up = cleanFormatting(l).toUpperCase();
      return (
        up === "ÍTEM" ||
        up === "ITEM" ||
        up === "NO." ||
        up === "N°" ||
        up.startsWith("DESCRIPCIÓN") ||
        up.startsWith("DESCRIPCION") ||
        up.startsWith("CARACTERÍSTICAS") ||
        up.startsWith("CARACTERISTICAS") ||
        up.startsWith("PRODUCTO ENTREGABLE") ||
        up.startsWith("ESPECIFICACIÓN") ||
        up.startsWith("ESPECIFICACION") ||
        up.startsWith("CANT.") ||
        up.startsWith("CANTIDAD") ||
        up.startsWith("UNIDAD") ||
        up.startsWith("EL PROPONENTE DEBE")
      );
    };

    const itemBlocks: Array<{ num: number; lines: string[] }> = [];
    let currentBlock: { num: number; lines: string[] } | null = null;

    for (let i = 0; i < s3Lines.length; i++) {
      const line = s3Lines[i].trim();
      if (!line) continue;
      if (isHeaderLine(line)) continue;

      // Buscar número de ítem aislado (ej. "1", "2", "3") o con prefijo (ej. "1.", "ÍTEM 1:")
      const matchNumOnly = line.match(/^(\d+)$/);
      const matchNumPrefix = line.match(/^(?:ÍTEM|ITEM)?\s*(\d+)[\.\-\)]\s*(.*)$/i);

      if (matchNumOnly) {
        const num = parseInt(matchNumOnly[1], 10);
        if (num >= 1 && num <= 50) {
          if (currentBlock) itemBlocks.push(currentBlock);
          currentBlock = { num, lines: [] };
          continue;
        }
      } else if (matchNumPrefix) {
        const num = parseInt(matchNumPrefix[1], 10);
        if (num >= 1 && num <= 50) {
          if (currentBlock) itemBlocks.push(currentBlock);
          currentBlock = { num, lines: matchNumPrefix[2] ? [matchNumPrefix[2].trim()] : [] };
          continue;
        }
      }

      if (currentBlock) {
        currentBlock.lines.push(line);
      }
    }
    if (currentBlock) itemBlocks.push(currentBlock);

    itemBlocks.forEach((block, bIdx) => {
      if (block.lines.length > 0) {
        const desc = cleanFormatting(block.lines[0]).toUpperCase();
        const rest = block.lines.slice(1).map((l) => cleanFormatting(l)).filter(Boolean);

        const caracs =
          rest.length > 0
            ? rest.map((l) => `❖  ${l.replace(/^[\•\-\*\❖]\s*/, "")}`).join("\n\n")
            : desc;

        parsedItems.push({
          id: `item-plain-${Date.now()}-${bIdx}`,
          item: block.num || bIdx + 1,
          descripcion: desc || `COMPONENTE #${bIdx + 1}`,
          unidad: "SRV",
          cantidad: 1,
          precioUnitarioEstimado: 0,
          precioTotalEstimado: 0,
          caracteristicasTecnicas: caracs,
          especificacionMinima: caracs,
          propuestoOferente: "Cumple con la totalidad de especificaciones técnicas y entregables requeridos",
          fichaTecnica: {
            uso: "Servicios Especializados / Requerimiento Institucional",
            normaCertificacion: "Normativa Nacional Vigente Aplicable",
            material: "Informes Técnicos, Matrices y Documentación Oficial",
            color: "Estándar",
            dimensiones: "Según alcance técnico",
            categoriaItem: "Servicios Especializados",
            caracteristicasDetalle: rest,
          },
        });
      }
    });
  }

  if (parsedItems.length > 0) {
    result.items = parsedItems;
    result.tipo_tabla_sugerido = "BIENES_3_COLS";
  }

  return result;
}
