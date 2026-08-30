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
1. **ANTECEDENTES:** Contexto operativo, normativo o institucional de ENDE DEORURO S.A. (Mínimo 3 párrafos formales extensos).
2. **JUSTIFICACIÓN / NECESIDAD:** Justificación exhaustiva (Mínimo 4 párrafos formales detallando necesidad técnica, problemas de campo, mitigación de riesgos de accidentes y declaración imperiosa basada estrictamente en los ítems solicitados).
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
1. **Extracción Total de Ítems:** Extrae cada bien, herramienta, material o servicio solicitado. No omitas ninguno.
2. **Reconocimiento de Cantidades:** Identifica correctamente las cantidades numéricas aun si están escritas en palabras en español (ej: "dos palas" -> Cantidad: 2, Descripción: "PALAS"; "una cinta..." -> Cantidad: 1, Descripción: "CINTA AISLANTE 1000V"; "20 alicates..." -> Cantidad: 20, Descripción: "ALICATES UNIVERSALES 8 PULGADAS").
3. **Limpieza de Descripción:** NO incluyas palabras de cantidad ("DOS", "UNA", "TRES", etc.) dentro de la descripción del ítem; trasládalas al campo "cantidad".
4. **Dimensiones y Especificaciones Técnicas:** Conserva las medidas, calibres y voltajes ("8 PULGADAS", "1000V", "6 PULGADAS") en la descripción y redacta características técnicas completas con normas ASTM/IEC/ISO para cada ítem.
5. **Copia Fiel y Coherencia:** Redacta Antecedentes y Justificación basados de forma exhaustiva y exclusiva en los ítems solicitados, sin mezclar rubros diferentes.

DEBES RESPONDER EXCLUSIVAMENTE UN OBJETO JSON VÁLIDO CON ESTA ESTRUCTURA:
{
  "titulo_proceso": "ESPECIFICACIONES TÉCNICAS - ADQUISICIÓN DE ...",
  "categoria_detectada": "Bienes" | "Servicios" | "Salud Ocupacional",
  "tipo_tabla_sugerido": "BIENES_SIMPLE" | "SALUD_OCUPACIONAL" | "MATRIZ_SERVICIOS",
  "antecedentes_texto": "Texto amplio de 3 párrafos de antecedentes",
  "justificacion_texto": "Texto amplio de 4 párrafos de justificación basado en los ítems solicitados",
  "calidad_texto": "Texto amplio de calidad",
  "ambito_aplicacion": "Texto amplio de ámbito",
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

  let userContent: string = `Requerimiento / Solicitud:\n`;
  if (input.nombreArchivo) userContent += `Archivo: ${input.nombreArchivo}\n`;
  if (input.documentText) userContent += `${input.documentText}\n`;
  if (input.insumoTexto) userContent += `Instrucción: ${input.insumoTexto}\n`;

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

  // Fallback institucional en caso de fallo de red
  return {
    titulo_proceso: adquisicion.titulo_proceso,
    antecedentes_texto: adquisicion.antecedentes_texto || "La DISTRIBUIDORA DE ELECTRICIDAD ENDE DEORURO S.A. requiere la adquisición de bienes y servicios para sus operaciones.",
    justificacion_texto: adquisicion.justificacion_texto || "La adquisición es necesaria para garantizar la continuidad del suministro de energía eléctrica.",
    calidad_texto: "Conforme a normas técnicas aplicables ASTM/IEC/ISO.",
    ambito_aplicacion: "Personal técnico y operativo de ENDE DEORURO S.A.",
    metodo_seleccion_texto: "Menor Precio (Art. 31 SBC).",
    vigencia_propuesta_texto: "30 días calendario.",
    categoria_texto: "Bienes y Herramientas",
    lugar_entrega: "Almacenes ENDE DEORURO S.A., Oruro",
    tiempo_entrega_texto: "Máximo 30 días calendario",
    forma_adjudicacion: "Por ítem requerido (Art. 31 SBC)",
    aceptacion_lote: "Inspección técnica de conformidad el día de la entrega",
    forma_pago_texto: "Contra entrega a satisfacción y factura oficial",
    multas_texto: "Multa del 0.25% por cada día de retraso",
    tipo_tabla_sugerido: "BIENES_SIMPLE",
    items: adquisicion.items || [],
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

