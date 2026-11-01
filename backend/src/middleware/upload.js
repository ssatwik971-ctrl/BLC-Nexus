import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { HttpError } from '../utils/http.js';

// Allowed document types: extension -> accepted MIME types
export const ALLOWED_FILES = {
  '.pdf': ['application/pdf'],
  '.png': ['image/png'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.webp': ['image/webp'],
  '.txt': ['text/plain'],
  '.md': ['text/markdown', 'text/plain', 'application/octet-stream'],
};

/** Multer instance storing files under random names with an allowlist. */
export function makeUpload(config) {
  fs.mkdirSync(config.uploadDir, { recursive: true });
  return multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, config.uploadDir),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${crypto.randomUUID()}${ext}`);
      },
    }),
    limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const mimes = ALLOWED_FILES[ext];
      if (!mimes || !mimes.includes(file.mimetype)) {
        return cb(new HttpError(415, `File type not allowed. Allowed: ${Object.keys(ALLOWED_FILES).join(', ')}`));
      }
      return cb(null, true);
    },
  });
}
