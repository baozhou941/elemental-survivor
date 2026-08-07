const MOVE_CODES = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight',
]);

export function directionForKeys(keys) {
  const left = keys.has('KeyA') || keys.has('ArrowLeft');
  const right = keys.has('KeyD') || keys.has('ArrowRight');
  const up = keys.has('KeyW') || keys.has('ArrowUp');
  const down = keys.has('KeyS') || keys.has('ArrowDown');

  return {
    x: Number(right) - Number(left),
    y: Number(down) - Number(up),
  };
}

export function directionForPointer(origin, point, maxDistance = 56) {
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0) return { x: 0, y: 0 };
  const strength = Math.min(1, distance / maxDistance);
  return {
    x: (dx / distance) * strength,
    y: (dy / distance) * strength,
  };
}

export class InputSystem {
  constructor(target = window, onPause = () => {}, pointerTarget = null, onBurst = () => {}, burstButton = null) {
    this.target = target;
    this.onPause = onPause;
    this.pointerTarget = pointerTarget;
    this.onBurst = onBurst;
    this.burstButton = burstButton;
    this.keys = new Set();
    this.pointerId = null;
    this.pointerOrigin = null;
    this.pointerDirection = { x: 0, y: 0 };
    this.attached = false;
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handleBurstPointer = this.handleBurstPointer.bind(this);
    this.clear = this.clear.bind(this);
  }

  attach() {
    if (this.attached) return;
    this.target.addEventListener('keydown', this.handleKeyDown);
    this.target.addEventListener('keyup', this.handleKeyUp);
    this.target.addEventListener('blur', this.clear);
    this.pointerTarget?.addEventListener('pointerdown', this.handlePointerDown);
    this.pointerTarget?.addEventListener('pointermove', this.handlePointerMove);
    this.pointerTarget?.addEventListener('pointerup', this.handlePointerUp);
    this.pointerTarget?.addEventListener('pointercancel', this.handlePointerUp);
    this.burstButton?.addEventListener('pointerdown', this.handleBurstPointer);
    this.attached = true;
  }

  detach() {
    if (!this.attached) return;
    this.target.removeEventListener('keydown', this.handleKeyDown);
    this.target.removeEventListener('keyup', this.handleKeyUp);
    this.target.removeEventListener('blur', this.clear);
    this.pointerTarget?.removeEventListener('pointerdown', this.handlePointerDown);
    this.pointerTarget?.removeEventListener('pointermove', this.handlePointerMove);
    this.pointerTarget?.removeEventListener('pointerup', this.handlePointerUp);
    this.pointerTarget?.removeEventListener('pointercancel', this.handlePointerUp);
    this.burstButton?.removeEventListener('pointerdown', this.handleBurstPointer);
    this.clear();
    this.attached = false;
  }

  handleKeyDown(event) {
    if (MOVE_CODES.has(event.code)) {
      event.preventDefault();
      if (!event.repeat) this.keys.add(event.code);
      return;
    }

    if ((event.code === 'Escape' || event.code === 'KeyP') && !event.repeat) {
      event.preventDefault();
      this.onPause();
      return;
    }

    if ((event.code === 'Space' || event.code === 'KeyE') && !event.repeat) {
      event.preventDefault();
      this.onBurst();
    }
  }

  handleBurstPointer(event) {
    event.preventDefault();
    this.onBurst();
  }

  handleKeyUp(event) {
    if (!MOVE_CODES.has(event.code)) return;
    event.preventDefault();
    this.keys.delete(event.code);
  }

  handlePointerDown(event) {
    if (event.pointerType === 'mouse' || this.pointerId !== null) return;
    event.preventDefault();
    this.pointerId = event.pointerId;
    this.pointerOrigin = { x: event.clientX, y: event.clientY };
    this.pointerDirection = { x: 0, y: 0 };
    this.pointerTarget?.setPointerCapture?.(event.pointerId);
    this.pointerTarget?.classList.add('touch-stick--active');
    this.updatePointerVisual();
  }

  handlePointerMove(event) {
    if (event.pointerId !== this.pointerId || !this.pointerOrigin) return;
    event.preventDefault();
    this.pointerDirection = directionForPointer(
      this.pointerOrigin,
      { x: event.clientX, y: event.clientY },
    );
    this.updatePointerVisual();
  }

  handlePointerUp(event) {
    if (event.pointerId !== this.pointerId) return;
    event.preventDefault();
    this.clearPointer();
  }

  updatePointerVisual() {
    this.pointerTarget?.style.setProperty('--stick-x', `${this.pointerDirection.x * 30}px`);
    this.pointerTarget?.style.setProperty('--stick-y', `${this.pointerDirection.y * 30}px`);
  }

  clearPointer() {
    this.pointerId = null;
    this.pointerOrigin = null;
    this.pointerDirection = { x: 0, y: 0 };
    this.pointerTarget?.classList.remove('touch-stick--active');
    this.updatePointerVisual();
  }

  get direction() {
    if (this.pointerId !== null) return this.pointerDirection;
    return directionForKeys(this.keys);
  }

  clear() {
    this.keys.clear();
    this.clearPointer();
  }
}
