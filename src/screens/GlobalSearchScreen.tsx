import React, { useState, useCallback, useMemo } from 'react';
import type { GlobalNavigationProp } from '../types/navigation';

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Image,
  useWindowDimensions,
} from 'react-native';
import { Chip } from 'react-native-paper';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import {
  getAllEmployes,
  getAllEmployeurs,
  getAllContrats,
  getEmployePhotoUrl,
} from '../database/service';
import {
  getCategorieLabel,
  getStatutColor,
  getStatutLabel,
  getFormatContratLabel,
  getFormatContratColors,
  daysRemaining,
  formatMoney,
} from '../utils/constants';
import AppHeader from '../components/AppHeader';
import { DocumentViewerOverlay, useDocumentViewer } from '../components/DocumentViewer';
import { Colors, Spacing, Radius, Shadows } from '../theme';
import SafeButton from '../components/SafeButton';

// ─── Alias thème central ────────────────────────────────────
const M = { ...Colors, shadow: Shadows.card.shadowColor } as const;

type ResultType = 'employe' | 'employeur' | 'contrat';
type StatutFilter = 'tous' | 'disponible' | 'en_poste';

/**
 * Section par défaut à afficher. Piloté par la navbar :
 *   - onglet "Dossiers"    → 'all'        (toutes les sections)
 *   - onglet "Employeurs"  → 'employeur'  (section Employeurs)
 *   - onglet "Contrats"    → 'contrat'    (les deux formats de contrats)
 * Filtres principaux (5) : Tout / Employés / Employeurs / Prestation / Agence.
 */
type DossierSection = 'all' | ResultType | 'prestation' | 'agence';

// Paramètres reçus depuis la navbar (App.tsx → initialParams).
type GlobalSearchRouteParams = {
  section?: DossierSection;
};

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
  photoUrl?: string | null;
  photoFileName?: string | null;
  telephone?: string;
  lieu_residence?: string;
  categorie?: string;
  statut?: string;
  isEnPoste?: boolean;
  format?: string;
  /** Texte de recherche pré-concaténé en minuscules (filtre client, sans réseau). */
  search?: string;
};

/**
 * Ligne de la liste virtualisée : soit un en-tête de section, soit une rangée
 * de 1 ou 2 cartes. Aplatir sections + cartes en lignes permet d'utiliser un
 * simple FlatList (SectionList n'accepte pas numColumns) tout en gardant les
 * en-têtes pleine largeur et la grille 2 colonnes du grand écran.
 */
type DossierRow =
  | { kind: 'header'; key: string; title: string; count: number }
  | { kind: 'cards'; key: string; items: SearchResult[]; card: 'employe' | 'generic' };

// ─── Filtres statut ─────────────────────────────────────────
const STATUT_FILTERS: { key: StatutFilter; label: string; dot: string; dotBg: string; textColor: string; bg: string }[] = [
  { key: 'tous', label: 'Tous', dot: M.primary, dotBg: M.primaryDim, textColor: M.primary, bg: M.primaryDim },
  { key: 'disponible', label: 'Disponibles', dot: M.success, dotBg: M.successDim, textColor: M.success, bg: M.successDim },
  { key: 'en_poste', label: 'En poste', dot: M.info, dotBg: M.infoDim, textColor: M.info, bg: M.infoDim },
];

const TYPE_FILTERS: Array<{ label: string; value: DossierSection }> = [
  { label: 'Tout', value: 'all' },
  { label: 'Employés', value: 'employe' },
  { label: 'Employeurs', value: 'employeur' },
  { label: 'Prestation', value: 'prestation' },
  { label: 'Agence', value: 'agence' },
];

// Avatar carte employé : photo serveur si dispo (clic → plein écran),
// initiales sinon. Miroir EmployeAvatar de l'écran détail, format carré 56.
function SearchAvatar({
  photoUrl,
  initials,
  statusColor,
  backgroundColor,
  onPress,
}: {
  photoUrl?: string | null;
  initials?: string;
  statusColor: string;
  backgroundColor: string;
  onPress?: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  if (photoUrl && !imgError) {
    return (
      <TouchableOpacity
        style={[styles.avatar, { backgroundColor }]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <Image
          source={{ uri: photoUrl }}
          style={{ width: 52, height: 52, borderRadius: 16 }}
          onError={() => setImgError(true)}
        />
      </TouchableOpacity>
    );
  }
  return (
    <View style={[styles.avatar, { backgroundColor }]}>
      <Text style={[styles.avatarText, { color: statusColor }]}>{initials}</Text>
    </View>
  );
}

export default function GlobalSearchScreen() {
  const navigation = useNavigation<GlobalNavigationProp>();
  const route = useRoute<RouteProp<any, any>>();

  // Section demandée par la navbar. Lue au mount et à chaque focus
  // (pour qu'un clic sur l'onglet "Employeurs" puis "Dossiers" soit pris
  // en compte sans devoir recharger l'app).
  const requestedSection = (route.params?.section as DossierSection) || 'all';

  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<DossierSection>(requestedSection);
  const [statutFilter, setStatutFilter] = useState<StatutFilter>('tous');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [employes, setEmployes] = useState<any[]>([]);
  // Chromebook/large : cartes en groupe centré de 2 colonnes
  const { width } = useWindowDimensions();
  const wide = width >= 900;

  // Sync le typeFilter quand la navbar change la section. Unique useFocusEffect :
  // avant il y en avait DEUX qui appelaient chacun loadResults(), donc chaque
  // focus d'onglet déclenchait 2 rechargements (6 requêtes) pour rien. Le
  // rechargement est fait plus bas, par un seul effet dépendant de la section.

  // ─── Chargement des données ───────────────────────────────
  // PERF (05/10) : `query` était dans les dépendances de ce useCallback,
  // ce qui re-déclenchait le rechargement À CHAQUE FRAPPE — 3 requêtes et
  // 91 ko retéléchargés par caractère saisi, alors que la recherche est
  // 100 % côté client (le filtre est appliqué en mémoire plus bas).
  // Ici on charge les données UNE FOIS ; `query` n'intervient plus.
  const loadResults = useCallback(async () => {
    try {
      const [employesData, employeursData, contratsData] = await Promise.all([
        getAllEmployes(),
        getAllEmployeurs(),
        getAllContrats(),
      ]);
      setEmployes(employesData || []);
      const next: SearchResult[] = [];

      (employesData || []).forEach((item: any) => {
        // `search` est stocké en minuscules : la recherche se fait ensuite par
        // simple `.includes()` en mémoire (useMemo), sans rechargement réseau.
        const search = [item.nom, item.prenom, item.telephone, getCategorieLabel(item.categorie_emploi)]
          .filter(Boolean).join(' ').toLowerCase();
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
          photoUrl: getEmployePhotoUrl(item.id, item.photo),
          photoFileName: item.photo || null,
          telephone: item.telephone,
          lieu_residence: item.lieu_residence,
          categorie: getCategorieLabel(item.categorie_emploi),
          statut: item.statut,
          isEnPoste,
          search,
        });
      });

      (employeursData || []).forEach((item: any) => {
        const search = [item.nom_complet, item.nom_contact, item.prenom_contact, item.telephone, item.type_besoin]
          .filter(Boolean).join(' ').toLowerCase();
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
          // Ouvre la fiche détail employeur (lecture), comme EmployeDetail côté employé.
          onPress: () => navigation.navigate('EmployesStack' as any, { screen: 'EmployeurDetail', params: { id: item.id } }),
          search,
        });
      });

      (contratsData || []).forEach((item: any) => {
        const remaining = daysRemaining(item.date_fin);
        const search = [item.numero_dossier, item.employe_nom, item.employe_prenom, item.nom_complet, item.poste]
          .filter(Boolean).join(' ').toLowerCase();
        next.push({
          id: `contrat-${item.id}`,
          type: 'contrat',
          format: item.format_document || 'prestation',
          title: item.numero_dossier || `Contrat ${item.id}`,
          meta: `${item.employe_nom} ${item.employe_prenom} · ${item.nom_complet}`,
          details: [
            remaining !== null ? `📅 Fin dans ${remaining}j` : '📅 En cours',
            item.commission_agence > 0 ? `💰 ${formatMoney(item.commission_agence)}` : '',
            item.statut === 'en_cours' && remaining !== null && remaining <= 7 ? '⚠️ Urgent' : '',
          ].filter(Boolean),
          icon: (item.format_document || 'prestation') === 'agence' ? '📋' : '📄',
          avatarStyle: 'orange',
          onPress: () => navigation.navigate('EmployesStack' as any, { screen: 'ContratDetail', params: { id: item.id } }),
          search,
        });
      });

      setResults(next);
    } catch (error) {
      console.error('Error loading global search:', error);
    } finally {
      setRefreshing(false);
    }
  }, [navigation]);

  useFocusEffect(useCallback(() => {
    // Un seul point d'entrée au focus : on synchronise la section demandée
    // par la navbar PUIS on charge une seule fois.
    const sec = (route.params?.section as DossierSection) || 'all';
    setTypeFilter(sec);
    setRefreshing(true);
    loadResults();
  }, [loadResults, route.params?.section]));

  const onRefresh = () => { setRefreshing(true); loadResults(); };

  // ─── Filtrage ─────────────────────────────────────────────
  // PERF (05/10) : la recherche textuelle se fait ICI, en mémoire, et plus
  // dans loadResults. Conséquence : taper dans la barre de recherche ne
  // déclenche plus aucune requête (avant : 3 requêtes + 91 ko par caractère).
  // Le filtre est strictement identique (mêmes champs, même `.includes` sur la
  // même chaîne en minuscules) — seul le moment du filtrage change.
  //
  // searchResults = résultats de la recherche texte seule (c'est CE que les
  // compteurs des puces affichaient avant, via `results` déjà filtré).
  const searchResults = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized
      ? results.filter((item) => (item.search || '').includes(normalized))
      : results;
  }, [results, query]);

  const filteredResults = useMemo(() => {
    let items = searchResults;
    if (typeFilter === 'prestation' || typeFilter === 'agence') {
      items = items.filter((item) => item.type === 'contrat' && (item.format || 'prestation') === typeFilter);
    } else if (typeFilter !== 'all') {
      items = items.filter((item) => item.type === typeFilter);
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
  }, [searchResults, typeFilter, statutFilter]);

  // Comptages — mémoïsés : ils étaient recalculés à chaque rendu (3 `.filter`
  // par puce, 5 puces). Bases inchangées : `searchResults` pour les types
  // (équivalent de l'ancien `results` déjà filtré par la recherche), et la
  // liste `employes` complète pour les statuts.
  const countByType = useMemo(() => {
    const cache: Record<string, number> = {
      all: searchResults.length,
      prestation: searchResults.filter((i) => i.type === 'contrat' && (i.format || 'prestation') === 'prestation').length,
      agence: searchResults.filter((i) => i.type === 'contrat' && (i.format || 'prestation') === 'agence').length,
    };
    return (type: string) =>
      cache[type] !== undefined
        ? cache[type]
        : searchResults.filter((i) => i.type === type).length;
  }, [searchResults]);

  const countByStatut = useMemo(() => {
    const enPoste = employes.filter((e) => e.statut === 'en_poste').length;
    return (s: string) => (s === 'en_poste' ? enPoste : employes.length - enPoste);
  }, [employes]);

  // ─── Rendu carte employé ──────────────────────────────────
  // Avatar carte employé : photo serveur si dispo, initiales sinon
  // (miroir EmployeAvatar de l'écran détail, adapté au format carré 56).
  const photoViewer = useDocumentViewer();
  const openPhoto = (item: SearchResult) => {
    if (!item.photoUrl) return;
    photoViewer.open({
      uri: item.photoUrl,
      label: `${item.prenom || ''} ${item.nom || ''}`.trim() || 'Photo',
      fileName: item.photoFileName || null,
      mimeType: 'image/jpeg',
    });
  };
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
            <SearchAvatar photoUrl={item.photoUrl} initials={item.initials} statusColor={statusColor} backgroundColor={avatarBg} onPress={() => openPhoto(item)} />
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
                onPress={() => navigation.navigate('ContratDocumentModal' as any, { employe_id: item.id?.replace('employe-', '') })}
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
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={[styles.typePill, typeStyles[item.type]]}>
            <Text style={styles.typePillText}>{typeLabel(item.type)}</Text>
          </View>
          {item.type === 'contrat' && (
            <View style={[styles.typePill, { backgroundColor: getFormatContratColors(item.format).bg, marginLeft: 6 }]}>
              <Text style={[styles.typePillText, { color: getFormatContratColors(item.format).fg }]}>{getFormatContratLabel(item.format)}</Text>
            </View>
          )}
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
  const employeResults = useMemo(() => filteredResults.filter((i) => i.type === 'employe'), [filteredResults]);
  const employeurResults = useMemo(() => filteredResults.filter((i) => i.type === 'employeur'), [filteredResults]);
  const contratResults = useMemo(() => filteredResults.filter((i) => i.type === 'contrat'), [filteredResults]);
  const showContratSection = typeFilter === 'all' || typeFilter === 'contrat' || typeFilter === 'prestation' || typeFilter === 'agence';
  const contratSectionTitle = typeFilter === 'prestation' ? '📄 Contrats Prestation' : typeFilter === 'agence' ? '📋 Contrats Agence' : '📄 Contrats';
  const showStatutFilters = typeFilter === 'employe' || typeFilter === 'all';
  const showSections = typeFilter === 'all';

  // ─── Rangées virtualisées ──────────────────────────────────
  // PERF (05/10) : le contenu était un ScrollView qui montait TOUTES les
  // cartes d'un coup (41 employés + 28 employeurs + 22 contrats = 91 cartes,
  // chacune avec son Image) → travail de layout/mémoire au scroll, surtout
  // sur appareil d'entrée de gamme.
  //
  // On aplatit en RANGÉES : un en-tête de section (pleine largeur) puis les
  // cartes, groupées par 2 sur grand écran (Chromebook) comme le faisait le
  // `flexWrap` d'origine. FlatList virtualise ensuite rangée par rangée.
  //
  // Pourquoi des rangées et pas `numColumns` sur la liste : `numColumns`
  // n'existe pas sur SectionList, et l'aplatir en rangées nous laisse garder
  // les DEUX affichages d'origine — en-têtes pleine largeur ET grille 2
  // colonnes — sans sacrifier la virtualisation.
  //
  // `card` est stocké comme type ('employe' | 'generic') et non comme
  // fonction : les renderers sont recréés à chaque rendu (ils capturent
  // `photoViewer`/`wide`), les garder dans les dépendances du useMemo
  // invaliderait le cache à chaque fois.
  const rows = useMemo<DossierRow[]>(() => {
    const perRow = wide ? 2 : 1;
    const out: DossierRow[] = [];

    const pushSection = (
      key: string,
      title: string | null,
      data: SearchResult[],
      card: 'employe' | 'generic',
    ) => {
      if (data.length === 0) return;
      if (title) out.push({ kind: 'header', key: `${key}-h`, title, count: data.length });
      for (let i = 0; i < data.length; i += perRow) {
        out.push({ kind: 'cards', key: `${key}-${i}`, items: data.slice(i, i + perRow), card });
      }
    };

    if (typeFilter === 'all' || typeFilter === 'employe') {
      pushSection('emp', showSections ? '👤 Employés' : null, employeResults, 'employe');
    }
    if (typeFilter === 'all' || typeFilter === 'employeur') {
      pushSection('emp2', showSections ? '🏢 Employeurs' : null, employeurResults, 'generic');
    }
    if (showContratSection) {
      pushSection('ctr', showSections ? contratSectionTitle : null, contratResults, 'generic');
    }
    return out;
  }, [
    wide,
    typeFilter,
    showSections,
    showContratSection,
    contratSectionTitle,
    employeResults,
    employeurResults,
    contratResults,
  ]);

  return (
    <View style={styles.container}>
      {/* Racine d'onglet : jamais de back (AppHeader masque la flèche quand il n'y a rien à dépiler). */}
      <AppHeader title="Dossiers" showBack />

      {/* ─── Filtres collés sous le header ── */}
      <View style={styles.toolbar}>
      <View style={styles.toolbarInner}>
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
      </View>

      {/* ─── Contenu scrollable (virtualisé) ── */}
            <FlatList
              data={rows}
              keyExtractor={(row) => row.key}
              // Virtualisation : seules les rangées visibles sont montées. Les
              // photos (Image) sont le coût dominant, d'où un windowSize serré.
              initialNumToRender={6}
              maxToRenderPerBatch={6}
              windowSize={7}
              removeClippedSubviews
              contentContainerStyle={styles.scrollContent}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={M.primary} />}
              renderItem={({ item: row }) => {
                if (row.kind === 'header') {
                  return (
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionTitle}>{row.title}</Text>
                      <Text style={styles.sectionCount}>{row.count}</Text>
                    </View>
                  );
                }
                return (
                  <View style={styles.cardRow}>
                    {row.items.map((item) => (
                      <View key={item.id} style={wide ? styles.cardGridItem : undefined}>
                        {row.card === 'employe' ? renderEmployeCard(item) : renderGenericCard(item)}
                      </View>
                    ))}
                  </View>
                );
              }}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={styles.emptyIcon}>🔍</Text>
                  <Text style={styles.emptyTitle}>Aucun résultat</Text>
                  <Text style={styles.emptyText}>
                    {query ? 'Essayez de modifier votre recherche' : 'Recherchez un employé, un employeur ou un contrat'}
                  </Text>
                </View>
              }
              ListFooterComponent={<View style={{ height: 80 }} />}
            />
            <DocumentViewerOverlay viewerDoc={photoViewer.doc} onClose={photoViewer.close} onDownload={photoViewer.download} downloading={photoViewer.downloading} />
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
  toolbarInner: {
    width: '100%',
    maxWidth: 1100,
    alignSelf: 'center',
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
    width: '100%',
    maxWidth: 1100,
    alignSelf: 'center',
  },
  // Chromebook/large : cartes en groupe centré de 2 colonnes
  cardGridWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  cardGridItem: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 420,
    maxWidth: 545,
  },

  // Sections
  section: {
    marginBottom: Spacing.lg,
  },
  // Rangée de cartes : 1 colonne sur mobile, 2 sur grand écran. Le `gap`
  // remplace le `gap: 12` du flexWrap d'origine (le conteneur n'est plus un
  // View qui wrappe les cartes, mais une ligne de liste).
  cardRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'stretch',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    paddingHorizontal: 4,
    // Espace entre deux sections successives (le marginBottom de `section`
    // ne s'applique plus : SectionList gère les en-têtes lui-même).
    paddingTop: Spacing.sm,
    backgroundColor: M.bg,
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
