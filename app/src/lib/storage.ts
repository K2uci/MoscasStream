import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { Image } from 'expo-image';
import { Platform } from 'react-native';
import type { Catalog } from '../types';

/**
 * Presupuesto de almacenamiento (objetivo: la app completa por debajo de ~300 MB):
 *  - App instalada: ~60–80 MB.
 *  - Catálogo en archivo JSON: ~1 KB por título → 5000 títulos ≈ 5 MB.
 *  - Caché de imágenes: se vacía al superar IMAGE_CACHE_LIMIT. Las listas usan miniaturas
 *    de ~20 KB, así que 150 MB alcanzan para todo el catálogo.
 */
export const IMAGE_CACHE_LIMIT = 150 * 1024 * 1024;

const CATALOG_FILE = 'catalog-cache.json';
const CATALOG_TMP = 'catalog-cache.tmp';
const KEY_LAST_SERVER = 'moscas:lastServer';
const isWeb = Platform.OS === 'web';

export interface CachedCatalog {
  catalog: Catalog;
  etag: string | null;
  savedAt: string;
}

// El catálogo puede pesar varios MB: en Android, AsyncStorage falla con valores tan grandes,
// así que se guarda en un archivo del directorio de documentos (no lo borra el sistema).
const catalogFile = () => new File(Paths.document, CATALOG_FILE);

export async function readCachedCatalog(): Promise<CachedCatalog | null> {
  try {
    if (isWeb) {
      const raw = await AsyncStorage.getItem(CATALOG_FILE);
      return raw ? JSON.parse(raw) : null;
    }
    const file = catalogFile();
    if (!file.exists) return null;
    try {
      return JSON.parse(await file.text()) as CachedCatalog;
    } catch {
      // Archivo dañado: se borra y la app se trata como "primera vez".
      file.delete();
      return null;
    }
  } catch {
    return null;
  }
}

export async function writeCachedCatalog(data: CachedCatalog | null): Promise<void> {
  try {
    if (isWeb) {
      if (data) await AsyncStorage.setItem(CATALOG_FILE, JSON.stringify(data));
      else await AsyncStorage.removeItem(CATALOG_FILE);
      return;
    }
    const file = catalogFile();
    if (!data) {
      if (file.exists) file.delete();
      return;
    }
    // Escritura segura: archivo temporal y luego renombrar, para que un corte no deje el catálogo corrupto.
    const tmp = new File(Paths.document, CATALOG_TMP);
    if (tmp.exists) tmp.delete();
    tmp.create();
    tmp.write(JSON.stringify(data));
    tmp.move(file, { overwrite: true });
  } catch (e) {
    console.warn('[cache] no se pudo guardar el catálogo', e);
  }
}

export function catalogCacheBytes(): number {
  if (isWeb) return 0;
  try {
    return catalogFile().size ?? 0;
  } catch {
    return 0;
  }
}

/** Tamaño del directorio de caché (ahí guarda expo-image las imágenes descargadas). */
export function imageCacheBytes(): number {
  if (isWeb) return 0;
  try {
    return new Directory(Paths.cache).size ?? 0;
  } catch {
    return 0;
  }
}

export async function clearImageCache(): Promise<void> {
  await Promise.all([Image.clearDiskCache(), Image.clearMemoryCache()]).catch(() => {});
}

/** Si el caché de imágenes supera el límite, se vacía (las imágenes se vuelven a descargar al verlas). */
export async function enforceImageCacheLimit(): Promise<void> {
  if (imageCacheBytes() > IMAGE_CACHE_LIMIT) {
    await clearImageCache();
    console.log('[cache] caché de imágenes vaciado por superar el límite');
  }
}

export const formatBytes = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;

export async function loadLastServer(): Promise<string> {
  return (await AsyncStorage.getItem(KEY_LAST_SERVER).catch(() => null)) ?? '';
}

export async function saveLastServer(url: string): Promise<void> {
  await AsyncStorage.setItem(KEY_LAST_SERVER, url).catch(() => {});
}
