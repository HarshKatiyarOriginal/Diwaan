import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function ThreeDiwaanSeal({ state = 'static', onError }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let animFrameId = null;
    let renderer = null;
    let scene = null;
    let camera = null;

    // Disposable resources
    const geometries = [];
    const materials = [];

    try {
      // 1. Scene setup
      scene = new THREE.Scene();

      camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
      camera.position.z = 4;

      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(120, 120);

      container.appendChild(renderer.domElement);

      // Handle webglcontextlost
      const handleContextLost = (e) => {
        e.preventDefault();
        if (animFrameId) cancelAnimationFrame(animFrameId);
        onError?.();
      };
      renderer.domElement.addEventListener('webglcontextlost', handleContextLost);

      // 2. Lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambientLight);

      const mainLight = new THREE.DirectionalLight(0xd4a24c, 2.5);
      mainLight.position.set(3, 3, 5);
      scene.add(mainLight);

      const rimLight = new THREE.PointLight(0x1e2a5e, 3, 10);
      rimLight.position.set(-3, -2, -2);
      scene.add(rimLight);

      // 3. 3D Seal Objects
      // Outer Torus Ring
      const outerGeo = new THREE.TorusGeometry(1.1, 0.04, 16, 64);
      const goldMat = new THREE.MeshStandardMaterial({
        color: 0xd4a24c,
        metalness: 0.9,
        roughness: 0.2,
      });
      geometries.push(outerGeo);
      materials.push(goldMat);

      const outerRing = new THREE.Mesh(outerGeo, goldMat);
      scene.add(outerRing);

      // Middle Dashed/Inner Ring
      const innerGeo = new THREE.TorusGeometry(0.85, 0.02, 16, 48);
      const innerMat = new THREE.MeshStandardMaterial({
        color: 0xd4a24c,
        metalness: 0.7,
        roughness: 0.3,
        wireframe: state === 'generating',
      });
      geometries.push(innerGeo);
      materials.push(innerMat);

      const innerRing = new THREE.Mesh(innerGeo, innerMat);
      scene.add(innerRing);

      // Core Gemstone (Octahedron)
      const coreGeo = new THREE.OctahedronGeometry(0.35, 0);
      const coreMat = new THREE.MeshStandardMaterial({
        color: 0xd4a24c,
        emissive: 0xd4a24c,
        emissiveIntensity: state === 'generating' ? 0.8 : 0.4,
        metalness: 0.8,
        roughness: 0.1,
      });
      geometries.push(coreGeo);
      materials.push(coreMat);

      const coreGem = new THREE.Mesh(coreGeo, coreMat);
      scene.add(coreGem);

      // Core Particles
      const particleCount = 24;
      const particleGeo = new THREE.BufferGeometry();
      const particlePositions = new Float32Array(particleCount * 3);

      for (let i = 0; i < particleCount * 3; i += 3) {
        particlePositions[i] = (Math.random() - 0.5) * 2.2;
        particlePositions[i + 1] = (Math.random() - 0.5) * 2.2;
        particlePositions[i + 2] = (Math.random() - 0.5) * 2;
      }
      particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

      const particleMat = new THREE.PointsMaterial({
        color: 0xd4a24c,
        size: 0.04,
        transparent: true,
        opacity: 0.7,
      });
      geometries.push(particleGeo);
      materials.push(particleMat);

      const particles = new THREE.Points(particleGeo, particleMat);
      scene.add(particles);

      // 4. Reduced Motion Check
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (prefersReducedMotion) {
        renderer.render(scene, camera);
        return;
      }

      // 5. Animation Loop
      let clock = new THREE.Clock();

      const animate = () => {
        animFrameId = requestAnimationFrame(animate);
        const elapsedTime = clock.getElapsedTime();

        const speedMultiplier = state === 'generating' ? 2.5 : state === 'unlocking' ? 4 : 1;

        outerRing.rotation.z = elapsedTime * 0.4 * speedMultiplier;
        outerRing.rotation.x = Math.sin(elapsedTime * 0.5) * 0.2;

        innerRing.rotation.z = -elapsedTime * 0.6 * speedMultiplier;
        innerRing.rotation.y = Math.cos(elapsedTime * 0.5) * 0.2;

        coreGem.rotation.y = elapsedTime * 0.8 * speedMultiplier;
        coreGem.rotation.x = elapsedTime * 0.5 * speedMultiplier;

        if (state === 'generating') {
          const scale = 1 + Math.sin(elapsedTime * 4) * 0.08;
          coreGem.scale.set(scale, scale, scale);
        } else if (state === 'unlocking') {
          const scale = 1 + elapsedTime * 0.5;
          coreGem.scale.set(scale, scale, scale);
        }

        particles.rotation.y = elapsedTime * 0.15;

        renderer.render(scene, camera);
      };

      animate();

      return () => {
        if (animFrameId) cancelAnimationFrame(animFrameId);
        renderer?.domElement?.removeEventListener('webglcontextlost', handleContextLost);
        if (renderer && renderer.domElement && container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }

        geometries.forEach(g => g.dispose());
        materials.forEach(m => m.dispose());
        renderer?.dispose();
      };
    } catch (e) {
      console.warn('WebGL 3D DiwaanSeal initialization failed, falling back to CSS seal:', e);
      onError?.();
    }
  }, [state, onError]);

  return <div ref={containerRef} style={{ width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }} />;
}
