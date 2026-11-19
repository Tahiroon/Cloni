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

/**
 * Builds world-space AABB collision boxes matching the 3D walls, doors, fences,
 * fountain, doctor villa, locked wings, and placed furniture.
 */
export function buildObstacleBoxes(
  rooms: ClinicRoom[],
  placedItems: PlacedItem[],
  itemFootprints: Map<string, { w: number; d: number }>
): ObstacleBox[] {
  const boxes: ObstacleBox[] = [];
  const halfWall = 0.11;

  const unlockedSet = new Set(rooms.filter((r) => r.unlocked).map((r) => r.id));

  // Outer Perimeter Walls (x: 2..22, z: 2..22)
  // North back wall z = 2
  boxes.push({ minX: 1.88, maxX: 22.12, minZ: 2 - halfWall, maxZ: 2 + halfWall });
  // West back wall x = 2
  boxes.push({ minX: 2 - halfWall, maxX: 2 + halfWall, minZ: 1.88, maxZ: 22.12 });
  // South front knee wall z = 22
  boxes.push({ minX: 1.88, maxX: 22.12, minZ: 22 - halfWall, maxZ: 22 + halfWall });
  // East storefront wall x = 22 with automatic double-door opening z = 14.08..15.92
  boxes.push({ minX: 22 - halfWall, maxX: 22 + halfWall, minZ: 1.88, maxZ: 14.08 });
  boxes.push({ minX: 22 - halfWall, maxX: 22 + halfWall, minZ: 15.92, maxZ: 22.12 });

  // Interior horizontal partition z = 10
  // Doors at x = 6.08..6.92 (door_bay_west) and x = 16.08..16.92 (door_rec_east)
  const bayNorthOpen = unlockedSet.has('room_gym');
  const recNorthOpen = unlockedSet.has('room_specialty_2');
  if (bayNorthOpen) {
    boxes.push({ minX: 2.0, maxX: 6.08, minZ: 10 - 0.09, maxZ: 10 + 0.09 });
    boxes.push({ minX: 6.92, maxX: 12.0, minZ: 10 - 0.09, maxZ: 10 + 0.09 });
  } else {
    boxes.push({ minX: 2.0, maxX: 12.0, minZ: 10 - 0.09, maxZ: 10 + 0.09 });
  }
  if (recNorthOpen) {
    boxes.push({ minX: 12.0, maxX: 16.08, minZ: 10 - 0.09, maxZ: 10 + 0.09 });
    boxes.push({ minX: 16.92, maxX: 22.0, minZ: 10 - 0.09, maxZ: 10 + 0.09 });
  } else {
    boxes.push({ minX: 12.0, maxX: 22.0, minZ: 10 - 0.09, maxZ: 10 + 0.09 });
  }

  // Interior vertical partition x = 12
  // Doors at z = 5.08..5.92 (door_west_east) and z = 14.08..14.92 (door_reception_bay)
  const northLinkOpen = unlockedSet.has('room_gym') && unlockedSet.has('room_specialty_2');
  if (northLinkOpen) {
    boxes.push({ minX: 12 - 0.09, maxX: 12 + 0.09, minZ: 2.0, maxZ: 5.08 });
    boxes.push({ minX: 12 - 0.09, maxX: 12 + 0.09, minZ: 5.92, maxZ: 10.0 });
  } else {
    boxes.push({ minX: 12 - 0.09, maxX: 12 + 0.09, minZ: 2.0, maxZ: 10.0 });
  }
  boxes.push({ minX: 12 - 0.09, maxX: 12 + 0.09, minZ: 10.0, maxZ: 14.08 });
  boxes.push({ minX: 12 - 0.09, maxX: 12 + 0.09, minZ: 14.92, maxZ: 22.0 });

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

  // Garden Lane Rustic Benches along far eastern verge
  for (const bz of [7.8, 19.8]) {
    boxes.push({ minX: 37.85, maxX: 38.65, minZ: bz - 0.85, maxZ: bz + 0.85 });
  }

  // Doctor's Residence Villa behind clinic
  boxes.push({ minX: 4.8, maxX: 9.7, minZ: -6.5, maxZ: -1.9 });

  // Placed furniture & medical equipment AABBs (inset slightly so movement flows past edges cleanly)
  for (const item of placedItems) {
    // Walkable carpets/rugs never block movement
    if (item.catalogId === 'floor_rug') continue;

    const fp = itemFootprints.get(item.catalogId) || { w: 1, d: 1 };
    const w = item.rotation % 2 === 0 ? fp.w : fp.d;
    const d = item.rotation % 2 === 0 ? fp.d : fp.w;
    const inset =
      item.catalogId === 'wall_sconce_lamp'
        ? 0.38
        : item.catalogId === 'exercise_mat'
          ? 0.25
          : item.catalogId === 'waste_bin' ||
              item.catalogId === 'doctor_stool' ||
              item.catalogId === 'sanitizing_kiosk'
            ? 0.24
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
  if (wx < -1.5 || wx > 37.4 || wz < -1.5 || wz > 27.5) return false;
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
  if (toX < 0 || toX > 36 || toY < 0 || toY >= GRID_SIZE) return false;

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
  ignoreItemId?: string
): boolean {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(2, Math.ceil(dist * 4));
  let prevX = Math.round(x0);
  let prevY = Math.round(y0);

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const fx = x0 + (x1 - x0) * t;
    const fy = y0 + (y1 - y0) * t;
    if (boxes && i < steps) {
      if (!isWorldWalkable(fx + 0.5, fy + 0.5, 0.27, boxes, ignoreItemId)) {
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
 * smooth, natural organic diagonals without hugging corners or colliding with walls/furniture.
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
  const sx = Math.round(startX);
  const sy = Math.round(startY);
  const gx = Math.round(goalX);
  const gy = Math.round(goalY);

  if (sx === gx && sy === gy) return [];

  // Build blocked set for furniture, exterior doctor villa pad, and courtyard fountain
  const blocked = new Set<string>(['24,7', '25,7', '24,8', '25,8']);
  for (const item of placedItems) {
    const fp = itemFootprints.get(item.catalogId) || { w: 1, d: 1 };
    const w = item.rotation % 2 === 0 ? fp.w : fp.d;
    const d = item.rotation % 2 === 0 ? fp.d : fp.w;
    for (let dx = 0; dx < w; dx++) {
      for (let dy = 0; dy < d; dy++) {
        const tx = item.gridX + dx;
        const ty = item.gridY + dy;
        if (!(tx === gx && ty === gy) && !(tx === sx && ty === sy)) {
          blocked.add(`${tx},${ty}`);
        }
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
  while (queue.length > 0) {
    const cur = queue.shift()!;
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
      if (!canStepBetween(cur.x, cur.y, nx, ny, rooms)) continue;

      visited.add(key);
      parent.set(key, `${cur.x},${cur.y}`);
      queue.push({ x: nx, y: ny });
    }
  }

  if (!found) {
    return [{ x: gx, y: gy }];
  }

  const rawPath: Array<{ x: number; y: number }> = [];
  let curKey = `${gx},${gy}`;
  while (curKey !== `${sx},${sy}`) {
    const [px, py] = curKey.split(',').map(Number);
    rawPath.unshift({ x: px, y: py });
    const prev = parent.get(curKey);
    if (!prev) break;
    curKey = prev;
  }

  if (rawPath.length <= 2) return rawPath;

  const boxes = obstacleBoxes || buildObstacleBoxes(rooms, placedItems, itemFootprints);

  // String-pulling pass: skip redundant intermediate nodes whenever direct line of sight is unobstructed
  const fullNodes = [{ x: startX, y: startY }, ...rawPath];
  const smoothed: Array<{ x: number; y: number }> = [];
  let anchorIdx = 0;
  while (anchorIdx < fullNodes.length - 1) {
    let furthestIdx = anchorIdx + 1;
    for (let probe = fullNodes.length - 1; probe > anchorIdx + 1; probe--) {
      if (
        hasLineOfSight(
          fullNodes[anchorIdx].x,
          fullNodes[anchorIdx].y,
          fullNodes[probe].x,
          fullNodes[probe].y,
          rooms,
          blocked,
          boxes,
          ignoreGoalItemId
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
