import type { Adquisicion, EstadoAdquisicion } from '@/types';

export const ADQUISICION_ESTADO_MAX = 50;
const workflowStates: EstadoAdquisicion[] = ['Iniciado','Generación IA','Revisión y Firmas','Concluido','Cancelado'];
export const estadoAdquisicion = (adq: Pick<Adquisicion,'estado'|'estado_personalizado'>): string => adq.estado_personalizado?.trim() || adq.estado;
const normalized = (text:string) => text.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export const estadoEs = (adq: Pick<Adquisicion,'estado'|'estado_personalizado'>, expected:EstadoAdquisicion) => normalized(estadoAdquisicion(adq)) === normalized(expected);

export function cambiosEstadoAdquisicion(text:string): Partial<Adquisicion> {
  const value=text.trim();
  if(!value || value.length>ADQUISICION_ESTADO_MAX) throw Error(`Escribe un estado de hasta ${ADQUISICION_ESTADO_MAX} caracteres.`);
  const workflow=workflowStates.find(state=>normalized(state)===normalized(value));
  // The SQL index has a legacy enum check. Custom text lives in the existing JSONB snapshot,
  // which is authoritative on reload. Only valid workflow values are mirrored into that index.
  return {estado_personalizado:value,...(workflow?{estado:workflow}:{})};
}
