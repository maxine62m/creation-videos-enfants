# Architecture

## Principe

Une **application web** (HTML + JavaScript) qui tourne dans **Safari sur l'iPad**.
Pas d'installation, pas de serveur, pas d'abonnement : le code est hébergé gratuitement sur GitHub Pages
et c'est l'iPad qui calcule tout (3D, musique, vidéo).

```
 iPad (Safari)
 ┌─────────────────────────────────────────────────────────────┐
 │ 1. Personnage ──┐                                           │
 │ 2. Comptine ────┼─▶ 4. Scènes animées ─▶ 5. Montage ─▶ 6. MP4│
 │ 3. Voix+Musique ┘    (Three.js)          (canvas+audio)  9:16│
 │                                                          16:9│
 └─────────────────────────────────────────────────────────────┘
        ▲ code                                    │ vidéo
   GitHub (gratuit)                    Partager → YouTube / TikTok
```

## Les fichiers

| Fichier | Étape | Rôle |
|---|---|---|
| `index.html` | — | Les écrans et les boutons |
| `style.css` | — | L'apparence |
| `js/personnage.js` | 1 | Construit le personnage 3D à partir d'une **fiche** (JSON). Même fiche = même personnage. |
| `js/comptines.js` | 2 | Génère des comptines originales en français (textes écrits pour le projet). |
| `js/musique.js` | 3 | Compose une mélodie originale à partir d'un **numéro** (même numéro = même musique). |
| `js/app.js` | 4-5-6 | Décor, caméra, sous-titres, enregistrement vidéo, formats. |

## Choix techniques (tous gratuits)

| Besoin | Outil | Pourquoi |
|---|---|---|
| 3D | **Three.js** (bibliothèque libre) | Fonctionne dans Safari, rapide sur iPad |
| Voix | Micro de l'iPad ou fichier importé | La voix de synthèse de Safari ne peut pas être enregistrée dans une vidéo |
| Musique | **Web Audio** (intégré à Safari) | Musique 100 % originale → aucun problème de droits d'auteur |
| Vidéo | **MediaRecorder** (intégré à Safari) | Produit un MP4 directement sur l'iPad |
| Hébergement | **GitHub Pages** | Gratuit pour un dépôt public |

## Limites du prototype v0.1

- Personnages en formes simples (style « jouet »), pas encore de modèles 3D détaillés.
- Une seule animation (danse/balancement), pas encore de bouche qui parle.
- Vidéo en 720p (suffisant pour Shorts/TikTok/YouTube ; 1080p possible plus tard).
- L'enregistrement se fait en temps réel : une vidéo de 40 s prend 40 s.

## Feuille de route proposée

1. **v0.2** — Bouche animée synchronisée sur la voix, plusieurs personnages par scène.
2. **v0.3** — Bibliothèque de personnages (fiches) et de décors ; sauvegarde de projets.
3. **v0.4** — Modèles 3D plus beaux (fichiers `.glb` gratuits, ex. créés avec une app iPad comme *Nomad Sculpt* — achat unique, **à valider avant toute dépense**).
4. **v0.5** — Voix de synthèse de qualité et musique IA : uniquement via des offres gratuites, **avec ton accord avant tout compte ou paiement**.
5. **v1.0** — Export 1080p, vignettes (miniatures) automatiques, génération de la description YouTube.
