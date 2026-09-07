import { onValue, push, ref, set, update } from 'firebase/database';
import { realtimeDb } from '../firebase';

const guildsPath = 'guilds';

export async function createGuild({ name, tag, leaderId, leaderName = 'Hunter' }) {
  const guildRef = push(ref(realtimeDb, guildsPath));
  const guild = {
    id: guildRef.key,
    name: String(name).trim().slice(0, 32),
    tag: String(tag).trim().toUpperCase().slice(0, 6),
    leaderId,
    createdAt: Date.now(),
    level: 1,
    xp: 0,
    members: { [leaderId]: { name: leaderName, role: 'leader', joinedAt: Date.now() } },
    stats: { wins: 0, losses: 0, territory: 0, rating: 1000 },
  };
  await set(guildRef, guild);
  return guild;
}

export async function joinGuild(guildId, uid, displayName = 'Hunter') {
  await update(ref(realtimeDb, `${guildsPath}/${guildId}/members/${uid}`), {
    name: displayName,
    role: 'member',
    joinedAt: Date.now(),
  });
}

export async function createGuildWar({ guildA, guildB, mode = 'territory' }) {
  const warRef = push(ref(realtimeDb, 'guildWars'));
  const war = {
    id: warRef.key,
    guildA,
    guildB,
    mode,
    status: 'searching',
    scoreA: 0,
    scoreB: 0,
    createdAt: Date.now(),
    endsAt: Date.now() + 15 * 60 * 1000,
  };
  await set(warRef, war);
  return war;
}

export function subscribeGuild(guildId, callback) {
  return onValue(ref(realtimeDb, `${guildsPath}/${guildId}`), (snapshot) => callback(snapshot.val()));
}
