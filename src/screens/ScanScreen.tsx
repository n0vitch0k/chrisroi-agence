import React, { useState } from 'react';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  Pressable,
} from 'react-native';
import { Card, Button } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import type { RootStackParamList } from '../types/navigation';
import type { DocumentType, ScanState } from '../types/scan';
import { CONTRAT_PAGE_COUNT } from '../types/scan';
import { getKilocodeApiKey } from '../database/service';
import { extractDocument } from '../services/kilocode';
import AppHeader from '../components/AppHeader';
import DocumentCornerEditor from '../components/DocumentCornerEditor';
import { Colors, Spacing, Radius, Shadows } from '../theme';
import SafeButton from '../components/SafeButton';
import {
  prepareScanSource,
  finalizeScanPage,
  defaultScanCorners,
  type PreparedScanSource,
  type ScanCorner,
  type ProcessedScanPage,
} from '../utils/documentScan';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Scan'>;
};

type PageCapture = PreparedScanSource & {
  /** Coins appliques, dans l'ordre canonique. */
  corners: ScanCorner[];
  /** Raster redressé, rempli à l'Appliquer. */
  uri: string;
  base64: string;
};

const preparedToCapture = (prepared: PreparedScanSource): PageCapture => ({
  ...prepared,
  corners: defaultScanCorners(),
  uri: prepared.sourceUri,
  base64: '',
});

const processedToCapture = (prepared: PreparedScanSource, page: ProcessedScanPage): PageCapture => ({
  ...prepared,
  corners: page.corners,
  uri: page.processedUri,
  base64: page.base64,
});

export default function ScanScreen({ navigation }: Props) {
  const [scanState, setScanState] = useState<ScanState>({
    status: 'pending',
    documentType: null,
    imageUri: null,
    imageUris: [],
    base64s: [],
    extracted: null,
    error: null,
  });
  const [pages, setPages] = useState<PageCapture[]>([]);
  const [processing, setProcessing] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const setPagesAndState = (next: PageCapture[], documentType: DocumentType) => {
    setPages(next);
    setScanState((previous) => ({
      ...previous,
      status: 'pending',
      documentType,
      imageUri: next[0]?.uri ?? null,
      imageUris: next.map((page) => page.uri),
      base64s: next.map((page) => page.base64),
      extracted: null,
      error: null,
    }));
  };

  const resetPages = () => {
    setPages([]);
    setEditingIndex(null);
    setScanState((previous) => ({
      ...previous,
      status: 'pending',
      documentType: null,
      imageUri: null,
      imageUris: [],
      base64s: [],
      error: null,
    }));
  };

  const processAssets = async (
    documentType: DocumentType,
    assets: ImagePicker.ImagePickerAsset[],
  ) => {
    if (assets.length === 0) return;
    const remaining = documentType === 'contrat'
      ? CONTRAT_PAGE_COUNT - pages.length
      : 1;
    if (remaining <= 0) return;
    setProcessing(true);
    setScanState((previous) => ({ ...previous, error: null }));

    const processed: PageCapture[] = [];
    for (const asset of assets.slice(0, remaining)) {
      try {
        const prepared = await prepareScanSource(asset.uri);
        processed.push(preparedToCapture(prepared));
      } catch (error: any) {
        const message = error?.message || 'Impossible de traiter cette image.';
        setScanState((previous) => ({ ...previous, status: 'error', error: message }));
        Alert.alert('Scan impossible', message);
        break;
      }
    }

    if (processed.length > 0) {
      const next = documentType === 'fiche_inscription'
        ? processed.slice(0, 1)
        : [...pages, ...processed].slice(0, CONTRAT_PAGE_COUNT);
      setPagesAndState(next, documentType);
      // Le redressement est manuel : l'éditeur s'ouvre sur la page ajoutée,
      // sinon l'utilisateur verrait une photo non recadrée et devrait deviner
      // qu'il doit lancer la correction.
      setEditingIndex(next.length - 1);
    }
    setProcessing(false);
  };

  const pickImage = async (documentType: DocumentType) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission requise',
        'Autorisez l\'accès à la galerie pour sélectionner une photo.',
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      allowsMultipleSelection: documentType === 'contrat',
    });
    if (!result.canceled && result.assets.length > 0) {
      await processAssets(documentType, result.assets);
    }
  };

  const takePhoto = async (documentType: DocumentType) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission requise',
        'Autorisez l\'accès à l\'appareil photo.',
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 1 });
    if (!result.canceled && result.assets[0]) {
      await processAssets(documentType, [result.assets[0]]);
    }
  };

  const handleDocumentSelect = (documentType: DocumentType) => {
    if (processing) return;
    const currentType = scanState.documentType;
    if (currentType && currentType !== documentType) {
      Alert.alert(
        'Changer de document ?',
        currentType === 'fiche_inscription'
          ? 'Une fiche est déjà préparée. Voulez-vous la remplacer par un contrat ?'
          : 'Un contrat est déjà préparé. Voulez-vous le remplacer par une fiche ?',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Remplacer',
            style: 'destructive',
            onPress: () => {
              resetPages();
              setTimeout(() => openDocumentSource(documentType), 0);
            },
          },
        ],
      );
      return;
    }
    openDocumentSource(documentType);
  };

  const openDocumentSource = (documentType: DocumentType) => {
    const isContract = documentType === 'contrat';
    const currentPages = isContract ? pages.length : 0;
    if (isContract && currentPages >= CONTRAT_PAGE_COUNT) {
      Alert.alert('Limite atteinte', 'Le contrat comporte 3 pages.');
      return;
    }
    Alert.alert(
      isContract ? 'Contrat de travail' : 'Fiche d\'inscription',
      isContract && currentPages > 0
        ? `Page ${currentPages + 1} sur ${CONTRAT_PAGE_COUNT} — choisissez une source`
        : 'Choisissez une source',
      [
        { text: '📷 Scanner avec la caméra', onPress: () => takePhoto(documentType) },
        { text: '🖼️ Choisir dans la galerie', onPress: () => pickImage(documentType) },
        { text: 'Annuler', style: 'cancel' },
      ],
    );
  };

  const removePage = (index: number) => {
    const documentType = scanState.documentType;
    if (!documentType) return;
    const next = pages.filter((_, pageIndex) => pageIndex !== index);
    if (next.length === 0) {
      resetPages();
      return;
    }
    setPagesAndState(next, documentType);
    setEditingIndex(null);
  };

  const movePage = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= pages.length) return;
    const next = [...pages];
    [next[index], next[target]] = [next[target], next[index]];
    setPagesAndState(next, scanState.documentType || 'contrat');
  };

  const applyCornerCorrection = async (corners: ScanCorner[]) => {
    if (editingIndex === null) return;
    const page = pages[editingIndex];
    if (!page) return;
    const result = await finalizeScanPage(page, corners);
    const next = pages.map((current, index) => (
      index === editingIndex ? processedToCapture(current, result) : current
    ));
    setPagesAndState(next, scanState.documentType || 'contrat');
    setEditingIndex(null);
  };

  const extractAndNavigate = async () => {
    if (pages.length === 0 || !scanState.documentType) return;
    const documentType = scanState.documentType;
    setScanState((previous) => ({
      ...previous,
      status: 'extracting',
      imageUri: pages[0].uri,
      imageUris: pages.map((page) => page.uri),
      base64s: pages.map((page) => page.base64),
      error: null,
    }));
    try {
      const apiKey = await getKilocodeApiKey();
      if (!apiKey) {
        Alert.alert(
          'Clé API manquante',
          'Configurez d\'abord votre clé API KiloCode dans Paramètres > Scanner.',
        );
        setScanState((previous) => ({ ...previous, status: 'pending', error: 'Clé API manquante' }));
        return;
      }
      const extracted = await extractDocument(
        apiKey,
        pages[0].uri,
        documentType,
        pages[0].base64,
        pages.slice(1).map((page) => page.base64),
      );
      setScanState((previous) => ({ ...previous, status: 'ready', extracted }));
      navigation.navigate('ScanResult', {
        imageUri: pages[0].uri,
        imageUris: pages.map((page) => page.uri),
        base64s: pages.map((page) => page.base64),
        documentType,
        extracted,
      });
    } catch (error: any) {
      const message = error?.message || 'Erreur inconnue';
      setScanState((previous) => ({ ...previous, status: 'error', error: message }));
      Alert.alert('Erreur d\'extraction', message);
    }
  };

  const extracting = scanState.status === 'extracting';
  const busy = processing || extracting;
  const editingPage = editingIndex === null ? null : pages[editingIndex];
  const showReview = pages.length > 0 && scanState.documentType !== null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <AppHeader title="Scanner un document" showBack onBack={() => navigation.goBack()} />
      <Text style={styles.subtitle}>
        Scannez le papier : ajustez les coins, la page est redressée et nettoyée en noir et blanc.
      </Text>

      <Text style={styles.sectionLabel}>Type de document</Text>
      <View style={styles.docTypeRow}>
        <Card
          style={[styles.docTypeCard, busy && styles.docTypeCardDisabled]}
          onPress={() => !busy && handleDocumentSelect('fiche_inscription')}
        >
          <Card.Content style={styles.docTypeContent}>
            <Icon name="file-document-edit" size={40} color={Colors.primary} />
            <Text style={styles.docTypeTitle}>Fiche{'\n'}d'inscription</Text>
            <Text style={styles.docTypeDesc}>Employé · 1 page</Text>
          </Card.Content>
        </Card>
        <Card
          style={[styles.docTypeCard, busy && styles.docTypeCardDisabled]}
          onPress={() => !busy && handleDocumentSelect('contrat')}
        >
          <Card.Content style={styles.docTypeContent}>
            <Icon name="file-sign" size={40} color={Colors.success} />
            <Text style={styles.docTypeTitle}>Contrat{'\n'}de travail</Text>
            <Text style={styles.docTypeDesc}>Employé + Employeur · 3 pages</Text>
          </Card.Content>
        </Card>
      </View>

      {(processing || extracting) && (
        <Card style={styles.progressCard}>
          <Card.Content style={styles.progressLoadingContent}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.progressLoadingTitle}>
              {extracting ? 'Analyse du document…' : 'Préparation du scan…'}
            </Text>
            <Text style={styles.progressLoadingHint}>
              {extracting
                ? 'Les pages corrigées sont envoyées à l\'assistant.'
                : 'Lecture et redressement de la page en cours.'}
            </Text>
          </Card.Content>
        </Card>
      )}

      {showReview && (
        <Card style={styles.reviewCard}>
          <Card.Content>
            <View style={styles.reviewHeader}>
              <View style={styles.reviewCopy}>
                <Text style={styles.reviewTitle}>
                  {scanState.documentType === 'contrat' ? 'Contrat' : 'Fiche'} — vérifier les pages
                </Text>
                <Text style={styles.reviewHint}>
                  Les images affichées sont les pages redressées qui seront envoyées à l'OCR.
                </Text>
              </View>
              <Icon name="file-check-outline" size={30} color={Colors.success} />
            </View>

            <View style={styles.pagesList}>
              {pages.map((page, index) => (
                <View key={`${page.sourceUri}-${index}`} style={styles.pageRow}>
                  <Pressable
                    onPress={() => !busy && setEditingIndex(index)}
                    accessibilityRole="button"
                    accessibilityLabel={`Corriger la page ${index + 1}`}
                    style={styles.pagePreviewButton}
                  >
                    <Image source={{ uri: page.uri }} style={styles.pagePreview} resizeMode="contain" />
                  </Pressable>
                  <View style={styles.pageInfo}>
                    <Text style={styles.pageTitle}>Page {index + 1}</Text>
                    <Text style={styles.pageState}>
                      Recadrage appliqué
                    </Text>
                    <View style={styles.pageActions}>
                      <Pressable disabled={busy} onPress={() => movePage(index, -1)} style={styles.pageActionButton}>
                        <Text style={styles.pageActionText}>←</Text>
                      </Pressable>
                      <Pressable disabled={busy} onPress={() => movePage(index, 1)} style={styles.pageActionButton}>
                        <Text style={styles.pageActionText}>→</Text>
                      </Pressable>
                      <Pressable disabled={busy} onPress={() => removePage(index)} style={styles.pageActionButton}>
                        <Text style={styles.deleteActionText}>Supprimer</Text>
                      </Pressable>
                    </View>
                    <Pressable disabled={busy} onPress={() => setEditingIndex(index)} style={styles.editLink}>
                      <Text style={styles.editLinkText}>Corriger les coins</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.reviewButtons}>
              {scanState.documentType === 'contrat' && pages.length < CONTRAT_PAGE_COUNT && (
                <SafeButton
                  mode="outlined"
                  onPress={() => handleDocumentSelect('contrat')}
                  disabled={busy}
                  style={styles.reviewButton}
                >
                  + Ajouter une page
                </SafeButton>
              )}
              <SafeButton
                mode="contained"
                onPress={extractAndNavigate}
                loading={extracting}
                disabled={busy}
                style={styles.reviewButton}
              >
                Valider et analyser
              </SafeButton>
            </View>
            <Button onPress={resetPages} disabled={busy} textColor={Colors.danger}>
              Tout effacer
            </Button>
          </Card.Content>
        </Card>
      )}

      {scanState.error && !processing && !extracting && (
        <Card style={styles.errorCard}>
          <Card.Content>
            <Text style={styles.errorText}>{scanState.error}</Text>
          </Card.Content>
        </Card>
      )}

      <Card style={styles.helpCard}>
        <Card.Content>
          <Text style={styles.helpTitle}>Conseils pour un bon scan</Text>
          <Text style={styles.helpItem}>• Placez le document à plat sur un fond contrasté</Text>
          <Text style={styles.helpItem}>• Gardez les quatre bords visibles</Text>
          <Text style={styles.helpItem}>• Évitez les ombres et les reflets sur le papier</Text>
          <Text style={styles.helpItem}>• Vérifiez les coins dans l'aperçu avant l'analyse</Text>
          <Text style={styles.helpItem}>• Contrat : ajoutez les 3 pages dans l'ordre</Text>
        </Card.Content>
      </Card>

      <DocumentCornerEditor
        visible={editingPage !== null}
        sourceUri={editingPage?.sourceUri || ''}
        sourceWidth={editingPage?.sourceWidth || 1}
        sourceHeight={editingPage?.sourceHeight || 1}
        initialCorners={editingPage?.corners || []}
        onCancel={() => setEditingIndex(null)}
        onApply={applyCornerCorrection}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
    width: '100%',
    maxWidth: 800,
    alignSelf: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  docTypeRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.xl },
  docTypeCard: {
    flex: 1,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    ...Shadows.card,
  },
  docTypeCardDisabled: { opacity: 0.5 },
  docTypeContent: { alignItems: 'center', paddingVertical: Spacing.lg },
  docTypeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginTop: Spacing.sm,
    lineHeight: 18,
  },
  docTypeDesc: { fontSize: 11, color: Colors.textSecondary, marginTop: 2, textAlign: 'center' },
  progressCard: {
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    ...Shadows.card,
    marginBottom: Spacing.lg,
  },
  progressLoadingContent: { alignItems: 'center', paddingVertical: Spacing.xl },
  progressLoadingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginTop: Spacing.md,
  },
  progressLoadingHint: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  reviewCard: {
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    ...Shadows.card,
    marginBottom: Spacing.lg,
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing.md },
  reviewCopy: { flex: 1, paddingRight: Spacing.md },
  reviewTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  reviewHint: { fontSize: 12, lineHeight: 18, color: Colors.textSecondary, marginTop: 3 },
  pagesList: { gap: Spacing.md },
  pageRow: {
    flexDirection: 'row',
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceAlt,
  },
  pagePreviewButton: { width: 86, minHeight: 112, borderRadius: Radius.sm, overflow: 'hidden' },
  pagePreview: { width: 86, height: 112, backgroundColor: '#ede4d8' },
  pageInfo: { flex: 1, paddingLeft: Spacing.md, justifyContent: 'center' },
  pageTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  pageState: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  pageActions: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  pageActionButton: {
    minWidth: 30,
    minHeight: 30,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderRadius: Radius.xs,
    backgroundColor: Colors.surface,
  },
  pageActionText: { fontSize: 15, color: Colors.primary, fontWeight: '700' },
  deleteActionText: { fontSize: 11, color: Colors.danger, fontWeight: '600' },
  editLink: { alignSelf: 'flex-start', paddingVertical: 5 },
  editLinkText: { fontSize: 12, color: Colors.primary, fontWeight: '700' },
  reviewButtons: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  reviewButton: { flex: 1 },
  errorCard: {
    borderRadius: Radius.md,
    backgroundColor: Colors.dangerLight,
    marginBottom: Spacing.lg,
  },
  errorText: { color: Colors.danger, fontSize: 14 },
  helpCard: {
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    ...Shadows.card,
    marginBottom: Spacing.lg,
  },
  helpTitle: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary, marginBottom: Spacing.sm },
  helpItem: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20, marginBottom: 2 },
});
