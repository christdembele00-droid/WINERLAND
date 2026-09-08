import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const NEON_CYAN = '#00e5c0';
const NEON_ORANGE = '#ff6b35';
const METAL = '#202a33';

function NeonStrip({ position, rotation = [0, 0, 0], scale = [1, 1, 1], color = NEON_CYAN }) {
  return (
    <mesh position={position} rotation={rotation} scale={scale}>
      <boxGeometry args={[0.08, 0.08, 2]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  );
}

function Building({ position, width, height, depth, accent, seed = 1 }) {
  const windows = useMemo(() => {
    const rows = Math.max(2, Math.floor(height / 1.8));
    const cols = Math.max(2, Math.floor(width / 1.3));
    const list = [];
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        if ((x * 7 + y * 11 + seed) % 5 !== 0) list.push([x, y]);
      }
    }
    return list;
  }, [width, height, seed]);

  return (
    <group position={position}>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color="#111b25" metalness={0.72} roughness={0.3} />
      </mesh>
      <mesh position={[0, height + 0.12, 0]}>
        <boxGeometry args={[width + 0.15, 0.12, depth + 0.15]} />
        <meshBasicMaterial color={accent} toneMapped={false} />
      </mesh>
      {windows.map(([x, y]) => (
        <mesh key={`${x}-${y}`} position={[-width / 2 + 0.5 + x * 1.3, 1 + y * 1.8, depth / 2 + 0.012]}>
          <boxGeometry args={[0.62, 0.72, 0.03]} />
          <meshStandardMaterial color="#8be8ff" emissive="#174c63" emissiveIntensity={1.4} roughness={0.25} />
        </mesh>
      ))}
      <NeonStrip position={[width / 2 + 0.04, height * 0.55, 0]} rotation={[0, Math.PI / 2, 0]} scale={[1, 1, height * 0.22]} color={accent} />
    </group>
  );
}

function StreetLight({ position, color = NEON_CYAN }) {
  const glow = useRef();
  useFrame(({ clock }) => {
    if (glow.current) glow.current.intensity = 1.8 + Math.sin(clock.elapsedTime * 3 + position[0]) * 0.25;
  });
  return (
    <group position={position}>
      <mesh position={[0, 2.4, 0]} castShadow>
        <cylinderGeometry args={[0.055, 0.08, 4.8, 8]} />
        <meshStandardMaterial color="#36434d" metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[0.45, 4.65, 0]} rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[0.7, 0.08, 0.12]} />
        <meshStandardMaterial color="#46535c" metalness={0.8} />
      </mesh>
      <pointLight ref={glow} position={[0.75, 4.55, 0]} color={color} distance={8} intensity={2} />
      <mesh position={[0.75, 4.55, 0]}>
        <sphereGeometry args={[0.11, 10, 10]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Road({ position, rotation = [0, 0, 0], size = [12, 70] }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh receiveShadow position={[0, -0.02, 0]}>
        <planeGeometry args={size} />
        <meshStandardMaterial color="#11161b" metalness={0.25} roughness={0.78} />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[0.12, size[1] * 0.9]} />
        <meshBasicMaterial color="#d7e5e6" toneMapped={false} />
      </mesh>
      {[-size[1] / 2 + 4, -size[1] / 2 + 12, -size[1] / 2 + 20, -size[1] / 2 + 28, -size[1] / 2 + 36, -size[1] / 2 + 44, -size[1] / 2 + 52, size[1] / 2 - 4].map((z) => (
        <mesh key={z} position={[0, 0.012, z]}>
          <planeGeometry args={[0.16, 2.6]} />
          <meshBasicMaterial color="#d9b84b" toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function HunterModel({ position, enemy = false }) {
  const root = useRef();
  const weapon = useRef();
  useFrame(({ clock }, delta) => {
    if (!root.current) return;
    root.current.position.y = position[1] + Math.sin(clock.elapsedTime * 4 + position[0]) * 0.025;
    root.current.rotation.y = THREE.MathUtils.lerp(root.current.rotation.y, enemy ? 0.35 : 0, Math.min(1, delta * 4));
    if (weapon.current) weapon.current.rotation.z = Math.sin(clock.elapsedTime * 6) * 0.015;
  });
  const primary = enemy ? '#d84a3a' : '#00cdb5';
  const secondary = enemy ? '#45161b' : '#102a35';
  return (
    <group ref={root} position={position}>
      <mesh position={[0, 1.05, 0]} castShadow>
        <capsuleGeometry args={[0.34, 0.95, 8, 16]} />
        <meshStandardMaterial color={secondary} metalness={0.78} roughness={0.24} />
      </mesh>
      <mesh position={[0, 1.86, 0]} castShadow>
        <sphereGeometry args={[0.31, 18, 14]} />
        <meshStandardMaterial color="#a86f55" metalness={0.1} roughness={0.65} />
      </mesh>
      <mesh position={[0, 1.9, 0.22]}>
        <boxGeometry args={[0.48, 0.1, 0.06]} />
        <meshBasicMaterial color={primary} toneMapped={false} />
      </mesh>
      <mesh position={[-0.48, 1.1, 0]} rotation={[0, 0, -0.12]} castShadow>
        <capsuleGeometry args={[0.1, 0.65, 6, 10]} />
        <meshStandardMaterial color={secondary} metalness={0.85} roughness={0.2} />
      </mesh>
      <mesh position={[0.48, 1.1, 0]} rotation={[0, 0, 0.12]} castShadow>
        <capsuleGeometry args={[0.1, 0.65, 6, 10]} />
        <meshStandardMaterial color={secondary} metalness={0.85} roughness={0.2} />
      </mesh>
      <mesh position={[-0.18, 0.25, 0]} castShadow><capsuleGeometry args={[0.13, 0.7, 6, 10]} /><meshStandardMaterial color={secondary} metalness={0.82} roughness={0.24} /></mesh>
      <mesh position={[0.18, 0.25, 0]} castShadow><capsuleGeometry args={[0.13, 0.7, 6, 10]} /><meshStandardMaterial color={secondary} metalness={0.82} roughness={0.24} /></mesh>
      <group ref={weapon} position={[0.62, 1.05, -0.02]} rotation={[0, 0, -0.12]}>
        <mesh castShadow><boxGeometry args={[0.16, 0.18, 1.25]} /><meshStandardMaterial color="#090d12" metalness={0.95} roughness={0.16} /></mesh>
        <mesh position={[0, 0, -0.7]}><cylinderGeometry args={[0.075, 0.075, 0.45, 10]} rotation={[Math.PI / 2, 0, 0]} /><meshBasicMaterial color={primary} toneMapped={false} /></mesh>
      </group>
      <mesh position={[0, 0.08, 0]}>
        <torusGeometry args={[0.5, 0.025, 8, 28]} />
        <meshBasicMaterial color={primary} toneMapped={false} />
      </mesh>
    </group>
  );
}

function RobotModel({ robot }) {
  const root = useRef();
  const t = useRef(Math.random() * 10);
  useFrame(({ clock }, delta) => {
    if (!root.current) return;
    const bob = Math.sin(clock.elapsedTime * 2.5 + t.current) * 0.05;
    root.current.position.y = robot.position[1] + bob;
    root.current.rotation.y += delta * (robot.archetype === 'drone' ? 1.6 : 0.45);
  });
  const boss = robot.archetype === 'boss';
  const drone = robot.archetype === 'drone';
  const accent = boss ? '#ff3d81' : drone ? '#4ea1ff' : '#a76cff';
  const scale = boss ? 1.5 : drone ? 0.75 : robot.archetype === 'guardian' ? 1.15 : 0.95;
  return (
    <group ref={root} position={robot.position} scale={scale}>
      {drone ? (
        <>
          <mesh castShadow><sphereGeometry args={[0.48, 18, 12]} /><meshStandardMaterial color="#192733" metalness={0.92} roughness={0.18} /></mesh>
          {[0, 1, 2, 3].map((i) => <mesh key={i} position={[Math.cos(i * Math.PI / 2) * 0.62, 0, Math.sin(i * Math.PI / 2) * 0.62]} rotation={[0, i * Math.PI / 2, 0]}><boxGeometry args={[0.1, 0.08, 0.7]} /><meshStandardMaterial color="#394955" metalness={0.8} /></mesh>)}
        </>
      ) : (
        <>
          <mesh position={[0, 0.9, 0]} castShadow><capsuleGeometry args={[0.38, 0.7, 8, 12]} /><meshStandardMaterial color="#222d39" metalness={0.95} roughness={0.17} /></mesh>
          <mesh position={[0, 1.5, 0]} castShadow><icosahedronGeometry args={[0.36, 1]} /><meshStandardMaterial color="#303d49" metalness={0.92} roughness={0.2} /></mesh>
          <mesh position={[0, 1.52, 0.31]}><sphereGeometry args={[0.11, 12, 8]} /><meshBasicMaterial color={accent} toneMapped={false} /></mesh>
          <mesh position={[-0.5, 0.78, 0]} rotation={[0, 0, -0.15]} castShadow><capsuleGeometry args={[0.11, 0.65, 6, 10]} /><meshStandardMaterial color="#151d24" metalness={0.95} /></mesh>
          <mesh position={[0.5, 0.78, 0]} rotation={[0, 0, 0.15]} castShadow><capsuleGeometry args={[0.11, 0.65, 6, 10]} /><meshStandardMaterial color="#151d24" metalness={0.95} /></mesh>
          <mesh position={[-0.2, 0.12, 0]} castShadow><capsuleGeometry args={[0.13, 0.55, 6, 10]} /><meshStandardMaterial color="#151d24" metalness={0.95} /></mesh>
          <mesh position={[0.2, 0.12, 0]} castShadow><capsuleGeometry args={[0.13, 0.55, 6, 10]} /><meshStandardMaterial color="#151d24" metalness={0.95} /></mesh>
          <mesh position={[0, 0.02, 0]}><torusGeometry args={[0.5, 0.035, 8, 28]} /><meshBasicMaterial color={accent} toneMapped={false} /></mesh>
        </>
      )}
      {boss && <pointLight position={[0, 1.3, 0]} color={accent} distance={5} intensity={2.5} />}
    </group>
  );
}

function WorldParticles() {
  const ref = useRef();
  const positions = useMemo(() => {
    const a = new Float32Array(180 * 3);
    for (let i = 0; i < 180; i += 1) {
      a[i * 3] = (Math.random() - 0.5) * 90;
      a[i * 3 + 1] = Math.random() * 22 + 2;
      a[i * 3 + 2] = (Math.random() - 0.5) * 90;
    }
    return a;
  }, []);
  useFrame((_, delta) => { if (ref.current) ref.current.rotation.y += delta * 0.008; });
  return (
    <points ref={ref}>
      <bufferGeometry><bufferAttribute attach="attributes-position" count={180} array={positions} itemSize={3} /></bufferGeometry>
      <pointsMaterial size={0.045} color="#79e7ff" transparent opacity={0.65} depthWrite={false} />
    </points>
  );
}

export default function ModernWorld({ position, remotePlayers = [], robots = [] }) {
  const buildings = useMemo(() => [
    [-23, 0, -22, 8, 15, 8, '#00e5c0', 1], [0, 0, -24, 10, 20, 8, '#ff6b35', 2], [22, 0, -20, 9, 13, 9, '#5d7cff', 3],
    [-24, 0, 4, 7, 11, 8, '#ff3d81', 4], [24, 0, 5, 8, 17, 8, '#00e5c0', 5],
    [-22, 0, 25, 9, 18, 9, '#5d7cff', 6], [1, 0, 24, 11, 14, 8, '#ff6b35', 7], [23, 0, 25, 8, 21, 9, '#a76cff', 8],
  ], []);
  return (
    <>
      <color attach="background" args={['#050912']} />
      <fog attach="fog" args={['#050912', 28, 82]} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[12, 24, 8]} intensity={1.55} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-camera-far={70} />
      <hemisphereLight args={['#17324d', '#05070a', 0.65]} />
      <Road position={[0, 0, 0]} size={[13, 70]} />
      <Road position={[0, 0, 0]} rotation={[0, Math.PI / 2, 0]} size={[13, 70]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.06, 0]}>
        <planeGeometry args={[90, 90]} />
        <meshStandardMaterial color="#0b1117" metalness={0.32} roughness={0.86} />
      </mesh>
      {buildings.map((b, i) => <Building key={i} position={[b[0], b[1], b[2]]} width={b[3]} height={b[4]} depth={b[5]} accent={b[6]} seed={b[7]} />)}
      {[-18, -6, 6, 18].flatMap((x) => [-17, -5, 7, 19].map((z) => [x, 0, z])).map((p, i) => <StreetLight key={i} position={p} color={i % 3 === 0 ? NEON_ORANGE : NEON_CYAN} />)}
      {[-11, 11].map((x) => <NeonStrip key={x} position={[x, 0.08, 0]} rotation={[0, Math.PI / 2, 0]} scale={[1, 1, 25]} color={x < 0 ? NEON_CYAN : NEON_ORANGE} />)}
      <WorldParticles />
      {robots.filter((r) => !r.destroyed).map((r) => <RobotModel key={r.id} robot={r} />)}
      <HunterModel position={position} />
      {remotePlayers.map((p) => <HunterModel key={p.id} position={p.position} enemy />)}
    </>
  );
}
