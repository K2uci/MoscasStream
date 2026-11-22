import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, spacing } from '../theme';

/** Bloque gris que "respira" mientras el contenido se carga. Todos comparten la misma animación. */
export function SkeletonBlock({ style }: { style?: StyleProp<ViewStyle> }) {
  const [opacity] = useState(() => new Animated.Value(0.45));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[styles.block, style, { opacity }]} />;
}

/** Esqueleto de la pantalla de inicio: tarjetas de secciones, un destacado y dos filas de pósters. */
export function HomeSkeleton({ cardWidth }: { cardWidth: number }) {
  return (
    <View accessibilityLabel="Cargando catálogo">
      <View style={styles.tiles}>
        {[0, 1, 2].map((i) => (
          <SkeletonBlock key={i} style={styles.tile} />
        ))}
      </View>
      <SkeletonBlock style={styles.hero} />
      {[0, 1].map((row) => (
        <View key={row} style={styles.section}>
          <SkeletonBlock style={styles.sectionTitle} />
          <View style={styles.cards}>
            {[0, 1, 2, 3].map((i) => (
              <SkeletonBlock key={i} style={{ width: cardWidth, height: cardWidth * 1.5, borderRadius: radius.md }} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md },
  tiles: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.xl },
  tile: { width: 128, height: 82, borderRadius: radius.lg },
  hero: { height: 190, marginHorizontal: spacing.lg, borderRadius: radius.lg, marginBottom: spacing.xl },
  section: { marginBottom: spacing.xl },
  sectionTitle: { width: 150, height: 18, marginLeft: spacing.lg, marginBottom: spacing.md },
  cards: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg },
});
