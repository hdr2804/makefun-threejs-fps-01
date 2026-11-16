// ASHFALL YARD map layout. Units are metres; the yard is 64 wide (x: -32..32)
// by 48 deep (z: -24..24). y-up. Every solid is an axis-aligned box so the
// collision and hitscan code can stay exact and cheap.
//
//   z = -24  +------------------ north wall ------------------+
//            |  A-SITE (fuel depot, NE)      B-SITE (SW)     |
//            |  spawn E (defenders, north)                   |
//            |        mid corridor        warehouse          |
//            |  spawn V (attackers, south)                   |
//   z = +24  +------------------------------------------------+
//
// Attackers spawn south, defenders north. Site A sits north-east behind the
// fuel tanks; Site B sits north-west inside the warehouse shell.

export const MAP = {
  width: 64,
  depth: 48,
  wallHeight: 4.2,
  wallThick: 1.0,
};

// Solid boxes: { x, z, w, d, h, y0 } centred on x/z, y0 = base height.
export const SOLIDS = [
  // Perimeter walls.
  { x: 0, z: -24.5, w: 66, d: 1, h: 4.2, y0: 0, kind: 'wall' },
  { x: 0, z: 24.5, w: 66, d: 1, h: 4.2, y0: 0, kind: 'wall' },
  { x: -32.5, z: 0, w: 1, d: 50, h: 4.2, y0: 0, kind: 'wall' },
  { x: 32.5, z: 0, w: 1, d: 50, h: 4.2, y0: 0, kind: 'wall' },
  // Mid wall with two gaps (the classic mid split).
  { x: -18, z: 0, w: 26, d: 1.2, h: 3.4, y0: 0, kind: 'wall' },
  { x: 18, z: 0, w: 26, d: 1.2, h: 3.4, y0: 0, kind: 'wall' },
  // Warehouse shell around Site B (north-west), open to the south.
  { x: -24, z: -18, w: 16, d: 1.2, h: 3.6, y0: 0, kind: 'wall' },
  { x: -31, z: -12, w: 1.2, d: 13, h: 3.6, y0: 0, kind: 'wall' },
  { x: -17, z: -12, w: 1.2, d: 13, h: 3.6, y0: 0, kind: 'wall' },
  // Fuel depot walls around Site A (north-east).
  { x: 24, z: -18, w: 16, d: 1.2, h: 3.6, y0: 0, kind: 'wall' },
  { x: 31, z: -12, w: 1.2, d: 13, h: 3.6, y0: 0, kind: 'wall' },
  { x: 17, z: -12, w: 1.2, d: 13, h: 3.6, y0: 0, kind: 'wall' },
  // Central block (mid control).
  { x: 0, z: -4, w: 8, d: 5, h: 2.6, y0: 0, kind: 'block' },
  { x: 0, z: 8, w: 6, d: 4, h: 2.2, y0: 0, kind: 'block' },
  // Crates and containers (cover).
  { x: -10, z: -8, w: 3, d: 3, h: 1.6, y0: 0, kind: 'crate' },
  { x: 10, z: -8, w: 3, d: 3, h: 1.6, y0: 0, kind: 'crate' },
  { x: -10, z: 12, w: 4, d: 2, h: 1.4, y0: 0, kind: 'crate' },
  { x: 12, z: 12, w: 4, d: 2, h: 1.4, y0: 0, kind: 'crate' },
  { x: -22, z: 6, w: 6, d: 2.4, h: 2.6, y0: 0, kind: 'container' },
  { x: 22, z: 6, w: 6, d: 2.4, h: 2.6, y0: 0, kind: 'container' },
  { x: -6, z: -16, w: 2.4, d: 2.4, h: 1.2, y0: 0, kind: 'crate' },
  { x: 6, z: -16, w: 2.4, d: 2.4, h: 1.2, y0: 0, kind: 'crate' },
  { x: -26, z: -2, w: 2.4, d: 2.4, h: 1.2, y0: 0, kind: 'crate' },
  { x: 26, z: -2, w: 2.4, d: 2.4, h: 1.2, y0: 0, kind: 'crate' },
  { x: -14, z: 18, w: 3, d: 3, h: 1.6, y0: 0, kind: 'crate' },
  { x: 14, z: 18, w: 3, d: 3, h: 1.6, y0: 0, kind: 'crate' },
  { x: 0, z: -20, w: 3, d: 3, h: 1.5, y0: 0, kind: 'crate' },
  // Stacked crates (second level sits on the first; still one AABB each).
  { x: -10, z: -8, w: 2.2, d: 2.2, h: 1.4, y0: 1.6, kind: 'crate' },
  { x: 22, z: 6, w: 4, d: 2, h: 1.6, y0: 2.6, kind: 'container' },
  // Fuel tanks at Site A (cylinders approximated as square colliders).
  { x: 28, z: -16, w: 3.4, d: 3.4, h: 3.0, y0: 0, kind: 'tank' },
  { x: 20, z: -16, w: 3.4, d: 3.4, h: 3.0, y0: 0, kind: 'tank' },
];

// Decorative barrels (no collision, visual only).
export const BARRELS = [
  { x: -28, z: -20 }, { x: -27, z: -18.5 }, { x: 28, z: -15 },
  { x: -4, z: 20 }, { x: -2.4, z: 20.5 }, { x: 16, z: -20 },
  { x: -20, z: -16 }, { x: 8, z: 16 },
];

export const SITES = {
  A: { x: 24, z: -12, r: 4.5, name: 'SITE A — FUEL DEPOT' },
  B: { x: -24, z: -12, r: 4.5, name: 'SITE B — WAREHOUSE' },
};

export const SPAWNS = {
  // Attackers (Vanguard) south, facing north (-z).
  V: [
    { x: -8, z: 20, yaw: Math.PI },
    { x: -4, z: 21, yaw: Math.PI },
    { x: 0, z: 20, yaw: Math.PI },
    { x: 4, z: 21, yaw: Math.PI },
    { x: 8, z: 20, yaw: Math.PI },
  ],
  // Defenders (Ember) north, facing south (+z).
  E: [
    { x: -20, z: -14, yaw: 0 },
    { x: -8, z: -20, yaw: 0 },
    { x: 0, z: -21, yaw: 0 },
    { x: 12, z: -20, yaw: 0 },
    { x: 24, z: -14, yaw: 0 },
  ],
};

// Waypoint graph bots navigate on. Nodes have positions; edges are by index.
export const WAYPOINTS = [
  { x: -8, z: 20 },   // 0  V spawn west
  { x: 0, z: 20 },    // 1  V spawn mid
  { x: 8, z: 20 },    // 2  V spawn east
  { x: -14, z: 12 },  // 3
  { x: 0, z: 13 },    // 4
  { x: 14, z: 12 },   // 5
  { x: -22, z: 6 },   // 6
  { x: 22, z: 6 },    // 7
  { x: -5, z: 4 },    // 8  mid gap west
  { x: 5, z: 4 },     // 9  mid gap east
  { x: 0, z: -10 },   // 10 mid north
  { x: -10, z: -12 }, // 11
  { x: 10, z: -12 },  // 12
  { x: -24, z: -16 }, // 13 Site B
  { x: 24, z: -16 },  // 14 Site A
  { x: -24, z: -8 },  // 15 B approach
  { x: 24, z: -8 },   // 16 A approach
  { x: 0, z: -20 },   // 17 north mid
  { x: -28, z: -6 },  // 18 west lane
  { x: 28, z: -6 },   // 19 east lane
  { x: -14, z: -20 }, // 20
  { x: 14, z: -20 },  // 21
];

export const EDGES = [
  [0, 3], [0, 4], [1, 4], [2, 5], [3, 6], [3, 4], [4, 5], [5, 7],
  [6, 18], [6, 15], [7, 19], [7, 16], [3, 8], [5, 9], [8, 10], [9, 10],
  [8, 11], [9, 12], [10, 17], [11, 13], [11, 15], [12, 14], [12, 16],
  [13, 15], [14, 16], [13, 20], [14, 21], [17, 20], [17, 21], [15, 18],
  [16, 19], [18, 3], [19, 5], [10, 11], [10, 12], [20, 11], [21, 12],
];

// Breadth-first shortest path over the waypoint graph.
export function findPath(fromIdx, toIdx) {
  if (fromIdx === toIdx) return [fromIdx];
  const prev = new Array(WAYPOINTS.length).fill(-1);
  const queue = [fromIdx];
  prev[fromIdx] = fromIdx;
  while (queue.length) {
    const cur = queue.shift();
    for (const [a, b] of EDGES) {
      const nb = a === cur ? b : b === cur ? a : -1;
      if (nb < 0 || prev[nb] !== -1) continue;
      prev[nb] = cur;
      if (nb === toIdx) {
        const path = [nb];
        let n = cur;
        while (n !== fromIdx) { path.unshift(n); n = prev[n]; }
        path.unshift(fromIdx);
        return path;
      }
      queue.push(nb);
    }
  }
  return [fromIdx, toIdx];
}

export function nearestWaypoint(x, z) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < WAYPOINTS.length; i++) {
    const dx = WAYPOINTS[i].x - x;
    const dz = WAYPOINTS[i].z - z;
    const d = dx * dx + dz * dz;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

// Circle (radius r) vs AABB solids: push the circle out. Returns corrected x/z.
export function resolveCircle(x, z, r, solids) {
  for (const s of solids) {
    const minX = s.x - s.w / 2, maxX = s.x + s.w / 2;
    const minZ = s.z - s.d / 2, maxZ = s.z + s.d / 2;
    const cx = Math.max(minX, Math.min(x, maxX));
    const cz = Math.max(minZ, Math.min(z, maxZ));
    const dx = x - cx, dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-9) {
      const d = Math.sqrt(d2);
      x = cx + (dx / d) * r;
      z = cz + (dz / d) * r;
    } else {
      // Centre inside the box: push out along the smallest penetration axis.
      const pl = x - minX, pr = maxX - x, pt = z - minZ, pb = maxZ - z;
      const m = Math.min(pl, pr, pt, pb);
      if (m === pl) x = minX - r;
      else if (m === pr) x = maxX + r;
      else if (m === pt) z = minZ - r;
      else z = maxZ + r;
    }
  }
  return { x, z };
}

// Ray (origin + dir*t, t in [0, maxT]) vs solid boxes (slab test).
// Returns the smallest t hit, or Infinity.
export function raySolids(ox, oy, oz, dx, dy, dz, maxT, solids) {
  let best = Infinity;
  for (const s of solids) {
    const minX = s.x - s.w / 2, maxX = s.x + s.w / 2;
    const minY = s.y0, maxY = s.y0 + s.h;
    const minZ = s.z - s.d / 2, maxZ = s.z + s.d / 2;
    let t0 = 0, t1 = maxT;
    // X slab
    if (Math.abs(dx) < 1e-9) {
      if (ox < minX || ox > maxX) continue;
    } else {
      let ta = (minX - ox) / dx, tb = (maxX - ox) / dx;
      if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; }
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
      if (t0 > t1) continue;
    }
    // Y slab
    if (Math.abs(dy) < 1e-9) {
      if (oy < minY || oy > maxY) continue;
    } else {
      let ta = (minY - oy) / dy, tb = (maxY - oy) / dy;
      if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; }
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
      if (t0 > t1) continue;
    }
    // Z slab
    if (Math.abs(dz) < 1e-9) {
      if (oz < minZ || oz > maxZ) continue;
    } else {
      let ta = (minZ - oz) / dz, tb = (maxZ - oz) / dz;
      if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; }
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
      if (t0 > t1) continue;
    }
    if (t0 < best) best = t0;
  }
  return best;
}

// Line of sight between two points at eye height, ignoring the given solids
// is not needed: walls block, crates below eye height do not (h < 1.6).
export function hasLineOfSight(ax, ay, az, bx, by, bz, solids) {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (dist < 1e-6) return true;
  const t = raySolids(ax, ay, az, dx / dist, dy / dist, dz / dist, dist, solids);
  return t === Infinity;
}
