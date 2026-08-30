import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = "http://85.31.230.163:8080";

/**
 * Proxy server-side para el generador de Especificaciones Técnicas.
 * Evita el bloqueo CORS del navegador al hacer la petición desde el servidor de Next.js.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const backendRes = await fetch(`${BACKEND_URL}/api/generar-especificaciones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      // Timeout de 60 segundos (la generación de PDF puede tardar)
      signal: AbortSignal.timeout(60000),
    });

    const data = await backendRes.json();

    if (!backendRes.ok) {
      return NextResponse.json(
        { status: "error", message: data.error || `Error del servidor: ${backendRes.status}` },
        { status: backendRes.status }
      );
    }

    return NextResponse.json(data);
  } catch (err: any) {
    const isTimeout = err.name === "TimeoutError" || err.name === "AbortError";
    return NextResponse.json(
      {
        status: "error",
        message: isTimeout
          ? "El servidor tardó demasiado en responder (>60s). Intenta de nuevo."
          : `No se pudo conectar con el servidor de generación: ${err.message}`,
      },
      { status: 503 }
    );
  }
}

/**
 * Proxy para descarga de archivos (DOCX y PDF) generados en el backend.
 * Uso: GET /api/proxy/descargar?path=/download/archivo.pdf&filename=archivo.pdf
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filePath = searchParams.get("path");
    const filename = searchParams.get("filename") || "documento";

    if (!filePath) {
      return NextResponse.json({ error: "Parámetro 'path' requerido" }, { status: 400 });
    }

    const fileUrl = filePath.startsWith("http") ? filePath : `${BACKEND_URL}${filePath}`;
    const fileRes = await fetch(fileUrl, {
      signal: AbortSignal.timeout(30000),
    });

    if (!fileRes.ok) {
      return NextResponse.json(
        { error: `No se pudo descargar el archivo: ${fileRes.status}` },
        { status: fileRes.status }
      );
    }

    const contentType =
      fileRes.headers.get("Content-Type") ||
      (filename.endsWith(".pdf") ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document");

    const buffer = await fileRes.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
        "Content-Length": buffer.byteLength.toString(),
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Error al descargar: ${err.message}` },
      { status: 500 }
    );
  }
}
