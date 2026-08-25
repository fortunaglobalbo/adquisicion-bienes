import { NextRequest, NextResponse } from "next/server";
import { parseOcrDocument } from "@/lib/ocr/ocrParser";

export async function POST(req: NextRequest) {
  try {
    const { fileName, carpetaNumero, adquisicionCodigo, adquisicionTitulo, rawText } = await req.json() as {
      fileName: string;
      carpetaNumero: number;
      adquisicionCodigo: string;
      adquisicionTitulo: string;
      rawText?: string;
    };

    if (!fileName || !carpetaNumero || !adquisicionCodigo) {
      return NextResponse.json({ error: "Faltan parámetros obligatorios para OCR" }, { status: 400 });
    }

    const result = parseOcrDocument(
      fileName,
      carpetaNumero,
      adquisicionCodigo,
      adquisicionTitulo,
      rawText
    );

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error procesando OCR" }, { status: 500 });
  }
}
