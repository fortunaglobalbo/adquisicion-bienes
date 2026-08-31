import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  Packer,
  BorderStyle,
  ImageRun,
} from "docx";
import fs from "fs";
import path from "path";
import { Adquisicion } from "@/types";
import { getFechaCortaActual } from "@/lib/utils/dateUtils";

export async function generateInformeConformidadDocx(
  adquisicion: Adquisicion,
  templateData?: any
): Promise<Buffer> {
  const fecha = adquisicion.informe_conf_fecha || "Oruro, 23 de Julio de 2026";
  const aNombre = adquisicion.informe_conf_a_nombre || "LIC. VICENTE PAUL VEGA RAMIREZ";
  const aCargo =
    adquisicion.informe_conf_a_cargo || "SUPERINTENDENTE DE ADMINISTRACIÓN Y FINANZAS a.i.";
  const deNombre =
    adquisicion.informe_conf_de_nombre || "ING. TATIANA TORRES ANDRADE";
  const deCargo =
    adquisicion.informe_conf_de_cargo || "SUPERVISOR DE SEGURIDAD INDUSTRIAL a.i";

  const procesoTitulo =
    adquisicion.informe_conf_proceso ||
    (adquisicion.titulo_proceso
      ? adquisicion.titulo_proceso.toUpperCase()
      : "SERVICIO DE LIMPIEZA E HIGIENE PARA LAS DEPENDENCIAS DE ENDE ORURO S.A.");

  const antecedentesTexto =
    adquisicion.informe_conf_antecedentes ||
    "En atención y mantenimiento de las condiciones de orden, higiene y limpieza en las instalaciones de la empresa para dar cumplimiento a los estándares operativos y de seguridad industrial.";

  const desarrolloTexto =
    adquisicion.informe_conf_desarrollo ||
    `En este sentido en cumplimiento del Reglamento de Adquisición de Bienes, Construcción de Obras Y Contratación de Servicios, se emite el contrato GG-CTO-26/040014 "${procesoTitulo}" para la empresa MOVICLEAN S.R.L., la cual cumple con las especificaciones técnicas y menor precio que se solicitó en el proceso de adquisición.`;

  const itemsRecepcion =
    adquisicion.informe_conf_items_recepcion && adquisicion.informe_conf_items_recepcion.length > 0
      ? adquisicion.informe_conf_items_recepcion
      : (adquisicion.items && adquisicion.items.length > 0)
      ? adquisicion.items.map((it, idx) => ({
          numero: idx + 1,
          descripcion: it.descripcion || "ITEM O SERVICIO SOLICITADO",
          fecha_recepcion: getFechaCortaActual(),
          observaciones: "Sin observaciones / Servicio prestado a conformidad",
        }))
      : [
          {
            numero: 1,
            descripcion: "SERVICIO DE LIMPIEZA MES DE JUNIO 2026",
            fecha_recepcion: "30/06/2026",
            observaciones: "Sin observaciones / Servicio prestado a conformidad",
          },
        ];

  const conclusionesTexto =
    adquisicion.informe_conf_conclusiones_texto ||
    "De acuerdo a la verificación e inspección realizada al desempeño de las tareas desempeñadas durante el mes de junio de 2026, como unidad solicitante se expresa la entera conformidad respecto a la prestación del servicio señalado. Se concluye que el proveedor cumple satisfactoriamente con las especificaciones técnicas exigidas.";

  // Load logo from disk
  let logoBuffer: Buffer | null = null;
  try {
    const logoPath = path.join(process.cwd(), "public", "logo-ende-deoruro.png");
    if (fs.existsSync(logoPath)) {
      logoBuffer = fs.readFileSync(logoPath);
    }
  } catch (e) {
    console.warn("Could not read logo image for Informe Conformidad:", e);
  }

  const FONT_FAMILY = "Calibri";
  const FONT_TITLE = 26; // 13 pt
  const FONT_SUBTITLE = 22; // 11 pt
  const FONT_BODY = 22; // 11 pt
  const FONT_SMALL = 20; // 10 pt

  const noBorders = {
    top: { style: BorderStyle.NONE },
    bottom: { style: BorderStyle.NONE },
    left: { style: BorderStyle.NONE },
    right: { style: BorderStyle.NONE },
    insideHorizontal: { style: BorderStyle.NONE },
    insideVertical: { style: BorderStyle.NONE },
  };

  const tableBorders = {
    top: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
    left: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
    right: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
    insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
  };

  // Header Table with Logo & Company Title
  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorders,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: logoBuffer
              ? [
                  new Paragraph({
                    children: [
                      new ImageRun({
                        data: logoBuffer,
                        transformation: { width: 140, height: 45 },
                        type: "png",
                      }),
                    ],
                  }),
                ]
              : [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "ENDE DEORURO",
                        bold: true,
                        size: FONT_SUBTITLE,
                        font: FONT_FAMILY,
                      }),
                    ],
                  }),
                ],
          }),
          new TableCell({
            width: { size: 70, type: WidthType.PERCENTAGE },
            borders: noBorders,
            verticalAlign: AlignmentType.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                spacing: { before: 100 },
                children: [
                  new TextRun({
                    text: "DISTRIBUIDORA DE ELECTRICIDAD ENDE DEORURO S.A.",
                    bold: true,
                    size: FONT_SMALL,
                    font: FONT_FAMILY,
                    color: "111827",
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // Recipient / Sender Metadata Table
  const metaTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorders,
    rows: [
      // Row A:
      new TableRow({
        children: [
          new TableCell({
            width: { size: 8, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: [
              new Paragraph({
                children: [new TextRun({ text: "A:", bold: true, size: FONT_BODY, font: FONT_FAMILY })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 47, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: aNombre.toUpperCase(), bold: true, size: FONT_BODY, font: FONT_FAMILY }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 45, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: aCargo.toUpperCase(), bold: true, size: FONT_SMALL, font: FONT_FAMILY }),
                ],
              }),
            ],
          }),
        ],
      }),
      // Row DE:
      new TableRow({
        children: [
          new TableCell({
            width: { size: 8, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: [
              new Paragraph({
                children: [new TextRun({ text: "DE:", bold: true, size: FONT_BODY, font: FONT_FAMILY })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 47, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: deNombre.toUpperCase(), bold: true, size: FONT_BODY, font: FONT_FAMILY }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 45, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: deCargo.toUpperCase(), bold: true, size: FONT_SMALL, font: FONT_FAMILY }),
                ],
              }),
            ],
          }),
        ],
      }),
      // Row LUGAR Y FECHA:
      new TableRow({
        children: [
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "LUGAR Y FECHA:", bold: true, size: FONT_BODY, font: FONT_FAMILY }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 75, type: WidthType.PERCENTAGE },
            borders: noBorders,
            columnSpan: 2,
            children: [
              new Paragraph({
                children: [new TextRun({ text: fecha, size: FONT_BODY, font: FONT_FAMILY })],
              }),
            ],
          }),
        ],
      }),
      // Row PROCESO:
      new TableRow({
        children: [
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "PROCESO:", bold: true, size: FONT_BODY, font: FONT_FAMILY }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 75, type: WidthType.PERCENTAGE },
            borders: noBorders,
            columnSpan: 2,
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: procesoTitulo.toUpperCase(),
                    bold: true,
                    size: FONT_BODY,
                    font: FONT_FAMILY,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // Reception Table
  const tableRows: TableRow[] = [
    new TableRow({
      children: [
        new TableCell({
          width: { size: 8, type: WidthType.PERCENTAGE },
          borders: tableBorders,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: "N°", bold: true, size: FONT_SMALL, font: FONT_FAMILY })],
            }),
          ],
        }),
        new TableCell({
          width: { size: 44, type: WidthType.PERCENTAGE },
          borders: tableBorders,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: "DESCRIPCIÓN DEL BIEN O SERVICIO",
                  bold: true,
                  size: FONT_SMALL,
                  font: FONT_FAMILY,
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 24, type: WidthType.PERCENTAGE },
          borders: tableBorders,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: "FECHA DE RECEPCIÓN\nDEL BIEN O SERVICIO",
                  bold: true,
                  size: FONT_SMALL,
                  font: FONT_FAMILY,
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 24, type: WidthType.PERCENTAGE },
          borders: tableBorders,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: "OBSERVACIONES",
                  bold: true,
                  size: FONT_SMALL,
                  font: FONT_FAMILY,
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  ];

  itemsRecepcion.forEach((it, idx) => {
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({
            width: { size: 8, type: WidthType.PERCENTAGE },
            borders: tableBorders,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: String(it.numero || idx + 1),
                    bold: true,
                    size: FONT_SMALL,
                    font: FONT_FAMILY,
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 44, type: WidthType.PERCENTAGE },
            borders: tableBorders,
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: it.descripcion.toUpperCase(),
                    size: FONT_SMALL,
                    font: FONT_FAMILY,
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 24, type: WidthType.PERCENTAGE },
            borders: tableBorders,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: it.fecha_recepcion,
                    size: FONT_SMALL,
                    font: FONT_FAMILY,
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 24, type: WidthType.PERCENTAGE },
            borders: tableBorders,
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: it.observaciones,
                    size: FONT_SMALL,
                    font: FONT_FAMILY,
                  }),
                ],
              }),
            ],
          }),
        ],
      })
    );
  });

  const receptionTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders,
    rows: tableRows,
  });

  // Solid line divider
  const solidDivider = new Paragraph({
    border: {
      bottom: {
        color: "000000",
        space: 1,
        style: BorderStyle.SINGLE,
        size: 16,
      },
    },
    spacing: { before: 80, after: 140 },
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1000,
              bottom: 1000,
              left: 1200,
              right: 1200,
            },
          },
        },
        children: [
          headerTable,
          new Paragraph({ spacing: { before: 140, after: 40 } }),

          // Title
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "INFORME DE CONFORMIDAD",
                bold: true,
                size: FONT_TITLE,
                font: FONT_FAMILY,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: "(ADQUISICIONES)",
                bold: true,
                size: FONT_SUBTITLE,
                font: FONT_FAMILY,
              }),
            ],
          }),

          // Metadata Table
          metaTable,

          // Solid line divider
          solidDivider,

          // 1. ANTECEDENTES
          new Paragraph({
            spacing: { before: 100, after: 60 },
            children: [
              new TextRun({
                text: "1.  ANTECEDENTES",
                bold: true,
                size: FONT_BODY,
                font: FONT_FAMILY,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 140 },
            children: [
              new TextRun({
                text: antecedentesTexto,
                size: FONT_BODY,
                font: FONT_FAMILY,
              }),
            ],
          }),

          // 2. DESARROLLO
          new Paragraph({
            spacing: { before: 100, after: 60 },
            children: [
              new TextRun({
                text: "2.  DESARROLLO",
                bold: true,
                size: FONT_BODY,
                font: FONT_FAMILY,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 140 },
            children: [
              new TextRun({
                text: desarrolloTexto,
                size: FONT_BODY,
                font: FONT_FAMILY,
              }),
            ],
          }),

          // 3. RECEPCIÓN DE LOS BIENES Y/O SERVICIOS
          new Paragraph({
            spacing: { before: 100, after: 60 },
            children: [
              new TextRun({
                text: "3.  RECEPCIÓN DE LOS BIENES Y/O SERVICIOS",
                bold: true,
                size: FONT_BODY,
                font: FONT_FAMILY,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({
                text: "Se verificó la prestación del servicio / entrega de bienes con el siguiente detalle:",
                size: FONT_BODY,
                font: FONT_FAMILY,
              }),
            ],
          }),
          receptionTable,

          // 4. CONCLUSIONES
          new Paragraph({
            spacing: { before: 160, after: 60 },
            children: [
              new TextRun({
                text: "4.  CONCLUSIONES",
                bold: true,
                size: FONT_BODY,
                font: FONT_FAMILY,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 100 },
            children: [
              new TextRun({
                text: conclusionesTexto,
                size: FONT_BODY,
                font: FONT_FAMILY,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 300 },
            children: [
              new TextRun({
                text: "En cuanto tenemos a bien informar, para los fines consiguientes.",
                size: FONT_BODY,
                font: FONT_FAMILY,
              }),
            ],
          }),

          // Signatures
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 300, after: 400 },
            children: [
              new TextRun({
                text: "Atentamente,",
                size: FONT_BODY,
                font: FONT_FAMILY,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "____________________________________",
                bold: true,
                font: FONT_FAMILY,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: deNombre.toUpperCase(),
                bold: true,
                size: FONT_BODY,
                font: FONT_FAMILY,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: deCargo.toUpperCase(),
                size: FONT_SMALL,
                font: FONT_FAMILY,
              }),
            ],
          }),
        ],
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
