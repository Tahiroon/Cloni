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
  if (toX < 0 || toX >= GRID_SIZE + 3 || toY < 0 || toY >= GRID_SIZE) return false;

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
  blocked: Set<string>
): boolean {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(2, Math.ceil(dist * 3.5));
  let prevX = Math.round(x0);
  let prevY = Math.round(y0);

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const cx = Math.round(x0 + (x1 - x0) * t);
    const cy = Math.round(y0 + (y1 - y0) * t);
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
 * 8-directional BFS + line-of-sight string-pulling so people walk along natural direct diagonals
 * instead of rigid 90-degree robotic grid staircases.
 */
export function findGridPath(
  startX: number,
  startY: number,
  goalX: number,
  goalY: number,
  rooms: ClinicRoom[],
  placedItems: PlacedItem[],
  itemFootprints: Map<string, { w: number; d: number }>
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

  // String-pulling pass: skip redundant intermediate nodes whenever direct line of sight is unobstructed
  const fullNodes = [{ x: sx, y: sy }, ...rawPath];
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
          blocked
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
