"use client";

import { Canvas, useFrame, extend } from "@react-three/fiber";
import { Stars, shaderMaterial } from "@react-three/drei";
import { useMemo, useRef, useEffect, useState, type MutableRefObject } from "react";
import * as THREE from "three";
import { TextureLoader } from "three";

/**
 * Hero 3D Earth — orbital point-of-view.
 *
 * The planet is intentionally off-axis so the landing page feels like a
 * real orbital observation scene rather than a centered product pedestal.
 */

type ProgressRef = MutableRefObject<number>;

type EarthTextures = {
  colorMap: THREE.Texture;
  normalMap: THREE.Texture;
  specularMap: THREE.Texture;
  cloudsMap: THREE.Texture;
};

type DebrisPiece = {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
  shape: "rock" | "panel";
  color: string;
};

const DEBRIS_PIECES: DebrisPiece[] = [
  { position: [-4.8, 2.8, 0.8], rotation: [0.2, 1.1, 0.4], scale: 1.1, shape: "rock", color: "#848f9c" },
  { position: [-3.6, 1.6, 2.2], rotation: [0.8, 0.2, 0.6], scale: 0.68, shape: "panel", color: "#9eabb7" },
  { position: [-5.3, -0.9, 1.6], rotation: [0.3, 0.9, 0.1], scale: 0.94, shape: "rock", color: "#6f7c88" },
  { position: [-2.9, -2.2, 2.8], rotation: [0.5, 0.5, 1.2], scale: 0.74, shape: "panel", color: "#7f8c99" },
  { position: [4.4, 2.7, 1.2], rotation: [0.6, 0.3, 0.5], scale: 0.86, shape: "rock", color: "#8f9ba8" },
  { position: [5.2, 0.8, 2.9], rotation: [0.2, 1.2, 0.7], scale: 0.62, shape: "panel", color: "#a6b4bf" },
  { position: [3.8, -1.8, 2.2], rotation: [0.4, 0.8, 0.2], scale: 0.92, shape: "rock", color: "#73808d" },
  { position: [1.2, 3.2, -1.4], rotation: [0.7, 0.6, 0.4], scale: 0.54, shape: "panel", color: "#8e9daa" },
  { position: [-0.8, 2.4, 3.7], rotation: [0.1, 0.8, 1.1], scale: 0.58, shape: "rock", color: "#91a0ad" },
  { position: [2.4, -3.1, 1.5], rotation: [1.1, 0.2, 0.4], scale: 0.7, shape: "panel", color: "#8d99a3" },
];

/* ---------- Fresnel atmosphere shader ---------- */
const AtmosphereMaterial = shaderMaterial(
  {
    glowColor: new THREE.Color(0x4da6ff),
    viewVector: new THREE.Vector3(0, 0, 5),
    intensity: 1.2,
    power: 3.5,
  },
  /* vertex */
  `
    uniform vec3 viewVector;
    varying float vIntensity;
    void main() {
      vec3 vNormal = normalize(normalMatrix * normal);
      vec3 vNormel = normalize(normalMatrix * viewVector);
      vIntensity = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 3.5);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  /* fragment */
  `
    uniform vec3 glowColor;
    uniform float intensity;
    varying float vIntensity;
    void main() {
      vec3 glow = glowColor * intensity;
      gl_FragColor = vec4(glow, vIntensity * 0.65);
    }
  `
);

extend({ AtmosphereMaterial });

declare module "@react-three/fiber" {
  interface ThreeElements {
    atmosphereMaterial: React.JSX.IntrinsicElements["shaderMaterial"] & {
      glowColor?: THREE.Color;
      viewVector?: THREE.Vector3;
      intensity?: number;
      power?: number;
    };
  }
}

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
  textures,
}: {
  progress: ProgressRef;
  textures: EarthTextures;
}) {
  const earthRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);
  const atmosRef = useRef<THREE.Mesh>(null);
  const mountAt = useRef<number | null>(null);
  const { colorMap, normalMap, specularMap, cloudsMap } = textures;
  const specularColor = useMemo(() => new THREE.Color(0x526a84), []);
  const normalScale = useMemo(() => new THREE.Vector2(0.82, 0.82), []);
  const emissiveColor = useMemo(() => new THREE.Color(0x040f1b), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (mountAt.current == null) mountAt.current = t;
    const elapsed = t - mountAt.current;

    if (earthRef.current) {
      earthRef.current.rotation.y = elapsed * 0.045;
    }
    if (cloudsRef.current) {
      cloudsRef.current.rotation.y = elapsed * 0.062;
    }

    if (atmosRef.current) {
      const mat = atmosRef.current.material as THREE.ShaderMaterial & {
        uniforms: { viewVector: { value: THREE.Vector3 } };
      };
      if (mat.uniforms?.viewVector) {
        mat.uniforms.viewVector.value.copy(state.camera.position);
      }
    }

    const introT = Math.min(1, elapsed / 3.0);
    const introEase = 1 - Math.pow(1 - introT, 4);
    const dollyFrom = 19.2;
    const dollyTo = 6.4;
    const z = dollyFrom + (dollyTo - dollyFrom) * introEase - progress.current * 1.1;
    state.camera.position.z = z;
    state.camera.position.x = -0.36;
    state.camera.position.y = 0.04;
    state.camera.lookAt(0.72, 0.06, 0);
  });

  return (
    <group position={[0.96, -0.04, -0.3]} rotation={[-0.18, -0.32, 0.1]}>
      <mesh ref={earthRef}>
        <sphereGeometry args={[1, 128, 128]} />
        <meshPhongMaterial
          map={colorMap}
          normalMap={normalMap}
          specularMap={specularMap}
          specular={specularColor}
          shininess={18}
          normalScale={normalScale}
          emissive={emissiveColor}
          emissiveIntensity={0.14}
        />
      </mesh>

      <mesh ref={cloudsRef} scale={1.006}>
        <sphereGeometry args={[1, 96, 96]} />
        <meshPhongMaterial
          map={cloudsMap}
          transparent
          opacity={0.22}
          depthWrite={false}
        />
      </mesh>

      <mesh ref={atmosRef} scale={1.035}>
        <sphereGeometry args={[1, 64, 64]} />
        <atmosphereMaterial
          transparent
          side={THREE.FrontSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          glowColor={new THREE.Color(0x8aa0b8)}
          intensity={0.92}
        />
      </mesh>
    </group>
  );
}

function OrbitalDebris({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    const elapsed = state.clock.elapsedTime;
    if (!groupRef.current) return;

    groupRef.current.rotation.y = elapsed * 0.016;
    groupRef.current.rotation.z = Math.sin(elapsed * 0.07) * 0.02;

    groupRef.current.children.forEach((child, index) => {
      const base = DEBRIS_PIECES[index];
      child.rotation.x += delta * (0.1 + index * 0.01);
      child.rotation.y += delta * (0.08 + index * 0.008);

      if (!reducedMotion && base) {
        child.position.x = base.position[0] + Math.cos(elapsed * 0.22 + index) * 0.06;
        child.position.y = base.position[1] + Math.sin(elapsed * 0.34 + index * 0.7) * 0.05;
      }
    });
  });

  return (
    <group ref={groupRef}>
      {DEBRIS_PIECES.map((piece, index) => (
        <mesh
          key={`${piece.shape}-${index}`}
          position={piece.position}
          rotation={piece.rotation}
          scale={piece.scale}
        >
          {piece.shape === "panel" ? (
            <boxGeometry args={[0.24, 0.05, 0.44]} />
          ) : (
            <icosahedronGeometry args={[0.13, 0]} />
          )}
          <meshStandardMaterial
            color={piece.color}
            roughness={piece.shape === "panel" ? 0.56 : 0.92}
            metalness={piece.shape === "panel" ? 0.34 : 0.12}
            emissive={piece.shape === "panel" ? piece.color : "#000000"}
            emissiveIntensity={piece.shape === "panel" ? 0.03 : 0}
          />
        </mesh>
      ))}
    </group>
  );
}

export function HeroGlobe() {
  const progress = useRef(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const textures = useEarthTextures();

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onScroll = () => {
      const max = window.innerHeight * 0.9;
      progress.current = Math.min(1, Math.max(0, window.scrollY / max));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
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
          "radial-gradient(circle at 72% 30%, rgba(188, 209, 230, 0.16) 0%, rgba(109, 137, 168, 0.14) 12%, rgba(8, 13, 20, 0) 38%), radial-gradient(circle at 20% 18%, rgba(83, 104, 132, 0.14) 0%, rgba(10, 16, 24, 0) 26%), radial-gradient(ellipse at 50% 32%, #0d1621 0%, #05080d 54%, #010203 100%)",
      }}
    >
      <Canvas
        camera={{ position: [-0.36, 0.04, 19.2], fov: 30 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ background: "transparent" }}
        frameloop={reducedMotion ? "demand" : "always"}
      >
        <ambientLight intensity={0.2} />
        <hemisphereLight
          intensity={0.34}
          color="#dee6ee"
          groundColor="#02060c"
        />
        <directionalLight position={[10, 5, 7]} intensity={2.9} color="#f6f7f8" />
        <directionalLight position={[-6, 2, 4]} intensity={0.42} color="#74879d" />
        <directionalLight position={[-4, -3, -5]} intensity={0.18} color="#11233a" />
        <pointLight position={[4, 3, 6]} intensity={0.9} color="#dbe4ed" />
        <pointLight position={[-3, -1, 4]} intensity={0.22} color="#59779b" />

        <Stars
          radius={120}
          depth={70}
          count={5200}
          factor={2.4}
          saturation={0}
          fade
          speed={reducedMotion ? 0 : 0.05}
        />

        <OrbitalDebris reducedMotion={reducedMotion} />
        {textures && <Earth progress={progress} textures={textures} />}
      </Canvas>
    </div>
  );
}
