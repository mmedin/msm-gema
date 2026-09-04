# Backlog de Mejoras y Deuda Técnica — GEMA

> **Plataforma de Gestión de Eventos Meteorológicos Adversos**
> **Municipalidad de General San Martín — Provincia de Buenos Aires**
> *Documento vivo de mejoras y deuda técnica. Actualizado con cada revisión de auditoría.*

---

## 🎯 Índice de Épicas y Prioridades

| Prioridad | Épica / Dominio | Tareas | Completadas | Estado |
| :---: | :--- | :---: | :---: | :---: |
| 🔴 **P1** | [Seguridad y Control de Acceso](#1-seguridad-y-control-de-acceso-p1) | 7 | 7 | Completado |
| 🔴 **P1** | [Concurrencia e Integridad Transaccional](#2-concurrencia-e-integridad-transaccional-p1) | 3 | 3 | Completado |
| 🔴 **P1** | [DevOps y Estabilidad de Despliegue](#3-devops-y-estabilidad-de-despliegue-p1) | 5 | 5 | Completado |
| 🟠 **P2** | [Rendimiento y Optimización de Base de Datos](#4-rendimiento-y-optimización-de-base-de-datos-p2) | 3 | 3 | Completado |
| 🟠 **P2** | [Autonomía Offline y Redundancia](#5-autonomía-offline-y-redundancia-p2) | 1 | 0 | Pendiente |
| 🟡 **P3** | [Frontend, UX Móvil y Navegación](#6-frontend-ux-móvil-y-navegación-p3) | 5 | 0 | Pendiente |
| 🟡 **P3** | [Arquitectura y Calidad de Código](#7-arquitectura-y-calidad-de-código-p3) | 5 | 0 | Pendiente |
| 🟡 **P3** | [Testing Automatizado y Tooling](#8-testing-automatizado-y-tooling-p3) | 3 | 0 | Pendiente |

---

## 1. Seguridad y Control de Acceso (P1)

### [SEC-01] ✅ Corrección de CORS con comodín y credenciales
* **Archivos involucrados:** `backend/src/index.ts`, `backend/src/config.ts`
* **Problema:** Se configuró `cors({ origin: '*', credentials: true })`, lo cual viola el estándar W3C/Fetch y es bloqueado por navegadores modernos al intercambiar credenciales de autorización.
* **Criterios de Aceptación:**
  - [x] El middleware CORS utiliza `config.frontendUrl` o un array de orígenes permitidos explícitos.
  - [x] Se verifica que las peticiones desde el frontend en dev (puerto 3000) y prod respondan con los encabezados correspondientes.

### [SEC-02] ✅ Sanitización de extensión en subida de evidencias
* **Archivos involucrados:** `backend/src/middleware/upload.ts`
* **Problema:** Solo se valida el MIME type pero se conserva la extensión enviada por el cliente (`file.originalname`), permitiendo la subida de archivos con extensión `.html` o `.svg` encubiertos como imágenes (riesgo de Stored XSS).
* **Criterios de Aceptación:**
  - [x] La extensión del archivo guardado en disco se infiere estrictamente del MIME type verificado (`image/jpeg` → `.jpg`, `image/png` → `.png`, `image/webp` → `.webp`).
  - [x] Se descarta y no se persiste ningún archivo cuyo payload posterior falle (limpieza de huérfanos con `fs.unlink`).

### [SEC-03] ✅ Alinear código HTTP en expiración de JWT (401 vs 403) y Rate Limiting en Login
* **Archivos involucrados:** `backend/src/middleware/auth.ts`, `backend/src/routes/auth.ts`, `frontend/src/api.ts`
* **Problema:**
  - El backend responde `403` al expirar el JWT, pero el frontend escucha únicamente `401` para redirigir a `/login`, causando un bloqueo silencioso en la interfaz tras 24 horas.
  - `/api/auth/login` no posee límite de intentos, exponiendo al sistema a fuerza bruta.
* **Criterios de Aceptación:**
  - [x] Tokens inválidos o expirados responden con código `401 Unauthorized`.
  - [x] Tokens válidos pero sin permisos de rol responden con código `403 Forbidden`.
  - [x] Se agrega `express-rate-limit` en `/api/auth/login` (máx. 10 intentos por minuto por IP).
  - [x] El frontend redirige fluidamente al login al recibir un 401.

### [SEC-04] ✅ Eliminación de secrets hardcodeados como fallback
* **Archivos involucrados:** `backend/src/config.ts`, `docker-compose.yml`, `.env.example`
* **Problema:** El JWT secret y la contraseña de PostgreSQL tienen valores por defecto estáticos en el código fuente y en el docker-compose. Cualquiera con acceso al repositorio puede forjar tokens válidos o conectarse a la base de datos.
  ```typescript
  // backend/src/config.ts:6
  jwtSecret: process.env.JWT_SECRET || 'super_secreto_para_jwt_crisis_san_martin_2026',
  ```
  ```yaml
  # docker-compose.yml:9
  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-crisis_secret_2026}
  # docker-compose.yml:33
  JWT_SECRET: ${JWT_SECRET:-super_secreto_para_jwt_crisis_san_martin_2026}
  ```
* **Criterios de Aceptación:**
  - [x] `config.ts` lanza un error fatal al arrancar si `JWT_SECRET` o `DATABASE_URL` no están definidos como variables de entorno (fail fast, sin fallback).
  - [x] `docker-compose.yml` no contiene valores por defecto para `POSTGRES_PASSWORD` ni `JWT_SECRET`.
  - [x] `.env.example` documenta los valores como placeholders que deben cambiarse, no como valores funcionales.

### [SEC-05] ✅ JWT de larga duración sin mecanismo de revocación
* **Archivos involucrados:** `backend/src/routes/auth.ts`, `backend/src/middleware/auth.ts`
* **Problema:** El token JWT tiene una vida útil de 24 horas (`expiresIn: '24h'` en `auth.ts:57`). Si un operario pierde el celular o un administrador desactiva una cuenta, el token sigue siendo válido hasta su expiración. El middleware `authenticateToken` confía exclusivamente en la firma del JWT sin re-verificar contra la base de datos, por lo que un usuario con `active: false` puede seguir operando. (Nota: el endpoint `/auth/me` sí valida `active`, pero no protege las demás rutas.)
* **Criterios de Aceptación:**
  - [x] El middleware `authenticateToken` verifica el campo `active` del usuario contra la DB en cada request (con caché en memoria breve de ~60s para no degradar performance).
  - [x] Se reduce la vida del token a 1-2 horas con un endpoint de refresh, o se implementa una blacklist de tokens en Redis/memoria.

### [SEC-06] ✅ Sin validación de complejidad de contraseña
* **Archivos involucrados:** `backend/src/routes/users.ts`
* **Problema:** Los endpoints de creación (`POST /users`) y reseteo (`PATCH /users/:id`) de usuario aceptan cualquier contraseña sin validar largo mínimo, complejidad o diccionario. Un administrador podría establecer `"1"` como contraseña de un operador.
* **Criterios de Aceptación:**
  - [x] Se exige un mínimo de 8 caracteres para las contraseñas.
  - [x] Se provee un mensaje de error descriptivo cuando la contraseña no cumple los requisitos.

### [SEC-07] ✅ Token almacenado en `localStorage` (vulnerable a XSS)
* **Archivos involucrados:** `frontend/src/api.ts`
* **Problema:** El JWT se almacena en `localStorage` (`api.ts:19`). Aunque Helmet mitiga vectores XSS desde el backend, `localStorage` es accesible desde cualquier script que corra en el mismo origen. Una `httpOnly cookie` sería más seguro para un sistema gubernamental de misión crítica.
* **Criterios de Aceptación:**
  - [x] Se evalúa migración a `httpOnly` + `Secure` + `SameSite=Strict` cookie.
  - [x] Si se mantiene `localStorage`, se documenta la decisión con análisis de riesgo aceptado y se asegura CSP estricto en Nginx.
* **Resolución:** Se documenta la decisión en [ADR SEC-07](adr-sec07-localstorage.md). Se mantiene `localStorage` con CSP estricto en Nginx como mitigación.

---

## 2. Concurrencia e Integridad Transaccional (P1)

### [DATA-01] ✅ Generación atómica de códigos correlativos (TAR-xxx, INC-xxx, YYYY-xxx)
* **Archivos involucrados:** `backend/src/routes/tasks.ts`, `backend/src/routes/incidents.ts`, `backend/src/routes/events.ts`, `backend/src/routes/notices.ts`, `backend/src/utils/atomicSequence.ts`
* **Problema:** Se calcula el correlativo haciendo `count() + 1`. Ante peticiones concurrentes de operadores durante una tormenta, el recuento arroja el mismo valor, provocando colisión de clave única (`@@unique([event_id, code])`) y errores 500 no recuperables.
* **Criterios de Aceptación:**
  - [x] Los códigos se generan usando secuencias de PostgreSQL (`CREATE SEQUENCE`) o lógica de reintento/bloqueo a nivel de evento.
  - [x] Dos peticiones concurrentes en el mismo milisegundo obtienen correlativos consecutivos sin colisión.

### [DATA-02] ✅ Control transaccional y prevención de carreras en ocupación de refugios
* **Archivos involucrados:** `backend/src/routes/evacuation.ts`
* **Problema:** El cálculo de `newOccupied` lee el último registro con `findFirst` y crea uno nuevo sin transacción ni bloqueo a nivel de fila. Dos ingresos simultáneos pisan el total del centro de evacuados.
* **Criterios de Aceptación:**
  - [x] El registro de ocupación se ejecuta dentro de un `prisma.$transaction`.
  - [x] Se bloquea la fila del centro de evacuados (`FOR UPDATE`) antes de leer y calcular el balance.
  - [x] Si el balance resultante fuera negativo o superara la capacidad extrema permitida, se rechaza la transacción de forma consistente.

### [DATA-03] ✅ Uso de transacciones Prisma en operaciones multi-tabla
* **Archivos involucrados:** `backend/src/routes/notices.ts`, `backend/src/routes/tasks.ts`
* **Problema:** La conversión de avisos a incidentes y la creación de tareas con actualización de incidentes ocurren en pasos independientes fuera de una transacción.
* **Criterios de Aceptación:**
  - [x] `noticesRouter.patch('/:id/convert')` agrupa `incident.create`, `notice.update` y `auditLog.create` dentro de un `$transaction`.
  - [x] `tasksRouter.post('/')` agrupa `task.create`, `incident.update` y `auditLog.create` dentro de un `$transaction`.

---

## 3. DevOps y Estabilidad de Despliegue (P1)

### [OPS-01] ✅ Reemplazo de `prisma db push` por migraciones versionadas en Producción
* **Archivos involucrados:** `backend/entrypoint.sh`, `backend/prisma/`
* **Problema:** En el inicio del contenedor se ejecuta `prisma db push --accept-data-loss`. En producción esto puede eliminar columnas o datos reales ante modificaciones del modelo y genera carreras en arquitecturas con múltiples réplicas.
* **Criterios de Aceptación:**
  - [x] Se inicializa el historial de migraciones con `npx prisma migrate dev --name init`.
  - [x] `entrypoint.sh` ejecuta `npx prisma migrate deploy`.
  - [x] Se retira la bandera `--accept-data-loss` del entorno productivo.

### [OPS-02] ✅ Endurecimiento y Multi-Stage Build en Dockerfile del Backend
* **Archivos involucrados:** `backend/Dockerfile`
* **Problema:** El contenedor corre como `root` y retiene todas las dependencias de desarrollo (`typescript`, `tsx`, `prisma` CLI, compiladores) en la imagen productiva. Esto aumenta la superficie de ataque y el tamaño de la imagen (~200MB+ extras).
* **Criterios de Aceptación:**
  - [x] Se configura un build multi-stage en Docker (etapa `builder` y etapa `runner`).
  - [x] La imagen final corre bajo el usuario sin privilegios `USER node`.
  - [x] Se instalan solo dependencias de producción (`npm install --omit=dev`).

### [OPS-03] ✅ Generar y versionar `package-lock.json`
* **Archivos involucrados:** `backend/package.json`, `frontend/package.json`, `.gitignore`
* **Problema:** No existe `package-lock.json` en ninguno de los dos proyectos (backend ni frontend). Esto significa que `npm install` dentro del Dockerfile puede resolver versiones distintas de dependencias en cada build, rompiendo la reproducibilidad. Un `npm install` hoy puede instalar una versión minor diferente a la de mañana.
* **Criterios de Aceptación:**
  - [x] Se ejecuta `npm install` localmente en `backend/` y `frontend/` para generar los `package-lock.json`.
  - [x] Se commitean los `package-lock.json` al repositorio.
  - [x] Los Dockerfiles usan `npm ci` en vez de `npm install` para instalación determinista.

### [OPS-04] ✅ Crear `.dockerignore` en backend y frontend
* **Archivos involucrados:** `backend/.dockerignore` (nuevo), `frontend/.dockerignore` (nuevo)
* **Problema:** Sin `.dockerignore`, el build context de Docker envía `node_modules/`, `.git/`, archivos temporales y cualquier otro archivo del directorio al daemon, generando imágenes más pesadas, builds más lentos y potencial filtración de datos sensibles a la imagen.
* **Criterios de Aceptación:**
  - [x] Se crea `backend/.dockerignore` excluyendo como mínimo: `node_modules`, `dist`, `.git`, `.env`, `*.log`, `.DS_Store`.
  - [x] Se crea `frontend/.dockerignore` excluyendo como mínimo: `node_modules`, `dist`, `.git`, `.env`, `*.log`, `.DS_Store`.

### [OPS-05] ✅ Graceful shutdown del proceso Node.js
* **Archivos involucrados:** `backend/src/index.ts`
* **Problema:** No hay handlers para `SIGTERM` / `SIGINT`. Cuando Docker envía la señal de parada al contenedor, las conexiones activas de Prisma y las requests HTTP en curso se cortan abruptamente sin `prisma.$disconnect()` ni cierre limpio del servidor Express.
* **Criterios de Aceptación:**
  - [x] Se registran handlers para `SIGTERM` y `SIGINT` que cierren el servidor HTTP y ejecuten `prisma.$disconnect()`.
  - [x] Se configura un `stop_grace_period` razonable en `docker-compose.yml` (ej. 15s).

---

## 4. Rendimiento y Optimización de Base de Datos (P2)

### [PERF-01] ✅ Eliminación del problema N+1 en Dashboard y Refugios
* **Archivos involucrados:** `backend/src/routes/dashboard.ts`, `backend/src/routes/evacuation.ts`
* **Problema:**
  - `/api/dashboard/stats` ejecuta más de 40 consultas individuales a la base de datos por cada petición: un bucle `for` sobre áreas con 6 `prisma.task.count()` por cada área (~30 queries solo el desglose), más queries de inactividad, contadores generales y ocupación de centros.
  - `/api/evacuation-centers` ejecuta `Promise.all` con 1 `findFirst` por cada centro para obtener la ocupación.
  - Al realizarse polling cada 20 segundos desde múltiples clientes, la base de datos sufre degradación innecesaria.
* **Criterios de Aceptación:**
  - [x] Los totales por área del dashboard se resuelven en una única consulta agrupada (`groupBy` o agregación SQL nativa).
  - [x] La ocupación actual de los centros de evacuados se consulta mediante una sola query agregada (`DISTINCT ON` en Postgres o guardando `current_occupied` desnormalizado en la tabla `evacuation_centers`).

### [PERF-02] ✅ Índices faltantes en PostgreSQL (Prisma Schema)
* **Archivos involucrados:** `backend/prisma/schema.prisma`
* **Problema:** Prisma crea índices automáticos solo para `@id`, `@unique` y `@@unique`. Las claves foráneas y columnas de filtro frecuente carecen de índices, obligando a sequential scans en tablas que crecen durante cada evento.
* **Criterios de Aceptación:**
  - [x] Se agregan índices explícitos:
    - `Notice`: `@@index([event_id])`, `@@index([status])`, `@@index([incident_id])`.
    - `Incident`: `@@index([event_id, status])`, `@@index([priority])`, `@@index([last_activity_at])`.
    - `Task`: `@@index([event_id, status])`, `@@index([area_id])`, `@@index([assignee_id])`, `@@index([priority])`, `@@index([last_activity_at])`.
    - `EvacuationOccupancyLog`: `@@index([center_id, event_id, created_at])`.
    - `AuditLog`: `@@index([actor_id])`, `@@index([entity, entity_id])`.

### [PERF-03] ✅ Paginación en endpoints de alta frecuencia
* **Archivos involucrados:** `backend/src/routes/incidents.ts`, `backend/src/routes/tasks.ts`, `backend/src/routes/notices.ts`
* **Problema:** Todos los listados traen la totalidad de los registros de la base sin `take`/`skip`, lo cual degradará el consumo de memoria y el tiempo de respuesta en tormentas con cientos o miles de registros.
* **Criterios de Aceptación:**
  - [x] Los endpoints soportan parámetros opcionales `limit` (con valor por defecto razonable, ej. 50) y `cursor` o `offset`.
  - [x] Los filtros principales respetan la paginación sin degradar la visualización en frontend.

---

## 5. Autonomía Offline y Redundancia (P2)

### [OFF-01] Empaquetado local de Leaflet CSS y tipografías (100% Autónomo)
* **Archivos involucrados:** `frontend/index.html`, `frontend/src/main.tsx`, `frontend/package.json`
* **Problema:** Se cargan estilos de Leaflet desde `unpkg.com` y fuentes desde `fonts.googleapis.com`. Si durante una catástrofe cae el enlace a internet del municipio y el sistema opera en LAN o enlace satelital cerrado, el mapa se desconfigura visualmente y las fuentes no cargan.
  ```html
  <!-- frontend/index.html:10 -->
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" ... />
  <!-- frontend/index.html:14 -->
  <link href="https://fonts.googleapis.com/css2?family=Inter..." />
  ```
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
* **Problema:** La navegación se basa exclusivamente en un `useState` en memoria (`App.tsx:18`). Recargar la página reinicia la vista y no es posible compartir enlaces directos a un incidente o tarea específica.
* **Criterios de Aceptación:**
  - [ ] Se integra navegación URL (mediante `react-router-dom` o sincronización con `window.location.hash`).
  - [ ] Las rutas `/situacion`, `/incidentes`, `/mis-tareas`, `/mi-area`, `/centros`, `/mapa` y `/admin` son accesibles directamente y preservan el historial del navegador.

### [UX-03] Polling sincronizado y prevención de peticiones superpuestas
* **Archivos involucrados:** Vistas con polling activo (`SituacionGeneral.tsx`, `MisTareas.tsx`, etc.)
* **Problema:** `setInterval` dispara consultas cada 20 segundos sin esperar la respuesta de la petición previa, generando colas de peticiones en conexiones móviles lentas.
* **Criterios de Aceptación:**
  - [ ] El polling se ejecuta con encadenamiento (`setTimeout` recursivo al resolver la promesa) o mediante TanStack Query con `refetchInterval`.

### [UX-04] Eliminar restricción de zoom `user-scalable=no`
* **Archivos involucrados:** `frontend/index.html`
* **Problema:** El viewport meta incluye `maximum-scale=1.0, user-scalable=no`, lo cual viola la pauta WCAG 1.4.4 (Resize Text) e impide que usuarios con baja visión hagan zoom. Además, iOS Safari ignora `user-scalable=no` desde iOS 10+.
  ```html
  <!-- frontend/index.html:6 -->
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  ```
* **Criterios de Aceptación:**
  - [ ] Se elimina `maximum-scale=1.0` y `user-scalable=no` del meta viewport.
  - [ ] Se mantiene `viewport-fit=cover` para dispositivos con notch.
  - [ ] Para los inputs que producen zoom molesto en iOS, se usa `font-size: 16px` como mínimo.

### [UX-05] Headers de seguridad en Nginx para contenido estático
* **Archivos involucrados:** `frontend/nginx.conf`
* **Problema:** Nginx no agrega headers de seguridad (`X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy`) al contenido estático del frontend. Helmet los pone solo en las respuestas del backend (`/api/`). Además, los locations `/uploads/` y `/datos-geo/` usan `Access-Control-Allow-Origin: *`, lo cual es excesivamente permisivo para archivos de evidencia fotográfica.
* **Criterios de Aceptación:**
  - [ ] Se agregan headers de seguridad globales en Nginx: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`.
  - [ ] Se restringe `Access-Control-Allow-Origin` en `/uploads/` al mismo origen o al dominio configurado.
  - [ ] Se evalúa agregar una política CSP básica.

---

## 7. Arquitectura y Calidad de Código (P3)

### [ARCH-01] Validación de esquemas en Backend con Zod
* **Archivos involucrados:** `backend/src/routes/*.ts`
* **Problema:** Ausencia de validación estricta de payloads; se utilizan casts manuales (ej. `role as user_role`) que generan excepciones no controladas de Prisma ante enums erróneos, resultando en errores 500 crípticos en vez de 400 descriptivos.
* **Criterios de Aceptación:**
  - [ ] Se definen esquemas Zod para la creación y actualización de eventos, avisos, incidentes, tareas y ocupación.
  - [ ] Peticiones con datos inválidos devuelven `400 Bad Request` con el desglose exacto de campos fallidos.

### [ARCH-02] Desacoplamiento de capa de servicios
* **Archivos involucrados:** `backend/src/routes/`, `backend/src/services/` (nuevo)
* **Problema:** Los manejadores de Express combinan parsing HTTP, reglas complejas de negocio (verificación cruzada, cálculo de inactividad, transiciones de estado) y llamadas directas a Prisma. Esto impide testear la lógica de negocio de forma aislada.
* **Criterios de Aceptación:**
  - [ ] Se extrae la lógica de negocio a servicios desacoplados (`TaskService`, `IncidentService`, `EvacuationService`).
  - [ ] Los controladores de ruta quedan limitados a autenticación, validación de entrada y respuesta HTTP.

### [ARCH-03] Eliminación del uso extensivo de `any` en TypeScript
* **Archivos involucrados:** Todos los archivos en `backend/src/routes/`, `backend/src/middleware/`, `backend/src/utils/`
* **Problema:** Se identifican **18 ocurrencias** de `: any` en el backend, anulando las garantías del sistema de tipos de TypeScript. Patrones más frecuentes:
  - `const whereClause: any = {}` — debería ser `Prisma.TaskWhereInput` o similar.
  - `const dataToUpdate: any = {}` — debería ser `Prisma.IncidentUpdateInput` o similar.
  - `catch (error: any)` — debería ser `catch (error: unknown)` con type narrowing.
* **Criterios de Aceptación:**
  - [ ] Se reemplazan las 18 ocurrencias de `any` por tipos concretos de Prisma o tipos propios.
  - [ ] Se habilita `noImplicitAny: true` en `backend/tsconfig.json` (ya está cubierto por `strict: true`, pero verificar que no haya excepciones).

### [ARCH-04] Eliminar dependencia muerta `dotenv`
* **Archivos involucrados:** `backend/package.json`
* **Problema:** `dotenv` está listada como dependencia de producción (`package.json:19`) pero no se importa ni se usa en ningún archivo del `src/`. Es peso muerto en la imagen Docker.
* **Criterios de Aceptación:**
  - [ ] Se elimina `dotenv` de `dependencies` en `backend/package.json`.
  - [ ] Se verifica que el entrypoint y los scripts no dependan de ella.

### [ARCH-05] Separar datos de fixture del seed maestro
* **Archivos involucrados:** `backend/prisma/seed.ts`
* **Problema:** El script de seed mezcla datos maestros (áreas, usuarios, centros de evacuados) con datos de demo/fixture (evento de prueba, incidentes, avisos y tareas ficticias desde la línea ~170 en adelante). Cada deploy ejecuta el seed, lo cual podría crear datos de prueba en producción.
* **Criterios de Aceptación:**
  - [ ] Se separa `seed.ts` en dos archivos: `seed-master.ts` (áreas, usuarios, centros) y `seed-demo.ts` (evento, incidentes, avisos, tareas).
  - [ ] `entrypoint.sh` ejecuta solo el seed maestro. El seed de demo se corre manualmente o condicionado a `NODE_ENV !== 'production'`.

---

## 8. Testing Automatizado y Tooling (P3)

### [TEST-01] Configuración de pruebas unitarias y de integración
* **Archivos involucrados:** `backend/package.json`, `frontend/package.json`
* **Problema:** El repositorio cuenta con un 0% de cobertura de tests automatizados. No existen archivos `*.test.*` ni `*.spec.*` en ningún lugar del repo. Para un sistema de misión crítica que gestiona emergencias reales, esto implica un riesgo alto de regresiones no detectadas.
* **Criterios de Aceptación:**
  - [ ] Se configura Vitest y Supertest en el backend.
  - [ ] Se implementan tests para las reglas críticas del sistema:
    - Regla de autoasignación del coordinador de área (solo verificable por Coordinación General).
    - Privilegio estricto de triage P1-P4 (solo usuarios con `can_triage = true`).
    - Lógica del semáforo de inactividad (>30m para P1/P2 y >2h para P3/P4).
    - Prohibición de egresos que dejen el saldo de evacuados en valores negativos.
    - Generación atómica de correlativos bajo concurrencia.

### [TEST-02] Integración de Linters y Formateadores (ESLint / Prettier)
* **Archivos involucrados:** Raíz del proyecto, `backend/`, `frontend/`
* **Problema:** No hay reglas de estilo unificadas ni validación estática de código automatizada.
* **Criterios de Aceptación:**
  - [ ] Se configuran ESLint y Prettier con scripts de validación (`npm run lint`, `npm run format:check`).
  - [ ] Se habilitan en el frontend las opciones `noUnusedLocals` y `noUnusedParameters` en `tsconfig.json` (actualmente están en `false`).

### [TEST-03] Idempotencia en suite de pruebas de seguridad (`test-security.ts`)
* **Archivos involucrados:** `backend/scripts/test-security.ts`
* **Problema:** `test-security.ts` falla si se re-ejecuta sin reiniciar la base de datos. Utiliza un nombre de usuario estático hardcodeado (`test.sec06`) para probar la validación de complejidad de contraseña y la creación de usuarios. En la primera ejecución se crea satisfactoriamente, pero en ejecuciones subsiguientes el endpoint responde `400 "El nombre de usuario ya existe"`, interrumpiendo la suite.
* **Criterios de Aceptación:**
  - [ ] Generar nombres de usuario dinámicos/únicos por ejecución (ej. `test.sec06_${Date.now()}`) o realizar limpieza/desactivación del usuario al finalizar el test suite (teardown).
  - [ ] La suite puede ejecutarse múltiples veces consecutivas de forma idempotente sin requerir reinicio o purga de la base de datos.

---

## 📋 Observaciones Menores

Ítems de bajo esfuerzo y bajo riesgo que no justifican una tarea individual, pero que deberían resolverse oportunísticamente al tocar los archivos involucrados:

| # | Observación | Archivo(s) |
|:--|:---------|:-----------|
| 1 | `.DS_Store` está trackeado en git (aparece en la raíz del repo). Debería agregarse a `.gitignore` y eliminarse del tracking. | `.gitignore` |
| 2 | `api.getDashboardSnapshot` retorna `request<any>` — pérdida de tipado innecesaria. | `frontend/src/api.ts:220` |
| 3 | `api.createUser` y `api.updateUser` aceptan `data: any` en vez de tipos concretos. | `frontend/src/api.ts:232-241` |
| 4 | `frontend/src/pages/IncidentesAvisos.tsx` tiene ~30KB — componente monolítico difícil de mantener. Considerar descomponerlo. | `frontend/src/pages/IncidentesAvisos.tsx` |
| 5 | La carga inicial de `AuthContext` ejecuta `refreshUser` y `refreshActiveEvent` en secuencia; podrían ejecutarse en paralelo con `Promise.all`. | `frontend/src/context/AuthContext.tsx:50-51` |
| 6 | `frontend/tsconfig.json` tiene `noUnusedLocals: false` y `noUnusedParameters: false`, debilitando la detección de código muerto. | `frontend/tsconfig.json:15-16` |

---

## 📜 Historial de Revisiones

| Fecha | Descripción |
|:------|:------------|
| Sept 2026 (rev 2) | Auditoría de mejores prácticas: se agregan 13 ítems nuevos (SEC-04 a SEC-07, OPS-03 a OPS-05, ARCH-03 a ARCH-05, UX-04, UX-05). Se enriquecen ítems existentes con extractos de código y detalles técnicos. Se agrega sección de observaciones menores e historial. |
| Sept 2026 (rev 1) | Auditoría técnica integral inicial: seguridad, concurrencia, rendimiento, DevOps y UX. Se completan SEC-01 a SEC-03 y DATA-01 a DATA-03. |
