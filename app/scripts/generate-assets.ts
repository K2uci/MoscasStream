// Genera los íconos y la splash a partir de src/brand/art.ts.
// Uso: npm run assets
import sharp from 'sharp';
import { BRAND, bigUsb, fly, svg } from '../src/brand/art';

const out = (name: string) => `assets/${name}`;
const png = (xml: string, size: number | [number, number]) => {
  const [w, h] = Array.isArray(size) ? size : [size, size];
  return sharp(Buffer.from(xml), { density: 600 }).resize(w, h).png();
};

/** Mosca centrada ocupando `scale` del lienzo cuadrado de 200. */
const flyOn = (scale: number, background = '', opts = {}) => {
  const offset = (200 - 200 * scale) / 2;
  return svg('0 0 200 200', `${background}<g transform="translate(${offset} ${offset}) scale(${scale})">${fly(opts)}</g>`);
};

const bg = `<rect width="200" height="200" fill="url(#msBg)"/>`;

async function main() {
  // Ícono clásico (iOS / Expo Go / tiendas): fondo a sangre + mosca grande.
  await png(flyOn(0.92, bg), 1024).toFile(out('icon.png'));

  // Ícono adaptativo de Android: la mosca dentro de la zona segura (~66 % central).
  await png(flyOn(0.68), 1024).toFile(out('android-icon-foreground.png'));
  await png(svg('0 0 200 200', bg), 1024).toFile(out('android-icon-background.png'));

  // Monocromo (íconos temáticos de Android 13+): silueta blanca con el alfa del primer plano.
  const alpha = await sharp(out('android-icon-foreground.png')).extractChannel('alpha').toBuffer();
  await sharp({ create: { width: 1024, height: 1024, channels: 3, background: '#ffffff' } })
    .joinChannel(alpha)
    .png()
    .toFile(out('android-icon-monochrome.png'));

  // Splash nativa: USB en el centro con moscas acercándose (sin texto: la app dibuja el nombre después).
  const mini = (x: number, y: number, s: number, r: number) =>
    `<g transform="translate(${x} ${y}) rotate(${r}) scale(${s}) translate(-100 -100)">${fly({ usb: false, motion: false })}</g>`;
  const splash = svg(
    '0 0 400 400',
    `<g transform="translate(80 140)">${bigUsb()}</g>` +
      mini(70, 90, 0.32, 25) +
      mini(330, 100, 0.28, -30) +
      mini(320, 320, 0.26, -140) +
      mini(80, 315, 0.3, 140),
  );
  await png(splash, 1024).toFile(out('splash-icon.png'));

  await png(flyOn(0.95, bg, { motion: false }), 48).toFile(out('favicon.png'));
  console.log('Assets generados con fondo', BRAND.bg);
}

main();
