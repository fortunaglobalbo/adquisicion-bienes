import { extractText } from "@/lib/server/extractText";
import { engineUrl } from "@/lib/server/config";
import { NextRequest, NextResponse } from "next/server";
import { extractTdrFromDocumentOrImageWithAI } from "@/lib/ai/openCodeClient";
import { Adquisicion } from "@/types";

const VPS_API_URL = `${engineUrl}/api/generar-especificaciones`;

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

    if (!adquisicion?.codigo || !adquisicion?.titulo_proceso) return NextResponse.json({ error: "Adquisición requerida" }, { status: 400 });
    let extractedText = documentText || insumoTexto || "";
    let finalImageBase64 = imageBase64;
    if (imageBase64 && !imageBase64.startsWith("data:image")) {
      const buffer = Buffer.from(imageBase64.split(",").pop() || "", "base64");
      if (buffer.length > 20 * 1024 * 1024) return NextResponse.json({ error: "Archivo demasiado grande (máximo 20 MB)." }, { status: 400 });
      try { extractedText = [await extractText(buffer, nombreArchivo || ""), extractedText].filter(Boolean).join("\n\n"); } catch { /* The engine can apply OCR. */ }
    }

    // 1. Procesar con el motor unificado del VPS Linux (MarkItDown + OCR Tesseract + DeepSeek + python-docx)
    let vpsResponse: any = null;
    try {
      const vpsRes = await fetch(`${engineUrl}/api/procesar-documento`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          insumoTexto,
          documentText: extractedText,
          imageBase64: finalImageBase64,
          nombreArchivo,
          adquisicion,
        }),
        signal: AbortSignal.timeout(60000),
      });

      if (vpsRes.ok) {
        vpsResponse = await vpsRes.json();
      }
    } catch (e: any) {
      console.warn("VPS Engine offline o lento, usando fallback local:", e.message);
    }

    let aiResult: any = vpsResponse?.data;

    // 2. Fallback de alta resiliencia local con extractTdrFromDocumentOrImageWithAI si fuera necesario
    if (!aiResult || !aiResult.items || aiResult.items.length === 0) {
      aiResult = await extractTdrFromDocumentOrImageWithAI(adquisicion, {
        insumoTexto,
        documentText: extractedText,
        imageBase64: finalImageBase64?.startsWith("data:image") ? finalImageBase64 : undefined,
        nombreArchivo,
      });
    }

    return NextResponse.json({
      success: true,
      data: aiResult,
      vps_status: vpsResponse?.success ? "vps_engine_online" : "fallback_local",
      docx_file: vpsResponse?.docx_file,
      download_docx: vpsResponse?.download_docx,
      download_pdf: vpsResponse?.download_pdf,
    });
  } catch (err: any) {
    console.error("Error en generate-tdr:", err);
    return NextResponse.json({ error: err.message || "Error al procesar con IA" }, { status: 500 });
  }
}
