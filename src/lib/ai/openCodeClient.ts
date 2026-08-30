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

  const systemPrompt = `# Rol y Propósito:
Eres el Asistente Técnico Oficial de Contrataciones y Adquisiciones de la DISTRIBUIDORA DE ELECTRICIDAD ENDE DEORURO S.A.
Tu función es transformar cualquier requerimiento, nota técnica, borrador o documento en un documento formal de **Especificaciones Técnicas (ET) o Términos de Referencia (TdR)**, cumpliendo rigurosamente con la estructura oficial de 14 puntos de la empresa.

---

# 🧠 LÓGICA DE DETECCIÓN Y ADAPTACIÓN SEGÚN EL RUBRO (PUNTO 3)
Al procesar la solicitud o documento, identifica la categoría para adaptar el **Punto 3 (ESPECIFICACIÓN TÉCNICA)**:

### OPCIÓN A: BIENES, HERRAMIENTAS Y EQUIPOS (Suministros)
- **Estructura:** Ficha técnica y cuadro físico/mecánico.
- **Tipo de tabla:** "BIENES_SIMPLE" o "BIENES_3_COLS"
- **Formato de Tabla:**
  | No. | DESCRIPCIÓN DEL ÍTEM | CARACTERÍSTICAS / ESPECIFICACIÓN TÉCNICA | CANT. |
  | --- | -------------------- | --------------------------------------- | ----- |

### OPCIÓN B: SALUD OCUPACIONAL, MEDICINA Y SERVICIOS DE LABORATORIO
- **Estructura:** Matriz de evaluación médica y requisitos de laboratorio/consulta.
- **Tipo de tabla:** "SALUD_OCUPACIONAL" o "MATRIZ_SERVICIOS"
- **Formato de Tabla:**
  | EXAMEN / SERVICIO REQUERIDO | ESPECIFICACIÓN MÍNIMA REQUERIDA | PROPUESTO / INFORMAR |
  | --------------------------- | ------------------------------- | -------------------- |

---

# 📜 ESTRUCTURA OFICIAL DEL DOCUMENTO (14 PUNTOS)
Todo documento generado debe seguir estrictamente este índice:

### LOS 14 PUNTOS OBLIGATORIOS:
1. **ANTECEDENTES:** Contexto operativo, normativo o de salud ocupacional que motiva la contratación.
2. **JUSTIFICACIÓN / NECESIDAD:** Importancia para la empresa, continuidad del servicio y mitigación de riesgos.
3. **ESPECIFICACIÓN TÉCNICA:** Detalle técnico o matriz de exámenes (según Opción A u Opción B).
4. **CALIDAD:** Estándares normativos aplicables, certificaciones y credenciales vigentes de proveedores o profesionales.
5. **ÁMBITO DE APLICACIÓN:** Delimitación de a quiénes o dónde se aplicará (ej. número de trabajadores, sucursales, departamentos o áreas específicas).
6. **MÉTODO DE SELECCIÓN:** Criterio de evaluación (ej. "Calificación menor costo / Menor Precio Art. 31 SBC").
7. **VIGENCIA DE LA PROPUESTA:** Validez de la oferta (ej. "Tendrá una validez mínima de 30 días calendario").
8. **CATEGORÍA:** Clasificación formal de la contratación (ej. Salud Ocupacional, Herramientas, etc.).
9. **LUGAR DE ENTREGA:** Ubicación física de recepción (ej. Almacenes ENDE DEORURO S.A. o Unidad de Seguridad Industrial).
10. **TIEMPO DE ENTREGA:** Plazo límite formal en días hábiles o calendario (ej. "Máximo 30 días calendario").
11. **FORMA DE ADJUDICACIÓN:** Modalidad ("Por ítem requerido", formalizada por Orden de Compra).
12. **PARA LA ACEPTACIÓN DEL LOTE / SERVICIO:** Procedimiento de inspección y evaluación preliminar por personal de ENDE.
13. **FORMA DE PAGO:** Condiciones de desembolso contra entrega/prestación satisfactoria, conformidad y documentación de respaldo (Nota de Entrega, Solicitud de Pago, Factura).
14. **APLICACIÓN DE MULTAS:** Cláusula penal institucional (multa del 0.25% por día de retraso).

---

# 📌 REGLAS DE FIDELIDAD Y EXTRACCIÓN DE ÍTEMS (PUNTO 3):
1. **Extracción Total de Ítems:** Extrae cada bien, herramienta, material o servicio solicitado. No omitas ninguno.
2. **Reconocimiento de Cantidades:** Identifica correctamente las cantidades numéricas aun si están escritas en palabras en español (ej: "dos palas" -> Cantidad: 2, Descripción: "PALAS"; "una cinta..." -> Cantidad: 1, Descripción: "CINTA AISLANTE 1000V"; "20 alicates..." -> Cantidad: 20, Descripción: "ALICATES UNIVERSALES 8 PULGADAS").
3. **Limpieza de Descripción:** NO incluyas palabras de cantidad ("DOS", "UNA", "TRES", etc.) dentro de la descripción del ítem; trasládalas al campo "cantidad".
4. **Dimensiones y Especificaciones Técnicas:** Conserva las medidas, calibres y voltajes ("8 PULGADAS", "1000V", "6 PULGADAS") en la descripción y redacta características técnicas completas con normas ASTM/IEC/ISO para cada ítem.
5. **Copia Fiel y Coherencia:** Redacta Antecedentes y Justificación basados de forma exhaustiva y exclusiva en los ítems solicitados, sin mezclar rubros diferentes.

DEBES DEVOLVER ESTRICTAMENTE UN OBJETO JSON VÁLIDO con la siguiente estructura:
{
  "categoria_detectada": "Bienes" | "Servicios" | "Salud Ocupacional" | "Obras",
  "titulo_proceso": "TÍTULO EXACTO DEL PROCESO COPIADO LITERALMENTE EN MAYÚSCULAS",
  "tipo_tabla_sugerido": "MATRIZ_SERVICIOS" | "BIENES_3_COLS" | "BIENES_SIMPLE" | "SALUD_OCUPACIONAL" | "FICHAS_DINAMICAS" | "TABLA_DINAMICA",
  "seccion3_introduccion_texto": "Texto introductorio previo a la tabla si existe",
  "columnas_tabla": ["Encabezados de la tabla"],
  "antecedentes_texto": "Texto completo de antecedentes",
  "justificacion_texto": "Texto completo de justificación",
  "calidad_texto": "Texto de calidad",
  "ambito_aplicacion": "Texto de ámbito de aplicación",
  "metodo_seleccion_texto": "Texto de método de selección",
  "vigencia_propuesta_texto": "Texto de vigencia de propuesta",
  "categoria_texto": "Texto de categoría",
  "lugar_entrega": "Texto de lugar de entrega",
  "tiempo_entrega_texto": "Texto de tiempo/plazo de entrega",
  "forma_adjudicacion": "Texto de forma de adjudicación",
  "aceptacion_lote": "Texto de aceptación del lote",
  "forma_pago_texto": "Texto de forma de pago",
  "multas_texto": "Texto de aplicación de multas",
  "puntos_14": {
    "1": "Texto antecedentes",
    "2": "Texto justificación",
    "4": "Texto calidad",
    "5": "Texto ámbito de aplicación",
    "6": "Texto método de selección",
    "7": "Texto vigencia de propuesta",
    "8": "Texto categoría",
    "9": "Texto lugar de entrega",
    "10": "Texto tiempo de entrega",
    "11": "Texto forma de adjudicación",
    "12": "Texto aceptación del lote",
    "13": "Texto forma de pago",
    "14": "Texto aplicación de multas"
  },
  "items": [
    {
      "item": 1,
      "descripcion": "DESCRIPCIÓN DEL ÍTEM EN MAYÚSCULAS",
      "cantidad": 1,
      "unidad": "PZA" | "SRV" | "ESTUDIO" | "LOTE" | "GLB",
      "precioUnitarioEstimado": 0,
      "caracteristicasTecnicas": "Texto de características o especificación técnica requerida",
      "especificacionMinima": "Especificación mínima requerida",
      "productoEntregable": "Entregable o informe requerido",
      "propuestoOferente": "Cumple según especificaciones técnicas"
    }
  ]
}`;

  // Instrucción para que la IA redacte y complete el TDR oficial de 14 puntos
  let userContent: string = `Toma este requerimiento/borrador base para el proceso ${adquisicion.codigo} y REDACTA un documento formal de Especificaciones Técnicas (ET) o Términos de Referencia (TdR) con la estructura oficial de 14 puntos de ENDE DEORURO S.A.\n` +
    `Detecta automáticamente el rubro (Opción A: Bienes/Herramientas u Opción B: Salud Ocupacional/Laboratorio), adapta la tabla del Punto 3 y redacta ampliamente Antecedentes, Justificación y los demás puntos normativos.\n\n` +
    `INSUMO BASE PROVISTO:\n`;

  if (input.nombreArchivo) userContent += `Archivo: ${input.nombreArchivo}\n`;
  if (input.documentText) userContent += `\n${"=".repeat(60)}\n${input.documentText}\n${"=".repeat(60)}\n`;
  if (input.insumoTexto) userContent += `\nInstrucción adicional: ${input.insumoTexto}\n`;

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

        // Enriquecer Antecedentes y Justificación con los estándares institucionales de ENDE DEORURO
        const isSalud = (parsed.categoria_detectada as string) === "Salud Ocupacional" ||
          (parsed.titulo_proceso || "").toLowerCase().includes("oftalmo") ||
          (parsed.titulo_proceso || "").toLowerCase().includes("laboratorio") ||
          (parsed.tipo_tabla_sugerido === "SALUD_OCUPACIONAL");

        const defaultAntecedentes = isSalud ? GOLD_STANDARD_HEALTH_ANTECEDENTES : GOLD_STANDARD_TOOLS_ANTECEDENTES;
        const defaultJustificacion = isSalud ? GOLD_STANDARD_HEALTH_JUSTIFICACION : GOLD_STANDARD_TOOLS_JUSTIFICACION;

        const rawAntecedentes = cleanInstitutionalText(literalParsed?.antecedentes_texto || parsed.antecedentes_texto || parsed.puntos_14?.["1"] || adquisicion.antecedentes_texto || "");
        const finalAntecedentes = rawAntecedentes.length > 50 ? rawAntecedentes : defaultAntecedentes;

        const rawJustificacion = cleanInstitutionalText(literalParsed?.justificacion_texto || parsed.justificacion_texto || parsed.puntos_14?.["2"] || adquisicion.justificacion_texto || "");
        const finalJustificacion = rawJustificacion.length > 50 ? rawJustificacion : defaultJustificacion;

        const enrichedItems: ItemAdquisicion[] = (
          literalParsed?.items && literalParsed.items.length > 0
            ? literalParsed.items
            : parsed.items
        ).map((it: any, idx: number) => {
          const num = it.item || idx + 1;
          const desc = (it.descripcion || it.nombre || `ÍTEM #${num}`).toUpperCase();
          const cant = Number(it.cantidad) || 1;
          const unidad = (it.unidad || (isSalud ? "ESTUDIO" : (parsed.tipo_tabla_sugerido === "MATRIZ_SERVICIOS" ? "SRV" : "PZA"))).toUpperCase();
          
          let carac = it.caracteristicasTecnicas || it.especificacionMinima || it.caracteristicas || it.especificacion || "";
          if (!carac || carac.length < 5) {
            carac = isSalud
              ? "Examen médico ocupacional con evaluación especializada, informe clínico individual y recomendaciones según protocolo de salud"
              : `Fabricación en acero forjado de alta resistencia, tratamiento anticorrosión y homologación según norma técnica aplicable`;
          }

          const entregable = it.productoEntregable || it.propuestoOferente || (isSalud ? "Certificado médico de aptitud e informe clínico" : "Bienes nuevos con certificado de garantía oficial");

          return {
            id: `item-ia-${Date.now()}-${idx}`,
            item: num,
            descripcion: desc,
            cantidad: cant,
            unidad: unidad,
            precioUnitarioEstimado: Number(it.precioUnitarioEstimado) || 0,
            precioTotalEstimado: cant * (Number(it.precioUnitarioEstimado) || 0),
            caracteristicasTecnicas: carac,
            especificacionMinima: carac,
            productoEntregable: entregable,
            propuestoOferente: entregable,
            valores_columnas: isSalud
              ? [desc, carac, entregable]
              : [String(num), desc, carac, String(cant)],
            fichaTecnica: {
              uso: isSalud ? "Medicina del Trabajo y Salud Ocupacional" : "Personal Operativo y Cuadrillas de Mantenimiento",
              normaCertificacion: isSalud ? "Acreditación y Control de Calidad Sanitario" : "Norma ASTM A36 / ISO 9001 / IEEE / Aislación 1000V",
              material: isSalud ? "Metodología Analítica Validada" : "Acero forjado con tratamiento térmico y aislamiento de seguridad",
              color: "Estándar",
              dimensiones: "Según requerimiento técnico",
              categoriaItem: isSalud ? "Servicios de Salud Ocupacional" : "Herramientas y Equipos de Seguridad",
              caracteristicasDetalle: [carac],
            },
          };
        });

        return {
          titulo_proceso: literalParsed?.titulo_proceso || parsed.titulo_proceso || adquisicion.titulo_proceso,
          antecedentes_texto: finalAntecedentes,
          justificacion_texto: finalJustificacion,
          calidad_texto: cleanInstitutionalText(literalParsed?.calidad_texto || parsed.calidad_texto || parsed.puntos_14?.["4"] || (isSalud ? "Cumplimiento obligatorio de credenciales sanitarias y control de calidad médico." : "Los bienes deberán ser nuevos, de primer uso y fabricados bajo normas de calidad aplicables con garantía oficial.")),
          ambito_aplicacion: cleanInstitutionalText(literalParsed?.ambito_aplicacion || parsed.ambito_aplicacion || parsed.puntos_14?.["5"] || "Personal institucional y áreas operativas de la Distribuidora de Electricidad ENDE DEORURO S.A."),
          metodo_seleccion_texto: cleanInstitutionalText(literalParsed?.metodo_seleccion_texto || parsed.metodo_seleccion_texto || parsed.puntos_14?.["6"] || "Menor Precio (Art. 31 del Reglamento SBC)."),
          vigencia_propuesta_texto: cleanInstitutionalText(literalParsed?.vigencia_propuesta_texto || parsed.vigencia_propuesta_texto || parsed.puntos_14?.["7"] || "Tendrá una validez mínima de 30 días calendario computables a partir de la presentación de la propuesta."),
          categoria_texto: cleanInstitutionalText(literalParsed?.categoria_texto || parsed.categoria_texto || parsed.puntos_14?.["8"] || (isSalud ? "Salud Ocupacional y Medicina del Trabajo." : "Bienes, Herramientas y Suministros Oficiales.")),
          lugar_entrega: cleanInstitutionalText(literalParsed?.lugar_entrega || parsed.lugar_entrega || parsed.puntos_14?.["9"] || "Almacenes / Instalaciones de ENDE DEORURO S.A., Oruro - Bolivia."),
          tiempo_entrega_texto: cleanInstitutionalText(literalParsed?.tiempo_entrega_texto || parsed.tiempo_entrega_texto || parsed.puntos_14?.["10"] || `Máximo ${adquisicion.plazo_entrega_dias || 30} días calendario computables a partir del día siguiente hábil de la recepción de la Orden de Compra.`),
          forma_adjudicacion: cleanInstitutionalText(literalParsed?.forma_adjudicacion || parsed.forma_adjudicacion || parsed.puntos_14?.["11"] || "Por Ítem requerido, formalizada por Orden de Compra (Art. 31 SBC)."),
          aceptacion_lote: cleanInstitutionalText(literalParsed?.aceptacion_lote || parsed.aceptacion_lote || parsed.puntos_14?.["12"] || "El personal técnico de ENDE DEORURO realizará una evaluación técnica de conformidad el día de la entrega."),
          forma_pago_texto: cleanInstitutionalText(literalParsed?.forma_pago_texto || parsed.forma_pago_texto || parsed.puntos_14?.["13"] || "El pago se realizará contra entrega satisfactoria del producto o servicio, conformidad emitida por ENDE DEORURO S.A. y presentación de Nota de Entrega, Solicitud de Pago y Factura oficial."),
          multas_texto: cleanInstitutionalText(literalParsed?.multas_texto || parsed.multas_texto || parsed.puntos_14?.["14"] || `Ante el incumplimiento de los plazos establecidos, se aplicará la multa del ${adquisicion.multa_diaria_porcentaje || 0.25}% por cada día de retraso injustificado.`),
          seccion3_introduccion_texto: cleanInstitutionalText(literalParsed?.seccion3_introduccion_texto || parsed.seccion3_introduccion_texto || "Detalle técnico y especificaciones de los requerimientos:"),
          tipo_tabla_sugerido: isSalud ? "SALUD_OCUPACIONAL" : (literalParsed?.tipo_tabla_sugerido || parsed.tipo_tabla_sugerido || "BIENES_SIMPLE"),
          columnas_tabla_tdr: isSalud ? ["EXAMEN / SERVICIO REQUERIDO", "ESPECIFICACIÓN MÍNIMA REQUERIDA", "PROPUESTO / INFORMAR"] : ["No.", "DESCRIPCIÓN DEL ÍTEM", "CARACTERÍSTICAS / ESPECIFICACIÓN TÉCNICA", "CANT."],
          puntos_detectados: mergedPuntos14,
          puntos_14_texto: mergedPuntos14,
          items: enrichedItems,
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

