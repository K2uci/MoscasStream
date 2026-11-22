// Pedidos de títulos: los usuarios piden desde la app lo que no encuentran; el administrador los ve en el panel.
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from './auth.js';
import { pool } from './db.js';
import { MEDIA_TYPES } from './media.js';

interface RequestRow {
  id: string;
  title: string;
  type: string | null;
  note: string;
  requester: string;
  device_id: string;
  status: 'pendiente' | 'agregado' | 'descartado';
  created_at: Date;
}

const toItem = (r: RequestRow) => ({
  id: r.id,
  title: r.title,
  type: r.type ?? undefined,
  note: r.note,
  requester: r.requester,
  status: r.status,
  createdAt: r.created_at.toISOString(),
});

const bodySchema = z.object({
  title: z.string().trim().min(2, 'Escribe el título').max(150),
  type: z.enum(MEDIA_TYPES).optional(),
  note: z.string().trim().max(300).default(''),
  requester: z.string().trim().max(40).default(''),
  deviceId: z.string().trim().regex(/^[\w-]{8,64}$/, 'Dispositivo no válido'),
});

// Límite sencillo contra abusos (en memoria): por IP y por dispositivo.
const hits = new Map<string, number[]>();
function limited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= max) {
    hits.set(key, list);
    return true;
  }
  list.push(now);
  hits.set(key, list);
  return false;
}

const normalize = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9ñ]+/g, ' ').trim();

// ---------- Público (lo usa la app) ----------

export const publicRequestsRouter = Router();

publicRequestsRouter.post('/', async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Datos no válidos' });
    return;
  }
  const d = parsed.data;
  if (limited(`ip:${req.ip}`, 30, 3600_000) || limited(`dev:${d.deviceId}`, 8, 24 * 3600_000)) {
    res.status(429).json({ error: 'Has hecho muchos pedidos hoy. Intenta más tarde.' });
    return;
  }

  // ¿Ya está en el catálogo?
  const wanted = normalize(d.title);
  const exists = await pool.query<{ title: string }>(
    `SELECT title FROM media WHERE lower(title) = lower($1) LIMIT 1`,
    [d.title],
  );
  if (exists.rows[0] || (await titleExistsFuzzy(wanted))) {
    res.json({ ok: true, exists: true });
    return;
  }

  // ¿Ya lo pidió este dispositivo y sigue pendiente?
  const dup = await pool.query(
    `SELECT 1 FROM title_requests WHERE device_id = $1 AND status = 'pendiente' AND lower(title) = lower($2) LIMIT 1`,
    [d.deviceId, d.title],
  );
  if (dup.rowCount) {
    res.json({ ok: true, duplicate: true });
    return;
  }

  const { rows } = await pool.query<RequestRow>(
    `INSERT INTO title_requests (title, type, note, requester, device_id) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [d.title, d.type ?? null, d.note, d.requester, d.deviceId],
  );
  res.status(201).json({ ok: true, request: toItem(rows[0]) });
});

/** Coincidencia sin tildes ni signos (p. ej. "Él Padrino" ≈ "El padrino"). */
async function titleExistsFuzzy(wanted: string): Promise<boolean> {
  if (wanted.length < 3) return false;
  const { rowCount } = await pool.query(
    `SELECT 1 FROM media WHERE regexp_replace(lower(translate(title, 'áéíóúüÁÉÍÓÚÜ', 'aeiouuAEIOUU')), '[^a-z0-9ñ]+', ' ', 'g') = $1 LIMIT 1`,
    [wanted],
  ).catch(() => ({ rowCount: 0 }));
  return Boolean(rowCount);
}

// Estado de los pedidos de un dispositivo.
publicRequestsRouter.get('/mine', async (req, res) => {
  const deviceId = String(req.query.deviceId ?? '');
  if (!/^[\w-]{8,64}$/.test(deviceId)) {
    res.json([]);
    return;
  }
  const { rows } = await pool.query<RequestRow>(
    'SELECT * FROM title_requests WHERE device_id = $1 ORDER BY created_at DESC LIMIT 30',
    [deviceId],
  );
  res.json(rows.map(toItem));
});

// ---------- Administración (panel) ----------

export const adminRequestsRouter = Router();
adminRequestsRouter.use(requireAuth);

adminRequestsRouter.get('/', async (req, res) => {
  const status = String(req.query.status ?? '');
  const params = ['pendiente', 'agregado', 'descartado'].includes(status) ? [status] : [];
  const { rows } = await pool.query<RequestRow>(
    `SELECT * FROM title_requests ${params.length ? 'WHERE status = $1' : ''} ORDER BY created_at DESC LIMIT 500`,
    params,
  );
  res.json(rows.map(toItem));
});

adminRequestsRouter.get('/count', async (_req, res) => {
  const { rows } = await pool.query<{ n: string }>(`SELECT count(*) AS n FROM title_requests WHERE status = 'pendiente'`);
  res.json({ pending: Number(rows[0].n) });
});

adminRequestsRouter.patch('/:id', async (req, res) => {
  const body = z.object({ status: z.enum(['pendiente', 'agregado', 'descartado']) }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: 'Estado no válido' });
    return;
  }
  const { rows } = await pool.query<RequestRow>('UPDATE title_requests SET status = $2 WHERE id = $1 RETURNING *', [
    req.params.id,
    body.data.status,
  ]);
  if (!rows[0]) {
    res.status(404).json({ error: 'No encontrado' });
    return;
  }
  res.json(toItem(rows[0]));
});

adminRequestsRouter.delete('/:id', async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM title_requests WHERE id = $1', [req.params.id]);
  if (!rowCount) {
    res.status(404).json({ error: 'No encontrado' });
    return;
  }
  res.status(204).end();
});
