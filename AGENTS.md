# AGENTS.md - Documentación Técnica y Operativa para Agentes

> **GEMA - Gestión de Eventos Meteorológicos Adversos**  
> **Municipalidad de General San Martín - Provincia de Buenos Aires**  
> Plataforma de contingencia municipal de misión crítica para la gestión operativa de tormentas severas e inundaciones.

---

## 1. OBJETIVO Y FILOSOFÍA DEL SISTEMA

El sistema reemplaza la coordinación informal y fragmentada por WhatsApp durante tormentas e inundaciones severas por una **plataforma operativa común, centralizada, móvil-primero y de alta velocidad**.

### Principios Fundamentales de GEMA:
1. **Núcleo Operativo Estricto:** Se enfoca exclusivamente en Eventos, Avisos, Incidentes, Tareas sectoriales en 2 etapas, Mapa operativo con capas GeoJSON de San Martín y Ocupación numérica de centros de evacuados.
2. **Cero Fricción y Sin Dependencias Externas (Coolify Ready):**
   - No depende de servicios externos privativos (sin Cloudflare D1/R2, sin bots externos, sin APIs públicas de geocodificación propensas a caerse durante cortes de conectividad).
   - 100% autónomo y persistente sobre Docker y volúmenes locales.
3. **Móvil Primero para Operadores en la Calle:**
   - Botones táctiles grandes (mínimo 48px), transiciones de un toque (Aceptar -> En Camino -> En Ejecución -> Resolver / Impedimento).
   - Sin pantallas complejas ni formularios extensos para los operarios de campo.
4. **Sin Correos Electrónicos:**
   - La identidad del personal es `nombre.apellido` (ej. `coord.general`, `parques.oper`).
   - Altas, bajas y reseteos directos de contraseña administrados por el rol `ADMINISTRADOR`.
5. **Privacidad en Centros de Evacuados:**
   - Exclusivamente conteo numérico (+ / -). Prohibido registrar nombres, DNI o datos personales de evacuados.

---

## 2. ARQUITECTURA DE CONTENEDORES (DOCKER COMPOSE)

El stack opera mediante 3 servicios enlazados:

| Servicio | Imagen / Contexto | Puerto Expuesto | Función |
|---|---|---|---|
| **`db`** | `postgres:16-alpine` | Interno (5432) | Base de datos relacional con enums nativos y healthcheck `pg_isready`. Persiste en volumen `db_data`. |
| **`backend`** | `./backend` (`node:22-alpine`) | `4000:4000` | API REST Express + TypeScript + Prisma ORM. Ejecuta `db push` y siembra automática `prisma/seed.ts` al arrancar. Monta volumen `uploads_data` en `/app/uploads`. |
| **`frontend`** | `./frontend` (`nginx:alpine`) | `3000:80` | SPA React 18/19 + Vite + Tailwind CSS + Leaflet. Sirve `/uploads/` con `autoindex off;`, capas `/datos-geo/` y hace fallback a `index.html`. |

### Volúmenes Persistentes:
- `db_data`: Datos de PostgreSQL.
- `uploads_data`: Almacén compartido de fotos de evidencia (escritura desde `backend`, lectura pública desde `frontend`).

---

## 3. DECISIONES DE DISEÑO Y ARQUITECTURA (MODO YOLO)

En cumplimiento de la autonomía desatendida y sin confirmaciones intermedias, se adoptaron las siguientes decisiones de ingeniería:

1. **ORM Prisma + TypeScript CommonJS en Backend:**
   - Para evitar incompatibilidades ESM/CJS de Node en entornos Docker Alpine, el backend compila a CommonJS estricto con `tsconfig.json` ajustado y `prisma-client-js`.
   - La sincronización inicial corre vía `npx prisma db push --accept-data-loss` seguido de `npx tsx prisma/seed.ts` en `entrypoint.sh`.
2. **Reverse Proxy Nginx en Frontend:**
   - Nginx redirige `/api/` hacia `http://backend:4000/api/`, permitiendo que el frontend funcione tanto detrás de un dominio único como con puertos desacoplados.
3. **Almacenamiento de Evidencias:**
   - Se valida tipo MIME (`image/jpeg`, `image/png`, `image/webp`) y límite de 15 MB.
   - Los nombres se generan con `crypto.randomUUID()` aleatorio criptográfico para evitar colisiones y rastreo secuencial.
4. **Semáforo Operativo de Inactividad:**
   - Se calcula sobre `last_activity_at`:
     - **P1 y P2:** Alarma crítica si transcurren más de 30 minutos sin movimiento.
     - **P3 y P4:** Alarma si transcurren más de 2 horas sin movimiento.
   - En el frontend se actualiza visualmente con un pulso de alta visibilidad.
5. **Regla Estricta de Autoasignación en Tareas:**
   - Si un Coordinador de Área se autoasigna una tarea (`area_coordinator_id === assignee_id`) y la resuelve, **únicamente el Coordinador General (`COORDINACION` con scope `GENERAL` o `ADMINISTRADOR`)** tiene permiso para pasarla a `VERIFICADA`.
6. **Capas GeoJSON de San Martín:**
   - Se copiaron los archivos GeoJSON preexistentes desde `/datos-geo` hacia `frontend/public/datos-geo/`.
   - El componente `MapaOperativo.tsx` captura cualquier fallo de capa faltante de forma segura sin interrumpir la experiencia de usuario.
7. **Polling Reactivo Periódico:**
   - Intervalos de 20 segundos en el cliente para mantener actualizadas métricas, tareas y centros de evacuados sin la sobrecarga de conexiones WebSocket o notificaciones push externas.

---

## 4. MODELO DE DATOS Y ENUMS

- **Roles de Usuario (`user_role`):** `ADMINISTRADOR`, `COORDINACION`, `OPERACION`, `CONSULTA`.
- **Alcances de Coordinación (`coordination_scope`):** `GENERAL`, `AREA`.
- **Fases de Evento (`event_status`):** `PREPARACION`, `RESPUESTA`, `RECUPERACION`, `CERRADO`.
- **Alertas SMN (`smn_alert`):** `SIN_ALERTA`, `AMARILLA`, `NARANJA`, `ROJA`.
- **Estados de Aviso (`notice_status`):** `RECIBIDO`, `VINCULADO`, `CONVERTIDO`, `DESCARTADO`.
- **Prioridad Operativa (`priority`):** `P1` (Crítica), `P2` (Alta), `P3` (Media), `P4` (Baja).
- **Estados de Incidente (`incident_status`):** `RECIBIDO`, `PRIORIZADO`, `ASIGNADO`, `EN_ATENCION`, `IMPEDIDO`, `RESUELTO`, `CERRADO`.
- **Ciclo de Tarea (`task_status`):** `CREADA`, `ASIGNADA`, `ACEPTADA`, `EN_DESPLAZAMIENTO`, `EN_EJECUCION`, `IMPEDIDA`, `RESUELTA`, `VERIFICADA`, `CANCELADA`.
- **Tipo de Refugio (`stay_kind`):** `TRANSITORIO`, `PERNOCTA`.
- **Dirección de Movimiento (`occupancy_direction`):** `INGRESO`, `EGRESO`.

---

## 5. USUARIOS PRECARGADOS (SEMILLA)

Contraseña unificada inicial para todos los perfiles: **`crisis2026`**

| Usuario | Rol | Alcance / Área | Privilegio Triage P1-P4 | Propósito Operativo |
|---|---|---|:---:|---|
| `coord.general` | `COORDINACION` | `GENERAL` | No | Comando de Crisis, resolución/cierre de incidentes, verificación de autoasignaciones. |
| `defensa.civil` | `COORDINACION` | `AREA` (`DEFENSA_CIVIL`) | **SÍ** (`can_triage=true`) | Triage y clasificación de gravedad P1 a P4. |
| `parques.coord` | `COORDINACION` | `AREA` (`PARQUES`) | No | Distribución y verificación de tareas de Espacios Verdes. |
| `parques.oper` | `OPERACION` | `PARQUES` | No | Operador de campo / cuadrilla de Parques. |
| `higiene.coord` | `COORDINACION` | `AREA` (`HIGIENE_URBANA`) | No | Distribución y verificación de cuadrillas de Limpieza. |
| `higiene.oper` | `OPERACION` | `HIGIENE_URBANA` | No | Operador de campo / cuadrilla de Desobstrucción. |
| `intendencia` | `CONSULTA` | General | No | Tableros y visualización solo lectura. |
| `admin.general` | `ADMINISTRADOR` | Municipal | No | Alta y baja de usuarios, reseteo directo de credenciales. |

---

## 6. GUÍA DE OPERACIÓN Y CONTINUIDAD

### Iniciar el Stack:
```bash
docker compose up --build -d
```

### Verificar Estado de Contenedores:
```bash
docker compose ps
```

### Ver Logs de un Servicio:
```bash
docker compose logs -f backend
docker compose logs -f db
docker compose logs -f frontend
```

### Re-ejecutar Semilla Manualmente si se Desea:
```bash
docker compose exec backend npx tsx prisma/seed.ts
```

### Ejecutar Pruebas Rápidas de API:
```bash
# Login Coordinador General
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"coord.general","password":"crisis2026"}'

# Consultar Centros de Evacuados
curl http://localhost:4000/api/evacuation-centers \
  -H "Authorization: Bearer <TOKEN>"
```

---
*GEMA — Gestión de Eventos Meteorológicos Adversos — Municipalidad de General San Martín.*
