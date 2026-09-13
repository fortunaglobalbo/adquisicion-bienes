import { HojaRuta, HojaRutaFormData, HojaRutaEstado } from "../types/hojaRuta";

const LOCAL_STORAGE_KEY = "ende_hojas_ruta_cache";

export class HojaRutaService {
  static getLocalCache(): HojaRuta[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  static saveLocalCache(items: HojaRuta[]) {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn("Error guardando caché local de hojas de ruta:", e);
    }
  }

  static async fetchAll(): Promise<{ success: boolean; data: HojaRuta[]; error?: string }> {
    try {
      const res = await fetch("/api/hoja-ruta", { cache: "no-store" });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        this.saveLocalCache(json.data);
        return { success: true, data: json.data };
      }
      // Si el servidor devolvió fallo, usamos caché local
      const local = this.getLocalCache();
      return { success: true, data: local, error: json.error };
    } catch (err: any) {
      const local = this.getLocalCache();
      return { success: true, data: local, error: err.message };
    }
  }

  static async getNextCorrelativo(): Promise<{ correlativo: string; fechaSugerida: string; horaSugerida: string }> {
    try {
      const res = await fetch("/api/hoja-ruta/correlativo", { cache: "no-store" });
      const json = await res.json();
      if (json.success && json.correlativo) {
        return {
          correlativo: json.correlativo,
          fechaSugerida: json.fechaSugerida,
          horaSugerida: json.horaSugerida,
        };
      }
    } catch (e) {
      console.warn("Fallo al obtener correlativo de API, generando localmente:", e);
    }

    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const datePrefix = `${day}-${month}`;
    const local = this.getLocalCache();
    const matches = local.filter((r) => r.cite_correlativo?.includes(datePrefix));
    const nextNum = matches.length + 1;

    return {
      correlativo: `ADQ - ${datePrefix}-${String(nextNum).padStart(2, "0")}`,
      fechaSugerida: now.toISOString().split("T")[0],
      horaSugerida: now.toTimeString().slice(0, 5),
    };
  }

  static async create(data: HojaRutaFormData): Promise<{ success: boolean; data?: HojaRuta; error?: string }> {
    try {
      const res = await fetch("/api/hoja-ruta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.success && json.data) {
        const current = this.getLocalCache();
        this.saveLocalCache([json.data, ...current.filter((c) => c.id !== json.data.id)]);
        return { success: true, data: json.data };
      }
      return { success: false, error: json.error || "No se pudo guardar." };
    } catch (err: any) {
      // Si falla la red, guardamos en local con UUID provisional
      const now = new Date();
      const localItem: HojaRuta = {
        id: `local-${crypto.randomUUID()}`,
        cite_correlativo: data.cite_correlativo || `ADQ-LOCAL-${Date.now()}`,
        secuencia_numero: 1,
        fecha_ingreso: data.fecha_ingreso || now.toISOString().split("T")[0],
        hora_ingreso: data.hora_ingreso || now.toTimeString().slice(0, 5),
        tipo_documento: data.tipo_documento,
        institucion_area_origen: data.institucion_area_origen,
        categoria: data.categoria,
        asunto_descripcion: data.asunto_descripcion,
        ubicacion_actual: data.ubicacion_actual,
        estado_actual: data.estado_actual,
        fecha_adjudicacion: data.estado_actual === "Adjudicado" ? now.toISOString() : null,
        enviado: true,
        pases: data.pases || [],
        fecha_creacion: now.toISOString(),
      };
      const current = this.getLocalCache();
      this.saveLocalCache([localItem, ...current]);
      return { success: true, data: localItem };
    }
  }

  static async updateStatus(
    id: string,
    estado_actual: HojaRutaEstado
  ): Promise<{ success: boolean; data?: HojaRuta; error?: string }> {
    try {
      const res = await fetch(`/api/hoja-ruta/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado_actual }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        const current = this.getLocalCache();
        this.saveLocalCache(current.map((item) => (item.id === id ? json.data : item)));
        return { success: true, data: json.data };
      }
      return { success: false, error: json.error };
    } catch (err: any) {
      const current = this.getLocalCache();
      const updated = current.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            estado_actual,
            fecha_adjudicacion: estado_actual === "Adjudicado" ? new Date().toISOString() : item.fecha_adjudicacion,
          };
        }
        return item;
      });
      this.saveLocalCache(updated);
      return { success: true };
    }
  }

  static async delete(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`/api/hoja-ruta/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        const current = this.getLocalCache();
        this.saveLocalCache(current.filter((item) => item.id !== id));
        return { success: true };
      }
      return { success: false, error: json.error };
    } catch (err: any) {
      const current = this.getLocalCache();
      this.saveLocalCache(current.filter((item) => item.id !== id));
      return { success: true };
    }
  }
}
