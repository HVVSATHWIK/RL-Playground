import * as THREE from 'three';
import { type FighterState, ARENA_WIDTH, ARENA_DEPTH } from './fighter';

export interface Robot3DOptions {
  primaryColor: string; // e.g. '#ffffff' (White) or '#1e40af' (Blue)
  accentColor: string;  // e.g. '#ef4444' (Red Fighter) or '#2563eb' (Blue Fighter)
  emissiveColor: string;// e.g. '#ff3333' or '#38bdf8'
}

/**
 * Procedural Articulated 3D Humanoid Mecha Robot.
 * Composed of articulated limbs, PBR armor plating, metallic joints, and luminescent visors.
 * Employs frame-rate independent exponential damping for fluid, natural strike transitions.
 */
export class Robot3DModel {
  group: THREE.Group;
  options: Robot3DOptions;

  // Key joints and limbs for procedural animation
  torsoGroup: THREE.Group;
  chestMesh: THREE.Mesh;
  coreMesh: THREE.Mesh;
  headGroup: THREE.Group;
  visorMesh: THREE.Mesh;

  leftShoulder: THREE.Group;
  leftForearm: THREE.Group;
  leftFist: THREE.Mesh;

  rightShoulder: THREE.Group;
  rightForearm: THREE.Group;
  rightFist: THREE.Mesh;

  leftHip: THREE.Group;
  leftCalf: THREE.Group;
  leftFoot: THREE.Mesh;

  rightHip: THREE.Group;
  rightCalf: THREE.Group;
  rightFoot: THREE.Mesh;

  shieldRing: THREE.Mesh;

  // Cached materials and geometries for clean disposal
  materials: THREE.Material[] = [];
  geometries: THREE.BufferGeometry[] = [];
  armorMaterial: THREE.MeshStandardMaterial;
  accentMaterial: THREE.MeshStandardMaterial;
  jointMaterial: THREE.MeshStandardMaterial;
  emissiveMaterial: THREE.MeshStandardMaterial;
  shieldMaterial: THREE.MeshBasicMaterial;

  private time = 0;

  constructor(options: Robot3DOptions) {
    this.options = options;
    this.group = new THREE.Group();

    // 1. PBR Materials (Sleek White & Blue Cybernetic Palette)
    this.armorMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(options.primaryColor),
      metalness: 0.25,
      roughness: 0.35,
    });
    this.materials.push(this.armorMaterial);

    this.accentMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(options.accentColor),
      metalness: 0.45,
      roughness: 0.3,
    });
    this.materials.push(this.accentMaterial);

    this.jointMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#1e293b'),
      metalness: 0.85,
      roughness: 0.25,
    });
    this.materials.push(this.jointMaterial);

    this.emissiveMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(options.emissiveColor),
      emissive: new THREE.Color(options.emissiveColor),
      emissiveIntensity: 1.8,
      roughness: 0.2,
      metalness: 0.5,
    });
    this.materials.push(this.emissiveMaterial);

    this.shieldMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(options.emissiveColor),
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    this.materials.push(this.shieldMaterial);

    const trackGeom = <T extends THREE.BufferGeometry>(g: T): T => {
      this.geometries.push(g);
      return g;
    };

    // 2. Pelvis & Torso
    const pelvisGeom = trackGeom(new THREE.BoxGeometry(0.9, 0.45, 0.6));
    const pelvis = new THREE.Mesh(pelvisGeom, this.jointMaterial);
    pelvis.position.y = 2.1;
    pelvis.castShadow = true;
    this.group.add(pelvis);

    this.torsoGroup = new THREE.Group();
    this.torsoGroup.position.y = 2.3;
    this.group.add(this.torsoGroup);

    // 3. Chest Armor with Energy Core
    const chestGeom = trackGeom(new THREE.BoxGeometry(1.2, 1.0, 0.85));
    this.chestMesh = new THREE.Mesh(chestGeom, this.armorMaterial);
    this.chestMesh.position.y = 0.55;
    this.chestMesh.castShadow = true;
    this.chestMesh.receiveShadow = true;
    this.torsoGroup.add(this.chestMesh);

    // Chest energy core
    const coreGeom = trackGeom(new THREE.CylinderGeometry(0.18, 0.18, 0.12, 16));
    coreGeom.rotateX(Math.PI / 2);
    this.coreMesh = new THREE.Mesh(coreGeom, this.emissiveMaterial);
    this.coreMesh.position.set(0, 0.6, 0.44);
    this.torsoGroup.add(this.coreMesh);

    // Back power generator / thrusters
    const thrusterGeom = trackGeom(new THREE.BoxGeometry(0.8, 0.6, 0.3));
    const thruster = new THREE.Mesh(thrusterGeom, this.jointMaterial);
    thruster.position.set(0, 0.6, -0.5);
    this.torsoGroup.add(thruster);

    // 4. Head & Glowing Visor
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 1.25, 0);
    this.torsoGroup.add(this.headGroup);

    const headGeom = trackGeom(new THREE.BoxGeometry(0.55, 0.55, 0.6));
    const head = new THREE.Mesh(headGeom, this.armorMaterial);
    head.position.y = 0.15;
    head.castShadow = true;
    this.headGroup.add(head);

    // Angular helmet crest with team accent
    const crestGeom = trackGeom(new THREE.ConeGeometry(0.12, 0.4, 4));
    crestGeom.rotateX(Math.PI / 4);
    const crest = new THREE.Mesh(crestGeom, this.accentMaterial);
    crest.position.set(0, 0.5, -0.05);
    this.headGroup.add(crest);

    // Overhead Team Indicator Beacon (Floating glowing octahedron)
    const markerGeom = trackGeom(new THREE.OctahedronGeometry(0.18, 0));
    const markerMesh = new THREE.Mesh(markerGeom, this.emissiveMaterial);
    markerMesh.position.set(0, 0.95, 0);
    this.headGroup.add(markerMesh);

    // Glowing combat visor
    const visorGeom = trackGeom(new THREE.BoxGeometry(0.48, 0.14, 0.15));
    this.visorMesh = new THREE.Mesh(visorGeom, this.emissiveMaterial);
    this.visorMesh.position.set(0, 0.16, 0.28);
    this.headGroup.add(this.visorMesh);

    // 5. Left Arm (Shoulder -> Bicep -> Forearm -> Fist)
    this.leftShoulder = new THREE.Group();
    this.leftShoulder.position.set(0.75, 0.9, 0);
    this.torsoGroup.add(this.leftShoulder);

    const shoulderPadGeom = trackGeom(new THREE.BoxGeometry(0.4, 0.4, 0.45));
    const leftPad = new THREE.Mesh(shoulderPadGeom, this.accentMaterial);
    this.leftShoulder.add(leftPad);

    const bicepGeom = trackGeom(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 8));
    const leftBicep = new THREE.Mesh(bicepGeom, this.jointMaterial);
    leftBicep.position.y = -0.3;
    this.leftShoulder.add(leftBicep);

    this.leftForearm = new THREE.Group();
    this.leftForearm.position.set(0, -0.55, 0);
    this.leftShoulder.add(this.leftForearm);

    const forearmGeom = trackGeom(new THREE.BoxGeometry(0.3, 0.55, 0.32));
    const leftForearmMesh = new THREE.Mesh(forearmGeom, this.armorMaterial);
    leftForearmMesh.position.y = -0.25;
    this.leftForearm.add(leftForearmMesh);

    const fistGeom = trackGeom(new THREE.BoxGeometry(0.24, 0.26, 0.28));
    this.leftFist = new THREE.Mesh(fistGeom, this.jointMaterial);
    this.leftFist.position.y = -0.6;
    this.leftForearm.add(this.leftFist);

    // 6. Right Arm (Mirror)
    this.rightShoulder = new THREE.Group();
    this.rightShoulder.position.set(-0.75, 0.9, 0);
    this.torsoGroup.add(this.rightShoulder);

    const rightPad = new THREE.Mesh(shoulderPadGeom, this.accentMaterial);
    this.rightShoulder.add(rightPad);

    const rightBicep = new THREE.Mesh(bicepGeom, this.jointMaterial);
    rightBicep.position.y = -0.3;
    this.rightShoulder.add(rightBicep);

    this.rightForearm = new THREE.Group();
    this.rightForearm.position.set(0, -0.55, 0);
    this.rightShoulder.add(this.rightForearm);

    const rightForearmMesh = new THREE.Mesh(forearmGeom, this.armorMaterial);
    rightForearmMesh.position.y = -0.25;
    this.rightForearm.add(rightForearmMesh);

    this.rightFist = new THREE.Mesh(fistGeom, this.jointMaterial);
    this.rightFist.position.y = -0.6;
    this.rightForearm.add(this.rightFist);

    // 7. Left Leg (Hip -> Thigh -> Calf -> Foot)
    this.leftHip = new THREE.Group();
    this.leftHip.position.set(0.38, 2.0, 0);
    this.group.add(this.leftHip);

    const thighGeom = trackGeom(new THREE.CylinderGeometry(0.18, 0.16, 0.85, 10));
    const leftThigh = new THREE.Mesh(thighGeom, this.armorMaterial);
    leftThigh.position.y = -0.42;
    this.leftHip.add(leftThigh);

    this.leftCalf = new THREE.Group();
    this.leftCalf.position.set(0, -0.85, 0);
    this.leftHip.add(this.leftCalf);

    const calfGeom = trackGeom(new THREE.BoxGeometry(0.32, 0.9, 0.36));
    const leftCalfMesh = new THREE.Mesh(calfGeom, this.jointMaterial);
    leftCalfMesh.position.y = -0.45;
    this.leftCalf.add(leftCalfMesh);

    const footGeom = trackGeom(new THREE.BoxGeometry(0.34, 0.18, 0.6));
    this.leftFoot = new THREE.Mesh(footGeom, this.armorMaterial);
    this.leftFoot.position.set(0, -0.95, 0.12);
    this.leftCalf.add(this.leftFoot);

    // 8. Right Leg (Hip -> Thigh -> Calf -> Foot)
    this.rightHip = new THREE.Group();
    this.rightHip.position.set(-0.38, 2.0, 0);
    this.group.add(this.rightHip);

    const rightThigh = new THREE.Mesh(thighGeom, this.armorMaterial);
    rightThigh.position.y = -0.42;
    this.rightHip.add(rightThigh);

    this.rightCalf = new THREE.Group();
    this.rightCalf.position.set(0, -0.85, 0);
    this.rightHip.add(this.rightCalf);

    const rightCalfMesh = new THREE.Mesh(calfGeom, this.jointMaterial);
    rightCalfMesh.position.y = -0.45;
    this.rightCalf.add(rightCalfMesh);

    this.rightFoot = new THREE.Mesh(footGeom, this.armorMaterial);
    this.rightFoot.position.set(0, -0.95, 0.12);
    this.rightCalf.add(this.rightFoot);

    // 9. Defensive Hex Energy Shield Ring (Shown on block)
    const ringGeom = trackGeom(new THREE.RingGeometry(0.8, 1.3, 6));
    this.shieldRing = new THREE.Mesh(ringGeom, this.shieldMaterial);
    this.shieldRing.position.set(0, 2.9, 0.85);
    this.group.add(this.shieldRing);

    // Soft Contact Shadow Plane directly beneath robot feet
    const shadowGeom = trackGeom(new THREE.PlaneGeometry(1.8, 1.2));
    shadowGeom.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    this.materials.push(shadowMat);
    const shadowMesh = new THREE.Mesh(shadowGeom, shadowMat);
    shadowMesh.position.y = 0.02;
    this.group.add(shadowMesh);
  }

  /**
   * Smoothly updates 3D position, orientation, and limb kinematics using exponential damping.
   * Interpolation is purely visual and never mutates the underlying RL simulation state.
   */
  updatePose(fighter: FighterState, opponent: FighterState, delta: number) {
    this.time += delta * 6;

    // 1. Position mapping: Map 2D arena (0..800) to 3D world X coordinates (-10.5..+10.5)
    const targetX = ((fighter.x - ARENA_WIDTH / 2) / (ARENA_WIDTH / 2)) * 10.5;
    this.group.position.x = THREE.MathUtils.damp(this.group.position.x, targetX, 22, delta);

    // 2. 3D Depth (Z-axis) & Sidestepping Mechanics: Map fighter.z (-200..+200) to 3D world Z coordinates (-3.5..+3.5)
    const mappedZ = (fighter.z / (ARENA_DEPTH / 2)) * 3.5;
    let targetZ = mappedZ + (fighter.facing === 1 ? -0.2 : 0.2);

    if (fighter.animState === 'dodging') {
      targetZ += fighter.facing === 1 ? -0.8 : 0.8;
    } else if (fighter.animState === 'punching' || fighter.animState === 'kicking') {
      targetZ *= 0.8;
    }
    this.group.position.z = THREE.MathUtils.damp(this.group.position.z, targetZ, 16, delta);

    // 3. 3D Facing Orientation: Stable smooth Y-rotation towards opponent
    const oppX = ((opponent.x - ARENA_WIDTH / 2) / (ARENA_WIDTH / 2)) * 10.5;
    const dx = oppX - targetX;

    const baseFacingAngle = fighter.facing === 1 ? Math.PI / 2 : -Math.PI / 2;
    const targetRotY = Math.abs(dx) > 0.1 ? (dx > 0 ? Math.PI / 2 : -Math.PI / 2) : baseFacingAngle;
    this.group.rotation.y = THREE.MathUtils.damp(this.group.rotation.y, targetRotY, 20, delta);

    // 3. Hit Flash / Stun color modulation
    if (fighter.hitFlash > 0) {
      this.armorMaterial.emissive.setHex(0xffffff);
      this.armorMaterial.emissiveIntensity = 2.0;
    } else {
      this.armorMaterial.emissive.setHex(0x000000);
      this.armorMaterial.emissiveIntensity = 0.0;
    }

    const isMoving =
      fighter.lastAction === 'moveLeft' ||
      fighter.lastAction === 'moveRight';

    // 4. Target joint rotations based on current combat action
    const anim = fighter.animState;
    const breath = Math.sin(this.time) * 0.04;

    let targetLeadArmX = -0.55 + breath * 0.4;
    let targetLeadArmZ = -0.22;
    let targetLeadForearmX = -0.9;

    let targetRearArmX = -0.42 + breath * 0.3;
    let targetRearArmZ = 0.22;
    let targetRearForearmX = -1.0;

    let targetTorsoPosY = 2.3 + breath;
    let targetTorsoRotX = 0.06;
    let targetTorsoRotY = 0.08;
    let targetHeadRotX = -0.05;

    // Leg walking stride animation
    const walkCycle = Math.sin(this.time * 2.2);
    const stride = isMoving && anim === 'idle' ? walkCycle * 0.48 : 0;

    let targetLeadLegX = -0.18 + stride;
    let targetLeadLegZ = 0.08;
    let targetLeadCalfX = 0.22 + (stride !== 0 ? Math.max(0, -walkCycle * 0.4) : 0);

    let targetRearLegX = 0.14 - stride;
    const targetRearLegZ = -0.08;
    let targetRearCalfX = 0.1 + (stride !== 0 ? Math.max(0, walkCycle * 0.4) : 0);

    let targetGroupY = 0;
    let targetShieldOpacity = 0;

    if (isMoving && anim === 'idle') {
      targetTorsoPosY = 2.3 + Math.abs(walkCycle) * 0.06;
      targetLeadArmX = -0.55 - stride * 0.5;
      targetRearArmX = -0.42 + stride * 0.5;
    }

    if (anim === 'punching') {
      // Powerful straight punch: lead arm snaps forward horizontally
      targetLeadArmX = -Math.PI * 0.48;
      targetLeadArmZ = -0.1;
      targetLeadForearmX = -0.05;

      targetRearArmX = -0.3;
      targetRearArmZ = 0.4;
      targetRearForearmX = -1.2;

      targetTorsoRotY = 0.32;
      targetTorsoRotX = 0.08;
    } else if (anim === 'kicking') {
      // Dynamic martial-arts kick: lead leg extends high forward
      targetLeadLegX = -Math.PI * 0.44;
      targetLeadLegZ = 0.2;
      targetLeadCalfX = 0.08;

      targetRearLegX = 0.22;
      targetRearCalfX = 0.35;

      targetLeadArmX = 0.4;
      targetRearArmX = -0.5;

      targetTorsoRotX = -0.15;
    } else if (anim === 'blocking') {
      // Defensive guard: cross forearms firmly in front of chest
      targetLeadArmX = -0.9;
      targetLeadArmZ = -0.45;
      targetLeadForearmX = -1.15;

      targetRearArmX = -0.9;
      targetRearArmZ = 0.45;
      targetRearForearmX = -1.15;

      targetTorsoRotX = 0.12;
      targetShieldOpacity = 0.8;
      this.shieldRing.rotation.z += delta * 4;
    } else if (anim === 'dodging') {
      // Evasive backward lean & hop
      targetTorsoRotX = -0.35;
      targetLeadArmX = -0.2;
      targetRearArmX = -0.2;
      targetGroupY = 0.4;
    } else if (anim === 'stunned') {
      // Staggered backward, head drooped
      targetTorsoRotX = -0.28;
      targetHeadRotX = 0.38;
      targetLeadArmX = 0.25;
      targetRearArmX = 0.25;
      targetTorsoPosY = 2.15;
    }

    // 5. Apply smooth damping to all articulated joints (prevents snapping or stuck limbs)
    const dampRate = anim === 'idle' ? 14 : 26;

    this.leftShoulder.rotation.x = THREE.MathUtils.damp(this.leftShoulder.rotation.x, targetLeadArmX, dampRate, delta);
    this.leftShoulder.rotation.z = THREE.MathUtils.damp(this.leftShoulder.rotation.z, targetLeadArmZ, dampRate, delta);
    this.leftForearm.rotation.x = THREE.MathUtils.damp(this.leftForearm.rotation.x, targetLeadForearmX, dampRate, delta);

    this.rightShoulder.rotation.x = THREE.MathUtils.damp(this.rightShoulder.rotation.x, targetRearArmX, dampRate, delta);
    this.rightShoulder.rotation.z = THREE.MathUtils.damp(this.rightShoulder.rotation.z, targetRearArmZ, dampRate, delta);
    this.rightForearm.rotation.x = THREE.MathUtils.damp(this.rightForearm.rotation.x, targetRearForearmX, dampRate, delta);

    this.torsoGroup.position.y = THREE.MathUtils.damp(this.torsoGroup.position.y, targetTorsoPosY, dampRate, delta);
    this.torsoGroup.rotation.x = THREE.MathUtils.damp(this.torsoGroup.rotation.x, targetTorsoRotX, dampRate, delta);
    this.torsoGroup.rotation.y = THREE.MathUtils.damp(this.torsoGroup.rotation.y, targetTorsoRotY, dampRate, delta);
    this.headGroup.rotation.x = THREE.MathUtils.damp(this.headGroup.rotation.x, targetHeadRotX, dampRate, delta);

    this.leftHip.rotation.x = THREE.MathUtils.damp(this.leftHip.rotation.x, targetLeadLegX, dampRate, delta);
    this.leftHip.rotation.z = THREE.MathUtils.damp(this.leftHip.rotation.z, targetLeadLegZ, dampRate, delta);
    this.leftCalf.rotation.x = THREE.MathUtils.damp(this.leftCalf.rotation.x, targetLeadCalfX, dampRate, delta);

    this.rightHip.rotation.x = THREE.MathUtils.damp(this.rightHip.rotation.x, targetRearLegX, dampRate, delta);
    this.rightHip.rotation.z = THREE.MathUtils.damp(this.rightHip.rotation.z, targetRearLegZ, dampRate, delta);
    this.rightCalf.rotation.x = THREE.MathUtils.damp(this.rightCalf.rotation.x, targetRearCalfX, dampRate, delta);

    this.group.position.y = THREE.MathUtils.damp(this.group.position.y, targetGroupY, 18, delta);
    this.shieldMaterial.opacity = THREE.MathUtils.damp(this.shieldMaterial.opacity, targetShieldOpacity, 16, delta);
  }

  /**
   * Cleanly disposes of all geometries and materials to prevent WebGL memory leaks.
   */
  dispose() {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
  }
}
