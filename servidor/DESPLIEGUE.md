# Desplegar MoscasStream en la nube

Arquitectura: **API + panel** (un contenedor Docker) + **PostgreSQL gestionado** + **bucket de imágenes**.
Así el servidor no depende de tu PC, y como no guarda nada en su disco, se puede mover o reiniciar sin perder datos.

| Pieza | Servicio recomendado | Costo aprox. |
|---|---|---|
| API + panel | **Render** (Docker). También sirven Railway o Fly.io | Starter ~7 USD/mes (siempre encendido). El plan gratis se duerme a los 15 min |
| Base de datos | **Neon** (Postgres) o Supabase | Plan gratis suficiente |
| Imágenes | **Cloudflare R2** (S3-compatible) | Gratis hasta 10 GB |

> **¿Por qué no Vercel?** Vercel ejecuta funciones sin estado que viven segundos: no sirve para el importador de
> listados (tarda horas en segundo plano) y obliga a reescribir la API. Render/Railway/Fly ejecutan el contenedor tal cual.

## Pasos

1. **Neon**: crea un proyecto y copia la *connection string* (`postgres://…?sslmode=require`) → será `DATABASE_URL`.
2. **Cloudflare R2**: crea un bucket, actívale el acceso público (dominio `r2.dev`) y crea un token de API con permiso *Object Read & Write*.
   Anota endpoint, access key, secret y URL pública.
3. **Render**: *New + → Blueprint* con este repositorio (usa `render.yaml`) y rellena las variables:
   `DATABASE_URL`, `ADMIN_USER`, `ADMIN_PASSWORD`, `TMDB_TOKEN`, `S3_*`.
   Al terminar tendrás una URL como `https://moscasstream.onrender.com`; comprueba `/api/health`.
4. **Panel**: entra a esa URL con el usuario/clave de admin. Con **⬆ Importar listado** subes los `.txt` de tus discos
   (se importan en segundo plano desde la nube).
5. **Migrar datos existentes** (opcional): en tu PC, `respaldar.bat`, y restaura el `.dump` en Neon con
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
