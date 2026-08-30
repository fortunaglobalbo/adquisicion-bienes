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

    let extractedText = documentText || insumoTexto || "";
    let finalImageBase64 = imageBase64;

    // Procesamiento inteligente según el tipo de archivo cargado
    if (imageBase64 && !imageBase64.startsWith("data:image")) {
      const b64Data = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
      const fileBuffer = Buffer.from(b64Data, "base64");
      const lowerName = (nombreArchivo || "").toLowerCase();

      if (lowerName.endsWith(".docx") || lowerName.endsWith(".doc")) {
        try {
          const mammoth = require("mammoth");
          const { value } = await mammoth.extractRawText({ buffer: fileBuffer });
          if (value && value.trim()) {
            extractedText = `${value}\n\n${extractedText}`;
          }
        } catch (e: any) {
          console.warn("Error extrayendo texto de Word (.docx):", e.message);
        }
      } else if (lowerName.endsWith(".pdf")) {
        try {
          const pdfParse = require("pdf-parse");
          const pdfData = await pdfParse(fileBuffer);
          if (pdfData.text && pdfData.text.trim()) {
            extractedText = `${pdfData.text}\n\n${extractedText}`;
          }
        } catch (e: any) {
          console.warn("Error extrayendo texto de PDF:", e.message);
        }
      } else if (lowerName.endsWith(".txt") || lowerName.endsWith(".md") || lowerName.endsWith(".csv")) {
        try {
          const textDecoded = fileBuffer.toString("utf-8");
          if (textDecoded && textDecoded.trim()) {
            extractedText = `${textDecoded}\n\n${extractedText}`;
          }
        } catch (e: any) {
          console.warn("Error decodificando archivo de texto plano:", e.message);
        }
      }
    }

    // 1. Procesar con el motor unificado del VPS Linux (MarkItDown + OCR Tesseract + DeepSeek + python-docx)
    let vpsResponse: any = null;
    try {
      const vpsRes = await fetch("http://85.31.230.163:8080/api/procesar-documento", {
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
