import { NextRequest, NextResponse } from "next/server";
import { AnythingLlmClient } from "@/lib/ai/anythingLlmClient";

export async function GET(req: NextRequest) {
  try {
    const isAuth = await AnythingLlmClient.checkAuth();
    if (!isAuth) {
      return NextResponse.json(
        { success: false, error: "No se pudo autenticar con AnythingLLM en el VPS." },
        { status: 401 }
      );
    }

    const workspaces = await AnythingLlmClient.getWorkspaces();
    return NextResponse.json({
      success: true,
      authenticated: true,
      workspaces,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Error al conectar con AnythingLLM" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, workspaceSlug, customPrompt } = body;

    const slug = workspaceSlug || "adquisiciones-ende";

    if (action === "extract_acquisition") {
      const extracted = await AnythingLlmClient.extractAcquisitionJson(slug);
      return NextResponse.json({
        success: true,
        data: extracted,
      });
    }

    if (action === "query") {
      if (!customPrompt) {
        return NextResponse.json(
          { success: false, error: "Falta el parámetro 'customPrompt'" },
          { status: 400 }
        );
      }
      const answer = await AnythingLlmClient.queryWorkspace(customPrompt, slug, "query");
      return NextResponse.json({
        success: true,
        answer,
      });
    }

    return NextResponse.json(
      { success: false, error: `Acción desconocida: ${action}` },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Error al procesar la solicitud con AnythingLLM" },
      { status: 500 }
    );
  }
}
