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
  ShadingType,
} from "docx";
import fs from "fs";
import path from "path";
import { Adquisicion } from "@/types";
import { ENDE_COLORS } from "./endeTheme";

export async function generateFormS2Docx(adquisicion: Adquisicion): Promise<Buffer> {
  const fechaSolicitud = adquisicion.form_s2_fecha_solicitud || "19/06/2026";
  const senores = adquisicion.form_s2_senores || "ARIOL IMPORT";
  const tiempoEntrega = adquisicion.form_s2_tiempo_entrega || "____________________";
  const validezOferta = adquisicion.form_s2_validez_oferta || "____________________";
  const observaciones = adquisicion.form_s2_observaciones || "SE ADJUNTA ESPECIFICACIONES TECNICAS";
  const notaAdicional = adquisicion.form_s2_nota_adicional || "ADJUNTAR FOTOCOPIA SIMPLE DE SU RNC - NIT";

  const items = adquisicion.items || [];

  // Load logo from disk
  let logoBuffer: Buffer | null = null;
  try {
    const logoPath = path.join(process.cwd(), "public", "logo-ende-deoruro.png");
    if (fs.existsSync(logoPath)) {
      logoBuffer = fs.readFileSync(logoPath);
    }
  } catch (e) {
    console.warn("Could not read logo image for Form S2:", e);
  }

  const FONT_BODY = 24; // 12 pt
  const FONT_SMALL = 20; // 10 pt
  const FONT_TINY = 16; // 8 pt

  const noBorders = {
    top: { style: BorderStyle.NONE },
    bottom: { style: BorderStyle.NONE },
    left: { style: BorderStyle.NONE },
    right: { style: BorderStyle.NONE },
    insideHorizontal: { style: BorderStyle.NONE },
    insideVertical: { style: BorderStyle.NONE },
  };

  const gridBorders = {
    top: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
    bottom: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
    left: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
    right: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
    insideVertical: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
  };

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1000, bottom: 1000, left: 1200, right: 1200 },
          },
        },
        children: [
          // 1. Membrete Institucional (Logo a la izquierda, contacto a la derecha)
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: noBorders,
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 40, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({
                        children: logoBuffer
                          ? [
                              new ImageRun({
                                type: "png",
                                data: logoBuffer,
                                transformation: { width: 140, height: 60 },
                              }),
                            ]
                          : [
                              new TextRun({
                                text: "ENDE DEORURO",
                                bold: true,
                                size: 28,
                                color: ENDE_COLORS.primary,
                                font: "Inter",
                              }),
                            ],
                      }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 60, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        children: [
                          new TextRun({
                            text: "DISTRIBUIDORA DE ELECTRICIDAD ENDE DEORURO S.A.\n",
                            bold: true,
                            size: FONT_SMALL,
                            font: "Inter",
                          }),
                          new TextRun({
                            text: "Teléfono: 5252233  Fax: 5113434  Casilla 53  NIT 1009769021",
                            size: FONT_TINY,
                            color: ENDE_COLORS.grayText,
                            font: "Inter",
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),

          // 2. Título Oficial
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 40 },
            children: [
              new TextRun({
                text: "SOLICITUD DE COTIZACION",
                bold: true,
                size: 28, // 14 pt
                font: "Inter",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: "FORMULARIO S2-N014",
                bold: true,
                size: FONT_BODY, // 12 pt
                font: "Inter",
              }),
            ],
          }),

          // 3. Datos de Solicitud (Fecha, Señor(es), Texto de cortesía)
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({ text: "Fecha de Solicitud:       ", size: FONT_BODY, font: "Inter" }),
              new TextRun({ text: fechaSolicitud, size: FONT_BODY, font: "Inter" }),
            ],
          }),
          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun({ text: "Señor (es):                ", size: FONT_BODY, font: "Inter" }),
              new TextRun({ text: senores, bold: true, size: FONT_BODY, font: "Inter" }),
            ],
          }),
          new Paragraph({
            spacing: { after: 160 },
            children: [
              new TextRun({ text: "Por favor cotizar los siguientes bienes/obras/servicios:", size: FONT_BODY, font: "Inter" }),
            ],
          }),

          // 4. Tabla Oficial de Ítems (Bordes negros nítidos)
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: gridBorders,
            rows: [
              // Encabezado de tabla
              new TableRow({
                tableHeader: true,
                children: [
                  new TableCell({
                    width: { size: 6, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: "F0F0F0" },
                    margins: { top: 80, bottom: 80, left: 60, right: 60 },
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "N°", bold: true, size: FONT_SMALL, font: "Inter" })] })],
                  }),
                  new TableCell({
                    width: { size: 12, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: "F0F0F0" },
                    margins: { top: 80, bottom: 80, left: 60, right: 60 },
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "CANTIDAD", bold: true, size: FONT_SMALL, font: "Inter" })] })],
                  }),
                  new TableCell({
                    width: { size: 12, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: "F0F0F0" },
                    margins: { top: 80, bottom: 80, left: 60, right: 60 },
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "UNIDAD", bold: true, size: FONT_SMALL, font: "Inter" })] })],
                  }),
                  new TableCell({
                    width: { size: 42, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: "F0F0F0" },
                    margins: { top: 80, bottom: 80, left: 80, right: 80 },
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "DESCRIPCION", bold: true, size: FONT_SMALL, font: "Inter" })] })],
                  }),
                  new TableCell({
                    width: { size: 14, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: "F0F0F0" },
                    margins: { top: 80, bottom: 80, left: 60, right: 60 },
                    children: [
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "PRECIO\nUNITARIO", bold: true, size: FONT_SMALL, font: "Inter" })] }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 14, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: "F0F0F0" },
                    margins: { top: 80, bottom: 80, left: 60, right: 60 },
                    children: [
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "PRECIO\nTOTAL", bold: true, size: FONT_SMALL, font: "Inter" })] }),
                    ],
                  }),
                ],
              }),
              // Filas de ítems
              ...items.map((it, idx) => {
                return new TableRow({
                  children: [
                    new TableCell({
                      margins: { top: 100, bottom: 100, left: 60, right: 60 },
                      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: (it.item || idx + 1).toString(), bold: true, size: FONT_SMALL, font: "Inter" })] })],
                    }),
                    new TableCell({
                      margins: { top: 100, bottom: 100, left: 60, right: 60 },
                      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: it.cantidad.toString(), bold: true, size: FONT_SMALL, font: "Inter" })] })],
                    }),
                    new TableCell({
                      margins: { top: 100, bottom: 100, left: 60, right: 60 },
                      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: (it.unidad || "PZA").toUpperCase(), size: FONT_SMALL, font: "Inter" })] })],
                    }),
                    new TableCell({
                      margins: { top: 100, bottom: 100, left: 80, right: 80 },
                      children: [new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: it.descripcion.toUpperCase(), size: FONT_SMALL, font: "Inter" })] })],
                    }),
                    new TableCell({
                      margins: { top: 100, bottom: 100, left: 60, right: 60 },
                      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "", size: FONT_SMALL, font: "Inter" })] })],
                    }),
                    new TableCell({
                      margins: { top: 100, bottom: 100, left: 60, right: 60 },
                      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "", size: FONT_SMALL, font: "Inter" })] })],
                    }),
                  ],
                });
              }),
              // Fila Total
              new TableRow({
                children: [
                  new TableCell({ columnSpan: 4, children: [new Paragraph({})] }),
                  new TableCell({
                    margins: { top: 80, bottom: 80, left: 60, right: 60 },
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "TOTAL (Bs)", bold: true, size: FONT_SMALL, font: "Inter" })] })],
                  }),
                  new TableCell({ children: [new Paragraph({})] }),
                ],
              }),
            ],
          }),

          // 5. Condiciones y Observaciones
          new Paragraph({ spacing: { before: 240, after: 80 }, children: [new TextRun({ text: `Tiempo de entrega :  ${tiempoEntrega}`, size: FONT_BODY, font: "Inter" })] }),
          new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: `Validez de la Oferta :  ${validezOferta}`, size: FONT_BODY, font: "Inter" })] }),
          new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: `OBSERVACIONES: ${observaciones}`, bold: true, size: FONT_BODY, font: "Inter" })] }),
          new Paragraph({ spacing: { after: 300 }, children: [new TextRun({ text: notaAdicional, bold: true, size: FONT_BODY, font: "Inter" })] }),

          // 6. Pie de Firma y Sello del Proveedor
          new Paragraph({ spacing: { before: 400 } }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: noBorders,
            rows: [
              new TableRow({
                children: [
                  new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [new Paragraph({})] }),
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: "____________________________________\n", bold: true, size: FONT_SMALL, font: "Inter" }),
                          new TextRun({ text: "Sello y Firma Proveedor\n\n", size: FONT_SMALL, font: "Inter" }),
                          new TextRun({ text: "Fecha de Cotizacion: ____________________", size: FONT_SMALL, font: "Inter" }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),

          // 7. Nota Legal al Pie
          new Paragraph({
            border: { top: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" } },
            spacing: { before: 300, after: 60 },
            children: [
              new TextRun({
                text: "NOTA: El presente registro no compromete una acción de compra de parte de la Distribuidora de Electricidad ENDE DEORURO S.A.",
                size: FONT_TINY,
                color: ENDE_COLORS.grayText,
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
