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

  await page.evaluate(async () => {
    const localData = window.electronAPI?.localData;
    if (!localData) throw new Error('local data bridge is unavailable');
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const stamp = now.toISOString();
    const cards = [
      { id: 'card-visa', name: 'Visa principal', bank: 'Banco Central', lastFour: '4101', creditLimit: 8000000 },
      { id: 'card-master', name: 'Mastercard viajes', bank: 'Banco Andino', lastFour: '5224', creditLimit: 6200000 },
      {
        id: 'card-amex',
        name: 'American Express recompensas',
        bank: 'Banco Capital',
        lastFour: '3008',
        creditLimit: 9500000,
      },
      {
        id: 'card-digital',
        name: 'Tarjeta digital para suscripciones',
        bank: 'Banco Digital',
        lastFour: '9090',
        creditLimit: 3500000,
      },
    ];
    await localData.putMany('account', [
      {
        id: 'debit-main',
        name: 'Cuenta principal',
        type: 'Debit',
        currency: 'COP',
        bank: 'Banco Central',
        isDefault: true,
        isActive: true,
      },
      ...cards.map((card, index) => ({
        ...card,
        type: 'Credit',
        currency: 'COP',
        billingDay: 12 + index,
        paymentDay: 25 + index,
        interestRate: 2.1 + index * 0.15,
        isDefault: false,
        isActive: true,
      })),
    ]);
    await localData.putMany(
      'movement',
      cards.flatMap((card, cardIndex) =>
        Array.from({ length: 14 }, (_, index) => {
          const amount = 85000 + cardIndex * 27000 + index * 13500;
          return {
            id: `fixture-${card.id}-${index}`,
            date: `${year}-${month}-${String((index % 28) + 1).padStart(2, '0')}T12:00:00`,
            type: 'Expense',
            kind: 'CreditPurchase',
            sourceType: 'CreditCard',
            amount,
            currency: 'COP',
            trmApplied: 1,
            amountBase: amount,
            description: `Compra de prueba con concepto suficientemente largo ${index + 1}`,
            accountId: card.id,
          };
        }),
      ),
    );
    await localData.putMany(
      'recurringtransaction',
      Array.from({ length: 5 }, (_, index) => ({
        id: `recurring-fixture-${index}`,
        type: index === 4 ? 'Income' : 'Expense',
        recurringType: index === 4 ? 'Salary' : 'Subscription',
        amount: 120000 + index * 45000,
        currency: 'COP',
        trmApplied: 1,
        accountId: 'debit-main',
        description: `Recurrente de prueba ${index + 1}`,
        frequency: 'Monthly',
        interval: 1,
        dayOfMonth: 5 + index,
        startDate: `${year}-${month}-01`,
        nextRunAt: `${year}-${month}-${String(5 + index).padStart(2, '0')}`,
        isActive: index !== 3,
        createdAt: stamp,
      })),
    );
  });
  await page.getByRole('button', { name: 'Calendario', exact: true }).click();
  await page.waitForURL(/\/calendar$/);
  await page.getByRole('button', { name: 'Dashboard', exact: true }).click();
  await page.waitForURL(/\/dashboard$/);
  await page.locator('app-dashboard').waitFor({ state: 'visible' });
  await page.waitForTimeout(500);
  assert.equal(await page.locator('html').getAttribute('lang'), 'es-CO');
  await assertAccessible(page, 'dashboard');

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 900 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(300);
    const layout = await page.evaluate(() => {
      const content = document.querySelector('.content__body');
      const view = document.querySelector('app-dashboard .view');
      const contentRect = content?.getBoundingClientRect();
      const offenders = contentRect
        ? [...document.querySelectorAll('app-dashboard *')]
            .map((element) => {
              const rect = element.getBoundingClientRect();
              const style = window.getComputedStyle(element);
              return {
                element: `${element.tagName.toLowerCase()}.${[...element.classList].join('.')}`,
                width: Math.round(rect.width),
                right: Math.round(rect.right - contentRect.right),
                ownOverflow: Math.round(element.scrollWidth - element.clientWidth),
                overflowX: style.overflowX,
                minWidth: style.minWidth,
              };
            })
            .filter(
              (item) =>
                item.right > 1 ||
                (item.ownOverflow > 1 && !['auto', 'scroll', 'hidden', 'clip'].includes(item.overflowX)),
            )
            .sort((a, b) => Math.max(b.right, b.ownOverflow) - Math.max(a.right, a.ownOverflow))
            .slice(0, 12)
        : [];
      const containers = [
        ...document.querySelectorAll(
          '.content__body, app-dashboard, app-dashboard .view, .recent-table-wrap, app-data-table, .dt-wrap, .dt-scroll',
        ),
      ].map((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return {
          element: `${element.tagName.toLowerCase()}.${[...element.classList].join('.')}`,
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          overflowX: style.overflowX,
          minWidth: style.minWidth,
          maxWidth: style.maxWidth,
        };
      });
      return {
        innerWidth: window.innerWidth,
        media1100: window.matchMedia('(max-width: 1100px)').matches,
        shellColumns: window.getComputedStyle(document.querySelector('.app-shell')).gridTemplateColumns,
        documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        contentOverflow: content ? content.scrollWidth - content.clientWidth : Number.POSITIVE_INFINITY,
        unusedWidth:
          content && view ? content.clientWidth - view.getBoundingClientRect().width : Number.POSITIVE_INFINITY,
        offenders,
        containers,
      };
    });
    assert.ok(
      layout.documentOverflow <= 1,
      `dashboard document must not overflow at ${viewport.width}px: ${JSON.stringify(layout)}`,
    );
    assert.ok(
      layout.contentOverflow <= 1,
      `dashboard content must not overflow at ${viewport.width}px: ${JSON.stringify(layout)}`,
    );
    assert.ok(layout.unusedWidth <= 52, `dashboard must use the available width at ${viewport.width}px`);
  }
  await page.setViewportSize({ width: 1280, height: 800 });

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

  const dashboardScroll = await page.locator('.content__body').evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    return element.scrollTop;
  });
  assert.ok(dashboardScroll > 0, 'dashboard test fixture must have enough content to verify scroll restoration');

  await page.getByRole('button', { name: /cuotas y compras/i }).click();
  await page.waitForURL(/\/installments$/);
  assert.equal(
    await page.locator('.content__body').evaluate((element) => element.scrollTop),
    0,
    'route navigation must reset scroll',
  );
  await page
    .getByRole('button', { name: /nueva compra/i })
    .first()
    .waitFor({ state: 'visible' });
  await assertAccessible(page, 'installments');

  await page.getByRole('button', { name: 'Tarjetas', exact: true }).click();
  await page.waitForURL(/\/cards$/);
  await page.locator('.cc-card').first().waitFor({ state: 'visible' });
  assert.equal(await page.locator('.cc-card').count(), 4, 'cards fixture must render all four cards');

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 900 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(200);
    const cardLayout = await page.evaluate(() => {
      const content = document.querySelector('.content__body');
      const cards = [...document.querySelectorAll('.cc-card')].map((element) => {
        const rect = element.getBoundingClientRect();
        const cover = element.querySelector('.cc-card-visual')?.getBoundingClientRect();
        return {
          width: rect.width,
          coverLeft: cover ? cover.left - rect.left : Number.POSITIVE_INFINITY,
          coverRight: cover ? rect.right - cover.right : Number.POSITIVE_INFINITY,
        };
      });
      return {
        documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        contentOverflow: content ? content.scrollWidth - content.clientWidth : Number.POSITIVE_INFINITY,
        cards,
      };
    });
    assert.ok(cardLayout.documentOverflow <= 1, `cards document must not overflow at ${viewport.width}px`);
    assert.ok(cardLayout.contentOverflow <= 1, `cards content must not overflow at ${viewport.width}px`);
    assert.ok(
      cardLayout.cards.every(
        (card) => card.width <= 380 && Math.abs(card.coverLeft) <= 1 && Math.abs(card.coverRight) <= 1,
      ),
      `card covers must stay aligned and readable at ${viewport.width}px: ${JSON.stringify(cardLayout.cards)}`,
    );
  }

  await page.setViewportSize({ width: 1280, height: 800 });
  const cardTable = await page.locator('.cards-table-wrap .dt-scroll').evaluate((element) => ({
    height: element.getBoundingClientRect().height,
    hasInternalVerticalScroll: element.scrollHeight > element.clientHeight,
  }));
  assert.ok(cardTable.height <= 421, `card table must respect its height cap: ${cardTable.height}px`);
  assert.equal(cardTable.hasInternalVerticalScroll, true, 'long card tables must scroll internally');
  await assertAccessible(page, 'cards with data');

  await page.getByRole('button', { name: /^patrimonio$/i }).click();
  await page.waitForURL(/\/portfolio$/);
  assert.equal(
    await page.locator('app-data-table app-pagination').count(),
    0,
    'portfolio must not show inert pagination',
  );
  await assertAccessible(page, 'portfolio');

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 900 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(200);
    const overflow = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      content:
        (document.querySelector('.content__body')?.scrollWidth ?? 0) -
        (document.querySelector('.content__body')?.clientWidth ?? 0),
    }));
    assert.ok(overflow.document <= 1, `portfolio document must not overflow at ${viewport.width}px`);
    assert.ok(overflow.content <= 1, `portfolio content must not overflow at ${viewport.width}px`);
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'Calendario', exact: true }).click();
  await page.waitForURL(/\/calendar$/);
  const calendarWidth = await page
    .locator('.calendar-view')
    .evaluate((element) => element.getBoundingClientRect().width);
  assert.ok(calendarWidth <= 961, `calendar must stay readable instead of stretching: ${calendarWidth}px`);
  assert.ok(calendarWidth >= 800, `calendar should still use a practical desktop width: ${calendarWidth}px`);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);
  const calendarLayout = await page.evaluate(() => {
    const scroll = document.querySelector('.calendar-scroll');
    const content = document.querySelector('.content__body');
    return {
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      contentOverflow: content ? content.scrollWidth - content.clientWidth : Number.POSITIVE_INFINITY,
      calendarHasInternalScroll: scroll ? scroll.scrollWidth > scroll.clientWidth : false,
    };
  });
  assert.ok(calendarLayout.documentOverflow <= 1, 'calendar must not overflow the document on mobile');
  assert.ok(calendarLayout.contentOverflow <= 1, 'calendar must not overflow the content area on mobile');
  assert.equal(
    calendarLayout.calendarHasInternalScroll,
    true,
    'calendar grid must keep its own horizontal scroll on mobile',
  );

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole('button', { name: 'Recurrentes', exact: true }).click();
  await page.waitForURL(/\/recurring$/);
  await page.getByRole('button', { name: 'Nueva recurrente', exact: true }).first().click();
  const recurringDialog = page.getByRole('dialog');
  await recurringDialog.waitFor({ state: 'visible' });
  const desktopModal = await recurringDialog.locator('.modal').evaluate((element) => ({
    width: element.getBoundingClientRect().width,
    overflowY: window.getComputedStyle(element).overflowY,
    bodyOverflowY: window.getComputedStyle(element.querySelector('.modal__body')).overflowY,
  }));
  assert.ok(desktopModal.width >= 700, `complex recurring form should use a wide modal: ${desktopModal.width}px`);
  assert.equal(desktopModal.overflowY, 'hidden', 'modal shell must not create the form scroll');
  assert.equal(desktopModal.bodyOverflowY, 'auto', 'only the modal body may scroll');
  await assertAccessible(page, 'recurring form');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);
  const mobileModal = await recurringDialog.locator('.modal').evaluate((element) => ({
    width: element.getBoundingClientRect().width,
    top: element.getBoundingClientRect().top,
    bottom: element.getBoundingClientRect().bottom,
    viewportHeight: window.innerHeight,
    closeButton: (() => {
      const rect = element.querySelector('.modal__h button')?.getBoundingClientRect();
      return rect ? { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right } : null;
    })(),
    documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  assert.ok(mobileModal.width <= 371, `recurring modal must fit mobile: ${mobileModal.width}px`);
  assert.ok(mobileModal.documentOverflow <= 1, 'recurring modal must not overflow the mobile document');
  assert.ok(
    mobileModal.top >= 0 && mobileModal.bottom <= mobileModal.viewportHeight,
    `recurring modal must stay inside the mobile viewport: ${JSON.stringify(mobileModal)}`,
  );
  await recurringDialog.getByRole('button', { name: 'Cerrar', exact: true }).click();

  await page.setViewportSize({ width: 1280, height: 800 });

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
    'UI smoke test passed: registration, accessibility, responsive dashboard, route scroll restoration, language switching, installments, portfolio, calendar, recurring form, and data tools.',
  );
} finally {
  await app?.close().catch(() => undefined);
  const resolvedProfile = path.resolve(temporaryProfile);
  const resolvedTemp = path.resolve(tmpdir());
  if (resolvedProfile.startsWith(`${resolvedTemp}${path.sep}`)) {
    rmSync(resolvedProfile, { recursive: true, force: true });
  }
}
