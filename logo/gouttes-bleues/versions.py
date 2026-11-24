"""Versions du nouveau logo bleach drop : négatif, lettres blanches, gouttes violettes.

Usage : python3 versions.py bleachdrop-source.webp <dossier de sortie> [décalage de teinte en degrés] [facteur de saturation]
Exemple pour un violet plus soutenu : python3 versions.py bleachdrop-source.webp sortie 83 1.3
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

SOURCE = Path(sys.argv[1])
SORTIE = Path(sys.argv[2])
SORTIE.mkdir(parents=True, exist_ok=True)
DECALAGE_VIOLET = float(sys.argv[3]) if len(sys.argv) > 3 else 83.0   # degrés de teinte
SATURATION_VIOLET = float(sys.argv[4]) if len(sys.argv) > 4 else 1.0

img = np.asarray(Image.open(SOURCE).convert('RGBA')).astype(np.float64)
rgb, alpha = img[..., :3], img[..., 3]

# 1. Opacité : l'intérieur du logo est à 253 au lieu de 255, et le détourage a laissé
#    un voile très léger partout autour. On garde le logo plus une marge de 4 px.
forme = Image.fromarray(((alpha >= 128) * 255).astype(np.uint8))
zone = np.asarray(forme.filter(ImageFilter.MaxFilter(9))) > 0
a = np.clip(alpha / 250.0, 0, 1) * zone

# 2. Part de lettre noire dans chaque pixel. Les gouttes sont posées sur du noir :
#    un pixel = (1 - k) × couleur de la goutte. On compare sa luminosité à celle
#    des gouttes voisines ; la zone morte garde les contours bleu foncé des gouttes.
V = rgb.max(axis=-1)
Vimg = Image.fromarray(np.clip(V, 0, 255).astype(np.uint8))
Vloc = np.asarray(Vimg.filter(ImageFilter.MaxFilter(7))).astype(np.float64)
# Plancher à 230 : une poussière bleu très foncé isolée dans une lettre passe en blanc.
k_brut = np.clip(1.0 - V / np.maximum(Vloc, 230), 0, 1)
# Mélange linéaire près des lettres (jonction propre, sans liseré gris) ; ailleurs,
# un pixel plus sombre est un contour bleu foncé de la goutte : on n'y touche pas.
pres_lettre = np.asarray(Image.fromarray(((V < 40) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(7))) > 0
k = np.where(pres_lettre, k_brut, 0.0)


def tourner_teinte(c, degres, sat=1.0):
    """Tourne la teinte en HSV ; garde la luminosité, donc les ombres et contours."""
    x = np.clip(c, 0, 255).astype(np.uint8)
    hsv = np.asarray(Image.fromarray(x).convert('HSV')).astype(np.float64)
    hsv[..., 0] = (hsv[..., 0] + degres / 360 * 256) % 256
    hsv[..., 1] = np.clip(hsv[..., 1] * sat, 0, 255)
    return np.asarray(Image.fromarray(hsv.astype(np.uint8), 'HSV').convert('RGB')).astype(np.float64)


blanc = np.full_like(rgb, 255.0)
versions = {
    # Vrai négatif : chaque couleur inversée (lettres blanches, gouttes rouille).
    'negatif': 255 - rgb,
    # Le pixel contient déjà (1 - k) × goutte : on ajoute seulement la part de blanc.
    'lettres-blanches': rgb + blanc * k[..., None],
    'lettres-blanches-gouttes-violettes': tourner_teinte(rgb, DECALAGE_VIOLET, SATURATION_VIOLET) + blanc * k[..., None],
}
# Pour le négatif, les lettres sont noires à l'origine : 255 - 0 = blanc, rien à séparer.

ys, xs = np.nonzero(a > 0.02)
marge = 24
x0, x1 = max(xs.min() - marge, 0), min(xs.max() + marge + 1, a.shape[1])
y0, y1 = max(ys.min() - marge, 0), min(ys.max() + marge + 1, a.shape[0])

for nom, couleur in versions.items():
    couleur = np.clip(couleur, 0, 255)
    rgba = np.dstack([couleur, a * 255]).round().astype(np.uint8)
    rgba[a == 0, :3] = 0
    Image.fromarray(rgba[y0:y1, x0:x1], 'RGBA').save(SORTIE / f'bleachdrop-{nom}-transparent.png', optimize=True)
    noir = (couleur * a[..., None]).round().astype(np.uint8)
    Image.fromarray(noir, 'RGB').save(SORTIE / f'bleachdrop-{nom}-fond-noir.png', optimize=True)

# Le logo d'origine, nettoyé du voile, pour avoir la série complète.
rgba = np.dstack([rgb, a * 255]).round().astype(np.uint8)
rgba[a == 0, :3] = 0
Image.fromarray(rgba[y0:y1, x0:x1], 'RGBA').save(SORTIE / 'bleachdrop-original-transparent.png', optimize=True)
Image.fromarray((rgb * a[..., None] + 255 * (1 - a[..., None])).round().astype(np.uint8)).save(SORTIE / 'bleachdrop-original-fond-blanc.png', optimize=True)
print('cadre', x0, x1, y0, y1)
