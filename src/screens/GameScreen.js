import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Canvas, useFrame } from '@react-three/fiber/native';
import * as THREE from 'three';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { onDisconnect, onValue, ref, remove, set, update } from 'firebase/database';
import { auth, realtimeDb } from '../firebase';

const ROOM_ID = 'quickmatch';

function Player({ position, remote = false }) {
  const group = useRef();
  useFrame((_, delta) => {
    if (group.current && remote) group.current.rotation.y += delta * 0.3;
  });
  return (
    <group ref={group} position={position}>
      <mesh position={[0, 1, 0]} castShadow>
        <boxGeometry args={[0.8, 1.8, 0.8]} />
        <meshStandardMaterial color={remote ? '#ff9f1c' : '#00d9b5'} />
      </mesh>
      <mesh position={[0, 2.15, 0]} castShadow>
        <sphereGeometry args={[0.42, 20, 20]} />
        <meshStandardMaterial color="#f2c29b" />
      </mesh>
      <mesh position={[0.62, 1.05, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <cylinderGeometry args={[0.12, 0.12, 1.1, 12]} />
        <meshStandardMaterial color="#202833" />
      </mesh>
    </group>
  );
}

function Arena() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#18232b" />
      </mesh>
      <mesh position={[5, 1, 5]} castShadow>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial color="#a63d40" />
      </mesh>
      <mesh position={[-5, 1, -5]} castShadow>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial color="#405fc4" />
      </mesh>
      <mesh position={[0, 1, -4]} castShadow>
        <boxGeometry args={[5, 2, 1]} />
        <meshStandardMaterial color="#39515c" />
      </mesh>
    </group>
  );
}

function CameraFollow({ position }) {
  useFrame(({ camera }, delta) => {
    const target = new THREE.Vector3(position[0], 0.8, position[2]);
    const desired = new THREE.Vector3(position[0], 7, position[2] + 9);
    camera.position.lerp(desired, Math.min(1, delta * 5));
    camera.lookAt(target);
  });
  return null;
}

export default function GameScreen() {
  const [position, setPosition] = useState([0, 0, 6]);
  const [score, setScore] = useState(0);
  const [hp, setHp] = useState(100);
  const [remotePlayers, setRemotePlayers] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('Connexion...');
  const [uid, setUid] = useState(null);

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
          x: 0,
          y: 0,
          z: 6,
          rotation: 0,
          health: 100,
          score: 0,
          joinedAt: Date.now(),
        });
        setConnectionStatus('En ligne');

        unsubscribeRoom = onValue(playersRef, (snapshot) => {
          const data = snapshot.val() || {};
          const others = Object.entries(data)
            .filter(([id]) => id !== user.uid)
            .map(([id, player]) => ({
              id,
              position: [player.x || 0, player.y || 0, player.z || 0],
            }));
          setRemotePlayers(others);
        }, () => setConnectionStatus('Erreur réseau'));
      } catch {
        setConnectionStatus('Erreur Firebase');
      }
    };

    unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) startRealtime(user);
      else signInAnonymously(auth).catch(() => setConnectionStatus('Connexion impossible'));
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
      x: position[0],
      y: position[1],
      z: position[2],
      health: hp,
      score,
      updatedAt: Date.now(),
    }).catch(() => setConnectionStatus('Erreur réseau'));
  }, [position, hp, score, uid]);

  const move = (dx, dz) => {
    setPosition(([x, y, z]) => [
      Math.max(-13, Math.min(13, x + dx)),
      y,
      Math.max(-13, Math.min(13, z + dz)),
    ]);
  };

  const shoot = () => setScore((value) => value + 10);

  return (
    <View style={styles.container}>
      <Canvas shadows camera={{ position: [0, 7, 15], fov: 55 }}>
        <color attach="background" args={["#071018"]} />
        <ambientLight intensity={1.2} />
        <directionalLight position={[8, 14, 8]} intensity={2} castShadow />
        <Arena />
        <Player position={position} />
        {remotePlayers.map((player) => (
          <Player key={player.id} position={player.position} remote />
        ))}
        <CameraFollow position={position} />
      </Canvas>

      <View style={styles.hud} pointerEvents="box-none">
        <View style={styles.topBar}>
          <View>
            <Text style={styles.title}>WINERLAND</Text>
            <Text style={styles.connection}>{connectionStatus} • {remotePlayers.length + 1} joueur(s)</Text>
          </View>
          <View style={styles.stats}>
            <Text style={styles.text}>SCORE : {score}</Text>
            <Text style={styles.hp}>HP : {hp}</Text>
          </View>
        </View>

        <View style={styles.bottom}>
          <View style={styles.dpad}>
            <TouchableOpacity style={styles.move} onPress={() => move(0, -0.7)}><Text style={styles.arrow}>▲</Text></TouchableOpacity>
            <View style={styles.row}>
              <TouchableOpacity style={styles.move} onPress={() => move(-0.7, 0)}><Text style={styles.arrow}>◀</Text></TouchableOpacity>
              <TouchableOpacity style={styles.move} onPress={() => move(0, 0.7)}><Text style={styles.arrow}>▼</Text></TouchableOpacity>
              <TouchableOpacity style={styles.move} onPress={() => move(0.7, 0)}><Text style={styles.arrow}>▶</Text></TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity style={styles.fireButton} onPress={shoot} activeOpacity={0.75}>
            <Text style={styles.fireText}>FIRE</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  hud: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between', padding: 18 },
  topBar: { marginTop: 24, flexDirection: 'row', justifyContent: 'space-between' },
  title: { color: '#fff', fontSize: 25, fontWeight: '900', letterSpacing: 3 },
  connection: { color: '#a9bac5', fontSize: 11, marginTop: 3, fontWeight: '700' },
  stats: { alignItems: 'flex-end' },
  text: { color: '#fff', fontSize: 16, fontWeight: '800' },
  hp: { color: '#00ffcc', fontSize: 16, fontWeight: '800' },
  bottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 },
  dpad: { alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  move: { width: 58, height: 48, margin: 3, borderRadius: 14, backgroundColor: 'rgba(12,30,42,.82)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0,217,181,.45)' },
  arrow: { color: '#fff', fontSize: 20, fontWeight: '900' },
  fireButton: { width: 94, height: 94, borderRadius: 47, backgroundColor: '#ef4444', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#fff' },
  fireText: { color: '#fff', fontSize: 19, fontWeight: '900' },
});
