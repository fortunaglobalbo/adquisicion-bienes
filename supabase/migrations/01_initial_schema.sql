-- Schema SQL para ENDE Deoruro S.A. - Sistema de Gestión de Adquisiciones

-- 1. EXTENSIONES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLA ADQUISICIONES (Expediente Maestro)
CREATE TABLE IF NOT EXISTS adquisiciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo VARCHAR(50) NOT NULL UNIQUE,
    titulo_proceso TEXT NOT NULL,
    categoria VARCHAR(50) NOT NULL CHECK (categoria IN ('Bienes', 'Servicios', 'Obras', 'Consultorías')),
    modalidad VARCHAR(100) DEFAULT 'Menor Precio (Art. 31)',
    partida_presupuestaria VARCHAR(50),
    estado VARCHAR(50) NOT NULL DEFAULT 'Iniciado' CHECK (estado IN ('Iniciado', 'Generación IA', 'Revisión y Firmas', 'Concluido', 'Cancelado')),
    prevision_presupuesto NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    moneda VARCHAR(10) DEFAULT 'BOB',
    fecha_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_limite DATE,
    unidad_solicitante VARCHAR(150) DEFAULT 'Departamento Técnico de Mantenimiento',
    responsable_proceso VARCHAR(150),
    creado_por VARCHAR(100) DEFAULT 'admin@ende-deoruro.bo',
    actualizado_por VARCHAR(100),
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. TABLA CARPETAS (Las 8 carpetas fijas por proceso)
CREATE TABLE IF NOT EXISTS carpetas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    adquisicion_id UUID NOT NULL REFERENCES adquisiciones(id) ON DELETE CASCADE,
    numero INTEGER NOT NULL CHECK (numero BETWEEN 1 AND 8),
    nombre VARCHAR(150) NOT NULL,
    tipo_generacion VARCHAR(20) NOT NULL CHECK (tipo_generacion IN ('IA', 'MANUAL')),
    estado VARCHAR(50) NOT NULL DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'En Proceso', 'Completado', 'Aprobado')),
    fecha_proceso TIMESTAMP WITH TIME ZONE,
    descripcion TEXT,
    UNIQUE (adquisicion_id, numero)
);

-- 4. TABLA DOCUMENTOS (Archivos generados o subidos)
CREATE TABLE IF NOT EXISTS documentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    adquisicion_id UUID NOT NULL REFERENCES adquisiciones(id) ON DELETE CASCADE,
    carpeta_id UUID NOT NULL REFERENCES carpetas(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('GENERADO_DOCX', 'SUBIDO_PDF', 'SUBIDO_IMAGEN', 'SUBIDO_OTRO')),
    nombre_original TEXT NOT NULL,
    ruta_storage TEXT,
    mime VARCHAR(100),
    tamano BIGINT DEFAULT 0,
    estado VARCHAR(50) DEFAULT 'Borrador' CHECK (estado IN ('Borrador', 'Final', 'Firmado', 'Archivado')),
    version INTEGER DEFAULT 1,
    metadata JSONB DEFAULT '{}'::jsonb,
    creado_por VARCHAR(100) DEFAULT 'admin@ende-deoruro.bo',
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. TABLA CAMPOS EXTRAIDOS (Extracción OCR/IA de formularios S1, S2, etc.)
CREATE TABLE IF NOT EXISTS campos_extraidos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    documento_id UUID NOT NULL REFERENCES documentos(id) ON DELETE CASCADE,
    adquisicion_id UUID NOT NULL REFERENCES adquisiciones(id) ON DELETE CASCADE,
    clave VARCHAR(100) NOT NULL,
    valor TEXT NOT NULL,
    confianza NUMERIC(5, 2) DEFAULT 1.00,
    fecha_extraccion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. TABLA FIRMAS / PARTICIPANTES
CREATE TABLE IF NOT EXISTS firmas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    adquisicion_id UUID NOT NULL REFERENCES adquisiciones(id) ON DELETE CASCADE,
    cargo VARCHAR(150) NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    rol VARCHAR(100) NOT NULL CHECK (rol IN ('Solicitante', 'Supervisor', 'Gerente', 'Responsable Contrataciones')),
    orden INTEGER NOT NULL DEFAULT 1,
    firmado BOOLEAN DEFAULT FALSE,
    fecha_firma TIMESTAMP WITH TIME ZONE
);

-- 7. TABLA LOGS PROCESO (Auditoría)
CREATE TABLE IF NOT EXISTS logs_proceso (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    adquisicion_id UUID NOT NULL REFERENCES adquisiciones(id) ON DELETE CASCADE,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    descripcion TEXT NOT NULL,
    usuario VARCHAR(100) NOT NULL DEFAULT 'Sistema ENDE',
    accion VARCHAR(50) DEFAULT 'INFO'
);

-- 8. TABLA PLANTILLAS
CREATE TABLE IF NOT EXISTS plantillas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fk_carpeta INTEGER NOT NULL CHECK (fk_carpeta BETWEEN 1 AND 8),
    nombre VARCHAR(150) NOT NULL,
    ruta_archivo TEXT,
    version VARCHAR(20) DEFAULT '1.0',
    descripcion TEXT,
    contenido_plantilla JSONB DEFAULT '{}'::jsonb,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. INSERTAR PLANTILLAS OFICIALES BASE
INSERT INTO plantillas (fk_carpeta, nombre, version, descripcion) VALUES
(1, 'Plantilla Oficial TDR - Especificaciones Técnicas', '1.0', 'Formato oficial ENDE Deoruro para Términos de Referencia de Bienes y Servicios'),
(2, 'Formulario S1-N014 - Solicitud de Adquisición', '1.0', 'Formato oficial de solicitud de compra interna y asignación presupuestaria'),
(3, 'Cuadro Comparativo y de Justificación Técnica', '1.0', 'Formato para evaluación de necesidad y justificación de compra'),
(4, 'Pliego de Cotización a Empresas Proveedoras', '1.0', 'Registro de cotizaciones recibidas con verificación de NIT'),
(5, 'Solicitud de Inicio de Proceso de Contratación', '1.0', 'Documento formal de apertura de contratación bajo Art. 31 SBC'),
(6, 'Formulario S2-N014 - Solicitud de Cotización Formal', '1.0', 'Invitación y condiciones técnicas enviadas a proponentes'),
(7, 'Informe de Conformidad y Recepción Técnica', '1.0', 'Certificación de cumplimiento de especificaciones y entrega a almacén'),
(8, 'Orden de Compra / Contrato Administrativo', '1.0', 'Documento final de adjudicación y formalización contractual')
ON CONFLICT DO NOTHING;

-- 10. STORAGE BUCKETS (Crear en Supabase Dashboard o Storage API)
-- 'expedientes-docs': Bucket para documentos subidos y generados
-- 'plantillas-oficiales': Bucket para plantillas .docx
