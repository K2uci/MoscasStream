// Sube las imágenes de una carpeta (p. ej. copias/pc-vieja/uploads-vieja) al bucket S3/Supabase.
// Uso (PowerShell, desde servidor/api):
//   $env:S3_BUCKET="Photos"; $env:S3_ENDPOINT="https://<proyecto>.storage.supabase.co/storage/v1/s3"
//   $env:S3_REGION="us-east-2"; $env:S3_ACCESS_KEY_ID="..."; $env:S3_SECRET_ACCESS_KEY="..."
//   node scripts/subir-imagenes.mjs ../copias/pc-vieja/uploads-vieja
// Se puede repetir: salta lo que ya está en el bucket.
import fs from 'node:fs/promises';
import path from 'node:path';
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const dir = process.argv[2];
const need = ['S3_BUCKET', 'S3_ENDPOINT', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'];
const missing = need.filter((k) => !process.env[k]);
if (!dir || missing.length) {
  console.error(`Uso: node scripts/subir-imagenes.mjs <carpeta>\nFaltan variables: ${missing.join(', ') || '(ninguna)'}`);
  process.exit(1);
}

const Bucket = process.env.S3_BUCKET;
const client = new S3Client({
  region: process.env.S3_REGION || 'us-east-1',
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: true,
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY },
});

const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.webp'));
console.log(`${files.length} imágenes en ${dir}`);
let done = 0, skipped = 0, failed = 0, next = 0;

async function worker() {
  while (next < files.length) {
    const name = files[next++];
    try {
      const exists = await client.send(new HeadObjectCommand({ Bucket, Key: name })).then(() => true, () => false);
      if (exists) skipped++;
      else {
        await client.send(
          new PutObjectCommand({
            Bucket,
            Key: name,
            Body: await fs.readFile(path.join(dir, name)),
            ContentType: 'image/webp',
            CacheControl: 'public, max-age=31536000, immutable',
          }),
        );
        done++;
      }
    } catch (e) {
      failed++;
      console.error(`✖ ${name}: ${e.message}`);
    }
    const n = done + skipped + failed;
    if (n % 250 === 0) console.log(`${n}/${files.length} (subidas ${done}, ya estaban ${skipped}, fallos ${failed})`);
  }
}

await Promise.all(Array.from({ length: 8 }, worker));
console.log(`Terminado: subidas ${done}, ya estaban ${skipped}, fallos ${failed}`);
process.exit(failed ? 1 : 0);
