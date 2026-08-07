import test from 'node:test';
import assert from 'node:assert/strict';

import { directionForKeys, directionForPointer, InputSystem } from '../src/runtime/input.js';

test('directionForKeys supports WASD and arrows with opposing keys cancelling', () => {
  assert.deepEqual(directionForKeys(new Set(['KeyW', 'ArrowRight'])), { x: 1, y: -1 });
  assert.deepEqual(directionForKeys(new Set(['KeyA', 'ArrowLeft'])), { x: -1, y: 0 });
  assert.deepEqual(directionForKeys(new Set(['KeyA', 'KeyD', 'KeyW', 'KeyS'])), { x: 0, y: 0 });
});

test('a repeated OS keydown cannot restore movement after input is cleared', () => {
  const input = new InputSystem({});
  const event = (repeat) => ({ code: 'KeyW', repeat, preventDefault() {} });

  input.handleKeyDown(event(false));
  assert.deepEqual(input.direction, { x: 0, y: -1 });

  input.clear();
  input.handleKeyDown(event(true));
  assert.deepEqual(input.direction, { x: 0, y: 0 });
});

test('elemental burst responds once to keyboard and the mobile action button', () => {
  let activations = 0;
  const button = {
    addEventListener(type, handler) { this[type] = handler; },
    removeEventListener(type) { delete this[type]; },
  };
  const target = {
    addEventListener() {},
    removeEventListener() {},
  };
  const input = new InputSystem(target, () => {}, null, () => { activations += 1; }, button);
  const event = (code, repeat = false) => ({ code, repeat, preventDefault() {} });

  input.attach();
  input.handleKeyDown(event('Space'));
  input.handleKeyDown(event('KeyE'));
  input.handleKeyDown(event('Space', true));
  button.pointerdown({ preventDefault() {} });

  assert.equal(activations, 3);
  input.detach();
  assert.equal(button.pointerdown, undefined);
});

test('directionForPointer scales short drags and clamps long drags', () => {
  assert.deepEqual(directionForPointer({ x: 10, y: 10 }, { x: 10, y: 10 }), { x: 0, y: 0 });
  assert.deepEqual(directionForPointer({ x: 0, y: 0 }, { x: 28, y: 0 }, 56), { x: 0.5, y: 0 });
  assert.deepEqual(directionForPointer({ x: 0, y: 0 }, { x: 120, y: 0 }, 56), { x: 1, y: 0 });
});

test('touch movement follows the active pointer and clears on release', () => {
  const stick = {
    classList: { add() {}, remove() {} },
    style: { setProperty() {} },
    setPointerCapture() {},
  };
  const input = new InputSystem({}, () => {}, stick);
  const event = (overrides = {}) => ({
    pointerId: 7,
    pointerType: 'touch',
    clientX: 100,
    clientY: 100,
    preventDefault() {},
    ...overrides,
  });

  input.handlePointerDown(event());
  input.handlePointerMove(event({ clientX: 156 }));
  assert.deepEqual(input.direction, { x: 1, y: 0 });

  input.handlePointerUp(event({ clientX: 156 }));
  assert.deepEqual(input.direction, { x: 0, y: 0 });
});
