import type { Adquisicion } from '@/types';

// Creation determines list order; editing an older dossier must not move it to the top.
export function adquisicionesRecientes(items: Adquisicion[]): Adquisicion[] {
  const date = (item: Adquisicion) => {
    const created = Date.parse(item.fecha_creacion || '');
    return Number.isFinite(created) ? created : Date.parse(item.fecha_inicio || '') || 0;
  };
  return items.filter(Boolean).slice().sort((a,b) => date(b) - date(a));
}
