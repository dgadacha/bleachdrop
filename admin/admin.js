// Back-office bleach drop : commandes et articles, rangés dans Firebase.
// Qui a le droit de quoi est décidé par firestore.rules, pas par ce fichier.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, signOut, onAuthStateChanged, connectAuthEmulator,
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js';
import {
  getFirestore, collection, doc, onSnapshot, query, orderBy, limit, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  writeBatch, serverTimestamp, setDoc, connectFirestoreEmulator,
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';

// Configuration publique du projet Firebase (aucun secret ici).
const app = initializeApp({
  apiKey: 'AIzaSyAGG1HBm9Unhi_Y8msKJnOYb10JliiT4Lc',
  authDomain: 'bleachdrop-nc.firebaseapp.com',
  projectId: 'bleachdrop-nc',
  appId: '1:276995987133:web:9c244924451d1b06d2c9d4',
});
const auth = getAuth(app);
const db = getFirestore(app);

// Essais en local : http://localhost:…/admin/?emulateur parle aux émulateurs Firebase.
const EMULATEUR = ['localhost', '127.0.0.1'].includes(location.hostname) && new URLSearchParams(location.search).has('emulateur');
if (EMULATEUR) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8085);
}

// Les trois pièces d'origine du site, pour remplir la base la première fois.
const PIECES_DU_SITE = [
  { titre: 'Spider-Man', note: 'Javel sur coton noir · face et dos', photos: [{ fichier: 'images/araignee-face.webp', legende: 'Face' }, { fichier: 'images/araignee-dos.webp', legende: 'Dos' }] },
  { titre: 'Centipede', note: 'Javel sur coton noir · face et dos', photos: [{ fichier: 'images/centipede-face.webp', legende: 'Face' }, { fichier: 'images/centipede-dos.webp', legende: 'Dos' }] },
  { titre: 'Magma', note: 'Javel sur coton noir · effet délavé, face et dos', photos: [{ fichier: 'images/magma-face.webp', legende: 'Face' }, { fichier: 'images/magma-dos.webp', legende: 'Dos' }] },
].map((piece) => ({ ...piece, prix: '6 000 XPF', visible: true }));

const STATUTS = { nouvelle: 'Nouvelle', acceptee: 'Acceptée', 'en-cours': 'En fabrication', remise: 'Remise', annulee: 'Annulée' };
const PAIEMENTS = ['', 'Espèces', 'Virement', 'Autre'];

const $ = (id) => document.getElementById(id);
const echapper = (texte) => String(texte == null ? '' : texte).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
const xpf = (n) => `${String(Math.round(n || 0)).replace(/\B(?=(\d{3})+$)/g, ' ')} XPF`;
const nombre = (valeur) => (valeur === '' || valeur == null || Number.isNaN(Number(valeur)) ? null : Number(valeur));

// ============================================================
//  Connexion
// ============================================================
function montrer(ecran) {
  ['ecran-connexion', 'ecran-refus', 'ecran-admin'].forEach((id) => { $(id).hidden = id !== ecran; });
}

$('connexion').addEventListener('click', async () => {
  $('message-connexion').textContent = '';
  try {
    if (EMULATEUR) await signInWithEmailAndPassword(auth, 'admin@essai.test', 'essai-local');
    else await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (erreur) {
    if (erreur.code === 'auth/popup-closed-by-user' || erreur.code === 'auth/cancelled-popup-request') return;
    $('message-connexion').textContent = erreur.code === 'auth/operation-not-allowed'
      ? 'La connexion Google n\'est pas encore activée dans Firebase.'
      : `Connexion impossible (${erreur.code || erreur.message}).`;
  }
});
$('deconnexion').addEventListener('click', () => signOut(auth));
$('copier-identifiant').addEventListener('click', async () => {
  await navigator.clipboard.writeText($('identifiant').textContent).catch(() => {});
  $('copier-identifiant').textContent = 'Copié';
});

let arreter = [];
onAuthStateChanged(auth, async (compte) => {
  arreter.forEach((stop) => stop());
  arreter = [];
  $('deconnexion').hidden = !compte;
  if (!compte) { montrer('ecran-connexion'); return; }

  // Le compte est-il autorisé ? On tente une lecture réservée aux admins.
  try {
    await getDocs(query(collection(db, 'commandes'), limit(1)));
  } catch (erreur) {
    $('identifiant').textContent = compte.uid;
    $('compte-refus').textContent = `Compte connecté : ${compte.email || 'inconnu'}`;
    montrer('ecran-refus');
    return;
  }
  montrer('ecran-admin');
  arreter = [ecouterCommandes(), ecouterArticles(), ecouterSurMesure(), ecouterOffres()];
});

// ============================================================
//  Onglets
// ============================================================
document.querySelectorAll('[data-onglet]').forEach((bouton) => bouton.addEventListener('click', () => {
  document.querySelectorAll('[data-onglet]').forEach((b) => b.setAttribute('aria-selected', String(b === bouton)));
  document.querySelectorAll('[data-panneau]').forEach((p) => { p.hidden = p.dataset.panneau !== bouton.dataset.onglet; });
}));
document.querySelectorAll('[data-fermer]').forEach((bouton) => bouton.addEventListener('click', () => bouton.closest('dialog').close('annule')));

// ============================================================
//  Commandes
// ============================================================
let commandes = [];
let dessinEnAttente = false;

function ecouterCommandes() {
  return onSnapshot(query(collection(db, 'commandes'), orderBy('creeLe', 'desc')), (instantane) => {
    commandes = instantane.docs.map((d) => ({ id: d.id, ...d.data() }));
    // On ne redessine pas pendant une saisie : le champ perdrait le curseur.
    if ($('liste-commandes').contains(document.activeElement) && document.activeElement.matches('input, textarea')) {
      dessinEnAttente = true;
    } else {
      dessinerCommandes();
    }
  });
}

function dessinerCommandes() {
  dessinEnAttente = false;
  const comptees = commandes.filter((c) => c.statut !== 'annulee');
  const recettes = comptees.reduce((total, c) => total + (c.prixPaye || 0), 0);
  const depenses = comptees.reduce((total, c) => total + (c.depenses || 0), 0);
  const aRemettre = comptees.filter((c) => c.statut !== 'remise').length;
  const nouvelles = commandes.filter((c) => c.statut === 'nouvelle').length;
  $('pastille-nouvelles').hidden = !nouvelles;
  $('pastille-nouvelles').textContent = nouvelles;
  $('chiffres').innerHTML = [
    ['Commandes', comptees.length], ['À remettre', aRemettre], ['Recettes', xpf(recettes)],
    ['Dépenses', xpf(depenses)], ['Bénéfice', xpf(recettes - depenses)],
  ].map(([nom, valeur]) => `<div><dt>${nom}</dt><dd>${valeur}</dd></div>`).join('');

  const filtre = $('filtre-statut').value;
  const visibles = commandes.filter((c) => {
    if (filtre === 'toutes') return true;
    if (filtre === 'actives') return c.statut !== 'remise' && c.statut !== 'annulee';
    return c.statut === filtre;
  });
  $('liste-commandes').innerHTML = visibles.length ? visibles.map(carteCommande).join('')
    : '<p class="vide">Aucune commande à afficher ici.</p>';
  remplirModeles();
}

// Images jointes par les clients, chargées une seule fois chacune.
const modeles = new Map(); // modeleId -> promesse de l'adresse data:image/…
function sourceModele(id) {
  if (!modeles.has(id)) {
    modeles.set(id, getDoc(doc(db, 'modeles', id))
      .then((d) => (d.exists() ? `data:${d.data().type};base64,${d.data().contenu}` : ''))
      .catch(() => ''));
  }
  return modeles.get(id);
}
function remplirModeles() {
  $('liste-commandes').querySelectorAll('img[data-modele-img]').forEach((img) => {
    sourceModele(img.dataset.modeleImg).then((source) => {
      if (source) img.src = source;
      else img.closest('.vignette').outerHTML = '<span class="etiquette">Modèle joint : voir l\'e-mail</span>';
    });
  });
}

function carteCommande(c) {
  const date = c.creeLe && c.creeLe.toDate ? c.creeLe.toDate().toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : '';
  const contact = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.email || '')
    ? `<a href="mailto:${echapper(c.email)}">${echapper(c.email)}</a>` : echapper(c.email || '');
  // Le téléphone se touche pour appeler depuis un portable.
  const tel = c.telephone ? `<a href="tel:${echapper(c.telephone.replace(/\s/g, ''))}">${echapper(c.telephone)}</a>` : '';
  const choix = (liste, valeur) => liste.map(([v, nom]) => `<option value="${echapper(v)}"${v === (valeur || '') ? ' selected' : ''}>${echapper(nom || '—')}</option>`).join('');
  return `<article class="carte" data-id="${echapper(c.id)}">
    <div class="carte-tete">
      <strong>${echapper(c.nom)}</strong>
      <span>${echapper(c.piece)} · ${echapper(c.taille)}</span>
      ${c.statut === 'nouvelle' ? '<span class="etiquette forte">Nouvelle</span>' : ''}
      ${c.source === 'manuel' ? '<span class="etiquette">À la main</span>' : ''}
      ${c.modeleJoint && !c.modeleId ? '<span class="etiquette">Modèle joint : voir l\'e-mail</span>' : ''}
      <span class="date">${echapper(date)}</span>
    </div>
    <div class="carte-corps">
      ${contact || tel ? `<span>${[contact, tel].filter(Boolean).join(' · ')}</span>` : ''}
      ${c.pays ? `<span class="discret">Pays : ${echapper(c.pays)}</span>` : ''}
      ${c.prix ? `<span class="discret">Prix affiché : ${echapper(c.prix)}</span>` : ''}
      ${c.message ? `<p class="texte">${echapper(c.message)}</p>` : ''}
      ${c.modeleId ? `<button type="button" class="vignette" data-modele="${echapper(c.modeleId)}" aria-label="Agrandir le modèle joint"><img data-modele-img="${echapper(c.modeleId)}" alt="Modèle joint par le client"><span>Modèle joint · agrandir</span></button>` : ''}
    </div>
    <div class="suivi">
      <label>Statut <select data-champ="statut">${choix(Object.entries(STATUTS), c.statut)}</select></label>
      <label>Prix payé (XPF) <input data-champ="prixPaye" type="number" inputmode="numeric" min="0" step="1" value="${c.prixPaye == null ? '' : echapper(c.prixPaye)}"></label>
      <label>Dépenses (XPF) <input data-champ="depenses" type="number" inputmode="numeric" min="0" step="1" value="${c.depenses == null ? '' : echapper(c.depenses)}"></label>
      <label>Paiement <select data-champ="paiement">${choix(PAIEMENTS.map((p) => [p, p]), c.paiement)}</select></label>
      <label class="large">Note pour nous <input data-champ="noteInterne" maxlength="500" value="${echapper(c.noteInterne || '')}"></label>
    </div>
    <div class="carte-pied">
      <span class="enregistre" data-etat></span>
      <button class="lien danger" data-supprimer>Supprimer</button>
    </div>
  </article>`;
}

$('filtre-statut').addEventListener('change', dessinerCommandes);

$('liste-commandes').addEventListener('change', async (e) => {
  const champ = e.target.dataset.champ;
  if (!champ) return;
  const carte = e.target.closest('[data-id]');
  const etat = carte.querySelector('[data-etat]');
  const valeur = ['prixPaye', 'depenses'].includes(champ) ? nombre(e.target.value) : e.target.value;
  const maj = { [champ]: valeur };
  if (champ === 'statut' && valeur === 'remise') maj.remiseLe = serverTimestamp();
  etat.textContent = 'Enregistrement…';
  try {
    await updateDoc(doc(db, 'commandes', carte.dataset.id), maj);
    etat.textContent = 'Enregistré';
  } catch (erreur) {
    etat.textContent = 'Non enregistré. Réessaie.';
  }
});
$('liste-commandes').addEventListener('focusout', () => { if (dessinEnAttente) setTimeout(() => { if (dessinEnAttente && !$('liste-commandes').contains(document.activeElement)) dessinerCommandes(); }, 50); });

$('liste-commandes').addEventListener('click', async (e) => {
  // Vignette du modèle : on l'ouvre en grand.
  const vignette = e.target.closest('[data-modele]');
  if (vignette) {
    const source = await sourceModele(vignette.dataset.modele);
    if (!source) return;
    $('modele-plein').src = source;
    $('telecharger-modele').href = source;
    $('telecharger-modele').download = `modele-${vignette.dataset.modele}.${source.slice(11, source.indexOf(';')) || 'jpg'}`;
    $('fiche-modele').showModal();
    return;
  }

  if (!e.target.matches('[data-supprimer]')) return;
  const carte = e.target.closest('[data-id]');
  const c = commandes.find((x) => x.id === carte.dataset.id);
  if (!confirm(`Supprimer définitivement la commande de ${c ? c.nom : 'ce client'} ?\nPour la garder dans les comptes, passe-la plutôt en « Annulée ».`)) return;
  try {
    await deleteDoc(doc(db, 'commandes', carte.dataset.id));
    // L'image jointe part avec la commande.
    if (c && c.modeleId) await deleteDoc(doc(db, 'modeles', c.modeleId)).catch(() => {});
  } catch (erreur) {
    alert('Suppression impossible.');
  }
});

$('ajouter-commande').addEventListener('click', () => {
  $('formulaire-commande').reset();
  $('message-commande').textContent = '';
  $('noms-articles').innerHTML = [...articles.map((a) => a.titre), 'Motif sur mesure'].map((nom) => `<option value="${echapper(nom)}">`).join('');
  $('fiche-commande').showModal();
});

$('formulaire-commande').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  try {
    await addDoc(collection(db, 'commandes'), {
      nom: f.nom.value.trim(), email: f.email.value.trim(), telephone: f.telephone.value.trim(),
      piece: f.piece.value.trim(), taille: f.taille.value,
      message: f.message.value.trim(), statut: 'acceptee', source: 'manuel', creeLe: serverTimestamp(),
    });
    $('fiche-commande').close();
  } catch (erreur) {
    $('message-commande').textContent = 'La commande n\'a pas pu être ajoutée.';
  }
});

// ============================================================
//  Articles
// ============================================================
let articles = [];
const miniatures = new Map(); // photoId -> promesse de l'image

function sourcePhoto(photo) {
  if (!photo) return Promise.resolve('');
  if (photo.fichier) return Promise.resolve(`/${photo.fichier}`);
  if (!miniatures.has(photo.photoId)) {
    miniatures.set(photo.photoId, getDoc(doc(db, 'photos', photo.photoId)).then((d) => (d.exists() ? d.data().donnees : '')).catch(() => ''));
  }
  return miniatures.get(photo.photoId);
}

// Remplit les <img data-source="n"> d'un conteneur à partir d'une liste de photos.
function remplirImages(conteneur, photos) {
  conteneur.querySelectorAll('img[data-source]').forEach((img) => {
    sourcePhoto(photos[Number(img.dataset.source)]).then((source) => { if (source) img.src = source; });
  });
}

function ecouterArticles() {
  return onSnapshot(query(collection(db, 'articles'), orderBy('ordre')), (instantane) => {
    articles = instantane.docs.map((d) => ({ id: d.id, ...d.data() }));
    dessinerArticles();
  });
}

function dessinerArticles() {
  $('articles-vides').hidden = articles.length > 0;
  $('liste-articles').innerHTML = articles.map((a, n) => `<article class="carte article" data-id="${echapper(a.id)}">
    ${(a.photos || []).length ? '<img data-source="0" alt="">' : '<div class="sans-photo"></div>'}
    <div class="article-infos">
      <strong>${echapper(a.titre)}</strong>
      <span class="discret">${echapper(a.note || '')}</span>
      <span>${echapper(a.prix || 'Prix sur demande')}</span>
      <span><span class="etiquette${a.visible ? ' forte' : ''}">${a.visible ? 'En ligne' : 'Masqué'}</span> <span class="discret">${(a.photos || []).length} photo(s)</span></span>
    </div>
    <div class="article-actions">
      <button class="lien" data-action="modifier">Modifier</button>
      <button class="lien" data-action="visible">${a.visible ? 'Masquer' : 'Mettre en ligne'}</button>
      <button class="lien" data-action="monter"${n === 0 ? ' disabled' : ''}>Monter</button>
      <button class="lien" data-action="descendre"${n === articles.length - 1 ? ' disabled' : ''}>Descendre</button>
      <button class="lien danger pousse" data-action="supprimer">Supprimer</button>
    </div>
  </article>`).join('');
  $('liste-articles').querySelectorAll('[data-id]').forEach((carte) => {
    const a = articles.find((x) => x.id === carte.dataset.id);
    // La miniature montre le dos s'il existe, comme sur le site.
    const photos = [...(a.photos || [])].sort((p, q) => (q.legende === 'Dos') - (p.legende === 'Dos'));
    remplirImages(carte, photos);
  });
  // Les offres citent les articles par leur nom : on les redessine aussi.
  if (typeof dessinerOffres === 'function') dessinerOffres();
}

async function supprimerPhotos(photos) {
  await Promise.all((photos || []).filter((p) => p.photoId).map((p) => deleteDoc(doc(db, 'photos', p.photoId)).catch(() => {})));
}

$('liste-articles').addEventListener('click', async (e) => {
  const action = e.target.dataset.action;
  if (!action) return;
  const index = articles.findIndex((x) => x.id === e.target.closest('[data-id]').dataset.id);
  const a = articles[index];
  if (action === 'modifier') ouvrirArticle(a);
  if (action === 'visible') await updateDoc(doc(db, 'articles', a.id), { visible: !a.visible });
  if (action === 'monter' || action === 'descendre') {
    const voisin = articles[index + (action === 'monter' ? -1 : 1)];
    if (!voisin) return;
    const lot = writeBatch(db);
    lot.update(doc(db, 'articles', a.id), { ordre: voisin.ordre });
    lot.update(doc(db, 'articles', voisin.id), { ordre: a.ordre });
    await lot.commit();
  }
  if (action === 'supprimer') {
    if (!confirm(`Supprimer définitivement l'article « ${a.titre} » et ses photos ?\nPour le retirer du site sans le perdre, utilise plutôt « Masquer ».`)) return;
    await deleteDoc(doc(db, 'articles', a.id));
    await supprimerPhotos(a.photos);
  }
});

$('importer-articles').addEventListener('click', async () => {
  const lot = writeBatch(db);
  PIECES_DU_SITE.forEach((piece, n) => lot.set(doc(collection(db, 'articles')), { ...piece, ordre: n + 1, creeLe: serverTimestamp() }));
  await lot.commit().catch(() => alert('Import impossible.'));
});

// ---------- Motif sur mesure (document reglages/site)
// Valeurs du site tant que rien n'a été enregistré dans la base.
const SUR_MESURE_PAR_DEFAUT = { surMesure: true, prixSurMesure: 'à partir de 7 500 XPF' };
let surMesureModifie = false;

function ecouterSurMesure() {
  const f = $('formulaire-sur-mesure');
  return onSnapshot(doc(db, 'reglages', 'site'), (instantane) => {
    if (surMesureModifie) return; // on n'écrase pas une saisie en cours
    const r = { ...SUR_MESURE_PAR_DEFAUT, ...(instantane.exists() ? instantane.data() : {}) };
    f.surMesure.checked = Boolean(r.surMesure);
    f.prixSurMesure.value = r.prixSurMesure || '';
    if (!instantane.exists()) $('message-sur-mesure').textContent = 'Valeurs actuelles du site, pas encore enregistrées ici.';
  });
}

$('formulaire-sur-mesure').addEventListener('input', () => {
  surMesureModifie = true;
  $('message-sur-mesure').textContent = 'Modifications non enregistrées';
});

$('formulaire-sur-mesure').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const bouton = f.querySelector('[type="submit"]');
  bouton.disabled = true;
  try {
    await setDoc(doc(db, 'reglages', 'site'), {
      surMesure: f.surMesure.checked,
      prixSurMesure: f.prixSurMesure.value.trim(),
    }, { merge: true });
    surMesureModifie = false;
    $('message-sur-mesure').textContent = 'Enregistré. Visible sur le site au prochain chargement.';
  } catch (erreur) {
    $('message-sur-mesure').textContent = 'Non enregistré. Réessaie.';
  } finally {
    bouton.disabled = false;
  }
});

// ---------- Fiche d'un article
let fiche = null; // { id, photos, ajoutees: [photoId], retirees: [photo] }

function ouvrirArticle(article) {
  const f = $('formulaire-article');
  f.reset();
  fiche = { id: article ? article.id : null, photos: article ? (article.photos || []).map((p) => ({ ...p })) : [], ajoutees: [], retirees: [] };
  $('titre-fiche-article').textContent = article ? 'Modifier l\'article' : 'Nouvel article';
  $('message-article').textContent = '';
  f.titre.value = article ? article.titre : '';
  f.note.value = article ? article.note || '' : '';
  f.prix.value = article ? article.prix || '' : '';
  f.visible.checked = article ? Boolean(article.visible) : true;
  dessinerPhotosFiche();
  $('fiche-article').showModal();
}
$('ajouter-article').addEventListener('click', () => ouvrirArticle(null));

function dessinerPhotosFiche() {
  $('photos-article').innerHTML = fiche.photos.length ? fiche.photos.map((p, n) => `<div class="photo">
    <img data-source="${n}" alt="">
    <select data-legende="${n}" aria-label="Légende">${['Face', 'Dos', 'Détail', 'Porté'].map((l) => `<option${l === p.legende ? ' selected' : ''}>${l}</option>`).join('')}</select>
    <button type="button" class="lien danger" data-retirer="${n}">Retirer</button>
  </div>`).join('') : '<p class="discret">Aucune photo pour l\'instant.</p>';
  remplirImages($('photos-article'), fiche.photos);
}

$('photos-article').addEventListener('change', (e) => {
  if (e.target.dataset.legende) fiche.photos[Number(e.target.dataset.legende)].legende = e.target.value;
});
$('photos-article').addEventListener('click', (e) => {
  if (e.target.dataset.retirer == null) return;
  fiche.retirees.push(...fiche.photos.splice(Number(e.target.dataset.retirer), 1));
  dessinerPhotosFiche();
});

// Réduit la photo (1400 px au plus, JPEG) pour tenir dans un document de la base.
async function reduirePhoto(fichier) {
  const adresse = URL.createObjectURL(fichier);
  try {
    const image = await new Promise((ok, ko) => {
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = () => ko(new Error('Cette image n\'a pas pu être lue. Essaie un fichier JPEG ou PNG.'));
      img.src = adresse;
    });
    for (const [cote, qualite] of [[1400, 0.84], [1200, 0.78], [1000, 0.72], [800, 0.66]]) {
      const echelle = Math.min(1, cote / Math.max(image.naturalWidth, image.naturalHeight));
      const toile = document.createElement('canvas');
      toile.width = Math.max(1, Math.round(image.naturalWidth * echelle));
      toile.height = Math.max(1, Math.round(image.naturalHeight * echelle));
      const dessin = toile.getContext('2d');
      dessin.fillStyle = '#000';
      dessin.fillRect(0, 0, toile.width, toile.height);
      dessin.drawImage(image, 0, 0, toile.width, toile.height);
      const donnees = toile.toDataURL('image/jpeg', qualite);
      if (donnees.length < 900000) return donnees; // sous la limite d'un document (1 Mo)
    }
    throw new Error('Cette image est trop lourde, même réduite.');
  } finally {
    URL.revokeObjectURL(adresse);
  }
}

$('ajout-photo').addEventListener('change', async (e) => {
  const fichier = e.target.files[0];
  e.target.value = '';
  if (!fichier) return;
  $('message-article').textContent = 'Envoi de la photo…';
  try {
    const donnees = await reduirePhoto(fichier);
    const ref = await addDoc(collection(db, 'photos'), { donnees, creeLe: serverTimestamp() });
    miniatures.set(ref.id, Promise.resolve(donnees));
    fiche.ajoutees.push(ref.id);
    const prises = fiche.photos.map((p) => p.legende);
    fiche.photos.push({ photoId: ref.id, legende: ['Face', 'Dos', 'Détail', 'Porté'].find((l) => !prises.includes(l)) || 'Détail' });
    dessinerPhotosFiche();
    $('message-article').textContent = '';
  } catch (erreur) {
    $('message-article').textContent = erreur.message || 'La photo n\'a pas pu être envoyée.';
  }
});

$('formulaire-article').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const donnees = {
    titre: f.titre.value.trim(), note: f.note.value.trim(), prix: f.prix.value.trim(),
    visible: f.visible.checked,
    photos: fiche.photos.map((p) => (p.fichier ? { fichier: p.fichier, legende: p.legende || '' } : { photoId: p.photoId, legende: p.legende || '' })),
  };
  if (!donnees.titre) { $('message-article').textContent = 'Donne un nom à l\'article.'; return; }
  try {
    if (fiche.id) {
      await updateDoc(doc(db, 'articles', fiche.id), donnees);
    } else {
      const dernier = articles.reduce((max, a) => Math.max(max, a.ordre || 0), 0);
      await addDoc(collection(db, 'articles'), { ...donnees, ordre: dernier + 1, creeLe: serverTimestamp() });
    }
    await supprimerPhotos(fiche.retirees);
    fiche = null;
    $('fiche-article').close('enregistre');
  } catch (erreur) {
    $('message-article').textContent = 'L\'article n\'a pas pu être enregistré.';
  }
});

// Fiche fermée sans enregistrer : les photos envoyées entre-temps sont retirées de la base.
$('fiche-article').addEventListener('close', () => {
  if (!fiche) return;
  supprimerPhotos(fiche.ajoutees.map((photoId) => ({ photoId })));
  fiche = null;
});

// ============================================================
//  Offres
// ============================================================
// Dates en jours entiers, heure de Nouméa (UTC+11, sans heure d'été), comme sur le site.
const JOUR = 86400000;
const aujourdhui = () => new Date(Date.now() + 11 * 3600000).toISOString().slice(0, 10);
const debutOffre = (o) => Date.parse(`${o.debut}T00:00:00+11:00`);
const finOffre = (o) => Date.parse(`${o.fin}T00:00:00+11:00`) + JOUR;
const dateCourte = (jour) => new Date(`${jour}T12:00:00+11:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Pacific/Noumea' });

function etatOffre(o) {
  if (!o.active) return ['Désactivée', false];
  if (Date.now() < debutOffre(o)) return ['À venir', false];
  if (Date.now() >= finOffre(o)) return ['Terminée', false];
  return ['En cours', true];
}

function cibleOffre(o) {
  const morceaux = [];
  if (o.pieces === 'toutes') morceaux.push('toutes les pièces');
  if (o.pieces === 'choix') {
    const noms = (o.articles || []).map((id) => (articles.find((a) => a.id === id) || {}).titre).filter(Boolean);
    morceaux.push(noms.length ? noms.join(', ') : 'aucune pièce choisie');
  }
  if (o.surMesure) morceaux.push('motif sur mesure');
  return morceaux.join(' + ') || 'rien';
}

// Même calcul que le site : arrondi à 100 XPF.
const reduire = (montant, pourcentage) => Math.round((montant * (100 - pourcentage)) / 100 / 100) * 100;

let offres = [];

function ecouterOffres() {
  return onSnapshot(query(collection(db, 'offres'), orderBy('debut', 'desc')), (instantane) => {
    offres = instantane.docs.map((d) => ({ id: d.id, ...d.data() }));
    dessinerOffres();
  });
}

function dessinerOffres() {
  $('offres-vides').hidden = offres.length > 0;
  $('liste-offres').innerHTML = offres.map((o) => {
    const [etat, enCours] = etatOffre(o);
    return `<article class="carte offre" data-id="${echapper(o.id)}">
      <div class="offre-tete">
        <strong>${echapper(o.nom)}</strong>
        <span class="etiquette${enCours ? ' forte' : ''}">${etat}</span>
        <span class="taux">−${echapper(o.reduction)} %</span>
      </div>
      <span>Du ${echapper(dateCourte(o.debut))} au ${echapper(dateCourte(o.fin))}</span>
      <span class="discret">Sur : ${echapper(cibleOffre(o))}</span>
      <div class="article-actions">
        <button class="lien" data-action="modifier">Modifier</button>
        <button class="lien" data-action="active">${o.active ? 'Désactiver' : 'Activer'}</button>
        <button class="lien danger pousse" data-action="supprimer">Supprimer</button>
      </div>
    </article>`;
  }).join('');
}

$('liste-offres').addEventListener('click', async (e) => {
  const action = e.target.dataset.action;
  if (!action) return;
  const o = offres.find((x) => x.id === e.target.closest('[data-id]').dataset.id);
  if (action === 'modifier') ouvrirOffre(o);
  if (action === 'active') await updateDoc(doc(db, 'offres', o.id), { active: !o.active }).catch(() => alert('Modification impossible.'));
  if (action === 'supprimer') {
    if (!confirm(`Supprimer définitivement l'offre « ${o.nom} » ?\nPour l'arrêter sans la perdre, utilise plutôt « Désactiver ».`)) return;
    await deleteDoc(doc(db, 'offres', o.id)).catch(() => alert('Suppression impossible.'));
  }
});

// Recrée l'offre de lancement telle qu'elle était sur le site avant cet écran.
$('recreer-lancement').addEventListener('click', async () => {
  const commun = { nom: 'Offre de lancement', debut: aujourdhui(), fin: '2026-12-24', articles: [], active: true, creeLe: serverTimestamp() };
  const lot = writeBatch(db);
  lot.set(doc(collection(db, 'offres')), { ...commun, reduction: 33, pieces: 'toutes', surMesure: false });
  lot.set(doc(collection(db, 'offres')), { ...commun, reduction: 27, pieces: 'aucune', surMesure: true });
  await lot.commit().catch(() => alert('Création impossible.'));
});

// ---------- Fiche d'une offre
let offreOuverte = null;

function ouvrirOffre(o) {
  const f = $('formulaire-offre');
  f.reset();
  offreOuverte = o ? o.id : null;
  $('titre-fiche-offre').textContent = o ? 'Modifier l\'offre' : 'Nouvelle offre';
  $('message-offre').textContent = '';
  f.nom.value = o ? o.nom : '';
  f.debut.value = o ? o.debut : aujourdhui();
  f.fin.value = o ? o.fin : '';
  f.reduction.value = o ? o.reduction : '';
  f.pieces.value = o ? o.pieces || 'toutes' : 'toutes';
  f.surMesure.checked = o ? Boolean(o.surMesure) : false;
  f.active.checked = o ? Boolean(o.active) : true;
  const choisis = o ? o.articles || [] : [];
  $('choix-articles').innerHTML = articles.length
    ? articles.map((a) => `<label class="case"><input type="checkbox" name="article" value="${echapper(a.id)}"${choisis.includes(a.id) ? ' checked' : ''}> ${echapper(a.titre)}${a.visible ? '' : ' <span class="discret">(masqué)</span>'}</label>`).join('')
    : '<p class="discret">Aucun article dans la base.</p>';
  majFicheOffre();
  $('fiche-offre').showModal();
}
$('ajouter-offre').addEventListener('click', () => ouvrirOffre(null));

// Les cases des pièces ne servent que pour « Certaines pièces » ; l'exemple montre l'effet du pourcentage.
function majFicheOffre() {
  const f = $('formulaire-offre');
  const choix = f.pieces.value === 'choix';
  $('choix-articles').hidden = !choix;
  const taux = Number(f.reduction.value);
  $('exemple-offre').textContent = taux >= 1 && taux <= 90
    ? `Exemple : 6 000 XPF deviennent ${reduire(6000, taux).toLocaleString('fr-FR')} XPF (arrondi à 100 XPF).`
    : '';
}
$('formulaire-offre').addEventListener('input', majFicheOffre);
$('formulaire-offre').addEventListener('change', majFicheOffre);

$('formulaire-offre').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const reduction = Number(f.reduction.value);
  const articlesChoisis = [...f.querySelectorAll('input[name="article"]:checked')].map((c) => c.value);
  const message = (texte) => { $('message-offre').textContent = texte; };
  if (!f.nom.value.trim()) return message('Donne un nom à l\'offre.');
  if (!f.debut.value || !f.fin.value) return message('Indique les deux dates.');
  if (f.fin.value < f.debut.value) return message('La date de fin doit venir après la date de début.');
  if (!Number.isInteger(reduction) || reduction < 1 || reduction > 90) return message('La réduction doit être un nombre entier entre 1 et 90.');
  if (f.pieces.value === 'choix' && !articlesChoisis.length) return message('Coche au moins une pièce, ou choisis une autre option.');
  if (f.pieces.value === 'aucune' && !f.surMesure.checked) return message('L\'offre ne s\'applique à rien : choisis des pièces ou le motif sur mesure.');

  const donnees = {
    nom: f.nom.value.trim(), debut: f.debut.value, fin: f.fin.value, reduction,
    pieces: f.pieces.value, articles: f.pieces.value === 'choix' ? articlesChoisis : [],
    surMesure: f.surMesure.checked, active: f.active.checked,
  };
  try {
    if (offreOuverte) await updateDoc(doc(db, 'offres', offreOuverte), donnees);
    else await addDoc(collection(db, 'offres'), { ...donnees, creeLe: serverTimestamp() });
    $('fiche-offre').close('enregistre');
  } catch (erreur) {
    message('L\'offre n\'a pas pu être enregistrée.');
  }
});
