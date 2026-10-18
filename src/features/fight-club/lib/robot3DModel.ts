import * as THREE from 'three';
import { type FighterState, ARENA_WIDTH, ARENA_DEPTH } from './fighter';

export interface Robot3DOptions {
  primaryColor: string;
  accentColor: string;
  emissiveColor: string;
}

export class Robot3DModel {
  group: THREE.Group;
  options: Robot3DOptions;

  pelvisGroup: THREE.Group;
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
  thrusterGlow: THREE.Mesh;
  shadowMesh: THREE.Mesh;

  materials: THREE.Material[] = [];
  geometries: THREE.BufferGeometry[] = [];
  armorMaterial: THREE.MeshStandardMaterial;
  accentMaterial: THREE.MeshStandardMaterial;
  jointMaterial: THREE.MeshStandardMaterial;
  emissiveMaterial: THREE.MeshStandardMaterial;
  shieldMaterial: THREE.MeshBasicMaterial;
  shadowMaterial: THREE.MeshBasicMaterial;

  private time = 0;

  constructor(options: Robot3DOptions) {
    this.options = options;
    this.group = new THREE.Group();

    this.armorMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(options.primaryColor),
      metalness: 0.35,
      roughness: 0.28,
    });
    this.materials.push(this.armorMaterial);

    this.accentMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(options.accentColor),
      metalness: 0.5,
      roughness: 0.25,
    });
    this.materials.push(this.accentMaterial);

    this.jointMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#1e293b'),
      metalness: 0.85,
      roughness: 0.22,
    });
    this.materials.push(this.jointMaterial);

    this.emissiveMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(options.emissiveColor),
      emissive: new THREE.Color(options.emissiveColor),
      emissiveIntensity: 2.0,
      roughness: 0.18,
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

    this.pelvisGroup = new THREE.Group();
    this.pelvisGroup.position.y = 2.05;
    this.group.add(this.pelvisGroup);

    const pelvisGeom = trackGeom(new THREE.BoxGeometry(0.92, 0.44, 0.62));
    const pelvis = new THREE.Mesh(pelvisGeom, this.jointMaterial);
    pelvis.castShadow = true;
    this.pelvisGroup.add(pelvis);

    const beltAccentGeom = trackGeom(new THREE.BoxGeometry(0.96, 0.14, 0.66));
    const beltAccent = new THREE.Mesh(beltAccentGeom, this.accentMaterial);
    beltAccent.position.y = 0.16;
    this.pelvisGroup.add(beltAccent);

    this.torsoGroup = new THREE.Group();
    this.torsoGroup.position.y = 0.25;
    this.pelvisGroup.add(this.torsoGroup);

    const spineGeom = trackGeom(new THREE.CylinderGeometry(0.28, 0.34, 0.4, 10));
    const spine = new THREE.Mesh(spineGeom, this.jointMaterial);
    spine.position.y = 0.12;
    this.torsoGroup.add(spine);

    const chestGeom = trackGeom(new THREE.BoxGeometry(1.24, 0.96, 0.84));
    this.chestMesh = new THREE.Mesh(chestGeom, this.armorMaterial);
    this.chestMesh.position.y = 0.62;
    this.chestMesh.castShadow = true;
    this.chestMesh.receiveShadow = true;
    this.torsoGroup.add(this.chestMesh);

    const breastplateGeom = trackGeom(new THREE.BoxGeometry(1.12, 0.48, 0.9));
    const breastplate = new THREE.Mesh(breastplateGeom, this.accentMaterial);
    breastplate.position.set(0, 0.72, 0.02);
    this.torsoGroup.add(breastplate);

    const coreGeom = trackGeom(new THREE.CylinderGeometry(0.2, 0.2, 0.14, 20));
    coreGeom.rotateX(Math.PI / 2);
    this.coreMesh = new THREE.Mesh(coreGeom, this.emissiveMaterial);
    this.coreMesh.position.set(0, 0.68, 0.45);
    this.torsoGroup.add(this.coreMesh);

    const thrusterGeom = trackGeom(new THREE.BoxGeometry(0.82, 0.62, 0.32));
    const thruster = new THREE.Mesh(thrusterGeom, this.jointMaterial);
    thruster.position.set(0, 0.64, -0.5);
    this.torsoGroup.add(thruster);

    const nozzleGlowGeom = trackGeom(new THREE.ConeGeometry(0.18, 0.45, 12));
    nozzleGlowGeom.rotateX(Math.PI / 2);
    this.thrusterGlow = new THREE.Mesh(nozzleGlowGeom, this.emissiveMaterial);
    this.thrusterGlow.position.set(0, 0.48, -0.72);
    this.thrusterGlow.scale.set(0.5, 0.5, 0.5);
    this.torsoGroup.add(this.thrusterGlow);

    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 1.25, 0);
    this.torsoGroup.add(this.headGroup);

    const headGeom = trackGeom(new THREE.BoxGeometry(0.56, 0.56, 0.62));
    const head = new THREE.Mesh(headGeom, this.armorMaterial);
    head.position.y = 0.16;
    head.castShadow = true;
    this.headGroup.add(head);

    const crestGeom = trackGeom(new THREE.ConeGeometry(0.13, 0.42, 4));
    crestGeom.rotateX(Math.PI / 4);
    const crest = new THREE.Mesh(crestGeom, this.accentMaterial);
    crest.position.set(0, 0.52, -0.05);
    this.headGroup.add(crest);

    const markerGeom = trackGeom(new THREE.OctahedronGeometry(0.16, 0));
    const markerMesh = new THREE.Mesh(markerGeom, this.emissiveMaterial);
    markerMesh.position.set(0, 0.92, 0);
    this.headGroup.add(markerMesh);

    const visorGeom = trackGeom(new THREE.BoxGeometry(0.5, 0.15, 0.16));
    this.visorMesh = new THREE.Mesh(visorGeom, this.emissiveMaterial);
    this.visorMesh.position.set(0, 0.18, 0.28);
    this.headGroup.add(this.visorMesh);

    this.leftShoulder = new THREE.Group();
    this.leftShoulder.position.set(0.78, 0.94, 0);
    this.torsoGroup.add(this.leftShoulder);

    const shoulderPadGeom = trackGeom(new THREE.BoxGeometry(0.42, 0.42, 0.48));
    const leftPad = new THREE.Mesh(shoulderPadGeom, this.accentMaterial);
    this.leftShoulder.add(leftPad);

    const bicepGeom = trackGeom(new THREE.CylinderGeometry(0.13, 0.12, 0.52, 10));
    const leftBicep = new THREE.Mesh(bicepGeom, this.jointMaterial);
    leftBicep.position.y = -0.3;
    this.leftShoulder.add(leftBicep);

    this.leftForearm = new THREE.Group();
    this.leftForearm.position.set(0, -0.56, 0);
    this.leftShoulder.add(this.leftForearm);

    const forearmGeom = trackGeom(new THREE.BoxGeometry(0.3, 0.56, 0.32));
    const leftForearmMesh = new THREE.Mesh(forearmGeom, this.armorMaterial);
    leftForearmMesh.position.y = -0.25;
    this.leftForearm.add(leftForearmMesh);

    const fistGeom = trackGeom(new THREE.BoxGeometry(0.28, 0.3, 0.32));
    this.leftFist = new THREE.Mesh(fistGeom, this.accentMaterial);
    this.leftFist.position.y = -0.6;
    this.leftForearm.add(this.leftFist);

    this.rightShoulder = new THREE.Group();
    this.rightShoulder.position.set(-0.78, 0.94, 0);
    this.torsoGroup.add(this.rightShoulder);

    const rightPad = new THREE.Mesh(shoulderPadGeom, this.accentMaterial);
    this.rightShoulder.add(rightPad);

    const rightBicep = new THREE.Mesh(bicepGeom, this.jointMaterial);
    rightBicep.position.y = -0.3;
    this.rightShoulder.add(rightBicep);

    this.rightForearm = new THREE.Group();
    this.rightForearm.position.set(0, -0.56, 0);
    this.rightShoulder.add(this.rightForearm);

    const rightForearmMesh = new THREE.Mesh(forearmGeom, this.armorMaterial);
    rightForearmMesh.position.y = -0.25;
    this.rightForearm.add(rightForearmMesh);

    this.rightFist = new THREE.Mesh(fistGeom, this.accentMaterial);
    this.rightFist.position.y = -0.6;
    this.rightForearm.add(this.rightFist);

    this.leftHip = new THREE.Group();
    this.leftHip.position.set(0.38, -0.05, 0);
    this.pelvisGroup.add(this.leftHip);

    const thighGeom = trackGeom(new THREE.CylinderGeometry(0.19, 0.16, 0.86, 12));
    const leftThigh = new THREE.Mesh(thighGeom, this.armorMaterial);
    leftThigh.position.y = -0.42;
    this.leftHip.add(leftThigh);

    this.leftCalf = new THREE.Group();
    this.leftCalf.position.set(0, -0.85, 0);
    this.leftHip.add(this.leftCalf);

    const calfGeom = trackGeom(new THREE.BoxGeometry(0.32, 0.9, 0.36));
    const leftCalfMesh = new THREE.Mesh(calfGeom, this.accentMaterial);
    leftCalfMesh.position.y = -0.45;
    this.leftCalf.add(leftCalfMesh);

    const footGeom = trackGeom(new THREE.BoxGeometry(0.36, 0.18, 0.62));
    this.leftFoot = new THREE.Mesh(footGeom, this.jointMaterial);
    this.leftFoot.position.set(0, -0.95, 0.12);
    this.leftCalf.add(this.leftFoot);

    this.rightHip = new THREE.Group();
    this.rightHip.position.set(-0.38, -0.05, 0);
    this.pelvisGroup.add(this.rightHip);

    const rightThigh = new THREE.Mesh(thighGeom, this.armorMaterial);
    rightThigh.position.y = -0.42;
    this.rightHip.add(rightThigh);

    this.rightCalf = new THREE.Group();
    this.rightCalf.position.set(0, -0.85, 0);
    this.rightHip.add(this.rightCalf);

    const rightCalfMesh = new THREE.Mesh(calfGeom, this.accentMaterial);
    rightCalfMesh.position.y = -0.45;
    this.rightCalf.add(rightCalfMesh);

    this.rightFoot = new THREE.Mesh(footGeom, this.jointMaterial);
    this.rightFoot.position.set(0, -0.95, 0.12);
    this.rightCalf.add(this.rightFoot);

    // Sleek compact forearm energy buckler (only visible during active block, never a giant cage!)
    const shieldGeom = trackGeom(new THREE.BoxGeometry(0.95, 0.85, 0.08));
    this.shieldRing = new THREE.Mesh(shieldGeom, this.shieldMaterial);
    this.shieldRing.position.set(0, 0.68, 0.68);
    this.torsoGroup.add(this.shieldRing);

    const shadowGeom = trackGeom(new THREE.CircleGeometry(0.95, 24));
    shadowGeom.rotateX(-Math.PI / 2);
    this.shadowMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    });
    this.materials.push(this.shadowMaterial);
    this.shadowMesh = new THREE.Mesh(shadowGeom, this.shadowMaterial);
    this.shadowMesh.position.y = 0.02;
    this.group.add(this.shadowMesh);
  }

  updatePose(fighter: FighterState, opponent: FighterState, delta: number) {
    this.time += delta * 6.5;

    const targetX = ((fighter.x - ARENA_WIDTH / 2) / (ARENA_WIDTH / 2)) * 10.5;
    this.group.position.x = THREE.MathUtils.damp(this.group.position.x, targetX, 24, delta);

    const mappedZ = (fighter.z / (ARENA_DEPTH / 2)) * 3.6;
    const laneOffset = fighter.facing === 1 ? -0.15 : 0.15;
    const targetZ = mappedZ + laneOffset;
    this.group.position.z = THREE.MathUtils.damp(this.group.position.z, targetZ, 18, delta);

    const physicsElevation = ((fighter.y || 0) / 40) * 1.35;

    const oppX = ((opponent.x - ARENA_WIDTH / 2) / (ARENA_WIDTH / 2)) * 10.5;
    const oppZ = (opponent.z / (ARENA_DEPTH / 2)) * 3.6;
    const dx = oppX - targetX;
    const dz = oppZ - targetZ;
    const targetRotY = Math.abs(dx) > 0.05 || Math.abs(dz) > 0.05
      ? Math.atan2(dx, dz)
      : fighter.facing === 1 ? Math.PI / 2 : -Math.PI / 2;
    this.group.rotation.y = THREE.MathUtils.damp(this.group.rotation.y, targetRotY, 20, delta);

    if (fighter.hitFlash > 0) {
      this.armorMaterial.emissive.setHex(0xffffff);
      this.armorMaterial.emissiveIntensity = 1.6;
      this.accentMaterial.emissive.setHex(0xffffff);
      this.accentMaterial.emissiveIntensity = 1.2;
    } else {
      this.armorMaterial.emissive.setHex(0x000000);
      this.armorMaterial.emissiveIntensity = 0.0;
      this.accentMaterial.emissive.setHex(0x000000);
      this.accentMaterial.emissiveIntensity = 0.0;
    }

    const isMoving = fighter.lastAction === 'moveLeft' || fighter.lastAction === 'moveRight';
    const anim = fighter.animState;
    const breath = Math.sin(this.time) * 0.04;

    let targetLeadArmX = -0.58 + breath * 0.4;
    let targetLeadArmZ = -0.22;
    let targetLeadForearmX = -0.95;

    let targetRearArmX = -0.45 + breath * 0.3;
    let targetRearArmZ = 0.22;
    let targetRearForearmX = -1.05;

    let targetPelvisY = 2.05 + breath * 0.5 + physicsElevation;
    let targetTorsoRotX = 0.06;
    let targetTorsoRotY = 0.1;
    let targetHeadRotX = -0.04;

    const walkCycle = Math.sin(this.time * 2.4);
    const stride = isMoving && anim === 'idle' ? walkCycle * 0.52 : 0;

    let targetLeadLegX = -0.18 + stride;
    let targetLeadLegZ = 0.08;
    let targetLeadCalfX = 0.22 + (stride !== 0 ? Math.max(0, -walkCycle * 0.42) : 0);

    let targetRearLegX = 0.15 - stride;
    const targetRearLegZ = -0.08;
    let targetRearCalfX = 0.12 + (stride !== 0 ? Math.max(0, walkCycle * 0.42) : 0);

    let targetShieldOpacity = 0;
    let targetThrusterScale = 0.4;

    if (isMoving && anim === 'idle') {
      targetPelvisY = 2.05 + Math.abs(walkCycle) * 0.08 + physicsElevation;
      targetLeadArmX = -0.58 - stride * 0.55;
      targetRearArmX = -0.45 + stride * 0.55;
    }

    if (anim === 'punching') {
      const useRearCross = (fighter.strikeHand || 0) === 1;
      if (!useRearCross) {
        targetLeadArmX = -Math.PI * 0.52;
        targetLeadArmZ = -0.06;
        targetLeadForearmX = -0.04;

        targetRearArmX = -0.3;
        targetRearArmZ = 0.38;
        targetRearForearmX = -1.25;
        targetTorsoRotY = 0.42;
      } else {
        targetRearArmX = -Math.PI * 0.54;
        targetRearArmZ = 0.06;
        targetRearForearmX = -0.04;

        targetLeadArmX = -0.35;
        targetLeadArmZ = -0.38;
        targetLeadForearmX = -1.25;
        targetTorsoRotY = -0.45;
      }
      targetTorsoRotX = 0.16;
      targetThrusterScale = 1.1;
    } else if (anim === 'kicking') {
      targetLeadLegX = -Math.PI * 0.5;
      targetLeadLegZ = 0.22;
      targetLeadCalfX = 0.04;

      targetRearLegX = 0.24;
      targetRearCalfX = 0.36;

      targetLeadArmX = 0.45;
      targetRearArmX = -0.65;

      targetTorsoRotX = -0.24;
      targetTorsoRotY = -0.28;
      targetThrusterScale = 1.25;
    } else if (anim === 'blocking') {
      targetLeadArmX = -1.05;
      targetLeadArmZ = -0.48;
      targetLeadForearmX = -1.25;

      targetRearArmX = -1.05;
      targetRearArmZ = 0.48;
      targetRearForearmX = -1.25;

      targetTorsoRotX = 0.12;
      targetShieldOpacity = 0.32;
    } else if (anim === 'dodging') {
      targetTorsoRotX = -0.32;
      targetLeadArmX = -0.15;
      targetRearArmX = -0.15;
      targetLeadLegX = -0.35;
      targetLeadCalfX = 0.55;
      targetRearLegX = 0.28;
      targetRearCalfX = 0.45;
      targetThrusterScale = 1.65;
    } else if (anim === 'stunned') {
      targetTorsoRotX = -0.34;
      targetHeadRotX = 0.44;
      targetLeadArmX = 0.3;
      targetRearArmX = 0.3;
      targetPelvisY = 1.92 + physicsElevation;
    }

    const dampRate = anim === 'idle' ? 16 : 30;

    this.leftShoulder.rotation.x = THREE.MathUtils.damp(this.leftShoulder.rotation.x, targetLeadArmX, dampRate, delta);
    this.leftShoulder.rotation.z = THREE.MathUtils.damp(this.leftShoulder.rotation.z, targetLeadArmZ, dampRate, delta);
    this.leftForearm.rotation.x = THREE.MathUtils.damp(this.leftForearm.rotation.x, targetLeadForearmX, dampRate, delta);

    this.rightShoulder.rotation.x = THREE.MathUtils.damp(this.rightShoulder.rotation.x, targetRearArmX, dampRate, delta);
    this.rightShoulder.rotation.z = THREE.MathUtils.damp(this.rightShoulder.rotation.z, targetRearArmZ, dampRate, delta);
    this.rightForearm.rotation.x = THREE.MathUtils.damp(this.rightForearm.rotation.x, targetRearForearmX, dampRate, delta);

    this.pelvisGroup.position.y = THREE.MathUtils.damp(this.pelvisGroup.position.y, targetPelvisY, dampRate, delta);
    this.torsoGroup.rotation.x = THREE.MathUtils.damp(this.torsoGroup.rotation.x, targetTorsoRotX, dampRate, delta);
    this.torsoGroup.rotation.y = THREE.MathUtils.damp(this.torsoGroup.rotation.y, targetTorsoRotY, dampRate, delta);
    this.headGroup.rotation.x = THREE.MathUtils.damp(this.headGroup.rotation.x, targetHeadRotX, dampRate, delta);

    this.leftHip.rotation.x = THREE.MathUtils.damp(this.leftHip.rotation.x, targetLeadLegX, dampRate, delta);
    this.leftHip.rotation.z = THREE.MathUtils.damp(this.leftHip.rotation.z, targetLeadLegZ, dampRate, delta);
    this.leftCalf.rotation.x = THREE.MathUtils.damp(this.leftCalf.rotation.x, targetLeadCalfX, dampRate, delta);

    this.rightHip.rotation.x = THREE.MathUtils.damp(this.rightHip.rotation.x, targetRearLegX, dampRate, delta);
    this.rightHip.rotation.z = THREE.MathUtils.damp(this.rightHip.rotation.z, targetRearLegZ, dampRate, delta);
    this.rightCalf.rotation.x = THREE.MathUtils.damp(this.rightCalf.rotation.x, targetRearCalfX, dampRate, delta);

    this.shieldMaterial.opacity = THREE.MathUtils.damp(this.shieldMaterial.opacity, targetShieldOpacity, 20, delta);
    const nextThruster = THREE.MathUtils.damp(this.thrusterGlow.scale.z, targetThrusterScale, 16, delta);
    this.thrusterGlow.scale.set(nextThruster * 0.6, nextThruster * 0.6, nextThruster);

    const shadowScale = Math.max(0.55, 1.0 - physicsElevation * 0.22);
    this.shadowMesh.scale.set(shadowScale, shadowScale, 1);
  }

  dispose() {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
  }
}
