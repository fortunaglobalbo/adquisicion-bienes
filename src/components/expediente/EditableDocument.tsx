"use client";

import React, { useEffect, useRef, useState } from 'react';
import type { FixedDraft, FixedModel } from '@/lib/docx/fixedModels';
import { editableDocumentFragment } from '@/lib/docx/editableDocumentHtml';

export interface EditableDocumentProps {
  html: string;
  draft: FixedDraft;
  model: FixedModel;
  disabled?: boolean;
  onFieldChange: (key: string, value: string) => void;
  onItemChange: (row: number, key: string, value: string) => void;
  onAddItem: () => void;
  onRemoveItem: (row: number) => void;
}

const action = 'rounded-md border border-blue-200 bg-white px-3 py-1.5 text-sm text-blue-950 hover:bg-blue-50 disabled:opacity-50';
const plainText = (element: HTMLElement) => (element.innerText ?? element.textContent ?? '').replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ');
const displayValue = (value: string) => value.trim() === '[PENDIENTE]' ? '' : value;
const fieldPart = (value: string, part?: string | null) => part ? (part === 'name' ? value.split('\n')[0] : value.split('\n').slice(1).join('\n')) : value;

export function EditableDocument(props: EditableDocumentProps) {
  const { html, draft, model, disabled = false } = props;
  const sheet = useRef<HTMLDivElement>(null);
  const current = useRef(props);
  current.current = props;
  const [selectedRow, setSelectedRow] = useState<number | null>(null);

  function syncValue(element: HTMLElement) {
    const { draft: latest, model: layout, onFieldChange, onItemChange } = current.current;
    if (current.current.disabled || element.getAttribute('contenteditable') !== 'true') return;
    const value = plainText(element);
    const key = element.dataset.fixedField;
    if (key && layout.fields.some(field => field.key === key)) {
      const part = element.dataset.fixedPart;
      if (value === displayValue(fieldPart(latest.fields[key] || '', part))) return;
      let next = value;
      if (part) {
        const name = part === 'name' ? value : displayValue(fieldPart(latest.fields[key] || '', 'name'));
        const role = part === 'role' ? value : displayValue(fieldPart(latest.fields[key] || '', 'role'));
        next = role ? `${name}\n${role}` : name;
      }
      if (next !== latest.fields[key]) onFieldChange(key, next);
      return;
    }
    const column = element.dataset.fixedColumn;
    const row = Number(element.dataset.fixedRow ?? element.closest('[data-fixed-row]')?.getAttribute('data-fixed-row'));
    if (column && column !== 'numero' && Number.isInteger(row) && row >= 0 && row <= latest.items.length && layout.columns.some(c => c.key === column) && value !== displayValue(latest.items[row]?.[column] || '')) onItemChange(row, column, value);
  }

  function insertPlainText(element: HTMLElement, value: string) {
    const selection = element.ownerDocument.getSelection();
    if (!selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (!element.contains(range.commonAncestorContainer)) return;
    range.deleteContents();
    const text = element.ownerDocument.createTextNode(value.replace(/\r\n?/g, '\n'));
    range.insertNode(text);
    range.setStartAfter(text);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    syncValue(element);
  }

  useEffect(() => {
    const host = sheet.current;
    if (!host) return;
    host.replaceChildren(editableDocumentFragment(html, host.ownerDocument));
    setSelectedRow(null);
  }, [html]);

  useEffect(() => {
    const host = sheet.current;
    if (!host) return;
    const focused = host.ownerDocument.activeElement;
    const configure = (element: HTMLElement, label: string, value: string, editable: boolean) => {
      element.setAttribute('contenteditable', editable && !disabled ? 'true' : 'false');
      element.setAttribute('spellcheck', 'true');
      if (editable) {
        element.setAttribute('role', 'textbox');
        element.setAttribute('aria-label', label);
        element.setAttribute('aria-multiline', 'true');
        element.setAttribute('aria-disabled', String(disabled));
        element.setAttribute('tabindex', disabled ? '-1' : '0');
        element.setAttribute('data-editor-zone', 'true');
        element.setAttribute('data-placeholder', 'Escribe aquí');
      }
      // React state follows every keystroke. Only external changes rewrite the DOM;
      // the active region is left untouched to keep the caret and IME composition.
      const visible = displayValue(value);
      if (focused !== element && !element.contains(focused) && plainText(element) !== visible) element.textContent = visible;
    };
    host.querySelectorAll<HTMLElement>('[data-fixed-field]').forEach(element => {
      const field = model.fields.find(item => item.key === element.dataset.fixedField);
      if (!field) return;
      if (element.dataset.fixedChoice) {
        const selected = draft.fields[field.key] === element.dataset.fixedChoice;
        element.textContent = selected ? '☒' : '☐';
        element.setAttribute('contenteditable', 'false');
        element.setAttribute('role', 'radio');
        element.setAttribute('aria-label', `${field.label}: ${element.dataset.fixedChoice}`);
        element.setAttribute('aria-checked', String(selected));
        element.setAttribute('aria-disabled', String(disabled));
        element.setAttribute('tabindex', disabled ? '-1' : '0');
        element.setAttribute('data-editor-choice', 'true');
        return;
      }
      const part = element.dataset.fixedPart;
      configure(element, `${field.label}${part === 'name' ? ': nombre' : part === 'role' ? ': cargo' : ''}`, fieldPart(draft.fields[field.key] || '', part), true);
    });
    host.querySelectorAll<HTMLElement>('[data-fixed-column]').forEach(element => {
      const column = model.columns.find(item => item.key === element.dataset.fixedColumn);
      const row = Number(element.dataset.fixedRow ?? element.closest('[data-fixed-row]')?.getAttribute('data-fixed-row'));
      if (!column || !Number.isInteger(row) || row < 0 || row > draft.items.length) return;
      configure(element, `${column.label}, ${[3, 6].includes(model.number) ? 'proveedor' : 'ítem'} ${row + 1}`, draft.items[row]?.[column.key] || '', column.key !== 'numero');
    });
  }, [html, draft, model, disabled]);

  const editableTarget = (target: EventTarget | null) => target instanceof Element ? target.closest<HTMLElement>('[data-editor-zone="true"]') : null;

  return <div className="rounded-lg border border-slate-300 bg-slate-100 p-2 sm:p-5">
    <p className="mb-3 text-sm text-slate-600" id={`document-edit-help-${model.number}`}>Haz clic en el texto o en una celda para corregirlo. Después pulsa «Guardar cambios».</p>
    <div className="overflow-x-auto rounded-sm shadow-sm">
      <div
        ref={sheet}
        className="institutional-document-editor mx-auto min-w-[640px] max-w-[860px] bg-white px-8 py-10 sm:px-12"
        aria-label={`Documento editable: ${model.title}`}
        aria-describedby={`document-edit-help-${model.number}`}
        aria-busy={disabled}
        onClick={event => {
          const element = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-editor-choice="true"]') : null;
          if (!disabled && element?.dataset.fixedField && element.dataset.fixedChoice) props.onFieldChange(element.dataset.fixedField, element.dataset.fixedChoice);
        }}
        onKeyDown={event => {
          const element = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-editor-choice="true"]') : null;
          if (element && ['Enter', ' '].includes(event.key)) {
            event.preventDefault();
            if (!disabled && element.dataset.fixedField && element.dataset.fixedChoice) props.onFieldChange(element.dataset.fixedField, element.dataset.fixedChoice);
          }
        }}
        onInput={event => { const element = editableTarget(event.target); if (element) syncValue(element); }}
        onBlur={event => {
          const element = editableTarget(event.target);
          if (element) {
            const value = plainText(element);
            syncValue(element);
            element.textContent = value;
          }
        }}
        onFocus={event => {
          const element = editableTarget(event.target);
          const value = element?.dataset.fixedRow ?? element?.closest('[data-fixed-row]')?.getAttribute('data-fixed-row');
          setSelectedRow(value !== null && value !== undefined ? Number(value) : null);
        }}
        onPaste={event => {
          const element = editableTarget(event.target);
          if (!element) return;
          event.preventDefault();
          if (!disabled && event.clipboardData.types.includes('text/plain')) insertPlainText(element, event.clipboardData.getData('text/plain'));
        }}
        onDrop={event => event.preventDefault()}
        onBeforeInput={event => {
          const element = editableTarget(event.target);
          const input = event.nativeEvent as InputEvent;
          if (element && ['insertParagraph', 'insertLineBreak'].includes(input.inputType)) {
            event.preventDefault();
            if (!disabled) insertPlainText(element, '\n');
          }
        }}
      />
    </div>
    {!!model.columns.length && <div className="mx-auto mt-3 flex max-w-[860px] flex-wrap items-center gap-2" aria-label="Editar filas del documento">
      <button type="button" className={action} disabled={disabled} onClick={props.onAddItem}>Añadir {[3, 6].includes(model.number) ? 'proveedor' : 'ítem'}</button>
      {selectedRow !== null && draft.items[selectedRow] && <button type="button" className={`${action} text-red-800`} disabled={disabled} onClick={() => { props.onRemoveItem(selectedRow); setSelectedRow(null); }}>Quitar {[3, 6].includes(model.number) ? 'proveedor' : 'ítem'} {selectedRow + 1}</button>}
      {draft.items.length > 0 && selectedRow === null && <span className="text-xs text-slate-600">Para quitar una fila, haz clic en una de sus celdas.</span>}
    </div>}
    <style>{`
      .institutional-document-editor {color:#151515;font:14px Arial,sans-serif;line-height:1.45;}
      .institutional-document-editor img {display:block;max-width:180px;max-height:100px;width:auto;height:auto;object-fit:contain;margin:0 auto 16px;}
      .institutional-document-editor table {border-collapse:collapse;width:100%;margin:18px 0;table-layout:auto;}
      .institutional-document-editor td,.institutional-document-editor th {border:1px solid #888;padding:7px;overflow-wrap:normal;word-break:normal;}
      .institutional-document-editor p {white-space:pre-wrap;margin:0 0 10px;}
      .institutional-document-editor h1,.institutional-document-editor h2 {text-align:center;font-weight:bold;margin:18px 0 12px;}
      .institutional-document-editor h3,.institutional-document-editor h4 {font-weight:bold;margin:16px 0 8px;}
      .institutional-document-editor ul,.institutional-document-editor ol {padding-left:24px;}
      .institutional-document-editor ul {list-style:disc;}
      .institutional-document-editor ol {list-style:decimal;}
      .institutional-document-editor .evaluation-preview {font:11pt Arial,sans-serif;line-height:1.2;}
      .institutional-document-editor .evaluation-preview img {width:140px;max-width:140px;max-height:none;margin:0 0 28px 0;}
      .institutional-document-editor .evaluation-preview .evaluation-title {text-align:center;font-weight:bold;margin:0;}
      .institutional-document-editor .evaluation-preview .evaluation-form {text-align:center;margin:0 0 22px;}
      .institutional-document-editor .evaluation-preview table:nth-of-type(1) {background:#eee;margin:0 0 20px;}
      .institutional-document-editor .evaluation-preview table:nth-of-type(1) td {border:0;padding:0 2px;width:50%;font-weight:bold;}
      .institutional-document-editor .evaluation-preview table:nth-of-type(1) td:last-child {text-align:right;}
      .institutional-document-editor .evaluation-preview table:nth-of-type(1) p {margin:0;}
      .institutional-document-editor .evaluation-preview table:nth-of-type(2) {margin:0 0 24px;border-bottom:5px double #000;}
      .institutional-document-editor .evaluation-preview table:nth-of-type(2) td {border:0;padding:0;vertical-align:top;}
      .institutional-document-editor .evaluation-preview table:nth-of-type(2) td:first-child {width:14.2%;white-space:nowrap;}
      .institutional-document-editor .evaluation-preview table:nth-of-type(2) p {margin:0;}
      .institutional-document-editor .evaluation-preview table:nth-of-type(2) .evaluation-name {font-weight:bold;}
      .institutional-document-editor .evaluation-preview table:nth-of-type(2) .evaluation-role {font-weight:bold;color:#808080;margin-top:16px;}
      .institutional-document-editor .evaluation-preview table:nth-of-type(2) tr:last-child td {padding-top:20px;padding-bottom:24px;}
      .institutional-document-editor .evaluation-preview .evaluation-process {font-weight:bold;text-align:justify;}
      .institutional-document-editor .evaluation-preview .evaluation-section {font-weight:bold;margin-top:20px;}
      .institutional-document-editor .evaluation-preview .evaluation-rule {margin:0;}
      .institutional-document-editor [data-editor-zone="true"] {white-space:pre-wrap;overflow-wrap:anywhere;min-height:1em;outline:none;border-radius:2px;}
      .institutional-document-editor span[data-editor-zone="true"] {display:inline-block;min-width:2em;}
      .institutional-document-editor [data-editor-zone="true"]:hover {background:#eff6ff;box-shadow:0 0 0 1px #bfdbfe;}
      .institutional-document-editor [data-editor-zone="true"]:focus {background:#eff6ff;box-shadow:0 0 0 2px #2563eb;}
      .institutional-document-editor [data-editor-zone="true"]:empty:before {content:attr(data-placeholder);color:#64748b;font-style:italic;font-size:12px;pointer-events:none;}
      .institutional-document-editor [data-editor-choice="true"] {cursor:pointer;border-radius:2px;}
      .institutional-document-editor [data-editor-choice="true"]:focus {outline:2px solid #2563eb;outline-offset:2px;}
      .institutional-document-editor [aria-disabled="true"] {background:transparent;box-shadow:none;}
      @media print {.institutional-document-editor [data-editor-zone="true"] {background:transparent!important;box-shadow:none!important;}.institutional-document-editor [data-editor-zone="true"]:empty:before {content:none;}}
    `}</style>
  </div>;
}
