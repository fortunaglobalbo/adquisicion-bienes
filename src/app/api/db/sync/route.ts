import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://yubaienethtfubcozehm.supabase.co")
  .replace(/\/rest\/v1\/?$/i, "")
  .replace(/\/+$/, "");

const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "";

const supabaseAdmin = createClient(supabaseUrl, serviceKey);

const isUuid = (val?: string): boolean =>
  typeof val === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);

// GET: Carga directa 100% desde Supabase PostgreSQL
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const table = searchParams.get("table");
    const adquisicionId = searchParams.get("adquisicion_id");

    if (table) {
      let q = supabaseAdmin.from(table).select("*");
      if (adquisicionId) {
        q = isUuid(adquisicionId)
          ? q.eq("adquisicion_id", adquisicionId)
          : q.eq("codigo", adquisicionId);
      }
      const { data, error } = await q;
      if (error) {
        return NextResponse.json({ success: false, error: `Error en tabla ${table}: ${error.message}` }, { status: 500 });
      }
      return NextResponse.json({ success: true, data: data || [] });
    }

    // Consulta del dataset institucional completo incluyendo la tabla documentos
    const [adqsRes, plantillasRes, carpetasRes, docsRes, logsRes] = await Promise.all([
      supabaseAdmin.from("adquisiciones").select("*").order("fecha_creacion", { ascending: false }),
      supabaseAdmin.from("plantillas").select("*").order("fk_carpeta", { ascending: true }),
      supabaseAdmin.from("carpetas").select("*").order("numero", { ascending: true }),
      supabaseAdmin.from("documentos").select("*").order("fecha_creacion", { ascending: false }),
      supabaseAdmin.from("logs_proceso").select("*").order("fecha", { ascending: false }).limit(100),
    ]);

    if (adqsRes.error) {
      return NextResponse.json({ success: false, error: `Error en adquisiciones: ${adqsRes.error.message}` }, { status: 500 });
    }
    if (plantillasRes.error) {
      return NextResponse.json({ success: false, error: `Error en plantillas: ${plantillasRes.error.message}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      adquisiciones: adqsRes.data || [],
      plantillas: plantillasRes.data || [],
      carpetas: carpetasRes.data || [],
      documentos: docsRes.data || [],
      logs: logsRes.data || [],
    });
  } catch (err: any) {
    console.error("Error en GET /api/db/sync:", err);
    return NextResponse.json({ success: false, error: err.message || "Error al conectar con la base de datos Supabase" }, { status: 500 });
  }
}

// POST: Escritura directa 100% en Supabase PostgreSQL
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, table, data, id, filter } = body as {
      action: "INSERT" | "UPDATE" | "DELETE" | "UPSERT";
      table: string;
      data?: any;
      id?: string;
      filter?: { column: string; value: any };
    };

    if (!table || !action) {
      return NextResponse.json({ success: false, error: "Parámetros incompletos para base de datos" }, { status: 400 });
    }

    // Manejo especial para la tabla 'documentos': Resolver UUIDs válidos de adquisicion y carpeta
    if (table === "documentos" && (action === "INSERT" || action === "UPSERT")) {
      const docItem = Array.isArray(data) ? data[0] : data;
      let adqId = docItem.adquisicion_id;
      let carpId = docItem.carpeta_id;

      // 1. Resolver adquisicion_id si es código
      if (adqId && !isUuid(adqId)) {
        const { data: adqFound } = await supabaseAdmin
          .from("adquisiciones")
          .select("id")
          .eq("codigo", adqId)
          .maybeSingle();
        if (adqFound) adqId = adqFound.id;
      }

      // 2. Resolver carpeta_id si no es UUID
      if (adqId && isUuid(adqId) && (!carpId || !isUuid(carpId))) {
        const carpetaNum = docItem.metadata?.carpeta_numero || docItem.carpeta_numero || 1;
        const { data: carpFound } = await supabaseAdmin
          .from("carpetas")
          .select("id")
          .eq("adquisicion_id", adqId)
          .eq("numero", carpetaNum)
          .maybeSingle();

        if (carpFound) {
          carpId = carpFound.id;
        } else {
          // Crear carpeta en Supabase si no existiera
          const { data: newCarp } = await supabaseAdmin
            .from("carpetas")
            .insert({
              adquisicion_id: adqId,
              numero: carpetaNum,
              nombre: `Carpeta ${carpetaNum}`,
              tipo_generacion: carpetaNum === 1 || carpetaNum === 5 || carpetaNum === 6 ? "IA" : "MANUAL",
              estado: "Completado",
            })
            .select()
            .single();
          if (newCarp) carpId = newCarp.id;
        }
      }

      const payload = {
        ...(isUuid(docItem.id) ? { id: docItem.id } : {}),
        adquisicion_id: adqId,
        carpeta_id: carpId,
        tipo: docItem.tipo || "GENERADO_DOCX",
        nombre_original: docItem.nombre_original || "Documento_Oficial.docx",
        mime: docItem.mime || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        tamano: docItem.tamano || 48000,
        estado: docItem.estado || "Borrador",
        version: docItem.version || 1,
        creado_por: docItem.creado_por || "admin@ende-deoruro.bo",
        metadata: docItem.metadata || {},
      };

      const { data: insertedDoc, error: docError } = await supabaseAdmin
        .from("documentos")
        .insert([payload])
        .select();

      if (docError) {
        console.error("Error insertando en tabla documentos de Supabase:", docError);
        return NextResponse.json({ success: false, error: docError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, data: insertedDoc });
    }

    if (action === "INSERT") {
      const { data: inserted, error } = await supabaseAdmin.from(table).insert(Array.isArray(data) ? data : [data]).select();
      if (error) {
        return NextResponse.json({ success: false, error: `Error insertando en ${table}: ${error.message}` }, { status: 500 });
      }
      return NextResponse.json({ success: true, data: inserted });
    }

    if (action === "UPSERT") {
      const { data: upserted, error } = await supabaseAdmin.from(table).upsert(Array.isArray(data) ? data : [data]).select();
      if (error) {
        return NextResponse.json({ success: false, error: `Error en upsert ${table}: ${error.message}` }, { status: 500 });
      }
      return NextResponse.json({ success: true, data: upserted });
    }

    if (action === "UPDATE") {
      let query = supabaseAdmin.from(table).update(data);
      if (id) {
        if (isUuid(id)) {
          query = query.eq("id", id);
        } else {
          query = query.eq("codigo", id);
        }
      } else if (filter) {
        query = query.eq(filter.column, filter.value);
      }
      const { data: updated, error } = await query.select();
      if (error) {
        return NextResponse.json({ success: false, error: `Error actualizando ${table}: ${error.message}` }, { status: 500 });
      }
      return NextResponse.json({ success: true, data: updated });
    }

    if (action === "DELETE") {
      let query = supabaseAdmin.from(table).delete();
      if (id) {
        if (isUuid(id)) {
          query = query.eq("id", id);
        } else {
          query = query.eq("codigo", id);
        }
      } else if (filter) {
        query = query.eq(filter.column, filter.value);
      }
      const { error } = await query;
      if (error) {
        return NextResponse.json({ success: false, error: `Error eliminando de ${table}: ${error.message}` }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Acción de base de datos no soportada" }, { status: 400 });
  } catch (err: any) {
    console.error("Error en POST /api/db/sync:", err);
    return NextResponse.json({ success: false, error: err.message || "Error al escribir en Supabase" }, { status: 500 });
  }
}
