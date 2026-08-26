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
  resumen_ia?: string;
  categoria_detectada?: string;
  tipo_tabla_sugerido?: TipoTablaTDR;
  secciones_14_puntos?: Array<{ numero: number; titulo: string; contenido: string }>;
}> {
  // Si el usuario provee texto o Markdown, ejecutamos primero la extracción literal exacta
  let literalParsed: any = null;
  if (input.documentText) {
    const { parseMarkdownTdrLiteral } = require("./markdownTdrParser");
    literalParsed = parseMarkdownTdrLiteral(input.documentText);
  }

  const systemPrompt = `Eres el Especialista Principal en Contrataciones y Adquisiciones de la DISTRIBUIDORA DE ELECTRICIDAD ENDE DEORURO S.A.
Tu tarea es estructurar con FIDELIDAD LITERAL 100% (COPIA FIEL) el documento, texto en Markdown o imagen proporcionada en las Especificaciones Técnicas Oficiales (TDR).

REGLAS OBLIGATORIAS DE COPIA FIEL (CERO ALUCINACIONES Y CERO PROMPTS CREATIVOS):
1. FIDELIDAD TOTAL Y LITERAL:
   - Extrae EXACTAMENTE el texto del usuario sin aumentar, inventar o eliminar ningún requisito, tabla o especificación.
   - PROHIBIDO inventar herramientas, marcas o líneas de tensión si no están en el texto provisto.
2. ANTECEDENTES Y JUSTIFICACIÓN:
   - Si el usuario provee antecedentes o justificación en su texto/markdown, CÓPIALOS VERBATIM sin modificarlos.
3. TABLAS DE ESPECIFICACIONES TÉCNICAS:
   - Para cada ítem, extrae su descripción, cantidad, unidad y características técnicas o metodología exacta.

DEBES DEVOLVER ESTRICTAMENTE UN OBJETO JSON VÁLIDO con la siguiente estructura:
{
  "categoria_detectada": "Bienes" | "Servicios" | "Salud Ocupacional" | "Obras",
  "titulo_proceso": "TÍTULO EXACTO DEL PROCESO EN MAYÚSCULAS",
  "tipo_tabla_sugerido": "BIENES_SIMPLE" | "SALUD_OCUPACIONAL" | "FICHAS_DINAMICAS",
  "antecedentes_texto": "Texto exacto de antecedentes...",
  "justificacion_texto": "Texto exacto de justificación de la necesidad...",
  "items": [
    {
      "item": 1,
      "descripcion": "NOMBRE O EXAMEN EXACTO DEL ÍTEM",
      "cantidad": 1,
      "unidad": "PZA" | "ESTUDIO" | "PAR" | "JGO",
      "precioUnitarioEstimado": 0,
      "caracteristicasTecnicas": "Requisitos y características técnicas completas...",
      "especificacionMinima": "Metodología mínima o requisito técnico para salud/servicio...",
      "propuestoOferente": "A informar por el proponente..."
    }
  ]
}`;

  let userContent: any = `Estructura este documento/texto para el proceso ${adquisicion.codigo} manteniendo fidelidad 100% literal:\n`;
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

  const aiRaw = await callOpenCodeGo(messages, 0.1);

  if (aiRaw) {
    try {
      const cleanJson = aiRaw.replace(/```json/gi, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleanJson);
      if (parsed.items && Array.isArray(parsed.items) && parsed.items.length > 0) {
        return {
          titulo_proceso: parsed.titulo_proceso || literalParsed?.titulo_proceso || adquisicion.titulo_proceso,
          antecedentes_texto: parsed.antecedentes_texto || literalParsed?.antecedentes_texto || adquisicion.antecedentes_texto,
          justificacion_texto: parsed.justificacion_texto || literalParsed?.justificacion_texto || adquisicion.justificacion_texto,
          tipo_tabla_sugerido: parsed.tipo_tabla_sugerido || literalParsed?.tipo_tabla_sugerido || adquisicion.tipo_tabla_tdr,
          items: parsed.items.map((it: any, idx: number) => ({
            id: `item-ia-${Date.now()}-${idx}`,
            item: it.item || idx + 1,
            descripcion: (it.descripcion || `ÍTEM #${idx + 1}`).toUpperCase(),
            cantidad: Number(it.cantidad) || 1,
            unidad: (it.unidad || "PZA").toUpperCase(),
            precioUnitarioEstimado: Number(it.precioUnitarioEstimado) || 0,
            precioTotalEstimado: (Number(it.cantidad) || 1) * (Number(it.precioUnitarioEstimado) || 0),
            caracteristicasTecnicas: it.caracteristicasTecnicas || it.especificacionMinima || "",
            especificacionMinima: it.especificacionMinima || it.caracteristicasTecnicas || "",
            propuestoOferente: it.propuestoOferente || "Cumple según especificaciones",
            fichaTecnica: {
              uso: it.fichaTecnica?.uso || "Personal Institucional",
              normaCertificacion: it.fichaTecnica?.normaCertificacion || "Norma Técnica Aplicable",
              material: it.fichaTecnica?.material || "Según especificación técnica",
              color: it.fichaTecnica?.color || "Estándar",
              dimensiones: it.fichaTecnica?.dimensiones || "Estándar",
              categoriaItem: it.fichaTecnica?.categoriaItem || "Suministros Oficiales",
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
      tipo_tabla_sugerido: literalParsed.tipo_tabla_sugerido || adquisicion.tipo_tabla_tdr,
      items: literalParsed.items.length > 0 ? literalParsed.items : adquisicion.items,
    };
  }

  // Fallback 2: Devolver los datos del expediente sin inventar herramientas
  return {
    titulo_proceso: adquisicion.titulo_proceso,
    antecedentes_texto: adquisicion.antecedentes_texto,
    justificacion_texto: adquisicion.justificacion_texto,
    tipo_tabla_sugerido: adquisicion.tipo_tabla_tdr || "BIENES_SIMPLE",
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
