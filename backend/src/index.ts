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

const app = express();

// Asegurar existencia de directorio de uploads
if (!fs.existsSync(config.uploadDir)) {
  fs.mkdirSync(config.uploadDir, { recursive: true });
}

// Seguridad y middlewares básicos
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(
  cors({
    origin: '*',
    credentials: true,
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
    service: 'msm-crisis-backend',
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
  res.status(err.status || 500).json({
    error: err.message || 'Error interno en el servidor',
  });
});

app.listen(config.port, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`MSM-CRISIS (Plan B Operativo) - Backend Inicializado`);
  console.log(`Municipalidad de General San Martín`);
  console.log(`Puerto: ${config.port}`);
  console.log(`Ambiente: ${config.nodeEnv}`);
  console.log(`Uploads: ${config.uploadDir}`);
  console.log(`====================================================`);
});
