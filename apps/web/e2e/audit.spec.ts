import { expect, test, type Page } from '@playwright/test';

// Browser checks from the webapp audit: pages load what they need, attempts survive leaving, results are saved.

const EXAM_MODULE = 'pandas-select-rows';
const ANCHOR_PAGE = '/m/abc/math-code/abc-rates';

/** Rows of one IndexedDB table in the app's Dexie database. */
const rows = (page: Page, table: string) => page.evaluate((t) => new Promise<any[]>((resolve, reject) => {
  const open = indexedDB.open('kodigo');
  open.onerror = () => reject(open.error);
  open.onsuccess = () => {
    const req = open.result.transaction(t).objectStore(t).getAll();
    req.onsuccess = () => { open.result.close(); resolve(req.result); };
    req.onerror = () => reject(req.error);
  };
}), table);

test('cross-module pages download no module and start no worker; the palette fetches the index once', async ({ page }) => {
  const urls: string[] = [];
  const workers: string[] = [];
  page.on('request', (r) => urls.push(new URL(r.url()).pathname));
  page.on('worker', (w) => workers.push(w.url()));
  const moduleDownloads = () => urls.filter((u) => /^\/api\/modules\/[^/]+\/files$/.test(u));
  for (const path of ['/settings', '/', '/glossary', '/cheatsheet', '/quiz', '/plan']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    expect(moduleDownloads(), path).toEqual([]);
    expect(workers, path).toEqual([]);
  }

  await page.goto('/settings');
  await page.waitForLoadState('networkidle');
  urls.length = 0;
  expect(urls.filter((u) => u === '/api/index')).toEqual([]);
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('textbox').first()).toBeVisible();
  await page.waitForLoadState('networkidle');
  await expect.poll(() => urls.filter((u) => u === '/api/index').length).toBe(1);
  expect(moduleDownloads()).toEqual([]);
});

test('Settings shows the storage status', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.getByTestId('storage-status')).toContainText('Storage:');
});

test('a hand-worked mock exam resumes after a reload, warns before leaving and confirms blanks', async ({ page }) => {
  const dialogs: { type: string; message: string }[] = [];
  page.on('dialog', async (d) => { dialogs.push({ type: d.type(), message: d.message() }); await d.accept(); });
  await page.goto(`/m/${EXAM_MODULE}/exam`);
  await page.getByText('Work it out by hand').click();
  const start = page.getByTestId('exam-start');
  await expect(start).toBeEnabled({ timeout: 30_000 });
  await start.click();
  await expect(page.getByTestId('exam-tools')).toBeVisible();

  const key = `kodigo-exam-attempt:${EXAM_MODULE}`;
  const saved = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), key);
  await expect.poll(saved).not.toBeNull();
  const answer = page.getByRole('textbox', { name: 'answer' }).first();
  await answer.fill('7');
  await expect.poll(async () => JSON.stringify((await saved()).responses)).toContain('7');
  const before = await saved();

  await page.reload();
  await expect(page.getByTestId('exam-tools')).toBeVisible({ timeout: 30_000 });
  expect(dialogs.some((d) => d.type === 'beforeunload')).toBe(true);
  const after = await saved();
  expect(after.seed).toBe(before.seed);
  expect(after.startedAt).toBe(before.startedAt);
  expect(after.current).toBe(before.current);
  await expect(page.getByRole('textbox', { name: 'answer' }).first()).toHaveValue('7');

  const submit = page.getByTestId('exam-submit');
  await submit.click();
  await expect.poll(() => dialogs.some((d) => d.type === 'confirm' && /unanswered and will score 0/.test(d.message))).toBe(true);
  await expect.poll(saved).toBeNull();
});

test('a submitted coding exam saves one exam-coding attempt and leaves mastery and SRS alone', async ({ page }) => {
  test.setTimeout(5 * 60_000);
  await page.goto(`/m/${EXAM_MODULE}/exam`);
  await expect(page.getByText('Python ready')).toBeVisible({ timeout: 120_000 });
  await page.getByTestId('coding-start').click();
  await page.getByTestId('coding-submit').click();
  await expect.poll(async () => (await rows(page, 'attempts')).filter((a) => a.mode === 'exam-coding').length, { timeout: 120_000 }).toBe(1);
  const [row] = (await rows(page, 'attempts')).filter((a) => a.mode === 'exam-coding');
  expect(row.key).toBe(`${EXAM_MODULE}/exam-coding`);
  expect(row.response.perProblem.length).toBeGreaterThan(0);
  expect(await rows(page, 'mastery')).toEqual([]);
  expect(await rows(page, 'srs')).toEqual([]);

  await page.reload();
  await expect(page.getByTestId('coding-previous')).toContainText('Previous attempts');
});

test('the built app runs with no CSP violations: logic worker, KaTeX and Pyodide', async ({ page }) => {
  test.setTimeout(3 * 60_000);
  const problems: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error' || /content security policy/i.test(m.text())) problems.push(m.text()); });
  page.on('pageerror', (e) => problems.push(e.message));
  await page.goto('/m/cost-concepts/math-code/manufacturing-cost');
  await expect(page.locator('.katex:visible').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('92,400').first()).toBeVisible({ timeout: 15_000 }); // computed by logic.js in the worker
  await page.goto(`/m/${EXAM_MODULE}/exam`);
  await expect(page.getByText('Python ready')).toBeVisible({ timeout: 120_000 });
  await page.getByTestId('coding-start').click();
  await page.getByRole('button', { name: /^Run/ }).first().click();
  await page.waitForTimeout(3000);
  expect(problems).toEqual([]);
});

test('KaTeX renders math-code anchors through the \\htmlClass trust rule', async ({ page }) => {
  await page.goto(ANCHOR_PAGE);
  await expect(page.locator('.katex:visible').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.katex [class*="kanc-"]').first()).toBeAttached({ timeout: 15_000 });
  await expect(page.locator('.katex-error')).toHaveCount(0);
});
