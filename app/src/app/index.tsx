import { router } from 'expo-router';
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
import { flyLogoXml } from '../brand/art';
import { Logo } from '../components/Brand';
import {
  activeFilterCount,
  FilterSheet,
  matchesFilters,
  NO_FILTERS,
  sortItems,
  type AdvancedFilters,
} from '../components/FilterSheet';
import { HeroCarousel } from '../components/HeroCarousel';
import { PosterCard } from '../components/PosterCard';
import { RequestModal } from '../components/RequestModal';
import { SectionRow } from '../components/SectionRow';
import { SectionTiles, type Filter } from '../components/SectionTiles';
import { HomeSkeleton } from '../components/Skeleton';
import { StatusPill } from '../components/StatusPill';
import { useCatalog } from '../context/CatalogContext';
import { useFavorites } from '../context/FavoritesContext';
import { enableNoveltyNotifications } from '../lib/notifications';
import { latestAdded, loadMarks, newerThan, saveSeen } from '../lib/novelties';
import { buildSearchIndex, searchItems } from '../lib/search';
import { colors, radius, sectionOf, sections, spacing } from '../theme';
import type { MediaItem, MediaType } from '../types';

const byNewest = (a: MediaItem, b: MediaItem) => b.addedAt.localeCompare(a.addedAt);

/** "Recién agregados" = títulos con menos de una semana en el catálogo del servidor. */
const RECENT_MS = 7 * 24 * 60 * 60 * 1000;

/** Además de las secciones: "novedades" = lo agregado desde la última visita (se arma al tocar el aviso). */
type ViewFilter = Filter | 'novelties';

interface Row {
  key: string;
  title: string;
  icon: string;
  items: MediaItem[];
  type?: MediaType;
}

// Una sola lista para filas del inicio y para la cuadrícula: así el buscador (en la cabecera)
// no se vuelve a montar y el teclado no pierde el foco al escribir.
type Entry = { kind: 'row'; key: string; row: Row } | { kind: 'grid'; key: string; items: MediaItem[] };

function gridLabel(filter: ViewFilter): string {
  if (filter === 'all') return 'Resultados';
  if (filter === 'recent') return '🆕  Recién agregados';
  if (filter === 'favorites') return '❤️  Favoritos';
  if (filter === 'novelties') return '🆕  Novedades';
  const s = sectionOf(filter);
  return `${s.icon}  ${s.label}`;
}

export default function Dashboard() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { catalog, status, refreshing, refresh, ready, lastSync, syncProgress } = useCatalog();
  const { ids: favoriteIds } = useFavorites();
  const [filter, setFilter] = useState<ViewFilter>('all');
  const [query, setQuery] = useState('');
  const [adv, setAdv] = useState<AdvancedFilters>(NO_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [request, setRequest] = useState<{ open: boolean; title: string }>({ open: false, title: '' });
  const [seenMark, setSeenMark] = useState<string | null>(null);
  const [noveltyList, setNoveltyList] = useState<MediaItem[]>([]);
  // La búsqueda sobre miles de títulos no bloquea el teclado.
  const deferredQuery = useDeferredValue(query);

  // Tamaño de tarjeta adaptado a teléfono / tablet.
  const columns = Math.max(3, Math.floor((width - spacing.lg * 2) / 150));
  const gridCard = (width - spacing.lg * 2 - spacing.md * (columns - 1)) / columns;
  const rowCard = Math.min(140, Math.max(110, width / 3.4));

  // Índices precalculados una vez por cada versión del catálogo.
  // Se recalcula en cada sincronización para que los títulos salgan de "recientes" al cumplir la semana.
  const recent = useMemo(() => {
    const since = new Date(Date.now() - RECENT_MS).toISOString();
    return (catalog?.items ?? []).filter((i) => i.addedAt >= since).sort(byNewest);
  }, [catalog, lastSync]);

  const { sorted, byType, searchIndex, featured } = useMemo(() => {
    const all = [...(catalog?.items ?? [])].sort(byNewest);
    const groups = new Map<MediaType, MediaItem[]>();
    for (const item of all) {
      const list = groups.get(item.type) ?? [];
      list.push(item);
      groups.set(item.type, list);
    }
    return {
      sorted: all,
      byType: groups,
      searchIndex: buildSearchIndex(all),
      featured: all
        .filter((i) => i.available)
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 5),
    };
  }, [catalog]);

  const favoriteItems = useMemo(() => sorted.filter((i) => favoriteIds.has(i.id)), [sorted, favoriteIds]);

  // ---- Novedades: aviso dentro de la app desde la última vez que se vieron ----
  useEffect(() => {
    if (!catalog?.items.length) return;
    loadMarks().then((m) => {
      if (m.seen) {
        setSeenMark(m.seen);
        return;
      }
      // Primera vez: lo que ya hay no es "nuevo".
      const mark = latestAdded(catalog.items);
      saveSeen(mark);
      setSeenMark(mark);
    });
  }, [catalog]);

  // Avisos del sistema (permiso una sola vez, después de ver el catálogo). No hace nada si el APK no los incluye.
  const hasCatalog = Boolean(catalog?.items.length);
  useEffect(() => {
    if (hasCatalog) void enableNoveltyNotifications();
  }, [hasCatalog]);

  const novelties = useMemo(() => newerThan(catalog?.items ?? [], seenMark), [catalog, seenMark]);
  const markSeen = useCallback((list: MediaItem[]) => {
    const mark = latestAdded(list);
    if (!mark) return;
    saveSeen(mark);
    setSeenMark(mark);
  }, []);

  // ---- Lista visible (cuadrícula) ----
  const q = deferredQuery.trim();
  const advCount = activeFilterCount(adv);
  const showGrid = filter !== 'all' || q.length > 0 || advCount > 0;

  const filtered = useMemo(() => {
    if (!showGrid) return [];
    // Con texto: orden por parecido (tolera errores de escritura); sin texto: más nuevos primero.
    let list = q ? searchItems(searchIndex, q).map((i) => sorted[i]) : sorted;
    if (filter === 'recent') {
      const ids = new Set(recent.map((i) => i.id));
      list = list.filter((i) => ids.has(i.id));
    } else if (filter === 'favorites') list = list.filter((i) => favoriteIds.has(i.id));
    else if (filter === 'novelties') {
      const ids = new Set(noveltyList.map((i) => i.id));
      list = list.filter((i) => ids.has(i.id));
    } else if (filter !== 'all') list = list.filter((i) => i.type === filter);
    list = list.filter((i) => matchesFilters(i, adv));
    return q && adv.sort === 'recent' ? list : sortItems(list, adv.sort);
  }, [showGrid, sorted, searchIndex, recent, favoriteIds, noveltyList, filter, q, adv]);

  const rows = useMemo<Row[]>(
    () => [
      ...(favoriteItems.length ? [{ key: 'favorites', title: 'Mis favoritos', icon: '❤️', items: favoriteItems }] : []),
      { key: 'recent', title: 'Recién agregados', icon: '🆕', items: recent },
      ...sections.map((s) => ({ key: s.type, title: s.label, icon: s.icon, type: s.type, items: byType.get(s.type) ?? [] })),
    ],
    [favoriteItems, recent, byType],
  );

  const entries = useMemo<Entry[]>(() => {
    if (!catalog || catalog.items.length === 0) return [];
    if (!showGrid) return rows.map((row) => ({ kind: 'row', key: row.key, row }));
    const out: Entry[] = [];
    for (let i = 0; i < filtered.length; i += columns) {
      out.push({ kind: 'grid', key: `g${i}-${filtered[i].id}`, items: filtered.slice(i, i + columns) });
    }
    return out;
  }, [catalog, showGrid, rows, filtered, columns]);

  const renderEntry = useCallback(
    ({ item }: { item: Entry }) =>
      item.kind === 'row' ? (
        <SectionRow
          title={item.row.title}
          icon={item.row.icon}
          items={item.row.items}
          cardWidth={rowCard}
          onSeeAll={() => setFilter(item.row.type ?? (item.row.key === 'favorites' ? 'favorites' : 'recent'))}
        />
      ) : (
        <View style={styles.gridRow}>
          {item.items.map((m) => (
            <PosterCard key={m.id} item={m} width={gridCard} />
          ))}
        </View>
      ),
    [rowCard, gridCard],
  );

  const refreshControl = (
    <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} colors={[colors.accent]} />
  );

  const openNovelties = () => {
    setNoveltyList(novelties);
    markSeen(novelties);
    setFilter('novelties');
  };

  const header = (
    <View style={{ paddingTop: insets.top + spacing.md }}>
      {/* Ajustes ocultos para los clientes: mantener pulsado el logo ~1 s. */}
      <View style={styles.header}>
        <Pressable onLongPress={() => router.push('/settings')} delayLongPress={1000} style={{ flexShrink: 1 }}>
          <Logo />
        </Pressable>
        <View style={styles.headerRight}>
          <StatusPill status={status} />
        </View>
      </View>

      {catalog && (
        <>
          <View style={styles.searchWrap}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar por título o género…"
              placeholderTextColor={colors.textMuted}
              style={[styles.search, { flex: 1 }]}
              returnKeyType="search"
              clearButtonMode="while-editing"
              autoCorrect={false}
            />
            <Pressable
              onPress={() => setShowFilters(true)}
              style={[styles.filterBtn, advCount > 0 && styles.filterBtnOn]}
              accessibilityLabel="Filtros"
            >
              <Text style={[styles.filterText, advCount > 0 && { color: colors.accent }]}>
                ⚙ Filtros{advCount > 0 ? ` (${advCount})` : ''}
              </Text>
            </Pressable>
          </View>

          {syncProgress && (
            <Text style={styles.syncing}>
              Descargando catálogo… {syncProgress.loaded} de {syncProgress.total}
            </Text>
          )}

          {!showGrid && novelties.length > 0 && (
            <View style={styles.banner}>
              <Pressable onPress={openNovelties} style={{ flex: 1 }}>
                <Text style={styles.bannerTitle}>
                  🆕 {novelties.length} título{novelties.length === 1 ? '' : 's'} nuevo{novelties.length === 1 ? '' : 's'}
                </Text>
                <Text style={styles.bannerText} numberOfLines={1}>
                  {novelties
                    .slice(0, 3)
                    .map((n) => n.title)
                    .join(', ')}
                  {novelties.length > 3 ? ` y ${novelties.length - 3} más` : ''} · Toca para verlos
                </Text>
              </Pressable>
              <Pressable onPress={() => markSeen(novelties)} hitSlop={12} accessibilityLabel="Descartar aviso">
                <Text style={styles.bannerClose}>✕</Text>
              </Pressable>
            </View>
          )}

          <SectionTiles
            items={catalog.items}
            favorites={favoriteItems}
            active={filter === 'novelties' ? 'all' : filter}
            onChange={setFilter}
          />
          <View style={{ height: spacing.xl }} />
          {showGrid ? (
            <View style={styles.gridHead}>
              <Text style={styles.gridTitle}>
                {gridLabel(filter)}
                <Text style={styles.gridCount}>  {filtered.length}</Text>
              </Text>
              {(advCount > 0 || filter !== 'all') && (
                <Pressable
                  onPress={() => {
                    setAdv(NO_FILTERS);
                    setFilter('all');
                  }}
                  hitSlop={10}
                >
                  <Text style={styles.clear}>Quitar filtros</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <HeroCarousel items={featured} width={width} />
          )}
        </>
      )}
    </View>
  );

  const empty =
    !ready || (status === 'loading' && !catalog) ? (
      <HomeSkeleton cardWidth={rowCard} />
    ) : status === 'unconfigured' ? (
      <Message title="¡Bienvenido a Las MoscasStream!" text="El catálogo aún no está configurado en este dispositivo." logo />
    ) : !catalog ? (
      <Message
        title="Aún no hay catálogo"
        text="Sin conexión por ahora. Cuando tengas internet el catálogo se descarga solo, y queda guardado en tu teléfono para verlo sin conexión. También puedes deslizar hacia abajo para reintentar."
        icon="📡"
      />
    ) : showGrid ? (
      <View style={styles.noResults}>
        <Text style={styles.muted}>
          {filter === 'favorites' && !q && advCount === 0
            ? 'Aún no tienes favoritos. Abre un título y toca el corazón.'
            : 'No hay títulos que coincidan.'}
        </Text>
        {q.length >= 2 && (
          <Pressable onPress={() => setRequest({ open: true, title: q })} style={styles.askLarge}>
            <Text style={styles.askLargeText}>📨 Pedir «{q}»</Text>
          </Pressable>
        )}
      </View>
    ) : (
      <Text style={[styles.muted, { marginTop: spacing.lg }]}>El catálogo está vacío por ahora.</Text>
    );

  const footer =
    catalog && catalog.items.length > 0 ? (
      <Text style={[styles.footer, { paddingBottom: insets.bottom + spacing.xl }]}>
        {catalog.items.length} títulos · Catálogo actualizado {new Date(catalog.updatedAt).toLocaleString('es-CO')}
      </Text>
    ) : null;

  return (
    <View style={styles.screen}>
      <FlatList
        style={styles.screen}
        data={entries}
        keyExtractor={(e) => e.key}
        renderItem={renderEntry}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
        refreshControl={refreshControl}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={showGrid ? 5 : 3}
        maxToRenderPerBatch={5}
        windowSize={7}
      />
      {/* Botón flotante "+" para pedir un título (esquina inferior derecha) */}
      {catalog && !showFilters && !request.open && (
        <Pressable
          onPress={() => setRequest({ open: true, title: '' })}
          style={({ pressed }) => [styles.fab, { bottom: insets.bottom + spacing.lg, opacity: pressed ? 0.85 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Pedir una película o serie"
        >
          <Text style={styles.fabPlus}>+</Text>
        </Pressable>
      )}
      <FilterSheet visible={showFilters} items={catalog?.items ?? []} value={adv} onApply={setAdv} onClose={() => setShowFilters(false)} />
      <RequestModal visible={request.open} initialTitle={request.title} onClose={() => setRequest({ open: false, title: '' })} />
    </View>
  );
}

function Message({ title, text, icon, logo }: { title: string; text: string; icon?: string; logo?: boolean }) {
  return (
    <View style={styles.empty}>
      {logo ? <SvgXml xml={flyLogoXml} width={150} height={150} /> : <Text style={styles.emptyIcon}>{icon}</Text>}
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.muted}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  fabPlus: { color: colors.bg, fontSize: 34, fontWeight: '500', lineHeight: 38, marginTop: -2 },
  searchWrap: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  search: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 15,
  },
  filterBtn: {
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  filterBtnOn: { borderColor: colors.accent, backgroundColor: colors.accentDim },
  filterText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  syncing: { color: colors.accent, fontSize: 12, fontWeight: '700', paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accentDim,
  },
  bannerTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  bannerText: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  bannerClose: { color: colors.textMuted, fontSize: 18, paddingHorizontal: 4 },
  gridHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  gridTitle: { color: colors.text, fontSize: 18, fontWeight: '800', flexShrink: 1 },
  gridCount: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  clear: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  gridRow: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  muted: { color: colors.textMuted, fontSize: 14, lineHeight: 20, textAlign: 'center', paddingHorizontal: spacing.xl },
  noResults: { alignItems: 'center', marginTop: spacing.lg, gap: spacing.lg },
  askLarge: {
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.accentDim,
  },
  askLargeText: { color: colors.accent, fontWeight: '800', fontSize: 14 },
  footer: { color: colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: spacing.md },
  empty: { alignItems: 'center', paddingHorizontal: spacing.xl, marginTop: 40 },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
});
