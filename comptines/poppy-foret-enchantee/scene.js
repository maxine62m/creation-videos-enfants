// « Poppy dans la forêt enchantée » — scène 3D image par image (1080 x 1920, 9:16).
// window.image(t) dessine l'instant t (en secondes) et renvoie l'image JPEG.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const W = 1080, H = 1920;
const timing = await (await fetch('timing.json')).json();
await document.fonts.load('700 64px Fredoka');

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
const rnd = hasard(2024);
const entre = (a, b) => a + rnd() * (b - a);
const choisir = (arr) => arr[Math.floor(rnd() * arr.length)];
const lisse = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
const brille = (color, force = 1.6) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: force, roughness: 0.5 });
function mesh(geo, m, x = 0, y = 0, z = 0, parent) {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
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
gl.toneMappingExposure = 0.92;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xf7d9e3, 20, 60);
const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 400);
const composer = new EffectComposer(gl);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.45, 0.45, 1.0));
composer.addPass(new OutputPass());

// Ciel : dégradé bleu tendre -> rose -> doré (journée qui commence à dorer)
scene.add(new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: 'varying vec3 p; void main(){ p = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `varying vec3 p; void main(){
    float h = p.y;
    vec3 c = mix(vec3(1.0,0.86,0.72), vec3(1.0,0.80,0.90), smoothstep(-0.05,0.18,h));
    c = mix(c, vec3(0.62,0.80,1.0), smoothstep(0.15,0.6,h));
    gl_FragColor = vec4(c*0.9,1.); }`,
})));

scene.add(new THREE.HemisphereLight(0xfff1f6, 0x7fbf7a, 0.9));
const soleil = new THREE.DirectionalLight(0xffe2b8, 1.9);
soleil.position.set(-6, 10, -4);
soleil.castShadow = true;
soleil.shadow.mapSize.set(1024, 1024);
Object.assign(soleil.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 30 });
scene.add(soleil, soleil.target);

// ---------- chemin de Poppy ----------
const cheminX = (z) => Math.sin(z * 0.18) * 1.0;
const VITESSE = 0.75, ARRET = timing.duree - 3.4;
const distance = (t) => {
  // vitesse constante puis ralentit et s'arrête en douceur
  if (t < ARRET) return VITESSE * t;
  const u = Math.min(t - ARRET, 1.2);
  return VITESSE * (ARRET + u - (u * u) / 2.4);
};

// ---------- décor ----------
const sol = mesh(new THREE.PlaneGeometry(220, 220), mat(0x9fd98e), 0, 0, 10, scene);
sol.rotation.x = -Math.PI / 2;
sol.receiveShadow = true;

// Chemin de sable rosé
{
  const pos = [], idx = [];
  for (let i = 0, z = -15; z <= 45; z += 0.5, i++) {
    const x = cheminX(z);
    pos.push(x - 0.95, 0.012, z, x + 0.95, 0.012, z);
    if (i) idx.push(2 * i - 2, 2 * i, 2 * i - 1, 2 * i - 1, 2 * i, 2 * i + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const c = mesh(g, mat(0xf6dcc4), 0, 0, 0, scene);
  c.receiveShadow = true;
  for (let z = -12; z < 42; z += 0.7) {
    const p = mesh(new THREE.SphereGeometry(entre(0.08, 0.16), 10, 6), mat(0xe9c9b8), cheminX(z) + choisir([-1, 1]) * entre(0.85, 1.05), 0, z, scene);
    p.scale.y = 0.4;
  }
}

// Herbe et fleurs (instanciées = rapide)
{
  const herbe = new THREE.InstancedMesh(new THREE.ConeGeometry(0.06, 0.35, 5), mat(0x6fbf5f), 1400);
  const fleurs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshStandardMaterial({ roughness: 0.6 }), 500);
  const m = new THREE.Matrix4(), col = new THREE.Color();
  const pastels = [0xffffff, 0xffb3d9, 0xffe28a, 0xc9b3ff, 0x9fe8ff];
  for (let i = 0; i < 1400; i++) {
    const z = entre(-15, 45), x = cheminX(z) + choisir([-1, 1]) * entre(1.1, 14);
    m.makeRotationZ(entre(-0.3, 0.3)).setPosition(x, 0.15, z);
    herbe.setMatrixAt(i, m);
  }
  for (let i = 0; i < 500; i++) {
    const z = entre(-15, 45), x = cheminX(z) + choisir([-1, 1]) * entre(1.1, 10);
    m.makeTranslation(x, 0.12, z);
    fleurs.setMatrixAt(i, m);
    fleurs.setColorAt(i, col.set(choisir(pastels)));
  }
  scene.add(herbe, fleurs);
}

// Arbres doux aux feuillages pastel
const feuillages = [0x7fd1a8, 0x5fbf8f, 0xa6e3a1, 0xf7b5d0, 0xc9b6ff, 0x8fd6c4];
function arbre(x, z, s) {
  const g = new THREE.Group();
  const tronc = mesh(new THREE.CylinderGeometry(0.22 * s, 0.38 * s, 3.2 * s, 10), mat(0x8a6656), 0, 1.6 * s, 0, g);
  tronc.castShadow = true;
  const c = choisir(feuillages);
  for (let k = 0; k < 6; k++) {
    const b = mesh(new THREE.SphereGeometry(entre(0.9, 1.5) * s, 16, 12), mat(c), entre(-0.9, 0.9) * s, (3.4 + entre(0, 1.4)) * s, entre(-0.9, 0.9) * s, g);
    b.castShadow = true;
  }
  g.position.set(x, 0, z);
  scene.add(g);
}
for (let z = -14; z < 44; z += 1.8) {
  for (const cote of [-1, 1]) {
    if (rnd() < 0.85) arbre(cheminX(z) + cote * entre(3.2, 7), z + entre(-0.6, 0.6), entre(0.8, 1.25));
    if (rnd() < 0.7) arbre(cheminX(z) + cote * entre(8, 16), z + entre(-0.6, 0.6), entre(1, 1.6));
  }
}

// Champignons lumineux
const champignons = [];
const teintes = [0xff6fbf, 0x5ff0ff, 0xb48cff, 0xffc75f];
function champignon(x, z, s, c) {
  const g = new THREE.Group();
  mesh(new THREE.CylinderGeometry(0.1 * s, 0.14 * s, 0.5 * s, 12), brille(0xfff1e0, 0.25), 0, 0.25 * s, 0, g);
  const chapeau = mesh(new THREE.SphereGeometry(0.36 * s, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), brille(c, 1.4), 0, 0.46 * s, 0, g);
  chapeau.scale.y = 0.75;
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + entre(0, 0.5), r = entre(0.15, 0.28) * s;
    mesh(new THREE.SphereGeometry(0.04 * s, 8, 6), brille(0xffffff, 1.2), Math.cos(a) * r, 0.46 * s + Math.sqrt(Math.max(0, (0.36 * s) ** 2 - r * r)) * 0.75, Math.sin(a) * r, g);
  }
  g.position.set(x, 0, z);
  g.rotation.z = entre(-0.15, 0.15);
  champignons.push(g);
  scene.add(g);
}
for (let z = -10; z < 42; z += entre(1.2, 2.2)) {
  const cote = choisir([-1, 1]), x0 = cheminX(z) + cote * entre(1.2, 2.6), c = choisir(teintes);
  const n = 1 + Math.floor(rnd() * 3);
  for (let k = 0; k < n; k++) champignon(x0 + entre(-0.4, 0.4), z + entre(-0.4, 0.4), entre(0.6, 1.4), c);
}

// Rayons de lumière
{
  const cv = Object.assign(document.createElement('canvas'), { width: 64, height: 256 });
  const c = cv.getContext('2d');
  const gr = c.createLinearGradient(0, 0, 64, 0);
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = gr; c.fillRect(0, 0, 64, 256);
  const tex = new THREE.CanvasTexture(cv);
  for (let z = -8; z < 40; z += 4) {
    const r = mesh(new THREE.PlaneGeometry(1.6, 16), new THREE.MeshBasicMaterial({
      map: tex, color: 0xfff0c8, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
    }), cheminX(z) + entre(-5, 5), 6, z - 3, scene);
    r.rotation.set(0, entre(-0.4, 0.4), 0.45);
  }
}

// Lucioles / paillettes lumineuses
const NL = 160;
const lucioles = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff2a0, toneMapped: false }), NL);
const lucData = Array.from({ length: NL }, () => {
  const z = entre(-8, 40);
  return { x: cheminX(z) + entre(-4, 4), y: entre(0.3, 3), z, p: entre(0, 6.28), v: entre(0.4, 1.1) };
});
scene.add(lucioles);

// Papillons scintillants
const ailesFormes = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.15, 0.25, 0.42, 0.28, 0.4, 0.05);
  s.bezierCurveTo(0.38, -0.1, 0.3, -0.12, 0.22, -0.08);
  s.bezierCurveTo(0.3, -0.25, 0.12, -0.32, 0, -0.05);
  return new THREE.ShapeGeometry(s);
})();
const couleursPap = [0xff7ad9, 0x8ad8ff, 0xd3a6ff, 0xffd36b, 0xff9fb8, 0x7fffd4];
const papillons = Array.from({ length: 9 }, (_, i) => {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: couleursPap[i % 6], emissive: couleursPap[i % 6], emissiveIntensity: 0.9, side: THREE.DoubleSide, roughness: 0.3, metalness: 0.3 });
  const corps = mesh(new THREE.CapsuleGeometry(0.014, 0.07, 4, 8), mat(0x6a4a8a), 0, 0, 0, g);
  corps.rotation.x = Math.PI / 2;
  const ailes = [1, -1].map((s) => {
    const p = new THREE.Group();
    const a = mesh(ailesFormes, m, 0, 0, 0, p);
    a.rotation.x = -Math.PI / 2;
    a.scale.set(0.55 * s, 0.55, 0.55);
    g.add(p);
    return p;
  });
  g.scale.setScalar(1.15);
  scene.add(g);
  return { g, ailes, p: entre(0, 6.28), r: entre(0.8, 1.8), h: entre(0.9, 2.2), v: entre(0.5, 0.9) };
});

// ---------- POPPY : chat blanc tigré gris, yeux verts, collier rose ----------
const GRIS = 'vec3(0.33,0.35,0.40)';
const RAYURES = {
  corps: `float s = sin(vP.z*15.0 + sin(vP.y*6.0)*1.3);
          float m = smoothstep(0.02,0.25,vP.y) * smoothstep(0.15,0.75,s);`,
  tete: `float m1 = smoothstep(0.2,0.36,vP.y) * smoothstep(-0.05,0.2,vP.z) * smoothstep(0.25,0.8,sin(vP.x*30.0+1.57));
         float m2 = smoothstep(0.28,0.4,abs(vP.x)) * smoothstep(0.35,0.85,sin(vP.y*32.0)) * smoothstep(-0.15,0.05,vP.y) * smoothstep(0.2,-0.1,vP.z);
         float m3 = smoothstep(0.1,0.3,vP.y) * smoothstep(0.05,-0.2,vP.z) * smoothstep(0.25,0.8,sin(vP.z*24.0));
         float m = max(m1, max(m2*0.85, m3));`,
  queue: `float m = smoothstep(0.1,0.7,sin((vP.y*1.2 - vP.z*0.8)*22.0));`,
  patte: `float m = smoothstep(0.0,0.12,vP.y+0.05) * smoothstep(0.4,0.85,sin(vP.y*34.0)) * 0.9;`,
};
function tigre(type) {
  const m = mat(0xffffff, { roughness: 0.9, emissive: 0x4a4a52 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvP = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vP;')
      .replace('#include <color_fragment>', `#include <color_fragment>\n{ ${RAYURES[type]} diffuseColor.rgb = mix(diffuseColor.rgb, ${GRIS}, m); }`);
  };
  m.customProgramCacheKey = () => type;
  return m;
}

const poppy = new THREE.Group();
scene.add(poppy);
const blanc = mat(0xffffff, { roughness: 0.9, emissive: 0x4a4a52 }), rose = mat(0xff9cc0), noir = mat(0x15121c, { roughness: 0.3 });
{
  const g = new THREE.CapsuleGeometry(0.36, 0.55, 8, 24);
  g.rotateX(Math.PI / 2);
  const corps = mesh(g, tigre('corps'), 0, 0.64, 0, poppy);
  corps.castShadow = true;
}
const tete = new THREE.Group();
tete.position.set(0, 1.2, 0.56);
poppy.add(tete);
{
  const crane = mesh(new THREE.SphereGeometry(0.42, 32, 24), tigre('tete'), 0, 0, 0, tete);
  crane.scale.set(1.1, 0.95, 0.95);
  crane.castShadow = true;
  for (const s of [-1, 1]) {
    const joue = mesh(new THREE.SphereGeometry(0.2, 16, 12), blanc, s * 0.22, -0.13, 0.2, tete);
    joue.scale.set(1, 0.8, 0.9);
    mesh(new THREE.SphereGeometry(0.1, 16, 12), blanc, s * 0.07, -0.13, 0.36, tete);
    const rosee = mesh(new THREE.SphereGeometry(0.065, 12, 8), new THREE.MeshStandardMaterial({ color: 0xffa3c4, transparent: true, opacity: 0.7 }), s * 0.27, -0.09, 0.3, tete);
    rosee.scale.z = 0.3;
    // Oreilles
    const o = mesh(new THREE.ConeGeometry(0.15, 0.32, 16), blanc, s * 0.23, 0.36, -0.02, tete);
    o.rotation.z = -s * 0.35;
    const oi = mesh(new THREE.ConeGeometry(0.085, 0.2, 12), rose, s * 0.22, 0.34, 0.03, tete);
    oi.rotation.z = -s * 0.35;
    // Moustaches
    for (let k = -1; k <= 1; k++) {
      const m = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.36, 4), mat(0xc4c8d0), s * 0.28, -0.13 + k * 0.035, 0.36, tete);
      m.rotation.z = Math.PI / 2 + s * k * 0.12;
      m.rotation.y = -s * 0.25;
    }
  }
  const nez = mesh(new THREE.SphereGeometry(0.045, 12, 8), mat(0xff7aa8, { roughness: 0.4 }), 0, -0.06, 0.42, tete);
  nez.scale.set(1.3, 0.8, 0.8);
}
// Yeux verts (groupe à part pour cligner)
const yeux = [-1, 1].map((s) => {
  const g = new THREE.Group();
  g.position.set(s * 0.16, 0.04, 0.33);
  const iris = mesh(new THREE.SphereGeometry(0.11, 24, 16), new THREE.MeshStandardMaterial({ color: 0x3ccf6e, emissive: 0x1a7a3a, emissiveIntensity: 0.3, roughness: 0.15 }), 0, 0, 0, g);
  iris.scale.set(1, 1.18, 0.55);
  const pupille = mesh(new THREE.SphereGeometry(0.07, 16, 12), noir, 0, 0, 0.03, g);
  pupille.scale.set(0.65, 1.15, 0.55);
  mesh(new THREE.SphereGeometry(0.025, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), 0.03, 0.05, 0.07, g);
  mesh(new THREE.SphereGeometry(0.012, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), -0.025, -0.03, 0.07, g);
  g.rotation.y = s * 0.12;
  tete.add(g);
  return g;
});
// Collier rose, perles et clochette dorée
{
  const col = new THREE.Group();
  col.position.set(0, 0.9, 0.5);
  col.rotation.x = -Math.PI / 3.2;
  poppy.add(col);
  mesh(new THREE.TorusGeometry(0.27, 0.055, 12, 40), mat(0xff3f93, { roughness: 0.35 }), 0, 0, 0, col);
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2;
    mesh(new THREE.SphereGeometry(0.022, 8, 6), new THREE.MeshStandardMaterial({ color: 0xfff6fb, roughness: 0.2, metalness: 0.3 }), Math.cos(a) * 0.27, Math.sin(a) * 0.27, 0.05, col);
  }
  const cloche = mesh(new THREE.SphereGeometry(0.07, 16, 12), new THREE.MeshStandardMaterial({ color: 0xffd34d, metalness: 0.2, roughness: 0.3, emissive: 0xc98a00, emissiveIntensity: 0.35 }), 0, -0.33, 0.04, col);
  cloche.scale.y = 1.1;
  // petit cœur rose
  const coeur = new THREE.Shape();
  coeur.moveTo(0, -0.05);
  coeur.bezierCurveTo(-0.07, 0, -0.05, 0.05, 0, 0.025);
  coeur.bezierCurveTo(0.05, 0.05, 0.07, 0, 0, -0.05);
  const c = mesh(new THREE.ExtrudeGeometry(coeur, { depth: 0.02, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008 }), brille(0xff3d8b, 0.5), 0.1, -0.3, 0.08, col);
  c.scale.setScalar(1.3);
}
// Pattes
const pattes = [[1, 0.36], [-1, 0.36], [1, -0.36], [-1, -0.36]].map(([s, z]) => {
  const p = new THREE.Group();
  p.position.set(s * 0.19, 0.55, z);
  const j = mesh(new THREE.CapsuleGeometry(0.1, 0.3, 6, 12), tigre('patte'), 0, -0.24, 0, p);
  j.castShadow = true;
  const pied = mesh(new THREE.SphereGeometry(0.12, 12, 10), blanc, 0, -0.47, 0.03, p);
  pied.scale.set(1, 0.6, 1.2);
  poppy.add(p);
  return p;
});
// Queue en crosse
const queue = new THREE.Group();
queue.position.set(0, 0.75, -0.6);
poppy.add(queue);
{
  const courbe = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.2, -0.35), new THREE.Vector3(0, 0.65, -0.45),
    new THREE.Vector3(0, 0.95, -0.25), new THREE.Vector3(0, 1.0, -0.05),
  ]);
  const q = mesh(new THREE.TubeGeometry(courbe, 40, 0.065, 12), tigre('queue'), 0, 0, 0, queue);
  q.castShadow = true;
  mesh(new THREE.SphereGeometry(0.066, 12, 8), mat(0x8a8f99), 0, 1.0, -0.05, queue);
}

function animerPoppy(t) {
  const d = distance(t);
  const z = d, x = cheminX(z);
  const pente = (cheminX(z + 0.05) - x) / 0.05;
  poppy.position.set(x, 0, z);
  poppy.rotation.y = Math.atan(pente);
  const marche = t < ARRET ? 1 : 1 - lisse(ARRET, ARRET + 1.2, t);
  const phase = d * 4.2;
  pattes[0].rotation.x = pattes[3].rotation.x = Math.sin(phase) * 0.55 * marche;
  pattes[1].rotation.x = pattes[2].rotation.x = -Math.sin(phase) * 0.55 * marche;
  poppy.position.y = Math.abs(Math.cos(phase)) * 0.035 * marche;
  // La tête regarde autour d'elle, puis vers nous à la fin
  const regardeNous = lisse(ARRET - 0.5, ARRET + 0.8, t);
  tete.rotation.y = (Math.sin(t * 0.7) * 0.45 + Math.sin(t * 1.9) * 0.12) * (1 - regardeNous);
  tete.rotation.x = -0.08 + Math.sin(phase * 2) * 0.03 * marche - 0.12 * regardeNous;
  tete.rotation.z = Math.sin(t * 1.1) * 0.08 + regardeNous * Math.sin(t * 3) * 0.12;
  queue.rotation.z = Math.sin(t * 2.2) * 0.3;
  queue.rotation.x = Math.sin(t * 1.3) * 0.08;
  // Clignement des yeux
  const c = (t % 3.3);
  const cl = c < 0.14 ? 1 - Math.sin((c / 0.14) * Math.PI) * 0.92 : 1;
  yeux.forEach((e) => { e.scale.y = cl; });
  soleil.position.set(x - 6, 10, z - 4);
  soleil.target.position.set(x, 0, z);
}

// ---------- animation du décor ----------
const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S1 = new THREE.Vector3();
function animerDecor(t) {
  lucData.forEach((l, i) => {
    V.set(l.x + Math.sin(t * l.v + l.p) * 0.6, l.y + Math.sin(t * l.v * 1.3 + l.p * 2) * 0.35, l.z + Math.cos(t * l.v * 0.8 + l.p) * 0.6);
    const sc = 0.5 + 0.7 * Math.max(0, Math.sin(t * 2.5 + l.p * 3));
    M.compose(V, Q, S1.setScalar(sc));
    lucioles.setMatrixAt(i, M);
  });
  lucioles.instanceMatrix.needsUpdate = true;

  const P = poppy.position;
  papillons.forEach((b, i) => {
    let px = P.x + Math.cos(t * b.v + b.p) * b.r * 1.3;
    let py = b.h + Math.sin(t * b.v * 2 + b.p) * 0.3;
    let pz = P.z + 0.6 + Math.sin(t * b.v * 1.4 + b.p) * b.r;
    // À la fin, un papillon se pose sur la tête de Poppy
    if (i === 0) {
      const k = lisse(timing.duree - 3.2, timing.duree - 1.6, t);
      const cible = tete.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0.05, 0.46, 0));
      px += (cible.x - px) * k; py += (cible.y - py) * k; pz += (cible.z - pz) * k;
    }
    const dx = -Math.sin(t * b.v + b.p), dz = Math.cos(t * b.v * 1.4 + b.p);
    b.g.position.set(px, py, pz);
    b.g.rotation.y = Math.atan2(dx, dz);
    const repos = i === 0 ? lisse(timing.duree - 1.8, timing.duree - 1.4, t) : 0;
    const battement = Math.sin(t * (18 - 12 * repos) + i) * (0.9 - 0.5 * repos) + 0.2;
    b.ailes[0].rotation.z = battement;
    b.ailes[1].rotation.z = -battement;
  });
}

// ---------- caméra : un plan par ligne de la chanson ----------
const lignes = timing.lignes;
const debutLigne = (i) => timing.intro + i * (lignes[1].mots[0].t - lignes[0].mots[0].t);
function placerCamera(t) {
  const P = poppy.position.clone();
  const regard = P.clone().add(new THREE.Vector3(0, 0.9, 0));
  let pos;
  const plan = t < timing.intro ? -1 : Math.min(Math.floor((t - timing.intro) / (debutLigne(1) - debutLigne(0))), 6);
  const u = t < timing.intro ? t / timing.intro : (t - debutLigne(Math.min(plan, 5))) / (debutLigne(1) - debutLigne(0));
  switch (plan) {
    case -1: { // plan d'ouverture : on descend à travers la forêt
      const k = lisse(0, 1, u);
      pos = P.clone().add(new THREE.Vector3(3 - 1.6 * k, 7 - 4.6 * k, 12 - 4.5 * k));
      regard.y += 1.5 * (1 - k);
      break;
    }
    case 0: pos = P.clone().add(new THREE.Vector3(0.9, 1.9, 6.0)); break;                                  // face, Poppy avance
    case 1: pos = P.clone().add(new THREE.Vector3(4.4 - u * 1.2, 1.6, 3.4 + u * 0.8)); break;              // trois-quarts
    case 2: pos = P.clone().add(new THREE.Vector3(-3.8, 0.55, 2.6 + u * 0.6)); regard.y -= 0.1; regard.z += 0.4; break;     // ras du sol, champignons
    case 3: pos = P.clone().add(new THREE.Vector3(0.4, 1.0, 3.6)); regard.y += 0.5; break;               // gros plan, papillons
    case 4: pos = P.clone().add(new THREE.Vector3(Math.sin(u * 1.2) * 0.7, 1.9 + u * 0.8, 6.5 + u * 1.5)); regard.y += 0.5; break; // grue
    case 5: pos = P.clone().add(new THREE.Vector3(0, 1.5, 4.6)); regard.y += 0.2; break;                  // face caméra
    default: { // fin : on recule doucement
      const k = lisse(0, 1, (t - debutLigne(6)) / 2.8);
      pos = P.clone().add(new THREE.Vector3(0, 1.5 + k * 0.8, 4.6 + k * 2));
      regard.y += 0.25;
    }
  }
  camera.position.copy(pos);
  camera.lookAt(regard);
  // Rien ne doit boucher la vue : on cache les champignons collés à la caméra
  for (const c of champignons) c.visible = c.position.distanceTo(pos) > 2.2;
}

// ---------- textes (titre + sous-titres karaoké) ----------
const sortie = document.getElementById('video');
const ctx = sortie.getContext('2d');
function texte(str, x, y, taille, remplissage, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.font = `700 ${taille}px Fredoka`;
  ctx.lineJoin = 'round';
  ctx.lineWidth = taille * 0.2;
  ctx.strokeStyle = '#5a2a82';
  ctx.strokeText(str, x, y);
  ctx.fillStyle = remplissage;
  ctx.fillText(str, x, y);
  ctx.globalAlpha = 1;
}
function sousTitres(t) {
  const L = lignes.find((l) => t >= l.debut && t < l.fin + 0.0);
  if (!L) return;
  const a = lisse(L.debut, L.debut + 0.2, t) * (1 - lisse(L.fin - 0.15, L.fin, t));
  const taille = 70, maxW = 820;
  ctx.font = `700 ${taille}px Fredoka`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  // Découpe en rangées
  const esp = ctx.measureText(' ').width;
  const rangees = [[]];
  let w = 0;
  for (const m of L.mots) {
    const mw = ctx.measureText(m.mot).width;
    if (w + mw > maxW && rangees.at(-1).length) { rangees.push([]); w = 0; }
    rangees.at(-1).push({ ...m, w: mw });
    w += mw + esp;
  }
  const y0 = 1380 - (rangees.length - 1) * taille * 0.6;
  rangees.forEach((r, ri) => {
    const total = r.reduce((s, m) => s + m.w, 0) + esp * (r.length - 1);
    let x = (W - total) / 2;
    for (const m of r) {
      const chante = t >= m.t - 0.05;
      const pop = chante ? 1 + 0.08 * (1 - lisse(m.t, m.t + 0.25, t)) : 1;
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
  const a = lisse(0.2, 0.8, t) * (1 - lisse(3.4, 4.0, t));
  if (a > 0) {
    const s = 1 + 0.04 * Math.sin(t * 3);
    ctx.save();
    ctx.translate(W / 2, 330);
    ctx.scale(s, s);
    texte('Poppy', 0, -30, 150, '#ff7ac8', a);
    texte('dans la forêt enchantée', 0, 90, 66, '#ffffff', a);
    ctx.restore();
  }
  const b = lisse(timing.duree - 2.6, timing.duree - 2.0, t);
  if (b > 0) texte('À bientôt avec Poppy !', W / 2, 360, 76, '#ffe066', b);
}

// ---------- une image ----------
window.image = (t) => {
  animerPoppy(t);
  animerDecor(t);
  placerCamera(t);
  composer.render();
  ctx.drawImage(gl.domElement, 0, 0, W, H);
  titres(t);
  sousTitres(t);
  // Fondu d'ouverture et de fermeture
  const f = Math.max(1 - lisse(0, 0.5, t), lisse(timing.duree - 0.8, timing.duree, t));
  if (f > 0) { ctx.fillStyle = `rgba(255,240,248,${f})`; ctx.fillRect(0, 0, W, H); }
  return sortie.toDataURL('image/jpeg', 0.92);
};
window.duree = timing.duree;
window.pret = true;

// Aperçu en direct si on ouvre la page dans un navigateur
if (!navigator.webdriver) {
  const t0 = performance.now();
  const boucle = () => { window.image(((performance.now() - t0) / 1000) % timing.duree); requestAnimationFrame(boucle); };
  boucle();
}
