# Desplegar MoscasStream en la nube

Arquitectura: **API + panel** (un contenedor Docker) + **PostgreSQL gestionado** + **bucket de imágenes**.
Así el servidor no depende de tu PC, y como no guarda nada en su disco, se puede mover o reiniciar sin perder datos.

| Pieza | Servicio gratis | Límites a tener en cuenta |
|---|---|---|
| API + panel | **Render** (plan Free, Docker) | 750 h/mes (alcanza para 24/7 con un servicio), 512 MB de RAM; se duerme a los 15 min sin tráfico |
| Base de datos | **Neon** (Free) | 0,5 GB; el cómputo se suspende a los 5 min y despierta en ~1 s |
| Imágenes | **Supabase Storage** (Free, 1 GB, sin tarjeta) o **Cloudflare R2** (10 GB, pide tarjeta) | Con ~5000 títulos las imágenes (WebP) ocupan ~1 GB: si te quedas corto, usa R2 |
| Mantenerlo despierto | **UptimeRobot** (Free) | Monitor HTTP cada 5 min a `https://TU-APP.onrender.com/api/health` |

Con el monitor, el servidor no se duerme y la app responde al instante. Si aun así se durmiera, la app muestra el catálogo
guardado en el teléfono y espera hasta 60 s a que el servidor despierte.
Los precios y límites gratuitos cambian: confírmalos en cada servicio al registrarte.

> **¿Por qué no Vercel?** Vercel ejecuta funciones sin estado que viven segundos: no sirve para el importador de
> listados (tarda horas en segundo plano) y obliga a reescribir la API. Render/Railway/Fly ejecutan el contenedor tal cual.

## Pasos

1. **Neon**: crea un proyecto y copia la *connection string* (`postgres://…?sslmode=require`) → será `DATABASE_URL`.
2. **Cloudflare R2**: crea un bucket, actívale el acceso público (dominio `r2.dev`) y crea un token de API con permiso *Object Read & Write*.
   Anota endpoint, access key, secret y URL pública.
3. **Render**: *New + → Blueprint* con este repositorio (usa `render.yaml`) y rellena las variables:
   `DATABASE_URL`, `ADMIN_USER`, `ADMIN_PASSWORD`, `TMDB_TOKEN`, `S3_*`.
   (Supabase: *Storage → New bucket* público, y en *Settings → Storage* activa el acceso S3 para obtener endpoint y claves; usa además `S3_FORCE_PATH_STYLE=true` y `S3_REGION` con la región de tu proyecto, y `S3_PUBLIC_URL` = `https://<proyecto>.supabase.co/storage/v1/object/public/<bucket>`.)
   Al terminar tendrás una URL como `https://moscasstream.onrender.com`; comprueba `/api/health`.
4. **UptimeRobot**: crea un monitor HTTP(s) con esa URL de `/api/health`, intervalo de 5 minutos.
5. **Panel**: entra a esa URL con el usuario/clave de admin. Con **⬆ Importar listado** subes los `.txt` de tus discos
   (se importan en segundo plano desde la nube).
6. **Migrar datos existentes** (opcional): en tu PC, `respaldar.bat`, y restaura el `.dump` en Neon con
   `pg_restore --no-owner -d "<DATABASE_URL>" moscasstream.dump`; copia la carpeta `uploads` al bucket
   (con `rclone` o el panel de R2). Las rutas `/uploads/…` guardadas en la base se resuelven solas contra `S3_PUBLIC_URL`.

## App Android

- La dirección del servidor viene de fábrica: pon tu URL en `app/eas.json` (`EXPO_PUBLIC_API_URL`) y compila:
  `npm run build:apk` (carpeta `app`).
- **Actualizaciones**: la app usa **EAS Update**. Al abrirla (o volver a ella) busca una versión nueva, la descarga y se recarga.
  Para publicar un cambio de JS/diseño sin recompilar el APK:
  ```bash
  cd app
  npm run update -- "descripción del cambio"
  ```
  Solo hace falta un APK nuevo si cambias módulos nativos o la versión de Expo (`runtimeVersion` = versión de `app.json`).
