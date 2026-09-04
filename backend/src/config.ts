import path from 'path';

const isProduction = (process.env.NODE_ENV || 'development') === 'production';

/**
 * Exige que una variable de entorno esté definida.
 * - En producción: lanza un error fatal (fail-fast).
 * - En desarrollo: emite un warning y usa el fallback inseguro proporcionado.
 */
function requireEnv(key: string, devFallback: string): string {
  const value = process.env[key];
  if (value) return value;

  if (isProduction) {
    throw new Error(
      `[GEMA FATAL] La variable de entorno ${key} es obligatoria en producción y no está definida. ` +
      `Defínala en el archivo .env o en la configuración del entorno.`
    );
  }

  console.warn(
    `[GEMA WARN] ${key} no está definida. Usando fallback de desarrollo inseguro. ` +
    `NO use este valor en producción.`
  );
  return devFallback;
}

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: requireEnv('JWT_SECRET', 'dev_only_jwt_secret_DO_NOT_USE_IN_PROD'),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  uploadDir: process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'uploads'),
  databaseUrl: requireEnv('DATABASE_URL', 'postgres://crisis_user:crisis_secret_2026@localhost:5432/msm_crisis'),
  rateLimit: {
    loginWindowMs: parseInt(process.env.RATE_LIMIT_LOGIN_WINDOW_MS || '60000', 10), // 1 minuto por defecto
    loginMax: parseInt(process.env.RATE_LIMIT_LOGIN_MAX || '10', 10), // 10 intentos por defecto
  },
};
