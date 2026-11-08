import bcrypt from 'bcryptjs';
import pg from 'pg';
import { config } from './config.js';

export const pool = new pg.Pool({ connectionString: config.databaseUrl });

const schema = `
CREATE TABLE IF NOT EXISTS admins (
  id            SERIAL PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS media (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  type          TEXT NOT NULL,
  poster_path   TEXT,
  backdrop_path TEXT,
  rating        NUMERIC(3,1) NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 10),
  synopsis      TEXT NOT NULL DEFAULT '',
  year          INT,
  genres        TEXT[] NOT NULL DEFAULT '{}',
  episodes      INT CHECK (episodes >= 0),
  seasons       INT CHECK (seasons >= 0),
  available     BOOLEAN NOT NULL DEFAULT TRUE,
  added_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS media_type_idx ON media (type);

-- Referencia a TMDb ("movie:157336" / "tv:1399") de los títulos autocompletados.
ALTER TABLE media ADD COLUMN IF NOT EXISTS tmdb_ref TEXT;
CREATE INDEX IF NOT EXISTS media_tmdb_ref_idx ON media (tmdb_ref);

-- Tipos permitidos (se recrea en cada arranque para poder agregar categorías nuevas).
ALTER TABLE media DROP CONSTRAINT IF EXISTS media_type_check;
ALTER TABLE media ADD CONSTRAINT media_type_check
  CHECK (type IN ('pelicula','serie','anime','novela','documental','reality'));

-- Una sola fila: cuándo cambió el catálogo por última vez (incluye borrados).
CREATE TABLE IF NOT EXISTS catalog_meta (
  id         BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO catalog_meta (id) VALUES (TRUE) ON CONFLICT DO NOTHING;

-- Clave del listado del que salió un título importado (importacion/*.txt), para no repetirlo.
ALTER TABLE media ADD COLUMN IF NOT EXISTS import_key TEXT;
CREATE INDEX IF NOT EXISTS media_import_key_idx ON media (import_key);
DROP TABLE IF EXISTS import_queue;
`;

/** Espera a que Postgres acepte conexiones (al encender el PC el servicio puede tardar unos segundos). */
async function waitForDb(retries = 30) {
  for (let i = 1; ; i++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (e) {
      if (i >= retries) throw e;
      console.log(`[db] esperando a Postgres (${i}/${retries})…`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

export async function initDb() {
  await waitForDb();
  await pool.query(schema);

  // El usuario administrador se sincroniza con el .env en cada arranque.
  const hash = await bcrypt.hash(config.adminPassword, 12);
  await pool.query(
    `INSERT INTO admins (username, password_hash) VALUES ($1, $2)
     ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [config.adminUser, hash],
  );
  await pool.query('DELETE FROM admins WHERE username <> $1', [config.adminUser]);
}

export async function touchCatalog() {
  await pool.query('UPDATE catalog_meta SET updated_at = now()');
}
