import { NextRequest, NextResponse } from "next/server";
import { extractTdrFromDocumentOrImageWithAI } from "@/lib/ai/openCodeClient";
import { Adquisicion } from "@/types";

const VPS_API_URL = "http://85.31.230.163:8080/api/generar-especificaciones";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { adquisicion, insumoTexto, documentText, imageBase64, nombreArchivo } = body as {
      adquisicion: Adquisicion;
      insumoTexto?: string;
      documentText?: string;
      imageBase64?: string;
      nombreArchivo?: string;
    };

    if (!adquisicion) {
      return NextResponse.json({ error: "Adquisición requerida" }, { status: 400 });
    }

    // 1. Ejecutar análisis y redacción 100% autónoma con DeepSeek IA
    const aiResult = await extractTdrFromDocumentOrImageWithAI(adquisicion, {
      insumoTexto,
      documentText,
      imageBase64,
      nombreArchivo,
    });

    // 2. Enviar los datos analizados por la IA directamente al VPS para compilar DOCX y PDF nativos
    let vpsData: any = null;
    try {
      const vpsPayload = {
        titulo_adquisicion: aiResult.titulo_proceso || adquisicion.titulo_proceso,
        justificacion: aiResult.justificacion_texto || adquisicion.justificacion_texto,
        items: (aiResult.items || []).map((it: any, idx: number) => ({
          numero: it.item || idx + 1,
          descripcion: it.descripcion,
          unidad: it.unidad || "Pza",
          cantidad: it.cantidad || 1,
          caracteristicas: it.caracteristicasTecnicas || it.especificacionMinima || "Conforme a especificaciones",
        })),
        elaborado: adquisicion.elaborado_por || adquisicion.responsable_proceso || "Ing. Responsable Técnico ENDE DEORURO S.A.",
        plazo_entrega: aiResult.tiempo_entrega_texto || `${adquisicion.plazo_entrega_dias || 30} días calendario`,
        lugar_entrega: aiResult.lugar_entrega || "Almacenes ENDE DEORURO S.A., Oruro",
        vigencia_propuesta: aiResult.vigencia_propuesta_texto || "30 días calendario",
      };

      const vpsRes = await fetch(VPS_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vpsPayload),
        signal: AbortSignal.timeout(45000),
      });

      if (vpsRes.ok) {
        vpsData = await vpsRes.json();
      }
    } catch (e: any) {
      console.warn("VPS compile status:", e.message);
    }

    return NextResponse.json({
      success: true,
      data: {
        ...aiResult,
        vpsData,
      },
      vps_status: vpsData ? "success" : "fallback",
      docx_file: vpsData?.docx_file,
      pdf_file: vpsData?.pdf_file,
      download_docx: vpsData?.download_docx,
      download_pdf: vpsData?.download_pdf,
    });
  } catch (err: any) {
    console.error("Error en generate-tdr:", err);
    return NextResponse.json({ error: err.message || "Error al procesar con IA" }, { status: 500 });
  }
}
