"""Logo final bleach drop : version lettres blanches (gouttes bleues gardées).

Usage : python3 versions.py bleachdrop-final-source.webp <dossier de sortie>
"""
import sys
from collections import deque
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

SOURCE = Path(sys.argv[1])
SORTIE = Path(sys.argv[2])
SORTIE.mkdir(parents=True, exist_ok=True)

img = np.asarray(Image.open(SOURCE).convert('RGBA')).astype(np.float64)
rgb, alpha = img[..., :3].copy(), img[..., 3]


def dilater(masque, taille):
    return np.asarray(Image.fromarray((masque * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(taille))) > 0


# 1. Opacité : l'intérieur du logo est à 253 au lieu de 255, et le détourage a laissé
#    un voile très léger partout autour. On garde le logo plus une marge de 4 px.
zone = dilater(alpha >= 128, 9)
a = np.clip(alpha / 250.0, 0, 1) * zone

# 2. Trous du détourage : un petit trou enfermé, bordé surtout de goutte, est un manque
#    sous une goutte posée sur une lettre (cas de la goutte sur le « a »). En lettres
#    blanches il ferait une tache noire : on le bouche avec la lettre. Les vrais creux
#    des lettres (œil du « e », intérieur du « a »…) sont bordés de lettre : on n'y touche pas.
vide = a < 0.5
H, W = vide.shape
dehors = np.zeros_like(vide)
file = deque((y, x) for y in range(H) for x in (0, W - 1) if vide[y, x])
file.extend((y, x) for x in range(W) for y in (0, H - 1) if vide[y, x])
for y, x in file:
    dehors[y, x] = True
while file:
    y, x = file.popleft()
    for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
        if 0 <= ny < H and 0 <= nx < W and vide[ny, nx] and not dehors[ny, nx]:
            dehors[ny, nx] = True
            file.append((ny, nx))
enferme = vide & ~dehors
lettre = (rgb.max(axis=-1) < 40) & (a > 0.9)
vu = np.zeros_like(enferme)
for y0, x0 in zip(*np.nonzero(enferme)):
    if vu[y0, x0]:
        continue
    trou = np.zeros_like(enferme)
    file = deque([(y0, x0)])
    vu[y0, x0] = trou[y0, x0] = True
    while file:
        y, x = file.popleft()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < H and 0 <= nx < W and enferme[ny, nx] and not vu[ny, nx]:
                vu[ny, nx] = trou[ny, nx] = True
                file.append((ny, nx))
    anneau = dilater(trou, 5) & ~trou
    if trou.sum() < 600 and lettre[anneau].mean() < 0.5:
        bouche = dilater(trou, 5)
        rgb[bouche] *= a[bouche, None]   # la goutte translucide posée sur la lettre noire
        a[bouche] = 1.0
        print('trou bouché', trou.sum(), 'px')

# 3. Part de lettre noire dans chaque pixel. Les gouttes sont posées sur du noir :
#    un pixel = (1 - k) × couleur de la goutte. On compare sa luminosité à celle
#    des gouttes voisines.
V = rgb.max(axis=-1)
Vloc = np.asarray(Image.fromarray(np.clip(V, 0, 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(7))).astype(np.float64)
# Plancher à 230 : une poussière bleu très foncé isolée dans une lettre passe en blanc.
k_brut = np.clip(1.0 - V / np.maximum(Vloc, 230), 0, 1)
# Mélange linéaire près des lettres (jonction propre, sans liseré gris) ; ailleurs,
# un pixel plus sombre est un contour bleu foncé de la goutte : on n'y touche pas.
k = np.where(dilater(V < 40, 7), k_brut, 0.0)

# Le pixel contient déjà (1 - k) × goutte : on ajoute seulement la part de blanc.
couleur = np.clip(rgb + 255.0 * k[..., None], 0, 255)

ys, xs = np.nonzero(a > 0.02)
marge = 24
x0, x1 = max(xs.min() - marge, 0), min(xs.max() + marge + 1, W)
y0, y1 = max(ys.min() - marge, 0), min(ys.max() + marge + 1, H)


def enregistrer(c, nom):
    rgba = np.dstack([c, a * 255]).round().astype(np.uint8)
    rgba[a == 0, :3] = 0
    Image.fromarray(rgba[y0:y1, x0:x1], 'RGBA').save(SORTIE / f'bleachdrop-{nom}-transparent.png', optimize=True)


enregistrer(couleur, 'lettres-blanches')
noir = (couleur * a[..., None]).round().astype(np.uint8)
Image.fromarray(noir, 'RGB').save(SORTIE / 'bleachdrop-lettres-blanches-fond-noir.png', optimize=True)
# Le logo d'origine, nettoyé du voile et du trou, pour avoir la paire.
enregistrer(rgb, 'original')
print('cadre', x0, x1, y0, y1)
