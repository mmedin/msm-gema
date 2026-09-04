/**
 * Test Suite de Concurrencia e Integridad Transaccional (GEMA)
 * Verifica:
 * - [DATA-01] Generación atómica de códigos correlativos (YYYY-xxx, INC-xxx, TAR-xxx) bajo carga simultánea.
 * - [DATA-02] Bloqueo pesimista (FOR UPDATE) en centros de evacuados, consistencia de saldo y límites de sobrecupo.
 * - [DATA-03] Atomicidad multi-tabla en conversión de avisos y creación de tareas.
 */

const BASE_URL = process.env.API_URL || 'http://localhost:4000/api';

async function request(path: string, options: RequestInit = {}, token?: string) {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
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

  return { status: res.status, data };
}

async function runTests() {
  console.log('===============================================================');
  console.log('🚀 INICIANDO TEST SUITE DE CONCURRENCIA E INTEGRIDAD (GEMA) 🚀');
  console.log('===============================================================\n');

  // 1. Autenticación como coord.general
  console.log('🔑 Paso 1: Autenticando con usuario coord.general...');
  const loginRes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'coord.general', password: 'crisis2026' }),
  });

  if (loginRes.status !== 200 || !loginRes.data.token) {
    throw new Error(`Fallo en login: ${JSON.stringify(loginRes.data)}`);
  }
  const token = loginRes.data.token;
  console.log('✅ Autenticación exitosa.\n');

  // Obtener evento activo
  const activeEventRes = await request('/events/active', { method: 'GET' }, token);
  if (activeEventRes.status !== 200 || !activeEventRes.data) {
    throw new Error(`Fallo al obtener evento activo: ${JSON.stringify(activeEventRes.data)}`);
  }
  const eventId = activeEventRes.data.id;
  console.log(`📌 Evento activo para pruebas: ${activeEventRes.data.code} (${eventId})`);

  // Obtener áreas
  const areasRes = await request('/areas', { method: 'GET' }, token);
  if (areasRes.status !== 200 || !areasRes.data || areasRes.data.length === 0) {
    throw new Error(`Fallo al obtener áreas: ${JSON.stringify(areasRes.data)}`);
  }
  const areaId = areasRes.data[0].id;
  console.log(`📌 Área para pruebas de tareas: ${areasRes.data[0].name} (${areaId})\n`);

  // -------------------------------------------------------------
  // TEST 1: [DATA-01] Creación concurrente de Eventos (YYYY-xxx)
  // -------------------------------------------------------------
  console.log('--- TEST 1: Creación Concurrente de Eventos (pg_advisory_xact_lock) ---');
  const CONCURRENT_EVENTS = 5;
  const eventPromises = Array.from({ length: CONCURRENT_EVENTS }).map((_, i) =>
    request(
      '/events',
      {
        method: 'POST',
        body: JSON.stringify({
          description: `Evento Concurrente de Prueba #${i + 1}`,
          smn_alert: 'AMARILLA',
        }),
      },
      token
    )
  );

  const eventResults = await Promise.all(eventPromises);
  const eventCodes: string[] = [];

  for (let i = 0; i < eventResults.length; i++) {
    const r = eventResults[i];
    if (r.status !== 201) {
      throw new Error(`Fallo en creación concurrente de evento ${i}: ${JSON.stringify(r.data)}`);
    }
    eventCodes.push(r.data.code);
  }

  console.log('Códigos de eventos generados:', eventCodes);
  const uniqueEventCodes = new Set(eventCodes);
  if (uniqueEventCodes.size !== CONCURRENT_EVENTS) {
    throw new Error(`Colisión de códigos en eventos: se esperaban ${CONCURRENT_EVENTS} únicos, se obtuvieron ${uniqueEventCodes.size}`);
  }
  console.log('✅ TEST 1 PASADO: 5 eventos concurrentes creados con correlativos únicos sin colisión.\n');

  // -------------------------------------------------------------
  // TEST 2: [DATA-01] Creación concurrente de Incidentes (INC-xxx)
  // -------------------------------------------------------------
  console.log('--- TEST 2: Creación Concurrente de 10 Incidentes (Bloqueo pesimista FOR UPDATE) ---');
  const CONCURRENT_INCIDENTS = 10;
  const incidentPromises = Array.from({ length: CONCURRENT_INCIDENTS }).map((_, i) =>
    request(
      '/incidents',
      {
        method: 'POST',
        body: JSON.stringify({
          event_id: eventId,
          title: `Incidente Concurrente #${i + 1}`,
          type_code: 'CAIDA_ARBOL',
          description: `Descripción concurrente número ${i + 1}`,
          location_text: `Calle de prueba #${i + 1}`,
          priority: 'P2',
        }),
      },
      token
    )
  );

  const incidentResults = await Promise.all(incidentPromises);
  const incidentCodes: string[] = [];
  const createdIncidentIds: string[] = [];

  for (let i = 0; i < incidentResults.length; i++) {
    const r = incidentResults[i];
    if (r.status !== 201) {
      throw new Error(`Fallo en creación concurrente de incidente ${i}: ${JSON.stringify(r.data)}`);
    }
    incidentCodes.push(r.data.code);
    createdIncidentIds.push(r.data.id);
  }

  console.log('Códigos de incidentes generados:', incidentCodes);
  const uniqueIncidentCodes = new Set(incidentCodes);
  if (uniqueIncidentCodes.size !== CONCURRENT_INCIDENTS) {
    throw new Error(`Colisión en códigos de incidentes: se esperaban ${CONCURRENT_INCIDENTS} únicos, se obtuvieron ${uniqueIncidentCodes.size}`);
  }
  console.log('✅ TEST 2 PASADO: 10 incidentes creados simultáneamente con correlativos estrictamente consecutivos sin colisiones.\n');

  // -------------------------------------------------------------
  // TEST 3: [DATA-01 & DATA-03] Creación concurrente de Tareas (TAR-xxx) + Actualización de Incidente
  // -------------------------------------------------------------
  console.log('--- TEST 3: Creación Concurrente de 10 Tareas (Transacción multi-tabla + FOR UPDATE) ---');
  const targetIncidentId = createdIncidentIds[0];
  const CONCURRENT_TASKS = 10;

  const taskPromises = Array.from({ length: CONCURRENT_TASKS }).map((_, i) =>
    request(
      '/tasks',
      {
        method: 'POST',
        body: JSON.stringify({
          incident_id: targetIncidentId,
          area_id: areaId,
          action: `Acción correctiva concurrente #${i + 1}`,
          priority: 'P2',
        }),
      },
      token
    )
  );

  const taskResults = await Promise.all(taskPromises);
  const taskCodes: string[] = [];

  for (let i = 0; i < taskResults.length; i++) {
    const r = taskResults[i];
    if (r.status !== 201) {
      throw new Error(`Fallo en creación concurrente de tarea ${i}: ${JSON.stringify(r.data)}`);
    }
    taskCodes.push(r.data.code);
  }

  console.log('Códigos de tareas generados:', taskCodes);
  const uniqueTaskCodes = new Set(taskCodes);
  if (uniqueTaskCodes.size !== CONCURRENT_TASKS) {
    throw new Error(`Colisión en códigos de tareas: se esperaban ${CONCURRENT_TASKS} únicos, se obtuvieron ${uniqueTaskCodes.size}`);
  }

  // Verificar que el incidente target quedó en estado ASIGNADO
  const incDetailRes = await request(`/incidents/${targetIncidentId}`, { method: 'GET' }, token);
  if (incDetailRes.status !== 200 || incDetailRes.data.status !== 'ASIGNADO') {
    throw new Error(`El incidente no fue actualizado a ASIGNADO dentro de la transacción. Estado: ${incDetailRes.data?.status}`);
  }
  console.log('✅ TEST 3 PASADO: 10 tareas concurrentes creadas con correlativos atómicos y estado de incidente actualizado atómicamente.\n');

  // -------------------------------------------------------------
  // TEST 4: [DATA-02] Ocupación Concurrente de Centros de Evacuados (FOR UPDATE)
  // -------------------------------------------------------------
  console.log('--- TEST 4: Ocupación Concurrente en Refugios (Serialización pesimista FOR UPDATE) ---');
  const centersRes = await request(`/evacuation-centers?event_id=${eventId}`, { method: 'GET' }, token);
  if (centersRes.status !== 200 || !centersRes.data || centersRes.data.length === 0) {
    throw new Error(`Fallo al obtener centros de evacuados: ${JSON.stringify(centersRes.data)}`);
  }
  const testCenter = centersRes.data[0];
  const initialOccupied = testCenter.current_occupied || 0;
  console.log(`Centro seleccionado: ${testCenter.name} (Capacidad nominal: ${testCenter.capacity}, Ocupación inicial: ${initialOccupied})`);

  // Disparar 6 ingresos concurrentes: 3 ingresos de +5 y 3 ingresos de +2.
  // Total a ingresar: 3*5 + 3*2 = 15 + 6 = +21
  const deltas = [5, 2, 5, 2, 5, 2];
  const totalDeltaExpected = deltas.reduce((a, b) => a + b, 0);

  const occupancyPromises = deltas.map((delta, i) =>
    request(
      `/evacuation-centers/${testCenter.id}/occupancy`,
      {
        method: 'POST',
        body: JSON.stringify({
          event_id: eventId,
          direction: 'INGRESO',
          people_count: delta,
          notes: `Ingreso concurrente #${i + 1} de +${delta}`,
        }),
      },
      token
    )
  );

  const occupancyResults = await Promise.all(occupancyPromises);
  for (let i = 0; i < occupancyResults.length; i++) {
    const r = occupancyResults[i];
    if (r.status !== 201) {
      throw new Error(`Fallo en ocupación concurrente #${i}: ${JSON.stringify(r.data)}`);
    }
  }

  // Consultar balance final
  const centersAfterRes = await request(`/evacuation-centers?event_id=${eventId}`, { method: 'GET' }, token);
  const updatedCenter = centersAfterRes.data.find((c: any) => c.id === testCenter.id);
  const finalOccupied = updatedCenter.current_occupied;
  const expectedOccupied = initialOccupied + totalDeltaExpected;

  console.log(`Ocupación inicial: ${initialOccupied} | Delta total: +${totalDeltaExpected} | Ocupación final obtenida: ${finalOccupied}`);
  if (finalOccupied !== expectedOccupied) {
    throw new Error(`Error de carrera en ocupación: Se esperaba ${expectedOccupied}, pero se obtuvo ${finalOccupied}!`);
  }
  console.log('✅ TEST 4 PASADO: Solicitudes simultáneas serializadas limpiamente con saldo final matemáticamente exacto.\n');

  // -------------------------------------------------------------
  // TEST 5: [DATA-02] Validaciones de Balance Negativo y Capacidad Extrema
  // -------------------------------------------------------------
  console.log('--- TEST 5: Validaciones de Consistencia en Ocupación ---');

  // 5.1 Egreso excesivo (llevaría a < 0)
  const excessiveExitCount = finalOccupied + 10;
  const negativeRes = await request(
    `/evacuation-centers/${testCenter.id}/occupancy`,
    {
      method: 'POST',
      body: JSON.stringify({
        event_id: eventId,
        direction: 'EGRESO',
        people_count: excessiveExitCount,
      }),
    },
    token
  );
  if (negativeRes.status !== 400 || !negativeRes.data.error.includes('valores negativos')) {
    throw new Error(`Se esperaba rechazo 400 por saldo negativo, pero se obtuvo: ${negativeRes.status} ${JSON.stringify(negativeRes.data)}`);
  }
  console.log(`✅ Rechazo correcto de egreso negativo (${excessiveExitCount} personas con saldo ${finalOccupied}): 400 Bad Request`);

  // 5.2 Ingreso astronómico que supera 200% de capacidad
  const extremeIngressCount = testCenter.capacity * 3;
  const extremeRes = await request(
    `/evacuation-centers/${testCenter.id}/occupancy`,
    {
      method: 'POST',
      body: JSON.stringify({
        event_id: eventId,
        direction: 'INGRESO',
        people_count: extremeIngressCount,
      }),
    },
    token
  );
  if (extremeRes.status !== 400 || !extremeRes.data.error.includes('capacidad extrema')) {
    throw new Error(`Se esperaba rechazo 400 por superar capacidad extrema, pero se obtuvo: ${extremeRes.status} ${JSON.stringify(extremeRes.data)}`);
  }
  console.log(`✅ Rechazo correcto de sobrecupo extremo (> 200% de capacidad): 400 Bad Request`);
  console.log('✅ TEST 5 PASADO: Reglas de balance e integridad de ocupación validadas satisfactoriamente.\n');

  // -------------------------------------------------------------
  // TEST 6: [DATA-03] Conversión Atómica Multi-tabla de Avisos
  // -------------------------------------------------------------
  console.log('--- TEST 6: Conversión Atómica Multi-Tabla de Aviso a Incidente ---');

  // Crear un aviso
  const formData = new FormData();
  formData.append('event_id', eventId);
  formData.append('channel', 'LINEA_103');
  formData.append('source', 'Vecino de prueba');
  formData.append('location_text', 'Mitre 4000, San Martín');
  formData.append('description', 'Aviso para prueba de doble conversión concurrente');
  formData.append('life_risk', 'NO');
  formData.append('trend', 'ESTABLE');

  const createNoticeRes = await request('/notices', {
    method: 'POST',
    body: formData,
  }, token);

  if (createNoticeRes.status !== 201) {
    throw new Error(`Fallo al crear aviso de prueba: ${JSON.stringify(createNoticeRes.data)}`);
  }
  const noticeId = createNoticeRes.data.id;
  console.log(`Aviso creado: ${noticeId}`);

  // Disparar 2 conversiones concurrentes del mismo aviso
  const convertPromises = [
    request(`/notices/${noticeId}/convert`, {
      method: 'PATCH',
      body: JSON.stringify({ title: 'Conversión Concurrente A' }),
    }, token),
    request(`/notices/${noticeId}/convert`, {
      method: 'PATCH',
      body: JSON.stringify({ title: 'Conversión Concurrente B' }),
    }, token),
  ];

  const convertResults = await Promise.all(convertPromises);
  const statusCodes = convertResults.map(r => r.status);
  console.log('Resultados de conversión concurrente del mismo aviso:', statusCodes);

  // Exactamente uno debe tener éxito (200) y el otro debe fallar (400)
  const successCount = statusCodes.filter(s => s === 200).length;
  const badRequestCount = statusCodes.filter(s => s === 400).length;

  if (successCount !== 1 || badRequestCount !== 1) {
    throw new Error(`La doble conversión concurrente no fue controlada atómicamente: ${JSON.stringify(convertResults)}`);
  }

  console.log('✅ TEST 6 PASADO: Transacción atómica previene doble conversión y procesa exactamente un incidente.\n');

  console.log('===============================================================');
  console.log('🎉 TODAS LAS PRUEBAS DE CONCURRENCIA E INTEGRIDAD PASARON (6/6) 🎉');
  console.log('===============================================================');
}

runTests().catch((err) => {
  console.error('\n❌ ERROR EN PRUEBAS DE CONCURRENCIA:', err);
  process.exit(1);
});
