// Cliente para el proveedor de IA OpenCode Go (OpenAI-Compatible)
import { Adquisicion, ItemAdquisicion, TipoTablaTDR } from "@/types";
import { formatCurrencyBs } from "../docx/formatters";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
}

export async function callOpenCodeGo(
  messages: ChatMessage[],
  temperature = 0.2
): Promise<string> {
  const apiKey = process.env.OPENCODE_GO_API_KEY;
  const baseUrl = (process.env.OPENCODE_GO_BASE_URL || "https://opencode.ai/zen/go/v1").replace(/\/+$/, "");
  const model = process.env.OPENCODE_GO_MODEL || "deepseek-v4-flash-vision-exp";

  if (!apiKey || apiKey === "tu_api_key_de_opencode_aqui") {
    console.warn("OpenCode Go API Key no configurada. Usando generador estructurado institucional local.");
    return "";
  }

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: 4096,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`OpenCode Go API Error [${res.status}]: ${errText}`);
      return "";
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  } catch (error) {
    console.error("Error llamando a OpenCode Go:", error);
    return "";
  }
}

import {
  TDR_SYSTEM_INSTRUCTION,
  GOLD_STANDARD_EXAMPLES,
  GOLD_STANDARD_HEALTH_ANTECEDENTES,
  GOLD_STANDARD_HEALTH_JUSTIFICACION,
  GOLD_STANDARD_TOOLS_ANTECEDENTES,
  GOLD_STANDARD_TOOLS_JUSTIFICACION,
} from "./prompts/tdrGoldStandards";


// Extractor para Carpeta 1 (TDR)
export async function extractTdrFromDocumentOrImageWithAI(
  adquisicion: Adquisicion,
  input: {
    insumoTexto?: string;
    imageBase64?: string;
    documentText?: string;
    nombreArchivo?: string;
  }
): Promise<{
  titulo_proceso?: string;
  items?: ItemAdquisicion[];
  antecedentes_texto?: string;
  justificacion_texto?: string;
  calidad_texto?: string;
  ambito_aplicacion?: string;
  metodo_seleccion_texto?: string;
  vigencia_propuesta_texto?: string;
  categoria_texto?: string;
  lugar_entrega?: string;
  tiempo_entrega_texto?: string;
  forma_adjudicacion?: string;
  aceptacion_lote?: string;
  forma_pago_texto?: string;
  multas_texto?: string;
  puntos_14_texto?: { [num: number]: string };
  resumen_ia?: string;
  categoria_detectada?: string;
  tipo_tabla_sugerido?: TipoTablaTDR;
  seccion3_introduccion_texto?: string;
  columnas_tabla_tdr?: string[];
  puntos_detectados?: { [num: number]: string };
  secciones_14_puntos?: Array<{ numero: number; titulo: string; contenido: string }>;
}> {
  // Si el usuario provee texto o Markdown, ejecutamos primero la extracción literal exacta
  let literalParsed: any = null;
  if (input.documentText) {
    const { parseMarkdownTdrLiteral } = require("./markdownTdrParser");
    literalParsed = parseMarkdownTdrLiteral(input.documentText);
  }

  const systemPrompt = `Eres el Especialista Principal en Contrataciones y Adquisiciones de la DISTRIBUIDORA DE ELECTRICIDAD ENDE DEORURO S.A.
Tu tarea es tomar el documento, texto o Markdown proporcionado por el usuario y transferir su contenido a la plantilla oficial de TDR con FIDELIDAD LITERAL 100% (COPIA FIEL EXACTA).

DIRECTIVAS CRÍTICAS Y OBLIGATORIAS:
1. PROHIBIDO RESUMIR, PARAFRASEAR, SINTETIZAR O CAMBIAR PALABRAS:
   - Extrae el texto EXACTO tal como fue redactado en el documento original. No alteres ni una sola palabra ni inventes texto.
2. COPIA FIEL DE LAS 14 SECCIONES:
   - Copia textualmente el contenido de cada una de las 14 secciones presentes en el insumo:
     1. Antecedentes
     2. Justificación / Necesidad
     4. Calidad
     5. Ámbito de Aplicación
     6. Método de Selección
     7. Vigencia de la Propuesta
     8. Categoría
     9. Lugar de Entrega
     10. Tiempo / Plazo de Entrega
     11. Forma de Adjudicación
     12. Aceptación del Lote / Servicio
     13. Forma de Pago
     14. Aplicación de Multas
3. TABLAS DE CUALQUIER FORMATO:
   - Si es una Matriz de Servicios (4 columnas), extrae en "descripcion" el componente, en "caracteristicasTecnicas" la especificación/alcance técnico completo, y en "productoEntregable" el entregable exacto ("tipo_tabla_sugerido": "MATRIZ_SERVICIOS").
   - Si es una tabla de 3 columnas de Bienes, extrae ítem, descripción y características ("tipo_tabla_sugerido": "BIENES_3_COLS").
   - Si es una tabla de 5 columnas, extrae ítem, descripción, unidad, cantidad y características ("tipo_tabla_sugerido": "BIENES_SIMPLE").
   - Si es de Salud Ocupacional o Laboratorio, extrae examen, metodología y propuesto ("tipo_tabla_sugerido": "SALUD_OCUPACIONAL").

DEBES DEVOLVER ESTRICTAMENTE UN OBJETO JSON VÁLIDO con la siguiente estructura:
{
  "categoria_detectada": "Bienes" | "Servicios" | "Salud Ocupacional" | "Obras",
  "titulo_proceso": "TÍTULO EXACTO DEL PROCESO EN MAYÚSCULAS",
  "tipo_tabla_sugerido": "MATRIZ_SERVICIOS" | "BIENES_3_COLS" | "BIENES_SIMPLE" | "SALUD_OCUPACIONAL" | "FICHAS_DINAMICAS" | "TABLA_DINAMICA",
  "seccion3_introduccion_texto": "Texto introductorio previo a la tabla si existe...",
  "columnas_tabla": ["ÍTEM", "DESCRIPCIÓN DE COMPONENTE", "CARACTERÍSTICAS / ESPECIFICACIÓN TÉCNICA MÍNIMA REQUERIDA", "PRODUCTO ENTREGABLE"],
  "antecedentes_texto": "Texto exacto y completo de antecedentes...",
  "justificacion_texto": "Texto exacto y completo de justificación...",
  "calidad_texto": "Texto exacto de calidad...",
  "ambito_aplicacion": "Texto exacto de ámbito de aplicación...",
  "metodo_seleccion_texto": "Texto exacto de método de selección...",
  "vigencia_propuesta_texto": "Texto exacto de vigencia de propuesta...",
  "categoria_texto": "Texto exacto de categoría...",
  "lugar_entrega": "Texto exacto de lugar de entrega...",
  "tiempo_entrega_texto": "Texto exacto de tiempo/plazo de entrega...",
  "forma_adjudicacion": "Texto exacto de forma de adjudicación...",
  "aceptacion_lote": "Texto exacto de aceptación...",
  "forma_pago_texto": "Texto exacto de forma de pago...",
  "multas_texto": "Texto exacto de multas...",
  "puntos_14": {
    "1": "Texto exacto de antecedentes",
    "2": "Texto exacto de justificación / necesidad",
    "4": "Texto exacto de calidad",
    "5": "Texto exacto de ámbito de aplicación",
    "6": "Texto exacto de método de selección",
    "7": "Texto exacto de vigencia de propuesta",
    "8": "Texto exacto de categoría",
    "9": "Texto exacto de lugar de entrega",
    "10": "Texto exacto de tiempo de entrega",
    "11": "Texto exacto de forma de adjudicación",
    "12": "Texto exacto de aceptación del lote",
    "13": "Texto exacto de forma de pago",
    "14": "Texto exacto de aplicación de multas"
  },
  "items": [
    {
      "item": 1,
      "descripcion": "NOMBRE DEL ÍTEM O COMPONENTE EN MAYÚSCULAS",
      "cantidad": 1,
      "unidad": "SRV" | "PZA" | "PAR" | "LOTE" | "ESTUDIO" | "GLB",
      "precioUnitarioEstimado": 0,
      "caracteristicasTecnicas": "Texto completo de especificaciones técnicas o alcance requerido...",
      "especificacionMinima": "Texto completo de especificaciones...",
      "productoEntregable": "Informe, documento o entregable requerido...",
      "propuestoOferente": "Cumple con las especificaciones técnicas requeridas"
    }
  ]
}`;

  let userContent: any = `Transfiere este documento/texto para el proceso ${adquisicion.codigo} a la plantilla oficial respetando COPIA FIEL 100% LITERAL (PROHIBIDO RESUMIR O PARAFRASEAR):\n`;
  if (input.nombreArchivo) userContent += `Archivo: ${input.nombreArchivo}\n`;
  if (input.documentText) userContent += `Texto provisto:\n${input.documentText}\n`;
  if (input.insumoTexto) userContent += `Instrucción:\n${input.insumoTexto}\n`;

  const messages: ChatMessage[] = [{ role: "system", content: systemPrompt }];

  if (input.imageBase64 && input.imageBase64.startsWith("data:image")) {
    messages.push({
      role: "user",
      content: [
        { type: "text", text: userContent },
        { type: "image_url", image_url: { url: input.imageBase64 } },
      ],
    });
  } else {
    messages.push({
      role: "user",
      content: userContent,
    });
  }

  const aiRaw = await callOpenCodeGo(messages, 0.0);

  if (aiRaw) {
    try {
      const cleanJson = aiRaw.replace(/```json/gi, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleanJson);
      if (parsed.items && Array.isArray(parsed.items) && parsed.items.length > 0) {
        const { cleanInstitutionalText } = require("./markdownTdrParser");
        const rawPuntos14 = {
          ...(literalParsed?.puntos_detectados || {}),
          ...(parsed.puntos_14 || {}),
        };

        const mergedPuntos14: { [num: number]: string } = {};
        for (const [k, v] of Object.entries(rawPuntos14)) {
          if (v && typeof v === "string") {
            mergedPuntos14[Number(k)] = cleanInstitutionalText(v);
          }
        }

        return {
          titulo_proceso: literalParsed?.titulo_proceso || parsed.titulo_proceso || adquisicion.titulo_proceso,
          antecedentes_texto: cleanInstitutionalText(literalParsed?.antecedentes_texto || parsed.antecedentes_texto || parsed.puntos_14?.["1"] || adquisicion.antecedentes_texto),
          justificacion_texto: cleanInstitutionalText(literalParsed?.justificacion_texto || parsed.justificacion_texto || parsed.puntos_14?.["2"] || adquisicion.justificacion_texto),
          calidad_texto: cleanInstitutionalText(literalParsed?.calidad_texto || parsed.calidad_texto || parsed.puntos_14?.["4"] || adquisicion.calidad_texto),
          ambito_aplicacion: cleanInstitutionalText(literalParsed?.ambito_aplicacion || parsed.ambito_aplicacion || parsed.puntos_14?.["5"] || adquisicion.ambito_aplicacion),
          metodo_seleccion_texto: cleanInstitutionalText(literalParsed?.metodo_seleccion_texto || parsed.metodo_seleccion_texto || parsed.puntos_14?.["6"] || adquisicion.metodo_seleccion_texto),
          vigencia_propuesta_texto: cleanInstitutionalText(literalParsed?.vigencia_propuesta_texto || parsed.vigencia_propuesta_texto || parsed.puntos_14?.["7"] || adquisicion.vigencia_propuesta_texto),
          categoria_texto: cleanInstitutionalText(literalParsed?.categoria_texto || parsed.categoria_texto || parsed.puntos_14?.["8"] || adquisicion.categoria_texto),
          lugar_entrega: cleanInstitutionalText(literalParsed?.lugar_entrega || parsed.lugar_entrega || parsed.puntos_14?.["9"] || adquisicion.lugar_entrega),
          tiempo_entrega_texto: cleanInstitutionalText(literalParsed?.tiempo_entrega_texto || parsed.tiempo_entrega_texto || parsed.puntos_14?.["10"] || adquisicion.tiempo_entrega_texto),
          forma_adjudicacion: cleanInstitutionalText(literalParsed?.forma_adjudicacion || parsed.forma_adjudicacion || parsed.puntos_14?.["11"] || adquisicion.forma_adjudicacion),
          aceptacion_lote: cleanInstitutionalText(literalParsed?.aceptacion_lote || parsed.aceptacion_lote || parsed.puntos_14?.["12"] || adquisicion.aceptacion_lote),
          forma_pago_texto: cleanInstitutionalText(literalParsed?.forma_pago_texto || parsed.forma_pago_texto || parsed.puntos_14?.["13"] || adquisicion.forma_pago_texto),
          multas_texto: cleanInstitutionalText(literalParsed?.multas_texto || parsed.multas_texto || parsed.puntos_14?.["14"] || adquisicion.multas_texto),
          seccion3_introduccion_texto: cleanInstitutionalText(literalParsed?.seccion3_introduccion_texto || parsed.seccion3_introduccion_texto || adquisicion.seccion3_introduccion_texto),
          tipo_tabla_sugerido: literalParsed?.tipo_tabla_sugerido || parsed.tipo_tabla_sugerido || adquisicion.tipo_tabla_tdr,
          columnas_tabla_tdr: literalParsed?.columnas_tabla_tdr || parsed.columnas_tabla || adquisicion.columnas_tabla_tdr,
          puntos_detectados: mergedPuntos14,
          puntos_14_texto: mergedPuntos14,
          items: literalParsed?.items && literalParsed.items.length > 0
            ? literalParsed.items
            : parsed.items.map((it: any, idx: number) => ({
                id: `item-ia-${Date.now()}-${idx}`,
                item: it.item || idx + 1,
                descripcion: (it.descripcion || `ÍTEM #${idx + 1}`).toUpperCase(),
                cantidad: Number(it.cantidad) || 1,
                unidad: (it.unidad || (parsed.tipo_tabla_sugerido === "MATRIZ_SERVICIOS" ? "SRV" : "PZA")).toUpperCase(),
                precioUnitarioEstimado: Number(it.precioUnitarioEstimado) || 0,
                precioTotalEstimado: (Number(it.cantidad) || 1) * (Number(it.precioUnitarioEstimado) || 0),
                caracteristicasTecnicas: it.caracteristicasTecnicas || it.especificacionMinima || "",
                especificacionMinima: it.especificacionMinima || it.caracteristicasTecnicas || "",
                productoEntregable: it.productoEntregable || it.propuestoOferente || "",
                propuestoOferente: it.propuestoOferente || it.productoEntregable || "Cumple según especificaciones",
                valores_columnas: it.valores_columnas || [
                  String(it.item || idx + 1),
                  it.descripcion || "",
                  it.caracteristicasTecnicas || "",
                  it.productoEntregable || ""
                ],
                fichaTecnica: {
                  uso: it.fichaTecnica?.uso || (parsed.tipo_tabla_sugerido === "MATRIZ_SERVICIOS" ? "Servicios Especializados" : "Personal Institucional"),
                  normaCertificacion: it.fichaTecnica?.normaCertificacion || "Norma Técnica Aplicable y Homologación",
                  material: it.fichaTecnica?.material || "Según especificación técnica y entregables",
                  color: it.fichaTecnica?.color || "Estándar",
                  dimensiones: it.fichaTecnica?.dimensiones || "Estándar",
                  categoriaItem: it.fichaTecnica?.categoriaItem || (parsed.tipo_tabla_sugerido === "MATRIZ_SERVICIOS" ? "Servicios Especializados" : "Suministros Oficiales"),
                  caracteristicasDetalle: it.caracteristicasTecnicas ? [it.caracteristicasTecnicas] : ["Conforme a especificaciones"],
                },
              })),
        };
      }
    } catch (e) {
      console.warn("Could not parse JSON from AI, using literal parser:", e);
    }
  }

  // Fallback 1: Si se parseó texto literal de Markdown, devolver la copia fiel
  if (literalParsed && (literalParsed.items.length > 0 || literalParsed.antecedentes_texto)) {
    return {
      titulo_proceso: literalParsed.titulo_proceso || adquisicion.titulo_proceso,
      antecedentes_texto: literalParsed.antecedentes_texto || adquisicion.antecedentes_texto,
      justificacion_texto: literalParsed.justificacion_texto || adquisicion.justificacion_texto,
      calidad_texto: literalParsed.calidad_texto || adquisicion.calidad_texto,
      ambito_aplicacion: literalParsed.ambito_aplicacion || adquisicion.ambito_aplicacion,
      metodo_seleccion_texto: literalParsed.metodo_seleccion_texto || adquisicion.metodo_seleccion_texto,
      vigencia_propuesta_texto: literalParsed.vigencia_propuesta_texto || adquisicion.vigencia_propuesta_texto,
      categoria_texto: literalParsed.categoria_texto || adquisicion.categoria_texto,
      lugar_entrega: literalParsed.lugar_entrega || adquisicion.lugar_entrega,
      tiempo_entrega_texto: literalParsed.tiempo_entrega_texto || adquisicion.tiempo_entrega_texto,
      forma_adjudicacion: literalParsed.forma_adjudicacion || adquisicion.forma_adjudicacion,
      aceptacion_lote: literalParsed.aceptacion_lote || adquisicion.aceptacion_lote,
      forma_pago_texto: literalParsed.forma_pago_texto || adquisicion.forma_pago_texto,
      multas_texto: literalParsed.multas_texto || adquisicion.multas_texto,
      seccion3_introduccion_texto: literalParsed.seccion3_introduccion_texto || adquisicion.seccion3_introduccion_texto,
      tipo_tabla_sugerido: literalParsed.tipo_tabla_sugerido || adquisicion.tipo_tabla_tdr,
      columnas_tabla_tdr: literalParsed.columnas_tabla_tdr || adquisicion.columnas_tabla_tdr,
      puntos_detectados: literalParsed.puntos_detectados || {},
      puntos_14_texto: literalParsed.puntos_14_texto || literalParsed.puntos_detectados || {},
      items: literalParsed.items.length > 0 ? literalParsed.items : adquisicion.items,
    };
  }

  // Fallback 2: Devolver los datos del expediente sin inventar herramientas
  return {
    titulo_proceso: adquisicion.titulo_proceso,
    antecedentes_texto: adquisicion.antecedentes_texto,
    justificacion_texto: adquisicion.justificacion_texto,
    calidad_texto: adquisicion.calidad_texto,
    ambito_aplicacion: adquisicion.ambito_aplicacion,
    metodo_seleccion_texto: adquisicion.metodo_seleccion_texto,
    vigencia_propuesta_texto: adquisicion.vigencia_propuesta_texto,
    categoria_texto: adquisicion.categoria_texto,
    lugar_entrega: adquisicion.lugar_entrega,
    tiempo_entrega_texto: adquisicion.tiempo_entrega_texto,
    forma_adjudicacion: adquisicion.forma_adjudicacion,
    aceptacion_lote: adquisicion.aceptacion_lote,
    forma_pago_texto: adquisicion.forma_pago_texto,
    multas_texto: adquisicion.multas_texto,
    seccion3_introduccion_texto: adquisicion.seccion3_introduccion_texto,
    tipo_tabla_sugerido: adquisicion.tipo_tabla_tdr || "BIENES_SIMPLE",
    columnas_tabla_tdr: adquisicion.columnas_tabla_tdr,
    puntos_14_texto: adquisicion.puntos_14_texto,
    items: adquisicion.items,
  };
}

// Extractor para Carpeta 5 (Solicitud de Inicio de Proceso de Compra)
export async function extractSolicitudInicioWithAI(
  adquisicion: Adquisicion,
  input: {
    insumoTexto?: string;
    imageBase64?: string;
    documentText?: string;
    nombreArchivo?: string;
  }
): Promise<{
  numero?: string;
  fecha?: string;
  a_nombre?: string;
  a_cargo?: string;
  via_nombre?: string;
  via_cargo?: string;
  de_nombre?: string;
  de_cargo?: string;
  objeto?: string;
  parrafo1?: string;
  parrafo2?: string;
}> {
  const systemPrompt = `Eres el Especialista Senior de Adquisiciones de ENDE Deoruro S.A.
Tu tarea es redactar la Solicitud de Inicio del Proceso de Compra oficial (Carpeta 5).
Estructura oficial estricta:
No.: [ej. 047/2026]
Fecha: [ej. Oruro, 26 de mayo de 2026]
A: Lic. Vicente Paul Vega Ramirez (RESPONSABLE DE CONTRATACIONES)
VIA: Lic. Raúl Alberto Torrico Gomez (GERENTE GENERAL)
DE: Ing. Heydi Dunya Canaviri Padilla (SUPERVISOR DE SEGURIDAD INDUSTRIAL)
OBJETO: SOLICITUD DE INICIO DEL PROCESO DE COMPRA "[NOMBRE DEL PROCESO EN MAYÚSCULAS]"

DEBES RESPONDER EXCLUSIVAMENTE UN OBJETO JSON VÁLIDO:
{
  "numero": "047/2026",
  "fecha": "Oruro, 26 de mayo de 2026",
  "a_nombre": "Lic. Vicente Paul Vega Ramirez",
  "a_cargo": "RESPONSABLE DE CONTRATACIONES",
  "via_nombre": "Lic. Raúl Alberto Torrico Gomez",
  "via_cargo": "GERENTE GENERAL",
  "de_nombre": "Ing. Heydi Dunya Canaviri Padilla",
  "de_cargo": "SUPERVISOR DE SEGURIDAD INDUSTRIAL",
  "objeto": "SOLICITUD DE INICIO DEL PROCESO DE COMPRA \\"ADQUISICIÓN DE HERRAMIENTA PARA CUADRILLAS\\"",
  "parrafo1": "Por medio de la presente, me dirijo a su autoridad para solicitar formalmente el inicio del proceso de compra correspondiente al proceso \\"ADQUISICIÓN DE HERRAMIENTA PARA CUADRILLAS\\".",
  "parrafo2": "Esta solicitud, se realiza en cumplimiento al Reglamento y Manual de Procedimiento de Adquisiciones de Bienes, construcciones de Obras y Contrataciones de Servicio, adjunto a la presente los documentos de respaldo necesarios para el inicio del proceso de contratación:"
}`;

  let userContent: any = `Genera la Solicitud de Inicio para ${adquisicion.codigo} - ${adquisicion.titulo_proceso}.\n`;
  if (input.nombreArchivo) userContent += `Archivo: ${input.nombreArchivo}\n`;
  if (input.documentText) userContent += `Texto extraído:\n${input.documentText}\n`;
  if (input.insumoTexto) userContent += `Instrucciones del usuario:\n${input.insumoTexto}\n`;

  const messages: ChatMessage[] = [{ role: "system", content: systemPrompt }];

  if (input.imageBase64 && input.imageBase64.startsWith("data:image")) {
    messages.push({
      role: "user",
      content: [
        { type: "text", text: userContent },
        { type: "image_url", image_url: { url: input.imageBase64 } },
      ],
    });
  } else {
    messages.push({
      role: "user",
      content: userContent,
    });
  }

  const aiRaw = await callOpenCodeGo(messages, 0.2);

  if (aiRaw) {
    try {
      const cleanJson = aiRaw.replace(/```json/gi, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleanJson);
      if (parsed.objeto || parsed.a_nombre) {
        return parsed;
      }
    } catch (e) {
      console.warn("Could not parse JSON for Solicitud de Inicio:", e);
    }
  }

  // Fallback institucional oficial idéntico al documento físico
  return {
    numero: adquisicion.solicitud_inicio_numero || "047/2026",
    fecha: adquisicion.solicitud_inicio_fecha || "Oruro, 26 de mayo de 2026",
    a_nombre: adquisicion.solicitud_inicio_a_nombre || "Lic. Vicente Paul Vega Ramirez",
    a_cargo: adquisicion.solicitud_inicio_a_cargo || "RESPONSABLE DE CONTRATACIONES",
    via_nombre: adquisicion.solicitud_inicio_via_nombre || "Lic. Raúl Alberto Torrico Gomez",
    via_cargo: adquisicion.solicitud_inicio_via_cargo || "GERENTE GENERAL",
    de_nombre: adquisicion.solicitud_inicio_de_nombre || "Ing. Heydi Dunya Canaviri Padilla",
    de_cargo: adquisicion.solicitud_inicio_de_cargo || "SUPERVISOR DE SEGURIDAD INDUSTRIAL",
    objeto: `SOLICITUD DE INICIO DEL PROCESO DE COMPRA "${adquisicion.titulo_proceso.toUpperCase()}"`,
    parrafo1: `Por medio de la presente, me dirijo a su autoridad para solicitar formalmente el inicio del proceso de compra correspondiente al proceso "${adquisicion.titulo_proceso.toUpperCase()}".`,
    parrafo2: "Esta solicitud, se realiza en cumplimiento al Reglamento y Manual de Procedimiento de Adquisiciones de Bienes, construcciones de Obras y Contrataciones de Servicio, adjunto a la presente los documentos de respaldo necesarios para el inicio del proceso de contratación:",
  };
}

export async function generateTdrContentWithAI(adquisicion: Adquisicion, insumoTexto?: string): Promise<string> {
  return generateTdrContentWithAIInternal(adquisicion, insumoTexto);
}

async function generateTdrContentWithAIInternal(adquisicion: Adquisicion, insumoTexto?: string): Promise<string> {
  return `El presente proceso de adquisición tiene por objeto dotar a la Distribuidora de Electricidad ENDE Deoruro S.A. de "${adquisicion.titulo_proceso}", asegurando la continuidad operativa del sistema de distribución eléctrica en el departamento de Oruro.`;
}

export async function generateSolicitudInicioContentWithAI(
  adquisicion: Adquisicion,
  contextoCarpetas: any
): Promise<string> {
  return `Solicitud de inicio para ${adquisicion.codigo}`;
}

export async function extractInformeConformidadWithAI(
  adquisicion: Adquisicion,
  input: {
    imageBase64?: string;
    contextoCarpetas?: any;
    insumoTexto?: string;
  }
): Promise<any> {
  const systemPrompt = `Eres un auditor legal y técnico experto en compras de ENDE Deoruro S.A. (Bolivia).
Debes generar o estructurar los datos para el "INFORME DE CONFORMIDAD / INFORME TÉCNICO DE EVALUACIÓN DE COTIZACIONES Y SOLICITUD DE ADJUDICACIÓN (FORMULARIO A6-N014)".
Responde ÚNICAMENTE con un JSON con los siguientes campos:
{
  "formulario": "FORMULARIO A6-N014",
  "fecha": "Oruro, 29 de julio de 2026",
  "cite": "INF.DE ORURO N.º 021/2026",
  "a_nombre": "Lic. VICENTE PAUL VEGA RAMIREZ",
  "a_cargo": "SUPERINTENDENCIA DE ADMINISTRACIÓN & FINANZAS",
  "via_nombre": "Lic. RAÚL ALBERTO TORRICO GÓMEZ",
  "via_cargo": "GERENTE GENERAL",
  "de_nombre": "Ing. TATIANA TORRES ANDRADE",
  "de_cargo": "SUPERVISOR SEGURIDAD INDUSTRIAL",
  "proceso": "REMISIÓN DE INFORME TÉCNICO DE EVALUACIÓN DE COTIZACIONES Y SOLICITUD DE ADJUDICACIÓN - PROCESO \\"${adquisicion.titulo_proceso.toUpperCase()}\\" (${adquisicion.solicitud_inicio_numero ? `Solicitud No. ${adquisicion.solicitud_inicio_numero}` : "Solicitud No. 028/2026 S.I."})",
  "antecedentes_fecha": "24/06/2026",
  "antecedentes_nota": "Nota No. 057/2026",
  "prevision_precio": ${adquisicion.prevision_presupuesto || 109000.0},
  "proponentes": [
    {
      "numero": 1,
      "empresa": "MULTI ENERGÍA",
      "cotizacion_detalle": "Fechas solicitud de cotización: 10/07/2026\\nCotización cumple con lo solicitado, de acuerdo a las especificaciones técnicas enviadas",
      "precio": "Bs 70.000,00",
      "actividad_economica": "No envía NIT",
      "cumple_tecnico": true,
      "cumple_legal": false,
      "es_ganador": false,
      "observacion": "No acreditó NIT"
    },
    {
      "numero": 2,
      "empresa": "HERRACRUZ",
      "cotizacion_detalle": "Fechas solicitud de cotización: 10/07/2026\\nNo envía cotización.",
      "precio": "No envía propuesta",
      "actividad_economica": "-",
      "cumple_tecnico": false,
      "cumple_legal": false,
      "es_ganador": false,
      "observacion": "No presentó propuesta"
    },
    {
      "numero": 3,
      "empresa": "ARIOL",
      "cotizacion_detalle": "Fechas solicitud de cotización: 10/07/2026\\nCotización cumple con lo solicitado, de acuerdo a las especificaciones técnicas enviadas",
      "precio": "Bs 67.240,00",
      "actividad_economica": "NIT: 6119531015\\nActividad Económica: Comercialización y provisión de bienes",
      "cumple_tecnico": true,
      "cumple_legal": true,
      "es_ganador": true,
      "observacion": "Oferta habilitada con menor precio ofertado"
    },
    {
      "numero": 4,
      "empresa": "FEMCO",
      "cotizacion_detalle": "Fechas solicitud de cotización: 10/07/2026\\nNo envía cotización.",
      "precio": "No envía propuesta",
      "actividad_economica": "-",
      "cumple_tecnico": false,
      "cumple_legal": false,
      "es_ganador": false,
      "observacion": "No presentó propuesta"
    }
  ],
  "empresa_ganadora": "ARIOL",
  "monto_adjudicado": 67240.0,
  "monto_adjudicado_literal": "Sesenta y Siete Mil Doscientos Cuarenta 00/100 Bolivianos"
}`;

  const userContent = `Datos del proceso:
- Título: ${adquisicion.titulo_proceso}
- Código: ${adquisicion.codigo}
- Presupuesto referencial: ${adquisicion.prevision_presupuesto}
- Insumo extra: ${input.insumoTexto || "Ninguno"}
- Contexto de carpetas previas: ${JSON.stringify(input.contextoCarpetas || {})}`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent },
  ];

  const aiRaw = await callOpenCodeGo(messages, 0.2);
  if (aiRaw) {
    try {
      const cleanJson = aiRaw.replace(/```json/gi, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleanJson);
      if (parsed.proceso || parsed.empresa_ganadora) {
        return parsed;
      }
    } catch (e) {
      console.warn("Could not parse JSON for Informe Conformidad:", e);
    }
  }

  // Fallback
  return {
    formulario: adquisicion.informe_conf_formulario || "FORMULARIO A6-N014",
    fecha: adquisicion.informe_conf_fecha || "Oruro, 29 de julio de 2026",
    cite: adquisicion.informe_conf_cite || "INF.DE ORURO N.º 021/2026",
    a_nombre: adquisicion.informe_conf_a_nombre || "Lic. VICENTE PAUL VEGA RAMIREZ",
    a_cargo: adquisicion.informe_conf_a_cargo || "SUPERINTENDENCIA DE ADMINISTRACIÓN & FINANZAS",
    via_nombre: adquisicion.informe_conf_via_nombre || "Lic. RAÚL ALBERTO TORRICO GÓMEZ",
    via_cargo: adquisicion.informe_conf_via_cargo || "GERENTE GENERAL",
    de_nombre: adquisicion.informe_conf_de_nombre || "Ing. TATIANA TORRES ANDRADE",
    de_cargo: adquisicion.informe_conf_de_cargo || "SUPERVISOR SEGURIDAD INDUSTRIAL",
    proceso: `REMISIÓN DE INFORME TÉCNICO DE EVALUACIÓN DE COTIZACIONES Y SOLICITUD DE ADJUDICACIÓN - PROCESO "${adquisicion.titulo_proceso.toUpperCase()}" (${adquisicion.solicitud_inicio_numero ? `Solicitud No. ${adquisicion.solicitud_inicio_numero}` : "Solicitud No. 028/2026 S.I."})`,
    antecedentes_fecha: "24/06/2026",
    antecedentes_nota: "Nota No. 057/2026",
    prevision_precio: adquisicion.prevision_presupuesto || 109000.0,
    proponentes: [
      {
        numero: 1,
        empresa: "MULTI ENERGÍA",
        cotizacion_detalle: "Fechas solicitud de cotización: 10/07/2026\nCotización cumple con lo solicitado, de acuerdo a las especificaciones técnicas enviadas",
        precio: "Bs 70.000,00",
        actividad_economica: "No envía NIT",
        cumple_tecnico: true,
        cumple_legal: false,
        es_ganador: false,
        observacion: "No acreditó NIT",
      },
      {
        numero: 2,
        empresa: "HERRACRUZ",
        cotizacion_detalle: "Fechas solicitud de cotización: 10/07/2026\nNo envía cotización.",
        precio: "No envía propuesta",
        actividad_economica: "-",
        cumple_tecnico: false,
        cumple_legal: false,
        es_ganador: false,
        observacion: "No presentó propuesta",
      },
      {
        numero: 3,
        empresa: "ARIOL",
        cotizacion_detalle: "Fechas solicitud de cotización: 10/07/2026\nCotización cumple con lo solicitado, de acuerdo a las especificaciones técnicas enviadas",
        precio: "Bs 67.240,00",
        actividad_economica: "NIT: 6119531015\nActividad Económica: Comercialización y provisión de bienes",
        cumple_tecnico: true,
        cumple_legal: true,
        es_ganador: true,
        observacion: "Oferta habilitada con menor precio ofertado",
      },
      {
        numero: 4,
        empresa: "FEMCO",
        cotizacion_detalle: "Fechas solicitud de cotización: 10/07/2026\nNo envía cotización.",
        precio: "No envía propuesta",
        actividad_economica: "-",
        cumple_tecnico: false,
        cumple_legal: false,
        es_ganador: false,
        observacion: "No presentó propuesta",
      },
    ],
    empresa_ganadora: "ARIOL",
    monto_adjudicado: 67240.0,
    monto_adjudicado_literal: "Sesenta y Siete Mil Doscientos Cuarenta 00/100 Bolivianos",
  };
}

export async function extractMemoPagoWithAI(
  adquisicion: Adquisicion,
  input: {
    imageBase64?: string;
    contextoCarpetas?: any;
    insumoTexto?: string;
  }
): Promise<any> {
  const systemPrompt = `Eres un auditor contable y administrativo de ENDE Deoruro S.A.
Debes estructurar el "MEMORÁNDUM DE SOLICITUD DE PAGO" oficial.
Responde ÚNICAMENTE con un JSON con los siguientes campos:
{
  "cite": "GG-SPA-26/070002",
  "fecha": "Oruro, 23 de Julio de 2026",
  "a_nombre": "LIC. VICENTE PAUL VEGA RAMIREZ",
  "a_cargo": "SUPERINTENDENTE DE ADMINISTRACIÓN Y FINANZAS a.i.",
  "de_nombre": "ING. TATIANA TORRES ANDRADE",
  "de_cargo": "SUPERVISOR DE SEGURIDAD INDUSTRIAL a.i.",
  "objeto": "SOLICITUD DE PAGO ${adquisicion.titulo_proceso.toUpperCase()} DE MOVICLEAN S.R.L.",
  "nro_factura": "2",
  "proveedor": "MOVICLEAN S.R.L.",
  "monto_total": 58333.0,
  "monto_literal": "Cincuenta y ocho mil trescientos treinta y tres 00/100 Bolivianos",
  "items": [
    {
      "cantidad": "1.00",
      "unidad": "Unidad (Servicios)",
      "descripcion": "${adquisicion.titulo_proceso.toUpperCase()}"
    }
  ],
  "banco_cite_solicitud": "CITE: MOVICLEAN-LIM-ADM-No113/2026",
  "banco_nombre": "Banco Económico",
  "banco_titular": "Moviclean SRL",
  "banco_cuenta": "1041-505958",
  "conformidad_texto": "Así mismo, informamos que el proveedor ha cumplido satisfactoriamente con la prestación del servicio contratado."
}`;

  const userContent = `Datos del proceso:
- Título: ${adquisicion.titulo_proceso}
- Código: ${adquisicion.codigo}
- Proveedor / Ganador: ${adquisicion.informe_conf_empresa_ganadora || adquisicion.proveedor_adjudicado || "MOVICLEAN S.R.L."}
- Insumo extra: ${input.insumoTexto || "Ninguno"}`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent },
  ];

  const aiRaw = await callOpenCodeGo(messages, 0.2);
  if (aiRaw) {
    try {
      const cleanJson = aiRaw.replace(/```json/gi, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleanJson);
      if (parsed.cite || parsed.proveedor) {
        return parsed;
      }
    } catch (e) {
      console.warn("Could not parse JSON for Memo Pago:", e);
    }
  }

  // Fallback
  return {
    cite: adquisicion.memo_pago_cite || "GG-SPA-26/070002",
    fecha: adquisicion.memo_pago_fecha || "Oruro, 23 de Julio de 2026",
    a_nombre: adquisicion.memo_pago_a_nombre || "LIC. VICENTE PAUL VEGA RAMIREZ",
    a_cargo: adquisicion.memo_pago_a_cargo || "SUPERINTENDENTE DE ADMINISTRACIÓN Y FINANZAS a.i.",
    de_nombre: adquisicion.memo_pago_de_nombre || "ING. TATIANA TORRES ANDRADE",
    de_cargo: adquisicion.memo_pago_de_cargo || "SUPERVISOR DE SEGURIDAD INDUSTRIAL a.i.",
    objeto: `SOLICITUD DE PAGO ${adquisicion.titulo_proceso.toUpperCase()} DE MOVICLEAN S.R.L.`,
    nro_factura: "2",
    proveedor: adquisicion.informe_conf_empresa_ganadora || adquisicion.proveedor_adjudicado || "MOVICLEAN S.R.L.",
    monto_total: 58333.0,
    monto_literal: "Cincuenta y ocho mil trescientos treinta y tres 00/100 Bolivianos",
    items: [
      {
        cantidad: "1.00",
        unidad: "Unidad (Servicios)",
        descripcion: adquisicion.titulo_proceso.toUpperCase(),
      },
    ],
    banco_cite_solicitud: "CITE: MOVICLEAN-LIM-ADM-No113/2026",
    banco_nombre: "Banco Económico",
    banco_titular: "Moviclean SRL",
    banco_cuenta: "1041-505958",
    conformidad_texto: "Así mismo, informamos que el proveedor ha cumplido satisfactoriamente con la prestación del servicio contratado.",
  };
}

