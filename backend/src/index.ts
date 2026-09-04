import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import fs from 'fs';
import { config } from './config';
import { authRouter } from './routes/auth';
import { eventsRouter } from './routes/events';
import { noticesRouter } from './routes/notices';
import { incidentsRouter } from './routes/incidents';
import { tasksRouter } from './routes/tasks';
import { evacuationRouter } from './routes/evacuation';
import { dashboardRouter } from './routes/dashboard';
import { usersRouter } from './routes/users';
import { areasRouter } from './routes/areas';
import { prisma } from './db';

const app = express();

// Confiar en el reverse proxy (Nginx / Coolify) para obtención correcta de IP del cliente
app.set('trust proxy', 1);

// Asegurar existencia de directorio de uploads
if (!fs.existsSync(config.uploadDir)) {
  fs.mkdirSync(config.uploadDir, { recursive: true });
}

// Configuración de orígenes permitidos para CORS sin comodín para cumplir estándar W3C con credentials
const configuredOrigins = config.frontendUrl
  ? config.frontendUrl.split(',').map((url) => url.trim()).filter(Boolean)
  : [];

const defaultAllowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:80',
  'http://localhost',
];

const allowedOrigins = Array.from(new Set([...defaultAllowedOrigins, ...configuredOrigins]));

const isAllowedOrigin = (origin: string): boolean => {
  if (allowedOrigins.includes(origin)) return true;
  try {
    const parsed = new URL(origin);
    const hostname = parsed.hostname;
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
    );
  } catch {
    return false;
  }
};

// Seguridad y middlewares básicos
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(
  cors({
    origin: (origin, callback) => {
      // Permitir peticiones sin header Origin (como curl, server-to-server, healthchecks)
      if (!origin) {
        return callback(null, true);
      }
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origen no permitido por política CORS: ${origin}`));
    },
    credentials: true,
    exposedHeaders: ['X-Total-Count', 'X-Limit', 'X-Offset'],
  })
);
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir estáticos de uploads directamente desde el backend (útil para pruebas y fallback)
app.use('/uploads', express.static(config.uploadDir));

// Healthcheck
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'gema-backend',
    municipality: 'Municipalidad de General San Martín',
    timestamp: new Date().toISOString(),
  });
});

// Enrutamiento de la API
app.use('/api/auth', authRouter);
app.use('/api/events', eventsRouter);
app.use('/api/notices', noticesRouter);
app.use('/api/incidents', incidentsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/evacuation-centers', evacuationRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/users', usersRouter);
app.use('/api/areas', areasRouter);

// Manejo centralizado de 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Manejo centralizado de errores
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error global no capturado:', err);

  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ error: 'El archivo supera el tamaño máximo permitido de 15MB' });
      return;
    }
    res.status(400).json({ error: `Error en subida de archivo: ${err.message}` });
    return;
  }

  if (err.message && err.message.includes('Solo se permiten imágenes')) {
    res.status(400).json({ error: err.message });
    return;
  }

  if (err.message && err.message.includes('Origen no permitido por política CORS')) {
    res.status(403).json({ error: err.message });
    return;
  }

  res.status(err.status || 500).json({
    error: err.message || 'Error interno en el servidor',
  });
});

const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`GEMA (Gestión de Eventos Meteorológicos Adversos) - Backend Inicializado`);
  console.log(`Municipalidad de General San Martín`);
  console.log(`Puerto: ${config.port}`);
  console.log(`Ambiente: ${config.nodeEnv}`);
  console.log(`Uploads: ${config.uploadDir}`);
  console.log(`====================================================`);
});

let isShuttingDown = false;

const gracefulShutdown = (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n[SHUTDOWN] Señal ${signal} recibida. Iniciando cierre ordenado de GEMA Backend...`);

  const forceExitTimer = setTimeout(() => {
    console.error('[SHUTDOWN] Tiempo límite de espera agotado (10s). Forzando salida.');
    process.exit(1);
  }, 10000);
  forceExitTimer.unref();

  server.close(async (err) => {
    if (err) {
      console.error('[SHUTDOWN] Error al cerrar servidor HTTP:', err);
    } else {
      console.log('[SHUTDOWN] Servidor HTTP cerrado correctamente.');
    }

    try {
      console.log('[SHUTDOWN] Desconectando Prisma Client de PostgreSQL...');
      await prisma.$disconnect();
      console.log('[SHUTDOWN] Conexión a base de datos cerrada limpiamente.');
      process.exit(0);
    } catch (dbErr) {
      console.error('[SHUTDOWN] Error cerrando conexión con base de datos:', dbErr);
      process.exit(1);
    }
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
