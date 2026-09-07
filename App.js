import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './src/firebase';
import GameScreen from './src/screens/GameScreen';
import { uploadAvatar, uploadGuildImage, uploadEventMedia } from './src/services/winerlandMedia';

function MediaManager() {
  const [visible, setVisible] = useState(false);
  const [uid, setUid] = useState(null);
  const [guildId, setGuildId] = useState('');
  const [eventId, setEventId] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);

  useEffect(() => onAuthStateChanged(auth, (user) => setUid(user?.uid || null)), []);

  const pick = async (mediaTypes) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) throw new Error('Permission galerie refusée');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes,
      allowsEditing: mediaTypes === ['images'],
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return null;
    return result.assets[0];
  };

  const run = async (label, action) => {
    if (busy) return;
    setBusy(true);
    setStatus(`${label}...`);
    try {
      const media = await action();
      if (media) {
        if (label === 'AVATAR') setAvatarUrl(media.url);
        setStatus(`${label} ENREGISTRÉ • CLOUDINARY`);
      } else {
        setStatus('SÉLECTION ANNULÉE');
      }
    } catch (error) {
      setStatus(error?.message || `${label} ÉCHOUÉ`);
    } finally {
      setBusy(false);
    }
  };

  const handleAvatar = () => run('AVATAR', async () => {
    if (!uid) throw new Error('Connexion Firebase en cours');
    const asset = await pick(['images']);
    return asset ? uploadAvatar(uid, asset.uri) : null;
  });

  const handleGuild = () => run('GUILDE', async () => {
    if (!guildId.trim()) throw new Error('ID de guilde requis');
    const asset = await pick(['images']);
    return asset ? uploadGuildImage(guildId.trim(), asset.uri) : null;
  });

  const handleEvent = () => run('ÉVÉNEMENT', async () => {
    if (!eventId.trim()) throw new Error('ID événement requis');
    const asset = await pick(['images', 'videos']);
    if (!asset) return null;
    const resourceType = asset.type === 'video' ? 'video' : 'image';
    return uploadEventMedia(eventId.trim(), asset.uri, resourceType);
  });

  return (
    <>
      <TouchableOpacity style={styles.mediaLauncher} onPress={() => setVisible(true)} activeOpacity={0.82}>
        <Text style={styles.mediaLauncherText}>MEDIA</Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <View style={styles.backdrop}>
          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <View>
                <Text style={styles.title}>MEDIA COMMAND</Text>
                <Text style={styles.subtitle}>CLOUDINARY • PROFIL • GUILDE • ÉVÉNEMENT</Text>
              </View>
              <TouchableOpacity onPress={() => setVisible(false)} style={styles.close}>
                <Text style={styles.closeText}>×</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.action} onPress={handleAvatar} disabled={busy}>
              <Text style={styles.actionTitle}>AVATAR PROFIL</Text>
              <Text style={styles.actionSub}>Galerie → Cloudinary → Firebase</Text>
            </TouchableOpacity>

            <TextInput value={guildId} onChangeText={setGuildId} placeholder="ID de guilde" placeholderTextColor="#52747b" style={styles.input} autoCapitalize="none" />
            <TouchableOpacity style={styles.action} onPress={handleGuild} disabled={busy}>
              <Text style={styles.actionTitle}>IMAGE DE GUILDE</Text>
              <Text style={styles.actionSub}>Cloudinary → guilds/{guildId || 'ID'}</Text>
            </TouchableOpacity>

            <TextInput value={eventId} onChangeText={setEventId} placeholder="ID de l’événement" placeholderTextColor="#52747b" style={styles.input} autoCapitalize="none" />
            <TouchableOpacity style={styles.action} onPress={handleEvent} disabled={busy}>
              <Text style={styles.actionTitle}>MÉDIA D’ÉVÉNEMENT</Text>
              <Text style={styles.actionSub}>Image ou vidéo → Cloudinary → eventMedia</Text>
            </TouchableOpacity>

            {avatarUrl ? <Text style={styles.urlText} numberOfLines={2}>Avatar : {avatarUrl}</Text> : null}
            {status ? <Text style={styles.status}>{status}</Text> : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

export default function App() {
  return (
    <>
      <StatusBar hidden />
      <GameScreen />
      <MediaManager />
    </>
  );
}

const styles = StyleSheet.create({
  mediaLauncher: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 20,
    paddingVertical: 8,
    paddingHorizontal: 11,
    borderRadius: 9,
    backgroundColor: 'rgba(5,15,21,.92)',
    borderWidth: 1,
    borderColor: '#7c5cff',
  },
  mediaLauncherText: { color: '#fff', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.72)', justifyContent: 'center', alignItems: 'center', padding: 18 },
  panel: { width: 'min(520px, 92%)', maxWidth: 520, borderRadius: 16, padding: 18, backgroundColor: '#071018', borderWidth: 1, borderColor: '#24515a' },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  title: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 2 },
  subtitle: { color: '#00e5c0', fontSize: 8, fontWeight: '800', marginTop: 4, letterSpacing: 1 },
  close: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: '#31535a', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#fff', fontSize: 22, lineHeight: 22 },
  action: { paddingVertical: 12, paddingHorizontal: 13, borderRadius: 10, borderWidth: 1, borderColor: '#1d4f55', backgroundColor: '#0a1b22', marginTop: 8 },
  actionTitle: { color: '#fff', fontSize: 10, fontWeight: '900' },
  actionSub: { color: '#6b969e', fontSize: 8, marginTop: 4 },
  input: { marginTop: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 9, borderWidth: 1, borderColor: '#1d4f55', backgroundColor: '#06151b', color: '#fff', fontSize: 10 },
  status: { color: '#00e5c0', fontSize: 9, fontWeight: '800', marginTop: 14 },
  urlText: { color: '#7ea3aa', fontSize: 7, marginTop: 10 },
});
