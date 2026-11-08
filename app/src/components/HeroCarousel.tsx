import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, sectionOf, spacing } from '../theme';
import type { MediaItem } from '../types';
import { Poster } from './Poster';
import { episodesLabel } from './PosterCard';
import { Rating } from './Rating';

/** Carrusel destacado que avanza solo cada 5 s. */
export function HeroCarousel({ items, width }: { items: MediaItem[]; width: number }) {
  const listRef = useRef<FlatList<MediaItem>>(null);
  const [index, setIndex] = useState(0);
  const cardWidth = width - spacing.lg * 2;
  const height = Math.min(cardWidth * 0.56, 320);

  useEffect(() => {
    if (items.length < 2) return;
    const t = setInterval(() => {
      setIndex((i) => {
        const next = (i + 1) % items.length;
        listRef.current?.scrollToOffset({ offset: next * (cardWidth + spacing.md), animated: true });
        return next;
      });
    }, 5000);
    return () => clearInterval(t);
  }, [items.length, cardWidth]);

  if (items.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <FlatList
        ref={listRef}
        horizontal
        data={items}
        keyExtractor={(i) => i.id}
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth + spacing.md}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
        getItemLayout={(_, i) => ({ length: cardWidth + spacing.md, offset: (cardWidth + spacing.md) * i, index: i })}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / (cardWidth + spacing.md)))}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/media/[id]', params: { id: item.id } })}
            style={[styles.card, { width: cardWidth, height }]}
          >
            <Poster item={item} variant="backdrop" style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['transparent', 'rgba(11,13,18,0.95)']} style={styles.overlay}>
              <Text style={styles.kicker}>
                {sectionOf(item.type).icon} {sectionOf(item.type).singular.toUpperCase()}
                {episodesLabel(item) ? `  ·  ${episodesLabel(item)}` : ''}
              </Text>
              <Text style={styles.title} numberOfLines={1}>
                {item.title}
              </Text>
              <Rating value={item.rating} size={14} />
            </LinearGradient>
          </Pressable>
        )}
      />
      <View style={styles.dots}>
        {items.map((i, n) => (
          <View key={i.id} style={[styles.dot, n === index && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.xl },
  card: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface },
  overlay: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.lg, paddingTop: 60 },
  kicker: { color: colors.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  title: { color: colors.text, fontSize: 24, fontWeight: '900', marginVertical: 4 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: spacing.md },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotActive: { width: 18, backgroundColor: colors.accent },
});
