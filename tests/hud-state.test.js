import test from 'node:test';
import assert from 'node:assert/strict';

import { createRun } from '../src/core/model.js';
import { diffHudSnapshot } from '../src/runtime/hud-state.js';

test('HUD snapshot reports every section dirty on its first comparison', () => {
  const run = createRun({ state: 'running' });

  const result = diffHudSnapshot(null, run);

  assert.deepEqual(result.changed, {
    time: true,
    health: true,
    level: true,
    xp: true,
    burst: true,
    weapons: true,
  });
});

test('HUD snapshot reports no changes for an unchanged run', () => {
  const run = createRun({ state: 'running' });
  const initial = diffHudSnapshot(null, run);

  const result = diffHudSnapshot(initial.snapshot, run);

  assert.deepEqual(result.changed, {
    time: false,
    health: false,
    level: false,
    xp: false,
    burst: false,
    weapons: false,
  });
});

test('HUD time changes at most once per elapsed second', () => {
  const run = createRun({ state: 'running' });
  const initial = diffHudSnapshot(null, run);

  run.time = 0.99;
  const withinSecond = diffHudSnapshot(initial.snapshot, run);
  assert.equal(withinSecond.changed.time, false);

  run.time = 1;
  const nextSecond = diffHudSnapshot(withinSecond.snapshot, run);
  assert.equal(nextSecond.changed.time, true);
});

test('HUD health changes when current or maximum health changes', () => {
  const run = createRun({ state: 'running' });
  const initial = diffHudSnapshot(null, run);

  run.player.health -= 1;
  const damaged = diffHudSnapshot(initial.snapshot, run);
  assert.equal(damaged.changed.health, true);

  run.player.maxHealth += 1;
  const fortified = diffHudSnapshot(damaged.snapshot, run);
  assert.equal(fortified.changed.health, true);
});

test('HUD level, XP, and burst changes are immediate and independent', () => {
  const run = createRun({ state: 'running' });
  const initial = diffHudSnapshot(null, run);

  run.player.level += 1;
  const leveled = diffHudSnapshot(initial.snapshot, run);
  assert.equal(leveled.changed.level, true);
  assert.equal(leveled.changed.xp, false);

  run.player.xp += 1;
  const gainedXp = diffHudSnapshot(leveled.snapshot, run);
  assert.equal(gainedXp.changed.xp, true);
  assert.equal(gainedXp.changed.burst, false);

  run.burst.charge += 1;
  const charged = diffHudSnapshot(gainedXp.snapshot, run);
  assert.equal(charged.changed.burst, true);
});

test('XP orb churn does not dirty the HUD after the pickup tutorial is complete', () => {
  const run = createRun({ state: 'running' });
  run.stats.xpCollected = 1;
  const initial = diffHudSnapshot(null, run);

  run.xpOrbs.push({ id: 99, x: 10, y: 10, value: 1 });
  const withOrb = diffHudSnapshot(initial.snapshot, run);

  assert.equal(withOrb.changed.xp, false);
});

test('HUD weapon signature changes for equipment, fusion, mutation, and mastery changes', () => {
  const run = createRun({ state: 'running' });
  const initial = diffHudSnapshot(null, run);

  run.weapons.windBlade = { id: 'windBlade' };
  const equipped = diffHudSnapshot(initial.snapshot, run);
  assert.equal(equipped.changed.weapons, true);

  run.fusionSlots.push('fireTornado');
  const fused = diffHudSnapshot(equipped.snapshot, run);
  assert.equal(fused.changed.weapons, true);

  run.weaponMutations.fireball = 'flameOrbit';
  const mutated = diffHudSnapshot(fused.snapshot, run);
  assert.equal(mutated.changed.weapons, true);

  run.masteries.elementalOverdrive = 1;
  const mastered = diffHudSnapshot(mutated.snapshot, run);
  assert.equal(mastered.changed.weapons, true);
});
