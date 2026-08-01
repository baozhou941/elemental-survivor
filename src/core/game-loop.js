import { CONFIG } from '../data/config.js';

export class GameLoop {
  constructor({
    step,
    render,
    fixedStep = CONFIG.fixedStep,
    maxDelta = CONFIG.maxDelta,
    requestFrame = globalThis.requestAnimationFrame?.bind(globalThis),
    cancelFrame = globalThis.cancelAnimationFrame?.bind(globalThis),
  }) {
    this.step = step;
    this.render = render;
    this.fixedStep = fixedStep;
    this.maxDelta = maxDelta;
    this.requestFrame = requestFrame;
    this.cancelFrame = cancelFrame;
    this.running = false;
    this.paused = false;
    this.frameId = null;
    this.previousTimestamp = null;
    this.accumulator = 0;
    this.onFrame = this.onFrame.bind(this);
  }

  start() {
    if (this.running) return false;
    this.running = true;
    this.paused = false;
    this.previousTimestamp = null;
    this.accumulator = 0;
    this.frameId = this.requestFrame(this.onFrame);
    return true;
  }

  onFrame(timestamp) {
    if (!this.running) return;

    if (this.paused || this.previousTimestamp === null) {
      this.previousTimestamp = timestamp;
    } else {
      const delta = Math.min(this.maxDelta, Math.max(0, (timestamp - this.previousTimestamp) / 1000));
      this.previousTimestamp = timestamp;
      this.accumulator += delta;
      while (this.running && !this.paused && this.accumulator + Number.EPSILON >= this.fixedStep) {
        this.accumulator -= this.fixedStep;
        this.step(this.fixedStep);
      }
    }

    if (!this.running) return;
    this.render(Math.max(0, Math.min(1, this.accumulator / this.fixedStep)));
    if (this.running) this.frameId = this.requestFrame(this.onFrame);
  }

  pause() {
    this.paused = true;
    this.previousTimestamp = null;
    this.accumulator = 0;
  }

  resume() {
    this.paused = false;
    this.previousTimestamp = null;
    this.accumulator = 0;
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    this.cancelFrame(this.frameId);
    this.frameId = null;
    this.previousTimestamp = null;
    this.accumulator = 0;
  }
}
