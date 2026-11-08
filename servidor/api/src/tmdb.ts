// Autocompletado de títulos desde TMDb (The Movie Database).
// Migrado de peliculas/peli.py: busca, trae los detalles (con la descripción en inglés
// si no hay traducción) y descarga el póster y el fondo. Además de películas, busca series.
import { Router } from 'express';
import { config } from './config.js';
import { pool } from './db.js';

const API = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p';

export type TmdbKind = 'movie' | 'tv';
type MediaType = 'pelicula' | 'serie' | 'anime' | 'novela' | 'documental' | 'reality';

// IDs de géneros de TMDb que usamos para sugerir la categoría.
const GENRE = { animation: 16, documentary: 99, reality: 10764, soap: 10766 };

export class TmdbError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

/** Las rutas de imagen de TMDb son del tipo "/abc123.jpg"; validarlas evita pedir URLs arbitrarias. */
export const isTmdbImagePath = (p: unknown): p is string =>
  typeof p === 'string' && /^\/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$/i.test(p);

// ---------- Límite de peticiones ----------
// TMDb permite 40 peticiones por minuto a su API. Todas las llamadas (panel e importador)
// pasan por esta cola, que deja un margen y espacia las peticiones dentro de la ventana de 60 s.
const RATE_LIMIT = 38;
const WINDOW_MS = 60_000;
const recent: number[] = [];
let queue: Promise<void> = Promise.resolve();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function takeSlot(): Promise<void> {
  const slot = queue.then(async () => {
    for (;;) {
      const now = Date.now();
      while (recent.length && now - recent[0] >= WINDOW_MS) recent.shift();
      if (recent.length < RATE_LIMIT) {
        recent.push(now);
        return;
      }
      await sleep(WINDOW_MS - (now - recent[0]) + 50);
    }
  });
  queue = slot.catch(() => {});
  return slot;
}

async function tmdb<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const token = config.tmdbToken;
  if (!token) throw new TmdbError('Falta TMDB_TOKEN en el .env del servidor', 503);

  const url = new URL(API + path);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
  const headers: Record<string, string> = { accept: 'application/json' };
  // Token v4 (JWT) va en la cabecera; una API key v3 va como parámetro.
  if (token.startsWith('eyJ')) headers.Authorization = `Bearer ${token}`;
  else url.searchParams.set('api_key', token);

  for (let attempt = 1; ; attempt++) {
    await takeSlot();
    let res: Response;
    try {
      res = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
    } catch {
      throw new TmdbError('No se pudo conectar con TMDb. ¿El PC tiene internet?');
    }
    // Si aun así TMDb frena (429), se espera lo que indique y se reintenta (hasta 3 veces).
    if (res.status === 429 && attempt <= 3) {
      const wait = Number(res.headers.get('retry-after')) || 10;
      await sleep(wait * 1000);
      continue;
    }
    if (res.status === 401) throw new TmdbError('El token de TMDb es inválido o caducó (401)');
    if (res.status === 404) throw new TmdbError('No existe en TMDb', 404);
    if (res.status === 429) throw new TmdbError('TMDb está limitando las peticiones, espera unos segundos', 429);
    if (!res.ok) throw new TmdbError(`TMDb respondió ${res.status}`);
    return (await res.json()) as T;
  }
}

interface SearchResult {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  release_date?: string;
  first_air_date?: string;
  overview?: string;
  poster_path?: string | null;
  vote_average?: number;
  popularity?: number;
  genre_ids?: number[];
  origin_country?: string[];
  original_language?: string;
}

function suggestType(kind: TmdbKind, genreIds: number[], originalLanguage?: string, countries: string[] = []): MediaType {
  const has = (g: number) => genreIds.includes(g);
  const japanese = originalLanguage === 'ja' || countries.includes('JP');
  if (has(GENRE.documentary)) return 'documental';
  if (has(GENRE.animation) && japanese) return 'anime';
  if (kind === 'movie') return 'pelicula';
  if (has(GENRE.reality)) return 'reality';
  if (has(GENRE.soap)) return 'novela';
  return 'serie';
}

const yearOf = (date?: string) => (date && /^\d{4}/.test(date) ? Number(date.slice(0, 4)) : undefined);
const round1 = (n?: number) => Math.round((n ?? 0) * 10) / 10;

/** Busca a la vez películas y series y devuelve las coincidencias ordenadas por popularidad. */
export async function search(query: string, opts: { year?: number; language?: string } = {}) {
  const [movies, shows] = await Promise.all([searchKind('movie', query, opts), searchKind('tv', query, opts)]);
  return [...movies, ...shows].sort((a, b) => b.popularity - a.popularity).slice(0, 20);
}

/** Busca solo películas o solo series (lo usa también el importador de listados). */
export async function searchKind(kind: TmdbKind, query: string, opts: { year?: number; language?: string } = {}) {
  const language = opts.language || config.tmdbLanguage;
  const params =
    kind === 'movie'
      ? { query, language, include_adult: 'false', year: opts.year }
      : { query, language, include_adult: 'false', first_air_date_year: opts.year };
  const { results } = await tmdb<{ results: SearchResult[] }>(`/search/${kind}`, params);
  return results.map((r) => ({
    kind,
    id: r.id,
    ref: `${kind}:${r.id}`,
    title: (kind === 'movie' ? r.title : r.name) ?? '',
    originalTitle: (kind === 'movie' ? r.original_title : r.original_name) ?? '',
    year: yearOf(kind === 'movie' ? r.release_date : r.first_air_date),
    rating: round1(r.vote_average),
    overview: r.overview ?? '',
    posterPreview: r.poster_path ? `${IMG}/w185${r.poster_path}` : null,
    suggestedType: suggestType(kind, r.genre_ids ?? [], r.original_language, r.origin_country),
    popularity: r.popularity ?? 0,
  }));
}

interface Details {
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  release_date?: string;
  first_air_date?: string;
  overview?: string;
  vote_average?: number;
  vote_count?: number;
  genres?: { id: number; name: string }[];
  poster_path?: string | null;
  backdrop_path?: string | null;
  imdb_id?: string | null;
  number_of_episodes?: number;
  number_of_seasons?: number;
  original_language?: string;
  origin_country?: string[];
  external_ids?: { imdb_id?: string | null };
}

/** Datos completos listos para rellenar el formulario del panel. */
export async function details(kind: TmdbKind, id: number, language = config.tmdbLanguage) {
  const extra = kind === 'tv' ? { append_to_response: 'external_ids' } : {};
  const d = await tmdb<Details>(`/${kind}/${id}`, { language, ...extra });

  // Igual que el script: si no hay descripción en el idioma pedido, se usa la de inglés.
  let synopsis = d.overview?.trim() ?? '';
  let synopsisLanguage = language;
  if (!synopsis && !language.startsWith('en')) {
    const en = await tmdb<Details>(`/${kind}/${id}`, { language: 'en-US' });
    synopsis = en.overview?.trim() ?? '';
    synopsisLanguage = 'en-US';
  }

  const imdb = kind === 'movie' ? d.imdb_id : d.external_ids?.imdb_id;
  const genreIds = (d.genres ?? []).map((g) => g.id);
  return {
    kind,
    id,
    ref: `${kind}:${id}`,
    title: (kind === 'movie' ? d.title : d.name) ?? '',
    originalTitle: (kind === 'movie' ? d.original_title : d.original_name) ?? '',
    year: yearOf(kind === 'movie' ? d.release_date : d.first_air_date),
    rating: round1(d.vote_average),
    votes: d.vote_count ?? 0,
    synopsis,
    synopsisLanguage,
    genres: (d.genres ?? []).map((g) => g.name),
    episodes: kind === 'tv' ? d.number_of_episodes ?? undefined : undefined,
    seasons: kind === 'tv' ? d.number_of_seasons ?? undefined : undefined,
    suggestedType: suggestType(kind, genreIds, d.original_language, d.origin_country),
    posterPath: d.poster_path ?? null,
    backdropPath: d.backdrop_path ?? null,
    posterPreview: d.poster_path ? `${IMG}/w342${d.poster_path}` : null,
    backdropPreview: d.backdrop_path ? `${IMG}/w780${d.backdrop_path}` : null,
    imdbUrl: imdb ? `https://www.imdb.com/title/${imdb}` : null,
  };
}

/**
 * Descarga una imagen de TMDb para guardarla en el servidor. Se pide un tamaño ya
 * cercano al final (w780 póster / w1280 fondo) en vez de "original", que puede pesar varios MB.
 */
export async function downloadImage(imagePath: string, kind: 'poster' | 'backdrop'): Promise<Buffer> {
  if (!isTmdbImagePath(imagePath)) throw new TmdbError('Ruta de imagen de TMDb no válida', 400);
  const size = kind === 'poster' ? 'w780' : 'w1280';
  let res: Response;
  try {
    res = await fetch(`${IMG}/${size}${imagePath}`, { signal: AbortSignal.timeout(30_000) });
  } catch {
    throw new TmdbError('No se pudo descargar la imagen de TMDb');
  }
  if (!res.ok) throw new TmdbError(`No se pudo descargar la imagen de TMDb (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

// ---------- Rutas (montadas en /api/admin/tmdb, requieren login) ----------

export const tmdbRouter = Router();

/** Idioma tipo "es-ES", "es-MX", "en-US"; cualquier otra cosa usa el idioma por defecto. */
const languageParam = (v: unknown) => (typeof v === 'string' && /^[a-z]{2}(-[A-Z]{2})?$/.test(v) ? v : undefined);

tmdbRouter.get('/status', (_req, res) => {
  res.json({ enabled: Boolean(config.tmdbToken), language: config.tmdbLanguage });
});

tmdbRouter.get('/search', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (q.length < 2) {
    res.status(400).json({ error: 'Escribe al menos 2 letras para buscar' });
    return;
  }
  const year = Number(req.query.year);
  const language = languageParam(req.query.language);
  const results = await search(q.slice(0, 100), { year: year >= 1888 && year <= 2100 ? year : undefined, language });
  // Marca los que ya están en el catálogo para no duplicarlos.
  const { rows } = await pool.query<{ tmdb_ref: string; id: string }>(
    'SELECT tmdb_ref, id FROM media WHERE tmdb_ref = ANY($1)',
    [results.map((r) => r.ref)],
  );
  const existing = new Map(rows.map((r) => [r.tmdb_ref, r.id]));
  res.json(results.map((r) => ({ ...r, existingId: existing.get(r.ref) ?? null })));
});

tmdbRouter.get('/:kind/:id', async (req, res) => {
  const kind = req.params.kind;
  const id = Number(req.params.id);
  if ((kind !== 'movie' && kind !== 'tv') || !Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'Referencia de TMDb no válida' });
    return;
  }
  res.json(await details(kind, id, languageParam(req.query.language)));
});
