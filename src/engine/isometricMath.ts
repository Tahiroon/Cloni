import { GRID_SIZE } from '../data/catalog';
import { ClinicRoom, PlacedItem } from '../types/clinic';

export const TILE_W = 68;
export const TILE_H = 34;

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
  // Keep central reflecting fountain basin in courtyard clear
  if ((tx === 24 || tx === 25) && (ty === 7 || ty === 8)) return false;
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
  for (const tree of WORLD_TREES) {
    if (removedSet.has(tree.id)) continue;
    const tx = Math.floor(tree.x);
    const ty = Math.floor(tree.z);
    for (let dx = 0; dx < effW; dx++) {
      for (let dy = 0; dy < effD; dy++) {
        const cx = gx + dx;
        const cy = gy + dy;
        if (cx === tx && cy === ty) return true;
        if (Math.hypot(cx + 0.5 - tree.x, cy + 0.5 - tree.z) < 0.72) return true;
      }
    }
  }
  return false;
}

/**
 * Returns all valid wall-mount orientations (0..3) at grid tile (gx, gy)
 * inside unlocked rooms, excluding door openings and built-in wall signage.
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

  // 0 = West face (x = gx, facing +X into room)
  if (gx === 2 && gy >= 2 && gy <= 21) {
    // Built-in anatomy chart sits at x=2.175, z=15.8 (gy=15)
    if (gy !== 15) rots.push(0);
  } else if (gx === 12 && gy >= 2 && gy <= 21) {
    // Exclude doors (gy=5, 14) and built-in plaques (cert z=12.0, logo z=18.6)
    const isDoor = gy === 5 || gy === 14;
    const isBuiltIn = gy === 11 || gy === 12 || gy === 17 || gy === 18 || gy === 19;
    if (!isDoor && !isBuiltIn) rots.push(0);
  }

  // 1 = North face (z = gy, facing +Z into room)
  if (gy === 2 && gx >= 2 && gx <= 21) {
    rots.push(1);
  } else if (gy === 10 && gx >= 2 && gx <= 21) {
    const isDoor = gx === 6 || gx === 16;
    if (!isDoor) rots.push(1);
  }

  // 2 = East face (x = gx + 1, facing -X into room)
  if (gx === 11 && gy >= 2 && gy <= 21) {
    const isDoor = gy === 5 || gy === 14;
    if (!isDoor) rots.push(2);
  }

  // 3 = South face (z = gy + 1, facing -Z into room)
  if (gy === 9 && gx >= 2 && gx <= 21) {
    const isDoor = gx === 6 || gx === 16;
    if (!isDoor) rots.push(3);
  }

  return rots;
}

export function isValidWallMount(
  gx: number,
  gy: number,
  rotation: 0 | 1 | 2 | 3,
  rooms: ClinicRoom[]
): boolean {
  return getValidWallRotationsForTile(gx, gy, rooms).includes(rotation);
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

  // Courtyard Reflecting Pool / Fountain (24..25, 7..8)
  boxes.push({ minX: 24.06, maxX: 25.94, minZ: 7.06, maxZ: 8.94 });

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
    const inset =
      item.catalogId === 'exercise_mat'
        ? 0.24
        : item.catalogId === 'waste_bin' ||
            item.catalogId === 'doctor_stool' ||
            item.catalogId === 'sanitizing_kiosk'
          ? 0.22
          : item.catalogId === 'waiting_chairs' ||
              item.catalogId === 'lounge_chair' ||
              item.catalogId === 'luxury_chair' ||
              item.catalogId === 'park_bench'
            ? 0.08
            : item.catalogId === 'flower_bed' ||
                item.catalogId === 'garden_lamp' ||
                item.catalogId === 'garden_spot_lamp'
              ? 0.14
              : 0.09;
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
 */
export function buildWaitSeatSlots(
  placedItems: PlacedItem[],
  rooms: ClinicRoom[]
): WaitSeatSlot[] {
  const seats: WaitSeatSlot[] = [];

  for (const item of placedItems) {
    const room = rooms.find(
      (r) =>
        item.gridX >= r.minX &&
        item.gridX <= r.maxX &&
        item.gridY >= r.minY &&
        item.gridY <= r.maxY
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
        const seatPt = rotateLocalSeatPoint(cx, cz, item.rotation, slotXs[i], 0.05);
        const appPt = rotateLocalSeatPoint(cx, cz, item.rotation, slotXs[i], 0.76);
        seats.push({
          seatKey: `${item.instanceId}_${i}`,
          itemId: item.instanceId,
          catalogId: item.catalogId,
          seatTileX: seatPt.x - 0.5,
          seatTileY: seatPt.z - 0.5,
          approachTileX: appPt.x - 0.5,
          approachTileY: appPt.z - 0.5,
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
        const seatPt = rotateLocalSeatPoint(cx, cz, item.rotation, 0.06, slotZs[i]);
        const appPt = rotateLocalSeatPoint(cx, cz, item.rotation, 0.68, slotZs[i]);
        seats.push({
          seatKey: `${item.instanceId}_${i}`,
          itemId: item.instanceId,
          catalogId: item.catalogId,
          seatTileX: seatPt.x - 0.5,
          seatTileY: seatPt.z - 0.5,
          approachTileX: appPt.x - 0.5,
          approachTileY: appPt.z - 0.5,
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
      const seatPt = rotateLocalSeatPoint(cx, cz, item.rotation, 0, isLux ? 0.06 : 0.04);
      const appPt = rotateLocalSeatPoint(cx, cz, item.rotation, 0, 0.74);
      seats.push({
        seatKey: `${item.instanceId}_0`,
        itemId: item.instanceId,
        catalogId: item.catalogId,
        seatTileX: seatPt.x - 0.5,
        seatTileY: seatPt.z - 0.5,
        approachTileX: appPt.x - 0.5,
        approachTileY: appPt.z - 0.5,
        facingRad,
        seatHeight: isLux ? 0.445 : 0.41,
        isOutdoor: !room,
      });
    }
  }

  return seats;
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
  if (toX < -7 || toX > 37 || toY < -5 || toY >= GRID_SIZE) return false;

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
      if (!isWorldWalkable(fx + 0.5, fy + 0.5, 0.27, boxes, segIgnore)) {
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

  let sx = Math.round(effStartX);
  let sy = Math.round(effStartY);
  const gx = Math.round(goalX);
  const gy = Math.round(goalY);

  if (Math.hypot(goalX - effStartX, goalY - effStartY) < 0.22) return [];
  if (sx === gx && sy === gy) {
    return [{ x: goalX, y: goalY }];
  }

  // Build blocked set for furniture, courtyard shrubs, exterior doctor villa pad, and courtyard fountain
  const blocked = new Set<string>([
    '24,7',
    '25,7',
    '24,8',
    '25,8',
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
    for (let dx = 0; dx < w; dx++) {
      for (let dy = 0; dy < d; dy++) {
        const tx = item.gridX + dx;
        const ty = item.gridY + dy;
        const isGoalCell = tx === gx && ty === gy && Boolean(ignoreGoalItemId && item.instanceId === ignoreGoalItemId);
        if (!isGoalCell && !(tx === sx && ty === sy)) {
          blocked.add(`${tx},${ty}`);
        }
      }
    }
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

  const queue: Array<{ x: number; y: number }> = [{ x: sx, y: sy }];
  const visited = new Set<string>([`${sx},${sy}`]);
  const parent = new Map<string, string>();
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];

  let found = false;
  let bestFallbackKey = `${sx},${sy}`;
  let bestFallbackDist = Math.hypot(sx - gx, sy - gy);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const curDist = Math.hypot(cur.x - gx, cur.y - gy);
    if (curDist < bestFallbackDist) {
      bestFallbackDist = curDist;
      bestFallbackKey = `${cur.x},${cur.y}`;
    }
    if (cur.x === gx && cur.y === gy) {
      found = true;
      break;
    }

    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      const key = `${nx},${ny}`;
      if (visited.has(key)) continue;
      if (blocked.has(key)) continue;
      // Strictly forbid cutting diagonally across a blocked furniture/wall corner
      if (dx !== 0 && dy !== 0) {
        if (blocked.has(`${cur.x + dx},${cur.y}`) || blocked.has(`${cur.x},${cur.y + dy}`)) {
          continue;
        }
      }
      if (!canStepBetween(cur.x, cur.y, nx, ny, rooms)) continue;
      if (!(nx === gx && ny === gy) && !isTileWalkable(nx, ny, 0.18, boxes)) continue;

      visited.add(key);
      parent.set(key, `${cur.x},${cur.y}`);
      queue.push({ x: nx, y: ny });
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
      const allowGoalIgnore = Boolean(isFinalGoalProbe && ignoreGoalItemId && probeDist < 1.35);
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
