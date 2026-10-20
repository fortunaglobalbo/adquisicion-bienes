import {WORD_NS} from './wordFields';

const SECTION_STYLE = 'TdrIndexSection';
const TOC_STYLE = 'TOC1';
const TOC_INSTRUCTION = `TOC \\h \\z \\t "${SECTION_STYLE},1"`;
const elements = (node: Document | Element, name: string): Element[] => Array.from(node.getElementsByTagNameNS(WORD_NS, name));
const child = (node: Element, name: string): Element | undefined => Array.from(node.childNodes).find(node => node.nodeType === 1 && (node as Element).namespaceURI === WORD_NS && (node as Element).localName === name) as Element | undefined;

function element(document: Document, name: string, attributes: Record<string, string> = {}) {
  const node = document.createElementNS(WORD_NS, `w:${name}`);
  for (const [name, value] of Object.entries(attributes)) node.setAttributeNS(WORD_NS, `w:${name}`, value);
  return node;
}

function fieldBoundary(document: Document, kind: string) {
  const run = element(document, 'r');
  run.appendChild(element(document, 'fldChar', {fldCharType: kind, ...(kind === 'begin' ? {dirty: 'true'} : {})}));
  return run;
}

/**
 * A native TOC asks Word to compose the index as a whole. Independent PAGEREF
 * fields can otherwise update during document loading, before page layout,
 * caching 1 for every section. Keep the institutional index as the initial
 * field result and restrict regeneration to the fourteen TDR headings.
 */
export function addTdrTableOfContents(document: Document, styles: Document): boolean {
  if (elements(document, 'instrText').some(code => (code.textContent || '').trim() === TOC_INSTRUCTION)) return false;
  const rows = elements(document, 'p').filter(paragraph => elements(paragraph, 'fldSimple').some(field => /^\s*PAGEREF\s+section_(?:[1-9]|1[0-4])\b/.test(field.getAttributeNS(WORD_NS, 'instr') || '')));
  if (!rows.length) return false;
  const bookmarks = elements(document, 'bookmarkStart');
  const headings = Array.from({length: 14}, (_, index) => bookmarks.find(bookmark => bookmark.getAttributeNS(WORD_NS, 'name') === `section_${index + 1}`)?.parentNode as Element | undefined);
  if (rows.length !== 14 || headings.some(heading => heading?.localName !== 'p') || new Set(headings).size !== 14) throw Error('No se pudo preparar el índice automático de las catorce secciones del TDR.');
  for (let index = 0; index < rows.length; index++) {
    if (!elements(rows[index], 'fldSimple').some(field => new RegExp(`^\\s*PAGEREF\\s+section_${index + 1}\\b`).test(field.getAttributeNS(WORD_NS, 'instr') || ''))) throw Error('Las referencias del índice del TDR están fuera de orden.');
  }

  // The heading's visible runs and direct paragraph formatting remain intact.
  // A dedicated style keeps cover titles and procurement subheadings out of TOC.
  if (!elements(styles, 'style').some(style => style.getAttributeNS(WORD_NS, 'styleId') === SECTION_STYLE)) {
    const style = element(styles, 'style', {type: 'paragraph', styleId: SECTION_STYLE});
    style.appendChild(element(styles, 'name', {val: SECTION_STYLE}));
    style.appendChild(element(styles, 'basedOn', {val: 'Normal'}));
    styles.documentElement.appendChild(style);
  }
  for (const heading of headings as Element[]) {
    let properties = child(heading, 'pPr');
    if (!properties) { properties = element(document, 'pPr'); heading.insertBefore(properties, heading.firstChild); }
    let style = child(properties, 'pStyle');
    if (!style) { style = element(document, 'pStyle'); properties.insertBefore(style, properties.firstChild); }
    style.setAttributeNS(WORD_NS, 'w:val', SECTION_STYLE);
  }

  const first = rows[0], last = rows[rows.length - 1];
  const properties = child(first, 'pPr');
  const previousTocStyle = elements(styles, 'style').find(style => style.getAttributeNS(WORD_NS, 'styleId') === TOC_STYLE);
  if (previousTocStyle) previousTocStyle.parentNode?.removeChild(previousTocStyle);
  const tocStyle = element(styles, 'style', {type: 'paragraph', styleId: TOC_STYLE});
  tocStyle.appendChild(element(styles, 'name', {val: 'toc 1'}));
  tocStyle.appendChild(element(styles, 'basedOn', {val: 'Normal'}));
  if (properties) tocStyle.appendChild(styles.importNode(properties, true));
  const runProperties = elements(first, 'rPr')[0];
  if (runProperties) tocStyle.appendChild(styles.importNode(runProperties, true));
  styles.documentElement.appendChild(tocStyle);

  const firstContent = properties ? properties.nextSibling : first.firstChild;
  first.insertBefore(fieldBoundary(document, 'begin'), firstContent);
  const codeRun = element(document, 'r');
  const code = element(document, 'instrText');
  code.setAttribute('xml:space', 'preserve');
  code.textContent = ` ${TOC_INSTRUCTION} `;
  codeRun.appendChild(code);
  first.insertBefore(codeRun, firstContent);
  first.insertBefore(fieldBoundary(document, 'separate'), firstContent);
  last.appendChild(fieldBoundary(document, 'end'));
  return true;
}
