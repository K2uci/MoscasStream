import bcrypt from 'bcryptjs';
import { Router, type NextFunction, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from './config.js';
import { pool } from './db.js';

const COOKIE = 'moscas_session';
const SESSION_HOURS = 12;

// Límite simple de intentos de login por IP.
const attempts = new Map<string, { count: number; until: number }>();
const MAX_ATTEMPTS = 5;
const LOCK_MS = 5 * 60_000;

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE];
  try {
    const payload = jwt.verify(token, config.jwtSecret) as { sub: string };
    res.locals.user = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: 'No autenticado' });
  }
}

export const authRouter = Router();

authRouter.post('/login', async (req, res) => {
  const ip = req.ip ?? 'unknown';
  const entry = attempts.get(ip);
  if (entry && entry.count >= MAX_ATTEMPTS && entry.until > Date.now()) {
    res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos.' });
    return;
  }

  const body = z.object({ username: z.string(), password: z.string() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    return;
  }

  const { rows } = await pool.query('SELECT username, password_hash FROM admins WHERE username = $1', [
    body.data.username,
  ]);
  const ok = rows[0] && (await bcrypt.compare(body.data.password, rows[0].password_hash));
  if (!ok) {
    const count = (entry && entry.until > Date.now() ? entry.count : 0) + 1;
    attempts.set(ip, { count, until: Date.now() + LOCK_MS });
    res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    return;
  }

  attempts.delete(ip);
  const token = jwt.sign({ sub: rows[0].username }, config.jwtSecret, { expiresIn: `${SESSION_HOURS}h` });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: false, // red local por http
    maxAge: SESSION_HOURS * 3600_000,
  });
  res.json({ username: rows[0].username });
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE);
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, (_req, res) => {
  res.json({ username: res.locals.user });
});
