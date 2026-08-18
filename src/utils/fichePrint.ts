// Générateur HTML/PDF de la FICHE D'INSCRIPTION — VERSION PAPIER STRICTE.
//
// Important : cette version ne reprend QUE les champs de la fiche papier
// (Employé + Personnes à contacter en cas d'urgence + clauses + signatures).
// Elle ne contient pas les sections "Parents" / "Expériences" du formulaire
// numérique enrichi — celles-ci restent dans l'app, mais n'apparaissent pas
// sur la feuille physique.
//
// Design : fidèle à la maquette d'origine Qwen (mockups/Qwen_html_20260818_tljt4cd1p.html),
// prévue pour tenir SUR UNE PAGE A4. Layout 2 colonnes, photo à droite, bandeaux
// bleu nuit, cases matrimoniale en "pill". Clauses = NOS clauses CHRISROI
// (validées) : tiers (1/3) sur 1er salaire + frais de dossier 5000 FCFA.
//
// Cross-platform : imprimable via expo-print (printToFileAsync → PDF natif)
// ou via window.print() sur le web, exactement comme contratPrint.ts.

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
  const opt = (v: string, label: string) =>
    `<span class="option${sit === v ? ' selected' : ''}">${escapeHtml(label)}${
      sit === v ? '<span class="sr-only">(sélectionné)</span>' : ''
    }</span>`;

  const dateStr = d.date ? escapeHtml(d.date) : new Date().toISOString().slice(0, 10);

  // 2 contacts d'urgence (papier : exactement 2)
  const u = d.urgence || [];
  const c1 = u[0] || {};
  const c2 = u[1] || {};
  const contactCard = (title: string, c: any) => `
    <article class="contact-card">
      <h3>${escapeHtml(title)}</h3>
      <dl class="fields" style="grid-template-columns: 1fr;">
        <div class="field"><dt>Nom et prénoms</dt><dd>${escapeHtml([c.prenom, c.nom].filter(Boolean).join(' '))}</dd></div>
        <div class="field"><dt>Contact</dt><dd>${escapeHtml(c.telephone)}</dd></div>
        <div class="field"><dt>Lieu d'habitation</dt><dd>${escapeHtml(c.lieu)}</dd></div>
      </dl>
    </article>`;

  const photo = photoHtml(d.photo, d.photoDataUri);

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Fiche d'inscription — CHRISROI AGENCE</title>
<style>
  @page { size: A4; margin: 10mm; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #eef1f5; color: #10151c; font-family: Arial, Helvetica, sans-serif; line-height: 1.35; font-size: 13px; }
  .sheet { width: 100%; background: #fff; border: 1px solid #cfd6e2; }
  .header { background: #0c1f3f; color: #fff; display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 12px 18px; }
  .header h1 { margin: 0; font-size: 22px; line-height: 1.1; text-transform: uppercase; letter-spacing: 0.04em; }
  .header p { margin: 0; text-align: right; font-size: 12px; line-height: 1.4; opacity: 0.92; }
  .layout { display: grid; grid-template-columns: 1fr 120px; gap: 14px; padding: 14px 18px; align-items: start; }
  .photo-frame { margin: 0; border: 2px solid #0c1f3f; padding: 3px; background: #fff; width: 120px; }
  .photo-frame img { display: block; width: 100%; height: 132px; object-fit: cover; background: #e8edf5; }
  .section { padding: 0 18px 14px; }
  .section-title { margin: 0 0 8px; background: #0c1f3f; color: #fff; padding: 6px 10px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
  .fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 16px; margin: 0; }
  .field { margin: 0; padding: 0; }
  .field dt { margin: 0; font-size: 10px; color: #5c6675; text-transform: uppercase; letter-spacing: 0.03em; }
  .field dd { margin: 3px 0 0; font-size: 14px; font-weight: 600; color: #10151c; min-height: 1.1em; }
  .field.full { grid-column: 1 / -1; }
  .marital { display: flex; flex-wrap: wrap; gap: 6px; }
  .option { display: inline-flex; align-items: center; gap: 6px; border: 1px solid #c8d0dc; border-radius: 4px; padding: 4px 7px; font-size: 12px; color: #5c6675; background: #fff; }
  .option.selected { border-color: #0c1f3f; color: #0c1f3f; font-weight: 700; background: #edf3ff; }
  .option.selected::before { content: "\\2713"; }
  .contacts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .contact-card { border: 1px solid #c8d0dc; border-radius: 6px; padding: 10px; background: #fff; }
  .contact-card h3 { margin: 0 0 8px; font-size: 13px; color: #0c1f3f; }
  .clauses { display: grid; gap: 6px; }
  .clause { margin: 0; border: 1px solid #c8d0dc; background: #f8fafc; padding: 8px 10px; font-size: 13px; line-height: 1.4; }
  .clause strong { color: #0c1f3f; }
  .signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .signature-box { border: 1px solid #98a2b3; border-radius: 6px; min-height: 90px; padding: 8px; display: flex; flex-direction: column; justify-content: space-between; }
  .signature-box p { margin: 0; font-size: 11px; color: #5c6675; text-transform: uppercase; letter-spacing: 0.03em; }
  .signature-line { border-top: 1px solid #98a2b3; margin-top: 24px; padding-top: 5px; font-size: 11px; color: #5c6675; }
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
  @media print { body { background: #fff; } .sheet { border: none; } .no-print { display: none !important; } }
  @media (max-width: 700px) { .layout, .fields, .contacts, .signature-grid { grid-template-columns: 1fr; } .photo-frame { justify-self: start; } .header { flex-direction: column; align-items: flex-start; } .header p { text-align: left; } }
</style>
</head>
<body>
  <main class="sheet" aria-label="Fiche d'inscription CHRISROI AGENCE">
    <header class="header">
      <h1>Fiche d'inscription</h1>
      <p>CHRISROI AGENCE<br>Agence de placement</p>
    </header>

    <section class="layout" aria-labelledby="employe-title">
      <div>
        <h2 id="employe-title" class="section-title">Employé(e)</h2>
        <dl class="fields">
          <div class="field"><dt>Date</dt><dd>${dateStr}</dd></div>
          <div class="field"><dt>Nom et prénoms</dt><dd>${escapeHtml([d.nom, d.prenom].filter(Boolean).join(' '))}</dd></div>
          <div class="field"><dt>Date et lieu de naissance</dt><dd>${escapeHtml([d.date_naissance, d.lieu_naissance].filter(Boolean).join(' à '))}</dd></div>
          <div class="field"><dt>Numéro de téléphone</dt><dd>${escapeHtml(d.telephone)}</dd></div>
          <div class="field"><dt>Lieu d'habitation</dt><dd>${escapeHtml(d.lieu_residence)}</dd></div>
          <div class="field"><dt>Nationalité</dt><dd>${escapeHtml(d.nationalite)}</dd></div>
          <div class="field"><dt>Sexe</dt><dd>${escapeHtml(d.sexe)}</dd></div>
          <div class="field full">
            <dt>Situation matrimoniale</dt>
            <dd><div class="marital" role="group" aria-label="Situation matrimoniale">
              ${opt('marie', 'Marié(e)')}
              ${opt('concubinage', 'Concubinage')}
              ${opt('celibataire', 'Célibataire')}
            </div></dd>
          </div>
          <div class="field"><dt>Religion</dt><dd>${escapeHtml(d.religion)}</dd></div>
          <div class="field"><dt>Ethnie</dt><dd>${escapeHtml(d.ethnie)}</dd></div>
          <div class="field"><dt>Emploi recherché</dt><dd>${escapeHtml(d.categorie_emploi)}</dd></div>
          <div class="field"><dt>Niveau d'études</dt><dd>${escapeHtml(d.niveau_etude)}</dd></div>
          <div class="field full"><dt>Avez-vous déjà travaillé ? Si oui, précisez</dt><dd>${d.deja_travaille ? 'Oui — ' + escapeHtml(d.experience_details) : 'Non'}</dd></div>
          <div class="field full"><dt>Avez-vous des allergies ou des problèmes de santé ? Si oui, précisez</dt><dd>${escapeHtml(d.allergie_sante)}</dd></div>
          <div class="field full"><dt>Avez-vous déjà subi une ou plusieurs interventions chirurgicales ? Si oui, précisez</dt><dd>${escapeHtml(d.intervention_chirurgicale)}</dd></div>
        </dl>
      </div>
      <figure class="photo-frame">${photo}</figure>
    </section>

    <section class="section" aria-labelledby="urgences-title">
      <h2 id="urgences-title" class="section-title">Personnes à contacter en cas d'urgence</h2>
      <div class="contacts">
        ${contactCard('Contact 1', c1)}
        ${contactCard('Contact 2', c2)}
      </div>
    </section>

    <section class="section" aria-labelledby="clauses-title">
      <h2 id="clauses-title" class="section-title">Clauses</h2>
      <div class="clauses">
        <p class="clause">Le tiers (<strong>1/3</strong>) sur le premier salaire est prélevé par l'agence au titre de ses frais de placement.</p>
        <p class="clause">Frais de dossier : <strong>5000 FCFA</strong> — valable pour un (1) mois et non remboursable.</p>
      </div>
    </section>

    <section class="section" aria-labelledby="signatures-title">
      <h2 id="signatures-title" class="section-title">Signatures</h2>
      <div class="signature-grid">
        <div class="signature-box"><p>Employé(e)</p><div class="signature-line">Signature</div></div>
        <div class="signature-box"><p>CHRISROI AGENCE</p><div class="signature-line">Signature et cachet</div></div>
      </div>
    </section>
  </main>
</body>
</html>`;
}

// Aide web : l'URL distante fonctionne telle quelle pour window.print().
// (Sur natif, expo-print gère les data URI ; on laisse le champ photo tel quel.)
export const isWeb = Platform.OS === 'web';
