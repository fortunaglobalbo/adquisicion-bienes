import type { Adquisicion, Carpeta } from '@/types';
import type { FixedDraft } from './fixedModels';
import { compatibleFixedDraft } from './fixedModels';

export type ComparativeBackup = NonNullable<Adquisicion['comparative_report_history']>[number];

/** Preserve incompatible historical drafts without ever treating them as a current model. */
export function previousComparativeDrafts(adquisicion: Adquisicion, carpetas: Carpeta[]): { latest?: FixedDraft; backups: ComparativeBackup[] } {
  const company = adquisicion.empresa_id || 'ende';
  const records: { draft: FixedDraft; time: number; updatedAt: string; reason: string }[] = [];
  const prepared = adquisicion.borradores_ia?.['3'];
  if (prepared?.draft?.companyId === company) records.push({ draft: prepared.draft, time: Date.parse(prepared.updatedAt) || 0, updatedAt: prepared.updatedAt, reason: 'Borrador anterior del informe' });
  for (const document of carpetas.find(folder => folder.numero === 3)?.documentos || []) {
    const draft = document.metadata?.fixedDraft;
    if (draft?.companyId === company) records.push({ draft, time: Date.parse(document.fecha_creacion) || 0, updatedAt: document.fecha_creacion, reason: 'Versión Word anterior' });
  }
  try {
    const local = typeof localStorage === 'undefined' ? null : JSON.parse(localStorage.getItem(`fixed-draft:${adquisicion.id}:3`) || 'null');
    if (local?.draft?.fields && Array.isArray(local.draft.items) && local.draft.companyId === company) {
      const time = Number(local.updatedAt) || 0;
      records.push({ draft: local.draft, time, updatedAt: new Date(time || Date.now()).toISOString(), reason: 'Ediciones locales anteriores a la nueva lectura' });
    }
  } catch { /* An unreadable recovery never replaces or removes a saved version. */ }
  records.sort((a, b) => b.time - a.time);
  const seen = new Set<string>();
  const backups: ComparativeBackup[] = records.filter(record => {
    const key = JSON.stringify(record.draft);
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).map(record => ({ data: record.draft.evaluationRevision === adquisicion.comparative_report?.revision ? adquisicion.comparative_report : undefined, draft: record.draft, updatedAt: record.updatedAt, reason: record.reason }));
  return { latest: records.find(record => compatibleFixedDraft(3, record.draft))?.draft, backups };
}

export function comparativeHistoryWithPrevious(adquisicion: Adquisicion, carpetas: Carpeta[]): ComparativeBackup[] {
  const history = [...(adquisicion.comparative_report_history || [])];
  const fingerprints = new Set(history.map(entry => JSON.stringify({ data: entry.data, draft: entry.draft })));
  const backups = previousComparativeDrafts(adquisicion, carpetas).backups;
  if (adquisicion.comparative_report && !backups.some(entry => entry.data?.revision === adquisicion.comparative_report!.revision)) {
    backups.push({ data: adquisicion.comparative_report, updatedAt: adquisicion.comparative_report.updatedAt, reason: 'Datos anteriores del cuadro comparativo' });
  }
  for (const backup of backups) {
    const fingerprint = JSON.stringify({ data: backup.data, draft: backup.draft });
    if (!fingerprints.has(fingerprint)) { history.push(backup); fingerprints.add(fingerprint); }
  }
  return history;
}
