/** Keep the Word preview's layout while excluding executable or remote content. */
const documentTags = new Set([
  'P','BR','DIV','SPAN','STRONG','EM','B','I','U','S','SUB','SUP',
  'H1','H2','H3','H4','H5','H6','TABLE','THEAD','TBODY','TFOOT','TR','TD','TH',
  'COLGROUP','COL','IMG','UL','OL','LI','HR','BLOCKQUOTE',
]);
const discardTags = new Set(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','SVG','MATH','LINK','META','BASE','FORM','INPUT','BUTTON','TEXTAREA','SELECT','OPTION','TEMPLATE']);
const institutionalClasses = new Set(['evaluation-preview','evaluation-title','evaluation-form','evaluation-name','evaluation-role','evaluation-process','evaluation-rule','evaluation-section']);
const layoutProperties = new Set([
  'color','background','background-color','font-family','font-size','font-weight','font-style',
  'text-decoration','text-align','white-space','line-height','letter-spacing','word-spacing','vertical-align',
  'border','border-top','border-right','border-bottom','border-left','border-width','border-style','border-color',
  'border-top-width','border-right-width','border-bottom-width','border-left-width',
  'border-top-style','border-right-style','border-bottom-style','border-left-style',
  'border-top-color','border-right-color','border-bottom-color','border-left-color',
  'border-collapse','border-spacing','table-layout','width','height','min-width','max-width','min-height','max-height',
  'padding','padding-top','padding-right','padding-bottom','padding-left',
  'margin','margin-top','margin-right','margin-bottom','margin-left','overflow-wrap','word-break','list-style-type',
]);

export function safeDocumentStyle(style: string): string {
  return style.slice(0, 10000).split(';').flatMap(declaration => {
    const separator = declaration.indexOf(':');
    if (separator < 0) return [];
    const key = declaration.slice(0, separator).trim().toLowerCase();
    const value = declaration.slice(separator + 1).trim();
    if (!layoutProperties.has(key) || !value || /[\\{}<>@]|url\s*\(|(?:expression|image-set|image|paint|element)\s*\(|(?:javascript|vbscript|data|https?|ftp)\s*:|!\s*important/i.test(value)) return [];
    if (['background','background-color'].includes(key) && !/^(?:#[\da-f]{3,8}|[a-z]+|rgba?\([0-9.,%\s]+\)|hsla?\([0-9.,%\s]+\))$/i.test(value)) return [];
    return [`${key}:${value}`];
  }).join(';');
}

/** Exported separately so tests can exercise the same allowlist without a browser. */
export function sanitizeDocumentElement(root: Element): void {
  for (const child of Array.from(root.childNodes)) {
    if (child.nodeType === 8) { root.removeChild(child); continue; }
    if (child.nodeType !== 1) continue;
    const element = child as Element;
    const tag = element.tagName.toUpperCase();
    if (discardTags.has(tag)) { root.removeChild(element); continue; }
    sanitizeDocumentElement(element);
    if (!documentTags.has(tag)) {
      while (element.firstChild) root.insertBefore(element.firstChild, element);
      root.removeChild(element);
      continue;
    }
    for (const attr of Array.from(element.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value;
      if (name === 'style') {
        const style = safeDocumentStyle(value);
        if (style) element.setAttribute('style', style); else element.removeAttribute(attr.name);
      } else if (name === 'class') {
        const classes = value.split(/\s+/).filter(item => institutionalClasses.has(item));
        if (classes.length) element.setAttribute('class', classes.join(' ')); else element.removeAttribute(attr.name);
      } else if (name === 'src' && tag === 'IMG') {
        if (!/^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(value)) element.removeAttribute(attr.name);
      } else if (name === 'alt' || name === 'title' || name === 'aria-label') {
        // These are inert plain text; Word previews use labels for the institutional tables.
      } else if ((name === 'rowspan' || name === 'colspan') && (tag === 'TD' || tag === 'TH')) {
        if (!/^\d{1,3}$/.test(value) || Number(value) < 1) element.removeAttribute(attr.name);
      } else if ((name === 'width' || name === 'height') && (tag === 'IMG' || tag === 'COL')) {
        if (!/^\d{1,4}(?:\.\d+)?(?:%|px|pt)?$/.test(value)) element.removeAttribute(attr.name);
      } else if (['data-fixed-field','data-fixed-column'].includes(name)) {
        if (!/^[a-z][a-z0-9_]{0,80}$/i.test(value)) element.removeAttribute(attr.name);
      } else if (name === 'data-fixed-row') {
        if (!/^\d{1,4}$/.test(value)) element.removeAttribute(attr.name);
      } else if (name === 'data-fixed-part') {
        if (!['name','role'].includes(value)) element.removeAttribute(attr.name);
      } else if (name === 'data-fixed-choice') {
        if (!value || value.length > 50) element.removeAttribute(attr.name);
      } else element.removeAttribute(attr.name);
    }
    if (tag === 'IMG' && !element.getAttribute('src')) root.removeChild(element);
  }
}

export function editableDocumentFragment(html: string, ownerDocument: Document): DocumentFragment {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  sanitizeDocumentElement(parsed.body);
  const fragment = ownerDocument.createDocumentFragment();
  for (const node of Array.from(parsed.body.childNodes)) fragment.appendChild(ownerDocument.importNode(node, true));
  return fragment;
}
