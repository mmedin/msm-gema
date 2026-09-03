# MSM-CRISIS (Plan B Operativo)

> **Plataforma de Contingencia de Misión Crítica para Tormentas Severas e Inundaciones**  
> **Municipalidad de General San Martín — Provincia de Buenos Aires**

---

## 1. Descripción del Proyecto

**MSM-CRISIS (Plan B Operativo)** es una plataforma centralizada, móvil-primero y de alta velocidad diseñada para coordinar las operaciones de emergencia municipal durante tormentas severas, caída de arbolado, riesgos eléctricos e inundaciones en el partido de General San Martín.

Reemplaza los canales informales y fragmentados (grupos de WhatsApp) por un tablero operativo común, estructurado y auditable para el Centro de Operaciones de Emergencia (COE), dependencias sectoriales y cuadrillas en la calle.

---

## 2. Filosofía y Principios del "Plan B"

1. **Núcleo Operativo Estricto:** Foco exclusivo en Eventos, Avisos, Incidentes, Tareas sectoriales en 2 etapas, Mapa operativo con capas GeoJSON de San Martín y Ocupación numérica de centros de evacuados.
2. **Cero Fricción y Sin Dependencias Externas (Coolify Ready):**
   - Sin Cloudflare D1/R2, sin bots externos propensos a caídas durante temporales, sin APIs públicas externas de geocodificación.
   - 100% autónomo y persistente sobre Docker y volúmenes locales.
3. **Móvil Primero para Cuadrillas en Campo:**
   - Botones táctiles grandes (mínimo 48px), transiciones de un toque (*Aceptar* -> *En Camino* -> *En Ejecución* -> *Resolver* / *Impedimento*).
   - Sin formularios extensos ni fricción para los operarios.
4. **Identidad Directa Sin Emails:**
   - Usuarios bajo formato estricto `nombre.apellido` (ej. `coord.general`, `parques.oper`).
   - Altas, bajas y reseteos directos de contraseña gestionados por el rol `ADMINISTRADOR`.
5. **Privacidad en Centros de Evacuados:**
   - Conteo numérico estricto (+ / -). Prohibido registrar nombres, DNI o datos filiatorios de personas evacuadas.

---

## 3. Arquitectura del Sistema

La solución opera como un stack de **3 contenedores Docker** conectados en red interna:

```text
               +--------------------------------------------+
               |          Nginx Alpine (Puerto 3000)        |
               |  - SPA React 18/19 + Vite + Tailwind       |
               |  - Capas GeoJSON /datos-geo/               |
               |  - Evidencias /uploads/ (autoindex off)    |
               +---------------------+----------------------+
                                     | Proxy /api/
                                     v
               +--------------------------------------------+
               |     Backend Express + Prisma (Puerto 4000) |
               |  - Node.js 22 LTS + TypeScript             |
               |  - Migraciones y Seed automático al inicio |
               +---------------------+----------------------+
                                     |
                                     v
               +--------------------------------------------+
               |          PostgreSQL 16 (Interno 5432)      |
               |  - Enums nativos y datos relacionales      |
               |  - Healthcheck pg_isready                  |
               +--------------------------------------------+
```

### Volúmenes Persistentes:
- `db_data`: Persistencia de base de datos PostgreSQL.
- `uploads_data`: Almacenamiento compartido de imágenes de evidencia (escritura backend, lectura frontend).

---

## 4. Puesta en Marcha Rápida

### Requisitos Previos:
- Docker y Docker Compose (v2+).

### 1. Clonar el repositorio:
```bash
git clone git@github.com:mmedin/msm-crisis-b.git
cd msm-crisis-b
```

### 2. Iniciar el stack completo:
```bash
docker compose up --build -d
```

### 3. Verificar el estado de los contenedores:
```bash
docker compose ps
```

Deberías ver los 3 servicios activos:
- **Frontend / Web UI:** `http://localhost:3000`
- **Backend REST API:** `http://localhost:4000/api`
- **Base de Datos PostgreSQL:** Interno en puerto `5432`

---

## 5. Usuarios y Credenciales Semilla

Todos los perfiles iniciales se cargan automáticamente al levantar el backend con la contraseña: **`crisis2026`**

| Usuario | Rol | Alcance / Área | Triage P1-P4 | Función Operativa |
|---|---|---|:---:|---|
| `coord.general` | `COORDINACION` | `GENERAL` | No | Comando general, cierre de incidentes y verificación de autoasignaciones |
| `defensa.civil` | `COORDINACION` | `AREA` (`DEFENSA_CIVIL`) | **SÍ** | Clasificación de prioridad y triage de emergencia |
| `parques.coord` | `COORDINACION` | `AREA` (`PARQUES`) | No | Distribución y verificación de tareas de Espacios Verdes |
| `parques.oper` | `OPERACION` | `PARQUES` | No | Operario de cuadrilla de Parques |
| `higiene.coord` | `COORDINACION` | `AREA` (`HIGIENE_URBANA`) | No | Distribución y verificación de limpieza y desobstrucción |
| `higiene.oper` | `OPERACION` | `HIGIENE_URBANA` | No | Operario de cuadrilla de Higiene Urbana |
| `intendencia` | `CONSULTA` | General | No | Tableros, cortes de situación y mapas en modo solo lectura |
| `admin.general` | `ADMINISTRADOR` | Municipal | No | ABM de usuarios, áreas y catálogo de centros |

---

## 6. Flujo Operativo y Reglas de Negocio

1. **Avisos & Deduplicación Pragmática:**
   - Se registran llamados (Línea 103, CAV 147, radio, campo), ubicación (o marca "Ubicación pendiente"), riesgo de vida, tendencia y fotos de evidencia opcionales.
   - Desde el aviso se puede:
     - **"Crear nuevo incidente"** (convierte a `INC-xxx`).
     - **"Vincular a incidente existente"** (asocia a incidentes abiertos ordenados por `created_at DESC`).
2. **Triage P1 a P4:**
   - Exclusivo para usuarios con `can_triage = true` (`defensa.civil`).
   - P1 (Crítica/Rojo), P2 (Alta/Naranja), P3 (Media/Amarillo), P4 (Baja/Verde).
3. **Tareas en 2 Etapas:**
   - **Etapa 1:** Coordinación General deriva la tarea a un Área municipal (`ASIGNADA`).
   - **Etapa 2:** El Coordinador de Área asigna nominalmente a un integrante de su equipo o se autoasigna.
4. **Ciclo de Ejecución del Operario:**
   - `ACEPTADA` -> `EN_DESPLAZAMIENTO` -> `EN_EJECUCION` -> `RESUELTA` (ingresando resultado del trabajo).
   - Botón `IMPEDIMENTO` para reportar motivos y requerimientos extraordinarios (corte de energía de Edenor, grúa, etc.).
5. **Verificación Cruzada y Regla de Autoasignación:**
   - Las tareas en estado `RESUELTA` son verificadas por el Coordinador del Área.
   - **Regla estricta:** Si el Coordinador se autoasignó la tarea y la resolvió, **únicamente la Coordinación General** puede pasarla a `VERIFICADA`.
6. **Centros de Evacuados:**
   - CEMEF, Centro de Inclusión Villa Maipú, Club Deportivo San Andrés, Sociedad de Fomento Ciclón Fortín.
   - Conteo numérico (+ / -). Un egreso nunca puede dejar la ocupación en valores negativos.
   - Alerta visual si los ingresos superan la capacidad instalada.
7. **Semáforo Operativo de Inactividad:**
   - Alerta visual para casos P1/P2 con más de 30 minutos sin movimiento.
   - Alerta visual para casos P3/P4 con más de 2 horas sin movimiento.
8. **Corte de Situación Imprimible:**
   - Estilo optimizado `@media print` para exportar PDF o imprimir directamente una hoja de situación limpia y oficial.
   - Exportación de snapshot completo en JSON.
9. **Mapa Operativo Leaflet:**
   - Georreferenciación de incidentes y refugios en San Martín.
   - Capas GeoJSON conmutables: Zona de Anegamientos COM, Cuenca Reconquista, Arroyo Medrano y tramos afectados.

---

## 7. Comandos de Mantenimiento

```bash
# Ver logs del backend en tiempo real
docker compose logs -f backend

# Ver logs del servidor web y proxy nginx
docker compose logs -f frontend

# Reinicializar la base de datos y correr seed manualmente
docker compose exec backend npx tsx prisma/seed.ts

# Detener el stack
docker compose down
```

---

## 8. Documentación Adicional

- Para detalles de arquitectura interna, decisiones técnicas en modo YOLO y guía de continuidad para agentes de IA, consultar [`AGENTS.md`](./AGENTS.md).
- Para detalles de capas geográficas del municipio, consultar [`datos-geo/README.md`](./datos-geo/README.md).

---
*Municipalidad de General San Martín — Secretaría de Gobierno / Defensa Civil.*
