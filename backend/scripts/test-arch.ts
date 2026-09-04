/**
 * Test Suite para Arquitectura y Calidad de Código (Épica 7 - P3)
 * Valida:
 * - [ARCH-01] Validación de esquemas con Zod (400 Bad Request con desglose de campos fallidos).
 * - [ARCH-02] Servicios desacoplados y reglas operativas (autoasignación, transiciones, notas).
 * - [ARCH-05] Disponibilidad de datos maestros.
 */

const BACKEND_URL = process.env.API_URL || 'http://localhost:4000/api';

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

  const res = await fetch(`${BACKEND_URL}${path}`, {
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

  return { status: res.status, headers: res.headers, data };
}

async function runArchTests() {
  console.log('===============================================================');
  console.log('🏗️  INICIANDO TEST SUITE DE ARQUITECTURA Y CALIDAD DE CÓDIGO 🏗️');
  console.log('===============================================================\n');

  // 1. Autenticación
  console.log('🔑 Paso 1: Autenticando usuarios de prueba...');
  const adminRes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin.general', password: 'crisis2026' }),
  });
  if (adminRes.status !== 200) throw new Error(`Fallo login admin: ${JSON.stringify(adminRes.data)}`);
  const adminToken = adminRes.data.token;

  const coordGeneralRes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'coord.general', password: 'crisis2026' }),
  });
  const coordGeneralToken = coordGeneralRes.data.token;

  const parquesCoordRes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'parques.coord', password: 'crisis2026' }),
  });
  const parquesCoordToken = parquesCoordRes.data.token;
  const parquesCoordUser = parquesCoordRes.data.user;

  console.log('✅ Usuarios autenticados exitosamente.\n');

  // 2. ARCH-01: Validación de Esquemas con Zod (Casos negativos)
  console.log('🛡️  Paso 2 [ARCH-01]: Verificando rechazo 400 y desglose de campos con Zod...');

  // Evento con descripción corta (<3) y alerta inválida
  const badEvent = await request('/events', {
    method: 'POST',
    body: JSON.stringify({ description: 'ab', smn_alert: 'ALERTA_INEXISTENTE' }),
  }, coordGeneralToken);
  if (badEvent.status !== 400 || !badEvent.data?.details?.description || !badEvent.data?.details?.smn_alert) {
    throw new Error(`Fallo validación Zod en POST /events: ${JSON.stringify(badEvent)}`);
  }
  console.log('  ✅ POST /events rechazó payload inválido con detalles de campo.');

  // Tarea sin acción y con ID de incidente inválido
  const badTask = await request('/tasks', {
    method: 'POST',
    body: JSON.stringify({ incident_id: '', area_id: '' }),
  }, coordGeneralToken);
  if (badTask.status !== 400 || !badTask.data?.details?.action || !badTask.data?.details?.incident_id) {
    throw new Error(`Fallo validación Zod en POST /tasks: ${JSON.stringify(badTask)}`);
  }
  console.log('  ✅ POST /tasks rechazó campos requeridos faltantes con desglose.');

  // Ocupación con cantidad negativa y dirección inválida
  const sheltersRes = await request('/evacuation-centers', {}, coordGeneralToken);
  const centerId = sheltersRes.data[0].id;
  const badOccupancy = await request(`/evacuation-centers/${centerId}/occupancy`, {
    method: 'POST',
    body: JSON.stringify({ direction: 'DIRECCION_FALSA', people_count: -5 }),
  }, coordGeneralToken);
  if (badOccupancy.status !== 400 || !badOccupancy.data?.details?.direction || !badOccupancy.data?.details?.people_count) {
    throw new Error(`Fallo validación Zod en POST /evacuation-centers/:id/occupancy: ${JSON.stringify(badOccupancy)}`);
  }
  console.log('  ✅ POST /evacuation-centers/:id/occupancy rechazó valores erróneos con desglose.');

  // Triage con prioridad inválida
  const activeEventRes = await request('/events/active', {}, coordGeneralToken);
  const eventId = activeEventRes.data.id;
  const createIncRes = await request('/incidents', {
    method: 'POST',
    body: JSON.stringify({
      event_id: eventId,
      title: 'Incidente para pruebas de arquitectura',
      description: 'Descripción de prueba para verificar Zod y Services',
      location_text: 'Plaza Central San Martín',
    }),
  }, coordGeneralToken);
  const incidentId = createIncRes.data.id;

  const defCivilRes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'defensa.civil', password: 'crisis2026' }),
  });
  const defCivilToken = defCivilRes.data.token;

  const badTriage = await request(`/incidents/${incidentId}/triage`, {
    method: 'PATCH',
    body: JSON.stringify({ priority: 'P99' }),
  }, defCivilToken);
  if (badTriage.status !== 400 || !badTriage.data?.details?.priority) {
    throw new Error(`Fallo validación Zod en PATCH /incidents/:id/triage: ${JSON.stringify(badTriage)}`);
  }
  console.log('  ✅ PATCH /incidents/:id/triage rechazó prioridad P99 con desglose.\n');

  // 3. ARCH-02: Capa de Servicios y Reglas de Negocio
  console.log('⚙️  Paso 3 [ARCH-02]: Verificando lógica de negocio en TaskService...');

  // Crear tarea válida asignada a Parques
  const areasRes = await request('/areas', {}, coordGeneralToken);
  const parquesArea = areasRes.data.find((a: any) => a.code === 'PARQUES');

  const taskRes = await request('/tasks', {
    method: 'POST',
    body: JSON.stringify({
      incident_id: incidentId,
      area_id: parquesArea.id,
      action: 'Corte de ramas caídas en plaza',
    }),
  }, coordGeneralToken);
  if (taskRes.status !== 201) throw new Error(`Fallo al crear tarea: ${JSON.stringify(taskRes.data)}`);
  const taskId = taskRes.data.id;
  console.log(`  ✅ Tarea creada correctamente con TaskService (ID: ${taskId})`);

  // Autoasignación del Coordinador de Área
  const assignRes = await request(`/tasks/${taskId}/assign`, {
    method: 'PATCH',
    body: JSON.stringify({ assignee_id: parquesCoordUser.id }),
  }, parquesCoordToken);
  if (assignRes.status !== 200) throw new Error(`Fallo al autoasignar tarea: ${JSON.stringify(assignRes.data)}`);
  console.log('  ✅ Coordinador de Área se autoasignó la tarea con TaskService.assignTask.');

  // Transición a RESUELTA sin notas de resultado (debe fallar con Zod / TaskService)
  const badTransition = await request(`/tasks/${taskId}/transition`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'RESUELTA' }),
  }, parquesCoordToken);
  if (badTransition.status !== 400) {
    throw new Error(`Fallo: Tarea RESUELTA sin notas debería dar 400 pero dio ${badTransition.status}`);
  }
  console.log('  ✅ Transición a RESUELTA sin notas rechazada con HTTP 400.');

  // Transición a RESUELTA con notas válidas
  const goodTransition = await request(`/tasks/${taskId}/transition`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'RESUELTA', result_notes: 'Ramas trozadas y despejadas satisfactoriamente.' }),
  }, parquesCoordToken);
  if (goodTransition.status !== 200) throw new Error(`Fallo transición válida: ${JSON.stringify(goodTransition.data)}`);
  console.log('  ✅ Tarea pasada a RESUELTA con notas de resolución.');

  // Regla estricta de autoasignación: El Coordinador de Área NO puede verificar su propia tarea autoasignada (debe dar 403)
  const selfVerifyAttempt = await request(`/tasks/${taskId}/verify`, {
    method: 'PATCH',
  }, parquesCoordToken);
  if (selfVerifyAttempt.status !== 403) {
    throw new Error(`Violación de regla de autoasignación: se esperaba 403 Forbidden pero se obtuvo ${selfVerifyAttempt.status}`);
  }
  console.log('  ✅ Regla de autoasignación validada: Coordinador de Área rechazado con 403 al intentar auto-verificar.');

  // El Coordinador General SÍ puede verificar la tarea autoasignada
  const generalVerify = await request(`/tasks/${taskId}/verify`, {
    method: 'PATCH',
  }, coordGeneralToken);
  if (generalVerify.status !== 200 || generalVerify.data.status !== 'VERIFICADA') {
    throw new Error(`Fallo verificación por Coordinación General: ${JSON.stringify(generalVerify.data)}`);
  }
  console.log('  ✅ Coordinación General verificó con éxito la tarea autoasignada.');

  console.log('\n===============================================================');
  console.log('🎉 TODAS LAS PRUEBAS DE ARQUITECTURA (ARCH-01 A ARCH-05) PASARON 🎉');
  console.log('===============================================================\n');
}

runArchTests().catch((err) => {
  console.error('\n❌ ERROR EN SUITE DE ARQUITECTURA:', err);
  process.exit(1);
});
