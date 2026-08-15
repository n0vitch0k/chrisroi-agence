import React, { useState, useCallback, useMemo } from 'react';
import type { EmployeurListNavigationProp } from '../types/navigation';

import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Alert,
  ScrollView,
} from 'react-native';
import { Card, Chip, FAB, Searchbar } from 'react-native-paper';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { getAllEmployeurs, getAllEmployes } from '../database/service';
import { Colors, Spacing, Radius, Shadows } from '../theme';
import SafeButton from '../components/SafeButton';
import AppHeader from '../components/AppHeader';

type TypeFilter = 'tous' | 'particulier' | 'entreprise' | 'commerce';

const TYPES_BESOIN: { value: TypeFilter; label: string; icon: string }[] = [
  { value: 'particulier', label: 'Particulier', icon: 'account' },
  { value: 'entreprise', label: 'Entreprise', icon: 'office-building' },
  { value: 'commerce', label: 'Commerce', icon: 'store' },
];

export default function EmployeursScreen() {
  const navigation = useNavigation<EmployeurListNavigationProp>();
  const tabNavigation = navigation.getParent();
  const [employeurs, setEmployeurs] = useState<any[]>([]);
  const [employesDispo, setEmployesDispo] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('tous');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const loadEmployeurs = async () => {
    try {
      const [results, employes] = await Promise.all([
        getAllEmployeurs(),
        getAllEmployes(),
      ]);
      setEmployeurs(results || []);
      setEmployesDispo((employes || []).filter((e: any) => e.statut === 'disponible'));
    } catch (error) {
      console.error('Error loading employers:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { loadEmployeurs(); }, []));

  const onRefresh = () => { setRefreshing(true); loadEmployeurs(); };

  // Types dynamiques extraits des données
  const dynamicTypes = useMemo(() => {
    const values = [...new Set(employeurs.map(e => e.type_besoin).filter(Boolean))];
    return values.map(v => ({
      value: v,
      label: (TYPES_BESOIN.find(t => t.value === v)?.label as string) || v,
      icon: (TYPES_BESOIN.find(t => t.value === v)?.icon as string) || 'help-circle-outline',
    }));
  }, [employeurs]);

  const filtered = employeurs.filter((e) => {
    // Filtre type
    if (typeFilter !== 'tous' && e.type_besoin !== typeFilter) return false;
    // Recherche texte
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return (
      (e.nom_complet || '').toLowerCase().includes(q) ||
      (e.nom_contact || '').toLowerCase().includes(q) ||
      (e.telephone || '').toLowerCase().includes(q) ||
      (e.email || '').toLowerCase().includes(q) ||
      (e.adresse || '').toLowerCase().includes(q) ||
      (e.ville || '').toLowerCase().includes(q) ||
      (e.quartier || '').toLowerCase().includes(q)
    );
  });

  const countByType = (t: string) => employeurs.filter((e) => e.type_besoin === t).length;

  const handleTrouver = (employeur: any) => {
    if (employesDispo.length === 0) {
      Alert.alert('Aucun candidat disponible', 'Il n\'y a pas de candidat disponible à proposer pour le moment.');
      return;
    }
    tabNavigation?.navigate('EmployesStack' as any, { screen: 'EmployesList' });
  };

  const renderItem = ({ item }: { item: any }) => {
    const typeInfo = TYPES_BESOIN.find((t) => t.value === item.type_besoin) || TYPES_BESOIN[0];
    const hasHistory = item.nombre_contrats > 0;

    return (
      <SafeButton
        style={styles.cardButton}
        onPress={() => navigation.navigate('EmployeurDetail', { id: item.id })}
      >
        <Card style={card}>
          <Card.Content style={styles.cardPad}>
            {/* Haut */}
            <View style={styles.topRow}>
              <View style={[styles.avatar, { backgroundColor: Colors.primaryLight }]}>
                <Icon name={typeInfo.icon as any} size={24} color={Colors.primaryDark} />
              </View>
              <View style={styles.info}>
                <Text style={styles.name} numberOfLines={1}>{item.nom_complet}</Text>
                <View style={styles.badgesRow}>
                  <Chip mode="flat" compact style={styles.typeChip} textStyle={styles.typeChipText}>
                    {typeInfo.label}
                  </Chip>
                  {hasHistory && (
                    <Chip mode="flat" compact style={styles.historyChip} textStyle={styles.historyChipText}>
                      {item.nombre_contrats} placement{item.nombre_contrats > 1 ? 's' : ''}
                    </Chip>
                  )}
                </View>
              </View>
              <Icon name="chevron-right" size={20} color={Colors.iconLight} />
            </View>

            {/* Contact */}
            <View style={styles.contactRow}>
              <Icon name="phone" size={14} color={Colors.textTertiary} />
              <Text style={styles.contactText}>{item.telephone || 'Tél. non renseigné'}</Text>
              {item.email && (
                <>
                  <Icon name="email" size={14} color={Colors.textTertiary} />
                  <Text style={styles.contactText}>{item.email}</Text>
                </>
              )}
            </View>

            {item.adresse && (
              <View style={styles.contactRow}>
                <Icon name="map-marker-outline" size={14} color={Colors.textTertiary} />
                <Text style={styles.contactText}>{item.adresse}{item.ville ? `, ${item.ville}` : ''}{item.quartier ? ` - ${item.quartier}` : ''}</Text>
              </View>
            )}

            {item.nom_contact && (
              <View style={styles.contactRow}>
                <Icon name="account-outline" size={14} color={Colors.textTertiary} />
                <Text style={styles.contactText}>
                  Contact : {item.nom_contact}{item.prenom_contact ? ` ${item.prenom_contact}` : ''}
                </Text>
              </View>
            )}

            {/* Actions */}
            <View style={styles.actionsRow}>
              {employesDispo.length > 0 && (
                <SafeButton style={styles.findBtn} onPress={() => handleTrouver(item)}>
                  <Icon name="account-search" size={16} color={Colors.textOnPrimary} />
                  <Text style={styles.findBtnText}>
                    Trouver ({employesDispo.length} dispo)
                  </Text>
                </SafeButton>
              )}
              <SafeButton
                style={styles.contratBtn}
                onPress={() => tabNavigation?.navigate('ContratsStack' as any, {
                  screen: 'ContratDocument',
                  params: { employe_id: undefined },
                })}
              >
                <Icon name="file-document-plus" size={16} color={Colors.primary} />
                <Text style={styles.contratBtnText}>Contrat</Text>
              </SafeButton>
            </View>
          </Card.Content>
        </Card>
      </SafeButton>
    );
  };

  return (
      <View style={styles.container}>
        <AppHeader title="Employeurs" />
        <View style={styles.searchBar}>
        <Searchbar
          placeholder="Nom, contact, téléphone, adresse..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchInput}
          inputStyle={styles.searchInputText}
          iconColor={Colors.iconLight}
        />
      </View>

      {/* Filtres type */}
      <View style={styles.filterBar}>
        {[{ value: 'tous', label: `Tous (${employeurs.length})` } as const, ...dynamicTypes].map((item) => (
          <Chip
            key={item.value}
            mode={typeFilter === item.value ? 'flat' : 'outlined'}
            compact
            style={[styles.filterChip, typeFilter === item.value && styles.filterChipActive]}
            textStyle={[styles.filterChipText, typeFilter === item.value && styles.filterChipTextActive]}
            onPress={() => setTypeFilter(item.value)}
          >
            {item.value === 'tous'
              ? `Tous (${employeurs.length})`
              : `${item.label} (${countByType(item.value)})`}
          </Chip>
        ))}
      </View>

      {/* Indicateur candidats dispo */}
      {employesDispo.length > 0 && (
        <View style={styles.availabilityBar}>
          <Icon name="account-check" size={16} color={Colors.success} />
          <Text style={styles.availabilityText}>
            {employesDispo.length} candidat{employesDispo.length > 1 ? 's' : ''} disponible{employesDispo.length > 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {/* Résultats */}
      <View style={styles.resultBar}>
        <Text style={styles.resultText}>
          {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}
          {typeFilter !== 'tous' ? ` (sur ${employeurs.length})` : ''}
        </Text>
      </View>

      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="office-building-outline" size={64} color={Colors.iconLight} />
            <Text style={styles.emptyTitle}>Aucune entreprise trouvée</Text>
            <Text style={styles.emptySub}>
              {searchQuery || typeFilter !== 'tous'
                ? 'Essayez de modifier vos filtres'
                : 'Appuyez sur + pour ajouter un employeur'}
            </Text>
          </View>
        }
      />

      <FAB
        icon="plus"
        color={Colors.textOnPrimary}
        style={styles.fab}
        onPress={() => navigation.navigate('EmployeurForm')}
      />
    </View>
  );
}

const card = { marginBottom: Spacing.sm, borderRadius: Radius.md, backgroundColor: Colors.surface, ...Shadows.soft };

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  searchBar: {
    backgroundColor: Colors.surface, paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  searchInput: { height: 44, backgroundColor: Colors.background, borderRadius: Radius.sm },
  searchInputText: { fontSize: 14 },
  // ── Filtres type ──
  filterBar: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  filterChip: { height: 28 },
  filterChipActive: { backgroundColor: Colors.primaryLight },
  filterChipText: { fontSize: 12 },
  filterChipTextActive: { color: Colors.primaryDark, fontWeight: '600' },
  // ── Barre disponibilité ──
  availabilityBar: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    backgroundColor: Colors.success + '10',
  },
  availabilityText: { fontSize: 13, fontWeight: '600', color: Colors.success },
  // ── Résultats ──
  resultBar: {
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  resultText: { fontSize: 12, color: Colors.textTertiary, fontWeight: '500' },
  // ── Liste ──
  list: { padding: Spacing.lg, paddingBottom: 100 },
  cardButton: { padding: 0, borderRadius: Radius.md, marginBottom: Spacing.sm, minHeight: 0 },
  cardPad: { paddingVertical: 4 },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md,
  },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  badgesRow: { flexDirection: 'row', gap: 4, marginTop: 4 },
  typeChip: { height: 22, backgroundColor: Colors.primaryLight },
  typeChipText: { fontSize: 11, color: Colors.primaryDark, fontWeight: '600' },
  historyChip: { height: 22, backgroundColor: Colors.success + '15' },
  historyChipText: { fontSize: 11, color: Colors.success, fontWeight: '600' },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  contactText: { fontSize: 12, color: Colors.textTertiary },
  // ── Actions ──
  actionsRow: {
    flexDirection: 'row', gap: Spacing.sm,
    marginTop: Spacing.md, paddingTop: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.borderLight,
  },
  findBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    backgroundColor: Colors.success, borderRadius: Radius.sm,
    paddingVertical: Spacing.sm,
  },
  findBtnText: { color: Colors.textOnPrimary, fontSize: 13, fontWeight: '700' },
  contratBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    backgroundColor: Colors.background, borderRadius: Radius.sm,
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md,
  },
  contratBtnText: { color: Colors.primary, fontSize: 13, fontWeight: '600' },
  // ── État vide ──
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: Colors.textSecondary, marginTop: Spacing.lg },
  emptySub: { fontSize: 13, color: Colors.textTertiary, marginTop: Spacing.sm },
  // ── FAB ──
  fab: {
    position: 'absolute', right: Spacing.lg, bottom: Spacing.lg,
    backgroundColor: Colors.primaryDark, borderRadius: Radius.lg,
  },
});
