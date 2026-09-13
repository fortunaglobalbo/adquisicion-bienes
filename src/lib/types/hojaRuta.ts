export interface HojaRutaPase {
  pase: number;
  destino: string;
  fecha: string;
  hora: string;
  firma: string;
}

export type HojaRutaEstado =
  | 'En Circulación'
  | 'En Evaluación'
  | 'Evaluado'
  | 'Adjudicado'
  | 'Desierto';

export type HojaRutaArea =
  | 'DISTRIBUCION'
  | 'COMERCIAL'
  | 'ADMINISTRACION'
  | 'TICs'
  | 'SEGURIDAD INDUSTRIAL'
  | 'SISTEMA RURAL';

export type HojaRutaCategoria = 'CAT 1' | 'CAT 2';

export type HojaRutaTipoDocumento =
  | 'SOLICITUD/TDR'
  | 'ADQUISICIONES'
  | 'SERVICIOS'
  | 'CONSULTORIAS';

export interface HojaRuta {
  id: string;
  cite_correlativo: string;
  secuencia_numero: number;
  fecha_ingreso: string;
  hora_ingreso?: string;
  tipo_documento: string;
  institucion_area_origen: string;
  categoria: string;
  asunto_descripcion: string;
  ubicacion_actual: string;
  estado_actual: HojaRutaEstado;
  fecha_adjudicacion?: string | null;
  enviado: boolean;
  pases: HojaRutaPase[];
  observaciones?: string;
  creado_por?: string;
  fecha_creacion?: string;
  fecha_actualizacion?: string;
}

export interface HojaRutaFormData {
  cite_correlativo?: string;
  fecha_ingreso: string;
  hora_ingreso: string;
  tipo_documento: string;
  institucion_area_origen: string;
  categoria: string;
  asunto_descripcion: string;
  ubicacion_actual: string;
  estado_actual: HojaRutaEstado;
  pases?: HojaRutaPase[];
}
