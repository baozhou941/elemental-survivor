import { CONFIG } from '../data/config.js';
import { getEncounterPlan } from './director.js';
import { damagePlayer, gainXp } from './model.js';
import { nextRandom } from './random.js';

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function emitParticles(run, x, y, color, count, config = CONFIG) {
  const available = Math.max(0, config.limits.particles - run.particles.length);
  const amount = Math.min(count, available);
  for (let index = 0; index < amount; index += 1) {
    const angle = nextRandom(run) * Math.PI * 2;
    const speed = 45 + nextRandom(run) * 115;
    const lifetime = 0.22 + nextRandom(run) * 0.26;
    run.particles.push({
      id: run.nextEntityId++,
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 1.5 + nextRandom(run) * 2.5,
      color,
      lifetime,
      maxLifetime: lifetime,
    });
  }
}

export function stepParticles(run, dt) {
  for (const particle of run.particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= 0.94;
    particle.vy *= 0.94;
    particle.lifetime -= dt;
  }
  run.particles = run.particles.filter(({ lifetime }) => lifetime > 0);
}

export function stepPlayer(run, input, dt, config = CONFIG) {
  const length = Math.hypot(input.x, input.y);
  const scale = length > 1 ? 1 / length : 1;
  run.player.x = clamp(
    run.player.x + input.x * scale * run.player.speed * dt,
    run.player.radius,
    config.world.width - run.player.radius,
  );
  run.player.y = clamp(
    run.player.y + input.y * scale * run.player.speed * dt,
    run.player.radius,
    config.world.height - run.player.radius,
  );
}

export function spawnEnemy(run, type, x, y, config = CONFIG) {
  const definition = config.enemies[type];
  if (!definition || run.enemies.length >= config.limits.enemies) return null;
  const enemy = {
    id: run.nextEntityId++,
    type,
    x,
    y,
    radius: definition.radius,
    health: definition.health,
    maxHealth: definition.health,
    speed: definition.speed,
    damage: definition.damage,
    xp: definition.xp,
    slowMultiplier: 1,
    slowedUntil: 0,
    dead: false,
    phase: (run.nextEntityId * 1.618) % (Math.PI * 2),
  };
  run.enemies.push(enemy);
  return enemy;
}

export function stepEnemies(run, dt, config = CONFIG) {
  for (const enemy of run.enemies) {
    if (enemy.dead) continue;
    const dx = run.player.x - enemy.x;
    const dy = run.player.y - enemy.y;
    const distance = Math.hypot(dx, dy) || 1;
    const slow = run.time < enemy.slowedUntil ? enemy.slowMultiplier : 1;
    if (slow < 1) run.stats.slowEnemySeconds += dt;
    const speed = enemy.speed * slow;
    let moveX = dx / distance;
    let moveY = dy / distance;
    if (enemy.type === 'swift') {
      const weave = Math.sin(run.time * 7 + enemy.phase) * 0.34;
      moveX += (-dy / distance) * weave;
      moveY += (dx / distance) * weave;
      const magnitude = Math.hypot(moveX, moveY);
      moveX /= magnitude;
      moveY /= magnitude;
    }
    enemy.x += moveX * speed * dt;
    enemy.y += moveY * speed * dt;

    const contactDistance = enemy.radius + run.player.radius;
    if ((enemy.x - run.player.x) ** 2 + (enemy.y - run.player.y) ** 2 <= contactDistance ** 2) {
      const sourceX = enemy.x;
      const sourceY = enemy.y;
      if (damagePlayer(run, enemy.damage, run.time, config, {
        kind: 'contact',
        enemyType: enemy.type,
        label: config.enemies[enemy.type].name,
      })) {
        const awayX = enemy.x - run.player.x;
        const awayY = enemy.y - run.player.y;
        const awayLength = Math.hypot(awayX, awayY);
        const fallbackAngle = enemy.phase;
        const normalX = awayLength > 0.001 ? awayX / awayLength : Math.cos(fallbackAngle);
        const normalY = awayLength > 0.001 ? awayY / awayLength : Math.sin(fallbackAngle);
        const separation = contactDistance + 14;
        enemy.x = clamp(run.player.x + normalX * separation, enemy.radius, config.world.width - enemy.radius);
        enemy.y = clamp(run.player.y + normalY * separation, enemy.radius, config.world.height - enemy.radius);
        run.events.push({ type: 'hurt', x: run.player.x, y: run.player.y, sourceX, sourceY });
        emitParticles(run, run.player.x, run.player.y, '#ff5477', 12, config);
      }
    }
  }
}

function nearestEnemy(run) {
  let nearest = null;
  let nearestDistanceSquared = Infinity;
  for (const enemy of run.enemies) {
    if (enemy.dead) continue;
    const dx = enemy.x - run.player.x;
    const dy = enemy.y - run.player.y;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared < nearestDistanceSquared) {
      nearest = enemy;
      nearestDistanceSquared = distanceSquared;
    }
  }
  return nearest;
}

function fireWeapon(run, weapon, target, config) {
  const baseAngle = Math.atan2(target.y - run.player.y, target.x - run.player.x);
  for (let index = 0; index < weapon.projectiles; index += 1) {
    if (run.projectiles.length >= config.limits.projectiles) break;
    const angle = baseAngle + (index - (weapon.projectiles - 1) / 2) * 0.16;
    run.projectiles.push({
      id: run.nextEntityId++,
      x: run.player.x,
      y: run.player.y,
      vx: Math.cos(angle) * weapon.speed,
      vy: Math.sin(angle) * weapon.speed,
      radius: weapon.radius,
      lifetime: weapon.lifetime,
      damage: weapon.damage,
      pierceRemaining: weapon.pierce,
      weaponId: weapon.id,
      element: weapon.element,
      slowMultiplier: weapon.slowMultiplier,
      slowDuration: weapon.slowDuration,
      hitIds: new Set(),
      expired: false,
    });
  }
}

export function stepWeapons(run, dt, config = CONFIG) {
  const target = nearestEnemy(run);
  for (const weapon of Object.values(run.weapons)) {
    weapon.cooldownRemaining = Math.max(0, weapon.cooldownRemaining - dt);
    if (!target || weapon.cooldownRemaining > 0) continue;
    fireWeapon(run, weapon, target, config);
    weapon.cooldownRemaining = weapon.cooldown;
    run.stats.attacks += 1;
  }
}

function killEnemy(run, enemy, config) {
  if (enemy.dead) return;
  enemy.dead = true;
  for (const cooldowns of Object.values(run.reactionTriggerCooldowns)) cooldowns.delete(enemy.id);
  run.stats.kills += 1;
  run.stats.xpProduced += enemy.xp;
  if (run.stats.milestones.firstKillAt === null) run.stats.milestones.firstKillAt = run.time;
  run.stats.killsByType[enemy.type] = (run.stats.killsByType[enemy.type] ?? 0) + 1;
  run.events.push({ type: 'kill', x: enemy.x, y: enemy.y, enemyType: enemy.type });
  emitParticles(run, enemy.x, enemy.y, '#76f7c8', 8, config);
  if (run.xpOrbs.length < config.limits.xpOrbs) {
    run.xpOrbs.push({
      id: run.nextEntityId++,
      x: enemy.x,
      y: enemy.y,
      radius: 5,
      value: enemy.xp,
      collected: false,
    });
  } else if (run.xpOrbs.length > 0) {
    let nearestOrb = run.xpOrbs[0];
    let nearestDistanceSquared = Infinity;
    for (const orb of run.xpOrbs) {
      const dx = orb.x - enemy.x;
      const dy = orb.y - enemy.y;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared < nearestDistanceSquared) {
        nearestOrb = orb;
        nearestDistanceSquared = distanceSquared;
      }
    }
    nearestOrb.value += enemy.xp;
  }
}

function triggerBurstReaction(run, reactionId, triggerEnemy, config) {
  const definition = config.reactions[reactionId];
  if (!run.unlockedReactions[reactionId] || definition?.mode !== 'triggeredBurst') return false;

  const cooldowns = run.reactionTriggerCooldowns[reactionId]
    ?? (run.reactionTriggerCooldowns[reactionId] = new Map());
  if ((cooldowns.get(triggerEnemy.id) ?? 0) > run.time) return false;
  cooldowns.set(triggerEnemy.id, run.time + definition.triggerCooldown);

  run.stats.reactionActivations[reactionId] = (run.stats.reactionActivations[reactionId] ?? 0) + 1;
  run.events.push({
    type: 'reactionActivate',
    reactionId,
    x: triggerEnemy.x,
    y: triggerEnemy.y,
  });

  let hits = 0;
  for (const enemy of run.enemies) {
    if (enemy.dead || (enemy.health <= 0 && enemy !== triggerEnemy)) continue;
    const reach = definition.radius + enemy.radius;
    const dx = enemy.x - triggerEnemy.x;
    const dy = enemy.y - triggerEnemy.y;
    if (dx * dx + dy * dy > reach * reach) continue;

    enemy.health -= definition.damage;
    hits += 1;
    run.stats.damageByReaction[reactionId] =
      (run.stats.damageByReaction[reactionId] ?? 0) + definition.damage;
    run.events.push({
      type: 'reactionHit',
      reactionId,
      x: enemy.x,
      y: enemy.y,
      damage: definition.damage,
    });
    if (enemy.health <= 0) killEnemy(run, enemy, config);
  }

  run.stats.reactionHits[reactionId] = (run.stats.reactionHits[reactionId] ?? 0) + hits;
  if (hits === 0) {
    run.stats.reactionZeroHitActivations[reactionId] =
      (run.stats.reactionZeroHitActivations[reactionId] ?? 0) + 1;
  }
  emitParticles(run, triggerEnemy.x, triggerEnemy.y, '#73d7ff', 8, config);
  emitParticles(run, triggerEnemy.x, triggerEnemy.y, '#ff7b45', 8, config);
  return true;
}

export function stepProjectiles(run, dt, config = CONFIG) {
  for (const projectile of run.projectiles) {
    if (projectile.expired) continue;
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    projectile.lifetime -= dt;
    if (projectile.lifetime <= 0) {
      projectile.expired = true;
      continue;
    }

    for (const enemy of run.enemies) {
      if (enemy.dead || projectile.hitIds.has(enemy.id)) continue;
      const reach = projectile.radius + enemy.radius;
      const dx = projectile.x - enemy.x;
      const dy = projectile.y - enemy.y;
      if (dx * dx + dy * dy > reach * reach) continue;
      const wasSlowed = run.time < enemy.slowedUntil;
      projectile.hitIds.add(enemy.id);
      enemy.health -= projectile.damage;
      run.events.push({ type: 'hit', x: enemy.x, y: enemy.y, element: projectile.element });
      emitParticles(run, projectile.x, projectile.y, projectile.element === 'fire' ? '#ff875e' : projectile.element === 'ice' ? '#8de8ff' : '#b7fff1', 3, config);
      run.stats.damageByWeapon[projectile.weaponId] =
        (run.stats.damageByWeapon[projectile.weaponId] ?? 0) + projectile.damage;
      if (projectile.element === 'ice') {
        enemy.slowMultiplier = projectile.slowMultiplier;
        enemy.slowedUntil = Math.max(enemy.slowedUntil, run.time + projectile.slowDuration);
      }
      if (projectile.element === 'fire' && wasSlowed) {
        triggerBurstReaction(run, 'thermalShock', enemy, config);
      }
      if (enemy.health <= 0) killEnemy(run, enemy, config);
      if (projectile.pierceRemaining <= 0) {
        projectile.expired = true;
        break;
      }
      projectile.pierceRemaining -= 1;
    }
  }

  run.projectiles = run.projectiles.filter(({ expired }) => !expired);
  run.enemies = run.enemies.filter(({ dead }) => !dead);
}

export function stepXpOrbs(run, dt) {
  let collectedXp = 0;
  const previousLevel = run.player.level;
  for (const orb of run.xpOrbs) {
    if (orb.collected) continue;
    const dx = run.player.x - orb.x;
    const dy = run.player.y - orb.y;
    const distance = Math.hypot(dx, dy);
    if (distance > run.player.pickupRadius) continue;

    if (distance <= run.player.radius + orb.radius + 4) {
      orb.collected = true;
      collectedXp += orb.value;
      run.events.push({ type: 'xp', x: run.player.x, y: run.player.y, value: orb.value });
      continue;
    }

    const travel = Math.min(distance, Math.max(240, distance * 8) * dt);
    orb.x += (dx / distance) * travel;
    orb.y += (dy / distance) * travel;
  }
  run.xpOrbs = run.xpOrbs.filter(({ collected }) => !collected);
  if (collectedXp > 0) {
    run.stats.xpCollected += collectedXp;
    if (run.stats.milestones.firstXpAt === null) run.stats.milestones.firstXpAt = run.time;
    gainXp(run, collectedXp);
    if (run.player.level > previousLevel) run.events.push({ type: 'levelUp', level: run.player.level });
  }
}

export function ensureReactions(run, config = CONFIG) {
  for (const reactionId of Object.keys(run.unlockedReactions)) {
    if (!run.unlockedReactions[reactionId]) continue;
    if (run.reactions.some(({ id }) => id === reactionId)) continue;
    if ((run.reactionCooldowns[reactionId] ?? 0) > run.time) continue;
    const definition = config.reactions[reactionId];
    if (!definition || definition.mode !== 'orbit') continue;
    const target = nearestEnemy(run);
    const angle = target
      ? Math.atan2(target.y - run.player.y, target.x - run.player.x)
      : 0;
    run.reactions.push({
      id: reactionId,
      startedAt: run.time,
      angle,
      x: run.player.x + Math.cos(angle) * definition.orbitRadius,
      y: run.player.y + Math.sin(angle) * definition.orbitRadius,
      hits: 0,
      nextHitByEnemy: new Map(),
    });
    run.events.push({
      type: 'reactionActivate',
      reactionId,
      x: run.player.x,
      y: run.player.y,
    });
    run.stats.reactionActivations[reactionId] =
      (run.stats.reactionActivations[reactionId] ?? 0) + 1;
  }
}

export function stepReactions(run, dt, config = CONFIG) {
  ensureReactions(run, config);
  for (const reaction of run.reactions) {
    const definition = config.reactions[reaction.id];
    reaction.angle += definition.angularSpeed * dt;
    reaction.x = run.player.x + Math.cos(reaction.angle) * definition.orbitRadius;
    reaction.y = run.player.y + Math.sin(reaction.angle) * definition.orbitRadius;

    for (const enemy of run.enemies) {
      if (enemy.dead || (reaction.nextHitByEnemy.get(enemy.id) ?? 0) > run.time) continue;
      const reach = definition.radius + enemy.radius;
      const dx = reaction.x - enemy.x;
      const dy = reaction.y - enemy.y;
      if (dx * dx + dy * dy > reach * reach) continue;
      enemy.health -= definition.damage;
      reaction.hits += 1;
      run.stats.reactionHits[reaction.id] = (run.stats.reactionHits[reaction.id] ?? 0) + 1;
      run.events.push({ type: 'reactionHit', x: enemy.x, y: enemy.y, reactionId: reaction.id });
      emitParticles(run, enemy.x, enemy.y, '#ffb04a', 4, config);
      reaction.nextHitByEnemy.set(enemy.id, run.time + definition.hitInterval);
      run.stats.damageByReaction[reaction.id] =
        (run.stats.damageByReaction[reaction.id] ?? 0) + definition.damage;
      if (enemy.health <= 0) killEnemy(run, enemy, config);
    }

    if (run.time - reaction.startedAt >= definition.duration) {
      reaction.expired = true;
      if (reaction.hits === 0) {
        run.stats.reactionZeroHitActivations[reaction.id] =
          (run.stats.reactionZeroHitActivations[reaction.id] ?? 0) + 1;
      }
      run.reactionCooldowns[reaction.id] = run.time + 1.2;
    }
  }
  run.reactions = run.reactions.filter(({ expired }) => !expired);
  run.enemies = run.enemies.filter(({ dead }) => !dead);
}

function chooseEnemyType(run, mix) {
  const total = mix.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = nextRandom(run) * total;
  for (const entry of mix) {
    roll -= entry.weight;
    if (roll <= 0) return entry.id;
  }
  return mix.at(-1).id;
}

function spawnAtEncounterEdge(run, type, config) {
  const definition = config.enemies[type];
  const minX = definition.radius;
  const maxX = config.world.width - definition.radius;
  const minY = definition.radius;
  const maxY = config.world.height - definition.radius;
  const minimumSafeDistance = 360;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const distance = 510 + nextRandom(run) * 100;
    const angle = nextRandom(run) * Math.PI * 2;
    const x = clamp(run.player.x + Math.cos(angle) * distance, minX, maxX);
    const y = clamp(run.player.y + Math.sin(angle) * distance, minY, maxY);
    if (Math.hypot(x - run.player.x, y - run.player.y) >= minimumSafeDistance) {
      return spawnEnemy(run, type, x, y, config);
    }
  }

  const fallbackDistance = 510;
  const candidates = [
    { x: clamp(run.player.x + fallbackDistance, minX, maxX), y: run.player.y },
    { x: clamp(run.player.x - fallbackDistance, minX, maxX), y: run.player.y },
    { x: run.player.x, y: clamp(run.player.y + fallbackDistance, minY, maxY) },
    { x: run.player.x, y: clamp(run.player.y - fallbackDistance, minY, maxY) },
  ];
  const fallback = candidates.reduce((farthest, candidate) => (
    Math.hypot(candidate.x - run.player.x, candidate.y - run.player.y)
      > Math.hypot(farthest.x - run.player.x, farthest.y - run.player.y)
      ? candidate
      : farthest
  ));
  return spawnEnemy(run, type, fallback.x, fallback.y, config);
}

function stepDirector(run, dt, config) {
  run.spawnTimer -= dt;
  if (run.spawnTimer > 0) return;
  const plan = getEncounterPlan(run, config);
  if (!plan.canSpawn) {
    run.spawnTimer = plan.spawnInterval;
    return;
  }
  for (let index = 0; index < plan.spawnCount; index += 1) {
    spawnAtEncounterEdge(run, chooseEnemyType(run, plan.mix), config);
  }
  run.spawnTimer = plan.spawnInterval;
}

export function stepSimulation(run, { dt, input = { x: 0, y: 0 }, config = CONFIG }) {
  if (run.state !== 'running') return;
  run.events = [];
  run.time += dt;
  stepPlayer(run, input, dt, config);
  stepDirector(run, dt, config);
  stepEnemies(run, dt, config);
  if (run.state === 'gameOver') {
    run.events.push({ type: 'gameOver' });
    recordEntityPeaks(run);
    return;
  }
  stepWeapons(run, dt, config);
  stepProjectiles(run, dt, config);
  stepReactions(run, dt, config);
  stepXpOrbs(run, dt);
  stepParticles(run, dt);
  recordEntityPeaks(run);
}

function recordEntityPeaks(run) {
  run.stats.peaks.enemies = Math.max(run.stats.peaks.enemies, run.enemies.length);
  run.stats.peaks.projectiles = Math.max(run.stats.peaks.projectiles, run.projectiles.length);
  run.stats.peaks.particles = Math.max(run.stats.peaks.particles, run.particles.length);
}
