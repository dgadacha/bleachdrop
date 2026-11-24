"""Logo original (lettres noires) avec un contour blanc, pour les fonds noirs.

Usage : python3 contour.py <logo transparent> <sortie.png> <largeur> <épaisseur du contour en px> [silhouette|lettres]
  silhouette : le contour fait le tour de tout le logo (lettres et gouttes), façon autocollant ;
  lettres    : le contour ne suit que les lettres noires, les gouttes restent libres.
L'épaisseur est en pixels de l'image de sortie : la garder lisible à la taille d'affichage.
"""
import sys
import numpy as np
from PIL import Image

SOURCE, SORTIE = sys.argv[1], sys.argv[2]
LARGEUR, EP = int(sys.argv[3]), float(sys.argv[4])
MODE = sys.argv[5] if len(sys.argv) > 5 else 'silhouette'

src = Image.open(SOURCE).convert('RGBA')
# Lettres repérées en pleine taille : pixels noirs et opaques.
s = np.asarray(src).astype(np.float64)
lettres = ((s[..., :3].max(axis=-1) < 40) & (s[..., 3] > 128)).astype(np.float64)

# Réduction en alpha prémultiplié (pas de liseré sombre), puis marge pour le contour.
h = round(src.height * LARGEUR / src.width)
petit = np.asarray(src.convert('RGBa').resize((LARGEUR, h), Image.LANCZOS)).astype(np.float64) / 255
masque_l = np.asarray(Image.fromarray((lettres * 255).astype(np.uint8)).resize((LARGEUR, h), Image.LANCZOS)).astype(np.float64) / 255
# Marge ajoutée seulement si celle du logo (24 px en pleine taille) ne suffit pas au contour.
ys, xs = np.nonzero(petit[..., 3] > 0.02)
marge_dispo = min(ys.min(), xs.min(), h - 1 - ys.max(), LARGEUR - 1 - xs.max())
m = max(0, int(np.ceil(EP)) + 1 - marge_dispo)
petit = np.pad(petit, ((m, m), (m, m), (0, 0)))
masque_l = np.pad(masque_l, m)
a = petit[..., 3]
base = a if MODE == 'silhouette' else masque_l

# Dilatation par un disque à bord doux (contour arrondi et lissé).
contour = np.zeros_like(base)
r = int(np.ceil(EP))
H, W = base.shape
for dy in range(-r, r + 1):
    for dx in range(-r, r + 1):
        poids = np.clip(EP + 0.5 - np.hypot(dx, dy), 0, 1)
        if poids <= 0:
            continue
        decale = np.zeros_like(base)
        decale[max(dy, 0):H + min(dy, 0), max(dx, 0):W + min(dx, 0)] = base[max(-dy, 0):H - max(dy, 0), max(-dx, 0):W - max(dx, 0)]
        np.maximum(contour, decale * poids, out=contour)

# Le logo posé sur le contour blanc (couleurs prémultipliées).
rgb_p = petit[..., :3] + contour[..., None] * (1 - a[..., None])
a_out = a + contour * (1 - a)
rgb = np.where(a_out[..., None] > 0, rgb_p / np.maximum(a_out[..., None], 1e-6), 0)
out = np.dstack([rgb, a_out]) * 255
Image.fromarray(out.round().clip(0, 255).astype(np.uint8), 'RGBA').save(SORTIE)
print(SORTIE, out.shape[1], 'x', out.shape[0])
