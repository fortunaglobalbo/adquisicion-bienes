"use client";

import {
  Adquisicion,
  Carpeta,
  Documento,
  CampoExtraido,
  Firma,
  LogProceso,
  Plantilla,
} from "@/types";
import { createInitialFolders } from "./initialData";

const STORAGE_KEYS = {
  ADQUISICIONES: "ende_adquisiciones_v2026",
  CARPETAS: "ende_carpetas_v2026",
  CAMPOS_EXTRAIDOS: "ende_campos_extraidos_v2026",
  LOGS: "ende_logs_v2026",
  FIRMAS: "ende_firmas_v2026",
  PLANTILLAS: "ende_plantillas_v2026",
};

export class DataStore {
  private static isClient(): boolean {
    return typeof window !== "undefined";
  }

  // --- CARGA DIRECTA DESDE SUPABASE POSTGRESQL (SIN TEMPORALES NI MOCKS) ---
  static async syncWithSupabase(): Promise<{ success: boolean; error?: string }> {
    if (!this.isClient()) return { success: false, error: "Entorno no es cliente" };
    try {
      const res = await fetch("/api/db/sync");
      const result = await res.json();

      if (!res.ok || !result.success) {
        const errorMsg = result.error || `Error HTTP ${res.status} al conectar con Supabase`;
        console.error("Fallo de conexión con base de datos:", errorMsg);
        return { success: false, error: errorMsg };
      }

      // 1. Cargar Adquisiciones reales desde Supabase
      if (Array.isArray(result.adquisiciones)) {
        const mappedAdqs: Adquisicion[] = result.adquisiciones.map((r: any) => ({
          id: r.id || `acq-${r.codigo}`,
          codigo: r.codigo,
          titulo_proceso: r.titulo_proceso,
          categoria: r.categoria,
          modalidad: r.modalidad,
          partida_presupuestaria: r.partida_presupuestaria || "39500",
          estado: r.estado,
          prevision_presupuesto: Number(r.prevision_presupuesto) || 0,
          moneda: r.moneda || "BOB",
          fecha_inicio: r.fecha_inicio || new Date().toISOString().split("T")[0],
          fecha_limite: r.fecha_limite,
          unidad_solicitante: r.unidad_solicitante || "Departamento Técnico de Mantenimiento",
          responsable_proceso: r.responsable_proceso,
          creado_por: r.creado_por || "admin@ende-deoruro.bo",
          fecha_creacion: r.fecha_creacion,
          fecha_actualizacion: r.fecha_actualizacion,
          antecedentes_texto: r.antecedentes_texto,
          justificacion_texto: r.justificacion_texto,
          plazo_entrega_dias: r.plazo_entrega_dias || 30,
          multa_diaria_porcentaje: r.multa_diaria_porcentaje || 0.25,
          lugar_entrega: r.lugar_entrega || "Almacén Central ENDE DEORURO S.A., Oruro - Bolivia",
          items: Array.isArray(r.items)
            ? r.items
            : typeof r.items === "string"
            ? (() => {
                try {
                  const parsed = JSON.parse(r.items);
                  return Array.isArray(parsed) ? parsed : [];
                } catch {
                  return [];
                }
              })()
            : [],
        }));
        this.saveAdquisiciones(mappedAdqs);
      }

      // 2. Cargar Carpetas y Documentos reales desde Supabase
      if (Array.isArray(result.carpetas)) {
        const allDocs = Array.isArray(result.documentos) ? result.documentos : [];
        const mappedCarpetas = result.carpetas.map((c: any) => ({
          ...c,
          documentos: allDocs.filter(
            (d: any) =>
              d.carpeta_id === c.id ||
              (d.adquisicion_id === c.adquisicion_id && d.metadata?.carpeta_numero === c.numero)
          ),
        }));
        this.saveAllCarpetas(mappedCarpetas);
      }

      // 3. Cargar Plantillas reales desde Supabase
      if (Array.isArray(result.plantillas)) {
        const mappedPlantillas: Plantilla[] = result.plantillas.map((p: any) => ({
          id: p.id || `tpl-${p.fk_carpeta}`,
          fk_carpeta: p.fk_carpeta,
          nombre: p.nombre,
          descripcion: p.descripcion,
          version: p.version || "1.0",
          campos_configurables: p.contenido_plantilla?.campos_configurables || [],
          secciones_fijas: p.contenido_plantilla?.secciones_fijas || [],
          datos_completos: p.contenido_plantilla || {},
        }));
        this.saveAllPlantillas(mappedPlantillas);
      }

      // 4. Cargar Logs reales desde Supabase
      if (Array.isArray(result.logs)) {
        localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(result.logs));
      }

      return { success: true };
    } catch (e: any) {
      const msg = e?.message || "No se pudo conectar con el servidor de base de datos Supabase";
      console.error("Error en syncWithSupabase:", msg);
      return { success: false, error: msg };
    }
  }

  // --- ADQUISICIONES REALES ---
  static getAdquisiciones(): Adquisicion[] {
    if (!this.isClient()) return [];
    const raw = localStorage.getItem(STORAGE_KEYS.ADQUISICIONES);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  static getAdquisicionById(id: string): Adquisicion | undefined {
    const list = this.getAdquisiciones();
    return list.find((a) => a.id === id || a.codigo === id);
  }

  static saveAdquisiciones(list: Adquisicion[]) {
    if (!this.isClient()) return;
    localStorage.setItem(STORAGE_KEYS.ADQUISICIONES, JSON.stringify(list));
  }

  static async createAdquisicion(data: Omit<Adquisicion, "id" | "fecha_creacion" | "fecha_actualizacion">): Promise<{ success: boolean; data?: Adquisicion; error?: string }> {
    const list = this.getAdquisiciones();
    const id = `acq-${Date.now()}`;
    const now = new Date().toISOString();

    const newAdq: Adquisicion = {
      ...data,
      id,
      fecha_creacion: now,
      fecha_actualizacion: now,
    };

    // Carpetas
    const initialFolders = createInitialFolders(id);

    try {
      const res = await fetch("/api/db/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "INSERT",
          table: "adquisiciones",
          data: {
            codigo: newAdq.codigo,
            titulo_proceso: newAdq.titulo_proceso,
            categoria: newAdq.categoria || "Bienes",
            modalidad: newAdq.modalidad,
            partida_presupuestaria: newAdq.partida_presupuestaria,
            estado: newAdq.estado,
            prevision_presupuesto: newAdq.prevision_presupuesto,
            moneda: newAdq.moneda || "BOB",
            unidad_solicitante: newAdq.unidad_solicitante,
            responsable_proceso: newAdq.responsable_proceso,
            creado_por: newAdq.creado_por,
          },
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || "Error al insertar adquisición en Supabase" };
      }

      if (json.data && json.data[0]) {
        newAdq.id = json.data[0].id;
        const dbCarpetas = initialFolders.map((c) => ({
          adquisicion_id: json.data[0].id,
          numero: c.numero,
          nombre: c.nombre,
          tipo_generacion: c.tipo_generacion,
          estado: c.estado,
          descripcion: c.descripcion,
        }));
        await fetch("/api/db/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "INSERT",
            table: "carpetas",
            data: dbCarpetas,
          }),
        });
      }

      list.unshift(newAdq);
      this.saveAdquisiciones(list);

      const allCarpetas = this.getAllCarpetas();
      allCarpetas.push(...initialFolders);
      this.saveAllCarpetas(allCarpetas);

      this.addLog(newAdq.id, `Expediente creado en base de datos con código ${newAdq.codigo}: "${newAdq.titulo_proceso}".`, newAdq.creado_por, "CREAR");

      return { success: true, data: newAdq };
    } catch (e: any) {
      return { success: false, error: e?.message || "Error al comunicarse con Supabase" };
    }
  }

  static async updateAdquisicion(id: string, updates: Partial<Adquisicion>): Promise<{ success: boolean; error?: string }> {
    const list = this.getAdquisiciones();
    const idx = list.findIndex((a) => a.id === id || a.codigo === id);
    if (idx === -1) return { success: false, error: "Expediente no encontrado" };

    const target = list[idx];
    const payload: any = {
      fecha_actualizacion: new Date().toISOString(),
    };
    if (updates.titulo_proceso) payload.titulo_proceso = updates.titulo_proceso;
    if (updates.categoria) payload.categoria = updates.categoria;
    if (updates.estado) payload.estado = updates.estado;
    if (updates.prevision_presupuesto !== undefined) payload.prevision_presupuesto = updates.prevision_presupuesto;
    if (updates.responsable_proceso) payload.responsable_proceso = updates.responsable_proceso;

    try {
      const res = await fetch("/api/db/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE",
          table: "adquisiciones",
          id: target.codigo,
          data: payload,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || "Error al actualizar en Supabase" };
      }

      list[idx] = { ...list[idx], ...updates, fecha_actualizacion: payload.fecha_actualizacion };
      this.saveAdquisiciones(list);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || "Error de red al actualizar en Supabase" };
    }
  }

  static async deleteAdquisicion(id: string): Promise<{ success: boolean; error?: string }> {
    const list = this.getAdquisiciones();
    const target = list.find((a) => a.id === id || a.codigo === id);
    if (!target) return { success: false, error: "Expediente no encontrado" };

    try {
      const res = await fetch("/api/db/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "DELETE",
          table: "adquisiciones",
          id: target.codigo,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || "Error al eliminar en Supabase" };
      }

      const filtered = list.filter((a) => a.id !== id && a.codigo !== id);
      this.saveAdquisiciones(filtered);

      const allCarpetas = this.getAllCarpetas().filter((c) => c.adquisicion_id !== id && c.adquisicion_id !== target.id);
      this.saveAllCarpetas(allCarpetas);

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || "Error de red al eliminar en Supabase" };
    }
  }

  // --- CARPETAS ---
  static getAllCarpetas(): Carpeta[] {
    if (!this.isClient()) return [];
    const raw = localStorage.getItem(STORAGE_KEYS.CARPETAS);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  static getCarpetasByAdquisicion(adquisicionId: string): Carpeta[] {
    const all = this.getAllCarpetas();
    let adqFolders = all.filter((c) => c.adquisicion_id === adquisicionId).sort((a, b) => a.numero - b.numero);

    if (adqFolders.length === 0) {
      const initial = createInitialFolders(adquisicionId);
      all.push(...initial);
      this.saveAllCarpetas(all);
      adqFolders = initial;
    }

    // Sincronizar automáticamente con las plantillas globales para que aplique a todos los expedientes
    const plantillas = this.getPlantillas();
    let updatedAny = false;
    adqFolders.forEach((folder) => {
      const tpl = plantillas.find((p) => p.fk_carpeta === folder.numero);
      if (tpl && tpl.nombre_archivo && folder.plantilla_asociada_nombre !== tpl.nombre_archivo) {
        folder.plantilla_asociada_nombre = tpl.nombre_archivo;
        folder.plantilla_asociada_url = tpl.ruta_archivo || folder.plantilla_asociada_url;
        updatedAny = true;
      }
    });

    if (updatedAny) {
      this.saveAllCarpetas(all);
    }

    return adqFolders;
  }

  // Asignar plantilla globalmente para TODOS los expedientes
  static setGlobalPlantillaForCarpeta(numeroCarpeta: number, data: { nombre_archivo: string; ruta_archivo?: string; descripcion?: string }) {
    const plantillas = this.getPlantillas();
    const existing = plantillas.find((p) => p.fk_carpeta === numeroCarpeta);
    if (existing) {
      existing.nombre_archivo = data.nombre_archivo;
      existing.ruta_archivo = data.ruta_archivo || existing.ruta_archivo;
      if (data.descripcion) existing.descripcion = data.descripcion;
      this.saveAllPlantillas(plantillas);
    }

    // Actualizar todas las carpetas de todos los expedientes
    const allCarpetas = this.getAllCarpetas();
    allCarpetas.forEach((c) => {
      if (c.numero === numeroCarpeta) {
        c.plantilla_asociada_nombre = data.nombre_archivo;
        if (data.ruta_archivo) c.plantilla_asociada_url = data.ruta_archivo;
        if (data.descripcion) c.descripcion = data.descripcion;
      }
    });
    this.saveAllCarpetas(allCarpetas);
  }

  static saveAllCarpetas(carpetas: Carpeta[]) {
    if (!this.isClient()) return;
    localStorage.setItem(STORAGE_KEYS.CARPETAS, JSON.stringify(carpetas));
  }

  static addCarpeta(adquisicionId: string, nombre: string, descripcion?: string): Carpeta {
    const all = this.getAllCarpetas();
    const current = all.filter((c) => c.adquisicion_id === adquisicionId).sort((a, b) => a.numero - b.numero);
    const nextNum = current.length > 0 ? Math.max(...current.map((c) => c.numero)) + 1 : 1;

    const newFolder: Carpeta = {
      id: `folder-custom-${Date.now()}`,
      adquisicion_id: adquisicionId,
      numero: nextNum,
      nombre: nombre.trim() || `Carpeta ${nextNum}`,
      descripcion: descripcion?.trim() || "Carpeta personalizada para el expediente",
      tipo_generacion: "IA",
      estado: "Pendiente",
      documentos: [],
      orden: nextNum,
    };

    all.push(newFolder);
    this.saveAllCarpetas(all);
    return newFolder;
  }

  static deleteCarpeta(carpetaId: string): boolean {
    const all = this.getAllCarpetas();
    const target = all.find((c) => c.id === carpetaId);
    if (!target) return false;

    const adqId = target.adquisicion_id;
    const remaining = all.filter((c) => c.id !== carpetaId);

    // Renumerar las carpetas de esta adquisicion
    let count = 1;
    remaining
      .filter((c) => c.adquisicion_id === adqId)
      .sort((a, b) => a.numero - b.numero)
      .forEach((c) => {
        c.numero = count++;
        c.orden = c.numero;
      });

    this.saveAllCarpetas(remaining);
    return true;
  }

  static updateCarpeta(carpetaId: string, updates: Partial<Carpeta>): Carpeta | null {
    const all = this.getAllCarpetas();
    const target = all.find((c) => c.id === carpetaId);
    if (!target) return null;

    Object.assign(target, updates);
    this.saveAllCarpetas(all);
    return target;
  }

  static moveCarpetaUp(adquisicionId: string, carpetaId: string): Carpeta[] {
    const all = this.getAllCarpetas();
    const adqFolders = all.filter((c) => c.adquisicion_id === adquisicionId).sort((a, b) => a.numero - b.numero);
    const idx = adqFolders.findIndex((c) => c.id === carpetaId);

    if (idx > 0) {
      const temp = adqFolders[idx];
      adqFolders[idx] = adqFolders[idx - 1];
      adqFolders[idx - 1] = temp;

      // Reasignar numeros secuenciales
      adqFolders.forEach((c, i) => {
        c.numero = i + 1;
        c.orden = i + 1;
      });

      this.saveAllCarpetas(all);
    }
    return adqFolders;
  }

  static moveCarpetaDown(adquisicionId: string, carpetaId: string): Carpeta[] {
    const all = this.getAllCarpetas();
    const adqFolders = all.filter((c) => c.adquisicion_id === adquisicionId).sort((a, b) => a.numero - b.numero);
    const idx = adqFolders.findIndex((c) => c.id === carpetaId);

    if (idx >= 0 && idx < adqFolders.length - 1) {
      const temp = adqFolders[idx];
      adqFolders[idx] = adqFolders[idx + 1];
      adqFolders[idx + 1] = temp;

      // Reasignar numeros secuenciales
      adqFolders.forEach((c, i) => {
        c.numero = i + 1;
        c.orden = i + 1;
      });

      this.saveAllCarpetas(all);
    }
    return adqFolders;
  }

  static async addDocumentToCarpeta(carpetaId: string, doc: Documento): Promise<Carpeta | undefined> {
    const all = this.getAllCarpetas();
    const folder = all.find((c) => c.id === carpetaId);
    if (!folder) return undefined;

    folder.documentos.unshift(doc);
    folder.estado = "Completado";
    folder.fecha_proceso = new Date().toISOString();
    this.saveAllCarpetas(all);

    // Guardar en Supabase
    fetch("/api/db/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "INSERT",
        table: "documentos",
        data: {
          adquisicion_id: doc.adquisicion_id,
          carpeta_id: folder.id,
          tipo: doc.tipo || "GENERADO_DOCX",
          nombre_original: doc.nombre_original,
          mime: doc.mime || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          tamano: doc.tamano || 48000,
          estado: doc.estado || "Borrador",
          version: doc.version || 1,
          creado_por: doc.creado_por || "admin@ende-deoruro.bo",
          metadata: {
            ...(doc.metadata || {}),
            carpeta_numero: folder.numero,
          },
        },
      }),
    }).catch(console.error);

    this.addLog(
      doc.adquisicion_id,
      `Nuevo documento "${doc.nombre_original}" agregado a Carpeta ${folder.numero} (${folder.nombre}).`,
      doc.creado_por,
      doc.tipo === "GENERADO_DOCX" ? "GENERAR_IA" : "SUBIR"
    );

    return folder;
  }

  // --- CAMPOS EXTRAÍDOS (OCR) ---
  static getCamposExtraidos(adquisicionId: string): CampoExtraido[] {
    if (!this.isClient()) return [];
    const raw = localStorage.getItem(STORAGE_KEYS.CAMPOS_EXTRAIDOS);
    if (!raw) return [];
    try {
      const all: CampoExtraido[] = JSON.parse(raw);
      return all.filter((c) => c.adquisicion_id === adquisicionId);
    } catch {
      return [];
    }
  }

  static saveCamposExtraidos(adquisicionId: string, nuevosCampos: CampoExtraido[]) {
    if (!this.isClient()) return;
    const raw = localStorage.getItem(STORAGE_KEYS.CAMPOS_EXTRAIDOS);
    let all: CampoExtraido[] = raw ? JSON.parse(raw) : [];
    const keys = new Set(nuevosCampos.map((c) => c.clave));
    all = all.filter((c) => !(c.adquisicion_id === adquisicionId && keys.has(c.clave)));
    all.push(...nuevosCampos);
    localStorage.setItem(STORAGE_KEYS.CAMPOS_EXTRAIDOS, JSON.stringify(all));
  }

  // --- FIRMAS ---
  static getFirmas(adquisicionId: string): Firma[] {
    if (!this.isClient()) return [];
    const raw = localStorage.getItem(STORAGE_KEYS.FIRMAS);
    if (!raw) return [];
    try {
      const all: Firma[] = JSON.parse(raw);
      return all.filter((f) => f.adquisicion_id === adquisicionId).sort((a, b) => a.orden - b.orden);
    } catch {
      return [];
    }
  }

  static saveFirmasForAdquisicion(adquisicionId: string, firmas: Firma[]) {
    if (!this.isClient()) return;
    const raw = localStorage.getItem(STORAGE_KEYS.FIRMAS);
    let all: Firma[] = raw ? JSON.parse(raw) : [];
    all = all.filter((f) => f.adquisicion_id !== adquisicionId);
    all.push(...firmas);
    localStorage.setItem(STORAGE_KEYS.FIRMAS, JSON.stringify(all));
  }

  static signFirma(firmaId: string, usuario: string): boolean {
    if (!this.isClient()) return false;
    const raw = localStorage.getItem(STORAGE_KEYS.FIRMAS);
    if (!raw) return false;
    const all: Firma[] = JSON.parse(raw);
    const item = all.find((f) => f.id === firmaId);
    if (!item) return false;

    item.firmado = true;
    item.fecha_firma = new Date().toISOString();
    localStorage.setItem(STORAGE_KEYS.FIRMAS, JSON.stringify(all));

    this.addLog(item.adquisicion_id, `Firma digital registrada por ${item.cargo} (${item.nombre}).`, usuario, "FIRMAR");
    return true;
  }

  // --- LOGS / AUDITORÍA ---
  static getLogs(adquisicionId?: string): LogProceso[] {
    if (!this.isClient()) return [];
    const raw = localStorage.getItem(STORAGE_KEYS.LOGS);
    if (!raw) return [];
    try {
      const all: LogProceso[] = JSON.parse(raw);
      if (adquisicionId) {
        return all.filter((l) => l.adquisicion_id === adquisicionId).sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
      }
      return all.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    } catch {
      return [];
    }
  }

  static addLog(adquisicionId: string, descripcion: string, usuario = "Sistema ENDE", accion: LogProceso["accion"] = "MODIFICAR") {
    if (!this.isClient()) return;
    const raw = localStorage.getItem(STORAGE_KEYS.LOGS);
    const all: LogProceso[] = raw ? JSON.parse(raw) : [];
    const newLog: LogProceso = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      adquisicion_id: adquisicionId,
      fecha: new Date().toISOString(),
      descripcion,
      usuario,
      accion,
    };
    all.unshift(newLog);
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(all));

    // Guardar en Supabase PostgreSQL
    fetch("/api/db/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "INSERT",
        table: "logs_proceso",
        data: {
          descripcion,
          usuario,
          accion,
        },
      }),
    }).catch(console.error);
  }

  // --- PLANTILLAS ---
  static getPlantillas(): Plantilla[] {
    if (!this.isClient()) return [];
    const raw = localStorage.getItem(STORAGE_KEYS.PLANTILLAS);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  static saveAllPlantillas(list: Plantilla[]) {
    if (!this.isClient()) return;
    localStorage.setItem(STORAGE_KEYS.PLANTILLAS, JSON.stringify(list));
  }

  static async updatePlantilla(id: string, updates: Partial<Plantilla>): Promise<{ success: boolean; error?: string }> {
    const list = this.getPlantillas();
    const idx = list.findIndex((p) => p.id === id);
    if (idx === -1) return { success: false, error: "Plantilla no encontrada" };

    const target = list[idx];
    try {
      const res = await fetch("/api/db/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE",
          table: "plantillas",
          filter: { column: "fk_carpeta", value: target.fk_carpeta },
          data: {
            contenido_plantilla: target.datos_completos || updates,
            version: target.version || "1.0",
          },
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || "Error al actualizar plantilla en Supabase" };
      }

      list[idx] = { ...list[idx], ...updates };
      this.saveAllPlantillas(list);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || "Error de red al actualizar plantilla" };
    }
  }
}
