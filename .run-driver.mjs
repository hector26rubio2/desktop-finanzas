import { _electron as electron } from 'playwright-core';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const APP_DIR = 'D:/estudio/finanzas/desktop';
const electronBin = require('electron');
mkdirSync(`${APP_DIR}/.shots`, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const app = await electron.launch({ executablePath: electronBin, args: ['--no-sandbox', APP_DIR], cwd: APP_DIR, timeout: 40000 });
await wait(9000);
let page = app.windows().find((w) => !w.url().startsWith('devtools://')) ?? (await app.firstWindow());
const origin = new URL(page.url()).origin;
console.log('STATE=AUTH');
for (const r of ['categories', 'accounts', 'movements', 'portfolio']) {
  await page.goto(`${origin}/${r}`);
  await wait(2600);
  const over = await page.evaluate(() => { const el = document.querySelector('.content__body'); return el ? el.scrollHeight - el.clientHeight : 'n/a'; });
  await page.screenshot({ path: `${APP_DIR}/.shots/vf-${r}.png` });
  console.log('shot:', r, 'content__body overflow=', over);
}
await app.close().catch(() => {});
console.log('DONE');
