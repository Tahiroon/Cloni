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
  barkBump: THREE.CanvasTexture;
  birchBark: THREE.CanvasTexture;
  leafFoliage: THREE.CanvasTexture;
  cypressFoliage: THREE.CanvasTexture;
  oliveFoliage: THREE.CanvasTexture;
  roofShingle: THREE.CanvasTexture;
  stuccoBump: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  therasonWall: THREE.CanvasTexture;
  therasonMonument: THREE.CanvasTexture;
  therasonFacadeSign: THREE.CanvasTexture;
  anatomyPoster: THREE.CanvasTexture;
  ecgScreen: THREE.CanvasTexture;
  certificateFrame: THREE.CanvasTexture;
  sconceWash: THREE.CanvasTexture;
  sconcePool: THREE.CanvasTexture;
  lgAcFront: THREE.CanvasTexture;
  nesmaPad: THREE.CanvasTexture;
  nesmaBadge: THREE.CanvasTexture;
  solarCell: THREE.CanvasTexture;
  palmFrond: THREE.CanvasTexture;
  roseFoliage: THREE.CanvasTexture;
  blossomFoliage: THREE.CanvasTexture;
  receptionScreen: THREE.CanvasTexture;
  updateReceptionScreen: (tSec: number) => void;
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

  // 6. Natural Imperfect Garden Street / Sandy Earth & Fine Gravel Park Lane (zero asphalt!)
  const asphalt = (() => {
    const [c, ctx] = makeCanvas(512, 512);
    ctx.fillStyle = '#9b876a';
    ctx.fillRect(0, 0, 512, 512);

    // Organic damp soil, sandy loam, and mossy moisture variation (wrapped seamlessly)
    for (let i = 0; i < 95; i++) {
      const x = (Math.sin(i * 43.1 + 0.3) * 0.5 + 0.5) * 512;
      const y = (Math.cos(i * 29.7 + 1.1) * 0.5 + 0.5) * 512;
      const r = 24 + (i % 6) * 16;
      const grad = ctx.createRadialGradient(x, y, 2, x, y, r);
      grad.addColorStop(
        0,
        i % 4 === 0
          ? 'rgba(122, 104, 78, 0.36)'
          : i % 4 === 1
            ? 'rgba(176, 156, 124, 0.32)'
            : i % 4 === 2
              ? 'rgba(92, 108, 62, 0.22)'
              : 'rgba(136, 118, 90, 0.28)'
      );
      grad.addColorStop(1, 'rgba(155, 135, 106, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Gentle meandering compacted footpath / worn earth tracks down the garden lane
    for (const baseX of [172, 338]) {
      const g = ctx.createLinearGradient(baseX - 42, 0, baseX + 42, 0);
      g.addColorStop(0, 'rgba(155, 135, 106, 0)');
      g.addColorStop(0.5, 'rgba(116, 98, 72, 0.38)');
      g.addColorStop(1, 'rgba(155, 135, 106, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(baseX - 42, 0, 84, 512);
    }

    // Organic grass/moss encroachment creeping in softly from left & right garden verges
    const leftEdge = ctx.createLinearGradient(0, 0, 62, 0);
    leftEdge.addColorStop(0, 'rgba(72, 104, 52, 0.72)');
    leftEdge.addColorStop(0.45, 'rgba(96, 122, 64, 0.32)');
    leftEdge.addColorStop(1, 'rgba(155, 135, 106, 0)');
    ctx.fillStyle = leftEdge;
    ctx.fillRect(0, 0, 62, 512);

    const rightEdge = ctx.createLinearGradient(450, 0, 512, 0);
    rightEdge.addColorStop(0, 'rgba(155, 135, 106, 0)');
    rightEdge.addColorStop(0.55, 'rgba(96, 122, 64, 0.32)');
    rightEdge.addColorStop(1, 'rgba(72, 104, 52, 0.72)');
    ctx.fillStyle = rightEdge;
    ctx.fillRect(450, 0, 62, 512);

    // Subtle grass & clover tufts along irregular shoulders
    for (let i = 0; i < 420; i++) {
      const side = i % 2 === 0 ? 0 : 1;
      const gx = side === 0 ? (Math.sin(i * 19.3) * 0.5 + 0.5) * 44 : 468 + (Math.cos(i * 23.7) * 0.5 + 0.5) * 44;
      const gy = (Math.sin(i * 67.1) * 0.5 + 0.5) * 512;
      ctx.strokeStyle = i % 3 === 0 ? 'rgba(66, 102, 42, 0.65)' : 'rgba(104, 138, 60, 0.52)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx + ((i % 5) - 2) * 1.4, gy - 5 - (i % 4));
      ctx.stroke();
    }

    // Scattered fine pebbles, sand grains, and fallen dry garden leaves
    for (let i = 0; i < 6500; i++) {
      const x = (Math.sin(i * 37.2 + 0.3) * 0.5 + 0.5) * 512;
      const y = (Math.cos(i * 61.9 + 0.7) * 0.5 + 0.5) * 512;
      if (i % 19 === 0) {
        // Small warm fallen leaf or river pebble
        ctx.fillStyle = i % 38 === 0 ? 'rgba(158, 118, 64, 0.55)' : 'rgba(198, 188, 170, 0.45)';
        ctx.beginPath();
        ctx.ellipse(x, y, 2.8, 1.8, i * 0.7, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle =
          i % 4 === 0
            ? 'rgba(220, 206, 182, 0.24)'
            : i % 3 === 0
              ? 'rgba(84, 68, 48, 0.22)'
              : 'rgba(176, 158, 130, 0.18)';
        ctx.fillRect(x, y, 1.8, 1.8);
      }
    }
    return track(finalizeTexture(c, aniso, 1, 7, true));
  })();

  const asphaltBump = (() => {
    const [c, ctx] = makeCanvas(512, 512);
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 6500; i++) {
      const x = (Math.sin(i * 37.2 + 0.3) * 0.5 + 0.5) * 512;
      const y = (Math.cos(i * 61.9 + 0.7) * 0.5 + 0.5) * 512;
      ctx.fillStyle = i % 2 === 0 ? '#a8a8a8' : '#585858';
      ctx.fillRect(x, y, i % 11 === 0 ? 2.8 : 1.8, i % 11 === 0 ? 2.8 : 1.8);
    }
    return track(finalizeTexture(c, aniso, 1, 7, false));
  })();

  // 7. Natural Weathered Garden Flagstone Walkway (warm irregular garden stones + earthy soil/moss joints)
  const sidewalk = (() => {
    const [c, ctx] = makeCanvas(512, 512);
    ctx.fillStyle = '#7c7564'; // Warm soil & moss joint base
    ctx.fillRect(0, 0, 512, 512);

    const rows = 5;
    const cols = 3;
    const rh = 512 / rows;
    const cw = 512 / cols;
    for (let r = 0; r < rows; r++) {
      const off = r % 2 === 0 ? 0 : cw * 0.42;
      for (let col = -1; col <= cols; col++) {
        const seed = r * 13 + col * 7;
        const jx = ((seed * 17) % 7) - 3;
        const jy = ((seed * 29) % 7) - 3;
        const shade = ((seed * 11) % 7) * 4 - 12;
        const sx = col * cw + off + 6 + jx;
        const sy = r * rh + 6 + jy;
        const sw = cw - 12 - (Math.abs(seed) % 5);
        const sh = rh - 12 - (Math.abs(seed * 3) % 5);

        ctx.fillStyle = `rgb(${182 + shade}, ${172 + shade}, ${152 + shade})`;
        ctx.beginPath();
        ctx.roundRect(sx, sy, sw, sh, 10);
        ctx.fill();

        // Subtle moss tint on stone edges
        if (Math.abs(seed) % 3 === 0) {
          ctx.strokeStyle = 'rgba(84, 114, 58, 0.35)';
          ctx.lineWidth = 3;
          ctx.stroke();
        }
      }
    }

    for (let i = 0; i < 2800; i++) {
      const x = (Math.sin(i * 23.4) * 0.5 + 0.5) * 512;
      const y = (Math.cos(i * 51.8) * 0.5 + 0.5) * 512;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,250,240,0.08)' : 'rgba(62,56,42,0.12)';
      ctx.fillRect(x, y, 2, 2);
    }
    return track(finalizeTexture(c, aniso, 1, 12, true));
  })();

  // 8. Rich architectural oak/teak wood grain with plank seams & knots
  const wood = (() => {
    const [c, ctx] = makeCanvas(256, 256);
    ctx.fillStyle = '#97633b';
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 3) {
      const wave = Math.sin(y * 0.14) * 6;
      ctx.fillStyle = y % 6 === 0 ? 'rgba(64, 32, 12, 0.24)' : 'rgba(198, 150, 102, 0.14)';
      ctx.fillRect(0, y, 256, 2);
      if (y % 48 === 0) {
        ctx.fillStyle = 'rgba(42, 20, 8, 0.34)';
        ctx.fillRect(0, y, 256, 2.2);
      }
      if (y % 29 === 0) {
        ctx.strokeStyle = 'rgba(58, 28, 10, 0.2)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.quadraticCurveTo(128, y + wave, 256, y);
        ctx.stroke();
      }
    }
    return track(finalizeTexture(c, aniso, 1, 1, true));
  })();

  // 8a. Deeply furrowed organic tree bark texture + companion normal-feel bump map
  const bark = (() => {
    const [c, ctx] = makeCanvas(512, 512);
    ctx.fillStyle = '#4e3523';
    ctx.fillRect(0, 0, 512, 512);
    // Vertical fibrous grain gradient streaks
    for (let i = 0; i < 420; i++) {
      const x = (Math.sin(i * 19.7 + 0.3) * 0.5 + 0.5) * 512;
      const y = (Math.cos(i * 31.1 + 0.9) * 0.5 + 0.5) * 512;
      const h = 42 + (i % 6) * 24;
      const w = 4 + (i % 4) * 2.5;
      ctx.fillStyle =
        i % 4 === 0
          ? 'rgba(28, 16, 9, 0.58)'
          : i % 4 === 1
            ? 'rgba(112, 84, 58, 0.42)'
            : i % 4 === 2
              ? 'rgba(72, 74, 46, 0.34)'
              : 'rgba(138, 110, 82, 0.24)';
      ctx.beginPath();
      ctx.ellipse(x, y, w * 0.6, h * 0.5, ((i % 3) - 1) * 0.04, 0, Math.PI * 2);
      ctx.fill();
    }
    // Fine horizontal bark lenticels & lichen flecks
    for (let i = 0; i < 90; i++) {
      const lx = (Math.sin(i * 53.3) * 0.5 + 0.5) * 512;
      const ly = (Math.cos(i * 17.9) * 0.5 + 0.5) * 512;
      ctx.fillStyle = i % 3 === 0 ? 'rgba(98, 122, 74, 0.28)' : 'rgba(24, 14, 8, 0.45)';
      ctx.fillRect(lx, ly, 8 + (i % 5) * 3, 2);
    }
    return track(finalizeTexture(c, aniso, 2, 3, true));
  })();

  const barkBump = (() => {
    const [c, ctx] = makeCanvas(256, 256);
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 320; i++) {
      const x = (Math.sin(i * 19.7 + 0.3) * 0.5 + 0.5) * 256;
      const y = (Math.cos(i * 31.1 + 0.9) * 0.5 + 0.5) * 256;
      const h = 22 + (i % 5) * 14;
      const w = 2 + (i % 3) * 1.6;
      ctx.fillStyle = i % 2 === 0 ? '#303030' : '#c8c8c8';
      ctx.fillRect(x, y, w, h);
    }
    return track(finalizeTexture(c, aniso, 2, 3, false));
  })();

  // 8a-bis. Paper birch silver-white bark with dark horizontal lenticel markings
  const birchBark = (() => {
    const [c, ctx] = makeCanvas(256, 256);
    ctx.fillStyle = '#ddd7ce';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 60; i++) {
      const y = (i * 13.7) % 256;
      const x = (Math.sin(i * 29.1) * 0.5 + 0.5) * 240;
      const len = 18 + (i % 5) * 12;
      ctx.fillStyle = i % 4 === 0 ? 'rgba(40, 34, 30, 0.78)' : 'rgba(72, 62, 54, 0.42)';
      ctx.beginPath();
      ctx.ellipse(x, y, len * 0.5, 2 + (i % 2), 0, 0, Math.PI * 2);
      ctx.fill();
    }
    return track(finalizeTexture(c, aniso, 1, 3, true));
  })();

  // Helper to paint realistic pointed leaf with central midrib & lateral veins
  const paintBotanicalLeaf = (
    ctx: CanvasRenderingContext2D,
    len: number,
    wid: number,
    baseCol: string,
    tipCol: string,
    veinCol: string
  ) => {
    const grad = ctx.createLinearGradient(-len, 0, len, 0);
    grad.addColorStop(0, baseCol);
    grad.addColorStop(1, tipCol);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-len, 0);
    ctx.quadraticCurveTo(0, -wid, len, 0);
    ctx.quadraticCurveTo(0, wid, -len, 0);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = veinCol;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(-len * 0.85, 0);
    ctx.lineTo(len * 0.82, 0);
    for (let v = -2; v <= 2; v++) {
      const vx = v * len * 0.24;
      ctx.moveTo(vx, 0);
      ctx.lineTo(vx + len * 0.14, -wid * 0.52);
      ctx.moveTo(vx, 0);
      ctx.lineTo(vx + len * 0.14, wid * 0.52);
    }
    ctx.stroke();
  };

  // 8ab. High-resolution alpha-cutout botanical oak/broadleaf spray texture (512x512 crisp pointed veined leaves)
  const leafFoliage = (() => {
    const [c, ctx] = makeCanvas(512, 512);
    ctx.clearRect(0, 0, 512, 512);
    const tones: Array<[string, string]> = [
      ['#224c1a', '#3a7229'],
      ['#2b5d20', '#4d8a35'],
      ['#366e28', '#63a342'],
      ['#1b3d14', '#2e5d21'],
      ['#41792c', '#74b349'],
    ];
    // Subtle twig stems inside the leaf spray cluster
    ctx.strokeStyle = 'rgba(72, 50, 32, 0.55)';
    ctx.lineWidth = 3;
    for (let b = 0; b < 5; b++) {
      const ba = (b / 5) * Math.PI * 2 + 0.3;
      ctx.beginPath();
      ctx.moveTo(256, 256);
      ctx.lineTo(256 + Math.cos(ba) * 145, 256 + Math.sin(ba) * 145);
      ctx.stroke();
    }
    for (let i = 0; i < 120; i++) {
      const a = i * 2.39996;
      const rad = Math.sqrt((i + 1) / 120) * 196;
      const lx = 256 + Math.cos(a) * rad;
      const ly = 256 + Math.sin(a) * rad;
      const lw = 24 + (i % 5) * 6;
      const lh = 13 + (i % 3) * 4;
      const [baseC, tipC] = tones[i % tones.length];
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(a + (i % 5) * 0.28);
      paintBotanicalLeaf(ctx, lw, lh, baseC, tipC, 'rgba(20, 44, 14, 0.35)');
      ctx.restore();
    }
    return track(finalizeTexture(c, aniso, 1, 1, true, true));
  })();

  // 8ac. Deep-green columnar cypress/pine needle scale spray texture (512x512)
  const cypressFoliage = (() => {
    const [c, ctx] = makeCanvas(512, 512);
    ctx.clearRect(0, 0, 512, 512);
    const tones = ['#1a3c24', '#214d2c', '#2a5f35', '#15311d', '#34713f'];
    for (let i = 0; i < 165; i++) {
      const a = i * 2.39996;
      const rad = Math.sqrt((i + 1) / 165) * 204;
      const lx = 256 + Math.cos(a) * rad;
      const ly = 256 + Math.sin(a) * rad;
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(-Math.PI / 2 + ((i % 7) - 3) * 0.18);
      ctx.fillStyle = tones[i % tones.length];
      ctx.beginPath();
      ctx.moveTo(0, -28 - (i % 3) * 6);
      ctx.quadraticCurveTo(10, 0, 3, 22);
      ctx.lineTo(-3, 22);
      ctx.quadraticCurveTo(-10, 0, 0, -28 - (i % 3) * 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    return track(finalizeTexture(c, aniso, 1, 1, true, true));
  })();

  // 8ad. Silvery Mediterranean olive-tree slender lanceolate leaf spray texture
  const oliveFoliage = (() => {
    const [c, ctx] = makeCanvas(512, 512);
    ctx.clearRect(0, 0, 512, 512);
    const tones: Array<[string, string]> = [
      ['#465c42', '#7d9375'],
      ['#556c50', '#96ab8e'],
      ['#3b4e38', '#687f62'],
      ['#637a5d', '#aec0a5'],
    ];
    for (let i = 0; i < 140; i++) {
      const a = i * 2.39996;
      const rad = Math.sqrt((i + 1) / 140) * 195;
      const lx = 256 + Math.cos(a) * rad;
      const ly = 256 + Math.sin(a) * rad;
      const [baseC, tipC] = tones[i % tones.length];
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(a + (i % 4) * 0.4);
      paintBotanicalLeaf(ctx, 28 + (i % 4) * 5, 7 + (i % 2) * 2.5, baseC, tipC, 'rgba(218, 228, 212, 0.35)');
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

  // 16. Ultra-lightweight downward architectural wall-wash cone & soft floor spill textures (0 GPU shader cost)
  const sconceWash = (() => {
    const [c, ctx] = makeCanvas(128, 128);
    ctx.clearRect(0, 0, 128, 128);
    const vGrad = ctx.createLinearGradient(0, 6, 0, 124);
    vGrad.addColorStop(0.0, 'rgba(255, 255, 255, 0.92)');
    vGrad.addColorStop(0.28, 'rgba(255, 255, 255, 0.56)');
    vGrad.addColorStop(0.7, 'rgba(255, 255, 255, 0.18)');
    vGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = vGrad;
    ctx.fillRect(0, 0, 128, 128);

    // Soft side edge vignette so beam widens gracefully downward without boxy edges
    ctx.globalCompositeOperation = 'destination-in';
    const hGrad = ctx.createRadialGradient(64, 24, 14, 64, 72, 62);
    hGrad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
    hGrad.addColorStop(0.6, 'rgba(255, 255, 255, 0.72)');
    hGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = hGrad;
    ctx.fillRect(0, 0, 128, 128);
    ctx.globalCompositeOperation = 'source-over';
    return track(finalizeTexture(c, 1, 1, 1, true, true));
  })();

  const sconcePool = (() => {
    const [c, ctx] = makeCanvas(64, 64);
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 31);
    g.addColorStop(0.0, 'rgba(255, 255, 255, 0.85)');
    g.addColorStop(0.45, 'rgba(255, 255, 255, 0.36)');
    g.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return track(finalizeTexture(c, 1, 1, 1, true, true));
  })();

  // 17. LG Dual Inverter modern AC dark display strip (LG logo + DUAL Inverter + glowing 22°C readout)
  const lgAcFront = (() => {
    const [c, ctx] = makeCanvas(512, 128);
    const bg = ctx.createLinearGradient(0, 0, 512, 128);
    bg.addColorStop(0, '#0f172a');
    bg.addColorStop(0.5, '#1e293b');
    bg.addColorStop(1, '#0b1322');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 128);

    // Subtle metallic top trim line
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(0, 0, 512, 4);

    // LG signature burgundy emblem circle
    ctx.fillStyle = '#a50034';
    ctx.beginPath();
    ctx.arc(62, 64, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(62, 64, 21, -Math.PI * 0.45, Math.PI * 1.15);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(62, 46);
    ctx.lineTo(62, 68);
    ctx.lineTo(76, 68);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(54, 56, 3.2, 0, Math.PI * 2);
    ctx.fill();

    // LG & DUAL Inverter text
    ctx.fillStyle = '#f8fafc';
    ctx.font = '800 32px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('LG', 104, 54);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 15px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('DUAL Inverter', 105, 84);

    // Right-side digital temperature LED window
    ctx.fillStyle = '#020617';
    ctx.beginPath();
    ctx.roundRect(356, 28, 122, 72, 12);
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = '800 36px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('22°C', 417, 65);

    ctx.fillStyle = '#34d399';
    ctx.beginPath();
    ctx.arc(332, 64, 5, 0, Math.PI * 2);
    ctx.fill();

    return track(finalizeTexture(c, aniso, 1, 1, true, true));
  })();

  // 18. Nesma evaporative water AC recessed honeycomb celdek cooling pad texture
  const nesmaPad = (() => {
    const [c, ctx] = makeCanvas(256, 256);
    ctx.fillStyle = '#4c3824';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#755739';
    ctx.lineWidth = 3;
    for (let i = -256; i < 512; i += 14) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 256, 256);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(i + 256, 0);
      ctx.lineTo(i, 256);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(14, 165, 233, 0.14)';
    ctx.fillRect(0, 0, 256, 256);
    return track(finalizeTexture(c, aniso, 2, 2, true));
  })();

  // 19. Nesma water AC front control/nameplate badge
  const nesmaBadge = (() => {
    const [c, ctx] = makeCanvas(256, 96);
    ctx.fillStyle = '#0f365c';
    ctx.fillRect(0, 0, 256, 96);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, 248, 88);
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 26px "Cairo", "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('NESMA · نسمة', 128, 36);
    ctx.fillStyle = '#7dd3fc';
    ctx.font = '700 14px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('HYDRO EVAPORATIVE COOLER', 128, 68);
    return track(finalizeTexture(c, aniso, 1, 1, true, true));
  })();

  // 20. High-efficiency half-cut monocrystalline photovoltaic solar panel texture
  const solarCell = (() => {
    const [c, ctx] = makeCanvas(512, 768);
    const w = 512;
    const h = 768;

    // Bright EVA/tedlar backsheet substrate visible cleanly between cells
    ctx.fillStyle = '#dce4ee';
    ctx.fillRect(0, 0, w, h);

    // Subtle dark outer anti-glare perimeter border inside frame
    ctx.fillStyle = '#091529';
    ctx.fillRect(4, 4, w - 8, h - 8);

    const cols = 6;
    const rows = 12;
    const padX = 12;
    const padY = 14;
    const midSplit = 10; // central horizontal half-cut string busbar zone
    const cellW = (w - padX * 2) / cols;
    const cellH = (h - padY * 2 - midSplit) / rows;
    const gap = 3.5;

    for (let r = 0; r < rows; r++) {
      const extraY = r >= rows / 2 ? midSplit : 0;
      for (let col = 0; col < cols; col++) {
        const x = padX + col * cellW;
        const y = padY + r * cellH + extraY;

        // Monocrystalline chamfered silicon wafer polygon
        const cx0 = x + gap * 0.5;
        const cy0 = y + gap * 0.5;
        const cw = cellW - gap;
        const ch = cellH - gap;
        const chf = 6;

        // Exposed white tedlar diamond backdrop under chamfer corners
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(cx0, cy0, cw, ch);

        const cellGrad = ctx.createLinearGradient(cx0, cy0, cx0 + cw, cy0 + ch);
        cellGrad.addColorStop(0, '#0a1f47');
        cellGrad.addColorStop(0.5, '#12336e');
        cellGrad.addColorStop(1, '#071734');
        ctx.fillStyle = cellGrad;
        ctx.beginPath();
        ctx.moveTo(cx0 + chf, cy0);
        ctx.lineTo(cx0 + cw - chf, cy0);
        ctx.lineTo(cx0 + cw, cy0 + chf);
        ctx.lineTo(cx0 + cw, cy0 + ch - chf);
        ctx.lineTo(cx0 + cw - chf, cy0 + ch);
        ctx.lineTo(cx0 + chf, cy0 + ch);
        ctx.lineTo(cx0, cy0 + ch - chf);
        ctx.lineTo(cx0, cy0 + chf);
        ctx.closePath();
        ctx.fill();

        // Subtle silicon collector fingers
        ctx.strokeStyle = 'rgba(148, 197, 255, 0.18)';
        ctx.lineWidth = 1;
        for (let f = 1; f <= 4; f++) {
          const fy = cy0 + (ch * f) / 5;
          ctx.beginPath();
          ctx.moveTo(cx0 + 2, fy);
          ctx.lineTo(cx0 + cw - 2, fy);
          ctx.stroke();
        }

        // 5 fine silver MBB (multi-busbar) ribbons per half-cut wafer
        ctx.fillStyle = 'rgba(226, 232, 240, 0.58)';
        for (let b = 1; b <= 5; b++) {
          const bx = cx0 + (cw * b) / 6;
          ctx.fillRect(bx - 0.6, cy0 + 1, 1.3, ch - 2);
        }
      }
    }

    // Center metallic string interconnect bar
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(padX, padY + (rows / 2) * cellH + 2, w - padX * 2, midSplit - 4);
    ctx.fillStyle = '#475569';
    ctx.fillRect(padX, padY + (rows / 2) * cellH + midSplit * 0.5 - 1, w - padX * 2, 2);

    // Subtle specular tempered-glass reflection gradient
    const sheen = ctx.createLinearGradient(0, 0, w, h * 0.62);
    sheen.addColorStop(0, 'rgba(186, 230, 253, 0.26)');
    sheen.addColorStop(0.4, 'rgba(186, 230, 253, 0.05)');
    sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, w, h);

    return track(finalizeTexture(c, aniso, 1, 1, true, true));
  })();

  // 21. Alpha-cutout feathery pinnate palm frond texture
  const palmFrond = (() => {
    const [c, ctx] = makeCanvas(256, 256);
    ctx.clearRect(0, 0, 256, 256);
    // Central rachis stem
    ctx.strokeStyle = '#658f36';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(128, 252);
    ctx.quadraticCurveTo(132, 130, 128, 12);
    ctx.stroke();

    // Pinnate leaflets radiating along both sides
    for (let i = 0; i < 22; i++) {
      const t = i / 21;
      const sy = 236 - t * 214;
      const len = Math.sin(Math.pow(t, 0.72) * Math.PI) * 102 + 16;
      for (const side of [-1, 1]) {
        const tipX = 128 + side * len;
        const tipY = sy - 26 - t * 14;
        const grad = ctx.createLinearGradient(128, sy, tipX, tipY);
        grad.addColorStop(0, '#2d5a24');
        grad.addColorStop(0.6, '#4c8532');
        grad.addColorStop(1, '#79ad46');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(128, sy - 3);
        ctx.quadraticCurveTo(128 + side * len * 0.5, sy - 16, tipX, tipY);
        ctx.quadraticCurveTo(128 + side * len * 0.48, sy - 4, 128, sy + 4);
        ctx.closePath();
        ctx.fill();
      }
    }
    return track(finalizeTexture(c, aniso, 1, 1, true, true));
  })();

  // 22. Alpha-cutout lush climbing rose & leaf card for flower beds, rose trellis, and arbor (512x512 crisp petals & veined foliage)
  const roseFoliage = (() => {
    const [c, ctx] = makeCanvas(512, 512);
    ctx.clearRect(0, 0, 512, 512);
    const leafTones: Array<[string, string]> = [
      ['#1f481b', '#38742c'],
      ['#2a5f22', '#4a8b38'],
      ['#36722a', '#5ca244'],
    ];
    for (let i = 0; i < 82; i++) {
      const a = i * 2.399;
      const rad = Math.sqrt((i + 1) / 82) * 190;
      const lx = 256 + Math.cos(a) * rad;
      const ly = 256 + Math.sin(a) * rad;
      const [bCol, tCol] = leafTones[i % leafTones.length];
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(a + 0.45);
      paintBotanicalLeaf(ctx, 26, 14, bCol, tCol, 'rgba(18, 42, 12, 0.38)');
      ctx.restore();
    }
    const roseShades = [
      ['#9f1239', '#e11d48', '#fda4af'],
      ['#be123c', '#fb7185', '#ffe4e6'],
      ['#b45309', '#f59e0b', '#fef3c7'],
      ['#a21caf', '#e879f9', '#fdf4ff'],
    ];
    for (let b = 0; b < 14; b++) {
      const ang = b * 2.399 + 0.4;
      const rad = 42 + Math.sqrt(b / 14) * 145;
      const bx = 256 + Math.cos(ang) * rad;
      const by = 256 + Math.sin(ang) * rad;
      const [outerCol, midCol, coreCol] = roseShades[b % roseShades.length];
      for (let p = 0; p < 6; p++) {
        const pa = (p / 6) * Math.PI * 2 + b;
        ctx.fillStyle = outerCol;
        ctx.beginPath();
        ctx.arc(bx + Math.cos(pa) * 15, by + Math.sin(pa) * 15, 14, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = midCol;
      ctx.beginPath();
      ctx.arc(bx, by, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = coreCol;
      ctx.beginPath();
      ctx.arc(bx - 2, by - 2, 6.5, 0, Math.PI * 2);
      ctx.fill();
    }
    return track(finalizeTexture(c, aniso, 1, 1, true, true));
  })();

  // 23. Alpha-cutout rich flowering courtyard & world blossom tree foliage card (512x512 veined leaves + delicate 5-petal blossoms)
  const blossomFoliage = (() => {
    const [c, ctx] = makeCanvas(512, 512);
    ctx.clearRect(0, 0, 512, 512);
    const leafTones: Array<[string, string]> = [
      ['#214b1e', '#37732c'],
      ['#2c6226', '#4c8e3a'],
      ['#3b7831', '#64a64a'],
      ['#468838', '#78ba57'],
    ];
    for (let i = 0; i < 110; i++) {
      const ang = i * 2.399;
      const rad = Math.sqrt(i / 110) * 194;
      const lx = 256 + Math.cos(ang) * rad;
      const ly = 256 + Math.sin(ang) * rad;
      const [bCol, tCol] = leafTones[i % leafTones.length];
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(ang + 0.6);
      paintBotanicalLeaf(ctx, 25, 13, bCol, tCol, 'rgba(18, 42, 12, 0.34)');
      ctx.restore();
    }
    // Delicate ivory-cream & blush blossoms with golden stamens nestled in outer canopy
    for (let k = 0; k < 20; k++) {
      const ang = k * 2.399 + 0.25;
      const rad = 52 + Math.sqrt(k / 20) * 145;
      const bx = 256 + Math.cos(ang) * rad;
      const by = 256 + Math.sin(ang) * rad;
      ctx.fillStyle = k % 3 === 0 ? '#fef3c7' : k % 3 === 1 ? '#ffe4e6' : '#ffffff';
      for (let p = 0; p < 5; p++) {
        const pa = (p / 5) * Math.PI * 2 + k;
        ctx.beginPath();
        ctx.arc(bx + Math.cos(pa) * 9.5, by + Math.sin(pa) * 9.5, 8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(bx, by, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    return track(finalizeTexture(c, aniso, 1, 1, true, true));
  })();

  // 24. Ultra-lightweight scenic display screen texture (256x128, cycling 3 relaxing landscapes at <=10Hz only when visible)
  const [screenCanvas, screenCtx] = makeCanvas(256, 128);
  const drawReceptionScreenFrame = (tSec: number) => {
    const w = 256;
    const h = 128;
    const sceneLen = 7.0;
    const totalCycle = sceneLen * 3;
    const cyc = ((tSec % totalCycle) + totalCycle) % totalCycle;
    const sceneIdx = Math.floor(cyc / sceneLen);
    const localT = cyc - sceneIdx * sceneLen;
    const phase = localT / sceneLen;

    if (sceneIdx === 0) {
      // Scene 0: Serene Coastal Cove & Gentle Waves
      const sky = screenCtx.createLinearGradient(0, 0, 0, 74);
      sky.addColorStop(0, '#0ea5e9');
      sky.addColorStop(0.55, '#7dd3fc');
      sky.addColorStop(1, '#fef3c7');
      screenCtx.fillStyle = sky;
      screenCtx.fillRect(0, 0, w, 74);

      // Soft sun glow
      const sunX = 192 + Math.sin(tSec * 0.25) * 14;
      const sunGlow = screenCtx.createRadialGradient(sunX, 34, 4, sunX, 34, 28);
      sunGlow.addColorStop(0, '#fffbeb');
      sunGlow.addColorStop(0.45, 'rgba(253,224,71,0.55)');
      sunGlow.addColorStop(1, 'rgba(253,224,71,0)');
      screenCtx.fillStyle = sunGlow;
      screenCtx.beginPath();
      screenCtx.arc(sunX, 34, 28, 0, Math.PI * 2);
      screenCtx.fill();

      // Drifting wispy clouds
      screenCtx.fillStyle = 'rgba(255,255,255,0.72)';
      const c1 = ((tSec * 9) % 290) - 30;
      const c2 = ((tSec * 6 + 130) % 290) - 30;
      screenCtx.beginPath();
      screenCtx.ellipse(c1, 24, 24, 8, 0, 0, Math.PI * 2);
      screenCtx.ellipse(c2, 42, 18, 6, 0, 0, Math.PI * 2);
      screenCtx.fill();

      // Ocean
      const sea = screenCtx.createLinearGradient(0, 72, 0, h);
      sea.addColorStop(0, '#0284c7');
      sea.addColorStop(1, '#0f766e');
      screenCtx.fillStyle = sea;
      screenCtx.fillRect(0, 72, w, h - 72);

      // Animated wave shimmer lines
      screenCtx.strokeStyle = 'rgba(186,230,253,0.45)';
      screenCtx.lineWidth = 2;
      for (let r = 0; r < 4; r++) {
        const y = 82 + r * 11;
        const shift = Math.sin(tSec * 1.8 + r * 1.4) * 12;
        screenCtx.beginPath();
        screenCtx.moveTo(0, y);
        screenCtx.quadraticCurveTo(64 + shift, y - 3, 128, y);
        screenCtx.quadraticCurveTo(192 - shift, y + 3, 256, y);
        screenCtx.stroke();
      }
    } else if (sceneIdx === 1) {
      // Scene 1: Emerald Alpine Valley & Misty Peaks
      const sky = screenCtx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#1e3a8a');
      sky.addColorStop(0.55, '#38bdf8');
      sky.addColorStop(1, '#bae6fd');
      screenCtx.fillStyle = sky;
      screenCtx.fillRect(0, 0, w, h);

      // Distant mountains
      screenCtx.fillStyle = '#3b6d8c';
      screenCtx.beginPath();
      screenCtx.moveTo(0, 82);
      screenCtx.lineTo(48, 38);
      screenCtx.lineTo(96, 70);
      screenCtx.lineTo(156, 28);
      screenCtx.lineTo(212, 66);
      screenCtx.lineTo(256, 44);
      screenCtx.lineTo(256, 128);
      screenCtx.lineTo(0, 128);
      screenCtx.closePath();
      screenCtx.fill();

      // Mid green hills
      screenCtx.fillStyle = '#15803d';
      screenCtx.beginPath();
      screenCtx.moveTo(0, 92);
      screenCtx.quadraticCurveTo(72, 66, 138, 86);
      screenCtx.quadraticCurveTo(198, 70, 256, 88);
      screenCtx.lineTo(256, 128);
      screenCtx.lineTo(0, 128);
      screenCtx.closePath();
      screenCtx.fill();

      // Shimmering river
      screenCtx.fillStyle = '#38bdf8';
      screenCtx.beginPath();
      screenCtx.moveTo(118, 86);
      screenCtx.quadraticCurveTo(148 + Math.sin(tSec * 1.4) * 6, 102, 86, 128);
      screenCtx.lineTo(136, 128);
      screenCtx.quadraticCurveTo(168, 102, 130, 86);
      screenCtx.closePath();
      screenCtx.fill();

      // Drifting mist ribbon
      const mistX = ((tSec * 11) % 280) - 40;
      screenCtx.fillStyle = 'rgba(255,255,255,0.34)';
      screenCtx.beginPath();
      screenCtx.ellipse(mistX, 68, 42, 7, 0, 0, Math.PI * 2);
      screenCtx.fill();
    } else {
      // Scene 2: Calm Sunset Oasis & Palms
      const sky = screenCtx.createLinearGradient(0, 0, 0, 84);
      sky.addColorStop(0, '#312e81');
      sky.addColorStop(0.5, '#db2777');
      sky.addColorStop(1, '#fbbf24');
      screenCtx.fillStyle = sky;
      screenCtx.fillRect(0, 0, w, 84);

      screenCtx.fillStyle = '#fde68a';
      screenCtx.beginPath();
      screenCtx.arc(128, 68, 18, 0, Math.PI * 2);
      screenCtx.fill();

      // Water reflection
      const water = screenCtx.createLinearGradient(0, 84, 0, h);
      water.addColorStop(0, '#9d174d');
      water.addColorStop(1, '#1e1b4b');
      screenCtx.fillStyle = water;
      screenCtx.fillRect(0, 84, w, h - 84);

      screenCtx.fillStyle = 'rgba(253,224,71,0.5)';
      for (let i = 0; i < 4; i++) {
        const wLen = 28 - i * 5 + Math.sin(tSec * 2.5 + i) * 4;
        screenCtx.fillRect(128 - wLen / 2, 89 + i * 8, wLen, 2.5);
      }

      // Silhouette hill + swaying palm fronds
      screenCtx.fillStyle = '#0f172a';
      screenCtx.beginPath();
      screenCtx.moveTo(0, 96);
      screenCtx.quadraticCurveTo(44, 78, 86, 94);
      screenCtx.lineTo(86, 128);
      screenCtx.lineTo(0, 128);
      screenCtx.closePath();
      screenCtx.fill();

      const sway = Math.sin(tSec * 1.4) * 3;
      screenCtx.strokeStyle = '#0f172a';
      screenCtx.lineWidth = 3.5;
      screenCtx.beginPath();
      screenCtx.moveTo(42, 88);
      screenCtx.quadraticCurveTo(46, 62, 52 + sway, 46);
      screenCtx.stroke();
      for (let f = -2; f <= 2; f++) {
        screenCtx.lineWidth = 2;
        screenCtx.beginPath();
        screenCtx.moveTo(52 + sway, 46);
        screenCtx.quadraticCurveTo(52 + sway + f * 9, 40, 52 + sway + f * 13, 52 + Math.abs(f) * 2);
        screenCtx.stroke();
      }
    }

    // Subtle clinic top-right wellness badge & soft fade vignette
    screenCtx.fillStyle = 'rgba(15, 23, 42, 0.54)';
    screenCtx.fillRect(8, 8, 86, 16);
    screenCtx.fillStyle = '#38bdf8';
    screenCtx.fillRect(8, 8, 3, 16);
    screenCtx.fillStyle = '#f8fafc';
    screenCtx.font = 'bold 9px sans-serif';
    screenCtx.fillText('THERASON WELLNESS', 14, 19);

    // Subtle bottom playback progress bar
    screenCtx.fillStyle = 'rgba(15, 23, 42, 0.45)';
    screenCtx.fillRect(0, h - 4, w, 4);
    screenCtx.fillStyle = '#38bdf8';
    screenCtx.fillRect(0, h - 4, Math.max(4, w * phase), 4);
  };
  drawReceptionScreenFrame(0);
  const receptionScreen = track(finalizeTexture(screenCanvas, aniso, 1, 1, true, true));
  receptionScreen.generateMipmaps = false;
  receptionScreen.minFilter = THREE.LinearFilter;
  receptionScreen.magFilter = THREE.LinearFilter;
  let lastScreenBucket = -1;
  const updateReceptionScreen = (tSec: number) => {
    const bucket = Math.floor(tSec * 10);
    if (bucket === lastScreenBucket) return;
    lastScreenBucket = bucket;
    drawReceptionScreenFrame(tSec);
    receptionScreen.needsUpdate = true;
  };

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
    barkBump,
    birchBark,
    leafFoliage,
    cypressFoliage,
    oliveFoliage,
    roofShingle,
    stuccoBump,
    contactShadow,
    therasonWall,
    therasonMonument,
    therasonFacadeSign,
    anatomyPoster,
    ecgScreen,
    certificateFrame,
    sconceWash,
    sconcePool,
    lgAcFront,
    nesmaPad,
    nesmaBadge,
    solarCell,
    palmFrond,
    roseFoliage,
    blossomFoliage,
    receptionScreen,
    updateReceptionScreen,
    dispose: () => {
      created.forEach((t) => t.dispose());
    },
  };
}
