import React, { useEffect, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { onDisconnect, onValue, ref, remove, set, update } from 'firebase/database';
import { auth, realtimeDb } from '../firebase';
import { WORLD_ZONES, getWorldEvent, clampWorldPosition } from '../game/worldSystem';
import { GAME_MODES, ROBOT_ARCHETYPES } from '../game/hunterSystems';
import ModernWorld from '../game/ModernWorld.web';

const ROOM_ID = 'quickmatch';

function Hunter({ position, enemy = false }) {
  const ref3d = React.useRef();
  useFrame((state, delta) => {
    if (!ref3d.current) return;
    ref3d.current.rotation.y += delta * (enemy ? 0.8 : 0.25);
    ref3d.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 2) * 0.04;
  });
  return (
    <group ref={ref3d} position={position}>
      <mesh castShadow position={[0, 1, 0]}>
        <boxGeometry args={[0.8, 1.7, 0.65]} />
        <meshStandardMaterial color={enemy ? '#ff7a2f' : '#00e5c0'} metalness={0.7} roughness={0.22} emissive={enemy ? '#351006' : '#00382f'} />
      </mesh>
      <mesh castShadow position={[0, 2.05, 0]}>
        <sphereGeometry args={[0.34, 20, 20]} />
        <meshStandardMaterial color="#c98f6d" roughness={0.6} />
      </mesh>
      <mesh position={[0.58, 1.05, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <cylinderGeometry args={[0.1, 0.1, 1.15, 12]} />
        <meshStandardMaterial color="#26333d" metalness={0.9} roughness={0.15} />
      </mesh>
    </group>
  );
}

function Robot({ robot }) {
  const ref3d = React.useRef();
  useFrame((state, delta) => {
    if (!ref3d.current) return;
    ref3d.current.rotation.y += delta * 1.2;
    ref3d.current.position.y = robot.position[1] + Math.sin(state.clock.elapsedTime * 2 + robot.id) * 0.08;
  });
  const scale = robot.archetype === 'boss' ? 1.65 : robot.archetype === 'guardian' ? 1.25 : 0.9;
  return (
    <group ref={ref3d} position={robot.position} scale={scale}>
      <mesh castShadow>
        <boxGeometry args={[0.85, 1.45, 0.75]} />
        <meshStandardMaterial color="#7c5cff" metalness={0.9} roughness={0.18} emissive="#160b35" />
      </mesh>
      <mesh position={[0, 0.9, 0]}>
        <sphereGeometry args={[0.26, 16, 16]} />
        <meshStandardMaterial color="#ff7a2f" emissive="#7a2208" emissiveIntensity={1.7} />
      </mesh>
      <mesh position={[0, 0.03, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.55, 0.045, 8, 24]} />
        <meshBasicMaterial color="#00e5c0" />
      </mesh>
    </group>
  );
}

function World({ position, remotePlayers, robots }) {
  return (
    <>
      <color attach="background" args={['#03070b']} />
      <ambientLight intensity={1.15} />
      <directionalLight position={[8, 14, 8]} intensity={2.2} castShadow />
      <pointLight position={[0, 5, 0]} intensity={18} distance={25} color="#00e5c0" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[70, 70]} />
        <meshStandardMaterial color="#07131b" metalness={0.5} roughness={0.45} />
      </mesh>
      <gridHelper args={[70, 35, '#17434a', '#0b2229']} position={[0, 0.03, 0]} />
      {[-7, 7].flatMap((x) => [-7, 7].map((z) => [x, 1.4, z])).map((p, i) => (
        <group key={i} position={p}>
          <mesh castShadow><cylinderGeometry args={[0.72, 0.92, 2.8, 10]} /><meshStandardMaterial color={i % 2 ? '#263f91' : '#4d245f'} metalness={0.75} roughness={0.2} /></mesh>
          <mesh position={[0, 1.5, 0]}><torusGeometry args={[0.9, 0.06, 8, 28]} /><meshBasicMaterial color="#00e5c0" /></mesh>
        </group>
      ))}
      {robots.filter((r) => !r.destroyed).map((robot) => <Robot key={robot.id} robot={robot} />)}
      <Hunter position={position} />
      {remotePlayers.map((player) => <Hunter key={player.id} position={player.position} enemy />)}
    </>
  );
}

function Camera({ position }) {
  useFrame(({ camera }, delta) => {
    const desired = new THREE.Vector3(position[0], 8.5, position[2] + 12);
    camera.position.lerp(desired, Math.min(1, delta * 4));
    camera.lookAt(position[0], 1, position[2]);
  });
  return null;
}

export default function GameScreenWeb() {
  const [position, setPosition] = useState([0, 0, 6]);
  const [score, setScore] = useState(0);
  const [hp, setHp] = useState(100);
  const [ammo, setAmmo] = useState(30);
  const [uid, setUid] = useState(null);
  const [remotePlayers, setRemotePlayers] = useState([]);
  const [status, setStatus] = useState('CONNEXION...');
  const [mode, setMode] = useState('open-world');
  const [zoneId, setZoneId] = useState('central');
  const [event, setEvent] = useState(getWorldEvent());
  const [notice, setNotice] = useState('SYSTÈMES WINERLAND INITIALISÉS');
  const [robots, setRobots] = useState(() => ROBOT_ARCHETYPES.slice(0, 5).map((a, i) => ({ ...a, id: i + 1, archetype: a.id, position: [i * 3 - 6, 0.8, i % 2 ? -3 : 0], destroyed: false })));
  const currentMode = GAME_MODES.find((m) => m.id === mode) || GAME_MODES[0];
  const currentZone = WORLD_ZONES.find((z) => z.id === zoneId) || WORLD_ZONES[0];

  useEffect(() => {
    let stopRoom;
    let mounted = true;
    const start = async (user) => {
      if (!mounted) return;
      setUid(user.uid);
      const mine = ref(realtimeDb, `rooms/${ROOM_ID}/players/${user.uid}`);
      const room = ref(realtimeDb, `rooms/${ROOM_ID}/players`);
      try {
        await onDisconnect(mine).remove();
        await set(mine, { x: 0, y: 0, z: 6, health: 100, score: 0, mode, zoneId, joinedAt: Date.now() });
        setStatus('EN LIGNE');
        stopRoom = onValue(room, (snapshot) => {
          const data = snapshot.val() || {};
          setRemotePlayers(Object.entries(data).filter(([id]) => id !== user.uid).map(([id, p]) => ({ id, position: [p.x || 0, p.y || 0, p.z || 0] })));
        }, () => setStatus('RÉSEAU INSTABLE'));
      } catch (e) { setStatus('FIREBASE INDISPONIBLE'); }
    };
    const stopAuth = onAuthStateChanged(auth, (user) => user ? start(user) : signInAnonymously(auth).catch(() => setStatus('CONNEXION IMPOSSIBLE')));
    return () => { mounted = false; stopAuth(); stopRoom?.(); if (auth.currentUser) remove(ref(realtimeDb, `rooms/${ROOM_ID}/players/${auth.currentUser.uid}`)).catch(() => {}); };
  }, []);

  useEffect(() => {
    if (!uid) return;
    update(ref(realtimeDb, `rooms/${ROOM_ID}/players/${uid}`), { x: position[0], y: position[1], z: position[2], health: hp, score, mode, zoneId, updatedAt: Date.now() }).catch(() => setStatus('RÉSEAU INSTABLE'));
  }, [uid, position, hp, score, mode, zoneId]);

  useEffect(() => { const t = setInterval(() => setEvent(getWorldEvent()), 30000); return () => clearInterval(t); }, []);

  const move = (dx, dz) => setPosition(([x, y, z]) => { const [nx, nz] = clampWorldPosition(x + dx, z + dz, 28); return [nx, y, nz]; });
  const shoot = () => {
    if (ammo <= 0) { setAmmo(30); setNotice('CHARGEUR RECHARGÉ'); return; }
    setAmmo((v) => v - 1);
    const target = robots.find((r) => !r.destroyed);
    if (!target) { setNotice('ZONE NETTOYÉE • NOUVEAUX ROBOTS EN APPROCHE'); return; }
    const hpLeft = target.hp - 10;
    if (hpLeft <= 0) {
      setRobots((list) => list.map((r) => r.id === target.id ? { ...r, hp: 0, destroyed: true } : r));
      setScore((v) => v + (target.reward || 50));
      setNotice(`${target.name || 'ROBOT'} NEUTRALISÉ • +${target.reward || 50} XP`);
    } else setRobots((list) => list.map((r) => r.id === target.id ? { ...r, hp: hpLeft } : r));
  };
  const resetBattle = () => {
    setHp(100); setAmmo(30); setScore(0);
    setRobots((list) => list.map((r, i) => ({ ...r, hp: ROBOT_ARCHETYPES.find((a) => a.id === r.archetype)?.hp || r.hp || 100, destroyed: false, position: [i * 3 - 6, 0.8, i % 2 ? -3 : 0] })));
    setNotice('MISSION RELANCÉE');
  };

  const controls = useMemo(() => ({ onKeyDown: (e) => { if (e.repeat) return; const k = e.key.toLowerCase(); if (k === 'w' || k === 'arrowup') move(0, -1); if (k === 's' || k === 'arrowdown') move(0, 1); if (k === 'a' || k === 'arrowleft') move(-1, 0); if (k === 'd' || k === 'arrowright') move(1, 0); if (k === ' ' || k === 'f') shoot(); if (k === 'r') resetBattle(); } }), [position, ammo, robots]);
  useEffect(() => { window.addEventListener('keydown', controls.onKeyDown); return () => window.removeEventListener('keydown', controls.onKeyDown); }, [controls]);

  return (
    <div style={styles.app}>
      <Canvas shadows dpr={[1, 1.5]} gl={{ antialias: false, powerPreference: 'high-performance' }} camera={{ position: [0, 8.5, 18], fov: 55 }} style={styles.canvas}>
        <Camera position={position} />
        <ModernWorld position={position} remotePlayers={remotePlayers} robots={robots} />
      </Canvas>
      <div style={styles.topbar}>
        <div><div style={styles.logo}>WINERLAND</div><div style={styles.tag}>OPEN WORLD • HUNTER NETWORK</div></div>
        <div style={styles.status}>{status} <span style={styles.dot}>●</span></div>
      </div>
      <div style={styles.hudLeft}>
        <div style={styles.card}><div style={styles.small}>MODE</div><b>{currentMode.name || mode}</b><div style={styles.muted}>{currentZone.name || zoneId}</div></div>
        <div style={styles.card}><div style={styles.small}>HUNTER</div><b>HP {hp}</b><div style={styles.bar}><i style={{ width: `${hp}%` }} /></div><div style={styles.muted}>SCORE {score} • AMMO {ammo}</div></div>
      </div>
      <div style={styles.event}><b>{event?.title || 'WORLD EVENT'}</b><span>{event?.description || 'Événement actif dans la zone.'}</span></div>
      <div style={styles.notice}>{notice}</div>
      <div style={styles.controls}><button onClick={() => move(0, -1)}>▲</button><div><button onClick={() => move(-1, 0)}>◀</button><button onClick={() => move(0, 1)}>▼</button><button onClick={() => move(1, 0)}>▶</button></div><button onClick={shoot}>FIRE</button><button onClick={resetBattle}>RESET</button></div>
      <div style={styles.modes}>{GAME_MODES.slice(0, 4).map((m) => <button key={m.id} onClick={() => { setMode(m.id); setNotice(`MODE ${m.name || m.id} ACTIVÉ`); }}>{m.name || m.id}</button>)}</div>
      <div style={styles.help}>WASD / FLÈCHES : déplacer • ESPACE ou F : tirer • R : relancer</div>
    </div>
  );
}

const styles = {
  app: { position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#03070b', color: '#fff', fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif' },
  canvas: { position: 'absolute', inset: 0 },
  topbar: { position: 'absolute', top: 0, left: 0, right: 0, padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: 'linear-gradient(rgba(2,7,11,.9), transparent)', pointerEvents: 'none' },
  logo: { fontWeight: 950, fontSize: 26, letterSpacing: 5 },
  tag: { color: '#00e5c0', fontSize: 10, letterSpacing: 2, marginTop: 3 },
  status: { fontSize: 10, letterSpacing: 1, padding: '9px 12px', border: '1px solid #24515a', borderRadius: 9, background: 'rgba(5,15,21,.78)' },
  dot: { color: '#00e5c0', marginLeft: 5 },
  hudLeft: { position: 'absolute', top: 92, left: 18, display: 'grid', gap: 10, width: 220 },
  card: { padding: 13, background: 'rgba(5,15,21,.86)', border: '1px solid #24515a', borderRadius: 12, backdropFilter: 'blur(8px)' },
  small: { color: '#00e5c0', fontSize: 9, fontWeight: 900, letterSpacing: 2, marginBottom: 5 },
  muted: { color: '#88a4aa', fontSize: 10, marginTop: 5 },
  bar: { height: 5, background: '#1b2c32', borderRadius: 4, marginTop: 8, overflow: 'hidden' },
  event: { position: 'absolute', top: 92, right: 18, maxWidth: 300, padding: 13, background: 'rgba(5,15,21,.86)', border: '1px solid #7c5cff', borderRadius: 12, display: 'grid', gap: 5, fontSize: 11 },
  notice: { position: 'absolute', left: '50%', bottom: 118, transform: 'translateX(-50%)', padding: '9px 15px', background: 'rgba(5,15,21,.9)', border: '1px solid #00e5c0', borderRadius: 999, color: '#d9ffff', fontSize: 10, letterSpacing: 1, whiteSpace: 'nowrap' },
  controls: { position: 'absolute', left: 18, bottom: 20, display: 'flex', alignItems: 'center', gap: 7 },
  modes: { position: 'absolute', right: 18, bottom: 20, display: 'flex', gap: 7, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 440 },
  help: { position: 'absolute', bottom: 78, left: '50%', transform: 'translateX(-50%)', color: '#88a4aa', fontSize: 10, background: 'rgba(0,0,0,.45)', padding: '6px 10px', borderRadius: 6, whiteSpace: 'nowrap' },
};
