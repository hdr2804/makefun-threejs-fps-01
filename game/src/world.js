// Three.js scene construction: the yard, its props, fighter models, the
// first-person viewmodel and the transient combat effects (tracers, impacts,
// muzzle flash). All textures are drawn on canvas at runtime — no assets.
import * as THREE from 'three';
import { MAP, SOLIDS, BARRELS, SITES } from './mapdata.js';

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function groundTexture() {
  return canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = '#5d5648'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 5200; i++) {
      const v = 70 + Math.random() * 55;
      g.fillStyle = `rgb(${v | 0},${(v * 0.94) | 0},${(v * 0.78) | 0})`;
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    g.strokeStyle = 'rgba(30,28,22,0.55)'; g.lineWidth = 3;
    for (let x = 0; x <= w; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y <= h; y += 128) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    // oil stains and tire marks
    for (let i = 0; i < 14; i++) {
      g.fillStyle = 'rgba(20,18,14,0.25)';
      g.beginPath();
      g.ellipse(Math.random() * w, Math.random() * h, 20 + Math.random() * 40, 12 + Math.random() * 22, Math.random() * 3, 0, 7);
      g.fill();
    }
  });
}

function wallTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#7a7264'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const v = 100 + Math.random() * 40;
      g.fillStyle = `rgb(${v | 0},${(v * 0.95) | 0},${(v * 0.82) | 0})`;
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    g.strokeStyle = 'rgba(40,36,28,0.5)'; g.lineWidth = 2;
    for (let y = 0; y <= h; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    // hazard stripe along the base
    for (let x = 0; x < w; x += 32) {
      g.fillStyle = (x / 32) % 2 === 0 ? '#c9a227' : '#20211f';
      g.save(); g.translate(x, h - 18); g.rotate(-0.5); g.fillRect(0, 0, 22, 12); g.restore();
    }
  });
}

function crateTexture(base) {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 6;
    g.strokeRect(4, 4, w - 8, h - 8);
    g.beginPath(); g.moveTo(0, 0); g.lineTo(w, h); g.moveTo(w, 0); g.lineTo(0, h);
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 3; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.08)';
    g.fillRect(8, 8, w - 16, 10);
  });
}

function siteTexture(letter, color) {
  return canvasTexture(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = color;
    g.beginPath(); g.arc(w / 2, h / 2, 110, 0, 7); g.fill();
    g.fillStyle = '#101214';
    g.beginPath(); g.arc(w / 2, h / 2, 92, 0, 7); g.fill();
    g.fillStyle = color;
    g.font = 'bold 150px Arial';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(letter, w / 2, h / 2 + 8);
  });
}

function nameSprite(text, color) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 30px Arial';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(0,0,0,0.55)';
  g.fillRect(0, 0, 256, 64);
  g.fillStyle = color;
  g.fillText(text, 128, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false });
  const s = new THREE.Sprite(m);
  s.scale.set(2.4, 0.6, 1);
  return s;
}

export function buildWorld(scene) {
  const group = new THREE.Group();
  scene.add(group);
  scene.background = new THREE.Color(0x9db4c6);
  scene.fog = new THREE.Fog(0x9db4c6, 55, 130);

  const hemi = new THREE.HemisphereLight(0xbfd4e6, 0x4a4238, 1.05);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1cf, 2.0);
  sun.position.set(28, 42, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -45; sun.shadow.camera.right = 45;
  sun.shadow.camera.top = 45; sun.shadow.camera.bottom = -45;
  sun.shadow.camera.far = 120;
  scene.add(sun);

  // Ground
  const gTex = groundTexture();
  gTex.repeat.set(8, 6);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(MAP.width + 4, MAP.depth + 4),
    new THREE.MeshStandardMaterial({ map: gTex, roughness: 0.95, metalness: 0.0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // Perimeter apron (dust outside the walls)
  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 220),
    new THREE.MeshStandardMaterial({ color: 0x8a7f6a, roughness: 1 }),
  );
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = -0.05;
  apron.receiveShadow = true;
  group.add(apron);

  const wallMat = new THREE.MeshStandardMaterial({ map: wallTexture(), roughness: 0.9 });
  const crateMat = new THREE.MeshStandardMaterial({ map: crateTexture('#8a6b3f'), roughness: 0.85 });
  const crateMat2 = new THREE.MeshStandardMaterial({ map: crateTexture('#5d6e52'), roughness: 0.85 });
  const contMat = new THREE.MeshStandardMaterial({ map: crateTexture('#7a4a3a'), roughness: 0.8, metalness: 0.25 });
  const contMat2 = new THREE.MeshStandardMaterial({ map: crateTexture('#3f5d7a'), roughness: 0.8, metalness: 0.25 });
  const blockMat = new THREE.MeshStandardMaterial({ color: 0x6f6a60, roughness: 0.92 });
  const tankMat = new THREE.MeshStandardMaterial({ color: 0xb8b0a0, roughness: 0.55, metalness: 0.55 });

  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  for (const s of SOLIDS) {
    let mat = wallMat;
    if (s.kind === 'crate') mat = (s.x + s.z) % 2 === 0 ? crateMat : crateMat2;
    if (s.kind === 'container') mat = s.x > 0 ? contMat : contMat2;
    if (s.kind === 'block') mat = blockMat;
    if (s.kind === 'tank') {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(s.w / 2, s.w / 2, s.h, 20), tankMat);
      tank.position.set(s.x, s.y0 + s.h / 2, s.z);
      tank.castShadow = true; tank.receiveShadow = true;
      group.add(tank);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(s.w / 2, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), tankMat);
      cap.position.set(s.x, s.y0 + s.h, s.z);
      group.add(cap);
      continue;
    }
    const m = new THREE.Mesh(boxGeo, mat);
    m.scale.set(s.w, s.h, s.d);
    m.position.set(s.x, s.y0 + s.h / 2, s.z);
    m.castShadow = true; m.receiveShadow = true;
    group.add(m);
  }

  // Barrels
  const barrelGeo = new THREE.CylinderGeometry(0.42, 0.42, 1.0, 14);
  const barrelMats = [
    new THREE.MeshStandardMaterial({ color: 0x9a3b2e, roughness: 0.6, metalness: 0.4 }),
    new THREE.MeshStandardMaterial({ color: 0x3f6e4a, roughness: 0.6, metalness: 0.4 }),
    new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.6, metalness: 0.4 }),
  ];
  for (let i = 0; i < BARRELS.length; i++) {
    const b = new THREE.Mesh(barrelGeo, barrelMats[i % 3]);
    b.position.set(BARRELS[i].x, 0.5, BARRELS[i].z);
    b.castShadow = true; b.receiveShadow = true;
    group.add(b);
  }

  // Site markers: floating letter discs + ground rings.
  const siteMeshes = {};
  for (const [key, site] of Object.entries(SITES)) {
    const tex = siteTexture(key, key === 'A' ? '#ffd75e' : '#7dd87d');
    const disc = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 3.2),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }),
    );
    disc.position.set(site.x, 5.4, site.z);
    group.add(disc);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(site.r - 0.35, site.r, 40),
      new THREE.MeshBasicMaterial({ color: key === 'A' ? 0xffd75e : 0x7dd87d, transparent: true, opacity: 0.65, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(site.x, 0.06, site.z);
    group.add(ring);
    siteMeshes[key] = { disc, ring };
  }

  // Distant skyline silhouettes for depth.
  const skyMat = new THREE.MeshBasicMaterial({ color: 0x6e7f8c });
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const r = 78 + (i % 3) * 12;
    const hgt = 14 + ((i * 37) % 22);
    const b = new THREE.Mesh(new THREE.BoxGeometry(10 + (i % 4) * 4, hgt, 10), skyMat);
    b.position.set(Math.cos(a) * r, hgt / 2 - 1, Math.sin(a) * r);
    group.add(b);
  }

  return { group, siteMeshes, sun };
}

// A fighter: capsule body, head, team-coloured vest, gun box, name tag.
// The group origin is at the feet; eye height is 1.62.
export function createFighterMesh(team, label) {
  const g = new THREE.Group();
  const main = team === 'V' ? 0x2f6fd6 : 0xd6502f;
  const dark = team === 'V' ? 0x1d2c42 : 0x3d2019;

  const bodyMat = new THREE.MeshStandardMaterial({ color: main, roughness: 0.8 });
  const darkMat = new THREE.MeshStandardMaterial({ color: dark, roughness: 0.85 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xc99b6f, roughness: 0.7 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.34), bodyMat);
  torso.position.y = 1.05; torso.castShadow = true;
  g.add(torso);
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.4, 0.38), darkMat);
  vest.position.y = 1.12; vest.castShadow = true;
  g.add(vest);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 12), skinMat);
  head.position.y = 1.62; head.castShadow = true;
  g.add(head);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.23, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), darkMat);
  helmet.position.y = 1.64;
  g.add(helmet);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.62, 0.24), darkMat);
  legL.position.set(-0.16, 0.31, 0); legL.castShadow = true;
  const legR = legL.clone(); legR.position.x = 0.16;
  g.add(legL); g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.55, 0.18), bodyMat);
  armL.position.set(-0.4, 1.1, 0.12); armL.rotation.x = -1.1;
  const armR = armL.clone(); armR.position.x = 0.4;
  g.add(armL); g.add(armR);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.85), darkMat);
  gun.position.set(0.18, 1.28, 0.42);
  g.add(gun);

  const tag = nameSprite(label, team === 'V' ? '#8fc4ff' : '#ff9a80');
  tag.position.y = 2.15;
  g.add(tag);

  g.userData = { legL, legR, armL, armR, torso, head, tag };
  return g;
}

// First-person viewmodel: a boxy rifle built from primitives, parented to the
// camera. Returns { group, muzzle, flash, flashLight, kick }.
export function createViewmodel(camera) {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x2a2c2e, roughness: 0.45, metalness: 0.7 });
  const grip = new THREE.MeshStandardMaterial({ color: 0x4a3a28, roughness: 0.9 });
  const accent = new THREE.MeshStandardMaterial({ color: 0x8a6b2f, roughness: 0.5, metalness: 0.5 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.13, 0.62), metal);
  body.position.set(0, 0, 0);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 10), metal);
  barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.01, -0.42);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.12), grip);
  mag.position.set(0, -0.15, -0.05); mag.rotation.x = 0.25;
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.11, 0.2), grip);
  stock.position.set(0, -0.01, 0.38);
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.1), accent);
  sight.position.set(0, 0.09, -0.12);
  const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.24), accent);
  handguard.position.set(0, 0, -0.28);

  group.add(body, barrel, mag, stock, sight, handguard);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.01, -0.58);
  group.add(muzzle);

  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.34, 0.34),
    new THREE.MeshBasicMaterial({ color: 0xffc861, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
  );
  flash.position.copy(muzzle.position);
  flash.rotation.y = Math.PI / 2;
  group.add(flash);
  const flashLight = new THREE.PointLight(0xffb347, 0, 9, 1.8);
  flashLight.position.copy(muzzle.position);
  group.add(flashLight);

  group.position.set(0.26, -0.24, -0.5);
  camera.add(group);
  return { group, muzzle, flash, flashLight, kick: 0 };
}

// Transient effects: tracers (fading lines), impact sparks, explosion flash.
export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.tracers = [];
    this.sparks = [];
    this._tracerGeo = new THREE.BufferGeometry();
    this._tracerGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  }

  tracer(from, to, color) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      from.x, from.y, from.z, to.x, to.y, to.z,
    ]), 3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 }));
    this.scene.add(line);
    this.tracers.push({ line, life: 0.09 });
  }

  impact(point, normal) {
    const geo = new THREE.BufferGeometry();
    const n = 10;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = point.x;
      pos[i * 3 + 1] = point.y;
      pos[i * 3 + 2] = point.z;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xffcf7a, size: 0.12, transparent: true, opacity: 1 });
    const pts = new THREE.Points(geo, mat);
    this.scene.add(pts);
    const dirs = [];
    for (let i = 0; i < n; i++) {
      dirs.push({
        x: (Math.random() - 0.5) * 3 + normal.x * 2,
        y: Math.random() * 2.5 + 0.5,
        z: (Math.random() - 0.5) * 3 + normal.z * 2,
      });
    }
    this.sparks.push({ pts, dirs, life: 0.35 });
  }

  explosion(point) {
    const light = new THREE.PointLight(0xff9a3c, 60, 30, 1.6);
    light.position.copy(point);
    this.scene.add(light);
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(1, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.9 }),
    );
    sphere.position.copy(point);
    this.scene.add(sphere);
    this.sparks.push({ pts: sphere, dirs: null, life: 0.5, light });
  }

  update(dt) {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        t.line.material.dispose();
        this.tracers.splice(i, 1);
      } else {
        t.line.material.opacity = t.life / 0.09;
      }
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life -= dt;
      if (s.life <= 0) {
        this.scene.remove(s.pts);
        if (s.light) this.scene.remove(s.light);
        if (s.pts.geometry) s.pts.geometry.dispose();
        if (s.pts.material) s.pts.material.dispose();
        this.sparks.splice(i, 1);
        continue;
      }
      if (s.dirs) {
        const pos = s.pts.geometry.attributes.position;
        for (let j = 0; j < s.dirs.length; j++) {
          pos.array[j * 3] += s.dirs[j].x * dt;
          pos.array[j * 3 + 1] += s.dirs[j].y * dt;
          pos.array[j * 3 + 2] += s.dirs[j].z * dt;
          s.dirs[j].y -= 6 * dt;
        }
        pos.needsUpdate = true;
        s.pts.material.opacity = Math.min(1, s.life / 0.2);
      } else {
        const k = 1 - s.life / 0.5;
        s.pts.scale.setScalar(1 + k * 6);
        s.pts.material.opacity = 0.9 * (1 - k);
        if (s.light) s.light.intensity = 60 * (1 - k);
      }
    }
  }
}
