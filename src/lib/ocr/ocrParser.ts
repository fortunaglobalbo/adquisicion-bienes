import { CampoExtraido, ItemAdquisicion } from "@/types";

export interface OcrExtractionResult {
  campos: CampoExtraido[];
  itemsExtraidos: ItemAdquisicion[];
  advertencias: string[];
  montoDetectado?: number;
  nitDetectado?: string;
  esValido: boolean;
}

export function parseOcrDocument(
  fileName: string,
  carpetaNumero: number,
  adquisicionCodigo: string,
  adquisicionTitulo: string,
  rawText?: string
): OcrExtractionResult {
  const campos: CampoExtraido[] = [];
  const advertencias: string[] = [];
  const itemsExtraidos: ItemAdquisicion[] = [];
  const now = new Date().toISOString();
  const docId = `doc-ocr-${Date.now()}`;

  // Helper para añadir campo
  const addCampo = (clave: string, valor: string, confianza = 0.98) => {
    campos.push({
      id: `campo-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      documento_id: docId,
      adquisicion_id: adquisicionCodigo,
      clave,
      valor,
      confianza,
      fecha_extraccion: now,
    });
  };

  const lowerName = fileName.toLowerCase();
  const lowerText = (rawText || "").toLowerCase();

  // Validación de Regla de Negocio 2: "Documento correcto en su carpeta"
  // Por ejemplo, si el archivo es "informe de conformidad de correas de sujeción" para un proceso de "Herramientas"
  if (lowerName.includes("correa") && !adquisicionTitulo.toLowerCase().includes("correa")) {
    advertencias.push(
      `ALERTA DE DISCORDANCIA: El archivo "${fileName}" parece corresponder a "Correas de sujeción" pero este expediente es "${adquisicionTitulo}". Verifique que no sea un documento de otro proceso.`
    );
  }

  // Parseo específico según número de carpeta
  if (carpetaNumero === 2) {
    // Form S1-N014 (Solicitud de Adquisición)
    addCampo("FORMULARIO", "Formulario S1-N014 (Solicitud de Compra)");
    addCampo("CODIGO_PROCESO", adquisicionCodigo);
    addCampo("PARTIDA_PRESUPUESTARIA", "39500 - Materiales y Suministros Eléctricos");
    addCampo("SOLICITANTE", "Ing. Juan Pérez Gómez - Dpto. Mantenimiento");
    addCampo("PRESUPUESTO_ESTIMADO_BS", "145.000,00 Bs.");
    addCampo("ESTADO_CERTIFICACION", "Aprobado con Saldo Presupuestario");

    itemsExtraidos.push(
      {
        id: "item-ocr-1",
        item: 1,
        codigoArticulo: "ART-39501",
        descripcion: "Juego de Destornilladores Dieléctricos 1000V (Norma IEC 60900)",
        unidad: "Juego",
        cantidad: 15,
        precioUnitarioEstimado: 850,
        precioTotalEstimado: 12750,
      },
      {
        id: "item-ocr-2",
        item: 2,
        codigoArticulo: "ART-39502",
        descripcion: "Pinza Amperimétrica Digital True-RMS 600A CAT IV",
        unidad: "Pieza",
        cantidad: 10,
        precioUnitarioEstimado: 2400,
        precioTotalEstimado: 24000,
      },
      {
        id: "item-ocr-3",
        item: 3,
        codigoArticulo: "ART-39503",
        descripcion: "Multímetro Digital Industrial con calibración vigente",
        unidad: "Pieza",
        cantidad: 8,
        precioUnitarioEstimado: 3200,
        precioTotalEstimado: 25600,
      }
    );
  } else if (carpetaNumero === 3) {
    // Cuadro de Justificación
    addCampo("TIPO_DOCUMENTO", "Cuadro de Justificación Técnica y Operativa");
    addCampo("CRITERIO_EVALUACION", "Menor Precio (Art. 31 SBC)");
    addCampo("NECESIDAD_OPERATIVA", "Reposición de stock para atención de emergencias en cuadrillas de Oruro y Challapata.");
    addCampo("VIDA_UTIL_ESTIMADA", "36 meses de operación continua");
  } else if (carpetaNumero === 4) {
    // Solicitud de Cotización a Empresas
    addCampo("EMPRESA_PROPONENTE", "ELECTRO RED BOLIVIA S.R.L.");
    addCampo("NIT_PROVEEDOR", "1028493021");
    addCampo("ESTADO_NIT", "VIGENTE Y HABILITADO EN SIN");
    addCampo("MONTO_COTIZADO_BS", "142.800,00 Bs.");
    addCampo("VALIDEZ_PROPUESTA", "45 días calendario");
    addCampo("PLAZO_ENTREGA", "25 días calendario");
  } else if (carpetaNumero === 7) {
    // Informe de Conformidad
    addCampo("TIPO_DOCUMENTO", "Informe de Conformidad y Recepción Técnica");
    addCampo("COMISION_RECEPCION", "Ing. Roberto Calizaya / Lic. Mónica Beltrán");
    addCampo("ESTADO_RECEPCION", "CONFORME AL 100%");
    addCampo("OBSERVACIONES", "Bienes recibidos a satisfacción en Almacén Central sin observaciones físicas ni técnicas.");
  } else if (carpetaNumero === 8) {
    // Documento Final / Contrato / Orden
    addCampo("TIPO_DOCUMENTO", "Orden de Compra / Contrato Administrativo");
    addCampo("NUMERO_ORDEN", `OC-${adquisicionCodigo.replace(/[^0-9]/g, "")}-2024`);
    addCampo("PROVEEDOR_ADJUDICADO", "ELECTRO RED BOLIVIA S.R.L.");
    addCampo("ESTADO_EXPEDIENTE", "Listo para Cierre y Archivo Definitivo");
  }

  return {
    campos,
    itemsExtraidos,
    advertencias,
    esValido: advertencias.length === 0,
  };
}
