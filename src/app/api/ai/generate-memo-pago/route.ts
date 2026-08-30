import { NextRequest, NextResponse } from "next/server";
import { extractMemoPagoWithAI } from "@/lib/ai/openCodeClient";
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
      const vpsRes = await fetch("http://85.31.230.163:8080/api/procesar-memo-pago", {
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
      console.warn("VPS Memo Pago fallback:", e.message);
    }

    const data = vpsData || await extractMemoPagoWithAI(adquisicion, {
      insumoTexto,
      imageBase64,
      contextoCarpetas,
    });

    return NextResponse.json({
      success: true,
      data,
      nombreArchivo: `MEMO_PAGO_${adquisicion.codigo}.docx`,
    });
  } catch (err: any) {
    console.error("Error en generate-memo-pago:", err);
    return NextResponse.json(
      { error: err.message || "Error al procesar memo de pago con IA" },
      { status: 500 }
    );
  }
}
