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

    // Initialize Default Signatures
    this.saveFirmasForAdquisicion(id, [
      {
        id: `sig-1-${id}`,
        adquisicion_id: id,
        cargo: "Responsable de Unidad Solicitante",
        nombre: newAdq.responsable_proceso || "Ing. Encargado",
        rol: "Solicitante",
        orden: 1,
        firmado: false,
      },
      {
        id: `sig-2-${id}`,
        adquisicion_id: id,
        cargo: "Supervisor de Adquisiciones",
        nombre: "Lic. Supervisor de Contrataciones",
        rol: "Supervisor",
        orden: 2,
        firmado: false,
      },
      {
        id: `sig-3-${id}`,
        adquisicion_id: id,
        cargo: "Gerente Administrativo y Financiero",
        nombre: "Ing. Gerente de Área",
        rol: "Gerente",
        orden: 3,
        firmado: false,
      },
    ]);

    return newAdq;
  }

  static updateAdquisicion(id: string, updates: Partial<Adquisicion>): Adquisicion | undefined {
    const list = this.getAdquisiciones();
    const idx = list.findIndex((a) => a.id === id);
    if (idx === -1) return undefined;

    list[idx] = {
      ...list[idx],
      ...updates,
      fecha_actualizacion: new Date().toISOString(),
    };
    this.saveAdquisiciones(list);
    return list[idx];
  }

  static deleteAdquisicion(id: string): boolean {
    if (!this.isClient()) return false;
    const list = this.getAdquisiciones();
    const filtered = list.filter((a) => a.id !== id);
    this.saveAdquisiciones(filtered);

    // Remove associated folders
    const allCarpetas = this.getAllCarpetas().filter((c) => c.adquisicion_id !== id);
    this.saveAllCarpetas(allCarpetas);

    // Remove associated firmas
    const rawFirmas = localStorage.getItem(STORAGE_KEYS.FIRMAS);
    if (rawFirmas) {
      try {
        const allFirmas: Firma[] = JSON.parse(rawFirmas);
        localStorage.setItem(STORAGE_KEYS.FIRMAS, JSON.stringify(allFirmas.filter((f) => f.adquisicion_id !== id)));
      } catch {}
    }

    // Remove associated OCR extractions
    const rawCampos = localStorage.getItem(STORAGE_KEYS.CAMPOS_EXTRAIDOS);
    if (rawCampos) {
      try {
        const allCampos: CampoExtraido[] = JSON.parse(rawCampos);
        localStorage.setItem(STORAGE_KEYS.CAMPOS_EXTRAIDOS, JSON.stringify(allCampos.filter((c) => c.adquisicion_id !== id)));
      } catch {}
    }

    // Remove associated logs
    const rawLogs = localStorage.getItem(STORAGE_KEYS.LOGS);
    if (rawLogs) {
      try {
        const allLogs: LogProceso[] = JSON.parse(rawLogs);
        localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(allLogs.filter((l) => l.adquisicion_id !== id)));
      } catch {}
    }

    return true;
  }

  // --- CARPETAS ---
  static getAllCarpetas(): Carpeta[] {
    if (!this.isClient()) return [];
    const raw = localStorage.getItem(STORAGE_KEYS.CARPETAS);
    if (!raw) {
      // populate for default acquisitions
      const initial: Carpeta[] = [];
      INITIAL_ADQUISICIONES.forEach((a) => {
        initial.push(...createInitialFolders(a.id));
      });
      // add a mock document to folder 1 of acq-1
      const f1 = initial.find((c) => c.adquisicion_id === "acq-1" && c.numero === 1);
      if (f1) {
        f1.estado = "Completado";
        f1.documentos = [
          {
            id: "doc-init-tdr",
            carpeta_id: f1.id,
            adquisicion_id: "acq-1",
            tipo: "GENERADO_DOCX",
            nombre_original: "TDR_Herramientas_Mantenimiento_v1.docx",
            mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            tamano: 45200,
            estado: "Borrador",
            version: 1,
            creado_por: "Sistema IA (OpenCode Go)",
            fecha_creacion: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
            metadata: {
              idDoc: "DOC-TDR-001-A",
              generadoPorIA: true,
            },
          },
        ];
      }
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
    // remove previous with same key for this adq
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
    return list[idx];
  }
}
