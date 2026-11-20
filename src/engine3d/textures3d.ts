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
  woodBump: THREE.CanvasTexture;
  bark: THREE.CanvasTexture;
  barkBump: THREE.CanvasTexture;
  birchBark: THREE.CanvasTexture;
  leafFoliage: THREE.CanvasTexture;
  cypressFoliage: THREE.CanvasTexture;
  oliveFoliage: THREE.CanvasTexture;
  roofShingle: THREE.CanvasTexture;
  plasterAlbedo: THREE.CanvasTexture;
  stuccoBump: THREE.CanvasTexture;
  plasterRough: THREE.CanvasTexture;
  wainscotAlbedo: THREE.CanvasTexture;
  wainscotBump: THREE.CanvasTexture;
  brushedMetalBump: THREE.CanvasTexture;
  fabricWeaveBump: THREE.CanvasTexture;
  leatherBump: THREE.CanvasTexture;
  skinMicroMap: THREE.CanvasTexture;
  skinRoughMap: THREE.CanvasTexture;
  waterNormal: THREE.CanvasTexture;
  rugPattern: THREE.CanvasTexture;
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

  // 1. Honed natural porcelain marble clinic tile with realistic veining, micro-flecks & beveled grout joints
  const tileBlue = (() => {
    const [c, ctx] = makeCanvas(512, 512);
    ctx.fillStyle = '#dde4ec';
    ctx.fillRect(0, 0, 512, 512);
    const tileTones = ['#d8e1eb', '#e2e8f0', '#d2dce7', '#dce4ee'];
    const rects: Array<[number, number]> = [
      [0, 0],
      [256, 0],
      [0, 256],
      [256, 256],
    ];
    rects.forEach(([rx, ry], ti) => {
      ctx.fillStyle = tileTones[ti];
      ctx.fillRect(rx, ry, 256, 256);

      // Subtle mineral gradient per slab
      const g = ctx.createLinearGradient(rx, ry, rx + 256, ry + 256);
      g.addColorStop(0, 'rgba(255,255,255,0.14)');
      g.addColorStop(0.5, 'rgba(180,198,216,0.04)');
      g.addColorStop(1, 'rgba(120,145,170,0.12)');
      ctx.fillStyle = g;
      ctx.fillRect(rx, ry, 256, 256);

      // Multi-layered delicate marble veining unique per tile
      for (let v = 0; v < 6; v++) {
        ctx.strokeStyle = v % 2 === 0 ? 'rgba(110, 140, 168, 0.22)' : 'rgba(255, 255, 255, 0.28)';
        ctx.lineWidth = v % 3 === 0 ? 2.4 : 1.1;
        ctx.beginPath();
        const sy = ry + ((v * 43 + ti * 37) % 230) + 12;
        ctx.moveTo(rx + 4, sy);
        ctx.bezierCurveTo(
          rx + 85,
          sy + ((v + ti) % 2 === 0 ? 26 : -22),
          rx + 170,
          sy + ((v + ti) % 2 === 0 ? -18 : 24),
          rx + 252,
          sy + 8
        );
        ctx.stroke();
      }
      // Micro bevel highlight inside grout
      ctx.strokeStyle = 'rgba(255,255,255,0.34)';
      ctx.lineWidth = 2;
      ctx.strokeRect(rx + 4, ry + 4, 248, 248);
    });

    // Recessed cement grout lines
    ctx.strokeStyle = '#9db0bf';
    ctx.lineWidth = 4;
    for (const [rx, ry] of rects) {
      ctx.strokeRect(rx + 2, ry + 2, 252, 252);
    }
    return track(finalizeTexture(c, aniso, 1, 1, true));
  })();

  // Roughness map for tile (honed glossy stone face = 0.16–0.24 with subtle mineral variation, matte grout = 0.78)
  const tileBlueRough = (() => {
    const [c, ctx] = makeCanvas(256, 256);
    ctx.fillStyle = '#323232';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 420; i++) {
      const x = (Math.sin(i * 31.7) * 0.5 + 0.5) * 256;
      const y = (Math.cos(i * 47.3) * 0.5 + 0.5) * 256;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(65,65,65,0.28)' : 'rgba(28,28,28,0.28)';
      ctx.beginPath();
      ctx.ellipse(x, y, 10 + (i % 8), 5 + (i % 5), i * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#d0d0d0';
    ctx.lineWidth = 5;
    ctx.strokeRect(2.5, 2.5, 123, 123);
    ctx.strokeRect(130.5, 2.5, 123, 123);
    ctx.strokeRect(2.5, 130.5, 123, 123);
    ctx.strokeRect(130.5, 130.5, 123, 123);
    return track(finalizeTexture(c, aniso, 1, 1, false));
  })();

  const tileBump = (() => {
    const [c, ctx] = makeCanvas(256, 256);
    ctx.fillStyle = '#ececec';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#c8c8c8';
    ctx.lineWidth = 3;
    ctx.strokeRect(5, 5, 118, 118);
    ctx.strokeRect(133, 5, 118, 118);
    ctx.strokeRect(5, 133, 118, 118);
    ctx.strokeRect(133, 133, 118, 118);
    ctx.strokeStyle = '#484848';
    ctx.lineWidth = 5;
    ctx.strokeRect(2.5, 2.5, 123, 123);
    ctx.strokeRect(130.5, 2.5, 123, 123);
    ctx.strokeRect(2.5, 130.5, 123, 123);
    ctx.strokeRect(130.5, 130.5, 123, 123);
    return track(finalizeTexture(c, aniso, 1, 1, false));
  })();

  // 2. Authentic speckled EPDM athletic gym flooring with interlocking tile seams
  const gymRoyal = (() => {
    const [c, ctx] = makeCanvas(512, 512);
    ctx.fillStyle = '#1f3f6c';
    ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = '#254b80';
    ctx.fillRect(2, 2, 252, 252);
    ctx.fillRect(258, 258, 252, 252);
    for (let i = 0; i < 2400; i++) {
      const rx = (Math.sin(i * 19.3) * 0.5 + 0.5) * 512;
      const ry = (Math.cos(i * 41.7) * 0.5 + 0.5) * 512;
      ctx.fillStyle =
        i % 5 === 0
          ? 'rgba(186,230,253,0.28)'
          : i % 3 === 0
            ? 'rgba(56,189,248,0.18)'
            : 'rgba(10,18,34,0.28)';
      ctx.fillRect(rx, ry, 2.4, 2.4);
    }
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.45)';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, 253, 253);
    ctx.strokeRect(257.5, 257.5, 253, 253);
    return track(finalizeTexture(c, aniso, 1, 1, true));
  })();

  // 3. Natural sage-mint honed clinical terrazzo/porcelain stone tile
  const tileMint = (() => {
    const [c, ctx] = makeCanvas(512, 512);
    ctx.fillStyle = '#cde0da';
    ctx.fillRect(0, 0, 512, 512);
    const mintTones = ['#c4d9d2', '#d2e4de', '#bfd4cd', '#cde0da'];
    [
      [0, 0],
      [256, 0],
      [0, 256],
      [256, 256],
    ].forEach(([rx, ry], ti) => {
      ctx.fillStyle = mintTones[ti];
      ctx.fillRect(rx, ry, 256, 256);
      for (let v = 0; v < 5; v++) {
        ctx.strokeStyle = v % 2 === 0 ? 'rgba(92, 138, 126, 0.2)' : 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        const sy = ry + ((v * 47 + ti * 29) % 220) + 16;
        ctx.moveTo(rx + 4, sy);
        ctx.bezierCurveTo(rx + 90, sy + 18, rx + 170, sy - 16, rx + 252, sy + 6);
        ctx.stroke();
      }
    });
    for (let i = 0; i < 420; i++) {
      const fx = (Math.sin(i * 37.9) * 0.5 + 0.5) * 512;
      const fy = (Math.cos(i * 23.1) * 0.5 + 0.5) * 512;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.18)' : 'rgba(72,108,98,0.16)';
      ctx.fillRect(fx, fy, 2.2, 2.2);
    }
    ctx.strokeStyle = '#92b2a9';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 252, 252);
    ctx.strokeRect(258, 2, 252, 252);
    ctx.strokeRect(2, 258, 252, 252);
    ctx.strokeRect(258, 258, 252, 252);
    return track(finalizeTexture(c, aniso, 1, 1, true));
  })();

  // 4. Weathered courtyard travertine stone pavers with pitting & realistic mortar + bump
  const courtyardPaver = (() => {
    const [c, ctx] = makeCanvas(512, 512);
    ctx.fillStyle = '#9b8f80';
    ctx.fillRect(0, 0, 512, 512);
    const cols = 4;
    const rows = 4;
    const cw = 512 / cols;
    const ch = 512 / rows;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const offset = y % 2 === 0 ? 0 : cw * 0.5;
        const shade = ((x * 7 + y * 13) % 7) * 4 - 12;
        const px = ((x * cw + offset) % 512) + 3;
        const py = y * ch + 3;
        ctx.fillStyle = `rgb(${194 + shade}, ${182 + shade}, ${166 + shade})`;
        ctx.fillRect(px, py, cw - 6, ch - 6);
        // Subtle natural travertine edge highlight & mineral pitting
        ctx.strokeStyle = 'rgba(255, 248, 238, 0.25)';
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 1, py + 1, cw - 8, ch - 8);
      }
    }
    for (let i = 0; i < 1800; i++) {
      const px = (Math.sin(i * 41.3) * 0.5 + 0.5) * 512;
      const py = (Math.cos(i * 19.7) * 0.5 + 0.5) * 512;
      ctx.fillStyle = i % 3 === 0 ? 'rgba(92, 80, 68, 0.16)' : 'rgba(248, 240, 226, 0.14)';
      ctx.fillRect(px, py, 2.5, 1.8);
    }
    return track(finalizeTexture(c, aniso, 1, 1, true));
  })();

  const paverBump = (() => {
    const [c, ctx] = makeCanvas(512, 512);
    ctx.fillStyle = '#484848';
    ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = '#dedede';
    const cw = 128;
    const ch = 128;
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const offset = y % 2 === 0 ? 0 : cw * 0.5;
        ctx.fillRect(((x * cw + offset) % 512) + 3, y * ch + 3, cw - 6, ch - 6);
      }
    }
    for (let i = 0; i < 1400; i++) {
      const px = (Math.sin(i * 41.3) * 0.5 + 0.5) * 512;
      const py = (Math.cos(i * 19.7) * 0.5 + 0.5) * 512;
      ctx.fillStyle = i % 2 === 0 ? '#bcbcbc' : '#f2f2f2';
      ctx.fillRect(px, py, 2.5, 2);
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

  // 8. Rich architectural oak/teak wood grain with plank seams, cathedral rings, and bump map
  const wood = (() => {
    const [c, ctx] = makeCanvas(512, 512);
    ctx.fillStyle = '#97633b';
    ctx.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 512; y += 2) {
      const plankBand = Math.floor(y / 64);
      const toneShift = ((plankBand * 17) % 5) * 4 - 8;
      ctx.fillStyle = `rgb(${150 + toneShift}, ${99 + Math.round(toneShift * 0.7)}, ${59 + Math.round(toneShift * 0.5)})`;
      ctx.fillRect(0, y, 512, 2);
      const wave = Math.sin(y * 0.08 + plankBand * 1.3) * 8;
      if (y % 6 === 0) {
        ctx.fillStyle = 'rgba(58, 28, 10, 0.18)';
        ctx.fillRect(0, y, 512, 1.5);
      }
      if (y % 64 === 0) {
        ctx.fillStyle = 'rgba(38, 18, 6, 0.42)';
        ctx.fillRect(0, y, 512, 2.5);
      }
      if (y % 22 === 0) {
        ctx.strokeStyle = 'rgba(64, 30, 10, 0.22)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(160, y + wave, 340, y - wave * 0.8, 512, y);
        ctx.stroke();
      }
    }
    // Subtle wood knots
    for (const [kx, ky, kr] of [
      [142, 96, 12],
      [374, 288, 10],
      [218, 416, 14],
    ]) {
      const kGrad = ctx.createRadialGradient(kx, ky, 1, kx, ky, kr);
      kGrad.addColorStop(0, 'rgba(42, 20, 8, 0.55)');
      kGrad.addColorStop(0.6, 'rgba(72, 38, 16, 0.28)');
      kGrad.addColorStop(1, 'rgba(151, 99, 59, 0)');
      ctx.fillStyle = kGrad;
      ctx.beginPath();
      ctx.ellipse(kx, ky, kr * 1.5, kr * 0.7, 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
    return track(finalizeTexture(c, aniso, 1, 1, true));
  })();

  const woodBump = (() => {
    const [c, ctx] = makeCanvas(256, 256);
    ctx.fillStyle = '#888888';
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 2) {
      ctx.fillStyle = y % 6 === 0 ? '#747474' : '#969696';
      ctx.fillRect(0, y, 256, 1.5);
      if (y % 32 === 0) {
        ctx.fillStyle = '#404040';
        ctx.fillRect(0, y, 256, 2);
      }
    }
    return track(finalizeTexture(c, aniso, 1, 1, false));
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

  // 9. Multi-layered architectural plaster & stucco PBR set (albedo + bump + roughness)
  const plasterAlbedo = (() => {
    const [c, ctx] = makeCanvas(512, 512);
    ctx.fillStyle = '#dcd6cb';
    ctx.fillRect(0, 0, 512, 512);
    // Soft multi-scale trowel mottling
    for (let i = 0; i < 160; i++) {
      const px = (Math.sin(i * 29.7 + 0.3) * 0.5 + 0.5) * 512;
      const py = (Math.cos(i * 41.3 + 0.9) * 0.5 + 0.5) * 512;
      const r = 24 + (i % 6) * 16;
      const g = ctx.createRadialGradient(px, py, 2, px, py, r);
      g.addColorStop(0, i % 2 === 0 ? 'rgba(248, 245, 240, 0.16)' : 'rgba(186, 178, 165, 0.16)');
      g.addColorStop(1, 'rgba(220, 214, 203, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 3200; i++) {
      const x = (Math.sin(i * 17.1) * 0.5 + 0.5) * 512;
      const y = (Math.cos(i * 53.7) * 0.5 + 0.5) * 512;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,252,245,0.09)' : 'rgba(130,122,110,0.09)';
      ctx.fillRect(x, y, 2, 2);
    }
    return track(finalizeTexture(c, aniso, 3, 2, true));
  })();

  const stuccoBump = (() => {
    const [c, ctx] = makeCanvas(512, 512);
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 90; i++) {
      const px = (Math.sin(i * 23.1) * 0.5 + 0.5) * 512;
      const py = (Math.cos(i * 37.9) * 0.5 + 0.5) * 512;
      const r = 20 + (i % 5) * 14;
      const g = ctx.createRadialGradient(px, py, 2, px, py, r);
      g.addColorStop(0, i % 2 === 0 ? 'rgba(155,155,155,0.22)' : 'rgba(105,105,105,0.22)');
      g.addColorStop(1, 'rgba(128,128,128,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 6200; i++) {
      const x = (Math.sin(i * 17.1) * 0.5 + 0.5) * 512;
      const y = (Math.cos(i * 53.7) * 0.5 + 0.5) * 512;
      ctx.fillStyle = i % 2 === 0 ? '#9c9c9c' : '#646464';
      ctx.fillRect(x, y, 2, 2);
    }
    return track(finalizeTexture(c, aniso, 3, 2, false));
  })();

  const plasterRough = (() => {
    const [c, ctx] = makeCanvas(256, 256);
    ctx.fillStyle = '#dadada';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 180; i++) {
      const x = (Math.sin(i * 27.4) * 0.5 + 0.5) * 256;
      const y = (Math.cos(i * 19.8) * 0.5 + 0.5) * 256;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(242,242,242,0.3)' : 'rgba(195,195,195,0.3)';
      ctx.beginPath();
      ctx.arc(x, y, 10 + (i % 6) * 4, 0, Math.PI * 2);
      ctx.fill();
    }
    return track(finalizeTexture(c, aniso, 3, 2, false));
  })();

  // 9b. Architectural clinic acoustic wainscot wall paneling (albedo + vertical seam bump)
  const wainscotAlbedo = (() => {
    const [c, ctx] = makeCanvas(256, 256);
    ctx.fillStyle = '#205b86';
    ctx.fillRect(0, 0, 256, 256);
    const panels = 4;
    const pw = 256 / panels;
    for (let p = 0; p < panels; p++) {
      const px = p * pw;
      const g = ctx.createLinearGradient(px, 0, px + pw, 0);
      g.addColorStop(0, '#19496d');
      g.addColorStop(0.08, '#266898');
      g.addColorStop(0.92, '#215d89');
      g.addColorStop(1, '#143b58');
      ctx.fillStyle = g;
      ctx.fillRect(px, 0, pw, 256);
    }
    // Subtle matte finish micro-grain
    for (let i = 0; i < 1400; i++) {
      const x = (Math.sin(i * 17.7) * 0.5 + 0.5) * 256;
      const y = (Math.cos(i * 43.3) * 0.5 + 0.5) * 256;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)';
      ctx.fillRect(x, y, 2, 2);
    }
    return track(finalizeTexture(c, aniso, 3, 1, true));
  })();

  const wainscotBump = (() => {
    const [c, ctx] = makeCanvas(256, 256);
    ctx.fillStyle = '#dcdcdc';
    ctx.fillRect(0, 0, 256, 256);
    const pw = 64;
    for (let p = 0; p < 4; p++) {
      ctx.fillStyle = '#404040';
      ctx.fillRect(p * pw, 0, 3, 256);
      ctx.fillStyle = '#f2f2f2';
      ctx.fillRect(p * pw + 3, 0, 2, 256);
    }
    return track(finalizeTexture(c, aniso, 3, 1, false));
  })();

  // 9c. Brushed stainless / anodized aluminum directional streaks bump
  const brushedMetalBump = (() => {
    const [c, ctx] = makeCanvas(256, 256);
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 1) {
      const v = 112 + ((Math.sin(y * 13.7) * 0.5 + 0.5) * 32) | 0;
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(0, y, 256, 1);
    }
    return track(finalizeTexture(c, aniso, 2, 2, false));
  })();

  // 9d. Fine woven cotton/linen/crepe textile weave bump (for people's garments, curtains, cushions)
  const fabricWeaveBump = (() => {
    const [c, ctx] = makeCanvas(256, 256);
    ctx.fillStyle = '#7e7e7e';
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 4) {
      ctx.fillStyle = 'rgba(220,220,220,0.32)';
      ctx.fillRect(0, y, 256, 2);
    }
    for (let x = 0; x < 256; x += 4) {
      ctx.fillStyle = 'rgba(60,60,60,0.28)';
      ctx.fillRect(x, 0, 2, 256);
    }
    return track(finalizeTexture(c, aniso, 5, 5, false));
  })();

  // 9e. Pebbled medical vinyl / upholstery leather bump
  const leatherBump = (() => {
    const [c, ctx] = makeCanvas(256, 256);
    ctx.fillStyle = '#787878';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1800; i++) {
      const x = (Math.sin(i * 31.3 + 0.2) * 0.5 + 0.5) * 256;
      const y = (Math.cos(i * 47.7 + 0.8) * 0.5 + 0.5) * 256;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(210,210,210,0.34)' : 'rgba(52,52,52,0.34)';
      ctx.beginPath();
      ctx.arc(x, y, 2 + (i % 2), 0, Math.PI * 2);
      ctx.fill();
    }
    return track(finalizeTexture(c, aniso, 4, 4, false));
  })();

  // 9f. Natural human skin micro-pore / warmth variation + roughness map
  const skinMicroMap = (() => {
    const [c, ctx] = makeCanvas(256, 256);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 90; i++) {
      const x = (Math.sin(i * 19.1) * 0.5 + 0.5) * 256;
      const y = (Math.cos(i * 37.3) * 0.5 + 0.5) * 256;
      const g = ctx.createRadialGradient(x, y, 2, x, y, 28);
      g.addColorStop(0, i % 2 === 0 ? 'rgba(255, 224, 214, 0.26)' : 'rgba(238, 214, 200, 0.22)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, 28, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 1200; i++) {
      const x = (Math.sin(i * 63.7) * 0.5 + 0.5) * 256;
      const y = (Math.cos(i * 29.1) * 0.5 + 0.5) * 256;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(235, 195, 180, 0.14)' : 'rgba(255, 245, 240, 0.12)';
      ctx.fillRect(x, y, 1.5, 1.5);
    }
    return track(finalizeTexture(c, aniso, 2, 2, true));
  })();

  const skinRoughMap = (() => {
    const [c, ctx] = makeCanvas(256, 256);
    ctx.fillStyle = '#929292'; // ~0.57 natural semi-matte skin
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 120; i++) {
      const x = (Math.sin(i * 23.3) * 0.5 + 0.5) * 256;
      const y = (Math.cos(i * 41.9) * 0.5 + 0.5) * 256;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(122,122,122,0.35)' : 'rgba(164,164,164,0.35)';
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.fill();
    }
    return track(finalizeTexture(c, aniso, 2, 2, false));
  })();

  // 9g. Seamless multi-octave water ripple normal map
  const waterNormal = (() => {
    const size = 256;
    const [c, ctx] = makeCanvas(size, size);
    const img = ctx.createImageData(size, size);
    const data = img.data;
    const hAt = (x: number, y: number) => {
      const u = (x / size) * Math.PI * 2;
      const v = (y / size) * Math.PI * 2;
      return (
        Math.sin(u * 3 + v * 2) * 0.35 +
        Math.cos(u * 5 - v * 4) * 0.25 +
        Math.sin(u * 9 + v * 7) * 0.16 +
        Math.cos(u * 13 - v * 11) * 0.08
      );
    };
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = hAt(x + 1, y) - hAt(x - 1, y);
        const dy = hAt(x, y + 1) - hAt(x, y - 1);
        const nx = -dx * 1.4;
        const ny = -dy * 1.4;
        const nz = 1.0;
        const inv = 1 / Math.hypot(nx, ny, nz);
        const idx = (y * size + x) * 4;
        data[idx] = Math.round((nx * inv * 0.5 + 0.5) * 255);
        data[idx + 1] = Math.round((ny * inv * 0.5 + 0.5) * 255);
        data[idx + 2] = Math.round((nz * inv * 0.5 + 0.5) * 255);
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return track(finalizeTexture(c, aniso, 2, 2, false));
  })();

  // 9h. Woven clinical reception rug pattern
  const rugPattern = (() => {
    const [c, ctx] = makeCanvas(512, 256);
    ctx.fillStyle = '#1b3b5c';
    ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = '#dbe4ee';
    ctx.fillRect(18, 16, 476, 224);
    ctx.fillStyle = '#0f6a82';
    ctx.fillRect(36, 30, 440, 196);
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.35)';
    ctx.lineWidth = 4;
    ctx.strokeRect(52, 42, 408, 172);
    // Subtle diamond geometric weave
    ctx.strokeStyle = 'rgba(186, 230, 253, 0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(256, 62);
    ctx.lineTo(340, 128);
    ctx.lineTo(256, 194);
    ctx.lineTo(172, 128);
    ctx.closePath();
    ctx.stroke();
    // Woven yarn texture overlay
    for (let y = 0; y < 256; y += 3) {
      ctx.fillStyle = y % 6 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)';
      ctx.fillRect(0, y, 512, 1.5);
    }
    return track(finalizeTexture(c, aniso, 1, 1, true, true));
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

  // 11. Reception back wall THERASON architectural panel (clean matte high-contrast print, zero glare)
  const therasonWall = (() => {
    const [c, ctx] = makeCanvas(1536, 420);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 1536, 420);

    // Simple clean architectural border & cyan accent rule
    ctx.strokeStyle = '#0f294a';
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, 1516, 400);

    ctx.fillStyle = '#0284c7';
    ctx.fillRect(36, 354, 1464, 14);

    // Clean emblem without glowing halo
    drawTherasonMark(ctx, 195, 195, 3.6, '#0284c7', '#16a34a');

    // Bold high-contrast THERASON lettering (no shadowBlur/glow)
    ctx.fillStyle = '#0b223e';
    ctx.font = '900 132px "Plus Jakarta Sans", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const word = 'THERASON';
    let cursorX = 330;
    for (let i = 0; i < word.length; i++) {
      const ch = word[i];
      ctx.fillText(ch, cursorX, 162);
      cursorX += ctx.measureText(ch).width + 12;
    }

    // Simple crisp subtitle
    ctx.fillStyle = '#334155';
    ctx.font = '700 36px "Plus Jakarta Sans", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('CLINICAL REHAB & SPORTS CARE', 336, 278);

    const tex = track(finalizeTexture(c, aniso, 1, 1, true, true));
    tex.generateMipmaps = true;
    return tex;
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

  // 24. Continuous 16:9 Live TV News Broadcast display texture (512x288, animated studio anchor, broadcast graphics, lower-third & seamless scrolling ticker)
  const [screenCanvas, screenCtx] = makeCanvas(512, 288);
  screenCtx.direction = 'ltr';
  const newsSegments = [
    {
      tag: 'عاجل • صحة',
      headline: 'توسع مراكز التأهيل والعلاج الطبيعي باستخدام التقنيات الحديثة',
      sub: 'THERASON NEWS • GLOBAL REHAB & SPORTS MEDICINE REPORT',
      kind: 'map' as const,
    },
    {
      tag: 'نشرة الطب',
      headline: 'بروتوكولات العلاج الحركي ترفع نسب التعافي بنسبة 34% هذا العام',
      sub: 'CLINICAL OUTCOMES • PHYSIOTHERAPY & NEURO-REHAB',
      kind: 'chart' as const,
    },
    {
      tag: 'طب الرياضة',
      headline: 'برنامج متكامل لإعادة تأهيل إصابات الملاعب والعمود الفقري',
      sub: 'SPORTS RECOVERY • BIOMECHANICS & GAIT LAB LIVE',
      kind: 'gait' as const,
    },
    {
      tag: 'النشرة الجوية',
      headline: 'أجواء معتدلة اليوم — نصائح طبية بالحركة المستمرة وشرب الماء',
      sub: 'DAILY BRIEFING • HEALTH & WELLNESS FORECAST 29°C',
      kind: 'weather' as const,
    },
  ];
  const newsTickerText =
    '◆ عاجل: افتتاح أجنحة علاجية متطورة للعلاج الطبيعي وإصابات الملاعب   ◆ دراسة طبية: التمارين الموجهة تقلل آلام الظهر المزمنة بشكل ملحوظ   ◆ متابعة حية: أحدث أجهزة الشد الفقري والعلاج المغناطيسي تدخل الخدمة   ◆ نصيحة اليوم: الحفاظ على الجلوس السليم وشرب الماء يحسن صحة المفاصل   ';
  screenCtx.font = 'bold 14px "Cairo", sans-serif';
  const newsTickerSpan = Math.max(600, screenCtx.measureText(newsTickerText).width);

  const drawReceptionScreenFrame = (tSec: number) => {
    const w = 512;
    const h = 288;
    const segLen = 6.5;
    const totalCycle = segLen * newsSegments.length;
    const cyc = ((tSec % totalCycle) + totalCycle) % totalCycle;
    const segIdx = Math.floor(cyc / segLen);
    const localT = cyc - segIdx * segLen;
    const seg = newsSegments[segIdx];

    // 1. Deep broadcast studio gradient background + subtle glowing studio vertical ribs
    const studioBg = screenCtx.createLinearGradient(0, 0, w, h);
    studioBg.addColorStop(0, '#06152b');
    studioBg.addColorStop(0.55, '#0d2952');
    studioBg.addColorStop(1, '#071a36');
    screenCtx.fillStyle = studioBg;
    screenCtx.fillRect(0, 0, w, h);

    // Subtle moving studio light columns & diagonal broadcast sweep
    for (let i = 0; i < 6; i++) {
      const lx = ((i * 92 + tSec * 14) % (w + 60)) - 30;
      screenCtx.fillStyle = i % 2 === 0 ? 'rgba(56, 189, 248, 0.06)' : 'rgba(255, 255, 255, 0.035)';
      screenCtx.fillRect(lx, 28, 22, 186);
    }
    screenCtx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
    screenCtx.lineWidth = 1.5;
    screenCtx.beginPath();
    screenCtx.arc(256, 128, 96, tSec * 0.25, tSec * 0.25 + Math.PI * 1.1);
    screenCtx.stroke();

    // 2. Right-side Broadcast Report Panel (Over-the-shoulder / live feed screen with smooth wipe)
    const boxX = 212;
    const boxY = 38;
    const boxW = 286;
    const boxH = 162;
    const wipe = Math.min(1, localT / 0.45);
    const easeWipe = wipe * wipe * (3 - 2 * wipe);

    screenCtx.save();
    screenCtx.beginPath();
    screenCtx.rect(boxX, boxY, boxW, boxH);
    screenCtx.clip();

    const panelGrad = screenCtx.createLinearGradient(boxX, boxY, boxX + boxW, boxY + boxH);
    panelGrad.addColorStop(0, '#091e3e');
    panelGrad.addColorStop(1, '#102f5c');
    screenCtx.fillStyle = panelGrad;
    screenCtx.fillRect(boxX, boxY, boxW, boxH);

    // Subtle broadcast grid inside report panel
    screenCtx.strokeStyle = 'rgba(125, 211, 252, 0.1)';
    screenCtx.lineWidth = 1;
    for (let gx = boxX + 24; gx < boxX + boxW; gx += 32) {
      screenCtx.beginPath();
      screenCtx.moveTo(gx, boxY);
      screenCtx.lineTo(gx, boxY + boxH);
      screenCtx.stroke();
    }
    for (let gy = boxY + 24; gy < boxY + boxH; gy += 32) {
      screenCtx.beginPath();
      screenCtx.moveTo(boxX, gy);
      screenCtx.lineTo(boxX + boxW, gy);
      screenCtx.stroke();
    }

    if (seg.kind === 'map') {
      // Stylized Live World/Regional Radar Map + pulsing health network arcs
      screenCtx.fillStyle = 'rgba(56, 189, 248, 0.2)';
      // Abstract continents silhouettes
      const blobs: Array<[number, number, number, number]> = [
        [268, 86, 34, 20],
        [345, 92, 42, 28],
        [356, 134, 24, 30],
        [426, 98, 44, 26],
        [446, 152, 20, 14],
      ];
      for (const [bx, by, rx, ry] of blobs) {
        screenCtx.beginPath();
        screenCtx.ellipse(bx, by, rx, ry, 0.15, 0, Math.PI * 2);
        screenCtx.fill();
      }
      // Network link arcs & pulsing nodes
      const nodes: Array<[number, number]> = [
        [355, 118],
        [346, 86],
        [395, 108],
        [274, 88],
        [436, 96],
      ];
      screenCtx.strokeStyle = 'rgba(250, 204, 21, 0.55)';
      screenCtx.lineWidth = 1.4;
      for (let i = 1; i < nodes.length; i++) {
        screenCtx.beginPath();
        screenCtx.moveTo(nodes[0][0], nodes[0][1]);
        screenCtx.quadraticCurveTo(
          (nodes[0][0] + nodes[i][0]) * 0.5,
          Math.min(nodes[0][1], nodes[i][1]) - 18,
          nodes[i][0],
          nodes[i][1]
        );
        screenCtx.stroke();
      }
      for (let i = 0; i < nodes.length; i++) {
        const pulse = ((tSec * 1.6 + i * 0.35) % 1);
        screenCtx.strokeStyle = `rgba(56, 189, 248, ${(1 - pulse) * 0.8})`;
        screenCtx.beginPath();
        screenCtx.arc(nodes[i][0], nodes[i][1], 4 + pulse * 14, 0, Math.PI * 2);
        screenCtx.stroke();
        screenCtx.fillStyle = i === 0 ? '#ef4444' : '#38bdf8';
        screenCtx.beginPath();
        screenCtx.arc(nodes[i][0], nodes[i][1], 3.5, 0, Math.PI * 2);
        screenCtx.fill();
      }
      // Live radar sweep line
      const sweepX = boxX + ((tSec * 90) % boxW);
      screenCtx.fillStyle = 'rgba(56, 189, 248, 0.22)';
      screenCtx.fillRect(sweepX - 8, boxY, 10, boxH);
    } else if (seg.kind === 'chart') {
      // Animated Live Medical Data Bars + Continuous ECG/Recovery Wave
      for (let b = 0; b < 7; b++) {
        const barH = 34 + Math.sin(tSec * 1.4 + b * 0.85) * 20 + b * 7;
        const bx = boxX + 26 + b * 36;
        const by = boxY + boxH - 18 - barH;
        const barG = screenCtx.createLinearGradient(0, by, 0, boxY + boxH - 18);
        barG.addColorStop(0, '#38bdf8');
        barG.addColorStop(1, '#0369a1');
        screenCtx.fillStyle = barG;
        screenCtx.fillRect(bx, by, 20, barH);
      }
      screenCtx.strokeStyle = '#fbbf24';
      screenCtx.lineWidth = 2.4;
      screenCtx.beginPath();
      for (let px = 0; px <= boxW; px += 6) {
        const py =
          boxY +
          68 +
          Math.sin(px * 0.045 - tSec * 3.8) * 16 +
          Math.cos(px * 0.09 + tSec * 2.1) * 7;
        if (px === 0) screenCtx.moveTo(boxX + px, py);
        else screenCtx.lineTo(boxX + px, py);
      }
      screenCtx.stroke();
    } else if (seg.kind === 'gait') {
      // Biomechanical gait double waveform + circular recovery gauge
      screenCtx.strokeStyle = '#38bdf8';
      screenCtx.lineWidth = 2.5;
      screenCtx.beginPath();
      for (let px = 0; px <= boxW - 90; px += 5) {
        const py = boxY + 96 + Math.sin(px * 0.06 - tSec * 4.4) * 24;
        if (px === 0) screenCtx.moveTo(boxX + 14 + px, py);
        else screenCtx.lineTo(boxX + 14 + px, py);
      }
      screenCtx.stroke();

      screenCtx.strokeStyle = '#34d399';
      screenCtx.lineWidth = 2;
      screenCtx.beginPath();
      for (let px = 0; px <= boxW - 90; px += 5) {
        const py = boxY + 96 + Math.cos(px * 0.06 - tSec * 4.4) * 18;
        if (px === 0) screenCtx.moveTo(boxX + 14 + px, py);
        else screenCtx.lineTo(boxX + 14 + px, py);
      }
      screenCtx.stroke();

      const gaugeX = boxX + boxW - 50;
      const gaugeY = boxY + 92;
      screenCtx.strokeStyle = 'rgba(255,255,255,0.16)';
      screenCtx.lineWidth = 7;
      screenCtx.beginPath();
      screenCtx.arc(gaugeX, gaugeY, 26, 0, Math.PI * 2);
      screenCtx.stroke();
      screenCtx.strokeStyle = '#22d3ee';
      screenCtx.beginPath();
      screenCtx.arc(
        gaugeX,
        gaugeY,
        26,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * (1.45 + Math.sin(tSec * 1.1) * 0.25)
      );
      screenCtx.stroke();
      screenCtx.fillStyle = '#f8fafc';
      screenCtx.font = 'bold 12px sans-serif';
      screenCtx.fillText('94%', gaugeX - 13, gaugeY + 4);
    } else {
      // Live Health Weather & Advisory Cards
      const cities = [
        ['KHARTOUM', '31°C'],
        ['CAIRO', '26°C'],
        ['RIYADH', '29°C'],
      ];
      for (let i = 0; i < cities.length; i++) {
        const cy = boxY + 44 + i * 38;
        screenCtx.fillStyle = 'rgba(15, 23, 42, 0.56)';
        screenCtx.fillRect(boxX + 18, cy, boxW - 36, 30);
        screenCtx.fillStyle = '#fbbf24';
        screenCtx.beginPath();
        screenCtx.arc(boxX + 38, cy + 15, 7, 0, Math.PI * 2);
        screenCtx.fill();
        screenCtx.fillStyle = '#f8fafc';
        screenCtx.font = 'bold 12px sans-serif';
        screenCtx.fillText(cities[i][0], boxX + 56, cy + 19);
        screenCtx.fillStyle = '#38bdf8';
        screenCtx.fillText(cities[i][1], boxX + boxW - 68, cy + 19);
      }
    }

    // Panel top sub-header strip + wipe shimmer bar
    screenCtx.fillStyle = 'rgba(6, 21, 43, 0.82)';
    screenCtx.fillRect(boxX, boxY, boxW, 24);
    screenCtx.fillStyle = '#38bdf8';
    screenCtx.fillRect(boxX, boxY + 23, boxW, 2);
    screenCtx.fillStyle = '#e2e8f0';
    screenCtx.font = 'bold 10px sans-serif';
    screenCtx.fillText(seg.sub, boxX + 10, boxY + 15);

    if (easeWipe < 1) {
      screenCtx.fillStyle = `rgba(56, 189, 248, ${(1 - easeWipe) * 0.55})`;
      screenCtx.fillRect(boxX + boxW * easeWipe - 12, boxY, 16, boxH);
    }
    screenCtx.restore();

    screenCtx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
    screenCtx.lineWidth = 1.5;
    screenCtx.strokeRect(boxX, boxY, boxW, boxH);

    // 3. Left-side Live Studio News Anchor seated behind broadcast desk
    const nod = Math.sin(tSec * 2.1) * 1.8 + Math.sin(tSec * 0.9) * 1.2;
    const speakOpen = Math.abs(Math.sin(tSec * 7.5)) * 2.5;
    const blink = (tSec % 4.2) > 4.06 ? 0.15 : 1;
    const handLift = Math.sin(tSec * 2.4) * 4;
    const anchorX = 112;
    const anchorY = 122 + Math.sin(tSec * 1.5) * 1.2;

    // Blazer / shoulders
    screenCtx.fillStyle = '#0f172a';
    screenCtx.beginPath();
    screenCtx.moveTo(anchorX - 54, 200);
    screenCtx.quadraticCurveTo(anchorX - 46, anchorY + 12, anchorX - 18, anchorY + 6);
    screenCtx.lineTo(anchorX + 18, anchorY + 6);
    screenCtx.quadraticCurveTo(anchorX + 46, anchorY + 12, anchorX + 54, 200);
    screenCtx.closePath();
    screenCtx.fill();

    // Crisp white collar & crimson/blue news tie
    screenCtx.fillStyle = '#f8fafc';
    screenCtx.beginPath();
    screenCtx.moveTo(anchorX - 14, anchorY + 6);
    screenCtx.lineTo(anchorX, anchorY + 34);
    screenCtx.lineTo(anchorX + 14, anchorY + 6);
    screenCtx.closePath();
    screenCtx.fill();
    screenCtx.fillStyle = '#dc2626';
    screenCtx.beginPath();
    screenCtx.moveTo(anchorX - 4, anchorY + 12);
    screenCtx.lineTo(anchorX + 4, anchorY + 12);
    screenCtx.lineTo(anchorX + 6, anchorY + 46);
    screenCtx.lineTo(anchorX - 6, anchorY + 46);
    screenCtx.closePath();
    screenCtx.fill();

    // Neck + Head
    screenCtx.fillStyle = '#9a6544';
    screenCtx.fillRect(anchorX - 8, anchorY - 8, 16, 18);
    screenCtx.save();
    screenCtx.translate(anchorX, anchorY - 24 + nod * 0.5);
    screenCtx.rotate(Math.sin(tSec * 1.1) * 0.04);
    // Hair
    screenCtx.fillStyle = '#17100c';
    screenCtx.beginPath();
    screenCtx.arc(0, -4, 23, Math.PI * 0.92, Math.PI * 2.08);
    screenCtx.fill();
    // Face
    screenCtx.fillStyle = '#a8704c';
    screenCtx.beginPath();
    screenCtx.ellipse(0, 0, 20, 24, 0, 0, Math.PI * 2);
    screenCtx.fill();
    // Eyes
    screenCtx.fillStyle = '#111827';
    screenCtx.beginPath();
    screenCtx.ellipse(-7, -3, 2.3, 2.3 * blink, 0, 0, Math.PI * 2);
    screenCtx.ellipse(7, -3, 2.3, 2.3 * blink, 0, 0, Math.PI * 2);
    screenCtx.fill();
    // Speaking mouth
    screenCtx.fillStyle = '#4a1d1f';
    screenCtx.beginPath();
    screenCtx.ellipse(0, 11, 5, 1.4 + speakOpen, 0, 0, Math.PI * 2);
    screenCtx.fill();
    screenCtx.restore();

    // Subtle animated anchor hand holding cue notes
    screenCtx.fillStyle = '#a8704c';
    screenCtx.beginPath();
    screenCtx.ellipse(anchorX + 26, 174 - handLift, 8, 5.5, -0.2, 0, Math.PI * 2);
    screenCtx.fill();
    screenCtx.fillStyle = '#f1f5f9';
    screenCtx.fillRect(anchorX - 18, 174, 34, 10);

    // Curved illuminated news studio desk foreground
    const deskG = screenCtx.createLinearGradient(0, 176, 0, 202);
    deskG.addColorStop(0, '#1e3a8a');
    deskG.addColorStop(1, '#0b1d3a');
    screenCtx.fillStyle = deskG;
    screenCtx.beginPath();
    screenCtx.moveTo(14, 200);
    screenCtx.quadraticCurveTo(112, 172, 202, 200);
    screenCtx.closePath();
    screenCtx.fill();
    screenCtx.fillStyle = '#38bdf8';
    screenCtx.fillRect(42, 187, 136, 2.5);

    // 4. Top Broadcast Bar: Pulsing LIVE Bug + THERASON NEWS + Digital Clock
    screenCtx.fillStyle = 'rgba(6, 16, 34, 0.9)';
    screenCtx.fillRect(0, 0, w, 28);
    screenCtx.fillStyle = '#dc2626';
    screenCtx.fillRect(10, 5, 62, 18);
    const liveAlpha = 0.55 + 0.45 * Math.sin(tSec * 5.2);
    screenCtx.fillStyle = `rgba(255, 255, 255, ${liveAlpha})`;
    screenCtx.beginPath();
    screenCtx.arc(21, 14, 3.5, 0, Math.PI * 2);
    screenCtx.fill();
    screenCtx.fillStyle = '#ffffff';
    screenCtx.font = 'bold 11px sans-serif';
    screenCtx.fillText('LIVE', 29, 18);

    screenCtx.fillStyle = '#0f2d56';
    screenCtx.fillRect(76, 5, 136, 18);
    screenCtx.fillStyle = '#38bdf8';
    screenCtx.fillRect(76, 5, 3, 18);
    screenCtx.fillStyle = '#f8fafc';
    screenCtx.font = 'bold 11px sans-serif';
    screenCtx.fillText('THERASON NEWS', 84, 18);

    // Broadcast clock + channel label
    const totalMins = Math.floor(tSec * 0.2) + 9 * 60 + 42;
    const hh = String(Math.floor(totalMins / 60) % 24).padStart(2, '0');
    const mm = String(totalMins % 60).padStart(2, '0');
    screenCtx.fillStyle = '#1e293b';
    screenCtx.fillRect(w - 118, 5, 108, 18);
    screenCtx.fillStyle = '#fbbf24';
    screenCtx.font = 'bold 11px "JetBrains Mono", monospace';
    screenCtx.fillText(`${hh}:${mm}`, w - 110, 18);
    screenCtx.fillStyle = '#cbd5e1';
    screenCtx.font = 'bold 10px sans-serif';
    screenCtx.fillText('مباشر', w - 58, 18);

    // 5. Iconic Lower-Third Breaking Headline Chyron (y: 202..248)
    screenCtx.fillStyle = '#f8fafc';
    screenCtx.fillRect(0, 204, w, 44);
    screenCtx.fillStyle = '#b91c1c';
    screenCtx.fillRect(w - 118, 204, 118, 44);
    screenCtx.fillStyle = '#f59e0b';
    screenCtx.fillRect(0, 202, w, 3);

    screenCtx.direction = 'rtl';
    screenCtx.fillStyle = '#ffffff';
    screenCtx.font = 'bold 15px "Cairo", sans-serif';
    screenCtx.textAlign = 'center';
    screenCtx.fillText(seg.tag, w - 59, 232);

    const headlineSlide = Math.min(1, localT / 0.32);
    const hlAlpha = headlineSlide;
    screenCtx.save();
    screenCtx.beginPath();
    screenCtx.rect(8, 206, w - 134, 40);
    screenCtx.clip();
    screenCtx.fillStyle = `rgba(11, 31, 58, ${hlAlpha})`;
    screenCtx.font = 'bold 16px "Cairo", sans-serif';
    screenCtx.textAlign = 'right';
    screenCtx.fillText(seg.headline, w - 130, 232 + (1 - headlineSlide) * 10);
    screenCtx.restore();

    // 6. Continuous Seamless Scrolling News Ticker Strip (y: 248..288)
    screenCtx.fillStyle = '#091b36';
    screenCtx.fillRect(0, 248, w, 40);
    screenCtx.fillStyle = '#facc15';
    screenCtx.fillRect(w - 92, 248, 92, 40);
    screenCtx.fillStyle = '#091b36';
    screenCtx.font = 'bold 14px "Cairo", sans-serif';
    screenCtx.textAlign = 'center';
    screenCtx.fillText('الأخبار', w - 46, 273);

    screenCtx.save();
    screenCtx.beginPath();
    screenCtx.rect(0, 248, w - 94, 40);
    screenCtx.clip();
    screenCtx.direction = 'rtl';
    screenCtx.textAlign = 'left';
    screenCtx.fillStyle = '#f8fafc';
    screenCtx.font = 'bold 14px "Cairo", sans-serif';
    const scrollShift = (tSec * 68) % newsTickerSpan;
    const x1 = -newsTickerSpan + scrollShift;
    screenCtx.fillText(newsTickerText, x1, 273);
    screenCtx.fillText(newsTickerText, x1 + newsTickerSpan, 273);
    screenCtx.restore();

    screenCtx.direction = 'ltr';
    screenCtx.textAlign = 'left';
  };
  drawReceptionScreenFrame(0);
  const receptionScreen = track(finalizeTexture(screenCanvas, aniso, 1, 1, true, true));
  receptionScreen.generateMipmaps = false;
  receptionScreen.minFilter = THREE.LinearFilter;
  receptionScreen.magFilter = THREE.LinearFilter;
  let lastScreenBucket = -1;
  const updateReceptionScreen = (tSec: number) => {
    const bucket = Math.floor(tSec * 15);
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
    woodBump,
    bark,
    barkBump,
    birchBark,
    leafFoliage,
    cypressFoliage,
    oliveFoliage,
    roofShingle,
    plasterAlbedo,
    stuccoBump,
    plasterRough,
    wainscotAlbedo,
    wainscotBump,
    brushedMetalBump,
    fabricWeaveBump,
    leatherBump,
    skinMicroMap,
    skinRoughMap,
    waterNormal,
    rugPattern,
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
