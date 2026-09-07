import { onValue, push, ref, set, update } from 'firebase/database';
import { realtimeDb } from '../firebase';

const guildsPath = 'guilds';

function cleanName(value, fallback = 'WINERLAND GUILD') {
  return String(value || fallback).trim().slice(0, 32) || fallback;
}

function cleanTag(value) {
  return String(value || 'WNR').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'WNR';
}

export async function createGuild({ name, tag, leaderId, leaderName = 'Hunter' }) {
  if (!leaderId) throw new Error('Chef de guilde manquant');
  const guildRef = push(ref(realtimeDb, guildsPath));
  const now = Date.now();
  const guild = {
    id: guildRef.key,
    name: cleanName(name),
    tag: cleanTag(tag),
    leaderId,
    createdAt: now,
    level: 1,
    xp: 0,
    members: {
      [leaderId]: {
        name: cleanName(leaderName, 'Hunter').slice(0, 24),
        role: 'leader',
        joinedAt: now,
      },
    },
    stats: { wins: 0, losses: 0, territory: 0, rating: 1000 },
  };
  await set(guildRef, guild);
  return guild;
}

export async function joinGuild(guildId, uid, displayName = 'Hunter') {
  if (!guildId || !uid) throw new Error('Guilde ou joueur manquant');
  await update(ref(realtimeDb, `${guildsPath}/${guildId}/members/${uid}`), {
    name: cleanName(displayName, 'Hunter').slice(0, 24),
    role: 'member',
    joinedAt: Date.now(),
  });
}

export async function leaveGuild(guildId, uid) {
  if (!guildId || !uid) throw new Error('Guilde ou joueur manquant');
  const memberRef = ref(realtimeDb, `${guildsPath}/${guildId}/members/${uid}`);
  await set(memberRef, null);
}

export async function createGuildWar({ guildA, guildB, mode = 'territory' }) {
  if (!guildA || !guildB || guildA === guildB) throw new Error('Deux guildes différentes sont nécessaires');
  const warRef = push(ref(realtimeDb, 'guildWars'));
  const now = Date.now();
  const war = {
    id: warRef.key,
    guildA,
    guildB,
    mode: String(mode).slice(0, 24),
    status: 'searching',
    scoreA: 0,
    scoreB: 0,
    createdAt: now,
    endsAt: now + 15 * 60 * 1000,
  };
  await set(warRef, war);
  return war;
}

export function subscribeGuild(guildId, callback) {
  return onValue(ref(realtimeDb, `${guildsPath}/${guildId}`), (snapshot) => callback(snapshot.val()));
}
