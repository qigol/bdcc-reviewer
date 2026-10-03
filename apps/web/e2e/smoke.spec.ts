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
      if (s.trace) {
        // stepping moves the live data next to the code and drives it with the trace's ops
        await page.getByTestId('step-through').click();
        for (let k = 0; k < 3; k++) await page.locator('button:has-text("▶")').click();
        await expect(page.getByTestId('live-trace')).toBeVisible();
        await expect(page.getByTestId('vars-watch').locator('span.font-mono').first()).toBeVisible();
      }
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

test('quiz progress survives the nudge popup, the glossary and leaving the page', async ({ page }) => {
  const errors = collectErrors(page);
  const id = modules[0];
  await page.goto(`/quiz?modules=${id}&count=5&mode=practice&start=1`);
  await page.getByTestId('question').waitFor({ timeout: 15_000 });
  await expect(page.getByText("Couldn't generate")).toHaveCount(0);
  const metaText = async () => (await page.getByTestId('question-meta').textContent().catch(() => '')) ?? '';
  await expect.poll(metaText).not.toMatch(/Seed\s*·/);

  // answer question 1 and move on to question 2
  const q1 = await metaText();
  const radio = await page.$('[role=radio]'); if (radio) await radio.click();
  const check = await page.$('[role=checkbox]'); if (check) await check.click();
  const num = await page.$('input[aria-label=answer]'); if (num) await num.fill('1');
  for (const b of await page.$$('input[aria-label^="blank"]')) await b.fill('x');
  for (let k = 0; k < 8; k++) { const s = await page.$('button:has-text("Show step")'); if (!s) break; await s.click(); await page.waitForTimeout(100); }
  for (const s of await page.$$('input[aria-label$="answer"]')) if (!(await s.inputValue())) await s.fill('1');
  await page.getByTestId('submit-answer').click();
  await page.getByTestId('next-question').click();
  await expect(page.getByText('Question 2 of 5')).toBeVisible();
  await expect.poll(metaText).not.toBe(q1);
  const q2 = await metaText();

  // glossary opens in a popup over the quiz; closing it leaves the quiz untouched
  await page.getByTestId('quiz-glossary').click();
  await expect(page.getByTestId('popup')).toBeVisible();
  await expect(page.frameLocator('[data-testid=popup] iframe').getByRole('heading', { name: 'Glossary' })).toBeVisible({ timeout: 15_000 });
  await page.getByTestId('popup-close').click();
  await expect(page.getByTestId('popup')).toHaveCount(0);
  await expect(page.getByText('Question 2 of 5')).toBeVisible();
  expect(await metaText()).toBe(q2);

  // top-bar Glossary also opens the popup while a quiz is running
  await page.locator('header').getByRole('button', { name: 'Glossary' }).click();
  await expect(page.getByTestId('popup')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('popup')).toHaveCount(0);

  // nudge (when this question has a lesson) opens the lesson in the popup
  if (await page.getByTestId('nudge').count()) {
    await page.getByTestId('nudge').click();
    await expect(page.getByTestId('popup')).toBeVisible();
    await page.getByTestId('popup-close').click();
    await expect(page.getByText('Question 2 of 5')).toBeVisible();
  }

  // even actually leaving the page and coming back resumes where you were
  await page.goto('/glossary');
  await page.goBack();
  await expect(page.getByText('Question 2 of 5')).toBeVisible({ timeout: 15_000 });
  await expect.poll(metaText).toBe(q2);
  await expect(page.locator('button[aria-label="question 1"]')).not.toHaveClass(/bg-line/);

  // and the quiz builder offers to resume it
  await page.goto('/quiz');
  await expect(page.getByTestId('resume-quiz')).toContainText('1 of 5 answered');
  await page.getByTestId('resume-quiz').getByRole('button', { name: 'Resume' }).click();
  await expect(page.getByText('Question 2 of 5')).toBeVisible({ timeout: 15_000 });
  expect(errors).toEqual([]);
});

test('modules are grouped by course: top-bar course menu and course-scoped quizzes', async ({ page, request }) => {
  const errors = collectErrors(page);
  const list: { id: string; enabled: boolean; course: string; shortTitle: string }[] = await (await request.get('/api/modules')).json();
  const enabled = list.filter((m) => m.enabled);
  expect(enabled.every((m) => typeof m.course === 'string' && m.course.length > 0)).toBe(true);
  const course = enabled[0].course;
  const inCourse = enabled.filter((m) => m.course === course);

  // the header has one dropdown per course instead of a tab per module
  await page.goto('/');
  const header = page.locator('header');
  await expect(header.getByTestId('course-menu')).toHaveCount(new Set(enabled.map((m) => m.course)).size);
  for (const m of enabled) await expect(header.getByRole('link', { name: m.shortTitle, exact: true })).toHaveCount(0);
  const trigger = header.locator(`[data-testid=course-menu][data-course="${course}"]`);
  await trigger.click();
  const menu = page.getByRole('menu', { name: `${course} modules` });
  await expect(menu.getByRole('menuitem')).toHaveCount(inCourse.length + 1); // modules + "Quiz on <course>"
  await menu.getByRole('menuitem').filter({ hasText: inCourse[0].shortTitle }).first().click();
  await expect(page).toHaveURL(new RegExp(`/m/${inCourse[0].id}/`));
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(trigger).toContainText(inCourse[0].shortTitle);
  await expect(page.getByTestId('module-course')).toContainText(course);

  // keyboard: open, move, Escape closes and returns focus
  await trigger.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(trigger).toBeFocused();

  // "Quiz on <course>" opens the builder on that course with only its modules
  await trigger.click();
  await page.getByRole('menuitem', { name: `Quiz on ${course}` }).click();
  await expect(page).toHaveURL(/\/quiz\?course=/);
  await expect(page.getByTestId('quiz-course').getByRole('radio', { checked: true })).toContainText(course);
  await page.getByTestId('start-quiz').click();
  await expect(page.getByTestId('question')).toBeVisible({ timeout: 15_000 });
  const sessions = await page.evaluate(() => JSON.parse(sessionStorage.getItem('kodigo-sessions') ?? '{}'));
  const latest: any = Object.values(sessions).sort((a: any, b: any) => b.createdAt - a.createdAt)[0];
  expect(latest.course).toBe(course);
  const ids = new Set(inCourse.map((m) => m.id));
  expect(latest.items.every((it: any) => ids.has(it.moduleId))).toBe(true);
  expect(errors).toEqual([]);
});
