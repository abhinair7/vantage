"use client";

import { Canvas, useFrame, extend } from "@react-three/fiber";
import { Stars, shaderMaterial } from "@react-three/drei";
import { useMemo, useRef, useEffect, useState } from "react";
import * as THREE from "three";
import { TextureLoader } from "three";

/**
 * Hero 3D Earth — orbital point-of-view.
 *
 * The planet stays in a stable central composition so the landing page reads
 * like a calm orbital scene rather than a product camera move.
 */

type EarthTextures = {
  colorMap: THREE.Texture;
  normalMap: THREE.Texture;
  specularMap: THREE.Texture;
  cloudsMap: THREE.Texture;
};

type DebrisPiece = {
  radius: number;
  angle: number;
  y: number;
  scale: number;
  speed: number;
  tilt: [number, number, number];
  kind: "panel" | "rock";
  color: string;
};

const ORBITAL_DEBRIS: DebrisPiece[] = [
  { radius: 1.9, angle: 0.3, y: 0.2, scale: 0.12, speed: 0.16, tilt: [0.4, 0.8, 0.2], kind: "panel", color: "#a8b4bf" },
  { radius: 2.15, angle: 1.1, y: -0.18, scale: 0.1, speed: 0.13, tilt: [0.7, 0.3, 1.1], kind: "rock", color: "#8a96a1" },
  { radius: 2.02, angle: 1.95, y: 0.08, scale: 0.14, speed: 0.15, tilt: [0.2, 1.2, 0.4], kind: "panel", color: "#b8c2cb" },
  { radius: 2.28, angle: 2.7, y: -0.24, scale: 0.11, speed: 0.11, tilt: [1.0, 0.6, 0.2], kind: "rock", color: "#7e8b96" },
  { radius: 1.84, angle: 3.35, y: 0.26, scale: 0.09, speed: 0.18, tilt: [0.5, 0.4, 1.0], kind: "panel", color: "#d1d8de" },
  { radius: 2.22, angle: 4.1, y: -0.06, scale: 0.13, speed: 0.12, tilt: [0.4, 1.0, 0.6], kind: "rock", color: "#97a3ad" },
  { radius: 2.06, angle: 4.9, y: 0.14, scale: 0.11, speed: 0.14, tilt: [0.8, 0.2, 0.7], kind: "panel", color: "#b3bec7" },
  { radius: 1.96, angle: 5.55, y: -0.2, scale: 0.1, speed: 0.17, tilt: [0.3, 0.7, 1.2], kind: "rock", color: "#8895a0" },
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
  textures,
}: {
  textures: EarthTextures;
}) {
  const earthRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);
  const atmosRef = useRef<THREE.Mesh>(null);
  const { colorMap, normalMap, specularMap, cloudsMap } = textures;
  const specularColor = useMemo(() => new THREE.Color(0x738aa0), []);
  const normalScale = useMemo(() => new THREE.Vector2(0.8, 0.8), []);
  const emissiveColor = useMemo(() => new THREE.Color(0x050d16), []);

  useFrame((state) => {
    const elapsed = state.clock.elapsedTime;

    if (earthRef.current) {
      earthRef.current.rotation.y = elapsed * 0.034;
    }
    if (cloudsRef.current) {
      cloudsRef.current.rotation.y = elapsed * 0.046;
    }

    if (atmosRef.current) {
      const mat = atmosRef.current.material as THREE.ShaderMaterial & {
        uniforms: { viewVector: { value: THREE.Vector3 } };
      };
      if (mat.uniforms?.viewVector) {
        mat.uniforms.viewVector.value.copy(state.camera.position);
      }
    }
  });

  return (
    <group position={[0, 0, 0]} rotation={[-0.18, -0.3, 0.08]} scale={1.18}>
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
          glowColor={new THREE.Color(0xb8cadf)}
          intensity={1.02}
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

    groupRef.current.children.forEach((child, index) => {
      const piece = ORBITAL_DEBRIS[index];
      const angle = piece.angle + elapsed * (reducedMotion ? 0 : piece.speed);
      child.position.x = Math.cos(angle) * piece.radius;
      child.position.z = Math.sin(angle) * piece.radius;
      child.position.y = piece.y + Math.sin(elapsed * 0.5 + index) * 0.02;
      child.rotation.x += delta * 0.24;
      child.rotation.y += delta * 0.18;
      child.rotation.z += delta * 0.12;
    });
  });

  return (
    <group ref={groupRef} rotation={[-0.28, 0.28, 0.1]}>
      {ORBITAL_DEBRIS.map((piece, index) => (
        <mesh
          key={`${piece.kind}-${index}`}
          position={[
            Math.cos(piece.angle) * piece.radius,
            piece.y,
            Math.sin(piece.angle) * piece.radius,
          ]}
          rotation={piece.tilt}
          scale={piece.scale}
        >
          {piece.kind === "panel" ? (
            <boxGeometry args={[1.1, 0.18, 1.85]} />
          ) : (
            <icosahedronGeometry args={[0.72, 0]} />
          )}
          <meshStandardMaterial
            color={piece.color}
            roughness={piece.kind === "panel" ? 0.48 : 0.92}
            metalness={piece.kind === "panel" ? 0.36 : 0.1}
            emissive={piece.kind === "panel" ? "#6d8297" : "#11161b"}
            emissiveIntensity={piece.kind === "panel" ? 0.08 : 0.02}
          />
        </mesh>
      ))}
    </group>
  );
}

function SpaceParticles({ reducedMotion }: { reducedMotion: boolean }) {
  const pointsRef = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const data = new Float32Array(210 * 3);
    for (let i = 0; i < 210; i += 1) {
      const stride = i * 3;
      data[stride] = (Math.random() - 0.5) * 9.5;
      data[stride + 1] = (Math.random() - 0.5) * 6.5;
      data[stride + 2] = -4 + Math.random() * 8;
    }
    return data;
  }, []);

  useFrame((_, delta) => {
    const points = pointsRef.current;
    if (!points || reducedMotion) return;

    const buffer = points.geometry.attributes.position;
    const array = buffer.array as Float32Array;
    for (let i = 0; i < array.length; i += 3) {
      array[i] += delta * 0.018;
      array[i + 1] += delta * 0.01;
      array[i + 2] += delta * 0.28;

      if (array[i + 2] > 4.5) {
        array[i] = (Math.random() - 0.5) * 9.5;
        array[i + 1] = (Math.random() - 0.5) * 6.5;
        array[i + 2] = -4.5;
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
        size={0.028}
        sizeAttenuation
        transparent
        opacity={0.62}
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
          "radial-gradient(circle at 50% 12%, rgba(131, 215, 236, 0.15) 0%, rgba(131, 215, 236, 0.06) 18%, rgba(5, 8, 12, 0) 42%), radial-gradient(circle at 84% 42%, rgba(211, 223, 235, 0.1) 0%, rgba(211, 223, 235, 0.04) 16%, rgba(5, 7, 11, 0) 40%), radial-gradient(ellipse at 50% 34%, #0d141b 0%, #05070b 58%, #010203 100%)",
      }}
    >
      <Canvas
        camera={{ position: [0, 0.02, 6.7], fov: 31 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ background: "transparent" }}
        frameloop={reducedMotion ? "demand" : "always"}
      >
        <ambientLight intensity={0.18} />
        <hemisphereLight
          intensity={0.3}
          color="#dde7f0"
          groundColor="#02060c"
        />
        <directionalLight position={[9, 4, 6]} intensity={2.5} color="#f7f7f4" />
        <directionalLight position={[-6, 3, 4]} intensity={0.34} color="#90adc4" />
        <directionalLight position={[-5, -3, -4]} intensity={0.16} color="#2a3e56" />
        <pointLight position={[3, 2.5, 5]} intensity={0.82} color="#f0f3f8" />
        <pointLight position={[-4, 0, 4]} intensity={0.24} color="#7ab1d1" />

        <Stars
          radius={120}
          depth={70}
          count={5600}
          factor={2.2}
          saturation={0}
          fade
          speed={reducedMotion ? 0 : 0.08}
        />

        <SpaceParticles reducedMotion={reducedMotion} />
        {textures && (
          <group position={[0, -0.06, -0.2]}>
            <OrbitalDebris reducedMotion={reducedMotion} />
            <Earth textures={textures} />
          </group>
        )}
      </Canvas>
    </div>
  );
}
