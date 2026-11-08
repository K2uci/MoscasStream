import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import type { ConnectionStatus } from '../types';

/** Online solo cuando el servidor respondió en la última consulta; cualquier otro caso es Offline. */
export function StatusPill({ status }: { status: ConnectionStatus }) {
  const online = status === 'online';
  const label = online ? 'Online' : 'Offline';
  const color = online ? colors.accent : colors.textMuted;
  return (
    <View style={[styles.pill, { borderColor: color }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 6,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  text: { fontSize: 12, fontWeight: '700' },
});
