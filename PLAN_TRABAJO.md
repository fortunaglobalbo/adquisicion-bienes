# Plantillas Word fijas y biblioteca documental

Decisión del usuario: conservar AnythingLLM para reglamentos y manuales de distintas empresas; utilizar OpenCode GO para redactar y volver a carpetas con vista previa. Todos los documentos editables serán DOCX. Los operadores no administrarán plantillas.

## Entregas y orden

### Asistente de compra implementado

1. Leer texto, PDF, Word o fotos con IA; recuperar también datos del TDR existente cuando estén disponibles.
2. Revisar juntos finalidad, bienes, cantidades, unidades, lugar y plazo. Las características y precios vienen de los antecedentes; los datos administrativos adicionales son opcionales.
3. Confirmar y preparar las carpetas 1 a 4 desde una ficha común. Cada resultado se conserva antes de continuar al siguiente. Se puede reintentar una carpeta fallida sin perder las demás.
4. Proponer textos para decisiones comerciales sin presentarlos como obligaciones normativas. El usuario acepta o cambia la propuesta. La decisión confirmada se reutiliza al actualizar las carpetas.
5. Mantener edición, recuperación, versiones y descarga Word. Las carpetas 5 a 7 pueden redactarse usando la misma ficha y los antecedentes propios de su etapa. La conformidad exige datos reales de recepción.

La ficha y los borradores se guardan en el estado JSON del expediente existente, con sincronización y revisión de conflictos. No se añadió una base de datos paralela. La lectura de antecedentes confirmados no se repite en cada carpeta; los formularios sin cláusulas normativas no hacen búsquedas legales innecesarias.

S1 reconstruido siguiendo el Excel: bandas azules, casillas, distribución de celdas, cuatro bloques y firmas. Se utilizan celdas nativas editables de Word. La vista de S1 se obtiene del Word generado y conserva sus combinaciones y estilos. El ejemplo generado fue abierto en Word y comprobado en una página A4. Un texto más largo puede ampliar el formulario.

Comprobaciones: generación real con GO y recuperación de AnythingLLM de una compra ficticia de 10 resmas; coherencia de cantidades en las cuatro carpetas y total calculado de Bs 350. Prueba de interfaz con persistencia aislada: lectura, validación del dato esencial, preparación de cuatro carpetas, confirmación compartida, modificación visible del S1 y descarga Word.

La prueba real detectó respuestas de GO que omiten `items` pese a existir una ficha confirmada: el servidor reutiliza esas filas confirmadas, sin deducir recepciones. La exportación conserva saltos de línea nativos de Word, tanto en características como en párrafos de la comunicación. Se revisaron las siete páginas finales de los cuatro documentos del ejemplo (TDR 4; S1, justificación y comunicación 1 cada uno).

### Base documental

1. Registrar las referencias de PROCESO DE ADQUISICION y preparar siete modelos DOCX. Conservar los originales y excluir datos, firmas y sellos de compras anteriores. S1 pasa de Excel a Word; los importes se calculan en la aplicación. La carpeta 8 conserva su modelo previo hasta recibir la referencia.
2. Definir campos permitidos por plantilla y una tabla de ítems, sin pedir a la IA que seleccione destinos ni modifique el diseño. Guardar versión de plantilla y fuente de cada regla.
3. Consultar AnythingLLM desde el servidor, en el espacio asignado a la empresa. La asignación no procede de texto libre ni de documentos cargados. Mantener los antecedentes de una compra separados de la biblioteca normativa. El registro inicial es ENDE Deoruro; incorporar otras empresas requiere configurar sus espacios, accesos y modelos antes de habilitarlas.
4. Redactar con OpenCode GO usando solo campos solicitados, datos del proceso y fragmentos recuperados. No cambiar de redactor silenciosamente. Si faltan fuentes, marcar requisitos pendientes. No inferir recepción, presupuesto aprobado, firmas o precios de proveedor.
5. Volver al expediente como pantalla principal: completar con IA, corregir datos, guardar borrador, descargar Word y ver documento. Usar el Word generado como origen del PDF de vista previa. Conservar documentos anteriores.
6. Guardar versiones y referencias de los documentos. Cambiar de carpeta no pierde el borrador guardado; un fallo de IA o de conversión no sustituye el último documento válido.
7. Verificar modelos, tablas largas, importes, aislamiento de espacios y fallos de servicios; probar el recorrido real antes de desplegar. Publicar siguiendo GitHub/Vercel existente; actualizar el motor de conversión del VPS solo con la configuración comprobada.

## Criterios de aceptación

- Los siete modelos nuevos se abren en Word, sin datos de ejemplo ni firmas heredadas; el octavo queda identificado como previo.
- Ningún usuario necesita subir o editar una plantilla para preparar un expediente.
- Las cantidades y valores de documentos relacionados corresponden al mismo expediente.
- Los documentos guardados conservan modelo, versión y fuentes consultadas; ninguna fuente inventada se presenta como respaldo.
- La vista PDF procede del mismo DOCX descargable. Si no hay conversión, se informa explícitamente y se conserva una lectura de contenido.
- Se comprueba que una empresa no utiliza espacios asignados a otra. Esto complementa, no sustituye, los permisos de acceso a expedientes.
- La descarga y guardado no equivalen a aprobación normativa ni firma.

## Pendientes externos

- Referencia oficial de la carpeta 8.
- Validación institucional de los formatos reconstruidos desde fotografías y de las cláusulas del TDR frente al reglamento vigente.
- Confirmación de la adecuación del plan GO al uso documental; conexión técnica y generación real ya comprobadas.
- Configuración HTTPS y credencial del convertidor del VPS; conexión real y publicación tras validar el conjunto.

## Avance realizado el 10 de septiembre de 2026

- Corregida la carga del lector PDF en Next.js. Añadidos antecedentes JPG, PNG y WebP enviados al modelo de visión. Prueba real: extracción de siete cajas de marcadores y su presentación desde una imagen, con respuesta HTTP 200. GO usa respuesta directa en el flujo fijo; se distinguen cuota, demora, respuesta vacía y salida incompleta. Los originales y el último borrador se conservan ante un fallo.

- Implementados los siete modelos fijos, catálogo, llenado controlado, tablas, cálculo de importes y revisión por carpeta. S1 ya es DOCX. Los originales se conservan.
- Integrada la consulta a la biblioteca asignada a ENDE, referencias de fuente y redacción con GO. Las empresas no configuradas se rechazan; todavía no se implementó un sistema de acceso para múltiples empresas.
- Implementados guardado de borradores y versiones, recuperación local, descarga Word y aviso de cambios en datos compartidos. La descarga no aprueba documentos.
- Vista de contenido funcional; servicio DOCX a PDF preparado para el VPS, pendiente de instalar y conectar. No se afirma fidelidad paginada de la vista de contenido.
- Siete documentos llenados abiertos con Word y revisados visualmente. Corregidos el objeto heredado en encabezados, índice y total de páginas del TDR. Los formatos reconstruidos conservan los campos principales, pero necesitan validación contra los formularios institucionales antes de uso oficial.
- Pruebas automatizadas de siete modelos, tablas, importes, fuentes inexistentes, biblioteca caída, empresa y versión incompatibles. Compilación local verificada.

## Diagnóstico de conexión y siguiente entrega

La prueba contra los servicios actuales recibió HTTP 400 de OpenCode GO por `MissingSessionID`; AnythingLLM recibió HTTP 500 porque su proveedor GO también rechazó la sesión. No es evidencia de pérdida de manuales. GO exige identificación de cliente y sesión estable, y documenta un uso orientado a agentes de programación: https://opencode.ai/docs/go/#where-can-i-use-it.

Tras recibir la configuración del usuario, se incorporaron identidad propia de cliente y una sesión estable por expediente y documento. GO respondió HTTP 200. Para las carpetas nuevas se sustituyó la consulta de chat de AnythingLLM por búsqueda directa de fragmentos (`vector-search`), que también respondió HTTP 200. No se modificaron sus manuales ni su proveedor interno. La aplicación hace una sola redacción con GO y conserva AnythingLLM como biblioteca.

Prueba real completada: TDR ficticio de diez resmas de papel, veinte campos, una fila y diecisiete fragmentos del reglamento V.04 recuperados por temas. Los datos y reglas sin respaldo quedan pendientes. Se probó también un TDR de treinta ítems con cabecera repetida y cinco páginas. Esto comprueba la integración técnica, no constituye aprobación de uso del plan GO ni certificación normativa.

Orden pendiente: activar el convertidor PDF en el VPS; validar con el usuario un expediente completo; comprobar acceso y persistencia del entorno de despliegue; publicar por el GitHub/Vercel existente. La carpeta 8 y la habilitación de otras empresas requieren sus referencias y configuración propia. No se publicó la versión local.
