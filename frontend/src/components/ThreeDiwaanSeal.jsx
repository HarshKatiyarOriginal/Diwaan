/**
 * ThreeDiwaanSeal — volumetric WebGL 3D centerpiece for Diwaan.
 *
 * Scene composition:
 *   - Two hemispherical gold lattice shells (IcosahedronGeometry + EdgesGeometry)
 *   - Faceted refracting core gem (OctahedronGeometry, glass-like material)
 *   - 200-point orbiting particle field
 *   - RoomEnvironment + PMREMGenerator for realistic gold reflections
 *   - Post-processing: EffectComposer → UnrealBloomPass → ShaderPass(grain+vignette) → OutputPass
 *
 * States:
 *   static    — slow bounded drift + resting bloom pulse
 *   generating — faster rotation, agitated particles, core pulse
 *   unlocking  — one-shot burst sequence (~800ms), then returns to static
 *
 * Safety: try/catch on init → onError() fallback; webglcontextlost handler;
 * prefers-reduced-motion → single static frame; full teardown on unmount.
 *
 * No new npm packages — uses three/examples/jsm only.
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export default function ThreeDiwaanSeal({ state = 'static', onError }) {
  const containerRef = useRef(null);
  // Capture state in a ref so the animation loop reads the latest without restart
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Disposable resource lists for clean teardown
    const geometries = [];
    const materials = [];
    const renderTargets = [];

    let animFrameId = null;
    let renderer = null;
    let composer = null;
    let unlockStart = null;

    try {
      // ── 1. Renderer ────────────────────────────────────────────────────────
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      // Responsive size: 320 base, up to 480 if container wider
      const SIZE = Math.min(Math.max(container.clientWidth || 320, 320), 480);
      renderer.setSize(SIZE, SIZE);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      renderer.outputColorSpace = THREE.SRGBColorSpace;

      container.appendChild(renderer.domElement);

      // WebGL context lost → CSS fallback
      const handleContextLost = (e) => {
        e.preventDefault();
        if (animFrameId) cancelAnimationFrame(animFrameId);
        onError?.();
      };
      renderer.domElement.addEventListener('webglcontextlost', handleContextLost);

      // ── 2. Scene + Camera ──────────────────────────────────────────────────
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
      camera.position.z = 5.5;

      // ── 3. Environment map (RoomEnvironment + PMREMGenerator) ─────────────
      let envMapApplied = false;
      try {
        const pmremGenerator = new THREE.PMREMGenerator(renderer);
        pmremGenerator.compileEquirectangularShader();
        const envMap = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
        scene.environment = envMap;
        renderTargets.push({ dispose: () => { pmremGenerator.dispose(); envMap.dispose(); } });
        envMapApplied = true;
      } catch {
        // Fallback: manual lighting only
      }

      // ── 4. Lighting (always applied; supplements env map when available) ───
      const ambient = new THREE.AmbientLight(0xffffff, envMapApplied ? 0.3 : 0.7);
      scene.add(ambient);

      const mainLight = new THREE.DirectionalLight(0xd4a24c, envMapApplied ? 1.5 : 3.0);
      mainLight.position.set(3, 4, 5);
      scene.add(mainLight);

      const rimLight = new THREE.PointLight(0x1e2a5e, 3, 12);
      rimLight.position.set(-3, -2, -3);
      scene.add(rimLight);

      const fillLight = new THREE.PointLight(0xd4a24c, 0.8, 8);
      fillLight.position.set(0, 3, -3);
      scene.add(fillLight);

      // ── 5. Gold material ───────────────────────────────────────────────────
      const GOLD = 0xd4a24c;
      const goldMat = new THREE.MeshStandardMaterial({
        color: GOLD,
        metalness: 0.95,
        roughness: 0.15,
        envMapIntensity: envMapApplied ? 1.5 : 0.0,
      });
      materials.push(goldMat);

      const goldWireMat = new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0.75 });
      materials.push(goldWireMat);

      // ── 6. Outer hemispherical lattice shell ───────────────────────────────
      const outerIco = new THREE.IcosahedronGeometry(1.4, 1);
      const outerEdges = new THREE.EdgesGeometry(outerIco);
      geometries.push(outerIco, outerEdges);
      const outerShell = new THREE.LineSegments(outerEdges, goldWireMat.clone());
      materials.push(outerShell.material);
      scene.add(outerShell);

      // ── 7. Inner hemispherical lattice shell ───────────────────────────────
      const innerIco = new THREE.IcosahedronGeometry(1.0, 1);
      const innerEdges = new THREE.EdgesGeometry(innerIco);
      geometries.push(innerIco, innerEdges);
      const innerWireMat = new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0.45 });
      materials.push(innerWireMat);
      const innerShell = new THREE.LineSegments(innerEdges, innerWireMat);
      scene.add(innerShell);

      // ── 8. Faceted core gem ────────────────────────────────────────────────
      const coreGeo = new THREE.OctahedronGeometry(0.38, 1);
      geometries.push(coreGeo);
      const coreMat = new THREE.MeshStandardMaterial({
        color: GOLD,
        emissive: new THREE.Color(0xd4a24c),
        emissiveIntensity: 0.45,
        metalness: 0.6,
        roughness: 0.05,
        transparent: true,
        opacity: 0.92,
      });
      materials.push(coreMat);
      const coreGem = new THREE.Mesh(coreGeo, coreMat);
      scene.add(coreGem);

      // ── 9. Orbiting particle field (200 points) ────────────────────────────
      const PARTICLE_COUNT = 200;
      const particleGeo = new THREE.BufferGeometry();
      const positions = new Float32Array(PARTICLE_COUNT * 3);
      const velocities = new Float32Array(PARTICLE_COUNT * 3); // orbital drift

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        // Distribute on sphere surface with radius jitter
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = 1.2 + Math.random() * 0.8;
        positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);
        velocities[i * 3 + 0] = (Math.random() - 0.5) * 0.002;
        velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.002;
        velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.002;
      }
      particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometries.push(particleGeo);

      const particleMat = new THREE.PointsMaterial({
        color: GOLD,
        size: 0.03,
        transparent: true,
        opacity: 0.65,
        sizeAttenuation: true,
      });
      materials.push(particleMat);
      const particles = new THREE.Points(particleGeo, particleMat);
      scene.add(particles);

      // ── 10. Post-processing ────────────────────────────────────────────────
      let bloomPass = null;
      let grainPass = null;

      try {
        composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));

        bloomPass = new UnrealBloomPass(
          new THREE.Vector2(SIZE, SIZE),
          0.65,   // strength
          0.5,   // radius
          0.0,   // threshold
        );
        composer.addPass(bloomPass);

        // Grain + vignette + chromatic aberration shader
        grainPass = new ShaderPass({
          uniforms: {
            tDiffuse: { value: null },
            time: { value: 0 },
            grainAmount: { value: 0.04 },
            vignetteAmount: { value: 0.35 },
            caAmount: { value: 0.003 },
          },
          vertexShader: /* glsl */`
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: /* glsl */`
            uniform sampler2D tDiffuse;
            uniform float time;
            uniform float grainAmount;
            uniform float vignetteAmount;
            uniform float caAmount;
            varying vec2 vUv;

            float rand(vec2 co) {
              return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
            }

            void main() {
              // Chromatic aberration
              vec2 dir = vUv - 0.5;
              vec4 cr = texture2D(tDiffuse, vUv + dir * caAmount);
              vec4 cg = texture2D(tDiffuse, vUv);
              vec4 cb = texture2D(tDiffuse, vUv - dir * caAmount);
              vec4 color = vec4(cr.r, cg.g, cb.b, cg.a);

              // Film grain
              float grain = rand(vUv + fract(time * 0.01)) * grainAmount;
              color.rgb += grain - grainAmount * 0.5;

              // Vignette
              float vignette = 1.0 - dot(dir * 1.5, dir * 1.5) * vignetteAmount;
              color.rgb *= clamp(vignette, 0.0, 1.0);

              gl_FragColor = color;
            }
          `,
        });
        composer.addPass(grainPass);
        composer.addPass(new OutputPass());
      } catch {
        // Post-processing unavailable — render without it
        composer = null;
      }

      // ── Teardown (defined before any early return so it always runs) ──────
      const cleanup = () => {
        if (animFrameId) cancelAnimationFrame(animFrameId);
        renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
        if (container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
        geometries.forEach(g => g.dispose());
        materials.forEach(m => m.dispose());
        renderTargets.forEach(rt => rt.dispose());
        if (composer) composer.dispose?.();
        renderer.dispose();
      };

      // ── 11. Reduced-motion guard ───────────────────────────────────────────
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReducedMotion) {
        if (composer) composer.render();
        else renderer.render(scene, camera);
        return cleanup;   // still tear down the GL context on unmount
      }

      // ── 12. Animation loop ─────────────────────────────────────────────────
      const clock = new THREE.Clock();

      const animate = () => {
        animFrameId = requestAnimationFrame(animate);
        const t = clock.getElapsedTime();
        const currentState = stateRef.current;

        // Speed factor by state
        const speed = currentState === 'generating' ? 2.8
                    : currentState === 'unlocking' ? 5.0
                    : 1.0;

        // Outer shell — slow orbital rotation
        outerShell.rotation.y = t * 0.18 * speed;
        outerShell.rotation.x = Math.sin(t * 0.3) * 0.15;
        outerShell.rotation.z = t * 0.08 * speed;

        // Inner shell — counter-rotation
        innerShell.rotation.y = -t * 0.28 * speed;
        innerShell.rotation.z = Math.cos(t * 0.3) * 0.12;

        // Core gem rotation
        coreGem.rotation.y = t * 0.55 * speed;
        coreGem.rotation.x = t * 0.35 * speed;

        // State-specific effects
        if (currentState === 'generating') {
          const pulse = 1 + Math.sin(t * 5) * 0.07;
          coreGem.scale.set(pulse, pulse, pulse);
          coreMat.emissiveIntensity = 0.6 + Math.sin(t * 4) * 0.3;
          if (bloomPass) bloomPass.strength = 0.9 + Math.sin(t * 3) * 0.25;
          particleMat.opacity = 0.8 + Math.sin(t * 6) * 0.15;
        } else if (currentState === 'unlocking') {
          if (!unlockStart) unlockStart = t;
          const prog = Math.min((t - unlockStart) / 0.8, 1.0); // 800ms
          const burst = prog < 0.5 ? prog * 2 : (1.0 - prog) * 2;
          const s = 1 + burst * 0.6;
          outerShell.scale.set(s, s, s);
          innerShell.scale.set(1 / s, 1 / s, 1 / s);
          coreGem.scale.set(1 + burst * 0.4, 1 + burst * 0.4, 1 + burst * 0.4);
          coreMat.emissiveIntensity = 0.45 + burst * 1.5;
          if (bloomPass) bloomPass.strength = 0.65 + burst * 2;
          if (prog >= 1.0) unlockStart = null;
        } else {
          // Static: resting shimmer — very gentle bloom pulse
          unlockStart = null;
          coreGem.scale.set(1, 1, 1);
          outerShell.scale.set(1, 1, 1);
          innerShell.scale.set(1, 1, 1);
          coreMat.emissiveIntensity = 0.45 + Math.sin(t * 1.2) * 0.08;
          if (bloomPass) bloomPass.strength = 0.65 + Math.sin(t * 0.8) * 0.08;
          particleMat.opacity = 0.65;
        }

        // Particles: slow orbital drift
        particles.rotation.y = t * 0.08 * speed;
        particles.rotation.x = Math.sin(t * 0.15) * 0.04;

        // Update grain time
        if (grainPass) grainPass.uniforms.time.value = t;

        // Render
        if (composer) composer.render();
        else renderer.render(scene, camera);
      };

      animate();

      // ── 13. Cleanup ────────────────────────────────────────────────────────
      return cleanup;
    } catch (e) {
      console.warn('ThreeDiwaanSeal WebGL init failed, falling back to CSS seal:', e);
      onError?.();
    }
  }, [onError]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '320px',
        height: '320px',
        maxWidth: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    />
  );
}
