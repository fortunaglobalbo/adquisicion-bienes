import { NextRequest, NextResponse } from "next/server";
import { DocxTranspiler } from "@/lib/docx/docxTranspiler";

const VPS_ENGINE_URL = process.env.VPS_DOCX_ENGINE_URL || "http://85.31.230.163:8080";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const fkCarpeta = Number(formData.get("fk_carpeta")) || 1;
    const nombrePlantilla = (formData.get("nombre") as string) || file?.name || `Plantilla Carpeta ${fkCarpeta}`;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No se proporcionó ningún archivo Word (.docx)" },
        { status: 400 }
      );
    }

    // 1. Enviar el archivo DOCX al VPS para inspección profunda de nodos y tablas
    const vpsFd = new FormData();
    vpsFd.append("file", file);

    const vpsRes = await fetch(`${VPS_ENGINE_URL}/api/docx/inspect`, {
      method: "POST",
      body: vpsFd,
    });

    if (!vpsRes.ok) {
      const errText = await vpsRes.text();
      return NextResponse.json(
        { success: false, error: `Error al inspeccionar documento en VPS: ${errText}` },
        { status: vpsRes.status }
      );
    }

    const inspectJson = await vpsRes.json();
    if (!inspectJson.success || !inspectJson.data) {
      return NextResponse.json(
        { success: false, error: "No se pudo extraer la estructura del documento" },
        { status: 500 }
      );
    }

    // 2. Transpilar la estructura en una Plantilla de Código Nativa
    const transpileResult = DocxTranspiler.transpileFromInspection(
      inspectJson.data,
      fkCarpeta,
      nombrePlantilla
    );

    return NextResponse.json({
      success: true,
      data: transpileResult,
    });
  } catch (error: any) {
    console.error("Error en transpile route:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error interno al transpilar la plantilla a código" },
      { status: 500 }
    );
  }
}
