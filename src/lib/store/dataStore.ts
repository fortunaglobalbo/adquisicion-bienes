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
import { INITIAL_ADQUISICIONES, createInitialFolders, INITIAL_PLANTILLAS } from "./initialData";
import { supabase, isSupabaseConfigured } from "../supabase/client";

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

  // --- SINCRONIZACIÓN CON SUPABASE ---
  static async syncWithSupabase(): Promise<void> {
    if (!this.isClient() || !isSupabaseConfigured()) return;
    try {
      // 1. Sincronizar Adquisiciones
      const { data: remoteAdqs, error: errAdq } = await supabase
        .from("adquisiciones")
        .select("*")
        .order("fecha_creacion", { ascending: false });

      if (!errAdq && remoteAdqs && remoteAdqs.length > 0) {
        const localList = this.getAdquisiciones();
        // Combinar datos locales con remotos respetando los más recientes
        const mergedMap = new Map<string, Adquisicion>();
        localList.forEach((a) => mergedMap.set(a.codigo, a));
        remoteAdqs.forEach((r: any) => {
          const existing = mergedMap.get(r.codigo);
          mergedMap.set(r.codigo, {
            id: r.id,
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
            antecedentes_texto: existing?.antecedentes_texto,
            justificacion_texto: existing?.justificacion_texto,
            items: existing?.items || [],
          });
        });
        this.saveAdquisiciones(Array.from(mergedMap.values()));
      }
    } catch (e) {
      console.warn("Error en syncWithSupabase:", e);
    }
  }

  // --- ADQUISICIONES ---
  static getAdquisiciones(): Adquisicion[] {
    if (!this.isClient()) return INITIAL_ADQUISICIONES;
    const raw = localStorage.getItem(STORAGE_KEYS.ADQUISICIONES);
    if (!raw) {
      this.saveAdquisiciones(INITIAL_ADQUISICIONES);
      return INITIAL_ADQUISICIONES;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_ADQUISICIONES;
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

    // Create 8 folders
    const initialFolders = createInitialFolders(id);
    const allCarpetas = this.getAllCarpetas();
    allCarpetas.push(...initialFolders);
    this.saveAllCarpetas(allCarpetas);

    // Initial log
    this.addLog(id, `Expediente creado con código ${newAdq.codigo}: "${newAdq.titulo_proceso}".`, newAdq.creado_por, "CREAR");

    // Guardar en Supabase en segundo plano
    if (this.isClient() && isSupabaseConfigured()) {
      supabase
        .from("adquisiciones")
        .insert([
          {
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
        ])
        .select()
        .then(({ data: created, error }) => {
          if (error) {
            console.error("Error guardando adquisición en Supabase:", error);
          } else if (created && created[0]) {
            // Guardar carpetas en Supabase
            const dbCarpetas = initialFolders.map((c) => ({
              adquisicion_id: created[0].id,
              numero: c.numero,
              nombre: c.nombre,
              tipo_generacion: c.tipo_generacion,
              estado: c.estado,
              descripcion: c.descripcion,
            }));
            supabase.from("carpetas").insert(dbCarpetas).then();
          }
        })
        .catch(console.error);
    }

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

    // Actualizar en Supabase en segundo plano
    if (this.isClient() && isSupabaseConfigured()) {
      const target = list[idx];
      const payload: any = {
        fecha_actualizacion: new Date().toISOString(),
      };
      if (updates.titulo_proceso) payload.titulo_proceso = updates.titulo_proceso;
      if (updates.categoria) payload.categoria = updates.categoria;
      if (updates.estado) payload.estado = updates.estado;
      if (updates.prevision_presupuesto !== undefined) payload.prevision_presupuesto = updates.prevision_presupuesto;
      if (updates.responsable_proceso) payload.responsable_proceso = updates.responsable_proceso;

      supabase
        .from("adquisiciones")
        .update(payload)
        .or(`id.eq.${target.id},codigo.eq.${target.codigo}`)
        .then(({ error }) => {
          if (error) console.error("Error actualizando en Supabase:", error);
        })
        .catch(console.error);
    }

    return list[idx];
  }

  static deleteAdquisicion(id: string): boolean {
    if (!this.isClient()) return false;
    const list = this.getAdquisiciones();
    const target = list.find((a) => a.id === id || a.codigo === id);
    const filtered = list.filter((a) => a.id !== id && a.codigo !== id);
    this.saveAdquisiciones(filtered);

    // Remove associated folders
    const allCarpetas = this.getAllCarpetas().filter((c) => c.adquisicion_id !== id);
    this.saveAllCarpetas(allCarpetas);

    // Eliminar en Supabase en segundo plano
    if (isSupabaseConfigured() && target) {
      supabase
        .from("adquisiciones")
        .delete()
        .or(`id.eq.${target.id},codigo.eq.${target.codigo}`)
        .then(({ error }) => {
          if (error) console.error("Error eliminando de Supabase:", error);
        })
        .catch(console.error);
    }

    return true;
  }

  // --- CARPETAS ---
  static getAllCarpetas(): Carpeta[] {
    if (!this.isClient()) return [];
    const raw = localStorage.getItem(STORAGE_KEYS.CARPETAS);
    if (!raw) {
      const initial: Carpeta[] = [];
      INITIAL_ADQUISICIONES.forEach((a) => {
        initial.push(...createInitialFolders(a.id));
      });
      this.saveAllCarpetas(initial);
      return initial;
    }
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

    // Guardar en Supabase
    if (isSupabaseConfigured()) {
      supabase
        .from("logs_proceso")
        .insert([
          {
            descripcion,
            usuario,
            accion,
          },
        ])
        .then();
    }
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

    // Guardar en Supabase
    if (this.isClient() && isSupabaseConfigured()) {
      const target = list[idx];
      supabase
        .from("plantillas")
        .update({
          contenido_plantilla: target.datos_completos || updates,
          version: target.version || "1.0",
        })
        .eq("fk_carpeta", target.fk_carpeta)
        .then(({ error }) => {
          if (error) console.error("Error actualizando plantilla en Supabase:", error);
        })
        .catch(console.error);
    }

    return list[idx];
  }
}
