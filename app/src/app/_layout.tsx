import { Stack } from 'expo-router';
import * as Updates from 'expo-updates';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import '../lib/notifications'; // define la tarea de novedades en segundo plano al cargar la app
import { LoadingScreen } from '../components/LoadingScreen';
import { CatalogProvider, useCatalog } from '../context/CatalogContext';
import { FavoritesProvider } from '../context/FavoritesContext';
import { colors } from '../theme';

// La splash nativa se mantiene hasta que la pantalla de carga animada está montada.
SplashScreen.preventAutoHideAsync().catch(() => {});

/** Tiempo mínimo de la animación de carga, para que no parpadee si la red responde rápido. */
const MIN_LOADING_MS = 2600;

/** Actualizaciones por EAS Update (OTA): se busca una nueva al abrir y cada vez que la app vuelve al primer plano. */
async function applyUpdate() {
  if (__DEV__ || !Updates.isEnabled) return;
  try {
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) return;
    await Updates.fetchUpdateAsync();
    await Updates.reloadAsync(); // la versión nueva se aplica de inmediato
  } catch {
    // sin red: se reintenta la próxima vez
  }
}

function useOtaUpdates() {
  useEffect(() => {
    applyUpdate();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && applyUpdate());
    return () => sub.remove();
  }, []);
}

export default function RootLayout() {
  useOtaUpdates();
  return (
    <CatalogProvider>
      <FavoritesProvider>
        <Shell />
      </FavoritesProvider>
    </CatalogProvider>
  );
}

function Shell() {
  const { ready } = useCatalog();
  const [minElapsed, setMinElapsed] = useState(false);
  const [showLoading, setShowLoading] = useState(true);

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
    const t = setTimeout(() => setMinElapsed(true), MIN_LOADING_MS);
    return () => clearTimeout(t);
  }, []);

  const onLoadingFinish = useCallback(() => setShowLoading(false), []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '800' },
          contentStyle: { backgroundColor: colors.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen
          name="media/[id]"
          options={{ title: '', headerTransparent: true, headerStyle: { backgroundColor: 'transparent' } }}
        />
        <Stack.Screen name="settings" options={{ title: 'Conexión' }} />
      </Stack>
      {showLoading && <LoadingScreen done={ready && minElapsed} onFinish={onLoadingFinish} />}
    </View>
  );
}
