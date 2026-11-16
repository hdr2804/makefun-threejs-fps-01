// HUD: DOM reads/writes, killfeed, banners, buy menu, minimap.
import { BUY_MENU, WEAPONS, ARMOR_PRICE } from './weapons.js';
import { SITES, MAP } from './mapdata.js';

export class HUD {
  constructor() {
    this.el = {};
    for (const id of ['timer', 'roundLabel', 'scoreV', 'scoreE', 'aliveV', 'aliveE',
      'cash', 'econNote', 'hp', 'hpbar', 'armorLine', 'mag', 'reserve', 'wname',
      'firemode', 'killfeed', 'banner', 'bannerBig', 'bannerSub', 'objective',
      'progress', 'progressLabel', 'progressFill', 'dmgdir', 'vignette', 'crosshair',
      'hitmarker', 'buy', 'buyTable', 'minimap', 'menu', 'matchend', 'endTitle',
      'scoreline', 'matchstats', 'fade']) {
      this.el[id] = document.getElementById(id);
    }
    this.mm = this.el.minimap.getContext('2d');
    this.hitTimer = 0;
    this.dmgTimer = 0;
  }

  fmtTime(sec) {
    const s = Math.max(0, Math.ceil(sec));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  updateTop(round, roundWins, timer, phase) {
    this.el.timer.textContent = this.fmtTime(timer);
    this.el.roundLabel.textContent = `ROUND ${round}/9`;
    this.el.scoreV.textContent = roundWins.V;
    this.el.scoreE.textContent = roundWins.E;
    this.el.timer.style.color = timer <= 10 && phase === 'live' ? '#ff5a3c' : '#ffd75e';
  }

  updateAlive(v, e) {
    this.el.aliveV.textContent = v;
    this.el.aliveE.textContent = e;
  }

  updateCash(money, phase, buyOpen) {
    this.el.cash.textContent = `$${money.toLocaleString('en-US')}`;
    this.el.econNote.textContent = phase === 'buy'
      ? (buyOpen ? 'Buy phase — 1–6 to buy' : 'Buy phase — press B')
      : phase === 'live' ? 'Round live' : phase;
  }

  updateHealth(hp, armor) {
    this.el.hp.textContent = Math.max(0, Math.ceil(hp));
    this.el.hpbar.style.width = `${Math.max(0, hp)}%`;
    this.el.hpbar.style.background = hp > 50
      ? 'linear-gradient(90deg,#7dd87d,#a8d87d)'
      : 'linear-gradient(90deg,#e2574c,#f2a541)';
    this.el.armorLine.textContent = armor > 0 ? `Armor ${Math.ceil(armor)}` : 'No armor';
    this.el.vignette.style.opacity = hp < 35 ? String(0.55 * (1 - hp / 35) + 0.2) : '0';
  }

  updateAmmo(weapon, reloading) {
    if (!weapon) {
      this.el.wname.textContent = '—';
      this.el.mag.textContent = '–';
      this.el.reserve.textContent = '–';
      return;
    }
    this.el.wname.textContent = weapon.def.name + (reloading ? ' · RELOADING' : '');
    this.el.mag.textContent = weapon.mag;
    this.el.reserve.textContent = weapon.reserve === Infinity ? '∞' : String(weapon.reserve);
    this.el.firemode.textContent = weapon.def.auto ? 'AUTO · hold LMB' : 'SEMI · LMB fire';
  }

  updateCrosshair(spreadPx, ads) {
    const s = Math.round(spreadPx);
    const set = (id, v) => { this.el[id] || (this.el[id] = document.getElementById(id)); };
    const arms = [['chT', `left:-1px;top:${-8 - s}px;width:2px;height:8px`],
      ['chB', `left:-1px;top:${s}px;width:2px;height:8px`],
      ['chL', `left:${-8 - s}px;top:-1px;width:8px;height:2px`],
      ['chR', `left:${s}px;top:-1px;width:8px;height:2px`]];
    for (const [id, style] of arms) {
      const n = document.getElementById(id);
      if (n) n.setAttribute('style', style);
    }
    this.el.crosshair.style.opacity = ads ? '0.35' : '1';
  }

  showHit(kill) {
    this.el.hitmarker.style.opacity = '1';
    this.el.hitmarker.style.transform = kill ? 'scale(1.5)' : 'scale(1)';
    this.hitTimer = 0.14;
  }

  showDamageFrom(angleRad) {
    this.el.dmgdir.style.opacity = '0.9';
    this.el.dmgdir.style.transform = `rotate(${angleRad}rad)`;
    this.dmgTimer = 0.5;
  }

  tick(dt) {
    if (this.hitTimer > 0) {
      this.hitTimer -= dt;
      if (this.hitTimer <= 0) this.el.hitmarker.style.opacity = '0';
    }
    if (this.dmgTimer > 0) {
      this.dmgTimer -= dt;
      if (this.dmgTimer <= 0) this.el.dmgdir.style.opacity = '0';
    }
  }

  killfeedAdd(text, color) {
    const div = document.createElement('div');
    div.innerHTML = text;
    if (color) div.style.color = color;
    this.el.killfeed.prepend(div);
    while (this.el.killfeed.children.length > 6) this.el.killfeed.lastChild.remove();
    setTimeout(() => { div.style.opacity = '0.25'; }, 6000);
  }

  banner(big, sub, color) {
    this.el.banner.style.display = 'block';
    this.el.bannerBig.textContent = big;
    this.el.bannerBig.style.color = color || '#ffe9a8';
    this.el.bannerSub.textContent = sub || '';
    clearTimeout(this._bannerT);
    this._bannerT = setTimeout(() => { this.el.banner.style.display = 'none'; }, 3800);
  }

  hideBanner() { this.el.banner.style.display = 'none'; }

  objective(text, cls) {
    this.el.objective.innerHTML = text || '';
    // Keep the 'layer' class: dropping it would un-position the element and
    // the objective text would land at the top-left of the HUD.
    this.el.objective.className = 'layer' + (cls ? ' ' + cls : '');
  }

  progress(show, label, frac) {
    this.el.progress.style.display = show ? 'block' : 'none';
    if (show) {
      this.el.progressLabel.textContent = label;
      this.el.progressFill.style.width = `${Math.round(frac * 100)}%`;
    }
  }

  buildBuyMenu(money, owned, hasArmor) {
    const rows = BUY_MENU.map((item) => {
      let name, price, can = true, ownedRow = false;
      if (item.id === 'armor') {
        name = 'KEVLAR ARMOR — absorbs half of damage';
        price = ARMOR_PRICE;
        ownedRow = hasArmor;
        can = !hasArmor && money >= ARMOR_PRICE;
      } else if (item.id === 'ammo') {
        name = 'REFILL AMMO — full reserve for primary';
        price = 400;
        can = money >= 400 && owned.size > 0;
      } else {
        const w = WEAPONS[item.id];
        name = `${w.name} — ${w.desc}`;
        price = w.price;
        ownedRow = owned.has(item.id);
        can = !ownedRow && money >= w.price;
      }
      const cls = ownedRow ? 'owned' : can ? '' : 'cant';
      const priceTxt = ownedRow ? 'OWNED' : `$${price}`;
      return `<tr class="${cls}"><td class="key">${item.key}</td><td class="name">${name}</td><td class="price">${priceTxt}</td></tr>`;
    }).join('');
    this.el.buyTable.innerHTML = rows;
  }

  setBuyOpen(open) { this.el.buy.style.display = open ? 'block' : 'none'; }
  setMenuOpen(open) { this.el.menu.style.display = open ? 'flex' : 'none'; }
  setMatchEnd(open) { this.el.matchend.style.display = open ? 'flex' : 'none'; }
  fade(toBlack) { this.el.fade.style.opacity = toBlack ? '1' : '0'; }

  showMatchEnd(winner, scoreV, scoreE, stats) {
    this.el.endTitle.textContent = winner === 'V' ? 'VANGUARD WINS THE MATCH' : 'EMBER WINS THE MATCH';
    this.el.endTitle.style.color = winner === 'V' ? '#6db3ff' : '#ff7a5c';
    this.el.scoreline.textContent = `VANGUARD ${scoreV} — ${scoreE} EMBER`;
    this.el.matchstats.innerHTML = stats;
    this.setMatchEnd(true);
  }

  // Top-down minimap: walls, sites, fighters.
  drawMinimap(fighters, player, plantedSite, targetSite) {
    const ctx = this.mm;
    const W = 180, H = 132;
    ctx.clearRect(0, 0, W, H);
    const sx = W / MAP.width, sz = H / MAP.depth;
    const X = (x) => (x + MAP.width / 2) * sx;
    const Z = (z) => (z + MAP.depth / 2) * sz;
    ctx.fillStyle = 'rgba(40,44,40,0.9)';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(232,230,223,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(X(-32), Z(-24), 64 * sx, 48 * sz);
    // Site zones
    for (const [key, site] of Object.entries(SITES)) {
      ctx.fillStyle = key === 'A' ? 'rgba(255,215,94,0.25)' : 'rgba(125,216,125,0.25)';
      ctx.beginPath();
      ctx.arc(X(site.x), Z(site.z), site.r * sx, 0, 7);
      ctx.fill();
      ctx.fillStyle = '#0c0e10';
      ctx.font = 'bold 10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(key, X(site.x), Z(site.z) + 3);
    }
    if (plantedSite) {
      ctx.fillStyle = '#ff5a3c';
      ctx.beginPath();
      ctx.arc(X(plantedSite.x), Z(plantedSite.z), 5, 0, 7);
      ctx.fill();
    }
    for (const f of fighters) {
      if (!f.alive) continue;
      ctx.fillStyle = f.team === 'V' ? '#6db3ff' : '#ff7a5c';
      ctx.beginPath();
      ctx.arc(X(f.x), Z(f.z), f.isPlayer ? 4 : 3, 0, 7);
      ctx.fill();
      if (f.isPlayer) {
        ctx.strokeStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(X(f.x), Z(f.z));
        ctx.lineTo(X(f.x) + Math.sin(f.yaw) * 9, Z(f.z) + Math.cos(f.yaw) * 9);
        ctx.stroke();
      }
    }
  }
}
