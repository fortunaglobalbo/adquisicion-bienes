// Roles are scoped to each institutional form; vendor recipients are purchase-specific.
export const officialPeopleKeys: Record<number, string[]> = {
  1: ['elaborado', 'revisado', 'aprobado'],
  2: ['solicitante', 'cargo', 'area', 'responsable_recepcion'],
  3: ['destinatario', 'via', 'solicitante'],
  4: ['remitente'],
  5: ['destinatario', 'via', 'solicitante'],
  6: ['destinatario', 'via', 'solicitante'],
  7: ['destinatario', 'via', 'solicitante'],
  9: ['destinatario', 'via', 'solicitante'],
};
export function isInstitutionalRole(value:string) {
  return /^(?:cargo\b|gerent|subgerent|gerencia|superintend|supervis|responsable\b|director|dirección|direccion|jef[ae]|jefatura|apoyo\b|autoridad\b|unidad\b|[aá]rea\b|departamento\b|coordinador|analista\b|asistente\b)/i.test(value.trim());
}
export function officialPeople(number: number, fields: Record<string, string> = {}) {
  return Object.fromEntries((officialPeopleKeys[number] || []).filter(key => typeof fields[key] === 'string' && fields[key].trim() && !/PENDIENTE|_{3,}/i.test(fields[key])).map(key => [key, fields[key].trim()]));
}
