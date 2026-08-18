import React, { useState, useCallback, useEffect } from 'react';
import type { EmployeDetailNavigationProp } from '../types/navigation';

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  ViewStyle,
  Image,
  Modal,
} from 'react-native';;
import { Card, Chip, Divider, Menu } from 'react-native-paper';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import AppHeader from '../components/AppHeader';
import {
  getEmployeById,
  deleteEmploye,
  getContratsByEmploye,
  getEmployePhotoUrl,
  getDocumentsByEmploye,
  uploadDocument,
  deleteDocument,
  getDocumentTypeLabel,
  getDocumentTypeIcon,
  DOCUMENT_TYPES,
  getDocumentImageUrl,
  getEntityHistory,
} from '../database/service';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { printToFileAsync } from 'expo-print';
import { buildFichePapierHtml, FichePapierData, fileUriToDataUri } from '../utils/fichePrint';
import SafeButton from '../components/SafeButton';
import {
  formatDate,
  formatDateOr,
  calculateAge,
  getStatutColor,
  getStatutLabel,
  getCategorieLabel,
  getNiveauEtudeLabel,
  getSituationMatrimonialeLabel,
} from '../utils/constants';
import { Colors, Spacing, Radius, Shadows } from '../theme';

const InfoRow = ({ icon, label, value, style }: { icon: string; label: string; value: string; style?: ViewStyle }) => (
  <View style={[styles.infoRow, style]}>
    <Icon name={icon} size={17} color={Colors.iconLight} style={styles.infoIcon} />
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue} numberOfLines={2}>{value || '-'}</Text>
  </View>
);

// ─── Avatar : photo si dispo, sinon initiales colorées ───
function EmployeAvatar({
  photoUri,
  initials,
  statusColor,
  size = 80,
}: {
  photoUri?: string | null;
  initials: string;
  statusColor: string;
  size?: number;
}) {
  const [imgError, setImgError] = useState(false);
  const showPhoto = photoUri && !imgError;
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: statusColor + '18' },
      ]}
    >
      {showPhoto ? (
        <Image
          source={{ uri: photoUri! }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          onError={() => setImgError(true)}
        />
      ) : (
        <Text style={[styles.avatarText, { color: statusColor, fontSize: size * 0.35 }]}>
          {initials || '?'}
        </Text>
      )}
    </View>
  );
}

export default function EmployeDetailScreen() {
  const navigation = useNavigation<EmployeDetailNavigationProp>();
  const route = useRoute<any>();
  const rootNavigation = navigation.getParent()?.getParent();
  const employeId = route.params?.id;
  const [employe, setEmploye] = useState<any>(null);
  const [contrats, setContrats] = useState<any[]>([]);
  const [menuVisible, setMenuVisible] = useState(false);
  const [documents, setDocuments] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [showDocTypePicker, setShowDocTypePicker] = useState(false);
  const [showDocSourcePicker, setShowDocSourcePicker] = useState(false);
  const [docTypePending, setDocTypePending] = useState<string | null>(null);
  const [docsLoading, setDocsLoading] = useState(false);

  const loadEmploye = async () => {
    try {
      const data = await getEmployeById(employeId);
      setEmploye(data);
      if (data?.prenom && data?.nom) {
        // useAppHeader va afficher le nom dans la header, mais on peut
        // aussi le mettre dans le titre de la route (fallback).
        navigation.setOptions({ title: `${data.prenom} ${data.nom}` });
      }
      const contratsData = await getContratsByEmploye(employeId);
      setContrats(contratsData || []);
      const docsData = await getDocumentsByEmploye(employeId);
      setDocuments(docsData || []);

      const hist = await getEntityHistory('employe', employeId);
      setHistory(hist || []);
    } catch (error) {
      console.error('Error loading employe:', error);
    }
  };

  // ── Génération + partage de la FICHE PAPIER (depuis l'écran Détail) ──
  const [generatingFiche, setGeneratingFiche] = useState(false);
  const handleDownloadFiche = async () => {
    if (!employe) return;
    setGeneratingFiche(true);
    try {
      // Photo : on l'embarque en data-URI base64 pour qu'elle s'imprime TOUJOURS
      const photoUrl = getEmployePhotoUrl(employeId, employe.photo);
      const photoDataUri = photoUrl ? await fileUriToDataUri(photoUrl) : null;

      const urgence = (employe.personnes_urgence || [])
        .slice(0, 2)
        .map((p: any) => ({
          nom: p.nom,
          prenom: p.prenom,
          telephone: p.telephone,
          lieu: p.lieu_residence || p.lieu,
        }));

      const data: FichePapierData = {
        date: employe.date_inscription
          ? (employe.date_inscription as string).slice(0, 10)
          : new Date().toISOString().slice(0, 10),
        nom: employe.nom,
        prenom: employe.prenom,
        date_naissance: employe.date_naissance,
        lieu_naissance: employe.lieu_naissance,
        telephone: employe.telephone,
        lieu_residence: employe.lieu_residence,
        nationalite: employe.nationalite,
        sexe: employe.sexe,
        situation_matrimoniale: employe.situation_matrimoniale,
        religion: employe.religion,
        ethnie: employe.ethnie,
        categorie_emploi: employe.categorie_emploi,
        niveau_etude: employe.niveau_etude,
        deja_travaille: employe.a_deja_travaille,
        experience_details: employe.experience_details,
        allergie_sante: employe.allergie_sante,
        intervention_chirurgicale: employe.intervention_chirurgicale,
        photo: photoUrl,
        photoDataUri,
        urgence,
      };

      const html = buildFichePapierHtml(data);
      const { uri } = await printToFileAsync({ html, base64: false });

      if (Platform.OS === 'web') return; // sur web, aperçu navigateur

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: "Fiche d'inscription (papier)",
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('PDF généré', `Fiche enregistrée :\n${uri}`);
      }
    } catch (error) {
      console.error('Erreur génération fiche papier:', error);
      Alert.alert('Erreur', "Impossible de générer la fiche d'inscription.");
    } finally {
      setGeneratingFiche(false);
    }
  };

  useFocusEffect(useCallback(() => { loadEmploye(); }, [employeId]));

  // ── Documents associés ─────────────────────────────────
  const pickDocType = (type: string) => {
    setDocTypePending(type);
    setShowDocTypePicker(false);
    setShowDocSourcePicker(true);
  };

  const uploadPendingDocument = async (imageUri: string) => {
    if (!employeId || !docTypePending) return;
    setDocsLoading(true);
    try {
      await uploadDocument(employeId, docTypePending, imageUri);
      setDocTypePending(null);
      const docs = await getDocumentsByEmploye(employeId);
      setDocuments(docs || []);
    } catch (e) {
      console.warn('uploadDocument error:', e);
      Alert.alert('Erreur', "Échec de l'ajout du document.");
    } finally {
      setDocsLoading(false);
    }
  };

  const removeDocument = (docId: string) => {
    Alert.alert('Supprimer le document ?', 'Cette action est irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          await deleteDocument(docId);
          const docs = await getDocumentsByEmploye(employeId);
          setDocuments(docs || []);
        },
      },
    ]);
  };

  // Header custom sans "Go back" moche — titre dynamique selon l'employé chargé.
  const headerTitle = employe ? `${employe.prenom || ''} ${employe.nom || ''}`.trim() || 'Employé' : 'Employé';

  const handleDelete = () => {
    Alert.alert('Confirmer la suppression', 'Êtes-vous sûr de vouloir supprimer cet employé ? Cette action est irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          try {
            await deleteEmploye(employeId);
            navigation.goBack();
          } catch (error) {
            console.error('Error deleting employe:', error);
            Alert.alert('Erreur', 'Une erreur est survenue lors de la suppression');
          }
        },
      },
    ]);
  };

  if (!employe) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={{ color: Colors.textSecondary }}>Chargement...</Text>
      </View>
    );
  }

  const age = calculateAge(employe.date_naissance);
  const statusColor = getStatutColor(employe.statut);
  const initials = `${employe.prenom?.charAt(0) || ''}${employe.nom?.charAt(0) || ''}`;

  return (
    <>
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* ── Header ─────────────────────────────────────── */}
      <AppHeader title={headerTitle} showBack onBack={() => navigation.goBack()} />
      {/* ── Entête ─────────────────────────────────────── */}
      <View style={header}>
        <EmployeAvatar
          photoUri={getEmployePhotoUrl(employeId, employe.photo)}
          initials={initials}
          statusColor={statusColor}
          size={88}
        />
        <Text style={styles.name}>{employe.prenom} {employe.nom}</Text>
        <View style={styles.chipsRow}>
          <Chip mode="outlined" style={[styles.chip, { borderColor: statusColor }]} textStyle={[styles.chipText, { color: statusColor }]}>
            {getStatutLabel(employe.statut)}
          </Chip>
          <Chip mode="outlined" style={[styles.chip, { borderColor: Colors.primaryFaded }]} textStyle={[styles.chipText, { color: Colors.primaryDark }]}>
            {getCategorieLabel(employe.categorie_emploi)}
          </Chip>
        </View>
        <View style={styles.actionsRow}>
          <SafeButton mode="contained" onPress={() => navigation.navigate('FicheInscription', { id: employeId })}
            style={styles.editBtn}>
            Modifier
          </SafeButton>
          <SafeButton mode="outlined" onPress={handleDownloadFiche} loading={generatingFiche}
            style={styles.editBtn}>
            Fiche papier
          </SafeButton>
          <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={
              <TouchableOpacity style={styles.moreBtn} onPress={() => setMenuVisible(true)}>
                <Icon name="dots-vertical" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            }
          >
            <Menu.Item onPress={() => { setMenuVisible(false); navigation.navigate('ContratsStack', { screen: 'ContratForm', params: { employe_id: employeId } }); }}
              title="Créer un contrat" leadingIcon="file-plus-outline" />
            <Divider />
            <Menu.Item onPress={() => { setMenuVisible(false); handleDelete(); }}
              title="Supprimer" leadingIcon="delete" titleStyle={{ color: Colors.danger }} />
          </Menu>
        </View>
      </View>

      {/* ── Infos personnelles ─────────────────────────── */}
      <Card style={card}>
        <View style={styles.accent} />
        <Card.Content style={styles.cardContent}>
          <Text style={styles.cardTitle}>Informations personnelles</Text>
          <InfoRow icon="calendar" label="Date de naissance" value={`${formatDate(employe.date_naissance)}${age ? ` (${age} ans)` : ''}`} />
          <InfoRow icon="map-marker" label="Lieu de naissance" value={employe.lieu_naissance} />
          <InfoRow icon="phone" label="Téléphone" value={employe.telephone} />
          <InfoRow icon="home" label="Résidence" value={employe.lieu_residence} />
          <InfoRow icon="flag" label="Nationalité" value={employe.nationalite} />
          <InfoRow icon="heart" label="Situation matrimoniale" value={getSituationMatrimonialeLabel(employe.situation_matrimoniale)} />
          <InfoRow icon="cross" label="Religion" value={employe.religion} />
          <InfoRow icon="school" label="Niveau d'étude" value={getNiveauEtudeLabel(employe.niveau_etude)} />
          <InfoRow icon="calendar-plus" label="Date d'inscription" value={formatDate(employe.date_inscription)} style={{ borderBottomWidth: 0 }} />
        </Card.Content>
      </Card>

      {/* ── Parents ────────────────────────────────────── */}
      {employe.parents && employe.parents.length > 0 && (
        <Card style={card}>
          <View style={styles.accent} />
          <Card.Content style={styles.cardContent}>
            <Text style={styles.cardTitle}>Parents</Text>
            {employe.parents.map((parent: any, index: number) => (
              <View key={index} style={styles.subSection}>
                <Text style={styles.subTitle}>{parent.type === 'pere' ? 'Père' : 'Mère'}</Text>
                <Text style={styles.subValue}>{parent.prenom} {parent.nom}</Text>
                {parent.telephone && <View style={styles.contactRow}><Icon name="phone" size={14} color={Colors.iconLight} /><Text style={styles.contactText}>{parent.telephone}</Text></View>}
                {parent.domicile && <View style={styles.contactRow}><Icon name="map-marker" size={14} color={Colors.iconLight} /><Text style={styles.contactText}>{parent.domicile}</Text></View>}
              </View>
            ))}
          </Card.Content>
        </Card>
      )}

      {/* ── Urgences ───────────────────────────────────── */}
      {employe.personnes_urgence && employe.personnes_urgence.length > 0 && (
        <Card style={card}>
          <View style={styles.accent} />
          <Card.Content style={styles.cardContent}>
            <Text style={styles.cardTitle}>Personnes à contacter en cas d'urgence</Text>
            {employe.personnes_urgence.map((personne: any, index: number) => (
              <View key={index} style={styles.subSection}>
                <View style={styles.urgenceHeader}>
                  <Text style={styles.subTitle}>{personne.prenom} {personne.nom}</Text>
                  <Text style={styles.urgenceOrder}>#{index + 1}</Text>
                </View>
                <View style={styles.contactRow}><Icon name="phone" size={14} color={Colors.iconLight} /><Text style={styles.contactText}>{personne.telephone}</Text></View>
              </View>
            ))}
          </Card.Content>
        </Card>
      )}

      {/* ── Expérience ─────────────────────────────────── */}
      <Card style={card}>
        <View style={styles.accent} />
        <Card.Content style={styles.cardContent}>
          <Text style={styles.cardTitle}>Expérience professionnelle</Text>
          <View style={styles.boolRow}>
            <Text style={styles.boolLabel}>A déjà travaillé :</Text>
            <Icon name={employe.a_deja_travaille ? 'check-circle' : 'close-circle'} size={18}
              color={employe.a_deja_travaille ? Colors.success : Colors.danger} />
          </View>
          {employe.experiences && employe.experiences.length > 0 && employe.experiences.map((exp: any, i: number) => (
            <View key={i} style={styles.expItem}>
              <Text style={styles.expCompany}>{exp.entreprise}</Text>
              <Text style={styles.expDetail}>{exp.lieu}{exp.contact ? ` - ${exp.contact}` : ''}</Text>
            </View>
          ))}
          {employe.stages_effectues && <View style={styles.textBlock}><Text style={styles.blockLabel}>Stages effectués :</Text><Text style={styles.blockText}>{employe.stages_effectues}</Text></View>}
          {employe.formations && <View style={styles.textBlock}><Text style={styles.blockLabel}>Formations / Diplômes :</Text><Text style={styles.blockText}>{employe.formations}</Text></View>}
          {employe.motivation && <View style={styles.textBlock}><Text style={styles.blockLabel}>Motivation :</Text><Text style={styles.blockText}>{employe.motivation}</Text></View>}
        </Card.Content>
      </Card>

      {/* ── Documents associés ─────────────────────────── */}
      <Card style={card}>
        <View style={styles.accent} />
        <Card.Content style={styles.cardContent}>
          <View style={styles.docHeader}>
            <Text style={styles.cardTitle}>📎 Documents associés ({documents.length})</Text>
            <TouchableOpacity
              style={styles.docAddBtn}
              onPress={() => setShowDocTypePicker(true)}
              activeOpacity={0.7}
            >
              <Icon name="plus" size={15} color={Colors.primary} />
              <Text style={styles.docAddBtnText}>Ajouter</Text>
            </TouchableOpacity>
          </View>
          {documents.length === 0 ? (
            <Text style={styles.docEmpty}>
              {docsLoading ? 'Chargement…' : "Aucun document associé à cette fiche."}
            </Text>
          ) : (
            <View style={styles.docGrid}>
              {documents.map((d) => (
                <View key={d.id} style={styles.docTile}>
                  {d.imageUrl ? (
                    <Image source={{ uri: d.imageUrl }} style={styles.docThumb} resizeMode="cover" />
                  ) : (
                    <View style={styles.docThumbPlaceholder}>
                      <Text style={{ fontSize: 26 }}>{getDocumentTypeIcon(d.type)}</Text>
                    </View>
                  )}
                  <Text style={styles.docTileLabel} numberOfLines={1}>
                    {getDocumentTypeLabel(d.type)}
                  </Text>
                  <TouchableOpacity
                    style={styles.docTileRemove}
                    onPress={() => removeDocument(d.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Icon name="close" size={14} color="#b85454" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </Card.Content>
      </Card>

      {/* ── Contrats ────────────────────────────────────── */}
      {contrats.length > 0 && (
        <Card style={card}>
          <View style={styles.accent} />
          <Card.Content style={styles.cardContent}>
            <Text style={styles.cardTitle}>Historique des contrats ({contrats.length})</Text>
            {contrats.map((contrat: any) => (
              <TouchableOpacity key={contrat.id}
                onPress={() => rootNavigation?.navigate('ContratDocumentModal', { id: contrat.id, origin: { label: 'Employé' } })}
                style={styles.contratItem}>
                <View style={styles.contratHeader}>
                  <Text style={styles.contratNumero}>{contrat.numero_dossier}</Text>
                  <Chip mode="outlined" style={[styles.miniChip, { borderColor: getStatutColor(contrat.statut) }]}
                    textStyle={{ fontSize: 10, color: getStatutColor(contrat.statut) }}>
                    {getStatutLabel(contrat.statut)}
                  </Chip>
                </View>
                <TouchableOpacity onPress={() => rootNavigation?.navigate('EmployeursStack' as any, {
                  screen: 'EmployeurDetail',
                  params: { id: contrat.employeur_id || contrat.expand?.employeur_id?.id }
                })}>
                  <Text style={styles.contratCompany}>{contrat.nom_complet}</Text>
                </TouchableOpacity>
                <Text style={styles.contratDates}>{formatDate(contrat.date_debut) || '-'} → {formatDateOr(contrat.date_fin, 'En cours')}</Text>
              </TouchableOpacity>
            ))}
          </Card.Content>
        </Card>
      )}

      {/* ── Historique des actions ── */}
      {history.length > 0 && (
        <Card style={card}>
          <View style={[styles.accent, { backgroundColor: Colors.info }]} />
          <Card.Content style={styles.cardContent}>
            <Text style={styles.cardTitle}>Historique</Text>
            {history.map((h: any) => (
              <View key={h.id} style={styles.historyItem}>
                <View style={styles.historyIcon}>
                  <Icon name="history" size={14} color={Colors.textSecondary} />
                </View>
                <View style={styles.historyContent}>
                  <Text style={styles.historyText}>{h.description}</Text>
                  <Text style={styles.historyTime}>{h.user_display} • {formatDate(h.created)}</Text>
                </View>
              </View>
            ))}
          </Card.Content>
        </Card>
      )}

      <View style={{ height: Spacing.xxl }} />
    </ScrollView>

    {/* ── Modale : choix du type de document (étape 1) ── */}
    <Modal
      visible={showDocTypePicker}
      transparent
      animationType="slide"
      onRequestClose={() => setShowDocTypePicker(false)}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.sourceSheet}>
          <Text style={styles.sourceTitle}>De quoi s'agit-il ?</Text>
          <Text style={styles.sourceSubtitle}>Choisissez le type de document à ajouter</Text>
          {DOCUMENT_TYPES.map((t) => (
            <TouchableOpacity
              key={t.value}
              style={styles.docTypeItem}
              onPress={() => pickDocType(t.value)}
              activeOpacity={0.7}
            >
              <Text style={styles.docTypeIcon}>{t.icon}</Text>
              <Text style={styles.sourceLabel}>{t.label}</Text>
              <Icon name="chevron-right" size={20} color="#ccc" />
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.sourceItem, styles.sourceCancel]}
            onPress={() => setShowDocTypePicker(false)}
          >
            <Text style={[styles.sourceLabel, { color: '#999' }]}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>

    {/* ── Modale : source du document (étape 2) ── */}
    <Modal
      visible={showDocSourcePicker}
      transparent
      animationType="slide"
      onRequestClose={() => {
        setShowDocSourcePicker(false);
        setDocTypePending(null);
      }}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.sourceSheet}>
          <Text style={styles.sourceTitle}>
            {docTypePending ? getDocumentTypeIcon(docTypePending) + ' ' + getDocumentTypeLabel(docTypePending) : 'Document'}
          </Text>
          <Text style={styles.sourceSubtitle}>Galerie ou appareil photo</Text>
          <TouchableOpacity
            style={styles.sourceItem}
            onPress={async () => {
              setShowDocSourcePicker(false);
              const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (status !== 'granted') {
                Alert.alert('Permission refusée', "Autorisez l'accès à la galerie dans les réglages de l'app.");
                setDocTypePending(null);
                return;
              }
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.85,
              });
              if (!result.canceled && result.assets[0]) {
                uploadPendingDocument(result.assets[0].uri);
              } else {
                setDocTypePending(null);
              }
            }}
          >
            <Icon name="image-multiple-outline" size={22} color={Colors.primary} />
            <Text style={styles.sourceLabel}>Choisir dans la galerie</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.sourceItem}
            onPress={async () => {
              setShowDocSourcePicker(false);
              const { status } = await ImagePicker.requestCameraPermissionsAsync();
              if (status !== 'granted') {
                Alert.alert('Permission refusée', "Autorisez l'accès à l'appareil photo dans les réglages de l'app.");
                setDocTypePending(null);
                return;
              }
              const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.85,
              });
              if (!result.canceled && result.assets[0]) {
                uploadPendingDocument(result.assets[0].uri);
              } else {
                setDocTypePending(null);
              }
            }}
          >
            <Icon name="camera-outline" size={22} color={Colors.primary} />
            <Text style={styles.sourceLabel}>Prendre une photo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sourceItem, styles.sourceCancel]}
            onPress={() => {
              setShowDocSourcePicker(false);
              setDocTypePending(null);
            }}
          >
            <Text style={[styles.sourceLabel, { color: '#999' }]}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
    </>
  );
}

const header: ViewStyle = { alignItems: 'center', padding: Spacing.xl, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border, ...Shadows.soft };
const card: ViewStyle = { marginHorizontal: Spacing.lg, marginTop: Spacing.lg, backgroundColor: Colors.surface, borderRadius: Radius.md, overflow: 'hidden', ...Shadows.card };

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingBottom: Spacing.xxl },
  // ── Entête ────────────────────────────────────────────
  header: header,
  avatar: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md },
  avatarText: { fontSize: 28, fontWeight: '700' },
  name: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.md },
  chipsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg, flexWrap: 'wrap', justifyContent: 'center' },
  chip: { height: 28 },
  chipText: { fontSize: 12, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, width: '100%' },
  editBtn: { flex: 1, borderRadius: Radius.sm },
  editBtnContent: { height: 40 },
  moreBtn: { padding: Spacing.sm },
  // ── Cartes ────────────────────────────────────────────
  card: card,
  accent: { height: 3, backgroundColor: Colors.primary },
  cardContent: { padding: Spacing.lg },
  cardTitle: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary, marginBottom: Spacing.md },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, gap: Spacing.sm },
  infoIcon: { width: 24, textAlign: 'center' },
  infoLabel: { flex: 1, fontSize: 13, color: Colors.textSecondary },
  infoValue: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, textAlign: 'right', maxWidth: '50%' },
  // ── Sous-sections ─────────────────────────────────────
  subSection: { marginBottom: Spacing.md },
  subTitle: { fontSize: 14, fontWeight: '600', color: Colors.primary, marginBottom: 2 },
  subValue: { fontSize: 14, color: Colors.textPrimary },
  contactRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.xs, gap: Spacing.sm },
  contactText: { fontSize: 13, color: Colors.textSecondary },
  urgenceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs },
  urgenceOrder: { fontSize: 12, color: Colors.textTertiary },
  boolRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  boolLabel: { fontSize: 14, color: Colors.textSecondary },
  expItem: { paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  expCompany: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  expDetail: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  textBlock: { marginTop: Spacing.md },
  blockLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 4 },
  blockText: { fontSize: 14, color: Colors.textPrimary, lineHeight: 20 },
  // ── Contrats ──────────────────────────────────────────
  contratItem: { paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  contratHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  contratNumero: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  miniChip: { height: 22 },
  contratCompany: { fontSize: 13, color: Colors.primary, marginTop: 2, textDecorationLine: 'underline' },
  contratDates: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  // ── Historique ───────────────────────────────────────
  historyItem: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  historyIcon: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  historyContent: { flex: 1 },
  historyText: { fontSize: 13, color: Colors.textPrimary, fontWeight: '500' },
  historyTime: { fontSize: 11, color: Colors.textTertiary, marginTop: 2 },
  // ── Documents associés ──────────────────────────────
  docHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  docAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: Colors.primary, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: Colors.primary + '0d' },
  docAddBtnText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  docEmpty: { fontSize: 13, color: Colors.textSecondary, fontStyle: 'italic' },
  docGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  docTile: { width: '30%', alignItems: 'center', marginBottom: Spacing.md },
  docThumb: { width: '100%', aspectRatio: 0.75, borderRadius: Radius.sm, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.borderLight },
  docThumbPlaceholder: { width: '100%', aspectRatio: 0.75, borderRadius: Radius.sm, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.borderLight, alignItems: 'center', justifyContent: 'center' },
  docTileLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 4, textAlign: 'center' },
  docTileRemove: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: '#FDECEC', alignItems: 'center', justifyContent: 'center' },
  // ── Modales documents ───────────────────────────────
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sourceSheet: { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, padding: Spacing.lg, paddingBottom: Spacing.xxl, maxHeight: '75%' },
  sourceTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.sm },
  sourceSubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: -4, marginBottom: Spacing.md },
  sourceItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  sourceLabel: { fontSize: 16, color: Colors.textPrimary, flex: 1 },
  sourceCancel: { borderBottomWidth: 0, justifyContent: 'center' },
  docTypeItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  docTypeIcon: { fontSize: 22 },
});
