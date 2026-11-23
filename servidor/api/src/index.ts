import path from 'node:path';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import express, { type NextFunction, type Request, type Response } from 'express';
import { authRouter, requireAuth } from './auth.js';
import { config } from './config.js';
import { initDb, pool } from './db.js';
import { backfillThumbs } from './images.js';
import { storage } from './storage.js';
import { importText, runImport } from './importacion/importador.js';
import { backfillStatus, runBackfill } from './importacion/relleno.js';
import { adminRouter, catalogRouter } from './media.js';
import { adminPushRouter, devicesRouter } from './push.js';
import { adminRequestsRouter, publicRequestsRouter } from './requests.js';
import { TmdbError, tmdbRouter } from './tmdb.js';

const app = express();
app.disable('x-powered-by');
if (config.trustProxy) app.set('trust proxy', 1);
app.use(compression()); // el catálogo JSON (miles de títulos) viaja comprimido con gzip
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// La app Android no necesita CORS, pero así también funciona la versión web de Expo en desarrollo.
const publicCors = (req: Request, res: Response, next: NextFunction) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'If-None-Match, Content-Type',
    'Access-Control-Expose-Headers': 'ETag',
  });
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
};

app.get('/api/health', async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true });
});
app.use('/api/catalog', publicCors, catalogRouter);
app.use('/api/requests', publicCors, publicRequestsRouter);
app.use('/api/devices', publicCors, devicesRouter);
if (storage.kind === 'local') {
  app.use('/uploads', publicCors, express.static(config.uploadDir, { maxAge: '30d', immutable: true }), (_req, res) => {
    res.status(404).end();
  });
} else {
  // Nube sin URL pública del bucket: la API entrega las imágenes desde el bucket.
  app.get('/uploads/:file', publicCors, async (req, res) => {
    const file = String(req.params.file);
    const body = /^[\w.-]+\.webp$/.test(file) ? await storage.stream(file) : null;
    if (!body) {
      res.status(404).end();
      return;
    }
    res.set({ 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=2592000, immutable' });
    body.pipe(res);
  });
}
app.use('/api/auth', authRouter);
app.use('/api/admin/tmdb', requireAuth, tmdbRouter);
// Importar un listado .txt desde el panel (sirve en la nube, donde no hay carpeta "importacion").
app.post('/api/admin/import', requireAuth, express.text({ type: '*/*', limit: '10mb' }), (req, res) => {
  const text = typeof req.body === 'string' ? req.body : '';
  if (!text.trim()) {
    res.status(400).json({ error: 'El listado está vacío' });
    return;
  }
  const started = importText(text, 'panel');
  res.status(started ? 202 : 409).json(started ? { ok: true, titles: started } : { error: 'Ya hay una importación en curso' });
});
app.get('/api/admin/backfill', requireAuth, async (_req, res) => res.json(await backfillStatus()));
app.post('/api/admin/backfill', requireAuth, (_req, res) => {
  void runBackfill();
  res.status(202).json({ ok: true });
});
app.use('/api/admin/requests', adminRequestsRouter);
app.use('/api/admin/push', adminPushRouter);
app.use('/api/admin', adminRouter);
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Panel web (build de Vite) servido por la misma API.
if (config.webDir) {
  const webDir = config.webDir;
  app.use(express.static(webDir));
  app.get('/{*splat}', (_req, res) => res.sendFile(path.join(webDir, 'index.html')));
}

app.use((err: Error & { code?: string }, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof TmdbError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err.code === '22P02') {
    res.status(404).json({ error: 'No encontrado' }); // id con formato inválido
    return;
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ error: 'La imagen supera 15 MB' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

await initDb();
const posters = await pool.query<{ poster_path: string }>('SELECT poster_path FROM media WHERE poster_path IS NOT NULL');
await backfillThumbs(posters.rows.map((r) => r.poster_path));

app.listen(config.port, '0.0.0.0', () => {
  console.log(`[api] MoscasStream escuchando en el puerto ${config.port}`);
  console.log(`[api] Autocompletado TMDb: ${config.tmdbToken ? 'activo' : 'desactivado (falta TMDB_TOKEN)'}`);
  // Los listados de importacion/ se procesan en segundo plano: el servidor ya atiende mientras tanto.
  void runImport();
  // Duración y tráiler de los títulos que aún no los tienen (reanudable; ver importacion/relleno.ts).
  void runBackfill();
});
