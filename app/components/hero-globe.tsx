"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import { useMemo, useRef, useEffect, useState } from "react";
import * as THREE from "three";
import { TextureLoader } from "three";

/**
 * Hero 3D Earth — orbital point-of-view.
 *
 * The planet sits as a large curved horizon so the landing page feels like a
 * spacecraft looking across Earth rather than a centered product pedestal.
 */

type EarthTextures = {
  colorMap: THREE.Texture;
  normalMap: THREE.Texture;
  specularMap: THREE.Texture;
  cloudsMap: THREE.Texture;
};

function useEarthTextures(): EarthTextures | null {
  const [textures, setTextures] = useState<EarthTextures | null>(null);

  useEffect(() => {
    const loader = new TextureLoader();
    const load = (url: string) =>
      new Promise<THREE.Texture>((resolve, reject) =>
        loader.load(url, resolve, undefined, reject)
      );

    let cancelled = false;
    Promise.all([
      load("/textures/earth-day.jpg"),
      load("/textures/earth-normal.jpg"),
      load("/textures/earth-specular.jpg"),
      load("/textures/earth-clouds.png"),
    ])
      .then(([colorMap, normalMap, specularMap, cloudsMap]) => {
        if (cancelled) return;
        colorMap.colorSpace = THREE.SRGBColorSpace;
        cloudsMap.colorSpace = THREE.SRGBColorSpace;
        setTextures({ colorMap, normalMap, specularMap, cloudsMap });
      })
      .catch((err) => {
        console.error("[HeroGlobe] texture load failed", err);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return textures;
}

function Earth({
  textures,
}: {
  textures: EarthTextures;
}) {
  const earthRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);
  const { colorMap, normalMap, specularMap, cloudsMap } = textures;
  const normalScale = useMemo(() => new THREE.Vector2(0.85, 0.85), []);
  const emissiveColor = useMemo(() => new THREE.Color(0x050b14), []);
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    const max = gl.capabilities.getMaxAnisotropy();
    [colorMap, normalMap, specularMap, cloudsMap].forEach((t) => {
      t.anisotropy = max;
      t.needsUpdate = true;
    });
  }, [gl, colorMap, normalMap, specularMap, cloudsMap]);

  useFrame((state) => {
    const elapsed = state.clock.elapsedTime;
    if (earthRef.current) earthRef.current.rotation.y = elapsed * 0.022;
    if (cloudsRef.current) cloudsRef.current.rotation.y = elapsed * 0.031;
  });

  return (
    <group position={[0, -0.1, 0]} rotation={[0.12, -0.36, -0.16]} scale={1.75}>
      <mesh ref={earthRef}>
        <sphereGeometry args={[1, 256, 256]} />
        <meshStandardMaterial
          map={colorMap}
          normalMap={normalMap}
          normalScale={normalScale}
          roughnessMap={specularMap}
          roughness={0.92}
          metalness={0}
          emissive={emissiveColor}
          emissiveIntensity={0.12}
        />
      </mesh>

      <mesh ref={cloudsRef} scale={1.006}>
        <sphereGeometry args={[1, 128, 128]} />
        <meshStandardMaterial
          map={cloudsMap}
          transparent
          opacity={0.2}
          depthWrite={false}
          roughness={1}
          metalness={0}
        />
      </mesh>
    </group>
  );
}

function SpaceParticles({ reducedMotion }: { reducedMotion: boolean }) {
  const pointsRef = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const data = new Float32Array(140 * 3);
    for (let i = 0; i < 140; i += 1) {
      const stride = i * 3;
      data[stride] = (Math.random() - 0.5) * 10;
      data[stride + 1] = -1.5 + Math.random() * 5.2;
      data[stride + 2] = -5 + Math.random() * 9;
    }
    return data;
  }, []);

  useFrame((_, delta) => {
    const points = pointsRef.current;
    if (!points || reducedMotion) return;

    const buffer = points.geometry.attributes.position;
    const array = buffer.array as Float32Array;
    for (let i = 0; i < array.length; i += 3) {
      array[i] += delta * 0.012;
      array[i + 1] += delta * 0.004;
      array[i + 2] += delta * 0.18;

      if (array[i + 2] > 4.5) {
        array[i] = (Math.random() - 0.5) * 10;
        array[i + 1] = -1.5 + Math.random() * 5.2;
        array[i + 2] = -5;
      }
    }
    buffer.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={positions.length / 3}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#dce7f1"
        size={0.018}
        sizeAttenuation
        transparent
        opacity={0.38}
        depthWrite={false}
      />
    </points>
  );
}

export function HeroGlobe() {
  const [reducedMotion, setReducedMotion] = useState(false);
  const textures = useEarthTextures();

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
  }, []);

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        background:
          "radial-gradient(circle at 76% 18%, rgba(247, 241, 214, 0.22) 0%, rgba(247, 241, 214, 0.08) 14%, rgba(6, 9, 12, 0) 34%), radial-gradient(circle at 16% 18%, rgba(111, 186, 210, 0.12) 0%, rgba(111, 186, 210, 0.04) 20%, rgba(5, 8, 12, 0) 42%), radial-gradient(ellipse at 50% 34%, #0d141b 0%, #05070b 58%, #010203 100%)",
      }}
    >
      <Canvas
        camera={{ position: [0, 0.45, 6.4], fov: 25 }}
        dpr={[1, 2]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
        }}
        style={{ background: "transparent" }}
        frameloop={reducedMotion ? "demand" : "always"}
      >
        <ambientLight intensity={0.06} />
        <hemisphereLight
          intensity={0.18}
          color="#dce7f1"
          groundColor="#020509"
        />
        <directionalLight position={[7, 5, 6]} intensity={2.8} color="#fff7e6" />
        <directionalLight position={[-6, 2, 3]} intensity={0.22} color="#6f94b2" />

        <Stars
          radius={120}
          depth={70}
          count={5000}
          factor={2.1}
          saturation={0}
          fade
          speed={reducedMotion ? 0 : 0.02}
        />

        <SpaceParticles reducedMotion={reducedMotion} />
        {textures && <Earth textures={textures} />}
      </Canvas>
    </div>
  );
}
