export type CategoriaAdquisicion = 'Bienes' | 'Servicios' | 'Obras' | 'Consultorías';

export type EstadoAdquisicion = 
  | 'Iniciado' 
  | 'Generación IA' 
  | 'Revisión y Firmas' 
  | 'Concluido' 
  | 'Cancelado';

export type TipoGeneracionCarpeta = 'IA' | 'MANUAL';

export type EstadoCarpeta = 'Pendiente' | 'En Proceso' | 'Completado' | 'Aprobado';

export type TipoDocumento = 
  | 'GENERADO_DOCX' 
  | 'SUBIDO_PDF' 
  | 'SUBIDO_IMAGEN' 
  | 'SUBIDO_OTRO';

export type EstadoDocumento = 'Borrador' | 'Final' | 'Firmado' | 'Archivado';

export type RolParticipante = 
  | 'Solicitante' 
  | 'Supervisor' 
  | 'Gerente' 
  | 'Responsable Contrataciones';

export interface FichaTecnicaItem {
  uso?: string;
  normaCertificacion?: string;
  material?: string;
  color?: string;
  aceptacionLote?: string;
  categoriaItem?: string;
  caracteristicasDetalle?: string[];
  dimensiones?: string;
  capacidadCorte?: string;
  pesoAprox?: string;
  imagenUrl?: string;
}

export interface ItemAdquisicion {
  id: string;
  item: number;
  codigoArticulo?: string;
  descripcion: string;
  unidad: string;
  cantidad: number;
  precioUnitarioEstimado: number;
  precioTotalEstimado: number;
  // Campos adaptables para diferentes tipos de tablas (Bienes simples o Salud)
  especificacionMinima?: string;
  propuestoOferente?: string;
  caracteristicasTecnicas?: string;
  fichaTecnica?: FichaTecnicaItem;
}

export type TipoTablaTDR = "BIENES_SIMPLE" | "SALUD_OCUPACIONAL" | "FICHAS_DINAMICAS";

export interface Adquisicion {
  id: string;
  codigo: string; // ej. ENDE-D-2024-001
  titulo_proceso: string;
  categoria: CategoriaAdquisicion;
  modalidad: string; // 'Menor Precio (Art. 31)' o 'SBC'
  partida_presupuestaria: string;
  estado: EstadoAdquisicion;
  tipo_tabla_tdr?: TipoTablaTDR;
  prevision_presupuesto: number; // en Bs
  moneda: string; // 'BOB'
  fecha_inicio: string;
  fecha_limite?: string;
  unidad_solicitante: string;
  responsable_proceso: string;
  creado_por: string;
  actualizado_por?: string;
  fecha_creacion: string;
  fecha_actualizacion: string;
  items: ItemAdquisicion[];
  plazo_entrega_dias: number;
  multa_diaria_porcentaje: number; // 0.25
  lugar_entrega: string;

  // Campos específicos de la Plantilla Institucional (PDF ENDE Deoruro)
  revision?: string; // ej. "Rev. N° 1"
  mes_anio_documento?: string; // ej. "Mayo - 2026"
  elaborado_por?: string; // ej. "Heydi Canaviri Padilla"
  elaborado_cargo?: string;
  revisado_por?: string; // ej. "Heydi Canaviri Padilla"
  revisado_cargo?: string;
  aprobado_por?: string; // ej. "Lic. Raul Alberto Torrico Gomez"
  aprobado_cargo?: string;
  antecedentes_texto?: string;
  justificacion_texto?: string;
  calidad_texto?: string;
  metodo_seleccion_texto?: string;
  vigencia_propuesta_texto?: string;
  forma_pago_texto?: string;

  // Campos específicos de la Carpeta 5 (Solicitud de Inicio de Proceso de Compra - Formato Oficial)
  solicitud_inicio_numero?: string; // ej. "047/2026"
  solicitud_inicio_fecha?: string; // ej. "Oruro, 26 de mayo de 2026"
  solicitud_inicio_a_nombre?: string; // ej. "Lic. Vicente Paul Vega Ramirez"
  solicitud_inicio_a_cargo?: string; // ej. "RESPONSABLE DE CONTRATACIONES"
  solicitud_inicio_via_nombre?: string; // ej. "Lic. Raúl Alberto Torrico Gomez"
  solicitud_inicio_via_cargo?: string; // ej. "GERENTE GENERAL"
  solicitud_inicio_de_nombre?: string; // ej. "Ing. Heydi Dunya Canaviri Padilla"
  solicitud_inicio_de_cargo?: string; // ej. "SUPERVISOR DE SEGURIDAD INDUSTRIAL"
  solicitud_inicio_objeto?: string;
  solicitud_inicio_parrafo1?: string;
  solicitud_inicio_parrafo2?: string;
  solicitud_inicio_adjuntos?: string[];

  // Campos específicos de la Carpeta 6 (Formulario S2-N014 - Solicitud de Cotización)
  form_s2_fecha_solicitud?: string; // ej. "19/06/2026"
  form_s2_senores?: string; // ej. "ARIOL IMPORT"
  form_s2_tiempo_entrega?: string; // ej. "30 días calendario"
  form_s2_validez_oferta?: string; // ej. "30 días calendario"
  form_s2_observaciones?: string; // ej. "SE ADJUNTA ESPECIFICACIONES TECNICAS"
  form_s2_nota_adicional?: string; // ej. "ADJUNTAR FOTOCOPIA SIMPLE DE SU RNC - NIT"
}

export interface Carpeta {
  id: string;
  adquisicion_id: string;
  numero: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  nombre: string;
  tipo_generacion: TipoGeneracionCarpeta;
  estado: EstadoCarpeta;
  fecha_proceso?: string;
  descripcion: string;
  documentos: Documento[];
}

export interface Documento {
  id: string;
  carpeta_id: string;
  adquisicion_id: string;
  tipo: TipoDocumento;
  nombre_original: string;
  ruta_storage?: string;
  mime: string;
  tamano: number;
  estado: EstadoDocumento;
  version: number;
  metadata?: Record<string, any>;
  contenido_texto?: string;
  creado_por: string;
  fecha_creacion: string;
}

export interface CampoExtraido {
  id: string;
  documento_id: string;
  adquisicion_id: string;
  clave: string;
  valor: string;
  confianza: number;
  fecha_extraccion: string;
}

export interface Firma {
  id: string;
  adquisicion_id: string;
  cargo: string;
  nombre: string;
  rol: RolParticipante;
  orden: number;
  firmado: boolean;
  fecha_firma?: string;
}

export interface LogProceso {
  id: string;
  adquisicion_id: string;
  fecha: string;
  descripcion: string;
  usuario: string;
  accion: 'CREAR' | 'SUBIR' | 'GENERAR_IA' | 'FIRMAR' | 'CONCLUIR' | 'MODIFICAR';
}

export type TipoLayoutSeccion = 
  | "PORTADA_COVER"
  | "INDICE_LIST"
  | "FICHA_PRODUCT"
  | "TABLA_PRECIOS"
  | "FORMULARIO_NOTA"
  | "CLAUSULAS_LEGALES"
  | "FIRMAS_SELLOS";

export interface SeccionPlantilla {
  id: string;
  tipo: TipoLayoutSeccion;
  titulo: string;
  subtitulo?: string;
  activo: boolean;
  orden: number;
  descripcion: string;
}

export interface FirmanteDefault {
  id: string;
  rol: "ELABORADO" | "REVISADO" | "APROBADO" | "VIA" | "DE" | "A";
  etiqueta: string;
  nombreDefault: string;
  cargoDefault: string;
}

export interface ClausulaDefault {
  id: string;
  numero: number;
  titulo: string;
  contenido: string;
  activo: boolean;
}

export interface SubIndicePlantilla {
  id: string;
  codigo: string; // ej "1.1", "1.2"
  titulo: string;
  descripcion_ia?: string;
}

export interface IndiceSeccionPlantilla {
  id: string;
  numero: number;
  titulo: string;
  descripcion_ia?: string;
  subindices?: SubIndicePlantilla[];
}

export interface CampoMoldeLibre {
  id: string;
  nombre: string;
  valorEjemplo: string;
}

export interface Plantilla {
  id: string;
  fk_carpeta: number;
  nombre: string;
  ruta_archivo?: string;
  version: string;
  descripcion: string;
  fecha_creacion: string;
  logo_url?: string;
  incluir_foto_item?: boolean;
  campos_molde_libres?: CampoMoldeLibre[];
  campos_ficha_modelo?: string[];
  indice_secciones?: IndiceSeccionPlantilla[];
  secciones?: SeccionPlantilla[];
  firmantes_default?: FirmanteDefault[];
  clausulas_default?: ClausulaDefault[];
  datos_completos?: Record<string, any>;
  secciones_prompt?: any[];
  incluir_firma_portada?: boolean;
  firma_nombre?: string;
  firma_cargo?: string;
  firma_entidad?: string;
  firma_empresa?: string;
}

