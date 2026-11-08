import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Poster } from '../../components/Poster';
import { Rating } from '../../components/Rating';
import { useCatalog } from '../../context/CatalogContext';
import { colors, radius, sectionOf, spacing } from '../../theme';

export default function MediaDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getItem } = useCatalog();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const item = getItem(id);

  if (!item) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.muted}>Este título ya no está en el catálogo.</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Volver</Text>
        </Pressable>
      </View>
    );
  }

  const section = sectionOf(item.type);
  const backdropHeight = Math.min(width * 0.62, 380);
  const posterWidth = Math.min(width * 0.32, 160);

  const meta = [
    `${section.icon} ${section.singular}`,
    item.year ? String(item.year) : null,
    item.seasons ? `${item.seasons} temporada${item.seasons > 1 ? 's' : ''}` : null,
    item.episodes ? `${item.episodes} capítulos` : null,
  ].filter(Boolean) as string[];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}>
      <View style={{ height: backdropHeight }}>
        <Poster item={item} variant="backdrop" style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={['rgba(11,13,18,0.3)', 'transparent', colors.bg]}
          locations={[0, 0.4, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <View style={[styles.headRow, { marginTop: -posterWidth * 0.75 }]}>
        <Poster item={item} style={[styles.poster, { width: posterWidth, height: posterWidth * 1.5 }]} />
        <View style={styles.headInfo}>
          <Text style={styles.title}>{item.title}</Text>
          <Rating value={item.rating} size={18} />
          <View
            style={[styles.availability, { backgroundColor: item.available ? colors.accentDim : colors.dangerDim }]}
          >
            <View style={[styles.dot, { backgroundColor: item.available ? colors.accent : colors.danger }]} />
            <Text style={[styles.availabilityText, { color: item.available ? colors.accent : colors.danger }]}>
              {item.available ? 'Disponible' : 'No disponible por ahora'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.chips}>
          {meta.map((m) => (
            <View key={m} style={styles.chip}>
              <Text style={styles.chipText}>{m}</Text>
            </View>
          ))}
        </View>

        {item.genres.length > 0 && (
          <View style={styles.chips}>
            {item.genres.map((g) => (
              <View key={g} style={[styles.chip, { borderColor: section.tint }]}>
                <Text style={[styles.chipText, { color: section.tint }]}>{g}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.heading}>Sinopsis</Text>
        <Text style={styles.synopsis}>{item.synopsis || 'Sin sinopsis.'}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  headRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: spacing.lg, alignItems: 'flex-end' },
  poster: { borderRadius: radius.md, borderWidth: 2, borderColor: colors.border },
  headInfo: { flex: 1, gap: spacing.sm, paddingBottom: spacing.xs },
  title: { color: colors.text, fontSize: 24, fontWeight: '900', lineHeight: 28 },
  availability: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  availabilityText: { fontSize: 12, fontWeight: '800' },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: colors.surface,
  },
  chipText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  heading: { color: colors.text, fontSize: 17, fontWeight: '800', marginTop: spacing.md, marginBottom: spacing.sm },
  synopsis: { color: colors.textMuted, fontSize: 15, lineHeight: 23 },
  muted: { color: colors.textMuted, fontSize: 15, textAlign: 'center' },
  backBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  backBtnText: { color: colors.bg, fontWeight: '800' },
});
