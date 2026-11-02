"""Fabrique la bande son de « Poppy dans la forêt enchantée » (~29 s).

1. Une voix de femme française (Piper, voix « siwis », libre et gratuite) dit chaque syllabe.
2. Le vocodeur WORLD étire chaque voyelle sur la durée de sa note et la place à la bonne hauteur
   -> la voix CHANTE la mélodie.
3. L'accompagnement (boîte à musique, nappe, basse, carillons) est synthétisé ici.
Sortie : chanson.wav + timing.json (pour les sous-titres karaoké).

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
TEMPO = 116
BEAT = 60 / TEMPO
TRANSPOSE = -2          # Si bémol majeur : confortable pour une voix de femme douce
INTRO_BEATS = 4

# --- Paroles : phonèmes (IPA), notes MIDI, durées (en temps), mots + nb de syllabes (sous-titres)
PAROLES = [
    dict(ipa="pˈopi, pətˈi ʃˈa tu blˈɑ̃,", notes=[67, 67, 64, 67, 69, 67, 64], durs=[1, 1, 1, 1, 1, 1, 2],
         mots=[("Poppy,", 2), ("petit", 2), ("chat", 1), ("tout", 1), ("blanc,", 1)], accords=[("C", 4), ("Am", 4)]),
    dict(ipa="sə pʁomˈɛn ɑ̃ ʃɑ̃tɔnˈɑ̃.", notes=[65, 65, 64, 62, 64, 65, 67], durs=[1, 1, 1, 1, 1, 1, 2],
         mots=[("Se", 1), ("promène", 2), ("en", 1), ("chantonnant.", 3)], accords=[("F", 4), ("G", 4)]),
    dict(ipa="le ʃɑ̃pinjˈɔ̃ sˈɔ̃ tu bʁijˈɑ̃,", notes=[67, 67, 69, 69, 72, 72, 69, 67], durs=[1] * 8,
         mots=[("Les", 1), ("champignons", 3), ("sont", 1), ("tout", 1), ("brillants,", 2)], accords=[("C", 4), ("F", 4)]),
    dict(ipa="le papijˈɔ̃ dˈɑ̃s o vˈɑ̃.", notes=[65, 65, 64, 64, 62, 62, 60], durs=[1, 1, 1, 1, 1, 1, 2],
         mots=[("Les", 1), ("papillons", 3), ("dansent", 1), ("au", 1), ("vent.", 1)], accords=[("G7", 4), ("C", 4)]),
    dict(ipa="la la la, foʁˈɛ ɑ̃ʃɑ̃tˈe,", notes=[72, 72, 72, 69, 69, 67, 65, 67], durs=[0.5, 0.5, 1, 1, 1, 1, 1, 2],
         mots=[("La", 1), ("la", 1), ("la,", 1), ("forêt", 2), ("enchantée,", 3)], accords=[("F", 4), ("G7", 4)]),
    dict(ipa="vjˈɛ̃ avˈɛk pˈopi tə pʁoməne!", notes=[67, 67, 69, 67, 64, 65, 64, 62, 60],
         durs=[0.5, 0.5, 1, 1, 0.5, 0.5, 1, 1, 2],
         mots=[("Viens", 1), ("avec", 2), ("Poppy", 2), ("te", 1), ("promener !", 3)], accords=[("C", 4), ("G7", 2), ("C", 2)]),
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


def main():
    np.random.seed(7)
    total_beats = INTRO_BEATS + 8 * len(PAROLES) + 4
    duree = total_beats * BEAT + 1.0
    N = int(duree * SR)
    voix_piste, musique = np.zeros(N), np.zeros(N)

    # ---- Voix chantée
    voix = PiperVoice.load(MODELE, include_alignments=True)
    timing = []
    for i, ligne in enumerate(PAROLES):
        t0 = (INTRO_BEATS + 8 * i) * BEAT
        y, debut, notes_t = chanter(voix, ligne, t0)
        ajouter(voix_piste, y, max(debut, 0))
        # Sous-titres : heure de début de chaque mot (= sa première syllabe)
        mots, k = [], 0
        for mot, nsyl in ligne["mots"]:
            mots.append({"mot": mot, "t": round(notes_t[k], 3)})
            k += nsyl
        timing.append({"debut": round(t0 - 0.3, 3), "fin": round(t0 + 8 * BEAT - 0.15, 3), "mots": mots})

    # ---- Accompagnement
    grille = [("C", 4)] + [c for l in PAROLES for c in l["accords"]] + [("C", 4)]
    t = 0.0
    for nom, nb in grille:
        notes = ACCORDS[nom]
        ajouter(musique, nappe([hz(60 + n) for n in notes[:3]], nb * BEAT + 0.3, 0.05), t)
        for b in range(nb):
            ajouter(musique, basse(hz(RACINE[nom]), BEAT * 1.8, 0.16), t + b * BEAT) if b % 2 == 0 else None
            for demi in range(2):  # boîte à musique en croches
                n = notes[(b * 2 + demi) % len(notes)] + 72 + (12 if (b * 2 + demi) % 4 == 3 else 0)
                ajouter(musique, cloche(hz(n), 1.2, 0.05), t + (b + demi / 2) * BEAT)
            ajouter(musique, shaker(0.05), t + (b + 0.5) * BEAT)
        t += nb * BEAT
    # Mélodie doublée tout doucement au célesta (aide l'oreille)
    for i, ligne in enumerate(PAROLES):
        on = (INTRO_BEATS + 8 * i) * BEAT
        for n, d in zip(ligne["notes"], ligne["durs"]):
            ajouter(musique, cloche(hz(n + 12), d * BEAT + 0.6, 0.035), on)
            on += d * BEAT
    # Glissandos féeriques (intro et fin)
    for t0 in (0.0, (total_beats - 4) * BEAT):
        for k, n in enumerate([72, 76, 79, 84, 88, 91, 96, 100]):
            ajouter(musique, cloche(hz(n), 1.5, 0.04), t0 + k * 0.06)

    voix_piste = reverb(voix_piste / (np.max(np.abs(voix_piste)) + 1e-9), mix=0.22) * 0.75
    musique = reverb(musique, duree=2.2, mix=0.35)
    musique = musique / (np.max(np.abs(musique)) + 1e-9) * 0.45
    mix = voix_piste + musique
    fin = int(1.5 * SR)
    mix[-fin:] *= np.linspace(1, 0, fin)
    mix = mix / np.max(np.abs(mix)) * 0.9
    sf.write(f"{OUT}/chanson.wav", np.stack([mix, mix], 1).astype(np.float32), SR)
    sf.write(f"{OUT}/voix_seule.wav", voix_piste.astype(np.float32), SR)
    json.dump({"duree": round(duree, 3), "tempo": TEMPO, "intro": INTRO_BEATS * BEAT, "lignes": timing},
              open(f"{OUT}/timing.json", "w"), ensure_ascii=False, indent=1)
    print("durée", round(duree, 2), "s")


main()
