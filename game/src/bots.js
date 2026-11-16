// Bot AI: waypoint navigation, line-of-sight engagements, burst fire with
// real hitscan rays, and objective play (plant for attackers, defuse and site
// holds for defenders). Bots are deliberately beatable: they react slowly,
// miss moving targets often, and telegraph their bursts.
import { WAYPOINTS, findPath, nearestWaypoint, resolveCircle, raySolids, hasLineOfSight } from './mapdata.js';
import { makeWeaponInstance, damageAt, shotSpread } from './weapons.js';
import { randRange, turnToward, angleDiff, clamp } from './rng.js';

export const EYE_HEIGHT = 1.62;
export const BOT_RADIUS = 0.45;

const V_NAMES = ['Rook', 'Havoc', 'Sable', 'Juno'];
const E_NAMES = ['Vex', 'Onyx', 'Dagger', 'Mira', 'Slate'];

// Ray vs sphere; returns t or Infinity.
export function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const lx = cx - ox, ly = cy - oy, lz = cz - oz;
  const tca = lx * dx + ly * dy + lz * dz;
  if (tca < 0) return Infinity;
  const d2 = lx * lx + ly * ly + lz * lz - tca * tca;
  const r2 = r * r;
  if (d2 > r2) return Infinity;
  return tca - Math.sqrt(r2 - d2);
}

// A fighter's hittable volumes: head sphere + body sphere.
export function rayFighter(ox, oy, oz, dx, dy, dz, f) {
  const th = raySphere(ox, oy, oz, dx, dy, dz, f.x, 1.62, f.z, 0.26);
  const tb = raySphere(ox, oy, oz, dx, dy, dz, f.x, 1.05, f.z, 0.48);
  if (th === Infinity) return tb === Infinity ? null : { t: tb, head: false };
  if (tb === Infinity) return { t: th, head: true };
  return th < tb ? { t: th, head: true } : { t: tb, head: false };
}

export class Bot {
  constructor(team, index, spawn, weaponDef, mesh, rng) {
    this.team = team;
    this.name = team === 'V' ? V_NAMES[index] : E_NAMES[index];
    this.x = spawn.x; this.z = spawn.z;
    this.yaw = spawn.yaw;
    this.hp = 100;
    this.armor = 0;
    this.alive = true;
    this.weapon = makeWeaponInstance(weaponDef);
    this.mesh = mesh;
    this.rng = rng;
    this.skill = randRange(rng, 0.75, 1.15); // reaction + accuracy scale
    this.path = [];
    this.pathIdx = 0;
    this.state = 'advance';
    this.targetSite = team === 'V' ? (rng() < 0.5 ? 'A' : 'B') : null;
    this.engageTarget = null;
    this.reaction = 0;
    this.burstLeft = 0;
    this.burstPause = 0;
    this.strafeDir = rng() < 0.5 ? 1 : -1;
    this.strafeTimer = 0;
    this.holdUntil = 0;
    this.plantProgress = 0;
    this.defuseProgress = 0;
    this.isCarrier = false;
    this.moveSpeed = randRange(rng, 3.1, 3.7);
    this.walkPhase = rng() * 6;
    this.lastShotAt = -10;
    this.aimError = 0;
    this.seenEnemyPos = null;
  }

  reset(spawn, weaponDef) {
    this.x = spawn.x; this.z = spawn.z;
    this.yaw = spawn.yaw;
    this.hp = 100; this.armor = 0; this.alive = true;
    this.weapon = makeWeaponInstance(weaponDef);
    this.path = []; this.pathIdx = 0;
    this.state = 'advance';
    this.engageTarget = null;
    this.reaction = 0; this.burstLeft = 0; this.burstPause = 0;
    this.plantProgress = 0; this.defuseProgress = 0;
    this.isCarrier = false;
    this.targetSite = this.team === 'V' ? (this.rng() < 0.5 ? 'A' : 'B') : null;
  }

  eyePos() {
    return { x: this.x, y: EYE_HEIGHT, z: this.z };
  }

  // Nearest living enemy this bot can see.
  acquire(ctx) {
    let best = null;
    let bestScore = Infinity;
    for (const f of ctx.fighters) {
      if (!f.alive || f.team === this.team) continue;
      const dx = f.x - this.x, dz = f.z - this.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 58) continue;
      const ang = Math.atan2(dx, dz);
      // Bots face +z at yaw 0; yaw is the direction they look.
      const facing = Math.atan2(Math.sin(this.yaw), Math.cos(this.yaw));
      const diff = Math.abs(angleDiff(facing, ang));
      if (diff > 1.25) continue; // ~140 degree vision cone
      const eye = this.eyePos();
      if (!hasLineOfSight(eye.x, eye.y, eye.z, f.x, 1.3, f.z, ctx.solids)) continue;
      const score = dist + (f.isPlayer ? -4 : 0);
      if (score < bestScore) { bestScore = score; best = f; }
    }
    return best;
  }

  setDestination(ctx, tx, tz) {
    const from = nearestWaypoint(this.x, this.z);
    const to = nearestWaypoint(tx, tz);
    this.path = findPath(from, to);
    this.pathIdx = 0;
  }

  followPath(dt, ctx) {
    if (this.pathIdx >= this.path.length) return true;
    const wp = WAYPOINTS[this.path[this.pathIdx]];
    const dx = wp.x - this.x, dz = wp.z - this.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.7) { this.pathIdx++; return this.pathIdx >= this.path.length; }
    const sp = this.moveSpeed * (this.state === 'engage' ? 0.55 : 1);
    const step = Math.min(dist, sp * dt);
    this.x += (dx / dist) * step;
    this.z += (dz / dist) * step;
    this.yaw = turnToward(this.yaw, Math.atan2(dx, dz), 5 * dt);
    return false;
  }

  // Objective target for this bot right now.
  objectivePoint(ctx) {
    if (ctx.planted) {
      // Attackers guard the planted charge; defenders rush it.
      const site = ctx.plantedSite;
      if (this.team === 'V') return { x: site.x + randRange(this.rng, -4, 4), z: site.z + randRange(this.rng, -4, 4) };
      return { x: site.x, z: site.z };
    }
    if (this.team === 'V') {
      const site = ctx.sites[this.targetSite];
      return { x: site.x, z: site.z };
    }
    // Defenders: hold a post near a site, drift between two waypoints.
    const site = this.rng() < 0.5 ? ctx.sites.A : ctx.sites.B;
    return { x: site.x + randRange(this.rng, -6, 6), z: site.z + randRange(this.rng, -3, 5) };
  }

  update(dt, ctx) {
    if (!this.alive) return;
    this.walkPhase += dt * 9;
    this.weapon.cooldown -= dt;
    if (this.weapon.reloading > 0) {
      this.weapon.reloading -= dt;
      if (this.weapon.reloading <= 0) {
        this.weapon.mag = this.weapon.def.magSize;
        if (this.weapon.reserve !== Infinity) {
          this.weapon.reserve = Math.max(0, this.weapon.reserve - this.weapon.def.magSize);
        }
        this.weapon.reloading = 0;
      }
    }

    // Separation from nearby fighters so bots do not stack.
    for (const f of ctx.fighters) {
      if (f === this || !f.alive) continue;
      const dx = this.x - f.x, dz = this.z - f.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.01 && d < 1.1) {
        this.x += (dx / d) * (1.1 - d) * 0.5;
        this.z += (dz / d) * (1.1 - d) * 0.5;
      }
    }
    const fixed = resolveCircle(this.x, this.z, BOT_RADIUS, ctx.solids);
    this.x = fixed.x; this.z = fixed.z;

    const now = ctx.time;
    // Planting / defusing takes priority over moving.
    if (this.tryObjective(dt, ctx)) return;

    const seen = this.acquire(ctx);
    if (seen) {
      if (this.engageTarget !== seen) {
        this.engageTarget = seen;
        this.reaction = randRange(this.rng, 0.45, 0.85) / this.skill;
        this.burstLeft = 0;
        this.burstPause = 0;
      }
      this.state = 'engage';
      this.seenEnemyPos = { x: seen.x, z: seen.z };
      const dx = seen.x - this.x, dz = seen.z - this.z;
      const wantYaw = Math.atan2(dx, dz);
      this.yaw = turnToward(this.yaw, wantYaw, 6 * dt);
      // Strafe while engaging.
      this.strafeTimer -= dt;
      if (this.strafeTimer <= 0) {
        this.strafeTimer = randRange(this.rng, 0.5, 1.3);
        this.strafeDir = this.rng() < 0.5 ? 1 : -1;
      }
      const side = this.strafeDir;
      const sx = Math.cos(this.yaw) * side, sz = -Math.sin(this.yaw) * side;
      const dist = Math.hypot(dx, dz);
      let mx = sx, mz = sz;
      if (dist > 26) { mx += dx / dist; mz += dz / dist; }
      if (dist < 8) { mx -= dx / dist; mz -= dz / dist; }
      const ml = Math.hypot(mx, mz) || 1;
      this.x += (mx / ml) * this.moveSpeed * 0.55 * dt;
      this.z += (mz / ml) * this.moveSpeed * 0.55 * dt;
      const f2 = resolveCircle(this.x, this.z, BOT_RADIUS, ctx.solids);
      this.x = f2.x; this.z = f2.z;
      this.fireAt(seen, dt, ctx);
      return;
    }
    this.engageTarget = null;
    this.state = 'advance';

    // Idle hold after arriving, then pick a new drift point.
    if (now < this.holdUntil) {
      this.yaw = turnToward(this.yaw, this.holdYaw || this.yaw, 2 * dt);
      return;
    }
    if (this.pathIdx >= this.path.length) {
      const p = this.objectivePoint(ctx);
      this.setDestination(ctx, p.x, p.z);
      // Small chance to hold and watch a lane instead of marching.
      if (this.rng() < 0.22) {
        this.holdUntil = now + randRange(this.rng, 1.5, 3.5);
        this.holdYaw = Math.atan2(p.x - this.x, p.z - this.z);
        return;
      }
    }
    this.followPath(dt, ctx);
  }

  // Returns true when the bot is busy planting/defusing this tick.
  tryObjective(dt, ctx) {
    if (ctx.planted) {
      if (this.team === 'E') {
        const site = ctx.plantedSite;
        const d = Math.hypot(site.x - this.x, site.z - this.z);
        if (d < 3.2 && this.engageTarget === null) {
          this.defuseProgress += dt / 5;
          this.state = 'defuse';
          if (this.defuseProgress >= 1) {
            ctx.onDefused(this);
            this.defuseProgress = 0;
          }
          return true;
        }
        this.defuseProgress = Math.max(0, this.defuseProgress - dt / 2);
      }
      return false;
    }
    if (this.team === 'V' && this.isCarrier) {
      const site = ctx.sites[this.targetSite];
      const d = Math.hypot(site.x - this.x, site.z - this.z);
      if (d < site.r && this.engageTarget === null) {
        this.plantProgress += dt / 4;
        this.state = 'plant';
        if (this.plantProgress >= 1) {
          ctx.onPlanted(this, this.targetSite);
          this.plantProgress = 0;
        }
        return true;
      }
      this.plantProgress = Math.max(0, this.plantProgress - dt / 2);
    }
    return false;
  }

  fireAt(target, dt, ctx) {
    if (this.reaction > 0) { this.reaction -= dt; return; }
    const w = this.weapon;
    if (w.reloading > 0) return;
    if (w.mag <= 0) {
      w.reloading = w.def.reloadTime;
      return;
    }
    if (this.burstPause > 0) { this.burstPause -= dt; return; }
    if (this.burstLeft <= 0) {
      this.burstLeft = this.rng() < 0.3 ? 5 : 3;
      if (w.def.kind === 'sniper' || w.def.kind === 'shotgun') this.burstLeft = 1;
    }
    if (w.cooldown > 0) return;
    w.cooldown = w.def.fireInterval * randRange(this.rng, 1.0, 1.35);
    w.mag--;
    this.burstLeft--;
    if (this.burstLeft <= 0) this.burstPause = randRange(this.rng, 0.35, 0.9) / this.skill;
    this.lastShotAt = ctx.time;

    // Aim with error that grows with distance and target speed.
    const eye = this.eyePos();
    const targetSpeed = target.isPlayer ? (ctx.playerSpeed || 0) : 2.5;
    const dist = Math.hypot(target.x - this.x, target.z - this.z);
    const baseErr = (shotSpread(w.def, targetSpeed > 1.5, false) * 2.4) / this.skill;
    const err = baseErr * (1 + dist / 30) * randRange(this.rng, 0.6, 1.4);
    const aimYaw = Math.atan2(target.x - this.x, target.z - this.z) + (this.rng() - 0.5) * err * 2;
    const aimPitch = Math.atan2(1.3 - EYE_HEIGHT, dist) + (this.rng() - 0.5) * err;
    const dir = {
      x: Math.sin(aimYaw) * Math.cos(aimPitch),
      y: Math.sin(aimPitch),
      z: Math.cos(aimYaw) * Math.cos(aimPitch),
    };
    const pellets = w.def.pellets || 1;
    for (let p = 0; p < pellets; p++) {
      const jitter = p === 0 ? 0 : (w.def.spread * 1.5);
      const d = {
        x: dir.x + (this.rng() - 0.5) * jitter,
        y: dir.y + (this.rng() - 0.5) * jitter,
        z: dir.z + (this.rng() - 0.5) * jitter,
      };
      const len = Math.hypot(d.x, d.y, d.z);
      d.x /= len; d.y /= len; d.z /= len;
      ctx.onBotShot(this, eye, d, w.def);
    }
  }

  takeDamage(amount, from, headshot, ctx) {
    if (!this.alive) return;
    let remaining = amount;
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, remaining * 0.5);
      this.armor -= absorbed;
      remaining -= absorbed;
    }
    this.hp -= remaining;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      ctx.onBotKilled(this, from, headshot);
    }
  }

  // Sync the three.js mesh to the bot's logical state.
  syncMesh() {
    if (!this.mesh) return;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.yaw;
    this.mesh.visible = this.alive;
    if (!this.alive) return;
    const u = this.mesh.userData;
    const swing = Math.sin(this.walkPhase) * 0.5;
    const moving = this.state === 'advance' || this.state === 'engage';
    const amp = moving ? swing : 0;
    u.legL.rotation.x = amp;
    u.legR.rotation.x = -amp;
    u.armL.rotation.x = -1.1 + amp * 0.4;
    u.armR.rotation.x = -1.1 - amp * 0.4;
    // Aim the torso slightly toward the current yaw (mesh faces +z already).
  }
}
