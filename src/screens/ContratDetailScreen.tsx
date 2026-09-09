import React, { useState, useCallback } from 'react';
import type { ContratDetailNavigationProp } from '../types/navigation';

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  Modal,
  Platform,
  ViewStyle,
} from 'react-native';;
import { Card, Chip } from 'react-native-paper';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import AppHeader from '../components/AppHeader';
import { backFromDetail } from '../utils/detailBack';
import {
  getContratById,
  getEmployeById,
  getEmployeurById,
  getDocumentsByContrat,
  getScans,
  uploadContratDocument,
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
  daysRemaining,
} from '../utils/constants';
import { Colors, Spacing, Radius, Shadows } from '../theme';
import { DocumentViewerOverlay, useDocumentViewer } from '../components/DocumentViewer';
import { printToFileAsync } from 'expo-print';
import { buildContratHtml } from '../utils/contratPrint';
import { shareBase64File } from '../utils/shareFile';

const InfoRow = ({ icon, label, value, style }: { icon: string; label: string; value: string; style?: ViewStyle }) => (
  <View style={[styles.infoRow, style]}>
    <Icon name={icon} size={17} color={Colors.iconLight} style={styles.infoIcon} />
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue} numberOfLines={2}>{value || '-'}</Text>
  </View>
);

export default function ContratDetailScreen() {
  const navigation = useNavigation<ContratDetailNavigationProp>();
  const route = useRoute<any>();
  const rootNavigation = navigation.getParent()?.getParent();
  const contratId = route.params?.id;
  const origin = route.params?.origin;
  const [contrat, setContrat] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [scanPages, setScanPages] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
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

  const handlePrintContrat = async () => {
    if (!contrat) return;
    try {
      const [employe, employeur] = await Promise.all([
        contrat.employe_id ? getEmployeById(contrat.employe_id).catch(() => null) : Promise.resolve(null),
        contrat.employeur_id ? getEmployeurById(contrat.employeur_id).catch(() => null) : Promise.resolve(null),
      ]);
      const html = buildContratHtml({ contrat, employe: employe || undefined, employeur: employeur || undefined });
      if (Platform.OS === 'web') {
        const w = window.open('', '_blank');
        if (w) { w.document.write(html); w.document.close(); w.print(); }
        return;
      }
      const { base64 } = await printToFileAsync({ html, base64: true });
      const numero = String(contrat.numero_dossier || contratId || Date.now()).replace(/[^a-zA-Z0-9._-]/g, '_');
      await shareBase64File(base64 || '', `contrat_${numero}.pdf`, 'Contrat de prestation', 'application/pdf');
    } catch (e: any) {
      Alert.alert('Téléchargement', e?.message || 'Impossible de générer le PDF.');
    }
  };

  const openScanViewer = (page: any, idx: number) => {
    const uri = page?.imageUrl;
    if (!uri) return;
    docViewer.open({ uri, label: `Contrat signé — page ${idx + 1}`, fileName: null, mimeType: null });
  };

  const handleDownloadScan = async (page: any, idx: number) => {
    const uri = page?.imageUrl;
    if (!uri) { Alert.alert('Document', 'Aucun fichier à télécharger.'); return; }
    try {
      let localUri = uri;
      if (/^https?:\/\//i.test(uri)) {
        const tmp = (FileSystem as any).cacheDirectory + `contrat_signe_p${idx + 1}.jpg`;
        const dl = await (FileSystem as any).downloadAsync(uri, tmp);
        localUri = dl.uri;
      }
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) await Sharing.shareAsync(localUri, { dialogTitle: `Contrat signé — page ${idx + 1}` });
      else Alert.alert('Document', localUri);
    } catch (e: any) {
      Alert.alert('Téléchargement', e?.message || 'Impossible de télécharger.');
    }
  };

  const loadContrat = async () => {
    try {
      const data = await getContratById(contratId);
      setContrat(data);
      if (data?.numero_dossier) {
        navigation.setOptions({ title: data.numero_dossier });
      }
      const docsData = await getDocumentsByContrat(contratId);
      setDocuments(docsData || []);

      const pages = await getScans('contrat', contratId).catch(() => []);
      setScanPages(pages || []);

      const hist = await getEntityHistory('contrat', contratId);
      setHistory(hist || []);
    } catch (error) {
      console.error('Error loading contrat:', error);
    }
  };

  useFocusEffect(useCallback(() => { loadContrat(); }, [contratId]));

  // ── Documents associés ─────────────────────────────────
  const pickDocType = (type: string) => {
    setDocTypePending(type);
    setShowDocTypePicker(false);
    setShowDocSourcePicker(true);
  };

  const uploadPendingDocument = async (imageUri: string, fileName?: string, mimeType?: string) => {
    if (!contratId || !docTypePending) return;
    const captured = docTypePending;
    setDocsLoading(true);
    try {
      const docId = await uploadContratDocument(contratId, captured, imageUri, fileName, mimeType);
      if (docId) {
        const docs = await getDocumentsByContrat(contratId);
        setDocuments(docs || []);
      } else {
        Alert.alert('Erreur', "Échec de l'ajout du document.");
      }
    } catch (e) {
      console.warn('uploadContratDocument error:', e);
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
          const docs = await getDocumentsByContrat(contratId);
          setDocuments(docs || []);
        },
      },
    ]);
  };

  if (!contrat) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={{ color: Colors.textSecondary }}>Chargement...</Text>
      </View>
    );
  }

  const headerTitle = contrat.numero_dossier || 'Contrat';
  const remaining = daysRemaining(contrat.date_fin);
  const employeName = `${contrat.employe_prenom || ''} ${contrat.employe_nom || ''}`.trim() || '-';
  const statusColor = getStatutColor(contrat.statut);

  return (
    <>
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* ── Header ─────────────────────────────────────── */}
      <AppHeader title={headerTitle} showBack onBack={() => backFromDetail(navigation, origin)} />
      {/* ── Entête ─────────────────────────────────────── */}
      <View style={header}>
        <View style={styles.avatar}>
          <Text style={{ fontSize: 38 }}>📄</Text>
        </View>
        <Text style={styles.name}>{contrat.numero_dossier || `Contrat ${contrat.id}`}</Text>
        <View style={styles.chipsRow}>
          <Chip mode="outlined" style={[styles.chip, { borderColor: statusColor }]} textStyle={[styles.chipText, { color: statusColor }]}>
            {getStatutLabel(contrat.statut)}
          </Chip>
          {contrat.type_contrat ? (
            <Chip mode="outlined" style={[styles.chip, { borderColor: Colors.primaryFaded }]} textStyle={[styles.chipText, { color: Colors.primaryDark }]}>
              {contrat.type_contrat}
            </Chip>
          ) : null}
          {remaining !== null && contrat.statut === 'en_cours' ? (
            <Chip mode="outlined" style={[styles.chip, { borderColor: Colors.primaryFaded }]} textStyle={[styles.chipText, { color: Colors.primaryDark }]}>
              {remaining >= 0 ? `Fin dans ${remaining}j` : `Terminé depuis ${-remaining}j`}
            </Chip>
          ) : null}
        </View>
        <View style={styles.actionsRow}>
          <SafeButton mode="contained" onPress={() => rootNavigation?.navigate('ContratDocumentModal', { id: contratId })}
            style={styles.editBtn}>
            Modifier
          </SafeButton>
          <SafeButton mode="outlined" onPress={handlePrintContrat} style={styles.editBtn}>
            <Icon name="file-pdf-box" size={18} color={Colors.primary} />
            <Text style={{ color: Colors.primary, fontWeight: '600', marginLeft: 6 }}>PDF</Text>
          </SafeButton>
        </View>
      </View>

      {/* ── Dossier ────────────────────────────────────── */}
      <Card style={card}>
        <View style={styles.accent} />
        <Card.Content style={styles.cardContent}>
          <Text style={styles.cardTitle}>Dossier</Text>
          <InfoRow icon="file-document" label="N° dossier" value={contrat.numero_dossier} />
          <InfoRow icon="tag" label="Statut" value={getStatutLabel(contrat.statut)} />
          {contrat.type_contrat ? (
            <InfoRow icon="briefcase" label="Type de contrat" value={contrat.type_contrat} />
          ) : null}
          {contrat.poste ? (
            <InfoRow icon="account-tie" label="Poste" value={contrat.poste} />
          ) : null}
          <InfoRow icon="calendar" label="Date du contrat" value={formatDate(contrat.date_contrat)} />
          <InfoRow icon="calendar-start" label="Début" value={formatDate(contrat.date_debut)} />
          <InfoRow icon="calendar-end" label="Fin" value={formatDateOr(contrat.date_fin, 'En cours')} />
          {contrat.salaire > 0 ? (
            <InfoRow icon="cash" label="Salaire" value={formatMoney(contrat.salaire)} />
          ) : null}
          {contrat.commission_agence > 0 ? (
            <InfoRow icon="percent" label="Commission agence" value={formatMoney(contrat.commission_agence)} style={{ borderBottomWidth: 0 }} />
          ) : null}
        </Card.Content>
      </Card>

      {/* ── Version signée (scan lié à la fiche numérique) ── */}
      <Card style={card}>
        <View style={styles.accent} />
        <Card.Content style={styles.cardContent}>
          <Text style={styles.cardTitle}>Contrat signé</Text>
          {scanPages.length === 0 ? (
            <Text style={{ color: Colors.textSecondary, fontSize: 13 }}>
              Pas encore de version signée. Imprimez le PDF (bouton PDF ci-dessus), faites signer, puis scannez depuis Modifier &gt; onglet Scanné.
            </Text>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {scanPages.map((page: any, idx: number) => (
                <View key={page.id || idx} style={{ width: 96 }}>
                  <TouchableOpacity onPress={() => openScanViewer(page, idx)}>
                    {page.imageUrl ? (
                      <Image source={{ uri: page.imageUrl }} style={{ width: 96, height: 128, borderRadius: 8, backgroundColor: Colors.borderLight }} resizeMode="cover" />
                    ) : (
                      <View style={{ width: 96, height: 128, borderRadius: 8, backgroundColor: Colors.borderLight, alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="file-image-outline" size={28} color={Colors.textSecondary} />
                      </View>
                    )}
                  </TouchableOpacity>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                    <Text style={{ fontSize: 11, color: Colors.textSecondary }}>Page {idx + 1}</Text>
                    <TouchableOpacity onPress={() => handleDownloadScan(page, idx)} hitSlop={8}>
                      <Icon name="download-outline" size={16} color={Colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </Card.Content>
      </Card>

      {/* ── Employé ────────────────────────────────────── */}
      <Card style={card}>
        <View style={styles.accent} />
        <Card.Content style={styles.cardContent}>
          <Text style={styles.cardTitle}>Employé</Text>
          <TouchableOpacity
            onPress={() => contrat.employe_id && (navigation as any).navigate('EmployeDetail', { id: contrat.employe_id, ...(origin ? { origin } : {}) })}
            disabled={!contrat.employe_id}
            activeOpacity={0.7}
          >
            <Text style={[styles.linkName, !contrat.employe_id && { color: Colors.textSecondary, textDecorationLine: 'none' }]}>
              {employeName}
            </Text>
          </TouchableOpacity>
          {contrat.employe_telephone ? (
            <View style={styles.contactRow}><Icon name="phone" size={14} color={Colors.iconLight} /><Text style={styles.contactText}>{contrat.employe_telephone}</Text></View>
          ) : null}
        </Card.Content>
      </Card>

      {/* ── Employeur ──────────────────────────────────── */}
      <Card style={card}>
        <View style={styles.accent} />
        <Card.Content style={styles.cardContent}>
          <Text style={styles.cardTitle}>Employeur</Text>
          <TouchableOpacity
            onPress={() => contrat.employeur_id && (navigation as any).navigate('EmployeurDetail', { id: contrat.employeur_id, ...(origin ? { origin } : {}) })}
            disabled={!contrat.employeur_id}
            activeOpacity={0.7}
          >
            <Text style={[styles.linkName, !contrat.employeur_id && { color: Colors.textSecondary, textDecorationLine: 'none' }]}>
              {contrat.nom_complet || '-'}
            </Text>
          </TouchableOpacity>
          {contrat.employeur_adresse ? (
            <View style={styles.contactRow}><Icon name="map-marker" size={14} color={Colors.iconLight} /><Text style={styles.contactText}>{contrat.employeur_adresse}</Text></View>
          ) : null}
          {contrat.employeur_telephone ? (
            <View style={styles.contactRow}><Icon name="phone" size={14} color={Colors.iconLight} /><Text style={styles.contactText}>{contrat.employeur_telephone}</Text></View>
          ) : null}
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
              {docsLoading ? 'Chargement…' : "Aucun document associé à ce contrat."}
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
  scrollContent: { paddingBottom: Spacing.xxl },
  // ── Entête ────────────────────────────────────────────
  header: header,
  avatar: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md, backgroundColor: Colors.primaryDim },
  name: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.md, textAlign: 'center' },
  chipsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg, flexWrap: 'wrap', justifyContent: 'center' },
  chip: { height: 28 },
  chipText: { fontSize: 12, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, width: '100%' },
  editBtn: { flex: 1, borderRadius: Radius.sm },
  // ── Cartes ────────────────────────────────────────────
  card: card,
  accent: { height: 3, backgroundColor: Colors.primary },
  cardContent: { padding: Spacing.lg },
  cardTitle: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary, marginBottom: Spacing.md },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, gap: Spacing.sm },
  infoIcon: { width: 24, textAlign: 'center' },
  infoLabel: { flex: 1, fontSize: 13, color: Colors.textSecondary },
  infoValue: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, textAlign: 'right', maxWidth: '50%' },
  linkName: { fontSize: 16, fontWeight: '600', color: Colors.primary, textDecorationLine: 'underline' },
  contactRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.xs, gap: Spacing.sm },
  contactText: { fontSize: 13, color: Colors.textSecondary },
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
