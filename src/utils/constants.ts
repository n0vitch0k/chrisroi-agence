// Utilitaires pour l'application

// Formater une date — accepte null, undefined, '' et dates invalides uniformément.
// Renvoie '-' pour toute valeur vide/invalide (plus jamais "Invalid Date").
export const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  const trimmed = String(dateString).trim();
  if (!trimmed) return '-';
  // Heuristique : si la string n'a pas l'air d'une date valide (pas de séparateur,
  // pas de chiffre), on évite new Date() qui produit "Invalid Date" sur le web.
  if (!/[\dT]/.test(trimmed)) return '-';
  const date = new Date(trimmed);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

// Comme formatDate, mais accepte un fallback explicite (ex: "En cours" pour date_fin).
export const formatDateOr = (dateString: string | null | undefined, fallback: string): string => {
  const formatted = formatDate(dateString);
  return formatted === '-' ? fallback : formatted;
};

// Formater un montant
export const formatMoney = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined) return '0 FCFA';
  return amount.toLocaleString('fr-FR') + ' FCFA';
};

// Formater un numéro de téléphone
export const formatPhone = (phone: string | null | undefined): string => {
  if (!phone) return '-';
  return phone;
};

// Calculer l'âge
export const calculateAge = (dateNaissance: string | null | undefined): number | null => {
  if (!dateNaissance) return null;
  try {
    const birth = new Date(dateNaissance);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  } catch {
    return null;
  }
};

// Obtenir la couleur du statut (palette Warm Earth V5)
export const getStatutColor = (statut: string): string => {
  switch (statut) {
    case 'disponible':
    case 'en_cours':
      return '#5a7c3a'; // olive
    case 'en_poste':
      return '#2a7a7a'; // sarcelle
    case 'indisponible':
    case 'annule':
      return '#b85454'; // brique
    case 'en_attente':
    case 'termine':
      return '#b8860b'; // or vieilli
    default:
      return '#8a7d72'; // textMuted
  }
};

// Obtenir le libellé du statut
export const getStatutLabel = (statut: string): string => {
  const labels: Record<string, string> = {
    disponible: 'Disponible',
    en_poste: 'En poste',
    indisponible: 'Indisponible',
    en_attente: 'En attente',
    en_cours: 'En cours',
    termine: 'Terminé',
    annule: 'Annulé'
  };
  return labels[statut] || statut;
};

// Libellé localisé de la situation matrimoniale (FR, avec accords).
export const getSituationMatrimonialeLabel = (s: string | null | undefined): string => {
  const labels: Record<string, string> = {
    celibataire: 'Célibataire',
    marie: 'Marié(e)',
    divorce: 'Divorcé(e)',
    veuf: 'Veuf/Veuve',
  };
  return labels[String(s || '').toLowerCase()] || (s || '-');
};

// Libellé localisé du type de besoin employeur.
export const getTypeBesoinLabel = (t: string | null | undefined): string => {
  const labels: Record<string, string> = {
    particulier: 'Particulier',
    entreprise: 'Entreprise',
    commerce: 'Commerce',
  };
  return labels[String(t || '').toLowerCase()] || (t || '-');
};

// Obtenir le libellé de la catégorie
export const getCategorieLabel = (categorie: string): string => {
  const labels: Record<string, string> = {
    serveuse: 'Serveuse',
    chauffeur: 'Chauffeur',
    femme_de_menage: 'Femme de ménage',
    cuisinier: 'Cuisinier',
    vigil: 'Vigil',
    nounou: 'Nounou',
    gouvernante: 'Gouvernante',
    jardinier: 'Jardinier',
    domestique: 'Domestique',
    cuisiniere: 'Cuisinière',
    majordome: 'Majordome',
    garde_malade: 'Garde malade',
    lingere: 'Lingère',
    autre: 'Autre'
  };
  return labels[categorie] || categorie;
};

export const getSituationLabel = (situation: string): string => {
  const labels: Record<string, string> = {
    celibataire: 'Célibataire',
    marie: 'Marié(e)',
    divorce: 'Divorcé(e)',
  };
  return labels[situation] || situation;
};

export const getNiveauLabel = (niveau: string): string => {
  const labels: Record<string, string> = {
    sait_lire_ecrire: 'Sait lire et écrire',
    primaire: 'Primaire (CEPE)',
    secondaire_1: 'Secondaire 1er cycle (BEPC)',
    secondaire_2: 'Secondaire 2e cycle (BAC)',
    superieur: 'Supérieur',
    aucun: 'Aucun',
  };
  return labels[niveau] || niveau;
};

// Catégories d'emploi
export const CATEGORIES_EMPLOI = [
  { value: 'serveuse', label: 'Serveuse' },
  { value: 'chauffeur', label: 'Chauffeur' },
  { value: 'femme_de_menage', label: 'Femme de ménage' },
  { value: 'cuisinier', label: 'Cuisinier' },
  { value: 'vigil', label: 'Vigil' },
  { value: 'nounou', label: 'Nounou' },
  { value: 'gouvernante', label: 'Gouvernante' },
  { value: 'jardinier', label: 'Jardinier' },
  { value: 'domestique', label: 'Domestique' },
  { value: 'cuisiniere', label: 'Cuisinière' },
  { value: 'majordome', label: 'Majordome' },
  { value: 'garde_malade', label: 'Garde malade' },
  { value: 'lingere', label: 'Lingère' },
  { value: 'autre', label: 'Autre' }
];

// Situations matrimoniales
export const SITUATIONS_MATRIMONIALES = [
  { value: 'celibataire', label: 'Célibataire' },
  { value: 'marie', label: 'Marié(e)' },
  { value: 'divorce', label: 'Divorcé(e)' },
  { value: 'veuf', label: 'Veuf/Veuve' },
  { value: 'concubinage', label: 'Concubinage' }
];

// Niveaux d'étude
export const NIVEAUX_ETUDE = [
  { value: 'sait_lire_ecrire', label: 'Sait lire et écrire' },
  { value: 'primaire', label: 'Primaire (CEPE)' },
  { value: 'secondaire_1', label: 'Secondaire 1er cycle (BEPC)' },
  { value: 'secondaire_2', label: 'Secondaire 2e cycle (BAC)' },
  { value: 'superieur', label: 'Supérieur' },
  { value: 'aucun', label: 'Aucun' },
];

// Types de contrat (personnel domestique)
export const TYPES_CONTRAT = [
  { value: 'heberge', label: 'Hébergé sur place' },
  { value: 'non_heberge', label: 'Non hébergé' },
  { value: 'personnalise', label: 'Personnalisé' },
];

// Générer un ID unique
export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// Obtenir le libellé du type de contrat
export const getTypeContratLabel = (type: string): string => {
  const labels: Record<string, string> = {
    heberge: 'Hébergé sur place',
    non_heberge: 'Non hébergé',
    personnalise: 'Personnalisé',
  };
  return labels[type] || type;
};

// Obtenir le libellé du niveau d'étude
export const getNiveauEtudeLabel = (niveau: string): string => {
  const labels: Record<string, string> = {
    sait_lire_ecrire: 'Sait lire et écrire',
    primaire: 'Primaire (CEPE)',
    secondaire_1: 'Secondaire 1er cycle (BEPC)',
    secondaire_2: 'Secondaire 2e cycle (BAC)',
    superieur: 'Supérieur',
    aucun: 'Aucun',
  };
  return labels[niveau] || niveau;
};

// Jours restants avant fin de contrat
export const daysRemaining = (dateFin: string | null | undefined): number | null => {
  if (!dateFin) return null;
  try {
    const end = new Date(dateFin);
    const today = new Date();
    const diff = end.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
};

// Ré-export du type CalendarEvent depuis le module calendrier
export type { CalendarEvent } from './calendar';
