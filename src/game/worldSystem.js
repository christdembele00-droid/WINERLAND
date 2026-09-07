export const WORLD_ZONES = [
  { id: 'central', name: 'NEXUS CITY', type: 'hub', danger: 0, size: 220 },
  { id: 'iron-wastes', name: 'IRON WASTES', type: 'pve', danger: 3, size: 360 },
  { id: 'neon-jungle', name: 'NEON JUNGLE', type: 'pve', danger: 4, size: 420 },
  { id: 'red-canyon', name: 'RED CANYON', type: 'pvp', danger: 5, size: 480 },
  { id: 'frost-sector', name: 'FROST SECTOR', type: 'pve', danger: 6, size: 520 },
  { id: 'war-front', name: 'WAR FRONT', type: 'guild-war', danger: 8, size: 600 },
];

export const WORLD_EVENTS = [
  'ROBOT_INVASION', 'WORLD_BOSS', 'SUPPLY_DROP', 'HUNTER_CONTRACT',
  'GUILD_CONVOY', 'TERRITORY_ALERT', 'RARE_TARGET', 'SURVIVAL_WAVE',
];

export function getWorldEvent(now = Date.now()) {
  const index = Math.floor(now / (5 * 60 * 1000)) % WORLD_EVENTS.length;
  return WORLD_EVENTS[index];
}

export function clampWorldPosition(x, z, limit = 100) {
  return [Math.max(-limit, Math.min(limit, x)), Math.max(-limit, Math.min(limit, z))];
}
