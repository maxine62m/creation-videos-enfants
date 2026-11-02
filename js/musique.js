// ÉTAPE 3 — Musique originale générée par l'iPad (Web Audio), à partir d'un "numéro de mélodie".
// Même numéro = même mélodie : on peut garder un générique identique pour toute une série.

function aleatoire(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PENTA = [0, 2, 4, 7, 9]; // gamme pentatonique : toujours joli, jamais faux
const freq = (demiTons, base = 261.63) => base * Math.pow(2, demiTons / 12);

function note(ac, dest, f, t, duree, type, volume) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.value = f;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(volume, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + duree + 0.05);
}

// Programme la musique de t0 à t0+duree. Renvoie un nœud "volume" (pour couper la musique).
export function jouerMusique(ac, sortie, t0, duree, seed, theme, volume = 0.5) {
  const rnd = aleatoire(seed);
  const tempo = theme === 'dodo' ? 76 : 112;
  const temps = 60 / tempo;
  const phrase = () => Array.from({ length: 8 }, () => PENTA[Math.floor(rnd() * 5)] + (rnd() < 0.25 ? 12 : 0));
  const A = phrase(), B = phrase();
  const chanson = [...A, ...A, ...B, ...A]; // forme AABA, facile à retenir
  const accords = [0, 5, 7, 0]; // Do, Fa, Sol, Do

  const master = ac.createGain();
  master.gain.value = volume;
  master.connect(sortie);

  const fin = t0 + duree;
  for (let i = 0, t = t0; t < fin - 0.3; i++, t += temps) {
    const n = chanson[i % chanson.length];
    // Mélodie (une pause de temps en temps pour respirer)
    if (i % 8 !== 7) note(ac, master, freq(n), t, temps * 0.9, theme === 'dodo' ? 'sine' : 'triangle', 0.18);
    // Basse sur chaque mesure de 4 temps
    if (i % 4 === 0) note(ac, master, freq(accords[(i / 4) % 4], 130.81), t, temps * 3.8, 'sine', 0.22);
    // Petit "tic" rythmique
    if (theme !== 'dodo' && i % 2 === 1) note(ac, master, 2200, t, 0.05, 'square', 0.03);
  }
  // Fondu de sortie
  master.gain.setValueAtTime(volume, Math.max(t0, fin - 1.5));
  master.gain.linearRampToValueAtTime(0.0001, fin);
  return master;
}
