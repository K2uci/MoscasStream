import { router } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, sectionOf } from '../theme';
import type { MediaItem } from '../types';
import { Poster } from './Poster';
import { RatingBadge } from './Rating';

export function episodesLabel(item: MediaItem): string | null {
  if (!item.episodes) return null;
  return `${item.episodes} cap.${item.seasons ? ` · ${item.seasons} temp.` : ''}`;
}

export const PosterCard = memo(function PosterCard({ item, width }: { item: MediaItem; width: number }) {
  const subtitle = episodesLabel(item) ?? (item.year ? `${sectionOf(item.type).singular} · ${item.year}` : sectionOf(item.type).singular);

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/media/[id]', params: { id: item.id } })}
      style={({ pressed }) => [{ width, opacity: pressed ? 0.75 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${subtitle}`}
    >
      <View style={[styles.posterWrap, { height: width * 1.5 }]}>
        <Poster item={item} variant="thumb" style={StyleSheet.absoluteFill} />
        <View style={styles.topRow}>
          <RatingBadge value={item.rating} />
        </View>
        {item.episodes ? (
          <View style={styles.episodes}>
            <Text style={styles.episodesText}>{item.episodes} cap.</Text>
          </View>
        ) : null}
        {!item.available && (
          <View style={styles.unavailable}>
            <Text style={styles.unavailableText}>No disponible</Text>
          </View>
        )}
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {item.title}
      </Text>
      <Text style={styles.subtitle} numberOfLines={1}>
        {subtitle}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  posterWrap: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surface },
  topRow: { position: 'absolute', top: 6, left: 6 },
  episodes: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: colors.accent,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  episodesText: { color: colors.bg, fontSize: 11, fontWeight: '800' },
  unavailable: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(11,13,18,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unavailableText: {
    color: colors.text,
    backgroundColor: colors.danger,
    fontWeight: '800',
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  title: { color: colors.text, fontWeight: '700', fontSize: 13, marginTop: 6 },
  subtitle: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
});
