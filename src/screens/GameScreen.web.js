import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { onDisconnect, onValue, ref, remove, set, update } from 'firebase/database';
import { auth, realtimeDb } from '../firebase';
import { WORLD_ZONES, getWorldEvent, clampWorldPosition } from '../game/worldSystem';
import { GAME_MODES, ROBOT_ARCHETYPES } from '../game/hunterSystems';
import { COMBAT_CONFIG, createCombatState, canShoot } from '../game/combatSystem.web';
import ModernWorld from '../game/ModernWorld.web';

const ROOM_ID = 'quickmatch';

function FollowCamera({ position }) {
  const desired = useRef(new THREE.Vector3());
  const target = useRef(new THREE.Vector3());
  useFrame(({ camera }, delta) => {
    desired.current.set(position[0], 7.2, position[2] + 11.5);
    camera.position.lerp(desired.current, Math.min(1, delta * 5));
    target.current.set(position[0], 1.1, position[2]);
    camera.lookAt(target.current);
  });
  return null;
}

function Crosshair() {
  return (
    <div style={styles.crosshair} aria-hidden="true">
      <span style={styles.crossH} />
      <span style={styles.crossV} />
      <span style={styles.crossDot} />
    </div>
  );
}

function MiniMap({ position, robots }) {
  const size = 150;
  const map = (value) => Math.max(8, Math.min(size - 8, ((value + 30) / 60) * size));
  return (
    <div style={styles.mapWrap}>
      <div style={styles.mapTitle}>NEXUS CITY / SECTEUR CENTRAL</div>
      <div style={styles.map}>
        <div style={styles.mapRoadV} />
        <div style={styles.mapRoadH} />
        {robots.filter((r) => !r.destroyed).map((r) => (
          <span key={r.id} style={{ ...styles.mapRobot, left: map(r.position[0]), top: map(r.position[2]) }} />
        ))}
        <span style={{ ...styles.mapPlayer, left: map(position[0]), top: map(position[2]) }} />
      </div>
    </div>
  );
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
  const [notice, setNotice] = useState('NEXUS CITY INITIALISÉE');
  const combatStateRef = useRef(createCombatState());
  const [robots, setRobots] = useState(() => ROBOT_ARCHETYPES.slice(0, 6).map((a, i) => ({
    ...a,
    id: i + 1,
    archetype: a.id,
    position: [((i % 3) - 1) * 6, 0.8, -4 - Math.floor(i / 3) * 7],
    destroyed: false,
  })));

  const currentMode = GAME_MODES.find((m) => m.id === mode) || GAME_MODES[0];
  const currentZone = WORLD_ZONES.find((z) => z.id === zoneId) || WORLD_ZONES[0];
  const positionRef = useRef(position);
  const ammoRef = useRef(ammo);
  const robotsRef = useRef(robots);

  useEffect(() => { positionRef.current = position; }, [position]);
  useEffect(() => { ammoRef.current = ammo; }, [ammo]);
  useEffect(() => { robotsRef.current = robots; }, [robots]);

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
          setRemotePlayers(Object.entries(data)
            .filter(([id]) => id !== user.uid)
            .map(([id, p]) => ({ id, position: [p.x || 0, p.y || 0, p.z || 0] })));
        }, () => setStatus('RÉSEAU INSTABLE'));
      } catch {
        setStatus('FIREBASE INDISPONIBLE');
      }
    };
    const stopAuth = onAuthStateChanged(auth, (user) => {
      if (user) start(user);
      else signInAnonymously(auth).catch(() => setStatus('CONNEXION IMPOSSIBLE'));
    });
    return () => {
      mounted = false;
      stopAuth();
      stopRoom?.();
      if (auth.currentUser) remove(ref(realtimeDb, `rooms/${ROOM_ID}/players/${auth.currentUser.uid}`)).catch(() => {});
    };
  }, []);

  // Network writes are intentionally throttled: gameplay stays local and Firebase receives snapshots at ~10 Hz.
  useEffect(() => {
    if (!uid) return undefined;
    let lastPayload = '';
    const pushState = () => {
      const [x, y, z] = positionRef.current;
      const payload = { x, y, z, health: hp, score, mode, zoneId, updatedAt: Date.now() };
      const key = JSON.stringify(payload);
      if (key === lastPayload) return;
      lastPayload = key;
      update(ref(realtimeDb, `rooms/${ROOM_ID}/players/${uid}`), payload)
        .catch(() => setStatus('RÉSEAU INSTABLE'));
    };
    pushState();
    const timer = setInterval(pushState, 100);
    return () => clearInterval(timer);
  }, [uid, hp, score, mode, zoneId]);

  useEffect(() => {
    const timer = setInterval(() => setEvent(getWorldEvent()), 30000);
    return () => clearInterval(timer);
  }, []);

  const move = useCallback((dx, dz) => {
    setPosition(([x, y, z]) => {
      const [nx, nz] = clampWorldPosition(x + dx, z + dz, 28);
      return [nx, y, nz];
    });
  }, []);

  const shoot = useCallback(() => {
    const currentAmmo = ammoRef.current;
    if (currentAmmo <= 0) {
      setAmmo(30);
      setNotice('CHARGEUR RECHARGÉ');
      return;
    }
    setAmmo(currentAmmo - 1);
    const [px, , pz] = positionRef.current;
    const live = robotsRef.current.filter((r) => !r.destroyed);
    const target = live
      .map((r) => ({ r, d: Math.hypot(r.position[0] - px, r.position[2] - pz) }))
      .filter(({ d }) => d < 13)
      .sort((a, b) => a.d - b.d)[0]?.r;
    if (!target) {
      setNotice('TIR : AUCUNE CIBLE DANS LA PORTÉE');
      return;
    }
    const hpLeft = (target.hp || 100) - 10;
    if (hpLeft <= 0) {
      setRobots((list) => list.map((r) => r.id === target.id ? { ...r, hp: 0, destroyed: true } : r));
      setScore((v) => v + (target.reward || 50));
      setNotice(`${target.name || 'UNITÉ'} NEUTRALISÉE • +${target.reward || 50} XP`);
    } else {
      setRobots((list) => list.map((r) => r.id === target.id ? { ...r, hp: hpLeft } : r));
      setNotice(`IMPACT CONFIRMÉ • ${hpLeft} HP RESTANTS`);
    }
  }, []);

  const resetBattle = useCallback(() => {
    setHp(100);
    setAmmo(30);
    setScore(0);
    setRobots((list) => list.map((r, i) => ({
      ...r,
      hp: ROBOT_ARCHETYPES.find((a) => a.id === r.archetype)?.hp || 100,
      destroyed: false,
      position: [((i % 3) - 1) * 6, 0.8, -4 - Math.floor(i / 3) * 7],
    })));
    setNotice('OPÉRATION RELANCÉE');
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === 'w' || k === 'arrowup') move(0, -1);
      else if (k === 's' || k === 'arrowdown') move(0, 1);
      else if (k === 'a' || k === 'arrowleft') move(-1, 0);
      else if (k === 'd' || k === 'arrowright') move(1, 0);
      else if (k === ' ' || k === 'f') shoot();
      else if (k === 'r') resetBattle();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [move, shoot, resetBattle]);

  return (
    <div style={styles.app}>
      <Canvas
        shadows
        dpr={[1, 1.5]}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
        camera={{ position: [0, 7.2, 17.5], fov: 55 }}
        style={styles.canvas}
      >
        <FollowCamera position={position} />
        <ModernWorld position={position} remotePlayers={remotePlayers} robots={robots} />
      </Canvas>

      <div style={styles.topbar}>
        <div>
          <div style={styles.logo}>WINERLAND</div>
          <div style={styles.tag}>NEXUS CITY // HUNTER NETWORK // 2026</div>
        </div>
        <div style={styles.network}><span style={styles.liveDot}>●</span> {status}</div>
      </div>

      <div style={styles.leftPanel}>
        <div style={styles.card}>
          <div style={styles.kicker}>MISSION ACTIVE</div>
          <div style={styles.mode}>{currentMode.name || mode}</div>
          <div style={styles.sub}>{currentZone.name || zoneId}</div>
        </div>
        <div style={styles.card}>
          <div style={styles.kicker}>HUNTER // LEVEL 01</div>
          <div style={styles.statLine}><strong>HP</strong><strong>{hp}</strong></div>
          <div style={styles.hpTrack}><div style={{ ...styles.hpFill, width: `${Math.max(0, Math.min(100, hp))}%` }} /></div>
          <div style={styles.statGrid}>
            <span>XP <b>{score}</b></span>
            <span>AMMO <b>{ammo}</b></span>
          </div>
        </div>
      </div>

      <MiniMap position={position} robots={robots} />
      <Crosshair />

      <div style={styles.event}>
        <div style={styles.kicker}>WORLD EVENT</div>
        <strong>{event?.title || 'NEXUS EVENT'}</strong>
        <span>{event?.description || 'Événement actif dans la zone.'}</span>
      </div>

      <div style={styles.notice}>{notice}</div>

      <div style={styles.bottomBar}>
        <div style={styles.controlHint}><b>WASD</b> DÉPLACEMENT</div>
        <div style={styles.controlHint}><b>ESPACE / F</b> TIR</div>
        <div style={styles.controlHint}><b>R</b> RESET</div>
        <div style={styles.actions}>
          <button onClick={() => move(0, -1)}>▲</button>
          <button onClick={() => move(-1, 0)}>◀</button>
          <button onClick={() => move(0, 1)}>▼</button>
          <button onClick={() => move(1, 0)}>▶</button>
          <button onClick={shoot} style={styles.fire}>FIRE</button>
          <button onClick={resetBattle}>RESET</button>
        </div>
      </div>

      <div style={styles.modes}>
        {GAME_MODES.slice(0, 4).map((m) => (
          <button
            key={m.id}
            onClick={() => { setMode(m.id); setNotice(`MODE ${m.name || m.id} ACTIVÉ`); }}
            style={m.id === mode ? styles.modeActive : undefined}
          >
            {m.name || m.id}
          </button>
        ))}
      </div>
    </div>
  );
}

const styles = {
  app: { position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#050912', color: '#f4fbff', fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', userSelect: 'none' },
  canvas: { position: 'absolute', inset: 0 },
  topbar: { position: 'absolute', top: 0, left: 0, right: 0, padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: 'linear-gradient(180deg, rgba(3,7,13,.94), rgba(3,7,13,0))', pointerEvents: 'none' },
  logo: { fontSize: 28, lineHeight: 1, fontWeight: 950, letterSpacing: 6 },
  tag: { marginTop: 6, fontSize: 9, letterSpacing: 2.4, color: '#5fe7d1' },
  network: { marginTop: 2, padding: '9px 12px', border: '1px solid rgba(89,205,211,.3)', borderRadius: 8, background: 'rgba(4,12,18,.72)', fontSize: 10, letterSpacing: 1.4 },
  liveDot: { color: '#00e5c0' },
  leftPanel: { position: 'absolute', left: 18, top: 92, width: 230, display: 'grid', gap: 10 },
  card: { padding: 14, border: '1px solid rgba(79,202,210,.26)', borderRadius: 12, background: 'rgba(4,13,20,.84)', boxShadow: '0 10px 30px rgba(0,0,0,.25)', backdropFilter: 'blur(8px)' },
  kicker: { color: '#00e5c0', fontSize: 9, fontWeight: 900, letterSpacing: 2, marginBottom: 7 },
  mode: { fontSize: 17, fontWeight: 850, textTransform: 'uppercase' },
  sub: { color: '#8ba7ae', fontSize: 10, marginTop: 4 },
  statLine: { display: 'flex', justifyContent: 'space-between', fontSize: 13 },
  hpTrack: { height: 6, marginTop: 8, borderRadius: 6, overflow: 'hidden', background: '#1b2b32' },
  hpFill: { height: '100%', background: 'linear-gradient(90deg,#00b89d,#00e5c0)', boxShadow: '0 0 12px rgba(0,229,192,.5)' },
  statGrid: { display: 'flex', justifyContent: 'space-between', marginTop: 9, color: '#8ba7ae', fontSize: 10 },
  mapWrap: { position: 'absolute', right: 18, top: 92, width: 166, padding: 8, borderRadius: 12, border: '1px solid rgba(79,202,210,.26)', background: 'rgba(4,13,20,.84)', backdropFilter: 'blur(8px)' },
  mapTitle: { fontSize: 7, letterSpacing: 1.2, color: '#80a4ad', marginBottom: 7 },
  map: { position: 'relative', width: 150, height: 150, overflow: 'hidden', borderRadius: 8, background: '#081219', border: '1px solid #1c4249' },
  mapRoadV: { position: 'absolute', left: 68, top: 0, bottom: 0, width: 14, background: '#17242b' },
  mapRoadH: { position: 'absolute', top: 68, left: 0, right: 0, height: 14, background: '#17242b' },
  mapPlayer: { position: 'absolute', width: 9, height: 9, borderRadius: '50%', transform: 'translate(-50%,-50%)', background: '#00e5c0', boxShadow: '0 0 10px #00e5c0' },
  mapRobot: { position: 'absolute', width: 6, height: 6, borderRadius: '50%', transform: 'translate(-50%,-50%)', background: '#ff5c55', boxShadow: '0 0 8px #ff5c55' },
  crosshair: { position: 'absolute', left: '50%', top: '50%', width: 34, height: 34, transform: 'translate(-50%,-50%)', pointerEvents: 'none', opacity: .9 },
  crossH: { position: 'absolute', left: 0, right: 0, top: 16, height: 1, background: 'rgba(224,255,255,.8)' },
  crossV: { position: 'absolute', top: 0, bottom: 0, left: 16, width: 1, background: 'rgba(224,255,255,.8)' },
  crossDot: { position: 'absolute', left: 15, top: 15, width: 3, height: 3, borderRadius: '50%', background: '#00e5c0', boxShadow: '0 0 7px #00e5c0' },
  event: { position: 'absolute', right: 200, top: 270, width: 260, padding: 14, borderLeft: '2px solid #ff6b35', background: 'linear-gradient(90deg,rgba(20,11,9,.88),rgba(5,13,18,.72))', display: 'grid', gap: 5 },
  notice: { position: 'absolute', left: '50%', bottom: 100, transform: 'translateX(-50%)', padding: '8px 14px', border: '1px solid rgba(79,202,210,.22)', borderRadius: 999, background: 'rgba(4,12,18,.78)', color: '#c7e6ea', fontSize: 10, letterSpacing: 1, whiteSpace: 'nowrap' },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: 76, padding: '10px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'linear-gradient(0deg,rgba(3,7,13,.96),rgba(3,7,13,.68))', borderTop: '1px solid rgba(79,202,210,.16)' },
  controlHint: { color: '#78939b', fontSize: 9, letterSpacing: 1 },
  actions: { display: 'flex', gap: 6 },
  modes: { position: 'absolute', left: 18, bottom: 92, display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: 430 },
  modeActive: { borderColor: '#00e5c0', color: '#00e5c0', boxShadow: '0 0 12px rgba(0,229,192,.16)' },
  fire: { borderColor: '#ff6b35', color: '#ffb093', minWidth: 64 },
};