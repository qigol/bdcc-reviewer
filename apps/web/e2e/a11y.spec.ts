import { expect, test } from '@playwright/test';

// Audit A1–A3: plots work from the keyboard, correctness isn't colour-only, charts have text alternatives.
// Before the fix nothing in a plot was focusable, cues were colour alone, and labels read "chart" or "vector plot".

test('FunctionPlot: a focusable slider with a value, moved by the arrow keys', async ({ page }) => {
  await page.goto('/m/neural-networks/intuition/activation-bend');
  const handle = page.getByRole('slider').first();
  await expect(handle).toBeVisible({ timeout: 15_000 });
  await expect(handle).toHaveAttribute('aria-valuetext', /x = .*, f = /);
  const before = Number(await handle.getAttribute('aria-valuenow'));
  await handle.focus();
  await expect(handle).toBeFocused();
  const beat = page.getByRole('button', { name: 'Back' });
  const backWasDisabled = await beat.isDisabled();
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => Number(await handle.getAttribute('aria-valuenow'))).toBeCloseTo(before + 0.08, 5);
  expect(await beat.isDisabled()).toBe(backWasDisabled); // the key moved the handle, not the lesson // 1/100 of a domain of 8
  await page.keyboard.press('Shift+ArrowLeft');
  await expect.poll(async () => Number(await handle.getAttribute('aria-valuenow'))).toBeCloseTo(before + 0.08 - 0.8, 5);
  await page.keyboard.press('End');
  await expect.poll(async () => Number(await handle.getAttribute('aria-valuenow'))).toBe(4);
  await page.keyboard.press('Home');
  await expect.poll(async () => Number(await handle.getAttribute('aria-valuenow'))).toBe(-4);
});

test('VectorPlot: tips are focusable, arrow keys move them and the move is announced; pointer drags still snap', async ({ page }) => {
  await page.goto('/m/lf-cf/intuition/hidden-tastes');
  const tip = page.locator('circle[aria-roledescription="draggable point"]').first();
  await expect(tip).toBeAttached({ timeout: 15_000 });
  const label = async () => (await tip.getAttribute('aria-label')) ?? '';
  const coords = async () => (await label()).match(/at (-?[\d.]+), (-?[\d.]+)$/)!.slice(1).map(Number);
  const [x0, y0] = await coords();
  await tip.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowUp');
  await expect.poll(coords).toEqual([Math.round((x0 + 0.1) * 10) / 10, Math.round((y0 + 0.1) * 10) / 10]);
  await expect(page.locator('[aria-live=polite]').filter({ hasText: / at / }).first()).toContainText(' at ');

  // the pointer path is unchanged: dragging moves the tip, snapped to 0.1
  const box = (await tip.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 - 30, { steps: 4 });
  await page.mouse.up();
  const [x1, y1] = await coords();
  expect(x1).toBeGreaterThan(x0);
  expect(y1).toBeGreaterThan(y0);
  expect(Number.isInteger(Math.round(x1 * 1e6) / 1e5)).toBe(true);
  expect(Number.isInteger(Math.round(y1 * 1e6) / 1e5)).toBe(true);
});

test('Chart: a descriptive label and a data table', async ({ page }) => {
  await page.goto('/m/class-imbalance/intuition/lazy-model');
  const chart = page.locator('svg[role=img]').first();
  await expect(chart).toBeVisible({ timeout: 15_000 });
  const name = (await chart.getAttribute('aria-label')) ?? '';
  expect(name).not.toBe('chart');
  expect(name.length).toBeGreaterThan(3);
  const details = page.locator('details', { hasText: 'Data table' }).first();
  await details.locator('summary').click();
  await expect(details.locator('table tbody tr').first()).toBeVisible();
});

test('DropBins and quiz status: words and glyphs, not colour alone', async ({ page }) => {
  await page.goto('/m/abc/intuition/worth-it');
  const chip = page.locator('button[aria-roledescription="draggable"]').first();
  await expect(chip).toBeVisible({ timeout: 15_000 });
  await chip.click();
  await page.locator('.card div.border-dashed').nth(1).click();
  await expect(page.locator('button[aria-label$=": correct"], button[aria-label$=": incorrect"]').first()).toBeVisible();

  await page.goto('/quiz?modules=fim&count=3&mode=practice&start=1');
  await page.getByTestId('question').waitFor({ timeout: 15_000 });
  await expect(page.getByTestId('quiz-dot').first()).toHaveAttribute('aria-label', 'question 1: not answered');
});
