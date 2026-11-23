// Onglet Stencil : transformer une image en pochoir à découper, et garder une
// bibliothèque de pochoirs prêts à réimprimer à la bonne taille.
//
// Base : `pochoirs/{id}` (nom, miniature, taille en cm…) et `pochoirsImages/{id}`
// (l'image en grand, chargée seulement pour imprimer ou télécharger).
import {
  collection, doc, onSnapshot, getDoc, writeBatch, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';
import {
  construirePochoir, masqueDeDecoupe, boiteDesTrous, dessinerPochoir,
} from './pochoir.js';

const $ = (id) => document.getElementById(id);
const echapper = (texte) => String(texte == null ? '' : texte).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
const cm = (n) => (Math.round(n * 10) / 10).toLocaleString('fr-FR');

const COTE = 1400; // côté le plus long de l'image de travail, en pixels
const TAILLE_MAX = 900000; // une image enregistrée doit tenir dans un document de la base

// ============================================================
//  Impression à l'échelle, en pages A4
// ============================================================
// Zone imprimable d'une page A4 avec 10 mm de marge, moins la légende (deux lignes, 14 mm).
const ZONES = { portrait: { l: 190, h: 263 }, landscape: { l: 277, h: 176 } };
const RECOUVREMENT = 10; // mm communs à deux pages voisines, pour les assembler

// Choisit l'orientation qui demande le moins de pages et découpe la feuille.
export function planImpression(largeurMm, hauteurMm) {
  const plans = Object.entries(ZONES).map(([orientation, z]) => {
    const colonnes = largeurMm <= z.l ? 1 : Math.ceil((largeurMm - RECOUVREMENT) / (z.l - RECOUVREMENT));
    const lignes = hauteurMm <= z.h ? 1 : Math.ceil((hauteurMm - RECOUVREMENT) / (z.h - RECOUVREMENT));
    return { orientation, zone: z, colonnes, lignes, pages: colonnes * lignes };
  });
  return plans[1].pages < plans[0].pages ? plans[1] : plans[0];
}

function imprimer({ nom, image, largeurCm, hauteurCm }) {
  const L = largeurCm * 10; const H = hauteurCm * 10;
  const plan = planImpression(L, H);
  const { zone, colonnes, lignes } = plan;
  const pages = [];
  for (let r = 0; r < lignes; r += 1) {
    for (let c = 0; c < colonnes; c += 1) {
      const x = c * (zone.l - RECOUVREMENT); const y = r * (zone.h - RECOUVREMENT);
      const w = Math.min(zone.l, L - x); const h = Math.min(zone.h, H - y);
      const repere = plan.pages > 1 ? `${String.fromCharCode(65 + r)}${c + 1}` : '';
      pages.push(`<section class="feuille-impression">
        <div class="tuile" style="width:${w}mm;height:${h}mm">
          <img alt="" style="width:${L}mm;height:${H}mm;left:${-x}mm;top:${-y}mm">
          ${c > 0 ? `<i class="recouvrement gauche" style="width:${RECOUVREMENT}mm"></i>` : ''}
          ${r > 0 ? `<i class="recouvrement haut" style="height:${RECOUVREMENT}mm"></i>` : ''}
        </div>
        <div class="legende-impression">
          <p><span>${repere ? `<b>${repere}</b> · page ${pages.length + 1}/${plan.pages} · ` : ''}bleach drop · ${echapper(nom)}</span>
          <span>Feuille ${cm(largeurCm)} × ${cm(hauteurCm)} cm${plan.pages > 1 ? ' · superposer les bandes pointillées' : ''}</span></p>
          <span class="regle">5 cm · imprimer à 100 %</span>
        </div>
      </section>`);
    }
  }
  $('impression').innerHTML = pages.join('');
  $('impression').dataset.orientation = plan.orientation;
  $('page-impression').textContent = `@page { size: A4 ${plan.orientation}; margin: 10mm; }`;
  const images = [...$('impression').querySelectorAll('img')];
  images.forEach((img) => { img.src = image; });
  document.body.classList.add('impression');
  const finir = () => {
    document.body.classList.remove('impression');
    $('impression').innerHTML = '';
    window.removeEventListener('afterprint', finir);
  };
  window.addEventListener('afterprint', finir);
  Promise.all(images.map((img) => img.decode().catch(() => {}))).then(() => window.print());
  return plan;
}

// ============================================================
//  PNG : on y inscrit la taille réelle (chunk pHYs), pour qu'il s'imprime
//  à la bonne échelle depuis n'importe quel logiciel.
// ============================================================
const TABLE_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(octets) {
  let c = 0xffffffff;
  for (const o of octets) c = TABLE_CRC[(c ^ o) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngAvecTaille(dataUrl, pixelsParMetre) {
  const binaire = atob(dataUrl.split(',')[1]);
  const octets = Uint8Array.from(binaire, (ch) => ch.charCodeAt(0));
  const morceau = new Uint8Array(21);
  const vue = new DataView(morceau.buffer);
  vue.setUint32(0, 9);
  morceau.set([0x70, 0x48, 0x59, 0x73], 4); // « pHYs »
  vue.setUint32(8, Math.round(pixelsParMetre));
  vue.setUint32(12, Math.round(pixelsParMetre));
  morceau[16] = 1; // unité : le mètre
  vue.setUint32(17, crc32(morceau.subarray(4, 17)));
  const sortie = new Uint8Array(octets.length + 21);
  sortie.set(octets.subarray(0, 33)); // signature + IHDR
  sortie.set(morceau, 33);
  sortie.set(octets.subarray(33), 54);
  let texte = '';
  for (let i = 0; i < sortie.length; i += 0x8000) texte += String.fromCharCode.apply(null, sortie.subarray(i, i + 0x8000));
  return `data:image/png;base64,${btoa(texte)}`;
}

const nomDeFichier = (nom) => `pochoir-${(nom || 'sans-nom').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'sans-nom'}.png`;
function telecharger(dataUrl, nom) {
  const lien = document.createElement('a');
  lien.href = dataUrl;
  lien.download = nomDeFichier(nom);
  document.body.append(lien);
  lien.click();
  lien.remove();
}

// ============================================================
//  L'onglet
// ============================================================
export function brancherStencil(db) {
  const f = $('reglages-pochoir');
  const toile = $('toile-pochoir');
  const message = (texte) => { $('message-pochoir').textContent = texte; };

  let source = null; // { rgba, largeur, hauteur }
  let effacer = []; // points gommés, en pixels de l'image de travail
  let pochoirOuvert = null; // identifiant du pochoir rouvert depuis la bibliothèque, sinon null
  let resultat = null;
  let vue = 'apercu';
  let minuterie = null;

  // ---------- Chargement d'une image (fichier ou Blob)
  // Les boutons d'enregistrement suivent l'état : nouveau pochoir, ou pochoir rouvert.
  function majBoutonsEnregistrer() {
    $('enregistrer-pochoir').textContent = pochoirOuvert ? 'Enregistrer les modifications' : 'Enregistrer';
    $('enregistrer-copie').hidden = !pochoirOuvert;
  }

  // reprise : { id, nom, reglages, effacer } pour rouvrir un pochoir de la bibliothèque
  async function chargerImage(blob, nom, reprise = null) {
    let bitmap;
    try {
      bitmap = await createImageBitmap(blob);
    } catch (erreur) {
      message('Cette image ne s\'ouvre pas. Essaie un JPEG ou un PNG.');
      return;
    }
    const echelle = COTE / Math.max(bitmap.width, bitmap.height);
    const largeur = Math.max(1, Math.round(bitmap.width * echelle));
    const hauteur = Math.max(1, Math.round(bitmap.height * echelle));
    const travail = document.createElement('canvas');
    travail.width = largeur;
    travail.height = hauteur;
    const ctx = travail.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, largeur, hauteur);
    bitmap.close();
    source = { rgba: ctx.getImageData(0, 0, largeur, hauteur).data, largeur, hauteur, toile: travail };

    if (reprise) {
      // On remet les réglages et les coups de gomme tels qu'ils étaient à l'enregistrement.
      const r = reprise.reglages || {};
      const poser = (nomChamp, valeur) => { if (valeur !== undefined && valeur !== null) f[nomChamp].value = valeur; };
      poser('largeurCm', r.largeurCm); poser('seuil', r.seuil); poser('lissage', r.lissage);
      poser('nettoyageMm', r.nettoyageMm); poser('pontMm', r.pontMm); poser('margeCm', r.margeCm);
      f.decoupe.value = r.decoupe === 'claires' ? 'claires' : 'foncees';
      f.seuilAuto.checked = r.seuilAuto !== false;
      f.egaliser.checked = Boolean(r.egaliser);
      f.ponts.checked = r.ponts !== false;
      effacer = (reprise.effacer || []).map((pt) => [pt.x, pt.y]);
      pochoirOuvert = reprise.id;
      f.nom.value = reprise.nom || '';
    } else {
      effacer = [];
      pochoirOuvert = null;
      // On découpe la partie minoritaire : un pochoir est surtout de la matière.
      const essai = masqueDeDecoupe(source.rgba, largeur, hauteur, { flou: 1, nettoyage: 0 });
      let surface = 0;
      for (const v of essai.trous) surface += v;
      f.decoupe.value = surface > essai.trous.length / 2 ? 'claires' : 'foncees';
      f.seuilAuto.checked = true;
      f.egaliser.checked = false;
      f.nom.value = (nom || '').replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').trim().slice(0, 60);
    }
    majBoutonsEnregistrer();
    $('atelier').hidden = false;
    message('');
    calculer();
    // après le calcul, qui vide la zone de message
    if (reprise) message(`Tu modifies « ${reprise.nom} ». « Enregistrer les modifications » remplace la version de la bibliothèque.`);
  }

  // L'image de travail, gardée pour pouvoir rouvrir le pochoir (JPEG sur fond blanc :
  // le transparent compte comme du blanc dans le moteur).
  function sourceEnregistrable() {
    const t = document.createElement('canvas');
    t.width = source.largeur;
    t.height = source.hauteur;
    const ctx = t.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, t.width, t.height);
    ctx.drawImage(source.toile, 0, 0);
    for (const qualite of [0.9, 0.8, 0.7, 0.6, 0.5]) {
      const url = t.toDataURL('image/jpeg', qualite);
      if (url.length < TAILLE_MAX) return url;
    }
    return null;
  }

  $('image-pochoir').addEventListener('change', (e) => {
    const fichier = e.target.files[0];
    if (fichier) chargerImage(fichier, fichier.name);
    e.target.value = '';
  });

  // ---------- Réglages
  function lireReglages() {
    const n = (nom, defaut) => { const v = Number(f[nom].value); return Number.isFinite(v) ? v : defaut; };
    return {
      largeurCm: Math.min(100, Math.max(3, n('largeurCm', 25))),
      inverser: f.decoupe.value === 'claires',
      seuilAuto: f.seuilAuto.checked,
      seuil: n('seuil', 128),
      egaliser: f.egaliser.checked,
      lissage: n('lissage', 1),
      nettoyageMm: n('nettoyageMm', 1),
      ponts: f.ponts.checked,
      pontMm: n('pontMm', 2),
      margeCm: n('margeCm', 2),
    };
  }

  function majValeurs() {
    const r = lireReglages();
    f.querySelector('[data-valeur="seuil"]').textContent = r.seuilAuto ? `auto (${resultat ? resultat.seuil : '…'})` : r.seuil;
    f.querySelector('[data-valeur="lissage"]').textContent = r.lissage ? r.lissage : 'aucun';
    f.querySelector('[data-valeur="nettoyageMm"]').textContent = r.nettoyageMm ? `${cm(r.nettoyageMm)} mm` : 'aucune';
    f.querySelector('[data-valeur="pontMm"]').textContent = `${cm(r.pontMm)} mm`;
    f.querySelector('[data-valeur="margeCm"]').textContent = `${cm(r.margeCm)} cm`;
    f.seuil.disabled = r.seuilAuto;
    f.pontMm.disabled = !r.ponts;
  }

  function plusTard() {
    majValeurs();
    clearTimeout(minuterie);
    message('Calcul…');
    minuterie = setTimeout(calculer, 250);
  }
  f.addEventListener('input', (e) => {
    // Inverser la découpe change toutes les zones : les coups de gomme n'ont plus de sens.
    if (e.target.name === 'decoupe') effacer = [];
    if (e.target.name !== 'nom') plusTard();
  });
  f.addEventListener('submit', (e) => e.preventDefault());

  // Surface (en pixels) d'une tache ronde de diamètre `mm`.
  const surfaceTache = (mm, pxParCm) => Math.round((Math.PI / 4) * ((mm / 10) * pxParCm) ** 2);

  function calculer() {
    clearTimeout(minuterie);
    if (!source) return;
    const r = lireReglages();
    const { rgba, largeur, hauteur } = source;
    const base = {
      seuil: r.seuilAuto ? null : r.seuil,
      inverser: r.inverser,
      egaliser: r.egaliser,
      flou: (r.lissage * Math.max(largeur, hauteur)) / 1000,
      effacer,
    };
    // L'échelle : la largeur du motif (les zones découpées) donne les pixels par cm.
    // Le nettoyage dépend de l'échelle et change un peu le motif : on recommence
    // jusqu'à ce que les deux s'accordent (en général dès le deuxième tour).
    let pxParCm = largeur / r.largeurCm;
    let boite = null;
    for (let tour = 0; tour < 4; tour += 1) {
      const essai = masqueDeDecoupe(rgba, largeur, hauteur, { ...base, nettoyage: surfaceTache(r.nettoyageMm, pxParCm) });
      boite = boiteDesTrous(essai.trous, largeur, hauteur);
      if (!boite) break;
      const nouvelle = boite.largeur / r.largeurCm;
      const stable = Math.abs(nouvelle - pxParCm) <= pxParCm * 0.005;
      pxParCm = nouvelle;
      if (stable) break;
    }
    if (!boite) {
      resultat = null;
      toile.hidden = true;
      $('infos-pochoir').innerHTML = '';
      majValeurs();
      message('Rien à découper avec ces réglages : change le seuil ou « À découper ».');
      return;
    }
    pxParCm = boite.largeur / r.largeurCm;
    const res = construirePochoir(rgba, largeur, hauteur, {
      ...base,
      nettoyage: surfaceTache(r.nettoyageMm, pxParCm),
      ponts: r.ponts,
      largeurPont: (r.pontMm / 10) * pxParCm,
      marge: r.margeCm * pxParCm,
      recadrer: true,
    });
    res.pxParCm = pxParCm;
    res.largeurCm = res.largeur / pxParCm;
    res.hauteurCm = res.hauteur / pxParCm;
    resultat = res;
    toile.hidden = false;
    dessinerPochoir(res, toile, vue);
    majValeurs();
    message('');

    const plan = planImpression(res.largeurCm * 10, res.hauteurCm * 10);
    const infos = [
      `Motif ${cm(res.dessin.largeur / pxParCm)} × ${cm(res.dessin.hauteur / pxParCm)} cm, feuille ${cm(res.largeurCm)} × ${cm(res.hauteurCm)} cm`,
      `${plan.pages} page${plan.pages > 1 ? 's' : ''} A4 à l'impression`,
    ];
    if (r.ponts) infos.push(res.ilots ? `${res.ilots} morceau${res.ilots > 1 ? 'x' : ''} à retenir, ${res.pontsAjoutes} pont${res.pontsAjoutes > 1 ? 's' : ''} ajouté${res.pontsAjoutes > 1 ? 's' : ''}` : 'aucun pont nécessaire');
    const alertes = [];
    if (!r.ponts && res.ilots) alertes.push(`${res.ilots} morceau${res.ilots > 1 ? 'x tomberaient' : ' tomberait'} à la découpe : active les ponts.`);
    if (res.limiteAtteinte) alertes.push('Trop de morceaux à retenir (plus de 400) : augmente « Supprimer les taches » ou le lissage.');
    if (pxParCm < 20) alertes.push(`Image peu détaillée pour cette taille (${Math.round(pxParCm * 2.54)} points par pouce) : les bords seront en escalier. Recadre l'image autour du motif ou réduis la largeur.`);
    $('infos-pochoir').innerHTML = `<p>${infos.map(echapper).join(' · ')}</p>${alertes.map((a) => `<p class="alerte">${echapper(a)}</p>`).join('')}`;
    $('annuler-gomme').hidden = effacer.length === 0;
  }

  // ---------- Vues et gomme
  document.querySelectorAll('[data-vue]').forEach((bouton) => bouton.addEventListener('click', () => {
    vue = bouton.dataset.vue;
    document.querySelectorAll('[data-vue]').forEach((b) => b.classList.toggle('actif', b === bouton));
    if (resultat) dessinerPochoir(resultat, toile, vue);
  }));

  toile.addEventListener('click', (e) => {
    if (!resultat) return;
    // Position dans le canevas, sans sa bordure.
    const cadre = toile.getBoundingClientRect();
    const echelle = toile.width / toile.clientWidth;
    const cx = (e.clientX - cadre.left - toile.clientLeft) * echelle;
    const cy = (e.clientY - cadre.top - toile.clientTop) * echelle;
    // Le noir le plus proche, à 8 pixels d'écran près : un trait fin se rate facilement au doigt.
    const { largeur, hauteur, trous } = resultat;
    const rayon = Math.ceil(8 * echelle);
    let choisi = null; let meilleure = Infinity;
    for (let y = Math.max(0, Math.floor(cy - rayon)); y <= Math.min(hauteur - 1, Math.ceil(cy + rayon)); y += 1) {
      for (let x = Math.max(0, Math.floor(cx - rayon)); x <= Math.min(largeur - 1, Math.ceil(cx + rayon)); x += 1) {
        const distance = (x - cx) ** 2 + (y - cy) ** 2;
        if (trous[y * largeur + x] && distance < meilleure && distance <= rayon * rayon) { meilleure = distance; choisi = [x, y]; }
      }
    }
    if (!choisi) {
      message('La gomme rebouche une zone à découper : clique sur du noir.');
      return;
    }
    effacer.push([choisi[0] + resultat.origine.x, choisi[1] + resultat.origine.y]);
    message('Calcul…');
    setTimeout(calculer, 20);
  });
  $('annuler-gomme').addEventListener('click', () => {
    effacer.pop();
    calculer();
  });

  // ---------- Image à imprimer ou à enregistrer
  function imageImprimable(tailleMax = Infinity) {
    let grande = dessinerPochoir(resultat, document.createElement('canvas'), 'imprimer');
    let url = grande.toDataURL('image/png');
    // Trop lourde pour la base : on la réduit jusqu'à ce qu'elle tienne.
    while (url.length > tailleMax && grande.width > 300) {
      const facteur = Math.max(0.5, Math.sqrt(tailleMax / url.length) * 0.95);
      const petite = document.createElement('canvas');
      petite.width = Math.round(grande.width * facteur);
      petite.height = Math.round(grande.height * facteur);
      const ctx = petite.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(grande, 0, 0, petite.width, petite.height);
      grande = petite;
      url = grande.toDataURL('image/png');
    }
    if (url.length > tailleMax) return null;
    // pixels par mètre = largeur en pixels / largeur en mètres
    return pngAvecTaille(url, grande.width / (resultat.largeurCm / 100));
  }

  function miniature() {
    const grande = dessinerPochoir(resultat, document.createElement('canvas'), 'imprimer');
    const echelle = 240 / Math.max(grande.width, grande.height);
    const petite = document.createElement('canvas');
    petite.width = Math.max(1, Math.round(grande.width * echelle));
    petite.height = Math.max(1, Math.round(grande.height * echelle));
    const ctx = petite.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(grande, 0, 0, petite.width, petite.height);
    return petite.toDataURL('image/png');
  }

  $('telecharger-pochoir').addEventListener('click', () => {
    if (resultat) telecharger(imageImprimable(), f.nom.value);
  });
  $('imprimer-pochoir').addEventListener('click', () => {
    if (resultat) imprimer({ nom: f.nom.value || 'Pochoir', image: imageImprimable(), largeurCm: resultat.largeurCm, hauteurCm: resultat.hauteurCm });
  });

  async function enregistrer(commeNouveau) {
    if (!resultat) return;
    const nom = f.nom.value.trim();
    if (!nom) { message('Donne un nom au pochoir.'); f.nom.focus(); return; }
    const image = imageImprimable(TAILLE_MAX);
    if (!image) { message('Ce pochoir est trop détaillé pour être enregistré. Augmente « Supprimer les taches » ou réduis la largeur.'); return; }
    const imageSource = sourceEnregistrable();
    const boutons = [$('enregistrer-pochoir'), $('enregistrer-copie')];
    boutons.forEach((b) => { b.disabled = true; });
    message('Enregistrement…');
    try {
      const nouveau = commeNouveau || !pochoirOuvert;
      const id = nouveau ? doc(collection(db, 'pochoirs')).id : pochoirOuvert;
      const r = lireReglages();
      const lot = writeBatch(db);
      lot.set(doc(db, 'pochoirs', id), {
        nom: nom.slice(0, 60),
        miniature: miniature(),
        largeurCm: Math.round(resultat.largeurCm * 10) / 10,
        hauteurCm: Math.round(resultat.hauteurCm * 10) / 10,
        ponts: resultat.pontsAjoutes,
        ...(nouveau ? { creeLe: serverTimestamp() } : { modifieLe: serverTimestamp() }),
      }, { merge: true });
      lot.set(doc(db, 'pochoirsImages', id), { image });
      if (imageSource) {
        // De quoi rouvrir le pochoir dans l'éditeur : l'image d'origine, les réglages, la gomme.
        lot.set(doc(db, 'pochoirsSources', id), {
          image: imageSource,
          largeur: source.largeur,
          hauteur: source.hauteur,
          reglages: {
            largeurCm: r.largeurCm, decoupe: r.inverser ? 'claires' : 'foncees', seuilAuto: r.seuilAuto, seuil: r.seuil,
            egaliser: r.egaliser, lissage: r.lissage, nettoyageMm: r.nettoyageMm, ponts: r.ponts, pontMm: r.pontMm, margeCm: r.margeCm,
          },
          effacer: effacer.map(([x, y]) => ({ x, y })), // la base n'accepte pas les listes de listes
        });
      }
      await lot.commit();
      images.set(id, Promise.resolve(image));
      pochoirOuvert = id;
      majBoutonsEnregistrer();
      message(nouveau
        ? `« ${nom} » est dans la bibliothèque.${imageSource ? '' : ' (Image d\'origine trop lourde : il ne pourra pas être rouvert dans l\'éditeur.)'}`
        : `Les modifications de « ${nom} » sont enregistrées.`);
    } catch (erreur) {
      message('Le pochoir n\'a pas pu être enregistré.');
    } finally {
      boutons.forEach((b) => { b.disabled = false; });
    }
  }
  $('enregistrer-pochoir').addEventListener('click', () => enregistrer(false));
  $('enregistrer-copie').addEventListener('click', () => enregistrer(true));

  // ---------- Bibliothèque
  let pochoirs = [];
  let arret = null;
  const images = new Map(); // id -> promesse de l'image en grand

  function imageDe(id) {
    if (!images.has(id)) {
      images.set(id, getDoc(doc(db, 'pochoirsImages', id)).then((d) => (d.exists() ? d.data().image : null)));
    }
    return images.get(id).catch((erreur) => { images.delete(id); throw erreur; });
  }

  function dessinerBibliotheque() {
    $('pochoirs-vides').hidden = pochoirs.length > 0;
    $('liste-pochoirs').innerHTML = pochoirs.map((p) => {
      const plan = planImpression(p.largeurCm * 10, p.hauteurCm * 10);
      const date = p.creeLe && p.creeLe.toDate ? p.creeLe.toDate().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
      return `<article class="carte article pochoir" data-pochoir="${echapper(p.id)}">
        <img src="${echapper(p.miniature)}" alt="Modifier ${echapper(p.nom)}" data-action-pochoir="modifier" title="Rouvrir dans l'éditeur">
        <div class="article-infos">
          <strong>${echapper(p.nom)}</strong>
          <span class="discret">Feuille ${cm(p.largeurCm)} × ${cm(p.hauteurCm)} cm · ${plan.pages} page${plan.pages > 1 ? 's' : ''} A4</span>
          <span class="discret">${echapper(date)}</span>
        </div>
        <div class="article-actions">
          <button class="lien" data-action-pochoir="modifier">Modifier</button>
          <button class="lien" data-action-pochoir="imprimer">Imprimer</button>
          <button class="lien" data-action-pochoir="telecharger">Télécharger</button>
          <button class="lien danger pousse" data-action-pochoir="supprimer">Supprimer</button>
        </div>
      </article>`;
    }).join('');
  }

  $('liste-pochoirs').addEventListener('click', async (e) => {
    const action = e.target.dataset.actionPochoir;
    if (!action) return;
    const p = pochoirs.find((x) => x.id === e.target.closest('[data-pochoir]').dataset.pochoir);
    if (!p) return;
    if (action === 'supprimer') {
      if (!confirm(`Supprimer définitivement le pochoir « ${p.nom} » ?`)) return;
      const lot = writeBatch(db);
      lot.delete(doc(db, 'pochoirs', p.id));
      lot.delete(doc(db, 'pochoirsImages', p.id));
      lot.delete(doc(db, 'pochoirsSources', p.id));
      await lot.commit().catch(() => alert('Suppression impossible.'));
      images.delete(p.id);
      if (pochoirOuvert === p.id) { pochoirOuvert = null; majBoutonsEnregistrer(); }
      return;
    }
    if (action === 'modifier') {
      try {
        const d = await getDoc(doc(db, 'pochoirsSources', p.id));
        if (!d.exists()) {
          alert(`« ${p.nom} » a été enregistré avant que l'éditeur garde l'image d'origine : il ne peut pas être rouvert.\nRecharge l'image d'origine avec « Choisir une image », règle-la, puis enregistre : la nouvelle version pourra être rouverte.`);
          return;
        }
        const s = d.data();
        const blob = await (await fetch(s.image)).blob();
        await chargerImage(blob, p.nom, { id: p.id, nom: p.nom, reglages: s.reglages, effacer: s.effacer });
        $('titre-convertisseur').scrollIntoView({ block: 'start' });
      } catch (erreur) {
        alert('Ce pochoir n\'a pas pu être rouvert.');
      }
      return;
    }
    const texte = e.target.textContent;
    e.target.textContent = 'Chargement…';
    try {
      const image = await imageDe(p.id);
      if (!image) throw new Error('image absente');
      if (action === 'imprimer') imprimer({ nom: p.nom, image, largeurCm: p.largeurCm, hauteurCm: p.hauteurCm });
      if (action === 'telecharger') telecharger(image, p.nom);
    } catch (erreur) {
      alert('L\'image de ce pochoir n\'a pas pu être chargée.');
    } finally {
      e.target.textContent = texte;
    }
  });

  return {
    // La bibliothèque n'est chargée qu'à la première ouverture de l'onglet.
    ouvrir() {
      if (arret) return;
      arret = onSnapshot(collection(db, 'pochoirs'), (instantane) => {
        pochoirs = instantane.docs.map((d) => ({ id: d.id, ...d.data() }))
          // Un pochoir tout juste créé (date pas encore posée par le serveur) passe en tête.
          .sort((a, b) => (b.creeLe?.seconds ?? 9e12) - (a.creeLe?.seconds ?? 9e12));
        dessinerBibliotheque();
      });
    },
    arreter() {
      if (arret) arret();
      arret = null;
      pochoirs = [];
      images.clear();
    },
    chargerImage,
  };
}
