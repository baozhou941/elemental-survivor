import test from 'node:test';
import assert from 'node:assert/strict';

import { GameLoop } from '../src/core/game-loop.js';

function createScheduler() {
  let nextId = 1;
  const callbacks = new Map();
  return {
    request(callback) {
      const id = nextId++;
      callbacks.set(id, callback);
      return id;
    },
    cancel(id) {
      callbacks.delete(id);
    },
    fire(timestamp) {
      const entry = callbacks.entries().next().value;
      assert.ok(entry, 'expected a scheduled frame');
      const [id, callback] = entry;
      callbacks.delete(id);
      callback(timestamp);
    },
    get size() {
      return callbacks.size;
    },
  };
}

test('GameLoop starts once and keeps exactly one scheduled frame', () => {
  const scheduler = createScheduler();
  const loop = new GameLoop({
    step() {},
    render() {},
    requestFrame: scheduler.request,
    cancelFrame: scheduler.cancel,
  });

  assert.equal(loop.start(), true);
  assert.equal(loop.start(), false);
  assert.equal(scheduler.size, 1);
  scheduler.fire(0);
  assert.equal(scheduler.size, 1);
});

test('GameLoop uses fixed steps and clamps large frame deltas', () => {
  const scheduler = createScheduler();
  const steps = [];
  const renders = [];
  const loop = new GameLoop({
    fixedStep: 0.02,
    maxDelta: 0.1,
    step: (dt) => steps.push(dt),
    render: (alpha) => renders.push(alpha),
    requestFrame: scheduler.request,
    cancelFrame: scheduler.cancel,
  });

  loop.start();
  scheduler.fire(1000);
  scheduler.fire(1200);

  assert.equal(steps.length, 5);
  assert.ok(steps.every((dt) => dt === 0.02));
  assert.ok(renders.length >= 2);
});

test('pause and resume discard elapsed wall time', () => {
  const scheduler = createScheduler();
  let stepCount = 0;
  const loop = new GameLoop({
    fixedStep: 0.02,
    step: () => { stepCount += 1; },
    render() {},
    requestFrame: scheduler.request,
    cancelFrame: scheduler.cancel,
  });

  loop.start();
  scheduler.fire(1000);
  loop.pause();
  scheduler.fire(5000);
  assert.equal(stepCount, 0);

  loop.resume();
  scheduler.fire(9000);
  assert.equal(stepCount, 0);
  scheduler.fire(9020);
  assert.equal(stepCount, 1);
});

test('stop cancels the pending frame and permits a clean restart', () => {
  const scheduler = createScheduler();
  const loop = new GameLoop({
    step() {},
    render() {},
    requestFrame: scheduler.request,
    cancelFrame: scheduler.cancel,
  });

  loop.start();
  loop.stop();
  assert.equal(scheduler.size, 0);
  assert.equal(loop.start(), true);
  assert.equal(scheduler.size, 1);
});

test('pausing from a fixed step prevents additional catch-up steps in that frame', () => {
  const scheduler = createScheduler();
  let stepCount = 0;
  let loop;
  loop = new GameLoop({
    fixedStep: 0.02,
    maxDelta: 0.1,
    step() {
      stepCount += 1;
      loop.pause();
    },
    render() {},
    requestFrame: scheduler.request,
    cancelFrame: scheduler.cancel,
  });

  loop.start();
  scheduler.fire(1000);
  scheduler.fire(1100);

  assert.equal(stepCount, 1);
  assert.equal(scheduler.size, 1);
});

test('stopping from a fixed step prevents catch-up and does not schedule another frame', () => {
  const scheduler = createScheduler();
  let stepCount = 0;
  let loop;
  loop = new GameLoop({
    fixedStep: 0.02,
    maxDelta: 0.1,
    step() {
      stepCount += 1;
      loop.stop();
    },
    render() {},
    requestFrame: scheduler.request,
    cancelFrame: scheduler.cancel,
  });

  loop.start();
  scheduler.fire(1000);
  scheduler.fire(1100);

  assert.equal(stepCount, 1);
  assert.equal(scheduler.size, 0);
});

test('fifty stop and restart cycles never leave more than one scheduled frame', () => {
  const scheduler = createScheduler();
  const loop = new GameLoop({
    step() {},
    render() {},
    requestFrame: scheduler.request,
    cancelFrame: scheduler.cancel,
  });

  for (let cycle = 0; cycle < 50; cycle += 1) {
    assert.equal(loop.start(), true);
    assert.equal(loop.start(), false);
    assert.equal(scheduler.size, 1);
    scheduler.fire(cycle * 16);
    assert.equal(scheduler.size, 1);
    loop.stop();
    assert.equal(scheduler.size, 0);
  }
});
