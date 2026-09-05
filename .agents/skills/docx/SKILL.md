---
name: docx
description: >-
  Inspeccionar, analizar y autollenar documentos y plantillas de Word (.docx) de forma inteligente
  sin necesidad de etiquetas predefinidas ({{variable}}). Soporta detección de marcadores de posición,
  actualización de secciones legales y técnicas, inyección de tablas dinámicas con preservación de estilos,
  fuentes y logos, y conexión con datos extraídos de PDFs y AnythingLLM.
---

# Skill: Motor Inteligente DOCX (Smart DOCX Filler)

Esta habilidad permite trabajar con **cualquier documento Word (.docx)** subido por el usuario, sin requerir que el documento tenga etiquetas o variables predefinidas como `{{nombre}}` o `{{item}}`.

## 🛠️ Herramientas y Scripts Incluidos

1. **Inspección de Plantilla (`inspect_docx.py`):**
   * Analiza un archivo `.docx` y extrae su estructura completa: párrafos, marcadores de posición (`___`, `[...]`, `: `), títulos de secciones y tablas con sus cabeceras.
   * Ejecución:
     ```bash
     python .agents/skills/docx/scripts/inspect_docx.py <plantilla.docx>
     ```

2. **Llenado Inteligente (`smart_fill.py`):**
   * Rellena o actualiza el documento respetando fuentes (Arial, Calibri, etc.), tamaños, colores, negritas, alineaciones, márgenes y tablas.
   * Ejecución:
     ```bash
     python .agents/skills/docx/scripts/smart_fill.py <plantilla.docx> <datos.json> <salida.docx>
     ```

## 📋 Estructura de `datos.json` para Llenado Inteligente

El archivo de datos soporta 3 mecanismos de autollenado:

```json
{
  "replacements": {
    "____________________": "ADQUISICIÓN DE TRANSFORMADORES DE POTENCIA",
    "[PLAZO]": "60 días calendario",
    "DEORURO S.A.": "ENDE DEORURO S.A."
  },
  "sections": {
    "ANTECEDENTES": "Se requiere la compra de materiales según solicitud interna Nº 045/2026...",
    "JUSTIFICACIÓN / NECESIDAD": "Para garantizar la continuidad del suministro eléctrico en la zona central...",
    "TIEMPO DE ENTREGA": "Máximo 45 días calendario a partir de la firma de contrato."
  },
  "tables": [
    {
      "table_index": 0,
      "mode": "replace_from_row_1",
      "rows": [
        ["1", "Transformador 50kVA", "PZA", "5", "12.500,00", "62.500,00"],
        ["2", "Pararrayos 24kV", "PZA", "10", "1.200,00", "12.000,00"]
      ]
    }
  ]
}
```

## 🔄 Flujo de Trabajo con AnythingLLM

1. **Extracción:** AnythingLLM (en el VPS `http://85.31.230.163:3005`) lee y vectoriza los PDFs de respaldo (cotizaciones, solicitudes, especificaciones).
2. **Generación del JSON:** Se le pide a AnythingLLM o al modelo de IA mapear los datos al esquema de la plantilla inspeccionada.
3. **Inyección:** `smart_fill.py` genera el `.docx` final perfecto y listo para firma oficial.
