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
} from 'react-native';
import { Card, Button, IconButton } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import type { RootStackParamList } from '../types/navigation';
import type { DocumentType, ScanState } from '../types/scan';
import { CONTRAT_PAGE_COUNT } from '../types/scan';
import { getKilocodeApiKey } from '../database/service';
import { extractDocument } from '../services/kilocode';
import AppHeader from '../components/AppHeader';
import { Colors, Spacing, Radius, Typography, Shadows } from '../theme';
import SafeButton from '../components/SafeButton';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Scan'>;
};

type PageCapture = {
  uri: string;
  base64: string | null;
};

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
  // Pages capturées pour le contrat multi-pages (page 1 en premier)
  const [pages, setPages] = useState<PageCapture[]>([]);

  const resetPages = () => {
    setPages([]);
    setScanState(prev => ({
      ...prev,
      status: 'pending',
      imageUri: null,
      imageUris: [],
      base64s: [],
      error: null,
    }));
  };

  const pickImage = async (documentType: DocumentType) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission requise',
        'Autorisez l\'accès à la galerie pour sélectionner une photo.'
      );
      return;
    }

    const multi = documentType === 'contrat';
    const remaining = multi ? CONTRAT_PAGE_COUNT - pages.length : 1;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      base64: true,
      allowsMultipleSelection: multi,
    });

    if (!result.canceled && result.assets.length > 0) {
      const picked: PageCapture[] = result.assets
        .slice(0, Math.max(remaining, 1))
        .map(a => ({ uri: a.uri, base64: a.base64 ?? null }));
      await onPagesCaptured(documentType, picked);
    }
  };

  const takePhoto = async (documentType: DocumentType) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission requise',
        'Autorisez l\'accès à l\'appareil photo.'
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      await onPagesCaptured(documentType, [
        { uri: result.assets[0].uri, base64: result.assets[0].base64 ?? null },
      ]);
    }
  };

  // Fiche = 1 page → extraction immédiate. Contrat = on accumule les pages.
  const onPagesCaptured = async (documentType: DocumentType, picked: PageCapture[]) => {
    if (documentType === 'fiche_inscription') {
      setPages(picked.slice(0, 1));
      await extractAndNavigate(documentType, picked.slice(0, 1));
      return;
    }
    const next = [...pages, ...picked].slice(0, CONTRAT_PAGE_COUNT);
    setPages(next);
    setScanState(prev => ({
      ...prev,
      status: 'pending',
      documentType,
      imageUri: next[0]?.uri ?? null,
      imageUris: next.map(p => p.uri),
      base64s: next.map(p => p.base64),
      error: null,
    }));
  };

  const extractAndNavigate = async (documentType: DocumentType, captures: PageCapture[]) => {
    if (captures.length === 0) return;
    setScanState(prev => ({
      ...prev,
      status: 'extracting',
      documentType,
      imageUri: captures[0].uri,
      imageUris: captures.map(c => c.uri),
      base64s: captures.map(c => c.base64),
      error: null,
    }));
    try {
      const apiKey = await getKilocodeApiKey();
      if (!apiKey) {
        Alert.alert(
          'Clé API manquante',
          'Configurez d\'abord votre clé API KiloCode dans Paramètres > Scanner.'
        );
        setScanState(prev => ({ ...prev, status: 'pending', error: 'Clé API manquante' }));
        return;
      }

      const extracted = await extractDocument(
        apiKey,
        captures[0].uri,
        documentType,
        captures[0].base64 || undefined,
        captures.slice(1).map(c => c.base64 || '')
      );
      setScanState(prev => ({
        ...prev,
        status: 'ready',
        extracted,
      }));
      // Naviguer vers l'écran de validation
      navigation.navigate('ScanResult', {
        imageUri: captures[0].uri,
        imageUris: captures.map(c => c.uri),
        base64s: captures.map(c => c.base64),
        documentType,
        extracted,
      });
    } catch (error: any) {
      setScanState(prev => ({
        ...prev,
        status: 'error',
        error: error.message || 'Erreur inconnue',
      }));
      Alert.alert('Erreur d\'extraction', error.message || 'Impossible d\'analyser le document');
    }
  };

  const handleDocumentSelect = (documentType: DocumentType) => {
    Alert.alert(
      documentType === 'fiche_inscription'
        ? 'Fiche d\'inscription'
        : `Contrat de travail (${CONTRAT_PAGE_COUNT} pages)`,
      documentType === 'contrat' && pages.length > 0
        ? `Page ${pages.length + 1} sur ${CONTRAT_PAGE_COUNT} — choisissez une source`
        : 'Choisissez une source',
      [
        {
          text: '📷 Prendre une photo',
          onPress: () => takePhoto(documentType),
        },
        {
          text: '🖼️ Choisir dans la galerie',
          onPress: () => pickImage(documentType),
        },
        { text: 'Annuler', style: 'cancel' },
      ]
    );
  };

  const extracting = scanState.status === 'extracting';
  const contratProgress = scanState.documentType === 'contrat' && pages.length > 0 && !extracting;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <AppHeader title="Scanner un document" showBack onBack={() => navigation.goBack()} />
      {/* En-tête */}
      <Text style={styles.subtitle}>
      Prenez une photo du document papier pour extraire automatiquement les informations.
      </Text>

      {/* Type de document */}
      <Text style={styles.sectionLabel}>Type de document</Text>
      <View style={styles.docTypeRow}>
        <Card
          style={[
            styles.docTypeCard,
            extracting && styles.docTypeCardDisabled,
          ]}
          onPress={() => !extracting && handleDocumentSelect('fiche_inscription')}
        >
          <Card.Content style={styles.docTypeContent}>
            <Icon name="file-document-edit" size={40} color={Colors.primary} />
            <Text style={styles.docTypeTitle}>Fiche{'\n'}d'inscription</Text>
            <Text style={styles.docTypeDesc}>Employé · 1 page</Text>
          </Card.Content>
        </Card>

        <Card
          style={[
            styles.docTypeCard,
            extracting && styles.docTypeCardDisabled,
          ]}
          onPress={() => !extracting && handleDocumentSelect('contrat')}
        >
          <Card.Content style={styles.docTypeContent}>
            <Icon name="file-sign" size={40} color={Colors.success} />
            <Text style={styles.docTypeTitle}>Contrat{'\n'}de travail</Text>
            <Text style={styles.docTypeDesc}>Employé + Employeur · {CONTRAT_PAGE_COUNT} pages</Text>
          </Card.Content>
        </Card>
      </View>

      {/* Progression contrat multi-pages */}
      {contratProgress && (
        <Card style={styles.progressCard}>
          <Card.Content>
            <Text style={styles.progressTitle}>
              Contrat — page {pages.length} sur {CONTRAT_PAGE_COUNT}
            </Text>
            <View style={styles.pagesRow}>
              {pages.map((p, i) => (
                <View key={p.uri + i} style={styles.pageThumbWrap}>
                  <Image source={{ uri: p.uri }} style={styles.pageThumb} />
                  <Text style={styles.pageLabel}>Page {i + 1}</Text>
                </View>
              ))}
            </View>
            <View style={styles.buttonRow}>
              {pages.length < CONTRAT_PAGE_COUNT && (
                <SafeButton
                  mode="outlined"
                  onPress={() => handleDocumentSelect('contrat')}
                  style={styles.pageButton}
                >
                  + Page {pages.length + 1}
                </SafeButton>
              )}
              <SafeButton
                mode="contained"
                onPress={() => extractAndNavigate('contrat', pages)}
                style={styles.pageButton}
              >
                Analyser ({pages.length} page{pages.length > 1 ? 's' : ''})
              </SafeButton>
            </View>
            <Button onPress={resetPages} textColor={Colors.danger}>
              Tout effacer
            </Button>
          </Card.Content>
        </Card>
      )}

      {/* État extraction */}
      {extracting && (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Analyse du document en cours...</Text>
          <Text style={styles.loadingHint}>
            {scanState.imageUris.length > 1
              ? `L'IA extrait les informations (${scanState.imageUris.length} pages)`
              : "L'IA extrait les informations"}
          </Text>
          {scanState.imageUris.length > 0 && (
            <View style={styles.pagesRow}>
              {scanState.imageUris.map((uri, i) => (
                <Image key={uri + i} source={{ uri }} style={styles.previewThumb} />
              ))}
            </View>
          )}
        </View>
      )}

      {scanState.status === 'error' && (
        <Card style={styles.errorCard}>
          <Card.Content>
            <Text style={styles.errorText}>{scanState.error}</Text>
          </Card.Content>
        </Card>
      )}

      {/* Aide */}
      <Card style={styles.helpCard}>
        <Card.Content>
          <Text style={styles.helpTitle}>Conseils pour un bon scan</Text>
          <Text style={styles.helpItem}>• Placez le document à plat sur un fond contrasté</Text>
          <Text style={styles.helpItem}>• Cadrez bien tout le document</Text>
          <Text style={styles.helpItem}>• Assurez-vous d'un bon éclairage</Text>
          <Text style={styles.helpItem}>• Évitez les ombres sur le texte</Text>
          <Text style={styles.helpItem}>• Contrat : photographiez les {CONTRAT_PAGE_COUNT} pages dans l'ordre</Text>
        </Card.Content>
      </Card>
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
  title: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center', marginBottom: Spacing.xs },
  subtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.xl, lineHeight: 20 },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary, marginBottom: Spacing.md, textTransform: 'uppercase', letterSpacing: 0.5 },
  docTypeRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.xl },
  docTypeCard: { flex: 1, borderRadius: Radius.md, backgroundColor: Colors.surface, ...Shadows.card },
  docTypeCardDisabled: { opacity: 0.5 },
  docTypeContent: { alignItems: 'center', paddingVertical: Spacing.lg },
  docTypeTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center', marginTop: Spacing.sm, lineHeight: 18 },
  docTypeDesc: { fontSize: 11, color: Colors.textSecondary, marginTop: 2, textAlign: 'center' },
  progressCard: { borderRadius: Radius.md, backgroundColor: Colors.surface, ...Shadows.card, marginBottom: Spacing.lg },
  progressTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.md },
  pagesRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap', marginBottom: Spacing.md },
  pageThumbWrap: { alignItems: 'center' },
  pageThumb: { width: 72, height: 96, borderRadius: Radius.sm, resizeMode: 'cover' },
  pageLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  buttonRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xs },
  pageButton: { flex: 1, borderRadius: Radius.sm },
  loadingBox: { alignItems: 'center', padding: Spacing.xl, backgroundColor: Colors.surface, borderRadius: Radius.md, ...Shadows.card, marginBottom: Spacing.lg },
  loadingText: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary, marginTop: Spacing.md },
  loadingHint: { fontSize: 13, color: Colors.textSecondary, marginTop: Spacing.xs },
  previewThumb: { width: 72, height: 96, borderRadius: Radius.sm, marginTop: Spacing.md, resizeMode: 'cover' },
  errorCard: { borderRadius: Radius.md, backgroundColor: Colors.danger + '15', marginBottom: Spacing.lg },
  errorText: { color: Colors.danger, fontSize: 14 },
  helpCard: { borderRadius: Radius.md, backgroundColor: Colors.surface, ...Shadows.card, marginBottom: Spacing.lg },
  helpTitle: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary, marginBottom: Spacing.sm },
  helpItem: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20, marginBottom: 2 },
});
