-- Assign an annual S1 number once per expediente, including under concurrent requests.
CREATE TABLE IF NOT EXISTS public.s1_correlativos (
    adquisicion_id uuid PRIMARY KEY,
    gestion integer NOT NULL,
    correlativo integer NOT NULL CHECK (correlativo > 0),
    UNIQUE (gestion, correlativo)
);

-- Retain reservations even if an expediente is deleted, so its number is never reissued.
ALTER TABLE public.s1_correlativos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.s1_correlativos FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.s1_correlativos TO service_role;

CREATE OR REPLACE FUNCTION public.reservar_correlativo_s1(p_adquisicion_id uuid)
RETURNS text
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_gestion integer;
    v_correlativo integer;
    v_existente text;
BEGIN
    SELECT COALESCE(
        substring(a.codigo FROM '^ENDE-D-([0-9]{4})-')::integer,
        extract(year FROM a.fecha_inicio)::integer,
        extract(year FROM CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::integer
    )
    INTO v_gestion
    FROM public.adquisiciones a
    WHERE a.id = p_adquisicion_id
    FOR SHARE;
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    PERFORM pg_catalog.pg_advisory_xact_lock(605112, v_gestion);

    SELECT c.correlativo::text || '/' || c.gestion::text INTO v_existente
    FROM public.s1_correlativos c
    WHERE c.adquisicion_id = p_adquisicion_id;
    IF FOUND THEN
        RETURN v_existente;
    END IF;

    -- Keep saved numbers and start beyond historic requests in the same year.
    -- Include the old JSON snapshots and ordinary S1 documents. Exclude the former
    -- eight-digit date-like identifier, which was displayed as a request by mistake.
    WITH historicos AS (
        SELECT d.adquisicion_id, valor.numero
        FROM public.documentos d
        CROSS JOIN LATERAL (VALUES
            (d.metadata #>> '{snapshot,adquisicion,solicitud_numero}'),
            (d.metadata #>> '{snapshot,adquisicion,borradores_ia,2,draft,fields,numero}')
        ) AS valor(numero)
        WHERE d.metadata ->> 'kind' = 'ende-expediente-state-v1'
        UNION ALL
        SELECT d.adquisicion_id, doc.value #>> '{metadata,fixedDraft,fields,numero}'
        FROM public.documentos d
        CROSS JOIN LATERAL jsonb_array_elements(
            CASE WHEN jsonb_typeof(d.metadata #> '{snapshot,carpetas}') = 'array'
                THEN d.metadata #> '{snapshot,carpetas}' ELSE '[]'::jsonb END
        ) AS carpeta(value)
        CROSS JOIN LATERAL jsonb_array_elements(
            CASE WHEN jsonb_typeof(carpeta.value -> 'documentos') = 'array'
                THEN carpeta.value -> 'documentos' ELSE '[]'::jsonb END
        ) AS doc(value)
        WHERE d.metadata ->> 'kind' = 'ende-expediente-state-v1'
          AND carpeta.value ->> 'numero' = '2'
        UNION ALL
        SELECT d.adquisicion_id, d.metadata #>> '{fixedDraft,fields,numero}'
        FROM public.documentos d
        JOIN public.carpetas f ON f.id = d.carpeta_id
        WHERE f.numero = 2
    ), numericos AS (
        SELECT h.adquisicion_id, trim(h.numero) AS numero,
            (regexp_match(trim(h.numero), '^([0-9]{1,7})\s*/(?:[^/]+/)*([0-9]{4})$')) AS partes
        FROM historicos h
    )
    SELECT
        max(n.numero) FILTER (WHERE n.adquisicion_id = p_adquisicion_id AND n.partes IS NOT NULL),
        COALESCE(max((n.partes[1])::integer) FILTER (WHERE n.partes[2] = v_gestion::text), 0)
    INTO v_existente, v_correlativo
    FROM numericos n;
    IF v_existente IS NOT NULL THEN
        RETURN v_existente;
    END IF;

    SELECT GREATEST(v_correlativo, COALESCE(max(c.correlativo), 0)) + 1 INTO v_correlativo
    FROM public.s1_correlativos c
    WHERE c.gestion = v_gestion;

    INSERT INTO public.s1_correlativos (adquisicion_id, gestion, correlativo)
    VALUES (p_adquisicion_id, v_gestion, v_correlativo);

    RETURN v_correlativo::text || '/' || v_gestion::text;
END;
$$;

REVOKE ALL ON FUNCTION public.reservar_correlativo_s1(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reservar_correlativo_s1(uuid) TO service_role;
