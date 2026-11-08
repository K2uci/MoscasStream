// Importación automática de listados: al arrancar el servidor se leen los .txt de la carpeta
// "importacion"; cada audiovisual que aún no esté en la app se busca en TMDb y se agrega
// con sus datos e imágenes. Los que TMDb no encuentra NO se agregan: se anotan en
// "no-encontrados.log". Cuando un .txt se termina de procesar, se borra.
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { pool, touchCatalog } from '../db.js';
import { deleteImage, saveImage } from '../images.js';
import { details, downloadImage, searchKind, TmdbError } from '../tmdb.js';
import { normalize, parseListing, type MediaType, type ParsedTitle } from './parser.js';

const log = (msg: string) => console.log(`[importación] ${msg}`);

/** Error que obliga a parar (sin internet, token inválido, TMDb caído): se reintenta en el próximo arranque. */
class ImportPaused extends Error {}

// ---------- Coincidencias ----------

/** Parecido entre dos títulos de 0 a 1 (palabras en común, ignorando tildes y signos). */
function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ta = new Set(na.split(' '));
  const tb = new Set(nb.split(' '));
  const common = [...ta].filter((w) => tb.has(w)).length;
  const score = common / Math.max(ta.size, tb.size);
  // "Click Perdiendo El Control" vs "Click": un título contiene al otro.
  const contains = na.startsWith(nb + ' ') || nb.startsWith(na + ' ');
  return contains ? Math.max(score, 0.8) : score;
}

/** Variantes de búsqueda: título, título alternativo, partes separadas por " - ", sin número inicial... */
function queriesFor(item: ParsedTitle): string[] {
  const t = item.title;
  const out = [t];
  if (item.alt) out.push(item.alt);
  const parts = t.split(/\s+[-–]\s+/);
  if (parts.length > 1) out.push(parts[0], parts[parts.length - 1]);
  if (/^\d{1,2}\s+\D/.test(t)) out.push(t.replace(/^\d{1,2}\s+/, '')); // "1 Vampiros En La Habana"
  if (item.kind === 'tv' && /\s\d{1,2}$/.test(t)) out.push(t.replace(/\s\d{1,2}$/, '')); // "Zootopia 1"
  const seen = new Set<string>();
  return out.filter((q) => {
    const k = normalize(q);
    if (k.length < 2 || seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 3); // cada búsqueda gasta peticiones del límite de TMDb
}

type Candidate = Awaited<ReturnType<typeof searchKind>>[number];

async function findMatch(item: ParsedTitle): Promise<Candidate | null> {
  let best: { c: Candidate; score: number } | null = null;
  for (const q of queriesFor(item)) {
    let results = await searchKind(item.kind, q, { year: item.year });
    if (results.length === 0 && item.year) results = await searchKind(item.kind, q);
    for (const c of results.slice(0, 10)) {
      let score = Math.max(similarity(q, c.title), similarity(q, c.originalTitle), similarity(item.title, c.title), similarity(item.title, c.originalTitle));
      if (item.year && c.year) {
        const diff = Math.abs(item.year - c.year);
        score += diff === 0 ? 0.2 : diff === 1 ? 0.1 : -0.3;
      }
      score += Math.min(c.popularity, 50) / 1000; // desempate: el más conocido
      if (!best || score > best.score) best = { c, score };
    }
    if (best && best.score >= 0.85) break; // coincidencia clara: no hace falta probar más variantes
  }
  return best && best.score >= 0.6 ? best.c : null;
}

/** Tipo final: el de la sección del listado, afinado con lo que sugiere TMDb (anime, documental, reality...). */
function finalType(listType: MediaType, suggested: MediaType): MediaType {
  if (listType === 'novela') return 'novela';
  if (listType === 'pelicula') return suggested === 'documental' || suggested === 'anime' ? suggested : 'pelicula';
  return suggested === 'pelicula' ? 'serie' : suggested;
}

async function tryImage(p: string | null, kind: 'poster' | 'backdrop'): Promise<string | null> {
  if (!p) return null;
  try {
    return await saveImage(await downloadImage(p, kind), kind);
  } catch {
    return null; // sin imagen el título se agrega igual; se puede completar en el panel
  }
}

// ---------- Proceso ----------

interface Known {
  importKeys: Set<string>;
  tmdbRefs: Set<string>;
  titles: Set<string>;
}

async function loadKnown(): Promise<Known> {
  const { rows } = await pool.query<{ title: string; type: string; year: number | null; tmdb_ref: string | null; import_key: string | null }>(
    'SELECT title, type, year, tmdb_ref, import_key FROM media',
  );
  const known: Known = { importKeys: new Set(), tmdbRefs: new Set(), titles: new Set() };
  for (const r of rows) {
    if (r.import_key) known.importKeys.add(r.import_key);
    if (r.tmdb_ref) known.tmdbRefs.add(r.tmdb_ref);
    const kind = r.type === 'pelicula' || r.type === 'documental' ? 'movie' : 'tv';
    known.titles.add(`${kind}:${normalize(r.title)}`);
    if (r.year) known.titles.add(`${kind}:${normalize(r.title)}:${r.year}`);
  }
  return known;
}

const isKnown = (k: Known, item: ParsedTitle) =>
  k.importKeys.has(item.key) || k.titles.has(item.key) || (!item.year && k.titles.has(`${item.kind}:${normalize(item.title)}`));

/** Procesa un título. Devuelve 'added' | 'exists' | 'not_found'. */
async function importOne(item: ParsedTitle, known: Known): Promise<'added' | 'exists' | 'not_found'> {
  if (isKnown(known, item)) return 'exists';

  let match: Candidate | null;
  let d: Awaited<ReturnType<typeof details>>;
  try {
    match = await findMatch(item);
    if (!match) return 'not_found';
    if (known.tmdbRefs.has(match.ref)) return 'exists';
    d = await details(match.kind, match.id);
  } catch (e) {
    if (e instanceof TmdbError && e.status === 404) return 'not_found';
    if (e instanceof TmdbError) throw new ImportPaused(e.message);
    throw e;
  }

  const [poster, backdrop] = await Promise.all([tryImage(d.posterPath, 'poster'), tryImage(d.backdropPath, 'backdrop')]);
  try {
    await pool.query(
      `INSERT INTO media (title, type, rating, synopsis, year, genres, episodes, seasons, available,
                          poster_path, backdrop_path, tmdb_ref, import_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE,$9,$10,$11,$12)`,
      [d.title || item.title, finalType(item.type, d.suggestedType), d.rating, d.synopsis, d.year ?? item.year ?? null,
       d.genres.slice(0, 15), d.episodes ?? null, d.seasons ?? null, poster, backdrop, d.ref, item.key],
    );
  } catch (e) {
    await Promise.all([deleteImage(poster), deleteImage(backdrop)]);
    throw e;
  }
  known.importKeys.add(item.key);
  known.tmdbRefs.add(d.ref);
  known.titles.add(`${match.kind}:${normalize(d.title)}`);
  return 'added';
}

async function appendNotFound(file: string, items: ParsedTitle[]) {
  if (!items.length) return;
  const stamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
  const lines = [`# ${stamp} - ${file} - ${items.length} no encontrados en TMDb (no se agregaron)`];
  for (const i of items) lines.push(`${i.section} | ${i.raw}`);
  await fs.appendFile(path.join(config.importDir, 'no-encontrados.log'), lines.join('\n') + '\n\n', 'utf8');
}

let running = false;

/** Procesa todos los .txt de la carpeta de importación. Se llama al arrancar el servidor. */
export async function runImport(): Promise<void> {
  if (running) return;
  running = true;
  try {
    await fs.mkdir(config.importDir, { recursive: true });
    const files = (await fs.readdir(config.importDir)).filter((f) => f.toLowerCase().endsWith('.txt')).sort();
    if (!files.length) {
      log('no hay listados pendientes');
      return;
    }
    if (!config.tmdbToken) {
      log(`hay ${files.length} listado(s), pero falta TMDB_TOKEN en el .env: no se importa nada`);
      return;
    }

    const known = await loadKnown();
    for (const file of files) {
      const full = path.join(config.importDir, file);
      const items = parseListing(await fs.readFile(full, 'utf8'));
      log(`${file}: ${items.length} títulos en el listado`);

      const count = { added: 0, exists: 0, not_found: 0 };
      const notFound: ParsedTitle[] = [];
      for (const [n, item] of items.entries()) {
        let result: 'added' | 'exists' | 'not_found';
        try {
          result = await importOne(item, known);
        } catch (e) {
          if (e instanceof ImportPaused) {
            await touchCatalog();
            log(`pausado: ${e.message}. Se continuará en el próximo arranque (${file} se conserva).`);
            return;
          }
          log(`error con «${item.raw}»: ${(e as Error).message}`);
          result = 'not_found';
        }
        count[result]++;
        if (result === 'not_found') notFound.push(item);
        if (result === 'added' && count.added % 20 === 0) await touchCatalog(); // la app ve el avance
        if ((n + 1) % 100 === 0) {
          log(`${file}: ${n + 1}/${items.length} · ${count.added} agregados, ${count.exists} ya estaban, ${count.not_found} no encontrados`);
        }
      }

      await touchCatalog();
      await appendNotFound(file, notFound);
      await fs.rm(full, { force: true });
      log(
        `${file} terminado: ${count.added} agregados, ${count.exists} ya estaban, ${count.not_found} no encontrados` +
          `${count.not_found ? ' (ver no-encontrados.log)' : ''}. Archivo borrado.`,
      );
    }
  } catch (e) {
    log(`error inesperado: ${(e as Error).message}`);
  } finally {
    running = false;
  }
}
