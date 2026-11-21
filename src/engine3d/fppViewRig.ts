import * as THREE from 'three';
import { PLAYER_DEFAULT_SKIN, resolvePlayerOutfitMeta } from '../data/catalog';
import { TextureBundle } from './textures3d';
import { PlayerCharacterConfig } from '../types/clinic';

export interface FppBackdropHandle {
  group: THREE.Group;
  wallLight: THREE.PointLight;
  roomFillLight: THREE.PointLight;
  setLightFactor: (alpha: number, isNight?: boolean) => void;
  dispose: () => void;
}

export interface FppHandGripTarget {
  active: boolean;
  style: 'pole' | 'bar' | 'crate';
  leftX: number;
  leftY: number;
  leftZ: number;
  rightX: number;
  rightY: number;
  rightZ: number;
}

export interface FppClinicianHandsHandle {
  group: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  updateAppearance: (profile?: PlayerCharacterConfig) => void;
  updateMotion: (
    fppSmooth: number,
    walkBob: number,
    timeSec: number,
    isSpeakingOrExam: boolean,
    aspect?: number,
    gripTarget?: FppHandGripTarget
  ) => void;
  dispose: () => void;
}

function createWallEngravingTextures(maxAniso: number): {
  colorTex: THREE.CanvasTexture;
  bumpTex: THREE.CanvasTexture;
} {
  const W = 3840;
  const H = 1184;

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = W;
  colorCanvas.height = H;
  const cCtx = colorCanvas.getContext('2d');

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = W;
  bumpCanvas.height = H;
  const bCtx = bumpCanvas.getContext('2d');

  const aniso = Math.min(16, Math.max(8, maxAniso || 8));
  const colorTex = new THREE.CanvasTexture(colorCanvas);
  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.anisotropy = aniso;
  colorTex.minFilter = THREE.LinearMipmapLinearFilter;
  colorTex.magFilter = THREE.LinearFilter;
  colorTex.generateMipmaps = true;

  const bumpTex = new THREE.CanvasTexture(bumpCanvas);
  bumpTex.anisotropy = aniso;
  bumpTex.minFilter = THREE.LinearMipmapLinearFilter;
  bumpTex.magFilter = THREE.LinearFilter;
  bumpTex.generateMipmaps = true;

  const renderCanvases = () => {
    if (!cCtx || !bCtx) return;
    cCtx.clearRect(0, 0, W, H);
    bCtx.fillStyle = '#ffffff';
    bCtx.fillRect(0, 0, W, H);

    const drawTextPass = (
      ctx: CanvasRenderingContext2D,
      mainColor: string | CanvasGradient,
      subLeftColor: string | CanvasGradient,
      subRightColor: string | CanvasGradient,
      lineColor: string | CanvasGradient,
      offsetX: number,
      offsetY: number,
      strokeColor?: string,
      strokeWidth = 0
    ) => {
      // Line 1: "Therason physiotherapy"
      ctx.direction = 'ltr';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '800 246px "Plus Jakarta Sans", "Cairo", sans-serif';
      if (strokeColor && strokeWidth > 0) {
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ctx.lineWidth = strokeWidth;
        ctx.strokeStyle = strokeColor;
        ctx.strokeText('Therason physiotherapy', W / 2 + offsetX, 376 + offsetY, W - 240);
      }
      ctx.fillStyle = mainColor;
      ctx.fillText('Therason physiotherapy', W / 2 + offsetX, 376 + offsetY, W - 240);

      // Clean blue architectural divider bar
      ctx.fillStyle = lineColor;
      ctx.fillRect(W / 2 - 920 + offsetX, 588 + offsetY, 1840, 12);

      // Line 2: "Powered by طـــاهــر مــحـمـد"
      const prefix = 'Powered by ';
      const arName = 'طـــاهــر مــحـمـد';
      ctx.font = '700 132px "Plus Jakarta Sans", sans-serif';
      const wPrefix = ctx.measureText(prefix).width;
      ctx.font = '800 176px "Cairo", "Plus Jakarta Sans", sans-serif';
      const wName = ctx.measureText(arName).width;
      const totalW = wPrefix + wName;
      const startX = (W - totalW) / 2 + offsetX;

      ctx.direction = 'ltr';
      ctx.textAlign = 'left';
      ctx.font = '700 132px "Plus Jakarta Sans", sans-serif';
      if (strokeColor && strokeWidth > 0) {
        ctx.lineWidth = Math.max(2, strokeWidth * 0.72);
        ctx.strokeStyle = strokeColor;
        ctx.strokeText(prefix, startX, 822 + offsetY);
      }
      ctx.fillStyle = subLeftColor;
      ctx.fillText(prefix, startX, 822 + offsetY);

      ctx.direction = 'rtl';
      ctx.textAlign = 'right';
      ctx.font = '800 176px "Cairo", "Plus Jakarta Sans", sans-serif';
      if (strokeColor && strokeWidth > 0) {
        ctx.lineWidth = Math.max(2, strokeWidth * 0.82);
        ctx.strokeStyle = strokeColor;
        ctx.strokeText(arName, startX + totalW, 814 + offsetY);
      }
      ctx.fillStyle = subRightColor;
      ctx.fillText(arName, startX + totalW, 814 + offsetY);
    };

    // Subtle crisp drop shadow for clean architectural separation against the plaster wall
    drawTextPass(
      cCtx,
      'rgba(7, 34, 78, 0.36)',
      'rgba(7, 34, 78, 0.32)',
      'rgba(7, 34, 78, 0.36)',
      'rgba(7, 34, 78, 0.24)',
      0,
      7
    );

    // Rich, very clear vivid royal-cerulean blue fill + crisp deep-cobalt outline
    const titleGrad = cCtx.createLinearGradient(320, 220, W - 320, 520);
    titleGrad.addColorStop(0, '#0369a1');
    titleGrad.addColorStop(0.5, '#0284c7');
    titleGrad.addColorStop(1, '#1d4ed8');

    const lineGrad = cCtx.createLinearGradient(W / 2 - 920, 0, W / 2 + 920, 0);
    lineGrad.addColorStop(0, 'rgba(2, 132, 199, 0.16)');
    lineGrad.addColorStop(0.5, '#0284c7');
    lineGrad.addColorStop(1, 'rgba(29, 78, 216, 0.16)');

    const subPrefixGrad = '#075985';
    const nameGrad = cCtx.createLinearGradient(1100, 700, W - 900, 940);
    nameGrad.addColorStop(0, '#0369a1');
    nameGrad.addColorStop(0.5, '#0284c7');
    nameGrad.addColorStop(1, '#1d4ed8');

    drawTextPass(cCtx, titleGrad, subPrefixGrad, nameGrad, lineGrad, 0, 0, '#082f68', 6);

    // Clean subtle bevel bump map (gentle relief so lettering stays razor sharp)
    drawTextPass(bCtx, '#3a3a3a', '#444444', '#3a3a3a', '#505050', 0, 0);

    colorTex.needsUpdate = true;
    bumpTex.needsUpdate = true;
  };

  renderCanvases();
  if (typeof document !== 'undefined' && 'fonts' in document && document.fonts?.ready) {
    void document.fonts.ready.then(() => {
      renderCanvases();
    });
  }

  return { colorTex, bumpTex };
}

function applyWallPanelAoShader(
  mat: THREE.Material,
  opts: { height: number; topAo: number; botAo: number; cornerAo: number; tag: string }
) {
  mat.customProgramCacheKey = () => `fpp-wall-ao-${opts.tag}`;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uHalfH = { value: opts.height * 0.5 };
    shader.uniforms.uTopAo = { value: opts.topAo };
    shader.uniforms.uBotAo = { value: opts.botAo };
    shader.uniforms.uCornerAo = { value: opts.cornerAo };
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vFppLocalPos;
        varying vec2 vFppSpanBound;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vFppLocalPos = position;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vFppLocalPos;
        uniform float uHalfH;
        uniform float uTopAo;
        uniform float uBotAo;
        uniform float uCornerAo;`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float hNorm = clamp((vFppLocalPos.y + uHalfH) / max(0.01, uHalfH * 2.0), 0.0, 1.0);
        float botShade = mix(1.0 - uBotAo, 1.0, smoothstep(0.0, 0.14, hNorm));
        float topShade = mix(1.0 - uTopAo, 1.0, smoothstep(0.0, 0.16, 1.0 - hNorm));
        float endDist = max(0.0, 3.4 - abs(vFppLocalPos.x));
        float cornerShade = mix(1.0 - uCornerAo, 1.0, smoothstep(0.0, 0.36, endDist));
        diffuseColor.rgb *= botShade * topShade * cornerShade;`
      );
  };
}

function applyFloorRoomAoShader(
  mat: THREE.Material,
  roomW: number,
  backZ: number,
  frontZ: number
) {
  const halfW = roomW * 0.5;
  const centerZ = (backZ + frontZ) * 0.5;
  const halfD = (frontZ - backZ) * 0.5;
  mat.customProgramCacheKey = () => 'fpp-floor-ao';
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uHalfW = { value: halfW };
    shader.uniforms.uHalfD = { value: halfD };
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec2 vFppFloorLocal;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vFppFloorLocal = position.xy;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec2 vFppFloorLocal;
        uniform float uHalfW;
        uniform float uHalfD;`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float dxWall = max(0.0, uHalfW - abs(vFppFloorLocal.x));
        float dzWall = max(0.0, uHalfD - abs(vFppFloorLocal.y));
        float wallDist = min(dxWall, dzWall);
        float wallAo = mix(0.78, 1.0, smoothstep(0.0, 0.42, wallDist));
        vec2 bedOffset = vec2(vFppFloorLocal.x, vFppFloorLocal.y - (${(centerZ + 0.25).toFixed(3)}));
        float bedShadowDist = length(vec2(bedOffset.x * 0.78, bedOffset.y * 1.12));
        float bedContactAo = mix(0.82, 1.0, smoothstep(0.38, 1.44, bedShadowDist));
        diffuseColor.rgb *= wallAo * bedContactAo;`
      );
  };
}

function createExtrudedProfileAlongX(
  length: number,
  profilePts: Array<[number, number]>,
  bevelSize = 0.004
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(profilePts[0][0], profilePts[0][1]);
  for (let i = 1; i < profilePts.length; i++) {
    shape.lineTo(profilePts[i][0], profilePts[i][1]);
  }
  shape.closePath();

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.02, length - bevelSize * 2),
    bevelEnabled: bevelSize > 0,
    bevelThickness: bevelSize,
    bevelSize,
    bevelSegments: 2,
    steps: 1,
  });
  // Rotate -PI/2 around Y so Shape X maps directly to +Z room depth, Shape Y maps to +Y height, and extrusion spans X centered at 0
  geom.rotateY(-Math.PI / 2);
  geom.translate(length * 0.5 - bevelSize, 0, 0);
  geom.computeVertexNormals();
  return geom;
}

export function createFppRoomBackdrop3D(
  textures: TextureBundle,
  maxAniso: number,
  opts?: { enableShadows?: boolean }
): FppBackdropHandle {
  const group = new THREE.Group();
  const enableShadows = Boolean(opts?.enableShadows);
  const disposables: Array<{ dispose: () => void }> = [];
  const trackGeom = <T extends THREE.BufferGeometry>(g: T): T => {
    disposables.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    disposables.push(m);
    return m;
  };
  const cloneTex = (src: THREE.CanvasTexture, rx: number, ry: number): THREE.CanvasTexture => {
    const t = src.clone();
    t.repeat.set(rx, ry);
    t.anisotropy = Math.min(16, Math.max(4, maxAniso || 4));
    t.needsUpdate = true;
    disposables.push(t);
    return t;
  };

  // High-resolution textures specifically scaled for close-up examination bay walls & surfaces
  const fppPlasterAlbedo = cloneTex(textures.plasterAlbedo, 5.4, 2.2);
  const fppStuccoBump = cloneTex(textures.stuccoBump, 5.4, 2.2);
  const fppPlasterRough = cloneTex(textures.plasterRough, 5.4, 2.2);

  const fppWainscotAlbedo = cloneTex(textures.wainscotAlbedo, 7.2, 1.0);
  const fppWainscotBump = cloneTex(textures.wainscotBump, 7.2, 1.0);

  const fppWoodColor = cloneTex(textures.wood, 1.1, 2.4);
  const fppWoodBump = cloneTex(textures.woodBump, 1.1, 2.4);

  const fppMetalBump = cloneTex(textures.brushedMetalBump, 3.5, 1.5);

  const roomW = 6.8;
  const backZ = -1.24;
  const frontZ = 3.6;
  const roomD = frontZ - backZ;
  const centerZ = (backZ + frontZ) / 2;
  const wallH = 2.78;
  const wainH = 0.88;
  const upperH = wallH - wainH;

  const plasterMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      map: fppPlasterAlbedo,
      bumpMap: fppStuccoBump,
      roughnessMap: fppPlasterRough,
      bumpScale: 0.022,
      roughness: 0.88,
      metalness: 0.0,
      sheen: 0.14,
      sheenRoughness: 0.85,
      sheenColor: new THREE.Color(0xf8fafc),
      envMapIntensity: 0.42,
    })
  );
  applyWallPanelAoShader(plasterMat, {
    height: upperH,
    topAo: 0.18,
    botAo: 0.1,
    cornerAo: 0.16,
    tag: 'upper-plaster',
  });

  const wainscotMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      map: fppWainscotAlbedo,
      bumpMap: fppWainscotBump,
      bumpScale: 0.018,
      roughness: 0.48,
      metalness: 0.06,
      clearcoat: 0.18,
      clearcoatRoughness: 0.46,
      envMapIntensity: 0.56,
    })
  );
  applyWallPanelAoShader(wainscotMat, {
    height: wainH,
    topAo: 0.14,
    botAo: 0.18,
    cornerAo: 0.16,
    tag: 'lower-wain',
  });

  const darkTrimMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x242e3c,
      bumpMap: fppMetalBump,
      bumpScale: 0.004,
      roughness: 0.34,
      metalness: 0.64,
      clearcoat: 0.24,
      clearcoatRoughness: 0.38,
      envMapIntensity: 0.85,
    })
  );

  const aluminumMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xc8d2de,
      bumpMap: fppMetalBump,
      bumpScale: 0.005,
      roughness: 0.26,
      metalness: 0.84,
      clearcoat: 0.15,
      clearcoatRoughness: 0.32,
      envMapIntensity: 0.95,
    })
  );

  const woodSlatMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      map: fppWoodColor,
      bumpMap: fppWoodBump,
      bumpScale: 0.016,
      roughness: 0.56,
      metalness: 0.02,
      clearcoat: 0.16,
      clearcoatRoughness: 0.48,
      envMapIntensity: 0.58,
    })
  );

  const warmCoveMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfff5db,
      emissive: 0xfbbf24,
      emissiveIntensity: 0.62,
      roughness: 0.26,
    })
  );

  const { colorTex: wallSignColorTex, bumpTex: wallSignBumpTex } =
    createWallEngravingTextures(maxAniso);
  disposables.push(wallSignColorTex, wallSignBumpTex);
  const wallEngravingMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: wallSignColorTex,
      bumpMap: wallSignBumpTex,
      bumpScale: 0.008,
      emissiveMap: wallSignColorTex,
      emissive: new THREE.Color(0x0ea5e9),
      emissiveIntensity: 0.28,
      transparent: true,
      alphaTest: 0.02,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      roughness: 0.36,
      metalness: 0.08,
      envMapIntensity: 0.35,
    })
  );

  const floorColorTex = cloneTex(textures.tileBlue, 4.0, 2.8);
  const floorRoughTex = cloneTex(textures.tileBlueRough, 4.0, 2.8);
  const floorNormTex = cloneTex(textures.tileNormal, 4.0, 2.8);

  const floorMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      map: floorColorTex,
      roughnessMap: floorRoughTex,
      normalMap: floorNormTex,
      normalScale: new THREE.Vector2(0.46, 0.46),
      roughness: 0.56,
      metalness: 0.04,
      clearcoat: 0.24,
      clearcoatRoughness: 0.34,
      envMapIntensity: 0.58,
    })
  );
  applyFloorRoomAoShader(floorMat, roomW, backZ, frontZ);

  const ceilingMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: fppPlasterAlbedo,
      roughnessMap: fppPlasterRough,
      color: 0xf8fafc,
      roughness: 0.92,
      metalness: 0.0,
      envMapIntensity: 0.32,
    })
  );

  const ceilingPanelMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      emissive: 0xfff8eb,
      emissiveIntensity: 0.78,
      roughness: 0.2,
      clearcoat: 0.45,
      clearcoatRoughness: 0.18,
    })
  );

  // Beveled architectural wainscoting stile molding geometry (reused across walls)
  const stileGeom = trackGeom(
    (() => {
      const s = new THREE.Shape();
      s.moveTo(-0.021, 0);
      s.lineTo(0.021, 0);
      s.lineTo(0.017, 0.014);
      s.lineTo(-0.017, 0.014);
      s.closePath();
      const g = new THREE.ExtrudeGeometry(s, {
        depth: wainH - 0.125,
        bevelEnabled: true,
        bevelSize: 0.0025,
        bevelThickness: 0.0025,
        bevelSegments: 2,
      });
      g.rotateX(-Math.PI / 2);
      g.translate(0, 0, 0.015);
      g.computeVertexNormals();
      return g;
    })()
  );

  // Enclosed universal examination bay template (completely isolates session from outer clinic landmarks)
  const buildWallSpan = (spanLen: number, x: number, z: number, rotY: number) => {
    const wg = new THREE.Group();
    wg.position.set(x, 0, z);
    wg.rotation.y = rotY;

    // Stepped beveled anodized baseboard skirt (0 .. 0.11m)
    const skirtGeom = trackGeom(
      createExtrudedProfileAlongX(
        spanLen,
        [
          [-0.032, 0.0],
          [0.052, 0.0],
          [0.052, 0.088],
          [0.041, 0.106],
          [-0.032, 0.106],
        ],
        0.003
      )
    );
    const skirt = new THREE.Mesh(skirtGeom, darkTrimMat);
    skirt.receiveShadow = enableShadows;

    // Wainscot lower wall body
    const wain = new THREE.Mesh(
      trackGeom(new THREE.BoxGeometry(spanLen, wainH, 0.065)),
      wainscotMat
    );
    wain.position.set(0, wainH / 2, 0);
    wain.receiveShadow = enableShadows;

    // Subtle physical vertical wainscot panel stiles for genuine architectural relief
    const panelCount = Math.max(4, Math.round(spanLen / 0.68));
    const stepX = (spanLen - 0.44) / panelCount;
    for (let i = 0; i <= panelCount; i++) {
      const sx = -spanLen * 0.5 + 0.22 + i * stepX;
      const stile = new THREE.Mesh(stileGeom, wainscotMat);
      stile.position.set(sx, 0.106, 0.031);
      stile.receiveShadow = enableShadows;
      wg.add(stile);
    }

    // Stepped beveled brushed-aluminum dado chair rail
    const dadoGeom = trackGeom(
      createExtrudedProfileAlongX(
        spanLen + 0.02,
        [
          [-0.034, wainH - 0.014],
          [0.054, wainH - 0.008],
          [0.058, wainH + 0.012],
          [0.052, wainH + 0.024],
          [0.044, wainH + 0.038],
          [-0.034, wainH + 0.038],
        ],
        0.003
      )
    );
    const dado = new THREE.Mesh(dadoGeom, aluminumMat);
    dado.receiveShadow = enableShadows;

    // Upper acoustic lime-plaster wall
    const upper = new THREE.Mesh(
      trackGeom(new THREE.BoxGeometry(spanLen, upperH, 0.06)),
      plasterMat
    );
    upper.position.set(0, wainH + upperH / 2, 0);
    upper.receiveShadow = enableShadows;

    // Stepped recessed ceiling crown cornice
    const crownGeom = trackGeom(
      createExtrudedProfileAlongX(
        spanLen + 0.02,
        [
          [-0.034, wallH - 0.072],
          [0.036, wallH - 0.072],
          [0.044, wallH - 0.056],
          [0.056, wallH - 0.046],
          [0.056, wallH],
          [-0.034, wallH],
        ],
        0.003
      )
    );
    const crown = new THREE.Mesh(crownGeom, darkTrimMat);

    wg.add(skirt, wain, dado, upper, crown);
    group.add(wg);
  };

  // Back wall (behind patient), Front wall (behind camera), and extended Left & Right walls
  buildWallSpan(roomW + 0.12, 0, backZ, 0);
  buildWallSpan(roomW + 0.12, 0, frontZ, Math.PI);
  buildWallSpan(roomD + 0.12, -roomW / 2, centerZ, Math.PI / 2);
  buildWallSpan(roomD + 0.12, roomW / 2, centerZ, -Math.PI / 2);

  // Subtle corner architectural reveal pilasters so wall corners look crisp & clean
  const cornerGeom = trackGeom(new THREE.BoxGeometry(0.064, wallH, 0.064));
  for (const [cx, cz] of [
    [-roomW / 2 + 0.024, backZ + 0.024],
    [roomW / 2 - 0.024, backZ + 0.024],
    [-roomW / 2 + 0.024, frontZ - 0.024],
    [roomW / 2 - 0.024, frontZ - 0.024],
  ]) {
    const pilaster = new THREE.Mesh(cornerGeom, darkTrimMat);
    pilaster.position.set(cx, wallH / 2, cz);
    pilaster.receiveShadow = enableShadows;
    group.add(pilaster);
  }

  // Seamless universal porcelain floor & ceiling
  const floorMesh = new THREE.Mesh(
    trackGeom(new THREE.PlaneGeometry(roomW + 0.14, roomD + 0.14)),
    floorMat
  );
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.set(0, -0.002, centerZ);
  floorMesh.receiveShadow = enableShadows;
  group.add(floorMesh);

  const ceilingMesh = new THREE.Mesh(
    trackGeom(new THREE.PlaneGeometry(roomW + 0.14, roomD + 0.14)),
    ceilingMat
  );
  ceilingMesh.rotation.x = Math.PI / 2;
  ceilingMesh.position.set(0, wallH, centerZ);
  group.add(ceilingMesh);

  // Multi-part recessed ceiling light troffer (aluminum bezel + shadow reveal + frosted acrylic diffuser)
  const trofferBezel = new THREE.Mesh(
    trackGeom(new THREE.BoxGeometry(1.26, 0.028, 0.54)),
    aluminumMat
  );
  trofferBezel.position.set(0, wallH - 0.008, 0.52);
  const trofferRecess = new THREE.Mesh(
    trackGeom(new THREE.BoxGeometry(1.2, 0.024, 0.48)),
    darkTrimMat
  );
  trofferRecess.position.set(0, wallH - 0.011, 0.52);
  const ceilingLightPanel = new THREE.Mesh(
    trackGeom(new THREE.BoxGeometry(1.16, 0.018, 0.44)),
    ceilingPanelMat
  );
  ceilingLightPanel.position.set(0, wallH - 0.014, 0.52);
  group.add(trofferBezel, trofferRecess, ceilingLightPanel);

  // Back wall oak acoustic wood-slat flanks (with outer architectural bezel + beveled oiled oak battens)
  const slatShape = new THREE.Shape();
  slatShape.moveTo(-0.027, -0.755);
  slatShape.lineTo(0.027, -0.755);
  slatShape.lineTo(0.027, 0.755);
  slatShape.lineTo(-0.027, 0.755);
  slatShape.closePath();
  const beveledSlatGeom = trackGeom(
    new THREE.ExtrudeGeometry(slatShape, {
      depth: 0.022,
      bevelEnabled: true,
      bevelSize: 0.0045,
      bevelThickness: 0.0045,
      bevelSegments: 2,
    })
  );
  beveledSlatGeom.center();
  beveledSlatGeom.computeVertexNormals();

  for (const flankX of [-1.62, 1.62]) {
    const outerFrame = new THREE.Mesh(
      trackGeom(new THREE.BoxGeometry(0.59, 1.59, 0.018)),
      aluminumMat
    );
    outerFrame.position.set(flankX, 1.74, backZ + 0.032);
    const backing = new THREE.Mesh(
      trackGeom(new THREE.BoxGeometry(0.56, 1.56, 0.022)),
      darkTrimMat
    );
    backing.position.set(flankX, 1.74, backZ + 0.038);
    backing.receiveShadow = enableShadows;
    group.add(outerFrame, backing);
    for (let si = -2; si <= 2; si++) {
      const slat = new THREE.Mesh(beveledSlatGeom, woodSlatMat);
      slat.position.set(flankX + si * 0.105, 1.74, backZ + 0.056);
      slat.castShadow = enableShadows;
      slat.receiveShadow = enableShadows;
      group.add(slat);
    }
  }

  // Wall-engraved typography directly on the plaster wall above the patient's bed
  const wallEngraving = new THREE.Mesh(
    trackGeom(new THREE.PlaneGeometry(2.38, 0.74)),
    wallEngravingMat
  );
  wallEngraving.position.set(0, 1.56, backZ + 0.036);
  wallEngraving.renderOrder = 1;
  group.add(wallEngraving);

  // Recessed warm LED architectural cove housing + emitter strip
  const coveHousing = new THREE.Mesh(
    trackGeom(new THREE.BoxGeometry(2.02, 0.038, 0.068)),
    darkTrimMat
  );
  coveHousing.position.set(0, wallH - 0.052, backZ + 0.072);
  const coveBar = new THREE.Mesh(
    trackGeom(new THREE.BoxGeometry(1.95, 0.022, 0.044)),
    warmCoveMat
  );
  coveBar.position.set(0, wallH - 0.064, backZ + 0.082);
  group.add(coveHousing, coveBar);

  // Calibrated Three-Point Clinical FPP Illumination
  const wallLight = new THREE.PointLight(0xffe9c8, 1.12, 8.2, 1.15);
  wallLight.castShadow = false;
  wallLight.position.set(0, 2.28, backZ + 0.95);
  group.add(wallLight);

  const roomFillLight = new THREE.PointLight(0xeef5ff, 0.92, 11.4, 1.1);
  roomFillLight.castShadow = false;
  roomFillLight.position.set(-0.35, 2.46, 1.2);
  group.add(roomFillLight);

  // Dedicated ceiling exam-bay key SpotLight casting crisp soft shadows from bed & patient onto floor
  const examKeySpot = new THREE.SpotLight(0xfffaf0, enableShadows ? 2.45 : 1.38, 11.2, Math.PI / 2.2, 0.85, 1.05);
  examKeySpot.position.set(0.32, wallH - 0.06, 0.72);
  examKeySpot.target.position.set(0, 0.42, -0.2);
  if (enableShadows) {
    examKeySpot.castShadow = true;
    examKeySpot.shadow.mapSize.set(1024, 1024);
    examKeySpot.shadow.camera.near = 0.4;
    examKeySpot.shadow.camera.far = 7.8;
    examKeySpot.shadow.bias = -0.00045;
    examKeySpot.shadow.normalBias = 0.016;
    examKeySpot.shadow.radius = 2.8;
  }
  group.add(examKeySpot, examKeySpot.target);

  const setLightFactor = (alpha: number, isNight = false) => {
    const a = THREE.MathUtils.clamp(alpha, 0, 1);
    wallLight.intensity = a * (isNight ? 1.52 : 1.14);
    roomFillLight.intensity = a * (isNight ? 1.24 : 0.92);
    examKeySpot.intensity = a * (enableShadows ? (isNight ? 2.68 : 2.38) : (isNight ? 1.58 : 1.36));
  };

  group.visible = false;

  return {
    group,
    wallLight,
    roomFillLight,
    setLightFactor,
    dispose: () => {
      for (const d of disposables) d.dispose();
    },
  };
}

export function createFppClinicianHands3D(
  textures: TextureBundle,
  initialProfile?: PlayerCharacterConfig
): FppClinicianHandsHandle {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];
  const trackGeom = <T extends THREE.BufferGeometry>(g: T): T => {
    disposables.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    disposables.push(m);
    return m;
  };

  const skinMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x8f5938,
      map: textures.skinMicroMap,
      roughnessMap: textures.skinRoughMap,
      roughness: 0.58,
      metalness: 0.0,
      clearcoat: 0.06,
      clearcoatRoughness: 0.62,
      envMapIntensity: 0.95,
      emissive: 0x2b170e,
      emissiveIntensity: 0.14,
    })
  );

  const sleeveMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf2f4f7,
      bumpMap: textures.fabricWeaveBump,
      bumpScale: 0.008,
      roughness: 0.78,
      metalness: 0.02,
      envMapIntensity: 0.85,
      emissive: 0x1e293b,
      emissiveIntensity: 0.06,
    })
  );

  const cuffMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      bumpMap: textures.fabricWeaveBump,
      bumpScale: 0.008,
      roughness: 0.7,
      metalness: 0.03,
      envMapIntensity: 0.88,
      emissive: 0x1e293b,
      emissiveIntensity: 0.06,
    })
  );

  const watchStrapMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.68,
      metalness: 0.08,
    })
  );

  const watchMetalMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.25,
      metalness: 0.86,
    })
  );

  const watchDialMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.2,
      metalness: 0.04,
      emissive: 0xe2e8f0,
      emissiveIntensity: 0.1,
    })
  );

  // Shared anatomical finger geometries
  const palmGeom = trackGeom(new THREE.BoxGeometry(0.072, 0.025, 0.082));
  const wristGeom = trackGeom(new THREE.CylinderGeometry(0.025, 0.029, 0.054, 12));
  wristGeom.rotateX(Math.PI / 2);
  const sleeveGeom = trackGeom(new THREE.CylinderGeometry(0.035, 0.041, 0.18, 14));
  sleeveGeom.rotateX(Math.PI / 2);
  const cuffGeom = trackGeom(new THREE.CylinderGeometry(0.037, 0.037, 0.03, 14));
  cuffGeom.rotateX(Math.PI / 2);

  const fingerProxGeom = trackGeom(new THREE.CylinderGeometry(0.0072, 0.0082, 0.038, 8));
  fingerProxGeom.rotateX(Math.PI / 2);
  const fingerDistGeom = trackGeom(new THREE.CylinderGeometry(0.0059, 0.0071, 0.031, 8));
  fingerDistGeom.rotateX(Math.PI / 2);
  const fingerTipGeom = trackGeom(new THREE.SphereGeometry(0.006, 8, 6));

  const thumbProxGeom = trackGeom(new THREE.CylinderGeometry(0.0084, 0.0096, 0.034, 8));
  thumbProxGeom.rotateX(Math.PI / 2);
  const thumbDistGeom = trackGeom(new THREE.CylinderGeometry(0.0068, 0.0081, 0.028, 8));
  thumbDistGeom.rotateX(Math.PI / 2);

  const buildArm = (side: -1 | 1): THREE.Group => {
    const arm = new THREE.Group();

    const sleeve = new THREE.Mesh(sleeveGeom, sleeveMat);
    sleeve.position.set(0, 0, 0.12);

    const cuff = new THREE.Mesh(cuffGeom, cuffMat);
    cuff.position.set(0, 0, 0.042);

    const wrist = new THREE.Mesh(wristGeom, skinMat);
    wrist.position.set(0, -0.002, 0.016);

    if (side === -1) {
      // Clinical wristwatch on left wrist
      const strap = new THREE.Mesh(
        trackGeom(new THREE.TorusGeometry(0.0275, 0.0042, 6, 16)),
        watchStrapMat
      );
      strap.position.set(0, -0.001, 0.02);
      const bezel = new THREE.Mesh(
        trackGeom(new THREE.CylinderGeometry(0.014, 0.014, 0.006, 14)),
        watchMetalMat
      );
      bezel.position.set(0, 0.024, 0.02);
      const dial = new THREE.Mesh(
        trackGeom(new THREE.CylinderGeometry(0.011, 0.011, 0.007, 14)),
        watchDialMat
      );
      dial.position.set(0, 0.0242, 0.02);
      arm.add(strap, bezel, dial);
    }

    const palm = new THREE.Mesh(palmGeom, skinMat);
    palm.position.set(0, -0.004, -0.042);

    // 4 main articulated fingers (Index, Middle, Ring, Pinky)
    // Inner thumb side is x = -side * 0.026 (so left arm's thumb points +X inward, right arm's thumb points -X inward)
    const fingerSpecs = [
      { x: -side * 0.023, lenScale: 0.96, splay: -side * 0.05 },
      { x: -side * 0.0075, lenScale: 1.04, splay: -side * 0.015 },
      { x: side * 0.0085, lenScale: 0.98, splay: side * 0.025 },
      { x: side * 0.0235, lenScale: 0.80, splay: side * 0.065 },
    ];
    for (const f of fingerSpecs) {
      const fRoot = new THREE.Group();
      fRoot.position.set(f.x, -0.001, -0.078);
      fRoot.rotation.set(-0.22, f.splay, 0);

      const prox = new THREE.Mesh(fingerProxGeom, skinMat);
      prox.scale.set(1, 1, f.lenScale);
      prox.position.set(0, 0, -0.017 * f.lenScale);

      const distJoint = new THREE.Group();
      distJoint.position.set(0, 0, -0.034 * f.lenScale);
      distJoint.rotation.x = -0.34;

      const dist = new THREE.Mesh(fingerDistGeom, skinMat);
      dist.scale.set(1, 1, f.lenScale);
      dist.position.set(0, 0, -0.014 * f.lenScale);

      const tip = new THREE.Mesh(fingerTipGeom, skinMat);
      tip.position.set(0, 0, -0.028 * f.lenScale);

      distJoint.add(dist, tip);
      fRoot.add(prox, distJoint);
      arm.add(fRoot);
    }

    // Articulated thumb facing inward toward center
    const thumbRoot = new THREE.Group();
    thumbRoot.position.set(-side * 0.032, -0.004, -0.026);
    thumbRoot.rotation.set(-0.12, -side * 0.52, side * 0.25);

    const tProx = new THREE.Mesh(thumbProxGeom, skinMat);
    tProx.position.set(0, 0, -0.015);
    const tDistJoint = new THREE.Group();
    tDistJoint.position.set(0, 0, -0.029);
    tDistJoint.rotation.set(-0.14, side * 0.18, 0);
    const tDist = new THREE.Mesh(thumbDistGeom, skinMat);
    tDist.position.set(0, 0, -0.012);
    const tTip = new THREE.Mesh(fingerTipGeom, skinMat);
    tTip.position.set(0, 0, -0.025);
    tDistJoint.add(tDist, tTip);
    thumbRoot.add(tProx, tDistJoint);

    arm.add(sleeve, cuff, wrist, palm, thumbRoot);
    return arm;
  };

  const leftArm = buildArm(-1);
  const rightArm = buildArm(1);
  group.add(leftArm, rightArm);
  group.traverse((obj) => {
    obj.frustumCulled = false;
    if ((obj as THREE.Mesh).isMesh) {
      obj.renderOrder = 3;
    }
  });
  group.visible = false;

  const updateAppearance = (profile?: PlayerCharacterConfig) => {
    skinMat.color.set(PLAYER_DEFAULT_SKIN);
    if (profile) {
      const meta = resolvePlayerOutfitMeta(profile.outfitId);
      if (meta.medicalWear === 'lab_coat') {
        sleeveMat.color.setHex(0xf2f4f7);
        cuffMat.color.setHex(0xe2e8f0);
      } else {
        sleeveMat.color.set(meta.shirtColor);
        cuffMat.color.set(meta.shirtColor).lerp(new THREE.Color(0xffffff), 0.14);
      }
    } else {
      sleeveMat.color.setHex(0xf2f4f7);
      cuffMat.color.setHex(0xe2e8f0);
    }
  };

  updateAppearance(initialProfile);

  const halfHeightAtArm = 0.38 * Math.tan(THREE.MathUtils.degToRad(60 * 0.5));
  let holdBlend = 0;

  const solveArmGripPose = (
    side: -1 | 1,
    tx: number,
    ty: number,
    tz: number,
    style: 'pole' | 'bar' | 'crate'
  ) => {
    const shX = side * 0.24;
    const shY = -0.22;
    const shZ = 0.04;
    const dx = tx - shX;
    const dy = ty - shY;
    const dz = tz - shZ;
    const horiz = Math.max(0.12, Math.hypot(dx, dz));
    const yaw = Math.atan2(-dx, -dz);
    const pitch = Math.atan2(dy, horiz);

    // Offset arm origin slightly back toward shoulder so palm center (-0.055 Z) clamps directly on target
    const invLen = 1 / Math.max(0.15, Math.hypot(dx, dy, dz));
    const backDist = 0.056;
    const posX = tx - dx * invLen * backDist;
    const posY = ty - dy * invLen * backDist + 0.008;
    const posZ = tz - dz * invLen * backDist;

    const roll =
      style === 'pole'
        ? -side * 1.12
        : style === 'crate'
          ? -side * 0.88
          : -side * 0.16;

    return { posX, posY, posZ, pitch, yaw, roll };
  };

  const updateMotion = (
    fppSmooth: number,
    walkBob: number,
    timeSec: number,
    isSpeakingOrExam: boolean,
    aspect = 1.6,
    gripTarget?: FppHandGripTarget
  ) => {
    const visible = fppSmooth > 0.48;
    group.visible = visible;
    if (!visible) {
      holdBlend = 0;
      return;
    }

    const t = THREE.MathUtils.clamp((fppSmooth - 0.48) / 0.52, 0, 1);
    const easeIn = t * t * t * (t * (t * 6 - 15) + 10);
    const dropY = (1 - easeIn) * -0.14;

    const halfWidth = halfHeightAtArm * Math.max(0.46, aspect);
    const armX = Math.min(0.168, halfWidth * 0.65);

    const breath = Math.sin(timeSec * 1.75) * 0.0032;
    const walkSin = Math.sin(walkBob);
    const walkCos = Math.cos(walkBob * 2);
    const examGesture = isSpeakingOrExam && !gripTarget?.active ? Math.sin(timeSec * 3.1) * 0.012 : 0;

    const targetHold = gripTarget?.active ? 1 : 0;
    holdBlend += (targetHold - holdBlend) * 0.22;

    const idleLX = -armX;
    const idleLY = -0.106 + dropY + breath + walkCos * 0.0038;
    const idleLZ = -0.38 + walkSin * 0.011;
    const idleLPitch = 0.24 + breath * 1.6 + examGesture;
    const idleLYaw = -0.28;
    const idleLRoll = -0.16;

    const idleRX = armX;
    const idleRY = -0.106 + dropY + breath + walkCos * 0.0038 + Math.abs(examGesture) * 0.45;
    const idleRZ = -0.38 - walkSin * 0.011 - (isSpeakingOrExam && !gripTarget?.active ? 0.014 : 0);
    const idleRPitch = 0.26 + breath * 1.6 + examGesture * 1.3;
    const idleRYaw = 0.30;
    const idleRRoll = 0.16;

    if (holdBlend > 0.01 && gripTarget) {
      const lGrip = solveArmGripPose(-1, gripTarget.leftX, gripTarget.leftY, gripTarget.leftZ, gripTarget.style);
      const rGrip = solveArmGripPose(1, gripTarget.rightX, gripTarget.rightY, gripTarget.rightZ, gripTarget.style);
      const bobGripY = walkCos * 0.0028;

      leftArm.position.set(
        THREE.MathUtils.lerp(idleLX, lGrip.posX, holdBlend),
        THREE.MathUtils.lerp(idleLY, lGrip.posY + bobGripY, holdBlend),
        THREE.MathUtils.lerp(idleLZ, lGrip.posZ, holdBlend)
      );
      leftArm.rotation.set(
        THREE.MathUtils.lerp(idleLPitch, lGrip.pitch, holdBlend),
        THREE.MathUtils.lerp(idleLYaw, lGrip.yaw, holdBlend),
        THREE.MathUtils.lerp(idleLRoll, lGrip.roll, holdBlend)
      );

      rightArm.position.set(
        THREE.MathUtils.lerp(idleRX, rGrip.posX, holdBlend),
        THREE.MathUtils.lerp(idleRY, rGrip.posY + bobGripY, holdBlend),
        THREE.MathUtils.lerp(idleRZ, rGrip.posZ, holdBlend)
      );
      rightArm.rotation.set(
        THREE.MathUtils.lerp(idleRPitch, rGrip.pitch, holdBlend),
        THREE.MathUtils.lerp(idleRYaw, rGrip.yaw, holdBlend),
        THREE.MathUtils.lerp(idleRRoll, rGrip.roll, holdBlend)
      );
    } else {
      leftArm.position.set(idleLX, idleLY, idleLZ);
      leftArm.rotation.set(idleLPitch, idleLYaw, idleLRoll);
      rightArm.position.set(idleRX, idleRY, idleRZ);
      rightArm.rotation.set(idleRPitch, idleRYaw, idleRRoll);
    }
  };

  return {
    group,
    leftArm,
    rightArm,
    updateAppearance,
    updateMotion,
    dispose: () => {
      for (const d of disposables) d.dispose();
    },
  };
}
