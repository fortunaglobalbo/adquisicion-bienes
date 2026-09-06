import { engineUrl } from "@/lib/server/config";
import { NextRequest, NextResponse } from "next/server";

const VPS_ENGINE_URL = engineUrl;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json(
        { success: false, error: "Se requiere un archivo 'file' (.docx)" },
        { status: 400 }
      );
    }

    const vpsFormData = new FormData();
    vpsFormData.append("file", file);

    const vpsRes = await fetch(`${VPS_ENGINE_URL}/api/docx/inspect`, {
      method: "POST",
      body: vpsFormData,
      signal: AbortSignal.timeout(60000),
    });

    if (!vpsRes.ok) {
      const err = await vpsRes.text();
      return NextResponse.json(
        { success: false, error: `Error VPS Engine (${vpsRes.status}): ${err}` },
        { status: vpsRes.status }
      );
    }

    const result = await vpsRes.json();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error en inspect route:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error interno al inspeccionar archivo DOCX" },
      { status: 500 }
    );
  }
}
