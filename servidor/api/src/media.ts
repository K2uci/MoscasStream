import { Router, type Request } from 'express';
import { z } from 'zod';
import { requireAuth } from './auth.js';
import { pool, touchCatalog } from './db.js';
import { deleteImage, saveImage, thumbPathOf, upload } from './images.js';
import { publicImageUrl } from './storage.js';
import { downloadImage, isTmdbImagePath } from './tmdb.js';

export const MEDIA_TYPES = ['pelicula', 'pelicula_animada', 'serie', 'serie_animada', 'anime', 'novela', 'documental', 'reality'] as const;

interface MediaRow {
  id: string;
  title: string;
  type: string;
  poster_path: string | null;
  backdrop_path: string | null;
  rating: string;
  synopsis: string;
  year: number | null;
  genres: string[];
  episodes: number | null;
  seasons: number | null;
  available: boolean;
  tmdb_ref: string | null;
  added_at: Date;
  updated_at: Date;
  ver?: string;
}

/** Formato que consume la app Android (ver app/src/types.ts). */
function toItem(r: MediaRow) {
  return {
    id: r.id,
    title: r.title,
    type: r.type,
    posterUrl: publicImageUrl(r.poster_path),
    thumbUrl: r.poster_path ? publicImageUrl(thumbPathOf(r.poster_path)) : undefined,
    backdropUrl: publicImageUrl(r.backdrop_path),
    rating: Number(r.rating),
    synopsis: r.synopsis,
    year: r.year ?? undefined,
    genres: r.genres,
    episodes: r.episodes ?? undefined,
    seasons: r.seasons ?? undefined,
    available: r.available,
    tmdbRef: r.tmdb_ref ?? undefined,
    addedAt: r.added_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

// ---------- Público: lo que lee la app Android ----------

export const catalogRouter = Router();

// Versión de una fila en microsegundos (bigint): el cursor no pierde precisión como con milisegundos de JS.
const VER = '(extract(epoch from updated_at) * 1000000)::bigint';
const NIL_UUID = '00000000-0000-0000-0000-000000000000';

/** Cursor opaco "versión:id". */
function parseCursor(raw: unknown): { ver: string; id: string } | null {
  const m = /^(\d{1,20}):([0-9a-fA-F-]{36})$/.exec(typeof raw === 'string' ? raw : '');
  return m ? { ver: m[1], id: m[2] } : null;
}

// GET /api/catalog
//  - Sin parámetros: catálogo completo con ETag (compatible con versiones anteriores de la app).
//  - Con ?limit=N&after=<cursor>: páginas de hasta N títulos (máx. 1000) ordenadas por versión. La app guarda
//    el `next` de la última página y en la siguiente sincronización solo recibe lo nuevo o modificado.
//    `deleted` (ids borrados desde `since`) llega en la última página.
catalogRouter.get('/', async (req, res) => {
  if (req.query.limit === undefined) {
    // La app consulta cada 30 s. Con el ETag, si nada cambió se responde 304 sin leer ni enviar el catálogo.
    const meta = await pool.query<{ updated_at: Date }>('SELECT updated_at FROM catalog_meta');
    const updatedAt = meta.rows[0]?.updated_at ?? new Date();
    const etag = `"cat-${updatedAt.getTime()}"`;
    res.set({ ETag: etag, 'Cache-Control': 'no-cache' });
    if (req.headers['if-none-match'] === etag) {
      res.status(304).end();
      return;
    }
    const items = await pool.query<MediaRow>('SELECT * FROM media ORDER BY added_at DESC');
    res.json({ updatedAt: updatedAt.toISOString(), items: items.rows.map(toItem) });
    return;
  }

  const limit = Math.min(Math.max(parseInt(String(req.query.limit), 10) || 300, 1), 1000);
  const after = parseCursor(req.query.after) ?? { ver: '0', id: NIL_UUID };
  const since = /^\d{1,20}$/.test(String(req.query.since ?? '')) ? String(req.query.since) : after.ver;

  const { rows } = await pool.query<MediaRow>(
    `SELECT *, ${VER} AS ver FROM media
     WHERE (${VER}, id) > ($1::bigint, $2::uuid)
     ORDER BY ver, id LIMIT $3`,
    [after.ver, after.id, limit + 1],
  );
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  const next = last ? `${last.ver}:${last.id}` : `${after.ver}:${after.id}`;

  let deleted: string[] = [];
  if (!hasMore && since !== '0') {
    const t = await pool.query<{ id: string }>(
      `SELECT id FROM media_tombstones WHERE (extract(epoch from deleted_at) * 1000000)::bigint > $1::bigint`,
      [since],
    );
    deleted = t.rows.map((r) => r.id);
  }
  const total = (await pool.query<{ n: string }>('SELECT count(*) AS n FROM media')).rows[0].n;

  res.set('Cache-Control', 'no-store');
  res.json({ items: page.map(toItem), deleted, next, hasMore, total: Number(total), serverTime: new Date().toISOString() });
});

// ---------- Administración (requiere login) ----------

// Los formularios llegan como multipart: todo son strings.
const emptyToUndef = (v: unknown) => (v === '' || v === 'null' || v === undefined ? undefined : v);
const optInt = z.preprocess(emptyToUndef, z.coerce.number().int().min(0).optional());

const mediaSchema = z.object({
  title: z.string().trim().min(1, 'El título es obligatorio').max(200),
  type: z.enum(MEDIA_TYPES),
  rating: z.coerce.number().min(0).max(10).default(0),
  synopsis: z.string().max(5000).default(''),
  year: z.preprocess(emptyToUndef, z.coerce.number().int().min(1888).max(2100).optional()),
  genres: z.preprocess(
    (v) => (typeof v === 'string' ? v.split(',') : v),
    z.array(z.string().trim()).transform((a) => a.filter(Boolean).slice(0, 15)),
  ).default([]),
  episodes: optInt,
  seasons: optInt,
  available: z.preprocess((v) => v === true || v === 'true' || v === 'on', z.boolean()).default(true),
  removePoster: z.preprocess((v) => v === 'true', z.boolean()).default(false),
  removeBackdrop: z.preprocess((v) => v === 'true', z.boolean()).default(false),
  // Autocompletado: rutas de imagen de TMDb que el servidor descarga, y la referencia del título.
  posterTmdb: z.preprocess(emptyToUndef, z.string().refine(isTmdbImagePath, 'imagen de TMDb no válida').optional()),
  backdropTmdb: z.preprocess(emptyToUndef, z.string().refine(isTmdbImagePath, 'imagen de TMDb no válida').optional()),
  tmdbRef: z.preprocess(emptyToUndef, z.string().regex(/^(movie|tv):\d+$/).optional()),
});

type Files = { poster?: Express.Multer.File[]; backdrop?: Express.Multer.File[] };
const imageFields = upload.fields([
  { name: 'poster', maxCount: 1 },
  { name: 'backdrop', maxCount: 1 },
]);

/** Imagen nueva: la subida desde el PC tiene prioridad; si no, la de TMDb. Devuelve null si no hay ninguna. */
async function newImage(file: Express.Multer.File | undefined, tmdbPath: string | undefined, kind: 'poster' | 'backdrop') {
  if (file) return saveImage(file.buffer, kind);
  if (tmdbPath) return saveImage(await downloadImage(tmdbPath, kind), kind);
  return null;
}

/** Descarga/guarda póster y fondo; si uno falla, borra el otro para no dejar archivos huérfanos. */
async function newImages(files: Files, d: { posterTmdb?: string; backdropTmdb?: string }) {
  const [p, b] = await Promise.allSettled([
    newImage(files.poster?.[0], d.posterTmdb, 'poster'),
    newImage(files.backdrop?.[0], d.backdropTmdb, 'backdrop'),
  ]);
  if (p.status === 'rejected' || b.status === 'rejected') {
    await Promise.all([p, b].map((r) => (r.status === 'fulfilled' ? deleteImage(r.value) : null)));
    throw p.status === 'rejected' ? p.reason : (b as PromiseRejectedResult).reason;
  }
  return [p.value, b.value] as const;
}

function parseBody(req: Request) {
  const parsed = mediaSchema.safeParse(req.body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    return { error: msg } as const;
  }
  return { data: parsed.data } as const;
}

export const adminRouter = Router();
adminRouter.use(requireAuth);

adminRouter.get('/media', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const type = typeof req.query.type === 'string' ? req.query.type : '';
  const where: string[] = [];
  const params: unknown[] = [];
  if (q) {
    params.push(`%${q}%`);
    where.push(`(title ILIKE $${params.length} OR array_to_string(genres, ',') ILIKE $${params.length})`);
  }
  if ((MEDIA_TYPES as readonly string[]).includes(type)) {
    params.push(type);
    where.push(`type = $${params.length}`);
  }
  const { rows } = await pool.query<MediaRow>(
    `SELECT * FROM media ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY added_at DESC`,
    params,
  );
  res.json(rows.map(toItem));
});

adminRouter.get('/media/:id', async (req, res) => {
  const { rows } = await pool.query<MediaRow>('SELECT * FROM media WHERE id = $1', [req.params.id]);
  if (!rows[0]) {
    res.status(404).json({ error: 'No encontrado' });
    return;
  }
  res.json(toItem(rows[0]));
});

adminRouter.post('/media', imageFields, async (req, res) => {
  const body = parseBody(req);
  if ('error' in body) {
    res.status(400).json({ error: body.error });
    return;
  }
  const d = body.data;
  const files = (req.files ?? {}) as Files;
  const [poster, backdrop] = await newImages(files, d);

  const { rows } = await pool.query<MediaRow>(
    `INSERT INTO media (title, type, rating, synopsis, year, genres, episodes, seasons, available, poster_path, backdrop_path, tmdb_ref)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [d.title, d.type, d.rating, d.synopsis, d.year ?? null, d.genres, d.episodes ?? null, d.seasons ?? null, d.available, poster, backdrop, d.tmdbRef ?? null],
  );
  await touchCatalog();
  res.status(201).json(toItem(rows[0]));
});

adminRouter.put('/media/:id', imageFields, async (req, res) => {
  const body = parseBody(req);
  if ('error' in body) {
    res.status(400).json({ error: body.error });
    return;
  }
  const d = body.data;
  const current = await pool.query<MediaRow>('SELECT * FROM media WHERE id = $1', [req.params.id]);
  const row = current.rows[0];
  if (!row) {
    res.status(404).json({ error: 'No encontrado' });
    return;
  }

  const files = (req.files ?? {}) as Files;
  let poster = row.poster_path;
  let backdrop = row.backdrop_path;
  const toDelete: (string | null)[] = [];
  const [newPoster, newBackdrop] = await newImages(files, d);
  if (newPoster) {
    toDelete.push(poster);
    poster = newPoster;
  } else if (d.removePoster) {
    toDelete.push(poster);
    poster = null;
  }
  if (newBackdrop) {
    toDelete.push(backdrop);
    backdrop = newBackdrop;
  } else if (d.removeBackdrop) {
    toDelete.push(backdrop);
    backdrop = null;
  }

  const { rows } = await pool.query<MediaRow>(
    `UPDATE media SET title=$2, type=$3, rating=$4, synopsis=$5, year=$6, genres=$7, episodes=$8, seasons=$9,
       available=$10, poster_path=$11, backdrop_path=$12, tmdb_ref=COALESCE($13, tmdb_ref), updated_at=now()
     WHERE id=$1 RETURNING *`,
    [row.id, d.title, d.type, d.rating, d.synopsis, d.year ?? null, d.genres, d.episodes ?? null, d.seasons ?? null, d.available, poster, backdrop, d.tmdbRef ?? null],
  );
  await Promise.all(toDelete.map(deleteImage));
  await touchCatalog();
  res.json(toItem(rows[0]));
});

adminRouter.patch('/media/:id/availability', async (req, res) => {
  const body = z.object({ available: z.boolean() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: 'available debe ser true o false' });
    return;
  }
  const { rows } = await pool.query<MediaRow>(
    'UPDATE media SET available=$2, updated_at=now() WHERE id=$1 RETURNING *',
    [req.params.id, body.data.available],
  );
  if (!rows[0]) {
    res.status(404).json({ error: 'No encontrado' });
    return;
  }
  await touchCatalog();
  res.json(toItem(rows[0]));
});

adminRouter.delete('/media/:id', async (req, res) => {
  const { rows } = await pool.query<MediaRow>('DELETE FROM media WHERE id=$1 RETURNING *', [req.params.id]);
  if (!rows[0]) {
    res.status(404).json({ error: 'No encontrado' });
    return;
  }
  await pool.query('INSERT INTO media_tombstones (id) VALUES ($1) ON CONFLICT (id) DO UPDATE SET deleted_at = now()', [rows[0].id]);
  await Promise.all([deleteImage(rows[0].poster_path), deleteImage(rows[0].backdrop_path)]);
  await touchCatalog();
  res.status(204).end();
});
