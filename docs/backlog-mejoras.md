# Backlog de Mejoras y Deuda Técnica — GEMA
> **Plataforma de Gestión de Eventos Meteorológicos Adversos**  
> **Municipalidad de General San Martín — Provincia de Buenos Aires**  
> *Documento generado a partir de la auditoría técnica integral (Seguridad, Concurrencia, Rendimiento, DevOps y UX).*

---

## 🎯 Índice de Épicas y Prioridades

| Prioridad | Épica / Dominio | Tareas | Estado |
| :---: | :--- | :---: | :---: |
| 🔴 **P1** | [Seguridad y Control de Acceso](#1-seguridad-y-control-de-acceso-p1) | 3 | Completado |
| 🔴 **P1** | [Concurrencia e Integridad Transaccional](#2-concurrencia-e-integridad-transaccional-p1) | 3 | Pendiente |
| 🔴 **P1** | [DevOps y Estabilidad de Despliegue](#3-devops-y-estabilidad-de-despliegue-p1) | 2 | Pendiente |
| 🟠 **P2** | [Rendimiento y Optimización de Base de Datos](#4-rendimiento-y-optimización-de-base-de-datos-p2) | 3 | Pendiente |
| 🟠 **P2** | [Autonomía Offline y Redundancia](#5-autonomía-offline-y-redundancia-p2) | 1 | Pendiente |
| 🟡 **P3** | [Frontend, UX Móvil y Navegación](#6-frontend-ux-móvil-y-navegación-p3) | 3 | Pendiente |
| 🟡 **P3** | [Arquitectura y Calidad de Código](#7-arquitectura-y-calidad-de-código-p3) | 2 | Pendiente |
| 🟡 **P3** | [Testing Automatizado y Tooling](#8-testing-automatizado-y-tooling-p3) | 2 | Pendiente |

---

## 1. Seguridad y Control de Acceso (P1)

### [SEC-01] Corrección de CORS con comodín y credenciales
* **Archivos involucrados:** `backend/src/index.ts`, `backend/src/config.ts`
* **Problema:** Se configuró `cors({ origin: '*', credentials: true })`, lo cual viola el estándar W3C/Fetch y es bloqueado por navegadores modernos al intercambiar credenciales de autorización.
* **Criterios de Aceptación:**
  - [x] El middleware CORS utiliza `config.frontendUrl` o un array de orígenes permitidos explícitos.
  - [x] Se verifica que las peticiones desde el frontend en dev (puerto 3000) y prod respondan con los encabezados correspondientes.

### [SEC-02] Sanitización de extensión en subida de evidencias
* **Archivos involucrados:** `backend/src/middleware/upload.ts`
* **Problema:** Solo se valida el MIME type pero se conserva la extensión enviada por el cliente (`file.originalname`), permitiendo la subida de archivos con extensión `.html` o `.svg` encubiertos como imágenes (riesgo de Stored XSS).
* **Criterios de Aceptación:**
  - [x] La extensión del archivo guardado en disco se infiere estrictamente del MIME type verificado (`image/jpeg` $\to$ `.jpg`, `image/png` $\to$ `.png`, `image/webp` $\to$ `.webp`).
  - [x] Se descarta y no se persiste ningún archivo cuyo payload posterior falle (limpieza de huérfanos con `fs.unlink`).

### [SEC-03] Alinear código HTTP en expiración de JWT (401 vs 403) y Rate Limiting en Login
* **Archivos involucrados:** `backend/src/middleware/auth.ts`, `backend/src/routes/auth.ts`, `frontend/src/api.ts`
* **Problema:** 
  - El backend responde `403` al expirar el JWT, pero el frontend escucha únicamente `401` para redirigir a `/login`, causando un bloqueo silencioso en la interfaz tras 24 horas.
  - `/api/auth/login` no posee límite de intentos, exponiendo al sistema a fuerza bruta.
* **Criterios de Aceptación:**
  - [x] Tokens inválidos o expirados responden con código `401 Unauthorized`.
  - [x] Tokens válidos pero sin permisos de rol responden con código `403 Forbidden`.
  - [x] Se agrega `express-rate-limit` en `/api/auth/login` (máx. 10 intentos por minuto por IP).
  - [x] El frontend redirige fluidamente al login al recibir un 401.

---

## 2. Concurrencia e Integridad Transaccional (P1)

### [DATA-01] Generación atómica de códigos correlativos (TAR-xxx, INC-xxx, YYYY-xxx)
* **Archivos involucrados:** `backend/src/routes/tasks.ts`, `backend/src/routes/incidents.ts`, `backend/src/routes/events.ts`
* **Problema:** Se calcula el correlativo haciendo `count() + 1`. Ante peticiones concurrentes de operadores durante una tormenta, el recuento arroja el mismo valor, provocando colisión de clave única (`@@unique([event_id, code])`) y errores 500 no recuperables.
* **Criterios de Aceptación:**
  - [ ] Los códigos se generan usando secuencias de PostgreSQL (`CREATE SEQUENCE`) o lógica de reintento/bloqueo a nivel de evento.
  - [ ] Dos peticiones concurrentes en el mismo milisegundo obtienen correlativos consecutivos sin colisión.

### [DATA-02] Control transaccional y prevención de carreras en ocupación de refugios
* **Archivos involucrados:** `backend/src/routes/evacuation.ts`
* **Problema:** El cálculo de `newOccupied` lee el último registro con `findFirst` y crea uno nuevo sin transacción ni bloqueo a nivel de fila. Dos ingresos simultáneos pisan el total del centro de evacuados.
* **Criterios de Aceptación:**
  - [ ] El registro de ocupación se ejecuta dentro de un `prisma.$transaction`.
  - [ ] Se bloquea la fila del centro de evacuados (`FOR UPDATE`) antes de leer y calcular el balance.
  - [ ] Si el balance resultante fuera negativo o superara la capacidad extrema permitida, se rechaza la transacción de forma consistente.

### [DATA-03] Uso de transacciones Prisma en operaciones multi-tabla
* **Archivos involucrados:** `backend/src/routes/notices.ts`, `backend/src/routes/tasks.ts`
* **Problema:** La conversión de avisos a incidentes y la creación de tareas con actualización de incidentes ocurren en pasos independientes fuera de una transacción.
* **Criterios de Aceptación:**
  - [ ] `noticesRouter.patch('/:id/convert')` agrupa `incident.create`, `notice.update` y `auditLog.create` dentro de un `$transaction`.
  - [ ] `tasksRouter.post('/')` agrupa `task.create`, `incident.update` y `auditLog.create` dentro de un `$transaction`.

---

## 3. DevOps y Estabilidad de Despliegue (P1)

### [OPS-01] Reemplazo de `prisma db push` por migraciones versionadas en Producción
* **Archivos involucrados:** `backend/entrypoint.sh`, `backend/prisma/`
* **Problema:** En el inicio del contenedor se ejecuta `prisma db push --accept-data-loss`. En producción esto puede eliminar columnas o datos reales ante modificaciones del modelo y genera carreras en arquitecturas con múltiples réplicas.
* **Criterios de Aceptación:**
  - [ ] Se inicializa el historial de migraciones con `npx prisma migrate dev --name init`.
  - [ ] `entrypoint.sh` ejecuta `npx prisma migrate deploy`.
  - [ ] Se retira la bandera `--accept-data-loss` del entorno productivo.

### [OPS-02] Endurecimiento y Multi-Stage Build en Dockerfile del Backend
* **Archivos involucrados:** `backend/Dockerfile`
* **Problema:** El contenedor corre como `root` y retiene todas las dependencias de desarrollo (`typescript`, `tsx`, `prisma` CLI, compiladores) en la imagen productiva.
* **Criterios de Aceptación:**
  - [ ] Se configura un build multi-stage en Docker (etapa `builder` y etapa `runner`).
  - [ ] La imagen final corre bajo el usuario sin privilegios `USER node`.
  - [ ] Se instalan solo dependencias de producción (`npm install --omit=dev`).

---

## 4. Rendimiento y Optimización de Base de Datos (P2)

### [PERF-01] Eliminación del problema N+1 en Dashboard y Refugios
* **Archivos involucrados:** `backend/src/routes/dashboard.ts`, `backend/src/routes/evacuation.ts`
* **Problema:**
  - `/api/dashboard/stats` ejecuta más de 40 consultas individuales a la base de datos por cada petición (bucles `for` y `Promise.all` con `count` repetitivos).
  - `/api/evacuation-centers` consulta el último log de ocupación centro por centro.
  - Al realizarse polling cada 20 segundos desde múltiples clientes, la base de datos sufre degradación innecesaria.
* **Criterios de Aceptación:**
  - [ ] Los totales por área del dashboard se resuelven en una única consulta agrupada (`groupBy` o agregación SQL nativa).
  - [ ] La ocupación actual de los centros de evacuados se consulta mediante una sola query agregada (`DISTINCT ON` en Postgres o guardando `current_occupied` desnormalizado en la tabla `evacuation_centers`).

### [PERF-02] Índices faltantes en PostgreSQL (Prisma Schema)
* **Archivos involucrados:** `backend/prisma/schema.prisma`
* **Problema:** Claves foráneas y columnas de filtro frecuente carecen de índices, obligando a realizar sequential scans continuos.
* **Criterios de Aceptación:**
  - [ ] Se agregan índices explícitos:
    - `Notice`: `@@index([event_id])`, `@@index([status])`, `@@index([incident_id])`.
    - `Incident`: `@@index([event_id, status])`, `@@index([priority])`, `@@index([last_activity_at])`.
    - `Task`: `@@index([event_id, status])`, `@@index([area_id])`, `@@index([assignee_id])`, `@@index([priority])`, `@@index([last_activity_at])`.
    - `EvacuationOccupancyLog`: `@@index([center_id, event_id, created_at])`.
    - `AuditLog`: `@@index([actor_id])`, `@@index([entity, entity_id])`.

### [PERF-03] Paginación en endpoints de alta frecuencia
* **Archivos involucrados:** `backend/src/routes/incidents.ts`, `backend/src/routes/tasks.ts`, `backend/src/routes/notices.ts`
* **Problema:** Todos los listados traen la totalidad de los registros de la base sin límite, lo cual degradará el consumo de memoria en tormentas con cientos o miles de registros.
* **Criterios de Aceptación:**
  - [ ] Los endpoints soportan parámetros opcionales `limit` (con valor por defecto razonable, ej. 50) y `cursor` o `offset`.
  - [ ] Los filtros principales respetan la paginación sin degradar la visualización en frontend.

---

## 5. Autonomía Offline y Redundancia (P2)

### [OFF-01] Empaquetado local de Leaflet CSS y tipografías (100% Autónomo)
* **Archivos involucrados:** `frontend/index.html`, `frontend/src/main.tsx`, `frontend/package.json`
* **Problema:** Se cargan estilos de Leaflet desde `unpkg.com` y fuentes desde `fonts.googleapis.com`. Si durante una catástrofe cae el enlace a internet del municipio y el sistema opera en LAN o enlace satelital cerrado, el mapa se desconfigura visualmente.
* **Criterios de Aceptación:**
  - [ ] `leaflet.css` se importa directamente desde `node_modules` en `main.tsx` (`import 'leaflet/dist/leaflet.css';`).
  - [ ] Se eliminan las etiquetas `<link>` a CDNs externos en `index.html`.
  - [ ] Las fuentes se empaquetan localmente o se utilizan fuentes del sistema como fallback de alto contraste.

---

## 6. Frontend, UX Móvil y Navegación (P3)

### [UX-01] Reemplazo de `alert()` y `confirm()` nativos por Toasts y Modales
* **Archivos involucrados:** `frontend/src/pages/IncidentesAvisos.tsx`, `frontend/src/pages/MisTareas.tsx`, `frontend/src/pages/MiArea.tsx`, `frontend/src/pages/CentrosEvacuados.tsx`
* **Problema:** Los diálogos nativos del navegador congelan el hilo de ejecución, bloquean la interacción en celulares bajo la lluvia y pueden ser silenciados por el sistema operativo móvil.
* **Criterios de Aceptación:**
  - [ ] Se implementa un sistema de notificaciones Toast no bloqueante (ej. componente accesible de notificación o librería liviana).
  - [ ] Las confirmaciones críticas (ej. descartar aviso, cerrar incidente) utilizan modales dedicados coherentes con la estética oscura de la app.

### [UX-02] Enrutamiento URL y Deep Linking
* **Archivos involucrados:** `frontend/src/App.tsx`, `frontend/src/components/Sidebar.tsx`, `frontend/src/components/BottomNav.tsx`
* **Problema:** La navegación se basa exclusivamente en un `useState` en memoria. Recargar la página reinicia la vista y no es posible compartir enlaces directos a un incidente o tarea específica.
* **Criterios de Aceptación:**
  - [ ] Se integra navegación URL (mediante `react-router-dom` o sincronización con `window.location.hash`).
  - [ ] Las rutas `/situacion`, `/incidentes`, `/mis-tareas`, `/mi-area`, `/centros`, `/mapa` y `/admin` son accesibles directamente y preservan el historial del navegador.

### [UX-03] Polling sincronizado y prevención de peticiones superpuestas
* **Archivos involucrados:** Vistas con polling activo (`SituacionGeneral.tsx`, `MisTareas.tsx`, etc.)
* **Problema:** `setInterval` dispara consultas cada 20 segundos sin esperar la respuesta de la petición previa, generando colas de peticiones en conexiones móviles lentas.
* **Criterios de Aceptación:**
  - [ ] El polling se ejecuta con encadenamiento (`setTimeout` recursivo al resolver la promesa) o mediante TanStack Query con `refetchInterval`.

---

## 7. Arquitectura y Calidad de Código (P3)

### [ARCH-01] Validación de esquemas en Backend con Zod
* **Archivos involucrados:** `backend/src/routes/*.ts`
* **Problema:** Ausencia de validación estricta de payloads; se utilizan casts manuales que generan excepciones no controladas de Prisma ante enums erróneos.
* **Criterios de Aceptación:**
  - [ ] Se definen esquemas Zod para la creación y actualización de eventos, avisos, incidentes, tareas y ocupación.
  - [ ] Peticiones con datos inválidos devuelven `400 Bad Request` con el desglose exacto de campos fallidos.

### [ARCH-02] Desacoplamiento de capa de servicios
* **Archivos involucrados:** `backend/src/routes/`, `backend/src/services/`
* **Problema:** Los manejadores de Express combinan parsing HTTP, reglas complejas de negocio (verificación cruzada, cálculo de inactividad, transiciones de estado) y llamadas directas a Prisma.
* **Criterios de Aceptación:**
  - [ ] Se extrae la lógica de negocio a servicios desacoplados (`TaskService`, `IncidentService`, `EvacuationService`).
  - [ ] Los controladores de ruta quedan limitados a autenticación, validación de entrada y respuesta HTTP.

---

## 8. Testing Automatizado y Tooling (P3)

### [TEST-01] Configuración de pruebas unitarias y de integración
* **Archivos involucrados:** `backend/package.json`, `frontend/package.json`
* **Problema:** El repositorio cuenta con un 0% de cobertura de tests automatizados.
* **Criterios de Aceptación:**
  - [ ] Se configura Vitest y Supertest en el backend.
  - [ ] Se implementan tests para las reglas críticas del sistema:
    - Regla de autoasignación del coordinador de área (solo verificable por Coordinación General).
    - Privilegio estricto de triage P1-P4 (solo usuarios con `can_triage = true`).
    - Lógica del semáforo de inactividad (>30m para P1/P2 y >2h para P3/P4).
    - Prohibición de egresos que dejen el saldo de evacuados en valores negativos.

### [TEST-02] Integración de Linters y Formateadores (ESLint / Prettier)
* **Archivos involucrados:** Raíz del proyecto, `backend/`, `frontend/`
* **Problema:** No hay reglas de estilo unificadas ni validación estática de código automatizada.
* **Criterios de Aceptación:**
  - [ ] Se configuran ESLint y Prettier con scripts de validación (`npm run lint`, `npm run format:check`).
