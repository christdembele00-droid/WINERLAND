import * as THREE from 'three';

export const ROBOT_AI = {
  detectionRange: 18,
  attackRange: 3.5,
  moveSpeed: 1.8,
  bossSpeed: 2.4,
  attackCooldownMs: 1200,
  contactDamage: 8,
};

export function updateRobotAI(robots, playerPosition, now = performance.now()) {
  let playerDamage = 0;
  const next = robots.map((robot) => {
    if (robot.destroyed) return robot;
    const p = new THREE.Vector3(...robot.position);
    const target = new THREE.Vector3(...playerPosition);
    const distance = p.distanceTo(target);
    if (distance > ROBOT_AI.detectionRange) return robot;

    const direction = target.sub(p);
    direction.y = 0;
    if (direction.lengthSq() > 0.01) direction.normalize();

    const speed = robot.archetype === 'boss' ? ROBOT_AI.bossSpeed : ROBOT_AI.moveSpeed;
    const nextPosition = [...robot.position];
    if (distance > ROBOT_AI.attackRange) {
      nextPosition[0] += direction.x * speed * 0.05;
      nextPosition[2] += direction.z * speed * 0.05;
    } else if (!robot.lastAttackAt || now - robot.lastAttackAt >= ROBOT_AI.attackCooldownMs) {
      playerDamage += robot.archetype === 'boss' ? ROBOT_AI.contactDamage * 2 : ROBOT_AI.contactDamage;
      return { ...robot, lastAttackAt: now };
    }
    return { ...robot, position: nextPosition, rotationY: Math.atan2(direction.x, direction.z) };
  });
  return { robots: next, playerDamage };
}
