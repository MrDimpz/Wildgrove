import * as THREE from 'three';
import type { AnimalVariant, SpeciesId } from '../types/game';
import type { ProceduralTextureSet } from './proceduralTextures';

export interface AnimatedAnimalRig {
  root: THREE.Group;
  species: SpeciesId;
  phaseOffset: number;
  basePos: THREE.Vector3;
  wanderRadius: number;
  happyTimer: number;
  // Articulated sub-parts
  bodyGroup?: THREE.Group;
  headGroup?: THREE.Group;
  tailGroup?: THREE.Group;
  leftArm?: THREE.Object3D;
  rightArm?: THREE.Object3D;
  butterflySwarm?: Array<{
    group: THREE.Group;
    leftWing: THREE.Object3D;
    rightWing: THREE.Object3D;
    orbitRadius: number;
    orbitSpeed: number;
    heightBase: number;
    phase: number;
  }>;
}

function mat(color: number, roughness = 0.78, metalness = 0.04): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function addShadow(mesh: THREE.Mesh, cast = true, receive = true): THREE.Mesh {
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

// 1. COMPOSITE RACCOON (10+ parts: body, belly, head, bandit mask, snout, nose, eyes, ears, 4 paws, 5-ring striped tail)
function buildRaccoonRig(variant: AnimalVariant): AnimatedAnimalRig {
  const isExotic = variant === 'exotic';
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const furMain = mat(isExotic ? 0xd999a8 : 0x767370, 0.85);
  const furBelly = mat(isExotic ? 0xfae6eb : 0xcbc6bd, 0.88);
  const furDark = mat(isExotic ? 0x4b2938 : 0x262423, 0.82);
  const noseMat = mat(0x1a1718, 0.25, 0.15);
  const eyeMat = mat(0x151515, 0.15, 0.2);

  // Primary silhouette: plump rounded torso
  const torso = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 12), furMain));
  torso.scale.set(0.95, 0.82, 1.32);
  torso.position.set(0, 0.42, 0);
  bodyGroup.add(torso);

  // Cream chest / belly
  const belly = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), furBelly));
  belly.scale.set(0.86, 0.72, 1.15);
  belly.position.set(0, 0.36, 0.04);
  bodyGroup.add(belly);

  // 4 stubby legs & dark paws
  const legPositions: [number, number][] = [
    [-0.2, 0.26],
    [0.2, 0.26],
    [-0.2, -0.24],
    [0.2, -0.24],
  ];
  const legGeo = new THREE.CylinderGeometry(0.08, 0.065, 0.28, 10);
  const pawGeo = new THREE.SphereGeometry(0.075, 10, 8);
  legPositions.forEach(([lx, lz]) => {
    const leg = addShadow(new THREE.Mesh(legGeo, furMain));
    leg.position.set(lx, 0.17, lz);
    bodyGroup.add(leg);
    const paw = addShadow(new THREE.Mesh(pawGeo, furDark));
    paw.scale.set(1, 0.65, 1.25);
    paw.position.set(lx, 0.05, lz + 0.03);
    bodyGroup.add(paw);
  });

  // Head assembly
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.56, 0.42);
  bodyGroup.add(headGroup);

  const cranium = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12), furMain));
  cranium.scale.set(1.08, 0.92, 0.96);
  headGroup.add(cranium);

  // Signature Bandit Mask
  const mask = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.13, 0.14), furDark));
  mask.position.set(0, 0.02, 0.15);
  headGroup.add(mask);

  // Pointed snout + glossy nose button
  const snout = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.24, 12), furBelly));
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, -0.05, 0.26);
  headGroup.add(snout);

  const nose = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), noseMat));
  nose.position.set(0, -0.04, 0.37);
  headGroup.add(nose);

  // Glossy eyes
  [-0.1, 0.1].forEach((ex) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.034, 8, 8), eyeMat);
    eye.position.set(ex, 0.04, 0.22);
    headGroup.add(eye);
  });

  // Pointed ears with pale inner trim
  [-0.17, 0.17].forEach((ex) => {
    const ear = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.17, 8), furMain));
    ear.position.set(ex, 0.22, -0.02);
    ear.rotation.z = ex < 0 ? 0.26 : -0.26;
    headGroup.add(ear);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.11, 8), furBelly);
    inner.position.set(ex, 0.21, 0.02);
    inner.rotation.z = ex < 0 ? 0.26 : -0.26;
    headGroup.add(inner);
  });

  // Striped bushy tail (5 alternating rings)
  const tailGroup = new THREE.Group();
  tailGroup.position.set(0, 0.4, -0.44);
  bodyGroup.add(tailGroup);
  for (let i = 0; i < 5; i++) {
    const r = 0.125 - Math.abs(i - 2) * 0.015;
    const seg = addShadow(
      new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), i % 2 === 0 ? furDark : furBelly),
    );
    seg.scale.set(1, 0.92, 1.25);
    seg.position.set(0, 0.04 + i * 0.045, -i * 0.13);
    tailGroup.add(seg);
  }

  return {
    root,
    species: 'raccoon',
    phaseOffset: Math.random() * Math.PI * 2,
    basePos: new THREE.Vector3(0, 0, 0),
    wanderRadius: 0.72,
    happyTimer: 0,
    bodyGroup,
    headGroup,
    tailGroup,
  };
}

// 2. COMPOSITE GORILLA (broad silverback/golden shoulders, sculpted brow ridge, muscular knuckle arms, stocky legs)
function buildGorillaRig(variant: AnimalVariant): AnimatedAnimalRig {
  const isExotic = variant === 'exotic';
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const coatDark = mat(isExotic ? 0x453528 : 0x2d3136, 0.86);
  const saddleMat = mat(isExotic ? 0xd9a84e : 0xa5adb6, 0.74);
  const faceMat = mat(isExotic ? 0x3a2a1e : 0x22252a, 0.45, 0.08);
  const eyeMat = mat(0x111111, 0.12, 0.25);

  // Broad torso leaning gently forward
  const torso = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.46, 16, 12), coatDark));
  torso.scale.set(1.16, 1.05, 0.98);
  torso.position.set(0, 0.64, 0);
  bodyGroup.add(torso);

  // Iconic Silverback / Golden Mantle
  const saddle = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.41, 14, 10), saddleMat));
  saddle.scale.set(1.12, 0.86, 0.82);
  saddle.position.set(0, 0.74, -0.14);
  bodyGroup.add(saddle);

  // Pectoral chest plate
  const chest = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), faceMat));
  chest.scale.set(1.1, 0.88, 0.6);
  chest.position.set(0, 0.65, 0.3);
  bodyGroup.add(chest);

  // Muscular arms (pivoted at shoulders for gentle sway & chest-pat animation)
  const buildArm = (side: -1 | 1) => {
    const armGroup = new THREE.Group();
    armGroup.position.set(side * 0.54, 0.82, 0.14);
    const upper = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.36, 8, 12), coatDark));
    upper.position.set(0, -0.24, 0.04);
    upper.rotation.z = side * -0.12;
    armGroup.add(upper);
    const fore = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.34, 8, 12), coatDark));
    fore.position.set(side * 0.04, -0.58, 0.12);
    armGroup.add(fore);
    const hand = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), faceMat));
    hand.scale.set(1, 0.68, 1.2);
    hand.position.set(side * 0.04, -0.78, 0.15);
    armGroup.add(hand);
    bodyGroup.add(armGroup);
    return armGroup;
  };
  const leftArm = buildArm(-1);
  const rightArm = buildArm(1);

  // Stocky hind legs
  [-0.26, 0.26].forEach((lx) => {
    const leg = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.24, 8, 10), coatDark));
    leg.position.set(lx, 0.24, -0.2);
    bodyGroup.add(leg);
    const foot = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), faceMat));
    foot.scale.set(1, 0.58, 1.3);
    foot.position.set(lx, 0.07, -0.14);
    bodyGroup.add(foot);
  });

  // Sculpted head with sagittal crest & brow ridge
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.12, 0.28);
  bodyGroup.add(headGroup);

  const skull = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.27, 14, 12), coatDark));
  skull.scale.set(0.96, 1.06, 0.98);
  headGroup.add(skull);

  const crest = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), isExotic ? saddleMat : coatDark));
  crest.scale.set(0.8, 0.95, 0.9);
  crest.position.set(0, 0.19, -0.04);
  headGroup.add(crest);

  const brow = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.09, 0.16), faceMat));
  brow.position.set(0, 0.06, 0.2);
  headGroup.add(brow);

  const muzzle = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), faceMat));
  muzzle.scale.set(1.12, 0.85, 0.95);
  muzzle.position.set(0, -0.07, 0.21);
  headGroup.add(muzzle);

  [-0.085, 0.085].forEach((ex) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), eyeMat);
    eye.position.set(ex, 0.02, 0.26);
    headGroup.add(eye);
  });

  [-0.25, 0.25].forEach((ex) => {
    const ear = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), faceMat));
    ear.position.set(ex, 0.02, 0);
    headGroup.add(ear);
  });

  return {
    root,
    species: 'gorilla',
    phaseOffset: Math.random() * Math.PI * 2,
    basePos: new THREE.Vector3(0, 0, 0),
    wanderRadius: 0.56,
    happyTimer: 0,
    bodyGroup,
    headGroup,
    leftArm,
    rightArm,
  };
}

// 3. COMPOSITE BUTTERFLY SWARM (3 fluttering 6-part butterflies with procedural painted wings)
function buildButterflyRig(variant: AnimalVariant, textures: ProceduralTextureSet): AnimatedAnimalRig {
  const root = new THREE.Group();
  const isExotic = variant === 'exotic';
  const wingTex = isExotic ? textures.butterflyWingExotic : textures.butterflyWingClassic;

  const wingMat = new THREE.MeshStandardMaterial({
    map: wingTex,
    transparent: true,
    alphaTest: 0.25,
    side: THREE.DoubleSide,
    roughness: isExotic ? 0.25 : 0.42,
    metalness: isExotic ? 0.35 : 0.08,
    emissive: new THREE.Color(isExotic ? 0x104070 : 0x3b1a00),
    emissiveIntensity: 0.22,
  });
  const bodyMat = mat(0x231d1b, 0.45);

  const swarm: AnimatedAnimalRig['butterflySwarm'] = [];
  const configs = [
    { scale: 1.0, radius: 0.72, speed: 1.15, height: 1.25, phase: 0 },
    { scale: 0.84, radius: 0.52, speed: -1.45, height: 1.55, phase: 2.1 },
    { scale: 0.76, radius: 0.85, speed: 0.92, height: 1.05, phase: 4.2 },
  ];

  const wingGeo = new THREE.PlaneGeometry(0.46, 0.46);
  // Shift wing plane so left edge sits on the hinge axis x = 0
  wingGeo.translate(0.23, 0, 0);

  for (const cfg of configs) {
    const bGroup = new THREE.Group();
    bGroup.scale.setScalar(cfg.scale);

    // Thorax & Abdomen
    const thorax = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 0.16, 6, 8), bodyMat);
    thorax.rotation.x = Math.PI / 2;
    bGroup.add(thorax);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 8), bodyMat);
    head.position.set(0, 0.01, 0.12);
    bGroup.add(head);

    // Delicate antennae
    [-1, 1].forEach((side) => {
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.14, 5), bodyMat);
      ant.position.set(side * 0.035, 0.06, 0.18);
      ant.rotation.x = 0.65;
      ant.rotation.z = side * -0.35;
      bGroup.add(ant);
    });

    // Right Wing Pivot
    const rightWing = new THREE.Group();
    const rMesh = new THREE.Mesh(wingGeo, wingMat);
    rMesh.rotation.x = -Math.PI / 2;
    rMesh.castShadow = true;
    rightWing.add(rMesh);
    bGroup.add(rightWing);

    // Left Wing Pivot (mirrored)
    const leftWing = new THREE.Group();
    const lMesh = new THREE.Mesh(wingGeo, wingMat);
    lMesh.rotation.x = -Math.PI / 2;
    lMesh.scale.x = -1;
    lMesh.castShadow = true;
    leftWing.add(lMesh);
    bGroup.add(leftWing);

    root.add(bGroup);
    swarm.push({
      group: bGroup,
      leftWing,
      rightWing,
      orbitRadius: cfg.radius,
      orbitSpeed: cfg.speed,
      heightBase: cfg.height,
      phase: cfg.phase,
    });
  }

  return {
    root,
    species: 'butterfly',
    phaseOffset: Math.random() * Math.PI * 2,
    basePos: new THREE.Vector3(0, 0, 0),
    wanderRadius: 0,
    happyTimer: 0,
    butterflySwarm: swarm,
  };
}

// 4. COMPOSITE WOLF (lithe torso, fluffy winter ruff, sculpted angular snout, erect ears, 4 articulated legs, plumed tail)
function buildWolfRig(variant: AnimalVariant): AnimatedAnimalRig {
  const isExotic = variant === 'exotic';
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const furMain = mat(isExotic ? 0xdbe7f4 : 0x767f87, 0.82);
  const furBack = mat(isExotic ? 0x99b9d9 : 0x4b535c, 0.85);
  const furCream = mat(isExotic ? 0xf6fbff : 0xdad7cf, 0.88);
  const noseMat = mat(0x1b1e22, 0.25, 0.18);
  const eyeMat = mat(isExotic ? 0x3ec5ff : 0xe3a02c, 0.2, 0.15);

  // Sleek torso + darker dorsal back
  const torso = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.56, 10, 14), furMain));
  torso.rotation.x = Math.PI / 2;
  torso.position.set(0, 0.56, 0);
  bodyGroup.add(torso);

  const dorsal = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), furBack));
  dorsal.scale.set(0.95, 0.65, 1.55);
  dorsal.position.set(0, 0.67, -0.02);
  bodyGroup.add(dorsal);

  // Thick shoulder ruff / mane
  const ruff = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.29, 12, 10), furCream));
  ruff.scale.set(1.02, 1.05, 0.85);
  ruff.position.set(0, 0.66, 0.3);
  bodyGroup.add(ruff);

  // 4 slender wolf legs
  const legs: [number, number][] = [
    [-0.16, 0.29],
    [0.16, 0.29],
    [-0.16, -0.28],
    [0.16, -0.28],
  ];
  const legGeo = new THREE.CylinderGeometry(0.065, 0.05, 0.48, 8);
  const pawGeo = new THREE.SphereGeometry(0.065, 8, 8);
  legs.forEach(([lx, lz]) => {
    const leg = addShadow(new THREE.Mesh(legGeo, furMain));
    leg.position.set(lx, 0.26, lz);
    bodyGroup.add(leg);
    const paw = addShadow(new THREE.Mesh(pawGeo, furCream));
    paw.scale.set(1, 0.55, 1.35);
    paw.position.set(lx, 0.04, lz + 0.03);
    bodyGroup.add(paw);
  });

  // Wolf Head
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.88, 0.45);
  bodyGroup.add(headGroup);

  const cranium = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 12), furMain));
  cranium.scale.set(0.98, 0.94, 1.12);
  headGroup.add(cranium);

  const cheekLeft = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.16, 6), furCream));
  cheekLeft.position.set(-0.17, -0.04, 0.04);
  cheekLeft.rotation.z = Math.PI / 2;
  headGroup.add(cheekLeft);

  const cheekRight = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.16, 6), furCream));
  cheekRight.position.set(0.17, -0.04, 0.04);
  cheekRight.rotation.z = -Math.PI / 2;
  headGroup.add(cheekRight);

  const snout = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.12, 0.28), furCream));
  snout.position.set(0, -0.05, 0.22);
  headGroup.add(snout);

  const nose = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 8), noseMat));
  nose.position.set(0, -0.02, 0.36);
  headGroup.add(nose);

  [-0.08, 0.08].forEach((ex) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), eyeMat);
    eye.position.set(ex, 0.04, 0.17);
    headGroup.add(eye);
  });

  // Erect pointed wolf ears
  [-0.12, 0.12].forEach((ex) => {
    const ear = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.2, 8), furBack));
    ear.position.set(ex, 0.22, -0.02);
    ear.rotation.z = ex < 0 ? 0.16 : -0.16;
    headGroup.add(ear);
  });

  // Plumed tail
  const tailGroup = new THREE.Group();
  tailGroup.position.set(0, 0.56, -0.44);
  bodyGroup.add(tailGroup);
  const tail = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.38, 8, 10), furBack));
  tail.position.set(0, -0.04, -0.22);
  tail.rotation.x = 1.05;
  tailGroup.add(tail);
  const tailTip = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), furCream));
  tailTip.position.set(0, -0.12, -0.42);
  tailGroup.add(tailTip);

  return {
    root,
    species: 'wolf',
    phaseOffset: Math.random() * Math.PI * 2,
    basePos: new THREE.Vector3(0, 0, 0),
    wanderRadius: 0.78,
    happyTimer: 0,
    bodyGroup,
    headGroup,
    tailGroup,
  };
}

function buildRedPandaRig(variant: AnimalVariant): AnimatedAnimalRig {
  const rig = buildRaccoonRig(variant);
  const isExotic = variant === 'exotic';
  rig.species = 'red_panda';
  const mainHex = isExotic ? 0xf59f32 : 0xc44522;
  const darkHex = isExotic ? 0x6b3214 : 0x2c1b15;
  const creamHex = 0xfaf2e4;

  let meshIdx = 0;
  rig.root.traverse((obj) => {
    if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshStandardMaterial) {
      const c = obj.material.color.getHex();
      if (c === 0x767370 || c === 0xd999a8) {
        obj.material = mat(mainHex, 0.84);
      } else if (c === 0xcbc6bd || c === 0xfae6eb) {
        obj.material = mat(creamHex, 0.88);
      } else if (c === 0x262423 || c === 0x4b2938) {
        obj.material = mat(meshIdx % 2 === 0 ? darkHex : mainHex, 0.82);
      }
      meshIdx++;
    }
  });
  rig.root.scale.set(0.95, 0.95, 1.04);
  return rig;
}

function buildRiverOtterRig(variant: AnimalVariant): AnimatedAnimalRig {
  const rig = buildRaccoonRig(variant);
  const isExotic = variant === 'exotic';
  rig.species = 'river_otter';
  const mainHex = isExotic ? 0x86afc7 : 0x705744;
  const bellyHex = isExotic ? 0xdeedf7 : 0xd7c5b2;
  const darkHex = isExotic ? 0x4c6e85 : 0x453428;

  rig.root.traverse((obj) => {
    if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshStandardMaterial) {
      const c = obj.material.color.getHex();
      if (c === 0x767370 || c === 0xd999a8) {
        obj.material = mat(mainHex, 0.55, 0.08);
      } else if (c === 0xcbc6bd || c === 0xfae6eb) {
        obj.material = mat(bellyHex, 0.65, 0.05);
      } else if (c === 0x262423 || c === 0x4b2938) {
        obj.material = mat(darkHex, 0.6, 0.06);
      }
    }
  });
  rig.root.scale.set(0.88, 0.78, 1.24);
  return rig;
}

function buildGoldenFoxRig(variant: AnimalVariant): AnimatedAnimalRig {
  const rig = buildWolfRig(variant);
  const isExotic = variant === 'exotic';
  rig.species = 'golden_fox';
  const mainHex = isExotic ? 0xf6c544 : 0xd66d22;
  const backHex = isExotic ? 0xd4961f : 0xa34714;
  const creamHex = 0xfdf6e8;

  rig.root.traverse((obj) => {
    if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshStandardMaterial) {
      const c = obj.material.color.getHex();
      if (c === 0x767f87 || c === 0xdbe7f4) {
        obj.material = mat(mainHex, 0.8);
      } else if (c === 0x4b535c || c === 0x99b9d9) {
        obj.material = mat(backHex, 0.84);
      } else if (c === 0xdad7cf || c === 0xf6fbff) {
        obj.material = mat(creamHex, 0.88);
      }
    }
  });
  rig.root.scale.set(0.86, 0.84, 0.92);
  return rig;
}

function buildSnowLeopardRig(variant: AnimalVariant): AnimatedAnimalRig {
  const rig = buildWolfRig(variant);
  const isExotic = variant === 'exotic';
  rig.species = 'snow_leopard';
  const mainHex = isExotic ? 0xe5f2fc : 0xc2ccd6;
  const spotHex = isExotic ? 0x7ea7cc : 0x5d6a78;
  const creamHex = 0xf7fbff;

  rig.root.traverse((obj) => {
    if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshStandardMaterial) {
      const c = obj.material.color.getHex();
      if (c === 0x767f87 || c === 0xdbe7f4) {
        obj.material = mat(mainHex, 0.78);
      } else if (c === 0x4b535c || c === 0x99b9d9) {
        obj.material = mat(spotHex, 0.82);
      } else if (c === 0xdad7cf || c === 0xf6fbff) {
        obj.material = mat(creamHex, 0.86);
      }
    }
  });
  rig.root.scale.set(1.04, 0.96, 1.08);
  return rig;
}

export function createAnimalRig(
  species: SpeciesId,
  variant: AnimalVariant,
  textures: ProceduralTextureSet,
): AnimatedAnimalRig {
  switch (species) {
    case 'raccoon':
      return buildRaccoonRig(variant);
    case 'gorilla':
      return buildGorillaRig(variant);
    case 'butterfly':
      return buildButterflyRig(variant, textures);
    case 'wolf':
      return buildWolfRig(variant);
    case 'red_panda':
      return buildRedPandaRig(variant);
    case 'river_otter':
      return buildRiverOtterRig(variant);
    case 'golden_fox':
      return buildGoldenFoxRig(variant);
    case 'snow_leopard':
      return buildSnowLeopardRig(variant);
    default:
      return buildRaccoonRig(variant);
  }
}

export function animateAnimalRig(rig: AnimatedAnimalRig, elapsed: number, dt: number): void {
  const t = elapsed + rig.phaseOffset;

  if (rig.happyTimer > 0) {
    rig.happyTimer = Math.max(0, rig.happyTimer - dt);
  }

  if (rig.species === 'butterfly' && rig.butterflySwarm) {
    const boost = rig.happyTimer > 0 ? 1.85 : 1.0;
    for (const b of rig.butterflySwarm) {
      const ang = elapsed * b.orbitSpeed * boost + b.phase;
      const x = Math.cos(ang) * b.orbitRadius;
      const z = Math.sin(ang * 1.4) * b.orbitRadius * 0.75;
      const y = b.heightBase + Math.sin(elapsed * 2.8 + b.phase) * 0.22;

      const nextAng = ang + 0.05 * Math.sign(b.orbitSpeed);
      const nx = Math.cos(nextAng) * b.orbitRadius;
      const nz = Math.sin(nextAng * 1.4) * b.orbitRadius * 0.75;

      b.group.position.set(x, y, z);
      b.group.rotation.y = Math.atan2(nx - x, nz - z);

      const flap = Math.sin(elapsed * 13.5 * boost + b.phase) * 0.85;
      b.rightWing.rotation.z = flap;
      b.leftWing.rotation.z = -flap;
    }
    return;
  }

  // Gentle cozy figure-8 wandering inside the enclosure
  const wanderSpeed = rig.species === 'gorilla' ? 0.36 : 0.52;
  const wx = Math.sin(t * wanderSpeed) * rig.wanderRadius;
  const wz = Math.sin(t * wanderSpeed * 0.65) * rig.wanderRadius * 0.65;

  const prevX = rig.root.position.x;
  const prevZ = rig.root.position.z;
  rig.root.position.x = THREE.MathUtils.damp(prevX, wx, 2.2, dt);
  rig.root.position.z = THREE.MathUtils.damp(prevZ, wz, 2.2, dt);

  const dx = rig.root.position.x - prevX;
  const dz = rig.root.position.z - prevZ;
  if (dx * dx + dz * dz > 0.000004) {
    const targetRot = Math.atan2(dx, dz);
    let diff = targetRot - rig.root.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    rig.root.rotation.y += diff * Math.min(1, dt * 4.5);
  }

  // Happy hop + lively breathing/bobbing
  const hop = rig.happyTimer > 0 ? Math.abs(Math.sin(elapsed * 11)) * 0.42 : 0;
  const walkBob = Math.abs(Math.sin(t * 4.2)) * 0.04;
  if (rig.bodyGroup) {
    rig.bodyGroup.position.y = hop + walkBob;
    const stretch = rig.happyTimer > 0 ? 1 + Math.sin(elapsed * 11) * 0.08 : 1;
    rig.bodyGroup.scale.set(1 / Math.sqrt(stretch), stretch, 1 / Math.sqrt(stretch));
  }

  if (rig.headGroup) {
    rig.headGroup.rotation.y = Math.sin(t * 1.4) * 0.22;
    rig.headGroup.rotation.x = Math.sin(t * 2.1) * 0.08 - (rig.happyTimer > 0 ? 0.18 : 0);
  }

  if (rig.tailGroup) {
    const wagSpeed = rig.happyTimer > 0 ? 14 : 4.2;
    rig.tailGroup.rotation.y = Math.sin(t * wagSpeed) * (rig.happyTimer > 0 ? 0.55 : 0.25);
  }

  if (rig.leftArm && rig.rightArm) {
    if (rig.happyTimer > 0) {
      // Playful gorilla happy wave/pat
      rig.leftArm.rotation.x = -0.7 + Math.sin(elapsed * 12) * 0.45;
      rig.rightArm.rotation.x = -0.7 - Math.sin(elapsed * 12) * 0.45;
    } else {
      rig.leftArm.rotation.x = Math.sin(t * 2.2) * 0.14;
      rig.rightArm.rotation.x = -Math.sin(t * 2.2) * 0.14;
    }
  }
}
