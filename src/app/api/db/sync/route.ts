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

// GET: Sincronizar todos los datos desde Supabase
export async function GET(req: NextRequest) {
  try {
    const { data: adquisiciones, error: errAdq } = await supabaseAdmin
      .from("adquisiciones")
      .select("*")
      .order("fecha_creacion", { ascending: false });

    const { data: plantillas, error: errPla } = await supabaseAdmin
      .from("plantillas")
      .select("*")
      .order("fk_carpeta", { ascending: true });

    return NextResponse.json({
      success: true,
      adquisiciones: adquisiciones || [],
      plantillas: plantillas || [],
      error: errAdq?.message || errPla?.message || null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Crear, actualizar o eliminar registros con Service Role (Bypass RLS)
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
    console.error("Error en API DB Sync:", err);
    return NextResponse.json({ error: err.message || "Error en base de datos" }, { status: 500 });
  }
}
