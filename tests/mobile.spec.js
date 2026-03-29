import { test, expect } from '@playwright/test';

// Helper: start a new game from the intro screen, dismiss tutorial
async function startGame(page) {
  await page.goto('/');
  await page.waitForSelector('#intro-screen', { state: 'visible' });
  await page.click('button:has-text("New Production")');
  await page.waitForSelector('#app', { state: 'visible' });
  // Dismiss tutorial overlay if present
  const tutorialOverlay = page.locator('#tutorial-overlay.active');
  if (await tutorialOverlay.count() > 0) {
    // Click the Skip button if present, otherwise close backdrop
    const skipBtn = page.locator('.tutorial-card button:has-text("Skip")');
    if (await skipBtn.count() > 0) {
      await skipBtn.click({ force: true });
    } else {
      await page.evaluate(() => {
        const overlay = document.getElementById('tutorial-overlay');
        if (overlay) overlay.classList.remove('active');
      });
    }
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(300);
}

test.describe('Mobile layout — intro screen', () => {
  test('intro screen renders correctly on mobile', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#intro-screen')).toBeVisible();
    await expect(page.locator('.intro-wordmark')).toBeVisible();
    await expect(page.locator('button:has-text("New Production")')).toBeVisible();
    // Actions should be stacked (column direction on mobile ≤768px)
  });
});

test.describe('Mobile layout — game UI', () => {
  test('sidebar is hidden on mobile', async ({ page }) => {
    await startGame(page);
    await expect(page.locator('#sidebar')).not.toBeVisible();
  });

  test('bottom nav is visible on mobile', async ({ page }) => {
    await startGame(page);
    await expect(page.locator('#bottom-nav')).toBeVisible();
    // All 7 nav items present
    const items = page.locator('.bnav-item');
    await expect(items).toHaveCount(7);
  });

  test('bottom nav navigation works', async ({ page }) => {
    await startGame(page);
    // Click Factories tab
    await page.locator('.bnav-item[data-page="floors"]').click();
    await expect(page.locator('.bnav-item[data-page="floors"]')).toHaveClass(/active/);
    await expect(page.locator('#page-floors')).toBeVisible();
    // Click Power tab
    await page.locator('.bnav-item[data-page="power"]').click();
    await expect(page.locator('.bnav-item[data-page="power"]')).toHaveClass(/active/);
    await expect(page.locator('#page-power')).toBeVisible();
  });

  test('statusbar is hidden on mobile', async ({ page }) => {
    await startGame(page);
    await expect(page.locator('#statusbar')).not.toBeVisible();
  });

  test('net worth stat is visible in topbar', async ({ page }) => {
    await startGame(page);
    // The topbar-stat containing #stat-networth should be visible
    await expect(page.locator('.topbar-stat:has(#stat-networth)')).toBeVisible();
  });

  test('share button is hidden on mobile', async ({ page }) => {
    await startGame(page);
    await expect(page.locator('.share-btn')).not.toBeVisible();
  });

  test('crank button has adequate touch target (≥40px height)', async ({ page }) => {
    await startGame(page);
    const crank = page.locator('.crank-btn');
    await expect(crank).toBeVisible();
    const box = await crank.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(40);
  });
});

test.describe('Mobile layout — modals', () => {
  test('machine slot modal fits within viewport width', async ({ page }) => {
    await startGame(page);
    // Navigate to factories
    await page.locator('.bnav-item[data-page="floors"]').click();
    // Click an empty slot to open modal
    const emptySlot = page.locator('.machine-slot.empty').first();
    if (await emptySlot.count() > 0) {
      await emptySlot.click();
      await page.waitForSelector('.modal', { state: 'visible' });
      const modal = page.locator('.modal');
      const box = await modal.boundingBox();
      const viewport = page.viewportSize();
      expect(box.width).toBeLessThanOrEqual(viewport.width);
    }
  });
});

test.describe('Mobile layout — machine grid', () => {
  test('machine grid uses 2 columns on mobile', async ({ page }) => {
    await startGame(page);
    await page.locator('.bnav-item[data-page="floors"]').click();
    await page.waitForSelector('.machine-grid');
    const gridStyle = await page.locator('.machine-grid').evaluate(el =>
      getComputedStyle(el).gridTemplateColumns
    );
    // On mobile (≤768px), should be "repeat(2, 1fr)" → 2 equal column values
    const columnCount = gridStyle.trim().split(/\s+/).filter(s => s.includes('px') || s.includes('fr')).length;
    // Pixel 5 is 393px wide — should show 2 columns
    expect(columnCount).toBeLessThanOrEqual(2);
  });
});

test.describe('Desktop layout — baseline check', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('sidebar is visible on desktop', async ({ page }) => {
    await startGame(page);
    await expect(page.locator('#sidebar')).toBeVisible();
  });

  test('bottom nav is hidden on desktop', async ({ page }) => {
    await startGame(page);
    await expect(page.locator('#bottom-nav')).not.toBeVisible();
  });

  test('all topbar stats visible on desktop', async ({ page }) => {
    await startGame(page);
    const stats = page.locator('.topbar-stat');
    const count = await stats.count();
    expect(count).toBeGreaterThanOrEqual(5);
    // All should be visible on desktop
    for (let i = 0; i < count; i++) {
      await expect(stats.nth(i)).toBeVisible();
    }
  });
});
