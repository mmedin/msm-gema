import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { config } from '../config';

if (!fs.existsSync(config.uploadDir)) {
  fs.mkdirSync(config.uploadDir, { recursive: true });
}

export const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, config.uploadDir);
  },
  filename: (_req, file, cb) => {
    // Inferencia estricta de la extensión a partir del MIME type (mitiga Stored XSS por extensiones engañosas)
    const ext = MIME_EXTENSION_MAP[file.mimetype] || '.jpg';
    const hash = crypto.randomUUID();
    cb(null, `${hash}${ext}`);
  },
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype in MIME_EXTENSION_MAP) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten imágenes JPEG, PNG o WEBP (máx. 15MB)'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15 MB
  },
});

/**
 * Elimina de disco archivos huérfanos si la validación del payload o la persistencia en base de datos fallan
 */
export const cleanupUploadedFile = (file?: Express.Multer.File): void => {
  if (file?.path && fs.existsSync(file.path)) {
    try {
      fs.unlinkSync(file.path);
    } catch (err) {
      console.error('Error al limpiar archivo huérfano de subida:', err);
    }
  }
};

