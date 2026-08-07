import test from 'node:test';
import assert from 'node:assert/strict';

import { CONFIG, validateConfig } from '../src/data/config.js';

test('V0.7 config has unique, referentially valid content', () => {
  assert.deepEqual(validateConfig(CONFIG), []);
  assert.deepEqual(Object.keys(CONFIG.weapons).sort(), ['fireball', 'iceShard', 'windBlade']);
  assert.deepEqual(Object.keys(CONFIG.enemies).sort(), ['brute', 'chaser', 'swift']);
  assert.equal(CONFIG.upgrades.length, 23);
  assert.deepEqual(Object.keys(CONFIG.reactions), ['fireTornado', 'thermalShock']);
  assert.ok(CONFIG.world.width > 0);
  assert.ok(CONFIG.world.height > 0);
  assert.equal(new Set(CONFIG.upgrades.map((upgrade) => upgrade.id)).size, CONFIG.upgrades.length);
});

test('early XP costs delay the first choice while keeping later growth gradual', () => {
  const costs = CONFIG.player.xpCurve.slice(1);

  assert.equal(costs[0], 60);
  assert.ok(costs.every((cost, index) => index === 0 || cost >= costs[index - 1]));
  assert.ok(costs.slice(1).every((cost, index) => cost - costs[index] <= 30));
});

test('V0.1 gives a first-time player six contact mistakes of health', () => {
  assert.equal(CONFIG.player.maxHealth, 6);
});

test('Fire Tornado has the reviewed V0.2 hit radius', () => {
  assert.equal(CONFIG.reactions.fireTornado.radius, 96);
  assert.equal(CONFIG.reactions.fireTornado.mode, 'orbit');
});

test('Thermal Shock is a wide triggered burst with an independent cooldown', () => {
  assert.equal(CONFIG.reactions.thermalShock.mode, 'triggeredBurst');
  assert.equal(CONFIG.reactions.thermalShock.damage, 18);
  assert.equal(CONFIG.reactions.thermalShock.radius, 110);
  assert.equal(CONFIG.reactions.thermalShock.triggerCooldown, 0.8);
});
