import { NextRequest, NextResponse } from "next/server";
import { Adquisicion, ItemAdquisicion } from "@/types";

const VPS_API_URL = "http://85.31.230.163:8080/api/generar-especificaciones";

/**
 * Limpieza profunda de Markdown y caracteres de formato
 */
function cleanMarkdownText(text: string): string {
  if (!text) return "";
  return text
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/?[^>]+(>|$)/g, "")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/__/g, "")
    .replace(/_/g, "")
    .replace(/^#+\s*/gm, "")
    .trim();
}

/**
 * Extrae ítems limpios del texto plano/Markdown con máxima precisión
 */
function parseItemsFromRawInput(text: string, existingItems: ItemAdquisicion[]): Array<{
  numero: number;
  descripcion: string;
  unidad: string;
  cantidad: number;
  caracteristicas: string;
}> {
  // Si el usuario provee un texto nuevo, ese texto tiene PRIORIDAD ABSOLUTA sobre items antiguos
  if (text && text.trim().length > 5) {
    const clean = cleanMarkdownText(text);
    const itemsFound: Array<{
      numero: number;
      descripcion: string;
      unidad: string;
      cantidad: number;
      caracteristicas: string;
    }> = [];

    // 1. Tablas Markdown (| 1 | Alicate | 10 | PZA | ...)
    const lines = clean.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("|") && !trimmed.includes("---") && !trimmed.toLowerCase().includes("ítem") && !trimmed.toLowerCase().includes("descripcion")) {
        const parts = trimmed.split("|").map((p) => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
          const num = parseInt(parts[0]) || itemsFound.length + 1;
          const desc = parts[1] || `ÍTEM ${num}`;
          const cant = parseInt(parts[2]) || parseInt(parts[3]) || 1;
          const unidad = parts[3]?.length <= 6 ? parts[3] : (parts[2]?.length <= 6 ? parts[2] : "PZA");
          const carac = parts[4] || parts[2] || "Conforme a especificaciones técnicas oficiales";
          itemsFound.push({
            numero: num,
            descripcion: desc.toUpperCase(),
            unidad: unidad.toUpperCase(),
            cantidad: cant,
            caracteristicas: carac,
          });
        }
      }
    }

    if (itemsFound.length > 0) return itemsFound;

    // 2. Separar por comas, 'y', saltos de línea o dos puntos
    const segments = clean.split(/(?:\r?\n|;|\s+y\s+|,\s*)/i);
    for (const seg of segments) {
      const trimmed = seg.trim().replace(/^adquisición\s+de\s+[^:]*:\s*/i, "").trim();
      if (!trimmed || trimmed.length < 3) continue;

      const matchNumList = trimmed.match(/^(\d+)[\.\-\)]\s+(.+)/);
      const matchCantDesc = trimmed.match(/^(\d+)\s*(?:pzas?|unidades?|pares?|estudios?|juegos?|global|lote)?\s*(?:de\s+)?(.+)/i);

      if (matchNumList) {
        itemsFound.push({
          numero: itemsFound.length + 1,
          descripcion: matchNumList[2].trim().toUpperCase(),
          unidad: "PZA",
          cantidad: 1,
          caracteristicas: "Conforme a especificaciones técnicas y estándares de calidad de ENDE DEORURO S.A.",
        });
      } else if (matchCantDesc) {
        const cant = parseInt(matchCantDesc[1]) || 1;
        const desc = matchCantDesc[2].trim().replace(/\.$/, "").toUpperCase();
        itemsFound.push({
          numero: itemsFound.length + 1,
          descripcion: desc,
          unidad: "PZA",
          cantidad: cant,
          caracteristicas: `Fabricación homologada con estándares de seguridad industrial, aislamiento de seguridad y especificación técnica requerida por ENDE DEORURO S.A.`,
        });
      }
    }

    if (itemsFound.length > 0) return itemsFound;

    // 3. Fallback de texto simple
    itemsFound.push({
      numero: 1,
      descripcion: clean.toUpperCase(),
      unidad: "PZA",
      cantidad: 1,
      caracteristicas: "Conforme a especificaciones técnicas y requerimientos de ENDE DEORURO S.A.",
    });
    return itemsFound;
  }

  // Si no hay texto nuevo, usar existingItems
  if (existingItems && existingItems.length > 0) {
    return existingItems.map((it, idx) => ({
      numero: it.item || idx + 1,
      descripcion: cleanMarkdownText(it.descripcion).toUpperCase(),
      unidad: cleanMarkdownText(it.unidad) || "PZA",
      cantidad: Number(it.cantidad) || 1,
      caracteristicas: cleanMarkdownText(it.caracteristicasTecnicas || it.especificacionMinima || "Según especificación técnica requerida por ENDE DEORURO S.A."),
    }));
  }

  return [
    {
      numero: 1,
      descripcion: "BIEN O SERVICIO PRINCIPAL",
      unidad: "PZA",
      cantidad: 1,
      caracteristicas: "Conforme a normas técnicas y requerimiento institucional",
    },
  ];
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

    const rawInputText = documentText || insumoTexto || "";
    const itemsForVps = parseItemsFromRawInput(rawInputText, adquisicion.items || []);

    // Extraer título limpio a partir del requerimiento
    let titulo = cleanMarkdownText(adquisicion.titulo_proceso || "");
    if (rawInputText && rawInputText.length > 5) {
      const matchTitulo = rawInputText.match(/^(?:adquisición\s+de|contratación\s+de|servicio\s+de)\s+([^:\n]+)/i);
      if (matchTitulo && matchTitulo[1]) {
        titulo = `ADQUISICIÓN DE ${matchTitulo[1].trim().toUpperCase()}`;
      } else if (!titulo || titulo === "ADQUISICIÓN DE BIENES") {
        titulo = `ADQUISICIÓN DE ${itemsForVps[0]?.descripcion || "BIENES Y HERRAMIENTAS"}`;
      }
    }
    if (!titulo) titulo = "ADQUISICIÓN DE BIENES Y MATERIALES";

    const isSalud = (adquisicion.categoria as string) === "Salud Ocupacional" ||
      titulo.toLowerCase().includes("oftalmo") ||
      titulo.toLowerCase().includes("laboratorio") ||
      titulo.toLowerCase().includes("medicin");

    // Redacción Oficial y Extensa de Antecedentes (3 párrafos formales de ENDE DEORURO)
    const antecedentesExtenso = isSalud
      ? "La DISTRIBUIDORA DE ELECTRICIDAD ENDE DEORURO S.A., como empresa filial de ENDE Corporación, tiene el firme compromiso de velar por la salud, seguridad ocupacional y bienestar integral de todo su personal operativo, técnico y administrativo en estricto cumplimiento de la Ley General de Higiene, Seguridad Ocupacional y Bienestar (D.L. 16998).\n\nEn el marco del Plan Anual de Salud Ocupacional y Medicina del Trabajo, la empresa programa de manera periódica la realización de exámenes médicos especializados, estudios de laboratorio y evaluaciones clínicas ocupacionales a fin de monitorear oportunamente las condiciones de salud de los trabajadores expuestos a diversos factores de riesgo laboral.\n\nEn virtud a lo establecido en la normativa legal vigente, reglamentos internos y el Reglamento de Adquisición de Bienes, Construcción de Obras y Contratación de Servicios (SBC) de ENDE DEORURO S.A., se promueve el presente proceso de contratación para la prestación del servicio médico ocupacional."
      : `La DISTRIBUIDORA DE ELECTRICIDAD ENDE DEORURO S.A., en su condición de empresa distribuidora de energía eléctrica en el departamento de Oruro y filial de ENDE Corporación, tiene la misión fundamental de garantizar la continuidad, confiabilidad y calidad del suministro de energía eléctrica a toda la población usuaria e industrial de su área de concesión.\n\nPara el desarrollo eficiente de las operaciones técnicas, mantenimiento preventivo y correctivo de redes de media y baja tensión, subestaciones y atención de emergencias, se requiere dotar al personal técnico y cuadrillas de campo con herramientas y materiales de primer nivel que cumplan rigurosamente con los estándares y normas técnicas aplicables (ASTM, IEC, ISO).\n\nEn el marco de la normativa sectorial y el Reglamento de Adquisición de Bienes, Construcción de Obras y Contratación de Servicios (SBC) vigente en ENDE DEORURO S.A., se tramita el presente proceso para la "${titulo}" a solicitud de la unidad correspondiente, orientada a mantener la capacidad operativa y altos estándares de seguridad industrial.`;

    // Redacción Oficial y Extensa de Justificación (4 párrafos fundamentados)
    const justificacionExtensa = isSalud
      ? "1. NECESIDAD INSTITUCIONAL:\nLa ejecución de los exámenes médicos ocupacionales es un requisito legal y técnico indispensable para evaluar la aptitud física y médica del personal, detectando precozmente cualquier alteración de la salud vinculada a las actividades operativas.\n\n2. COBERTURA Y ALCANCE:\nEl servicio especializado permitirá contar con diagnósticos certeros, certificados médicos de aptitud laboral e informes individuales confidenciales que respaldan los programas de vigilancia epidemiológica de la empresa.\n\n3. MITIGACIÓN DE RIESGOS LABORALES:\nLa prevención de enfermedades laborales y accidentes mediante el control médico continuo garantiza un entorno laboral seguro y reduce el ausentismo laboral, optimizando el rendimiento institucional.\n\n4. DECLARACIÓN DE IMPERIOSA NECESIDAD:\nPor las razones expuestas y en resguardo del bienestar del capital humano de la empresa, resulta imperiosa y justificada la contratación del presente servicio especializado de salud ocupacional."
      : `1. IDENTIFICACIÓN DE LA NECESIDAD:\nLa permanente ejecución de maniobras en redes eléctricas de distribución y subestaciones exige que el personal cuente con herramientas certificadas de alta resistencia y propiedades dieléctricas (1000V) para prevenir descargas eléctricas y accidentes de trabajo.\n\n2. CONDICIONES OPERATIVAS Y DE SEGURIDAD:\nEl desgaste natural de las herramientas de uso continuo en cuadrillas de emergencia y mantenimiento requiere su oportuna reposición con ítems homologados que garanticen la integridad física del trabajador y la precisión en los trabajos de campo.\n\n3. MITIGACIÓN DE RIESGOS Y CONTINUIDAD:\nContar con herramientas en óptimas condiciones minimiza los tiempos de interrupción del suministro eléctrico durante fallas imprevistas, permitiendo una rápida restitución del servicio en cumplimiento de los índices de calidad exigidos por la Autoridad de Fiscalización de Electricidad y Tecnología Nuclear (AETN).\n\n4. DECLARACIÓN IMPERIOSA DE ADQUISICIÓN:\nPor consiguiente, la adquisición de ${itemsForVps.map(i => `${i.cantidad} ${i.descripcion.toLowerCase()}`).join(", ")} constituye una inversión operativa prioritaria e indispensable para el cumplimiento ininterrumpido de los planes de mantenimiento y seguridad laboral de ENDE DEORURO S.A.`;

    const elaborado = cleanMarkdownText(adquisicion.elaborado_por || adquisicion.responsable_proceso || "Ing. Responsable Técnico ENDE DEORURO S.A.");
    const plazoEntrega = cleanMarkdownText(adquisicion.tiempo_entrega_texto || `Máximo ${adquisicion.plazo_entrega_dias || 30} días calendario`);
    const lugarEntrega = cleanMarkdownText(adquisicion.lugar_entrega || "Almacenes ENDE DEORURO S.A., Oruro");
    const vigencia = cleanMarkdownText(adquisicion.vigencia_propuesta_texto || "30 días calendario");

    const vpsPayload = {
      titulo_adquisicion: titulo,
      justificacion: justificacionExtensa,
      items: itemsForVps,
      elaborado: elaborado,
      plazo_entrega: plazoEntrega,
      lugar_entrega: lugarEntrega,
      vigencia_propuesta: vigencia,
    };

    // 1. Enviar al VPS para generar DOCX y PDF nativo en LibreOffice
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
      console.warn("VPS call error, procediendo con datos enriquecidos:", e.message);
    }

    // 2. Mapear los ítems recibidos al formato de la tabla del visor
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
      valores_columnas: isSalud
        ? [it.descripcion, it.caracteristicas, "Cumple según metodología médica"]
        : [String(it.numero), it.descripcion, it.caracteristicas, String(it.cantidad)],
      fichaTecnica: {
        uso: isSalud ? "Medicina del Trabajo y Salud Ocupacional" : "Personal Operativo y Cuadrillas de Mantenimiento ENDE DEORURO S.A.",
        normaCertificacion: isSalud ? "Acreditación y Control de Calidad Sanitario" : "Norma ASTM / ISO 9001 / IEC 60900 (Aislación 1000V)",
        material: isSalud ? "Metodología Analítica Validada" : "Acero forjado con aislamiento dieléctrico de alta seguridad",
        color: "Estándar",
        dimensiones: "Según requerimiento técnico",
        categoriaItem: isSalud ? "Servicios de Salud Ocupacional" : "Herramientas de Mano Aisladas",
        caracteristicasDetalle: [it.caracteristicas],
      },
    }));

    const structuredResult = {
      titulo_proceso: titulo,
      antecedentes_texto: antecedentesExtenso,
      justificacion_texto: justificacionExtensa,
      calidad_texto: isSalud
        ? "Cumplimiento obligatorio de credenciales sanitarias, habilitación del SEDES y control de calidad médico ocupacional."
        : "Los bienes deberán ser nuevos, de primer uso y fabricados bajo normas de calidad aplicables (ASTM/IEC/ISO) con garantía oficial del fabricante.",
      ambito_aplicacion:
        "Personal institucional y áreas operativas de la Distribuidora de Electricidad ENDE DEORURO S.A.",
      metodo_seleccion_texto: "Menor Precio (Art. 31 del Reglamento SBC).",
      vigencia_propuesta_texto: "Tendrá una validez mínima de 30 días calendario computables a partir de la fecha de presentación de la propuesta.",
      categoria_texto: isSalud ? "Salud Ocupacional y Medicina del Trabajo." : "Herramientas y Equipos de Seguridad.",
      lugar_entrega: lugarEntrega,
      tiempo_entrega_texto: `Máximo ${adquisicion.plazo_entrega_dias || 30} días calendario computables a partir del día siguiente hábil de la recepción de la Orden de Compra.`,
      forma_adjudicacion: "Por Ítem requerido, formalizada por Orden de Compra (Art. 31 SBC).",
      aceptacion_lote: "El personal técnico de ENDE DEORURO realizará una evaluación técnica de conformidad el día de la entrega.",
      forma_pago_texto:
        "El pago se realizará contra entrega satisfactoria del producto o servicio, conformidad emitida por ENDE DEORURO S.A. y entrega de la documentación de respaldo: Nota de Entrega, Solicitud de Pago y Factura oficial.",
      multas_texto: `Ante el incumplimiento de los plazos establecidos en la Orden de Compra, se aplicará la multa del ${adquisicion.multa_diaria_porcentaje || 0.25}% por cada día de retraso injustificado.`,
      seccion3_introduccion_texto: "Detalle técnico y especificaciones de las herramientas requeridas:",
      tipo_tabla_sugerido: isSalud ? ("SALUD_OCUPACIONAL" as const) : ("BIENES_SIMPLE" as const),
      columnas_tabla_tdr: isSalud
        ? ["EXAMEN / SERVICIO REQUERIDO", "ESPECIFICACIÓN MÍNIMA REQUERIDA", "PROPUESTO / INFORMAR"]
        : ["No.", "DESCRIPCIÓN DEL ÍTEM", "CARACTERÍSTICAS / ESPECIFICACIÓN TÉCNICA", "CANT."],
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
