/**
 * Cliente para la API de AnythingLLM
 * Permite interactuar con la base de conocimiento vectorial y RAG en el VPS
 */

const BASE_URL = process.env.ANYTHINGLLM_BASE_URL || "http://85.31.230.163:3005/api/v1";
const API_KEY = process.env.ANYTHINGLLM_API_KEY || "JWYTE8H-YWDMXF0-JXZFSES-MR6B8DK";
const DEFAULT_WORKSPACE = process.env.ANYTHINGLLM_WORKSPACE || "adquisiciones-ende";

export interface AnythingWorkspace {
  id: number;
  name: string;
  slug: string;
  createdAt: string;
}

export interface AnythingChatMessage {
  message: string;
  mode?: "query" | "chat";
  userId?: number;
}

export interface ExtractedAcquisitionData {
  objeto_contratacion?: string;
  antecedentes?: string;
  justificacion?: string;
  lugar_entrega?: string;
  plazo_entrega?: string;
  forma_adjudicacion?: string;
  forma_pago?: string;
  garantia?: string;
  multas?: string;
  items?: Array<{
    item_nro: number;
    descripcion: string;
    unidad: string;
    cantidad: number;
    precio_unitario?: number;
    precio_total?: number;
    especificaciones?: string;
  }>;
  firmas?: {
    elaborado_por?: string;
    revisado_por?: string;
    aprobado_por?: string;
  };
}

export class AnythingLlmClient {
  private static getHeaders() {
    return {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * Verifica la autenticación con AnythingLLM
   */
  static async checkAuth(): Promise<boolean> {
    try {
      const res = await fetch(`${BASE_URL}/auth`, {
        headers: this.getHeaders(),
      });
      if (!res.ok) return false;
      const data = await res.json();
      return Boolean(data.authenticated);
    } catch (e) {
      console.error("Error al autenticar con AnythingLLM:", e);
      return false;
    }
  }

  /**
   * Obtiene la lista de workspaces disponibles
   */
  static async getWorkspaces(): Promise<AnythingWorkspace[]> {
    try {
      const res = await fetch(`${BASE_URL}/workspaces`, {
        headers: this.getHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
      const data = await res.json();
      return data.workspaces || [];
    } catch (e) {
      console.error("Error al obtener workspaces de AnythingLLM:", e);
      return [];
    }
  }

  /**
   * Envía una consulta o prompt al espacio de trabajo (RAG)
   */
  static async queryWorkspace(
    prompt: string,
    workspaceSlug: string = DEFAULT_WORKSPACE,
    mode: "query" | "chat" = "query"
  ): Promise<string> {
    const res = await fetch(`${BASE_URL}/workspace/${workspaceSlug}/chat`, {
      method: "POST",
      headers: this.getHeaders(),
      body: jsonStringifySafe({
        message: prompt,
        mode: mode,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Error AnythingLLM (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return data.textResponse || "";
  }

  /**
   * Extrae los datos clave estructurados para autollenar cualquier TDR o plantilla DOCX
   */
  static async extractAcquisitionJson(
    workspaceSlug: string = DEFAULT_WORKSPACE
  ): Promise<ExtractedAcquisitionData> {
    const extractionPrompt = `Actúa como especialista de contrataciones de ENDE DEORURO S.A.
Analiza exhaustivamente todos los documentos PDF cargados en este espacio de trabajo (solicitudes, especificaciones, cotizaciones, cuadros).
Extrae la información requerida y DEVUELVE ÚNICAMENTE UN OBJETO JSON VÁLIDO (sin bloques de markdown ni texto adicional), siguiendo exactamente este esquema:

{
  "objeto_contratacion": "Título o descripción formal de lo que se adquiere",
  "antecedentes": "Párrafo formal de antecedentes institucionales (5-8 líneas)",
  "justificacion": "Párrafo formal de justificación técnica y necesidad operativa",
  "lugar_entrega": "Almacenes ENDE DEORURO S.A.",
  "plazo_entrega": "Ej. Máximo 45 días calendario...",
  "forma_adjudicacion": "Por ítem requerido (Menor Precio)",
  "forma_pago": "Contra entrega satisfactoria del producto y recepción de factura...",
  "garantia": "Mínima de 12 meses contra defectos de fabricación...",
  "multas": "0.25% por día de retraso conforme a reglamento...",
  "items": [
    {
      "item_nro": 1,
      "descripcion": "Nombre del ítem",
      "unidad": "PZA / JGO / ROLLO",
      "cantidad": 1,
      "precio_unitario": 0.0,
      "precio_total": 0.0,
      "especificaciones": "Características técnicas, normas ASTM/IEC y dimensiones"
    }
  ],
  "firmas": {
    "elaborado_por": "Nombre y cargo si figura en los documentos",
    "revisado_por": "Nombre y cargo",
    "aprobado_por": "Nombre y cargo"
  }
}`;

    const rawResponse = await this.queryWorkspace(extractionPrompt, workspaceSlug, "query");
    
    try {
      // Limpiar posibles bloques ```json ... ```
      const cleaned = rawResponse.replace(/```json/gi, "").replace(/```/g, "").trim();
      return JSON.parse(cleaned);
    } catch (err) {
      console.warn("Respuesta no parseable como JSON directo, intentando regex:", err);
      const match = rawResponse.match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(match[0]);
      }
      throw new Error(`No se pudo obtener JSON estructurado de AnythingLLM: ${rawResponse}`);
    }
  }
}

function jsonStringifySafe(obj: any): string {
  return JSON.stringify(obj);
}
