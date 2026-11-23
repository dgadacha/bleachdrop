// Reçoit une demande de commande et l'envoie par e-mail via Resend.
//
// Trois réglages à poser dans Vercel (Settings > Environment Variables) :
//   RESEND_API_KEY   la clé d'API Resend
//   COMMANDES_EMAIL  l'adresse qui reçoit les commandes
//   COMMANDES_FROM   (facultatif) l'expéditeur, une fois un domaine vérifié
//                    chez Resend. Par défaut : l'adresse d'essai de Resend.

const TYPES_IMAGE = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const TAILLE_MAX_BASE64 = 4000000; // environ 3 Mo d'image

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

  const texte = [
    `Nom : ${d.nom}`,
    `E-mail : ${d.email}`,
    `Pièce : ${d.piece}`,
    `Taille : ${d.taille}`,
    ...(d.prix ? [`Prix affiché : ${d.prix}`] : []),
    `Modèle joint : ${pieces.length ? 'oui' : 'non'}`,
    '',
    d.message || '(pas de message)',
    '',
    '—',
    'Répondre à cet e-mail écrit directement au client.',
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

  return res.status(200).json({ ok: true });
};
