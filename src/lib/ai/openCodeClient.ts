// Cliente para el proveedor de IA OpenCode Go (OpenAI-Compatible)
import { Adquisicion, ItemAdquisicion, TipoTablaTDR } from "@/types";
import { formatCurrencyBs } from "../docx/formatters";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
}

const DEFAULT_OPENCODE_KEY = "sk-uiqURVX900evBUHKomZL4LjIe3L1NvILaNAcATY4oZ6rWvDMoVAt9ODP3F6Q8g97";
const DEFAULT_OPENCODE_BASE_URL = "https://opencode.ai/zen/go/v1";
const DEFAULT_OPENCODE_MODEL = "deepseek-v4-flash-vision-exp";

export function extractJsonFromText(raw: string): any {
  if (!raw) return null;
  let str = raw.replace(/```json/gi, "").replace(/```/g, "").trim();

  const start = str.indexOf("{");
  const end = str.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    str = str.substring(start, end + 1);
  }

  // Intento 1: Parseo directo
  try {
    return JSON.parse(str);
  } catch (e) {}

  // Intento 2: Escapar saltos de línea reales dentro de cadenas JSON
  try {
    const fixed = str.replace(/("(?:[^"\\]|\\.)*")/g, (match) => {
      return match
        .replace(/\r?\n/g, "\\n")
        .replace(/\t/g, "\\t");
    });
    return JSON.parse(fixed);
  } catch (e) {}

  // Intento 3: Eliminar comas colgantes y normalizar caracteres de control
  try {
    const fixed2 = str
      .replace(/("(?:[^"\\]|\\.)*")/g, (match) => match.replace(/\r?\n/g, "\\n").replace(/\t/g, "\\t"))
      .replace(/,\s*([\]}])/g, "$1");
    return JSON.parse(fixed2);
  } catch (e) {}

  // Intento 4: Sanitización de caracteres no imprimibles
  try {
    const sanitised = str
      .replace(/("(?:[^"\\]|\\.)*")/g, (match) => match.replace(/\r?\n/g, "\\n").replace(/\t/g, "\\t"))
      .replace(/,\s*([\]}])/g, "$1")
      .replace(/[\x00-\x09\x0B-\x1F\x7F-\x9F]/g, " ");
    return JSON.parse(sanitised);
  } catch (e) {}

  return null;
}

export async function callOpenCodeGo(
  messages: ChatMessage[],
  temperature = 0.1
): Promise<string> {
  const apiKey = process.env.OPENCODE_GO_API_KEY || DEFAULT_OPENCODE_KEY;
  const baseUrl = (process.env.OPENCODE_GO_BASE_URL || DEFAULT_OPENCODE_BASE_URL).replace(/\/+$/, "");
  const model = process.env.OPENCODE_GO_MODEL || DEFAULT_OPENCODE_MODEL;

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


// Extractor para Carpeta 1 (TDR) con modelo DeepSeek IA
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
  const systemPrompt = `# Rol y Propósito:
Eres el Asistente Técnico Oficial de Contrataciones y Adquisiciones de DISTRIBUIDORA DE ELECTRICIDAD ENDE DEORURO S.A. Tu función es transformar cualquier requerimiento, nota técnica o borrador en un documento formal de **Especificaciones Técnicas (ET) o Términos de Referencia (TdR)**, cumpliendo rigurosamente con la estructura oficial de 14 puntos de la empresa.

---

# 🧠 LÓGICA DE DETECCIÓN Y ADAPTACIÓN SEGÚN EL RUBRO (PUNTO 3)
Al procesar la solicitud, identifica la categoría para adaptar el **Punto 3 (ESPECIFICACIÓN TÉCNICA)**:

### OPCIÓN A: BIENES, HERRAMIENTAS Y EQUIPOS (Suministros)
- **Estructura:** Ficha técnica y cuadro físico/mecánico.
- **Tipo de tabla:** "BIENES_SIMPLE"
- **Formato de Tabla:**
  | No. | DESCRIPCIÓN DEL ÍTEM | CARACTERÍSTICAS / ESPECIFICACIÓN TÉCNICA | CANT. |
  | --- | -------------------- | --------------------------------------- | ----- |

### OPCIÓN B: SALUD OCUPACIONAL, MEDICINA Y SERVICIOS DE LABORATORIO
- **Estructura:** Matriz de evaluación médica y requisitos de laboratorio/consulta.
- **Tipo de tabla:** "SALUD_OCUPACIONAL"
- **Formato de Tabla:**
  | EXAMEN / SERVICIO REQUERIDO | ESPECIFICACIÓN MÍNIMA REQUERIDA | PROPUESTO / INFORMAR |
  | --------------------------- | ------------------------------- | -------------------- |

---

# 📜 ESTRUCTURA OFICIAL DEL DOCUMENTO (14 PUNTOS)
Todo documento generado debe seguir estrictamente este índice:

### ENCABEZADO Y PORTADA INSTITUCIONAL
- **Título:** ESPECIFICACIONES TÉCNICAS - ADQUISICIÓN DE [OBJETO EN MAYÚSCULAS]
- **Cuadro de Firmas:** Elaborado por, Revisado por, Aprobado por.
- **RESUMEN DE LA ADQUISICIÓN:** Objeto y alcance general.
- **Lugar y Fecha:** [Mes] - [Año] / Oruro-Bolivia.
- **Índice de Contenido:** Numeral del 1 al 14.

### LOS 14 PUNTOS OBLIGATORIOS:
1. **ANTECEDENTES:** Contexto operativo y normativo institucional de ENDE DEORURO S.A. (Extensión controlada: MÍNIMO 5 LÍNEAS, MÁXIMO 8 LÍNEAS).
2. **JUSTIFICACIÓN / NECESIDAD:** Justificación técnica de la necesidad operativa, continuidad del servicio eléctrico y mitigación de riesgos de accidentes basada en los ítems solicitados (Extensión controlada: MÍNIMO 5 LÍNEAS, MÁXIMO 8 LÍNEAS).
3. **ESPECIFICACIÓN TÉCNICA:** Tabla completa con todos los ítems individuales solicitados, reconociendo cantidades (incluso escritas en palabras: 'dos palas' -> Cantidad 2, 'una cinta' -> Cantidad 1), unidad ('PZA', 'ROLLO', etc.) y especificaciones técnicas detalladas con normas ASTM/IEC/ISO.
4. **CALIDAD:** Estándares normativos aplicables (ASTM/IEC/ISO), garantía técnica mínima de 12 meses y certificados del fabricante.
5. **ÁMBITO DE APLICACIÓN:** Cuadrillas técnicas, personal operativo y subestaciones de ENDE DEORURO S.A.
6. **MÉTODO DE SELECCIÓN:** Menor Precio (Art. 31 del Reglamento SBC).
7. **VIGENCIA DE LA PROPUESTA:** Validez mínima de 30 días calendario.
8. **CATEGORÍA:** Bienes / Herramientas / Salud Ocupacional.
9. **LUGAR DE ENTREGA:** Almacenes ENDE DEORURO S.A., Oruro.
10. **TIEMPO DE ENTREGA:** Máximo 30 días calendario a partir de la Orden de Compra.
11. **FORMA DE ADJUDICACIÓN:** Por ítem requerido (Art. 31 SBC).
12. **PARA LA ACEPTACIÓN DEL LOTE / SERVICIO:** Inspección y evaluación técnica de conformidad en almacén.
13. **FORMA DE PAGO:** 100% contra entrega a satisfacción, informe de conformidad y factura oficial.
14. **APLICACIÓN DE MULTAS:** 0.25% por día de retraso injustificado.

# 📌 REGLAS DE FIDELIDAD Y EXTRACCIÓN DE ÍTEMS:
1. **Extensión de Antecedentes y Justificación:** Mínimo 5 líneas y máximo 8 líneas de redacción formal para cada una.
2. **Extracción Total de Ítems:** Extrae cada bien, herramienta, material o servicio solicitado. No omitas ninguno.
3. **Reconocimiento de Cantidades:** Identifica correctamente las cantidades numéricas aun si están escritas en palabras en español (ej: "dos palas" -> Cantidad: 2, Descripción: "PALAS"; "una cinta..." -> Cantidad: 1, Descripción: "CINTA AISLANTE 1000V"; "20 alicates..." -> Cantidad: 20, Descripción: "ALICATES UNIVERSALES 8 PULGADAS").
4. **Limpieza de Descripción:** NO incluyas palabras de cantidad ("DOS", "UNA", "TRES", etc.) dentro de la descripción del ítem; trasládalas al campo "cantidad".
5. **Dimensiones y Especificaciones Técnicas:** Conserva las medidas, calibres y voltajes ("8 PULGADAS", "1000V", "6 PULGADAS") en la descripción y redacta características técnicas completas con normas ASTM/IEC/ISO para cada ítem.
6. **Copia Fiel y Coherencia:** Redacta Antecedentes y Justificación basados exclusivamente en los ítems solicitados, sin mezclar rubros diferentes.

DEBES RESPONDER EXCLUSIVAMENTE UN OBJETO JSON VÁLIDO CON ESTA ESTRUCTURA:
{
  "titulo_proceso": "ESPECIFICACIONES TÉCNICAS - ADQUISICIÓN DE ...",
  "categoria_detectada": "Bienes" | "Servicios" | "Salud Ocupacional",
  "tipo_tabla_sugerido": "BIENES_SIMPLE" | "SALUD_OCUPACIONAL" | "MATRIZ_SERVICIOS",
  "antecedentes_texto": "Texto formal de 5 a 8 líneas de antecedentes",
  "justificacion_texto": "Texto formal de 5 a 8 líneas de justificación basado en los ítems solicitados",
  "calidad_texto": "Texto de calidad",
  "ambito_aplicacion": "Texto de ámbito",
  "metodo_seleccion_texto": "Menor Precio (Art. 31 del Reglamento SBC)",
  "vigencia_propuesta_texto": "30 días calendario computables a partir de la fecha de presentación",
  "categoria_texto": "Bienes y Herramientas",
  "lugar_entrega": "Almacenes ENDE DEORURO S.A., Oruro",
  "tiempo_entrega_texto": "Máximo 30 días calendario",
  "forma_adjudicacion": "Por ítem requerido, formalizada por Orden de Compra (Art. 31 SBC)",
  "aceptacion_lote": "Inspección técnica de conformidad al momento de la entrega",
  "forma_pago_texto": "El pago se realizará contra entrega a satisfacción...",
  "multas_texto": "Multa del 0.25% por cada día de retraso",
  "items": [
    {
      "item": 1,
      "descripcion": "DESCRIPCIÓN DEL ÍTEM",
      "cantidad": 20,
      "unidad": "PZA",
      "caracteristicasTecnicas": "Especificación técnica detallada con normas aplicables"
    }
  ]
}`;

  const rawText = (input.documentText || input.insumoTexto || "").trim();
  let userContent: string = `Requerimiento / Solicitud:\n`;
  if (input.nombreArchivo) userContent += `Archivo: ${input.nombreArchivo}\n`;
  if (rawText) userContent += `${rawText}\n`;
  else if (adquisicion.titulo_proceso) userContent += `${adquisicion.titulo_proceso}\n`;

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
      const parsed = extractJsonFromText(aiRaw);
      if (parsed && parsed.items && Array.isArray(parsed.items) && parsed.items.length > 0) {
        const isSalud = (parsed.categoria_detectada as string) === "Salud Ocupacional" ||
          (parsed.titulo_proceso || "").toLowerCase().includes("oftalmo") ||
          (parsed.titulo_proceso || "").toLowerCase().includes("laboratorio") ||
          (parsed.tipo_tabla_sugerido === "SALUD_OCUPACIONAL");

        const enrichedItems: ItemAdquisicion[] = parsed.items.map((it: any, idx: number) => {
          const num = it.item || idx + 1;
          const desc = (it.descripcion || it.nombre || `ÍTEM #${num}`).toUpperCase();
          const cant = Number(it.cantidad) || 1;
          const unidad = (it.unidad || (isSalud ? "ESTUDIO" : "PZA")).toUpperCase();
          const carac = it.caracteristicasTecnicas || it.especificacionMinima || it.caracteristicas || "Conforme a especificaciones técnicas y normas aplicables.";
          const entregable = it.productoEntregable || it.propuestoOferente || (isSalud ? "Certificado médico e informe clínico" : `Entrega física de ${cant} ${unidad}`);

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
              uso: isSalud ? "Medicina del Trabajo y Salud Ocupacional" : "Personal Operativo y Cuadrillas de Mantenimiento ENDE DEORURO",
              normaCertificacion: isSalud ? "Acreditación Sanitaria" : "Normas ASTM / IEC / ISO",
              material: isSalud ? "Metodología Analítica" : "Acero forjado con aislamiento dieléctrico",
              color: "Estándar",
              dimensiones: "Según requerimiento",
              categoriaItem: isSalud ? "Salud Ocupacional" : "Herramientas",
              caracteristicasDetalle: [carac],
            },
          };
        });

        const puntos14: { [num: number]: string } = {
          1: parsed.antecedentes_texto || "",
          2: parsed.justificacion_texto || "",
          4: parsed.calidad_texto || "",
          5: parsed.ambito_aplicacion || "",
          6: parsed.metodo_seleccion_texto || "",
          7: parsed.vigencia_propuesta_texto || "",
          8: parsed.categoria_texto || "",
          9: parsed.lugar_entrega || "",
          10: parsed.tiempo_entrega_texto || "",
          11: parsed.forma_adjudicacion || "",
          12: parsed.aceptacion_lote || "",
          13: parsed.forma_pago_texto || "",
          14: parsed.multas_texto || "",
        };

        return {
          titulo_proceso: parsed.titulo_proceso || adquisicion.titulo_proceso,
          antecedentes_texto: parsed.antecedentes_texto || "",
          justificacion_texto: parsed.justificacion_texto || "",
          calidad_texto: parsed.calidad_texto || "",
          ambito_aplicacion: parsed.ambito_aplicacion || "",
          metodo_seleccion_texto: parsed.metodo_seleccion_texto || "",
          vigencia_propuesta_texto: parsed.vigencia_propuesta_texto || "",
          categoria_texto: parsed.categoria_texto || (isSalud ? "Salud Ocupacional" : "Bienes y Herramientas"),
          lugar_entrega: parsed.lugar_entrega || "Almacenes ENDE DEORURO S.A., Oruro",
          tiempo_entrega_texto: parsed.tiempo_entrega_texto || "Máximo 30 días calendario",
          forma_adjudicacion: parsed.forma_adjudicacion || "Por ítem requerido (Art. 31 SBC)",
          aceptacion_lote: parsed.aceptacion_lote || "Inspección técnica de conformidad en almacén",
          forma_pago_texto: parsed.forma_pago_texto || "Contra entrega a satisfacción y factura oficial",
          multas_texto: parsed.multas_texto || "Multa del 0.25% por día de retraso",
          seccion3_introduccion_texto: "Detalle de especificaciones técnicas requeridas:",
          tipo_tabla_sugerido: isSalud ? "SALUD_OCUPACIONAL" : "BIENES_SIMPLE",
          columnas_tabla_tdr: isSalud
            ? ["EXAMEN / SERVICIO REQUERIDO", "ESPECIFICACIÓN MÍNIMA REQUERIDA", "PROPUESTO / INFORMAR"]
            : ["No.", "DESCRIPCIÓN DEL ÍTEM", "CARACTERÍSTICAS / ESPECIFICACIÓN TÉCNICA", "CANT."],
          puntos_detectados: puntos14,
          puntos_14_texto: puntos14,
          items: enrichedItems,
        };
      }
    } catch (e) {
      console.warn("Could not parse JSON from AI:", e);
  }
  }

  // Fallback institucional de alta resiliencia con el Cuaderno Normativo de ENDE DEORURO S.A.
  const fallbackText = rawText || (input.insumoTexto || input.documentText || "").trim();
  const wordToNum: Record<string, number> = {
    un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
    once: 11, doce: 12, quince: 15, veinte: 20, veinticinco: 25, treinta: 30, cincuenta: 50, cien: 100
  };

  const detectedItems: ItemAdquisicion[] = [];
  let itemCounter = 1;

  if (fallbackText) {
    // Intentar segmentar por saltos de línea o comas
    const segments = fallbackText.split(/(?:[\r\n;,]|\s+y\s+)/i).map(s => s.trim()).filter(s => s.length > 2);
    for (const seg of segments) {
      const m = seg.match(/(?:.*:\s*)?(\d+|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|quince|veinte|treinta|cincuenta|cien)?\s+(.+)/i);
      if (m && m[2]) {
        const cantStr = (m[1] || "1").toLowerCase();
        const cant = wordToNum[cantStr] || parseInt(cantStr) || 1;
        const desc = m[2].replace(/^de\s+/i, "").replace(/\.$/, "").trim().toUpperCase();
        if (!desc.startsWith("ADQUISIC") && !desc.startsWith("HERRAMIENTAS PARA") && desc.length > 2) {
          const unidad = desc.includes("CINTA") ? "ROLLO" : desc.includes("JUEGO") ? "JGO" : "PZA";
          detectedItems.push({
            id: `item-norm-${Date.now()}-${itemCounter}`,
            item: itemCounter,
            descripcion: desc,
            cantidad: cant,
            unidad: unidad,
            precioUnitarioEstimado: 120,
            precioTotalEstimado: cant * 120,
            caracteristicasTecnicas: "Cumplimiento obligatorio de normas técnicas ASTM / IEC / ISO aplicables.",
            especificacionMinima: "Cumplimiento obligatorio de normas técnicas ASTM / IEC / ISO aplicables.",
            valores_columnas: [String(itemCounter), desc, "Cumplimiento de normas técnicas ASTM / IEC / ISO.", String(cant)],
            fichaTecnica: {
              uso: "Personal Operativo y Cuadrillas de Mantenimiento ENDE DEORURO",
              normaCertificacion: "Normas ASTM / IEC / ISO",
              material: "Acero forjado con aislamiento dieléctrico",
              color: "Estándar",
              dimensiones: "Según requerimiento",
              categoriaItem: "Herramientas",
              caracteristicasDetalle: ["Cumplimiento de normas técnicas aplicables ASTM/IEC/ISO."],
            },
          });
          itemCounter++;
        }
      }
    }
  }

  // Si no se detectaron ítems desglosados, generar al menos un ítem basado en el título o insumo
  if (detectedItems.length === 0) {
    const itemDesc = fallbackText.length > 0 && fallbackText.length < 90
      ? fallbackText.toUpperCase()
      : `SUMINISTROS PARA ${adquisicion.titulo_proceso.toUpperCase()}`;
    detectedItems.push({
      id: `item-norm-${Date.now()}-1`,
      item: 1,
      descripcion: itemDesc,
      cantidad: 1,
      unidad: "PZA",
      precioUnitarioEstimado: 1000,
      precioTotalEstimado: 1000,
      caracteristicasTecnicas: "Fabricación de primer uso conforme a normas técnicas ASTM/IEC/ISO aplicables.",
      especificacionMinima: "Fabricación de primer uso conforme a normas técnicas ASTM/IEC/ISO aplicables.",
      valores_columnas: ["1", itemDesc, "Conforme a normas técnicas.", "1"],
      fichaTecnica: {
        uso: "Personal Operativo ENDE DEORURO S.A.",
        normaCertificacion: "Normas ASTM / IEC / ISO",
        material: "Estándar institucional",
        color: "Estándar",
        dimensiones: "Según requerimiento",
        categoriaItem: "Bienes",
        caracteristicasDetalle: ["Conforme a especificaciones técnicas oficiales."],
      },
    });
  }

  const finalItems = (adquisicion.items && adquisicion.items.length > 0) ? adquisicion.items : detectedItems;

  const antText = adquisicion.antecedentes_texto ||
    `De acuerdo a la legislación vigente del Estado Plurinacional de Bolivia, normas y políticas internas institucionales, se da inicio al proceso de adquisición para "${adquisicion.titulo_proceso}". El presente proceso se encuentra enmarcado en el Manual de Procedimientos y el Reglamento de Adquisición de Bienes, Construcción de Obras y Contratación de Servicios (SBC) de la Distribuidora de Electricidad ENDE DEORURO S.A.`;

  const justText = adquisicion.justificacion_texto ||
    `La adquisición tiene por finalidad técnica garantizar la continuidad, calidad y confiabilidad del suministro eléctrico en el departamento de Oruro. La incorporación de estos insumos permite prevenir fallas intempestivas en las redes de media y baja tensión, optimizar los tiempos de respuesta y precautelar la seguridad industrial del personal operativo de ENDE DEORURO S.A.`;

  const puntos14: { [num: number]: string } = {
    1: antText,
    2: justText,
    4: "Los bienes deberán ser nuevos, de primer uso y fabricados bajo normas de calidad aplicables (ASTM/IEC/ISO) con garantía técnica mínima de 12 meses.",
    5: "Subestaciones, cuadrillas operativas y redes de distribución de ENDE DEORURO S.A.",
    6: "Por ítem requerido al Menor Precio evaluado, conforme al Artículo 31 del Reglamento SBC.",
    7: "Tendrá una validez mínima de 30 (treinta) días calendario computables a partir de la fecha de presentación de ofertas.",
    8: "Bienes, Herramientas y Suministros Oficiales.",
    9: adquisicion.lugar_entrega || "Almacenes Centrales de ENDE DEORURO S.A., Oruro - Bolivia.",
    10: "Máximo 30 días calendario computables a partir del día siguiente de la recepción de la Orden de Compra formal.",
    11: "Por ítem requerido, formalizada por Orden de Compra (Art. 31 SBC).",
    12: "El personal técnico de ENDE DEORURO S.A. realizará una evaluación técnica de conformidad el día de la entrega física del lote.",
    13: "El pago se realizará en moneda nacional contra entrega satisfactoria del lote, conformidad de ENDE DEORURO S.A. y factura comercial oficial.",
    14: "Se aplicará la multa del 0.25% por cada día de retraso en la entrega respecto al plazo contractual.",
  };

  return {
    titulo_proceso: adquisicion.titulo_proceso,
    antecedentes_texto: antText,
    justificacion_texto: justText,
    calidad_texto: puntos14[4],
    ambito_aplicacion: puntos14[5],
    metodo_seleccion_texto: puntos14[6],
    vigencia_propuesta_texto: puntos14[7],
    categoria_texto: puntos14[8],
    lugar_entrega: puntos14[9],
    tiempo_entrega_texto: puntos14[10],
    forma_adjudicacion: puntos14[11],
    aceptacion_lote: puntos14[12],
    forma_pago_texto: puntos14[13],
    multas_texto: puntos14[14],
    tipo_tabla_sugerido: "BIENES_SIMPLE",
    puntos_detectados: puntos14,
    puntos_14_texto: puntos14,
    items: finalItems,
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
  const systemPrompt = `Eres un auditor legal y técnico experto en contrataciones de ENDE DEORURO S.A. (Bolivia).
Debes redactar y estructurar los datos para el "INFORME DE CONFORMIDAD (ADQUISICIONES)" oficial de ENDE DEORURO S.A., con los 4 puntos oficiales:
1. ANTECEDENTES
2. DESARROLLO
3. RECEPCIÓN DE LOS BIENES Y/O SERVICIOS (tabla con N°, DESCRIPCIÓN, FECHA DE RECEPCIÓN, OBSERVACIONES)
4. CONCLUSIONES

Responde ÚNICAMENTE con un JSON con los siguientes campos:
{
  "fecha": "Oruro, 23 de Julio de 2026",
  "a_nombre": "LIC. VICENTE PAUL VEGA RAMIREZ",
  "a_cargo": "SUPERINTENDENTE DE ADMINISTRACIÓN Y FINANZAS a.i.",
  "de_nombre": "ING. TATIANA TORRES ANDRADE",
  "de_cargo": "SUPERVISOR DE SEGURIDAD INDUSTRIAL a.i",
  "proceso": "${adquisicion.titulo_proceso.toUpperCase()}",
  "antecedentes": "En atención y mantenimiento de las condiciones de orden, calidad y cumplimiento técnico en las instalaciones de la empresa para dar cumplimiento a los estándares operativos.",
  "desarrollo": "En este sentido en cumplimiento del Reglamento de Adquisición de Bienes, Construcción de Obras Y Contratación de Servicios, se emite la orden/contrato para el proceso \\"${adquisicion.titulo_proceso.toUpperCase()}\\", el cual cumple a cabalidad con las especificaciones técnicas requeridas y condiciones contractuales.",
  "items_recepcion": [
    {
      "numero": 1,
      "descripcion": "RECEPCIÓN Y CONFORMIDAD DE LOS BIENES O SERVICIOS ADQUIRIDOS",
      "fecha_recepcion": "23/07/2026",
      "observaciones": "Sin observaciones / Servicio y bienes recibidos a conformidad al 100%"
    }
  ],
  "conclusiones_texto": "De acuerdo a la verificación e inspección técnica realizada, como unidad solicitante se expresa la entera conformidad respecto a la prestación del servicio / provisión de bienes señalados. Se concluye que el proveedor cumple satisfactoriamente con el 100% de las especificaciones técnicas exigidas."
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
    fecha: adquisicion.informe_conf_fecha || "Oruro, 23 de Julio de 2026",
    a_nombre: adquisicion.informe_conf_a_nombre || "LIC. VICENTE PAUL VEGA RAMIREZ",
    a_cargo: adquisicion.informe_conf_a_cargo || "SUPERINTENDENTE DE ADMINISTRACIÓN Y FINANZAS a.i.",
    de_nombre: adquisicion.informe_conf_de_nombre || "ING. TATIANA TORRES ANDRADE",
    de_cargo: adquisicion.informe_conf_de_cargo || "SUPERVISOR DE SEGURIDAD INDUSTRIAL a.i",
    proceso: adquisicion.titulo_proceso ? adquisicion.titulo_proceso.toUpperCase() : "SERVICIO DE LIMPIEZA E HIGIENE PARA LAS DEPENDENCIAS DE ENDE ORURO S.A.",
    antecedentes: adquisicion.informe_conf_antecedentes || "En atención y mantenimiento de las condiciones de orden, higiene y limpieza en las instalaciones de la empresa para dar cumplimiento a los estándares operativos y de seguridad industrial.",
    desarrollo: adquisicion.informe_conf_desarrollo || `En este sentido en cumplimiento del Reglamento de Adquisición de Bienes, Construcción de Obras Y Contratación de Servicios, se emite el contrato GG-CTO-26/040014 "${adquisicion.titulo_proceso.toUpperCase()}" para la empresa adjudicada, la cual cumple con las especificaciones técnicas y menor precio que se solicitó en el proceso de adquisición.`,
    items_recepcion: (adquisicion.items && adquisicion.items.length > 0)
      ? adquisicion.items.map((it, idx) => ({
          numero: idx + 1,
          descripcion: it.descripcion || "ITEM O SERVICIO ADQUIRIDO",
          fecha_recepcion: "23/07/2026",
          observaciones: "Sin observaciones / Servicio prestado a conformidad",
        }))
      : [
          {
            numero: 1,
            descripcion: "SERVICIO DE LIMPIEZA MES DE JUNIO 2026",
            fecha_recepcion: "30/06/2026",
            observaciones: "Sin observaciones / Servicio prestado a conformidad",
          },
        ],
    conclusiones_texto:
      adquisicion.informe_conf_conclusiones_texto ||
      "De acuerdo a la verificación e inspección realizada al desempeño de las tareas desempeñadas durante el mes de junio de 2026, como unidad solicitante se expresa la entera conformidad respecto a la prestación del servicio señalado. Se concluye que el proveedor cumple satisfactoriamente con las especificaciones técnicas exigidas.",
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

