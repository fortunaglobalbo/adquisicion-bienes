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

    let vpsData: any = null;
    try {
      const vpsRes = await fetch("http://85.31.230.163:8080/api/procesar-informe-conformidad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adquisicion, insumoTexto, imageBase64 }),
        signal: AbortSignal.timeout(45000),
      });
      if (vpsRes.ok) {
        const vJson = await vpsRes.json();
        if (vJson.success && vJson.data) {
          vpsData = vJson.data;
        }
      }
    } catch (e: any) {
      console.warn("VPS Informe Conformidad fallback:", e.message);
    }

    const data = vpsData || await extractInformeConformidadWithAI(adquisicion, {
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
