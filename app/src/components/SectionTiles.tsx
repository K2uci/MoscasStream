import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, sections, spacing } from '../theme';
import type { MediaItem, MediaType } from '../types';

/** "recent" no tiene tarjeta: se abre con "Ver todo" en Recién agregados. */
export type Filter = 'all' | 'recent' | MediaType;

interface Props {
  items: MediaItem[];
  active: Filter;
  onChange: (f: Filter) => void;
}

/** Tarjetas del dashboard: una por sección con total y disponibles. Tocar una filtra el catálogo. */
export function SectionTiles({ items, active, onChange }: Props) {
  const tiles = [
    { key: 'all' as Filter, label: 'Todo', icon: '✨', tint: colors.accent, list: items },
    ...sections.map((s) => ({
      key: s.type as Filter,
      label: s.label,
      icon: s.icon,
      tint: s.tint,
      list: items.filter((i) => i.type === s.type),
    })),
  ];

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {tiles.map((t) => {
        const selected = active === t.key;
        const available = t.list.filter((i) => i.available).length;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(selected && t.key !== 'all' ? 'all' : t.key)}
            style={({ pressed }) => [
              styles.tile,
              { borderColor: selected ? t.tint : colors.border, opacity: pressed ? 0.8 : 1 },
              selected && { backgroundColor: `${t.tint}22` },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected }}
          >
            <View style={styles.tileTop}>
              <Text style={styles.icon}>{t.icon}</Text>
              <Text style={[styles.total, { color: t.tint }]}>{t.list.length}</Text>
            </View>
            <Text style={styles.label}>{t.label}</Text>
            <Text style={styles.available}>
              {available} disponible{available === 1 ? '' : 's'}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  tile: {
    width: 128,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    backgroundColor: colors.surface,
  },
  tileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  icon: { fontSize: 22 },
  total: { fontSize: 22, fontWeight: '900' },
  label: { color: colors.text, fontWeight: '800', fontSize: 14, marginTop: spacing.sm },
  available: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
});
