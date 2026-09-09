import React, { Component, useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './src/firebase';
import GameScreen from './src/screens/GameScreen';
import { uploadAvatar, uploadGuildImage, uploadEventMedia } from './src/services/winerlandMedia';

class AppErrorBoundary extends Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error) { console.error('WINERLAND APP ERROR', error); }
  handleRetry = () => this.setState({ hasError: false });
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={styles.errorScreen}>
        <Text style={styles.errorTitle}>WINERLAND</Text>
        <Text style={styles.errorText}>Une erreur a interrompu le module de jeu.</Text>
        <TouchableOpacity style={styles.retryButton} onPress={this.handleRetry}>
          <Text style={styles.retryText}>RECHARGER LE MODULE</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

function HomeOverlay({ onPlay }) {
  const [active, setActive] = useState('JOUER');
  const menu = [
    ['JOUER', 'Lancer l’opération'],
    ['MONDE OUVERT', 'Explorer les secteurs'],
    ['MULTIJOUEUR', 'Rejoindre le réseau'],
    ['GUILDES DE CHASSEURS', 'Factions & territoires'],
    ['ROBOTS', 'Unités autonomes'],
    ['MISSIONS', 'Objectifs dynamiques'],
    ['INVENTAIRE', 'Équipement & ressources'],
    ['PROFIL', 'Dossier du chasseur'],
  ];

  const select = (name) => {
    setActive(name);
    if (name === 'JOUER') onPlay();
  };

  return (
    <View style={styles.homeOverlay} pointerEvents="box-none">
      <View style={styles.homeShade} />
      <View style={styles.scanline} />

      <View style={styles.homeHeader}>
        <View>
          <Text style={styles.brand}>WIENERLAND</Text>
          <Text style={styles.brandSub}>HUNTER NETWORK // OPERATIONAL BUILD 2026</Text>
        </View>
        <View style={styles.statusChip}>
          <View style={styles.liveDot} />
          <Text style={styles.statusText}>NETWORK ONLINE</Text>
        </View>
      </View>

      <View style={styles.heroCopy}>
        <Text style={styles.heroEyebrow}>NEXUS CITY • SECTOR 07</Text>
        <Text style={styles.heroTitle}>THE HUNT{`\n`}HAS BEGUN</Text>
        <Text style={styles.heroDescription}>
          Une zone urbaine instable. Des guildes rivales. Des machines autonomes.
          {'\n'}Chaque secteur peut changer d’état sans prévenir.
        </Text>
        <View style={styles.heroTelemetry}>
          <Text style={styles.telemetry}>// WEATHER: RAIN / LOW VISIBILITY</Text>
          <Text style={styles.telemetry}>// THREAT: HIGH</Text>
          <Text style={styles.telemetry}>// ACTIVE EVENTS: 03</Text>
        </View>
      </View>

      <View style={styles.menuPanel}>
        <Text style={styles.menuLabel}>TACTICAL COMMAND</Text>
        {menu.map(([name, sub], index) => (
          <TouchableOpacity
            key={name}
            activeOpacity={0.8}
            onPress={() => select(name)}
            style={[styles.menuItem, active === name && styles.menuItemActive]}
          >
            <View style={styles.menuIndex}><Text style={styles.menuIndexText}>{String(index + 1).padStart(2, '0')}</Text></View>
            <View style={styles.menuTextWrap}>
              <Text style={[styles.menuTitle, active === name && styles.menuTitleActive]}>{name}</Text>
              <Text style={styles.menuSub}>{sub}</Text>
            </View>
            <Text style={styles.menuArrow}>{active === name ? '▶' : '›'}</Text>
          </TouchableOpacity>
        ))}
        <View style={styles.menuFooter}>
          <Text style={styles.footerText}>BUILD 2026.09 • ONLINE SERVICES</Text>
          <Text style={styles.footerText}>SECURITY LEVEL: HUNTER</Text>
        </View>
      </View>

      <View style={styles.homeBottom}>
        <View><Text style={styles.bottomKicker}>LIVE WORLD</Text><Text style={styles.bottomValue}>03 EVENTS / 07 SECTORS / 24 HUNTERS</Text></View>
        <View style={styles.bottomHint}><Text style={styles.hintKey}>SELECT</Text><Text style={styles.hintText}>TACTICAL MENU</Text></View>
      </View>
    </View>
  );
}

function MediaManager() {
  const [visible, setVisible] = useState(false);
  const [uid, setUid] = useState(null);
  const [guildId, setGuildId] = useState('');
  const [eventId, setEventId] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);

  useEffect(() => onAuthStateChanged(auth, (user) => setUid(user?.uid || null)), []);

  const pick = async (mediaTypes, allowsEditing = false) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) throw new Error('Permission galerie refusée');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes, allowsEditing, aspect: allowsEditing ? [1, 1] : undefined, quality: 0.85 });
    if (result.canceled || !result.assets?.[0]?.uri) return null;
    return result.assets[0];
  };

  const run = async (label, action) => {
    if (busy) return;
    setBusy(true); setStatus(`${label}...`);
    try {
      const media = await action();
      if (media) {
        if (label === 'AVATAR') setAvatarUrl(media.url);
        setStatus(`${label} ENREGISTRÉ • CLOUDINARY`);
      } else setStatus('SÉLECTION ANNULÉE');
    } catch (error) { setStatus(error?.message || `${label} ÉCHOUÉ`); }
    finally { setBusy(false); }
  };

  const handleAvatar = () => run('AVATAR', async () => {
    if (!uid) throw new Error('Connexion Firebase en cours');
    const asset = await pick(['images'], true);
    return asset ? uploadAvatar(uid, asset.uri) : null;
  });
  const handleGuild = () => run('GUILDE', async () => {
    if (!guildId.trim()) throw new Error('ID de guilde requis');
    const asset = await pick(['images'], true);
    return asset ? uploadGuildImage(guildId.trim(), asset.uri) : null;
  });
  const handleEvent = () => run('ÉVÉNEMENT', async () => {
    if (!eventId.trim()) throw new Error('ID événement requis');
    const asset = await pick(['images', 'videos']);
    if (!asset) return null;
    return uploadEventMedia(eventId.trim(), asset.uri, asset.type === 'video' ? 'video' : 'image');
  });

  return (
    <>
      <TouchableOpacity style={styles.mediaLauncher} onPress={() => setVisible(true)} activeOpacity={0.82}>
        <Text style={styles.mediaLauncherText}>MEDIA</Text>
      </TouchableOpacity>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <View style={styles.backdrop}>
          <View style={styles.panel}>
            <View style={styles.panelHeader}><View><Text style={styles.title}>MEDIA COMMAND</Text><Text style={styles.subtitle}>CLOUDINARY • PROFIL • GUILDE • ÉVÉNEMENT</Text></View><TouchableOpacity onPress={() => setVisible(false)} style={styles.close}><Text style={styles.closeText}>×</Text></TouchableOpacity></View>
            <TouchableOpacity style={styles.action} onPress={handleAvatar} disabled={busy}><Text style={styles.actionTitle}>AVATAR PROFIL</Text><Text style={styles.actionSub}>Galerie → Cloudinary → Firebase</Text></TouchableOpacity>
            <TextInput value={guildId} onChangeText={setGuildId} placeholder="ID de guilde" placeholderTextColor="#60747a" style={styles.input} autoCapitalize="none" />
            <TouchableOpacity style={styles.action} onPress={handleGuild} disabled={busy}><Text style={styles.actionTitle}>IMAGE DE GUILDE</Text><Text style={styles.actionSub}>Cloudinary → guilds/{guildId || 'ID'}</Text></TouchableOpacity>
            <TextInput value={eventId} onChangeText={setEventId} placeholder="ID de l’événement" placeholderTextColor="#60747a" style={styles.input} autoCapitalize="none" />
            <TouchableOpacity style={styles.action} onPress={handleEvent} disabled={busy}><Text style={styles.actionTitle}>MÉDIA D’ÉVÉNEMENT</Text><Text style={styles.actionSub}>Image ou vidéo → Cloudinary → eventMedia</Text></TouchableOpacity>
            {avatarUrl ? <Text style={styles.urlText} numberOfLines={2}>Avatar : {avatarUrl}</Text> : null}
            {status ? <Text style={styles.status}>{status}</Text> : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

export default function App() {
  const [home, setHome] = useState(true);
  return (
    <AppErrorBoundary>
      <StatusBar hidden />
      <View style={styles.root}>
        <GameScreen />
        {home ? <HomeOverlay onPlay={() => setHome(false)} /> : null}
        {!home ? <TouchableOpacity style={styles.homeButton} onPress={() => setHome(true)} activeOpacity={0.8}><Text style={styles.homeButtonText}>MENU</Text></TouchableOpacity> : null}
        <MediaManager />
      </View>
    </AppErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#02070a' },
  homeOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(2,7,10,.52)' },
  homeShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(2,7,10,.30)' },
  scanline: { ...StyleSheet.absoluteFillObject, borderWidth: 1, borderColor: 'rgba(255,122,47,.16)' },
  homeHeader: { position: 'absolute', top: 18, left: 22, right: 22, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  brand: { color: '#fff', fontSize: 30, fontWeight: '900', letterSpacing: 7 },
  brandSub: { color: '#ff8a4a', fontSize: 8, fontWeight: '800', letterSpacing: 2, marginTop: 5 },
  statusChip: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: 'rgba(255,138,74,.35)', backgroundColor: 'rgba(3,12,16,.78)', borderRadius: 8 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#ff7a2f', marginRight: 7 },
  statusText: { color: '#dcebed', fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  heroCopy: { position: 'absolute', left: 24, bottom: 90, width: '47%', maxWidth: 560 },
  heroEyebrow: { color: '#ff8a4a', fontSize: 10, fontWeight: '900', letterSpacing: 2.5, marginBottom: 10 },
  heroTitle: { color: '#fff', fontSize: 42, lineHeight: 40, fontWeight: '900', letterSpacing: 2 },
  heroDescription: { color: '#c4d2d5', fontSize: 11, lineHeight: 17, marginTop: 14, maxWidth: 450 },
  heroTelemetry: { marginTop: 17, borderLeftWidth: 2, borderLeftColor: '#ff7a2f', paddingLeft: 10 },
  telemetry: { color: '#7f9a9f', fontSize: 8, letterSpacing: 1.2, marginBottom: 4 },
  menuPanel: { position: 'absolute', top: 86, right: 22, width: 330, maxWidth: '44%', padding: 10, borderWidth: 1, borderColor: 'rgba(111,155,163,.35)', backgroundColor: 'rgba(3,11,16,.91)' },
  menuLabel: { color: '#ff8a4a', fontSize: 8, fontWeight: '900', letterSpacing: 2.5, paddingHorizontal: 9, paddingVertical: 8 },
  menuItem: { minHeight: 48, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(105,145,151,.12)', paddingHorizontal: 7 },
  menuItemActive: { backgroundColor: 'rgba(255,122,47,.12)', borderLeftWidth: 3, borderLeftColor: '#ff7a2f' },
  menuIndex: { width: 30 },
  menuIndexText: { color: '#60777d', fontSize: 8, fontWeight: '800' },
  menuTextWrap: { flex: 1 },
  menuTitle: { color: '#c7d6d9', fontSize: 10, fontWeight: '900', letterSpacing: .8 },
  menuTitleActive: { color: '#fff' },
  menuSub: { color: '#60777d', fontSize: 7, marginTop: 2 },
  menuArrow: { color: '#ff7a2f', fontSize: 14, width: 18, textAlign: 'right' },
  menuFooter: { paddingHorizontal: 9, paddingTop: 10, paddingBottom: 5, borderTopWidth: 1, borderTopColor: 'rgba(105,145,151,.15)' },
  footerText: { color: '#496168', fontSize: 7, letterSpacing: 1, marginBottom: 3 },
  homeBottom: { position: 'absolute', left: 22, right: 22, bottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  bottomKicker: { color: '#ff8a4a', fontSize: 7, fontWeight: '900', letterSpacing: 2 },
  bottomValue: { color: '#84999e', fontSize: 8, marginTop: 3, letterSpacing: 1 },
  bottomHint: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  hintKey: { color: '#071015', backgroundColor: '#ff7a2f', paddingHorizontal: 7, paddingVertical: 4, fontSize: 7, fontWeight: '900' },
  hintText: { color: '#91a5a9', fontSize: 7, letterSpacing: 1.2 },
  homeButton: { position: 'absolute', top: 16, left: 16, zIndex: 30, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: 'rgba(4,12,17,.9)', borderWidth: 1, borderColor: '#ff7a2f', borderRadius: 7 },
  homeButtonText: { color: '#ff8a4a', fontSize: 8, fontWeight: '900', letterSpacing: 1.5 },
  mediaLauncher: { position: 'absolute', top: 16, left: 82, zIndex: 30, paddingVertical: 8, paddingHorizontal: 11, borderRadius: 7, backgroundColor: 'rgba(5,15,21,.92)', borderWidth: 1, borderColor: '#60747a' },
  mediaLauncherText: { color: '#dcebed', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.75)', justifyContent: 'center', alignItems: 'center', padding: 18 },
  panel: { width: '92%', maxWidth: 520, borderRadius: 14, padding: 18, backgroundColor: '#071018', borderWidth: 1, borderColor: '#39565c' },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  title: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 2 },
  subtitle: { color: '#ff8a4a', fontSize: 8, fontWeight: '800', marginTop: 4, letterSpacing: 1 },
  close: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: '#31535a', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#fff', fontSize: 22, lineHeight: 22 },
  action: { paddingVertical: 12, paddingHorizontal: 13, borderRadius: 9, borderWidth: 1, borderColor: '#24444b', backgroundColor: '#0a1b22', marginTop: 8 },
  actionTitle: { color: '#fff', fontSize: 10, fontWeight: '900' },
  actionSub: { color: '#6b969e', fontSize: 8, marginTop: 4 },
  input: { marginTop: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 9, borderWidth: 1, borderColor: '#24444b', backgroundColor: '#06151b', color: '#fff', fontSize: 10 },
  status: { color: '#ff8a4a', fontSize: 9, fontWeight: '800', marginTop: 14 },
  urlText: { color: '#7ea3aa', fontSize: 7, marginTop: 10 },
  errorScreen: { flex: 1, backgroundColor: '#050b10', alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorTitle: { color: '#ff7a2f', fontSize: 28, fontWeight: '900', letterSpacing: 5 },
  errorText: { color: '#9bb5ba', marginTop: 12, fontSize: 12, textAlign: 'center' },
  retryButton: { marginTop: 22, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#ff7a2f', backgroundColor: '#0a1b22' },
  retryText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
});
