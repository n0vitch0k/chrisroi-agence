import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Linking,
  TextInput,
  Modal,
} from 'react-native';
import { Card } from 'react-native-paper';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { SuiviListNavigationProp } from '../types/navigation';
import {
  getCommissionsAPercevoir,
  getCalendarEvents,
  getContratsFinProche,
  marquerCommissionPayee,
  getCommissionDueDate,
} from '../database/service';
import { formatMoney } from '../utils/constants';
import { Colors, Spacing, Radius, Shadows } from '../theme';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import MonthCalendar, { CalendarEvent } from '../components/WeekCalendar';
import AppHeader from '../components/AppHeader';

export default function SuiviScreen() {
  const navigation = useNavigation<SuiviListNavigationProp>();
  const tabNavigation = navigation.getParent();
  const rootNavigation = tabNavigation?.getParent();
  const [commissions, setCommissions] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [contratsFinProche, setContratsFinProche] = useState<any[]>([]);
  const load = async () => {
    try {
      const now = new Date();
      const [comms, monthEvents, contratsData] = await Promise.all([
        getCommissionsAPercevoir(),
        getCalendarEvents(now.getFullYear(), now.getMonth()),
        getContratsFinProche(),
      ]);
      setCommissions(comms || []);
      setCalendarEvents(monthEvents || []);
      setContratsFinProche(contratsData || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));
  const onRefresh = () => { setRefreshing(true); load(); };

// ─── Groupement : règle UNIQUE (décision Phase 4, point 10) ───
// Échéance de la commission = 1 mois calendaire après date_debut
// (getCommissionDueDate) — même règle que le calendrier.
const now = Date.now();
const dueTime = (c: any): number => {
  const due = getCommissionDueDate(c);
  // Fin de la journée d'échéance : à relancer à partir du lendemain
  return due ? new Date(due + 'T23:59:59').getTime() : 0;
};
const enAttente = commissions.filter((c: any) => now < dueTime(c));
const aRelancer = commissions.filter((c: any) => now >= dueTime(c));

  const totalDu = commissions.reduce((s: number, c: any) => s + (c.commission_agence || 0), 0);
  const totalAttente = enAttente.reduce((s: number, c: any) => s + (c.commission_agence || 0), 0);
  const totalRelance = aRelancer.reduce((s: number, c: any) => s + (c.commission_agence || 0), 0);

  const handleCall = (tel: string, nom: string) => {
    const phone = tel?.replace(/[^0-9+]/g, '');
    if (phone) {
      Linking.openURL(`tel:${phone}`).catch(() =>
        Alert.alert('Impossible d\'appeler', `Numéro : ${phone}`)
      );
    } else {
      Alert.alert('Pas de numéro', `Aucun numéro pour ${nom}`);
    }
  };

  const handlePayer = (id: string) => {
    Alert.alert(
      'Commission prélevée ?',
      'Confirmez que vous avez bien reçu le paiement de l\'employeur.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Oui, marquer payée',
          onPress: async () => {
            const today = new Date().toISOString().substring(0, 10);
            await marquerCommissionPayee(id, today);
            load();
          },
        },
      ]
    );
  };

  const renderCommission = (item: any) => {
    // Date d'échéance = 1 mois calendaire après date_debut (règle unique)
    const dueStr = getCommissionDueDate(item);
    const dateDue = dueStr ? new Date(dueStr + 'T12:00:00') : null;
    const nowTime = Date.now();
    const age = dateDue ? Math.floor((nowTime - dateDue.getTime()) / 86400000) : 0;
    const isUrgent = dateDue ? nowTime >= dateDue.getTime() : false;

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        style={styles.cardBtn}
        onPress={() => {
          rootNavigation?.navigate('ContratDocumentModal', { id: item.id, origin: { label: 'Commissions' } });
        }}
      >
        <Card style={styles.card}>
          <Card.Content style={styles.cardPad}>
            {/* Haut */}
            <View style={styles.topRow}>
              <View style={[styles.avatar, { backgroundColor: isUrgent ? Colors.dangerLight : Colors.warningLight }]}>
                <Icon name={isUrgent ? 'alert-circle' : 'clock-outline'} size={22} color={isUrgent ? Colors.danger : Colors.warning} />
              </View>
              <View style={styles.info}>
                <View style={styles.nomRow}>
                  <Text style={styles.employeNom} numberOfLines={1}>
                    {item.employe_nom} {item.employe_prenom}
                  </Text>
                  <View style={[styles.ageTag, { backgroundColor: isUrgent ? Colors.danger + '15' : Colors.warning + '15' }]}>
                    <Text style={[styles.ageTagText, { color: isUrgent ? Colors.danger : Colors.warning }]}>
                      J+{age}
                    </Text>
                  </View>
                </View>
                <Text style={styles.employeurText}>{item.nom_complet}</Text>
              </View>
              <Icon name="chevron-right" size={18} color={Colors.iconLight} />
            </View>

            {/* Montant */}
            <View style={styles.montantRow}>
              <Icon name="cash" size={16} color={Colors.primary} />
              <Text style={styles.montantText}>{formatMoney(item.commission_agence)} F CFA</Text>
            </View>

            {/* Date contrat */}
            <View style={styles.metaRow}>
              <Icon name="calendar" size={12} color={Colors.textTertiary} />
              <Text style={styles.metaText}>
                Contrat signé le {new Date(item.date_contrat || item.created_at).toLocaleDateString('fr-FR')}
              </Text>
            </View>

            {/* Téléphone employeur */}
            {item.expand?.employeur_id?.telephone && (
              <View style={styles.metaRow}>
                <Icon name="phone" size={12} color={Colors.textTertiary} />
                <Text style={styles.metaText}>{item.expand.employeur_id.telephone}</Text>
              </View>
            )}

            {/* Actions */}
            <View style={styles.actionsRow}>
              {item.expand?.employeur_id?.telephone ? (
                <TouchableOpacity
                  style={styles.appelBtn}
                  onPress={() => handleCall(item.expand.employeur_id.telephone, item.nom_complet)}
                >
                  <Icon name="phone" size={16} color={Colors.textOnPrimary} />
                  <Text style={styles.appelBtnText}>Appeler</Text>
                </TouchableOpacity>
              ) : (
                <View style={[styles.appelBtn, styles.appelBtnDisabled]}>
                  <Icon name="phone-off" size={16} color={Colors.textTertiary} />
                  <Text style={[styles.appelBtnText, { color: Colors.textTertiary }]}>Pas de numéro</Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.payerBtn}
                onPress={() => handlePayer(item.id)}
              >
                <Icon name="cash-check" size={16} color={Colors.success} />
                <Text style={styles.payerBtnText}>Marquer payée</Text>
              </TouchableOpacity>
            </View>
          </Card.Content>
        </Card>
      </TouchableOpacity>
    );
  };

  // Sections pour la FlatList
  const sections = [
    ...(aRelancer.length > 0
      ? [{ key: 'relance', title: `⚠️ À relancer (${aRelancer.length})`, data: aRelancer, montant: totalRelance }]
      : []),
    ...(enAttente.length > 0
      ? [{ key: 'attente', title: `⏳ En attente (${enAttente.length})`, data: enAttente, montant: totalAttente }]
      : []),
  ];
  // Fusionner événements calendrier + contrats fin proche
  const weekEvents = React.useMemo(() => {
    const all: CalendarEvent[] = [...calendarEvents];
    for (const c of contratsFinProche) {
      if (c.date_fin) {
        all.push({
          id: `fin_${c.id}`,
          date: c.date_fin,
          type: 'fin_contrat',
          titre: `${c.employe_nom || ''} ${c.employe_prenom || ''}`.trim() || 'Fin contrat',
          sousTitre: c.nom_complet || '',
          ref: c.numero_dossier,
          contrat_id: c.id,
        });
      }
    }
    return all;
  }, [calendarEvents, contratsFinProche]);

  const onMonthChange = useCallback((year: number, month: number) => {
    setLoading(true);
    getCalendarEvents(year, month)
      .then((events) => setCalendarEvents(events || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const onEventPress = useCallback((evt: CalendarEvent) => {
    if (evt.type === 'contrat' || evt.type === 'fin_contrat' || evt.type === 'commission') {
      if (evt.contrat_id) {
        rootNavigation?.navigate('ContratDocumentModal', { id: evt.contrat_id, origin: { label: 'Suivi' } });
      }
    } else if (evt.type === 'inscription') {
      if (evt.employe_id) {
        navigation.navigate('EmployesStack', { screen: 'EmployeDetail', params: { id: evt.employe_id } });
      }
    }
  }, [rootNavigation, navigation]);


  return (
    <View style={{ flex: 1 }}>
      <AppHeader title="Suivi commissions" showBack={false} />
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
      {/* ─── Calendrier ─── */}
      <View style={styles.calendarSection}>
        <MonthCalendar
          events={weekEvents}
          onMonthChange={onMonthChange}
          onEventPress={onEventPress}
        />
      </View>

      {/* ─── Barre stats ─── */}
      <View style={styles.statsBar}>
        <View style={[styles.stat, { backgroundColor: Colors.danger + '12' }]}>
          <Text style={[styles.statNumber, { color: Colors.danger }]}>{aRelancer.length}</Text>
          <Text style={styles.statLabel}>À relancer</Text>
        </View>
        <View style={[styles.stat, { backgroundColor: Colors.warning + '12' }]}>
          <Text style={[styles.statNumber, { color: Colors.warning }]}>{enAttente.length}</Text>
          <Text style={styles.statLabel}>En attente</Text>
        </View>
        <View style={[styles.stat, { backgroundColor: Colors.primary + '12' }]}>
          <Text style={[styles.statNumber, { color: Colors.primary, fontSize: 18 }]}>{formatMoney(totalDu)}</Text>
          <Text style={styles.statLabel}>Total dû</Text>
        </View>
      </View>

      {/* ─── Liste ─── */}
      <View style={styles.listContent}>
        {sections.map((section) => (
          <View key={section.key} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionMontant}>{formatMoney(section.montant)} F CFA</Text>
            </View>
            {section.data.map((item: any) => (
              <View key={item.id}>{renderCommission(item)}</View>
            ))}
          </View>
        ))}
        {!loading && sections.length === 0 && (
          <View style={styles.empty}>
            <Icon name="check-circle-outline" size={64} color={Colors.success} />
            <Text style={styles.emptyTitle}>Tout est à jour</Text>
            <Text style={styles.emptySub}>Aucune commission en attente</Text>
          </View>
        )}
      </View>
    </ScrollView>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  calendarSection: {
    padding: Spacing.lg,
    paddingBottom: 0,
  },
  // Stats
  statsBar: {
    flexDirection: 'row', gap: Spacing.sm,
    padding: Spacing.lg, paddingBottom: 0,
  },
  stat: {
    flex: 1, borderRadius: Radius.md, paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  statNumber: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  // Sections
  section: { marginBottom: Spacing.md },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  sectionMontant: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  // Liste
  listContent: { paddingBottom: Spacing.xxl },
  // Carte
  card: { marginHorizontal: Spacing.lg, marginBottom: Spacing.sm, borderRadius: Radius.md, backgroundColor: Colors.surface, ...Shadows.soft },
  cardBtn: { padding: 0, borderRadius: Radius.md, minHeight: 0 },
  cardPad: { paddingVertical: 4 },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md,
  },
  info: { flex: 1 },
  nomRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  employeNom: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, flex: 1 },
  ageTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.pill },
  ageTagText: { fontSize: 11, fontWeight: '700' },
  employeurText: { fontSize: 13, color: Colors.textSecondary, marginTop: 1 },
  montantRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: Spacing.sm,
  },
  montantText: { fontSize: 16, fontWeight: '800', color: Colors.primary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  metaText: { fontSize: 12, color: Colors.textTertiary },
  // Actions
  actionsRow: {
    flexDirection: 'row', gap: Spacing.sm,
    marginTop: Spacing.md, paddingTop: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.borderLight,
  },
  appelBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: Spacing.sm, borderRadius: Radius.sm,
    backgroundColor: Colors.primaryDark,
  },
  appelBtnDisabled: {
    backgroundColor: Colors.background,
  },
  appelBtnText: { color: Colors.textOnPrimary, fontSize: 13, fontWeight: '700' },
  payerBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: Spacing.sm, borderRadius: Radius.sm,
    backgroundColor: Colors.success + '12',
  },
  payerBtnText: { color: Colors.success, fontSize: 13, fontWeight: '700' },
  // Empty
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: Colors.textSecondary, marginTop: Spacing.lg },
  emptySub: { fontSize: 13, color: Colors.textTertiary, marginTop: Spacing.sm },
});
