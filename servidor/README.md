# Las MoscasStream — Servidor (API + panel + base de datos)

El servidor corre en **Docker**, en tu PC, y tiene tres partes:

| Parte | Qué hace | Dónde se ve |
|---|---|---|
| **Panel web** | Agregar (manual o automático desde TMDb), editar, borrar títulos y marcar disponibilidad | <http://localhost:3000> (con usuario y contraseña) |
| **API** | Entrega el catálogo a la app Android e importa los listados de la carpeta `importacion` | `http://IP-DE-TU-PC:3000/api/catalog` |
| **PostgreSQL** | Guarda toda la información | Contenedor `db` (volumen `moscasstream_pgdata`) |

Todo se maneja con estos archivos de la carpeta `servidor`, con **doble clic**:

| Archivo | Para qué |
|---|---|
| `iniciar.bat` | Encender el servidor e importar los listados pendientes |
| `detener.bat` | Apagar el servidor (no borra nada) |
| `registro.bat` | Ver en vivo qué hace el servidor (por ejemplo, el avance de la importación) |
| `respaldar.bat` | Hacer una copia de seguridad en `copias\<fecha>` |
| `restaurar.bat` | Recuperar la copia más reciente (o `restaurar.bat "ruta\de\la\copia"`) |

---

## 1. Primera vez

1. Instala **Docker Desktop**: <https://www.docker.com/products/docker-desktop/>.
   En *Settings → General* activa **"Start Docker Desktop when you sign in"**, para que el servidor arranque solo al prender el PC.
2. Haz doble clic en **`iniciar.bat`**.
   - Si no existe el `.env`, lo crea, te pide el usuario y la contraseña del panel y genera las demás contraseñas.
   - Si tienes token de TMDb, ponlo después en `TMDB_TOKEN` dentro del `.env`.
3. **Deja que los teléfonos lleguen al PC** (una sola vez):
   - La red Wi-Fi debe ser **Privada** (*Configuración → Red e Internet → Wi-Fi → tu red*).
   - En PowerShell **como administrador**:
     ```powershell
     netsh advfirewall firewall add rule name="MoscasStream 3000" dir=in action=allow protocol=TCP localport=3000 profile=private
     ```
   - Recomendado: reserva una IP fija para el PC en el router, para no tener que reconfigurar los teléfonos.
4. En la app, **mantén pulsado el logo ~1 s** → *Conexión*. Escribe la dirección que muestra `iniciar.bat` (por ejemplo `192.168.0.104:3000`), pulsa *Probar* y luego *Guardar y conectar*.

---

## 2. Poblar la app automáticamente: carpeta `importacion`

Deja en **`servidor\importacion`** los listados `.txt` de tus discos, con el mismo formato que `Disco I.txt`:

```
cat << 'EOF'
[PELICULAS/CICLO POR ACTORES]
Adam Sandler/50 primeras citas [2004] [1080p] [Latin Audio] [2,26 Gb]
...
EOF
```

**Al arrancar el servidor** (`iniciar.bat`, o al prender el PC si Docker Desktop arranca solo):

1. Se lee cada `.txt`. Se entienden las secciones:
   - Películas: actores, sagas, géneros, cubanas, en español, teleplays…
   - Series y series animadas.
   - Novelas.
   - La sección **XXX se ignora**.
2. El listado se limpia: se quitan calidad, idioma, tamaño, numeración de sagas y "Temp/Caps"; las temporadas de una misma serie cuentan una sola vez.
3. **Cada audiovisual que no esté en la app** se busca en TMDb y se agrega con sinopsis, valoración, géneros, capítulos y temporadas, póster y fondo. Si ya estaba (agregado a mano o en un listado anterior), se salta.
4. Lo que TMDb **no encuentra no se agrega**. Queda anotado en **`importacion\no-encontrados.log`** para que lo agregues a mano desde el panel si quieres.
5. Al terminar un listado, **el `.txt` se borra**.

Detalles:

- **Ritmo.** Corre en segundo plano: el servidor y la app funcionan mientras tanto, y los títulos aparecen en la app según se agregan.
  TMDb permite **40 consultas por minuto**, así que avanza a unos **15-20 títulos por minuto**: una lista de 3000 títulos tarda unas 3 horas.
  Mira el avance con `registro.bat`.
- **Cortes.** Si apagas el servidor o se corta internet a mitad, el `.txt` se conserva.
  En el próximo arranque continúa por donde iba, sin duplicar lo ya agregado.
- **Cuándo se revisa la carpeta.** Solo al arrancar. Si dejas un `.txt` nuevo con el servidor encendido, se procesa en el siguiente `iniciar.bat`.
  Para no esperar, ejecuta `detener.bat` y luego `iniciar.bat`.
- **Recién agregados.** Lo importado sale en *Recién agregados* de la app durante 7 días, como lo agregado a mano.
- **Requisito.** La importación necesita `TMDB_TOKEN` en el `.env` e internet en el PC.

---

## 3. Uso diario

- Con *Start Docker Desktop when you sign in*, el servidor arranca solo al prender el PC. Si no, usa `iniciar.bat`.
- Sigue encendido aunque cierres la ventana. Para apagarlo, usa `detener.bat`.
- **Cambiar el usuario o la contraseña del panel:** edita `ADMIN_USER` / `ADMIN_PASSWORD` en el `.env` y ejecuta `iniciar.bat`.
- **Aplicar cambios de código:** ejecuta `iniciar.bat` (reconstruye la imagen).

### ⛔ Lo que BORRA información

- `docker compose down -v`, porque la opción `-v` borra la base de datos y las imágenes.
- Borrar los volúmenes `moscasstream_pgdata` o `moscasstream_uploads` desde Docker Desktop.
- *Troubleshoot → Clean / Purge data* o *Reset to factory defaults* en Docker Desktop.
- Cambiar `POSTGRES_USER`, `POSTGRES_PASSWORD` o `POSTGRES_DB` en el `.env` después del primer arranque. No borra los datos, pero la API deja de conectarse.

---

## 4. Copias de seguridad

- **Crear:** con el servidor encendido, ejecuta `respaldar.bat`. Se crea `copias\<fecha>` con:
  - `moscasstream.dump`: los títulos.
  - `uploads\`: las imágenes.
  - `env-copia.txt`: tu configuración. No la compartas.

  Guárdala también fuera del PC.
- **Restaurar:** ejecuta `restaurar.bat` y escribe `SI` para confirmar, porque **reemplaza** los datos actuales. Por defecto usa la copia más reciente.
- **Pasar a otro PC:**
  1. Copia la carpeta `servidor` y la copia de seguridad.
  2. Renombra `env-copia.txt` a `.env`.
  3. Ejecuta `iniciar.bat` y después `restaurar.bat "ruta\de\la\copia"`.

---

## 5. Problemas comunes

| Problema | Solución |
|---|---|
| *No se encontró Docker* / *Docker no está encendido* | Instala o abre Docker Desktop y espera a *Engine running* |
| *Bind for …:3000 / …:5434 failed: port is already allocated* | Otro programa usa ese puerto. Cambia `API_PORT` o `DB_PORT` en el `.env` |
| El teléfono dice **Offline** | Misma Wi-Fi que el PC, red *Privada*, regla del Firewall (sección 1, paso 3), y que `http://IP:3000/api/health` responda desde el navegador del teléfono |
| Un listado no se importa | Mira `registro.bat`: casi siempre es falta de `TMDB_TOKEN` o de internet. El `.txt` se conserva y se reintenta en el próximo arranque |
| *El token de TMDb es inválido o caducó* | Genera otro en <https://www.themoviedb.org/settings/api> y cámbialo en `.env` |
| No aparece la pestaña *Automático (TMDb)* en el panel | Falta `TMDB_TOKEN` en el `.env` |
| Demasiados intentos de login | El panel se bloquea 5 minutos tras 5 intentos fallidos |

---

## 6. Detalles técnicos

- **Stack:**
  - API: Node.js + Express 5 + TypeScript.
  - Panel: React + Vite, servido por la API.
  - Base de datos: PostgreSQL 17.
  - Todo en Docker (`Dockerfile`, `docker-compose.yml`).
- **Carpetas compartidas con Windows:** `importacion` (montada en `/app/importacion`).
  Las imágenes viven en el volumen `moscasstream_uploads`.
- **Puertos:**
  - `3000`: panel y API, abierto a la red local.
  - `5434`: PostgreSQL, solo en `127.0.0.1`, para pgAdmin o DBeaver.
- **Imágenes:**
  - WebP: póster 600×900, miniatura 300×450 para las listas de la app y fondo 1280×720.
  - De TMDb se descargan en `w780`/`w1280`.
- **TMDb:**
  - Todas las consultas (panel e importación) pasan por una cola que respeta el límite de 40 por minuto, con margen.
  - Si TMDb responde 429, espera lo que indique y reintenta.
- **Importador** (`api/src/importacion`):
  - `parser.ts` limpia los listados.
  - `importador.ts` busca cada título con varias variantes: título, título alternativo entre paréntesis, partes separadas por " - " y sin numeración inicial.
  - Elige la coincidencia por parecido del título, año y popularidad.
  - Cada título importado guarda su `import_key` para no repetirse nunca.
- **Catálogo:** `/api/catalog` va comprimido con gzip y usa ETag (`304` si nada cambió).
- **Seguridad:**
  - El panel usa una cookie `httpOnly` que dura 12 h y bloquea el login tras 5 intentos fallidos.
  - Las rutas de TMDb requieren login y solo se descargan imágenes de `image.tmdb.org` con rutas validadas.

### Rutas de la API

| Método | Ruta | Requiere login | Uso |
|---|---|---|---|
| GET | `/api/catalog` | No | Catálogo completo (lo usa la app) |
| GET | `/uploads/<archivo>` | No | Imágenes |
| GET | `/api/health` | No | Comprobar que el servidor responde |
| POST | `/api/auth/login`, `/api/auth/logout` · GET `/api/auth/me` | — | Sesión del panel |
| GET | `/api/admin/media` | Sí | Listado |
| POST / PUT | `/api/admin/media`, `/api/admin/media/:id` | Sí | Crear / editar (multipart). Imágenes: archivos `poster`/`backdrop` o rutas de TMDb `posterTmdb`/`backdropTmdb` |
| PATCH | `/api/admin/media/:id/availability` | Sí | Cambiar disponibilidad `{ "available": true/false }` |
| DELETE | `/api/admin/media/:id` | Sí | Eliminar (también borra sus imágenes) |
| GET | `/api/admin/tmdb/status` | Sí | `{ enabled, language }` |
| GET | `/api/admin/tmdb/search?q=&year=&language=` | Sí | Busca películas y series en TMDb |
| GET | `/api/admin/tmdb/:kind/:id?language=` | Sí | Detalles para el formulario (`kind` = `movie` o `tv`) |

### Estructura

```
servidor/
├── iniciar.bat  detener.bat  registro.bat  respaldar.bat  restaurar.bat
├── scripts/              Lógica de los .bat (PowerShell + docker compose)
├── importacion/          Deja aquí los listados .txt (se borran al importarse)
├── copias/               Copias de seguridad
├── api/                  API (Express + TypeScript)
├── panel/                Panel web (React + Vite)
├── Dockerfile, docker-compose.yml
├── .env.example          Plantilla de configuración
└── .env                  Tu configuración real (NO compartir)
```
