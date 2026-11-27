import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { EditableItemRef, PlacementChoice, SanctuaryState, TimeOfDayId } from '../types/game';
import {
  CROP_GROW_DURATION_MS,
  DEFAULT_GRID_SIZE,
  getDecorFootprint,
  isCellOccupied,
  todayDateString,
} from '../data/catalog';
import { createProceduralTextures, type ProceduralTextureSet } from './proceduralTextures';
import { animateAnimalRig, type AnimatedAnimalRig } from './animalModels';
import {
  buildCropModel,
  buildDecorationModel,
  buildEnclosureModel,
  buildForagingAcornMesh,
  buildNpcVisitorMesh,
  buildSurroundingWorld,
  gridToWorld,
  TILE_SIZE,
  type BuiltCrop,
  type BuiltForagingAcorn,
} from './worldModels';
import { SanctuaryWeatherSystem, type EnvironmentThemeId } from './weatherSystem';
import {
  buildCartoonSkyAndClouds,
  type CartoonSkySystem,
  type SkyPaletteConfig,
} from './cartoonStyle';

export type PhotoCameraPreset = 'iso' | 'scenic' | 'top' | 'orbit';
export type TouchDragMode = 'pan' | 'rotate';

export interface EngineCallbacks {
  onSelectEnclosure: (enclosureId: string) => void;
  onHarvestCrop: (cropId: string) => void;
  onPlaceAtTile: (gridX: number, gridZ: number) => void;
  onSelectEditItem: (item: EditableItemRef) => void;
  onMoveEditItemToTile: (gridX: number, gridZ: number) => void;
  onOpenCircusTent?: (decorId: string) => void;
  onCollectForage?: (forageId: string) => void;
  onVisitorTip?: (coins: number) => void;
}

interface RoamingVisitor {
  group: THREE.Group;
  target: THREE.Vector3;
  pauseTimer: number;
  speed: number;
  tipTimer: number;
  phase: number;
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
  private cartoonSky: CartoonSkySystem;
  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private rimLight: THREE.DirectionalLight;
  private animalRigs = new Map<string, AnimatedAnimalRig>();
  private builtCrops = new Map<string, BuiltCrop>();
  private emotionSprites: Array<{ sprite: THREE.Sprite; baseY: number; phase: number }> = [];
  private pickables: THREE.Object3D[] = [];
  private decorPickables: THREE.Object3D[] = [];
  private circusPickables: THREE.Object3D[] = [];
  private animatedDecorProps: Array<{
    obj: THREE.Object3D;
    kind: 'spin_z' | 'flicker' | 'wave';
    phase: number;
  }> = [];

  // Daily 3D Hide-and-Seek Foraging Golden Acorns
  private foragingGroup = new THREE.Group();
  private foragingPickables: THREE.Object3D[] = [];
  private foragingItems: Array<{ built: BuiltForagingAcorn; baseY: number; phase: number }> = [];

  // Roaming NPC visitors & night/sunset fireflies
  private visitorGroup = new THREE.Group();
  private visitors: RoamingVisitor[] = [];
  private visitorWaypoints: THREE.Vector3[] = [];
  private fireflies: THREE.Points | null = null;
  private fireflyBasePositions: Float32Array | null = null;

  private currentState: SanctuaryState | null = null;
  private currentGridSize = DEFAULT_GRID_SIZE;
  private currentTheme: EnvironmentThemeId = 'meadow';
  private currentTimeOfDay: TimeOfDayId = 'day';
  private placementChoice: PlacementChoice | null = null;
  private editMode = false;
  private movingItem: EditableItemRef | null = null;
  private isTitlePan = true;
  private photoMode = false;
  private photoOrbit = false;

  // Placement / Edit hover ghost & selected highlight ring
  private hoverTileMesh: THREE.Mesh;
  private selectedEditRing: THREE.Mesh;
  private hoverGrid: { gx: number; gz: number } | null = null;

  // Camera smooth focus transition & top-down build view memory
  private cameraGoalPos: THREE.Vector3 | null = null;
  private cameraGoalTarget: THREE.Vector3 | null = null;
  private isTopDownBuildView = false;
  private savedIsoCamPos: THREE.Vector3 | null = null;
  private savedIsoCamTarget: THREE.Vector3 | null = null;

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

    // Scene with warm sunlit cerulean sky & soft matched horizon fog
    this.scene = new THREE.Scene();
    const skyColor = new THREE.Color(0xcceeff);
    this.scene.background = skyColor;
    this.scene.fog = new THREE.FogExp2(0xd6f0ff, 0.0095);

    // Mandatory studio IBL environment map
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // Cozy isometric-style narrow-FOV PerspectiveCamera (near=1.5 for crisp depth precision)
    this.camera = new THREE.PerspectiveCamera(30, width / height, 1.5, 340);
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
    this.setTouchDragMode('pan');
    this.applyResponsiveControlSpeeds();
    this.controls.addEventListener('start', () => {
      // Cancel scripted camera glide immediately when user drags
      this.cameraGoalPos = null;
      this.cameraGoalTarget = null;
    });

    // Warm Storybook 3-Point Cartoon Lighting Rig (Key + Sky/Meadow Hemi + Rim Glow)
    const hemi = new THREE.HemisphereLight(0xaee6ff, 0x7cb058, 1.05);
    hemi.position.set(0, 40, 0);
    this.hemiLight = hemi;
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff2d6, 1.95);
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

    const rim = new THREE.DirectionalLight(0xffe9c2, 0.72);
    rim.position.set(-24, 18, -22);
    this.rimLight = rim;
    this.scene.add(rim);

    // Painted Gradient Cartoon Sky Dome + Drifting Fluffy 3D Clouds
    this.cartoonSky = buildCartoonSkyAndClouds();
    this.scene.add(this.cartoonSky.group);

    // Procedural textures & lush surrounding meadow world
    this.textures = createProceduralTextures(this.renderer.capabilities.getMaxAnisotropy());
    const world = buildSurroundingWorld(this.textures, this.currentGridSize);
    this.worldGroup = world;
    this.scene.add(world);
    this.scene.add(this.dynamicGroup);
    this.scene.add(this.foragingGroup);
    this.scene.add(this.visitorGroup);

    // Procedural Theme-Matched Weather System
    this.weatherSystem = new SanctuaryWeatherSystem();
    this.scene.add(this.weatherSystem.group);

    // Sunset / Night Glowing Fireflies
    const ffCount = 48;
    const ffPos = new Float32Array(ffCount * 3);
    for (let i = 0; i < ffCount; i++) {
      ffPos[i * 3] = (Math.random() - 0.5) * 32;
      ffPos[i * 3 + 1] = 0.7 + Math.random() * 2.8;
      ffPos[i * 3 + 2] = (Math.random() - 0.5) * 32;
    }
    this.fireflyBasePositions = new Float32Array(ffPos);
    const ffGeo = new THREE.BufferGeometry();
    ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3));
    const ffMat = new THREE.PointsMaterial({
      color: 0xffe478,
      size: 0.28,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    this.fireflies = new THREE.Points(ffGeo, ffMat);
    this.fireflies.visible = false;
    this.scene.add(this.fireflies);

    // Placement / Edit hover indicator plane
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

    // Golden highlight ring around the item selected in Edit Mode
    this.selectedEditRing = new THREE.Mesh(
      new THREE.RingGeometry(0.86, 1.05, 28),
      new THREE.MeshBasicMaterial({
        color: 0xf09d2c,
        transparent: true,
        opacity: 0.92,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.selectedEditRing.rotation.x = -Math.PI / 2;
    this.selectedEditRing.position.y = 0.16;
    this.selectedEditRing.visible = false;
    this.scene.add(this.selectedEditRing);

    // Pre-allocate pooled cheerful cartoon sparkle puff particles
    const pGeo = new THREE.SphereGeometry(0.14, 10, 8);
    for (let i = 0; i < 36; i++) {
      const m = new THREE.Mesh(
        pGeo,
        new THREE.MeshBasicMaterial({
          color: 0xffe066,
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

  public setTouchDragMode(mode: TouchDragMode): void {
    this.controls.touches = {
      ONE: mode === 'pan' ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };
  }

  private applyResponsiveControlSpeeds(): void {
    const isMobileView =
      typeof window !== 'undefined' &&
      (window.innerWidth <= 768 ||
        (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches));
    const speed = isMobileView ? 0.75 : 1.0;
    this.controls.rotateSpeed = speed;
    this.controls.zoomSpeed = speed;
    this.controls.panSpeed = isMobileView ? 1.15 : 1.0;
  }

  private syncBuildCameraMode(): void {
    const shouldBeTopDown = Boolean(this.placementChoice) || this.editMode;
    if (shouldBeTopDown && !this.isTopDownBuildView) {
      this.savedIsoCamPos = this.camera.position.clone();
      this.savedIsoCamTarget = this.controls.target.clone();
      this.isTopDownBuildView = true;
      this.controls.minPolarAngle = 0.02;
      const topHeight = this.currentGridSize >= 24 ? 62 : this.currentGridSize >= 18 ? 48 : 34;
      const tx = this.controls.target.x;
      const tz = this.controls.target.z;
      this.cameraGoalTarget = new THREE.Vector3(tx, 0, tz);
      this.cameraGoalPos = new THREE.Vector3(tx, topHeight, tz + 1.4);
    } else if (!shouldBeTopDown && this.isTopDownBuildView) {
      this.isTopDownBuildView = false;
      this.controls.minPolarAngle = Math.PI * 0.17;
      if (this.savedIsoCamPos && this.savedIsoCamTarget) {
        this.cameraGoalPos = this.savedIsoCamPos.clone();
        this.cameraGoalTarget = this.savedIsoCamTarget.clone();
        this.savedIsoCamPos = null;
        this.savedIsoCamTarget = null;
      }
    }
  }

  private getPlacementFootprint(choice: PlacementChoice): 1 | 2 {
    if (choice.kind === 'enclosure') return 2;
    if (choice.kind === 'storage') return choice.footprint;
    if (choice.kind === 'decor') return getDecorFootprint(choice.decorType);
    return 1;
  }

  private getMovingItemFootprint(item: EditableItemRef | null): 1 | 2 {
    if (!item) return 1;
    if (item.kind === 'enclosure') return 2;
    if (item.kind === 'decor' && this.currentState) {
      const dec = this.currentState.decorations.find((d) => d.id === item.id);
      if (dec) return getDecorFootprint(dec.decorType);
    }
    return 1;
  }

  public setPlacementChoice(choice: PlacementChoice | null): void {
    this.placementChoice = choice;
    if (!choice) {
      if (!(this.editMode && this.movingItem)) {
        this.hoverTileMesh.visible = false;
        this.hoverGrid = null;
      }
    } else {
      const span = this.getPlacementFootprint(choice);
      this.hoverTileMesh.scale.set(span, span, 1);
    }
    this.syncBuildCameraMode();
  }

  public setEditState(editMode: boolean, movingItem: EditableItemRef | null): void {
    this.editMode = editMode;
    this.movingItem = movingItem;
    if (editMode && movingItem) {
      const span = this.getMovingItemFootprint(movingItem);
      this.hoverTileMesh.scale.set(span, span, 1);
      this.updateSelectedEditRing();
    } else {
      this.selectedEditRing.visible = false;
      if (!this.placementChoice) {
        this.hoverTileMesh.visible = false;
        this.hoverGrid = null;
      }
    }
    this.syncBuildCameraMode();
  }

  private updateSelectedEditRing(): void {
    if (!this.editMode || !this.movingItem || !this.currentState) {
      this.selectedEditRing.visible = false;
      return;
    }
    const ref = this.movingItem;
    let pos: THREE.Vector3 | null = null;
    let ringScale = 1;
    if (ref.kind === 'enclosure') {
      const enc = this.currentState.enclosures.find((e) => e.id === ref.id);
      if (enc) {
        pos = gridToWorld(enc.gridX, enc.gridZ, 2, this.currentGridSize);
        ringScale = 2.05;
      }
    } else if (ref.kind === 'crop') {
      const crop = this.currentState.crops.find((c) => c.id === ref.id);
      if (crop) {
        pos = gridToWorld(crop.gridX, crop.gridZ, 1, this.currentGridSize);
        ringScale = 1.08;
      }
    } else if (ref.kind === 'decor') {
      const dec = this.currentState.decorations.find((d) => d.id === ref.id);
      if (dec) {
        const fp = getDecorFootprint(dec.decorType);
        pos = gridToWorld(dec.gridX, dec.gridZ, fp, this.currentGridSize);
        ringScale = fp === 2 ? 2.05 : 1.08;
      }
    }
    if (pos) {
      this.selectedEditRing.position.set(pos.x, 0.16, pos.z);
      this.selectedEditRing.scale.set(ringScale, ringScale, 1);
      this.selectedEditRing.visible = true;
    } else {
      this.selectedEditRing.visible = false;
    }
  }

  private rebuildWorldForGridSize(nextGridSize: number): void {
    this.currentGridSize = nextGridSize;
    if (this.worldGroup) {
      this.worldGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
          if (obj.geometry && !obj.geometry.userData?.shared) {
            obj.geometry.dispose();
          }
          const mat = obj.material;
          if (Array.isArray(mat)) {
            mat.forEach((m) => {
              if (!m.userData?.shared) m.dispose();
            });
          } else if (mat && !mat.userData?.shared) {
            mat.dispose();
          }
        }
      });
      this.scene.remove(this.worldGroup);
    }

    const nextWorld = buildSurroundingWorld(this.textures, nextGridSize);
    this.worldGroup = nextWorld;
    this.scene.add(nextWorld);

    const halfBoard = (nextGridSize * TILE_SIZE) / 2;
    const shadowBound = halfBoard + 10;
    this.sunLight.shadow.camera.left = -shadowBound;
    this.sunLight.shadow.camera.right = shadowBound;
    this.sunLight.shadow.camera.top = shadowBound;
    this.sunLight.shadow.camera.bottom = -shadowBound;
    this.sunLight.shadow.camera.far = 110;
    this.sunLight.shadow.camera.updateProjectionMatrix();

    this.controls.maxDistance = nextGridSize >= 24 ? 88 : nextGridSize >= 18 ? 70 : 54;
    this.setTerrainTheme(this.currentTheme);
  }

  public setTerrainTheme(theme: EnvironmentThemeId): void {
    this.currentTheme = theme;
    if (!this.worldGroup) return;
    const groundMat = this.worldGroup.userData.groundMat as THREE.MeshToonMaterial | undefined;
    const lawnMat = this.worldGroup.userData.lawnMat as THREE.MeshToonMaterial | undefined;
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
        hemiGround: number;
        rimColor: number;
        skyPalette: SkyPaletteConfig;
      }
    > = {
      meadow: {
        ground: 0xffffff,
        lawn: 0xf4ffe0,
        sky: 0xd6f0ff,
        fogDensity: 0.0092,
        sunColor: 0xfff2d6,
        sunIntensity: 1.95,
        hemiSky: 0xaee6ff,
        hemiGround: 0x7cb058,
        rimColor: 0xffe9c2,
        skyPalette: {
          topColor: 0x67c2f5,
          horizonColor: 0xdef5ff,
          bottomColor: 0xc5e8c8,
          sunGlowColor: 0xfff6cf,
          cloudColor: 0xffffff,
          cloudShadowColor: 0xe3f2fc,
          starOpacity: 0,
        },
      },
      autumn: {
        ground: 0xf2cf9b,
        lawn: 0xffd9a0,
        sky: 0xf7e0c3,
        fogDensity: 0.0102,
        sunColor: 0xffdca8,
        sunIntensity: 1.9,
        hemiSky: 0xfad7b0,
        hemiGround: 0xa67c46,
        rimColor: 0xffc88a,
        skyPalette: {
          topColor: 0x8dbde8,
          horizonColor: 0xfce1bd,
          bottomColor: 0xedd0a6,
          sunGlowColor: 0xffe6a8,
          cloudColor: 0xfff8eb,
          cloudShadowColor: 0xf0d8bd,
          starOpacity: 0,
        },
      },
      alpine: {
        ground: 0xd2ebdf,
        lawn: 0xd9f2e6,
        sky: 0xd5ecfa,
        fogDensity: 0.0105,
        sunColor: 0xf2f8ff,
        sunIntensity: 1.85,
        hemiSky: 0xc0e4fa,
        hemiGround: 0x7aa38a,
        rimColor: 0xd9ecff,
        skyPalette: {
          topColor: 0x6baee0,
          horizonColor: 0xe0f2ff,
          bottomColor: 0xcce3e8,
          sunGlowColor: 0xfffdf0,
          cloudColor: 0xffffff,
          cloudShadowColor: 0xdbeaf5,
          starOpacity: 0,
        },
      },
      clover: {
        ground: 0xd8f2d3,
        lawn: 0xd4f5d2,
        sky: 0xc4ddeb,
        fogDensity: 0.0115,
        sunColor: 0xe3f0fa,
        sunIntensity: 1.65,
        hemiSky: 0xadd2e6,
        hemiGround: 0x6b9c6e,
        rimColor: 0xd1ecff,
        skyPalette: {
          topColor: 0x7aa8c9,
          horizonColor: 0xd1e6f0,
          bottomColor: 0xbdd9c8,
          sunGlowColor: 0xebf6ff,
          cloudColor: 0xf5f9fc,
          cloudShadowColor: 0xd2e1eb,
          starOpacity: 0,
        },
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
    this.hemiLight.groundColor.setHex(cfg.hemiGround);
    this.rimLight.color.setHex(cfg.rimColor);
    this.rimLight.intensity = 0.72;
    this.cartoonSky.setPalette(cfg.skyPalette);
    this.weatherSystem.setTheme(theme);
    this.applyTimeOfDayLighting();
  }

  public setTimeOfDay(tod: TimeOfDayId): void {
    this.currentTimeOfDay = tod;
    if (tod === 'day') {
      // Restore active terrain theme's crisp daytime sky & lighting
      this.setTerrainTheme(this.currentTheme);
      return;
    }
    this.applyTimeOfDayLighting();
  }

  private applyTimeOfDayLighting(): void {
    const tod = this.currentTimeOfDay;
    if (tod === 'day') {
      this.sunLight.position.set(24, 34, 18);
      this.renderer.toneMappingExposure = 1.06;
      this.hemiLight.intensity = 1.05;
      this.rimLight.intensity = 0.72;
      if (this.fireflies) this.fireflies.visible = false;
    } else if (tod === 'sunset') {
      this.scene.background = new THREE.Color(0xf7b98b);
      this.scene.fog = new THREE.FogExp2(0xf2b082, 0.0112);
      this.sunLight.color.setHex(0xff9f59);
      this.sunLight.intensity = 1.85;
      this.sunLight.position.set(-28, 15, 22);
      this.hemiLight.color.setHex(0xffc396);
      this.hemiLight.groundColor.setHex(0x8c5e47);
      this.hemiLight.intensity = 0.88;
      this.rimLight.color.setHex(0xffa6d1);
      this.rimLight.intensity = 0.85;
      this.renderer.toneMappingExposure = 1.04;
      this.cartoonSky.setPalette({
        topColor: 0x7c6cb5,
        horizonColor: 0xffb782,
        bottomColor: 0xf59d7a,
        sunGlowColor: 0xffe28a,
        cloudColor: 0xffe3c7,
        cloudShadowColor: 0xd98fa6,
        starOpacity: 0.18,
      });
      if (this.fireflies) this.fireflies.visible = true;
    } else {
      // Cozy moonlit storybook night with glowing lanterns, twinkling stars & lavender rim glow
      this.scene.background = new THREE.Color(0x1f304d);
      this.scene.fog = new THREE.FogExp2(0x1f304d, 0.013);
      this.sunLight.color.setHex(0x9ec8ff);
      this.sunLight.intensity = 0.96;
      this.sunLight.position.set(-18, 28, -16);
      this.hemiLight.color.setHex(0x5c80b8);
      this.hemiLight.groundColor.setHex(0x2d4057);
      this.hemiLight.intensity = 0.76;
      this.rimLight.color.setHex(0xb8c8ff);
      this.rimLight.intensity = 0.82;
      this.renderer.toneMappingExposure = 0.98;
      this.cartoonSky.setPalette({
        topColor: 0x101c36,
        horizonColor: 0x294169,
        bottomColor: 0x1d304d,
        sunGlowColor: 0xc2dfff,
        cloudColor: 0x45608a,
        cloudShadowColor: 0x273b5c,
        starOpacity: 0.92,
      });
      if (this.fireflies) this.fireflies.visible = true;
    }
  }

  public setPhotoMode(active: boolean): void {
    this.photoMode = active;
    if (!active) {
      this.photoOrbit = false;
      this.controls.minPolarAngle = this.isTopDownBuildView ? 0.02 : Math.PI * 0.17;
    }
    this.emotionSprites.forEach((es) => {
      es.sprite.visible = !active;
    });
    if (active) {
      this.hoverTileMesh.visible = false;
      this.selectedEditRing.visible = false;
    }
  }

  public setPhotoPreset(preset: PhotoCameraPreset): void {
    const scale = this.currentGridSize >= 24 ? 1.45 : this.currentGridSize >= 18 ? 1.2 : 1.0;
    this.photoOrbit = preset === 'orbit';
    if (preset === 'iso') {
      this.controls.minPolarAngle = Math.PI * 0.17;
      this.cameraGoalTarget = new THREE.Vector3(0, 0.4, 0);
      this.cameraGoalPos = new THREE.Vector3(24 * scale, 21 * scale, 24 * scale);
    } else if (preset === 'scenic') {
      this.controls.minPolarAngle = Math.PI * 0.15;
      this.cameraGoalTarget = new THREE.Vector3(0, 0.9, 0);
      this.cameraGoalPos = new THREE.Vector3(18 * scale, 9.5 * scale, 22 * scale);
    } else if (preset === 'top') {
      this.controls.minPolarAngle = 0.02;
      this.cameraGoalTarget = new THREE.Vector3(0, 0, 0);
      this.cameraGoalPos = new THREE.Vector3(0, 36 * scale, 1.5);
    }
  }

  public setWeatherEnabled(enabled: boolean): void {
    this.weatherSystem.setEnabled(enabled);
  }

  public syncSanctuary(state: SanctuaryState): void {
    this.currentState = state;
    const nextGridSize = state.gridSize === 24 ? 24 : state.gridSize === 18 ? 18 : DEFAULT_GRID_SIZE;
    if (nextGridSize !== this.currentGridSize) {
      this.rebuildWorldForGridSize(nextGridSize);
    }

    // Clear previous dynamic children cleanly
    while (this.dynamicGroup.children.length > 0) {
      const child = this.dynamicGroup.children[0];
      this.dynamicGroup.remove(child);
    }
    this.animalRigs.clear();
    this.builtCrops.clear();
    this.emotionSprites = [];
    this.pickables = [];
    this.decorPickables = [];
    this.circusPickables = [];
    this.animatedDecorProps = [];

    // 1. Build Enclosures
    let encIdx = 0;
    for (const enc of state.enclosures) {
      const built = buildEnclosureModel(enc, this.textures, this.isSoftwareGl, this.currentGridSize);
      this.dynamicGroup.add(built.group);
      this.animalRigs.set(enc.id, built.animalRig);
      this.pickables.push(built.hitProxy);
      if (built.emotionSprite) {
        built.emotionSprite.visible = !this.photoMode;
        this.emotionSprites.push({
          sprite: built.emotionSprite,
          baseY: built.emotionSprite.position.y,
          phase: encIdx * 1.15,
        });
      }
      encIdx += 1;
    }

    // 2. Build Crop Plots
    for (const crop of state.crops) {
      const built = buildCropModel(crop, this.textures, this.currentGridSize);
      this.dynamicGroup.add(built.group);
      this.builtCrops.set(crop.id, built);
      this.pickables.push(built.hitProxy);
    }

    // 3. Build Habitat Decorations & Structures
    let decIdx = 0;
    for (const dec of state.decorations) {
      const built = buildDecorationModel(
        dec.id,
        dec.decorType,
        dec.gridX,
        dec.gridZ,
        dec.rotation,
        this.textures,
        this.currentGridSize,
      );
      this.dynamicGroup.add(built.group);
      this.decorPickables.push(built.hitProxy);
      if (dec.decorType === 'circus_tent') {
        this.circusPickables.push(built.hitProxy);
      }
      if (built.animatedProp) {
        this.animatedDecorProps.push({
          obj: built.animatedProp.obj,
          kind: built.animatedProp.kind,
          phase: decIdx * 1.4,
        });
      }
      decIdx += 1;
    }

    // 4. Refresh Daily 3D Hide-and-Seek Foraging Golden Acorns
    this.rebuildDailyForaging(state);

    // 5. Refresh Roaming Visitor Waypoints (prefer paths, gazebos, structures & enclosure fronts)
    this.rebuildVisitorWaypoints(state);
    this.updateSelectedEditRing();
  }

  private rebuildDailyForaging(state: SanctuaryState): void {
    while (this.foragingGroup.children.length > 0) {
      this.foragingGroup.remove(this.foragingGroup.children[0]);
    }
    this.foragingPickables = [];
    this.foragingItems = [];

    const today = todayDateString();
    const foundSet = new Set(
      state.dailyForaging && state.dailyForaging.date === today
        ? state.dailyForaging.foundIds
        : [],
    );

    // Deterministic daily hiding spots tucked playfully around the meadow border & woodland trees
    let seed = 0;
    for (let i = 0; i < today.length; i++) {
      seed = (seed * 37 + today.charCodeAt(i)) % 9973;
    }

    const halfBoard = (this.currentGridSize * TILE_SIZE) / 2;
    const spots: Array<[number, number]> = [
      [-(halfBoard + 2.2), -(halfBoard * 0.55) + ((seed % 7) - 3) * 0.9],
      [halfBoard + 2.3, -(halfBoard * 0.2) + (((seed >> 2) % 7) - 3) * 1.1],
      [((seed >> 4) % 9 - 4) * 1.6, halfBoard + 2.1],
      [-(halfBoard * 0.6) + ((seed % 5) - 2) * 1.0, -(halfBoard + 2.2)],
      [halfBoard * 0.55, halfBoard + 2.2],
      [-(halfBoard + 2.4), halfBoard * 0.55],
    ];

    const startIdx = seed % 3;
    for (let i = 0; i < 3; i++) {
      const forageId = `forage-${i}`;
      if (foundSet.has(forageId)) continue;
      const [fx, fz] = spots[(startIdx + i * 2) % spots.length];
      const built = buildForagingAcornMesh(forageId, this.textures);
      built.group.position.set(fx, -0.1, fz);
      this.foragingGroup.add(built.group);
      this.foragingPickables.push(built.hitProxy);
      this.foragingItems.push({ built, baseY: 0.52, phase: i * 2.1 });
    }
  }

  public focusNextForageAcorn(): boolean {
    if (this.foragingItems.length === 0) return false;
    const next = this.foragingItems[0];
    const p = next.built.group.position;
    this.cameraGoalTarget = new THREE.Vector3(p.x * 0.85, 0.5, p.z * 0.85);
    this.cameraGoalPos = new THREE.Vector3(p.x + 12, 13.5, p.z + 12);
    return true;
  }

  private rebuildVisitorWaypoints(state: SanctuaryState): void {
    const pts: THREE.Vector3[] = [];
    for (const dec of state.decorations) {
      if (
        dec.decorType === 'cobble_path' ||
        dec.decorType === 'gazebo' ||
        dec.decorType === 'fountain' ||
        dec.decorType === 'keeper_cottage' ||
        dec.decorType === 'windmill' ||
        dec.decorType === 'greenhouse' ||
        dec.decorType === 'wishing_well' ||
        dec.decorType === 'campfire_lounge' ||
        dec.decorType === 'circus_tent'
      ) {
        const fp = getDecorFootprint(dec.decorType);
        const pt = gridToWorld(dec.gridX, dec.gridZ, fp, this.currentGridSize);
        if (dec.decorType === 'circus_tent') {
          pt.z += TILE_SIZE * 1.15;
        }
        pts.push(pt);
      }
    }
    for (const enc of state.enclosures) {
      const p = gridToWorld(enc.gridX, enc.gridZ, 2, this.currentGridSize);
      p.z += TILE_SIZE * 1.15;
      pts.push(p);
    }
    if (pts.length < 2) {
      pts.push(new THREE.Vector3(-4, 0, 4), new THREE.Vector3(4, 0, 4), new THREE.Vector3(0, 0, -4));
    }
    this.visitorWaypoints = pts;

    const desiredCount = Math.min(4, Math.max(2, Math.floor(state.enclosures.length / 2) + 1));
    while (this.visitors.length < desiredCount) {
      const idx = this.visitors.length;
      const mesh = buildNpcVisitorMesh(idx);
      const startPt = pts[idx % pts.length].clone();
      mesh.position.copy(startPt);
      this.visitorGroup.add(mesh);
      this.visitors.push({
        group: mesh,
        target: pts[(idx + 1) % pts.length].clone(),
        pauseTimer: 1 + idx * 1.3,
        speed: 1.45 + (idx % 3) * 0.2,
        tipTimer: 20 + idx * 9,
        phase: idx * 1.7,
      });
    }
    while (this.visitors.length > desiredCount) {
      const removed = this.visitors.pop();
      if (removed) this.visitorGroup.remove(removed.group);
    }
  }

  public focusEnclosure(enclosureId: string): void {
    if (!this.currentState) return;
    const enc = this.currentState.enclosures.find((e) => e.id === enclosureId);
    if (!enc) return;
    const target = gridToWorld(enc.gridX, enc.gridZ, 2, this.currentGridSize);
    target.y = 0.7;
    this.cameraGoalTarget = target;
    this.cameraGoalPos = new THREE.Vector3(target.x + 11.5, 10.5, target.z + 11.5);
  }

  public resetCamera(): void {
    if (this.isTopDownBuildView) {
      const topHeight = this.currentGridSize >= 24 ? 62 : this.currentGridSize >= 18 ? 48 : 34;
      this.cameraGoalTarget = new THREE.Vector3(0, 0, 0);
      this.cameraGoalPos = new THREE.Vector3(0, topHeight, 1.4);
      return;
    }
    const dist = this.currentGridSize >= 24 ? 36 : this.currentGridSize >= 18 ? 30 : 24;
    const elev = this.currentGridSize >= 24 ? 31 : this.currentGridSize >= 18 ? 26 : 21;
    this.cameraGoalTarget = new THREE.Vector3(0, 0.4, 0);
    this.cameraGoalPos = new THREE.Vector3(dist, elev, dist);
  }

  public triggerCelebrationAtEnclosure(enclosureId: string, colorHex = 0xffd559): void {
    const rig = this.animalRigs.get(enclosureId);
    if (rig) {
      rig.happyTimer = 2.2;
    }
    const enc = this.currentState?.enclosures.find((e) => e.id === enclosureId);
    if (enc) {
      const pos = gridToWorld(enc.gridX, enc.gridZ, 2, this.currentGridSize);
      pos.y = 1.25;
      this.spawnBurst(pos, colorHex, 14);
    }
  }

  public triggerBurstAtGrid(gx: number, gz: number, footprint: 1 | 2 = 1, colorHex = 0x62d980): void {
    const pos = gridToWorld(gx, gz, footprint, this.currentGridSize);
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
      const m = p.mesh.material as THREE.MeshBasicMaterial;
      m.color.setHex(colorHex);
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
    this.applyResponsiveControlSpeeds();
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
    const halfBoard = (this.currentGridSize * TILE_SIZE) / 2;
    const gx = Math.floor((_rayPoint.x + halfBoard) / TILE_SIZE);
    const gz = Math.floor((_rayPoint.z + halfBoard) / TILE_SIZE);
    if (gx < 0 || gz < 0 || gx >= this.currentGridSize || gz >= this.currentGridSize) return null;
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

    if ((this.placementChoice || (this.editMode && this.movingItem)) && this.currentState) {
      const tile = this.raycastGroundTile();
      if (!tile) {
        this.hoverTileMesh.visible = false;
        this.hoverGrid = null;
        return;
      }
      const fp: 1 | 2 = this.placementChoice
        ? this.getPlacementFootprint(this.placementChoice)
        : this.getMovingItemFootprint(this.movingItem);
      const clampedX = Math.min(this.currentGridSize - fp, tile.gx);
      const clampedZ = Math.min(this.currentGridSize - fp, tile.gz);
      this.hoverGrid = { gx: clampedX, gz: clampedZ };
      const worldPos = gridToWorld(clampedX, clampedZ, fp, this.currentGridSize);
      this.hoverTileMesh.position.set(worldPos.x, 0.1, worldPos.z);
      const blocked = isCellOccupied(
        this.currentState,
        clampedX,
        clampedZ,
        fp,
        this.placementChoice ? null : this.movingItem,
      );
      (this.hoverTileMesh.material as THREE.MeshBasicMaterial).color.setHex(blocked ? 0xe05252 : 0x35c26b);
      this.hoverTileMesh.visible = true;
      this.renderer.domElement.style.cursor = blocked ? 'not-allowed' : 'pointer';
      return;
    }

    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const targets = this.editMode
      ? [...this.pickables, ...this.decorPickables]
      : [...this.pickables, ...this.circusPickables, ...this.foragingPickables];
    const hits = this.raycaster.intersectObjects(targets, false);
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
        const fp = this.getPlacementFootprint(this.placementChoice);
        this.callbacks.onPlaceAtTile(
          Math.min(this.currentGridSize - fp, tile.gx),
          Math.min(this.currentGridSize - fp, tile.gz),
        );
      }
      return;
    }

    if (this.editMode && this.movingItem) {
      const tile = this.hoverGrid || this.raycastGroundTile();
      if (tile) {
        const fp = this.getMovingItemFootprint(this.movingItem);
        this.callbacks.onMoveEditItemToTile(
          Math.min(this.currentGridSize - fp, tile.gx),
          Math.min(this.currentGridSize - fp, tile.gz),
        );
      }
      return;
    }

    if (this.editMode) {
      this.raycaster.setFromCamera(this.pointerNdc, this.camera);
      const hits = this.raycaster.intersectObjects([...this.pickables, ...this.decorPickables], false);
      if (hits.length > 0) {
        const ud = hits[0].object.userData;
        if (
          (ud.kind === 'enclosure' || ud.kind === 'crop' || ud.kind === 'decor') &&
          typeof ud.id === 'string'
        ) {
          this.callbacks.onSelectEditItem({ kind: ud.kind, id: ud.id });
        }
      }
      return;
    }

    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const hits = this.raycaster.intersectObjects(
      [...this.foragingPickables, ...this.circusPickables, ...this.pickables],
      false,
    );
    if (hits.length > 0) {
      const ud = hits[0].object.userData;
      if (ud.kind === 'forage' && typeof ud.id === 'string') {
        const worldPos = new THREE.Vector3();
        hits[0].object.getWorldPosition(worldPos);
        this.spawnBurst(worldPos, 0xffd559, 14);
        this.callbacks.onCollectForage?.(ud.id);
      } else if (ud.kind === 'decor' && ud.decorType === 'circus_tent' && typeof ud.id === 'string') {
        this.callbacks.onOpenCircusTent?.(ud.id);
      } else if (ud.kind === 'enclosure' && typeof ud.id === 'string') {
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

    // 1. Title screen or Photo Mode scenic turntable orbit
    if (this.isTitlePan || this.photoOrbit) {
      const radius = this.photoOrbit ? (this.currentGridSize >= 24 ? 36 : 26) : 29;
      const angle = elapsed * (this.photoOrbit ? 0.22 : 0.14) + 0.72;
      this.camera.position.set(Math.cos(angle) * radius, this.photoOrbit ? 16.5 : 21.5, Math.sin(angle) * radius);
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
      const panLimit = (this.currentGridSize * TILE_SIZE) / 2;
      this.controls.target.x = THREE.MathUtils.clamp(this.controls.target.x, -panLimit, panLimit);
      this.controls.target.z = THREE.MathUtils.clamp(this.controls.target.z, -panLimit, panLimit);

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

    // 2. Animate Animals & Floating Emotion Speech Bubbles
    this.animalRigs.forEach((rig) => animateAnimalRig(rig, elapsed, dt));
    for (const es of this.emotionSprites) {
      if (es.sprite.visible) {
        es.sprite.position.y = es.baseY + Math.sin(elapsed * 2.4 + es.phase) * 0.11;
      }
    }

    // 3. Animate Crop Growth (10:00 normal / 5:00 fertilized) & Ready-to-Harvest Beacon
    const nowMs = Date.now();
    this.builtCrops.forEach((bc) => {
      const dur = bc.crop.growDurationMs || CROP_GROW_DURATION_MS;
      const progress = Math.min(1, Math.max(0.18, (nowMs - bc.crop.plantedAt) / dur));
      const isReady = progress >= 0.999;
      const bounce = isReady ? 1 + Math.sin(elapsed * 4.5 + bc.crop.gridX) * 0.05 : progress;
      bc.plantGroup.scale.set(progress, bounce, progress);
      bc.readyRing.visible = isReady;
      if (isReady) {
        bc.readyRing.rotation.z = elapsed * 0.9;
      }
    });

    if (this.selectedEditRing.visible) {
      this.selectedEditRing.rotation.z = elapsed * 1.1;
    }

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

    // 6. Roaming NPC Visitors strolling & dropping occasional Coin tips
    if (this.visitorWaypoints.length >= 2) {
      for (const v of this.visitors) {
        if (v.pauseTimer > 0) {
          v.pauseTimer -= dt;
          v.group.position.y = Math.abs(Math.sin(elapsed * 2 + v.phase)) * 0.03;
        } else {
          const dx = v.target.x - v.group.position.x;
          const dz = v.target.z - v.group.position.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 0.25) {
            v.pauseTimer = 2.2 + Math.random() * 2.6;
            const nextPt = this.visitorWaypoints[Math.floor(Math.random() * this.visitorWaypoints.length)];
            v.target.copy(nextPt);
          } else {
            const step = Math.min(dist, v.speed * dt);
            v.group.position.x += (dx / dist) * step;
            v.group.position.z += (dz / dist) * step;
            v.group.position.y = Math.abs(Math.sin(elapsed * 7.5 + v.phase)) * 0.08;
            v.group.rotation.y = Math.atan2(dx, dz);
          }
        }
        if (!this.isTitlePan && this.callbacks.onVisitorTip) {
          v.tipTimer -= dt;
          if (v.tipTimer <= 0) {
            v.tipTimer = 32 + Math.random() * 24;
            const tipCoins = 6 + Math.floor(Math.random() * 10);
            this.spawnBurst(new THREE.Vector3(v.group.position.x, 1.1, v.group.position.z), 0xffd559, 6);
            this.callbacks.onVisitorTip(tipCoins);
          }
        }
      }
    }

    // 7. Gentle Sunset/Night Fireflies
    if (this.fireflies && this.fireflies.visible && this.fireflyBasePositions) {
      const posAttr = this.fireflies.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < posAttr.count; i++) {
        const bx = this.fireflyBasePositions[i * 3];
        const by = this.fireflyBasePositions[i * 3 + 1];
        const bz = this.fireflyBasePositions[i * 3 + 2];
        posAttr.setXYZ(
          i,
          bx + Math.sin(elapsed * 0.7 + i * 1.3) * 0.85,
          by + Math.sin(elapsed * 1.4 + i * 0.9) * 0.45,
          bz + Math.cos(elapsed * 0.65 + i * 1.1) * 0.85,
        );
      }
      posAttr.needsUpdate = true;
    }

    // 8. Update Weather, Drifting Cartoon Clouds, Swaying Grass & Animated Structures
    this.weatherSystem.update(dt, elapsed);
    this.cartoonSky.update(elapsed, dt);
    const swayUniforms = this.worldGroup?.userData.swayUniforms as
      | { uTime: { value: number } }
      | undefined;
    if (swayUniforms) {
      swayUniforms.uTime.value = elapsed;
    }
    for (const prop of this.animatedDecorProps) {
      if (prop.kind === 'spin_z') {
        prop.obj.rotation.z = -elapsed * 0.95 + prop.phase;
      } else if (prop.kind === 'flicker') {
        const s = 1 + Math.sin(elapsed * 9.5 + prop.phase) * 0.12 + Math.cos(elapsed * 15 + prop.phase) * 0.06;
        prop.obj.scale.set(0.95 + (s - 1) * 0.4, s, 0.95 + (s - 1) * 0.4);
      } else if (prop.kind === 'wave') {
        prop.obj.rotation.y = Math.sin(elapsed * 3.5 + prop.phase) * 0.34;
        prop.obj.rotation.z = Math.cos(elapsed * 2.3 + prop.phase) * 0.08;
      }
    }

    // 9. Animate Daily Hide-and-Seek Golden Foraging Acorns
    for (const item of this.foragingItems) {
      item.built.acornBody.position.y = item.baseY + Math.sin(elapsed * 2.8 + item.phase) * 0.14;
      item.built.acornBody.rotation.y = elapsed * 1.45 + item.phase;
      const ringPulse = 1 + Math.sin(elapsed * 3.2 + item.phase) * 0.14;
      item.built.glowRing.scale.set(ringPulse, ringPulse, 1);
      item.built.glowRing.rotation.z = elapsed * 0.8 + item.phase;
    }

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
    this.cartoonSky.dispose();
    this.controls.dispose();
    this.textures.dispose();
    this.renderer.dispose();
    if (dom.parentNode) dom.parentNode.removeChild(dom);
  }
}
