import * as THREE from 'three';

export interface ImpactOptions {
  isCrit?: boolean;
  isBlocked?: boolean;
  attackType?: 'punch' | 'kick';
  attackerFacing?: number; // 1 (facing right) or -1 (facing left)
  speed?: number;
}

interface SparkParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  r: number;
  g: number;
  b: number;
  size: number;
  life: number;
  maxLife: number;
  drag: number;
  gravity: number;
}

interface ShockwaveInstance {
  active: boolean;
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  type: 'contact' | 'floor';
  time: number;
  duration: number;
  maxScale: number;
  baseScale: number;
}

/**
 * Procedural 3D Combat VFX System for Robo-Dojo.
 * Features:
 *  - Visceral high-velocity directional sparks with gravity, drag & floor bounce
 *  - Expanding 3D impact shockwave rings (contact ring + arena floor ripple)
 *  - Dynamic contact flash point light illuminating mecha chassis
 *  - Trauma-based subtle camera micro-shake on impacts
 *  - White and cyber-blue color palette matching the sleek mecha aesthetic
 *  - Zero-allocation pooled architecture for sustained 60 FPS performance
 */
export class CombatVFX3D {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  public baseCameraPos: THREE.Vector3;

  // 1. Sparks System (Points with custom attributes)
  private maxSparks = 220;
  private sparkGeom: THREE.BufferGeometry;
  private sparkMat: THREE.PointsMaterial;
  private sparkPoints: THREE.Points;
  private sparkPositions: Float32Array;
  private sparkColors: Float32Array;
  private sparkSizes: Float32Array;
  private sparkPool: SparkParticle[] = [];
  private sparkTexture: THREE.Texture | null = null;

  // 2. Shockwaves Pool
  private shockwaves: ShockwaveInstance[] = [];
  private shockwaveGeomContact: THREE.RingGeometry;
  private shockwaveGeomFloor: THREE.RingGeometry;

  // 3. Dynamic Impact Point Light
  private impactLight: THREE.PointLight;
  private impactLightIntensity = 0;

  // 4. Camera Trauma Micro-Shake
  private trauma = 0;
  private shakeTimer = 0;

  // Memory Tracking for Clean Disposal
  private disposables: { dispose: () => void }[] = [];

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.scene = scene;
    this.camera = camera;
    this.baseCameraPos = camera.position.clone();

    // 1. Initialize Sparks Particle System
    this.sparkPositions = new Float32Array(this.maxSparks * 3);
    this.sparkColors = new Float32Array(this.maxSparks * 3);
    this.sparkSizes = new Float32Array(this.maxSparks);

    for (let i = 0; i < this.maxSparks; i++) {
      this.sparkPositions[i * 3] = 0;
      this.sparkPositions[i * 3 + 1] = -100;
      this.sparkPositions[i * 3 + 2] = 0;

      this.sparkColors[i * 3] = 1;
      this.sparkColors[i * 3 + 1] = 1;
      this.sparkColors[i * 3 + 2] = 1;

      this.sparkSizes[i] = 0;

      this.sparkPool.push({
        active: false,
        x: 0,
        y: -100,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        r: 1,
        g: 1,
        b: 1,
        size: 0,
        life: 0,
        maxLife: 1,
        drag: 0.96,
        gravity: 9.8,
      });
    }

    this.sparkGeom = new THREE.BufferGeometry();
    this.sparkGeom.setAttribute('position', new THREE.BufferAttribute(this.sparkPositions, 3));
    this.sparkGeom.setAttribute('color', new THREE.BufferAttribute(this.sparkColors, 3));
    this.sparkGeom.setAttribute('size', new THREE.BufferAttribute(this.sparkSizes, 1));
    this.disposables.push(this.sparkGeom);

    // Procedural soft-radial circular glow sprite
    this.sparkTexture = this.createGlowTexture();
    if (this.sparkTexture) {
      this.disposables.push(this.sparkTexture);
    }

    const matOptions: THREE.PointsMaterialParameters = {
      size: 0.35,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    };
    if (this.sparkTexture) {
      matOptions.map = this.sparkTexture;
    }
    this.sparkMat = new THREE.PointsMaterial(matOptions);
    this.disposables.push(this.sparkMat);

    this.sparkPoints = new THREE.Points(this.sparkGeom, this.sparkMat);
    this.scene.add(this.sparkPoints);

    // 2. Initialize Shockwaves Pool (Contact Rings & Floor Ripples)
    this.shockwaveGeomContact = new THREE.RingGeometry(0.12, 0.42, 36);
    this.shockwaveGeomFloor = new THREE.RingGeometry(0.2, 0.58, 36);
    this.disposables.push(this.shockwaveGeomContact, this.shockwaveGeomFloor);

    // Pool of 6 contact shockwaves + 6 floor ripples
    for (let i = 0; i < 6; i++) {
      // Contact ring (billboard/facing ring)
      const matContact = new THREE.MeshBasicMaterial({
        color: new THREE.Color('#38bdf8'),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      this.disposables.push(matContact);
      const meshContact = new THREE.Mesh(this.shockwaveGeomContact, matContact);
      meshContact.visible = false;
      this.scene.add(meshContact);
      this.shockwaves.push({
        active: false,
        mesh: meshContact,
        material: matContact,
        type: 'contact',
        time: 0,
        duration: 0.38,
        maxScale: 3.2,
        baseScale: 0.3,
      });

      // Floor ripple ring (flat on the arena canvas)
      const matFloor = new THREE.MeshBasicMaterial({
        color: new THREE.Color('#60a5fa'),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      this.disposables.push(matFloor);
      const meshFloor = new THREE.Mesh(this.shockwaveGeomFloor, matFloor);
      meshFloor.rotation.x = -Math.PI / 2;
      meshFloor.visible = false;
      this.scene.add(meshFloor);
      this.shockwaves.push({
        active: false,
        mesh: meshFloor,
        material: matFloor,
        type: 'floor',
        time: 0,
        duration: 0.45,
        maxScale: 4.5,
        baseScale: 0.4,
      });
    }

    // 3. Dynamic Impact Flash Point Light
    this.impactLight = new THREE.PointLight('#93c5fd', 0, 16, 2);
    this.scene.add(this.impactLight);
  }

  /**
   * Generates a circular radial glow texture in code without external assets.
   */
  private createGlowTexture(): THREE.Texture | null {
    if (typeof document === 'undefined') return null;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      grad.addColorStop(0.2, 'rgba(240, 249, 255, 0.95)');
      grad.addColorStop(0.45, 'rgba(56, 189, 248, 0.7)');
      grad.addColorStop(0.75, 'rgba(37, 99, 235, 0.3)');
      grad.addColorStop(1, 'rgba(2, 6, 23, 0)');

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 64);

      const texture = new THREE.CanvasTexture(canvas);
      texture.generateMipmaps = true;
      return texture;
    } catch {
      return null;
    }
  }

  /**
   * Triggers a visceral hit impact effect at world coordinates (x, y, z).
   */
  triggerImpact(x: number, y: number, z: number, options: ImpactOptions = {}) {
    const {
      isCrit = false,
      isBlocked = false,
      attackType = 'punch',
      attackerFacing = 1,
      speed = 1,
    } = options;

    // High simulation speed safeguard: throttle heavy particles when training
    const particleMultiplier = speed > 5 ? 0.3 : speed > 2 ? 0.6 : 1.0;

    // 1. Spawn Multi-Directional Kinetic Sparks
    let sparkCount = Math.round((isCrit ? 48 : isBlocked ? 24 : 32) * particleMultiplier);
    sparkCount = Math.max(8, sparkCount);

    let spawned = 0;
    const facingDir = attackerFacing >= 0 ? 1 : -1;

    for (let i = 0; i < this.maxSparks && spawned < sparkCount; i++) {
      const p = this.sparkPool[i];
      if (p.active) continue;

      p.active = true;
      p.x = x + (Math.random() - 0.5) * 0.3;
      p.y = y + (Math.random() - 0.5) * 0.4;
      p.z = z + (Math.random() - 0.5) * 0.4;

      // Directional cone: sparks burst outward primarily in the direction of the strike
      const coneAngle = (Math.random() - 0.5) * 1.2;
      const speedMagnitude = (isCrit ? 9.5 : 7.0) + Math.random() * 5.0;

      // Base directional vector
      p.vx = (facingDir * Math.cos(coneAngle) * speedMagnitude) + (Math.random() - 0.5) * 3;
      p.vy = Math.sin(coneAngle) * speedMagnitude * 0.8 + Math.random() * 4.5 + 1.2;
      p.vz = (Math.random() - 0.5) * 5.5;

      p.life = 0;
      p.maxLife = isCrit ? 0.42 + Math.random() * 0.18 : 0.28 + Math.random() * 0.15;
      p.drag = 0.94;
      p.gravity = 14.0;
      p.size = isCrit ? 0.42 : 0.28;

      // Palette: White & Cyber Blue Mixing with high-tech electric glow
      if (isBlocked) {
        // Hexagonal energy shield deflection: electric cyan and cobalt
        if (Math.random() < 0.6) {
          p.r = 0.22; p.g = 0.74; p.b = 0.97; // Cyan (#38bdf8)
        } else {
          p.r = 0.95; p.g = 0.98; p.b = 1.0;  // Pure white core
        }
        // Lateral scatter for shield deflection
        p.vx = (Math.random() - 0.5) * 8.0;
        p.vy = (Math.random() - 0.5) * 8.0 + 2.0;
      } else if (isCrit) {
        // Heavy Kick / Critical Strike: explosive white-hot flash and electric plasma
        const roll = Math.random();
        if (roll < 0.45) {
          p.r = 1.0; p.g = 1.0; p.b = 1.0;   // White-hot core
        } else if (roll < 0.75) {
          p.r = 0.38; p.g = 0.75; p.b = 1.0; // Sky blue plasma
        } else {
          p.r = 0.99; p.g = 0.94; p.b = 0.54; // Electric gold arc (#fef08a)
        }
      } else {
        // Standard Strike: cybernetic white and blue sparks
        if (Math.random() < 0.55) {
          p.r = 1.0; p.g = 1.0; p.b = 1.0;   // Pure white
        } else {
          p.r = 0.15; p.g = 0.39; p.b = 0.92; // Electric blue (#2563eb)
        }
      }

      spawned++;
    }

    // 2. Trigger 3D Impact Shockwaves (Contact + Floor Ripple)
    if (speed <= 5) {
      // Find inactive contact ring
      const contactWave = this.shockwaves.find((w) => !w.active && w.type === 'contact');
      if (contactWave) {
        contactWave.active = true;
        contactWave.time = 0;
        contactWave.mesh.visible = true;
        contactWave.mesh.position.set(x, y, z);
        contactWave.mesh.scale.set(contactWave.baseScale, contactWave.baseScale, contactWave.baseScale);

        // Orient shockwave facing the camera with slight impact slant
        contactWave.mesh.lookAt(this.camera.position);
        contactWave.mesh.rotateZ((Math.random() - 0.5) * 0.4);

        if (isBlocked) {
          contactWave.material.color.set('#00e5ff');
          contactWave.duration = 0.28;
          contactWave.maxScale = 2.4;
        } else if (isCrit) {
          contactWave.material.color.set('#ffffff');
          contactWave.duration = 0.44;
          contactWave.maxScale = 4.2;
        } else {
          contactWave.material.color.set('#38bdf8');
          contactWave.duration = 0.34;
          contactWave.maxScale = 3.0;
        }
        contactWave.material.opacity = 0.95;
      }

      // Find inactive floor ripple
      const floorWave = this.shockwaves.find((w) => !w.active && w.type === 'floor');
      if (floorWave) {
        floorWave.active = true;
        floorWave.time = 0;
        floorWave.mesh.visible = true;
        floorWave.mesh.position.set(x, 0.05, z);
        floorWave.mesh.scale.set(floorWave.baseScale, floorWave.baseScale, floorWave.baseScale);

        if (isCrit) {
          floorWave.material.color.set('#60a5fa');
          floorWave.duration = 0.52;
          floorWave.maxScale = 5.2;
        } else {
          floorWave.material.color.set('#2563eb');
          floorWave.duration = 0.38;
          floorWave.maxScale = 3.5;
        }
        floorWave.material.opacity = 0.85;
      }
    }

    // 3. Dynamic Contact Flash Light
    this.impactLight.position.set(x, y + 0.2, z + 0.5);
    if (isBlocked) {
      this.impactLight.color.set('#38bdf8');
      this.impactLightIntensity = 4.0;
    } else if (isCrit) {
      this.impactLight.color.set('#ffffff');
      this.impactLightIntensity = 6.5;
    } else {
      this.impactLight.color.set('#93c5fd');
      this.impactLightIntensity = 4.5;
    }
    this.impactLight.intensity = this.impactLightIntensity;

    // 4. Camera Micro-Trauma Shake
    const shakeImpulse = isCrit ? 0.42 : isBlocked ? 0.16 : attackType === 'kick' ? 0.32 : 0.22;
    this.trauma = Math.min(1.0, this.trauma + shakeImpulse);
  }

  /**
   * Updates particle physics, shockwaves, lighting decay, and camera shake.
   * Frame-rate independent with delta timing.
   */
  update(delta: number) {
    const posAttr = this.sparkGeom.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = this.sparkGeom.getAttribute('color') as THREE.BufferAttribute;

    let sparksNeedUpdate = false;

    // 1. Update Sparks
    for (let i = 0; i < this.maxSparks; i++) {
      const p = this.sparkPool[i];
      if (!p.active) continue;

      p.life += delta;
      if (p.life >= p.maxLife) {
        p.active = false;
        posAttr.setXYZ(i, 0, -100, 0);
        sparksNeedUpdate = true;
        continue;
      }

      // Physics integration
      p.vx *= Math.pow(p.drag, delta * 60);
      p.vz *= Math.pow(p.drag, delta * 60);
      p.vy -= p.gravity * delta;

      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.z += p.vz * delta;

      // Arena floor bounce (y = 0.05)
      if (p.y <= 0.05) {
        p.y = 0.05;
        p.vy = -p.vy * 0.42; // Inelastic rebound
        p.vx *= 0.75;
        p.vz *= 0.75;
      }

      // Fade color over lifetime
      const lifeRatio = 1.0 - p.life / p.maxLife;
      const alphaFactor = lifeRatio * lifeRatio; // quadratic fade

      posAttr.setXYZ(i, p.x, p.y, p.z);
      colAttr.setXYZ(i, p.r * alphaFactor, p.g * alphaFactor, p.b * alphaFactor);
      sparksNeedUpdate = true;
    }

    if (sparksNeedUpdate) {
      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
    }

    // 2. Update Shockwaves
    for (const wave of this.shockwaves) {
      if (!wave.active) continue;

      wave.time += delta;
      const progress = wave.time / wave.duration;

      if (progress >= 1.0) {
        wave.active = false;
        wave.mesh.visible = false;
        wave.material.opacity = 0;
        continue;
      }

      // Ease out cubic scale expansion
      const ease = 1 - Math.pow(1 - progress, 3);
      const currentScale = wave.baseScale + (wave.maxScale - wave.baseScale) * ease;
      wave.mesh.scale.set(currentScale, currentScale, currentScale);

      // Quadratic alpha fade-out
      const alpha = (1.0 - progress) * (1.0 - progress);
      wave.material.opacity = alpha * 0.9;

      // Subtle rotation for contact wave
      if (wave.type === 'contact') {
        wave.mesh.rotateZ(delta * 2.5);
      }
    }

    // 3. Update Impact Point Light Exponential Decay
    if (this.impactLightIntensity > 0.01) {
      this.impactLightIntensity *= Math.exp(-22 * delta);
      this.impactLight.intensity = this.impactLightIntensity;
    } else if (this.impactLight.intensity > 0) {
      this.impactLightIntensity = 0;
      this.impactLight.intensity = 0;
    }

    // 4. Update Camera Micro-Trauma Shake
    if (this.trauma > 0.005) {
      this.shakeTimer += delta;
      // Exponential trauma dissipation
      this.trauma = Math.max(0, this.trauma - delta * 3.6);

      // Non-linear camera displacement: Trauma squared creates crisp impact spikes
      const shakeAmount = this.trauma * this.trauma;
      const freq = 36;
      const offsetX = shakeAmount * Math.sin(this.shakeTimer * freq) * 0.22;
      const offsetY = shakeAmount * Math.cos(this.shakeTimer * (freq * 1.25)) * 0.16;
      const offsetZ = shakeAmount * Math.sin(this.shakeTimer * (freq * 0.8)) * 0.1;

      this.camera.position.set(
        this.baseCameraPos.x + offsetX,
        this.baseCameraPos.y + offsetY,
        this.baseCameraPos.z + offsetZ
      );
    } else if (
      this.camera.position.x !== this.baseCameraPos.x ||
      this.camera.position.y !== this.baseCameraPos.y ||
      this.camera.position.z !== this.baseCameraPos.z
    ) {
      this.camera.position.copy(this.baseCameraPos);
      this.trauma = 0;
    }
  }

  /**
   * Resets base camera position if window was resized.
   */
  setBaseCameraPosition(x: number, y: number, z: number) {
    this.baseCameraPos.set(x, y, z);
    this.camera.position.set(x, y, z);
  }

  /**
   * Cleanly disposes of all geometry, materials, textures, and lights.
   */
  dispose() {
    this.scene.remove(this.sparkPoints);
    this.scene.remove(this.impactLight);

    for (const wave of this.shockwaves) {
      this.scene.remove(wave.mesh);
    }

    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }
}
