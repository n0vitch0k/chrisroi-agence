import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Chip } from 'react-native-paper';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import {
  getJournalPage,
  getCurrentUser,
  getAllUsers,
} from '../database/service';
import { Colors, Spacing, Radius, Shadows } from '../theme';
import AppHeader from '../components/AppHeader';
import MonthCalendar from '../components/MonthCalendar';

const M = Colors;

const ACTION_ICONS: Record<string, string> = {
  creation_fiche: 'account-plus',
  modification_fiche: 'account-edit',
  modification_champ: 'pencil',
  suppression_fiche: 'account-remove',
  creation_contrat: 'file-document-plus',
  modification_contrat: 'file-document-edit',
  suppression_contrat: 'file-document-remove',
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
  suppression_contrat: M.danger,
  contrat_termine: M.warning,
  commission_payee: M.success,
  creation_employeur: M.success,
  modification_employeur: M.info,
  suppression_employeur: M.danger,
  creation_utilisateur: M.info,
  connexion: M.primary,
};

const ACTION_LABELS: Record<string, string> = {
  creation_fiche: 'Création fiche',
  modification_fiche: 'Modification fiche',
  modification_champ: 'Modification champ',
  suppression_fiche: 'Suppression fiche',
  creation_contrat: 'Création contrat',
  modification_contrat: 'Modification contrat',
  suppression_contrat: 'Suppression contrat',
  contrat_termine: 'Contrat terminé',
  commission_payee: 'Commission payée',
  creation_employeur: 'Création employeur',
  modification_employeur: 'Modification employeur',
  suppression_employeur: 'Suppression employeur',
  creation_utilisateur: 'Création utilisateur',
  connexion: 'Connexion',
};

const FAMILY_TYPES: Record<string, string[]> = {
  fiche: ['creation_fiche', 'modification_fiche', 'modification_champ', 'suppression_fiche'],
  contrat: ['creation_contrat', 'modification_contrat', 'suppression_contrat', 'contrat_termine', 'commission_payee'],
  employeur: ['creation_employeur', 'modification_employeur', 'suppression_employeur'],
  compte: ['creation_utilisateur'],
  connexion: ['connexion'],
};

const FAMILY_LABELS: Record<string, string> = {
  fiche: 'Fiches',
  contrat: 'Contrats',
  employeur: 'Employeurs',
  compte: 'Comptes',
  connexion: 'Connexions',
};

const SUPPRESSION_TYPES = ['suppression_fiche', 'suppression_employeur', 'suppression_contrat'];

function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

function formatRelative(dateStr: string): string {
  const date = parseDate(dateStr);
  if (!date) return '-';
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'À l’instant';
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

function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shiftDay(day: string, delta: number): string {
  const [y, m, dd] = day.split('-').map(Number);
  const d = new Date(y, m - 1, dd);
  d.setDate(d.getDate() + delta);
  return isoDay(d);
}

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
  if (day === today) return 'Aujourd’hui';
  if (day === shiftDay(today, -1)) return 'Hier';
  const [y, m, dd] = day.split('-').map(Number);
  return new Date(y, m - 1, dd).toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
}

type ChangeItem = { field: string; oldValue: any; newValue: any };

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

function openState(action: any): 'open' | 'deleted' | 'none' {
  if (!action?.entite_id) return 'none';
  if (SUPPRESSION_TYPES.includes(action.action_type)) return 'deleted';
  return targetScreen(action.entite_type) ? 'open' : 'none';
}

function initials(display: string): string {
  const parts = (display || '').trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function JournalScreen() {
  const navigation = useNavigation<any>();

  const [actions, setActions] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [day, setDay] = useState<string | null>(null);
  const [periodFilter, setPeriodFilter] = useState<'day' | '7' | '30' | 'all'>('day');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [familyFilter, setFamilyFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [showCalendar, setShowCalendar] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [totalItems, setTotalItems] = useState(0);
  const [suite, setSuite] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);

  const [users, setUsers] = useState<{ id: string; label: string }[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  const pageRef = useRef(1);
  const isRefreshingRef = useRef(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cu0 = getCurrentUser();
  useEffect(() => {
    setIsAdmin(cu0?.role === 'admin');
  }, [cu0?.role]);

  useEffect(() => {
    if (!isAdmin) return;
    let mounted = true;
    getAllUsers()
      .then((list) => {
        if (!mounted) return;
        if (list && list.length) {
          setUsers(
            list.map((x: any) => ({
              id: x.id,
              label: `${x.prenom || ''} ${x.nom || ''}`.trim() || x.email || x.id,
            })),
          );
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [isAdmin]);

  const loadActions = useCallback(
    async (reset: boolean) => {
      const cu = getCurrentUser();
      const admin = cu?.role === 'admin';
      const filters: any = {};
      if (!admin && cu) {
        filters.userId = cu.id;
      } else if (admin && userFilter !== 'all') {
        filters.userId = userFilter;
      }
      if (typeFilter !== 'all') {
        filters.actionType = typeFilter;
      } else if (familyFilter !== 'all' && FAMILY_TYPES[familyFilter]) {
        filters.actionTypes = FAMILY_TYPES[familyFilter];
      }
      if (searchQuery.trim()) filters.search = searchQuery.trim();

      if (periodFilter === 'day') {
        const d = day || isoDay(new Date());
        const r = dayRange(d);
        filters.dateDebut = r.dateDebut;
        filters.dateFin = r.dateFin;
      } else if (periodFilter === '7' || periodFilter === '30') {
        const n = periodFilter === '7' ? 7 : 30;
        const from = new Date();
        from.setDate(from.getDate() - n);
        filters.dateDebut = pbDateTime(from);
        filters.dateFin = pbDateTime(new Date());
      }

      if (reset) pageRef.current = 1;
      else pageRef.current += 1;

      const showSpinner = reset && !isRefreshingRef.current;
      if (showSpinner) setLoading(true);
      try {
        const res = await getJournalPage(filters, pageRef.current, 40);
        if (reset) setActions(res.items);
        else setActions((prev) => [...prev, ...res.items]);
        setTotalItems(res.totalItems);
        setSuite(res.suite);
        setExpanded(null);
      } catch (err) {
        console.error('[Journal] Erreur chargement:', err);
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    [day, periodFilter, userFilter, familyFilter, typeFilter, searchQuery],
  );

  const derivedUsers = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of actions) {
      if (a.user_id && !map.has(a.user_id)) {
        map.set(a.user_id, a.user_display || a.user_id);
      }
    }
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [actions]);

  const userList = users.length ? users : derivedUsers;

  useEffect(() => {
    loadActions(true);
  }, [day, periodFilter, userFilter, familyFilter, typeFilter]);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      loadActions(true);
    }, 400);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery]);

  useFocusEffect(
    useCallback(() => {
      loadActions(true);
      return () => {};
    }, [loadActions]),
  );

  const onRefresh = () => {
    isRefreshingRef.current = true;
    setRefreshing(true);
    loadActions(true).finally(() => {
      setRefreshing(false);
      isRefreshingRef.current = false;
    });
  };

  const onLoadMore = () => {
    if (suite <= 0 || loadingMore) return;
    setLoadingMore(true);
    loadActions(false).finally(() => setLoadingMore(false));
  };

  const openEntity = (action: any) => {
    const screen = targetScreen(action.entite_type);
    if (!screen || openState(action) !== 'open') return;
    navigation.navigate('DetailModal', {
      screen,
      params: { id: action.entite_id },
    });
  };

  const grouped = useMemo(() => {
    const acc: Record<string, any[]> = {};
    for (const action of actions) {
      const date = parseDate(action.created);
      const key = date
        ? date.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: '2-digit' })
        : 'Sans date';
      if (!acc[key]) acc[key] = [];
      acc[key].push(action);
    }
    return acc;
  }, [actions]);

  const openCalendar = () => setShowCalendar(true);
  const closeCalendar = () => setShowCalendar(false);

  const onCalendarSelect = (d: string) => {
    if (!d) {
      setDay(null);
      setPeriodFilter('all');
    } else {
      setDay(d);
      setPeriodFilter('day');
    }
    setShowCalendar(false);
  };

  const onPeriodChange = (p: 'day' | '7' | '30' | 'all') => {
    setPeriodFilter(p);
    if (p !== 'day') setDay(null);
  };

  const onPrevDay = () => {
    if (!day) return;
    setDay(shiftDay(day, -1));
    setPeriodFilter('day');
  };

  const onNextDay = () => {
    if (!day || day === isoDay(new Date())) return;
    setDay(shiftDay(day, 1));
    setPeriodFilter('day');
  };

  const onAllDates = () => {
    setDay(null);
    setPeriodFilter('all');
  };

  const activeFilterCount =
    (day ? 1 : periodFilter !== 'day' ? 1 : 0) +
    (userFilter !== 'all' ? 1 : 0) +
    (familyFilter !== 'all' ? 1 : 0) +
    (typeFilter !== 'all' ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0);

  const clearDay = () => {
    setDay(null);
    setPeriodFilter('day');
  };
  const clearPeriod = () => {
    setPeriodFilter('day');
    setDay(null);
  };
  const clearUser = () => setUserFilter('all');
  const clearFamily = () => setFamilyFilter('all');
  const clearType = () => setTypeFilter('all');
  const clearSearch = () => setSearchQuery('');

  return (
    <View style={styles.container}>
      <AppHeader
        title="Journal des actions"
        subtitle="Historique des opérations de l'agence"
        showBack
        onBack={() => navigation.goBack()}
        right={
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{totalItems || actions.length}</Text>
          </View>
        }
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={M.primary} />
        }
        keyboardShouldPersistTaps="handled"
      >
        {/* Recherche + bouton filtres */}
        <View style={styles.searchBar}>
          <View style={styles.searchBox}>
            <Icon name="magnify" size={18} color={M.textTertiary} style={styles.searchIcon} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Rechercher dans le journal…"
              placeholderTextColor={M.textTertiary}
              style={styles.searchInput}
              returnKeyType="search"
            />
          </View>
          <TouchableOpacity
            style={[styles.filterBtn, filtersOpen && styles.filterBtnActive]}
            onPress={() => setFiltersOpen((v) => !v)}
            activeOpacity={0.8}
          >
            <Icon
              name="filter-variant"
              size={18}
              color={filtersOpen ? '#fff' : M.textSecondary}
            />
            <Text style={[styles.filterBtnText, filtersOpen && styles.filterBtnTextActive]}>
              Filtres
            </Text>
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Chips des filtres actifs (supprimables) */}
        {activeFilterCount > 0 && (
          <View style={styles.activeFilters}>
            {day && (
              <TouchableOpacity style={styles.afChip} onPress={clearDay} activeOpacity={0.7}>
                <Text style={styles.afChipText}>📅 {dayLabel(day)}</Text>
                <Text style={styles.afChipX}>×</Text>
              </TouchableOpacity>
            )}
            {!day && periodFilter !== 'day' && (
              <TouchableOpacity style={styles.afChip} onPress={clearPeriod} activeOpacity={0.7}>
                <Text style={styles.afChipText}>
                  Période : {periodFilter === '7' ? '7 jours' : periodFilter === '30' ? '30 jours' : 'Toutes dates'}
                </Text>
                <Text style={styles.afChipX}>×</Text>
              </TouchableOpacity>
            )}
            {userFilter !== 'all' && (
              <TouchableOpacity style={styles.afChip} onPress={clearUser} activeOpacity={0.7}>
                <Text style={styles.afChipText}>
                  👤 {userFilter.split(' ').slice(1).join(' ') || userFilter}
                </Text>
                <Text style={styles.afChipX}>×</Text>
              </TouchableOpacity>
            )}
            {familyFilter !== 'all' && (
              <TouchableOpacity style={styles.afChip} onPress={clearFamily} activeOpacity={0.7}>
                <Text style={styles.afChipText}>{FAMILY_LABELS[familyFilter] || familyFilter}</Text>
                <Text style={styles.afChipX}>×</Text>
              </TouchableOpacity>
            )}
            {typeFilter !== 'all' && (
              <TouchableOpacity style={styles.afChip} onPress={clearType} activeOpacity={0.7}>
                <Text style={styles.afChipText}>{ACTION_LABELS[typeFilter] || typeFilter}</Text>
                <Text style={styles.afChipX}>×</Text>
              </TouchableOpacity>
            )}
            {searchQuery.trim() !== '' && (
              <TouchableOpacity style={styles.afChip} onPress={clearSearch} activeOpacity={0.7}>
                <Text style={styles.afChipText}>🔎 {searchQuery.trim()}</Text>
                <Text style={styles.afChipX}>×</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Barre de date */}
        <View style={styles.dateBar}>
          <TouchableOpacity
            onPress={onPrevDay}
            disabled={!day}
            style={styles.dateArrow}
            activeOpacity={0.7}
          >
            <Icon name="chevron-left" size={24} color={day ? M.primary : M.textTertiary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={openCalendar} style={styles.dateLabelWrap} activeOpacity={0.7}>
            <Text style={styles.dateLabel}>
              {day ? dayLabel(day) : periodFilter === 'all' ? 'Toutes dates' : 'Période'}
            </Text>
            <Text style={styles.dateHint}>Toucher pour choisir une date</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onNextDay}
            disabled={!day || day === isoDay(new Date())}
            style={styles.dateArrow}
            activeOpacity={0.7}
          >
            <Icon
              name="chevron-right"
              size={24}
              color={day && day !== isoDay(new Date()) ? M.primary : M.textTertiary}
            />
          </TouchableOpacity>
          <Chip
            mode={day === null && periodFilter === 'all' ? 'flat' : 'outlined'}
            selected={day === null && periodFilter === 'all'}
            onPress={onAllDates}
            style={day === null && periodFilter === 'all' ? styles.chipActive : styles.chip}
          >
            Tout
          </Chip>
        </View>

        {/* Utilisateur intervenu (admin uniquement) */}
        {isAdmin && (
          <View style={styles.userSection}>
            <Text style={styles.sectionLabel}>Utilisateur intervenu</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.userRow}
              contentContainerStyle={{ gap: Spacing.xs }}
            >
              <TouchableOpacity
                style={[styles.uChip, userFilter === 'all' && styles.uChipActive]}
                onPress={() => setUserFilter('all')}
                activeOpacity={0.7}
              >
                <Text style={[styles.uChipText, userFilter === 'all' && styles.uChipTextActive]}>
                  Tous les agents
                </Text>
              </TouchableOpacity>
              {userList.map((u2) => (
                <TouchableOpacity
                  key={u2.id}
                  style={[styles.uChip, userFilter === u2.id && styles.uChipActive]}
                  onPress={() => setUserFilter(u2.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.uAvatar, userFilter === u2.id && styles.uAvatarActive]}>
                    <Text style={[styles.uAvatarText, userFilter === u2.id && styles.uAvatarTextActive]}>
                      {initials(u2.label)}
                    </Text>
                  </View>
                  <Text style={[styles.uChipText, userFilter === u2.id && styles.uChipTextActive]}>
                    {u2.label.split(' ')[0]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Panneau de filtres dépliable */}
        {filtersOpen && (
          <View style={styles.filterPanel}>
            <View style={styles.filterGroup}>
              <Text style={styles.filterGroupLabel}>Période</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterRow}
                contentContainerStyle={{ gap: Spacing.xs }}
              >
                {(['day', '7', '30', 'all'] as const).map((p) => (
                  <Chip
                    key={p}
                    mode={periodFilter === p ? 'flat' : 'outlined'}
                    selected={periodFilter === p}
                    onPress={() => onPeriodChange(p)}
                    style={periodFilter === p ? styles.chipActive : styles.chip}
                  >
                    {p === 'day' ? 'Jour choisi' : p === '7' ? '7 jours' : p === '30' ? '30 jours' : 'Tout'}
                  </Chip>
                ))}
              </ScrollView>
            </View>

            <View style={styles.filterGroup}>
              <Text style={styles.filterGroupLabel}>Famille</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterRow}
                contentContainerStyle={{ gap: Spacing.xs }}
              >
                <Chip
                  mode={familyFilter === 'all' ? 'flat' : 'outlined'}
                  selected={familyFilter === 'all'}
                  onPress={() => setFamilyFilter('all')}
                  style={familyFilter === 'all' ? styles.chipActive : styles.chip}
                >
                  Tout
                </Chip>
                {Object.keys(FAMILY_LABELS).map((fam) => (
                  <Chip
                    key={fam}
                    mode={familyFilter === fam ? 'flat' : 'outlined'}
                    selected={familyFilter === fam}
                    onPress={() => setFamilyFilter(fam)}
                    style={familyFilter === fam ? styles.chipActive : styles.chip}
                  >
                    {FAMILY_LABELS[fam]}
                  </Chip>
                ))}
              </ScrollView>
            </View>

            <View style={styles.filterGroup}>
              <Text style={styles.filterGroupLabel}>Type d'action</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterRow}
                contentContainerStyle={{ gap: Spacing.xs }}
              >
                <Chip
                  mode={typeFilter === 'all' ? 'flat' : 'outlined'}
                  selected={typeFilter === 'all'}
                  onPress={() => setTypeFilter('all')}
                  style={typeFilter === 'all' ? styles.chipActive : styles.chip}
                >
                  Tout
                </Chip>
                {Object.keys(ACTION_LABELS).map((t) => (
                  <Chip
                    key={t}
                    mode={typeFilter === t ? 'flat' : 'outlined'}
                    selected={typeFilter === t}
                    onPress={() => setTypeFilter(t)}
                    style={typeFilter === t ? styles.chipActive : styles.chip}
                  >
                    {ACTION_LABELS[t]}
                  </Chip>
                ))}
              </ScrollView>
            </View>
          </View>
        )}

        {/* Zone de contenu : spinner OU liste (tout défile ensemble) */}
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={M.primary} />
            <Text style={styles.loadingText}>Chargement du journal…</Text>
          </View>
        ) : actions.length === 0 ? (
          <View style={styles.empty}>
            <Icon name="text-box-outline" size={64} color={M.textTertiary} />
            <Text style={styles.emptyTitle}>Aucune action</Text>
            <Text style={styles.emptySub}>Les actions apparaîtront ici au fil de l'activité.</Text>
          </View>
        ) : (
          <View style={styles.listWrap}>
            {Object.entries(grouped).map(([dayKey, items]) => (
              <View key={dayKey} style={styles.dayGroup}>
                <Text style={styles.dayHeader}>{dayKey}</Text>
                {(items as any[]).map((action: any) => (
                  <TouchableOpacity
                    key={action.id}
                    style={[styles.actionCard, expanded === action.id && styles.actionCardExpanded]}
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
                        <Text style={styles.actionDescription}>
                          {ACTION_LABELS[action.action_type] || action.action_type} —{' '}
                          {String(action.description || '').split('—')[1]?.trim() || action.description}
                        </Text>
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
                        <Text style={styles.actionDetailText}>Par : {action.user_display}</Text>
                        <Text style={styles.actionDetailText}>{formatAbsolute(action.created)}</Text>
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
            ))}

            {/* Charger plus */}
            <View style={styles.loadMore}>
              <TouchableOpacity
                style={styles.loadMoreBtn}
                onPress={onLoadMore}
                disabled={suite <= 0 || loadingMore}
                activeOpacity={0.85}
              >
                {loadingMore ? (
                  <ActivityIndicator size="small" color={M.primary} />
                ) : null}
                <Text style={styles.loadMoreText}>
                  {loadingMore ? 'Chargement…' : suite > 0 ? 'Charger plus' : 'Fin de la liste'}
                </Text>
              </TouchableOpacity>
              <Text style={styles.loadInfo}>
                {actions.length} sur {totalItems || '—'} enregistrements
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      <MonthCalendar
        visible={showCalendar}
        value={day}
        onSelect={onCalendarSelect}
        onClose={closeCalendar}
        titre="Choisir une date"
      />
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
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: Spacing.xxl, width: '100%', maxWidth: 1100, alignSelf: 'center' },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: M.surface,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.sm,
    borderWidth: 1.5,
    borderColor: M.border,
  },
  searchIcon: { marginRight: Spacing.xs },
  searchInput: { flex: 1, fontSize: 14, color: M.textPrimary, paddingVertical: 10 },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: Radius.lg,
    backgroundColor: M.surface,
    borderWidth: 1.5,
    borderColor: M.border,
    position: 'relative',
  },
  filterBtnActive: { backgroundColor: M.primary, borderColor: M.primary },
  filterBtnText: { fontSize: 13, fontWeight: '700', color: M.textSecondary },
  filterBtnTextActive: { color: '#fff' },
  filterBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: M.danger,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: M.bg,
  },
  filterBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  activeFilters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  afChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    backgroundColor: M.primaryDim,
    borderWidth: 1,
    borderColor: M.primaryFaded,
  },
  afChipText: { fontSize: 11, fontWeight: '700', color: M.primaryDark },
  afChipX: { fontSize: 13, color: M.primaryDark, opacity: 0.7 },

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
  chip: { marginRight: Spacing.xs, backgroundColor: M.surface },
  chipActive: { marginRight: Spacing.xs, backgroundColor: M.primary },

  userSection: { marginHorizontal: Spacing.lg, marginTop: Spacing.md },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: M.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  userRow: { flexDirection: 'row', gap: Spacing.xs },
  uChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: M.surface,
    borderWidth: 1.5,
    borderColor: M.border,
    marginRight: Spacing.xs,
  },
  uChipActive: { backgroundColor: M.primary, borderColor: M.primary },
  uAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: M.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uAvatarActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  uAvatarText: { fontSize: 9, fontWeight: '800', color: M.primaryDark },
  uAvatarTextActive: { color: '#fff' },
  uChipText: { fontSize: 12, fontWeight: '600', color: M.textSecondary },
  uChipTextActive: { color: '#fff' },

  filterPanel: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    backgroundColor: M.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    ...Shadows.soft,
  },
  filterGroup: { marginBottom: Spacing.sm },
  filterGroupLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: M.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  filterRow: { flexDirection: 'row', gap: Spacing.xs },

  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: Spacing.md,
  },
  loadingText: { fontSize: 14, fontWeight: '600', color: M.textSecondary },

  listWrap: {},
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
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  actionCardExpanded: { borderColor: M.primaryDim },
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

  loadMore: { alignItems: 'center', paddingVertical: Spacing.md },
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: M.primaryDim,
  },
  loadMoreText: { fontSize: 13, fontWeight: '700', color: M.primary },
  loadInfo: { fontSize: 11, color: M.textTertiary, marginTop: Spacing.xs },
});
