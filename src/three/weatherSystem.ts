import * as THREE from 'three';

export type EnvironmentThemeId = 'meadow' | 'autumn' | 'alpine' | 'clover';

interface WeatherParticleData {
  x: number;
  y: number;
  z: number;
  speedY: number;
  driftX: number;
  driftZ: number;
  phase: number;
  spinSpeed: number;
  scale: number;
}

interface RainSplashData {
  x: number;
  z: number;
  life: number;
  maxLife: number;
}

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

const AREA_HALF = 18;
const MAX_HEIGHT = 17;

function createLeafGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.22);
  shape.quadraticCurveTo(0.18, -0.04, 0.14, 0.12);
  shape.quadraticCurveTo(0.06, 0.22, 0, 0.28);
  shape.quadraticCurveTo(-0.06, 0.22, -0.14, 0.12);
  shape.quadraticCurveTo(-0.18, -0.04, 0, -0.22);
  return new THREE.ShapeGeometry(shape, 4);
}

function seedParticles(count: number, minSpeedY: number, maxSpeedY: number): WeatherParticleData[] {
  const arr: WeatherParticleData[] = [];
  for (let i = 0; i < count; i++) {
    arr.push({
      x: (Math.random() - 0.5) * AREA_HALF * 2,
      y: Math.random() * MAX_HEIGHT,
      z: (Math.random() - 0.5) * AREA_HALF * 2,
      speedY: minSpeedY + Math.random() * (maxSpeedY - minSpeedY),
      driftX: (Math.random() - 0.5) * 1.4,
      driftZ: (Math.random() - 0.5) * 1.4,
      phase: Math.random() * Math.PI * 2,
      spinSpeed: 1.2 + Math.random() * 2.6,
      scale: 0.72 + Math.random() * 0.58,
    });
  }
  return arr;
}

export class SanctuaryWeatherSystem {
  public readonly group = new THREE.Group();

  private theme: EnvironmentThemeId = 'meadow';
  private enabled = true;

  // 1. Meadow: Sunlit golden pollen & floating blossom petals
  private pollenMesh: THREE.InstancedMesh;
  private pollenData: WeatherParticleData[];

  // 2. Autumn: Falling maple leaves
  private leafMesh: THREE.InstancedMesh;
  private leafData: WeatherParticleData[];

  // 3. Alpine: Soft mountain snowfall
  private snowMesh: THREE.InstancedMesh;
  private snowData: WeatherParticleData[];

  // 4. Clover: Gentle rain streaks + puddle splash rings
  private rainMesh: THREE.InstancedMesh;
  private rainData: WeatherParticleData[];
  private splashMesh: THREE.InstancedMesh;
  private splashData: RainSplashData[];

  constructor() {
    // --- Meadow Pollen / Petals ---
    const pollenCount = 110;
    const pollenGeo = new THREE.DodecahedronGeometry(0.085, 0);
    const pollenMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });
    this.pollenMesh = new THREE.InstancedMesh(pollenGeo, pollenMat, pollenCount);
    this.pollenMesh.frustumCulled = false;
    this.pollenData = seedParticles(pollenCount, 0.28, 0.72);
    const meadowColors = [0xfff0a6, 0xffe484, 0xffc6d3, 0xfaf7e8];
    for (let i = 0; i < pollenCount; i++) {
      _color.setHex(meadowColors[i % meadowColors.length]);
      this.pollenMesh.setColorAt(i, _color);
    }
    if (this.pollenMesh.instanceColor) this.pollenMesh.instanceColor.needsUpdate = true;
    this.group.add(this.pollenMesh);

    // --- Autumn Falling Maple Leaves ---
    const leafCount = 140;
    const leafGeo = createLeafGeometry();
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.78,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });
    this.leafMesh = new THREE.InstancedMesh(leafGeo, leafMat, leafCount);
    this.leafMesh.frustumCulled = false;
    this.leafData = seedParticles(leafCount, 1.15, 2.25);
    const autumnColors = [0xd64a28, 0xe87d24, 0xf0b236, 0xb83322, 0xc75e2b];
    for (let i = 0; i < leafCount; i++) {
      _color.setHex(autumnColors[i % autumnColors.length]);
      this.leafMesh.setColorAt(i, _color);
    }
    if (this.leafMesh.instanceColor) this.leafMesh.instanceColor.needsUpdate = true;
    this.group.add(this.leafMesh);

    // --- Alpine Soft Snowflakes ---
    const snowCount = 160;
    const snowGeo = new THREE.OctahedronGeometry(0.08, 0);
    const snowMat = new THREE.MeshBasicMaterial({
      color: 0xf4fbff,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    this.snowMesh = new THREE.InstancedMesh(snowGeo, snowMat, snowCount);
    this.snowMesh.frustumCulled = false;
    this.snowData = seedParticles(snowCount, 1.35, 2.55);
    this.group.add(this.snowMesh);

    // --- Clover Gentle Rain Streaks & Ground Splash Ripples ---
    const rainCount = 240;
    const rainGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.85, 4);
    const rainMat = new THREE.MeshBasicMaterial({
      color: 0xd4eefc,
      transparent: true,
      opacity: 0.56,
      depthWrite: false,
    });
    this.rainMesh = new THREE.InstancedMesh(rainGeo, rainMat, rainCount);
    this.rainMesh.frustumCulled = false;
    this.rainData = seedParticles(rainCount, 14.5, 20.5);
    this.group.add(this.rainMesh);

    const splashCount = 34;
    const splashGeo = new THREE.RingGeometry(0.12, 0.19, 14);
    splashGeo.rotateX(-Math.PI / 2);
    const splashMat = new THREE.MeshBasicMaterial({
      color: 0xe6f7ff,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.splashMesh = new THREE.InstancedMesh(splashGeo, splashMat, splashCount);
    this.splashMesh.frustumCulled = false;
    this.splashData = [];
    for (let i = 0; i < splashCount; i++) {
      this.splashData.push({
        x: (Math.random() - 0.5) * 26,
        z: (Math.random() - 0.5) * 26,
        life: Math.random() * 0.7,
        maxLife: 0.45 + Math.random() * 0.35,
      });
    }
    this.group.add(this.splashMesh);

    this.syncVisibility();
  }

  public setTheme(theme: EnvironmentThemeId): void {
    this.theme = theme;
    this.syncVisibility();
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.syncVisibility();
  }

  private syncVisibility(): void {
    this.pollenMesh.visible = this.enabled && this.theme === 'meadow';
    this.leafMesh.visible = this.enabled && this.theme === 'autumn';
    this.snowMesh.visible = this.enabled && this.theme === 'alpine';
    this.rainMesh.visible = this.enabled && this.theme === 'clover';
    this.splashMesh.visible = this.enabled && this.theme === 'clover';
  }

  public update(dt: number, elapsed: number): void {
    if (!this.enabled) return;

    if (this.theme === 'meadow') {
      for (let i = 0; i < this.pollenData.length; i++) {
        const p = this.pollenData[i];
        p.x += (Math.sin(elapsed * 0.65 + p.phase) * 0.65 + 0.35) * dt;
        p.y += Math.sin(elapsed * 0.9 + p.phase) * 0.35 * dt + p.speedY * 0.16 * dt;
        p.z += Math.cos(elapsed * 0.55 + p.phase) * 0.55 * dt;

        if (p.y > MAX_HEIGHT * 0.75) p.y = 0.6;
        if (p.x > AREA_HALF) p.x = -AREA_HALF;
        if (p.x < -AREA_HALF) p.x = AREA_HALF;
        if (p.z > AREA_HALF) p.z = -AREA_HALF;
        if (p.z < -AREA_HALF) p.z = AREA_HALF;

        const pulse = p.scale * (0.78 + 0.25 * Math.sin(elapsed * 2.2 + p.phase));
        _dummy.position.set(p.x, p.y, p.z);
        _dummy.rotation.set(elapsed * 0.5 + p.phase, elapsed * 0.8 + p.phase, 0);
        _dummy.scale.set(pulse, pulse * 0.65, pulse);
        _dummy.updateMatrix();
        this.pollenMesh.setMatrixAt(i, _dummy.matrix);
      }
      this.pollenMesh.instanceMatrix.needsUpdate = true;
      return;
    }

    if (this.theme === 'autumn') {
      for (let i = 0; i < this.leafData.length; i++) {
        const p = this.leafData[i];
        p.y -= p.speedY * dt;
        p.x += (Math.sin(elapsed * 1.45 + p.phase) * 1.6 + 0.65) * dt;
        p.z += (Math.cos(elapsed * 1.2 + p.phase) * 1.15 + 0.35) * dt;

        if (p.y < 0.15) {
          p.y = MAX_HEIGHT;
          p.x = (Math.random() - 0.5) * AREA_HALF * 2;
          p.z = (Math.random() - 0.5) * AREA_HALF * 2;
        }
        if (p.x > AREA_HALF) p.x = -AREA_HALF;
        if (p.z > AREA_HALF) p.z = -AREA_HALF;

        _dummy.position.set(p.x, p.y, p.z);
        _dummy.rotation.set(
          Math.sin(elapsed * p.spinSpeed + p.phase) * 1.1,
          elapsed * p.spinSpeed * 0.85 + p.phase,
          Math.cos(elapsed * p.spinSpeed * 0.9 + p.phase) * 1.2,
        );
        _dummy.scale.setScalar(p.scale);
        _dummy.updateMatrix();
        this.leafMesh.setMatrixAt(i, _dummy.matrix);
      }
      this.leafMesh.instanceMatrix.needsUpdate = true;
      return;
    }

    if (this.theme === 'alpine') {
      for (let i = 0; i < this.snowData.length; i++) {
        const p = this.snowData[i];
        p.y -= p.speedY * dt;
        p.x += (Math.sin(elapsed * 0.9 + p.phase) * 0.85 + 0.3) * dt;
        p.z += Math.cos(elapsed * 0.75 + p.phase) * 0.75 * dt;

        if (p.y < 0.15) {
          p.y = MAX_HEIGHT;
          p.x = (Math.random() - 0.5) * AREA_HALF * 2;
          p.z = (Math.random() - 0.5) * AREA_HALF * 2;
        }

        _dummy.position.set(p.x, p.y, p.z);
        _dummy.rotation.set(elapsed * 0.9 + p.phase, elapsed * 1.1, 0);
        _dummy.scale.setScalar(p.scale);
        _dummy.updateMatrix();
        this.snowMesh.setMatrixAt(i, _dummy.matrix);
      }
      this.snowMesh.instanceMatrix.needsUpdate = true;
      return;
    }

    // Clover: Gentle Rain & Ground Splash Ripples
    for (let i = 0; i < this.rainData.length; i++) {
      const p = this.rainData[i];
      p.y -= p.speedY * dt;
      p.x += 1.65 * dt;
      p.z += 0.95 * dt;

      if (p.y < 0.1) {
        p.y = MAX_HEIGHT;
        p.x = (Math.random() - 0.5) * AREA_HALF * 2;
        p.z = (Math.random() - 0.5) * AREA_HALF * 2;
      }

      _dummy.position.set(p.x, p.y, p.z);
      _dummy.rotation.set(0.06, 0, -0.11);
      _dummy.scale.set(1, p.scale, 1);
      _dummy.updateMatrix();
      this.rainMesh.setMatrixAt(i, _dummy.matrix);
    }
    this.rainMesh.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < this.splashData.length; i++) {
      const s = this.splashData[i];
      s.life += dt;
      if (s.life >= s.maxLife) {
        s.life = 0;
        s.x = (Math.random() - 0.5) * 24;
        s.z = (Math.random() - 0.5) * 24;
      }
      const progress = s.life / s.maxLife;
      const ringScale = 0.25 + progress * 1.55;
      _dummy.position.set(s.x, 0.08, s.z);
      _dummy.rotation.set(0, 0, 0);
      _dummy.scale.set(ringScale, 1, ringScale);
      _dummy.updateMatrix();
      this.splashMesh.setMatrixAt(i, _dummy.matrix);
    }
    this.splashMesh.instanceMatrix.needsUpdate = true;
  }

  public dispose(): void {
    const meshes = [this.pollenMesh, this.leafMesh, this.snowMesh, this.rainMesh, this.splashMesh];
    for (const m of meshes) {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
  }
}
