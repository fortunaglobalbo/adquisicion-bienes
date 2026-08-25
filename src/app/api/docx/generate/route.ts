import { NextRequest, NextResponse } from "next/server";
import { generateTdrDocx } from "@/lib/docx/tdrGenerator";
import { generateSolicitudInicioDocx } from "@/lib/docx/solicitudInicioGenerator";
import { generateFormS2Docx } from "@/lib/docx/formS2Generator";
import { Adquisicion } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tipo, adquisicion, justificacionTexto, templateData } = body as {
      tipo: "TDR" | "SOLICITUD_INICIO" | "FORM_S2";
      adquisicion: Adquisicion;
      justificacionTexto?: string;
      templateData?: any;
    };

    if (!adquisicion || !tipo) {
      return NextResponse.json({ error: "Faltan parámetros requeridos (tipo o adquisicion)" }, { status: 400 });
    }

    let buffer: Buffer;
    let fileName = `DOC_${adquisicion.codigo}_${tipo}.docx`;

    if (tipo === "TDR") {
      buffer = await generateTdrDocx(adquisicion, templateData);
      fileName = `TDR_${adquisicion.codigo}_Especificaciones.docx`;
    } else if (tipo === "SOLICITUD_INICIO") {
      buffer = await generateSolicitudInicioDocx(adquisicion, justificacionTexto);
      fileName = `SOLICITUD_INICIO_${adquisicion.codigo}.docx`;
    } else if (tipo === "FORM_S2") {
      buffer = await generateFormS2Docx(adquisicion);
      fileName = `FORM_S2_N014_${adquisicion.codigo}_Cotizacion.docx`;
    } else {

      return NextResponse.json({ error: "Tipo de documento no soportado" }, { status: 400 });
    }

    const uint8Array = new Uint8Array(buffer);

    return new NextResponse(uint8Array, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error("Error generando archivo DOCX:", error);
    return NextResponse.json({ error: error.message || "Error interno al generar documento DOCX" }, { status: 500 });
  }
}
