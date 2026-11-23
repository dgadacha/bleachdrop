// Reçoit une demande de commande et l'envoie par e-mail via Resend.
//
// Trois réglages à poser dans Vercel (Settings > Environment Variables) :
//   RESEND_API_KEY   la clé d'API Resend
//   COMMANDES_EMAIL  l'adresse qui reçoit les commandes
//   COMMANDES_FROM   (facultatif) l'expéditeur, une fois un domaine vérifié
//                    chez Resend, par ex. « bleach drop <commandes@bleachdrop.nc> ».
//                    Par défaut : l'adresse d'essai de Resend.
//
// Le client ne reçoit son e-mail de confirmation que si COMMANDES_FROM est
// réglé : avec l'adresse d'essai, Resend n'envoie qu'au titulaire du compte.

const { emailConfirmation } = require('../lib/email-confirmation');

const TYPES_IMAGE = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const TAILLE_MAX_BASE64 = 4000000; // environ 3 Mo d'image

// La base Firebase du back-office. Valeurs publiques : ce sont les règles
// (firestore.rules) qui n'autorisent ici que la création d'une commande.
const BASE = 'https://firestore.googleapis.com/v1/projects/bleachdrop-nc/databases/(default)/documents';
const CLE_BASE = 'AIzaSyAGG1HBm9Unhi_Y8msKJnOYb10JliiT4Lc';

// Range la commande dans la base pour le back-office. Ne bloque jamais l'envoi
// de l'e-mail : en cas d'échec, on le note dans le journal et on continue.
async function enregistrer(d, modeleJoint) {
  const texte = (valeur) => ({ stringValue: valeur });
  const champs = {
    nom: texte(d.nom),
    email: texte(d.email),
    piece: texte(d.piece),
    taille: texte(d.taille),
    modeleJoint: { booleanValue: modeleJoint },
    statut: texte('nouvelle'),
    source: texte('site'),
    creeLe: { timestampValue: new Date().toISOString() },
  };
  if (d.telephone) champs.telephone = texte(d.telephone);
  if (d.prix) champs.prix = texte(d.prix);
  if (d.message) champs.message = texte(d.message);
  try {
    const reponse = await fetch(`${BASE}/commandes?key=${CLE_BASE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: champs }),
      signal: AbortSignal.timeout(4000), // une base lente ne doit pas retenir l'e-mail
    });
    if (!reponse.ok) console.error('Base : commande non enregistrée :', reponse.status, await reponse.text());
    return reponse.ok;
  } catch (erreur) {
    console.error('Base injoignable :', erreur);
    return false;
  }
}

// Une seule ligne, sans retour chariot, coupée à `max` caractères.
const ligne = (valeur, max) => String(valeur == null ? '' : valeur).replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ erreur: 'Méthode non autorisée.' });
  }

  const cle = process.env.RESEND_API_KEY;
  const destinataire = process.env.COMMANDES_EMAIL;
  if (!cle || !destinataire) {
    return res.status(503).json({ erreur: 'L\'envoi n\'est pas encore configuré.' });
  }

  const corps = req.body && typeof req.body === 'object' ? req.body : {};

  // Champ caché rempli : c'est un robot. On répond « ok » sans rien envoyer.
  if (corps.site) return res.status(200).json({ ok: true });

  const d = {
    nom: ligne(corps.nom, 100),
    email: ligne(corps.email, 200),
    // Numéro déjà mis en forme par le site ; tout autre format est ignoré.
    telephone: /^\+687 \d{2} \d{2} \d{2}$/.test(ligne(corps.telephone, 30)) ? ligne(corps.telephone, 30) : '',
    piece: ligne(corps.piece, 100),
    taille: ligne(corps.taille, 10),
    prix: ligne(corps.prix, 200),
    message: String(corps.message == null ? '' : corps.message).trim().slice(0, 4000),
  };

  if (d.nom.length < 2 || !d.piece || !d.taille || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) {
    return res.status(400).json({ erreur: 'La demande est incomplète.' });
  }

  const pieces = [];
  const jointe = corps.modele;
  if (jointe && typeof jointe === 'object') {
    const extension = TYPES_IMAGE[jointe.type];
    const contenu = typeof jointe.contenu === 'string' ? jointe.contenu : '';
    if (!extension || !/^[A-Za-z0-9+/]+=*$/.test(contenu)) {
      return res.status(400).json({ erreur: 'Le modèle doit être une image JPEG, PNG ou WebP.' });
    }
    if (contenu.length > TAILLE_MAX_BASE64) {
      return res.status(413).json({ erreur: 'L\'image est trop lourde (3 Mo au maximum).' });
    }
    pieces.push({ filename: `modele.${extension}`, content: contenu });
  }

  const enregistree = await enregistrer(d, pieces.length > 0);

  const texte = [
    `Prénom et nom : ${d.nom}`,
    `E-mail : ${d.email}`,
    `Téléphone : ${d.telephone || 'non indiqué'}`,
    `Pièce : ${d.piece}`,
    `Taille : ${d.taille}`,
    ...(d.prix ? [`Prix affiché : ${d.prix}`] : []),
    `Modèle joint : ${pieces.length ? 'oui' : 'non'}`,
    '',
    d.message || '(pas de message)',
    '',
    '—',
    'Répondre à cet e-mail écrit directement au client.',
    enregistree
      ? 'La commande est aussi dans le back-office du site.'
      : 'Attention : cette commande n\'a pas pu être rangée dans le back-office. Elle est à y ajouter à la main.',
  ].join('\n');

  let reponse;
  try {
    reponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.COMMANDES_FROM || 'bleach drop <onboarding@resend.dev>',
        to: [destinataire],
        reply_to: d.email,
        subject: `Commande — ${d.piece} (${d.taille})`,
        text: texte,
        ...(pieces.length ? { attachments: pieces } : {}),
      }),
    });
  } catch (erreur) {
    console.error('Resend injoignable :', erreur);
    return res.status(502).json({ erreur: 'L\'envoi a échoué. Réessayez dans un instant.' });
  }

  if (!reponse.ok) {
    console.error('Resend a refusé :', reponse.status, await reponse.text());
    return res.status(502).json({ erreur: 'L\'envoi a échoué. Réessayez dans un instant.' });
  }

  const confirmation = await confirmerAuClient(cle, destinataire, d, pieces.length > 0);
  return res.status(200).json({ ok: true, confirmation });
};

// Envoie au client l'e-mail de confirmation. N'empêche jamais la commande :
// en cas d'échec, Maya a déjà reçu la demande, on le note simplement.
async function confirmerAuClient(cle, adresseMaya, d, modeleJoint) {
  const expediteur = process.env.COMMANDES_FROM;
  if (!expediteur) return false; // pas de domaine vérifié : Resend refuserait
  const mail = emailConfirmation({ ...d, modeleJoint });
  try {
    const reponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: expediteur,
        to: [d.email],
        reply_to: adresseMaya, // le client répond directement à Maya
        subject: mail.sujet,
        html: mail.html,
        text: mail.texte,
      }),
      signal: AbortSignal.timeout(6000),
    });
    if (!reponse.ok) console.error('Confirmation au client refusée :', reponse.status, await reponse.text());
    return reponse.ok;
  } catch (erreur) {
    console.error('Confirmation au client non envoyée :', erreur);
    return false;
  }
}
