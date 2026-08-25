import { NextRequest, NextResponse } from "next/server";
import { extractSolicitudInicioWithAI } from "@/lib/ai/openCodeClient";
import { Adquisicion } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { adquisicion, insumoTexto, imageBase64, documentText, nombreArchivo } = body as {
      adquisicion: Adquisicion;
      insumoTexto?: string;
      imageBase64?: string;
      documentText?: string;
      nombreArchivo?: string;
    };

    if (!adquisicion) {
      return NextResponse.json({ error: "Adquisición requerida" }, { status: 400 });
    }

    const data = await extractSolicitudInicioWithAI(adquisicion, {
      insumoTexto,
      imageBase64,
      documentText,
      nombreArchivo,
    });

    return NextResponse.json({
      success: true,
      data,
      nombreArchivo: `SOLICITUD_INICIO_${adquisicion.codigo}.docx`,
    });
  } catch (err: any) {
    console.error("Error en generate-solicitud-inicio:", err);
    return NextResponse.json(
      { error: err.message || "Error al procesar solicitud de inicio con IA" },
      { status: 500 }
    );
  }
}
