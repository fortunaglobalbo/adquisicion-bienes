import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { database } from "@/lib/server/database";
const bucket = "expedientes-docs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file"); const id = form.get("adquisicion_id");
    if (!(file instanceof File) || typeof id !== "string") return NextResponse.json({ error: "Falta el archivo o expediente." }, { status: 400 });
    if (!file.size || file.size > 20 * 1024 * 1024) return NextResponse.json({ error: "El archivo debe tener entre 1 byte y 20 MB." }, { status: 400 });
    const db = database();
    const found = await db.from("adquisiciones").select("id").eq("id", id).maybeSingle();
    if (found.error || !found.data) return NextResponse.json({ error: "Expediente no encontrado." }, { status: 404 });
    const info = await db.storage.getBucket(bucket);
    if (info.error) {
      const created = await db.storage.createBucket(bucket, { public: false, fileSizeLimit: 20 * 1024 * 1024 });
      if (created.error && !/already|exist/i.test(created.error.message)) throw new Error(created.error.message);
    }
    const safeName = file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-150);
    const path = `${id}/${randomUUID()}/${safeName}`;
    const result = await db.storage.from(bucket).upload(path, await file.arrayBuffer(), { contentType: file.type || "application/octet-stream", upsert: false });
    if (result.error) throw new Error(result.error.message);
    return NextResponse.json({ success: true, path, url: `/api/files?path=${encodeURIComponent(path)}` });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo almacenar el archivo." }, { status: 503 }); }
}
export async function GET(req: NextRequest) {
  try {
    const path = req.nextUrl.searchParams.get("path");
    if (!path || !/^[a-f0-9-]{36}\/[a-f0-9-]{36}\/[\w.-]+$/i.test(path)) return NextResponse.json({ error: "Ruta de archivo inválida." }, { status: 400 });
    const db = database();
    const acquisition = await db.from("adquisiciones").select("id").eq("id", path.split("/")[0]).maybeSingle();
    if (!acquisition.data) return NextResponse.json({ error: "Expediente no disponible." }, { status: 404 });
    const result = await db.storage.from(bucket).download(path);
    if (result.error || !result.data) return NextResponse.json({ error: "Archivo no disponible." }, { status: 404 });
    return new NextResponse(result.data, { headers: { "Content-Type": result.data.type || "application/octet-stream", "Content-Disposition": `attachment; filename="${path.split("/").pop()}"`, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "No se pudo descargar el archivo." }, { status: 503 }); }
}
