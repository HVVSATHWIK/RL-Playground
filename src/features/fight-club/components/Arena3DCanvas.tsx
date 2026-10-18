import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFightStore } from '../stores/fightStore';
import { Robot3DModel } from '../lib/robot3DModel';
import { CombatVFX3D } from '../lib/combatVFX3D';
import { MAX_HP } from '../lib/fighter';
import { AlertCircle } from 'lucide-react';

export function Arena3DCanvas() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [fps, setFps] = useState(60);
  const [webGLError, setWebGLError] = useState<string | null>(null);
  const [lowPerfWarning, setLowPerfWarning] = useState(false);

  const {
    red,
    blue,
    round,
    stepCount,
    lastWinner,
    announceTimer,
    redPolicy,
    bluePolicy,
    mode,
    speed,
    setView3D,
  } = useFightStore();

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Safe WebGL Context Initialization
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch {
      queueMicrotask(() => {
        setWebGLError('WebGL initialization failed on this device.');
        setView3D(false);
      });
      return;
    }

    const width = container.clientWidth || 800;
    const height = 400;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#070c1d');
    scene.fog = new THREE.FogExp2('#070c1d', 0.025);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 4.2, 16.5);
    camera.lookAt(0, 2.4, 0);

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    container.appendChild(renderer.domElement);

    // Track shared resources for clean disposal
    const sharedGeoms: THREE.BufferGeometry[] = [];
    const sharedMats: THREE.Material[] = [];

    // Context loss safety
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebGLError('WebGL context lost. Switching to lightweight 2D canvas.');
      setView3D(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost, false);

    // 2. Studio Lighting Rig
    const hemiLight = new THREE.HemisphereLight('#bfdbfe', '#0f172a', 0.7);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight('#fffbeb', 1.4);
    keyLight.position.set(6, 12, 10);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 30;
    keyLight.shadow.camera.left = -14;
    keyLight.shadow.camera.right = 14;
    keyLight.shadow.camera.top = 10;
    keyLight.shadow.camera.bottom = -2;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight('#38bdf8', 1.0);
    rimLight.position.set(-8, 6, -6);
    scene.add(rimLight);

    const spotLight = new THREE.SpotLight('#60a5fa', 1.5, 25, Math.PI / 4, 0.4);
    spotLight.position.set(0, 10, 0);
    spotLight.target.position.set(0, 0, 0);
    scene.add(spotLight);
    scene.add(spotLight.target);

    // 3. Cybernetic Arena Floor
    const floorGeom = new THREE.CylinderGeometry(14, 14.5, 0.6, 48);
    sharedGeoms.push(floorGeom);
    const floorMat = new THREE.MeshStandardMaterial({
      color: '#0f172a',
      roughness: 0.4,
      metalness: 0.6,
    });
    sharedMats.push(floorMat);
    const floor = new THREE.Mesh(floorGeom, floorMat);
    floor.position.y = -0.3;
    floor.receiveShadow = true;
    scene.add(floor);

    // Glowing Neon Ring Perimeter
    const ringGeom = new THREE.TorusGeometry(12.5, 0.12, 16, 64);
    ringGeom.rotateX(Math.PI / 2);
    sharedGeoms.push(ringGeom);
    const ringMat = new THREE.MeshBasicMaterial({ color: '#2563eb' });
    sharedMats.push(ringMat);
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.position.y = 0.05;
    scene.add(ring);

    // Reusable Ropes
    const ropeGeom = new THREE.TorusGeometry(13.2, 0.06, 12, 64);
    ropeGeom.rotateX(Math.PI / 2);
    sharedGeoms.push(ropeGeom);
    const blueRopeMat = new THREE.MeshBasicMaterial({ color: '#1d4ed8', transparent: true, opacity: 0.6 });
    const skyRopeMat = new THREE.MeshBasicMaterial({ color: '#38bdf8', transparent: true, opacity: 0.7 });
    sharedMats.push(blueRopeMat, skyRopeMat);

    [-0.5, 0.3, 1.1].forEach((ropeY, idx) => {
      const rope = new THREE.Mesh(ropeGeom, idx === 1 ? skyRopeMat : blueRopeMat);
      rope.position.y = ropeY + 1.2;
      scene.add(rope);
    });

    // Reusable Posts
    const postGeom = new THREE.CylinderGeometry(0.2, 0.2, 3.2, 12);
    sharedGeoms.push(postGeom);
    const postMat = new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.9, roughness: 0.2 });
    sharedMats.push(postMat);

    const postPositions = [
      [-10, 0, -8],
      [10, 0, -8],
      [-10, 0, 8],
      [10, 0, 8],
    ];
    postPositions.forEach(([px, , pz]) => {
      const post = new THREE.Mesh(postGeom, postMat);
      post.position.set(px, 1.6, pz);
      scene.add(post);
    });

    // 4. Procedural 3D Mecha Models
    const redRobot = new Robot3DModel({
      primaryColor: '#ef4444',
      accentColor: '#991b1b',
      emissiveColor: '#ff2222',
    });
    scene.add(redRobot.group);

    const blueRobot = new Robot3DModel({
      primaryColor: '#2563eb',
      accentColor: '#1d4ed8',
      emissiveColor: '#38bdf8',
    });
    scene.add(blueRobot.group);

    // 5. Visceral 3D Combat VFX System (Directional Sparks, Shockwaves, Dynamic Light, Camera Shake)
    const combatVFX = new CombatVFX3D(scene, camera);

    let prevRedFlash = 0;
    let prevBlueFlash = 0;
    let lastSeenHitId = 0;

    // 6. Animation and Render Loop with Performance Guard
    let animId: number;
    let lastTime = performance.now();
    const frameTimes: number[] = [];
    let lowFpsCount = 0;

    const renderLoop = () => {
      const now = performance.now();
      const delta = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      // Measure FPS
      frameTimes.push(now);
      if (frameTimes.length > 30) {
        frameTimes.shift();
        const duration = (now - frameTimes[0]) / 1000;
        const currentFps = Math.round(frameTimes.length / duration);
        setFps(currentFps);

        if (currentFps < 25) {
          lowFpsCount++;
          if (lowFpsCount > 3) setLowPerfWarning(true);
        } else {
          lowFpsCount = 0;
        }
      }

      const state = useFightStore.getState();
      const { red: currentRed, blue: currentBlue } = state;

      // Update 3D Mecha limb kinematics, positions, and depth
      redRobot.updatePose(currentRed, currentBlue, delta);
      blueRobot.updatePose(currentBlue, currentRed, delta);

      // Dynamic 3D Action-Tracking Camera
      const redPos = redRobot.group.position;
      const bluePos = blueRobot.group.position;
      const midX = (redPos.x + bluePos.x) / 2;
      const midZ = (redPos.z + bluePos.z) / 2;
      const dist = Math.abs(redPos.x - bluePos.x);

      const targetCamX = midX * 0.45;
      const targetCamY = 3.8 + (dist > 8 ? 0.6 : 0);
      const targetCamZ = 13.5 + Math.min(dist * 0.35, 4.0);

      const baseCamPos = combatVFX.baseCameraPos;
      baseCamPos.x = THREE.MathUtils.damp(baseCamPos.x, targetCamX, 6, delta);
      baseCamPos.y = THREE.MathUtils.damp(baseCamPos.y, targetCamY, 6, delta);
      baseCamPos.z = THREE.MathUtils.damp(baseCamPos.z, targetCamZ, 6, delta);

      const lookTargetX = midX * 0.65;
      const lookTargetY = 2.2;
      const lookTargetZ = midZ * 0.5;
      camera.lookAt(lookTargetX, lookTargetY, lookTargetZ);

      // Update Combat VFX (sparks physics, shockwave rings, lighting decay, camera shake)
      combatVFX.update(delta);

      // Trigger 3D Hit Particle Sparks & Shockwaves on Hit Detection
      const hit = state.lastHitEvent;
      if (hit && hit.id !== lastSeenHitId) {
        lastSeenHitId = hit.id;
        const hitX3D = (redPos.x + bluePos.x) / 2;
        const hitY3D = hit.attackType === 'kick' ? 1.85 : 2.5;
        const hitZ3D = (redPos.z + bluePos.z) / 2;
        const attackerFacing = hit.attacker === 'red' ? currentRed.facing : currentBlue.facing;

        combatVFX.triggerImpact(hitX3D, hitY3D, hitZ3D, {
          isCrit: hit.isCrit,
          isBlocked: hit.isBlocked,
          attackType: hit.attackType,
          attackerFacing,
          speed: state.speed,
        });
      } else {
        // Fallback hit flash triggers for frame-accurate responsiveness
        if (currentRed.hitFlash > 0 && prevRedFlash === 0) {
          combatVFX.triggerImpact(redPos.x, 2.4, redPos.z, {
            isCrit: false,
            isBlocked: currentRed.isBlocking,
            attackType: 'punch',
            attackerFacing: currentBlue.facing,
            speed: state.speed,
          });
        }
        if (currentBlue.hitFlash > 0 && prevBlueFlash === 0) {
          combatVFX.triggerImpact(bluePos.x, 2.4, bluePos.z, {
            isCrit: false,
            isBlocked: currentBlue.isBlocking,
            attackType: 'punch',
            attackerFacing: currentRed.facing,
            speed: state.speed,
          });
        }
      }

      prevRedFlash = currentRed.hitFlash;
      prevBlueFlash = currentBlue.hitFlash;

      renderer.render(scene, camera);
      animId = requestAnimationFrame(renderLoop);
    };

    animId = requestAnimationFrame(renderLoop);

    // 7. Responsive Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newW = entry.contentRect.width;
        if (newW > 0) {
          camera.aspect = newW / height;
          camera.updateProjectionMatrix();
          renderer.setSize(newW, height);
          combatVFX.setBaseCameraPosition(0, 4.2, 16.5);
        }
      }
    });
    resizeObserver.observe(container);

    // 8. Cleanup and Memory Disposal
    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      combatVFX.dispose();
      redRobot.dispose();
      blueRobot.dispose();
      sharedGeoms.forEach((g) => g.dispose());
      sharedMats.forEach((m) => m.dispose());
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [setView3D]);

  // Policy Labels
  const redLabel = redPolicy === 'human' ? 'YOU (Human)' : redPolicy === 'dqn' ? 'DQN Mecha' : 'Bot';
  const blueLabel = bluePolicy === 'human' ? 'YOU (Human)' : bluePolicy === 'dqn' ? 'DQN Mecha' : 'Bot';

  if (webGLError) {
    return (
      <div className="w-full max-w-[800px] h-[400px] rounded-2xl border-2 border-red-200 bg-red-50 p-6 flex flex-col items-center justify-center text-center text-red-800">
        <AlertCircle size={32} className="text-red-600 mb-2" />
        <h3 className="font-bold text-sm">{webGLError}</h3>
        <p className="text-xs text-red-600 mt-1">Automatic fallback to 2D view enabled.</p>
        <button
          onClick={() => setView3D(false)}
          className="mt-3 px-4 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
        >
          Switch to 2D Arena
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-[800px] rounded-2xl overflow-hidden shadow-lg border-2 border-blue-200/90 bg-[#070c1d] flex flex-col items-center select-none">
      {/* 3D WebGL Canvas Viewport */}
      <div ref={mountRef} className="w-full h-[400px] cursor-grab active:cursor-grabbing relative" />

      {/* Low Performance Hint */}
      {lowPerfWarning && (
        <div className="absolute top-16 bg-amber-950/90 border border-amber-500/50 text-amber-200 px-3 py-1.5 rounded-lg text-xs flex items-center gap-2 shadow-md">
          <span>Low GPU FPS detected ({fps} FPS).</span>
          <button
            onClick={() => setView3D(false)}
            className="underline text-white font-bold cursor-pointer"
          >
            Switch to 2D
          </button>
        </div>
      )}

      {/* Floating HUD: HP Bars & Status */}
      <div className="absolute top-3 left-4 right-4 flex items-center justify-between pointer-events-none">
        {/* Red Fighter HUD */}
        <div className="w-48 bg-slate-950/80 backdrop-blur-xs p-2 rounded-xl border border-red-500/40 shadow-sm flex flex-col gap-1 relative">
          {red.damageNumbers.some((d) => d.isEvade && d.age < 28) && (
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-sky-500 text-white font-black text-[10px] px-2 py-0.5 rounded-full shadow-md animate-bounce border border-white">
              ⚡ EVADED!
            </div>
          )}
          <div className="flex justify-between items-center text-[10px]">
            <span className="font-extrabold text-red-400 uppercase tracking-tight">{redLabel}</span>
            <span className="font-mono font-bold text-white">{red.hp} HP</span>
          </div>
          <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-700">
            <div
              style={{ width: `${Math.max(0, (red.hp / MAX_HP) * 100)}%` }}
              className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-200"
            />
          </div>
          <div className="flex justify-between items-center text-[9px] text-slate-400 font-mono">
            <span>Action: {red.lastAction}</span>
            <span className={red.cooldown <= 0 ? 'text-emerald-400 font-semibold' : 'text-slate-500'}>
              {red.cooldown <= 0 ? 'READY' : `CD: ${red.cooldown}`}
            </span>
          </div>
        </div>

        {/* Center Round Badge */}
        <div className="flex flex-col items-center">
          <div className="bg-blue-950/80 backdrop-blur-xs px-3 py-1 rounded-full border border-blue-400/50 text-[10px] text-blue-300 font-mono font-bold shadow-sm">
            Round {round} • Frame {stepCount}
          </div>
          <div className="text-[9px] text-slate-400 font-mono mt-0.5">
            3D Arena • {fps} FPS {speed > 1 && `(${speed}x)`}
          </div>
        </div>

        {/* Blue Fighter HUD */}
        <div className="w-48 bg-slate-950/80 backdrop-blur-xs p-2 rounded-xl border border-blue-500/40 shadow-sm flex flex-col gap-1 relative">
          {blue.damageNumbers.some((d) => d.isEvade && d.age < 28) && (
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-sky-500 text-white font-black text-[10px] px-2 py-0.5 rounded-full shadow-md animate-bounce border border-white">
              ⚡ EVADED!
            </div>
          )}
          <div className="flex justify-between items-center text-[10px]">
            <span className="font-mono font-bold text-white">{blue.hp} HP</span>
            <span className="font-extrabold text-blue-400 uppercase tracking-tight">{blueLabel}</span>
          </div>
          <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-700">
            <div
              style={{ width: `${Math.max(0, (blue.hp / MAX_HP) * 100)}%` }}
              className="h-full bg-gradient-to-l from-blue-600 to-sky-400 transition-all duration-200"
            />
          </div>
          <div className="flex justify-between items-center text-[9px] text-slate-400 font-mono">
            <span className={blue.cooldown <= 0 ? 'text-sky-400 font-semibold' : 'text-slate-500'}>
              {blue.cooldown <= 0 ? 'READY' : `CD: ${blue.cooldown}`}
            </span>
            <span>Action: {blue.lastAction}</span>
          </div>
        </div>
      </div>

      {/* Control Banner for Human Dojo */}
      {mode === 'dojo' && (
        <div className="absolute bottom-2 px-3 py-1 rounded-full bg-slate-950/70 backdrop-blur-xs border border-blue-500/30 text-[10px] font-mono text-blue-300 shadow-sm pointer-events-none">
          [A/D or ←/→] Move • [J/Space] Punch • [K/E] Kick • [Shift] Block • [Alt/Q] Dodge
        </div>
      )}

      {/* Winner Announcement Overlay */}
      {lastWinner && announceTimer > 0 && (
        <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center pointer-events-none transition-all">
          <div className="text-3xl font-black tracking-tight text-white uppercase drop-shadow-md">
            {lastWinner === 'draw' ? (
              <span className="text-amber-400">DRAW DECISION!</span>
            ) : lastWinner === 'red' ? (
              <span className="text-red-500">RED FIGHTER WINS!</span>
            ) : (
              <span className="text-blue-400">BLUE AI WINS!</span>
            )}
          </div>
          <p className="text-xs text-slate-300 mt-1 font-medium">
            {lastWinner === 'red' && redPolicy === 'human'
              ? 'Triumph! You defeated the trained AI robot.'
              : lastWinner === 'blue' && redPolicy === 'human'
              ? 'The Deep Q-Network out-maneuvered your defenses.'
              : 'Bout concluded. Resetting ring for next round...'}
          </p>
        </div>
      )}
    </div>
  );
}
