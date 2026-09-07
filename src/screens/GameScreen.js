import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Canvas, useFrame } from '@react-three/fiber/native';
import * as THREE from 'three';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { onDisconnect, onValue, ref, remove, set, update } from 'firebase/database';
import { auth, realtimeDb } from '../firebase';

const ROOM_ID = 'quickmatch';
const MATCH_SECONDS = 8 * 60;
const MODES = [
  { id: 'arena', label: 'ARENA', sub: 'Combat classique', icon: '⚔' },
  { id: 'rush', label: 'RUSH', sub: 'Vitesse maximale', icon: '⚡' },
  { id: 'survival', label: 'SURVIE', sub: 'Dernier debout', icon: '◆' },
];
const WEAPONS = [
  { id: 'pulse', label: 'PULSE', damage: 10, ammo: 30, icon: '◈' },
  { id: 'nova', label: 'NOVA', damage: 18, ammo: 18, icon: '✦' },
  { id: 'storm', label: 'STORM', damage: 7, ammo: 45, icon: '⚡' },
];

function Player({ position, remote = false, shield = false }) {
  const group = useRef();
  useFrame((state, delta) => {
    if (!group.current) return;
    group.current.rotation.y += remote ? delta * 0.35 : delta * 0.08;
    if (shield) group.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 6) * 0.025);
  });
  return (
    <group ref={group} position={position}>
      <mesh position={[0, 1, 0]} castShadow>
        <boxGeometry args={[0.9, 1.8, 0.75]} />
        <meshStandardMaterial color={remote ? '#ff8a2a' : '#00e5c0'} metalness={0.35} roughness={0.42} />
      </mesh>
      <mesh position={[0, 2.15, 0]} castShadow>
        <sphereGeometry args={[0.42, 20, 20]} />
        <meshStandardMaterial color="#d9a47f" metalness={0.05} roughness={0.65} />
      </mesh>
      <mesh position={[0.64, 1.05, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.12, 0.12, 1.25, 14]} />
        <meshStandardMaterial color="#17212a" metalness={0.8} roughness={0.2} />
      </mesh>
      {shield && (
        <mesh position={[0, 1.15, 0]}>
          <sphereGeometry args={[1.25, 24, 16]} />
          <meshStandardMaterial color="#00e5c0" transparent opacity={0.12} wireframe />
        </mesh>
      )}
    </group>
  );
}

function Arena() {
  const pillars = [
    [6, 1, 6], [-6, 1, -6], [6, 1, -6], [-6, 1, 6],
  ];
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[34, 34]} />
        <meshStandardMaterial color="#0b1821" metalness={0.18} roughness={0.72} />
      </mesh>
      <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[10, 10.08, 64]} />
        <meshBasicMaterial color="#00e5c0" transparent opacity={0.7} />
      </mesh>
      {pillars.map((p, i) => (
        <group key={i} position={p}>
          <mesh castShadow>
            <cylinderGeometry args={[0.65, 0.85, 2.4, 8]} />
            <meshStandardMaterial color={i % 2 ? '#263f91' : '#71344c'} metalness={0.5} roughness={0.3} />
          </mesh>
          <mesh position={[0, 1.35, 0]}>
            <torusGeometry args={[0.82, 0.07, 8, 32]} />
            <meshBasicMaterial color="#00e5c0" />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 1, -4]} castShadow>
        <boxGeometry args={[6, 2, 0.8]} />
        <meshStandardMaterial color="#21313b" metalness={0.55} roughness={0.35} />
      </mesh>
      <mesh position={[0, 1, 4]} castShadow>
        <boxGeometry args={[6, 2, 0.8]} />
        <meshStandardMaterial color="#21313b" metalness={0.55} roughness={0.35} />
      </mesh>
      <mesh position={[-4, 1, 0]} castShadow>
        <boxGeometry args={[0.8, 2, 5]} />
        <meshStandardMaterial color="#182b35" metalness={0.55} roughness={0.35} />
      </mesh>
      <mesh position={[4, 1, 0]} castShadow>
        <boxGeometry args={[0.8, 2, 5]} />
        <meshStandardMaterial color="#182b35" metalness={0.55} roughness={0.35} />
      </mesh>
    </group>
  );
}

function CameraFollow({ position }) {
  useFrame(({ camera }, delta) => {
    const target = new THREE.Vector3(position[0], 0.9, position[2]);
    const desired = new THREE.Vector3(position[0], 7.5, position[2] + 10.5);
    camera.position.lerp(desired, Math.min(1, delta * 5));
    camera.lookAt(target);
  });
  return null;
}

function MiniMap({ position, remotePlayers }) {
  const size = 116;
  const scale = 3.1;
  return (
    <View style={styles.map}>
      <Text style={styles.mapTitle}>TACTICAL MAP</Text>
      <View style={styles.mapField}>
        <View style={[styles.mapGrid, { left: 0, right: 0, top: '50%', height: 1 }]} />
        <View style={[styles.mapGrid, { top: 0, bottom: 0, left: '50%', width: 1 }]} />
        {remotePlayers.map((p) => (
          <View
            key={p.id}
            style={[styles.enemyDot, {
              left: size / 2 + p.position[0] * scale - 4,
              top: size / 2 + p.position[2] * scale - 4,
            }]}
          />
        ))}
        <View style={[styles.playerDot, {
          left: size / 2 + position[0] * scale - 5,
          top: size / 2 + position[2] * scale - 5,
        }]} />
      </View>
    </View>
  );
}

export default function GameScreen() {
  const [position, setPosition] = useState([0, 0, 6]);
  const [score, setScore] = useState(0);
  const [hp, setHp] = useState(100);
  const [remotePlayers, setRemotePlayers] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('Connexion...');
  const [uid, setUid] = useState(null);
  const [mode, setMode] = useState('arena');
  const [weapon, setWeapon] = useState('pulse');
  const [ammo, setAmmo] = useState(30);
  const [shield, setShield] = useState(false);
  const [panel, setPanel] = useState(null);
  const [matchTime, setMatchTime] = useState(MATCH_SECONDS);

  const currentWeapon = WEAPONS.find((item) => item.id === weapon) || WEAPONS[0];
  const currentMode = MODES.find((item) => item.id === mode) || MODES[0];

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
        await set(playerRef, {
          x: 0, y: 0, z: 6, rotation: 0, health: 100, score: 0,
          mode, weapon, joinedAt: Date.now(),
        });
        setConnectionStatus('EN LIGNE');
        unsubscribeRoom = onValue(playersRef, (snapshot) => {
          const data = snapshot.val() || {};
          const others = Object.entries(data)
            .filter(([id]) => id !== user.uid)
            .map(([id, player]) => ({
              id,
              position: [player.x || 0, player.y || 0, player.z || 0],
            }));
          setRemotePlayers(others);
        }, () => setConnectionStatus('RÉSEAU INSTABLE'));
      } catch {
        setConnectionStatus('ERREUR FIREBASE');
      }
    };

    unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) startRealtime(user);
      else signInAnonymously(auth).catch(() => setConnectionStatus('CONNEXION IMPOSSIBLE'));
    });

    return () => {
      mounted = false;
      unsubscribeAuth?.();
      unsubscribeRoom?.();
      if (auth.currentUser) {
        remove(ref(realtimeDb, `rooms/${ROOM_ID}/players/${auth.currentUser.uid}`)).catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    if (!uid) return;
    update(ref(realtimeDb, `rooms/${ROOM_ID}/players/${uid}`), {
      x: position[0], y: position[1], z: position[2], health: hp, score,
      mode, weapon, shield, updatedAt: Date.now(),
    }).catch(() => setConnectionStatus('RÉSEAU INSTABLE'));
  }, [position, hp, score, uid, mode, weapon, shield]);

  useEffect(() => {
    const timer = setInterval(() => {
      setMatchTime((value) => (value > 0 ? value - 1 : MATCH_SECONDS));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const move = (dx, dz) => {
    const boost = mode === 'rush' ? 1.35 : 1;
    setPosition(([x, y, z]) => [
      Math.max(-15, Math.min(15, x + dx * boost)),
      y,
      Math.max(-15, Math.min(15, z + dz * boost)),
    ]);
  };

  const shoot = () => {
    if (ammo <= 0) {
      setAmmo(currentWeapon.ammo);
      return;
    }
    setAmmo((value) => value - 1);
    setScore((value) => value + currentWeapon.damage);
  };

  const dash = () => {
    setPosition(([x, y, z]) => [Math.max(-15, Math.min(15, x)), y, Math.max(-15, Math.min(15, z - 2.8))]);
    setScore((value) => value + 5);
  };

  const toggleShield = () => setShield((value) => !value);
  const selectWeapon = (id) => {
    setWeapon(id);
    const selected = WEAPONS.find((item) => item.id === id);
    setAmmo(selected?.ammo || 30);
    setPanel(null);
  };
  const selectMode = (id) => {
    setMode(id);
    setPanel(null);
  };

  const formatTime = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <View style={styles.container}>
      <Canvas shadows camera={{ position: [0, 7.5, 16], fov: 55 }}>
        <color attach="background" args={["#040b11"]} />
        <fog attach="fog" args={["#040b11", 18, 42]} />
        <ambientLight intensity={0.72} />
        <hemisphereLight intensity={0.65} color="#d8ffff" groundColor="#09131b" />
        <directionalLight position={[8, 15, 8]} intensity={2.2} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
        <pointLight position={[0, 3, 0]} intensity={7} distance={15} color="#00e5c0" />
        <Arena />
        <Player position={position} shield={shield} />
        {remotePlayers.map((player) => <Player key={player.id} position={player.position} remote />)}
        <CameraFollow position={position} />
      </Canvas>

      <View style={styles.hud} pointerEvents="box-none">
        <View style={styles.header}>
          <View>
            <View style={styles.brandRow}>
              <View style={styles.brandMark}><Text style={styles.brandMarkText}>W</Text></View>
              <View>
                <Text style={styles.title}>WINERLAND</Text>
                <Text style={styles.subtitle}>NEXT-GEN ARENA • {currentMode.label}</Text>
              </View>
            </View>
            <Text style={styles.connection}>● {connectionStatus}  •  {remotePlayers.length + 1} JOUEUR(S)</Text>
          </View>

          <View style={styles.topActions}>
            <MiniMap position={position} remotePlayers={remotePlayers} />
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>MATCH</Text>
              <Text style={styles.timer}>{formatTime(matchTime)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>SCORE</Text>
              <Text style={styles.statValue}>{score}</Text>
            </View>
          </View>
        </View>

        <View style={styles.modeRail}>
          {MODES.map((item) => (
            <TouchableOpacity key={item.id} style={[styles.modeButton, mode === item.id && styles.modeButtonActive]} onPress={() => selectMode(item.id)} activeOpacity={0.8}>
              <Text style={styles.modeIcon}>{item.icon}</Text>
              <View><Text style={styles.modeLabel}>{item.label}</Text><Text style={styles.modeSub}>{item.sub}</Text></View>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.menuButton} onPress={() => setPanel(panel ? null : 'menu')}><Text style={styles.menuIcon}>☰</Text><Text style={styles.menuText}>MENU</Text></TouchableOpacity>
        </View>

        <View style={styles.bottomBar}>
          <View style={styles.leftControls}>
            <View style={styles.dpad}>
              <TouchableOpacity style={styles.move} onPress={() => move(0, -0.75)}><Text style={styles.arrow}>▲</Text></TouchableOpacity>
              <View style={styles.row}>
                <TouchableOpacity style={styles.move} onPress={() => move(-0.75, 0)}><Text style={styles.arrow}>◀</Text></TouchableOpacity>
                <TouchableOpacity style={styles.move} onPress={() => move(0, 0.75)}><Text style={styles.arrow}>▼</Text></TouchableOpacity>
                <TouchableOpacity style={styles.move} onPress={() => move(0.75, 0)}><Text style={styles.arrow}>▶</Text></TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity style={styles.utilityButton} onPress={dash}>
              <Text style={styles.utilityIcon}>⚡</Text><Text style={styles.utilityLabel}>DASH</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.utilityButton, shield && styles.utilityActive]} onPress={toggleShield}>
              <Text style={styles.utilityIcon}>◇</Text><Text style={styles.utilityLabel}>SHIELD</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.weaponHud}>
            <TouchableOpacity style={styles.weaponSelector} onPress={() => setPanel('weapons')}>
              <Text style={styles.weaponIcon}>{currentWeapon.icon}</Text>
              <View><Text style={styles.weaponName}>{currentWeapon.label}</Text><Text style={styles.weaponMeta}>DMG {currentWeapon.damage}</Text></View>
            </TouchableOpacity>
            <View style={styles.ammoBox}><Text style={styles.ammo}>{ammo}</Text><Text style={styles.ammoMax}>/{currentWeapon.ammo}</Text></View>
            <TouchableOpacity style={styles.fireButton} onPress={shoot} activeOpacity={0.72}>
              <View style={styles.fireInner}><Text style={styles.fireText}>FIRE</Text><Text style={styles.fireHint}>TAP</Text></View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.healthPanel}>
          <Text style={styles.hpText}>HP {hp}</Text>
          <View style={styles.hpTrack}><View style={[styles.hpFill, { width: `${Math.max(0, hp)}%` }]} /></View>
          <Text style={styles.level}>LV. 01</Text>
        </View>
      </View>

      {panel && (
        <View style={styles.overlay}>
          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <View><Text style={styles.panelEyebrow}>WINERLAND 2026</Text><Text style={styles.panelTitle}>{panel === 'weapons' ? 'ARSENAL' : 'CENTRE DE COMMANDE'}</Text></View>
              <TouchableOpacity style={styles.close} onPress={() => setPanel(null)}><Text style={styles.closeText}>×</Text></TouchableOpacity>
            </View>

            {panel === 'weapons' ? (
              <View style={styles.cardsRow}>
                {WEAPONS.map((item) => (
                  <TouchableOpacity key={item.id} style={[styles.weaponCard, weapon === item.id && styles.weaponCardActive]} onPress={() => selectWeapon(item.id)}>
                    <Text style={styles.cardIcon}>{item.icon}</Text>
                    <Text style={styles.cardTitle}>{item.label}</Text>
                    <Text style={styles.cardMeta}>DÉGÂTS {item.damage} • MUNITIONS {item.ammo}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.menuGrid}>
                <TouchableOpacity style={styles.menuTile} onPress={() => setPanel('weapons')}><Text style={styles.tileIcon}>◈</Text><Text style={styles.tileTitle}>ARSENAL</Text><Text style={styles.tileSub}>Choisir ton équipement</Text></TouchableOpacity>
                <TouchableOpacity style={styles.menuTile} onPress={() => setPanel('modes')}><Text style={styles.tileIcon}>◎</Text><Text style={styles.tileTitle}>MODES</Text><Text style={styles.tileSub}>Changer le type de match</Text></TouchableOpacity>
                <View style={styles.menuTile}><Text style={styles.tileIcon}>★</Text><Text style={styles.tileTitle}>MISSIONS</Text><Text style={styles.tileSub}>3 missions quotidiennes</Text></View>
                <View style={styles.menuTile}><Text style={styles.tileIcon}>◫</Text><Text style={styles.tileTitle}>SAISON 01</Text><Text style={styles.tileSub}>Progression et récompenses</Text></View>
              </View>
            )}

            {panel === 'modes' && (
              <View style={styles.cardsRow}>
                {MODES.map((item) => (
                  <TouchableOpacity key={item.id} style={[styles.weaponCard, mode === item.id && styles.weaponCardActive]} onPress={() => selectMode(item.id)}>
                    <Text style={styles.cardIcon}>{item.icon}</Text><Text style={styles.cardTitle}>{item.label}</Text><Text style={styles.cardMeta}>{item.sub}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#03080c' },
  hud: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between', padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  brandMark: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#00d9b5', alignItems: 'center', justifyContent: 'center', marginRight: 10, shadowOpacity: 0.35, shadowRadius: 12 },
  brandMarkText: { color: '#031018', fontSize: 25, fontWeight: '900' },
  title: { color: '#f6ffff', fontSize: 25, fontWeight: '900', letterSpacing: 4 },
  subtitle: { color: '#6e8b98', fontSize: 9, fontWeight: '800', letterSpacing: 1.5, marginTop: 2 },
  connection: { color: '#72a09e', fontSize: 9, fontWeight: '800', marginTop: 7, letterSpacing: 0.7 },
  topActions: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  statCard: { minWidth: 78, height: 58, borderRadius: 14, backgroundColor: 'rgba(5,16,24,0.88)', borderWidth: 1, borderColor: 'rgba(90,150,160,0.25)', paddingHorizontal: 12, paddingVertical: 7, alignItems: 'flex-end' },
  statLabel: { color: '#5e7b86', fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  statValue: { color: '#f7ffff', fontSize: 19, fontWeight: '900', marginTop: 3 },
  timer: { color: '#00e5c0', fontSize: 18, fontWeight: '900', marginTop: 3 },
  map: { width: 132, padding: 7, borderRadius: 14, backgroundColor: 'rgba(5,16,24,0.9)', borderWidth: 1, borderColor: 'rgba(0,229,192,0.28)' },
  mapTitle: { color: '#5e7b86', fontSize: 7, fontWeight: '900', letterSpacing: 1, marginBottom: 4 },
  mapField: { width: 116, height: 78, backgroundColor: 'rgba(10,31,39,0.95)', borderRadius: 9, overflow: 'hidden', position: 'relative', borderWidth: 1, borderColor: 'rgba(100,180,180,0.15)' },
  mapGrid: { position: 'absolute', backgroundColor: 'rgba(120,200,200,0.1)' },
  playerDot: { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: '#00e5c0', borderWidth: 2, borderColor: '#d9ffff' },
  enemyDot: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: '#ff7b46' },
  modeRail: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modeButton: { flex: 1, minHeight: 54, maxWidth: 190, borderRadius: 15, backgroundColor: 'rgba(5,16,24,0.78)', borderWidth: 1, borderColor: 'rgba(90,150,160,0.22)', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  modeButtonActive: { borderColor: '#00d9b5', backgroundColor: 'rgba(0,80,75,0.38)' },
  modeIcon: { color: '#00e5c0', fontSize: 19, marginRight: 9 },
  modeLabel: { color: '#f3ffff', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  modeSub: { color: '#66808a', fontSize: 8, marginTop: 2, fontWeight: '700' },
  menuButton: { width: 76, height: 54, borderRadius: 15, backgroundColor: 'rgba(5,16,24,0.9)', borderWidth: 1, borderColor: 'rgba(90,150,160,0.22)', alignItems: 'center', justifyContent: 'center' },
  menuIcon: { color: '#d7ffff', fontSize: 17 },
  menuText: { color: '#6e8b98', fontSize: 7, fontWeight: '900', marginTop: 2, letterSpacing: 1 },
  bottomBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  leftControls: { flexDirection: 'row', alignItems: 'flex-end' },
  dpad: { alignItems: 'center', marginRight: 8 },
  row: { flexDirection: 'row', alignItems: 'center' },
  move: { width: 48, height: 40, margin: 2, borderRadius: 12, backgroundColor: 'rgba(5,18,27,0.86)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0,217,181,0.3)' },
  arrow: { color: '#dffefe', fontSize: 16, fontWeight: '900' },
  utilityButton: { width: 65, height: 65, marginHorizontal: 4, borderRadius: 16, backgroundColor: 'rgba(5,16,24,0.88)', borderWidth: 1, borderColor: 'rgba(90,150,160,0.22)', alignItems: 'center', justifyContent: 'center' },
  utilityActive: { borderColor: '#00e5c0', backgroundColor: 'rgba(0,95,80,0.38)' },
  utilityIcon: { color: '#00e5c0', fontSize: 20 },
  utilityLabel: { color: '#718b94', fontSize: 7, fontWeight: '900', marginTop: 3 },
  weaponHud: { flexDirection: 'row', alignItems: 'center' },
  weaponSelector: { height: 65, minWidth: 125, borderRadius: 16, backgroundColor: 'rgba(5,16,24,0.9)', borderWidth: 1, borderColor: 'rgba(90,150,160,0.24)', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11 },
  weaponIcon: { color: '#00e5c0', fontSize: 23, marginRight: 8 },
  weaponName: { color: '#f5ffff', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  weaponMeta: { color: '#65818a', fontSize: 7, fontWeight: '800', marginTop: 3 },
  ammoBox: { height: 65, minWidth: 66, justifyContent: 'center', alignItems: 'center' },
  ammo: { color: '#f6ffff', fontSize: 24, fontWeight: '900' },
  ammoMax: { color: '#65818a', fontSize: 9, fontWeight: '800' },
  fireButton: { width: 92, height: 92, borderRadius: 46, backgroundColor: '#ff4f4f', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.85)', shadowOpacity: 0.28, shadowRadius: 10 },
  fireInner: { width: 74, height: 74, borderRadius: 37, borderWidth: 1, borderColor: 'rgba(255,255,255,0.38)', justifyContent: 'center', alignItems: 'center' },
  fireText: { color: '#fff', fontSize: 17, fontWeight: '900', letterSpacing: 1 },
  fireHint: { color: 'rgba(255,255,255,0.7)', fontSize: 7, fontWeight: '900', marginTop: 2 },
  healthPanel: { position: 'absolute', left: 16, bottom: 16, flexDirection: 'row', alignItems: 'center' },
  hpText: { color: '#dffffb', fontSize: 10, fontWeight: '900', width: 42 },
  hpTrack: { width: 150, height: 7, borderRadius: 4, backgroundColor: 'rgba(4,16,23,0.9)', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(80,150,150,0.22)' },
  hpFill: { height: '100%', backgroundColor: '#00e5c0', borderRadius: 4 },
  level: { color: '#5f7b84', fontSize: 8, fontWeight: '900', marginLeft: 8 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(1,7,11,0.76)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  panel: { width: '82%', minHeight: 210, borderRadius: 22, backgroundColor: '#07131c', borderWidth: 1, borderColor: 'rgba(0,229,192,0.32)', padding: 20 },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  panelEyebrow: { color: '#00e5c0', fontSize: 8, fontWeight: '900', letterSpacing: 1.5 },
  panelTitle: { color: '#f5ffff', fontSize: 25, fontWeight: '900', marginTop: 3 },
  close: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#10212b', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#d8ffff', fontSize: 26, fontWeight: '300', lineHeight: 29 },
  cardsRow: { flexDirection: 'row', gap: 12 },
  weaponCard: { flex: 1, minHeight: 125, borderRadius: 17, backgroundColor: '#0c1c25', borderWidth: 1, borderColor: 'rgba(100,170,180,0.2)', padding: 15, justifyContent: 'center' },
  weaponCardActive: { borderColor: '#00e5c0', backgroundColor: 'rgba(0,93,80,0.34)' },
  cardIcon: { color: '#00e5c0', fontSize: 28, marginBottom: 10 },
  cardTitle: { color: '#f5ffff', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  cardMeta: { color: '#6a8790', fontSize: 8, fontWeight: '800', marginTop: 6 },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  menuTile: { width: '48%', minHeight: 95, borderRadius: 16, backgroundColor: '#0c1c25', borderWidth: 1, borderColor: 'rgba(100,170,180,0.18)', padding: 13 },
  tileIcon: { color: '#00e5c0', fontSize: 21 },
  tileTitle: { color: '#efffff', fontSize: 11, fontWeight: '900', marginTop: 5 },
  tileSub: { color: '#65818a', fontSize: 8, marginTop: 3 },
});
