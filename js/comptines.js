// ÉTAPE 2 — Générateur de comptines originales (textes écrits pour ce projet, hors-ligne, gratuit).
// {nom} = nom du personnage, {il} = il/elle, {Il} = Il/Elle.

const THEMES = {
  jardin: {
    titres: ['{nom} au jardin', 'Le jardin de {nom}', 'Les fleurs de {nom}'],
    strophes: [
      'Dans le jardin de {nom},\nPoussent des fleurs et des potirons.\nUne coccinelle rouge et noire\nVient lui raconter une histoire.',
      "L'escargot sort sa maison,\n{Il} avance à reculons !\n{nom} rit, {nom} chante,\nLa journée est épatante.",
      'Une abeille fait bzz bzz bzz,\nUn papillon danse avec nous.\n{nom} tourne, tourne en rond,\nComme une toupie, comme un ballon.',
      'On arrose les petites graines,\nUne, deux, trois, quatre… une douzaine !\nDemain matin, tu verras,\nUne fleur pour toi poussera.',
    ],
  },
  pluie: {
    titres: ['{nom} sous la pluie', 'Plic ploc {nom}', 'Les bottes de {nom}'],
    strophes: [
      'Plic, ploc, il pleut des gouttes,\n{nom} saute sur la route.\nAvec ses bottes et son ciré,\nDans les flaques, {il} va sauter !',
      'Le nuage gris fait la grimace,\nIl pleure un peu, puis il se lasse.\n{nom} lui chante une chanson,\nEt le nuage devient tout rond.',
      'Puis le soleil sort de sa cachette,\nUn arc-en-ciel nous fait la fête.\nRouge, orange, jaune et vert,\nBleu et violet dans les airs !',
      "Les grenouilles font coâ, coâ,\nElles sautent, une, deux, trois.\n{nom} saute avec elles,\nSous la pluie, la vie est belle !",
    ],
  },
  dodo: {
    titres: ['Bonne nuit {nom}', 'Le dodo de {nom}', '{nom} et la lune'],
    strophes: [
      "La lune se lève tout doucement,\n{nom} bâille en s'étirant.\nLe ciel se couvre d'étoiles,\nComme un grand bateau à voiles.",
      'Un bisou sur le bout du nez,\nLe doudou est bien serré.\nLes yeux se ferment, chut, chut, chut,\nLe hibou joue de la flûte.',
      'Une étoile filante passe,\nElle laisse une jolie trace.\n{nom} fait un vœu tout bas :\n« Que demain on rejoue comme ça ! »',
      'Les moutons sautent la barrière,\nUn, deux, trois, en file entière.\n{nom} compte, compte encore,\nEt tout doucement, {il} s\'endort.',
    ],
  },
};

const REFRAIN =
  'Tape, tape, petit {nom},\nTape des mains, fais comme moi !\nUn, deux, trois, tourne en rond,\nCette comptine est pour toi !';

function remplir(txt, fiche) {
  const il = fiche.pronom === 'elle' ? 'elle' : 'il';
  return txt
    .replaceAll('{nom}', fiche.nom)
    .replaceAll('{Il}', il[0].toUpperCase() + il.slice(1))
    .replaceAll('{il}', il);
}

const melanger = (arr) => arr.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);

export function genererComptine(theme, fiche) {
  const t = THEMES[theme] || THEMES.jardin;
  const titre = t.titres[Math.floor(Math.random() * t.titres.length)];
  const [a, b, c] = melanger(t.strophes);
  // Structure classique de comptine : couplet, refrain, couplet, couplet, refrain
  const strophes = theme === 'dodo' ? [a, b, c] : [a, REFRAIN, b, c, REFRAIN];
  return { titre: remplir(titre, fiche), texte: strophes.map((s) => remplir(s, fiche)).join('\n\n') };
}

export const decouperScenes = (texte) =>
  texte.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
