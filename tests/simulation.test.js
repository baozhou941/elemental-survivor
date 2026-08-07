import test from 'node:test';
import assert from 'node:assert/strict';

import { CONFIG } from '../src/data/config.js';
import { createRun } from '../src/core/model.js';
import {
  emitParticles,
  ensureReactions,
  spawnEnemy,
  stepEnemies,
  stepParticles,
  stepPlayer,
  stepProjectiles,
  stepReactions,
  stepSimulation,
  stepWeapons,
  stepXpOrbs,
} from '../src/core/simulation.js';

test('player movement is normalized and clamped inside world bounds', () => {
  const run = createRun({ state: 'running' });
  const startX = run.player.x;
  const startY = run.player.y;

  stepPlayer(run, { x: 1, y: 1 }, 1);
  assert.ok(Math.abs(run.player.x - startX - CONFIG.player.speed / Math.sqrt(2)) < 0.001);
  assert.ok(Math.abs(run.player.y - startY - CONFIG.player.speed / Math.sqrt(2)) < 0.001);

  run.player.x = CONFIG.player.radius;
  run.player.y = CONFIG.player.radius;
  stepPlayer(run, { x: -1, y: -1 }, 1);
  assert.equal(run.player.x, CONFIG.player.radius);
  assert.equal(run.player.y, CONFIG.player.radius);
});

test('active elemental burst accelerates movement and weapon cadence', () => {
  const run = createRun({ state: 'running' });
  const startX = run.player.x;
  run.burst.activeUntil = 10;
  spawnEnemy(run, 'brute', run.player.x + 300, run.player.y);

  stepPlayer(run, { x: 1, y: 0 }, 1);
  stepWeapons(run, 1 / 60);

  assert.ok(Math.abs(
    (run.player.x - startX) - CONFIG.player.speed * CONFIG.burst.moveSpeedMultiplier,
  ) < 1e-9);
  assert.equal(run.weapons.fireball.cooldownRemaining, CONFIG.weapons.fireball.cooldown * CONFIG.burst.cooldownMultiplier);
  assert.equal(run.projectiles[0].damage, CONFIG.weapons.fireball.damage * CONFIG.burst.damageMultiplier);
});

test('enemy kinds preserve distinct health, pace, and swift lateral movement', () => {
  const createEnemyRun = (type) => {
    const run = createRun({ state: 'running' });
    const enemy = spawnEnemy(run, type, run.player.x - 300, run.player.y);
    run.time = 1;
    stepEnemies(run, 0.5);
    return enemy;
  };

  const chaser = createEnemyRun('chaser');
  const swift = createEnemyRun('swift');
  const brute = createEnemyRun('brute');

  assert.equal(chaser.maxHealth, CONFIG.enemies.chaser.health);
  assert.equal(swift.maxHealth, CONFIG.enemies.swift.health);
  assert.equal(brute.maxHealth, CONFIG.enemies.brute.health);
  assert.ok(swift.x > chaser.x);
  assert.ok(chaser.x > brute.x);
  assert.notEqual(swift.y, CONFIG.world.height / 2);
});

test('enemy contact damages once during player invulnerability', () => {
  const run = createRun({ state: 'running' });
  const enemy = spawnEnemy(run, 'chaser', run.player.x, run.player.y);

  stepEnemies(run, 1 / 60);
  stepEnemies(run, 1 / 60);

  assert.equal(run.player.health, CONFIG.player.maxHealth - 1);
  assert.equal(run.stats.damageTaken, 1);
  const hurtEvent = run.events.find(({ type }) => type === 'hurt');
  assert.equal(typeof hurtEvent?.sourceX, 'number');
  assert.equal(typeof hurtEvent?.sourceY, 'number');
  assert.ok(
    Math.hypot(enemy.x - run.player.x, enemy.y - run.player.y) > enemy.radius + run.player.radius,
    'a successful contact hit should separate the enemy from the player',
  );
});

test('Fireball automatically aims at the nearest target and obeys cooldown', () => {
  const run = createRun({ state: 'running' });
  spawnEnemy(run, 'chaser', run.player.x + 260, run.player.y);
  spawnEnemy(run, 'chaser', run.player.x, run.player.y - 80);

  stepWeapons(run, 1 / 60);

  assert.equal(run.projectiles.length, 1);
  assert.equal(run.stats.attacks, 1);
  assert.ok(Math.abs(run.projectiles[0].vx) < 0.001);
  assert.ok(run.projectiles[0].vy < 0);

  stepWeapons(run, 0.2);
  assert.equal(run.projectiles.length, 1);
});

test('weapon mutations change combat behavior instead of only changing the upgrade card', () => {
  const orbitRun = createRun({ state: 'running' });
  orbitRun.weaponMutations.fireball = 'flameOrbit';
  spawnEnemy(orbitRun, 'brute', orbitRun.player.x + 200, orbitRun.player.y);
  stepWeapons(orbitRun, 1 / 60);
  assert.equal(orbitRun.projectiles[0].behavior, 'flameOrbit');
  const orbitStartX = orbitRun.projectiles[0].x;
  stepProjectiles(orbitRun, 0.1);
  assert.notEqual(orbitRun.projectiles[0].x, orbitStartX);

  const echoRun = createRun({ state: 'running' });
  echoRun.weapons = { windBlade: { ...CONFIG.weapons.windBlade, cooldownRemaining: 0, level: 1 } };
  echoRun.weaponMutations.windBlade = 'windEcho';
  spawnEnemy(echoRun, 'brute', echoRun.player.x + 200, echoRun.player.y);
  stepWeapons(echoRun, 1 / 60);
  assert.equal(echoRun.projectiles.length, 2);
  assert.ok(echoRun.projectiles.some(({ delay }) => delay > 0));
  assert.ok(echoRun.weapons.windBlade.cooldownRemaining > CONFIG.weapons.windBlade.cooldown);
});

test('Frost Prison turns an ice hit into local crowd control', () => {
  const run = createRun({ state: 'running' });
  run.weapons = { iceShard: { ...CONFIG.weapons.iceShard, cooldownRemaining: 0, level: 1 } };
  run.weaponMutations.iceShard = 'frostPrison';
  const target = spawnEnemy(run, 'brute', run.player.x + 25, run.player.y);
  const nearby = spawnEnemy(run, 'brute', target.x + 35, target.y);

  stepWeapons(run, 1 / 60);
  stepProjectiles(run, 0.05);

  assert.ok(target.slowMultiplier <= 0.2);
  assert.ok(nearby.slowMultiplier <= 0.2);
  assert.ok(nearby.slowedUntil >= 1);
});

test('projectiles expire, while a lethal hit records damage and drops XP', () => {
  const run = createRun({ state: 'running' });
  const enemy = spawnEnemy(run, 'swift', run.player.x + 25, run.player.y);
  stepWeapons(run, 1 / 60);
  assert.equal(run.projectiles.length, 1);

  stepProjectiles(run, 0.05);

  assert.equal(enemy.dead, true);
  assert.equal(run.stats.kills, 1);
  assert.equal(run.stats.killsByType.swift, 1);
  assert.equal(run.stats.xpProduced, CONFIG.enemies.swift.xp);
  assert.equal(run.stats.milestones.firstKillAt, 0);
  assert.equal(run.stats.damageByWeapon.fireball, CONFIG.weapons.fireball.damage);
  assert.equal(run.xpOrbs.length, 1);
  assert.equal(run.xpOrbs[0].value, CONFIG.enemies.swift.xp);

  run.projectiles.push({
    id: 999,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    radius: 1,
    lifetime: 0.01,
    damage: 0,
    pierceRemaining: 0,
    weaponId: 'fireball',
    element: 'fire',
    hitIds: new Set(),
  });
  stepProjectiles(run, 0.02);
  assert.ok(!run.projectiles.some(({ id }) => id === 999));
  assert.ok(!run.enemies.includes(enemy));
});

test('Wind Blade pierces several aligned enemies', () => {
  const run = createRun({ state: 'running' });
  run.weapons = {
    windBlade: { ...CONFIG.weapons.windBlade, cooldownRemaining: 0, level: 1 },
  };
  const enemies = [25, 50, 75].map((offset) => {
    const enemy = spawnEnemy(run, 'swift', run.player.x + offset, run.player.y);
    enemy.health = 10;
    return enemy;
  });

  stepWeapons(run, 1 / 60);
  for (let index = 0; index < 4; index += 1) stepProjectiles(run, 0.025);

  assert.ok(enemies.every(({ dead }) => dead));
  assert.equal(run.stats.kills, 3);
  assert.equal(run.stats.damageByWeapon.windBlade, CONFIG.weapons.windBlade.damage * 3);
});

test('Ice Shard applies a temporary movement slow', () => {
  const run = createRun({ state: 'running' });
  run.weapons = {
    iceShard: { ...CONFIG.weapons.iceShard, cooldownRemaining: 0, level: 1 },
  };
  const enemy = spawnEnemy(run, 'chaser', run.player.x + 25, run.player.y);

  stepWeapons(run, 1 / 60);
  stepProjectiles(run, 0.05);
  assert.equal(enemy.slowMultiplier, CONFIG.weapons.iceShard.slowMultiplier);
  assert.equal(enemy.slowedUntil, CONFIG.weapons.iceShard.slowDuration);

  enemy.x = run.player.x + 300;
  const slowedStart = enemy.x;
  stepEnemies(run, 0.5);
  assert.ok(slowedStart - enemy.x < CONFIG.enemies.chaser.speed * 0.5);
  assert.equal(run.stats.slowEnemySeconds, 0.5);

  run.time = enemy.slowedUntil + 0.01;
  enemy.x = run.player.x + 300;
  const normalStart = enemy.x;
  stepEnemies(run, 0.5);
  assert.ok(Math.abs(normalStart - enemy.x - CONFIG.enemies.chaser.speed * 0.5) < 0.001);
});

test('XP orbs attract inside pickup range, collect near the player, and can level up', () => {
  const run = createRun({ state: 'running' });
  run.xpOrbs.push(
    { id: 1, x: run.player.x + run.player.pickupRadius + 1, y: run.player.y, radius: 5, value: 5, collected: false },
    { id: 2, x: run.player.x + run.player.pickupRadius - 1, y: run.player.y, radius: 5, value: 5, collected: false },
    { id: 3, x: run.player.x + 4, y: run.player.y, radius: 5, value: CONFIG.player.xpCurve[1] - 5, collected: false },
  );

  const stationaryX = run.xpOrbs[0].x;
  const attractedX = run.xpOrbs[1].x;
  stepXpOrbs(run, 1 / 60);

  assert.equal(run.xpOrbs.find(({ id }) => id === 1).x, stationaryX);
  assert.ok(run.xpOrbs.find(({ id }) => id === 2).x < attractedX);
  assert.equal(run.player.xp, CONFIG.player.xpCurve[1] - 5);
  assert.equal(run.stats.xpCollected, CONFIG.player.xpCurve[1] - 5);
  assert.equal(run.stats.milestones.firstXpAt, 0);
  assert.equal(run.state, 'running');

  run.xpOrbs.push({ id: 4, x: run.player.x + 4, y: run.player.y, radius: 5, value: 5, collected: false });
  stepXpOrbs(run, 1 / 60);
  assert.equal(run.player.level, 2);
  assert.equal(run.state, 'levelUp');
});

test('kills and collected elemental energy charge the burst gauge', () => {
  const run = createRun({ state: 'running' });
  const enemy = spawnEnemy(run, 'swift', run.player.x + 25, run.player.y);
  stepWeapons(run, 1 / 60);
  stepProjectiles(run, 0.05);
  assert.equal(run.burst.charge, CONFIG.burst.killCharge);

  run.xpOrbs[0].x = run.player.x;
  run.xpOrbs[0].y = run.player.y;
  stepXpOrbs(run, 1 / 60);
  assert.equal(
    run.burst.charge,
    CONFIG.burst.killCharge + CONFIG.enemies.swift.xp * CONFIG.burst.xpChargePerPoint,
  );
});

test('simultaneously collected XP is conserved when the first orb levels up', () => {
  const run = createRun({ state: 'running' });
  run.xpOrbs.push(
    { id: 1, x: run.player.x, y: run.player.y, radius: 5, value: CONFIG.player.xpCurve[1], collected: false },
    { id: 2, x: run.player.x, y: run.player.y, radius: 5, value: 10, collected: false },
  );

  stepXpOrbs(run, 1 / 60);

  assert.equal(run.player.level, 2);
  assert.equal(run.player.xp, 10);
  assert.equal(run.xpOrbs.length, 0);
});

test('XP rewards merge instead of disappearing when the orb cap is reached', () => {
  const config = {
    ...CONFIG,
    limits: { ...CONFIG.limits, xpOrbs: 1 },
  };
  const run = createRun({ state: 'running' });
  run.xpOrbs.push({ id: 1, x: 10, y: 10, radius: 5, value: 7, collected: false });
  const enemy = spawnEnemy(run, 'swift', run.player.x + 25, run.player.y, config);
  enemy.health = 1;

  stepWeapons(run, 1 / 60, config);
  stepProjectiles(run, 0.05, config);

  assert.equal(run.xpOrbs.length, 1);
  assert.equal(run.xpOrbs[0].value, 7 + CONFIG.enemies.swift.xp);
});

test('elite kills drop a visually distinct high-value elemental core', () => {
  const run = createRun({ state: 'running' });
  const enemy = spawnEnemy(run, 'swift', run.player.x + 25, run.player.y);
  enemy.elite = true;
  enemy.xp = 30;
  enemy.health = 1;

  stepWeapons(run, 1 / 60);
  stepProjectiles(run, 0.05);

  assert.equal(run.stats.eliteKills, 1);
  assert.equal(run.xpOrbs[0].tier, 'elite');
  assert.ok(run.xpOrbs[0].radius > 5);
});

test('Fire Tornado creates one active reaction and respects per-target hit cadence', () => {
  const run = createRun({ state: 'running' });
  run.unlockedReactions.fireTornado = true;
  const enemy = spawnEnemy(run, 'brute', run.player.x + CONFIG.reactions.fireTornado.orbitRadius, run.player.y);

  ensureReactions(run);
  ensureReactions(run);
  assert.equal(run.reactions.length, 1);
  assert.ok(
    run.events.some(
      (event) =>
        event.type === 'reactionActivate' &&
        event.reactionId === 'fireTornado',
    ),
  );

  stepReactions(run, 0);
  const healthAfterFirstHit = enemy.health;
  stepReactions(run, 0.1);
  assert.equal(enemy.health, healthAfterFirstHit);

  run.time = CONFIG.reactions.fireTornado.hitInterval;
  stepReactions(run, 0);
  assert.equal(enemy.health, healthAfterFirstHit - CONFIG.reactions.fireTornado.damage);
  assert.equal(run.stats.damageByReaction.fireTornado, CONFIG.reactions.fireTornado.damage * 2);
  assert.equal(run.stats.reactionHits.fireTornado, 2);
  assert.equal(run.reactions[0].hits, 2);
});

test('Fire Tornado initially aims toward the nearest enemy', () => {
  const run = createRun({ state: 'running' });
  run.unlockedReactions.fireTornado = true;
  spawnEnemy(run, 'brute', run.player.x + 240, run.player.y);
  spawnEnemy(run, 'brute', run.player.x, run.player.y - 80);

  ensureReactions(run);

  assert.ok(Math.abs(run.reactions[0].angle + Math.PI / 2) < 0.001);
  assert.ok(Math.abs(run.reactions[0].x - run.player.x) < 0.001);
  assert.ok(run.reactions[0].y < run.player.y);
});

function fireProjectileAt(run, enemy, id) {
  run.projectiles.push({
    id,
    x: enemy.x,
    y: enemy.y,
    vx: 0,
    vy: 0,
    radius: CONFIG.weapons.fireball.radius,
    lifetime: 1,
    damage: CONFIG.weapons.fireball.damage,
    pierceRemaining: 0,
    weaponId: 'fireball',
    element: 'fire',
    hitIds: new Set(),
    expired: false,
  });
}

test('Thermal Shock only bursts when fire hits a slowed enemy', () => {
  const run = createRun({ state: 'running' });
  run.unlockedReactions.thermalShock = true;
  const trigger = spawnEnemy(run, 'brute', run.player.x + 100, run.player.y);
  const nearby = spawnEnemy(run, 'brute', trigger.x + 40, trigger.y);

  fireProjectileAt(run, trigger, 1001);
  stepProjectiles(run, 0);
  assert.equal(run.stats.reactionActivations.thermalShock, undefined);

  trigger.slowedUntil = 1;
  run.time = 0.1;
  fireProjectileAt(run, trigger, 1002);
  stepProjectiles(run, 0);

  assert.equal(run.stats.reactionActivations.thermalShock, 1);
  assert.equal(run.stats.reactionHits.thermalShock, 2);
  assert.equal(run.stats.damageByReaction.thermalShock, CONFIG.reactions.thermalShock.damage * 2);
  assert.ok(run.events.some((event) => event.type === 'reactionActivate' && event.reactionId === 'thermalShock'));
  assert.ok(nearby.health < nearby.maxHealth);
});

test('Thermal Shock has a per-enemy trigger cooldown and cannot double-trigger in one step', () => {
  const run = createRun({ state: 'running' });
  run.unlockedReactions.thermalShock = true;
  const target = spawnEnemy(run, 'brute', run.player.x + 100, run.player.y);
  target.health = 200;
  target.maxHealth = 200;
  target.slowedUntil = 2;

  fireProjectileAt(run, target, 2001);
  fireProjectileAt(run, target, 2002);
  stepProjectiles(run, 0);
  assert.equal(run.stats.reactionActivations.thermalShock, 1);

  run.time = CONFIG.reactions.thermalShock.triggerCooldown - 0.01;
  fireProjectileAt(run, target, 2003);
  stepProjectiles(run, 0);
  assert.equal(run.stats.reactionActivations.thermalShock, 1);

  run.time = CONFIG.reactions.thermalShock.triggerCooldown;
  fireProjectileAt(run, target, 2004);
  stepProjectiles(run, 0);
  assert.equal(run.stats.reactionActivations.thermalShock, 2);
});

test('multiple same-step fire hits on a lethal slowed enemy settle Thermal Shock, kill, and XP exactly once', () => {
  const run = createRun({ state: 'running' });
  run.unlockedReactions.thermalShock = true;
  const target = spawnEnemy(run, 'chaser', run.player.x + 100, run.player.y);
  target.health = CONFIG.weapons.fireball.damage;
  target.slowedUntil = 2;

  fireProjectileAt(run, target, 3001);
  fireProjectileAt(run, target, 3002);
  stepProjectiles(run, 0);

  assert.equal(run.stats.reactionActivations.thermalShock, 1);
  assert.equal(run.stats.reactionHits.thermalShock, 1);
  assert.equal(run.stats.damageByReaction.thermalShock, CONFIG.reactions.thermalShock.damage);
  assert.equal(run.stats.kills, 1);
  assert.equal(run.stats.killsByType.chaser, 1);
  assert.equal(run.stats.xpProduced, CONFIG.enemies.chaser.xp);
  assert.equal(run.xpOrbs.length, 1);
  assert.equal(run.xpOrbs[0].value, CONFIG.enemies.chaser.xp);
  assert.equal(run.events.filter(({ type }) => type === 'kill').length, 1);
  assert.equal(run.reactionTriggerCooldowns.thermalShock.has(target.id), false);
});

test('a reaction activation that expires without a hit is counted', () => {
  const run = createRun({ state: 'running' });
  run.unlockedReactions.fireTornado = true;

  ensureReactions(run);
  run.time = CONFIG.reactions.fireTornado.duration;
  stepReactions(run, 0);

  assert.equal(run.reactions.length, 0);
  assert.equal(run.stats.reactionZeroHitActivations.fireTornado, 1);
});

test('entity caps are enforced and expired particles are cleaned up', () => {
  const config = {
    ...CONFIG,
    limits: { ...CONFIG.limits, enemies: 2, projectiles: 2, particles: 3 },
  };
  const run = createRun({ state: 'running' }, 19);

  assert.ok(spawnEnemy(run, 'chaser', 50, 50, config));
  assert.ok(spawnEnemy(run, 'swift', 70, 50, config));
  assert.equal(spawnEnemy(run, 'brute', 90, 50, config), null);

  run.projectiles.push({ lifetime: 1 }, { lifetime: 1 });
  stepWeapons(run, 1, config);
  assert.equal(run.projectiles.length, 2);

  emitParticles(run, 10, 10, '#fff', 12, config);
  assert.equal(run.particles.length, 3);
  stepParticles(run, 2);
  assert.equal(run.particles.length, 0);
});

test('stepSimulation advances a running run and freezes modal states', () => {
  const run = createRun({ state: 'running' }, 23);
  run.spawnTimer = 0;

  stepSimulation(run, { dt: 1 / 60, input: { x: 1, y: 0 }, config: CONFIG });

  assert.equal(run.time, 1 / 60);
  assert.ok(run.player.x > CONFIG.world.width / 2);
  assert.ok(run.enemies.length > 0);
  assert.equal(run.stats.peaks.enemies, run.enemies.length);
  assert.ok(run.stats.peaks.projectiles > 0);

  const frozen = { time: run.time, x: run.player.x, enemyX: run.enemies[0].x };
  run.state = 'levelUp';
  stepSimulation(run, { dt: 1, input: { x: -1, y: 0 }, config: CONFIG });
  assert.deepEqual(
    { time: run.time, x: run.player.x, enemyX: run.enemies[0].x },
    frozen,
  );
});

test('encounter spawns keep a safe distance when the player is in a world corner', () => {
  const run = createRun({ state: 'running', seed: 1 });
  run.player.x = run.player.radius;
  run.player.y = run.player.radius;
  run.spawnTimer = 0;

  stepSimulation(run, { dt: 1 / 60, input: { x: 0, y: 0 }, config: CONFIG });

  assert.ok(run.enemies.length > 0);
  assert.ok(
    run.enemies.every((enemy) => Math.hypot(enemy.x - run.player.x, enemy.y - run.player.y) >= 300),
    'an encounter enemy must not clamp onto the player at a world edge',
  );
});

test('endless encounter applies scaling and promotes milestone enemies to elites', () => {
  const run = createRun({ state: 'running', seed: 3 });
  run.time = 240;
  run.spawnTimer = 0;

  stepSimulation(run, { dt: 1 / 60, input: { x: 0, y: 0 }, config: CONFIG });

  const elite = run.enemies.find(({ elite: isElite }) => isElite);
  assert.ok(elite);
  assert.ok(elite.maxHealth > CONFIG.enemies[elite.type].health * 3);
  assert.ok(run.nextEliteAt > run.time);
});
