export function steeringKeys(run) {
  const { player, enemies, xpOrbs, world } = run;
  let x = 0;
  let y = 0;
  let closestThreat = Infinity;

  for (const enemy of enemies) {
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    closestThreat = Math.min(closestThreat, distance);
    if (distance < 300) {
      const pressure = (300 - distance) / distance;
      x += dx * pressure;
      y += dy * pressure;
    }
  }

  if (closestThreat > 120 && xpOrbs.length > 0) {
    const target = xpOrbs.reduce((closest, orb) => {
      const distance = Math.hypot(player.x - orb.x, player.y - orb.y);
      return distance < closest.distance ? { orb, distance } : closest;
    }, { orb: null, distance: Infinity }).orb;
    x += (target.x - player.x) * 0.8;
    y += (target.y - player.y) * 0.8;
  }

  const margin = 260;
  if (player.x < margin) x = 100;
  else if (player.x > world.width - margin) x = -100;
  if (player.y < margin) y = 100;
  else if (player.y > world.height - margin) y = -100;

  if (Math.abs(x) + Math.abs(y) < 1) x = 1;
  const keys = [];
  if (x > 20) keys.push('KeyD');
  if (x < -20) keys.push('KeyA');
  if (y > 20) keys.push('KeyS');
  if (y < -20) keys.push('KeyW');
  return keys.length > 0 ? keys : ['KeyD'];
}
