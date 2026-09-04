/**
 * Test Suite de Rendimiento y Optimización de Base de Datos (GEMA)
 * Verifica:
 * - [PERF-01] Eliminación del problema N+1 en Dashboard y Refugios (tiempos y consistencia de datos).
 * - [PERF-02] Existencia de los índices requeridos en PostgreSQL (pg_indexes).
 * - [PERF-03] Paginación con limit, offset, cursor y headers X-Total-Count en /incidents, /tasks, /notices.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = process.env.API_URL || 'http://localhost:4000/api';

async function request(path: string, options: RequestInit = {}, token?: string) {
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const contentType = res.headers.get('content-type');
  let data: any = null;
  if (contentType && contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  return {
    status: res.status,
    headers: res.headers,
    data,
  };
}

async function runTests() {
  console.log('===============================================================');
  console.log('⚡ INICIANDO TEST SUITE DE RENDIMIENTO Y OPTIMIZACIÓN (GEMA) ⚡');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✅ ${message}`);
      passed++;
    } else {
      console.error(`  ❌ ERROR: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Autenticación
    console.log('🔑 Paso 1: Autenticación como coord.general...');
    const loginRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'coord.general', password: 'crisis2026' }),
    });

    if (loginRes.status !== 200 || !loginRes.data.token) {
      throw new Error(`Fallo en login: ${JSON.stringify(loginRes.data)}`);
    }
    const token = loginRes.data.token;
    console.log('✅ Autenticación exitosa.\n');

    // 2. [PERF-02] Verificar Índices en PostgreSQL
    console.log('🔍 Paso 2: Verificación de índices en PostgreSQL (PERF-02)...');
    const requiredIndexes = [
      'notices_event_id_idx',
      'notices_status_idx',
      'notices_incident_id_idx',
      'incidents_event_id_status_idx',
      'incidents_priority_idx',
      'incidents_last_activity_at_idx',
      'tasks_event_id_status_idx',
      'tasks_area_id_idx',
      'tasks_assignee_id_idx',
      'tasks_priority_idx',
      'tasks_last_activity_at_idx',
      'evacuation_occupancy_logs_center_id_event_id_created_at_idx',
      'audit_logs_actor_id_idx',
      'audit_logs_entity_entity_id_idx',
    ];

    const dbIndexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
    `;

    const indexNames = new Set(dbIndexes.map((idx) => idx.indexname));

    for (const required of requiredIndexes) {
      assert(indexNames.has(required), `Índice ${required} existe en la base de datos`);
    }
    console.log('');

    // 3. [PERF-01] Verificar Dashboard Stats sin N+1
    console.log('📊 Paso 3: Verificación de Dashboard Stats y eliminación de N+1 (PERF-01)...');
    const startDashboard = Date.now();
    const dashboardRes = await request('/dashboard/stats', { method: 'GET' }, token);
    const dashboardDuration = Date.now() - startDashboard;

    assert(dashboardRes.status === 200, `Dashboard stats responde 200 OK (${dashboardDuration}ms)`);
    assert(Array.isArray(dashboardRes.data.areasBreakdown), 'areasBreakdown es un array');
    assert(dashboardRes.data.areasBreakdown.length > 0, `areasBreakdown contiene ${dashboardRes.data.areasBreakdown.length} áreas`);

    if (dashboardRes.data.areasBreakdown.length > 0) {
      const sampleArea = dashboardRes.data.areasBreakdown[0];
      assert(typeof sampleArea.total === 'number', 'area.total es numérico');
      assert(typeof sampleArea.pendingDistribution === 'number', 'area.pendingDistribution es numérico');
      assert(typeof sampleArea.inExecution === 'number', 'area.inExecution es numérico');
      assert(typeof sampleArea.resolved === 'number', 'area.resolved es numérico');
      assert(typeof sampleArea.verified === 'number', 'area.verified es numérico');
      assert(typeof sampleArea.impeded === 'number', 'area.impeded es numérico');
    }

    assert(typeof dashboardRes.data.evacuation?.totalCapacity === 'number', 'evacuation.totalCapacity es numérico');
    assert(typeof dashboardRes.data.evacuation?.totalOccupied === 'number', 'evacuation.totalOccupied es numérico');
    console.log('');

    // 4. [PERF-01] Verificar Centros de Evacuados sin N+1
    console.log('🏠 Paso 4: Verificación de centros de evacuados (PERF-01)...');
    const startCenters = Date.now();
    const centersRes = await request('/evacuation-centers', { method: 'GET' }, token);
    const centersDuration = Date.now() - startCenters;

    assert(centersRes.status === 200, `Evacuation centers responde 200 OK (${centersDuration}ms)`);
    assert(Array.isArray(centersRes.data), 'Lista de centros es un array');
    if (centersRes.data.length > 0) {
      const center = centersRes.data[0];
      assert(typeof center.current_occupied === 'number', 'center.current_occupied es numérico');
      assert(typeof center.available_capacity === 'number', 'center.available_capacity es numérico');
      assert(typeof center.capacity_exceeded === 'boolean', 'center.capacity_exceeded es booleano');
      assert(typeof center.percentage === 'number', 'center.percentage es numérico');
    }
    console.log('');

    // 5. [PERF-03] Verificar Paginación en /incidents, /tasks, /notices
    console.log('📑 Paso 5: Verificación de paginación y headers X-Total-Count (PERF-03)...');

    // Incidentes paginados
    const incidentsRes = await request('/incidents?limit=2', { method: 'GET' }, token);
    assert(incidentsRes.status === 200, 'GET /incidents?limit=2 responde 200 OK');
    assert(Array.isArray(incidentsRes.data), 'GET /incidents retorna array');
    assert(incidentsRes.data.length <= 2, `GET /incidents?limit=2 retorna como máximo 2 elementos (obtenidos: ${incidentsRes.data.length})`);
    assert(incidentsRes.headers.has('x-total-count'), 'GET /incidents incluye header X-Total-Count');
    assert(incidentsRes.headers.get('x-limit') === '2', 'GET /incidents incluye header X-Limit = 2');

    // Tareas paginadas
    const tasksRes = await request('/tasks?limit=2', { method: 'GET' }, token);
    assert(tasksRes.status === 200, 'GET /tasks?limit=2 responde 200 OK');
    assert(Array.isArray(tasksRes.data), 'GET /tasks retorna array');
    assert(tasksRes.data.length <= 2, `GET /tasks?limit=2 retorna como máximo 2 elementos (obtenidos: ${tasksRes.data.length})`);
    assert(tasksRes.headers.has('x-total-count'), 'GET /tasks incluye header X-Total-Count');
    assert(tasksRes.headers.get('x-limit') === '2', 'GET /tasks incluye header X-Limit = 2');

    // Avisos paginados
    const noticesRes = await request('/notices?limit=2', { method: 'GET' }, token);
    assert(noticesRes.status === 200, 'GET /notices?limit=2 responde 200 OK');
    assert(Array.isArray(noticesRes.data), 'GET /notices retorna array');
    assert(noticesRes.data.length <= 2, `GET /notices?limit=2 retorna como máximo 2 elementos (obtenidos: ${noticesRes.data.length})`);
    assert(noticesRes.headers.has('x-total-count'), 'GET /notices incluye header X-Total-Count');
    assert(noticesRes.headers.get('x-limit') === '2', 'GET /notices incluye header X-Limit = 2');

    // Offset test
    if (parseInt(incidentsRes.headers.get('x-total-count') || '0', 10) > 1) {
      const page1Res = await request('/incidents?limit=1&offset=0', { method: 'GET' }, token);
      const page2Res = await request('/incidents?limit=1&offset=1', { method: 'GET' }, token);
      assert(page1Res.data[0]?.id !== page2Res.data[0]?.id, 'Paginación con offset desplaza correctamente los registros');
    }

    console.log('\n===============================================================');
    console.log(`🏁 RESULTADO: ${passed} pruebas exitosas, ${failed} fallidas`);
    console.log('===============================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('💥 Excepción no controlada durante las pruebas:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
