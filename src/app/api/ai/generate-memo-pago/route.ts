import { engineUrl } from "@/lib/server/config";
import { NextRequest, NextResponse } from "next/server";
import { extractMemoPagoWithAI } from "@/lib/ai/openCodeClient";
import { Adquisicion } from "@/types";
import { memoPeople } from '@/lib/docx/dossierPeople';

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
      const vpsRes = await fetch(`${engineUrl}/api/procesar-memo-pago`, {
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
    const people=memoPeople(adquisicion);

    return NextResponse.json({
      success: true,
      data: {...data,a_nombre:people.memo_pago_a_nombre, a_cargo:people.memo_pago_a_cargo,
        de_nombre:people.memo_pago_de_nombre, de_cargo:people.memo_pago_de_cargo},
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
