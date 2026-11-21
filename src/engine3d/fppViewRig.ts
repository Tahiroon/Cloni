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
    aspect?: number
  ) => void;
  dispose: () => void;
}

function createWallEngravingTextures(maxAniso: number): {
  colorTex: THREE.CanvasTexture;
  bumpTex: THREE.CanvasTexture;
} {
  const W = 1280;
  const H = 360;

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = W;
  colorCanvas.height = H;
  const cCtx = colorCanvas.getContext('2d');

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = W;
  bumpCanvas.height = H;
  const bCtx = bumpCanvas.getContext('2d');

  if (cCtx && bCtx) {
    cCtx.clearRect(0, 0, W, H);
    bCtx.fillStyle = '#ffffff';
    bCtx.fillRect(0, 0, W, H);

    const drawTextPass = (
      ctx: CanvasRenderingContext2D,
      mainColor: string | CanvasGradient,
      subLeftColor: string,
      subRightColor: string | CanvasGradient,
      lineColor: string | CanvasGradient,
      offsetX: number,
      offsetY: number
    ) => {
      // Line 1: "Therason physiotherapy"
      ctx.direction = 'ltr';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '800 72px "Plus Jakarta Sans", "Cairo", sans-serif';
      ctx.fillStyle = mainColor;
      ctx.fillText('Therason physiotherapy', W / 2 + offsetX, 118 + offsetY);

      // Sleek architectural divider line
      ctx.fillStyle = lineColor;
      ctx.fillRect(W / 2 - 230 + offsetX, 182 + offsetY, 460, 4);

      // Line 2: "Powered by طـــاهــر مــحـمـد"
      const prefix = 'Powered by ';
      const arName = 'طـــاهــر مــحـمـد';
      ctx.font = '700 40px "Plus Jakarta Sans", sans-serif';
      const wPrefix = ctx.measureText(prefix).width;
      ctx.font = '800 54px "Cairo", "Plus Jakarta Sans", sans-serif';
      const wName = ctx.measureText(arName).width;
      const totalW = wPrefix + wName;
      const startX = (W - totalW) / 2 + offsetX;

      ctx.direction = 'ltr';
      ctx.textAlign = 'left';
      ctx.font = '700 40px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = subLeftColor;
      ctx.fillText(prefix, startX, 246 + offsetY);

      ctx.direction = 'rtl';
      ctx.textAlign = 'right';
      ctx.font = '800 54px "Cairo", "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = subRightColor;
      ctx.fillText(arName, startX + totalW, 244 + offsetY);
    };

    // Subtle crisp lower wall-lip highlight (simulating light catching the bottom edge of engraved letters)
    drawTextPass(
      cCtx,
      'rgba(255, 255, 255, 0.72)',
      'rgba(255, 255, 255, 0.65)',
      'rgba(255, 255, 255, 0.72)',
      'rgba(255, 255, 255, 0.55)',
      0,
      2.5
    );

    // Subtle deep carved upper recess shadow inside the plaster wall
    drawTextPass(
      cCtx,
      'rgba(10, 32, 58, 0.42)',
      'rgba(10, 32, 58, 0.36)',
      'rgba(10, 32, 58, 0.42)',
      'rgba(10, 32, 58, 0.32)',
      0,
      -2.2
    );

    // Rich azure-cobalt inlaid lettering directly on the wall
    const titleGrad = cCtx.createLinearGradient(220, 70, 1060, 160);
    titleGrad.addColorStop(0, '#075985');
    titleGrad.addColorStop(0.5, '#0284c7');
    titleGrad.addColorStop(1, '#0369a1');

    const lineGrad = cCtx.createLinearGradient(W / 2 - 230, 0, W / 2 + 230, 0);
    lineGrad.addColorStop(0, 'rgba(14, 165, 233, 0.15)');
    lineGrad.addColorStop(0.5, '#0ea5e9');
    lineGrad.addColorStop(1, 'rgba(14, 165, 233, 0.15)');

    const nameGrad = cCtx.createLinearGradient(420, 210, 920, 280);
    nameGrad.addColorStop(0, '#0369a1');
    nameGrad.addColorStop(0.55, '#0284c7');
    nameGrad.addColorStop(1, '#0ea5e9');

    drawTextPass(cCtx, titleGrad, '#1e3a5f', nameGrad, lineGrad, 0, 0);

    // Matching negative-engraving bump map (dark strokes = recessed into the wall)
    drawTextPass(bCtx, '#303030', '#484848', '#303030', '#505050', 0, 0);
  }

  const aniso = Math.min(8, maxAniso || 4);
  const colorTex = new THREE.CanvasTexture(colorCanvas);
  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.anisotropy = aniso;
  colorTex.needsUpdate = true;

  const bumpTex = new THREE.CanvasTexture(bumpCanvas);
  bumpTex.anisotropy = aniso;
  bumpTex.needsUpdate = true;

  return { colorTex, bumpTex };
}

export function createFppRoomBackdrop3D(
  textures: TextureBundle,
  maxAniso: number
): FppBackdropHandle {
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

  const plasterMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.plasterAlbedo,
      bumpMap: textures.stuccoBump,
      roughnessMap: textures.plasterRough,
      bumpScale: 0.018,
      roughness: 0.92,
      metalness: 0.0,
      envMapIntensity: 0.45,
    })
  );

  const wainscotMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.wainscotAlbedo,
      bumpMap: textures.wainscotBump,
      bumpScale: 0.016,
      roughness: 0.56,
      metalness: 0.05,
    })
  );

  const darkTrimMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x26303e,
      bumpMap: textures.brushedMetalBump,
      bumpScale: 0.003,
      roughness: 0.36,
      metalness: 0.7,
    })
  );

  const aluminumMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xc2cbd6,
      bumpMap: textures.brushedMetalBump,
      bumpScale: 0.004,
      roughness: 0.3,
      metalness: 0.78,
    })
  );

  const woodSlatMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.wood,
      bumpMap: textures.woodBump,
      bumpScale: 0.012,
      roughness: 0.62,
      metalness: 0.02,
    })
  );

  const warmCoveMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      emissive: 0xfbbf24,
      emissiveIntensity: 0.55,
      roughness: 0.3,
    })
  );

  const { colorTex: wallSignColorTex, bumpTex: wallSignBumpTex } =
    createWallEngravingTextures(maxAniso);
  disposables.push(wallSignColorTex, wallSignBumpTex);
  const wallEngravingMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: wallSignColorTex,
      bumpMap: wallSignBumpTex,
      bumpScale: 0.022,
      transparent: true,
      alphaTest: 0.01,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      roughness: 0.62,
      metalness: 0.12,
      emissiveMap: wallSignColorTex,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.14,
    })
  );

  const floorColorTex = textures.tileBlue.clone();
  floorColorTex.repeat.set(3.6, 2.6);
  floorColorTex.needsUpdate = true;
  disposables.push(floorColorTex);

  const floorNormTex = textures.tileNormal.clone();
  floorNormTex.repeat.set(3.6, 2.6);
  floorNormTex.needsUpdate = true;
  disposables.push(floorNormTex);

  const floorMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: floorColorTex,
      normalMap: floorNormTex,
      normalScale: new THREE.Vector2(0.32, 0.32),
      roughness: 0.46,
      metalness: 0.04,
      envMapIntensity: 0.45,
    })
  );

  const ceilingMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.92,
      metalness: 0.0,
      envMapIntensity: 0.35,
    })
  );

  const ceilingPanelMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfff8eb,
      emissiveIntensity: 0.72,
      roughness: 0.24,
    })
  );

  // Enclosed universal examination bay template (completely isolates session from outer clinic landmarks)
  const backZ = -0.84;
  const frontZ = 2.96;
  const roomW = 5.4;
  const roomD = frontZ - backZ;
  const centerZ = (backZ + frontZ) / 2;
  const wallH = 2.75;
  const wainH = 0.88;
  const upperH = wallH - wainH;

  const buildWallSpan = (spanLen: number, x: number, z: number, rotY: number) => {
    const wg = new THREE.Group();
    wg.position.set(x, 0, z);
    wg.rotation.y = rotY;

    const skirt = new THREE.Mesh(
      trackGeom(new THREE.BoxGeometry(spanLen, 0.1, 0.08)),
      darkTrimMat
    );
    skirt.position.set(0, 0.05, 0);

    const wain = new THREE.Mesh(
      trackGeom(new THREE.BoxGeometry(spanLen, wainH, 0.065)),
      wainscotMat
    );
    wain.position.set(0, wainH / 2, 0);

    const dado = new THREE.Mesh(
      trackGeom(new THREE.BoxGeometry(spanLen + 0.02, 0.05, 0.09)),
      aluminumMat
    );
    dado.position.set(0, wainH + 0.015, 0.008);

    const upper = new THREE.Mesh(
      trackGeom(new THREE.BoxGeometry(spanLen, upperH, 0.06)),
      plasterMat
    );
    upper.position.set(0, wainH + upperH / 2, 0);

    const crown = new THREE.Mesh(
      trackGeom(new THREE.BoxGeometry(spanLen + 0.02, 0.065, 0.09)),
      darkTrimMat
    );
    crown.position.set(0, wallH - 0.032, 0.008);

    wg.add(skirt, wain, dado, upper, crown);
    group.add(wg);
  };

  // Back wall (behind patient), Front wall (behind camera), and extended Left & Right walls
  buildWallSpan(roomW + 0.12, 0, backZ, 0);
  buildWallSpan(roomW + 0.12, 0, frontZ, Math.PI);
  buildWallSpan(roomD + 0.12, -roomW / 2, centerZ, Math.PI / 2);
  buildWallSpan(roomD + 0.12, roomW / 2, centerZ, -Math.PI / 2);

  // Seamless universal floor & ceiling
  const floorMesh = new THREE.Mesh(
    trackGeom(new THREE.PlaneGeometry(roomW + 0.14, roomD + 0.14)),
    floorMat
  );
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.set(0, -0.002, centerZ);
  group.add(floorMesh);

  const ceilingMesh = new THREE.Mesh(
    trackGeom(new THREE.PlaneGeometry(roomW + 0.14, roomD + 0.14)),
    ceilingMat
  );
  ceilingMesh.rotation.x = Math.PI / 2;
  ceilingMesh.position.set(0, wallH, centerZ);
  group.add(ceilingMesh);

  const ceilingLightPanel = new THREE.Mesh(
    trackGeom(new THREE.BoxGeometry(1.18, 0.02, 0.46)),
    ceilingPanelMat
  );
  ceilingLightPanel.position.set(0, wallH - 0.01, 0.52);
  group.add(ceilingLightPanel);

  // Back wall oak acoustic wood-slat flanks
  for (const flankX of [-1.32, 1.32]) {
    const backing = new THREE.Mesh(
      trackGeom(new THREE.BoxGeometry(0.56, 1.56, 0.02)),
      darkTrimMat
    );
    backing.position.set(flankX, 1.74, backZ + 0.038);
    group.add(backing);
    for (let si = -2; si <= 2; si++) {
      const slat = new THREE.Mesh(
        trackGeom(new THREE.BoxGeometry(0.058, 1.52, 0.026)),
        woodSlatMat
      );
      slat.position.set(flankX + si * 0.105, 1.74, backZ + 0.052);
      group.add(slat);
    }
  }

  // Wall-engraved typography directly on the plaster wall above the patient's shoulders
  const wallEngraving = new THREE.Mesh(
    trackGeom(new THREE.PlaneGeometry(1.66, 0.46)),
    wallEngravingMat
  );
  wallEngraving.position.set(0, 1.62, backZ + 0.036);
  wallEngraving.renderOrder = 1;
  group.add(wallEngraving);

  const coveBar = new THREE.Mesh(
    trackGeom(new THREE.BoxGeometry(1.95, 0.026, 0.05)),
    warmCoveMat
  );
  coveBar.position.set(0, wallH - 0.06, backZ + 0.08);
  group.add(coveBar);

  const wallLight = new THREE.PointLight(0xfff7ea, 1.15, 6.5, 1.0);
  wallLight.castShadow = false;
  wallLight.position.set(0, 2.24, backZ + 0.85);
  group.add(wallLight);

  const roomFillLight = new THREE.PointLight(0xf8fbff, 1.0, 8.5, 1.0);
  roomFillLight.castShadow = false;
  roomFillLight.position.set(0, 2.48, 0.85);
  group.add(roomFillLight);

  const setLightFactor = (alpha: number, isNight = false) => {
    const a = THREE.MathUtils.clamp(alpha, 0, 1);
    wallLight.intensity = a * (isNight ? 1.48 : 1.15);
    roomFillLight.intensity = a * (isNight ? 1.38 : 0.95);
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

  const halfHeightAtArm = 0.38 * Math.tan(THREE.MathUtils.degToRad(52 * 0.5));

  const updateMotion = (
    fppSmooth: number,
    walkBob: number,
    timeSec: number,
    isSpeakingOrExam: boolean,
    aspect = 1.6
  ) => {
    const visible = fppSmooth > 0.48;
    group.visible = visible;
    if (!visible) return;

    const t = THREE.MathUtils.clamp((fppSmooth - 0.48) / 0.52, 0, 1);
    const easeIn = t * t * t * (t * (t * 6 - 15) + 10);
    const dropY = (1 - easeIn) * -0.14;

    const halfWidth = halfHeightAtArm * Math.max(0.46, aspect);
    const armX = Math.min(0.168, halfWidth * 0.65);

    const breath = Math.sin(timeSec * 1.75) * 0.0032;
    const walkSin = Math.sin(walkBob);
    const walkCos = Math.cos(walkBob * 2);
    const examGesture = isSpeakingOrExam ? Math.sin(timeSec * 3.1) * 0.012 : 0;

    leftArm.position.set(
      -armX,
      -0.106 + dropY + breath + walkCos * 0.0038,
      -0.38 + walkSin * 0.011
    );
    leftArm.rotation.set(
      0.24 + breath * 1.6 + examGesture,
      -0.28,
      -0.16
    );

    rightArm.position.set(
      armX,
      -0.106 + dropY + breath + walkCos * 0.0038 + Math.abs(examGesture) * 0.45,
      -0.38 - walkSin * 0.011 - (isSpeakingOrExam ? 0.014 : 0)
    );
    rightArm.rotation.set(
      0.26 + breath * 1.6 + examGesture * 1.3,
      0.30,
      0.16
    );
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
