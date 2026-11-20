import * as THREE from 'three';
import { CharacterPose, StaffRole } from '../types/clinic';
import { glbRegistry } from './glbRegistry';

export type OutfitStyle = 'casual' | 'jalabiya' | 'abaya' | 'abaya_open' | 'dress';

export interface HumanoidAppearance {
  skinTone: string;
  hairColor: string;
  shirtColor: string;
  pantsColor: string;
  hasHijab?: boolean;
  hasBeard?: boolean;
  hasTurban?: boolean;
  outfitStyle?: OutfitStyle;
  shirtStyle?: 'tshirt' | 'shirt';
  heightScale?: number;
  isFemale?: boolean;
  variantSeed?: number;
  mobilityAid?: 'none' | 'cane' | 'crutches';
  isStaff?: boolean;
  role?: StaffRole;
  contactShadowTex?: THREE.Texture;
  skinMicroMap?: THREE.Texture;
  skinRoughMap?: THREE.Texture;
  fabricWeaveBump?: THREE.Texture;
  leatherBump?: THREE.Texture;
  brushedMetalBump?: THREE.Texture;
}

interface SkinnedBoneRef {
  bone: THREE.Object3D;
  restQuat: THREE.Quaternion;
  restWorldQ: THREE.Quaternion;
  invWorldQ: THREE.Quaternion;
}

export interface HumanoidRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  selectRing: THREE.Mesh;
  hitMesh: THREE.Mesh;
  handCup?: THREE.Group;
  handFile?: THREE.Group;
  isSkinnedGlb: boolean;
  hipHeight?: number;
  heightScale?: number;
  bones?: Record<string, SkinnedBoneRef>;
  // Procedural fallback references
  torso?: THREE.Group;
  headGroup?: THREE.Group;
  leftArm?: THREE.Group;
  rightArm?: THREE.Group;
  leftLeg?: THREE.Group;
  rightLeg?: THREE.Group;
  leftShin?: THREE.Group;
  rightShin?: THREE.Group;
  robePivot?: THREE.Group;
}

const _euler = new THREE.Euler();
const RICH_SKIN_PALETTE = [
  '#be8862',
  '#a66e49',
  '#8f5938',
  '#79472b',
  '#653920',
  '#522c18',
  '#412111',
];

function resolveRichSkinColor(hexStr: string | undefined, seed = 0): THREE.Color {
  const c = new THREE.Color(hexStr || '#79472b');
  // Map both overly pale and overly pitch-black legacy saved skin tones into natural warm brown-to-tan diversity
  const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  if (lum > 0.36 || lum < 0.014) {
    const idx = Math.abs(Math.round(lum * 100) + seed) % RICH_SKIN_PALETTE.length;
    return new THREE.Color(RICH_SKIN_PALETTE[idx]);
  }
  return c;
}

function makeSkinMat(hex: string | number, appearance: HumanoidAppearance, roughness = 0.56) {
  const baseCol = new THREE.Color(hex);
  const sheenCol = baseCol.clone().lerp(new THREE.Color(0x9a4c30), 0.38);
  return new THREE.MeshPhysicalMaterial({
    color: baseCol,
    map: appearance.skinMicroMap ?? null,
    roughnessMap: appearance.skinRoughMap ?? null,
    roughness,
    metalness: 0.0,
    sheen: 0.16,
    sheenRoughness: 0.68,
    sheenColor: sheenCol,
    envMapIntensity: 0.34,
  });
}

function makeClothMat(
  hex: string | number,
  appearance: HumanoidAppearance,
  roughness = 0.84,
  sheen = 0.58,
  doubleSide = false,
  vertexColors = false
) {
  const sheenCol = new THREE.Color(hex).lerp(new THREE.Color(0xffffff), 0.35);
  return new THREE.MeshPhysicalMaterial({
    color: hex,
    bumpMap: appearance.fabricWeaveBump ?? null,
    bumpScale: 0.0026,
    roughness,
    metalness: 0.01,
    sheen,
    sheenRoughness: 0.66,
    sheenColor: sheenCol,
    side: doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    vertexColors,
    envMapIntensity: 0.46,
  });
}

function makeLeatherMat(hex: string | number, appearance: HumanoidAppearance, roughness = 0.46) {
  return new THREE.MeshPhysicalMaterial({
    color: hex,
    bumpMap: appearance.leatherBump ?? null,
    bumpScale: 0.0022,
    roughness,
    metalness: 0.05,
    clearcoat: 0.26,
    clearcoatRoughness: 0.4,
    envMapIntensity: 0.56,
  });
}

function makeMetalMat(
  hex: string | number,
  appearance: HumanoidAppearance,
  roughness = 0.28,
  metalness = 0.82
) {
  return new THREE.MeshPhysicalMaterial({
    color: hex,
    bumpMap: appearance.brushedMetalBump ?? null,
    bumpScale: 0.0018,
    roughness,
    metalness,
    envMapIntensity: 0.72,
  });
}

function colorMat(hex: string | number, roughness = 0.76, metalness = 0.02, doubleSide = false) {
  return new THREE.MeshStandardMaterial({
    color: hex,
    roughness,
    metalness,
    side: doubleSide ? THREE.DoubleSide : THREE.FrontSide,
  });
}

function resolveOutfitStyle(appearance: HumanoidAppearance): OutfitStyle {
  if (appearance.outfitStyle) return appearance.outfitStyle;
  if (appearance.isStaff && appearance.role === 'receptionist') return 'abaya';
  if (appearance.isFemale && appearance.hasHijab) return 'abaya';
  return 'casual';
}

function pickGlbKey(appearance: HumanoidAppearance): string {
  const style = resolveOutfitStyle(appearance);
  const idx = Math.abs(appearance.variantSeed || 0);

  // All women & staff use woman_suit.glb (long sleeves, closed ankles, zero bare shoulder/arm/leg skin)
  if (
    appearance.isStaff ||
    appearance.isFemale ||
    appearance.hasHijab ||
    style === 'abaya' ||
    style === 'abaya_open' ||
    style === 'dress'
  ) {
    return 'char_woman_suit';
  }

  // Men: Jalabiya uses man_suit.glb; casual chooses tshirt (man_casual2) or long-sleeve shirt (man_suit)
  if (style === 'jalabiya') {
    return 'char_suit';
  }
  if (appearance.shirtStyle === 'tshirt') return 'char_man2';
  if (appearance.shirtStyle === 'shirt') return 'char_suit';
  return idx % 2 === 0 ? 'char_man2' : 'char_suit';
}

function findBoneIdx(bones: THREE.Bone[], names: string[]): number {
  for (const n of names) {
    const idx = bones.findIndex((b) => b.name === n);
    if (idx >= 0) return idx;
  }
  return 0;
}

/**
 * Builds a true SkinnedMesh garment (Abaya, Open Abaya, Long Dress, Tunic, or Jalabiya)
 * directly in CharacterArmature's local space and binds it to the character's existing
 * skeleton so walking, standing, sitting, and lying deform cleanly with zero leg/hip clipping.
 */
function createSkinnedGarmentMesh(
  legMesh: THREE.SkinnedMesh,
  appearance: HumanoidAppearance,
  opts: {
    colorHex: number;
    zTop: number;
    zBot: number;
    topRx: number;
    topRy: number;
    midRx: number;
    midRy: number;
    botRx: number;
    botRy: number;
    topCy: number;
    botCy: number;
    openFrontGapRad?: number;
    closeBottomCap?: boolean;
    accentHemHex?: number;
  }
): THREE.SkinnedMesh {
  const skeleton = legMesh.skeleton;
  const bones = skeleton.bones;

  const idxHips = findBoneIdx(bones, ['Hips']);
  const idxAbdomen = findBoneIdx(bones, ['Abdomen', 'Hips']);
  const idxUL = findBoneIdx(bones, ['UpperLegL', 'UpperLeg.L']);
  const idxLL = findBoneIdx(bones, ['LowerLegL', 'LowerLeg.L']);
  const idxUR = findBoneIdx(bones, ['UpperLegR', 'UpperLeg.R']);
  const idxLR = findBoneIdx(bones, ['LowerLegR', 'LowerLeg.R']);

  const rings = 24;
  const radialSegs = 44;
  const gap = opts.openFrontGapRad || 0;
  const thetaStart = gap;
  const thetaSpan = Math.PI * 2 - gap * 2;
  const cols = radialSegs + 1;

  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const skinIndices: number[] = [];
  const skinWeights: number[] = [];
  const indices: number[] = [];

  const hemCol =
    opts.accentHemHex !== undefined
      ? new THREE.Color(opts.accentHemHex)
      : new THREE.Color(0x000000);
  const baseCol = new THREE.Color(opts.colorHex);
  const hemRatioR = baseCol.r > 0.02 ? hemCol.r / baseCol.r : 0.72;
  const hemRatioG = baseCol.g > 0.02 ? hemCol.g / baseCol.g : 0.72;
  const hemRatioB = baseCol.b > 0.02 ? hemCol.b / baseCol.b : 0.72;

  for (let r = 0; r <= rings; r++) {
    const v = r / rings; // 0 = top waist/chest, 1 = bottom hem
    const z = THREE.MathUtils.lerp(opts.zTop, opts.zBot, v);
    const cy = THREE.MathUtils.lerp(opts.topCy, opts.botCy, v);

    let rx: number;
    let ry: number;
    if (v < 0.36) {
      const t = v / 0.36;
      const smooth = t * t * (3 - 2 * t);
      rx = THREE.MathUtils.lerp(opts.topRx, opts.midRx, smooth);
      ry = THREE.MathUtils.lerp(opts.topRy, opts.midRy, smooth);
    } else {
      const t = (v - 0.36) / 0.64;
      rx = THREE.MathUtils.lerp(opts.midRx, opts.botRx, t);
      ry = THREE.MathUtils.lerp(opts.midRy, opts.botRy, t);
    }

    for (let c = 0; c <= radialSegs; c++) {
      const u = c / radialSegs;
      const theta = thetaStart + u * thetaSpan;
      // Subtle organic vertical pleats widening toward the lower hem
      const pleatWave = Math.sin(theta * 7 + v * 1.4);
      const pleatAmp = 0.042 * Math.max(0, v - 0.06);
      const pleatMul = 1 + pleatWave * pleatAmp;
      // In CharacterArmature space: +X is left, -Y is world front (+Z), +Y is world back (-Z)
      const x = rx * pleatMul * Math.sin(theta);
      const y = cy - ry * pleatMul * Math.cos(theta);
      positions.push(x, y, z);
      uvs.push(u, 1 - v);

      // Subtle trough ambient occlusion + delicate hem contrast
      const troughAo = (0.94 + 0.06 * pleatWave) * (1 - 0.07 * v);
      if (opts.accentHemHex !== undefined && v >= 0.93) {
        colors.push(
          Math.min(1.2, hemRatioR * troughAo),
          Math.min(1.2, hemRatioG * troughAo),
          Math.min(1.2, hemRatioB * troughAo)
        );
      } else {
        colors.push(troughAo, troughAo, troughAo);
      }

      // Left/Right leg weighting with smooth center drape seam
      const sideL = THREE.MathUtils.smoothstep(x, -0.0013, 0.0013);
      const sideR = 1 - sideL;

      let b0 = idxHips;
      let w0 = 0;
      let b1 = idxUL;
      let w1 = 0;
      let b2 = idxUR;
      let w2 = 0;
      let b3 = idxAbdomen;
      let w3 = 0;

      if (z >= 0.0108) {
        // Upper waist/hips smoothly shared between Abdomen/Hips & UpperLegs
        const waistT = THREE.MathUtils.clamp((z - 0.0108) / Math.max(0.0005, opts.zTop - 0.0108), 0, 1);
        const legShare = 0.25 * (1 - waistT);
        w0 = 0.45 * (1 - waistT) + 0.35 * waistT;
        w3 = 0.30 + 0.35 * waistT;
        w1 = legShare * sideL;
        w2 = legShare * sideR;
      } else if (z >= 0.0062) {
        // Thigh region: hips blend into UpperLegL / UpperLegR
        const hipShare = THREE.MathUtils.clamp((z - 0.0085) / 0.0023, 0, 1) * 0.28;
        const legShare = 1 - hipShare;
        b0 = idxHips;
        w0 = hipShare;
        b1 = idxUL;
        w1 = legShare * sideL;
        b2 = idxUR;
        w2 = legShare * sideR;
      } else if (z >= 0.0046) {
        // Knee transition region: UpperLeg -> LowerLeg
        const kneeT = (0.0062 - z) / 0.0016;
        b0 = idxUL;
        w0 = (1 - kneeT) * sideL;
        b1 = idxUR;
        w1 = (1 - kneeT) * sideR;
        b2 = idxLL;
        w2 = kneeT * sideL;
        b3 = idxLR;
        w3 = kneeT * sideR;
      } else {
        // Calf & ankle hem
        b0 = idxLL;
        w0 = sideL;
        b1 = idxLR;
        w1 = sideR;
      }

      const sum = w0 + w1 + w2 + w3 || 1;
      skinIndices.push(b0, b1, b2, b3);
      skinWeights.push(w0 / sum, w1 / sum, w2 / sum, w3 / sum);
    }
  }

  for (let r = 0; r < rings; r++) {
    for (let c = 0; c < radialSegs; c++) {
      const a = r * cols + c;
      const b = a + cols;
      const d = b + 1;
      const e = a + 1;
      indices.push(a, b, e);
      indices.push(b, d, e);
    }
  }

  // Optional bottom inner shadow cap so closed gowns have solid depth from low angles
  if (opts.closeBottomCap && gap === 0) {
    const centerIdx = positions.length / 3;
    positions.push(0, opts.botCy, opts.zBot + 0.0001);
    uvs.push(0.5, 0);
    colors.push(0.75, 0.75, 0.75);
    skinIndices.push(idxLL, idxLR, idxHips, idxHips);
    skinWeights.push(0.5, 0.5, 0, 0);
    const botRingStart = rings * cols;
    for (let c = 0; c < radialSegs; c++) {
      indices.push(botRingStart + c, centerIdx, botRingStart + c + 1);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geom.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
  geom.setIndex(indices);
  geom.computeVertexNormals();

  const mat = makeClothMat(opts.colorHex, appearance, 0.86, 0.62, true, true);
  const mesh = new THREE.SkinnedMesh(geom, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.userData.sharedGlbGeom = false;
  mesh.userData.sharedGlbMat = false;

  if (legMesh.parent) {
    legMesh.parent.add(mesh);
  }
  mesh.bind(skeleton, legMesh.bindMatrix);
  return mesh;
}

export function createHumanoid3D(appearance: HumanoidAppearance): HumanoidRig {
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  if (appearance.contactShadowTex) {
    const ao = new THREE.Mesh(
      new THREE.PlaneGeometry(0.68, 0.68),
      new THREE.MeshBasicMaterial({
        map: appearance.contactShadowTex,
        transparent: true,
        depthWrite: false,
      })
    );
    ao.rotation.x = -Math.PI / 2;
    ao.position.y = 0.072;
    root.add(ao);
  }

  const selectRing = new THREE.Mesh(
    new THREE.RingGeometry(0.25, 0.32, 24),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    })
  );
  selectRing.rotation.x = -Math.PI / 2;
  selectRing.position.y = 0.076;
  selectRing.visible = false;
  root.add(selectRing);

  const hitMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.3, 1.15, 10),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  );
  hitMesh.position.y = 0.58;
  root.add(hitMesh);

  const outfitStyle = resolveOutfitStyle(appearance);
  const skinCol = resolveRichSkinColor(appearance.skinTone, appearance.variantSeed || 0);
  const darkerSkinCol = skinCol.clone().multiplyScalar(0.76);
  const hairCol = new THREE.Color(appearance.hairColor || '#17100c');
  const shirtCol = new THREE.Color(appearance.shirtColor || '#ece9e1');
  const pantsCol = new THREE.Color(appearance.pantsColor || '#1e293b');
  const shirtLum = 0.2126 * shirtCol.r + 0.7152 * shirtCol.g + 0.0722 * shirtCol.b;
  const seedIdx = Math.abs(appearance.variantSeed || 0);
  const contrastInnerHex =
    shirtLum >= 0.42
      ? (seedIdx % 2 === 0 ? 0x1e3a5f : 0x334155)
      : 0xf8fafc;
  const tiePalette = [0x9f1239, 0x1d4ed8, 0x047857, 0xb45309, 0x1e293b, 0x6d28d9];
  const rawTieHex = tiePalette[seedIdx % tiePalette.length];
  const tieColObj = new THREE.Color(rawTieHex);
  const tieColorHex =
    Math.abs(tieColObj.r - shirtCol.r) +
      Math.abs(tieColObj.g - shirtCol.g) +
      Math.abs(tieColObj.b - shirtCol.b) <
    0.35
      ? tiePalette[(seedIdx + 1) % tiePalette.length]
      : rawTieHex;
  const shoePalette = [0x1e1b18, 0x3a2618, 0x1e293b, 0x27272a];
  const shoeLeatherHex = shoePalette[seedIdx % shoePalette.length];
  const isFemaleLook = Boolean(
    appearance.isFemale ||
      appearance.hasHijab ||
      outfitStyle === 'abaya' ||
      outfitStyle === 'abaya_open' ||
      outfitStyle === 'dress' ||
      appearance.isStaff
  );
  const tarhaCol =
    appearance.role === 'therapist'
      ? new THREE.Color('#e2e8f0')
      : appearance.role === 'receptionist'
        ? new THREE.Color('#cbd5e1')
        : outfitStyle === 'abaya'
          ? shirtCol.clone().offsetHSL(0, -0.05, 0.14)
          : outfitStyle === 'abaya_open'
            ? pantsCol.clone().offsetHSL(0, -0.04, 0.04)
            : shirtCol.clone().offsetHSL(0, -0.06, 0.08);
  const tarhaUnderCapCol = tarhaCol.clone().multiplyScalar(0.78);

  const targetH = 1.34 * (appearance.heightScale || 1);
  const glbKey = pickGlbKey(appearance);
  const skinnedModel = glbRegistry.cloneSkinned(glbKey, targetH);
  if (skinnedModel) {
    bodyPivot.add(skinnedModel);

    let legSkinnedMesh: THREE.SkinnedMesh | null = null;
    const isTherapist = Boolean(appearance.isStaff && appearance.role === 'therapist');
    const hideSuitLegs =
      !isTherapist &&
      (outfitStyle === 'abaya' || outfitStyle === 'dress' || outfitStyle === 'jalabiya');

    skinnedModel.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        const meshName = mesh.name || '';
        if (meshName === 'Suit_Legs' && (mesh as THREE.SkinnedMesh).isSkinnedMesh) {
          legSkinnedMesh = mesh as THREE.SkinnedMesh;
          if (hideSuitLegs) {
            mesh.visible = false;
          }
        }

        const origMats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const clonedMats = origMats.map((m) => {
          const orig = m as THREE.MeshStandardMaterial;
          const mName = orig.name || '';
          let targetHex = orig.color ? orig.color.getHex() : 0xcbd5e1;
          let mat: THREE.MeshStandardMaterial;

          if (mName === 'Skin') {
            if (meshName.includes('Feet') && isFemaleLook) {
              mat = makeLeatherMat(0x1f1916, appearance, 0.62);
            } else {
              mat = makeSkinMat(skinCol.getHex(), appearance, 0.62);
            }
          } else if (mName === 'Skin_Darker') {
            mat = makeSkinMat(darkerSkinCol.getHex(), appearance, 0.66);
          } else if (
            mName === 'Hair' ||
            mName === 'Hair_Blond' ||
            mName === 'Hair_Brown' ||
            mName === 'Eyebrows'
          ) {
            if (isFemaleLook && appearance.hasHijab && mName === 'Hair_Blond') {
              mat = makeClothMat(tarhaUnderCapCol.getHex(), appearance, 0.86, 0.45);
            } else {
              mat = new THREE.MeshPhysicalMaterial({
                color: hairCol.getHex(),
                roughness: 0.78,
                metalness: 0.02,
                sheen: 0.28,
                sheenRoughness: 0.45,
                sheenColor: new THREE.Color(0x6b5344),
                envMapIntensity: 0.45,
              });
            }
          } else if (isTherapist) {
            if (mName === 'Black' && meshName === 'Suit_Body') {
              mat = makeClothMat(0xedf2f7, appearance, 0.72, 0.38);
            } else if (mName === 'White' && meshName === 'Suit_Body') {
              mat = makeClothMat(0x0284c7, appearance, 0.78, 0.48);
            } else if (mName === 'Black' && meshName === 'Suit_Legs') {
              mat = makeClothMat(0x0f3a5c, appearance, 0.82, 0.42);
            } else if (meshName === 'Suit_Feet') {
              mat = makeLeatherMat(0x1e293b, appearance, 0.48);
            } else {
              mat = makeClothMat(targetHex, appearance, orig.roughness ?? 0.75, 0.35);
            }
          } else if (outfitStyle === 'jalabiya') {
            if (mName === 'Suit' || mName === 'White' || mName === 'Tie') {
              mat = makeClothMat(shirtCol.getHex(), appearance, 0.84, 0.52);
            } else if (mName === 'Black') {
              mat = makeLeatherMat(0x3a2618, appearance, 0.48);
            } else {
              mat = makeClothMat(targetHex, appearance, orig.roughness ?? 0.78, 0.35);
            }
          } else if (outfitStyle === 'abaya') {
            if ((mName === 'Black' || mName === 'White') && meshName === 'Suit_Body') {
              mat = makeClothMat(shirtCol.getHex(), appearance, 0.86, 0.62);
            } else if (meshName === 'Suit_Feet') {
              mat = makeLeatherMat(0x181615, appearance, 0.52);
            } else {
              mat = makeClothMat(targetHex, appearance, orig.roughness ?? 0.82, 0.4);
            }
          } else if (outfitStyle === 'abaya_open') {
            if (mName === 'Black' && meshName === 'Suit_Body') {
              mat = makeClothMat(shirtCol.getHex(), appearance, 0.86, 0.6);
            } else if (
              (mName === 'White' && meshName === 'Suit_Body') ||
              (mName === 'Black' && meshName === 'Suit_Legs')
            ) {
              mat = makeClothMat(pantsCol.getHex(), appearance, 0.82, 0.5);
            } else if (meshName === 'Suit_Feet') {
              mat = makeLeatherMat(0x1f1916, appearance, 0.5);
            } else {
              mat = makeClothMat(targetHex, appearance, orig.roughness ?? 0.82, 0.4);
            }
          } else if (outfitStyle === 'dress') {
            if ((mName === 'Black' || mName === 'White') && meshName === 'Suit_Body') {
              mat = makeClothMat(shirtCol.getHex(), appearance, 0.82, 0.58);
            } else if (meshName === 'Suit_Feet') {
              mat = makeLeatherMat(0x27201c, appearance, 0.48);
            } else {
              mat = makeClothMat(targetHex, appearance, orig.roughness ?? 0.8, 0.4);
            }
          } else if (isFemaleLook) {
            if (mName === 'Black' && meshName === 'Suit_Body') {
              mat = makeClothMat(shirtCol.getHex(), appearance, 0.78, 0.48);
            } else if (mName === 'White' && meshName === 'Suit_Body') {
              mat = makeClothMat(contrastInnerHex, appearance, 0.78, 0.48);
            } else if (mName === 'Black' && meshName === 'Suit_Legs') {
              mat = makeClothMat(pantsCol.getHex(), appearance, 0.84, 0.36);
            } else if (meshName === 'Suit_Feet') {
              mat = makeLeatherMat(shoeLeatherHex, appearance, 0.48);
            } else {
              mat = makeClothMat(targetHex, appearance, orig.roughness ?? 0.8, 0.35);
            }
          } else {
            if (mName === 'LightBrown' || (mName === 'Suit' && meshName === 'Suit_Body')) {
              mat = makeClothMat(shirtCol.getHex(), appearance, 0.8, 0.45);
            } else if (mName === 'Tie') {
              mat = makeClothMat(tieColorHex, appearance, 0.74, 0.52);
            } else if (mName === 'White' && meshName === 'Suit_Body') {
              mat = makeClothMat(contrastInnerHex, appearance, 0.78, 0.45);
            } else if (mName === 'LightBlue' || (mName === 'Suit' && meshName === 'Suit_Legs')) {
              mat = makeClothMat(pantsCol.getHex(), appearance, 0.84, 0.34);
            } else if (mName === 'Red_Dark' || mName === 'Black') {
              mat = makeLeatherMat(shoeLeatherHex, appearance, 0.48);
            } else if (mName === 'Eye') {
              mat = new THREE.MeshPhysicalMaterial({
                color: targetHex,
                roughness: 0.14,
                metalness: 0.0,
                clearcoat: 0.85,
                clearcoatRoughness: 0.08,
                envMapIntensity: 0.65,
              });
            } else {
              mat = orig.clone();
            }
          }

          if (mName === 'Eye' && !(mat instanceof THREE.MeshPhysicalMaterial)) {
            mat = new THREE.MeshPhysicalMaterial({
              color: targetHex,
              roughness: 0.14,
              metalness: 0.0,
              clearcoat: 0.85,
              clearcoatRoughness: 0.08,
              envMapIntensity: 0.65,
            });
          }

          mat.name = mName;
          return mat;
        });

        mesh.userData.sharedGlbMat = false;
        mesh.material = clonedMats.length === 1 ? clonedMats[0] : clonedMats;
      }
    });

    // Build SkinnedMesh garments directly on the character's skeleton (zero leg/body clipping!)
    if (legSkinnedMesh && !isTherapist) {
      if (outfitStyle === 'abaya') {
        createSkinnedGarmentMesh(legSkinnedMesh, appearance, {
          colorHex: shirtCol.getHex(),
          zTop: 0.0124,
          zBot: 0.0012,
          topRx: 0.00156,
          topRy: 0.00126,
          midRx: 0.00208,
          midRy: 0.00150,
          botRx: 0.00258,
          botRy: 0.00172,
          topCy: -0.00072,
          botCy: -0.00058,
          closeBottomCap: true,
          accentHemHex: (appearance.variantSeed || 0) % 2 === 0 ? 0xc59b57 : undefined,
        });
      } else if (outfitStyle === 'abaya_open') {
        createSkinnedGarmentMesh(legSkinnedMesh, appearance, {
          colorHex: shirtCol.getHex(),
          zTop: 0.0124,
          zBot: 0.0013,
          topRx: 0.00166,
          topRy: 0.00134,
          midRx: 0.00222,
          midRy: 0.00158,
          botRx: 0.00270,
          botRy: 0.00180,
          topCy: -0.00070,
          botCy: -0.00056,
          openFrontGapRad: 0.28,
        });
      } else if (outfitStyle === 'dress') {
        createSkinnedGarmentMesh(legSkinnedMesh, appearance, {
          colorHex: shirtCol.getHex(),
          zTop: 0.0116,
          zBot: 0.0016,
          topRx: 0.00150,
          topRy: 0.00120,
          midRx: 0.00206,
          midRy: 0.00148,
          botRx: 0.00254,
          botRy: 0.00168,
          topCy: -0.00072,
          botCy: -0.00058,
          closeBottomCap: true,
        });
      } else if (outfitStyle === 'casual' && isFemaleLook) {
        // Neat modest hip-length tunic / blouse extension over full trousers
        createSkinnedGarmentMesh(legSkinnedMesh, appearance, {
          colorHex: shirtCol.getHex(),
          zTop: 0.0117,
          zBot: 0.0086,
          topRx: 0.00150,
          topRy: 0.00120,
          midRx: 0.00174,
          midRy: 0.00134,
          botRx: 0.00192,
          botRy: 0.00144,
          topCy: -0.00072,
          botCy: -0.00062,
        });
      } else if (outfitStyle === 'jalabiya') {
        createSkinnedGarmentMesh(legSkinnedMesh, appearance, {
          colorHex: shirtCol.getHex(),
          zTop: 0.0116,
          zBot: 0.0014,
          topRx: 0.00158,
          topRy: 0.00126,
          midRx: 0.00198,
          midRy: 0.00146,
          botRx: 0.00236,
          botRy: 0.00164,
          topCy: -0.00062,
          botCy: -0.00056,
          closeBottomCap: true,
          accentHemHex: 0xd6c7a8,
        });
      }
    }

    // Map bone names cleanly
    const canonicalBoneMap: Record<string, string> = {
      Hips: 'Hips',
      Torso: 'Torso',
      Chest: 'Chest',
      Neck: 'Neck',
      Head: 'Head',
      ShoulderL: 'ShoulderL',
      'Shoulder.L': 'ShoulderL',
      ShoulderR: 'ShoulderR',
      'Shoulder.R': 'ShoulderR',
      UpperArmL: 'UpperArmL',
      'UpperArm.L': 'UpperArmL',
      LowerArmL: 'LowerArmL',
      'LowerArm.L': 'LowerArmL',
      HandL: 'HandL',
      'Hand.L': 'HandL',
      WristL: 'HandL',
      'Wrist.L': 'HandL',
      UpperArmR: 'UpperArmR',
      'UpperArm.R': 'UpperArmR',
      LowerArmR: 'LowerArmR',
      'LowerArm.R': 'LowerArmR',
      HandR: 'HandR',
      'Hand.R': 'HandR',
      WristR: 'HandR',
      'Wrist.R': 'HandR',
      Index1R: 'Index1R',
      'Index1.R': 'Index1R',
      Index2R: 'Index2R',
      'Index2.R': 'Index2R',
      Middle1R: 'Middle1R',
      'Middle1.R': 'Middle1R',
      Middle2R: 'Middle2R',
      'Middle2.R': 'Middle2R',
      Ring1R: 'Ring1R',
      'Ring1.R': 'Ring1R',
      Ring2R: 'Ring2R',
      'Ring2.R': 'Ring2R',
      Pinky1R: 'Pinky1R',
      'Pinky1.R': 'Pinky1R',
      Pinky2R: 'Pinky2R',
      'Pinky2.R': 'Pinky2R',
      Thumb1R: 'Thumb1R',
      'Thumb1.R': 'Thumb1R',
      Thumb2R: 'Thumb2R',
      'Thumb2.R': 'Thumb2R',
      UpperLegL: 'UpperLegL',
      'UpperLeg.L': 'UpperLegL',
      LowerLegL: 'LowerLegL',
      'LowerLeg.L': 'LowerLegL',
      FootL: 'FootL',
      'Foot.L': 'FootL',
      UpperLegR: 'UpperLegR',
      'UpperLeg.R': 'UpperLegR',
      LowerLegR: 'LowerLegR',
      'LowerLeg.R': 'LowerLegR',
      FootR: 'FootR',
      'Foot.R': 'FootR',
    };
    skinnedModel.updateMatrixWorld(true);
    const bones: Record<string, SkinnedBoneRef> = {};
    skinnedModel.traverse((obj) => {
      const canonical = canonicalBoneMap[obj.name];
      if (canonical && !bones[canonical]) {
        const restWorldQ = new THREE.Quaternion();
        obj.getWorldQuaternion(restWorldQ);
        bones[canonical] = {
          bone: obj,
          restQuat: obj.quaternion.clone(),
          restWorldQ,
          invWorldQ: restWorldQ.clone().invert(),
        };
      }
    });

    // Subtle Chest Accents (Jalabiya collar/placket, Embroidered Abaya placket, Dress sash, Therapist Stethoscope & ID badge)
    if (bones['Chest']) {
      if (isTherapist) {
        const medAcc = new THREE.Group();
        medAcc.scale.setScalar(0.01);
        const tubeMat = makeLeatherMat(0x1e293b, appearance, 0.44);
        const chromeMat = makeMetalMat(0xdbe2ea, appearance, 0.22, 0.88);
        const badgeMat = colorMat(0xf8fafc, 0.35, 0.04);
        const lanyardBlue = colorMat(0x0284c7, 0.55, 0.05);

        // Stethoscope draped smoothly around the collar and down the chest coat
        const stethCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(-0.088, 0.025, 0.118),
          new THREE.Vector3(-0.072, 0.12, 0.085),
          new THREE.Vector3(-0.062, 0.165, -0.025),
          new THREE.Vector3(0, 0.175, -0.068),
          new THREE.Vector3(0.062, 0.165, -0.025),
          new THREE.Vector3(0.072, 0.115, 0.085),
          new THREE.Vector3(0.068, 0.01, 0.125),
        ]);
        const stethTube = new THREE.Mesh(
          new THREE.TubeGeometry(stethCurve, 32, 0.009, 12, false),
          tubeMat
        );
        const chestDiaphragm = new THREE.Mesh(
          new THREE.CylinderGeometry(0.024, 0.026, 0.014, 22),
          chromeMat
        );
        chestDiaphragm.rotation.x = Math.PI / 2;
        chestDiaphragm.position.set(0.068, 0.008, 0.132);
        const earTipL = new THREE.Mesh(new THREE.SphereGeometry(0.011, 12, 10), chromeMat);
        earTipL.position.set(-0.088, 0.025, 0.118);

        // Clinic ID Badge clipped on left coat lapel
        const badgeCard = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.062, 0.006), badgeMat);
        badgeCard.position.set(-0.078, 0.048, 0.125);
        const badgeStripe = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.014, 0.007), lanyardBlue);
        badgeStripe.position.set(-0.078, 0.072, 0.125);

        medAcc.add(stethTube, chestDiaphragm, earTipL, badgeCard, badgeStripe);
        bones['Chest'].bone.add(medAcc);
      } else if (!appearance.isStaff) {
        if (outfitStyle === 'jalabiya') {
          const collarGrp = new THREE.Group();
          collarGrp.scale.setScalar(0.01);
          const jMat = makeClothMat(shirtCol.getHex(), appearance, 0.84, 0.5);
          const trimMat = makeClothMat(0xd6c7a8, appearance, 0.65, 0.35);
          const bandCollar = new THREE.Mesh(
            new THREE.CylinderGeometry(0.084, 0.09, 0.055, 24),
            jMat
          );
          bandCollar.position.set(0, 0.145, 0.004);
          const placket = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.21, 0.022), trimMat);
          placket.position.set(0, 0.038, 0.122);
          collarGrp.add(bandCollar, placket);
          bones['Chest'].bone.add(collarGrp);
        } else if (outfitStyle === 'abaya' && (appearance.variantSeed || 0) % 2 === 0) {
          const abayaTrimGrp = new THREE.Group();
          abayaTrimGrp.scale.setScalar(0.01);
          const embMat = makeMetalMat(0xc59b57, appearance, 0.42, 0.55);
          const trimStrip = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.24, 0.018), embMat);
          trimStrip.position.set(0, 0.01, 0.124);
          abayaTrimGrp.add(trimStrip);
          bones['Chest'].bone.add(abayaTrimGrp);
        }
      }
    }

    // Subtle wristwatch on therapists and select adult patients
    if (bones['LowerArmL'] && (isTherapist || (!isFemaleLook && (Math.abs(appearance.variantSeed || 0) % 3 === 1)))) {
      const watchGrp = new THREE.Group();
      watchGrp.scale.setScalar(0.01);
      const strap = new THREE.Mesh(
        new THREE.TorusGeometry(0.036, 0.007, 12, 24),
        makeLeatherMat(isTherapist ? 0x1e293b : 0x3a2618, appearance, 0.44)
      );
      strap.rotation.x = Math.PI / 2;
      strap.position.set(0, 0.215, 0);
      const watchFace = new THREE.Mesh(
        new THREE.CylinderGeometry(0.016, 0.016, 0.008, 18),
        makeMetalMat(0xe2e8f0, appearance, 0.25, 0.85)
      );
      watchFace.rotation.x = Math.PI / 2;
      watchFace.position.set(0, 0.215, 0.038);
      watchGrp.add(strap, watchFace);
      bones['LowerArmL'].bone.add(watchGrp);
    }

    if (bones['Hips'] && outfitStyle === 'dress' && !appearance.isStaff) {
      const sashGrp = new THREE.Group();
      sashGrp.scale.setScalar(0.01);
      const sashCol = shirtCol.clone().offsetHSL(0, -0.1, -0.14);
      const sashMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.155, 0.158, 0.042, 28),
        makeClothMat(sashCol.getHex(), appearance, 0.72, 0.55)
      );
      sashMesh.scale.set(1.0, 1.0, 0.82);
      sashMesh.position.set(0, 0.14, 0.068);
      sashGrp.add(sashMesh);
      bones['Hips'].bone.add(sashGrp);
    }

    // Authentic Sudanese Headwear, Beards & Eyeglasses
    if (bones['Head']) {
      if (outfitStyle === 'jalabiya' && !isFemaleLook && !appearance.isStaff) {
        const headAcc = new THREE.Group();
        headAcc.scale.setScalar(0.01);
        const whiteCloth = makeClothMat(0xf4f2ec, appearance, 0.82, 0.45);

        if (appearance.hasTurban) {
          for (const [ty, rad, tubeR, tiltX, tiltY] of [
            [0.188, 0.128, 0.030, 0.08, 0.09],
            [0.214, 0.125, 0.029, -0.06, -0.08],
            [0.238, 0.121, 0.028, 0.06, 0.06],
            [0.260, 0.114, 0.026, -0.05, -0.05],
            [0.279, 0.102, 0.022, 0.03, 0.04],
          ] as Array<[number, number, number, number, number]>) {
            const wrap = new THREE.Mesh(new THREE.TorusGeometry(rad, tubeR, 18, 36), whiteCloth);
            wrap.rotation.x = Math.PI / 2 + tiltX;
            wrap.rotation.y = tiltY;
            wrap.position.set(0, ty, -0.006);
            wrap.castShadow = true;
            headAcc.add(wrap);
          }
          const crown = new THREE.Mesh(
            new THREE.SphereGeometry(0.118, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55),
            whiteCloth
          );
          crown.position.set(0, 0.242, -0.006);
          const emmaTail = new THREE.Mesh(
            new THREE.CylinderGeometry(0.026, 0.038, 0.13, 16),
            whiteCloth
          );
          emmaTail.position.set(-0.075, 0.125, -0.092);
          emmaTail.rotation.z = -0.18;
          emmaTail.rotation.x = 0.22;
          headAcc.add(crown, emmaTail);
        } else {
          const taqMat = makeClothMat(0xede9df, appearance, 0.82, 0.35);
          const brimStitchMat = makeClothMat(0xcabfa8, appearance, 0.78, 0.2);
          const capSide = new THREE.Mesh(
            new THREE.CylinderGeometry(0.118, 0.122, 0.062, 28),
            taqMat
          );
          capSide.position.set(0, 0.21, -0.006);
          const capRim = new THREE.Mesh(new THREE.TorusGeometry(0.121, 0.007, 12, 32), brimStitchMat);
          capRim.rotation.x = Math.PI / 2;
          capRim.position.set(0, 0.182, -0.006);
          const capTop = new THREE.Mesh(
            new THREE.SphereGeometry(0.118, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.5),
            taqMat
          );
          capTop.position.set(0, 0.24, -0.006);
          headAcc.add(capSide, capRim, capTop);
        }
        bones['Head'].bone.add(headAcc);
      } else if (isFemaleLook && (appearance.hasHijab || appearance.role === 'receptionist' || appearance.role === 'therapist')) {
        const tarhaMat = makeClothMat(tarhaCol.getHex(), appearance, 0.84, 0.62, true);
        const scarfGrp = new THREE.Group();
        scarfGrp.scale.setScalar(0.01);

        // Outer draped hood framing forehead and covering crown & back bun completely
        const hood = new THREE.Mesh(new THREE.SphereGeometry(0.126, 28, 20), tarhaMat);
        hood.scale.set(1.10, 1.22, 1.24);
        hood.position.set(0, 0.165, -0.022);
        hood.castShadow = true;

        // Draped brow/temple fold framing face cleanly
        const browFold = new THREE.Mesh(new THREE.TorusGeometry(0.118, 0.016, 14, 28, Math.PI * 1.15), tarhaMat);
        browFold.rotation.set(0.28, 0, -Math.PI * 0.075);
        browFold.position.set(0, 0.165, 0.018);

        // Soft neck & chin wrap
        const neckWrap = new THREE.Mesh(
          new THREE.CylinderGeometry(0.098, 0.146, 0.17, 26),
          tarhaMat
        );
        neckWrap.position.set(0, 0.010, -0.008);

        // Flowing rear Tarha tail down the back of shoulders
        const backTail = new THREE.Mesh(
          new THREE.CylinderGeometry(0.105, 0.142, 0.23, 20, 1, false, Math.PI * 0.55, Math.PI * 0.9),
          tarhaMat
        );
        backTail.position.set(0, -0.042, -0.032);
        scarfGrp.add(hood, browFold, neckWrap, backTail);
        bones['Head'].bone.add(scarfGrp);

        if (bones['Chest']) {
          const chestDrape = new THREE.Group();
          chestDrape.scale.setScalar(0.01);
          const shawl = new THREE.Mesh(
            new THREE.CylinderGeometry(0.136, 0.194, 0.22, 26),
            tarhaMat
          );
          shawl.scale.set(1.06, 1.0, 0.78);
          shawl.position.set(0, 0.056, 0.018);
          const shoulderThrow = new THREE.Mesh(
            new THREE.CylinderGeometry(0.045, 0.068, 0.24, 18),
            tarhaMat
          );
          shoulderThrow.position.set(-0.088, 0.04, 0.072);
          shoulderThrow.rotation.z = -0.22;
          chestDrape.add(shawl, shoulderThrow);
          bones['Chest'].bone.add(chestDrape);
        }
      }

      // Sculpted 3D beard for bearded adult men
      if (appearance.hasBeard && !isFemaleLook) {
        const beardGrp = new THREE.Group();
        beardGrp.scale.setScalar(0.01);
        const beardMat = new THREE.MeshPhysicalMaterial({
          color: hairCol.getHex(),
          roughness: 0.9,
          metalness: 0.0,
          sheen: 0.2,
          sheenRoughness: 0.7,
        });
        const chinBeard = new THREE.Mesh(new THREE.SphereGeometry(0.058, 18, 14), beardMat);
        chinBeard.scale.set(1.02, 0.92, 0.85);
        chinBeard.position.set(0, 0.056, 0.058);
        const jawBeard = new THREE.Mesh(
          new THREE.CylinderGeometry(0.084, 0.068, 0.052, 20, 1, false, -Math.PI * 0.42, Math.PI * 0.84),
          beardMat
        );
        jawBeard.position.set(0, 0.078, 0.025);
        beardGrp.add(chinBeard, jawBeard);
        bones['Head'].bone.add(beardGrp);
      }

      // Slim optical eyeglasses on ~25% of patients for crisp life-like variety
      if (!appearance.isStaff && Math.abs(appearance.variantSeed || 0) % 4 === 0) {
        const glassGrp = new THREE.Group();
        glassGrp.scale.setScalar(0.01);
        const frameMat = makeMetalMat(0x27272a, appearance, 0.3, 0.75);
        const lensMat = new THREE.MeshPhysicalMaterial({
          color: 0xe0f2fe,
          transparent: true,
          opacity: 0.28,
          roughness: 0.08,
          clearcoat: 1.0,
        });
        for (const side of [-1, 1]) {
          const rim = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.0032, 10, 24), frameMat);
          rim.position.set(side * 0.032, 0.132, 0.105);
          const lens = new THREE.Mesh(new THREE.CircleGeometry(0.021, 20), lensMat);
          lens.position.set(side * 0.032, 0.132, 0.105);
          const arm = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.004, 0.095), frameMat);
          arm.position.set(side * 0.056, 0.132, 0.058);
          glassGrp.add(rim, lens, arm);
        }
        const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.004, 0.004), frameMat);
        bridge.position.set(0, 0.134, 0.106);
        glassGrp.add(bridge);
        bones['Head'].bone.add(glassGrp);
      }
    }

    let handCup: THREE.Group | undefined;
    const cupAnchor = bones['HandR']?.bone || bones['LowerArmR']?.bone;
    if (cupAnchor) {
      handCup = new THREE.Group();
      handCup.scale.setScalar(0.01);
      const cupBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.036, 0.025, 0.085, 18),
        colorMat(0xf8fafc, 0.45, 0.02)
      );
      const cupRim = new THREE.Mesh(
        new THREE.TorusGeometry(0.036, 0.004, 10, 20),
        colorMat(0x0284c7, 0.35, 0.05)
      );
      cupRim.rotation.x = Math.PI / 2;
      cupRim.position.y = 0.042;
      const cupWater = new THREE.Mesh(
        new THREE.CylinderGeometry(0.032, 0.029, 0.016, 18),
        colorMat(0x38bdf8, 0.18, 0.05)
      );
      cupWater.position.y = 0.028;
      handCup.add(cupBody, cupRim, cupWater);
      if (bones['HandR']) {
        cupBody.position.set(0, 0.048, 0.018);
        cupRim.position.set(0, 0.09, 0.018);
        cupWater.position.set(0, 0.076, 0.018);
      } else {
        cupBody.position.set(0, 0.25, 0.018);
        cupRim.position.set(0, 0.292, 0.018);
        cupWater.position.set(0, 0.278, 0.018);
      }
      handCup.visible = false;
      cupAnchor.add(handCup);
    }

    let handFile: THREE.Group | undefined;
    const fileAnchor = bones['HandR']?.bone || bones['LowerArmR']?.bone;
    if (fileAnchor) {
      handFile = new THREE.Group();
      handFile.scale.setScalar(0.01);
      // Keep handFile at (0,0,0) in 100x bone space; position child fileGrip inside 0.01-scaled meter space
      const fileGrip = new THREE.Group();
      if (bones['HandR']) {
        fileGrip.position.set(0.004, 0.082, -0.022);
      } else {
        fileGrip.position.set(0.004, 0.285, -0.022);
      }
      fileGrip.rotation.set(Math.PI / 2, 0, 0);

      const folderCover = new THREE.Mesh(
        new THREE.BoxGeometry(0.21, 0.016, 0.27),
        colorMat(0x0284c7, 0.48, 0.04)
      );
      folderCover.position.set(0.055, 0, -0.035);
      const folderPages = new THREE.Mesh(
        new THREE.BoxGeometry(0.185, 0.01, 0.245),
        colorMat(0xf8fafc, 0.65, 0.0)
      );
      folderPages.position.set(0.061, 0.004, -0.027);
      const folderTab = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.018, 0.028),
        colorMat(0xf59e0b, 0.45, 0.02)
      );
      folderTab.position.set(0.12, 0.002, -0.175);
      fileGrip.add(folderCover, folderPages, folderTab);
      handFile.add(fileGrip);
      handFile.visible = false;
      fileAnchor.add(handFile);
    }

    const hScale = appearance.heightScale || 1;
    let measuredHipH = 0.63 * hScale;
    const hipBoneRef = bones['UpperLegL']?.bone || bones['UpperLegR']?.bone || bones['Hips']?.bone;
    if (hipBoneRef) {
      bodyPivot.updateMatrixWorld(true);
      const tmpHip = new THREE.Vector3();
      hipBoneRef.getWorldPosition(tmpHip);
      if (tmpHip.y > 0.25 && tmpHip.y < 1.15) {
        measuredHipH = tmpHip.y;
      }
    }

    return {
      root,
      bodyPivot,
      selectRing,
      hitMesh,
      handCup,
      handFile,
      isSkinnedGlb: true,
      hipHeight: measuredHipH,
      heightScale: hScale,
      bones,
    };
  }

  // Fallback anatomical procedural rig during the initial <200ms GLB preload
  const skinMat = makeSkinMat(skinCol.getHex(), appearance, 0.62);
  const hairMat = colorMat(appearance.hairColor, 0.84, 0.02);
  const shirtMat = makeClothMat(appearance.shirtColor, appearance, 0.8, 0.45);
  const isFullRobeFallback =
    outfitStyle === 'jalabiya' ||
    outfitStyle === 'abaya' ||
    outfitStyle === 'abaya_open' ||
    outfitStyle === 'dress';
  const pantsMat = makeClothMat(
    isFullRobeFallback ? appearance.shirtColor : appearance.pantsColor,
    appearance,
    0.82,
    0.35
  );
  const shoeMat = makeLeatherMat(appearance.isStaff ? 0xf8fafc : 0x1e293b, appearance, 0.48);
  const coatMat = makeClothMat(0xf1f5f9, appearance, 0.72, 0.38);

  const makeLeg = (xOffset: number) => {
    const legPivot = new THREE.Group();
    legPivot.position.set(xOffset, 0.44, 0);
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.048, 0.22, 16), pantsMat);
    thigh.position.y = -0.11;
    legPivot.add(thigh);
    const shinPivot = new THREE.Group();
    shinPivot.position.set(0, -0.22, 0);
    legPivot.add(shinPivot);
    const calf = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.038, 0.21, 16), pantsMat);
    calf.position.y = -0.1;
    shinPivot.add(calf);
    const shoe = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.07, 6, 12), shoeMat);
    shoe.rotation.x = Math.PI / 2;
    shoe.position.set(0, -0.205, 0.03);
    shinPivot.add(shoe);
    return { legPivot, shinPivot };
  };
  const leftL = makeLeg(-0.078);
  const rightL = makeLeg(0.078);
  bodyPivot.add(leftL.legPivot, rightL.legPivot);

  const torso = new THREE.Group();
  torso.position.set(0, 0.44, 0);
  bodyPivot.add(torso);
  const torsoProfile = [
    new THREE.Vector2(0.02, 0.0),
    new THREE.Vector2(0.115, 0.03),
    new THREE.Vector2(0.102, 0.14),
    new THREE.Vector2(0.132, 0.28),
    new THREE.Vector2(0.122, 0.34),
    new THREE.Vector2(0.052, 0.365),
  ];
  const torsoMesh = new THREE.Mesh(new THREE.LatheGeometry(torsoProfile, 20), shirtMat);
  torsoMesh.scale.set(1.08, 1.0, 0.72);
  torso.add(torsoMesh);

  let robePivot: THREE.Group | undefined;
  if (isFullRobeFallback) {
    robePivot = new THREE.Group();
    const robeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.128, 0.175, 0.38, 20), shirtMat);
    robeMesh.scale.set(1.06, 1, 0.8);
    robeMesh.position.y = -0.19;
    robePivot.add(robeMesh);
    torso.add(robePivot);
  }

  const makeArm = (xOffset: number) => {
    const armPivot = new THREE.Group();
    armPivot.position.set(xOffset, 0.31, 0);
    const sleeveMat = appearance.isStaff && appearance.role === 'therapist' ? coatMat : shirtMat;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.032, 0.26, 14), sleeveMat);
    arm.position.y = -0.13;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.034, 14, 10), skinMat);
    hand.position.y = -0.27;
    armPivot.add(arm, hand);
    return armPivot;
  };
  const leftArm = makeArm(-0.16);
  const rightArm = makeArm(0.16);
  const fallbackCup = new THREE.Group();
  const fbCupBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.034, 0.024, 0.08, 14),
    colorMat(0xf8fafc, 0.45, 0.02)
  );
  const fbCupWater = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.027, 0.014, 14),
    colorMat(0x38bdf8, 0.18, 0.05)
  );
  fbCupWater.position.y = 0.026;
  fallbackCup.add(fbCupBody, fbCupWater);
  fallbackCup.position.set(0, -0.27, 0.045);
  fallbackCup.visible = false;
  rightArm.add(fallbackCup);
  const fallbackFile = new THREE.Group();
  const fbFolder = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.016, 0.26),
    colorMat(0x0284c7, 0.5, 0.04)
  );
  const fbPages = new THREE.Mesh(
    new THREE.BoxGeometry(0.175, 0.009, 0.235),
    colorMat(0xf8fafc, 0.65, 0.0)
  );
  fbPages.position.set(0.005, 0.004, 0.008);
  fallbackFile.add(fbFolder, fbPages);
  fallbackFile.position.set(-0.01, -0.26, 0.045);
  fallbackFile.rotation.set(0.15, 0, 1.25);
  fallbackFile.visible = false;
  rightArm.add(fallbackFile);
  torso.add(leftArm, rightArm);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.365, 0);
  torso.add(headGroup);
  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.102, 20, 16), skinMat);
  cranium.position.y = 0.135;
  headGroup.add(cranium);
  if (appearance.hasHijab) {
    const hood = new THREE.Mesh(
      new THREE.SphereGeometry(0.114, 20, 16),
      colorMat(tarhaCol.getHex())
    );
    hood.position.set(0, 0.14, -0.014);
    headGroup.add(hood);
  } else if (appearance.hasTurban) {
    const emma = new THREE.Mesh(new THREE.CylinderGeometry(0.118, 0.112, 0.08, 20), colorMat(0xf4f2ec));
    emma.position.set(0, 0.215, 0);
    headGroup.add(emma);
  } else {
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.106, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.6),
      hairMat
    );
    hair.position.set(0, 0.142, -0.01);
    headGroup.add(hair);
  }

  bodyPivot.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  return {
    root,
    bodyPivot,
    selectRing,
    hitMesh,
    handCup: fallbackCup,
    handFile: fallbackFile,
    isSkinnedGlb: false,
    robePivot,
    torso,
    headGroup,
    leftArm,
    rightArm,
    leftLeg: leftL.legPivot,
    rightLeg: rightL.legPivot,
    leftShin: leftL.shinPivot,
    rightShin: rightL.shinPivot,
  };
}

const _charQuat = new THREE.Quaternion();
const _swingQuat = new THREE.Quaternion();
const _twistQuat = new THREE.Quaternion();
const _localDeltaQuat = new THREE.Quaternion();
const _axisX = new THREE.Vector3(1, 0, 0);
const _axisY = new THREE.Vector3(0, 1, 0);
const _axisZ = new THREE.Vector3(0, 0, 1);

function applyCharEuler(ref: SkinnedBoneRef | undefined, rx: number, ry: number, rz: number) {
  if (!ref) return;
  _euler.set(rx, ry, rz, 'XYZ');
  _charQuat.setFromEuler(_euler);
  _localDeltaQuat.copy(ref.invWorldQ).multiply(_charQuat).multiply(ref.restWorldQ);
  ref.bone.quaternion.copy(ref.restQuat).multiply(_localDeltaQuat);
}

/**
 * Lowers T-pose arm cleanly to the side of the torso (dropZ), swings forward/back (swingX),
 * and optionally adducts inward across chest/midline (adductY).
 */
function applyArmSagittal(
  ref: SkinnedBoneRef | undefined,
  dropZ: number,
  swingX: number,
  adductY = 0
) {
  if (!ref) return;
  _charQuat.setFromAxisAngle(_axisZ, dropZ);
  _swingQuat.setFromAxisAngle(_axisX, swingX);
  _swingQuat.multiply(_charQuat);
  if (Math.abs(adductY) > 1e-4) {
    _twistQuat.setFromAxisAngle(_axisY, adductY);
    _twistQuat.multiply(_swingQuat);
    _localDeltaQuat.copy(ref.invWorldQ).multiply(_twistQuat).multiply(ref.restWorldQ);
  } else {
    _localDeltaQuat.copy(ref.invWorldQ).multiply(_swingQuat).multiply(ref.restWorldQ);
  }
  ref.bone.quaternion.copy(ref.restQuat).multiply(_localDeltaQuat);
}

/** Flexes elbow purely forward along the bone's anatomical local hinge axis. */
function applyLocalElbowFlex(ref: SkinnedBoneRef | undefined, isLeft: boolean, flexRad: number) {
  if (!ref) return;
  _swingQuat.setFromAxisAngle(_axisZ, isLeft ? -flexRad : flexRad);
  ref.bone.quaternion.copy(ref.restQuat).multiply(_swingQuat);
}

const _handEuler = new THREE.Euler(0, 0, 0, 'YXZ');
function applyLocalHandPose(
  ref: SkinnedBoneRef | undefined,
  extX: number,
  pronY: number,
  latZ = 0
) {
  if (!ref) return;
  if (Math.abs(extX) < 1e-4 && Math.abs(pronY) < 1e-4 && Math.abs(latZ) < 1e-4) {
    ref.bone.quaternion.copy(ref.restQuat);
    return;
  }
  _handEuler.set(extX, pronY, latZ, 'YXZ');
  _swingQuat.setFromEuler(_handEuler);
  ref.bone.quaternion.copy(ref.restQuat).multiply(_swingQuat);
}

export function animateHumanoid3D(
  rig: HumanoidRig,
  opts: {
    pose: CharacterPose;
    walkPhase: number;
    isMoving: boolean;
    walkBlend?: number;
    sitBlend?: number;
    lieBlend?: number;
    doorPush?: number;
    seatHeight?: number;
    lyingHeight?: number;
    bedBodyZOffset?: number;
    tiltPitch?: number;
    facingRad: number;
    timeSec: number;
    isSelected: boolean;
    inTreatment?: boolean;
    activeGait?: boolean;
    isDrinking?: boolean;
    drinkStage?: 'none' | 'filling' | 'sipping' | 'returning';
    drinkElapsedMs?: number;
    holdingFile?: boolean;
    pickingFile?: boolean;
    pickElapsedMs?: number;
    placingFile?: boolean;
    placeElapsedMs?: number;
    actorSeed?: number;
    seatedActivity?: 'idle' | 'typing' | 'writing' | 'glance' | 'rest';
    stairClimb?: number;
  }
) {
  const {
    pose,
    walkPhase,
    isMoving,
    walkBlend,
    sitBlend,
    lieBlend,
    doorPush = 0,
    seatHeight = 0.375,
    lyingHeight = 0.51,
    bedBodyZOffset,
    tiltPitch = -Math.PI / 2,
    facingRad,
    timeSec,
    isSelected,
    inTreatment,
    activeGait,
    isDrinking,
    drinkStage = isDrinking ? 'sipping' : 'none',
    drinkElapsedMs,
    holdingFile = false,
    pickingFile = false,
    pickElapsedMs,
    placingFile = false,
    placeElapsedMs,
    actorSeed = 0,
    seatedActivity = 'idle',
    stairClimb = 0,
  } = opts;

  // Individualized phase & cadence so people never breathe, fidget, or glance in lockstep
  const seedMod = Math.abs(actorSeed) % 13;
  const t = timeSec + (actorSeed % 97) * 1.43;
  const breathFreq = 1.42 + seedMod * 0.045;
  const breathWave = Math.sin(t * breathFreq);

  rig.selectRing.visible = isSelected;
  if (isSelected) {
    const s = 1 + Math.sin(timeSec * 5) * 0.08;
    rig.selectRing.scale.set(s, s, 1);
  }

  const lie = THREE.MathUtils.clamp(lieBlend ?? (pose === 'lying' ? 1 : 0), 0, 1);
  const sit = THREE.MathUtils.clamp(sitBlend ?? (pose === 'seated' ? 1 : 0), 0, 1);
  const hScale = rig.heightScale ?? 1;

  const smoothstep01 = (v: number) => {
    const c = THREE.MathUtils.clamp(v, 0, 1);
    return c * c * (3 - 2 * c);
  };

  // Continuous water-drinking kinematic parameters (fills cup -> reaches & lifts smoothly to mouth -> 2 sips -> lowers -> returns cup)
  const activeDrink = !isMoving && sit < 0.2 && lie < 0.05 && drinkStage !== 'none';
  let drinkRaise = 0; // 0: dispenser reach/ready, 1: cup rim at mouth
  let drinkSipAmt = 0; // 0..1 gentle lip tilt during actual sips
  let drinkFillReach = 0; // reaching toward spout / return tray
  let drinkCupRx = 0;
  let drinkCupRz = 0.42;

  if (activeDrink) {
    if (drinkElapsedMs !== undefined) {
      if (drinkElapsedMs < 1450) {
        drinkFillReach = smoothstep01(drinkElapsedMs / 380);
        // At 1220..1450ms smoothly tuck hand in and grab cup off drip tray
        const grab = smoothstep01((drinkElapsedMs - 1220) / 230);
        drinkRaise = grab * 0.14;
        drinkCupRx = -0.35 * (1 - grab);
        drinkCupRz = THREE.MathUtils.lerp(0.18, 0.46, grab);
      } else if (drinkElapsedMs < 3450) {
        const u = THREE.MathUtils.clamp((drinkElapsedMs - 1450) / 2000, 0, 1);
        const liftUp = smoothstep01(u / 0.24);
        const lowerDown = u > 0.78 ? smoothstep01((u - 0.78) / 0.22) : 0;
        drinkRaise = liftUp * (1 - lowerDown);

        // Two unhurried, realistic sips at mouth level (first sip 0.24..0.48, pause, second sip 0.54..0.78)
        const sip1 = u >= 0.24 && u <= 0.48 ? Math.sin(((u - 0.24) / 0.24) * Math.PI) : 0;
        const sip2 = u >= 0.54 && u <= 0.78 ? Math.sin(((u - 0.54) / 0.24) * Math.PI) : 0;
        drinkSipAmt = Math.max(sip1, sip2);

        // Keep cup rim upright while lifting, then tilt slightly toward mouth during sip
        drinkCupRx = THREE.MathUtils.lerp(0.0, -0.14 - drinkSipAmt * 0.24, drinkRaise);
        drinkCupRz = THREE.MathUtils.lerp(0.46, -0.22 - drinkSipAmt * 0.08, drinkRaise);
      } else {
        const retU = THREE.MathUtils.clamp((drinkElapsedMs - 3450) / 400, 0, 1);
        drinkFillReach = smoothstep01(retU < 0.7 ? retU / 0.7 : 1 - (retU - 0.7) / 0.3) * 0.85;
        drinkCupRx = -0.25 * drinkFillReach;
        drinkCupRz = 0.22;
      }
    } else if (drinkStage === 'filling') {
      drinkFillReach = 0.85;
    } else if (drinkStage === 'sipping') {
      const wave = 0.5 + 0.5 * Math.sin(timeSec * 3.8);
      drinkRaise = 0.92;
      drinkSipAmt = wave;
      drinkCupRx = -0.14 - wave * 0.24;
      drinkCupRz = -0.22;
    } else {
      drinkFillReach = 0.65;
    }
  }

  if (rig.handCup) {
    const showCup =
      activeDrink &&
      pose === 'standing' &&
      (drinkStage === 'sipping' ||
        (drinkStage === 'filling' && (drinkElapsedMs ?? 0) >= 1250) ||
        (drinkStage === 'returning' && (drinkElapsedMs ?? 3500) < 3720));
    rig.handCup.visible = showCup;
    if (showCup) {
      rig.handCup.rotation.set(drinkCupRx, 0, drinkCupRz);
    }
  }

  const activePickFile = pickingFile && !activeDrink && sit < 0.25 && lie < 0.05;
  const pickMs = pickElapsedMs ?? ((timeSec * 1000) % 1450);
  const pickReach = activePickFile ? smoothstep01(pickMs / 500) : 0;
  const pickGrasp = activePickFile && pickMs >= 550 ? smoothstep01((pickMs - 550) / 820) : 0;

  const activePlaceFile = placingFile && !activeDrink && sit < 0.25 && lie < 0.05;
  const placeMs = placeElapsedMs ?? 0;
  const placeReach = activePlaceFile
    ? placeMs < 520
      ? smoothstep01(placeMs / 470)
      : 1 - smoothstep01((placeMs - 520) / 380)
    : 0;
  const placeReleased = activePlaceFile && placeMs >= 520;
  const placeFingerOpen = activePlaceFile && placeMs >= 450 ? smoothstep01((placeMs - 450) / 140) : 0;

  if (rig.handFile) {
    const showFile =
      !activeDrink &&
      sit < 0.25 &&
      lie < 0.05 &&
      ((activePickFile && pickMs >= 550) ||
        (activePlaceFile && !placeReleased && holdingFile) ||
        (holdingFile && !activePickFile && !activePlaceFile));
    rig.handFile.visible = showFile;
  }

  if (rig.isSkinnedGlb && rig.bones) {
    const b = rig.bones;
    rig.root.rotation.y = facingRad;

    const isTilted = Math.abs(tiltPitch + Math.PI / 2) > 0.1;
    const lieBreath = breathWave * 0.5 + 0.5;
    const liePosZ = bedBodyZOffset ?? (isTilted ? 0.56 * hScale : 0.67 * hScale);
    const hipShift = isTilted ? 0 : Math.sin(t * 0.21) * 0.024;
    const lieHeadYaw = Math.sin(t * 0.28) * 0.17 + Math.sin(t * 0.13 + 0.9) * 0.075;
    const lieHeadPitch = 0.145 + Math.sin(t * 0.37) * 0.026 + lieBreath * 0.014;
    const lieHeadRoll = Math.sin(t * 0.23) * 0.042;
    const kneeRestBase = isTilted ? 0.03 : 0.11;
    const kneeRelaxL =
      kneeRestBase + (isTilted ? 0 : Math.pow(Math.max(0, Math.sin(t * 0.19)), 1.5) * 0.26);
    const kneeRelaxR =
      kneeRestBase + (isTilted ? 0 : Math.pow(Math.max(0, Math.sin(t * 0.19 + 2.55)), 1.5) * 0.24);
    const ankleL = Math.sin(t * 0.54) * 0.055;
    const ankleR = Math.sin(t * 0.47 + 1.4) * 0.055;
    const armRelaxL = Math.pow(Math.max(0, Math.sin(t * 0.23 + 0.6)), 1.4) * 0.22;
    const armRelaxR = Math.pow(Math.max(0, Math.cos(t * 0.21)), 1.4) * 0.24;

    // Fast path for full supine lying posture
    if (lie >= 0.999) {
      rig.bodyPivot.rotation.set(tiltPitch, 0, 0);
      rig.bodyPivot.position.set(0, lyingHeight, liePosZ);

      applyCharEuler(b['Hips'], 0, hipShift * 0.55, hipShift);
      applyCharEuler(b['Torso'], 0.018 + lieBreath * 0.022, Math.sin(t * 0.24) * 0.022, -hipShift * 0.5);
      applyCharEuler(b['Chest'], 0.015 + lieBreath * 0.03, Math.sin(t * 0.26) * 0.018, 0);
      applyCharEuler(b['ShoulderL'], 0, 0, -0.045 - lieBreath * 0.015);
      applyCharEuler(b['ShoulderR'], 0, 0, 0.045 + lieBreath * 0.015);

      applyCharEuler(
        b['UpperLegL'],
        -0.04 - kneeRelaxL * 0.62,
        0.065 + Math.sin(t * 0.17) * 0.028,
        0.042
      );
      applyCharEuler(
        b['UpperLegR'],
        -0.04 - kneeRelaxR * 0.62,
        -0.065 - Math.cos(t * 0.16) * 0.028,
        -0.042
      );
      applyCharEuler(b['LowerLegL'], (isTilted ? 0.06 : 0.12) + kneeRelaxL * 1.15, 0, 0);
      applyCharEuler(b['LowerLegR'], (isTilted ? 0.06 : 0.12) + kneeRelaxR * 1.15, 0, 0);
      applyCharEuler(b['FootL'], (isTilted ? 0.05 : 0.14) + ankleL, 0.035, 0);
      applyCharEuler(b['FootR'], (isTilted ? 0.05 : 0.14) + ankleR, -0.035, 0);

      applyArmSagittal(b['UpperArmL'], -1.41, -0.06 + Math.sin(t * 0.31) * 0.035 - armRelaxL * 0.16);
      applyArmSagittal(b['UpperArmR'], 1.41, -0.075 + Math.cos(t * 0.28) * 0.035 - armRelaxR * 0.16);
      applyLocalElbowFlex(b['LowerArmL'], true, 0.26 + armRelaxL);
      applyLocalElbowFlex(b['LowerArmR'], false, 0.28 + armRelaxR);

      applyCharEuler(b['Neck'], 0.045, lieHeadYaw * 0.4, lieHeadRoll * 0.35);
      applyCharEuler(b['Head'], lieHeadPitch, lieHeadYaw * 0.72, lieHeadRoll);
      return;
    }

    const gaitActive = Boolean(activeGait ?? inTreatment) && pose !== 'seated' && lie < 0.05;
    const activeBlend = (gaitActive ? 1 : walkBlend ?? (isMoving ? 1 : 0)) * (1 - sit) * (1 - lie);
    const pushAmt = THREE.MathUtils.clamp(doorPush, 0, 1) * (1 - sit) * (1 - lie);
    const breath = breathWave * 0.015;
    const standIdleAmt = (1 - activeBlend) * (1 - sit) * (1 - pushAmt) * (1 - lie);

    // Organic multi-frequency standing weight shift & subtle opposite-knee soften
    const standWeight =
      (Math.sin(t * 0.42) * 0.65 + Math.sin(t * 0.19 + 1.2) * 0.35) * standIdleAmt;

    // Exact hip-joint world alignment: itemBase(0.08) + seatHeight + seatedThighPad(0.068*hScale) - rootY(0.02) - hipHeight
    const hipH = rig.hipHeight ?? 0.63 * hScale;
    const sitHipY = THREE.MathUtils.clamp(0.06 + seatHeight + 0.068 * hScale - hipH, -0.52, 0.25);

    const phase = gaitActive ? timeSec * 4.2 : walkPhase;
    const sinP = Math.sin(phase);
    const stride = sinP + 0.075 * Math.sin(phase * 2);
    const armStride = Math.sin(phase - 0.16);
    const cosP = Math.cos(phase);
    const cos2 = Math.cos(phase * 2);
    const climbAmt = THREE.MathUtils.clamp(stairClimb, 0, 1) * activeBlend;
    const descAmt = THREE.MathUtils.clamp(-stairClimb, 0, 1) * activeBlend;
    const stairEffort = Math.max(climbAmt, descAmt);

    // Smooth human double-peaked COM vertical trajectory & subtle lateral stance transfer
    const standY =
      0.042 +
      (-cos2 * 0.015 - 0.008) * activeBlend +
      0.024 * Math.abs(sinP) * climbAmt -
      0.014 * descAmt -
      Math.abs(standWeight) * 0.007;
    const standX = -cosP * 0.016 * activeBlend + standWeight * 0.036;

    const basePosX = standX;
    const basePosY = THREE.MathUtils.lerp(standY, sitHipY, sit);
    const basePosZ = THREE.MathUtils.lerp(0, -0.012, sit);

    // Anchor the hip joint (0, hipH, 0) along a physically grounded trajectory instead of linearly
    // lerping foot-origin bodyPivot across a 90deg rotation (which otherwise balloons hips +14cm mid-air).
    const theta = THREE.MathUtils.lerp(0, tiltPitch, lie);
    const hipStartY = basePosY + hipH;
    const hipStartZ = basePosZ;
    const hipEndY = lyingHeight + hipH * Math.cos(tiltPitch);
    const hipEndZ = liePosZ + hipH * Math.sin(tiltPitch);
    const hipShiftArc = Math.sin(lie * Math.PI) * 0.012;
    const hipTargetY = THREE.MathUtils.lerp(hipStartY, hipEndY, lie) + hipShiftArc;
    const hipTargetZ = THREE.MathUtils.lerp(hipStartZ, hipEndZ, lie);

    rig.bodyPivot.rotation.set(theta, 0, 0);
    rig.bodyPivot.position.set(
      THREE.MathUtils.lerp(basePosX, 0, lie),
      hipTargetY - hipH * Math.cos(theta),
      hipTargetZ - hipH * Math.sin(theta)
    );

    const walkHipY = -stride * 0.074 * activeBlend + standWeight * 0.038;
    const walkHipZ = stride * 0.034 * activeBlend + standWeight * 0.055;
    const sitHipSway = Math.sin(t * 0.33) * 0.014 * (seatedActivity === 'idle' ? 1 : 0.4);
    const baseHipY = walkHipY * (1 - sit);
    const baseHipZ = walkHipZ * (1 - sit) + sitHipSway * sit;
    applyCharEuler(
      b['Hips'],
      0,
      THREE.MathUtils.lerp(baseHipY, hipShift * 0.55, lie),
      THREE.MathUtils.lerp(baseHipZ, hipShift, lie)
    );

    // Seated torso, arms & head targets based on natural activity
    let sitTorsoX = -0.068 + Math.sin(t * 0.24) * 0.026 + breath * 0.4;
    let sitTorsoY = Math.sin(t * 0.36) * 0.038;
    let sitTorsoZ = Math.sin(t * 0.29) * 0.018;
    let sitChestX = -0.035 + breath * 0.85;
    let sitArmLSwing = -0.12 + Math.sin(t * 0.37) * 0.035;
    let sitArmRSwing = -0.12 + Math.cos(t * 0.33) * 0.035;
    let sitElbowLFlex = 0.56 + Math.sin(t * 0.41) * 0.045;
    let sitElbowRFlex = 0.56 + Math.cos(t * 0.39) * 0.045;
    let sitLookYaw = Math.sin(t * 0.44) * 0.2 + Math.sin(t * 0.17 + 0.8) * 0.1;
    let sitLookPitch = Math.sin(t * 0.61) * 0.04 + Math.sin(t * 0.23) * 0.025;

    if (seatedActivity === 'typing') {
      sitTorsoX = 0.085 + breath * 0.35;
      sitTorsoY = Math.sin(t * 0.7) * 0.022;
      sitTorsoZ = Math.sin(t * 0.45) * 0.012;
      sitChestX = 0.045 + breath * 0.7;
      sitArmLSwing = -0.37 + Math.sin(timeSec * 3.8) * 0.02;
      sitArmRSwing = -0.37 + Math.cos(timeSec * 4.1) * 0.02;
      sitElbowLFlex = 1.02 + Math.sin(timeSec * 13.5) * 0.048;
      sitElbowRFlex = 1.02 + Math.cos(timeSec * 15.2) * 0.048;
      sitLookYaw = Math.sin(t * 0.9) * 0.075;
      sitLookPitch = 0.075 + Math.sin(t * 1.55) * 0.022;
    } else if (seatedActivity === 'writing') {
      sitTorsoX = 0.115 + breath * 0.3;
      sitTorsoY = -0.055 + Math.sin(timeSec * 1.9) * 0.012;
      sitTorsoZ = -0.018;
      sitChestX = 0.055 + breath * 0.6;
      sitArmLSwing = -0.31 + Math.sin(t * 0.9) * 0.015;
      sitArmRSwing = -0.43 + Math.sin(timeSec * 4.8) * 0.036;
      sitElbowLFlex = 0.92;
      sitElbowRFlex = 1.0 + Math.cos(timeSec * 6.4) * 0.052;
      sitLookYaw = -0.095 + Math.sin(timeSec * 2.3) * 0.032;
      sitLookPitch = 0.19 + Math.sin(t * 1.6) * 0.022;
    } else if (seatedActivity === 'glance') {
      sitTorsoX = -0.01 + breath * 0.4;
      sitTorsoY = Math.sin(t * 0.8) * 0.055;
      sitTorsoZ = Math.sin(t * 0.42) * 0.018;
      sitChestX = 0.01 + breath * 0.8;
      sitArmLSwing = -0.2 + Math.sin(t * 0.65) * 0.03;
      sitArmRSwing = -0.25 + Math.cos(t * 0.72) * 0.045;
      sitElbowLFlex = 0.78;
      sitElbowRFlex = 0.84 + Math.sin(t * 1.05) * 0.06;
      sitLookYaw = Math.sin(t * 0.95) * 0.26;
      sitLookPitch = -0.03 + Math.sin(t * 0.68) * 0.038;
    } else if (seatedActivity === 'rest') {
      sitTorsoX = -0.085 + breath * 0.5;
      sitTorsoY = Math.sin(t * 0.35) * 0.036;
      sitTorsoZ = Math.sin(t * 0.28) * 0.022;
      sitChestX = -0.04 + breath;
      sitArmLSwing = -0.1 + Math.sin(t * 0.45) * 0.025;
      sitArmRSwing = -0.1 + Math.cos(t * 0.41) * 0.025;
      sitElbowLFlex = 0.54;
      sitElbowRFlex = 0.54 + Math.sin(t * 0.5) * 0.04;
      sitLookYaw = Math.sin(t * 0.52) * 0.2;
      sitLookPitch = -0.02 + Math.sin(t * 0.4) * 0.032;
    } else if (!inTreatment && lie < 0.05) {
      // Waiting room / courtyard seated subtle hand adjustment
      const gestCycle = Math.sin(t * 0.39 + 0.5);
      const sitGest = Math.max(0, (gestCycle - 0.64) / 0.36);
      const smoothGest = sitGest * sitGest * (3 - 2 * sitGest);
      sitArmRSwing -= smoothGest * 0.22;
      sitElbowRFlex += smoothGest * 0.36;
    }

    const pickTorsoLean = activePickFile ? THREE.MathUtils.lerp(0.095, 0.025, pickGrasp) * pickReach : 0;
    const placeTorsoLean = activePlaceFile ? 0.23 * placeReach : 0;
    const torsoStandX =
      0.025 * activeBlend +
      0.13 * climbAmt -
      0.055 * descAmt -
      pushAmt * 0.065 +
      pickTorsoLean +
      placeTorsoLean +
      breath * 0.65;
    const torsoStandY =
      stride * 0.052 * activeBlend -
      pushAmt * 0.09 -
      standWeight * 0.05 +
      (activePickFile ? -0.05 * pickReach * (1 - pickGrasp * 0.7) : 0) +
      (activePlaceFile ? -0.1 * placeReach : 0);
    const torsoStandZ = -stride * 0.018 * activeBlend - standWeight * 0.042;
    const baseTorsoX = THREE.MathUtils.lerp(torsoStandX, sitTorsoX, sit);
    const baseTorsoY = THREE.MathUtils.lerp(torsoStandY, sitTorsoY, sit);
    const baseTorsoZ = THREE.MathUtils.lerp(torsoStandZ, sitTorsoZ, sit);
    applyCharEuler(
      b['Torso'],
      THREE.MathUtils.lerp(baseTorsoX, 0.018 + lieBreath * 0.022, lie),
      THREE.MathUtils.lerp(baseTorsoY, Math.sin(t * 0.24) * 0.022, lie),
      THREE.MathUtils.lerp(baseTorsoZ, -hipShift * 0.5, lie)
    );

    const baseChestX = THREE.MathUtils.lerp(
      0.018 * activeBlend +
        0.05 * climbAmt -
        0.02 * descAmt -
        pushAmt * 0.04 +
        pickTorsoLean * 0.6 +
        placeTorsoLean * 0.45 +
        breath,
      sitChestX,
      sit
    );
    const baseChestY = THREE.MathUtils.lerp(
      stride * 0.068 * activeBlend - pushAmt * 0.08 - standWeight * 0.03 + (activePlaceFile ? -0.06 * placeReach : 0),
      sitTorsoY * 0.45,
      sit
    );
    const baseChestZ = THREE.MathUtils.lerp(-stride * 0.022 * activeBlend - standWeight * 0.025, -sitTorsoZ * 0.3, sit);
    applyCharEuler(
      b['Chest'],
      THREE.MathUtils.lerp(baseChestX, 0.015 + lieBreath * 0.03, lie),
      THREE.MathUtils.lerp(baseChestY, Math.sin(t * 0.26) * 0.018, lie),
      THREE.MathUtils.lerp(baseChestZ, 0, lie)
    );

    const restShrug = seatedActivity === 'rest' ? Math.sin(t * 1.1) * 0.022 * sit * (1 - lie) : 0;
    const baseShoulderLY = -stride * 0.05 * activeBlend * (1 - sit);
    const baseShoulderRY =
      activeDrink
        ? THREE.MathUtils.lerp(0.16 * drinkFillReach, 0.28 + drinkSipAmt * 0.03, drinkRaise)
        : activePickFile
          ? THREE.MathUtils.lerp(0.24, 0.12, pickGrasp) * pickReach
          : activePlaceFile
            ? 0.18 * placeReach
            : (-stride * 0.05 * activeBlend - pushAmt * 0.12) * (1 - sit);
    applyCharEuler(
      b['ShoulderL'],
      0,
      THREE.MathUtils.lerp(baseShoulderLY, 0, lie),
      THREE.MathUtils.lerp(-0.04 - restShrug, -0.045 - lieBreath * 0.015, lie)
    );
    applyCharEuler(
      b['ShoulderR'],
      0,
      THREE.MathUtils.lerp(baseShoulderRY, 0, lie),
      THREE.MathUtils.lerp(
        activeDrink || activePickFile || activePlaceFile ? -0.04 : 0.04 + restShrug,
        0.045 + lieBreath * 0.015,
        lie
      )
    );

    // Legs transition seamlessly between gait, stance, grounded chair sit (or low floor mat sit), and relaxed lying
    const pedal = sit > 0.7 && inTreatment && lie < 0.05 ? Math.sin(timeSec * 5.2) * 0.32 : 0;
    const sitLegFidget =
      sit > 0.7 && !inTreatment && seatedActivity === 'idle' && lie < 0.05
        ? Math.sin(t * 0.31) * 0.032
        : 0;
    const toeTapMask =
      sit > 0.7 && !inTreatment && seatedActivity === 'idle' && lie < 0.05
        ? Math.max(0, (Math.sin(t * 0.17 + 1.1) - 0.58) / 0.42)
        : 0;
    const toeTap = Math.sin(t * 3.1) * toeTapMask * 0.09;

    // Low floor mat (seatHeight < 0.24) tucks knees softly forward instead of pushing shins into floor
    const lowMatFactor = THREE.MathUtils.clamp((0.24 - seatHeight) / 0.18, 0, 1);
    const sitThighAngle = THREE.MathUtils.lerp(-1.3, -1.5, lowMatFactor);
    const sitKneeAngle = THREE.MathUtils.lerp(1.34, 0.62, lowMatFactor);
    const sitFootAngle = THREE.MathUtils.lerp(0.06, 0.28, lowMatFactor);

    const swing = stride * 0.35 * activeBlend * (1 - 0.22 * descAmt);
    const stairThighLiftL = Math.max(0, cosP) * 0.34 * climbAmt + Math.max(0, sinP) * 0.14 * climbAmt;
    const stairThighLiftR = Math.max(0, -cosP) * 0.34 * climbAmt + Math.max(0, -sinP) * 0.14 * climbAmt;
    const stairKneeL =
      Math.max(0, cosP) * 0.42 * climbAmt + (0.24 + Math.max(0, -cosP) * 0.16) * descAmt;
    const stairKneeR =
      Math.max(0, -cosP) * 0.42 * climbAmt + (0.24 + Math.max(0, cosP) * 0.16) * descAmt;
    const stairFootL = -Math.max(0, cosP) * 0.16 * climbAmt + 0.14 * descAmt;
    const stairFootR = -Math.max(0, -cosP) * 0.16 * climbAmt + 0.14 * descAmt;

    // Anatomical human gait knee flexion:
    // 1) Swing-phase clearance peaks during mid-swing (cosP > 0 for L, cosP < 0 for R)
    // 2) Gentle loading-response knee yield cushions early stance after heel strike
    const swingClearL = Math.pow(Math.max(0, cosP), 0.9) * 0.70;
    const loadYieldL = Math.max(0, sinP) * Math.max(0, -cosP) * 0.28;
    const swingClearR = Math.pow(Math.max(0, -cosP), 0.9) * 0.70;
    const loadYieldR = Math.max(0, -sinP) * Math.max(0, cosP) * 0.28;

    const idleKneeL = Math.max(0, -standWeight) * 0.13 + 0.04 * standIdleAmt;
    const idleKneeR = Math.max(0, standWeight) * 0.13 + 0.04 * standIdleAmt;
    const standKneeL =
      0.04 +
      idleKneeL +
      (swingClearL + loadYieldL) * activeBlend +
      stairKneeL;
    const standKneeR =
      0.04 +
      idleKneeR +
      (swingClearR + loadYieldR) * activeBlend +
      stairKneeR;

    // During reclining (lie 0->1), swing knees slightly upward and extend shins ahead of full recline
    // so heels sweep smoothly onto the mattress without stabbing downward through it.
    const shinFrac = THREE.MathUtils.clamp((lie - 0.1) / 0.72, 0, 1);
    const shinBlend = shinFrac * shinFrac * (3 - 2 * shinFrac);
    const legSwingLift = Math.sin(lie * Math.PI) * (isTilted ? 0.08 : 0.16);
    const ankleLift = Math.sin(lie * Math.PI) * 0.1;

    const baseULX = THREE.MathUtils.lerp(
      -swing - stairThighLiftL - idleKneeL * 0.45,
      sitThighAngle - pedal,
      sit
    );
    const baseULY = THREE.MathUtils.lerp(0.025 * (1 - activeBlend), 0.05 + sitLegFidget * 0.35, sit);
    const baseULZ = THREE.MathUtils.lerp(0.018 + standWeight * 0.03, 0.038, sit);
    applyCharEuler(
      b['UpperLegL'],
      THREE.MathUtils.lerp(baseULX, -0.04 - kneeRelaxL * 0.62, lie) - legSwingLift,
      THREE.MathUtils.lerp(baseULY, 0.065 + Math.sin(t * 0.17) * 0.028, lie),
      THREE.MathUtils.lerp(baseULZ, 0.042, lie)
    );

    const baseURX = THREE.MathUtils.lerp(
      swing - stairThighLiftR - idleKneeR * 0.45,
      sitThighAngle + pedal,
      sit
    );
    const baseURY = THREE.MathUtils.lerp(-0.025 * (1 - activeBlend), -0.05 - sitLegFidget * 0.35, sit);
    const baseURZ = THREE.MathUtils.lerp(-0.018 + standWeight * 0.03, -0.038, sit);
    applyCharEuler(
      b['UpperLegR'],
      THREE.MathUtils.lerp(baseURX, -0.04 - kneeRelaxR * 0.62, lie) - legSwingLift,
      THREE.MathUtils.lerp(baseURY, -0.065 - Math.cos(t * 0.16) * 0.028, lie),
      THREE.MathUtils.lerp(baseURZ, -0.042, lie)
    );

    const baseLLX = THREE.MathUtils.lerp(standKneeL, sitKneeAngle + pedal * 0.65 + sitLegFidget, sit);
    const baseLRX = THREE.MathUtils.lerp(standKneeR, sitKneeAngle - pedal * 0.65 - sitLegFidget, sit);
    applyCharEuler(
      b['LowerLegL'],
      THREE.MathUtils.lerp(baseLLX, (isTilted ? 0.06 : 0.12) + kneeRelaxL * 1.15, shinBlend),
      0,
      0
    );
    applyCharEuler(
      b['LowerLegR'],
      THREE.MathUtils.lerp(baseLRX, (isTilted ? 0.06 : 0.12) + kneeRelaxR * 1.15, shinBlend),
      0,
      0
    );

    // Ankle dorsiflexion during swing & heel-strike (-), plantarflexion push-off at terminal stance (+)
    const ankleSwingL =
      (-Math.max(0, cosP) * 0.14 - Math.max(0, sinP) * 0.08 + Math.max(0, -sinP) * 0.18) *
      activeBlend;
    const ankleSwingR =
      (-Math.max(0, -cosP) * 0.14 - Math.max(0, -sinP) * 0.08 + Math.max(0, sinP) * 0.18) *
      activeBlend;
    const baseFootLX = THREE.MathUtils.lerp(
      ankleSwingL + stairFootL - idleKneeL * 0.35,
      sitFootAngle + toeTap,
      sit
    );
    const baseFootRX = THREE.MathUtils.lerp(
      ankleSwingR + stairFootR - idleKneeR * 0.35,
      sitFootAngle,
      sit
    );
    applyCharEuler(
      b['FootL'],
      THREE.MathUtils.lerp(baseFootLX, (isTilted ? 0.05 : 0.14) + ankleL, shinBlend) - ankleLift,
      THREE.MathUtils.lerp(0, 0.035, lie),
      0
    );
    applyCharEuler(
      b['FootR'],
      THREE.MathUtils.lerp(baseFootRX, (isTilted ? 0.05 : 0.14) + ankleR, shinBlend) - ankleLift,
      THREE.MathUtils.lerp(0, -0.035, lie),
      0
    );

    // Arms blend smoothly across relaxed stance, human walk swing, door push, drinking, file shelf pick/carry, seated, and lying
    const standArmGest = Math.max(0, (Math.sin(t * 0.31 + 0.9) - 0.62) / 0.38) * standIdleAmt;
    const smoothStandGest = standArmGest * standArmGest * (3 - 2 * standArmGest);

    const armSwing = armStride * 0.27 * activeBlend * (1 + 0.22 * stairEffort);
    const carryFileArm = holdingFile && !activePickFile && !activePlaceFile && sit < 0.2 && lie < 0.05;
    const armStandL =
      armSwing - 0.035 + breath * 0.65 * (1 - activeBlend) + standWeight * 0.03;
    const armStandRBase =
      -armSwing - 0.035 - breath * 0.65 * (1 - activeBlend) - smoothStandGest * 0.16;

    const pickArmX = THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(-0.18, -1.26, pickReach),
      -0.46,
      pickGrasp
    );
    const pickArmAdduct = THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(0.0, 0.14, pickReach),
      0.24,
      pickGrasp
    );
    const pickElbowFlex = THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(0.24, 0.32, pickReach),
      1.16,
      pickGrasp
    );

    const placeArmX = !placeReleased
      ? THREE.MathUtils.lerp(-0.44, -0.78, placeReach)
      : THREE.MathUtils.lerp(-0.04, -0.78, placeReach);
    const placeArmAdduct = !placeReleased
      ? THREE.MathUtils.lerp(0.24, 0.15, placeReach)
      : 0.15 * placeReach;
    const placeElbowFlex = !placeReleased
      ? THREE.MathUtils.lerp(1.16, 0.36, placeReach)
      : THREE.MathUtils.lerp(0.24, 0.36, placeReach);

    const armStandR = activePickFile
      ? pickArmX
      : activePlaceFile
        ? placeArmX
        : carryFileArm
          ? -0.44 + armSwing * 0.14
          : THREE.MathUtils.lerp(armStandRBase, -1.06, pushAmt);

    // Ready/Reach drink arm angles solved from character GLB skeleton -> exact mouth alignment at drinkRaise = 1
    const drinkArmReadyX = THREE.MathUtils.lerp(-0.66, -0.92, drinkFillReach);
    const drinkArmSipX = -1.14 - drinkSipAmt * 0.04;
    const rightArmSwingX = activeDrink
      ? THREE.MathUtils.lerp(drinkArmReadyX, drinkArmSipX, drinkRaise)
      : THREE.MathUtils.lerp(armStandR, sitArmRSwing, sit);

    const rightArmAdductY = activeDrink
      ? THREE.MathUtils.lerp(0.14 * drinkFillReach + 0.14 * (1 - drinkFillReach), 0.49 + drinkSipAmt * 0.03, drinkRaise)
      : activePickFile
        ? pickArmAdduct
        : activePlaceFile
          ? placeArmAdduct
          : carryFileArm
            ? 0.24
            : 0;

    const rightArmDropZ = activeDrink
      ? THREE.MathUtils.lerp(1.45, 1.38, drinkRaise)
      : THREE.MathUtils.lerp(1.43, 1.42, sit);

    const standElbowR = activePickFile
      ? pickElbowFlex
      : activePlaceFile
        ? placeElbowFlex
        : carryFileArm
          ? 1.16 + Math.sin(walkPhase) * 0.03 * activeBlend
          : THREE.MathUtils.lerp(
              0.24 + smoothStandGest * 0.36 + Math.max(0, armStride) * 0.26 * activeBlend,
              0.46,
              pushAmt
            );
    const drinkElbowReady = THREE.MathUtils.lerp(1.38, 0.64, drinkFillReach);
    const drinkElbowSip = 2.22 + drinkSipAmt * 0.06;
    const rightElbowFlex = activeDrink
      ? THREE.MathUtils.lerp(drinkElbowReady, drinkElbowSip, drinkRaise)
      : THREE.MathUtils.lerp(standElbowR, sitElbowRFlex, sit);

    const baseArmDropL = THREE.MathUtils.lerp(-1.43, -1.42, sit);
    const baseArmSwingL = THREE.MathUtils.lerp(armStandL, sitArmLSwing, sit);

    applyArmSagittal(
      b['UpperArmL'],
      THREE.MathUtils.lerp(baseArmDropL, -1.41, lie),
      THREE.MathUtils.lerp(baseArmSwingL, -0.06 + Math.sin(t * 0.31) * 0.035 - armRelaxL * 0.16, lie),
      0
    );
    applyArmSagittal(
      b['UpperArmR'],
      THREE.MathUtils.lerp(rightArmDropZ, 1.41, lie),
      THREE.MathUtils.lerp(rightArmSwingX, -0.075 + Math.cos(t * 0.28) * 0.035 - armRelaxR * 0.16, lie),
      THREE.MathUtils.lerp(rightArmAdductY, 0, lie)
    );

    const elbowStandL =
      0.24 + Math.max(0, -armStride) * 0.26 * activeBlend + Math.sin(t * 0.47) * 0.03 * standIdleAmt;
    const baseElbowL = THREE.MathUtils.lerp(elbowStandL, sitElbowLFlex, sit);
    applyLocalElbowFlex(b['LowerArmL'], true, THREE.MathUtils.lerp(baseElbowL, 0.26 + armRelaxL, lie));
    applyLocalElbowFlex(b['LowerArmR'], false, THREE.MathUtils.lerp(rightElbowFlex, 0.28 + armRelaxR, lie));

    // Right wrist & finger curl for genuine file grasp, carry, and flat desk placement
    let handExtX = 0;
    let handPronY = 0;
    if (lie < 0.05 && sit < 0.2 && !activeDrink) {
      if (activePickFile) {
        handPronY = THREE.MathUtils.lerp(-0.55 * pickReach, -0.34, pickGrasp);
      } else if (activePlaceFile) {
        handExtX = !placeReleased ? 0.66 * placeReach : 0.18 * placeReach;
        handPronY = !placeReleased ? THREE.MathUtils.lerp(-0.34, -1.45, placeReach) : -0.8 * placeReach;
      } else if (carryFileArm) {
        handPronY = -0.34;
      }
    }
    applyLocalHandPose(b['HandR'], handExtX, handPronY, 0);

    const gripAmt =
      lie < 0.05 && sit < 0.2 && !activeDrink
        ? activePickFile
          ? pickGrasp > 0 || pickMs >= 500
            ? 1
            : 0
          : activePlaceFile
            ? 1 - placeFingerOpen
            : carryFileArm
              ? 1
              : 0
        : 0;
    const f1Curl = -0.68 * gripAmt;
    const f2Curl = -0.56 * gripAmt;
    applyLocalHandPose(b['Index1R'], f1Curl, 0, 0);
    applyLocalHandPose(b['Index2R'], f2Curl, 0, 0);
    applyLocalHandPose(b['Middle1R'], f1Curl, 0, 0);
    applyLocalHandPose(b['Middle2R'], f2Curl, 0, 0);
    applyLocalHandPose(b['Ring1R'], f1Curl, 0, 0);
    applyLocalHandPose(b['Ring2R'], f2Curl, 0, 0);
    applyLocalHandPose(b['Pinky1R'], f1Curl, 0, 0);
    applyLocalHandPose(b['Pinky2R'], f2Curl, 0, 0);
    applyLocalHandPose(b['Thumb1R'], 0.14 * gripAmt, 0.22 * gripAmt, 0.34 * gripAmt);
    applyLocalHandPose(b['Thumb2R'], 0.18 * gripAmt, 0, 0.24 * gripAmt);

    // Natural head stabilization during walk & focused gaze during shelf-pick / file placement / drinking
    const standYaw =
      (Math.sin(t * 0.51) * 0.16 + Math.sin(t * 0.21 + 0.9) * 0.11) *
      (1 - activeBlend * 0.68) *
      (1 - pushAmt);
    const standPitch = activePickFile
      ? THREE.MathUtils.lerp(-0.07, 0.04, pickGrasp) * pickReach
      : activePlaceFile
        ? 0.24 * placeReach
        : (Math.sin(t * 0.78) * 0.032 + Math.sin(t * 0.29) * 0.02) * (1 - activeBlend * 0.45) -
          cos2 * 0.016 * activeBlend;

    const lookYaw = activeDrink
      ? 0
      : activePickFile
        ? Math.sin(pickReach * Math.PI) * 0.05
        : activePlaceFile
          ? -0.06 * placeReach
          : THREE.MathUtils.lerp(standYaw, sitLookYaw, sit);
    const drinkHeadPitch =
      THREE.MathUtils.lerp(0.05 * drinkFillReach, -0.09 - drinkSipAmt * 0.11, drinkRaise);
    const drinkNeckPitch =
      THREE.MathUtils.lerp(0.02 * drinkFillReach, -0.04 - drinkSipAmt * 0.04, drinkRaise);
    const lookPitch = activeDrink
      ? drinkHeadPitch
      : THREE.MathUtils.lerp(standPitch, sitLookPitch, sit);
    const headTiltZ =
      activeDrink || activePickFile || activePlaceFile
        ? 0
        : Math.sin(t * 0.37) * 0.035 * (1 - activeBlend * 0.7) * (1 - pushAmt);

    const baseNeckX = activeDrink
      ? drinkNeckPitch
      : THREE.MathUtils.lerp(
          0.012 * activeBlend + (activePlaceFile ? 0.1 * placeReach : 0),
          -0.025 + sitLookPitch * 0.25,
          sit
        );
    const baseHeadX = THREE.MathUtils.lerp(lookPitch, -0.02 + lookPitch, sit);
    applyCharEuler(
      b['Neck'],
      THREE.MathUtils.lerp(baseNeckX, 0.045, lie),
      THREE.MathUtils.lerp(lookYaw * 0.45, lieHeadYaw * 0.4, lie),
      THREE.MathUtils.lerp(headTiltZ * 0.35, lieHeadRoll * 0.35, lie)
    );
    applyCharEuler(
      b['Head'],
      THREE.MathUtils.lerp(baseHeadX, lieHeadPitch, lie),
      THREE.MathUtils.lerp(lookYaw, lieHeadYaw * 0.72, lie),
      THREE.MathUtils.lerp(headTiltZ, lieHeadRoll, lie)
    );
    return;
  }

  // Fallback procedural rig animation
  if (!rig.torso || !rig.leftLeg || !rig.rightLeg || !rig.leftArm || !rig.rightArm || !rig.leftShin || !rig.rightShin || !rig.headGroup) {
    return;
  }
  rig.root.rotation.y = facingRad;
  if (lie > 0.05) {
    const fbHipH = 0.62 * hScale;
    const fbSitY = THREE.MathUtils.clamp(0.08 + seatHeight - 0.39, -0.4, 0.18);
    const fbTheta = THREE.MathUtils.lerp(0, tiltPitch, lie);
    const fbLieZ = bedBodyZOffset ?? -0.35;
    const fbHipStartY = fbSitY + fbHipH;
    const fbHipEndY = lyingHeight + 0.05 + fbHipH * Math.cos(tiltPitch);
    const fbHipEndZ = fbLieZ + fbHipH * Math.sin(tiltPitch);
    const fbHipY = THREE.MathUtils.lerp(fbHipStartY, fbHipEndY, lie);
    const fbHipZ = THREE.MathUtils.lerp(0, fbHipEndZ, lie);
    rig.bodyPivot.rotation.set(fbTheta, 0, 0);
    rig.bodyPivot.position.set(
      0,
      fbHipY - fbHipH * Math.cos(fbTheta),
      fbHipZ - fbHipH * Math.sin(fbTheta)
    );
    const fbShinFrac = THREE.MathUtils.clamp((lie - 0.1) / 0.72, 0, 1);
    const fbShinBlend = fbShinFrac * fbShinFrac * (3 - 2 * fbShinFrac);
    rig.leftLeg.rotation.x = THREE.MathUtils.lerp(-Math.PI * 0.45, 0, lie);
    rig.rightLeg.rotation.x = THREE.MathUtils.lerp(-Math.PI * 0.45, 0, lie);
    rig.leftShin.rotation.x = THREE.MathUtils.lerp(Math.PI * 0.45, 0, fbShinBlend);
    rig.rightShin.rotation.x = THREE.MathUtils.lerp(Math.PI * 0.45, 0, fbShinBlend);
    rig.headGroup.rotation.y = Math.sin(t * 0.3) * 0.15;
    return;
  }
  rig.bodyPivot.rotation.set(0, 0, 0);
  if (sit > 0.05) {
    const fbSitY = THREE.MathUtils.clamp(0.08 + seatHeight - 0.39, -0.4, 0.18);
    rig.bodyPivot.position.set(0, THREE.MathUtils.lerp(0.05, fbSitY, sit), THREE.MathUtils.lerp(0, -0.01, sit));
    rig.leftLeg.rotation.x = THREE.MathUtils.lerp(0, -Math.PI * 0.44, sit);
    rig.rightLeg.rotation.x = THREE.MathUtils.lerp(0, -Math.PI * 0.44, sit);
    rig.leftShin.rotation.x = THREE.MathUtils.lerp(0, Math.PI * 0.45, sit);
    rig.rightShin.rotation.x = THREE.MathUtils.lerp(0, Math.PI * 0.45, sit);
    const fbArm = seatedActivity === 'typing' ? -0.45 - Math.sin(timeSec * 12) * 0.05 : -0.15;
    rig.leftArm.rotation.x = THREE.MathUtils.lerp(0, fbArm, sit);
    rig.rightArm.rotation.x = THREE.MathUtils.lerp(0, fbArm, sit);
    rig.headGroup.rotation.y = Math.sin(t * 0.45) * 0.18;
    return;
  }
  rig.bodyPivot.position.set(0, 0.05, 0);
  const fbClimb = THREE.MathUtils.clamp(stairClimb, 0, 1);
  const fbDesc = THREE.MathUtils.clamp(-stairClimb, 0, 1);
  const swing = isMoving ? Math.sin(walkPhase) * (0.42 + 0.12 * fbClimb - 0.1 * fbDesc) : 0;
  const fbCos = Math.cos(walkPhase);
  rig.leftLeg.rotation.x = swing - (isMoving ? Math.max(0, fbCos) * 0.24 * fbClimb : 0);
  rig.rightLeg.rotation.x = -swing - (isMoving ? Math.max(0, -fbCos) * 0.24 * fbClimb : 0);
  rig.leftShin.rotation.x = isMoving ? Math.max(0, fbCos) * (0.58 + 0.25 * fbClimb) + 0.22 * fbDesc : 0.04;
  rig.rightShin.rotation.x = isMoving ? Math.max(0, -fbCos) * (0.58 + 0.25 * fbClimb) + 0.22 * fbDesc : 0.04;
  rig.torso.rotation.x = isMoving ? 0.1 * fbClimb - 0.04 * fbDesc : activePlaceFile ? 0.18 * placeReach : 0;
  rig.leftArm.rotation.x = -swing * 0.65;
  rig.rightArm.rotation.x = activePickFile
    ? -0.92
    : activePlaceFile
      ? THREE.MathUtils.lerp(-0.45, -1.05, placeReach)
      : holdingFile && !activePickFile
        ? -0.45
        : THREE.MathUtils.lerp(swing * 0.65, -0.95, THREE.MathUtils.clamp(doorPush, 0, 1));
  rig.headGroup.rotation.y = Math.sin(t * 0.5) * 0.14;
}

export function disposeHumanoid3D(rig: HumanoidRig) {
  rig.root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const m = child as THREE.Mesh;
      if (!m.userData.sharedGlbGeom) {
        m.geometry?.dispose();
      }
      if (!m.userData.sharedGlbMat) {
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        mats.forEach((mat) => mat?.dispose());
      }
    }
  });
}
