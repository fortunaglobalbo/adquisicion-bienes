import { engineUrl } from "@/lib/server/config";
import { NextRequest, NextResponse } from "next/server";

const VPS_ENGINE_URL = engineUrl;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const dataJson = formData.get("data_json");

    if (!file || !dataJson) {
      return NextResponse.json(
        { success: false, error: "Se requieren 'file' (plantilla DOCX) y 'data_json' (datos de reemplazo)." },
        { status: 400 }
      );
    }

    // Reenviar al motor de procesamiento en el VPS
    const vpsFormData = new FormData();
    vpsFormData.append("file", file);
    vpsFormData.append("data_json", dataJson);

    const vpsRes = await fetch(`${VPS_ENGINE_URL}/api/docx/smart-fill`, {
      method: "POST",
      body: vpsFormData,
      signal: AbortSignal.timeout(60000),
    });

    if (!vpsRes.ok) {
      const errText = await vpsRes.text();
      return NextResponse.json(
        { success: false, error: `Error en VPS Engine (${vpsRes.status}): ${errText}` },
        { status: vpsRes.status }
      );
    }

    const result = await vpsRes.json();
    return NextResponse.json({
      success: true,
      data: result,
      download_url: `/api/proxy/generar-especificaciones?path=${encodeURIComponent(result.download_url)}&filename=${encodeURIComponent((result.download_url || "").split("/").pop() || "documento.docx")}`,
    });
  } catch (error: any) {
    console.error("Error en smart-fill route:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error interno al procesar el archivo DOCX" },
      { status: 500 }
    );
  }
}
