// E-mail de réponse envoyé au client depuis le back-office : la proposition
// de prix et de délai. Même mise en page que l'e-mail de confirmation.
const { SITE, C, TITRE, TEXTE, echapper, prenom, ligneRecap } = require('./email-confirmation');

const xpf = (n) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+$)/g, ' ')} XPF`;

function emailReponse(commande, proposition) {
  const p = proposition;
  const lignes = [
    ['Pièce', commande.piece],
    ['Taille', commande.taille],
    ['Prix', xpf(p.prix)],
    ['Délai', p.delai],
    ...(p.remise ? [['Remise', p.remise]] : []),
  ];
  const bonjour = prenom(commande.nom) ? `Bonjour ${prenom(commande.nom)}` : 'Bonjour';

  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>Votre commande bleach drop</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
<style>
  body { margin:0; padding:0; background:${C.noir}; }
  a { color:${C.blanc}; }
  @media (max-width: 600px) {
    .cadre { padding:28px 20px !important; }
    .titre { font-size:32px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.noir};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Notre proposition pour « ${echapper(commande.piece)} » : ${echapper(xpf(p.prix))}, ${echapper(p.delai)}.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.noir};">
    <tr>
      <td align="center" style="padding:32px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

          <tr>
            <td align="center" style="padding:8px 0 28px;">
              <a href="${SITE}" style="text-decoration:none;">
                <img src="${SITE}/images/logo-email.png" width="200" height="90" alt="bleach drop" style="display:block;border:0;width:200px;height:auto;">
              </a>
            </td>
          </tr>

          <tr>
            <td class="cadre" style="background:${C.carte};border:1px solid ${C.trait};border-radius:20px;padding:36px 32px;">
              <p style="margin:0 0 6px;font-family:${TEXTE};font-size:15px;font-weight:500;line-height:1.4;color:${C.peche};">Votre commande</p>
              <h1 class="titre" style="margin:0 0 20px;font-family:${TITRE};font-weight:700;font-size:40px;line-height:1.1;letter-spacing:-1px;color:${C.orange};">${echapper(bonjour)}</h1>
              <p style="margin:0 0 28px;font-family:${TEXTE};font-size:14px;line-height:1.7;color:${C.doux};">Merci pour votre demande. Voici notre proposition&nbsp;:</p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${lignes.map(([intitule, valeur]) => ligneRecap(intitule, valeur)).join('')}
              </table>

              ${p.message ? `<p style="margin:28px 0 0;padding:14px 16px;border-left:3px solid ${C.orange};font-family:${TEXTE};font-size:14px;line-height:1.7;color:${C.blanc};white-space:pre-wrap;">${echapper(p.message)}</p>` : ''}

              <p style="margin:28px 0 0;font-family:${TEXTE};font-size:14px;line-height:1.7;color:${C.doux};">Pour valider la commande, répondez simplement à cet e-mail. Rien à payer maintenant&nbsp;: le paiement se fait à la remise de la pièce.</p>

              <!-- Contour sans fond : rien à inverser pour les modes sombres des messageries. -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:30px;">
                <tr>
                  <td style="border:1.5px solid ${C.orange};border-radius:999px;">
                    <a href="${SITE}" style="display:inline-block;padding:14px 28px;font-family:${TEXTE};font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${C.blanc};text-decoration:none;">Revoir les pièces</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:28px 12px 8px;font-family:${TEXTE};font-size:11px;line-height:1.8;letter-spacing:1.5px;text-transform:uppercase;color:${C.gris};">
              Fait main · Pièces uniques<br>
              <span style="letter-spacing:1px;text-transform:none;">bleach drop</span>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:6px 12px 0;font-family:${TEXTE};font-size:11px;line-height:1.7;color:#5c5c5c;">
              Vous recevez cet e-mail en réponse à votre demande sur bleachdrop.com.
              <a href="${SITE}/mentions-legales.html#confidentialite" style="color:${C.gris};">Vos données</a>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const texte = [
    `${bonjour},`,
    '',
    'Merci pour votre demande. Voici notre proposition :',
    '',
    ...lignes.map(([intitule, valeur]) => `${intitule} : ${valeur}`),
    ...(p.message ? ['', p.message] : []),
    '',
    'Pour valider la commande, répondez simplement à cet e-mail.',
    'Rien à payer maintenant : le paiement se fait à la remise de la pièce.',
    '',
    `bleach drop — ${SITE}`,
  ].join('\n');

  return { sujet: `Votre commande bleach drop — ${commande.piece}`, html, texte };
}

module.exports = { emailReponse };
