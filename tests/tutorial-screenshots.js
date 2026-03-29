/**
 * Tutorial screenshot capture — mobile (390x844 = iPhone 14)
 * Run: node tests/tutorial-screenshots.js
 * Output: screenshots/tutorial/step-N-*.png
 */

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.join(__dirname, '..', 'screenshots', 'tutorial');
fs.mkdirSync(OUT_DIR, { recursive: true });

const IPHONE = { width: 390, height: 844 };

async function shot(page, name) {
  const file = path.join(OUT_DIR, name);
  await page.screenshot({ path: file, fullPage: false });
  console.log('  saved:', file);
}

async function waitForStep(page, n) {
  await page.waitForFunction(
    (step) => {
      const label = document.querySelector('.tutorial-step-label');
      return label && label.textContent.trim().startsWith(`Step ${step}`);
    },
    n,
    { timeout: 10000 }
  );
  await page.waitForTimeout(400); // let spotlight settle
}

async function dismissTutorial(page) {
  // Force-dismiss without interacting so we can see the game page cleanly
  await page.evaluate(() => {
    if (typeof endTutorial === 'function') endTutorial();
  });
  await page.waitForTimeout(200);
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: IPHONE });
  const page = await context.newPage();

  // Suppress localStorage so we always get a fresh game
  await context.addInitScript(() => localStorage.clear());

  await page.goto('http://localhost:8080');
  await page.waitForSelector('#intro-screen', { state: 'visible' });

  // ── Intro screen ─────────────────────────────────────────────
  await shot(page, 'step-0-intro.png');
  console.log('Step 0: intro screen');

  // Start game
  await page.click('button:has-text("New Production")');
  await page.waitForSelector('#app', { state: 'visible' });
  await page.waitForTimeout(500);

  // ── Step 1: Welcome ───────────────────────────────────────────
  await waitForStep(page, 1);
  await shot(page, 'step-1-welcome.png');
  console.log('Step 1: Welcome to OK Factory');

  // Click NEXT
  await page.click('.tutorial-card-footer .btn-primary');
  await page.waitForTimeout(300);

  // ── Step 2: Power / Crank (locked) ───────────────────────────
  await waitForStep(page, 2);
  await shot(page, 'step-2-power-locked.png');
  console.log('Step 2: Power — locked (Next disabled)');

  // Satisfy the condition: set manualPower >= 13 directly in game state
  // then trigger checkTutorialCondition so the step advances
  await page.evaluate(() => {
    gameState.manualPower = 15;
    checkTutorialCondition();
  });
  await page.waitForTimeout(300);

  // Take a screenshot just before the step advances (button should be enabled)
  // Actually it may have already advanced — capture current state
  await shot(page, 'step-2-power-satisfied.png');
  console.log('Step 2: Power — satisfied');

  // ── Step 3: Factory Floor ─────────────────────────────────────
  await waitForStep(page, 3);
  await shot(page, 'step-3-factory-floor.png');
  console.log('Step 3: Navigate to Factories');

  // Navigate via bottom nav (mobile)
  await page.click('.bnav-item[data-page="floors"]');
  await page.waitForTimeout(400);

  // ── Step 4: Place Miner ───────────────────────────────────────
  await waitForStep(page, 4);
  await shot(page, 'step-4-place-miner.png');
  console.log('Step 4: Place a Miner — before');

  // Open first empty slot via JS — tutorial card may intercept pointer events
  await page.evaluate(() => openSlotModal(0, 0));
  await page.waitForSelector('.modal', { state: 'visible' });
  await shot(page, 'step-4-miner-modal.png');
  console.log('Step 4: Miner modal open');

  // Select Miner Mk.I
  await page.selectOption('#modal-machine', { value: 'miner_mk1' });
  await page.waitForTimeout(200);
  // Select Mine Iron Ore recipe
  await page.selectOption('#modal-recipe', { value: 'mine_iron' });
  await page.waitForTimeout(200);
  await shot(page, 'step-4-miner-configured.png');
  console.log('Step 4: Miner configured');
  await page.locator('.modal button:has-text("Save")').click();
  await page.waitForSelector('.modal', { state: 'hidden' });
  await page.waitForTimeout(400);

  // ── Step 5: Place Smelter ─────────────────────────────────────
  await waitForStep(page, 5);
  await shot(page, 'step-5-place-smelter.png');
  console.log('Step 5: Place a Smelter — before');

  await page.evaluate(() => openSlotModal(0, 1));
  await page.waitForSelector('.modal', { state: 'visible' });
  await page.selectOption('#modal-machine', { value: 'smelter' });
  await page.waitForTimeout(200);
  await page.selectOption('#modal-recipe', { value: 'smelt_iron' });
  await page.waitForTimeout(200);
  await shot(page, 'step-5-smelter-configured.png');
  console.log('Step 5: Smelter configured');
  await page.locator('.modal button:has-text("Save")').click();
  await page.waitForSelector('.modal', { state: 'hidden' });
  await page.waitForTimeout(400);

  // ── Step 6: Place Constructor ─────────────────────────────────
  await waitForStep(page, 6);
  await shot(page, 'step-6-place-constructor.png');
  console.log('Step 6: Place a Constructor — before');

  await page.evaluate(() => openSlotModal(0, 2));
  await page.waitForSelector('.modal', { state: 'visible' });
  await page.selectOption('#modal-machine', { value: 'constructor' });
  await page.waitForTimeout(200);
  await page.selectOption('#modal-recipe', { value: 'make_iron_plate' });
  await page.waitForTimeout(200);
  await shot(page, 'step-6-constructor-configured.png');
  console.log('Step 6: Constructor configured');
  await page.locator('.modal button:has-text("Save")').click();
  await page.waitForSelector('.modal', { state: 'hidden' });
  await page.waitForTimeout(400);

  // ── Step 7: First Production Line ────────────────────────────
  await waitForStep(page, 7);
  await shot(page, 'step-7-production-line.png');
  console.log('Step 7: First Production Line!');
  await page.click('.tutorial-card-footer .btn-primary');
  await page.waitForTimeout(300);

  // ── Step 8: What's Next ───────────────────────────────────────
  await waitForStep(page, 8);
  await shot(page, 'step-8-whats-next.png');
  console.log('Step 8: What\'s Next');
  // Click FINISH
  await page.click('.tutorial-card-footer .btn-primary');
  await page.waitForTimeout(500);

  // ── Post-tutorial: game state ─────────────────────────────────
  await shot(page, 'step-9-post-tutorial.png');
  console.log('Step 9: Post-tutorial game view');

  await browser.close();
  console.log('\nAll screenshots saved to', OUT_DIR);
})();
