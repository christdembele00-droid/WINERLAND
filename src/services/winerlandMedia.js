import { doc, setDoc } from 'firebase/firestore';
import { ref, update } from 'firebase/database';
import { db, realtimeDb } from '../firebase';
import { uploadImageToCloudinary, uploadVideoToCloudinary } from './cloudinary';

async function savePlayerMedia(uid, field, media) {
  if (!uid) throw new Error('Utilisateur non connecté');
  await setDoc(doc(db, 'players', uid), {
    [field]: media.url,
    [`${field}PublicId`]: media.publicId || null,
    [`${field}UpdatedAt`]: Date.now(),
  }, { merge: true });
  return media;
}

export async function uploadAvatar(uid, fileUri) {
  const media = await uploadImageToCloudinary(fileUri, `winerland/players/${uid}`);
  return savePlayerMedia(uid, 'avatarUrl', media);
}

export async function uploadGuildImage(guildId, fileUri) {
  if (!guildId) throw new Error('Guilde manquante');
  const media = await uploadImageToCloudinary(fileUri, `winerland/guilds/${guildId}`);
  await update(ref(realtimeDb, `guilds/${guildId}`), {
    imageUrl: media.url,
    imagePublicId: media.publicId || null,
    imageUpdatedAt: Date.now(),
  });
  return media;
}

export async function uploadEventMedia(eventId, fileUri, resourceType = 'image') {
  if (!eventId) throw new Error('Événement manquant');
  const folder = `winerland/events/${eventId}`;
  const media = resourceType === 'video'
    ? await uploadVideoToCloudinary(fileUri, folder)
    : await uploadImageToCloudinary(fileUri, folder);

  await setDoc(doc(db, 'eventMedia', eventId), {
    eventId,
    url: media.url,
    publicId: media.publicId || null,
    resourceType: media.resourceType || resourceType,
    format: media.format || null,
    width: media.width || null,
    height: media.height || null,
    bytes: media.bytes || null,
    updatedAt: Date.now(),
  }, { merge: true });

  return media;
}
