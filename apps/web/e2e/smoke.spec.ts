import { expect, test, type Page } from '@playwright/test';
import { parseModule } from '@kodigo/schema';

interface ModInfo { id: string; enabled: boolean }

async function loadModule(page: Page, id: string) {
  const res = await page.request.get(`/api/modules/${id}/files`);
  const { files } = await res.json();
  const { module, issues } = parseModule(files);
  if (!module) throw new Error(`${id} does not parse: ${issues.map((i) => i.message).join('; ')}`);
  return module;
}

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  return errors;
}

async function playScene(page: Page, beats: number) {
  // Drive the scene until its takeaway shows: answer predict gates, skip interactive ones, press Next.
  // (an exiting beat may still be in the DOM during its transition, so act on every open gate)
  const maxTicks = beats * 12 + 10;
  for (let tick = 0; tick < maxTicks; tick++) {
    if (await page.getByText('Takeaway').count()) break;
    for (const predict of await page.$$('[data-testid=gate-predict]')) {
      const opt = await predict.$('[data-testid=predict-option]:not([disabled])');
      const box = await predict.$('input[aria-label=prediction]:not([disabled])');
      if (opt) await opt.click().catch(() => {});
      else if (box) { await box.fill('1').catch(() => {}); await box.press('Enter').catch(() => {}); }
    }
    for (const skip of await page.$$('button:has-text("Skip")')) await skip.click().catch(() => {});
    const next = await page.$('[data-testid=next-beat]:not([disabled])');
    if (next) await next.evaluate((el) => (el as HTMLButtonElement).click()).catch(() => {});
    await page.waitForTimeout(250);
  }
}

let modules: string[] = [];
test.beforeAll(async ({ request }) => {
  const list: ModInfo[] = await (await request.get('/api/modules')).json();
  modules = list.filter((m) => m.enabled).map((m) => m.id);
  expect(modules.length).toBeGreaterThan(0);
});

test('dashboard, glossary, cheatsheet and settings render', async ({ page }) => {
  const errors = collectErrors(page);
  for (const path of ['/', '/glossary', '/cheatsheet', '/settings', '/review']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
  }
  expect(errors).toEqual([]);
});

test('every scene plays through every beat', async ({ page }) => {
  const errors = collectErrors(page);
  for (const id of modules) {
    const mod = await loadModule(page, id);
    for (const sc of mod.intuition) {
      await page.goto(`/m/${id}/intuition/${sc.id}`);
      await page.getByTestId('next-beat').waitFor({ timeout: 15_000 });
      await playScene(page, sc.beats.length);
      await expect(page.getByText('Takeaway'), `${id}/${sc.id} reaches its takeaway`).toBeVisible();
    }
  }
  expect(errors).toEqual([]);
});

test('every Math & Code section and the Application tab render', async ({ page }) => {
  const errors = collectErrors(page);
  for (const id of modules) {
    const mod = await loadModule(page, id);
    for (const s of mod.mathCode) {
      await page.goto(`/m/${id}/math-code/${s.id}`);
      await expect(page.getByRole('heading', { name: s.title }).first()).toBeVisible({ timeout: 15_000 });
      await expect(page.locator('.katex').first()).toBeVisible();
    }
    await page.goto(`/m/${id}/application`);
    await expect(page.getByText(mod.application.case.title).first()).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState('networkidle');
  }
  expect(errors).toEqual([]);
});

test('every quiz template instantiates and can be answered', async ({ page }) => {
  const errors = collectErrors(page);
  for (const id of modules) {
    const mod = await loadModule(page, id);
    const n = mod.quiz.length;
    const count = Math.ceil(n / 0.75) + 1; // 25% of a session is glossary questions
    await page.goto(`/quiz?modules=${id}&count=${count}&mode=practice&start=1`);
    const seen = new Set<string>();
    for (let q = 0; q < count; q++) {
      await page.getByTestId('question').waitFor({ timeout: 15_000 });
      await expect(page.getByText("Couldn't generate")).toHaveCount(0);
      const metaText = async () => (await page.getByTestId('question-meta').textContent().catch(() => '')) ?? '';
      const meta = await metaText();
      seen.add(meta.split('·')[1]?.trim() ?? '');
      const radio = await page.$('[role=radio]'); if (radio) await radio.click();
      const check = await page.$('[role=checkbox]'); if (check) await check.click();
      const num = await page.$('input[aria-label=answer]'); if (num) await num.fill('1');
      for (const b of await page.$$('input[aria-label^="blank"]')) await b.fill('x');
      for (let k = 0; k < 8; k++) { const s = await page.$('button:has-text("Show step")'); if (!s) break; await s.click(); await page.waitForTimeout(100); }
      for (const s of await page.$$('input[aria-label$="answer"]')) if (!(await s.inputValue())) await s.fill('1');
      const submit = await page.$('[data-testid=submit-answer]');
      if (submit && (await submit.isEnabled())) await submit.click();
      await page.waitForTimeout(200);
      const next = await page.$('[data-testid=next-question]');
      if (next) await next.click();
      if (q < count - 1) await expect.poll(metaText, { timeout: 10_000 }).not.toBe(meta);
    }
    const authored = new Set(mod.quiz.map((t) => t.id));
    const covered = [...seen].filter((t) => authored.has(t));
    expect(covered.length, `${id}: authored templates rendered`).toBe(authored.size);
  }
  expect(errors).toEqual([]);
});

test('progress survives reload and export → reset → import', async ({ page }) => {
  const doneCount = () => page.evaluate(() => new Promise<number>((resolve, reject) => {
    const req = indexedDB.open('kodigo');
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const tx = req.result.transaction('progress', 'readonly');
      const all = tx.objectStore('progress').getAll();
      all.onsuccess = () => { resolve(all.result.filter((p: any) => p.status === 'done').length); req.result.close(); };
    };
  }));
  const mod = await loadModule(page, modules[0]);
  const sc = mod.intuition[0];
  await page.goto(`/m/${modules[0]}/intuition/${sc.id}`);
  await page.getByTestId('next-beat').waitFor();
  await playScene(page, sc.beats.length);
  await expect.poll(doneCount).toBeGreaterThan(0);
  await page.reload();
  expect(await doneCount()).toBeGreaterThan(0);

  await page.goto('/settings');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Download my progress/ }).click()]);
  const file = await dl.path();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Reset progress' }).click();
  await expect.poll(doneCount).toBe(0);
  await page.locator('input[type=file][accept="application/json"]').setInputFiles(file!);
  await expect(page.getByText(/Imported:/)).toBeVisible();
  expect(await doneCount()).toBeGreaterThan(0);
});
