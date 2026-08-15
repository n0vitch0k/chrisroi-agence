// ─── Utilitaires de calendrier ─────────────────────────────
// Fonctions de date pures, sans dépendances React

export interface CalendarDay {
  date: Date;
  day: number;           // 1-31
  month: number;         // 0-11
  year: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
}

export interface CalendarEvent {
  id: string;
  date: string;          // Date ISO (YYYY-MM-DD)
  type: 'inscription' | 'contrat' | 'commission';
  titre: string;
  sousTitre?: string;
  montant?: number;
  employe_nom?: string;
  employe_prenom?: string;
  employeur_nom?: string;
  ref?: string;          // numéro dossier, etc.
}

export type CalendarEventType = CalendarEvent['type'];

export const CALENDAR_COLORS: Record<CalendarEventType, string> = {
  inscription: '#1A56DB',  // Bleu
  contrat: '#059669',       // Vert
  commission: '#D97706',    // Orange/Ambre
};

export const CALENDAR_COLORS_LIGHT: Record<CalendarEventType, string> = {
  inscription: '#EBF4FF',
  contrat: '#ECFDF5',
  commission: '#FFFBEB',
};

export const CALENDAR_LABELS: Record<CalendarEventType, string> = {
  inscription: 'Inscription',
  contrat: 'Contrat',
  commission: 'Commission',
};

export const CALENDAR_ICONS: Record<CalendarEventType, string> = {
  inscription: 'account-plus',
  contrat: 'file-document',
  commission: 'cash',
};

export const MOIS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
] as const;

export const MOIS_COURT = [
  'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
  'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc',
] as const;

export const JOURS_SEMAINE = [
  'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim',
] as const;

/**
 * Obtenir les jours à afficher dans la grille mensuelle
 */
export function getCalendarDays(year: number, month: number): CalendarDay[] {
  const today = new Date();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Commencer par la case du bon jour de semaine (lundi = 0)
  let startDow = firstDay.getDay(); // 0=Dim, 1=Lun, ...
  startDow = startDow === 0 ? 6 : startDow - 1; // convertir en Lun=0

  const days: CalendarDay[] = [];

  // Jours du mois précédent
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startDow - 1; i >= 0; i--) {
    const d = prevMonthLastDay - i;
    const date = new Date(year, month - 1, d);
    days.push({
      date,
      day: d,
      month: month - 1,
      year: month - 1 < 0 ? year - 1 : year,
      isCurrentMonth: false,
      isToday: isSameDay(date, today),
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
    });
  }

  // Jours du mois courant
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(year, month, d);
    days.push({
      date,
      day: d,
      month,
      year,
      isCurrentMonth: true,
      isToday: isSameDay(date, today),
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
    });
  }

  // Jours du mois suivant pour compléter la grille (6 semaines = 42 jours)
  const remaining = 42 - days.length;
  for (let d = 1; d <= remaining; d++) {
    const date = new Date(year, month + 1, d);
    days.push({
      date,
      day: d,
      month: month + 1,
      year: month + 1 > 11 ? year + 1 : year,
      isCurrentMonth: false,
      isToday: isSameDay(date, today),
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
    });
  }

  return days;
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

export function formatDateShort(date: Date): string {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

export function formatDateISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Grouper les événements par date pour un mois donné
 */
export function groupEventsByDay(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const evt of events) {
    const key = evt.date; // déjà en YYYY-MM-DD
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(evt);
  }
  return map;
}

/**
 * Obtenir les types d'événements pour un jour donné
 */
export function getDayEventTypes(events: CalendarEvent[]): Set<CalendarEventType> {
  const types = new Set<CalendarEventType>();
  for (const evt of events) {
    types.add(evt.type);
  }
  return types;
}

/**
 * Compter les événements par type
 */
export function countByType(events: CalendarEvent[]): Record<CalendarEventType, number> {
  return {
    inscription: events.filter(e => e.type === 'inscription').length,
    contrat: events.filter(e => e.type === 'contrat').length,
    commission: events.filter(e => e.type === 'commission').length,
  };
}
