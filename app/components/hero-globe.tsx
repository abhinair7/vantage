"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import { useMemo, useRef, useEffect, useState, type MutableRefObject } from "react";
import * as THREE from "three";
import { TextureLoader } from "three";

/**
 * Hero 3D Earth.
 *
 * A single ref (scrollProgressRef) is mutated by a passive scroll listener
 * and read every frame inside the Canvas — no React state churn.
 *
 * On mount the camera starts pulled way back (the "looking through a
 * telescope" phase) and eases forward toward the planet over ~2.4s while
 * the DOM telescope overlay fades its vignette out. The two layers are
 * choreographed through a shared `introStart` timestamp baked into window.
 */

type ProgressRef = MutableRefObject<number>;

type EarthTextures = {
  colorMap: THREE.Texture;
  normalMap: THREE.Texture;
  specularMap: THREE.Texture;
  cloudsMap: THREE.Texture;
};

type PointerRef = MutableRefObject<{ x: number; y: number }>;

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
        colorMap.anisotropy = 8;
        normalMap.anisotropy = 8;
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
  progress,
  pointer,
  textures,
}: {
  progress: ProgressRef;
  pointer: PointerRef;
  textures: EarthTextures;
}) {
  const earthRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const mountAt = useRef<number | null>(null);
  const { colorMap, normalMap, specularMap, cloudsMap } = textures;
  const specularColor = useMemo(() => new THREE.Color(0x1f3450), []);
  const normalScale = useMemo(() => new THREE.Vector2(0.55, 0.55), []);
  const emissiveColor = useMemo(() => new THREE.Color(0x0a2b6d), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (mountAt.current == null) mountAt.current = t;
    const elapsed = t - mountAt.current;

    // Slow, even rotation — clock-derived so a backgrounded tab cannot
    // accumulate delta jitter into the angle.
    if (earthRef.current) {
      earthRef.current.rotation.y = elapsed * 0.055;
    }
    if (cloudsRef.current) {
      cloudsRef.current.rotation.y = elapsed * 0.072;
    }
    if (groupRef.current) {
      groupRef.current.position.y = pointer.current.y * 0.06;
      groupRef.current.rotation.x = -pointer.current.y * 0.08;
      groupRef.current.rotation.z = pointer.current.x * 0.05;
    }

    // Cinematic dolly: start far away (z=14) and ease in to z=5.4. This is
    // the "camera walking up to the eyepiece" moment. Scroll can pull the
    // camera an extra 1.8 units closer once the intro has finished.
    const introT = Math.min(1, elapsed / 2.4);
    const introEase = 1 - Math.pow(1 - introT, 3);
    const dollyFrom = 14;
    const dollyTo = 4.8;
    const z = dollyFrom + (dollyTo - dollyFrom) * introEase - progress.current * 1.8;
    state.camera.position.z = z;
    state.camera.position.x = THREE.MathUtils.lerp(
      state.camera.position.x,
      pointer.current.x * 0.4,
      0.05,
    );
    state.camera.position.y = THREE.MathUtils.lerp(
      state.camera.position.y,
      pointer.current.y * 0.24,
      0.05,
    );
    state.camera.lookAt(0, 0, 0);
  });

  return (
    <group ref={groupRef}>
      <mesh ref={earthRef}>
        <sphereGeometry args={[1, 128, 128]} />
        <meshPhongMaterial
          map={colorMap}
          normalMap={normalMap}
          specularMap={specularMap}
          specular={specularColor}
          shininess={14}
          normalScale={normalScale}
          emissive={emissiveColor}
          emissiveIntensity={0.24}
        />
      </mesh>

      <mesh ref={cloudsRef} scale={1.008}>
        <sphereGeometry args={[1, 96, 96]} />
        <meshPhongMaterial
          map={cloudsMap}
          transparent
          opacity={0.28}
          depthWrite={false}
        />
      </mesh>

      <mesh scale={1.08}>
        <sphereGeometry args={[1, 96, 96]} />
        <meshBasicMaterial
          color="#63b0ff"
          transparent
          opacity={0.17}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

    </group>
  );
}

export function HeroGlobe() {
  const progress = useRef(0);
  const pointer = useRef({ x: 0, y: 0 });
  const [reducedMotion, setReducedMotion] = useState(false);
  const textures = useEarthTextures();

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onScroll = () => {
      const max = window.innerHeight * 0.9;
      progress.current = Math.min(1, Math.max(0, window.scrollY / max));
    };
    const onPointerMove = (event: PointerEvent) => {
      pointer.current = {
        x: (event.clientX / window.innerWidth - 0.5) * 2,
        y: (event.clientY / window.innerHeight - 0.5) * -2,
      };
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointerMove);
    };
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
          "radial-gradient(ellipse at 50% 36%, #11244d 0%, #071225 42%, #02040b 100%)",
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 14], fov: 38 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ background: "transparent" }}
        frameloop={reducedMotion ? "demand" : "always"}
      >
        <ambientLight intensity={0.84} />
        <hemisphereLight
          intensity={0.9}
          color="#e7f3ff"
          groundColor="#0a1734"
        />
        <directionalLight position={[5, 2, 4]} intensity={2.05} color="#ffffff" />
        <directionalLight position={[-3, 1, 3]} intensity={0.95} color="#d6edff" />
        <directionalLight position={[-4, -1, -3]} intensity={0.34} color="#4a72d8" />
        <pointLight position={[2.4, 1.2, 2.8]} intensity={1.2} color="#b7deff" />

        <Stars
          radius={110}
          depth={60}
          count={2800}
          factor={2.8}
          saturation={0}
          fade
          speed={reducedMotion ? 0 : 0.25}
        />

        {textures && <Earth progress={progress} pointer={pointer} textures={textures} />}
      </Canvas>
    </div>
  );
}
