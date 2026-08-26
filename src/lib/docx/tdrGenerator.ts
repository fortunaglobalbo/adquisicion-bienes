import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  Header,
  PageNumber,
  Packer,
  ShadingType,
  PageBreak,
  ImageRun,
} from "docx";
import fs from "fs";
import path from "path";
import { Adquisicion } from "@/types";
import { ENDE_COLORS, defaultTableBorders } from "./endeTheme";
import { getMesAnioActual } from "@/lib/utils/dateUtils";

export async function generateTdrDocx(adquisicion: Adquisicion, templateData?: any): Promise<Buffer> {
  const tpl = templateData || {};
  const revision = tpl.versionDoc || adquisicion.revision || "Rev. N° 1";
  const mesAnio =
    adquisicion.mes_anio_documento && !adquisicion.mes_anio_documento.toLowerCase().includes("mayo")
      ? adquisicion.mes_anio_documento
      : (tpl.fechaDoc && !tpl.fechaDoc.toLowerCase().includes("mayo")
        ? tpl.fechaDoc
        : getMesAnioActual());
  const tituloUpper = (tpl.tituloProceso || adquisicion.titulo_proceso || "ADQUISICIÓN DE BIENES Y SUMINISTROS").toUpperCase();
  const elaborado = adquisicion.elaborado_por || tpl.firmaNombre || "Área Solicitante";
  const revisado = adquisicion.revisado_por || "Jefatura de Adquisiciones y Contrataciones";
  const aprobado = adquisicion.aprobado_por || "Gerencia General / Administrativa Financiera";


  // Resumen de ítems en viñeta
  const resumenItems = adquisicion.items
    .map((it) => `${it.cantidad} ${it.unidad || "PZA"}. ${it.descripcion.toUpperCase()}`)
    .join("; ");

  // Load official logo image from disk if available
  let logoBuffer: Buffer | null = null;
  try {
    const logoPath = path.join(process.cwd(), "public", "logo-ende-deoruro.png");
    if (fs.existsSync(logoPath)) {
      logoBuffer = fs.readFileSync(logoPath);
    }
  } catch (e) {
    console.warn("Could not read logo image from disk:", e);
  }

  // Standarized Font Sizes: Máximo 12 pt en todo el documento oficial
  // 12 pt = 24 half-points en la especificación docx
  // 10 pt = 20 half-points
  // 9 pt  = 18 half-points
  const FONT_BODY = 24; // 12pt
  const FONT_HEADING = 24; // 12pt (Máximo 12pt)
  const FONT_TITLE = 24; // 12pt (Máximo 12pt)
  const FONT_SMALL = 20; // 10pt
  const FONT_TINY = 18; // 9pt

  function formatSectionParagraphs(text?: string, defaultText: string = ""): Paragraph[] {
    const clean = (text || defaultText).trim();
    if (!clean) return [];

    const rawLines = clean
      .replace(/❖/g, "\n❖")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    return rawLines.map((line) => {
      const isBullet = line.startsWith("❖") || line.startsWith("•") || line.startsWith("-") || line.startsWith("*");
      const cleanLine = line.replace(/^\*+\s*/, "").replace(/\*\*/g, "");

      return new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { before: isBullet ? 50 : 30, after: isBullet ? 60 : 40 },
        children: [
          new TextRun({
            text: cleanLine,
            size: FONT_BODY,
            font: "Inter",
          }),
        ],
      });
    });
  }

  const doc = new Document({
    sections: [
      // ============================================================
      // SECCIÓN 1: PORTADA OFICIAL (Página 1)
      // ============================================================
      {
        properties: {
          page: {
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
          },
        },
        children: [
          // Logo Oficial
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 300, after: 300 },
            children: logoBuffer
              ? [
                  new ImageRun({
                    type: "png",
                    data: logoBuffer,
                    transformation: { width: 220, height: 98 },
                  }),
                ]
              : [
                  new TextRun({
                    text: "ENDE DEORURO",
                    bold: true,
                    size: FONT_TITLE,
                    color: ENDE_COLORS.primary,
                    font: "Inter",
                  }),
                ],
          }),

          // Título Portada
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 300, after: 150 },
            children: [
              new TextRun({
                text: "ESPECIFICACIONES TÉCNICAS",
                bold: true,
                size: FONT_TITLE, // 12pt
                color: ENDE_COLORS.primary,
                font: "Inter",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
            children: [
              new TextRun({
                text: tituloUpper,
                bold: true,
                size: FONT_TITLE, // 12pt
                color: ENDE_COLORS.darkText,
                font: "Inter",
              }),
            ],
          }),

          // Tabla de 3 Columnas: Elaborado, Revisado, Aprobado
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: defaultTableBorders,
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    shading: { type: ShadingType.CLEAR, fill: "F2F4F6" },
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Elaborado", bold: true, size: FONT_BODY, font: "Inter" })] })],
                  }),
                  new TableCell({
                    shading: { type: ShadingType.CLEAR, fill: "F2F4F6" },
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Revisado", bold: true, size: FONT_BODY, font: "Inter" })] })],
                  }),
                  new TableCell({
                    shading: { type: ShadingType.CLEAR, fill: "F2F4F6" },
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Aprobado", bold: true, size: FONT_BODY, font: "Inter" })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    margins: { top: 120, bottom: 120, left: 100, right: 100 },
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: elaborado, size: FONT_BODY, font: "Inter" })] })],
                  }),
                  new TableCell({
                    margins: { top: 120, bottom: 120, left: 100, right: 100 },
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: revisado, size: FONT_BODY, font: "Inter" })] })],
                  }),
                  new TableCell({
                    margins: { top: 120, bottom: 120, left: 100, right: 100 },
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: aprobado, size: FONT_BODY, font: "Inter" })] })],
                  }),
                ],
              }),
            ],
          }),

          // Sección RESUMEN (Texto a 12 pt)
          new Paragraph({
            spacing: { before: 400, after: 120 },
            children: [
              new TextRun({
                text: "RESUMEN",
                bold: true,
                size: FONT_HEADING,
                color: "2563EB",
                font: "Inter",
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 500 },
            children: [
              new TextRun({
                text: `❖  ${resumenItems || "ADQUISICIÓN DE HERRAMIENTAS Y EQUIPOS PARA CUADRILLAS DE MANTENIMIENTO."}`,
                size: FONT_BODY, // 12 pt
                color: ENDE_COLORS.darkText,
                font: "Inter",
              }),
            ],
          }),

          // Pie de portada
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 600, after: 60 },
            children: [
              new TextRun({
                text: mesAnio,
                bold: true,
                size: FONT_HEADING,
                font: "Inter",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "Oruro-Bolivia",
                size: FONT_BODY,
                color: ENDE_COLORS.grayText,
                font: "Inter",
              }),
            ],
          }),
        ],
      },


      // ============================================================
      // SECCIÓN 2: CUERPO DEL DOCUMENTO (Páginas 2 a 7) - Texto a 12pt
      // ============================================================
      {
        properties: {
          page: {
            margin: { top: 1200, bottom: 1200, left: 1200, right: 1200 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: defaultTableBorders,
                rows: [
                  new TableRow({
                    children: [
                      // Celda Izquierda: Logo Oficial
                      new TableCell({
                        width: { size: 24, type: WidthType.PERCENTAGE },
                        margins: { top: 60, bottom: 60, left: 60, right: 60 },
                        children: [
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: logoBuffer
                              ? [
                                  new ImageRun({
                                    type: "png",
                                    data: logoBuffer,
                                    transformation: { width: 110, height: 48 },
                                  }),
                                ]
                              : [
                                  new TextRun({ text: "ENDE DEORURO", bold: true, size: FONT_SMALL, color: ENDE_COLORS.primary, font: "Inter" }),
                                ],
                          }),
                        ],
                      }),
                      // Celda Central: Título del proceso
                      new TableCell({
                        width: { size: 54, type: WidthType.PERCENTAGE },
                        margins: { top: 80, bottom: 80, left: 80, right: 80 },
                        children: [
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                              new TextRun({
                                text: tituloUpper,
                                bold: true,
                                size: FONT_BODY,
                                font: "Inter",
                              }),
                            ],
                          }),
                        ],
                      }),
                      // Celda Derecha: Rev, Fecha, Página
                      new TableCell({
                        width: { size: 22, type: WidthType.PERCENTAGE },
                        margins: { top: 60, bottom: 60, left: 60, right: 60 },
                        children: [
                          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: revision, size: FONT_SMALL, font: "Inter" })] }),
                          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: mesAnio.toUpperCase(), size: FONT_SMALL, font: "Inter" })] }),
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                              new TextRun({ text: "Página ", size: FONT_SMALL, font: "Inter" }),
                              new TextRun({ children: [PageNumber.CURRENT], size: FONT_SMALL, font: "Inter" }),
                              new TextRun({ text: " / 7", size: FONT_SMALL, font: "Inter" }),
                            ],
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
              new Paragraph({ spacing: { after: 200 } }),
            ],
          }),
        },
        children: [
          // PÁGINA 2: ÍNDICE GENERAL DEL DOCUMENTO (14 Puntos Oficiales)
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 250 },
            children: [
              new TextRun({
                text: "ÍNDICE GENERAL DEL DOCUMENTO",
                bold: true,
                size: FONT_HEADING, // 12pt
                font: "Inter",
              }),
            ],
          }),
          new Paragraph({ spacing: { after: 90 }, children: [new TextRun({ text: "1.   ANTECEDENTES ....................................................................................................................... 3", size: FONT_BODY, font: "Inter" })] }),
          new Paragraph({ spacing: { after: 90 }, children: [new TextRun({ text: "2.   JUSTIFICACIÓN / NECESIDAD ................................................................................................. 3", size: FONT_BODY, font: "Inter" })] }),
          new Paragraph({ spacing: { after: 90 }, children: [new TextRun({ text: "3.   ESPECIFICACIÓN TÉCNICA ..................................................................................................... 4", size: FONT_BODY, font: "Inter" })] }),
          new Paragraph({ spacing: { after: 90 }, children: [new TextRun({ text: "4.   CALIDAD ................................................................................................................................. 4", size: FONT_BODY, font: "Inter" })] }),
          new Paragraph({ spacing: { after: 90 }, children: [new TextRun({ text: "5.   ÁMBITO DE APLICACIÓN .......................................................................................................... 5", size: FONT_BODY, font: "Inter" })] }),
          new Paragraph({ spacing: { after: 90 }, children: [new TextRun({ text: "6.   MÉTODO DE SELECCIÓN .......................................................................................................... 5", size: FONT_BODY, font: "Inter" })] }),
          new Paragraph({ spacing: { after: 90 }, children: [new TextRun({ text: "7.   VIGENCIA DE LA PROPUESTA .................................................................................................. 5", size: FONT_BODY, font: "Inter" })] }),
          new Paragraph({ spacing: { after: 90 }, children: [new TextRun({ text: "8.   CATEGORÍA ............................................................................................................................. 6", size: FONT_BODY, font: "Inter" })] }),
          new Paragraph({ spacing: { after: 90 }, children: [new TextRun({ text: "9.   LUGAR DE ENTREGA ............................................................................................................... 6", size: FONT_BODY, font: "Inter" })] }),
          new Paragraph({ spacing: { after: 90 }, children: [new TextRun({ text: "10. TIEMPO DE ENTREGA .............................................................................................................. 6", size: FONT_BODY, font: "Inter" })] }),
          new Paragraph({ spacing: { after: 90 }, children: [new TextRun({ text: "11. FORMA DE ADJUDICACIÓN ....................................................................................................... 6", size: FONT_BODY, font: "Inter" })] }),
          new Paragraph({ spacing: { after: 90 }, children: [new TextRun({ text: "12. PARA LA ACEPTACIÓN DEL LOTE / SERVICIO ......................................................................... 6", size: FONT_BODY, font: "Inter" })] }),
          new Paragraph({ spacing: { after: 90 }, children: [new TextRun({ text: "13. FORMA DE PAGO .................................................................................................................... 6", size: FONT_BODY, font: "Inter" })] }),
          new Paragraph({ spacing: { after: 250 }, children: [new TextRun({ text: "14. APLICACIÓN DE MULTAS .......................................................................................................... 6", size: FONT_BODY, font: "Inter" })] }),

          new Paragraph({ children: [new PageBreak()] }),

          // PÁGINA 3: ANTECEDENTES Y JUSTIFICACIÓN (12 pt)
          new Paragraph({
            spacing: { before: 100, after: 100 },
            children: [
              new TextRun({ text: "1.   ANTECEDENTES", bold: true, size: FONT_HEADING, font: "Inter" }),
            ],
          }),
          ...formatSectionParagraphs(
            adquisicion.antecedentes_texto,
            "De acuerdo a la legislación vigente, normas y políticas internas se inicia el proceso de contratación, enmarcados en el manual de procedimientos y Reglamento de Adquisición de Bienes, Construcción de Obras y Contratación de Servicios."
          ),

          new Paragraph({
            spacing: { before: 100, after: 100 },
            children: [
              new TextRun({ text: "2.   JUSTIFICACIÓN / NECESIDAD", bold: true, size: FONT_HEADING, font: "Inter" }),
            ],
          }),
          ...formatSectionParagraphs(
            adquisicion.justificacion_texto,
            "La presente contratación tiene el objetivo fundamental de garantizar la continuidad operativa, el cumplimiento normativo institucional y la mitigación de riesgos."
          ),

          new Paragraph({
            spacing: { before: 100, after: 140 },
            children: [
              new TextRun({ text: "3.   ESPECIFICACIÓN TÉCNICA", bold: true, size: FONT_HEADING, font: "Inter" }),
            ],
          }),

          ...(adquisicion.seccion3_introduccion_texto
            ? [
                new Paragraph({
                  spacing: { after: 140 },
                  children: [
                    new TextRun({
                      text: adquisicion.seccion3_introduccion_texto,
                      size: FONT_BODY,
                      font: "Inter",
                    }),
                  ],
                }),
              ]
            : []),

          // TABLAS DE ESPECIFICACIONES TÉCNICAS (Páginas 3 a 6) - 12 pt
          ...(() => {
            const tipoTabla =
              adquisicion.tipo_tabla_tdr ||
              templateData?.tipoTabla ||
              ((adquisicion.categoria as any) === "Salud Ocupacional" ||
              adquisicion.titulo_proceso.toLowerCase().includes("oftalmo") ||
              adquisicion.titulo_proceso.toLowerCase().includes("laboratorio")
                ? "SALUD_OCUPACIONAL"
                : "MATRIZ_SERVICIOS");

            if (tipoTabla === "MATRIZ_SERVICIOS") {
              const tablaMatriz = new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: defaultTableBorders,
                rows: [
                  new TableRow({
                    tableHeader: true,
                    children: [
                      new TableCell({
                        width: { size: 8, type: WidthType.PERCENTAGE },
                        shading: { type: ShadingType.CLEAR, fill: "ECEEF0" },
                        margins: { top: 80, bottom: 80, left: 60, right: 60 },
                        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "ÍTEM", bold: true, size: FONT_BODY, font: "Inter" })] })],
                      }),
                      new TableCell({
                        width: { size: 30, type: WidthType.PERCENTAGE },
                        shading: { type: ShadingType.CLEAR, fill: "ECEEF0" },
                        margins: { top: 80, bottom: 80, left: 80, right: 80 },
                        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "DESCRIPCIÓN DE COMPONENTE", bold: true, size: FONT_BODY, font: "Inter" })] })],
                      }),
                      new TableCell({
                        width: { size: 38, type: WidthType.PERCENTAGE },
                        shading: { type: ShadingType.CLEAR, fill: "ECEEF0" },
                        margins: { top: 80, bottom: 80, left: 80, right: 80 },
                        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "CARACTERÍSTICAS / ESPECIFICACIÓN TÉCNICA MÍNIMA REQUERIDA", bold: true, size: FONT_BODY, font: "Inter" })] })],
                      }),
                      new TableCell({
                        width: { size: 24, type: WidthType.PERCENTAGE },
                        shading: { type: ShadingType.CLEAR, fill: "ECEEF0" },
                        margins: { top: 80, bottom: 80, left: 80, right: 80 },
                        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "PRODUCTO ENTREGABLE", bold: true, size: FONT_BODY, font: "Inter" })] })],
                      }),
                    ],
                  }),
                  ...adquisicion.items.map((it) => {
                    const carac = it.caracteristicasTecnicas || it.especificacionMinima || "Cumplimiento con especificaciones técnicas y alcance requerido.";
                    const entregable = it.productoEntregable || it.propuestoOferente || "Informe final y entregables técnicos aprobados.";
                    
                    const caracParagraphs = carac
                      .split("\n")
                      .map((line) => line.trim())
                      .filter(Boolean)
                      .map(
                        (line) =>
                          new Paragraph({
                            spacing: { before: 30, after: 30 },
                            children: [new TextRun({ text: line, size: FONT_BODY, font: "Inter" })],
                          })
                      );

                    return new TableRow({
                      children: [
                        new TableCell({ margins: { top: 80, bottom: 80, left: 60, right: 60 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(it.item), bold: true, size: FONT_BODY, font: "Inter" })] })] }),
                        new TableCell({ margins: { top: 80, bottom: 80, left: 80, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: it.descripcion, bold: true, size: FONT_BODY, font: "Inter" })] })] }),
                        new TableCell({ margins: { top: 80, bottom: 80, left: 80, right: 80 }, children: caracParagraphs.length > 0 ? caracParagraphs : [new Paragraph({ children: [new TextRun({ text: carac, size: FONT_BODY, font: "Inter" })] })] }),
                        new TableCell({ margins: { top: 80, bottom: 80, left: 80, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: entregable, size: FONT_BODY, font: "Inter" })] })] }),
                      ],
                    });
                  }),
                ],
              });
              return [tablaMatriz, new Paragraph({ spacing: { after: 200 } })];
            }

            if (tipoTabla === "TABLA_DINAMICA" && adquisicion.columnas_tabla_tdr && adquisicion.columnas_tabla_tdr.length > 0) {
              const cols = adquisicion.columnas_tabla_tdr;
              const colWidth = Math.floor(100 / cols.length);

              const tablaDinamica = new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: defaultTableBorders,
                rows: [
                  new TableRow({
                    tableHeader: true,
                    children: cols.map((colName, idx) =>
                      new TableCell({
                        width: { size: idx === 0 ? 8 : (idx === 1 ? colWidth + (colWidth - 8) : colWidth), type: WidthType.PERCENTAGE },
                        shading: { type: ShadingType.CLEAR, fill: "ECEEF0" },
                        margins: { top: 80, bottom: 80, left: 60, right: 60 },
                        children: [new Paragraph({ alignment: idx === 0 ? AlignmentType.CENTER : AlignmentType.LEFT, children: [new TextRun({ text: colName, bold: true, size: FONT_BODY, font: "Inter" })] })],
                      })
                    ),
                  }),
                  ...adquisicion.items.map((it) => {
                    const rowVals = it.valores_columnas && it.valores_columnas.length === cols.length
                      ? it.valores_columnas
                      : [String(it.item), it.descripcion, it.caracteristicasTecnicas || "", it.productoEntregable || ""];

                    return new TableRow({
                      children: cols.map((_, colIdx) =>
                        new TableCell({
                          margins: { top: 80, bottom: 80, left: 60, right: 60 },
                          children: [new Paragraph({ alignment: colIdx === 0 ? AlignmentType.CENTER : AlignmentType.LEFT, children: [new TextRun({ text: rowVals[colIdx] || "", size: FONT_BODY, font: "Inter" })] })],
                        })
                      ),
                    });
                  }),
                ],
              });
              return [tablaDinamica, new Paragraph({ spacing: { after: 200 } })];
            }

            if (tipoTabla === "SALUD_OCUPACIONAL") {
              const tablaSalud = new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: defaultTableBorders,
                rows: [
                  new TableRow({
                    tableHeader: true,
                    children: [
                      new TableCell({
                        width: { size: 8, type: WidthType.PERCENTAGE },
                        shading: { type: ShadingType.CLEAR, fill: "ECEEF0" },
                        margins: { top: 80, bottom: 80, left: 60, right: 60 },
                        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "ÍTEM", bold: true, size: FONT_BODY, font: "Inter" })] })],
                      }),
                      new TableCell({
                        width: { size: 32, type: WidthType.PERCENTAGE },
                        shading: { type: ShadingType.CLEAR, fill: "ECEEF0" },
                        margins: { top: 80, bottom: 80, left: 80, right: 80 },
                        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "EXAMEN / ESTUDIO REQUERIDO", bold: true, size: FONT_BODY, font: "Inter" })] })],
                      }),
                      new TableCell({
                        width: { size: 36, type: WidthType.PERCENTAGE },
                        shading: { type: ShadingType.CLEAR, fill: "ECEEF0" },
                        margins: { top: 80, bottom: 80, left: 80, right: 80 },
                        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "ESPECIFICACIÓN MÍNIMA / METODOLOGÍA", bold: true, size: FONT_BODY, font: "Inter" })] })],
                      }),
                      new TableCell({
                        width: { size: 24, type: WidthType.PERCENTAGE },
                        shading: { type: ShadingType.CLEAR, fill: "ECEEF0" },
                        margins: { top: 80, bottom: 80, left: 80, right: 80 },
                        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "PROPUESTO / A INFORMAR", bold: true, size: FONT_BODY, font: "Inter" })] })],
                      }),
                    ],
                  }),
                  ...adquisicion.items.map((it) => {
                    const ft = it.fichaTecnica || {};
                    const espMin = it.especificacionMinima || ft.normaCertificacion || ft.material || "Examen médico / análisis de laboratorio con metodología certificada y acreditación sanitaria";
                    const propuesto = it.propuestoOferente || "Cumple / A informar según metodología";
                    return new TableRow({
                      children: [
                        new TableCell({ margins: { top: 80, bottom: 80, left: 60, right: 60 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(it.item), bold: true, size: FONT_BODY, font: "Inter" })] })] }),
                        new TableCell({ margins: { top: 80, bottom: 80, left: 80, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: it.descripcion, bold: true, size: FONT_BODY, font: "Inter" }), new Paragraph({ children: [new TextRun({ text: `Cantidad: ${it.cantidad} ${it.unidad || "ESTUDIO"}`, size: FONT_SMALL, color: ENDE_COLORS.grayText, font: "Inter" })] })] })] }),
                        new TableCell({ margins: { top: 80, bottom: 80, left: 80, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: espMin, size: FONT_BODY, font: "Inter" })] })] }),
                        new TableCell({ margins: { top: 80, bottom: 80, left: 80, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: propuesto, size: FONT_BODY, font: "Inter" })] })] }),
                      ],
                    });
                  }),
                ],
              });
              return [tablaSalud, new Paragraph({ spacing: { after: 200 } })];
            }

            if (tipoTabla === "BIENES_3_COLS") {
              const tablaBienes3Cols = new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: defaultTableBorders,
                rows: [
                  new TableRow({
                    tableHeader: true,
                    children: [
                      new TableCell({
                        width: { size: 8, type: WidthType.PERCENTAGE },
                        shading: { type: ShadingType.CLEAR, fill: "ECEEF0" },
                        margins: { top: 80, bottom: 80, left: 60, right: 60 },
                        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "ÍTEM", bold: true, size: FONT_BODY, font: "Inter" })] })],
                      }),
                      new TableCell({
                        width: { size: 42, type: WidthType.PERCENTAGE },
                        shading: { type: ShadingType.CLEAR, fill: "ECEEF0" },
                        margins: { top: 80, bottom: 80, left: 80, right: 80 },
                        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "DESCRIPCIÓN DEL BIEN / REQUERIMIENTO", bold: true, size: FONT_BODY, font: "Inter" })] })],
                      }),
                      new TableCell({
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        shading: { type: ShadingType.CLEAR, fill: "ECEEF0" },
                        margins: { top: 80, bottom: 80, left: 80, right: 80 },
                        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "CARACTERÍSTICAS TÉCNICAS REQUERIDAS", bold: true, size: FONT_BODY, font: "Inter" })] })],
                      }),
                    ],
                  }),
                  ...adquisicion.items.map((it) => {
                    const carac = it.caracteristicasTecnicas || it.especificacionMinima || "Cumplimiento con especificaciones técnicas requeridas por ENDE Deoruro S.A.";
                    const caracParagraphs = carac
                      .split("\n")
                      .map((line) => line.trim())
                      .filter(Boolean)
                      .map(
                        (line) =>
                          new Paragraph({
                            spacing: { before: 30, after: 30 },
                            children: [new TextRun({ text: line, size: FONT_BODY, font: "Inter" })],
                          })
                      );

                    return new TableRow({
                      children: [
                        new TableCell({ margins: { top: 80, bottom: 80, left: 60, right: 60 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(it.item), bold: true, size: FONT_BODY, font: "Inter" })] })] }),
                        new TableCell({ margins: { top: 80, bottom: 80, left: 80, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: it.descripcion, bold: true, size: FONT_BODY, font: "Inter" })] })] }),
                        new TableCell({ margins: { top: 80, bottom: 80, left: 80, right: 80 }, children: caracParagraphs.length > 0 ? caracParagraphs : [new Paragraph({ children: [new TextRun({ text: carac, size: FONT_BODY, font: "Inter" })] })] }),
                      ],
                    });
                  }),
                ],
              });
              return [tablaBienes3Cols, new Paragraph({ spacing: { after: 200 } })];
            }

            if (tipoTabla === "BIENES_SIMPLE") {
              const tablaBienes = new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: defaultTableBorders,
                rows: [
                  new TableRow({
                    tableHeader: true,
                    children: [
                      new TableCell({
                        width: { size: 8, type: WidthType.PERCENTAGE },
                        shading: { type: ShadingType.CLEAR, fill: "ECEEF0" },
                        margins: { top: 80, bottom: 80, left: 60, right: 60 },
                        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "ÍTEM", bold: true, size: FONT_BODY, font: "Inter" })] })],
                      }),
                      new TableCell({
                        width: { size: 34, type: WidthType.PERCENTAGE },
                        shading: { type: ShadingType.CLEAR, fill: "ECEEF0" },
                        margins: { top: 80, bottom: 80, left: 80, right: 80 },
                        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "DESCRIPCIÓN DEL BIEN", bold: true, size: FONT_BODY, font: "Inter" })] })],
                      }),
                      new TableCell({
                        width: { size: 10, type: WidthType.PERCENTAGE },
                        shading: { type: ShadingType.CLEAR, fill: "ECEEF0" },
                        margins: { top: 80, bottom: 80, left: 60, right: 60 },
                        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "UNIDAD", bold: true, size: FONT_BODY, font: "Inter" })] })],
                      }),
                      new TableCell({
                        width: { size: 10, type: WidthType.PERCENTAGE },
                        shading: { type: ShadingType.CLEAR, fill: "ECEEF0" },
                        margins: { top: 80, bottom: 80, left: 60, right: 60 },
                        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "CANTIDAD", bold: true, size: FONT_BODY, font: "Inter" })] })],
                      }),
                      new TableCell({
                        width: { size: 38, type: WidthType.PERCENTAGE },
                        shading: { type: ShadingType.CLEAR, fill: "ECEEF0" },
                        margins: { top: 80, bottom: 80, left: 80, right: 80 },
                        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "CARACTERÍSTICAS TÉCNICAS REQUERIDAS", bold: true, size: FONT_BODY, font: "Inter" })] })],
                      }),
                    ],
                  }),
                  ...adquisicion.items.map((it) => {
                    const ft = it.fichaTecnica || {};
                    const carac =
                      it.caracteristicasTecnicas ||
                      (ft.caracteristicasDetalle && ft.caracteristicasDetalle.length > 0
                        ? ft.caracteristicasDetalle.join("\n• ")
                        : "") ||
                      `${ft.material ? `Material: ${ft.material}. ` : ""}${ft.normaCertificacion ? `Norma: ${ft.normaCertificacion}. ` : ""}${ft.dimensiones ? `Dimensiones: ${ft.dimensiones}` : ""}`.trim() ||
                      "Cumplimiento obligatorio de normas de calidad y especificaciones solicitadas";

                    const caracParagraphs = carac
                      .split("\n")
                      .map((line) => line.trim())
                      .filter(Boolean)
                      .map(
                        (line) =>
                          new Paragraph({
                            spacing: { before: 30, after: 30 },
                            children: [new TextRun({ text: line, size: FONT_BODY, font: "Inter" })],
                          })
                      );

                    return new TableRow({
                      children: [
                        new TableCell({ margins: { top: 80, bottom: 80, left: 60, right: 60 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(it.item), bold: true, size: FONT_BODY, font: "Inter" })] })] }),
                        new TableCell({ margins: { top: 80, bottom: 80, left: 80, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: it.descripcion, bold: true, size: FONT_BODY, font: "Inter" })] })] }),
                        new TableCell({ margins: { top: 80, bottom: 80, left: 60, right: 60 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: it.unidad || "PZA", size: FONT_BODY, font: "Inter" })] })] }),
                        new TableCell({ margins: { top: 80, bottom: 80, left: 60, right: 60 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(it.cantidad || 1), size: FONT_BODY, font: "Inter" })] })] }),
                        new TableCell({ margins: { top: 80, bottom: 80, left: 80, right: 80 }, children: caracParagraphs.length > 0 ? caracParagraphs : [new Paragraph({ children: [new TextRun({ text: carac, size: FONT_BODY, font: "Inter" })] })] }),
                      ],
                    });
                  }),
                ],
              });
              return [tablaBienes, new Paragraph({ spacing: { after: 200 } })];
            }

            // FICHAS_DINAMICAS por defecto
            return adquisicion.items.flatMap((it) => {
              const ft = it.fichaTecnica || {};

              let itemImageRun: ImageRun | null = null;
              if (ft.imagenUrl && ft.imagenUrl.startsWith("data:image")) {
                try {
                  const base64Data = ft.imagenUrl.split(",")[1];
                  const imageBuf = Buffer.from(base64Data, "base64");
                  itemImageRun = new ImageRun({
                    type: "png",
                    data: imageBuf,
                    transformation: { width: 180, height: 130 },
                  });
                } catch (err) {
                  console.warn("Could not process item image base64:", err);
                }
              }

              const itemTable = new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: defaultTableBorders,
                rows: [
                  new TableRow({
                    children: [
                      new TableCell({
                        columnSpan: 2,
                        shading: { type: ShadingType.CLEAR, fill: "ECEEF0" },
                        margins: { top: 100, bottom: 100, left: 100, right: 100 },
                        children: [
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [new TextRun({ text: `ESPECIFICACIONES TÉCNICAS - ÍTEM #${it.item}: ${it.descripcion.toUpperCase()}`, bold: true, size: FONT_BODY, font: "Inter" })],
                          }),
                        ],
                      }),
                    ],
                  }),
                  new TableRow({
                    children: [
                      new TableCell({
                        width: { size: 45, type: WidthType.PERCENTAGE },
                        margins: { top: 100, bottom: 100, left: 100, right: 100 },
                        children: [
                          new Paragraph({ children: [new TextRun({ text: "Descripción:", bold: true, size: FONT_BODY, font: "Inter" })] }),
                          new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: `${it.descripcion} (${it.cantidad} ${it.unidad || "PZA"})`, size: FONT_BODY, font: "Inter" })] }),
                          new Paragraph({ children: [new TextRun({ text: "Uso:", bold: true, size: FONT_BODY, font: "Inter" })] }),
                          new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: ft.uso || "Personal Operativo", size: FONT_BODY, font: "Inter" })] }),
                          new Paragraph({ children: [new TextRun({ text: "Norma / Certificación:", bold: true, size: FONT_BODY, font: "Inter" })] }),
                          new Paragraph({
                            spacing: { after: 140 },
                            children: [
                              new TextRun({
                                text: ft.normaCertificacion && ft.normaCertificacion !== "N/A"
                                  ? ft.normaCertificacion
                                  : "Conforme a estándares internacionales de calidad y seguridad industrial (ISO 9001 / IEC / ASTM)",
                                size: FONT_BODY,
                                font: "Inter",
                              }),
                            ],
                          }),
                          new Paragraph({ children: [new TextRun({ text: "3. Imagen / Fotografía:", bold: true, size: FONT_BODY, font: "Inter" })] }),
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            spacing: { before: 100, after: 100 },
                            children: itemImageRun
                              ? [itemImageRun]
                              : [
                                  new TextRun({
                                    text: `[ FOTOGRAFÍA DE ${it.descripcion.toUpperCase()} ]`,
                                    size: FONT_SMALL,
                                    color: ENDE_COLORS.primary,
                                    font: "JetBrains Mono",
                                  }),
                                ],
                          }),
                          new Paragraph({
                            children: [
                              new TextRun({ text: ft.dimensiones ? `• ${ft.dimensiones}` : "", size: FONT_BODY, font: "Inter" }),
                            ],
                          }),
                        ],
                      }),
                      new TableCell({
                        width: { size: 55, type: WidthType.PERCENTAGE },
                        margins: { top: 100, bottom: 100, left: 100, right: 100 },
                        children: [
                          new Paragraph({
                            shading: { type: ShadingType.CLEAR, fill: "F2F4F6" },
                            children: [new TextRun({ text: "CARACTERÍSTICAS TÉCNICAS", bold: true, size: FONT_BODY, font: "Inter" })],
                          }),
                          new Paragraph({
                            spacing: { before: 80 },
                            children: [
                              new TextRun({ text: "1. Material:", bold: true, size: FONT_BODY, font: "Inter" }),
                              new TextRun({ text: ` ${ft.material || "Acero de alta resistencia"}`, size: FONT_BODY, font: "Inter" }),
                            ],
                          }),
                          new Paragraph({
                            children: [
                              new TextRun({ text: "2. Color:", bold: true, size: FONT_BODY, font: "Inter" }),
                              new TextRun({
                                text: ` ${ft.color && ft.color !== "N/A" ? ft.color : "Acabado industrial estándar / Pavonado de alta durabilidad"}`,
                                size: FONT_BODY,
                                font: "Inter",
                              }),
                            ],
                          }),
                          new Paragraph({ spacing: { before: 60 }, children: [new TextRun({ text: "4. Para la aceptación del lote:", bold: true, size: FONT_BODY, font: "Inter" })] }),
                          new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: ft.aceptacionLote || "El personal de ENDE DEORURO, realizara una evaluación preliminar el día de la entrega, en caso de existir observaciones.", size: FONT_BODY, font: "Inter" })] }),
                          new Paragraph({ children: [new TextRun({ text: "5. Categoría:", bold: true, size: FONT_BODY, font: "Inter" }), new TextRun({ text: ` ${ft.categoriaItem || "Herramientas manuales"}`, size: FONT_BODY, font: "Inter" })] }),
                          new Paragraph({ spacing: { before: 60 }, children: [new TextRun({ text: "6. Características:", bold: true, size: FONT_BODY, font: "Inter" })] }),
                          ...(ft.caracteristicasDetalle || [
                            "Cumplimiento con estándares de seguridad industrial para redes de distribución",
                            "Materiales de alta durabilidad y resistencia al desgaste operativo"
                          ]).map(c => new Paragraph({
                            spacing: { after: 40 },
                            children: [new TextRun({ text: `• ${c}`, size: FONT_BODY, font: "Inter" })],
                          })),
                          ft.capacidadCorte ? new Paragraph({ children: [new TextRun({ text: `• ${ft.capacidadCorte}`, size: FONT_BODY, font: "Inter" })] }) : new Paragraph({}),
                          ft.pesoAprox ? new Paragraph({ children: [new TextRun({ text: `• Peso aproximado: ${ft.pesoAprox}`, size: FONT_BODY, font: "Inter" })] }) : new Paragraph({}),
                        ],
                      }),
                    ],
                  }),
                ],
              });

              return [itemTable, new Paragraph({ spacing: { after: 200 } })];
            });
          })(),

          new Paragraph({ children: [new PageBreak()] }),

          // PÁGINA FINAL: CLÁUSULAS INSTITUCIONALES OFICIALES (PUNTOS 4 AL 14 - 12 pt)
          new Paragraph({
            spacing: { before: 100, after: 80 },
            children: [new TextRun({ text: "4.   CALIDAD", bold: true, size: FONT_HEADING, font: "Inter" })],
          }),
          ...formatSectionParagraphs(
            adquisicion.calidad_texto || adquisicion.puntos_14_texto?.[4],
            "Los bienes deberán ser nuevos, de primer uso y fabricados bajo normas de calidad aplicables, o el proponente/laboratorio deberá contar con las acreditaciones y credenciales sanitarias vigentes ante las autoridades competentes."
          ),

          new Paragraph({
            spacing: { before: 60, after: 80 },
            children: [new TextRun({ text: "5.   ÁMBITO DE APLICACIÓN", bold: true, size: FONT_HEADING, font: "Inter" })],
          }),
          ...formatSectionParagraphs(
            adquisicion.ambito_aplicacion || adquisicion.puntos_14_texto?.[5],
            "Personal institucional y áreas operativas/administrativas de la Distribuidora de Electricidad ENDE DEORURO S.A."
          ),

          new Paragraph({
            spacing: { before: 60, after: 80 },
            children: [new TextRun({ text: "6.   MÉTODO DE SELECCIÓN", bold: true, size: FONT_HEADING, font: "Inter" })],
          }),
          ...formatSectionParagraphs(
            adquisicion.metodo_seleccion_texto || adquisicion.metodo_seleccion || adquisicion.puntos_14_texto?.[6],
            "Menor Precio (Art. 31 del Reglamento SBC)."
          ),

          new Paragraph({
            spacing: { before: 60, after: 80 },
            children: [new TextRun({ text: "7.   VIGENCIA DE LA PROPUESTA", bold: true, size: FONT_HEADING, font: "Inter" })],
          }),
          ...formatSectionParagraphs(
            adquisicion.vigencia_propuesta_texto || adquisicion.vigencia_propuesta || adquisicion.puntos_14_texto?.[7],
            "Tendrá una validez mínima de 30 días calendario computables a partir de la fecha de presentación de la propuesta."
          ),

          new Paragraph({
            spacing: { before: 60, after: 80 },
            children: [new TextRun({ text: "8.   CATEGORÍA", bold: true, size: FONT_HEADING, font: "Inter" })],
          }),
          ...formatSectionParagraphs(
            adquisicion.categoria_texto || adquisicion.categoria || adquisicion.puntos_14_texto?.[8],
            "Bienes y Suministros Oficiales / Servicios Ocupacionales."
          ),

          new Paragraph({
            spacing: { before: 60, after: 80 },
            children: [new TextRun({ text: "9.   LUGAR DE ENTREGA", bold: true, size: FONT_HEADING, font: "Inter" })],
          }),
          ...formatSectionParagraphs(
            adquisicion.lugar_entrega || adquisicion.puntos_14_texto?.[9],
            "Instalaciones / Almacén Central de ENDE DEORURO S.A., ubicado en la ciudad de Oruro - Bolivia."
          ),

          new Paragraph({
            spacing: { before: 60, after: 80 },
            children: [new TextRun({ text: "10.   TIEMPO DE ENTREGA", bold: true, size: FONT_HEADING, font: "Inter" })],
          }),
          ...formatSectionParagraphs(
            adquisicion.tiempo_entrega_texto || adquisicion.puntos_14_texto?.[10] || (adquisicion.plazo_entrega_dias ? `Máximo ${adquisicion.plazo_entrega_dias} días calendario computables a partir del día siguiente hábil de la recepción formal de la Orden de Compra.` : undefined),
            "30 días calendario."
          ),

          new Paragraph({
            spacing: { before: 60, after: 80 },
            children: [new TextRun({ text: "11.   FORMA DE ADJUDICACIÓN", bold: true, size: FONT_HEADING, font: "Inter" })],
          }),
          ...formatSectionParagraphs(
            adquisicion.forma_adjudicacion || adquisicion.puntos_14_texto?.[11],
            "Por ítem requerido, formalizada mediante Orden de Compra (Art. 31 SBC)."
          ),

          new Paragraph({
            spacing: { before: 60, after: 80 },
            children: [new TextRun({ text: "12.   PARA LA ACEPTACIÓN DEL LOTE / SERVICIO", bold: true, size: FONT_HEADING, font: "Inter" })],
          }),
          ...formatSectionParagraphs(
            adquisicion.aceptacion_lote || adquisicion.puntos_14_texto?.[12],
            "El personal técnico de ENDE DEORURO realizará una evaluación técnica de conformidad el día de la entrega; en caso de existir observaciones, se hará conocer inmediatamente."
          ),

          new Paragraph({
            spacing: { before: 60, after: 80 },
            children: [new TextRun({ text: "13.   FORMA DE PAGO", bold: true, size: FONT_HEADING, font: "Inter" })],
          }),
          ...formatSectionParagraphs(
            adquisicion.forma_pago_texto || adquisicion.puntos_14_texto?.[13],
            "El pago se realizará contra entrega satisfactoria del producto o servicio, conformidad emitida por ENDE DEORURO S.A. y entrega de la siguiente documentación: Nota de Entrega / Acta de Recepción, Solicitud de Pago y Factura oficial original."
          ),

          new Paragraph({
            spacing: { before: 60, after: 80 },
            children: [new TextRun({ text: "14.   APLICACIÓN DE MULTAS", bold: true, size: FONT_HEADING, font: "Inter" })],
          }),
          ...formatSectionParagraphs(
            adquisicion.multas_texto || adquisicion.puntos_14_texto?.[14] || (adquisicion.multa_diaria_porcentaje ? `Ante el incumplimiento de los plazos y otras condiciones establecidas en la Orden de Compra y Especificaciones Técnicas, se aplicará la multa del ${adquisicion.multa_diaria_porcentaje}% por cada día de retraso injustificado.` : undefined),
            "Multa del 0.25% por cada día de retraso injustificado."
          ),
        ],
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
