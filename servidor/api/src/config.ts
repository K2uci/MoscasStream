import { randomBytes } from 'node:crypto';
import path from 'node:path';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

const jwtSecret = process.env.JWT_SECRET || randomBytes(32).toString('hex');
if (!process.env.JWT_SECRET) {
  console.warn('[config] JWT_SECRET no definido: se generó uno temporal (las sesiones se cierran al reiniciar).');
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret,
  adminUser: required('ADMIN_USER'),
  adminPassword: required('ADMIN_PASSWORD'),
  uploadDir: path.resolve(process.env.UPLOAD_DIR ?? 'uploads'),
  webDir: process.env.WEB_DIR ? path.resolve(process.env.WEB_DIR) : null,
  // Autocompletado desde TMDb (opcional): token de lectura v4 ("eyJ...") o API key v3.
  tmdbToken: process.env.TMDB_TOKEN?.trim() || null,
  tmdbLanguage: process.env.TMDB_LANGUAGE?.trim() || 'es-ES',
  // Carpeta donde se dejan los listados .txt que se importan al arrancar.
  importDir: path.resolve(process.env.IMPORT_DIR ?? 'importacion'),
};
