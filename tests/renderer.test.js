import test from 'node:test';
import assert from 'node:assert/strict';

import { CONFIG } from '../src/data/config.js';
import { Renderer } from '../src/runtime/renderer.js';

test('resetTransientEffects clears visual state between runs', () => {
  const renderer = new Renderer({ getContext: () => ({}) }, CONFIG);
  renderer.shake = 4;
  renderer.flash = 0.4;
  renderer.hurtCue = { angle: 1, expiresAt: 100 };
  renderer.bursts.push({ x: 10, y: 20 });
  renderer.playerPose = { x: 10, y: 20, angle: 1, moving: true };

  renderer.resetTransientEffects();

  assert.equal(renderer.shake, 0);
  assert.equal(renderer.flash, 0);
  assert.equal(renderer.hurtCue, null);
  assert.deepEqual(renderer.bursts, []);
  assert.deepEqual(renderer.playerPose, { x: null, y: null, angle: -Math.PI / 2, moving: false });
});

test('slowed enemies keep their identity color and receive cyan edge marks', () => {
  const strokes = [];
  const fills = [];
  const context = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    save() {},
    restore() {},
    translate() {},
    rotate() {},
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    fill() { fills.push(this.fillStyle); },
    stroke() { strokes.push(this.strokeStyle); },
    fillRect() {},
  };
  const renderer = new Renderer({ getContext: () => context }, CONFIG);
  const enemy = {
    type: 'chaser',
    x: 20,
    y: 20,
    radius: 10,
    health: 10,
    maxHealth: 10,
    slowedUntil: 2,
  };

  renderer.drawEnemies(context, [enemy], 1, { x: 40, y: 20 });

  assert.ok(fills.includes('#8569b8'));
  assert.ok(strokes.includes('#a9e8ff'));
});
