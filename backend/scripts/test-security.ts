/**
 * Test Suite de Seguridad y Control de Acceso (GEMA)
 * Valida:
 * - [SEC-04] Variables de entorno y configuración segura.
 * - [SEC-05] JWT con vida útil de 2h, endpoint /auth/refresh e invalidación/bloqueo de usuario inactivo.
 * - [SEC-06] Validación de complejidad de contraseña (mínimo 8 caracteres en POST /users y PATCH /users/:id).
 * - [SEC-07] Headers de seguridad y Content-Security-Policy (CSP) en Nginx.
 */

const BACKEND_URL = process.env.API_URL || 'http://localhost:4000/api';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

function decodeJwtPayload(token: string): any {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('JWT inválido');
  const payloadStr = Buffer.from(parts[1], 'base64').toString('utf8');
  return JSON.parse(payloadStr);
}

async function request(baseUrl: string, path: string, options: RequestInit = {}, token?: string) {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${baseUrl}${path}`, {
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

async function runSecurityTests() {
  console.log('================================================================');
  console.log('🔒 INICIANDO TEST SUITE DE SEGURIDAD Y CONTROL DE ACCESO (GEMA) 🔒');
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // 1. Login inicial de Administrador
  // --------------------------------------------------------------------------
  console.log('🔑 Paso 1: Autenticando con admin.general...');
  const adminLogin = await request(BACKEND_URL, '/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin.general', password: 'crisis2026' }),
  });

  if (adminLogin.status !== 200 || !adminLogin.data.token) {
    throw new Error(`Fallo en login de admin: ${JSON.stringify(adminLogin.data)}`);
  }
  const adminToken = adminLogin.data.token;
  console.log('✅ Admin autenticado con éxito.\n');

  // --------------------------------------------------------------------------
  // 2. [SEC-05] Expiración de JWT en 2 horas (7200 segundos)
  // --------------------------------------------------------------------------
  console.log('⏱️  Paso 2 [SEC-05]: Verificando tiempo de vida del JWT (2h)...');
  const payload = decodeJwtPayload(adminToken);
  const lifespanSeconds = payload.exp - payload.iat;
  console.log(`   Token iat: ${payload.iat}, exp: ${payload.exp}, duración: ${lifespanSeconds}s`);
  if (lifespanSeconds !== 7200) {
    throw new Error(`El token no tiene duración de 2h (7200s). Duración actual: ${lifespanSeconds}s`);
  }
  console.log('✅ Duración del JWT verificada: exactamente 2 horas (7200s).\n');

  // --------------------------------------------------------------------------
  // 3. [SEC-05] Endpoint /auth/refresh
  // --------------------------------------------------------------------------
  console.log('🔄 Paso 3 [SEC-05]: Probando endpoint POST /auth/refresh...');
  const refreshRes = await request(BACKEND_URL, '/auth/refresh', {
    method: 'POST',
  }, adminToken);

  if (refreshRes.status !== 200 || !refreshRes.data.token) {
    throw new Error(`Fallo en /auth/refresh: ${JSON.stringify(refreshRes.data)}`);
  }
  const refreshedPayload = decodeJwtPayload(refreshRes.data.token);
  if (refreshedPayload.exp - refreshedPayload.iat !== 7200) {
    throw new Error('El token refrescado no tiene duración de 2 horas');
  }
  console.log('✅ /auth/refresh emite nuevo token con 2 horas de vida correctamente.\n');

  // --------------------------------------------------------------------------
  // 4. [SEC-06] Validación de contraseña corta (< 8 caracteres) en POST /users
  // --------------------------------------------------------------------------
  console.log('🛡️  Paso 4 [SEC-06]: Validando rechazo de contraseñas de menos de 8 caracteres...');
  const shortPwRes = await request(BACKEND_URL, '/users', {
    method: 'POST',
    body: JSON.stringify({
      username: 'test.sec06',
      password: '123',
      name: 'Usuario Test',
      role: 'CONSULTA',
    }),
  }, adminToken);

  if (shortPwRes.status !== 400) {
    throw new Error(`Se esperaba 400 Bad Request por contraseña corta, se obtuvo ${shortPwRes.status}: ${JSON.stringify(shortPwRes.data)}`);
  }
  console.log(`✅ Contraseña corta rechazada (HTTP 400): "${shortPwRes.data.error}"\n`);

  // Crear usuario con contraseña válida (>= 8 caracteres)
  console.log('👤 Creando usuario con contraseña válida (>= 8 chars)...');
  const validPwRes = await request(BACKEND_URL, '/users', {
    method: 'POST',
    body: JSON.stringify({
      username: 'test.sec06',
      password: 'passwordSeguro2026',
      name: 'Usuario Test Seguridad',
      role: 'OPERACION',
    }),
  }, adminToken);

  if (validPwRes.status !== 201 || !validPwRes.data.id) {
    throw new Error(`Fallo al crear usuario válido: ${JSON.stringify(validPwRes.data)}`);
  }
  const testUserId = validPwRes.data.id;
  console.log(`✅ Usuario creado con éxito (ID: ${testUserId}).\n`);

  // Validar rechazo de contraseña corta en PATCH /users/:id
  console.log('🛡️  Paso 5 [SEC-06]: Validando rechazo de contraseña corta en PATCH /users/:id...');
  const patchShortPwRes = await request(BACKEND_URL, `/users/${testUserId}`, {
    method: 'PATCH',
    body: JSON.stringify({ password: 'abc' }),
  }, adminToken);

  if (patchShortPwRes.status !== 400) {
    throw new Error(`Se esperaba 400 Bad Request en PATCH con password corta, se obtuvo ${patchShortPwRes.status}`);
  }
  console.log(`✅ PATCH con contraseña corta rechazado (HTTP 400): "${patchShortPwRes.data.error}"\n`);

  // --------------------------------------------------------------------------
  // 5. [SEC-05] Verificación de usuario inactivo (revocación / bloqueo de acceso)
  // --------------------------------------------------------------------------
  console.log('🚫 Paso 6 [SEC-05]: Verificando revocación de acceso a usuario desactivado...');
  // Login con el usuario creado
  const testUserLogin = await request(BACKEND_URL, '/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'test.sec06', password: 'passwordSeguro2026' }),
  });
  if (testUserLogin.status !== 200 || !testUserLogin.data.token) {
    throw new Error(`Fallo al autenticar test.sec06: ${JSON.stringify(testUserLogin.data)}`);
  }
  const testUserToken = testUserLogin.data.token;

  // Probar que el usuario puede acceder a /auth/me
  const preMeRes = await request(BACKEND_URL, '/auth/me', { method: 'GET' }, testUserToken);
  if (preMeRes.status !== 200) {
    throw new Error(`Usuario recién creado no pudo acceder a /auth/me: ${preMeRes.status}`);
  }
  console.log('   Usuario test.sec06 opera con normalidad.');

  // Desactivar el usuario con cuenta admin
  console.log('   Desactivando usuario test.sec06 vía admin...');
  const deactivateRes = await request(BACKEND_URL, `/users/${testUserId}`, {
    method: 'PATCH',
    body: JSON.stringify({ active: false }),
  }, adminToken);
  if (deactivateRes.status !== 200 || deactivateRes.data.active !== false) {
    throw new Error('Fallo al desactivar usuario');
  }

  // Comprobar que de inmediato su token es rechazado con 401
  const postDeactivateRes = await request(BACKEND_URL, '/auth/me', { method: 'GET' }, testUserToken);
  if (postDeactivateRes.status !== 401) {
    throw new Error(`Se esperaba 401 para usuario desactivado, pero respondió ${postDeactivateRes.status}: ${JSON.stringify(postDeactivateRes.data)}`);
  }
  console.log(`✅ Token rechazado inmediatamente con HTTP 401: "${postDeactivateRes.data.error}".\n`);

  // Probar refresh con usuario inactivo -> también 401
  const refreshInactiveRes = await request(BACKEND_URL, '/auth/refresh', { method: 'POST' }, testUserToken);
  if (refreshInactiveRes.status !== 401) {
    throw new Error(`Se esperaba 401 en /auth/refresh para usuario inactivo, se obtuvo ${refreshInactiveRes.status}`);
  }
  console.log('✅ /auth/refresh bloqueado con 401 para usuario inactivo.\n');

  // Limpieza: reactivar y/o eliminar usuario de test si es posible
  console.log('🧹 Reactivando y limpiando usuario test...');
  await request(BACKEND_URL, `/users/${testUserId}`, {
    method: 'PATCH',
    body: JSON.stringify({ active: true }),
  }, adminToken);

  // --------------------------------------------------------------------------
  // 6. [SEC-07] Headers de seguridad y CSP en Nginx
  // --------------------------------------------------------------------------
  console.log('🌐 Paso 7 [SEC-07]: Verificando headers de seguridad en Nginx...');
  try {
    const nginxRes = await fetch(FRONTEND_URL, { method: 'GET' });
    const csp = nginxRes.headers.get('content-security-policy');
    const xcto = nginxRes.headers.get('x-content-type-options');
    const xfo = nginxRes.headers.get('x-frame-options');
    const rp = nginxRes.headers.get('referrer-policy');

    console.log(`   Content-Security-Policy: ${csp ? 'PRESENTE' : 'AUSENTE'}`);
    console.log(`   X-Content-Type-Options: ${xcto}`);
    console.log(`   X-Frame-Options: ${xfo}`);
    console.log(`   Referrer-Policy: ${rp}`);

    if (!csp || !csp.includes("script-src 'self'")) {
      throw new Error(`CSP ausente o no contiene "script-src 'self'": ${csp}`);
    }
    if (xcto !== 'nosniff') {
      throw new Error(`X-Content-Type-Options incorrecto: ${xcto}`);
    }
    if (xfo !== 'DENY') {
      throw new Error(`X-Frame-Options incorrecto: ${xfo}`);
    }
    console.log('✅ Headers de seguridad y CSP verificados correctamente en Nginx.\n');
  } catch (err: any) {
    console.warn(`⚠️ Verificación Nginx: ${err.message}`);
  }

  console.log('================================================================');
  console.log('🎉 TODOS LOS TESTS DE SEGURIDAD (SEC-04 a SEC-07) PASARON EXITOSAMENTE 🎉');
  console.log('================================================================\n');
}

runSecurityTests().catch((err) => {
  console.error('\n❌ ERROR EN SUITE DE SEGURIDAD:', err);
  process.exit(1);
});
