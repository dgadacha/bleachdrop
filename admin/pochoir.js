// Transforme une image en pochoir à découper.
//
// Le pochoir est une feuille : les « trous » sont découpés et laissent passer
// la javel, la « matière » reste. Une zone de matière entourée de trous (le
// centre d'un O) tomberait à la découpe : c'est un îlot. Pour que le pochoir
// reste d'un seul tenant et réutilisable, on relie chaque îlot au reste par
// un pont, au chemin le plus court.
//
// Toutes les fonctions travaillent sur des tableaux d'octets : 1 = trou, 0 = matière.

// Seuil automatique (méthode d'Otsu) : sépare au mieux les clairs des foncés.
// Renvoie la première valeur « claire » : foncé = gris < seuil.
export function seuilAutomatique(gris) {
  const histo = new Float64Array(256);
  for (const v of gris) histo[v] += 1;
  const total = gris.length;
  let somme = 0;
  for (let i = 0; i < 256; i += 1) somme += i * histo[i];
  let sommeFond = 0; let poidsFond = 0; let meilleur = 0; let seuil = 127;
  for (let i = 0; i < 256; i += 1) {
    poidsFond += histo[i];
    if (!poidsFond) continue;
    const poidsForme = total - poidsFond;
    if (!poidsForme) break;
    sommeFond += i * histo[i];
    const ecart = poidsFond * poidsForme * ((sommeFond / poidsFond) - ((somme - sommeFond) / poidsForme)) ** 2;
    if (ecart > meilleur) { meilleur = ecart; seuil = i; }
  }
  return Math.min(255, seuil + 1);
}

// Niveaux de gris ; les pixels transparents comptent comme du blanc.
export function niveauxDeGris(rgba, largeur, hauteur) {
  const gris = new Uint8Array(largeur * hauteur);
  for (let i = 0, p = 0; i < gris.length; i += 1, p += 4) {
    const a = rgba[p + 3] / 255;
    const v = 0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2];
    gris[i] = Math.round(v * a + 255 * (1 - a));
  }
  return gris;
}

// Flou « boîte » de rayon r (moyenne sur un carré), séparable : le coût ne dépend pas de r.
function flouBoite(src, largeur, hauteur, r) {
  const tmp = new Float32Array(src.length);
  const dst = new Float32Array(src.length);
  const cumul = new Float64Array(Math.max(largeur, hauteur) + 1);
  for (let y = 0; y < hauteur; y += 1) {
    const ligne = y * largeur;
    for (let x = 0; x < largeur; x += 1) cumul[x + 1] = cumul[x] + src[ligne + x];
    for (let x = 0; x < largeur; x += 1) {
      const a = Math.max(0, x - r); const b = Math.min(largeur, x + r + 1);
      tmp[ligne + x] = (cumul[b] - cumul[a]) / (b - a);
    }
  }
  for (let x = 0; x < largeur; x += 1) {
    for (let y = 0; y < hauteur; y += 1) cumul[y + 1] = cumul[y] + tmp[y * largeur + x];
    for (let y = 0; y < hauteur; y += 1) {
      const a = Math.max(0, y - r); const b = Math.min(hauteur, y + r + 1);
      dst[y * largeur + x] = (cumul[b] - cumul[a]) / (b - a);
    }
  }
  return dst;
}

// Deux passes de flou boîte : proche d'un flou gaussien.
function flouter(gris, largeur, hauteur, rayon) {
  const r = Math.round(rayon);
  if (r < 1) return gris;
  const flou = flouBoite(flouBoite(gris, largeur, hauteur, r), largeur, hauteur, r);
  return Uint8Array.from(flou, (v) => Math.round(v));
}

// Corrige un éclairage inégal (photo d'un dessin sur papier) : chaque pixel est
// comparé au fond autour de lui, estimé par un grand flou.
function egaliser(gris, largeur, hauteur) {
  const r = Math.max(8, Math.round(Math.max(largeur, hauteur) / 20));
  const fond = flouBoite(flouBoite(gris, largeur, hauteur, r), largeur, hauteur, r);
  const sortie = new Uint8Array(gris.length);
  for (let i = 0; i < gris.length; i += 1) sortie[i] = Math.min(255, Math.round((gris[i] / Math.max(1, fond[i])) * 255));
  return sortie;
}

// Composantes connexes (4 voisins) des pixels qui valent `valeur`.
// Renvoie les étiquettes (0 = autre valeur) et la taille de chaque composante.
export function composantes(masque, largeur, hauteur, valeur) {
  const etiquettes = new Int32Array(masque.length);
  const tailles = [0];
  const file = new Int32Array(masque.length);
  let suivante = 1;
  for (let depart = 0; depart < masque.length; depart += 1) {
    if (masque[depart] !== valeur || etiquettes[depart]) continue;
    let tete = 0; let queue = 0; let taille = 0;
    file[queue++] = depart; etiquettes[depart] = suivante;
    while (tete < queue) {
      const p = file[tete++]; taille += 1;
      const x = p % largeur; const y = (p - x) / largeur;
      if (x > 0 && masque[p - 1] === valeur && !etiquettes[p - 1]) { etiquettes[p - 1] = suivante; file[queue++] = p - 1; }
      if (x < largeur - 1 && masque[p + 1] === valeur && !etiquettes[p + 1]) { etiquettes[p + 1] = suivante; file[queue++] = p + 1; }
      if (y > 0 && masque[p - largeur] === valeur && !etiquettes[p - largeur]) { etiquettes[p - largeur] = suivante; file[queue++] = p - largeur; }
      if (y < hauteur - 1 && masque[p + largeur] === valeur && !etiquettes[p + largeur]) { etiquettes[p + largeur] = suivante; file[queue++] = p + largeur; }
    }
    tailles.push(taille);
    suivante += 1;
  }
  return { etiquettes, tailles };
}

// Rebouche la zone découpée qui contient le point (x, y) : c'est la gomme.
function reboucher(trous, largeur, hauteur, x, y) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= largeur || y >= hauteur || !trous[y * largeur + x]) return;
  const pile = [y * largeur + x];
  trous[pile[0]] = 0;
  while (pile.length) {
    const p = pile.pop();
    const px = p % largeur;
    if (px > 0 && trous[p - 1]) { trous[p - 1] = 0; pile.push(p - 1); }
    if (px < largeur - 1 && trous[p + 1]) { trous[p + 1] = 0; pile.push(p + 1); }
    if (p >= largeur && trous[p - largeur]) { trous[p - largeur] = 0; pile.push(p - largeur); }
    if (p < trous.length - largeur && trous[p + largeur]) { trous[p + largeur] = 0; pile.push(p + largeur); }
  }
}

// Le plus petit rectangle qui contient toutes les zones découpées, ou null.
export function boiteDesTrous(trous, largeur, hauteur) {
  let x0 = largeur; let y0 = hauteur; let x1 = -1; let y1 = -1;
  for (let y = 0; y < hauteur; y += 1) {
    for (let x = 0; x < largeur; x += 1) {
      if (!trous[y * largeur + x]) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1, largeur: x1 - x0 + 1, hauteur: y1 - y0 + 1 };
}

// Trace un pont (segment épais) de matière entre deux points.
function tracerPont(trous, ponts, largeur, hauteur, a, b, epaisseur) {
  const ax = a % largeur; const ay = (a - ax) / largeur;
  const bx = b % largeur; const by = (b - bx) / largeur;
  const r = epaisseur / 2;
  const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - r)); const x1 = Math.min(largeur - 1, Math.ceil(Math.max(ax, bx) + r));
  const y0 = Math.max(0, Math.floor(Math.min(ay, by) - r)); const y1 = Math.min(hauteur - 1, Math.ceil(Math.max(ay, by) + r));
  const dx = bx - ax; const dy = by - ay; const l2 = dx * dx + dy * dy;
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
      const px = ax + t * dx - x; const py = ay + t * dy - y;
      if (px * px + py * py <= r * r) {
        const p = y * largeur + x;
        if (trous[p]) ponts[p] = 1;
        trous[p] = 0;
      }
    }
  }
}

// Première étape : ce qui sera découpé, à la taille de l'image.
//  options.seuil     : 0–255, ou null pour le seuil automatique
//  options.inverser  : false = les zones foncées de l'image deviennent des trous
//  options.egaliser  : corrige un éclairage inégal
//  options.flou      : rayon du lissage, en pixels
//  options.nettoyage : taille (en pixels) sous laquelle une tache est supprimée
//  options.effacer   : points [x, y] de l'image dont la zone découpée est rebouchée
export function masqueDeDecoupe(rgba, largeur, hauteur, options) {
  const o = { seuil: null, inverser: false, egaliser: false, flou: 1, nettoyage: 30, effacer: [], ...options };
  let gris = niveauxDeGris(rgba, largeur, hauteur);
  if (o.egaliser) gris = egaliser(gris, largeur, hauteur);
  if (o.flou > 0) gris = flouter(gris, largeur, hauteur, o.flou);
  const seuil = o.seuil == null ? seuilAutomatique(gris) : o.seuil;
  const trous = new Uint8Array(largeur * hauteur);
  for (let i = 0; i < trous.length; i += 1) {
    const fonce = gris[i] < seuil;
    trous[i] = (o.inverser ? !fonce : fonce) ? 1 : 0;
  }
  for (const [x, y] of o.effacer || []) reboucher(trous, largeur, hauteur, x, y);

  // Nettoyage : les petits trous se rebouchent, les petites taches de matière
  // au milieu des trous disparaissent (on ne touche pas à la matière du bord).
  if (o.nettoyage > 0) {
    const t = composantes(trous, largeur, hauteur, 1);
    for (let p = 0; p < trous.length; p += 1) if (t.etiquettes[p] && t.tailles[t.etiquettes[p]] < o.nettoyage) trous[p] = 0;
    const mat = composantes(trous, largeur, hauteur, 0);
    const auBord = new Set();
    for (let x = 0; x < largeur; x += 1) { auBord.add(mat.etiquettes[x]); auBord.add(mat.etiquettes[(hauteur - 1) * largeur + x]); }
    for (let y = 0; y < hauteur; y += 1) { auBord.add(mat.etiquettes[y * largeur]); auBord.add(mat.etiquettes[y * largeur + largeur - 1]); }
    for (let p = 0; p < trous.length; p += 1) {
      const e = mat.etiquettes[p];
      if (e && !auBord.has(e) && mat.tailles[e] < o.nettoyage) trous[p] = 1;
    }
  }
  return { trous, seuil };
}

// Fabrique le pochoir.
//  Options de masqueDeDecoupe, plus :
//  options.ponts       : ajouter les ponts automatiquement
//  options.largeurPont : épaisseur des ponts, en pixels (2 au moins)
//  options.marge       : bord de matière autour du dessin, en pixels
//  options.recadrer    : la feuille suit le dessin (sinon, toute l'image)
export function construirePochoir(rgba, largeurImage, hauteurImage, options) {
  const o = { ponts: true, largeurPont: 6, marge: 40, recadrer: false, ...options };
  const masque = masqueDeDecoupe(rgba, largeurImage, hauteurImage, o);
  const boite = boiteDesTrous(masque.trous, largeurImage, hauteurImage);
  const cadre = o.recadrer && boite ? boite : { x0: 0, y0: 0, largeur: largeurImage, hauteur: hauteurImage };

  // La feuille : le dessin entouré d'une marge de matière.
  const m = Math.max(1, Math.round(o.marge));
  const largeur = cadre.largeur + 2 * m;
  const hauteur = cadre.hauteur + 2 * m;
  const trous = new Uint8Array(largeur * hauteur);
  for (let y = 0; y < cadre.hauteur; y += 1) {
    const source = (cadre.y0 + y) * largeurImage + cadre.x0;
    trous.set(masque.trous.subarray(source, source + cadre.largeur), (y + m) * largeur + m);
  }

  // Îlots : composantes de matière qui ne touchent pas le bord de la feuille.
  const ponts = new Uint8Array(trous.length);
  const { etiquettes, tailles } = composantes(trous, largeur, hauteur, 0);
  const principal = etiquettes[0]; // le coin est toujours dans la marge
  const ilots = Math.max(0, tailles.length - 2); // sans le 0 et sans le principal
  let pontsAjoutes = 0;
  let limiteAtteinte = false;

  if (o.ponts && ilots > 0) {
    // Union-find : un groupe d'îlots reliés entre eux est « attaché » s'il rejoint le principal.
    const parent = Int32Array.from({ length: tailles.length }, (_, i) => i);
    const racine = (e) => { while (parent[e] !== e) { parent[e] = parent[parent[e]]; e = parent[e]; } return e; };
    const pere = new Int32Array(trous.length);
    const file = new Int32Array(trous.length);
    // Sous 2 px, un pont en diagonale ne tiendrait que par un coin.
    const epaisseur = Math.max(2, o.largeurPont);
    const LIMITE = 400;

    for (let e = 1; e < tailles.length; e += 1) {
      while (racine(e) !== racine(principal)) {
        if (pontsAjoutes >= LIMITE) { limiteAtteinte = true; break; }
        const r = racine(e);
        // Parcours en largeur dans les trous, depuis tout le groupe de l'îlot,
        // jusqu'à la première matière d'un autre groupe : c'est le pont le plus court.
        pere.fill(-1);
        let tete = 0; let queue = 0;
        for (let p = 0; p < trous.length; p += 1) {
          if (!trous[p] && etiquettes[p] && racine(etiquettes[p]) === r) { pere[p] = p; file[queue++] = p; }
        }
        let arrivee = -1;
        while (tete < queue && arrivee < 0) {
          const p = file[tete++];
          const x = p % largeur; const y = (p - x) / largeur;
          const voisins = [x > 0 ? p - 1 : -1, x < largeur - 1 ? p + 1 : -1, y > 0 ? p - largeur : -1, y < hauteur - 1 ? p + largeur : -1];
          for (const v of voisins) {
            if (v < 0 || pere[v] !== -1) continue;
            if (!trous[v]) {
              if (etiquettes[v] && racine(etiquettes[v]) !== r) { pere[v] = p; arrivee = v; break; }
              continue; // matière du même groupe
            }
            pere[v] = p; file[queue++] = v;
          }
        }
        if (arrivee < 0) break; // impossible en principe
        let depart = arrivee;
        while (pere[depart] !== depart) depart = pere[depart];
        const autre = racine(etiquettes[arrivee]);
        tracerPont(trous, ponts, largeur, hauteur, depart, arrivee, epaisseur);
        // Les pixels du pont rejoignent le groupe de l'îlot.
        for (let p = 0; p < trous.length; p += 1) if (ponts[p] && !etiquettes[p]) etiquettes[p] = e;
        parent[r] = autre;
        pontsAjoutes += 1;
      }
      if (limiteAtteinte) break;
    }
  }

  let surfaceTrous = 0;
  for (const v of trous) surfaceTrous += v;
  return {
    trous, ponts, largeur, hauteur, seuil: masque.seuil, ilots, pontsAjoutes, limiteAtteinte, surfaceTrous,
    // Position du coin de la feuille dans l'image (pour la gomme) et taille du dessin.
    origine: { x: cadre.x0 - m, y: cadre.y0 - m },
    dessin: boite ? { largeur: boite.largeur, hauteur: boite.hauteur } : null,
  };
}

// Dessine le pochoir sur un canevas.
//  mode 'apercu'   : trous en noir, matière en blanc, ponts en orange pour les repérer
//  mode 'tshirt'   : le rendu sur un tee-shirt noir (la javel éclaircit les trous)
//  mode 'imprimer' : noir (à découper) sur blanc, avec le contour de la feuille
export function dessinerPochoir(resultat, toile, mode = 'apercu') {
  const { trous, ponts, largeur, hauteur } = resultat;
  toile.width = largeur;
  toile.height = hauteur;
  const ctx = toile.getContext('2d');
  const image = ctx.createImageData(largeur, hauteur);
  const couleurs = {
    apercu: { trou: [0, 0, 0], matiere: [255, 255, 255], pont: [230, 90, 20] },
    tshirt: { trou: [214, 132, 74], matiere: [18, 18, 18], pont: [18, 18, 18] },
    imprimer: { trou: [0, 0, 0], matiere: [255, 255, 255], pont: [255, 255, 255] },
  }[mode];
  for (let p = 0, i = 0; p < trous.length; p += 1, i += 4) {
    const v = ponts[p] ? couleurs.pont : trous[p] ? couleurs.trou : couleurs.matiere;
    image.data[i] = v[0]; image.data[i + 1] = v[1]; image.data[i + 2] = v[2]; image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  if (mode !== 'tshirt') {
    // Le contour de la feuille, à découper aussi.
    ctx.strokeStyle = mode === 'apercu' ? '#999' : '#000';
    ctx.lineWidth = Math.max(1, Math.round(largeur / 600));
    ctx.setLineDash([12, 8]);
    ctx.strokeRect(0.5, 0.5, largeur - 1, hauteur - 1);
  }
  return toile;
}
