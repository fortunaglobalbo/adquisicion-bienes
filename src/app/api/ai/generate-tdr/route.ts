import { NextRequest, NextResponse } from "next/server";
import { Adquisicion, ItemAdquisicion } from "@/types";

const VPS_API_URL = "http://85.31.230.163:8080/api/generar-especificaciones";

function parseSpanishNumber(word: string): number | null {
  const map: Record<string, number> = {
    un: 1, uno: 1, una: 1,
    dos: 2,
    tres: 3,
    cuatro: 4,
    cinco: 5,
    seis: 6,
    siete: 7,
    ocho: 8,
    nueve: 9,
    diez: 10,
    once: 11,
    doce: 12,
    quince: 15,
    veinte: 20,
    treinta: 30,
    cincuenta: 50,
    cien: 100,
  };
  const lower = word.toLowerCase().trim();
  return map[lower] || null;
}

/**
 * Limpieza profunda de Markdown, comillas y caracteres estructurales
 */
function cleanFormatting(text: string): string {
  if (!text) return "";
  return text
    .replace(/[\"\'\“\”\«\»\`]/g, "")
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
 * Parser determinista y multi-ítem con soporte de números dígitos y palabras en español
 */
function parseItemsRobust(text: string, existingItems: ItemAdquisicion[]): Array<{
  numero: number;
  descripcion: string;
  unidad: string;
  cantidad: number;
  caracteristicas: string;
}> {
  if (text && text.trim().length > 3) {
    let clean = cleanFormatting(text);
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

    // 2. Extraer texto después del prefijo institucional si existe
    clean = clean.replace(/^(?:adquisición|contratación|servicio|compra)\s+(?:de|para)\s+[^:]*:\s*/i, "").trim();

    // 3. Dividir por conectores de lista: " y ", ",", ";", "\n"
    const clauses = clean.split(/(?:\r?\n|;|\s+y\s+|,\s*)/i);

    for (const clause of clauses) {
      const trimmed = clause.trim();
      if (!trimmed || trimmed.length < 2) continue;

      // 1. Probar con dígitos al inicio: "20 alicates...", "3 carretillas..."
      const matchDigit = trimmed.match(/^(\d+)\s*(?:pzas?|unidades?|pares?|estudios?|juegos?|global|lote|rollos?|cajas?)?\s*(?:de\s+)?(.+)$/i);
      // 2. Probar con palabras numéricas en español ordenadas por longitud
      const matchWord = trimmed.match(/^(cincuenta|treinta|veinte|quince|cuatro|cinco|siete|nueve|ocho|seis|once|doce|diez|tres|dos|una|uno|un|cien)\s*(?:pzas?|unidades?|pares?|estudios?|juegos?|global|lote|rollos?|cajas?)?\s*(?:de\s+)?(.+)$/i);

      let cant = 1;
      let desc = trimmed;
      let unidad = "PZA";

      if (matchDigit) {
        cant = parseInt(matchDigit[1]) || 1;
        desc = matchDigit[2].trim();
      } else if (matchWord) {
        cant = parseSpanishNumber(matchWord[1]) || 1;
        desc = matchWord[2].trim();
      }

      desc = desc.replace(/[\:\-\.\,\;]+$/, "").trim();
      if (desc.length < 2) continue;

      let carac = "Fabricación homologada con estándares de calidad y especificación técnica de ENDE DEORURO S.A.";
      const lowerDesc = desc.toLowerCase();
      if (lowerDesc.includes("alicate")) {
        carac = "Fabricación en acero forjado al cromo-vanadio, aislamiento dieléctrico 1000V conforme a norma ASTM/IEC 60900, mango ergonómico antideslizante.";
      } else if (lowerDesc.includes("carretilla")) {
        carac = "Tolva de chapa de acero reforzada de alta capacidad (60 a 80 L), chasis tubular de gran resistencia, rueda neumática con rodamiento reforzado para obras y mantenimiento.";
      } else if (lowerDesc.includes("pala")) {
        carac = "Hoja de acero templado de alta dureza con tratamiento anticorrosivo, cabo de madera seleccionada o fibra de vidrio con empuñadura ergonómica en 'Y'.";
      } else if (lowerDesc.includes("cinta")) {
        unidad = "ROLLO";
        carac = "Cinta aislante de PVC de grado profesional para uso eléctrico, retardante a la llama, aislamiento dieléctrico hasta 1000V y resistencia a la intemperie.";
      } else if (lowerDesc.includes("destornillador")) {
        carac = "Varilla de acero aleado templado de alta tenacidad, punta plana magnetizada endurecida y mango ergonómico aislado 1000V conforme a norma IEC 60900.";
      } else if (lowerDesc.includes("guante") || lowerDesc.includes("casco")) {
        carac = "Equipo de protección personal certificado conforme a norma ANSI / ASTM de seguridad industrial.";
      }

      itemsFound.push({
        numero: itemsFound.length + 1,
        descripcion: desc.toUpperCase(),
        unidad,
        cantidad: cant,
        caracteristicas: carac,
      });
    }

    if (itemsFound.length > 0) return itemsFound;

    // 4. Fallback de texto simple
    itemsFound.push({
      numero: 1,
      descripcion: clean.toUpperCase(),
      unidad: "PZA",
      cantidad: 1,
      caracteristicas: "Conforme a especificaciones técnicas y requerimientos de ENDE DEORURO S.A.",
    });
    return itemsFound;
  }

  if (existingItems && existingItems.length > 0) {
    return existingItems.map((it, idx) => ({
      numero: it.item || idx + 1,
      descripcion: cleanFormatting(it.descripcion).toUpperCase(),
      unidad: cleanFormatting(it.unidad) || "PZA",
      cantidad: Number(it.cantidad) || 1,
      caracteristicas: cleanFormatting(it.caracteristicasTecnicas || it.especificacionMinima || "Según especificación técnica requerida por ENDE DEORURO S.A."),
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
    const itemsForVps = parseItemsRobust(rawInputText, adquisicion.items || []);

    // Extraer título limpio a partir del requerimiento
    let titulo = cleanFormatting(adquisicion.titulo_proceso || "");
    if (rawInputText && rawInputText.length > 5) {
      const matchTitulo = rawInputText.match(/^(?:adquisición\s+de|contratación\s+de|servicio\s+de)\s+([^:\n]+)/i);
      if (matchTitulo && matchTitulo[1]) {
        titulo = `ADQUISICIÓN DE ${cleanFormatting(matchTitulo[1]).toUpperCase()}`;
      } else if (!titulo || titulo === "ADQUISICIÓN DE BIENES") {
        titulo = `ADQUISICIÓN DE ${itemsForVps[0]?.descripcion || "HERRAMIENTAS Y EQUIPOS"}`;
      }
    }
    if (!titulo) titulo = "ADQUISICIÓN DE HERRAMIENTAS Y MATERIALES";

    const isSalud = (adquisicion.categoria as string) === "Salud Ocupacional" ||
      titulo.toLowerCase().includes("oftalmo") ||
      titulo.toLowerCase().includes("laboratorio") ||
      titulo.toLowerCase().includes("medicin");

    // Redacción Oficial y Extensa de Antecedentes (3 párrafos formales de ENDE DEORURO)
    const antecedentesExtenso = isSalud
      ? "La DISTRIBUIDORA DE ELECTRICIDAD ENDE DEORURO S.A., como empresa filial de ENDE Corporación, tiene el firme compromiso de velar por la salud, seguridad ocupacional y bienestar integral de todo su personal operativo, técnico y administrativo en estricto cumplimiento de la Ley General de Higiene, Seguridad Ocupacional y Bienestar (D.L. 16998).\n\nEn el marco del Plan Anual de Salud Ocupacional y Medicina del Trabajo, la empresa programa de manera periódica la realización de exámenes médicos especializados, estudios de laboratorio y evaluaciones clínicas ocupacionales a fin de monitorear oportunamente las condiciones de salud de los trabajadores expuestos a diversos factores de riesgo laboral.\n\nEn virtud a lo establecido en la normativa legal vigente, reglamentos internos y el Reglamento de Adquisición de Bienes, Construcción de Obras y Contratación de Servicios (SBC) de ENDE DEORURO S.A., se promueve el presente proceso de contratación para la prestación del servicio médico ocupacional."
      : `La DISTRIBUIDORA DE ELECTRICIDAD ENDE DEORURO S.A., en su condición de empresa distribuidora de energía eléctrica en el departamento de Oruro y filial de ENDE Corporación, tiene la misión fundamental de garantizar la continuidad, confiabilidad y calidad del suministro de energía eléctrica a toda la población usuaria e industrial de su área de concesión.\n\nPara el desarrollo eficiente de las operaciones técnicas, mantenimiento preventivo y correctivo de redes de media y baja tensión, subestaciones y atención de emergencias, se requiere dotar al personal técnico y cuadrillas de campo con herramientas, equipos y materiales de primer nivel que cumplan rigurosamente con los estándares y normas técnicas aplicables (ASTM, IEC, ISO).\n\nEn el marco de la normativa sectorial y el Reglamento de Adquisición de Bienes, Construcción de Obras y Contratación de Servicios (SBC) vigente en ENDE DEORURO S.A., se tramita el presente proceso para la "${titulo}" a solicitud de la unidad correspondiente, orientada a mantener la capacidad operativa y altos estándares de seguridad industrial.`;

    // Resumen exacto de los ítems requeridos para la justificación técnica
    const itemsNombres = itemsForVps.map((i) => `${i.cantidad} ${i.descripcion.toLowerCase()}`).join(", ");

    // Redacción Oficial y Extensa de Justificación (4 párrafos fundamentados en los ítems exactos)
    const justificacionExtensa = isSalud
      ? "1. NECESIDAD INSTITUCIONAL:\nLa ejecución de los exámenes médicos ocupacionales es un requisito legal y técnico indispensable para evaluar la aptitud física y médica del personal, detectando precozmente cualquier alteración de la salud vinculada a las actividades operativas.\n\n2. COBERTURA Y ALCANCE:\nEl servicio especializado permitirá contar con diagnósticos certeros, certificados médicos de aptitud laboral e informes individuales confidenciales que respaldan los programas de vigilancia epidemiológica de la empresa.\n\n3. MITIGACIÓN DE RIESGOS LABORALES:\nLa prevención de enfermedades laborales y accidentes mediante el control médico continuo garantiza un entorno laboral seguro y reduce el ausentismo laboral, optimizando el rendimiento institucional.\n\n4. DECLARACIÓN DE IMPERIOSA NECESIDAD:\nPor las razones expuestas y en resguardo del bienestar del capital humano de la empresa, resulta imperiosa y justificada la contratación del presente servicio especializado de salud ocupacional."
      : `1. IDENTIFICACIÓN DE LA NECESIDAD:\nLa permanente ejecución de maniobras operativas en redes eléctricas de distribución, subestaciones y obras civiles exige dotar a las cuadrillas de campo con herramientas certificadas, equipos de transporte menor y herramientas manuales aisladas para prevenir descargas eléctricas y accidentes laborales.\n\n2. CONDICIONES OPERATIVAS Y DE SEGURIDAD:\nEl desgaste natural de las herramientas de uso continuo en cuadrillas de emergencia y mantenimiento requiere su oportuna reposición con ítems homologados que garanticen la integridad física del trabajador y la precisión en los trabajos de campo.\n\n3. MITIGACIÓN DE RIESGOS Y CONTINUIDAD:\nContar con herramientas en óptimas condiciones minimiza los tiempos de interrupción del suministro eléctrico durante fallas imprevistas, permitiendo una rápida restitución del servicio en cumplimiento de los índices de calidad exigidos por la Autoridad de Fiscalización de Electricidad y Tecnología Nuclear (AETN).\n\n4. DECLARACIÓN IMPERIOSA DE ADQUISICIÓN:\nPor consiguiente, la adquisición de ${itemsNombres} constituye una inversión operativa prioritaria e indispensable para el cumplimiento ininterrumpido de los planes de mantenimiento y seguridad laboral de ENDE DEORURO S.A.`;

    const elaborado = cleanFormatting(adquisicion.elaborado_por || adquisicion.responsable_proceso || "Ing. Responsable Técnico ENDE DEORURO S.A.");
    const plazoEntrega = cleanFormatting(adquisicion.tiempo_entrega_texto || `Máximo ${adquisicion.plazo_entrega_dias || 30} días calendario`);
    const lugarEntrega = cleanFormatting(adquisicion.lugar_entrega || "Almacenes ENDE DEORURO S.A., Oruro");
    const vigencia = cleanFormatting(adquisicion.vigencia_propuesta_texto || "30 días calendario");

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

    // 2. Mapear todos los ítems extraídos al formato de la tabla del visor
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
      productoEntregable: `Entrega física de ${it.cantidad} ${it.unidad} con certificado de calidad y garantía oficial`,
      propuestoOferente: "Cumple con los requisitos técnicos solicitados",
      valores_columnas: isSalud
        ? [it.descripcion, it.caracteristicas, "Cumple según metodología médica"]
        : [String(it.numero), it.descripcion, it.caracteristicas, `Entrega de ${it.cantidad} ${it.unidad}`],
      fichaTecnica: {
        uso: isSalud ? "Medicina del Trabajo y Salud Ocupacional" : "Personal Operativo y Cuadrillas de Mantenimiento ENDE DEORURO S.A.",
        normaCertificacion: isSalud ? "Acreditación y Control de Calidad Sanitario" : "Norma ASTM / ISO 9001 / IEC 60900 (Aislación 1000V)",
        material: isSalud ? "Metodología Analítica Validada" : "Acero forjado con aislamiento dieléctrico de alta seguridad",
        color: "Estándar",
        dimensiones: "Según requerimiento técnico",
        categoriaItem: isSalud ? "Servicios de Salud Ocupacional" : "Herramientas y Equipos de Trabajo",
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
