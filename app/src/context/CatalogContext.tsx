import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { fetchCatalog, loadServerUrl, removeLegacyKeys, saveServerUrl } from '../lib/api';
import { clearImageCache, enforceImageCacheLimit, readCachedCatalog, writeCachedCatalog } from '../lib/storage';
import type { Catalog, ConnectionStatus, MediaItem } from '../types';

/** Cada cuánto se consulta el servidor mientras la app está abierta (con ETag casi no gasta datos). */
const POLL_MS = 30_000;
/** Cada cuánto, como máximo, se revisa el tamaño del caché de imágenes. */
const CACHE_CHECK_MS = 10 * 60_000;

interface CatalogState {
  /** Ya se leyó la caché local y se intentó la primera sincronización. */
  ready: boolean;
  serverUrl: string;
  catalog: Catalog | null;
  status: ConnectionStatus;
  error: string | null;
  /** Última vez que el dispositivo confirmó tener el catálogo al día con el servidor. */
  lastSync: string | null;
  refreshing: boolean;
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
  const etag = useRef<string | null>(null);
  const inFlight = useRef(false);
  const lastCacheCheck = useRef(0);

  const checkImageCache = useCallback(() => {
    if (Date.now() - lastCacheCheck.current < CACHE_CHECK_MS) return;
    lastCacheCheck.current = Date.now();
    // Se difiere para no competir con la primera pintura de la pantalla.
    setTimeout(() => enforceImageCacheLimit(), 3000);
  }, []);

  const sync = useCallback(async (url: string, showSpinner: boolean) => {
    if (!url) {
      setCatalog(null);
      setStatus('unconfigured');
      setError(null);
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    if (showSpinner) setRefreshing(true);
    try {
      const result = await fetchCatalog(url, etag.current);
      const now = new Date().toISOString();
      if (!result.notModified) {
        etag.current = result.etag;
        setCatalog(result.catalog);
        await writeCachedCatalog({ catalog: result.catalog, etag: result.etag, savedAt: now });
      }
      setStatus('online');
      setError(null);
      setLastSync(now);
    } catch (e) {
      // Sin servidor: se sigue mostrando lo último guardado en el dispositivo.
      setStatus('offline');
      setError(e instanceof Error ? e.message : 'No se pudo conectar');
    } finally {
      inFlight.current = false;
      setRefreshing(false);
    }
  }, []);

  // Arranque: primero la caché local (se ve al instante) y luego intentamos actualizar.
  useEffect(() => {
    (async () => {
      removeLegacyKeys();
      const [url, cached] = await Promise.all([loadServerUrl(), readCachedCatalog()]);
      setServerUrlState(url);
      if (url && cached) {
        // Hay catálogo guardado: se muestra ya y el servidor se consulta en segundo plano,
        // así la pantalla de carga no espera a una red que quizá no está.
        setCatalog(cached.catalog);
        setLastSync(cached.savedAt);
        etag.current = cached.etag;
        setReady(true);
        sync(url, false);
      } else {
        await sync(url, false);
        setReady(true);
      }
      checkImageCache();
    })();
  }, [sync, checkImageCache]);

  // Consulta periódica mientras la app está en primer plano.
  useEffect(() => {
    if (!ready || !serverUrl) return;
    const tick = () => sync(serverUrl, false);
    let timer: ReturnType<typeof setInterval> | null = setInterval(tick, POLL_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        tick();
        checkImageCache();
        if (!timer) timer = setInterval(tick, POLL_MS);
      } else if (timer) {
        clearInterval(timer);
        timer = null;
      }
    });
    return () => {
      if (timer) clearInterval(timer);
      sub.remove();
    };
  }, [ready, serverUrl, sync, checkImageCache]);

  const refresh = useCallback(() => sync(serverUrl, true), [serverUrl, sync]);

  const setServerUrl = useCallback(
    async (url: string) => {
      if (url !== serverUrl) {
        // Otro servidor: el catálogo guardado ya no aplica.
        etag.current = null;
        setCatalog(null);
        setLastSync(null);
        await writeCachedCatalog(null);
      }
      await saveServerUrl(url);
      setServerUrlState(url);
      setStatus(url ? 'loading' : 'unconfigured');
      await sync(url, true);
    },
    [serverUrl, sync],
  );

  const clearCache = useCallback(async () => {
    etag.current = null;
    await Promise.all([writeCachedCatalog(null), clearImageCache()]);
    setCatalog(null);
    setLastSync(null);
    await sync(serverUrl, true);
  }, [serverUrl, sync]);

  const byId = useMemo(() => new Map(catalog?.items.map((i) => [i.id, i])), [catalog]);
  const getItem = useCallback((id: string) => byId.get(id), [byId]);

  const value = useMemo(
    () => ({ ready, serverUrl, catalog, status, error, lastSync, refreshing, refresh, setServerUrl, clearCache, getItem }),
    [ready, serverUrl, catalog, status, error, lastSync, refreshing, refresh, setServerUrl, clearCache, getItem],
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
