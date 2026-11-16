// ASHFALL YARD — a round-based tactical FPS on three.js.
// Single-player vs bots: 5v5, plant-or-eliminate rounds, buy economy.
// Static files only, no network requests, no build step.
import * as THREE from 'three';
import { MAP, SOLIDS, SITES, SPAWNS, raySolids, resolveCircle } from './mapdata.js';
import { buildWorld, createFighterMesh, createViewmodel, Effects } from './world.js';
import { Bot, EYE_HEIGHT, rayFighter } from './bots.js';
import { WEAPONS, ARMOR_PRICE, BUY_MENU, makeWeaponInstance, damageAt, shotSpread } from './weapons.js';
import { SoundBank } from './audio.js';
import { HUD } from './hud.js';
import { Input } from './input.js';
import { mulberry32, hashSeed, clamp, lerp, randRange } from './rng.js';

window.__ashfallErrors = [];
window.addEventListener('error', (e) => {
  window.__ashfallErrors.push(String(e.message || e.error || 'error'));
});
window.addEventListener('unhandledrejection', (e) => {
  window.__ashfallErrors.push('rejection: ' + String(e.reason));
});

const ROUND_TIME = 100;
const BUY_TIME = 15;
const FUSE_TIME = 35;
const PLANT_TIME = 4;
const DEFUSE_TIME = 5;
const WIN_ROUNDS = 5;
const MAX_ROUNDS = 9;
const EYE = 1.62;

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');
const SEED = hashSeed(params.get('seed') || 'ashfall-1');

class Player {
  constructor() {
    this.isPlayer = true;
    this.team = 'V';
    this.x = 0; this.z = 20;
    this.y = 0; this.vy = 0;
    this.yaw = Math.PI; this.pitch = 0;
    this.hp = 100; this.armor = 0;
    this.alive = true;
    this.money = 800;
    this.owned = new Set(['p9']);
    this.primaryId = null;
    this.slot = 2; // 1 = primary, 2 = pistol
    this.weapons = { 1: null, 2: makeWeaponInstance(WEAPONS.p9) };
    this.kills = 0; this.deaths = 0; this.plants = 0;
    this.shots = 0; this.hits = 0;
    this.lossStreak = 0;
    this.speed = 0;
    this.plantProgress = 0;
    this.defuseProgress = 0;
    this.isCarrier = true;
    this.recoil = 0;
    this.bloom = 0;
    this.stepTimer = 0;
  }

  currentWeapon() { return this.weapons[this.slot]; }

  buyPrimary(id) {
    if (!this.owned.has(id)) this.owned.add(id);
    this.primaryId = id;
    this.weapons[1] = makeWeaponInstance(WEAPONS[id]);
    this.slot = 1;
  }
}

export class Game {
  constructor() {
    this.rng = mulberry32(SEED ^ 0x9e3779b9);
    this.time = 0;
    this.phase = 'menu'; // menu | buy | live | roundEnd | matchEnd
    this.round = 1;
    this.roundWins = { V: 0, E: 0 };
    this.roundTimer = ROUND_TIME;
    this.buyTimer = BUY_TIME;
    this.roundEndTimer = 0;
    this.roundEndReason = '';
    this.planted = false;
    this.plantedSite = null;
    this.plantedSiteKey = null;
    this.fuseTimer = 0;
    this.buyOpen = false;
    this.frozen = false;
    this.freezeAt = 0;
    this.simTime = 0;
    this.sites = SITES;
    this.solids = SOLIDS;
    this.selftestState = null;
    this.selftestResult = '';

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.className = 'webgl';
    document.getElementById('app').appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.08, 220);
    this.scene.add(this.camera);
    buildWorld(this.scene);
    this.effects = new Effects(this.scene);
    this.viewmodel = createViewmodel(this.camera);

    this.sounds = new SoundBank();
    this.hud = new HUD();
    this.input = new Input(this.renderer.domElement);
    this.input.onFirstInteract = () => this.sounds.ensure();
    this.input.onLockChange = (locked) => {
      if (!locked && this.phase === 'live' && !SHOT) this.hud.objective('Click the game to recapture the mouse', 'plant');
    };

    this.player = new Player();
    this.bots = [];
    this.fighters = [this.player];
    this._buildBots();

    this._wireButtons();
    this._applyShotMode();
    window.addEventListener('resize', () => this._onResize());
    this._last = performance.now();
    this._mmTimer = 0;
    this._titleTimer = 0;
    requestAnimationFrame((t) => this._loop(t));
    window.__game = this;
  }

  _buildBots() {
    const defsV = [WEAPONS.vk7, WEAPONS.hornet, WEAPONS.vk7, WEAPONS.breacher];
    const defsE = [WEAPONS.vk7, WEAPONS.longshot, WEAPONS.hornet, WEAPONS.vk7, WEAPONS.breacher];
    for (let i = 0; i < 4; i++) {
      const mesh = createFighterMesh('V', ['Rook', 'Havoc', 'Sable', 'Juno'][i]);
      this.scene.add(mesh);
      const bot = new Bot('V', i, SPAWNS.V[i + 1], defsV[i], mesh, mulberry32(SEED + 11 + i));
      this.bots.push(bot);
      this.fighters.push(bot);
    }
    for (let i = 0; i < 5; i++) {
      const mesh = createFighterMesh('E', ['Vex', 'Onyx', 'Dagger', 'Mira', 'Slate'][i]);
      this.scene.add(mesh);
      const bot = new Bot('E', i, SPAWNS.E[i], defsE[i], mesh, mulberry32(SEED + 101 + i));
      this.bots.push(bot);
      this.fighters.push(bot);
    }
  }

  _wireButtons() {
    document.getElementById('deployBtn').addEventListener('click', () => {
      this.sounds.ensure();
      this.startMatch();
      this.input.requestLock();
    });
    document.getElementById('againBtn').addEventListener('click', () => {
      this.startMatch();
      this.input.requestLock();
    });
  }

  _onResize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  }

  // ---- match / round flow -------------------------------------------------
  startMatch() {
    this.roundWins = { V: 0, E: 0 };
    this.round = 1;
    const p = this.player;
    p.money = 800; p.kills = 0; p.deaths = 0; p.plants = 0;
    p.shots = 0; p.hits = 0; p.lossStreak = 0;
    p.owned = new Set(['p9']);
    p.primaryId = null;
    p.weapons = { 1: null, 2: makeWeaponInstance(WEAPONS.p9) };
    p.slot = 2;
    this.hud.setMenuOpen(false);
    this.hud.setMatchEnd(false);
    this._startBuyPhase();
  }

  _respawnAll() {
    const p = this.player;
    p.x = SPAWNS.V[0].x; p.z = SPAWNS.V[0].z;
    p.y = 0; p.vy = 0;
    p.yaw = SPAWNS.V[0].yaw; p.pitch = 0;
    p.hp = 100; p.alive = true;
    // Armor bought in an earlier round carries over; it is only lost by damage.
    p.plantProgress = 0; p.defuseProgress = 0;
    p.isCarrier = true;
    p.recoil = 0; p.bloom = 0;
    if (!p.weapons[p.slot]) p.slot = 2;
    for (const w of Object.values(p.weapons)) {
      if (w) { w.mag = w.def.magSize; w.reserve = w.def.reserve; w.reloading = 0; w.cooldown = 0; }
    }
    const defsV = [WEAPONS.vk7, WEAPONS.hornet, WEAPONS.vk7, WEAPONS.breacher];
    const defsE = [WEAPONS.vk7, WEAPONS.longshot, WEAPONS.hornet, WEAPONS.vk7, WEAPONS.breacher];
    let vi = 0, ei = 0;
    for (const b of this.bots) {
      const spawn = b.team === 'V' ? SPAWNS.V[vi + 1] : SPAWNS.E[ei];
      b.reset(spawn, b.team === 'V' ? defsV[vi] : defsE[ei]);
      if (b.team === 'V') vi++; else ei++;
      b.armor = this.rng() < 0.4 ? 50 : 0;
      b.syncMesh();
    }
    this.planted = false;
    this.plantedSite = null;
    this.plantedSiteKey = null;
    this.fuseTimer = 0;
  }

  _startBuyPhase() {
    this._respawnAll();
    this.phase = 'buy';
    this.buyTimer = BUY_TIME;
    this.buyOpen = false;
    this.hud.setBuyOpen(false);
    this.hud.hideBanner();
    this.hud.banner(`ROUND ${this.round}`, 'Buy phase — press B to open the shop', '#ffd75e');
    this.hud.objective('Vanguard attacks — plant at <b>Site A</b> or <b>Site B</b>');
    this._syncHud();
  }

  _startLive() {
    this.phase = 'live';
    this.roundTimer = ROUND_TIME;
    this.buyOpen = false;
    this.hud.setBuyOpen(false);
    this.hud.objective('Plant the charge at <b>Site A</b> or <b>Site B</b> — or eliminate Ember');
    this.hud.banner('GO', this.round === 1 ? 'First to 5 rounds takes the match' : '', '#7dd87d');
  }

  _endRound(winner, reason) {
    if (this.phase === 'roundEnd' || this.phase === 'matchEnd') return;
    this.phase = 'roundEnd';
    this.roundEndTimer = 4.5;
    this.roundEndReason = reason;
    this.roundWins[winner]++;
    const p = this.player;
    if (winner === 'V') {
      p.money += 3250;
      p.lossStreak = 0;
      this.sounds.roundWin();
      this.hud.banner('ROUND WON', reason, '#6db3ff');
    } else {
      p.lossStreak++;
      p.money += Math.min(3400, 1900 + 500 * (p.lossStreak - 1));
      this.sounds.roundLose();
      this.hud.banner('ROUND LOST', reason, '#ff7a5c');
    }
    this.hud.objective('');
    this.hud.progress(false);
    this._syncHud();
  }

  _afterRound() {
    if (this.roundWins.V >= WIN_ROUNDS || this.roundWins.E >= WIN_ROUNDS || this.round >= MAX_ROUNDS) {
      this._endMatch();
      return;
    }
    this.round++;
    this._startBuyPhase();
  }

  _endMatch() {
    this.phase = 'matchEnd';
    const winner = this.roundWins.V > this.roundWins.E ? 'V' : 'E';
    const acc = this.player.shots ? Math.round(100 * this.player.hits / this.player.shots) : 0;
    const stats = `Kills ${this.player.kills} · Deaths ${this.player.deaths} · Plants ${this.player.plants} · Accuracy ${acc}%<br>` +
      `Money banked $${this.player.money.toLocaleString('en-US')} · Rounds ${this.roundWins.V}–${this.roundWins.E}`;
    this.hud.showMatchEnd(winner, this.roundWins.V, this.roundWins.E, stats);
    this.input.exitLock();
    if (winner === 'V') this.sounds.roundWin(); else this.sounds.roundLose();
  }

  // ---- economy ------------------------------------------------------------
  _tryBuy(key) {
    const p = this.player;
    const item = BUY_MENU.find((b) => b.key === key);
    if (!item) return;
    if (item.id === 'armor') {
      if (p.armor > 0 || p.money < ARMOR_PRICE) { this.sounds.denied(); return; }
      p.money -= ARMOR_PRICE;
      p.armor = 100;
      this.sounds.buy();
    } else if (item.id === 'ammo') {
      const w = p.weapons[1];
      if (!w || p.money < 400) { this.sounds.denied(); return; }
      p.money -= 400;
      w.reserve = w.def.reserve;
      this.sounds.buy();
    } else {
      const def = WEAPONS[item.id];
      if (p.owned.has(item.id) || p.money < def.price) { this.sounds.denied(); return; }
      p.money -= def.price;
      p.buyPrimary(item.id);
      this.sounds.buy();
    }
    this.hud.buildBuyMenu(p.money, p.owned, p.armor > 0);
    this._syncHud();
  }

  // ---- combat ---------------------------------------------------------------
  _playerEye() {
    const p = this.player;
    return { x: p.x, y: EYE + p.y, z: p.z };
  }

  _playerDir(spreadRad) {
    const p = this.player;
    const cp = Math.cos(p.pitch), sp = Math.sin(p.pitch);
    const cy = Math.sin(p.yaw), sy = Math.cos(p.yaw);
    // yaw measured so that forward = (sin yaw, 0, cos yaw); spawn yaw PI faces -z.
    let dx = sy * cp, dy = sp, dz = cy * cp;
    if (spreadRad > 0) {
      dx += (this.rng() - 0.5) * 2 * spreadRad;
      dy += (this.rng() - 0.5) * 2 * spreadRad;
      dz += (this.rng() - 0.5) * 2 * spreadRad;
      const l = Math.hypot(dx, dy, dz);
      dx /= l; dy /= l; dz /= l;
    }
    return { x: dx, y: dy, z: dz };
  }

  _firePlayer() {
    const p = this.player;
    const w = p.currentWeapon();
    if (!w || w.reloading > 0 || w.cooldown > 0 || !p.alive) return;
    if (w.mag <= 0) {
      this.sounds.dryFire();
      w.cooldown = 0.25;
      return;
    }
    w.mag--;
    w.cooldown = w.def.fireInterval;
    p.shots++;
    const ads = this.input.mouseRight && this.input.locked;
    const moving = p.speed > 0.5;
    const spread = shotSpread(w.def, moving, ads) + p.bloom;
    const eye = this._playerEye();
    const muzzle = new THREE.Vector3();
    this.viewmodel.muzzle.getWorldPosition(muzzle);
    const pellets = w.def.pellets || 1;
    let anyHit = false, anyKill = false;
    for (let i = 0; i < pellets; i++) {
      const dir = this._playerDir(spread);
      const wallT = raySolids(eye.x, eye.y, eye.z, dir.x, dir.y, dir.z, w.def.range, this.solids);
      let bestT = Math.min(wallT, w.def.range);
      let bestBot = null, bestHead = false;
      for (const b of this.bots) {
        if (!b.alive || b.team !== 'E') continue;
        const hit = rayFighter(eye.x, eye.y, eye.z, dir.x, dir.y, dir.z, b);
        if (hit && hit.t < bestT) { bestT = hit.t; bestBot = b; bestHead = hit.head; }
      }
      const end = {
        x: eye.x + dir.x * bestT,
        y: eye.y + dir.y * bestT,
        z: eye.z + dir.z * bestT,
      };
      this.effects.tracer(muzzle, end, w.def.tracerColor);
      if (bestBot) {
        anyHit = true;
        p.hits++;
        const dmg = damageAt(w.def, bestT, bestHead);
        const wasAlive = bestBot.alive;
        bestBot.takeDamage(dmg, this.player, bestHead, this);
        if (wasAlive && !bestBot.alive) anyKill = true;
      } else if (wallT < w.def.range) {
        const n = { x: 0, y: 1, z: 0 };
        this.effects.impact(end, n);
      }
    }
    this.sounds.shot(w.def.kind);
    this.viewmodel.kick = 1;
    this.viewmodel.flash.material.opacity = 1;
    this.viewmodel.flashLight.intensity = 14;
    p.recoil += w.def.recoil;
    p.bloom = Math.min(0.05, p.bloom + w.def.spread * 0.55);
    if (anyHit) {
      this.hud.showHit(anyKill);
      if (anyKill) this.sounds.kill(); else this.sounds.hit();
    }
  }

  // Called by bots when they pull the trigger: resolve the ray.
  onBotShot(bot, eye, dir, def) {
    const wallT = raySolids(eye.x, eye.y, eye.z, dir.x, dir.y, dir.z, def.range, this.solids);
    let bestT = Math.min(wallT, def.range);
    let bestTarget = null, bestHead = false;
    for (const f of this.fighters) {
      if (!f.alive || f === bot || f.team === bot.team) continue;
      const hit = rayFighter(eye.x, eye.y, eye.z, dir.x, dir.y, dir.z, f);
      if (hit && hit.t < bestT) { bestT = hit.t; bestTarget = f; bestHead = hit.head; }
    }
    const from = { x: eye.x + dir.x * 0.4, y: eye.y - 0.12, z: eye.z + dir.z * 0.4 };
    const end = { x: eye.x + dir.x * bestT, y: eye.y + dir.y * bestT, z: eye.z + dir.z * bestT };
    this.effects.tracer(from, end, def.tracerColor);
    const p = this.player;
    const distToPlayer = Math.hypot(bot.x - p.x, bot.z - p.z);
    if (distToPlayer < 45) this.sounds.shot(def.kind, true);
    if (bestTarget) {
      const dmg = damageAt(def, bestT, bestHead);
      if (bestTarget.isPlayer) {
        this._damagePlayer(dmg, bot, bestHead);
      } else {
        bestTarget.takeDamage(dmg, bot, bestHead, this);
      }
    } else if (wallT < def.range) {
      this.effects.impact(end, { x: 0, y: 1, z: 0 });
    }
  }

  onBotKilled(bot, from, headshot) {
    const p = this.player;
    const killer = from && from.isPlayer ? 'You' : from ? from.name : '???';
    const kColor = from && from.team === 'V' ? '#6db3ff' : '#ff7a5c';
    const vColor = bot.team === 'V' ? '#6db3ff' : '#ff7a5c';
    this.hud.killfeedAdd(
      `<span style="color:${kColor}">${killer}</span> ✕ <span style="color:${vColor}">${bot.name}</span>${headshot ? ' <span style="color:#ffd75e">HEADSHOT</span>' : ''}`,
    );
    if (from && from.isPlayer) {
      p.money += 300;
      p.kills++;
      this._syncHud();
    }
    if (bot.isCarrier) {
      // Pass the charge to a living Vanguard bot, or the player.
      const next = this.bots.find((b) => b.alive && b.team === 'V');
      if (next) next.isCarrier = true;
      else if (p.alive) p.isCarrier = true;
    }
    bot.syncMesh();
  }

  onPlanted(bot, siteKey) {
    this.planted = true;
    this.plantedSiteKey = siteKey;
    this.plantedSite = SITES[siteKey];
    this.fuseTimer = FUSE_TIME;
    if (bot.isPlayer) {
      this.player.money += 300;
      this.player.plants++;
    }
    this.sounds.plantBeep(true);
    this.hud.banner('CHARGE PLANTED', `Detonation in ${FUSE_TIME}s — Ember must defuse`, '#ff7a5c');
    this.hud.objective(`Charge planted at <b>Site ${siteKey}</b> — defend it!`);
    this._syncHud();
  }

  onDefused(bot) {
    this.planted = false;
    this.plantedSite = null;
    this._endRound('E', `${bot.name} defused the charge`);
  }

  _damagePlayer(amount, from, headshot) {
    const p = this.player;
    if (!p.alive || this.phase !== 'live') return;
    let remaining = amount;
    if (p.armor > 0) {
      const absorbed = Math.min(p.armor, remaining * 0.5);
      p.armor -= absorbed;
      remaining -= absorbed;
    }
    p.hp -= remaining;
    this.sounds.hurt();
    const ang = Math.atan2(from.x - p.x, from.z - p.z);
    this.hud.showDamageFrom(ang - p.yaw);
    if (p.hp <= 0) {
      p.hp = 0;
      p.alive = false;
      p.deaths++;
      const kColor = from.team === 'V' ? '#6db3ff' : '#ff7a5c';
      this.hud.killfeedAdd(`<span style="color:${kColor}">${from.name}</span> ✕ <span style="color:#6db3ff">You</span>${headshot ? ' <span style="color:#ffd75e">HEADSHOT</span>' : ''}`);
      this.hud.fade(true);
      setTimeout(() => this.hud.fade(false), 600);
      this.input.exitLock();
    }
    this._syncHud();
  }

  // ---- per-frame ------------------------------------------------------------
  _loop(now) {
    requestAnimationFrame((t) => this._loop(t));
    let dt = Math.min(0.05, (now - this._last) / 1000);
    this._last = now;
    if (dt <= 0) dt = 0.016;
    this.time += dt;

    if (!this.frozen) {
      this.simTime += dt;
      // Headless smoke test: software rendering runs few frames per second,
      // so the self-test fast-forwards the simulation (fixed substeps) to
      // reach a round conclusion inside a short virtual-time budget.
      const steps = SHOT === 'selftest' ? 10 : 1;
      for (let i = 0; i < steps; i++) this._update(dt);
    }
    if (SHOT && this.freezeAt > 0 && !this.frozen && this.simTime >= this.freezeAt) {
      this.frozen = true;
      document.title = `SHOT READY ${SHOT} phase=${this.phase} errors=${window.__ashfallErrors.length}`;
    }
    if (!this.frozen) {
      this.effects.update(dt);
      this._updateViewmodel(dt);
    }
    this._syncCamera();
    for (const b of this.bots) b.syncMesh();
    this.renderer.render(this.scene, this.camera);
    this.hud.tick(dt);
    this._mmTimer -= dt;
    if (this._mmTimer <= 0) {
      this._mmTimer = 0.12;
      this.hud.drawMinimap(this.fighters, this.player, this.plantedSite, this.player.isCarrier ? null : null);
    }
    this._titleTimer -= dt;
    if (this._titleTimer <= 0) {
      this._titleTimer = 1;
      if (!SHOT) {
        document.title = `ASHFALL YARD — ${this.phase} R${this.round} ${this.roundWins.V}:${this.roundWins.E}`;
      } else if (this.selftestResult) {
        document.title = this.selftestResult;
      }
    }
    this.input.endFrame();
  }

  _update(dt) {
    const p = this.player;
    const inp = this.input;

    // Global keys
    if (inp.wasPressed('KeyM')) this.sounds.enabled = !this.sounds.enabled;

    if (this.phase === 'menu' || this.phase === 'matchEnd') return;

    if (this.phase === 'buy') {
      this.buyTimer -= dt;
      if (inp.wasPressed('KeyB')) {
        this.buyOpen = !this.buyOpen;
        this.hud.setBuyOpen(this.buyOpen);
        if (this.buyOpen) this.hud.buildBuyMenu(p.money, p.owned, p.armor > 0);
      }
      if (this.buyOpen) {
        for (const item of BUY_MENU) {
          if (inp.wasPressed('Digit' + item.key)) this._tryBuy(item.key);
        }
        if (inp.wasPressed('Escape')) { this.buyOpen = false; this.hud.setBuyOpen(false); }
      }
      if (this.buyTimer <= 0) this._startLive();
      this._syncHud();
      return;
    }

    if (this.phase === 'roundEnd') {
      this.roundEndTimer -= dt;
      if (this.roundEndTimer <= 0) this._afterRound();
      return;
    }

    if (this.phase !== 'live') return;

    // Round timer
    this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      if (!this.planted) this._endRound('E', 'Time expired — Ember holds the yard');
      else this.roundTimer = 0;
    }

    // Planted charge fuse
    if (this.planted) {
      this.fuseTimer -= dt;
      if (Math.ceil(this.fuseTimer) !== Math.ceil(this.fuseTimer + dt)) this.sounds.plantBeep();
      this.hud.objective(`<span class="plant">CHARGE LIVE — detonation in ${Math.ceil(this.fuseTimer)}s</span>`);
      if (this.fuseTimer <= 0) {
        this.effects.explosion({ x: this.plantedSite.x, y: 1, z: this.plantedSite.z });
        this.sounds.explode();
        this._endRound('V', `Charge detonated at Site ${this.plantedSiteKey}`);
        return;
      }
    }

    // --- player movement ---
    const mv = inp.moveVector();
    const look = inp.consumeMouse();
    if (this.input.locked) {
      p.yaw -= look.dx * 0.0021;
      p.pitch = clamp(p.pitch - look.dy * 0.0021, -1.45, 1.45);
    }
    p.recoil = Math.max(0, p.recoil - dt * 0.12);
    p.bloom = Math.max(0, p.bloom - dt * 0.09);
    const walk = inp.down('ShiftLeft') || inp.down('ShiftRight');
    const speed = walk ? 2.7 : 5.3;
    const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
    const fwdX = sin, fwdZ = cos;
    const rightX = cos, rightZ = -sin;
    let vx = (fwdX * mv.y + rightX * mv.x) * speed;
    let vz = (fwdZ * mv.y + rightZ * mv.x) * speed;
    if (p.alive) {
      p.x += vx * dt;
      p.z += vz * dt;
      const fixed = resolveCircle(p.x, p.z, 0.45, this.solids);
      p.x = clamp(fixed.x, -31.5, 31.5);
      p.z = clamp(fixed.z, -23.5, 23.5);
      p.speed = Math.hypot(vx, vz);
      p.stepTimer -= dt * p.speed;
      if (p.speed > 0.5 && p.stepTimer <= 0) { p.stepTimer = 2.4; this.sounds.step(); }
    } else {
      p.speed = 0;
    }
    // Jump / gravity
    if (p.alive && inp.wasPressed('Space') && p.y === 0) p.vy = 5.4;
    if (p.y > 0 || p.vy !== 0) {
      p.vy -= 14 * dt;
      p.y += p.vy * dt;
      if (p.y <= 0) { p.y = 0; p.vy = 0; }
    }

    // --- player weapons ---
    const w = p.currentWeapon();
    if (w) {
      w.cooldown -= dt;
      if (this._pendingShotAt !== null && this._pendingShotAt !== undefined) {
        this._pendingShotAt -= dt;
        if (this._pendingShotAt <= 0) {
          this._pendingShotAt = null;
          this._firePlayer();
        }
      }
      if (w.reloading > 0) {
        w.reloading -= dt;
        if (w.reloading <= 0) {
          w.mag = w.def.magSize;
          if (w.reserve !== Infinity) w.reserve = Math.max(0, w.reserve - w.def.magSize);
          w.reloading = 0;
        }
      }
      if (p.alive) {
        if (inp.wasPressed('KeyR') && w.mag < w.def.magSize && w.reserve !== 0) {
          w.reloading = w.def.reloadTime;
          this.sounds.reload();
        }
        if (inp.wasPressed('Digit1') && p.weapons[1]) p.slot = 1;
        if (inp.wasPressed('Digit2')) p.slot = 2;
        const wantFire = w.def.auto ? inp.mouseDown : (inp.mouseDown && look.edge);
        if (wantFire && this.input.locked) this._firePlayer();
        else if (wantFire && SHOT) this._firePlayer();
      }
    }

    // --- plant / defuse (hold E) ---
    if (p.alive && inp.down('KeyE')) {
      if (!this.planted && p.isCarrier) {
        const site = this._playerSite();
        if (site) {
          p.plantProgress += dt / PLANT_TIME;
          this.hud.progress(true, `PLANTING AT SITE ${site.key}`, p.plantProgress);
          if (p.plantProgress >= 1) {
            p.plantProgress = 0;
            this.hud.progress(false);
            this.onPlanted(p, site.key);
          }
        } else {
          p.plantProgress = 0;
          this.hud.progress(false);
        }
      }
    } else {
      p.plantProgress = 0;
      this.hud.progress(false);
    }

    // --- bots ---
    const ctx = this;
    ctx.playerSpeed = p.speed;
    for (const b of this.bots) b.update(dt, ctx);

    // --- round end by elimination ---
    const aliveV = this.fighters.filter((f) => f.team === 'V' && f.alive).length;
    const aliveE = this.fighters.filter((f) => f.team === 'E' && f.alive).length;
    if (aliveE === 0) this._endRound('V', 'Ember team eliminated');
    else if (aliveV === 0 && !this.planted) this._endRound('E', 'Vanguard team eliminated');
    else if (aliveV === 0 && this.planted) {
      // Defenders still have to defuse; bots handle it. If no defender can
      // reach the site in time the fuse decides it.
    }

    // Self-test driver: chip away at Ember until the round resolves.
    if (SHOT === 'selftest') this._selftestTick(dt);

    this._syncHud();
  }

  _playerSite() {
    const p = this.player;
    for (const [key, site] of Object.entries(SITES)) {
      if (Math.hypot(site.x - p.x, site.z - p.z) < site.r) return { key, ...site };
    }
    return null;
  }

  _selftestTick(dt) {
    if (!this.selftestState) this.selftestState = { t: 0, done: false, acc: 0 };
    const st = this.selftestState;
    st.t += dt;
    if (this.phase === 'roundEnd' || this.phase === 'matchEnd') {
      if (!st.done) {
        st.done = true;
        this.selftestResult = `SELFTEST OK phase=${this.phase} round=${this.round} score=${this.roundWins.V}:${this.roundWins.E} errors=${window.__ashfallErrors.length}`;
        document.title = this.selftestResult;
      }
      return;
    }
    // Every 0.4s, damage a random living Ember bot as if in combat.
    st.acc += dt;
    if (st.acc >= 0.4) {
      st.acc = 0;
      const targets = this.bots.filter((b) => b.team === 'E' && b.alive);
      if (targets.length) {
        const t = targets[Math.floor(this.rng() * targets.length)];
        t.takeDamage(30, this.player, false, this);
      }
    }
    if (st.t > 60 && !st.done) {
      st.done = true;
      this.selftestResult = `SELFTEST TIMEOUT phase=${this.phase} errors=${window.__ashfallErrors.length}`;
      document.title = this.selftestResult;
    }
  }

  _syncCamera() {
    const p = this.player;
    this.camera.position.set(p.x, EYE + p.y + Math.sin(this.time * 1.4) * 0.012 * (p.speed > 0.5 ? 1 : 0), p.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = p.yaw + Math.PI;
    this.camera.rotation.x = p.pitch + p.recoil * 0.55;
    this.camera.rotation.z = 0;
    const ads = this.input.mouseRight && this.input.locked && p.currentWeapon();
    const targetFov = ads ? 75 / (p.currentWeapon().def.zoom || 1) : 75;
    this.camera.fov = lerp(this.camera.fov, targetFov, 0.18);
    this.camera.updateProjectionMatrix();
    // Crosshair spread in pixels.
    const w = p.currentWeapon();
    const spreadPx = w ? 6 + (shotSpread(w.def, p.speed > 0.5, !!ads) + p.bloom) * 900 : 6;
    this.hud.updateCrosshair(spreadPx, !!ads);
  }

  _updateViewmodel(dt) {
    const vm = this.viewmodel;
    vm.kick = Math.max(0, vm.kick - dt * 6);
    const ads = this.input.mouseRight && this.input.locked;
    const tx = ads ? 0 : 0.26, ty = ads ? -0.185 : -0.24, tz = -0.5;
    vm.group.position.x = lerp(vm.group.position.x, tx, 0.25);
    vm.group.position.y = lerp(vm.group.position.y, ty + Math.sin(this.time * 1.8) * 0.004, 0.25);
    vm.group.position.z = tz + vm.kick * 0.09;
    vm.group.rotation.x = vm.kick * 0.12;
    if (vm.flash.material.opacity > 0) {
      vm.flash.material.opacity = Math.max(0, vm.flash.material.opacity - dt * 14);
      vm.flash.rotation.z = Math.random() * Math.PI;
    }
    if (vm.flashLight.intensity > 0) vm.flashLight.intensity = Math.max(0, vm.flashLight.intensity - dt * 160);
  }

  _syncHud() {
    const p = this.player;
    this.hud.updateTop(this.round, this.roundWins, this.phase === 'buy' ? this.buyTimer : this.phase === 'live' ? this.roundTimer : this.roundTimer, this.phase);
    const aliveV = this.fighters.filter((f) => f.team === 'V' && f.alive).length;
    const aliveE = this.fighters.filter((f) => f.team === 'E' && f.alive).length;
    this.hud.updateAlive(aliveV, aliveE);
    this.hud.updateCash(p.money, this.phase, this.buyOpen);
    this.hud.updateHealth(p.hp, p.armor);
    const w = p.currentWeapon();
    this.hud.updateAmmo(w, !!(w && w.reloading > 0));
  }

  // ---- deterministic screenshot poses --------------------------------------
  _applyShotMode() {
    if (!SHOT) return;
    if (SHOT === 'selftest') {
      this.startMatch();
      this._startLive();
      return;
    }
    const p = this.player;
    if (SHOT === 'menu' || SHOT === 'buy') {
      this.startMatch();
      if (SHOT === 'buy') {
        // Pose at Site A with the shop open.
        p.x = 18; p.z = -10; p.yaw = Math.PI + 0.6; p.pitch = -0.04;
        p.buyPrimary('vk7');
        p.money = 1450;
      } else {
        p.x = 0; p.z = 20; p.yaw = Math.PI; p.pitch = 0.02;
      }
      this.buyOpen = true;
      this.hud.buildBuyMenu(p.money, p.owned, p.armor > 0);
      this.hud.setBuyOpen(true);
      this.hud.setMenuOpen(false);
      this.freezeAt = 1.2;
    } else if (SHOT === 'action') {
      this.startMatch();
      this._startLive();
      // Player east of the mid block, firing diagonally through the mid gap
      // at a defender near Site B's approach; the sightline clears the
      // central block (x 3.7 at z 8), the mid gap (x -2 at z 0) and the
      // north block (x -4.9 at z -4).
      p.x = 8; p.z = 14; p.yaw = -2.52; p.pitch = -0.01;
      p.buyPrimary('vk7');
      const e1 = this.bots.find((b) => b.name === 'Vex');
      const e2 = this.bots.find((b) => b.name === 'Onyx');
      e1.x = -12; e1.z = -14; e1.yaw = 0.6; e1.state = 'engage';
      e2.x = 10; e2.z = 2; e2.yaw = -0.17; e2.state = 'engage';
      const mate = this.bots.find((b) => b.name === 'Rook');
      mate.x = 4; mate.z = 16; mate.yaw = Math.PI;
      // Fire one scripted burst on the first live frames (after the camera
      // has synced once) so the frame shows tracer + flash + impact.
      this._pendingShotAt = 0.05;
      this.freezeAt = 0.1;
    } else if (SHOT === 'plant') {
      this.startMatch();
      this._startLive();
      this.onPlanted(p, 'A');
      // South of the depot, looking north into Site A: tanks, site ring and
      // the A disc in view, defenders closing in from inside and the east.
      p.x = 24; p.z = -6; p.yaw = Math.PI; p.pitch = -0.02;
      p.buyPrimary('vk7');
      const e1 = this.bots.find((b) => b.name === 'Dagger');
      const e2 = this.bots.find((b) => b.name === 'Mira');
      e1.x = 20; e1.z = -16; e1.yaw = 0.4; e1.state = 'advance';
      e2.x = 28; e2.z = -10; e2.yaw = Math.PI * 0.9; e2.state = 'advance';
      const mate = this.bots.find((b) => b.name === 'Havoc');
      mate.x = 26; mate.z = -16; mate.yaw = 0;
      this.fuseTimer = 18;
      this.freezeAt = 0.5;
    } else if (SHOT === 'end') {
      this.roundWins = { V: 5, E: 3 };
      this.round = 8;
      this.phase = 'matchEnd';
      this.player.kills = 14; this.player.deaths = 6; this.player.plants = 2;
      this.player.shots = 210; this.player.hits = 96;
      this.player.money = 5400;
      const acc = Math.round(100 * 96 / 210);
      this.hud.showMatchEnd('V', 5, 3,
        `Kills 14 · Deaths 6 · Plants 2 · Accuracy ${acc}%<br>Money banked $5,400 · Rounds 5–3`);
      this.hud.setMenuOpen(false);
      this.freezeAt = 1.0;
    }
    this.hud.setMenuOpen(false);
  }
}

new Game();
