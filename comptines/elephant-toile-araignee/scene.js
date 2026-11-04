// « Un éléphant qui se balançait » — scène 3D image par image (1080 x 1920, 9:16).
// window.image(t) dessine l'instant t (en secondes) et renvoie l'image JPEG.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const W = 1080, H = 1920;
const timing = await (await fetch('timing.json')).json();
await document.fonts.load('700 64px Fredoka');
const T_BOUM = timing.boum, T_CHUTE = 0.42, FIN = timing.duree;

// ---------- outils ----------
function hasard(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = hasard(77);
const entre = (a, b) => a + rnd() * (b - a);
const choisir = (arr) => arr[Math.floor(rnd() * arr.length)];
const lisse = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
function mesh(geo, m, x = 0, y = 0, z = 0, parent) {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  o.castShadow = true;
  if (parent) parent.add(o);
  return o;
}

// ---------- rendu ----------
const gl = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
gl.setPixelRatio(1);
gl.setSize(W, H, false);
gl.shadowMap.enabled = true;
gl.shadowMap.type = THREE.PCFSoftShadowMap;
gl.toneMapping = THREE.ACESFilmicToneMapping;
gl.toneMappingExposure = 0.95;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xdcefff, 22, 70);
const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 400);
const composer = new EffectComposer(gl);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.4, 0.45, 1.0));
composer.addPass(new OutputPass());

scene.add(new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: 'varying vec3 p; void main(){ p = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `varying vec3 p; void main(){
    vec3 c = mix(vec3(1.0,0.93,0.86), vec3(0.55,0.78,1.0), smoothstep(-0.02,0.45,p.y));
    gl_FragColor = vec4(c*0.92,1.); }`,
})));
scene.add(new THREE.HemisphereLight(0xffffff, 0x8fcf7a, 1.0));
const soleil = new THREE.DirectionalLight(0xfff0d6, 2.0);
soleil.position.set(5, 12, 8);
soleil.castShadow = true;
soleil.shadow.mapSize.set(2048, 2048);
Object.assign(soleil.shadow.camera, { left: -8, right: 8, top: 9, bottom: -2, near: 1, far: 40 });
scene.add(soleil);

// ---------- décor : une prairie au printemps ----------
const sol = mesh(new THREE.PlaneGeometry(220, 220), mat(0xa5dc8a), 0, 0, 0, scene);
sol.rotation.x = -Math.PI / 2;
sol.receiveShadow = true;
sol.castShadow = false;

{ // herbe + fleurs
  const herbe = new THREE.InstancedMesh(new THREE.ConeGeometry(0.06, 0.35, 5), mat(0x72c25e), 1500);
  const fleurs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshStandardMaterial({ roughness: 0.6 }), 450);
  const m = new THREE.Matrix4(), c = new THREE.Color();
  for (let i = 0; i < 1500; i++) {
    m.makeRotationZ(entre(-0.3, 0.3)).setPosition(entre(-16, 16), 0.15, entre(-25, 8));
    herbe.setMatrixAt(i, m);
  }
  for (let i = 0; i < 450; i++) {
    m.makeTranslation(entre(-14, 14), 0.13, entre(-22, 7));
    fleurs.setMatrixAt(i, m);
    fleurs.setColorAt(i, c.set(choisir([0xffffff, 0xffb3d9, 0xffe28a, 0xc9b3ff, 0xff9f80])));
  }
  scene.add(herbe, fleurs);
}

// Deux grands arbres et la grosse branche qui les relie
const BRANCHE_Y = 5.7;
function arbre(x, z, s, feuilles) {
  const g = new THREE.Group();
  mesh(new THREE.CylinderGeometry(0.35 * s, 0.55 * s, 6.6 * s, 14), mat(0x9a6b4f), 0, 3.3 * s, 0, g);
  for (let k = 0; k < 7; k++) {
    mesh(new THREE.SphereGeometry(entre(1.1, 1.7) * s, 18, 14), mat(feuilles), entre(-1.2, 1.2) * s, (6.6 + entre(0, 1.4)) * s, entre(-1, 0.6) * s, g);
  }
  g.position.set(x, 0, z);
  scene.add(g);
}
arbre(-3.6, -0.6, 1, 0x6fcf8a);
arbre(3.6, -0.6, 1, 0x8fdc7a);
{
  const b = mesh(new THREE.CylinderGeometry(0.22, 0.26, 7.4, 12), mat(0x8c5f45), 0, BRANCHE_Y, -0.3, scene);
  b.rotation.z = Math.PI / 2;
  for (const [x, y] of [[-1.5, 0.25], [1.9, 0.3], [0.2, 0.28]]) {
    const f = mesh(new THREE.SphereGeometry(0.2, 10, 8), mat(0x7fd68a), x, BRANCHE_Y + y, -0.3, scene);
    f.scale.set(1.4, 0.6, 1);
  }
}
// Arbres et collines au loin
for (let i = 0; i < 18; i++) arbre(entre(-20, 20), entre(-30, -10), entre(0.7, 1.3), choisir([0x6fcf8a, 0x8fdc7a, 0x9fe0b0, 0xf2b8d3]));
for (const [x, z, r, c] of [[-14, -40, 14, 0x9ad68f], [10, -45, 18, 0xa9e09a], [26, -38, 12, 0x94d18a]]) {
  const col = mesh(new THREE.SphereGeometry(r, 32, 16), mat(c), x, -r * 0.55, z, scene);
  col.castShadow = false;
}
// Nuages
const nuages = [];
for (const [x, y, z] of [[-6, 12, -18], [5, 14, -22], [13, 11, -26], [-15, 13, -28]]) {
  const g = new THREE.Group();
  for (let k = 0; k < 5; k++) mesh(new THREE.SphereGeometry(entre(1.2, 2), 16, 12), mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.25 }), k * 1.5 - 3, entre(-0.4, 0.5), 0, g).castShadow = false;
  g.position.set(x, y, z);
  scene.add(g);
  nuages.push(g);
}
// Papillons dans la prairie
const ailesForme = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.15, 0.25, 0.42, 0.28, 0.4, 0.05);
  s.bezierCurveTo(0.38, -0.1, 0.3, -0.12, 0.22, -0.08);
  s.bezierCurveTo(0.3, -0.25, 0.12, -0.32, 0, -0.05);
  return new THREE.ShapeGeometry(s);
})();
const papillons = [0xff8ad8, 0x8ad8ff, 0xffd36b, 0xc9a6ff].map((c, i) => {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.6, side: THREE.DoubleSide });
  const ailes = [1, -1].map((s) => {
    const p = new THREE.Group();
    const a = mesh(ailesForme, m, 0, 0, 0, p);
    a.rotation.x = -Math.PI / 2;
    a.scale.set(0.6 * s, 0.6, 0.6);
    g.add(p);
    return p;
  });
  scene.add(g);
  return { g, ailes, p: i * 1.7, x: [-2.2, 2.4, -1.4, 1.8][i], y: [1.3, 2.0, 3.6, 1.0][i] };
});

// ---------- la toile d'araignée (accrochée à la branche, elle se balance) ----------
const balancoire = new THREE.Group();
balancoire.position.set(0, BRANCHE_Y, 0);
scene.add(balancoire);
const toile = new THREE.Group();
balancoire.add(toile);
const CENTRE = new THREE.Vector3(0, -3.0, 0), RAYON = 1.55;
const fil = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xdfefff, emissiveIntensity: 0.5, roughness: 0.3 });
function filDe(points, r = 0.018) {
  const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), Math.max(8, points.length * 4), r, 5);
  const m = mesh(g, fil, 0, 0, 0, toile);
  m.castShadow = false;
  return m;
}
const pt = (a, r) => new THREE.Vector3(CENTRE.x + Math.cos(a) * r, CENTRE.y + Math.sin(a) * r, -Math.pow(1 - r / RAYON, 2) * 0.15);
for (let k = 0; k < 14; k++) {
  const a = (k / 14) * Math.PI * 2;
  filDe([pt(a, 0.02), pt(a, RAYON / 2), pt(a, RAYON)]);
}
{
  const spirale = [];
  for (let a = 0; a < Math.PI * 2 * 7; a += 0.2) spirale.push(pt(a, 0.15 + (a / (Math.PI * 14)) * (RAYON - 0.2)));
  filDe(spirale, 0.012);
}
for (const x of [-1.1, 0, 1.1]) filDe([new THREE.Vector3(x * 1.4, 0, -0.1), pt(Math.atan2(RAYON * 0.7, x), RAYON).setZ(0)], 0.022);
// Gouttes de rosée qui brillent
for (let k = 0; k < 26; k++) {
  const g = mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: 0xeaf6ff, toneMapped: false }), 0, 0, 0, toile);
  g.position.copy(pt(entre(0, 6.28), entre(0.4, RAYON)));
  g.position.z += 0.02;
}

// ---------- l'araignée (gentille !) ----------
const araignee = new THREE.Group();
scene.add(araignee);
const ARAIGNEE_POS = new THREE.Vector3(1.35, BRANCHE_Y + 0.42, 0.05);
{
  const violet = mat(0x8a5cc7, { roughness: 0.6 });
  mesh(new THREE.SphereGeometry(0.32, 20, 16), violet, 0, 0, -0.18, araignee).scale.set(1, 0.9, 1.1);
  mesh(new THREE.SphereGeometry(0.22, 20, 16), violet, 0, 0.02, 0.15, araignee);
  for (const s of [-1, 1]) {
    mesh(new THREE.SphereGeometry(0.075, 12, 10), mat(0xffffff, { roughness: 0.2 }), s * 0.08, 0.1, 0.33, araignee);
    mesh(new THREE.SphereGeometry(0.042, 10, 8), mat(0x1a1424, { roughness: 0.2 }), s * 0.08, 0.1, 0.39, araignee);
    mesh(new THREE.SphereGeometry(0.04, 8, 6), mat(0xff9fc5), s * 0.15, 0.0, 0.3, araignee);
    for (let k = 0; k < 4; k++) {
      const p = new THREE.Group();
      p.position.set(s * 0.15, 0, 0.12 - k * 0.12);
      p.rotation.y = s * (0.5 - k * 0.35);
      const h = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.35, 6), violet, s * 0.15, 0.08, 0, p);
      h.rotation.z = s * 1.1;
      const b = mesh(new THREE.CylinderGeometry(0.022, 0.018, 0.32, 6), violet, s * 0.33, -0.08, 0, p);
      b.rotation.z = -s * 0.5;
      araignee.add(p);
    }
  }
  const sourire = mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 16, Math.PI), mat(0x3a1f4f), 0, -0.04, 0.36, araignee);
  sourire.rotation.z = Math.PI;
}
const filAraignee = mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 4), fil, 0, 0, 0, scene);

// ---------- le bébé éléphant ----------
const elephant = new THREE.Group();
scene.add(elephant);
const peau = mat(0xa9bde3, { roughness: 0.75 }), clair = mat(0xc7d6f0), rose = mat(0xffaec9), noir = mat(0x15121c, { roughness: 0.25 });
const corps = new THREE.Group();
elephant.add(corps);
mesh(new THREE.SphereGeometry(0.72, 32, 24), peau, 0, 0.78, 0, corps).scale.set(1, 1.05, 0.95);
mesh(new THREE.SphereGeometry(0.48, 24, 16), clair, 0, 0.72, 0.4, corps).scale.set(1, 1.1, 0.55);
const tete = new THREE.Group();
tete.position.set(0, 1.72, 0.18);
corps.add(tete);
mesh(new THREE.SphereGeometry(0.58, 32, 24), peau, 0, 0, 0, tete);
for (const s of [-1, 1]) {
  mesh(new THREE.SphereGeometry(0.12, 12, 10), new THREE.MeshStandardMaterial({ color: 0xffa3c4, transparent: true, opacity: 0.75 }), s * 0.32, -0.18, 0.45, tete).scale.z = 0.3;
  mesh(new THREE.SphereGeometry(0.08, 10, 8), peau, s * 0.08, 0.55, 0.05 + s * 0.04, tete);
}
const yeux = [-1, 1].map((s) => {
  const g = new THREE.Group();
  g.position.set(s * 0.21, 0.08, 0.5);
  mesh(new THREE.SphereGeometry(0.1, 20, 14), noir, 0, 0, 0, g).scale.set(0.85, 1.15, 0.6);
  mesh(new THREE.SphereGeometry(0.032, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), 0.03, 0.05, 0.06, g);
  mesh(new THREE.SphereGeometry(0.014, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), -0.03, -0.03, 0.06, g);
  tete.add(g);
  return g;
});
const oreilles = [-1, 1].map((s) => {
  const p = new THREE.Group();
  p.position.set(s * 0.45, 0.05, -0.05);
  const o = mesh(new THREE.SphereGeometry(0.5, 24, 16), peau, s * 0.32, 0, 0, p);
  o.scale.set(1, 1.1, 0.18);
  const i = mesh(new THREE.SphereGeometry(0.36, 20, 14), rose, s * 0.32, 0, 0.05, p);
  i.scale.set(1, 1.1, 0.12);
  p.rotation.y = -s * 0.35;
  tete.add(p);
  return p;
});
const trompe = new THREE.Group();
trompe.position.set(0, -0.12, 0.48);
tete.add(trompe);
{
  const courbe = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.28, 0.12), new THREE.Vector3(0, -0.45, 0.34),
    new THREE.Vector3(0, -0.36, 0.56), new THREE.Vector3(0, -0.12, 0.62),
  ]);
  mesh(new THREE.TubeGeometry(courbe, 40, 0.13, 16), peau, 0, 0, 0, trompe);
  mesh(new THREE.SphereGeometry(0.13, 16, 12), clair, 0, -0.12, 0.62, trompe).scale.set(1, 1, 0.5);
  for (let k = 1; k <= 4; k++) {
    const r = mesh(new THREE.TorusGeometry(0.13, 0.008, 6, 20), mat(0x93a8d0), 0, 0, 0, trompe);
    const p = courbe.getPointAt(k / 5), d = courbe.getTangentAt(k / 5);
    r.position.copy(p);
    r.lookAt(p.clone().add(d));
  }
}
const bras = [-1, 1].map((s) => {
  const p = new THREE.Group();
  p.position.set(s * 0.52, 1.1, 0.3);
  mesh(new THREE.CapsuleGeometry(0.17, 0.4, 8, 16), peau, 0, -0.32, 0, p);
  mesh(new THREE.SphereGeometry(0.17, 14, 10), clair, 0, -0.58, 0.04, p).scale.set(1, 0.5, 1);
  p.rotation.z = s * 0.35;
  corps.add(p);
  return p;
});
const jambes = [-1, 1].map((s) => {
  const p = new THREE.Group();
  p.position.set(s * 0.38, 0.32, 0.35);
  const j = mesh(new THREE.CapsuleGeometry(0.21, 0.35, 8, 16), peau, 0, 0, 0.25, p);
  j.rotation.x = Math.PI / 2;
  const plante = mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.04, 20), clair, 0, 0, 0.66, p);
  plante.rotation.x = Math.PI / 2;
  for (let k = -1; k <= 1; k++) mesh(new THREE.SphereGeometry(0.045, 8, 6), mat(0xffffff), k * 0.1, 0.13, 0.6, p);
  corps.add(p);
  return p;
});
{
  const q = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.5, -0.65), new THREE.Vector3(0.1, 0.3, -0.85), new THREE.Vector3(0.2, 0.25, -0.95)]), 12, 0.04, 6), peau, 0, 0, 0, corps);
  q.castShadow = false;
}

// ---------- effets du BOUM ----------
const poussiere = Array.from({ length: 16 }, (_, i) => {
  const m = mesh(new THREE.SphereGeometry(0.35, 12, 8), new THREE.MeshStandardMaterial({ color: 0xf4e6cf, transparent: true, opacity: 0 }), 0, 0, 0, scene);
  m.castShadow = false;
  return { m, a: (i / 16) * Math.PI * 2, v: entre(1.2, 2.4) };
});
const etoileForme = (() => {
  const s = new THREE.Shape();
  for (let k = 0; k < 10; k++) {
    const r = k % 2 ? 0.07 : 0.17, a = (k / 10) * Math.PI * 2 + Math.PI / 2;
    k ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02 });
})();
const etoiles = Array.from({ length: 5 }, () => {
  const e = mesh(etoileForme, new THREE.MeshStandardMaterial({ color: 0xffd84d, emissive: 0xffc21a, emissiveIntensity: 1.4 }), 0, 0, 0, scene);
  e.visible = false;
  return e;
});

// ---------- animation ----------
const PERIODE = timing.croche * 12; // un aller-retour toutes les 2 mesures
const POS_ASSISE = new THREE.Vector3(0, -3.55, 0.3);
let posChute = null;
function animer(t) {
  // Balancement : de plus en plus fort juste avant le BOUM
  const ampl = 0.2 + 0.2 * lisse(T_BOUM - 2.6, T_BOUM, t);
  const theta = Math.sin((2 * Math.PI * t) / PERIODE) * ampl;
  balancoire.rotation.z = t < T_BOUM ? theta : 0;
  const casse = t >= T_BOUM;
  toile.visible = !casse;

  // Éléphant : assis sur la toile, puis tombe
  const assis = POS_ASSISE.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), theta).add(balancoire.position);
  if (!casse) {
    elephant.position.copy(assis);
    elephant.rotation.z = theta;
    posChute = null;
  } else {
    if (!posChute) posChute = POS_ASSISE.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), Math.sin((2 * Math.PI * T_BOUM) / PERIODE) * 0.4).add(balancoire.position);
    const u = t - T_BOUM;
    const k = Math.min(u / T_CHUTE, 1);
    elephant.position.set(posChute.x * (1 - k * 0.6), posChute.y * (1 - k * k), posChute.z);
    elephant.rotation.z = (1 - k) * 0.3 + Math.sin(u * 3) * 0.05 * k;
  }
  // Écrasement à l'atterrissage puis rebond
  const ua = t - T_BOUM - T_CHUTE;
  const ecrase = ua > 0 ? Math.exp(-ua * 5) * Math.cos(ua * 18) * 0.3 : 0;
  corps.scale.set(1 + ecrase * 0.6, 1 - ecrase, 1 + ecrase * 0.6);

  // Mouvements mignons
  tete.rotation.z = Math.sin(t * 1.7) * 0.08;
  tete.rotation.y = Math.sin(t * 0.9) * 0.15;
  trompe.rotation.x = Math.sin(t * 2.4) * 0.25 - (ua > 0.4 ? 0.5 : 0);
  oreilles.forEach((o, i) => { o.rotation.y = (i ? 1 : -1) * (0.35 + Math.sin(t * 4 + i) * 0.15); });
  bras.forEach((b, i) => { b.rotation.z = (i ? 1 : -1) * (0.35 + (ua > 0.5 ? 0.6 + Math.sin(t * 8) * 0.25 : Math.sin(t * 2) * 0.1)); });
  jambes.forEach((j, i) => { j.rotation.x = Math.sin(t * 3 + i * Math.PI) * 0.15; });
  const c = t % 3.1;
  const cl = c < 0.14 ? 1 - Math.sin((c / 0.14) * Math.PI) * 0.9 : 1;
  yeux.forEach((e) => { e.scale.y = cl; });

  // Araignée : danse sur la branche, puis descend voir l'éléphant
  const desc = lisse(T_BOUM + 0.8, T_BOUM + 2.2, t);
  araignee.position.set(ARAIGNEE_POS.x, ARAIGNEE_POS.y + Math.abs(Math.sin(t * 5.6)) * 0.08 * (1 - desc) - desc * 2.6, ARAIGNEE_POS.z);
  araignee.rotation.y = Math.sin(t * 1.5) * 0.3;
  araignee.rotation.z = desc * Math.PI * 0.08;
  const saut = lisse(T_BOUM, T_BOUM + 0.15, t) * (1 - lisse(T_BOUM + 0.15, T_BOUM + 0.5, t));
  araignee.position.y += saut * 0.5;
  const longueur = Math.max(0.01, BRANCHE_Y - araignee.position.y);
  filAraignee.visible = desc > 0.01;
  filAraignee.scale.y = longueur;
  filAraignee.position.set(ARAIGNEE_POS.x, BRANCHE_Y - longueur / 2 + 0.25, ARAIGNEE_POS.z - 0.1);

  // Poussière et étoiles
  poussiere.forEach((p) => {
    const u = ua;
    const vis = u > 0 && u < 1.4;
    p.m.visible = vis;
    if (!vis) return;
    const r = 0.5 + p.v * Math.sqrt(u);
    p.m.position.set(elephant.position.x + Math.cos(p.a) * r, 0.25 + u * 0.4, elephant.position.z + Math.sin(p.a) * r * 0.6);
    p.m.scale.setScalar(0.6 + u * 0.9);
    p.m.material.opacity = 0.85 * (1 - u / 1.4);
  });
  etoiles.forEach((e, i) => {
    e.visible = ua > 0.2;
    const a = t * 3 + (i / 5) * Math.PI * 2;
    const h = tete.getWorldPosition(new THREE.Vector3());
    e.position.set(h.x + Math.cos(a) * 0.8, h.y + 0.75 + Math.sin(a * 2) * 0.08, h.z + Math.sin(a) * 0.5);
    e.rotation.set(0, 0, t * 4 + i);
  });

  // Nuages et papillons
  nuages.forEach((n, i) => { n.position.x += 0; n.position.x = [-6, 5, 13, -15][i] + Math.sin(t * 0.05 + i) * 2; });
  papillons.forEach((b, i) => {
    b.g.position.set(b.x + Math.sin(t * 0.8 + b.p) * 0.9, b.y + Math.sin(t * 1.6 + b.p) * 0.3, 1.2 + Math.cos(t * 0.7 + b.p) * 0.6);
    b.g.rotation.y = Math.cos(t * 0.8 + b.p) > 0 ? 0.8 : -0.8;
    const f = Math.sin(t * 16 + i) * 0.9 + 0.2;
    b.ailes[0].rotation.z = f;
    b.ailes[1].rotation.z = -f;
  });
}

// ---------- caméra ----------
const L = timing.lignes;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
let regardLisse = null;
function placerCamera(t) {
  const E = elephant.position.clone().add(V(0, 1.1, 0));
  let pos, regard;
  const u = (a, b) => lisse(a, b, t);
  if (t < L[0].debut + 0.3) {             // Ouverture : la prairie
    const k = u(0, L[0].debut + 0.3);
    pos = V(0, 4.6 - 0.8 * k, 17 - 5 * k); regard = V(0, 3.6, 0);
  } else if (t < L[1].debut + 0.3) {      // « Un éléphant qui se balançait »
    pos = V(0.6, 2.7, 6.8 - 0.6 * u(L[0].debut, L[1].debut)); regard = E;
  } else if (t < L[2].debut + 0.3) {      // « Sur une toile toile »
    pos = V(2.2, 4.4, 6.4); regard = V(0.3, 3.4, 0);
  } else if (t < L[3].debut + 0.3) {      // « Toile d'araignée » : l'araignée
    pos = V(2.4, 6.1, 3.3); regard = ARAIGNEE_POS.clone().add(V(-0.3, -0.25, 0));
  } else if (t < L[4].debut + 0.3) {      // « C'était un jeu tellement amusant »
    const k = u(L[3].debut, L[4].debut);
    pos = V(-1.6 + k * 1.2, 3.2, 10.5 - k * 1.5); regard = V(0, 3.0, 0);
  } else if (t < T_BOUM) {                // « Que tout à coup » : on se rapproche
    const k = u(L[4].debut, T_BOUM);
    pos = V(0, 2.7, 7.4 - k * 1.6); regard = E;
  } else {                                 // BOUM !
    const k = u(T_BOUM + 1.2, FIN);
    pos = V(0, 2.6 + k * 0.4, 8.6 - k * 1.2); regard = V(0, 1.7, 0);
  }
  if (t >= T_BOUM && t < T_BOUM + 0.3) regardLisse = null;
  if (!regardLisse || t < 0.05) regardLisse = regard.clone();
  regardLisse.lerp(regard, 0.35);
  // Tremblement à l'atterrissage
  const ua = t - T_BOUM - T_CHUTE;
  const tremble = ua > 0 && ua < 0.6 ? (1 - ua / 0.6) * 0.18 : 0;
  pos.x += Math.sin(t * 90) * tremble;
  pos.y += Math.cos(t * 77) * tremble;
  camera.position.copy(pos);
  camera.lookAt(regard);
}

// ---------- textes ----------
const sortie = document.getElementById('video');
const ctx = sortie.getContext('2d');
function texte(str, x, y, taille, remplissage, alpha = 1, contour = '#5a2a82') {
  ctx.globalAlpha = alpha;
  ctx.font = `700 ${taille}px Fredoka`;
  ctx.lineJoin = 'round';
  ctx.lineWidth = taille * 0.2;
  ctx.strokeStyle = contour;
  ctx.strokeText(str, x, y);
  ctx.fillStyle = remplissage;
  ctx.fillText(str, x, y);
  ctx.globalAlpha = 1;
}
function sousTitres(t) {
  const ligne = L.find((l) => t >= l.debut && t < l.fin);
  if (!ligne) return;
  const a = lisse(ligne.debut, ligne.debut + 0.2, t) * (1 - lisse(ligne.fin - 0.15, ligne.fin, t));
  const taille = 70, maxW = 820;
  ctx.font = `700 ${taille}px Fredoka`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const esp = ctx.measureText(' ').width;
  const rangees = [[]];
  let w = 0;
  for (const m of ligne.mots) {
    const mw = ctx.measureText(m.mot).width;
    if (w + mw > maxW && rangees.at(-1).length) { rangees.push([]); w = 0; }
    rangees.at(-1).push({ ...m, w: mw });
    w += mw + esp;
  }
  const y0 = 1400 - (rangees.length - 1) * taille * 0.6;
  rangees.forEach((r, ri) => {
    const total = r.reduce((s, m) => s + m.w, 0) + esp * (r.length - 1);
    let x = (W - total) / 2;
    for (const m of r) {
      const chante = t >= m.t - 0.05;
      const pop = chante ? 1 + 0.1 * (1 - lisse(m.t, m.t + 0.25, t)) : 1;
      ctx.save();
      ctx.translate(x + m.w / 2, y0 + ri * taille * 1.2);
      ctx.scale(pop, pop);
      texte(m.mot, -m.w / 2, 0, taille, chante ? '#ffe066' : '#ffffff', a);
      ctx.restore();
      x += m.w + esp;
    }
  });
}
function titres(t) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const a = lisse(0.2, 0.7, t) * (1 - lisse(L[0].debut + 1.4, L[0].debut + 2.0, t));
  if (a > 0) {
    texte('Un éléphant', W / 2, 260, 120, '#7fb2ff', a);
    texte('qui se balançait', W / 2, 380, 84, '#ffffff', a);
  }
  // Grand « BOUM ! » de bande dessinée
  const u = t - T_BOUM - T_CHUTE + 0.05;
  if (u > 0 && u < 1.6) {
    const s = 0.4 + 0.75 * lisse(0, 0.12, u) - 0.1 * lisse(0.12, 0.3, u);
    ctx.save();
    ctx.translate(W / 2, 520);
    ctx.rotate(-0.08);
    ctx.scale(s, s);
    texte('BOUM !', 0, 0, 220, '#ffd23f', 1 - lisse(1.2, 1.6, u), '#e8443a');
    ctx.restore();
  }
  const b = lisse(FIN - 2.4, FIN - 1.8, t);
  if (b > 0) texte('À bientôt !', W / 2, 340, 96, '#ffe066', b);
}

window.image = (t) => {
  animer(t);
  placerCamera(t);
  composer.render();
  ctx.drawImage(gl.domElement, 0, 0, W, H);
  titres(t);
  sousTitres(t);
  const f = Math.max(1 - lisse(0, 0.5, t), lisse(FIN - 0.7, FIN, t));
  if (f > 0) { ctx.fillStyle = `rgba(255,248,240,${f})`; ctx.fillRect(0, 0, W, H); }
  return sortie.toDataURL('image/jpeg', 0.92);
};
window.duree = FIN;
window.pret = true;

if (!navigator.webdriver) {
  const t0 = performance.now();
  const boucle = () => { window.image(((performance.now() - t0) / 1000) % FIN); requestAnimationFrame(boucle); };
  boucle();
}
