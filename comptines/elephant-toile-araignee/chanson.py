"""Fabrique la bande son de « Un éléphant qui se balançait » (comptine traditionnelle, ~25 s).

1. Une voix de femme française (Piper, voix « siwis », libre et gratuite) dit chaque syllabe.
2. Le vocodeur WORLD étire chaque voyelle sur la durée de sa note et la place à la bonne hauteur
   -> la voix CHANTE la mélodie, avec un balancement en 6/8.
3. L'accompagnement (boîte à musique, nappe, basse, carillons, BOUM !) est synthétisé ici.
Sortie : chanson.wav + timing.json (pour les sous-titres karaoké et l'animation).

Usage : python chanson.py <dossier_de_sortie> <modele_piper.onnx>
"""
import json
import sys

import numpy as np
import pyworld as pw
import soundfile as sf
from scipy.signal import butter, fftconvolve, lfilter, resample_poly
from piper import PiperVoice
from piper.config import SynthesisConfig

OUT, MODELE = sys.argv[1], sys.argv[2]
SR = 44100
BEAT = 0.28             # durée d'une croche (mesure à 6/8 = 6 croches : ça se balance !)
TRANSPOSE = -2          # Si bémol majeur : confortable pour une voix de femme douce
INTRO_BEATS = 6         # une mesure d'introduction
OUTRO_BEATS = 9

# Paroles : phonèmes (IPA, avec les « e » chantés), notes MIDI, durées (en croches), mots + nb de syllabes
PAROLES = [
    dict(ipa="œ̃n elefˈɑ̃ ki sə balɑ̃sˈɛ", notes=[67, 67, 64, 67, 67, 64, 67, 69, 67], durs=[2, 1, 2, 1, 2, 1, 2, 1, 6],
         mots=[("Un", 1), ("éléphant", 3), ("qui", 1), ("se", 1), ("balançait", 3)], accords=[("C", 6), ("C", 6), ("G7", 6)]),
    dict(ipa="syʁ ynə twˈalə twˈalə", notes=[65, 65, 64, 65, 62, 65, 62], durs=[2, 1, 2, 1, 2, 1, 3],
         mots=[("Sur", 1), ("une", 2), ("toile", 2), ("toile", 2)], accords=[("G7", 6), ("G7", 6)]),
    dict(ipa="twˈalə daʁɛnjˈe", notes=[65, 64, 62, 64, 60], durs=[2, 1, 2, 1, 6],
         mots=[("Toile", 2), ("d'araignée.", 3)], accords=[("G7", 6), ("C", 6)]),
    dict(ipa="setˈɛt œ̃ ʒˈø tɛləmˈɑ̃ tɛləmˈɑ̃ amyzˈɑ̃", notes=[64, 65, 67, 72, 71, 69, 71, 69, 67, 65, 67, 69, 67],
         durs=[1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 2, 4],
         mots=[("C'était", 2), ("un", 1), ("jeu", 1), ("tellement", 3), ("tellement", 3), ("amusant", 3)],
         accords=[("C", 6), ("F", 6), ("G7", 6)]),
    dict(ipa="kə tut a kˈu bˈa dˈa bˈum!", notes=[67, 69, 71, 72, 67, 64, 55], durs=[1, 1, 1, 3, 2, 1, 3],
         mots=[("Que", 1), ("tout", 1), ("à", 1), ("coup :", 1), ("BA", 1), ("DA", 1), ("BOUM !", 1)],
         accords=[("G7", 3), ("C", 3), ("C", 6)]),
]
ACCORDS = {"C": [0, 4, 7], "Am": [9, 0, 4], "F": [5, 9, 0], "G": [7, 11, 2], "G7": [7, 11, 2, 5], "Dm": [2, 5, 9]}
RACINE = {"C": 48, "Am": 45, "F": 41, "G": 43, "G7": 43, "Dm": 50}
VOYELLES = set("aeiouyøœɛɔəɑɒɐ")

hz = lambda m: 440.0 * 2 ** ((m + TRANSPOSE - 69) / 12)


# ---------------------------------------------------------------- VOIX
def dire(voix, ipa):
    """Fait dire les phonèmes par Piper ; renvoie audio + (phonème, début, fin) en secondes."""
    phonemes = list(ipa)
    ids = voix.phonemes_to_ids(phonemes)
    audio, samples = voix.phoneme_ids_to_audio(ids, SynthesisConfig(noise_scale=0.5, noise_w_scale=0.6), include_alignments=True)
    pid = voix.config.phoneme_id_map
    pad = pid.get("_", [])
    seg, i, t = [], 0, 0
    for ph in ["^"] + phonemes + ["$"]:
        n = len(pid.get(ph, [])) + (len(pad) if ph != "$" else 0)
        dur = int(np.sum(samples[i:i + n]))
        seg.append((ph, t, t + dur))
        i += n
        t += dur
    sr = voix.config.sample_rate
    return audio.astype(np.float64), [(p, a / sr, b / sr) for p, a, b in seg], sr


def syllabes(seg):
    """Regroupe les voyelles (+ tilde nasal) : une voyelle = une note."""
    out = []
    for p, a, b in seg:
        if p in VOYELLES:
            out.append([a, b])
        elif p == "̃" and out:
            out[-1][1] = b
    return out


def chanter(voix, ligne, t_debut):
    audio, seg, sr = dire(voix, ligne["ipa"])
    syl = syllabes(seg)
    assert len(syl) == len(ligne["notes"]), (ligne["ipa"], len(syl), len(ligne["notes"]))

    fp = 5.0  # ms par trame WORLD
    f0, t = pw.harvest(audio, sr, frame_period=fp, f0_floor=120, f0_ceil=600)
    sp = pw.cheaptrick(audio, f0, t, sr)
    ap = pw.d4c(audio, f0, t, sr)

    # Points d'ancrage (temps source -> temps cible) : la voyelle tombe sur le temps de la note.
    onsets = np.concatenate([[0], np.cumsum(ligne["durs"])]) * BEAT
    src, tgt = [], []
    for k, (a, b) in enumerate(syl):
        n0, n1 = onsets[k], onsets[k + 1]
        suivant = syl[k + 1][0] if k + 1 < len(syl) else b + 0.12
        cons = min(suivant - b, 0.12)  # consonnes qui suivent : durée naturelle, plafonnée
        cons_avant = min(a - (syl[k - 1][1] if k else max(a - 0.12, 0)), 0.12)
        if k == 0:
            src += [max(a - cons_avant, 0)]
            tgt += [n0 - cons_avant]
        src += [a, b]
        tgt += [n0, n1 - (cons if k + 1 < len(syl) else 0.06)]
    src.append(src[-1] + 0.12)
    tgt.append(tgt[-1] + 0.12)
    src, tgt = np.array(src), np.array(tgt)
    tgt = np.maximum.accumulate(tgt + 1e-4 * np.arange(len(tgt)))

    tt = np.arange(tgt[0], tgt[-1], fp / 1000)
    st = np.interp(tt, tgt, src)
    idx = np.clip(np.round(st / (fp / 1000)).astype(int), 0, len(f0) - 1)
    sp2, ap2, voise = sp[idx], ap[idx], f0[idx] > 0

    # Courbe de hauteur : notes + glissé doux + vibrato qui arrive progressivement
    note_idx = np.clip(np.searchsorted(onsets, tt, side="right") - 1, 0, len(ligne["notes"]) - 1)
    midi = np.array([ligne["notes"][k] for k in note_idx], dtype=float)
    lisse = int(0.045 / (fp / 1000))
    midi = np.convolve(np.pad(midi, lisse, mode="edge"), np.ones(lisse) / lisse, mode="same")[lisse:-lisse]
    depuis = tt - onsets[note_idx]
    vib = 0.28 * np.clip((depuis - 0.18) / 0.25, 0, 1) * np.sin(2 * np.pi * 5.4 * tt)
    f02 = 440.0 * 2 ** ((midi + vib + TRANSPOSE - 69) / 12)
    dans_voyelle = np.zeros_like(tt, dtype=bool)
    for k in range(len(syl)):
        dans_voyelle |= (tt >= onsets[k]) & (tt < onsets[k + 1] - 0.05)
    f02 = np.where(voise | dans_voyelle, f02, 0.0)

    y = pw.synthesize(np.ascontiguousarray(f02), np.ascontiguousarray(sp2), np.ascontiguousarray(ap2), sr, fp)
    y = resample_poly(y, SR, sr)
    # Fondu à la fin de la phrase
    fin = int(0.08 * SR)
    y[-fin:] *= np.linspace(1, 0, fin)
    return y, t_debut + tgt[0], [t_debut + o for o in onsets[:-1]]


# ---------------------------------------------------------------- INSTRUMENTS
def env(n, att, dec):
    t = np.arange(n) / SR
    return np.minimum(t / att, 1) * np.exp(-t * dec)


def cloche(f, dur, vol):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 6) \
        + 0.15 * np.sin(2 * np.pi * 3.01 * f * t) * np.exp(-t * 9)
    return vol * s * env(n, 0.003, 3.2)


def nappe(freqs, dur, vol):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = sum(np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 1.003 * t + 1) for f in freqs)
    a = np.minimum(t / 0.35, 1) * np.minimum((dur - t) / 0.3, 1).clip(0, 1)
    return vol * s * a / len(freqs)


def basse(f, dur, vol):
    n = int(dur * SR)
    t = np.arange(n) / SR
    return vol * (np.sin(2 * np.pi * f * t) + 0.2 * np.sin(4 * np.pi * f * t)) * env(n, 0.01, 2.5)


def shaker(vol):
    n = int(0.06 * SR)
    b, a = butter(2, 6000 / (SR / 2), "high")
    return vol * lfilter(b, a, np.random.randn(n)) * env(n, 0.002, 60)


def ajouter(piste, son, t):
    i = int(t * SR)
    j = min(len(piste), i + len(son))
    piste[i:j] += son[: j - i]


def reverb(x, duree=1.8, mix=0.25):
    n = int(duree * SR)
    ir = np.random.randn(n) * np.exp(-np.arange(n) / SR * 3.2)
    b, a = butter(1, 5000 / (SR / 2))
    ir = lfilter(b, a, ir)
    w = fftconvolve(x, ir)[: len(x)]
    return x + mix * w / (np.max(np.abs(w)) + 1e-9) * np.max(np.abs(x))


def boum():
    """Gros BOUM rigolo : grosse caisse grave + nuage de bruit + petit « boing »."""
    n = int(1.2 * SR)
    t = np.arange(n) / SR
    f = 110 * np.exp(-t * 8) + 38
    grosse = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 4.5)
    b, a = butter(2, 900 / (SR / 2))
    bruit = lfilter(b, a, np.random.randn(n)) * np.exp(-t * 9) * 0.5
    boing_f = 180 + 120 * np.sin(2 * np.pi * 7 * t) * np.exp(-t * 3)
    boing = 0.25 * np.sin(2 * np.pi * np.cumsum(boing_f) / SR) * np.exp(-t * 3) * (t > 0.15)
    return 0.9 * (grosse + bruit + boing)


def main():
    np.random.seed(7)
    longueurs = [sum(l["durs"]) for l in PAROLES]
    debuts = INTRO_BEATS + np.concatenate([[0], np.cumsum(longueurs)[:-1]])
    total_beats = INTRO_BEATS + sum(longueurs) + OUTRO_BEATS
    duree = total_beats * BEAT + 1.0
    N = int(duree * SR)
    voix_piste, musique = np.zeros(N), np.zeros(N)

    voix = PiperVoice.load(MODELE, include_alignments=True)
    timing = []
    for i, ligne in enumerate(PAROLES):
        t0 = debuts[i] * BEAT
        y, debut, notes_t = chanter(voix, ligne, t0)
        ajouter(voix_piste, y, max(debut, 0))
        mots, k = [], 0
        for mot, nsyl in ligne["mots"]:
            mots.append({"mot": mot, "t": round(notes_t[k], 3)})
            k += nsyl
        timing.append({"debut": round(t0 - 0.3, 3), "fin": round(t0 + longueurs[i] * BEAT - 0.1, 3), "mots": mots})
    t_boum = timing[-1]["mots"][-1]["t"]

    # Accompagnement en 6/8 : basse sur les temps 1 et 4, boîte à musique en croches
    grille = [("C", INTRO_BEATS)] + [c for l in PAROLES for c in l["accords"]]
    t = 0.0
    for nom, nb in grille:
        notes = ACCORDS[nom]
        ajouter(musique, nappe([hz(60 + n) for n in notes[:3]], nb * BEAT + 0.3, 0.05), t)
        for b in range(nb):
            if b % 3 == 0:
                ajouter(musique, basse(hz(RACINE[nom]), BEAT * 2.8, 0.17), t + b * BEAT)
            n = notes[b % len(notes)] + 72 + (12 if b % 6 == 5 else 0)
            ajouter(musique, cloche(hz(n), 1.2, 0.05), t + b * BEAT)
            ajouter(musique, shaker(0.06 if b % 3 == 0 else 0.03), t + b * BEAT)
        t += nb * BEAT
    # Après le BOUM : petite fin joyeuse (accord de Do + glissando de carillons)
    ajouter(musique, boum(), t_boum)
    t_fin = (total_beats - OUTRO_BEATS + 3) * BEAT
    ajouter(musique, nappe([hz(60 + n) for n in ACCORDS["C"]], OUTRO_BEATS * BEAT, 0.06), t_fin)
    for k, n in enumerate([72, 76, 79, 84, 88, 91, 96]):
        ajouter(musique, cloche(hz(n), 1.6, 0.045), t_fin + k * 0.07)
    # Mélodie doublée tout doucement au célesta (aide l'oreille), sauf le BOUM
    for i, ligne in enumerate(PAROLES):
        on = debuts[i] * BEAT
        for k, (n, d) in enumerate(zip(ligne["notes"], ligne["durs"])):
            if not (i == len(PAROLES) - 1 and k == len(ligne["notes"]) - 1):
                ajouter(musique, cloche(hz(n + 12), d * BEAT + 0.6, 0.035), on)
            on += d * BEAT
    # Glissando féerique d'ouverture
    for k, n in enumerate([72, 76, 79, 84, 88, 91, 96, 100]):
        ajouter(musique, cloche(hz(n), 1.5, 0.04), k * 0.06)

    voix_piste = reverb(voix_piste / (np.max(np.abs(voix_piste)) + 1e-9), mix=0.22) * 0.75
    musique = reverb(musique, duree=2.0, mix=0.3)
    musique = musique / (np.max(np.abs(musique)) + 1e-9) * 0.5
    mix = voix_piste + musique
    fin = int(1.2 * SR)
    mix[-fin:] *= np.linspace(1, 0, fin)
    mix = mix / np.max(np.abs(mix)) * 0.9
    sf.write(f"{OUT}/chanson.wav", np.stack([mix, mix], 1).astype(np.float32), SR)
    sf.write(f"{OUT}/voix_seule.wav", voix_piste.astype(np.float32), SR)
    json.dump({"duree": round(duree, 3), "croche": BEAT, "intro": INTRO_BEATS * BEAT, "boum": t_boum,
               "lignes": timing}, open(f"{OUT}/timing.json", "w"), ensure_ascii=False, indent=1)
    print("durée", round(duree, 2), "s — boum à", t_boum)


main()
