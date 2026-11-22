// Relleno masivo de duración y tráiler para los títulos que ya estaban en el catálogo.
//
// Cómo funciona (sin tocar toda la base de golpe):
//  - Recorre en segundo plano los títulos con extras_at vacío, de los más nuevos a los más viejos.
//  - Cada título es UNA petición a TMDb (con tmdb_ref) o una búsqueda (sin tmdb_ref, solo si el parecido es alto).
//    TMDb permite ~40 por minuto: ~3000 títulos tardan ~1 h 15 min. La cola global de tmdb.ts respeta el límite.
//  - Cada título se marca con extras_at al terminar (con o sin datos), así que se puede cortar y continúa
//    en el próximo arranque sin repetir nada.
//  - Cada título actualizado recibe una versión nueva (updated_at): las apps lo reciben en su siguiente
//    sincronización incremental, sin descargar todo el catálogo.
import { pool, touchCatalog } from '../db.js';
import { config } from '../config.js';
import { extras, TmdbError } from '../tmdb.js';
import { findMatch } from './importador.js';
import { isMovieType, type ParsedTitle } from './parser.js';

const log = (msg: string) => console.log(`[relleno] ${msg}`);

let running = false;

export async function backfillStatus() {
  const { rows } = await pool.query<{ pending: string; total: string }>(
    'SELECT count(*) FILTER (WHERE extras_at IS NULL) AS pending, count(*) AS total FROM media',
  );
  return { running, pending: Number(rows[0].pending), total: Number(rows[0].total) };
}

interface Row {
  id: string;
  title: string;
  type: string;
  year: number | null;
  tmdb_ref: string | null;
}

async function resolveRef(r: Row): Promise<string | null> {
  if (r.tmdb_ref) return r.tmdb_ref;
  const movie = isMovieType(r.type as ParsedTitle['type']);
  const item: ParsedTitle = {
    section: '',
    raw: r.title,
    title: r.title,
    year: movie ? r.year ?? undefined : undefined,
    type: r.type as ParsedTitle['type'],
    kind: movie ? 'movie' : 'tv',
    key: '',
  };
  // Sin referencia previa se exige un parecido alto para no poner el tráiler de otro título.
  const match = await findMatch(item, 0.85);
  return match?.ref ?? null;
}

export async function runBackfill(): Promise<void> {
  if (running) return;
  if (!config.tmdbToken) {
    log('falta TMDB_TOKEN: no se rellenan duración ni tráiler');
    return;
  }
  running = true;
  let done = 0;
  let withData = 0;
  try {
    for (;;) {
      const { rows } = await pool.query<Row>(
        `SELECT id, title, type, year, tmdb_ref FROM media WHERE extras_at IS NULL ORDER BY added_at DESC, id LIMIT 40`,
      );
      if (!rows.length) break;
      for (const r of rows) {
        try {
          const ref = await resolveRef(r);
          const [kind, rawId] = (ref ?? '').split(':');
          const data = ref && (kind === 'movie' || kind === 'tv') ? await extras(kind, Number(rawId)) : null;
          await pool.query(
            `UPDATE media SET runtime = COALESCE($2, runtime), trailer_url = COALESCE($3, trailer_url),
                    tmdb_ref = COALESCE(tmdb_ref, $4), extras_at = now(), updated_at = now()
             WHERE id = $1`,
            [r.id, data?.runtime ?? null, data?.trailerUrl ?? null, data ? ref : null],
          );
          if (data && (data.runtime || data.trailerUrl)) withData++;
        } catch (e) {
          // Sin internet, token inválido o TMDb caído: se corta y continúa en el próximo arranque.
          if (e instanceof TmdbError || (e as Error).name === 'TypeError') {
            log(`pausado: ${(e as Error).message}. Continuará en el próximo arranque.`);
            await touchCatalog();
            return;
          }
          throw e;
        }
        done++;
      }
      await touchCatalog();
      log(`${done} títulos revisados (${withData} con datos)`);
    }
    if (done) log(`terminado: ${done} títulos revisados, ${withData} con duración o tráiler`);
  } catch (e) {
    log(`error inesperado: ${(e as Error).message}`);
  } finally {
    running = false;
  }
}
