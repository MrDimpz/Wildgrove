import * as THREE from 'three';

export interface ProceduralTextureSet {
  meadowGrass: THREE.CanvasTexture;
  soilFurrow: THREE.CanvasTexture;
  woodGrain: THREE.CanvasTexture;
  cobbleStone: THREE.CanvasTexture;
  waterRipple: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  butterflyWingClassic: THREE.CanvasTexture;
  butterflyWingExotic: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

function finalizeColorTex(
  canvas: HTMLCanvasElement,
  anisotropy: number,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  if (repeatX !== 1 || repeatY !== 1) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
  }
  tex.needsUpdate = true;
  return tex;
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextureSet {
  const aniso = Math.max(1, Math.min(8, maxAnisotropy));

  // 1. Sunlit Meadow Grass
  const [grassC, gCtx] = makeCanvas(512, 512);
  gCtx.fillStyle = '#74A955';
  gCtx.fillRect(0, 0, 512, 512);
  // Soft organic lawn mottling
  for (let i = 0; i < 420; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 10 + Math.random() * 28;
    gCtx.fillStyle =
      i % 2 === 0 ? 'rgba(138, 191, 90, 0.16)' : 'rgba(79, 130, 59, 0.14)';
    gCtx.beginPath();
    gCtx.arc(x, y, r, 0, Math.PI * 2);
    gCtx.fill();
  }
  // Fine sunlit grass blades
  for (let i = 0; i < 1600; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    gCtx.strokeStyle =
      i % 3 === 0 ? 'rgba(176, 214, 108, 0.35)' : 'rgba(66, 112, 50, 0.25)';
    gCtx.lineWidth = 1.3;
    gCtx.beginPath();
    gCtx.moveTo(x, y);
    gCtx.lineTo(x + (Math.random() - 0.5) * 4, y - 5 - Math.random() * 6);
    gCtx.stroke();
  }
  const meadowGrass = finalizeColorTex(grassC, aniso, 10, 10);

  // 2. Tilled Farm Soil Furrows
  const [soilC, sCtx] = makeCanvas(256, 256);
  sCtx.fillStyle = '#6A472C';
  sCtx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 32) {
    const grad = sCtx.createLinearGradient(0, y, 0, y + 32);
    grad.addColorStop(0, '#4E321D');
    grad.addColorStop(0.45, '#7D5536');
    grad.addColorStop(1, '#4B2F1B');
    sCtx.fillStyle = grad;
    sCtx.fillRect(0, y, 256, 32);
  }
  for (let i = 0; i < 600; i++) {
    sCtx.fillStyle = i % 2 === 0 ? 'rgba(255,220,180,0.08)' : 'rgba(30,16,8,0.16)';
    sCtx.fillRect(Math.random() * 256, Math.random() * 256, 3, 2);
  }
  const soilFurrow = finalizeColorTex(soilC, aniso, 1, 1);

  // 3. Warm Cedar Timber Wood Grain
  const [woodC, wCtx] = makeCanvas(256, 256);
  wCtx.fillStyle = '#9D6B43';
  wCtx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 4) {
    wCtx.strokeStyle =
      y % 12 === 0 ? 'rgba(72, 42, 20, 0.28)' : 'rgba(196, 148, 98, 0.18)';
    wCtx.lineWidth = 2;
    wCtx.beginPath();
    wCtx.moveTo(0, y);
    for (let x = 0; x <= 256; x += 32) {
      wCtx.lineTo(x, y + Math.sin(x * 0.04 + y * 0.1) * 2.5);
    }
    wCtx.stroke();
  }
  const woodGrain = finalizeColorTex(woodC, aniso, 1, 1);

  // 4. Warm Cobblestone Stepping Stones
  const [cobbleC, cCtx] = makeCanvas(256, 256);
  cCtx.fillStyle = '#709854';
  cCtx.fillRect(0, 0, 256, 256);
  const stones = [
    [60, 62, 46, 36],
    [152, 58, 52, 40],
    [220, 128, 34, 42],
    [54, 152, 48, 42],
    [144, 158, 54, 46],
    [102, 224, 52, 32],
    [206, 218, 42, 34],
  ];
  for (const [sx, sy, rx, ry] of stones) {
    cCtx.fillStyle = '#B8AEA0';
    cCtx.beginPath();
    cCtx.ellipse(sx, sy, rx, ry, 0.2, 0, Math.PI * 2);
    cCtx.fill();
    cCtx.strokeStyle = '#7D756A';
    cCtx.lineWidth = 3;
    cCtx.stroke();
    cCtx.fillStyle = 'rgba(255,250,240,0.28)';
    cCtx.beginPath();
    cCtx.ellipse(sx - rx * 0.2, sy - ry * 0.2, rx * 0.5, ry * 0.45, 0.2, 0, Math.PI * 2);
    cCtx.fill();
  }
  const cobbleStone = finalizeColorTex(cobbleC, aniso, 1, 1);

  // 5. Shimmering Brook / Pond Water
  const [waterC, waCtx] = makeCanvas(256, 256);
  const wg = waCtx.createLinearGradient(0, 0, 256, 256);
  wg.addColorStop(0, '#4FAFD2');
  wg.addColorStop(0.5, '#3E9BC4');
  wg.addColorStop(1, '#58B9DB');
  waCtx.fillStyle = wg;
  waCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 42; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    waCtx.strokeStyle = 'rgba(225, 250, 255, 0.32)';
    waCtx.lineWidth = 2;
    waCtx.beginPath();
    waCtx.arc(x, y, 10 + Math.random() * 24, 0.2, Math.PI - 0.2);
    waCtx.stroke();
  }
  const waterRipple = finalizeColorTex(waterC, aniso, 4, 4);

  // 6. Soft Radial Contact Shadow
  const [shadC, shCtx] = makeCanvas(128, 128);
  const sg = shCtx.createRadialGradient(64, 64, 8, 64, 64, 60);
  sg.addColorStop(0, 'rgba(24, 38, 22, 0.45)');
  sg.addColorStop(0.6, 'rgba(24, 38, 22, 0.18)');
  sg.addColorStop(1, 'rgba(24, 38, 22, 0.0)');
  shCtx.fillStyle = sg;
  shCtx.fillRect(0, 0, 128, 128);
  const contactShadow = new THREE.CanvasTexture(shadC);
  contactShadow.needsUpdate = true;

  // 7. Monarch Butterfly Wing Texture (Classic)
  const makeButterflyWing = (primary: string, glow: string, border: string) => {
    const [wc, ctx] = makeCanvas(256, 256);
    ctx.clearRect(0, 0, 256, 256);
    // Wing silhouette (hinged at left x=8)
    ctx.beginPath();
    ctx.moveTo(8, 132);
    ctx.bezierCurveTo(60, 22, 225, 10, 244, 82);
    ctx.bezierCurveTo(252, 132, 210, 168, 160, 165);
    ctx.bezierCurveTo(205, 198, 185, 244, 118, 244);
    ctx.bezierCurveTo(62, 244, 24, 198, 8, 148);
    ctx.closePath();

    const grad = ctx.createRadialGradient(55, 125, 18, 130, 130, 180);
    grad.addColorStop(0, glow);
    grad.addColorStop(0.68, primary);
    grad.addColorStop(1, border);
    ctx.fillStyle = grad;
    ctx.fill();

    // Crisp ebony border & veins
    ctx.lineWidth = 10;
    ctx.strokeStyle = border;
    ctx.stroke();

    ctx.lineWidth = 4;
    ctx.strokeStyle = border;
    const veins = [
      [18, 128, 220, 70],
      [18, 132, 225, 118],
      [18, 136, 178, 155],
      [18, 142, 160, 215],
      [18, 145, 105, 232],
    ];
    for (const [x1, y1, x2, y2] of veins) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // White pearl border speckles
    ctx.fillStyle = '#FFFDF7';
    const dots = [
      [228, 76],
      [234, 98],
      [226, 122],
      [204, 144],
      [174, 212],
      [148, 232],
      [118, 234],
    ];
    for (const [dx, dy] of dots) {
      ctx.beginPath();
      ctx.arc(dx, dy, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    return finalizeColorTex(wc, aniso, 1, 1);
  };

  const butterflyWingClassic = makeButterflyWing('#F28A24', '#FFD166', '#211A16');
  const butterflyWingExotic = makeButterflyWing('#2094F3', '#7CE8FF', '#122244');

  return {
    meadowGrass,
    soilFurrow,
    woodGrain,
    cobbleStone,
    waterRipple,
    contactShadow,
    butterflyWingClassic,
    butterflyWingExotic,
    dispose: () => {
      meadowGrass.dispose();
      soilFurrow.dispose();
      woodGrain.dispose();
      cobbleStone.dispose();
      waterRipple.dispose();
      contactShadow.dispose();
      butterflyWingClassic.dispose();
      butterflyWingExotic.dispose();
    },
  };
}
