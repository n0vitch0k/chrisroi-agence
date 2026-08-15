import React, { useState, useCallback, useEffect, useRef } from 'react';
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
  suppression_fiche: 'account-remove',
  creation_contrat: 'file-document-plus',
  modification_contrat: 'file-document-edit',
  contrat_termine: 'file-document-remove',
  commission_payee: 'cash-check',
  creation_employeur: 'briefcase-plus',
  creation_utilisateur: 'account-multiple-plus',
  connexion: 'login',
};

const ACTION_COLORS: Record<string, string> = {
  creation_fiche: M.success,
  modification_fiche: M.info,
  suppression_fiche: M.danger,
  creation_contrat: M.success,
  modification_contrat: M.info,
  contrat_termine: M.warning,
  commission_payee: M.success,
  creation_employeur: M.success,
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

export default function JournalScreen() {
  const navigation = useNavigation();
  const [actions, setActions] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const subscriptionRef = useRef<any>(null);

  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === 'admin';

  const loadActions = useCallback(async () => {
    try {
      const filters: any = {};
      if (!isAdmin && currentUser) {
        filters.userId = currentUser.id;
      }
      if (filter !== 'all') {
        filters.actionType = filter;
      }
      const data = await getJournalActions(filters);
      setActions(data);
    } catch (err) {
      console.error('[Journal] Erreur chargement:', err);
    }
  }, [filter, isAdmin, currentUser]);

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
  empty: { alignItems: 'center', paddingVertical: 80 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: M.textSecondary, marginTop: Spacing.lg },
  emptySub: { fontSize: 13, color: M.textTertiary, marginTop: Spacing.xs },
});
