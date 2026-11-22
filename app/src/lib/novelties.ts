import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MediaItem } from '../types';

// Marcas de "hasta dónde llegó" lo último que se agregó al catálogo (fecha addedAt del servidor, ISO).
// seen: lo que el usuario ya vio en la app. notified: lo que ya se avisó con una notificación.
const K_SEEN = 'moscas:seenMark';
const K_NOTIFIED = 'moscas:notifiedMark';

export interface Marks {
  seen: string | null;
  notified: string | null;
}

export async function loadMarks(): Promise<Marks> {
  try {
    const [seen, notified] = await Promise.all([AsyncStorage.getItem(K_SEEN), AsyncStorage.getItem(K_NOTIFIED)]);
    return { seen, notified };
  } catch {
    return { seen: null, notified: null };
  }
}

export const saveSeen = (mark: string) => AsyncStorage.setItem(K_SEEN, mark).catch(() => {});
export const saveNotified = (mark: string) => AsyncStorage.setItem(K_NOTIFIED, mark).catch(() => {});

/** La addedAt más reciente de una lista de títulos. */
export function latestAdded(items: Iterable<MediaItem>): string {
  let max = '';
  for (const i of items) if (i.addedAt > max) max = i.addedAt;
  return max;
}

/** Títulos disponibles agregados después de la marca. */
export function newerThan(items: Iterable<MediaItem>, mark: string | null): MediaItem[] {
  if (!mark) return [];
  const out: MediaItem[] = [];
  for (const i of items) if (i.available && i.addedAt > mark) out.push(i);
  return out.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
}
