// Back-office bleach drop : commandes et articles, rangés dans Firebase.
// Qui a le droit de quoi est décidé par firestore.rules, pas par ce fichier.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, signOut, onAuthStateChanged, connectAuthEmulator,
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js';
import {
  getFirestore, collection, doc, onSnapshot, query, orderBy, limit, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  writeBatch, serverTimestamp, setDoc, arrayUnion, Timestamp, connectFirestoreEmulator,
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';
import { brancherStencil } from './stencil.js';

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
const stencil = brancherStencil(db);

// Les trois pièces d'origine du site, pour remplir la base la première fois.
const PIECES_DU_SITE = [
  { titre: 'Spider-Man', note: 'Javel sur coton noir · face et dos', photos: [{ fichier: 'images/araignee-face.webp', legende: 'Face' }, { fichier: 'images/araignee-dos.webp', legende: 'Dos' }] },
  { titre: 'Centipede', note: 'Javel sur coton noir · face et dos', photos: [{ fichier: 'images/centipede-face.webp', legende: 'Face' }, { fichier: 'images/centipede-dos.webp', legende: 'Dos' }] },
  { titre: 'Magma', note: 'Javel sur coton noir · effet délavé, face et dos', photos: [{ fichier: 'images/magma-face.webp', legende: 'Face' }, { fichier: 'images/magma-dos.webp', legende: 'Dos' }] },
].map((piece) => ({ ...piece, prix: '6 000 XPF', visible: true }));

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
  stencil.arreter();
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
  arreter = [ecouterCommandes(), ecouterArticles(), ecouterCollections(), ecouterSurMesure(), ecouterOffres(), ecouterCodes()];
  // Les pochoirs pèsent lourd : chargés seulement quand on ouvre l'onglet.
  if (document.querySelector('[data-onglet="stencil"]').getAttribute('aria-selected') === 'true') stencil.ouvrir();
});

// ============================================================
//  Onglets
// ============================================================
document.querySelectorAll('[data-onglet]').forEach((bouton) => bouton.addEventListener('click', () => {
  document.querySelectorAll('[data-onglet]').forEach((b) => b.setAttribute('aria-selected', String(b === bouton)));
  document.querySelectorAll('[data-panneau]').forEach((p) => { p.hidden = p.dataset.panneau !== bouton.dataset.onglet; });
  if (bouton.dataset.onglet === 'stencil') stencil.ouvrir();
}));
document.querySelectorAll('[data-fermer]').forEach((bouton) => bouton.addEventListener('click', () => bouton.closest('dialog').close('annule')));

// ============================================================
//  Commandes
// ============================================================
// Le parcours d'une commande, dans l'ordre. `suivante` donne le bouton « étape suivante ».
const ETAPES = [
  { id: 'nouvelle', nom: 'À répondre', court: 'Nouvelle', suivante: 'Je lui ai répondu' },
  { id: 'repondu', nom: 'En attente du client', court: 'Répondu', suivante: 'Le client a validé' },
  { id: 'validee', nom: 'Validées', court: 'Validée', suivante: 'Commencer la réalisation' },
  { id: 'realisation', nom: 'En réalisation', court: 'En réalisation', suivante: 'Pièce prête' },
  { id: 'prete', nom: 'Prêtes à remettre', court: 'Prête', suivante: 'Remise au client' },
  { id: 'remise', nom: 'Remises', court: 'Remise' },
  { id: 'annulee', nom: 'Annulées', court: 'Annulée' },
];
const ETAPE = Object.fromEntries(ETAPES.map((e, n) => [e.id, { ...e, rang: n }]));
// Anciens statuts, d'avant ce parcours.
const ANCIENS = { acceptee: 'validee', 'en-cours': 'realisation' };
const etapeDe = (c) => ETAPE[ANCIENS[c.statut] || c.statut] || ETAPE.nouvelle;
const EN_COURS = ['nouvelle', 'repondu', 'validee', 'realisation', 'prete'];

let commandes = [];
let dessinEnAttente = false;
let filtreCommandes = 'en-cours';

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

const jours = (date) => Math.floor((Date.now() - date.getTime()) / 86400000);
const dateCourteFr = (t) => (t && t.toDate ? t.toDate().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '');

function dessinerCommandes() {
  dessinEnAttente = false;
  const compte = (id) => commandes.filter((c) => etapeDe(c).id === id).length;
  const actives = commandes.filter((c) => EN_COURS.includes(etapeDe(c).id));

  // Chiffres : ce qui est encaissé (remises) et ce qui reste à encaisser (validées, en cours, prêtes).
  const somme = (liste, champ) => liste.reduce((total, c) => total + (c[champ] || 0), 0);
  const remises = commandes.filter((c) => etapeDe(c).id === 'remise');
  const aEncaisser = commandes.filter((c) => ['validee', 'realisation', 'prete'].includes(etapeDe(c).id));
  const nonAnnulees = commandes.filter((c) => etapeDe(c).id !== 'annulee');
  const encaisse = somme(remises, 'prixPaye');
  $('chiffres').innerHTML = [
    ['À répondre', compte('nouvelle')], ['En cours', actives.length], ['Encaissé', xpf(encaisse)],
    ['À encaisser', xpf(somme(aEncaisser, 'prixPaye'))], ['Dépenses', xpf(somme(nonAnnulees, 'depenses'))],
    ['Bénéfice', xpf(encaisse - somme(remises, 'depenses'))],
  ].map(([nom, valeur]) => `<div><dt>${nom}</dt><dd>${valeur}</dd></div>`).join('');

  $('pastille-nouvelles').hidden = !compte('nouvelle');
  $('pastille-nouvelles').textContent = compte('nouvelle');

  // Les filtres par étape, avec leur nombre.
  const filtres = [['en-cours', 'En cours', actives.length], ...ETAPES.map((e) => [e.id, e.nom, compte(e.id)]), ['toutes', 'Toutes', commandes.length]];
  $('filtres-commandes').innerHTML = filtres.map(([id, nom, n]) => `<button type="button" class="filtre${id === filtreCommandes ? ' actif' : ''}" data-filtre="${id}" aria-pressed="${id === filtreCommandes}">${echapper(nom)} <span>${n}</span></button>`).join('');

  const visibles = commandes.filter((c) => {
    if (filtreCommandes === 'toutes') return true;
    if (filtreCommandes === 'en-cours') return EN_COURS.includes(etapeDe(c).id);
    return etapeDe(c).id === filtreCommandes;
  });
  // En cours : les plus urgentes d'abord (à répondre, puis en attente…), puis les plus anciennes.
  if (filtreCommandes === 'en-cours') {
    visibles.sort((a, b) => (etapeDe(a).rang - etapeDe(b).rang) || ((a.creeLe?.seconds || 0) - (b.creeLe?.seconds || 0)));
  }
  $('liste-commandes').innerHTML = visibles.length ? visibles.map(carteCommande).join('')
    : '<p class="vide">Aucune commande à cette étape.</p>';
  remplirModeles();
  if (typeof dessinerCodes === 'function' && typeof codes !== 'undefined') dessinerCodes();
}

$('filtres-commandes').addEventListener('click', (e) => {
  const bouton = e.target.closest('[data-filtre]');
  if (!bouton) return;
  filtreCommandes = bouton.dataset.filtre;
  dessinerCommandes();
});

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

// Le fil des étapes déjà passées, avec leur date.
function filEtapes(c) {
  const passages = [['Reçue', c.creeLe], ...(c.historique || []).map((h) => [(ETAPE[h.statut] || {}).court || h.statut, h.le])];
  return passages.filter(([, le]) => le).map(([nom, le]) => `<li><span>${echapper(nom)}</span> ${echapper(dateCourteFr(le))}</li>`).join('');
}

function carteCommande(c) {
  const etape = etapeDe(c);
  const date = c.creeLe && c.creeLe.toDate ? c.creeLe.toDate().toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : '';
  const contact = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.email || '')
    ? `<a href="mailto:${echapper(c.email)}">${echapper(c.email)}</a>` : echapper(c.email || '');
  // Le téléphone se touche pour appeler depuis un portable.
  const tel = c.telephone ? `<a href="tel:${echapper(c.telephone.replace(/\s/g, ''))}">${echapper(c.telephone)}</a>` : '';
  const choix = (liste, valeur) => liste.map(([v, nom]) => `<option value="${echapper(v)}"${v === (valeur || '') ? ' selected' : ''}>${echapper(nom || '—')}</option>`).join('');

  // Depuis combien de temps la commande attend à cette étape.
  const dernier = (c.historique || []).slice(-1)[0];
  const depuis = dernier && dernier.le && dernier.le.toDate ? jours(dernier.le.toDate()) : (c.creeLe && c.creeLe.toDate ? jours(c.creeLe.toDate()) : 0);
  let alerte = '';
  if (etape.id === 'nouvelle' && depuis >= 1) alerte = `Sans réponse depuis ${depuis} jour${depuis > 1 ? 's' : ''}`;
  if (etape.id === 'repondu' && depuis >= 3) alerte = `Client sans nouvelles depuis ${depuis} jours : relancer ?`;
  if (c.remisePrevue && ['validee', 'realisation', 'prete'].includes(etape.id) && c.remisePrevue < new Date(Date.now() + 11 * 3600000).toISOString().slice(0, 10)) alerte = 'Date de remise dépassée';

  const emailValable = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.email || '');
  // Le même client a-t-il déjà utilisé ce code sur une commande plus ancienne ?
  const dejaUtilise = c.code && commandes.find((x) => x.id !== c.id && x.code === c.code
    && String(x.email || '').toLowerCase() === String(c.email || '').toLowerCase()
    && etapeDe(x).id !== 'annulee' && (x.creeLe?.seconds || 0) < (c.creeLe?.seconds || 0));
  const reponses = (c.reponses || []).map((r) => `<li>Réponse envoyée le ${echapper(dateCourteFr(r.le))} : ${echapper(xpf(r.prix))} · ${echapper(r.delai)}</li>`).join('');
  return `<article class="carte etape-${etape.id}" data-id="${echapper(c.id)}">
    <div class="carte-tete">
      <span class="etiquette${['nouvelle', 'prete'].includes(etape.id) ? ' forte' : ''}">${echapper(etape.court)}</span>
      <strong>${echapper(c.nom)}</strong>
      <span>${echapper(c.piece)} · ${echapper(c.taille)}</span>
      ${c.source === 'manuel' ? '<span class="etiquette">À la main</span>' : ''}
      ${c.code ? `<span class="etiquette">Code ${echapper(c.code)} −${echapper(c.codeReduction)} %</span>` : ''}
      ${c.modeleJoint && !c.modeleId ? '<span class="etiquette">Modèle joint : voir l\'e-mail</span>' : ''}
      <span class="date">${echapper(date)}</span>
    </div>
    ${alerte ? `<p class="alerte">${echapper(alerte)}</p>` : ''}
    ${dejaUtilise ? `<p class="alerte">Ce client a déjà utilisé le code ${echapper(c.code)} (commande du ${echapper(dateCourteFr(dejaUtilise.creeLe))})</p>` : ''}
    <ol class="fil">${filEtapes(c)}</ol>
    <div class="carte-corps">
      ${contact || tel ? `<span>${[contact, tel].filter(Boolean).join(' · ')}</span>` : ''}
      ${c.pays ? `<span class="discret">Pays : ${echapper(c.pays)}</span>` : ''}
      ${c.prix ? `<span class="discret">Prix affiché : ${echapper(c.prix)}</span>` : ''}
      ${c.message ? `<p class="texte">${echapper(c.message)}</p>` : ''}
      ${reponses ? `<ul class="reponses">${reponses}</ul>` : ''}
      ${c.modeleId ? `<button type="button" class="vignette" data-modele="${echapper(c.modeleId)}" aria-label="Agrandir le modèle joint"><img data-modele-img="${echapper(c.modeleId)}" alt="Modèle joint par le client"><span>Modèle joint · agrandir</span></button>` : ''}
    </div>
    <div class="actions-commande">
      ${etape.suivante ? `<button type="button" class="bouton bouton-plein" data-avancer>${echapper(etape.suivante)}</button>` : ''}
      ${emailValable && ['nouvelle', 'repondu'].includes(etape.id) ? `<button type="button" class="bouton" data-repondre>${c.reponses && c.reponses.length ? 'Envoyer une autre réponse' : 'Répondre au client'}</button>` : ''}
      ${EN_COURS.includes(etape.id) ? '<button type="button" class="lien danger" data-annuler>Annuler la commande</button>' : ''}
    </div>
    <div class="suivi">
      <label>Étape <select data-champ="statut">${choix(ETAPES.map((e) => [e.id, e.court]), etape.id)}</select></label>
      <label>Prix convenu (XPF) <input data-champ="prixPaye" type="number" inputmode="numeric" min="0" step="1" value="${c.prixPaye == null ? '' : echapper(c.prixPaye)}"></label>
      <label>Remise prévue <input data-champ="remisePrevue" type="date" value="${echapper(c.remisePrevue || '')}"></label>
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

// Change l'étape d'une commande et garde la trace du passage, avec la date.
async function changerEtape(id, statut, etat) {
  const maj = { statut, historique: arrayUnion({ statut, le: Timestamp.now() }) };
  if (statut === 'remise') maj.remiseLe = serverTimestamp();
  if (etat) etat.textContent = 'Enregistrement…';
  try {
    await updateDoc(doc(db, 'commandes', id), maj);
    if (etat) etat.textContent = 'Enregistré';
  } catch (erreur) {
    if (etat) etat.textContent = 'Non enregistré. Réessaie.';
    else alert('Modification impossible.');
  }
}

$('liste-commandes').addEventListener('change', async (e) => {
  const champ = e.target.dataset.champ;
  if (!champ) return;
  const carte = e.target.closest('[data-id]');
  const etat = carte.querySelector('[data-etat]');
  if (champ === 'statut') { await changerEtape(carte.dataset.id, e.target.value, etat); return; }
  const valeur = ['prixPaye', 'depenses'].includes(champ) ? nombre(e.target.value) : e.target.value;
  etat.textContent = 'Enregistrement…';
  try {
    await updateDoc(doc(db, 'commandes', carte.dataset.id), { [champ]: valeur });
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

  const carte = e.target.closest('[data-id]');
  if (!carte) return;
  const c = commandes.find((x) => x.id === carte.dataset.id);

  // Bouton « étape suivante ».
  if (e.target.matches('[data-avancer]')) {
    const suivante = ETAPES[etapeDe(c).rang + 1];
    if (suivante && suivante.id !== 'annulee') await changerEtape(c.id, suivante.id, carte.querySelector('[data-etat]'));
    return;
  }
  if (e.target.matches('[data-repondre]')) { ouvrirReponse(c); return; }
  if (e.target.matches('[data-annuler]')) {
    if (confirm(`Annuler la commande de ${c.nom} ?\nElle reste visible dans « Annulées ».`)) await changerEtape(c.id, 'annulee', carte.querySelector('[data-etat]'));
    return;
  }

  if (!e.target.matches('[data-supprimer]')) return;
  if (!confirm(`Supprimer définitivement la commande de ${c ? c.nom : 'ce client'} ?\nPour la garder dans les comptes, passe-la plutôt en « Annulée ».`)) return;
  try {
    await deleteDoc(doc(db, 'commandes', carte.dataset.id));
    // L'image jointe part avec la commande.
    if (c && c.modeleId) await deleteDoc(doc(db, 'modeles', c.modeleId)).catch(() => {});
  } catch (erreur) {
    alert('Suppression impossible.');
  }
});

// ---------- Réponse au client
let commandeEnReponse = null;

function ouvrirReponse(c) {
  const f = $('formulaire-reponse');
  f.reset();
  commandeEnReponse = c;
  const derniere = (c.reponses || []).slice(-1)[0] || {};
  const prixAffiche = parseInt(String(c.prix || '').split('(')[0].replace(/\D/g, ''), 10);
  f.prix.value = c.prixPaye != null ? c.prixPaye : (derniere.prix != null ? derniere.prix : (Number.isNaN(prixAffiche) ? '' : prixAffiche));
  f.delai.value = derniere.delai || '';
  f.remise.value = derniere.remise || 'En main propre à Nouméa, on convient du lieu ensemble';
  $('destinataire-reponse').textContent = `À ${c.nom} · ${c.email} · ${c.piece}, taille ${c.taille}`;
  $('message-reponse').textContent = '';
  $('fiche-reponse').showModal();
}

$('formulaire-reponse').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const c = commandeEnReponse;
  const bouton = f.querySelector('[type="submit"]');
  const proposition = { prix: Number(f.prix.value), delai: f.delai.value.trim(), remise: f.remise.value.trim(), message: f.message.value.trim() };
  if (!Number.isInteger(proposition.prix) || proposition.prix < 0) { $('message-reponse').textContent = 'Indique un prix en nombre entier.'; return; }
  if (!proposition.delai) { $('message-reponse').textContent = 'Indique un délai.'; return; }
  bouton.disabled = true;
  $('message-reponse').textContent = 'Envoi…';
  try {
    const jeton = await auth.currentUser.getIdToken();
    const reponse = await fetch('/api/repondre', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jeton}` },
      body: JSON.stringify({ nom: c.nom, email: c.email, piece: c.piece, taille: c.taille, ...proposition }),
    });
    const resultat = await reponse.json().catch(() => ({}));
    if (!reponse.ok) throw new Error(resultat.erreur || `L'e-mail n'est pas parti (${reponse.status}).`);
  } catch (erreur) {
    $('message-reponse').textContent = erreur instanceof TypeError ? 'Envoi impossible. Vérifie ta connexion.' : erreur.message;
    bouton.disabled = false;
    return;
  }

  // L'e-mail est parti : on garde la trace dans la commande.
  const maj = { prixPaye: proposition.prix, reponses: arrayUnion({ ...proposition, le: Timestamp.now() }) };
  if (etapeDe(c).id === 'nouvelle') {
    maj.statut = 'repondu';
    maj.historique = arrayUnion({ statut: 'repondu', le: Timestamp.now() });
  }
  try {
    await updateDoc(doc(db, 'commandes', c.id), maj);
    $('fiche-reponse').close('envoye');
  } catch (erreur) {
    $('message-reponse').textContent = 'E-mail envoyé, mais la commande n\'a pas pu être mise à jour : change l\'étape à la main.';
  } finally {
    bouton.disabled = false;
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
    // Une commande saisie à la main est déjà convenue avec le client.
    await addDoc(collection(db, 'commandes'), {
      nom: f.nom.value.trim(), email: f.email.value.trim(), telephone: f.telephone.value.trim(),
      piece: f.piece.value.trim(), taille: f.taille.value,
      message: f.message.value.trim(), statut: 'validee', source: 'manuel', creeLe: serverTimestamp(),
      historique: [{ statut: 'validee', le: Timestamp.now() }],
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
      <span><span class="etiquette${a.visible ? ' forte' : ''}">${a.visible ? 'En ligne' : 'Masqué'}</span>${nomCollection(a.collection) ? ` <span class="etiquette nom-drop">${echapper(nomCollection(a.collection))}</span>` : ''} <span class="discret">${(a.photos || []).length} photo(s)</span></span>
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
  // Les offres et les collections citent les articles par leur nom : on les redessine aussi.
  if (typeof dessinerOffres === 'function') dessinerOffres();
  if (typeof dessinerCollections === 'function') dessinerCollections();
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
  f.collection.innerHTML = `<option value="">Aucune : toujours en vente</option>${collections.map((c) => `<option value="${echapper(c.id)}">${echapper(c.nom)}</option>`).join('')}`;
  f.collection.value = article && collections.some((c) => c.id === article.collection) ? article.collection : '';
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
    collection: f.collection.value,
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
//  Collections
// ============================================================
// Limitée : en vente du lancement à la fin (dates et heures de Nouméa,
// 'AAAA-MM-JJTHH:MM'). Avant, ses pièces sont cachées et la prochaine affiche
// un décompte sur le site. Permanente : toujours en vente, sans dates.
let collections = [];
const momentNC = (texte) => (texte ? Date.parse(`${texte}:00+11:00`) : NaN);
const dateHeure = (texte) => new Date(momentNC(texte)).toLocaleString('fr-FR', {
  weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Pacific/Noumea',
});
const nomCollection = (id) => (id ? (collections.find((c) => c.id === id) || {}).nom || '' : '');
// Tri naturel : DROP 2 avant DROP 10.
const parNom = (a, b) => String(a.nom).localeCompare(String(b.nom), 'fr', { numeric: true });

function delaiEnClair(ms) {
  const minutes = Math.max(1, Math.round(ms / 60000));
  const j = Math.floor(minutes / 1440); const h = Math.floor((minutes % 1440) / 60); const m = minutes % 60;
  if (j) return `${j} j ${h} h`;
  if (h) return `${h} h ${String(m).padStart(2, '0')}`;
  return `${m} min`;
}

function etatCollection(c) {
  if (c.type === 'permanente') return c.visible ? ['Permanente', 'permanente'] : ['Masquée', 'masquee'];
  if (!c.visible) return ['Masquée', 'masquee'];
  const maintenant = Date.now();
  if (maintenant < momentNC(c.debut)) return ['À venir', 'avenir'];
  if (maintenant >= momentNC(c.fin)) return ['Terminée', 'fin'];
  return ['En cours', 'encours'];
}

// La seule collection dont le site affiche le décompte : la prochaine limitée programmée.
function prochaineCollection() {
  return collections.filter((c) => etatCollection(c)[1] === 'avenir').sort((a, b) => momentNC(a.debut) - momentNC(b.debut))[0];
}

function ecouterCollections() {
  return onSnapshot(collection(db, 'collections'), (instantane) => {
    collections = instantane.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => {
      // Limitées d'abord, de la plus récente à la plus ancienne ; puis les permanentes par nom.
      if ((a.type === 'permanente') !== (b.type === 'permanente')) return a.type === 'permanente' ? 1 : -1;
      return a.type === 'permanente' ? parNom(a, b) : momentNC(b.debut) - momentNC(a.debut);
    });
    dessinerArticles();
  });
}

function dessinerCollections() {
  if (!$('liste-collections')) return;
  $('collections-vides').hidden = collections.length > 0;
  const prochaine = prochaineCollection();
  $('liste-collections').innerHTML = collections.map((c) => {
    const [etat, cle] = etatCollection(c);
    const pieces = articles.filter((a) => a.collection === c.id);
    const masquees = pieces.filter((a) => !a.visible).length;
    let quand = '';
    if (c.type !== 'permanente') {
      quand = `Du ${dateHeure(c.debut)} au ${dateHeure(c.fin)}`;
      if (cle === 'avenir') quand += ` · lancement dans ${delaiEnClair(momentNC(c.debut) - Date.now())}`;
      if (cle === 'encours') quand += ` · fin dans ${delaiEnClair(momentNC(c.fin) - Date.now())}`;
    }
    const remarques = [];
    if (prochaine && prochaine.id === c.id) remarques.push('Le site affiche son décompte de lancement.');
    else if (cle === 'avenir') remarques.push('Programmée après une autre : son décompte s\'affichera quand son tour viendra.');
    if (masquees) remarques.push(`${masquees} pièce${masquees > 1 ? 's sont masquées' : ' est masquée'} (onglet Articles) : elle${masquees > 1 ? 's' : ''} n'apparaîtr${masquees > 1 ? 'ont' : 'a'} pas sur le site.`);
    return `<article class="carte offre" data-collection="${echapper(c.id)}">
      <div class="offre-tete">
        <strong class="nom-collection">${echapper(c.nom)}</strong>
        <span class="etiquette${['encours', 'permanente'].includes(cle) || (prochaine && prochaine.id === c.id) ? ' forte' : ''}">${etat}</span>
        ${c.type === 'permanente' ? '' : '<span class="discret">Limitée</span>'}
      </div>
      ${c.description ? `<span class="discret">${echapper(c.description)}</span>` : ''}
      ${quand ? `<span>${echapper(quand)}</span>` : ''}
      <span>${pieces.length ? `${pieces.length} pièce${pieces.length > 1 ? 's' : ''} : ${pieces.map((a) => echapper(a.titre)).join(', ')}` : 'Aucune pièce pour l\'instant'}</span>
      ${remarques.map((r) => `<span class="discret">${echapper(r)}</span>`).join('')}
      <div class="article-actions">
        <button class="lien" data-action-collection="modifier">Modifier</button>
        <button class="lien" data-action-collection="visible">${c.visible ? 'Masquer' : 'Afficher sur le site'}</button>
        <button class="lien danger pousse" data-action-collection="supprimer">Supprimer</button>
      </div>
    </article>`;
  }).join('');
}

$('liste-collections').addEventListener('click', async (e) => {
  const action = e.target.dataset.actionCollection;
  if (!action) return;
  const c = collections.find((x) => x.id === e.target.closest('[data-collection]').dataset.collection);
  if (!c) return;
  if (action === 'modifier') ouvrirCollection(c);
  if (action === 'visible') await updateDoc(doc(db, 'collections', c.id), { visible: !c.visible }).catch(() => alert('Modification impossible.'));
  if (action === 'supprimer') {
    const pieces = articles.filter((a) => a.collection === c.id);
    if (!confirm(`Supprimer la collection ${c.nom} ?${pieces.length ? `\nSes ${pieces.length} pièce(s) restent dans Articles, hors collection : en ligne, elles seront toujours en vente.` : ''}`)) return;
    const lot = writeBatch(db);
    lot.delete(doc(db, 'collections', c.id));
    pieces.forEach((a) => lot.update(doc(db, 'articles', a.id), { collection: '' }));
    await lot.commit().catch(() => alert('Suppression impossible.'));
  }
});

// ---------- Fiche d'une collection
let collectionOuverte = null;

// « DROP 003 » si la dernière s'appelle « DROP 002 ».
function prochainNom() {
  const numeros = collections.map((c) => (String(c.nom).match(/drop\s*0*(\d+)/i) || [])[1]).filter(Boolean).map(Number);
  return `DROP ${String((numeros.length ? Math.max(...numeros) : 0) + 1).padStart(3, '0')}`;
}

// 'AAAA-MM-JJTHH:MM' à l'heure de Nouméa, dans `jours` jours à `heure` h.
function momentDans(jours, heure) {
  const date = new Date(Date.now() + 11 * 3600000 + jours * JOUR).toISOString().slice(0, 10);
  return `${date}T${String(heure).padStart(2, '0')}:00`;
}

function majTypeCollection() {
  const f = $('formulaire-collection');
  const limitee = f.type.value !== 'permanente';
  $('dates-collection').hidden = !limitee;
  $('aide-dates-collection').hidden = !limitee;
}
$('formulaire-collection').addEventListener('change', (e) => { if (e.target.name === 'type') majTypeCollection(); });

function ouvrirCollection(c) {
  const f = $('formulaire-collection');
  f.reset();
  collectionOuverte = c ? c.id : null;
  $('titre-fiche-collection').textContent = c ? `Modifier ${c.nom}` : 'Nouvelle collection';
  $('message-collection').textContent = '';
  f.nom.value = c ? c.nom : prochainNom();
  f.description.value = c ? c.description || '' : '';
  f.type.value = c && c.type === 'permanente' ? 'permanente' : 'limitee';
  f.debut.value = c && c.debut ? c.debut : momentDans(7, 18);
  f.fin.value = c && c.fin ? c.fin : momentDans(21, 23).replace('T23:00', 'T23:59');
  f.visible.checked = c ? Boolean(c.visible) : true;
  $('choix-pieces-collection').innerHTML = articles.length ? articles.map((a) => {
    const ailleurs = a.collection && a.collection !== collectionOuverte ? nomCollection(a.collection) : '';
    const details = [ailleurs ? `dans ${ailleurs}` : '', a.visible ? '' : 'masquée'].filter(Boolean).join(' · ');
    return `<label class="case"><input type="checkbox" value="${echapper(a.id)}"${c && a.collection === c.id ? ' checked' : ''}> ${echapper(a.titre)}${details ? ` <span class="discret">(${echapper(details)})</span>` : ''}</label>`;
  }).join('') : '<p class="discret">Aucun article pour l\'instant : crée-les dans l\'onglet Articles.</p>';
  majTypeCollection();
  $('fiche-collection').showModal();
}
$('ajouter-collection').addEventListener('click', () => ouvrirCollection(null));

$('formulaire-collection').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const message = (texte) => { $('message-collection').textContent = texte; };
  const type = f.type.value === 'permanente' ? 'permanente' : 'limitee';
  const donnees = {
    nom: f.nom.value.trim().slice(0, 40),
    description: f.description.value.trim().slice(0, 160),
    type,
    debut: type === 'limitee' ? f.debut.value : '',
    fin: type === 'limitee' ? f.fin.value : '',
    visible: f.visible.checked,
  };
  if (!donnees.nom) return message('Donne un nom à la collection.');
  if (type === 'limitee') {
    if (!donnees.debut || !donnees.fin) return message('Une collection limitée a une date de lancement et une date de fin.');
    if (momentNC(donnees.fin) <= momentNC(donnees.debut)) return message('La fin doit venir après le lancement.');
  }
  const choisies = new Set([...$('choix-pieces-collection').querySelectorAll('input:checked')].map((i) => i.value));
  try {
    const ref = collectionOuverte ? doc(db, 'collections', collectionOuverte) : doc(collection(db, 'collections'));
    const lot = writeBatch(db);
    lot.set(ref, collectionOuverte ? donnees : { ...donnees, creeLe: serverTimestamp() }, { merge: true });
    articles.forEach((a) => {
      if (choisies.has(a.id) && a.collection !== ref.id) lot.update(doc(db, 'articles', a.id), { collection: ref.id });
      if (!choisies.has(a.id) && a.collection === ref.id) lot.update(doc(db, 'articles', a.id), { collection: '' });
    });
    await lot.commit();
    $('fiche-collection').close('enregistre');
  } catch (erreur) {
    message('La collection n\'a pas pu être enregistrée.');
  }
});

// Les états (« à venir », « en cours »…) changent avec l'heure : on les rafraîchit.
setInterval(() => { if (collections.length && !$('ecran-admin').hidden) dessinerCollections(); }, 60000);

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

// ============================================================
//  Codes promo
// ============================================================
// Chaque code est un document dont l'identifiant est le code lui-même.
let codes = [];

function ecouterCodes() {
  return onSnapshot(collection(db, 'codes'), (instantane) => {
    codes = instantane.docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.creeLe?.seconds || 0) - (a.creeLe?.seconds || 0));
    dessinerCodes();
  });
}

function etatCode(c) {
  const ajd = aujourdhui();
  if (!c.actif) return ['Désactivé', false];
  if (c.debut && ajd < c.debut) return ['À venir', false];
  if (c.fin && ajd > c.fin) return ['Expiré', false];
  return ['Actif', true];
}

function dessinerCodes() {
  if (!$('liste-codes')) return;
  $('codes-vides').hidden = codes.length > 0;
  $('liste-codes').innerHTML = codes.map((c) => {
    const [etat, actif] = etatCode(c);
    // Combien de commandes (non annulées) ont utilisé ce code.
    const utilisations = commandes.filter((x) => x.code === c.id && etapeDe(x).id !== 'annulee').length;
    const periode = [c.debut ? `à partir du ${dateCourte(c.debut)}` : '', c.fin ? `jusqu'au ${dateCourte(c.fin)}` : 'sans date de fin'].filter(Boolean).join(', ');
    return `<article class="carte offre" data-code="${echapper(c.id)}">
      <div class="offre-tete">
        <strong class="code-promo">${echapper(c.id)}</strong>
        <span class="etiquette${actif ? ' forte' : ''}">${etat}</span>
        <span class="taux">−${echapper(c.reduction)} %</span>
      </div>
      <span class="discret">${echapper(periode)}</span>
      <span>${utilisations} commande${utilisations > 1 ? 's' : ''} avec ce code</span>
      <div class="article-actions">
        <button class="lien" data-action-code="copier">Copier</button>
        <button class="lien" data-action-code="cartes">Imprimer des cartes</button>
        <button class="lien" data-action-code="modifier">Modifier</button>
        <button class="lien" data-action-code="actif">${c.actif ? 'Désactiver' : 'Activer'}</button>
        <button class="lien danger pousse" data-action-code="supprimer">Supprimer</button>
      </div>
    </article>`;
  }).join('');
}

$('liste-codes').addEventListener('click', async (e) => {
  const action = e.target.dataset.actionCode;
  if (!action) return;
  const c = codes.find((x) => x.id === e.target.closest('[data-code]').dataset.code);
  if (action === 'copier') {
    await navigator.clipboard.writeText(c.id).catch(() => {});
    e.target.textContent = 'Copié';
    setTimeout(() => { e.target.textContent = 'Copier'; }, 1500);
  }
  if (action === 'cartes') ouvrirCartes(c);
  if (action === 'modifier') ouvrirCode(c);
  if (action === 'actif') await updateDoc(doc(db, 'codes', c.id), { actif: !c.actif }).catch(() => alert('Modification impossible.'));
  if (action === 'supprimer') {
    if (!confirm(`Supprimer définitivement le code ${c.id} ?\nPour l'arrêter sans le perdre, utilise plutôt « Désactiver ».`)) return;
    await deleteDoc(doc(db, 'codes', c.id)).catch(() => alert('Suppression impossible.'));
  }
});

// ---------- Fiche d'un code
let codeOuvert = null;

function ouvrirCode(c) {
  const f = $('formulaire-code');
  f.reset();
  codeOuvert = c ? c.id : null;
  $('titre-fiche-code').textContent = c ? `Modifier ${c.id}` : 'Nouveau code promo';
  $('message-code').textContent = '';
  f.code.value = c ? c.id : '';
  f.code.disabled = Boolean(c);
  $('proposer-code').hidden = Boolean(c);
  f.reduction.value = c ? c.reduction : '';
  f.debut.value = c ? c.debut || '' : aujourdhui();
  f.fin.value = c ? c.fin || '' : '';
  f.actif.checked = c ? Boolean(c.actif) : true;
  $('fiche-code').showModal();
}
$('ajouter-code').addEventListener('click', () => ouvrirCode(null));

// Un code facile à lire : sans 0/O ni 1/I, qui se confondent sur une carte.
$('proposer-code').addEventListener('click', () => {
  const lettres = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const hasard = Array.from(crypto.getRandomValues(new Uint32Array(5)), (n) => lettres[n % lettres.length]).join('');
  const taux = $('formulaire-code').reduction.value;
  $('formulaire-code').code.value = `BD${taux || ''}-${hasard}`.slice(0, 20);
});

$('formulaire-code').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const message = (texte) => { $('message-code').textContent = texte; };
  const code = f.code.value.trim().toUpperCase();
  const reduction = Number(f.reduction.value);
  if (!/^[A-Z0-9-]{3,20}$/.test(code)) return message('Le code doit faire 3 à 20 caractères : lettres, chiffres ou tirets.');
  if (!Number.isInteger(reduction) || reduction < 1 || reduction > 90) return message('La réduction doit être un nombre entier entre 1 et 90.');
  if (f.debut.value && f.fin.value && f.fin.value < f.debut.value) return message('La date de fin doit venir après la date de début.');
  const donnees = { reduction, debut: f.debut.value || '', fin: f.fin.value || '', actif: f.actif.checked };
  try {
    if (codeOuvert) {
      await updateDoc(doc(db, 'codes', codeOuvert), donnees);
    } else {
      if ((await getDoc(doc(db, 'codes', code))).exists()) return message('Ce code existe déjà. Choisis-en un autre.');
      await setDoc(doc(db, 'codes', code), { ...donnees, creeLe: serverTimestamp() });
    }
    $('fiche-code').close('enregistre');
  } catch (erreur) {
    message('Le code n\'a pas pu être enregistré.');
  }
});

// ---------- Cartes d'un code, à imprimer
// 10 cartes au format carte de visite (85 × 55 mm) par feuille A4, collées
// les unes aux autres : on coupe d'un bord à l'autre en suivant les repères des marges.
// Le nom est écrit en texte, pas avec le logo dessiné (pas encore arrêté).
const CARTE = { l: 85, h: 55, colonnes: 2, lignes: 5 };
let codeCartes = null;

const dateLongue = (jour) => new Date(`${jour}T12:00:00+11:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Pacific/Noumea' });

function validiteCarte(c) {
  const debut = c.debut && c.debut > aujourdhui() ? c.debut : '';
  if (debut && c.fin) return `valable du ${dateCourte(debut)} au ${dateCourte(c.fin)}`;
  if (debut) return `valable dès le ${dateLongue(debut)}`;
  if (c.fin) return `valable jusqu'au ${dateLongue(c.fin)}`;
  return '';
}

function carteCodePromo(c, phrase) {
  const taille = c.id.length <= 10 ? 15 : c.id.length <= 15 ? 12 : 9.5; // en points : un code de 20 caractères tient sur la carte
  return `<div class="carte-promo">
    <div class="cp-tete"><span class="cp-marque">bleach drop</span><span class="cp-type">code promo</span></div>
    <div class="cp-reduc"><span class="cp-taux">−${echapper(c.reduction)} %</span><span class="cp-phrase">${echapper(phrase)}</span></div>
    <div class="cp-code"><span>avec le code</span><b style="font-size:${taille}pt">${echapper(c.id)}</b></div>
    <div class="cp-pied"><span>bleachdrop.com</span><span>${echapper(validiteCarte(c))}</span></div>
  </div>`;
}

function ouvrirCartes(c) {
  codeCartes = c;
  const f = $('formulaire-cartes');
  f.reset();
  f.phrase.value = 'sur votre prochaine commande';
  $('titre-fiche-cartes').textContent = `Cartes du code ${c.id}`;
  // Prévenir avant de distribuer des cartes qu'un client ne pourrait pas utiliser.
  const [etat] = etatCode(c);
  const alertes = {
    'Désactivé': 'Ce code est désactivé : un client qui le saisit sera refusé. Active-le avant de distribuer les cartes.',
    'À venir': `Ce code ne marche qu'à partir du ${c.debut ? dateLongue(c.debut) : ''}.`,
    'Expiré': `Ce code a expiré${c.fin ? ` le ${dateLongue(c.fin)}` : ''} : un client qui le saisit sera refusé.`,
  };
  $('alerte-cartes').hidden = !alertes[etat];
  $('alerte-cartes').textContent = alertes[etat] || '';
  majApercuCartes();
  $('fiche-cartes').showModal();
}

function optionsCartes() {
  const f = $('formulaire-cartes');
  return { phrase: f.phrase.value.trim(), fond: f.fond.value };
}

function majApercuCartes() {
  if (!codeCartes) return;
  const { phrase, fond } = optionsCartes();
  $('apercu-carte').innerHTML = carteCodePromo(codeCartes, phrase);
  $('apercu-carte').dataset.fond = fond;
}
$('formulaire-cartes').addEventListener('input', majApercuCartes);
$('formulaire-cartes').addEventListener('change', majApercuCartes);

$('formulaire-cartes').addEventListener('submit', (e) => {
  e.preventDefault();
  const { phrase, fond } = optionsCartes();
  $('fiche-cartes').close('imprime');
  imprimerCartes(codeCartes, phrase, fond);
});

function imprimerCartes(c, phrase, fond) {
  const { l, h, colonnes, lignes } = CARTE;
  const L = colonnes * l; const H = lignes * h;
  const x0 = (210 - L) / 2; const y0 = (297 - H) / 2;
  const cartes = [];
  for (let r = 0; r < lignes; r += 1) {
    for (let col = 0; col < colonnes; col += 1) {
      cartes.push(`<div class="emplacement" style="left:${x0 + col * l}mm;top:${y0 + r * h}mm">${carteCodePromo(c, phrase)}</div>`);
    }
  }
  // Repères de coupe dans les marges, au bout de chaque ligne de coupe.
  const reperes = [];
  for (let col = 0; col <= colonnes; col += 1) {
    const x = x0 + col * l;
    reperes.push(`left:${x - 0.1}mm;top:${y0 - 8}mm;width:.2mm;height:5mm`, `left:${x - 0.1}mm;top:${y0 + H + 3}mm;width:.2mm;height:5mm`);
  }
  for (let r = 0; r <= lignes; r += 1) {
    const y = y0 + r * h;
    reperes.push(`left:${x0 - 14}mm;top:${y - 0.1}mm;width:10mm;height:.2mm`, `left:${x0 + L + 4}mm;top:${y - 0.1}mm;width:10mm;height:.2mm`);
  }
  $('impression').innerHTML = `<section class="planche-cartes" data-fond="${fond === 'noir' ? 'noir' : 'blanc'}">${cartes.join('')}`
    + `${reperes.map((style) => `<i class="repere-coupe" style="${style}"></i>`).join('')}</section>`;
  $('impression').dataset.orientation = 'portrait';
  $('page-impression').textContent = '@page { size: A4 portrait; margin: 0; }';
  document.body.classList.add('impression');
  const finir = () => {
    document.body.classList.remove('impression');
    $('impression').innerHTML = '';
    window.removeEventListener('afterprint', finir);
  };
  window.addEventListener('afterprint', finir);
  document.fonts.ready.then(() => window.print());
}
