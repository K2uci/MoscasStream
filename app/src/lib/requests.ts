import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MediaType } from '../types';

const K_DEVICE = 'moscas:deviceId';
const K_QUEUE = 'moscas:requestQueue';
const K_NAME = 'moscas:requesterName';

export interface NewRequest {
  title: string;
  type?: MediaType;
  note?: string;
  requester?: string;
}

export type SendResult =
  | { kind: 'sent' }
  | { kind: 'exists' } // ya está en el catálogo
  | { kind: 'duplicate' } // ya lo habías pedido
  | { kind: 'queued' } // sin conexión: se envía solo cuando haya
  | { kind: 'error'; message: string };

export interface MyRequest {
  id: string;
  title: string;
  status: 'pendiente' | 'agregado' | 'descartado';
  createdAt: string;
}

/** Identificador anónimo de este teléfono (para ver el estado de sus pedidos y limitar abusos). */
export async function getDeviceId(): Promise<string> {
  try {
    const saved = await AsyncStorage.getItem(K_DEVICE);
    if (saved) return saved;
  } catch {}
  const id = `d-${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;
  await AsyncStorage.setItem(K_DEVICE, id).catch(() => {});
  return id;
}

export const loadRequesterName = () => AsyncStorage.getItem(K_NAME).then((v) => v ?? '', () => '');
export const saveRequesterName = (name: string) => AsyncStorage.setItem(K_NAME, name).catch(() => {});

async function post(serverUrl: string, req: NewRequest, deviceId: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    return await fetch(`${serverUrl}/api/requests`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ ...req, deviceId }),
    });
  } finally {
    clearTimeout(timer);
  }
}

async function readQueue(): Promise<NewRequest[]> {
  try {
    const raw = await AsyncStorage.getItem(K_QUEUE);
    return raw ? (JSON.parse(raw) as NewRequest[]) : [];
  } catch {
    return [];
  }
}

const writeQueue = (q: NewRequest[]) => AsyncStorage.setItem(K_QUEUE, JSON.stringify(q.slice(0, 20))).catch(() => {});

/** Envía un pedido. Sin conexión queda guardado en el teléfono y se envía solo cuando haya internet. */
export async function sendRequest(serverUrl: string, req: NewRequest): Promise<SendResult> {
  const deviceId = await getDeviceId();
  if (!serverUrl) {
    await writeQueue([...(await readQueue()), req]);
    return { kind: 'queued' };
  }
  try {
    const res = await post(serverUrl, req, deviceId);
    const body = (await res.json().catch(() => ({}))) as { exists?: boolean; duplicate?: boolean; error?: string };
    if (res.ok) return body.exists ? { kind: 'exists' } : body.duplicate ? { kind: 'duplicate' } : { kind: 'sent' };
    if (res.status >= 500) throw new TypeError('servidor no disponible');
    return { kind: 'error', message: body.error ?? `Error ${res.status}` };
  } catch {
    await writeQueue([...(await readQueue()), req]);
    return { kind: 'queued' };
  }
}

/** Envía los pedidos guardados sin conexión. Se llama cuando la sincronización con el servidor funciona. */
export async function flushRequestQueue(serverUrl: string): Promise<void> {
  const queue = await readQueue();
  if (!queue.length || !serverUrl) return;
  const deviceId = await getDeviceId();
  const left: NewRequest[] = [];
  for (const req of queue) {
    try {
      const res = await post(serverUrl, req, deviceId);
      if (res.status >= 500 || res.status === 429) left.push(req); // se reintenta más tarde
    } catch {
      left.push(req);
    }
  }
  await writeQueue(left);
}

export async function queuedRequests(): Promise<NewRequest[]> {
  return readQueue();
}

/** Estado de los pedidos de este teléfono (necesita conexión; sin ella devuelve lista vacía). */
export async function fetchMyRequests(serverUrl: string): Promise<MyRequest[]> {
  if (!serverUrl) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${serverUrl}/api/requests/mine?deviceId=${encodeURIComponent(await getDeviceId())}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    return res.ok ? ((await res.json()) as MyRequest[]) : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
