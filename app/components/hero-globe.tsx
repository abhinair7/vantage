"use client";

import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { useRef, useEffect, useState, type MutableRefObject } from "react";
import * as THREE from "three";
import { TextureLoader } from "three";

/**
 * Hero 3D Earth.
 *
 * Sits in a fixed, pointer-events:none layer behind the hero content.
 * A single ref (scrollProgressRef) is mutated by a passive scroll listener
 * and read every frame inside the Canvas — no React state churn, no
 * re-renders, the GPU just stays hot.
 *
 *   scrollProgress ∈ [0, 1]
 *     0  = top of page, camera at z=3.4, earth small and slow
 *     1  = scrolled one viewport, camera at z=1.9, earth fills the view
 *
 * Reduced-motion users get a still frame — no rotation, no dolly.
 */

type ProgressRef = MutableRefObject<number>;

function Earth({ progress }: { progress: ProgressRef }) {
  const earthRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);

  const [colorMap, normalMap, specularMap, cloudsMap] = useLoader(TextureLoader, [
    "/textures/earth-day.jpg",
    "/textures/earth-normal.jpg",
    "/textures/earth-specular.jpg",
    "/textures/earth-clouds.png",
  ]);

  // Upgrade colour fidelity for the day texture
  useEffect(() => {
    colorMap.colorSpace = THREE.SRGBColorSpace;
    cloudsMap.colorSpace = THREE.SRGBColorSpace;
  }, [colorMap, cloudsMap]);

  useFrame((state, delta) => {
    if (earthRef.current) {
      earthRef.current.rotation.y += delta * (0.04 + progress.current * 0.05);
    }
    if (cloudsRef.current) {
      cloudsRef.current.rotation.y += delta * (0.06 + progress.current * 0.07);
      cloudsRef.current.rotation.x += delta * 0.002;
    }
    if (groupRef.current) {
      // Gentle breathing float
      const t = state.clock.elapsedTime;
      groupRef.current.position.y = Math.sin(t * 0.4) * 0.03;
      groupRef.current.rotation.z = Math.sin(t * 0.3) * 0.015;
    }
    // Camera dolly tied to scroll
    state.camera.position.z = 3.4 - progress.current * 1.5;
  });

  return (
    <group ref={groupRef}>
      {/* Main Earth */}
      <mesh ref={earthRef}>
        <sphereGeometry args={[1, 96, 96]} />
        <meshPhongMaterial
          map={colorMap}
          normalMap={normalMap}
          specularMap={specularMap}
          specular={new THREE.Color(0x4488bb)}
          shininess={14}
          normalScale={new THREE.Vector2(0.8, 0.8)}
        />
      </mesh>

      {/* Cloud layer */}
      <mesh ref={cloudsRef} scale={1.006}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshPhongMaterial
          map={cloudsMap}
          transparent
          opacity={0.42}
          depthWrite={false}
        />
      </mesh>

      {/* Atmospheric glow — a slightly larger sphere with additive blending */}
      <mesh scale={1.08}>
        <sphereGeometry args={[1, 64, 64]} />
        <shaderMaterial
          transparent
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
          depthWrite={false}
          uniforms={{
            uColor: { value: new THREE.Color("#6aa9ff") },
          }}
          vertexShader={`
            varying vec3 vNormal;
            void main() {
              vNormal = normalize(normalMatrix * normal);
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            varying vec3 vNormal;
            uniform vec3 uColor;
            void main() {
              float intensity = pow(0.62 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.2);
              gl_FragColor = vec4(uColor, 1.0) * intensity;
            }
          `}
        />
      </mesh>
    </group>
  );
}

export function HeroGlobe() {
  const progress = useRef(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onScroll = () => {
      const max = window.innerHeight * 0.9;
      progress.current = Math.min(1, Math.max(0, window.scrollY / max));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 3.4], fov: 42 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
        frameloop={reducedMotion ? "demand" : "always"}
      >
        <ambientLight intensity={0.18} />
        <directionalLight position={[5, 2, 4]} intensity={1.6} color="#ffffff" />
        <directionalLight position={[-4, -1, -3]} intensity={0.15} color="#3358aa" />

        <Stars
          radius={100}
          depth={60}
          count={4500}
          factor={3.2}
          saturation={0}
          fade
          speed={reducedMotion ? 0 : 0.35}
        />

        <Earth progress={progress} />

        <EffectComposer>
          <Bloom
            intensity={0.35}
            luminanceThreshold={0.7}
            luminanceSmoothing={0.3}
            mipmapBlur
          />
          <Vignette eskil={false} offset={0.22} darkness={0.9} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
