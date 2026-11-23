// ============================================================
//  RÉGLAGES — tout ce qui change se modifie ici
// ============================================================
const REGLAGES = {
  // Nom affiché en grand, dans la barre et le pied de page.
  marque: 'bleach drop',

  // Petite signature sous le nom (laisser vide pour masquer).
  signature: 'by Maya',

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

  // Offre de lancement : jusqu'à la date `fin`, chaque pièce est vendue
  // à son `prixLancement`. Ensuite le prix normal revient tout seul.
  // Mettre `fin: ''` pour arrêter l'offre tout de suite.
  //  fin : ici le 25 décembre à minuit, heure de Nouméa.
  promo: {
    fin: '2026-12-25T00:00:00+11:00',
    finTexte: 'avant le 25 décembre',
  },

  // Tarif normal du motif sur mesure, affiché près du formulaire (vide = masqué).
  prixSurMesure: 'à partir de 9 000 XPF',
  prixSurMesureLancement: 'à partir de 6 500 XPF',

  // La photo montrée en premier dans la galerie, quand une pièce en a plusieurs.
  vueParDefaut: 'Dos',

  // true = les photos passent en noir et blanc. false = vraies couleurs.
  photosEnNoirEtBlanc: false,

  // Les pièces de la galerie.
  //  photos : une ou plusieurs images, avec une légende (Face, Dos…).
  //           Liste vide = un visuel provisoire est dessiné à la place.
  //  prix          : prix normal, par ex. '7 500 XPF'. Vide = « Prix sur demande ».
  //  prixLancement : prix pendant l'offre de lancement (vide = pas d'offre sur cette pièce).
  //  prixNormal : prix affiché barré à côté (laisser vide pour ne rien barrer).
  //  mention    : petit texte sous le prix, par ex. 'Prix de lancement'.
  pieces: [
    {
      titre: 'Spider-Man',
      note: 'Javel sur coton noir · face et dos',
      photos: [
        { fichier: 'images/araignee-face.webp', legende: 'Face' },
        { fichier: 'images/araignee-dos.webp', legende: 'Dos' },
      ],
      prix: '7 500 XPF',
      prixLancement: '5 000 XPF',
      prixNormal: '',
      mention: '',
    },
    {
      titre: 'Centipede',
      note: 'Javel sur coton noir · face et dos',
      photos: [
        { fichier: 'images/centipede-face.webp', legende: 'Face' },
        { fichier: 'images/centipede-dos.webp', legende: 'Dos' },
      ],
      prix: '7 500 XPF',
      prixLancement: '5 000 XPF',
      prixNormal: '',
      mention: '',
    },
    {
      titre: 'Magma',
      note: 'Javel sur coton noir · effet délavé, face et dos',
      photos: [
        { fichier: 'images/magma-face.webp', legende: 'Face' },
        { fichier: 'images/magma-dos.webp', legende: 'Dos' },
      ],
      prix: '7 500 XPF',
      prixLancement: '5 000 XPF',
      prixNormal: '',
      mention: '',
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
//  Motif dessiné : une colonne de vertèbres hérissée d'épines
// ============================================================
function hasard(graine) {
  let g = graine >>> 0;
  return () => (g = (g * 1664525 + 1013904223) >>> 0) / 4294967296;
}

const f = (n) => n.toFixed(1);

function dessinerColonne(o) {
  const r = hasard(o.graine);
  const phase = r() * Math.PI * 2;
  const point = (t) => [
    o.l * ((o.centre || 0.5) + o.ampleur * Math.sin(t * Math.PI * o.vagues + phase)),
    o.h * (-0.06 + 1.12 * t),
  ];

  let epines = '';
  let os = '';

  for (let i = 0; i < o.nombre; i++) {
    const t = i / (o.nombre - 1);
    const [x, y] = point(t);
    const [x2, y2] = point(t + 0.002);
    const angle = Math.atan2(y2 - y, x2 - x);
    const taille = o.taille * (0.5 + 0.5 * Math.sin(Math.PI * (0.08 + 0.84 * t))) * (0.9 + r() * 0.2);

    // Épines : deux ou trois de chaque côté, couchées vers l'arrière.
    for (const cote of [-1, 1]) {
      const combien = 2 + (r() > 0.55 ? 1 : 0);
      for (let k = 0; k < combien; k++) {
        const direction = angle + cote * (Math.PI / 2 + 0.25 + r() * 0.55) + (k - 1) * 0.28;
        const longueur = taille * (1.6 + r() * 2.2);
        const base = taille * (0.06 + r() * 0.06);
        const bx = x + Math.cos(angle + cote * Math.PI / 2) * taille * 0.42;
        const by = y + Math.sin(angle + cote * Math.PI / 2) * taille * 0.42;
        const px = bx + Math.cos(direction) * longueur;
        const py = by + Math.sin(direction) * longueur;
        const courbe = cote * (0.2 + r() * 0.25) * longueur;
        const cx = (bx + px) / 2 + Math.cos(angle) * courbe;
        const cy = (by + py) / 2 + Math.sin(angle) * courbe;
        const dx = Math.cos(angle) * base;
        const dy = Math.sin(angle) * base;
        epines += `<path d="M${f(bx - dx)} ${f(by - dy)}Q${f(cx - dx * 0.4)} ${f(cy - dy * 0.4)} ${f(px)} ${f(py)}Q${f(cx + dx * 0.4)} ${f(cy + dy * 0.4)} ${f(bx + dx)} ${f(by + dy)}Z"/>`;
      }
    }

    // Vertèbre : une coque blanche, un creux noir, quelques hachures.
    const rx = taille * 0.4;
    const ry = taille * 0.56;
    let hachures = '';
    const traits = 5 + Math.floor(r() * 4);
    for (let k = 0; k < traits; k++) {
      const hx = -rx * 0.5 + (k / traits) * rx * 1.0 + r() * 3;
      hachures += `<line x1="${f(hx)}" y1="${f(-ry * (0.15 + r() * 0.35))}" x2="${f(hx + rx * 0.18)}" y2="${f(ry * (0.1 + r() * 0.4))}"/>`;
    }
    os += `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(angle * 180 / Math.PI)})">`
      + `<ellipse rx="${f(rx)}" ry="${f(ry)}" fill="#f4f4f1"/>`
      + `<ellipse cx="${f(rx * 0.06)}" rx="${f(rx * 0.74)}" ry="${f(ry * 0.72)}" fill="#000"/>`
      + `<g stroke="#f4f4f1" stroke-width="${f(Math.max(1, taille * 0.035))}" stroke-linecap="round">${hachures}</g>`
      + `</g>`;
  }

  return `<g filter="url(#javel)"><g fill="#f4f4f1">${epines}</g>${os}</g>`;
}

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

function visuelProvisoire(index) {
  const motif = dessinerColonne({
    graine: 31 + index * 17, l: 400, h: 500, nombre: 9, taille: 50, ampleur: 0.07 + (index % 3) * 0.03, vagues: 1 + (index % 2) * 0.6,
  });
  return `<svg viewBox="0 0 400 500" role="img" aria-label="Visuel provisoire">`
    + `<path d="M140 60 Q200 104 260 60 L340 95 L385 190 L325 220 L310 185 L310 462 L90 462 L90 185 L75 220 L15 190 L60 95 Z" fill="#050505" stroke="#3a3a3a" stroke-width="1.5"/>`
    + `<g clip-path="url(#forme-tee)"><g transform="translate(200 270) scale(.62) translate(-200 -250)">${motif}</g></g>`
    + `</svg><span class="a-venir">Photo à venir</span>`;
}

// Le prix d'une pièce : prix de lancement pendant l'offre, prix normal sinon.
function baliseprix(piece) {
  if (!piece.prix) return '<strong>Prix sur demande</strong>';
  if (promoActive() && piece.prixLancement) {
    return `<s>${echapper(piece.prix)}</s> <strong>${echapper(piece.prixLancement)}</strong>`
      + '<small>Prix de lancement</small>';
  }
  return (piece.prixNormal ? `<s>${echapper(piece.prixNormal)}</s> ` : '')
    + `<strong>${echapper(piece.prix)}</strong>`
    + (piece.mention ? `<small>${echapper(piece.mention)}</small>` : '');
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
  const photos = REGLAGES.pieces.flatMap((piece) => piece.photos || []);
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
  galerie.innerHTML = REGLAGES.pieces.map((piece, i) => {
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
      <div class="piece-visuel">${visuel}</div>
      <div class="piece-infos">
        <h3>${echapper(piece.titre)}</h3>
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
    if (lien) document.getElementById('piece').value = lien.dataset.piece;

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
const adresseBase = (chemin) => `https://firestore.googleapis.com/v1/projects/${FIREBASE.projet}/databases/(default)/documents${chemin}${chemin.includes('?') ? '&' : '?'}key=${FIREBASE.cle}`;

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
      .map((ligne) => lireChamps(ligne.document.fields))
      .filter((a) => a.titre)
      .sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
    if (!articles.length) return;

    REGLAGES.pieces = articles.map((a) => ({
      titre: a.titre,
      note: a.note || '',
      prix: a.prix || '',
      prixLancement: a.prixLancement || '',
      photos: (a.photos || []).filter((p) => p && (p.fichier || p.photoId)),
    }));
    const choisie = document.getElementById('piece').value;
    poserAccueil();
    poserGalerie();
    poserListes();
    document.getElementById('piece').value = choisie;
    chargerPhotos();
  } catch (erreur) {
    // Base injoignable : on garde les pièces écrites dans ce fichier.
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
    + REGLAGES.pieces.map((p) => option(p.titre, p.prix ? `${p.titre} — ${prixActuel(p.prix, p.prixLancement)}` : p.titre)).join('')
    + option(SUR_MESURE, REGLAGES.prixSurMesure ? `${SUR_MESURE} — ${prixActuel(REGLAGES.prixSurMesure, REGLAGES.prixSurMesureLancement)}` : SUR_MESURE);
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
//  Offre de lancement
// ============================================================
const promoActive = () => Boolean(REGLAGES.promo && REGLAGES.promo.fin)
  && Date.now() < new Date(REGLAGES.promo.fin).getTime();

// Le prix en vigueur aujourd'hui.
const prixActuel = (normal, lancement) => (promoActive() && lancement ? lancement : normal);

function poserPromo() {
  const actif = promoActive();
  document.querySelectorAll('[data-promo]').forEach((el) => {
    el.hidden = !actif;
    if (actif) {
      el.innerHTML = `Offre de lancement · <strong>prix réduits</strong> sur toute commande ${echapper(REGLAGES.promo.finTexte)}`;
    }
  });
}

// ============================================================
//  Formulaire de commande
// ============================================================
function verifier(d) {
  const erreurs = {};
  if (d.nom.length < 2) erreurs.nom = 'Indiquez votre nom.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) erreurs.email = 'Indiquez une adresse e-mail valide.';
  if (!d.piece) erreurs.piece = 'Choisissez une pièce, ou « Motif sur mesure ».';
  if (!d.taille) erreurs.taille = 'Choisissez une taille.';
  if (d.fichier && !/^image\//.test(d.fichier.type)) erreurs.modele = 'Le modèle doit être une image (photo ou dessin).';
  else if (d.fichier && d.fichier.size > 15 * 1024 * 1024) erreurs.modele = 'Cette image est trop lourde (15 Mo au maximum).';
  if (d.piece === SUR_MESURE && d.message.length < 10 && !d.fichier) erreurs.message = 'Décrivez le motif que vous imaginez, ou joignez un modèle.';
  return erreurs;
}

function ecrireMessage(d) {
  return [
    `Nom : ${d.nom}`,
    `E-mail : ${d.email}`,
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
    const echelle = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const toile = document.createElement('canvas');
    toile.width = Math.max(1, Math.round(image.naturalWidth * echelle));
    toile.height = Math.max(1, Math.round(image.naturalHeight * echelle));
    const dessin = toile.getContext('2d');
    dessin.fillStyle = '#fff'; // fond blanc sous les images transparentes
    dessin.fillRect(0, 0, toile.width, toile.height);
    dessin.drawImage(image, 0, 0, toile.width, toile.height);
    return { type: 'image/jpeg', contenu: toile.toDataURL('image/jpeg', 0.85).split(',')[1] };
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
    const { fichier, ...champs } = d;
    const modele = fichier ? await preparerModele(fichier) : undefined;
    const reponse = await fetch(REGLAGES.adresseFormulaire, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ ...champs, modele }),
    });
    if (reponse.ok) return 'Demande envoyée. Vous recevrez une réponse par e-mail.';

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
      nom: brut.nom.trim(), email: brut.email.trim(), piece: brut.piece, taille: brut.taille, message: brut.message.trim(),
      fichier: brut.modele && brut.modele.size ? brut.modele : null,
    };

    // Le prix vu par le client au moment de sa demande, pour que Maya le retrouve.
    const fiche = REGLAGES.pieces.find((p) => p.titre === d.piece) || {};
    const normal = d.piece === SUR_MESURE ? REGLAGES.prixSurMesure : fiche.prix;
    const lancement = d.piece === SUR_MESURE ? REGLAGES.prixSurMesureLancement : fiche.prixLancement;
    if (normal) {
      const actuel = prixActuel(normal, lancement);
      d.prix = actuel + (actuel !== normal ? ` (prix de lancement, prix normal ${normal})` : '');
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
chargerArticles();
