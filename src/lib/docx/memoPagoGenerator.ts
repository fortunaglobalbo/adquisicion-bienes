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

export async function generateMemoPagoDocx(
  adquisicion: Adquisicion,
  templateData?: any
): Promise<Buffer> {
  const cite = adquisicion.memo_pago_cite || "GG-SPA-26/070002";
  const fecha = adquisicion.memo_pago_fecha || "Oruro, 23 de Julio de 2026";
  const aNombre = adquisicion.memo_pago_a_nombre || "LIC. VICENTE PAUL VEGA RAMIREZ";
  const aCargo = adquisicion.memo_pago_a_cargo || "SUPERINTENDENTE DE ADMINISTRACIÓN Y FINANZAS a.i.";
  const deNombre = adquisicion.memo_pago_de_nombre || "ING. TATIANA TORRES ANDRADE";
  const deCargo = adquisicion.memo_pago_de_cargo || "SUPERVISOR DE SEGURIDAD INDUSTRIAL a.i.";

  const proveedor =
    adquisicion.memo_pago_proveedor ||
    adquisicion.informe_conf_empresa_ganadora ||
    adquisicion.proveedor_adjudicado ||
    "MOVICLEAN S.R.L.";

  const procesoTitulo =
    adquisicion.titulo_proceso || "SERVICIO DE LIMPIEZA MES DE JUNIO 2026";

  const objeto =
    adquisicion.memo_pago_objeto ||
    `SOLICITUD DE PAGO ${procesoTitulo.toUpperCase()} DE ${proveedor.toUpperCase()}`;

  const nroFactura = adquisicion.memo_pago_nro_factura || "2";
  const montoTotal =
    adquisicion.memo_pago_monto_total ||
    adquisicion.informe_conf_monto_adjudicado ||
    58333.0;

  const montoLiteral =
    adquisicion.memo_pago_monto_literal ||
    "Cincuenta y ocho mil trescientos treinta y tres 00/100 Bolivianos";

  const items =
    adquisicion.memo_pago_items && adquisicion.memo_pago_items.length > 0
      ? adquisicion.memo_pago_items
      : [
          {
            cantidad: "1.00",
            unidad: "Unidad (Servicios)",
            descripcion: procesoTitulo.toUpperCase(),
          },
        ];

  const bancoCite =
    adquisicion.memo_pago_banco_cite_solicitud ||
    "CITE: MOVICLEAN-LIM-ADM-No113/2026";
  const bancoNombre = adquisicion.memo_pago_banco_nombre || "Banco Económico";
  const bancoTitular = adquisicion.memo_pago_banco_titular || proveedor;
  const bancoCuenta = adquisicion.memo_pago_banco_cuenta || "1041-505958";

  const conformidadTexto =
    adquisicion.memo_pago_conformidad_texto ||
    `Así mismo, informamos que el proveedor ${proveedor} ha cumplido satisfactoriamente con la prestación del servicio/adquisición contratado.`;

  // Load logo from disk
  let logoBuffer: Buffer | null = null;
  try {
    const logoPath = path.join(process.cwd(), "public", "logo-ende-deoruro.png");
    if (fs.existsSync(logoPath)) {
      logoBuffer = fs.readFileSync(logoPath);
    }
  } catch (e) {
    console.warn("Could not read logo image for Memo Pago:", e);
  }

  // Consistent, elegant typography & line spacing
  const FONT_FAMILY = "Calibri";
  const FONT_TITLE = 26; // 13 pt
  const FONT_HEADER = 24; // 12 pt
  const FONT_BODY = 22; // 11 pt
  const FONT_SMALL = 19; // 9.5 pt
  const FONT_TINY = 17; // 8.5 pt

  const LINE_SPACING = 276; // 1.15x line spacing (ergonomic reading)
  const PARAGRAPH_SPACING = { before: 80, after: 120, line: LINE_SPACING };

  const noBorders = {
    top: { style: BorderStyle.NONE },
    bottom: { style: BorderStyle.NONE },
    left: { style: BorderStyle.NONE },
    right: { style: BorderStyle.NONE },
    insideHorizontal: { style: BorderStyle.NONE },
    insideVertical: { style: BorderStyle.NONE },
  };

  const tableBorders = {
    top: { style: BorderStyle.SINGLE, size: 6, color: "001E40" },
    bottom: { style: BorderStyle.SINGLE, size: 6, color: "001E40" },
    left: { style: BorderStyle.SINGLE, size: 6, color: "D0D5DD" },
    right: { style: BorderStyle.SINGLE, size: 6, color: "D0D5DD" },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "E4E7EC" },
    insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "E4E7EC" },
  };

  const cellMargins = {
    top: 140,
    bottom: 140,
    left: 160,
    right: 160,
  };

  const headerCellMargins = {
    top: 160,
    bottom: 160,
    left: 160,
    right: 160,
  };

  // 1. Header Table with Logo and Titles
  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorders,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 35, type: WidthType.PERCENTAGE },
            borders: noBorders,
            margins: { top: 60, bottom: 60, left: 0, right: 100 },
            children: logoBuffer
              ? [
                  new Paragraph({
                    children: [
                      new ImageRun({
                        data: logoBuffer,
                        transformation: { width: 145, height: 50 },
                        type: "png",
                      }),
                    ],
                  }),
                ]
              : [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "ENDE DEORURO S.A.",
                        bold: true,
                        size: FONT_HEADER,
                        color: "001E40",
                        font: FONT_FAMILY,
                      }),
                    ],
                  }),
                ],
          }),
          new TableCell({
            width: { size: 65, type: WidthType.PERCENTAGE },
            borders: noBorders,
            margins: { top: 60, bottom: 60, left: 100, right: 0 },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { after: 40, line: LINE_SPACING },
                children: [
                  new TextRun({
                    text: "DISTRIBUIDORA DE ELECTRICIDAD ENDE DEORURO S.A.",
                    bold: true,
                    size: FONT_SMALL,
                    font: FONT_FAMILY,
                    color: "001E40",
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { after: 40, line: LINE_SPACING },
                children: [
                  new TextRun({
                    text: `No. ${cite}`,
                    bold: true,
                    size: FONT_BODY,
                    font: FONT_FAMILY,
                    color: "003366",
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { after: 0, line: LINE_SPACING },
                children: [
                  new TextRun({
                    text: fecha,
                    size: FONT_SMALL,
                    font: FONT_FAMILY,
                    color: "475467",
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // 2. Destinatarios Table (Spacious and clear)
  const destTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorders,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 14, type: WidthType.PERCENTAGE },
            borders: noBorders,
            margins: { top: 80, bottom: 80, left: 0, right: 60 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "A:", bold: true, size: FONT_BODY, font: FONT_FAMILY, color: "001E40" }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 86, type: WidthType.PERCENTAGE },
            borders: noBorders,
            margins: { top: 80, bottom: 80, left: 0, right: 0 },
            children: [
              new Paragraph({
                spacing: { after: 40, line: LINE_SPACING },
                children: [
                  new TextRun({ text: aNombre, bold: true, size: FONT_BODY, font: FONT_FAMILY, color: "1D2939" }),
                  new TextRun({ text: `\n${aCargo}`, size: FONT_SMALL, font: FONT_FAMILY, color: "475467" }),
                ],
              }),
            ],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            width: { size: 14, type: WidthType.PERCENTAGE },
            borders: noBorders,
            margins: { top: 80, bottom: 80, left: 0, right: 60 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "DE:", bold: true, size: FONT_BODY, font: FONT_FAMILY, color: "001E40" }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 86, type: WidthType.PERCENTAGE },
            borders: noBorders,
            margins: { top: 80, bottom: 80, left: 0, right: 0 },
            children: [
              new Paragraph({
                spacing: { after: 40, line: LINE_SPACING },
                children: [
                  new TextRun({ text: deNombre, bold: true, size: FONT_BODY, font: FONT_FAMILY, color: "1D2939" }),
                  new TextRun({ text: `\n${deCargo}`, size: FONT_SMALL, font: FONT_FAMILY, color: "475467" }),
                ],
              }),
            ],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            width: { size: 14, type: WidthType.PERCENTAGE },
            borders: noBorders,
            margins: { top: 80, bottom: 80, left: 0, right: 60 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "OBJETO:", bold: true, size: FONT_BODY, font: FONT_FAMILY, color: "001E40" }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 86, type: WidthType.PERCENTAGE },
            borders: noBorders,
            margins: { top: 80, bottom: 80, left: 0, right: 0 },
            children: [
              new Paragraph({
                spacing: { line: LINE_SPACING },
                children: [
                  new TextRun({ text: objeto, bold: true, size: FONT_BODY, font: FONT_FAMILY, color: "1D2939" }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // 3. Items Table (Padding and neat colors)
  const itemsRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          width: { size: 15, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: "001E40" },
          margins: headerCellMargins,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: "CANT.", bold: true, color: "FFFFFF", size: FONT_SMALL, font: FONT_FAMILY })],
            }),
          ],
        }),
        new TableCell({
          width: { size: 25, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: "001E40" },
          margins: headerCellMargins,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: "UNIDAD", bold: true, color: "FFFFFF", size: FONT_SMALL, font: FONT_FAMILY })],
            }),
          ],
        }),
        new TableCell({
          width: { size: 60, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: "001E40" },
          margins: headerCellMargins,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: "DESCRIPCIÓN", bold: true, color: "FFFFFF", size: FONT_SMALL, font: FONT_FAMILY })],
            }),
          ],
        }),
      ],
    }),
  ];

  items.forEach((it, idx) => {
    const isEven = idx % 2 === 1;
    const rowBg = isEven ? "F9FAFB" : "FFFFFF";
    itemsRows.push(
      new TableRow({
        children: [
          new TableCell({
            shading: { type: ShadingType.CLEAR, fill: rowBg },
            margins: cellMargins,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: String(it.cantidad), bold: true, size: FONT_BODY, font: FONT_FAMILY, color: "1D2939" })],
              }),
            ],
          }),
          new TableCell({
            shading: { type: ShadingType.CLEAR, fill: rowBg },
            margins: cellMargins,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: it.unidad, size: FONT_BODY, font: FONT_FAMILY, color: "475467" })],
              }),
            ],
          }),
          new TableCell({
            shading: { type: ShadingType.CLEAR, fill: rowBg },
            margins: cellMargins,
            children: [
              new Paragraph({
                spacing: { line: LINE_SPACING },
                children: [new TextRun({ text: it.descripcion, bold: true, size: FONT_BODY, font: FONT_FAMILY, color: "1D2939" })],
              }),
            ],
          }),
        ],
      })
    );
  });

  const itemsTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders,
    rows: itemsRows,
  });

  // 4. Create Document in Carta Format
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 }, // Tamaño Carta (Letter: 8.5" x 11")
            margin: {
              top: 1440,
              bottom: 1440,
              left: 1440,
              right: 1440,
            },
          },
        },
        children: [
          headerTable,
          new Paragraph({ spacing: { before: 200, after: 120 } }),
          destTable,
          new Paragraph({ spacing: { before: 200, after: 120 } }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { before: 80, after: 160, line: LINE_SPACING },
            children: [
              new TextRun({
                text: `Solicitamos instruir el pago de la Factura N° ${nroFactura} al proveedor `,
                size: FONT_BODY,
                font: FONT_FAMILY,
                color: "1D2939",
              }),
              new TextRun({
                text: proveedor,
                bold: true,
                size: FONT_BODY,
                font: FONT_FAMILY,
                color: "001E40",
              }),
              new TextRun({
                text: ` por un monto total de `,
                size: FONT_BODY,
                font: FONT_FAMILY,
                color: "1D2939",
              }),
              new TextRun({
                text: `Bs ${montoTotal.toLocaleString("es-BO", { minimumFractionDigits: 2 })} (${montoLiteral})`,
                bold: true,
                size: FONT_BODY,
                font: FONT_FAMILY,
                color: "001E40",
              }),
              new TextRun({
                text: `, por el concepto de:`,
                size: FONT_BODY,
                font: FONT_FAMILY,
                color: "1D2939",
              }),
            ],
          }),
          itemsTable,
          new Paragraph({ spacing: { before: 200, after: 100 } }),
          new Paragraph({
            spacing: { before: 80, after: 60, line: LINE_SPACING },
            children: [
              new TextRun({
                text: `Datos Bancarios para Transferencia (solicitados mediante ${bancoCite}):`,
                bold: true,
                size: FONT_BODY,
                font: FONT_FAMILY,
                color: "001E40",
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 40, after: 40, line: LINE_SPACING },
            children: [
              new TextRun({ text: "• Entidad Bancaria: ", bold: true, size: FONT_BODY, font: FONT_FAMILY, color: "001E40" }),
              new TextRun({ text: bancoNombre, size: FONT_BODY, font: FONT_FAMILY, color: "1D2939" }),
            ],
          }),
          new Paragraph({
            spacing: { before: 40, after: 40, line: LINE_SPACING },
            children: [
              new TextRun({ text: "• Titular de la Cuenta: ", bold: true, size: FONT_BODY, font: FONT_FAMILY, color: "001E40" }),
              new TextRun({ text: bancoTitular, size: FONT_BODY, font: FONT_FAMILY, color: "1D2939" }),
            ],
          }),
          new Paragraph({
            spacing: { before: 40, after: 140, line: LINE_SPACING },
            children: [
              new TextRun({ text: "• Número de Cuenta: ", bold: true, size: FONT_BODY, font: FONT_FAMILY, color: "001E40" }),
              new TextRun({ text: bancoCuenta, bold: true, size: FONT_BODY, font: FONT_FAMILY, color: "003366" }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { before: 100, after: 140, line: LINE_SPACING },
            children: [
              new TextRun({
                text: conformidadTexto,
                size: FONT_BODY,
                font: FONT_FAMILY,
                color: "1D2939",
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 80, after: 100, line: LINE_SPACING },
            children: [
              new TextRun({
                text: "En cuanto tenemos a bien informar, para los fines consiguientes.",
                size: FONT_BODY,
                font: FONT_FAMILY,
                color: "475467",
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 120, after: 360, line: LINE_SPACING },
            children: [
              new TextRun({
                text: "Atentamente,",
                size: FONT_BODY,
                font: FONT_FAMILY,
                color: "1D2939",
                bold: true,
              }),
            ],
          }),
          // Firma
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: noBorders,
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    borders: noBorders,
                    margins: { top: 80, bottom: 80, left: 40, right: 40 },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { line: LINE_SPACING },
                        children: [
                          new TextRun({ text: "_____________________________\n", bold: true, size: FONT_BODY, font: FONT_FAMILY, color: "667085" }),
                          new TextRun({ text: deNombre, bold: true, size: FONT_BODY, font: FONT_FAMILY, color: "1D2939" }),
                          new TextRun({ text: `\n${deCargo}`, size: FONT_SMALL, font: FONT_FAMILY, color: "475467" }),
                        ],
                      }),
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
