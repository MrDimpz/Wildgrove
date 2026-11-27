import * as THREE from 'three';
import type { CropPlotItem, DecorTypeId, EnclosureItem } from '../types/game';
import { getDecorFootprint } from '../data/catalog';
import type { ProceduralTextureSet } from './proceduralTextures';
import { createAnimalRig, type AnimatedAnimalRig } from './animalModels';
import {
  addInkOutline,
  addPuffyFoliageCluster,
  createRoundedBoxGeometry,
  getToonGradientMap,
  toonMat,
} from './cartoonStyle';

export const TILE_SIZE = 2.0;

export function gridToWorld(
  gx: number,
  gz: number,
  footprint: 1 | 2 = 1,
  gridSize = 12,
): THREE.Vector3 {
  const halfBoard = (gridSize * TILE_SIZE) / 2;
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
      opacity: 0.42,
    }),
  );
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = 0.025;
  return plane;
}

/**
 * Hand-crafted rounded cartoon log fence with slightly tilted CapsuleGeometry posts,
 * smooth acorn finial knobs, and rounded wooden log rails (zero sharp boxes!).
 */
function buildFencePerimeter(
  group: THREE.Group,
  halfSpan: number,
  woodMat: THREE.Material,
  postCapMat: THREE.Material,
): void {
  const postGeo = new THREE.CapsuleGeometry(0.088, 0.46, 6, 10);
  const capGeo = new THREE.SphereGeometry(0.115, 10, 8);
  const fullRailGeo = new THREE.CapsuleGeometry(0.044, halfSpan * 2 - 0.06, 5, 8);
  const frontShortGeo = new THREE.CapsuleGeometry(0.044, halfSpan * 0.56, 5, 8);

  const posts: [number, number, number][] = [
    [-halfSpan, -halfSpan, 0.03],
    [halfSpan, -halfSpan, -0.025],
    [-halfSpan, halfSpan, -0.03],
    [halfSpan, halfSpan, 0.025],
    [0, -halfSpan, 0.02],
    [-halfSpan, 0, -0.02],
    [halfSpan, 0, 0.025],
  ];

  posts.forEach(([px, pz, tilt], idx) => {
    const post = addShadow(new THREE.Mesh(postGeo, woodMat));
    post.position.set(px, 0.34, pz);
    post.rotation.z = tilt;
    post.rotation.x = idx % 2 === 0 ? tilt * 0.7 : -tilt * 0.6;
    if (idx < 4) {
      addInkOutline(post, 1.08);
    }
    group.add(post);

    const cap = addShadow(new THREE.Mesh(capGeo, postCapMat));
    cap.scale.set(1.05, 0.78, 1.05);
    cap.position.set(px, 0.65, pz);
    group.add(cap);
  });

  // Rounded wooden rails on back, left, right + cozy front opening
  for (const ry of [0.26, 0.48]) {
    const backRail = addShadow(new THREE.Mesh(fullRailGeo, woodMat));
    backRail.rotation.z = Math.PI / 2;
    backRail.position.set(0, ry, -halfSpan);
    group.add(backRail);

    const leftRail = addShadow(new THREE.Mesh(fullRailGeo, woodMat));
    leftRail.rotation.x = Math.PI / 2;
    leftRail.position.set(-halfSpan, ry, 0);
    group.add(leftRail);

    const rightRail = addShadow(new THREE.Mesh(fullRailGeo, woodMat));
    rightRail.rotation.x = Math.PI / 2;
    rightRail.position.set(halfSpan, ry, 0);
    group.add(rightRail);

    const fl = addShadow(new THREE.Mesh(frontShortGeo, woodMat));
    fl.rotation.z = Math.PI / 2;
    fl.position.set(-halfSpan * 0.71, ry, halfSpan);
    group.add(fl);

    const fr = addShadow(new THREE.Mesh(frontShortGeo, woodMat));
    fr.rotation.z = Math.PI / 2;
    fr.position.set(halfSpan * 0.71, ry, halfSpan);
    group.add(fr);
  }
}

type EmotionKind = 'hungry' | 'groom' | 'happy' | 'baby';
const emotionTextureCache = new Map<EmotionKind, THREE.CanvasTexture>();

function getEmotionBubbleTexture(kind: EmotionKind): THREE.CanvasTexture {
  const cached = emotionTextureCache.get(kind);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 128, 128);
    ctx.fillStyle = 'rgba(255, 251, 244, 0.98)';
    ctx.strokeStyle =
      kind === 'hungry'
        ? '#D96B2B'
        : kind === 'groom'
          ? '#2C86B8'
          : kind === 'baby'
            ? '#E0961E'
            : '#348A56';
    ctx.lineWidth = 7;

    ctx.beginPath();
    ctx.arc(64, 54, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(52, 92);
    ctx.lineTo(64, 114);
    ctx.lineTo(76, 92);
    ctx.closePath();
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (kind === 'hungry') {
      ctx.fillStyle = '#E63B57';
      ctx.beginPath();
      ctx.arc(56, 58, 11, 0, Math.PI * 2);
      ctx.arc(72, 58, 11, 0, Math.PI * 2);
      ctx.arc(64, 46, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#338552';
      ctx.beginPath();
      ctx.ellipse(64, 33, 10, 5, -0.25, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'groom') {
      ctx.fillStyle = '#2B93D1';
      ctx.beginPath();
      ctx.moveTo(64, 30);
      ctx.quadraticCurveTo(82, 56, 64, 76);
      ctx.quadraticCurveTo(46, 56, 64, 30);
      ctx.fill();
      ctx.fillStyle = '#FFF7D6';
      ctx.beginPath();
      ctx.arc(59, 54, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'baby') {
      ctx.fillStyle = '#F2AA24';
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const outer = (i * 2 * Math.PI) / 5 - Math.PI / 2;
        const inner = outer + Math.PI / 5;
        const ox = 64 + Math.cos(outer) * 22;
        const oy = 54 + Math.sin(outer) * 22;
        const ix = 64 + Math.cos(inner) * 10;
        const iy = 54 + Math.sin(inner) * 10;
        if (i === 0) ctx.moveTo(ox, oy);
        else ctx.lineTo(ox, oy);
        ctx.lineTo(ix, iy);
      }
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = '#E8566E';
      ctx.beginPath();
      ctx.moveTo(64, 74);
      ctx.bezierCurveTo(36, 56, 38, 34, 54, 36);
      ctx.bezierCurveTo(61, 37, 64, 44, 64, 44);
      ctx.bezierCurveTo(64, 44, 67, 37, 74, 36);
      ctx.bezierCurveTo(90, 34, 92, 56, 64, 74);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  emotionTextureCache.set(kind, tex);
  return tex;
}

export interface BuiltEnclosure {
  group: THREE.Group;
  animalRig: AnimatedAnimalRig;
  hitProxy: THREE.Mesh;
  emotionSprite: THREE.Sprite | null;
}

export function buildEnclosureModel(
  enc: EnclosureItem,
  textures: ProceduralTextureSet,
  isSoftwareGl: boolean,
  gridSize = 12,
): BuiltEnclosure {
  const group = new THREE.Group();
  const pos = gridToWorld(enc.gridX, enc.gridZ, 2, gridSize);
  group.position.copy(pos);

  const woodMat = toonMat(0xffffff, { map: textures.woodGrain });
  const capMat = toonMat(0xe0aa5e);
  const stoneMat = toonMat(0xa3a59f);

  const padPalette: Record<EnclosureItem['species'], number> = {
    raccoon: 0x7cb858,
    gorilla: 0x62a34b,
    butterfly: 0x94c768,
    wolf: 0x769975,
    red_panda: 0x74ab52,
    golden_fox: 0xb3ab59,
    snow_leopard: 0xa2b9c7,
    river_otter: 0x6ba892,
    tree_frog: 0x63b87c,
    chameleon: 0x72b858,
    giant_tortoise: 0xbfa86b,
    bearded_dragon: 0xdea666,
  };
  const padColor = padPalette[enc.species] ?? 0x7cb858;

  // Pillowy rounded habitat pad (zero sharp 90-degree BoxGeometry!)
  const pad = addShadow(
    new THREE.Mesh(
      createRoundedBoxGeometry(TILE_SIZE * 2 - 0.12, 0.14, TILE_SIZE * 2 - 0.12, 0.28, 3),
      toonMat(padColor),
    ),
    false,
    true,
  );
  pad.position.y = 0.06;
  group.add(pad);

  // Species-specific Custom Storybook Habitat Architecture
  if (enc.species === 'raccoon') {
    buildFencePerimeter(group, 1.82, woodMat, capMat);

    // Hollowed Cedar Den Log with ink outline
    const log = addShadow(
      new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.48, 1.32, 16),
        toonMat(0x946039, { map: textures.woodGrain }),
      ),
    );
    log.rotation.z = Math.PI / 2;
    log.rotation.y = 0.35;
    log.position.set(-0.82, 0.45, -0.92);
    addInkOutline(log, 1.05);
    group.add(log);

    const logHole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 1.35, 14),
      toonMat(0x2b1c12),
    );
    logHole.rotation.copy(log.rotation);
    logHole.position.copy(log.position);
    group.add(logHole);

    // Rounded Pebble-Rimmed Creek Washbasin
    const basinRim = addShadow(new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.12, 10, 18), stoneMat));
    basinRim.rotation.x = Math.PI / 2;
    basinRim.position.set(0.95, 0.17, -0.82);
    addInkOutline(basinRim, 1.05);
    group.add(basinRim);

    const waterDisc = new THREE.Mesh(
      new THREE.CircleGeometry(0.5, 18),
      toonMat(0xffffff, { map: textures.waterRipple, emissive: 0x26799c, emissiveIntensity: 0.18 }),
    );
    waterDisc.rotation.x = -Math.PI / 2;
    waterDisc.position.set(0.95, 0.18, -0.82);
    group.add(waterDisc);

    // Fluffy Cloud Berry Bush Cluster
    addPuffyFoliageCluster(
      group,
      [
        { x: 1.15, y: 0.4, z: 0.85, r: 0.34, tone: 'mid' },
        { x: 0.92, y: 0.34, z: 0.96, r: 0.24, tone: 'shadow' },
        { x: 1.32, y: 0.35, z: 0.72, r: 0.23, tone: 'shadow' },
        { x: 1.14, y: 0.58, z: 0.84, r: 0.24, tone: 'highlight' },
      ],
      0x479642,
      0x74c257,
      0x347335,
      true,
    );
    const berryMat = toonMat(0xe83b62, { emissive: 0x701025, emissiveIntensity: 0.15 });
    for (let i = 0; i < 6; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.068, 8, 8), berryMat);
      const a = (i / 6) * Math.PI * 2;
      b.position.set(1.15 + Math.cos(a) * 0.34, 0.48 + (i % 2) * 0.14, 0.85 + Math.sin(a) * 0.34);
      group.add(b);
    }

    // Rounded Tree-Climbing Perch Structure
    const climbTrunk = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 1.4, 6, 10), woodMat));
    climbTrunk.position.set(-1.12, 0.84, 0.78);
    addInkOutline(climbTrunk, 1.06);
    group.add(climbTrunk);

    const perchPlatform = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.36, 0.12, 12), capMat));
    perchPlatform.position.set(-1.12, 1.54, 0.78);
    addInkOutline(perchPlatform, 1.055);
    group.add(perchPlatform);

    const branchRamp = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.84, 6, 8), woodMat));
    branchRamp.position.set(-1.08, 0.92, 0.36);
    branchRamp.rotation.x = 1.05;
    group.add(branchRamp);
  } else if (enc.species === 'gorilla') {
    const bambooMat = toonMat(0x6ab352);
    buildFencePerimeter(group, 1.82, bambooMat, capMat);

    // Smooth Rounded Moss-Topped Rainforest Waterfall Boulders
    const mossMat = toonMat(0x60ad4e);
    const rock1 = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.72, 14, 10), stoneMat));
    rock1.scale.set(1.26, 1.05, 0.92);
    rock1.position.set(-0.92, 0.62, -0.95);
    addInkOutline(rock1, 1.045);
    group.add(rock1);

    const mossCap = new THREE.Mesh(new THREE.SphereGeometry(0.58, 12, 8), mossMat);
    mossCap.scale.set(1.22, 0.42, 0.88);
    mossCap.position.set(-0.92, 1.15, -0.95);
    group.add(mossCap);

    const rock2 = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), stoneMat));
    rock2.scale.set(1.15, 0.86, 0.98);
    rock2.position.set(-0.22, 0.42, -1.14);
    addInkOutline(rock2, 1.05);
    group.add(rock2);

    const cascade = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.2, 0.68, 6, 10),
      toonMat(0x7be0ff, {
        map: textures.waterRipple,
        emissive: 0x2c8bb0,
        emissiveIntensity: 0.25,
      }),
    );
    cascade.scale.set(1.05, 1.0, 0.32);
    cascade.position.set(-0.88, 0.56, -0.35);
    cascade.rotation.x = -0.25;
    group.add(cascade);

    // Lush Tropical Banana Palm with Puffy Fronds
    const trunk = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 1.5, 6, 10), toonMat(0x946a44)));
    trunk.position.set(1.12, 0.88, -0.98);
    trunk.rotation.z = 0.14;
    addInkOutline(trunk, 1.06);
    group.add(trunk);

    const frondMat = toonMat(0x47a84c);
    const frondLightMat = toonMat(0x74cc5e);
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const frond = addShadow(
        new THREE.Mesh(
          new THREE.SphereGeometry(0.38, 12, 8),
          i % 2 === 0 ? frondLightMat : frondMat,
        ),
      );
      frond.scale.set(0.65, 0.26, 1.65);
      frond.position.set(1.0 + Math.cos(ang) * 0.48, 1.72, -0.98 + Math.sin(ang) * 0.48);
      frond.rotation.y = -ang + Math.PI / 2;
      frond.rotation.x = 0.34;
      addInkOutline(frond, 1.06);
      group.add(frond);
    }
  } else if (enc.species === 'butterfly') {
    // Storybook Brass & Pastel-Glass Conservatory Gazebo
    const brassMat = toonMat(0xe6b853, { emissive: 0x5c3e08, emissiveIntensity: 0.16 });
    const sandstoneMat = toonMat(0xebe0cb);

    const patio = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(1.78, 1.86, 0.16, 16), sandstoneMat), false, true);
    patio.position.y = 0.12;
    group.add(patio);

    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const col = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 1.72, 6, 8), brassMat));
      col.position.set(Math.cos(a) * 1.48, 1.05, Math.sin(a) * 1.48);
      addInkOutline(col, 1.08);
      group.add(col);
    }

    const ring = addShadow(new THREE.Mesh(new THREE.TorusGeometry(1.48, 0.065, 10, 28), brassMat));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.96;
    group.add(ring);

    const glassDome = new THREE.Mesh(
      new THREE.SphereGeometry(1.48, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.46),
      new THREE.MeshPhysicalMaterial({
        color: 0xe6f8ff,
        roughness: 0.1,
        metalness: 0.05,
        transparent: true,
        opacity: isSoftwareGl ? 0.26 : 0.22,
        depthWrite: false,
      }),
    );
    glassDome.position.y = 1.96;
    glassDome.renderOrder = 2;
    group.add(glassDome);

    const finial = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), brassMat));
    finial.scale.set(0.9, 1.45, 0.9);
    finial.position.y = 3.55;
    addInkOutline(finial, 1.07);
    group.add(finial);

    // Puffy Storybook Lavender & Hibiscus Flowerbeds inside
    const flowerColors = [0xa882f2, 0xff8aa8, 0xffbe54, 0x9978e6];
    const leafMat = toonMat(0x52a34c);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r = 0.92;
      const leafPuff = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), leafMat);
      leafPuff.scale.set(1.1, 0.65, 1.1);
      leafPuff.position.set(Math.cos(a) * r, 0.28, Math.sin(a) * r);
      group.add(leafPuff);

      const bloom = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 10, 8),
        toonMat(flowerColors[i % flowerColors.length]),
      );
      bloom.position.set(Math.cos(a) * r, 0.46, Math.sin(a) * r);
      addInkOutline(bloom, 1.07);
      group.add(bloom);
    }

    const ped = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.16, 0.56, 12), brassMat));
    ped.position.y = 0.46;
    addInkOutline(ped, 1.06);
    group.add(ped);
  } else if (enc.species === 'tree_frog') {
    // Lilypad Mist Terrarium
    const reedFenceMat = toonMat(0x5da862);
    buildFencePerimeter(group, 1.82, reedFenceMat, capMat);

    // Sparkling turquoise lotus pond
    const pondRim = addShadow(new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.13, 10, 22), stoneMat));
    pondRim.rotation.x = Math.PI / 2;
    pondRim.position.set(-0.45, 0.16, -0.52);
    addInkOutline(pondRim, 1.045);
    group.add(pondRim);

    const pondWater = new THREE.Mesh(
      new THREE.CircleGeometry(0.88, 22),
      toonMat(0xffffff, { map: textures.waterRipple, emissive: 0x268cb0, emissiveIntensity: 0.22 }),
    );
    pondWater.rotation.x = -Math.PI / 2;
    pondWater.position.set(-0.45, 0.18, -0.52);
    group.add(pondWater);

    // Giant floating cartoon lily pads + pink lotus blossoms
    const lilyMat = toonMat(0x47b54a);
    const lotusMat = toonMat(0xff99bd);
    for (const [lx, lz, lr, hasBloom] of [
      [-0.78, -0.7, 0.3, true],
      [-0.14, -0.34, 0.26, false],
      [-0.42, -0.92, 0.22, true],
    ] as [number, number, number, boolean][]) {
      const padMesh = new THREE.Mesh(new THREE.CylinderGeometry(lr, lr, 0.04, 14), lilyMat);
      padMesh.position.set(lx, 0.2, lz);
      group.add(padMesh);
      if (hasBloom) {
        const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), lotusMat);
        bloom.scale.set(1.15, 0.65, 1.15);
        bloom.position.set(lx, 0.26, lz);
        addInkOutline(bloom, 1.08);
        group.add(bloom);
      }
    }

    // Mossy basking boulder & cattail fern corner
    const mossRock = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 10), stoneMat));
    mossRock.scale.set(1.2, 0.72, 1.0);
    mossRock.position.set(1.02, 0.28, -0.92);
    addInkOutline(mossRock, 1.05);
    group.add(mossRock);

    const cattailMat = toonMat(0x7d4529);
    for (const [cx, cz, ch] of [
      [1.15, 0.85, 0.95],
      [0.88, 1.08, 0.8],
      [1.28, 0.56, 0.72],
    ] as [number, number, number][]) {
      const stalk = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.03, ch, 5, 8), reedFenceMat));
      stalk.position.set(cx, ch * 0.5 + 0.12, cz);
      group.add(stalk);
      const top = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.18, 6, 8), cattailMat));
      top.position.set(cx, ch + 0.04, cz);
      addInkOutline(top, 1.09);
      group.add(top);
    }
  } else if (enc.species === 'chameleon') {
    // Tropical Vine Perch
    const vineWood = toonMat(0x8c623d, { map: textures.woodGrain });
    buildFencePerimeter(group, 1.82, toonMat(0x63ad52), capMat);

    // Sweeping arched driftwood climbing branch
    const branchCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.25, 0.18, -0.95),
      new THREE.Vector3(-0.55, 1.25, -0.85),
      new THREE.Vector3(0.45, 1.48, -0.95),
      new THREE.Vector3(1.18, 0.22, -0.78),
    ]);
    const branch = addShadow(new THREE.Mesh(new THREE.TubeGeometry(branchCurve, 20, 0.12, 10, false), vineWood));
    addInkOutline(branch, 1.06);
    group.add(branch);

    // Puffy tropical foliage & hibiscus blossoms along the branch
    addPuffyFoliageCluster(
      group,
      [
        { x: -0.72, y: 1.28, z: -0.88, r: 0.34, tone: 'mid' },
        { x: 0.55, y: 1.45, z: -0.92, r: 0.38, tone: 'highlight' },
        { x: 1.05, y: 0.55, z: 0.92, r: 0.32, tone: 'shadow' },
        { x: 1.08, y: 0.78, z: 0.9, r: 0.24, tone: 'highlight' },
      ],
      0x47a852,
      0x7dd660,
      0x2f7d42,
      true,
    );

    for (const [fx, fy, fz, col] of [
      [-0.55, 1.54, -0.72, 0xff6e9c],
      [0.65, 1.72, -0.75, 0xffb84d],
      [1.12, 0.92, 0.95, 0xff6e9c],
    ] as [number, number, number, number][]) {
      const hibiscus = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), toonMat(col));
      hibiscus.scale.set(1.15, 0.75, 1.15);
      hibiscus.position.set(fx, fy, fz);
      addInkOutline(hibiscus, 1.08);
      group.add(hibiscus);
    }
  } else if (enc.species === 'giant_tortoise') {
    // Sun-Warmed Terracotta Rockery
    buildFencePerimeter(group, 1.82, woodMat, stoneMat);

    // Stacked smooth basking boulders
    const warmStone = toonMat(0xb8a384);
    const boulder1 = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.68, 14, 10), warmStone));
    boulder1.scale.set(1.28, 0.72, 1.05);
    boulder1.position.set(-0.88, 0.42, -0.92);
    addInkOutline(boulder1, 1.045);
    group.add(boulder1);

    const boulder2 = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.46, 12, 10), stoneMat));
    boulder2.scale.set(1.15, 0.65, 0.95);
    boulder2.position.set(-0.22, 0.28, -1.12);
    addInkOutline(boulder2, 1.05);
    group.add(boulder2);

    // Shallow sandstone drinking pool
    const poolRim = addShadow(new THREE.Mesh(new THREE.TorusGeometry(0.54, 0.1, 8, 18), warmStone));
    poolRim.rotation.x = Math.PI / 2;
    poolRim.position.set(0.95, 0.16, -0.82);
    group.add(poolRim);
    const poolWater = new THREE.Mesh(
      new THREE.CircleGeometry(0.5, 16),
      toonMat(0xffffff, { map: textures.waterRipple, emissive: 0x267e9e, emissiveIntensity: 0.18 }),
    );
    poolWater.rotation.x = -Math.PI / 2;
    poolWater.position.set(0.95, 0.17, -0.82);
    group.add(poolWater);

    // Lush puffy herb & clover snack patch
    addPuffyFoliageCluster(
      group,
      [
        { x: 1.08, y: 0.34, z: 0.88, r: 0.3, tone: 'mid', scaleY: 0.72 },
        { x: 0.82, y: 0.28, z: 1.02, r: 0.22, tone: 'highlight', scaleY: 0.75 },
        { x: -1.08, y: 0.32, z: 0.92, r: 0.28, tone: 'shadow', scaleY: 0.72 },
      ],
      0x58a84c,
      0x88d463,
      0x3d823b,
      true,
    );
  } else if (enc.species === 'bearded_dragon') {
    // Desert Sandstone Sun Oasis
    const desertWood = toonMat(0xb57b48, { map: textures.woodGrain });
    const sandstone = toonMat(0xd97d4a);
    buildFencePerimeter(group, 1.82, desertWood, sandstone);

    // Sculpted smooth red-rock terracotta basking arch
    const archRock = addShadow(new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.24, 10, 18, Math.PI), sandstone));
    archRock.position.set(-0.78, 0.18, -0.92);
    archRock.rotation.y = 0.42;
    addInkOutline(archRock, 1.05);
    group.add(archRock);

    // Cute cartoon ribbed desert cactus with bright pink blossom!
    const cactusMat = toonMat(0x52ad56);
    const cactusBody = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.68, 8, 12), cactusMat));
    cactusBody.position.set(1.08, 0.56, -0.92);
    addInkOutline(cactusBody, 1.06);
    group.add(cactusBody);

    const cactusArm = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.28, 6, 8), cactusMat));
    cactusArm.position.set(0.84, 0.62, -0.88);
    cactusArm.rotation.z = 0.75;
    addInkOutline(cactusArm, 1.07);
    group.add(cactusArm);

    const cactusBloom = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), toonMat(0xff7aa8));
    cactusBloom.position.set(1.08, 1.04, -0.92);
    addInkOutline(cactusBloom, 1.08);
    group.add(cactusBloom);

    // Glowing warm desert sun-stone perch
    const sunPost = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.75, 5, 8), desertWood));
    sunPost.position.set(1.18, 0.46, 1.05);
    group.add(sunPost);
    const sunOrb = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 10),
      toonMat(0xfff099, { emissive: 0xffa626, emissiveIntensity: 0.95 }),
    );
    sunOrb.position.set(1.18, 0.96, 1.05);
    addInkOutline(sunOrb, 1.07);
    group.add(sunOrb);
  } else {
    // Cozy Alpine / Woodland Ridge (Wolf, Red Panda, Golden Fox, Snow Leopard, River Otter)
    const darkTimber = toonMat(0x73543e);
    buildFencePerimeter(group, 1.82, darkTimber, stoneMat);

    // Rounded Sculpted Storybook Slate Outcrop
    const slateMat = toonMat(0x7e8d9c);
    const snowCapMat = toonMat(0xedf6fc);
    const peak1 = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.84, 14, 10), slateMat));
    peak1.scale.set(1.05, 1.45, 0.95);
    peak1.position.set(-0.92, 0.65, -0.96);
    addInkOutline(peak1, 1.045);
    group.add(peak1);

    if (enc.species === 'snow_leopard' || enc.species === 'wolf') {
      const snowCap = new THREE.Mesh(new THREE.SphereGeometry(0.56, 12, 8), snowCapMat);
      snowCap.scale.set(1.05, 0.65, 0.95);
      snowCap.position.set(-0.92, 1.45, -0.96);
      group.add(snowCap);
    }

    const peak2 = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 10), slateMat));
    peak2.scale.set(1.1, 1.15, 0.95);
    peak2.position.set(-0.22, 0.48, -1.12);
    addInkOutline(peak2, 1.05);
    group.add(peak2);

    // Fluffy Cloud-Tiered Cartoon Alpine Tree (zero sharp cones!)
    const pineTrunk = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.55, 6, 8), darkTimber));
    pineTrunk.position.set(1.12, 0.36, -0.96);
    addInkOutline(pineTrunk, 1.07);
    group.add(pineTrunk);

    const treePalette =
      enc.species === 'golden_fox'
        ? [0xe37632, 0xffa447, 0xb84e21]
        : enc.species === 'red_panda'
          ? [0x509e48, 0x7acc5c, 0x387838]
          : [0x3b7a57, 0x5ca674, 0x2a5c42];

    addPuffyFoliageCluster(
      group,
      [
        { x: 1.12, y: 0.92, z: -0.96, r: 0.52, tone: 'shadow', scaleY: 0.78 },
        { x: 0.82, y: 0.96, z: -0.82, r: 0.34, tone: 'mid', scaleY: 0.82 },
        { x: 1.4, y: 0.96, z: -1.08, r: 0.34, tone: 'mid', scaleY: 0.82 },
        { x: 1.12, y: 1.38, z: -0.96, r: 0.44, tone: 'mid', scaleY: 0.86 },
        { x: 1.12, y: 1.78, z: -0.96, r: 0.31, tone: 'highlight', scaleY: 0.9 },
      ],
      treePalette[0],
      treePalette[1],
      treePalette[2],
      true,
    );

    // Charming Rounded Ridge Lantern (no BoxGeometry!)
    const post = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.82, 5, 8), darkTimber));
    post.position.set(1.25, 0.5, 1.15);
    group.add(post);

    const lanternOrb = new THREE.Mesh(
      new THREE.SphereGeometry(0.17, 12, 10),
      toonMat(0xfff0b8, { emissive: 0xffa630, emissiveIntensity: 0.95 }),
    );
    lanternOrb.scale.set(1.0, 1.2, 1.0);
    lanternOrb.position.set(1.25, 1.02, 1.15);
    addInkOutline(lanternOrb, 1.07);
    group.add(lanternOrb);

    const lanternRoof = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), darkTimber));
    lanternRoof.scale.set(1.08, 0.42, 1.08);
    lanternRoof.position.set(1.25, 1.21, 1.15);
    group.add(lanternRoof);
  }

  // Contact shadow & Expressive Animated Animal Rig
  const animalRig = createAnimalRig(enc.species, enc.variant, textures);
  animalRig.root.position.y = 0.12;
  if (enc.isBaby) {
    animalRig.root.scale.multiplyScalar(0.76);
  }
  group.add(animalRig.root);
  group.add(makeContactShadow(textures, enc.species === 'gorilla' ? 1.5 : 1.15));

  // Exotic or Hybrid Baby shimmer halo ring
  if (enc.variant === 'exotic' || enc.isBaby) {
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(1.42, 1.56, 28),
      new THREE.MeshBasicMaterial({
        color: enc.isBaby ? 0xffafd0 : 0xffe078,
        transparent: true,
        opacity: 0.62,
        side: THREE.DoubleSide,
      }),
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.15;
    group.add(halo);
  }

  // 3D Floating Animal Emotion / Status Speech Bubble
  let emotionKind: EmotionKind | null = null;
  if (enc.hunger < 65) {
    emotionKind = 'hungry';
  } else if (enc.grooming < 65) {
    emotionKind = 'groom';
  } else if (enc.isBaby) {
    emotionKind = 'baby';
  } else if (enc.happiness >= 85) {
    emotionKind = 'happy';
  }

  let emotionSprite: THREE.Sprite | null = null;
  if (emotionKind) {
    const mat = new THREE.SpriteMaterial({
      map: getEmotionBubbleTexture(emotionKind),
      transparent: true,
      depthWrite: false,
    });
    emotionSprite = new THREE.Sprite(mat);
    emotionSprite.position.set(0, 2.42, 0);
    emotionSprite.scale.set(0.78, 0.78, 1);
    group.add(emotionSprite);
  }

  // Invisible raycast hit proxy (unchanged gameplay picking)
  const hitProxy = new THREE.Mesh(
    new THREE.BoxGeometry(TILE_SIZE * 1.95, 2.4, TILE_SIZE * 1.95),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hitProxy.position.y = 1.2;
  hitProxy.userData = { kind: 'enclosure', id: enc.id };
  group.add(hitProxy);

  return { group, animalRig, hitProxy, emotionSprite };
}

// --- CROP PLOT BUILDER (Rounded raised storybook beds + fluffy toon plants) ---
export interface BuiltCrop {
  group: THREE.Group;
  hitProxy: THREE.Mesh;
  readyRing: THREE.Mesh;
  plantGroup: THREE.Group;
  crop: CropPlotItem;
}

export function buildCropModel(
  crop: CropPlotItem,
  textures: ProceduralTextureSet,
  gridSize = 12,
): BuiltCrop {
  const group = new THREE.Group();
  group.position.copy(gridToWorld(crop.gridX, crop.gridZ, 1, gridSize));

  const woodMat = toonMat(0xffffff, { map: textures.woodGrain });
  const soilMat = toonMat(0xffffff, { map: textures.soilFurrow });
  const stoneMat = toonMat(0x9ca8b0);

  const outerBedGeo = createRoundedBoxGeometry(1.78, 0.22, 1.78, 0.22, 3);
  const innerBedGeo = createRoundedBoxGeometry(1.54, 0.22, 1.54, 0.16, 3);

  if (crop.cropType === 'ice_fish') {
    const basinFrame = addShadow(new THREE.Mesh(outerBedGeo, stoneMat));
    basinFrame.position.y = 0.11;
    group.add(basinFrame);
    const glacialWater = new THREE.Mesh(
      innerBedGeo,
      toonMat(0x8ce2ff, { map: textures.waterRipple, emissive: 0x247ca8, emissiveIntensity: 0.22 }),
    );
    glacialWater.position.y = 0.125;
    group.add(glacialWater);
  } else if (crop.cropType === 'river_reed') {
    const marshWood = toonMat(0x8c7054, { map: textures.woodGrain });
    const frame = addShadow(new THREE.Mesh(outerBedGeo, marshWood));
    frame.position.y = 0.1;
    group.add(frame);
    const wetSoil = addShadow(
      new THREE.Mesh(innerBedGeo, toonMat(0x7d7460, { map: textures.soilFurrow })),
      false,
      true,
    );
    wetSoil.position.y = 0.11;
    group.add(wetSoil);
    const creekStrip = new THREE.Mesh(
      createRoundedBoxGeometry(1.5, 0.23, 0.56, 0.14, 2),
      toonMat(0x6bd4c3, { map: textures.waterRipple, emissive: 0x1d7569, emissiveIntensity: 0.18 }),
    );
    creekStrip.position.y = 0.12;
    group.add(creekStrip);
  } else if (crop.cropType === 'herb') {
    const herbStone = toonMat(0xb3ada0);
    const frame = addShadow(new THREE.Mesh(outerBedGeo, herbStone));
    frame.position.y = 0.1;
    group.add(frame);
    const soil = addShadow(new THREE.Mesh(innerBedGeo, soilMat), false, true);
    soil.position.y = 0.115;
    group.add(soil);
  } else if (crop.cropType === 'lotus_dew') {
    const mossyStone = toonMat(0x7c987a);
    const frame = addShadow(new THREE.Mesh(outerBedGeo, mossyStone));
    frame.position.y = 0.11;
    group.add(frame);
    const pondWater = new THREE.Mesh(
      innerBedGeo,
      toonMat(0x52c7b8, { map: textures.waterRipple, emissive: 0x1b6d66, emissiveIntensity: 0.2 }),
    );
    pondWater.position.y = 0.125;
    group.add(pondWater);
  } else if (crop.cropType === 'cactus_fig') {
    const sandstoneMat = toonMat(0xd49662);
    const sandMat = toonMat(0xe8c488);
    const frame = addShadow(new THREE.Mesh(outerBedGeo, sandstoneMat));
    frame.position.y = 0.1;
    group.add(frame);
    const sandBed = addShadow(new THREE.Mesh(innerBedGeo, sandMat), false, true);
    sandBed.position.y = 0.115;
    group.add(sandBed);
  } else {
    const frame = addShadow(new THREE.Mesh(outerBedGeo, woodMat));
    frame.position.y = 0.1;
    group.add(frame);
    const soil = addShadow(new THREE.Mesh(innerBedGeo, soilMat), false, true);
    soil.position.y = 0.115;
    group.add(soil);
  }

  const plantGroup = new THREE.Group();
  plantGroup.position.y = 0.22;
  group.add(plantGroup);

  const offsets: [number, number][] = [
    [-0.4, -0.4],
    [0.4, -0.4],
    [-0.4, 0.4],
    [0.4, 0.4],
  ];

  switch (crop.cropType) {
    case 'berry': {
      const berryMat = toonMat(0xf03561, { emissive: 0x701026, emissiveIntensity: 0.15 });
      for (const px of [-0.62, 0.62]) {
        const post = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.62, 5, 8), woodMat));
        post.position.set(px, 0.34, 0);
        plantGroup.add(post);
      }
      const rail = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 1.26, 5, 8), woodMat));
      rail.rotation.z = Math.PI / 2;
      rail.position.set(0, 0.56, 0);
      plantGroup.add(rail);

      const bushMid = toonMat(0x3e8f42);
      const bushTop = toonMat(0x64ba56);
      for (const [ox, oz] of offsets) {
        const bush = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 10), bushMid));
        bush.scale.set(1.12, 0.82, 1.12);
        bush.position.set(ox, 0.19, oz);
        addInkOutline(bush, 1.06);
        plantGroup.add(bush);

        const puffTop = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), bushTop);
        puffTop.position.set(ox, 0.34, oz);
        plantGroup.add(puffTop);

        const berryPositions: [number, number, number][] = [
          [ox + 0.12, 0.35, oz + 0.12],
          [ox - 0.1, 0.37, oz + 0.08],
          [ox + 0.05, 0.42, oz - 0.1],
        ];
        for (const [bx, by, bz] of berryPositions) {
          const b = new THREE.Mesh(new THREE.SphereGeometry(0.072, 8, 8), berryMat);
          b.position.set(bx, by, bz);
          plantGroup.add(b);
        }
      }
      break;
    }

    case 'mango': {
      const barkMat = toonMat(0x946842);
      const mangoMat = toonMat(0xffb429, { emissive: 0x7d4500, emissiveIntensity: 0.15 });
      const saplingPos: [number, number, number][] = [
        [-0.36, -0.26, 0.92],
        [0.36, 0.28, 0.78],
      ];
      for (const [sx, sz, h] of saplingPos) {
        const trunk = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.075, h * 0.62, 6, 8), barkMat));
        trunk.position.set(sx, h * 0.34, sz);
        trunk.rotation.z = sx < 0 ? -0.1 : 0.12;
        addInkOutline(trunk, 1.07);
        plantGroup.add(trunk);

        addPuffyFoliageCluster(
          plantGroup,
          [
            { x: sx, y: h * 0.78, z: sz, r: 0.32, tone: 'mid', scaleY: 0.85 },
            { x: sx - 0.18, y: h * 0.74, z: sz + 0.12, r: 0.21, tone: 'shadow' },
            { x: sx + 0.14, y: h * 0.92, z: sz - 0.06, r: 0.22, tone: 'highlight' },
          ],
          0x4cad44,
          0x7cd65c,
          0x388738,
          true,
        );

        for (let i = 0; i < 3; i++) {
          const ang = (i / 3) * Math.PI * 2 + 0.5;
          const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), mangoMat);
          fruit.scale.set(0.84, 1.24, 0.84);
          fruit.position.set(sx + Math.cos(ang) * 0.24, h * 0.6, sz + Math.sin(ang) * 0.24);
          addInkOutline(fruit, 1.08);
          plantGroup.add(fruit);
        }
      }
      break;
    }

    case 'lavender': {
      const sageMat = toonMat(0x88b88a);
      const violetMat = toonMat(0x9a6ef0);
      const lilacMat = toonMat(0xc8a4ff);
      for (const [ox, oz] of offsets) {
        const tuft = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), sageMat));
        tuft.scale.set(1.15, 0.62, 1.15);
        tuft.position.set(ox, 0.1, oz);
        plantGroup.add(tuft);
        const spikes: [number, number, number, boolean][] = [
          [ox, oz, 0.54, false],
          [ox - 0.11, oz + 0.08, 0.42, true],
          [ox + 0.11, oz - 0.07, 0.46, true],
        ];
        for (const [px, pz, sh, light] of spikes) {
          const spire = addShadow(
            new THREE.Mesh(new THREE.CapsuleGeometry(0.065, sh * 0.65, 6, 8), light ? lilacMat : violetMat),
          );
          spire.position.set(px, 0.14 + sh * 0.48, pz);
          addInkOutline(spire, 1.07);
          plantGroup.add(spire);
        }
      }
      break;
    }

    case 'herb': {
      const rosemaryMat = toonMat(0x3ba37e);
      const mintLeafMat = toonMat(0x6dd9a7);
      const blossomMat = toonMat(0xf2fff8, { emissive: 0xa6f2d0, emissiveIntensity: 0.2 });
      const centerRing = addShadow(new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.065, 8, 14), stoneMat));
      centerRing.rotation.x = Math.PI / 2;
      centerRing.position.y = 0.05;
      plantGroup.add(centerRing);

      const herbCoords: [number, number][] = [...offsets, [0, 0]];
      for (const [ox, oz] of herbCoords) {
        for (let j = 0; j < 3; j++) {
          const ang = (j / 3) * Math.PI * 2 + ox;
          const sprig = addShadow(
            new THREE.Mesh(
              new THREE.CapsuleGeometry(0.075, 0.2, 5, 8),
              j === 0 ? rosemaryMat : mintLeafMat,
            ),
          );
          sprig.position.set(ox + Math.cos(ang) * 0.08, 0.17, oz + Math.sin(ang) * 0.08);
          sprig.rotation.z = Math.cos(ang) * 0.28;
          sprig.rotation.x = Math.sin(ang) * 0.28;
          plantGroup.add(sprig);
        }
        const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.082, 8, 8), blossomMat);
        bloom.position.set(ox, 0.36, oz);
        plantGroup.add(bloom);
      }
      break;
    }

    case 'bamboo_shoot': {
      const culmMat = toonMat(0x5ec24e);
      const nodeMat = toonMat(0x34782d);
      const shootMat = toonMat(0xe6c87a);
      const leafFanMat = toonMat(0x88e067);

      const stalks: [number, number, number][] = [
        [-0.42, -0.36, 1.05],
        [0.38, -0.32, 0.92],
        [-0.18, 0.34, 0.84],
        [0.44, 0.36, 1.15],
      ];
      for (const [bx, bz, bh] of stalks) {
        const culm = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.058, bh - 0.1, 6, 8), culmMat));
        culm.position.set(bx, bh / 2, bz);
        addInkOutline(culm, 1.08);
        plantGroup.add(culm);

        for (const frac of [0.35, 0.7]) {
          const ring = new THREE.Mesh(new THREE.TorusGeometry(0.066, 0.018, 6, 10), nodeMat);
          ring.rotation.x = Math.PI / 2;
          ring.position.set(bx, bh * frac, bz);
          plantGroup.add(ring);
        }

        // Rounded leaf puff fan (no BoxGeometry!)
        const fan = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), leafFanMat));
        fan.scale.set(1.45, 0.42, 0.72);
        fan.position.set(bx + 0.14, bh - 0.06, bz);
        fan.rotation.z = 0.36;
        fan.rotation.y = bx * 2;
        plantGroup.add(fan);
      }
      for (const [sx, sz] of [
        [0.05, -0.05],
        [-0.46, 0.24],
        [0.18, 0.44],
      ] as [number, number][]) {
        const shoot = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.2, 6, 8), shootMat));
        shoot.position.set(sx, 0.16, sz);
        addInkOutline(shoot, 1.08);
        plantGroup.add(shoot);
      }
      break;
    }

    case 'fox_berry': {
      const vineMat = toonMat(0x7e9940);
      const autumnLeafMat = toonMat(0xd48033);
      const lanternMat = toonMat(0xffa833, { emissive: 0xd96800, emissiveIntensity: 0.48 });

      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const rx = Math.cos(a) * 0.42;
        const rz = Math.sin(a) * 0.42;

        const arch = addShadow(new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.036, 8, 14, Math.PI), vineMat));
        arch.position.set(rx * 0.55, 0.28, rz * 0.55);
        arch.rotation.y = -a;
        plantGroup.add(arch);

        const frond = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), autumnLeafMat));
        frond.scale.set(1.1, 0.78, 1.1);
        frond.position.set(rx * 0.35, 0.14, rz * 0.35);
        plantGroup.add(frond);

        const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), lanternMat);
        lantern.scale.set(0.92, 1.22, 0.92);
        lantern.position.set(rx * 1.15, 0.38, rz * 1.15);
        addInkOutline(lantern, 1.08);
        plantGroup.add(lantern);
      }
      const centerStem = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.038, 0.52, 5, 8), vineMat));
      centerStem.position.set(0, 0.29, 0);
      plantGroup.add(centerStem);
      const centerLantern = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), lanternMat);
      centerLantern.scale.set(0.95, 1.25, 0.95);
      centerLantern.position.set(0, 0.62, 0);
      addInkOutline(centerLantern, 1.07);
      plantGroup.add(centerLantern);
      break;
    }

    case 'ice_fish': {
      const iceMat = toonMat(0xdbf6ff, { emissive: 0x62c5f5, emissiveIntensity: 0.28 });
      const fishBodyMat = toonMat(0x9ee0ff, { emissive: 0x3588c4, emissiveIntensity: 0.22 });
      const finMat = toonMat(0xedfaff);

      const crystalCorners: [number, number, number][] = [
        [-0.56, -0.56, 0.48],
        [0.56, -0.54, 0.38],
        [-0.54, 0.56, 0.36],
        [0.56, 0.56, 0.52],
      ];
      for (const [cx, cz, ch] of crystalCorners) {
        const shard = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.085, ch * 0.65, 5, 8), iceMat));
        shard.position.set(cx, ch * 0.48, cz);
        shard.rotation.z = cx < 0 ? 0.16 : -0.16;
        addInkOutline(shard, 1.08);
        plantGroup.add(shard);
      }

      const fishSpecs: [number, number, number, number][] = [
        [-0.18, 0.28, -0.14, 0.4],
        [0.2, 0.22, 0.18, -2.5],
      ];
      for (const [fx, fy, fz, rotY] of fishSpecs) {
        const fishGroup = new THREE.Group();
        fishGroup.position.set(fx, fy, fz);
        fishGroup.rotation.y = rotY;
        fishGroup.rotation.z = 0.28;

        const body = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.24, 6, 10), fishBodyMat));
        body.rotation.z = Math.PI / 2;
        addInkOutline(body, 1.08);
        fishGroup.add(body);

        const tail = new THREE.Mesh(new THREE.SphereGeometry(0.095, 8, 8), finMat);
        tail.scale.set(1.2, 1.15, 0.45);
        tail.position.x = -0.22;
        fishGroup.add(tail);

        plantGroup.add(fishGroup);
      }
      break;
    }

    case 'river_reed': {
      const stemMat = toonMat(0x45a36a);
      const bladeMat = toonMat(0x63c482);
      const cattailMat = toonMat(0x7d4529);

      const cattailPos: [number, number, number][] = [
        [-0.48, -0.45, 0.95],
        [0.44, -0.42, 1.08],
        [-0.36, 0.44, 0.86],
        [0.48, 0.42, 0.98],
        [0.02, -0.48, 0.78],
      ];
      for (const [rx, rz, rh] of cattailPos) {
        const stalk = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.028, rh - 0.06, 5, 8), stemMat));
        stalk.position.set(rx, rh * 0.5, rz);
        plantGroup.add(stalk);

        const head = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.2, 6, 8), cattailMat));
        head.position.set(rx, rh * 0.82, rz);
        addInkOutline(head, 1.09);
        plantGroup.add(head);

        const blade = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.042, rh * 0.56, 5, 6), bladeMat));
        blade.scale.set(1, 1, 0.45);
        blade.position.set(rx + 0.09, rh * 0.34, rz + 0.05);
        blade.rotation.z = -0.28;
        plantGroup.add(blade);
      }
      break;
    }

    case 'lotus_dew': {
      const padMat = toonMat(0x43a858);
      const petalMat = toonMat(0xf58ab8, { emissive: 0x70244a, emissiveIntensity: 0.16 });
      const innerPetalMat = toonMat(0xffd2e6);
      const dewMat = toonMat(0xb8f6ff, { emissive: 0x4ccce8, emissiveIntensity: 0.35 });

      const pads: [number, number, number, boolean][] = [
        [-0.36, -0.32, 0.32, true],
        [0.36, 0.28, 0.3, true],
        [0.34, -0.36, 0.24, false],
        [-0.32, 0.36, 0.25, true],
      ];
      for (const [px, pz, pr, hasBloom] of pads) {
        const pad = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(pr, pr * 0.96, 0.045, 14), padMat));
        pad.position.set(px, 0.04, pz);
        addInkOutline(pad, 1.05);
        plantGroup.add(pad);

        if (hasBloom) {
          for (let i = 0; i < 6; i++) {
            const ang = (i / 6) * Math.PI * 2;
            const petal = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), petalMat));
            petal.scale.set(0.75, 1.25, 0.45);
            petal.position.set(px + Math.cos(ang) * 0.095, 0.15, pz + Math.sin(ang) * 0.095);
            petal.rotation.y = -ang;
            petal.rotation.z = 0.48;
            plantGroup.add(petal);
          }
          const core = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 8), innerPetalMat);
          core.position.set(px, 0.17, pz);
          plantGroup.add(core);

          const dew = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), dewMat);
          dew.position.set(px, 0.26, pz);
          plantGroup.add(dew);
        } else {
          const drop = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), dewMat);
          drop.position.set(px + 0.05, 0.09, pz - 0.03);
          plantGroup.add(drop);
        }
      }
      break;
    }

    case 'hibiscus': {
      const leafMat = toonMat(0x2f8f4e);
      const leafHiMat = toonMat(0x4eb869);
      const bloomMat = toonMat(0xf2447b, { emissive: 0x781434, emissiveIntensity: 0.16 });
      const stamenMat = toonMat(0xffd84a, { emissive: 0x996d00, emissiveIntensity: 0.25 });

      for (const [ox, oz] of offsets) {
        const shrub = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), leafMat));
        shrub.scale.set(1.12, 0.85, 1.12);
        shrub.position.set(ox, 0.24, oz);
        addInkOutline(shrub, 1.06);
        plantGroup.add(shrub);

        const topLeaf = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), leafHiMat);
        topLeaf.position.set(ox, 0.42, oz);
        plantGroup.add(topLeaf);

        // Large 5-petal tropical hibiscus bloom on top
        const flowerGroup = new THREE.Group();
        flowerGroup.position.set(ox, 0.56, oz);
        flowerGroup.rotation.x = ox < 0 ? 0.22 : -0.18;
        flowerGroup.rotation.z = oz < 0 ? -0.18 : 0.2;
        for (let i = 0; i < 5; i++) {
          const ang = (i / 5) * Math.PI * 2;
          const petal = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.095, 8, 8), bloomMat));
          petal.scale.set(1.05, 0.42, 0.9);
          petal.position.set(Math.cos(ang) * 0.1, 0, Math.sin(ang) * 0.1);
          flowerGroup.add(petal);
        }
        const stamen = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.14, 4, 6), stamenMat);
        stamen.position.y = 0.08;
        flowerGroup.add(stamen);
        plantGroup.add(flowerGroup);
      }
      break;
    }

    case 'dandelion': {
      const leafMat = toonMat(0x52a646);
      const stemMat = toonMat(0x69ba4e);
      const yellowMat = toonMat(0xffcf2e, { emissive: 0x8f6700, emissiveIntensity: 0.16 });
      const puffMat = toonMat(0xfaf8f2, { emissive: 0x88847a, emissiveIntensity: 0.12 });

      const clusters: [number, number, number, boolean][] = [
        [-0.4, -0.35, 0.48, false],
        [0.36, -0.32, 0.54, true],
        [-0.32, 0.36, 0.52, true],
        [0.4, 0.34, 0.46, false],
        [0.02, 0.02, 0.62, false],
      ];
      for (const [dx, dz, h, isPuff] of clusters) {
        const tuft = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), leafMat));
        tuft.scale.set(1.2, 0.52, 1.2);
        tuft.position.set(dx, 0.1, dz);
        plantGroup.add(tuft);

        const stem = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.024, h, 4, 6), stemMat));
        stem.position.set(dx, h * 0.52, dz);
        plantGroup.add(stem);

        const head = addShadow(
          new THREE.Mesh(
            new THREE.SphereGeometry(isPuff ? 0.135 : 0.125, 10, 8),
            isPuff ? puffMat : yellowMat,
          ),
        );
        if (!isPuff) head.scale.set(1.15, 0.72, 1.15);
        head.position.set(dx, h + 0.08, dz);
        addInkOutline(head, 1.07);
        plantGroup.add(head);
      }
      break;
    }

    case 'cactus_fig': {
      const padMat = toonMat(0x4c9e59);
      const figMat = toonMat(0xe8483c, { emissive: 0x751a12, emissiveIntensity: 0.18 });
      const bloomTipMat = toonMat(0xffbe3b);

      const cacti: [number, number, number, number][] = [
        [-0.36, -0.26, 0.66, 0.2],
        [0.36, 0.24, 0.62, -0.35],
        [0.0, 0.0, 0.76, 0.8],
      ];
      for (const [cx, cz, h, rotY] of cacti) {
        const g = new THREE.Group();
        g.position.set(cx, 0, cz);
        g.rotation.y = rotY;

        const basePad = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), padMat));
        basePad.scale.set(1.05, h * 1.9, 0.44);
        basePad.position.y = h * 0.42;
        addInkOutline(basePad, 1.06);
        g.add(basePad);

        const sidePad = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), padMat));
        sidePad.scale.set(0.95, 1.35, 0.42);
        sidePad.position.set(0.2, h * 0.66, 0);
        sidePad.rotation.z = -0.45;
        addInkOutline(sidePad, 1.06);
        g.add(sidePad);

        for (const [fx, fy] of [
          [-0.08, h * 0.85],
          [0.09, h * 0.84],
          [0.26, h * 0.86],
        ] as [number, number][]) {
          const fig = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.07, 5, 8), figMat));
          fig.position.set(fx, fy, 0);
          g.add(fig);
          const crown = new THREE.Mesh(new THREE.SphereGeometry(0.032, 6, 6), bloomTipMat);
          crown.position.set(fx, fy + 0.07, 0);
          g.add(crown);
        }

        plantGroup.add(g);
      }
      break;
    }
  }

  if (crop.fertilized) {
    const fertRing = new THREE.Mesh(
      new THREE.RingGeometry(0.64, 0.74, 24),
      new THREE.MeshBasicMaterial({
        color: 0x5be38c,
        transparent: true,
        opacity: 0.78,
        side: THREE.DoubleSide,
      }),
    );
    fertRing.rotation.x = -Math.PI / 2;
    fertRing.position.y = 0.24;
    group.add(fertRing);
  }

  const readyRing = new THREE.Mesh(
    new THREE.RingGeometry(0.76, 0.9, 28),
    new THREE.MeshBasicMaterial({
      color: 0xffd75e,
      transparent: true,
      opacity: 0.88,
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

// --- ADORABLE CHIBI ROAMING NPC SANCTUARY VISITOR BUILDER ---
export function buildNpcVisitorMesh(seed: number): THREE.Group {
  const group = new THREE.Group();
  const cloakColors = [0x459467, 0xde7a3c, 0x4584ad, 0xc26c8c, 0xd4a13b];
  const hatColors = [0xf5e2b8, 0xebcb8d, 0xfaf0d2];
  const cloakMat = toonMat(cloakColors[seed % cloakColors.length]);
  const headMat = toonMat(0xffdfc2);
  const hatMat = toonMat(hatColors[seed % hatColors.length]);
  const blushMat = toonMat(0xf595a4);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1e1715 });
  const sparkleMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

  // Plump rounded tunic/cloak body
  const body = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.28, 8, 12), cloakMat));
  body.position.y = 0.34;
  addInkOutline(body, 1.07);
  group.add(body);

  // Cute oversized chibi head
  const head = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 12), headMat));
  head.position.y = 0.74;
  addInkOutline(head, 1.06);
  group.add(head);

  // Cute cartoon eyes + white catchlight + rosy cheeks (facing +Z)
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), eyeMat);
    eye.position.set(side * 0.075, 0.75, 0.185);
    group.add(eye);
    const sp = new THREE.Mesh(new THREE.SphereGeometry(0.011, 6, 6), sparkleMat);
    sp.position.set(side * 0.075 - 0.01, 0.762, 0.21);
    group.add(sp);
    const blush = new THREE.Mesh(new THREE.SphereGeometry(0.036, 8, 6), blushMat);
    blush.scale.set(1.25, 0.7, 0.5);
    blush.position.set(side * 0.12, 0.7, 0.165);
    group.add(blush);
  }

  // Cozy wide-brimmed sunhat
  const brim = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.33, 0.055, 14), hatMat));
  brim.position.y = 0.91;
  addInkOutline(brim, 1.05);
  group.add(brim);

  const crown = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), hatMat));
  crown.scale.set(1, 0.72, 1);
  crown.position.y = 0.98;
  addInkOutline(crown, 1.06);
  group.add(crown);

  return group;
}

// --- HABITAT DECORATION BUILDERS (17 rich stylized storybook 3D props & structures) ---
export interface BuiltDecoration {
  group: THREE.Group;
  hitProxy: THREE.Mesh;
  animatedProp?: {
    obj: THREE.Object3D;
    kind: 'spin_z' | 'flicker' | 'wave';
  };
}

export function buildDecorationModel(
  decorId: string,
  decorType: DecorTypeId,
  gridX: number,
  gridZ: number,
  rotation: number,
  textures: ProceduralTextureSet,
  gridSize = 12,
): BuiltDecoration {
  const fp = getDecorFootprint(decorType);
  const group = new THREE.Group();
  group.position.copy(gridToWorld(gridX, gridZ, fp, gridSize));
  group.rotation.y = (rotation % 4) * (Math.PI / 2);

  const woodMat = toonMat(0xffffff, { map: textures.woodGrain });
  const stoneMat = toonMat(0xb0ada2);
  let animatedProp: BuiltDecoration['animatedProp'] = undefined;

  switch (decorType) {
    case 'willow': {
      const trunk = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 1.15, 8, 10), woodMat));
      trunk.position.y = 0.68;
      trunk.rotation.z = 0.06;
      addInkOutline(trunk, 1.06);
      group.add(trunk);

      addPuffyFoliageCluster(
        group,
        [
          { x: 0, y: 1.62, z: 0, r: 0.66, tone: 'mid', scaleY: 0.84 },
          { x: -0.45, y: 1.48, z: 0.24, r: 0.44, tone: 'shadow' },
          { x: 0.44, y: 1.5, z: -0.2, r: 0.46, tone: 'shadow' },
          { x: 0.14, y: 1.92, z: 0.1, r: 0.44, tone: 'highlight', scaleY: 0.82 },
        ],
        0x66b050,
        0x91d966,
        0x488a3e,
        true,
      );

      const drapeMat = toonMat(0x73bf5a);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const drape = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.72, 6, 8), drapeMat));
        drape.position.set(Math.cos(a) * 0.62, 1.06, Math.sin(a) * 0.62);
        group.add(drape);
      }
      group.add(makeContactShadow(textures, 1.8));
      break;
    }

    case 'autumn_maple': {
      const trunk = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 1.05, 8, 10), woodMat));
      trunk.position.y = 0.62;
      trunk.rotation.z = -0.05;
      addInkOutline(trunk, 1.06);
      group.add(trunk);

      addPuffyFoliageCluster(
        group,
        [
          { x: 0, y: 1.68, z: 0, r: 0.64, tone: 'mid' },
          { x: -0.44, y: 1.44, z: 0.26, r: 0.46, tone: 'shadow' },
          { x: 0.42, y: 1.48, z: -0.22, r: 0.48, tone: 'mid' },
          { x: -0.1, y: 2.02, z: -0.08, r: 0.42, tone: 'highlight' },
          { x: 0.22, y: 1.85, z: 0.3, r: 0.36, tone: 'highlight' },
        ],
        0xeb6734,
        0xffa43d,
        0xc74028,
        true,
      );
      group.add(makeContactShadow(textures, 1.75));
      break;
    }

    case 'bamboo': {
      const stalkMat = toonMat(0x63b550);
      const leafMat = toonMat(0x88db63);
      const coords: [number, number, number][] = [
        [-0.3, -0.25, 1.65],
        [0.25, -0.2, 1.95],
        [0.0, 0.28, 1.5],
        [0.36, 0.26, 1.25],
      ];
      for (const [bx, bz, bh] of coords) {
        const s = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.075, bh - 0.14, 6, 8), stalkMat));
        s.position.set(bx, bh / 2, bz);
        addInkOutline(s, 1.07);
        group.add(s);

        const tuft = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), leafMat));
        tuft.scale.set(1.15, 0.72, 1.15);
        tuft.position.set(bx, bh + 0.08, bz);
        addInkOutline(tuft, 1.06);
        group.add(tuft);
      }
      group.add(makeContactShadow(textures, 1.4));
      break;
    }

    case 'koi_pond': {
      const rim = addShadow(new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.15, 10, 20), stoneMat));
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.13;
      addInkOutline(rim, 1.05);
      group.add(rim);

      const water = new THREE.Mesh(
        new THREE.CircleGeometry(0.72, 20),
        toonMat(0xffffff, { map: textures.waterRipple, emissive: 0x22789e, emissiveIntensity: 0.2 }),
      );
      water.rotation.x = -Math.PI / 2;
      water.position.y = 0.15;
      group.add(water);

      const lily = new THREE.Mesh(new THREE.CircleGeometry(0.2, 12), toonMat(0x52ad4c));
      lily.rotation.x = -Math.PI / 2;
      lily.position.set(-0.24, 0.17, 0.18);
      group.add(lily);

      const lotus = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 8), toonMat(0xff99bb));
      lotus.scale.set(1.1, 0.65, 1.1);
      lotus.position.set(-0.24, 0.21, 0.18);
      group.add(lotus);

      const koi = new THREE.Mesh(new THREE.CapsuleGeometry(0.058, 0.16, 6, 8), toonMat(0xff7733));
      koi.rotation.z = Math.PI / 2;
      koi.position.set(0.22, 0.18, -0.14);
      addInkOutline(koi, 1.1);
      group.add(koi);
      break;
    }

    case 'fountain': {
      const base = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.88, 0.34, 16), stoneMat));
      base.position.y = 0.17;
      addInkOutline(base, 1.045);
      group.add(base);

      const basin = new THREE.Mesh(
        new THREE.CircleGeometry(0.7, 16),
        toonMat(0xffffff, { map: textures.waterRipple, emissive: 0x2682a8, emissiveIntensity: 0.2 }),
      );
      basin.rotation.x = -Math.PI / 2;
      basin.position.y = 0.35;
      group.add(basin);

      const pillar = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.72, 6, 10), stoneMat));
      pillar.position.y = 0.68;
      addInkOutline(pillar, 1.06);
      group.add(pillar);

      const bowl = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), stoneMat));
      bowl.scale.set(1.05, 0.42, 1.05);
      bowl.position.y = 1.16;
      addInkOutline(bowl, 1.05);
      group.add(bowl);

      const finial = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), toonMat(0x7be0ff, { emissive: 0x359ec9, emissiveIntensity: 0.3 })));
      finial.position.y = 1.44;
      group.add(finial);
      break;
    }

    case 'lantern_post': {
      const base = addShadow(
        new THREE.Mesh(createRoundedBoxGeometry(0.5, 0.2, 0.5, 0.08, 3), stoneMat),
      );
      base.position.y = 0.1;
      group.add(base);

      const post = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 1.35, 6, 8), woodMat));
      post.position.y = 0.84;
      addInkOutline(post, 1.07);
      group.add(post);

      const arm = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.48, 5, 8), woodMat));
      arm.rotation.z = Math.PI / 2;
      arm.position.set(0.2, 1.48, 0);
      group.add(arm);

      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 12, 10),
        toonMat(0xfff2bd, { emissive: 0xff9d29, emissiveIntensity: 0.95 }),
      );
      glow.scale.set(0.95, 1.22, 0.95);
      glow.position.set(0.38, 1.22, 0);
      addInkOutline(glow, 1.07);
      group.add(glow);

      const cap = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), woodMat));
      cap.scale.set(1.1, 0.42, 1.1);
      cap.position.set(0.38, 1.46, 0);
      group.add(cap);

      group.add(makeContactShadow(textures, 1.0));
      break;
    }

    case 'flower_arch': {
      const arch = addShadow(new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.11, 10, 20, Math.PI), woodMat));
      arch.position.y = 1.05;
      addInkOutline(arch, 1.05);
      group.add(arch);

      for (const px of [-0.76, 0.76]) {
        const leg = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.96, 6, 8), woodMat));
        leg.position.set(px, 0.54, 0);
        addInkOutline(leg, 1.06);
        group.add(leg);
      }

      const roseColors = [0xff7da0, 0xffbdd0, 0xffd754];
      const leafMat = toonMat(0x52ad4c);
      for (let i = 0; i < 7; i++) {
        const a = (i / 6) * Math.PI;
        const lx = Math.cos(a) * 0.78;
        const ly = 1.08 + Math.sin(a) * 0.78;

        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), leafMat);
        leaf.position.set(lx, ly, -0.05);
        group.add(leaf);

        const rose = new THREE.Mesh(
          new THREE.SphereGeometry(0.145, 10, 8),
          toonMat(roseColors[i % roseColors.length]),
        );
        rose.position.set(lx, ly, 0.08);
        addInkOutline(rose, 1.08);
        group.add(rose);
      }
      break;
    }

    case 'gazebo': {
      const deck = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.95, 0.18, 16), woodMat));
      deck.position.y = 0.09;
      addInkOutline(deck, 1.04);
      group.add(deck);

      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const p = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 1.24, 6, 8), woodMat));
        p.position.set(Math.cos(a) * 0.68, 0.84, Math.sin(a) * 0.68);
        addInkOutline(p, 1.07);
        group.add(p);
      }

      // Cozy rounded storybook domed roof
      const roof = addShadow(
        new THREE.Mesh(
          new THREE.SphereGeometry(1.06, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.52),
          toonMat(0xd66345),
        ),
      );
      roof.scale.set(1.05, 0.68, 1.05);
      roof.position.y = 1.48;
      addInkOutline(roof, 1.045);
      group.add(roof);

      const roofKnob = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), toonMat(0xf0be54)));
      roofKnob.position.y = 2.24;
      addInkOutline(roofKnob, 1.08);
      group.add(roofKnob);

      group.add(makeContactShadow(textures, 1.9));
      break;
    }

    case 'cobble_path': {
      // Beveled rounded mossy stepping-stone pad + 3D smooth rounded pebbles on top
      const tile = new THREE.Mesh(
        createRoundedBoxGeometry(1.92, 0.08, 1.92, 0.16, 2),
        toonMat(0xffffff, { map: textures.cobbleStone }),
      );
      tile.position.y = 0.035;
      tile.receiveShadow = true;
      group.add(tile);

      const pebbleMatA = toonMat(0xdfd4c0);
      const pebbleMatB = toonMat(0xd0c3ad);
      const pebbles: [number, number, number, number, boolean][] = [
        [-0.42, -0.35, 0.34, 0.28, true],
        [0.36, -0.28, 0.38, 0.3, false],
        [-0.25, 0.38, 0.36, 0.28, false],
        [0.42, 0.36, 0.3, 0.26, true],
      ];
      for (const [px, pz, rx, rz, light] of pebbles) {
        const peb = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), light ? pebbleMatA : pebbleMatB);
        peb.scale.set(rx, 0.055, rz);
        peb.position.set(px, 0.07, pz);
        peb.receiveShadow = true;
        group.add(peb);
      }
      break;
    }

    case 'hay_cart': {
      const bed = addShadow(
        new THREE.Mesh(createRoundedBoxGeometry(1.18, 0.3, 0.82, 0.09, 3), woodMat),
      );
      bed.position.y = 0.42;
      addInkOutline(bed, 1.05);
      group.add(bed);

      const hayMat = toonMat(0xf2be4c);
      const bale1 = addShadow(
        new THREE.Mesh(createRoundedBoxGeometry(0.56, 0.38, 0.64, 0.12, 3), hayMat),
      );
      bale1.position.set(-0.22, 0.72, 0);
      addInkOutline(bale1, 1.055);
      group.add(bale1);

      const bale2 = addShadow(
        new THREE.Mesh(createRoundedBoxGeometry(0.5, 0.34, 0.58, 0.11, 3), hayMat),
      );
      bale2.position.set(0.28, 0.7, 0);
      bale2.rotation.z = -0.14;
      addInkOutline(bale2, 1.055);
      group.add(bale2);

      const wheelGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.09, 14);
      for (const wz of [-0.45, 0.45]) {
        const w = addShadow(new THREE.Mesh(wheelGeo, woodMat));
        w.rotation.x = Math.PI / 2;
        w.position.set(0, 0.28, wz);
        addInkOutline(w, 1.07);
        group.add(w);
      }
      group.add(makeContactShadow(textures, 1.5));
      break;
    }

    case 'keeper_cottage': {
      // Cozy Storybook Cream-and-Terracotta Keeper Cottage with hearth chimney
      const wallMat = toonMat(0xfff4de);
      const roofMat = toonMat(0xd95f43);
      const doorMat = toonMat(0x8c5634, { map: textures.woodGrain });
      const glowWinMat = toonMat(0xfff0a6, { emissive: 0xffb338, emissiveIntensity: 0.85 });

      const foundation = addShadow(
        new THREE.Mesh(createRoundedBoxGeometry(1.56, 0.22, 1.44, 0.08, 2), stoneMat),
      );
      foundation.position.y = 0.11;
      group.add(foundation);

      const walls = addShadow(
        new THREE.Mesh(createRoundedBoxGeometry(1.42, 0.96, 1.28, 0.12, 3), wallMat),
      );
      walls.position.y = 0.68;
      addInkOutline(walls, 1.04);
      group.add(walls);

      // Steep cozy pitched storybook roof
      const roof = addShadow(new THREE.Mesh(new THREE.ConeGeometry(1.22, 0.92, 4), roofMat));
      roof.rotation.y = Math.PI / 4;
      roof.position.y = 1.58;
      addInkOutline(roof, 1.045);
      group.add(roof);

      // Cute arched front door + doorknob
      const door = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.28, 6, 10), doorMat));
      door.scale.set(1, 1, 0.35);
      door.position.set(0, 0.5, 0.64);
      addInkOutline(door, 1.07);
      group.add(door);

      // Warm glowing round cottage windows
      for (const wx of [-0.42, 0.42]) {
        const winFrame = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.035, 8, 14), doorMat);
        winFrame.position.set(wx, 0.74, 0.645);
        group.add(winFrame);
        const winGlass = new THREE.Mesh(new THREE.CircleGeometry(0.13, 12), glowWinMat);
        winGlass.position.set(wx, 0.74, 0.648);
        group.add(winGlass);
      }

      // Stone chimney & cute floating hearth smoke puffs
      const chimney = addShadow(
        new THREE.Mesh(createRoundedBoxGeometry(0.28, 0.58, 0.28, 0.06, 2), stoneMat),
      );
      chimney.position.set(0.45, 1.66, -0.22);
      addInkOutline(chimney, 1.06);
      group.add(chimney);

      const smokeMat = toonMat(0xf7fbff, { transparent: true, opacity: 0.88 });
      const puff1 = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), smokeMat);
      puff1.position.set(0.47, 2.08, -0.22);
      group.add(puff1);
      const puff2 = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), smokeMat);
      puff2.position.set(0.58, 2.32, -0.26);
      group.add(puff2);

      group.add(makeContactShadow(textures, 1.9));
      break;
    }

    case 'windmill': {
      // Storybook Meadow Windmill with smoothly turning canvas sails!
      const towerMat = toonMat(0xfaf0dc);
      const roofMat = toonMat(0xb85b3b);
      const sailCanvasMat = toonMat(0xfffaf0);

      const base = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.76, 0.52, 14), stoneMat));
      base.position.y = 0.26;
      addInkOutline(base, 1.045);
      group.add(base);

      const tower = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.62, 1.48, 14), towerMat));
      tower.position.y = 1.24;
      addInkOutline(tower, 1.045);
      group.add(tower);

      const cap = addShadow(
        new THREE.Mesh(new THREE.SphereGeometry(0.48, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), roofMat),
      );
      cap.scale.set(1.06, 1.15, 1.06);
      cap.position.y = 1.95;
      addInkOutline(cap, 1.05);
      group.add(cap);

      const door = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.22, 6, 8), woodMat);
      door.scale.set(1, 1, 0.35);
      door.position.set(0, 0.34, 0.66);
      group.add(door);

      // Rotating 4-sail windmill hub
      const sailHub = new THREE.Group();
      sailHub.position.set(0, 1.88, 0.54);
      const hubKnob = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), woodMat));
      addInkOutline(hubKnob, 1.08);
      sailHub.add(hubKnob);

      for (let i = 0; i < 4; i++) {
        const armGroup = new THREE.Group();
        armGroup.rotation.z = (i / 4) * Math.PI * 2 + Math.PI / 4;

        const spar = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 0.92, 5, 8), woodMat));
        spar.position.y = 0.5;
        armGroup.add(spar);

        const sail = addShadow(
          new THREE.Mesh(createRoundedBoxGeometry(0.28, 0.72, 0.04, 0.02, 2), sailCanvasMat),
        );
        sail.position.set(0.14, 0.62, 0.02);
        addInkOutline(sail, 1.05);
        armGroup.add(sail);

        sailHub.add(armGroup);
      }
      group.add(sailHub);
      animatedProp = { obj: sailHub, kind: 'spin_z' };

      group.add(makeContactShadow(textures, 1.75));
      break;
    }

    case 'greenhouse': {
      // Sparkling Botanical Glasshouse filled with lush potted ferns & flowers
      const frameMat = toonMat(0x4d8a68);
      const brassMat = toonMat(0xe6ba57);
      const base = addShadow(
        new THREE.Mesh(createRoundedBoxGeometry(1.66, 0.24, 1.48, 0.1, 2), stoneMat),
      );
      base.position.y = 0.12;
      group.add(base);

      // Corner timber-emerald frame posts
      for (const [cx, cz] of [
        [-0.72, -0.62],
        [0.72, -0.62],
        [-0.72, 0.62],
        [0.72, 0.62],
      ] as [number, number][]) {
        const post = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.95, 5, 8), frameMat));
        post.position.set(cx, 0.72, cz);
        addInkOutline(post, 1.08);
        group.add(post);
      }

      // Lush indoor potted plants visible through glass
      addPuffyFoliageCluster(
        group,
        [
          { x: -0.34, y: 0.56, z: -0.18, r: 0.28, tone: 'mid' },
          { x: 0.34, y: 0.52, z: 0.16, r: 0.26, tone: 'highlight' },
          { x: 0, y: 0.64, z: 0, r: 0.24, tone: 'shadow' },
        ],
        0x47a852,
        0x7cd663,
        0x2f7d40,
        false,
      );
      for (const [bx, bz, col] of [
        [-0.36, -0.16, 0xff85ad],
        [0.34, 0.18, 0xffcc4d],
        [0.02, 0.04, 0xb88cff],
      ] as [number, number, number][]) {
        const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), toonMat(col));
        bloom.position.set(bx, 0.86, bz);
        group.add(bloom);
      }

      // Translucent pastel glass walls + arched glass roof
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0xe3faff,
        roughness: 0.1,
        metalness: 0.05,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      });
      const glassBox = new THREE.Mesh(createRoundedBoxGeometry(1.48, 0.94, 1.28, 0.08, 2), glassMat);
      glassBox.position.y = 0.72;
      glassBox.renderOrder = 2;
      group.add(glassBox);

      const glassRoof = new THREE.Mesh(
        new THREE.CylinderGeometry(0.66, 0.66, 1.52, 16, 1, false, 0, Math.PI),
        glassMat,
      );
      glassRoof.rotation.z = Math.PI / 2;
      glassRoof.position.y = 1.18;
      glassRoof.renderOrder = 2;
      group.add(glassRoof);

      // Decorative brass ridge crest along top
      const ridgeBar = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 1.54, 5, 8), brassMat));
      ridgeBar.rotation.z = Math.PI / 2;
      ridgeBar.position.y = 1.84;
      group.add(ridgeBar);

      group.add(makeContactShadow(textures, 1.85));
      break;
    }

    case 'wooden_bridge_arch': {
      // Garden Moon Bridge spanning a sparkling stepping stream
      const redCedar = toonMat(0xb8583c);
      const creamCap = toonMat(0xf2d9a2);

      const creek = new THREE.Mesh(
        createRoundedBoxGeometry(1.88, 0.08, 1.32, 0.2, 2),
        toonMat(0xffffff, { map: textures.waterRipple, emissive: 0x2682a8, emissiveIntensity: 0.2 }),
      );
      creek.position.y = 0.04;
      group.add(creek);

      // Arched curved bridge deck planks
      const plankCount = 7;
      for (let i = 0; i < plankCount; i++) {
        const u = (i / (plankCount - 1)) * 2 - 1; // -1..1
        const z = u * 0.76;
        const y = 0.16 + Math.cos(u * Math.PI * 0.5) * 0.38;
        const plank = addShadow(
          new THREE.Mesh(createRoundedBoxGeometry(1.18, 0.1, 0.26, 0.04, 2), woodMat),
        );
        plank.position.set(0, y, z);
        plank.rotation.x = Math.sin(u * Math.PI * 0.5) * 0.36;
        group.add(plank);
      }

      // Arched curved handrails + corner posts with acorn caps
      for (const rx of [-0.56, 0.56]) {
        const railCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(rx, 0.62, -0.78),
          new THREE.Vector3(rx, 1.02, 0),
          new THREE.Vector3(rx, 0.62, 0.78),
        ]);
        const rail = addShadow(new THREE.Mesh(new THREE.TubeGeometry(railCurve, 14, 0.052, 8, false), redCedar));
        addInkOutline(rail, 1.08);
        group.add(rail);

        for (const pz of [-0.76, 0, 0.76]) {
          const py = pz === 0 ? 0.76 : 0.42;
          const post = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.48, 5, 8), redCedar));
          post.position.set(rx, py, pz);
          group.add(post);

          const finial = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 8), creamCap);
          finial.position.set(rx, py + 0.28, pz);
          group.add(finial);
        }
      }
      break;
    }

    case 'wishing_well': {
      // Mossy Stone Wishing Well with pitched cedar shingle roof & hanging bucket
      const roofMat = toonMat(0x528f5c);
      const wellRim = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.74, 0.56, 16), stoneMat));
      wellRim.position.y = 0.28;
      addInkOutline(wellRim, 1.045);
      group.add(wellRim);

      const water = new THREE.Mesh(
        new THREE.CircleGeometry(0.56, 16),
        toonMat(0xffffff, { map: textures.waterRipple, emissive: 0x2682a8, emissiveIntensity: 0.22 }),
      );
      water.rotation.x = -Math.PI / 2;
      water.position.y = 0.57;
      group.add(water);

      // Twin cedar support posts + crank bar + hanging bucket
      for (const px of [-0.56, 0.56]) {
        const post = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 1.02, 6, 8), woodMat));
        post.position.set(px, 0.96, 0);
        addInkOutline(post, 1.07);
        group.add(post);
      }

      const bar = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.036, 1.15, 5, 8), woodMat));
      bar.rotation.z = Math.PI / 2;
      bar.position.y = 1.12;
      group.add(bar);

      const bucket = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.22, 10), woodMat));
      bucket.position.set(0, 0.84, 0);
      addInkOutline(bucket, 1.08);
      group.add(bucket);

      // Cozy rounded peaked roof
      const roof = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.92, 0.62, 6), roofMat));
      roof.position.y = 1.72;
      addInkOutline(roof, 1.05);
      group.add(roof);

      group.add(makeContactShadow(textures, 1.6));
      break;
    }

    case 'campfire_lounge': {
      // Glowing Campfire Rest Nook with smooth river stones, log benches & flickering cartoon flames
      const stoneCount = 10;
      for (let i = 0; i < stoneCount; i++) {
        const a = (i / stoneCount) * Math.PI * 2;
        const st = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), stoneMat));
        st.scale.set(1.15, 0.72, 1.0);
        st.position.set(Math.cos(a) * 0.44, 0.1, Math.sin(a) * 0.44);
        addInkOutline(st, 1.07);
        group.add(st);
      }

      // Crossed firewood logs
      for (const rotY of [0.4, 1.9]) {
        const log = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.52, 6, 8), toonMat(0x7d4c2a)));
        log.rotation.z = Math.PI / 2;
        log.rotation.y = rotY;
        log.position.y = 0.14;
        group.add(log);
      }

      // Flickering cartoon flame group!
      const flameGroup = new THREE.Group();
      flameGroup.position.y = 0.24;
      const outerFlame = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 12, 10),
        toonMat(0xff7426, { emissive: 0xff5912, emissiveIntensity: 0.95 }),
      );
      outerFlame.scale.set(0.85, 1.48, 0.85);
      outerFlame.position.y = 0.16;
      flameGroup.add(outerFlame);

      const innerFlame = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 10, 8),
        toonMat(0xffe46b, { emissive: 0xffc833, emissiveIntensity: 1.0 }),
      );
      innerFlame.scale.set(0.82, 1.45, 0.82);
      innerFlame.position.y = 0.18;
      flameGroup.add(innerFlame);
      group.add(flameGroup);
      animatedProp = { obj: flameGroup, kind: 'flicker' };

      // Two cozy carved log seating benches flanking the fire
      for (const bz of [-0.78, 0.78]) {
        const bench = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.76, 6, 10), woodMat));
        bench.rotation.z = Math.PI / 2;
        bench.position.set(0, 0.2, bz);
        addInkOutline(bench, 1.06);
        group.add(bench);
      }

      group.add(makeContactShadow(textures, 1.75));
      break;
    }

    case 'circus_tent': {
      // 4-Square (2x2) Storybook Cartoon Carnival Big-Top Tent
      const redMat = toonMat(0xdf3b44);
      const creamMat = toonMat(0xfff4d6);
      const goldMat = toonMat(0xf5be3b, { emissive: 0x9c6408, emissiveIntensity: 0.22 });
      const bulbMat = toonMat(0xfff4b8, { emissive: 0xffd24c, emissiveIntensity: 0.95 });
      const darkVelvetMat = toonMat(0x3a1829);
      const stageMat = toonMat(0x9e6a40);

      // Rounded 2x2 carnival timber plaza deck
      const deck = addShadow(
        new THREE.Mesh(createRoundedBoxGeometry(3.8, 0.16, 3.8, 0.34, 3), stageMat),
      );
      deck.position.y = 0.08;
      addInkOutline(deck, 1.02);
      group.add(deck);

      // Circular golden ring trim on stage
      const stageRing = new THREE.Mesh(
        new THREE.CylinderGeometry(1.74, 1.8, 0.08, 24),
        toonMat(0xead2a4),
      );
      stageRing.position.y = 0.18;
      group.add(stageRing);

      // Crimson welcome carpet leading out of the front (+Z) entrance
      const carpet = new THREE.Mesh(
        createRoundedBoxGeometry(1.06, 0.05, 1.15, 0.08, 2),
        redMat,
      );
      carpet.position.set(0, 0.185, 1.38);
      group.add(carpet);

      // Alternating red & cream circular tent drum walls (12 segments; omit front doorway wedge)
      const panelCount = 12;
      const segAngle = (Math.PI * 2) / panelCount;
      for (let i = 0; i < panelCount; i++) {
        const thetaStart = i * segAngle;
        const centerAngle = thetaStart + segAngle * 0.5;
        // Three.js CylinderGeometry angle 0 is +Z, so skip wedges around 0 / 2*PI for the doorway
        const normAngle = ((centerAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const isDoorway = normAngle < segAngle * 0.8 || normAngle > Math.PI * 2 - segAngle * 0.8;
        const mat = i % 2 === 0 ? redMat : creamMat;

        if (!isDoorway) {
          const wallSlice = addShadow(
            new THREE.Mesh(
              new THREE.CylinderGeometry(1.56, 1.62, 1.34, 2, 1, false, thetaStart, segAngle),
              mat,
            ),
          );
          wallSlice.position.y = 0.86;
          group.add(wallSlice);
        }

        // Conical big-top striped roof wedges
        const roofSlice = addShadow(
          new THREE.Mesh(
            new THREE.CylinderGeometry(0.14, 1.84, 1.56, 2, 1, false, thetaStart, segAngle),
            mat,
          ),
        );
        roofSlice.position.y = 2.3;
        group.add(roofSlice);
      }

      // Cozy dark interior core behind the open front curtains
      const interior = new THREE.Mesh(
        new THREE.CylinderGeometry(1.42, 1.46, 1.3, 18),
        darkVelvetMat,
      );
      interior.position.y = 0.84;
      group.add(interior);

      // Clean cartoon ink outline silhouette around the tent roof & drum
      const roofOutlineProxy = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 1.84, 1.56, 16),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      roofOutlineProxy.position.y = 2.3;
      addInkOutline(roofOutlineProxy, 1.032);
      group.add(roofOutlineProxy);

      // Golden scalloped valance collar + glowing carnival marquee bulbs around the eaves
      const eaveTrim = addShadow(new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.095, 10, 28), goldMat));
      eaveTrim.rotation.x = Math.PI / 2;
      eaveTrim.position.y = 1.52;
      addInkOutline(eaveTrim, 1.04);
      group.add(eaveTrim);

      const scallopCount = 16;
      for (let i = 0; i < scallopCount; i++) {
        const a = (i / scallopCount) * Math.PI * 2;
        const sx = Math.sin(a) * 1.78;
        const sz = Math.cos(a) * 1.78;
        const scallop = new THREE.Mesh(
          new THREE.SphereGeometry(0.15, 8, 8),
          i % 2 === 0 ? redMat : creamMat,
        );
        scallop.scale.set(1.1, 0.72, 1.1);
        scallop.position.set(sx, 1.44, sz);
        group.add(scallop);

        if (i % 2 === 0) {
          const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 8), bulbMat);
          bulb.position.set(Math.sin(a) * 1.88, 1.55, Math.cos(a) * 1.88);
          group.add(bulb);
        }
      }

      // Arched Front Carnival Entranceway (+Z) with parted velvet curtains & marquee bulbs
      for (const side of [-1, 1]) {
        const curtain = addShadow(
          new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.96, 6, 10), redMat),
        );
        curtain.position.set(side * 0.56, 0.84, 1.48);
        curtain.rotation.z = side * 0.22;
        addInkOutline(curtain, 1.07);
        group.add(curtain);

        const tassel = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), goldMat);
        tassel.position.set(side * 0.62, 0.78, 1.58);
        group.add(tassel);

        // Striped carnival lantern posts flanking the welcome carpet
        const post = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.92, 6, 8), creamMat));
        post.position.set(side * 0.92, 0.64, 1.66);
        addInkOutline(post, 1.08);
        group.add(post);

        const postBulb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), bulbMat);
        postBulb.position.set(side * 0.92, 1.22, 1.66);
        group.add(postBulb);
      }

      // Curved golden marquee arch over the doorway
      const doorArch = addShadow(
        new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.1, 8, 16, Math.PI), goldMat),
      );
      doorArch.position.set(0, 1.15, 1.56);
      addInkOutline(doorArch, 1.07);
      group.add(doorArch);

      for (let b = 0; b < 5; b++) {
        const ba = (b / 4) * Math.PI;
        const mBulb = new THREE.Mesh(new THREE.SphereGeometry(0.068, 8, 8), bulbMat);
        mBulb.position.set(Math.cos(ba) * 0.58, 1.15 + Math.sin(ba) * 0.58, 1.67);
        group.add(mBulb);
      }

      // Tall golden finial flagpole & fluttering carnival pennant at peak
      const capDome = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), goldMat));
      capDome.position.y = 3.12;
      addInkOutline(capDome, 1.07);
      group.add(capDome);

      const flagpole = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.92, 6, 8), goldMat));
      flagpole.position.y = 3.64;
      addInkOutline(flagpole, 1.08);
      group.add(flagpole);

      const finialOrb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), goldMat);
      finialOrb.position.y = 4.18;
      addInkOutline(finialOrb, 1.08);
      group.add(finialOrb);

      const pennantPivot = new THREE.Group();
      pennantPivot.position.set(0, 3.92, 0);
      const flagShape = new THREE.Shape();
      flagShape.moveTo(0, 0.22);
      flagShape.lineTo(0.88, 0.04);
      flagShape.lineTo(0, -0.18);
      flagShape.closePath();
      const flagGeo = new THREE.ExtrudeGeometry(flagShape, {
        depth: 0.045,
        bevelEnabled: false,
      });
      flagGeo.translate(0, 0, -0.0225);
      const pennantMesh = addShadow(new THREE.Mesh(flagGeo, redMat));
      addInkOutline(pennantMesh, 1.08);
      pennantPivot.add(pennantMesh);

      const flagStar = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), goldMat);
      flagStar.scale.set(1.0, 1.0, 0.5);
      flagStar.position.set(0.26, 0.02, 0.03);
      pennantPivot.add(flagStar);

      group.add(pennantPivot);
      animatedProp = { obj: pennantPivot, kind: 'wave' };

      group.add(makeContactShadow(textures, 4.15));
      break;
    }
  }

  const hitW = fp === 2 ? TILE_SIZE * 1.92 : 1.85;
  const hitH = fp === 2 ? 3.35 : 1.7;
  const hitProxy = new THREE.Mesh(
    new THREE.BoxGeometry(hitW, hitH, hitW),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hitProxy.position.y = hitH * 0.5;
  hitProxy.userData = { kind: 'decor', id: decorId, decorType };
  group.add(hitProxy);

  return { group, hitProxy, animatedProp };
}

export interface BuiltForagingAcorn {
  group: THREE.Group;
  acornBody: THREE.Group;
  glowRing: THREE.Mesh;
  hitProxy: THREE.Mesh;
  forageId: string;
}

/**
 * Collectible 3D shimmering Golden Meadow Acorn for daily Hide-and-Seek Foraging (#6).
 */
export function buildForagingAcornMesh(
  forageId: string,
  textures: ProceduralTextureSet,
): BuiltForagingAcorn {
  const group = new THREE.Group();
  const acornBody = new THREE.Group();
  acornBody.position.y = 0.52;

  const goldNutMat = toonMat(0xffcc3b, { emissive: 0xd98000, emissiveIntensity: 0.45 });
  const capMat = toonMat(0x7c4a24);
  const leafMat = toonMat(0x5ec956);
  const sparkleMat = toonMat(0xfff5b8, { emissive: 0xffd24c, emissiveIntensity: 0.95 });

  // Plump tapered golden acorn nut
  const nut = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 12), goldNutMat));
  nut.scale.set(0.92, 1.18, 0.92);
  addInkOutline(nut, 1.075);
  acornBody.add(nut);

  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.14, 10), goldNutMat);
  tip.rotation.x = Math.PI;
  tip.position.y = -0.39;
  acornBody.add(tip);

  // Sculpted chestnut acorn cap & cozy curved stem
  const cap = addShadow(
    new THREE.Mesh(new THREE.SphereGeometry(0.355, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.52), capMat),
  );
  cap.position.y = 0.14;
  addInkOutline(cap, 1.06);
  acornBody.add(cap);

  const capRim = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.055, 8, 18), capMat);
  capRim.rotation.x = Math.PI / 2;
  capRim.position.y = 0.14;
  acornBody.add(capRim);

  const stem = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.18, 5, 8), capMat));
  stem.position.set(0.03, 0.54, 0);
  stem.rotation.z = -0.22;
  addInkOutline(stem, 1.08);
  acornBody.add(stem);

  const sproutLeaf = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), leafMat));
  sproutLeaf.scale.set(1.35, 0.5, 0.72);
  sproutLeaf.position.set(0.16, 0.52, 0.04);
  sproutLeaf.rotation.z = 0.35;
  addInkOutline(sproutLeaf, 1.08);
  acornBody.add(sproutLeaf);

  // Floating golden sparkle star beacon above the acorn
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), sparkleMat);
  star.position.set(0, 0.96, 0);
  acornBody.add(star);

  group.add(acornBody);

  // Pulsing golden shimmer ring on the grass below
  const glowRing = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.62, 24),
    new THREE.MeshBasicMaterial({
      color: 0xffd75e,
      transparent: true,
      opacity: 0.82,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  glowRing.rotation.x = -Math.PI / 2;
  glowRing.position.y = 0.08;
  group.add(glowRing);

  group.add(makeContactShadow(textures, 1.05));

  // Generous invisible touch/click sphere
  const hitProxy = new THREE.Mesh(
    new THREE.SphereGeometry(0.95, 10, 8),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hitProxy.position.y = 0.65;
  hitProxy.userData = { kind: 'forage', id: forageId };
  group.add(hitProxy);

  return { group, acornBody, glowRing, hitProxy, forageId };
}

/**
 * Builds a lightweight stylized 3-blade curved meadow grass tuft geometry
 * for InstancedMesh rendering with GPU wind sway.
 */
function createGrassTuftGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];

  const blades: Array<{ angle: number; height: number; lean: number; width: number }> = [
    { angle: 0, height: 0.44, lean: 0.14, width: 0.085 },
    { angle: 2.15, height: 0.36, lean: 0.13, width: 0.075 },
    { angle: 4.25, height: 0.4, lean: 0.15, width: 0.08 },
  ];

  for (const b of blades) {
    const ca = Math.cos(b.angle);
    const sa = Math.sin(b.angle);
    // Blade width perpendicular to lean direction
    const px = -sa * b.width;
    const pz = ca * b.width;
    const lx = ca * b.lean;
    const lz = sa * b.lean;

    const v0 = [-px, 0, -pz];
    const v1 = [px, 0, pz];
    const v2 = [-px * 0.45 + lx * 0.4, b.height * 0.55, -pz * 0.45 + lz * 0.4];
    const v3 = [px * 0.45 + lx * 0.4, b.height * 0.55, pz * 0.45 + lz * 0.4];
    const tip = [lx, b.height, lz];

    // Quad lower + triangle upper
    const tris = [
      [v0, v1, v3],
      [v0, v3, v2],
      [v2, v3, tip],
    ];
    for (const [a, bVert, c] of tris) {
      positions.push(...a, ...bVert, ...c);
      // Soft upward-tilted storybook normals so grass catches bright sunlit toon band
      normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return geo;
}

// --- LUSH STORYBOOK CARTOON ENVIRONMENT (scales cleanly for 12x12, 18x18, or 24x24 grids) ---
export function buildSurroundingWorld(textures: ProceduralTextureSet, gridSize = 12): THREE.Group {
  const world = new THREE.Group();
  const boardSpan = gridSize * TILE_SIZE;
  const halfBoard = boardSpan / 2;

  // Vast sunlit cartoon meadow ground plane (recessed cleanly below sanctuary terrace to prevent any depth-fighting)
  const groundMat = toonMat(0xffffff, {
    map: textures.meadowGrass,
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 2,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.1;
  ground.receiveShadow = true;
  ground.name = 'sanctuary_ground_outer';
  world.add(ground);

  // Rounded sunlit playable sanctuary meadow terrace (top flush at y = 0.0, planar UVs matched to meadowGrass)
  const lawnMat = toonMat(0xf4ffe0, {
    map: textures.meadowGrass,
  });
  const lawnGeo = createRoundedBoxGeometry(boardSpan + 0.85, 0.14, boardSpan + 0.85, 0.06, 3).clone();
  lawnGeo.userData.shared = false;
  const lawnPos = lawnGeo.getAttribute('position');
  const lawnUv = lawnGeo.getAttribute('uv');
  if (lawnPos && lawnUv) {
    for (let i = 0; i < lawnPos.count; i++) {
      const lx = lawnPos.getX(i);
      const lz = lawnPos.getZ(i);
      lawnUv.setXY(i, lx / 240 + 0.5, -lz / 240 + 0.5);
    }
    lawnUv.needsUpdate = true;
  }
  const sanctuaryLawn = new THREE.Mesh(lawnGeo, lawnMat);
  sanctuaryLawn.position.y = -0.07;
  sanctuaryLawn.receiveShadow = true;
  sanctuaryLawn.name = 'sanctuary_ground_lawn';
  world.add(sanctuaryLawn);
  world.userData.groundMat = groundMat;
  world.userData.lawnMat = lawnMat;

  // Soft pastel meadow plot grid lines
  const gridHelper = new THREE.GridHelper(boardSpan, gridSize, 0x5c9c42, 0x67ab4b);
  gridHelper.position.y = 0.018;
  const gMat = gridHelper.material as THREE.Material;
  gMat.transparent = true;
  gMat.opacity = 0.22;
  world.add(gridHelper);

  // Sparkling Cartoon Turquoise Brook along South-East outer perimeter
  const brookOffset = halfBoard + 5.2;
  const brookPoints = [
    new THREE.Vector3(-(halfBoard + 30), 0.03, brookOffset + 0.6),
    new THREE.Vector3(-(halfBoard + 6), 0.03, brookOffset - 0.8),
    new THREE.Vector3(0, 0.03, brookOffset + 0.2),
    new THREE.Vector3(halfBoard + 4.8, 0.03, brookOffset - 1.5),
    new THREE.Vector3(halfBoard + 7.5, 0.03, 0),
    new THREE.Vector3(halfBoard + 6.5, 0.03, -(halfBoard + 12)),
    new THREE.Vector3(halfBoard + 12, 0.03, -(halfBoard + 34)),
  ];
  const brookCurve = new THREE.CatmullRomCurve3(brookPoints);
  const brookGeo = new THREE.TubeGeometry(brookCurve, 56, 2.35, 8, false);
  brookGeo.scale(1, 0.05, 1);
  const brook = new THREE.Mesh(
    brookGeo,
    toonMat(0xffffff, {
      map: textures.waterRipple,
      emissive: 0x1e7a9e,
      emissiveIntensity: 0.2,
    }),
  );
  brook.position.y = -0.05;
  world.add(brook);

  // Cozy Rounded Storybook Wooden Footbridge crossing the brook on the south edge
  const bridgeGroup = new THREE.Group();
  bridgeGroup.position.set(0, 0.22, brookOffset + 0.2);
  const bridgeWood = toonMat(0xffffff, { map: textures.woodGrain });
  const bridgeCapMat = toonMat(0xe6b563);

  const deck = addShadow(
    new THREE.Mesh(createRoundedBoxGeometry(3.3, 0.2, 5.2, 0.12, 3), bridgeWood),
  );
  bridgeGroup.add(deck);

  // Chunky rounded fence posts & handrails on bridge sides
  const bPostGeo = new THREE.CapsuleGeometry(0.11, 0.65, 6, 8);
  const bRailGeo = new THREE.CapsuleGeometry(0.065, 5.05, 6, 8);
  for (const rx of [-1.48, 1.48]) {
    for (const pz of [-2.3, 0, 2.3]) {
      const post = addShadow(new THREE.Mesh(bPostGeo, bridgeWood));
      post.position.set(rx, 0.38, pz);
      addInkOutline(post, 1.07);
      bridgeGroup.add(post);

      const knob = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), bridgeCapMat));
      knob.position.set(rx, 0.78, pz);
      bridgeGroup.add(knob);
    }
    const topRail = addShadow(new THREE.Mesh(bRailGeo, bridgeWood));
    topRail.rotation.x = Math.PI / 2;
    topRail.position.set(rx, 0.64, 0);
    bridgeGroup.add(topRail);

    const midRail = addShadow(new THREE.Mesh(bRailGeo, bridgeWood));
    midRail.rotation.x = Math.PI / 2;
    midRail.position.set(rx, 0.36, 0);
    bridgeGroup.add(midRail);
  }
  world.add(bridgeGroup);

  // Layered Soft Pastel Rolling Storybook Hills around the perimeter
  const hillMatNear = toonMat(0x73b856);
  const hillMatFar = toonMat(0x88c96b);
  const hillPad = halfBoard - 12;
  const hillConfigs: [number, number, number, number, boolean][] = [
    [-28 - hillPad, -26 - hillPad, 15, 4.8, false],
    [0, -35 - hillPad, 20, 5.8, true],
    [32 + hillPad, -26 - hillPad, 16, 5.2, false],
    [-35 - hillPad, 4, 16, 4.4, true],
    [36 + hillPad, 14, 17, 4.8, false],
    [-26 - hillPad, 34 + hillPad, 17, 4.2, true],
    [24 + hillPad, 34 + hillPad, 16, 4.4, false],
    [-44 - hillPad, -42 - hillPad, 24, 7.6, true],
    [44 + hillPad, -40 - hillPad, 23, 7.2, true],
  ];
  for (const [hx, hz, hr, hh, isFar] of hillConfigs) {
    const hill = new THREE.Mesh(new THREE.SphereGeometry(hr, 18, 12), isFar ? hillMatFar : hillMatNear);
    hill.scale.set(1.1, hh / hr, 1.0);
    hill.position.set(hx, -hh * 0.22, hz);
    hill.receiveShadow = true;
    world.add(hill);
  }

  // InstancedMesh Perimeter Fluffy Cloud-Canopy Cartoon Forest (zero stiff cones!)
  const treeCount = gridSize >= 24 ? 108 : gridSize >= 18 ? 90 : 72;
  const trunkInst = new THREE.InstancedMesh(
    new THREE.CapsuleGeometry(0.24, 1.25, 6, 8),
    toonMat(0x8a5d3b),
    treeCount,
  );
  const puffGeo = new THREE.SphereGeometry(1.0, 12, 10);
  const canopyBaseInst = new THREE.InstancedMesh(puffGeo, toonMat(0xffffff), treeCount);
  const canopySideInst = new THREE.InstancedMesh(puffGeo, toonMat(0xffffff), treeCount);
  const canopyTopInst = new THREE.InstancedMesh(puffGeo, toonMat(0xffffff), treeCount);
  trunkInst.castShadow = true;
  canopyBaseInst.castShadow = true;
  canopySideInst.castShadow = true;
  canopyTopInst.castShadow = true;

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const palette = [0x47964a, 0x5cb354, 0x3b8554, 0x73bf52, 0xe3773b];

  const treeClear = halfBoard + 2.6;
  let placed = 0;
  let attempt = 0;
  while (placed < treeCount && attempt < 700) {
    attempt++;
    const angle = (attempt / treeCount) * Math.PI * 2 + Math.sin(attempt * 12.98) * 0.5;
    const radius = halfBoard + 5.8 + ((attempt * 7.31) % 22);
    const tx = Math.cos(angle) * radius;
    const tz = Math.sin(angle) * radius;
    if (Math.abs(tx) < treeClear && Math.abs(tz) < treeClear) continue;
    if (Math.abs(tx) < 4.2 && tz > halfBoard && tz < brookOffset + 5.8) continue;

    const sc = 0.85 + ((attempt * 1.618) % 0.42);
    const rotY = (attempt * 2.1) % (Math.PI * 2);

    // Chunky rounded trunk
    dummy.position.set(tx, 0.72 * sc, tz);
    dummy.scale.set(sc, sc, sc);
    dummy.rotation.set(0, rotY, Math.sin(attempt) * 0.05);
    dummy.updateMatrix();
    trunkInst.setMatrixAt(placed, dummy.matrix);

    // Lower wide shaded foliage cloud puff
    dummy.position.set(tx, 2.05 * sc, tz);
    dummy.scale.set(1.25 * sc, 0.95 * sc, 1.25 * sc);
    dummy.rotation.set(0, rotY, 0);
    dummy.updateMatrix();
    canopyBaseInst.setMatrixAt(placed, dummy.matrix);

    // Offset side cloud puff for organic asymmetry
    const ox = Math.cos(rotY) * 0.65 * sc;
    const oz = Math.sin(rotY) * 0.65 * sc;
    dummy.position.set(tx + ox, 2.38 * sc, tz + oz);
    dummy.scale.set(0.92 * sc, 0.84 * sc, 0.92 * sc);
    dummy.updateMatrix();
    canopySideInst.setMatrixAt(placed, dummy.matrix);

    // Bright sunlit crown puff on top
    dummy.position.set(tx - ox * 0.35, 3.0 * sc, tz - oz * 0.35);
    dummy.scale.set(0.86 * sc, 0.78 * sc, 0.86 * sc);
    dummy.updateMatrix();
    canopyTopInst.setMatrixAt(placed, dummy.matrix);

    // Shaded base -> vibrant mid -> sunlit crown color steps
    color.setHex(palette[placed % palette.length]);
    color.offsetHSL(0, 0.02, -0.05);
    canopyBaseInst.setColorAt(placed, color);
    color.setHex(palette[placed % palette.length]);
    canopySideInst.setColorAt(placed, color);
    color.offsetHSL(0.02, 0.06, 0.09);
    canopyTopInst.setColorAt(placed, color);
    placed++;
  }
  trunkInst.count = placed;
  canopyBaseInst.count = placed;
  canopySideInst.count = placed;
  canopyTopInst.count = placed;
  trunkInst.computeBoundingSphere();
  canopyBaseInst.computeBoundingSphere();
  canopySideInst.computeBoundingSphere();
  canopyTopInst.computeBoundingSphere();
  world.add(trunkInst, canopyBaseInst, canopySideInst, canopyTopInst);

  // InstancedMesh Swaying Stylized Meadow Grass Tufts (GPU breeze sway via uTime uniform!)
  const swayUniforms = { uTime: { value: 0 } };
  const grassTuftMat = new THREE.MeshToonMaterial({
    color: 0xffffff,
    gradientMap: getToonGradientMap(),
    side: THREE.DoubleSide,
  });
  grassTuftMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = swayUniforms.uTime;
    shader.vertexShader = `uniform float uTime;\n` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      /* glsl */ `
      #include <begin_vertex>
      float swayHeight = max(0.0, transformed.y);
      float tuftPhase = 0.0;
      #ifdef USE_INSTANCING
        tuftPhase = instanceMatrix[3].x * 0.45 + instanceMatrix[3].z * 0.35;
      #endif
      float wind = sin(uTime * 2.3 + tuftPhase) * 0.16 * swayHeight * swayHeight;
      transformed.x += wind;
      transformed.z += wind * 0.55;
      `,
    );
  };
  world.userData.swayUniforms = swayUniforms;

  const grassCount = gridSize >= 24 ? 320 : 240;
  const grassInst = new THREE.InstancedMesh(createGrassTuftGeometry(), grassTuftMat, grassCount);
  grassInst.receiveShadow = true;
  const grassPalette = [0x72bf4c, 0x89d459, 0x5eab46, 0x9ce065];
  let gPlaced = 0;
  let gAttempt = 0;
  while (gPlaced < grassCount && gAttempt < 1200) {
    gAttempt++;
    const a = (gAttempt * 2.39996) % (Math.PI * 2); // Golden-angle even organic spread
    const r = halfBoard + 1.0 + ((gAttempt * 3.71) % 14.5);
    const gx = Math.cos(a) * r;
    const gz = Math.sin(a) * r;
    // Avoid playable build grid and south bridge/brook center
    if (Math.abs(gx) < halfBoard + 0.65 && Math.abs(gz) < halfBoard + 0.65) continue;
    if (Math.abs(gz - brookOffset) < 2.2 && Math.abs(gx) < halfBoard + 8) continue;

    const sc = 0.78 + (gPlaced % 5) * 0.13;
    dummy.position.set(gx, -0.1, gz);
    dummy.rotation.set(0, (gAttempt * 1.7) % (Math.PI * 2), 0);
    dummy.scale.set(sc, sc, sc);
    dummy.updateMatrix();
    grassInst.setMatrixAt(gPlaced, dummy.matrix);

    color.setHex(grassPalette[gPlaced % grassPalette.length]);
    grassInst.setColorAt(gPlaced, color);
    gPlaced++;
  }
  grassInst.count = gPlaced;
  grassInst.computeBoundingSphere();
  world.add(grassInst);

  // InstancedMesh Cheerful Two-Tone Meadow Daisies & Wildflowers
  const flowerCount = gridSize >= 24 ? 140 : 96;
  const petalInst = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.18, 10, 8),
    toonMat(0xffffff),
    flowerCount,
  );
  const centerInst = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.085, 8, 6),
    toonMat(0xffe047, { emissive: 0xd99b00, emissiveIntensity: 0.2 }),
    flowerCount,
  );
  const fColors = [0xfff9eb, 0xffa6c2, 0xc3a8ff, 0xffe478];
  for (let i = 0; i < flowerCount; i++) {
    const a = (i / flowerCount) * Math.PI * 2 + (i % 3) * 0.08;
    const r = halfBoard + 1.45 + ((i * 5.7) % 8.5);
    const fx = Math.cos(a) * r;
    const fz = Math.sin(a) * r;
    const sc = 0.75 + (i % 4) * 0.14;
    dummy.position.set(fx, -0.1 + 0.1 * sc, fz);
    dummy.rotation.set(0, i * 0.7, 0);
    dummy.scale.set(sc, sc * 0.48, sc);
    dummy.updateMatrix();
    petalInst.setMatrixAt(i, dummy.matrix);

    dummy.position.set(fx, -0.1 + 0.16 * sc, fz);
    dummy.scale.set(sc, sc * 0.75, sc);
    dummy.updateMatrix();
    centerInst.setMatrixAt(i, dummy.matrix);

    color.setHex(fColors[i % fColors.length]);
    petalInst.setColorAt(i, color);
  }
  petalInst.computeBoundingSphere();
  centerInst.computeBoundingSphere();
  world.add(petalInst, centerInst);

  return world;
}
