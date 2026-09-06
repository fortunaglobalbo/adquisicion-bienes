"use client";

import { Adquisicion, Carpeta, Documento, CampoExtraido, Firma, LogProceso, Plantilla } from "@/types";
import { createInitialFolders, FOLDER_TEMPLATES } from "./initialData";

const KEYS = { adq: "ende_adquisiciones_v2026", folders: "ende_carpetas_v2026", fields: "ende_campos_extraidos_v2026", logs: "ende_logs_v2026", signs: "ende_firmas_v2026", templates: "ende_plantillas_v2026", pending: "ende_pending_v1", revisions: "ende_revisions_v1", templatePending: "ende_templates_pending_v1" };
type Result = { success: boolean; error?: string };
type Snapshot = { adquisicion: Adquisicion; carpetas: Carpeta[]; campos: CampoExtraido[]; firmas: Firma[]; logs: LogProceso[] };

export class DataStore {
  private static flushing: Promise<Result> | null = null;
  private static hydrating = false;
  private static read<T>(key: string, fallback: T): T {
    if (typeof window === "undefined") return fallback;
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
  }
  private static write(key: string, value: unknown) {
    if (typeof window === "undefined") return;
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch { throw new Error("No queda espacio de almacenamiento en este navegador. Exporta un respaldo antes de continuar."); }
  }
  private static async request(body?: unknown) {
    const res = await fetch("/api/db/sync", { method: body ? "POST" : "GET", headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined, cache: "no-store", signal: AbortSignal.timeout(60000) });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || "No se pudo sincronizar con la nube.");
    return json;
  }
  static pendingCount() { return Object.keys(this.read(KEYS.pending, {})).length + Object.keys(this.read(KEYS.templatePending, {})).length; }
  private static changed(id: string) {
    if (this.hydrating || !this.getAdquisicionById(id)) return;
    const pending = this.read<Record<string, string>>(KEYS.pending, {});
    pending[id] = crypto.randomUUID();
    this.write(KEYS.pending, pending);
    window.dispatchEvent(new Event("ende-sync-status"));
    void this.flushPending();
  }
  private static snapshot(id: string): Snapshot {
    return { adquisicion: this.getAdquisicionById(id)!, carpetas: this.getAllCarpetas().filter(c => c.adquisicion_id === id),
      campos: this.getCamposExtraidos(id), firmas: this.getFirmas(id), logs: this.getLogs(id) };
  }
  static async flushPending(): Promise<Result> {
    if (typeof window === "undefined") return { success: false };
    if (this.flushing) return this.flushing;
    const work = async (): Promise<Result> => {
      try {
        while (true) {
          const pending = this.read<Record<string, string>>(KEYS.pending, {});
          const id = Object.keys(pending)[0];
          if (!id) break;
          const token = pending[id];
          const revisions = this.read<Record<string, string>>(KEYS.revisions, {});
          const result = await this.request({ action: "SAVE_EXPEDIENTE", data: this.snapshot(id), revision: revisions[id] });
          this.write(KEYS.revisions, { ...this.read(KEYS.revisions, {}), [id]: result.revision });
          const current = this.read<Record<string, string>>(KEYS.pending, {});
          if (current[id] === token) delete current[id];
          this.write(KEYS.pending, current);
        }
        const pendingTemplates = this.read<Record<string, Plantilla>>(KEYS.templatePending, {});
        for (const [key, template] of Object.entries(pendingTemplates)) {
          await this.request({ action: "SAVE_PLANTILLA", data: template });
          const current = this.read<Record<string, Plantilla>>(KEYS.templatePending, {});
          if (JSON.stringify(current[key]) === JSON.stringify(template)) delete current[key];
          this.write(KEYS.templatePending, current);
        }
        window.dispatchEvent(new CustomEvent("ende-sync-status", { detail: { success: true } }));
        return { success: true };
      } catch (e) {
        const error = e instanceof Error ? e.message : "Conexión interrumpida; cambios guardados en este navegador.";
        window.dispatchEvent(new CustomEvent("ende-sync-status", { detail: { error } }));
        return { success: false, error };
      }
    };
    // Serializes background writes across tabs sharing the local queue.
    const running = Promise.resolve(navigator.locks ? navigator.locks.request("ende-sync", work) : work()).then(result => result);
    this.flushing = running.finally(() => { this.flushing = null; });
    return this.flushing;
  }
  static async syncWithSupabase(): Promise<Result> {
    try {
      const flushed = await this.flushPending();
      if (!flushed.success) return flushed;
      const revisionsBeforeRead = this.read<Record<string, string>>(KEYS.revisions, {});
      const result = await this.request();
      // Never replace edits made while the read request was in flight.
      const pending = this.read<Record<string, string>>(KEYS.pending, {});
      const localAdqs = this.getAdquisiciones();
      const localFolders = this.getAllCarpetas();
      const revisions = this.read<Record<string, string>>(KEYS.revisions, {});
      const snapshots: Snapshot[] = result.adquisiciones.map((row: Adquisicion) => {
        if (pending[row.id] || revisions[row.id] !== revisionsBeforeRead[row.id]) return this.snapshot(row.id);
        const state = result.states.find((s: any) => s.snapshot?.adquisicion?.id === row.id);
        if (state) { revisions[row.id] = state.revision; return state.snapshot; }
        // Preserve extended legacy browser fields on first migration.
        const local = localAdqs.find(a => a.id === row.id);
        const folders = result.carpetas.filter((c: Carpeta) => c.adquisicion_id === row.id).map((c: Carpeta) => {
          const previous = localFolders.find(f => f.adquisicion_id === row.id && f.numero === c.numero);
          const docs = [...(previous?.documentos || []), ...result.documentos.filter((d: Documento) => d.carpeta_id === c.id)];
          return { ...previous, ...c, documentos: Array.from(new Map(docs.map(d => [d.id, d])).values()) };
        });
        return { adquisicion: { ...local, ...row, items: local?.items || row.items || [], plazo_entrega_dias: local?.plazo_entrega_dias ?? 30, multa_diaria_porcentaje: local?.multa_diaria_porcentaje ?? 0.25, lugar_entrega: local?.lugar_entrega || "Almacenes ENDE DEORURO S.A., Oruro" },
          carpetas: folders, campos: this.getCamposExtraidos(row.id), firmas: this.getFirmas(row.id), logs: [...this.getLogs(row.id), ...result.logs.filter((l: LogProceso) => l.adquisicion_id === row.id)] };
      });
      // Pending records must survive even when absent from the response.
      for (const id of Object.keys(pending)) if (!snapshots.some(s => s.adquisicion.id === id)) snapshots.push(this.snapshot(id));
      this.hydrating = true;
      this.write(KEYS.adq, snapshots.map(s => s.adquisicion));
      this.write(KEYS.folders, snapshots.flatMap(s => s.carpetas));
      this.write(KEYS.fields, snapshots.flatMap(s => s.campos || []));
      this.write(KEYS.signs, snapshots.flatMap(s => s.firmas || []));
      this.write(KEYS.logs, Array.from(new Map(snapshots.flatMap(s => s.logs || []).map(l => [l.id, l])).values()));
      this.write(KEYS.revisions, revisions);
      const templatePending = this.read<Record<string, Plantilla>>(KEYS.templatePending, {});
      this.write(KEYS.templates, result.plantillas.map((p: any) => templatePending[p.fk_carpeta] || ({ ...p,
        nombre_archivo: p.contenido_plantilla?.nombre_archivo, campos_configurables: p.contenido_plantilla?.campos_configurables || [],
        secciones_fijas: p.contenido_plantilla?.secciones_fijas || [], datos_completos: p.contenido_plantilla || {} })));
      return { success: true };
    } catch (e) { return { success: false, error: e instanceof Error ? e.message : "No se pudo sincronizar." }; }
    finally { this.hydrating = false; }
  }
  static getAdquisiciones(): Adquisicion[] { return this.read(KEYS.adq, []); }
  static getAdquisicionById(id: string) { return this.getAdquisiciones().find(a => a.id === id || a.codigo === id); }
  static saveAdquisiciones(list: Adquisicion[]) {
    const old = this.getAdquisiciones(); this.write(KEYS.adq, list);
    list.filter(a => JSON.stringify(old.find(o => o.id === a.id)) !== JSON.stringify(a)).forEach(a => this.changed(a.id));
  }
  static async createAdquisicion(data: Omit<Adquisicion, "id" | "fecha_creacion" | "fecha_actualizacion">): Promise<Result & { data?: Adquisicion }> {
    try {
      const now = new Date().toISOString();
      const adq: Adquisicion = { ...data, id: crypto.randomUUID(), fecha_creacion: now, fecha_actualizacion: now };
      const result = await this.request({ action: "CREATE_EXPEDIENTE", data: adq });
      this.write(KEYS.adq, [adq, ...this.getAdquisiciones()]);
      this.write(KEYS.folders, [...this.getAllCarpetas(), ...result.carpetas.map((c: Carpeta) => ({ ...c, documentos: [] }))]);
      this.addLog(adq.id, `Expediente ${adq.codigo} creado.`, adq.creado_por, "CREAR");
      return { success: true, data: adq };
    } catch (e) { return { success: false, error: e instanceof Error ? e.message : "No se pudo crear el expediente." }; }
  }
  static async updateAdquisicion(id: string, updates: Partial<Adquisicion>): Promise<Result> {
    const list = this.getAdquisiciones(); const index = list.findIndex(a => a.id === id || a.codigo === id);
    if (index < 0) return { success: false, error: "Expediente no encontrado." };
    list[index] = { ...list[index], ...updates, id: list[index].id, fecha_actualizacion: new Date().toISOString() };
    this.saveAdquisiciones(list); return { success: true };
  }
  static async deleteAdquisicion(id: string): Promise<Result> {
    const target = this.getAdquisicionById(id);
    if (!target) return { success: false, error: "Expediente no encontrado." };
    try {
      await this.flushPending();
      await this.request({ action: "DELETE_EXPEDIENTE", id: target.id });
      this.write(KEYS.adq, this.getAdquisiciones().filter(a => a.id !== target.id));
      for (const key of [KEYS.folders, KEYS.fields, KEYS.signs, KEYS.logs]) this.write(key, this.read<any[]>(key, []).filter(r => r.adquisicion_id !== target.id));
      for (const key of [KEYS.pending, KEYS.revisions]) { const map = this.read<Record<string, string>>(key, {}); delete map[target.id]; this.write(key, map); }
      return { success: true };
    } catch (e) { return { success: false, error: e instanceof Error ? e.message : "No se pudo eliminar." }; }
  }
  static getAllCarpetas(): Carpeta[] { return this.read(KEYS.folders, []); }
  static getCarpetasByAdquisicion(id: string): Carpeta[] {
    return this.getAllCarpetas().filter(c => c.adquisicion_id === id).sort((a,b) => (a.orden || a.numero) - (b.orden || b.numero));
  }
  static saveAllCarpetas(list: Carpeta[]) {
    const old = this.getAllCarpetas(); this.write(KEYS.folders, list);
    const ids = new Set([...old, ...list].map(c => c.adquisicion_id));
    ids.forEach(id => { if (JSON.stringify(old.filter(c => c.adquisicion_id === id)) !== JSON.stringify(list.filter(c => c.adquisicion_id === id))) this.changed(id); });
  }
  static addCarpeta(id: string, nombre: string, descripcion = "Carpeta adicional"): Carpeta {
    const folders = this.getCarpetasByAdquisicion(id);
    const numero = Math.max(8, ...folders.map(c => c.numero)) + 1;
    const folder: Carpeta = { id: crypto.randomUUID(), adquisicion_id: id, numero, nombre: nombre.trim(), descripcion, tipo_generacion: "MANUAL", estado: "Pendiente", documentos: [], orden: folders.length + 1 };
    this.saveAllCarpetas([...this.getAllCarpetas(), folder]); return folder;
  }
  static deleteCarpeta(id: string): boolean {
    const folder = this.getAllCarpetas().find(c => c.id === id);
    if (!folder || folder.numero <= 8) return false;
    this.saveAllCarpetas(this.getAllCarpetas().filter(c => c.id !== id)); return true;
  }
  static updateCarpeta(id: string, updates: Partial<Carpeta>): Carpeta | null {
    const all = this.getAllCarpetas(); const folder = all.find(c => c.id === id);
    if (!folder) return null;
    Object.assign(folder, updates, { id: folder.id, numero: folder.numero, adquisicion_id: folder.adquisicion_id });
    this.saveAllCarpetas(all); return folder;
  }
  private static move(adqId: string, id: string, step: number) {
    const all = this.getAllCarpetas(); const folders = this.getCarpetasByAdquisicion(adqId);
    const index = folders.findIndex(c => c.id === id); const next = index + step;
    if (index >= 0 && next >= 0 && next < folders.length) {
      [folders[index], folders[next]] = [folders[next], folders[index]];
      folders.forEach((c,i) => { all.find(f => f.id === c.id)!.orden = i + 1; });
      this.saveAllCarpetas(all);
    }
    return this.getCarpetasByAdquisicion(adqId);
  }
  static moveCarpetaUp(adqId: string, id: string) { return this.move(adqId,id,-1); }
  static moveCarpetaDown(adqId: string, id: string) { return this.move(adqId,id,1); }
  static async addDocumentToCarpeta(id: string, doc: Documento) {
    const all = this.getAllCarpetas(); const folder = all.find(c => c.id === id);
    if (!folder) return undefined;
    folder.documentos = [{ ...doc, carpeta_id: id, adquisicion_id: folder.adquisicion_id }, ...folder.documentos.filter(d => d.id !== doc.id)];
    folder.estado = "Completado"; folder.fecha_proceso = new Date().toISOString();
    this.saveAllCarpetas(all);
    this.addLog(folder.adquisicion_id, `Documento guardado: ${doc.nombre_original}`, doc.creado_por, doc.tipo === "GENERADO_DOCX" ? "GENERAR_IA" : "SUBIR");
    return folder;
  }
  static getCamposExtraidos(id: string): CampoExtraido[] { return this.read<CampoExtraido[]>(KEYS.fields, []).filter(c => c.adquisicion_id === id); }
  static saveCamposExtraidos(id: string, fields: CampoExtraido[]) {
    const keys = new Set(fields.map(c => c.clave));
    this.write(KEYS.fields, [...this.read<CampoExtraido[]>(KEYS.fields, []).filter(c => c.adquisicion_id !== id || !keys.has(c.clave)), ...fields.map(c => ({ ...c, adquisicion_id: id }))]); this.changed(id);
  }
  static getFirmas(id: string): Firma[] { return this.read<Firma[]>(KEYS.signs, []).filter(f => f.adquisicion_id === id).sort((a,b) => a.orden - b.orden); }
  static saveFirmasForAdquisicion(id: string, firmas: Firma[]) { this.write(KEYS.signs, [...this.read<Firma[]>(KEYS.signs, []).filter(f => f.adquisicion_id !== id), ...firmas]); this.changed(id); }
  static signFirma(id: string, usuario: string): boolean {
    const all = this.read<Firma[]>(KEYS.signs, []); const firma = all.find(f => f.id === id); if (!firma) return false;
    firma.firmado = true; firma.fecha_firma = new Date().toISOString(); this.write(KEYS.signs, all);
    this.addLog(firma.adquisicion_id, `Aprobación registrada: ${firma.nombre} (${firma.cargo}).`, usuario, "FIRMAR"); return true;
  }
  static getLogs(id?: string): LogProceso[] { return this.read<LogProceso[]>(KEYS.logs, []).filter(l => !id || l.adquisicion_id === id).sort((a,b) => b.fecha.localeCompare(a.fecha)); }
  static addLog(id: string, descripcion: string, usuario = "Operador", accion: LogProceso["accion"] = "MODIFICAR") {
    this.write(KEYS.logs, [{ id: crypto.randomUUID(), adquisicion_id: id, fecha: new Date().toISOString(), descripcion, usuario, accion }, ...this.getLogs()]); this.changed(id);
  }
  static getPlantillas(): Plantilla[] { return this.read<Plantilla[]>(KEYS.templates, FOLDER_TEMPLATES.map(f => ({ id: `template-${f.numero}`, fk_carpeta: f.numero, nombre: f.nombre, descripcion: f.descripcion, version: "1.0", fecha_creacion: "", campos_configurables: [], secciones_fijas: [], datos_completos: {} }))); }
  static saveAllPlantillas(list: Plantilla[]) { this.write(KEYS.templates, list); }
  static async updatePlantilla(id: string, updates: Partial<Plantilla>): Promise<Result> {
    const list = this.getPlantillas(); const index = list.findIndex(p => p.id === id || p.fk_carpeta === updates.fk_carpeta);
    if (index < 0) return { success: false, error: "Plantilla no encontrada." };
    list[index] = { ...list[index], ...updates, id: list[index].id };
    this.saveAllPlantillas(list);
    this.write(KEYS.templatePending, { ...this.read(KEYS.templatePending, {}), [list[index].fk_carpeta]: list[index] });
    return this.flushPending();
  }
  static setGlobalPlantillaForCarpeta(numero: number, data: { nombre_archivo: string; ruta_archivo?: string; descripcion?: string }) {
    const template = this.getPlantillas().find(p => p.fk_carpeta === numero);
    if (template) void this.updatePlantilla(template.id, data);
    this.saveAllCarpetas(this.getAllCarpetas().map(c => c.numero === numero ? { ...c, plantilla_asociada_nombre: data.nombre_archivo, plantilla_asociada_url: data.ruta_archivo } : c));
  }
  static exportBackup() {
    const data = Object.fromEntries(Object.values(KEYS).map(key => [key, this.read(key, null)]));
    const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, createdAt: new Date().toISOString(), data }, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = `respaldo-ende-${new Date().toISOString().slice(0,10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
