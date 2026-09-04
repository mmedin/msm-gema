import path from 'path';

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'super_secreto_para_jwt_crisis_san_martin_2026',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  uploadDir: process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'uploads'),
  databaseUrl: process.env.DATABASE_URL || 'postgres://crisis_user:crisis_secret_2026@localhost:5432/msm_crisis',
  rateLimit: {
    loginWindowMs: parseInt(process.env.RATE_LIMIT_LOGIN_WINDOW_MS || '60000', 10), // 1 minuto por defecto
    loginMax: parseInt(process.env.RATE_LIMIT_LOGIN_MAX || '10', 10), // 10 intentos por defecto
  },
};
