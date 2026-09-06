# ⚡ ENDE DEORURO S.A. — Sistema Inteligente de Gestión de Adquisición de Bienes y Contrataciones

## Asistente simplificado de documentos — septiembre de 2026

La entrada **Preparar documento** (`/plantillas`) ofrece cinco pasos: elegir documento, elegir Word, aportar información, completar pendientes y revisar/descargar. El TDR incluye un modelo institucional; los demás documentos admiten el Word del usuario. La configuración anterior se conserva en `/configuracion/plantillas`, junto al acceso a auditoría.

El nuevo flujo consulta las normas del espacio configurado en AnythingLLM automáticamente. Los datos de la compra proceden de la descripción, hasta tres antecedentes y el expediente seleccionado; para documentos posteriores también puede reutilizar el TDR preparado por este asistente dentro del mismo expediente. No extrae hechos de compra de todo el espacio normativo.

El llenado nuevo se ejecuta en Next.js, sobre una copia del DOCX original, conservando sus recursos. Identifica párrafos y tablas por sus identificadores estructurales; rechaza destinos inexistentes, superposiciones y reemplazos de filas en tablas combinadas o ambiguas. No requiere actualizar el motor Python del VPS. Máximo: plantilla de 3 MB y archivos juntos de 4 MB; hasta 600 párrafos. Los PDF deben contener texto seleccionable en este flujo.

Las fuentes recuperadas, fragmentos, página y versión cuando están disponibles acompañan la revisión. Una cláusula normativa propuesta sin fuente reconocida queda pendiente. Esto **no certifica cumplimiento ni vigencia normativa**: las referencias son propuestas para revisión y la maquetación final debe comprobarse en Word. La pantalla muestra contenido, no una previsualización paginada del archivo final. No se promete compatibilidad perfecta con cualquier diseño.

Cuando se selecciona un expediente compatible, la descarga registra una copia como **Borrador**, su fundamento y, si la carga tiene éxito, el modelo original reutilizable. La carpeta no se marca automáticamente como completada. Los errores de guardado se muestran sin impedir conservar el Word descargado. Los documentos independientes se descargan sin guardarse en un expediente. La reutilización de modelos requiere una copia previamente guardada en un expediente accesible.

Validación local: `npm run typecheck`, `npm test`, `npm run test:documents`, `npm run build`. Las pruebas de documentos verifican conservación de recursos del modelo institucional, tablas, destinos y ausencia de fuentes inventadas; no sustituyen una prueba con usuarios ni una revisión visual en Word. Se mantiene el despliegue existente GitHub/Vercel y la configuración actual de los servicios.

Las secciones siguientes describen la arquitectura previa. Las afirmaciones históricas de «cualquier plantilla», formato «exacto» o cumplimiento automático no son garantías del nuevo asistente.

> Plataforma web integral e inteligente para la formulación, redacción, maquetación y generación automatizada de los expedientes oficiales de adquisición de bienes, suministros y servicios de la **Distribuidora de Electricidad ENDE DEORURO S.A.**, cumpliendo estrictamente con el **Reglamento SBC (Subasta Doble / Menor Precio)** y las normativas técnicas institucionales.

---

## 📋 Tabla de Contenidos
1. [Visión General del Sistema](#-visión-general-del-sistema)
2. [Estructura del Expediente: Flujo de las 8 Carpetas](#-estructura-del-expediente-flujo-de-las-8-carpetas)
3. [Motor "Maquetar en Código" (DOCX Transpiler)](#-motor-maquetar-en-código-docx-transpiler)
4. [Cuaderno Normativo de Adquisiciones (14 Puntos SBC)](#-cuaderno-normativo-de-adquisiciones-14-puntos-sbc)
5. [Infraestructura de Inteligencia Artificial Híbrida](#-infraestructura-de-inteligencia-artificial-híbrida)
6. [Alojamiento de Documentos: Servidor VPS KVM 2 (Hostinger) y Comunicación](#-alojamiento-de-documentos-servidor-vps-kvm-2-hostinger-y-comunicación)
7. [Arquitectura de Datos y Persistencia Local-First](#-arquitectura-de-datos-y-persistencia-local-first)
8. [Interfaz Unificada y Experiencia de Usuario](#-interfaz-unificada-y-experiencia-de-usuario)
9. [Mapa de Endpoints y Servicios API](#-mapa-de-endpoints-y-servicios-api)
10. [Configuración de Variables de Entorno](#-configuración-de-variables-de-entorno)
11. [Instalación y Despliegue](#-instalación-y-despliegue)

---

## 🎯 Visión General del Sistema

El sistema automatiza el ciclo de vida completo de los procesos de compra y contratación pública de **ENDE DEORURO S.A.** Elimina la redacción manual repetitiva, las inconsistencias legales en pliegos técnicos y la dependencia de plantillas rígidas con etiquetas estáticas (`{{variable}}`), permitiendo:

- **Ingesta inteligente de cualquier plantilla Word (.docx)** libre y sin etiquetas previas.
- **Estructuración técnica automática** de antecedentes, justificación, especificaciones mínimas, plazos, multas y métodos de selección bajo normativa boliviana.
- **Interconexión en cascada** entre todas las fases del expediente: lo redactado en el TDR alimenta automáticamente las solicitudes de inicio, cuadros comparativos, cotizaciones, informes de recepción y órdenes de pago.
- **Exportación fidedigna a Word (.docx) y PDF oficial** con logos vectoriales institucionales, cabeceras normalizadas, numeración de páginas y recuadros de firmas reglamentarias.

---

## 🗂️ Estructura del Expediente: Flujo de las 8 Carpetas

Cada proceso de adquisición se organiza cronológica y normativamente en **8 carpetas oficiales**:

```
📦 EXPEDIENTE DE ADQUISICIÓN
 ├── 📁 Carpeta 1: TDR (Términos de Referencia / Especificaciones Técnicas) [IA / 7 Páginas Oficiales]
 ├── 📁 Carpeta 2: Form S1-N014 (Solicitud de Adquisición y Partida Presupuestaria) [Documento Respaldatorio]
 ├── 📁 Carpeta 3: Cuadro de Justificación (Previsión de Precios e Informe Técnico) [Documento Respaldatorio]
 ├── 📁 Carpeta 4: Solicitud de Cotización a Empresas (Proformas, Proveedores y NIT) [Documento Respaldatorio]
 ├── 📁 Carpeta 5: Solicitud de Inicio de Proceso (Autorización y Memorándum Formal) [IA]
 ├── 📁 Carpeta 6: Form S2-N014 (Solicitud Oficial de Cotización al Proveedor) [IA]
 ├── 📁 Carpeta 7: Informe de Conformidad (Formulario A6-N014 / Comisión de Recepción) [IA]
 └── 📁 Carpeta 8: Memo Solicitud de Pago (Desembolso Financiero y Trámite de Factura) [IA]
```

### Detalle Operativo por Carpeta

| Carpeta | Nombre Oficial | Tipo | Descripción y Automatización |
| :---: | :--- | :---: | :--- |
| **1** | **TDR (Términos de Referencia)** | `IA` | Documento maestro de 7 páginas. Estructura los 14 puntos obligatorios de ENDE DEORURO, tablas técnicas (Bienes Simples, Salud Ocupacional o Servicios) y fichas técnicas por ítem. |
| **2** | **Form S1-N014** | `Doc` | Solicitud formal de compra con asignación de partida presupuestaria (ej. 39500 - Útiles de escritorio y suministros). Subida manual del usuario o registro respaldatorio. |
| **3** | **Cuadro de Justificación** | `Doc` | Cuadro comparativo de precios de mercado, cálculo de precio referencial estimado y necesidad técnica operativa de reposición. |
| **4** | **Cotizaciones de Empresas** | `Doc` | Recepción de proformas comerciales con verificación de NIT, plazo de entrega y especificaciones ofertadas por proveedores. |
| **5** | **Solicitud de Inicio** | `IA` | Memorándum formal dirigido a la Autoridad Responsable de Contrataciones (RPA/RPC) consolidando el objeto, partida y TDR. |
| **6** | **Form S2-N014** | `IA` | Formulario estándar de invitación formal a cotizar con plazo de validez de oferta (30 días) y requerimientos legales (RNC/NIT). |
| **7** | **Informe de Conformidad** | `IA` | Formulario A6-N014 emitido por el responsable o comisión de recepción técnica, verificando cumplimiento al 100% de los ítems entregados. |
| **8** | **Memo de Solicitud de Pago** | `IA` | Trámite final remitido a Contabilidad/Finanzas para el desembolso por transferencia bancaria contra entrega de factura comercial. |

---

## 🪄 Motor "Maquetar en Código" (DOCX Transpiler)

Una de las innovaciones centrales de la plataforma es su motor de transpilación de documentos Word a modelos nativos de código:

### ¿Cómo Funciona?
1. **Subida Libre:** El usuario sube cualquier archivo `.docx` institucional sin requerir marcas previas ni macros (`{{codigo}}`, `{{items}}`).
2. **Inspección AST y Extracción Estructural:** El sistema inspecciona los encabezados, párrafos, tablas, metadatos y firmas del documento mediante mammoth y python-docx.
3. **Transpilación a Modelo Nativo:** Convierte el documento en una estructura de datos `Plantilla` que se asigna dinámicamente a cualquiera de las 8 carpetas.
4. **Relleno Inteligente de Tablas:** Permite inyectar tablas dinámicas preservando fuentes (Arial / Calibri / Times), alineaciones, bordes y estilos exactos del documento original.

> **Acceso Unificado:** En el encabezado de cualquiera de las 8 carpetas, el botón `[✨ Configurar / Maquetar Plantilla (.docx)]` permite cargar y maquetar la plantilla específica de esa fase.

---

## 📜 Cuaderno Normativo de Adquisiciones (14 Puntos SBC)

El motor `CuadernoNormativoEngine` (`src/lib/ai/cuadernoNormativoEngine.ts`) actúa como guardián legal y técnico para que ningún documento se genere fuera de norma:

### Los 14 Puntos Obligatorios de ENDE DEORURO S.A.
1. **ANTECEDENTES:** Base legal boliviana (Reglamento SBC, Manual de Procedimientos).
2. **JUSTIFICACIÓN / NECESIDAD:** Continuidad operativa del suministro eléctrico y prevención de riesgos.
3. **ESPECIFICACIÓN TÉCNICA:** Tabla de ítems adaptable según rubro:
   - `BIENES_SIMPLE`: No. \| Descripción \| Especificación Técnica \| Cantidad.
   - `SALUD_OCUPACIONAL`: Examen / Servicio \| Especificación Mínima \| Propuesto / Informar.
   - `MATRIZ_SERVICIOS`: Actividad \| Entregable \| Metodología \| Plazo.
4. **CALIDAD:** Estándares de fabricación **ASTM, IEC, ISO** con garantía mínima de 12 meses.
5. **ÁMBITO DE APLICACIÓN:** Cuadrillas operativas y redes de distribución de ENDE DEORURO.
6. **MÉTODO DE SELECCIÓN:** Menor Precio evaluado (Art. 31 del Reglamento SBC).
7. **VIGENCIA DE LA PROPUESTA:** Mínimo 30 días calendario desde la presentación de ofertas.
8. **CATEGORÍA:** Clasificación oficial del insumo o servicio.
9. **LUGAR DE ENTREGA:** Almacenes Centrales de ENDE DEORURO S.A., Oruro - Bolivia.
10. **TIEMPO DE ENTREGA:** Plazo contractual en días calendario tras recepción de la Orden de Compra.
11. **FORMA DE ADJUDICACIÓN:** Por Ítem requerido formalizado mediante Orden de Compra.
12. **ACEPTACIÓN DEL LOTE:** Inspección técnica de conformidad en almacén el día de la entrega.
13. **FORMA DE PAGO:** Pago en moneda nacional (BOB) contra entrega a satisfacción, informe de conformidad y factura oficial.
14. **APLICACIÓN DE MULTAS:** Sanción legal del **0.25% diario** por retraso injustificado.

---

## 🧠 Infraestructura de Inteligencia Artificial Híbrida

El sistema opera bajo una arquitectura de IA en tres niveles para garantizar alta disponibilidad y resiliencia:

```mermaid
flowchart TD
    Usuario[Usuario ingresa requerimiento o PDF] --> API[/api/ai/generate-tdr]
    API --> Level1{VPS Python Engine<br/>Puerto 8080}
    Level1 -- Online --> Engine[MarkItDown + OCR Tesseract + DeepSeek]
    Level1 -- Timeout / Error --> Level2{AnythingLLM RAG<br/>Puerto 3005}
    Level2 -- Ingesta PDF --> RAG[Extracción Contextual de Proformas]
    Level2 -- Offline --> Level3[Fallback Local Resiliente<br/>CuadernoNormativoEngine]
    Engine --> Output[DOCX Oficial Generado]
    RAG --> Output
    Level3 --> Output
```

1. **VPS Linux Engine (`http://85.31.230.163:8080`):**
   - Motor unificado en Python con `markitdown`, OCR Tesseract multilingüe y `python-docx`.
   - Generación nativa de archivos PDF y DOCX con estilos tipográficos exactos.
2. **AnythingLLM RAG Server (`http://85.31.230.163:3005`):**
   - Ingesta de proformas complejas, catálogos técnicos y cotizaciones en PDF.
   - Espacio de trabajo dedicado: `adquisiciones-ende`.
3. **Motor Local Resiliente (`src/lib/ai/openCodeClient.ts`):**
   - Si la red o la API externa experimentan fallas o demoras, el parser heurístico local y el Cuaderno Normativo asumen el control inmediato.
   - **Garantía Cero Pantallas en Blanco:** Los ítems y especificaciones siempre se estructuran sin dejar la vista previa vacía.

---

## 🌐 Alojamiento de Documentos: Servidor VPS KVM 2 (Hostinger) y Comunicación

Para garantizar alta potencia de procesamiento en tareas intensivas (OCR con Tesseract, procesamiento RAG de cotizaciones con AnythingLLM, análisis de documentos con MarkItDown y compilación tipográfica exacta de archivos Word y PDF), el sistema opera en conjunto con un **Servidor VPS KVM 2 de Hostinger**.

### 1. Especificaciones de la Infraestructura VPS
* **Proveedor y Nivel:** Hostinger VPS KVM 2
* **Sistema Operativo:** Ubuntu 22.04 LTS (x86_64 Linux)
* **Dirección IP Pública:** `85.31.230.163`
* **Recursos Asignados:** 2 vCPU Cores, 8 GB de Memoria RAM, almacenamiento NVMe de ultra alta velocidad.

---

### 2. Componentes y Almacenamiento Alojados en el VPS

```
📁 ESTRUCTURA DEL SERVIDOR VPS (Hostinger KVM 2: 85.31.230.163)
 ├── 📦 Docker: AnythingLLM Server (Puerto 3005)
 │    ├── 🗄️ Volumen Persistente: /var/lib/anythingllm
 │    ├── 🔑 API Key: <CONFIGURAR_EN_ENTORNO>
 │    ├── 📂 Espacio RAG: adquisiciones-ende
 │    └── 🧠 Base de Datos Vectorial: Embeddings de PDFs y proformas de proveedores
 │
 ├── 🐍 Python VPS Engine (Puerto 8080 - FastAPI / Uvicorn)
 │    ├── 📂 Directorio del Motor: /root/vps-engine
 │    ├── 📄 Almacenamiento Físico de Salida: /root/vps-engine/output/
 │    │    ├── 📝 *.docx (Documentos oficiales generados en Word)
 │    │    └── 📑 *.pdf (Documentos oficiales compilados)
 │    └── ⚙️ Módulos: python-docx, markitdown, pytesseract (OCR), libreoffice
```

1. **Almacenamiento Físico de Archivos Generados (`/root/vps-engine/output/`):**
   - El motor en Python genera los archivos Word y compila los PDFs con márgenes, tablas, membretes y firmas exactas de ENDE DEORURO.
   - Los documentos procesados se conservan organizados en el disco NVMe del VPS para su recuperación, previsualización y descarga inmediata.
2. **Motor de Microservicios Python (`Puerto 8080`):**
   - Expone endpoints REST en FastAPI:
     - `POST /api/procesar-documento`: Extrae texto con OCR y MarkItDown, detecta tablas y formula el documento.
     - `POST /api/generar-especificaciones`: Compila el pliego de especificaciones técnicas oficiales.
     - `POST /api/docx/inspect`: Inspecciona la estructura AST de cualquier archivo Word subido.
     - `POST /api/docx/smart-fill`: Rellena dinámicamente plantillas Word conservando estilos.
3. **Servidor de Inteligencia Artificial AnythingLLM (`Puerto 3005`):**
   - Corre en un contenedor Docker con persistencia total en `/var/lib/anythingllm`.
   - Permite cargar carpetas de documentos PDF (pliegos anteriores, notas, cotizaciones) y consultarlos mediante búsqueda semántica RAG (Retrieval-Augmented Generation).

---

### 3. ¿Cómo se comunican el Frontend (Vercel) y el VPS KVM 2 (Hostinger)?

La arquitectura implementa el patrón **BFF (Backend For Frontend) con Proxy Inverso Seguro** a través de las rutas de API de Next.js:

```mermaid
sequenceDiagram
    autonumber
    actor Usuario as Navegador del Usuario (Cliente)
    participant Vercel as Next.js 14 en Vercel (BFF / API Routes)
    participant VPS_Engine as VPS Hostinger :8080 (Python Engine)
    participant VPS_LLM as VPS Hostinger :3005 (AnythingLLM RAG)
    participant Storage as Disco NVMe VPS (/root/vps-engine/output)

    Note over Usuario,Vercel: Comunicación HTTPS Segura
    Usuario->>Vercel: Sube PDF / Clic en "Generar Documento con IA"
    
    rect rgb(240, 248, 255)
    Note over Vercel,VPS_Engine: Comunicación Servidor a Servidor (Proxy Seguro)
    Vercel->>VPS_LLM: Consulta RAG contextual (/api/anythingllm con Bearer Token)
    VPS_LLM-->>Vercel: Fragmentos normativos y cotizaciones extraídas
    
    Vercel->>VPS_Engine: POST /api/procesar-documento (Datos + Requerimiento)
    VPS_Engine->>Storage: Escribe DOCX/PDF oficial generado en /output/
    VPS_Engine-->>Vercel: JSON { success: true, docx_file: "TDR_001.docx", download_docx: "..." }
    end

    Vercel->>VPS_Engine: Solicita stream binario del archivo generado
    VPS_Engine-->>Vercel: Stream binario (application/vnd.openxmlformats...)
    Vercel-->>Usuario: Descarga directa del archivo Word / PDF en el navegador
```

#### Ventajas Clave de este Esquema de Comunicación:
1. **Blindaje y Seguridad:**
   - La dirección IP del VPS, los puertos internos (`:8080`, `:3005`) y las claves privadas (`ANYTHINGLLM_API_KEY`) nunca se exponen al navegador del cliente. Todo viaje a través de rutas protegidas en `/api/...` de Next.js ejecutadas en el servidor.
2. **Cero Problemas de CORS (Cross-Origin Resource Sharing):**
   - Dado que el navegador solo se comunica con su propio dominio en Vercel, no existen bloqueos por políticas de mismo origen.
3. **Manejo de Tiempos de Espera y Fallback Automático:**
   - Si el VPS experimenta un reinicio o latencia de red superior al umbral (`AbortSignal.timeout`), la ruta de Next.js intercepta la condición y conmuta de inmediato al **Motor Local Resiliente (`CuadernoNormativoEngine`)**, garantizando que el usuario **nunca vea una pantalla en blanco ni un error 500**.
4. **Streaming de Archivos Binarios:**
   - Next.js actúa como un puente de transmisión de datos binarios, transfiriendo los archivos `.docx` generados en el VPS directamente a los diálogos de descarga del navegador.

---

## 💾 Arquitectura de Datos y Persistencia Local-First

Para asegurar una experiencia de usuario rápida y fluida sin parpadeos ni recargas invasivas:

- **Local-First Reactivo:** Todas las operaciones de creación, edición y guardado de adquisiciones y carpetas se persisten **inmediatamente y de forma sincrónica en LocalStorage** (`DataStore`).
- **Sincronización Silenciosa con Supabase:** En segundo plano, las mutaciones se replican hacia las tablas de Supabase (`adquisiciones`, `carpetas`, `documentos_carpeta`, `plantillas`) sin bloquear la interfaz.
- **Renderizado In-Place:** Las actualizaciones de estado del visor de documentos no desmontan el componente ni muestran pantallas de carga intermedias que interrumpan la lectura.

---

## 🖥️ Interfaz Unificada y Experiencia de Usuario

La interfaz está construida con **Next.js 14 App Router** y estilos limpios diseñados para entornos institucionales:

1. **Barra de Navegación de Carpetas:** Sidebar izquierdo con los estados de las 8 carpetas (Iniciado, En Proceso, Completado).
2. **Encabezado Único de Plantilla:** Indicador de la plantilla asociada a la fase actual con botón directo para maquetar en código.
3. **Barra de Herramientas Operativa:**
   - `[✨ Redactar con IA]`: Abre el asistente modal para ingresar texto o adjuntar notas/PDFs.
   - `[💾 Guardar]`: Almacena las modificaciones manuales hechas directamente sobre el documento editable.
   - `[⬇️ Descargar Word (.docx)]`: Exporta el archivo Word editable oficial con el formato de ENDE DEORURO.
   - Selector de modo de vista: Modo paginado (hoja por hoja con numeración) o vista continua.
4. **Visores Dedicados por Carpeta:**
   - `TdrDocumentViewer`: Visor maestro con portada oficial, cuadro de firmas y especificaciones.
   - `SolicitudInicioViewer`: Memorándum formal con configuración de autoridades y fechas.
   - `FormS2Viewer`: Formulario de invitación y tabla de ítems a cotizar.
   - `InformeConformidadViewer`: Cuadro de recepción técnica y conclusión de cumplimiento.
   - `MemoPagoViewer`: Memorándum de liquidación financiera y datos bancarios.

---

## 🔌 Mapa de Endpoints y Servicios API

| Ruta API | Método | Función |
| :--- | :---: | :--- |
| `/api/ai/generate-tdr` | `POST` | Estructuración técnica completa del TDR de 7 páginas y desglose de ítems con IA. |
| `/api/ai/generate-solicitud-inicio` | `POST` | Generación del memorándum de inicio de proceso consolidando datos del TDR. |
| `/api/ai/generate-s2` | `POST` | Generación de la solicitud oficial de cotización Formulario S2-N014. |
| `/api/ai/generate-informe-conformidad`| `POST`| Redacción del Informe de Conformidad A6-N014 de recepción técnica. |
| `/api/ai/generate-memo-pago` | `POST` | Generación del memorándum formal de trámite de pago y factura. |
| `/api/docx/transpile` | `POST` | Transpilador de cualquier `.docx` subido a código nativo de plantilla. |
| `/api/docx/inspect` | `POST` | Análisis estructural de campos, párrafos y tablas de un Word. |
| `/api/docx/smart-fill` | `POST` | Inyección de datos y tablas dinámicas en documentos Word. |
| `/api/docx/generate` | `POST` | Compilador cliente/servidor de archivos `.docx` finales con biblioteca `docx`. |
| `/api/anythingllm` | `POST` | Puente de comunicación con el motor de RAG AnythingLLM del VPS. |
| `/api/db/sync` | `POST` | Sincronizador bidireccional local-nube con Supabase. |

---

## ⚙️ Configuración de Variables de Entorno

Crear un archivo `.env.local` en la raíz del proyecto tomando como base `.env.example`:

```env
# Conexión Supabase (Nube)
NEXT_PUBLIC_SUPABASE_URL=https://<tu-proyecto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<tu-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<tu-service-role-key>

# Servidor VPS y Motor de Documentos
VPS_ENGINE_URL=http://85.31.230.163:8080
ANYTHINGLLM_URL=http://85.31.230.163:3005
ANYTHINGLLM_API_KEY=<CONFIGURAR_EN_ENTORNO>
ANYTHINGLLM_WORKSPACE=adquisiciones-ende

# Proveedor de Inteligencia Artificial
OPENCODE_GO_API_KEY=<tu-api-key>
OPENCODE_GO_BASE_URL=https://opencode.ai/zen/go/v1
OPENCODE_GO_MODEL=deepseek-v4-flash-vision-exp
```

---

## 🚀 Instalación y Despliegue

### Requisitos Previos
- **Node.js** 18.17 o superior
- **npm** o **pnpm**
- Servidor VPS Ubuntu con Docker y Python 3.10+ (opcional para el motor de microservicios)

### Pasos de Instalación Local

```bash
# 1. Clonar el repositorio
git clone https://github.com/fortunaglobalbo/adquisicion-bienes.git
cd adquisicion-bienes

# 2. Instalar dependencias
npm install

# 3. Validar tipado TypeScript
npx tsc --noEmit

# 4. Iniciar servidor de desarrollo
npm run dev
```

La aplicación estará accesible en `http://localhost:3000`.

### Despliegue en Producción (Vercel)

El proyecto está optimizado para su despliegue continuo en **Vercel**:

```bash
# Compilar y validar el paquete de producción
npm run build

# Desplegar cambios hacia la rama principal
git push origin main
```
*Vercel detecta automáticamente las actualizaciones en la rama `main` y despliega la versión de producción sin tiempo de inactividad.*

---

## 🏢 Créditos Institucionales
- **Entidad:** Distribuidora de Electricidad ENDE DEORURO S.A.
- **Marco Legal:** Reglamento de Adquisición de Bienes, Construcción de Obras y Contratación de Servicios (SBC).
- **Desarrollado para:** Automatización técnica de procesos de compra, transparencia operativa y agilización del flujo de expedientes institucionales.
