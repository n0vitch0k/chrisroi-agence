// Générateur HTML/PDF pour les contrats ChrisRoi Agence.
// Produit un document imprimable multi-pages avec en-tête, corps, signatures.
// Cross-platform : utilisé par nativePrint (web window.print) ET expo-print (PDF natif).
//
// Design : pro, lisible, monochrome + accent bleu ChrisRoi (#1E88E5).
// A4 (210x297mm), marges 15mm, en-tête répété sur chaque page via @page.

import type { ContratsRecord as Contrat, EmployesRecord as Employe, EmployeursRecord as Employeur } from '../types/pb-generated';

export interface PrintContratContext {
  contrat: any;
  employe?: any;
  employeur?: any;
}

const formatDateFr = (s: string | null | undefined): string => {
  if (!s) return '—';
  const t = String(s).trim();
  if (!t || !/[\dT]/.test(t)) return '—';
  const d = new Date(t);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
};

const formatMoney = (n: number | null | undefined): string => {
  if (n === null || n === undefined) return '0 FCFA';
  return `${Number(n).toLocaleString('fr-FR')} FCFA`;
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

// Petit logo SVG inline : carré bleu "CR" + tagline. Pas de dépendance externe.
const LOGO_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="48" height="48">
  <rect x="2" y="2" width="96" height="96" rx="14" fill="#1E88E5"/>
  <text x="50" y="60" text-anchor="middle" font-family="Arial, sans-serif"
        font-size="44" font-weight="900" fill="#FFFFFF" letter-spacing="1">CR</text>
</svg>`.trim();

const TYPE_CONTRAT_LABELS: Record<string, string> = {
  heberge: 'Hébergé sur place',
  non_heberge: 'Non hébergé',
  personnalise: 'Personnalisé',
};

export function buildContratHtml(ctx: PrintContratContext): string {
  const c = ctx.contrat;
  const e = ctx.employe || {};
  const emp = ctx.employeur || {};

  const numero = escapeHtml(c?.numero_dossier || '—');
  const poste = escapeHtml(c?.poste || '—');
  const typeContrat = TYPE_CONTRAT_LABELS[c?.type_contrat] || escapeHtml(c?.type_contrat || '—');
  const dateDebut = formatDateFr(c?.date_debut);
  const dateFin = formatDateFr(c?.date_fin);
  const salaire = formatMoney(c?.salaire);
  const commission = formatMoney(c?.commission_agence);
  const frais = formatMoney(c?.frais_dossier);

  const empNom = escapeHtml([c?.employe_prenom, c?.employe_nom].filter(Boolean).join(' ') || e?.prenom || '—');
  const empTel = escapeHtml(c?.employe_telephone || e?.telephone || '—');
  const empNaissance = e?.date_naissance ? formatDateFr(e.date_naissance) : '—';
  const empDomicile = escapeHtml(c?.domicile_employe || e?.lieu_residence || '—');

  const employeurNom = escapeHtml(c?.nom_complet || emp?.nom_complet || '—');
  const employeurTel = escapeHtml(c?.employeur_telephone || emp?.telephone || '—');
  const employeurAdresse = escapeHtml(c?.employeur_adresse || emp?.adresse || '—');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Contrat ${numero}</title>
<style>
  @page { size: A4; margin: 18mm 15mm 20mm 15mm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    color: #222;
    line-height: 1.45;
    margin: 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  /* ── En-tête société, répété en haut de chaque page via running() ── */
  .company-header {
    display: flex; align-items: center; gap: 14px;
    border-bottom: 2px solid #1E88E5;
    padding-bottom: 10px; margin-bottom: 18px;
  }
  .company-header .logo { flex-shrink: 0; }
  .company-header .name { font-size: 20px; font-weight: 800; color: #1E88E5; letter-spacing: 0.5px; }
  .company-header .tagline { font-size: 11px; color: #666; margin-top: 2px; }
  .company-header .ref { margin-left: auto; text-align: right; font-size: 10px; color: #888; }
  .company-header .ref strong { color: #1E88E5; font-size: 12px; }

  /* ── Titre du document ── */
  h1.doc-title {
    text-align: center; font-size: 22px; font-weight: 800;
    color: #1A56DB; margin: 8px 0 4px; letter-spacing: 0.4px;
  }
  .doc-subtitle {
    text-align: center; font-size: 12px; color: #666; margin-bottom: 18px;
  }

  /* ── Sections ── */
  section {
    margin-bottom: 16px;
    page-break-inside: avoid;
  }
  h2.section-title {
    font-size: 13px; font-weight: 800; color: #111;
    text-transform: uppercase; letter-spacing: 0.6px;
    border-bottom: 1.5px solid #1E88E5; padding-bottom: 4px; margin: 0 0 8px 0;
  }
  table.kv {
    width: 100%; border-collapse: collapse; font-size: 11.5px;
  }
  table.kv td {
    padding: 6px 0; border-bottom: 1px solid #eee; vertical-align: top;
  }
  table.kv td.k {
    color: #666; width: 38%; font-weight: 500;
  }
  table.kv td.v {
    color: #111; font-weight: 600; text-align: right;
  }
  table.kv td.v.money { color: #059669; }
  table.kv tr:last-child td { border-bottom: none; }

  /* ── Encadré financier (mise en avant) ── */
  .finance-box {
    background: #F0F7FF; border-left: 4px solid #1E88E5;
    padding: 12px 16px; border-radius: 4px; margin-top: 6px;
  }
  .finance-box .amount { font-size: 16px; font-weight: 800; color: #1A56DB; }

  /* ── Signatures ── */
  .signatures {
    display: flex; gap: 20px; margin-top: 36px;
    page-break-inside: avoid;
  }
  .sig-box {
    flex: 1; text-align: center; padding-top: 50px;
    border-top: 1.5px solid #333; font-size: 11px; color: #555; font-weight: 600;
  }

  /* ── Footer (pied de page) ── */
  .footer {
    position: fixed; bottom: 8mm; left: 15mm; right: 15mm;
    text-align: center; font-size: 9px; color: #999;
    border-top: 1px solid #eee; padding-top: 6px;
  }
  .footer strong { color: #1E88E5; }

  @media print {
    body { font-size: 11px; }
  }
</style>
</head>
<body>

  <!-- En-tête (s'affiche en haut de chaque page via @page) -->
  <div class="company-header">
    <div class="logo">${LOGO_SVG}</div>
    <div>
      <div class="name">CHRISROI AGENCE</div>
      <div class="tagline">Agence de Placement de Personnel Domestique</div>
    </div>
    <div class="ref">
      <strong>${numero}</strong><br>
      Émis le ${formatDateFr(new Date().toISOString())}
    </div>
  </div>

  <h1 class="doc-title">CONTRAT DE TRAVAIL</h1>
  <p class="doc-subtitle">Personnel domestique — placement de main-d'œuvre</p>

  <!-- ── 1. Parties ── -->
  <section>
    <h2 class="section-title">1. Parties au contrat</h2>
    <table class="kv">
      <tr>
        <td class="k">L'Agence</td>
        <td class="v">ChrisRoi Agence — Abidjan, Côte d'Ivoire</td>
      </tr>
      <tr>
        <td class="k">L'Employeur</td>
        <td class="v">${employeurNom}</td>
      </tr>
      <tr>
        <td class="k">Téléphone employeur</td>
        <td class="v">${employeurTel}</td>
      </tr>
      <tr>
        <td class="k">Adresse employeur</td>
        <td class="v">${employeurAdresse}</td>
      </tr>
      <tr>
        <td class="k">L'Employé(e)</td>
        <td class="v">${empNom}</td>
      </tr>
      <tr>
        <td class="k">Date de naissance</td>
        <td class="v">${empNaissance}</td>
      </tr>
      <tr>
        <td class="k">Téléphone employé(e)</td>
        <td class="v">${empTel}</td>
      </tr>
      <tr>
        <td class="k">Domicile de l'employé(e)</td>
        <td class="v">${empDomicile}</td>
      </tr>
    </table>
  </section>

  <!-- ── 2. Détails du contrat ── -->
  <section>
    <h2 class="section-title">2. Détails du contrat</h2>
    <table class="kv">
      <tr>
        <td class="k">Poste / Type de service</td>
        <td class="v">${poste}</td>
      </tr>
      <tr>
        <td class="k">Type de contrat</td>
        <td class="v">${typeContrat}</td>
      </tr>
      <tr>
        <td class="k">Date de début</td>
        <td class="v">${dateDebut}</td>
      </tr>
      <tr>
        <td class="k">Date de fin</td>
        <td class="v">${dateFin === '—' ? 'Non définie (renouvelable)' : dateFin}</td>
      </tr>
    </table>
  </section>

  <!-- ── 3. Rémunération ── -->
  <section>
    <h2 class="section-title">3. Rémunération</h2>
    <div class="finance-box">
      <table class="kv" style="margin: 0;">
        <tr>
          <td class="k">Salaire mensuel brut</td>
          <td class="v money"><span class="amount">${salaire}</span></td>
        </tr>
        <tr>
          <td class="k">Commission d'agence (1/3 du premier mois)</td>
          <td class="v money">${commission}</td>
        </tr>
        <tr>
          <td class="k">Frais de dossier</td>
          <td class="v">${frais}</td>
        </tr>
      </table>
    </div>
  </section>

  <!-- ── 4. Clauses standards ── -->
  <section>
    <h2 class="section-title">4. Clauses générales</h2>
    <p style="font-size: 11px; line-height: 1.55; color: #333; margin: 0;">
      L'employé(e) s'engage à fournir ses services selon les modalités convenues avec l'employeur,
      dans le respect des lois de la République de Côte d'Ivoire. En contrepartie, l'employeur
      s'engage à fournir un environnement de travail décent, un logement convenable
      ${typeContrat === 'Hébergé sur place' ? '(obligatoire pour ce type de contrat)' : ''},
      ainsi que la rémunération ci-dessus indiquée, payable aux échéances convenues.
    </p>
    <p style="font-size: 11px; line-height: 1.55; color: #333; margin: 8px 0 0 0;">
      Toute modification du présent contrat devra faire l'objet d'un avenant écrit signé
      par les trois parties. En cas de litige, les parties s'efforceront de trouver un règlement
      amiable. À défaut, le tribunal compétent d'Abidjan sera saisi.
    </p>
  </section>

  <!-- ── 5. Signatures ── -->
  <section>
    <h2 class="section-title">5. Signatures</h2>
    <p style="font-size: 10.5px; color: #666; margin: 0 0 8px 0;">
      Fait à Abidjan, en trois exemplaires originaux, le ${formatDateFr(c?.date_contrat || new Date().toISOString())}.
    </p>
    <div class="signatures">
      <div class="sig-box">L'Employé(e)<br><span style="font-size: 9px; font-weight: 400; color: #888;">${empNom}</span></div>
      <div class="sig-box">ChrisRoi Agence<br><span style="font-size: 9px; font-weight: 400; color: #888;">Le Directeur</span></div>
      <div class="sig-box">L'Employeur<br><span style="font-size: 9px; font-weight: 400; color: #888;">${employeurNom}</span></div>
    </div>
  </section>

  <!-- Pied de page (pinned via @page sur expo-print) -->
  <div class="footer">
    ChrisRoi Agence — Abidjan — ${numero} — page générée le ${formatDateFr(new Date().toISOString())}
  </div>
</body>
</html>`;
}
