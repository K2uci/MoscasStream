import { router } from 'expo-router';
import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
import { flyLogoXml } from '../brand/art';
import { Logo } from '../components/Brand';
import { StatusPill } from '../components/StatusPill';
import { HeroCarousel } from '../components/HeroCarousel';
import { PosterCard } from '../components/PosterCard';
import { SectionRow } from '../components/SectionRow';
import { SectionTiles, type Filter } from '../components/SectionTiles';
import { useCatalog } from '../context/CatalogContext';
import { colors, radius, sectionOf, sections, spacing } from '../theme';
import type { MediaItem, MediaType } from '../types';

const byNewest = (a: MediaItem, b: MediaItem) => b.addedAt.localeCompare(a.addedAt);

/** "Recién agregados" = títulos con menos de una semana en el catálogo del servidor. */
const RECENT_MS = 7 * 24 * 60 * 60 * 1000;

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

export default function Dashboard() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { catalog, status, refreshing, refresh, ready, lastSync } = useCatalog();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
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
      searchIndex: all.map((i) => `${i.title} ${i.genres.join(' ')}`.toLowerCase()),
      featured: all
        .filter((i) => i.available)
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 5),
    };
  }, [catalog]);

  const q = deferredQuery.trim().toLowerCase();
  const showGrid = filter !== 'all' || q.length > 0;

  const filtered = useMemo(() => {
    if (!showGrid) return [];
    if (filter === 'recent') return q ? recent.filter((i) => i.title.toLowerCase().includes(q)) : recent;
    return sorted.filter((item, i) => (filter === 'all' || item.type === filter) && (!q || searchIndex[i].includes(q)));
  }, [showGrid, sorted, searchIndex, recent, filter, q]);

  const rows = useMemo<Row[]>(
    () => [
      { key: 'recent', title: 'Recién agregados', icon: '🆕', items: recent },
      ...sections.map((s) => ({ key: s.type, title: s.label, icon: s.icon, type: s.type, items: byType.get(s.type) ?? [] })),
    ],
    [recent, byType],
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
          onSeeAll={() => setFilter(item.row.type ?? 'recent')}
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

  const header = (
    <View style={{ paddingTop: insets.top + spacing.md }}>
      {/* Ajustes ocultos para los clientes: mantener pulsado el logo ~1 s. */}
      <View style={styles.header}>
        <Pressable onLongPress={() => router.push('/settings')} delayLongPress={1000} style={{ flexShrink: 1 }}>
          <Logo />
        </Pressable>
        <StatusPill status={status} />
      </View>

      {catalog && (
        <>
          <View style={styles.searchWrap}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar por título o género…"
              placeholderTextColor={colors.textMuted}
              style={styles.search}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          </View>
          <SectionTiles items={catalog.items} active={filter} onChange={setFilter} />
          <View style={{ height: spacing.xl }} />
          {showGrid ? (
            <Text style={styles.gridTitle}>
              {filter === 'all'
                ? 'Resultados'
                : filter === 'recent'
                  ? '🆕  Recién agregados'
                  : `${sectionOf(filter).icon}  ${sectionOf(filter).label}`}
              <Text style={styles.gridCount}>  {filtered.length}</Text>
            </Text>
          ) : (
            <HeroCarousel items={featured} width={width} />
          )}
        </>
      )}
    </View>
  );

  const empty =
    !ready || (status === 'loading' && !catalog) ? (
      <ActivityIndicator color={colors.accent} size="large" style={{ marginTop: 60 }} />
    ) : status === 'unconfigured' ? (
      <Message title="¡Bienvenido a Las MoscasStream!" text="El catálogo aún no está configurado en este dispositivo." logo />
    ) : !catalog ? (
      <Message
        title="Aún no hay catálogo"
        text="Conéctate a la red local donde está el servidor y desliza hacia abajo para descargar el catálogo."
        icon="📡"
      />
    ) : (
      <Text style={[styles.muted, { marginTop: spacing.lg }]}>
        {showGrid ? 'No hay títulos que coincidan.' : 'El catálogo está vacío por ahora.'}
      </Text>
    );

  const footer =
    catalog && catalog.items.length > 0 ? (
      <Text style={[styles.footer, { paddingBottom: insets.bottom + spacing.xl }]}>
        {catalog.items.length} títulos · Catálogo actualizado {new Date(catalog.updatedAt).toLocaleString('es-CO')}
      </Text>
    ) : null;

  return (
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
  searchWrap: { paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
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
  gridTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: spacing.md, paddingHorizontal: spacing.lg },
  gridCount: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  gridRow: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  muted: { color: colors.textMuted, fontSize: 14, lineHeight: 20, textAlign: 'center', paddingHorizontal: spacing.xl },
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
