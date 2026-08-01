import test from 'node:test';
import assert from 'node:assert/strict';

import { CONFIG } from '../src/data/config.js';
import {
  applyUpgrade,
  createRun,
  createUpgradeChoices,
  damagePlayer,
  eligibleUpgrades,
  gainXp,
  restartRun,
} from '../src/core/model.js';

test('createRun starts at the title with only Fireball and empty transient state', () => {
  const run = createRun({ seed: 1234, runId: 7 });

  assert.equal(run.id, 7);
  assert.equal(run.state, 'title');
  assert.equal(run.rngState, 1234);
  assert.deepEqual(Object.keys(run.weapons), ['fireball']);
  assert.equal(run.upgrades.fireballUnlock, 1);
  assert.equal(run.player.health, CONFIG.player.maxHealth);
  assert.equal(run.player.level, 1);
  assert.equal(run.player.xpToNext, CONFIG.player.xpCurve[1]);
  assert.deepEqual(run.enemies, []);
  assert.deepEqual(run.projectiles, []);
  assert.deepEqual(run.xpOrbs, []);
  assert.deepEqual(run.particles, []);
  assert.deepEqual(run.reactions, []);
  assert.equal(run.reactionSlot, null);
  assert.deepEqual(run.reactionTriggerCooldowns, {});
  assert.deepEqual(run.stats.killsByType, {});
  assert.deepEqual(run.stats.peaks, { enemies: 0, projectiles: 0, particles: 0 });
  assert.deepEqual(run.stats.fps, {
    average: 0,
    minimum: 0,
    samples: 0,
    hitches: 0,
    maximumInterval: 0,
  });
  assert.deepEqual(run.stats.milestones, {
    firstKillAt: null,
    firstXpAt: null,
    firstLevelUpAt: null,
  });
});

test('damage applies invulnerability and lethal damage ends the run', () => {
  const run = createRun({ state: 'running' });

  assert.equal(damagePlayer(run, 1, 0), true);
  assert.equal(run.player.health, CONFIG.player.maxHealth - 1);
  assert.equal(run.stats.damageTaken, 1);
  assert.equal(damagePlayer(run, 1, 0.4), false);
  assert.equal(run.player.health, CONFIG.player.maxHealth - 1);
  assert.equal(damagePlayer(run, CONFIG.player.maxHealth - 1, 0.73), true);
  assert.equal(run.player.health, 0);
  assert.equal(run.state, 'gameOver');
});

test('damage records the last successful source and ignores blocked contact', () => {
  const run = createRun({ state: 'running' });
  const firstSource = { kind: 'contact', enemyType: 'swift', label: '疾行体' };
  const blockedSource = { kind: 'contact', enemyType: 'brute', label: '重压体' };

  assert.equal(damagePlayer(run, 1, 0, CONFIG, firstSource), true);
  assert.deepEqual(run.stats.lastDamageSource, firstSource);
  assert.equal(damagePlayer(run, 1, 0.2, CONFIG, blockedSource), false);
  assert.deepEqual(run.stats.lastDamageSource, firstSource);
});

test('XP overflow is retained when a level-up pauses the run', () => {
  const run = createRun({ state: 'running' });
  run.time = 12.5;

  gainXp(run, 75);

  assert.equal(run.player.level, 2);
  assert.equal(run.player.xp, 75 - CONFIG.player.xpCurve[1]);
  assert.equal(run.player.xpToNext, CONFIG.player.xpCurve[2]);
  assert.equal(run.pendingLevelUps, 1);
  assert.equal(run.state, 'levelUp');
  assert.equal(run.stats.milestones.firstLevelUpAt, 12.5);
});

test('one XP gain can queue multiple level-up choices', () => {
  const run = createRun({ state: 'running' });

  gainXp(run, CONFIG.player.xpCurve[1] + CONFIG.player.xpCurve[2] + 9);

  assert.equal(run.player.level, 3);
  assert.equal(run.player.xp, 9);
  assert.equal(run.pendingLevelUps, 2);
  assert.equal(run.state, 'levelUp');
});

test('upgrade eligibility excludes acquired choices and unmet requirements', () => {
  const run = createRun();
  const initial = eligibleUpgrades(run).map(({ id }) => id);

  assert.ok(initial.includes('fireballVolley'));
  assert.ok(initial.includes('windBladeUnlock'));
  assert.ok(initial.includes('iceShardUnlock'));
  assert.ok(initial.includes('fleetFooted'));
  assert.ok(!initial.includes('fireballUnlock'));
  assert.ok(!initial.includes('windBladePierce'));
  assert.ok(!initial.includes('fireTornado'));
  assert.ok(!initial.includes('thermalShock'));

  run.upgrades.windBladeUnlock = 1;
  const withWind = eligibleUpgrades(run).map(({ id }) => id);
  assert.ok(withWind.includes('windBladePierce'));
  assert.ok(withWind.includes('fireTornado'));

  run.upgrades.iceShardUnlock = 1;
  const withWindAndIce = eligibleUpgrades(run).map(({ id }) => id);
  assert.ok(withWindAndIce.includes('thermalShock'));
});

test('upgrade offers contain three unique deterministic choices', () => {
  const first = createRun({ seed: 99 });
  const second = createRun({ seed: 99 });

  const firstIds = createUpgradeChoices(first).map(({ id }) => id);
  const secondIds = createUpgradeChoices(second).map(({ id }) => id);

  assert.equal(firstIds.length, 3);
  assert.equal(new Set(firstIds).size, 3);
  assert.deepEqual(firstIds, secondIds);
  assert.deepEqual(first.currentUpgradeChoices, firstIds);
});

test('the first upgrade offer always presents Wind and Ice as distinct build routes', () => {
  for (let seed = 1; seed <= 30; seed += 1) {
    const run = createRun({ seed });
    const ids = createUpgradeChoices(run).map(({ id }) => id);

    assert.ok(ids.includes('windBladeUnlock'), `seed ${seed} did not offer Wind Blade`);
    assert.ok(ids.includes('iceShardUnlock'), `seed ${seed} did not offer Ice Shard`);
  }
});

test('an eligible reaction is guaranteed in the next upgrade offer', () => {
  const routes = [
    { unlock: 'windBladeUnlock', reaction: 'fireTornado' },
    { unlock: 'iceShardUnlock', reaction: 'thermalShock' },
  ];

  for (const { unlock, reaction } of routes) {
    for (let seed = 1; seed <= 30; seed += 1) {
      const run = createRun({ seed });
      run.upgrades[unlock] = 1;
      run.stats.upgradePicks.push(unlock);

      const ids = createUpgradeChoices(run).map(({ id }) => id);

      assert.ok(ids.includes(reaction), `${reaction} was missing for seed ${seed}`);
    }
  }
});

test('applying an offered weapon unlock records the pick and resumes play', () => {
  const run = createRun({ state: 'levelUp' });
  run.pendingLevelUps = 1;
  run.currentUpgradeChoices = ['windBladeUnlock'];

  assert.equal(applyUpgrade(run, 'windBladeUnlock'), true);
  assert.equal(run.upgrades.windBladeUnlock, 1);
  assert.equal(run.weapons.windBlade.id, 'windBlade');
  assert.deepEqual(run.stats.upgradePicks, ['windBladeUnlock']);
  assert.equal(run.pendingLevelUps, 0);
  assert.equal(run.state, 'running');
  assert.deepEqual(run.currentUpgradeChoices, []);
  assert.equal(applyUpgrade(run, 'iceShardUnlock'), false);
});

test('weapon and movement upgrades make their configured changes', () => {
  const run = createRun({ state: 'running' });
  const choose = (id) => {
    run.state = 'levelUp';
    run.pendingLevelUps = 1;
    run.currentUpgradeChoices = [id];
    assert.equal(applyUpgrade(run, id), true);
  };

  choose('fireballVolley');
  choose('fireballBlast');
  choose('windBladeUnlock');
  choose('windBladePierce');
  choose('windBladeHaste');
  choose('iceShardUnlock');
  choose('iceShardDeepFreeze');
  choose('fleetFooted');

  assert.equal(run.weapons.fireball.projectiles, CONFIG.weapons.fireball.projectiles + 1);
  assert.equal(run.weapons.fireball.radius, CONFIG.weapons.fireball.radius + 7);
  assert.equal(run.weapons.windBlade.pierce, CONFIG.weapons.windBlade.pierce + 2);
  assert.equal(run.weapons.windBlade.cooldown, CONFIG.weapons.windBlade.cooldown * 0.72);
  assert.equal(run.weapons.iceShard.slowMultiplier, CONFIG.weapons.iceShard.slowMultiplier * 0.72);
  assert.equal(run.player.speed, CONFIG.player.speed * 1.18);
});

test('reaction selection unlocks Fire Tornado exactly once', () => {
  const run = createRun({ state: 'levelUp' });
  run.upgrades.windBladeUnlock = 1;
  run.pendingLevelUps = 1;
  run.currentUpgradeChoices = ['fireTornado'];

  assert.equal(applyUpgrade(run, 'fireTornado'), true);
  assert.equal(run.unlockedReactions.fireTornado, true);
  assert.equal(run.reactionSlot, 'fireTornado');

  run.state = 'levelUp';
  run.pendingLevelUps = 1;
  run.currentUpgradeChoices = ['fireTornado'];
  assert.equal(applyUpgrade(run, 'fireTornado'), false);
});

test('the first reaction locks the run to one reaction build', () => {
  const run = createRun({ state: 'levelUp' });
  run.upgrades.windBladeUnlock = 1;
  run.upgrades.iceShardUnlock = 1;
  run.pendingLevelUps = 1;
  run.currentUpgradeChoices = ['fireTornado'];

  assert.equal(applyUpgrade(run, 'fireTornado'), true);
  assert.ok(!eligibleUpgrades(run).some(({ id }) => id === 'thermalShock'));

  run.state = 'levelUp';
  run.pendingLevelUps = 1;
  run.currentUpgradeChoices = ['thermalShock'];
  assert.equal(applyUpgrade(run, 'thermalShock'), false);
  assert.equal(run.unlockedReactions.thermalShock, undefined);
});

test('reaction selection unlocks Thermal Shock exactly once', () => {
  const run = createRun({ state: 'levelUp' });
  run.upgrades.iceShardUnlock = 1;
  run.pendingLevelUps = 1;
  run.currentUpgradeChoices = ['thermalShock'];

  assert.equal(applyUpgrade(run, 'thermalShock'), true);
  assert.equal(run.unlockedReactions.thermalShock, true);

  run.state = 'levelUp';
  run.pendingLevelUps = 1;
  run.currentUpgradeChoices = ['thermalShock'];
  assert.equal(applyUpgrade(run, 'thermalShock'), false);
});

test('restart creates a clean running session without retaining transient state', () => {
  const oldRun = createRun({ seed: 41, runId: 3, state: 'running' });
  oldRun.enemies.push({ id: 1 });
  oldRun.projectiles.push({ id: 2 });
  oldRun.xpOrbs.push({ id: 3 });
  oldRun.particles.push({ id: 4 });
  oldRun.reactions.push({ id: 5 });
  oldRun.unlockedReactions.fireTornado = true;
  oldRun.reactionSlot = 'fireTornado';
  oldRun.reactionTriggerCooldowns.thermalShock = new Map([[99, 12]]);
  oldRun.player.health = 1;
  oldRun.player.level = 8;
  oldRun.stats.kills = 99;
  oldRun.pendingLevelUps = 2;
  oldRun.currentUpgradeChoices = ['fleetFooted'];

  const restarted = restartRun(oldRun, { seed: 82 });

  assert.notEqual(restarted, oldRun);
  assert.equal(restarted.id, 4);
  assert.equal(restarted.state, 'running');
  assert.equal(restarted.rngState, 82);
  assert.equal(restarted.player.health, CONFIG.player.maxHealth);
  assert.equal(restarted.player.level, 1);
  assert.deepEqual(Object.keys(restarted.weapons), ['fireball']);
  assert.deepEqual(restarted.enemies, []);
  assert.deepEqual(restarted.projectiles, []);
  assert.deepEqual(restarted.xpOrbs, []);
  assert.deepEqual(restarted.particles, []);
  assert.deepEqual(restarted.reactions, []);
  assert.deepEqual(restarted.unlockedReactions, {});
  assert.equal(restarted.reactionSlot, null);
  assert.deepEqual(restarted.reactionTriggerCooldowns, {});
  assert.deepEqual(restarted.currentUpgradeChoices, []);
  assert.equal(restarted.pendingLevelUps, 0);
  assert.equal(restarted.stats.kills, 0);
  assert.equal(oldRun.stats.kills, 99);
});

test('fifty restarts keep each new run isolated from prior mutable state', () => {
  let run = createRun({ seed: 1, runId: 1, state: 'running' });

  for (let cycle = 0; cycle < 50; cycle += 1) {
    const previous = run;
    previous.enemies.push({ id: cycle });
    previous.projectiles.push({ id: cycle });
    previous.stats.kills = cycle + 1;
    run = restartRun(previous, { seed: cycle + 2 });

    assert.equal(run.id, previous.id + 1);
    assert.deepEqual(run.enemies, []);
    assert.deepEqual(run.projectiles, []);
    assert.equal(run.stats.kills, 0);
    assert.equal(previous.enemies.length, 1);
    assert.equal(previous.stats.kills, cycle + 1);
  }
});
