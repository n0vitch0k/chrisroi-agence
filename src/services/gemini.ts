// ─── Service d'extraction de documents via Gemini API ────────
// Utilise l'API REST Gemini 2.0 Flash (gratuite).
// Documentation : https://ai.google.dev/gemini-api/docs

import type {
  DocumentType,
  ExtractedData,
  FicheInscriptionExtracted,
  ContratExtracted,
} from '../types/scan';

const GEMINI_MODEL = "gemini-2.0-flash";
const API_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models/" +
  GEMINI_MODEL +
  ":generateContent";

const FICHE_PROMPT = [
  "Tu es un assistant qui extrait des informations d'un formulaire d'inscription.",
  "Analyse l'image du document et extrait les champs suivants au format JSON.",
  "Champs à extraire :",
  "- nom (string) : nom de famille",
  "- prenom (string) : prénom",
  "- date_naissance (string) : date de naissance au format JJ/MM/AAAA",
  "- telephone (string) : numéro de téléphone",
  "- adresse (string) : adresse complète",
  "- lieu_residence (string) : lieu de résidence",
  "- nationalite (string) : nationalité",
  "- categorie_emploi (string) : catégorie d'emploi recherché",
  "- situation_matrimoniale (string) : célibataire, marié(e), divorcé(e), veuf(ve)",
  "- niveau_etude (string) : niveau d'étude",
  "- religion (string) : religion",
  "- personne_contact (string) : personne à contacter",
  "- contact_urgence (string) : téléphone de contact",
  "- nom_pere (string) : nom du père",
  "- nom_mere (string) : nom de la mère",
  "- taille (string) : taille en cm",
  "- poids (string) : poids en kg",
  "- ville_origine (string) : ville d'origine",
  "- peut_lire_ecrire (boolean) : sait lire et écrire ?",
  "- experiences (array) : expériences pro. Chaque item a : entreprise, lieu, duree",
  "",
  "Réponds UNIQUEMENT avec un JSON valide. Si un champ n'est pas visible, mets une chaîne vide.",
].join("\n");

const CONTRAT_PROMPT = [
  "Tu es un assistant qui extrait des informations d'un contrat de travail.",
  "Analyse l'image du document et extrait les champs suivants au format JSON.",
  "",
  "Champs employé :",
  "- employe_nom (string) : nom de l'employé",
  "- employe_prenom (string) : prénom de l'employé",
  "- employe_telephone (string) : téléphone employé",
  "- employe_adresse (string) : adresse employé",
  "",
  "Champs employeur :",
  "- employeur_nom_complet (string) : nom complet employeur",
  "- employeur_type (string) : particulier, entreprise, commerce",
  "- employeur_telephone (string) : téléphone employeur",
  "- employeur_adresse (string) : adresse employeur",
  "",
  "Champs contrat :",
  "- poste (string) : poste proposé",
  "- type_contrat (string) : hébergé, externe, temporaire, CDD, CDI",
  "- date_debut (string) : date début JJ/MM/AAAA",
  "- date_fin (string) : date fin JJ/MM/AAAA",
  "- duree (string) : durée du contrat",
  "- salaire (number) : salaire mensuel en FCFA",
  "- notes (string) : observations",
  "",
  "Réponds UNIQUEMENT avec un JSON valide.",
].join("\n");

async function imageUriToBase64(uri: string): Promise<string> {
  if (uri.startsWith("data:")) {
    return uri.split(",")[1];
  }
  const resp = await fetch(uri);
  const blob = await resp.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve((reader.result as string).split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function extractDocument(
  apiKey: string,
  imageUri: string,
  documentType: DocumentType,
  base64Override?: string
): Promise<ExtractedData> {
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("Cle API Gemini non configuree. Allez dans Parametres > Scanner.");
  }

  const prompt = documentType === "fiche_inscription" ? FICHE_PROMPT : CONTRAT_PROMPT;
  const base64Image = base64Override && base64Override.length > 0
    ? base64Override
    : await imageUriToBase64(imageUri);

  const response = await fetch(API_BASE + "?key=" + apiKey, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            { inline_data: { mime_type: "image/jpeg", data: base64Image } },
          ],
        },
      ],
      generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    let detail = "";
    try {
      const err = JSON.parse(errText);
      detail = err.error?.message || err.error?.status || "";
    } catch {
      detail = errText.substring(0, 200);
    }
    throw new Error("Erreur Gemini (" + response.status + ") : " + detail);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Reponse Gemini vide.");
  }

  let jsonStr = text.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  }

  try {
    const parsed = JSON.parse(jsonStr);
    if (documentType === "fiche_inscription") {
      return {
        type: "fiche_inscription",
        nom: parsed.nom || "",
        prenom: parsed.prenom || "",
        date_naissance: parsed.date_naissance || "",
        telephone: parsed.telephone || "",
        adresse: parsed.adresse || "",
        lieu_residence: parsed.lieu_residence || "",
        nationalite: parsed.nationalite || "",
        categorie_emploi: parsed.categorie_emploi || "",
        situation_matrimoniale: parsed.situation_matrimoniale || "",
        niveau_etude: parsed.niveau_etude || "",
        religion: parsed.religion || "",
        personne_contact: parsed.personne_contact || "",
        contact_urgence: parsed.contact_urgence || "",
        nom_pere: parsed.nom_pere || "",
        nom_mere: parsed.nom_mere || "",
        taille: parsed.taille || "",
        poids: parsed.poids || "",
        ville_origine: parsed.ville_origine || "",
        peut_lire_ecrire: !!parsed.peut_lire_ecrire,
        experiences: Array.isArray(parsed.experiences) ? parsed.experiences : [],
      } as FicheInscriptionExtracted;
    }
    return {
      type: "contrat",
      employe_nom: parsed.employe_nom || "",
      employe_prenom: parsed.employe_prenom || "",
      employe_telephone: parsed.employe_telephone || "",
      employe_adresse: parsed.employe_adresse || "",
      employeur_nom_complet: parsed.employeur_nom_complet || "",
      employeur_type: parsed.employeur_type || "particulier",
      employeur_telephone: parsed.employeur_telephone || "",
      employeur_adresse: parsed.employeur_adresse || "",
      poste: parsed.poste || "",
      type_contrat: parsed.type_contrat || "heberge",
      date_debut: parsed.date_debut || "",
      date_fin: parsed.date_fin || "",
      duree: parsed.duree || "",
      salaire: typeof parsed.salaire === "number" ? parsed.salaire : 0,
      notes: parsed.notes || "",
    } as ContratExtracted;
  } catch (_parseErr) {
    throw new Error("Erreur de parsing JSON : " + jsonStr.substring(0, 200));
  }
}
