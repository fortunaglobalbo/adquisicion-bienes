import { NextResponse } from "next/server";
import { database } from "@/lib/server/database";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const db = database();

    const updates: Record<string, any> = {
      fecha_actualizacion: new Date().toISOString(),
    };

    if (body.estado_actual !== undefined) {
      updates.estado_actual = body.estado_actual;
      if (body.estado_actual === "Adjudicado") {
        updates.fecha_adjudicacion = new Date().toISOString();
      } else if (body.limpiar_fecha_adjudicacion) {
        updates.fecha_adjudicacion = null;
      }
    }

    if (body.ubicacion_actual !== undefined) updates.ubicacion_actual = body.ubicacion_actual;
    if (body.asunto_descripcion !== undefined) updates.asunto_descripcion = body.asunto_descripcion;
    if (body.pases !== undefined) updates.pases = body.pases;
    if (body.enviado !== undefined) updates.enviado = body.enviado;
    if (body.observaciones !== undefined) updates.observaciones = body.observaciones;

    const { data, error } = await db
      .from("hojas_ruta")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data,
      message: "Registro actualizado correctamente.",
    });
  } catch (err: any) {
    console.error("Error updating hoja_ruta:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Error al actualizar registro." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = database();

    const { error } = await db.from("hojas_ruta").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: "Hoja de ruta eliminada correctamente.",
    });
  } catch (err: any) {
    console.error("Error deleting hoja_ruta:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Error al eliminar registro." },
      { status: 500 }
    );
  }
}
