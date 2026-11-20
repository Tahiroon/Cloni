import { ClinicRoom, PlacedItem } from '../types/clinic';

export const TILE_W = 68;
export const TILE_H = 34;

export const CLINIC_FLOOR_ELEV = 0.26;
export const COURTYARD_WALKWAY_TOP = 0.065;
export const CLINIC_FLOOR_TOP = 0.085 + CLINIC_FLOOR_ELEV; // 0.345

export interface SurfaceElevation {
  floorY: number;
  actorY: number;
  onStairs: boolean;
}

/**
 * Single source of truth for floor & stair surface heights across 3D world geometry and character kinematics.
 * Exterior entrance stairs run along X from courtyard walkway (x > 23.52) up 4 risers to the
 * clinic entrance landing (x <= 22.56) within z in [13.78..16.22].
 */
export function getSurfaceElevation(wx: number, wz: number): SurfaceElevation {
  // Clinic building interior (x: 2..22, z: 2..22)
  if (wx >= 1.85 && wx <= 22.0 && wz >= 1.85 && wz <= 22.15) {
    return {
      floorY: CLINIC_FLOOR_TOP,
      actorY: 0.02 + CLINIC_FLOOR_ELEV,
      onStairs: false,
    };
  }

  // Exterior entrance stairs & landing portico (x: 22.0..23.52, z: 13.75..16.25)
  if (wx > 22.0 && wx <= 23.52 && wz >= 13.75 && wz <= 16.25) {
    if (wx <= 22.56) {
      // Top landing flush with sliding glass door threshold
      return {
        floorY: CLINIC_FLOOR_TOP,
        actorY: 0.02 + CLINIC_FLOOR_ELEV,
        onStairs: false,
      };
    }
    if (wx <= 22.88) {
      // Step 3 (upper tread)
      return {
        floorY: 0.275,
        actorY: 0.02 + CLINIC_FLOOR_ELEV * 0.75,
        onStairs: true,
      };
    }
    if (wx <= 23.20) {
      // Step 2 (middle tread)
      return {
        floorY: 0.205,
        actorY: 0.02 + CLINIC_FLOOR_ELEV * 0.5,
        onStairs: true,
      };
    }
    // Step 1 (bottom tread)
    return {
      floorY: 0.135,
      actorY: 0.02 + CLINIC_FLOOR_ELEV * 0.25,
      onStairs: true,
    };
  }

  return {
    floorY: COURTYARD_WALKWAY_TOP,
    actorY: 0.02,
    onStairs: false,
  };
}

export interface Point2D {
  x: number;
  y: number;
}

export function gridToIso(gx: number, gy: number): Point2D {
  return {
    x: (gx - gy) * (TILE_W / 2),
    y: (gx + gy) * (TILE_H / 2),
  };
}

export function isoToGrid(ix: number, iy: number): Point2D {
  const halfW = TILE_W / 2;
  const halfH = TILE_H / 2;
  const gx = (ix / halfW + iy / halfH) / 2;
  const gy = (iy / halfH - ix / halfW) / 2;
  return { x: gx, y: gy };
}

export interface ObstacleBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  itemId?: string;
}

export const WALL_DECOR_IDS = new Set([
  'wall_sconce_lamp',
  'anatomy_poster',
  'ac_nesma',
  'ac_lg',
  'wall_clock',
]);

export function isWallDecorId(catalogId: string): boolean {
  return WALL_DECOR_IDS.has(catalogId);
}

export type WorldTreeSpecies = 'oak' | 'wild_fig' | 'acacia' | 'cypress' | 'birch';

export interface WorldTreeDef {
  id: string;
  x: number;
  z: number;
  scale: number;
  rotY: number;
  removeCost: number;
  species: WorldTreeSpecies;
}

/**
 * Untamed natural wild trees around the immediate clinic yard perimeter
 * (strictly distinct from manicured ornamental planter trees sold in the Store).
 * All positioned clear of the Rear West Solar Zone, Villa, and Entrance path.
 */
export const WORLD_TREES: WorldTreeDef[] = [
  // West perimeter lawn (north & south of the Rear Solar Zone x:-3..0, z:6..19)
  { id: 'tree_01', x: -0.6, z: 1.8, scale: 1.18, rotY: 0.4, removeCost: 80, species: 'oak' },
  { id: 'tree_02', x: -1.4, z: 3.8, scale: 1.06, rotY: 1.8, removeCost: 70, species: 'cypress' },
  { id: 'tree_03', x: -1.4, z: 21.6, scale: 1.14, rotY: 3.1, removeCost: 80, species: 'acacia' },
  { id: 'tree_04', x: 0.4, z: 24.4, scale: 1.12, rotY: 0.9, removeCost: 75, species: 'birch' },
  // South garden lawn
  { id: 'tree_05', x: 5.2, z: 24.5, scale: 1.04, rotY: 2.5, removeCost: 70, species: 'acacia' },
  { id: 'tree_06', x: 11.4, z: 24.8, scale: 1.12, rotY: 4.2, removeCost: 80, species: 'oak' },
  { id: 'tree_15', x: 17.8, z: 24.4, scale: 1.06, rotY: 1.3, removeCost: 75, species: 'wild_fig' },
  { id: 'tree_16', x: 24.4, z: 24.4, scale: 1.08, rotY: 2.2, removeCost: 80, species: 'cypress' },
  // North rear lawn (clear of the 3.5m North clinic wall & Villa)
  { id: 'tree_07', x: 13.8, z: -0.4, scale: 1.02, rotY: 1.2, removeCost: 70, species: 'cypress' },
  { id: 'tree_08', x: 2.2, z: -4.2, scale: 1.18, rotY: 2.1, removeCost: 85, species: 'oak' },
  { id: 'tree_09', x: 18.6, z: -0.6, scale: 1.1, rotY: 5.0, removeCost: 80, species: 'acacia' },
  { id: 'tree_10', x: 24.6, z: -0.2, scale: 0.98, rotY: 3.6, removeCost: 70, species: 'birch' },
  // Immediate East yard corners (kept close to clinic focus)
  { id: 'tree_11', x: 28.6, z: 0.4, scale: 1.08, rotY: 0.6, removeCost: 80, species: 'oak' },
  { id: 'tree_12', x: 28.6, z: 23.8, scale: 1.12, rotY: 2.9, removeCost: 85, species: 'wild_fig' },
  { id: 'tree_13', x: 13.4, z: -4.8, scale: 1.08, rotY: 4.7, removeCost: 80, species: 'birch' },
  { id: 'tree_14', x: 22.8, z: -3.2, scale: 1.02, rotY: 1.5, removeCost: 75, species: 'cypress' },
];

/**
 * Utility pad set cleanly back behind the clinic's solid West rear wall (x = -6..-2, z = 6..19),
 * leaving a generous 3m grass/walkway buffer from the wall and far from the Doctor's Villa.
 */
export const SOLAR_ZONE = { minX: -6, maxX: -2, minY: 6, maxY: 19 } as const;

export function isInSolarZone(gx: number, gy: number, effW = 1, effD = 1): boolean {
  return (
    gx >= SOLAR_ZONE.minX &&
    gy >= SOLAR_ZONE.minY &&
    gx + effW - 1 <= SOLAR_ZONE.maxX &&
    gy + effD - 1 <= SOLAR_ZONE.maxY
  );
}

export function clampToSolarZone(
  gx: number,
  gy: number,
  effW = 1,
  effD = 1
): { gx: number; gy: number } {
  return {
    gx: Math.max(SOLAR_ZONE.minX, Math.min(SOLAR_ZONE.maxX - effW + 1, gx)),
    gy: Math.max(SOLAR_ZONE.minY, Math.min(SOLAR_ZONE.maxY - effD + 1, gy)),
  };
}

/**
 * Checks whether a grid tile (tx, ty) falls inside the buildable outdoor garden
 * areas: East Courtyard, South Lawn, West Perimeter edges, North Rear Lawn (away from Villa),
 * and Sidewalk Promenade.
 */
export function isTileInOutdoorGarden(
  tx: number,
  ty: number,
  allowFenceEdgeLamps = false
): boolean {
  // Keep sliding main entrance path & gate promenade clear
  if (tx >= 21 && tx <= 29 && (ty === 14 || ty === 15)) return false;
  // Keep rear solar conduit cable bridge strip clear (-1..1, z=12..13)
  if (tx >= -1 && tx <= 1 && (ty === 12 || ty === 13)) return false;
  // Exclude indoor building footprint (2..21, 2..21)
  if (tx >= 2 && tx <= 21 && ty >= 2 && ty <= 21) return false;
  // Exclude Doctor's Residence Villa footprint (x: 4..10, z: -7..-2)
  if (tx >= 4 && tx <= 10 && ty >= -7 && ty <= -2) return false;
  // Exclude dedicated Rear West Solar Zone from normal garden clutter
  if (tx >= SOLAR_ZONE.minX && tx <= SOLAR_ZONE.maxX && ty >= SOLAR_ZONE.minY && ty <= SOLAR_ZONE.maxY) {
    return false;
  }

  // 1. East Courtyard
  if (tx >= 22 && tx <= 26 && ty >= 2 && ty <= 21) return true;
  // 2. Promenade walkway outside fence (lamps allowed along 27..29, general garden props on 28..29)
  if (ty >= 2 && ty <= 21) {
    if (allowFenceEdgeLamps && tx >= 27 && tx <= 29) return true;
    if (!allowFenceEdgeLamps && (tx === 28 || tx === 29)) return true;
  }
  // 3. South Lawn (z=22..26)
  if (tx >= 0 && tx <= 27 && ty >= 22 && ty <= 26) {
    if (tx >= 22 && ty === 22) return false;
    return true;
  }
  // 4. West Perimeter Lawn (tiles flanking solar zone, x: -1..1)
  if (tx >= -1 && tx <= 1 && ty >= 0 && ty <= 26) return true;
  // 5. North Rear Perimeter Lawn (behind north wall & former north solar area, clear of Villa)
  if (tx >= 0 && tx <= 26 && ty >= -2 && ty <= 1) return true;
  if (tx >= 11 && tx <= 21 && ty >= -4 && ty <= -3) return true;

  return false;
}

/**
 * Checks whether grid footprint (gx..gx+effW, gy..gy+effD) overlaps any active unremoved WorldTree.
 */
export function overlapsActiveWorldTree(
  gx: number,
  gy: number,
  effW: number,
  effD: number,
  removedTreeIds: string[] = []
): boolean {
  const removedSet = new Set(removedTreeIds);
  const x0 = gx;
  const x1 = gx + effW;
  const z0 = gy;
  const z1 = gy + effD;
  for (const tree of WORLD_TREES) {
    if (removedSet.has(tree.id)) continue;
    const nearestX = Math.max(x0, Math.min(tree.x, x1));
    const nearestZ = Math.max(z0, Math.min(tree.z, z1));
    if (Math.hypot(nearestX - tree.x, nearestZ - tree.z) < 0.72) {
      return true;
    }
  }
  return false;
}

/**
 * Returns all camera-visible wall-mount orientations (0 = East-facing wall, 1 = South-facing wall)
 * at grid tile (gx, gy) inside unlocked rooms, excluding door openings and built-in wall signage.
 * Back-facing interior faces (rot 2, 3) are excluded so items never hide behind solid partition walls.
 */
export function getValidWallRotationsForTile(
  gx: number,
  gy: number,
  rooms: ClinicRoom[]
): Array<0 | 1 | 2 | 3> {
  const room = rooms.find(
    (r) => r.unlocked && gx >= r.minX && gx <= r.maxX && gy >= r.minY && gy <= r.maxY
  );
  if (!room) return [];

  const rots: Array<0 | 1 | 2 | 3> = [];

  // 0 = West wall face (x = gx, facing +X into room)
  if (gx === 2 && gy >= 2 && gy <= 21) {
    // Built-in architectural signature plaque spans z=13.08..18.52 (gy 13..18)
    if (gy < 13 || gy > 18) rots.push(0);
  } else if (gx === 12 && gy >= 2 && gy <= 21) {
    // Exclude doors (gy=5, 14) and built-in plaques (cert z=12.0, logo z=18.6)
    const isDoor = gy === 5 || gy === 14;
    const isBuiltIn = gy === 11 || gy === 12 || gy === 17 || gy === 18 || gy === 19;
    if (!isDoor && !isBuiltIn) rots.push(0);
  }

  // 1 = North wall face (z = gy, facing +Z into room)
  if (gy === 2 && gx >= 2 && gx <= 21) {
    rots.push(1);
  } else if (gy === 10 && gx >= 2 && gx <= 21) {
    const isDoor = gx === 6 || gx === 16;
    if (!isDoor) rots.push(1);
  }

  return rots;
}

export function isValidWallMount(
  gx: number,
  gy: number,
  rotation: 0 | 1 | 2 | 3,
  rooms: ClinicRoom[]
): boolean {
  if (rotation === 0) {
    if (Math.abs(gx - 2) > 0.02 && Math.abs(gx - 12) > 0.02) return false;
    const wallX = Math.round(gx);
    const minTy = Math.floor(gy + 0.03);
    const maxTy = Math.floor(gy + 0.96);
    for (let ty = minTy; ty <= maxTy; ty++) {
      if (!getValidWallRotationsForTile(wallX, ty, rooms).includes(0)) return false;
    }
    return minTy <= maxTy;
  }
  if (rotation === 1) {
    if (Math.abs(gy - 2) > 0.02 && Math.abs(gy - 10) > 0.02) return false;
    const wallY = Math.round(gy);
    const minTx = Math.floor(gx + 0.03);
    const maxTx = Math.floor(gx + 0.96);
    for (let tx = minTx; tx <= maxTx; tx++) {
      if (!getValidWallRotationsForTile(tx, wallY, rooms).includes(1)) return false;
    }
    return minTx <= maxTx;
  }
  return false;
}

export function getWallMountEdgeCenter(
  gx: number,
  gy: number,
  rotation: 0 | 1 | 2 | 3
): { x: number; z: number } {
  if (rotation === 0) return { x: gx + 0.12, z: gy + 0.5 };
  if (rotation === 1) return { x: gx + 0.5, z: gy + 0.12 };
  if (rotation === 2) return { x: gx + 0.88, z: gy + 0.5 };
  return { x: gx + 0.5, z: gy + 0.88 };
}

export function snapToNearestValidWallSlot(
  rawX: number,
  rawZ: number,
  preferredRot: 0 | 1 | 2 | 3,
  rooms: ClinicRoom[]
): { gx: number; gy: number; rotation: 0 | 1 | 2 | 3 } | null {
  let best: { gx: number; gy: number; rotation: 0 | 1 | 2 | 3; score: number } | null = null;

  for (let gx = 2; gx <= 21; gx++) {
    for (let gy = 2; gy <= 21; gy++) {
      const rots = getValidWallRotationsForTile(gx, gy, rooms);
      if (rots.length === 0) continue;
      for (const rot of rots) {
        const edge = getWallMountEdgeCenter(gx, gy, rot);
        const distSq = (rawX - edge.x) * (rawX - edge.x) + (rawZ - edge.z) * (rawZ - edge.z);
        const rotBonus = rot === preferredRot ? -0.02 : 0;
        const score = distSq + rotBonus;
        if (!best || score < best.score) {
          best = { gx, gy, rotation: rot, score };
        }
      }
    }
  }

  return best ? { gx: best.gx, gy: best.gy, rotation: best.rotation } : null;
}

/**
 * Builds world-space AABB collision boxes matching the 3D walls, doors, fences,
 * fountain, doctor villa, locked wings, and placed furniture.
 */
export function buildObstacleBoxes(
  rooms: ClinicRoom[],
  placedItems: PlacedItem[],
  itemFootprints: Map<string, { w: number; d: number }>,
  removedTreeIds: string[] = []
): ObstacleBox[] {
  const boxes: ObstacleBox[] = [];
  const halfBackWall = 0.15;
  const halfFrontWall = 0.12;
  const halfInteriorWall = 0.1;

  const unlockedSet = new Set(rooms.filter((r) => r.unlocked).map((r) => r.id));

  // Outer Perimeter Walls (x: 2..22, z: 2..22)
  // North back wall z = 2
  boxes.push({ minX: 1.85, maxX: 22.15, minZ: 2 - halfBackWall, maxZ: 2 + halfBackWall });
  // West back wall x = 2
  boxes.push({ minX: 2 - halfBackWall, maxX: 2 + halfBackWall, minZ: 1.85, maxZ: 22.15 });
  // South front knee wall z = 22
  boxes.push({ minX: 1.88, maxX: 22.12, minZ: 22 - halfFrontWall, maxZ: 22 + halfFrontWall });
  // East storefront wall x = 22 with automatic double-door opening z = 14.04..15.96
  boxes.push({ minX: 22 - halfFrontWall, maxX: 22 + halfFrontWall, minZ: 1.88, maxZ: 14.04 });
  boxes.push({ minX: 22 - halfFrontWall, maxX: 22 + halfFrontWall, minZ: 15.96, maxZ: 22.12 });

  // Interior horizontal partition z = 10
  // Single doors at x = 6.03..6.97 (door_bay_west) and x = 16.03..16.97 (door_rec_east)
  const bayNorthOpen = unlockedSet.has('room_gym');
  const recNorthOpen = unlockedSet.has('room_specialty_2');
  if (bayNorthOpen) {
    boxes.push({ minX: 2.0, maxX: 6.03, minZ: 10 - halfInteriorWall, maxZ: 10 + halfInteriorWall });
    boxes.push({ minX: 6.97, maxX: 12.0, minZ: 10 - halfInteriorWall, maxZ: 10 + halfInteriorWall });
  } else {
    boxes.push({ minX: 2.0, maxX: 12.0, minZ: 10 - halfInteriorWall, maxZ: 10 + halfInteriorWall });
  }
  if (recNorthOpen) {
    boxes.push({ minX: 12.0, maxX: 16.03, minZ: 10 - halfInteriorWall, maxZ: 10 + halfInteriorWall });
    boxes.push({ minX: 16.97, maxX: 22.0, minZ: 10 - halfInteriorWall, maxZ: 10 + halfInteriorWall });
  } else {
    boxes.push({ minX: 12.0, maxX: 22.0, minZ: 10 - halfInteriorWall, maxZ: 10 + halfInteriorWall });
  }

  // Interior vertical partition x = 12
  // Single doors at z = 5.03..5.97 (door_west_east) and z = 14.03..14.97 (door_reception_bay)
  const northLinkOpen = unlockedSet.has('room_gym') && unlockedSet.has('room_specialty_2');
  if (northLinkOpen) {
    boxes.push({ minX: 12 - halfInteriorWall, maxX: 12 + halfInteriorWall, minZ: 2.0, maxZ: 5.03 });
    boxes.push({ minX: 12 - halfInteriorWall, maxX: 12 + halfInteriorWall, minZ: 5.97, maxZ: 10.0 });
  } else {
    boxes.push({ minX: 12 - halfInteriorWall, maxX: 12 + halfInteriorWall, minZ: 2.0, maxZ: 10.0 });
  }
  boxes.push({ minX: 12 - halfInteriorWall, maxX: 12 + halfInteriorWall, minZ: 10.0, maxZ: 14.03 });
  boxes.push({ minX: 12 - halfInteriorWall, maxX: 12 + halfInteriorWall, minZ: 14.97, maxZ: 22.0 });

  // Locked Rooms as solid keep-out zones
  for (const r of rooms) {
    if (!r.unlocked) {
      boxes.push({
        minX: r.minX,
        maxX: r.maxX + 1,
        minZ: r.minY,
        maxZ: r.maxY + 1,
      });
    }
  }

  // Courtyard Perimeter Fence (x = 27 with open gate z = 13.85..16.15, plus top/bottom fence)
  boxes.push({ minX: 26.86, maxX: 27.14, minZ: 1.9, maxZ: 13.85 });
  boxes.push({ minX: 26.86, maxX: 27.14, minZ: 16.15, maxZ: 22.1 });
  boxes.push({ minX: 22.0, maxX: 27.12, minZ: 1.88, maxZ: 2.12 });
  boxes.push({ minX: 22.0, maxX: 27.12, minZ: 21.88, maxZ: 22.12 });

  // Courtyard Gate Pillars (x = 27.0, z = 13.75 and 16.25)
  for (const pz of [13.75, 16.25]) {
    boxes.push({ minX: 26.76, maxX: 27.24, minZ: pz - 0.24, maxZ: pz + 0.24 });
  }

  // Exterior Entrance Stair Cheek Walls & Handrails (funnel actors cleanly up/down the treads)
  boxes.push({ minX: 22.02, maxX: 23.56, minZ: 13.80, maxZ: 13.97 });
  boxes.push({ minX: 22.02, maxX: 23.56, minZ: 16.03, maxZ: 16.20 });

  // Courtyard Shrubs so actors walk around planted bushes cleanly
  for (const [bx, bz] of [
    [22.48, 3.2],
    [22.48, 12.4],
    [26.45, 3.8],
    [26.45, 20.6],
  ]) {
    boxes.push({ minX: bx - 0.34, maxX: bx + 0.34, minZ: bz - 0.34, maxZ: bz + 0.34 });
  }

  // Courtyard Pergola Posts
  for (const [px, pz] of [
    [23.1, 3.55],
    [23.1, 5.45],
    [25.0, 3.55],
    [25.0, 5.45],
  ]) {
    boxes.push({ minX: px - 0.12, maxX: px + 0.12, minZ: pz - 0.12, maxZ: pz + 0.12 });
  }

  // Doctor's Residence Villa behind clinic
  boxes.push({ minX: 4.8, maxX: 9.7, minZ: -6.5, maxZ: -1.9 });

  // Active unremoved World Tree trunks so outdoor walkers steer around trunks cleanly
  const removedTrees = new Set(removedTreeIds);
  for (const tree of WORLD_TREES) {
    if (removedTrees.has(tree.id)) continue;
    const trunkR = 0.24 * tree.scale;
    boxes.push({
      minX: tree.x - trunkR,
      maxX: tree.x + trunkR,
      minZ: tree.z - trunkR,
      maxZ: tree.z + trunkR,
    });
  }

  // Placed furniture & medical equipment AABBs (inset slightly so movement flows past edges cleanly)
  for (const item of placedItems) {
    // Walkable rugs, stone pathways, and elevated wall-mounted items never block floor movement
    if (
      item.catalogId === 'floor_rug' ||
      item.catalogId === 'stone_pathway' ||
      WALL_DECOR_IDS.has(item.catalogId)
    ) {
      continue;
    }

    const fp = itemFootprints.get(item.catalogId) || { w: 1, d: 1 };
    const w = item.rotation % 2 === 0 ? fp.w : fp.d;
    const d = item.rotation % 2 === 0 ? fp.d : fp.w;
    if (item.catalogId === 'file_cabinet') {
      // bookshelf.glb is wide & shallow (~0.68m x 0.22m); keep collider tight along its facing depth
      // so staff can step right up to the open shelf to pick medical charts.
      const insetX = item.rotation % 2 === 0 ? 0.15 : 0.33;
      const insetZ = item.rotation % 2 === 0 ? 0.33 : 0.15;
      boxes.push({
        minX: item.gridX + insetX,
        maxX: item.gridX + w - insetX,
        minZ: item.gridY + insetZ,
        maxZ: item.gridY + d - insetZ,
        itemId: item.instanceId,
      });
      continue;
    }
    const inset =
      item.catalogId === 'exercise_mat'
        ? 0.24
        : item.catalogId === 'waste_bin' ||
            item.catalogId === 'doctor_stool' ||
            item.catalogId === 'sanitizing_kiosk' ||
            item.catalogId === 'water_cooler'
          ? 0.23
          : item.catalogId === 'wheelchair_bay' ||
              item.catalogId === 'exercise_bike' ||
              item.catalogId === 'tens_unit' ||
              item.catalogId === 'ultrasound_unit' ||
              item.catalogId === 'laser_hilt' ||
              item.catalogId === 'swd_unit' ||
              item.catalogId === 'shockwave_eswt' ||
              item.catalogId === 'emg_biofeedback' ||
              item.catalogId === 'cryo_unit' ||
              item.catalogId === 'paraffin_bath' ||
              item.catalogId === 'pt_toolkit_cart' ||
              item.catalogId === 'infrared_lamp'
            ? 0.16
            : item.catalogId === 'coffee_table'
              ? 0.17
              : item.catalogId === 'waiting_chairs' ||
                  item.catalogId === 'lounge_chair' ||
                  item.catalogId === 'luxury_chair' ||
                  item.catalogId === 'park_bench'
                ? 0.1
                : item.catalogId === 'flower_bed' ||
                    item.catalogId === 'garden_lamp' ||
                    item.catalogId === 'garden_spot_lamp'
                  ? 0.14
                  : 0.1;
    boxes.push({
      minX: item.gridX + inset,
      maxX: item.gridX + w - inset,
      minZ: item.gridY + inset,
      maxZ: item.gridY + d - inset,
      itemId: item.instanceId,
    });
  }

  return boxes;
}

function circleIntersectsBox(cx: number, cz: number, r: number, box: ObstacleBox): boolean {
  const nearestX = Math.max(box.minX, Math.min(cx, box.maxX));
  const nearestZ = Math.max(box.minZ, Math.min(cz, box.maxZ));
  const dx = cx - nearestX;
  const dz = cz - nearestZ;
  return dx * dx + dz * dz < r * r;
}

export function isWorldWalkable(
  wx: number,
  wz: number,
  radius: number,
  boxes: ObstacleBox[],
  ignoreItemId?: string
): boolean {
  if (wx < -8.0 || wx > 37.8 || wz < -5.5 || wz > 28.0) return false;
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    if (ignoreItemId && b.itemId === ignoreItemId) continue;
    if (circleIntersectsBox(wx, wz, radius, b)) return false;
  }
  return true;
}

export function isTileWalkable(
  tx: number,
  ty: number,
  radius: number,
  boxes: ObstacleBox[],
  ignoreItemId?: string
): boolean {
  return isWorldWalkable(tx + 0.5, ty + 0.5, radius, boxes, ignoreItemId);
}

/**
 * Finds the nearest unobstructed world point when a character is displaced by newly placed/moved furniture.
 */
export function findNearestWalkableWorld(
  wx: number,
  wz: number,
  radius: number,
  boxes: ObstacleBox[],
  ignoreItemId?: string
): { x: number; z: number } {
  if (isWorldWalkable(wx, wz, radius, boxes, ignoreItemId)) {
    return { x: wx, z: wz };
  }
  for (let r = 0.25; r <= 3.5; r += 0.25) {
    for (let a = 0; a < 16; a++) {
      const ang = (a / 16) * Math.PI * 2;
      const cx = wx + Math.cos(ang) * r;
      const cz = wz + Math.sin(ang) * r;
      if (isWorldWalkable(cx, cz, radius, boxes, ignoreItemId)) {
        return { x: cx, z: cz };
      }
    }
  }
  return { x: wx, z: wz };
}

export function findNearestWalkableTile(
  tx: number,
  ty: number,
  radius: number,
  boxes: ObstacleBox[],
  ignoreItemId?: string
): { x: number; y: number } {
  const res = findNearestWalkableWorld(tx + 0.5, ty + 0.5, radius, boxes, ignoreItemId);
  return { x: res.x - 0.5, y: res.z - 0.5 };
}

export interface WaitSeatSlot {
  seatKey: string;
  itemId: string;
  catalogId: string;
  /** Exact world coordinate of the seat center minus 0.5 (tile space). */
  seatTileX: number;
  seatTileY: number;
  /** Exact walkable standing approach coordinate right in front of the seat (tile space). */
  approachTileX: number;
  approachTileY: number;
  facingRad: number;
  seatHeight: number;
  isOutdoor: boolean;
}

export function rotateItemLocalPoint(
  item: Pick<PlacedItem, 'gridX' | 'gridY' | 'rotation'>,
  baseWidth: number,
  baseDepth: number,
  lx: number,
  lz: number
): { x: number; z: number } {
  const effW = item.rotation % 2 === 0 ? baseWidth : baseDepth;
  const effD = item.rotation % 2 === 0 ? baseDepth : baseWidth;
  const cx = item.gridX + effW / 2;
  const cz = item.gridY + effD / 2;
  const ry = (-item.rotation * Math.PI) / 2;
  return {
    x: cx + Math.cos(ry) * lx + Math.sin(ry) * lz,
    z: cz - Math.sin(ry) * lx + Math.cos(ry) * lz,
  };
}

export const RECEPTION_CHAIR_LOCAL_X = -0.23;
export const RECEPTION_CHAIR_LOCAL_Z = -0.34;
export const RECEPTION_CHAIR_SEAT_HEIGHT = 0.37;

export interface ReceptionDeskPose {
  seatWorldX: number;
  seatWorldZ: number;
  seatTileX: number;
  seatTileY: number;
  seatFacingRad: number;
  seatHeight: number;
  deskFileWorldX: number;
  deskFileWorldZ: number;
  approachCandidates: Array<{ x: number; y: number }>;
  placeCandidates: Array<{ x: number; y: number }>;
  checkinCandidates: Array<{ x: number; y: number }>;
}

/**
 * Shared exact coordinate & facing solver for the reception desk chair, staff approach,
 * file placement spots, and patient check-in spots across all 4 rotations and fractional placements.
 */
export function getReceptionDeskPose(desk: PlacedItem): ReceptionDeskPose {
  const seatPt = rotateItemLocalPoint(
    desk,
    2,
    1,
    RECEPTION_CHAIR_LOCAL_X,
    RECEPTION_CHAIR_LOCAL_Z
  );
  const deskFilePt = rotateItemLocalPoint(
    desk,
    2,
    1,
    RECEPTION_CHAIR_LOCAL_X - 0.3,
    0.08
  );
  const seatFacingRad = (-desk.rotation * Math.PI) / 2;
  const localApproaches: Array<[number, number]> = [
    [-0.23, -0.78],
    [-1.16, -0.32],
    [1.16, -0.32],
    [0.42, -0.78],
    [-1.16, 0.32],
    [1.16, 0.32],
  ];
  const localPlaceSpots: Array<[number, number]> = [
    [-1.12, 0.06],
    [-1.12, -0.26],
    [-0.48, -0.78],
    [-0.23, -0.78],
    [1.12, 0.06],
  ];
  const localCheckins: Array<[number, number]> = [
    [0.0, 0.86],
    [-0.48, 0.86],
    [0.52, 0.86],
  ];

  return {
    seatWorldX: seatPt.x,
    seatWorldZ: seatPt.z,
    seatTileX: seatPt.x - 0.5,
    seatTileY: seatPt.z - 0.5,
    seatFacingRad,
    seatHeight: RECEPTION_CHAIR_SEAT_HEIGHT,
    deskFileWorldX: deskFilePt.x,
    deskFileWorldZ: deskFilePt.z,
    approachCandidates: localApproaches.map(([lx, lz]) => {
      const p = rotateItemLocalPoint(desk, 2, 1, lx, lz);
      return { x: p.x - 0.5, y: p.z - 0.5 };
    }),
    placeCandidates: localPlaceSpots.map(([lx, lz]) => {
      const p = rotateItemLocalPoint(desk, 2, 1, lx, lz);
      return { x: p.x - 0.5, y: p.z - 0.5 };
    }),
    checkinCandidates: localCheckins.map(([lx, lz]) => {
      const p = rotateItemLocalPoint(desk, 2, 1, lx, lz);
      return { x: p.x - 0.5, y: p.z - 0.5 };
    }),
  };
}

export function getCabinetApproachPoints(cabinet: PlacedItem): Array<{
  x: number;
  y: number;
  facingRad: number;
}> {
  // Stand right in front of the slim shelf face (+Z local) with reachable side fallbacks
  const localSpots: Array<[number, number]> = [
    [0, 0.42],
    [0.2, 0.42],
    [-0.2, 0.42],
    [0.58, 0],
    [-0.58, 0],
    [0, -0.42],
  ];
  const cabCenterX = cabinet.gridX + 0.5;
  const cabCenterZ = cabinet.gridY + 0.5;
  return localSpots.map(([lx, lz]) => {
    const pt = rotateItemLocalPoint(cabinet, 1, 1, lx, lz);
    return {
      x: pt.x - 0.5,
      y: pt.z - 0.5,
      facingRad: Math.atan2(cabCenterX - pt.x, cabCenterZ - pt.z),
    };
  });
}

function rotateLocalSeatPoint(
  cx: number,
  cz: number,
  rot: 0 | 1 | 2 | 3,
  lx: number,
  lz: number
): { x: number; z: number } {
  const ry = (-rot * Math.PI) / 2;
  return {
    x: cx + Math.cos(ry) * lx + Math.sin(ry) * lz,
    z: cz - Math.sin(ry) * lx + Math.cos(ry) * lz,
  };
}

/**
 * Generates exact seat cushions + unobstructed front approach points for every waiting seat
 * (3 simultaneous seats on waiting_chairs, 2 on park_bench, 1 on lounge_chair & luxury_chair).
 * When obstacleBoxes are supplied, flexibly probes closer/slightly angled front clearances so
 * chairs near coffee tables or room walls remain reliably usable.
 */
export function buildWaitSeatSlots(
  placedItems: PlacedItem[],
  rooms: ClinicRoom[],
  obstacleBoxes?: ObstacleBox[]
): WaitSeatSlot[] {
  const seats: WaitSeatSlot[] = [];

  const isApproachOk = (
    wx: number,
    wz: number,
    room: ClinicRoom | undefined,
    seatItemId: string
  ): boolean => {
    if (room) {
      if (
        wx < room.minX + 0.16 ||
        wx > room.maxX + 0.84 ||
        wz < room.minY + 0.16 ||
        wz > room.maxY + 0.84
      ) {
        return false;
      }
    }
    if (!obstacleBoxes) return true;
    return isWorldWalkable(wx, wz, 0.16, obstacleBoxes, seatItemId);
  };

  for (const item of placedItems) {
    const room = rooms.find(
      (r) =>
        item.gridX >= r.minX - 0.05 &&
        item.gridX < r.maxX + 1 &&
        item.gridY >= r.minY - 0.05 &&
        item.gridY < r.maxY + 1
    );
    if (room && !room.unlocked) continue;

    if (item.catalogId === 'waiting_chairs') {
      const effW = item.rotation % 2 === 0 ? 2 : 1;
      const effD = item.rotation % 2 === 0 ? 1 : 2;
      const cx = item.gridX + effW / 2;
      const cz = item.gridY + effD / 2;
      const facingRad = (-item.rotation * Math.PI) / 2;
      const slotXs = [-0.62, 0, 0.62];
      for (let i = 0; i < slotXs.length; i++) {
        const seatPt = rotateLocalSeatPoint(cx, cz, item.rotation, slotXs[i], -0.015);
        let chosenApp = rotateLocalSeatPoint(cx, cz, item.rotation, slotXs[i], 0.76);
        if (obstacleBoxes) {
          const offsets: Array<[number, number]> = [
            [slotXs[i], 0.76],
            [slotXs[i], 0.64],
            [slotXs[i], 0.56],
            [slotXs[i], 0.48],
            [slotXs[i], 0.88],
            [slotXs[i] + 0.14, 0.72],
            [slotXs[i] - 0.14, 0.72],
          ];
          for (const [lx, lz] of offsets) {
            const cand = rotateLocalSeatPoint(cx, cz, item.rotation, lx, lz);
            if (isApproachOk(cand.x, cand.z, room, item.instanceId)) {
              chosenApp = cand;
              break;
            }
          }
        }
        seats.push({
          seatKey: `${item.instanceId}_${i}`,
          itemId: item.instanceId,
          catalogId: item.catalogId,
          seatTileX: seatPt.x - 0.5,
          seatTileY: seatPt.z - 0.5,
          approachTileX: chosenApp.x - 0.5,
          approachTileY: chosenApp.z - 0.5,
          facingRad,
          seatHeight: 0.375,
          isOutdoor: !room,
        });
      }
    } else if (item.catalogId === 'park_bench') {
      const effW = item.rotation % 2 === 0 ? 1 : 2;
      const effD = item.rotation % 2 === 0 ? 2 : 1;
      const cx = item.gridX + effW / 2;
      const cz = item.gridY + effD / 2;
      const facingRad = Math.PI / 2 - (item.rotation * Math.PI) / 2;
      const slotZs = [-0.36, 0.36];
      for (let i = 0; i < slotZs.length; i++) {
        const seatPt = rotateLocalSeatPoint(cx, cz, item.rotation, 0.02, slotZs[i]);
        let chosenApp = rotateLocalSeatPoint(cx, cz, item.rotation, 0.68, slotZs[i]);
        if (obstacleBoxes) {
          for (const lx of [0.68, 0.58, 0.50, 0.80]) {
            const cand = rotateLocalSeatPoint(cx, cz, item.rotation, lx, slotZs[i]);
            if (isApproachOk(cand.x, cand.z, room, item.instanceId)) {
              chosenApp = cand;
              break;
            }
          }
        }
        seats.push({
          seatKey: `${item.instanceId}_${i}`,
          itemId: item.instanceId,
          catalogId: item.catalogId,
          seatTileX: seatPt.x - 0.5,
          seatTileY: seatPt.z - 0.5,
          approachTileX: chosenApp.x - 0.5,
          approachTileY: chosenApp.z - 0.5,
          facingRad,
          seatHeight: 0.396,
          isOutdoor: !room,
        });
      }
    } else if (item.catalogId === 'lounge_chair' || item.catalogId === 'luxury_chair') {
      const cx = item.gridX + 0.5;
      const cz = item.gridY + 0.5;
      const facingRad = (-item.rotation * Math.PI) / 2;
      const isLux = item.catalogId === 'luxury_chair';
      const seatPt = rotateLocalSeatPoint(cx, cz, item.rotation, 0, isLux ? 0.062 : 0.037);
      let chosenApp = rotateLocalSeatPoint(cx, cz, item.rotation, 0, 0.72);
      if (obstacleBoxes) {
        const offsets: Array<[number, number]> = [
          [0, 0.72],
          [0, 0.60],
          [0, 0.52],
          [0, 0.84],
          [0.18, 0.64],
          [-0.18, 0.64],
        ];
        for (const [lx, lz] of offsets) {
          const cand = rotateLocalSeatPoint(cx, cz, item.rotation, lx, lz);
          if (isApproachOk(cand.x, cand.z, room, item.instanceId)) {
            chosenApp = cand;
            break;
          }
        }
      }
      seats.push({
        seatKey: `${item.instanceId}_0`,
        itemId: item.instanceId,
        catalogId: item.catalogId,
        seatTileX: seatPt.x - 0.5,
        seatTileY: seatPt.z - 0.5,
        approachTileX: chosenApp.x - 0.5,
        approachTileY: chosenApp.z - 0.5,
        facingRad,
        seatHeight: isLux ? 0.396 : 0.377,
        isOutdoor: !room,
      });
    }
  }

  return seats;
}

export const LYING_STATION_SPRITES = new Set([
  'treatment_bed',
  'traction_table',
  'magnetotherapy',
  'exercise_mat',
  'tilt_table',
]);

export interface TreatmentBedPose {
  edgeSign: 1 | -1;
  edgeX: number;
  edgeZ: number;
  edgeFacing: number;
  bedCenterX: number;
  bedCenterZ: number;
  stationFacing: number;
  approachTileX: number;
  approachTileY: number;
}

/**
 * Computes exact bedside sitting edge, lying center, and unobstructed walkable bedside approach
 * for all lying treatment stations across all 4 rotations.
 */
export function getTreatmentBedPose(
  station: PlacedItem,
  sprite: string,
  baseWidth: number,
  baseDepth: number,
  boxes: ObstacleBox[],
  fromWorldX?: number,
  fromWorldZ?: number
): TreatmentBedPose {
  const effW = station.rotation % 2 === 0 ? baseWidth : baseDepth;
  const effD = station.rotation % 2 === 0 ? baseDepth : baseWidth;
  const cx = station.gridX + effW / 2;
  const cz = station.gridY + effD / 2;
  const rotPt = (lx: number, lz: number) => rotateLocalSeatPoint(cx, cz, station.rotation, lx, lz);

  const bedCenter =
    sprite === 'tilt_table'
      ? rotPt(0.074, 0)
      : sprite === 'traction_table'
        ? rotPt(-0.066, 0)
        : { x: cx, z: cz };

  const evalSide = (sign: 1 | -1) => {
    const probe = rotPt(0, sign * 0.56);
    const probeClear = isWorldWalkable(probe.x, probe.z, 0.15, boxes, station.instanceId);
    let chosenApp: { x: number; z: number } | null = null;
    for (const d of [0.74, 0.64, 0.56]) {
      for (const ox of [0, 0.28, -0.28]) {
        const cand = rotPt(ox, sign * d);
        if (isWorldWalkable(cand.x, cand.z, 0.17, boxes, station.instanceId)) {
          chosenApp = cand;
          break;
        }
      }
      if (chosenApp) break;
    }
    const dist =
      fromWorldX !== undefined && fromWorldZ !== undefined && chosenApp
        ? Math.hypot(chosenApp.x - fromWorldX, chosenApp.z - fromWorldZ)
        : 0;
    return {
      sign,
      ok: probeClear && chosenApp !== null,
      hasApp: chosenApp !== null,
      app: chosenApp ?? rotPt(0, sign * 0.72),
      dist,
    };
  };

  const posSide = evalSide(1);
  const negSide = evalSide(-1);

  let chosen = posSide;
  if (posSide.ok && negSide.ok) {
    if (fromWorldX !== undefined && fromWorldZ !== undefined && negSide.dist + 0.15 < posSide.dist) {
      chosen = negSide;
    } else {
      chosen = posSide;
    }
  } else if (negSide.ok) {
    chosen = negSide;
  } else if (posSide.ok) {
    chosen = posSide;
  } else if (negSide.hasApp && !posSide.hasApp) {
    chosen = negSide;
  }

  let approachWorld = chosen.app;
  if (!chosen.hasApp) {
    // Fallback if both long edges sit beside walls/other gear: pick closest walkable bedside/foot tile
    let foundFallback = false;
    for (const [lx, lz] of [
      [effW * 0.5 + 0.34, 0],
      [-effW * 0.5 - 0.34, 0],
      [0.45, chosen.sign * 0.68],
      [-0.45, chosen.sign * 0.68],
    ] as Array<[number, number]>) {
      const cand = rotPt(lx, lz);
      if (isWorldWalkable(cand.x, cand.z, 0.17, boxes, station.instanceId)) {
        approachWorld = cand;
        foundFallback = true;
        break;
      }
    }
    if (!foundFallback) {
      const safe = findNearestWalkableWorld(chosen.app.x, chosen.app.z, 0.18, boxes, station.instanceId);
      approachWorld = { x: safe.x, z: safe.z };
    }
  }

  const edgeSign = chosen.sign;
  const edgeOffsetZ =
    sprite === 'exercise_mat' ? 0.22 : sprite === 'treatment_bed' ? 0.24 : 0.27;
  const edgePt = rotPt(0, edgeSign * edgeOffsetZ);
  const edgeFacing =
    edgeSign === 1
      ? (-station.rotation * Math.PI) / 2
      : Math.PI - (station.rotation * Math.PI) / 2;
  const stationFacing = Math.PI / 2 - (station.rotation * Math.PI) / 2;

  return {
    edgeSign,
    edgeX: edgePt.x,
    edgeZ: edgePt.z,
    edgeFacing,
    bedCenterX: bedCenter.x,
    bedCenterZ: bedCenter.z,
    stationFacing,
    approachTileX: approachWorld.x - 0.5,
    approachTileY: approachWorld.z - 0.5,
  };
}

/**
 * Returns a reliable walkable target tile for any treatment station (bedside for beds/tables,
 * open standing/mount tile for standing & seated equipment).
 */
export function getStationApproachTarget(
  station: PlacedItem,
  sprite: string,
  baseWidth: number,
  baseDepth: number,
  boxes: ObstacleBox[],
  fromWorldX?: number,
  fromWorldZ?: number
): { x: number; y: number } {
  if (LYING_STATION_SPRITES.has(sprite)) {
    const pose = getTreatmentBedPose(
      station,
      sprite,
      baseWidth,
      baseDepth,
      boxes,
      fromWorldX,
      fromWorldZ
    );
    return { x: pose.approachTileX, y: pose.approachTileY };
  }

  const effW = station.rotation % 2 === 0 ? baseWidth : baseDepth;
  const effD = station.rotation % 2 === 0 ? baseDepth : baseWidth;
  const cx = station.gridX + effW / 2;
  const cz = station.gridY + effD / 2;
  const rotPt = (lx: number, lz: number) => rotateLocalSeatPoint(cx, cz, station.rotation, lx, lz);

  if (sprite === 'exercise_bike' || sprite === 'treadmill' || sprite === 'parallel_bars' || sprite === 'balance_trainer') {
    for (const [lx, lz] of [
      [0, effD * 0.5 + 0.34],
      [0, -effD * 0.5 - 0.34],
      [effW * 0.5 + 0.34, 0],
      [-effW * 0.5 - 0.34, 0],
    ] as Array<[number, number]>) {
      const pt = rotPt(lx, lz);
      if (isWorldWalkable(pt.x, pt.z, 0.17, boxes, station.instanceId)) {
        return { x: pt.x - 0.5, y: pt.z - 0.5 };
      }
    }
    return { x: cx - 0.5, y: cz - 0.5 };
  }

  const frontZ = sprite === 'wall_bars' ? 0.32 : 0.62;
  for (const [lx, lz] of [
    [0, frontZ],
    [0.62, 0],
    [-0.62, 0],
    [0, -frontZ],
  ] as Array<[number, number]>) {
    const pt = rotPt(lx, lz);
    if (isWorldWalkable(pt.x, pt.z, 0.17, boxes, station.instanceId)) {
      return { x: pt.x - 0.5, y: pt.z - 0.5 };
    }
  }
  const safe = findNearestWalkableWorld(cx, cz, 0.18, boxes, station.instanceId);
  return { x: safe.x - 0.5, y: safe.z - 0.5 };
}

/**
 * Resolves continuous free-form motion from (fromWX, fromWZ) toward (toWX, toWZ)
 * with anti-tunneling sub-steps and smooth wall-sliding so actors never clip walls or furniture.
 */
export function resolveWorldStep(
  fromWX: number,
  fromWZ: number,
  toWX: number,
  toWZ: number,
  radius: number,
  boxes: ObstacleBox[],
  ignoreItemId?: string
): { x: number; z: number; blocked: boolean } {
  let cx = fromWX;
  let cz = fromWZ;

  // First, recover gently if spawned/nudged overlapping a box edge
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      if (ignoreItemId && b.itemId === ignoreItemId) continue;
      if (!circleIntersectsBox(cx, cz, radius, b)) continue;
      const nearestX = Math.max(b.minX, Math.min(cx, b.maxX));
      const nearestZ = Math.max(b.minZ, Math.min(cz, b.maxZ));
      const dx = cx - nearestX;
      const dz = cz - nearestZ;
      const d = Math.hypot(dx, dz);
      if (d > 1e-5) {
        const push = radius - d + 0.005;
        cx += (dx / d) * push;
        cz += (dz / d) * push;
      } else {
        // Inside AABB: push out along nearest edge
        const dLeft = Math.abs(cx - b.minX);
        const dRight = Math.abs(b.maxX - cx);
        const dTop = Math.abs(cz - b.minZ);
        const dBot = Math.abs(b.maxZ - cz);
        const minEdge = Math.min(dLeft, dRight, dTop, dBot);
        if (minEdge === dLeft) cx = b.minX - radius - 0.005;
        else if (minEdge === dRight) cx = b.maxX + radius + 0.005;
        else if (minEdge === dTop) cz = b.minZ - radius - 0.005;
        else cz = b.maxZ + radius + 0.005;
      }
    }
  }

  const totalDx = toWX - cx;
  const totalDz = toWZ - cz;
  const dist = Math.hypot(totalDx, totalDz);
  if (dist < 1e-5) {
    return { x: cx, z: cz, blocked: false };
  }

  const subSteps = Math.max(1, Math.ceil(dist / 0.07));
  const stepX = totalDx / subSteps;
  const stepZ = totalDz / subSteps;
  let blocked = false;

  for (let s = 0; s < subSteps; s++) {
    const candX = cx + stepX;
    const candZ = cz + stepZ;
    if (isWorldWalkable(candX, candZ, radius, boxes, ignoreItemId)) {
      cx = candX;
      cz = candZ;
    } else {
      blocked = true;
      // Try sliding along X and Z independently
      let slid = false;
      if (Math.abs(stepX) > 1e-5 && isWorldWalkable(cx + stepX, cz, radius, boxes, ignoreItemId)) {
        cx += stepX;
        slid = true;
      }
      if (Math.abs(stepZ) > 1e-5 && isWorldWalkable(cx, cz + stepZ, radius, boxes, ignoreItemId)) {
        cz += stepZ;
        slid = true;
      }
      if (!slid) break;
    }
  }

  return { x: cx, z: cz, blocked };
}

export function resolveTileStep(
  fromTX: number,
  fromTY: number,
  toTX: number,
  toTY: number,
  radius: number,
  boxes: ObstacleBox[],
  ignoreItemId?: string
): { x: number; y: number; blocked: boolean } {
  const res = resolveWorldStep(
    fromTX + 0.5,
    fromTY + 0.5,
    toTX + 0.5,
    toTY + 0.5,
    radius,
    boxes,
    ignoreItemId
  );
  return { x: res.x - 0.5, y: res.z - 0.5, blocked: res.blocked };
}

/**
 * Checks whether a straight line in tile space stays clear of obstacle boxes and locked rooms.
 */
export function hasContinuousLineOfSight(
  tx0: number,
  ty0: number,
  tx1: number,
  ty1: number,
  radius: number,
  boxes: ObstacleBox[],
  ignoreItemId?: string
): boolean {
  const dist = Math.hypot(tx1 - tx0, ty1 - ty0);
  const steps = Math.max(2, Math.ceil(dist * 6));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const wx = tx0 + (tx1 - tx0) * t + 0.5;
    const wz = ty0 + (ty1 - ty0) * t + 0.5;
    if (!isWorldWalkable(wx, wz, radius, boxes, ignoreItemId)) {
      return false;
    }
  }
  return true;
}

/**
 * Checks whether movement between two adjacent tiles (fromX, fromY) -> (toX, toY)
 * is allowed across clinic walls, fence openings, and unlocked rooms.
 */
export function canStepBetween(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  rooms: ClinicRoom[]
): boolean {
  if (toX < -7 || toX > 37 || toY < -5 || toY > 26) return false;

  // Handle diagonal step cleanly by requiring both orthogonal legs clear
  if (fromX !== toX && fromY !== toY) {
    return (
      canStepBetween(fromX, fromY, toX, fromY, rooms) &&
      canStepBetween(toX, fromY, toX, toY, rooms) &&
      canStepBetween(fromX, fromY, fromX, toY, rooms) &&
      canStepBetween(fromX, toY, toX, toY, rooms)
    );
  }

  // Building outer boundary: x in [2..21], y in [2..21]
  const inBuilding = (x: number, y: number) => x >= 2 && x <= 21 && y >= 2 && y <= 21;
  const fromIn = inBuilding(fromX, fromY);
  const toIn = inBuilding(toX, toY);

  // Crossing building exterior wall
  if (fromIn !== toIn) {
    // Main grand sliding glass entrance doors at x=21 <-> x=22, y=14 or y=15
    if (
      ((fromX === 21 && toX === 22) || (fromX === 22 && toX === 21)) &&
      (fromY === 14 || fromY === 15)
    ) {
      return true;
    }
    return false;
  }

  // Outer perimeter courtyard fence at x = 27 (runs z=2..22, with front gate permanently open at y=14..15)
  if ((fromX === 26 && toX === 27) || (fromX === 27 && toX === 26)) {
    if (fromY >= 2 && fromY <= 21 && fromY !== 14 && fromY !== 15) return false;
  }

  // Courtyard side fence walls at y = 21/22 and y = 1/2 (x = 22..26)
  if ((fromX >= 22 && fromX <= 26) || (toX >= 22 && toX <= 26)) {
    if ((fromY === 21 && toY === 22) || (fromY === 22 && toY === 21)) return false;
    if ((fromY === 2 && toY === 1) || (fromY === 1 && toY === 2)) return false;
  }

  // If moving inside building, check room lock status and normal 1-tile interior doors
  if (toIn) {
    const toRoom = rooms.find(
      (r) => toX >= r.minX && toX <= r.maxX && toY >= r.minY && toY <= r.maxY
    );
    if (toRoom && !toRoom.unlocked) return false;

    const fromRoom = rooms.find(
      (r) => fromX >= r.minX && fromX <= r.maxX && fromY >= r.minY && fromY <= r.maxY
    );

    if (fromRoom && toRoom && fromRoom.id !== toRoom.id) {
      // Single door between room_reception and room_bay_1 at x=11 <-> x=12, y=14
      if (
        ((fromX === 11 && toX === 12) || (fromX === 12 && toX === 11)) &&
        fromY === 14
      ) {
        return true;
      }
      // Single door between room_bay_1 and room_gym at x=6, y=9 <-> y=10
      if (
        ((fromY === 9 && toY === 10) || (fromY === 10 && toY === 9)) &&
        fromX === 6
      ) {
        return true;
      }
      // Single door between room_reception and room_specialty_2 at x=16, y=9 <-> y=10
      if (
        ((fromY === 9 && toY === 10) || (fromY === 10 && toY === 9)) &&
        fromX === 16
      ) {
        return true;
      }
      // Single door between room_gym and room_specialty_2 at x=11 <-> x=12, y=5
      if (
        ((fromX === 11 && toX === 12) || (fromX === 12 && toX === 11)) &&
        fromY === 5
      ) {
        return true;
      }
      return false;
    }
  }

  return true;
}

function hasLineOfSight(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  rooms: ClinicRoom[],
  blocked: Set<string>,
  boxes?: ObstacleBox[],
  ignoreItemId?: string,
  allowIgnoreForSegment = false
): boolean {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(3, Math.ceil(dist * 6));
  let prevX = Math.round(x0);
  let prevY = Math.round(y0);
  const segIgnore = allowIgnoreForSegment ? ignoreItemId : undefined;

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const fx = x0 + (x1 - x0) * t;
    const fy = y0 + (y1 - y0) * t;
    if (boxes && i < steps) {
      if (!isWorldWalkable(fx + 0.5, fy + 0.5, 0.215, boxes, segIgnore)) {
        return false;
      }
    }
    const cx = Math.round(fx);
    const cy = Math.round(fy);
    if (cx === prevX && cy === prevY) continue;
    if (blocked.has(`${cx},${cy}`) && !(cx === Math.round(x1) && cy === Math.round(y1))) {
      return false;
    }
    if (!canStepBetween(prevX, prevY, cx, cy, rooms)) {
      return false;
    }
    prevX = cx;
    prevY = cy;
  }
  return true;
}

/**
 * 8-directional BFS + continuous obstacle-aware string-pulling so people walk along
 * smooth, natural organic paths without hugging corners or colliding with walls/furniture.
 */
export function findGridPath(
  startX: number,
  startY: number,
  goalX: number,
  goalY: number,
  rooms: ClinicRoom[],
  placedItems: PlacedItem[],
  itemFootprints: Map<string, { w: number; d: number }>,
  obstacleBoxes?: ObstacleBox[],
  ignoreGoalItemId?: string
): Array<{ x: number; y: number }> {
  const boxes = obstacleBoxes || buildObstacleBoxes(rooms, placedItems, itemFootprints);

  // If starting position is slightly overlapping an obstacle (e.g. just placed item), recover cleanly first
  let effStartX = startX;
  let effStartY = startY;
  if (!isWorldWalkable(startX + 0.5, startY + 0.5, 0.2, boxes, ignoreGoalItemId)) {
    const safe = findNearestWalkableTile(startX, startY, 0.22, boxes, ignoreGoalItemId);
    effStartX = safe.x;
    effStartY = safe.y;
  }

  const directDist = Math.hypot(goalX - effStartX, goalY - effStartY);
  if (directDist < 0.22) return [];

  let sx = Math.round(effStartX);
  let sy = Math.round(effStartY);
  const gx = Math.round(goalX);
  const gy = Math.round(goalY);

  // Build blocked set for furniture, courtyard shrubs, and exterior doctor villa pad
  const blocked = new Set<string>([
    '22,3',
    '22,12',
    '26,3',
    '26,20',
  ]);
  for (let vx = 4; vx <= 9; vx++) {
    for (let vy = -7; vy <= -2; vy++) {
      blocked.add(`${vx},${vy}`);
    }
  }
  for (const item of placedItems) {
    if (
      item.catalogId === 'floor_rug' ||
      item.catalogId === 'stone_pathway' ||
      WALL_DECOR_IDS.has(item.catalogId)
    ) {
      continue;
    }
    const fp = itemFootprints.get(item.catalogId) || { w: 1, d: 1 };
    const w = item.rotation % 2 === 0 ? fp.w : fp.d;
    const d = item.rotation % 2 === 0 ? fp.d : fp.w;
    const minTx = Math.floor(item.gridX + 0.15);
    const maxTx = Math.floor(item.gridX + w - 0.15);
    const minTy = Math.floor(item.gridY + 0.15);
    const maxTy = Math.floor(item.gridY + d - 0.15);
    for (let tx = minTx; tx <= maxTx; tx++) {
      for (let ty = minTy; ty <= maxTy; ty++) {
        const isGoalCell =
          Boolean(ignoreGoalItemId && item.instanceId === ignoreGoalItemId) &&
          Math.abs(goalX - tx) < 0.72 &&
          Math.abs(goalY - ty) < 0.72;
        if (!isGoalCell && !(tx === sx && ty === sy)) {
          blocked.add(`${tx},${ty}`);
        }
      }
    }
  }

  // Always prefer exact straight-line shortest path whenever unobstructed
  if (
    hasLineOfSight(
      effStartX,
      effStartY,
      goalX,
      goalY,
      rooms,
      blocked,
      boxes,
      ignoreGoalItemId,
      Boolean(ignoreGoalItemId && directDist < 1.35)
    )
  ) {
    return [{ x: goalX, y: goalY }];
  }

  if (sx === gx && sy === gy) {
    return [{ x: goalX, y: goalY }];
  }

  // If rounded start cell is inside an obstacle tile, nudge sx/sy to best adjacent free tile
  if (blocked.has(`${sx},${sy}`)) {
    for (const [ox, oy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]) {
      if (!blocked.has(`${sx + ox},${sy + oy}`) && canStepBetween(sx, sy, sx + ox, sy + oy, rooms)) {
        sx += ox;
        sy += oy;
        break;
      }
    }
  }

  const startKey = `${sx},${sy}`;
  const gScore = new Map<string, number>([[startKey, 0]]);
  const parent = new Map<string, string>();
  const closed = new Set<string>();
  const heap: Array<{ x: number; y: number; g: number; f: number; key: string }> = [
    { x: sx, y: sy, g: 0, f: Math.hypot(gx - sx, gy - sy), key: startKey },
  ];
  const heapPush = (node: { x: number; y: number; g: number; f: number; key: string }) => {
    heap.push(node);
    let idx = heap.length - 1;
    while (idx > 0) {
      const pIdx = (idx - 1) >> 1;
      if (heap[pIdx].f <= heap[idx].f) break;
      const tmp = heap[pIdx];
      heap[pIdx] = heap[idx];
      heap[idx] = tmp;
      idx = pIdx;
    }
  };
  const heapPop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      let idx = 0;
      const len = heap.length;
      while (true) {
        let best = idx;
        const l = idx * 2 + 1;
        const r = l + 1;
        if (l < len && heap[l].f < heap[best].f) best = l;
        if (r < len && heap[r].f < heap[best].f) best = r;
        if (best === idx) break;
        const tmp = heap[idx];
        heap[idx] = heap[best];
        heap[best] = tmp;
        idx = best;
      }
    }
    return top;
  };

  const dirs: Array<[number, number, number]> = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, Math.SQRT2],
    [1, -1, Math.SQRT2],
    [-1, 1, Math.SQRT2],
    [-1, -1, Math.SQRT2],
  ];

  let found = false;
  let bestFallbackKey = startKey;
  let bestFallbackDist = Math.hypot(sx - gx, sy - gy);
  let expansions = 0;
  while (heap.length > 0 && expansions < 4200) {
    const cur = heapPop();
    if (closed.has(cur.key)) continue;
    closed.add(cur.key);
    expansions++;

    const curDist = Math.hypot(cur.x - gx, cur.y - gy);
    if (curDist < bestFallbackDist) {
      bestFallbackDist = curDist;
      bestFallbackKey = cur.key;
    }
    if (cur.x === gx && cur.y === gy) {
      found = true;
      break;
    }

    for (const [dx, dy, stepCost] of dirs) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      const key = `${nx},${ny}`;
      if (closed.has(key) || blocked.has(key)) continue;
      // Strictly forbid cutting diagonally across a blocked furniture/wall corner
      if (dx !== 0 && dy !== 0) {
        if (blocked.has(`${cur.x + dx},${cur.y}`) || blocked.has(`${cur.x},${cur.y + dy}`)) {
          continue;
        }
      }
      if (!canStepBetween(cur.x, cur.y, nx, ny, rooms)) continue;
      const nearGoalIgnore =
        ignoreGoalItemId && Math.hypot(nx - gx, ny - gy) <= 1.25
          ? ignoreGoalItemId
          : undefined;
      if (!(nx === gx && ny === gy) && !isTileWalkable(nx, ny, 0.18, boxes, nearGoalIgnore)) continue;

      const tentativeG = cur.g + stepCost;
      const prevBestG = gScore.get(key);
      if (prevBestG !== undefined && tentativeG >= prevBestG - 1e-6) continue;

      gScore.set(key, tentativeG);
      parent.set(key, cur.key);
      const h = Math.hypot(gx - nx, gy - ny);
      // Slight cross-product tie-breaker favors clean straight lines over unnecessary stair-stepping
      const crossTie =
        Math.abs((nx - gx) * (sy - gy) - (sx - gx) * (ny - gy)) * 0.0005;
      heapPush({ x: nx, y: ny, g: tentativeG, f: tentativeG + h * 1.001 + crossTie, key });
    }
  }

  const rawPath: Array<{ x: number; y: number }> = [];
  let curKey = found ? `${gx},${gy}` : bestFallbackKey;
  while (curKey !== `${sx},${sy}`) {
    const [px, py] = curKey.split(',').map(Number);
    rawPath.unshift({ x: px, y: py });
    const prev = parent.get(curKey);
    if (!prev) break;
    curKey = prev;
  }

  if (found && rawPath.length > 0) {
    rawPath[rawPath.length - 1] = { x: goalX, y: goalY };
  } else if (rawPath.length === 0) {
    return [];
  }

  if (rawPath.length <= 1) return rawPath;

  // String-pulling pass: skip redundant intermediate nodes ONLY when clear of obstacles (never skip through target item from afar)
  const fullNodes = [{ x: effStartX, y: effStartY }, ...rawPath];
  const smoothed: Array<{ x: number; y: number }> = [];
  let anchorIdx = 0;
  while (anchorIdx < fullNodes.length - 1) {
    let furthestIdx = anchorIdx + 1;
    for (let probe = fullNodes.length - 1; probe > anchorIdx + 1; probe--) {
      const isFinalGoalProbe = probe === fullNodes.length - 1;
      const probeDist = Math.hypot(
        fullNodes[probe].x - fullNodes[anchorIdx].x,
        fullNodes[probe].y - fullNodes[anchorIdx].y
      );
      const allowGoalIgnore = Boolean(isFinalGoalProbe && ignoreGoalItemId && probeDist < 1.55);
      if (
        hasLineOfSight(
          fullNodes[anchorIdx].x,
          fullNodes[anchorIdx].y,
          fullNodes[probe].x,
          fullNodes[probe].y,
          rooms,
          blocked,
          boxes,
          ignoreGoalItemId,
          allowGoalIgnore
        )
      ) {
        furthestIdx = probe;
        break;
      }
    }
    smoothed.push(fullNodes[furthestIdx]);
    anchorIdx = furthestIdx;
  }

  return smoothed;
}
