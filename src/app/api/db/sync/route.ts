import { NextRequest, NextResponse } from "next/server";
import { createHash, randomUUID } from "crypto";
import { database } from "@/lib/server/database";
import { FOLDER_TEMPLATES } from "@/lib/store/initialData";

export const dynamic = "force-dynamic";
const stateKind = "ende-expediente-state-v1";
const baseFields = ["id", "codigo", "titulo_proceso", "categoria", "modalidad", "partida_presupuestaria", "estado", "prevision_presupuesto", "moneda", "fecha_inicio", "fecha_limite", "unidad_solicitante", "responsable_proceso", "creado_por", "actualizado_por", "fecha_creacion", "fecha_actualizacion"];
const pickBase = (data: Record<string, unknown>) => Object.fromEntries(baseFields.filter(k => data[k] !== undefined).map(k => [k, data[k]]));
const stateId = (id: string) => {
  const h = createHash("sha256").update(stateKind + id).digest("hex");
  return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
};
const fail = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
function check(error: { message: string } | null) { if (error) throw new Error(error.message); }

export async function GET() {
  try {
    const db = database();
    const tables = ["adquisiciones", "plantillas", "carpetas", "documentos", "logs_proceso"];
    const results = await Promise.all(tables.map(table => db.from(table).select("*").limit(10000)));
    results.forEach(result => check(result.error));
    const [adquisiciones, plantillas, carpetas, documents, logs] = results.map(r => r.data || []);
    const states = documents.filter(d => d.metadata?.kind === stateKind).map(d => d.metadata);
    return NextResponse.json({ success: true, adquisiciones, plantillas, carpetas,
      documentos: documents.filter(d => d.metadata?.kind !== stateKind), logs, states });
  } catch (error) { return fail(error instanceof Error ? error.message : "No se pudo cargar la base de datos.", 503); }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, data, id } = body;
    const db = database();
    if (action === "CREATE_EXPEDIENTE") {
      if (!data?.codigo?.trim() || !data?.titulo_proceso?.trim() || !data.id) return fail("Código, título e identificador son obligatorios.");
      const existing = await db.from("adquisiciones").select("*").eq("id", data.id).maybeSingle();
      check(existing.error);
      if (!existing.data) {
        const inserted = await db.from("adquisiciones").insert(pickBase(data));
        if (inserted.error?.code === "23505") return fail("Ya existe un expediente con ese código.", 409);
        check(inserted.error);
      }
      const folders = FOLDER_TEMPLATES.map(f => ({ ...f, adquisicion_id: data.id, estado: "Pendiente" }));
      check((await db.from("carpetas").upsert(folders, { onConflict: "adquisicion_id,numero", ignoreDuplicates: true })).error);
      const saved = await db.from("carpetas").select("*").eq("adquisicion_id", data.id).order("numero");
      check(saved.error);
      return NextResponse.json({ success: true, data: existing.data || data, carpetas: saved.data });
    }
    if (action === "SAVE_EXPEDIENTE") {
      const snapshot = data;
      if (!snapshot?.adquisicion?.id || !Array.isArray(snapshot.carpetas)) return fail("Expediente incompleto.");
      const acquisitionId = snapshot.adquisicion.id;
      if (snapshot.carpetas.some((f: any) => f.adquisicion_id !== acquisitionId)) return fail("Las carpetas no pertenecen al expediente.");
      const folder = await db.from("carpetas").select("id").eq("adquisicion_id", acquisitionId).order("numero").limit(1).single();
      check(folder.error);
      const revision = randomUUID();
      const metadata = { kind: stateKind, revision, saved_at: new Date().toISOString(), snapshot };
      // Store the complete dossier in existing JSONB; no destructive schema migration.
      // Conditional update prevents a browser from silently replacing another session.
      if (body.revision) {
        const result = await db.from("documentos").update({ metadata }).eq("id", stateId(acquisitionId)).eq("metadata->>revision", body.revision).select("id");
        check(result.error);
        if (!result.data?.length) return fail("Este expediente cambió en otra sesión. Tus cambios locales se conservan; exporta el respaldo antes de resolver el conflicto.", 409);
      } else {
        const result = await db.from("documentos").insert({ id: stateId(acquisitionId), adquisicion_id: acquisitionId, carpeta_id: folder.data!.id,
          tipo: "SUBIDO_OTRO", nombre_original: ".ende-expediente-state.json", mime: "application/json", estado: "Borrador", metadata });
        if (result.error?.code === "23505") return fail("Existe una versión más reciente del expediente. Se conservan tus cambios locales.", 409);
        check(result.error);
      }
      const mirror = await db.from("adquisiciones").update(pickBase(snapshot.adquisicion)).eq("id", acquisitionId);
      return NextResponse.json({ success: true, revision, warning: mirror.error ? "Contenido guardado; pendiente actualizar índice de expedientes." : undefined });
    }
    if (action === "DELETE_EXPEDIENTE") {
      if (!id || typeof id !== "string") return fail("Identificador obligatorio.");
      check((await db.from("adquisiciones").delete().eq("id", id).select("id")).error);
      return NextResponse.json({ success: true });
    }
    if (action === "SAVE_PLANTILLA") {
      if (!data || !Number.isInteger(data.fk_carpeta) || data.fk_carpeta < 1 || data.fk_carpeta > 8) return fail("Carpeta de plantilla inválida.");
      const previous = await db.from("plantillas").select("id").eq("fk_carpeta", data.fk_carpeta).limit(1).maybeSingle();
      check(previous.error);
      const payload = { nombre: data.nombre, fk_carpeta: data.fk_carpeta, descripcion: data.descripcion,
        version: data.version || "1.0", ruta_archivo: data.ruta_archivo,
        contenido_plantilla: { ...data.datos_completos, campos_configurables: data.campos_configurables, secciones_fijas: data.secciones_fijas, nombre_archivo: data.nombre_archivo } };
      const result = previous.data ? await db.from("plantillas").update(payload).eq("id", previous.data.id).select() : await db.from("plantillas").insert(payload).select();
      check(result.error);
      return NextResponse.json({ success: true, data: result.data });
    }
    return fail("Operación no permitida. Utilice las operaciones de expediente o plantilla.");
  } catch (error) { return fail(error instanceof Error ? error.message : "No se pudo guardar en la base de datos.", 503); }
}
