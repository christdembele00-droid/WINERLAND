import * as ImagePicker from 'expo-image-picker';

export async function pickImage({ allowsEditing = true, aspect = [1, 1], quality = 0.85 } = {}) {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Permission galerie refusée');

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing,
    aspect,
    quality,
  });

  if (result.canceled || !result.assets?.[0]?.uri) return null;
  return result.assets[0];
}

export async function pickMedia({ allowsEditing = false, quality = 0.85 } = {}) {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Permission galerie refusée');

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    allowsEditing,
    quality,
  });

  if (result.canceled || !result.assets?.[0]?.uri) return null;
  return result.assets[0];
}
