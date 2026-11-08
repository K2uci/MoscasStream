import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

/** Valoración 0–10 mostrada como 5 estrellas + número. */
export function Rating({ value, size = 16 }: { value: number; size?: number }) {
  const stars = Math.round(value / 2);
  return (
    <View style={styles.row} accessibilityLabel={`Valoración ${value.toFixed(1)} de 10`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Text key={n} style={{ fontSize: size, color: stars >= n ? colors.star : colors.border }}>
          ★
        </Text>
      ))}
      <Text style={[styles.value, { fontSize: size * 0.9 }]}>{value.toFixed(1)}</Text>
    </View>
  );
}

export function RatingBadge({ value }: { value: number }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>★ {value.toFixed(1)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  value: { color: colors.text, fontWeight: '700', marginLeft: 6 },
  badge: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: { color: colors.star, fontSize: 11, fontWeight: '700' },
});
