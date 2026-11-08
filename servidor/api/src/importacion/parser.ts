// Lee los listados de discos (como "Disco I.txt") y los convierte en títulos limpios para importar.
// Formato del listado: secciones "[PELICULAS/...]" dentro de bloques cat << 'EOF' ... EOF,
// y una línea por audiovisual con ruido como "[1080p] [Dual Audio] [2,26 Gb]".

export type MediaType = 'pelicula' | 'serie' | 'anime' | 'novela' | 'documental' | 'reality';
export type TmdbKind = 'movie' | 'tv';

export interface ParsedTitle {
  section: string;
  raw: string;
  title: string;
  year?: number;
  /** Título alternativo que venía entre paréntesis, p. ej. "12 Desafíos"; se usa si la búsqueda principal falla. */
  alt?: string;
  type: MediaType;
  kind: TmdbKind;
  /** Clave para no repetir: tipo + título normalizado (+ año en películas). */
  key: string;
}

/** Quita tildes, signos y mayúsculas: "Más Vampiros En La Habana" -> "mas vampiros en la habana". */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' y ')
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .trim();
}

/** Qué tipo de audiovisual hay en cada sección. null = sección que no se importa. */
function sectionType(section: string): MediaType | null {
  const s = normalize(section);
  if (s.includes('xxx') || s.includes('excluid')) return null;
  if (s.includes('novela')) return 'novela';
  if (s.includes('serie')) return 'serie';
  return 'pelicula';
}

// Marcas de calidad, idioma, etc. que no forman parte del título.
const NOISE_WORDS =
  /\b(1080p|720p|480p|2160p|4k|hd|fhd|dual audio|dual|latin audio|latino|lat|castellano|subtitulad[oa]|completa|portada|ok|fdt|xxx)\b/gi;

const YEAR = /(?:\[|\(|\b)((?:19|20)\d{2})(?:\]|\)|\b)/;

function cleanAlt(raw: string | undefined, title: string): string | undefined {
  if (!raw) return undefined;
  const alt = raw.trim();
  if (/^\d{4}$/.test(alt) || alt.includes(',')) return undefined; // año o lista de actores
  if (/\d+\s*-\s*\d+|season|temp|cap|niños|droga|telemundo/i.test(alt)) return undefined;
  if (normalize(alt) === normalize(title) || normalize(alt).length < 3) return undefined;
  return alt;
}

function cleanTitle(line: string, type: MediaType): { title: string; year?: number; alt?: string } | null {
  let s = line.trim();
  if (!s || /carpeta (vac[ií]a|sin contenido)|nueva carpeta/i.test(s)) return null;

  // "[ Tiburones ] Jaws (1975)", "[Cuba] ...", "[España] ..." -> prefijo de categoría fuera.
  s = s.replace(/^\[[^\]]*\]\s*/, '');
  // "Adam Sandler/Click [2006]", "Pelicula/Silencio" -> lo que va después de la última "/".
  if (s.includes('/')) s = s.slice(s.lastIndexOf('/') + 1);
  s = s.replace(/_/g, ' ');

  const yearMatch = s.match(YEAR);
  let year = yearMatch ? Number(yearMatch[1]) : undefined;
  const altRaw = s.match(/\(([^()]{3,60})\)/)?.[1];

  // Series: "Bandidos [Temp-2] [2025] [Caps.07]", "Gravity Falls T01 (20-20) ...", "Ben 10 (Season 1)",
  // "El Barco Temp[1]", "The Boys 3T", "Corazones Blindados 122 cap".
  if (type !== 'pelicula') {
    s = s
      .replace(/\s*[-_]?\s*[[(]?\s*(temp(orada)?|season)\s*[-.[]?\s*\d+.*$/i, '')
      .replace(/\s+T\d{1,2}\b.*$/i, '')
      .replace(/\s+\d{1,2}T$/i, '')
      .replace(/\s+\[S\d+\].*$/i, '')
      .replace(/\s+\d+\s*TEMP\b.*$/i, '')
      .replace(/\s+\d+\s*caps?\.?$/i, '')
      // "AVATAR ... LIBRO 2", "Looney Ton 1 1", "Los Simpsons 0" (numeración de temporada/volumen).
      .replace(/\s+libro\s+\d+.*$/i, '')
      .replace(/(\s+\d+){2,}\s*$/, '')
      .replace(/\s+0\s*$/, '');
  }
  // "°Shazam!" (en el listado "¡" aparece como "°") y "Hellboy -3- 2019]".
  s = s.replace(/°/g, '').replace(/\s-(\d)-\s/g, ' $1 ');
  // "Sonic-Prime-Temporada-1-Completa-2022-HD" (todo con guiones) -> espacios.
  if (!s.includes(' ') && s.includes('-')) s = s.replace(/-/g, ' ').replace(/\s+temporada.*$/i, '');

  // Lo primero entre corchetes/paréntesis suele ser año, calidad, actores o título alternativo.
  s = s.replace(/\s*[[(].*$/, '');
  // Numeración de sagas: "01 - 365 DNI", "33- Deadpool". Con "1.Vampiros" o "2.Guns" no se sabe
  // si el número es parte del título: se deja y el importador reintenta sin él si no encuentra nada.
  s = s.replace(/^\d{1,3}\s*-\s+/, '').replace(/^\d{1,2}\s*-(?=\S)/, '');
  // "10000.BC", "2.Guns", "6.Bullets": puntos usados como espacios.
  s = s.replace(/(?<=\w)\.(?=\w)/g, ' ');
  // Coletillas: "1408 - terror", "3 Dias Para Matar - Acción", "La Casa Vacia. Cortometraje.", "... - Fin".
  s = s.replace(/\s+-\s+[\p{L}]+\s*$/u, '').replace(/[.\s]+(cortometraje|teleplay|cubanas?)\.?\s*$/i, '');
  s = s.replace(/^(serie|teleplay|teleserie)\s*-\s*/i, '');
  s = s.replace(NOISE_WORDS, ' ').replace(/[[\]]/g, ' ').replace(/[\s.-]+$/, '').replace(/\s+/g, ' ').trim();
  // Año pegado al final como palabra suelta ("Doña bella 2026").
  if (year) s = s.replace(new RegExp(`\\s+${year}$`), '').trim();

  if (normalize(s).length < 2) return null;
  // "2012 - Catástrofe": el número es el título, no el año.
  if (year && normalize(s) === String(year)) year = undefined;
  return { title: s, year, alt: cleanAlt(altRaw, s) };
}

export function parseListing(text: string): ParsedTitle[] {
  const out: ParsedTitle[] = [];
  const seen = new Set<string>();
  let section: string | null = null;
  let type: MediaType | null = null;

  for (const rawLine of text.replace(/\r/g, '').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('cat <<') || line === 'EOF' || line.startsWith('echo')) continue;

    const header = line.match(/^\[([A-ZÁÉÍÓÚÑ][^\]]*)\]$/);
    if (header && header[1] === header[1].toUpperCase()) {
      section = header[1].trim();
      type = sectionType(section);
      continue;
    }
    if (!section || !type) continue;

    // "Vol 21. Barrio Cuba. La vida es silbar. ..." = recopilación: una entrada por película.
    const vol = line.match(/^Vol\s*\d+\.\s*(.+)$/i);
    const parts = vol ? vol[1].split(/\.\s+/) : [line];
    for (const part of parts) {
      const cleaned = cleanTitle(part, type);
      if (cleaned) push(cleaned, line);
    }
  }
  return out;

  function push(cleaned: { title: string; year?: number; alt?: string }, line: string) {
    if (!section || !type) return;
    const kind: TmdbKind = type === 'pelicula' ? 'movie' : 'tv';
    const key = `${kind}:${normalize(cleaned.title)}${kind === 'movie' && cleaned.year ? `:${cleaned.year}` : ''}`;
    if (seen.has(key)) return; // p. ej. varias temporadas de la misma serie
    seen.add(key);
    out.push({
      section,
      raw: line,
      title: cleaned.title,
      year: kind === 'movie' ? cleaned.year : undefined,
      alt: cleaned.alt,
      type,
      kind,
      key,
    });
  }
}
