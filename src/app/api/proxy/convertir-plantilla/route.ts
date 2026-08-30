import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const fkCarpeta = formData.get("fk_carpeta") || "1";
    const nombrePlantilla = formData.get("nombre_plantilla") || "plantilla.docx";

    if (!file) {
      return NextResponse.json({ error: "No se proporcionó ningún archivo" }, { status: 400 });
    }

    const vpsFormData = new FormData();
    vpsFormData.append("file", file);
    vpsFormData.append("fk_carpeta", String(fkCarpeta));
    vpsFormData.append("nombre_plantilla", String(nombrePlantilla));

    const res = await fetch("http://85.31.230.163:8080/api/convertir-plantilla", {
      method: "POST",
      body: vpsFormData,
      signal: AbortSignal.timeout(60000),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Error en el motor VPS (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("Error en proxy convertir-plantilla:", err);
    return NextResponse.json(
      { error: err.message || "Error de comunicación con el motor VPS" },
      { status: 500 }
    );
  }
}
