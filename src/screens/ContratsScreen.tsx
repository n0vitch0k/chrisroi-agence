import React, { useState, useCallback, useMemo } from 'react';
import type { ContratListNavigationProp } from '../types/navigation';

import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { Card, Chip, FAB, Searchbar, SegmentedButtons } from 'react-native-paper';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { getAllContrats, getContratsFinProche } from '../database/service';
import { formatMoney, formatDate, getStatutColor, getStatutLabel, daysRemaining, getTypeContratLabel } from '../utils/constants';
import SafeButton from '../components/SafeButton';
import AppHeader from '../components/AppHeader';
import { Colors, Spacing, Radius, Shadows } from '../theme';

type StatutFilter = 'tous' | 'en_cours' | 'termine' | 'annule';
type CommissionFilter = 'toutes' | 'payee' | 'impayee';

export default function ContratsScreen() {
  const navigation = useNavigation<ContratListNavigationProp>();
  const [contrats, setContrats] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statutFilter, setStatutFilter] = useState<StatutFilter>('tous');
  const [typeFilter, setTypeFilter] = useState<string>('tous');
  const [commissionFilter, setCommissionFilter] = useState<CommissionFilter>('toutes');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const loadContrats = async () => {
    try {
      const results = await getAllContrats();
      setContrats(results || []);
    } catch (error) {
      console.error('Error loading contrats:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { loadContrats(); }, []));

  const onRefresh = () => { setRefreshing(true); loadContrats(); };

  // Types de contrat dynamiques (extraits des données)
  const dynamicTypesContrat = useMemo(() => {
    const values = [...new Set(contrats.map(c => c.type_contrat).filter(Boolean))];
    return values.map(v => ({ value: v, label: getTypeContratLabel(v) }));
  }, [contrats]);

  // Filtrage local complet
  const filtered = contrats.filter((c) => {
    // Filtre statut
    if (statutFilter !== 'tous' && c.statut !== statutFilter) return false;
    // Filtre type contrat
    if (typeFilter !== 'tous' && c.type_contrat !== typeFilter) return false;
    // Filtre commission
    if (commissionFilter === 'payee' && !c.commission_payee) return false;
    if (commissionFilter === 'impayee' && c.commission_payee) return false;
    // Recherche texte
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const numero = (c.numero_dossier || '').toLowerCase();
      const employe = `${c.employe_nom || ''} ${c.employe_prenom || ''}`.toLowerCase();
      const employeur = (c.nom_complet || '').toLowerCase();
      const poste = (c.poste || '').toLowerCase();
      if (!numero.includes(q) && !employe.includes(q) && !employeur.includes(q) && !poste.includes(q)) return false;
    }
    return true;
  });

  // Comptages
  const countByStatut = (s: string) => contrats.filter((c) => c.statut === s).length;
  const countByType = (t: string) => contrats.filter((c) => c.type_contrat === t).length;

  const hasFilters = statutFilter !== 'tous' || typeFilter !== 'tous' || commissionFilter !== 'toutes';

  const clearFilters = () => {
    setStatutFilter('tous');
    setTypeFilter('tous');
    setCommissionFilter('toutes');
    setSearchQuery('');
  };

  const renderItem = ({ item }: { item: any }) => {
    const remaining = daysRemaining(item.date_fin);
    const isUrgent = remaining !== null && remaining <= 7 && item.statut === 'en_cours';
    return (
      <SafeButton style={styles.cardButton} onPress={() => navigation.navigate('ContratDetail', { id: item.id })}>
        <Card style={[card, isUrgent && styles.cardUrgent]}>
          <Card.Content style={styles.cardPad}>
            <View style={styles.topRow}>
              <View style={styles.topLeft}>
                <Text style={styles.numero}>{item.numero_dossier}</Text>
                <Text style={styles.poste}>{item.poste}</Text>
              </View>
              <Chip mode="outlined" compact style={[styles.statusChip, { borderColor: getStatutColor(item.statut) }]}
                textStyle={[styles.statusChipText, { color: getStatutColor(item.statut) }]}>
                {getStatutLabel(item.statut)}
              </Chip>
            </View>

            <View style={styles.infoLine}>
              <Icon name="account" size={14} color={Colors.textTertiary} />
              <Text style={styles.infoText}>{item.employe_nom} {item.employe_prenom}</Text>
            </View>
            <View style={styles.infoLine}>
              <Icon name="home-city" size={14} color={Colors.textTertiary} />
              <Text style={styles.infoText}>{getTypeContratLabel(item.type_contrat)}</Text>
            </View>
            <View style={styles.infoLine}>
              <Icon name="office-building" size={14} color={Colors.textTertiary} />
              <Text style={styles.infoText}>{item.nom_complet}</Text>
            </View>

            <View style={styles.midRow}>
              <View style={styles.dateBlock}>
                <Text style={styles.dateLabel}>Début</Text>
                <Text style={styles.dateValue}>{formatDate(item.date_debut)}</Text>
              </View>
              <Icon name="arrow-right" size={14} color={Colors.textTertiary} />
              <View style={styles.dateBlock}>
                <Text style={styles.dateLabel}>Fin</Text>
                <Text style={styles.dateValue}>{formatDate(item.date_fin) || 'Non définie'}</Text>
              </View>
              {remaining !== null && item.statut === 'en_cours' && (
                <View style={[styles.remainBadge, remaining <= 3 && styles.remainUrgent]}>
                  <Text style={styles.remainText}>{remaining}j</Text>
                </View>
              )}
            </View>

            <View style={styles.bottomRow}>
              <View>
                <Text style={styles.amountLabel}>Salaire</Text>
                <Text style={styles.amountValue}>{formatMoney(item.salaire)}</Text>
              </View>
              <View style={styles.commissionBlock}>
                <Text style={styles.amountLabel}>Commission</Text>
                <Text style={[styles.amountValue, item.commission_payee ? { color: Colors.success } : { color: Colors.danger }]}>
                  {formatMoney(item.commission_agence)}
                  {!item.commission_payee && item.commission_agence > 0 ? '*' : ''}
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>
      </SafeButton>
    );
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Contrats" />
      {/* Barre de recherche */}
      <View style={styles.searchBar}>
        <Searchbar placeholder="N° dossier, employé, employeur, poste..." onChangeText={setSearchQuery} value={searchQuery}
          style={styles.searchInput} inputStyle={styles.searchInputText} iconColor={Colors.iconLight} />
      </View>

      {/* Filtres statut */}
      <View style={styles.filterBar}>
        <SegmentedButtons value={statutFilter} onValueChange={(v) => setStatutFilter(v as StatutFilter)}
          buttons={[
            { value: 'tous', label: `Tous (${contrats.length})` },
            { value: 'en_cours', label: `Actifs (${countByStatut('en_cours')})` },
            { value: 'termine', label: `Terminés (${countByStatut('termine')})` },
          ]}
          style={styles.segmented} theme={{ colors: { secondaryContainer: Colors.primaryLight } }} />
      </View>

      {/* Toggle filtres avancés */}
      <SafeButton
        style={styles.advancedToggle}
        onPress={() => setShowAdvanced(!showAdvanced)}
      >
        <Icon name={showAdvanced ? 'filter-off' : 'filter-variant'} size={16} color={Colors.primary} />
        <Text style={styles.advancedToggleText}>
          {showAdvanced ? 'Masquer les filtres' : 'Plus de filtres'}
        </Text>
        {hasFilters && !showAdvanced && (
          <View style={styles.filterBadge}>
            <Text style={styles.filterBadgeText}>●</Text>
          </View>
        )}
      </SafeButton>

      {/* Filtres avancés */}
      {showAdvanced && (
        <View style={styles.advancedFilters}>
          {/* Type contrat */}
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Type de contrat</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              <Chip
                key="tous"
                mode={typeFilter === 'tous' ? 'flat' : 'outlined'}
                compact
                style={[styles.chip, typeFilter === 'tous' && styles.chipActive]}
                textStyle={[styles.chipText, typeFilter === 'tous' && styles.chipTextActive]}
                onPress={() => setTypeFilter('tous')}
              >
                Tous
              </Chip>
              {dynamicTypesContrat.map((t) => (
                <Chip
                  key={t.value}
                  mode={typeFilter === t.value ? 'flat' : 'outlined'}
                  compact
                  style={[styles.chip, typeFilter === t.value && styles.chipActive]}
                  textStyle={[styles.chipText, typeFilter === t.value && styles.chipTextActive]}
                  onPress={() => setTypeFilter(t.value)}
                >
                  {t.label}
                </Chip>
              ))}
            </ScrollView>
          </View>

          {/* Commission */}
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Commission</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {(['toutes', 'payee', 'impayee'] as const).map((v) => (
                <Chip
                  key={v}
                  mode={commissionFilter === v ? 'flat' : 'outlined'}
                  compact
                  style={[styles.chip, commissionFilter === v && styles.chipActive]}
                  textStyle={[styles.chipText, commissionFilter === v && styles.chipTextActive]}
                  onPress={() => setCommissionFilter(v)}
                >
                  {v === 'toutes' ? 'Toutes' : v === 'payee' ? 'Payée' : 'Impayée'}
                </Chip>
              ))}
            </ScrollView>
          </View>

          {/* Bouton réinitialiser */}
          {hasFilters && (
            <SafeButton style={styles.clearBtn} onPress={clearFilters}>
              <Icon name="close-circle-outline" size={14} color={Colors.danger} />
              <Text style={styles.clearBtnText}>Réinitialiser les filtres</Text>
            </SafeButton>
          )}
        </View>
      )}

      {/* Résultats */}
      <View style={styles.resultBar}>
        <Text style={styles.resultText}>
          {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}
          {hasFilters ? ` (sur ${contrats.length})` : ''}
        </Text>
      </View>

      <FlatList data={filtered} renderItem={renderItem} keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="file-document-outline" size={64} color={Colors.iconLight} />
            <Text style={styles.emptyTitle}>Aucun contrat trouvé</Text>
            <Text style={styles.emptySub}>
              {searchQuery || hasFilters
                ? 'Essayez de modifier vos filtres'
                : 'Appuyez sur + pour créer un contrat'}
            </Text>
          </View>
        }
      />
      <FAB icon="plus" style={styles.fab} onPress={() => navigation.navigate('ContratDocument')} />
    </View>
  );
}

const card = { marginBottom: Spacing.sm, borderRadius: Radius.md, backgroundColor: Colors.surface, ...Shadows.soft };

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  searchBar: { backgroundColor: Colors.surface, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  searchInput: { height: 44, backgroundColor: Colors.background, borderRadius: Radius.sm },
  searchInputText: { fontSize: 14 },
  filterBar: { backgroundColor: Colors.surface, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  segmented: { backgroundColor: Colors.background, borderRadius: Radius.sm },
  // ── Toggle filtres avancés ──
  advancedToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  advancedToggleText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  filterBadge: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: Colors.danger, marginLeft: 4,
  },
  filterBadgeText: { fontSize: 0, color: 'transparent' },
  // ── Filtres avancés ──
  advancedFilters: {
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  filterSection: { marginBottom: Spacing.sm },
  filterLabel: {
    fontSize: 11, fontWeight: '700', color: Colors.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.5,
    paddingHorizontal: Spacing.lg, marginBottom: Spacing.xs,
  },
  chipRow: { paddingHorizontal: Spacing.lg, gap: 6 },
  chip: { height: 28 },
  chipActive: { backgroundColor: Colors.primaryLight },
  chipText: { fontSize: 12 },
  chipTextActive: { color: Colors.primaryDark, fontWeight: '600' },
  clearBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    marginHorizontal: Spacing.lg, marginTop: Spacing.xs,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.dangerLight, borderRadius: Radius.sm,
  },
  clearBtnText: { fontSize: 12, fontWeight: '600', color: Colors.danger },
  // ── Résultats ──
  resultBar: {
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  resultText: { fontSize: 12, color: Colors.textTertiary, fontWeight: '500' },
  // ── Liste ──
  list: { padding: Spacing.lg, paddingBottom: 100 },
  cardButton: { padding: 0, borderRadius: Radius.md, minHeight: 0 },
  cardUrgent: { borderLeftWidth: 3, borderLeftColor: Colors.danger, backgroundColor: Colors.dangerLight },
  cardPad: { paddingVertical: 4 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.sm },
  topLeft: { flex: 1 },
  numero: { fontSize: 15, fontWeight: '700', color: Colors.primary },
  poste: { fontSize: 13, color: Colors.textSecondary, marginTop: 1 },
  statusChip: { height: 26, borderRadius: 13 },
  statusChipText: { fontSize: 11, fontWeight: '600' },
  infoLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  infoText: { fontSize: 13, color: Colors.textPrimary },
  midRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.md, gap: Spacing.md },
  dateBlock: { flex: 1 },
  dateLabel: { fontSize: 11, fontWeight: '600', color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.3 },
  dateValue: { fontSize: 13, fontWeight: '500', color: Colors.textPrimary, marginTop: 1 },
  remainBadge: { backgroundColor: Colors.warning, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.pill },
  remainUrgent: { backgroundColor: Colors.danger },
  remainText: { color: Colors.textOnPrimary, fontWeight: '700', fontSize: 12 },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  amountLabel: { fontSize: 11, fontWeight: '600', color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.3 },
  amountValue: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, marginTop: 2 },
  commissionBlock: { alignItems: 'flex-end' },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: Colors.textSecondary, marginTop: Spacing.lg },
  emptySub: { fontSize: 13, color: Colors.textTertiary, marginTop: Spacing.sm },
  fab: { position: 'absolute', right: Spacing.lg, bottom: Spacing.lg, backgroundColor: Colors.success, borderRadius: Radius.lg },
});
