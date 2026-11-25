import * as THREE from 'three';
import type { CropPlotItem, DecorTypeId, EnclosureItem } from '../types/game';
import type { ProceduralTextureSet } from './proceduralTextures';
import { createAnimalRig, type AnimatedAnimalRig } from './animalModels';

export const TILE_SIZE = 2.0;

export function gridToWorld(gx: number, gz: number, footprint: 1 | 2 = 1): THREE.Vector3 {
  const halfBoard = (12 * TILE_SIZE) / 2; // 12 units
  const offset = footprint === 2 ? TILE_SIZE : TILE_SIZE * 0.5;
  return new THREE.Vector3(gx * TILE_SIZE - halfBoard + offset, 0, gz * TILE_SIZE - halfBoard + offset);
}

function addShadow(mesh: THREE.Mesh, cast = true, receive = true): THREE.Mesh {
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

function makeContactShadow(textures: ProceduralTextureSet, size: number): THREE.Mesh {
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({
      map: textures.contactShadow,
      transparent: true,
      depthWrite: false,
      opacity: 0.46,
    }),
  );
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = 0.025;
  return plane;
}

function buildFencePerimeter(
  group: THREE.Group,
  halfSpan: number,
  woodMat: THREE.Material,
  postCapMat: THREE.Material,
): void {
  const postGeo = new THREE.BoxGeometry(0.16, 0.58, 0.16);
  const capGeo = new THREE.BoxGeometry(0.22, 0.07, 0.22);
  const railGeo = new THREE.BoxGeometry(halfSpan * 2, 0.07, 0.07);

  const corners: [number, number][] = [
    [-halfSpan, -halfSpan],
    [halfSpan, -halfSpan],
    [-halfSpan, halfSpan],
    [halfSpan, halfSpan],
    [0, -halfSpan],
    [-halfSpan, 0],
    [halfSpan, 0],
  ];
  for (const [px, pz] of corners) {
    const post = addShadow(new THREE.Mesh(postGeo, woodMat));
    post.position.set(px, 0.32, pz);
    group.add(post);
    const cap = addShadow(new THREE.Mesh(capGeo, postCapMat));
    cap.position.set(px, 0.63, pz);
    group.add(cap);
  }

  // Rails on back, left, right (leaving cozy entrance opening on front +Z)
  for (const ry of [0.24, 0.46]) {
    const backRail = addShadow(new THREE.Mesh(railGeo, woodMat));
    backRail.position.set(0, ry, -halfSpan);
    group.add(backRail);

    const leftRail = addShadow(new THREE.Mesh(railGeo, woodMat));
    leftRail.rotation.y = Math.PI / 2;
    leftRail.position.set(-halfSpan, ry, 0);
    group.add(leftRail);

    const rightRail = addShadow(new THREE.Mesh(railGeo, woodMat));
    rightRail.rotation.y = Math.PI / 2;
    rightRail.position.set(halfSpan, ry, 0);
    group.add(rightRail);

    // Front short flanking rails
    const frontShortGeo = new THREE.BoxGeometry(halfSpan * 0.58, 0.07, 0.07);
    const fl = addShadow(new THREE.Mesh(frontShortGeo, woodMat));
    fl.position.set(-halfSpan * 0.71, ry, halfSpan);
    group.add(fl);
    const fr = addShadow(new THREE.Mesh(frontShortGeo, woodMat));
    fr.position.set(halfSpan * 0.71, ry, halfSpan);
    group.add(fr);
  }
}

export interface BuiltEnclosure {
  group: THREE.Group;
  animalRig: AnimatedAnimalRig;
  hitProxy: THREE.Mesh;
}

export function buildEnclosureModel(
  enc: EnclosureItem,
  textures: ProceduralTextureSet,
  isSoftwareGl: boolean,
): BuiltEnclosure {
  const group = new THREE.Group();
  const pos = gridToWorld(enc.gridX, enc.gridZ, 2);
  group.position.copy(pos);

  const woodMat = new THREE.MeshStandardMaterial({
    map: textures.woodGrain,
    roughness: 0.78,
    metalness: 0.04,
  });
  const capMat = new THREE.MeshStandardMaterial({ color: 0xc99654, roughness: 0.55, metalness: 0.12 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8d8f8c, roughness: 0.88, metalness: 0.05 });

  const padPalette: Record<EnclosureItem['species'], number> = {
    raccoon: 0x6f9450,
    gorilla: 0x568443,
    butterfly: 0x86ab5f,
    wolf: 0x677c64,
    red_panda: 0x668f4a,
    golden_fox: 0x99904c,
    snow_leopard: 0x8da0ad,
    river_otter: 0x5d8d78,
  };
  const padColor = padPalette[enc.species] ?? 0x6f9450;
  const pad = addShadow(
    new THREE.Mesh(
      new THREE.BoxGeometry(TILE_SIZE * 2 - 0.14, 0.12, TILE_SIZE * 2 - 0.14),
      new THREE.MeshStandardMaterial({ color: padColor, roughness: 0.92 }),
    ),
    false,
    true,
  );
  pad.position.y = 0.06;
  group.add(pad);

  // Species-specific Custom Habitat Architecture
  if (enc.species === 'raccoon') {
    buildFencePerimeter(group, 1.82, woodMat, capMat);

    // Hollowed Cedar Den Log
    const log = addShadow(
      new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.48, 1.35, 14),
        new THREE.MeshStandardMaterial({ map: textures.woodGrain, color: 0x7b4f2d, roughness: 0.85 }),
      ),
    );
    log.rotation.z = Math.PI / 2;
    log.rotation.y = 0.35;
    log.position.set(-0.82, 0.45, -0.92);
    group.add(log);

    const logHole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 1.38, 12),
      new THREE.MeshStandardMaterial({ color: 0x22170e, roughness: 0.95 }),
    );
    logHole.rotation.copy(log.rotation);
    logHole.position.copy(log.position);
    group.add(logHole);

    // Mossy Creek Washbasin
    const basinRim = addShadow(new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.11, 8, 16), stoneMat));
    basinRim.rotation.x = Math.PI / 2;
    basinRim.position.set(0.95, 0.16, -0.82);
    group.add(basinRim);

    const waterDisc = new THREE.Mesh(
      new THREE.CircleGeometry(0.5, 16),
      new THREE.MeshStandardMaterial({
        map: textures.waterRipple,
        roughness: 0.16,
        metalness: 0.18,
      }),
    );
    waterDisc.rotation.x = -Math.PI / 2;
    waterDisc.position.set(0.95, 0.17, -0.82);
    group.add(waterDisc);

    // Berry Bush Cluster
    const bushMat = new THREE.MeshStandardMaterial({ color: 0x3b7638, roughness: 0.82 });
    const berryMat = new THREE.MeshStandardMaterial({ color: 0xc93855, roughness: 0.35 });
    const bush = addShadow(new THREE.Mesh(new THREE.DodecahedronGeometry(0.42, 1), bushMat));
    bush.position.set(1.15, 0.4, 0.85);
    group.add(bush);
    for (let i = 0; i < 6; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), berryMat);
      const a = (i / 6) * Math.PI * 2;
      b.position.set(1.15 + Math.cos(a) * 0.34, 0.48 + (i % 2) * 0.12, 0.85 + Math.sin(a) * 0.34);
      group.add(b);
    }

    // Tree-Climbing Cedar Structure (vertical foraging perch & branch ladder)
    const climbTrunk = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 1.65, 8), woodMat));
    climbTrunk.position.set(-1.12, 0.86, 0.78);
    group.add(climbTrunk);
    const perchPlatform = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.34, 0.1, 8), capMat));
    perchPlatform.position.set(-1.12, 1.52, 0.78);
    group.add(perchPlatform);
    const branchRamp = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.92), woodMat));
    branchRamp.position.set(-1.08, 0.92, 0.36);
    branchRamp.rotation.x = 0.52;
    group.add(branchRamp);
  } else if (enc.species === 'gorilla') {
    const bambooMat = new THREE.MeshStandardMaterial({ color: 0x5c9646, roughness: 0.55 });
    buildFencePerimeter(group, 1.82, bambooMat, capMat);

    // Tiered Rainforest Waterfall Rock Ledge
    const rock1 = addShadow(new THREE.Mesh(new THREE.DodecahedronGeometry(0.75, 1), stoneMat));
    rock1.scale.set(1.3, 1.1, 0.9);
    rock1.position.set(-0.92, 0.65, -0.95);
    group.add(rock1);

    const rock2 = addShadow(new THREE.Mesh(new THREE.DodecahedronGeometry(0.52, 1), stoneMat));
    rock2.position.set(-0.22, 0.42, -1.15);
    group.add(rock2);

    const cascade = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42, 0.92),
      new THREE.MeshStandardMaterial({
        map: textures.waterRipple,
        color: 0x7bd3f0,
        roughness: 0.15,
        metalness: 0.12,
        side: THREE.DoubleSide,
      }),
    );
    cascade.position.set(-0.88, 0.55, -0.35);
    cascade.rotation.x = -0.25;
    group.add(cascade);

    // Banana Palm Tree
    const trunk = addShadow(
      new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.17, 1.75, 8),
        new THREE.MeshStandardMaterial({ color: 0x7d5837, roughness: 0.88 }),
      ),
    );
    trunk.position.set(1.12, 0.92, -0.98);
    trunk.rotation.z = 0.14;
    group.add(trunk);

    const frondMat = new THREE.MeshStandardMaterial({ color: 0x3b8e40, roughness: 0.68, side: THREE.DoubleSide });
    for (let i = 0; i < 6; i++) {
      const frond = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.05, 5), frondMat));
      const ang = (i / 6) * Math.PI * 2;
      frond.position.set(1.0 + Math.cos(ang) * 0.45, 1.72, -0.98 + Math.sin(ang) * 0.45);
      frond.rotation.z = Math.cos(ang) * -1.1;
      frond.rotation.x = Math.sin(ang) * 1.1;
      group.add(frond);
    }
  } else if (enc.species === 'butterfly') {
    // Sunlit Brass & Glass Conservatory Gazebo
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xc59a45,
      roughness: 0.28,
      metalness: 0.82,
    });
    const sandstoneMat = new THREE.MeshStandardMaterial({ color: 0xd8cdb8, roughness: 0.78 });

    const patio = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(1.78, 1.85, 0.16, 8), sandstoneMat), false, true);
    patio.position.y = 0.12;
    group.add(patio);

    // 6 Brass conservatory columns
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const col = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, 1.85, 8), brassMat));
      col.position.set(Math.cos(a) * 1.48, 1.05, Math.sin(a) * 1.48);
      group.add(col);
    }

    // Ring & Arched Glass Canopy
    const ring = addShadow(new THREE.Mesh(new THREE.TorusGeometry(1.48, 0.055, 8, 24), brassMat));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.96;
    group.add(ring);

    const glassDome = new THREE.Mesh(
      new THREE.SphereGeometry(1.48, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.46),
      new THREE.MeshPhysicalMaterial({
        color: 0xe6f7ff,
        roughness: 0.12,
        metalness: 0.05,
        transparent: true,
        opacity: isSoftwareGl ? 0.26 : 0.22,
        depthWrite: false,
      }),
    );
    glassDome.position.y = 1.96;
    glassDome.renderOrder = 2;
    group.add(glassDome);

    const finial = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.36, 8), brassMat));
    finial.position.y = 3.55;
    group.add(finial);

    // Blooming Lavender & Hibiscus Flowerbeds inside
    const flowerColors = [0x9370db, 0xf27d9b, 0xf9b248, 0x8465c8];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r = 0.92;
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.12, 0.22, 6),
        new THREE.MeshStandardMaterial({ color: 0x458042, roughness: 0.85 }),
      );
      stem.position.set(Math.cos(a) * r, 0.28, Math.sin(a) * r);
      group.add(stem);
      const bloom = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.18, 0),
        new THREE.MeshStandardMaterial({ color: flowerColors[i % flowerColors.length], roughness: 0.65 }),
      );
      bloom.position.set(Math.cos(a) * r, 0.46, Math.sin(a) * r);
      group.add(bloom);
    }

    // Center Brass Nectar Pedestal
    const ped = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.14, 0.56, 10), brassMat));
    ped.position.y = 0.46;
    group.add(ped);
  } else {
    // Wolf Alpine Pine Ridge
    const darkTimber = new THREE.MeshStandardMaterial({ color: 0x5d4534, roughness: 0.85 });
    buildFencePerimeter(group, 1.82, darkTimber, stoneMat);

    // Sculpted Slate Outcrop Ridge
    const slateMat = new THREE.MeshStandardMaterial({ color: 0x67727d, roughness: 0.82, metalness: 0.08 });
    const peak1 = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.42, 6), slateMat));
    peak1.position.set(-0.92, 0.78, -0.96);
    group.add(peak1);
    const peak2 = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.68, 1.05, 6), slateMat));
    peak2.position.set(-0.22, 0.58, -1.12);
    group.add(peak2);

    // Alpine Pine Tree
    const pineTrunk = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.65, 7), darkTimber));
    pineTrunk.position.set(1.12, 0.36, -0.96);
    group.add(pineTrunk);
    const pineMat = new THREE.MeshStandardMaterial({ color: 0x2c5c44, roughness: 0.84 });
    [
      [0.62, 0.82, 0.88],
      [0.48, 0.72, 1.38],
      [0.32, 0.58, 1.82],
    ].forEach(([r, h, y]) => {
      const tier = addShadow(new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), pineMat));
      tier.position.set(1.12, y, -0.96);
      group.add(tier);
    });

    // Warm Ridge Lantern
    const post = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.9, 6), darkTimber));
    post.position.set(1.25, 0.5, 1.15);
    group.add(post);
    const lantern = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.28, 0.22),
      new THREE.MeshStandardMaterial({
        color: 0xffe4a1,
        emissive: 0xf59e2d,
        emissiveIntensity: 0.85,
        roughness: 0.3,
      }),
    );
    lantern.position.set(1.25, 1.0, 1.15);
    group.add(lantern);
  }

  // Contact shadow & Animated Animal Rig inside enclosure
  const animalRig = createAnimalRig(enc.species, enc.variant, textures);
  animalRig.root.position.y = 0.12;
  group.add(animalRig.root);
  group.add(makeContactShadow(textures, enc.species === 'gorilla' ? 1.5 : 1.15));

  // Exotic shimmer halo ring on ground if Exotic Variant!
  if (enc.variant === 'exotic') {
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(1.42, 1.56, 28),
      new THREE.MeshBasicMaterial({
        color: 0xffd56b,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
      }),
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.14;
    group.add(halo);
  }

  // Invisible simplified raycast hit box for effortless mobile & desktop picking
  const hitProxy = new THREE.Mesh(
    new THREE.BoxGeometry(TILE_SIZE * 1.95, 2.4, TILE_SIZE * 1.95),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hitProxy.position.y = 1.2;
  hitProxy.userData = { kind: 'enclosure', id: enc.id };
  group.add(hitProxy);

  return { group, animalRig, hitProxy };
}

// --- CROP PLOT BUILDER (3 visual growth stages + ready-to-harvest golden beacon) ---
export interface BuiltCrop {
  group: THREE.Group;
  hitProxy: THREE.Mesh;
  readyRing: THREE.Mesh;
  plantGroup: THREE.Group;
  crop: CropPlotItem;
}

export function buildCropModel(crop: CropPlotItem, textures: ProceduralTextureSet): BuiltCrop {
  const group = new THREE.Group();
  group.position.copy(gridToWorld(crop.gridX, crop.gridZ, 1));

  const woodMat = new THREE.MeshStandardMaterial({ map: textures.woodGrain, roughness: 0.82 });
  const soilMat = new THREE.MeshStandardMaterial({ map: textures.soilFurrow, roughness: 0.95 });

  // Raised timber garden bed
  const frame = addShadow(new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.2, 1.76), woodMat));
  frame.position.y = 0.1;
  group.add(frame);

  const soil = addShadow(new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.22, 1.56), soilMat), false, true);
  soil.position.y = 0.11;
  group.add(soil);

  const plantGroup = new THREE.Group();
  plantGroup.position.y = 0.22;
  group.add(plantGroup);

  const leafMat = new THREE.MeshStandardMaterial({ color: 0x458b3c, roughness: 0.78 });
  const cropAccentPalette: Record<CropPlotItem['cropType'], number> = {
    berry: 0xc8375a,
    mango: 0xf0a626,
    lavender: 0x8c68d6,
    herb: 0x3da882,
    bamboo_shoot: 0x63ad45,
    fox_berry: 0xe68422,
    ice_fish: 0x5eb3e0,
    river_reed: 0x4c9e8d,
  };
  const accentColor = cropAccentPalette[crop.cropType] ?? 0x3da882;
  const fruitMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.38 });

  const offsets: [number, number][] = [
    [-0.42, -0.42],
    [0.42, -0.42],
    [-0.42, 0.42],
    [0.42, 0.42],
  ];

  for (const [ox, oz] of offsets) {
    if (crop.cropType === 'lavender') {
      const stalk = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.52, 6), fruitMat));
      stalk.position.set(ox, 0.32, oz);
      plantGroup.add(stalk);
      const baseLeaf = addShadow(new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 0), leafMat));
      baseLeaf.position.set(ox, 0.12, oz);
      plantGroup.add(baseLeaf);
    } else if (crop.cropType === 'mango') {
      const stem = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.42, 6), woodMat));
      stem.position.set(ox, 0.2, oz);
      plantGroup.add(stem);
      const canopy = addShadow(new THREE.Mesh(new THREE.DodecahedronGeometry(0.28, 1), leafMat));
      canopy.position.set(ox, 0.48, oz);
      plantGroup.add(canopy);
      const mango = new THREE.Mesh(new THREE.SphereGeometry(0.095, 8, 8), fruitMat);
      mango.position.set(ox + 0.14, 0.44, oz + 0.14);
      plantGroup.add(mango);
    } else {
      const bush = addShadow(new THREE.Mesh(new THREE.DodecahedronGeometry(0.26, 1), leafMat));
      bush.position.set(ox, 0.22, oz);
      plantGroup.add(bush);
      const berry = new THREE.Mesh(new THREE.SphereGeometry(0.08, 7, 7), fruitMat);
      berry.position.set(ox + 0.1, 0.34, oz + 0.08);
      plantGroup.add(berry);
    }
  }

  // Golden ready-to-harvest ring indicator
  const readyRing = new THREE.Mesh(
    new THREE.RingGeometry(0.76, 0.9, 24),
    new THREE.MeshBasicMaterial({
      color: 0xffd152,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    }),
  );
  readyRing.rotation.x = -Math.PI / 2;
  readyRing.position.y = 0.25;
  readyRing.visible = false;
  group.add(readyRing);

  const hitProxy = new THREE.Mesh(
    new THREE.BoxGeometry(1.85, 1.35, 1.85),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hitProxy.position.y = 0.65;
  hitProxy.userData = { kind: 'crop', id: crop.id };
  group.add(hitProxy);

  return { group, hitProxy, readyRing, plantGroup, crop };
}

// --- HABITAT DECORATION BUILDERS (10 rich composite 3D props) ---
export function buildDecorationModel(
  decorType: DecorTypeId,
  gridX: number,
  gridZ: number,
  rotation: number,
  textures: ProceduralTextureSet,
): THREE.Group {
  const group = new THREE.Group();
  group.position.copy(gridToWorld(gridX, gridZ, 1));
  group.rotation.y = (rotation % 4) * (Math.PI / 2);

  const woodMat = new THREE.MeshStandardMaterial({ map: textures.woodGrain, roughness: 0.8 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x9b988e, roughness: 0.85 });

  switch (decorType) {
    case 'willow': {
      const trunk = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 1.35, 8), woodMat));
      trunk.position.y = 0.68;
      group.add(trunk);
      const canopyMat = new THREE.MeshStandardMaterial({ color: 0x5c9648, roughness: 0.8 });
      const crown = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.78, 12, 10), canopyMat));
      crown.scale.set(1.15, 0.8, 1.15);
      crown.position.y = 1.55;
      group.add(crown);
      // Trailing willow drapes
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const drape = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.14, 0.85, 6), canopyMat));
        drape.position.set(Math.cos(a) * 0.62, 1.05, Math.sin(a) * 0.62);
        group.add(drape);
      }
      group.add(makeContactShadow(textures, 1.8));
      break;
    }
    case 'autumn_maple': {
      const trunk = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.2, 1.25, 8), woodMat));
      trunk.position.y = 0.62;
      group.add(trunk);
      const mapleColors = [0xd6562b, 0xe8832c, 0xb83823];
      const clusters: [number, number, number, number][] = [
        [0, 1.65, 0, 0.68],
        [-0.36, 1.42, 0.22, 0.48],
        [0.36, 1.45, -0.18, 0.5],
      ];
      clusters.forEach(([x, y, z, r], idx) => {
        const puff = addShadow(
          new THREE.Mesh(
            new THREE.DodecahedronGeometry(r, 1),
            new THREE.MeshStandardMaterial({ color: mapleColors[idx % mapleColors.length], roughness: 0.78 }),
          ),
        );
        puff.position.set(x, y, z);
        group.add(puff);
      });
      group.add(makeContactShadow(textures, 1.75));
      break;
    }
    case 'bamboo': {
      const stalkMat = new THREE.MeshStandardMaterial({ color: 0x569c46, roughness: 0.5 });
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x73b856, roughness: 0.7 });
      const coords: [number, number, number][] = [
        [-0.3, -0.25, 1.65],
        [0.25, -0.2, 1.95],
        [0.0, 0.28, 1.5],
        [0.36, 0.26, 1.25],
      ];
      for (const [bx, bz, bh] of coords) {
        const s = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, bh, 7), stalkMat));
        s.position.set(bx, bh / 2, bz);
        group.add(s);
        const tuft = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.45, 5), leafMat));
        tuft.position.set(bx, bh + 0.12, bz);
        group.add(tuft);
      }
      group.add(makeContactShadow(textures, 1.4));
      break;
    }
    case 'koi_pond': {
      const rim = addShadow(new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.14, 8, 18), stoneMat));
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.12;
      group.add(rim);
      const water = new THREE.Mesh(
        new THREE.CircleGeometry(0.72, 18),
        new THREE.MeshStandardMaterial({ map: textures.waterRipple, roughness: 0.14, metalness: 0.18 }),
      );
      water.rotation.x = -Math.PI / 2;
      water.position.y = 0.14;
      group.add(water);
      // Lily pad & Koi fish accent
      const lily = new THREE.Mesh(
        new THREE.CircleGeometry(0.18, 10),
        new THREE.MeshStandardMaterial({ color: 0x459240, roughness: 0.7 }),
      );
      lily.rotation.x = -Math.PI / 2;
      lily.position.set(-0.24, 0.16, 0.18);
      group.add(lily);
      const koi = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.05, 0.16, 4, 6),
        new THREE.MeshStandardMaterial({ color: 0xf46c2e, roughness: 0.3 }),
      );
      koi.rotation.z = Math.PI / 2;
      koi.position.set(0.2, 0.17, -0.14);
      group.add(koi);
      break;
    }
    case 'fountain': {
      const base = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.85, 0.34, 12), stoneMat));
      base.position.y = 0.17;
      group.add(base);
      const basin = new THREE.Mesh(
        new THREE.CircleGeometry(0.68, 12),
        new THREE.MeshStandardMaterial({ map: textures.waterRipple, roughness: 0.12, metalness: 0.2 }),
      );
      basin.rotation.x = -Math.PI / 2;
      basin.position.y = 0.35;
      group.add(basin);
      const pillar = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.05, 10), stoneMat));
      pillar.position.y = 0.68;
      group.add(pillar);
      const bowl = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.18, 0.22, 12), stoneMat));
      bowl.position.y = 1.15;
      group.add(bowl);
      const finial = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), stoneMat));
      finial.position.y = 1.4;
      group.add(finial);
      break;
    }
    case 'lantern_post': {
      const base = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.18, 0.46), stoneMat));
      base.position.y = 0.09;
      group.add(base);
      const post = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.45, 8), woodMat));
      post.position.y = 0.82;
      group.add(post);
      const arm = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.08, 0.08), woodMat));
      arm.position.set(0.2, 1.48, 0);
      group.add(arm);
      const glow = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.15, 0.34, 10),
        new THREE.MeshStandardMaterial({
          color: 0xffebb2,
          emissive: 0xf08c24,
          emissiveIntensity: 0.95,
          roughness: 0.35,
        }),
      );
      glow.position.set(0.38, 1.24, 0);
      group.add(glow);
      const cap = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.15, 8), woodMat));
      cap.position.set(0.38, 1.46, 0);
      group.add(cap);
      group.add(makeContactShadow(textures, 1.0));
      break;
    }
    case 'flower_arch': {
      const arch = addShadow(new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.1, 8, 16, Math.PI), woodMat));
      arch.position.y = 1.05;
      group.add(arch);
      [-0.76, 0.76].forEach((px) => {
        const leg = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.08, 8), woodMat));
        leg.position.set(px, 0.54, 0);
        group.add(leg);
      });
      const roseColors = [0xe86b8a, 0xffb3c1, 0xf7c948];
      for (let i = 0; i < 7; i++) {
        const a = (i / 6) * Math.PI;
        const rose = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.14, 0),
          new THREE.MeshStandardMaterial({ color: roseColors[i % roseColors.length], roughness: 0.6 }),
        );
        rose.position.set(Math.cos(a) * 0.78, 1.08 + Math.sin(a) * 0.78, 0.08);
        group.add(rose);
      }
      break;
    }
    case 'gazebo': {
      const deck = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.88, 0.92, 0.18, 8), woodMat));
      deck.position.y = 0.09;
      group.add(deck);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const p = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.35, 6), woodMat));
        p.position.set(Math.cos(a) * 0.68, 0.84, Math.sin(a) * 0.68);
        group.add(p);
      }
      const roof = addShadow(
        new THREE.Mesh(
          new THREE.ConeGeometry(1.08, 0.62, 8),
          new THREE.MeshStandardMaterial({ color: 0xb65239, roughness: 0.72 }),
        ),
      );
      roof.position.y = 1.82;
      group.add(roof);
      group.add(makeContactShadow(textures, 1.9));
      break;
    }
    case 'cobble_path': {
      const tile = new THREE.Mesh(
        new THREE.BoxGeometry(1.94, 0.07, 1.94),
        new THREE.MeshStandardMaterial({ map: textures.cobbleStone, roughness: 0.88 }),
      );
      tile.position.y = 0.035;
      tile.receiveShadow = true;
      group.add(tile);
      break;
    }
    case 'hay_cart': {
      const bed = addShadow(new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.28, 0.78), woodMat));
      bed.position.y = 0.42;
      group.add(bed);
      const hayMat = new THREE.MeshStandardMaterial({ color: 0xdca944, roughness: 0.92 });
      const bale1 = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.36, 0.62), hayMat));
      bale1.position.set(-0.22, 0.72, 0);
      group.add(bale1);
      const bale2 = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.32, 0.56), hayMat));
      bale2.position.set(0.28, 0.7, 0);
      bale2.rotation.z = -0.14;
      group.add(bale2);
      const wheelGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.08, 12);
      [-0.44, 0.44].forEach((wz) => {
        const w = addShadow(new THREE.Mesh(wheelGeo, woodMat));
        w.rotation.x = Math.PI / 2;
        w.position.set(0, 0.26, wz);
        group.add(w);
      });
      group.add(makeContactShadow(textures, 1.5));
      break;
    }
  }

  return group;
}

// --- LUSH OUTDOOR SANCTUARY ENVIRONMENT (extends far beyond playable grid to horizon fog) ---
export function buildSurroundingWorld(textures: ProceduralTextureSet): THREE.Group {
  const world = new THREE.Group();

  // Vast rolling meadow ground plane
  const groundMat = new THREE.MeshStandardMaterial({
    map: textures.meadowGrass,
    color: 0xffffff,
    roughness: 0.95,
    metalness: 0.0,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(150, 150), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  ground.name = 'sanctuary_ground_outer';
  world.add(ground);

  // Subtle playable sanctuary meadow lawn inset (12x12 = 24x24 units)
  const lawnMat = new THREE.MeshStandardMaterial({
    color: 0x82b860,
    roughness: 0.92,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  const sanctuaryLawn = new THREE.Mesh(new THREE.BoxGeometry(24.6, 0.06, 24.6), lawnMat);
  sanctuaryLawn.position.y = -0.03;
  sanctuaryLawn.receiveShadow = true;
  sanctuaryLawn.name = 'sanctuary_ground_lawn';
  world.add(sanctuaryLawn);
  world.userData.groundMat = groundMat;
  world.userData.lawnMat = lawnMat;

  // Subtle meadow plot grid lines (warm pale grass lines)
  const gridHelper = new THREE.GridHelper(24, 12, 0x629644, 0x6ca34d);
  gridHelper.position.y = 0.015;
  const gMat = gridHelper.material as THREE.Material;
  gMat.transparent = true;
  gMat.opacity = 0.24;
  world.add(gridHelper);

  // Meandering Sparkling Brook along South-East outer perimeter
  const brookPoints = [
    new THREE.Vector3(-42, 0.03, 18),
    new THREE.Vector3(-18, 0.03, 16.5),
    new THREE.Vector3(0, 0.03, 17.5),
    new THREE.Vector3(16.8, 0.03, 15.8),
    new THREE.Vector3(19.5, 0.03, 0),
    new THREE.Vector3(18.5, 0.03, -24),
    new THREE.Vector3(24, 0.03, -46),
  ];
  const brookCurve = new THREE.CatmullRomCurve3(brookPoints);
  const brookGeo = new THREE.TubeGeometry(brookCurve, 48, 2.2, 6, false);
  brookGeo.scale(1, 0.05, 1);
  const brook = new THREE.Mesh(
    brookGeo,
    new THREE.MeshStandardMaterial({
      map: textures.waterRipple,
      roughness: 0.14,
      metalness: 0.2,
    }),
  );
  brook.position.y = 0.02;
  world.add(brook);

  // Cozy Wooden Footbridge crossing the brook on the south edge
  const bridgeGroup = new THREE.Group();
  bridgeGroup.position.set(0, 0.18, 17.4);
  const bridgeWood = new THREE.MeshStandardMaterial({ map: textures.woodGrain, roughness: 0.8 });
  const deck = addShadow(new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.18, 5.2), bridgeWood));
  bridgeGroup.add(deck);
  [-1.5, 1.5].forEach((rx) => {
    const rail = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.55, 5.2), bridgeWood));
    rail.position.set(rx, 0.34, 0);
    bridgeGroup.add(rail);
  });
  world.add(bridgeGroup);

  // Distant rolling meadow hills around the perimeter
  const hillMat = new THREE.MeshStandardMaterial({ color: 0x669b4e, roughness: 0.94 });
  const hillConfigs: [number, number, number, number][] = [
    [-28, -26, 14, 4.2],
    [0, -34, 18, 5.0],
    [32, -26, 15, 4.6],
    [-34, 4, 15, 3.8],
    [36, 14, 16, 4.2],
    [-26, 34, 16, 3.6],
    [24, 34, 15, 3.8],
  ];
  for (const [hx, hz, hr, hh] of hillConfigs) {
    const hill = new THREE.Mesh(new THREE.SphereGeometry(hr, 16, 10), hillMat);
    hill.scale.set(1, hh / hr, 1);
    hill.position.set(hx, -hh * 0.25, hz);
    hill.receiveShadow = true;
    world.add(hill);
  }

  // InstancedMesh Perimeter Pine Forest (72 trees with per-instance scale & tint variation!)
  const treeCount = 72;
  const trunkInst = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.18, 0.28, 1.4, 7),
    new THREE.MeshStandardMaterial({ color: 0x6b4b32, roughness: 0.9 }),
    treeCount,
  );
  const foliageLowInst = new THREE.InstancedMesh(
    new THREE.ConeGeometry(1.15, 2.2, 7),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 }),
    treeCount,
  );
  const foliageTopInst = new THREE.InstancedMesh(
    new THREE.ConeGeometry(0.82, 1.85, 7),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 }),
    treeCount,
  );
  trunkInst.castShadow = true;
  foliageLowInst.castShadow = true;
  foliageTopInst.castShadow = true;

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const palette = [0x3d7443, 0x4b8546, 0x2f633e, 0x5d8f44, 0xb8582e]; // includes occasional autumn trees!

  let placed = 0;
  let attempt = 0;
  while (placed < treeCount && attempt < 400) {
    attempt++;
    const angle = (attempt / treeCount) * Math.PI * 2 + (Math.sin(attempt * 12.98) * 0.5);
    const radius = 17.5 + ((attempt * 7.31) % 20);
    const tx = Math.cos(angle) * radius;
    const tz = Math.sin(angle) * radius;
    // Keep clear of playable sanctuary & south bridge entrance
    if (Math.abs(tx) < 14.2 && Math.abs(tz) < 14.2) continue;
    if (Math.abs(tx) < 4 && tz > 12 && tz < 23) continue;

    const sc = 0.85 + ((attempt * 1.618) % 0.35);
    dummy.position.set(tx, 0.7 * sc, tz);
    dummy.scale.set(sc, sc, sc);
    dummy.rotation.y = (attempt * 2.1) % (Math.PI * 2);
    dummy.updateMatrix();
    trunkInst.setMatrixAt(placed, dummy.matrix);

    dummy.position.set(tx, 2.0 * sc, tz);
    dummy.updateMatrix();
    foliageLowInst.setMatrixAt(placed, dummy.matrix);

    dummy.position.set(tx, 3.15 * sc, tz);
    dummy.updateMatrix();
    foliageTopInst.setMatrixAt(placed, dummy.matrix);

    color.setHex(palette[placed % palette.length]);
    foliageLowInst.setColorAt(placed, color);
    color.offsetHSL(0, 0.03, 0.04);
    foliageTopInst.setColorAt(placed, color);
    placed++;
  }
  trunkInst.count = placed;
  foliageLowInst.count = placed;
  foliageTopInst.count = placed;
  trunkInst.computeBoundingSphere();
  foliageLowInst.computeBoundingSphere();
  foliageTopInst.computeBoundingSphere();
  world.add(trunkInst, foliageLowInst, foliageTopInst);

  // InstancedMesh Wildflower Clusters outside the sanctuary border
  const flowerCount = 90;
  const flowerInst = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(0.16, 0),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }),
    flowerCount,
  );
  const fColors = [0xffe169, 0xff9bb3, 0xb497f0, 0xfff8e7];
  for (let i = 0; i < flowerCount; i++) {
    const a = (i / flowerCount) * Math.PI * 2;
    const r = 13.4 + ((i * 5.7) % 8.5);
    const fx = Math.cos(a) * r;
    const fz = Math.sin(a) * r;
    const sc = 0.75 + (i % 4) * 0.14;
    dummy.position.set(fx, 0.12 * sc, fz);
    dummy.scale.set(sc, sc, sc);
    dummy.updateMatrix();
    flowerInst.setMatrixAt(i, dummy.matrix);
    color.setHex(fColors[i % fColors.length]);
    flowerInst.setColorAt(i, color);
  }
  flowerInst.computeBoundingSphere();
  world.add(flowerInst);

  return world;
}
