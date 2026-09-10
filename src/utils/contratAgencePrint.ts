// Générateur HTML/PDF — CONTRAT AGENCE recto-verso (Employé / Employeur)
// Second format, en plus du Contrat de prestation (contratPrint.ts).
// Verbatim du docx "contrat_chrisroi_agence" : 2 pages, clauses reprises mot pour mot.
// Design premium aligné sur contratPrint.ts (marine #0c1f3f, doré, header, badges).

import { CONTRAT_HEADER_URI } from './contratPrint';
import { getNiveauEtudeLabel } from './constants';

export interface PrintContratAgenceContext {
  contrat: any;
  employe?: any; // enrichi : parents, personnes_urgence, experiences (getEmployeById)
  employeur?: any;
  photoUrl?: string | null;
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

const formatDateShort = (s: string | null | undefined): string => {
  if (!s) return '—';
  const t = String(s).trim();
  const d = new Date(t);
  if (!isNaN(d.getTime())) return d.toLocaleDateString('fr-FR');
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(t)) return t;
  return escapeHtml(t);
};

const formatMoney = (n: number | null | undefined): string => {
  if (n === null || n === undefined || n === 0) return '—';
  return `${Number(n).toLocaleString('fr-FR')} FCFA`;
};

const pill = (label: string, checked: boolean): string =>
  `<span class="check-pill${checked ? ' on' : ''}">${escapeHtml(label)}${checked ? ' &#10003;' : ''}</span>`;

const SITUATION_LABELS: Record<string, string> = {
  celibataire: 'Célibataire',
  marie: 'Marié(e)',
  concubinage: 'Concubinage',
  divorce: 'Divorcé(e)',
  veuf: 'Veuf/Veuve',
};

export function buildContratAgenceHtml(ctx: PrintContratAgenceContext): string {
  const c = ctx.contrat || {};
  const e = ctx.employe || {};
  const emp = ctx.employeur || {};

  const numero = escapeHtml(c?.numero_dossier || '—');
  const dateSignature = c?.date_signature || c?.date_contrat || new Date().toISOString();
  const dateSignatureStr = formatDateShort(dateSignature);

  // ── Employé ──
  const employeNom = escapeHtml(
    [e?.prenom, e?.nom].filter(Boolean).join(' ') ||
      [c?.employe_prenom, c?.employe_nom].filter(Boolean).join(' ') ||
      '—',
  );
  const naissanceDate = e?.date_naissance ? formatDateShort(String(e.date_naissance)) : '—';
  const naissanceLieu = escapeHtml(e?.lieu_naissance || '—');
  const tel1 = escapeHtml(e?.telephone || '—');
  const employeAdresse = escapeHtml(
    c?.employe_adresse_actuelle || e?.lieu_residence || c?.domicile_employe || '—',
  );
  const situation = String(e?.situation_matrimoniale || '').toLowerCase();
  const religion = escapeHtml(e?.religion || '—');
  const ethnie = escapeHtml(e?.ethnie || '—');
  const diplome = escapeHtml(e?.niveau_etude ? getNiveauEtudeLabel(String(e.niveau_etude)) : e?.formations || '—');

  const fraisDossier = c?.frais_dossier ?? null;
  const fraisDossierStr = formatMoney(fraisDossier);
  const dateEmbauche = c?.date_debut ? formatDateShort(String(c.date_debut)) : '—';
  const aTravaille = e?.a_deja_travaille === true;
  const nAjamaisTravaille = e?.a_deja_travaille === false;
  const exp0 = (e?.experiences || [])[0] || null;
  const ancienPatron = escapeHtml(
    exp0 ? [exp0.entreprise, exp0.contact].filter(Boolean).join(' — ') : '—',
  );

  const parents = e?.parents || [];
  const pere = parents.find((p: any) => String(p?.type || '').toLowerCase() === 'pere') || null;
  const mere = parents.find((p: any) => String(p?.type || '').toLowerCase() === 'mere') || null;
  const nomPere = escapeHtml(pere ? [pere.prenom, pere.nom].filter(Boolean).join(' ') : '—');
  const nomMere = escapeHtml(mere ? [mere.prenom, mere.nom].filter(Boolean).join(' ') : '—');
  const domicilePere = escapeHtml(pere?.domicile || '—');

  const urgences = (e?.personnes_urgence || []).slice(0, 3);
  while (urgences.length < 3) urgences.push(null);
  const urgenceRows = urgences
    .map((u: any) => {
      const nomComplet = u ? [u.prenom, u.nom].filter(Boolean).join(' ') : '';
      const tel = u && u.telephone ? String(u.telephone) : '';
      return '<p>Noms et pr&eacute;noms : <span class="field">' + (nomComplet || '—') + '</span> &nbsp; Contact : <span class="field">' + (tel || '—') + '</span></p>';
    })
    .join('\n');

  const duree = escapeHtml(c?.duree || 'trois (03) mois');
  const dateDebutStr = c?.date_debut ? formatDateShort(String(c.date_debut)) : dateSignatureStr;

  // ── Employeur ──
  const employeurNom = escapeHtml(
    c?.nom_complet || emp?.nom_complet || c?.client_nom_snapshot || '—',
  );
  const employeurDomicile = escapeHtml(c?.client_domicile || emp?.adresse || '—');
  const employeurContact = escapeHtml(
    c?.employeur_telephone || emp?.telephone || '—',
  );
  const emploiPropose = escapeHtml(c?.poste || e?.categorie_emploi || '—');
  const salairePropose = formatMoney(c?.salaire ?? null);
  const commissionFixe = formatMoney(c?.commission_fixe ?? 15000);
  const fraisTransport = formatMoney(c?.frais_transport ?? 5000);
  const retenue = c?.retenue_salaire_montant ?? (c?.salaire ? Math.round(Number(c.salaire) / 3) : null);
  const retenueStr = retenue !== null && retenue !== undefined ? formatMoney(retenue) : '—';

  let photoBlock = `<span class='photo-ph'>PHOTO</span>`;
  if (ctx.photoUrl) {
    photoBlock = `<img src='${escapeHtml(ctx.photoUrl)}' style='width:100%;height:100%;object-fit:cover;border-radius:4px;' alt='Photo'>`;
  }

  const signatures = `
  <div class="sign-grid">
    <div class="sig"><div><p>L'employ&eacute;</p><small>${employeNom}</small></div><div class="sig-line">Lu et approuv&eacute; + signature</div></div>
    <div class="sig"><div><p>ChrisRoi Agence</p><small>Mme Yao Lou Rose, G&eacute;rante</small></div><div class="sig-line">Cachet + signature</div></div>
    <div class="sig"><div><p>L'employeur</p><small>${employeurNom}</small></div><div class="sig-line">Lu et approuv&eacute; + signature</div></div>
  </div>`;

  const footer = `
  <footer class="footer">
    <strong>CHRISROI AGENCE</strong> &mdash; EI au Capital de 500&nbsp;000&nbsp;FCFA &mdash; Si&egrave;ge Social : Cocody Angr&eacute;-Ch&acirc;teau, Rue&nbsp;M42 &mdash; T&eacute;l : +225&nbsp;27&nbsp;22&nbsp;34&nbsp;22&nbsp;83 / +225&nbsp;05&nbsp;03&nbsp;97&nbsp;47&nbsp;75 &mdash; RCCM&nbsp;N&deg;&nbsp;CI-2023-0063618S &mdash; CC&nbsp;N&deg;&nbsp;2304937&nbsp;D &mdash; Email : chrisroiagence@gmail.com &mdash; Site : Chrisroiagence.com
  </footer>`;

  const header = `
  <header class="header">
    <img class="logo" src="${CONTRAT_HEADER_URI}" alt="Logo">
    <div class="brand">
      <div class="kicker">Placement de personnels &bull; Service de nettoyage &bull; Courtage immobilier</div>
      <div class="kicker">T&eacute;l : +225 27 22 34 22 83 / +225 05 03 97 47 75</div>
      <div class="name">CHRISROI <span class="gold">AGENCE</span></div>
    </div>
    <img class="logo" src="${CONTRAT_HEADER_URI}" alt="" style="visibility:hidden; width:42px;">
  </header>`;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Contrat Agence ${numero}</title>
<style>
  @page { size: A4; margin: 3mm 2mm 3mm 2mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: #eef1f5; color: #111827;
    font-family: "Times New Roman", Times, Georgia, serif;
    line-height: 1.38; font-size: 9.5pt;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .sheet {
    width: min(210mm, calc(100% - 32px));
    margin: 24px auto; background: #fff;
    border: 1px solid #cfd6e2; border-radius: 10px;
    box-shadow: 0 12px 36px rgba(15,23,42,.14);
    overflow: hidden;
  }
  .header {
    display: flex; align-items: center; justify-content: center; gap: 16px;
    padding: 8px 16px 6px; background: #fff;
    border-bottom: 2.5px solid #0c1f3f;
  }
  .header img.logo { width: 56px; height: 56px; object-fit: contain; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; flex-shrink: 0; }
  .header .brand { font-family: Arial, Helvetica, sans-serif; text-align: center; }
  .header .kicker { font-size: 7pt; letter-spacing: .08em; text-transform: uppercase; color: #0c1f3f; font-weight: 700; line-height: 1.35; }
  .header .name { font-size: 17pt; font-weight: 900; color: #0c1f3f; letter-spacing: .04em; line-height: 1; margin-top: 4px; }
  .header .name .gold { color: #c9a227; }
  .page-pad { padding: 5px 7px 4px; }
  h1.doc-title {
    text-align: center; font-family: Arial Black, Arial, sans-serif;
    font-size: 11pt; font-weight: 900; color: #0c1f3f;
    letter-spacing: .04em; text-transform: uppercase;
    margin: 8px 0 4px;
  }
  h1.doc-title .page-tag {
    display: inline-block; font-size: 8pt; background: #c9a227; color: #0c1f3f;
    padding: 3px 10px; border-radius: 999px; vertical-align: middle; letter-spacing: .08em;
  }
  .ref-badge { text-align: center; margin-bottom: 6px; }
  .ref-badge span {
    display: inline-block; font-family: Arial, sans-serif; font-size: 7.5pt; font-weight: 800;
    background: #0c1f3f; color: #fff; padding: 4px 10px; border-radius: 999px;
  }
  .divider { height: 1px; background: #0c1f3f; opacity: .14; margin: 6px 0 8px; }
  h2.article {
    font-family: Arial, Helvetica, sans-serif; font-size: 9pt; font-weight: 800;
    color: #fff; background: #0c1f3f; padding: 4px 10px; border-radius: 4px;
    margin: 10px 0 6px; letter-spacing: .03em; text-transform: uppercase;
    break-after: avoid; break-inside: avoid;
  }
  h2.article .n { color: #c9a227; }
  p { margin: 0 0 5px; text-align: justify; hyphens: auto; }
  .field { display: inline-block; min-width: 110px; border-bottom: 1px dotted #111827; padding: 0 3px 1px; font-weight: 700; color: #0c1f3f; }
  .field.small { min-width: 80px; }
  .field.wide { min-width: 200px; }
  .parties { border: 1px solid #c8d0dc; border-radius: 6px; padding: 8px 10px; background: #f8fafc; margin-bottom: 8px; }
  .parties p { margin-bottom: 4px; }
  .check-pill {
    display: inline-block; font-family: Arial, sans-serif; font-size: 8pt; font-weight: 700;
    border: 1.5px solid #0c1f3f; border-radius: 4px; padding: 2px 8px; margin: 0 2px 0 6px; color: #0c1f3f;
  }
  .check-pill.on { background: #0c1f3f; color: #c9a227; }
  .money { border: 1px solid #c9a227; background: #fffdf5; border-radius: 6px; padding: 6px 10px; margin-bottom: 8px; }
  .money p { margin-bottom: 4px; }
  .duree-box { border: 1px solid #0c1f3f; border-radius: 6px; padding: 6px 10px; background: #f8fafc; text-align: center; margin-top: 8px; }
  .photo-frame { width: 35mm; height: 45mm; border: 2px solid #0c1f3f; border-radius: 6px; background: #f8fafc; display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; }
  .photo-ph { font-family: Arial, sans-serif; font-size: 8pt; font-weight: 800; color: #0c1f3f; letter-spacing: .1em; }
  .sign-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-top: 12px; }
  .sig { border: 2px solid #0c1f3f; border-radius: 6px; min-height: 110px; padding: 8px; display: flex; flex-direction: column; justify-content: space-between; background: #fff; }
  .sig p { margin: 0; font-family: Arial, sans-serif; font-size: 8pt; color: #0c1f3f; text-transform: uppercase; letter-spacing: .04em; font-weight: 800; }
  .sig small { font-family: Arial, sans-serif; color: #0c1f3f; font-weight: 800; font-size: 9pt; }
  .sig-line { border-top: 2px solid #0c1f3f; margin-top: 16px; padding-top: 6px; font-family: Arial, sans-serif; font-size: 8pt; color: #0c1f3f; font-weight: 700; text-align: center; }
  .footer {
    margin-top: 8px; border-top: 1px solid #e5e7eb; padding: 6px 14px 8px;
    font-family: Arial, sans-serif; font-size: 6.8pt; color: #5c6675; text-align: center; line-height: 1.4; background: #f8fafc;
  }
  .footer strong { color: #0c1f3f; }
  /* Page 2 (Employeur) : contenu plus court — on l'aère pour remplir la feuille */
  .sheet:last-of-type h2.article { margin: 14px 0 8px; padding: 5px 10px; }
  .sheet:last-of-type p { margin-bottom: 7px; }
  .sheet:last-of-type .parties { padding: 10px 12px; }
  .sheet:last-of-type .sign-grid { margin-top: 22px; }
  .sheet:last-of-type .sig { min-height: 170px; }
  .sheet:last-of-type .footer { margin-top: 18px; }
  @media print {
    body { background: #fff; }
    .sheet { width: 100%; margin: 0; border: none; box-shadow: none; border-radius: 0; page-break-after: always; }
    .sheet:last-child { page-break-after: auto; }
  }
</style>
</head>
<body>

<div class="sheet">
  ${header}
  <div class="page-pad">

  <h1 class="doc-title">Contrat Agence &mdash; <span class="page-tag">Employ&eacute;</span></h1>
  <div class="ref-badge"><span>R&eacute;f. ${numero} &mdash; Fait &agrave; Abidjan le ${dateSignatureStr}</span></div>
  <div class="divider"></div>

  <section>
    <h2 class="article"><span class="n">§1</span> &mdash; Identit&eacute; de l'employ&eacute;</h2>
    <div style="display:flex; gap:12px; align-items:stretch;">
    <div class="parties" style="flex:1; margin-bottom:0;">
      <p>Nom et pr&eacute;noms : <span class="field wide">${employeNom}</span></p>
      <p>Date et lieu de naissance : <span class="field small">${naissanceDate}</span> &agrave; <span class="field">${naissanceLieu}</span></p>
      <p>Cel : <span class="field">${tel1}</span></p>
      <p>Lieu d'habitation : <span class="field wide">${employeAdresse}</span></p>
      <p>Situation matrimoniale :
        ${pill('Marié(e)', situation === 'marie')}
        ${pill('Concubinage', situation === 'concubinage')}
        ${pill('Célibataire', situation === 'celibataire' || !situation)}</p>
      <p>Religion : <span class="field">${religion}</span> ; Ethnie : <span class="field">${ethnie}</span> ; Dipl&ocirc;me : <span class="field">${diplome}</span></p>
    </div>
    <div class="photo-frame">${photoBlock}</div>
    </div>
  </section>

  <section>
    <h2 class="article"><span class="n">§2</span> &mdash; Embauche</h2>
    <div class="money">
      <p>Frais de dossier : <span class="field">${fraisDossierStr}</span></p>
      <p>Date d'embauche : <span class="field small">${dateEmbauche}</span> &mdash; <em>Valable pour un (1) mois et non remboursable.</em></p>
      <p>A d&eacute;j&agrave; travaill&eacute; : ${pill('Oui', aTravaille)} ${pill('Non', nAjamaisTravaille)}
        &nbsp;Si oui, contact ancien patron : <span class="field">${ancienPatron}</span></p>
    </div>
  </section>

  <section>
    <h2 class="article"><span class="n">§3</span> &mdash; Parents</h2>
    <div class="parties">
      <p>Nom et pr&eacute;noms du P&egrave;re : <span class="field wide">${nomPere}</span></p>
      <p>Nom et pr&eacute;noms de la M&egrave;re : <span class="field wide">${nomMere}</span></p>
      <p>Domicile ou quartier du p&egrave;re : <span class="field wide">${domicilePere}</span></p>
    </div>
  </section>

  <section>
    <h2 class="article"><span class="n">§4</span> &mdash; Personnes &agrave; contacter en cas d'urgence</h2>
    <div class="parties" style="background:#fff;">
      ${urgenceRows}
    </div>
  </section>

  <section>
    <h2 class="article"><span class="n">§5</span> &mdash; Responsabilit&eacute;s de l'employ&eacute;</h2>
    <p>L'employ&eacute; est tenu de respecter son employeur dans l'exercice de ses fonctions.</p>
    <p>L'employ&eacute; r&eacute;pondra de ses actes devant les autorit&eacute;s ou les juridictions comp&eacute;tentes pour les actes de vols, fraude, ou tout autres d&eacute;lits.</p>
  </section>

  <section>
    <h2 class="article"><span class="n">§6</span> &mdash; Dur&eacute;e</h2>
    <div class="duree-box">
      <p style="text-align:center; margin:0;">Le pr&eacute;sent contrat est conclu pour une dur&eacute;e de <span class="field">${duree}</span><br>qui commence &agrave; courir &agrave; compter du <span class="field small">${dateDebutStr}</span></p>
    </div>
  </section>

  ${signatures}
  ${footer}
  </div>
</div>

<div class="sheet">
  ${header}
  <div class="page-pad">

  <h1 class="doc-title">Contrat Agence &mdash; <span class="page-tag">Employeur</span></h1>
  <div class="ref-badge"><span>R&eacute;f. ${numero} &mdash; Fait &agrave; Abidjan le ${dateSignatureStr}</span></div>
  <div class="divider"></div>

  <section>
    <h2 class="article"><span class="n">§1</span> &mdash; Identit&eacute; de l'employeur</h2>
    <div class="parties">
      <p>Nom et Pr&eacute;noms : <span class="field wide">${employeurNom}</span></p>
      <p>Domicile et quartier : <span class="field wide">${employeurDomicile}</span> ; Contact : <span class="field">${employeurContact}</span></p>
      <p>Emploi propos&eacute; : <span class="field wide">${emploiPropose}</span> ; Salaire propos&eacute; : <span class="field">${salairePropose}</span></p>
    </div>
  </section>

  <section>
    <h2 class="article"><span class="n">§2</span> &mdash; Conditions financi&egrave;res</h2>
    <div class="money">
      <p>Commission : <strong>${commissionFixe}</strong> &mdash; Valable pour un (1) mois et non remboursable. Transport pour le d&eacute;placement du personnel de l'agence (<strong>${fraisTransport}</strong>).</p>
      <p>Le tiers (1/3) sur le premier salaire (montant pr&eacute;lev&eacute; par l'employeur sur le salaire de l'employ&eacute;(e)) : <span class="field small">${retenueStr}</span></p>
    </div>
  </section>

  <section>
    <h2 class="article"><span class="n">§3</span> &mdash; Responsabilit&eacute;s de l'employeur</h2>
    <p>L'employeur est tenu de conna&icirc;tre le domicile des parents de son employ&eacute;(e) d&egrave;s la signature du contrat d'embauche.</p>
    <p>Toute t&acirc;che qui n'a pas &eacute;t&eacute; signal&eacute;e &agrave; l'employ&eacute;(e) &agrave; la signature du contrat entra&icirc;ne l'annulation du contrat.</p>
    <p>L'employeur est tenu d'assurer les premiers soins en cas de maladie de l'employ&eacute;(e) et d'aviser le plus t&ocirc;t possible les parents de ce dernier.</p>
    <p>En cas de renvoi, l'employeur est tenu d'aviser CHRISROI AGENCE.</p>
    <p>L'employ&eacute;(e) doit &ecirc;tre pay&eacute; au plus grand tard le 5 du mois.</p>
    <p>Les arri&eacute;r&eacute;s de salaires ne sont pas accept&eacute;s.</p>
    <p>CHRISROI AGENCE condamne les actes de vol, bagarres, maltraitance, privation de nourriture, violence verbale, harc&egrave;lement sexuel, viol et autre d&eacute;sagr&eacute;ment au lieu de service.</p>
    <p>En cas d'abandon de service ou d&eacute;faillance de l'employ&eacute;(e), CHRISROI AGENCE proc&egrave;dera &agrave; un remplacement de personnel dans un d&eacute;lai d'une semaine maximum.</p>
  </section>

  ${signatures}
  ${footer}
  </div>
</div>

</body>
</html>`;
}
