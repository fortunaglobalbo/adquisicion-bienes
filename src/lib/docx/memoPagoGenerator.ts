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

  const FONT_HEADER = 24; // 12 pt
  const FONT_BODY = 22; // 11 pt
  const FONT_SMALL = 20; // 10 pt
  const FONT_TINY = 18; // 9 pt

  const noBorders = {
    top: { style: BorderStyle.NONE },
    bottom: { style: BorderStyle.NONE },
    left: { style: BorderStyle.NONE },
    right: { style: BorderStyle.NONE },
    insideHorizontal: { style: BorderStyle.NONE },
    insideVertical: { style: BorderStyle.NONE },
  };

  const tableBorders = {
    top: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
    bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
    left: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
    right: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
    insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
  };

  // Header Table with Logo and Titles
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
                        transformation: { width: 140, height: 48 },
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
                        color: "003366",
                        font: "Arial",
                      }),
                    ],
                  }),
                ],
          }),
          new TableCell({
            width: { size: 70, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: "DISTRIBUIDORA DE ELECTRICIDAD ENDE DEORURO S.A.",
                    bold: true,
                    size: FONT_SMALL,
                    font: "Arial",
                    color: "001E40",
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: `No. ${cite}`,
                    bold: true,
                    size: FONT_SMALL,
                    font: "Arial",
                    color: "003366",
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: fecha,
                    size: FONT_SMALL,
                    font: "Arial",
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // Table of Destinatarios
  const destTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorders,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 12, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: [new Paragraph({ children: [new TextRun({ text: "A:", bold: true, size: FONT_BODY, font: "Arial" })] })],
          }),
          new TableCell({
            width: { size: 88, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: aNombre, bold: true, size: FONT_BODY, font: "Arial" }),
                  new TextRun({ text: `\n${aCargo}`, size: FONT_SMALL, font: "Arial" }),
                ],
              }),
            ],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            width: { size: 12, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: [new Paragraph({ children: [new TextRun({ text: "DE:", bold: true, size: FONT_BODY, font: "Arial" })] })],
          }),
          new TableCell({
            width: { size: 88, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: deNombre, bold: true, size: FONT_BODY, font: "Arial" }),
                  new TextRun({ text: `\n${deCargo}`, size: FONT_SMALL, font: "Arial" }),
                ],
              }),
            ],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            width: { size: 12, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: [new Paragraph({ children: [new TextRun({ text: "OBJETO:", bold: true, size: FONT_BODY, font: "Arial" })] })],
          }),
          new TableCell({
            width: { size: 88, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: objeto, bold: true, size: FONT_BODY, font: "Arial" }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // Table of Items
  const itemsRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          width: { size: 15, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: "001E40" },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "CANT.", bold: true, color: "FFFFFF", size: FONT_TINY, font: "Arial" })] })],
        }),
        new TableCell({
          width: { size: 25, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: "001E40" },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "UNIDAD", bold: true, color: "FFFFFF", size: FONT_TINY, font: "Arial" })] })],
        }),
        new TableCell({
          width: { size: 60, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: "001E40" },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "DESCRIPCIÓN", bold: true, color: "FFFFFF", size: FONT_TINY, font: "Arial" })] })],
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
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(it.cantidad), size: FONT_SMALL, font: "Arial" })] })],
          }),
          new TableCell({
            shading: { type: ShadingType.CLEAR, fill: rowBg },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: it.unidad, size: FONT_SMALL, font: "Arial" })] })],
          }),
          new TableCell({
            shading: { type: ShadingType.CLEAR, fill: rowBg },
            children: [new Paragraph({ children: [new TextRun({ text: it.descripcion, bold: true, size: FONT_SMALL, font: "Arial" })] })],
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
          new Paragraph({ spacing: { before: 300, after: 200 } }),
          destTable,
          new Paragraph({ spacing: { before: 300, after: 150 } }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: `Solicitamos instruir el pago de la Factura N° ${nroFactura} al proveedor `,
                size: FONT_BODY,
                font: "Arial",
              }),
              new TextRun({
                text: proveedor,
                bold: true,
                size: FONT_BODY,
                font: "Arial",
              }),
              new TextRun({
                text: ` por un monto total de `,
                size: FONT_BODY,
                font: "Arial",
              }),
              new TextRun({
                text: `Bs ${montoTotal.toLocaleString("es-BO", { minimumFractionDigits: 2 })} (${montoLiteral})`,
                bold: true,
                size: FONT_BODY,
                font: "Arial",
              }),
              new TextRun({
                text: `, por el concepto de:`,
                size: FONT_BODY,
                font: "Arial",
              }),
            ],
          }),
          itemsTable,
          new Paragraph({ spacing: { before: 250, after: 100 } }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Datos Bancarios para Transferencia (solicitados mediante ${bancoCite}):`,
                bold: true,
                size: FONT_BODY,
                font: "Arial",
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 60, after: 40 },
            children: [
              new TextRun({ text: "• Entidad Bancaria: ", bold: true, size: FONT_BODY, font: "Arial" }),
              new TextRun({ text: bancoNombre, size: FONT_BODY, font: "Arial" }),
            ],
          }),
          new Paragraph({
            spacing: { before: 40, after: 40 },
            children: [
              new TextRun({ text: "• Titular de la Cuenta: ", bold: true, size: FONT_BODY, font: "Arial" }),
              new TextRun({ text: bancoTitular, size: FONT_BODY, font: "Arial" }),
            ],
          }),
          new Paragraph({
            spacing: { before: 40, after: 150 },
            children: [
              new TextRun({ text: "• Número de Cuenta: ", bold: true, size: FONT_BODY, font: "Arial" }),
              new TextRun({ text: bancoCuenta, size: FONT_BODY, font: "Arial" }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { before: 150, after: 150 },
            children: [
              new TextRun({
                text: conformidadTexto,
                size: FONT_BODY,
                font: "Arial",
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 150, after: 100 },
            children: [
              new TextRun({
                text: "En cuanto tenemos a bien informar, para los fines consiguientes.",
                size: FONT_BODY,
                font: "Arial",
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 200, after: 600 },
            children: [
              new TextRun({
                text: "Atentamente,",
                size: FONT_BODY,
                font: "Arial",
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
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: "_____________________________\n", bold: true, size: FONT_BODY, font: "Arial" }),
                          new TextRun({ text: deNombre, bold: true, size: FONT_BODY, font: "Arial" }),
                          new TextRun({ text: `\n${deCargo}`, size: FONT_SMALL, font: "Arial" }),
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
