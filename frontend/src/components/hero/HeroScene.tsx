"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import * as THREE from "three";
import { useReducedMotion } from "motion/react";

/// A sparse particle field standing for the thing Reins actually verifies:
/// a distributed set of independent nodes, not a single company's
/// database. Deliberately sparse — the GuardKnot is the focal object,
/// this is atmosphere.
function NodeField() {
  const points = useRef<THREE.Points>(null);
  const reduceMotion = useReducedMotion();

  const { positions, count } = useMemo(() => {
    const count = 500;
    const positions = new Float32Array(count * 3);
    const radius = 4.2;
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      positions[i * 3] = Math.cos(theta) * r * radius;
      positions[i * 3 + 1] = y * radius;
      positions[i * 3 + 2] = Math.sin(theta) * r * radius;
    }
    return { positions, count };
  }, []);

  useFrame((_, delta) => {
    if (reduceMotion || !points.current) return;
    points.current.rotation.y += delta * 0.03;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} count={count} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.02} color="#4fe1c8" transparent opacity={0.4} sizeAttenuation depthWrite={false} />
    </points>
  );
}

/// The focal 3D object: a polished chrome knot standing for the guard
/// mechanism (a single key signature gating every payment, looping back
/// on itself the same way a revocation check always closes the loop).
/// Fixed to the right side in viewport-relative (not world-space) terms —
/// a bottom-anchored world position was tried first but reads completely
/// differently across aspect ratios (muddy, overlapping, half off-screen
/// on wide viewports) since perspective framing shifts with width. Right
/// side at a fixed screen-space offset stays legible everywhere and never
/// competes with the left-aligned headline. The knot only idle-rotates —
/// it does not translate on scroll, matching the static HUD pills next to
/// it. Real environment reflections (drei's Environment) drive the
/// metallic read; directional lights alone look like matte plastic.
function GuardKnot() {
  const mesh = useRef<THREE.Mesh>(null);
  const reduceMotion = useReducedMotion();

  useFrame(({ viewport }, delta) => {
    if (!mesh.current) return;
    if (!reduceMotion) {
      mesh.current.rotation.x += delta * 0.07;
      mesh.current.rotation.y += delta * 0.11;
    }

    // viewport.width/height are in Three.js world units at z=0 for the
    // current camera — using them keeps the knot pinned to the same
    // relative screen position (right of center, slightly below middle)
    // regardless of aspect ratio, instead of a hand-tuned world offset.
    // Below the lg breakpoint the headline reverts to a centered, full-width
    // column (see Hero.tsx), so there is no safe right-side slot for the
    // knot — shrink it away instead of letting it collide with text.
    const wide = window.innerWidth >= 1024;
    const targetScale = wide ? 0.55 : 0;
    mesh.current.scale.setScalar(THREE.MathUtils.lerp(mesh.current.scale.x, targetScale, 0.1));

    const x = viewport.width * 0.5 - 1.3;
    const y = -viewport.height * 0.04;
    mesh.current.position.set(x, y, 0);
  });

  return (
    <mesh ref={mesh} scale={0}>
      <torusKnotGeometry args={[1, 0.3, 220, 32, 2, 3]} />
      <meshStandardMaterial color="#c3cbce" metalness={1} roughness={0.1} envMapIntensity={1.8} />
    </mesh>
  );
}

export function HeroScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 6.2], fov: 42 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true }}
      className="!absolute inset-0"
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[4, 4, 5]} intensity={1.4} color="#e9f1f3" />
      <directionalLight position={[-3, 2, 4]} intensity={0.6} color="#ffffff" />
      <pointLight position={[2, -1, 3]} intensity={0.7} color="#4fe1c8" />
      <Environment preset="city" environmentIntensity={1} />
      <NodeField />
      <GuardKnot />
    </Canvas>
  );
}
