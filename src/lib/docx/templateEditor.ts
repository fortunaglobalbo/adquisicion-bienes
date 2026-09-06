import JSZip from "jszip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
export interface TemplateParagraph { id: string; text: string }
export interface TemplateTable { id: string; headers: string[]; rows: string[][]; editable: boolean; paragraphIds: string[] }
export interface TemplateStructure { paragraphs: TemplateParagraph[]; tables: TemplateTable[] }
export interface DocumentChange { target: string; label: string; value: string; sourceIds: string[]; category?: "purchase" | "normative" }
export interface TableChange { target: string; label: string; rows: string[][] }
const elements = (node: any, tag: string): any[] => Array.from(node.getElementsByTagNameNS(W, tag));
const children = (node: any, tag: string): any[] => Array.from(node.childNodes).filter((n: any) => n.namespaceURI === W && n.localName === tag);
const textOf = (node: any): string => elements(node, "t").map(n => n.textContent || "").join("");

async function readTemplate(buffer: Buffer) {
  if (buffer.length > 3 * 1024 * 1024) throw Error("El Word debe pesar como máximo 3 MB.");
  const zip = await JSZip.loadAsync(buffer);
  const expanded = Object.values(zip.files).reduce((n, f) => n + Number((f as any)._data?.uncompressedSize || 0), 0);
  if (expanded > 25 * 1024 * 1024) throw Error("La plantilla contiene demasiado contenido interno.");
  if (!zip.file("word/document.xml")) throw Error("El archivo no es un documento Word válido.");
  const names = Object.keys(zip.files).filter(n => /^word\/(document|header\d+|footer\d+)\.xml$/.test(n)).sort();
  const parts: { name: string; xml: any }[] = [];
  let total = 0;
  for (const name of names) {
    const raw = await zip.file(name)!.async("string");
    total += raw.length;
    if (total > 2_000_000 || /<!DOCTYPE|<!ENTITY/i.test(raw)) throw Error("La plantilla es demasiado compleja para el asistente.");
    let invalid = false;
    const xml = new DOMParser({ errorHandler: { warning: () => {}, error: () => { invalid = true; }, fatalError: () => { invalid = true; } } }).parseFromString(raw, "text/xml");
    if (invalid) throw Error("No se pudo leer la estructura del Word.");
    parts.push({ name, xml });
  }
  return { zip, parts };
}

function inspectParts(parts: { name: string; xml: any }[]): TemplateStructure {
  const paragraphs: TemplateParagraph[] = [];
  const tables: TemplateTable[] = [];
  for (const { name, xml } of parts) {
    const ps = elements(xml, "p");
    ps.forEach((p, i) => { if (!elements(p, "drawing").length && !elements(p, "fldChar").length && !elements(p, "p").length && !elements(p, "sectPr").length && !elements(p, "br").some(b => b.getAttributeNS(W, "type") === "page")) paragraphs.push({ id: `${name}:p:${i}`, text: textOf(p) }); });
    elements(xml, "tbl").forEach((table, i) => {
      const rows = children(table, "tr").map(r => children(r, "tc").map(textOf));
      const editable = rows.length >= 2 && rows[0].length > 1 && rows.every(r => r.length === rows[0].length)
        && !elements(table, "gridSpan").length && !elements(table, "vMerge").length && elements(table, "tbl").length === 0
        && !elements(table, "drawing").length && !elements(table, "fldChar").length;
      tables.push({ id: `${name}:t:${i}`, headers: rows[0] || [], rows: rows.slice(1), editable,
        paragraphIds: elements(table, "p").map(p => `${name}:p:${ps.indexOf(p)}`) });
    });
  }
  if (paragraphs.length > 600) throw Error("Usa una plantilla de hasta 600 párrafos para el asistente.");
  return { paragraphs, tables };
}

export async function inspectTemplate(buffer: Buffer) { return inspectParts((await readTemplate(buffer)).parts); }

export function validateChanges(structure: TemplateStructure, changes: DocumentChange[], tables: TableChange[]) {
  if (!Array.isArray(changes) || !Array.isArray(tables) || changes.length + tables.length === 0) throw Error("No se identificaron campos para completar. Revisa la plantilla.");
  const seen = new Set<string>();
  for (const c of changes) {
    if (!c || typeof c.target !== "string" || typeof c.value !== "string" || c.value.length > 20000 || !structure.paragraphs.some(p => p.id === c.target) || seen.has(c.target)) throw Error("Hay un campo de la plantilla que no se pudo identificar con certeza.");
    seen.add(c.target);
  }
  for (const t of tables) {
    const original = structure.tables.find(s => s.id === t?.target);
    if (!original?.editable || seen.has(t.target) || !Array.isArray(t.rows) || t.rows.length > 150 || !t.rows.length
      || t.rows.some(r => !Array.isArray(r) || r.length !== original.headers.length || r.some(c => typeof c !== "string" || c.length > 10000))
      || original.paragraphIds.some(id => seen.has(id))) throw Error("La tabla necesita revisión: tiene celdas combinadas, campos superpuestos o columnas incompatibles.");
    seen.add(t.target);
  }
}

function setText(paragraph: any, value: string) {
  const texts = elements(paragraph, "t");
  if (texts.length) {
    texts[0].textContent = value;
    texts[0].setAttribute("xml:space", "preserve");
    texts.slice(1).forEach(t => { t.textContent = ""; });
  } else {
    const run = paragraph.ownerDocument.createElementNS(W, "w:r");
    const text = paragraph.ownerDocument.createElementNS(W, "w:t");
    text.textContent = value; run.appendChild(text); paragraph.appendChild(run);
  }
}

export async function fillTemplate(buffer: Buffer, changes: DocumentChange[], tables: TableChange[]) {
  const { zip, parts } = await readTemplate(buffer);
  validateChanges(inspectParts(parts), changes, tables);
  for (const { name, xml } of parts) {
    const ps = elements(xml, "p");
    const ts = elements(xml, "tbl");
    changes.filter(c => c.target.startsWith(`${name}:p:`)).forEach(c => setText(ps[Number(c.target.split(":").pop())], c.value));
    for (const change of tables.filter(t => t.target.startsWith(`${name}:t:`))) {
      const table = ts[Number(change.target.split(":").pop())];
      const rows = children(table, "tr");
      const sample = rows[1].cloneNode(true);
      rows.slice(1).forEach(row => table.removeChild(row));
      change.rows.forEach(values => {
        const row = sample.cloneNode(true);
        children(row, "tc").forEach((cell, i) => {
          const paragraphs = elements(cell, "p");
          paragraphs.forEach((p, j) => setText(p, j === 0 ? values[i] : ""));
        });
        table.appendChild(row);
      });
    }
    zip.file(name, new XMLSerializer().serializeToString(xml));
  }
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
