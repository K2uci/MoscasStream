import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusPill } from '../components/StatusPill';
import { useCatalog } from '../context/CatalogContext';
import { fetchCatalog, normalizeServerUrl } from '../lib/api';
import { IMAGE_CACHE_LIMIT, catalogCacheBytes, formatBytes, imageCacheBytes } from '../lib/storage';
import { colors, radius, spacing } from '../theme';

export default function Settings() {
  const { serverUrl, setServerUrl, status, error, lastSync, catalog, clearCache } = useCatalog();
  const [input, setInput] = useState(serverUrl.replace(/^http:\/\//, ''));
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [usage, setUsage] = useState({ catalog: 0, images: 0 });

  const url = normalizeServerUrl(input);

  const measure = useCallback(() => setUsage({ catalog: catalogCacheBytes(), images: imageCacheBytes() }), []);
  useEffect(measure, [measure, catalog]);

  const test = async () => {
    if (!url) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await fetchCatalog(url);
      const count = result.notModified ? catalog?.items.length ?? 0 : result.catalog.items.length;
      setTestResult({ ok: true, msg: `✔ Conexión correcta: ${count} títulos en el servidor.` });
    } catch (e) {
      setTestResult({ ok: false, msg: `✖ ${e instanceof Error ? e.message : 'No se pudo conectar'}` });
    } finally {
      setTesting(false);
    }
  };

  const save = async () => {
    if (!url) return;
    setSaving(true);
    await setServerUrl(url);
    setSaving(false);
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const disconnect = () => {
    Alert.alert('Desconectar', 'Se olvidará el servidor y el catálogo guardado en este dispositivo.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desconectar',
        style: 'destructive',
        onPress: async () => {
          setInput('');
          setTestResult(null);
          await setServerUrl('');
        },
      },
    ]);
  };

  const wipe = () => {
    Alert.alert(
      'Borrar caché',
      'Se borrarán el catálogo y las imágenes guardadas en este dispositivo y se volverán a descargar del servidor.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: async () => {
            setClearing(true);
            await clearCache();
            setClearing(false);
            measure();
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>Estado</Text>
          <StatusPill status={status} />
        </View>
        <Text style={styles.info}>Servidor: {serverUrl || 'sin configurar'}</Text>
        <Text style={styles.info}>Títulos en el dispositivo: {catalog?.items.length ?? 0}</Text>
        <Text style={styles.info}>
          Última sincronización: {lastSync ? new Date(lastSync).toLocaleString('es-CO') : '—'}
        </Text>
        {error && status === 'offline' && <Text style={[styles.info, { color: colors.warning }]}>Error: {error}</Text>}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Servidor</Text>
        <Text style={styles.help}>
          Escribe la IP de tu PC en la red local y el puerto del panel, por ejemplo{' '}
          <Text style={styles.code}>192.168.1.10:3000</Text>.{'\n'}
          En Windows la ves con el comando <Text style={styles.code}>ipconfig</Text> (Dirección IPv4).
        </Text>
        <TextInput
          value={input}
          onChangeText={(t) => {
            setInput(t);
            setTestResult(null);
          }}
          placeholder="192.168.1.10:3000"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="done"
          onSubmitEditing={test}
          style={styles.input}
        />
        {testResult && (
          <Text style={[styles.info, { color: testResult.ok ? colors.accent : colors.danger }]}>{testResult.msg}</Text>
        )}
        <View style={styles.buttons}>
          <Button label="Probar" onPress={test} disabled={!url || testing} variant="outline" loading={testing} />
          <Button label="Guardar y conectar" onPress={save} disabled={!url || saving} loading={saving} />
        </View>
        {serverUrl ? (
          <Pressable onPress={disconnect} hitSlop={8} style={{ alignSelf: 'flex-start', marginTop: spacing.xs }}>
            <Text style={styles.dangerLink}>Desconectar de este servidor</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Almacenamiento</Text>
        <Text style={styles.info}>Catálogo guardado: {formatBytes(usage.catalog)}</Text>
        <Text style={styles.info}>
          Imágenes en caché: {formatBytes(usage.images)} de {formatBytes(IMAGE_CACHE_LIMIT)} máx.
        </Text>
        <View style={styles.meter}>
          <View
            style={[styles.meterFill, { width: `${Math.min(100, (usage.images / IMAGE_CACHE_LIMIT) * 100)}%` }]}
          />
        </View>
        <Text style={styles.help}>
          Al superar el límite, las imágenes guardadas se borran solas y se vuelven a descargar al verlas.
        </Text>
        <View style={styles.buttons}>
          <Button label="Borrar caché y recargar" onPress={wipe} variant="outline" loading={clearing} disabled={clearing} />
        </View>
      </View>

      <Text style={styles.version}>Las MoscasStream v{Constants.expoConfig?.version ?? '1.0.0'}</Text>
    </ScrollView>
  );
}

function Button({
  label,
  onPress,
  disabled,
  loading,
  variant = 'solid',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'solid' | 'outline';
}) {
  const solid = variant === 'solid';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        solid ? { backgroundColor: colors.accent } : { borderWidth: 1, borderColor: colors.accent },
        { opacity: disabled && !loading ? 0.4 : pressed ? 0.75 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={solid ? colors.bg : colors.accent} />
      ) : (
        <Text style={[styles.buttonText, { color: solid ? colors.bg : colors.accent }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.lg },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  info: { color: colors.textMuted, fontSize: 13 },
  help: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  code: { color: colors.accent, fontFamily: 'monospace' },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
  },
  meter: { height: 6, borderRadius: 3, backgroundColor: colors.bg, overflow: 'hidden' },
  meterFill: { height: '100%', backgroundColor: colors.accent },
  buttons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  button: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    minHeight: 46,
    justifyContent: 'center',
  },
  buttonText: { fontWeight: '800', fontSize: 14 },
  dangerLink: { color: colors.danger, fontWeight: '700', fontSize: 13 },
  version: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
});
