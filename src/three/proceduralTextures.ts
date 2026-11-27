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

  // 1. Painterly Storybook Sunlit Meadow Grass
  const [grassC, gCtx] = makeCanvas(512, 512);
  gCtx.fillStyle = '#7DC456';
  gCtx.fillRect(0, 0, 512, 512);

  // Soft illustrated clover & sunlit lawn patches
  for (let i = 0; i < 240; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 16 + Math.random() * 32;
    gCtx.fillStyle =
      i % 2 === 0 ? 'rgba(164, 219, 98, 0.22)' : 'rgba(92, 158, 66, 0.16)';
    gCtx.beginPath();
    gCtx.arc(x, y, r, 0, Math.PI * 2);
    gCtx.fill();
  }

  // Stylized cartoon V-shaped triple grass tufts (chunky storybook brushstrokes)
  gCtx.lineCap = 'round';
  for (let i = 0; i < 520; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const h = 7 + Math.random() * 7;
    gCtx.strokeStyle =
      i % 3 === 0 ? 'rgba(202, 238, 122, 0.45)' : 'rgba(72, 134, 52, 0.32)';
    gCtx.lineWidth = 2.2;
    gCtx.beginPath();
    gCtx.moveTo(x, y);
    gCtx.lineTo(x - 4, y - h * 0.85);
    gCtx.moveTo(x, y);
    gCtx.lineTo(x, y - h);
    gCtx.moveTo(x, y);
    gCtx.lineTo(x + 4, y - h * 0.82);
    gCtx.stroke();
  }

  // Tiny cheerful meadow clover & buttercup flecks
  for (let i = 0; i < 48; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    gCtx.fillStyle = i % 2 === 0 ? 'rgba(255, 248, 214, 0.48)' : 'rgba(255, 224, 114, 0.46)';
    gCtx.beginPath();
    gCtx.arc(x, y, 2.6, 0, Math.PI * 2);
    gCtx.fill();
  }
  const meadowGrass = finalizeColorTex(grassC, aniso, 10, 10);

  // 2. Cozy Illustrated Tilled Garden Soil
  const [soilC, sCtx] = makeCanvas(256, 256);
  sCtx.fillStyle = '#7A5033';
  sCtx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 32) {
    const grad = sCtx.createLinearGradient(0, y, 0, y + 32);
    grad.addColorStop(0, '#5B3820');
    grad.addColorStop(0.42, '#91623F');
    grad.addColorStop(0.62, '#A27049');
    grad.addColorStop(1, '#58361E');
    sCtx.fillStyle = grad;
    sCtx.fillRect(0, y, 256, 32);
  }
  for (let i = 0; i < 240; i++) {
    sCtx.fillStyle = i % 2 === 0 ? 'rgba(255, 228, 190, 0.14)' : 'rgba(46, 24, 12, 0.18)';
    sCtx.beginPath();
    sCtx.arc(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 2.5, 0, Math.PI * 2);
    sCtx.fill();
  }
  const soilFurrow = finalizeColorTex(soilC, aniso, 1, 1);

  // 3. Warm Honey-Cedar Storybook Wood Grain
  const [woodC, wCtx] = makeCanvas(256, 256);
  wCtx.fillStyle = '#B87E4E';
  wCtx.fillRect(0, 0, 256, 256);
  wCtx.lineCap = 'round';
  for (let y = 0; y < 256; y += 7) {
    wCtx.strokeStyle =
      y % 21 === 0 ? 'rgba(92, 52, 24, 0.34)' : 'rgba(232, 184, 130, 0.28)';
    wCtx.lineWidth = y % 21 === 0 ? 3.2 : 2.2;
    wCtx.beginPath();
    wCtx.moveTo(0, y);
    for (let x = 0; x <= 256; x += 32) {
      wCtx.lineTo(x, y + Math.sin(x * 0.04 + y * 0.08) * 3.5);
    }
    wCtx.stroke();
  }
  // Cute painted wood knots
  for (const [kx, ky] of [
    [68, 72],
    [186, 178],
  ]) {
    wCtx.strokeStyle = 'rgba(92, 52, 24, 0.32)';
    wCtx.lineWidth = 2.5;
    wCtx.beginPath();
    wCtx.ellipse(kx, ky, 14, 7, 0.1, 0, Math.PI * 2);
    wCtx.stroke();
  }
  const woodGrain = finalizeColorTex(woodC, aniso, 1, 1);

  // 4. Rounded Storybook Stepping Cobblestones with Soft Ink Rims
  const [cobbleC, cCtx] = makeCanvas(256, 256);
  cCtx.fillStyle = '#7EBE5D';
  cCtx.fillRect(0, 0, 256, 256);
  const stones: [number, number, number, number, string][] = [
    [62, 62, 46, 36, '#DDD2BE'],
    [154, 58, 52, 40, '#D2C5AE'],
    [220, 128, 34, 42, '#E2D8C7'],
    [54, 152, 48, 42, '#CFC2AB'],
    [146, 158, 54, 46, '#E0D5C2'],
    [102, 224, 52, 32, '#D5C9B4'],
    [206, 218, 42, 34, '#DFD4C2'],
  ];
  for (const [sx, sy, rx, ry, fill] of stones) {
    cCtx.fillStyle = fill;
    cCtx.beginPath();
    cCtx.ellipse(sx, sy, rx, ry, 0.18, 0, Math.PI * 2);
    cCtx.fill();
    cCtx.strokeStyle = '#5E4E42';
    cCtx.lineWidth = 4.5;
    cCtx.stroke();
    // Creamy sunlit cartoon highlight crescent
    cCtx.fillStyle = 'rgba(255, 252, 244, 0.45)';
    cCtx.beginPath();
    cCtx.ellipse(sx - rx * 0.2, sy - ry * 0.22, rx * 0.48, ry * 0.36, 0.18, 0, Math.PI * 2);
    cCtx.fill();
  }
  const cobbleStone = finalizeColorTex(cobbleC, aniso, 1, 1);

  // 5. Cheerful Cartoon Turquoise Brook Water with Scalloped Foam Ripples
  const [waterC, waCtx] = makeCanvas(256, 256);
  const wg = waCtx.createLinearGradient(0, 0, 256, 256);
  wg.addColorStop(0, '#5AD0F0');
  wg.addColorStop(0.5, '#42B7DF');
  wg.addColorStop(1, '#68DCF7');
  waCtx.fillStyle = wg;
  waCtx.fillRect(0, 0, 256, 256);

  waCtx.lineCap = 'round';
  for (let i = 0; i < 34; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const rad = 12 + Math.random() * 20;
    waCtx.strokeStyle = i % 3 === 0 ? 'rgba(255, 255, 255, 0.56)' : 'rgba(215, 248, 255, 0.36)';
    waCtx.lineWidth = i % 3 === 0 ? 3.5 : 2.5;
    waCtx.beginPath();
    waCtx.arc(x, y, rad, 0.25, Math.PI - 0.25);
    waCtx.stroke();
  }
  const waterRipple = finalizeColorTex(waterC, aniso, 4, 4);

  // 6. Soft Warm Radial Contact Shadow
  const [shadC, shCtx] = makeCanvas(128, 128);
  const sg = shCtx.createRadialGradient(64, 64, 10, 64, 64, 58);
  sg.addColorStop(0, 'rgba(34, 46, 26, 0.42)');
  sg.addColorStop(0.62, 'rgba(34, 46, 26, 0.16)');
  sg.addColorStop(1, 'rgba(34, 46, 26, 0.0)');
  shCtx.fillStyle = sg;
  shCtx.fillRect(0, 0, 128, 128);
  const contactShadow = new THREE.CanvasTexture(shadC);
  contactShadow.needsUpdate = true;

  // 7. Painted Storybook Butterfly Wings
  const makeButterflyWing = (primary: string, glow: string, border: string) => {
    const [wc, ctx] = makeCanvas(256, 256);
    ctx.clearRect(0, 0, 256, 256);
    ctx.beginPath();
    ctx.moveTo(8, 132);
    ctx.bezierCurveTo(56, 18, 228, 8, 246, 82);
    ctx.bezierCurveTo(254, 134, 212, 170, 160, 166);
    ctx.bezierCurveTo(206, 200, 186, 246, 118, 246);
    ctx.bezierCurveTo(60, 246, 22, 198, 8, 148);
    ctx.closePath();

    const grad = ctx.createRadialGradient(55, 125, 18, 130, 130, 180);
    grad.addColorStop(0, glow);
    grad.addColorStop(0.7, primary);
    grad.addColorStop(1, border);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.lineWidth = 11;
    ctx.strokeStyle = border;
    ctx.stroke();

    ctx.lineWidth = 4.5;
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

    ctx.fillStyle = '#FFFDF7';
    const dots = [
      [226, 76],
      [234, 98],
      [224, 122],
      [204, 144],
      [174, 212],
      [148, 232],
      [118, 234],
    ];
    for (const [dx, dy] of dots) {
      ctx.beginPath();
      ctx.arc(dx, dy, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    return finalizeColorTex(wc, aniso, 1, 1);
  };

  const butterflyWingClassic = makeButterflyWing('#FF942E', '#FFE07A', '#2B1E18');
  const butterflyWingExotic = makeButterflyWing('#29A5FF', '#9AF0FF', '#162952');

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
