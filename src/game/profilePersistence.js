import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { createHunterProgress } from './hunterSystems';

const cacheKey = (uid) => `winerland:profile:${uid}`;

export async function loadHunterProfile(uid) {
  if (!uid) return createHunterProgress();
  const fallback = createHunterProgress();
  try {
    const cached = await AsyncStorage.getItem(cacheKey(uid));
    if (cached) return { ...fallback, ...JSON.parse(cached) };
  } catch (_) {}
  try {
    const snapshot = await getDoc(doc(db, 'players', uid));
    if (snapshot.exists()) return { ...fallback, ...(snapshot.data().progress || {}) };
  } catch (_) {}
  return fallback;
}

export async function saveHunterProfile(uid, progress) {
  if (!uid) return;
  const safe = { ...createHunterProgress(), ...progress, updatedAt: Date.now() };
  await AsyncStorage.setItem(cacheKey(uid), JSON.stringify(safe));
  try {
    await setDoc(doc(db, 'players', uid), { progress: safe, progressUpdatedAt: Date.now() }, { merge: true });
  } catch (_) {
    // Local cache remains available if Firebase is temporarily offline.
  }
}
