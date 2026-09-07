import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ScrollView, Modal } from 'react-native';
import { Canvas, useFrame } from '@react-three/fiber/native';
import * as THREE from 'three';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { onDisconnect, onValue, ref, remove, set, update } from 'firebase/database';
import { auth, realtimeDb } from '../firebase';
import { WORLD_ZONES, WORLD_EVENTS, getWorldEvent, clampWorldPosition } from '../game/worldSystem';
import { GAME_MODES, ROBOT_ARCHETYPES, MISSIONS, createHunterProgress, addXp, findMatch } from '../game/hunterSystems';
import { createGuild, subscribeGuild } from '../game/guildSystem';
import { HIGH_FIDELITY } from '../game/highFidelity';

const ROOM_ID = 'quickmatch';
const MATCH_SECONDS = 8 * 60;
const WEAPONS = [
  { id: 'pulse', label: 'PULSE', damage: 10, ammo: 30, icon: '◈' },
  { id: 'nova', label: 'NOVA', damage: 18, ammo: 18, icon: '✦' },
  { id: 'storm', label: 'STORM', damage: 7, ammo: 45, icon: '⚡' },
];

function Player({ position, remote = false, shield = false }) {
  const group = useRef();
  useFrame((state, delta) => {
    if (!group.current) return;
    group.current.rotation.y += delta * (remote ? 0.35 : 0.08);
    if (shield) group.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 6) * 0.025);
  });
  return (
    <group ref={group} position={position}>
      <mesh position={[0, 1, 0]} castShadow>
        <boxGeometry args={[0.9, 1.8, 0.75]} />
        <meshStandardMaterial color={remote ? '#ff7a2f' : '#00e5c0'} metalness={0.65} roughness={0.25} emissive={remote ? '#3b1305' : '#003d35'} />
      </mesh>
      <mesh position={[0, 2.15, 0]} castShadow>
        <sphereGeometry args={[0.42, 24, 24]} />
        <meshStandardMaterial color="#d9a47f" roughness={0.62} />
      </mesh>
      <mesh position={[0.64, 1.05, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.12, 0.12, 1.25, 16]} />
        <meshStandardMaterial color="#17212a" metalness={0.9} roughness={0.16} />
      </mesh>
      {shield && (
        <mesh position={[0, 1.15, 0]}>
          <sphereGeometry args={[1.25, 28, 20]} />
          <meshStandardMaterial color="#00e5c0" transparent opacity={0.12} wireframe />
        </mesh>
      )}
    </group>
  );
}

function Robot({ robot, destroyed }) {
  const group = useRef();
  useFrame((state, delta) => {
    if (!group.current || destroyed) return;
    group.current.rotation.y += delta * (1 + robot.speed * 0.12);
    group.current.position.y = robot.position[1] + Math.sin(state.clock.elapsedTime * 2 + robot.id) * 0.08;
  });
  if (destroyed) return null;
  const scale = robot.archetype === 'boss' ? 1.7 : robot.archetype === 'guardian' ? 1.25 : 0.85;
  return (
    <group ref={group} position={robot.position} scale={scale}>
      <mesh castShadow>
        <boxGeometry args={[0.9, 1.5, 0.8]} />
        <meshStandardMaterial color="#7c5cff" metalness={0.85} roughness={0.2} emissive="#1b0f42" />
      </mesh>
      <mesh position={[0, 0.95, 0]}>
        <sphereGeometry args={[0.28, 16, 16]} />
        <meshStandardMaterial color="#ff7a2f" emissive="#7a2208" emissiveIntensity={1.8} />
      </mesh>
      <mesh position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.58, 0.045, 8, 24]} />
        <meshBasicMaterial color="#00e5c0" />
      </mesh>
    </group>
  );
}

function World({ robots, position, remotePlayers, shield }) {
  const pillars = [[7, 1, 7], [-7, 1, -7], [7, 1, -7], [-7, 1, 7]];
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[70, 70]} />
        <meshStandardMaterial color="#07131b" metalness={0.55} roughness={0.42} />
      </mesh>
      <gridHelper args={[70, 35, '#17434a', '#0c252d']} position={[0, 0.02, 0]} />
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[12, 12.08, 96]} />
        <meshBasicMaterial color="#00e5c0" transparent opacity={0.85} />
      </mesh>
      {pillars.map((p, i) => (
        <group key={i} position={p}>
          <mesh castShadow><cylinderGeometry args={[0.72, 0.92, 3, 10]} /><meshStandardMaterial color={i % 2 ? '#263f91' : '#4d245f'} metalness={0.7} roughness={0.2} /></mesh>
          <mesh position={[0, 1.65, 0]}><torusGeometry args={[0.92, 0.065, 8, 32]} /><meshBasicMaterial color="#00e5c0" /></mesh>
          <pointLight position={[0, 1.7, 0]} intensity={2.2} distance={7} color={i % 2 ? '#7c5cff' : '#00e5c0'} />
        </group>
      ))}
      <mesh position={[0, 1.1, -6]} castShadow><boxGeometry args={[9, 2.2, 0.8]} /><meshStandardMaterial color="#172831" metalness={0.82} roughness={0.22} /></mesh>
      <mesh position={[0, 1.1, 6]} castShadow><boxGeometry args={[9, 2.2, 0.8]} /><meshStandardMaterial color="#172831" metalness={0.82} roughness={0.22} /></mesh>
      <mesh position={[-6, 1.1, 0]} castShadow><boxGeometry args={[0.8, 2.2, 9]} /><meshStandardMaterial color="#13242c" metalness={0.82} roughness={0.22} /></mesh>
      <mesh position={[6, 1.1, 0]} castShadow><boxGeometry args={[0.8, 2.2, 9]} /><meshStandardMaterial color="#13242c" metalness={0.82} roughness={0.22} /></mesh>
      {robots.map((robot) => <Robot key={robot.id} robot={robot} destroyed={robot.destroyed} />)}
      <Player position={position} shield={shield} />
      {remotePlayers.map((player) => <Player key={player.id} position={player.position} remote />)}
    </group>
  );
}

function CameraFollow({ position }) {
  useFrame(({ camera }, delta) => {
    const target = new THREE.Vector3(position[0], 0.9, position[2]);
    const desired = new THREE.Vector3(position[0], 8.2, position[2] + 11.5);
    camera.position.lerp(desired, Math.min(1, delta * 5));
    camera.lookAt(target);
  });
  return null;
}

function MiniMap({ position, remotePlayers, robots }) {
  const size = 118;
  const scale = 3.2;
  return (
    <View style={styles.map}>
      <Text style={styles.mapTitle}>TACTICAL MAP</Text>
      <View style={styles.mapField}>
        <View style={[styles.mapGrid, { left: 0, right: 0, top: '50%', height: 1 }]} />
        <View style={[styles.mapGrid, { top: 0, bottom: 0, left: '50%', width: 1 }]} />
        {robots.filter((r) => !r.destroyed).map((r) => <View key={`r${r.id}`} style={[styles.robotDot, { left: size / 2 + r.position[0] * scale - 3, top: size / 2 + r.position[2] * scale - 3 }]} />)}
        {remotePlayers.map((p) => <View key={p.id} style={[styles.enemyDot, { left: size / 2 + p.position[0] * scale - 4, top: size / 2 + p.position[2] * scale - 4 }]} />)}
        <View style={[styles.playerDot, { left: size / 2 + position[0] * scale - 5, top: size / 2 + position[2] * scale - 5 }]} />
      </View>
    </View>
  );
}

function PanelButton({ title, sub, active, onPress }) {
  return <TouchableOpacity style={[styles.panelButton, active && styles.panelButtonActive]} onPress={onPress} activeOpacity={0.82}><Text style={styles.panelButtonTitle}>{title}</Text>{sub ? <Text style={styles.panelButtonSub}>{sub}</Text> : null}</TouchableOpacity>;
}

export default function GameScreen() {
  const [position, setPosition] = useState([0, 0, 6]);
  const [score, setScore] = useState(0);
  const [hp, setHp] = useState(100);
  const [remotePlayers, setRemotePlayers] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('CONNEXION...');
  const [uid, setUid] = useState(null);
  const [mode, setMode] = useState('open-world');
  const [weapon, setWeapon] = useState('pulse');
  const [ammo, setAmmo] = useState(30);
  const [shield, setShield] = useState(false);
  const [panel, setPanel] = useState(null);
  const [matchTime, setMatchTime] = useState(MATCH_SECONDS);
  const [zoneId, setZoneId] = useState('central');
  const [progress, setProgress] = useState(createHunterProgress());
  const [guild, setGuild] = useState(null);
  const [guildName, setGuildName] = useState('WINERLAND ELITE');
  const [robots, setRobots] = useState(() => ROBOT_ARCHETYPES.slice(0, 3).map((a, i) => ({ ...a, id: i + 1, archetype: a.id, position: [i * 3 - 3, 0.8, i % 2 ? -3 : 1], destroyed: false })));
  const [event, setEvent] = useState(getWorldEvent());
  const [notice, setNotice] = useState('SYSTÈMES WINERLAND INITIALISÉS');

  const currentWeapon = WEAPONS.find((item) => item.id === weapon) || WEAPONS[0];
  const currentMode = GAME_MODES.find((item) => item.id === mode) || GAME_MODES[0];
  const currentZone = WORLD_ZONES.find((item) => item.id === zoneId) || WORLD_ZONES[0];
  const livePlayers = useMemo(() => [{ id: uid, mode }].filter((p) => p.id), [uid, mode]);

  useEffect(() => {
    let unsubscribeAuth;
    let unsubscribeRoom;
    let mounted = true;
    const startRealtime = async (user) => {
      if (!mounted || !user) return;
      setUid(user.uid);
      const playerRef = ref(realtimeDb, `rooms/${ROOM_ID}/players/${user.uid}`);
      const playersRef = ref(realtimeDb, `rooms/${ROOM_ID}/players`);
      try {
        await onDisconnect(playerRef).remove();
        await set(playerRef, { x: 0, y: 0, z: 6, rotation: 0, health: 100, score: 0, mode, weapon, shield: false, zoneId: 'central', joinedAt: Date.now() });
        setConnectionStatus('EN LIGNE');
        unsubscribeRoom = onValue(playersRef, (snapshot) => {
          const data = snapshot.val() || {};
          const others = Object.entries(data).filter(([id]) => id !== user.uid).map(([id, player]) => ({ id, position: [player.x || 0, player.y || 0, player.z || 0], mode: player.mode }));
          setRemotePlayers(others);
        }, () => setConnectionStatus('RÉSEAU INSTABLE'));
      } catch { setConnectionStatus('ERREUR FIREBASE'); }
    };
    unsubscribeAuth = onAuthStateChanged(auth, (user) => user ? startRealtime(user) : signInAnonymously(auth).catch(() => setConnectionStatus('CONNEXION IMPOSSIBLE')));
    return () => { mounted = false; unsubscribeAuth?.(); unsubscribeRoom?.(); if (auth.currentUser) remove(ref(realtimeDb, `rooms/${ROOM_ID}/players/${auth.currentUser.uid}`)).catch(() => {}); };
  }, []);

  useEffect(() => {
    if (!uid) return;
    update(ref(realtimeDb, `rooms/${ROOM_ID}/players/${uid}`), { x: position[0], y: position[1], z: position[2], health: hp, score, mode, weapon, shield, zoneId, updatedAt: Date.now() }).catch(() => setConnectionStatus('RÉSEAU INSTABLE'));
  }, [position, hp, score, uid, mode, weapon, shield, zoneId]);

  useEffect(() => { const timer = setInterval(() => setMatchTime((v) => v > 0 ? v - 1 : MATCH_SECONDS), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => { const timer = setInterval(() => setEvent(getWorldEvent()), 30000); return () => clearInterval(timer); }, []);
  useEffect(() => { if (!guild?.id) return; return subscribeGuild(guild.id, (value) => value && setGuild(value)); }, [guild?.id]);

  const move = (dx, dz) => {
    const boost = mode === 'ranked' ? 1.15 : 1;
    setPosition(([x, y, z]) => { const [nx, nz] = clampWorldPosition(x + dx * boost, z + dz * boost, 28); return [nx, y, nz]; });
  };

  const shoot = () => {
    if (ammo <= 0) { setAmmo(currentWeapon.ammo); setNotice('CHARGEUR RECHARGÉ'); return; }
    setAmmo((v) => v - 1);
    const target = robots.find((r) => !r.destroyed);
    if (target) {
      const remaining = target.hp - currentWeapon.damage;
      if (remaining <= 0) {
        setRobots((list) => list.map((r) => r.id === target.id ? { ...r, hp: 0, destroyed: true } : r));
        const next = addXp(progress, target.reward);
        setProgress({ ...next, robotsDestroyed: next.robotsDestroyed + 1, credits: next.credits + target.reward });
        setScore((v) => v + target.reward);
        setNotice(`${target.name} NEUTRALISÉ • +${target.reward} XP`);
      } else setRobots((list) => list.map((r) => r.id === target.id ? { ...r, hp: remaining } : r));
    } else { setScore((v) => v + currentWeapon.damage); setNotice('SECTEUR SÉCURISÉ'); }
  };

  const dash = () => { move(0, -3); setScore((v) => v + 5); setNotice('DASH TACTIQUE'); };
  const toggleShield = () => { setShield((v) => !v); setNotice(shield ? 'BOUCLIER DÉSACTIVÉ' : 'BOUCLIER ACTIVÉ'); };
  const selectWeapon = (id) => { setWeapon(id); const selected = WEAPONS.find((item) => item.id === id); setAmmo(selected?.ammo || 30); setPanel(null); };
  const selectMode = (id) => { setMode(id); setPanel(null); setNotice(`${(GAME_MODES.find((m) => m.id === id) || GAME_MODES[0]).name} ACTIVÉ`); };
  const switchZone = () => { const index = WORLD_ZONES.findIndex((z) => z.id === zoneId); const next = WORLD_ZONES[(index + 1) % WORLD_ZONES.length]; setZoneId(next.id); setPosition([0, 0, 6]); setNotice(`TRANSFERT → ${next.name}`); };
  const startMission = (mission) => { const next = addXp(progress, mission.rewardXp); setProgress({ ...next, missionsCompleted: next.missionsCompleted + 1, credits: next.credits + mission.rewardXp * 2 }); setScore((v) => v + mission.rewardXp); setNotice(`${mission.title} TERMINÉE • +${mission.rewardXp} XP`); };
  const createMyGuild = async () => {
    if (!uid) return;
    try { const created = await createGuild({ name: guildName || 'WINERLAND ELITE', tag: 'WNR', leaderId: uid, leaderName: 'Hunter' }); setGuild(created); setPanel(null); setNotice(`GUILDE ${created.tag} CRÉÉE`); } catch { setNotice('CRÉATION DE GUILDE REFUSÉE PAR LE RÉSEAU'); }
  };
  const matchPreview = findMatch({ modeId: mode, players: [...livePlayers, ...remotePlayers], maxPlayers: 10 });
  const formatTime = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <View style={styles.container}>
      <Canvas shadows dpr={[1, 2]} gl={{ antialias: HIGH_FIDELITY.renderer.antialias, powerPreference: 'high-performance' }} camera={{ position: [0, 8, 18], fov: 55 }}>
        <color attach="background" args={[HIGH_FIDELITY.artDirection.palette[0]]} />
        <fog attach="fog" args={[HIGH_FIDELITY.artDirection.palette[0], 20, 48]} />
        <ambientLight intensity={0.55} />
        <hemisphereLight intensity={0.75} color="#d8ffff" groundColor="#07131b" />
        <directionalLight position={[10, 18, 10]} intensity={2.5} castShadow shadow-mapSize-width={HIGH_FIDELITY.renderer.shadowMap} shadow-mapSize-height={HIGH_FIDELITY.renderer.shadowMap} />
        <pointLight position={[0, 4, 0]} intensity={8} distance={18} color="#00e5c0" />
        <World robots={robots} position={position} remotePlayers={remotePlayers} shield={shield} />
        <CameraFollow position={position} />
      </Canvas>

      <View style={styles.hud} pointerEvents="box-none">
        <View style={styles.header}>
          <View>
            <View style={styles.brandRow}><View style={styles.brandMark}><Text style={styles.brandMarkText}>W</Text></View><View><Text style={styles.title}>WINERLAND</Text><Text style={styles.subtitle}>NEXT-GEN HUNTER • {currentMode.name}</Text></View></View>
            <Text style={styles.connection}>● {connectionStatus}  •  {remotePlayers.length + 1} JOUEUR(S)  •  {currentZone.name}</Text>
          </View>
          <View style={styles.topActions}><MiniMap position={position} remotePlayers={remotePlayers} robots={robots} /><View style={styles.statCard}><Text style={styles.statLabel}>MATCH</Text><Text style={styles.timer}>{formatTime(matchTime)}</Text></View><View style={styles.statCard}><Text style={styles.statLabel}>LVL {progress.level}</Text><Text style={styles.statValue}>{score}</Text></View></View>
        </View>

        <View style={styles.eventBar}><Text style={styles.eventLabel}>WORLD EVENT</Text><Text style={styles.eventValue}>{event.replaceAll('_', ' ')} • DANGER {currentZone.danger}/10</Text><Text style={styles.notice}>{notice}</Text></View>

        <View style={styles.modeRail}>
          {GAME_MODES.slice(0, 4).map((item) => <TouchableOpacity key={item.id} style={[styles.modeButton, mode === item.id && styles.modeButtonActive]} onPress={() => selectMode(item.id)}><Text style={styles.modeIcon}>{item.pvp ? '⚔' : '◆'}</Text><View><Text style={styles.modeLabel}>{item.name}</Text><Text style={styles.modeSub}>{item.teamSize} JOUEUR(S)</Text></View></TouchableOpacity>)}
          <TouchableOpacity style={styles.menuButton} onPress={() => setPanel(panel ? null : 'menu')}><Text style={styles.menuIcon}>☰</Text><Text style={styles.menuText}>MENU</Text></TouchableOpacity>
        </View>

        <View style={styles.bottomBar}>
          <View style={styles.leftControls}><View style={styles.dpad}><TouchableOpacity style={styles.move} onPress={() => move(0, -0.75)}><Text style={styles.arrow}>▲</Text></TouchableOpacity><View style={styles.row}><TouchableOpacity style={styles.move} onPress={() => move(-0.75, 0)}><Text style={styles.arrow}>◀</Text></TouchableOpacity><TouchableOpacity style={styles.move} onPress={() => move(0, 0.75)}><Text style={styles.arrow}>▼</Text></TouchableOpacity><TouchableOpacity style={styles.move} onPress={() => move(0.75, 0)}><Text style={styles.arrow}>▶</Text></TouchableOpacity></View></View><View style={styles.utilityRow}><TouchableOpacity style={styles.utilityButton} onPress={dash}><Text style={styles.utilityText}>DASH</Text></TouchableOpacity><TouchableOpacity style={[styles.utilityButton, shield && styles.utilityActive]} onPress={toggleShield}><Text style={styles.utilityText}>SHIELD</Text></TouchableOpacity></View></View>
          <View style={styles.centerInfo}><Text style={styles.hpText}>HP {hp}</Text><View style={styles.hpTrack}><View style={[styles.hpFill, { width: `${hp}%` }]} /></View><Text style={styles.levelText}>LV {progress.level} • {progress.xp} XP • {progress.credits} CR</Text></View>
          <View style={styles.rightControls}><View style={styles.weaponRow}>{WEAPONS.map((w) => <TouchableOpacity key={w.id} style={[styles.weaponButton, weapon === w.id && styles.weaponActive]} onPress={() => selectWeapon(w.id)}><Text style={styles.weaponIcon}>{w.icon}</Text><Text style={styles.weaponText}>{w.label}</Text></TouchableOpacity>)}</View><TouchableOpacity style={styles.fireButton} onPress={shoot} activeOpacity={0.78}><Text style={styles.fireText}>FIRE</Text><Text style={styles.ammo}>{ammo}</Text></TouchableOpacity></View>
        </View>
      </View>

      <Modal visible={!!panel} transparent animationType="fade" onRequestClose={() => setPanel(null)}>
        <View style={styles.modalBackdrop}><View style={styles.modal}><Text style={styles.modalTitle}>WINERLAND COMMAND</Text><Text style={styles.modalSub}>HIGH-FIDELITY SYSTEMS • {currentZone.name}</Text><ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {panel === 'menu' && <>
            <PanelButton title="🌍 MONDE OUVERT" sub={`${WORLD_ZONES.length} secteurs • événement ${event}`} onPress={() => setPanel('world')} />
            <PanelButton title="🏰 GUILDE DE CHASSEURS" sub={guild ? `${guild.name} [${guild.tag}] • Niv. ${guild.level}` : 'Créer ton QG de chasse'} onPress={() => setPanel('guild')} />
            <PanelButton title="🎯 MISSIONS & CONTRATS" sub={`${progress.missionsCompleted} terminée(s) • ${MISSIONS.length} contrats`} onPress={() => setPanel('missions')} />
            <PanelButton title="🤖 CHASSE AUX ROBOTS" sub={`${robots.filter((r) => !r.destroyed).length} cible(s) actives`} onPress={() => setPanel('robots')} />
            <PanelButton title="⚡ MATCHMAKING" sub={`${matchPreview.length} joueur(s) détecté(s) pour ${currentMode.name}`} onPress={() => setNotice(`MATCHMAKING ${currentMode.name} • ${matchPreview.length} JOUEUR(S)`)} />
          </>}
          {panel === 'world' && <><Text style={styles.sectionTitle}>SECTEURS</Text>{WORLD_ZONES.map((z) => <PanelButton key={z.id} title={z.name} sub={`${z.type.toUpperCase()} • danger ${z.danger}/10 • ${z.size}m`} active={zoneId === z.id} onPress={() => { setZoneId(z.id); setPanel(null); setNotice(`ZONE ${z.name} CHARGÉE`); }} />)}</>}
          {panel === 'guild' && <><Text style={styles.sectionTitle}>GUILDE DE CHASSEURS</Text>{guild ? <><Text style={styles.modalText}>Guilde active : {guild.name} [{guild.tag}]</Text><Text style={styles.modalText}>Membres : {Object.keys(guild.members || {}).length} • Rating : {guild.stats?.rating || 1000}</Text><Text style={styles.modalText}>Territoires : {guild.stats?.territory || 0}</Text></> : <><Text style={styles.modalText}>Aucune guilde active. Ton compte peut créer le QG.</Text><TouchableOpacity style={styles.primaryButton} onPress={createMyGuild}><Text style={styles.primaryText}>CRÉER WINERLAND ELITE [WNR]</Text></TouchableOpacity></>}</>}
          {panel === 'missions' && <><Text style={styles.sectionTitle}>CONTRATS</Text>{MISSIONS.map((m) => <PanelButton key={m.id} title={m.title} sub={`${m.type.toUpperCase()} • objectif ${m.target} • récompense ${m.rewardXp} XP`} onPress={() => startMission(m)} />)}</>}
          {panel === 'robots' && <><Text style={styles.sectionTitle}>CIBLES IA</Text>{ROBOT_ARCHETYPES.map((r) => <PanelButton key={r.id} title={r.name} sub={`HP ${r.hp} • vitesse ${r.speed} • récompense ${r.reward} CR`} onPress={() => { const id = Date.now(); setRobots((list) => [...list, { ...r, id, archetype: r.id, position: [(Math.random() * 16) - 8, 0.8, (Math.random() * 16) - 8], destroyed: false }]); setPanel(null); setNotice(`${r.name} DÉPLOYÉ`); }} />)}</>}
        </ScrollView><TouchableOpacity style={styles.closeButton} onPress={() => setPanel(null)}><Text style={styles.closeText}>FERMER</Text></TouchableOpacity></View></View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#05070d' },
  hud: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'space-between', padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  brandMark: { width: 42, height: 42, borderRadius: 12, borderWidth: 1, borderColor: '#00e5c0', backgroundColor: '#06181b', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  brandMarkText: { color: '#00e5c0', fontSize: 25, fontWeight: '900' },
  title: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: 3 },
  subtitle: { color: '#00e5c0', fontSize: 9, fontWeight: '800', letterSpacing: 1.4, marginTop: 2 },
  connection: { color: '#7ea3aa', fontSize: 9, marginTop: 8, fontWeight: '700' },
  topActions: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  map: { backgroundColor: 'rgba(4,12,17,.88)', borderWidth: 1, borderColor: '#1d4f55', padding: 6, borderRadius: 10 },
  mapTitle: { color: '#6b969e', fontSize: 7, fontWeight: '800', marginBottom: 4 },
  mapField: { width: 118, height: 118, backgroundColor: '#081a21', borderWidth: 1, borderColor: '#163b42', overflow: 'hidden' },
  mapGrid: { position: 'absolute', backgroundColor: '#164049' },
  playerDot: { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: '#00e5c0' },
  enemyDot: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: '#ff7a2f' },
  robotDot: { position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: '#7c5cff' },
  statCard: { minWidth: 72, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: 'rgba(4,12,17,.88)', borderWidth: 1, borderColor: '#1d4f55' },
  statLabel: { color: '#6b969e', fontSize: 8, fontWeight: '800' },
  statValue: { color: '#fff', fontSize: 18, fontWeight: '900', marginTop: 2 },
  timer: { color: '#00e5c0', fontSize: 18, fontWeight: '900', marginTop: 2 },
  eventBar: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, paddingHorizontal: 14, borderRadius: 20, backgroundColor: 'rgba(5,15,21,.9)', borderWidth: 1, borderColor: '#1d4f55' },
  eventLabel: { color: '#ff7a2f', fontSize: 8, fontWeight: '900' },
  eventValue: { color: '#c8e6e7', fontSize: 9, fontWeight: '800' },
  notice: { color: '#00e5c0', fontSize: 8, fontWeight: '800' },
  modeRail: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modeButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 9, backgroundColor: 'rgba(7,18,25,.88)', borderWidth: 1, borderColor: '#183a42' },
  modeButtonActive: { borderColor: '#00e5c0', backgroundColor: 'rgba(0,80,70,.35)' },
  modeIcon: { color: '#00e5c0', fontSize: 15, marginRight: 7 },
  modeLabel: { color: '#fff', fontSize: 9, fontWeight: '900' },
  modeSub: { color: '#6b969e', fontSize: 7, marginTop: 1 },
  menuButton: { marginLeft: 'auto', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 9, backgroundColor: 'rgba(7,18,25,.92)', borderWidth: 1, borderColor: '#7c5cff' },
  menuIcon: { color: '#fff', textAlign: 'center', fontSize: 15 },
  menuText: { color: '#fff', fontSize: 7, fontWeight: '900', marginTop: 2 },
  bottomBar: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  leftControls: { alignItems: 'center' },
  dpad: { alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  move: { width: 40, height: 34, margin: 2, borderRadius: 8, backgroundColor: 'rgba(5,17,23,.9)', borderWidth: 1, borderColor: '#1e4b53', justifyContent: 'center', alignItems: 'center' },
  arrow: { color: '#d7ffff', fontSize: 13, fontWeight: '900' },
  utilityRow: { flexDirection: 'row', gap: 7, marginTop: 6 },
  utilityButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: 'rgba(5,17,23,.9)', borderWidth: 1, borderColor: '#1e4b53' },
  utilityActive: { borderColor: '#00e5c0' },
  utilityText: { color: '#9bc7cb', fontSize: 8, fontWeight: '900' },
  centerInfo: { width: 220, alignItems: 'center', marginBottom: 5 },
  hpText: { color: '#fff', fontSize: 10, fontWeight: '900', alignSelf: 'stretch' },
  hpTrack: { height: 7, alignSelf: 'stretch', backgroundColor: '#182a30', borderRadius: 5, overflow: 'hidden', marginVertical: 4 },
  hpFill: { height: '100%', backgroundColor: '#00e5c0' },
  levelText: { color: '#82a8ae', fontSize: 8, fontWeight: '800' },
  rightControls: { alignItems: 'flex-end' },
  weaponRow: { flexDirection: 'row', gap: 5, marginBottom: 6 },
  weaponButton: { minWidth: 55, paddingVertical: 6, paddingHorizontal: 7, alignItems: 'center', borderRadius: 8, backgroundColor: 'rgba(5,17,23,.9)', borderWidth: 1, borderColor: '#1e4b53' },
  weaponActive: { borderColor: '#00e5c0' },
  weaponIcon: { color: '#00e5c0', fontSize: 12 },
  weaponText: { color: '#a8cdd0', fontSize: 7, fontWeight: '900', marginTop: 2 },
  fireButton: { width: 86, height: 86, borderRadius: 43, backgroundColor: '#d93456', borderWidth: 2, borderColor: '#ff98ab', justifyContent: 'center', alignItems: 'center', shadowColor: '#ff3355', shadowOpacity: 0.7, shadowRadius: 10 },
  fireText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  ammo: { color: '#ffd8df', fontSize: 9, fontWeight: '900', marginTop: 3 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.78)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modal: { width: '86%', maxWidth: 620, maxHeight: '86%', borderRadius: 16, padding: 18, backgroundColor: '#07131b', borderWidth: 1, borderColor: '#00e5c0' },
  modalTitle: { color: '#00e5c0', fontSize: 19, fontWeight: '900', letterSpacing: 1.5 },
  modalSub: { color: '#688d94', fontSize: 8, fontWeight: '800', marginTop: 3, marginBottom: 12 },
  scroll: { maxHeight: 420 },
  scrollContent: { paddingBottom: 6 },
  sectionTitle: { color: '#ff7a2f', fontSize: 10, fontWeight: '900', marginBottom: 8 },
  panelButton: { padding: 12, marginBottom: 7, borderRadius: 10, backgroundColor: '#0b2028', borderWidth: 1, borderColor: '#19424a' },
  panelButtonActive: { borderColor: '#00e5c0', backgroundColor: '#0d3434' },
  panelButtonTitle: { color: '#fff', fontSize: 11, fontWeight: '900' },
  panelButtonSub: { color: '#79a4aa', fontSize: 8, marginTop: 4, fontWeight: '700' },
  modalText: { color: '#c6dcdf', fontSize: 11, lineHeight: 18, marginBottom: 8 },
  primaryButton: { padding: 13, borderRadius: 9, backgroundColor: '#00e5c0', alignItems: 'center', marginTop: 8 },
  primaryText: { color: '#031013', fontSize: 10, fontWeight: '900' },
  closeButton: { marginTop: 10, alignSelf: 'flex-end', paddingVertical: 9, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: '#ff7a2f' },
  closeText: { color: '#ff7a2f', fontSize: 9, fontWeight: '900' },
});
