import test from 'node:test';
import assert from 'node:assert/strict';

import { createFrameSampler, recordFrame } from '../src/runtime/frame-telemetry.js';

test('frame telemetry ignores modal gaps and records active frame rate', () => {
  const stats = { fps: { average: 0, minimum: 0, samples: 0, hitches: 0, maximumInterval: 0 } };
  const sampler = createFrameSampler();

  recordFrame(stats, sampler, 1000, true);
  recordFrame(stats, sampler, 1016, true);
  recordFrame(stats, sampler, 1056, true);

  assert.equal(stats.fps.samples, 2);
  assert.ok(Math.abs(stats.fps.average - 35.714) < 0.01);
  assert.equal(stats.fps.minimum, 25);

  recordFrame(stats, sampler, 2000, false);
  recordFrame(stats, sampler, 5000, true);
  recordFrame(stats, sampler, 5016, true);

  assert.equal(stats.fps.samples, 3);
  assert.ok(stats.fps.minimum === 25);
});

test('frame telemetry records long active hitches instead of silently discarding them', () => {
  const stats = { fps: { average: 0, minimum: 0, samples: 0, hitches: 0, maximumInterval: 0 } };
  const sampler = createFrameSampler();

  recordFrame(stats, sampler, 1000, true);
  recordFrame(stats, sampler, 1400, true);

  assert.equal(stats.fps.hitches, 1);
  assert.equal(stats.fps.maximumInterval, 400);
  assert.equal(stats.fps.samples, 0);
});
