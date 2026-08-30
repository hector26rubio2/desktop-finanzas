import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { _electron as electron } from 'playwright-core';
import axe from 'axe-core';

const require = createRequire(import.meta.url);
const projectRoot = process.cwd();
const temporaryProfile = mkdtempSync(path.join(tmpdir(), 'finanzas-e2e-'));
const electronBinary = require('electron');
const packagedExecutable = process.env['FINANZAS_EXECUTABLE'];
const executablePath = packagedExecutable ? path.resolve(packagedExecutable) : electronBinary;
let app;

async function assertAccessible(page, label) {
  await page.evaluate(axe.source);
  const result = await page.evaluate(async () =>
    window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    }),
  );
  const blocking = result.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact));
  assert.deepEqual(
    blocking.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      targets: violation.nodes.map((n) => n.target),
    })),
    [],
    `${label} has serious accessibility violations`,
  );
}

try {
  app = await electron.launch({
    executablePath,
    args: ['--no-sandbox', `--user-data-dir=${temporaryProfile}`, ...(packagedExecutable ? [] : [projectRoot])],
    cwd: packagedExecutable ? path.dirname(executablePath) : projectRoot,
    timeout: 40_000,
  });
  const page = await app.firstWindow();
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await page.waitForLoadState('domcontentloaded');
  const origin = new URL(page.url()).origin;

  await page.goto(`${origin}/register`);
  await page.locator('#register-name').fill('Prueba de interfaz');
  await page.locator('#register-email').fill('qa@example.test');
  await page.locator('#register-password').fill('SmokeTest2026');
  await page.locator('#register-base-currency').selectOption('COP');

  const labelledFields = await page.locator('label[for^="register-"]').count();
  assert.equal(labelledFields, 4, 'registration controls must keep explicit labels');

  await page.setViewportSize({ width: 375, height: 812 });
  const mobileOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  assert.equal(mobileOverflow, 0, 'registration must not overflow horizontally on a mobile viewport');
  await page.setViewportSize({ width: 1280, height: 800 });
  await assertAccessible(page, 'registration');

  await page.locator('form.auth-form button[type="submit"]').click();
  await page.locator('#recovery-code').waitFor({ state: 'visible' });
  await page.locator('#recovery-ack').check();
  await page.getByRole('button', { name: /continuar|continue/i }).click();
  await page.waitForURL(/\/dashboard$/);
  assert.equal(await page.locator('html').getAttribute('lang'), 'es-CO');
  await assertAccessible(page, 'dashboard');

  await page.getByRole('button', { name: 'Configuración', exact: true }).click();
  await page.waitForURL(/\/settings$/);
  await page.getByRole('button', { name: 'Perfil', exact: true }).click();
  await page.getByText('English', { exact: true }).click();
  await page.waitForFunction(() => document.documentElement.lang === 'en-US');
  assert.equal(await page.locator('html').getAttribute('lang'), 'en-US');
  await page.getByRole('button', { name: 'Dashboard', exact: true }).click();
  await page.waitForURL(/\/dashboard$/);
  await page.getByRole('heading', { name: 'Verifiable financial analytics' }).waitFor({ state: 'visible' });
  await page.locator('[aria-label="Global filters"]').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.waitForURL(/\/settings$/);
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await page.getByText('Español', { exact: true }).click();
  await page.waitForFunction(() => document.documentElement.lang === 'es-CO');
  assert.equal(await page.locator('html').getAttribute('lang'), 'es-CO');
  await page.getByRole('button', { name: 'Dashboard', exact: true }).click();
  await page.waitForURL(/\/dashboard$/);

  await page.getByRole('button', { name: /cuotas y compras/i }).click();
  await page.waitForURL(/\/installments$/);
  await page.getByRole('button', { name: /nueva compra/i }).waitFor({ state: 'visible' });
  await assertAccessible(page, 'installments');

  await page.getByRole('button', { name: /^patrimonio$/i }).click();
  await page.waitForURL(/\/portfolio$/);
  assert.equal(
    await page.locator('app-data-table app-pagination').count(),
    0,
    'portfolio must not show inert pagination',
  );
  await assertAccessible(page, 'portfolio');

  await page.getByRole('button', { name: 'Datos y respaldo', exact: true }).click();
  await page.waitForURL(/\/platform-tools$/);
  await page.getByRole('heading', { name: 'Datos y operación' }).waitFor({ state: 'visible' });
  await assertAccessible(page, 'data tools');
  await page.getByRole('button', { name: 'Configuración', exact: true }).click();
  await page.waitForURL(/\/settings$/);
  await page.getByRole('button', { name: 'Perfil', exact: true }).click();
  await page.getByText('English', { exact: true }).click();
  await page.waitForFunction(() => document.documentElement.lang === 'en-US');
  await page.getByRole('button', { name: 'Data & backup', exact: true }).click();
  await page.waitForURL(/\/platform-tools$/);
  await page.getByRole('heading', { name: 'Data and operations' }).waitFor({ state: 'visible' });
  await page.getByRole('heading', { name: 'Local backup' }).waitFor({ state: 'visible' });
  assert.equal(await page.locator('html').getAttribute('lang'), 'en-US');

  assert.deepEqual(consoleErrors, []);
  console.log(
    'UI smoke test passed: registration, accessibility, responsive layout, language switching, installments, portfolio, and data tools.',
  );
} finally {
  await app?.close().catch(() => undefined);
  const resolvedProfile = path.resolve(temporaryProfile);
  const resolvedTemp = path.resolve(tmpdir());
  if (resolvedProfile.startsWith(`${resolvedTemp}${path.sep}`)) {
    rmSync(resolvedProfile, { recursive: true, force: true });
  }
}
