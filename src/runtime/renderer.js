const COLORS = {
  fire: '#ff754f',
  wind: '#63f1c2',
  ice: '#91ddff',
  chaser: '#8569b8',
  swift: '#d8ad4d',
  brute: '#bd536a',
};

const ELEMENT_SOCKET_ANGLES = Object.freeze({
  fire: -2.25,
  ice: Math.PI,
  wind: 2.25,
});

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
    this.viewportLeft = null;
    this.viewportTop = null;
    this.viewportRight = null;
    this.viewportBottom = null;
    this.playerPose = { x: null, y: null, angle: -Math.PI / 2, moving: false };
    this.resize = this.resize.bind(this);
  }

  setViewport(x, y, width, height) {
    this.viewportLeft = x;
    this.viewportTop = y;
    this.viewportRight = x + width;
    this.viewportBottom = y + height;
  }

  isVisible(entity, radius = entity.radius ?? 0) {
    if (this.viewportLeft === null) return true;
    const margin = this.config.visual?.viewportMargin ?? 96;
    return entity.x + radius >= this.viewportLeft - margin
      && entity.x - radius <= this.viewportRight + margin
      && entity.y + radius >= this.viewportTop - margin
      && entity.y - radius <= this.viewportBottom + margin;
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
        this.shake = Math.max(this.shake, 3);
        this.flash = 0.45;
        this.hurtCue = {
          angle: Math.atan2(event.sourceY - event.y, event.sourceX - event.x),
          expiresAt: now + 150,
        };
      } else if (event.type === 'reactionActivate') {
        this.shake = Math.max(this.shake, 3);
        if (event.reactionId === 'thermalShock') {
          this.bursts.push({ x: event.x, y: event.y, startedAt: now, duration: 240 });
        }
      } else if (event.type === 'reactionHit') {
        this.shake = Math.max(this.shake, 2.5);
      } else if (event.type === 'burstActivate') {
        this.shake = Math.max(this.shake, 6.5);
        this.flash = Math.max(this.flash, 0.2);
        this.bursts.push({ x: event.x, y: event.y, startedAt: now, duration: 620, type: 'overdrive' });
      } else if (event.type === 'eliteSpawn') {
        this.shake = Math.max(this.shake, 3.2);
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
    this.setViewport(cameraX, cameraY, this.width, this.height);

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
    const accentGrid = 320;
    context.strokeStyle = 'rgba(99, 241, 194, 0.055)';
    context.lineWidth = 1;
    context.beginPath();
    for (let x = Math.max(0, Math.floor(cameraX / accentGrid) * accentGrid); x <= Math.min(width, cameraX + this.width + accentGrid); x += accentGrid) {
      for (let y = Math.max(0, Math.floor(cameraY / accentGrid) * accentGrid); y <= Math.min(height, cameraY + this.height + accentGrid); y += accentGrid) {
        polygon(context, x, y, 28, 6, Math.PI / 6);
      }
    }
    context.stroke();
    context.strokeStyle = 'rgba(88, 232, 255, 0.28)';
    context.lineWidth = 3;
    context.strokeRect(1.5, 1.5, width - 3, height - 3);
  }

  drawXp(context, orbs, player) {
    const pickupRadiusSquared = player.pickupRadius ** 2;
    const glow = this.config.visual?.glow.xp ?? { far: 0, near: 4, rare: 6, elite: 6 };
    for (const orb of orbs) {
      if (!this.isVisible(orb)) continue;
      const dx = orb.x - player.x;
      const dy = orb.y - player.y;
      const isNear = dx * dx + dy * dy <= pickupRadiusSquared;
      const tier = orb.tier ?? 'small';
      const isElite = tier === 'elite';
      const isRare = tier === 'rare';
      const color = isElite || isRare ? '#ffd166' : '#79f5cf';
      context.shadowColor = color;
      context.shadowBlur = isElite ? glow.elite : isRare ? glow.rare : isNear ? glow.near : glow.far;
      context.fillStyle = isElite
        ? 'rgba(255,209,102,.3)'
        : isRare ? 'rgba(255,209,102,.18)' : isNear ? 'rgba(121,245,207,.2)' : 'rgba(239,252,255,.08)';
      context.strokeStyle = isNear || isElite ? color : isRare ? 'rgba(255,209,102,.72)' : 'rgba(121,245,207,.62)';
      context.lineWidth = isElite ? 2.5 : isNear || isRare ? 2 : 1;
      polygon(context, orb.x, orb.y, orb.radius + (isElite ? 5 : 1), isElite ? 6 : 4, Math.PI / 4);
      context.fill();
      context.stroke();
      if (isElite) {
        context.strokeStyle = 'rgba(255,209,102,.5)';
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(orb.x - orb.radius * 2.4, orb.y + orb.radius * 1.6);
        context.lineTo(orb.x - orb.radius * 0.7, orb.y + orb.radius * 0.45);
        context.stroke();
        context.strokeStyle = 'rgba(255,255,255,.72)';
        context.lineWidth = 1.5;
        polygon(context, orb.x, orb.y, orb.radius + 10, 6, -Math.PI / 4);
        context.stroke();
      }
      if (isRare) {
        context.fillStyle = 'rgba(255,255,255,.72)';
        polygon(context, orb.x + orb.radius * 0.55, orb.y - orb.radius * 0.55, Math.max(2, orb.radius * 0.52), 4, Math.PI / 4);
        context.fill();
      } else if (isNear || isElite) {
        context.fillStyle = '#effff9';
        polygon(context, orb.x, orb.y, Math.max(2, orb.radius * 0.42), 4, Math.PI / 4);
        context.fill();
      }
    }
    context.shadowBlur = 0;
  }

  drawProjectiles(context, projectiles) {
    const projectileGlow = this.config.visual?.glow.projectile ?? 5;
    for (const projectile of projectiles) {
      if (!this.isVisible(projectile)) continue;
      const color = COLORS[projectile.element] ?? '#ffffff';
      const angle = Math.atan2(projectile.vy, projectile.vx);
      context.shadowColor = color;
      context.shadowBlur = projectileGlow;
      context.fillStyle = color;
      context.strokeStyle = 'rgba(255,255,255,.82)';
      context.lineWidth = 1.5;
      const trailLength = projectile.behavior === 'vacuumBlade' ? 22 : projectile.behavior === 'mirrorIce' ? 18 : 12;
      const velocityLength = Math.hypot(projectile.vx, projectile.vy) || 1;
      context.strokeStyle = `${color}88`;
      context.lineWidth = projectile.behavior ? 3 : 1.5;
      context.beginPath();
      context.moveTo(projectile.x, projectile.y);
      context.lineTo(
        projectile.x - projectile.vx / velocityLength * trailLength,
        projectile.y - projectile.vy / velocityLength * trailLength,
      );
      context.stroke();
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
        context.save();
        context.translate(projectile.x, projectile.y);
        context.rotate(angle);
        context.beginPath();
        context.moveTo(projectile.radius + 4, 0);
        context.lineTo(-projectile.radius, projectile.radius * 0.72);
        context.lineTo(-projectile.radius * 0.55, 0);
        context.lineTo(-projectile.radius, -projectile.radius * 0.72);
        context.closePath();
        context.fill();
        context.stroke();
        context.restore();
      }
    }
    context.shadowBlur = 0;
  }

  drawBursts(context, now) {
    const burstGlow = this.config.visual?.glow.burst ?? 12;
    let retained = 0;
    for (let index = 0; index < this.bursts.length; index += 1) {
      const burst = this.bursts[index];
      if (now - burst.startedAt >= burst.duration) continue;
      this.bursts[retained] = burst;
      retained += 1;
      const progress = (now - burst.startedAt) / burst.duration;
      const alpha = 1 - progress;
      const isOverdrive = burst.type === 'overdrive';
      const radius = 18 + progress * (isOverdrive ? 150 : 62);
      if (!this.isVisible(burst, radius)) continue;
      context.shadowColor = isOverdrive ? '#63f1c2' : '#91ddff';
      context.shadowBlur = burstGlow;
      context.lineWidth = 5 - progress * 3;
      context.strokeStyle = `rgba(${isOverdrive ? '99,241,194' : '145,221,255'},${alpha * 0.9})`;
      context.beginPath();
      context.arc(burst.x, burst.y, radius, 0, Math.PI * 2);
      context.stroke();
      context.lineWidth = 3;
      context.strokeStyle = `rgba(255,117,79,${alpha * 0.78})`;
      context.beginPath();
      context.arc(burst.x, burst.y, radius * 0.68, 0, Math.PI * 2);
      context.stroke();
      if (isOverdrive) {
        context.strokeStyle = `rgba(255,255,255,${alpha * 0.55})`;
        context.lineWidth = 2;
        polygon(context, burst.x, burst.y, radius * 0.82, 6, progress * Math.PI);
        context.stroke();
      }
    }
    this.bursts.length = retained;
    context.shadowBlur = 0;
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
      if (!this.isVisible(enemy, enemy.radius + (enemy.elite ? 10 : 2))) continue;
      const color = COLORS[enemy.type];
      const slowed = time < enemy.slowedUntil;
      const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
      const radius = enemy.radius + 2;

      context.save();
      context.translate(enemy.x, enemy.y);
      if (enemy.type !== 'brute') context.rotate(angle);
      context.fillStyle = color;
      context.strokeStyle = 'rgba(255,255,255,.46)';
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

      if (enemy.type === 'swift') {
        context.fillStyle = 'rgba(216,173,77,.72)';
        context.beginPath();
        context.moveTo(-radius * 0.25, -radius * 0.22);
        context.lineTo(-radius * 1.08, -radius * 0.92);
        context.lineTo(-radius * 0.72, -radius * 0.12);
        context.closePath();
        context.fill();
        context.beginPath();
        context.moveTo(-radius * 0.25, radius * 0.22);
        context.lineTo(-radius * 1.08, radius * 0.92);
        context.lineTo(-radius * 0.72, radius * 0.12);
        context.closePath();
        context.fill();
      }

      context.fillStyle = 'rgba(7,11,24,.72)';
      context.beginPath();
      if (enemy.type === 'swift') {
        context.moveTo(radius * 0.5, 0);
        context.lineTo(-radius * 0.18, radius * 0.34);
        context.lineTo(-radius * 0.18, -radius * 0.34);
      } else if (enemy.type === 'brute') {
        polygon(context, 0, 0, radius * 0.48, 6, Math.PI / 6);
      } else {
        polygon(context, 0, 0, radius * 0.42, 4, Math.PI / 4);
      }
      context.closePath();
      context.fill();

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
      if (enemy.elite) {
        context.shadowColor = '#ffd166';
        context.shadowBlur = 12;
        context.strokeStyle = '#ffd166';
        context.lineWidth = 2.5;
        polygon(context, 0, 0, radius + 8, 6, runPulse(time, enemy.id));
        context.stroke();
        context.shadowBlur = 0;
        context.fillStyle = '#ffd166';
        context.fillRect(-6, -radius - 13, 12, 3);
      }
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
    const reactionGlow = this.config.visual?.glow.reaction ?? 8;
    for (const reaction of reactions) {
      const definition = this.config.reactions[reaction.id];
      const radius = definition?.radius ?? 72;
      if (!this.isVisible(reaction, radius)) continue;
      context.shadowColor = reaction.id === 'thermalShock' ? '#91ddff' : '#ff754f';
      context.shadowBlur = reactionGlow;
      if (reaction.id === 'fireTornado') {
        context.strokeStyle = 'rgba(255,245,190,.7)';
        context.lineWidth = 2;
        for (let ring = 0; ring < 3; ring += 1) {
          context.beginPath();
          context.arc(
            reaction.x,
            reaction.y,
            radius * (0.28 + ring * 0.17),
            reaction.angle + ring,
            reaction.angle + ring + Math.PI * 1.25,
          );
          context.stroke();
        }
        context.strokeStyle = 'rgba(99,241,194,.55)';
        context.lineWidth = 1.5;
        polygon(context, reaction.x, reaction.y, radius * 0.78, 6, reaction.angle * 0.35);
        context.stroke();

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
      } else if (reaction.id === 'thermalShock') {
        context.strokeStyle = 'rgba(145,221,255,.9)';
        context.lineWidth = 3;
        polygon(context, reaction.x, reaction.y, radius * 0.72, 8, Math.PI / 8);
        context.stroke();

        context.strokeStyle = 'rgba(239,252,255,.95)';
        context.lineWidth = 1.8;
        context.beginPath();
        for (const angle of [0.2, 2.25, 4.45]) {
          context.moveTo(
            reaction.x + Math.cos(angle) * radius * 0.12,
            reaction.y + Math.sin(angle) * radius * 0.12,
          );
          context.lineTo(
            reaction.x + Math.cos(angle + 0.12) * radius * 0.38,
            reaction.y + Math.sin(angle + 0.12) * radius * 0.38,
          );
          context.lineTo(
            reaction.x + Math.cos(angle - 0.08) * radius * 0.63,
            reaction.y + Math.sin(angle - 0.08) * radius * 0.63,
          );
        }
        context.stroke();

        context.strokeStyle = 'rgba(255,117,79,.9)';
        context.lineWidth = 3;
        context.beginPath();
        for (let shard = 0; shard < 5; shard += 1) {
          const angle = reaction.angle + shard * Math.PI * 2 / 5;
          context.moveTo(
            reaction.x + Math.cos(angle) * radius * 0.78,
            reaction.y + Math.sin(angle) * radius * 0.78,
          );
          context.lineTo(
            reaction.x + Math.cos(angle + 0.08) * radius * 0.91,
            reaction.y + Math.sin(angle + 0.08) * radius * 0.91,
          );
        }
        context.stroke();
      }
    }
    context.shadowBlur = 0;
  }

  drawParticles(context, particles) {
    for (const particle of particles) {
      if (!this.isVisible(particle)) continue;
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

    const burstActive = run.time < run.burst.activeUntil;
    const playerGlow = this.config.visual?.glow.player ?? 12;
    context.shadowColor = burstActive ? '#ffd166' : '#58e8ff';
    context.shadowBlur = playerGlow;

    context.save();
    context.translate(player.x, player.y);
    context.rotate(this.playerPose.angle);
    context.fillStyle = invulnerable && Math.floor(run.time * 15) % 2 ? 'rgba(239,252,255,.38)' : '#dffcff';
    context.strokeStyle = burstActive ? '#ffd166' : '#58e8ff';
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(player.radius + 4, 0);
    context.lineTo(player.radius * 0.08, player.radius * 0.82);
    context.lineTo(-player.radius * 0.72, player.radius * 0.46);
    context.lineTo(-player.radius * 0.52, 0);
    context.lineTo(-player.radius * 0.84, -player.radius * 0.58);
    context.lineTo(player.radius * 0.08, -player.radius * 0.82);
    context.closePath();
    context.fill();
    context.stroke();
    context.shadowBlur = 0;

    context.strokeStyle = burstActive ? '#ffd166' : '#58e8ff';
    context.lineWidth = 3.5;
    context.beginPath();
    context.arc(0, 0, player.radius + 7, -0.82, -0.18);
    context.stroke();
    context.beginPath();
    context.arc(0, 0, player.radius + 7, 0.18, 0.82);
    context.stroke();
    const maxHealth = player.maxHealth || 1;
    const healthRatio = Math.max(0, Math.min(1, (player.health ?? maxHealth) / maxHealth));
    context.strokeStyle = healthRatio <= 0.34 ? '#ff567a' : 'rgba(88,232,255,.5)';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(0, 0, player.radius + 7, 1.12, 1.12 + (Math.PI * 2 - 2.24) * healthRatio);
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

    for (const weaponId in run.weapons) {
      const weapon = run.weapons[weaponId];
      const element = weapon.element;
      const angle = ELEMENT_SOCKET_ANGLES[element];
      if (angle === undefined) continue;
      const orbit = player.radius + 12;
      context.save();
      context.translate(Math.cos(angle) * orbit, Math.sin(angle) * orbit);
      context.fillStyle = COLORS[element] ?? '#ffffff';
      polygon(context, 0, 0, 2.8, 4, angle);
      context.fill();
      context.restore();
    }
    if (burstActive) {
      context.strokeStyle = 'rgba(255,209,102,.65)';
      context.lineWidth = 2;
      polygon(context, 0, 0, player.radius + 14, 6, run.time * 1.5);
      context.stroke();
    }
    context.restore();
    context.shadowBlur = 0;
  }
}

function runPulse(time, id = 0) {
  return time * 0.8 + id * 0.37;
}
