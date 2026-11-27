import * as THREE from 'three';
import type { AnimalVariant, SpeciesId } from '../types/game';
import type { ProceduralTextureSet } from './proceduralTextures';
import { addInkOutline, toonMat } from './cartoonStyle';

export interface AnimatedAnimalRig {
  root: THREE.Group;
  species: SpeciesId;
  phaseOffset: number;
  basePos: THREE.Vector3;
  wanderRadius: number;
  happyTimer: number;
  blinkTimer: number;
  // Articulated sub-parts
  bodyGroup?: THREE.Group;
  headGroup?: THREE.Group;
  tailGroup?: THREE.Group;
  leftArm?: THREE.Object3D;
  rightArm?: THREE.Object3D;
  eyeGroups?: THREE.Object3D[];
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

const WHITE_SPARKLE_MAT = new THREE.MeshBasicMaterial({ color: 0xffffff });
const GLOSSY_PUPIL_MAT = new THREE.MeshBasicMaterial({ color: 0x1a1412 });

function addShadow(mesh: THREE.Mesh, cast = true, receive = true): THREE.Mesh {
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

interface CartoonEyesOptions {
  xSpread: number;
  y: number;
  z: number;
  radius: number;
  irisColor?: number;
  blushColor?: number;
  blushOffsetY?: number;
  blushOffsetX?: number;
  blushOffsetZ?: number;
  blushScale?: number;
}

/**
 * Adds big expressive glossy cartoon eyes with twin white specular catchlight sparkles
 * and soft rosy cheek blushes. Returns the eye pivot groups for periodic blinking.
 */
function addCartoonEyes(headGroup: THREE.Group, opts: CartoonEyesOptions): THREE.Object3D[] {
  const eyeGroups: THREE.Object3D[] = [];
  const irisMat = opts.irisColor
    ? new THREE.MeshBasicMaterial({ color: opts.irisColor })
    : null;
  const blushMat = opts.blushColor
    ? toonMat(opts.blushColor, { emissive: opts.blushColor, emissiveIntensity: 0.14 })
    : null;

  for (const side of [-1, 1]) {
    const eyePivot = new THREE.Group();
    eyePivot.position.set(side * opts.xSpread, opts.y, opts.z);

    if (irisMat) {
      const iris = new THREE.Mesh(new THREE.SphereGeometry(opts.radius * 1.12, 10, 10), irisMat);
      iris.scale.set(1, 1.06, 0.72);
      eyePivot.add(iris);
    }

    const pupil = new THREE.Mesh(
      new THREE.SphereGeometry(opts.radius * (irisMat ? 0.8 : 1.0), 10, 10),
      GLOSSY_PUPIL_MAT,
    );
    pupil.scale.set(1, 1.08, 0.75);
    pupil.position.z = irisMat ? opts.radius * 0.28 : 0;
    eyePivot.add(pupil);

    // Big upper-left white catchlight dot (Animal Crossing / Pixar sparkle)
    const sparkleBig = new THREE.Mesh(
      new THREE.SphereGeometry(opts.radius * 0.34, 8, 8),
      WHITE_SPARKLE_MAT,
    );
    sparkleBig.position.set(
      -opts.radius * 0.28,
      opts.radius * 0.32,
      opts.radius * (irisMat ? 0.85 : 0.68),
    );
    eyePivot.add(sparkleBig);

    // Tiny lower-right secondary catchlight
    const sparkleSmall = new THREE.Mesh(
      new THREE.SphereGeometry(opts.radius * 0.16, 6, 6),
      WHITE_SPARKLE_MAT,
    );
    sparkleSmall.position.set(
      opts.radius * 0.25,
      -opts.radius * 0.26,
      opts.radius * (irisMat ? 0.82 : 0.65),
    );
    eyePivot.add(sparkleSmall);

    headGroup.add(eyePivot);
    eyeGroups.push(eyePivot);

    if (blushMat) {
      const bs = opts.blushScale ?? 1.0;
      const blush = new THREE.Mesh(new THREE.SphereGeometry(0.052 * bs, 10, 8), blushMat);
      blush.scale.set(1.35, 0.72, 0.45);
      blush.position.set(
        side * (opts.blushOffsetX ?? opts.xSpread + 0.06),
        opts.blushOffsetY ?? opts.y - 0.085,
        opts.blushOffsetZ ?? opts.z - 0.015,
      );
      headGroup.add(blush);
    }
  }

  return eyeGroups;
}

/**
 * Helper to create a curved smooth plush tail using CatmullRomCurve3 + TubeGeometry.
 */
function buildCurvedTailMesh(
  points: THREE.Vector3[],
  radius: number,
  mat: THREE.Material,
  outlineScale = 1.07,
): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, 14, radius, 10, false);
  const mesh = addShadow(new THREE.Mesh(geo, mat));
  addInkOutline(mesh, outlineScale);
  return mesh;
}

interface CritterSpec {
  species: 'raccoon' | 'red_panda' | 'river_otter';
  furMain: number;
  furBelly: number;
  furDark: number;
  furAccent: number;
  noseColor: number;
  blushColor: number;
  banditMask: boolean;
  redPandaFace: boolean;
  otterFeatures: boolean;
  ringedTail: boolean;
  rootScale: [number, number, number];
}

// 1. CHIBI CRITTER QUADRUPED BUILDER (Raccoon, Red Panda, River Otter)
function buildCritterRig(spec: CritterSpec): AnimatedAnimalRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const furMain = toonMat(spec.furMain);
  const furBelly = toonMat(spec.furBelly);
  const furDark = toonMat(spec.furDark);
  const furAccent = toonMat(spec.furAccent);
  const noseMat = toonMat(spec.noseColor, { emissive: 0x1a1414, emissiveIntensity: 0.1 });

  // Plump rounded pear-shaped chibi torso with warm ink outline
  const torso = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.36, 18, 14), furMain));
  torso.scale.set(0.98, 0.86, 1.24);
  torso.position.set(0, 0.42, 0);
  addInkOutline(torso, 1.055);
  bodyGroup.add(torso);

  // Soft cream chest / belly puff
  const belly = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 12), furBelly));
  belly.scale.set(0.88, 0.74, 1.08);
  belly.position.set(0, 0.36, 0.08);
  bodyGroup.add(belly);

  // 4 soft CapsuleGeometry legs & rounded paws
  const legPositions: [number, number][] = [
    [-0.19, 0.24],
    [0.19, 0.24],
    [-0.19, -0.22],
    [0.19, -0.22],
  ];
  const legGeo = new THREE.CapsuleGeometry(0.078, 0.15, 6, 10);
  const pawGeo = new THREE.SphereGeometry(0.082, 10, 8);
  const legMat = spec.species === 'red_panda' ? furDark : furMain;
  for (const [lx, lz] of legPositions) {
    const leg = addShadow(new THREE.Mesh(legGeo, legMat));
    leg.position.set(lx, 0.17, lz);
    addInkOutline(leg, 1.09);
    bodyGroup.add(leg);

    const paw = addShadow(new THREE.Mesh(pawGeo, furDark));
    paw.scale.set(1.05, 0.62, 1.28);
    paw.position.set(lx, 0.055, lz + 0.035);
    addInkOutline(paw, 1.08);
    bodyGroup.add(paw);
  }

  // Oversized Chibi Head (~24% larger, super expressive)
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.62, 0.4);
  bodyGroup.add(headGroup);

  const cranium = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.31, 18, 14), furMain));
  cranium.scale.set(1.12, 0.94, 0.96);
  addInkOutline(cranium, 1.052);
  headGroup.add(cranium);

  // Soft fluffy side cheek puffs
  for (const side of [-1, 1]) {
    const cheek = addShadow(
      new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 10, 8),
        spec.redPandaFace || spec.banditMask ? furBelly : furMain,
      ),
    );
    cheek.scale.set(1.1, 0.85, 0.82);
    cheek.position.set(side * 0.24, -0.06, 0.11);
    headGroup.add(cheek);
  }

  if (spec.banditMask) {
    // Soft sculpted rounded-pill bandit mask (zero BoxGeometry!)
    for (const side of [-1, 1]) {
      const patch = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 10), furDark));
      patch.scale.set(1.22, 0.88, 0.62);
      patch.position.set(side * 0.115, 0.02, 0.22);
      patch.rotation.z = side * -0.14;
      headGroup.add(patch);
    }
    const bridge = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.12, 6, 8), furDark);
    bridge.rotation.z = Math.PI / 2;
    bridge.position.set(0, 0.02, 0.245);
    headGroup.add(bridge);
  }

  if (spec.redPandaFace) {
    // Iconic adorable cream eyebrows & tear-streak accents
    for (const side of [-1, 1]) {
      const brow = new THREE.Mesh(new THREE.SphereGeometry(0.052, 8, 8), furBelly);
      brow.scale.set(1.25, 0.72, 0.65);
      brow.position.set(side * 0.11, 0.135, 0.255);
      headGroup.add(brow);

      const tear = new THREE.Mesh(new THREE.CapsuleGeometry(0.028, 0.08, 5, 8), furDark);
      tear.position.set(side * 0.11, -0.06, 0.255);
      tear.rotation.z = side * 0.18;
      headGroup.add(tear);
    }
  }

  // Rounded cozy snout (smooth Capsule + Sphere, no sharp cones or boxes)
  const snout = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), furBelly));
  snout.scale.set(1.08, 0.78, 1.18);
  snout.position.set(0, -0.065, 0.26);
  addInkOutline(snout, 1.06);
  headGroup.add(snout);

  // Glossy button nose
  const nose = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 8), noseMat));
  nose.scale.set(1.18, 0.85, 0.9);
  nose.position.set(0, -0.03, 0.385);
  headGroup.add(nose);

  if (spec.otterFeatures) {
    // Cute rounded otter whisker nubs
    for (const side of [-1, 1]) {
      for (const wy of [-0.06, -0.095]) {
        const w = new THREE.Mesh(new THREE.CapsuleGeometry(0.01, 0.12, 4, 6), furBelly);
        w.rotation.z = Math.PI / 2 + side * (wy < -0.07 ? 0.15 : -0.08);
        w.position.set(side * 0.145, wy, 0.31);
        headGroup.add(w);
      }
    }
  }

  // Big glossy cartoon eyes with twin white catchlight dots & rosy blush
  const eyeGroups = addCartoonEyes(headGroup, {
    xSpread: 0.12,
    y: 0.045,
    z: 0.275,
    radius: 0.054,
    blushColor: spec.blushColor,
    blushOffsetX: 0.185,
    blushOffsetY: -0.055,
    blushOffsetZ: 0.235,
    blushScale: 1.05,
  });

  // Expressive Rounded Ears tailored to species
  if (spec.otterFeatures) {
    // Cute round low-set otter ears
    for (const side of [-1, 1]) {
      const ear = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), furMain));
      ear.scale.set(0.95, 0.92, 0.65);
      ear.position.set(side * 0.27, 0.12, -0.01);
      addInkOutline(ear, 1.08);
      headGroup.add(ear);
      const inner = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), furBelly);
      inner.position.set(side * 0.275, 0.115, 0.03);
      headGroup.add(inner);
    }
  } else {
    // Rounded chibi triangular/cupped ears (Raccoon / Red Panda)
    for (const side of [-1, 1]) {
      const earPivot = new THREE.Group();
      earPivot.position.set(side * 0.21, 0.24, -0.02);
      earPivot.rotation.z = side * -0.34;
      const earOuter = addShadow(
        new THREE.Mesh(
          new THREE.CapsuleGeometry(0.072, 0.09, 6, 10),
          spec.redPandaFace ? furAccent : furMain,
        ),
      );
      earOuter.scale.set(1.05, 1.05, 0.62);
      addInkOutline(earOuter, 1.08);
      earPivot.add(earOuter);

      const earInner = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.055, 6, 8), furBelly);
      earInner.scale.set(1, 1, 0.45);
      earInner.position.set(0, -0.01, 0.035);
      earPivot.add(earInner);
      headGroup.add(earPivot);
    }
  }

  // Fluffy Curved Tail
  const tailGroup = new THREE.Group();
  tailGroup.position.set(0, 0.4, -0.4);
  bodyGroup.add(tailGroup);

  if (spec.ringedTail) {
    // Lush curved 5-puff striped tail with soft ink outlines
    const ringCount = spec.species === 'red_panda' ? 6 : 5;
    for (let i = 0; i < ringCount; i++) {
      const frac = i / (ringCount - 1);
      const r = 0.135 - Math.abs(frac - 0.45) * 0.042;
      const segMat =
        i % 2 === 0
          ? spec.species === 'red_panda'
            ? furMain
            : furDark
          : spec.species === 'red_panda'
            ? furAccent
            : furBelly;
      const seg = addShadow(new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), segMat));
      seg.scale.set(1.02, 0.96, 1.2);
      seg.position.set(
        0,
        0.04 + Math.sin(frac * Math.PI * 0.72) * 0.24,
        -0.06 - i * 0.135,
      );
      addInkOutline(seg, 1.07);
      tailGroup.add(seg);
    }
  } else {
    // Smooth playful curved otter tail
    const otterTail = buildCurvedTailMesh(
      [
        new THREE.Vector3(0, 0.02, 0),
        new THREE.Vector3(0, 0.0, -0.24),
        new THREE.Vector3(0, 0.08, -0.48),
        new THREE.Vector3(0, 0.2, -0.64),
      ],
      0.095,
      furMain,
      1.075,
    );
    tailGroup.add(otterTail);
    const tip = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), furDark));
    tip.position.set(0, 0.2, -0.64);
    addInkOutline(tip, 1.08);
    tailGroup.add(tip);
  }

  root.scale.set(...spec.rootScale);

  return {
    root,
    species: spec.species,
    phaseOffset: Math.random() * Math.PI * 2,
    basePos: new THREE.Vector3(0, 0, 0),
    wanderRadius: 0.72,
    happyTimer: 0,
    blinkTimer: 1.5 + Math.random() * 3.0,
    bodyGroup,
    headGroup,
    tailGroup,
    eyeGroups,
  };
}

// 2. CHIBI COZY GORILLA (Broad gentle shoulders, sculpted rounded brow, glossy eyes, playful arms)
function buildGorillaRig(variant: AnimalVariant): AnimatedAnimalRig {
  const isExotic = variant === 'exotic';
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const coatDark = toonMat(isExotic ? 0x523e2e : 0x383e46);
  const saddleMat = toonMat(isExotic ? 0xeab954 : 0xbbc5d1);
  const faceMat = toonMat(isExotic ? 0x6b513e : 0x4b515b);

  // Broad plump torso
  const torso = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.46, 18, 14), coatDark));
  torso.scale.set(1.18, 1.06, 1.0);
  torso.position.set(0, 0.64, 0);
  addInkOutline(torso, 1.05);
  bodyGroup.add(torso);

  // Iconic Silverback / Golden Mantle
  const saddle = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), saddleMat));
  saddle.scale.set(1.14, 0.88, 0.85);
  saddle.position.set(0, 0.75, -0.14);
  bodyGroup.add(saddle);

  // Warm smooth chest
  const chest = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10), faceMat));
  chest.scale.set(1.12, 0.9, 0.62);
  chest.position.set(0, 0.64, 0.3);
  bodyGroup.add(chest);

  // Playful rounded muscular arms
  const buildArm = (side: -1 | 1) => {
    const armGroup = new THREE.Group();
    armGroup.position.set(side * 0.54, 0.82, 0.14);

    const upper = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.145, 0.34, 8, 12), coatDark));
    upper.position.set(0, -0.23, 0.04);
    upper.rotation.z = side * -0.14;
    addInkOutline(upper, 1.06);
    armGroup.add(upper);

    const fore = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.135, 0.32, 8, 12), coatDark));
    fore.position.set(side * 0.05, -0.56, 0.12);
    addInkOutline(fore, 1.06);
    armGroup.add(fore);

    const hand = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.145, 12, 10), faceMat));
    hand.scale.set(1.05, 0.7, 1.2);
    hand.position.set(side * 0.05, -0.77, 0.15);
    addInkOutline(hand, 1.07);
    armGroup.add(hand);

    bodyGroup.add(armGroup);
    return armGroup;
  };
  const leftArm = buildArm(-1);
  const rightArm = buildArm(1);

  // Stocky rounded hind legs
  for (const lx of [-0.26, 0.26]) {
    const leg = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.145, 0.22, 8, 10), coatDark));
    leg.position.set(lx, 0.24, -0.18);
    addInkOutline(leg, 1.07);
    bodyGroup.add(leg);

    const foot = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.135, 10, 8), faceMat));
    foot.scale.set(1.05, 0.6, 1.3);
    foot.position.set(lx, 0.07, -0.12);
    addInkOutline(foot, 1.07);
    bodyGroup.add(foot);
  }

  // Friendly oversized chibi head with rounded sculpted brow (zero BoxGeometry!)
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.18, 0.26);
  bodyGroup.add(headGroup);

  const skull = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.32, 18, 14), coatDark));
  skull.scale.set(1.02, 1.06, 0.98);
  addInkOutline(skull, 1.052);
  headGroup.add(skull);

  const crest = addShadow(
    new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), isExotic ? saddleMat : coatDark),
  );
  crest.scale.set(0.84, 0.95, 0.92);
  crest.position.set(0, 0.22, -0.04);
  addInkOutline(crest, 1.06);
  headGroup.add(crest);

  // Soft curved CapsuleGeometry brow ridge instead of blocky BoxGeometry
  const brow = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.24, 6, 10), faceMat));
  brow.rotation.z = Math.PI / 2;
  brow.position.set(0, 0.105, 0.235);
  headGroup.add(brow);

  // Soft friendly face & rounded muzzle
  const facePlate = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12), faceMat));
  facePlate.scale.set(1.08, 0.92, 0.72);
  facePlate.position.set(0, -0.02, 0.19);
  headGroup.add(facePlate);

  const muzzle = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.175, 14, 12), faceMat));
  muzzle.scale.set(1.18, 0.78, 0.92);
  muzzle.position.set(0, -0.095, 0.255);
  addInkOutline(muzzle, 1.055);
  headGroup.add(muzzle);

  // Cute glossy cartoon eyes + warm cheeks
  const eyeGroups = addCartoonEyes(headGroup, {
    xSpread: 0.105,
    y: 0.03,
    z: 0.305,
    radius: 0.048,
    blushColor: isExotic ? 0xe08d6c : 0xc77e85,
    blushOffsetX: 0.175,
    blushOffsetY: -0.045,
    blushOffsetZ: 0.27,
    blushScale: 0.95,
  });

  // Rounded friendly ears
  for (const side of [-1, 1]) {
    const ear = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.082, 10, 8), faceMat));
    ear.scale.set(0.78, 1.0, 0.72);
    ear.position.set(side * 0.31, 0.03, 0.01);
    addInkOutline(ear, 1.08);
    headGroup.add(ear);
  }

  return {
    root,
    species: 'gorilla',
    phaseOffset: Math.random() * Math.PI * 2,
    basePos: new THREE.Vector3(0, 0, 0),
    wanderRadius: 0.56,
    happyTimer: 0,
    blinkTimer: 1.8 + Math.random() * 3.0,
    bodyGroup,
    headGroup,
    leftArm,
    rightArm,
    eyeGroups,
  };
}

// 3. STORYBOOK BUTTERFLY SWARM (3 vibrant toon-lit fluttering butterflies with cute chibi heads)
function buildButterflyRig(variant: AnimalVariant, textures: ProceduralTextureSet): AnimatedAnimalRig {
  const root = new THREE.Group();
  const isExotic = variant === 'exotic';
  const wingTex = isExotic ? textures.butterflyWingExotic : textures.butterflyWingClassic;

  const wingMat = toonMat(0xffffff, {
    map: wingTex,
    transparent: true,
    alphaTest: 0.22,
    side: THREE.DoubleSide,
    emissive: isExotic ? 0x1b649e : 0x5c2b00,
    emissiveIntensity: 0.24,
  });
  const bodyMat = toonMat(0x2d2320);

  const swarm: AnimatedAnimalRig['butterflySwarm'] = [];
  const configs = [
    { scale: 1.08, radius: 0.72, speed: 1.15, height: 1.25, phase: 0 },
    { scale: 0.9, radius: 0.52, speed: -1.45, height: 1.55, phase: 2.1 },
    { scale: 0.82, radius: 0.85, speed: 0.92, height: 1.08, phase: 4.2 },
  ];

  const wingGeo = new THREE.PlaneGeometry(0.5, 0.5);
  wingGeo.translate(0.25, 0, 0);

  for (const cfg of configs) {
    const bGroup = new THREE.Group();
    bGroup.scale.setScalar(cfg.scale);

    // Plump chibi thorax & head
    const thorax = new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.16, 6, 10), bodyMat);
    thorax.rotation.x = Math.PI / 2;
    addInkOutline(thorax, 1.12);
    bGroup.add(thorax);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.062, 10, 8), bodyMat);
    head.position.set(0, 0.015, 0.13);
    addInkOutline(head, 1.1);
    bGroup.add(head);

    // Cute white eye dots on butterfly head
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6), WHITE_SPARKLE_MAT);
      eye.position.set(side * 0.032, 0.025, 0.178);
      bGroup.add(eye);
    }

    // Curled antennae with cute rounded tips
    for (const side of [-1, 1]) {
      const ant = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.13, 4, 6), bodyMat);
      ant.position.set(side * 0.04, 0.08, 0.18);
      ant.rotation.x = 0.65;
      ant.rotation.z = side * -0.35;
      bGroup.add(ant);

      const tip = new THREE.Mesh(
        new THREE.SphereGeometry(0.018, 6, 6),
        toonMat(isExotic ? 0x7ce8ff : 0xffd166),
      );
      tip.position.set(side * 0.068, 0.14, 0.23);
      bGroup.add(tip);
    }

    const rightWing = new THREE.Group();
    const rMesh = new THREE.Mesh(wingGeo, wingMat);
    rMesh.rotation.x = -Math.PI / 2;
    rMesh.castShadow = true;
    rightWing.add(rMesh);
    bGroup.add(rightWing);

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
    blinkTimer: 99,
    butterflySwarm: swarm,
  };
}

interface CanineFelineSpec {
  species: 'wolf' | 'golden_fox' | 'snow_leopard';
  furMain: number;
  furBack: number;
  furCream: number;
  noseColor: number;
  irisColor: number;
  blushColor: number;
  darkStockings?: boolean;
  bigFoxEars?: boolean;
  felineEarsAndSpots?: boolean;
  extraFluffyTail?: boolean;
  longLeopardTail?: boolean;
  rootScale: [number, number, number];
}

// 4. CHIBI CANINE & FELINE BUILDER (Wolf, Golden Fox, Snow Leopard)
function buildCanineFelineRig(spec: CanineFelineSpec): AnimatedAnimalRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const furMain = toonMat(spec.furMain);
  const furBack = toonMat(spec.furBack);
  const furCream = toonMat(spec.furCream);
  const noseMat = toonMat(spec.noseColor);

  // Cozy plump toon torso
  const torso = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.5, 10, 14), furMain));
  torso.rotation.x = Math.PI / 2;
  torso.position.set(0, 0.56, 0);
  addInkOutline(torso, 1.055);
  bodyGroup.add(torso);

  // Dorsal saddle / coat accent
  const dorsal = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 10), furBack));
  dorsal.scale.set(0.95, 0.62, 1.48);
  dorsal.position.set(0, 0.68, -0.02);
  bodyGroup.add(dorsal);

  // Cute snow leopard rosette spots
  if (spec.felineEarsAndSpots) {
    const spotCoords: [number, number, number, number][] = [
      [-0.22, 0.6, 0.14, 0.068],
      [0.22, 0.58, 0.12, 0.064],
      [-0.23, 0.58, -0.14, 0.072],
      [0.23, 0.62, -0.18, 0.068],
      [-0.14, 0.72, -0.26, 0.062],
      [0.14, 0.7, 0.05, 0.058],
    ];
    for (const [sx, sy, sz, sr] of spotCoords) {
      const spot = new THREE.Mesh(new THREE.SphereGeometry(sr, 8, 6), furBack);
      spot.scale.set(0.55, 0.9, 1.05);
      spot.position.set(sx, sy, sz);
      bodyGroup.add(spot);
    }
  }

  // Fluffy cloud-like shoulder neck ruff
  const ruff = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 12), furCream));
  ruff.scale.set(1.06, 1.02, 0.88);
  ruff.position.set(0, 0.67, 0.28);
  addInkOutline(ruff, 1.055);
  bodyGroup.add(ruff);

  // 4 rounded CapsuleGeometry legs & plump paws
  const legs: [number, number][] = [
    [-0.16, 0.27],
    [0.16, 0.27],
    [-0.16, -0.26],
    [0.16, -0.26],
  ];
  const legGeo = new THREE.CapsuleGeometry(0.068, 0.34, 6, 10);
  const pawGeo = new THREE.SphereGeometry(0.074, 10, 8);
  const stockingMat = spec.darkStockings ? toonMat(0x3a261c) : furMain;
  const pawMat = spec.darkStockings ? toonMat(0x2d1d15) : furCream;
  for (const [lx, lz] of legs) {
    const leg = addShadow(new THREE.Mesh(legGeo, stockingMat));
    leg.position.set(lx, 0.27, lz);
    addInkOutline(leg, 1.09);
    bodyGroup.add(leg);

    const paw = addShadow(new THREE.Mesh(pawGeo, pawMat));
    paw.scale.set(1.05, 0.6, 1.32);
    paw.position.set(lx, 0.05, lz + 0.035);
    addInkOutline(paw, 1.08);
    bodyGroup.add(paw);
  }

  // Expressive Oversized Chibi Head (~22% bigger than original)
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.92, 0.44);
  bodyGroup.add(headGroup);

  const cranium = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.28, 18, 14), furMain));
  cranium.scale.set(1.06, 0.96, 1.04);
  addInkOutline(cranium, 1.052);
  headGroup.add(cranium);

  // Fluffy rounded cheek tufts
  for (const side of [-1, 1]) {
    const cheek = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.115, 10, 8), furCream));
    cheek.scale.set(1.18, 0.78, 0.85);
    cheek.position.set(side * 0.22, -0.06, 0.08);
    headGroup.add(cheek);
  }

  // Smooth rounded snout (zero BoxGeometry!)
  const snoutLen = spec.felineEarsAndSpots ? 0.14 : 0.22;
  const snout = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.125, 14, 10), furCream));
  snout.scale.set(1.02, 0.8, 0.95 + snoutLen * 2.1);
  snout.position.set(0, -0.06, 0.22 + snoutLen * 0.28);
  addInkOutline(snout, 1.06);
  headGroup.add(snout);

  // Cute button nose
  const nose = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 8), noseMat));
  nose.scale.set(1.18, 0.82, 0.88);
  nose.position.set(0, -0.028, 0.34 + snoutLen * 0.45);
  headGroup.add(nose);

  // Expressive cartoon eyes with iris ring, twin white sparkles & rosy cheek blushes
  const eyeGroups = addCartoonEyes(headGroup, {
    xSpread: 0.11,
    y: 0.055,
    z: 0.245,
    radius: 0.052,
    irisColor: spec.irisColor,
    blushColor: spec.blushColor,
    blushOffsetX: 0.175,
    blushOffsetY: -0.045,
    blushOffsetZ: 0.215,
    blushScale: 0.95,
  });

  // Species-tailored rounded cartoon ears
  if (spec.felineEarsAndSpots) {
    // Rounded snow-leopard ears
    for (const side of [-1, 1]) {
      const ear = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.092, 10, 8), furMain));
      ear.scale.set(1.0, 0.95, 0.58);
      ear.position.set(side * 0.2, 0.23, -0.02);
      addInkOutline(ear, 1.08);
      headGroup.add(ear);
      const inner = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), furCream);
      inner.position.set(side * 0.2, 0.22, 0.025);
      headGroup.add(inner);
    }
  } else {
    // Tall rounded-tip ears (extra tall for Golden Fox!)
    const earH = spec.bigFoxEars ? 0.17 : 0.12;
    const earR = spec.bigFoxEars ? 0.076 : 0.068;
    for (const side of [-1, 1]) {
      const earPivot = new THREE.Group();
      earPivot.position.set(side * 0.165, 0.27, -0.02);
      earPivot.rotation.z = side * (spec.bigFoxEars ? -0.26 : -0.18);

      const ear = addShadow(
        new THREE.Mesh(
          new THREE.CapsuleGeometry(earR, earH, 6, 10),
          spec.bigFoxEars ? furMain : furBack,
        ),
      );
      ear.scale.set(1.0, 1.0, 0.58);
      addInkOutline(ear, 1.08);
      earPivot.add(ear);

      const inner = new THREE.Mesh(new THREE.CapsuleGeometry(earR * 0.62, earH * 0.65, 6, 8), furCream);
      inner.scale.set(1.0, 1.0, 0.45);
      inner.position.set(0, -0.015, 0.032);
      earPivot.add(inner);

      if (spec.bigFoxEars) {
        const tip = new THREE.Mesh(new THREE.SphereGeometry(earR * 0.72, 8, 8), toonMat(0x3a261c));
        tip.position.set(0, earH * 0.58, 0);
        earPivot.add(tip);
      }

      headGroup.add(earPivot);
    }
  }

  // Sweeping Curved Plush Cartoon Tail
  const tailGroup = new THREE.Group();
  tailGroup.position.set(0, 0.56, -0.4);
  bodyGroup.add(tailGroup);

  if (spec.longLeopardTail) {
    const leopardTail = buildCurvedTailMesh(
      [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, -0.08, -0.28),
        new THREE.Vector3(0.04, 0.02, -0.58),
        new THREE.Vector3(0.08, 0.24, -0.78),
      ],
      0.088,
      furMain,
      1.075,
    );
    tailGroup.add(leopardTail);
    const tip = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.098, 10, 8), furBack));
    tip.position.set(0.08, 0.24, -0.78);
    addInkOutline(tip, 1.08);
    tailGroup.add(tip);
  } else if (spec.extraFluffyTail) {
    // Big lush cloud-like fox tail with snow-white tip
    const foxTail = buildCurvedTailMesh(
      [
        new THREE.Vector3(0, 0.02, 0),
        new THREE.Vector3(0, 0.1, -0.24),
        new THREE.Vector3(0, 0.24, -0.48),
      ],
      0.14,
      furMain,
      1.07,
    );
    tailGroup.add(foxTail);
    const tip = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.155, 12, 10), furCream));
    tip.scale.set(0.95, 0.95, 1.25);
    tip.position.set(0, 0.28, -0.56);
    addInkOutline(tip, 1.07);
    tailGroup.add(tip);
  } else {
    // Sweeping plumed wolf tail
    const wolfTail = buildCurvedTailMesh(
      [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, -0.02, -0.24),
        new THREE.Vector3(0, 0.14, -0.46),
      ],
      0.105,
      furBack,
      1.075,
    );
    tailGroup.add(wolfTail);
    const tip = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.112, 10, 8), furCream));
    tip.position.set(0, 0.16, -0.5);
    addInkOutline(tip, 1.08);
    tailGroup.add(tip);
  }

  root.scale.set(...spec.rootScale);

  return {
    root,
    species: spec.species,
    phaseOffset: Math.random() * Math.PI * 2,
    basePos: new THREE.Vector3(0, 0, 0),
    wanderRadius: 0.78,
    happyTimer: 0,
    blinkTimer: 1.4 + Math.random() * 3.0,
    bodyGroup,
    headGroup,
    tailGroup,
    eyeGroups,
  };
}

// 5. CHIBI EMERALD TREE FROG (Plump squishy body, perched cartoon eyes, webbed toes, bouncy hop)
function buildTreeFrogRig(variant: AnimalVariant): AnimatedAnimalRig {
  const isExotic = variant === 'exotic';
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const skinMain = toonMat(isExotic ? 0x2c9cf2 : 0x4bc45e);
  const bellyMat = toonMat(isExotic ? 0xffe678 : 0xdcf7bc);
  const toeMat = toonMat(isExotic ? 0xff7b42 : 0xff9b38);
  const spotMat = toonMat(isExotic ? 0xffd23f : 0x2f9446);

  // Plump squishy rounded body
  const torso = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.36, 18, 14), skinMain));
  torso.scale.set(1.08, 0.82, 1.15);
  torso.position.set(0, 0.34, 0);
  addInkOutline(torso, 1.055);
  bodyGroup.add(torso);

  // Soft cream vocal belly sac
  const belly = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), bellyMat));
  belly.scale.set(0.95, 0.72, 1.05);
  belly.position.set(0, 0.27, 0.12);
  bodyGroup.add(belly);

  // Cute dorsal jewel/leaf spots
  for (const [sx, sy, sz, sr] of [
    [-0.14, 0.56, -0.1, 0.08],
    [0.14, 0.54, -0.14, 0.075],
    [0, 0.52, -0.26, 0.068],
  ] as [number, number, number, number][]) {
    const spot = new THREE.Mesh(new THREE.SphereGeometry(sr, 8, 8), spotMat);
    spot.scale.set(1.1, 0.45, 1.1);
    spot.position.set(sx, sy, sz);
    bodyGroup.add(spot);
  }

  // Bent springy frog hind legs + splayed orange/coral webbed feet
  for (const side of [-1, 1]) {
    const thigh = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.115, 0.2, 6, 10), skinMain));
    thigh.position.set(side * 0.34, 0.24, -0.14);
    thigh.rotation.z = side * 0.48;
    thigh.rotation.x = 0.55;
    addInkOutline(thigh, 1.08);
    bodyGroup.add(thigh);

    const hindFoot = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), toeMat));
    hindFoot.scale.set(1.15, 0.42, 1.45);
    hindFoot.position.set(side * 0.38, 0.06, -0.04);
    addInkOutline(hindFoot, 1.08);
    bodyGroup.add(hindFoot);

    // Front little arms & toe pads
    const arm = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.2, 6, 8), skinMain));
    arm.position.set(side * 0.26, 0.2, 0.26);
    arm.rotation.z = side * 0.22;
    addInkOutline(arm, 1.09);
    bodyGroup.add(arm);

    const frontFoot = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), toeMat));
    frontFoot.scale.set(1.15, 0.42, 1.25);
    frontFoot.position.set(side * 0.28, 0.055, 0.32);
    addInkOutline(frontFoot, 1.08);
    bodyGroup.add(frontFoot);
  }

  // Expressive Wide Chibi Frog Head with Perched Bulbous Eyes
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.48, 0.28);
  bodyGroup.add(headGroup);

  const cranium = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), skinMain));
  cranium.scale.set(1.22, 0.78, 1.05);
  addInkOutline(cranium, 1.052);
  headGroup.add(cranium);

  // Cute perched dome eye mounds on top of head
  for (const side of [-1, 1]) {
    const mound = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.125, 12, 10), skinMain));
    mound.position.set(side * 0.16, 0.22, 0.08);
    addInkOutline(mound, 1.07);
    headGroup.add(mound);
  }

  const eyeGroups = addCartoonEyes(headGroup, {
    xSpread: 0.165,
    y: 0.23,
    z: 0.175,
    radius: 0.066,
    irisColor: isExotic ? 0xffd23f : 0xf5b431,
    blushColor: 0xff8ea6,
    blushOffsetX: 0.24,
    blushOffsetY: -0.02,
    blushOffsetZ: 0.19,
    blushScale: 1.12,
  });

  return {
    root,
    species: 'tree_frog',
    phaseOffset: Math.random() * Math.PI * 2,
    basePos: new THREE.Vector3(0, 0, 0),
    wanderRadius: 0.74,
    happyTimer: 0,
    blinkTimer: 1.2 + Math.random() * 2.8,
    bodyGroup,
    headGroup,
    eyeGroups,
  };
}

// 6. CHIBI SUNLEAF CHAMELEON (Casque crest, big turret eyes, striped plump torso, spiral curly tail)
function buildChameleonRig(variant: AnimalVariant): AnimatedAnimalRig {
  const isExotic = variant === 'exotic';
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const skinMain = toonMat(isExotic ? 0xc56bf0 : 0x52c76b);
  const stripeMat = toonMat(isExotic ? 0x52e0d4 : 0x2c8c5b);
  const crestMat = toonMat(isExotic ? 0xff9bd4 : 0x8ae66e);
  const bellyMat = toonMat(isExotic ? 0xffe6f7 : 0xdcf7b5);

  // Plump arched chameleon torso
  const torso = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), skinMain));
  torso.scale.set(0.84, 1.08, 1.32);
  torso.position.set(0, 0.5, 0);
  addInkOutline(torso, 1.055);
  bodyGroup.add(torso);

  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), bellyMat);
  belly.scale.set(0.76, 0.78, 1.15);
  belly.position.set(0, 0.37, 0.04);
  bodyGroup.add(belly);

  // Bold cartoon vertical side stripes & soft dorsal ridge bumps
  for (const sz of [-0.16, 0.02, 0.2]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.245, 0.036, 8, 16), stripeMat);
    band.scale.set(0.92, 1.12, 1.0);
    band.position.set(0, 0.5, sz);
    bodyGroup.add(band);

    const ridge = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.068, 8, 8), crestMat));
    ridge.position.set(0, 0.84 - Math.abs(sz) * 0.25, sz);
    addInkOutline(ridge, 1.08);
    bodyGroup.add(ridge);
  }

  // 4 cute grasping chameleon legs
  const legCoords: [number, number][] = [
    [-0.2, 0.22],
    [0.2, 0.22],
    [-0.2, -0.22],
    [0.2, -0.22],
  ];
  for (const [lx, lz] of legCoords) {
    const leg = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.24, 6, 8), skinMain));
    leg.position.set(lx, 0.2, lz);
    leg.rotation.z = lx < 0 ? 0.14 : -0.14;
    addInkOutline(leg, 1.09);
    bodyGroup.add(leg);

    const mitten = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.072, 8, 8), crestMat));
    mitten.scale.set(1.05, 0.6, 1.25);
    mitten.position.set(lx, 0.055, lz + 0.03);
    addInkOutline(mitten, 1.08);
    bodyGroup.add(mitten);
  }

  // Iconic Casque-Crested Chibi Head + Big Turret Eyes
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.72, 0.42);
  bodyGroup.add(headGroup);

  const cranium = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), skinMain));
  cranium.scale.set(0.95, 1.02, 1.22);
  addInkOutline(cranium, 1.055);
  headGroup.add(cranium);

  // Sculpted rounded casque helmet crest
  const casque = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.18, 6, 10), crestMat));
  casque.position.set(0, 0.22, -0.08);
  casque.rotation.x = -0.45;
  casque.scale.set(0.82, 1.05, 1.15);
  addInkOutline(casque, 1.07);
  headGroup.add(casque);

  // Cute protruding turret eye cones
  for (const side of [-1, 1]) {
    const turret = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 10), stripeMat));
    turret.position.set(side * 0.2, 0.05, 0.12);
    addInkOutline(turret, 1.07);
    headGroup.add(turret);
  }

  const eyeGroups = addCartoonEyes(headGroup, {
    xSpread: 0.23,
    y: 0.055,
    z: 0.195,
    radius: 0.056,
    irisColor: isExotic ? 0xffe066 : 0xffc845,
    blushColor: 0xff94a8,
    blushOffsetX: 0.21,
    blushOffsetY: -0.06,
    blushOffsetZ: 0.17,
    blushScale: 0.85,
  });

  // Signature tightly spiraled curly tail!
  const tailGroup = new THREE.Group();
  tailGroup.position.set(0, 0.46, -0.38);
  bodyGroup.add(tailGroup);

  const spiralPts: THREE.Vector3[] = [];
  for (let i = 0; i <= 18; i++) {
    const u = i / 18;
    const ang = u * Math.PI * 2.35;
    const rad = 0.24 * (1 - u * 0.62);
    const z = -0.18 - Math.sin(ang) * rad;
    const y = -0.06 + (1 - Math.cos(ang)) * rad * 0.85;
    spiralPts.push(new THREE.Vector3(0, y, z));
  }
  const spiralTail = buildCurvedTailMesh(spiralPts, 0.062, stripeMat, 1.09);
  tailGroup.add(spiralTail);

  return {
    root,
    species: 'chameleon',
    phaseOffset: Math.random() * Math.PI * 2,
    basePos: new THREE.Vector3(0, 0, 0),
    wanderRadius: 0.65,
    happyTimer: 0,
    blinkTimer: 1.5 + Math.random() * 3.0,
    bodyGroup,
    headGroup,
    tailGroup,
    eyeGroups,
  };
}

// 7. CHIBI MEADOW TORTOISE (Domed scute shell, cozy cream rim, sweet expressive head, stubby pillar legs)
function buildGiantTortoiseRig(variant: AnimalVariant): AnimatedAnimalRig {
  const isExotic = variant === 'exotic';
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const skinMat = toonMat(isExotic ? 0x9fe0c2 : 0x82ab55);
  const shellMain = toonMat(isExotic ? 0xeab84b : 0x945f36);
  const shellScute = toonMat(isExotic ? 0xc48a25 : 0x6b4122);
  const rimMat = toonMat(isExotic ? 0xfff0ba : 0xdec08a);

  // Big domed storybook tortoise shell
  const shell = addShadow(
    new THREE.Mesh(new THREE.SphereGeometry(0.52, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.56), shellMain),
  );
  shell.scale.set(1.04, 0.92, 1.2);
  shell.position.set(0, 0.24, -0.04);
  addInkOutline(shell, 1.045);
  bodyGroup.add(shell);

  // Cream scalloped shell rim & flat belly plastron
  const rim = addShadow(new THREE.Mesh(new THREE.TorusGeometry(0.51, 0.075, 10, 22), rimMat));
  rim.rotation.x = Math.PI / 2;
  rim.scale.set(1.04, 1.2, 1.0);
  rim.position.set(0, 0.24, -0.04);
  addInkOutline(rim, 1.05);
  bodyGroup.add(rim);

  const belly = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.44, 0.1, 14), rimMat);
  belly.scale.set(1.0, 1.0, 1.15);
  belly.position.set(0, 0.2, -0.04);
  bodyGroup.add(belly);

  // Cute raised scute dome plates on top of the shell
  const scuteCoords: [number, number, number, number][] = [
    [0, 0.68, -0.04, 0.17],
    [0, 0.58, 0.22, 0.14],
    [0, 0.58, -0.3, 0.14],
    [-0.28, 0.52, 0.04, 0.13],
    [0.28, 0.52, 0.04, 0.13],
    [-0.26, 0.5, -0.2, 0.12],
    [0.26, 0.5, -0.2, 0.12],
  ];
  for (const [sx, sy, sz, sr] of scuteCoords) {
    const sc = new THREE.Mesh(new THREE.SphereGeometry(sr, 10, 8), shellScute);
    sc.scale.set(1.05, 0.42, 1.05);
    sc.position.set(sx, sy, sz);
    bodyGroup.add(sc);
  }

  // 4 chunky pillar legs with cute tiny toes
  const legPos: [number, number][] = [
    [-0.36, 0.34],
    [0.36, 0.34],
    [-0.34, -0.38],
    [0.34, -0.38],
  ];
  for (const [lx, lz] of legPos) {
    const leg = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.115, 0.14, 6, 10), skinMat));
    leg.position.set(lx, 0.15, lz);
    addInkOutline(leg, 1.08);
    bodyGroup.add(leg);

    const nail = new THREE.Mesh(new THREE.SphereGeometry(0.042, 6, 6), rimMat);
    nail.position.set(lx, 0.05, lz + 0.1);
    bodyGroup.add(nail);
  }

  // Cute stubby tail
  const tailGroup = new THREE.Group();
  tailGroup.position.set(0, 0.22, -0.62);
  bodyGroup.add(tailGroup);
  const tail = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.1, 5, 8), skinMat));
  tail.rotation.x = 1.1;
  tail.position.set(0, 0, -0.05);
  addInkOutline(tail, 1.09);
  tailGroup.add(tail);

  // Sweet gentle chibi tortoise head on a soft neck
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.38, 0.62);
  bodyGroup.add(headGroup);

  const neck = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.18, 6, 10), skinMat));
  neck.rotation.x = Math.PI / 2 - 0.35;
  neck.position.set(0, -0.05, -0.14);
  addInkOutline(neck, 1.07);
  headGroup.add(neck);

  const cranium = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), skinMat));
  cranium.scale.set(1.06, 0.94, 1.12);
  addInkOutline(cranium, 1.055);
  headGroup.add(cranium);

  const eyeGroups = addCartoonEyes(headGroup, {
    xSpread: 0.11,
    y: 0.05,
    z: 0.195,
    radius: 0.05,
    blushColor: 0xf799a8,
    blushOffsetX: 0.165,
    blushOffsetY: -0.04,
    blushOffsetZ: 0.17,
    blushScale: 0.95,
  });

  return {
    root,
    species: 'giant_tortoise',
    phaseOffset: Math.random() * Math.PI * 2,
    basePos: new THREE.Vector3(0, 0, 0),
    wanderRadius: 0.52,
    happyTimer: 0,
    blinkTimer: 2.0 + Math.random() * 3.2,
    bodyGroup,
    headGroup,
    tailGroup,
    eyeGroups,
  };
}

// 8. CHIBI SUNBEAM BEARDED DRAGON (Plump basking lizard, scalloped beard ruff, sweeping curved tail)
function buildBeardedDragonRig(variant: AnimalVariant): AnimatedAnimalRig {
  const isExotic = variant === 'exotic';
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const skinMain = toonMat(isExotic ? 0xff7e45 : 0xe8ab61);
  const bandMat = toonMat(isExotic ? 0xd94826 : 0xb86d32);
  const ruffMat = toonMat(isExotic ? 0xffd252 : 0xc47739);
  const bellyMat = toonMat(isExotic ? 0xffe8c2 : 0xfae7c5);

  // Plump flattened basking torso
  const torso = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12), skinMain));
  torso.scale.set(1.18, 0.64, 1.42);
  torso.position.set(0, 0.28, 0);
  addInkOutline(torso, 1.055);
  bodyGroup.add(torso);

  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), bellyMat);
  belly.scale.set(1.08, 0.45, 1.28);
  belly.position.set(0, 0.21, 0.02);
  bodyGroup.add(belly);

  // Cute terracotta tiger stripes along back
  for (const sz of [-0.22, -0.02, 0.18]) {
    const band = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.36, 5, 8), bandMat);
    band.rotation.z = Math.PI / 2;
    band.scale.set(1, 1, 0.45);
    band.position.set(0, 0.47, sz);
    bodyGroup.add(band);
  }

  // Splayed sturdy lizard legs
  const legPos: [number, number][] = [
    [-0.36, 0.26],
    [0.36, 0.26],
    [-0.34, -0.26],
    [0.34, -0.26],
  ];
  for (const [lx, lz] of legPos) {
    const leg = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.072, 0.22, 6, 8), skinMain));
    leg.position.set(lx, 0.16, lz);
    leg.rotation.z = lx < 0 ? 0.55 : -0.55;
    addInkOutline(leg, 1.08);
    bodyGroup.add(leg);

    const foot = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 8), bandMat));
    foot.scale.set(1.15, 0.45, 1.35);
    foot.position.set(lx * 1.15, 0.055, lz + 0.05);
    addInkOutline(foot, 1.08);
    bodyGroup.add(foot);
  }

  // Charming Chibi Head with Soft Scalloped Beard Ruff!
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.42, 0.52);
  bodyGroup.add(headGroup);

  const cranium = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), skinMain));
  cranium.scale.set(1.15, 0.84, 1.24);
  addInkOutline(cranium, 1.055);
  headGroup.add(cranium);

  // Iconic scalloped cartoon beard collar (rounded soft spikes around the jaw)
  for (let i = 0; i < 7; i++) {
    const ang = -Math.PI * 0.45 + (i / 6) * Math.PI * 0.9;
    const spike = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.072, 8, 8), ruffMat));
    spike.scale.set(0.95, 0.82, 1.15);
    spike.position.set(Math.sin(ang) * 0.25, -0.09, Math.cos(ang) * 0.14 - 0.06);
    addInkOutline(spike, 1.09);
    headGroup.add(spike);
  }

  const eyeGroups = addCartoonEyes(headGroup, {
    xSpread: 0.135,
    y: 0.065,
    z: 0.215,
    radius: 0.052,
    irisColor: isExotic ? 0xffe047 : 0xf5a623,
    blushColor: 0xff8a7a,
    blushOffsetX: 0.2,
    blushOffsetY: -0.035,
    blushOffsetZ: 0.185,
    blushScale: 0.9,
  });

  // Sweeping Curved Desert Lizard Tail
  const tailGroup = new THREE.Group();
  tailGroup.position.set(0, 0.24, -0.46);
  bodyGroup.add(tailGroup);

  const beardieTail = buildCurvedTailMesh(
    [
      new THREE.Vector3(0, 0.02, 0),
      new THREE.Vector3(0.06, -0.04, -0.32),
      new THREE.Vector3(0.14, 0.02, -0.64),
      new THREE.Vector3(0.08, 0.14, -0.88),
    ],
    0.078,
    skinMain,
    1.075,
  );
  tailGroup.add(beardieTail);

  return {
    root,
    species: 'bearded_dragon',
    phaseOffset: Math.random() * Math.PI * 2,
    basePos: new THREE.Vector3(0, 0, 0),
    wanderRadius: 0.72,
    happyTimer: 0,
    blinkTimer: 1.6 + Math.random() * 2.8,
    bodyGroup,
    headGroup,
    tailGroup,
    eyeGroups,
  };
}

export function createAnimalRig(
  species: SpeciesId,
  variant: AnimalVariant,
  textures: ProceduralTextureSet,
): AnimatedAnimalRig {
  const isExotic = variant === 'exotic';

  switch (species) {
    case 'raccoon':
      return buildCritterRig({
        species: 'raccoon',
        furMain: isExotic ? 0xe8a4b5 : 0x868380,
        furBelly: isExotic ? 0xfff0f4 : 0xe3dfd6,
        furDark: isExotic ? 0x572d41 : 0x2f2b29,
        furAccent: isExotic ? 0xf5c8d4 : 0x9b9690,
        noseColor: 0x241d1d,
        blushColor: 0xf799a8,
        banditMask: true,
        redPandaFace: false,
        otterFeatures: false,
        ringedTail: true,
        rootScale: [1, 1, 1],
      });

    case 'red_panda':
      return buildCritterRig({
        species: 'red_panda',
        furMain: isExotic ? 0xfca842 : 0xd6532a,
        furBelly: 0xfff6e8,
        furDark: isExotic ? 0x6b3516 : 0x3b2319,
        furAccent: isExotic ? 0xffd180 : 0xf2935c,
        noseColor: 0x261a16,
        blushColor: 0xffa69e,
        banditMask: false,
        redPandaFace: true,
        otterFeatures: false,
        ringedTail: true,
        rootScale: [0.96, 0.96, 1.02],
      });

    case 'river_otter':
      return buildCritterRig({
        species: 'river_otter',
        furMain: isExotic ? 0x8bc0de : 0x87674e,
        furBelly: isExotic ? 0xe6f5ff : 0xeddcc8,
        furDark: isExotic ? 0x4c7491 : 0x523c2c,
        furAccent: isExotic ? 0xb3d9f0 : 0xa38063,
        noseColor: 0x261d1a,
        blushColor: 0xf59ea4,
        banditMask: false,
        redPandaFace: false,
        otterFeatures: true,
        ringedTail: false,
        rootScale: [0.9, 0.84, 1.16],
      });

    case 'gorilla':
      return buildGorillaRig(variant);

    case 'butterfly':
      return buildButterflyRig(variant, textures);

    case 'wolf':
      return buildCanineFelineRig({
        species: 'wolf',
        furMain: isExotic ? 0xdfeefa : 0x88929c,
        furBack: isExotic ? 0x9bc0e3 : 0x57616b,
        furCream: isExotic ? 0xf8fcff : 0xebe8df,
        noseColor: 0x212429,
        irisColor: isExotic ? 0x47d1ff : 0xf5b038,
        blushColor: 0xf49ba8,
        rootScale: [1, 1, 1],
      });

    case 'golden_fox':
      return buildCanineFelineRig({
        species: 'golden_fox',
        furMain: isExotic ? 0xffcc4d : 0xeb7b28,
        furBack: isExotic ? 0xe09d1f : 0xc45618,
        furCream: 0xfff8eb,
        noseColor: 0x261b18,
        irisColor: isExotic ? 0x42c2a8 : 0xe38b24,
        blushColor: 0xff9e9e,
        darkStockings: true,
        bigFoxEars: true,
        extraFluffyTail: true,
        rootScale: [0.88, 0.88, 0.92],
      });

    case 'snow_leopard':
      return buildCanineFelineRig({
        species: 'snow_leopard',
        furMain: isExotic ? 0xeaf5ff : 0xd2dce6,
        furBack: isExotic ? 0x7ba7cf : 0x5c6978,
        furCream: 0xfafdff,
        noseColor: 0x57424a,
        irisColor: isExotic ? 0x61d9ff : 0x6bc7a4,
        blushColor: 0xf7a8b8,
        felineEarsAndSpots: true,
        longLeopardTail: true,
        rootScale: [1.02, 0.96, 1.05],
      });

    case 'tree_frog':
      return buildTreeFrogRig(variant);

    case 'chameleon':
      return buildChameleonRig(variant);

    case 'giant_tortoise':
      return buildGiantTortoiseRig(variant);

    case 'bearded_dragon':
      return buildBeardedDragonRig(variant);

    default:
      return buildCritterRig({
        species: 'raccoon',
        furMain: 0x868380,
        furBelly: 0xe3dfd6,
        furDark: 0x2f2b29,
        furAccent: 0x9b9690,
        noseColor: 0x241d1d,
        blushColor: 0xf799a8,
        banditMask: true,
        redPandaFace: false,
        otterFeatures: false,
        ringedTail: true,
        rootScale: [1, 1, 1],
      });
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

  // Periodic cartoon eye blink
  if (rig.eyeGroups && rig.eyeGroups.length > 0) {
    rig.blinkTimer -= dt;
    let eyeScaleY = 1.0;
    if (rig.blinkTimer < 0) {
      const blinkProgress = -rig.blinkTimer / 0.14; // 140ms crisp cartoon blink
      if (blinkProgress < 1) {
        eyeScaleY = 0.14 + Math.abs(blinkProgress - 0.5) * 1.72;
      } else {
        rig.blinkTimer = 2.6 + ((rig.phaseOffset * 1.7 + elapsed * 0.31) % 3.2);
      }
    }
    for (const eg of rig.eyeGroups) {
      eg.scale.y = eyeScaleY;
    }
  }

  // Gentle cozy figure-8 wandering inside the enclosure
  const wanderSpeed =
    rig.species === 'giant_tortoise'
      ? 0.22
      : rig.species === 'gorilla' || rig.species === 'chameleon'
        ? 0.36
        : 0.52;
  const wx = Math.sin(t * wanderSpeed) * rig.wanderRadius;
  const wz = Math.sin(t * wanderSpeed * 0.65) * rig.wanderRadius * 0.65;

  const prevX = rig.root.position.x;
  const prevZ = rig.root.position.z;
  rig.root.position.x = THREE.MathUtils.damp(prevX, wx, 2.2, dt);
  rig.root.position.z = THREE.MathUtils.damp(prevZ, wz, 2.2, dt);

  const dx = rig.root.position.x - prevX;
  const dz = rig.root.position.z - prevZ;
  const moveSq = dx * dx + dz * dz;
  if (moveSq > 0.000004) {
    const targetRot = Math.atan2(dx, dz);
    let diff = targetRot - rig.root.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    rig.root.rotation.y += diff * Math.min(1, dt * 4.5);
  }

  // Bouncy cartoon squash-and-stretch during walking & joyful happy hops
  const isHappy = rig.happyTimer > 0;
  const isFrog = rig.species === 'tree_frog';
  const hop = isHappy ? Math.abs(Math.sin(elapsed * 11.5)) * 0.48 : 0;
  const walkPhase = Math.sin(t * (isFrog ? 3.8 : 5.2));
  // Tree Frogs do cute bouncy leaps as they wander!
  const walkBob = isFrog
    ? Math.pow(Math.max(0, walkPhase), 2.2) * 0.34
    : Math.abs(walkPhase) * (rig.species === 'giant_tortoise' ? 0.025 : 0.055);
  if (rig.bodyGroup) {
    rig.bodyGroup.position.y = hop + walkBob;
    const stretch = isHappy
      ? 1 + Math.sin(elapsed * 11.5) * 0.13
      : isFrog
        ? 1 + Math.max(0, walkPhase) * 0.14 - Math.max(0, -walkPhase) * 0.06
        : 1 + Math.sin(t * 5.2) * 0.032;
    const invSqrt = 1 / Math.sqrt(stretch);
    rig.bodyGroup.scale.set(invSqrt, stretch, invSqrt);
    // Cute playful side waddle tilt
    rig.bodyGroup.rotation.z = isHappy
      ? Math.sin(elapsed * 11.5) * 0.09
      : Math.sin(t * (rig.species === 'giant_tortoise' ? 3.2 : 5.2)) * 0.035;
  }

  if (rig.headGroup) {
    rig.headGroup.rotation.y = Math.sin(t * 1.45) * 0.26;
    rig.headGroup.rotation.x = Math.sin(t * 2.15) * 0.09 - (isHappy ? 0.2 : 0);
    rig.headGroup.rotation.z = Math.sin(t * 1.15) * 0.08;
  }

  if (rig.tailGroup) {
    const wagSpeed = isHappy ? 15 : 4.8;
    rig.tailGroup.rotation.y = Math.sin(t * wagSpeed) * (isHappy ? 0.62 : 0.3);
    rig.tailGroup.rotation.x = Math.sin(t * wagSpeed * 0.5) * 0.08;
  }

  if (rig.leftArm && rig.rightArm) {
    if (isHappy) {
      rig.leftArm.rotation.x = -0.82 + Math.sin(elapsed * 12) * 0.48;
      rig.rightArm.rotation.x = -0.82 - Math.sin(elapsed * 12) * 0.48;
    } else {
      rig.leftArm.rotation.x = Math.sin(t * 2.4) * 0.16;
      rig.rightArm.rotation.x = -Math.sin(t * 2.4) * 0.16;
    }
  }
}
