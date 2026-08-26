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

// GET: Carga directa 100% desde Supabase PostgreSQL
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const table = searchParams.get("table");
    const adquisicionId = searchParams.get("adquisicion_id");

    if (table) {
      let q = supabaseAdmin.from(table).select("*");
      if (adquisicionId) {
        q = q.eq("adquisicion_id", adquisicionId);
      }
      const { data, error } = await q;
      if (error) throw error;
      return NextResponse.json({ success: true, data: data || [] });
    }

    // Si no se especifica tabla, devuelve el dataset completo de la base de datos
    const [adqsRes, plantillasRes, carpetasRes, logsRes] = await Promise.all([
      supabaseAdmin.from("adquisiciones").select("*").order("fecha_creacion", { ascending: false }),
      supabaseAdmin.from("plantillas").select("*").order("fk_carpeta", { ascending: true }),
      supabaseAdmin.from("carpetas").select("*").order("numero", { ascending: true }),
      supabaseAdmin.from("logs_proceso").select("*").order("fecha", { ascending: false }).limit(100),
    ]);

    return NextResponse.json({
      success: true,
      adquisiciones: adqsRes.data || [],
      plantillas: plantillasRes.data || [],
      carpetas: carpetasRes.data || [],
      logs: logsRes.data || [],
    });
  } catch (err: any) {
    console.error("Error en GET /api/db/sync:", err);
    return NextResponse.json({ error: err.message || "Error al consultar Supabase" }, { status: 500 });
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
      return NextResponse.json({ error: "Parámetros incompletos" }, { status: 400 });
    }

    if (action === "INSERT") {
      const { data: inserted, error } = await supabaseAdmin.from(table).insert(Array.isArray(data) ? data : [data]).select();
      if (error) throw error;
      return NextResponse.json({ success: true, data: inserted });
    }

    if (action === "UPSERT") {
      const { data: upserted, error } = await supabaseAdmin.from(table).upsert(Array.isArray(data) ? data : [data]).select();
      if (error) throw error;
      return NextResponse.json({ success: true, data: upserted });
    }

    if (action === "UPDATE") {
      let query = supabaseAdmin.from(table).update(data);
      if (id) {
        query = query.or(`id.eq.${id},codigo.eq.${id}`);
      } else if (filter) {
        query = query.eq(filter.column, filter.value);
      }
      const { data: updated, error } = await query.select();
      if (error) throw error;
      return NextResponse.json({ success: true, data: updated });
    }

    if (action === "DELETE") {
      let query = supabaseAdmin.from(table).delete();
      if (id) {
        query = query.or(`id.eq.${id},codigo.eq.${id}`);
      } else if (filter) {
        query = query.eq(filter.column, filter.value);
      }
      const { error } = await query;
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Acción no soportada" }, { status: 400 });
  } catch (err: any) {
    console.error("Error en POST /api/db/sync:", err);
    return NextResponse.json({ error: err.message || "Error al escribir en Supabase" }, { status: 500 });
  }
}
