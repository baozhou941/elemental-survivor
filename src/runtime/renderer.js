const COLORS = {
  fire: '#ff754f',
  wind: '#63f1c2',
  ice: '#91ddff',
  chaser: '#8569b8',
  swift: '#d8ad4d',
  brute: '#bd536a',
};

function polygon(context, x, y, radius, sides, rotation = 0) {
  context.beginPath();
  for (let index = 0; index < sides; index += 1) {
    const angle = rotation + index * Math.PI * 2 / sides;
    const pointX = x + Math.cos(angle) * radius;
    const pointY = y + Math.sin(angle) * radius;
    if (index === 0) context.moveTo(pointX, pointY);
    else context.lineTo(pointX, pointY);
  }
  context.closePath();
}

function drawSlowOverlay(context, radius) {
  const offset = radius + 4;
  const halfTick = Math.max(3, radius * 0.24);
  context.strokeStyle = '#a9e8ff';
  context.lineWidth = 2;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(-halfTick, -offset);
  context.lineTo(halfTick, -offset);
  context.moveTo(-halfTick, offset);
  context.lineTo(halfTick, offset);
  context.moveTo(-offset, -halfTick);
  context.lineTo(-offset, halfTick);
  context.moveTo(offset, -halfTick);
  context.lineTo(offset, halfTick);
  context.stroke();
  context.lineCap = 'butt';
}

export class Renderer {
  constructor(canvas, config) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.config = config;
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.shake = 0;
    this.flash = 0;
    this.hurtCue = null;
    this.bursts = [];
    this.playerPose = { x: null, y: null, angle: -Math.PI / 2, moving: false };
    this.resize = this.resize.bind(this);
  }

  resetTransientEffects() {
    this.shake = 0;
    this.flash = 0;
    this.hurtCue = null;
    this.bursts = [];
    this.playerPose = { x: null, y: null, angle: -Math.PI / 2, moving: false };
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    this.dpr = Math.min(2, Math.max(1, globalThis.devicePixelRatio || 1));
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
  }

  react(events) {
    const now = globalThis.performance?.now?.() ?? Date.now();
    for (const event of events) {
      if (event.type === 'hurt') {
        this.shake = Math.max(this.shake, 5);
        this.flash = 0.45;
        this.hurtCue = {
          angle: Math.atan2(event.sourceY - event.y, event.sourceX - event.x),
          expiresAt: now + 150,
        };
      } else if (event.type === 'kill') {
        this.shake = Math.max(this.shake, 2.2);
      } else if (event.type === 'reactionActivate') {
        this.shake = Math.max(this.shake, 5.5);
        if (event.reactionId === 'thermalShock') {
          this.bursts.push({ x: event.x, y: event.y, startedAt: now, duration: 240 });
        }
      } else if (event.type === 'reactionHit') {
        this.shake = Math.max(this.shake, 3.5);
      }
    }
  }

  render(run) {
    if (this.width === 0 || this.height === 0) this.resize();
    const context = this.context;
    const now = globalThis.performance?.now?.() ?? Date.now();
    context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    context.clearRect(0, 0, this.width, this.height);
    context.fillStyle = '#070b18';
    context.fillRect(0, 0, this.width, this.height);

    const shakeX = (Math.random() - 0.5) * this.shake;
    const shakeY = (Math.random() - 0.5) * this.shake;
    this.shake *= 0.86;
    this.flash *= 0.87;
    const cameraX = run.player.x - this.width / 2 - shakeX;
    const cameraY = run.player.y - this.height / 2 - shakeY;

    context.save();
    context.translate(-cameraX, -cameraY);
    this.drawArena(context, cameraX, cameraY);
    this.drawXp(context, run.xpOrbs, run.player);
    this.drawBursts(context, now);
    this.drawReactions(context, run.reactions);
    this.drawProjectiles(context, run.projectiles);
    this.drawEnemies(context, run.enemies, run.time, run.player);
    this.drawParticles(context, run.particles);
    this.drawPlayer(context, run);
    context.restore();

    this.drawHurtCue(context, now);

    if (this.flash > 0.01) {
      context.fillStyle = `rgba(255, 55, 92, ${this.flash * 0.22})`;
      context.fillRect(0, 0, this.width, this.height);
    }
  }

  drawArena(context, cameraX, cameraY) {
    const { width, height } = this.config.world;
    const grid = 80;
    context.strokeStyle = 'rgba(111, 159, 213, 0.075)';
    context.lineWidth = 1;
    context.beginPath();
    for (let x = Math.max(0, Math.floor(cameraX / grid) * grid); x <= Math.min(width, cameraX + this.width + grid); x += grid) {
      context.moveTo(x, Math.max(0, cameraY));
      context.lineTo(x, Math.min(height, cameraY + this.height));
    }
    for (let y = Math.max(0, Math.floor(cameraY / grid) * grid); y <= Math.min(height, cameraY + this.height + grid); y += grid) {
      context.moveTo(Math.max(0, cameraX), y);
      context.lineTo(Math.min(width, cameraX + this.width), y);
    }
    context.stroke();
    context.strokeStyle = 'rgba(88, 232, 255, 0.28)';
    context.lineWidth = 3;
    context.strokeRect(1.5, 1.5, width - 3, height - 3);
  }

  drawXp(context, orbs, player) {
    const pickupRadiusSquared = player.pickupRadius ** 2;
    context.shadowColor = '#65ffe0';
    for (const orb of orbs) {
      const dx = orb.x - player.x;
      const dy = orb.y - player.y;
      const isNear = dx * dx + dy * dy <= pickupRadiusSquared;
      context.shadowBlur = isNear ? 7 : 0;
      context.fillStyle = isNear ? 'rgba(121,245,207,.18)' : 'rgba(121,245,207,.03)';
      context.strokeStyle = isNear ? '#79f5cf' : 'rgba(121,245,207,.5)';
      context.lineWidth = isNear ? 2 : 1;
      polygon(context, orb.x, orb.y, orb.radius + 1, 4, Math.PI / 4);
      context.fill();
      context.stroke();
      if (isNear) {
        context.fillStyle = '#effff9';
        context.fillRect(orb.x - 1, orb.y - 1, 2, 2);
      }
    }
    context.shadowBlur = 0;
  }

  drawProjectiles(context, projectiles) {
    for (const projectile of projectiles) {
      const color = COLORS[projectile.element] ?? '#ffffff';
      const angle = Math.atan2(projectile.vy, projectile.vx);
      context.shadowColor = color;
      context.shadowBlur = 16;
      context.fillStyle = color;
      context.strokeStyle = 'rgba(255,255,255,.82)';
      context.lineWidth = 1.5;
      if (projectile.element === 'ice') {
        polygon(context, projectile.x, projectile.y, projectile.radius + 2, 4, angle);
        context.fill();
        context.stroke();
      } else if (projectile.element === 'wind') {
        context.save();
        context.translate(projectile.x, projectile.y);
        context.rotate(angle);
        context.beginPath();
        context.arc(0, 0, projectile.radius + 4, -1.05, 1.05);
        context.arc(3, 0, projectile.radius, 1.05, -1.05, true);
        context.closePath();
        context.fill();
        context.stroke();
        context.restore();
      } else {
        context.beginPath();
        context.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
        context.fill();
        context.stroke();
        context.beginPath();
        context.arc(projectile.x, projectile.y, projectile.radius + 3, 0, Math.PI * 2);
        context.stroke();
      }
    }
    context.shadowBlur = 0;
  }

  drawBursts(context, now) {
    this.bursts = this.bursts.filter((burst) => now - burst.startedAt < burst.duration);
    for (const burst of this.bursts) {
      const progress = (now - burst.startedAt) / burst.duration;
      const alpha = 1 - progress;
      const radius = 18 + progress * 62;
      context.lineWidth = 5 - progress * 3;
      context.strokeStyle = `rgba(145,221,255,${alpha * 0.9})`;
      context.beginPath();
      context.arc(burst.x, burst.y, radius, 0, Math.PI * 2);
      context.stroke();
      context.lineWidth = 3;
      context.strokeStyle = `rgba(255,117,79,${alpha * 0.78})`;
      context.beginPath();
      context.arc(burst.x, burst.y, radius * 0.68, 0, Math.PI * 2);
      context.stroke();
    }
  }

  drawHurtCue(context, now) {
    if (!this.hurtCue || now >= this.hurtCue.expiresAt) {
      this.hurtCue = null;
      return;
    }
    const alpha = Math.min(1, (this.hurtCue.expiresAt - now) / 90);
    const radius = Math.min(this.width, this.height) * 0.22;
    context.strokeStyle = `rgba(255,86,122,${alpha * 0.9})`;
    context.lineWidth = 7;
    context.beginPath();
    context.arc(
      this.width / 2,
      this.height / 2,
      radius,
      this.hurtCue.angle - 0.34,
      this.hurtCue.angle + 0.34,
    );
    context.stroke();
  }

  drawEnemies(context, enemies, time, player) {
    for (const enemy of enemies) {
      const color = COLORS[enemy.type];
      const slowed = time < enemy.slowedUntil;
      const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
      const radius = enemy.radius + 2;

      context.save();
      context.translate(enemy.x, enemy.y);
      if (enemy.type !== 'brute') context.rotate(angle);
      context.fillStyle = color;
      context.strokeStyle = 'rgba(255,255,255,.72)';
      context.lineWidth = 1.5;
      context.beginPath();
      if (enemy.type === 'swift') {
        context.moveTo(radius + 5, 0);
        context.lineTo(-radius, radius * 0.72);
        context.lineTo(-radius * 0.55, 0);
        context.lineTo(-radius, -radius * 0.72);
      } else if (enemy.type === 'brute') {
        context.moveTo(radius * 0.58, -radius * 0.78);
        context.lineTo(radius, 0);
        context.lineTo(radius * 0.58, radius * 0.78);
        context.lineTo(-radius * 0.58, radius * 0.78);
        context.lineTo(-radius, 0);
        context.lineTo(-radius * 0.58, -radius * 0.78);
      } else {
        context.moveTo(radius + 4, 0);
        context.lineTo(0, radius);
        context.lineTo(-radius + 4, 4);
        context.lineTo(-radius + 8, 0);
        context.lineTo(-radius + 4, -4);
        context.lineTo(0, -radius);
      }
      context.closePath();
      context.fill();
      context.stroke();

      context.strokeStyle = 'rgba(7,11,24,.78)';
      context.lineWidth = enemy.type === 'brute' ? 3.5 : 2;
      context.beginPath();
      if (enemy.type === 'swift') {
        context.moveTo(-radius * 0.7, -3);
        context.lineTo(radius * 0.1, -3);
        context.moveTo(-radius * 0.7, 3);
        context.lineTo(radius * 0.1, 3);
      } else if (enemy.type === 'brute') {
        context.moveTo(-radius * 0.55, -4);
        context.lineTo(radius * 0.55, -4);
        context.moveTo(-radius * 0.55, 4);
        context.lineTo(radius * 0.55, 4);
      } else {
        context.moveTo(-2, -5);
        context.lineTo(5, 0);
        context.lineTo(-2, 5);
      }
      context.stroke();
      if (slowed) drawSlowOverlay(context, radius);
      context.restore();

      if (enemy.health < enemy.maxHealth) {
        context.fillStyle = 'rgba(0,0,0,.5)';
        context.fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius - 8, enemy.radius * 2, 3);
        context.fillStyle = '#ffffff';
        context.fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius - 8, enemy.radius * 2 * enemy.health / enemy.maxHealth, 3);
      }
    }
  }

  drawReactions(context, reactions) {
    for (const reaction of reactions) {
      const definition = this.config.reactions[reaction.id];
      const radius = definition?.radius ?? 72;
      const gradient = context.createRadialGradient(reaction.x, reaction.y, 8, reaction.x, reaction.y, radius);
      gradient.addColorStop(0, 'rgba(255,232,120,.95)');
      gradient.addColorStop(0.35, 'rgba(255,96,48,.72)');
      gradient.addColorStop(1, 'rgba(83,241,190,0)');
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(reaction.x, reaction.y, radius, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = 'rgba(255,214,121,.85)';
      context.lineWidth = 4;
      context.beginPath();
      context.arc(reaction.x, reaction.y, radius * 0.48, reaction.angle, reaction.angle + Math.PI * 1.45);
      context.stroke();
      context.strokeStyle = 'rgba(91,241,190,.68)';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(reaction.x, reaction.y, radius * 0.68, -reaction.angle, -reaction.angle + Math.PI);
      context.stroke();
    }
  }

  drawParticles(context, particles) {
    for (const particle of particles) {
      context.globalAlpha = Math.max(0, particle.lifetime / particle.maxLifetime);
      context.fillStyle = particle.color;
      context.fillRect(particle.x - particle.radius, particle.y - particle.radius, particle.radius * 2, particle.radius * 2);
    }
    context.globalAlpha = 1;
  }

  drawPlayer(context, run) {
    const player = run.player;
    const invulnerable = run.time < player.invulnerableUntil;
    if (this.playerPose.x !== null) {
      const moveX = player.x - this.playerPose.x;
      const moveY = player.y - this.playerPose.y;
      this.playerPose.moving = moveX * moveX + moveY * moveY > 0.04;
      if (this.playerPose.moving) this.playerPose.angle = Math.atan2(moveY, moveX);
    }
    this.playerPose.x = player.x;
    this.playerPose.y = player.y;

    context.shadowColor = '#58e8ff';
    context.shadowBlur = 22;
    context.fillStyle = invulnerable && Math.floor(run.time * 15) % 2 ? 'rgba(239,252,255,.38)' : '#effcff';
    context.beginPath();
    context.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    context.fill();
    context.shadowBlur = 0;

    context.save();
    context.translate(player.x, player.y);
    context.rotate(this.playerPose.angle);
    context.strokeStyle = '#58e8ff';
    context.lineWidth = 3.5;
    context.beginPath();
    context.arc(0, 0, player.radius + 7, -0.78, 0.78);
    context.stroke();
    context.strokeStyle = 'rgba(88,232,255,.42)';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(0, 0, player.radius + 7, 1.12, Math.PI * 2 - 1.12);
    context.stroke();

    const forwardOffset = this.playerPose.moving ? 2 : 0;
    context.fillStyle = '#07101c';
    context.beginPath();
    context.moveTo(8 + forwardOffset, 0);
    context.lineTo(forwardOffset, 5);
    context.lineTo(-5 + forwardOffset, 0);
    context.lineTo(forwardOffset, -5);
    context.closePath();
    context.fill();
    context.restore();
  }
}
