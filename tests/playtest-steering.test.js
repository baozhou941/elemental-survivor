import assert from 'node:assert/strict';
import test from 'node:test';

import { steeringKeys } from '../e2e/playtest-steering.js';

test('playtest steering leaves the bottom-right wall even when enemies push outward', () => {
  const keys = steeringKeys({
    player: { x: 2385, y: 1585 },
    world: { width: 2400, height: 1600 },
    enemies: Array.from({ length: 12 }, (_, index) => ({
      x: 2320 - index,
      y: 1510 - index,
    })),
    xpOrbs: [],
  });

  assert.ok(keys.includes('KeyA'));
  assert.ok(keys.includes('KeyW'));
  assert.ok(!keys.includes('KeyD'));
  assert.ok(!keys.includes('KeyS'));
});

test('playtest steering still seeks nearby XP when the arena is safe', () => {
  const keys = steeringKeys({
    player: { x: 1200, y: 800 },
    world: { width: 2400, height: 1600 },
    enemies: [],
    xpOrbs: [{ x: 900, y: 500 }],
  });

  assert.deepEqual(keys.sort(), ['KeyA', 'KeyW']);
});

test('playtest steering collects nearby XP while a threat is not immediate', () => {
  const keys = steeringKeys({
    player: { x: 1200, y: 800 },
    world: { width: 2400, height: 1600 },
    enemies: [{ x: 1050, y: 800 }],
    xpOrbs: [{ x: 1200, y: 720 }],
  });

  assert.ok(keys.includes('KeyD'));
  assert.ok(keys.includes('KeyW'));
});

test('playtest steering prioritizes escape when a threat is immediate', () => {
  const keys = steeringKeys({
    player: { x: 1200, y: 800 },
    world: { width: 2400, height: 1600 },
    enemies: [{ x: 1100, y: 800 }],
    xpOrbs: [{ x: 1200, y: 720 }],
  });

  assert.deepEqual(keys, ['KeyD']);
});
