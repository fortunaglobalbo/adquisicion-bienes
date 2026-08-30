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

    let vpsData: any = null;
    try {
      const vpsRes = await fetch("http://85.31.230.163:8080/api/procesar-solicitud-inicio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adquisicion, insumoTexto, documentText, imageBase64, nombreArchivo }),
        signal: AbortSignal.timeout(45000),
      });
      if (vpsRes.ok) {
        const vJson = await vpsRes.json();
        if (vJson.success && vJson.data) {
          vpsData = vJson.data;
        }
      }
    } catch (e: any) {
      console.warn("VPS Solicitud Inicio fallback:", e.message);
    }

    const data = vpsData || await extractSolicitudInicioWithAI(adquisicion, {
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
