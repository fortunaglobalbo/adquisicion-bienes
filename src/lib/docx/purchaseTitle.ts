import { obsoletePurchaseMentions } from './purchaseBrief';

interface TitleItem { descripcion: string }
export interface PurchaseTitleContext {
  title?: string;
  category?: string;
  items: TitleItem[];
  previousItems?: TitleItem[];
}

const plain = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const clean = (value: string) => value.replace(/\s+/g, ' ').trim();
const prefix = /^(?:adquisici[oó]n|compra|provisi[oó]n|suministro|dotaci[oó]n|contrataci[oó]n)\s+(?:de\s+|del\s+)?/i;
const measurement = /\b(?:calibrador(?:es)?|micrometro(?:s)?|multimetro(?:s)?|megohmetro(?:s)?|telurometro(?:s)?|luxometro(?:s)?|termometro(?:s)?|anemometro(?:s)?|torquimetro(?:s)?|sonometro(?:s)?|alcoholimetro(?:s)?|medidor(?:es)?|pinzas? amperimetricas?|detector(?:es)? de (?:tension|voltaje)|(?:equipos?|instrumentos?) de medicion)\b/;
const protective = /\b(?:guantes?|arnes(?:es)?|cascos?|barbiquejos?|amortiguador(?:es)?|lentes? de seguridad|gafas? de seguridad|botin(?:es)?|botas? de seguridad|respirador(?:es)?|mascarillas?|proteccion personal)\b/;

/** Detect the former automatic fallback without treating a descriptive process title as generic. */
export function isGenericPurchaseTitle(value: string): boolean {
  const wording = plain(clean(value)).replace(/[.\s]+$/, '');
  if (!wording || /^\[pendiente[^\]]*\]$/.test(wording)) return true;
  return /^(?:(?:adquisicion|compra|provision|suministro|dotacion|contratacion)(?: de| del)?\s+)?(?:(?:los|las)\s+)?(?:bienes|servicios|productos|items|equipos|materiales)(?:\s+(?:detallados|descritos|requeridos|solicitados|indicados|especificados)(?:\s+(?:en (?:el presente|este|el) documento|en las especificaciones tecnicas|en esta compra))?)?$/.test(wording);
}

function currentItems(context: PurchaseTitleContext): TitleItem[] {
  return context.items.filter(item => clean(item.descripcion) && !/^\[PENDIENTE[^\]]*\]$/i.test(item.descripcion.trim()));
}

function obsoleteTitle(value: string, context: PurchaseTitleContext): boolean {
  const items = currentItems(context);
  if (!items.length) return false;
  const wording = plain(value);
  // An unfamiliar product name does not disprove an existing family title. Only
  // replace it when every current row clearly identifies a different family.
  const measurementTitle = /\b(?:equipos?|instrumentos?) de medicion\b/.test(wording);
  const protectiveTitle = /\b(?:equipos? de )?proteccion personal\b/.test(wording);
  if (measurementTitle && !protectiveTitle) return items.every(item => protective.test(plain(item.descripcion)));
  if (protectiveTitle && !measurementTitle) return items.every(item => measurement.test(plain(item.descripcion)));
  if (measurementTitle && protectiveTitle) return false;
  if (obsoletePurchaseMentions(value, context.previousItems || [], items).length) return true;
  // An umbrella noun can be a valid user-defined scope (for example, materials
  // for a named project); absence of that noun from item rows is not evidence of
  // an obsolete purchase. Concrete product titles are checked against the rows.
  const scope = plain(clean(value).replace(prefix, '')).replace(/^(?:el|la|los|las)\s+/, '');
  if (/^(?:equipos?|instrumentos?|materiales|herramientas|servicios?|mobiliario|suministros?|repuestos?)\b/.test(scope)) return false;
  return obsoletePurchaseMentions(value, [{ descripcion: value }], items).length > 0;
}

function itemName(description: string, limit: number): string {
  let value = clean(description).replace(prefix, '').replace(/[.;\s]+$/, '');
  if (/^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]/.test(value)) value = value.charAt(0).toLowerCase() + value.slice(1);
  if (value.length <= limit) return value;
  const portion = value.slice(0, limit - 1);
  const boundary = portion.lastIndexOf(' ');
  return `${portion.slice(0, boundary > limit / 2 ? boundary : portion.length).replace(/[,;:\s]+$/, '')}…`;
}

/** Prefer the current specific title, otherwise name the actual goods or services. */
export function currentPurchaseTitle(context: PurchaseTitleContext): string {
  const title = clean(context.title || '');
  const items = currentItems(context);
  if (title && !isGenericPurchaseTitle(title) && !obsoleteTitle(title, context)) return title;
  if (!items.length) return title || '[PENDIENTE]';
  const services = plain(context.category || '') === 'servicios';
  const action = services ? 'Contratación de ' : 'Adquisición de ';
  // A single product should retain its identity; use a shared family only for a
  // collection of products whose descriptions all support that family.
  if (!services && items.length > 1) {
    if (items.every(item => measurement.test(plain(item.descripcion)))) return action + 'instrumentos de medición';
    if (items.every(item => protective.test(plain(item.descripcion)))) return action + 'equipos de protección personal';
  }
  const names = Array.from(new Set(items.map(item => itemName(item.descripcion, items.length === 1 ? 150 : 55))));
  const selected = names.slice(0, 3);
  const remaining = names.length - selected.length;
  const summary = remaining
    ? `${selected.join(', ')} y ${remaining === 1 ? 'otro ítem' : `otros ${remaining} ítems`}`
    : selected.length > 1 ? `${selected.slice(0, -1).join(', ')} y ${selected[selected.length - 1]}` : selected[0];
  return action + summary;
}

/** Automatic repairs must never replace a title explicitly edited in the document. */
export function repairAutomaticPurchaseTitle(value: string, context: PurchaseTitleContext, edited = false): string {
  if (edited || (!isGenericPurchaseTitle(value) && !obsoleteTitle(value, context))) return value;
  return currentPurchaseTitle(context);
}
