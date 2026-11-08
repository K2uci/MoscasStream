# Las MoscasStream — App Android

Catálogo de audiovisuales para clientes. Usa Expo **SDK 57**, compatible con el Expo Go de la Play Store, y Expo Router.
Solo muestra datos del servidor (`../servidor`), que corre en tu PC dentro de la red local.

## Ejecutar

```bash
npm install
npx expo start
```

Escanea el QR con **Expo Go**. El teléfono y el PC deben estar en la misma Wi-Fi.

## Conectar al servidor (ajustes ocultos)

1. En la pantalla principal, **mantén pulsado el logo ~1 s** para abrir *Conexión*. Los clientes no ven este acceso.
2. Escribe la IP de tu PC y el puerto, por ejemplo `192.168.1.10:3000`. La IP la ves con `ipconfig` → Dirección IPv4.
3. Pulsa *Probar* y luego *Guardar y conectar*.

## Comportamiento

- **Online / Offline**: el indicador dice *Online* cuando el servidor respondió en la última consulta. Si no respondió, dice *Offline*.
- La app consulta el servidor al abrirse, cada 30 s mientras está abierta y al deslizar hacia abajo.
  Usa ETag, así que si no hubo cambios el servidor responde 304 y no se descarga nada.
- **Sin conexión** se muestra el último catálogo guardado en el dispositivo, con sus imágenes en caché.
- **Recién agregados**: títulos con menos de 7 días en la base de datos.
- Secciones: Películas, Series, Anime, Novelas, Documentales y Reality shows.

## Almacenamiento (pensado para 5000+ títulos)

| Qué | Dónde | Tamaño aprox. |
|---|---|---|
| Catálogo | Archivo JSON en documentos (`expo-file-system`) | ~0.6 KB por título → 5000 ≈ 3 MB |
| Imágenes | Caché de `expo-image` | Máx. **150 MB**: al superarlo se vacía sola |
| App instalada | — | ~60–80 MB |

- Las listas usan miniaturas de 300×450 (~20 KB). El póster completo y el fondo solo se descargan al abrir un título.
- Las listas están virtualizadas: solo se dibujan las tarjetas visibles.
- En *Conexión → Almacenamiento* se ve el espacio usado y se puede borrar la caché.

## Ícono y pantalla de carga

- El arte está en `src/brand/art.ts` en formato SVG: la mosca con gafas y la USB.
- Para regenerar los PNG de `assets/` (ícono, ícono adaptativo, monocromo, splash y favicon), ejecuta:

  ```bash
  npm run assets
  ```

- La pantalla de carga animada (`src/components/LoadingScreen.tsx`) muestra moscas volando hacia la USB mientras se carga el catálogo.
  En Expo Go no se ve la splash nativa; sí se ve en el APK.

## Generar el APK

El APK se compila en la nube de Expo (EAS), así que no necesitas Android Studio. El plan gratuito alcanza.

### Primera vez

1. Crea una cuenta gratis en <https://expo.dev/signup>.
2. En una terminal, dentro de la carpeta `app`, ejecuta:

   ```bash
   npx eas-cli@latest login
   npx eas-cli@latest build -p android --profile preview
   ```

3. Responde a las preguntas que hace la primera vez:
   - *Create an EAS project?* → **Yes**. Se agrega el `projectId` a `app.json`.
   - *Generate a new Android Keystore?* → **Yes**. EAS guarda la firma en tu cuenta.
     ⚠️ No la borres nunca: con ella se firman las actualizaciones.
4. La compilación tarda entre 10 y 20 minutos. Al terminar verás un **enlace y un código QR** para descargar el `.apk`.
   También queda disponible en <https://expo.dev> → tu proyecto → *Builds*.

### Instalar en los dispositivos

1. Abre el enlace en el teléfono o tablet, o pasa el `.apk` por cable o USB, y ábrelo.
2. Si Android lo pide, permite **"Instalar apps desconocidas"** para el navegador o el explorador de archivos.
3. Abre *Las MoscasStream*, mantén pulsado el logo y configura la IP del servidor.

### Publicar una actualización

1. En `app.json`, sube `version` (por ejemplo `1.0.1`) y **`android.versionCode`** (por ejemplo `2`).
   El `versionCode` siempre tiene que ser mayor que el anterior.
2. Ejecuta de nuevo `npx eas-cli@latest build -p android --profile preview`.
3. Instala el nuevo `.apk` encima del anterior. Se conservan la IP configurada y el catálogo guardado.

### Notas

- `eas.json` define dos perfiles: `preview` y `production`. Los dos generan un `.apk` instalable directamente.
- `app.json` permite tráfico `http://` (`usesCleartextTraffic`) para hablar con el servidor de la red local.

## Estructura

```
src/app/            pantallas (index = inicio, media/[id] = detalle, settings = conexión)
src/brand/art.ts    ilustraciones SVG de la marca
src/components/     tarjetas, filas, carrusel, pantalla de carga, póster con caché
src/context/        CatalogContext: sincronización, ETag, estado online/offline
src/lib/api.ts      cliente de la API
src/lib/storage.ts  caché del catálogo en archivo + límite del caché de imágenes
scripts/            generación de íconos
```
