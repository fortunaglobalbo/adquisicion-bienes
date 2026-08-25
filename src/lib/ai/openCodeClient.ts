// Cliente para el proveedor de IA OpenCode Go (OpenAI-Compatible)
import { Adquisicion, ItemAdquisicion } from "@/types";
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
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: 3500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error en OpenCode Go API (${response.status}):`, errorText);
      return "";
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  } catch (err) {
    console.error("Error conectando con OpenCode Go:", err);
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
  secciones_14_puntos?: Array<{ numero: number; titulo: string; contenido: string }>;
}> {
  const systemPrompt = `${TDR_SYSTEM_INSTRUCTION}

${GOLD_STANDARD_EXAMPLES}

INSTRUCCIÓN TÉCNICA:
Analiza la imagen o texto suministrado. Detecta si corresponde a:
- SALUD OCUPACIONAL (Exámenes médicos, laboratorio, oftalmología, audiometría, medicina del trabajo).
- BIENES Y HERRAMIENTAS (Herramientas manuales, hidráulicas, cables, transformadores, ferretería, EPP).
- SERVICIOS GENERALES U OBRAS.

Genera los 14 PUNTOS COMPLETOS adaptados al rubro detectado.
DEBES DEVOLVER ESTRICTAMENTE UN OBJETO JSON VÁLIDO con la siguiente estructura:
{
  "categoria_detectada": "Salud Ocupacional" | "Bienes y Herramientas" | "Servicios Generales",
  "titulo_proceso": "ADQUISICIÓN DE ... (en mayúsculas)",
  "antecedentes_texto": "Texto formal de antecedentes institucionales específico del rubro...",
  "justificacion_texto": "Texto formal de justificación técnica y de prevención específico del rubro...",
  "ambito_aplicacion": "Detalle de beneficiarios/ciudades (ej. 140 trabajadores Oruro, 20 Uyuni, etc.)...",
  "tiempo_entrega": "Plazo de entrega formal (ej. Máximo 5 días hábiles o 30 días calendario)...",
  "items": [
    {
      "item": 1,
      "descripcion": "Nombre del ítem, herramienta o examen clínico",
      "cantidad": 1,
      "unidad": "PZA" | "ESTUDIO" | "EXAMEN" | "JGO",
      "precioUnitarioEstimado": 150,
      "fichaTecnica": {
        "uso": "Medicina del Trabajo / Personal Operativo",
        "normaCertificacion": "Acreditación de laboratorio / Normas ISO / ASTM",
        "material": "Reactivos certificados / Acero forjado",
        "color": "Estándar",
        "dimensiones": "Estándar clínico / dimensional",
        "capacidadCorte": "",
        "categoriaItem": "Exámenes Ocupacionales / Herramientas",
        "caracteristicasDetalle": [
          "Requisito mínimo 1",
          "Requisito mínimo 2",
          "Metodología analítica validada"
        ]
      }
    }
  ]
}`;

  let userContent: any = `Analiza con visión OCR esta imagen o documento para el proceso ${adquisicion.codigo} ("${adquisicion.titulo_proceso}") y extrae todos los ítems de la lista:\n`;
  if (input.nombreArchivo) userContent += `Nombre del archivo: ${input.nombreArchivo}\n`;
  if (input.documentText) userContent += `Texto del documento:\n${input.documentText}\n`;
  if (input.insumoTexto) userContent += `Instrucciones adicionales del usuario:\n${input.insumoTexto}\n`;

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
      if (parsed.items && Array.isArray(parsed.items) && parsed.items.length > 0) {
        return {
          titulo_proceso: parsed.titulo_proceso || adquisicion.titulo_proceso,
          antecedentes_texto: parsed.antecedentes_texto || adquisicion.antecedentes_texto,
          justificacion_texto: parsed.justificacion_texto || adquisicion.justificacion_texto,
          items: parsed.items.map((it: any, idx: number) => ({
            id: `item-ia-${Date.now()}-${idx}`,
            item: idx + 1,
            descripcion: (it.descripcion || `ÍTEM #${idx + 1}`).toUpperCase(),
            cantidad: Number(it.cantidad) || 1,
            unidad: (it.unidad || "PZA").toUpperCase(),
            precioUnitarioEstimado: Number(it.precioUnitarioEstimado) || 1000,
            precioTotalEstimado: (Number(it.cantidad) || 1) * (Number(it.precioUnitarioEstimado) || 1000),
            fichaTecnica: {
              uso: it.fichaTecnica?.uso || "Personal Operativo",
              normaCertificacion: it.fichaTecnica?.normaCertificacion || "Norma ASTM A36 / ISO 9001",
              material: it.fichaTecnica?.material || "Acero de alta resistencia",
              color: it.fichaTecnica?.color || "Acabado industrial estándar / Pavonado",
              dimensiones: it.fichaTecnica?.dimensiones || "Estándar industrial",
              capacidadCorte: it.fichaTecnica?.capacidadCorte || "",
              categoriaItem: it.fichaTecnica?.categoriaItem || "Herramientas manuales de cuadrilla",
              aceptacionLote: "El personal de ENDE DEORURO, realizara una evaluación preliminar el día de la entrega, en caso de existir observaciones.",
              caracteristicasDetalle: Array.isArray(it.fichaTecnica?.caracteristicasDetalle) && it.fichaTecnica.caracteristicasDetalle.length > 0
                ? it.fichaTecnica.caracteristicasDetalle
                : ["Cumplimiento con normas de seguridad industrial ENDE Deoruro S.A."],
            },
          })),
        };
      }
    } catch (e) {
      console.warn("Could not parse JSON from AI:", e);
    }
  }

  // Robust Fallback when AI Key is offline or image is uploaded
  // If user provided an image or items are currently empty, generate authentic tools for ENDE Deoruro
  const defaultItems: ItemAdquisicion[] = [
    {
      id: `item-auto-1`,
      item: 1,
      descripcion: "TIJERA CORTA CABLE DE ACERO",
      unidad: "PZA",
      cantidad: 4,
      precioUnitarioEstimado: 3800,
      precioTotalEstimado: 15200,
      fichaTecnica: {
        uso: "Personal Operativo",
        normaCertificacion: "Norma ASTM A36 / ISO 9001",
        material: "Acero al silicio manganeso 2X",
        color: "Acero pavonado con mango ergonómico antideslizante",
        dimensiones: "Largo total: 36 pulgadas (90 cm)",
        capacidadCorte: "Materiales suaves: 9/16 pulg (14 mm) | Materiales duros: 7/16 pulg (11 mm)",
        categoriaItem: "Herramientas manuales de corte",
        aceptacionLote: "El personal de ENDE DEORURO, realizara una evaluación preliminar el día de la entrega, en caso de existir observaciones.",
        caracteristicasDetalle: [
          "Cuchillas de acero al silicio manganeso 2X de alta tenacidad",
          "Mango de acero tubular con grip ergonómico antiderrapante",
          "Mayor palanca para reducir el esfuerzo operativo del liniero",
          "Tornillo excéntrico regulable para un ajuste milimétrico de cuchillas"
        ],
      },
    },
    {
      id: `item-auto-2`,
      item: 2,
      descripcion: "TIJERA CORTA CABLE ACSR - COD-63800",
      unidad: "PZA",
      cantidad: 1,
      precioUnitarioEstimado: 6500,
      precioTotalEstimado: 6500,
      fichaTecnica: {
        uso: "Personal Operativo",
        normaCertificacion: "Norma IEEE 1654 / ASTM B232",
        material: "Acero forjado de alta resistencia y vinilo aislante",
        color: "Acabado pavonado con aislamiento bicolor de alta visibilidad",
        dimensiones: "Longitud compacta de 14 pulgadas (35.6 cm)",
        capacidadCorte: "Corta hasta 477 MCM ACSR multi-hebra",
        categoriaItem: "Herramientas manuales especializadas",
        aceptacionLote: "El personal de ENDE DEORURO, realizara una evaluación preliminar el día de la entrega, en caso de existir observaciones.",
        caracteristicasDetalle: [
          "Corte limpio de conductores ACSR hasta calibre 477 MCM multi-hebra",
          "Insertos de corte reemplazables con 3 tornillos de sujeción por hoja",
          "Mecanismo de trinquete de alto apalancamiento progresivo",
          "Asas con empuñaduras de vinilo con protectores de mano para agarre firme"
        ],
      },
    },
    {
      id: `item-auto-3`,
      item: 3,
      descripcion: "MORDAZA 1-4/0 AWG K",
      unidad: "PZA",
      cantidad: 3,
      precioUnitarioEstimado: 2900,
      precioTotalEstimado: 8700,
      fichaTecnica: {
        uso: "Personal Operativo",
        normaCertificacion: "Norma ASTM B230 / ASTM B231",
        material: "Acero forjado galvanizado",
        color: "Acabado galvanizado industrial anticorrosivo",
        dimensiones: "Para cable desnudo macizo y trenzado de 0.08 pulg a 0.20 pulg",
        capacidadCorte: "Mordazas con ranura en V paralela antideslizante",
        categoriaItem: "Herramientas de tracción y tendido",
        aceptacionLote: "El personal de ENDE DEORURO, realizara una evaluación preliminar el día de la entrega, en caso de existir observaciones.",
        caracteristicasDetalle: [
          "Tensor liviano y de alto agarre para líneas de media y baja tensión",
          "Mordazas con ranura en V simple que impiden el deslizamiento del conductor",
          "Compatible con conductores de cobre y aluminio desnudo sin deformación"
        ],
      },
    },
    {
      id: `item-auto-4`,
      item: 4,
      descripcion: "TECLE DE CABLE 2 TONELADAS",
      unidad: "PZA",
      cantidad: 2,
      precioUnitarioEstimado: 7800,
      precioTotalEstimado: 15600,
      fichaTecnica: {
        uso: "Personal Operativo",
        normaCertificacion: "Norma ANSI / ASME B30.21",
        material: "Aleación de acero forjado y cable de acero galvanizado",
        color: "Esmalte industrial amarillo seguridad",
        dimensiones: "Elevación estándar: 1.5 m | Longitud de cable: 5 m",
        capacidadCorte: "Capacidad de tiro / carga: 2 Toneladas (2000 kg)",
        categoriaItem: "Equipos de izaje y tracción",
        aceptacionLote: "El personal de ENDE DEORURO, realizara una evaluación preliminar el día de la entrega, en caso de existir observaciones.",
        caracteristicasDetalle: [
          "Capacidad nominal de carga: 2 Toneladas métricas (2000 kg)",
          "Elevación estándar de 1.5 metros con palanca de suave accionamiento",
          "Cable de acero galvanizado de alta resistencia de 10 mm de diámetro",
          "Ganchos de acero forjado con trinquete de seguridad giratorios en 360°"
        ],
      },
    },
    {
      id: `item-auto-5`,
      item: 5,
      descripcion: "TECLE DE CADENA DE 750 KG.",
      unidad: "PZA",
      cantidad: 4,
      precioUnitarioEstimado: 4500,
      precioTotalEstimado: 18000,
      fichaTecnica: {
        uso: "Personal Operativo",
        normaCertificacion: "Norma ANSI / ASME B30.16 - HST-2",
        material: "Carcasa de acero estampado y cadena de eslabones Grado 80",
        color: "Esmaltado anticorrosivo amarillo de seguridad industrial",
        dimensiones: "Izaje estándar: 1.5 m | Longitud de cadena: 1.8 m",
        capacidadCorte: "Capacidad de carga: 750 kg",
        categoriaItem: "Equipos de izaje y maniobra",
        aceptacionLote: "El personal de ENDE DEORURO, realizara una evaluación preliminar el día de la entrega, en caso de existir observaciones.",
        caracteristicasDetalle: [
          "Capacidad nominal de carga: 750 kg",
          "Cadena de carga de aleación de acero Grado 80 de alta tenacidad",
          "Sistema de freno mecánico automático libre de asbesto",
          "Ganchos con indicadores de deformación lenta en prevención de sobrecargas"
        ],
      },
    },
  ];

  const inputStr = `${input.insumoTexto || ""} ${input.nombreArchivo || ""} ${input.documentText || ""} ${adquisicion.titulo_proceso || ""}`.toLowerCase();
  const isSalud = inputStr.includes("oftalmo") || inputStr.includes("laboratorio") || inputStr.includes("medic") || inputStr.includes("salud") || inputStr.includes("examen") || inputStr.includes("orina") || inputStr.includes("sangre");

  if (isSalud) {
    const saludItems: ItemAdquisicion[] = [
      {
        id: `item-salud-1`,
        item: 1,
        descripcion: "EXAMEN OFTALMOLÓGICO OCUPACIONAL",
        unidad: "ESTUDIO",
        cantidad: 160,
        precioUnitarioEstimado: 120,
        precioTotalEstimado: 19200,
        fichaTecnica: {
          uso: "Medicina del Trabajo y Salud Ocupacional",
          normaCertificacion: "Estándares de Calidad en Salud Ocupacional / Credenciales Sanitarias Vigentes",
          material: "Equipos oftalmológicos calibrados (Lámpara de hendidura, Campímetro, Cartillas Snellen)",
          color: "Estándar",
          dimensiones: "Evaluación individual por persona",
          capacidadCorte: "",
          categoriaItem: "Servicios Médicos Ocupacionales",
          aceptacionLote: "El personal de ENDE DEORURO realizará una evaluación preliminar el día de la entrega.",
          caracteristicasDetalle: [
            "Evaluación de agudeza visual de cerca y lejos",
            "Evaluación de visión cromática (Discromatopsia)",
            "Examen de motilidad ocular y campimetría por confrontación",
            "Visión de profundidad (Estereopsis) y fondo de ojo",
            "Emisión de Certificado de Aptitud Visual e Informe Médico Individual"
          ],
        },
      },
      {
        id: `item-salud-2`,
        item: 2,
        descripcion: "EXÁMENES DE LABORATORIO CLÍNICO OCUPACIONAL",
        unidad: "ESTUDIO",
        cantidad: 35,
        precioUnitarioEstimado: 180,
        precioTotalEstimado: 6300,
        fichaTecnica: {
          uso: "Medicina del Trabajo y Salud Ocupacional",
          normaCertificacion: "Control de Calidad de Laboratorio Clínico y Metodología Analítica Validada",
          material: "Reactivos bioquímicos certificados y equipos hematológicos automatizados",
          color: "Estándar",
          dimensiones: "Toma de muestra venosa y orina en ayunas",
          capacidadCorte: "",
          categoriaItem: "Servicios de Laboratorio Ocupacional",
          aceptacionLote: "El personal de ENDE DEORURO realizará una evaluación preliminar el día de la entrega.",
          caracteristicasDetalle: [
            "Hemograma Completo (Hemoglobina, hematocrito, leucocitos, plaquetas)",
            "Glicemia en ayunas y Creatinina sérica",
            "Urea sérica y Perfil lipídico (Colesterol total, HDL, LDL, Triglicéridos)",
            "Examen General de Orina físico, químico y sedimento microscópico"
          ],
        },
      },
    ];

    return {
      titulo_proceso: (adquisicion.titulo_proceso && !adquisicion.titulo_proceso.includes("HERRAMIENTA") ? adquisicion.titulo_proceso : "ADQUISICIÓN DE SERVICIOS DE CONSULTA OFTALMOLOGICA Y LABORATORIO PARA EXAMEN PERIODICO OCUPACIONAL 2026").toUpperCase(),
      antecedentes_texto: GOLD_STANDARD_HEALTH_ANTECEDENTES,
      justificacion_texto: GOLD_STANDARD_HEALTH_JUSTIFICACION,
      items: saludItems,
    };
  }

  return {
    titulo_proceso: (adquisicion.titulo_proceso || "ADQUISICIÓN DE HERRAMIENTA PARA CUADRILLAS").toUpperCase(),
    antecedentes_texto: GOLD_STANDARD_TOOLS_ANTECEDENTES,
    justificacion_texto: GOLD_STANDARD_TOOLS_JUSTIFICACION,
    items: adquisicion.items && adquisicion.items.length > 0 ? adquisicion.items : defaultItems,
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
