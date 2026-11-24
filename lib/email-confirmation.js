// E-mail de confirmation envoyé au client après sa demande.
// Mise en page en tableaux et styles en ligne : c'est ce que les messageries
// (Gmail, Outlook, Apple Mail) affichent le plus fidèlement.

const SITE = 'https://bleachdrop.com';

// Couleurs du site : noir et blanc (voir styles.css).
const C = {
  noir: '#000000',
  carte: '#0d0d0d',
  trait: '#262626',
  blanc: '#f4f4f4',
  doux: '#d9d9d9',
  gris: '#9a9a9a',
  accent: '#ffffff',
  accentDoux: '#bdbdbd',
};
// Les polices du site s'affichent dans Apple Mail ; ailleurs, on retombe sur des polices proches.
// Une seule police, sobre et moderne : les titres sont en DM Sans gras.
const TITRE = "'DM Sans', Helvetica, Arial, sans-serif";
const TEXTE = "'DM Sans', Helvetica, Arial, sans-serif";

const echapper = (texte) => String(texte == null ? '' : texte).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// « Léa Martin » donne « Léa » ; un seul mot est gardé tel quel.
const prenom = (nom) => String(nom || '').trim().split(/\s+/)[0] || '';

function ligneRecap(intitule, valeur) {
  return `<tr>
    <td style="padding:12px 0;border-top:1px solid ${C.trait};font-family:${TEXTE};font-size:11px;font-weight:500;letter-spacing:1.5px;text-transform:uppercase;color:${C.accentDoux};vertical-align:top;width:38%;">${echapper(intitule)}</td>
    <td style="padding:12px 0;border-top:1px solid ${C.trait};font-family:${TEXTE};font-size:14px;line-height:1.6;color:${C.blanc};vertical-align:top;white-space:pre-wrap;">${echapper(valeur)}</td>
  </tr>`;
}

function emailConfirmation(d) {
  const lignes = [
    ['Pièce', d.piece],
    ['Taille', d.taille],
    ...(d.prix ? [['Prix affiché', d.prix]] : []),
    ...(d.pays ? [['Pays', d.pays]] : []),
    ...(d.telephone ? [['Téléphone', d.telephone]] : []),
    ...(d.code ? [['Code promo', `${d.code} (−${d.codeReduction} %)`]] : []),
    ...(d.modeleJoint ? [['Modèle', 'Image jointe reçue']] : []),
    ...(d.message ? [['Votre message', d.message]] : []),
  ];
  const bonjour = prenom(d.nom) ? `Merci ${prenom(d.nom)}` : 'Merci';

  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>Votre demande est bien reçue</title>
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
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Votre demande pour « ${echapper(d.piece)} » est bien arrivée. Rien à payer pour l'instant.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.noir};">
    <tr>
      <td align="center" style="padding:32px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

          <tr>
            <td align="center" style="padding:8px 0 28px;">
              <a href="${SITE}" style="text-decoration:none;">
                <img src="${SITE}/images/logo-bleu-email.png" width="200" height="80" alt="bleach drop" style="display:block;border:0;width:200px;height:auto;">
              </a>
            </td>
          </tr>

          <tr>
            <td class="cadre" style="background:${C.carte};border:1px solid ${C.trait};border-radius:20px;padding:36px 32px;">
              <p style="margin:0 0 6px;font-family:${TEXTE};font-size:15px;font-weight:500;line-height:1.4;color:${C.accentDoux};">Demande bien reçue</p>
              <h1 class="titre" style="margin:0 0 20px;font-family:${TITRE};font-weight:700;font-size:40px;line-height:1.1;letter-spacing:-1px;color:${C.accent};">${echapper(bonjour)}</h1>
              <p style="margin:0 0 14px;font-family:${TEXTE};font-size:14px;line-height:1.7;color:${C.doux};">Votre demande est bien arrivée. Notre équipe la regarde et vous répond par e-mail pour confirmer le prix et le délai.</p>
              <p style="margin:0 0 28px;font-family:${TEXTE};font-size:14px;line-height:1.7;color:${C.doux};">Rien à payer pour l'instant&nbsp;: le paiement et la remise de la pièce se font en main propre.</p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${lignes.map(([intitule, valeur]) => ligneRecap(intitule, valeur)).join('')}
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:30px;">
                <tr>
                  <!-- Contour sans fond : rien à inverser pour les modes sombres des messageries. -->
                  <td style="border:1.5px solid ${C.accent};border-radius:999px;">
                    <a href="${SITE}" style="display:inline-block;padding:14px 28px;font-family:${TEXTE};font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${C.blanc};text-decoration:none;">Revoir les pièces</a>
                  </td>
                </tr>
              </table>

              <p style="margin:28px 0 0;font-family:${TEXTE};font-size:12px;line-height:1.7;color:${C.gris};">Une précision à ajouter&nbsp;? Répondez simplement à cet e-mail.</p>
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
              Vous recevez cet e-mail parce qu'une demande a été envoyée avec votre adresse sur bleachdrop.com.
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
    'Votre demande est bien arrivée. Notre équipe la regarde et vous répond par e-mail pour confirmer le prix et le délai.',
    'Rien à payer pour l\'instant : le paiement et la remise de la pièce se font en main propre.',
    '',
    ...lignes.map(([intitule, valeur]) => `${intitule} : ${valeur}`),
    '',
    'Une précision à ajouter ? Répondez simplement à cet e-mail.',
    '',
    `bleach drop — ${SITE}`,
  ].join('\n');

  return {
    sujet: `Votre demande est bien reçue — ${d.piece}`,
    html,
    texte,
  };
}

// Les briques de mise en page servent aussi à l'e-mail de réponse (email-reponse.js).
module.exports = { emailConfirmation, SITE, C, TITRE, TEXTE, echapper, prenom, ligneRecap };
