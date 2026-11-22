import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

const KEY = 'moscas:favorites';

interface FavoritesState {
  /** Ids de los títulos favoritos (se guardan solo en este teléfono, funcionan sin conexión). */
  ids: ReadonlySet<string>;
  isFavorite: (id: string) => boolean;
  toggle: (id: string) => void;
}

const FavoritesContext = createContext<FavoritesState | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!raw) return;
        const list = JSON.parse(raw) as unknown;
        if (Array.isArray(list)) setIds(new Set(list.map(String)));
      })
      .catch(() => {});
  }, []);

  const toggle = useCallback((id: string) => {
    setIds((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      AsyncStorage.setItem(KEY, JSON.stringify([...next])).catch(() => {});
      return next;
    });
  }, []);

  const isFavorite = useCallback((id: string) => ids.has(id), [ids]);
  const value = useMemo(() => ({ ids, isFavorite, toggle }), [ids, isFavorite, toggle]);
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites debe usarse dentro de FavoritesProvider');
  return ctx;
}
