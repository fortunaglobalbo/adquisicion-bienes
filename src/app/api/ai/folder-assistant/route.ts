import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { peticion_usuario, adquisicion, carpetas_existentes } = body;

    let vpsData: any = null;
    try {
      const res = await fetch("http://85.31.230.163:8080/api/asistente-carpeta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ peticion_usuario, adquisicion, carpetas_existentes }),
        signal: AbortSignal.timeout(45000),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          vpsData = json.data;
        }
      }
    } catch (e: any) {
      console.warn("Error consultando asistente VPS:", e.message);
    }

    if (!vpsData) {
      vpsData = {
        nombre_carpeta: peticion_usuario || "Documento Administrativo",
        descripcion_clara: "Fase del expediente de contratación para ENDE DEORURO S.A.",
        que_hace: "Tramita y formaliza la documentación requerida para este hito del proceso.",
        de_quien_depende: "Se alimenta de las especificaciones técnicas del TDR (Carpeta 1) y cotizaciones.",
        pasos: [
          "Paso 1: Verificar los datos consolidados del proceso.",
          "Paso 2: Generar el borrador con la IA de ENDE DEORURO.",
          "Paso 3: Descargar el documento oficial en Word para su firma."
        ],
        tipo_generacion: "IA",
      };
    }

    return NextResponse.json({ success: true, data: vpsData });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error en asistente de carpeta" }, { status: 500 });
  }
}
