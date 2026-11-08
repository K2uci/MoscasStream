import { memo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';
import type { MediaItem } from '../types';
import { PosterCard } from './PosterCard';

/** Cuántas tarjetas muestra cada fila del inicio; el resto se ve con "Ver todo". */
export const ROW_LIMIT = 15;

interface Props {
  title: string;
  icon?: string;
  items: MediaItem[];
  cardWidth: number;
  onSeeAll?: () => void;
}

export const SectionRow = memo(function SectionRow({ title, icon, items, cardWidth, onSeeAll }: Props) {
  if (items.length === 0) return null;
  const visible = items.length > ROW_LIMIT ? items.slice(0, ROW_LIMIT) : items;
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {icon ? `${icon}  ` : ''}
          {title}
          <Text style={styles.count}>  {items.length}</Text>
        </Text>
        {onSeeAll && (
          <Pressable onPress={onSeeAll} hitSlop={10}>
            <Text style={styles.seeAll}>Ver todo ›</Text>
          </Pressable>
        )}
      </View>
      <FlatList
        horizontal
        data={visible}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => <PosterCard item={item} width={cardWidth} />}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Separator}
        initialNumToRender={4}
        windowSize={3}
        getItemLayout={(_, index) => ({ length: cardWidth + spacing.md, offset: (cardWidth + spacing.md) * index, index })}
      />
    </View>
  );
});

const Separator = () => <View style={{ width: spacing.md }} />;

const styles = StyleSheet.create({
  section: { marginBottom: spacing.xl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  count: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  seeAll: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  list: { paddingHorizontal: spacing.lg },
});
