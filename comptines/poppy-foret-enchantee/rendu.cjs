// Rend la vidéo image par image avec un navigateur sans écran, puis assemble image + son avec ffmpeg.
// Usage : node rendu.cjs <url_de_scene.html> <chanson.wav> <sortie.mp4> [--apercu t1,t2,...]
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');

const [url, audio, sortie, opt, temps] = process.argv.slice(2);
const FPS = 30;

(async () => {
  const nav = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const page = await nav.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('pageerror', (e) => console.error('Erreur page :', e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.pret === true, null, { timeout: 120000 });
  const duree = await page.evaluate(() => window.duree);

  if (opt === '--apercu') {
    for (const t of temps.split(',').map(Number)) {
      const data = await page.evaluate((x) => window.image(x), t);
      fs.writeFileSync(`${sortie}-${t}.jpg`, Buffer.from(data.split(',')[1], 'base64'));
    }
    await nav.close();
    return;
  }

  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-i', audio, '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
    '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', sortie], { stdio: ['pipe', 'inherit', 'inherit'] });
  const n = Math.round(duree * FPS);
  const debut = Date.now();
  for (let i = 0; i < n; i++) {
    const data = await page.evaluate((x) => window.image(x), i / FPS);
    if (!ff.stdin.write(Buffer.from(data.split(',')[1], 'base64'))) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % 60 === 0) console.log(`image ${i}/${n} — ${Math.round((Date.now() - debut) / 1000)} s`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await nav.close();
  console.log('Terminé :', sortie);
})();
