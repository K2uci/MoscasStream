// Almacenamiento de imágenes. Dos modos:
//  - Local: carpeta UPLOAD_DIR (PC propio o disco persistente).
//  - Nube: bucket compatible con S3 (Cloudflare R2, AWS S3, Backblaze B2, Supabase Storage…).
//    Es lo que permite correr la API en servicios sin disco persistente (Render, Railway, Fly, Vercel…).
import fs from 'node:fs/promises';
import path from 'node:path';
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { Readable } from 'node:stream';
import { config } from './config.js';

export interface Storage {
  readonly kind: 'local' | 'cloud';
  write(name: string, data: Buffer): Promise<void>;
  read(name: string): Promise<Buffer>;
  stream(name: string): Promise<Readable | null>;
  remove(name: string): Promise<void>;
  exists(name: string): Promise<boolean>;
}

const CACHE = 'public, max-age=31536000, immutable';

function localStorage(): Storage {
  const file = (name: string) => path.join(config.uploadDir, path.basename(name));
  return {
    kind: 'local',
    async write(name, data) {
      await fs.mkdir(config.uploadDir, { recursive: true });
      await fs.writeFile(file(name), data);
    },
    read: (name) => fs.readFile(file(name)),
    async stream() {
      return null; // se sirve con express.static
    },
    remove: (name) => fs.rm(file(name), { force: true }),
    exists: (name) => fs.access(file(name)).then(() => true, () => false),
  };
}

function cloudStorage(c: NonNullable<typeof config.s3>): Storage {
  const client = new S3Client({
    region: c.region,
    endpoint: c.endpoint,
    forcePathStyle: c.forcePathStyle,
    credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
  });
  const Bucket = c.bucket;
  const key = (name: string) => path.basename(name);
  return {
    kind: 'cloud',
    async write(name, data) {
      await client.send(new PutObjectCommand({ Bucket, Key: key(name), Body: data, ContentType: 'image/webp', CacheControl: CACHE }));
    },
    async read(name) {
      const r = await client.send(new GetObjectCommand({ Bucket, Key: key(name) }));
      return Buffer.from(await r.Body!.transformToByteArray());
    },
    async stream(name) {
      try {
        const r = await client.send(new GetObjectCommand({ Bucket, Key: key(name) }));
        return r.Body as Readable;
      } catch {
        return null;
      }
    },
    async remove(name) {
      await client.send(new DeleteObjectCommand({ Bucket, Key: key(name) }));
    },
    exists: (name) => client.send(new HeadObjectCommand({ Bucket, Key: key(name) })).then(() => true, () => false),
  };
}

export const storage: Storage = config.s3 ? cloudStorage(config.s3) : localStorage();

/** "/uploads/x.webp" → URL pública directa del bucket (si está configurada), si no la misma ruta relativa. */
export function publicImageUrl(p: string | null | undefined): string | undefined {
  if (!p) return undefined;
  if (config.s3?.publicUrl && p.startsWith('/uploads/')) return `${config.s3.publicUrl}/${path.basename(p)}`;
  return p;
}
