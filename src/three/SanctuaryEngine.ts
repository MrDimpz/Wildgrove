import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { PlacementChoice, SanctuaryState } from '../types/game';
import { isCellOccupied } from '../data/catalog';
import { createProceduralTextures, type ProceduralTextureSet } from './proceduralTextures';
import { animateAnimalRig, type AnimatedAnimalRig } from './animalModels';
import {
  buildCropModel,
  buildDecorationModel,
  buildEnclosureModel,
  buildSurroundingWorld,
  gridToWorld,
  TILE_SIZE,
  type BuiltCrop,
} from './worldModels';
import { SanctuaryWeatherSystem, type EnvironmentThemeId } from './weatherSystem';

export interface EngineCallbacks {
  onSelectEnclosure: (enclosureId: string) => void;
  onHarvestCrop: (cropId: string) => void;
  onPlaceAtTile: (gridX: number, gridZ: number) => void;
}

interface BurstParticle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  active: boolean;
}

const _rayPoint = new THREE.Vector3();
const _groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _camForward = new THREE.Vector3();
const _camRight = new THREE.Vector3();
const _panDelta = new THREE.Vector3();

function detectSoftwareWebGL(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export class SanctuaryEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private textures: ProceduralTextureSet;
  private isSoftwareGl: boolean;
  private callbacks: EngineCallbacks;

  private dynamicGroup = new THREE.Group();
  private worldGroup: THREE.Group | null = null;
  private weatherSystem: SanctuaryWeatherSystem;
  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private animalRigs = new Map<string, AnimatedAnimalRig>();
  private builtCrops = new Map<string, BuiltCrop>();
  private pickables: THREE.Object3D[] = [];

  private currentState: SanctuaryState | null = null;
  private placementChoice: PlacementChoice | null = null;
  private isTitlePan = true;

  // Placement hover ghost
  private hoverTileMesh: THREE.Mesh;
  private hoverGrid: { gx: number; gz: number } | null = null;

  // Camera smooth focus transition
  private cameraGoalPos: THREE.Vector3 | null = null;
  private cameraGoalTarget: THREE.Vector3 | null = null;

  // Pooled burst particles (Zero GC inside tick)
  private particles: BurstParticle[] = [];

  // Input state
  private raycaster = new THREE.Raycaster();
  private pointerNdc = new THREE.Vector2();
  private pointerDownPos = new THREE.Vector2();
  private heldKeys = new Set<string>();
  private lastHoverRaycast = 0;

  // Loop & timing
  private clock = new THREE.Clock();
  private frameId = 0;
  private disposed = false;

  constructor(container: HTMLElement, callbacks: EngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.isSoftwareGl = detectSoftwareWebGL();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    // Scene with warm sunlit cerulean sky & matched horizon fog
    this.scene = new THREE.Scene();
    const skyColor = new THREE.Color(0xcce6f4);
    this.scene.background = skyColor;
    this.scene.fog = new THREE.FogExp2(0xcce6f4, 0.0125);

    // Mandatory studio IBL environment map
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // Cozy isometric-style narrow-FOV PerspectiveCamera
    this.camera = new THREE.PerspectiveCamera(30, width / height, 0.5, 220);
    this.camera.position.set(25, 22, 25);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.07;
    this.controls.minDistance = 13;
    this.controls.maxDistance = 54;
    this.controls.minPolarAngle = Math.PI * 0.17;
    this.controls.maxPolarAngle = Math.PI * 0.41;
    this.controls.screenSpacePanning = false;
    this.controls.target.set(0, 0.5, 0);
    this.controls.addEventListener('start', () => {
      // Cancel scripted camera glide immediately when user drags
      this.cameraGoalPos = null;
      this.cameraGoalTarget = null;
    });

    // Warm/Cool 3-Point Outdoor Sunlight Rig
    const hemi = new THREE.HemisphereLight(0xa3d8f4, 0x5c7c44, 0.85);
    hemi.position.set(0, 40, 0);
    this.hemiLight = hemi;
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff1d2, 2.05);
    sun.position.set(24, 34, 18);
    sun.castShadow = !this.isSoftwareGl;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -20;
    sun.shadow.camera.right = 20;
    sun.shadow.camera.top = 20;
    sun.shadow.camera.bottom = -20;
    sun.shadow.camera.near = 6;
    sun.shadow.camera.far = 75;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.025;
    this.sunLight = sun;
    this.scene.add(sun);

    const rim = new THREE.DirectionalLight(0xc2e2ff, 0.48);
    rim.position.set(-22, 16, -24);
    this.scene.add(rim);

    // Procedural textures & lush surrounding meadow world
    this.textures = createProceduralTextures(this.renderer.capabilities.getMaxAnisotropy());
    const world = buildSurroundingWorld(this.textures);
    this.worldGroup = world;
    this.scene.add(world);
    this.scene.add(this.dynamicGroup);

    // Procedural Theme-Matched Weather System
    this.weatherSystem = new SanctuaryWeatherSystem();
    this.scene.add(this.weatherSystem.group);

    // Placement hover indicator plane
    this.hoverTileMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(TILE_SIZE * 0.96, TILE_SIZE * 0.96),
      new THREE.MeshBasicMaterial({
        color: 0x38b86a,
        transparent: true,
        opacity: 0.48,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.hoverTileMesh.rotation.x = -Math.PI / 2;
    this.hoverTileMesh.position.y = 0.09;
    this.hoverTileMesh.visible = false;
    this.scene.add(this.hoverTileMesh);

    // Pre-allocate pooled particle meshes
    const pGeo = new THREE.OctahedronGeometry(0.14, 0);
    for (let i = 0; i < 36; i++) {
      const m = new THREE.Mesh(
        pGeo,
        new THREE.MeshStandardMaterial({
          color: 0xffd559,
          emissive: 0xffb338,
          emissiveIntensity: 0.45,
          roughness: 0.25,
        }),
      );
      m.visible = false;
      this.scene.add(m);
      this.particles.push({
        mesh: m,
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 1,
        active: false,
      });
    }

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.clock.start();
    this.tick();
  }

  public setTitleMode(isTitle: boolean): void {
    this.isTitlePan = isTitle;
    this.controls.enabled = !isTitle;
    if (!isTitle) {
      this.cameraGoalPos = new THREE.Vector3(24, 21, 24);
      this.cameraGoalTarget = new THREE.Vector3(0, 0.4, 0);
    }
  }

  public setPlacementChoice(choice: PlacementChoice | null): void {
    this.placementChoice = choice;
    if (!choice) {
      this.hoverTileMesh.visible = false;
      this.hoverGrid = null;
    } else {
      const span = choice.kind === 'enclosure' ? 2 : 1;
      this.hoverTileMesh.scale.set(span, span, 1);
    }
  }

  public setTerrainTheme(theme: EnvironmentThemeId): void {
    if (!this.worldGroup) return;
    const groundMat = this.worldGroup.userData.groundMat as THREE.MeshStandardMaterial | undefined;
    const lawnMat = this.worldGroup.userData.lawnMat as THREE.MeshStandardMaterial | undefined;
    const palette: Record<
      EnvironmentThemeId,
      {
        ground: number;
        lawn: number;
        sky: number;
        fogDensity: number;
        sunColor: number;
        sunIntensity: number;
        hemiSky: number;
      }
    > = {
      meadow: {
        ground: 0xffffff,
        lawn: 0x82b860,
        sky: 0xcce6f4,
        fogDensity: 0.0125,
        sunColor: 0xfff1d2,
        sunIntensity: 2.05,
        hemiSky: 0xa3d8f4,
      },
      autumn: {
        ground: 0xe6c28e,
        lawn: 0xb08b4f,
        sky: 0xead8c0,
        fogDensity: 0.0135,
        sunColor: 0xffd79e,
        sunIntensity: 1.95,
        hemiSky: 0xf0cfa8,
      },
      alpine: {
        ground: 0xc6ded2,
        lawn: 0x628c70,
        sky: 0xc9e0ee,
        fogDensity: 0.014,
        sunColor: 0xeef6ff,
        sunIntensity: 1.85,
        hemiSky: 0xb6daf2,
      },
      clover: {
        ground: 0xcfe8ca,
        lawn: 0x609e65,
        sky: 0xb5cfde,
        fogDensity: 0.0155,
        sunColor: 0xd9e8f5,
        sunIntensity: 1.55,
        hemiSky: 0x9ec0d6,
      },
    };
    const cfg = palette[theme];
    if (groundMat) groundMat.color.setHex(cfg.ground);
    if (lawnMat) lawnMat.color.setHex(cfg.lawn);
    this.scene.background = new THREE.Color(cfg.sky);
    this.scene.fog = new THREE.FogExp2(cfg.sky, cfg.fogDensity);
    this.sunLight.color.setHex(cfg.sunColor);
    this.sunLight.intensity = cfg.sunIntensity;
    this.hemiLight.color.setHex(cfg.hemiSky);
    this.weatherSystem.setTheme(theme);
  }

  public setWeatherEnabled(enabled: boolean): void {
    this.weatherSystem.setEnabled(enabled);
  }

  public syncSanctuary(state: SanctuaryState): void {
    this.currentState = state;

    // Clear previous dynamic children cleanly
    while (this.dynamicGroup.children.length > 0) {
      const child = this.dynamicGroup.children[0];
      this.dynamicGroup.remove(child);
    }
    this.animalRigs.clear();
    this.builtCrops.clear();
    this.pickables = [];

    // 1. Build Enclosures
    for (const enc of state.enclosures) {
      const built = buildEnclosureModel(enc, this.textures, this.isSoftwareGl);
      this.dynamicGroup.add(built.group);
      this.animalRigs.set(enc.id, built.animalRig);
      this.pickables.push(built.hitProxy);
    }

    // 2. Build Crop Plots
    for (const crop of state.crops) {
      const built = buildCropModel(crop, this.textures);
      this.dynamicGroup.add(built.group);
      this.builtCrops.set(crop.id, built);
      this.pickables.push(built.hitProxy);
    }

    // 3. Build Habitat Decorations
    for (const dec of state.decorations) {
      const mesh = buildDecorationModel(dec.decorType, dec.gridX, dec.gridZ, dec.rotation, this.textures);
      this.dynamicGroup.add(mesh);
    }
  }

  public focusEnclosure(enclosureId: string): void {
    if (!this.currentState) return;
    const enc = this.currentState.enclosures.find((e) => e.id === enclosureId);
    if (!enc) return;
    const target = gridToWorld(enc.gridX, enc.gridZ, 2);
    target.y = 0.7;
    this.cameraGoalTarget = target;
    this.cameraGoalPos = new THREE.Vector3(target.x + 11.5, 10.5, target.z + 11.5);
  }

  public resetCamera(): void {
    this.cameraGoalTarget = new THREE.Vector3(0, 0.4, 0);
    this.cameraGoalPos = new THREE.Vector3(24, 21, 24);
  }

  public triggerCelebrationAtEnclosure(enclosureId: string, colorHex = 0xffd559): void {
    const rig = this.animalRigs.get(enclosureId);
    if (rig) {
      rig.happyTimer = 2.2;
    }
    const enc = this.currentState?.enclosures.find((e) => e.id === enclosureId);
    if (enc) {
      const pos = gridToWorld(enc.gridX, enc.gridZ, 2);
      pos.y = 1.25;
      this.spawnBurst(pos, colorHex, 14);
    }
  }

  public triggerBurstAtGrid(gx: number, gz: number, footprint: 1 | 2 = 1, colorHex = 0x62d980): void {
    const pos = gridToWorld(gx, gz, footprint);
    pos.y = 0.85;
    this.spawnBurst(pos, colorHex, 12);
  }

  private spawnBurst(origin: THREE.Vector3, colorHex: number, count: number): void {
    let spawned = 0;
    for (const p of this.particles) {
      if (p.active) continue;
      p.active = true;
      p.life = 0;
      p.maxLife = 0.85 + Math.random() * 0.45;
      p.mesh.position.copy(origin);
      p.mesh.position.x += (Math.random() - 0.5) * 0.8;
      p.mesh.position.z += (Math.random() - 0.5) * 0.8;
      p.vel.set((Math.random() - 0.5) * 2.2, 2.2 + Math.random() * 1.8, (Math.random() - 0.5) * 2.2);
      const m = p.mesh.material as THREE.MeshStandardMaterial;
      m.color.setHex(colorHex);
      m.emissive.setHex(colorHex);
      p.mesh.scale.setScalar(1);
      p.mesh.visible = true;
      spawned++;
      if (spawned >= count) break;
    }
  }

  public captureSnapshot(): string {
    // Explicitly render right before reading drawing buffer (preserveDrawingBuffer = false)
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  private bindEvents(): void {
    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', this.onPointerDown);
    dom.addEventListener('pointermove', this.onPointerMove);
    dom.addEventListener('pointerup', this.onPointerUp);
    dom.addEventListener('webglcontextlost', this.onContextLost);
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onWindowBlur);
  }

  private onContextLost = (e: Event) => {
    e.preventDefault();
  };

  private onResize = () => {
    if (this.disposed) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private onKeyDown = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    this.heldKeys.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.heldKeys.delete(e.code);
  };

  private onWindowBlur = () => {
    this.heldKeys.clear();
  };

  private updatePointerNdc(e: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private raycastGroundTile(): { gx: number; gz: number } | null {
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    if (!this.raycaster.ray.intersectPlane(_groundPlane, _rayPoint)) return null;
    const halfBoard = (12 * TILE_SIZE) / 2;
    const gx = Math.floor((_rayPoint.x + halfBoard) / TILE_SIZE);
    const gz = Math.floor((_rayPoint.z + halfBoard) / TILE_SIZE);
    if (gx < 0 || gz < 0 || gx >= 12 || gz >= 12) return null;
    return { gx, gz };
  }

  private onPointerDown = (e: PointerEvent) => {
    this.pointerDownPos.set(e.clientX, e.clientY);
  };

  private onPointerMove = (e: PointerEvent) => {
    if (this.isTitlePan) return;
    const now = performance.now();
    if (now - this.lastHoverRaycast < 45) return;
    this.lastHoverRaycast = now;

    this.updatePointerNdc(e);

    if (this.placementChoice && this.currentState) {
      const tile = this.raycastGroundTile();
      if (!tile) {
        this.hoverTileMesh.visible = false;
        this.hoverGrid = null;
        return;
      }
      const fp: 1 | 2 = this.placementChoice.kind === 'enclosure' ? 2 : 1;
      const clampedX = Math.min(12 - fp, tile.gx);
      const clampedZ = Math.min(12 - fp, tile.gz);
      this.hoverGrid = { gx: clampedX, gz: clampedZ };
      const worldPos = gridToWorld(clampedX, clampedZ, fp);
      this.hoverTileMesh.position.set(worldPos.x, 0.1, worldPos.z);
      const blocked = isCellOccupied(this.currentState, clampedX, clampedZ, fp);
      (this.hoverTileMesh.material as THREE.MeshBasicMaterial).color.setHex(blocked ? 0xe05252 : 0x35c26b);
      this.hoverTileMesh.visible = true;
      this.renderer.domElement.style.cursor = blocked ? 'not-allowed' : 'pointer';
      return;
    }

    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickables, false);
    this.renderer.domElement.style.cursor = hits.length > 0 ? 'pointer' : 'grab';
  };

  private onPointerUp = (e: PointerEvent) => {
    if (this.isTitlePan) return;
    const dist = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);
    if (dist > 8) return; // Was a camera drag, not a tap/click

    this.updatePointerNdc(e);

    if (this.placementChoice) {
      const tile = this.hoverGrid || this.raycastGroundTile();
      if (tile) {
        const fp: 1 | 2 = this.placementChoice.kind === 'enclosure' ? 2 : 1;
        this.callbacks.onPlaceAtTile(Math.min(12 - fp, tile.gx), Math.min(12 - fp, tile.gz));
      }
      return;
    }

    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickables, false);
    if (hits.length > 0) {
      const ud = hits[0].object.userData;
      if (ud.kind === 'enclosure' && typeof ud.id === 'string') {
        this.callbacks.onSelectEnclosure(ud.id);
      } else if (ud.kind === 'crop' && typeof ud.id === 'string') {
        this.callbacks.onHarvestCrop(ud.id);
      }
    }
  };

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick = () => {
    if (this.disposed) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const elapsed = this.clock.getElapsedTime();

    // 1. Title screen gentle diorama camera orbit
    if (this.isTitlePan) {
      const angle = elapsed * 0.14 + 0.72;
      this.camera.position.set(Math.cos(angle) * 29, 21.5, Math.sin(angle) * 29);
      this.camera.lookAt(0, 0.8, 0);
    } else {
      // WASD / Arrow smooth isometric panning
      const moveX = (this.heldKeys.has('KeyD') || this.heldKeys.has('ArrowRight') ? 1 : 0) -
        (this.heldKeys.has('KeyA') || this.heldKeys.has('ArrowLeft') ? 1 : 0);
      const moveZ = (this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown') ? 1 : 0) -
        (this.heldKeys.has('KeyW') || this.heldKeys.has('ArrowUp') ? 1 : 0);

      if (moveX !== 0 || moveZ !== 0) {
        this.cameraGoalPos = null;
        this.cameraGoalTarget = null;
        this.camera.getWorldDirection(_camForward);
        _camForward.y = 0;
        _camForward.normalize();
        _camRight.crossVectors(_camForward, THREE.Object3D.DEFAULT_UP).normalize();
        _panDelta.set(0, 0, 0);
        _panDelta.addScaledVector(_camRight, moveX * 14 * dt);
        _panDelta.addScaledVector(_camForward, -moveZ * 14 * dt);
        this.controls.target.add(_panDelta);
        this.camera.position.add(_panDelta);
      }

      // Clamp pan within sanctuary bounds
      this.controls.target.x = THREE.MathUtils.clamp(this.controls.target.x, -12, 12);
      this.controls.target.z = THREE.MathUtils.clamp(this.controls.target.z, -12, 12);

      // Smooth damped camera focus transition
      if (this.cameraGoalPos && this.cameraGoalTarget) {
        this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, this.cameraGoalPos.x, 5.2, dt);
        this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, this.cameraGoalPos.y, 5.2, dt);
        this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, this.cameraGoalPos.z, 5.2, dt);
        this.controls.target.x = THREE.MathUtils.damp(this.controls.target.x, this.cameraGoalTarget.x, 5.2, dt);
        this.controls.target.y = THREE.MathUtils.damp(this.controls.target.y, this.cameraGoalTarget.y, 5.2, dt);
        this.controls.target.z = THREE.MathUtils.damp(this.controls.target.z, this.cameraGoalTarget.z, 5.2, dt);
        if (this.camera.position.distanceTo(this.cameraGoalPos) < 0.08) {
          this.cameraGoalPos = null;
          this.cameraGoalTarget = null;
        }
      }

      this.controls.update();
    }

    // 2. Animate Animals
    this.animalRigs.forEach((rig) => animateAnimalRig(rig, elapsed, dt));

    // 3. Animate Crop Growth & Ready-to-Harvest Beacon
    const nowMs = Date.now();
    this.builtCrops.forEach((bc) => {
      const progress = Math.min(1, Math.max(0.18, (nowMs - bc.crop.plantedAt) / bc.crop.growDurationMs));
      const isReady = progress >= 0.999;
      const bounce = isReady ? 1 + Math.sin(elapsed * 4.5 + bc.crop.gridX) * 0.05 : progress;
      bc.plantGroup.scale.set(progress, bounce, progress);
      bc.readyRing.visible = isReady;
      if (isReady) {
        bc.readyRing.rotation.z = elapsed * 0.9;
      }
    });

    // 4. Water gentle UV drift
    this.textures.waterRipple.offset.x = (elapsed * 0.04) % 1;
    this.textures.waterRipple.offset.y = (elapsed * 0.025) % 1;

    // 5. Update Burst Particles
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      p.vel.y -= 4.2 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.y += 4.5 * dt;
      const s = 1 - p.life / p.maxLife;
      p.mesh.scale.setScalar(Math.max(0.01, s));
    }

    // 6. Update Procedural Weather Particles
    this.weatherSystem.update(dt, elapsed);

    this.renderer.render(this.scene, this.camera);

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    const dom = this.renderer.domElement;
    dom.removeEventListener('pointerdown', this.onPointerDown);
    dom.removeEventListener('pointermove', this.onPointerMove);
    dom.removeEventListener('pointerup', this.onPointerUp);
    dom.removeEventListener('webglcontextlost', this.onContextLost);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onWindowBlur);
    this.weatherSystem.dispose();
    this.controls.dispose();
    this.textures.dispose();
    this.renderer.dispose();
    if (dom.parentNode) dom.parentNode.removeChild(dom);
  }
}
