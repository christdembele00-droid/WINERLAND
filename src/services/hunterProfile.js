import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { createHunterProgress } from '../game/hunterSystems';

export async function loadHunterProfile(uid) {
  if (!uid) throw new Error('Utilisateur non connecté');
  const snapshot = await getDoc(doc(db, 'players', uid));
  const data = snapshot.exists() ? snapshot.data() : {};
  return {
    ...createHunterProgress(),
    ...(data.progress || {}),
  };
}

export async function saveHunterProgress(uid, progress) {
  if (!uid) throw new Error('Utilisateur non connecté');
  await setDoc(doc(db, 'players', uid), {
    progress,
    updatedAt: Date.now(),
  }, { merge: true });
  return progress;
}
