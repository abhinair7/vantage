"use client";

import { Canvas, useFrame, extend } from "@react-three/fiber";
import { Stars, shaderMaterial } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useMemo, useRef, useEffect, useState, type MutableRefObject } from "react";
import * as THREE from "three";
import { TextureLoader } from "three";

/**
 * Hero 3D Earth — IMAX cinematic.
 *
 * Clean planet, no gimmicks. Fresnel atmosphere scattering on the limb,
 * high-detail normals, three-point lighting. The camera starts far back
 * (looking through telescope aperture) and dollies in over ~3s.
 */

type ProgressRef = MutableRefObject<number>;

type EarthTextures = {
  colorMap: THREE.Texture;
  normalMap: THREE.Texture;
  specularMap: THREE.Texture;
  cloudsMap: THREE.Texture;
};

type PointerRef = MutableRefObject<{ x: number; y: number }>;

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

// Type augmentation for R3F custom element
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
  const atmosRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Group>(null);
  const mountAt = useRef<number | null>(null);
  const { colorMap, normalMap, specularMap, cloudsMap } = textures;
  const specularColor = useMemo(() => new THREE.Color(0x73d9ff), []);
  const normalScale = useMemo(() => new THREE.Vector2(0.95, 0.95), []);
  const emissiveColor = useMemo(() => new THREE.Color(0x0c3d7d), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (mountAt.current == null) mountAt.current = t;
    const elapsed = t - mountAt.current;

    // Slow rotation
    if (earthRef.current) {
      earthRef.current.rotation.y = elapsed * 0.045;
    }
    if (cloudsRef.current) {
      cloudsRef.current.rotation.y = elapsed * 0.062;
    }
    if (groupRef.current) {
      groupRef.current.position.y = pointer.current.y * 0.04;
      groupRef.current.rotation.x = -pointer.current.y * 0.06;
      groupRef.current.rotation.z = pointer.current.x * 0.035;
    }
    if (ringRef.current) {
      ringRef.current.rotation.z = elapsed * 0.08;
      ringRef.current.rotation.x = 0.9 + pointer.current.y * 0.04;
    }

    // Update atmosphere view vector for Fresnel
    if (atmosRef.current) {
      const mat = atmosRef.current.material as THREE.ShaderMaterial & {
        uniforms: { viewVector: { value: THREE.Vector3 } };
      };
      if (mat.uniforms?.viewVector) {
        mat.uniforms.viewVector.value.copy(state.camera.position);
      }
    }

    // Cinematic dolly — 3s ease-in from far to close
    const introT = Math.min(1, elapsed / 3.0);
    const introEase = 1 - Math.pow(1 - introT, 4); // quartic ease-out
    const dollyFrom = 16;
    const dollyTo = 4.2;
    const z = dollyFrom + (dollyTo - dollyFrom) * introEase - progress.current * 1.6;
    state.camera.position.z = z;
    state.camera.position.x = THREE.MathUtils.lerp(
      state.camera.position.x,
      pointer.current.x * 0.3,
      0.04,
    );
    state.camera.position.y = THREE.MathUtils.lerp(
      state.camera.position.y,
      pointer.current.y * 0.18,
      0.04,
    );
    state.camera.lookAt(0, 0, 0);
  });

  return (
    <group ref={groupRef}>
      {/* Earth surface */}
      <mesh ref={earthRef}>
        <sphereGeometry args={[1, 128, 128]} />
        <meshPhongMaterial
          map={colorMap}
          normalMap={normalMap}
          specularMap={specularMap}
          specular={specularColor}
          shininess={38}
          normalScale={normalScale}
          emissive={emissiveColor}
          emissiveIntensity={0.34}
        />
      </mesh>

      {/* Cloud layer */}
      <mesh ref={cloudsRef} scale={1.006}>
        <sphereGeometry args={[1, 96, 96]} />
        <meshPhongMaterial
          map={cloudsMap}
          transparent
          opacity={0.28}
          depthWrite={false}
        />
      </mesh>

      <group ref={ringRef}>
        <mesh rotation={[1.05, 0.3, 0.18]} scale={1.38}>
          <torusGeometry args={[1.14, 0.008, 18, 180]} />
          <meshBasicMaterial
            color="#7df9ff"
            transparent
            opacity={0.28}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
        <mesh rotation={[1.1, 0.28, 0.2]} scale={1.48}>
          <torusGeometry args={[1.08, 0.004, 16, 180]} />
          <meshBasicMaterial
            color="#fde047"
            transparent
            opacity={0.2}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* Fresnel atmospheric scattering — thin blue glow on the limb */}
      <mesh ref={atmosRef} scale={1.035}>
        <sphereGeometry args={[1, 64, 64]} />
        <atmosphereMaterial
          transparent
          side={THREE.FrontSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          glowColor={new THREE.Color(0x7df9ff)}
          intensity={1.45}
        />
      </mesh>

      <mesh scale={1.16}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshBasicMaterial
          color="#7df9ff"
          transparent
          opacity={0.08}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
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
          "radial-gradient(ellipse at 50% 36%, #0d1d3d 0%, #060e1f 40%, #020408 100%)",
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 16], fov: 36 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ background: "transparent" }}
        frameloop={reducedMotion ? "demand" : "always"}
      >
        {/* Three-point lighting — warm key, cool fill, blue rim */}
        <ambientLight intensity={0.72} />
        <hemisphereLight
          intensity={0.86}
          color="#fef5cf"
          groundColor="#081426"
        />
        {/* Key light — warm white, strong, camera-right */}
        <directionalLight position={[5, 3, 4]} intensity={3.1} color="#fff8de" />
        {/* Fill — cool, softer, camera-left */}
        <directionalLight position={[-4, 1, 3]} intensity={1.25} color="#c8ebff" />
        {/* Rim — blue backlight for edge definition */}
        <directionalLight position={[-3, -1, -4]} intensity={0.85} color="#2f63d8" />
        {/* Specular catch light */}
        <pointLight position={[2, 1.5, 3]} intensity={1.35} color="#e9fbff" />
        <pointLight position={[-2.8, 1.8, 2.2]} intensity={0.55} color="#fde047" />

        <Stars
          radius={120}
          depth={70}
          count={4200}
          factor={2.8}
          saturation={0}
          fade
          speed={reducedMotion ? 0 : 0.22}
        />

        {textures && <Earth progress={progress} pointer={pointer} textures={textures} />}

        {!reducedMotion && (
          <EffectComposer multisampling={0}>
            <Bloom
              intensity={0.75}
              luminanceThreshold={0.18}
              luminanceSmoothing={0.4}
              mipmapBlur
            />
          </EffectComposer>
        )}
      </Canvas>
    </div>
  );
}
