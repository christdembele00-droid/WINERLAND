import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Canvas, useFrame } from '@react-three/fiber/native';
import * as THREE from 'three';

function Player({ position }) {
  const group = useRef();
  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.3;
  });
  return (
    <group ref={group} position={position}>
      <mesh position={[0, 1, 0]} castShadow>
        <boxGeometry args={[0.8, 1.8, 0.8]} />
        <meshStandardMaterial color="#00d9b5" />
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

  const move = (dx, dz) => {
    setPosition(([x, y, z]) => [
      Math.max(-13, Math.min(13, x + dx)),
      y,
      Math.max(-13, Math.min(13, z + dz)),
    ]);
  };

  const shoot = () => setScore((value) => value + 10);

  useEffect(() => {
    const timer = setInterval(() => {
      setHp((value) => (value <= 0 ? 100 : value));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <View style={styles.container}>
      <Canvas shadows camera={{ position: [0, 7, 15], fov: 55 }}>
        <color attach="background" args={["#071018"]} />
        <ambientLight intensity={1.2} />
        <directionalLight position={[8, 14, 8]} intensity={2} castShadow />
        <Arena />
        <Player position={position} />
        <CameraFollow position={position} />
      </Canvas>

      <View style={styles.hud} pointerEvents="box-none">
        <View style={styles.topBar}>
          <Text style={styles.title}>WINERLAND</Text>
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
