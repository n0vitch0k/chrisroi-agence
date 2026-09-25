import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import { Colors, Radius, Shadows, Spacing } from '../theme';
import SafeButton from './SafeButton';
import DocumentCornerEditor from './DocumentCornerEditor';
import { prepareScanSource, finalizeScanPage, defaultScanCorners, type PreparedScanSource, type ProcessedScanPage, type ScanCorner } from '../utils/documentScan';

type Props = {
  visible: boolean;
  title: string;
  onCancel: () => void;
  onApplied: (page: ProcessedScanPage) => Promise<void> | void;
};

/**
 * Capture un document signé, le traite comme une page documentaire,
 * puis ouvre l'éditeur de coins avant l'upload.
 *
 * Ce composant est volontairement mobile : le web conserve son input File
 * existant, car le pipeline natif Expo/URI est le contrat validé pour Expo Go.
 */
export default function DocumentScanCaptureModal({
  visible,
  title,
  onCancel,
  onApplied,
}: Props) {
  const [draft, setDraft] = useState<PreparedScanSource | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setDraft(null);
      setProcessing(false);
      setError(null);
    }
  }, [visible]);

  const startCapture = async (source: 'camera' | 'library') => {
    setError(null);
    setProcessing(true);
    try {
      const permission = source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        throw new Error(source === 'camera'
          ? "Autorisez l'accès à l'appareil photo pour scanner le document."
          : "Autorisez l'accès à la galerie pour choisir le document.");
      }

      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 1 });
      if (result.canceled || !result.assets[0]) return;

      // Étape légère : seule la normalisation est faite ici. Le redressement
      // attend les coins de l'utilisateur, donc il n'a lieu qu'à l'Appliquer.
      const prepared = await prepareScanSource(result.assets[0].uri);
      setDraft(prepared);
    } catch (captureError: any) {
      setError(captureError?.message || 'Impossible de traiter cette image.');
    } finally {
      setProcessing(false);
    }
  };

  const applyCorners = async (corners: ScanCorner[]) => {
    if (!draft) return;
    setError(null);
    try {
      // On repart toujours de la source normalisée, jamais du redressement précédent.
      const processed = await finalizeScanPage(draft, corners);
      await onApplied(processed);
      setDraft(null);
      onCancel();
    } catch (applyError: any) {
      setError(applyError?.message || 'Impossible d’enregistrer la page.');
    }
  };

  if (Platform.OS === 'web') return null;

  return (
    <>
      <Modal
        visible={visible && draft === null}
        transparent
        animationType="fade"
        onRequestClose={() => !processing && onCancel()}
      >
        <View style={styles.backdrop}>
          <View style={styles.sourceCard}>
            <View style={styles.sourceHeader}>
              <View style={styles.sourceHeaderCopy}>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.subtitle}>
                  Vous placez les coins, puis la page est redressée et nettoyée en noir et blanc.
                </Text>
              </View>
              <Pressable
                onPress={() => !processing && onCancel()}
                disabled={processing}
                style={styles.closeButton}
                accessibilityRole="button"
                accessibilityLabel="Annuler le scan"
              >
                <Text style={styles.closeText}>×</Text>
              </Pressable>
            </View>

            {error && <Text style={styles.error}>{error}</Text>}

            {processing ? (
              <View style={styles.processingBox}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.processingTitle}>Préparation du scan…</Text>
                <Text style={styles.processingHint}>
                  Lecture de l'image en cours…
                </Text>
              </View>
            ) : (
              <View style={styles.sourceActions}>
                <Pressable
                  onPress={() => startCapture('camera')}
                  style={styles.sourceButton}
                  accessibilityRole="button"
                >
                  <Icon name="camera-outline" size={28} color={Colors.primary} />
                  <Text style={styles.sourceButtonText}>Prendre une photo</Text>
                </Pressable>
                <Pressable
                  onPress={() => startCapture('library')}
                  style={styles.sourceButton}
                  accessibilityRole="button"
                >
                  <Icon name="image-multiple-outline" size={28} color={Colors.primary} />
                  <Text style={styles.sourceButtonText}>Choisir dans la galerie</Text>
                </Pressable>
              </View>
            )}

            <SafeButton
              mode="text"
              onPress={onCancel}
              disabled={processing}
              color={Colors.textSecondary}
              style={styles.cancelButton}
            >
              Annuler
            </SafeButton>
          </View>
        </View>
      </Modal>

      <DocumentCornerEditor
        visible={visible && draft !== null}
        sourceUri={draft?.sourceUri || ''}
        sourceWidth={draft?.sourceWidth || 1}
        sourceHeight={draft?.sourceHeight || 1}
        initialCorners={defaultScanCorners()}
        onCancel={() => {
          setDraft(null);
          onCancel();
        }}
        onApply={applyCorners}
      />
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.lg,
    backgroundColor: 'rgba(20, 13, 9, 0.62)',
  },
  sourceCard: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    padding: Spacing.lg,
    borderRadius: Radius.xl,
    backgroundColor: Colors.bg,
    ...Shadows.elevated,
  },
  sourceHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  sourceHeaderCopy: { flex: 1, paddingRight: Spacing.md },
  title: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  subtitle: { fontSize: 13, lineHeight: 19, color: Colors.textSecondary, marginTop: 4 },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: Colors.surfaceAlt,
  },
  closeText: { fontSize: 25, lineHeight: 27, color: Colors.textSecondary },
  sourceActions: { gap: Spacing.sm },
  sourceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 58,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  sourceButtonText: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  processingBox: { alignItems: 'center', paddingVertical: Spacing.xl },
  processingTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginTop: Spacing.md },
  processingHint: { fontSize: 12, color: Colors.textSecondary, marginTop: 4, textAlign: 'center' },
  error: { color: Colors.danger, fontSize: 13, textAlign: 'center', marginBottom: Spacing.md },
  cancelButton: { alignSelf: 'center', marginTop: Spacing.sm },
});
