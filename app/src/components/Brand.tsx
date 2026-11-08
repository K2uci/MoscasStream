import { StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { flyLogoXml } from '../brand/art';
import { colors } from '../theme';

export function Logo() {
  return (
    <View style={styles.logoRow}>
      <SvgXml xml={flyLogoXml} width={44} height={44} />
      <View>
        <Text style={styles.logo}>
          Las Moscas<Text style={{ color: colors.accent }}>Stream</Text>
        </Text>
        <Text style={styles.tagline}>Catálogo de audiovisuales</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  logo: { color: colors.text, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  tagline: { color: colors.textMuted, fontSize: 12 },
});
