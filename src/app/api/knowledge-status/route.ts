import { NextResponse } from "next/server";
import { companyKnowledge } from "@/lib/server/companyKnowledge";
import { AnythingLlmClient } from "@/lib/ai/anythingLlmClient";
export const dynamic = "force-dynamic";
export async function GET() {
  const company = companyKnowledge();
  const authenticated = await AnythingLlmClient.checkAuth();
  const workspaces = authenticated ? await AnythingLlmClient.getWorkspaces() : [];
  return NextResponse.json({ company: company.name, connected: authenticated && workspaces.some(w => w.slug === company.workspace),
    previewConfigured: Boolean(process.env.DOCX_PREVIEW_URL && process.env.DOCX_PREVIEW_KEY),
    writingConfigured: Boolean(process.env.OPENCODE_GO_API_KEY) }, { headers: { "Cache-Control": "no-store" } });
}
