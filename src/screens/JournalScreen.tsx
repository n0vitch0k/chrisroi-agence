import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Chip } from 'react-native-paper';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import { getJournalActions, getCurrentUser } from '../database/service';
import { Colors, Spacing, Radius, Shadows } from '../theme';
import AppHeader from '../components/AppHeader';

const M = Colors;

const ACTION_ICONS: Record<string, string> = {
  creation_fiche: 'account-plus',
  modification_fiche: 'account-edit',
  modification_champ: 'pencil',
  suppression_fiche: 'account-remove',
  creation_contrat: 'file-document-plus',
  modification_contrat: 'file-document-edit',
  contrat_termine: 'file-document-remove',
  commission_payee: 'cash-check',
  creation_employeur: 'briefcase-plus',
  modification_employeur: 'briefcase-edit',
  suppression_employeur: 'briefcase-remove',
  creation_utilisateur: 'account-multiple-plus',
  connexion: 'login',
};

const ACTION_COLORS: Record<string, string> = {
  creation_fiche: M.success,
  modification_fiche: M.info,
  modification_champ: M.info,
  suppression_fiche: M.danger,
  creation_contrat: M.success,
  modification_contrat: M.info,
  contrat_termine: M.warning,
  commission_payee: M.success,
  creation_employeur: M.success,
  modification_employeur: M.info,
  suppression_employeur: M.danger,
  creation_utilisateur: M.info,
  connexion: M.primary,
};

// Renvoie null si la date est absente/invalide (jamais "Invalid Date").
function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

function formatRelative(dateStr: string): string {
  const date = parseDate(dateStr);
  if (!date) return '-';
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'À l\instant';
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Hier';
  if (days < 7) return `il y a ${days} j`;
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

function formatAbsolute(dateStr: string): string {
  const date = parseDate(dateStr);
  if (!date) return '-';
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── Navigation par date (point du jour) ──
function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shiftDay(day: string, delta: number): string {
  const [y, m, dd] = day.split('-').map(Number);
  const d = new Date(y, m - 1, dd);
  d.setDate(d.getDate() + delta);
  return isoDay(d);
}

// Plage locale du jour → format PocketBase (« yyyy-MM-dd HH:mm:ss », espace).
// IMPORTANT : toISOString() (« T », millis, Z) casse la comparaison texte de PB
// (l'espace < 'T' → tout est exclu) et le point du jour revient toujours vide.
function pbDateTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function dayRange(day: string): { dateDebut: string; dateFin: string } {
  const [y, m, dd] = day.split('-').map(Number);
  const start = new Date(y, m - 1, dd, 0, 0, 0);
  const end = new Date(y, m - 1, dd + 1, 0, 0, 0);
  return { dateDebut: pbDateTime(start), dateFin: pbDateTime(end) };
}

function dayLabel(day: string): string {
  const today = isoDay(new Date());
  if (day === today) return "Aujourd'hui";
  if (day === shiftDay(today, -1)) return 'Hier';
  const [y, m, dd] = day.split('-').map(Number);
  return new Date(y, m - 1, dd).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

// ── Accès fiche + avant/après ──
type ChangeItem = { field: string; oldValue: any; newValue: any };

// Parse le champ details (JSON stringifié par logAction) → liste de changements.
// Formes : {field, oldValue, newValue} (patch 1 champ) ou {changes: [...]} (formulaire complet).
function parseChanges(details: any): ChangeItem[] | null {
  if (!details) return null;
  try {
    const d = typeof details === 'string' ? JSON.parse(details) : details;
    if (d && Array.isArray(d.changes)) {
      const list = d.changes.filter((c: any) => c && typeof c.field === 'string');
      return list.length ? list : null;
    }
    if (d && typeof d.field === 'string') {
      return [{ field: d.field, oldValue: d.oldValue, newValue: d.newValue }];
    }
    return null;
  } catch {
    return null;
  }
}

function formatValue(v: any): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'object') {
    try {
      const s = JSON.stringify(v);
      return s.length > 80 ? s.slice(0, 80) + '…' : s;
    } catch {
      return '—';
    }
  }
  const s = String(v);
  return s.length > 80 ? s.slice(0, 80) + '…' : s;
}

function targetScreen(entiteType: string): string | null {
  if (entiteType === 'employe') return 'EmployeDetail';
  if (entiteType === 'employeur') return 'EmployeurDetail';
  if (entiteType === 'contrat') return 'ContratDetail';
  return null;
}

function entityButtonLabel(entiteType: string): string {
  if (entiteType === 'employe') return 'Voir la fiche employé ›';
  if (entiteType === 'employeur') return 'Voir la fiche employeur ›';
  if (entiteType === 'contrat') return 'Voir le contrat ›';
  return 'Voir la fiche ›';
}

// Pas de navigation sur suppression : la fiche n'existe plus.
const SUPPRESSION_TYPES = ['suppression_fiche', 'suppression_employeur'];

function openState(action: any): 'open' | 'deleted' | 'none' {
  if (!action?.entite_id) return 'none';
  if (SUPPRESSION_TYPES.includes(action.action_type)) return 'deleted';
  return targetScreen(action.entite_type) ? 'open' : 'none';
}

export default function JournalScreen() {
  const navigation = useNavigation();
  const [actions, setActions] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const subscriptionRef = useRef<any>(null);
  // Jour consulté (yyyy-mm-dd) — null = toutes dates. "Point du jour" = aujourd'hui.
  const [day, setDay] = useState<string | null>(null);

  // NOTE : getCurrentUser() renvoie un objet neuf à chaque appel → ne JAMAIS
  // le mettre en dep (boucle de rechargements infinie). On le lit dans le loader.
  const loadActions = useCallback(async () => {
    try {
      const u = getCurrentUser();
      const admin = u?.role === 'admin';
      const filters: any = {};
      if (!admin && u) {
        filters.userId = u.id;
      }
      if (filter !== 'all') {
        filters.actionType = filter;
      }
      if (day) {
        // Plage du jour poussée côté serveur (retrouve n'importe quelle date)
        const range = dayRange(day);
        filters.dateDebut = range.dateDebut;
        filters.dateFin = range.dateFin;
      }
      const data = await getJournalActions(filters);
      setActions(data);
    } catch (err) {
      console.error('[Journal] Erreur chargement:', err);
    }
  }, [filter, day]);

  // Résumé du jour (point du jour) : totaux par type d'action et par agent
  const summary = useMemo(() => {
    const byType: Record<string, number> = {};
    const byUser: Record<string, number> = {};
    for (const a of actions) {
      byType[a.action_type] = (byType[a.action_type] || 0) + 1;
      const u = a.user_display || '—';
      byUser[u] = (byUser[u] || 0) + 1;
    }
    return { total: actions.length, byType, byUser };
  }, [actions]);

  useFocusEffect(
    useCallback(() => {
      loadActions();
      // Temps réel
      return () => {
        if (subscriptionRef.current) {
          subscriptionRef.current();
          subscriptionRef.current = null;
        }
      };
    }, [loadActions])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadActions().finally(() => setRefreshing(false));
  };

  // Ouvre la fiche liée dans le DetailModal (même famille Root : un seul
  // dispatch, pas de fermeture manuelle). Le back revient au journal intact.
  const openEntity = (action: any) => {
    const screen = targetScreen(action.entite_type);
    if (!screen || openState(action) !== 'open') return;
    (navigation as any).navigate('DetailModal', {
      screen,
      params: { id: action.entite_id },
    });
  };

  // Grouper par jour
  const grouped = actions.reduce((acc: any, action: any) => {
    const date = parseDate(action.created);
    const day = date
      ? date.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: '2-digit' })
      : 'Sans date';
    if (!acc[day]) acc[day] = [];
    acc[day].push(action);
    return acc;
  }, {});

  const todayCount = actions.filter((a: any) => {
    const d = parseDate(a.created);
    if (!d) return false;
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;

  return (
    <View style={styles.container}>
      <AppHeader
        title="Notifications"
        showBack
        onBack={() => navigation.goBack()}
        right={
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{todayCount}</Text>
          </View>
        }
      />

      {/* Navigation par date — point du jour chaque soir */}
      <View style={styles.dateBar}>
        <TouchableOpacity
          onPress={() => day && setDay(shiftDay(day, -1))}
          disabled={!day}
          style={styles.dateArrow}
        >
          <Icon name="chevron-left" size={24} color={day ? M.primary : M.textTertiary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setDay(isoDay(new Date()))} style={styles.dateLabelWrap}>
          <Text style={styles.dateLabel}>{day ? dayLabel(day) : 'Toutes dates'}</Text>
          <Text style={styles.dateHint}>Toucher = aujourd'hui</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => day && setDay(shiftDay(day, 1))}
          disabled={!day || day === isoDay(new Date())}
          style={styles.dateArrow}
        >
          <Icon
            name="chevron-right"
            size={24}
            color={day && day !== isoDay(new Date()) ? M.primary : M.textTertiary}
          />
        </TouchableOpacity>
        {day ? (
          <Chip mode="outlined" onPress={() => setDay(null)} style={styles.chip}>
            Tout
          </Chip>
        ) : (
          <Chip mode="flat" onPress={() => setDay(isoDay(new Date()))} style={styles.chipActive}>
            Point du jour
          </Chip>
        )}
      </View>

      {/* Résumé du jour */}
      {day && (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>
            Point du {dayLabel(day).toLowerCase()} — {summary.total} action{summary.total > 1 ? 's' : ''}
          </Text>
          {Object.entries(summary.byType).map(([t, n]) => (
            <View key={t} style={styles.summaryRow}>
              <Icon name={ACTION_ICONS[t] || 'circle'} size={16} color={ACTION_COLORS[t] || M.primary} />
              <Text style={styles.summaryText}>{t.replace(/_/g, ' ')}</Text>
              <Text style={styles.summaryCount}>{n}</Text>
            </View>
          ))}
          <Text style={styles.summaryAgents}>
            Agents : {Object.entries(summary.byUser).map(([u, n]) => `${u} (${n})`).join(' · ') || '—'}
          </Text>
        </View>
      )}

      {/* Filtres par type */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar}>
        <Chip
          mode={filter === 'all' ? 'flat' : 'outlined'}
          selected={filter === 'all'}
          onPress={() => setFilter('all')}
          style={filter === 'all' ? styles.chipActive : styles.chip}
        >
          Tout
        </Chip>
        {Object.keys(ACTION_ICONS).map((type) => (
          <Chip
            key={type}
            mode={filter === type ? 'flat' : 'outlined'}
            selected={filter === type}
            onPress={() => setFilter(type)}
            style={filter === type ? styles.chipActive : styles.chip}
          >
            {type.replace(/_/g, ' ')}
          </Chip>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ width: '100%', maxWidth: 1100, alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {Object.keys(grouped).length === 0 ? (
          <View style={styles.empty}>
            <Icon name="bell-off-outline" size={64} color={M.textTertiary} />
            <Text style={styles.emptyTitle}>Aucune action</Text>
            <Text style={styles.emptySub}>Les actions apparaîtront ici</Text>
          </View>
        ) : (
          Object.entries(grouped).map(([day, items]) => (
            <View key={day} style={styles.dayGroup}>
              <Text style={styles.dayHeader}>{day}</Text>
              {(items as any[]).map((action: any) => (
                <TouchableOpacity
                  key={action.id}
                  style={styles.actionCard}
                  onPress={() => setExpanded(expanded === action.id ? null : action.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.actionRow}>
                    <View
                      style={[
                        styles.actionIcon,
                        { backgroundColor: (ACTION_COLORS[action.action_type] || M.primary) + '20' },
                      ]}
                    >
                      <Icon
                        name={ACTION_ICONS[action.action_type] || 'circle'}
                        size={18}
                        color={ACTION_COLORS[action.action_type] || M.primary}
                      />
                    </View>
                    <View style={styles.actionContent}>
                      <Text style={styles.actionDescription}>{action.description}</Text>
                      <Text style={styles.actionTime}>{formatRelative(action.created)}</Text>
                    </View>
                    <Icon
                      name={expanded === action.id ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={M.textTertiary}
                    />
                  </View>
                  {expanded === action.id && (
                    <View style={styles.actionDetails}>
                      <Text style={styles.actionDetailText}>
                        Par : {action.user_display}
                      </Text>
                      <Text style={styles.actionDetailText}>
                        {formatAbsolute(action.created)}
                      </Text>
                      {(() => {
                        const changes = parseChanges(action.details);
                        if (!changes) return null;
                        return (
                          <View style={styles.diffBox}>
                            {changes.map((c, i) => (
                              <View key={i} style={styles.diffRow}>
                                <Text style={styles.diffField}>{c.field}</Text>
                                <Text style={styles.diffValues}>
                                  <Text style={styles.diffBefore}>{formatValue(c.oldValue)}</Text>
                                  <Text style={styles.diffArrow}> → </Text>
                                  <Text style={styles.diffAfter}>{formatValue(c.newValue)}</Text>
                                </Text>
                              </View>
                            ))}
                          </View>
                        );
                      })()}
                      {openState(action) === 'open' && (
                        <TouchableOpacity
                          style={styles.openBtn}
                          onPress={() => openEntity(action)}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.openBtnText}>{entityButtonLabel(action.entite_type)}</Text>
                        </TouchableOpacity>
                      )}
                      {openState(action) === 'deleted' && (
                        <View style={styles.openBtnDisabled}>
                          <Text style={styles.openBtnDisabledText}>Fiche supprimée — accès impossible</Text>
                        </View>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: M.bg },
  badge: {
    backgroundColor: M.danger,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  filterBar: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    maxHeight: 50,
  },
  chip: { marginRight: Spacing.xs, backgroundColor: M.surface },
  chipActive: { marginRight: Spacing.xs, backgroundColor: M.primary },
  dateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  dateArrow: { padding: 4 },
  dateLabelWrap: { flex: 1, alignItems: 'center' },
  dateLabel: { fontSize: 16, fontWeight: '700', color: M.textPrimary, textTransform: 'capitalize' },
  dateHint: { fontSize: 11, color: M.textTertiary },
  summaryCard: {
    backgroundColor: M.surface,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    borderRadius: Radius.md,
    padding: Spacing.md,
    ...Shadows.soft,
  },
  summaryTitle: { fontSize: 15, fontWeight: '700', color: M.textPrimary, marginBottom: Spacing.sm },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 4 },
  summaryText: { flex: 1, fontSize: 13, color: M.textPrimary, textTransform: 'capitalize' },
  summaryCount: { fontSize: 13, fontWeight: '700', color: M.primary },
  summaryAgents: { fontSize: 12, color: M.textSecondary, marginTop: Spacing.xs },
  scrollView: { flex: 1 },
  dayGroup: { marginBottom: Spacing.md },
  dayHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: M.textSecondary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    textTransform: 'capitalize',
  },
  actionCard: {
    backgroundColor: M.surface,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xs,
    borderRadius: Radius.md,
    padding: Spacing.md,
    ...Shadows.soft,
  },
  actionRow: { flexDirection: 'row', alignItems: 'center' },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  actionContent: { flex: 1 },
  actionDescription: { fontSize: 14, color: M.textPrimary, fontWeight: '500' },
  actionTime: { fontSize: 11, color: M.textTertiary, marginTop: 2 },
  actionDetails: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: M.borderSoft,
  },
  actionDetailText: { fontSize: 12, color: M.textSecondary, marginBottom: 2 },
  diffBox: {
    backgroundColor: M.bg,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  diffRow: { marginBottom: 6 },
  diffField: { fontSize: 13, fontWeight: '700', color: M.textPrimary, marginBottom: 2 },
  diffValues: { fontSize: 13 },
  diffBefore: { color: M.danger, textDecorationLine: 'line-through' },
  diffArrow: { color: M.textTertiary },
  diffAfter: { color: M.success, fontWeight: '700' },
  openBtn: {
    backgroundColor: M.primary,
    borderRadius: Radius.sm,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  openBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  openBtnDisabled: {
    backgroundColor: M.borderSoft,
    borderRadius: Radius.sm,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  openBtnDisabledText: { color: M.textSecondary, fontSize: 13, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 80 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: M.textSecondary, marginTop: Spacing.lg },
  emptySub: { fontSize: 13, color: M.textTertiary, marginTop: Spacing.xs },
});
