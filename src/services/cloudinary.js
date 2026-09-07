const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || 'bk4jm7px';
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'winerland_mobile';

export const cloudinaryConfigured = Boolean(CLOUD_NAME && UPLOAD_PRESET);

/**
 * Uploads a local file URI directly to Cloudinary using the unsigned
 * winerland_mobile preset. No API secret is used in the mobile app.
 */
export async function uploadToCloudinary(fileUri, { resourceType = 'image', folder = 'winerland' } = {}) {
  if (!fileUri) throw new Error('Cloudinary: fileUri manquant');
  if (!cloudinaryConfigured) throw new Error('Cloudinary: configuration manquante');

  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;
  const formData = new FormData();
  formData.append('file', {
    uri: fileUri,
    name: `winerland-${Date.now()}`,
    type: resourceType === 'video' ? 'video/mp4' : 'image/jpeg',
  });
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', folder);

  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();
  if (!response.ok || !data.secure_url) {
    throw new Error(data?.error?.message || 'Cloudinary: échec de l’upload');
  }

  return {
    url: data.secure_url,
    publicId: data.public_id || null,
    assetId: data.asset_id || null,
    resourceType: data.resource_type || resourceType,
    format: data.format || null,
    width: data.width || null,
    height: data.height || null,
    bytes: data.bytes || null,
  };
}

export async function uploadImageToCloudinary(fileUri, folder = 'winerland/images') {
  return uploadToCloudinary(fileUri, { resourceType: 'image', folder });
}

export async function uploadVideoToCloudinary(fileUri, folder = 'winerland/videos') {
  return uploadToCloudinary(fileUri, { resourceType: 'video', folder });
}

export function getCloudinaryConfig() {
  return { cloudName: CLOUD_NAME, uploadPreset: UPLOAD_PRESET };
}
