import { NextRequest, NextResponse } from "next/server";
import { extractInformeConformidadWithAI } from "@/lib/ai/openCodeClient";
import { Adquisicion } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { adquisicion, insumoTexto, imageBase64, contextoCarpetas } = body as {
      adquisicion: Adquisicion;
      insumoTexto?: string;
      imageBase64?: string;
      contextoCarpetas?: any;
    };

    if (!adquisicion) {
      return NextResponse.json({ error: "Adquisición requerida" }, { status: 400 });
    }

    const data = await extractInformeConformidadWithAI(adquisicion, {
      insumoTexto,
      imageBase64,
      contextoCarpetas,
    });

    return NextResponse.json({
      success: true,
      data,
      nombreArchivo: `INFORME_CONFORMIDAD_A6_${adquisicion.codigo}.docx`,
    });
  } catch (err: any) {
    console.error("Error en generate-informe-conformidad:", err);
    return NextResponse.json(
      { error: err.message || "Error al procesar informe de conformidad con IA" },
      { status: 500 }
    );
  }
}
