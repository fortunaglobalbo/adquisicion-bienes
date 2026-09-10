// Roles are scoped to each institutional form; vendor recipients are purchase-specific.
export const officialPeopleKeys: Record<number, string[]> = {
  1: ['elaborado', 'revisado', 'aprobado'],
  2: ['solicitante', 'cargo', 'area', 'responsable_recepcion'],
  3: ['solicitante', 'destinatario'],
  4: ['remitente'],
  5: ['destinatario', 'via', 'solicitante'],
  6: [],
  7: ['destinatario', 'via', 'solicitante'],
};
export function officialPeople(number: number, fields: Record<string, string> = {}) {
  return Object.fromEntries((officialPeopleKeys[number] || []).filter(key => typeof fields[key] === 'string' && fields[key].trim() && !/PENDIENTE|_{3,}/i.test(fields[key])).map(key => [key, fields[key].trim()]));
}
