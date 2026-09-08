import * as THREE from 'three';

export const COMBAT_CONFIG = {
  maxAmmo: 30,
  damage: 25,
  fireCooldownMs: 180,
  projectileSpeed: 34,
  maxRange: 45,
};

export function createCombatState() {
  return {
    ammo: COMBAT_CONFIG.maxAmmo,
    lastShotAt: 0,
    recoil: 0,
    muzzle: 0,
    hitMarker: 0,
  };
}

export function canShoot(state, now = performance.now()) {
  return state.ammo > 0 && now - state.lastShotAt >= COMBAT_CONFIG.fireCooldownMs;
}

export function raycastTarget(camera, targets, ndc = new THREE.Vector2(0, 0)) {
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(ndc, camera);
  const meshes = [];
  targets.forEach((target) => {
    if (target?.object?.traverse) target.object.traverse((node) => node.isMesh && meshes.push(node));
  });
  const hits = raycaster.intersectObjects(meshes, true);
  if (!hits.length || hits[0].distance > COMBAT_CONFIG.maxRange) return null;
  let object = hits[0].object;
  while (object && !object.userData?.robotId) object = object.parent;
  return object?.userData?.robotId ? { robotId: object.userData.robotId, point: hits[0].point, distance: hits[0].distance } : null;
}

export function spawnTracer(origin, target, color = '#00e5c0') {
  const direction = new THREE.Vector3().subVectors(target, origin);
  const length = direction.length();
  if (!length) return null;
  const geometry = new THREE.CylinderGeometry(0.018, 0.018, length, 6);
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(origin).addScaledVector(direction, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  mesh.userData.ttl = 0.07;
  return mesh;
}

export function updateCombatEffects(scene, delta) {
  const expired = [];
  scene.traverse((node) => {
    if (!node.userData?.ttl) return;
    node.userData.ttl -= delta;
    node.material.opacity = Math.max(0, node.userData.ttl / 0.07);
    if (node.userData.ttl <= 0) expired.push(node);
  });
  expired.forEach((node) => {
    node.parent?.remove(node);
    node.geometry?.dispose();
    node.material?.dispose();
  });
}
