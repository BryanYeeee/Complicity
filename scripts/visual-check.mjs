import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.WORLD_BEYOND_URL || 'http://127.0.0.1:5173/';
const browser = await chromium.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true, args: ['--no-sandbox', '--disable-gpu'] });
const outputDir = path.resolve('screenshots'); await fs.mkdir(outputDir, { recursive: true });
const reports = []; const errors = [];

async function begin(page) {
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(baseURL, { waitUntil: 'networkidle' }); await page.getByRole('button', { name: 'BEGIN DEVELOPMENT' }).click(); await page.locator('#prompt-input:not([disabled])').waitFor();
  const initial = await page.evaluate(() => ({ state: window.__WORLD_BEYOND__.getState(), development: window.__WORLD_BEYOND__.development(), choices: window.__WORLD_BEYOND__.choices() }));
  if (initial.state.world.buildings.length || initial.state.people.residents.length || initial.development !== 0 || initial.choices.length) throw new Error(`Invalid undeveloped start: ${JSON.stringify(initial)}`);
}

async function send(page, text) { await page.locator('#prompt-input:not([disabled])').fill(text); await page.locator('#prompt-input').press('Enter'); }
async function expectNoChoices(page, label) { const choices = await page.evaluate(() => window.__WORLD_BEYOND__.choices()); if (choices.length) throw new Error(`${label}: options appeared without a new proposal: ${choices.join(', ')}`); }

async function propose(page, text, expected) {
  await send(page, text); await page.waitForFunction((labels) => labels.every((label) => window.__WORLD_BEYOND__.choices().includes(label)), expected, { timeout: 5000 });
}

async function waitForCommit(page, revision) {
  await page.waitForFunction((before) => window.__WORLD_BEYOND__.getState().revision > before, revision, { timeout: 8000 });
  await page.locator('#prompt-input:not([disabled])').waitFor({ timeout: 8000 }); await page.locator('.work-caption:not(.visible)').waitFor({ timeout: 8000 });
}

async function chooseProject(page, label, { double = false } = {}) {
  const revision = await page.evaluate(() => window.__WORLD_BEYOND__.getState().revision);
  await page.locator('.quick-actions').getByRole('button', { name: label, exact: true }).click();
  const confirm = page.locator('.quick-actions').getByRole('button', { name: 'Confirm project', exact: true }); await confirm.waitFor();
  if (double) await confirm.evaluate((element) => { element.click(); element.click(); }); else await confirm.click();
  await waitForCommit(page, revision); await expectNoChoices(page, `${label} completion`);
}

async function chooseAction(page, label) {
  const revision = await page.evaluate(() => window.__WORLD_BEYOND__.getState().revision); await page.locator('.quick-actions').getByRole('button', { name: label, exact: true }).click(); await waitForCommit(page, revision); await expectNoChoices(page, `${label} completion`);
}

async function welcome(page) { await send(page, 'Let us welcome residents'); await page.locator('.quick-actions').getByRole('button', { name: 'Welcome residents', exact: true }).waitFor(); await chooseAction(page, 'Welcome residents'); }
async function trade(page) { await propose(page, 'We need more materials', ['Trade for materials']); await chooseAction(page, 'Trade for materials'); }

async function verifyStickyPlacement(page) {
  await propose(page, 'We need housing', ['Build cottages', 'Build apartments']);
  await page.locator('.quick-actions').getByRole('button', { name: 'Build apartments', exact: true }).click();
  const initial = await page.evaluate(() => window.__WORLD_BEYOND__.placement()); if (initial.mode !== 'selected' || !initial.valid) throw new Error(`CIVIC did not select a valid default: ${JSON.stringify(initial)}`);
  const other = initial.plotId === 'plot-home-1' ? 'plot-home-6' : 'plot-home-1'; const point = await page.evaluate((id) => window.__WORLD_BEYOND__.screenForPlot(id), other);
  await page.mouse.move(point.x, point.y); await page.mouse.move(1300, 760);
  if ((await page.evaluate(() => window.__WORLD_BEYOND__.placement().plotId)) !== initial.plotId) throw new Error('Selected placement followed the pointer into chat');
  await page.locator('.quick-actions').getByRole('button', { name: 'Change location', exact: true }).click(); await page.waitForFunction(() => window.__WORLD_BEYOND__.placement().mode === 'preview');
  await page.mouse.move(point.x, point.y); await page.mouse.click(point.x, point.y); await page.waitForFunction((id) => window.__WORLD_BEYOND__.placement().mode === 'selected' && window.__WORLD_BEYOND__.placement().plotId === id, other);
  await page.mouse.move(1370, 780); if ((await page.evaluate(() => window.__WORLD_BEYOND__.placement().plotId)) !== other) throw new Error('Clicked placement did not remain fixed');
  const revision = await page.evaluate(() => window.__WORLD_BEYOND__.getState().revision); await page.getByRole('button', { name: 'Confirm project', exact: true }).click(); await waitForCommit(page, revision); await expectNoChoices(page, 'housing completion');
}

async function verifyProposalReplacement(page) {
  await propose(page, 'We should encourage trade', ['Open a market', 'Build a trading depot']); await page.getByRole('button', { name: 'Open a market', exact: true }).click();
  const oldConfirm = await page.getByRole('button', { name: 'Confirm project', exact: true }).elementHandle(); const revision = await page.evaluate(() => window.__WORLD_BEYOND__.getState().revision);
  await send(page, 'Actually, build a workshop'); await page.waitForFunction(() => window.__WORLD_BEYOND__.placement()?.type === 'workshop');
  await oldConfirm.evaluate((element) => element.click()); await page.waitForTimeout(250);
  const afterOld = await page.evaluate(() => ({ revision: window.__WORLD_BEYOND__.getState().revision, placement: window.__WORLD_BEYOND__.placement() }));
  if (afterOld.revision !== revision || afterOld.placement.type !== 'workshop') throw new Error(`Outdated market confirmation executed: ${JSON.stringify(afterOld)}`);
  await page.getByRole('button', { name: 'Confirm project', exact: true }).click(); await waitForCommit(page, revision); await expectNoChoices(page, 'replacement completion');
}

async function finishAndReport(page, label, screenshot) {
  await page.locator('.ending-copy.show-actions').waitFor({ timeout: 22000 }); const result = await page.evaluate(() => ({ status: window.__WORLD_BEYOND__.status(), development: window.__WORLD_BEYOND__.development(), state: window.__WORLD_BEYOND__.getState() }));
  if (!result.status.complete || result.development !== 100 || result.status.population !== result.state.people.residents.length) throw new Error(`${label} inconsistent ending: ${JSON.stringify(result)}`);
  reports.push({ label, development: result.development, population: result.status.population, residents: result.state.people.residents.map((item) => `${item.id}:${item.homeId}`), buildings: result.state.world.buildings.map((item) => `${item.type}:${item.plotId}`), regions: result.state.regions });
  await page.screenshot({ path: path.join(outputDir, screenshot), fullPage: true }); await page.close();
}

async function routeOne() {
  const page = await browser.newPage({ viewport: { width: 1440, height: 820 }, reducedMotion: 'reduce' }); await begin(page);
  await send(page, 'What should we do first?'); await expectNoChoices(page, 'question');
  await propose(page, 'We need housing', ['Build cottages', 'Build apartments']); const revision = await page.evaluate(() => window.__WORLD_BEYOND__.getState().revision); const resources = await page.evaluate(() => window.__WORLD_BEYOND__.getState().resources);
  await page.getByRole('button', { name: 'Build cottages', exact: true }).click(); await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  const cancelled = await page.evaluate(() => ({ revision: window.__WORLD_BEYOND__.getState().revision, resources: window.__WORLD_BEYOND__.getState().resources })); if (cancelled.revision !== revision || JSON.stringify(cancelled.resources) !== JSON.stringify(resources)) throw new Error('Cancellation changed authoritative state');
  await verifyStickyPlacement(page); await welcome(page);
  await propose(page, 'We need clean water', ['Add a water supply', 'Build a water loop']); await chooseProject(page, 'Add a water supply', { double: true });
  await verifyProposalReplacement(page);
  await propose(page, 'We need more housing', ['Build cottages', 'Build apartments']); await chooseProject(page, 'Build apartments'); await welcome(page);
  await propose(page, 'We need dependable power', ['Install solar power', 'Raise a wind turbine']); await chooseProject(page, 'Raise a wind turbine');
  await propose(page, 'We need timber production', ['Open a logging yard']); await chooseProject(page, 'Open a logging yard');
  await trade(page);
  await propose(page, 'We need a public space', ['Create a public garden']); await chooseProject(page, 'Create a public garden');
  await finishAndReport(page, 'relocation and production route', 'fixes-final-route-one.png');
}

async function routeTwo() {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' }); await begin(page);
  await propose(page, 'We need simple housing', ['Build cottages', 'Build apartments']); await chooseProject(page, 'Build cottages'); await welcome(page);
  await propose(page, 'The settlement needs a large water system', ['Install a water pump']); await chooseProject(page, 'Install a water pump');
  await propose(page, 'We should encourage trade', ['Open a market', 'Build a trading depot']); await chooseProject(page, 'Open a market');
  await propose(page, 'We need apartments', ['Build apartments']); await chooseProject(page, 'Build apartments'); await propose(page, 'We still need housing', ['Build cottages']); await chooseProject(page, 'Build cottages');
  await welcome(page); await welcome(page); await trade(page);
  await propose(page, 'We need solar energy', ['Install solar power']); await chooseProject(page, 'Install solar power');
  await propose(page, 'We need a shared public space', ['Create a public garden']); await chooseProject(page, 'Create a public garden');
  await finishAndReport(page, 'trade and water-pump route', 'fixes-final-route-two.png');
}

async function routeThree() {
  const page = await browser.newPage({ viewport: { width: 1180, height: 700 }, reducedMotion: 'reduce' }); await begin(page);
  await propose(page, 'We need compact housing', ['Build apartments']); await chooseProject(page, 'Build apartments'); await welcome(page);
  await propose(page, 'Use an efficient water loop', ['Build a water loop']); await chooseProject(page, 'Build a water loop');
  await propose(page, 'We should manufacture things', ['Open a workshop', 'Build a factory']); await chooseProject(page, 'Build a factory');
  await propose(page, 'Add more apartments', ['Build apartments']); await chooseProject(page, 'Build apartments'); await welcome(page);
  await trade(page); await propose(page, 'Wind power would suit us', ['Raise a wind turbine']); await chooseProject(page, 'Raise a wind turbine');
  await propose(page, 'We need a public garden', ['Create a public garden']); await chooseProject(page, 'Create a public garden');
  await finishAndReport(page, 'manufacturing route', 'fixes-final-route-three.png');
}

async function responsiveChecks() {
  for (const [width, height] of [[1024, 700], [760, 700], [430, 760]]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' }); await begin(page); if (width <= 760) { await page.getByRole('button', { name: /CIVIC/ }).click(); await page.locator('.experience:not(.chat-collapsed)').waitFor(); }
    const metrics = await page.evaluate(() => { const objective = document.querySelector('.objective-card').getBoundingClientRect(); const development = document.querySelector('.development-card').getBoundingClientRect(); const dashboard = document.querySelector('.society-dashboard').getBoundingClientRect(); return { overflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight, objective: [objective.left, objective.top, objective.right, objective.bottom], development: [development.left, development.top, development.right, development.bottom], dashboard: [dashboard.left, dashboard.top, dashboard.right, dashboard.bottom], statsFit: [...document.querySelectorAll('.society-dashboard .stat')].every((item) => item.getBoundingClientRect().right <= dashboard.right + 1) }; });
    if (metrics.overflow || !metrics.statsFit) throw new Error(`${width}: invalid responsive layout ${JSON.stringify(metrics)}`); reports.push({ label: `${width}x${height}`, ...metrics }); await page.screenshot({ path: path.join(outputDir, `fixes-responsive-${width}x${height}.png`) }); await page.close();
  }
}

try {
  const route = process.env.WORLD_BEYOND_ROUTE || 'all'; if (route === 'all' || route === 'one') await routeOne(); if (route === 'all' || route === 'two') await routeTwo(); if (route === 'all' || route === 'three') await routeThree(); if (route === 'all' || route === 'responsive') await responsiveChecks();
  if (errors.length) throw new Error(`Browser console errors: ${errors.join(' | ')}`); console.log(JSON.stringify({ ok: true, reports, consoleErrors: errors }, null, 2));
} finally { await browser.close(); }
