import type { MediaItem } from '../types';

/** Sin tildes ni signos, en minúsculas: "Él  Padrino!" -> "el padrino". */
export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .trim();
}

export interface SearchIndex {
  /** Palabras de cada título y sus géneros, ya normalizadas (mismo orden que los títulos). */
  tokens: string[][];
}

export function buildSearchIndex(items: MediaItem[]): SearchIndex {
  return {
    tokens: items.map((i) => normalizeText(`${i.title} ${i.genres.join(' ')}`).split(' ').filter(Boolean)),
  };
}

/** Errores permitidos según el largo de la palabra buscada: palabras cortas exactas, largas toleran más. */
const allowedErrors = (len: number) => (len <= 3 ? 0 : len <= 6 ? 1 : 2);

/**
 * Distancia de edición (Damerau/OSA): sustituir, borrar, insertar y cambiar dos letras seguidas cuentan 1.
 * Devuelve k + 1 en cuanto supera el máximo permitido.
 */
function distanceWithin(a: string, b: string, k: number): number {
  if (Math.abs(a.length - b.length) > k) return k + 1;
  const prev2: number[] = [];
  let prev: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur: number[] = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > k) return k + 1;
    prev2.splice(0, prev2.length, ...prev);
    prev = cur;
  }
  return prev[b.length];
}

/** Puntaje de una palabra buscada contra las palabras de un título (0 = no coincide). */
function tokenScore(q: string, tokens: string[]): number {
  const k = allowedErrors(q.length);
  let best = 0;
  for (const t of tokens) {
    let s = 0;
    if (t === q) s = 4;
    else if (t.startsWith(q)) s = 3; // escribiendo todavía: "tita" -> "titanic"
    else if (q.length >= 3 && t.includes(q)) s = 2;
    else if (k > 0) {
      // Con errores: se compara con la palabra completa y con su inicio ("titnaic" ≈ "titanic").
      const d = Math.min(distanceWithin(q, t, k), distanceWithin(q, t.slice(0, q.length), k));
      if (d <= k) s = 2.5 - d * 0.5;
    }
    if (s > best) best = s;
    if (best === 4) break;
  }
  return best;
}

/**
 * Busca tolerando errores de escritura (letras cambiadas, de más o de menos, sin tildes).
 * Todas las palabras escritas deben coincidir con alguna palabra del título o de sus géneros.
 * Devuelve las posiciones de los títulos ordenadas de mejor a peor coincidencia.
 */
export function searchItems(index: SearchIndex, query: string): number[] {
  const words = normalizeText(query).split(' ').filter(Boolean);
  if (!words.length) return [];
  const hits: { i: number; score: number }[] = [];
  for (let i = 0; i < index.tokens.length; i++) {
    let total = 0;
    let ok = true;
    for (const w of words) {
      const s = tokenScore(w, index.tokens[i]);
      if (s === 0) {
        ok = false;
        break;
      }
      total += s;
    }
    if (ok) hits.push({ i, score: total });
  }
  // sort estable: a igual puntaje se conserva el orden original (los más nuevos primero).
  hits.sort((a, b) => b.score - a.score);
  return hits.map((h) => h.i);
}
