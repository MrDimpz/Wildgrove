import * as THREE from 'three';

let cachedGradientMap: THREE.DataTexture | null = null;
const outlineMatCache = new Map<number, THREE.MeshBasicMaterial>();
const roundedBoxGeoCache = new Map<string, THREE.BufferGeometry>();

/**
 * Shared 4-band cozy storybook cel-shading gradient map.
 * Keeps shaded bands bright and painterly rather than muddy/black.
 */
export function getToonGradientMap(): THREE.DataTexture {
  if (cachedGradientMap) return cachedGradientMap;
  const bands = new Uint8Array([122, 178, 224, 255]);
  const tex = new THREE.DataTexture(bands, bands.length, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  cachedGradientMap = tex;
  return tex;
}

export interface ToonMatOptions {
  map?: THREE.Texture | null;
  emissive?: number;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
  side?: THREE.Side;
  alphaTest?: number;
  polygonOffset?: boolean;
  polygonOffsetFactor?: number;
  polygonOffsetUnits?: number;
  depthWrite?: boolean;
}

/**
 * Creates a stylized cel-shaded MeshToonMaterial using the shared storybook gradient map.
 */
export function toonMat(color: number, opts: ToonMatOptions = {}): THREE.MeshToonMaterial {
  const mat = new THREE.MeshToonMaterial({
    color,
    gradientMap: getToonGradientMap(),
    map: opts.map ?? null,
    emissive: opts.emissive !== undefined ? new THREE.Color(opts.emissive) : new THREE.Color(0x14100c),
    emissiveIntensity: opts.emissiveIntensity !== undefined ? opts.emissiveIntensity : 0.05,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
    alphaTest: opts.alphaTest ?? 0,
    polygonOffset: opts.polygonOffset ?? false,
    polygonOffsetFactor: opts.polygonOffsetFactor ?? 0,
    polygonOffsetUnits: opts.polygonOffsetUnits ?? 0,
    depthWrite: opts.depthWrite ?? true,
  });
  return mat;
}

/**
 * Returns a cached BackSide ink material for crisp, soft espresso-brown cartoon outlines.
 */
export function getOutlineMaterial(colorHex = 0x2c221c): THREE.MeshBasicMaterial {
  let mat = outlineMatCache.get(colorHex);
  if (!mat) {
    mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      side: THREE.BackSide,
    });
    mat.userData.shared = true;
    outlineMatCache.set(colorHex, mat);
  }
  return mat;
}

/**
 * Adds an inverted-hull cartoon ink outline as a child of a hero mesh.
 * Inherits parent scale & transforms cleanly and never casts or receives shadows.
 */
export function addInkOutline(
  mesh: THREE.Mesh,
  scale = 1.055,
  colorHex = 0x2c221c,
): THREE.Mesh {
  const outline = new THREE.Mesh(mesh.geometry, getOutlineMaterial(colorHex));
  outline.scale.setScalar(scale);
  outline.castShadow = false;
  outline.receiveShadow = false;
  outline.userData.isOutline = true;
  mesh.add(outline);
  return outline;
}

/**
 * Creates a cached beveled rounded-box geometry centered at origin with drop-in
 * dimensions matching BoxGeometry(width, height, depth) — zero harsh 90-degree edges.
 */
export function createRoundedBoxGeometry(
  width: number,
  height: number,
  depth: number,
  radius = 0.08,
  smoothness = 3,
): THREE.BufferGeometry {
  const r = Math.max(0.004, Math.min(radius, width * 0.42, height * 0.42, depth * 0.42));
  const key = `${width.toFixed(3)}_${height.toFixed(3)}_${depth.toFixed(3)}_${r.toFixed(3)}_${smoothness}`;
  const cached = roundedBoxGeoCache.get(key);
  if (cached) return cached;

  const innerW = Math.max(0.005, width - r * 2);
  const innerD = Math.max(0.005, depth - r * 2);
  const innerH = Math.max(0.004, height - r * 2);

  const hw = innerW / 2;
  const hd = innerD / 2;
  const cornerR = Math.min(r * 0.85, hw * 0.9, hd * 0.9);

  const shape = new THREE.Shape();
  shape.moveTo(-hw + cornerR, -hd);
  shape.lineTo(hw - cornerR, -hd);
  shape.quadraticCurveTo(hw, -hd, hw, -hd + cornerR);
  shape.lineTo(hw, hd - cornerR);
  shape.quadraticCurveTo(hw, hd, hw - cornerR, hd);
  shape.lineTo(-hw + cornerR, hd);
  shape.quadraticCurveTo(-hw, hd, -hw, hd - cornerR);
  shape.lineTo(-hw, -hd + cornerR);
  shape.quadraticCurveTo(-hw, -hd, -hw + cornerR, -hd);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: innerH,
    bevelEnabled: true,
    bevelSegments: smoothness,
    steps: 1,
    bevelSize: r,
    bevelThickness: r,
    curveSegments: smoothness + 2,
  });

  geo.rotateX(-Math.PI / 2);
  geo.center();
  geo.computeVertexNormals();
  geo.userData.shared = true;
  roundedBoxGeoCache.set(key, geo);
  return geo;
}

export interface FoliagePuffSpec {
  x: number;
  y: number;
  z: number;
  r: number;
  tone?: 'highlight' | 'mid' | 'shadow';
  scaleY?: number;
}

/**
 * Builds soft, overlapping cloud-like cartoon foliage clusters with sunlit tops & shaded bases.
 */
export function addPuffyFoliageCluster(
  parent: THREE.Object3D,
  puffs: FoliagePuffSpec[],
  baseColor: number,
  highlightColor: number,
  shadowColor: number,
  withOutline = false,
): void {
  const mats = {
    mid: toonMat(baseColor),
    highlight: toonMat(highlightColor),
    shadow: toonMat(shadowColor),
  };
  for (const p of puffs) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(p.r, 14, 10),
      mats[p.tone ?? 'mid'],
    );
    mesh.position.set(p.x, p.y, p.z);
    if (p.scaleY && p.scaleY !== 1) {
      mesh.scale.set(1, p.scaleY, 1);
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (withOutline) {
      addInkOutline(mesh, 1.045);
    }
    parent.add(mesh);
  }
}

export interface SkyPaletteConfig {
  topColor: number;
  horizonColor: number;
  bottomColor: number;
  sunGlowColor: number;
  cloudColor: number;
  cloudShadowColor: number;
  starOpacity: number;
}

export interface CartoonSkySystem {
  group: THREE.Group;
  setPalette: (cfg: SkyPaletteConfig) => void;
  update: (elapsed: number, dt: number) => void;
  dispose: () => void;
}

interface DriftingCloud {
  group: THREE.Group;
  angle: number;
  radius: number;
  baseY: number;
  speed: number;
  bobPhase: number;
}

/**
 * Builds a painted vertical gradient cartoon sky dome with soft sun halo,
 * night stars, and drifting fluffy 3D storybook clouds around the horizon.
 */
export function buildCartoonSkyAndClouds(): CartoonSkySystem {
  const group = new THREE.Group();
  group.name = 'cartoon_sky_system';

  const uniforms = {
    uTopColor: { value: new THREE.Color(0x6ec3f4) },
    uHorizonColor: { value: new THREE.Color(0xddf2ff) },
    uBottomColor: { value: new THREE.Color(0xc5e6cc) },
    uSunDir: { value: new THREE.Vector3(0.55, 0.58, 0.42).normalize() },
    uSunGlowColor: { value: new THREE.Color(0xfff5cf) },
  };

  const skyGeo = new THREE.SphereGeometry(185, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: /* glsl */ `
      varying vec3 vWorldDir;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldDir = normalize(position);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTopColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uBottomColor;
      uniform vec3 uSunDir;
      uniform vec3 uSunGlowColor;
      varying vec3 vWorldDir;

      void main() {
        vec3 dir = normalize(vWorldDir);
        float h = dir.y;
        vec3 col = mix(uBottomColor, uHorizonColor, smoothstep(-0.18, 0.06, h));
        col = mix(col, uTopColor, smoothstep(0.04, 0.62, h));

        // Soft painted storybook sun halo
        float sunAmt = max(dot(dir, normalize(uSunDir)), 0.0);
        col = mix(col, uSunGlowColor, pow(sunAmt, 8.0) * 0.42);
        col += uSunGlowColor * smoothstep(0.985, 0.996, sunAmt) * 0.45;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const skyDome = new THREE.Mesh(skyGeo, skyMat);
  skyDome.frustumCulled = false;
  skyDome.renderOrder = -20;
  group.add(skyDome);

  // Twinkling storybook stars visible during cozy Night mode
  const starCount = 120;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = 0.14 + Math.random() * 0.42; // Upper sky hemisphere
    const r = 162;
    starPos[i * 3] = Math.cos(theta) * Math.cos(phi) * r;
    starPos[i * 3 + 1] = Math.sin(phi) * r;
    starPos[i * 3 + 2] = Math.sin(theta) * Math.cos(phi) * r;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xfff8dc,
    size: 1.5,
    transparent: true,
    opacity: 0,
    fog: false,
    depthWrite: false,
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.visible = false;
  group.add(stars);

  // Drifting Fluffy 3D Cartoon Clouds around upper sky ring
  const cloudMatTop = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
  const cloudMatBase = new THREE.MeshBasicMaterial({ color: 0xeaf4fc, fog: false });
  const cloudGeoUnit = new THREE.SphereGeometry(1, 12, 9);

  const clouds: DriftingCloud[] = [];
  const cloudCount = 14;
  for (let i = 0; i < cloudCount; i++) {
    const cGroup = new THREE.Group();
    const scale = 1.65 + (i % 4) * 0.48;

    // Fluffy asymmetric multi-puff cloud cluster
    const puffSpecs: [number, number, number, number, boolean][] = [
      [0, 0.45, 0, 1.35, true],
      [-1.15, 0.1, 0.15, 1.0, true],
      [1.18, 0.15, -0.1, 1.05, true],
      [-0.55, -0.22, 0.3, 0.92, false],
      [0.62, -0.2, -0.22, 0.96, false],
      [0.15, 0.85, -0.1, 0.88, true],
    ];
    for (const [px, py, pz, pr, isTop] of puffSpecs) {
      const puff = new THREE.Mesh(cloudGeoUnit, isTop ? cloudMatTop : cloudMatBase);
      puff.position.set(px, py, pz);
      puff.scale.set(pr * 1.15, pr * 0.78, pr * 0.95);
      puff.frustumCulled = false;
      cGroup.add(puff);
    }

    const angle = (i / cloudCount) * Math.PI * 2 + (i % 3) * 0.18;
    const radius = 78 + (i % 3) * 18;
    const baseY = 27 + (i % 4) * 4.5;
    cGroup.scale.setScalar(scale);
    cGroup.position.set(Math.cos(angle) * radius, baseY, Math.sin(angle) * radius);
    cGroup.lookAt(0, baseY, 0);
    group.add(cGroup);

    clouds.push({
      group: cGroup,
      angle,
      radius,
      baseY,
      speed: 0.0085 + (i % 4) * 0.0022,
      bobPhase: i * 1.3,
    });
  }

  return {
    group,
    setPalette(cfg: SkyPaletteConfig) {
      uniforms.uTopColor.value.setHex(cfg.topColor);
      uniforms.uHorizonColor.value.setHex(cfg.horizonColor);
      uniforms.uBottomColor.value.setHex(cfg.bottomColor);
      uniforms.uSunGlowColor.value.setHex(cfg.sunGlowColor);
      cloudMatTop.color.setHex(cfg.cloudColor);
      cloudMatBase.color.setHex(cfg.cloudShadowColor);
      starMat.opacity = cfg.starOpacity;
      stars.visible = cfg.starOpacity > 0.02;
    },
    update(elapsed: number, dt: number) {
      for (const c of clouds) {
        c.angle += c.speed * dt;
        const y = c.baseY + Math.sin(elapsed * 0.45 + c.bobPhase) * 0.75;
        c.group.position.set(Math.cos(c.angle) * c.radius, y, Math.sin(c.angle) * c.radius);
        c.group.lookAt(0, y, 0);
      }
      if (stars.visible) {
        stars.rotation.y = elapsed * 0.004;
      }
    },
    dispose() {
      skyGeo.dispose();
      skyMat.dispose();
      starGeo.dispose();
      starMat.dispose();
      cloudGeoUnit.dispose();
      cloudMatTop.dispose();
      cloudMatBase.dispose();
    },
  };
}
