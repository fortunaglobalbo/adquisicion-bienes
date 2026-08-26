/**
 * Utilidades para detección y formato en tiempo real de fecha y mes en español
 */

const MESES_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

/**
 * Devuelve el Mes y Año actual dinámico (ej. "Agosto - 2026")
 */
export function getMesAnioActual(): string {
  const d = new Date();
  return `${MESES_ES[d.getMonth()]} - ${d.getFullYear()}`;
}

/**
 * Devuelve la fecha completa formal en español (ej. "Oruro, 26 de agosto de 2026")
 */
export function getFechaTextoActual(ciudad: string = "Oruro"): string {
  const d = new Date();
  const dia = d.getDate();
  const mes = MESES_ES[d.getMonth()].toLowerCase();
  const anio = d.getFullYear();
  return `${ciudad}, ${dia} de ${mes} de ${anio}`;
}

/**
 * Devuelve la fecha corta numérica (ej. "26/08/2026")
 */
export function getFechaCortaActual(): string {
  const d = new Date();
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const anio = d.getFullYear();
  return `${dia}/${mes}/${anio}`;
}
