// ─── Service d'extraction de documents via passerelle KiloCode (relais) ────────
// Route B : l'app appelle la passerelle KiloCode avec la clé KiloCode saisie
// dans les réglages, en demandant le modèle StepFun (pas de clé StepFun requise).
// Format d'appel : style OpenAI chat/completions.
// Doc passerelle non vérifiable depuis cet environnement : le chemin exact
// (KILO_CHAT_PATH) sera confirmé par le test de scan sur appareil.

import type {
  DocumentType,
  ExtractedData,
  FicheInscriptionExtracted,
  ContratExtracted,
} from '../types/scan';
import { FICHE_PROMPT, CONTRAT_PROMPT } from './gemini';

const KILO_BASE = 'https://api.kilo.ai/api/gateway';
// Chemin à confirmer par le test sur appareil (voir procédure de test).
const KILO_CHAT_PATH = '/chat/completions';
const KILO_MODEL = 'stepfun/step-3.7-flash:free';

async function imageUriToBase64(uri: string): Promise<string> {
  if (uri.startsWith('data:')) {
    return uri.split(',')[1];
  }
  const resp = await fetch(uri);
  const blob = await resp.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve((reader.result as string).split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function extractTextContent(content: any): string | null {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const texts = content
      .filter((p: any) => p && (p.type === 'text' || typeof p.text === 'string'))
      .map((p: any) => (typeof p.text === 'string' ? p.text : ''));
    const joined = texts.join('\n').trim();
    return joined ? joined : null;
  }
  return null;
}

export async function extractDocument(
  apiKey: string,
  imageUri: string,
  documentType: DocumentType,
  base64Override?: string,
  /** Pages suivantes (contrat multi-pages) : base64 déjà prêts, dans l'ordre */
  extraBase64Images: string[] = []
): Promise<ExtractedData> {
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('Clé API KiloCode non configurée. Allez dans Paramètres > Scanner.');
  }

  const prompt = documentType === 'fiche_inscription' ? FICHE_PROMPT : CONTRAT_PROMPT;
  const base64Image = base64Override && base64Override.length > 0
    ? base64Override
    : await imageUriToBase64(imageUri);

  const allImages = [base64Image, ...extraBase64Images.filter((b) => b && b.length > 0)];
  const contentParts: any[] = [
    {
      type: 'text',
      text: allImages.length > 1
        ? prompt + `\nCe document comporte ${allImages.length} pages (images dans l'ordre) : analyse-les TOUTES et fusionne les informations.`
        : prompt,
    },
    ...allImages.map((b64) => ({
      type: 'image_url',
      image_url: { url: 'data:image/jpeg;base64,' + b64 },
    })),
  ];

  const response = await fetch(KILO_BASE + KILO_CHAT_PATH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + apiKey.trim(),
    },
    body: JSON.stringify({
      model: KILO_MODEL,
      messages: [
        {
          role: 'user',
          content: contentParts,
        },
      ],
      temperature: 0.1,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    let detail = '';
    try {
      const err = JSON.parse(errText);
      detail =
        err?.error?.message || err?.error?.code || err?.message || '';
    } catch {
      detail = errText.substring(0, 200);
    }
    throw new Error('Erreur KiloCode (' + response.status + ') : ' + detail);
  }

  const data = await response.json();
  const rawContent = data?.choices?.[0]?.message?.content;
  const text = extractTextContent(rawContent);
  if (!text) {
    throw new Error('Réponse KiloCode vide ou illisible.');
  }

  let jsonStr = text.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  }

  try {
    const parsed = JSON.parse(jsonStr);
    if (documentType === 'fiche_inscription') {
      return {
        type: 'fiche_inscription',
        nom: parsed.nom || '',
        prenom: parsed.prenom || '',
        date_naissance: parsed.date_naissance || '',
        telephone: parsed.telephone || '',
        adresse: parsed.adresse || '',
        lieu_residence: parsed.lieu_residence || '',
        nationalite: parsed.nationalite || '',
        categorie_emploi: parsed.categorie_emploi || '',
        situation_matrimoniale: parsed.situation_matrimoniale || '',
        niveau_etude: parsed.niveau_etude || '',
        religion: parsed.religion || '',
        personne_contact: parsed.personne_contact || '',
        contact_urgence: parsed.contact_urgence || '',
        nom_pere: parsed.nom_pere || '',
        nom_mere: parsed.nom_mere || '',
        taille: parsed.taille || '',
        poids: parsed.poids || '',
        ville_origine: parsed.ville_origine || '',
        peut_lire_ecrire: !!parsed.peut_lire_ecrire,
        experiences: Array.isArray(parsed.experiences) ? parsed.experiences : [],
      } as FicheInscriptionExtracted;
    }
    return {
      type: 'contrat',
      employe_nom: parsed.employe_nom || '',
      employe_prenom: parsed.employe_prenom || '',
      employe_telephone: parsed.employe_telephone || '',
      employe_adresse: parsed.employe_adresse || '',
      employeur_nom_complet: parsed.employeur_nom_complet || '',
      employeur_type: parsed.employeur_type || 'particulier',
      employeur_telephone: parsed.employeur_telephone || '',
      employeur_adresse: parsed.employeur_adresse || '',
      poste: parsed.poste || '',
      type_contrat: parsed.type_contrat || 'heberge',
      date_debut: parsed.date_debut || '',
      date_fin: parsed.date_fin || '',
      duree: parsed.duree || '',
      salaire: typeof parsed.salaire === 'number' ? parsed.salaire : 0,
      notes: parsed.notes || '',
    } as ContratExtracted;
  } catch (_parseErr) {
    throw new Error('Erreur de parsing JSON : ' + jsonStr.substring(0, 200));
  }
}
