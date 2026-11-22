import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { fetchCatalogPage, INITIAL_CURSOR, loadServerUrl, removeLegacyKeys, saveServerUrl } from '../lib/api';
import { clearImageCache, enforceImageCacheLimit, readCachedCatalog, writeCachedCatalog } from '../lib/storage';
import type { Catalog, ConnectionStatus, MediaItem } from '../types';

/** Cada cuánto se consulta el servidor con la app abierta. Sin cambios es una respuesta de pocos bytes. */
const POLL_MS = 30_000;
/** Con el servidor sin responder, el intervalo se duplica (30 s, 1 min, 2 min…) hasta este máximo, para no gastar batería ni datos. */
const MAX_POLL_MS = 2 * 60_000;
/** Títulos por página. Con mala conexión llegan por partes y lo descargado no se pierde si se corta. */
const PAGE_SIZE = 300;
/** Cada cuánto, como máximo, se revisa el tamaño del caché de imágenes. */
const CACHE_CHECK_MS = 10 * 60_000;

interface CatalogState {
  /** Ya se leyó la caché local. La app NO espera a la red: lo guardado se ve al instante y el servidor se consulta en segundo plano. */
  ready: boolean;
  serverUrl: string;
  catalog: Catalog | null;
  status: ConnectionStatus;
  error: string | null;
  /** Última vez que el dispositivo confirmó tener el catálogo al día con el servidor. */
  lastSync: string | null;
  refreshing: boolean;
  /** Progreso de la primera descarga completa (null si no hay una en curso). */
  syncProgress: { loaded: number; total: number } | null;
  refresh: () => Promise<void>;
  setServerUrl: (url: string) => Promise<void>;
  clearCache: () => Promise<void>;
  getItem: (id: string) => MediaItem | undefined;
}

const CatalogContext = createContext<CatalogState | null>(null);
// Contexto aparte para la URL: cambia muy poco y lo leen todas las imágenes.
const ServerUrlContext = createContext('');

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [serverUrl, setServerUrlState] = useState('');
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ loaded: number; total: number } | null>(null);
  // Copia local del catálogo (por id) y hasta dónde del servidor se tiene (cursor de sincronización incremental).
  const itemsRef = useRef(new Map<string, MediaItem>());
  const cursorRef = useRef<string | null>(null);
  const failures = useRef(0);
  const inFlight = useRef(false);
  const lastCacheCheck = useRef(0);

  const checkImageCache = useCallback(() => {
    if (Date.now() - lastCacheCheck.current < CACHE_CHECK_MS) return;
    lastCacheCheck.current = Date.now();
    // Se difiere para no competir con la primera pintura de la pantalla.
    setTimeout(() => enforceImageCacheLimit(), 3000);
  }, []);

  /** Publica el catálogo en pantalla y lo guarda en el dispositivo junto con el cursor (así una descarga cortada continúa). */
  const commit = useCallback(async (items: Map<string, MediaItem>, cursor: string | null, serverTime: string) => {
    itemsRef.current = items;
    cursorRef.current = cursor;
    const next: Catalog = { updatedAt: serverTime, items: [...items.values()] };
    setCatalog(next);
    await writeCachedCatalog({ catalog: next, etag: null, cursor, savedAt: new Date().toISOString() });
  }, []);

  const resetLocal = useCallback(() => {
    itemsRef.current = new Map();
    cursorRef.current = null;
  }, []);

  /**
   * Sincronización incremental: pide solo lo nuevo, modificado o borrado desde el último cursor, en páginas.
   * Sin cursor (primera vez o caché antigua) baja todo desde cero; mientras tanto se sigue mostrando lo guardado.
   */
  const sync = useCallback(
    async (url: string, showSpinner: boolean): Promise<boolean> => {
      if (!url) {
        setCatalog(null);
        setStatus('unconfigured');
        setError(null);
        return true;
      }
      if (inFlight.current) return true;
      inFlight.current = true;
      if (showSpinner) setRefreshing(true);
      try {
        const fresh = cursorRef.current === null;
        // Caché antigua sin cursor: no se reemplaza lo que se ve hasta tener todo el catálogo nuevo.
        const hold = fresh && itemsRef.current.size > 0;
        let after = cursorRef.current ?? INITIAL_CURSOR;
        const since = after.split(':')[0];
        let work = fresh ? new Map<string, MediaItem>() : new Map(itemsRef.current);
        let serverTime = new Date().toISOString();
        let changed = false;
        let loaded = 0;

        for (;;) {
          const result = await fetchCatalogPage(url, { after, since, limit: PAGE_SIZE });
          if (result.kind === 'full') {
            // Servidor sin paginación (versión anterior): llega todo junto y se reemplaza.
            await commit(new Map(result.catalog.items.map((i) => [i.id, i])), null, result.catalog.updatedAt);
            changed = false;
            break;
          }
          const { page } = result;
          for (const item of page.items) work.set(item.id, item);
          for (const id of page.deleted) work.delete(id);
          after = page.next;
          serverTime = page.serverTime;
          loaded += page.items.length;
          if (page.items.length || page.deleted.length) changed = true;
          if (fresh) setSyncProgress({ loaded, total: Math.max(page.total, loaded) });

          if (page.hasMore) {
            if (!hold && changed) await commit(work, after, serverTime); // se ve ya y queda guardado el avance
            continue;
          }
          if (changed || hold || cursorRef.current !== after) await commit(work, after, serverTime);
          break;
        }

        failures.current = 0;
        setStatus('online');
        setError(null);
        setLastSync(new Date().toISOString());
        return true;
      } catch (e) {
        // Sin servidor o con red mala: se sigue mostrando (y usando) lo guardado en el dispositivo.
        failures.current += 1;
        setStatus('offline');
        setError(e instanceof Error ? e.message : 'No se pudo conectar');
        return false;
      } finally {
        inFlight.current = false;
        setRefreshing(false);
        setSyncProgress(null);
      }
    },
    [commit],
  );

  // Arranque offline-first: se lee lo guardado, se muestra ya y la red se consulta en segundo plano.
  useEffect(() => {
    (async () => {
      removeLegacyKeys();
      const [url, cached] = await Promise.all([loadServerUrl(), readCachedCatalog()]);
      setServerUrlState(url);
      if (url && cached) {
        itemsRef.current = new Map(cached.catalog.items.map((i) => [i.id, i]));
        cursorRef.current = cached.cursor ?? null;
        setCatalog(cached.catalog);
        setLastSync(cached.savedAt);
      }
      setReady(true);
      void sync(url, false);
      checkImageCache();
    })();
  }, [sync, checkImageCache]);

  // Consulta periódica en primer plano, con espera creciente si el servidor no responde.
  useEffect(() => {
    if (!ready || !serverUrl) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let active = AppState.currentState === 'active';
    const schedule = () => {
      if (!active) return;
      const delay = Math.min(POLL_MS * 2 ** failures.current, MAX_POLL_MS);
      timer = setTimeout(async () => {
        await sync(serverUrl, false);
        schedule();
      }, delay);
    };
    schedule();
    const sub = AppState.addEventListener('change', (state) => {
      active = state === 'active';
      if (timer) clearTimeout(timer);
      timer = null;
      if (active) {
        failures.current = 0;
        void sync(serverUrl, false).then(schedule);
        checkImageCache();
      }
    });
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      sub.remove();
    };
  }, [ready, serverUrl, sync, checkImageCache]);

  const refresh = useCallback(async () => {
    failures.current = 0;
    await sync(serverUrl, true);
  }, [serverUrl, sync]);

  const setServerUrl = useCallback(
    async (url: string) => {
      if (url !== serverUrl) {
        // Otro servidor: el catálogo guardado ya no aplica.
        resetLocal();
        setCatalog(null);
        setLastSync(null);
        await writeCachedCatalog(null);
      }
      await saveServerUrl(url);
      setServerUrlState(url);
      setStatus(url ? 'loading' : 'unconfigured');
      await sync(url, true);
    },
    [serverUrl, sync, resetLocal],
  );

  const clearCache = useCallback(async () => {
    resetLocal();
    await Promise.all([writeCachedCatalog(null), clearImageCache()]);
    setCatalog(null);
    setLastSync(null);
    await sync(serverUrl, true);
  }, [serverUrl, sync, resetLocal]);

  const byId = useMemo(() => new Map(catalog?.items.map((i) => [i.id, i])), [catalog]);
  const getItem = useCallback((id: string) => byId.get(id), [byId]);

  const value = useMemo(
    () => ({
      ready,
      serverUrl,
      catalog,
      status,
      error,
      lastSync,
      refreshing,
      syncProgress,
      refresh,
      setServerUrl,
      clearCache,
      getItem,
    }),
    [ready, serverUrl, catalog, status, error, lastSync, refreshing, syncProgress, refresh, setServerUrl, clearCache, getItem],
  );

  return (
    <ServerUrlContext.Provider value={serverUrl}>
      <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
    </ServerUrlContext.Provider>
  );
}

export function useCatalog() {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog debe usarse dentro de CatalogProvider');
  return ctx;
}

export const useServerUrl = () => useContext(ServerUrlContext);
