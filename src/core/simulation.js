import { CONFIG } from '../data/config.js';
import { getEncounterPlan } from './director.js';
import { damagePlayer, gainBurstCharge, gainXp } from './model.js';
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
  const burstMultiplier = run.time < run.burst.activeUntil ? config.burst.moveSpeedMultiplier : 1;
  run.player.x = clamp(
    run.player.x + input.x * scale * run.player.speed * burstMultiplier * dt,
    run.player.radius,
    config.world.width - run.player.radius,
  );
  run.player.y = clamp(
    run.player.y + input.y * scale * run.player.speed * burstMultiplier * dt,
    run.player.radius,
    config.world.height - run.player.radius,
  );
}

export function spawnEnemy(run, type, x, y, config = CONFIG, modifiers = {}) {
  const definition = config.enemies[type];
  if (!definition || run.enemies.length >= config.limits.enemies) return null;
  const elite = Boolean(modifiers.elite);
  const healthScale = (modifiers.healthScale ?? 1) * (elite ? 3.25 : 1);
  const damageScale = (modifiers.damageScale ?? 1) * (elite ? 1.65 : 1);
  const speedScale = modifiers.speedScale ?? 1;
  const enemy = {
    id: run.nextEntityId++,
    type,
    x,
    y,
    radius: definition.radius * (elite ? 1.28 : 1),
    health: definition.health * healthScale,
    maxHealth: definition.health * healthScale,
    speed: definition.speed * speedScale * (elite ? 1.04 : 1),
    damage: definition.damage * damageScale,
    xp: definition.xp * (elite ? 6 : 1),
    elite,
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

function nearestEnemyFrom(run, x, y, excludedId = null) {
  let nearest = null;
  let nearestDistanceSquared = Infinity;
  for (const enemy of run.enemies) {
    if (enemy.dead || enemy.id === excludedId) continue;
    const dx = enemy.x - x;
    const dy = enemy.y - y;
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
  const burstDamage = run.time < run.burst.activeUntil ? config.burst.damageMultiplier : 1;
  const behavior = run.weaponMutations[weapon.id] ?? null;
  const projectileCount = behavior === 'glacierPath'
    ? Math.max(1, weapon.projectiles - 1)
    : weapon.projectiles;
  for (let index = 0; index < projectileCount; index += 1) {
    if (run.projectiles.length >= config.limits.projectiles) break;
    const angle = baseAngle + (index - (projectileCount - 1) / 2) * 0.16;
    const speedMultiplier = behavior === 'mirrorIce' ? 0.82 : 1;
    const damageMultiplier = {
      flameOrbit: 0.72,
      ignitionMark: 0.7,
      phoenixSplit: 0.9,
      vacuumBlade: 0.78,
      spiralStorm: 0.82,
      frostPrison: 0.72,
      glacierPath: 0.82,
      mirrorIce: 0.82,
    }[behavior] ?? 1;
    const projectile = {
      id: run.nextEntityId++,
      x: run.player.x,
      y: run.player.y,
      vx: Math.cos(angle) * weapon.speed * speedMultiplier,
      vy: Math.sin(angle) * weapon.speed * speedMultiplier,
      radius: weapon.radius,
      lifetime: weapon.lifetime,
      initialLifetime: weapon.lifetime,
      age: 0,
      damage: weapon.damage * run.player.damageMultiplier * burstDamage * damageMultiplier,
      pierceRemaining: weapon.pierce,
      weaponId: weapon.id,
      element: weapon.element,
      behavior,
      slowMultiplier: weapon.slowMultiplier,
      slowDuration: weapon.slowDuration,
      hitIds: new Set(),
      expired: false,
    };

    if (behavior === 'flameOrbit') {
      projectile.orbitAngle = angle;
      projectile.orbitRadius = 58 + index * 13;
      projectile.angularSpeed = 5.2;
      projectile.x += Math.cos(angle) * projectile.orbitRadius;
      projectile.y += Math.sin(angle) * projectile.orbitRadius;
      projectile.radius += 4;
      projectile.pierceRemaining = 12;
      projectile.lifetime = 1.45;
    } else if (behavior === 'vacuumBlade') {
      projectile.returnAt = weapon.lifetime * 0.46;
      projectile.pierceRemaining += 2;
    } else if (behavior === 'spiralStorm') {
      projectile.angularVelocity = index % 2 === 0 ? 3.2 : -3.2;
      projectile.radius += 5;
    } else if (behavior === 'glacierPath') {
      projectile.trailTimer = 0;
      projectile.pierceRemaining += 1;
    }
    run.projectiles.push(projectile);

    if (behavior === 'windEcho' && run.projectiles.length < config.limits.projectiles) {
      run.projectiles.push({
        ...projectile,
        id: run.nextEntityId++,
        damage: projectile.damage * 0.68,
        delay: 0.22,
        hitIds: new Set(),
      });
    }
  }
}

export function stepWeapons(run, dt, config = CONFIG) {
  const target = nearestEnemy(run);
  for (const weapon of Object.values(run.weapons)) {
    weapon.cooldownRemaining = Math.max(0, weapon.cooldownRemaining - dt);
    if (!target || weapon.cooldownRemaining > 0) continue;
    fireWeapon(run, weapon, target, config);
    weapon.cooldownRemaining = weapon.cooldown
      * (run.time < run.burst.activeUntil ? config.burst.cooldownMultiplier : 1)
      * (run.weaponMutations[weapon.id] === 'windEcho' ? 1.16 : 1);
    run.stats.attacks += 1;
  }
}

function killEnemy(run, enemy, config) {
  if (enemy.dead) return;
  enemy.dead = true;
  for (const cooldowns of Object.values(run.reactionTriggerCooldowns)) cooldowns.delete(enemy.id);
  run.stats.kills += 1;
  if (enemy.elite) run.stats.eliteKills += 1;
  gainBurstCharge(run, config.burst.killCharge + (enemy.elite ? config.burst.eliteCharge : 0), config);
  run.stats.xpProduced += enemy.xp;
  if (run.stats.milestones.firstKillAt === null) run.stats.milestones.firstKillAt = run.time;
  run.stats.killsByType[enemy.type] = (run.stats.killsByType[enemy.type] ?? 0) + 1;
  run.events.push({ type: 'kill', x: enemy.x, y: enemy.y, enemyType: enemy.type, elite: enemy.elite });
  emitParticles(run, enemy.x, enemy.y, enemy.elite ? '#ffd166' : '#76f7c8', enemy.elite ? 18 : 8, config);
  if (run.xpOrbs.length < config.limits.xpOrbs) {
    const tier = enemy.elite ? 'elite' : enemy.xp >= 15 ? 'rare' : 'small';
    run.xpOrbs.push({
      id: run.nextEntityId++,
      x: enemy.x,
      y: enemy.y,
      radius: tier === 'elite' ? 10 : tier === 'rare' ? 7 : 5,
      value: enemy.xp,
      tier,
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
  gainBurstCharge(run, config.burst.reactionCharge, config);
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
  const pendingProjectiles = [];
  for (const projectile of run.projectiles) {
    if (projectile.expired) continue;
    if ((projectile.delay ?? 0) > 0) {
      projectile.delay -= dt;
      continue;
    }
    projectile.age = (projectile.age ?? 0) + dt;
    if (projectile.behavior === 'flameOrbit') {
      projectile.orbitAngle += projectile.angularSpeed * dt;
      projectile.x = run.player.x + Math.cos(projectile.orbitAngle) * projectile.orbitRadius;
      projectile.y = run.player.y + Math.sin(projectile.orbitAngle) * projectile.orbitRadius;
    } else {
      if (projectile.behavior === 'spiralStorm') {
        const angle = projectile.angularVelocity * dt;
        const vx = projectile.vx * Math.cos(angle) - projectile.vy * Math.sin(angle);
        projectile.vy = projectile.vx * Math.sin(angle) + projectile.vy * Math.cos(angle);
        projectile.vx = vx;
      } else if (projectile.behavior === 'vacuumBlade' && projectile.age >= projectile.returnAt) {
        const dx = run.player.x - projectile.x;
        const dy = run.player.y - projectile.y;
        const distance = Math.hypot(dx, dy) || 1;
        const speed = Math.hypot(projectile.vx, projectile.vy);
        projectile.vx = (dx / distance) * speed;
        projectile.vy = (dy / distance) * speed;
      }
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;
    }

    if (projectile.behavior === 'glacierPath') {
      projectile.trailTimer = (projectile.trailTimer ?? 0) - dt;
      if (projectile.trailTimer <= 0) {
        projectile.trailTimer = 0.14;
        emitParticles(run, projectile.x, projectile.y, '#a9efff', 2, config);
        for (const enemy of run.enemies) {
          if (enemy.dead || Math.hypot(enemy.x - projectile.x, enemy.y - projectile.y) > 42 + enemy.radius) continue;
          enemy.slowMultiplier = Math.min(enemy.slowMultiplier, 0.48);
          enemy.slowedUntil = Math.max(enemy.slowedUntil, run.time + 0.65);
        }
      }
    }
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
      if (projectile.behavior === 'frostPrison') {
        for (const nearby of run.enemies) {
          if (nearby.dead || Math.hypot(nearby.x - enemy.x, nearby.y - enemy.y) > 72 + nearby.radius) continue;
          nearby.slowMultiplier = Math.min(nearby.slowMultiplier, 0.16);
          nearby.slowedUntil = Math.max(nearby.slowedUntil, run.time + 1.25);
        }
        run.events.push({ type: 'mutation', behavior: 'frostPrison', x: enemy.x, y: enemy.y });
      } else if (projectile.behavior === 'ignitionMark') {
        for (const nearby of run.enemies) {
          if (nearby.dead || nearby.id === enemy.id
            || Math.hypot(nearby.x - enemy.x, nearby.y - enemy.y) > 68 + nearby.radius) continue;
          const blastDamage = projectile.damage * 0.55;
          nearby.health -= blastDamage;
          run.stats.damageByWeapon[projectile.weaponId] =
            (run.stats.damageByWeapon[projectile.weaponId] ?? 0) + blastDamage;
          if (nearby.health <= 0) killEnemy(run, nearby, config);
        }
        run.events.push({ type: 'mutation', behavior: 'ignitionMark', x: enemy.x, y: enemy.y });
      } else if (projectile.behavior === 'vacuumBlade') {
        const dx = run.player.x - enemy.x;
        const dy = run.player.y - enemy.y;
        const distance = Math.hypot(dx, dy) || 1;
        enemy.x += (dx / distance) * Math.min(34, distance);
        enemy.y += (dy / distance) * Math.min(34, distance);
      }
      if (projectile.element === 'fire' && wasSlowed) {
        triggerBurstReaction(run, 'thermalShock', enemy, config);
      }
      const killedByHit = enemy.health <= 0;
      if (killedByHit) killEnemy(run, enemy, config);
      if (killedByHit && projectile.behavior === 'phoenixSplit') {
        for (let splitIndex = 0; splitIndex < 2; splitIndex += 1) {
          const splitTarget = nearestEnemyFrom(run, enemy.x, enemy.y, enemy.id);
          if (!splitTarget) break;
          const splitAngle = Math.atan2(splitTarget.y - enemy.y, splitTarget.x - enemy.x)
            + (splitIndex === 0 ? -0.12 : 0.12);
          pendingProjectiles.push({
            ...projectile,
            id: run.nextEntityId++,
            x: enemy.x,
            y: enemy.y,
            vx: Math.cos(splitAngle) * 620,
            vy: Math.sin(splitAngle) * 620,
            radius: Math.max(4, projectile.radius * 0.7),
            lifetime: 0.55,
            age: 0,
            damage: projectile.damage * 0.52,
            behavior: 'phoenixEmber',
            pierceRemaining: 0,
            hitIds: new Set(),
            expired: false,
          });
        }
      } else if (!killedByHit && projectile.behavior === 'mirrorIce' && !projectile.refracted) {
        const nextTarget = nearestEnemyFrom(run, enemy.x, enemy.y, enemy.id);
        if (nextTarget) {
          const angle = Math.atan2(nextTarget.y - enemy.y, nextTarget.x - enemy.x);
          pendingProjectiles.push({
            ...projectile,
            id: run.nextEntityId++,
            x: enemy.x,
            y: enemy.y,
            vx: Math.cos(angle) * 440,
            vy: Math.sin(angle) * 440,
            lifetime: 0.75,
            age: 0,
            damage: projectile.damage * 0.72,
            refracted: true,
            pierceRemaining: 0,
            hitIds: new Set([enemy.id]),
            expired: false,
          });
        }
      }
      if (projectile.pierceRemaining <= 0) {
        projectile.expired = true;
        break;
      }
      projectile.pierceRemaining -= 1;
    }
  }

  const available = Math.max(0, config.limits.projectiles - run.projectiles.length);
  run.projectiles.push(...pendingProjectiles.slice(0, available));
  run.projectiles = run.projectiles.filter(({ expired }) => !expired);
  run.enemies = run.enemies.filter(({ dead }) => !dead);
}

export function stepXpOrbs(run, dt, config = CONFIG) {
  let collectedXp = 0;
  const previousLevel = run.player.level;
  for (const orb of run.xpOrbs) {
    if (orb.collected) continue;
    const dx = run.player.x - orb.x;
    const dy = run.player.y - orb.y;
    const distance = Math.hypot(dx, dy);
    const pickupRadius = run.player.pickupRadius
      * (run.time < run.burst.activeUntil ? config.burst.pickupRadiusMultiplier : 1);
    if (distance > pickupRadius) continue;

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
    gainBurstCharge(run, collectedXp * config.burst.xpChargePerPoint, config);
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
    gainBurstCharge(run, config.burst.reactionCharge, config);
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

function spawnAtEncounterEdge(run, type, config, modifiers = {}) {
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
      return spawnEnemy(run, type, x, y, config, modifiers);
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
  return spawnEnemy(run, type, fallback.x, fallback.y, config, modifiers);
}

function stepDirector(run, dt, config) {
  if (run.time >= run.nextWorldRuleAt) {
    const rules = ['surgingHorde', 'hardenedShell', 'volatilePursuit'];
    const rule = rules[run.worldRuleLevel % rules.length];
    run.worldRuleLevel += 1;
    run.worldRules.push(rule);
    run.nextWorldRuleAt += 240;
    run.events.push({ type: 'worldRule', rule, level: run.worldRuleLevel });
  }
  run.spawnTimer -= dt;
  if (run.spawnTimer > 0) return;
  const plan = getEncounterPlan(run, config);
  if (!plan.canSpawn) {
    run.spawnTimer = plan.spawnInterval;
    return;
  }
  for (let index = 0; index < plan.spawnCount; index += 1) {
    const elite = plan.elite && index === 0;
    const enemy = spawnAtEncounterEdge(run, chooseEnemyType(run, plan.mix), config, {
      healthScale: plan.healthScale * (1 + run.worldRuleLevel * 0.12),
      damageScale: plan.damageScale * (1 + run.worldRuleLevel * 0.08),
      speedScale: plan.speedScale,
      elite,
    });
    if (enemy?.elite) {
      run.events.push({ type: 'eliteSpawn', x: enemy.x, y: enemy.y, enemyType: enemy.type });
      run.nextEliteAt = run.time + Math.max(78, 125 - run.time * 0.025);
    }
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
  stepXpOrbs(run, dt, config);
  stepParticles(run, dt);
  recordEntityPeaks(run);
}

function recordEntityPeaks(run) {
  run.stats.peaks.enemies = Math.max(run.stats.peaks.enemies, run.enemies.length);
  run.stats.peaks.projectiles = Math.max(run.stats.peaks.projectiles, run.projectiles.length);
  run.stats.peaks.particles = Math.max(run.stats.peaks.particles, run.particles.length);
}
