import * as THREE from 'three';

export interface TextureBundle {
  tileBlue: THREE.CanvasTexture;
  tileBlueRough: THREE.CanvasTexture;
  tileBump: THREE.CanvasTexture;
  gymRoyal: THREE.CanvasTexture;
  tileMint: THREE.CanvasTexture;
  courtyardPaver: THREE.CanvasTexture;
  paverBump: THREE.CanvasTexture;
  grass: THREE.CanvasTexture;
  asphalt: THREE.CanvasTexture;
  asphaltBump: THREE.CanvasTexture;
  sidewalk: THREE.CanvasTexture;
  wood: THREE.CanvasTexture;
  bark: THREE.CanvasTexture;
  leafFoliage: THREE.CanvasTexture;
  roofShingle: THREE.CanvasTexture;
  stuccoBump: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  therasonWall: THREE.CanvasTexture;
  therasonMonument: THREE.CanvasTexture;
  therasonFacadeSign: THREE.CanvasTexture;
  anatomyPoster: THREE.CanvasTexture;
  ecgScreen: THREE.CanvasTexture;
  certificateFrame: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  anisotropy: number,
  repeatX = 1,
  repeatY = 1,
  srgb = true,
  clamp = false
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  tex.wrapT = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

function drawTherasonMark(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  color: string,
  accentColor = '#22c55e'
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Articulated L-joint biomechanics icon matching the Therason emblem
  ctx.strokeStyle = color;
  ctx.lineWidth = 4.6;
  ctx.beginPath();
  ctx.moveTo(-10, -14);
  ctx.lineTo(-10, 6);
  ctx.lineTo(10, 6);
  ctx.stroke();

  // Subtle dashed ROM arc
  ctx.save();
  ctx.setLineDash([3, 3]);
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(-10, 6, 14, -Math.PI / 2, 0);
  ctx.stroke();
  ctx.restore();

  // Joint nodes
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(-10, 6, 4.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 3.2;
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(11, 6, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function createTextureBundle(maxAnisotropy = 4): TextureBundle {
  const aniso = Math.min(8, Math.max(1, maxAnisotropy));
  const created: THREE.CanvasTexture[] = [];
  const track = (t: THREE.CanvasTexture) => {
    created.push(t);
    return t;
  };

  // 1. Glossy marble-veined porcelain clinic tile (balanced natural stone, zero white glare!)
  const tileBlue = (() => {
    const [c, ctx] = makeCanvas(512, 512);
    ctx.fillStyle = '#dde5ee';
    ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = '#cfdbe7';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillRect(256, 256, 256, 256);

    // Subtle porcelain stone veining
    ctx.strokeStyle = 'rgba(116, 148, 178, 0.24)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 14; i++) {
      ctx.beginPath();
      const sy = (i * 41) % 512;
      ctx.moveTo(0, sy);
      ctx.bezierCurveTo(160, sy + 28, 320, sy - 24, 512, sy + 14);
      ctx.stroke();
    }

    // Precision grout lines
    ctx.strokeStyle = '#aebfcc';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 252, 252);
    ctx.strokeRect(258, 2, 252, 252);
    ctx.strokeRect(2, 258, 252, 252);
    ctx.strokeRect(258, 258, 252, 252);
    return track(finalizeTexture(c, aniso, 1, 1, true));
  })();

  // Roughness map for tile (glossy tile face = dark 0.14, matte grout = light 0.72)
  const tileBlueRough = (() => {
    const [c, ctx] = makeCanvas(256, 256);
    ctx.fillStyle = '#262626';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#c8c8c8';
    ctx.lineWidth = 5;
    ctx.strokeRect(2.5, 2.5, 123, 123);
    ctx.strokeRect(130.5, 2.5, 123, 123);
    ctx.strokeRect(2.5, 130.5, 123, 123);
    ctx.strokeRect(130.5, 130.5, 123, 123);
    return track(finalizeTexture(c, aniso, 1, 1, false));
  })();

  const tileBump = (() => {
    const [c, ctx] = makeCanvas(256, 256);
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#555555';
    ctx.lineWidth = 5;
    ctx.strokeRect(2.5, 2.5, 123, 123);
    ctx.strokeRect(130.5, 2.5, 123, 123);
    ctx.strokeRect(2.5, 130.5, 123, 123);
    ctx.strokeRect(130.5, 130.5, 123, 123);
    return track(finalizeTexture(c, aniso, 1, 1, false));
  })();

  // 2. Muted athletic EPDM gym flooring
  const gymRoyal = (() => {
    const [c, ctx] = makeCanvas(256, 256);
    ctx.fillStyle = '#244778';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#285188';
    ctx.fillRect(2, 2, 124, 124);
    ctx.fillRect(130, 130, 124, 124);
    for (let i = 0; i < 650; i++) {
      const rx = (Math.sin(i * 19.3) * 0.5 + 0.5) * 256;
      const ry = (Math.cos(i * 41.7) * 0.5 + 0.5) * 256;
      ctx.fillStyle = i % 3 === 0 ? 'rgba(186,230,253,0.2)' : 'rgba(15,23,42,0.22)';
      ctx.fillRect(rx, ry, 2.2, 2.2);
    }
    return track(finalizeTexture(c, aniso, 1, 1, true));
  })();

  // 3. Soft sage-mint clinical stone tile
  const tileMint = (() => {
    const [c, ctx] = makeCanvas(256, 256);
    ctx.fillStyle = '#d1e1dc';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#c4d8d2';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillRect(128, 128, 128, 128);
    ctx.strokeStyle = '#9dbab2';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, 125, 125);
    ctx.strokeRect(129.5, 129.5, 125, 125);
    return track(finalizeTexture(c, aniso, 1, 1, true));
  })();

  // 4. Courtyard travertine stone pavers + bump
  const courtyardPaver = (() => {
    const [c, ctx] = makeCanvas(256, 256);
    ctx.fillStyle = '#b4a799';
    ctx.fillRect(0, 0, 256, 256);
    const cols = 4;
    const rows = 4;
    const cw = 256 / cols;
    const ch = 256 / rows;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const offset = y % 2 === 0 ? 0 : cw * 0.5;
        const shade = ((x * 7 + y * 13) % 5) * 5 - 10;
        ctx.fillStyle = `rgb(${194 + shade}, ${183 + shade}, ${169 + shade})`;
        ctx.fillRect(((x * cw + offset) % 256) + 2, y * ch + 2, cw - 4, ch - 4);
      }
    }
    return track(finalizeTexture(c, aniso, 1, 1, true));
  })();

  const paverBump = (() => {
    const [c, ctx] = makeCanvas(256, 256);
    ctx.fillStyle = '#555555';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#dcdcdc';
    const cw = 64;
    const ch = 64;
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const offset = y % 2 === 0 ? 0 : cw * 0.5;
        ctx.fillRect(((x * cw + offset) % 256) + 2, y * ch + 2, cw - 4, ch - 4);
      }
    }
    return track(finalizeTexture(c, aniso, 1, 1, false));
  })();

  // 5. Realistic organic uneven botanical meadow grass (varied growth heights, straw tips, clover patches)
  const grass = (() => {
    const [c, ctx] = makeCanvas(512, 512);
    ctx.fillStyle = '#3f632e';
    ctx.fillRect(0, 0, 512, 512);

    const drawWrappedRadial = (px: number, py: number, r: number, innerCol: string, outerCol: string) => {
      for (const ox of [-512, 0, 512]) {
        for (const oy of [-512, 0, 512]) {
          const x = px + ox;
          const y = py + oy;
          if (x + r < 0 || x - r > 512 || y + r < 0 || y - r > 512) continue;
          const grad = ctx.createRadialGradient(x, y, 2, x, y, r);
          grad.addColorStop(0, innerCol);
          grad.addColorStop(1, outerCol);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    // Organic uneven soil/thatch & lush meadow moisture variation
    for (let i = 0; i < 120; i++) {
      const px = (Math.sin(i * 19.7 + 1.2) * 0.5 + 0.5) * 512;
      const py = (Math.cos(i * 31.3 + 0.5) * 0.5 + 0.5) * 512;
      const r = 24 + (i % 7) * 14;
      const tone =
        i % 5 === 0
          ? 'rgba(94, 132, 58, 0.36)'
          : i % 5 === 1
            ? 'rgba(46, 78, 33, 0.36)'
            : i % 5 === 2
              ? 'rgba(116, 132, 66, 0.25)'
              : i % 5 === 3
                ? 'rgba(61, 98, 43, 0.32)'
                : 'rgba(104, 96, 56, 0.16)';
      drawWrappedRadial(px, py, r, tone, 'rgba(63, 99, 46, 0)');
    }

    // Dense criss-crossing grass blades & dry straw accents wrapped seamlessly
    for (let i = 0; i < 6400; i++) {
      const gx = (Math.sin(i * 91.3 + 0.7) * 0.5 + 0.5) * 512;
      const gy = (Math.cos(i * 47.9 + 1.4) * 0.5 + 0.5) * 512;
      const len = 4 + (i % 6) * 2.2;
      const lean = ((i % 7) - 3) * 1.3;
      ctx.strokeStyle =
        i % 7 === 0
          ? 'rgba(134, 168, 78, 0.52)'
          : i % 7 === 1
            ? 'rgba(36, 62, 24, 0.5)'
            : i % 7 === 2
              ? 'rgba(162, 158, 86, 0.34)'
              : i % 7 === 3
                ? 'rgba(84, 126, 54, 0.46)'
                : i % 7 === 4
                  ? 'rgba(54, 90, 38, 0.46)'
                  : i % 7 === 5
                    ? 'rgba(114, 148, 66, 0.42)'
                    : 'rgba(44, 72, 28, 0.44)';
      ctx.lineWidth = i % 3 === 0 ? 1.6 : 1.15;
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx + lean, gy - len);
      ctx.stroke();
    }
    return track(finalizeTexture(c, aniso, 40, 40, true));
  })();

  // 6. Asphalt road + aggregate bump
  const asphalt = (() => {
    const [c, ctx] = makeCanvas(256, 256);
    ctx.fillStyle = '#313944';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2000; i++) {
      const x = (Math.sin(i * 37.2) * 0.5 + 0.5) * 256;
      const y = (Math.cos(i * 61.9) * 0.5 + 0.5) * 256;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(10,15,24,0.22)';
      ctx.fillRect(x, y, 2, 2);
    }
    return track(finalizeTexture(c, aniso, 2, 12, true));
  })();

  const asphaltBump = (() => {
    const [c, ctx] = makeCanvas(256, 256);
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2000; i++) {
      const x = (Math.sin(i * 37.2) * 0.5 + 0.5) * 256;
      const y = (Math.cos(i * 61.9) * 0.5 + 0.5) * 256;
      ctx.fillStyle = i % 2 === 0 ? '#a8a8a8' : '#585858';
      ctx.fillRect(x, y, 2, 2);
    }
    return track(finalizeTexture(c, aniso, 2, 12, false));
  })();

  // 7. Warm limestone pedestrian promenade slabs
  const sidewalk = (() => {
    const [c, ctx] = makeCanvas(256, 256);
    ctx.fillStyle = '#c8c2b6';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#d3cdc2';
    ctx.fillRect(4, 4, 248, 120);
    ctx.fillRect(4, 132, 248, 120);
    ctx.strokeStyle = '#9e978b';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 252, 124);
    ctx.strokeRect(2, 130, 252, 124);
    return track(finalizeTexture(c, aniso, 2, 12, true));
  })();

  // 8. Rich architectural oak/cedar wood grain
  const wood = (() => {
    const [c, ctx] = makeCanvas(256, 256);
    ctx.fillStyle = '#925f38';
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 5) {
      ctx.fillStyle = y % 10 === 0 ? 'rgba(72, 38, 15, 0.28)' : 'rgba(186, 138, 92, 0.14)';
      ctx.fillRect(0, y, 256, 2.5);
    }
    return track(finalizeTexture(c, aniso, 1, 1, true));
  })();

  // 8a. Furrowed natural tree bark texture
  const bark = (() => {
    const [c, ctx] = makeCanvas(256, 256);
    ctx.fillStyle = '#533824';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 240; i++) {
      const x = (Math.sin(i * 23.1) * 0.5 + 0.5) * 256;
      const y = (Math.cos(i * 11.7) * 0.5 + 0.5) * 256;
      const h = 24 + (i % 5) * 14;
      const w = 3 + (i % 3) * 2;
      ctx.fillStyle = i % 3 === 0 ? 'rgba(34, 20, 11, 0.52)' : i % 3 === 1 ? 'rgba(110, 82, 56, 0.36)' : 'rgba(66, 56, 38, 0.3)';
      ctx.fillRect(x, y, w, h);
    }
    return track(finalizeTexture(c, aniso, 2, 3, true));
  })();

  // 8ab. Alpha-cutout realistic botanical leaf spray texture
  const leafFoliage = (() => {
    const [c, ctx] = makeCanvas(256, 256);
    ctx.clearRect(0, 0, 256, 256);
    const leafColors = ['#2d5e22', '#3a742b', '#4b8a36', '#5e9b40', '#244d1b'];
    for (let i = 0; i < 68; i++) {
      const a = i * 2.39996;
      const rad = Math.sqrt((i + 1) / 68) * 98;
      const lx = 128 + Math.cos(a) * rad;
      const ly = 128 + Math.sin(a) * rad;
      const lw = 18 + (i % 4) * 5;
      const lh = 9 + (i % 3) * 3;
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(a + (i % 5) * 0.25);
      ctx.fillStyle = leafColors[i % leafColors.length];
      ctx.beginPath();
      ctx.ellipse(0, 0, lw, lh, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(20, 42, 14, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-lw * 0.75, 0);
      ctx.lineTo(lw * 0.75, 0);
      ctx.stroke();
      ctx.restore();
    }
    return track(finalizeTexture(c, aniso, 1, 1, true, true));
  })();

  // 8b. Architectural terracotta clay roof shingle courses
  const roofShingle = (() => {
    const [c, ctx] = makeCanvas(256, 256);
    ctx.fillStyle = '#8b4534';
    ctx.fillRect(0, 0, 256, 256);
    const rows = 8;
    const cols = 6;
    const rh = 256 / rows;
    const cw = 256 / cols;
    for (let r = 0; r < rows; r++) {
      const off = r % 2 === 0 ? 0 : cw * 0.5;
      for (let col = -1; col <= cols; col++) {
        const shade = ((r * 5 + col * 11) % 5) * 4 - 8;
        ctx.fillStyle = `rgb(${144 + shade}, ${72 + shade}, ${54 + shade})`;
        ctx.fillRect(col * cw + off + 1, r * rh + 1, cw - 2, rh - 2);
      }
      ctx.fillStyle = 'rgba(30, 12, 8, 0.28)';
      ctx.fillRect(0, r * rh + rh - 3, 256, 3);
    }
    return track(finalizeTexture(c, aniso, 3, 2, true));
  })();

  // 9. Fine architectural plaster stucco bump (eliminates smooth plastic/clay sheen!)
  const stuccoBump = (() => {
    const [c, ctx] = makeCanvas(256, 256);
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2400; i++) {
      const x = (Math.sin(i * 17.1) * 0.5 + 0.5) * 256;
      const y = (Math.cos(i * 53.7) * 0.5 + 0.5) * 256;
      ctx.fillStyle = i % 2 === 0 ? '#989898' : '#686868';
      ctx.fillRect(x, y, 2, 2);
    }
    return track(finalizeTexture(c, aniso, 3, 3, false));
  })();

  // 10. Soft radial contact AO shadow decal (grounds every character, furniture, tree, car!)
  const contactShadow = (() => {
    const [c, ctx] = makeCanvas(128, 128);
    const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
    grad.addColorStop(0, 'rgba(10, 20, 35, 0.42)');
    grad.addColorStop(0.55, 'rgba(10, 20, 35, 0.18)');
    grad.addColorStop(1, 'rgba(10, 20, 35, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    return track(finalizeTexture(c, aniso, 1, 1, true, true));
  })();

  // 11. Reception back wall THERASON architectural panel
  const therasonWall = (() => {
    const [c, ctx] = makeCanvas(512, 192);
    ctx.fillStyle = '#dce4ed';
    ctx.fillRect(0, 0, 512, 192);
    ctx.fillStyle = '#0ea5e9';
    ctx.fillRect(0, 150, 512, 6);
    ctx.fillStyle = '#0f4c75';
    ctx.fillRect(0, 156, 512, 36);

    drawTherasonMark(ctx, 110, 76, 1.5, '#0284c7');
    ctx.fillStyle = '#0f294a';
    ctx.font = '900 44px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('THERASON', 152, 74);
    ctx.fillStyle = '#0369a1';
    ctx.font = '700 15px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('CLINICAL REHAB & SPORTS CARE', 154, 114);
    return track(finalizeTexture(c, aniso, 1, 1, true, true));
  })();

  // 12. Illuminated blue-glow outdoor monument sign (matching lawn glowing sign in reference)
  const therasonMonument = (() => {
    const [c, ctx] = makeCanvas(512, 260);
    const grad = ctx.createLinearGradient(0, 0, 512, 260);
    grad.addColorStop(0, '#1d4ed8');
    grad.addColorStop(0.5, '#2563eb');
    grad.addColorStop(1, '#1e40af');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 260);

    ctx.strokeStyle = '#93c5fd';
    ctx.lineWidth = 10;
    ctx.strokeRect(10, 10, 492, 240);

    drawTherasonMark(ctx, 256, 126, 3.8, '#ffffff', '#4ade80');
    return track(finalizeTexture(c, aniso, 1, 1, true, true));
  })();

  // 12b. Illuminated Main Entrance Facade Sign ("Therason Clinic")
  const therasonFacadeSign = (() => {
    const [c, ctx] = makeCanvas(640, 180);
    const grad = ctx.createLinearGradient(0, 0, 640, 180);
    grad.addColorStop(0, '#1e40af');
    grad.addColorStop(0.5, '#2563eb');
    grad.addColorStop(1, '#0284c7');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 640, 180);

    ctx.strokeStyle = '#bae6fd';
    ctx.lineWidth = 6;
    ctx.strokeRect(5, 5, 630, 170);

    drawTherasonMark(ctx, 118, 92, 2.7, '#ffffff', '#4ade80');
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 52px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Therason', 186, 68);
    ctx.font = '700 44px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#e0f2fe';
    ctx.fillText('Clinic', 220, 124);
    return track(finalizeTexture(c, aniso, 1, 1, true, true));
  })();

  // 13. Framed Anatomy Poster
  const anatomyPoster = (() => {
    const [c, ctx] = makeCanvas(192, 256);
    ctx.fillStyle = '#e8edf2';
    ctx.fillRect(0, 0, 192, 256);
    ctx.strokeStyle = '#0f294a';
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, 180, 244);

    ctx.fillStyle = '#0284c7';
    ctx.fillRect(14, 14, 164, 28);
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SPINE & MSK CHART', 96, 33);

    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(96, 68, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(73, 86, 46, 62);
    ctx.fillStyle = '#b91c1c';
    ctx.fillRect(55, 88, 14, 54);
    ctx.fillRect(123, 88, 14, 54);
    ctx.fillRect(76, 150, 16, 70);
    ctx.fillRect(100, 150, 16, 70);
    ctx.strokeStyle = '#fde68a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(96, 86);
    ctx.lineTo(96, 150);
    ctx.stroke();
    return track(finalizeTexture(c, aniso, 1, 1, true, true));
  })();

  // 14. Medical Telemetry Screen
  const ecgScreen = (() => {
    const [c, ctx] = makeCanvas(256, 160);
    ctx.fillStyle = '#062036';
    ctx.fillRect(0, 0, 256, 160);
    ctx.strokeStyle = 'rgba(56,189,248,0.18)';
    ctx.lineWidth = 1;
    for (let x = 0; x < 256; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 160);
      ctx.stroke();
    }
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(10, 86);
    ctx.lineTo(65, 86);
    ctx.lineTo(82, 34);
    ctx.lineTo(98, 128);
    ctx.lineTo(116, 62);
    ctx.lineTo(132, 86);
    ctx.lineTo(245, 86);
    ctx.stroke();

    ctx.fillStyle = '#34d399';
    ctx.font = '800 20px monospace';
    ctx.fillText('THERAPY READY', 18, 30);
    return track(finalizeTexture(c, aniso, 1, 1, true, true));
  })();

  // 15. Framed Physiotherapy License Certificate on clinic wall
  const certificateFrame = (() => {
    const [c, ctx] = makeCanvas(192, 144);
    ctx.fillStyle = '#fffbeb';
    ctx.fillRect(0, 0, 192, 144);
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 8;
    ctx.strokeRect(6, 6, 180, 132);
    ctx.fillStyle = '#1e293b';
    ctx.font = '800 13px serif';
    ctx.textAlign = 'center';
    ctx.fillText('CLINICAL LICENSE', 96, 36);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(36, 54, 120, 6);
    ctx.fillRect(46, 68, 100, 5);
    ctx.fillRect(52, 80, 88, 5);
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(96, 108, 13, 0, Math.PI * 2);
    ctx.fill();
    return track(finalizeTexture(c, aniso, 1, 1, true, true));
  })();

  return {
    tileBlue,
    tileBlueRough,
    tileBump,
    gymRoyal,
    tileMint,
    courtyardPaver,
    paverBump,
    grass,
    asphalt,
    asphaltBump,
    sidewalk,
    wood,
    bark,
    leafFoliage,
    roofShingle,
    stuccoBump,
    contactShadow,
    therasonWall,
    therasonMonument,
    therasonFacadeSign,
    anatomyPoster,
    ecgScreen,
    certificateFrame,
    dispose: () => {
      created.forEach((t) => t.dispose());
    },
  };
}
