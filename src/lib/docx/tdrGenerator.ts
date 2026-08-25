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

export async function generateTdrDocx(adquisicion: Adquisicion, templateData?: any): Promise<Buffer> {
  const tpl = templateData || {};
  const revision = tpl.versionDoc || adquisicion.revision || "Rev. N° 1";
  const mesAnio = tpl.fechaDoc || adquisicion.mes_anio_documento || "Mayo - 2026";
  const tituloUpper = (tpl.tituloProceso || adquisicion.titulo_proceso || "ADQUISICIÓN DE HERRAMIENTA PARA CUADRILLAS").toUpperCase();
  const elaborado = tpl.firmaNombre || (adquisicion.elaborado_por ? `Ing. ${adquisicion.elaborado_por}` : "Ing. Heydi Canaviri Padilla");
  const elaboradoCargo = tpl.firmaCargo || adquisicion.elaborado_cargo || "SUPERVISORA SEGURIDAD INDUSTRIAL";
  const incluirFirma = tpl.incluirFirmaPortada !== false;
  const revisado = adquisicion.revisado_por || "Heydi Canaviri Padilla";
  const aprobado = adquisicion.aprobado_por || "Lic. Raul Alberto Torrico Gomez";


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

  // Standarized Font Sizes:
  // Body text = 12 pt -> size: 24 in docx half-points
  // Section Titles = 14 pt -> size: 28 in docx half-points
  // Document Main Header = 16 pt -> size: 32 in docx half-points
  const FONT_BODY = 24; // 12pt
  const FONT_HEADING = 28; // 14pt
  const FONT_SMALL = 20; // 10pt

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
                    size: 48,
                    color: ENDE_COLORS.primary,
                    font: "Inter",
                  }),
                ],
          }),

          // Título Portada
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 400, after: 200 },
            children: [
              new TextRun({
                text: "ESPECIFICACIONES TÉCNICAS",
                bold: true,
                size: 32, // 16pt
                color: ENDE_COLORS.primary,
                font: "Inter",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 500 },
            children: [
              new TextRun({
                text: tituloUpper,
                bold: true,
                size: FONT_HEADING, // 14pt
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
          ...(incluirFirma
            ? [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  spacing: { before: 200 },
                  children: [
                    new TextRun({
                      text: `${elaborado}\n${elaboradoCargo}\nDISTRIBUIDORA DE ELECTRICIDAD ENDE DEORURO S.A.`,
                      size: FONT_SMALL,
                      color: ENDE_COLORS.primary,
                      font: "Inter",
                    }),
                  ],
                }),
              ]
            : []),
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
          // PÁGINA 2: CONTENIDO / ÍNDICE (Texto a 12pt)
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 300 },
            children: [
              new TextRun({
                text: "Contenido",
                bold: true,
                size: 28, // 14pt
                font: "Inter",
              }),
            ],
          }),
          new Paragraph({ spacing: { after: 140 }, children: [new TextRun({ text: "1.   ANTECEDENTES ....................................................................................................................... 3", size: FONT_BODY, font: "Inter" })] }),
          new Paragraph({ spacing: { after: 140 }, children: [new TextRun({ text: "2.   JUSTIFICACIÓN / NECESIDAD ................................................................................................. 3", size: FONT_BODY, font: "Inter" })] }),
          new Paragraph({ spacing: { after: 140 }, children: [new TextRun({ text: "3.   ESPECIFICACIÓN TÉCNICA ..................................................................................................... 3", size: FONT_BODY, font: "Inter" })] }),
          new Paragraph({ spacing: { after: 140 }, children: [new TextRun({ text: "4.   CALIDAD ................................................................................................................................. 7", size: FONT_BODY, font: "Inter" })] }),
          new Paragraph({ spacing: { after: 140 }, children: [new TextRun({ text: "5.   MÉTODO DE SELECCIÓN .......................................................................................................... 7", size: FONT_BODY, font: "Inter" })] }),
          new Paragraph({ spacing: { after: 140 }, children: [new TextRun({ text: "6.   VIGENCIA DE LA PROPUESTA .................................................................................................. 7", size: FONT_BODY, font: "Inter" })] }),
          new Paragraph({ spacing: { after: 300 }, children: [new TextRun({ text: "7.   APLICACIÓN DE MULTAS .......................................................................................................... 7", size: FONT_BODY, font: "Inter" })] }),

          new Paragraph({ children: [new PageBreak()] }),

          // PÁGINA 3: ANTECEDENTES Y JUSTIFICACIÓN (12 pt)
          new Paragraph({
            spacing: { before: 100, after: 100 },
            children: [
              new TextRun({ text: "1.   ANTECEDENTES", bold: true, size: FONT_HEADING, font: "Inter" }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 250 },
            children: [
              new TextRun({
                text: adquisicion.antecedentes_texto || "De acuerdo a la legislación vigente, normas y políticas internas se inicia el proceso de adquisición de herramientas y equipos para mantenimiento redes MT, enmarcados en el manual de procedimientos y Reglamento de Adquisición de Bienes, Construcción de Obras y Contratación de Servicios.",
                size: FONT_BODY, // 12 pt
                font: "Inter",
              }),
            ],
          }),

          new Paragraph({
            spacing: { before: 100, after: 100 },
            children: [
              new TextRun({ text: "2.   JUSTIFICACIÓN / NECESIDAD", bold: true, size: FONT_HEADING, font: "Inter" }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 300 },
            children: [
              new TextRun({
                text: adquisicion.justificacion_texto || "Con la adquisición de herramientas de zapa para mantenimiento redes MT, tiene el objetivo de prevenir accidentes que pueden ser producto del uso de herramientas de zapa en mal estado también o a la ausencia de estas herramientas.",
                size: FONT_BODY, // 12 pt
                font: "Inter",
              }),
            ],
          }),

          new Paragraph({
            spacing: { before: 100, after: 180 },
            children: [
              new TextRun({ text: "3.   ESPECIFICACIÓN TÉCNICA", bold: true, size: FONT_HEADING, font: "Inter" }),
            ],
          }),

          // TABLAS DE ESPECIFICACIONES TÉCNICAS POR ÍTEM (Páginas 3 a 6) - 12 pt
          ...adquisicion.items.flatMap((it) => {
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
                    // Columna Izquierda: Descripción, Uso, Norma, Imagen (12 pt)
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

                    // Columna Derecha: Características Técnicas (12 pt)
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
          }),

          new Paragraph({ children: [new PageBreak()] }),

          // PÁGINA 7: CLÁUSULAS INSTITUCIONALES FINALES (12 pt)
          new Paragraph({
            spacing: { before: 100, after: 80 },
            children: [new TextRun({ text: "4.   CALIDAD", bold: true, size: FONT_HEADING, font: "Inter" })],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 160 },
            children: [
              new TextRun({
                text: adquisicion.calidad_texto || "El ofertante deberá presentar un certificado en el cual garantice que las herramientas cumplan con todas las características técnicas y los estándares de calidad de acuerdo a normativa vigente.",
                size: FONT_BODY, // 12 pt
                font: "Inter",
              }),
            ],
          }),

          new Paragraph({
            spacing: { before: 60, after: 80 },
            children: [new TextRun({ text: "5.   CATEGORÍA", bold: true, size: FONT_HEADING, font: "Inter" })],
          }),
          new Paragraph({
            spacing: { after: 160 },
            children: [new TextRun({ text: adquisicion.categoria || "Herramientas.", size: FONT_BODY, font: "Inter" })],
          }),

          new Paragraph({
            spacing: { before: 60, after: 80 },
            children: [new TextRun({ text: "6.   LUGAR DE ENTREGA", bold: true, size: FONT_HEADING, font: "Inter" })],
          }),
          new Paragraph({
            spacing: { after: 160 },
            children: [new TextRun({ text: adquisicion.lugar_entrega || "Almacenes ENDE DEORURO S.A.", size: FONT_BODY, font: "Inter" })],
          }),

          new Paragraph({
            spacing: { before: 60, after: 80 },
            children: [new TextRun({ text: "7.   TIEMPO DE ENTREGA", bold: true, size: FONT_HEADING, font: "Inter" })],
          }),
          new Paragraph({
            spacing: { after: 160 },
            children: [new TextRun({ text: `Máximo ${adquisicion.plazo_entrega_dias || 120} días calendario pudiendo ofertar plazos menores.`, size: FONT_BODY, font: "Inter" })],
          }),

          new Paragraph({
            spacing: { before: 60, after: 80 },
            children: [new TextRun({ text: "8.   FORMA DE ADJUDICACIÓN", bold: true, size: FONT_HEADING, font: "Inter" })],
          }),
          new Paragraph({
            spacing: { after: 160 },
            children: [new TextRun({ text: "Por ítem requerido (Menor Precio - Art. 31 SBC).", size: FONT_BODY, font: "Inter" })],
          }),

          new Paragraph({
            spacing: { before: 60, after: 80 },
            children: [new TextRun({ text: "9.   PARA LA ACEPTACIÓN DEL LOTE", bold: true, size: FONT_HEADING, font: "Inter" })],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 160 },
            children: [
              new TextRun({
                text: "El personal de ENDE DEORURO, realizará una evaluación preliminar el día de la entrega, en caso de existir observaciones, se hará conocer inmediatamente.",
                size: FONT_BODY,
                font: "Inter",
              }),
            ],
          }),

          new Paragraph({
            spacing: { before: 60, after: 80 },
            children: [new TextRun({ text: "10.   FORMA DE PAGO", bold: true, size: FONT_HEADING, font: "Inter" })],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 160 },
            children: [
              new TextRun({
                text: adquisicion.forma_pago_texto || "El pago se realizará contra entrega satisfactoria del producto, conformidad de la Distribuidora de Electricidad ENDE DEORURO S.A. y entrega de la siguiente documentación: Nota de Entrega, Solicitud de Pago y Factura.",
                size: FONT_BODY,
                font: "Inter",
              }),
            ],
          }),

          new Paragraph({
            spacing: { before: 60, after: 80 },
            children: [new TextRun({ text: "11.   APLICACIÓN DE MULTAS", bold: true, size: FONT_HEADING, font: "Inter" })],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 300 },
            children: [
              new TextRun({
                text: `Ante el incumplimiento de los plazos y otras condiciones establecidas de la Orden de compra y especificaciones técnicas, se aplicará la multa del ${adquisicion.multa_diaria_porcentaje || 0.25}% por día de retraso, que se menciona en los Términos y Condiciones.`,
                size: FONT_BODY,
                font: "Inter",
              }),
            ],
          }),
        ],
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
