import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { resolvePlayerOutfitMeta } from '../data/catalog';
import { PlayerCharacterConfig, SpriteKind } from '../types/clinic';
import { glbRegistry } from './glbRegistry';
import { TextureBundle } from './textures3d';

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

export interface FppHandInteractionContext {
  velRight: number;
  velForward: number;
  yawVel: number;
  pitchVel: number;
  focusBlend: number;
  isDraggingProbe: boolean;
  hasSelectedProbe: boolean;
  probeTargetCamX: number;
  probeTargetCamY: number;
  probeTargetCamZ: number;
  consoleTapPulse: number;
  activeDeviceSprite: SpriteKind | null;
  handshakeBlend?: number;
  handshakeOsc?: number;
  handshakeTargetCamX?: number;
  handshakeTargetCamY?: number;
  handshakeTargetCamZ?: number;
  probePressBlend?: number;
  probeReleaseBlend?: number;
  probeAxisCamX?: number;
  probeAxisCamY?: number;
  probeAxisCamZ?: number;
  probeActionMode?: 'pad' | 'wand' | 'wrap' | 'aim' | 'setup' | 'hold_wand';
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
    gripTarget?: FppHandGripTarget,
    interaction?: FppHandInteractionContext
  ) => void;
  dispose: () => void;
}

function createWallEngravingTextures(maxAniso: number): {
  colorTex: THREE.CanvasTexture;
  bumpTex: THREE.CanvasTexture;
} {
  const W = 3840;
  const H = 1184;
  const TEX_SCALE = 0.5;

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = Math.round(W * TEX_SCALE);
  colorCanvas.height = Math.round(H * TEX_SCALE);
  const cCtx = colorCanvas.getContext('2d');

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = Math.round(W * TEX_SCALE);
  bumpCanvas.height = Math.round(H * TEX_SCALE);
  const bCtx = bumpCanvas.getContext('2d');

  const aniso = Math.min(8, Math.max(4, maxAniso || 4));
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
    cCtx.setTransform(TEX_SCALE, 0, 0, TEX_SCALE, 0, 0);
    bCtx.setTransform(TEX_SCALE, 0, 0, TEX_SCALE, 0, 0);
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

      ctx.fillStyle = lineColor;
      ctx.fillRect(W / 2 - 920 + offsetX, 588 + offsetY, 1840, 12);

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

    drawTextPass(
      cCtx,
      'rgba(7, 34, 78, 0.36)',
      'rgba(7, 34, 78, 0.32)',
      'rgba(7, 34, 78, 0.36)',
      'rgba(7, 34, 78, 0.24)',
      0,
      7
    );

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
    new THREE.MeshStandardMaterial({
      map: fppPlasterAlbedo,
      bumpMap: fppStuccoBump,
      roughnessMap: fppPlasterRough,
      bumpScale: 0.022,
      roughness: 0.88,
      metalness: 0.0,
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
    new THREE.MeshStandardMaterial({
      map: fppWainscotAlbedo,
      bumpMap: fppWainscotBump,
      bumpScale: 0.018,
      roughness: 0.46,
      metalness: 0.06,
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
    new THREE.MeshStandardMaterial({
      color: 0x242e3c,
      bumpMap: fppMetalBump,
      bumpScale: 0.004,
      roughness: 0.34,
      metalness: 0.64,
      envMapIntensity: 0.85,
    })
  );

  const aluminumMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xc8d2de,
      bumpMap: fppMetalBump,
      bumpScale: 0.005,
      roughness: 0.26,
      metalness: 0.84,
      envMapIntensity: 0.95,
    })
  );

  const woodSlatMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: fppWoodColor,
      bumpMap: fppWoodBump,
      bumpScale: 0.016,
      roughness: 0.54,
      metalness: 0.02,
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
    new THREE.MeshStandardMaterial({
      map: floorColorTex,
      roughnessMap: floorRoughTex,
      normalMap: floorNormTex,
      normalScale: new THREE.Vector2(0.46, 0.46),
      roughness: 0.50,
      metalness: 0.04,
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
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfff8eb,
      emissiveIntensity: 0.78,
      roughness: 0.2,
    })
  );

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

  const buildWallSpan = (spanLen: number, x: number, z: number, rotY: number) => {
    const wg = new THREE.Group();
    wg.position.set(x, 0, z);
    wg.rotation.y = rotY;

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

    const wain = new THREE.Mesh(
      trackGeom(new THREE.BoxGeometry(spanLen, wainH, 0.065)),
      wainscotMat
    );
    wain.position.set(0, wainH / 2, 0);
    wain.receiveShadow = enableShadows;

    const panelCount = Math.max(4, Math.round(spanLen / 0.68));
    const stepX = (spanLen - 0.44) / panelCount;
    for (let i = 0; i <= panelCount; i++) {
      const sx = -spanLen * 0.5 + 0.22 + i * stepX;
      const stile = new THREE.Mesh(stileGeom, wainscotMat);
      stile.position.set(sx, 0.106, 0.031);
      stile.receiveShadow = enableShadows;
      wg.add(stile);
    }

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

    const upper = new THREE.Mesh(
      trackGeom(new THREE.BoxGeometry(spanLen, upperH, 0.06)),
      plasterMat
    );
    upper.position.set(0, wainH + upperH / 2, 0);
    upper.receiveShadow = enableShadows;

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

  buildWallSpan(roomW + 0.12, 0, backZ, 0);
  buildWallSpan(roomW + 0.12, 0, frontZ, Math.PI);
  buildWallSpan(roomD + 0.12, -roomW / 2, centerZ, Math.PI / 2);
  buildWallSpan(roomD + 0.12, roomW / 2, centerZ, -Math.PI / 2);

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

  const trofferBezel = new THREE.Mesh(
    trackGeom(new THREE.BoxGeometry(1.26, 0.02, 0.54)),
    aluminumMat
  );
  trofferBezel.position.set(0, wallH - 0.01, 0.52);
  const trofferRecess = new THREE.Mesh(
    trackGeom(new THREE.BoxGeometry(1.2, 0.014, 0.48)),
    darkTrimMat
  );
  trofferRecess.position.set(0, wallH - 0.023, 0.52);
  const ceilingLightPanel = new THREE.Mesh(
    trackGeom(new THREE.BoxGeometry(1.16, 0.012, 0.44)),
    ceilingPanelMat
  );
  ceilingLightPanel.position.set(0, wallH - 0.032, 0.52);
  group.add(trofferBezel, trofferRecess, ceilingLightPanel);

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
      trackGeom(new THREE.BoxGeometry(0.59, 1.59, 0.012)),
      aluminumMat
    );
    outerFrame.position.set(flankX, 1.74, backZ + 0.038);
    const backing = new THREE.Mesh(
      trackGeom(new THREE.BoxGeometry(0.56, 1.56, 0.012)),
      darkTrimMat
    );
    backing.position.set(flankX, 1.74, backZ + 0.048);
    backing.receiveShadow = enableShadows;
    group.add(outerFrame, backing);
    for (let si = -2; si <= 2; si++) {
      const slat = new THREE.Mesh(beveledSlatGeom, woodSlatMat);
      slat.position.set(flankX + si * 0.105, 1.74, backZ + 0.066);
      slat.castShadow = enableShadows;
      slat.receiveShadow = enableShadows;
      group.add(slat);
    }
  }

  const wallEngraving = new THREE.Mesh(
    trackGeom(new THREE.PlaneGeometry(2.38, 0.74)),
    wallEngravingMat
  );
  wallEngraving.position.set(0, 1.56, backZ + 0.04);
  wallEngraving.renderOrder = 1;
  group.add(wallEngraving);

  const coveHousing = new THREE.Mesh(
    trackGeom(new THREE.BoxGeometry(2.02, 0.032, 0.056)),
    darkTrimMat
  );
  coveHousing.position.set(0, wallH - 0.056, backZ + 0.095);
  const coveBar = new THREE.Mesh(
    trackGeom(new THREE.BoxGeometry(1.94, 0.018, 0.034)),
    warmCoveMat
  );
  coveBar.position.set(0, wallH - 0.082, backZ + 0.095);
  group.add(coveHousing, coveBar);

  // Calibrated Three-Point Clinical FPP Illumination (also fills clinician side of bay smoothly)
  const wallLight = new THREE.PointLight(0xffe9c8, 1.12, 8.4, 1.15);
  wallLight.castShadow = false;
  wallLight.position.set(0, 2.28, backZ + 0.95);
  group.add(wallLight);

  const roomFillLight = new THREE.PointLight(0xfff4e8, 1.06, 12.0, 1.05);
  roomFillLight.castShadow = false;
  roomFillLight.position.set(0.18, 2.38, 1.72);
  group.add(roomFillLight);

  const examKeySpot = new THREE.SpotLight(
    0xfffaf0,
    enableShadows ? 2.45 : 1.38,
    11.2,
    Math.PI / 2.2,
    0.85,
    1.05
  );
  examKeySpot.position.set(0.32, wallH - 0.06, 0.72);
  examKeySpot.target.position.set(0, 0.42, -0.2);
  if (enableShadows) {
    examKeySpot.castShadow = true;
    examKeySpot.shadow.mapSize.set(768, 768);
    examKeySpot.shadow.camera.near = 0.4;
    examKeySpot.shadow.camera.far = 7.8;
    examKeySpot.shadow.bias = -0.00045;
    examKeySpot.shadow.normalBias = 0.016;
    examKeySpot.shadow.radius = 2.2;
  }
  group.add(examKeySpot, examKeySpot.target);

  const setLightFactor = (alpha: number, isNight = false) => {
    const a = THREE.MathUtils.clamp(alpha, 0, 1);
    wallLight.intensity = a * (isNight ? 1.52 : 1.14);
    roomFillLight.intensity = a * (isNight ? 1.32 : 1.06);
    examKeySpot.intensity =
      a * (enableShadows ? (isNight ? 2.68 : 2.38) : isNight ? 1.58 : 1.36);
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

// ============================================================================
// Realistic Rigged 3D Clinician Hands & Gender/Outfit-Aware Forearms
// ============================================================================

interface AnatomicalSkinTexSet {
  albedoTex: THREE.DataTexture;
  normalTex: THREE.DataTexture;
  roughTex: THREE.DataTexture;
}

const handTexSetCache = new Map<-1 | 1, AnatomicalSkinTexSet>();
let forearmTexSetCache: AnatomicalSkinTexSet | null = null;

function finalizeDataTexture(
  data: Uint8Array,
  width: number,
  height: number,
  srgb: boolean
): THREE.DataTexture {
  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.flipY = false;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function buildNormalMapFromHeight(
  heightBuf: Float32Array,
  width: number,
  height: number,
  strength: number
): THREE.DataTexture {
  const out = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const ym = y > 0 ? y - 1 : 0;
    const yp = y < height - 1 ? y + 1 : height - 1;
    for (let x = 0; x < width; x++) {
      const xm = x > 0 ? x - 1 : 0;
      const xp = x < width - 1 ? x + 1 : width - 1;

      const tl = heightBuf[ym * width + xm];
      const tc = heightBuf[ym * width + x];
      const tr = heightBuf[ym * width + xp];
      const ml = heightBuf[y * width + xm];
      const mr = heightBuf[y * width + xp];
      const bl = heightBuf[yp * width + xm];
      const bc = heightBuf[yp * width + x];
      const br = heightBuf[yp * width + xp];

      const dhdu = (tr + 2 * mr + br - (tl + 2 * ml + bl)) * strength;
      const dhdv = (bl + 2 * bc + br - (tl + 2 * tc + tr)) * strength;
      const nx = -dhdu;
      const ny = -dhdv;
      const nz = 1.0;
      const inv = 1.0 / Math.hypot(nx, ny, nz);
      const p = (y * width + x) * 4;
      out[p] = Math.round((nx * inv * 0.5 + 0.5) * 255);
      out[p + 1] = Math.round((ny * inv * 0.5 + 0.5) * 255);
      out[p + 2] = Math.round((nz * inv * 0.5 + 0.5) * 255);
      out[p + 3] = 255;
    }
  }
  return finalizeDataTexture(out, width, height, false);
}

function dilateBakedBuffers(
  covered: Uint8Array,
  albedo: Uint8Array,
  heightBuf: Float32Array,
  roughBuf: Uint8Array,
  size: number,
  passes = 3
): void {
  let curMask = covered;
  for (let pass = 0; pass < passes; pass++) {
    const nextMask = curMask.slice();
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = y * size + x;
        if (curMask[idx]) continue;

        let sumR = 0;
        let sumG = 0;
        let sumB = 0;
        let sumH = 0;
        let sumRo = 0;
        let count = 0;

        for (let dy = -1; dy <= 1; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= size) continue;
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            if (nx < 0 || nx >= size) continue;
            const nIdx = ny * size + nx;
            if (!curMask[nIdx]) continue;
            const p = nIdx * 4;
            sumR += albedo[p];
            sumG += albedo[p + 1];
            sumB += albedo[p + 2];
            sumH += heightBuf[nIdx];
            sumRo += roughBuf[p];
            count++;
          }
        }

        if (count > 0) {
          const p = idx * 4;
          albedo[p] = Math.round(sumR / count);
          albedo[p + 1] = Math.round(sumG / count);
          albedo[p + 2] = Math.round(sumB / count);
          albedo[p + 3] = 255;
          heightBuf[idx] = sumH / count;
          const roVal = Math.round(sumRo / count);
          roughBuf[p] = roVal;
          roughBuf[p + 1] = roVal;
          roughBuf[p + 2] = roVal;
          roughBuf[p + 3] = 255;
          nextMask[idx] = 1;
        }
      }
    }
    curMask = nextMask;
  }
}

function hash3D(x: number, y: number, z: number): number {
  const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return h - Math.floor(h);
}

function valueNoise3D(x: number, y: number, z: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const uz = fz * fz * (3 - 2 * fz);

  const c000 = hash3D(ix, iy, iz);
  const c100 = hash3D(ix + 1, iy, iz);
  const c010 = hash3D(ix, iy + 1, iz);
  const c110 = hash3D(ix + 1, iy + 1, iz);
  const c001 = hash3D(ix, iy, iz + 1);
  const c101 = hash3D(ix + 1, iy, iz + 1);
  const c011 = hash3D(ix, iy + 1, iz + 1);
  const c111 = hash3D(ix + 1, iy + 1, iz + 1);

  const x00 = c000 + (c100 - c000) * ux;
  const x10 = c010 + (c110 - c010) * ux;
  const x01 = c001 + (c101 - c001) * ux;
  const x11 = c011 + (c111 - c011) * ux;
  const y0 = x00 + (x10 - x00) * uy;
  const y1 = x01 + (x11 - x01) * uy;
  return y0 + (y1 - y0) * uz;
}

function distToSeg2D(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): { dist: number; t: number } {
  const vx = bx - ax;
  const vy = by - ay;
  const lenSq = vx * vx + vy * vy || 1e-8;
  const t = THREE.MathUtils.clamp(((px - ax) * vx + (py - ay) * vy) / lenSq, 0, 1);
  const cx = ax + vx * t;
  const cy = ay + vy * t;
  return { dist: Math.hypot(px - cx, py - cy), t };
}

const FINGER_GROUPS = [
  'index-finger',
  'middle-finger',
  'ring-finger',
  'pinky-finger',
] as const;

interface FingerPoseParams {
  indexCurl: number;
  middleCurl: number;
  ringCurl: number;
  pinkyCurl: number;
  thumbCurl: number;
  thumbOpp: number;
  splay: number;
}

interface FlatFkBone {
  bone: THREE.Object3D;
  parentIdx: number; // -1 for wrist root
  restPos: THREE.Vector3;
  restQuat: THREE.Quaternion;
  offsetFromParent: THREE.Vector3;
  relRestQuat: THREE.Quaternion;
  curPos: THREE.Vector3;
  curQuat: THREE.Quaternion;
  chainRole: 'root' | 'thumb_mcp' | 'thumb_prox' | 'thumb_dist' | 'finger_mcp' | 'finger_prox' | 'finger_mid' | 'finger_dist' | 'tip';
  fingerSlot: number; // 0=thumb, 1=index, 2=middle, 3=ring, 4=pinky
}

interface HandSkeletonRig {
  side: -1 | 1;
  bones: FlatFkBone[];
  lastPose: FingerPoseParams;
  hasAppliedPose: boolean;
  lastIsFemale: boolean | null;
}

const _fkDeltaEuler = new THREE.Euler(0, 0, 0, 'XYZ');
const _fkDeltaQuat = new THREE.Quaternion();
const _fkOffsetTmp = new THREE.Vector3();

function buildFlatFkRig(skinnedMesh: THREE.SkinnedMesh, side: -1 | 1): HandSkeletonRig {
  const boneByName = new Map<string, THREE.Object3D>();
  for (const b of skinnedMesh.skeleton.bones) {
    boneByName.set(b.name, b);
  }

  const orderedEntries: Array<{
    name: string;
    parentName: string | null;
    role: FlatFkBone['chainRole'];
    slot: number;
  }> = [
    { name: 'wrist', parentName: null, role: 'root', slot: -1 },
    { name: 'thumb-metacarpal', parentName: 'wrist', role: 'thumb_mcp', slot: 0 },
    { name: 'thumb-phalanx-proximal', parentName: 'thumb-metacarpal', role: 'thumb_prox', slot: 0 },
    { name: 'thumb-phalanx-distal', parentName: 'thumb-phalanx-proximal', role: 'thumb_dist', slot: 0 },
    { name: 'thumb-tip', parentName: 'thumb-phalanx-distal', role: 'tip', slot: 0 },
  ];

  FINGER_GROUPS.forEach((prefix, idx) => {
    const slot = idx + 1;
    orderedEntries.push(
      { name: `${prefix}-metacarpal`, parentName: 'wrist', role: 'finger_mcp', slot },
      { name: `${prefix}-phalanx-proximal`, parentName: `${prefix}-metacarpal`, role: 'finger_prox', slot },
      { name: `${prefix}-phalanx-intermediate`, parentName: `${prefix}-phalanx-proximal`, role: 'finger_mid', slot },
      { name: `${prefix}-phalanx-distal`, parentName: `${prefix}-phalanx-intermediate`, role: 'finger_dist', slot },
      { name: `${prefix}-tip`, parentName: `${prefix}-phalanx-distal`, role: 'tip', slot }
    );
  });

  const indexMap = new Map<string, number>();
  const bones: FlatFkBone[] = [];

  for (const entry of orderedEntries) {
    const bone = boneByName.get(entry.name);
    if (!bone) continue;
    const myIdx = bones.length;
    indexMap.set(entry.name, myIdx);
    const parentIdx = entry.parentName ? (indexMap.get(entry.parentName) ?? -1) : -1;
    const restPos = bone.position.clone();
    const restQuat = bone.quaternion.clone();
    const offsetFromParent = new THREE.Vector3();
    const relRestQuat = new THREE.Quaternion();

    if (parentIdx >= 0) {
      const p = bones[parentIdx];
      const invP = p.restQuat.clone().invert();
      offsetFromParent.copy(restPos).sub(p.restPos).applyQuaternion(invP);
      relRestQuat.copy(invP).multiply(restQuat);
    }

    bones.push({
      bone,
      parentIdx,
      restPos,
      restQuat,
      offsetFromParent,
      relRestQuat,
      curPos: restPos.clone(),
      curQuat: restQuat.clone(),
      chainRole: entry.role,
      fingerSlot: entry.slot,
    });
  }

  return {
    side,
    bones,
    lastPose: {
      indexCurl: -1,
      middleCurl: -1,
      ringCurl: -1,
      pinkyCurl: -1,
      thumbCurl: -1,
      thumbOpp: -1,
      splay: -1,
    },
    hasAppliedPose: false,
    lastIsFemale: null,
  };
}

/**
 * Zero-cost anatomical gender sculpting via existing rigged phalanx cross-section scales.
 * Slims finger shafts smoothly toward tapered fingertips with sub-0.2mm joint distortion.
 */
function applyGenderBoneTaper(rig: HandSkeletonRig, isFemale: boolean): void {
  if (rig.lastIsFemale === isFemale) return;
  rig.lastIsFemale = isFemale;
  for (let i = 0; i < rig.bones.length; i++) {
    const b = rig.bones[i];
    if (!isFemale) {
      b.bone.scale.set(1, 1, 1);
      continue;
    }
    if (b.chainRole === 'thumb_prox' || b.chainRole === 'finger_prox') {
      b.bone.scale.set(0.95, 0.95, 1.0);
    } else if (b.chainRole === 'finger_mid') {
      b.bone.scale.set(0.91, 0.91, 1.0);
    } else if (b.chainRole === 'thumb_dist' || b.chainRole === 'finger_dist' || b.chainRole === 'tip') {
      b.bone.scale.set(0.87, 0.87, 1.0);
    } else {
      b.bone.scale.set(1, 1, 1);
    }
  }
}

function applyHandFkPose(rig: HandSkeletonRig, pose: FingerPoseParams): void {
  const lp = rig.lastPose;
  if (
    rig.hasAppliedPose &&
    Math.abs(lp.indexCurl - pose.indexCurl) < 0.0018 &&
    Math.abs(lp.middleCurl - pose.middleCurl) < 0.0018 &&
    Math.abs(lp.ringCurl - pose.ringCurl) < 0.0018 &&
    Math.abs(lp.pinkyCurl - pose.pinkyCurl) < 0.0018 &&
    Math.abs(lp.thumbCurl - pose.thumbCurl) < 0.0018 &&
    Math.abs(lp.thumbOpp - pose.thumbOpp) < 0.0018 &&
    Math.abs(lp.splay - pose.splay) < 0.0018
  ) {
    return;
  }

  lp.indexCurl = pose.indexCurl;
  lp.middleCurl = pose.middleCurl;
  lp.ringCurl = pose.ringCurl;
  lp.pinkyCurl = pose.pinkyCurl;
  lp.thumbCurl = pose.thumbCurl;
  lp.thumbOpp = pose.thumbOpp;
  lp.splay = pose.splay;
  rig.hasAppliedPose = true;

  const s = rig.side;
  const splayVals = [0, -1.0, -0.25, 0.35, 1.05];

  for (let i = 0; i < rig.bones.length; i++) {
    const b = rig.bones[i];
    if (b.parentIdx < 0) {
      b.curPos.copy(b.restPos);
      b.curQuat.copy(b.restQuat);
      continue;
    }

    const parent = rig.bones[b.parentIdx];
    _fkOffsetTmp.copy(b.offsetFromParent).applyQuaternion(parent.curQuat);
    b.curPos.copy(parent.curPos).add(_fkOffsetTmp);

    let rx = 0;
    let ry = 0;
    const fingerCurl =
      b.fingerSlot === 1
        ? pose.indexCurl
        : b.fingerSlot === 2
          ? pose.middleCurl
          : b.fingerSlot === 3
            ? pose.ringCurl
            : b.fingerSlot === 4
              ? pose.pinkyCurl
              : pose.thumbCurl;

    // WebXR bone convention: -X flexes palmar (inward), +Y splays radially
    if (b.chainRole === 'thumb_mcp') {
      rx = -pose.thumbCurl * 0.20;
      ry = s * pose.thumbOpp * 0.40;
    } else if (b.chainRole === 'thumb_prox') {
      rx = -pose.thumbCurl * 0.50;
    } else if (b.chainRole === 'thumb_dist') {
      rx = -pose.thumbCurl * 0.66;
    } else if (b.chainRole === 'finger_prox') {
      rx = -fingerCurl * 0.92;
      ry = -s * pose.splay * splayVals[b.fingerSlot] * 0.11;
    } else if (b.chainRole === 'finger_mid') {
      rx = -fingerCurl * 1.06;
    } else if (b.chainRole === 'finger_dist') {
      rx = -fingerCurl * 0.68;
    }

    if (rx !== 0 || ry !== 0) {
      _fkDeltaEuler.set(rx, ry, 0, 'XYZ');
      _fkDeltaQuat.setFromEuler(_fkDeltaEuler);
      b.curQuat.copy(parent.curQuat).multiply(b.relRestQuat).multiply(_fkDeltaQuat);
    } else {
      b.curQuat.copy(parent.curQuat).multiply(b.relRestQuat);
    }

    b.bone.position.copy(b.curPos);
    b.bone.quaternion.copy(b.curQuat);
  }
}

/**
 * Rasterizes a 512x512 UV-aligned anatomical PBR skin texture set (Albedo + Tangent Normal + Roughness)
 * directly from the hand mesh geometry and skeleton ONCE per handedness and caches it module-wide.
 * Zero per-frame CPU overhead; renders pixel-sharp palm lines, knuckle folds, tendons, pores & nails.
 */
function getOrBakeHandTextureSet(
  geom: THREE.BufferGeometry,
  bones: THREE.Bone[],
  side: -1 | 1
): AnatomicalSkinTexSet {
  const existing = handTexSetCache.get(side);
  if (existing) return existing;

  const SIZE = 512;
  const total = SIZE * SIZE;
  const albedo = new Uint8Array(total * 4);
  const heightBuf = new Float32Array(total);
  const roughBuf = new Uint8Array(total * 4);
  const covered = new Uint8Array(total);

  // Warm Sudanese mid-skin fill background prevents mipmap black edge bleeding
  for (let i = 0; i < total; i++) {
    const p = i * 4;
    albedo[p] = 170;
    albedo[p + 1] = 114;
    albedo[p + 2] = 82;
    albedo[p + 3] = 255;
    heightBuf[i] = 0.5;
    roughBuf[p] = 184;
    roughBuf[p + 1] = 184;
    roughBuf[p + 2] = 184;
    roughBuf[p + 3] = 255;
  }

  const posAttr = geom.getAttribute('position') as THREE.BufferAttribute;
  const nrmAttr = geom.getAttribute('normal') as THREE.BufferAttribute;
  const uvAttr = geom.getAttribute('uv') as THREE.BufferAttribute;
  const indexAttr = geom.getIndex();

  const boneMap = new Map<string, THREE.Bone>();
  for (const b of bones) boneMap.set(b.name, b);

  interface NailDesc {
    dPos: THREE.Vector3;
    dir: THREE.Vector3;
    up: THREE.Vector3;
    lat: THREE.Vector3;
    startAlong: number;
    endAlong: number;
    halfWidth: number;
  }

  interface JointDesc {
    pos: THREE.Vector3;
    dir: THREE.Vector3;
    up: THREE.Vector3;
    kind: 'mcp' | 'pip' | 'dip';
    radiusSq: number;
  }

  interface TendonRay {
    ay: number;
    az: number;
    by: number;
    bz: number;
  }

  const nailSpecDefs = [
    { d: 'thumb-phalanx-distal', t: 'thumb-tip', s: 0.0046, e: 0.0216, hw: 0.0070 },
    { d: 'index-finger-phalanx-distal', t: 'index-finger-tip', s: 0.0042, e: 0.0200, hw: 0.0050 },
    { d: 'middle-finger-phalanx-distal', t: 'middle-finger-tip', s: 0.0056, e: 0.0224, hw: 0.0053 },
    { d: 'ring-finger-phalanx-distal', t: 'ring-finger-tip', s: 0.0048, e: 0.0212, hw: 0.0047 },
    { d: 'pinky-finger-phalanx-distal', t: 'pinky-finger-tip', s: 0.0034, e: 0.0186, hw: 0.0043 },
  ];

  const nailDescs: NailDesc[] = [];
  for (const ns of nailSpecDefs) {
    const db = boneMap.get(ns.d);
    const tb = boneMap.get(ns.t);
    if (!db || !tb) continue;
    const dir = tb.position.clone().sub(db.position).normalize();
    const rawUp = new THREE.Vector3(0, 1, 0).applyQuaternion(db.quaternion);
    const up = rawUp.sub(dir.clone().multiplyScalar(rawUp.dot(dir))).normalize();
    const lat = new THREE.Vector3().crossVectors(dir, up).normalize();
    nailDescs.push({
      dPos: db.position.clone(),
      dir,
      up,
      lat,
      startAlong: ns.s,
      endAlong: ns.e,
      halfWidth: ns.hw,
    });
  }

  const jointDescs: JointDesc[] = [];
  const tendonRays: TendonRay[] = [];
  const wBone = boneMap.get('wrist');
  const wristY = wBone ? wBone.position.y - 0.006 : 0.050;
  const wristZ = wBone ? wBone.position.z + 0.004 : 0.012;

  const digitSpecs = [
    { prefix: 'thumb', isThumb: true, slot: 0 },
    { prefix: 'index-finger', isThumb: false, slot: 1 },
    { prefix: 'middle-finger', isThumb: false, slot: 2 },
    { prefix: 'ring-finger', isThumb: false, slot: 3 },
    { prefix: 'pinky-finger', isThumb: false, slot: 4 },
  ];

  for (const ds of digitSpecs) {
    const mcp = boneMap.get(`${ds.prefix}-metacarpal`);
    const prox = boneMap.get(`${ds.prefix}-phalanx-proximal`);
    const mid = ds.isThumb ? null : boneMap.get(`${ds.prefix}-phalanx-intermediate`);
    const dist = boneMap.get(`${ds.prefix}-phalanx-distal`);
    const tip = boneMap.get(`${ds.prefix}-tip`);

    if (prox && dist) {
      if (!ds.isThumb && mcp && mid) {
        const mcpDir = mid.position.clone().sub(mcp.position).normalize();
        const mcpRawUp = new THREE.Vector3(0, 1, 0).applyQuaternion(prox.quaternion);
        const mcpUp = mcpRawUp.sub(mcpDir.clone().multiplyScalar(mcpRawUp.dot(mcpDir))).normalize();
        jointDescs.push({
          pos: prox.position.clone(),
          dir: mcpDir,
          up: mcpUp,
          kind: 'mcp',
          radiusSq: 0.014 * 0.014,
        });
        tendonRays.push({
          ay: wristY,
          az: wristZ + (ds.slot - 2.4) * 0.0055,
          by: prox.position.y + 0.005,
          bz: prox.position.z,
        });

        const pipDir = dist.position.clone().sub(prox.position).normalize();
        const pipRawUp = new THREE.Vector3(0, 1, 0).applyQuaternion(mid.quaternion);
        const pipUp = pipRawUp.sub(pipDir.clone().multiplyScalar(pipRawUp.dot(pipDir))).normalize();
        jointDescs.push({
          pos: mid.position.clone(),
          dir: pipDir,
          up: pipUp,
          kind: 'pip',
          radiusSq: 0.012 * 0.012,
        });

        const dipDir = (tip ? tip.position : dist.position).clone().sub(mid.position).normalize();
        const dipRawUp = new THREE.Vector3(0, 1, 0).applyQuaternion(dist.quaternion);
        const dipUp = dipRawUp.sub(dipDir.clone().multiplyScalar(dipRawUp.dot(dipDir))).normalize();
        jointDescs.push({
          pos: dist.position.clone(),
          dir: dipDir,
          up: dipUp,
          kind: 'dip',
          radiusSq: 0.010 * 0.010,
        });
      } else if (ds.isThumb && mcp) {
        const tPipDir = dist.position.clone().sub(mcp.position).normalize();
        const tRawUp = new THREE.Vector3(0, 1, 0).applyQuaternion(prox.quaternion);
        const tUp = tRawUp.sub(tPipDir.clone().multiplyScalar(tRawUp.dot(tPipDir))).normalize();
        jointDescs.push({
          pos: prox.position.clone(),
          dir: tPipDir,
          up: tUp,
          kind: 'pip',
          radiusSq: 0.014 * 0.014,
        });
        const tDipDir = (tip ? tip.position : dist.position).clone().sub(prox.position).normalize();
        const tdRawUp = new THREE.Vector3(0, 1, 0).applyQuaternion(dist.quaternion);
        const tdUp = tdRawUp.sub(tDipDir.clone().multiplyScalar(tdRawUp.dot(tDipDir))).normalize();
        jointDescs.push({
          pos: dist.position.clone(),
          dir: tDipDir,
          up: tdUp,
          kind: 'dip',
          radiusSq: 0.012 * 0.012,
        });
      }
    }
  }

  const p0 = new THREE.Vector3();
  const p1 = new THREE.Vector3();
  const p2 = new THREE.Vector3();
  const n0 = new THREE.Vector3();
  const n1 = new THREE.Vector3();
  const n2 = new THREE.Vector3();

  const triCount = indexAttr ? indexAttr.count / 3 : posAttr.count / 3;

  for (let t = 0; t < triCount; t++) {
    const i0 = indexAttr ? indexAttr.getX(t * 3) : t * 3;
    const i1 = indexAttr ? indexAttr.getX(t * 3 + 1) : t * 3 + 1;
    const i2 = indexAttr ? indexAttr.getX(t * 3 + 2) : t * 3 + 2;

    const u0 = uvAttr.getX(i0) * SIZE;
    const v0 = uvAttr.getY(i0) * SIZE;
    const u1 = uvAttr.getX(i1) * SIZE;
    const v1 = uvAttr.getY(i1) * SIZE;
    const u2 = uvAttr.getX(i2) * SIZE;
    const v2 = uvAttr.getY(i2) * SIZE;

    const area = (u1 - u0) * (v2 - v0) - (v1 - v0) * (u2 - u0);
    if (Math.abs(area) < 1e-4) continue;
    const invArea = 1 / area;

    p0.fromBufferAttribute(posAttr, i0);
    p1.fromBufferAttribute(posAttr, i1);
    p2.fromBufferAttribute(posAttr, i2);
    n0.fromBufferAttribute(nrmAttr, i0);
    n1.fromBufferAttribute(nrmAttr, i1);
    n2.fromBufferAttribute(nrmAttr, i2);

    const minX = Math.max(0, Math.floor(Math.min(u0, u1, u2) - 0.5));
    const maxX = Math.min(SIZE - 1, Math.ceil(Math.max(u0, u1, u2) + 0.5));
    const minY = Math.max(0, Math.floor(Math.min(v0, v1, v2) - 0.5));
    const maxY = Math.min(SIZE - 1, Math.ceil(Math.max(v0, v1, v2) + 0.5));

    for (let py = minY; py <= maxY; py++) {
      const cy = py + 0.5;
      for (let px = minX; px <= maxX; px++) {
        const cx = px + 0.5;
        let w0 = ((u1 - cx) * (v2 - cy) - (v1 - cy) * (u2 - cx)) * invArea;
        let w1 = ((u2 - cx) * (v0 - cy) - (v2 - cy) * (u0 - cx)) * invArea;
        let w2 = 1 - w0 - w1;

        if (w0 < -0.025 || w1 < -0.025 || w2 < -0.025) continue;
        w0 = Math.max(0, w0);
        w1 = Math.max(0, w1);
        w2 = Math.max(0, w2);
        const wSum = w0 + w1 + w2 || 1;
        w0 /= wSum;
        w1 /= wSum;
        w2 /= wSum;

        const P_x = p0.x * w0 + p1.x * w1 + p2.x * w2;
        const P_y = p0.y * w0 + p1.y * w1 + p2.y * w2;
        const P_z = p0.z * w0 + p1.z * w1 + p2.z * w2;

        let N_x = n0.x * w0 + n1.x * w1 + n2.x * w2;
        let N_y = n0.y * w0 + n1.y * w1 + n2.y * w2;
        let N_z = n0.z * w0 + n1.z * w1 + n2.z * w2;
        const nLen = Math.hypot(N_x, N_y, N_z) || 1;
        N_x /= nLen;
        N_y /= nLen;
        N_z /= nLen;

        // Dorsal side (+1) vs Palmar side (-1) unified across Left (-1) & Right (+1)
        const dorsalSide = N_x * side;
        const palmT = THREE.MathUtils.smoothstep(-dorsalSide, -0.25, 0.35);
        const dorsalT = THREE.MathUtils.smoothstep(dorsalSide, -0.15, 0.45);

        // Multi-scale organic dermal noise & subtle pores (no synthetic grid cross-hatching)
        const nCoarse = valueNoise3D(P_x * 65 + 4.1, P_y * 65 + 2.3, P_z * 65);
        const nFine = valueNoise3D(P_x * 360, P_y * 360, P_z * 360);
        const nPore = valueNoise3D(P_x * 840 + 7.4, P_y * 840 + 1.9, P_z * 840);
        const poreDip = Math.max(0, 0.22 - nPore) * 0.065 * dorsalT;

        // Warm deeper Sudanese caramel-brown dorsal tone -> lighter natural warm tan palm
        let colR = THREE.MathUtils.lerp(130, 166, palmT);
        let colG = THREE.MathUtils.lerp(79, 114, palmT);
        let colB = THREE.MathUtils.lerp(51, 84, palmT);

        // Subtle organic epidermal variation
        const mottle = (nCoarse - 0.5) * 11 + (nFine - 0.5) * 6;
        colR += mottle * 1.04 - poreDip * 14;
        colG += mottle * 0.85 - poreDip * 11;
        colB += mottle * 0.70 - poreDip * 9;

        let heightVal = 0.5 + (nFine - 0.5) * 0.024 + (nCoarse - 0.5) * 0.014 - poreDip;
        let roughVal = THREE.MathUtils.lerp(0.72, 0.66, palmT) + (nFine - 0.5) * 0.05;

        // Soft healthy warmth on fingertip pads & thenar mound
        const isTipPad = P_y < -0.070 || (P_z < -0.048 && P_y < -0.022);
        if (isTipPad && palmT > 0.25) {
          const padStrength = palmT * 0.55;
          colR += 10 * padStrength;
          colG += 2.5 * padStrength;
          colB += 2 * padStrength;
        }

        // Wrist flexor edge matches forearm seamlessly
        if (P_y > 0.052) {
          const wBlend = THREE.MathUtils.clamp((P_y - 0.052) / 0.024, 0, 1);
          colR = THREE.MathUtils.lerp(colR, THREE.MathUtils.lerp(129, 158, palmT), wBlend * 0.75);
          colG = THREE.MathUtils.lerp(colG, THREE.MathUtils.lerp(78, 108, palmT), wBlend * 0.75);
          colB = THREE.MathUtils.lerp(colB, THREE.MathUtils.lerp(50, 79, palmT), wBlend * 0.75);
        }

        // 1. Gentle Dorsal Metacarpal Tendons & Faint Sub-Dermal Veins (back of hand)
        if (dorsalT > 0.18 && P_y > -0.030 && P_y < 0.056) {
          let tendonBoost = 0;
          for (let tr = 0; tr < tendonRays.length; tr++) {
            const ray = tendonRays[tr];
            const seg = distToSeg2D(P_y, P_z, ray.ay, ray.az, ray.by, ray.bz);
            const g = Math.exp(-(seg.dist * seg.dist) / (2 * 0.0028 * 0.0028)) * Math.sin(seg.t * Math.PI);
            if (g > tendonBoost) tendonBoost = g;
          }
          tendonBoost *= dorsalT;
          heightVal += tendonBoost * 0.065;
          colR += tendonBoost * 5.5;
          colG += tendonBoost * 3.5;
          colB += tendonBoost * 2.2;

          // Subtle dorsal veins fading cleanly before knuckle web
          const v1Dist = Math.abs(P_z - (0.003 + Math.sin((P_y - 0.01) * 34) * 0.004));
          const v2Dist = Math.abs(P_z - (0.022 + Math.cos((P_y - 0.02) * 30) * 0.004));
          const veinMask =
            dorsalT *
            THREE.MathUtils.smoothstep(P_y, -0.008, 0.010) *
            (1 - THREE.MathUtils.smoothstep(P_y, 0.042, 0.056)) *
            Math.max(
              Math.exp(-(v1Dist * v1Dist) / (2 * 0.0018 * 0.0018)),
              Math.exp(-(v2Dist * v2Dist) / (2 * 0.0016 * 0.0016))
            );
          colR -= veinMask * 5.5;
          colG -= veinMask * 2.0;
          colB += veinMask * 1.5;
          heightVal += veinMask * 0.022;
        }

        // 2. Soft Organic Palm Creases & Wrist Flexion Lines (non-crossing, natural curvature)
        if (palmT > 0.28 && P_y > -0.040 && P_y < 0.062) {
          let creaseMask = 0;
          const wobble = (nCoarse - 0.5) * 0.0022;
          // Distal transverse palmar crease (pinky/ring/middle zone only, stops before crossing)
          if (P_z > 0.002 && P_z < 0.044) {
            const targetY = -0.011 - 0.24 * Math.max(0, 0.040 - P_z) + wobble;
            const d = Math.abs(P_y - targetY);
            const taper = THREE.MathUtils.smoothstep(P_z, 0.002, 0.012);
            creaseMask = Math.max(creaseMask, taper * Math.exp(-(d * d) / (2 * 0.0013 * 0.0013)));
          }
          // Proximal transverse crease (stops cleanly near radial palm)
          if (P_z > -0.020 && P_z < 0.022) {
            const targetY = -0.006 + 0.26 * Math.max(0, P_z + 0.018) + wobble;
            const d = Math.abs(P_y - targetY);
            const taper = 1 - THREE.MathUtils.smoothstep(P_z, 0.012, 0.022);
            creaseMask = Math.max(creaseMask, taper * Math.exp(-(d * d) / (2 * 0.0013 * 0.0013)));
          }
          // Smooth curved Thenar crease circling thumb base
          if (P_y > -0.008 && P_y < 0.042 && P_z > -0.026 && P_z < 0.008) {
            const rad = Math.hypot((P_y - 0.015) / 0.030, (P_z + 0.032) / 0.028);
            const d = Math.abs(rad - 1.0) * 0.028 + wobble * 0.5;
            creaseMask = Math.max(creaseMask, Math.exp(-(d * d) / (2 * 0.0013 * 0.0013)));
          }
          // Delicate wrist flexion line
          if (P_z > -0.014 && P_z < 0.030) {
            const dW1 = Math.abs(P_y - 0.048);
            creaseMask = Math.max(creaseMask, 0.72 * Math.exp(-(dW1 * dW1) / (2 * 0.0012 * 0.0012)));
          }

          creaseMask *= palmT;
          if (creaseMask > 0.02) {
            colR *= 1 - creaseMask * 0.11;
            colG *= 1 - creaseMask * 0.13;
            colB *= 1 - creaseMask * 0.12;
            heightVal -= creaseMask * 0.095;
            roughVal += creaseMask * 0.05;
          }
        }

        // 3. Soft Finger Knuckle Domes & Gentle Joint Skin Folds
        for (let j = 0; j < jointDescs.length; j++) {
          const jd = jointDescs[j];
          const dx = P_x - jd.pos.x;
          const dy = P_y - jd.pos.y;
          const dz = P_z - jd.pos.z;
          const dSq = dx * dx + dy * dy + dz * dz;
          if (dSq > jd.radiusSq) continue;

          const along = dx * jd.dir.x + dy * jd.dir.y + dz * jd.dir.z;
          const jointDorsal = N_x * jd.up.x + N_y * jd.up.y + N_z * jd.up.z;

          if (jd.kind === 'mcp' && jointDorsal > 0.25) {
            const env = Math.exp(-dSq / (2 * 0.0068 * 0.0068)) * THREE.MathUtils.smoothstep(jointDorsal, 0.25, 0.68);
            colR += env * 7.5;
            colG += env * 2.0;
            colB += env * 0.5;
            heightVal += env * 0.045;
          } else if (jd.kind === 'pip' || jd.kind === 'dip') {
            if (jointDorsal > 0.30) {
              // Two soft skin folds rather than hard striped ripples
              const env = Math.exp(-(along * along) / (2 * 0.0038 * 0.0038)) * THREE.MathUtils.smoothstep(jointDorsal, 0.30, 0.72);
              const ripple = Math.cos(along * 1650);
              heightVal += env * ripple * 0.052;
              colR -= env * Math.max(0, -ripple) * 6;
              colG -= env * Math.max(0, -ripple) * 6;
              colB -= env * Math.max(0, -ripple) * 5;
            } else if (jointDorsal < -0.30) {
              const pFade = THREE.MathUtils.smoothstep(-jointDorsal, 0.30, 0.72);
              const c1 = Math.exp(-(along * along) / (2 * 0.0009 * 0.0009));
              const fCrease = c1 * pFade;
              colR *= 1 - fCrease * 0.11;
              colG *= 1 - fCrease * 0.13;
              colB *= 1 - fCrease * 0.12;
              heightVal -= fCrease * 0.095;
            }
          }
        }

        // 4. Photorealistic Fingernails Harmonized with Rich Brown Skin
        for (let k = 0; k < nailDescs.length; k++) {
          const nd = nailDescs[k];
          const rx = P_x - nd.dPos.x;
          const ry = P_y - nd.dPos.y;
          const rz = P_z - nd.dPos.z;
          const dSq = rx * rx + ry * ry + rz * rz;
          if (dSq > 0.028 * 0.028) continue;

          const dd = N_x * nd.up.x + N_y * nd.up.y + N_z * nd.up.z;
          if (dd < 0.24) continue;

          const uAlong = rx * nd.dir.x + ry * nd.dir.y + rz * nd.dir.z;
          const vLat = rx * nd.lat.x + ry * nd.lat.y + rz * nd.lat.z;

          const nyRaw = (uAlong - nd.startAlong) / (nd.endAlong - nd.startAlong);
          const nx = vLat / nd.halfWidth;
          if (nyRaw < -0.14 || nyRaw > 1.12 || Math.abs(nx) > 1.22) continue;

          const baseCurve = 0.14 * nx * nx;
          const tipCurve = 1.0 - 0.18 * nx * nx;
          const ny = (nyRaw - baseCurve) / Math.max(0.25, tipCurve - baseCurve);

          const distFromSide = 1.0 - Math.abs(nx);
          const distFromBase = ny;
          const distFromTip = 1.0 - ny;
          const edgeSigned = Math.min(distFromSide, distFromBase * 1.4, distFromTip * 1.4);

          // Soft eponychium / lateral nail wall
          if (edgeSigned > -0.26 && edgeSigned <= -0.05 && ny > -0.10 && ny < 0.96 && dd > 0.32) {
            const wallT =
              Math.exp(-((edgeSigned + 0.15) * (edgeSigned + 0.15)) / (2 * 0.065 * 0.065)) *
              THREE.MathUtils.smoothstep(dd, 0.32, 0.56);
            heightVal += wallT * 0.055;
            colR += wallT * 4;
            colG += wallT * 1.5;
          }

          // Subtle cuticle & lateral nail fold groove
          if (edgeSigned > -0.18 && edgeSigned < 0.06 && dd > 0.32) {
            const grooveT = Math.exp(-((edgeSigned + 0.025) * (edgeSigned + 0.025)) / (2 * 0.062 * 0.062));
            const dorsalOk = THREE.MathUtils.smoothstep(dd, 0.32, 0.55);
            const gAmt = grooveT * dorsalOk;
            colR *= 1 - gAmt * 0.18;
            colG *= 1 - gAmt * 0.21;
            colB *= 1 - gAmt * 0.20;
            heightVal -= gAmt * 0.22;
          }

          if (edgeSigned > 0 && dd > 0.34) {
            const nailMask =
              THREE.MathUtils.smoothstep(edgeSigned, 0.0, 0.095) *
              THREE.MathUtils.smoothstep(dd, 0.34, 0.56);

            // Pale warm lunula crescent near cuticle base
            const lunulaDist = Math.hypot(nx * 0.90, (ny - 0.03) * 3.0);
            const lunulaT = 1 - THREE.MathUtils.smoothstep(lunulaDist, 0.42, 0.68);

            // Natural warm rose-mauve keratin nail bed
            const stria = Math.sin(nx * 24) * 2.2;
            let nR = 184 + stria;
            let nG = 124 + stria * 0.7;
            let nB = 110 + stria * 0.6;

            // Subtle onychodermal band before free edge
            const distalBand = Math.exp(-((ny - 0.74) * (ny - 0.74)) / (2 * 0.045 * 0.045));
            nR -= distalBand * 13;
            nG -= distalBand * 14;
            nB -= distalBand * 13;

            // Blend lunula
            nR = THREE.MathUtils.lerp(nR, 214, lunulaT * 0.74);
            nG = THREE.MathUtils.lerp(nG, 188, lunulaT * 0.74);
            nB = THREE.MathUtils.lerp(nB, 174, lunulaT * 0.74);

            // Clean natural warm ivory free tip (ny > 0.78)
            const tipT = THREE.MathUtils.smoothstep(ny, 0.78, 0.91);
            nR = THREE.MathUtils.lerp(nR, 224, tipT);
            nG = THREE.MathUtils.lerp(nG, 210, tipT);
            nB = THREE.MathUtils.lerp(nB, 194, tipT);

            colR = THREE.MathUtils.lerp(colR, nR, nailMask);
            colG = THREE.MathUtils.lerp(colG, nG, nailMask);
            colB = THREE.MathUtils.lerp(colB, nB, nailMask);

            // Smooth convex nail dome height & glossy keratin specular roughness
            const nailDome = 0.22 * Math.max(0, 1 - nx * nx * 0.85);
            heightVal = THREE.MathUtils.lerp(heightVal, 0.60 + nailDome, nailMask);
            roughVal = THREE.MathUtils.lerp(roughVal, 0.20, nailMask);
          }
        }

        const texIdx = py * SIZE + px;
        const p4 = texIdx * 4;
        albedo[p4] = THREE.MathUtils.clamp(Math.round(colR), 0, 255);
        albedo[p4 + 1] = THREE.MathUtils.clamp(Math.round(colG), 0, 255);
        albedo[p4 + 2] = THREE.MathUtils.clamp(Math.round(colB), 0, 255);
        albedo[p4 + 3] = 255;

        heightBuf[texIdx] = THREE.MathUtils.clamp(heightVal, 0, 1);

        const roByte = THREE.MathUtils.clamp(Math.round(roughVal * 255), 24, 245);
        roughBuf[p4] = roByte;
        roughBuf[p4 + 1] = roByte;
        roughBuf[p4 + 2] = roByte;
        roughBuf[p4 + 3] = 255;

        covered[texIdx] = 1;
      }
    }
  }

  dilateBakedBuffers(covered, albedo, heightBuf, roughBuf, SIZE, 3);

  const albedoTex = finalizeDataTexture(albedo, SIZE, SIZE, true);
  const normalTex = buildNormalMapFromHeight(heightBuf, SIZE, SIZE, 2.2);
  const roughTex = finalizeDataTexture(roughBuf, SIZE, SIZE, false);

  const set: AnatomicalSkinTexSet = { albedoTex, normalTex, roughTex };
  handTexSetCache.set(side, set);
  return set;
}

/**
 * Generates a matching 256x256 seamless forearm & wrist skin texture set (Albedos, Normal, Roughness)
 * with fine pores, gentle forearm veins, and ventral-wrist flexor creases matching the baked hand wrist seam.
 */
function getCachedForearmTextureSet(): AnatomicalSkinTexSet {
  if (forearmTexSetCache) return forearmTexSetCache;

  const SIZE = 256;
  const total = SIZE * SIZE;
  const albedo = new Uint8Array(total * 4);
  const heightBuf = new Float32Array(total);
  const roughBuf = new Uint8Array(total * 4);

  for (let y = 0; y < SIZE; y++) {
    const v = (y + 0.5) / SIZE; // 0 = tucked at wrist cuff, 1 = upper forearm
    for (let x = 0; x < SIZE; x++) {
      const u = (x + 0.5) / SIZE;
      const theta = u * Math.PI * 2;
      const ventralT = THREE.MathUtils.clamp((Math.cos(theta) * 0.5 + 0.5) * (1 - v * 0.48), 0, 1);

      const nC = valueNoise3D(Math.cos(theta) * 5 + 1.2, Math.sin(theta) * 5 + 2.4, v * 12);
      const nF = valueNoise3D(Math.cos(theta) * 28, Math.sin(theta) * 28, v * 58);

      let colR = THREE.MathUtils.lerp(129, 158, ventralT) + (nC - 0.5) * 9 + (nF - 0.5) * 5;
      let colG = THREE.MathUtils.lerp(78, 108, ventralT) + (nC - 0.5) * 7 + (nF - 0.5) * 4;
      let colB = THREE.MathUtils.lerp(50, 79, ventralT) + (nC - 0.5) * 5 + (nF - 0.5) * 3;
      let h = 0.5 + (nF - 0.5) * 0.024;
      let rough = 0.72 + (nF - 0.5) * 0.05;

      // Subtle inner-wrist flexor veins near anterior wrist
      if (ventralT > 0.45 && v > 0.06 && v < 0.70) {
        const vOff1 = Math.sin(theta - 0.18 - v * 0.25);
        const vein = ventralT * Math.exp(-(vOff1 * vOff1) / (2 * 0.10 * 0.10));
        colR -= vein * 5;
        colG -= vein * 2;
        colB += vein * 1.5;
      }

      // Soft wrist crease line near wrist junction
      if (ventralT > 0.4 && v < 0.12) {
        const cw = Math.exp(-((v - 0.045) * (v - 0.045)) / (2 * 0.014 * 0.014)) * ventralT;
        colR *= 1 - cw * 0.09;
        colG *= 1 - cw * 0.11;
        colB *= 1 - cw * 0.10;
        h -= cw * 0.08;
      }

      const idx = y * SIZE + x;
      const p = idx * 4;
      albedo[p] = THREE.MathUtils.clamp(Math.round(colR), 0, 255);
      albedo[p + 1] = THREE.MathUtils.clamp(Math.round(colG), 0, 255);
      albedo[p + 2] = THREE.MathUtils.clamp(Math.round(colB), 0, 255);
      albedo[p + 3] = 255;

      heightBuf[idx] = THREE.MathUtils.clamp(h, 0, 1);

      const roByte = THREE.MathUtils.clamp(Math.round(rough * 255), 32, 240);
      roughBuf[p] = roByte;
      roughBuf[p + 1] = roByte;
      roughBuf[p + 2] = roByte;
      roughBuf[p + 3] = 255;
    }
  }

  forearmTexSetCache = {
    albedoTex: finalizeDataTexture(albedo, SIZE, SIZE, true),
    normalTex: buildNormalMapFromHeight(heightBuf, SIZE, SIZE, 1.3),
    roughTex: finalizeDataTexture(roughBuf, SIZE, SIZE, false),
  };
  return forearmTexSetCache;
}

/**
 * Builds a side-matched tapered elliptical forearm mesh (z = +0.008 .. +0.34 in armRoot space)
 * nested snugly INSIDE the GLB wrist cap at z = +0.008..+0.018 so zero wrist seams or intersections protrude.
 */
function createAnatomicalForearmGeometry(side: -1 | 1): THREE.BufferGeometry {
  const segsZ = 12;
  const segsR = 16;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let iz = 0; iz <= segsZ; iz++) {
    const t = iz / segsZ;
    const z = THREE.MathUtils.lerp(0.008, 0.50, t);
    // Nest inside GLB wrist cuff at t=0..0.05 (z=0.008..0.024), then widen smoothly to forearm
    const flareT = THREE.MathUtils.smoothstep(t, 0.02, 0.16);
    const muscleSwell = Math.sin(Math.min(1, t * 1.15) * Math.PI) * 0.0042;
    const rx = THREE.MathUtils.lerp(0.0138, 0.0172, flareT) + t * 0.0125 + muscleSwell * 0.72;
    const ry = THREE.MathUtils.lerp(0.0190, 0.0230, flareT) + t * 0.0110 + muscleSwell;
    // Align exact ellipse center with GLB wrist center at z=+0.012, relaxing to (0,0) up forearm
    const centerDecay = 1 - THREE.MathUtils.smoothstep(t, 0.0, 0.30);
    const cx = side * -0.0012 * centerDecay;
    const cy = -0.0020 * centerDecay;

    for (let ir = 0; ir <= segsR; ir++) {
      const u = ir / segsR;
      // theta=0 faces inward palmar side (+X on left, -X on right) so forearmTex ventral crease aligns cleanly
      const theta = u * Math.PI * 2 + (side === 1 ? Math.PI : 0);
      positions.push(cx + rx * Math.cos(theta), cy + ry * Math.sin(theta), z);
      uvs.push(u, t);
    }
  }

  const cols = segsR + 1;
  for (let iz = 0; iz < segsZ; iz++) {
    for (let ir = 0; ir < segsR; ir++) {
      const a = iz * cols + ir;
      const b = a + cols;
      const c = b + 1;
      const d = a + 1;
      indices.push(a, d, b);
      indices.push(b, d, c);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Builds an elliptical flared garment sleeve shell without end-cap overlap,
 * ensuring >= 4mm clearance between inner forearm/cuff and outer abaya/coat layers.
 */
function createEllipticalSleeveGeometry(
  zStart: number,
  zEnd: number,
  rxStart: number,
  ryStart: number,
  rxEnd: number,
  ryEnd: number,
  segsZ = 6,
  segsR = 16
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let iz = 0; iz <= segsZ; iz++) {
    const t = iz / segsZ;
    const z = THREE.MathUtils.lerp(zStart, zEnd, t);
    const rx = THREE.MathUtils.lerp(rxStart, rxEnd, t);
    const ry = THREE.MathUtils.lerp(ryStart, ryEnd, t);
    for (let ir = 0; ir <= segsR; ir++) {
      const u = ir / segsR;
      const theta = u * Math.PI * 2;
      positions.push(rx * Math.cos(theta), ry * Math.sin(theta), z);
      uvs.push(u * 2, t * 2);
    }
  }

  const cols = segsR + 1;
  for (let iz = 0; iz < segsZ; iz++) {
    for (let ir = 0; ir < segsR; ir++) {
      const a = iz * cols + ir;
      const b = a + cols;
      const c = b + 1;
      const d = a + 1;
      indices.push(a, d, b);
      indices.push(b, d, c);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
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

  const forearmTexSet = getCachedForearmTextureSet();
  const forearmSkinMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: forearmTexSet.albedoTex,
      normalMap: forearmTexSet.normalTex,
      normalScale: new THREE.Vector2(0.38, 0.38),
      roughnessMap: forearmTexSet.roughTex,
      roughness: 1.0,
      metalness: 0.0,
      envMapIntensity: 0.34,
      emissiveMap: forearmTexSet.albedoTex,
      emissive: 0x451c0b,
      emissiveIntensity: 0.10,
      side: THREE.FrontSide,
    })
  );

  const outerSleeveMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf2f4f7,
      bumpMap: textures.fabricWeaveBump,
      bumpScale: 0.006,
      roughness: 0.80,
      metalness: 0.02,
      envMapIntensity: 0.55,
      emissive: 0x1e293b,
      emissiveIntensity: 0.07,
      side: THREE.DoubleSide,
    })
  );

  const cuffMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      bumpMap: textures.fabricWeaveBump,
      bumpScale: 0.006,
      roughness: 0.74,
      metalness: 0.02,
      envMapIntensity: 0.58,
      emissive: 0x1e293b,
      emissiveIntensity: 0.07,
      side: THREE.DoubleSide,
    })
  );

  const innerSleeveMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf5f2eb,
      bumpMap: textures.fabricWeaveBump,
      bumpScale: 0.005,
      roughness: 0.78,
      metalness: 0.01,
      envMapIntensity: 0.5,
      side: THREE.DoubleSide,
    })
  );

  const watchStrapMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.65,
      metalness: 0.1,
    })
  );

  const watchMetalMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.24,
      metalness: 0.85,
    })
  );

  const watchDialMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.18,
      metalness: 0.04,
      emissive: 0xe2e8f0,
      emissiveIntensity: 0.14,
    })
  );

  const buttonMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.35,
      metalness: 0.08,
    })
  );

  // Strictly separated radial/Z sleeve & side-matched forearm geometries (zero wrist cuff protrusion)
  const leftForearmGeom = trackGeom(createAnatomicalForearmGeometry(-1));
  const rightForearmGeom = trackGeom(createAnatomicalForearmGeometry(1));
  // Long sleeve for lab_coat & shirt_pants: starts at z=+0.056 (behind cuff)
  const longSleeveGeom = trackGeom(
    createEllipticalSleeveGeometry(0.056, 0.58, 0.032, 0.037, 0.048, 0.052)
  );
  // Crisp outer cuff collar: z = +0.034 .. +0.060 (wider by 3mm than inner wrist & ends cleanly before longSleeve)
  const longCuffGeom = trackGeom(
    createEllipticalSleeveGeometry(0.034, 0.060, 0.0285, 0.0335, 0.0335, 0.0385)
  );
  // Short surgical scrubs sleeve: z = +0.182 .. +0.58 leaving forearm cleanly exposed
  const shortSleeveGeom = trackGeom(
    createEllipticalSleeveGeometry(0.182, 0.58, 0.036, 0.040, 0.048, 0.052)
  );
  const shortHemGeom = trackGeom(
    createEllipticalSleeveGeometry(0.172, 0.184, 0.0365, 0.0405, 0.037, 0.041)
  );
  // Modest flared Abaya outer sleeve: generous bell drape z = +0.048 .. +0.58
  const abayaSleeveGeom = trackGeom(
    createEllipticalSleeveGeometry(0.048, 0.58, 0.047, 0.051, 0.055, 0.058)
  );
  const abayaTrimGeom = trackGeom(
    createEllipticalSleeveGeometry(0.042, 0.050, 0.0465, 0.0505, 0.048, 0.052)
  );
  // Slim modest inner sleeve cuff inside wide Abaya bell: z = +0.026 .. +0.066 (20mm radial clearance!)
  const abayaInnerCuffGeom = trackGeom(
    createEllipticalSleeveGeometry(0.026, 0.066, 0.0245, 0.0305, 0.0285, 0.034)
  );

  interface ArmAssembly {
    armRoot: THREE.Group;
    handPivot: THREE.Group;
    handHolder: THREE.Group;
    forearmMesh: THREE.Mesh;
    longSleeveMesh: THREE.Mesh;
    longCuffMesh: THREE.Mesh;
    cuffButtonMesh: THREE.Mesh;
    shortSleeveMesh: THREE.Mesh;
    shortHemMesh: THREE.Mesh;
    abayaSleeveMesh: THREE.Mesh;
    abayaTrimMesh: THREE.Mesh;
    abayaInnerCuffMesh: THREE.Mesh;
    watchGroup: THREE.Group | null;
    handSkinMat: THREE.MeshStandardMaterial | null;
    fkRig: HandSkeletonRig | null;
    side: -1 | 1;
  }

  const attachGlbHand = (arm: ArmAssembly): boolean => {
    if (arm.fkRig) return true;
    const key = arm.side === -1 ? 'hand_left' : 'hand_right';
    const template = glbRegistry.getModel(key);
    if (!template) return false;

    const clone = SkeletonUtils.clone(template);
    let skinned: THREE.SkinnedMesh | null = null;
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        m.castShadow = false;
        m.receiveShadow = false;
        m.frustumCulled = false;
        m.renderOrder = 4;
        if ((m as THREE.SkinnedMesh).isSkinnedMesh) {
          skinned = m as THREE.SkinnedMesh;
        }
      }
    });

    if (!skinned) return false;
    const sk = skinned as THREE.SkinnedMesh;

    const bakedTexSet = getOrBakeHandTextureSet(sk.geometry, sk.skeleton.bones, arm.side);
    const handSkinMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: bakedTexSet.albedoTex,
        normalMap: bakedTexSet.normalTex,
        normalScale: new THREE.Vector2(0.48, 0.48),
        roughnessMap: bakedTexSet.roughTex,
        roughness: 1.0,
        metalness: 0.0,
        envMapIntensity: 0.36,
        emissiveMap: bakedTexSet.albedoTex,
        emissive: 0x451c0b,
        emissiveIntensity: 0.10,
        side: THREE.FrontSide,
      })
    );
    sk.material = handSkinMat;
    arm.handSkinMat = handSkinMat;

    const wristBone = sk.skeleton.bones.find((b) => b.name === 'wrist');
    if (wristBone) {
      clone.position.set(-wristBone.position.x, -wristBone.position.y, -wristBone.position.z);
    }

    arm.handHolder.add(clone);
    arm.fkRig = buildFlatFkRig(sk, arm.side);
    return true;
  };

  const buildArm = (side: -1 | 1): ArmAssembly => {
    const armRoot = new THREE.Group();

    const handPivot = new THREE.Group();
    handPivot.position.set(0, 0, 0.010);
    const handHolder = new THREE.Group();
    handHolder.position.set(0, 0, -0.010);
    // Orient WebXR hand (-Y fingers -> -Z forward, -Z thumb -> +Y up, palm inward)
    handHolder.rotation.set(Math.PI / 2, 0, 0);
    handPivot.add(handHolder);
    armRoot.add(handPivot);

    const forearmMesh = new THREE.Mesh(side === -1 ? leftForearmGeom : rightForearmGeom, forearmSkinMat);
    const longSleeveMesh = new THREE.Mesh(longSleeveGeom, outerSleeveMat);
    const longCuffMesh = new THREE.Mesh(longCuffGeom, cuffMat);

    const cuffButtonMesh = new THREE.Mesh(
      trackGeom(new THREE.CylinderGeometry(0.0044, 0.0044, 0.0032, 10)),
      buttonMat
    );
    cuffButtonMesh.rotation.z = Math.PI / 2;
    cuffButtonMesh.position.set(side * 0.0325, -0.004, 0.044);

    const shortSleeveMesh = new THREE.Mesh(shortSleeveGeom, outerSleeveMat);
    const shortHemMesh = new THREE.Mesh(shortHemGeom, cuffMat);

    const abayaSleeveMesh = new THREE.Mesh(abayaSleeveGeom, outerSleeveMat);
    const abayaTrimMesh = new THREE.Mesh(abayaTrimGeom, cuffMat);
    const abayaInnerCuffMesh = new THREE.Mesh(abayaInnerCuffGeom, innerSleeveMat);

    let watchGroup: THREE.Group | null = null;
    if (side === -1) {
      watchGroup = new THREE.Group();
      watchGroup.position.set(-0.0008, -0.0014, 0.032);

      const strap = new THREE.Mesh(
        trackGeom(new THREE.TorusGeometry(0.0238, 0.0024, 6, 18)),
        watchStrapMat
      );
      strap.scale.set(0.86, 1.12, 1.0);
      const bezel = new THREE.Mesh(
        trackGeom(new THREE.CylinderGeometry(0.0112, 0.0112, 0.0046, 14)),
        watchMetalMat
      );
      bezel.rotation.z = Math.PI / 2;
      bezel.position.set(-0.0212, 0.005, 0);
      const dial = new THREE.Mesh(
        trackGeom(new THREE.CylinderGeometry(0.0090, 0.0090, 0.0052, 14)),
        watchDialMat
      );
      dial.rotation.z = Math.PI / 2;
      dial.position.set(-0.0216, 0.005, 0);
      watchGroup.add(strap, bezel, dial);
      armRoot.add(watchGroup);
    }

    const meshes = [
      forearmMesh,
      longSleeveMesh,
      longCuffMesh,
      cuffButtonMesh,
      shortSleeveMesh,
      shortHemMesh,
      abayaSleeveMesh,
      abayaTrimMesh,
      abayaInnerCuffMesh,
    ];
    for (const m of meshes) {
      m.castShadow = false;
      m.receiveShadow = false;
      m.frustumCulled = false;
      m.renderOrder = 3;
      armRoot.add(m);
    }
    if (watchGroup) {
      watchGroup.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          o.castShadow = false;
          o.receiveShadow = false;
          o.frustumCulled = false;
          o.renderOrder = 4;
        }
      });
    }

    const assembly: ArmAssembly = {
      armRoot,
      handPivot,
      handHolder,
      forearmMesh,
      longSleeveMesh,
      longCuffMesh,
      cuffButtonMesh,
      shortSleeveMesh,
      shortHemMesh,
      abayaSleeveMesh,
      abayaTrimMesh,
      abayaInnerCuffMesh,
      watchGroup,
      handSkinMat: null,
      fkRig: null,
      side,
    };

    attachGlbHand(assembly);
    return assembly;
  };

  const leftAsm = buildArm(-1);
  const rightAsm = buildArm(1);
  group.add(leftAsm.armRoot, rightAsm.armRoot);
  group.visible = false;

  let currentProfile: PlayerCharacterConfig | undefined = initialProfile;

  const updateAppearance = (profile?: PlayerCharacterConfig) => {
    currentProfile = profile;
    const isFemale = profile?.gender === 'female';
    const meta = resolvePlayerOutfitMeta(profile?.outfitId);

    // Gender-authentic hand & forearm proportions with zero extra meshes or textures
    // Female: narrower palm/thickness (0.83 x 0.85) with graceful elongated length (0.98) + tapered bones
    const handScaleThick = isFemale ? 0.83 : 1.02;
    const handScaleLen = isFemale ? 0.98 : 1.02;
    const handScaleWidth = isFemale ? 0.85 : 1.02;

    forearmSkinMat.normalScale.setScalar(isFemale ? 0.22 : 0.38);

    for (const asm of [leftAsm, rightAsm]) {
      asm.handHolder.scale.set(handScaleThick, handScaleLen, handScaleWidth);
      asm.forearmMesh.scale.set(handScaleThick, handScaleWidth, 1.0);
      if (asm.handSkinMat) {
        asm.handSkinMat.normalScale.setScalar(isFemale ? 0.28 : 0.48);
      }
      if (asm.fkRig) {
        applyGenderBoneTaper(asm.fkRig, isFemale);
      }
      if (asm.watchGroup) {
        asm.watchGroup.scale.set(
          isFemale ? 0.82 : 1.02,
          isFemale ? 0.84 : 1.02,
          isFemale ? 0.88 : 1.0
        );
      }
    }

    const isScrubs = meta.id === 'scrubs';
    const isLabCoat = meta.id === 'lab_coat';
    const isShirtPants = meta.id === 'shirt_pants';
    const isAbayaClosed = meta.id === 'female_abaya_closed' || meta.id === 'female_abaya_niqab';
    const isAbayaLight = meta.id === 'female_abaya_light';

    if (isLabCoat) {
      outerSleeveMat.color.setHex(0xf2f4f7);
      cuffMat.color.setHex(0xe2e8f0);
      outerSleeveMat.emissive.setHex(0x1e293b);
      outerSleeveMat.emissiveIntensity = 0.08;
    } else if (isScrubs) {
      outerSleeveMat.color.set(meta.shirtColor);
      cuffMat.color.set(meta.pantsColor);
      outerSleeveMat.emissive.setHex(0x0c4a6e);
      outerSleeveMat.emissiveIntensity = 0.07;
    } else if (isShirtPants) {
      outerSleeveMat.color.set(meta.shirtColor);
      cuffMat.color.set(meta.shirtColor).lerp(new THREE.Color(0xffffff), 0.24);
      outerSleeveMat.emissive.setHex(0x1e293b);
      outerSleeveMat.emissiveIntensity = 0.06;
    } else if (isAbayaLight) {
      outerSleeveMat.color.set(meta.shirtColor);
      cuffMat.color.set(meta.shirtColor).lerp(new THREE.Color(0xffffff), 0.14);
      innerSleeveMat.color.set(meta.pantsColor);
      outerSleeveMat.emissive.setHex(0x2d241c);
      outerSleeveMat.emissiveIntensity = 0.08;
    } else {
      // Closed Abaya / Abaya & Niqab
      outerSleeveMat.color.set(meta.shirtColor);
      cuffMat.color.setHex(0x282b34);
      innerSleeveMat.color.setHex(0x1f2128);
      outerSleeveMat.emissive.setHex(0x0f172a);
      outerSleeveMat.emissiveIntensity = 0.12;
    }

    for (const asm of [leftAsm, rightAsm]) {
      asm.forearmMesh.visible = true;
      asm.longSleeveMesh.visible = isLabCoat || isShirtPants;
      asm.longCuffMesh.visible = isLabCoat || isShirtPants;
      asm.cuffButtonMesh.visible = isShirtPants;
      asm.shortSleeveMesh.visible = isScrubs;
      asm.shortHemMesh.visible = isScrubs;
      asm.abayaSleeveMesh.visible = isAbayaClosed || isAbayaLight;
      asm.abayaTrimMesh.visible = isAbayaClosed || isAbayaLight;
      asm.abayaInnerCuffMesh.visible = isAbayaClosed || isAbayaLight;
      if (asm.watchGroup) {
        asm.watchGroup.visible = !isAbayaClosed;
      }
    }
  };

  // Ensure hands attach cleanly even if GLBs finish loading right after boot
  const unsubGlbReady = glbRegistry.onReady(() => {
    const attachedL = attachGlbHand(leftAsm);
    const attachedR = attachGlbHand(rightAsm);
    if (attachedL || attachedR) {
      updateAppearance(currentProfile);
    }
  });

  updateAppearance(initialProfile);

  // Pre-allocated kinematic & damping state (zero GC allocations per frame!)
  const halfHeightAtArm = 0.38 * Math.tan(THREE.MathUtils.degToRad(60 * 0.5));
  let holdBlend = 0;
  let probeBlend = 0;
  let tapSmooth = 0;
  let handshakeSmooth = 0;
  let swayX = 0;
  let swayY = 0;
  let prevUpdateTime = -1;

  const curLeftPose: FingerPoseParams = {
    indexCurl: 0.22,
    middleCurl: 0.26,
    ringCurl: 0.32,
    pinkyCurl: 0.38,
    thumbCurl: 0.18,
    thumbOpp: 0.26,
    splay: 0.22,
  };
  const curRightPose: FingerPoseParams = {
    indexCurl: 0.22,
    middleCurl: 0.26,
    ringCurl: 0.32,
    pinkyCurl: 0.38,
    thumbCurl: 0.18,
    thumbOpp: 0.26,
    splay: 0.22,
  };
  const targetLeftPose: FingerPoseParams = { ...curLeftPose };
  const targetRightPose: FingerPoseParams = { ...curRightPose };

  const _gripEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  const _gripQuat = new THREE.Quaternion();
  const _gripPocketVec = new THREE.Vector3();
  const _gripAxisLocal = new THREE.Vector3();
  const _gripOut = { posX: 0, posY: 0, posZ: 0, pitch: 0, yaw: 0, roll: 0 };

  const solveArmGripPose = (
    side: -1 | 1,
    tx: number,
    ty: number,
    tz: number,
    style: 'pole' | 'bar' | 'crate' | 'pinch',
    rollOverride?: number,
    axisCamX?: number,
    axisCamY?: number,
    axisCamZ?: number
  ) => {
    const shX = side * 0.24;
    const shY = -0.24;
    const shZ = 0.04;
    const dx = tx - shX;
    const dy = ty - shY;
    const dz = tz - shZ;
    const horiz = Math.max(0.14, Math.hypot(dx, dz));
    const yaw = Math.atan2(-dx, -dz);
    const pitch = Math.atan2(dy, horiz);

    // Align hand fist bore (+Y in armRoot) coaxially with the wand shaft axis when supplied
    let roll: number;
    if (rollOverride !== undefined) {
      roll = rollOverride;
    } else if (axisCamX !== undefined && axisCamY !== undefined && axisCamZ !== undefined) {
      _gripEuler.set(pitch, yaw, 0, 'YXZ');
      _gripQuat.setFromEuler(_gripEuler).invert();
      _gripAxisLocal.set(axisCamX, axisCamY, axisCamZ).applyQuaternion(_gripQuat);
      if (_gripAxisLocal.y < -0.25) {
        _gripAxisLocal.negate();
      }
      const axisLen2D = Math.hypot(_gripAxisLocal.x, _gripAxisLocal.y);
      const targetRoll = axisLen2D > 0.08 ? Math.atan2(-_gripAxisLocal.x, _gripAxisLocal.y) : side * 0.65;
      roll = THREE.MathUtils.clamp(
        targetRoll,
        side === 1 ? -0.35 : -1.55,
        side === 1 ? 1.55 : 0.35
      );
    } else {
      roll =
        style === 'bar'
          ? side * 1.35
          : style === 'pinch'
            ? side * 1.04
            : style === 'pole'
              ? side * 0.18
              : side * 0.26;
    }

    const isFemaleHand = currentProfile?.gender === 'female';
    const thickScale = isFemaleHand ? 0.83 : 1.02;
    const lenScale = isFemaleHand ? 0.98 : 1.02;
    const widthScale = isFemaleHand ? 0.85 : 1.02;

    // Exact bone-verified pocket inside hand_right/left.glb (handHolder rotated +90deg X -> scale maps X, Z, Y)
    if (style === 'pinch') {
      _gripPocketVec.set(-side * 0.064 * thickScale, 0.036 * widthScale, -0.118 * lenScale);
    } else {
      _gripPocketVec.set(-side * 0.034 * thickScale, 0.002 * widthScale, -0.106 * lenScale);
    }
    _gripEuler.set(pitch, yaw, roll, 'YXZ');
    _gripQuat.setFromEuler(_gripEuler);
    _gripPocketVec.applyQuaternion(_gripQuat);

    _gripOut.posX = tx - _gripPocketVec.x;
    _gripOut.posY = ty - _gripPocketVec.y;
    _gripOut.posZ = tz - _gripPocketVec.z;
    _gripOut.pitch = pitch;
    _gripOut.yaw = yaw;
    _gripOut.roll = roll;
    return _gripOut;
  };

  const dampPose = (cur: FingerPoseParams, tgt: FingerPoseParams, dt: number) => {
    cur.indexCurl = THREE.MathUtils.damp(cur.indexCurl, tgt.indexCurl, 14, dt);
    cur.middleCurl = THREE.MathUtils.damp(cur.middleCurl, tgt.middleCurl, 14, dt);
    cur.ringCurl = THREE.MathUtils.damp(cur.ringCurl, tgt.ringCurl, 14, dt);
    cur.pinkyCurl = THREE.MathUtils.damp(cur.pinkyCurl, tgt.pinkyCurl, 14, dt);
    cur.thumbCurl = THREE.MathUtils.damp(cur.thumbCurl, tgt.thumbCurl, 14, dt);
    cur.thumbOpp = THREE.MathUtils.damp(cur.thumbOpp, tgt.thumbOpp, 14, dt);
    cur.splay = THREE.MathUtils.damp(cur.splay, tgt.splay, 12, dt);
  };

  const updateMotion = (
    fppSmooth: number,
    walkBob: number,
    timeSec: number,
    isSpeakingOrExam: boolean,
    aspect = 1.6,
    gripTarget?: FppHandGripTarget,
    interaction?: FppHandInteractionContext
  ) => {
    const attachedLateL = !leftAsm.fkRig && attachGlbHand(leftAsm);
    const attachedLateR = !rightAsm.fkRig && attachGlbHand(rightAsm);
    if (attachedLateL || attachedLateR) {
      updateAppearance(currentProfile);
    }

    // Keep hands visible across entire FPP session including focus close-ups (effectiveHandAlpha ~ 0.45)
    const visible = fppSmooth > 0.12;
    group.visible = visible;
    if (!visible) {
      holdBlend = 0;
      probeBlend = 0;
      tapSmooth = 0;
      handshakeSmooth = 0;
      swayX = 0;
      swayY = 0;
      prevUpdateTime = -1;
      return;
    }

    const dt = prevUpdateTime < 0 ? 0.016 : THREE.MathUtils.clamp(timeSec - prevUpdateTime, 0.001, 0.05);
    prevUpdateTime = timeSec;

    const focusB = interaction?.focusBlend ?? 0;
    const t = THREE.MathUtils.clamp((fppSmooth - 0.16) / 0.84, 0, 1);
    const easeIn = t * t * t * (t * (t * 6 - 15) + 10);
    // Lower slightly when examining bed close up instead of hiding off-screen
    const focusDrop = focusB * -0.022;
    const dropY = (1 - easeIn) * -0.055 + focusDrop;

    const halfWidth = halfHeightAtArm * Math.max(0.46, aspect);
    // Natural shoulder-spaced arm framing without squeezing toward viewport center
    const armX = THREE.MathUtils.clamp(halfWidth * 0.72, 0.148, 0.208);
    const portraitZPush = aspect < 0.9 ? THREE.MathUtils.clamp((0.9 - aspect) * 0.12, 0, 0.05) : 0;

    // Inertia sway from camera turning & lateral strafing
    const velYaw = interaction?.yawVel ?? 0;
    const velPitch = interaction?.pitchVel ?? 0;
    const velRight = interaction?.velRight ?? 0;
    const targetSwayX = THREE.MathUtils.clamp(-velYaw * 0.012 - velRight * 0.010, -0.026, 0.026);
    const targetSwayY = THREE.MathUtils.clamp(velPitch * 0.010, -0.020, 0.020);
    swayX = THREE.MathUtils.damp(swayX, targetSwayX, 11, dt);
    swayY = THREE.MathUtils.damp(swayY, targetSwayY, 11, dt);

    const breath = Math.sin(timeSec * 1.75) * 0.0024;
    const walkSin = Math.sin(walkBob);
    const walkCos = Math.cos(walkBob * 2);
    const moveSpeedAmt = Math.min(1, Math.hypot(interaction?.velForward ?? 0, interaction?.velRight ?? 0) / 1.15);
    const walkSwing = walkSin * 0.014 * (0.28 + moveSpeedAmt * 0.72);
    const walkBobY = walkCos * 0.0038 * (0.28 + moveSpeedAmt * 0.72);
    const examWave = isSpeakingOrExam && !gripTarget?.active ? Math.sin(timeSec * 3.1) * 0.008 : 0;

    holdBlend = THREE.MathUtils.damp(holdBlend, gripTarget?.active ? 1 : 0, 12, dt);
    const probeActive = Boolean(
      !gripTarget?.active &&
        (interaction?.hasSelectedProbe || interaction?.isDraggingProbe)
    );
    const fastProbeFollow =
      interaction?.probeActionMode === 'hold_wand' || interaction?.probeActionMode === 'wand';
    probeBlend = THREE.MathUtils.damp(probeBlend, probeActive ? 1 : 0, fastProbeFollow ? 18 : 11, dt);
    const tapActive = Boolean(!gripTarget?.active && (interaction?.consoleTapPulse ?? 0) > 0.02);
    tapSmooth = THREE.MathUtils.damp(
      tapSmooth,
      tapActive ? Math.sin(Math.min(1, 1 - (interaction?.consoleTapPulse ?? 0)) * Math.PI) : 0,
      18,
      dt
    );
    const hsGoal = !gripTarget?.active && !probeActive ? THREE.MathUtils.clamp(interaction?.handshakeBlend ?? 0, 0, 1) : 0;
    handshakeSmooth = THREE.MathUtils.damp(handshakeSmooth, hsGoal, 14, dt);

    // Natural semi-pronated relaxed clinician posture (palms angled softly downward/inward, relaxed cascade)
    let lPosX = -armX + swayX;
    let lPosY = -0.168 + dropY + breath + walkBobY + swayY;
    let lPosZ = -0.365 - portraitZPush + walkSwing;
    let lPitch = 0.05 + breath * 1.4 + examWave;
    let lYaw = -0.20 - velYaw * 0.02;
    let lRoll = -0.92;
    let lWristPitch = 0.02;
    let lWristYaw = 0;
    let lWristRoll = 0;

    let rPosX = armX + swayX;
    let rPosY = -0.168 + dropY + breath + walkBobY + swayY + Math.abs(examWave) * 0.4;
    let rPosZ = -0.365 - portraitZPush - walkSwing - (isSpeakingOrExam && !gripTarget?.active ? 0.010 : 0);
    let rPitch = 0.06 + breath * 1.4 + examWave * 1.2;
    let rYaw = 0.20 - velYaw * 0.02;
    let rRoll = 0.92;
    let rWristPitch = 0.02;
    let rWristYaw = 0;
    let rWristRoll = 0;

    // Relaxed anatomical finger cascade with minimal radial splay + subtle graceful female poise
    const isFemaleNow = currentProfile?.gender === 'female';
    const restCurlShift = (isSpeakingOrExam ? -0.05 : 0) + (isFemaleNow ? -0.025 : 0);
    targetLeftPose.indexCurl = 0.24 + restCurlShift + Math.sin(timeSec * 1.4) * 0.015;
    targetLeftPose.middleCurl = 0.30 + restCurlShift * 0.85;
    targetLeftPose.ringCurl = 0.37 + restCurlShift * 0.55;
    targetLeftPose.pinkyCurl = 0.44 + restCurlShift * 0.35;
    targetLeftPose.thumbCurl = isFemaleNow ? 0.14 : 0.16;
    targetLeftPose.thumbOpp = isFemaleNow ? 0.18 : 0.20;
    targetLeftPose.splay = isSpeakingOrExam ? 0.14 : 0.08;

    targetRightPose.indexCurl = 0.23 + restCurlShift;
    targetRightPose.middleCurl = 0.29 + restCurlShift * 0.85;
    targetRightPose.ringCurl = 0.36 + restCurlShift * 0.55;
    targetRightPose.pinkyCurl = 0.43 + restCurlShift * 0.35;
    targetRightPose.thumbCurl = isFemaleNow ? 0.14 : 0.16;
    targetRightPose.thumbOpp = isFemaleNow ? 0.18 : 0.20;
    targetRightPose.splay = isSpeakingOrExam ? 0.14 : 0.08;

    // 1. Carrying / Rolling Device Grip (pole / cart handlebar / lifted tray)
    if (holdBlend > 0.01 && gripTarget) {
      const lG = solveArmGripPose(
        -1,
        gripTarget.leftX,
        gripTarget.leftY,
        gripTarget.leftZ,
        gripTarget.style
      );
      const bobG = walkCos * 0.0024;
      lPosX = THREE.MathUtils.lerp(lPosX, lG.posX + swayX * 0.25, holdBlend);
      lPosY = THREE.MathUtils.lerp(lPosY, lG.posY + bobG, holdBlend);
      lPosZ = THREE.MathUtils.lerp(lPosZ, lG.posZ, holdBlend);
      lPitch = THREE.MathUtils.lerp(lPitch, lG.pitch, holdBlend);
      lYaw = THREE.MathUtils.lerp(lYaw, lG.yaw, holdBlend);
      lRoll = THREE.MathUtils.lerp(lRoll, lG.roll, holdBlend);

      const rG = solveArmGripPose(
        1,
        gripTarget.rightX,
        gripTarget.rightY,
        gripTarget.rightZ,
        gripTarget.style
      );
      rPosX = THREE.MathUtils.lerp(rPosX, rG.posX + swayX * 0.25, holdBlend);
      rPosY = THREE.MathUtils.lerp(rPosY, rG.posY + bobG, holdBlend);
      rPosZ = THREE.MathUtils.lerp(rPosZ, rG.posZ, holdBlend);
      rPitch = THREE.MathUtils.lerp(rPitch, rG.pitch, holdBlend);
      rYaw = THREE.MathUtils.lerp(rYaw, rG.yaw, holdBlend);
      rRoll = THREE.MathUtils.lerp(rRoll, rG.roll, holdBlend);

      const gripCurl = gripTarget.style === 'pole' ? 0.86 : 0.78;
      const thumbGrip = gripTarget.style === 'pole' ? 0.78 : 0.68;
      targetLeftPose.indexCurl = gripCurl;
      targetLeftPose.middleCurl = gripCurl + 0.04;
      targetLeftPose.ringCurl = gripCurl + 0.08;
      targetLeftPose.pinkyCurl = gripCurl + 0.10;
      targetLeftPose.thumbCurl = thumbGrip;
      targetLeftPose.thumbOpp = 0.68;
      targetLeftPose.splay = 0.06;

      targetRightPose.indexCurl = gripCurl;
      targetRightPose.middleCurl = gripCurl + 0.04;
      targetRightPose.ringCurl = gripCurl + 0.08;
      targetRightPose.pinkyCurl = gripCurl + 0.10;
      targetRightPose.thumbCurl = thumbGrip;
      targetRightPose.thumbOpp = 0.68;
      targetRightPose.splay = 0.06;
    }

    // 2. Clinician Hands: Tactile Electrode Placement / Continuous Handheld Therapy / Cuff Wrap / Aim / Setup
    if (probeBlend > 0.01 && interaction) {
      const actionMode = interaction.probeActionMode ?? 'pad';
      const pressAmt = THREE.MathUtils.clamp(interaction.probePressBlend ?? 0, 0, 1);
      const releaseAmt = THREE.MathUtils.clamp(interaction.probeReleaseBlend ?? 0, 0, 1);
      const activeBlend = probeBlend * (1 - releaseAmt * 0.72);
      const isWandLike = actionMode === 'hold_wand' || actionMode === 'wand';
      const aimX = THREE.MathUtils.clamp(interaction.probeTargetCamX, isWandLike ? -0.54 : -0.34, isWandLike ? 0.54 : 0.34);
      const aimY = THREE.MathUtils.clamp(interaction.probeTargetCamY, isWandLike ? -0.48 : -0.34, isWandLike ? 0.22 : 0.14);
      const aimZ = THREE.MathUtils.clamp(interaction.probeTargetCamZ, isWandLike ? -1.08 : -0.82, -0.22);

      if (actionMode === 'wrap' || actionMode === 'setup') {
        // Two-hand placement/wrapping (Cryo-Cuff wrap, Hydro Hot Pack, mounting CPM/Balance/Table)
        const span = actionMode === 'setup' ? 0.145 : 0.088;
        const pressZ = interaction.isDraggingProbe ? 0.016 : pressAmt * 0.024;
        const liftZ = releaseAmt * 0.068;
        const liftY = releaseAmt * 0.032;
        const lG = solveArmGripPose(
          -1,
          THREE.MathUtils.clamp(aimX - span - releaseAmt * 0.02, -0.36, 0.06),
          aimY - 0.010 + liftY,
          aimZ + 0.018 - pressZ + liftZ,
          actionMode === 'setup' ? 'bar' : 'crate',
          actionMode === 'setup' ? -1.25 : -0.44 - pressAmt * 0.18
        );
        const rG = solveArmGripPose(
          1,
          THREE.MathUtils.clamp(aimX + span + releaseAmt * 0.02, -0.06, 0.36),
          aimY - 0.010 + liftY,
          aimZ + 0.018 - pressZ + liftZ,
          actionMode === 'setup' ? 'bar' : 'crate',
          actionMode === 'setup' ? 1.25 : 0.44 + pressAmt * 0.18
        );
        lPosX = THREE.MathUtils.lerp(lPosX, lG.posX, activeBlend);
        lPosY = THREE.MathUtils.lerp(lPosY, lG.posY, activeBlend);
        lPosZ = THREE.MathUtils.lerp(lPosZ, lG.posZ, activeBlend);
        lPitch = THREE.MathUtils.lerp(lPitch, lG.pitch - pressAmt * 0.08, activeBlend);
        lYaw = THREE.MathUtils.lerp(lYaw, lG.yaw, activeBlend);
        lRoll = THREE.MathUtils.lerp(lRoll, lG.roll, activeBlend);

        rPosX = THREE.MathUtils.lerp(rPosX, rG.posX, activeBlend);
        rPosY = THREE.MathUtils.lerp(rPosY, rG.posY, activeBlend);
        rPosZ = THREE.MathUtils.lerp(rPosZ, rG.posZ, activeBlend);
        rPitch = THREE.MathUtils.lerp(rPitch, rG.pitch - pressAmt * 0.08, activeBlend);
        rYaw = THREE.MathUtils.lerp(rYaw, rG.yaw, activeBlend);
        rRoll = THREE.MathUtils.lerp(rRoll, rG.roll, activeBlend);

        const wrapCurl = Math.max(0.22, 0.46 + pressAmt * 0.14 - releaseAmt * 0.24);
        targetLeftPose.indexCurl = THREE.MathUtils.lerp(targetLeftPose.indexCurl, wrapCurl, activeBlend);
        targetLeftPose.middleCurl = THREE.MathUtils.lerp(targetLeftPose.middleCurl, wrapCurl + 0.05, activeBlend);
        targetLeftPose.ringCurl = THREE.MathUtils.lerp(targetLeftPose.ringCurl, wrapCurl + 0.1, activeBlend);
        targetLeftPose.pinkyCurl = THREE.MathUtils.lerp(targetLeftPose.pinkyCurl, wrapCurl + 0.14, activeBlend);
        targetLeftPose.thumbCurl = THREE.MathUtils.lerp(targetLeftPose.thumbCurl, 0.40 - releaseAmt * 0.16, activeBlend);
        targetLeftPose.thumbOpp = THREE.MathUtils.lerp(targetLeftPose.thumbOpp, 0.64, activeBlend);

        targetRightPose.indexCurl = THREE.MathUtils.lerp(targetRightPose.indexCurl, wrapCurl, activeBlend);
        targetRightPose.middleCurl = THREE.MathUtils.lerp(targetRightPose.middleCurl, wrapCurl + 0.05, activeBlend);
        targetRightPose.ringCurl = THREE.MathUtils.lerp(targetRightPose.ringCurl, wrapCurl + 0.1, activeBlend);
        targetRightPose.pinkyCurl = THREE.MathUtils.lerp(targetRightPose.pinkyCurl, wrapCurl + 0.14, activeBlend);
        targetRightPose.thumbCurl = THREE.MathUtils.lerp(targetRightPose.thumbCurl, 0.40 - releaseAmt * 0.16, activeBlend);
        targetRightPose.thumbOpp = THREE.MathUtils.lerp(targetRightPose.thumbOpp, 0.64, activeBlend);
      } else if (isWandLike) {
        // Direct coaxial handle grip during both approach ('wand') and active continuous treatment ('hold_wand')
        const sp = interaction.activeDeviceSprite;
        const isEswt = sp === 'shockwave_eswt';
        const isGoni = sp === 'pt_toolkit_cart';
        const wandStyle: 'pole' | 'bar' | 'pinch' = isGoni ? 'pinch' : isEswt ? 'pole' : 'bar';
        const fallbackRoll =
          interaction.probeAxisCamX === undefined ? (isEswt ? 0.26 : isGoni ? 0.92 : 0.72) : undefined;
        const rG = solveArmGripPose(
          1,
          aimX,
          aimY,
          aimZ,
          wandStyle,
          fallbackRoll,
          interaction.probeAxisCamX,
          interaction.probeAxisCamY,
          interaction.probeAxisCamZ
        );
        // Zero drift offsets or wrist tilt: curled finger pocket locks 1:1 onto handle center every frame
        rPosX = THREE.MathUtils.lerp(rPosX, rG.posX, probeBlend);
        rPosY = THREE.MathUtils.lerp(rPosY, rG.posY, probeBlend);
        rPosZ = THREE.MathUtils.lerp(rPosZ, rG.posZ, probeBlend);
        rPitch = THREE.MathUtils.lerp(rPitch, rG.pitch, probeBlend);
        rYaw = THREE.MathUtils.lerp(rYaw, rG.yaw, probeBlend);
        rRoll = THREE.MathUtils.lerp(rRoll, rG.roll, probeBlend);
        rWristPitch = THREE.MathUtils.lerp(rWristPitch, 0, probeBlend);
        rWristYaw = THREE.MathUtils.lerp(rWristYaw, 0, probeBlend);
        rWristRoll = THREE.MathUtils.lerp(rWristRoll, 0, probeBlend);

        if (isEswt && actionMode === 'hold_wand') {
          // Left hand gently braces patient limb beside radial shockwave applicator
          const lBrace = solveArmGripPose(
            -1,
            THREE.MathUtils.clamp(aimX - 0.115, -0.34, 0.04),
            THREE.MathUtils.clamp(aimY + 0.01, -0.30, 0.08),
            THREE.MathUtils.clamp(aimZ + 0.05, -0.78, -0.30),
            'crate',
            -0.38
          );
          lPosX = THREE.MathUtils.lerp(lPosX, lBrace.posX, probeBlend);
          lPosY = THREE.MathUtils.lerp(lPosY, lBrace.posY, probeBlend);
          lPosZ = THREE.MathUtils.lerp(lPosZ, lBrace.posZ, probeBlend);
          lPitch = THREE.MathUtils.lerp(lPitch, lBrace.pitch, probeBlend);
          lYaw = THREE.MathUtils.lerp(lYaw, lBrace.yaw, probeBlend);
          lRoll = THREE.MathUtils.lerp(lRoll, lBrace.roll, probeBlend);
          targetLeftPose.indexCurl = THREE.MathUtils.lerp(targetLeftPose.indexCurl, 0.46, probeBlend);
          targetLeftPose.middleCurl = THREE.MathUtils.lerp(targetLeftPose.middleCurl, 0.52, probeBlend);
          targetLeftPose.ringCurl = THREE.MathUtils.lerp(targetLeftPose.ringCurl, 0.58, probeBlend);
          targetLeftPose.pinkyCurl = THREE.MathUtils.lerp(targetLeftPose.pinkyCurl, 0.62, probeBlend);
          targetLeftPose.thumbCurl = THREE.MathUtils.lerp(targetLeftPose.thumbCurl, 0.36, probeBlend);
          targetLeftPose.thumbOpp = THREE.MathUtils.lerp(targetLeftPose.thumbOpp, 0.58, probeBlend);
        } else {
          // Left hand stays poised naturally at bedside ready to adjust console
          lPosX = THREE.MathUtils.lerp(lPosX, -Math.max(armX + 0.015, 0.172), probeBlend);
          lPosY = THREE.MathUtils.lerp(lPosY, -0.176 + breath, probeBlend);
        }

        if (isGoni) {
          targetRightPose.indexCurl = THREE.MathUtils.lerp(targetRightPose.indexCurl, 0.46, probeBlend);
          targetRightPose.middleCurl = THREE.MathUtils.lerp(targetRightPose.middleCurl, 0.52, probeBlend);
          targetRightPose.ringCurl = THREE.MathUtils.lerp(targetRightPose.ringCurl, 0.72, probeBlend);
          targetRightPose.pinkyCurl = THREE.MathUtils.lerp(targetRightPose.pinkyCurl, 0.78, probeBlend);
          targetRightPose.thumbCurl = THREE.MathUtils.lerp(targetRightPose.thumbCurl, 0.42, probeBlend);
          targetRightPose.thumbOpp = THREE.MathUtils.lerp(targetRightPose.thumbOpp, 0.78, probeBlend);
        } else {
          // Snug palmar wrap matched to the ~3.2cm diameter of US / Laser / ESWT handles
          targetRightPose.indexCurl = THREE.MathUtils.lerp(targetRightPose.indexCurl, 0.86, probeBlend);
          targetRightPose.middleCurl = THREE.MathUtils.lerp(targetRightPose.middleCurl, 0.90, probeBlend);
          targetRightPose.ringCurl = THREE.MathUtils.lerp(targetRightPose.ringCurl, 0.94, probeBlend);
          targetRightPose.pinkyCurl = THREE.MathUtils.lerp(targetRightPose.pinkyCurl, 0.96, probeBlend);
          targetRightPose.thumbCurl = THREE.MathUtils.lerp(targetRightPose.thumbCurl, 0.68, probeBlend);
          targetRightPose.thumbOpp = THREE.MathUtils.lerp(targetRightPose.thumbOpp, 0.84, probeBlend);
        }
        targetRightPose.splay = 0.04;
      } else {
        // Right hand places pad (pinch -> smooth press -> gentle lift) or positions IR/RF arm
        const isPad = actionMode === 'pad';
        const pressDepth = interaction.isDraggingProbe ? 0.010 : pressAmt * 0.014;
        const releasePullZ = releaseAmt * 0.072;
        const releaseLiftY = releaseAmt * 0.034;
        const tgtRoll = isPad ? 1.06 + pressAmt * 0.14 : 0.54;
        const rG = solveArmGripPose(
          1,
          aimX + releaseAmt * 0.018,
          aimY + releaseLiftY,
          aimZ + (isPad ? 0.002 : 0.014) - pressDepth + releasePullZ,
          isPad ? 'pinch' : 'pole',
          tgtRoll
        );
        rPosX = THREE.MathUtils.lerp(rPosX, rG.posX, activeBlend);
        rPosY = THREE.MathUtils.lerp(rPosY, rG.posY, activeBlend);
        rPosZ = THREE.MathUtils.lerp(rPosZ, rG.posZ, activeBlend);
        rPitch = THREE.MathUtils.lerp(rPitch, rG.pitch, activeBlend);
        rYaw = THREE.MathUtils.lerp(rYaw, rG.yaw, activeBlend);
        rRoll = THREE.MathUtils.lerp(rRoll, rG.roll, activeBlend);
        rWristPitch = THREE.MathUtils.lerp(rWristPitch, -pressAmt * 0.06 + releaseAmt * 0.08, activeBlend);

        if (isPad) {
          // Left hand gently steadies lead wire beside placement zone, relaxes during release
          lPosX = THREE.MathUtils.lerp(lPosX, THREE.MathUtils.clamp(aimX - 0.155, -0.25, -0.10), activeBlend);
          lPosY = THREE.MathUtils.lerp(lPosY, THREE.MathUtils.clamp(aimY - 0.055 + releaseLiftY * 0.5, -0.23, -0.08), activeBlend);
          lPosZ = THREE.MathUtils.lerp(lPosZ, THREE.MathUtils.clamp(aimZ + 0.14 + releasePullZ * 0.5, -0.58, -0.34), activeBlend);
          lYaw = THREE.MathUtils.lerp(lYaw, -0.24, activeBlend);
          lRoll = THREE.MathUtils.lerp(lRoll, -0.68, activeBlend);
          targetLeftPose.indexCurl = THREE.MathUtils.lerp(targetLeftPose.indexCurl, 0.48 - releaseAmt * 0.22, activeBlend);
          targetLeftPose.middleCurl = THREE.MathUtils.lerp(targetLeftPose.middleCurl, 0.54 - releaseAmt * 0.22, activeBlend);
          targetLeftPose.thumbCurl = THREE.MathUtils.lerp(targetLeftPose.thumbCurl, 0.40 - releaseAmt * 0.18, activeBlend);
          targetLeftPose.thumbOpp = THREE.MathUtils.lerp(targetLeftPose.thumbOpp, 0.62, activeBlend);

          // 3-stage TENS/EMG kinematics: pinch pad stud -> flatten fingertips to smooth adhesive -> gentle open lift
          const smoothPress = pressAmt * pressAmt;
          const idxCurl = THREE.MathUtils.lerp(0.42, 0.17, smoothPress);
          const midCurl = THREE.MathUtils.lerp(0.48, 0.21, smoothPress);
          targetRightPose.indexCurl = THREE.MathUtils.lerp(targetRightPose.indexCurl, Math.max(0.16, idxCurl - releaseAmt * 0.12), activeBlend);
          targetRightPose.middleCurl = THREE.MathUtils.lerp(targetRightPose.middleCurl, Math.max(0.20, midCurl - releaseAmt * 0.12), activeBlend);
          targetRightPose.ringCurl = THREE.MathUtils.lerp(targetRightPose.ringCurl, 0.68 - releaseAmt * 0.30, activeBlend);
          targetRightPose.pinkyCurl = THREE.MathUtils.lerp(targetRightPose.pinkyCurl, 0.76 - releaseAmt * 0.32, activeBlend);
          targetRightPose.thumbCurl = THREE.MathUtils.lerp(targetRightPose.thumbCurl, 0.36 - smoothPress * 0.14 - releaseAmt * 0.12, activeBlend);
          targetRightPose.thumbOpp = THREE.MathUtils.lerp(targetRightPose.thumbOpp, 0.78 - smoothPress * 0.18, activeBlend);
          targetRightPose.splay = 0.08 + releaseAmt * 0.08;
        } else {
          lPosX = THREE.MathUtils.lerp(lPosX, -Math.max(armX + 0.02, 0.17), activeBlend);
          lPosY = THREE.MathUtils.lerp(lPosY, -0.19, activeBlend);

          targetRightPose.indexCurl = THREE.MathUtils.lerp(targetRightPose.indexCurl, 0.62 - releaseAmt * 0.15, activeBlend);
          targetRightPose.middleCurl = THREE.MathUtils.lerp(targetRightPose.middleCurl, 0.68 - releaseAmt * 0.15, activeBlend);
          targetRightPose.ringCurl = THREE.MathUtils.lerp(targetRightPose.ringCurl, 0.78 - releaseAmt * 0.15, activeBlend);
          targetRightPose.pinkyCurl = THREE.MathUtils.lerp(targetRightPose.pinkyCurl, 0.84 - releaseAmt * 0.15, activeBlend);
          targetRightPose.thumbCurl = THREE.MathUtils.lerp(targetRightPose.thumbCurl, 0.50, activeBlend);
          targetRightPose.thumbOpp = THREE.MathUtils.lerp(targetRightPose.thumbOpp, 0.76, activeBlend);
          targetRightPose.splay = 0.06;
        }
      }
    }

    // 3. Console Parameter / Start Screen Tap (If right hand holds an active wand, left hand dials/taps console!)
    if (tapSmooth > 0.01) {
      if (interaction?.probeActionMode === 'hold_wand' && probeBlend > 0.25) {
        lPosX = THREE.MathUtils.lerp(lPosX, -0.105, tapSmooth);
        lPosY = THREE.MathUtils.lerp(lPosY, -0.105, tapSmooth);
        lPosZ = THREE.MathUtils.lerp(lPosZ, -0.455, tapSmooth);
        lPitch = THREE.MathUtils.lerp(lPitch, -0.04, tapSmooth);
        lYaw = THREE.MathUtils.lerp(lYaw, -0.24, tapSmooth);
        lRoll = THREE.MathUtils.lerp(lRoll, -1.05, tapSmooth);
        lWristPitch = THREE.MathUtils.lerp(lWristPitch, -0.09, tapSmooth);

        targetLeftPose.indexCurl = THREE.MathUtils.lerp(targetLeftPose.indexCurl, 0.08, tapSmooth);
        targetLeftPose.middleCurl = THREE.MathUtils.lerp(targetLeftPose.middleCurl, 0.78, tapSmooth);
        targetLeftPose.ringCurl = THREE.MathUtils.lerp(targetLeftPose.ringCurl, 0.84, tapSmooth);
        targetLeftPose.pinkyCurl = THREE.MathUtils.lerp(targetLeftPose.pinkyCurl, 0.88, tapSmooth);
        targetLeftPose.thumbCurl = THREE.MathUtils.lerp(targetLeftPose.thumbCurl, 0.52, tapSmooth);
        targetLeftPose.thumbOpp = THREE.MathUtils.lerp(targetLeftPose.thumbOpp, 0.64, tapSmooth);
      } else {
        rPosX = THREE.MathUtils.lerp(rPosX, 0.115, tapSmooth);
        rPosY = THREE.MathUtils.lerp(rPosY, -0.105, tapSmooth);
        rPosZ = THREE.MathUtils.lerp(rPosZ, -0.455, tapSmooth);
        rPitch = THREE.MathUtils.lerp(rPitch, -0.04, tapSmooth);
        rYaw = THREE.MathUtils.lerp(rYaw, 0.24, tapSmooth);
        rRoll = THREE.MathUtils.lerp(rRoll, 1.05, tapSmooth);
        rWristPitch = THREE.MathUtils.lerp(rWristPitch, -0.09, tapSmooth);

        targetRightPose.indexCurl = THREE.MathUtils.lerp(targetRightPose.indexCurl, 0.08, tapSmooth);
        targetRightPose.middleCurl = THREE.MathUtils.lerp(targetRightPose.middleCurl, 0.78, tapSmooth);
        targetRightPose.ringCurl = THREE.MathUtils.lerp(targetRightPose.ringCurl, 0.84, tapSmooth);
        targetRightPose.pinkyCurl = THREE.MathUtils.lerp(targetRightPose.pinkyCurl, 0.88, tapSmooth);
        targetRightPose.thumbCurl = THREE.MathUtils.lerp(targetRightPose.thumbCurl, 0.52, tapSmooth);
        targetRightPose.thumbOpp = THREE.MathUtils.lerp(targetRightPose.thumbOpp, 0.64, tapSmooth);
      }
    }

    // 4. Warm Clinician-Patient Handshake (Right hand extends forward, thumb upright, palm inward to clasp patient hand)
    if (handshakeSmooth > 0.01 && interaction) {
      const hsOsc = interaction.handshakeOsc ?? 0;
      const hsX = THREE.MathUtils.clamp(interaction.handshakeTargetCamX ?? 0.055, -0.02, 0.16);
      const hsY = THREE.MathUtils.clamp(interaction.handshakeTargetCamY ?? -0.145, -0.24, -0.05) + hsOsc * 0.022;
      const hsZ = THREE.MathUtils.clamp(interaction.handshakeTargetCamZ ?? -0.42, -0.52, -0.32);

      const gHs = solveArmGripPose(1, hsX, hsY, hsZ, 'pole');
      rPosX = THREE.MathUtils.lerp(rPosX, gHs.posX, handshakeSmooth);
      rPosY = THREE.MathUtils.lerp(rPosY, gHs.posY, handshakeSmooth);
      rPosZ = THREE.MathUtils.lerp(rPosZ, gHs.posZ, handshakeSmooth);
      rPitch = THREE.MathUtils.lerp(rPitch, gHs.pitch + hsOsc * 0.06, handshakeSmooth);
      rYaw = THREE.MathUtils.lerp(rYaw, gHs.yaw, handshakeSmooth);
      rRoll = THREE.MathUtils.lerp(rRoll, 0.18, handshakeSmooth);
      rWristPitch = THREE.MathUtils.lerp(rWristPitch, hsOsc * 0.05, handshakeSmooth);

      // Left arm relaxes gently down and slightly outward while offering right hand
      lPosX = THREE.MathUtils.lerp(lPosX, -Math.max(armX + 0.025, 0.175), handshakeSmooth);
      lPosY = THREE.MathUtils.lerp(lPosY, -0.192, handshakeSmooth);

      // Clasp smoothly peaks during the shake phase (0.58) and opens softly on reach/release (0.28)
      const claspAmt = 0.28 + Math.sin(Math.min(1, handshakeSmooth) * Math.PI * 0.5) * 0.28;
      targetRightPose.indexCurl = THREE.MathUtils.lerp(targetRightPose.indexCurl, claspAmt, handshakeSmooth);
      targetRightPose.middleCurl = THREE.MathUtils.lerp(targetRightPose.middleCurl, claspAmt + 0.06, handshakeSmooth);
      targetRightPose.ringCurl = THREE.MathUtils.lerp(targetRightPose.ringCurl, claspAmt + 0.12, handshakeSmooth);
      targetRightPose.pinkyCurl = THREE.MathUtils.lerp(targetRightPose.pinkyCurl, claspAmt + 0.16, handshakeSmooth);
      targetRightPose.thumbCurl = THREE.MathUtils.lerp(targetRightPose.thumbCurl, claspAmt * 0.82, handshakeSmooth);
      targetRightPose.thumbOpp = THREE.MathUtils.lerp(targetRightPose.thumbOpp, 0.62, handshakeSmooth);
      targetRightPose.splay = THREE.MathUtils.lerp(targetRightPose.splay, 0.12, handshakeSmooth);
    }

    dampPose(curLeftPose, targetLeftPose, dt);
    dampPose(curRightPose, targetRightPose, dt);

    if (leftAsm.fkRig) {
      applyHandFkPose(leftAsm.fkRig, curLeftPose);
    }
    if (rightAsm.fkRig) {
      applyHandFkPose(rightAsm.fkRig, curRightPose);
    }

    leftAsm.armRoot.position.set(lPosX, lPosY, lPosZ);
    leftAsm.armRoot.rotation.set(lPitch, lYaw, lRoll, 'YXZ');
    leftAsm.handPivot.rotation.set(lWristPitch, lWristYaw, lWristRoll, 'YXZ');

    rightAsm.armRoot.position.set(rPosX, rPosY, rPosZ);
    rightAsm.armRoot.rotation.set(rPitch, rYaw, rRoll, 'YXZ');
    rightAsm.handPivot.rotation.set(rWristPitch, rWristYaw, rWristRoll, 'YXZ');
  };

  return {
    group,
    leftArm: leftAsm.armRoot,
    rightArm: rightAsm.armRoot,
    updateAppearance,
    updateMotion,
    dispose: () => {
      unsubGlbReady();
      for (const d of disposables) d.dispose();
    },
  };
}
