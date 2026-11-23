import type { Carpeta } from '@/types';
import { fixedDocumentBelongsToModel } from '../docx/fixedModels';

export const PURCHASE_REQUEST_FOLDER = 5;
export const TECHNICAL_JUSTIFICATION_MODEL = 9;
export const PURCHASE_ASSISTANT_MODELS = [1, 2, TECHNICAL_JUSTIFICATION_MODEL, 4, 3, PURCHASE_REQUEST_FOLDER];

export function displayFolderNumber(number: number): number {
  return ({3:5,5:6,6:7,7:8,8:9,9:3} as Record<number,number>)[number] ?? number;
}

export function technicalFolder(acquisitionId: string): Carpeta {
  return {
    id: `carpeta-${acquisitionId}-informe-tecnico`, adquisicion_id: acquisitionId,
    numero: TECHNICAL_JUSTIFICATION_MODEL, nombre: 'Informe técnico', tipo_generacion: 'IA',
    estado: 'Pendiente', descripcion: 'Justificación técnica previa a la solicitud de cotizaciones.',
    documentos: [], orden: 3,
  };
}

export function separateTechnicalFolder(folders: readonly Carpeta[]): Carpeta[] {
  const first = folders[0];
  if (!first) return [];
  const technical = technicalFolder(first.adquisicion_id);
  if (folders.some(folder => folder.id === technical.id)) return [...folders];
  const ordered = [...folders];
  ordered.sort((a,b)=>(a.orden || a.numero)-(b.orden || b.numero));
  const comparison = ordered.findIndex(folder => folder.numero === 3);
  const quotation = ordered.findIndex(folder => folder.numero === 4);
  if (comparison >= 0 && quotation >= 0) {
    [ordered[comparison], ordered[quotation]] = [ordered[quotation], ordered[comparison]];
  }
  for (let index=0;index<ordered.length;index++) {
    const folder=ordered[index];
    if (folder.numero >= TECHNICAL_JUSTIFICATION_MODEL) ordered[index]={...folder,numero:folder.numero+1};
  }
  const purchase = ordered.findIndex(folder=>folder.numero === PURCHASE_REQUEST_FOLDER);
  if (purchase !== -1) {
    const folder = ordered[purchase];
    const previous = folder.documentos || [];
    const documents = previous.filter(document=>fixedDocumentBelongsToModel(TECHNICAL_JUSTIFICATION_MODEL,document));
    technical.documentos = documents.map(document=>({...document,carpeta_id:technical.id}));
    if (documents.length) technical.estado = documents.some(document=>document.estado==='Borrador') ? 'En Proceso' : 'Completado';
    ordered[purchase] = {...folder,documentos:previous.filter(document=>!documents.includes(document))};
  }
  const firstQuote = ordered.findIndex(folder=>folder.numero === 4);
  ordered.splice(firstQuote < 0 ? Math.min(2,ordered.length) : firstQuote,0,technical);
  return ordered.map((folder,index)=>({...folder,orden:index+1}));
}

export function workflowFolders(folders: readonly Carpeta[]): Carpeta[] {
  return separateTechnicalFolder(folders).sort((a, b) => (a.orden || displayFolderNumber(a.numero)) - (b.orden || displayFolderNumber(b.numero)));
}
