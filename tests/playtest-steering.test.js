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

  assert.deepEqual([...keys].sort(), ['KeyA', 'KeyW']);
});

test('playtest steering ignores XP while a nearby threat needs attention', () => {
  const keys = steeringKeys({
    player: { x: 1200, y: 800 },
    world: { width: 2400, height: 1600 },
    enemies: [{ x: 1020, y: 800 }],
    xpOrbs: [{ x: 1200, y: 720 }],
  });

  assert.ok(keys.includes('KeyD'));
  assert.ok(!keys.includes('KeyW'));
});

test('playtest steering adds a tangential escape when a threat is immediate', () => {
  const keys = steeringKeys({
    player: { x: 1200, y: 800 },
    world: { width: 2400, height: 1600 },
    enemies: [{ x: 1100, y: 800 }],
    xpOrbs: [{ x: 1200, y: 720 }],
  });

  assert.ok(keys.includes('KeyD'));
  assert.ok(keys.includes('KeyS'));
  assert.ok(!keys.includes('KeyW'));
});

test('playtest steering escapes a symmetric pinch instead of stalling between enemies', () => {
  const keys = steeringKeys({
    player: { x: 1200, y: 800 },
    world: { width: 2400, height: 1600 },
    enemies: [
      { x: 1100, y: 800 },
      { x: 1300, y: 800 },
    ],
    xpOrbs: [{ x: 1300, y: 800 }],
  });

  assert.ok(keys.includes('KeyS') || keys.includes('KeyW'));
  assert.ok(!keys.includes('KeyA'));
  assert.ok(!keys.includes('KeyD'));
});

test('playtest steering is independent of equidistant enemy array order', () => {
  const run = {
    player: { x: 1200, y: 800 },
    world: { width: 2400, height: 1600 },
    enemies: [
      { x: 1100, y: 800 },
      { x: 1300, y: 800 },
    ],
    xpOrbs: [],
  };

  assert.deepEqual(steeringKeys(run), steeringKeys({ ...run, enemies: [...run.enemies].reverse() }));
});

test('playtest steering changes smoothly around the nearby-threat threshold', () => {
  const runAtDistance = (distance) => steeringKeys({
    player: { x: 1200, y: 800 },
    world: { width: 2400, height: 1600 },
    enemies: [{ x: 1200 - distance, y: 800 }],
    xpOrbs: [{ x: 1000, y: 800 }],
  });

  assert.deepEqual(runAtDistance(219), runAtDistance(220));
  assert.deepEqual(runAtDistance(220), runAtDistance(221));
});

test('playtest steering uses a tangential route when a wall blocks the direct escape', () => {
  const keys = steeringKeys({
    player: { x: 2310, y: 800 },
    world: { width: 2400, height: 1600 },
    enemies: [{ x: 2160, y: 800 }],
    xpOrbs: [],
  });

  assert.ok(keys.includes('KeyS') || keys.includes('KeyW'));
  assert.notDeepEqual(keys, ['KeyA']);
});

test('playtest steering never returns opposing keys or predicts beyond the arena', () => {
  for (const player of [
    { x: 5, y: 5 },
    { x: 2395, y: 5 },
    { x: 5, y: 1595 },
    { x: 2395, y: 1595 },
  ]) {
    const keys = steeringKeys({
      player,
      world: { width: 2400, height: 1600 },
      enemies: [{ x: 1200, y: 800 }],
      xpOrbs: [{ x: 1200, y: 800 }],
    });
    assert.ok(!(keys.includes('KeyA') && keys.includes('KeyD')));
    assert.ok(!(keys.includes('KeyW') && keys.includes('KeyS')));
    if (player.x < 120) assert.ok(!keys.includes('KeyA'));
    if (player.x > 2280) assert.ok(!keys.includes('KeyD'));
    if (player.y < 120) assert.ok(!keys.includes('KeyW'));
    if (player.y > 1480) assert.ok(!keys.includes('KeyS'));
  }
});

test('playtest steering keeps its predicted endpoint inside the player-radius boundary', () => {
  const keys = steeringKeys({
    player: { x: 135, y: 800, radius: 60 },
    world: { width: 2400, height: 1600 },
    enemies: Array.from({ length: 20 }, (_, index) => ({
      x: 250,
      y: 800 + index * 0.1,
      radius: 20,
    })),
    xpOrbs: [],
  });

  assert.ok(!keys.includes('KeyA'));
});

test('playtest steering gives larger enemies more collision clearance', () => {
  const keys = steeringKeys({
    player: { x: 1200, y: 800, radius: 15 },
    world: { width: 2400, height: 1600 },
    enemies: [
      { x: 1000, y: 800, radius: 5 },
      { x: 1400, y: 800, radius: 80 },
    ],
    xpOrbs: [],
  });

  assert.ok(!keys.includes('KeyD'));
});

test('playtest steering returns an isolated keys array', () => {
  const run = {
    player: { x: 1200, y: 800 },
    world: { width: 2400, height: 1600 },
    enemies: [],
    xpOrbs: [{ x: 900, y: 500 }],
  };
  const keys = steeringKeys(run);
  keys.push('KeyX');

  assert.ok(!steeringKeys(run).includes('KeyX'));
});
