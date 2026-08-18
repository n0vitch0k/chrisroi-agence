import React, { useState, useCallback, useMemo } from 'react';
import type { GlobalNavigationProp } from '../types/navigation';

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { Chip } from 'react-native-paper';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  getAllEmployes,
  getAllEmployeurs,
  getAllContrats,
} from '../database/service';
import {
  getCategorieLabel,
  getStatutColor,
  getStatutLabel,
  daysRemaining,
  formatMoney,
} from '../utils/constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppHeader from '../components/AppHeader';
import { Colors, Spacing, Radius, Shadows } from '../theme';
import SafeButton from '../components/SafeButton';

// ─── Alias thème central ────────────────────────────────────
const M = { ...Colors, shadow: Shadows.card.shadowColor } as const;

type ResultType = 'employe' | 'employeur' | 'contrat';
type StatutFilter = 'tous' | 'disponible' | 'en_poste';

type SearchResult = {
  id: string;
  type: ResultType;
  title: string;
  meta: string;
  details: string[];
  icon: string;
  avatarStyle: string;
  onPress?: () => void;
  prenom?: string;
  nom?: string;
  initials?: string;
  telephone?: string;
  lieu_residence?: string;
  categorie?: string;
  statut?: string;
  isEnPoste?: boolean;
};

// ─── Filtres statut ─────────────────────────────────────────
const STATUT_FILTERS: { key: StatutFilter; label: string; dot: string; dotBg: string; textColor: string; bg: string }[] = [
  { key: 'tous', label: 'Tous', dot: M.primary, dotBg: M.primaryDim, textColor: M.primary, bg: M.primaryDim },
  { key: 'disponible', label: 'Disponibles', dot: M.success, dotBg: M.successDim, textColor: M.success, bg: M.successDim },
  { key: 'en_poste', label: 'En poste', dot: M.info, dotBg: M.infoDim, textColor: M.info, bg: M.infoDim },
];

const TYPE_FILTERS: Array<{ label: string; value: ResultType | 'all' | 'urgent' }> = [
  { label: 'Tout', value: 'all' },
  { label: 'Employés', value: 'employe' },
  { label: 'Employeurs', value: 'employeur' },
  { label: 'Contrats', value: 'contrat' },
  { label: 'Urgent', value: 'urgent' },
];

export default function GlobalSearchScreen() {
  const navigation = useNavigation<GlobalNavigationProp>();
  const tabNavigation = navigation.getParent();
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<ResultType | 'all' | 'urgent'>('all');
  const [statutFilter, setStatutFilter] = useState<StatutFilter>('tous');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [employes, setEmployes] = useState<any[]>([]);

  // ─── Chargement des données ───────────────────────────────
  const loadResults = useCallback(async () => {
    try {
      const [employesData, employeursData, contratsData] = await Promise.all([
        getAllEmployes(),
        getAllEmployeurs(),
        getAllContrats(),
      ]);
      setEmployes(employesData || []);
      const normalized = query.trim().toLowerCase();
      const next: SearchResult[] = [];

      (employesData || []).forEach((item: any) => {
        const text = [item.nom, item.prenom, item.telephone, getCategorieLabel(item.categorie_emploi)]
          .filter(Boolean).join(' ').toLowerCase();
        if (normalized && !text.includes(normalized)) return;
        const isEnPoste = item.statut === 'en_poste';
        next.push({
          id: `employe-${item.id}`,
          type: 'employe',
          title: `${item.prenom} ${item.nom}`,
          meta: `${getCategorieLabel(item.categorie_emploi)} · ${getStatutLabel(item.statut)}`,
          details: [
            `📞 ${item.telephone || 'Tél. non renseigné'}`,
            `📍 ${item.lieu_residence || item.ville || ''}`.trim(),
          ],
          icon: '👤',
          avatarStyle: isEnPoste ? 'purple' : 'blue',
          onPress: () => navigation.navigate('EmployesStack' as any, { screen: 'EmployeDetail', params: { id: item.id } }),
          prenom: item.prenom,
          nom: item.nom,
          initials: `${item.prenom?.charAt(0) || ''}${item.nom?.charAt(0) || ''}`.toUpperCase(),
          telephone: item.telephone,
          lieu_residence: item.lieu_residence,
          categorie: getCategorieLabel(item.categorie_emploi),
          statut: item.statut,
          isEnPoste,
        });
      });

      (employeursData || []).forEach((item: any) => {
        const text = [item.nom_complet, item.nom_contact, item.prenom_contact, item.telephone, item.type_besoin]
          .filter(Boolean).join(' ').toLowerCase();
        if (normalized && !text.includes(normalized)) return;
        next.push({
          id: `employeur-${item.id}`,
          type: 'employeur',
          title: item.nom_complet || `${item.nom_contact || ''} ${item.prenom_contact || ''}`.trim(),
          meta: `${item.type_besoin === 'particulier' ? 'Particulier' : 'Entreprise'} · ${item.contrats_actifs || 0} contrats actifs`,
          details: [
            `📞 ${item.telephone || 'Tél. non renseigné'}`,
            `📍 ${item.ville || ''}`.trim(),
            `💰 ${item.contrats_actifs || 0} contrats`,
          ],
          icon: item.type_besoin === 'particulier' ? '🏠' : '🏢',
          avatarStyle: 'purple',
          onPress: () => navigation.navigate('EmployeursStack', { screen: 'EmployeurDetail', params: { id: item.id } }),
        });
      });

      (contratsData || []).forEach((item: any) => {
        const remaining = daysRemaining(item.date_fin);
        const text = [item.numero_dossier, item.employe_nom, item.employe_prenom, item.nom_complet, item.poste]
          .filter(Boolean).join(' ').toLowerCase();
        if (normalized && !text.includes(normalized)) return;
        next.push({
          id: `contrat-${item.id}`,
          type: 'contrat',
          title: item.numero_dossier || `Contrat ${item.id}`,
          meta: `${item.employe_nom} ${item.employe_prenom} · ${item.nom_complet}`,
          details: [
            remaining !== null ? `📅 Fin dans ${remaining}j` : '📅 En cours',
            item.commission_agence > 0 ? `💰 ${formatMoney(item.commission_agence)}` : '',
            item.statut === 'en_cours' && remaining !== null && remaining <= 7 ? '⚠️ Urgent' : '',
          ].filter(Boolean),
          icon: '📄',
          avatarStyle: 'orange',
          onPress: () => navigation.navigate('ContratDocumentModal', { id: item.id, origin: { label: 'Recherche' } }),
        });
      });

      setResults(next);
    } catch (error) {
      console.error('Error loading global search:', error);
    } finally {
      setRefreshing(false);
    }
  }, [navigation, query]);

  useFocusEffect(useCallback(() => {
    setRefreshing(true);
    loadResults();
  }, [loadResults]));

  const onRefresh = () => { setRefreshing(true); loadResults(); };

  // ─── Filtrage ─────────────────────────────────────────────
  const filteredResults = useMemo(() => {
    let items = results;
    if (typeFilter !== 'all') {
      if (typeFilter === 'urgent') {
        items = items.filter((item) =>
          item.details.some((d) => d.includes('Urgent') || d.includes('Fin dans'))
        );
      } else {
        items = items.filter((item) => item.type === typeFilter);
      }
    }
    if (typeFilter === 'employe' || typeFilter === 'all') {
      const employeItems = items.filter((item) => item.type === 'employe');
      const otherItems = items.filter((item) => item.type !== 'employe');
      const filteredEmployes = employeItems.filter((e) => {
        if (statutFilter === 'tous') return true;
        if (statutFilter === 'en_poste') return e.statut === 'en_poste';
        if (statutFilter === 'disponible') return e.statut !== 'en_poste';
        return true;
      });
      return [...filteredEmployes, ...otherItems];
    }
    return items;
  }, [results, typeFilter, statutFilter]);

  // Comptages
  const countByType = (type: string) =>
    type === 'all' ? results.length :
    type === 'urgent' ? results.filter((i) => i.details.some((d) => d.includes('Urgent') || d.includes('Fin dans'))).length :
    results.filter((i) => i.type === type).length;

  const countByStatut = (s: string) =>
    s === 'en_poste' ? employes.filter((e) => e.statut === 'en_poste').length :
    employes.filter((e) => e.statut !== 'en_poste').length;

  // ─── Rendu carte employé ──────────────────────────────────
  const renderEmployeCard = (item: SearchResult) => {
    const statusColor = getStatutColor(item.isEnPoste ? 'en_poste' : 'disponible');
    const statusLabel = item.isEnPoste ? 'En poste' : 'Disponible';
    const isDisponible = !item.isEnPoste;
    const avatarBg = item.isEnPoste ? M.infoDim : M.primaryDim;

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        style={styles.employeCard}
        onPress={item.onPress}
      >
        <View style={styles.employeCardInner}>
          <View style={styles.avatarWrap}>
            <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
              <Text style={[styles.avatarText, { color: statusColor }]}>{item.initials}</Text>
            </View>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardName} numberOfLines={1}>
              {item.prenom} {item.nom}
            </Text>
            <View style={styles.cardTags}>
              {item.categorie ? (
                <View style={[styles.tag, styles.tagCategory]}>
                  <Text style={styles.tagCategoryText}>{item.categorie}</Text>
                </View>
              ) : null}
              <View style={[styles.tag, styles.tagStatus, { backgroundColor: statusColor + '18' }]}>
                <Text style={[styles.tagStatusText, { color: statusColor }]}>{statusLabel}</Text>
              </View>
            </View>
            <View style={styles.cardMeta}>
              {item.telephone ? (<Text style={styles.metaText}>📞 {item.telephone}</Text>) : null}
              {item.lieu_residence ? (<Text style={styles.metaText}>📍 {item.lieu_residence}</Text>) : null}
            </View>
          </View>
        </View>
        <View style={styles.cardActions}>
          {isDisponible ? (
            <>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnPrimary]}
                onPress={() => tabNavigation?.navigate('ContratsStack' as any, { screen: 'ContratDocument', params: { employe_id: item.id?.replace('employe-', '') } })}
                activeOpacity={0.8}
              >
                <Text style={styles.actionBtnIcon}>📋</Text>
                <Text style={styles.actionBtnTextPrimary}>Placer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnSecondary]}
                onPress={() => navigation.navigate('FicheInscriptionModal' as any, { id: item.id?.replace('employe-', '') })}
                activeOpacity={0.8}
              >
                <Text style={styles.actionBtnIcon}>📄</Text>
                <Text style={styles.actionBtnTextSecondary}>Fiche</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnSecondary]}
              onPress={() => navigation.navigate('EmployesStack' as any, { screen: 'FicheInscription', params: { id: item.id?.replace('employe-', '') } })}
              activeOpacity={0.8}
            >
              <Text style={styles.actionBtnIcon}>📄</Text>
              <Text style={styles.actionBtnTextSecondary}>Ouvrir la fiche</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // ─── Rendu carte générique (employeur/contrat) ────────────
  const renderGenericCard = (item: SearchResult) => (
    <TouchableOpacity style={styles.resultCard} onPress={item.onPress ?? (() => {})} activeOpacity={0.7}>
      <View style={styles.resultTop}>
        <View style={styles.resultIdentity}>
          <View style={[styles.resultAvatar, avatarStyles[item.avatarStyle]]}>
            <Text style={styles.resultAvatarText}>{item.icon}</Text>
          </View>
          <View style={styles.resultInfo}>
            <Text style={styles.resultTitle}>{item.title}</Text>
            <Text style={styles.resultMeta}>{item.meta}</Text>
          </View>
        </View>
        <View style={[styles.typePill, typeStyles[item.type]]}>
          <Text style={styles.typePillText}>{typeLabel(item.type)}</Text>
        </View>
      </View>
      <View style={styles.detailsRow}>
        {item.details.filter((d) => d && d.replace(/^\W+/, '').trim().length > 0).map((detail, index) => (
          <View key={`${item.id}-${index}`} style={styles.detailPill}>
            <Text style={styles.detailText}>{detail}</Text>
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );

  // ─── Regroupement par sections ────────────────────────────
  const employeResults = filteredResults.filter((i) => i.type === 'employe');
  const employeurResults = filteredResults.filter((i) => i.type === 'employeur');
  const contratResults = filteredResults.filter((i) => i.type === 'contrat');
  const showStatutFilters = typeFilter === 'employe' || typeFilter === 'all';
  const showSections = typeFilter === 'all';

  return (
    <View style={styles.container}>
      <AppHeader title="Dossiers" showBack onBack={() => navigation.goBack()} />

      {/* ─── Filtres collés sous le header ── */}
      <View style={styles.toolbar}>
        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>🔎</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher : nom, téléphone, contrat..."
            placeholderTextColor={M.textDim}
            value={query}
            onChangeText={setQuery}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {TYPE_FILTERS.map((chip) => (
            <Chip
              key={chip.value}
              mode={typeFilter === chip.value ? 'flat' : 'outlined'}
              selected={typeFilter === chip.value}
              onPress={() => setTypeFilter(chip.value as any)}
              style={typeFilter === chip.value ? styles.filterChipActive : styles.filterChip}
              textStyle={typeFilter === chip.value ? styles.filterChipTextActive : styles.filterChipText}
            >
              {chip.label} ({countByType(chip.value)})
            </Chip>
          ))}
        </ScrollView>

        {showStatutFilters && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statutRow}>
            {STATUT_FILTERS.map((f) => {
              const count = f.key === 'tous' ? employes.length : countByStatut(f.key);
              const active = statutFilter === f.key;
              return (
                <TouchableOpacity
                  key={f.key}
                  style={[
                    styles.statutChip,
                    active && { backgroundColor: f.bg, borderColor: f.dot },
                  ]}
                  onPress={() => setStatutFilter(f.key)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.statutDot, { backgroundColor: f.dot }]} />
                  <Text style={[styles.statutChipText, active && { color: f.textColor }]}>{f.label}</Text>
                  <Text style={[styles.statutChipCount, active && { color: f.textColor, opacity: 0.7 }]}>{count}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* ─── Contenu scrollable ── */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={M.primary} />}
      >
        {/* Section Employés */}
        {(typeFilter === 'all' || typeFilter === 'employe') && employeResults.length > 0 && (
          <View style={styles.section}>
            {showSections && (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>👤 Employés</Text>
                <Text style={styles.sectionCount}>{employeResults.length}</Text>
              </View>
            )}
            {employeResults.map((item) => (
              <View key={item.id}>{renderEmployeCard(item)}</View>
            ))}
          </View>
        )}

        {/* Section Employeurs */}
        {(typeFilter === 'all' || typeFilter === 'employeur') && employeurResults.length > 0 && (
          <View style={styles.section}>
            {showSections && (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>🏢 Employeurs</Text>
                <Text style={styles.sectionCount}>{employeurResults.length}</Text>
              </View>
            )}
            {employeurResults.map((item) => (
              <View key={item.id}>{renderGenericCard(item)}</View>
            ))}
          </View>
        )}

        {/* Section Contrats */}
        {(typeFilter === 'all' || typeFilter === 'contrat') && contratResults.length > 0 && (
          <View style={styles.section}>
            {showSections && (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>📄 Contrats</Text>
                <Text style={styles.sectionCount}>{contratResults.length}</Text>
              </View>
            )}
            {contratResults.map((item) => (
              <View key={item.id}>{renderGenericCard(item)}</View>
            ))}
          </View>
        )}

        {/* Empty */}
        {filteredResults.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyTitle}>Aucun résultat</Text>
            <Text style={styles.emptyText}>
              {query ? 'Essayez de modifier votre recherche' : 'Appuyez sur + pour inscrire un candidat'}
            </Text>
          </View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* ─── FAB ── */}
      <TouchableOpacity
        style={[styles.fab, { bottom: 24 + insets.bottom }]}
        onPress={() => navigation.navigate('FicheInscriptionModal' as any)}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

function typeLabel(type: ResultType): string {
  switch (type) {
    case 'employe': return 'Employé';
    case 'employeur': return 'Employeur';
    case 'contrat': return 'Contrat';
  }
}

// ─── Styles ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: M.bg },

  // Toolbar collée au header
  toolbar: {
    backgroundColor: M.bgElevated,
    paddingHorizontal: Spacing.lg,
    paddingTop: 4,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: M.borderSoft,
  },

  // Search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: M.border,
    backgroundColor: M.bgCard,
    paddingHorizontal: 14,
    marginBottom: Spacing.sm,
  },
  searchIcon: { fontSize: 18, marginRight: 10 },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: M.text,
    fontFamily: 'Inter',
    paddingVertical: 0,
  },

  // Filtres type
  filterRow: {
    gap: 8,
    paddingBottom: 2,
  },
  filterChip: {
    backgroundColor: M.bgCard,
    borderColor: M.border,
  },
  filterChipActive: {
    backgroundColor: M.primary,
  },
  filterChipText: {
    color: M.textSecondary,
    fontWeight: '600',
    fontSize: 13,
  },
  filterChipTextActive: {
    color: M.textOnPrimary,
    fontWeight: '600',
    fontSize: 13,
  },

  // Filtres statut
  statutRow: {
    gap: 8,
    paddingTop: Spacing.xs,
  },
  statutChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: M.border,
    backgroundColor: M.bgCard,
  },
  statutDot: { width: 8, height: 8, borderRadius: 4 },
  statutChipText: { fontSize: 13, fontWeight: '600', color: M.textMuted },
  statutChipCount: { fontSize: 12, fontWeight: '500', color: M.textDim },

  // Scroll
  scrollView: { flex: 1 },
  scrollContent: {
    padding: Spacing.lg,
  },

  // Sections
  section: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: M.textPrimary,
  },
  sectionCount: {
    fontSize: 13,
    fontWeight: '600',
    color: M.textMuted,
  },

  // Carte employé
  employeCard: {
    backgroundColor: M.bgCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: M.border,
    marginBottom: 12,
    overflow: 'hidden',
  },
  employeCardInner: {
    flexDirection: 'row',
    padding: 16,
    gap: 14,
  },
  avatarWrap: {
    position: 'relative',
    flexShrink: 0,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: M.borderSoft,
  },
  avatarText: { fontSize: 20, fontWeight: '700' },
  statusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2.5,
    borderColor: M.bgCard,
  },
  cardInfo: { flex: 1, minWidth: 0 },
  cardName: { fontSize: 16, fontWeight: '700', color: M.text, marginBottom: 4 },
  cardTags: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 6 },
  tag: { paddingVertical: 2, paddingHorizontal: 10, borderRadius: 8 },
  tagCategory: { backgroundColor: M.primaryDim },
  tagCategoryText: { fontSize: 11, fontWeight: '600', color: M.primary },
  tagStatus: {},
  tagStatusText: { fontSize: 11, fontWeight: '600' },
  cardMeta: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  metaText: { fontSize: 12, color: M.textDim },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: M.borderSoft,
    backgroundColor: M.bgCardAlt,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 12,
  },
  actionBtnPrimary: { backgroundColor: M.success },
  actionBtnSecondary: { backgroundColor: M.borderSoft },
  actionBtnIcon: { fontSize: 14 },
  actionBtnTextPrimary: { fontSize: 13, fontWeight: '700', color: '#fff' },
  actionBtnTextSecondary: { fontSize: 13, fontWeight: '700', color: M.textMuted },

  // Carte générique
  resultCard: {
    backgroundColor: M.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: M.border,
  },
  resultTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  resultIdentity: {
    flexDirection: 'row',
    flex: 1,
  },
  resultAvatar: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  blue: { backgroundColor: M.primaryLight },
  purple: { backgroundColor: '#F3E5F5' },
  orange: { backgroundColor: M.warningLight },
  resultAvatarText: { fontSize: 20, fontWeight: '800' },
  resultInfo: { flex: 1, marginLeft: Spacing.md },
  resultTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: M.textPrimary,
    marginBottom: 4,
  },
  resultMeta: {
    fontSize: 13,
    color: M.textSecondary,
    lineHeight: 18,
  },
  typePill: {
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    marginLeft: Spacing.sm,
  },
  typePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: M.textPrimary,
  },
  detailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: M.borderLight,
  },
  detailPill: {
    backgroundColor: M.background,
    borderRadius: 10,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  detailText: {
    fontSize: 12,
    color: M.textSecondary,
    fontWeight: '500',
  },

  // Empty
  empty: {
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: M.textSecondary,
    marginBottom: Spacing.xs,
  },
  emptyText: {
    fontSize: 13,
    color: M.textTertiary,
    textAlign: 'center',
  },

  // FAB
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: M.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: M.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
  },
  fabText: { fontSize: 28, fontWeight: '300', color: '#fff', marginTop: -2 },
});

const typeStyles: Record<ResultType, any> = {
  employe: { backgroundColor: M.primaryLight },
  employeur: { backgroundColor: '#F3E5F5' },
  contrat: { backgroundColor: M.successLight },
};

const avatarStyles: Record<string, any> = {
  blue: styles.blue,
  purple: styles.purple,
  orange: styles.orange,
};
