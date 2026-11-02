// Chef d'orchestre : relie personnage, comptine, voix, musique, et fabrique la vidéo (ÉTAPES 4, 5, 6).
import * as THREE from 'three';
import { FICHE_PAR_DEFAUT, construirePersonnage, animerPersonnage } from './personnage.js';
import { genererComptine, decouperScenes } from './comptines.js';
import { jouerMusique } from './musique.js';

const $ = (s) => document.querySelector(s);
const FORMATS = {
  vertical: { w: 720, h: 1280, nom: 'short' },   // YouTube Shorts / TikTok (9:16)
  horizontal: { w: 1280, h: 720, nom: 'youtube' }, // YouTube classique (16:9)
};
const INTRO = 3, OUTRO = 3, DUREE_SCENE_SANS_VOIX = 7;

// ---------- Sauvegarde locale (sur l'iPad) ----------
const lire = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const ecrire = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* mode privé */ } };

const etat = {
  fiche: { ...FICHE_PAR_DEFAUT, ...(lire('fiche') || {}) },
  theme: lire('theme') || 'jardin',
  titre: '', texte: '',
  format: 'vertical',
  seed: lire('seed') || 7,
  volume: 0.5,
  voix: null,         // AudioBuffer de la voix (micro ou fichier)
  lecture: null,      // { debut, total, scenes, dureeScene, enregistre }
};
const projet = lire('projet');
if (projet) { etat.titre = projet.titre; etat.texte = projet.texte; }
else Object.assign(etat, genererComptine(etat.theme, etat.fiche));

let audioCtx = null;
const audio = () => (audioCtx ||= new (window.AudioContext || window.webkitAudioContext)());

// ---------- Scène 3D ----------
const sortie = $('#stage');
const ctx = sortie.getContext('2d');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
scene.add(new THREE.HemisphereLight(0xffffff, 0x99bb77, 2.2));
const soleil = new THREE.DirectionalLight(0xffffff, 2.2);
soleil.position.set(3, 6, 5);
scene.add(soleil);

let perso = null;
let decor = null;
const toon = (c) => new THREE.MeshToonMaterial({ color: c });

function construireDecor(theme) {
  if (decor) scene.remove(decor);
  decor = new THREE.Group();
  const nuit = theme === 'dodo', pluie = theme === 'pluie';
  scene.background = new THREE.Color(nuit ? 0x1f2a5c : pluie ? 0x9db3c7 : 0x9be7ff);
  const sol = new THREE.Mesh(new THREE.CircleGeometry(9, 48), toon(nuit ? 0x3d6b4f : 0x8fd16a));
  sol.rotation.x = -Math.PI / 2;
  decor.add(sol);

  const astre = new THREE.Mesh(new THREE.SphereGeometry(0.6, 32, 24),
    new THREE.MeshBasicMaterial({ color: nuit ? 0xfff3c4 : 0xffd23f }));
  astre.position.set(2.6, 4.2, -5);
  if (!pluie) decor.add(astre);

  const rnd = (a, b) => a + Math.random() * (b - a);
  // Arbres
  for (const [x, z] of [[-3, -3], [3.4, -3.5], [-4.5, -1]]) {
    const tronc = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 1.2, 12), toon(0x8b5a3c));
    tronc.position.set(x, 0.6, z);
    const feuilles = new THREE.Mesh(new THREE.SphereGeometry(0.9, 20, 16), toon(nuit ? 0x2f5d3a : 0x4caf50));
    feuilles.position.set(x, 1.7, z);
    decor.add(tronc, feuilles);
  }
  // Fleurs
  if (!nuit) {
    const couleurs = [0xff6b9a, 0xffd23f, 0xb084ff, 0xff8a3d];
    for (let i = 0; i < 14; i++) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), toon(couleurs[i % 4]));
      const a = rnd(0, Math.PI * 2), r = rnd(1.4, 4);
      f.position.set(Math.cos(a) * r, 0.15, Math.sin(a) * r - 0.5);
      decor.add(f);
    }
  }
  // Étoiles
  const etoiles = [];
  if (nuit) {
    for (let i = 0; i < 60; i++) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      e.position.set(rnd(-9, 9), rnd(2, 8), rnd(-8, -5));
      etoiles.push(e);
      decor.add(e);
    }
  }
  // Pluie + nuages
  const gouttes = [];
  if (pluie) {
    for (const [x, y] of [[-2, 4], [1.5, 4.5], [3.5, 3.8]]) {
      for (let k = 0; k < 4; k++) {
        const n = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 12), toon(0xf2f5f8));
        n.position.set(x + k * 0.5 - 0.75, y + (k % 2) * 0.25, -4);
        decor.add(n);
      }
    }
    const matG = new THREE.MeshBasicMaterial({ color: 0x4aa3ff });
    for (let i = 0; i < 120; i++) {
      const g = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.15, 2, 4), matG);
      g.position.set(rnd(-6, 6), rnd(0, 6), rnd(-4, 2));
      gouttes.push(g);
      decor.add(g);
    }
  }
  decor.userData = { etoiles, gouttes };
  scene.add(decor);
}

function rafraichirPersonnage() {
  if (perso) scene.remove(perso);
  perso = construirePersonnage(etat.fiche);
  scene.add(perso);
}

function appliquerFormat() {
  const { w, h } = FORMATS[etat.format];
  sortie.width = w; sortie.height = h;
  renderer.setPixelRatio(1);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

// Plans de caméra : on change d'angle à chaque scène (comme au cinéma)
const PLANS = [
  { x: 0, y: 1.4, z: 5.2 }, { x: -2.2, y: 1.6, z: 4.6 }, { x: 0, y: 1.6, z: 3.6 }, { x: 2.2, y: 1.3, z: 4.8 },
];

function placerCamera(t, plan) {
  const vertical = etat.format === 'vertical';
  const p = PLANS[plan % PLANS.length];
  const recul = vertical ? 1.55 : 1;
  camera.position.set(p.x + Math.sin(t * 0.3) * 0.2, p.y + (vertical ? 0.4 : 0), p.z * recul);
  camera.lookAt(0, vertical ? 1.3 : 1.1, 0);
}

// ---------- Textes à l'écran ----------
function texteCentre(lignes, y, taille, { fond = true } = {}) {
  const { width: W } = sortie;
  ctx.font = `800 ${taille}px -apple-system, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lh = taille * 1.25;
  const largeur = Math.max(...lignes.map((l) => ctx.measureText(l).width));
  if (fond) {
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    const bw = Math.min(W - 24, largeur + taille * 1.4), bh = lignes.length * lh + taille * 0.9;
    ctx.beginPath();
    ctx.roundRect((W - bw) / 2, y - bh / 2, bw, bh, taille * 0.6);
    ctx.fill();
  }
  lignes.forEach((l, i) => {
    const ly = y + (i - (lignes.length - 1) / 2) * lh;
    ctx.lineWidth = taille * 0.18;
    ctx.strokeStyle = fond ? 'transparent' : '#2b2340';
    if (!fond) ctx.strokeText(l, W / 2, ly);
    ctx.fillStyle = fond ? '#2b2340' : '#ffffff';
    ctx.fillText(l, W / 2, ly);
  });
}

function couperLignes(texte, max) {
  const out = [];
  for (const ligne of texte.split('\n')) {
    let cur = '';
    for (const mot of ligne.split(' ')) {
      if (ctx.measureText(cur + ' ' + mot).width > max && cur) { out.push(cur); cur = mot; }
      else cur = cur ? cur + ' ' + mot : mot;
    }
    out.push(cur);
  }
  return out;
}

// ---------- Boucle d'animation (60 images/s) ----------
const horloge = performance.now();
function image() {
  requestAnimationFrame(image);
  const maintenant = performance.now();
  const t = (maintenant - horloge) / 1000;
  const L = etat.lecture;
  const W = sortie.width, H = sortie.height, vertical = etat.format === 'vertical';

  let plan = 0, sousTitre = null, titre = null, fin = false;
  if (L) {
    const e = (maintenant - L.debut) / 1000;
    if (e < INTRO) titre = etat.titre;
    else if (e < INTRO + L.scenes.length * L.dureeScene) {
      const i = Math.floor((e - INTRO) / L.dureeScene);
      plan = i + 1;
      sousTitre = L.scenes[i];
    } else fin = true;
  }

  animerPersonnage(perso, t, etat.theme === 'dodo' ? 0.45 : 1);
  const { etoiles, gouttes } = decor.userData;
  etoiles.forEach((s, i) => s.scale.setScalar(0.6 + 0.5 * Math.abs(Math.sin(t * 2 + i))));
  gouttes.forEach((g) => { g.position.y -= 0.12; if (g.position.y < 0) g.position.y = 6; });
  placerCamera(t, plan);
  renderer.render(scene, camera);

  ctx.drawImage(renderer.domElement, 0, 0, W, H);
  const taille = vertical ? 34 : 32;
  if (titre) texteCentre([titre], vertical ? H * 0.16 : H * 0.15, taille * 1.5);
  if (sousTitre) {
    ctx.font = `800 ${taille}px -apple-system, system-ui, sans-serif`;
    const lignes = couperLignes(sousTitre, W - 90);
    texteCentre(lignes, vertical ? H * 0.86 : H * 0.82, taille);
  }
  if (fin) texteCentre(['À bientôt ! 👋'], H * 0.18, taille * 1.5);
  if (!L) texteCentre([etat.fiche.nom], vertical ? H * 0.1 : H * 0.12, taille * 1.2, { fond: false });
}

// ---------- Lecture & enregistrement ----------
let enCours = null;

async function demarrer(enregistrer) {
  arreter();
  lireFormulaireHistoire();
  const scenes = decouperScenes(etat.texte);
  if (!scenes.length) return statut('Écris d\'abord une comptine (onglet 2).');
  const ac = audio();
  await ac.resume();

  const dureeScene = etat.voix ? etat.voix.duration / scenes.length : DUREE_SCENE_SANS_VOIX;
  const total = INTRO + scenes.length * dureeScene + OUTRO;
  const t0 = ac.currentTime + 0.15;

  const mix = ac.createGain();
  mix.connect(ac.destination);
  const dest = ac.createMediaStreamDestination();
  mix.connect(dest);
  jouerMusique(ac, mix, t0, total, etat.seed, etat.theme, etat.voix ? etat.volume * 0.6 : etat.volume);
  if (etat.voix) {
    const src = ac.createBufferSource();
    src.buffer = etat.voix;
    src.connect(mix);
    src.start(t0 + INTRO);
  }

  let recorder = null;
  if (enregistrer) {
    if (!window.MediaRecorder || !sortie.captureStream) {
      mix.disconnect();
      return statut('Ce navigateur ne sait pas enregistrer la vidéo. Mets à jour iPadOS (16 ou plus).');
    }
    const flux = sortie.captureStream(30);
    dest.stream.getAudioTracks().forEach((p) => flux.addTrack(p));
    const type = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm']
      .find((m) => MediaRecorder.isTypeSupported(m)) || '';
    recorder = new MediaRecorder(flux, { mimeType: type, videoBitsPerSecond: 6_000_000 });
    const morceaux = [];
    recorder.ondataavailable = (e) => e.data.size && morceaux.push(e.data);
    recorder.onstop = () => afficherResultat(new Blob(morceaux, { type: recorder.mimeType || type }));
    recorder.start(1000);
    $('#result').hidden = true;
  }

  etat.lecture = { debut: performance.now() + 150, scenes, dureeScene };
  const minuteur = setTimeout(arreter, total * 1000 + 400);
  enCours = { mix, recorder, minuteur, total };
  $('#btn-stop').hidden = false;
  $('#btn-play').disabled = $('#btn-record').disabled = true;
  statut(enregistrer ? `⏺️ Enregistrement… (${Math.round(total)} s) — laisse l'écran allumé` : '▶️ Aperçu en cours');
}

function arreter() {
  if (!enCours) return;
  const { mix, recorder, minuteur } = enCours;
  clearTimeout(minuteur);
  if (recorder && recorder.state !== 'inactive') recorder.stop();
  try { mix.disconnect(); } catch { /* déjà coupé */ }
  enCours = null;
  etat.lecture = null;
  $('#btn-stop').hidden = true;
  $('#btn-play').disabled = $('#btn-record').disabled = false;
  if (!recorder) statut('');
}

let fichierVideo = null;
function afficherResultat(blob) {
  const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
  const nom = `${etat.titre || 'comptine'}-${FORMATS[etat.format].nom}`.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-') + '.' + ext;
  fichierVideo = new File([blob], nom, { type: blob.type });
  const url = URL.createObjectURL(blob);
  $('#result-video').src = url;
  $('#btn-download').href = url;
  $('#btn-download').download = nom;
  $('#btn-share').hidden = !(navigator.canShare && navigator.canShare({ files: [fichierVideo] }));
  $('#result').hidden = false;
  statut(`✅ Vidéo prête : ${nom} (${(blob.size / 1e6).toFixed(1)} Mo)`);
}

const statut = (m) => { $('#status').textContent = m; };

// ---------- Formulaires ----------
const CHAMPS = ['nom', 'pronom', 'espece', 'accessoire', 'couleur', 'ventre', 'nez', 'acc', 'tete'];

function remplirFormulairePerso() {
  for (const k of CHAMPS) $('#c-' + k).value = etat.fiche[k];
}
function lireFormulairePerso() {
  for (const k of CHAMPS) etat.fiche[k] = k === 'tete' ? parseFloat($('#c-' + k).value) : $('#c-' + k).value;
  etat.fiche.nom = etat.fiche.nom.trim() || 'Pompon';
  ecrire('fiche', etat.fiche);
  rafraichirPersonnage();
}
function lireFormulaireHistoire() {
  etat.titre = $('#s-titre').value.trim();
  etat.texte = $('#s-texte').value;
  etat.theme = $('#s-theme').value;
  ecrire('projet', { titre: etat.titre, texte: etat.texte });
  ecrire('theme', etat.theme);
}

for (const k of CHAMPS) $('#c-' + k).addEventListener('input', lireFormulairePerso);

$('#btn-export-char').onclick = () => {
  const blob = new Blob([JSON.stringify(etat.fiche, null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `fiche-${etat.fiche.nom}.json` });
  a.click();
};
$('#file-char').onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    etat.fiche = { ...FICHE_PAR_DEFAUT, ...JSON.parse(await f.text()) };
    remplirFormulairePerso();
    lireFormulairePerso();
  } catch { alert('Fichier de personnage invalide.'); }
};

$('#btn-generate').onclick = () => {
  etat.theme = $('#s-theme').value;
  const c = genererComptine(etat.theme, etat.fiche);
  $('#s-titre').value = c.titre;
  $('#s-texte').value = c.texte;
  lireFormulaireHistoire();
  construireDecor(etat.theme);
};
$('#s-theme').onchange = () => { lireFormulaireHistoire(); construireDecor(etat.theme); };
$('#s-titre').oninput = $('#s-texte').oninput = lireFormulaireHistoire;

// Voix
$('#btn-tts').onclick = () => {
  lireFormulaireHistoire();
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(etat.titre + '. ' + etat.texte);
  u.lang = 'fr-FR';
  u.voice = speechSynthesis.getVoices().find((v) => v.lang.startsWith('fr')) || null;
  u.rate = 0.9; u.pitch = 1.2;
  speechSynthesis.speak(u);
};

async function chargerVoix(blob, origine) {
  try {
    etat.voix = await audio().decodeAudioData(await blob.arrayBuffer());
    const a = $('#voice-preview');
    a.src = URL.createObjectURL(blob);
    a.hidden = false;
    $('#voice-status').textContent = `✅ Voix ${origine} : ${etat.voix.duration.toFixed(1)} s — les scènes suivront ce rythme.`;
  } catch {
    $('#voice-status').textContent = '❌ Impossible de lire ce fichier audio.';
  }
}

let micro = null;
$('#btn-mic').onclick = async () => {
  if (micro) { micro.stop(); return; }
  try {
    const flux = await navigator.mediaDevices.getUserMedia({ audio: true });
    const morceaux = [];
    micro = new MediaRecorder(flux);
    micro.ondataavailable = (e) => morceaux.push(e.data);
    micro.onstop = () => {
      flux.getTracks().forEach((p) => p.stop());
      chargerVoix(new Blob(morceaux, { type: micro.mimeType }), 'enregistrée');
      micro = null;
      $('#btn-mic').textContent = '🎙️ M\'enregistrer';
    };
    micro.start();
    $('#btn-mic').textContent = '⏹️ Terminer';
    $('#voice-status').textContent = '🔴 Enregistrement… lis la comptine (sans le titre), puis touche « Terminer ».';
  } catch {
    $('#voice-status').textContent = '❌ Micro refusé. Autorise-le dans Réglages > Safari > Micro.';
  }
};
$('#file-voice').onchange = (e) => e.target.files[0] && chargerVoix(e.target.files[0], 'importée');
$('#btn-clear-voice').onclick = () => {
  etat.voix = null;
  $('#voice-preview').hidden = true;
  $('#voice-status').textContent = 'Pas de voix : chaque scène dure ' + DUREE_SCENE_SANS_VOIX + ' s.';
};

// Musique
const majSeed = () => { $('#m-seed').textContent = etat.seed; ecrire('seed', etat.seed); };
$('#btn-new-melody').onclick = () => { etat.seed = Math.floor(Math.random() * 99999); majSeed(); };
$('#m-volume').oninput = (e) => { etat.volume = parseFloat(e.target.value); };
$('#btn-music').onclick = async () => {
  const ac = audio();
  await ac.resume();
  jouerMusique(ac, ac.destination, ac.currentTime + 0.05, 8, etat.seed, etat.theme, etat.volume);
};

// Vidéo
$('#format').onchange = (e) => { etat.format = e.target.value; appliquerFormat(); };
$('#btn-play').onclick = () => demarrer(false);
$('#btn-record').onclick = () => demarrer(true);
$('#btn-stop').onclick = arreter;
$('#btn-share').onclick = () => fichierVideo && navigator.share({ files: [fichierVideo], title: etat.titre }).catch(() => {});

// Onglets
document.querySelectorAll('.tabs button').forEach((b) => {
  b.onclick = () => {
    document.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('active', x === b));
    document.querySelectorAll('.panel').forEach((p) => { p.hidden = p.id !== 'tab-' + b.dataset.tab; });
  };
});

// ---------- Démarrage ----------
remplirFormulairePerso();
$('#s-theme').value = etat.theme;
$('#s-titre').value = etat.titre;
$('#s-texte').value = etat.texte;
majSeed();
appliquerFormat();
construireDecor(etat.theme);
rafraichirPersonnage();
image();
