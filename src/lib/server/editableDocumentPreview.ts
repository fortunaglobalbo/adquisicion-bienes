import fs from 'fs/promises';
import path from 'path';
import { createHash, randomBytes } from 'crypto';
import mammoth from 'mammoth';
import type { FixedDraft, FixedModel } from '../docx/fixedModels';
import { fillTemplate, inspectTemplate, type DocumentChange, type TableChange } from '../docx/templateEditor';
import { wordFormPreview } from './wordFormPreview';
import { evaluationPreview } from './evaluationPreview';
import { addSelectionTables } from './selectionWord';
import { keepTdrHeadingsWithBody } from './wordPagination';

const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const lines = (value: string) => escape(value).replace(/\r\n?/g, '\n').replace(/\n/g, '<br>');
const pending = (value: string) => /^\[PENDIENTE[^\]]*\]$/.test(value);
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

/**
 * Build a separate editing view from the institutional Word placeholders.
 * Each placeholder gets an unguessable token before conversion to HTML, so two
 * identical names, blank values, or item descriptions can never share a target.
 * The original generated Word and its ordinary preview are left untouched.
 */
export async function editableDocumentPreview(buffer: Buffer, draft: FixedDraft, model: FixedModel, _html?: string): Promise<string> {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw Error('No se encontró el documento para editar.');
  const template = await fs.readFile(path.join(process.cwd(), 'templates', 'ende', model.file));
  if (createHash('sha256').update(template).digest('hex') !== model.sha256) throw Error('El modelo cambió sin registrar una nueva versión.');
  const structure = await inspectTemplate(template);
  const fields = new Map(model.fields.map(field => [field.key, field]));
  const replacements = new Map<string, string>();
  const prefix = `ENDEEDIT${randomBytes(12).toString('hex').toUpperCase()}`;
  const token = (html: string) => {
    const value = `${prefix}TOKEN${replacements.size}END`;
    replacements.set(value, html);
    return value;
  };
  const marker = (key: string, value: string, part?: 'name' | 'role') => {
    const field = fields.get(key);
    if (!field || (model.number === 3 && key === 'presupuesto')) return token(lines(value));
    return token(`<span data-fixed-field="${escape(key)}"${part ? ` data-fixed-part="${part}"` : ''} aria-label="${escape(field.label)}${part === 'name' ? ': nombre' : part === 'role' ? ': cargo' : ''}">${lines(value)}</span>`);
  };
  const checkbox = (key: string, choice: string, expected: string) => {
    const checked = normalize(draft.fields[key] || '') === expected;
    return token(`<span data-fixed-field="${escape(key)}" data-fixed-choice="${escape(choice)}" role="radio" aria-checked="${checked}" aria-label="${escape(fields.get(key)?.label || key)}: ${escape(choice)}">${checked ? '☒' : '☐'}</span>`);
  };
  const references: Record<string, { key: string; part: 'name' | 'role'; value: string }> = {};
  if (model.number === 6) for (const key of ['destinatario', 'via', 'solicitante']) {
    const [name, ...role] = (draft.fields[key] || '').split(/\r?\n/);
    references[`${key}_nombre`] = { key, part: 'name', value: name };
    references[`${key}_cargo`] = { key, part: 'role', value: role.join('\n') };
  }
  const choices: Record<string, string> = {};
  for (const [key, yes, no, yesLabel, noLabel] of [
    ['almacen', 'con saldo', 'sin saldo', 'Con saldo', 'Sin saldo'],
    ['publicar_precio', 'si', 'no', 'Sí', 'No'],
    ['con_presupuesto', 'si', 'no', 'Sí', 'No'],
  ]) {
    choices[`${key}_si`] = checkbox(key, yesLabel, yes);
    choices[`${key}_no`] = checkbox(key, noLabel, no);
  }
  const itemTable = structure.tables.find(table => table.rows.some(row => row.some(cell => cell.includes('{{items.'))));
  const excluded = new Set(itemTable?.paragraphIds || []);
  const changes: DocumentChange[] = [];
  for (const paragraph of structure.paragraphs) {
    if (excluded.has(paragraph.id) || !/\{\{[a-z_]+\}\}/.test(paragraph.text)) continue;
    changes.push({ target: paragraph.id, label: 'Campo editable', sourceIds: [], value: paragraph.text.replace(/\{\{([a-z_]+)\}\}/g, (_match, key: string) => {
      if (choices[key]) return choices[key];
      const reference = references[key];
      const value = reference?.value ?? draft.fields[key] ?? '';
      const displayed = value && !pending(value) ? value : model.number === 2 || key.endsWith('_cargo') ? '\u00a0' : '________________';
      return marker(reference?.key || key, displayed, reference?.part);
    }) });
  }
  const tables: TableChange[] = [];
  if (itemTable) {
    // An empty row is an editable first item in the view; the client creates it
    // only after the user changes a cell, preserving the empty original draft.
    const rows = draft.items.length ? draft.items : [Object.fromEntries(model.columns.map(column => [column.key, column.key.endsWith('oferta') ? '' : '[PENDIENTE]']))];
    tables.push({ target: itemTable.id, label: 'Ítems editables', rows: rows.map((row, index) => model.columns.map(column => {
      const value = row[column.key] || '';
      const displayed = pending(value) ? '________' : value;
      return token(column.key === 'numero' ? lines(draft.items.length ? displayed : '1') : `<span data-fixed-row="${index}" data-fixed-column="${escape(column.key)}" aria-label="${escape(column.label)} del ítem ${index + 1}">${lines(displayed)}</span>`);
    })) });
  }
  let editable = await fillTemplate(template, changes, tables);
  if (model.number === 1) editable = await keepTdrHeadingsWithBody(editable);
  if (model.number === 1 && draft.selectionPlan) editable = await addSelectionTables(editable, draft.selectionPlan);
  const converted = model.number === 2 ? await wordFormPreview(editable) : model.number === 6 ? await evaluationPreview(editable) : (await mammoth.convertToHtml({ buffer: editable })).value;
  // Tokens consist only of letters and numbers, which both converters preserve
  // in one text node. Replace each exact token, never user-provided document text.
  let html = converted;
  for (const [value, replacement] of Array.from(replacements.entries())) html = html.split(value).join(replacement);
  if (html.includes(prefix)) throw Error('No se pudo identificar un campo editable del documento.');
  return html;
}
