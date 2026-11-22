import type { Carpeta } from '@/types';

export const PURCHASE_REQUEST_FOLDER = 5;
export const TECHNICAL_JUSTIFICATION_MODEL = 9;
export const PURCHASE_ASSISTANT_MODELS = [1, 2, 4, 3, PURCHASE_REQUEST_FOLDER, TECHNICAL_JUSTIFICATION_MODEL];

export function storageFolderNumber(modelNumber: number): number {
  return modelNumber === TECHNICAL_JUSTIFICATION_MODEL ? PURCHASE_REQUEST_FOLDER : modelNumber;
}

export function displayFolderNumber(number: number): number {
  if (number === 3) return 4;
  if (number === 4) return 3;
  return storageFolderNumber(number);
}

// Keep the old storage keys and exchange only their positions in the workflow.
// The same swap converts the displayed order back to the order stored in a snapshot.
export function exchangeQuotationAndComparison(folders: readonly Carpeta[]): Carpeta[] {
  const ordered = [...folders];
  const comparison = ordered.findIndex(folder => folder.numero === 3);
  const quotation = ordered.findIndex(folder => folder.numero === 4);
  if (comparison >= 0 && quotation >= 0) {
    [ordered[comparison], ordered[quotation]] = [ordered[quotation], ordered[comparison]];
  }
  return ordered;
}

export function workflowFolders(folders: readonly Carpeta[]): Carpeta[] {
  return exchangeQuotationAndComparison([...folders].sort((a, b) => (a.orden || a.numero) - (b.orden || b.numero)));
}
