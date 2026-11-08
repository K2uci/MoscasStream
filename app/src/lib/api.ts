import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Catalog, MediaItem } from '../types';

const KEY_SERVER = 'moscas:serverUrl'; // clave antigua (dirección única)
const KEY_SERVERS = 'moscas:servers';

export type ServerKind = 'local' | 'internet';

export interface ServerConfig {
  local: string;
  internet: string;
}

/**
 * Normaliza lo que escribe el usuario: quita espacios y la "/" final, y añade el esquema si falta
 * (Local -> http://, Internet -> https://).
 */
export function normalizeServerUrl(input: string, kind: ServerKind = 'local'): string {
  const url = input.trim().replace(/\/+$/, '');
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `${kind === 'internet' ? 'https' : 'http'}://${url}`;
}

/** Las imágenes vienen como ruta relativa del servidor ("/uploads/x.webp"). */
export function resolveImageUrl(url: string | undefined, serverUrl: string): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url;
  if (!serverUrl) return undefined;
  return `${serverUrl}${url.startsWith('/') ? '' : '/'}${url}`;
}

/**
 * Fuente para expo-image. El `cacheKey` es la ruta relativa: la imagen se guarda una sola vez
 * aunque se descargue por la IP local o por internet.
 */
export function imageSource(url: string | undefined, serverUrl: string): { uri: string; cacheKey?: string } | undefined {
  const uri = resolveImageUrl(url, serverUrl);
  if (!uri || !url) return undefined;
  return url.startsWith('/') ? { uri, cacheKey: url } : { uri };
}

/** ¿Responde el servidor? (GET /api/health con timeout corto). Nunca lanza. */
export async function checkHealth(serverUrl: string, timeoutMs: number): Promise<boolean> {
  if (!serverUrl) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${serverUrl}/api/health`, { signal: controller.signal, headers: { Accept: 'application/json' } });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export const LOCAL_TIMEOUT_MS = 2000;
export const INTERNET_TIMEOUT_MS = 6000;

/** Elige el servidor que responde: primero Local (2 s) y luego Internet (6 s). */
export async function pickServer(servers: ServerConfig): Promise<{ url: string; kind: ServerKind } | null> {
  if (servers.local && (await checkHealth(servers.local, LOCAL_TIMEOUT_MS))) return { url: servers.local, kind: 'local' };
  if (servers.internet && (await checkHealth(servers.internet, INTERNET_TIMEOUT_MS)))
    return { url: servers.internet, kind: 'internet' };
  return null;
}

export type FetchResult = { notModified: true } | { notModified: false; catalog: Catalog; etag: string | null };

/**
 * Descarga el catálogo. Con `etag`, el servidor responde 304 si nada cambió
 * y no se vuelve a transferir ni procesar la lista completa.
 */
export async function fetchCatalog(serverUrl: string, etag?: string | null, timeoutMs = 15000): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (etag) headers['If-None-Match'] = etag;
    const res = await fetch(`${serverUrl}/api/catalog`, { signal: controller.signal, headers });
    if (res.status === 304) return { notModified: true };
    if (!res.ok) throw new Error(`El servidor respondió ${res.status}`);
    return { notModified: false, catalog: parseCatalog(await res.json()), etag: res.headers.get('etag') };
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw new Error('El servidor no respondió a tiempo');
    if (e instanceof TypeError) throw new Error('No se pudo conectar con el servidor');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function parseCatalog(data: unknown): Catalog {
  const obj = data as Partial<Catalog> | MediaItem[];
  const items = Array.isArray(obj) ? obj : obj?.items;
  if (!Array.isArray(items)) throw new Error('Respuesta inválida del servidor');
  return {
    updatedAt: (!Array.isArray(obj) && obj.updatedAt) || new Date().toISOString(),
    items: items
      .filter((i) => i && i.id && i.title)
      .map((i) => ({
        id: String(i.id),
        title: i.title,
        type: i.type,
        posterUrl: i.posterUrl,
        thumbUrl: i.thumbUrl,
        backdropUrl: i.backdropUrl,
        rating: Number(i.rating) || 0,
        synopsis: i.synopsis ?? '',
        year: i.year,
        genres: Array.isArray(i.genres) ? i.genres : [],
        episodes: i.episodes,
        seasons: i.seasons,
        available: i.available !== false,
        addedAt: i.addedAt ?? new Date(0).toISOString(),
      })),
  };
}

/** Lee las dos direcciones. Migración: la dirección única de versiones anteriores pasa a ser la Local. */
export async function loadServers(): Promise<ServerConfig> {
  try {
    const raw = await AsyncStorage.getItem(KEY_SERVERS);
    if (raw) {
      const o = JSON.parse(raw) as Partial<ServerConfig>;
      return { local: o.local ?? '', internet: o.internet ?? '' };
    }
    const legacy = await AsyncStorage.getItem(KEY_SERVER);
    return { local: legacy ?? '', internet: '' };
  } catch {
    return { local: '', internet: '' };
  }
}

export async function saveServers(servers: ServerConfig): Promise<void> {
  await AsyncStorage.setItem(KEY_SERVERS, JSON.stringify(servers));
  await AsyncStorage.removeItem(KEY_SERVER).catch(() => {});
}

/** Limpia claves de versiones anteriores (el catálogo ahora vive en un archivo, no en AsyncStorage). */
export async function removeLegacyKeys(): Promise<void> {
  await AsyncStorage.multiRemove(['moscas:catalog', 'moscas:demo']).catch(() => {});
}
