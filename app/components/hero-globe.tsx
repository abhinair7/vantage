"use client";

import { Canvas, useFrame, extend } from "@react-three/fiber";
import { Stars, shaderMaterial } from "@react-three/drei";
import { useMemo, useRef, useEffect, useState, type MutableRefObject } from "react";
import * as THREE from "three";
import { TextureLoader } from "three";

/**
 * Hero 3D Earth — cockpit window view.
 *
 * The planet is intentionally off-axis so the landing page feels like a
 * spacecraft point-of-view rather than a centered product pedestal.
 */

type ProgressRef = MutableRefObject<number>;

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
    const dollyFrom = 18.5;
    const dollyTo = 6.1;
    const z = dollyFrom + (dollyTo - dollyFrom) * introEase - progress.current * 1.2;
    state.camera.position.z = z;
    state.camera.position.x = -0.28;
    state.camera.position.y = -0.08;
    state.camera.lookAt(0.8, 0.2, 0);
  });

  return (
    <group position={[0.92, 0.34, -0.2]} rotation={[-0.1, -0.22, 0.16]}>
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
          "radial-gradient(circle at 70% 34%, rgba(104, 132, 164, 0.2) 0%, rgba(17, 25, 39, 0.18) 20%, rgba(3, 6, 10, 0) 42%), radial-gradient(ellipse at 50% 28%, #101722 0%, #06090f 48%, #010203 100%)",
      }}
    >
      <Canvas
        camera={{ position: [-0.28, -0.08, 18.5], fov: 31 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ background: "transparent" }}
        frameloop={reducedMotion ? "demand" : "always"}
      >
        <ambientLight intensity={0.28} />
        <hemisphereLight
          intensity={0.42}
          color="#dae3ee"
          groundColor="#03070d"
        />
        <directionalLight position={[8, 4, 5]} intensity={2.6} color="#f5f6f8" />
        <directionalLight position={[-5, 1, 2]} intensity={0.5} color="#7f92aa" />
        <directionalLight position={[-3, -2, -4]} intensity={0.22} color="#15263a" />
        <pointLight position={[3, 2, 5]} intensity={0.78} color="#dde6ef" />
        <pointLight position={[-2, -1, 3]} intensity={0.2} color="#7197bf" />

        <Stars
          radius={120}
          depth={70}
          count={4200}
          factor={2.1}
          saturation={0}
          fade
          speed={reducedMotion ? 0 : 0.12}
        />

        {textures && <Earth progress={progress} textures={textures} />}
      </Canvas>
    </div>
  );
}
