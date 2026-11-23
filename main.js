// ============================================================
//  RÉGLAGES — tout ce qui change se modifie ici
// ============================================================
const REGLAGES = {
  // Nom affiché en grand, dans la barre et le pied de page.
  marque: 'bleach drop',

  // Petite signature sous le nom (laisser vide pour masquer).
  signature: '',

  // Où partent les commandes.
  //  - adresseFormulaire : la fonction d'envoi du site (dossier api/).
  //    Elle envoie l'e-mail, avec l'image jointe, sans quitter le site.
  //    L'adresse qui reçoit les commandes se règle dans Vercel
  //    (variable COMMANDES_EMAIL), pas ici.
  //  - email : solution de secours. Si l'envoi n'est pas disponible,
  //    le site ouvre la messagerie du visiteur avec le message déjà écrit.
  //    Laisser vide pour ne pas afficher d'adresse sur le site.
  adresseFormulaire: '/api/commande',
  email: '',

  // Liens du pied de page (laisser vide pour masquer).
  instagram: '',

  tailles: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],

  // Les offres se gèrent dans le back-office (onglet « Offres »).
  // Celles-ci ne servent que si la base ne répond pas.
  //  debut, fin : dates comprises, heure de Nouméa (AAAA-MM-JJ).
  //  reduction  : en pourcentage. Le prix réduit est arrondi à 100 XPF.
  //  pieces     : 'toutes', 'aucune' ou 'choix' (avec `articles`, la liste des identifiants).
  //  surMesure  : true si l'offre s'applique aussi au motif sur mesure.
  // Si plusieurs offres visent la même pièce, la plus forte s'applique (pas de cumul).
  offres: [
    { nom: 'Offre de lancement', debut: '2026-11-23', fin: '2026-12-24', reduction: 33, pieces: 'toutes', articles: [], surMesure: false, active: true },
    { nom: 'Offre de lancement', debut: '2026-11-23', fin: '2026-12-24', reduction: 27, pieces: 'aucune', articles: [], surMesure: true, active: true },
  ],

  // Tarif normal du motif sur mesure, affiché près du formulaire (vide = masqué).
  // Ces deux valeurs servent de secours : le back-office peut les remplacer.
  surMesure: true, // false = le motif sur mesure n'est pas proposé
  prixSurMesure: 'à partir de 7 500 XPF',

  // Les collections (« drops ») se gèrent dans le back-office (onglet « Collections »).
  // Sans base, aucune collection : toutes les pièces sont en vente.
  collections: [],

  // La photo montrée en premier dans la galerie, quand une pièce en a plusieurs.
  vueParDefaut: 'Dos',

  // true = les photos passent en noir et blanc. false = vraies couleurs.
  photosEnNoirEtBlanc: false,

  // Les pièces de la galerie.
  //  photos : une ou plusieurs images, avec une légende (Face, Dos…).
  //           Liste vide = un visuel provisoire est dessiné à la place.
  //  prix : prix normal, par ex. '6 000 XPF'. Vide = « Prix sur demande ».
  //         Les offres en cours s'appliquent dessus toutes seules.
  pieces: [
    {
      titre: 'Spider-Man',
      note: 'Javel sur coton noir · face et dos',
      photos: [
        { fichier: 'images/araignee-face.webp', legende: 'Face' },
        { fichier: 'images/araignee-dos.webp', legende: 'Dos' },
      ],
      prix: '6 000 XPF',
    },
    {
      titre: 'Centipede',
      note: 'Javel sur coton noir · face et dos',
      photos: [
        { fichier: 'images/centipede-face.webp', legende: 'Face' },
        { fichier: 'images/centipede-dos.webp', legende: 'Dos' },
      ],
      prix: '6 000 XPF',
    },
    {
      titre: 'Magma',
      note: 'Javel sur coton noir · effet délavé, face et dos',
      photos: [
        { fichier: 'images/magma-face.webp', legende: 'Face' },
        { fichier: 'images/magma-dos.webp', legende: 'Dos' },
      ],
      prix: '6 000 XPF',
    },
  ],
};

const SUR_MESURE = 'Motif sur mesure';

// La base Firebase où le back-office (/admin) range les articles.
// Ces deux valeurs sont publiques par nature : ce sont les règles de la base
// (firestore.rules) qui décident de ce que chacun peut lire ou écrire.
// Les pièces ci-dessus servent de secours si la base ne répond pas.
const FIREBASE = {
  projet: 'bleachdrop-nc',
  cle: 'AIzaSyAGG1HBm9Unhi_Y8msKJnOYb10JliiT4Lc',
};

// ============================================================
//  Mise en page
// ============================================================
const echapper = (texte) => String(texte).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

function poserMarque() {
  document.querySelectorAll('[data-marque]').forEach((el) => { el.textContent = REGLAGES.marque; });
  document.querySelectorAll('[data-signature]').forEach((el) => { el.textContent = REGLAGES.signature; });
  document.title = `${REGLAGES.marque} — tee-shirts à la javel`;
}

// Visuel provisoire d'une pièce sans photo : un tee-shirt noir taché de javel.
function visuelProvisoire(index) {
  const id = `tache-${index}`;
  const x = 170 + (index % 3) * 30;
  return `<svg viewBox="0 0 400 500" role="img" aria-label="Visuel provisoire">`
    + `<defs><radialGradient id="${id}" cx="45%" cy="35%" r="70%"><stop offset="0" stop-color="#fff1de"/><stop offset=".45" stop-color="#e0844f"/><stop offset="1" stop-color="#d05106"/></radialGradient></defs>`
    + `<path d="M140 60 Q200 104 260 60 L340 95 L385 190 L325 220 L310 185 L310 462 L90 462 L90 185 L75 220 L15 190 L60 95 Z" fill="#000" stroke="#3a3a3a" stroke-width="1.5"/>`
    + `<g clip-path="url(#forme-tee)" fill="url(#${id})" opacity=".9">`
    + `<circle cx="${x}" cy="240" r="52"/><circle cx="${x + 58}" cy="196" r="10"/><circle cx="${x - 62}" cy="214" r="7"/>`
    + `<rect x="${x - 34}" y="250" width="18" height="96" rx="9"/><rect x="${x + 8}" y="262" width="14" height="128" rx="7"/></g>`
    + `</svg><span class="a-venir">Photo à venir</span>`;
}

// Le prix d'une pièce : barré et réduit si une offre est en cours.
function baliseprix(piece) {
  if (!piece.prix) return '<strong>Prix sur demande</strong>';
  const p = prixPour(piece);
  if (!p.offre) return `<strong>${echapper(p.normal)}</strong>`;
  return `<s>${echapper(p.normal)}</s> <strong>${echapper(p.actuel)}</strong>`
    + `<small>−${p.offre.reduction} % jusqu'au ${echapper(dateCourte(p.offre.fin))}</small>`;
}

// Une photo vient soit d'un fichier du site (`fichier`), soit de la base
// (`photoId`) : dans ce cas l'image est remplie après coup par chargerPhotos().
const PIXEL_VIDE = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
function baliseImage(photo, classe, alt, paresseux) {
  const source = photo.fichier
    ? `src="${echapper(photo.fichier)}"`
    : `src="${PIXEL_VIDE}" data-photo="${echapper(photo.photoId || '')}"`;
  return `<img class="${classe}" ${source} alt="${alt}"${paresseux && photo.fichier ? ' loading="lazy"' : ''}>`;
}

// À l'accueil, sur grand écran : les créations défilent à droite du logo.
let minuterieAccueil = null;
function poserAccueil() {
  const cadre = document.getElementById('hero-visuel');
  // Seulement les pièces en vente : un drop à venir reste une surprise.
  const photos = piecesEnVente().flatMap((piece) => piece.photos || []);
  // Les dos d'abord : c'est là que sont les grands motifs.
  photos.sort((a, b) => (b.legende === 'Dos') - (a.legende === 'Dos'));
  cadre.innerHTML = photos.map((photo, n) => baliseImage(photo, n ? '' : 'active', '', false)).join('');

  clearInterval(minuterieAccueil);
  const images = cadre.querySelectorAll('img');
  if (images.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let courante = 0;
  minuterieAccueil = setInterval(() => {
    images[courante].classList.remove('active');
    courante = (courante + 1) % images.length;
    images[courante].classList.add('active');
  }, 4500);
}

function poserGalerie() {
  const galerie = document.getElementById('galerie');
  galerie.classList.toggle('photos-nb', REGLAGES.photosEnNoirEtBlanc);
  const pieces = piecesEnVente().filter((piece) => {
    if (filtrePieces === 'tout') return true;
    if (filtrePieces === 'autres') return !piece.collection;
    return piece.collection === filtrePieces;
  });
  galerie.innerHTML = pieces.map((piece) => {
    const i = REGLAGES.pieces.indexOf(piece); // le visuel provisoire ne change pas avec le filtre
    const collection = collectionDe(piece);
    const photos = piece.photos || [];
    const nom = (photo) => echapper(`${piece.titre} — ${photo.legende || 'photo'}`);
    let visuel;
    if (!photos.length) {
      visuel = visuelProvisoire(i);
    } else if (photos.length === 1) {
      visuel = baliseImage(photos[0], 'vue active', nom(photos[0]), true)
        + (photos[0].legende ? `<span class="a-venir">${echapper(photos[0].legende)}</span>` : '');
    } else {
      // Plusieurs photos : une seule visible, des boutons pour passer de l'une à l'autre.
      const debut = Math.max(0, photos.findIndex((photo) => photo.legende === REGLAGES.vueParDefaut));
      visuel = photos.map((photo, n) => baliseImage(photo, `vue${n === debut ? ' active' : ''}`, nom(photo), true)).join('')
        + `<div class="vues">${photos.map((photo, n) => `<button type="button" data-vue="${n}" aria-pressed="${n === debut}">${echapper(photo.legende || `Photo ${n + 1}`)}</button>`).join('')}</div>`;
    }
    return `<article class="piece">
      <div class="piece-visuel">${visuel}${photos.length ? '<span class="badge-unique">Pièce unique</span>' : ''}</div>
      <div class="piece-infos">
        <div>${collection ? `<span class="piece-collection">${echapper(collection.nom)}</span>` : ''}<h3>${echapper(piece.titre)}</h3></div>
        <span class="piece-prix">${baliseprix(piece)}</span>
      </div>
      ${piece.note ? `<p class="piece-note">${echapper(piece.note)}</p>` : ''}
      <a class="piece-lien" href="#commande" data-piece="${echapper(piece.titre)}">Commander cette pièce</a>
    </article>`;
  }).join('');
}

// Les clics dans la galerie. Branché une seule fois : la galerie peut être
// redessinée quand les articles arrivent de la base.
function brancherGalerie() {
  document.getElementById('galerie').addEventListener('click', (e) => {
    const lien = e.target.closest('[data-piece]');
    if (lien) {
      document.getElementById('piece').value = lien.dataset.piece;
      majPrixChoisi();
    }

    const bouton = e.target.closest('[data-vue]');
    if (bouton) {
      const cadre = bouton.closest('.piece-visuel');
      cadre.querySelectorAll('.vue').forEach((img, n) => img.classList.toggle('active', n === Number(bouton.dataset.vue)));
      cadre.querySelectorAll('[data-vue]').forEach((b) => b.setAttribute('aria-pressed', String(b === bouton)));
    }
  });
}

// ============================================================
//  Articles gérés dans le back-office
// ============================================================
// Essais en local : http://localhost:…/?emulateur lit l'émulateur Firebase, pas la vraie base.
const SERVEUR_BASE = ['localhost', '127.0.0.1'].includes(location.hostname) && new URLSearchParams(location.search).has('emulateur')
  ? 'http://127.0.0.1:8085'
  : 'https://firestore.googleapis.com';
const adresseBase = (chemin) => `${SERVEUR_BASE}/v1/projects/${FIREBASE.projet}/databases/(default)/documents${chemin}${chemin.includes('?') ? '&' : '?'}key=${FIREBASE.cle}`;

// Traduit une valeur au format de la base en valeur JavaScript.
function lireValeur(v) {
  if (!v) return undefined;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(lireValeur);
  if ('mapValue' in v) return lireChamps(v.mapValue.fields);
  return undefined;
}
const lireChamps = (champs) => Object.fromEntries(Object.entries(champs || {}).map(([cle, v]) => [cle, lireValeur(v)]));

// Remplace les pièces du site par les articles en ligne de la base.
// En cas d'échec, ou si la base est vide, le site garde ses pièces de secours.
async function chargerArticles() {
  try {
    const reponse = await fetch(adresseBase(':runQuery'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'articles' }],
          where: { fieldFilter: { field: { fieldPath: 'visible' }, op: 'EQUAL', value: { booleanValue: true } } },
        },
      }),
    });
    if (!reponse.ok) return;
    const articles = (await reponse.json())
      .filter((ligne) => ligne.document)
      .map((ligne) => ({ id: ligne.document.name.split('/').pop(), ...lireChamps(ligne.document.fields) }))
      .filter((a) => a.titre)
      .sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
    if (!articles.length) return;

    REGLAGES.pieces = articles.map((a) => ({
      id: a.id,
      titre: a.titre,
      note: a.note || '',
      prix: a.prix || '',
      collection: a.collection || '',
      photos: (a.photos || []).filter((p) => p && (p.fichier || p.photoId)),
    }));
    // Les collections disent quelles pièces sont en vente : on les attend.
    await collectionsPretes;
    poserPieces();
  } catch (erreur) {
    // Base injoignable : on garde les pièces écrites dans ce fichier.
  }
}

// Réglages du motif sur mesure, modifiés dans le back-office.
// Sans réponse de la base, le site garde les valeurs écrites dans REGLAGES.
async function chargerReglages() {
  try {
    const reponse = await fetch(adresseBase('/reglages/site'));
    if (!reponse.ok) return;
    const r = lireChamps((await reponse.json()).fields);
    if (typeof r.surMesure === 'boolean') REGLAGES.surMesure = r.surMesure;
    if (typeof r.prixSurMesure === 'string') REGLAGES.prixSurMesure = r.prixSurMesure;
    redessinerListes();
    poserPromo();
  } catch (erreur) {
    // Base injoignable : on garde les réglages écrits dans ce fichier.
  }
}

// Redessine la liste du formulaire en gardant le choix du visiteur.
// Une valeur qui n'existe plus (pièce masquée, sur-mesure retiré) revient à « Choisir… ».
function redessinerListes() {
  const liste = document.getElementById('piece');
  const choisie = liste.value;
  poserListes();
  liste.value = choisie;
  if (liste.selectedIndex < 0) liste.value = '';
  majPrixChoisi();
}

// ============================================================
//  Code promo
// ============================================================
// Un code se vérifie en lisant son document dans la base : on ne peut pas
// lister les codes, seulement vérifier celui qu'on connaît.
let codeActuel = null; // { code, reduction } quand le code saisi est valable
let etatCode = 'vide'; // 'vide', 'verif', 'ok', 'ko'
const codesLus = new Map();
const normaliserCode = (texte) => String(texte || '').toUpperCase().replace(/\s+/g, '');

function lireCode(code) {
  if (!codesLus.has(code)) {
    codesLus.set(code, fetch(adresseBase(`/codes/${encodeURIComponent(code)}`))
      .then((r) => (r.status === 404 ? null : r.ok ? r.json().then((d) => lireChamps(d.fields)) : undefined))
      .catch(() => undefined)); // undefined : base injoignable, on ne sait pas
  }
  return codesLus.get(code);
}

// Un code est valable s'il est actif et dans sa période (jours entiers, heure de Nouméa).
function codeValable(c) {
  if (!c || c.actif === false || !(c.reduction >= 1 && c.reduction <= 90)) return false;
  if (c.debut && Date.now() < Date.parse(`${c.debut}T00:00:00+11:00`)) return false;
  if (c.fin && Date.now() >= Date.parse(`${c.fin}T00:00:00+11:00`) + JOUR) return false;
  return true;
}

let minuterieCode = null;
function surSaisieCode() {
  clearTimeout(minuterieCode);
  const code = normaliserCode(document.getElementById('code').value);
  const etat = document.getElementById('etat-code');
  codeActuel = null;
  if (!code) { etatCode = 'vide'; etat.textContent = ''; majPrixChoisi(); return; }
  if (!/^[A-Z0-9-]{3,20}$/.test(code)) { etatCode = 'ko'; etat.textContent = 'Ce code n\'existe pas.'; majPrixChoisi(); return; }
  etatCode = 'verif';
  etat.textContent = 'Vérification…';
  minuterieCode = setTimeout(async () => {
    const c = await lireCode(code);
    if (normaliserCode(document.getElementById('code').value) !== code) return; // saisie changée entre-temps
    if (c === undefined) { etatCode = 'vide'; etat.textContent = 'Vérification impossible pour l\'instant : le code sera vérifié par notre équipe.'; }
    else if (codeValable(c)) { etatCode = 'ok'; codeActuel = { code, reduction: c.reduction }; etat.textContent = `Code ${code} : −${c.reduction} %.`; }
    else { etatCode = 'ko'; etat.textContent = c ? 'Ce code n\'est plus valable.' : 'Ce code n\'existe pas.'; }
    majPrixChoisi();
  }, 400);
}

// Le prix en vigueur avec le code : l'offre et le code ne se cumulent pas,
// le client paie le prix le plus bas des deux.
function prixFinal(piece) {
  const p = prixPour(piece);
  if (!codeActuel || !/\d/.test(p.normal || '') || (p.offre && p.offre.reduction >= codeActuel.reduction)) return { ...p, code: null };
  return { normal: p.normal, actuel: reduire(p.normal, codeActuel.reduction), offre: null, code: codeActuel };
}

// Sous la liste : le prix complet de la pièce choisie, avec l'offre ou le code.
function majPrixChoisi() {
  const valeur = document.getElementById('piece').value;
  const fiche = valeur === SUR_MESURE ? null : REGLAGES.pieces.find((p) => p.titre === valeur);
  const ligne = document.getElementById('prix-choisi');
  const p = valeur && (valeur === SUR_MESURE || fiche) ? prixFinal(fiche) : null;
  if (!p || !p.normal) { ligne.textContent = ''; return; }
  const majuscule = (texte) => texte.charAt(0).toUpperCase() + texte.slice(1);
  const sans = p.normal.replace(/^à partir de /i, '');
  if (p.code) ligne.textContent = `${majuscule(p.actuel)} au lieu de ${sans} · code ${p.code.code} −${p.code.reduction} %`;
  else if (p.offre) ligne.textContent = `${majuscule(p.actuel)} au lieu de ${sans} · ${p.offre.nom || 'offre'} jusqu'au ${dateCourte(p.offre.fin)}`
    + (codeActuel ? ' (plus avantageux que votre code)' : '');
  else ligne.textContent = majuscule(p.normal);
}

// Les offres actives de la base remplacent celles écrites dans REGLAGES.
// Une base qui répond « aucune offre » retire bien toutes les offres.
async function chargerOffres() {
  try {
    const reponse = await fetch(adresseBase(':runQuery'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'offres' }],
          where: { fieldFilter: { field: { fieldPath: 'active' }, op: 'EQUAL', value: { booleanValue: true } } },
        },
      }),
    });
    if (!reponse.ok) return;
    REGLAGES.offres = (await reponse.json())
      .filter((ligne) => ligne.document)
      .map((ligne) => lireChamps(ligne.document.fields))
      .filter((o) => o.debut && o.fin && o.reduction > 0);
    poserGalerie();
    chargerPhotos();
    redessinerListes();
    poserPromo();
  } catch (erreur) {
    // Base injoignable : on garde les offres écrites dans ce fichier.
  }
}

// Remplit les images dont la photo est rangée dans la base.
const photosChargees = new Map();
function chargerPhotos() {
  document.querySelectorAll('img[data-photo]').forEach((img) => {
    const id = img.dataset.photo;
    if (!id) return;
    if (!photosChargees.has(id)) {
      photosChargees.set(id, fetch(adresseBase(`/photos/${encodeURIComponent(id)}`))
        .then((r) => (r.ok ? r.json() : null))
        .then((doc) => (doc ? lireChamps(doc.fields).donnees : null))
        .catch(() => null));
    }
    photosChargees.get(id).then((donnees) => {
      if (donnees && /^data:image\/(jpeg|png|webp);base64,/.test(donnees)) img.src = donnees;
    });
  });
}

function poserListes() {
  const option = (valeur, texte = valeur) => `<option value="${echapper(valeur)}">${echapper(texte)}</option>`;
  document.getElementById('piece').innerHTML = option('', 'Choisir…')
    + piecesEnVente().map((p) => option(p.titre, p.prix ? `${p.titre} — ${prixPour(p).actuel}` : p.titre)).join('')
    // « à partir de » devient « dès » : sinon le prix est coupé sur téléphone.
    + (REGLAGES.surMesure
      ? option(SUR_MESURE, REGLAGES.prixSurMesure ? `${SUR_MESURE} — ${prixPour(null).actuel.replace(/^à partir de /i, 'dès ')}` : SUR_MESURE)
      : '');
  document.getElementById('intro-pieces').textContent = REGLAGES.surMesure
    ? 'Commandez une pièce, ou demandez un motif rien que pour vous.'
    : 'Choisissez votre pièce.';
  document.getElementById('taille').innerHTML = option('', 'Choisir…')
    + REGLAGES.tailles.map((t) => option(t)).join('');
}

function poserPied() {
  const liens = [];
  if (REGLAGES.instagram) liens.push(`<a href="${echapper(REGLAGES.instagram)}" target="_blank" rel="noopener">Instagram</a>`);
  if (REGLAGES.email) liens.push(`<a href="mailto:${echapper(REGLAGES.email)}">E-mail</a>`);
  document.getElementById('liens-pied').innerHTML = liens.join('');
}

// ============================================================
//  Offres
// ============================================================
// Les dates d'une offre sont des jours entiers à l'heure de Nouméa (UTC+11,
// sans heure d'été) : du début à 0 h jusqu'à la fin de la journée de fin.
const JOUR = 86400000;
const debutOffre = (o) => Date.parse(`${o.debut}T00:00:00+11:00`);
const finOffre = (o) => Date.parse(`${o.fin}T00:00:00+11:00`) + JOUR;
const offreEnCours = (o) => o.active !== false && Date.now() >= debutOffre(o) && Date.now() < finOffre(o);

const dateLongue = (jour) => new Date(`${jour}T12:00:00+11:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Pacific/Noumea' });
const dateCourte = (jour) => new Date(`${jour}T12:00:00+11:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'Pacific/Noumea' });

// L'offre vise-t-elle cette pièce ? `piece` vaut null pour le motif sur mesure.
function offreVise(o, piece) {
  if (!piece) return Boolean(o.surMesure);
  if (o.pieces === 'toutes') return true;
  return o.pieces === 'choix' && Boolean(piece.id) && (o.articles || []).includes(piece.id);
}

// Applique un pourcentage au montant écrit dans un texte, arrondi à 100 XPF :
// '6 000 XPF' à −33 % donne '4 000 XPF' ; 'à partir de 7 500 XPF' à −27 % donne 'à partir de 5 500 XPF'.
function reduire(texte, pourcentage) {
  return texte.replace(/\d[\d\s  ]*\d|\d/, (nombre) => {
    const montant = parseInt(nombre.replace(/\D/g, ''), 10);
    const reduit = Math.round((montant * (100 - pourcentage)) / 100 / 100) * 100;
    return String(reduit).replace(/\B(?=(\d{3})+$)/g, ' ');
  });
}

// Le prix normal, le prix en vigueur et l'offre appliquée (la plus forte), pour une pièce ou le sur-mesure.
function prixPour(piece) {
  const normal = piece ? piece.prix : REGLAGES.prixSurMesure;
  const offre = /\d/.test(normal || '')
    ? REGLAGES.offres.filter((o) => offreEnCours(o) && offreVise(o, piece)).sort((a, b) => b.reduction - a.reduction)[0]
    : undefined;
  return { normal, actuel: offre ? reduire(normal, offre.reduction) : normal, offre };
}

// Ce que vise une offre, en clair, pour le bandeau.
function cibleEnClair(o) {
  const choisies = piecesEnVente().filter((p) => offreVise(o, p)).map((p) => p.titre);
  let pieces = '';
  if (o.pieces === 'toutes') pieces = 'toutes les pièces';
  else if (choisies.length) pieces = choisies.length <= 3 ? choisies.join(', ').replace(/, ([^,]*)$/, ' et $1') : 'une sélection de pièces';
  if (o.pieces === 'toutes' && o.surMesure && REGLAGES.surMesure) return 'toute commande';
  if (o.surMesure && REGLAGES.surMesure) return pieces ? `${pieces} et le motif sur mesure` : 'le motif sur mesure';
  return pieces;
}

function poserPromo() {
  const enCours = REGLAGES.offres.filter((o) => offreEnCours(o) && cibleEnClair(o));
  let texte = '';
  if (enCours.length === 1) {
    const o = enCours[0];
    texte = `${echapper(o.nom || 'Offre')} · <strong>−${o.reduction} %</strong> sur ${echapper(cibleEnClair(o))} jusqu'au ${echapper(dateLongue(o.fin))}`;
  } else if (enCours.length > 1) {
    const noms = [...new Set(enCours.map((o) => o.nom || 'Offre'))];
    const max = Math.max(...enCours.map((o) => o.reduction));
    // Une seule date de fin commune : on l'affiche. Sinon chaque pièce montre la sienne.
    const fins = [...new Set(enCours.map((o) => o.fin))];
    texte = `${echapper(noms.length === 1 ? noms[0] : 'Offres en cours')} · <strong>jusqu'à −${max} %</strong>`
      + (fins.length === 1 ? ` jusqu'au ${echapper(dateLongue(fins[0]))}` : '');
  }
  document.querySelectorAll('[data-promo]').forEach((el) => {
    el.hidden = !texte;
    el.innerHTML = texte;
  });
}

// ============================================================
//  Collections (« drops »), gérées dans le back-office
// ============================================================
// Limitée : en vente du lancement à la fin (heure de Nouméa, 'AAAA-MM-JJTHH:MM').
//   Avant, ses pièces sont cachées ; la prochaine programmée affiche un décompte.
//   Après la fin, ses pièces quittent le site.
// Permanente : toujours en vente.
const momentNC = (texte) => (texte ? Date.parse(`${texte}:00+11:00`) : NaN);

function etatCollection(c) {
  if (c.type === 'permanente') return 'permanente';
  const maintenant = Date.now();
  if (maintenant < momentNC(c.debut)) return 'avenir';
  if (maintenant >= momentNC(c.fin)) return 'fin';
  return 'encours';
}

const collectionDe = (piece) => (piece && piece.collection ? REGLAGES.collections.find((c) => c.id === piece.collection) : undefined);

// En vente : une pièce sans collection, ou dans une collection permanente ou en cours.
// Une collection inconnue (masquée, supprimée, base muette) cache ses pièces.
function enVente(piece) {
  if (!piece.collection) return true;
  const c = collectionDe(piece);
  return Boolean(c) && ['permanente', 'encours'].includes(etatCollection(c));
}
const piecesEnVente = () => REGLAGES.pieces.filter(enVente);

// Les collections montrées : les drops en cours (le plus récent d'abord), puis les permanentes.
function collectionsEnVente() {
  const pieces = piecesEnVente();
  const enCours = REGLAGES.collections.filter((c) => etatCollection(c) === 'encours').sort((a, b) => momentNC(b.debut) - momentNC(a.debut));
  const permanentes = REGLAGES.collections.filter((c) => etatCollection(c) === 'permanente')
    .sort((a, b) => String(a.nom).localeCompare(String(b.nom), 'fr', { numeric: true }));
  return [...enCours, ...permanentes].filter((c) => pieces.some((p) => p.collection === c.id));
}

// Le décompte ne concerne que la prochaine collection limitée programmée.
const prochaineCollection = () => REGLAGES.collections.filter((c) => etatCollection(c) === 'avenir')
  .sort((a, b) => momentNC(a.debut) - momentNC(b.debut))[0];

// « le samedi 6 décembre à 18 h », « jusqu'au 24 déc. à 23 h 59 »
function heureNC(texte) {
  const [h, m] = new Date(momentNC(texte)).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Pacific/Noumea' }).split(':');
  return m === '00' ? `${Number(h)} h` : `${Number(h)} h ${m}`;
}
const jourLongNC = (texte) => new Date(momentNC(texte)).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Pacific/Noumea' });
const jourCourtNC = (texte) => new Date(momentNC(texte)).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Pacific/Noumea' });

async function chargerCollections() {
  try {
    const reponse = await fetch(adresseBase(':runQuery'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'collections' }],
          where: { fieldFilter: { field: { fieldPath: 'visible' }, op: 'EQUAL', value: { booleanValue: true } } },
        },
      }),
    });
    if (!reponse.ok) return;
    REGLAGES.collections = (await reponse.json())
      .filter((ligne) => ligne.document)
      .map((ligne) => ({ id: ligne.document.name.split('/').pop(), ...lireChamps(ligne.document.fields) }))
      .filter((c) => c.nom && (c.type === 'permanente' || (momentNC(c.debut) < momentNC(c.fin))));
  } catch (erreur) {
    // Base injoignable : pas de collections, les pièces sans collection restent en vente.
  }
}

function blocDecompte(c) {
  const unite = (cle, nom) => `<span><b data-unite="${cle}">00</b><small>${nom}</small></span>`;
  return `<p class="sur-titre">Prochain drop</p>
    <h3 class="drop-nom">${echapper(c.nom)}</h3>
    ${c.description ? `<p class="drop-texte">${echapper(c.description)}</p>` : ''}
    <div class="compteur" role="timer" aria-label="Temps restant avant le lancement" data-decompte="${echapper(c.debut)}">
      ${[unite('j', 'jours'), unite('h', 'heures'), unite('m', 'min'), unite('s', 'sec')].join('<i class="sep" aria-hidden="true">:</i>')}
    </div>
    <p class="drop-date">Lancement ${echapper(jourLongNC(c.debut))} à ${echapper(heureNC(c.debut))} · en vente jusqu'au ${echapper(jourCourtNC(c.fin))}</p>`;
}

function carteCollection(c) {
  const pieces = piecesEnVente().filter((p) => p.collection === c.id);
  // Trois photos au plus, les dos d'abord : c'est là que sont les grands motifs.
  const photos = pieces.map((p) => (p.photos || []).find((photo) => photo.legende === 'Dos') || (p.photos || [])[0]).filter(Boolean).slice(0, 3);
  const etat = c.type === 'permanente'
    ? 'Collection permanente'
    : `Drop en cours · jusqu'au ${jourCourtNC(c.fin)} à ${heureNC(c.fin)}`;
  return `<article class="collection">
    <div class="collection-photos" style="--n:${Math.max(1, photos.length)}">
      ${photos.length ? photos.map((photo) => baliseImage(photo, '', '', true)).join('') : '<span class="collection-vide"></span>'}
    </div>
    <div class="collection-texte">
      <p class="collection-etat">${echapper(etat)}</p>
      <h3>${echapper(c.nom)}</h3>
      ${c.description ? `<p class="collection-description">${echapper(c.description)}</p>` : ''}
      <a class="bouton" href="#pieces" data-filtre="${echapper(c.id)}">Voir ${pieces.length > 1 ? `les ${pieces.length} pièces` : 'la pièce'}</a>
    </div>
  </article>`;
}

// Numéros des sections (01, 02…) : la section Collections n'est pas toujours là.
function numeroterSections() {
  document.querySelectorAll('main > .section:not([hidden]) .numero').forEach((el, n) => {
    el.textContent = String(n + 1).padStart(2, '0');
  });
}

function poserCollections() {
  const prochaine = prochaineCollection();
  const liste = collectionsEnVente();
  const montrer = Boolean(prochaine || liste.length);
  document.getElementById('collections').hidden = !montrer;
  document.querySelectorAll('[data-lien-collections]').forEach((lien) => { lien.hidden = !montrer; });
  numeroterSections();
  const decompte = document.getElementById('decompte');
  decompte.hidden = !prochaine;
  decompte.innerHTML = prochaine ? blocDecompte(prochaine) : '';
  document.getElementById('liste-collections').innerHTML = liste.map(carteCollection).join('');
  majDecomptes();
}

// ---------- Filtre de la galerie par collection
let filtrePieces = 'tout'; // 'tout', 'autres' (sans collection) ou l'identifiant d'une collection

function poserFiltres() {
  const barre = document.getElementById('filtres-pieces');
  const liste = collectionsEnVente();
  const pieces = piecesEnVente();
  const autres = pieces.filter((p) => !p.collection).length;
  const choix = liste.length ? [
    ['tout', 'Tout', pieces.length],
    ...liste.map((c) => [c.id, c.nom, pieces.filter((p) => p.collection === c.id).length]),
    ...(autres ? [['autres', 'Autres pièces', autres]] : []),
  ] : [];
  if (!choix.some(([cle]) => cle === filtrePieces)) filtrePieces = 'tout';
  barre.hidden = !choix.length;
  barre.innerHTML = choix.map(([cle, nom, n]) => `<button type="button" data-filtre="${echapper(cle)}" aria-pressed="${cle === filtrePieces}">${echapper(nom)} <span>${n}</span></button>`).join('');
}

// Un bouton de filtre, ou « Voir les pièces » sur une carte de collection.
document.addEventListener('click', (e) => {
  const bouton = e.target.closest('[data-filtre]');
  if (!bouton) return;
  filtrePieces = bouton.dataset.filtre;
  poserFiltres();
  poserGalerie();
  chargerPhotos();
  reveler();
});

// ---------- Décompte, mis à jour chaque seconde
// Quand une collection change d'état (lancement, fin), toute la page se redessine.
let etatsCollections = '';
function majDecomptes() {
  const signature = REGLAGES.collections.map(etatCollection).join();
  if (etatsCollections && signature !== etatsCollections) {
    etatsCollections = signature;
    poserPieces();
    return;
  }
  etatsCollections = signature;
  document.querySelectorAll('[data-decompte]').forEach((el) => {
    const secondes = Math.max(0, Math.floor((momentNC(el.dataset.decompte) - Date.now()) / 1000));
    const valeurs = { j: Math.floor(secondes / 86400), h: Math.floor((secondes % 86400) / 3600), m: Math.floor((secondes % 3600) / 60), s: secondes % 60 };
    el.querySelectorAll('[data-unite]').forEach((b) => { b.textContent = String(valeurs[b.dataset.unite]).padStart(2, '0'); });
  });
}

// Tout ce qui dépend des pièces en vente.
function poserPieces() {
  poserAccueil();
  poserCollections();
  poserFiltres();
  poserGalerie();
  redessinerListes();
  poserPromo();
  chargerPhotos();
  reveler();
}

let collectionsPretes = Promise.resolve();

// ---------- Apparition douce des blocs au défilement
const mouvementReduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const observateur = 'IntersectionObserver' in window && !mouvementReduit
  ? new IntersectionObserver((entrees) => entrees.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('vu'); observateur.unobserve(e.target); }
  }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 })
  : null;
function reveler() {
  if (!observateur) return;
  document.documentElement.classList.add('js');
  document.querySelectorAll('.section-tete, .etapes li, .piece, .collection, .decompte, .formulaire').forEach((el) => {
    if (el.classList.contains('apparait')) return;
    el.classList.add('apparait');
    observateur.observe(el);
  });
}

// ============================================================
//  Formulaire de commande
// ============================================================
// Pays proposés dans le formulaire (la même liste est contrôlée par la fonction d'envoi).
const PAYS = ['Nouvelle-Calédonie'];

// Numéro calédonien : 6 chiffres, avec ou sans +687 ou 00687 devant.
// Renvoie '+687 75 12 34', '' si le champ est vide, ou null si le numéro n'est pas valable.
function telephoneNC(texte) {
  if (!String(texte || '').trim()) return '';
  let chiffres = String(texte).replace(/\D/g, '');
  if (chiffres.startsWith('00687')) chiffres = chiffres.slice(5);
  else if (chiffres.length === 9 && chiffres.startsWith('687')) chiffres = chiffres.slice(3);
  if (!/^\d{6}$/.test(chiffres)) return null;
  return `+687 ${chiffres.replace(/(\d{2})(?=\d)/g, '$1 ')}`;
}

function verifier(d) {
  const erreurs = {};
  if (d.nom.length < 2) erreurs.nom = 'Indiquez votre prénom et votre nom.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) erreurs.email = 'Indiquez une adresse e-mail valide.';
  if (!PAYS.includes(d.pays)) erreurs.pays = 'Choisissez votre pays.';
  if (d.codeSaisi && etatCode === 'ko') erreurs.code = 'Ce code n\'est pas valable. Corrigez-le ou laissez vide.';
  if (d.telephone === null) erreurs.telephone = 'Indiquez un numéro calédonien à 6 chiffres, ou laissez vide.';
  if (!d.piece) erreurs.piece = 'Choisissez une pièce, ou « Motif sur mesure ».';
  if (!d.taille) erreurs.taille = 'Choisissez une taille.';
  if (d.fichier && !/^image\//.test(d.fichier.type)) erreurs.modele = 'Le modèle doit être une image (photo ou dessin).';
  else if (d.fichier && d.fichier.size > 15 * 1024 * 1024) erreurs.modele = 'Cette image est trop lourde (15 Mo au maximum).';
  if (d.piece === SUR_MESURE && d.message.length < 10 && !d.fichier) erreurs.message = 'Décrivez le motif que vous imaginez, ou joignez un modèle.';
  return erreurs;
}

function ecrireMessage(d) {
  return [
    `Prénom et nom : ${d.nom}`,
    `E-mail : ${d.email}`,
    `Pays : ${d.pays}`,
    ...(d.telephone ? [`Téléphone : ${d.telephone}`] : []),
    ...(d.code ? [`Code promo : ${d.code}`] : []),
    `Pièce : ${d.piece}`,
    `Taille : ${d.taille}`,
    ...(d.prix ? [`Prix affiché : ${d.prix}`] : []),
    '',
    d.message || '(pas de message)',
  ].join('\n');
}

// Réduit l'image choisie (1600 px au plus, JPEG) et la rend en base64,
// pour qu'elle parte vite même depuis un téléphone.
async function preparerModele(fichier) {
  const adresse = URL.createObjectURL(fichier);
  try {
    const image = await new Promise((ok, ko) => {
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = () => ko(new Error('Cette image n\'a pas pu être lue. Essayez un fichier JPEG ou PNG.'));
      img.src = adresse;
    });
    // On réduit jusqu'à passer sous 900 000 caractères : l'image doit tenir
    // dans un document de la base (1 Mo au plus) pour s'afficher dans le back-office.
    let contenu = '';
    for (const [cote, qualite] of [[1600, 0.85], [1400, 0.8], [1200, 0.75], [1000, 0.7], [800, 0.65]]) {
      const echelle = Math.min(1, cote / Math.max(image.naturalWidth, image.naturalHeight));
      const toile = document.createElement('canvas');
      toile.width = Math.max(1, Math.round(image.naturalWidth * echelle));
      toile.height = Math.max(1, Math.round(image.naturalHeight * echelle));
      const dessin = toile.getContext('2d');
      dessin.fillStyle = '#fff'; // fond blanc sous les images transparentes
      dessin.fillRect(0, 0, toile.width, toile.height);
      dessin.drawImage(image, 0, 0, toile.width, toile.height);
      contenu = toile.toDataURL('image/jpeg', qualite).split(',')[1];
      if (contenu.length < 900000) break;
    }
    return { type: 'image/jpeg', contenu };
  } finally {
    URL.revokeObjectURL(adresse);
  }
}

// Ouvre la messagerie du visiteur avec la demande déjà écrite.
function ouvrirMessagerie(d, sujet) {
  const rappel = d.fichier ? '\n\n(Pensez à joindre votre modèle à cet e-mail.)' : '';
  window.location.href = `mailto:${REGLAGES.email}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(ecrireMessage(d) + rappel)}`;
  return 'Votre messagerie s\'ouvre avec la demande déjà écrite.'
    + (d.fichier ? ' Joignez-y votre modèle, puis envoyez.' : ' Il ne reste qu\'à l\'envoyer.');
}

async function envoyer(d) {
  const sujet = `Commande — ${d.piece} (${d.taille})`;

  if (REGLAGES.adresseFormulaire) {
    const { fichier, codeSaisi, ...champs } = d;
    const modele = fichier ? await preparerModele(fichier) : undefined;
    const reponse = await fetch(REGLAGES.adresseFormulaire, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ ...champs, modele }),
    });
    if (reponse.ok) {
      const resultat = await reponse.json().catch(() => ({}));
      return resultat.confirmation
        ? 'Demande envoyée. Un e-mail de confirmation vient de partir : pensez à regarder dans vos indésirables.'
        : 'Demande envoyée. Vous recevrez une réponse par e-mail.';
    }

    // Envoi indisponible (pas encore réglé, ou site ouvert hors de Vercel) : secours.
    if ([404, 405, 501, 503].includes(reponse.status) && REGLAGES.email) return ouvrirMessagerie(d, sujet);

    const detail = await reponse.json().catch(() => ({}));
    throw new Error(detail.erreur || `L'envoi a échoué (${reponse.status}). Réessayez dans un instant.`);
  }

  if (REGLAGES.email) return ouvrirMessagerie(d, sujet);

  throw new Error('Le formulaire n\'est pas encore relié à une adresse. La demande n\'est pas partie.');
}

function brancherFormulaire() {
  const formulaire = document.getElementById('formulaire');
  const etat = document.getElementById('etat');
  const bouton = document.getElementById('envoyer');

  const afficherErreurs = (erreurs) => {
    formulaire.querySelectorAll('[data-erreur]').forEach((p) => {
      const message = erreurs[p.dataset.erreur] || '';
      p.textContent = message;
      p.closest('.champ').classList.toggle('invalide', Boolean(message));
    });
  };

  formulaire.addEventListener('submit', async (e) => {
    e.preventDefault();
    const brut = Object.fromEntries(new FormData(formulaire));
    if (brut.site) return; // un robot a rempli le champ caché
    const d = {
      nom: brut.nom.trim(), email: brut.email.trim(), pays: brut.pays, telephone: telephoneNC(brut.telephone),
      piece: brut.piece, taille: brut.taille, message: brut.message.trim(),
      fichier: brut.modele && brut.modele.size ? brut.modele : null,
      // Le code part s'il est valable, ou si on n'a pas pu le vérifier : le serveur tranche.
      codeSaisi: normaliserCode(brut.code),
      code: etatCode === 'ko' ? '' : normaliserCode(brut.code),
    };

    // Le prix vu par le client au moment de sa demande, pour que l'équipe le retrouve.
    const fiche = d.piece === SUR_MESURE ? null : REGLAGES.pieces.find((p) => p.titre === d.piece);
    if (d.piece === SUR_MESURE || fiche) {
      const p = prixFinal(fiche);
      if (p.normal) {
        let detail = '';
        if (p.code) detail = ` (code ${p.code.code} −${p.code.reduction} %, prix normal ${p.normal})`;
        else if (p.offre) detail = ` (${p.offre.nom || 'offre'} −${p.offre.reduction} %, prix normal ${p.normal})`;
        d.prix = p.actuel + detail;
      }
    }

    const erreurs = verifier(d);
    afficherErreurs(erreurs);
    etat.className = 'etat';
    etat.textContent = '';
    const premier = Object.keys(erreurs)[0];
    if (premier) {
      formulaire.elements[premier].focus();
      return;
    }

    bouton.disabled = true;
    bouton.textContent = 'Envoi…';
    try {
      const message = await envoyer(d);
      etat.textContent = message;
      etat.classList.add('ok');
      if (message.startsWith('Demande envoyée')) formulaire.reset();
    } catch (erreur) {
      etat.textContent = erreur instanceof TypeError
        ? 'Envoi impossible. Vérifiez votre connexion, puis réessayez.'
        : erreur.message;
      etat.classList.add('ko');
    } finally {
      bouton.disabled = false;
      bouton.textContent = 'Envoyer la demande';
    }
  });

  document.getElementById('piece').addEventListener('change', majPrixChoisi);
  document.getElementById('code').addEventListener('input', surSaisieCode);
  formulaire.addEventListener('reset', () => setTimeout(surSaisieCode));

  formulaire.addEventListener('input', (e) => {
    const champ = e.target.closest('.champ');
    if (champ && champ.classList.contains('invalide')) {
      champ.classList.remove('invalide');
      champ.querySelector('.erreur').textContent = '';
    }
  });
}

poserMarque();
poserAccueil();
poserGalerie();
poserListes();
poserPied();
poserPromo();
brancherGalerie();
brancherFormulaire();
collectionsPretes = chargerCollections();
collectionsPretes.then(poserPieces);
chargerArticles();
chargerReglages();
chargerOffres();
setInterval(majDecomptes, 1000);
reveler();
