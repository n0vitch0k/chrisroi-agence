// ─── Validation de dates (format JJ/MM/AAAA) ───────────────
// Utilisé par les formulaires Employé/Contrat.
// Retourne null si OK, sinon un message d'erreur.

export const DATE_REGEX = /^(0?[1-9]|[12][0-9]|3[01])\/(0?[1-9]|1[0-2])\/(\d{4})$/;

export const validateDateFR = (value: string): string | null => {
  if (!value || value.trim() === '') return null; // optionnel
  if (!DATE_REGEX.test(value.trim())) {
    return 'Format attendu : JJ/MM/AAAA';
  }
  const [j, m, a] = value.trim().split('/').map(Number);
  const d = new Date(a, m - 1, j);
  if (d.getFullYear() !== a || d.getMonth() !== m - 1 || d.getDate() !== j) {
    return 'Date invalide';
  }
  if (d > new Date()) {
    return 'La date ne peut pas être dans le futur';
  }
  return null;
};

// Convertit JJ/MM/AAAA en ISO (YYYY-MM-DD) pour PocketBase.
export const frToIso = (value: string): string => {
  if (!value || !DATE_REGEX.test(value.trim())) return '';
  const [j, m, a] = value.trim().split('/').map(Number);
  return `${a}-${String(m).padStart(2, '0')}-${String(j).padStart(2, '0')}`;
};

// Convertit ISO (YYYY-MM-DD ou ISO complet) en JJ/MM/AAAA pour l'affichage input.
export const isoToFr = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const datePart = iso.split('T')[0]; // YYYY-MM-DD
  const [a, m, j] = datePart.split('-');
  if (!a || !m || !j) return '';
  return `${j}/${m}/${a}`;
};
