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

export async function generateInformeConformidadDocx(
  adquisicion: Adquisicion,
  templateData?: any
): Promise<Buffer> {
  const formulario = adquisicion.informe_conf_formulario || "FORMULARIO A6-N014";
  const fecha = adquisicion.informe_conf_fecha || "Oruro, 29 de julio de 2026";
  const cite = adquisicion.informe_conf_cite || "INF.DE ORURO N.º 021/2026";
  const aNombre = adquisicion.informe_conf_a_nombre || "Lic. VICENTE PAUL VEGA RAMIREZ";
  const aCargo = adquisicion.informe_conf_a_cargo || "SUPERINTENDENCIA DE ADMINISTRACIÓN & FINANZAS";
  const viaNombre = adquisicion.informe_conf_via_nombre || "Lic. RAÚL ALBERTO TORRICO GÓMEZ";
  const viaCargo = adquisicion.informe_conf_via_cargo || "GERENTE GENERAL";
  const deNombre = adquisicion.informe_conf_de_nombre || "Ing. TATIANA TORRES ANDRADE";
  const deCargo = adquisicion.informe_conf_de_cargo || "SUPERVISOR SEGURIDAD INDUSTRIAL";

  const procesoTitulo =
    adquisicion.titulo_proceso || "ADQUISICIÓN DE CORREAS DE SUJECIÓN Y AMORTIGUADOR DE IMPACTO";
  const objetoProceso =
    adquisicion.informe_conf_proceso ||
    `REMISIÓN DE INFORME TÉCNICO DE EVALUACIÓN DE COTIZACIONES Y SOLICITUD DE ADJUDICACIÓN - PROCESO "${procesoTitulo.toUpperCase()}" (${adquisicion.solicitud_inicio_numero ? `Solicitud No. ${adquisicion.solicitud_inicio_numero}` : "Solicitud No. 028/2026 S.I."})`;

  const fechaAntecedentes = adquisicion.informe_conf_antecedentes_fecha || "24/06/2026";
  const notaAntecedentes = adquisicion.informe_conf_antecedentes_nota || "Nota No. 057/2026";
  const previsionPrecio =
    adquisicion.informe_conf_prevision_precio ||
    adquisicion.prevision_presupuesto ||
    109000.0;

  // Proponentes
  const proponentes =
    adquisicion.informe_conf_proponentes && adquisicion.informe_conf_proponentes.length > 0
      ? adquisicion.informe_conf_proponentes
      : [
          {
            numero: 1,
            empresa: "MULTI ENERGÍA",
            cotizacion_detalle:
              "Fechas solicitud de cotización: 10/07/2026\nCotización cumple con lo solicitado, de acuerdo a las especificaciones técnicas enviadas",
            precio: "Bs 70.000,00",
            actividad_economica: "No envía NIT",
            cumple_tecnico: true,
            cumple_legal: false,
            es_ganador: false,
            observacion: "No acreditó NIT",
          },
          {
            numero: 2,
            empresa: "HERRACRUZ",
            cotizacion_detalle: "Fechas solicitud de cotización: 10/07/2026\nNo envía cotización.",
            precio: "No envía propuesta",
            actividad_economica: "-",
            cumple_tecnico: false,
            cumple_legal: false,
            es_ganador: false,
            observacion: "No presentó propuesta",
          },
          {
            numero: 3,
            empresa: "ARIOL",
            cotizacion_detalle:
              "Fechas solicitud de cotización: 10/07/2026\nCotización cumple con lo solicitado, de acuerdo a las especificaciones técnicas enviadas",
            precio: "Bs 67.240,00",
            actividad_economica:
              "NIT: 6119531015\nActividad Económica: Comercialización y provisión de bienes",
            cumple_tecnico: true,
            cumple_legal: true,
            es_ganador: true,
            observacion: "Oferta habilitada con menor precio ofertado",
          },
          {
            numero: 4,
            empresa: "FEMCO",
            cotizacion_detalle: "Fechas solicitud de cotización: 10/07/2026\nNo envía cotización.",
            precio: "No envía propuesta",
            actividad_economica: "-",
            cumple_tecnico: false,
            cumple_legal: false,
            es_ganador: false,
            observacion: "No presentó propuesta",
          },
        ];

  const empresaGanadora =
    adquisicion.informe_conf_empresa_ganadora || "ARIOL";
  const montoAdjudicadoNum =
    adquisicion.informe_conf_monto_adjudicado || 67240.0;
  const montoAdjudicadoLit =
    adquisicion.informe_conf_monto_adjudicado_literal ||
    "Sesenta y Siete Mil Doscientos Cuarenta 00/100 Bolivianos";

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

  // Consistent, elegant typography & line spacing
  const FONT_FAMILY = "Calibri";
  const FONT_TITLE = 26; // 13 pt
  const FONT_SUBTITLE = 22; // 11 pt
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
                        size: FONT_SUBTITLE,
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
                    text: formulario,
                    bold: true,
                    size: FONT_SMALL,
                    font: FONT_FAMILY,
                    color: "475467",
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { after: 40, line: LINE_SPACING },
                children: [
                  new TextRun({
                    text: fecha,
                    size: FONT_SMALL,
                    font: FONT_FAMILY,
                    color: "344054",
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { after: 0, line: LINE_SPACING },
                children: [
                  new TextRun({
                    text: cite,
                    bold: true,
                    size: FONT_BODY,
                    font: FONT_FAMILY,
                    color: "003366",
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
                  new TextRun({ text: "VIA:", bold: true, size: FONT_BODY, font: FONT_FAMILY, color: "001E40" }),
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
                  new TextRun({ text: viaNombre, bold: true, size: FONT_BODY, font: FONT_FAMILY, color: "1D2939" }),
                  new TextRun({ text: `\n${viaCargo}`, size: FONT_SMALL, font: FONT_FAMILY, color: "475467" }),
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
                  new TextRun({ text: "De:", bold: true, size: FONT_BODY, font: FONT_FAMILY, color: "001E40" }),
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
                  new TextRun({ text: "PROCESO:", bold: true, size: FONT_BODY, font: FONT_FAMILY, color: "001E40" }),
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
                  new TextRun({ text: objetoProceso, bold: true, size: FONT_BODY, font: FONT_FAMILY, color: "1D2939" }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // 3. Cuadro Comparativo Table Rows (Generous padding & clear borders)
  const comparativoRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          width: { size: 6, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: "001E40" },
          margins: headerCellMargins,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: "N°", bold: true, color: "FFFFFF", size: FONT_SMALL, font: FONT_FAMILY })],
            }),
          ],
        }),
        new TableCell({
          width: { size: 22, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: "001E40" },
          margins: headerCellMargins,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: "Empresa", bold: true, color: "FFFFFF", size: FONT_SMALL, font: FONT_FAMILY })],
            }),
          ],
        }),
        new TableCell({
          width: { size: 34, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: "001E40" },
          margins: headerCellMargins,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: "Cotización", bold: true, color: "FFFFFF", size: FONT_SMALL, font: FONT_FAMILY })],
            }),
          ],
        }),
        new TableCell({
          width: { size: 18, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: "001E40" },
          margins: headerCellMargins,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: "Precio", bold: true, color: "FFFFFF", size: FONT_SMALL, font: FONT_FAMILY })],
            }),
          ],
        }),
        new TableCell({
          width: { size: 20, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: "001E40" },
          margins: headerCellMargins,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: "Actividad Económica / NIT", bold: true, color: "FFFFFF", size: FONT_SMALL, font: FONT_FAMILY })],
            }),
          ],
        }),
      ],
    }),
  ];

  proponentes.forEach((prop, idx) => {
    const isEven = idx % 2 === 1;
    const rowBg = prop.es_ganador ? "ECFDF3" : isEven ? "F9FAFB" : "FFFFFF";

    comparativoRows.push(
      new TableRow({
        children: [
          new TableCell({
            shading: { type: ShadingType.CLEAR, fill: rowBg },
            margins: cellMargins,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: String(prop.numero || idx + 1),
                    bold: true,
                    size: FONT_SMALL,
                    font: FONT_FAMILY,
                    color: "1D2939",
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            shading: { type: ShadingType.CLEAR, fill: rowBg },
            margins: cellMargins,
            children: [
              new Paragraph({
                spacing: { line: LINE_SPACING },
                children: [
                  new TextRun({
                    text: prop.empresa,
                    bold: true,
                    size: FONT_SMALL,
                    font: FONT_FAMILY,
                    color: prop.es_ganador ? "027A48" : "1D2939",
                  }),
                  prop.es_ganador
                    ? new TextRun({
                        text: "\n(OFERTA GANADORA)",
                        bold: true,
                        size: FONT_TINY,
                        font: FONT_FAMILY,
                        color: "027A48",
                      })
                    : new TextRun({ text: "" }),
                ],
              }),
            ],
          }),
          new TableCell({
            shading: { type: ShadingType.CLEAR, fill: rowBg },
            margins: cellMargins,
            children: prop.cotizacion_detalle.split("\n").map(
              (line) =>
                new Paragraph({
                  spacing: { after: 30, line: LINE_SPACING },
                  children: [new TextRun({ text: line, size: FONT_TINY, font: FONT_FAMILY, color: "344054" })],
                })
            ),
          }),
          new TableCell({
            shading: { type: ShadingType.CLEAR, fill: rowBg },
            margins: cellMargins,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text:
                      typeof prop.precio === "number"
                        ? `Bs ${prop.precio.toLocaleString("es-BO", { minimumFractionDigits: 2 })}`
                        : String(prop.precio),
                    bold: true,
                    size: FONT_SMALL,
                    font: FONT_FAMILY,
                    color: prop.es_ganador ? "027A48" : "1D2939",
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            shading: { type: ShadingType.CLEAR, fill: rowBg },
            margins: cellMargins,
            children: prop.actividad_economica.split("\n").map(
              (line) =>
                new Paragraph({
                  spacing: { after: 30, line: LINE_SPACING },
                  children: [new TextRun({ text: line, size: FONT_TINY, font: FONT_FAMILY, color: "475467" })],
                })
            ),
          }),
        ],
      })
    );
  });

  const comparativoTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders,
    rows: comparativoRows,
  });

  // 4. Create Document in Carta Format with generous breathing room
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
          new Paragraph({ spacing: { before: 180, after: 60 } }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 40 },
            children: [
              new TextRun({
                text: "INFORME DE CONFORMIDAD",
                bold: true,
                size: FONT_TITLE,
                font: FONT_FAMILY,
                color: "001E40",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 180 },
            children: [
              new TextRun({
                text: "(CONTRATACIONES)",
                bold: true,
                size: FONT_SUBTITLE,
                font: FONT_FAMILY,
                color: "475467",
              }),
            ],
          }),
          destTable,
          new Paragraph({ spacing: { before: 180, after: 120 } }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 140 },
            children: [
              new TextRun({
                text: "INFORME TÉCNICO DE EVALUACIÓN DE OFERTAS Y CUADRO COMPARATIVO",
                bold: true,
                underline: {},
                size: FONT_BODY,
                font: FONT_FAMILY,
                color: "001E40",
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 100, after: 40 },
            children: [
              new TextRun({ text: "ANTECEDENTES", bold: true, size: FONT_BODY, font: FONT_FAMILY, color: "001E40" }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: PARAGRAPH_SPACING,
            children: [
              new TextRun({
                text: `En fecha ${fechaAntecedentes}, mediante Formulario S1-N014 y ${notaAntecedentes}, el Área Solicitante inició el trámite para la "${procesoTitulo}", con una Previsión de Precio de Bs ${previsionPrecio.toLocaleString("es-BO", { minimumFractionDigits: 2 })} (Categoría I - Art. 31), aprobada por el Responsable de Contratación (Art. 42).`,
                size: FONT_BODY,
                font: FONT_FAMILY,
                color: "1D2939",
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 100, after: 40 },
            children: [
              new TextRun({ text: "RECEPCIÓN DE LAS OFERTAS / BIENES", bold: true, size: FONT_BODY, font: FONT_FAMILY, color: "001E40" }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: PARAGRAPH_SPACING,
            children: [
              new TextRun({
                text: `De acuerdo con el procedimiento regular, el proceso se llevó a cabo mediante la invitación selectiva a ${proponentes.length} proveedores potenciales. En cumplimiento del Artículo 34 y Artículo 7 Inciso v) (Invitación Selectiva), se recibieron las cotizaciones correspondientes al requerimiento.`,
                size: FONT_BODY,
                font: FONT_FAMILY,
                color: "1D2939",
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 100, after: 40 },
            children: [
              new TextRun({ text: "EVALUACIÓN TÉCNICA Y ECONÓMICA (Art. 18, Inciso c - Menor Precio)", bold: true, size: FONT_BODY, font: FONT_FAMILY, color: "001E40" }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: PARAGRAPH_SPACING,
            children: [
              new TextRun({
                text: "Se procedió a la verificación del cumplimiento del 100% de las Especificaciones Técnicas y la validación de la Previsión de Precio (Art. 10 y Art. 25 Inciso l), considerando la presentación de cotización conforme a especificaciones técnicas y documentación tributaria básica (NIT y registro correspondiente). Asimismo, se consideró la experiencia en el rubro evaluada a partir de la actividad económica declarada en el RCN – NIT.",
                size: FONT_BODY,
                font: FONT_FAMILY,
                color: "1D2939",
              }),
            ],
          }),
          new Paragraph({ spacing: { before: 120, after: 120 } }),
          comparativoTable,
          new Paragraph({ spacing: { before: 180, after: 40 } }),
          new Paragraph({
            spacing: { before: 100, after: 40 },
            children: [
              new TextRun({ text: "CONCLUSIONES", bold: true, size: FONT_BODY, font: FONT_FAMILY, color: "001E40" }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { before: 40, after: 80, line: LINE_SPACING },
            children: [
              new TextRun({
                text: `De acuerdo con la evaluación técnica y económica realizada por la unidad solicitante, en marco del Artículo 18 Inciso c) (Método de Selección de Menor Precio) del Reglamento de Adquisición de Bienes, Construcción de Obras y Contratación de Servicios (3ra Versión), se establece:`,
                size: FONT_BODY,
                font: FONT_FAMILY,
                color: "1D2939",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { before: 40, after: 80, line: LINE_SPACING },
            children: [
              new TextRun({ text: `• 1. Adjudicación por Menor Precio: `, bold: true, size: FONT_BODY, font: FONT_FAMILY, color: "001E40" }),
              new TextRun({
                text: `La propuesta presentada por la empresa ${empresaGanadora} resulta GANADORA al haber ofertado el MENOR PRECIO (Bs ${montoAdjudicadoNum.toLocaleString("es-BO", { minimumFractionDigits: 2 })}), haber cumplido al 100% con las Especificaciones Técnicas requeridas, encontrarse dentro de la Previsión de Precio (Bs ${previsionPrecio.toLocaleString("es-BO", { minimumFractionDigits: 2 })}) y haber respaldado adecuadamente su acreditación tributaria y legal.`,
                size: FONT_BODY,
                font: FONT_FAMILY,
                color: "1D2939",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { before: 40, after: 120, line: LINE_SPACING },
            children: [
              new TextRun({ text: `• 2. Descalificaciones / Declinaciones: `, bold: true, size: FONT_BODY, font: FONT_FAMILY, color: "001E40" }),
              new TextRun({
                text: `Las empresas proponentes que no presentaron NIT válido o declinaron su participación dentro del plazo no fueron habilitadas conforme al Reglamento SBC.`,
                size: FONT_BODY,
                font: FONT_FAMILY,
                color: "1D2939",
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 100, after: 40 },
            children: [
              new TextRun({ text: "RECOMENDACIONES", bold: true, size: FONT_BODY, font: FONT_FAMILY, color: "001E40" }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { before: 40, after: 80, line: LINE_SPACING },
            children: [
              new TextRun({
                text: "En virtud a los principios de Economía, Eficiencia y Transparencia (Artículo 6) que rigen a ENDE Oruro S.A.:",
                size: FONT_BODY,
                font: FONT_FAMILY,
                color: "1D2939",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { before: 40, after: 80, line: LINE_SPACING },
            children: [
              new TextRun({ text: "1. Adjudicación Formal: ", bold: true, size: FONT_BODY, font: FONT_FAMILY, color: "001E40" }),
              new TextRun({
                text: `Recomendar al Responsable de Contratación (Artículo 42) proceder con la Adjudicación del proceso "${procesoTitulo}" a favor de la empresa ${empresaGanadora} por el monto total de Bs ${montoAdjudicadoNum.toLocaleString("es-BO", { minimumFractionDigits: 2 })} (${montoAdjudicadoLit}), por constituir la oferta habilitada con el menor precio ofertado.`,
                size: FONT_BODY,
                font: FONT_FAMILY,
                color: "1D2939",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { before: 40, after: 140, line: LINE_SPACING },
            children: [
              new TextRun({ text: "2. Formalización del Trámite: ", bold: true, size: FONT_BODY, font: FONT_FAMILY, color: "001E40" }),
              new TextRun({
                text: "Remitir los antecedentes al Área Administrativa y Financiera a efectos de solicitar la documentación legal complementaria para la posterior emisión de la correspondiente Orden de Compra o Contrato (Artículo 54 y Artículo 63).",
                size: FONT_BODY,
                font: FONT_FAMILY,
                color: "1D2939",
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 100, after: 360, line: LINE_SPACING },
            children: [
              new TextRun({
                text: "Es cuanto puedo informar en honor a la verdad, para los fines consiguientes.",
                size: FONT_BODY,
                font: FONT_FAMILY,
                color: "344054",
                italics: true,
              }),
            ],
          }),
          // Firmas (Spacious and centered)
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: noBorders,
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
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
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    borders: noBorders,
                    margins: { top: 80, bottom: 80, left: 40, right: 40 },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { line: LINE_SPACING },
                        children: [
                          new TextRun({ text: "_____________________________\n", bold: true, size: FONT_BODY, font: FONT_FAMILY, color: "667085" }),
                          new TextRun({ text: viaNombre, bold: true, size: FONT_BODY, font: FONT_FAMILY, color: "1D2939" }),
                          new TextRun({ text: `\n${viaCargo}`, size: FONT_SMALL, font: FONT_FAMILY, color: "475467" }),
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
