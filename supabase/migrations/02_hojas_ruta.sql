-- Migración 02: Módulo Independiente de Hoja de Ruta y Control de Correspondencia
-- Sistema ENDE Deoruro S.A.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABLA HOJAS DE RUTA
CREATE TABLE IF NOT EXISTS hojas_ruta (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cite_correlativo VARCHAR(50) NOT NULL UNIQUE,
    secuencia_numero INTEGER NOT NULL DEFAULT 1,
    fecha_ingreso DATE NOT NULL DEFAULT CURRENT_DATE,
    hora_ingreso TIME DEFAULT CURRENT_TIME,
    tipo_documento VARCHAR(100) NOT NULL DEFAULT 'SOLICITUD/TDR',
    institucion_area_origen VARCHAR(150) NOT NULL DEFAULT 'DISTRIBUCION',
    categoria VARCHAR(50) NOT NULL DEFAULT 'CAT 1',
    asunto_descripcion TEXT NOT NULL,
    ubicacion_actual VARCHAR(150) NOT NULL DEFAULT 'DISTRIBUCION',
    estado_actual VARCHAR(50) NOT NULL DEFAULT 'En Circulación',
    fecha_adjudicacion TIMESTAMP WITH TIME ZONE,
    enviado BOOLEAN NOT NULL DEFAULT TRUE,
    pases JSONB DEFAULT '[]'::jsonb,
    observaciones TEXT,
    creado_por VARCHAR(100) DEFAULT 'admin@ende-deoruro.bo',
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. ÍNDICES DE BÚSQUEDA Y RENDIMIENTO
CREATE INDEX IF NOT EXISTS idx_hojas_ruta_cite ON hojas_ruta (cite_correlativo);
CREATE INDEX IF NOT EXISTS idx_hojas_ruta_estado ON hojas_ruta (estado_actual);
CREATE INDEX IF NOT EXISTS idx_hojas_ruta_fecha ON hojas_ruta (fecha_ingreso DESC);

-- 3. TRIGGER AUTOMÁTICO PARA SELLAR FECHA DE ADJUDICACIÓN
CREATE OR REPLACE FUNCTION trigger_set_fecha_adjudicacion()
RETURNS TRIGGER AS $$
BEGIN
    -- Sellar fecha_adjudicacion si el estado pasa a Adjudicado
    IF NEW.estado_actual = 'Adjudicado' AND (OLD.estado_actual IS DISTINCT FROM 'Adjudicado' OR OLD.fecha_adjudicacion IS NULL) THEN
        NEW.fecha_adjudicacion = CURRENT_TIMESTAMP;
    END IF;

    -- Si se cambia de Adjudicado a otro estado
    IF NEW.estado_actual <> 'Adjudicado' AND OLD.estado_actual = 'Adjudicado' THEN
        NEW.fecha_adjudicacion = NULL;
    END IF;

    NEW.fecha_actualizacion = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_hojas_ruta_adjudicacion ON hojas_ruta;
CREATE TRIGGER trg_hojas_ruta_adjudicacion
BEFORE INSERT OR UPDATE ON hojas_ruta
FOR EACH ROW
EXECUTE FUNCTION trigger_set_fecha_adjudicacion();

-- 4. REGISTRO DE EJEMPLO BASADO EN EL FORMATO OFICIAL
INSERT INTO hojas_ruta (
    cite_correlativo,
    secuencia_numero,
    fecha_ingreso,
    tipo_documento,
    institucion_area_origen,
    categoria,
    asunto_descripcion,
    ubicacion_actual,
    estado_actual,
    enviado,
    pases
) VALUES (
    'ADQ - 08-09-01',
    1,
    '2026-09-08',
    'SOLICITUD/TDR',
    'DISTRIBUCION',
    'CAT 1',
    'SERVICIO DE INSTALACION DE 6 RECONECTADORES DE MEDIA TENCION',
    'DISTRIBUCION',
    'En Circulación',
    TRUE,
    '[
        {"pase": 1, "destino": "DISTRIBUCION", "fecha": "2026-09-08", "hora": "08:30", "firma": "Ing. Pérez"},
        {"pase": 2, "destino": "COMERCIAL", "fecha": "", "hora": "", "firma": ""},
        {"pase": 3, "destino": "", "fecha": "", "hora": "", "firma": ""},
        {"pase": 4, "destino": "", "fecha": "", "hora": "", "firma": ""},
        {"pase": 5, "destino": "", "fecha": "", "hora": "", "firma": ""},
        {"pase": 6, "destino": "", "fecha": "", "hora": "", "firma": ""},
        {"pase": 7, "destino": "", "fecha": "", "hora": "", "firma": ""}
    ]'::jsonb
) ON CONFLICT (cite_correlativo) DO NOTHING;
