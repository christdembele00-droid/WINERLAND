import { onDisconnect, onValue, ref, remove, set, update } from 'firebase/database';
import { auth, realtimeDb } from '../firebase';
import { getRoomId, getMode } from './hunterSystems';

const ROOT = 'rooms';

export function createRoomId(modeId, matchId = 'main') {
  return getRoomId(modeId, matchId);
}

export async function joinRoom({ uid, modeId, matchId = 'main', state = {} }) {
  if (!uid) throw new Error('Utilisateur Firebase requis');
  const mode = getMode(modeId);
  const roomId = createRoomId(modeId, matchId);
  const playerRef = ref(realtimeDb, `${ROOT}/${roomId}/players/${uid}`);
  const payload = {
    x: Number(state.x) || 0,
    y: Number(state.y) || 0,
    z: Number(state.z) || 0,
    health: Number.isFinite(state.health) ? state.health : 100,
    score: Number(state.score) || 0,
    mode: mode.id,
    weapon: state.weapon || 'pulse',
    shield: Boolean(state.shield),
    zoneId: state.zoneId || 'central',
    connected: true,
    joinedAt: Date.now(),
    updatedAt: Date.now(),
  };
  await onDisconnect(playerRef).remove();
  await set(playerRef, payload);
  return { roomId, playerRef };
}

export function subscribeRoom({ roomId, uid, onPlayers, onError }) {
  const playersRef = ref(realtimeDb, `${ROOT}/${roomId}/players`);
  return onValue(playersRef, (snapshot) => {
    const data = snapshot.val() || {};
    const players = Object.entries(data)
      .filter(([id]) => id !== uid)
      .map(([id, player]) => ({ id, ...player, position: [player.x || 0, player.y || 0, player.z || 0] }));
    onPlayers(players);
  }, onError);
}

export async function updatePlayerState({ roomId, uid, state }) {
  if (!uid || !roomId) return;
  await update(ref(realtimeDb, `${ROOT}/${roomId}/players/${uid}`), {
    x: Number(state.x) || 0,
    y: Number(state.y) || 0,
    z: Number(state.z) || 0,
    health: Number.isFinite(state.health) ? state.health : 100,
    score: Number(state.score) || 0,
    mode: state.mode || 'open-world',
    weapon: state.weapon || 'pulse',
    shield: Boolean(state.shield),
    zoneId: state.zoneId || 'central',
    updatedAt: Date.now(),
  });
}

export async function leaveRoom(roomId, uid) {
  if (!roomId || !uid) return;
  await remove(ref(realtimeDb, `${ROOT}/${roomId}/players/${uid}`));
}

export function currentFirebaseUser() {
  return auth.currentUser;
}
