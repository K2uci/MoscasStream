import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useServerUrl } from '../context/CatalogContext';
import { resolveImageUrl } from '../lib/api';
import { colors, sectionOf } from '../theme';
import type { MediaItem } from '../types';

interface Props {
  item: MediaItem;
  /** thumb = miniatura para listas; poster = imagen completa; backdrop = fondo horizontal. */
  variant?: 'thumb' | 'poster' | 'backdrop';
  style?: StyleProp<ViewStyle>;
}

/** Imagen del audiovisual con caché en disco; si no hay imagen o falla, dibuja un póster generado. */
export function Poster({ item, variant = 'poster', style }: Props) {
  const serverUrl = useServerUrl();
  // Se recuerda qué URL falló, para reintentar si la imagen cambia en el servidor.
  const [failedUri, setFailedUri] = useState<string>();
  const raw =
    variant === 'backdrop'
      ? item.backdropUrl ?? item.posterUrl
      : variant === 'thumb'
        ? item.thumbUrl ?? item.posterUrl
        : item.posterUrl;
  const uri = resolveImageUrl(raw, serverUrl);

  if (!uri || failedUri === uri) return <GeneratedPoster item={item} style={style} showTitle={variant !== 'backdrop'} />;

  return (
    <View style={[styles.base, style]}>
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={150}
        cachePolicy="memory-disk"
        recyclingKey={`${item.id}-${variant}`}
        onError={() => setFailedUri(uri)}
      />
    </View>
  );
}

function GeneratedPoster({ item, style, showTitle }: { item: MediaItem; style?: StyleProp<ViewStyle>; showTitle: boolean }) {
  const section = sectionOf(item.type);
  return (
    <LinearGradient
      colors={[section.tint, colors.surface]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.base, styles.generated, style]}
    >
      <Text style={styles.generatedIcon}>{section.icon}</Text>
      {showTitle && (
        <Text style={styles.generatedTitle} numberOfLines={3}>
          {item.title}
        </Text>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden', backgroundColor: colors.surfaceAlt },
  generated: { alignItems: 'center', justifyContent: 'center', padding: 10 },
  generatedIcon: { fontSize: 32, marginBottom: 8 },
  generatedTitle: { color: colors.text, fontWeight: '700', textAlign: 'center', fontSize: 14 },
});
