import { NextRequest, NextResponse } from "next/server";
import { Adquisicion, ItemAdquisicion } from "@/types";

const VPS_API_URL = "http://85.31.230.163:8080/api/generar-especificaciones";

/**
 * Función que extrae ítems del texto plano/Markdown si el usuario escribe una lista o requerimiento
 */
function parseItemsFromRawInput(text: string, existingItems: ItemAdquisicion[]): Array<{
  numero: number;
  descripcion: string;
  unidad: string;
  cantidad: number;
  caracteristicas: string;
}> {
  if (existingItems && existingItems.length > 0) {
    return existingItems.map((it, idx) => ({
      numero: it.item || idx + 1,
      descripcion: it.descripcion,
      unidad: it.unidad || "Pza",
      cantidad: Number(it.cantidad) || 1,
      caracteristicas: it.caracteristicasTecnicas || it.especificacionMinima || "Según especificación técnica requerida por ENDE Deoruro S.A.",
    }));
  }

  if (!text || typeof text !== "string") {
    return [
      {
        numero: 1,
        descripcion: "BIEN O SERVICIO PRINCIPAL",
        unidad: "Pza",
        cantidad: 1,
        caracteristicas: "Conforme a normas técnicas y requerimiento institucional",
      },
    ];
  }

  const itemsFound: Array<{
    numero: number;
    descripcion: string;
    unidad: string;
    cantidad: number;
    caracteristicas: string;
  }> = [];

  // Buscar líneas de tabla Markdown tipo: | 1 | Alicate | 10 | PZA | Mango aislado |
  const lines = text.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("|") && !trimmed.includes("---") && !trimmed.toLowerCase().includes("ítem") && !trimmed.toLowerCase().includes("descripcion")) {
      const parts = trimmed.split("|").map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const num = parseInt(parts[0]) || itemsFound.length + 1;
        const desc = parts[1] || `ÍTEM ${num}`;
        const cant = parseInt(parts[2]) || parseInt(parts[3]) || 1;
        const unidad = parts[3]?.length <= 5 ? parts[3] : (parts[2]?.length <= 5 ? parts[2] : "Pza");
        const carac = parts[4] || parts[2] || "Conforme a especificaciones técnicas";
        itemsFound.push({
          numero: num,
          descripcion: desc.toUpperCase(),
          unidad,
          cantidad: cant,
          caracteristicas: carac,
        });
      }
    }
  }

  // Si no había tabla, buscar patrones tipo: "10 alicates", "15 destornilladores", "1. Botas..."
  if (itemsFound.length === 0) {
    for (const line of lines) {
      const trimmed = line.trim();
      const matchNumList = trimmed.match(/^(\d+)[\.\-\)]\s+(.+)/);
      const matchCantDesc = trimmed.match(/^(\d+)\s+(pzas?|unidades?|pares?|estudios?|juegos?)?\s*(de\s+)?(.+)/i);

      if (matchNumList) {
        itemsFound.push({
          numero: itemsFound.length + 1,
          descripcion: matchNumList[2].trim().toUpperCase(),
          unidad: "Pza",
          cantidad: 1,
          caracteristicas: "Conforme a especificaciones técnicas y estándares de calidad de ENDE Deoruro",
        });
      } else if (matchCantDesc) {
        const cant = parseInt(matchCantDesc[1]) || 1;
        const unidad = matchCantDesc[2] ? matchCantDesc[2].toUpperCase() : "PZA";
        const desc = matchCantDesc[4].trim().toUpperCase();
        itemsFound.push({
          numero: itemsFound.length + 1,
          descripcion: desc,
          unidad,
          cantidad: cant,
          caracteristicas: "Fabricación homologada con estándares de seguridad y especificación técnica",
        });
      }
    }
  }

  // Si aún no se encontró ningún ítem estructurado, crear al menos 1 ítem representativo del texto
  if (itemsFound.length === 0) {
    const firstLine = lines.find((l) => l.trim().length > 3)?.trim() || "ADQUISICIÓN REQUERIDA";
    itemsFound.push({
      numero: 1,
      descripcion: firstLine.toUpperCase(),
      unidad: "PZA",
      cantidad: 1,
      caracteristicas: text.substring(0, 300) || "Conforme a especificaciones técnicas de ENDE Deoruro S.A.",
    });
  }

  return itemsFound;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { adquisicion, insumoTexto, documentText } = body as {
      adquisicion: Adquisicion;
      insumoTexto?: string;
      documentText?: string;
    };

    if (!adquisicion) {
      return NextResponse.json({ error: "Adquisición requerida" }, { status: 400 });
    }

    const rawInputText = documentText || insumoTexto || adquisicion.justificacion_texto || "";
    const itemsForVps = parseItemsFromRawInput(rawInputText, adquisicion.items || []);

    const titulo = (adquisicion.titulo_proceso || "ADQUISICIÓN DE BIENES").toUpperCase();
    const justificacion = adquisicion.justificacion_texto || insumoTexto ||
      "Garantizar la continuidad operativa de las cuadrillas de mantenimiento y cumplimiento normativo institucional de ENDE DEORURO S.A.";
    const elaborado = adquisicion.elaborado_por || adquisicion.responsable_proceso || "Ing. Responsable Técnico ENDE DEORURO S.A.";
    const plazoEntrega = adquisicion.tiempo_entrega_texto || `${adquisicion.plazo_entrega_dias || 30} días calendario`;
    const lugarEntrega = adquisicion.lugar_entrega || "Almacenes ENDE DEORURO S.A., Oruro";
    const vigencia = adquisicion.vigencia_propuesta_texto || "30 días calendario";

    const vpsPayload = {
      titulo_adquisicion: titulo,
      justificacion: justificacion,
      items: itemsForVps,
      elaborado: elaborado,
      plazo_entrega: plazoEntrega,
      lugar_entrega: lugarEntrega,
      vigencia_propuesta: vigencia,
    };

    // 1. Enviar DIRECTAMENTE al VPS para que la IA del VPS procese y genere DOCX + PDF
    let vpsData: any = null;
    try {
      const vpsRes = await fetch(VPS_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vpsPayload),
        signal: AbortSignal.timeout(45000),
      });

      if (vpsRes.ok) {
        vpsData = await vpsRes.json();
      }
    } catch (e: any) {
      console.warn("VPS call error, procediendo con datos estructurados:", e.message);
    }

    // 2. Mapear los ítems recibidos/enviados al formato de la tabla del visor
    const mappedItems: ItemAdquisicion[] = itemsForVps.map((it, idx) => ({
      id: `item-vps-${Date.now()}-${idx}`,
      item: it.numero,
      descripcion: it.descripcion,
      unidad: it.unidad,
      cantidad: it.cantidad,
      precioUnitarioEstimado: 0,
      precioTotalEstimado: 0,
      caracteristicasTecnicas: it.caracteristicas,
      especificacionMinima: it.caracteristicas,
      productoEntregable: "Conforme a especificaciones técnicas y entrega oficial",
      propuestoOferente: "Cumple con los requisitos solicitados",
      valores_columnas: [String(it.numero), it.descripcion, it.caracteristicas, String(it.cantidad)],
      fichaTecnica: {
        uso: "Personal Operativo y Mantenimiento ENDE DEORURO S.A.",
        normaCertificacion: "Norma ASTM / ISO 9001 / Homologación Oficial",
        material: "Material homologado de alta resistencia y seguridad",
        color: "Estándar",
        dimensiones: "Según requerimiento técnico",
        categoriaItem: "Bienes y Suministros Oficiales",
        caracteristicasDetalle: [it.caracteristicas],
      },
    }));

    const structuredResult = {
      titulo_proceso: titulo,
      antecedentes_texto:
        "De acuerdo a la legislación vigente, normas y políticas internas se inicia el presente proceso de adquisición para el cumplimiento de los objetivos operativos e institucionales de la Distribuidora de Electricidad ENDE DEORURO S.A., conforme al Reglamento de Contrataciones SBC.",
      justificacion_texto: justificacion,
      calidad_texto:
        "Los bienes deberán ser nuevos, de primer uso y fabricados bajo normas de calidad aplicables con garantía oficial del fabricante.",
      ambito_aplicacion:
        "Personal institucional y áreas operativas de la Distribuidora de Electricidad ENDE DEORURO S.A.",
      metodo_seleccion_texto: "Menor Precio (Art. 31 del Reglamento SBC).",
      vigencia_propuesta_texto: "Tendrá una validez mínima de 30 días calendario computables a partir de la fecha de presentación de la propuesta.",
      categoria_texto: "Bienes, Herramientas y Suministros Oficiales.",
      lugar_entrega: lugarEntrega,
      tiempo_entrega_texto: `Máximo ${adquisicion.plazo_entrega_dias || 30} días calendario computables a partir del día siguiente hábil de la recepción de la Orden de Compra.`,
      forma_adjudicacion: "Por Ítem requerido, formalizada por Orden de Compra (Art. 31 SBC).",
      aceptacion_lote: "El personal técnico de ENDE DEORURO realizará una evaluación técnica de conformidad el día de la entrega.",
      forma_pago_texto:
        "El pago se realizará contra entrega satisfactoria del producto o servicio, conformidad emitida por ENDE DEORURO S.A. y entrega de la documentación de respaldo: Nota de Entrega, Solicitud de Pago y Factura oficial.",
      multas_texto: `Ante el incumplimiento de los plazos establecidos en la Orden de Compra, se aplicará la multa del ${adquisicion.multa_diaria_porcentaje || 0.25}% por cada día de retraso injustificado.`,
      seccion3_introduccion_texto: "Detalle técnico y especificaciones de los requerimientos:",
      tipo_tabla_sugerido: "BIENES_SIMPLE" as const,
      columnas_tabla_tdr: ["No.", "DESCRIPCIÓN DEL ÍTEM", "CARACTERÍSTICAS / ESPECIFICACIÓN TÉCNICA", "CANT."],
      items: mappedItems,
      vpsData: vpsData,
    };

    return NextResponse.json({
      success: true,
      data: structuredResult,
      vps_status: vpsData ? "success" : "fallback",
      docx_file: vpsData?.docx_file,
      pdf_file: vpsData?.pdf_file,
      download_docx: vpsData?.download_docx,
      download_pdf: vpsData?.download_pdf,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al procesar con el servidor VPS" }, { status: 500 });
  }
}
