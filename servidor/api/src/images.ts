import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import sharp from 'sharp';
import { config } from './config.js';

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
});

const sizes = {
  poster: { width: 600, height: 900, quality: 80 },
  backdrop: { width: 1280, height: 720, quality: 78 },
  // Miniatura para las listas de la app (~15–25 KB): mantiene el caché del teléfono pequeño.
  thumb: { width: 300, height: 450, quality: 70 },
};

const filePath = (publicPath: string) => path.join(config.uploadDir, path.basename(publicPath));

/** "/uploads/poster-x.webp" → "/uploads/poster-x-thumb.webp" */
export const thumbPathOf = (posterPath: string) => posterPath.replace(/\.webp$/, '-thumb.webp');

async function writeVariant(input: Buffer | string, kind: keyof typeof sizes, dest: string) {
  const { width, height, quality } = sizes[kind];
  await sharp(input)
    .rotate()
    .resize({ width, height, fit: 'cover', withoutEnlargement: true })
    .webp({ quality })
    .toFile(dest);
}

/** Recorta/reduce la imagen y la guarda como WebP. Devuelve la ruta pública ("/uploads/x.webp"). */
export async function saveImage(buffer: Buffer, kind: 'poster' | 'backdrop'): Promise<string> {
  await fs.mkdir(config.uploadDir, { recursive: true });
  const publicPath = `/uploads/${kind}-${randomUUID()}.webp`;
  await writeVariant(buffer, kind, filePath(publicPath));
  if (kind === 'poster') await writeVariant(buffer, 'thumb', filePath(thumbPathOf(publicPath)));
  return publicPath;
}

export async function deleteImage(publicPath: string | null | undefined) {
  if (!publicPath?.startsWith('/uploads/')) return;
  await fs.rm(filePath(publicPath), { force: true });
  await fs.rm(filePath(thumbPathOf(publicPath)), { force: true });
}

/** Crea las miniaturas que falten (pósters subidos antes de que existieran). */
export async function backfillThumbs(posterPaths: string[]) {
  let created = 0;
  for (const p of posterPaths) {
    const thumb = filePath(thumbPathOf(p));
    const exists = await fs.access(thumb).then(() => true, () => false);
    if (exists) continue;
    try {
      await writeVariant(filePath(p), 'thumb', thumb);
      created++;
    } catch (e) {
      console.warn(`[thumbs] no se pudo crear la miniatura de ${p}:`, (e as Error).message);
    }
  }
  if (created) console.log(`[thumbs] ${created} miniaturas creadas`);
}
