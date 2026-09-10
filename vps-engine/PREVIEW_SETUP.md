# Servicio de vista previa

Servicio independiente: no reemplaza app.py ni requiere reiniciar AnythingLLM.

Ejecutar preview_service:app con Uvicorn, detrás del proxy HTTPS existente, en una cuenta sin privilegios. Requiere FastAPI, python-multipart, LibreOffice y las fuentes de los modelos (Arial o sustitución institucional validada). Limitar salida de red del proceso y ejecutar con un directorio temporal aislado.

- VPS: definir DOCX_PREVIEW_KEY con un secreto aleatorio; no incorporarlo al repositorio.
- Vercel: definir DOCX_PREVIEW_URL con la URL HTTPS completa terminada en /api/docx/preview, y el mismo DOCX_PREVIEW_KEY.
- El servicio acepta exclusivamente DOCX hasta 3 MB, procesa un documento a la vez y elimina temporales después de responder. No guarda archivos ni consulta IA.
- Comprobar Word -> PDF antes de activar. La aplicación conserva vista de contenido si el servicio no está disponible, y la identifica expresamente como tal.
- No se ha desplegado este servicio automáticamente. Configuración y prueba real son requisitos previos a declarar finalizada la vista PDF.
