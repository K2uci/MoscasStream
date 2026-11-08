import path from 'node:path';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import express, { type NextFunction, type Request, type Response } from 'express';
import { authRouter, requireAuth } from './auth.js';
import { config } from './config.js';
import { initDb, pool } from './db.js';
import { backfillThumbs } from './images.js';
import { runImport } from './importacion/importador.js';
import { adminRouter, catalogRouter } from './media.js';
import { TmdbError, tmdbRouter } from './tmdb.js';

const app = express();
app.disable('x-powered-by');
app.use(compression()); // el catálogo JSON (miles de títulos) viaja comprimido con gzip
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// La app Android no necesita CORS, pero así también funciona la versión web de Expo en desarrollo.
const publicCors = (req: Request, res: Response, next: NextFunction) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'If-None-Match',
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
app.use('/uploads', publicCors, express.static(config.uploadDir, { maxAge: '30d', immutable: true }), (_req, res) => {
  res.status(404).end();
});
app.use('/api/auth', authRouter);
app.use('/api/admin/tmdb', requireAuth, tmdbRouter);
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
});
