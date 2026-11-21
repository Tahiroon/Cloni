import * as THREE from 'three';
import { CharacterPose, StaffRole } from '../types/clinic';
import { glbRegistry } from './glbRegistry';

export type OutfitStyle = 'casual' | 'jalabiya' | 'abaya' | 'abaya_open' | 'dress' | 'sudanese_thobe';

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
  isPlayer?: boolean;
  role?: StaffRole;
  medicalWear?: 'none' | 'lab_coat' | 'scrubs';
  hasStethoscope?: boolean;
  hasNiqab?: boolean;
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
  blinkLids?: [THREE.Mesh, THREE.Mesh];
  mouthLower?: THREE.Mesh;
  mouthSeam?: THREE.Mesh;
  isSkinnedGlb: boolean;
  hipHeight?: number;
  heightScale?: number;
  bones?: Record<string, SkinnedBoneRef>;
}

let cachedIrisTex: THREE.CanvasTexture | null = null;
function getIrisTexture(): THREE.CanvasTexture {
  if (cachedIrisTex) return cachedIrisTex;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  const cx = 128;
  const cy = 128;
  const r = 124;

  ctx.clearRect(0, 0, 256, 256);

  // Outer limbal ring + base dark warm hazel-brown iris
  const baseGrad = ctx.createRadialGradient(cx, cy, r * 0.28, cx, cy, r);
  baseGrad.addColorStop(0, '#5a361d');
  baseGrad.addColorStop(0.32, '#4d2c18');
  baseGrad.addColorStop(0.74, '#321b0f');
  baseGrad.addColorStop(0.92, '#1d100a');
  baseGrad.addColorStop(1, '#140b07');
  ctx.fillStyle = baseGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Organic radial iris stroma fibers
  for (let i = 0; i < 160; i++) {
    const a = (i / 160) * Math.PI * 2 + Math.sin(i * 3.7) * 0.04;
    const innerR = r * (0.34 + (i % 5) * 0.025);
    const outerR = r * (0.86 + ((i * 7) % 4) * 0.022);
    ctx.strokeStyle =
      i % 3 === 0 ? 'rgba(138, 89, 50, 0.34)' : i % 2 === 0 ? 'rgba(92, 54, 28, 0.38)' : 'rgba(34, 18, 10, 0.42)';
    ctx.lineWidth = i % 4 === 0 ? 2.2 : 1.3;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * innerR, cy + Math.sin(a) * innerR);
    ctx.lineTo(cx + Math.cos(a + 0.02) * outerR, cy + Math.sin(a + 0.02) * outerR);
    ctx.stroke();
  }

  // Subtle warm collarette ring around pupil
  ctx.strokeStyle = 'rgba(148, 96, 52, 0.36)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.42, 0, Math.PI * 2);
  ctx.stroke();

  // Deep natural pupil with soft anti-aliased edge
  const pupilGrad = ctx.createRadialGradient(cx, cy, r * 0.24, cx, cy, r * 0.34);
  pupilGrad.addColorStop(0, '#070606');
  pupilGrad.addColorStop(0.84, '#090707');
  pupilGrad.addColorStop(1, 'rgba(9, 7, 7, 0)');
  ctx.fillStyle = pupilGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.34, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  cachedIrisTex = tex;
  return tex;
}

let sharedGeomPool: {
  contactShadowPlane: THREE.PlaneGeometry;
  selectRing: THREE.RingGeometry;
  hitCyl: THREE.CylinderGeometry;
  sclera: THREE.SphereGeometry;
  iris: THREE.CircleGeometry;
  catchlight: THREE.SphereGeometry;
  blinkLid: THREE.SphereGeometry;
  upperLid: THREE.TorusGeometry;
  lowerLid: THREE.TorusGeometry;
  lashFemale: THREE.TorusGeometry;
  lashMale: THREE.TorusGeometry;
  browFemaleL: THREE.TubeGeometry;
  browFemaleR: THREE.TubeGeometry;
  browMaleL: THREE.TubeGeometry;
  browMaleR: THREE.TubeGeometry;
  nostril: THREE.SphereGeometry;
  cupBody: THREE.CylinderGeometry;
  cupRim: THREE.TorusGeometry;
  cupWater: THREE.CylinderGeometry;
  folderCover: THREE.BoxGeometry;
  folderPages: THREE.BoxGeometry;
  folderTab: THREE.BoxGeometry;
  badgeCard: THREE.BoxGeometry;
  badgeClip: THREE.BoxGeometry;
  pocketPen: THREE.CylinderGeometry;
  buttonCyl: THREE.CylinderGeometry;
  beltStrap: THREE.CylinderGeometry;
  beltBuckle: THREE.BoxGeometry;
  watchStrap: THREE.TorusGeometry;
  watchFace: THREE.CylinderGeometry;
  glassRim: THREE.TorusGeometry;
  glassLens: THREE.CircleGeometry;
  glassArm: THREE.BoxGeometry;
  glassBridge: THREE.BoxGeometry;
} | null = null;

function getSharedHumanoidGeoms() {
  if (sharedGeomPool) return sharedGeomPool;
  const makeBrowTube = (side: -1 | 1, isFem: boolean) => {
    const ex = isFem ? 0.0462 : 0.0443;
    const by = isFem ? 0.1165 : 0.1202;
    const bz = isFem ? 0.1605 : 0.1592;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * (ex - 0.017), by - 0.001, bz + 0.002),
      new THREE.Vector3(side * ex, by + (isFem ? 0.0040 : 0.0020), bz + 0.003),
      new THREE.Vector3(side * (ex + 0.018), by - 0.0022, bz - 0.005),
    ]);
    return new THREE.TubeGeometry(curve, 12, isFem ? 0.0028 : 0.0038, 8, false);
  };
  sharedGeomPool = {
    contactShadowPlane: new THREE.PlaneGeometry(0.68, 0.68),
    selectRing: new THREE.RingGeometry(0.25, 0.32, 24),
    hitCyl: new THREE.CylinderGeometry(0.3, 0.3, 1.15, 10),
    sclera: new THREE.SphereGeometry(0.0136, 18, 14),
    iris: new THREE.CircleGeometry(0.0074, 24),
    catchlight: new THREE.SphereGeometry(0.0013, 6, 6),
    blinkLid: new THREE.SphereGeometry(0.0143, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.52),
    upperLid: new THREE.TorusGeometry(0.0134, 0.0028, 8, 18, Math.PI * 0.92),
    lowerLid: new THREE.TorusGeometry(0.0130, 0.0018, 8, 16, Math.PI * 0.84),
    lashFemale: new THREE.TorusGeometry(0.0132, 0.0020, 8, 16, Math.PI * 0.88),
    lashMale: new THREE.TorusGeometry(0.0132, 0.0013, 8, 16, Math.PI * 0.88),
    browFemaleL: makeBrowTube(-1, true),
    browFemaleR: makeBrowTube(1, true),
    browMaleL: makeBrowTube(-1, false),
    browMaleR: makeBrowTube(1, false),
    nostril: new THREE.SphereGeometry(0.0025, 8, 6),
    cupBody: new THREE.CylinderGeometry(0.036, 0.025, 0.085, 16),
    cupRim: new THREE.TorusGeometry(0.036, 0.004, 8, 18),
    cupWater: new THREE.CylinderGeometry(0.032, 0.029, 0.016, 16),
    folderCover: new THREE.BoxGeometry(0.21, 0.016, 0.27),
    folderPages: new THREE.BoxGeometry(0.185, 0.01, 0.245),
    folderTab: new THREE.BoxGeometry(0.06, 0.018, 0.028),
    badgeCard: new THREE.BoxGeometry(0.042, 0.054, 0.006),
    badgeClip: new THREE.BoxGeometry(0.018, 0.010, 0.009),
    pocketPen: new THREE.CylinderGeometry(0.0042, 0.0042, 0.046, 8),
    buttonCyl: new THREE.CylinderGeometry(0.0054, 0.0054, 0.005, 10),
    beltStrap: new THREE.CylinderGeometry(0.154, 0.156, 0.030, 24),
    beltBuckle: new THREE.BoxGeometry(0.034, 0.034, 0.010),
    watchStrap: new THREE.TorusGeometry(0.036, 0.007, 10, 20),
    watchFace: new THREE.CylinderGeometry(0.016, 0.016, 0.008, 16),
    glassRim: new THREE.TorusGeometry(0.020, 0.0030, 8, 20),
    glassLens: new THREE.CircleGeometry(0.019, 16),
    glassArm: new THREE.BoxGeometry(0.004, 0.004, 0.105),
    glassBridge: new THREE.BoxGeometry(0.022, 0.004, 0.004),
  };
  return sharedGeomPool;
}

let sharedFixedMats: {
  selectRing: THREE.MeshBasicMaterial;
  hitInvisible: THREE.MeshBasicMaterial;
  invisibleMat: THREE.MeshStandardMaterial;
  sclera: THREE.MeshPhysicalMaterial;
  iris: THREE.MeshPhysicalMaterial;
  catchlight: THREE.MeshBasicMaterial;
  lash: THREE.MeshStandardMaterial;
  cupBody: THREE.MeshStandardMaterial;
  cupRim: THREE.MeshStandardMaterial;
  cupWater: THREE.MeshStandardMaterial;
  folderCover: THREE.MeshStandardMaterial;
  folderPages: THREE.MeshStandardMaterial;
  folderTab: THREE.MeshStandardMaterial;
  badgeCard: THREE.MeshPhysicalMaterial;
  lanyardBlue: THREE.MeshStandardMaterial;
  glassLens: THREE.MeshPhysicalMaterial;
} | null = null;

function getSharedFixedMats() {
  if (sharedFixedMats) return sharedFixedMats;
  const invis = new THREE.MeshBasicMaterial({ visible: false }) as unknown as THREE.MeshStandardMaterial;
  invis.visible = false;
  sharedFixedMats = {
    selectRing: new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    }),
    hitInvisible: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    invisibleMat: invis,
    sclera: new THREE.MeshPhysicalMaterial({
      color: 0xf1ece5,
      roughness: 0.16,
      metalness: 0.0,
      clearcoat: 0.72,
      clearcoatRoughness: 0.08,
    }),
    iris: new THREE.MeshPhysicalMaterial({
      map: getIrisTexture(),
      roughness: 0.06,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      transparent: true,
      alphaTest: 0.15,
    }),
    catchlight: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    lash: new THREE.MeshStandardMaterial({ color: 0x16100c, roughness: 0.58, metalness: 0.0 }),
    cupBody: new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45, metalness: 0.02 }),
    cupRim: new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.35, metalness: 0.05 }),
    cupWater: new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.18, metalness: 0.05 }),
    folderCover: new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.48, metalness: 0.04 }),
    folderPages: new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.65, metalness: 0.0 }),
    folderTab: new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.45, metalness: 0.02 }),
    badgeCard: new THREE.MeshPhysicalMaterial({
      map: getIdBadgeTexture(),
      roughness: 0.32,
      metalness: 0.04,
      clearcoat: 0.35,
    }),
    lanyardBlue: new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.55, metalness: 0.05 }),
    glassLens: new THREE.MeshPhysicalMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.28,
      roughness: 0.08,
      clearcoat: 1.0,
    }),
  };
  return sharedFixedMats;
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

let cachedHairBump: THREE.CanvasTexture | null = null;
function getHairStrandBump(): THREE.CanvasTexture {
  if (cachedHairBump) return cachedHairBump;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 128, 128);
  for (let x = 0; x < 128; x++) {
    const v = 128 + Math.round(Math.sin(x * 0.95) * 26 + Math.cos(x * 2.3) * 14);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(x, 0, 1, 128);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 3);
  tex.needsUpdate = true;
  cachedHairBump = tex;
  return tex;
}

let cachedIdBadgeTex: THREE.CanvasTexture | null = null;
function getIdBadgeTexture(): THREE.CanvasTexture {
  if (cachedIdBadgeTex) return cachedIdBadgeTex;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 160;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 128, 160);
  // Top clinical blue lanyard bar
  ctx.fillStyle = '#0284c7';
  ctx.fillRect(0, 0, 128, 34);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('THERASON', 64, 23);
  // Mini clinician avatar frame
  ctx.fillStyle = '#e0f2fe';
  ctx.fillRect(14, 46, 44, 54);
  ctx.fillStyle = '#8c583a';
  ctx.beginPath();
  ctx.arc(36, 65, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0369a1';
  ctx.fillRect(22, 80, 28, 20);
  // Lines & barcode
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(68, 52, 46, 8);
  ctx.fillStyle = '#64748b';
  ctx.fillRect(68, 68, 38, 6);
  ctx.fillRect(68, 82, 42, 6);
  ctx.fillStyle = '#0f172a';
  for (let bx = 16; bx < 112; bx += 6) {
    ctx.fillRect(bx, 118, (bx % 12 === 0 ? 3 : 2), 26);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  cachedIdBadgeTex = tex;
  return tex;
}

function makeSkinMat(hex: string | number, appearance: HumanoidAppearance, roughness = 0.54) {
  const baseCol = new THREE.Color(hex);
  const sheenCol = baseCol.clone().lerp(new THREE.Color(0xb85e42), 0.42);
  return new THREE.MeshPhysicalMaterial({
    color: baseCol,
    map: appearance.skinMicroMap ?? null,
    roughnessMap: appearance.skinRoughMap ?? null,
    roughness,
    metalness: 0.0,
    sheen: 0.24,
    sheenRoughness: 0.64,
    sheenColor: sheenCol,
    envMapIntensity: 0.36,
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

  // Female characters & receptionist use woman_suit.glb (long sleeves, closed ankles)
  if (
    appearance.isFemale ||
    appearance.hasHijab ||
    style === 'abaya' ||
    style === 'abaya_open' ||
    style === 'dress' ||
    style === 'sudanese_thobe' ||
    (appearance.isStaff && appearance.isFemale !== false)
  ) {
    return 'char_woman_suit';
  }

  // Male player: Lab Coat & Shirt+Pants use man_suit.glb (long sleeves & collared neckline); Scrubs use man_casual2.glb (short sleeves)
  if (
    style === 'jalabiya' ||
    appearance.medicalWear === 'lab_coat' ||
    (appearance.isPlayer && appearance.medicalWear !== 'scrubs')
  ) {
    return 'char_suit';
  }
  if (appearance.medicalWear === 'scrubs') {
    return 'char_man2';
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
    chestZ?: number;
    chestRx?: number;
    chestRy?: number;
    chestCy?: number;
    midRx: number;
    midRy: number;
    botRx: number;
    botRy: number;
    topCy: number;
    botCy: number;
    openFrontGapRad?: number;
    closeBottomCap?: boolean;
    accentHemHex?: number;
    pleated?: boolean;
  }
): THREE.SkinnedMesh {
  const skeleton = legMesh.skeleton;
  const bones = skeleton.bones;

  const idxHips = findBoneIdx(bones, ['Hips']);
  const idxAbdomen = findBoneIdx(bones, ['Abdomen', 'Hips']);
  const idxTorso = findBoneIdx(bones, ['Torso', 'Abdomen', 'Hips']);
  const idxChest = findBoneIdx(bones, ['Chest', 'Torso', 'Abdomen', 'Hips']);
  const idxNeck = findBoneIdx(bones, ['Neck', 'Chest', 'Torso', 'Hips']);
  const idxUL = findBoneIdx(bones, ['UpperLegL', 'UpperLeg.L']);
  const idxLL = findBoneIdx(bones, ['LowerLegL', 'LowerLeg.L']);
  const idxUR = findBoneIdx(bones, ['UpperLegR', 'UpperLeg.R']);
  const idxLR = findBoneIdx(bones, ['LowerLegR', 'LowerLeg.R']);

  const rings = 30;
  const radialSegs = 48;
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

  const hasChestRing =
    opts.chestZ !== undefined &&
    opts.chestRx !== undefined &&
    opts.chestRy !== undefined;
  const chestV = hasChestRing
    ? THREE.MathUtils.clamp((opts.zTop - opts.chestZ!) / Math.max(0.0005, opts.zTop - opts.zBot), 0.08, 0.45)
    : 0;
  const midV = hasChestRing ? Math.max(chestV + 0.18, 0.48) : 0.36;

  for (let r = 0; r <= rings; r++) {
    const v = r / rings; // 0 = top neck/chest, 1 = bottom hem
    const z = THREE.MathUtils.lerp(opts.zTop, opts.zBot, v);
    let cy: number;
    let rx: number;
    let ry: number;

    if (hasChestRing) {
      const cRx = opts.chestRx!;
      const cRy = opts.chestRy!;
      const cCy = opts.chestCy ?? opts.topCy;
      if (v < chestV) {
        const t = v / chestV;
        const smooth = t * t * (3 - 2 * t);
        rx = THREE.MathUtils.lerp(opts.topRx, cRx, smooth);
        ry = THREE.MathUtils.lerp(opts.topRy, cRy, smooth);
        cy = THREE.MathUtils.lerp(opts.topCy, cCy, smooth);
      } else if (v < midV) {
        const t = (v - chestV) / Math.max(0.01, midV - chestV);
        const smooth = t * t * (3 - 2 * t);
        rx = THREE.MathUtils.lerp(cRx, opts.midRx, smooth);
        ry = THREE.MathUtils.lerp(cRy, opts.midRy, smooth);
        cy = THREE.MathUtils.lerp(cCy, opts.botCy, t * 0.55);
      } else {
        const t = (v - midV) / Math.max(0.01, 1 - midV);
        rx = THREE.MathUtils.lerp(opts.midRx, opts.botRx, t);
        ry = THREE.MathUtils.lerp(opts.midRy, opts.botRy, t);
        cy = THREE.MathUtils.lerp(cCy, opts.botCy, 0.55 + t * 0.45);
      }
    } else {
      cy = THREE.MathUtils.lerp(opts.topCy, opts.botCy, v);
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
    }

    for (let c = 0; c <= radialSegs; c++) {
      const u = c / radialSegs;
      const theta = thetaStart + u * thetaSpan;
      // Subtle organic vertical pleats widening toward lower hem (suppressed for tailored scrubs/coats)
      const pleatWave = Math.sin(theta * 7 + v * 1.4);
      const basePleatAmp = opts.pleated === false ? 0.008 : 0.042;
      const pleatAmp = basePleatAmp * Math.max(0, v - 0.06);
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

      if (z >= 0.0144) {
        // Neck-base collar ring blends Chest <-> Neck seamlessly
        const neckT = THREE.MathUtils.clamp((z - 0.0144) / Math.max(0.0005, opts.zTop - 0.0144), 0, 1);
        b0 = idxChest;
        w0 = 1 - neckT * 0.28;
        b1 = idxNeck;
        w1 = neckT * 0.28;
        b2 = idxTorso;
        w2 = 0;
        b3 = idxHips;
        w3 = 0;
      } else if (z >= 0.0128) {
        // Upper chest tracks Torso <-> Chest seamlessly
        const chestT = THREE.MathUtils.clamp((z - 0.0128) / 0.0016, 0, 1);
        b0 = idxTorso;
        w0 = 0.72 * (1 - chestT);
        b1 = idxChest;
        w1 = 0.28 + 0.72 * chestT;
        b2 = idxAbdomen;
        w2 = 0;
        b3 = idxHips;
        w3 = 0;
      } else if (z >= 0.0118) {
        // Mid-torso / ribcage shares cleanly between Abdomen & Torso
        const topT = THREE.MathUtils.clamp((z - 0.0118) / 0.0010, 0, 1);
        b0 = idxAbdomen;
        w0 = 0.72 * (1 - topT) + 0.16 * topT;
        b1 = idxTorso;
        w1 = 0.20 * (1 - topT) + 0.84 * topT;
        b2 = idxHips;
        w2 = 0.08 * (1 - topT);
        b3 = idxHips;
        w3 = 0;
      } else if (z >= 0.0108) {
        // Upper waist/hips smoothly shared between Abdomen/Hips & UpperLegs
        const waistT = THREE.MathUtils.clamp((z - 0.0108) / 0.0010, 0, 1);
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
  const sGeoms = getSharedHumanoidGeoms();
  const sMats = getSharedFixedMats();

  if (appearance.contactShadowTex) {
    const ao = new THREE.Mesh(
      sGeoms.contactShadowPlane,
      new THREE.MeshBasicMaterial({
        map: appearance.contactShadowTex,
        transparent: true,
        depthWrite: false,
      })
    );
    ao.userData.sharedGlbGeom = true;
    ao.rotation.x = -Math.PI / 2;
    ao.position.y = 0.072;
    root.add(ao);
  }

  const selectRing = new THREE.Mesh(sGeoms.selectRing, sMats.selectRing);
  selectRing.userData.sharedGlbGeom = true;
  selectRing.userData.sharedGlbMat = true;
  selectRing.rotation.x = -Math.PI / 2;
  selectRing.position.y = 0.076;
  selectRing.visible = false;
  root.add(selectRing);

  const hitMesh = new THREE.Mesh(sGeoms.hitCyl, sMats.hitInvisible);
  hitMesh.userData.sharedGlbGeom = true;
  hitMesh.userData.sharedGlbMat = true;
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
      outfitStyle === 'sudanese_thobe' ||
      (appearance.isStaff && appearance.isFemale !== false)
  );
  const medicalWear: 'none' | 'lab_coat' | 'scrubs' =
    appearance.medicalWear ??
    (appearance.isStaff && appearance.role === 'therapist' ? 'lab_coat' : 'none');
  const showStethoscope = Boolean(
    appearance.hasStethoscope ??
      (medicalWear !== 'none' || (appearance.isStaff && appearance.role === 'therapist'))
  );
  const thobeKenarHex =
    shirtLum >= 0.65
      ? (seedIdx % 2 === 0 ? 0xb8893c : 0x7a2338)
      : shirtCol.clone().lerp(new THREE.Color(0xf3dfc1), 0.56).getHex();
  const tarhaCol =
    appearance.hasNiqab
      ? new THREE.Color('#141519')
      : medicalWear !== 'none'
        ? new THREE.Color('#e2e8f0')
        : appearance.role === 'receptionist'
          ? new THREE.Color('#cbd5e1')
          : outfitStyle === 'sudanese_thobe'
            ? shirtCol.clone()
            : outfitStyle === 'abaya'
              ? new THREE.Color('#1a1b20')
              : outfitStyle === 'abaya_open'
                ? shirtCol.clone().offsetHSL(0, -0.04, 0.12)
                : new THREE.Color('#334155');
  const tarhaUnderCapCol = tarhaCol.clone().multiplyScalar(0.78);

  const effectiveHijab =
    isFemaleLook &&
    (appearance.hasHijab !== undefined
      ? appearance.hasHijab
      : Boolean(
          appearance.role === 'receptionist' ||
            outfitStyle === 'abaya' ||
            outfitStyle === 'abaya_open' ||
            outfitStyle === 'sudanese_thobe'
        ));

  const targetH = 1.34 * (appearance.heightScale || 1);
  const glbKey = pickGlbKey(appearance);
  const skinnedModel = glbRegistry.cloneSkinned(glbKey, targetH);
  if (skinnedModel) {
    bodyPivot.add(skinnedModel);

    let legSkinnedMesh: THREE.SkinnedMesh | null = null;
    const hideSuitLegs =
      medicalWear === 'none' &&
      (outfitStyle === 'abaya' ||
        outfitStyle === 'dress' ||
        outfitStyle === 'jalabiya' ||
        outfitStyle === 'sudanese_thobe');

    skinnedModel.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        const meshName = mesh.name || '';
        const parentName = mesh.parent?.name || '';
        const isSuitBody = meshName.startsWith('Suit_Body') || parentName === 'Suit_Body';
        const isCasualBody = meshName.startsWith('Casual2_Body') || parentName === 'Casual2_Body';
        const isBodyMesh = isSuitBody || isCasualBody;
        const isSuitLegs = meshName.startsWith('Suit_Legs') || parentName === 'Suit_Legs';
        const isCasualLegs = meshName.startsWith('Casual2_Legs') || parentName === 'Casual2_Legs';
        const isSuitFeet = meshName.startsWith('Suit_Feet') || parentName === 'Suit_Feet';
        const isCasualFeet = meshName.startsWith('Casual2_Feet') || parentName === 'Casual2_Feet';

        if (
          (isSuitLegs || isCasualLegs) &&
          (mesh as THREE.SkinnedMesh).isSkinnedMesh
        ) {
          legSkinnedMesh = mesh as THREE.SkinnedMesh;
          if (hideSuitLegs) {
            mesh.visible = false;
          }
        }

        const origMats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const hasSkinOnly =
          origMats.length === 1 && (origMats[0] as THREE.Material | undefined)?.name === 'Skin';

        if (
          (medicalWear === 'scrubs' || medicalWear === 'lab_coat') &&
          isBodyMesh &&
          !hasSkinOnly
        ) {
          // Tuck central chest, V-lapels & dress-shirt collar smoothly inside while keeping shoulders/sleeves & neck Skin untouched
          const clonedGeom = mesh.geometry.clone();
          const posAttr = clonedGeom.getAttribute('position') as THREE.BufferAttribute;
          if (posAttr) {
            for (let vi = 0; vi < posAttr.count; vi++) {
              const vx = posAttr.getX(vi);
              const vy = posAttr.getY(vi);
              let vz = posAttr.getZ(vi);
              const xBound = vz >= 0.0140 ? 0.00105 : 0.00162;
              const maxZ = isSuitBody ? (isFemaleLook ? 0.01518 : 0.01555) : 0.0140;
              if (vz < maxZ && Math.abs(vx) < xBound) {
                const tuckT = THREE.MathUtils.clamp((maxZ - vz) / 0.0007, 0.35, 1);
                const shrink = 1 - (isSuitBody ? 0.30 : 0.26) * tuckT;
                const cy = isFemaleLook ? -0.00066 : -0.00046;
                if (isSuitBody && !isFemaleLook && vz >= 0.0148 && Math.abs(vx) < 0.00086) {
                  // Pull tall male suit shirt collar tips slightly below z=0.01515 lab-coat neck ring
                  vz -= 0.00042;
                }
                posAttr.setXYZ(vi, vx * shrink, cy + (vy - cy) * shrink, vz);
              }
            }
            posAttr.needsUpdate = true;
            clonedGeom.computeVertexNormals();
          }
          mesh.geometry = clonedGeom;
          mesh.userData.sharedGlbGeom = false;
        }

        const clonedMats = origMats.map((m) => {
          const orig = m as THREE.MeshStandardMaterial;
          const mName = orig.name || '';
          let targetHex = orig.color ? orig.color.getHex() : 0xcbd5e1;
          let mat: THREE.MeshStandardMaterial;

          if (mName === 'Skin') {
            if (meshName.includes('Feet') && isFemaleLook) {
              mat = makeLeatherMat(0x1f1916, appearance, 0.56);
            } else {
              mat = makeSkinMat(skinCol.getHex(), appearance, 0.55);
            }
          } else if (mName === 'Skin_Darker') {
            mat = makeSkinMat(darkerSkinCol.getHex(), appearance, 0.60);
          } else if (mName === 'Eye' || (mName === 'Brown' && (meshName.includes('Head') || parentName.includes('Head')))) {
            // Hide flat low-poly GLB eye cube; replaced by anatomically sculpted 3D sclera/iris/eyelid eyes
            mat = sMats.invisibleMat;
          } else if (mName === 'Eyebrows' || (mName === 'Hair_Brown' && (meshName.includes('Head') || parentName.includes('Head')))) {
            // Hide boxy GLB eyebrow rectangles; replaced by sculpted curved 3D eyebrows
            mat = sMats.invisibleMat;
          } else if (mName === 'Hair' || mName === 'Hair_Blond' || mName === 'Hair_Brown') {
            if (isFemaleLook && effectiveHijab && mName === 'Hair_Blond') {
              // Completely hide hair mesh under Tarha so zero stray tufts clip out
              mat = sMats.invisibleMat;
            } else {
              mat = new THREE.MeshPhysicalMaterial({
                color: hairCol.getHex(),
                bumpMap: getHairStrandBump(),
                bumpScale: 0.0028,
                roughness: 0.54,
                metalness: 0.02,
                sheen: 0.44,
                sheenRoughness: 0.42,
                sheenColor: new THREE.Color(0x6e5140),
                envMapIntensity: 0.48,
              });
            }
          } else if (medicalWear === 'lab_coat') {
            if (isFemaleLook) {
              if ((mName === 'Black' || mName === 'White') && isSuitBody) {
                // Full pure white medical lab coat sleeves/shoulders/neck with zero inner shirt showing
                mat = makeClothMat(0xf2f4f7, appearance, 0.72, 0.36);
              } else if (mName === 'Black' && isSuitLegs) {
                mat = makeClothMat(pantsCol.getHex(), appearance, 0.82, 0.38);
              } else if (isSuitFeet) {
                mat = makeLeatherMat(0x1b1918, appearance, 0.40);
              } else {
                mat = makeClothMat(targetHex, appearance, orig.roughness ?? 0.75, 0.35);
              }
            } else {
              if ((mName === 'Suit' || mName === 'White') && isSuitBody) {
                // Full pure white medical lab coat sleeves/shoulders/neck with zero inner shirt showing
                mat = makeClothMat(0xf2f4f7, appearance, 0.72, 0.36);
              } else if (mName === 'Tie') {
                mat = sMats.invisibleMat;
              } else if (mName === 'Suit' && isSuitLegs) {
                mat = makeClothMat(pantsCol.getHex(), appearance, 0.82, 0.38);
              } else if (mName === 'Red_Dark' || mName === 'Black') {
                mat = makeLeatherMat(0x1b1918, appearance, 0.40);
              } else {
                mat = makeClothMat(targetHex, appearance, orig.roughness ?? 0.75, 0.35);
              }
            }
          } else if (medicalWear === 'scrubs') {
            if (isFemaleLook) {
              if ((mName === 'Black' || mName === 'White') && isSuitBody) {
                // Unified cohesive scrub top across shoulders, chest, sleeves & collar (no blazer cutaway)
                mat = makeClothMat(shirtCol.getHex(), appearance, 0.78, 0.46);
              } else if (mName === 'Black' && isSuitLegs) {
                mat = makeClothMat(pantsCol.getHex(), appearance, 0.82, 0.40);
              } else if (isSuitFeet) {
                mat = makeLeatherMat(0x1e293b, appearance, 0.42);
              } else {
                mat = makeClothMat(targetHex, appearance, orig.roughness ?? 0.76, 0.35);
              }
            } else {
              if (mName === 'LightBrown' || (mName === 'Suit' && isSuitBody)) {
                mat = makeClothMat(shirtCol.getHex(), appearance, 0.78, 0.46);
              } else if (mName === 'White' && isBodyMesh) {
                mat = makeClothMat(shirtCol.getHex(), appearance, 0.78, 0.45);
              } else if (mName === 'LightBlue' || (mName === 'Suit' && isSuitLegs)) {
                mat = makeClothMat(pantsCol.getHex(), appearance, 0.82, 0.40);
              } else if (mName === 'White' && isCasualFeet) {
                mat = makeLeatherMat(0xedf1f5, appearance, 0.48);
              } else if (mName === 'Red_Dark' || mName === 'Black') {
                mat = makeLeatherMat(0x1e293b, appearance, 0.44);
              } else {
                mat = orig.clone();
              }
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
            if ((mName === 'Black' || mName === 'White') && isSuitBody) {
              mat = makeClothMat(shirtCol.getHex(), appearance, 0.82, 0.58);
            } else if (isSuitFeet) {
              mat = makeLeatherMat(0x181615, appearance, 0.48);
            } else {
              mat = makeClothMat(targetHex, appearance, orig.roughness ?? 0.82, 0.4);
            }
          } else if (outfitStyle === 'abaya_open') {
            if (mName === 'Black' && isSuitBody) {
              mat = makeClothMat(shirtCol.getHex(), appearance, 0.82, 0.58);
            } else if (mName === 'White' && isSuitBody) {
              mat = makeClothMat(pantsCol.getHex(), appearance, 0.76, 0.46);
            } else if (mName === 'Black' && isSuitLegs) {
              mat = makeClothMat(0x1e293b, appearance, 0.82, 0.36);
            } else if (isSuitFeet) {
              mat = makeLeatherMat(0x1f1916, appearance, 0.46);
            } else {
              mat = makeClothMat(targetHex, appearance, orig.roughness ?? 0.82, 0.4);
            }
          } else if (outfitStyle === 'dress') {
            if ((mName === 'Black' || mName === 'White') && isSuitBody) {
              mat = makeClothMat(shirtCol.getHex(), appearance, 0.82, 0.58);
            } else if (isSuitFeet) {
              mat = makeLeatherMat(0x27201c, appearance, 0.48);
            } else {
              mat = makeClothMat(targetHex, appearance, orig.roughness ?? 0.8, 0.4);
            }
          } else if (outfitStyle === 'sudanese_thobe') {
            if (mName === 'Black' && isSuitBody) {
              mat = makeClothMat(pantsCol.getHex(), appearance, 0.82, 0.48);
            } else if (mName === 'White' && isSuitBody) {
              const innerNeckHex = pantsCol.clone().lerp(new THREE.Color(0xffffff), 0.14).getHex();
              mat = makeClothMat(innerNeckHex, appearance, 0.82, 0.48);
            } else if (isSuitFeet) {
              mat = makeLeatherMat(shoeLeatherHex, appearance, 0.5);
            } else {
              mat = makeClothMat(targetHex, appearance, orig.roughness ?? 0.82, 0.45);
            }
          } else if (isFemaleLook) {
            if (mName === 'Black' && isSuitBody) {
              mat = makeClothMat(shirtCol.getHex(), appearance, 0.76, 0.46);
            } else if (mName === 'White' && isSuitBody) {
              const collarTint = appearance.isPlayer
                ? shirtCol.clone().lerp(new THREE.Color(0xffffff), 0.24).getHex()
                : contrastInnerHex;
              mat = makeClothMat(collarTint, appearance, 0.76, 0.46);
            } else if (mName === 'Black' && isSuitLegs) {
              mat = makeClothMat(pantsCol.getHex(), appearance, 0.82, 0.36);
            } else if (isSuitFeet) {
              mat = makeLeatherMat(shoeLeatherHex, appearance, 0.42);
            } else {
              mat = makeClothMat(targetHex, appearance, orig.roughness ?? 0.8, 0.35);
            }
          } else {
            if (mName === 'LightBrown' || (mName === 'Suit' && isSuitBody)) {
              mat = makeClothMat(shirtCol.getHex(), appearance, 0.78, 0.45);
            } else if (mName === 'Tie') {
              if (
                appearance.isPlayer ||
                (!appearance.isStaff && !isFemaleLook && outfitStyle === 'casual' && medicalWear === 'none' && appearance.shirtStyle === 'shirt')
              ) {
                mat = sMats.invisibleMat;
              } else {
                mat = makeClothMat(tieColorHex, appearance, 0.74, 0.52);
              }
            } else if (mName === 'White' && isSuitBody) {
              const useShirtCollarTint =
                appearance.isPlayer ||
                (!appearance.isStaff && !isFemaleLook && outfitStyle === 'casual' && medicalWear === 'none' && appearance.shirtStyle === 'shirt');
              const innerTint = useShirtCollarTint
                ? shirtCol.clone().lerp(new THREE.Color(0xffffff), 0.24).getHex()
                : contrastInnerHex;
              mat = makeClothMat(innerTint, appearance, 0.76, 0.45);
            } else if (mName === 'LightBlue' || (mName === 'Suit' && isSuitLegs)) {
              mat = makeClothMat(pantsCol.getHex(), appearance, 0.82, 0.34);
            } else if (mName === 'Red_Dark' || mName === 'Black') {
              mat = makeLeatherMat(shoeLeatherHex, appearance, 0.42);
            } else {
              mat = orig.clone();
            }
          }

          if (mat !== sMats.invisibleMat) {
            mat.name = mName;
          }
          return mat;
        });

        mesh.userData.sharedGlbMat = clonedMats.every((cm) => cm === sMats.invisibleMat);
        mesh.material = clonedMats.length === 1 ? clonedMats[0] : clonedMats;
      }
    });

    // Build SkinnedMesh garments directly on the character's skeleton (zero leg/hip clipping!)
    if (legSkinnedMesh && medicalWear === 'lab_coat') {
      // Full closed buttoned white medical lab coat from neck collar cleanly down to mid-thigh (zero inner shirt!)
      createSkinnedGarmentMesh(legSkinnedMesh, appearance, {
        colorHex: 0xf2f4f7,
        zTop: 0.01515,
        zBot: 0.0054,
        topRx: isFemaleLook ? 0.00098 : 0.00108,
        topRy: isFemaleLook ? 0.00074 : 0.00088,
        topCy: isFemaleLook ? -0.00054 : -0.00035,
        chestZ: 0.0136,
        chestRx: isFemaleLook ? 0.00126 : 0.00150,
        chestRy: isFemaleLook ? 0.00112 : 0.00118,
        chestCy: isFemaleLook ? -0.00086 : -0.00062,
        midRx: isFemaleLook ? 0.00172 : 0.00180,
        midRy: isFemaleLook ? 0.00132 : 0.00136,
        botRx: isFemaleLook ? 0.00210 : 0.00214,
        botRy: isFemaleLook ? 0.00146 : 0.00150,
        botCy: -0.00054,
        openFrontGapRad: 0,
        pleated: false,
      });
    } else if (legSkinnedMesh && medicalWear === 'scrubs') {
      if (isFemaleLook) {
        // Female full seamless clinical scrub top from neck collar down cleanly over scrub pants (zero blazer/shirt!)
        createSkinnedGarmentMesh(legSkinnedMesh, appearance, {
          colorHex: shirtCol.getHex(),
          zTop: 0.01515,
          zBot: 0.0080,
          topRx: 0.00096,
          topRy: 0.00072,
          topCy: -0.00054,
          chestZ: 0.0136,
          chestRx: 0.00124,
          chestRy: 0.00110,
          chestCy: -0.00086,
          midRx: 0.00162,
          midRy: 0.00128,
          botRx: 0.00190,
          botRy: 0.00126,
          botCy: -0.00052,
          pleated: false,
        });
      } else {
        // Male scrubs over Casual2 pullover base
        createSkinnedGarmentMesh(legSkinnedMesh, appearance, {
          colorHex: shirtCol.getHex(),
          zTop: 0.0138,
          zBot: 0.0080,
          topRx: 0.00144,
          topRy: 0.00112,
          midRx: 0.00162,
          midRy: 0.00128,
          botRx: 0.00184,
          botRy: 0.00120,
          topCy: -0.00064,
          botCy: -0.00056,
          pleated: false,
        });
      }
    } else if (legSkinnedMesh && medicalWear === 'none') {
      if (outfitStyle === 'abaya') {
        createSkinnedGarmentMesh(legSkinnedMesh, appearance, {
          colorHex: shirtCol.getHex(),
          zTop: 0.0134,
          zBot: 0.0012,
          topRx: 0.00126,
          topRy: 0.00096,
          midRx: 0.00186,
          midRy: 0.00138,
          botRx: 0.00246,
          botRy: 0.00168,
          topCy: -0.00084,
          botCy: -0.00056,
          closeBottomCap: true,
          accentHemHex:
            !appearance.hasNiqab && !appearance.isPlayer && (appearance.variantSeed || 0) % 2 === 0
              ? 0xc59b57
              : undefined,
        });
      } else if (outfitStyle === 'abaya_open') {
        // Soft ivory/light inner tunic tucked over trousers + flowing open-front Abaya outer coat
        if (appearance.isPlayer) {
          createSkinnedGarmentMesh(legSkinnedMesh, appearance, {
            colorHex: pantsCol.getHex(),
            zTop: 0.0128,
            zBot: 0.0082,
            topRx: 0.00120,
            topRy: 0.00090,
            midRx: 0.00158,
            midRy: 0.00122,
            botRx: 0.00188,
            botRy: 0.00120,
            topCy: -0.00082,
            botCy: -0.00054,
            pleated: false,
          });
        }
        createSkinnedGarmentMesh(legSkinnedMesh, appearance, {
          colorHex: shirtCol.getHex(),
          zTop: 0.0134,
          zBot: 0.0013,
          topRx: 0.00130,
          topRy: 0.00100,
          midRx: 0.00196,
          midRy: 0.00144,
          botRx: 0.00258,
          botRy: 0.00174,
          topCy: -0.00084,
          botCy: -0.00056,
          openFrontGapRad: 0.36,
        });
      } else if (outfitStyle === 'dress') {
        createSkinnedGarmentMesh(legSkinnedMesh, appearance, {
          colorHex: shirtCol.getHex(),
          zTop: 0.0128,
          zBot: 0.0016,
          topRx: 0.00124,
          topRy: 0.00094,
          midRx: 0.00184,
          midRy: 0.00138,
          botRx: 0.00246,
          botRy: 0.00166,
          topCy: -0.00082,
          botCy: -0.00055,
          closeBottomCap: true,
        });
      } else if (outfitStyle === 'sudanese_thobe') {
        createSkinnedGarmentMesh(legSkinnedMesh, appearance, {
          colorHex: shirtCol.getHex(),
          zTop: 0.0128,
          zBot: 0.0014,
          topRx: 0.00124,
          topRy: 0.00094,
          midRx: 0.00184,
          midRy: 0.00138,
          botRx: 0.00232,
          botRy: 0.00162,
          topCy: -0.00082,
          botCy: -0.00056,
          closeBottomCap: true,
          accentHemHex: thobeKenarHex,
        });
      } else if (outfitStyle === 'casual' && isFemaleLook) {
        // Full modest hip-length blouse contoured seamlessly over trousers
        createSkinnedGarmentMesh(legSkinnedMesh, appearance, {
          colorHex: shirtCol.getHex(),
          zTop: 0.0128,
          zBot: 0.0082,
          topRx: 0.00118,
          topRy: 0.00088,
          midRx: 0.00160,
          midRy: 0.00124,
          botRx: 0.00188,
          botRy: 0.00122,
          topCy: -0.00082,
          botCy: -0.00052,
          pleated: false,
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

    // Anatomical Chest & Waist Accents keyed accurately to measured GLB + full garment chest contours
    const bustFrontZ =
      medicalWear === 'lab_coat' || medicalWear === 'scrubs'
        ? isFemaleLook
          ? 0.197
          : 0.184
        : isFemaleLook
          ? 0.189
          : 0.176;
    const upperChestZ =
      medicalWear === 'lab_coat' || medicalWear === 'scrubs'
        ? isFemaleLook
          ? 0.160
          : 0.156
        : isFemaleLook
          ? 0.148
          : 0.146;
    const lowerChestZ =
      medicalWear === 'lab_coat' || medicalWear === 'scrubs'
        ? isFemaleLook
          ? 0.182
          : 0.178
        : isFemaleLook
          ? 0.168
          : 0.169;
    const collarZ =
      medicalWear === 'lab_coat' || medicalWear === 'scrubs'
        ? isFemaleLook
          ? 0.136
          : 0.132
        : isFemaleLook
          ? 0.120
          : 0.124;
    if (bones['Chest']) {
      if (showStethoscope) {
        const medAcc = new THREE.Group();
        medAcc.scale.setScalar(0.01);
        const tubeMat = makeLeatherMat(0x1b2536, appearance, 0.40);
        const chromeMat = makeMetalMat(0xdbe2ea, appearance, 0.20, 0.88);
        const badgeMat = sMats.badgeCard;
        const lanyardBlue = sMats.lanyardBlue;

        // Stethoscope draped smoothly around the neck and resting flush outside the chest contour
        const stethCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(-0.070, -0.055, lowerChestZ + 0.014),
          new THREE.Vector3(-0.068, 0.005, bustFrontZ + 0.004),
          new THREE.Vector3(-0.062, 0.080, upperChestZ + 0.004),
          new THREE.Vector3(-0.054, 0.132, 0.088),
          new THREE.Vector3(0, 0.146, -0.018),
          new THREE.Vector3(0.054, 0.132, 0.088),
          new THREE.Vector3(0.062, 0.080, upperChestZ + 0.004),
          new THREE.Vector3(0.068, 0.005, bustFrontZ + 0.004),
          new THREE.Vector3(0.062, -0.066, lowerChestZ + 0.014),
        ]);
        const stethTube = new THREE.Mesh(
          new THREE.TubeGeometry(stethCurve, 34, 0.0080, 10, false),
          tubeMat
        );
        const chestDiaphragm = new THREE.Mesh(
          new THREE.CylinderGeometry(0.023, 0.025, 0.012, 18),
          chromeMat
        );
        chestDiaphragm.rotation.x = Math.PI / 2 - 0.15;
        chestDiaphragm.position.set(0.062, -0.070, lowerChestZ + 0.019);
        const earTipL = new THREE.Mesh(new THREE.SphereGeometry(0.0095, 10, 8), chromeMat);
        earTipL.position.set(-0.070, -0.055, lowerChestZ + 0.014);

        // Printed THERASON ID Badge resting flush on upper-left pocket
        const badgeCard = new THREE.Mesh(sGeoms.badgeCard, badgeMat);
        badgeCard.userData.sharedGlbGeom = true;
        badgeCard.userData.sharedGlbMat = true;
        badgeCard.position.set(-0.082, -0.025, bustFrontZ + 0.002);
        badgeCard.rotation.set(isFemaleLook ? -0.10 : 0.0, -0.18, 0);
        const badgeClip = new THREE.Mesh(sGeoms.badgeClip, lanyardBlue);
        badgeClip.userData.sharedGlbGeom = true;
        badgeClip.userData.sharedGlbMat = true;
        badgeClip.position.set(-0.082, 0.004, bustFrontZ + 0.002);
        badgeClip.rotation.y = -0.18;

        // Clipped stainless clinical pen in opposite chest pocket
        const pocketPen = new THREE.Mesh(sGeoms.pocketPen, chromeMat);
        pocketPen.userData.sharedGlbGeom = true;
        pocketPen.position.set(0.078, -0.012, bustFrontZ + 0.003);
        pocketPen.rotation.z = -0.08;

        if (medicalWear === 'lab_coat') {
          const coatMat = makeClothMat(0xe7ecf2, appearance, 0.72, 0.36);
          const coatButtonMat = makeMetalMat(0xf8fafc, appearance, 0.20, 0.12);
          // Crisp buttoned medical lab coat collar, central closure placket, pockets & buttons
          const coatCollarCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(-0.048, 0.118, collarZ),
            new THREE.Vector3(-0.022, 0.068, upperChestZ + 0.010),
            new THREE.Vector3(0, 0.036, bustFrontZ + 0.006),
            new THREE.Vector3(0.022, 0.068, upperChestZ + 0.010),
            new THREE.Vector3(0.048, 0.118, collarZ),
          ]);
          const coatCollar = new THREE.Mesh(
            new THREE.TubeGeometry(coatCollarCurve, 18, 0.011, 8, false),
            coatMat
          );
          const placketCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, 0.036, bustFrontZ + 0.006),
            new THREE.Vector3(0, -0.030, bustFrontZ + 0.008),
            new THREE.Vector3(0, -0.140, lowerChestZ + 0.010),
          ]);
          const placket = new THREE.Mesh(
            new THREE.TubeGeometry(placketCurve, 14, 0.009, 6, false),
            coatMat
          );
          placket.scale.set(1.3, 1.0, 0.35);
          const pocketPatch = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.048, 0.007), coatMat);
          pocketPatch.position.set(0.078, -0.038, bustFrontZ + 0.004);
          pocketPatch.rotation.y = 0.16;
          medAcc.add(coatCollar, placket, pocketPatch);

          for (const [by, bz] of [
            [0.018, bustFrontZ + 0.009],
            [-0.045, bustFrontZ + 0.007],
            [-0.110, lowerChestZ + 0.012],
          ] as Array<[number, number]>) {
            const btn = new THREE.Mesh(sGeoms.buttonCyl, coatButtonMat);
            btn.userData.sharedGlbGeom = true;
            btn.rotation.x = Math.PI / 2;
            btn.position.set(0, by, bz);
            medAcc.add(btn);
          }

          if (bones['Hips']) {
            const coatPockets = new THREE.Group();
            coatPockets.scale.setScalar(0.01);
            for (const side of [-1, 1]) {
              const cp = new THREE.Mesh(new THREE.BoxGeometry(0.066, 0.074, 0.007), coatMat);
              cp.position.set(side * 0.094, -0.045, isFemaleLook ? 0.168 : 0.164);
              cp.rotation.y = side * 0.36;
              coatPockets.add(cp);
            }
            bones['Hips'].bone.add(coatPockets);
          }
        } else if (medicalWear === 'scrubs') {
          const trimHex = shirtCol.clone().lerp(new THREE.Color(0xffffff), 0.16).getHex();
          const trimMat = makeClothMat(trimHex, appearance, 0.76, 0.45);
          const vTrimCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(-0.046, 0.116, collarZ + 0.004),
            new THREE.Vector3(-0.024, 0.062, upperChestZ + 0.008),
            new THREE.Vector3(0, 0.026, bustFrontZ + 0.006),
            new THREE.Vector3(0.024, 0.062, upperChestZ + 0.008),
            new THREE.Vector3(0.046, 0.116, collarZ + 0.004),
          ]);
          const vNeckTrim = new THREE.Mesh(
            new THREE.TubeGeometry(vTrimCurve, 18, 0.009, 8, false),
            trimMat
          );
          const scrubPocket = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.046, 0.007), trimMat);
          scrubPocket.position.set(0.078, -0.036, bustFrontZ + 0.004);
          scrubPocket.rotation.y = 0.16;
          medAcc.add(vNeckTrim, scrubPocket);

          if (bones['Hips']) {
            // Double tailored lower hip scrub pockets seated flush on the contoured tunic
            const hipPockets = new THREE.Group();
            hipPockets.scale.setScalar(0.01);
            const hpMat = makeClothMat(trimHex, appearance, 0.76, 0.45);
            for (const side of [-1, 1]) {
              const hp = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.068, 0.007), hpMat);
              hp.position.set(side * 0.088, -0.025, isFemaleLook ? 0.164 : 0.160);
              hp.rotation.y = side * 0.36;
              hipPockets.add(hp);
            }
            bones['Hips'].bone.add(hipPockets);
          }
        }

        medAcc.add(stethTube, chestDiaphragm, earTipL, badgeCard, badgeClip, pocketPen);
        bones['Chest'].bone.add(medAcc);
      } else if (
        (appearance.isPlayer && outfitStyle === 'casual') ||
        (!appearance.isStaff &&
          !isFemaleLook &&
          outfitStyle === 'casual' &&
          medicalWear === 'none' &&
          appearance.shirtStyle === 'shirt')
      ) {
        // Tailored contoured shirt collar + central button placket flush outside male/female chest
        const shirtGrp = new THREE.Group();
        shirtGrp.scale.setScalar(0.01);
        const collarMat = makeClothMat(
          shirtCol.clone().lerp(new THREE.Color(0xffffff), 0.16).getHex(),
          appearance,
          0.74,
          0.45
        );
        const buttonMat = makeMetalMat(0xf8fafc, appearance, 0.22, 0.15);
        const collarCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(-0.046, 0.125, collarZ - 0.004),
          new THREE.Vector3(-0.024, 0.090, upperChestZ + 0.002),
          new THREE.Vector3(0, 0.068, upperChestZ + 0.012),
          new THREE.Vector3(0.024, 0.090, upperChestZ + 0.002),
          new THREE.Vector3(0.046, 0.125, collarZ - 0.004),
        ]);
        const collarMesh = new THREE.Mesh(new THREE.TubeGeometry(collarCurve, 18, 0.011, 8, false), collarMat);
        const placketCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0.068, upperChestZ + 0.012),
          new THREE.Vector3(0, -0.018, bustFrontZ - 0.004),
          new THREE.Vector3(0, -0.145, lowerChestZ + 0.002),
        ]);
        const placket = new THREE.Mesh(new THREE.TubeGeometry(placketCurve, 14, 0.0095, 6, false), collarMat);
        placket.scale.set(1.25, 1.0, 0.35);
        shirtGrp.add(collarMesh, placket);
        for (const [by, bz] of [
          [0.052, upperChestZ + 0.016],
          [0.002, bustFrontZ - 0.001],
          [-0.055, lowerChestZ + 0.006],
          [-0.115, lowerChestZ + 0.004],
        ] as Array<[number, number]>) {
          const btn = new THREE.Mesh(sGeoms.buttonCyl, buttonMat);
          btn.userData.sharedGlbGeom = true;
          btn.rotation.x = Math.PI / 2;
          btn.position.set(0, by, bz);
          shirtGrp.add(btn);
        }
        bones['Chest'].bone.add(shirtGrp);

        if (bones['Hips']) {
          const beltGrp = new THREE.Group();
          beltGrp.scale.setScalar(0.01);
          const beltLeather = makeLeatherMat(0x221b17, appearance, 0.38);
          const buckleMetal = makeMetalMat(0xd4d4d8, appearance, 0.22, 0.88);
          const beltBand = new THREE.Mesh(sGeoms.beltStrap, beltLeather);
          beltBand.userData.sharedGlbGeom = true;
          beltBand.scale.set(1.02, 1.0, 0.80);
          beltBand.position.set(0, 0.072, 0.062);
          const buckle = new THREE.Mesh(sGeoms.beltBuckle, buckleMetal);
          buckle.userData.sharedGlbGeom = true;
          buckle.position.set(0, 0.072, 0.184);
          beltGrp.add(beltBand, buckle);
          bones['Hips'].bone.add(beltGrp);
        }
      } else if (appearance.isPlayer && outfitStyle === 'abaya_open') {
        // Contoured draped open-abaya front panels framing the ivory inner blouse
        const openTrimGrp = new THREE.Group();
        openTrimGrp.scale.setScalar(0.01);
        const trimMat = makeClothMat(
          shirtCol.clone().multiplyScalar(0.86).getHex(),
          appearance,
          0.80,
          0.55
        );
        for (const side of [-1, 1]) {
          const panelCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(side * 0.044, 0.114, collarZ + 0.004),
            new THREE.Vector3(side * 0.050, 0.015, bustFrontZ + 0.004),
            new THREE.Vector3(side * 0.046, -0.120, lowerChestZ + 0.006),
          ]);
          const panelMesh = new THREE.Mesh(
            new THREE.TubeGeometry(panelCurve, 16, 0.015, 8, false),
            trimMat
          );
          panelMesh.scale.set(1.3, 1.0, 0.42);
          openTrimGrp.add(panelMesh);
        }
        bones['Chest'].bone.add(openTrimGrp);
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
        } else if (outfitStyle === 'abaya' && !appearance.hasNiqab && (appearance.variantSeed || 0) % 2 === 0) {
          const abayaTrimGrp = new THREE.Group();
          abayaTrimGrp.scale.setScalar(0.01);
          const embMat = makeMetalMat(0xc59b57, appearance, 0.42, 0.55);
          const trimStrip = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.24, 0.016), embMat);
          trimStrip.position.set(0, 0.01, 0.124);
          abayaTrimGrp.add(trimStrip);
          bones['Chest'].bone.add(abayaTrimGrp);
        } else if (outfitStyle === 'sudanese_thobe') {
          // Authentic Sudanese Thobe upper-body wrap: soft torso wrap + diagonal chest-to-left-shoulder sweep + Kenar border + draped tail
          const thobeChestGrp = new THREE.Group();
          thobeChestGrp.scale.setScalar(0.01);
          const thobeMat = makeClothMat(shirtCol.getHex(), appearance, 0.78, 0.74, true);
          const kenarMat = makeClothMat(thobeKenarHex, appearance, 0.72, 0.55, true);

          // Main wrapped torso cloth rising higher on the left (+X) side while revealing modest inner right sleeve/collar (-X)
          const torsoWrap = new THREE.Mesh(
            new THREE.CylinderGeometry(0.132, 0.172, 0.24, 28),
            thobeMat
          );
          torsoWrap.scale.set(1.07, 1.0, 0.80);
          torsoWrap.position.set(0.004, 0.016, 0.016);
          torsoWrap.rotation.z = -0.09;
          torsoWrap.castShadow = true;

          // Diagonal front chest fold sweeping from right waist (-X) up across chest to left shoulder (+X)
          const diagCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(-0.124, -0.072, 0.070),
            new THREE.Vector3(-0.042, -0.008, 0.126),
            new THREE.Vector3(0.044, 0.072, 0.118),
            new THREE.Vector3(0.096, 0.152, 0.046),
            new THREE.Vector3(0.090, 0.132, -0.062),
          ]);
          const diagFold = new THREE.Mesh(
            new THREE.TubeGeometry(diagCurve, 26, 0.042, 12, false),
            thobeMat
          );
          diagFold.castShadow = true;

          // Woven Kenar border edging along the upper diagonal chest fold
          const kenarCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(-0.122, -0.056, 0.078),
            new THREE.Vector3(-0.040, 0.012, 0.134),
            new THREE.Vector3(0.046, 0.092, 0.124),
            new THREE.Vector3(0.098, 0.165, 0.050),
            new THREE.Vector3(0.092, 0.145, -0.060),
          ]);
          const kenarRibbon = new THREE.Mesh(
            new THREE.TubeGeometry(kenarCurve, 24, 0.011, 10, false),
            kenarMat
          );

          // Front-left shoulder fold bridging head drape and chest wrap
          const frontShoulderFold = new THREE.Mesh(
            new THREE.CylinderGeometry(0.046, 0.066, 0.19, 18),
            thobeMat
          );
          frontShoulderFold.scale.set(1.02, 1.0, 0.56);
          frontShoulderFold.position.set(0.098, 0.048, 0.068);
          frontShoulderFold.rotation.z = 0.14;

          // Trailing left-shoulder Thobe tail hanging gracefully down the upper-left back (+X, -Z)
          const backTailDrape = new THREE.Mesh(
            new THREE.CylinderGeometry(0.056, 0.084, 0.25, 18),
            thobeMat
          );
          backTailDrape.scale.set(1.06, 1.0, 0.46);
          backTailDrape.position.set(0.094, 0.012, -0.084);
          backTailDrape.rotation.x = 0.16;
          backTailDrape.rotation.z = 0.10;
          backTailDrape.castShadow = true;

          // Kenar woven hem band at the bottom tip of the hanging shoulder tail
          const tailKenarHem = new THREE.Mesh(
            new THREE.CylinderGeometry(0.080, 0.086, 0.026, 18),
            kenarMat
          );
          tailKenarHem.scale.set(1.06, 1.0, 0.46);
          tailKenarHem.position.set(0.106, -0.104, -0.102);
          tailKenarHem.rotation.x = 0.16;
          tailKenarHem.rotation.z = 0.10;

          thobeChestGrp.add(
            torsoWrap,
            diagFold,
            kenarRibbon,
            frontShoulderFold,
            backTailDrape,
            tailKenarHem
          );
          bones['Chest'].bone.add(thobeChestGrp);
        }
      }
    }

    // Subtle wristwatch on clinicians and select adult patients
    if (
      bones['LowerArmL'] &&
      (showStethoscope || appearance.isStaff || (!isFemaleLook && Math.abs(appearance.variantSeed || 0) % 3 === 1))
    ) {
      const watchGrp = new THREE.Group();
      watchGrp.scale.setScalar(0.01);
      const strap = new THREE.Mesh(
        sGeoms.watchStrap,
        makeLeatherMat(showStethoscope || appearance.isStaff ? 0x1e293b : 0x3a2618, appearance, 0.44)
      );
      strap.userData.sharedGlbGeom = true;
      strap.rotation.x = Math.PI / 2;
      strap.position.set(0, 0.215, 0);
      const watchFace = new THREE.Mesh(
        sGeoms.watchFace,
        makeMetalMat(0xe2e8f0, appearance, 0.25, 0.85)
      );
      watchFace.userData.sharedGlbGeom = true;
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

    let blinkLids: [THREE.Mesh, THREE.Mesh] | undefined;
    let mouthLower: THREE.Mesh | undefined;
    let mouthSeam: THREE.Mesh | undefined;

    // Realistic Human Facial Anatomy + Authentic Headwear, Tarha & Contoured 3D Niqab
    if (bones['Head']) {
      // 1) Lifelike 3D Human Facial Features aligned to exact GLB face-surface Z (~0.150..0.177)
      {
        const faceGrp = new THREE.Group();
        faceGrp.scale.setScalar(0.01);
        const eyeX = isFemaleLook ? 0.0462 : 0.0443;
        const eyeY = isFemaleLook ? 0.1004 : 0.1082;
        const eyeZ = isFemaleLook ? 0.1450 : 0.1438;

        const scleraMat = sMats.sclera;
        const irisMat = sMats.iris;
        const catchlightMat = sMats.catchlight;
        const browMat = new THREE.MeshStandardMaterial({
          color: hairCol.getHex(),
          bumpMap: getHairStrandBump(),
          bumpScale: 0.0022,
          roughness: 0.68,
          metalness: 0.0,
        });
        const lidMat = colorMat(skinCol.clone().multiplyScalar(0.80).getHex(), 0.54, 0.0);
        const lowerLidMat = colorMat(skinCol.clone().multiplyScalar(0.86).getHex(), 0.56, 0.0);
        const blinkSkinMat = colorMat(skinCol.clone().multiplyScalar(0.90).getHex(), 0.54, 0.0);
        const lashMat = sMats.lash;
        const lidList: THREE.Mesh[] = [];

        for (const side of [-1, 1]) {
          // Sclera orb nested softly into eye orbit
          const sclera = new THREE.Mesh(sGeoms.sclera, scleraMat);
          sclera.userData.sharedGlbGeom = true;
          sclera.userData.sharedGlbMat = true;
          sclera.scale.set(0.98, 0.74, 0.76);
          sclera.position.set(side * eyeX, eyeY, eyeZ);

          // Procedural hazel-brown radial iris + corneal clearcoat + crisp catchlight
          const iris = new THREE.Mesh(sGeoms.iris, irisMat);
          iris.userData.sharedGlbGeom = true;
          iris.userData.sharedGlbMat = true;
          iris.position.set(side * eyeX, eyeY, eyeZ + 0.0106);

          const catchlight = new THREE.Mesh(sGeoms.catchlight, catchlightMat);
          catchlight.userData.sharedGlbGeom = true;
          catchlight.userData.sharedGlbMat = true;
          catchlight.position.set(side * eyeX + 0.0021, eyeY + 0.0021, eyeZ + 0.0110);

          // Upper & lower eyelid contours + natural lash rim + blink cap
          const upperLid = new THREE.Mesh(sGeoms.upperLid, lidMat);
          upperLid.userData.sharedGlbGeom = true;
          upperLid.position.set(side * eyeX, eyeY + 0.0020, eyeZ + 0.0066);
          upperLid.rotation.set(0.22, 0, Math.PI * 0.04);

          const lowerLid = new THREE.Mesh(sGeoms.lowerLid, lowerLidMat);
          lowerLid.userData.sharedGlbGeom = true;
          lowerLid.position.set(side * eyeX, eyeY - 0.0046, eyeZ + 0.0062);
          lowerLid.rotation.set(Math.PI - 0.24, 0, Math.PI * 0.04);

          const blinkLid = new THREE.Mesh(sGeoms.blinkLid, blinkSkinMat);
          blinkLid.userData.sharedGlbGeom = true;
          blinkLid.scale.set(1.06, 0.80, 0.82);
          blinkLid.position.set(side * eyeX, eyeY, eyeZ + 0.0005);
          blinkLid.rotation.set(-0.98, 0, 0);
          lidList.push(blinkLid);

          const lashRim = new THREE.Mesh(
            isFemaleLook ? sGeoms.lashFemale : sGeoms.lashMale,
            lashMat
          );
          lashRim.userData.sharedGlbGeom = true;
          lashRim.userData.sharedGlbMat = true;
          lashRim.position.set(side * eyeX, eyeY + 0.0008, eyeZ + 0.0086);
          lashRim.rotation.set(0.18, 0, Math.PI * 0.06);

          const browGeom = isFemaleLook
            ? side === -1
              ? sGeoms.browFemaleL
              : sGeoms.browFemaleR
            : side === -1
              ? sGeoms.browMaleL
              : sGeoms.browMaleR;
          const browMesh = new THREE.Mesh(browGeom, browMat);
          browMesh.userData.sharedGlbGeom = true;
          browMesh.scale.set(1.0, 0.72, 0.65);

          faceGrp.add(sclera, iris, catchlight, upperLid, lowerLid, blinkLid, lashRim, browMesh);
        }
        if (lidList.length === 2) {
          blinkLids = [lidList[0], lidList[1]];
        }

        // Subtle nostril shadows under nose tip (nose tip is at z=0.177)
        const nostrilMat = colorMat(skinCol.clone().multiplyScalar(0.68).getHex(), 0.70, 0.0);
        const nostrilY = isFemaleLook ? 0.0425 : 0.0470;
        const nostrilZ = isFemaleLook ? 0.1630 : 0.1620;
        for (const side of [-1, 1]) {
          const nostril = new THREE.Mesh(sGeoms.nostril, nostrilMat);
          nostril.userData.sharedGlbGeom = true;
          nostril.scale.set(1.05, 0.62, 0.70);
          nostril.position.set(side * 0.0078, nostrilY, nostrilZ);
          faceGrp.add(nostril);
        }

        // Sculpted natural lips aligned flush on mouthFaceZ (z=0.1545..0.1566)
        const lipHex = skinCol
          .clone()
          .lerp(new THREE.Color(isFemaleLook ? 0x82443a : 0x6f3f34), isFemaleLook ? 0.50 : 0.36)
          .getHex();
        const lipMat = colorMat(lipHex, isFemaleLook ? 0.38 : 0.48, 0.0);
        const seamMat = colorMat(skinCol.clone().multiplyScalar(0.55).getHex(), 0.65, 0.0);
        const mouthY = isFemaleLook ? 0.0172 : 0.0252;
        const mouthZ = isFemaleLook ? 0.1552 : 0.1566;
        const upperLipCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(-0.018, mouthY + 0.0008, mouthZ - 0.006),
          new THREE.Vector3(-0.007, mouthY + 0.0040, mouthZ + 0.0018),
          new THREE.Vector3(0, mouthY + 0.0026, mouthZ + 0.0024),
          new THREE.Vector3(0.007, mouthY + 0.0040, mouthZ + 0.0018),
          new THREE.Vector3(0.018, mouthY + 0.0008, mouthZ - 0.006),
        ]);
        const upperLip = new THREE.Mesh(new THREE.TubeGeometry(upperLipCurve, 14, 0.0035, 8, false), lipMat);
        upperLip.scale.set(1.0, 0.76, 0.80);

        const lowerLipCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(-0.015, mouthY - 0.0005, mouthZ - 0.005),
          new THREE.Vector3(0, mouthY - 0.0042, mouthZ + 0.0026),
          new THREE.Vector3(0.015, mouthY - 0.0005, mouthZ - 0.005),
        ]);
        const lowerLip = new THREE.Mesh(
          new THREE.TubeGeometry(lowerLipCurve, 12, isFemaleLook ? 0.0043 : 0.0040, 8, false),
          lipMat
        );
        lowerLip.scale.set(1.0, 0.78, 0.82);

        const mouthSeamMesh = new THREE.Mesh(
          new THREE.TubeGeometry(
            new THREE.CatmullRomCurve3([
              new THREE.Vector3(-0.017, mouthY + 0.0004, mouthZ - 0.005),
              new THREE.Vector3(0, mouthY - 0.0004, mouthZ + 0.0030),
              new THREE.Vector3(0.017, mouthY + 0.0004, mouthZ - 0.005),
            ]),
            12,
            0.0010,
            6,
            false
          ),
          seamMat
        );
        mouthLower = lowerLip;
        mouthSeam = mouthSeamMesh;

        faceGrp.add(upperLip, lowerLip, mouthSeamMesh);
        bones['Head'].bone.add(faceGrp);
      }

      if (outfitStyle === 'jalabiya' && !isFemaleLook && !appearance.isStaff) {
        const headAcc = new THREE.Group();
        headAcc.scale.setScalar(0.01);
        const whiteCloth = makeClothMat(0xf4f2ec, appearance, 0.82, 0.45);

        if (appearance.hasTurban) {
          for (const [ty, rad, tubeR, tiltX, tiltY] of [
            [0.190, 0.132, 0.030, 0.08, 0.09],
            [0.216, 0.128, 0.029, -0.06, -0.08],
            [0.240, 0.124, 0.028, 0.06, 0.06],
            [0.262, 0.116, 0.026, -0.05, -0.05],
            [0.281, 0.104, 0.022, 0.03, 0.04],
          ] as Array<[number, number, number, number, number]>) {
            const wrap = new THREE.Mesh(new THREE.TorusGeometry(rad, tubeR, 18, 36), whiteCloth);
            wrap.rotation.x = Math.PI / 2 + tiltX;
            wrap.rotation.y = tiltY;
            wrap.position.set(0, ty, 0.042);
            wrap.castShadow = true;
            headAcc.add(wrap);
          }
          const crown = new THREE.Mesh(
            new THREE.SphereGeometry(0.120, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55),
            whiteCloth
          );
          crown.position.set(0, 0.244, 0.042);
          const emmaTail = new THREE.Mesh(
            new THREE.CylinderGeometry(0.026, 0.038, 0.13, 16),
            whiteCloth
          );
          emmaTail.position.set(-0.075, 0.125, -0.048);
          emmaTail.rotation.z = -0.18;
          emmaTail.rotation.x = 0.22;
          headAcc.add(crown, emmaTail);
        } else {
          const taqMat = makeClothMat(0xede9df, appearance, 0.82, 0.35);
          const brimStitchMat = makeClothMat(0xcabfa8, appearance, 0.78, 0.2);
          const capSide = new THREE.Mesh(
            new THREE.CylinderGeometry(0.120, 0.124, 0.062, 28),
            taqMat
          );
          capSide.position.set(0, 0.212, 0.042);
          const capRim = new THREE.Mesh(new THREE.TorusGeometry(0.123, 0.007, 12, 32), brimStitchMat);
          capRim.rotation.x = Math.PI / 2;
          capRim.position.set(0, 0.184, 0.042);
          const capTop = new THREE.Mesh(
            new THREE.SphereGeometry(0.120, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.5),
            taqMat
          );
          capTop.position.set(0, 0.242, 0.042);
          headAcc.add(capSide, capRim, capTop);
        }
        bones['Head'].bone.add(headAcc);
      } else if (isFemaleLook && effectiveHijab) {
        if (outfitStyle === 'sudanese_thobe') {
          const thobeHeadMat = makeClothMat(tarhaCol.getHex(), appearance, 0.78, 0.74, true);
          const kenarHeadMat = makeClothMat(thobeKenarHex, appearance, 0.72, 0.55, true);
          const thobeHeadGrp = new THREE.Group();
          thobeHeadGrp.scale.setScalar(0.01);

          // Upper/back head wrap staying behind eye plane (max Z ~ 0.136) while covering crown & temples
          const thobeHood = new THREE.Mesh(new THREE.SphereGeometry(0.118, 28, 20), thobeHeadMat);
          thobeHood.scale.set(1.04, 1.06, 1.04);
          thobeHood.position.set(0, 0.122, 0.014);
          thobeHood.castShadow = true;

          const browCloth = new THREE.Mesh(
            new THREE.TorusGeometry(0.106, 0.016, 14, 28, Math.PI * 1.15),
            thobeHeadMat
          );
          browCloth.rotation.set(0.32, 0, -Math.PI * 0.075);
          browCloth.position.set(0, 0.146, 0.056);

          const browKenar = new THREE.Mesh(
            new THREE.TorusGeometry(0.104, 0.0085, 12, 28, Math.PI * 1.12),
            kenarHeadMat
          );
          browKenar.rotation.set(0.34, 0, -Math.PI * 0.06);
          browKenar.position.set(0, 0.142, 0.064);

          const neckVeil = new THREE.Mesh(
            new THREE.CylinderGeometry(0.094, 0.138, 0.165, 26),
            thobeHeadMat
          );
          neckVeil.position.set(0, -0.012, 0.036);

          const leftSideDrape = new THREE.Mesh(
            new THREE.CylinderGeometry(0.056, 0.088, 0.24, 18),
            thobeHeadMat
          );
          leftSideDrape.scale.set(0.95, 1.0, 0.72);
          leftSideDrape.position.set(0.068, 0.005, 0.044);
          leftSideDrape.rotation.z = 0.22;

          const rearDrape = new THREE.Mesh(
            new THREE.CylinderGeometry(0.108, 0.146, 0.24, 22, 1, false, Math.PI * 0.52, Math.PI * 0.96),
            thobeHeadMat
          );
          rearDrape.position.set(0, -0.044, -0.008);

          thobeHeadGrp.add(thobeHood, browCloth, browKenar, neckVeil, leftSideDrape, rearDrape);
          bones['Head'].bone.add(thobeHeadGrp);
        } else {
          // 1) Tailored Modest Tarha (Hijab) with U-shaped Open Face Window:
          // Forehead (below y=0.148), eyebrows (0.117), eyes (0.100), nose, cheeks, and lips (0.017) stay 100% visible & framed cleanly!
          const tarhaMat = makeClothMat(tarhaCol.getHex(), appearance, 0.84, 0.60, true);
          const undercapMat = makeClothMat(tarhaUnderCapCol.getHex(), appearance, 0.86, 0.42, true);
          const scarfGrp = new THREE.Group();
          scarfGrp.scale.setScalar(0.01);

          // Custom lofted U-framed outer Tarha wrap covering crown, back, bun, temples, cheeks outer edge, chin bottom, & neck
          const tRows = 22;
          const tCols = 32;
          const tPos: number[] = [];
          const tUvs: number[] = [];
          const tIdx: number[] = [];
          const headCz = 0.048;

          const tarhaOpenAng = (y: number) => {
            if (y >= 0.148 || y <= -0.028) return 0;
            if (y > 0.122) {
              const t = (0.148 - y) / 0.026;
              return 0.88 * Math.sin(t * Math.PI * 0.5);
            }
            if (y < 0.004) {
              const t = (y + 0.028) / 0.032;
              return 0.88 * Math.sin(t * Math.PI * 0.5);
            }
            return 0.88;
          };

          for (let r = 0; r <= tRows; r++) {
            const v = r / tRows; // 0 = crown apex (y=0.236), 1 = lower neck base (y=-0.105)
            const y = THREE.MathUtils.lerp(0.236, -0.105, v);
            let rx: number;
            let rz: number;
            let zShift = 0;
            if (y >= 0.148) {
              // Smooth cranial dome rounding cleanly from closed apex to top forehead hairline
              const capT = THREE.MathUtils.clamp((0.236 - y) / (0.236 - 0.148), 0, 1);
              const domeSin = Math.sin(capT * Math.PI * 0.5);
              rx = THREE.MathUtils.lerp(0.002, 0.114, domeSin);
              rz = THREE.MathUtils.lerp(0.002, 0.122, domeSin);
            } else if (y >= -0.028) {
              // Temple/cheek/jaw frame
              const faceT = (0.148 - y) / (0.148 + 0.028);
              rx = THREE.MathUtils.lerp(0.114, 0.100, faceT);
              rz = THREE.MathUtils.lerp(0.122, 0.104, faceT);
              zShift = -0.004 * faceT;
            } else {
              // Draped neck collar widening smoothly to upper shoulders
              const neckT = (y + 0.028) / (-0.105 + 0.028);
              rx = THREE.MathUtils.lerp(0.096, 0.126, neckT);
              rz = THREE.MathUtils.lerp(0.098, 0.112, neckT);
              zShift = -0.008;
            }

            const openA = tarhaOpenAng(y);
            const thetaStart = openA; // +X cheek rim (right front edge)
            const thetaSpan = (Math.PI - openA) * 2; // wraps smoothly around +X -> back -> -X cheek rim

            for (let c = 0; c <= tCols; c++) {
              const u = c / tCols;
              const theta = thetaStart + u * thetaSpan;
              // Soft hijab bun fullness at back center (theta ~ PI, y ~ 0.06..0.15)
              const backFactor = Math.max(0, -Math.cos(theta));
              const bunHFactor = Math.exp(-Math.pow((y - 0.10) / 0.075, 2));
              const bunBulge = 0.028 * backFactor * bunHFactor;
              const foldWave = Math.sin(u * Math.PI * 8 + v * 2.2) * 0.0022 * (y < 0.0 ? 1.4 : 0.6);

              const x = (rx + foldWave) * Math.sin(theta);
              const z = headCz + zShift + (rz + bunBulge + foldWave) * Math.cos(theta);
              tPos.push(x, y, z);
              tUvs.push(u, 1 - v);
            }
          }
          for (let r = 0; r < tRows; r++) {
            for (let c = 0; c < tCols; c++) {
              const a = r * (tCols + 1) + c;
              const b = a + (tCols + 1);
              tIdx.push(a, b, a + 1, b, b + 1, a + 1);
            }
          }
          const tarhaGeom = new THREE.BufferGeometry();
          tarhaGeom.setAttribute('position', new THREE.Float32BufferAttribute(tPos, 3));
          tarhaGeom.setAttribute('uv', new THREE.Float32BufferAttribute(tUvs, 2));
          tarhaGeom.setIndex(tIdx);
          tarhaGeom.computeVertexNormals();
          const tarhaWrapMesh = new THREE.Mesh(tarhaGeom, tarhaMat);
          tarhaWrapMesh.castShadow = true;

          // Flowing rear Tarha veil down the back behind shoulders
          const backTail = new THREE.Mesh(
            new THREE.CylinderGeometry(0.098, 0.132, 0.21, 20, 1, true, Math.PI * 0.56, Math.PI * 0.88),
            tarhaMat
          );
          backTail.position.set(0, -0.056, -0.004);
          scarfGrp.add(tarhaWrapMesh, backTail);

          if (!appearance.hasNiqab) {
            // Sleek matte inner undercap band visible only along the top forehead rim (y=0.138..0.166)
            const underCapRim = new THREE.Mesh(
              new THREE.CylinderGeometry(0.104, 0.110, 0.028, 28, 1, true, -Math.PI * 0.36, Math.PI * 0.72),
              undercapMat
            );
            underCapRim.scale.set(0.98, 1.0, 1.06);
            underCapRim.position.set(0, 0.154, headCz + 0.006);
            scarfGrp.add(underCapRim);
          }

          // 2) Contoured 3-Part 3D Niqab (ONLY when appearance.hasNiqab === true):
          // Wraps forehead down to just above eyes (y=0.118), leaves crisp horizontal eye-slit, and drapes face veil from y=0.086 down to chest
          if (appearance.hasNiqab) {
            const niqabMat = makeClothMat(0x131418, appearance, 0.86, 0.52, true);

            // Forehead Niqab Band hugging forehead & temples cleanly above upper eyelids (y=0.118..0.168, front z~0.174)
            const fbRows = 5;
            const fbCols = 22;
            const fbPos: number[] = [];
            const fbUvs: number[] = [];
            const fbIdx: number[] = [];
            for (let r = 0; r <= fbRows; r++) {
              const v = r / fbRows;
              const y = THREE.MathUtils.lerp(0.168, 0.118, v);
              for (let c = 0; c <= fbCols; c++) {
                const u = c / fbCols;
                const ang = THREE.MathUtils.lerp(-Math.PI * 0.56, Math.PI * 0.56, u);
                fbPos.push(0.116 * Math.sin(ang), y, headCz + 0.125 * Math.cos(ang));
                fbUvs.push(u, 1 - v);
              }
            }
            for (let r = 0; r < fbRows; r++) {
              for (let c = 0; c < fbCols; c++) {
                const a = r * (fbCols + 1) + c;
                const b = a + (fbCols + 1);
                fbIdx.push(a, b, a + 1, b, b + 1, a + 1);
              }
            }
            const fbGeom = new THREE.BufferGeometry();
            fbGeom.setAttribute('position', new THREE.Float32BufferAttribute(fbPos, 3));
            fbGeom.setAttribute('uv', new THREE.Float32BufferAttribute(fbUvs, 2));
            fbGeom.setIndex(fbIdx);
            fbGeom.computeVertexNormals();
            const foreheadBand = new THREE.Mesh(fbGeom, niqabMat);
            foreheadBand.castShadow = true;

            // Contoured Lower Face Veil (y=-0.075..0.088) curving smoothly over nose tip (z=0.186) & chin down to chest
            const veilRows = 12;
            const veilCols = 24;
            const vPos: number[] = [];
            const vUvs: number[] = [];
            const vIdx: number[] = [];
            for (let r = 0; r <= veilRows; r++) {
              const v = r / veilRows;
              const vy = THREE.MathUtils.lerp(0.088, -0.075, v);
              const noseBulge = Math.exp(-Math.pow((v - 0.22) / 0.20, 2)) * 0.016;
              const rx = THREE.MathUtils.lerp(0.108, 0.128, v);
              const rz = THREE.MathUtils.lerp(0.118, 0.124, v) + noseBulge;
              for (let c = 0; c <= veilCols; c++) {
                const u = c / veilCols;
                const ang = THREE.MathUtils.lerp(-Math.PI * 0.52, Math.PI * 0.52, u);
                const centerPin = Math.cos(ang * 2.0) * 0.005 * (1 - v);
                const drapeWave = Math.sin(u * Math.PI * 7) * 0.0022 * v;
                const vx = rx * Math.sin(ang);
                const vz = headCz + (rz + centerPin + drapeWave) * Math.cos(ang * 0.85);
                vPos.push(vx, vy, vz);
                vUvs.push(u, 1 - v);
              }
            }
            for (let r = 0; r < veilRows; r++) {
              for (let c = 0; c < veilCols; c++) {
                const a = r * (veilCols + 1) + c;
                const b = a + (veilCols + 1);
                vIdx.push(a, b, a + 1, b, b + 1, a + 1);
              }
            }
            const veilGeom = new THREE.BufferGeometry();
            veilGeom.setAttribute('position', new THREE.Float32BufferAttribute(vPos, 3));
            veilGeom.setAttribute('uv', new THREE.Float32BufferAttribute(vUvs, 2));
            veilGeom.setIndex(vIdx);
            veilGeom.computeVertexNormals();
            const faceVeil = new THREE.Mesh(veilGeom, niqabMat);
            faceVeil.castShadow = true;

            // Slim nose-bridge divider between left and right eye openings
            const bridgeCurve = new THREE.CatmullRomCurve3([
              new THREE.Vector3(0, 0.122, 0.172),
              new THREE.Vector3(0, 0.102, 0.168),
              new THREE.Vector3(0, 0.086, 0.173),
            ]);
            const noseBridgeStrap = new THREE.Mesh(
              new THREE.TubeGeometry(bridgeCurve, 8, 0.0065, 6, false),
              niqabMat
            );
            noseBridgeStrap.scale.set(1.0, 1.0, 0.42);

            scarfGrp.add(foreheadBand, faceVeil, noseBridgeStrap);
          }

          bones['Head'].bone.add(scarfGrp);

          if (bones['Chest']) {
            const chestDrape = new THREE.Group();
            chestDrape.scale.setScalar(0.01);

            if (appearance.hasNiqab) {
              // Continuous flowing black Khimar / Niqab front drape over collarbones & upper chest
              const niqabChestMat = makeClothMat(0x131418, appearance, 0.86, 0.52, true);
              const khimarShawl = new THREE.Mesh(
                new THREE.CylinderGeometry(0.112, 0.168, 0.24, 28, 1, false),
                niqabChestMat
              );
              khimarShawl.scale.set(1.02, 1.0, 0.94);
              khimarShawl.position.set(0, 0.020, 0.056);
              chestDrape.add(khimarShawl);
            } else {
              // Clean low collarbone collar + graceful side shoulder drape (stays tight to shoulders so outfit & stethoscope show clearly!)
              const collarBase = new THREE.Mesh(
                new THREE.CylinderGeometry(0.092, 0.122, 0.090, 24),
                tarhaMat
              );
              collarBase.scale.set(1.02, 1.0, 0.86);
              collarBase.position.set(0, 0.105, 0.044);

              const throwCurve = new THREE.CatmullRomCurve3([
                new THREE.Vector3(-0.072, 0.128, 0.082),
                new THREE.Vector3(-0.084, 0.068, 0.138),
                new THREE.Vector3(-0.088, -0.015, 0.186),
                new THREE.Vector3(-0.072, -0.095, 0.168),
              ]);
              const shoulderThrow = new THREE.Mesh(
                new THREE.TubeGeometry(throwCurve, 18, 0.028, 10, false),
                tarhaMat
              );
              shoulderThrow.scale.set(1.25, 1.0, 0.48);
              chestDrape.add(collarBase, shoulderThrow);
            }

            bones['Chest'].bone.add(chestDrape);
          }
        }
      }

      // Sculpted 3D beard for bearded adult men
      if (appearance.hasBeard && !isFemaleLook) {
        const beardGrp = new THREE.Group();
        beardGrp.scale.setScalar(0.01);
        const beardMat = new THREE.MeshStandardMaterial({
          color: hairCol.getHex(),
          bumpMap: getHairStrandBump(),
          bumpScale: 0.0026,
          roughness: 0.82,
          metalness: 0.0,
        });
        const chinBeard = new THREE.Mesh(new THREE.SphereGeometry(0.048, 14, 12), beardMat);
        chinBeard.scale.set(1.0, 0.88, 0.80);
        chinBeard.position.set(0, 0.008, 0.115);
        const jawBeard = new THREE.Mesh(
          new THREE.CylinderGeometry(0.082, 0.066, 0.044, 16, 1, false, -Math.PI * 0.42, Math.PI * 0.84),
          beardMat
        );
        jawBeard.position.set(0, 0.032, 0.078);
        beardGrp.add(chinBeard, jawBeard);
        bones['Head'].bone.add(beardGrp);
      }

      // Slim optical eyeglasses on ~25% of patients for crisp life-like variety
      if (!appearance.isStaff && !appearance.isPlayer && Math.abs(appearance.variantSeed || 0) % 4 === 0) {
        const glassGrp = new THREE.Group();
        glassGrp.scale.setScalar(0.01);
        const frameMat = makeMetalMat(0x27272a, appearance, 0.3, 0.75);
        const lensMat = sMats.glassLens;
        const gEyeX = isFemaleLook ? 0.0462 : 0.0443;
        const gEyeY = isFemaleLook ? 0.1004 : 0.1082;
        const gEyeZ = isFemaleLook ? 0.167 : 0.165;
        for (const side of [-1, 1]) {
          const rim = new THREE.Mesh(sGeoms.glassRim, frameMat);
          rim.userData.sharedGlbGeom = true;
          rim.position.set(side * gEyeX, gEyeY, gEyeZ);
          const lens = new THREE.Mesh(sGeoms.glassLens, lensMat);
          lens.userData.sharedGlbGeom = true;
          lens.userData.sharedGlbMat = true;
          lens.position.set(side * gEyeX, gEyeY, gEyeZ);
          const arm = new THREE.Mesh(sGeoms.glassArm, frameMat);
          arm.userData.sharedGlbGeom = true;
          arm.position.set(side * (gEyeX + 0.022), gEyeY, gEyeZ - 0.052);
          glassGrp.add(rim, lens, arm);
        }
        const bridge = new THREE.Mesh(sGeoms.glassBridge, frameMat);
        bridge.userData.sharedGlbGeom = true;
        bridge.position.set(0, gEyeY + 0.002, gEyeZ + 0.001);
        glassGrp.add(bridge);
        bones['Head'].bone.add(glassGrp);
      }
    }

    let handCup: THREE.Group | undefined;
    const cupAnchor = bones['HandR']?.bone || bones['LowerArmR']?.bone;
    if (cupAnchor) {
      handCup = new THREE.Group();
      handCup.scale.setScalar(0.01);
      const cupBody = new THREE.Mesh(sGeoms.cupBody, sMats.cupBody);
      cupBody.userData.sharedGlbGeom = true;
      cupBody.userData.sharedGlbMat = true;
      const cupRim = new THREE.Mesh(sGeoms.cupRim, sMats.cupRim);
      cupRim.userData.sharedGlbGeom = true;
      cupRim.userData.sharedGlbMat = true;
      cupRim.rotation.x = Math.PI / 2;
      cupRim.position.y = 0.042;
      const cupWater = new THREE.Mesh(sGeoms.cupWater, sMats.cupWater);
      cupWater.userData.sharedGlbGeom = true;
      cupWater.userData.sharedGlbMat = true;
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

      const folderCover = new THREE.Mesh(sGeoms.folderCover, sMats.folderCover);
      folderCover.userData.sharedGlbGeom = true;
      folderCover.userData.sharedGlbMat = true;
      folderCover.position.set(0.055, 0, -0.035);
      const folderPages = new THREE.Mesh(sGeoms.folderPages, sMats.folderPages);
      folderPages.userData.sharedGlbGeom = true;
      folderPages.userData.sharedGlbMat = true;
      folderPages.position.set(0.061, 0.004, -0.027);
      const folderTab = new THREE.Mesh(sGeoms.folderTab, sMats.folderTab);
      folderTab.userData.sharedGlbGeom = true;
      folderTab.userData.sharedGlbMat = true;
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
      blinkLids,
      mouthLower,
      mouthSeam,
      isSkinnedGlb: true,
      hipHeight: measuredHipH,
      heightScale: hScale,
      bones,
    };
  }

  return {
    root,
    bodyPivot,
    selectRing,
    hitMesh,
    isSkinnedGlb: false,
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
    turnLean?: number;
    lookTargetWorld?: { x: number; y: number; z: number } | null;
    isSpeaking?: boolean;
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
    turnLean = 0,
    lookTargetWorld = null,
    isSpeaking = false,
  } = opts;

  // Individualized phase & cadence so people never breathe, fidget, blink, or glance in lockstep
  const seedMod = Math.abs(actorSeed) % 13;
  const t = timeSec + (actorSeed % 97) * 1.43;
  const breathFreq = 1.42 + seedMod * 0.045;
  const breathWave = Math.sin(t * breathFreq);

  if (rig.blinkLids) {
    const blinkPeriod = 3.6 + seedMod * 0.22;
    const cyclePos = t % blinkPeriod;
    const isDouble = Math.floor(t / blinkPeriod) % 4 === 2;
    let blinkAmt = 0;
    if (cyclePos < 0.16) {
      blinkAmt = Math.sin((cyclePos / 0.16) * Math.PI);
    } else if (isDouble && cyclePos >= 0.24 && cyclePos < 0.39) {
      blinkAmt = Math.sin(((cyclePos - 0.24) / 0.15) * Math.PI);
    }
    const lidRx = THREE.MathUtils.lerp(-0.98, 0.42, blinkAmt);
    rig.blinkLids[0].rotation.x = lidRx;
    rig.blinkLids[1].rotation.x = lidRx;
  }

  const speakingActive = isSpeaking && (lieBlend ?? (pose === 'lying' ? 1 : 0)) < 0.2;
  if (rig.mouthLower && rig.mouthSeam) {
    if (speakingActive) {
      const cadence = Math.max(0, Math.sin(t * 9.5) * 0.65 + Math.sin(t * 14.3) * 0.35);
      rig.mouthLower.position.y = -cadence * 0.0040;
      rig.mouthSeam.position.y = -cadence * 0.0014;
    } else {
      rig.mouthLower.position.y = 0;
      rig.mouthSeam.position.y = 0;
    }
  }

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
    const walkTurnLean = THREE.MathUtils.clamp(turnLean, -0.09, 0.09) * activeBlend * (1 - sit) * (1 - lie);
    const torsoStandZ = -stride * 0.018 * activeBlend - standWeight * 0.042 + walkTurnLean;
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
    const baseChestZ = THREE.MathUtils.lerp(
      -stride * 0.022 * activeBlend - standWeight * 0.025 + walkTurnLean * 0.55,
      -sitTorsoZ * 0.3,
      sit
    );
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
      (activeDrink || activePickFile || activePlaceFile
        ? 0
        : Math.sin(t * 0.37) * 0.035 * (1 - activeBlend * 0.7) * (1 - pushAmt)) -
      walkTurnLean * 0.7;

    let finalLookYaw = lookYaw;
    let finalLookPitch = lookPitch;
    if (lookTargetWorld && lie < 0.2 && !activeDrink && !activePickFile && !activePlaceFile) {
      const dx = lookTargetWorld.x - rig.root.position.x;
      const dz = lookTargetWorld.z - rig.root.position.z;
      const distXZ = Math.hypot(dx, dz);
      let dYaw = Math.atan2(dx, dz) - facingRad;
      while (dYaw > Math.PI) dYaw -= Math.PI * 2;
      while (dYaw < -Math.PI) dYaw += Math.PI * 2;
      const clampedYaw = THREE.MathUtils.clamp(dYaw, -0.58, 0.58);
      const eyeRefY = rig.root.position.y + 1.02 * hScale;
      const targetPitch = THREE.MathUtils.clamp(
        -Math.atan2(lookTargetWorld.y - eyeRefY, Math.max(0.35, distXZ)),
        -0.28,
        0.22
      );
      const speakNod = isSpeaking ? Math.sin(t * 4.4) * 0.028 : Math.sin(t * 0.7) * 0.012;
      finalLookYaw = clampedYaw;
      finalLookPitch = targetPitch + speakNod;
    }

    const baseNeckX = activeDrink
      ? drinkNeckPitch
      : THREE.MathUtils.lerp(
          0.012 * activeBlend + (activePlaceFile ? 0.1 * placeReach : 0),
          -0.025 + finalLookPitch * 0.28,
          sit
        );
    const baseHeadX = THREE.MathUtils.lerp(finalLookPitch, -0.02 + finalLookPitch, sit);
    applyCharEuler(
      b['Neck'],
      THREE.MathUtils.lerp(baseNeckX, 0.045, lie),
      THREE.MathUtils.lerp(finalLookYaw * 0.45, lieHeadYaw * 0.4, lie),
      THREE.MathUtils.lerp(headTiltZ * 0.35, lieHeadRoll * 0.35, lie)
    );
    applyCharEuler(
      b['Head'],
      THREE.MathUtils.lerp(baseHeadX, lieHeadPitch, lie),
      THREE.MathUtils.lerp(finalLookYaw, lieHeadYaw * 0.72, lie),
      THREE.MathUtils.lerp(headTiltZ, lieHeadRoll, lie)
    );
    return;
  }
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
