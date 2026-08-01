import test from 'node:test';
import assert from 'node:assert/strict';

import { CONFIG } from '../src/data/config.js';
import { createRun } from '../src/core/model.js';
import { getEncounterPlan } from '../src/core/director.js';

function planAt(time, enemyCount = 0, kills = 0, level = 1) {
  const run = createRun({ state: 'running' });
  run.time = time;
  run.player.level = level;
  run.stats.kills = kills;
  run.enemies.length = enemyCount;
  return getEncounterPlan(run);
}

test('director introduces the three V0.1 enemies in readable stages', () => {
  assert.deepEqual(planAt(10).mix.map(({ id }) => id), ['chaser']);
  assert.deepEqual(planAt(50).mix.map(({ id }) => id), ['chaser', 'swift']);
  assert.deepEqual(planAt(100).mix.map(({ id }) => id), ['chaser', 'swift', 'brute']);
});

test('director alternates pressure and release instead of only accelerating', () => {
  const pressure = planAt(15);
  const release = planAt(32);

  assert.equal(pressure.phase, 'pressure');
  assert.equal(release.phase, 'release');
  assert.ok(release.spawnInterval > pressure.spawnInterval);
});

test('director gives a readable onboarding window before reaching normal pressure', () => {
  const opening = planAt(0);
  const established = planAt(45);

  assert.ok(opening.spawnInterval >= 1.2);
  assert.ok(established.spawnInterval < opening.spawnInterval);
});

test('director reacts modestly to player power and kill rate', () => {
  const baseline = planAt(70, 10, 10, 3);
  const powerful = planAt(70, 10, 100, 8);

  assert.ok(powerful.spawnInterval < baseline.spawnInterval);
  assert.ok(powerful.batchSize >= baseline.batchSize);
});

test('director does not multiply a strong level 7 build into a sudden spawn spike', () => {
  const levelSix = planAt(100, 20, 100, 6);
  const levelSeven = planAt(100, 20, 100, 7);

  assert.equal(levelSeven.batchSize, levelSix.batchSize);
  assert.ok(levelSeven.batchSize <= 2);
});

test('director pauses spawning above its readable phase target', () => {
  const belowTarget = planAt(145, 58, 200, 7);
  const aboveTarget = planAt(145, 60, 200, 7);

  assert.equal(belowTarget.canSpawn, true);
  assert.equal(aboveTarget.canSpawn, false);
  assert.equal(aboveTarget.spawnCount, 0);
});

test('V0.1 director never schedules elites and respects the enemy cap', () => {
  const capped = planAt(180, CONFIG.limits.enemies, 200, 10);
  const almostTarget = planAt(180, 65, 200, 10);

  assert.equal(capped.canSpawn, false);
  assert.equal(capped.spawnCount, 0);
  assert.equal(capped.elite, false);
  assert.equal(almostTarget.spawnCount, 1);
});
