import React, { useState, useCallback } from 'react';
import type { EmployeurDetailNavigationProp } from '../types/navigation';

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  Modal,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';;
import { Card, Chip, Divider, Menu } from 'react-native-paper';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import AppHeader from '../components/AppHeader';
import { backFromDetail } from '../utils/detailBack';
import {
  getEmployeurById,
  deleteEmployeur,
  getContratsByEmployeur,
  getDocumentsByEmployeur,
  uploadEmployeurDocument,
  deleteDocument,
  getDocumentTypeLabel,
  getDocumentTypeIcon,
  DOCUMENT_TYPES,
  getEntityHistory,
} from '../database/service';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import SafeButton from '../components/SafeButton';
import {
  formatDate,
  formatDateOr,
  formatMoney,
  getStatutColor,
  getStatutLabel,
} from '../utils/constants';
import { Colors, Spacing, Radius, Shadows } from '../theme';
import { DocumentViewerOverlay, useDocumentViewer } from '../components/DocumentViewer';

const InfoRow = ({ icon, label, value, style }: { icon: string; label: string; value: string; style?: ViewStyle }) => (
  <View style={[styles.infoRow, style]}>
    <Icon name={icon} size={17} color={Colors.iconLight} style={styles.infoIcon} />
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue} numberOfLines={2}>{value || '-'}</Text>
  </View>
);

const typeLabel = (t?: string) =>
  t === 'entreprise' ? 'Entreprise' : t === 'commerce' ? 'Commerce' : 'Particulier';
const typeIcon = (t?: string) => (t === 'particulier' ? '🏠' : '🏢');
const nomCompletLabel = (t?: string) =>
  t === 'entreprise' ? 'Raison sociale' : t === 'commerce' ? 'Nom du commerce' : 'Nom complet';

export default function EmployeurDetailScreen() {
  const navigation = useNavigation<EmployeurDetailNavigationProp>();
  const route = useRoute<any>();
  const rootNavigation = navigation.getParent()?.getParent();
  const employeurId = route.params?.id;
  const origin = route.params?.origin;
  const [employeur, setEmployeur] = useState<any>(null);
  const [contrats, setContrats] = useState<any[]>([]);
  const [menuVisible, setMenuVisible] = useState(false);
  const [documents, setDocuments] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  // Chromebook/large : cartes en groupe centré de 2 colonnes
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const [showDocTypePicker, setShowDocTypePicker] = useState(false);
  const [showDocSourcePicker, setShowDocSourcePicker] = useState(false);
  const [docTypePending, setDocTypePending] = useState<string | null>(null);
  const [docsLoading, setDocsLoading] = useState(false);
  const docViewer = useDocumentViewer();

  const openViewerFor = (d: any) => {
    const uri = d?.imageUrl;
    if (!uri) return;
    docViewer.open({ uri, label: getDocumentTypeLabel(d.type), fileName: d?.nomFichier || d?.file || null, mimeType: d?.mimeType || null });
  };

  const handleDownloadDoc = async (d: any) => {
    const uri = d?.imageUrl;
    if (!uri) { Alert.alert('Document', 'Aucun fichier à télécharger.'); return; }
    try {
      const name = d?.nomFichier || d?.file || `document_${d.id || Date.now()}`;
      let localUri = uri;
      if (/^https?:\/\//i.test(uri)) {
        const safe = String(name).replace(/[^a-zA-Z0-9._-]/g, '_');
        const tmp = (FileSystem as any).cacheDirectory + safe;
        const dl = await (FileSystem as any).downloadAsync(uri, tmp);
        localUri = dl.uri;
      }
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) await Sharing.shareAsync(localUri, { dialogTitle: getDocumentTypeLabel(d.type) });
      else Alert.alert('Document', localUri);
    } catch (e: any) {
      Alert.alert('Téléchargement', e?.message || 'Impossible de télécharger.');
    }
  };

  const loadEmployeur = async () => {
    try {
      const data = await getEmployeurById(employeurId);
      setEmployeur(data);
      if (data?.nom_complet) {
        navigation.setOptions({ title: data.nom_complet });
      }
      const contratsData = await getContratsByEmployeur(employeurId);
      setContrats(contratsData || []);
      const docsData = await getDocumentsByEmployeur(employeurId);
      setDocuments(docsData || []);

      const hist = await getEntityHistory('employeur', employeurId);
      setHistory(hist || []);
    } catch (error) {
      console.error('Error loading employeur:', error);
    }
  };

  useFocusEffect(useCallback(() => { loadEmployeur(); }, [employeurId]));

  // ── Documents associés ─────────────────────────────────
  const pickDocType = (type: string) => {
    setDocTypePending(type);
    setShowDocTypePicker(false);
    setShowDocSourcePicker(true);
  };

  const uploadPendingDocument = async (imageUri: string, fileName?: string, mimeType?: string) => {
    if (!employeurId || !docTypePending) return;
    const captured = docTypePending;
    setDocsLoading(true);
    try {
      const docId = await uploadEmployeurDocument(employeurId, captured, imageUri, fileName, mimeType);
      if (docId) {
        const docs = await getDocumentsByEmployeur(employeurId);
        setDocuments(docs || []);
      } else {
        Alert.alert('Erreur', "Échec de l'ajout du document.");
      }
    } catch (e) {
      console.warn('uploadEmployeurDocument error:', e);
      Alert.alert('Erreur', "Échec de l'ajout du document.");
    } finally {
      setDocTypePending(null);
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
          const docs = await getDocumentsByEmployeur(employeurId);
          setDocuments(docs || []);
        },
      },
    ]);
  };

  const headerTitle = employeur?.nom_complet || 'Employeur';

  const handleDelete = () => {
    Alert.alert('Confirmer la suppression', 'Êtes-vous sûr de vouloir supprimer cet employeur ? Cette action est irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          try {
            await deleteEmployeur(employeurId);
            navigation.goBack();
          } catch (error) {
            console.error('Error deleting employeur:', error);
            Alert.alert('Erreur', 'Une erreur est survenue lors de la suppression');
          }
        },
      },
    ]);
  };

  if (!employeur) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={{ color: Colors.textSecondary }}>Chargement...</Text>
      </View>
    );
  }

  const contactName = `${employeur.prenom_contact || ''} ${employeur.nom_contact || ''}`.trim();
  const ville = employeur.ville || '';
  const adresse = [employeur.adresse, ville].filter(Boolean).join(' — ');

  return (
    <>
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* ── Header ─────────────────────────────────────── */}
      <AppHeader title={headerTitle} showBack onBack={() => backFromDetail(navigation, origin)} />
      {/* ── Entête ─────────────────────────────────────── */}
      <View style={header}>
        <View style={styles.avatar}>
          <Text style={{ fontSize: 38 }}>{typeIcon(employeur.type_besoin)}</Text>
        </View>
        <Text style={styles.name}>{employeur.nom_complet}</Text>
        <View style={styles.chipsRow}>
          <Chip mode="outlined" style={[styles.chip, { borderColor: Colors.primaryFaded }]} textStyle={[styles.chipText, { color: Colors.primaryDark }]}>
            {typeLabel(employeur.type_besoin)}
          </Chip>
          <Chip mode="outlined" style={[styles.chip, { borderColor: Colors.primaryFaded }]} textStyle={[styles.chipText, { color: Colors.primaryDark }]}>
            {contrats.length} contrat{contrats.length > 1 ? 's' : ''}
          </Chip>
        </View>
        <View style={styles.actionsRow}>
          <SafeButton mode="contained" onPress={() => (navigation as any).navigate('EmployeurForm', { id: employeurId })}
            style={styles.editBtn}>
            Modifier
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
            <Menu.Item onPress={() => { setMenuVisible(false); rootNavigation?.navigate('ContratDocumentModal', {} as any); }}
              title="Créer un contrat" leadingIcon="file-plus-outline" />
            <Divider />
            <Menu.Item onPress={() => { setMenuVisible(false); handleDelete(); }}
              title="Supprimer" leadingIcon="delete" titleStyle={{ color: Colors.danger }} />
          </Menu>
        </View>
      </View>

      {/* ── Informations ───────────────────────────────── */}
      <View style={wide ? styles.detailGridWide : undefined}>
      <Card style={[card, wide && styles.detailGridItem]}>
        <View style={styles.accent} />
        <Card.Content style={styles.cardContent}>
          <Text style={styles.cardTitle}>Informations</Text>
          <InfoRow icon="domain" label={nomCompletLabel(employeur.type_besoin)} value={employeur.nom_complet} />
          <InfoRow icon="tag" label="Type" value={typeLabel(employeur.type_besoin)} />
          <InfoRow icon="phone" label="Téléphone" value={employeur.telephone} />
          <InfoRow icon="email" label="Email" value={employeur.email} />
          <InfoRow icon="map-marker" label="Adresse" value={adresse} />
          {contactName ? (
            <InfoRow icon="account" label={`Contact${employeur.fonction_contact ? ` (${employeur.fonction_contact})` : ''}`} value={contactName} />
          ) : null}
          {employeur.notes ? (
            <View style={styles.textBlock}><Text style={styles.blockLabel}>Notes :</Text><Text style={styles.blockText}>{employeur.notes}</Text></View>
          ) : null}
          <InfoRow icon="calendar-plus" label="Enregistré le" value={formatDate(employeur.date_enregistrement)} style={{ borderBottomWidth: 0 }} />
        </Card.Content>
      </Card>

      {/* ── Documents associés ─────────────────────────── */}
      <Card style={[card, wide && styles.detailGridItem]}>
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
              {docsLoading ? 'Chargement…' : "Aucun document associé à cet employeur."}
            </Text>
          ) : (
            <View style={styles.docGrid}>
              {documents.map((d) => (
                <TouchableOpacity key={d.id} style={styles.docTile} onPress={() => openViewerFor(d)} activeOpacity={0.78} disabled={!d.imageUrl}>
                  {d.imageUrl ? (
                    /\.(pdf|doc|docx)$/i.test(d.nomFichier || d.file || '') ? (
                      <View style={styles.docThumbPlaceholder}>
                        <Icon name={/\.pdf$/i.test(d.nomFichier || d.file || '') ? 'file-pdf-box' : 'file-word-outline'} size={30} color={Colors.primary} />
                      </View>
                    ) : (
                      <Image source={{ uri: d.imageUrl }} style={styles.docThumb} resizeMode="cover" />
                    )
                  ) : (
                    <View style={styles.docThumbPlaceholder}>
                      <Text style={{ fontSize: 26 }}>{getDocumentTypeIcon(d.type)}</Text>
                    </View>
                  )}
                  <Text style={styles.docTileLabel} numberOfLines={1}>
                    {getDocumentTypeLabel(d.type)}
                  </Text>
                  {d.imageUrl ? (
                    <TouchableOpacity
                      style={styles.docTileDownload}
                      onPress={() => handleDownloadDoc(d)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Icon name="download-outline" size={13} color={Colors.primary} />
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    style={styles.docTileRemove}
                    onPress={() => removeDocument(d.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Icon name="close" size={14} color="#b85454" />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Card.Content>
      </Card>

      {/* ── Contrats liés ──────────────────────────────── */}
      {contrats.length > 0 && (
        <Card style={[card, wide && styles.detailGridItem]}>
          <View style={styles.accent} />
          <Card.Content style={styles.cardContent}>
            <Text style={styles.cardTitle}>Contrats liés ({contrats.length})</Text>
            {contrats.map((contrat: any) => (
              <TouchableOpacity key={contrat.id}
                onPress={() => (navigation as any).navigate('ContratDetail', { id: contrat.id, ...(origin ? { origin } : {}) })}
                style={styles.contratItem}>
                <View style={styles.contratHeader}>
                  <Text style={styles.contratNumero}>{contrat.numero_dossier || `Contrat ${contrat.id}`}</Text>
                  <Chip mode="outlined" style={[styles.miniChip, { borderColor: getStatutColor(contrat.statut) }]}
                    textStyle={{ fontSize: 10, color: getStatutColor(contrat.statut) }}>
                    {getStatutLabel(contrat.statut)}
                  </Chip>
                </View>
                {contrat.poste ? (
                  <Text style={styles.contratCompany}>{contrat.poste}</Text>
                ) : null}
                <Text style={styles.contratDates}>{formatDate(contrat.date_debut) || '-'} → {formatDateOr(contrat.date_fin, 'En cours')}</Text>
                {contrat.commission_agence > 0 ? (
                  <Text style={styles.contratDates}>💰 {formatMoney(contrat.commission_agence)}</Text>
                ) : null}
              </TouchableOpacity>
            ))}
          </Card.Content>
        </Card>
      )}

      {/* ── Historique des actions ── */}
      {history.length > 0 && (
        <Card style={[card, wide && styles.detailGridItem]}>
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
      </View>

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
          <Text style={styles.sourceSubtitle}>Photo, PDF ou document Word</Text>
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
                mediaTypes: 'images',
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
                mediaTypes: 'images',
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
            style={styles.sourceItem}
            onPress={async () => {
              setShowDocSourcePicker(false);
              try {
                const doc = await DocumentPicker.getDocumentAsync({
                  type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
                  copyToCacheDirectory: true,
                });
                if (!doc.canceled && doc.assets && doc.assets[0]) {
                  await uploadPendingDocument(doc.assets[0].uri, doc.assets[0].name, doc.assets[0].mimeType);
                } else {
                  setDocTypePending(null);
                }
              } catch (e: any) {
                Alert.alert('Erreur', e?.message || "Impossible d'ouvrir le document.");
                setDocTypePending(null);
              }
            }}
          >
            <Icon name="file-document-outline" size={22} color={Colors.primary} />
            <Text style={styles.sourceLabel}>PDF / Word (document numérique)</Text>
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
    <DocumentViewerOverlay viewerDoc={docViewer.doc} onClose={docViewer.close} onDownload={docViewer.download} downloading={docViewer.downloading} />
    </>
  );
}

const header: ViewStyle = { alignItems: 'center', padding: Spacing.xl, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border, ...Shadows.soft };
const card: ViewStyle = { marginHorizontal: Spacing.lg, marginTop: Spacing.lg, backgroundColor: Colors.surface, borderRadius: Radius.md, overflow: 'hidden', ...Shadows.card };

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingBottom: Spacing.xxl, width: '100%', maxWidth: 1100, alignSelf: 'center' },
  // ── Entête ────────────────────────────────────────────
  header: header,
  avatar: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md, backgroundColor: Colors.primaryDim },
  name: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.md, textAlign: 'center' },
  chipsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg, flexWrap: 'wrap', justifyContent: 'center' },
  chip: { height: 28 },
  chipText: { fontSize: 12, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, width: '100%' },
  editBtn: { flex: 1, borderRadius: Radius.sm },
  moreBtn: { padding: Spacing.sm },
  // ── Cartes ────────────────────────────────────────────
  card: card,
  // Chromebook/large : cartes en groupe centré de 2 colonnes
  detailGridWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    justifyContent: 'center',
  },
  detailGridItem: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 420,
    maxWidth: 542,
  },
  accent: { height: 3, backgroundColor: Colors.primary },
  cardContent: { padding: Spacing.lg },
  cardTitle: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary, marginBottom: Spacing.md },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, gap: Spacing.sm },
  infoIcon: { width: 24, textAlign: 'center' },
  infoLabel: { flex: 1, fontSize: 13, color: Colors.textSecondary },
  infoValue: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, textAlign: 'right', maxWidth: '50%' },
  textBlock: { marginTop: Spacing.md },
  blockLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 4 },
  blockText: { fontSize: 14, color: Colors.textPrimary, lineHeight: 20 },
  // ── Contrats ──────────────────────────────────────────
  contratItem: { paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  contratHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  contratNumero: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  miniChip: { height: 22 },
  contratCompany: { fontSize: 13, color: Colors.primary, marginTop: 2 },
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
  docTileDownload: { position: 'absolute', top: 4, left: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: Colors.primary + '30', alignItems: 'center', justifyContent: 'center' },
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
