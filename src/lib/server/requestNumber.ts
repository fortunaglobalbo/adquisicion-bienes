import type { Adquisicion } from '@/types';
import { database } from './database';

export async function reserveS1Number(adquisicion: Adquisicion): Promise<string> {
  // Locally prepared documents can still render without a remote reservation.
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(adquisicion.id)) return '';
  const { data, error } = await database().rpc('reservar_correlativo_s1', { p_adquisicion_id: adquisicion.id });
  if (error) throw new Error('No se pudo obtener el correlativo de la solicitud.');
  return typeof data === 'string' ? data.trim() : '';
}
