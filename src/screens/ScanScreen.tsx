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
import { getGeminiApiKey } from '../database/service';
import { extractDocument } from '../services/gemini';
import AppHeader from '../components/AppHeader';
import { Colors, Spacing, Radius, Typography, Shadows } from '../theme';
import SafeButton from '../components/SafeButton';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Scan'>;
};

export default function ScanScreen({ navigation }: Props) {
  const [scanState, setScanState] = useState<ScanState>({
    status: 'pending',
    documentType: null,
    imageUri: null,
    extracted: null,
    error: null,
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const pickImage = async (documentType: DocumentType) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission requise',
        'Autorisez l\'accès à la galerie pour sélectionner une photo.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      const b64 = result.assets[0].base64;
      setImagePreview(uri);
      setScanState(prev => ({
        ...prev,
        status: 'extracting',
        documentType,
        imageUri: uri,
        error: null,
      }));
      await extractAndNavigate(documentType, uri, b64);
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
      const uri = result.assets[0].uri;
      const b64 = result.assets[0].base64;
      setImagePreview(uri);
      setScanState(prev => ({
        ...prev,
        status: 'extracting',
        documentType,
        imageUri: uri,
        error: null,
      }));
      await extractAndNavigate(documentType, uri, b64);
    }
  };

  const extractAndNavigate = async (documentType: DocumentType, imageUri: string, base64?: string | null) => {
    try {
      const apiKey = await getGeminiApiKey();
      if (!apiKey) {
        Alert.alert(
          'Clé API manquante',
          'Configurez d\'abord votre clé API Gemini dans Paramètres > Scanner.'
        );
        setScanState(prev => ({ ...prev, status: 'pending', error: 'Clé API manquante' }));
        setImagePreview(null);
        return;
      }

      const extracted = await extractDocument(apiKey, imageUri, documentType, base64 || undefined);
      setScanState(prev => ({
        ...prev,
        status: 'ready',
        extracted,
      }));
      // Naviguer vers l'écran de validation
      navigation.navigate('ScanResult', {
        imageUri,
        documentType,
        extracted,
      });
    } catch (error: any) {
      setScanState(prev => ({
        ...prev,
        status: 'error',
        error: error.message || 'Erreur inconnue',
      }));
      setImagePreview(null);
      Alert.alert('Erreur d\'extraction', error.message || 'Impossible d\'analyser le document');
    }
  };

  const handleDocumentSelect = (documentType: DocumentType) => {
    Alert.alert(
      documentType === 'fiche_inscription'
        ? 'Fiche d\'inscription'
        : 'Contrat de travail',
      'Choisissez une source',
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
            scanState.status === 'extracting' && styles.docTypeCardDisabled,
          ]}
          onPress={() => !scanState.status.includes('extract') && handleDocumentSelect('fiche_inscription')}
        >
          <Card.Content style={styles.docTypeContent}>
            <Icon name="file-document-edit" size={40} color={Colors.primary} />
            <Text style={styles.docTypeTitle}>Fiche{'\n'}d'inscription</Text>
            <Text style={styles.docTypeDesc}>Employé</Text>
          </Card.Content>
        </Card>

        <Card
          style={[
            styles.docTypeCard,
            scanState.status === 'extracting' && styles.docTypeCardDisabled,
          ]}
          onPress={() => !scanState.status.includes('extract') && handleDocumentSelect('contrat')}
        >
          <Card.Content style={styles.docTypeContent}>
            <Icon name="file-sign" size={40} color={Colors.success} />
            <Text style={styles.docTypeTitle}>Contrat{'\n'}de travail</Text>
            <Text style={styles.docTypeDesc}>Employé + Employeur</Text>
          </Card.Content>
        </Card>
      </View>

      {/* État extraction */}
      {scanState.status === 'extracting' && (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Analyse du document en cours...</Text>
          <Text style={styles.loadingHint}>L'IA extrait les informations</Text>
          {imagePreview && (
            <Image source={{ uri: imagePreview }} style={styles.previewThumb} />
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
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  title: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center', marginBottom: Spacing.xs },
  subtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.xl, lineHeight: 20 },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary, marginBottom: Spacing.md, textTransform: 'uppercase', letterSpacing: 0.5 },
  docTypeRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.xl },
  docTypeCard: { flex: 1, borderRadius: Radius.md, backgroundColor: Colors.surface, ...Shadows.card },
  docTypeCardDisabled: { opacity: 0.5 },
  docTypeContent: { alignItems: 'center', paddingVertical: Spacing.lg },
  docTypeTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center', marginTop: Spacing.sm, lineHeight: 18 },
  docTypeDesc: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  loadingBox: { alignItems: 'center', padding: Spacing.xl, backgroundColor: Colors.surface, borderRadius: Radius.md, ...Shadows.card, marginBottom: Spacing.lg },
  loadingText: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary, marginTop: Spacing.md },
  loadingHint: { fontSize: 13, color: Colors.textSecondary, marginTop: Spacing.xs },
  previewThumb: { width: 120, height: 160, borderRadius: Radius.sm, marginTop: Spacing.md, resizeMode: 'cover' },
  errorCard: { borderRadius: Radius.md, backgroundColor: Colors.danger + '15', marginBottom: Spacing.lg },
  errorText: { color: Colors.danger, fontSize: 14 },
  helpCard: { borderRadius: Radius.md, backgroundColor: Colors.surface, ...Shadows.card, marginBottom: Spacing.lg },
  helpTitle: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary, marginBottom: Spacing.sm },
  helpItem: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20, marginBottom: 2 },
});
