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

    const data = await extractMemoPagoWithAI(adquisicion, {
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
