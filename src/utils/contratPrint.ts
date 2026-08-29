// Générateur HTML/PDF — CONTRAT DE PRESTATION DE SERVICE DE PLACEMENT
// Remplace définitivement l'ancien "Contrat de travail".
// Verbatim 10 articles du docx "Papier entête CHRISROI ..." (5 pages WPS, 1268 mots).
// Calé sur 3 pages A4 à l'impression : @page 10mm, 10pt, header/footer compacts.
// Header/Footer répétés visuellement sur chaque page (fixed via @page equiv.).
// Cross-platform : window.print (web) + expo-print printToFileAsync (natif).

import type { ContratsRecord as Contrat } from '../types/pb-generated';

// Header image du docx (word/media/image1.jpeg, 7475 bytes) + fallback logo texte
const HEADER_JPEG_B64 =
  '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WJARARARATDBjBjBjBzDjBjBjBjBjBjBhF7BjBjBjAARARARACKRARARAQkxARARATE5ARARATDBjBjBiLjBjB7djbJtjZDBjBhVjBjBjAARARART1ARARBPQf69phoRARALIRARATDBjBjBlpjBjBh8UQDyf9jBjBjD3BjBjAARARASkRARARBUIADV3dARARAQURARATDBjBjA/BjBjBjCuJ7XtpjBjBjCzBjBjAARARATcRARARARc6wBsRARARARIRARATDBjBjD7BjBjBjBjSFBjBjBjBjBrBjBjAARARARARUhYVktMJpVolURU5ITIRARATDBjBjAzJvX6Zjv+HrDUdyVJ+nBbBjBjAARARAQIwGQCTEVEbJXLbKRGaJTIRARATDBjBjBj9DBjBjBjBjBjBjBjBi7jBjBjAARARARAZsRARARARARARARAQwRARARATDBjBjBjD9BjBjBjBjBjBjBj5rBjBjBjAARARARARBd8xARARARARARZZARARARATDBjBjBjBjBqdLhjBjBjBaWrBjBjBjBjAARARARARARAQHYgxgSa9ERARARARARATDBjBjBjBjBjBjBjBjBjBjBjBjBjBjBjAARARARARARARARARARARARARARARARATDBjBjBjBjBjBjBjBjBjBjBjBjBjBjBjAARARARARARARARARARARARARARARARATDBjBjBjBjBjBjBjBjBjBjBjBjBjBjBjAABwBwBwBwBwBwBwBwBwBwBwBwBwBwBwAD/2gAMAwEAAgADAAAAEDJDJDJDJDJDJDJDJDJDJDJDJDJDJDJDPOLOLOLOLOLOLOLOLOLOLOLOLOLOLOLODDJDJDJDJDJDJDJDJDJDJDJDJDJDJDJDPOLOLOLOLOLOLOLOLOLOLOLOLOLOLOLODDJDJDJDJDJDJDJDJDJDJDJDJDJDJDJDPOLOLOLOLOLOKNTdprhsrOLOLOLOLOLODDJDJDJDJDIB/TJDJDJHALLDJDJDJDJDPOLOLOLOLPD+LOLOLOLOLKKEbOLOLOLODDJDJDJDJJBDJDJDJDJDJDJGqTJDJDJDPOLOLOLOPmLOLOLOHcLOLOLOLMrOLOLODDJDJDJCZDJDIy5CS75DxzJDJCJDJDJDPOLOLOKMrOLOLPpsTL4fj+LOLPZ+LOLODDJDJDJhpDJDJAvccQW1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';
const HEADER_URI = `data:image/jpeg;base64,${HEADER_JPEG_B64}`;

export interface PrintContratContext {
  contrat: any;
  employe?: any;
  employeur?: any;
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

const formatDateFr = (s: string | null | undefined): string => {
  if (!s) return '—';
  const t = String(s).trim();
  if (!t || !/[\dT]/.test(t)) return '—';
  const d = new Date(t);
  if (isNaN(d.getTime())) {
    // déjà format JJ/MM/AAAA ?
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(t)) return t;
    return escapeHtml(t);
  }
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
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

const calcAge = (dateNaissance: string | null | undefined): number | null => {
  if (!dateNaissance) return null;
  const d = new Date(String(dateNaissance));
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 ? age : null;
};

export function buildContratHtml(ctx: PrintContratContext): string {
  const c = ctx.contrat || {};
  const e = ctx.employe || {};
  const emp = ctx.employeur || {};

  // Numéro / dates - snapshot d'abord, fallback relation
  const numero = escapeHtml(c?.numero_dossier || '—');
  const dateSignature = c?.date_signature || c?.date_contrat || new Date().toISOString();
  const dateSignatureStr = formatDateShort(dateSignature);
  const dateSignatureLong = formatDateFr(dateSignature);

  // Client (employeur devient Client) - snapshot prioritaire
  const clientNom = escapeHtml(
    c?.client_nom_snapshot || c?.nom_complet || emp?.nom_complet || emp?.raison_sociale || '—',
  );
  const clientDomicile = escapeHtml(c?.client_domicile || emp?.adresse || c?.domicile_employe || '—');
  const clientPieceNum = escapeHtml(c?.client_piece_numero || (emp as any)?.piece_numero || '—');
  const clientPieceDateRaw = c?.client_piece_date || (emp as any)?.piece_date || null;
  const clientPieceDate = clientPieceDateRaw ? formatDateShort(String(clientPieceDateRaw)) : '—';

  // Employé - snapshot + fallback fiche
  const employeNomComplet = escapeHtml(
    [c?.employe_prenom, c?.employe_nom].filter(Boolean).join(' ') ||
      [e?.prenom, e?.nom].filter(Boolean).join(' ') ||
      c?.employe_nom_complet ||
      '—',
  );
  const employeAgeVal = c?.employe_age ?? calcAge(e?.date_naissance ?? c?.date_naissance);
  const employeAge = employeAgeVal !== null && employeAgeVal !== undefined ? `${employeAgeVal} ans` : '—';
  const employeSexe = escapeHtml(c?.employe_sexe || (e as any)?.sexe || '—');
  const employePoste = escapeHtml(c?.poste || (e as any)?.categorie_emploi || '—');
  const employeAdresse = escapeHtml(
    c?.employe_adresse_actuelle || e?.lieu_residence || c?.domicile_employe || '—',
  );
  const employePiece = escapeHtml(
    c?.employe_piece_reference || (e as any)?.piece_reference || '—',
  );

  // Prix - Art 3 + Art 8
  const fraisTransport = c?.frais_transport ?? c?.frais_transport_montant ?? 5000;
  const fraisTransportStr = formatMoney(fraisTransport);
  const retenue = c?.retenue_salaire_montant ?? (c?.salaire ? Math.round(Number(c.salaire) / 3) : null);
  const retenueStr = retenue !== null && retenue !== undefined ? formatMoney(retenue) : '—';

  // Pour compatibilité ancien contrat, on garde salaire si présent mais non affiché comme avant
  // (le nouveau papier n'affiche que Art3/Art8)

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Contrat ${numero}</title>
<style>
  @page { size: A4; margin: 12mm 14mm 12mm 14mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: #eef1f5; color: #111827;
    font-family: "Times New Roman", Times, Georgia, serif;
    line-height: 1.42; font-size: 10.5pt;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .sheet {
    width: min(210mm, calc(100% - 32px));
    margin: 24px auto; background: #fff;
    border: 1px solid #cfd6e2; border-radius: 10px;
    box-shadow: 0 12px 36px rgba(15,23,42,.14);
    overflow: hidden;
  }
  .page-pad { padding: 14px 18px 12px; }
  .header {
    display: flex; align-items: center; justify-content: center; gap: 16px;
    padding: 12px 16px 10px; background: #fff;
    border-bottom: 2.5px solid #0c1f3f;
  }
  .header img.logo { width: 72px; height: 72px; object-fit: contain; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; flex-shrink: 0; }
  .header .brand { font-family: Arial, Helvetica, sans-serif; }
  .header .kicker { font-size: 7pt; letter-spacing: .08em; text-transform: uppercase; color: #0c1f3f; font-weight: 700; line-height: 1.35; }
  .header .name { font-size: 20pt; font-weight: 900; color: #0c1f3f; letter-spacing: .04em; line-height: 1; margin-top: 4px; }
  h1.doc-title {
    text-align: center; font-family: Arial Black, Arial, sans-serif;
    font-size: 12pt; font-weight: 900; color: #0c1f3f;
    letter-spacing: .04em; text-transform: uppercase;
    margin: 12px 0 4px;
  }
  .ref-badge {
    text-align: center; margin-bottom: 8px;
  }
  .ref-badge span {
    display: inline-block; font-family: Arial, sans-serif; font-size: 7.5pt; font-weight: 800;
    background: #0c1f3f; color: #fff; padding: 4px 10px; border-radius: 999px;
  }
  .divider { height: 1px; background: #0c1f3f; opacity: .14; margin: 8px 0 10px; }
  h2.article {
    font-family: Arial, Helvetica, sans-serif; font-size: 10pt; font-weight: 800;
    color: #fff; background: #0c1f3f; padding: 6px 10px; border-radius: 4px;
    margin: 14px 0 8px; letter-spacing: .03em; text-transform: uppercase;
  }
  h3.sub { font-family: Arial, sans-serif; font-size: 8.5pt; font-weight: 800; color: #0c1f3f; margin: 8px 0 3px; }
  p { margin: 0 0 7px; text-align: justify; hyphens: auto; }
  ul.dash { margin: 6px 0 8px 18px; padding: 0; }
  ul.dash li { margin-bottom: 4px; }
  .field { display: inline-block; min-width: 110px; border-bottom: 1px dotted #111827; padding: 0 3px 1px; font-weight: 700; color: #0c1f3f; }
  .field.small { min-width: 80px; }
  .field.wide { min-width: 200px; }
  .field.full { min-width: 300px; }
  .parties { border: 1px solid #c8d0dc; border-radius: 6px; padding: 10px 12px; background: #f8fafc; margin-bottom: 10px; }
  .parties p { margin-bottom: 4px; }
  .sign-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 14px; }
  .sig { border: 1px solid #98a2b3; border-radius: 6px; min-height: 110px; padding: 10px; display: flex; flex-direction: column; justify-content: space-between; background: #fff; }
  .sig p { margin: 0; font-family: Arial, sans-serif; font-size: 7.5pt; color: #5c6675; text-transform: uppercase; letter-spacing: .04em; font-weight: 700; }
  .sig small { font-family: Arial, sans-serif; color: #0c1f3f; font-weight: 800; font-size: 8.5pt; }
  .sig-line { border-top: 1px solid #98a2b3; margin-top: 24px; padding-top: 4px; font-family: Arial, sans-serif; font-size: 7pt; color: #5c6675; text-align: center; }
  .footer {
    margin-top: 12px; border-top: 1px solid #e5e7eb; padding: 8px 18px 12px;
    font-family: Arial, sans-serif; font-size: 6.8pt; color: #5c6675; text-align: center; line-height: 1.4; background: #f8fafc;
  }
  .footer strong { color: #0c1f3f; }
  @media print {
    body { background: #fff; }
    .sheet { width: 100%; margin: 0; border: none; box-shadow: none; border-radius: 0; }
  }
</style>
</head>
<body>
<div class="sheet">

  <header class="header">
    <img class="logo" src="${HEADER_URI}" alt="Logo">
    <div class="brand">
      <div class="kicker">Placement de personnels &bull; Service de nettoyage &bull; Courtage immobilier</div>
      <div class="kicker">T&eacute;l : +225 27 22 34 22 83 / +225 05 03 97 47 75</div>
      <div class="name">CHRISROI AGENCE</div>
    </div>
    <img class="logo" src="${HEADER_URI}" alt="" style="visibility:hidden; width:42px;">
  </header>
  <div class="page-pad">

  <h1 class="doc-title">Contrat de prestation de service de placement</h1>
  <div class="ref-badge"><span>R&eacute;f. ${numero} &mdash; Fait &agrave; Abidjan le ${dateSignatureStr}</span></div>
  <div class="divider"></div>

  <p style="font-family: Arial, sans-serif; font-size:9pt; text-align:center; font-weight:700; color:#0c1f3f; margin-bottom:6px;">Entre les soussign&eacute;s :</p>

  <div class="parties">
    <p><strong>Chrisroi Agence</strong> en abr&eacute;viation <strong>C.R.A</strong>, Entreprise individuelle au Capital de <strong>500&nbsp;000&nbsp;FCFA</strong> ; ayant son Si&egrave;ge Social &agrave; <strong>Cocody Angr&eacute;-Ch&acirc;teau, Rue&nbsp;M42</strong> ; immatricul&eacute;e au <strong>RCCM&nbsp;N&deg;&nbsp;CI-2023-0063618S</strong> ; repr&eacute;sent&eacute;e par <strong>Mme&nbsp;Yao&nbsp;Lou&nbsp;Rose</strong> en sa qualit&eacute; de g&eacute;rante ; ci-apr&egrave;s d&eacute;sign&eacute;e &laquo;&nbsp;Le prestataire&nbsp;&raquo; ;</p>
    <p style="text-align:center; font-family: Arial, sans-serif; font-weight:800; color:#0c1f3f; margin:6px 0;">D&rsquo;une part ;</p>
    <p><strong>Et</strong></p>
    <p><span class="field full">${clientNom}</span> ;</p>
    <p>Domicili&eacute;(e) &agrave; <span class="field wide">${clientDomicile}</span> ;</p>
    <p>Titulaire de la pi&egrave;ce d&rsquo;identit&eacute; num&eacute;ro <span class="field">${clientPieceNum}</span> d&eacute;livr&eacute;e le <span class="field small">${clientPieceDate}</span> ;</p>
    <p>Ci-apr&egrave;s d&eacute;sign&eacute;(e) &laquo;&nbsp;Le client&nbsp;&raquo; ;</p>
    <p style="text-align:center; font-family: Arial, sans-serif; font-weight:800; color:#0c1f3f; margin:6px 0;">D&rsquo;autre part ;</p>
    <p style="text-align:center; font-family: Arial, sans-serif; font-weight:800; letter-spacing:.05em; text-transform:uppercase; color:#0c1f3f;">Il a &eacute;t&eacute; convenu ce qui suit :</p>
  </div>

  <section>
    <h2 class="article">Article 1 &mdash; Objet du contrat</h2>
    <p>Le pr&eacute;sent contrat a pour objet de formaliser les conditions dans lesquelles le prestataire fournit au client une prestation de service d&rsquo;interm&eacute;diation consistant &agrave; rechercher, &eacute;valuer et pr&eacute;senter un employ&eacute; pour r&eacute;pondre aux besoins exprim&eacute;s par le client, en contrepartie d&rsquo;une r&eacute;mun&eacute;ration convenue entre les parties, dont les modalit&eacute;s et montants sont pr&eacute;cis&eacute;s &agrave; l&rsquo;article&nbsp;3 du pr&eacute;sent contrat.</p>
    <p>En ex&eacute;cution de cette mission, le prestataire a mis en relation le client avec :</p>
    <div class="parties" style="background:#fff;">
      <p>Nom et pr&eacute;nom de l&rsquo;employ&eacute; : <span class="field wide">${employeNomComplet}</span></p>
      <p>&Acirc;ge : <span class="field small">${employeAge}</span> ; Sexe : <span class="field small">${employeSexe}</span> ;</p>
      <p>Poste attribu&eacute; : <span class="field wide">${employePoste}</span> ;</p>
      <p>Adresse actuelle de r&eacute;sidence : <span class="field wide">${employeAdresse}</span> ;</p>
      <p>Num&eacute;ro de pi&egrave;ce d&rsquo;identit&eacute; / R&eacute;f&eacute;rence d&rsquo;identification : <span class="field">${employePiece}</span>.</p>
    </div>
  </section>

  <section>
    <h2 class="article">Article 2 &mdash; Dur&eacute;e du contrat</h2>
    <p>Le pr&eacute;sent contrat est conclu pour une dur&eacute;e initiale de <strong>trois (03) mois</strong> &agrave; compter de sa date de signature. Cette dur&eacute;e correspond au d&eacute;but et &agrave; la fin de la p&eacute;riode de suivi de l&rsquo;int&eacute;gration de l&rsquo;employ&eacute; propos&eacute; et embauch&eacute;.</p>
    <p>Toute prestation de remplacement pr&eacute;vue dans cette p&eacute;riode est couverte par les conditions d&eacute;finies &agrave; l&rsquo;article&nbsp;7.</p>
  </section>

  <section>
    <h2 class="article">Article 3 &mdash; Prix de la prestation</h2>
    <p>Le prix de la prestation est fix&eacute; &agrave; <strong>15&nbsp;000&nbsp;FCFA</strong> payable en esp&egrave;ces ou par d&eacute;p&ocirc;t mobile money d&egrave;s la signature du pr&eacute;sent contrat.</p>
    <p>Celui-ci est <strong>non remboursable</strong>.</p>
    <p>Le d&eacute;placement d&rsquo;un agent de Chrisroi Agence pour le placement ou le retrait d&rsquo;employ&eacute; entra&icirc;ne des frais de transport qui s&rsquo;&eacute;l&egrave;vent &agrave; <span class="field small">${fraisTransportStr}</span>.</p>
  </section>

  <section>
    <h2 class="article">Article 4 &mdash; Engagements du prestataire</h2>
    <p>Le prestataire s&rsquo;engage &agrave; fournir au client une prestation de mise en relation en vue du recrutement d&rsquo;un employ&eacute;, dans les conditions suivantes :</p>
    <h3 class="sub">Obligation de moyens :</h3>
    <p>Le prestataire s&rsquo;engage &agrave; mettre en &oelig;uvre les moyens n&eacute;cessaires &agrave; l&rsquo;identification, l&rsquo;&eacute;valuation et la pr&eacute;sentation de candidats r&eacute;pondant aux crit&egrave;res exprim&eacute;s par le client. Il est donc tenu d&rsquo;une obligation de moyens et non de r&eacute;sultat quant &agrave; la r&eacute;ussite de l&rsquo;int&eacute;gration du candidat.</p>
    <h3 class="sub">Processus de s&eacute;lection :</h3>
    <p>Le prestataire s&rsquo;engage &agrave; proc&eacute;der &agrave; un entretien avec chaque candidat propos&eacute;, v&eacute;rifier dans la mesure du possible l&rsquo;exactitude des informations transmises (identit&eacute;, r&eacute;f&eacute;rences, exp&eacute;riences) et appr&eacute;cier l&rsquo;aptitude g&eacute;n&eacute;rale du candidat &agrave; exercer les fonctions envisag&eacute;es.</p>
    <h3 class="sub">Ind&eacute;pendance juridique :</h3>
    <p>Le prestataire n&rsquo;est en aucun cas employeur des candidats retenus. Elle n&rsquo;assume aucun lien de subordination &agrave; leur &eacute;gard, ni aucune responsabilit&eacute; dans l&rsquo;ex&eacute;cution de la relation de travail entre le client et le salari&eacute; recrut&eacute;.</p>
    <h3 class="sub">Limitation de responsabilit&eacute; :</h3>
    <p>Lorsque le prestataire a objectivement fait preuve de diligence, de rigueur et de bonne foi, il ne saurait &ecirc;tre tenue responsable des fautes ou pr&eacute;judices caus&eacute;s par l&rsquo;employ&eacute; apr&egrave;s sa prise de fonction, de la rupture de contrat entre le client et l&rsquo;employ&eacute;, des informations inexactes fournies par le candidat sans que leur fausset&eacute; puisse &ecirc;tre raisonnablement d&eacute;tect&eacute;e.</p>
    <h3 class="sub">Confidentialit&eacute; :</h3>
    <p>Le prestataire s&rsquo;engage &agrave; garder confidentielles toutes les informations personnelles, professionnelles ou strat&eacute;giques obtenues dans le cadre du pr&eacute;sent contrat, sauf accord expr&egrave;s du client ou obligation l&eacute;gale contraire.</p>
  </section>

  <section>
    <h2 class="article">Article 5 &mdash; Engagements du client</h2>
    <p>Le client s&rsquo;engage &agrave; :</p>
    <ul class="dash">
      <li>Fournir au prestataire des informations exactes sur le poste &agrave; pourvoir, les t&acirc;ches, les horaires et le lieu de travail.</li>
      <li>Traiter le personnel mis &agrave; disposition avec respect et dignit&eacute;, dans des conditions conformes aux dispositions l&eacute;gales et r&eacute;glementaires en vigueur.</li>
      <li>Signer un contrat de travail direct avec l&rsquo;employ&eacute; s&eacute;lectionn&eacute;.</li>
      <li>Informer le prestataire de toute difficult&eacute; s&eacute;rieuse survenue dans la relation de travail.</li>
    </ul>
    <p>Le prestataire ne saurait &ecirc;tre tenu de r&eacute;parer les dommages qui d&eacute;coulent du non-respect des dispositions du pr&eacute;sent article.</p>
  </section>

  <section>
    <h2 class="article">Article 6 &mdash; Conditions de r&eacute;siliation du contrat</h2>
    <p>La r&eacute;siliation du contrat suppose l&rsquo;extinction de l&rsquo;obligation de remplacement.</p>
    <p>Le prestataire se r&eacute;serve le droit de mettre fin au contrat avant l&rsquo;arriv&eacute;e de son terme dans les cas suivants :</p>
    <ul class="dash">
      <li>Refus injustifi&eacute; du client de formaliser un contrat de travail avec l&rsquo;employ&eacute; retenu.</li>
      <li>Traitement abusif, irrespectueux, d&eacute;gradant ou ill&eacute;gal inflig&eacute; &agrave; l&rsquo;employ&eacute;.</li>
      <li>Non-paiement des frais convenus dans le d&eacute;lai imparti.</li>
      <li>Recrutement direct d&rsquo;un candidat propos&eacute; sans paiement de la r&eacute;mun&eacute;ration due au prestataire.</li>
      <li>Non-respect des obligations contractuelles ou de bonne foi.</li>
    </ul>
  </section>

  <section>
    <h2 class="article">Article 7 &mdash; Remplacement de l&rsquo;employ&eacute;</h2>
    <p>Le remplacement sans frais en cas de rupture de contrat et d&rsquo;abandon de poste n&rsquo;est possible que dans la p&eacute;riode de suivi de <strong>trois (03) mois</strong>. Au-del&agrave;, il y a signature d&rsquo;un nouveau contrat.</p>
    <p>Dans les cas o&ugrave; le contrat de travail liant l&rsquo;employ&eacute; au client est rompu, le prestataire a l&rsquo;obligation de proc&eacute;der, dans un d&eacute;lai de <strong>sept (07) jours</strong>, au remplacement sans frais de cet employ&eacute; dans les conditions suivantes :</p>
    <ul class="dash">
      <li>L&rsquo;employ&eacute; d&eacute;missionne sans respecter le d&eacute;lai l&eacute;gal de pr&eacute;avis (01&nbsp;mois) ;</li>
      <li>Ou le client licencie son employ&eacute; pour un motif l&eacute;gitime sans respecter le d&eacute;lai l&eacute;gal de pr&eacute;avis (01&nbsp;mois).</li>
    </ul>
    <p>Dans les cas o&ugrave; le d&eacute;lai l&eacute;gal de pr&eacute;avis est respect&eacute;, le prestataire effectuera un remplacement d&egrave;s la fin dudit d&eacute;lai.</p>
    <p>Dans les cas o&ugrave; le contrat de travail liant l&rsquo;employ&eacute; au client est suspendu pour cause de maladie d&ucirc;ment constat&eacute;e par certificat m&eacute;dical, le prestataire a l&rsquo;obligation de proc&eacute;der, dans un d&eacute;lai de <strong>cinq (05) jours</strong>, au remplacement temporaire sans frais de cet employ&eacute; par un autre embauch&eacute; &agrave; cet effet. Le contrat de travail de ce dernier sera conclu pour la dur&eacute;e de l&rsquo;arr&ecirc;t maladie de l&rsquo;employ&eacute; malade. Le client aura pour obligation de reprendre ce dernier lorsqu&rsquo;il sera r&eacute;tabli.</p>
    <p>En cas d&rsquo;abandon de poste intervenu moins d&rsquo;une (01) semaine apr&egrave;s l&rsquo;embauche de l&rsquo;employ&eacute;, le prestataire disposera de <strong>trois (03) jours</strong> pour effectuer un remplacement de l&rsquo;employ&eacute;.</p>
    <p><em>Le prestataire n&rsquo;effectuera aucun remplacement lorsque la rupture du contrat de travail liant le client &agrave; l&rsquo;employ&eacute;, ou l&rsquo;abandon de poste a &eacute;t&eacute; motiv&eacute;e par des actes du client condamn&eacute;s par l&rsquo;employ&eacute;. &Agrave; savoir : un mauvais traitement de l&rsquo;employ&eacute;, un ou des impay&eacute;s de salaire, des attouchements ind&eacute;cents, de l&rsquo;harc&egrave;lement sexuel, de la violence physique et morale et autres actes d&eacute;gradants.</em></p>
  </section>

  <section>
    <h2 class="article">Article 8 &mdash; Retenue sur salaire &agrave; destination de l&rsquo;agence</h2>
    <p>Le client s&rsquo;engage &agrave; effectuer, le premier mois de travail de l&rsquo;employ&eacute;, une retenue sur le salaire net de celui-ci correspondant &agrave; <span class="field">${retenueStr}</span> &agrave; reverser directement au prestataire en esp&egrave;ce ou par d&eacute;p&ocirc;t mobile money.</p>
    <p>Le non-respect de cette clause est une cause de r&eacute;siliation du pr&eacute;sent contrat.</p>
  </section>

  <section>
    <h2 class="article">Article 9 &mdash; Conditions de d&eacute;part de l&rsquo;employ&eacute;</h2>
    <p>Lorsque l&rsquo;employ&eacute; r&eacute;side au domicile de son employeur, le client, celui-ci s&rsquo;engage &agrave; ne pas forcer l&rsquo;employ&eacute; &agrave; quitter son domicile nuitamment et/ou dans des conditions pr&eacute;caires.</p>
    <p>Toutefois, la possibilit&eacute; est reconnue au client de faire fi de la disposition ci-dessus lorsque la pr&eacute;sence de l&rsquo;employ&eacute; menace ses biens, sa vie ou celle des autres r&eacute;sidents du domicile, et en l&rsquo;absence d&rsquo;alternative raisonnable.</p>
    <p>Le non-respect de cette clause engage la responsabilit&eacute; du client pour les pr&eacute;judices que pourrait rencontrer l&rsquo;employ&eacute; en cours de route si un rapport de causalit&eacute; est &eacute;tabli.</p>
  </section>

  <section>
    <h2 class="article">Article 10 &mdash; R&egrave;glement des litiges</h2>
    <p>Tout diff&eacute;rend relatif au pr&eacute;sent contrat fera l&rsquo;objet d&rsquo;un r&egrave;glement amiable.</p>
    <p>&Agrave; d&eacute;faut d&rsquo;accord, les parties s&rsquo;engagent &agrave; recourir &agrave; une m&eacute;diation avant toute action en justice.</p>
    <p>En cas d&rsquo;&eacute;chec, l&rsquo;affaire sera port&eacute;e devant les juridictions comp&eacute;tentes.</p>
  </section>

  <div style="margin-top:10px; border:1px solid #0c1f3f; border-radius:6px; padding:8px 10px; background:#f8fafc; text-align:center;">
    <p style="text-align:center; font-family: Arial, sans-serif; font-weight:800; color:#0c1f3f; margin:0;">Fait &agrave; Abidjan le <span class="field small">${dateSignatureStr}</span></p>
    <p style="text-align:center; font-family: Arial, sans-serif; font-size:7.5pt; color:#5c6675; margin:3px 0 0;">En deux exemplaires originaux, un pour chaque partie.</p>
  </div>

  <div class="sign-grid">
    <div class="sig">
      <div>
        <p>Le client</p>
        <small>${clientNom}</small>
        <div style="font-family: Arial, sans-serif; font-size:7pt; color:#5c6675; margin-top:3px;">Lu et approuv&eacute; + signature</div>
      </div>
      <div class="sig-line">Signature pr&eacute;c&eacute;d&eacute;e de &laquo;&nbsp;Lu et approuv&eacute;&nbsp;&raquo;</div>
    </div>
    <div class="sig">
      <div>
        <p>Le prestataire &mdash; ChrisRoi Agence</p>
        <small>Mme Yao Lou Rose, G&eacute;rante</small>
        <div style="font-family: Arial, sans-serif; font-size:7pt; color:#5c6675; margin-top:3px;">Cachet + signature</div>
      </div>
      <div class="sig-line">Pour ChrisRoi Agence</div>
    </div>
  </div>

  <footer class="footer">
    <strong>CHRISROI AGENCE</strong> &mdash; EI au Capital de 500&nbsp;000&nbsp;FCFA &mdash; Si&egrave;ge Social : Cocody Angr&eacute;-Ch&acirc;teau, Rue&nbsp;M42 &mdash; T&eacute;l : +225&nbsp;27&nbsp;22&nbsp;34&nbsp;22&nbsp;83 / +225&nbsp;05&nbsp;03&nbsp;97&nbsp;47&nbsp;75 &mdash; RCCM&nbsp;N&deg;&nbsp;CI-2023-0063618S &mdash; CC&nbsp;N&deg;&nbsp;2304937&nbsp;D &mdash; Email : chrisroiagence@gmail.com &mdash; Site : Chrisroiagence.com
  </footer>
  </div>

</div>
</body>
</html>`;
}
