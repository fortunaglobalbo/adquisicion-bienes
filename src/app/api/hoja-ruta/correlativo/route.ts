import { NextResponse } from "next/server";
import { database } from "@/lib/server/database";

export async function GET() {
  try {
    const db = database();
    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const datePrefix = `${day}-${month}`; // Ej: 08-09

    // Buscar el último correlativo para la fecha o general
    const { data, error } = await db
      .from("hojas_ruta")
      .select("cite_correlativo, secuencia_numero, fecha_ingreso")
      .order("fecha_creacion", { ascending: false })
      .limit(50);

    let nextNumber = 1;

    if (!error && data && data.length > 0) {
      // Filtrar los que coincidan con el prefijo de hoy o tomar el max
      const todayMatches = data.filter((row: any) =>
        row.cite_correlativo?.includes(datePrefix)
      );

      if (todayMatches.length > 0) {
        const nums = todayMatches.map((r: any) => {
          const parts = r.cite_correlativo.split("-");
          const last = parseInt(parts[parts.length - 1], 10);
          return isNaN(last) ? 0 : last;
        });
        nextNumber = Math.max(...nums, 0) + 1;
      } else {
        nextNumber = 1;
      }
    }

    const correlativo = `ADQ - ${datePrefix}-${String(nextNumber).padStart(2, "0")}`;

    return NextResponse.json({
      success: true,
      correlativo,
      secuencia: nextNumber,
      fechaSugerida: now.toISOString().split("T")[0],
      horaSugerida: now.toTimeString().split(" ")[0].slice(0, 5),
    });
  } catch (err: any) {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const fallbackCite = `ADQ - ${day}-${month}-01`;

    return NextResponse.json({
      success: true,
      correlativo: fallbackCite,
      secuencia: 1,
      fechaSugerida: now.toISOString().split("T")[0],
      horaSugerida: now.toTimeString().split(" ")[0].slice(0, 5),
    });
  }
}
