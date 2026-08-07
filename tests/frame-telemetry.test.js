import test from 'node:test';
import assert from 'node:assert/strict';

import { createFrameSampler, recordFrame } from '../src/runtime/frame-telemetry.js';

function createStats() {
  return {
    fps: {
      average: 0,
      minimum: 0,
      samples: 0,
      hitches: 0,
      maximumInterval: 0,
      rollingMedianFps: 0,
      p95Interval: 0,
      maximumIntervalWindow: 0,
      over33ms: 0,
      over50ms: 0,
      over100ms: 0,
      windowSeconds: 30,
      windowSamples: 0,
    },
  };
}

test('frame telemetry ignores modal gaps and records active frame rate', () => {
  const stats = createStats();
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
  const stats = createStats();
  const sampler = createFrameSampler();

  recordFrame(stats, sampler, 1000, true);
  recordFrame(stats, sampler, 1400, true);

  assert.equal(stats.fps.hitches, 1);
  assert.equal(stats.fps.maximumInterval, 400);
  assert.equal(stats.fps.samples, 0);
  assert.equal(stats.fps.windowSamples, 0);
});

test('frame telemetry reports only the most recent 30 seconds in rolling metrics', () => {
  const stats = createStats();
  const sampler = createFrameSampler();

  recordFrame(stats, sampler, 0, true);
  recordFrame(stats, sampler, 16, true);
  recordFrame(stats, sampler, 56, true);
  recordFrame(stats, sampler, 176, true);

  assert.equal(stats.fps.windowSeconds, 30);
  assert.equal(stats.fps.windowSamples, 3);
  assert.equal(stats.fps.rollingMedianFps, 25);
  assert.equal(stats.fps.p95Interval, 120);
  assert.equal(stats.fps.maximumIntervalWindow, 120);
  assert.equal(stats.fps.over33ms, 2);
  assert.equal(stats.fps.over50ms, 1);
  assert.equal(stats.fps.over100ms, 1);

  recordFrame(stats, sampler, 200, false);
  recordFrame(stats, sampler, 31176, true);
  recordFrame(stats, sampler, 31196, true);

  assert.equal(stats.fps.samples, 4);
  assert.equal(stats.fps.windowSamples, 1);
  assert.equal(stats.fps.rollingMedianFps, 50);
  assert.equal(stats.fps.p95Interval, 20);
  assert.equal(stats.fps.maximumIntervalWindow, 20);
  assert.equal(stats.fps.over33ms, 0);
  assert.equal(stats.fps.over50ms, 0);
  assert.equal(stats.fps.over100ms, 0);
});
