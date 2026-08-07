import { mkdir, writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

import { steeringKeys } from './playtest-steering.js';

const OUTPUT_DIR = 'artifacts/playtest';
const PLAYTEST_ROUTE = process.env.PLAYTEST_ROUTE === 'ice' ? 'ice' : 'wind';
const PLAYTEST_DURATION = Number(process.env.PLAYTEST_DURATION ?? 180);
const PLAYTEST_URL = process.env.PLAYTEST_URL ?? '/?test=1';
const PLAYTEST_LABEL = process.env.PLAYTEST_LABEL ?? `v0.8-${PLAYTEST_ROUTE}-${PLAYTEST_DURATION}-second`;
const PLAYTEST_ENDURANCE = process.env.PLAYTEST_ENDURANCE === '1';
const ROUTES = {
  wind: { unlock: 'windBladeUnlock', reaction: 'fireTornado' },
  ice: { unlock: 'iceShardUnlock', reaction: 'thermalShock' },
};
const ROUTE = ROUTES[PLAYTEST_ROUTE];
const PICK_PRIORITY = [
  ROUTE.unlock,
  ROUTE.reaction,
  'fireballVolley',
  'windBladeHaste',
  'fleetFooted',
];

async function snapshot(page) {
  return page.evaluate(() => window.__ELEMENTAL_SURVIVOR__.snapshot());
}

async function move(page, keys, duration = 160) {
  for (const key of keys) await page.keyboard.down(key);
  await page.waitForTimeout(duration);
  for (const key of keys) await page.keyboard.up(key);
}

async function chooseUpgrade(page) {
  const cards = page.locator('[data-upgrade-id]');
  const ids = await cards.evaluateAll((nodes) => nodes.map((node) => node.dataset.upgradeId));
  const preferred = PICK_PRIORITY.find((id) => ids.includes(id)) ?? ids[0];
  await page.locator(`[data-upgrade-id="${preferred}"]`).click();
}

async function activateBurstWhenReady(page, run) {
  const burstReady = run.burst.charge >= run.burst.maxCharge
    && run.time >= run.burst.activeUntil;
  if (!burstReady) return false;
  await page.keyboard.press('Space');
  return true;
}

test('自动避敌试玩可以持续到目标时长并记录本地战斗遥测', async ({ page }) => {
  test.setTimeout((PLAYTEST_DURATION + 90) * 1_000);
  await mkdir(OUTPUT_DIR, { recursive: true });
  await page.goto(PLAYTEST_URL);
  await page.getByRole('button', { name: '开始觉醒' }).click();

  let run = await snapshot(page);
  while (run.time < PLAYTEST_DURATION && run.state !== 'gameOver') {
    if (PLAYTEST_ENDURANCE) {
      const sustained = await page.evaluate(() => window.__ELEMENTAL_SURVIVOR__.sustain());
      expect(sustained).toBe(true);
    }
    if (run.state === 'levelUp') await chooseUpgrade(page);
    else {
      await activateBurstWhenReady(page, run);
      await move(page, steeringKeys(run));
    }
    run = await snapshot(page);
  }

  await page.screenshot({ path: `${OUTPUT_DIR}/${PLAYTEST_LABEL}.png` });
  await writeFile(`${OUTPUT_DIR}/${PLAYTEST_LABEL}.json`, `${JSON.stringify(run, null, 2)}\n`);

  expect(run.time, `未达到 ${PLAYTEST_DURATION} 秒；遥测：${JSON.stringify(run.stats)}`).toBeGreaterThanOrEqual(PLAYTEST_DURATION);
  expect(run.stats.kills).toBeGreaterThan(0);
  expect(run.player.level).toBeGreaterThan(1);
  if (PLAYTEST_DURATION >= 180) {
    expect(run.reactions).toContain(ROUTE.reaction);
    expect(run.reactions.length).toBeLessThanOrEqual(2);
    expect(run.burst.activations).toBeGreaterThan(0);
  }
  expect(run.stats.fps.average).toBeGreaterThan(45);
  if (PLAYTEST_DURATION >= 600) {
    expect(run.stats.fps.rollingMedianFps).toBeGreaterThanOrEqual(50);
    expect(run.stats.fps.p95Interval).toBeLessThanOrEqual(25);
    expect(run.stats.fps.over100ms).toBe(0);
  }
});
