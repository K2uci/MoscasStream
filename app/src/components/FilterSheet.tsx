import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../theme';
import type { MediaItem } from '../types';

export type SortKey = 'recent' | 'rating' | 'title' | 'year';

export interface AdvancedFilters {
  genres: string[];
  /** Década de inicio (p. ej. 2010 = 2010-2019). 1980 = "1989 o antes". null = cualquiera. */
  decade: number | null;
  minRating: number;
  onlyAvailable: boolean;
  sort: SortKey;
}

export const NO_FILTERS: AdvancedFilters = { genres: [], decade: null, minRating: 0, onlyAvailable: false, sort: 'recent' };

/** Cuántos filtros hay activos (el orden "recientes" es el normal y no cuenta). */
export function activeFilterCount(f: AdvancedFilters): number {
  return (f.genres.length ? 1 : 0) + (f.decade !== null ? 1 : 0) + (f.minRating > 0 ? 1 : 0) + (f.onlyAvailable ? 1 : 0) + (f.sort !== 'recent' ? 1 : 0);
}

export function matchesFilters(item: MediaItem, f: AdvancedFilters): boolean {
  if (f.onlyAvailable && !item.available) return false;
  if (f.minRating > 0 && item.rating < f.minRating) return false;
  if (f.genres.length && !f.genres.some((g) => item.genres.includes(g))) return false;
  if (f.decade !== null) {
    if (!item.year) return false;
    if (f.decade === 1980 ? item.year >= 1990 : item.year < f.decade || item.year >= f.decade + 10) return false;
  }
  return true;
}

export function sortItems(items: MediaItem[], sort: SortKey): MediaItem[] {
  if (sort === 'recent') return items;
  const copy = [...items];
  if (sort === 'rating') copy.sort((a, b) => b.rating - a.rating);
  else if (sort === 'year') copy.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
  else copy.sort((a, b) => a.title.localeCompare(b.title, 'es', { sensitivity: 'base' }));
  return copy;
}

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'recent', label: 'Más nuevos' },
  { key: 'rating', label: 'Mejor valorados' },
  { key: 'year', label: 'Año' },
  { key: 'title', label: 'A-Z' },
];
const DECADES = [
  { value: 2020, label: '2020s' },
  { value: 2010, label: '2010s' },
  { value: 2000, label: '2000s' },
  { value: 1990, label: '1990s' },
  { value: 1980, label: '1989 o antes' },
];
const RATINGS = [0, 6, 7, 8];

interface Props {
  visible: boolean;
  items: MediaItem[];
  value: AdvancedFilters;
  onApply: (f: AdvancedFilters) => void;
  onClose: () => void;
}

/** Hoja de filtros: género, década, valoración mínima, solo disponibles y orden. */
export function FilterSheet({ visible, items, value, onApply, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(value);

  // Géneros más frecuentes del catálogo.
  const genres = useMemo(() => {
    const counts = new Map<string, number>();
    for (const i of items) for (const g of i.genres) counts.set(g, (counts.get(g) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([g]) => g);
  }, [items]);

  const toggleGenre = (g: string) =>
    setDraft((d) => ({ ...d, genres: d.genres.includes(g) ? d.genres.filter((x) => x !== g) : [...d.genres, g] }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onShow={() => setDraft(value)}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.head}>
          <Text style={styles.title}>Filtros</Text>
          <Pressable onPress={() => setDraft(NO_FILTERS)} hitSlop={10}>
            <Text style={styles.clear}>Limpiar</Text>
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.label}>Ordenar por</Text>
          <View style={styles.chips}>
            {SORTS.map((s) => (
              <Chip key={s.key} label={s.label} selected={draft.sort === s.key} onPress={() => setDraft((d) => ({ ...d, sort: s.key }))} />
            ))}
          </View>

          <Text style={styles.label}>Género</Text>
          <View style={styles.chips}>
            {genres.map((g) => (
              <Chip key={g} label={g} selected={draft.genres.includes(g)} onPress={() => toggleGenre(g)} />
            ))}
          </View>

          <Text style={styles.label}>Época</Text>
          <View style={styles.chips}>
            {DECADES.map((d) => (
              <Chip
                key={d.value}
                label={d.label}
                selected={draft.decade === d.value}
                onPress={() => setDraft((x) => ({ ...x, decade: x.decade === d.value ? null : d.value }))}
              />
            ))}
          </View>

          <Text style={styles.label}>Valoración mínima</Text>
          <View style={styles.chips}>
            {RATINGS.map((r) => (
              <Chip
                key={r}
                label={r === 0 ? 'Todas' : `${r}+ ★`}
                selected={draft.minRating === r}
                onPress={() => setDraft((d) => ({ ...d, minRating: r }))}
              />
            ))}
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Solo disponibles</Text>
            <Switch
              value={draft.onlyAvailable}
              onValueChange={(v) => setDraft((d) => ({ ...d, onlyAvailable: v }))}
              trackColor={{ true: colors.accent, false: colors.border }}
              thumbColor={colors.text}
            />
          </View>
        </ScrollView>

        <Pressable
          style={styles.apply}
          onPress={() => {
            onApply(draft);
            onClose();
          }}
        >
          <Text style={styles.applyText}>Aplicar filtros</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipOn]} accessibilityState={{ selected }}>
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    maxHeight: '82%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  title: { color: colors.text, fontSize: 20, fontWeight: '900' },
  clear: { color: colors.accent, fontWeight: '700' },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', marginTop: spacing.lg, marginBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: colors.bg,
  },
  chipOn: { borderColor: colors.accent, backgroundColor: colors.accentDim },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: colors.accent, fontWeight: '800' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xl },
  switchLabel: { color: colors.text, fontSize: 15, fontWeight: '700' },
  apply: { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.lg },
  applyText: { color: colors.bg, fontWeight: '900', fontSize: 15 },
});
