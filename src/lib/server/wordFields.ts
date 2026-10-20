export const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const UNKNOWN_PAGE = '…';
const paginationInstruction = (value: string) => /^\s*(?:PAGE|NUMPAGES|PAGEREF)\b/i.test(value);
const descendants = (node: Document | Element, name: string): Element[] => Array.from(node.getElementsByTagNameNS(WORD_NS, name));

function invalidateResult(document: Document, texts: Element[], anchor?: Element) {
  if (texts.length) {
    texts[0].textContent = UNKNOWN_PAGE;
    texts.slice(1).forEach(text => { text.textContent = ''; });
  } else if (anchor) {
    const run = document.createElementNS(WORD_NS, 'w:r');
    const text = document.createElementNS(WORD_NS, 'w:t');
    text.textContent = UNKNOWN_PAGE;
    run.appendChild(text);
    anchor.appendChild(run);
  }
}

/**
 * Content edits invalidate pagination. Only a Word layout engine can calculate
 * its replacement; an uncalculated cache must never masquerade as page 1.
 * Keep the native field, instruction and formatting for that later calculation.
 */
export function invalidatePaginationFields(document: Document): number {
  let count = 0;
  for (const field of descendants(document, 'fldSimple')) {
    if (!paginationInstruction(field.getAttributeNS(WORD_NS, 'instr') || '')) continue;
    field.setAttributeNS(WORD_NS, 'w:dirty', 'true');
    field.removeAttributeNS(WORD_NS, 'fldLock');
    invalidateResult(document, descendants(field, 't'), field);
    count++;
  }

  type Field = {begin: Element; instruction: string; result: Element[]; separate?: Element};
  const stack: Field[] = [];
  const visit = (node: Document | Element) => {
    // Snapshot children because an empty result may gain a run when its field ends.
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType !== 1) continue;
      const element = child as Element;
      if (element.namespaceURI === WORD_NS) {
        if (element.localName === 'fldChar') {
          const kind = element.getAttributeNS(WORD_NS, 'fldCharType');
          if (kind === 'begin') stack.push({begin: element, instruction: '', result: []});
          else if (kind === 'separate' && stack.length) stack[stack.length - 1].separate = element;
          else if (kind === 'end') {
            const field = stack.pop();
            if (field && paginationInstruction(field.instruction)) {
              field.begin.setAttributeNS(WORD_NS, 'w:dirty', 'true');
              field.begin.removeAttributeNS(WORD_NS, 'fldLock');
              invalidateResult(document, field.result);
              if (!field.result.length && field.separate) {
                const run = field.separate.parentNode;
                if (run) {
                  const text = document.createElementNS(WORD_NS, 'w:t');
                  text.textContent = UNKNOWN_PAGE;
                  run.insertBefore(text, field.separate.nextSibling);
                }
              }
              count++;
            }
          }
        } else if (stack.length) {
          const field = stack[stack.length - 1];
          if (element.localName === 'instrText' && !field.separate) field.instruction += element.textContent || '';
          if (element.localName === 't' && field.separate) field.result.push(element);
        }
      }
      // Simple fields are self-contained; do not treat their contents as the
      // cached result of an enclosing complex field.
      if (element.namespaceURI !== WORD_NS || element.localName !== 'fldSimple') visit(element);
    }
  };
  visit(document);
  return count;
}

export function enableFieldUpdatesOnOpen(settings: Document) {
  const fields = descendants(settings, 'updateFields');
  const update = fields[0] || settings.createElementNS(WORD_NS, 'w:updateFields');
  update.setAttributeNS(WORD_NS, 'w:val', 'true');
  if (!fields.length) settings.documentElement.appendChild(update);
  fields.slice(1).forEach(field => field.parentNode?.removeChild(field));
}
