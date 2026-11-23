// Notificaciones de novedades: avisos del sistema (como los de una app de mensajes) cuando se agregan títulos.
//
// Funcionan SIN servidor de notificaciones ni Firebase: una tarea en segundo plano del sistema consulta el
// catálogo cada ~30 minutos (el sistema decide el momento exacto) y, si hay títulos nuevos, muestra la notificación.
// Los módulos nativos solo existen en el APK compilado con ellos: en un APK anterior todo esto se desactiva
// solo (los require están protegidos) y la app sigue funcionando; las novedades se ven dentro de la app.
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { AppState, Platform } from 'react-native';
import type { MediaItem } from '../types';
import { loadServerUrl } from './api';
import { latestAdded, loadMarks, newerThan, saveNotified } from './novelties';
import { getDeviceId } from './requests';
import { readCachedCatalog, writeCachedCatalog } from './storage';
import { syncCatalog } from './sync';

export const NOVELTY_TASK = 'moscas-novedades';
const CHANNEL = 'novedades';
const K_ASKED = 'moscas:notifAsked';
/** Marca: este teléfono quedó registrado para recibir push del servidor (entonces no se duplican avisos locales). */
const K_PUSH = 'moscas:pushOk';

type NotificationsModule = typeof import('expo-notifications');
type TaskManagerModule = typeof import('expo-task-manager');
type BackgroundTaskModule = typeof import('expo-background-task');

function optional<T>(load: () => T): T | null {
  if (Platform.OS === 'web') return null;
  try {
    return load();
  } catch {
    return null; // este APK no incluye el módulo nativo
  }
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Notifications = optional<NotificationsModule>(() => require('expo-notifications'));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const TaskManager = optional<TaskManagerModule>(() => require('expo-task-manager'));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const BackgroundTask = optional<BackgroundTaskModule>(() => require('expo-background-task'));

export const notificationsAvailable = Boolean(Notifications && TaskManager && BackgroundTask);

/** Texto de la notificación: "Dune, Barbie, Oppenheimer y 4 más". */
function summary(items: MediaItem[]) {
  const names = items.slice(0, 3).map((i) => i.title);
  const extra = items.length - names.length;
  return {
    title: items.length === 1 ? '🆕 Nuevo en Las MoscasStream' : `🆕 ${items.length} títulos nuevos`,
    body: names.join(', ') + (extra > 0 ? ` y ${extra} más` : ''),
  };
}

async function notifyNewTitles(items: MediaItem[]) {
  if (!Notifications || !items.length) return;
  const { title, body } = summary(items);
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data: { screen: 'novedades' } },
    trigger: Platform.OS === 'android' ? { channelId: CHANNEL } : null,
  });
}

/** Revisa el servidor desde la tarea en segundo plano y avisa si hay títulos nuevos. */
async function checkInBackground() {
  const url = await loadServerUrl();
  const cached = await readCachedCatalog();
  // Sin catálogo local con cursor no se baja todo en segundo plano: eso lo hace la app al abrirla.
  if (!url || !cached?.cursor) return;
  const marks = await loadMarks();
  const mark = [marks.seen, marks.notified].filter(Boolean).sort().pop();
  if (!mark) return; // la app aún no fijó desde cuándo contar las novedades

  const final = await syncCatalog(
    url,
    { items: new Map(cached.catalog.items.map((i) => [i.id, i] as const)), cursor: cached.cursor },
    {
      onCommit: async (s) => {
        await writeCachedCatalog({
          catalog: { updatedAt: s.serverTime, items: [...s.items.values()] },
          etag: null,
          cursor: s.cursor,
          savedAt: new Date().toISOString(),
        });
      },
    },
  );

  const fresh = newerThan(final.items.values(), mark);
  if (!fresh.length || AppState.currentState === 'active') return; // con la app abierta, el aviso va dentro de la app
  // Con push del servidor activo, el aviso ya llegó (o llegará) por ahí: aquí solo se actualiza el catálogo.
  if (await AsyncStorage.getItem(K_PUSH)) {
    await saveNotified(latestAdded(fresh));
    return;
  }
  await notifyNewTitles(fresh);
  await saveNotified(latestAdded(fresh));
}

// La tarea se define al cargar la app (fuera de cualquier componente), como exige expo-task-manager.
if (TaskManager && BackgroundTask) {
  try {
    const result = BackgroundTask.BackgroundTaskResult;
    TaskManager.defineTask(NOVELTY_TASK, async () => {
      try {
        await checkInBackground();
        return result.Success;
      } catch {
        return result.Failed;
      }
    });
  } catch (e) {
    console.warn('[notificaciones] no se pudo definir la tarea', e);
  }
}

/**
 * Registra este teléfono en el servidor para recibir notificaciones push (el aviso llega al instante, como un mensaje).
 * Necesita un APK compilado con Firebase (google-services.json); si no, falla sin errores y quedan los avisos locales.
 */
async function registerPush(): Promise<boolean> {
  if (!Notifications) return false;
  try {
    const projectId = (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    const url = await loadServerUrl();
    if (!url) return false;
    const res = await fetch(`${url}/api/devices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ token, deviceId: await getDeviceId() }),
    });
    if (!res.ok) return false;
    await AsyncStorage.setItem(K_PUSH, '1');
    return true;
  } catch {
    await AsyncStorage.removeItem(K_PUSH).catch(() => {});
    return false;
  }
}

/**
 * Activa las novedades: canal de notificaciones, permiso (se pregunta una sola vez) y tarea en segundo plano.
 * No hace nada, sin errores, si este APK no trae los módulos nativos.
 */
export async function enableNoveltyNotifications(): Promise<boolean> {
  if (!Notifications || !TaskManager || !BackgroundTask) return false;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: 'Novedades del catálogo',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 150, 250],
        lightColor: '#22D3A6',
      });
    }

    let granted = (await Notifications.getPermissionsAsync()).granted;
    if (!granted && !(await AsyncStorage.getItem(K_ASKED))) {
      await AsyncStorage.setItem(K_ASKED, '1');
      granted = (await Notifications.requestPermissionsAsync()).granted;
    }
    if (!granted) return false;

    void registerPush(); // push instantáneo del servidor (si este APK trae Firebase)

    if (!(await TaskManager.isTaskRegisteredAsync(NOVELTY_TASK))) {
      await BackgroundTask.registerTaskAsync(NOVELTY_TASK, { minimumInterval: 30 });
    }
    return true;
  } catch (e) {
    console.warn('[notificaciones] no se pudieron activar', e);
    return false;
  }
}
