import { randomUUID } from 'node:crypto';
import path from 'node:path';
import multer from 'multer';
import sharp from 'sharp';
import { storage } from './storage.js';

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

const nameOf = (publicPath: string) => path.basename(publicPath);

/** "/uploads/poster-x.webp" → "/uploads/poster-x-thumb.webp" */
export const thumbPathOf = (posterPath: string) => posterPath.replace(/\.webp$/, '-thumb.webp');

async function writeVariant(input: Buffer, kind: keyof typeof sizes, name: string) {
  const { width, height, quality } = sizes[kind];
  const out = await sharp(input)
    .rotate()
    .resize({ width, height, fit: 'cover', withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();
  await storage.write(name, out);
}

/** Recorta/reduce la imagen y la guarda como WebP. Devuelve la ruta pública ("/uploads/x.webp"). */
export async function saveImage(buffer: Buffer, kind: 'poster' | 'backdrop'): Promise<string> {
  const publicPath = `/uploads/${kind}-${randomUUID()}.webp`;
  await writeVariant(buffer, kind, nameOf(publicPath));
  if (kind === 'poster') await writeVariant(buffer, 'thumb', nameOf(thumbPathOf(publicPath)));
  return publicPath;
}

export async function deleteImage(publicPath: string | null | undefined) {
  if (!publicPath?.startsWith('/uploads/')) return;
  await storage.remove(nameOf(publicPath));
  await storage.remove(nameOf(thumbPathOf(publicPath)));
}

/** Crea las miniaturas que falten (solo almacenamiento local; en la nube no se revisa en cada arranque). */
export async function backfillThumbs(posterPaths: string[]) {
  if (storage.kind !== 'local') return;
  let created = 0;
  for (const p of posterPaths) {
    if (await storage.exists(nameOf(thumbPathOf(p)))) continue;
    try {
      await writeVariant(await storage.read(nameOf(p)), 'thumb', nameOf(thumbPathOf(p)));
      created++;
    } catch (e) {
      console.warn(`[thumbs] no se pudo crear la miniatura de ${p}:`, (e as Error).message);
    }
  }
  if (created) console.log(`[thumbs] ${created} miniaturas creadas`);
}
