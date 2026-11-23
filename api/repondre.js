// Envoie au client la réponse écrite dans le back-office (prix, délai, remise).
// Réservé aux comptes du back-office : la requête doit porter le jeton de
// connexion Firebase d'un compte de la liste lib/admins.js.
//
// Réglages Vercel utilisés : RESEND_API_KEY, COMMANDES_FROM (expéditeur sur le
// domaine vérifié) et COMMANDES_EMAIL (l'équipe, qui reçoit une copie et les réponses).

const ADMINS = require('../lib/admins');
const { emailReponse } = require('../lib/email-reponse');

const CLE_FIREBASE = 'AIzaSyAGG1HBm9Unhi_Y8msKJnOYb10JliiT4Lc';

const ligne = (valeur, max) => String(valeur == null ? '' : valeur).replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);
const texteLong = (valeur, max) => String(valeur == null ? '' : valeur).trim().slice(0, max);

// Vérifie le jeton auprès de Firebase et renvoie l'identifiant du compte, ou null.
async function compteConnecte(jeton) {
  if (!jeton) return null;
  try {
    const reponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${CLE_FIREBASE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: jeton }),
      signal: AbortSignal.timeout(5000),
    });
    if (!reponse.ok) return null;
    const compte = ((await reponse.json()).users || [])[0];
    return compte ? compte.localId : null;
  } catch (erreur) {
    console.error('Vérification du compte impossible :', erreur);
    return null;
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ erreur: 'Méthode non autorisée.' });
  }

  const jeton = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const compte = await compteConnecte(jeton);
  if (!compte || !ADMINS.includes(compte)) {
    return res.status(403).json({ erreur: 'Accès refusé.' });
  }

  const cle = process.env.RESEND_API_KEY;
  const expediteur = process.env.COMMANDES_FROM;
  const equipe = process.env.COMMANDES_EMAIL;
  if (!cle || !expediteur || !equipe) {
    return res.status(503).json({ erreur: 'L\'envoi n\'est pas configuré.' });
  }

  const corps = req.body && typeof req.body === 'object' ? req.body : {};
  const commande = {
    nom: ligne(corps.nom, 100),
    email: ligne(corps.email, 200),
    piece: ligne(corps.piece, 100),
    taille: ligne(corps.taille, 10),
  };
  const proposition = {
    prix: Number(corps.prix),
    delai: ligne(corps.delai, 200),
    remise: ligne(corps.remise, 300),
    message: texteLong(corps.message, 3000),
  };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(commande.email)) {
    return res.status(400).json({ erreur: 'Ce client n\'a pas d\'adresse e-mail valable.' });
  }
  if (!commande.piece || !Number.isInteger(proposition.prix) || proposition.prix < 0 || proposition.prix > 1000000 || !proposition.delai) {
    return res.status(400).json({ erreur: 'Indique un prix (nombre entier) et un délai.' });
  }

  const mail = emailReponse(commande, proposition);
  try {
    const reponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: expediteur,
        to: [commande.email],
        bcc: [equipe], // une copie pour l'équipe
        reply_to: equipe, // le client répond directement à l'équipe
        subject: mail.sujet,
        html: mail.html,
        text: mail.texte,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!reponse.ok) {
      console.error('Resend a refusé la réponse :', reponse.status, await reponse.text());
      return res.status(502).json({ erreur: 'L\'e-mail n\'est pas parti. Réessaie dans un instant.' });
    }
  } catch (erreur) {
    console.error('Resend injoignable :', erreur);
    return res.status(502).json({ erreur: 'L\'e-mail n\'est pas parti. Réessaie dans un instant.' });
  }

  return res.status(200).json({ ok: true });
};
