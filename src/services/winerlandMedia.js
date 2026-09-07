import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { uploadImageToCloudinary, uploadVideoToCloudinary } from './cloudinary';

async function savePlayerMedia(uid, field, media) {
  if (!uid) throw new Error('Utilisateur non connecté');
  await updateDoc(doc(db, 'players', uid), {
    [field]: media.url,
    [`${field}PublicId`]: media.publicId || null,
    [`${field}UpdatedAt`]: Date.now(),
  });
  return media;
}

export async function uploadAvatar(uid, fileUri) {
  const media = await uploadImageToCloudinary(fileUri, `winerland/players/${uid}`);
  return savePlayerMedia(uid, 'avatarUrl', media);
}

export async function uploadGuildImage(guildId, fileUri) {
  if (!guildId) throw new Error('Guilde manquante');
  return uploadImageToCloudinary(fileUri, `winerland/guilds/${guildId}`);
}

export async function uploadEventMedia(eventId, fileUri, resourceType = 'image') {
  if (!eventId) throw new Error('Événement manquant');
  const folder = `winerland/events/${eventId}`;
  return resourceType === 'video'
    ? uploadVideoToCloudinary(fileUri, folder)
    : uploadImageToCloudinary(fileUri, folder);
}
