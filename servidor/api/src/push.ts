// Notificaciones push (como un mensaje nuevo): cada vez que el administrador agrega títulos,
// a los teléfonos registrados les llega un aviso del sistema, incluso con la app cerrada.
//
// Se envían por el servicio de Expo (https://docs.expo.dev/push-notifications/sending-notifications/), que entrega
// a Android por FCM. Hace falta la clave de cuenta de servicio de Firebase cargada en EAS (ver DESPLIEGUE.md).
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from './auth.js';
import { pool } from './db.js';

const EXPO_PUSH = 'https://exp.host/--/api/v2/push/send';
const CHANNEL = 'novedades';

const log = (msg: string) => console.log(`[push] ${msg}`);

// ---------- Registro de dispositivos ----------

export const devicesRouter = Router();

const bodySchema = z.object({
  token: z.string().regex(/^Expo(nent)?PushToken\[[\w-]{10,60}\]$/, 'Token no válido'),
  deviceId: z.string().trim().regex(/^[\w-]{8,64}$/, 'Dispositivo no válido'),
});

const hits = new Map<string, number[]>();
function limited(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(key, list);
  return list.length > max;
}

// La app registra (o renueva) su token al abrirse.
devicesRouter.post('/', async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Datos no válidos' });
    return;
  }
  if (limited(`ip:${req.ip}`, 60, 3600_000)) {
    res.status(429).json({ error: 'Demasiadas solicitudes' });
    return;
  }
  const { token, deviceId } = parsed.data;
  // Un dispositivo tiene un solo token vigente.
  await pool.query('DELETE FROM push_tokens WHERE device_id = $1 AND token <> $2', [deviceId, token]);
  await pool.query(
    `INSERT INTO push_tokens (token, device_id) VALUES ($1, $2)
     ON CONFLICT (token) DO UPDATE SET device_id = EXCLUDED.device_id, last_seen = now()`,
    [token, deviceId],
  );
  res.json({ ok: true });
});

// ---------- Panel: estado y prueba ----------

export const adminPushRouter = Router();
adminPushRouter.use(requireAuth);

adminPushRouter.get('/', async (_req, res) => {
  const { rows } = await pool.query<{ n: string }>('SELECT count(*) AS n FROM push_tokens');
  res.json({ devices: Number(rows[0].n) });
});

adminPushRouter.post('/test', async (_req, res) => {
  const result = await sendToAll('🔔 Prueba de notificación', 'Si ves esto, las notificaciones funcionan.');
  res.json(result);
});

// ---------- Envío ----------

interface Ticket {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}

/** Envía a todos los dispositivos registrados (en lotes de 100) y borra los tokens que ya no sirven. */
async function sendToAll(title: string, body: string): Promise<{ sent: number; failed: number; removed: number }> {
  const { rows } = await pool.query<{ token: string }>('SELECT token FROM push_tokens');
  let sent = 0;
  let failed = 0;
  const dead: string[] = [];
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (process.env.EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;

  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const messages = batch.map((r) => ({
      to: r.token,
      title,
      body,
      sound: 'default',
      priority: 'high',
      channelId: CHANNEL,
      data: { screen: 'novedades' },
    }));
    try {
      const res = await fetch(EXPO_PUSH, { method: 'POST', headers, body: JSON.stringify(messages), signal: AbortSignal.timeout(30_000) });
      const json = (await res.json()) as { data?: Ticket[]; errors?: { message: string }[] };
      if (!res.ok || !json.data) {
        failed += batch.length;
        log(`error del servicio de Expo: ${res.status} ${json.errors?.[0]?.message ?? ''}`);
        continue;
      }
      json.data.forEach((t, idx) => {
        if (t.status === 'ok') sent++;
        else {
          failed++;
          if (t.details?.error === 'DeviceNotRegistered') dead.push(batch[idx].token);
          else log(`no entregado: ${t.message ?? t.details?.error}`);
        }
      });
    } catch (e) {
      failed += batch.length;
      log(`no se pudo contactar con Expo: ${(e as Error).message}`);
    }
  }
  if (dead.length) await pool.query('DELETE FROM push_tokens WHERE token = ANY($1)', [dead]);
  log(`enviadas ${sent}, fallidas ${failed}, tokens eliminados ${dead.length}`);
  return { sent, failed, removed: dead.length };
}

// ---------- Aviso agrupado de títulos nuevos ----------

// Si el administrador agrega varios títulos seguidos (o se importa un listado), se juntan en UN solo aviso:
// sale cuando pasa un rato sin novedades, y como máximo cada pocos minutos aunque sigan llegando.
const QUIET_MS = 45_000;
const MAX_WAIT_MS = 5 * 60_000;

let pending: string[] = [];
let quietTimer: NodeJS.Timeout | null = null;
let maxTimer: NodeJS.Timeout | null = null;

function summary(titles: string[]) {
  const names = titles.slice(0, 3);
  const extra = titles.length - names.length;
  return {
    title: titles.length === 1 ? '🆕 Nuevo en Las MoscasStream' : `🆕 ${titles.length} títulos nuevos`,
    body: names.join(', ') + (extra > 0 ? ` y ${extra} más` : ''),
  };
}

async function flush() {
  if (quietTimer) clearTimeout(quietTimer);
  if (maxTimer) clearTimeout(maxTimer);
  quietTimer = maxTimer = null;
  const titles = pending;
  pending = [];
  if (!titles.length) return;
  const { title, body } = summary(titles);
  await sendToAll(title, body).catch((e) => log(`error: ${(e as Error).message}`));
}

/** Avisa de un título nuevo disponible. Se agrupa con los que lleguen en los próximos segundos. */
export function notifyNewTitle(title: string) {
  pending.push(title);
  if (quietTimer) clearTimeout(quietTimer);
  quietTimer = setTimeout(() => void flush(), QUIET_MS);
  if (!maxTimer) maxTimer = setTimeout(() => void flush(), MAX_WAIT_MS);
}
