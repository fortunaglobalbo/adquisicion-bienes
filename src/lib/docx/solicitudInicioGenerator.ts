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
import { ENDE_COLORS } from "./endeTheme";

export async function generateSolicitudInicioDocx(
  adquisicion: Adquisicion,
  justificacionTexto?: string
): Promise<Buffer> {
  const numeroNota = adquisicion.solicitud_inicio_numero || "047/2026";
  const fechaNota = adquisicion.solicitud_inicio_fecha || "Oruro, 26 de mayo de 2026";
  const aNombre = adquisicion.solicitud_inicio_a_nombre || "Lic. Vicente Paul Vega Ramirez";
  const aCargo = adquisicion.solicitud_inicio_a_cargo || "RESPONSABLE DE CONTRATACIONES";
  const viaNombre = adquisicion.solicitud_inicio_via_nombre || "Lic. Raúl Alberto Torrico Gomez";
  const viaCargo = adquisicion.solicitud_inicio_via_cargo || "GERENTE GENERAL";
  const deNombre = adquisicion.solicitud_inicio_de_nombre || "Ing. Heydi Dunya Canaviri Padilla";
  const deCargo = adquisicion.solicitud_inicio_de_cargo || "SUPERVISOR DE SEGURIDAD INDUSTRIAL";
  const objetoNota =
    adquisicion.solicitud_inicio_objeto ||
    `SOLICITUD DE INICIO DEL PROCESO DE COMPRA "${(adquisicion.titulo_proceso || "ADQUISICIÓN DE HERRAMIENTA PARA CUADRILLAS").toUpperCase()}"`;

  const parrafo1 =
    adquisicion.solicitud_inicio_parrafo1 ||
    `Por medio de la presente, me dirijo a su autoridad para solicitar formalmente el inicio del proceso de compra correspondiente al proceso "${(adquisicion.titulo_proceso || "ADQUISICIÓN DE HERRAMIENTA PARA CUADRILLAS").toUpperCase()}".`;

  const parrafo2 =
    adquisicion.solicitud_inicio_parrafo2 ||
    justificacionTexto ||
    "Esta solicitud, se realiza en cumplimiento al Reglamento y Manual de Procedimiento de Adquisiciones de Bienes, construcciones de Obras y Contrataciones de Servicio, adjunto a la presente los documentos de respaldo necesarios para el inicio del proceso de contratación:";

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

  const FONT_BODY = 24; // 12 pt in docx half-points
  const FONT_SMALL = 20; // 10 pt in docx half-points

  const noBorders = {
    top: { style: BorderStyle.NONE },
    bottom: { style: BorderStyle.NONE },
    left: { style: BorderStyle.NONE },
    right: { style: BorderStyle.NONE },
    insideHorizontal: { style: BorderStyle.NONE },
    insideVertical: { style: BorderStyle.NONE },
  };

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
          },
        },
        children: [
          // 1. Logo Oficial & Membrete
          new Paragraph({
            spacing: { after: 60 },
            children: logoBuffer
              ? [
                  new ImageRun({
                    type: "png",
                    data: logoBuffer,
                    transformation: { width: 150, height: 65 },
                  }),
                ]
              : [
                  new TextRun({
                    text: "ENDE DEORURO",
                    bold: true,
                    size: 32,
                    color: ENDE_COLORS.primary,
                    font: "Inter",
                  }),
                ],
          }),
          new Paragraph({
            spacing: { after: 300 },
            children: [
              new TextRun({
                text: "DISTRIBUIDORA DE ELECTRICIDAD ENDE DEORURO S.A.",
                bold: true,
                size: 16,
                color: ENDE_COLORS.grayText,
                font: "Inter",
              }),
            ],
          }),

          // 2. Número y Fecha (en dos columnas sin bordes)
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: noBorders,
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({ text: "No.    ", bold: true, size: FONT_BODY, font: "Inter" }),
                          new TextRun({ text: numeroNota, size: FONT_BODY, font: "Inter" }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        children: [
                          new TextRun({ text: fechaNota, size: FONT_BODY, font: "Inter" }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),

          new Paragraph({ spacing: { after: 200 } }),

          // 3. Bloque de Destinatarios (A / VIA / DE / OBJETO)
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: noBorders,
            rows: [
              // A :
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 18, type: WidthType.PERCENTAGE },
                    children: [new Paragraph({ children: [new TextRun({ text: "A  :", bold: true, size: FONT_BODY, font: "Inter" })] })],
                  }),
                  new TableCell({
                    width: { size: 82, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({ children: [new TextRun({ text: aNombre, size: FONT_BODY, font: "Inter" })] }),
                      new Paragraph({ children: [new TextRun({ text: aCargo, bold: true, size: FONT_BODY, font: "Inter" })] }),
                    ],
                  }),
                ],
              }),
              // Espaciador
              new TableRow({ children: [new TableCell({ children: [new Paragraph({ spacing: { after: 60 } })] }), new TableCell({ children: [new Paragraph({ spacing: { after: 60 } })] })] }),
              // VIA :
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 18, type: WidthType.PERCENTAGE },
                    children: [new Paragraph({ children: [new TextRun({ text: "VIA  :", bold: true, size: FONT_BODY, font: "Inter" })] })],
                  }),
                  new TableCell({
                    width: { size: 82, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({ children: [new TextRun({ text: viaNombre, size: FONT_BODY, font: "Inter" })] }),
                      new Paragraph({ children: [new TextRun({ text: viaCargo, bold: true, size: FONT_BODY, font: "Inter" })] }),
                    ],
                  }),
                ],
              }),
              // Espaciador
              new TableRow({ children: [new TableCell({ children: [new Paragraph({ spacing: { after: 60 } })] }), new TableCell({ children: [new Paragraph({ spacing: { after: 60 } })] })] }),
              // DE :
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 18, type: WidthType.PERCENTAGE },
                    children: [new Paragraph({ children: [new TextRun({ text: "DE  :", bold: true, size: FONT_BODY, font: "Inter" })] })],
                  }),
                  new TableCell({
                    width: { size: 82, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({ children: [new TextRun({ text: deNombre, size: FONT_BODY, font: "Inter" })] }),
                      new Paragraph({ children: [new TextRun({ text: deCargo, bold: true, size: FONT_BODY, font: "Inter" })] }),
                    ],
                  }),
                ],
              }),
              // Espaciador
              new TableRow({ children: [new TableCell({ children: [new Paragraph({ spacing: { after: 60 } })] }), new TableCell({ children: [new Paragraph({ spacing: { after: 60 } })] })] }),
              // OBJETO :
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 18, type: WidthType.PERCENTAGE },
                    children: [new Paragraph({ children: [new TextRun({ text: "OBJETO:", bold: true, size: FONT_BODY, font: "Inter" })] })],
                  }),
                  new TableCell({
                    width: { size: 82, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: objetoNota,
                            bold: true,
                            underline: {},
                            size: FONT_BODY,
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

          // 4. Línea Divisoria Sólida
          new Paragraph({
            border: {
              bottom: { style: BorderStyle.SINGLE, size: 12, color: "000000" },
            },
            spacing: { before: 180, after: 200 },
          }),

          // 5. Cuerpo de la Nota (12 pt)
          new Paragraph({
            spacing: { after: 140 },
            children: [new TextRun({ text: "De mi mayor consideración:", bold: true, size: FONT_BODY, font: "Inter" })],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 160 },
            children: [new TextRun({ text: parrafo1, size: FONT_BODY, font: "Inter" })],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 160 },
            children: [new TextRun({ text: parrafo2, size: FONT_BODY, font: "Inter" })],
          }),

          // 6. Lista de Documentos Adjuntos (Viñetas a 12 pt)
          new Paragraph({
            spacing: { after: 80 },
            indent: { left: 400 },
            children: [
              new TextRun({ text: "•  ", bold: true, size: FONT_BODY }),
              new TextRun({ text: "Formulario S1-N014 de solicitud de Adquisiciones de Bienes, Construcción de Obras o Contratación de Servicios.", size: FONT_BODY, font: "Inter" }),
            ],
          }),
          new Paragraph({
            spacing: { after: 80 },
            indent: { left: 400 },
            children: [
              new TextRun({ text: "•  ", bold: true, size: FONT_BODY }),
              new TextRun({ text: "Cuadro de Justificación de solicitud de compra.", size: FONT_BODY, font: "Inter" }),
            ],
          }),
          new Paragraph({
            spacing: { after: 80 },
            indent: { left: 400 },
            children: [
              new TextRun({ text: "•  ", bold: true, size: FONT_BODY }),
              new TextRun({ text: "Especificaciones Técnicas o Termino de Referencia.", size: FONT_BODY, font: "Inter" }),
            ],
          }),
          new Paragraph({
            spacing: { after: 180 },
            indent: { left: 400 },
            children: [
              new TextRun({ text: "•  ", bold: true, size: FONT_BODY }),
              new TextRun({ text: "Cotizaciones o precio referencial.", size: FONT_BODY, font: "Inter" }),
            ],
          }),

          new Paragraph({
            spacing: { after: 160 },
            children: [new TextRun({ text: "Sin otra particularidad y con las consideraciones del caso, me despido.", size: FONT_BODY, font: "Inter" })],
          }),
          new Paragraph({
            spacing: { after: 400 },
            children: [new TextRun({ text: "Atentamente,", size: FONT_BODY, font: "Inter" })],
          }),

          // 7. Pie de Documento y Espacio Limpio para Sello Físico
          new Paragraph({ spacing: { before: 600 } }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: noBorders,
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({ children: [new TextRun({ text: "Cc. Arch.", size: FONT_SMALL, font: "Inter" })] }),
                      new Paragraph({ children: [new TextRun({ text: "Adj. Lo indicado", size: FONT_SMALL, font: "Inter" })] }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({ spacing: { after: 400 }, children: [] }), // Espacio limpio para firma y sello manual
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
