import React, { useState, useMemo } from 'react';
import { StyleSheet, View, Text, Pressable, ScrollView, Modal } from 'react-native';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import { Colors, Spacing, Radius, Shadows } from '../theme';

// ─── Types (inchangé pour compat Dashboard) ─────────────────
export interface CalendarEvent {
  id: string;
  date: string;
  type: 'inscription' | 'contrat' | 'commission' | 'fin_contrat';
  titre: string;
  sousTitre: string;
  montant?: number;
  ref?: string;
  employe_id?: string;
  contrat_id?: string;
}

type MonthCalendarProps = {
  events: CalendarEvent[];
  weekStart?: Date;
  onWeekChange?: (newStart: Date) => void;
  onEventPress?: (event: CalendarEvent) => void;
  onMonthChange?: (year: number, month: number) => void;
};

// ─── Couleurs (alignées palette Warm Earth : la maquette validée) ───
const TYPE_COLORS: Record<string, { dot: string; bg: string; label: string }> = {
  inscription: { dot: '#5a7c3a', bg: '#e8f0dc', label: 'Inscription' },
  contrat:      { dot: '#2a7a7a', bg: '#d8ecec', label: 'Contrat' },
  commission:   { dot: '#b8860b', bg: '#faf3d1', label: 'Commission' },
  fin_contrat:  { dot: '#b85454', bg: '#fdeaea', label: 'Fin contrat' },
};

const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

export default function MonthCalendar({ events, weekStart, onWeekChange, onEventPress, onMonthChange }: MonthCalendarProps) {
  // On ignore weekStart (propriété de l'ancien composant), on utilise la date courante
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Navigation mois
  const goPrev = () => {
    const newMonth = currentMonth.month - 1;
    const year = newMonth < 0 ? currentMonth.year - 1 : currentMonth.year;
    setCurrentMonth({ year, month: (newMonth + 12) % 12 });
    onMonthChange?.(year, (newMonth + 12) % 12);
  };
  const goNext = () => {
    const newMonth = currentMonth.month + 1;
    const year = newMonth > 11 ? currentMonth.year + 1 : currentMonth.year;
    setCurrentMonth({ year, month: newMonth % 12 });
    onMonthChange?.(year, newMonth % 12);
  };
  const goToday = () => {
    const now = new Date();
    setCurrentMonth({ year: now.getFullYear(), month: now.getMonth() });
    setSelectedDate(now);
  };

  // Grouper événements par date
  const eventsByDay = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const evt of events) {
      const dayKey = evt.date.substring(0, 10);
      if (!map[dayKey]) map[dayKey] = [];
      map[dayKey].push(evt);
    }
    return map;
  }, [events]);

  // Générer la grille du mois
  const monthGrid = useMemo(() => {
    const firstDay = new Date(currentMonth.year, currentMonth.month, 1);
    // Lundi = 0, Dimanche = 6 (on décale getDay: 0=dimanche → 6, 1=lundi → 0...)
    let startPad = firstDay.getDay() - 1;
    if (startPad < 0) startPad = 6; // dimanche → pad 6
    const daysInMonth = new Date(currentMonth.year, currentMonth.month + 1, 0).getDate();
    const days: { date: Date; isCurrentMonth: boolean }[] = [];

    // Jours du mois précédent pour padding
    const prevMonthDays = new Date(currentMonth.year, currentMonth.month, 0).getDate();
    for (let i = startPad - 1; i >= 0; i--) {
      const d = new Date(currentMonth.year, currentMonth.month - 1, prevMonthDays - i);
      days.push({ date: d, isCurrentMonth: false });
    }
    // Jours du mois courant
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ date: new Date(currentMonth.year, currentMonth.month, i), isCurrentMonth: true });
    }
    // Jours du mois suivant pour compléter la grille (6 lignes = 42 cellules)
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(currentMonth.year, currentMonth.month + 1, i), isCurrentMonth: false });
    }
    return days;
  }, [currentMonth]);

  // Événements du jour sélectionné
  const today = new Date();
  const selectedEvents = selectedDate ? eventsByDay[formatDate(selectedDate)] || [] : [];

  // Compter événements par type
  const counts = useMemo(() => {
    const c: Record<string, number> = { inscription: 0, contrat: 0, commission: 0, fin_contrat: 0 };
    for (const evt of events) c[evt.type] = (c[evt.type] || 0) + 1;
    return c;
  }, [events]);

  return (
    <View style={styles.container}>
      {/* ── Header mois ── */}
      <View style={styles.header}>
        <Pressable onPress={goPrev} style={styles.navBtn}>
          <Icon name="chevron-left" size={22} color={Colors.textSecondary} />
        </Pressable>
        <Pressable onPress={goToday} style={styles.headerCenter}>
          <Text style={styles.monthTitle}>
            {MONTHS_FR[currentMonth.month]} {currentMonth.year}
          </Text>
          <Text style={styles.eventCount}>{events.length} événement{events.length !== 1 ? 's' : ''}</Text>
        </Pressable>
        <Pressable onPress={goNext} style={styles.navBtn}>
          <Icon name="chevron-right" size={22} color={Colors.textSecondary} />
        </Pressable>
      </View>

      {/* ── Grille mois ── */}
      <View style={styles.weekDaysRow}>
        {DAY_NAMES.map((name) => (
          <View key={name} style={styles.weekDayCell}>
            <Text style={styles.weekDayText}>{name}</Text>
          </View>
        ))}
      </View>

      <View style={styles.grid}>
        {monthGrid.map((cell, idx) => {
          const dayKey = formatDate(cell.date);
          const dayEvents = eventsByDay[dayKey] || [];
          const isToday = isSameDay(cell.date, today);
          const isSelected = selectedDate && isSameDay(cell.date, selectedDate);
          const hasEvents = dayEvents.length > 0;

          return (
            <Pressable
              key={idx}
              style={[
                styles.dayCell,
                !cell.isCurrentMonth && styles.dayCellOther,
                isToday && styles.dayCellToday,
                isSelected && styles.dayCellSelected,
                hasEvents && cell.isCurrentMonth && styles.dayCellHasEvents,
              ]}
              onPress={() => {
                if (cell.isCurrentMonth) setSelectedDate(cell.date);
              }}
            >
              <Text style={[
                styles.dayNum,
                !cell.isCurrentMonth && styles.dayNumOther,
                isToday && styles.dayNumToday,
                isSelected && styles.dayNumSelected,
              ]}>
                {cell.date.getDate()}
              </Text>
              {hasEvents && cell.isCurrentMonth && (
                <View style={styles.eventDots}>
                  {/* 3 premières pastilles max */}
                  {dayEvents.slice(0, 3).map((evt, i) => (
                    <View
                      key={i}
                      style={[styles.dot, { backgroundColor: TYPE_COLORS[evt.type]?.dot || '#999' }]}
                    />
                  ))}
                  {dayEvents.length > 3 && (
                    <Text style={styles.moreText}>+{dayEvents.length - 3}</Text>
                  )}
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* ── Légende ── */}
      {events.length > 0 && (
        <View style={styles.legend}>
          {Object.entries(TYPE_COLORS).map(([type, cfg]) => {
            const count = counts[type] || 0;
            if (count === 0) return null;
            return (
              <View key={type} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: cfg.dot }]} />
                <Text style={styles.legendText}>{cfg.label} ({count})</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* ── Modal détail du jour ── */}
      <Modal
        visible={selectedDate !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedDate(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedDate(null)}>
          <Pressable style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedDate?.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^\w/, (c) => c.toUpperCase())}
              </Text>
              <Pressable onPress={() => setSelectedDate(null)} style={styles.modalCloseBtn}>
                <Icon name="close" size={20} color={Colors.textSecondary} />
              </Pressable>
            </View>

            {selectedEvents.length === 0 && (
              <Text style={styles.modalEmpty}>Aucun événement ce jour</Text>
            )}

            <ScrollView style={styles.modalEventsList} showsVerticalScrollIndicator={false}>
              {selectedEvents.map((evt) => {
                const cfg = TYPE_COLORS[evt.type] || TYPE_COLORS.inscription;
                return (
                  <Pressable
                    key={evt.id}
                    style={styles.modalEventRow}
                    onPress={() => {
                      onEventPress?.(evt);
                      setSelectedDate(null);
                    }}
                  >
                    <View style={[styles.modalEventDot, { backgroundColor: cfg.dot }]} />
                    <View style={styles.modalEventInfo}>
                      <Text style={styles.modalEventTitle}>{evt.titre}</Text>
                      <Text style={styles.modalEventSub}>{evt.sousTitre}</Text>
                      {evt.ref && <Text style={styles.modalEventRef}>Dossier : {evt.ref}</Text>}
                      {evt.montant !== undefined && (
                        <Text style={styles.modalEventMontant}>
                          {evt.montant.toLocaleString('fr-FR')} F CFA
                        </Text>
                      )}
                    </View>
                    <View style={[styles.modalEventBadge, { backgroundColor: cfg.bg }]}>
                      <Text style={[styles.modalEventBadgeText, { color: cfg.dot }]}>{cfg.label}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    ...Shadows.soft,
  },
  // ── Header ──
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  navBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.background,
    justifyContent: 'center', alignItems: 'center',
  },
  headerCenter: { alignItems: 'center' },
  monthTitle: {
    fontSize: 20, fontWeight: '800', color: Colors.textPrimary,
  },
  eventCount: {
    fontSize: 12, color: Colors.textTertiary, marginTop: 2,
  },
  // ── En-tête jours ──
  weekDaysRow: {
    flexDirection: 'row', marginBottom: 2,
  },
  weekDayCell: {
    flex: 1, alignItems: 'center',
    paddingVertical: 6,
  },
  weekDayText: {
    fontSize: 11, fontWeight: '700', color: Colors.textTertiary,
    textTransform: 'uppercase',
  },
  // ── Grille ──
  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%', aspectRatio: 1,
    justifyContent: 'flex-start', alignItems: 'center',
    paddingTop: 4, borderRadius: 0,
  },
  dayCellOther: { opacity: 0.3 },
  dayCellToday: {
    backgroundColor: Colors.primary + '12',
    borderRadius: 8,
  },
  dayCellSelected: {
    backgroundColor: Colors.primary + '20',
    borderRadius: 8,
  },
  dayCellHasEvents: {},
  dayNum: {
    fontSize: 14, fontWeight: '600', color: Colors.textPrimary,
    width: 28, height: 28, lineHeight: 28,
    textAlign: 'center', borderRadius: 14,
    overflow: 'hidden',
  },
  dayNumOther: { color: Colors.textTertiary },
  dayNumToday: {
    backgroundColor: Colors.primary,
    color: Colors.textOnPrimary,
    fontWeight: '800',
  },
  dayNumSelected: {
    backgroundColor: Colors.primary,
    color: Colors.textOnPrimary,
    fontWeight: '800',
  },
  eventDots: {
    flexDirection: 'row', gap: 2,
    marginTop: 2, alignItems: 'center',
  },
  dot: {
    width: 5, height: 5, borderRadius: 2.5,
  },
  moreText: {
    fontSize: 8, fontWeight: '700', color: Colors.textTertiary,
  },
  // ── Légende ──
  legend: {
    flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md,
    marginTop: Spacing.md, paddingTop: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: Colors.textSecondary, fontWeight: '500' },
  // ── Modal détail du jour ──
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '88%',
    maxHeight: '72%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    ...Shadows.soft,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing.md, paddingBottom: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 16, fontWeight: '800', color: Colors.textPrimary,
    textTransform: 'capitalize', flex: 1,
  },
  modalCloseBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: Colors.background,
    justifyContent: 'center', alignItems: 'center',
    marginLeft: Spacing.sm,
  },
  modalEmpty: {
    fontSize: 14, color: Colors.textTertiary,
    textAlign: 'center', paddingVertical: Spacing.xl,
  },
  modalEventsList: {
    maxHeight: 400,
  },
  modalEventRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md, marginBottom: Spacing.xs,
    backgroundColor: Colors.background,
  },
  modalEventDot: {
    width: 10, height: 10, borderRadius: 5,
    marginRight: Spacing.md,
  },
  modalEventInfo: { flex: 1 },
  modalEventTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  modalEventSub: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  modalEventRef: { fontSize: 12, color: Colors.textTertiary, marginTop: 2 },
  modalEventMontant: {
    fontSize: 13, fontWeight: '700', color: Colors.success, marginTop: 2,
  },
  modalEventBadge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  modalEventBadgeText: { fontSize: 11, fontWeight: '700' },
});
