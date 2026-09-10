# Modelos Word de ENDE Deoruro

Los documentos 01 a 07 son modelos internos del servidor. El operador utiliza el expediente y descarga una copia completada, sin ver ni editar etiquetas.

`catalog.json` registra campos permitidos, columnas, referencia, versión y SHA-256 de cada DOCX. Un archivo modificado sin actualizar el catálogo se rechaza. `scripts/build-fixed-models.py` permite reconstruirlos desde las referencias originales. Una modificación publicada debe recibir nueva versión; los documentos anteriores conservan la suya.

## Autoridad visual y cambios intencionales

- 01: `PROCESO DE ADQUISICION/1TDR/TDR_ENDE.docx`. Se conservan portada, logotipos, catorce secciones, tabla e índice. Se sustituyen datos de compra, responsables y condiciones por campos. Encabezados dependen del objeto y fecha; índice y total de páginas son campos de Word actualizables.
- 02: `PROCESO DE ADQUISICION/2FORM S1-N014 SOL DE ADQUI/SD - FERRETERIA (1).xlsx`. Versión 2026-09-10.2: celdas editables de Word con bandas azules, combinación de celdas, casillas y firmas del original. Los bordes se reconstruyen desde el área impresa; las alturas de filas se ajustan para Word sin truncar contenido. Se comprobó un ejemplo completado en una página A4. Los textos extensos pueden ampliar la página. No se copian fórmulas ni decisiones del ejemplo. Las casillas solo se marcan con la elección confirmada; monto verificado no se deduce del precio referencial. Vista HTML obtenida de las celdas reales del DOCX.
- 03 a 06: fotografías de las carpetas originales correspondientes. Reconstrucciones editables sujetas a validación institucional; la fotografía de correo de 04 se transforma en una comunicación Word. S2 reserva precios y oferta al proveedor.
- 07: `PROCESO DE ADQUISICION/7INFORME DE CONFORMIDAD/105 -INFORME de conformidad trepaderas.docx`. Se conservan logotipo, cabecera y secciones, se retiran datos y firmas del proceso anterior. El rótulo Mes pasa a Fecha y la recepción debe documentarse expresamente.

No se certifica fidelidad exacta a los formularios fotografiados. Ninguna plantilla certifica cumplimiento normativo por sí misma. La carpeta 08 mantiene el modelo anterior en la aplicación y no forma parte de este catálogo.

## Revisión realizada

Los siete documentos con campos y tres filas de prueba fueron abiertos en Microsoft Word y exportados a PDF. Se inspeccionaron las diez páginas resultantes. El renderizador empaquetado no pudo iniciar por ausencia de LibreOffice local; se utilizó Word y Poppler como alternativa. Se revisaron logotipos, tablas, cabeceras, ausencia de datos heredados y paginación del TDR.

Las copias de revisión quedan en `test-results/fixed-models` (excluido de Git). El convertidor de producción usa LibreOffice y necesita una comprobación independiente en el VPS antes de validar la vista PDF de producción.

Se revisaron también las cinco páginas de un TDR con treinta ítems y las cuatro páginas de un TDR ficticio generado por GO con diecisiete fragmentos reales de AnythingLLM. Los encabezados se repiten y el índice refleja las páginas resultantes. La revisión visual no valida las cláusulas normativas propuestas.
