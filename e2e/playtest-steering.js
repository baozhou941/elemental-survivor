const ROUTES = [
  { x: 1, y: 0, keys: ['KeyD'] },
  { x: Math.SQRT1_2, y: Math.SQRT1_2, keys: ['KeyD', 'KeyS'] },
  { x: 0, y: 1, keys: ['KeyS'] },
  { x: -Math.SQRT1_2, y: Math.SQRT1_2, keys: ['KeyA', 'KeyS'] },
  { x: -1, y: 0, keys: ['KeyA'] },
  { x: -Math.SQRT1_2, y: -Math.SQRT1_2, keys: ['KeyA', 'KeyW'] },
  { x: 0, y: -1, keys: ['KeyW'] },
  { x: Math.SQRT1_2, y: -Math.SQRT1_2, keys: ['KeyD', 'KeyW'] },
];

function unitVector(x, y) {
  const length = Math.hypot(x, y);
  return length > 0 ? { x: x / length, y: y / length } : { x: 0, y: 0 };
}

function wallPenalty(x, y, world, radius) {
  if (x < radius || y < radius || x > world.width - radius || y > world.height - radius) {
    return 1_000_000;
  }
  const clearance = Math.min(
    x - radius,
    y - radius,
    world.width - radius - x,
    world.height - radius - y,
  );
  return Math.max(0, 140 - clearance) * 10;
}

export function steeringKeys(run) {
  const { player, enemies, xpOrbs, world } = run;
  let closestThreat = Infinity;
  let escapeX = 0;
  let escapeY = 0;
  const playerRadius = player.radius ?? 0;

  for (const enemy of enemies) {
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const distance = Math.hypot(dx, dy);
    const clearance = distance - playerRadius - (enemy.radius ?? 0);
    closestThreat = Math.min(closestThreat, clearance);
    const direction = unitVector(dx, dy);
    const weight = 1 / Math.max(1, clearance) ** 2;
    escapeX += direction.x * weight;
    escapeY += direction.y * weight;
  }
  const escape = unitVector(escapeX, escapeY);
  const threatFactor = Number.isFinite(closestThreat)
    ? Math.max(0, Math.min(1, (280 - closestThreat) / 120))
    : 0;

  let xpDirection = { x: 0, y: 0 };
  if (xpOrbs.length > 0) {
    let closestOrb = null;
    let closestOrbDistance = Infinity;
    for (const orb of xpOrbs) {
      const distance = Math.hypot(player.x - orb.x, player.y - orb.y);
      if (distance < closestOrbDistance) {
        closestOrb = orb;
        closestOrbDistance = distance;
      }
    }
    xpDirection = unitVector(closestOrb.x - player.x, closestOrb.y - player.y);
  }

  const centerDirection = unitVector(world.width / 2 - player.x, world.height / 2 - player.y);
  const tangent = { x: -escape.y, y: escape.x };
  let best = ROUTES[0];
  let bestScore = -Infinity;

  for (const route of ROUTES) {
    const midpoint = { x: player.x + route.x * 60, y: player.y + route.y * 60 };
    const endpoint = { x: player.x + route.x * 120, y: player.y + route.y * 120 };
    let minimumClearance = 500;
    let danger = 0;

    for (const enemy of enemies) {
      const middleDistance = Math.hypot(midpoint.x - enemy.x, midpoint.y - enemy.y);
      const endDistance = Math.hypot(endpoint.x - enemy.x, endpoint.y - enemy.y);
      const collisionRadius = playerRadius + (enemy.radius ?? 0);
      const middleClearance = middleDistance - collisionRadius;
      const endClearance = endDistance - collisionRadius;
      minimumClearance = Math.min(minimumClearance, middleClearance, endClearance);
      danger += Math.max(0, 300 - middleClearance) ** 2 / 300;
      danger += Math.max(0, 300 - endClearance) ** 2 / 300;
    }

    const escapeAlignment = route.x * escape.x + route.y * escape.y;
    const tangentAlignment = route.x * tangent.x + route.y * tangent.y;
    const centerAlignment = route.x * centerDirection.x + route.y * centerDirection.y;
    const xpAlignment = route.x * xpDirection.x + route.y * xpDirection.y;
    const score = minimumClearance * 1.5
      - danger * 0.8
      - wallPenalty(endpoint.x, endpoint.y, world, playerRadius)
      + escapeAlignment * 25
      + tangentAlignment * 60 * threatFactor
      + centerAlignment * 12
      + xpAlignment * 35 * (1 - threatFactor);

    if (score > bestScore) {
      best = route;
      bestScore = score;
    }
  }

  return [...best.keys];
}
