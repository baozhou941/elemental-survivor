import test from 'node:test';
import assert from 'node:assert/strict';

import { CONFIG } from '../src/data/config.js';
import { Renderer } from '../src/runtime/renderer.js';

function createRecordingContext() {
  const operations = [];
  const stateStack = [];
  const stateProperties = [
    'fillStyle',
    'strokeStyle',
    'lineWidth',
    'lineCap',
    'globalAlpha',
    'shadowColor',
    'shadowBlur',
  ];
  const context = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    lineCap: 'butt',
    globalAlpha: 1,
    shadowColor: '',
    shadowBlur: 0,
    operations,
    save() {
      stateStack.push(Object.fromEntries(stateProperties.map((property) => [property, this[property]])));
      operations.push(['save']);
    },
    restore() {
      const state = stateStack.pop();
      if (state) Object.assign(this, state);
      operations.push(['restore']);
    },
    translate(x, y) { operations.push(['translate', x, y]); },
    rotate(angle) { operations.push(['rotate', angle]); },
    beginPath() { operations.push(['beginPath']); },
    closePath() { operations.push(['closePath']); },
    moveTo(x, y) { operations.push(['moveTo', x, y]); },
    lineTo(x, y) { operations.push(['lineTo', x, y]); },
    arc(x, y, radius, start, end) { operations.push(['arc', x, y, radius, start, end]); },
    fill() { operations.push(['fill', this.fillStyle, this.shadowBlur]); },
    stroke() { operations.push(['stroke', this.strokeStyle, this.shadowBlur]); },
    fillRect(x, y, width, height) { operations.push(['fillRect', x, y, width, height, this.fillStyle, this.shadowBlur]); },
    createRadialGradient(...args) {
      const stops = [];
      operations.push(['createRadialGradient', ...args, stops]);
      return {
        addColorStop(offset, color) { stops.push([offset, color]); },
      };
    },
  };
  return context;
}

test('recording context restores saved drawing state', () => {
  const context = createRecordingContext();
  context.fillStyle = '#123456';
  context.shadowBlur = 3;
  context.save();
  context.fillStyle = '#ffffff';
  context.shadowBlur = 12;
  context.restore();

  assert.equal(context.fillStyle, '#123456');
  assert.equal(context.shadowBlur, 3);
});

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

test('viewport culling respects the 96px margin on all four edges', () => {
  const renderer = new Renderer({ getContext: () => ({}) }, CONFIG);
  renderer.setViewport(0, 0, 100, 100);
  const radius = 2;

  assert.equal(renderer.isVisible({ x: -98, y: 50 }, radius), true);
  assert.equal(renderer.isVisible({ x: -99, y: 50 }, radius), false);
  assert.equal(renderer.isVisible({ x: 198, y: 50 }, radius), true);
  assert.equal(renderer.isVisible({ x: 199, y: 50 }, radius), false);
  assert.equal(renderer.isVisible({ x: 50, y: -98 }, radius), true);
  assert.equal(renderer.isVisible({ x: 50, y: -99 }, radius), false);
  assert.equal(renderer.isVisible({ x: 50, y: 198 }, radius), true);
  assert.equal(renderer.isVisible({ x: 50, y: 199 }, radius), false);
});

test('routine kills stay still while hurt and reactions use restrained shake', () => {
  const renderer = new Renderer({ getContext: () => ({}) }, CONFIG);

  renderer.react([{ type: 'kill' }]);
  assert.equal(renderer.shake, 0);

  renderer.react([{ type: 'hurt', x: 10, y: 10, sourceX: 0, sourceY: 10 }]);
  assert.ok(renderer.shake >= 2.5 && renderer.shake <= 3);

  renderer.shake = 0;
  renderer.react([{ type: 'reactionActivate', reactionId: 'fireTornado', x: 10, y: 10 }]);
  assert.ok(renderer.shake >= 2.5 && renderer.shake <= 3);

  renderer.shake = 0;
  renderer.react([{ type: 'reactionHit' }]);
  assert.ok(renderer.shake >= 2.5 && renderer.shake <= 3);
});

test('XP glow stays within tier budgets and a distant common mote has no glow', () => {
  const context = createRecordingContext();
  const renderer = new Renderer({ getContext: () => context }, CONFIG);
  const player = { x: 0, y: 0, pickupRadius: 12 };

  renderer.drawXp(context, [
    { x: 100, y: 0, radius: 2, tier: 'small' },
    { x: 2, y: 0, radius: 3, tier: 'small' },
    { x: 100, y: 0, radius: 5, tier: 'rare' },
    { x: 100, y: 0, radius: 7, tier: 'elite' },
  ], player);

  const fillGlows = context.operations.filter(([name]) => name === 'fill').map(([, , glow]) => glow);
  assert.equal(fillGlows[0], 0);
  assert.ok(Math.max(...fillGlows) <= CONFIG.visual.glow.xp.elite);
});

test('player uses a notched forward arc, rear health arc, and time-stable element sockets', () => {
  const drawAt = (time) => {
    const context = createRecordingContext();
    const renderer = new Renderer({ getContext: () => context }, CONFIG);
    renderer.drawPlayer(context, {
      time,
      player: { x: 20, y: 30, radius: 15, health: 3, maxHealth: 6, invulnerableUntil: 0 },
      burst: { activeUntil: 0 },
      weapons: {
        fireball: { element: 'fire' },
        windBlade: { element: 'wind' },
        iceShard: { element: 'ice' },
      },
    });
    return context.operations;
  };
  const first = drawAt(1);
  const second = drawAt(9);
  const arcs = first.filter(([name]) => name === 'arc');

  assert.ok(arcs.length >= 3, 'forward notch and rear health must use separate arcs');
  assert.ok(arcs.some(([, , , , start, end]) => start < 0 && end < 0));
  assert.ok(arcs.some(([, , , , start, end]) => start > 0 && end > 0));
  const socketCenters = (operations) => operations
    .filter(([name]) => name === 'translate')
    .slice(1);
  assert.deepEqual(socketCenters(first), socketCenters(second));
});

test('player glow is restricted to the core silhouette', () => {
  const context = createRecordingContext();
  const renderer = new Renderer({ getContext: () => context }, CONFIG);
  renderer.drawPlayer(context, {
    time: 1,
    player: { x: 20, y: 30, radius: 15, health: 3, maxHealth: 6, invulnerableUntil: 0 },
    burst: { activeUntil: 0 },
    weapons: {
      fireball: { element: 'fire' },
      windBlade: { element: 'wind' },
    },
  });

  const fills = context.operations.filter(([name]) => name === 'fill');
  const strokes = context.operations.filter(([name]) => name === 'stroke');
  assert.equal(fills[0][2], CONFIG.visual.glow.player);
  assert.equal(strokes[0][2], CONFIG.visual.glow.player);
  assert.ok(fills.slice(1).every(([, , glow]) => glow === 0));
  assert.ok(strokes.slice(1).every(([, , glow]) => glow === 0));
});

test('normal enemy outline is subdued while elite outline remains stronger', () => {
  const drawEnemy = (elite) => {
    const context = createRecordingContext();
    const renderer = new Renderer({ getContext: () => context }, CONFIG);
    renderer.drawEnemies(context, [{
      id: 1,
      type: 'chaser',
      x: 20,
      y: 20,
      radius: 10,
      health: 10,
      maxHealth: 10,
      slowedUntil: 0,
      elite,
    }], 1, { x: 40, y: 20 });
    return context.operations.filter(([name]) => name === 'stroke');
  };

  const normalStrokes = drawEnemy(false);
  const eliteStrokes = drawEnemy(true);
  const whiteOutline = normalStrokes.find(([, style]) => typeof style === 'string' && style.startsWith('rgba(255,255,255,'));
  const alpha = Number(whiteOutline[1].match(/,([\d.]+)\)$/)[1]);

  assert.ok(alpha <= 0.5);
  assert.ok(eliteStrokes.some(([, style, glow]) => style === '#ffd166' && glow > 0));
});

test('fire tornado and thermal shock use distinct visual grammars', () => {
  const drawReaction = (id) => {
    const context = createRecordingContext();
    const renderer = new Renderer({ getContext: () => context }, CONFIG);
    renderer.drawReactions(context, [{ id, x: 40, y: 40, angle: 0.4 }]);
    return context.operations;
  };
  const fire = drawReaction('fireTornado');
  const thermal = drawReaction('thermalShock');

  assert.ok(fire.some(([name]) => name === 'createRadialGradient'));
  assert.ok(fire.some(([name]) => name === 'arc'));
  assert.equal(thermal.some(([name]) => name === 'createRadialGradient'), false);
  assert.equal(thermal.some(([name]) => name === 'arc'), false);
  assert.ok(thermal.some(([name, style]) => name === 'stroke' && style === 'rgba(145,221,255,.9)'));
  assert.ok(thermal.some(([name, style]) => name === 'stroke' && style === 'rgba(239,252,255,.95)'));
  assert.ok(thermal.some(([name, style]) => name === 'stroke' && style === 'rgba(255,117,79,.9)'));
});

test('projectiles and reactions stay within their independent glow budgets', () => {
  const projectileContext = createRecordingContext();
  const reactionContext = createRecordingContext();
  const renderer = new Renderer({ getContext: () => projectileContext }, CONFIG);
  renderer.drawProjectiles(projectileContext, [
    { element: 'fire', x: 10, y: 10, vx: 2, vy: 0, radius: 4 },
    { element: 'ice', x: 20, y: 10, vx: 2, vy: 0, radius: 4 },
    { element: 'wind', x: 30, y: 10, vx: 2, vy: 0, radius: 4 },
  ]);
  renderer.drawReactions(reactionContext, [
    { id: 'fireTornado', x: 40, y: 40, angle: 0 },
    { id: 'thermalShock', x: 60, y: 40, angle: 0 },
  ]);

  const projectileGlows = projectileContext.operations
    .filter(([name]) => name === 'fill' || name === 'stroke')
    .map(([, , glow]) => glow);
  const reactionGlows = reactionContext.operations
    .filter(([name]) => name === 'fill' || name === 'stroke')
    .map(([, , glow]) => glow);
  assert.ok(Math.max(...projectileGlows) <= CONFIG.visual.glow.projectile);
  assert.ok(projectileGlows.includes(CONFIG.visual.glow.projectile));
  assert.ok(Math.max(...reactionGlows) <= CONFIG.visual.glow.reaction);
  assert.ok(reactionGlows.includes(CONFIG.visual.glow.reaction));
});
