import { NextRequest, NextResponse } from "next/server";
import { Adquisicion } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { adquisicion } = body as { adquisicion: Adquisicion; insumoTexto?: string };

    if (!adquisicion) {
      return NextResponse.json({ error: "Adquisición requerida" }, { status: 400 });
    }

    let vpsData: any = null;
    try {
      const vpsRes = await fetch("http://85.31.230.163:8080/api/procesar-form-s2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adquisicion }),
        signal: AbortSignal.timeout(45000),
      });
      if (vpsRes.ok) {
        const vJson = await vpsRes.json();
        if (vJson.success && vJson.data) {
          vpsData = vJson.data;
        }
      }
    } catch (e: any) {
      console.warn("VPS Form S2 fallback:", e.message);
    }

    // Consolidated data from folders 1 to 5
    const data = {
      fecha_solicitud: vpsData?.fecha_solicitud || adquisicion.form_s2_fecha_solicitud || "19/06/2026",
      senores: vpsData?.senores || adquisicion.form_s2_senores || "ARIOL IMPORT",
      tiempo_entrega: vpsData?.tiempo_entrega || adquisicion.form_s2_tiempo_entrega || `${adquisicion.plazo_entrega_dias || 30} días calendario`,
      validez_oferta: vpsData?.validez_oferta || adquisicion.form_s2_validez_oferta || "30 días calendario",
      observaciones: vpsData?.observaciones || adquisicion.form_s2_observaciones || "SE ADJUNTA ESPECIFICACIONES TECNICAS",
      nota_adicional: vpsData?.nota_adicional || adquisicion.form_s2_nota_adicional || "ADJUNTAR FOTOCOPIA SIMPLE DE SU RNC - NIT",
    };

    return NextResponse.json({
      success: true,
      data,
      nombreArchivo: `FORM_S2_N014_${adquisicion.codigo}.docx`,
      tamanoEstimado: 51200,
      idDoc: `FORM-S2-${adquisicion.codigo.replace(/[^0-9]/g, "")}-PLIEGO`,
      contenido: `Pliego oficial Formulario S2-N014 generado con ${adquisicion.items?.length || 0} ítems oficiales.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al generar Form S2" }, { status: 500 });
  }
}
