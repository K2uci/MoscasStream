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

const s3Bucket = process.env.S3_BUCKET?.trim();
const s3 = s3Bucket
  ? {
      bucket: s3Bucket,
      endpoint: process.env.S3_ENDPOINT?.trim() || undefined, // R2: https://<cuenta>.r2.cloudflarestorage.com
      region: process.env.S3_REGION?.trim() || 'auto',
      accessKeyId: required('S3_ACCESS_KEY_ID'),
      secretAccessKey: required('S3_SECRET_ACCESS_KEY'),
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
      // URL pública del bucket (dominio r2.dev o propio). Sin ella, la API sirve las imágenes ella misma.
      publicUrl: process.env.S3_PUBLIC_URL?.trim().replace(/\/+$/, '') || undefined,
    }
  : null;

export const config = {
  s3,
  // Detrás de un proxy en la nube (Render, Railway, Fly…): HTTPS y la IP real del cliente.
  isProduction: process.env.NODE_ENV === 'production',
  trustProxy: process.env.TRUST_PROXY === 'true' || (process.env.TRUST_PROXY !== 'false' && !!process.env.RENDER),
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
