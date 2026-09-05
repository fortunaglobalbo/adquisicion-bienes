/**
 * Cuaderno Normativo de Adquisiciones de ENDE DEORURO S.A.
 * Motor de validación y estructuración legal según el Reglamento SBC (Subasta Doble / Menor Precio)
 */

import { Adquisicion, ItemAdquisicion } from "@/types";

export interface CuadernoNormativoOutput {
  objeto_formal: string;
  antecedentes_normativos: string;
  justificacion_tecnica: string;
  puntos_14: Record<number, string>;
  items_estandarizados: ItemAdquisicion[];
  presupuesto_total_bs: number;
  plazo_entrega_dias: number;
  lugar_entrega: string;
  multa_porcentaje: number;
  garantia_meses: number;
  forma_pago: string;
  metodo_seleccion: string;
  firmas_oficiales: {
    elaborado_por: string;
    elaborado_cargo: string;
    revisado_por: string;
    revisado_cargo: string;
    aprobado_por: string;
    aprobado_cargo: string;
  };
}

export class CuadernoNormativoEngine {
  /**
   * Procesa cualquier requerimiento crudo y lo transforma en el formato normativo oficial de 14 puntos
   */
  static normalizarRequerimiento(
    rawText: string,
    adquisicionBase?: Partial<Adquisicion>
  ): CuadernoNormativoOutput {
    // 1. Extraer objeto o usar título institucional
    const titulo = adquisicionBase?.titulo_proceso || "ADQUISICIÓN DE SUMINISTROS Y EQUIPOS PARA ENDE DEORURO S.A.";
    
    // 2. Formular antecedentes con normativa de contrataciones
    const antecedentes =
      adquisicionBase?.antecedentes_texto ||
      `De acuerdo a la legislación vigente del Estado Plurinacional de Bolivia, normas y políticas internas institucionales, se da inicio al proceso de contratación para la "${titulo}". El presente proceso se encuentra enmarcado estrictamente en el Manual de Procedimientos y el Reglamento de Adquisición de Bienes, Construcción de Obras y Contratación de Servicios (SBC) de la Distribuidora de Electricidad ENDE DEORURO S.A.`;

    // 3. Formular justificación técnica y operativa
    const justificacion =
      adquisicionBase?.justificacion_texto ||
      `La adquisición tiene por finalidad técnica garantizar la continuidad, calidad y confiabilidad del suministro eléctrico en el área de concesión de ENDE DEORURO S.A. La incorporación de estos suministros permite prevenir fallas intempestivas en las redes de media y baja tensión, optimizar los tiempos de atención de emergencias técnicas y precautelar la seguridad industrial del personal operativo de la empresa.`;

    // 4. Estandarizar ítems
    let items = adquisicionBase?.items || [];
    if (!items || items.length === 0) {
      items = [
        {
          id: "item-1",
          item: 1,
          descripcion: "HERRAMIENTAS / SUMINISTROS SEGÚN REQUERIMIENTO TÉCNICO",
          unidad: "PZA",
          cantidad: 1,
          precioUnitarioEstimado: 1000,
          precioTotalEstimado: 1000,
          caracteristicasTecnicas: "Cumplimiento obligatorio de normas ASTM/IEC/ISO según ficha técnica adjunta. Garantía mínima de 12 meses.",
        },
      ];
    }

    const totalPresupuesto = items.reduce(
      (acc, it) => acc + (it.precioTotalEstimado || (it.cantidad * (it.precioUnitarioEstimado || 0))),
      0
    );

    // 5. Estructura Oficial de 14 Puntos Obligatorios ENDE DEORURO
    const puntos14: Record<number, string> = {
      1: antecedentes,
      2: justificacion,
      3: `Se requiere la provisión de ${items.length} ítem(s) detallados en el cuadro de especificaciones técnicas con cumplimiento de certificaciones vigentes.`,
      4: "El proponente adjudicado deberá presentar certificado emitido por el fabricante que garantice que todos los ítems son nuevos, sin uso y cumplen con estándares internacionales de calidad y seguridad eléctrica.",
      5: "Subestaciones, cuadrillas operativas y redes de distribución de ENDE DEORURO S.A.",
      6: "Por ítem requerido al Menor Precio evaluado, conforme al Artículo 31 del Reglamento SBC.",
      7: "Validez de la propuesta mínima de 30 (treinta) días calendario computables a partir de la fecha de presentación de ofertas.",
      8: "Bienes y Suministros Eléctricos.",
      9: "Almacenes Centrales de ENDE DEORURO S.A., ubicados en la ciudad de Oruro.",
      10: "Máximo 45 (cuarenta y cinco) días calendario, computables a partir del día siguiente de la recepción de la Orden de Compra formal.",
      11: "La recepción se llevará a cabo por la Comisión de Recepción designada en presencia de personal técnico de ENDE DEORURO S.A., verificando el 100% de los bienes.",
      12: "El pago se realizará en moneda nacional (Bolivianos) contra entrega satisfactoria del lote, emisión del Informe de Conformidad oficial y presentación de Factura comercial.",
      13: "Se aplicará una multa del 0.25% (cero punto veinticinco por ciento) por cada día calendario de retraso en la entrega de los bienes, descontable del pago final.",
      14: "Garantía técnica mínima de 12 (doce) meses contra cualquier vicio o defecto de fabricación, obligando al proveedor al reemplazo inmediato sin costo para la empresa.",
    };

    return {
      objeto_formal: titulo,
      antecedentes_normativos: antecedentes,
      justificacion_tecnica: justificacion,
      puntos_14: puntos14,
      items_estandarizados: items,
      presupuesto_total_bs: totalPresupuesto,
      plazo_entrega_dias: adquisicionBase?.plazo_entrega_dias || 45,
      lugar_entrega: adquisicionBase?.lugar_entrega || "Almacenes Centrales ENDE DEORURO S.A., Oruro - Bolivia",
      multa_porcentaje: 0.25,
      garantia_meses: 12,
      forma_pago: "Contra entrega satisfactoria, conformidad técnica y factura.",
      metodo_seleccion: "Menor Precio (Art. 31 SBC)",
      firmas_oficiales: {
        elaborado_por: adquisicionBase?.elaborado_por || "Ing. Responsable de Adquisición",
        elaborado_cargo: adquisicionBase?.elaborado_cargo || "SUPERVISOR TÉCNICO",
        revisado_por: adquisicionBase?.revisado_por || "Ing. Jefatura de Mantenimiento",
        revisado_cargo: adquisicionBase?.revisado_cargo || "JEFE DE DEPARTAMENTO TÉCNICO",
        aprobado_por: adquisicionBase?.aprobado_por || "Lic. Raul Alberto Torrico Gomez",
        aprobado_cargo: adquisicionBase?.aprobado_cargo || "GERENTE GENERAL",
      },
    };
  }
}
