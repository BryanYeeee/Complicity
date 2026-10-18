import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.WORLD_BEYOND_URL || 'http://127.0.0.1:4177/';
const browser = await chromium.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
});
const outputDir = path.resolve('screenshots');
await fs.mkdir(outputDir, { recursive: true });
const reports = [];

async function assertLayout(page, label) {
  const metrics = await page.evaluate(() => {
    const stage = document.querySelector('.world-stage').getBoundingClientRect();
    const assistant = document.querySelector('.assistant').getBoundingClientRect();
    return {
      viewport: [innerWidth, innerHeight],
      documentOverflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight,
      stageHeight: Math.round(stage.height),
      stageRatio: Number((stage.height / innerHeight).toFixed(3)),
      assistantBottom: Math.round(assistant.bottom),
      inputVisible: Boolean(document.querySelector('#prompt-input')?.offsetParent),
      canvas: [document.querySelector('canvas')?.width, document.querySelector('canvas')?.height],
    };
  });
  if (metrics.documentOverflow) throw new Error(`${label}: document overflow`);
  if (metrics.stageRatio < 0.55) throw new Error(`${label}: world stage below 55% (${metrics.stageRatio})`);
  if (metrics.assistantBottom > metrics.viewport[1] + 1) throw new Error(`${label}: assistant clipped`);
  reports.push({ label, ...metrics });
}

async function begin(page) {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'BEGIN DEVELOPMENT' }).click();
  await page.locator('[data-action-id="housing_cottages"], [data-action-id="housing_depot"]').first().waitFor();
}

async function choose(page, actionId, nextId, typed) {
  if (typed) {
    await page.locator('#prompt-input').fill(typed);
    await page.locator('#prompt-input').press('Enter');
  } else {
    await page.locator(`[data-action-id="${actionId}"]`).click();
  }
  if (nextId) await page.locator(`[data-action-id="${nextId}"]`).waitFor({ state: 'visible', timeout: 8000 });
}

async function expansionRun() {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
  await begin(page); await assertLayout(page, '1280x720 opening gameplay');
  await page.screenshot({ path: path.join(outputDir, 'opening-1280x720.png') });
  await choose(page, 'housing_cottages', 'water_intake');
  await choose(page, 'water_intake', 'energy_grid', 'Give everyone clean water');
  await choose(page, 'energy_grid', 'materials_extract');
  await choose(page, 'materials_extract', 'road_widen', 'Build a factory');
  await choose(page, 'road_widen', 'arrivals_adapt');
  await choose(page, 'arrivals_adapt', 'river_local', 'Adapt the community hall');
  await page.screenshot({ path: path.join(outputDir, 'middle-expansion-1280x720.png') });
  await choose(page, 'river_local', 'gather_clinic', 'Protect our water');
  await choose(page, 'gather_clinic', 'capacity_expand');
  await choose(page, 'capacity_expand', 'final_expand');
  await choose(page, 'final_expand', null);
  await page.locator('.ending-copy.show-actions').waitFor({ state: 'visible', timeout: 20000 });
  await page.screenshot({ path: path.join(outputDir, 'final-expansion-1280x720.png') });
  const state = await page.evaluate(() => window.__WORLD_BEYOND__.getState());
  reports.push({ label: 'expansion final', progress: state.progress, ledger: state.ledger.length, pinebank: state.regions.pinebank, reedbank: state.regions.reedbank, corridor: state.regions.corridor });
  await page.getByRole('button', { name: 'VIEW THE WORLD' }).click();
  await page.getByRole('button', { name: 'Restore ending' }).waitFor();
  await page.getByRole('button', { name: 'Restore ending' }).click();
  await page.getByRole('button', { name: 'PLAY AGAIN' }).click();
  await page.getByRole('button', { name: 'BEGIN DEVELOPMENT' }).waitFor();
  const replay = await page.evaluate(() => window.__WORLD_BEYOND__.getState());
  if (replay.progress !== 5 || replay.ledger.length !== 0) throw new Error('Replay retained prior state');
  await page.close();
}

async function carefulRun() {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
  await begin(page);
  await choose(page, 'housing_depot', 'water_intake', 'Use the empty depot');
  await choose(page, 'water_conservation', 'energy_grid');
  await choose(page, 'energy_efficiency', 'materials_extract', 'Reduce evening demand');
  await choose(page, 'materials_reclaim', 'road_bridge');
  await choose(page, 'road_light', 'delegation_facilities');
  await choose(page, 'delegation_facilities', 'river_local');
  await choose(page, 'river_restore', 'gather_clinic', 'Restore the river');
  await choose(page, 'gather_expand', 'capacity_expand');
  await choose(page, 'capacity_shared', 'final_expand');
  await choose(page, 'final_reuse', null);
  await page.locator('.ending-copy.show-actions').waitFor({ state: 'visible', timeout: 20000 });
  await page.screenshot({ path: path.join(outputDir, 'final-careful-1280x720.png') });
  const state = await page.evaluate(() => window.__WORLD_BEYOND__.getState());
  reports.push({ label: 'careful final', progress: state.progress, ledger: state.ledger.length, pinebank: state.regions.pinebank, reedbank: state.regions.reedbank, corridor: state.regions.corridor });
  await page.close();
}

async function viewportChecks() {
  const sizes = [[1920, 1080], [1366, 768], [1024, 600], [800, 600], [2560, 1080]];
  for (const [width, height] of sizes) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    await begin(page); await assertLayout(page, `${width}x${height} gameplay`);
    if ((width === 1024 && height === 600) || (width === 2560 && height === 1080)) {
      await page.screenshot({ path: path.join(outputDir, `gameplay-${width}x${height}.png`) });
    }
    await page.close();
  }
}

async function mixedRun() {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, reducedMotion: 'no-preference' });
  await begin(page);
  await page.locator('#prompt-input').fill('Make the moon closer');
  await page.locator('#prompt-input').press('Enter');
  await page.getByText('I could not map that request').waitFor();
  let state = await page.evaluate(() => window.__WORLD_BEYOND__.getState());
  if (state.progress !== 5 || await page.locator('#prompt-input').inputValue() !== 'Make the moon closer') throw new Error('Unsupported input mutated state or was cleared');

  await page.locator('#prompt-input').fill('Build homes or convert the depot');
  await page.locator('#prompt-input').press('Enter');
  await page.getByText('I found more than one possible method').waitFor();
  state = await page.evaluate(() => window.__WORLD_BEYOND__.getState());
  if (state.progress !== 5) throw new Error('Ambiguous input advanced the story');

  await page.evaluate(() => { const button = document.querySelector('[data-action-id="housing_cottages"]'); button.click(); button.click(); });
  await page.locator('[data-action-id="water_conservation"]').waitFor();
  state = await page.evaluate(() => window.__WORLD_BEYOND__.getState());
  if (state.progress !== 13 || state.ledger.length !== 1) throw new Error('Rapid repeat committed more than once');
  await choose(page, 'water_conservation', 'energy_grid', 'Repair the pipes');

  await page.locator('[data-action-id="energy_rooftop"]').click();
  await page.setViewportSize({ width: 1024, height: 600 });
  await page.locator('[data-action-id="materials_managed"]').waitFor({ timeout: 8000 });
  await assertLayout(page, 'resize during construction');
  await choose(page, 'materials_managed', 'road_bridge', 'Selective logging');
  await choose(page, 'road_bridge', 'delegation_facilities');
  await choose(page, 'delegation_connection', 'river_local', 'Connect Reedbank');
  await choose(page, 'river_maintenance', 'gather_clinic');
  await choose(page, 'gather_adapt', 'capacity_expand', 'Adapt the unused structure');
  await choose(page, 'capacity_retrofit', 'final_expand');
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.locator('[data-action-id="final_repair"]').click();
  await page.locator('.experience[data-phase="revealing"]').waitFor({ timeout: 7000 });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.locator('.ending-copy.show-actions').waitFor({ timeout: 25000 });
  state = await page.evaluate(() => window.__WORLD_BEYOND__.getState());
  if (state.progress !== 100 || state.ledger.length !== 10) throw new Error('Mixed route did not complete');
  reports.push({ label: 'mixed route', progress: state.progress, ledger: state.ledger.length, resizedDuringConstruction: true, resizedDuringReveal: true });
  await page.close();
}

try {
  await expansionRun();
  await carefulRun();
  await mixedRun();
  await viewportChecks();
  console.log(JSON.stringify({ ok: true, reports }, null, 2));
} finally {
  await browser.close();
}

