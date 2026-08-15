// ─── Types pour la fonctionnalité de numérisation (scan) ─────

/** Type de document scanné */
export type DocumentType = 'fiche_inscription' | 'contrat';

/** Statut du scan */
export type ScanStatus = 'pending' | 'extracting' | 'ready' | 'creating' | 'done' | 'error';

/** Données extraites d'une fiche d'inscription scannée */
export interface FicheInscriptionExtracted {
  type: 'fiche_inscription';
  nom: string;
  prenom: string;
  date_naissance: string;
  telephone: string;
  adresse: string;
  lieu_residence: string;
  nationalite: string;
  categorie_emploi: string;
  situation_matrimoniale: string;
  niveau_etude: string;
  religion: string;
  personne_contact: string;
  contact_urgence: string;
  nom_pere: string;
  nom_mere: string;
  taille: string;
  poids: string;
  ville_origine: string;
  peut_lire_ecrire: boolean;
  experiences?: { entreprise: string; lieu: string; duree: string }[];
}

/** Données extraites d'un contrat scanné */
export interface ContratExtracted {
  type: 'contrat';
  // Employé
  employe_nom: string;
  employe_prenom: string;
  employe_telephone: string;
  employe_adresse: string;
  // Employeur
  employeur_nom_complet: string;
  employeur_type: string;
  employeur_telephone: string;
  employeur_adresse: string;
  // Contrat
  poste: string;
  type_contrat: string;
  date_debut: string;
  date_fin: string;
  duree: string;
  salaire: number;
  notes: string;
}

/** Union des types de données extraites */
export type ExtractedData = FicheInscriptionExtracted | ContratExtracted;

/** Résultat complet d'un scan */
export interface ScanResult {
  imageUri: string;
  documentType: DocumentType;
  extracted: ExtractedData;
}

/** État du processus de scan */
export interface ScanState {
  status: ScanStatus;
  documentType: DocumentType | null;
  imageUri: string | null;
  extracted: ExtractedData | null;
  error: string | null;
}
