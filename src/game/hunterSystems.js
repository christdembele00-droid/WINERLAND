export const GAME_MODES = [
  { id: 'open-world', name: 'OPEN WORLD', teamSize: 1, pvp: true, roomType: 'persistent' },
  { id: 'guild-war', name: 'GUILD WAR', teamSize: 10, pvp: true, roomType: 'guild' },
  { id: 'robot-hunt', name: 'ROBOT HUNT', teamSize: 4, pvp: false, roomType: 'match' },
  { id: 'world-boss', name: 'WORLD BOSS', teamSize: 8, pvp: false, roomType: 'event' },
  { id: 'survival', name: 'SURVIVAL', teamSize: 4, pvp: true, roomType: 'match' },
  { id: 'capture-zone', name: 'CAPTURE ZONE', teamSize: 5, pvp: true, roomType: 'match' },
  { id: 'raid', name: 'RAID', teamSize: 6, pvp: false, roomType: 'match' },
  { id: 'ranked', name: 'RANKED', teamSize: 5, pvp: true, roomType: 'ranked' },
];

export const ROBOT_ARCHETYPES = [
  { id: 'scout', name: 'SCOUT', hp: 120, speed: 2.8, damage: 8, reward: 25 },
  { id: 'hunter', name: 'HUNTER', hp: 220, speed: 2.1, damage: 14, reward: 50 },
  { id: 'guardian', name: 'GUARDIAN', hp: 500, speed: 1.1, damage: 22, reward: 120 },
  { id: 'boss', name: 'WAR MACHINE', hp: 3000, speed: 0.7, damage: 35, reward: 1000 },
];

export const MISSIONS = [
  { id: 'm01', title: 'FIRST CONTRACT', type: 'combat', target: 5, rewardXp: 100 },
  { id: 'm02', title: 'ROBOT HUNTER', type: 'robot', target: 10, rewardXp: 250 },
  { id: 'm03', title: 'ZONE CONTROL', type: 'territory', target: 3, rewardXp: 350 },
  { id: 'm04', title: 'GUILD CHAMPION', type: 'guildWar', target: 1, rewardXp: 500 },
  { id: 'm05', title: 'WORLD EVENT', type: 'event', target: 2, rewardXp: 400 },
];

export function createHunterProgress() {
  return {
    level: 1,
    xp: 0,
    credits: 0,
    rating: 1000,
    missionsCompleted: 0,
    robotsDestroyed: 0,
    guildWarsWon: 0,
    matchesPlayed: 0,
    matchesWon: 0,
  };
}

export function addXp(progress, amount) {
  const next = { ...progress, xp: progress.xp + Math.max(0, amount) };
  while (next.xp >= next.level * 1000) {
    next.xp -= next.level * 1000;
    next.level += 1;
  }
  return next;
}

export function getMode(modeId) {
  return GAME_MODES.find((item) => item.id === modeId) || GAME_MODES[0];
}

export function getRoomId(modeId, matchId = 'main') {
  const mode = getMode(modeId);
  return `winerland_${mode.roomType}_${mode.id}_${matchId}`;
}

export function findMatch({ modeId, players = [], maxPlayers = 10 }) {
  const mode = getMode(modeId);
  const available = players.filter((player) => player.mode === mode.id && player.connected !== false);
  return available.slice(0, Math.min(maxPlayers, mode.teamSize));
}

export function getMatchState({ modeId, players = [] }) {
  const mode = getMode(modeId);
  const members = findMatch({ modeId, players, maxPlayers: mode.teamSize });
  return {
    modeId: mode.id,
    requiredPlayers: mode.teamSize,
    players: members,
    ready: mode.teamSize <= 1 || members.length >= mode.teamSize,
  };
}
