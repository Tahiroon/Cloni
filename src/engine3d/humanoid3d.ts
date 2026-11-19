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
  isSkinnedGlb: boolean;
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

  const rings = 14;
  const radialSegs = 24;
  const gap = opts.openFrontGapRad || 0;
  const thetaStart = gap;
  const thetaSpan = Math.PI * 2 - gap * 2;
  const cols = radialSegs + 1;

  const positions: number[] = [];
  const uvs: number[] = [];
  const skinIndices: number[] = [];
  const skinWeights: number[] = [];
  const indices: number[] = [];

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
      // In CharacterArmature space: +X is left, -Y is world front (+Z), +Y is world back (-Z)
      const x = rx * Math.sin(theta);
      const y = cy - ry * Math.cos(theta);
      positions.push(x, y, z);
      uvs.push(u, 1 - v);

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
  geom.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geom.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
  geom.setIndex(indices);
  geom.computeVertexNormals();

  const mat = colorMat(opts.colorHex, 0.86, 0.01, true);
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
  const skinCol = new THREE.Color(appearance.skinTone || '#7f4d31');
  const darkerSkinCol = skinCol.clone().multiplyScalar(0.76);
  const hairCol = new THREE.Color(appearance.hairColor || '#17100c');
  const shirtCol = new THREE.Color(appearance.shirtColor || '#ece9e1');
  const pantsCol = new THREE.Color(appearance.pantsColor || '#1e293b');
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
          const c = (m as THREE.MeshStandardMaterial).clone();
          const mName = c.name || '';

          if (mName === 'Skin') {
            if (meshName.includes('Feet') && isFemaleLook) {
              // Cover instep/ankle with modest dark sock/shoe tone
              c.color.setHex(0x1f1916);
              c.roughness = 0.72;
            } else {
              c.color.copy(skinCol);
              c.roughness = 0.64;
              c.metalness = 0.02;
            }
          } else if (mName === 'Skin_Darker') {
            c.color.copy(darkerSkinCol);
            c.roughness = 0.68;
          } else if (
            mName === 'Hair' ||
            mName === 'Hair_Blond' ||
            mName === 'Hair_Brown' ||
            mName === 'Eyebrows'
          ) {
            if (isFemaleLook && appearance.hasHijab && mName === 'Hair_Blond') {
              // Sculpted hair becomes a clean inner hijab under-cap so no hair ever clips through Tarha
              c.color.copy(tarhaUnderCapCol);
              c.roughness = 0.86;
            } else {
              c.color.copy(hairCol);
              c.roughness = 0.88;
            }
          } else if (isTherapist) {
            if (mName === 'Black' && meshName === 'Suit_Body') {
              c.color.setHex(0xedf2f7); // Crisp white medical coat
              c.roughness = 0.72;
            } else if (mName === 'White' && meshName === 'Suit_Body') {
              c.color.setHex(0x0284c7); // Teal clinical scrubs underneath
              c.roughness = 0.78;
            } else if (mName === 'Black' && meshName === 'Suit_Legs') {
              c.color.setHex(0x0f3a5c); // Navy scrub trousers
              c.roughness = 0.82;
            } else if (meshName === 'Suit_Feet') {
              c.color.setHex(0x1e293b);
              c.roughness = 0.56;
            }
          } else if (outfitStyle === 'jalabiya') {
            if (mName === 'Suit' || mName === 'White' || mName === 'Tie') {
              c.color.copy(shirtCol);
              c.roughness = 0.84;
            } else if (mName === 'Black') {
              c.color.setHex(0x3a2618);
              c.roughness = 0.56;
            }
          } else if (outfitStyle === 'abaya') {
            if ((mName === 'Black' || mName === 'White') && meshName === 'Suit_Body') {
              c.color.copy(shirtCol);
              c.roughness = 0.86;
            } else if (meshName === 'Suit_Feet') {
              c.color.setHex(0x181615);
              c.roughness = 0.62;
            }
          } else if (outfitStyle === 'abaya_open') {
            if (mName === 'Black' && meshName === 'Suit_Body') {
              c.color.copy(shirtCol); // Outer open Abaya sleeves & coat
              c.roughness = 0.86;
            } else if (
              (mName === 'White' && meshName === 'Suit_Body') ||
              (mName === 'Black' && meshName === 'Suit_Legs')
            ) {
              c.color.copy(pantsCol); // Harmonious modest inner dress / trousers
              c.roughness = 0.82;
            } else if (meshName === 'Suit_Feet') {
              c.color.setHex(0x1f1916);
              c.roughness = 0.6;
            }
          } else if (outfitStyle === 'dress') {
            if ((mName === 'Black' || mName === 'White') && meshName === 'Suit_Body') {
              c.color.copy(shirtCol);
              c.roughness = 0.82;
            } else if (meshName === 'Suit_Feet') {
              c.color.setHex(0x27201c);
              c.roughness = 0.58;
            }
          } else if (isFemaleLook) {
            // Modest women's trousers + long-sleeve shirt + Tarha
            if (mName === 'Black' && meshName === 'Suit_Body') {
              c.color.copy(shirtCol);
              c.roughness = 0.78;
            } else if (mName === 'White' && meshName === 'Suit_Body') {
              c.color.copy(shirtCol).offsetHSL(0, -0.05, 0.14);
              c.roughness = 0.78;
            } else if (mName === 'Black' && meshName === 'Suit_Legs') {
              c.color.copy(pantsCol);
              c.roughness = 0.84;
            } else if (meshName === 'Suit_Feet') {
              c.color.setHex(0x1e293b);
              c.roughness = 0.58;
            }
          } else {
            // Men's casual (trousers + shirt / t-shirt)
            if (
              mName === 'LightBrown' ||
              (mName === 'Suit' && meshName === 'Suit_Body') ||
              mName === 'Tie'
            ) {
              c.color.copy(shirtCol);
              c.roughness = 0.8;
            } else if (mName === 'White' && meshName === 'Suit_Body') {
              c.color.copy(shirtCol).offsetHSL(0, -0.05, 0.08);
              c.roughness = 0.78;
            } else if (mName === 'LightBlue' || (mName === 'Suit' && meshName === 'Suit_Legs')) {
              c.color.copy(pantsCol);
              c.roughness = 0.84;
            } else if (mName === 'Red_Dark' || mName === 'Black') {
              c.color.setHex(0x27272a);
              c.roughness = 0.58;
            }
          }

          return c;
        });

        mesh.userData.sharedGlbMat = false;
        mesh.material = clonedMats.length === 1 ? clonedMats[0] : clonedMats;
      }
    });

    // Build SkinnedMesh garments directly on the character's skeleton (zero leg/body clipping!)
    if (legSkinnedMesh && !isTherapist) {
      if (outfitStyle === 'abaya') {
        createSkinnedGarmentMesh(legSkinnedMesh, {
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
        });
      } else if (outfitStyle === 'abaya_open') {
        createSkinnedGarmentMesh(legSkinnedMesh, {
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
        createSkinnedGarmentMesh(legSkinnedMesh, {
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
        createSkinnedGarmentMesh(legSkinnedMesh, {
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
        createSkinnedGarmentMesh(legSkinnedMesh, {
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
      UpperArmR: 'UpperArmR',
      'UpperArm.R': 'UpperArmR',
      LowerArmR: 'LowerArmR',
      'LowerArm.R': 'LowerArmR',
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

    // Subtle Chest Accents (Jalabiya collar/placket, Embroidered Abaya placket, Dress sash)
    if (bones['Chest'] && !appearance.isStaff) {
      if (outfitStyle === 'jalabiya') {
        const collarGrp = new THREE.Group();
        collarGrp.scale.setScalar(0.01);
        const jMat = colorMat(shirtCol.getHex(), 0.84, 0.01);
        const trimMat = colorMat(0xd6c7a8, 0.65, 0.05);
        const bandCollar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.084, 0.09, 0.055, 14),
          jMat
        );
        bandCollar.position.set(0, 0.145, 0.004);
        const placket = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.21, 0.022), trimMat);
        placket.position.set(0, 0.038, 0.122);
        collarGrp.add(bandCollar, placket);
        bones['Chest'].bone.add(collarGrp);
      } else if (outfitStyle === 'abaya' && (appearance.variantSeed || 0) % 2 === 0) {
        // Subtle gold/copper embroidered chest trim on alternate Abayas
        const abayaTrimGrp = new THREE.Group();
        abayaTrimGrp.scale.setScalar(0.01);
        const embMat = colorMat(0xc59b57, 0.55, 0.18);
        const trimStrip = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.24, 0.018), embMat);
        trimStrip.position.set(0, 0.01, 0.124);
        abayaTrimGrp.add(trimStrip);
        bones['Chest'].bone.add(abayaTrimGrp);
      }
    }

    if (bones['Hips'] && outfitStyle === 'dress' && !appearance.isStaff) {
      const sashGrp = new THREE.Group();
      sashGrp.scale.setScalar(0.01);
      const sashCol = shirtCol.clone().offsetHSL(0, -0.1, -0.14);
      const sashMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.155, 0.158, 0.042, 18),
        colorMat(sashCol.getHex(), 0.72, 0.04)
      );
      sashMesh.scale.set(1.0, 1.0, 0.82);
      sashMesh.position.set(0, 0.14, 0.068);
      sashGrp.add(sashMesh);
      bones['Hips'].bone.add(sashGrp);
    }

    // Authentic Sudanese Headwear (White Emma Turban / Taqiyah for men; Draped Tarha/Hijab for women)
    if (bones['Head']) {
      if (outfitStyle === 'jalabiya' && !isFemaleLook && !appearance.isStaff) {
        const headAcc = new THREE.Group();
        headAcc.scale.setScalar(0.01);
        const whiteCloth = colorMat(0xf4f2ec, 0.82, 0.01);

        if (appearance.hasTurban) {
          for (const [ty, rad, tilt] of [
            [0.195, 0.128, 0.07],
            [0.228, 0.124, -0.06],
            [0.258, 0.114, 0.05],
          ] as Array<[number, number, number]>) {
            const wrap = new THREE.Mesh(new THREE.TorusGeometry(rad, 0.032, 10, 18), whiteCloth);
            wrap.rotation.x = Math.PI / 2 + tilt;
            wrap.rotation.y = tilt * 1.4;
            wrap.position.set(0, ty, -0.006);
            wrap.castShadow = true;
            headAcc.add(wrap);
          }
          const crown = new THREE.Mesh(
            new THREE.SphereGeometry(0.118, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
            whiteCloth
          );
          crown.position.set(0, 0.235, -0.006);
          headAcc.add(crown);
        } else {
          const taqMat = colorMat(0xede9df, 0.8, 0.01);
          const capSide = new THREE.Mesh(
            new THREE.CylinderGeometry(0.118, 0.122, 0.062, 16),
            taqMat
          );
          capSide.position.set(0, 0.21, -0.006);
          const capTop = new THREE.Mesh(
            new THREE.SphereGeometry(0.118, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
            taqMat
          );
          capTop.position.set(0, 0.24, -0.006);
          headAcc.add(capSide, capTop);
        }
        bones['Head'].bone.add(headAcc);
      } else if (isFemaleLook && (appearance.hasHijab || appearance.role === 'receptionist' || appearance.role === 'therapist')) {
        const tarhaMat = colorMat(tarhaCol.getHex(), 0.84, 0.01);
        const scarfGrp = new THREE.Group();
        scarfGrp.scale.setScalar(0.01);

        // Outer draped hood framing forehead and covering crown & back bun completely
        const hood = new THREE.Mesh(new THREE.SphereGeometry(0.126, 16, 12), tarhaMat);
        hood.scale.set(1.10, 1.22, 1.24);
        hood.position.set(0, 0.165, -0.022);
        hood.castShadow = true;

        // Soft neck & chin wrap
        const neckWrap = new THREE.Mesh(
          new THREE.CylinderGeometry(0.098, 0.146, 0.17, 14),
          tarhaMat
        );
        neckWrap.position.set(0, 0.010, -0.008);

        // Flowing rear Tarha tail down the back of shoulders
        const backTail = new THREE.Mesh(
          new THREE.CylinderGeometry(0.105, 0.142, 0.22, 12, 1, false, Math.PI * 0.55, Math.PI * 0.9),
          tarhaMat
        );
        backTail.position.set(0, -0.04, -0.032);
        scarfGrp.add(hood, neckWrap, backTail);
        bones['Head'].bone.add(scarfGrp);

        if (bones['Chest']) {
          const chestDrape = new THREE.Group();
          chestDrape.scale.setScalar(0.01);
          const shawl = new THREE.Mesh(
            new THREE.CylinderGeometry(0.136, 0.192, 0.21, 14),
            tarhaMat
          );
          shawl.scale.set(1.06, 1.0, 0.78);
          shawl.position.set(0, 0.058, 0.018);
          chestDrape.add(shawl);
          bones['Chest'].bone.add(chestDrape);
        }
      }
    }

    return {
      root,
      bodyPivot,
      selectRing,
      hitMesh,
      isSkinnedGlb: true,
      bones,
    };
  }

  // Fallback anatomical procedural rig during the initial <200ms GLB preload
  const skinMat = colorMat(appearance.skinTone, 0.62, 0.02);
  const hairMat = colorMat(appearance.hairColor, 0.86, 0.02);
  const shirtMat = colorMat(appearance.shirtColor, 0.78, 0.02);
  const isFullRobeFallback =
    outfitStyle === 'jalabiya' ||
    outfitStyle === 'abaya' ||
    outfitStyle === 'abaya_open' ||
    outfitStyle === 'dress';
  const pantsMat = colorMat(isFullRobeFallback ? appearance.shirtColor : appearance.pantsColor, 0.8, 0.02);
  const shoeMat = colorMat(appearance.isStaff ? 0xf8fafc : 0x1e293b, 0.48, 0.08);
  const coatMat = colorMat(0xf1f5f9, 0.68, 0.02);

  const makeLeg = (xOffset: number) => {
    const legPivot = new THREE.Group();
    legPivot.position.set(xOffset, 0.44, 0);
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.048, 0.22, 10), pantsMat);
    thigh.position.y = -0.11;
    legPivot.add(thigh);
    const shinPivot = new THREE.Group();
    shinPivot.position.set(0, -0.22, 0);
    legPivot.add(shinPivot);
    const calf = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.038, 0.21, 10), pantsMat);
    calf.position.y = -0.1;
    shinPivot.add(calf);
    const shoe = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.07, 4, 8), shoeMat);
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
  const torsoMesh = new THREE.Mesh(new THREE.LatheGeometry(torsoProfile, 12), shirtMat);
  torsoMesh.scale.set(1.08, 1.0, 0.72);
  torso.add(torsoMesh);

  let robePivot: THREE.Group | undefined;
  if (isFullRobeFallback) {
    robePivot = new THREE.Group();
    const robeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.128, 0.175, 0.38, 12), shirtMat);
    robeMesh.scale.set(1.06, 1, 0.8);
    robeMesh.position.y = -0.19;
    robePivot.add(robeMesh);
    torso.add(robePivot);
  }

  const makeArm = (xOffset: number) => {
    const armPivot = new THREE.Group();
    armPivot.position.set(xOffset, 0.31, 0);
    const sleeveMat = appearance.isStaff && appearance.role === 'therapist' ? coatMat : shirtMat;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.032, 0.26, 8), sleeveMat);
    arm.position.y = -0.13;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.034, 8, 6), skinMat);
    hand.position.y = -0.27;
    armPivot.add(arm, hand);
    return armPivot;
  };
  const leftArm = makeArm(-0.16);
  const rightArm = makeArm(0.16);
  torso.add(leftArm, rightArm);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.365, 0);
  torso.add(headGroup);
  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.102, 12, 10), skinMat);
  cranium.position.y = 0.135;
  headGroup.add(cranium);
  if (appearance.hasHijab) {
    const hood = new THREE.Mesh(
      new THREE.SphereGeometry(0.114, 12, 10),
      colorMat(tarhaCol.getHex())
    );
    hood.position.set(0, 0.14, -0.014);
    headGroup.add(hood);
  } else if (appearance.hasTurban) {
    const emma = new THREE.Mesh(new THREE.CylinderGeometry(0.118, 0.112, 0.08, 12), colorMat(0xf4f2ec));
    emma.position.set(0, 0.215, 0);
    headGroup.add(emma);
  } else {
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.106, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.6),
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
const _localDeltaQuat = new THREE.Quaternion();
const _axisX = new THREE.Vector3(1, 0, 0);
const _axisZ = new THREE.Vector3(0, 0, 1);

function applyCharEuler(ref: SkinnedBoneRef | undefined, rx: number, ry: number, rz: number) {
  if (!ref) return;
  _euler.set(rx, ry, rz, 'XYZ');
  _charQuat.setFromEuler(_euler);
  _localDeltaQuat.copy(ref.invWorldQ).multiply(_charQuat).multiply(ref.restWorldQ);
  ref.bone.quaternion.copy(ref.restQuat).multiply(_localDeltaQuat);
}

/**
 * Lowers T-pose arm cleanly to the side of the torso (dropZ) BEFORE applying
 * natural sagittal forward/backward swing around X (swingX).
 */
function applyArmSagittal(
  ref: SkinnedBoneRef | undefined,
  dropZ: number,
  swingX: number
) {
  if (!ref) return;
  _charQuat.setFromAxisAngle(_axisZ, dropZ);
  _swingQuat.setFromAxisAngle(_axisX, swingX);
  _swingQuat.multiply(_charQuat);
  _localDeltaQuat.copy(ref.invWorldQ).multiply(_swingQuat).multiply(ref.restWorldQ);
  ref.bone.quaternion.copy(ref.restQuat).multiply(_localDeltaQuat);
}

/** Flexes elbow purely forward along the bone's anatomical local hinge axis. */
function applyLocalElbowFlex(ref: SkinnedBoneRef | undefined, isLeft: boolean, flexRad: number) {
  if (!ref) return;
  _swingQuat.setFromAxisAngle(_axisZ, isLeft ? -flexRad : flexRad);
  ref.bone.quaternion.copy(ref.restQuat).multiply(_swingQuat);
}

export function animateHumanoid3D(
  rig: HumanoidRig,
  opts: {
    pose: CharacterPose;
    walkPhase: number;
    isMoving: boolean;
    walkBlend?: number;
    facingRad: number;
    timeSec: number;
    isSelected: boolean;
    inTreatment?: boolean;
  }
) {
  const { pose, walkPhase, isMoving, walkBlend, facingRad, timeSec, isSelected, inTreatment } = opts;

  rig.selectRing.visible = isSelected;
  if (isSelected) {
    const s = 1 + Math.sin(timeSec * 5) * 0.08;
    rig.selectRing.scale.set(s, s, 1);
  }

  if (rig.isSkinnedGlb && rig.bones) {
    const b = rig.bones;

    if (pose === 'lying') {
      rig.bodyPivot.rotation.set(-Math.PI / 2, 0, 0);
      rig.bodyPivot.position.set(0, 0.49, 0.67);
      rig.root.rotation.y = facingRad;
      applyCharEuler(b['Hips'], 0, 0, 0);
      applyCharEuler(b['Torso'], 0.02, 0, 0);
      applyCharEuler(b['UpperLegL'], -0.1, 0, 0.02);
      applyCharEuler(b['UpperLegR'], -0.1, 0, -0.02);
      applyCharEuler(b['LowerLegL'], 0.18, 0, 0);
      applyCharEuler(b['LowerLegR'], 0.18, 0, 0);
      applyCharEuler(b['FootL'], 0.14, 0, 0);
      applyCharEuler(b['FootR'], 0.14, 0, 0);
      applyArmSagittal(b['UpperArmL'], -1.46, -0.06);
      applyArmSagittal(b['UpperArmR'], 1.46, -0.06);
      applyLocalElbowFlex(b['LowerArmL'], true, 0.24);
      applyLocalElbowFlex(b['LowerArmR'], false, 0.24);
      applyCharEuler(b['Head'], 0.12 + Math.sin(timeSec * 1.8) * 0.015, 0, 0);
      return;
    }

    rig.bodyPivot.rotation.set(0, 0, 0);
    rig.root.rotation.y = facingRad;

    if (pose === 'seated') {
      rig.bodyPivot.position.set(0, -0.33, 0);
      const pedal = inTreatment ? Math.sin(timeSec * 5.2) * 0.32 : 0;
      const breath = Math.sin(timeSec * 1.7) * 0.015;
      applyCharEuler(b['Hips'], 0, 0, 0);
      applyCharEuler(b['Torso'], 0.07 + breath * 0.5, 0, 0);
      applyCharEuler(b['Chest'], 0.05 + breath, 0, 0);
      applyCharEuler(b['ShoulderL'], 0, 0, -0.04);
      applyCharEuler(b['ShoulderR'], 0, 0, 0.04);
      applyCharEuler(b['UpperLegL'], -1.48 - pedal, 0.04, 0.04);
      applyCharEuler(b['UpperLegR'], -1.48 + pedal, -0.04, -0.04);
      applyCharEuler(b['LowerLegL'], 1.50 + pedal * 0.65, 0, 0);
      applyCharEuler(b['LowerLegR'], 1.50 - pedal * 0.65, 0, 0);
      applyCharEuler(b['FootL'], 0.02, 0, 0);
      applyCharEuler(b['FootR'], 0.02, 0, 0);
      applyArmSagittal(b['UpperArmL'], -1.48, -0.14);
      applyArmSagittal(b['UpperArmR'], 1.48, -0.14);
      applyLocalElbowFlex(b['LowerArmL'], true, 0.56);
      applyLocalElbowFlex(b['LowerArmR'], false, 0.56);
      applyCharEuler(b['Neck'], -0.04, Math.sin(timeSec * 0.6) * 0.04, 0);
      applyCharEuler(b['Head'], -0.03 + Math.sin(timeSec * 1.3) * 0.025, Math.sin(timeSec * 0.55) * 0.11, 0);
      return;
    }

    const activeBlend = inTreatment ? 1 : walkBlend ?? (isMoving ? 1 : 0);
    const breath = Math.sin(timeSec * 1.9) * 0.013;

    if (activeBlend > 0.01) {
      const phase = inTreatment ? timeSec * 4.2 : walkPhase;
      const stride = Math.sin(phase);
      const cosP = Math.cos(phase);
      const cos2 = Math.cos(phase * 2);

      const verticalBob = (cos2 - 1) * 0.013 * activeBlend;
      const lateralSway = -cosP * 0.013 * activeBlend;
      rig.bodyPivot.position.set(lateralSway, 0.02 + verticalBob, 0);

      applyCharEuler(b['Hips'], 0, -stride * 0.058 * activeBlend, stride * 0.026 * activeBlend);
      applyCharEuler(
        b['Torso'],
        -0.035 * activeBlend + breath * (1 - activeBlend),
        stride * 0.04 * activeBlend,
        -stride * 0.014 * activeBlend
      );
      applyCharEuler(
        b['Chest'],
        0.015 * activeBlend + breath,
        stride * 0.048 * activeBlend,
        -stride * 0.018 * activeBlend
      );
      applyCharEuler(b['ShoulderL'], 0, -stride * 0.04 * activeBlend, -0.04);
      applyCharEuler(b['ShoulderR'], 0, -stride * 0.04 * activeBlend, 0.04);

      const swing = stride * 0.34 * activeBlend;
      applyCharEuler(b['UpperLegL'], -swing, 0, 0.016);
      applyCharEuler(b['UpperLegR'], swing, 0, -0.016);

      const kneeL =
        0.04 + (Math.max(0, -cosP) * 0.58 + Math.max(0, stride) * 0.12) * activeBlend;
      const kneeR =
        0.04 + (Math.max(0, cosP) * 0.58 + Math.max(0, -stride) * 0.12) * activeBlend;
      applyCharEuler(b['LowerLegL'], kneeL, 0, 0);
      applyCharEuler(b['LowerLegR'], kneeR, 0, 0);

      applyCharEuler(b['FootL'], -stride * 0.17 * activeBlend, 0, 0);
      applyCharEuler(b['FootR'], stride * 0.17 * activeBlend, 0, 0);

      const armSwing = stride * 0.24 * activeBlend;
      applyArmSagittal(b['UpperArmL'], -1.49, armSwing - 0.02);
      applyArmSagittal(b['UpperArmR'], 1.49, -armSwing - 0.02);
      applyLocalElbowFlex(b['LowerArmL'], true, 0.12 + Math.max(0, -stride) * 0.22 * activeBlend);
      applyLocalElbowFlex(b['LowerArmR'], false, 0.12 + Math.max(0, stride) * 0.22 * activeBlend);

      applyCharEuler(b['Neck'], 0.01 * activeBlend, -stride * 0.025 * activeBlend, 0);
      applyCharEuler(
        b['Head'],
        0.012 * activeBlend + Math.sin(timeSec * 1.4) * 0.014,
        -stride * 0.02 * activeBlend + Math.sin(timeSec * 0.55) * 0.045,
        0
      );
    } else {
      const sway = Math.sin(timeSec * 0.9) * 0.01;
      rig.bodyPivot.position.set(sway * 0.4, 0.02, 0);
      applyCharEuler(b['Hips'], 0, sway * 0.8, sway * 0.8);
      applyCharEuler(b['Torso'], breath * 0.5, -sway * 0.6, -sway * 0.5);
      applyCharEuler(b['Chest'], breath, -sway * 0.5, 0);
      applyCharEuler(b['ShoulderL'], 0, 0, -0.04);
      applyCharEuler(b['ShoulderR'], 0, 0, 0.04);
      applyCharEuler(b['UpperLegL'], 0, 0.03, 0.02);
      applyCharEuler(b['UpperLegR'], 0, -0.03, -0.02);
      applyCharEuler(b['LowerLegL'], 0.04, 0, 0);
      applyCharEuler(b['LowerLegR'], 0.04, 0, 0);
      applyCharEuler(b['FootL'], 0, 0, 0);
      applyCharEuler(b['FootR'], 0, 0, 0);
      applyArmSagittal(b['UpperArmL'], -1.49, -0.02 + breath * 0.7);
      applyArmSagittal(b['UpperArmR'], 1.49, -0.02 - breath * 0.7);
      applyLocalElbowFlex(b['LowerArmL'], true, 0.14);
      applyLocalElbowFlex(b['LowerArmR'], false, 0.14);
      applyCharEuler(b['Neck'], 0, Math.sin(timeSec * 0.45) * 0.04, 0);
      applyCharEuler(b['Head'], Math.sin(timeSec * 1.1) * 0.022, Math.sin(timeSec * 0.52) * 0.08, 0);
    }
    return;
  }

  // Fallback procedural rig animation
  if (!rig.torso || !rig.leftLeg || !rig.rightLeg || !rig.leftArm || !rig.rightArm || !rig.leftShin || !rig.rightShin || !rig.headGroup) {
    return;
  }
  if (pose === 'lying') {
    rig.bodyPivot.rotation.set(-Math.PI / 2, 0, 0);
    rig.bodyPivot.position.set(0, 0.56, -0.35);
    rig.root.rotation.y = Math.PI / 2;
    return;
  }
  rig.bodyPivot.rotation.set(0, 0, 0);
  rig.root.rotation.y = facingRad;
  if (pose === 'seated') {
    rig.bodyPivot.position.set(0, -0.09, 0);
    rig.leftLeg.rotation.x = -Math.PI * 0.48;
    rig.rightLeg.rotation.x = -Math.PI * 0.48;
    rig.leftShin.rotation.x = Math.PI * 0.48;
    rig.rightShin.rotation.x = Math.PI * 0.48;
    return;
  }
  rig.bodyPivot.position.set(0, 0.05, 0);
  if (isMoving) {
    const swing = Math.sin(walkPhase) * 0.46;
    rig.leftLeg.rotation.x = swing;
    rig.rightLeg.rotation.x = -swing;
    rig.leftArm.rotation.x = -swing * 0.65;
    rig.rightArm.rotation.x = swing * 0.65;
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
