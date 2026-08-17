// Générateur HTML/PDF de la FICHE D'INSCRIPTION — VERSION PAPIER STRICTE.
//
// Important : cette version ne reprend QUE les champs de la fiche papier
// (Employé + Personnes à contacter en cas d'urgence + pied de page).
// Elle ne contient pas les sections "Parents" / "Expériences" du formulaire
// numérique enrichi — celles-ci restent dans l'app, mais n'apparaissent pas
// sur la feuille physique.
//
// Cross-platform : imprimable via expo-print (printToFileAsync → PDF natif)
// ou via window.print() sur le web, exactement comme contratPrint.ts.
//
// Design : fidèle à la maquette validée (mockups/fiche-inscription-preview.html) :
// bandeaux BLEU NUIT (#1b2a4a), champs pointillés, cases matrimoniale,
// clauses salariales + signatures.

import { Platform } from 'react-native';

export interface FichePapierData {
  // Bloc EMPLOYE
  date?: string;
  nom?: string;
  prenom?: string;
  date_naissance?: string;
  lieu_naissance?: string;
  telephone?: string;
  lieu_residence?: string;
  nationalite?: string;
  sexe?: string;
  situation_matrimoniale?: string; // valeur brute : 'celibataire' | 'marie' | 'concubinage'
  religion?: string;
  ethnie?: string;
  categorie_emploi?: string;
  niveau_etude?: string;
  deja_travaille?: boolean;
  experience_details?: string;
  allergie_sante?: string;
  intervention_chirurgicale?: string;
  // Photo : soit une URI simple (URL distante / file local), soit un data-URI
  // base64. Le data-URI est PRIMORDIAL pour que la photo s'imprime TOUJOURS
  // dans le PDF (expo-print n'embarque pas fiablement les images distantes).
  photo?: string | null;
  photoDataUri?: string | null;
  // Bloc URGENCE (2 contacts max)
  urgence?: Array<{ nom?: string; prenom?: string; telephone?: string; lieu?: string }>;
}

const SITUATIONS: Record<string, string> = {
  celibataire: 'Célibataire',
  marie: 'Marié(e)',
  concubinage: 'Concubinage',
};

const escapeHtml = (s: any): string => {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

// Sur natif, expo-print n'embarque pas les images distantes de façon fiable :
// on passe un data URI (base64). Le data-URI prime sur l'URI simple.
const photoHtml = (photo: string | null | undefined, photoDataUri?: string | null): string => {
  const src = photoDataUri || photo;
  if (!src) return '<span style="color:#bbb;font-size:13px;">Photo</span>';
  return `<img src="${escapeHtml(src)}" alt="Photo" style="width:100%;height:100%;object-fit:cover;display:block;" />`;
};

// Convertit une URI (file:// local OU URL distante http(s)) en data-URI base64,
// pour garantir l'impression de la photo dans le PDF généré par expo-print.
// Sur natif : expo-file-system lit le fichier local ; pour une URL distante on fetch.
// Sur web : on fetch l'URL et on lit en base64.
export const fileUriToDataUri = async (uri: string): Promise<string | null> => {
  if (!uri) return null;
  // Déjà un data-URI
  if (uri.startsWith('data:')) return uri;
  try {
    if (Platform.OS === 'web') {
      const res = await fetch(uri);
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
    // Natif
    const FS = require('expo-file-system');
    if (uri.startsWith('file:') || uri.startsWith('content:') || uri.startsWith('/')) {
      const b64 = await FS.readAsStringAsync(uri, { encoding: FS.EncodingType.Base64 });
      const ext = uri.toLowerCase().split('.').pop() || 'jpg';
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      return `data:${mime};base64,${b64}`;
    }
    // URL distante sur natif : fetch puis convertir en base64
    const res = await fetch(uri);
    const blob = await res.blob();
    // Pas de FileReader natif : on lit via expo-file-system depuis un fichier temporaire
    const b64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const mime = res.headers?.get?.('content-type') || 'image/jpeg';
    return `data:${mime};base64,${b64}`;
  } catch (e) {
    console.warn('[fichePrint] conversion photo en data-URI échouée:', e);
    return null;
  }
};

export function buildFichePapierHtml(data: FichePapierData): string {
  const d = data || {};
  const sit = d.situation_matrimoniale || '';
  const check = (v: string) =>
    sit === v
      ? '<span class="box checked">✓</span>'
      : '<span class="box"></span>';

  const dateStr = d.date
    ? escapeHtml(d.date)
    : new Date().toISOString().slice(0, 10);

  // 2 contacts d'urgence (papier : exactement 2)
  const u = d.urgence || [];
  const c1 = u[0] || {};
  const c2 = u[1] || {};
  const urgCol = (c: any) => `
    <div class="urgCol">
      <div class="urgTitle">${escapeHtml(c.prenom || c.nom ? '' : '')}</div>
      <div class="row"><span class="label">Nom et prénoms :</span><span class="val">${
        [c.prenom, c.nom].filter(Boolean).join(' ') || ''
      }</span><span class="dots"></span></div>
      <div class="row"><span class="label">Contact :</span><span class="val">${
        escapeHtml(c.telephone) || ''
      }</span><span class="dots"></span></div>
      <div class="row"><span class="label">Lieu d'habitation :</span><span class="val">${
        escapeHtml(c.lieu) || ''
      }</span><span class="dots"></span></div>
    </div>`;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Fiche d'inscription — CHRISROI AGENCE</title>
<style>
  @page { size: A4; margin: 12mm 14mm 12mm 14mm; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0;
    font-family: "Times New Roman", Georgia, serif;
    color: #111;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page { width: 100%; }

  /* En-tête */
  .top {
    display: flex; justify-content: space-between; align-items: flex-start; gap: 4mm;
  }
  .titleBox {
    border: 1.5px solid #000; padding: 6px 26px; text-align: center; margin: 0 auto;
  }
  .titleBox h1 {
    margin: 0; font-size: 22px; letter-spacing: 2px; font-weight: 700;
  }
  .photoBox {
    width: 46mm; height: 54mm; border: 1.5px solid #000;
    display: flex; align-items: center; justify-content: center;
    overflow: hidden; background: #fafafa; flex: 0 0 auto;
  }

  /* Bandeau section (BLEU NUIT) */
  .sectionBar {
    background: #1b2a4a; color: #fff; text-align: center; font-weight: 700;
    letter-spacing: 1.5px; padding: 2mm 8px; margin: 4mm 0 3mm; font-size: 15px;
  }

  /* Lignes de champ */
  .row { display: flex; align-items: baseline; gap: 3mm; margin: 2.5mm 0; }
  .label { white-space: nowrap; font-size: 13.5px; }
  .dots {
    flex: 1; border-bottom: 1px dotted #000; height: 16px; min-width: 40px;
  }
  .val { font-size: 13.5px; min-width: 60px; }

  /* cases à cocher */
  .checks { display: flex; gap: 6mm; margin: 2mm 0 3mm 4mm; font-size: 13px; }
  .check { display: flex; align-items: center; gap: 6px; }
  .box {
    width: 13px; height: 13px; border: 1.3px solid #000;
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 11px; line-height: 1;
  }
  .box.checked { background: #1b2a4a; color: #fff; border-color: #1b2a4a; }

  /* deux colonnes urgence */
  .urgGrid { display: flex; gap: 4mm; }
  .urgCol { flex: 1; }
  .urgTitle { font-weight: 700; font-size: 13px; margin-bottom: 4px; }

  /* Pied */
  .clause { margin-top: 4mm; font-size: 13px; display: flex; align-items: baseline; gap: 3mm; }
  .signs { display: flex; justify-content: space-between; margin-top: 7mm; }
  .sign { text-align: center; width: 40%; }
  .sign .line { border-top: 1px solid #000; margin-top: 34px; padding-top: 4px; font-size: 12.5px; font-weight: 600; }
  .small { font-size: 11px; color: #555; }

  @media print { body { font-size: 12px; } }
</style>
</head>
<body>
  <div class="page">

    <!-- EN-TÊTE -->
    <div class="top">
      <div style="width:46mm"></div>
      <div class="titleBox"><h1>FICHE D'INSCRIPTION</h1></div>
      <div class="photoBox">${photoHtml(d.photo, d.photoDataUri)}</div>
    </div>

    <!-- SECTION EMPLOYE -->
    <div class="sectionBar">EMPLOYE</div>

    <div class="row"><span class="label">Date :</span><span class="val">${dateStr}</span><span class="dots"></span></div>
    <div class="row"><span class="label">Nom et Prénoms :</span><span class="val">${
      [d.nom, d.prenom].filter(Boolean).join(' ')
    }</span><span class="dots"></span></div>
    <div class="row"><span class="label">Date et lieu de naissance :</span><span class="val">${
      [d.date_naissance, d.lieu_naissance].filter(Boolean).join(' à ')
    }</span><span class="dots"></span></div>
    <div class="row"><span class="label">Numéro de téléphone :</span><span class="val">${
      escapeHtml(d.telephone)
    }</span><span class="dots"></span></div>
    <div class="row"><span class="label">Lieu d'habitation :</span><span class="val">${
      escapeHtml(d.lieu_residence)
    }</span><span class="dots"></span></div>
    <div class="row"><span class="label">Nationalité :</span><span class="val">${
      escapeHtml(d.nationalite)
    }</span><span class="dots"></span></div>
    <div class="row"><span class="label">Sexe :</span><span class="val">${
      escapeHtml(d.sexe)
    }</span><span class="dots"></span></div>

    <div class="row"><span class="label">Situation matrimoniale :</span><span class="dots"></span></div>
    <div class="checks">
      <span class="check">${check('marie')} Marié(e)</span>
      <span class="check">${check('concubinage')} Concubinage</span>
      <span class="check">${check('celibataire')} Célibataire</span>
    </div>

    <div class="row"><span class="label">Religion :</span><span class="val">${
      escapeHtml(d.religion)
    }</span><span class="dots"></span></div>
    <div class="row"><span class="label">Ethnie :</span><span class="val">${
      escapeHtml(d.ethnie)
    }</span><span class="dots"></span></div>
    <div class="row"><span class="label">Emploi recherché :</span><span class="val">${
      escapeHtml(d.categorie_emploi)
    }</span><span class="dots"></span></div>
    <div class="row"><span class="label">Niveau d'étude :</span><span class="val">${
      escapeHtml(d.niveau_etude)
    }</span><span class="dots"></span></div>
    <div class="row"><span class="label">Avez-vous déjà travaillé ? Si oui précisez :</span><span class="val">${
      d.deja_travaille ? 'Oui — ' + escapeHtml(d.experience_details) : 'Non'
    }</span><span class="dots"></span></div>
    <div class="row"><span class="label">Avez-vous une allergie ou des problèmes de santé ? Si oui précisez :</span><span class="val">${
      escapeHtml(d.allergie_sante)
    }</span><span class="dots"></span></div>
    <div class="row"><span class="label">Avez-vous déjà subi une/des intervention(s) chirurgicale(s) si oui précisez :</span><span class="val">${
      escapeHtml(d.intervention_chirurgicale)
    }</span><span class="dots"></span></div>

    <!-- SECTION URGENCE -->
    <div class="sectionBar">PERSONNES A CONTACTER EN CAS D'URGENCE</div>
    <div class="urgGrid">
      ${urgCol(c1)}
      ${urgCol(c2)}
    </div>

    <!-- PIED -->
    <div class="clause"><span>Le tiers (1/3) sur le premier salaire :</span><span class="dots"></span></div>
    <div class="clause"><span>Frais de dossier :</span><span class="dots"></span><span class="small">valable pour un(1) mois et non remboursable.</span></div>

    <div class="signs">
      <div class="sign"><div class="line">EMPLOYE</div></div>
      <div class="sign"><div class="line">CHRISROI AGENCE</div></div>
    </div>
  </div>
</body>
</html>`;
}

// Aide web : l'URL distante fonctionne telle quelle pour window.print().
// (Sur natif, expo-print gère les data URI ; on laisse le champ photo tel quel.)
export const isWeb = Platform.OS === 'web';
