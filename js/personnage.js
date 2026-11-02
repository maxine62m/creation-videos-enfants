// ÉTAPE 1 — Personnage 3D construit avec des formes simples (sphères, capsules…).
// Toute son apparence vient d'une "fiche" (objet JSON) : même fiche = même personnage.
import * as THREE from 'three';

export const FICHE_PAR_DEFAUT = {
  nom: 'Pompon', pronom: 'il', espece: 'ours', accessoire: 'noeud',
  couleur: '#c8865a', ventre: '#f3d9b8', nez: '#5a3825', acc: '#e94b6a', tete: 1.05,
};

const toon = (color) => new THREE.MeshToonMaterial({ color });

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

export function construirePersonnage(f) {
  const g = new THREE.Group();
  const fourrure = toon(f.couleur), ventre = toon(f.ventre), noir = toon(0x1e1a24),
    blanc = toon(0xffffff), rose = toon(0xff9bb0), acc = toon(f.acc), nez = toon(f.nez);
  const T = f.tete;

  // Corps + ventre
  const corps = mesh(new THREE.SphereGeometry(0.55, 32, 24), fourrure, 0, 0.75, 0);
  corps.scale.set(1, 1.1, 0.9);
  g.add(corps);
  const bidon = mesh(new THREE.SphereGeometry(0.38, 32, 24), ventre, 0, 0.7, 0.33);
  bidon.scale.set(1, 1.1, 0.5);
  g.add(bidon);

  // Tête
  const tete = new THREE.Group();
  tete.position.y = 1.5;
  g.add(tete);
  tete.add(mesh(new THREE.SphereGeometry(0.5 * T, 32, 24), fourrure));
  const museau = mesh(new THREE.SphereGeometry(0.18, 24, 16), ventre, 0, -0.13 * T, 0.42 * T);
  museau.scale.set(1.35, 0.9, 0.7);
  tete.add(museau);
  tete.add(mesh(new THREE.SphereGeometry(0.07, 16, 12), nez, 0, -0.07 * T, 0.55 * T));

  for (const s of [-1, 1]) {
    // Yeux
    tete.add(mesh(new THREE.SphereGeometry(0.12, 20, 16), blanc, s * 0.18 * T, 0.08 * T, 0.4 * T));
    tete.add(mesh(new THREE.SphereGeometry(0.075, 16, 12), noir, s * 0.18 * T, 0.08 * T, 0.5 * T));
    tete.add(mesh(new THREE.SphereGeometry(0.025, 8, 8), blanc, s * 0.18 * T + 0.03, 0.12 * T, 0.57 * T));
    // Joues
    const joue = mesh(new THREE.SphereGeometry(0.08, 16, 12), rose, s * 0.3 * T, -0.12 * T, 0.37 * T);
    joue.scale.z = 0.4;
    tete.add(joue);
    // Oreilles selon l'espèce
    if (f.espece === 'ours') {
      tete.add(mesh(new THREE.SphereGeometry(0.16, 20, 16), fourrure, s * 0.33 * T, 0.38 * T, 0));
      tete.add(mesh(new THREE.SphereGeometry(0.09, 16, 12), rose, s * 0.33 * T, 0.38 * T, 0.09));
    } else if (f.espece === 'chat') {
      const o = mesh(new THREE.ConeGeometry(0.17, 0.36, 24), fourrure, s * 0.28 * T, 0.48 * T, 0);
      o.rotation.z = -s * 0.3;
      tete.add(o);
    } else {
      const o = mesh(new THREE.CapsuleGeometry(0.09, 0.5, 8, 16), fourrure, s * 0.15 * T, 0.7 * T, 0);
      o.rotation.z = -s * 0.15;
      tete.add(o);
      const i = mesh(new THREE.CapsuleGeometry(0.05, 0.4, 8, 12), rose, s * 0.15 * T, 0.7 * T, 0.06);
      i.rotation.z = -s * 0.15;
      tete.add(i);
    }
  }

  // Accessoire
  if (f.accessoire === 'noeud') {
    for (const s of [-1, 1]) {
      const c = mesh(new THREE.ConeGeometry(0.1, 0.2, 16), acc, s * 0.1, 0.45 * T, 0.12);
      c.rotation.z = s * Math.PI / 2;
      tete.add(c);
    }
    tete.add(mesh(new THREE.SphereGeometry(0.05, 12, 8), acc, 0, 0.45 * T, 0.12));
  } else if (f.accessoire === 'chapeau') {
    tete.add(mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 32), acc, 0, 0.4 * T, 0));
    tete.add(mesh(new THREE.CylinderGeometry(0.24, 0.27, 0.3, 32), acc, 0, 0.56 * T, 0));
  } else if (f.accessoire === 'echarpe') {
    const e = mesh(new THREE.TorusGeometry(0.33, 0.08, 12, 32), acc, 0, 1.18, 0);
    e.rotation.x = Math.PI / 2;
    g.add(e);
  }

  // Bras (dans un "pivot" pour pouvoir les faire bouger depuis l'épaule)
  const bras = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.48, 1.0, 0);
    pivot.add(mesh(new THREE.CapsuleGeometry(0.11, 0.35, 8, 16), fourrure, 0, -0.25, 0));
    g.add(pivot);
    bras.push(pivot);
    // Jambes + pieds
    g.add(mesh(new THREE.CapsuleGeometry(0.14, 0.2, 8, 16), fourrure, s * 0.24, 0.22, 0));
    const pied = mesh(new THREE.SphereGeometry(0.15, 16, 12), ventre, s * 0.24, 0.08, 0.1);
    pied.scale.set(1, 0.6, 1.3);
    g.add(pied);
  }

  g.userData = { tete, bras };
  return g;
}

// Animation : énergie 0 = calme, 1 = danse
export function animerPersonnage(perso, t, energie = 1) {
  const { tete, bras } = perso.userData;
  perso.position.y = Math.abs(Math.sin(t * 3.2)) * 0.12 * energie;
  perso.rotation.y = Math.sin(t * 0.8) * 0.35;
  tete.rotation.z = Math.sin(t * 1.6) * 0.12;
  tete.rotation.x = Math.sin(t * 3.2) * 0.05;
  bras[0].rotation.z = -(0.35 + (0.5 + 0.5 * Math.sin(t * 5)) * 0.9 * energie);
  bras[1].rotation.z = 0.35 + (0.5 + 0.5 * Math.sin(t * 5 + Math.PI)) * 0.9 * energie;
}
