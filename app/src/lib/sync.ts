import type { MediaItem } from '../types';
import { fetchCatalogPage, INITIAL_CURSOR } from './api';

/** Títulos por página. Con mala conexión llegan por partes y lo descargado no se pierde si se corta. */
export const PAGE_SIZE = 300;

export interface SyncSnapshot {
  items: Map<string, MediaItem>;
  /** null = el servidor no pagina: la próxima sincronización vuelve a bajar todo. */
  cursor: string | null;
  serverTime: string;
}

interface Options {
  onProgress?: (loaded: number, total: number) => void;
  /** Se llama cuando hay algo que mostrar y guardar (por página en la primera descarga; al final en las demás). */
  onCommit?: (snapshot: SyncSnapshot) => Promise<void> | void;
}

/**
 * Sincronización incremental y paginada. Parte del catálogo local y su cursor, pide solo lo nuevo,
 * modificado o borrado, y entrega el resultado. Sin cursor (primera vez o caché antigua) baja todo desde cero;
 * si ya había catálogo local, no se reemplaza hasta terminar. Lo usan la pantalla y la tarea en segundo plano.
 * Lanza error si la red falla (lo ya confirmado con onCommit queda a salvo).
 */
export async function syncCatalog(
  url: string,
  start: { items: Map<string, MediaItem>; cursor: string | null },
  { onProgress, onCommit }: Options = {},
): Promise<SyncSnapshot & { changed: boolean }> {
  const fresh = start.cursor === null;
  const hold = fresh && start.items.size > 0;
  let after = start.cursor ?? INITIAL_CURSOR;
  const since = after.split(':')[0];
  let work = fresh ? new Map<string, MediaItem>() : new Map(start.items);
  let serverTime = new Date().toISOString();
  let changed = false;
  let loaded = 0;

  for (;;) {
    const result = await fetchCatalogPage(url, { after, since, limit: PAGE_SIZE });
    if (result.kind === 'full') {
      // Servidor sin paginación (versión anterior): llega todo junto y se reemplaza.
      const snap = {
        items: new Map(result.catalog.items.map((i) => [i.id, i] as const)),
        cursor: null,
        serverTime: result.catalog.updatedAt,
      };
      await onCommit?.(snap);
      return { ...snap, changed: true };
    }

    const { page } = result;
    for (const item of page.items) work.set(item.id, item);
    for (const id of page.deleted) work.delete(id);
    after = page.next;
    serverTime = page.serverTime;
    loaded += page.items.length;
    if (page.items.length || page.deleted.length) changed = true;
    if (fresh) onProgress?.(loaded, Math.max(page.total, loaded));

    if (page.hasMore) {
      if (!hold && changed) await onCommit?.({ items: work, cursor: after, serverTime }); // se ve ya y queda guardado el avance
      continue;
    }
    if (changed || hold || start.cursor !== after) await onCommit?.({ items: work, cursor: after, serverTime });
    return { items: work, cursor: after, serverTime, changed };
  }
}
