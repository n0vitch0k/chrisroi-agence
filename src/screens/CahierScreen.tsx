import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';

import {
  getCahierPage,
  createCahierNote,
  updateCahierNote,
  deleteCahierNote,
  type CahierNote,
  type CahierTag,
  type CahierFilters,
} from '../database/service';
import { Colors, Spacing, Radius, Shadows } from '../theme';
import AppHeader from '../components/AppHeader';
import {
  localDayKey,
  shiftDayKey,
  dayRange,
  recentRange,
  dayLabel,
  formatRelative,
  formatAbsolute,
  rappelState,
} from '../utils/cahierDates';
import { planifierRappel, annulerRappel, demanderPermissionRappel } from '../utils/cahierNotifications';
import MonthCalendar from '../components/MonthCalendar';
import ActionSheet from '../components/ActionSheet';

const M = Colors;

// Raccourcis de filtre. 'rappel' n'est pas une période : c'est l'état « rappel dû ».
type Filtre = 'all' | 'today' | 'week' | 'month' | 'rappel';

const FILTRES: { key: Filtre; label: string }[] = [
  { key: 'all', label: 'Toutes' },
  { key: 'today', label: "Aujourd'hui" },
  { key: 'week', label: '7 jours' },
  { key: 'month', label: '30 jours' },
  { key: 'rappel', label: 'Rappels' },
];

// ─── Types de note ──────────────────────────────────────────────
// Ce sont des TYPES de note — la personne concernée par l'appel — et pas des
// métiers. Le filtre « Serveuse / Plongeur / Homme ménage » n'existe pas dans
// l'app, volontairement.
const TYPES_NOTE: { key: CahierTag; label: string; icon: any }[] = [
  { key: 'employe', label: 'Employé', icon: 'account-outline' },
  { key: 'employeur', label: 'Employeur', icon: 'domain' },
];

// ─── Surlignage « au feutre » ────────────────────────────────────
// Pas de <mark> en React Native : on découpe le texte et on pose un style
// backgroundColor + fontWeight sur le morceau qui matche. Recherche
// insensible à la casse mais on conserve la casse d'origine à l'affichage.
function surligner(text: string, recherche: string): React.ReactNode {
  if (!recherche) return text;
  const idx = text.toLowerCase().indexOf(recherche.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <Text style={styles.mark}>{text.slice(idx, idx + recherche.length)}</Text>
      {text.slice(idx + recherche.length)}
    </>
  );
}

// ─── Pastilles de rappel ────────────────────────────────────────
function BadgeRappel({ state, compact }: { state: 'retard' | 'aujourdhui' | 'futur'; compact?: boolean }) {
  if (state === 'retard') {
    return (
      <View style={[styles.badge, { backgroundColor: M.dangerLight }]}>
        <Icon name="alert-circle" size={12} color={M.danger} />
        <Text style={[styles.badgeText, { color: M.danger }]}>
          {compact ? 'En retard' : 'Rappel en retard'}
        </Text>
      </View>
    );
  }
  if (state === 'aujourdhui') {
    return (
      <View style={[styles.badge, { backgroundColor: M.warningDim }]}>
        <Icon name="calendar-today" size={12} color={M.warningDark} />
        <Text style={[styles.badgeText, { color: M.warningDark }]}>Rappel aujourd&apos;hui</Text>
      </View>
    );
  }
  return (
    <View style={[styles.badge, { backgroundColor: M.infoDim }]}>
      <Icon name="bell-outline" size={12} color={M.infoDark} />
      <Text style={[styles.badgeText, { color: M.infoDark }]}>Rappel</Text>
    </View>
  );
}

// ─── Plaque de type ─────────────────────────────────────────────
// Employé = vert olive (la couleur du thème pour les candidats).
// Employeur = sarcelle (la couleur « information / contact » du thème).
function BadgeTag({ tag }: { tag: 'employe' | 'employeur' }) {
  const estEmploye = tag === 'employe';
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: estEmploye ? M.successDim : M.infoDim },
      ]}
    >
      <Icon
        name={estEmploye ? 'account-outline' : 'domain'}
        size={12}
        color={estEmploye ? M.successDark : M.infoDark}
      />
      <Text
        style={[
          styles.badgeText,
          { color: estEmploye ? M.successDark : M.infoDark },
        ]}
      >
        {estEmploye ? 'Employé' : 'Employeur'}
      </Text>
    </View>
  );
}

// ─── Carte de note ──────────────────────────────────────────────
// Un tap ouvre la LECTURE (NoteDetail), pas le formulaire. Les actions
// (modifier / supprimer) vivent uniquement dans les trois points : c'est le
// seul endroit où l'on peut détruire une note, donc pas de double
// confirmation à traverser.
function NoteCard({
  note,
  recherche,
  onPress,
  onMenu,
}: {
  note: CahierNote;
  recherche: string;
  onPress: () => void;
  onMenu: () => void;
}) {
  const state = rappelState(note.rappel);
  const relatif = formatRelative(note.created);
  // La plaque se place AVANT le badge de rappel : le type est la
  // classification la plus large, le rappel n'est qu'un état.
  const type = note.tag_employe ? 'employe' : note.tag_employeur ? 'employeur' : null;
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {note.titre ? surligner(note.titre, recherche) : 'Sans titre'}
        </Text>
        <TouchableOpacity
          onPress={onMenu}
          hitSlop={10}
          style={styles.menuBtn}
          accessibilityRole="button"
          accessibilityLabel={`Actions de la note ${note.titre || 'sans titre'}`}
        >
          <Icon name="dots-vertical" size={20} color={M.textTertiary} />
        </TouchableOpacity>
      </View>
      <View style={styles.cardHeadLigne}>
        <Text style={styles.cardDate}>{relatif ?? formatAbsolute(note.created)}</Text>
      </View>
      <Text style={styles.cardBody} numberOfLines={4}>
        {surligner(note.contenu, recherche)}
      </Text>
      {/* Nom de la personne concernée : la plaque indique le TYPE, le nom
          dit QUI. Sans le nom, un filtre « Employé » sur 40 notes ne sert
          à rien. */}
      {type && (note.tag_employe || note.tag_employeur) ? (
        <View style={styles.tagNom}>
          <Icon
            name={type === 'employe' ? 'account-outline' : 'domain'}
            size={12}
            color={M.textTertiary}
          />
          <Text style={styles.tagNomText} numberOfLines={1}>
            {note.tag_employe || note.tag_employeur}
          </Text>
        </View>
      ) : null}
      <View style={styles.cardFoot}>
        {type && <BadgeTag tag={type} />}
        {state && <BadgeRappel state={state} compact />}
        <View style={styles.authorPill}>
          <Text style={styles.authorText} numberOfLines={1}>
            {note.author}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Vue lecture ─────────────────────────────────────────────────
// Ouverte par un tap sur la carte. Lecture seule : pas de champ éditable,
// pas de bouton « Modifier », pas de « Enregistrer ». C'est l'écran où l'on
// lit une note d'appel en entier — le contenu n'est plus tronqué à 4 lignes
// comme sur la carte.
function NoteDetail({
  note,
  visible,
  onClose,
}: {
  note: CahierNote | null;
  visible: boolean;
  onClose: () => void;
}) {
  const state = rappelState(note?.rappel);
  const type: 'employe' | 'employeur' | null =
    note?.tag_employe ? 'employe' : note?.tag_employeur ? 'employeur' : null;
  return (
    <Modal visible={visible && !!note} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.lectureCard}>
          <View style={styles.modalHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.lectureTitre} numberOfLines={3}>
                {note?.titre || 'Sans titre'}
              </Text>
              <Text style={styles.lectureMeta}>
                {note ? `${note.author} · ${formatAbsolute(note.created)}` : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Icon name="close" size={24} color={M.textTertiary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.lectureBody}
            contentContainerStyle={styles.lectureBodyContent}
          >
            <View style={styles.lectureBadges}>
              {type && <BadgeTag tag={type} />}
              {state && <BadgeRappel state={state} />}
            </View>
            {type && (note?.tag_employe || note?.tag_employeur) ? (
              <Text style={styles.lectureTagNom}>
                {note?.tag_employe || note?.tag_employeur}
              </Text>
            ) : null}
            {/* La note peut être longue (compte rendu d'appel) : pas de
                numberOfLines ici. Le ScrollView prend le reste de la hauteur. */}
            <Text style={styles.lectureTexte}>{note?.contenu}</Text>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Sélecteur de date (calendrier) ─────────────────────────────
// Le vrai choix de date est dans MonthCalendar ; ces raccourcis restent
// disponibles en raccourci dans la modale (le cas « dans 3 jours » est le
// plus fréquent pour un rappel d'appel).
const CHOIX_RAPPEL: { label: string; days: number }[] = [
  { label: 'Demain', days: 1 },
  { label: 'Dans 3 jours', days: 3 },
  { label: 'Dans une semaine', days: 7 },
];

// ─── Écran ──────────────────────────────────────────────────────
export default function CahierScreen() {
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const large = width >= 900;

  const [notes, setNotes] = useState<CahierNote[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filtre, setFiltre] = useState<Filtre>('all');
  const [jour, setJour] = useState<string | null>(null);
  const [recherche, setRecherche] = useState('');
  // Type de note affiché : 'employe' | 'employeur' | '' = les deux.
  // C'est un TYPE de note (personne concernée), pas un métier.
  const [tag, setTag] = useState<CahierTag>('');
  // Pagination serveur : page courante + nombre de pages connues.
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  // Recherche débattue : on n'envoie rien au serveur tant que l'utilisateur
  // n'arrête pas de taper (350 ms), sinon chaque lettre déclencherait une
  // requête réseau.
  const [rechercheDifferee, setRechercheDifferee] = useState('');

  // Modale d'édition
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [titre, setTitre] = useState('');
  const [contenu, setContenu] = useState('');
  const [rappel, setRappel] = useState<string | null>(null);
  // Tag saisi dans le formulaire. Deux champs Distincts : le schéma accepte
  // les deux, mais l'interface propose un choix unique par défaut (demande
  // explicite) — un second tag s'obtient en editant la note.
  const [tagForm, setTagForm] = useState<CahierTag>('');
  const [nomTag, setNomTag] = useState('');
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  // Mémorise la date de rappel AVANT édition : sans elle on ne peut pas
  // distinguer « l'utilisateur vient d'ajouter un rappel » (donc demander la
  // permission) de « il a laissé le rappel inchangé » (permission déjà donnée).
  const rappelPrecedent = React.useRef<string | null>(null);
  // Calendrier de rappel (vrai choix de date) — ouvert depuis la modale.
  const [calendrierVisible, setCalendrierVisible] = useState(false);
  // Calendrier du filtre de date (barre du haut) : indispensable pour
  // retrouver une note de plus de 7 jours.
  const [calendrierFiltreVisible, setCalendrierFiltreVisible] = useState(false);
  // Vue lecture : ouverte par un tap sur la carte. Lecture seule, aucun
  // raccourci vers la modification (demandé explicitement).
  const [lectureId, setLectureId] = useState<string | null>(null);
  // Feuille d'actions : ouverte par les trois points de la carte.
  const [menuId, setMenuId] = useState<string | null>(null);

  // Debounce de la recherche : évite une requête par lettre.
  useEffect(() => {
    const t = setTimeout(() => setRechercheDifferee(recherche), 350);
    return () => clearTimeout(t);
  }, [recherche]);

  // Les filtres serveur (plage de dates) : le jour précis prime sur le
  // raccourci, comme dans la maquette.
  const filtresServeur = useMemo<CahierFilters>(() => {
    let f: CahierFilters = {};
    if (jour) {
      f = dayRange(jour);
    } else if (filtre === 'today') {
      f = dayRange(localDayKey(new Date()));
    } else if (filtre === 'week') {
      f = recentRange(7);
    } else if (filtre === 'month') {
      f = recentRange(30);
    }
    return { ...f, tag, recherche: rechercheDifferee };
  }, [filtre, jour, tag, rechercheDifferee]);

  const charger = useCallback(
    async (pageCible = 1) => {
      try {
        const res = await getCahierPage(filtresServeur, pageCible, 50);
        setNotes(res.notes);
        setPage(res.page);
        setTotalPages(res.totalPages);
        setTotalItems(res.totalItems);
      } catch (e: any) {
        console.error('[cahier] chargement:', e);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filtresServeur],
  );

  useFocusEffect(
    useCallback(() => {
      charger(1);
    }, [charger]),
  );

  // ── Filtrage résiduel (côté client) ──
  // Le filtre « Rappels » reste côté client : il porte sur le champ `rappel`,
  // pas sur une plage de dates, et le serveur n'a pas d'index dessus. Tout le
  // reste (plage, type, recherche) est déjà fait par le serveur.
  const visibles = useMemo(() => {
    if (filtre !== 'rappel') return notes;
    const today = localDayKey(new Date());
    return notes.filter((n) => n.rappel && n.rappel <= today);
  }, [notes, filtre]);

  const rappelsDus = useMemo(
    () => notes.filter((n) => n.rappel && n.rappel <= localDayKey(new Date())).length,
    [notes],
  );
  // La semaine est un compteur GLOBAL, pas celui de la page affichée : sinon
  // le chiffre changerait en feuilletant, ce qui serait faux.
  const semaine = useMemo(() => {
    if (filtre === 'week' || filtre === 'today' || jour) return notes.length;
    const debut = recentRange(7).dateDebut;
    return notes.filter((n) => n.created >= debut).length;
  }, [notes, filtre, jour]);

  const ouvrirCreation = () => {
    setEditingId(null);
    setTitre('');
    setContenu('');
    setRappel(null);
    setTagForm('');
    setNomTag('');
    setErreur(null);
    rappelPrecedent.current = null;
    setModalVisible(true);
  };

  // Un tap sur la carte ouvre la lecture. Aucune confirmation ici : lire une
  // note n'écrit rien et ne détruit rien.
  const ouvrirLecture = (note: CahierNote) => setLectureId(note.id);

  const ouvrirEdition = (note: CahierNote) => {
    setEditingId(note.id);
    setTitre(note.titre);
    setContenu(note.contenu);
    setRappel(note.rappel || null);
    // Une note peut avoir les deux tags (le schéma l'autorise) : on affiche le
    // premier trouvé, et son nom avec lui.
    const type: CahierTag = note.tag_employe ? 'employe' : note.tag_employeur ? 'employeur' : '';
    setTagForm(type);
    setNomTag(note.tag_employe || note.tag_employeur || '');
    setErreur(null);
    rappelPrecedent.current = note.rappel || null;
    setModalVisible(true);
  };

  const enregistrer = async () => {
    if (!contenu.trim()) {
      setErreur('Le contenu est obligatoire.');
      return;
    }
    setSaving(true);
    setErreur(null);
    try {
      // Choix unique : le nom saisi part sur LE champ du type choisi.
      const nom = nomTag.trim();
      const tags = {
        tag_employe: tagForm === 'employe' ? nom : '',
        tag_employeur: tagForm === 'employeur' ? nom : '',
      };
      if (editingId) {
        await updateCahierNote(editingId, { titre, contenu, rappel, ...tags });
        if (rappel) {
          if (!rappelPrecedent.current) await demanderPermissionRappel();
          const r = await planifierRappel(editingId, rappel, contenu.trim());
          if (!r.ok) console.warn('[cahier] rappel non planifié:', r.raison);
        } else {
          await annulerRappel(editingId);
        }
      } else {
        const id = await createCahierNote({ titre, contenu, rappel, ...tags });
        if (rappel) {
          await demanderPermissionRappel();
          const r = await planifierRappel(id, rappel, contenu.trim());
          if (!r.ok) console.warn('[cahier] rappel non planifié:', r.raison);
        }
      }
      setModalVisible(false);
      // Retour page 1 : apres un filtre ou une creation, l'utilisateur doit
      // voir le debut de la liste, pas une page ou sa note n'apparait pas.
      await charger(1);
    } catch (e: any) {
      console.error('[cahier] enregistrement:', e);
      setErreur(
        e?.message?.includes('cahier_notes')
          ? "La collection « cahier_notes » n'existe pas encore sur le serveur."
          : e?.message || "L'enregistrement a échoué.",
      );
    } finally {
      setSaving(false);
    }
  };

  // Suppression : uniquement depuis la feuille d'actions. La confirmation
  // native reste — c'est la seule action destructive de l'écran, et elle est
  // désormais joignable en un seul geste (pas d'ouverture du formulaire avant).
  const supprimerNote = async (note: CahierNote) => {
    try {
      await annulerRappel(note.id);
      await deleteCahierNote(note.id);
      // La note disparaît aussi de la vue lecture si elle y était ouverte.
      setLectureId((id) => (id === note.id ? null : id));
      // Si on vient de vider la DERNIERE page, on recule d'une page plutôt que
      // d'afficher une page vide : le total baisse de 1, donc la page 3 peut
      // ne plus exister.
      await charger(page > 1 && visibles.length <= 1 ? page - 1 : page);
    } catch (e: any) {
      console.error('[cahier] suppression:', e);
      Alert.alert('Suppression impossible', e?.message || "La suppression a échoué.");
    }
  };

  const reponseVide = loading
    ? null
    : visibleVide(visibles, recherche, filtre, jour, tag);

  // La note affichée dans la vue lecture / la feuille d'actions. On relit le
  // tableau courant plutôt que de garder une copie dans l'état : après une
  // suppression ou un rechargement, la référence reste la bonne.
  const noteLue = useMemo(
    () => (lectureId ? notes.find((n) => n.id === lectureId) || null : null),
    [lectureId, notes],
  );
  const noteDuMenu = useMemo(
    () => (menuId ? notes.find((n) => n.id === menuId) || null : null),
    [menuId, notes],
  );

  return (
    <View style={styles.container}>
      <AppHeader
        title="Cahier"
        subtitle="Notes d'appels et de renseignements"
        onBack={() => navigation.goBack()}
        right={
          rappelsDus > 0 ? (
            <View style={styles.headerBadge}>
              <Icon name="bell-alert" size={14} color="#fff" />
              <Text style={styles.headerBadgeText}>{rappelsDus}</Text>
            </View>
          ) : null
        }
      />

      {/* Statistiques */}
      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{notes.length}</Text>
          <Text style={styles.statLabel}>Notes</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: M.danger }]}>{rappelsDus}</Text>
          <Text style={styles.statLabel}>Rappels</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: M.success }]}>{semaine}</Text>
          <Text style={styles.statLabel}>Cette semaine</Text>
        </View>
      </View>

      {/* Recherche */}
      <View style={styles.searchWrap}>
        <Icon name="magnify" size={20} color={M.textTertiary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher dans les notes…"
          placeholderTextColor={M.textTertiary}
          value={recherche}
          onChangeText={setRecherche}
          returnKeyType="search"
          autoCorrect={false}
        />
        {recherche.length > 0 && (
          <TouchableOpacity onPress={() => setRecherche('')} hitSlop={10}>
            <Icon name="close-circle" size={20} color={M.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filtres */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={styles.filterBarContent}
      >
        {FILTRES.map((f) => (
          <TouchableOpacity
            key={f.key}
            onPress={() => {
              setFiltre(f.key);
              setJour(null);
            }}
            style={[styles.chip, filtre === f.key && !jour && styles.chipActive]}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, filtre === f.key && !jour && styles.chipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Filtre par TYPE de note. Séparé de la barre de périodes : Employé /
          Employeur classent la note par personne concernée, ce n'est pas une
          durée. Un seul actif à la fois (l'appui redonne « tous »). */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={styles.filterBarContent}
      >
        {TYPES_NOTE.map((t) => {
          const actif = tag === t.key;
          return (
            <TouchableOpacity
              key={t.key || 'tous'}
              onPress={() => setTag(actif ? '' : t.key)}
              style={[
                styles.chip,
                actif && styles.chipActive,
                // Le filtre Employé doit se lire comme une catégorie précise,
                // pas comme le bouton principal du filtre.
                actif && t.key === 'employe' && { backgroundColor: M.success, borderColor: M.success },
                actif && t.key === 'employeur' && { backgroundColor: M.info, borderColor: M.info },
              ]}
              activeOpacity={0.7}
            >
              <Icon
                name={t.icon}
                size={13}
                color={actif ? '#fff' : M.textSecondary}
                style={{ marginRight: 5 }}
              />
              <Text style={[styles.chipText, actif && styles.chipTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Filtre date précise — raccourcis + calendrier complet pour n'importe
          quelle date, y compris ancienne. Sans le calendrier, la barre ne
          descendait qu'à J-7 : impossible de retrouver une note du mois passé. */}
      <View style={[styles.dateFilter, !!jour && styles.dateFilterActive]}>
        <TouchableOpacity
          onPress={() => setCalendrierFiltreVisible(true)}
          style={styles.dateFilterBtn}
          activeOpacity={0.7}
        >
          <Icon name="calendar-month" size={18} color={jour ? '#fff' : M.textTertiary} />
          <Text style={[styles.dateFilterLabel, !!jour && { color: '#fff' }]}>
            {jour ? dayLabel(jour) : 'Date précise'}
          </Text>
        </TouchableOpacity>
        {jour ? (
          <TouchableOpacity onPress={() => setJour(null)} hitSlop={10}>
            <Icon name="close-circle" size={20} color={M.primary} />
          </TouchableOpacity>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayScroll}>
            <TouchableOpacity
              onPress={() => setJour(localDayKey(new Date()))}
              style={styles.dayBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.dayBtnText}>Aujourd&apos;hui</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setJour(shiftDayKey(localDayKey(new Date()), -1))}
              style={styles.dayBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.dayBtnText}>Hier</Text>
            </TouchableOpacity>
            {[-2, -3, -4, -5, -6, -7].map((d) => (
              <TouchableOpacity
                key={d}
                onPress={() => setJour(shiftDayKey(localDayKey(new Date()), d))}
                style={styles.dayBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.dayBtnText}>{dayLabel(shiftDayKey(localDayKey(new Date()), d))}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Liste / grille */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={[styles.listContent, { maxWidth: large ? 1100 : undefined }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            // Tirer vers le bas recharge la PAGE COURANTE : l'utilisateur est
            // en train de lire cette page, pas de revenir au début.
            onRefresh={() => { setRefreshing(true); charger(page); }}
            tintColor={M.primary}
          />
        }
        keyboardShouldPersistTaps="handled"
      >
        {reponseVide || visibles.length === 0 ? (
          reponseVide ? (
            <View style={styles.empty}>
              <Icon name="notebook-outline" size={64} color={M.textTertiary} />
              <Text style={styles.emptyTitle}>{reponseVide.titre}</Text>
              <Text style={styles.emptySub}>{reponseVide.sousTitre}</Text>
            </View>
          ) : null
        ) : (
          <View style={[styles.grid, large && styles.gridWide]}>
            {visibles.map((n) => (
              <View key={n.id} style={large ? styles.gridItemWide : styles.gridItem}>
                <NoteCard
                  note={n}
                  recherche={recherche.trim()}
                  onPress={() => ouvrirLecture(n)}
                  onMenu={() => setMenuId(n.id)}
                />
              </View>
            ))}
          </View>
        )}

        {totalPages > 1 ? (
          <View style={styles.pagination}>
            <TouchableOpacity
              onPress={() => page > 1 && !refreshing && charger(page - 1)}
              disabled={page <= 1 || refreshing}
              style={[styles.pageBtn, page <= 1 && styles.pageBtnOff]}
              activeOpacity={0.7}
              accessibilityLabel="Page précédente"
            >
              <Icon name="chevron-left" size={20} color={page <= 1 ? M.textTertiary : M.primary} />
            </TouchableOpacity>
            <Text style={styles.pageTexte}>
              Page {page} sur {totalPages}
              {totalItems > 0 ? ` · ${totalItems} note${totalItems > 1 ? 's' : ''}` : ''}
            </Text>
            <TouchableOpacity
              onPress={() => page < totalPages && !refreshing && charger(page + 1)}
              disabled={page >= totalPages || refreshing}
              style={[styles.pageBtn, page >= totalPages && styles.pageBtnOff]}
              activeOpacity={0.7}
              accessibilityLabel="Page suivante"
            >
              <Icon name="chevron-right" size={20} color={page >= totalPages ? M.textTertiary : M.primary} />
            </TouchableOpacity>
          </View>
        ) : totalItems > 0 ? (
          <Text style={styles.totalFoot}>
            {totalItems} note{totalItems > 1 ? 's' : ''} au total
          </Text>
        ) : null}

        <TouchableOpacity style={styles.newBtn} onPress={ouvrirCreation} activeOpacity={0.8}>
          <Icon name="plus" size={20} color={M.primary} />
          <Text style={styles.newBtnText}>Nouvelle note</Text>
        </TouchableOpacity>
        <View style={{ height: 30 }} />
      </ScrollView>

      {/* ── Modale d'édition ── */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => !saving && setModalVisible(false)}
          />
          <View style={styles.modalCard}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>{editingId ? 'Modifier la note' : 'Nouvelle note'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={10}>
                <Icon name="close" size={24} color={M.textTertiary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Titre (optionnel)</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex. Appel M. Koné"
                placeholderTextColor={M.textTertiary}
                value={titre}
                onChangeText={setTitre}
                autoCorrect={false}
              />

              <Text style={styles.label}>Contenu</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                placeholder="Notez ici…"
                placeholderTextColor={M.textTertiary}
                value={contenu}
                onChangeText={setContenu}
                multiline
                textAlignVertical="top"
              />

              <Text style={styles.label}>Concerne (optionnel)</Text>
              <View style={styles.tagChoices}>
                {TYPES_NOTE.map((t) => {
                  const actif = tagForm === t.key;
                  return (
                    <TouchableOpacity
                      key={t.key}
                      onPress={() => setTagForm(actif ? '' : t.key)}
                      style={[
                        styles.tagChip,
                        actif && t.key === 'employe' && styles.tagChipEmploye,
                        actif && t.key === 'employeur' && styles.tagChipEmployeur,
                      ]}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={actif ? `Retirer le tag ${t.label}` : `Taguer comme ${t.label}`}
                    >
                      <Icon
                        name={t.icon}
                        size={14}
                        color={actif ? '#fff' : M.textSecondary}
                      />
                      <Text
                        style={[styles.tagChipText, actif && { color: '#fff', fontWeight: '700' }]}
                      >
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {/* Le nom n'apparait QUE si un type est choisi : sans type, un
                  nom seul ne serait pas rattachable. */}
              {tagForm ? (
                <TextInput
                  style={styles.input}
                  placeholder={tagForm === 'employe' ? 'Ex. Kouassi Ange' : 'Ex. Konan & Fils'}
                  placeholderTextColor={M.textTertiary}
                  value={nomTag}
                  onChangeText={setNomTag}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              ) : null}

              <Text style={styles.label}>Date de rappel (optionnel)</Text>
              <View style={styles.rappelRow}>
                {rappel ? (
                  <View style={styles.rappelSet}>
                    <Icon name="calendar-check" size={16} color={M.warningDark} />
                    <Text style={styles.rappelSetText}>{dayLabel(rappel)}</Text>
                    <TouchableOpacity onPress={() => setRappel(null)} hitSlop={8}>
                      <Icon name="close-circle" size={20} color={M.textTertiary} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.rappelChoices}>
                    {/* Choix libre : le calendrier ouvre sur le mois courant. */}
                    <TouchableOpacity
                      onPress={() => setCalendrierVisible(true)}
                      style={[styles.rappelChip, styles.rappelChipPrincipal]}
                      activeOpacity={0.7}
                    >
                      <Icon name="calendar-month" size={14} color="#fff" />
                      <Text style={[styles.rappelChipText, { color: '#fff' }]}>Choisir une date</Text>
                    </TouchableOpacity>
                    {CHOIX_RAPPEL.map((c) => (
                      <TouchableOpacity
                        key={c.days}
                        onPress={() => setRappel(shiftDayKey(localDayKey(new Date()), c.days))}
                        style={styles.rappelChip}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.rappelChipText}>{c.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
              {rappel && (
                <TouchableOpacity onPress={() => setRappel(null)} style={styles.rappelClear}>
                  <Icon name="bell-off-outline" size={14} color={M.textTertiary} />
                  <Text style={styles.rappelClearText}>Retirer le rappel</Text>
                </TouchableOpacity>
              )}

              {erreur && (
                <View style={styles.errorBox}>
                  <Icon name="alert-circle-outline" size={16} color={M.danger} />
                  <Text style={styles.errorText}>{erreur}</Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.btn, styles.btnSecondary]}
                onPress={() => setModalVisible(false)}
                disabled={saving}
              >
                <Text style={styles.btnSecondaryText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary, saving && { opacity: 0.6 }]}
                onPress={enregistrer}
                disabled={saving}
              >
                <Text style={styles.btnPrimaryText}>{saving ? '…' : 'Enregistrer'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Calendrier de rappel — modale au-dessus de la modale d'édition */}
      <MonthCalendar
        visible={calendrierVisible}
        value={rappel}
        onSelect={(day) => setRappel(day || null)}
        onClose={() => setCalendrierVisible(false)}
        titre="Date de rappel"
      />

      {/* Calendrier du filtre — un jour futur ne serait pas interdit : le
          filtre renverrait simplement une liste vide, ce qui est honnête. */}
      <MonthCalendar
        visible={calendrierFiltreVisible}
        value={jour}
        onSelect={(day) => {
          if (day) setJour(day);
        }}
        onClose={() => setCalendrierFiltreVisible(false)}
        titre="Filtrer par date"
      />

      {/* Vue lecture — ouverte par un tap sur la carte. */}
      <NoteDetail
        note={noteLue}
        visible={!!lectureId}
        onClose={() => setLectureId(null)}
      />

      {/* Trois points — l'unique accès à Modifier et Supprimer. */}
      <ActionSheet
        visible={!!menuId}
        titre={noteDuMenu?.titre || 'Note sans titre'}
        sousTitre={
          noteDuMenu
            ? `${noteDuMenu.author} · ${formatAbsolute(noteDuMenu.created)}`
            : undefined
        }
        actions={[
          { label: 'Modifier', icon: 'pencil-outline', onPress: () => { if (noteDuMenu) ouvrirEdition(noteDuMenu); } },
          {
            label: 'Supprimer',
            icon: 'trash-can-outline',
            tone: 'danger',
            onPress: () => {
              if (!noteDuMenu) return;
              Alert.alert(
                'Supprimer la note ?',
                noteDuMenu.titre
                  ? `« ${noteDuMenu.titre} » sera définitivement supprimée.`
                  : 'Cette note sera définitivement supprimée.',
                [
                  { text: 'Annuler', style: 'cancel' },
                  { text: 'Supprimer', style: 'destructive', onPress: () => { supprimerNote(noteDuMenu); } },
                ],
              );
            },
          },
        ]}
        onClose={() => setMenuId(null)}
      />
    </View>
  );
}

/** Message d'état vide, adapté au motif filtré. L'ordre compte : on part du
 *  filtre le plus restrictif, parce que c'est lui que l'utilisateur a choisi. */
function visibleVide(
  list: CahierNote[],
  recherche: string,
  filtre: Filtre,
  jour: string | null,
  tag: CahierTag,
): { titre: string; sousTitre: string } | null {
  if (list.length > 0) return null;
  const labelTag = tag === 'employe' ? 'employé' : 'employeur';

  if (recherche.trim()) {
    const q = recherche.trim();
    // Recherche + filtre de type : ne pas dire « aucun résultat » tout court,
    // le résultat existe peut-être sous l'autre type.
    if (tag) {
      return {
        titre: 'Aucun résultat',
        sousTitre: `Aucune note « ${q} » ne concerne un ${labelTag}.`,
      };
    }
    return { titre: 'Aucun résultat', sousTitre: `Aucune note ne contient « ${q} ».` };
  }
  if (jour) {
    return { titre: 'Aucune note ce jour-là', sousTitre: `Rien n'a été noté le ${dayLabel(jour).toLowerCase()}.` };
  }
  if (filtre === 'rappel') {
    return { titre: 'Aucun rappel', sousTitre: "Aucun rappel n'est dû aujourd'hui." };
  }
  if (tag) {
    // Le cas trompeur : il y a des notes, aucune de ce type. « Aucune note »
    // ferait croire que le cahier est vide.
    return {
      titre: `Aucune note ${labelTag}`,
      sousTitre: `Le cahier contient des notes, mais aucune ne concerne un ${labelTag}.`,
    };
  }
  if (filtre === 'all') {
    return { titre: 'Aucune note', sousTitre: 'Notez votre premier appel ou renseignement.' };
  }
  return { titre: 'Aucune note', sousTitre: 'Aucune note sur cette période.' };
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: M.bg },

  // ── Header ──
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: M.danger,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  headerBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // ── Stats ──
  stats: {
    flexDirection: 'row',
    backgroundColor: M.surface,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    ...Shadows.soft,
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '700', color: M.textPrimary },
  statLabel: { fontSize: 11, color: M.textTertiary, marginTop: 2 },

  // ── Recherche ──
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: M.surface,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: M.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 2,
    gap: Spacing.sm,
    ...Shadows.soft,
  },
  searchIcon: { marginLeft: 2 },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: M.textPrimary,
    // Le placeholder du thème est trop clair pour un champ de saisie réel.
    includeFontPadding: false,
  },

  // ── Filtres ──
  filterBar: { flexGrow: 0, marginTop: Spacing.md },
  filterBarContent: { paddingHorizontal: Spacing.lg, gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    borderColor: M.border,
    backgroundColor: M.surface,
  },
  chipActive: { backgroundColor: M.primary, borderColor: M.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: M.textSecondary },
  chipTextActive: { color: '#fff' },

  // ── Date précise ──
  dateFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: M.surface,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: M.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    ...Shadows.soft,
  },
  dateFilterActive: { borderColor: M.primary, backgroundColor: M.primaryDim },
  // Bouton qui ouvre le calendrier : devient plein quand un jour est pose,
  // pour qu'on distingue « filtre actif » d'un simple libelle.
  dateFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingRight: 4,
  },
  dateFilterLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: M.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateFilterValue: { flex: 1, fontSize: 13, fontWeight: '700', color: M.primary },
  dayScroll: { flex: 1 },
  dayBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: M.bg,
    marginRight: 6,
  },
  dayBtnText: { fontSize: 12, fontWeight: '600', color: M.textSecondary, textTransform: 'capitalize' },

  // ── Liste ──
  list: { flex: 1, marginTop: Spacing.md },
  listContent: { width: '100%', alignSelf: 'center', paddingHorizontal: Spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridItem: { width: '100%' },
  gridWide: { justifyContent: 'center' },
  gridItemWide: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 420,
    maxWidth: 545,
  },

  // ── Carte ──
  card: {
    backgroundColor: M.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: M.borderSoft,
    padding: Spacing.lg,
    ...Shadows.soft,
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing.sm, gap: 8 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: M.textPrimary, lineHeight: 20 },
  cardDate: { fontSize: 11, color: M.textTertiary },
  cardBody: { fontSize: 13, color: M.textSecondary, lineHeight: 20 },
  cardFoot: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.md, flexWrap: 'wrap' },
  mark: {
    backgroundColor: '#fff3b0',
    color: M.textPrimary,
    fontWeight: '700',
  },
  authorPill: {
    backgroundColor: M.successDim,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 'auto',
  },
  authorText: { fontSize: 10, fontWeight: '700', color: M.successDark },

  // ── Badges rappel ──
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 10, fontWeight: '700' },

  // ── Bouton nouvelle note ──
  newBtn: {
    marginTop: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: M.primary,
  },
  newBtnText: { fontSize: 14, fontWeight: '700', color: M.primary },

  // ── Empty ──
  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: Spacing.lg },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: M.textSecondary, marginTop: Spacing.lg },
  emptySub: { fontSize: 13, color: M.textTertiary, marginTop: 4, textAlign: 'center' },

  // ── Modale ──
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    backgroundColor: M.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    ...Shadows.elevated,
  },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  modalTitle: { fontSize: 18, fontWeight: '800', color: M.textPrimary },
  modalBody: { flexGrow: 0 },
  label: { fontSize: 12, fontWeight: '700', color: M.textSecondary, marginBottom: 6, marginTop: Spacing.sm },
  input: {
    backgroundColor: M.bg,
    borderWidth: 1.5,
    borderColor: M.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    color: M.textPrimary,
  },
  inputMultiline: { height: 130, paddingTop: Spacing.md },
  rappelRow: { minHeight: 40, justifyContent: 'center' },
  rappelChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rappelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    backgroundColor: M.primaryDim,
  },
  // Le vrai choix de date est l'action principale : elle se distingue des
  // raccourcis (« demain », « dans 3 jours ») qui restent discrets.
  rappelChipPrincipal: { backgroundColor: M.primary },
  rappelChipText: { fontSize: 12, fontWeight: '600', color: M.primaryDark },
  rappelSet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: M.warningDim,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  rappelSetText: { flex: 1, fontSize: 14, fontWeight: '700', color: M.warningDark, textTransform: 'capitalize' },
  rappelClear: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  rappelClearText: { fontSize: 12, color: M.textTertiary },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: M.dangerLight,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  errorText: { flex: 1, fontSize: 13, color: M.danger, fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: Spacing.lg },
  btn: { flex: 1, paddingVertical: 13, borderRadius: Radius.sm, alignItems: 'center' },
  btnPrimary: { backgroundColor: M.primary },
  btnPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  btnSecondary: { backgroundColor: M.bg },
  btnSecondaryText: { color: M.textSecondary, fontSize: 14, fontWeight: '600' },
  // btnDanger / btnDangerText ne sont plus utilisés : la suppression est
  // passée dans la feuille d'actions, qui porte son propre style danger.

  // ── Vue lecture ──
  // Carte centrée mais plus haute que la modale d'édition : une note d'appel
  // peut faire plusieurs écrans.
  lectureCard: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '88%',
    backgroundColor: M.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    ...Shadows.elevated,
  },
  lectureTitre: { fontSize: 18, fontWeight: '800', color: M.textPrimary, lineHeight: 25 },
  lectureMeta: { fontSize: 12, color: M.textTertiary, marginTop: 3 },
  lectureBody: { flexGrow: 0, marginTop: Spacing.xs },
  lectureBodyContent: { paddingBottom: Spacing.sm },
  lectureTexte: { fontSize: 15, color: M.textPrimary, lineHeight: 23 },

  // ── Trois points sur la carte ──
  menuBtn: { padding: 2, marginTop: -2, marginRight: -2 },
  cardHeadLigne: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },

  // ── Nom de la personne concernée ──
  tagNom: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  tagNomText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: M.textSecondary,
    textTransform: 'capitalize',
  },

  // ── Tags dans le formulaire ──
  tagChoices: { flexDirection: 'row', gap: 8, marginBottom: 2 },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    borderColor: M.border,
    backgroundColor: M.surface,
  },
  tagChipEmploye: { backgroundColor: M.success, borderColor: M.success },
  tagChipEmployeur: { backgroundColor: M.info, borderColor: M.info },
  tagChipText: { fontSize: 13, fontWeight: '600', color: M.textSecondary },

  // ── Vue lecture : badges ──
  lectureBadges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: Spacing.sm },
  lectureTagNom: {
    fontSize: 14,
    fontWeight: '700',
    color: M.textSecondary,
    textTransform: 'capitalize',
    marginBottom: Spacing.md,
  },

  // ── Pagination ──
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
    marginTop: Spacing.lg,
  },
  pageBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: M.primaryDim,
  },
  // Grise : la page est hors borne, le bouton ne fait rien.
  pageBtnOff: { backgroundColor: M.bg },
  pageTexte: { fontSize: 13, fontWeight: '600', color: M.textSecondary },
  totalFoot: {
    fontSize: 12,
    color: M.textTertiary,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
});
