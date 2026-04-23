"use client";

import { Canvas, useFrame, extend } from "@react-three/fiber";
import { Stars, shaderMaterial } from "@react-three/drei";
import { useMemo, useRef, useEffect, useState } from "react";
import * as THREE from "three";
import { TextureLoader } from "three";

/**
 * Hero 3D Earth — orbital point-of-view.
 *
 * The planet is intentionally off-axis and held in a fixed composition so the
 * landing page reads like a still orbital poster frame rather than a product
 * camera move.
 */

type EarthTextures = {
  colorMap: THREE.Texture;
  normalMap: THREE.Texture;
  specularMap: THREE.Texture;
  cloudsMap: THREE.Texture;
};

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
    <group position={[1.12, -0.2, -0.28]} rotation={[-0.22, -0.36, 0.12]} scale={1.16}>
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
          "radial-gradient(circle at 54% 14%, rgba(116, 214, 235, 0.16) 0%, rgba(116, 214, 235, 0.06) 18%, rgba(4, 8, 12, 0) 42%), radial-gradient(circle at 16% 74%, rgba(210, 92, 118, 0.18) 0%, rgba(210, 92, 118, 0.08) 20%, rgba(5, 7, 11, 0) 44%), radial-gradient(ellipse at 50% 32%, #0e141c 0%, #05070b 58%, #010203 100%)",
      }}
    >
      <Canvas
        camera={{ position: [-0.28, 0.1, 6.65], fov: 31 }}
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
          speed={0}
        />

        {textures && <Earth textures={textures} />}
      </Canvas>
    </div>
  );
}
