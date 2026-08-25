import { NextRequest, NextResponse } from "next/server";
import { extractTdrFromDocumentOrImageWithAI } from "@/lib/ai/openCodeClient";
import { Adquisicion } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const { adquisicion, insumoTexto, imageBase64, documentText, nombreArchivo } = await req.json() as {
      adquisicion: Adquisicion;
      insumoTexto?: string;
      imageBase64?: string;
      documentText?: string;
      nombreArchivo?: string;
    };

    if (!adquisicion) {
      return NextResponse.json({ error: "Adquisición requerida" }, { status: 400 });
    }

    const resultado = await extractTdrFromDocumentOrImageWithAI(adquisicion, {
      insumoTexto,
      imageBase64,
      documentText,
      nombreArchivo,
    });

    return NextResponse.json({
      success: true,
      data: resultado,
      nombreArchivo: `TDR_${adquisicion.codigo}_v1.docx`,
      tamanoEstimado: 48500,
      idDoc: `DOC-TDR-${adquisicion.codigo.replace(/[^0-9]/g, "")}-A`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al procesar con IA" }, { status: 500 });
  }
}
