import { expect, test } from '@playwright/test';

const screenshotPath = (name) => `artifacts/screenshots/${name}.png`;

async function snapshot(page) {
  return page.evaluate(() => window.__ELEMENTAL_SURVIVOR__.snapshot());
}

async function moveFor(page, key, milliseconds) {
  await page.keyboard.down(key);
  await page.waitForTimeout(milliseconds);
  await page.keyboard.up(key);
}

function steeringKeys(run) {
  const { player, enemies, xpOrbs, world } = run;
  let x = 0;
  let y = 0;
  let closestThreat = Infinity;

  for (const enemy of enemies) {
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    closestThreat = Math.min(closestThreat, distance);
    if (distance < 300) {
      const pressure = (300 - distance) / distance;
      x += dx * pressure;
      y += dy * pressure;
    }
  }

  if (closestThreat > 210 && xpOrbs.length > 0) {
    const target = xpOrbs.reduce((closest, orb) => {
      const distance = Math.hypot(player.x - orb.x, player.y - orb.y);
      return distance < closest.distance ? { orb, distance } : closest;
    }, { orb: null, distance: Infinity }).orb;
    x += (target.x - player.x) * 0.8;
    y += (target.y - player.y) * 0.8;
  }

  const margin = 260;
  if (player.x < margin) x += margin - player.x;
  if (player.x > world.width - margin) x -= player.x - (world.width - margin);
  if (player.y < margin) y += margin - player.y;
  if (player.y > world.height - margin) y -= player.y - (world.height - margin);

  if (Math.abs(x) + Math.abs(y) < 1) x = 1;
  const keys = [];
  if (x > 20) keys.push('KeyD');
  if (x < -20) keys.push('KeyA');
  if (y > 20) keys.push('KeyS');
  if (y < -20) keys.push('KeyW');
  return keys.length > 0 ? keys : ['KeyD'];
}

async function steerFor(page, keys, milliseconds = 320) {
  for (const key of keys) await page.keyboard.down(key);
  await page.waitForTimeout(milliseconds);
  for (const key of keys) await page.keyboard.up(key);
}

test('完整一局可以移动、战斗、升级、暂停、死亡并干净重开', async ({ page }) => {
  await page.goto('/?test=1');
  await expect(page.locator('html')).toHaveAttribute('data-game-ready', 'ready');
  await expect(page.getByRole('button', { name: '开始觉醒' })).toBeVisible();
  await page.screenshot({ path: screenshotPath('v0.8-title') });

  await page.getByRole('button', { name: '开始觉醒' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-game-state', 'running');
  const started = await snapshot(page);

  await moveFor(page, 'KeyD', 500);
  const moved = await snapshot(page);
  expect(moved.player.x).toBeGreaterThan(started.player.x + 20);

  await expect.poll(async () => (await snapshot(page)).stats.attacks, { timeout: 8_000 }).toBeGreaterThan(0);
  await expect.poll(async () => (await snapshot(page)).enemyCount, { timeout: 8_000 }).toBeGreaterThan(0);
  await page.screenshot({ path: screenshotPath('v0.8-gameplay') });

  await page.getByRole('button', { name: '暂停游戏' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-game-state', 'paused');
  const pausedAt = (await snapshot(page)).time;
  await page.waitForTimeout(350);
  expect((await snapshot(page)).time).toBe(pausedAt);
  await page.screenshot({ path: screenshotPath('v0.8-paused') });
  await page.getByRole('button', { name: '继续战斗' }).click();

  const upgradeDeadline = Date.now() + 70_000;
  while (Date.now() < upgradeDeadline) {
    const current = await snapshot(page);
    if (current.state === 'levelUp') break;
    expect(current.state, '玩家应在首次升级前存活').not.toBe('gameOver');
    await steerFor(page, steeringKeys(current));
  }

  await expect(page.locator('html')).toHaveAttribute('data-game-state', 'levelUp');
  await expect(page.locator('#reaction-route-rule')).toContainText('融合槽最多 2 个');
  await expect(page.locator('#reaction-route-rule')).toContainText('武器蜕变彼此独立');
  await expect(page.locator('[data-upgrade-id="windBladeUnlock"]')).toContainText('火焰龙卷');
  await expect(page.locator('[data-upgrade-id="iceShardUnlock"]')).toContainText('霜爆');
  const neutralChoice = page.locator('[data-upgrade-id]:not([data-upgrade-id="windBladeUnlock"]):not([data-upgrade-id="iceShardUnlock"])');
  await expect(neutralChoice).toHaveCount(1);
  await page.screenshot({ path: screenshotPath('v0.8-upgrade') });
  const firstUpgrade = page.locator('[data-upgrade-id]').first();
  const upgradeLabels = await page.locator('.upgrade-card__rarity').allTextContents();
  expect(upgradeLabels.length).toBeGreaterThan(0);
  expect(upgradeLabels.every((label) => [
    'BUILD UPGRADE',
    'ELEMENT FUSION',
    'WEAPON MUTATION',
    'ENDLESS MASTERY',
  ].includes(label))).toBe(true);
  const pickedId = await firstUpgrade.getAttribute('data-upgrade-id');
  const positionBeforePick = (await snapshot(page)).player;
  await page.keyboard.down('KeyD');
  await firstUpgrade.click();
  await expect(page.locator('html')).toHaveAttribute('data-game-state', 'running');
  await page.waitForTimeout(350);
  const afterPick = await snapshot(page);
  expect(afterPick.upgrades).toContain(pickedId);
  expect(Math.abs(afterPick.player.x - positionBeforePick.x)).toBeLessThan(1);
  await page.keyboard.up('KeyD');

  await page.evaluate(() => window.__ELEMENTAL_SURVIVOR__.defeat());
  await expect(page.locator('html')).toHaveAttribute('data-game-state', 'gameOver');
  const ended = await snapshot(page);
  expect(ended.stats.lastDamageSource).not.toBeNull();
  await expect(page.locator('#run-summary')).toContainText('最后伤害');
  await expect(page.locator('#run-summary')).toContainText('本局路线');
  await expect(page.locator('#run-summary')).toContainText('未形成');
  await expect(page.locator('#run-summary')).toContainText('0 次 · 0 命中');
  await expect(page.locator('#run-summary')).not.toContainText('下局目标');
  await expect(page.getByRole('button', { name: '再来一局' })).toBeVisible();
  await expect(page.locator('#game-over-leaderboard li')).toHaveCount(1);
  await expect(page.locator('#game-over-leaderboard')).toContainText('#1');
  expect(ended.leaderboard).toHaveLength(1);
  await page.screenshot({ path: screenshotPath('v0.8-game-over') });

  const restarted = await page.evaluate(() => {
    document.querySelector('#restart-button').click();
    return window.__ELEMENTAL_SURVIVOR__.snapshot();
  });
  expect(restarted.runId).toBe(ended.runId + 1);
  expect(restarted.state).toBe('running');
  expect(restarted.enemyCount).toBe(0);
  expect(restarted.projectileCount).toBe(0);
  expect(restarted.particleCount).toBe(0);
  expect(restarted.upgrades).toEqual([]);
  expect(restarted.fusionSlots).toEqual([]);
  expect(restarted.mutations).toEqual({});
  expect(restarted.burst).toMatchObject({ charge: 0, activeUntil: 0, activations: 0 });
  expect(restarted.leaderboard).toHaveLength(1);
  expect(restarted.stats.lastDamageSource).toBeNull();
  expect(restarted.stats.milestones).toEqual({ firstKillAt: null, firstXpAt: null, firstLevelUpAt: null });
  expect(restarted.loop).toEqual({ running: true, paused: false });
});

test('生产入口不暴露测试控制 API', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-game-ready', 'ready');
  expect(await page.evaluate(() => '__ELEMENTAL_SURVIVOR__' in window)).toBe(false);
});

test('测试入口提供长时性能续航控制', async ({ page }) => {
  await page.goto('/?test=1');
  await expect(page.locator('html')).toHaveAttribute('data-game-ready', 'ready');
  expect(await page.evaluate(() => typeof window.__ELEMENTAL_SURVIVOR__.sustain)).toBe('function');
  expect(await page.evaluate(() => window.__ELEMENTAL_SURVIVOR__.sustain())).toBe(false);
  await page.getByRole('button', { name: '开始觉醒' }).click();
  expect(await page.evaluate(() => window.__ELEMENTAL_SURVIVOR__.sustain())).toBe(true);
});

test.describe('手机触控', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test('手机布局显示摇杆并能控制角色移动', async ({ page }) => {
    await page.goto('/?test=1');
    await expect(page.locator('html')).toHaveAttribute('data-game-ready', 'ready');
    await expect(page.getByText('自动攻击 · 无尽生存')).toBeVisible();
    await page.getByRole('button', { name: '开始觉醒' }).tap();

    const stick = page.getByRole('button', { name: '移动摇杆' });
    await expect(stick).toBeVisible();
    await expect(page.getByRole('button', { name: '释放元素爆发' })).toBeVisible();
    await expect(page.getByRole('button', { name: '释放元素爆发' })).toBeDisabled();
    const bounds = await stick.boundingBox();
    const started = await snapshot(page);
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;

    await stick.dispatchEvent('pointerdown', {
      pointerId: 7,
      pointerType: 'touch',
      clientX: centerX,
      clientY: centerY,
    });
    await stick.dispatchEvent('pointermove', {
      pointerId: 7,
      pointerType: 'touch',
      clientX: centerX + 56,
      clientY: centerY,
    });
    await page.waitForTimeout(450);
    const moved = await snapshot(page);
    expect(moved.player.x).toBeGreaterThan(started.player.x + 20);

    await stick.dispatchEvent('pointerup', {
      pointerId: 7,
      pointerType: 'touch',
      clientX: centerX + 56,
      clientY: centerY,
    });
    const releasedAt = (await snapshot(page)).player.x;
    await page.waitForTimeout(250);
    expect(Math.abs((await snapshot(page)).player.x - releasedAt)).toBeLessThan(1);
  });
});
