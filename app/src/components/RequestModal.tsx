import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCatalog } from '../context/CatalogContext';
import {
  fetchMyRequests,
  loadRequesterName,
  queuedRequests,
  saveRequesterName,
  sendRequest,
  type MyRequest,
  type NewRequest,
} from '../lib/requests';
import { colors, radius, sections, spacing } from '../theme';
import type { MediaType } from '../types';

interface Props {
  visible: boolean;
  /** Título con el que se abre (p. ej. lo que se buscó sin encontrar). */
  initialTitle?: string;
  onClose: () => void;
}

const STATUS = {
  pendiente: { label: 'Pendiente', color: colors.warning },
  agregado: { label: 'Agregado ✔', color: colors.accent },
  descartado: { label: 'No disponible', color: colors.textMuted },
} as const;

/** Pedir una película o serie que no está en el catálogo. Sin conexión queda guardado y se envía solo. */
export function RequestModal({ visible, initialTitle = '', onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { serverUrl } = useCatalog();
  const [title, setTitle] = useState(initialTitle);
  const [type, setType] = useState<MediaType | undefined>();
  const [note, setNote] = useState('');
  const [name, setName] = useState('');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [mine, setMine] = useState<MyRequest[]>([]);
  const [queued, setQueued] = useState<NewRequest[]>([]);

  const refreshMine = () => {
    fetchMyRequests(serverUrl).then(setMine);
    queuedRequests().then(setQueued);
  };

  // Al abrirse se limpia el formulario y se cargan el nombre guardado y el estado de los pedidos.
  const onShow = () => {
    setTitle(initialTitle);
    setType(undefined);
    setNote('');
    setMessage(null);
    loadRequesterName().then(setName);
    refreshMine();
  };

  const send = async () => {
    const clean = title.trim();
    if (clean.length < 2) {
      setMessage({ text: 'Escribe el título que quieres pedir.', ok: false });
      return;
    }
    setSending(true);
    setMessage(null);
    await saveRequesterName(name.trim());
    const result = await sendRequest(serverUrl, { title: clean, type, note: note.trim(), requester: name.trim() });
    setSending(false);
    switch (result.kind) {
      case 'sent':
        setMessage({ text: '¡Pedido enviado! Lo revisaremos pronto.', ok: true });
        setTitle('');
        setNote('');
        break;
      case 'queued':
        setMessage({ text: 'Sin conexión: tu pedido quedó guardado y se enviará solo cuando haya internet.', ok: true });
        setTitle('');
        setNote('');
        break;
      case 'exists':
        setMessage({ text: 'Ese título ya está en el catálogo. Búscalo en la pantalla principal.', ok: true });
        break;
      case 'duplicate':
        setMessage({ text: 'Ya habías pedido este título. Sigue en revisión.', ok: true });
        break;
      case 'error':
        setMessage({ text: result.message, ok: false });
        break;
    }
    refreshMine();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} onShow={onShow} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.head}>
            <Text style={styles.title}>📨 Pedir un título</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
            <Text style={styles.help}>¿No encuentras una película o serie? Pídela y la buscaremos.</Text>

            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Título (obligatorio)"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              maxLength={150}
              returnKeyType="next"
            />

            <View style={styles.chips}>
              {sections.map((s) => (
                <Pressable
                  key={s.type}
                  onPress={() => setType(type === s.type ? undefined : s.type)}
                  style={[styles.chip, type === s.type && styles.chipOn]}
                >
                  <Text style={[styles.chipText, type === s.type && styles.chipTextOn]}>
                    {s.icon} {s.singular}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Año, temporada o algún detalle (opcional)"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              maxLength={300}
            />
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Tu nombre (opcional)"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              maxLength={40}
            />

            {message && <Text style={[styles.message, { color: message.ok ? colors.accent : colors.danger }]}>{message.text}</Text>}

            <Pressable style={[styles.send, sending && { opacity: 0.6 }]} onPress={send} disabled={sending}>
              {sending ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.sendText}>Enviar pedido</Text>}
            </Pressable>

            {(queued.length > 0 || mine.length > 0) && <Text style={styles.heading}>Tus pedidos</Text>}
            {queued.map((q, i) => (
              <View key={`q${i}`} style={styles.mine}>
                <Text style={styles.mineTitle} numberOfLines={1}>
                  {q.title}
                </Text>
                <Text style={[styles.mineStatus, { color: colors.textMuted }]}>Por enviar</Text>
              </View>
            ))}
            {mine.map((r) => (
              <View key={r.id} style={styles.mine}>
                <Text style={styles.mineTitle} numberOfLines={1}>
                  {r.title}
                </Text>
                <Text style={[styles.mineStatus, { color: STATUS[r.status].color }]}>{STATUS[r.status].label}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  title: { color: colors.text, fontSize: 20, fontWeight: '900' },
  close: { color: colors.textMuted, fontSize: 20 },
  help: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: spacing.md },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    marginBottom: spacing.md,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 6, backgroundColor: colors.bg },
  chipOn: { borderColor: colors.accent, backgroundColor: colors.accentDim },
  chipText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  chipTextOn: { color: colors.accent, fontWeight: '800' },
  message: { fontSize: 13, fontWeight: '700', marginBottom: spacing.md, lineHeight: 19 },
  send: { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', minHeight: 46, justifyContent: 'center' },
  sendText: { color: colors.bg, fontWeight: '900', fontSize: 15 },
  heading: { color: colors.textMuted, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', marginTop: spacing.xl, marginBottom: spacing.sm },
  mine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, gap: spacing.md },
  mineTitle: { color: colors.text, fontSize: 14, flex: 1 },
  mineStatus: { fontSize: 12, fontWeight: '800' },
});
