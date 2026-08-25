// Configuración de Estilos y Colores Institucionales ENDE Deoruro para docx v9.6.1
import { BorderStyle, ITableCellOptions, TableCell, Paragraph, TextRun, AlignmentType, HeadingLevel, ShadingType } from "docx";

export const ENDE_COLORS = {
  primary: "001E40",       // Azul Institucional Profundo
  primaryLight: "003366",  // Azul Primario Contenedor
  secondary: "FEB316",     // Amarillo Energía
  darkText: "191C1E",      // Texto Principal
  grayText: "43474F",      // Texto Secundario
  tableHeaderBg: "001E40", // Fondo Cabecera de Tablas
  tableHeaderAlt: "003366",
  tableRowAlt: "F2F4F6",   // Fondo filas alternas
  tableBorder: "C3C6D1",   // Borde de tablas
  white: "FFFFFF",
};

export const defaultTableBorders = {
  top: { style: BorderStyle.SINGLE, size: 4, color: ENDE_COLORS.tableBorder },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: ENDE_COLORS.tableBorder },
  left: { style: BorderStyle.SINGLE, size: 4, color: ENDE_COLORS.tableBorder },
  right: { style: BorderStyle.SINGLE, size: 4, color: ENDE_COLORS.tableBorder },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: ENDE_COLORS.tableBorder },
  insideVertical: { style: BorderStyle.SINGLE, size: 2, color: ENDE_COLORS.tableBorder },
};

export function createHeaderCell(
  text: string,
  widthPercent?: number,
  alignment: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.CENTER
): TableCell {
  return new TableCell({
    shading: {
      type: ShadingType.CLEAR,
      fill: ENDE_COLORS.tableHeaderBg,
    },
    margins: {
      top: 120,
      bottom: 120,
      left: 140,
      right: 140,
    },
    children: [
      new Paragraph({
        alignment,
        children: [
          new TextRun({
            text,
            bold: true,
            color: ENDE_COLORS.white,
            size: 19, // 9.5pt
            font: "Inter",
          }),
        ],
      }),
    ],
  });
}

export function createDataCell(
  text: string,
  isAlt = false,
  alignment: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT,
  bold = false,
  color = ENDE_COLORS.darkText
): TableCell {
  return new TableCell({
    shading: isAlt ? { type: ShadingType.CLEAR, fill: ENDE_COLORS.tableRowAlt } : undefined,
    margins: {
      top: 100,
      bottom: 100,
      left: 120,
      right: 120,
    },
    children: [
      new Paragraph({
        alignment,
        children: [
          new TextRun({
            text,
            bold,
            color,
            size: 19, // 9.5pt
            font: "Inter",
          }),
        ],
      }),
    ],
  });
}

export function createSectionHeading(numberStr: string, title: string): Paragraph {
  return new Paragraph({
    spacing: { before: 280, after: 120 },
    heading: HeadingLevel.HEADING_2,
    children: [
      new TextRun({
        text: `${numberStr}. `,
        bold: true,
        color: ENDE_COLORS.primaryLight,
        size: 24, // 12pt
        font: "Inter",
      }),
      new TextRun({
        text: title.toUpperCase(),
        bold: true,
        color: ENDE_COLORS.primary,
        size: 24,
        font: "Inter",
      }),
    ],
  });
}
