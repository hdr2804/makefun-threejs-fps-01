// Weapon definitions and hitscan firing. All values are per-shot; damage
// falls off with range and is multiplied on headshots. Weapons are bought
// with round money; the P9 sidearm is always owned.
export const WEAPONS = {
  p9: {
    id: 'p9', name: 'P9 SIDEARM', slot: 2, kind: 'pistol', price: 0,
    damage: 26, headMult: 3.5, range: 42, falloff: 0.55,
    magSize: 12, reserve: Infinity, reloadTime: 1.15,
    fireInterval: 0.16, auto: false, spread: 0.011, moveSpread: 0.02,
    adsSpread: 0.004, recoil: 0.011, tracerColor: 0xffd27a,
    zoom: 1.0, pellets: 1, desc: 'Reliable sidearm. Free, always in your kit.',
  },
  vk7: {
    id: 'vk7', name: 'VK-7 RIFLE', slot: 1, kind: 'rifle', price: 2700,
    damage: 34, headMult: 3.5, range: 70, falloff: 0.6,
    magSize: 30, reserve: 90, reloadTime: 2.1,
    fireInterval: 0.115, auto: true, spread: 0.013, moveSpread: 0.024,
    adsSpread: 0.004, recoil: 0.016, tracerColor: 0xffe9a8,
    zoom: 1.35, pellets: 1, desc: 'Workhorse assault rifle. Accurate, hard-hitting.',
  },
  hornet: {
    id: 'hornet', name: 'HORNET SMG', slot: 1, kind: 'smg', price: 1500,
    damage: 22, headMult: 3.2, range: 38, falloff: 0.45,
    magSize: 32, reserve: 96, reloadTime: 1.8,
    fireInterval: 0.075, auto: true, spread: 0.02, moveSpread: 0.03,
    adsSpread: 0.008, recoil: 0.01, tracerColor: 0x9fd8ff,
    zoom: 1.15, pellets: 1, desc: 'Fast fire rate, deadly up close. Weak at range.',
  },
  longshot: {
    id: 'longshot', name: 'LONGSHOT DMR', slot: 1, kind: 'sniper', price: 4200,
    damage: 88, headMult: 3.0, range: 95, falloff: 0.85,
    magSize: 5, reserve: 15, reloadTime: 2.6,
    fireInterval: 1.05, auto: false, spread: 0.001, moveSpread: 0.05,
    adsSpread: 0.0004, recoil: 0.05, tracerColor: 0xffffff,
    zoom: 2.6, pellets: 1, desc: 'One shot, one down. Scope with right click.',
  },
  breacher: {
    id: 'breacher', name: 'BREACHER 12G', slot: 1, kind: 'shotgun', price: 1200,
    damage: 13, headMult: 2.5, range: 22, falloff: 0.3,
    magSize: 6, reserve: 24, reloadTime: 2.4,
    fireInterval: 0.85, auto: false, spread: 0.045, moveSpread: 0.055,
    adsSpread: 0.03, recoil: 0.05, tracerColor: 0xffb27a,
    zoom: 1.0, pellets: 8, desc: 'Eight pellets per shell. Devastating in corridors.',
  },
};

export const ARMOR_PRICE = 650;
export const ARMOR_ABSORB = 0.5; // half of incoming damage goes to armor first

export const BUY_MENU = [
  { key: '1', id: 'vk7' },
  { key: '2', id: 'hornet' },
  { key: '3', id: 'breacher' },
  { key: '4', id: 'longshot' },
  { key: '5', id: 'armor' },
  { key: '6', id: 'ammo' },
];

// A live weapon instance (magazine + reserve + reload state).
export function makeWeaponInstance(def) {
  return {
    def,
    mag: def.magSize,
    reserve: def.reserve,
    reloading: 0,
    cooldown: 0,
  };
}

// Damage at a given distance, with falloff past half the weapon's range.
export function damageAt(def, dist, headshot) {
  const half = def.range * 0.5;
  let dmg = def.damage;
  if (dist > half) {
    const t = Math.min(1, (dist - half) / half);
    dmg *= 1 - (1 - def.falloff) * t;
  }
  if (headshot) dmg *= def.headMult;
  return dmg;
}

// Spread for one shot, in radians off the aim ray.
export function shotSpread(def, moving, ads) {
  let s = ads ? def.adsSpread : def.spread;
  if (moving) s += def.moveSpread * 0.5;
  return s;
}
