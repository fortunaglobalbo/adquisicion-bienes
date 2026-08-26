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
import { createInitialFolders, INITIAL_PLANTILLAS } from "./initialData";

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

  // --- CARGA DIRECTA DESDE SUPABASE POSTGRESQL ---
  static async syncWithSupabase(): Promise<void> {
    if (!this.isClient()) return;
    try {
      const res = await fetch("/api/db/sync");
      if (!res.ok) return;
      const result = await res.json();

      if (result.success) {
        // 1. Guardar Adquisiciones reales desde Supabase
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
            items: r.items || [],
          }));
          this.saveAdquisiciones(mappedAdqs);
        }

        // 2. Guardar Carpetas reales desde Supabase
        if (Array.isArray(result.carpetas) && result.carpetas.length > 0) {
          this.saveAllCarpetas(result.carpetas);
        }

        // 3. Guardar Plantillas reales desde Supabase
        if (Array.isArray(result.plantillas) && result.plantillas.length > 0) {
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

        // 4. Guardar Logs reales desde Supabase
        if (Array.isArray(result.logs)) {
          localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(result.logs));
        }
      }
    } catch (e) {
      console.error("Error en syncWithSupabase:", e);
    }
  }

  // --- ADQUISICIONES (100% PERSISTENCIA EN BASE DE DATOS) ---
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

  static createAdquisicion(data: Omit<Adquisicion, "id" | "fecha_creacion" | "fecha_actualizacion">): Adquisicion {
    const list = this.getAdquisiciones();
    const id = `acq-${Date.now()}`;
    const now = new Date().toISOString();

    const newAdq: Adquisicion = {
      ...data,
      id,
      fecha_creacion: now,
      fecha_actualizacion: now,
    };

    list.unshift(newAdq);
    this.saveAdquisiciones(list);

    // Carpetas
    const initialFolders = createInitialFolders(id);
    const allCarpetas = this.getAllCarpetas();
    allCarpetas.push(...initialFolders);
    this.saveAllCarpetas(allCarpetas);

    // Guardado DIRECTO e INMEDIATO en Supabase PostgreSQL
    if (this.isClient()) {
      fetch("/api/db/sync", {
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
      })
        .then((r) => r.json())
        .then((res) => {
          if (res.data && res.data[0]) {
            const dbAdqId = res.data[0].id;
            const dbCarpetas = initialFolders.map((c) => ({
              adquisicion_id: dbAdqId,
              numero: c.numero,
              nombre: c.nombre,
              tipo_generacion: c.tipo_generacion,
              estado: c.estado,
              descripcion: c.descripcion,
            }));
            fetch("/api/db/sync", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "INSERT",
                table: "carpetas",
                data: dbCarpetas,
              }),
            });
          }
        })
        .catch(console.error);
    }

    this.addLog(id, `Expediente creado con código ${newAdq.codigo}: "${newAdq.titulo_proceso}".`, newAdq.creado_por, "CREAR");

    return newAdq;
  }

  static updateAdquisicion(id: string, updates: Partial<Adquisicion>): Adquisicion | undefined {
    const list = this.getAdquisiciones();
    const idx = list.findIndex((a) => a.id === id || a.codigo === id);
    if (idx === -1) return undefined;

    list[idx] = {
      ...list[idx],
      ...updates,
      fecha_actualizacion: new Date().toISOString(),
    };
    this.saveAdquisiciones(list);

    // Actualización DIRECTA en Supabase PostgreSQL
    if (this.isClient()) {
      const target = list[idx];
      const payload: any = {
        fecha_actualizacion: new Date().toISOString(),
      };
      if (updates.titulo_proceso) payload.titulo_proceso = updates.titulo_proceso;
      if (updates.categoria) payload.categoria = updates.categoria;
      if (updates.estado) payload.estado = updates.estado;
      if (updates.prevision_presupuesto !== undefined) payload.prevision_presupuesto = updates.prevision_presupuesto;
      if (updates.responsable_proceso) payload.responsable_proceso = updates.responsable_proceso;

      fetch("/api/db/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE",
          table: "adquisiciones",
          id: target.codigo,
          data: payload,
        }),
      }).catch(console.error);
    }

    return list[idx];
  }

  static deleteAdquisicion(id: string): boolean {
    if (!this.isClient()) return false;
    const list = this.getAdquisiciones();
    const target = list.find((a) => a.id === id || a.codigo === id);
    const filtered = list.filter((a) => a.id !== id && a.codigo !== id);
    this.saveAdquisiciones(filtered);

    // Carpetas
    const allCarpetas = this.getAllCarpetas().filter((c) => c.adquisicion_id !== id);
    this.saveAllCarpetas(allCarpetas);

    // Eliminación DIRECTA en Supabase PostgreSQL
    if (target) {
      fetch("/api/db/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "DELETE",
          table: "adquisiciones",
          id: target.codigo,
        }),
      }).catch(console.error);
    }

    return true;
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
    let folders = all.filter((c) => c.adquisicion_id === adquisicionId);
    if (folders.length === 0) {
      folders = createInitialFolders(adquisicionId);
      all.push(...folders);
      this.saveAllCarpetas(all);
    }
    return folders.sort((a, b) => a.numero - b.numero);
  }

  static saveAllCarpetas(carpetas: Carpeta[]) {
    if (!this.isClient()) return;
    localStorage.setItem(STORAGE_KEYS.CARPETAS, JSON.stringify(carpetas));
  }

  static addDocumentToCarpeta(carpetaId: string, doc: Documento): Carpeta | undefined {
    const all = this.getAllCarpetas();
    const folder = all.find((c) => c.id === carpetaId);
    if (!folder) return undefined;

    folder.documentos.unshift(doc);
    folder.estado = "Completado";
    folder.fecha_proceso = new Date().toISOString();
    this.saveAllCarpetas(all);

    // Guardar documento en Supabase PostgreSQL
    fetch("/api/db/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "INSERT",
        table: "documentos",
        data: {
          tipo: doc.tipo,
          nombre_original: doc.nombre_original,
          mime: doc.mime,
          tamano: doc.tamano,
          estado: doc.estado,
          version: doc.version,
          creado_por: doc.creado_por,
          metadata: doc.metadata || {},
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
    if (!this.isClient()) return INITIAL_PLANTILLAS;
    const raw = localStorage.getItem(STORAGE_KEYS.PLANTILLAS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.PLANTILLAS, JSON.stringify(INITIAL_PLANTILLAS));
      return INITIAL_PLANTILLAS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_PLANTILLAS;
    }
  }

  static saveAllPlantillas(list: Plantilla[]) {
    if (!this.isClient()) return;
    localStorage.setItem(STORAGE_KEYS.PLANTILLAS, JSON.stringify(list));
  }

  static updatePlantilla(id: string, updates: Partial<Plantilla>): Plantilla | undefined {
    const list = this.getPlantillas();
    const idx = list.findIndex((p) => p.id === id);
    if (idx === -1) return undefined;
    list[idx] = { ...list[idx], ...updates };
    this.saveAllPlantillas(list);

    // Guardar en Supabase PostgreSQL
    const target = list[idx];
    fetch("/api/db/sync", {
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
    }).catch(console.error);

    return list[idx];
  }
}
