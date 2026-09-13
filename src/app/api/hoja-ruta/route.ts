import { NextResponse } from "next/server";
import { database } from "@/lib/server/database";
import { HojaRuta } from "@/lib/types/hojaRuta";

// Datos de fallback en caso de que la tabla aún no se haya creado en Supabase
const FALLBACK_HOJAS: HojaRuta[] = [
  {
    id: "demo-hoja-1",
    cite_correlativo: "ADQ - 08-09-01",
    secuencia_numero: 1,
    fecha_ingreso: "2026-09-08",
    hora_ingreso: "08:30",
    tipo_documento: "SOLICITUD/TDR",
    institucion_area_origen: "DISTRIBUCION",
    categoria: "CAT 1",
    asunto_descripcion: "SERVICIO DE INSTALACION DE 6 RECONECTADORES DE MEDIA TENCION",
    ubicacion_actual: "DISTRIBUCION",
    estado_actual: "En Circulación",
    fecha_adjudicacion: null,
    enviado: true,
    pases: [
      { pase: 1, destino: "DISTRIBUCION", fecha: "2026-09-08", hora: "08:30", firma: "Ing. Distribución" },
      { pase: 2, destino: "", fecha: "", hora: "", firma: "" },
      { pase: 3, destino: "", fecha: "", hora: "", firma: "" },
      { pase: 4, destino: "", fecha: "", hora: "", firma: "" },
      { pase: 5, destino: "", fecha: "", hora: "", firma: "" },
      { pase: 6, destino: "", fecha: "", hora: "", firma: "" },
      { pase: 7, destino: "", fecha: "", hora: "", firma: "" },
    ],
    fecha_creacion: new Date().toISOString(),
    fecha_actualizacion: new Date().toISOString(),
  },
];

export async function GET() {
  try {
    const db = database();
    const { data, error } = await db
      .from("hojas_ruta")
      .select("*")
      .order("fecha_ingreso", { ascending: false })
      .order("secuencia_numero", { ascending: false });

    if (error) {
      console.warn("Supabase hojas_ruta notice:", error.message);
      return NextResponse.json({
        success: true,
        data: FALLBACK_HOJAS,
        source: "fallback",
        warning: "Tabla hojas_ruta no detectada en Supabase; usando caché local.",
      });
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      source: "supabase",
    });
  } catch (err: any) {
    console.error("Error fetching hojas_ruta:", err);
    return NextResponse.json({
      success: true,
      data: FALLBACK_HOJAS,
      source: "fallback",
      error: err.message,
    });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body.asunto_descripcion || !body.asunto_descripcion.trim()) {
      return NextResponse.json(
        { success: false, error: "El asunto / descripción es obligatorio." },
        { status: 400 }
      );
    }

    const db = database();
    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const datePrefix = `${day}-${month}`;

    let cite = body.cite_correlativo?.trim();
    let secuencia = body.secuencia_numero || 1;

    // Si no envió CITE, generar automáticamente
    if (!cite) {
      try {
        const { data: latest } = await db
          .from("hojas_ruta")
          .select("cite_correlativo")
          .order("fecha_creacion", { ascending: false })
          .limit(20);

        if (latest && latest.length > 0) {
          const matching = latest.filter((r: any) =>
            r.cite_correlativo?.includes(datePrefix)
          );
          if (matching.length > 0) {
            const nums = matching.map((r: any) => {
              const parts = r.cite_correlativo.split("-");
              const n = parseInt(parts[parts.length - 1], 10);
              return isNaN(n) ? 0 : n;
            });
            secuencia = Math.max(...nums, 0) + 1;
          }
        }
      } catch (e) {
        secuencia = 1;
      }
      cite = `ADQ - ${datePrefix}-${String(secuencia).padStart(2, "0")}`;
    }

    const isAdjudicado = body.estado_actual === "Adjudicado";
    const fechaAdjudicacion = isAdjudicado ? now.toISOString() : null;

    const defaultPases = Array.from({ length: 7 }, (_, i) => ({
      pase: i + 1,
      destino: i === 0 ? (body.institucion_area_origen || "DISTRIBUCION") : "",
      fecha: i === 0 ? (body.fecha_ingreso || now.toISOString().split("T")[0]) : "",
      hora: i === 0 ? (body.hora_ingreso || now.toTimeString().slice(0, 5)) : "",
      firma: "",
    }));

    const newRecord = {
      cite_correlativo: cite,
      secuencia_numero: secuencia,
      fecha_ingreso: body.fecha_ingreso || now.toISOString().split("T")[0],
      hora_ingreso: body.hora_ingreso || now.toTimeString().slice(0, 5),
      tipo_documento: body.tipo_documento || "SOLICITUD/TDR",
      institucion_area_origen: body.institucion_area_origen || "DISTRIBUCION",
      categoria: body.categoria || "CAT 1",
      asunto_descripcion: body.asunto_descripcion.trim(),
      ubicacion_actual: body.ubicacion_actual || body.institucion_area_origen || "DISTRIBUCION",
      estado_actual: body.estado_actual || "En Circulación",
      fecha_adjudicacion: fechaAdjudicacion,
      enviado: true,
      pases: body.pases && body.pases.length > 0 ? body.pases : defaultPases,
      observaciones: body.observaciones || null,
      creado_por: body.creado_por || "admin@ende-deoruro.bo",
    };

    const { data, error } = await db
      .from("hojas_ruta")
      .insert([newRecord])
      .select()
      .single();

    if (error) {
      // Conflicto de duplicado en CITE
      if (error.code === "23505") {
        return NextResponse.json(
          {
            success: false,
            error: `El CITE ${cite} ya existe. Por favor actualiza el correlativo para evitar duplicados.`,
          },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      data,
      message: "Hoja de ruta guardada con éxito en el sistema.",
    });
  } catch (err: any) {
    console.error("Error creating hoja_ruta:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "No se pudo guardar la hoja de ruta.",
      },
      { status: 500 }
    );
  }
}
