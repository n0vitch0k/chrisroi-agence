import React, { useState, useEffect } from 'react';
import type { EmployeurFormNavigationProp } from '../types/navigation';

import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TextStyle,
  Modal,
  TouchableOpacity,
} from 'react-native';
// SafeButton remplace Button react-native-paper sur web
import { useNavigation, useRoute } from '@react-navigation/native';
import { createEmployeur, getEmployeurById, updateEmployeur } from '../database/service';
import {
  getDocumentsByEmployeur, uploadEmployeurDocument, deleteDocument,
  DOCUMENT_TYPES, getDocumentTypeLabel, getDocumentTypeIcon,
} from '../database/service';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Spacing, Radius, Shadows, Typography } from '../theme';
import FormField from '../components/FormField';
import SafeButton from '../components/SafeButton';
import AppHeader from '../components/AppHeader';
import { SegmentedButtons } from 'react-native-paper';

type EmployeurType = 'particulier' | 'entreprise' | 'commerce';

export default function EmployeurFormScreen() {
  const navigation = useNavigation<EmployeurFormNavigationProp>();
  const route = useRoute<any>();
  const employeurId = route.params?.id;
  const isEditing = !!employeurId;

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    nom_complet: '',
    type_besoin: 'particulier' as EmployeurType,
    adresse: '',
    telephone: '',
    email: '',
    nom_contact: '',
    prenom_contact: '',
    fonction_contact: '',
    notes: '',
  });

  // ── Documents associés (édition uniquement) ──
  const [documents, setDocuments] = useState<any[]>([]);
  const [showDocTypePicker, setShowDocTypePicker] = useState(false);
  const [showDocSourcePicker, setShowDocSourcePicker] = useState(false);
  const [docTypePending, setDocTypePending] = useState<string | null>(null);
  const [docsLoading, setDocsLoading] = useState(false);

  useEffect(() => {
    if (employeurId) loadEmployeur();
  }, [employeurId]);

  const loadEmployeur = async () => {
    try {
      const data = await getEmployeurById(employeurId);
      if (!data) return;
      setFormData({
        nom_complet: data.nom_complet || '',
        type_besoin: (data.type_besoin || 'particulier') as EmployeurType,
        adresse: data.adresse || '',
        telephone: data.telephone || '',
        email: data.email || '',
        nom_contact: data.nom_contact || '',
        prenom_contact: data.prenom_contact || '',
        fonction_contact: data.fonction_contact || '',
        notes: data.notes || '',
      });
      const docs = await getDocumentsByEmployeur(employeurId);
      setDocuments(docs || []);
    } catch (error) {
      console.error('Error loading employeur:', error);
    }
  };

  const updateField = (field: string) => (value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const showContact = formData.type_besoin !== 'particulier';

  // Libellés dynamiques selon le type
  const nomLabel =
    formData.type_besoin === 'particulier'
      ? 'Nom complet'
      : formData.type_besoin === 'entreprise'
        ? 'Raison sociale'
        : 'Nom du commerce';
  const nomPlaceholder =
    formData.type_besoin === 'particulier'
      ? 'Ex: Diallo Fatou'
      : formData.type_besoin === 'entreprise'
        ? 'Ex: Société ABC'
        : 'Ex: Supermarché X';
  const contactLabel =
    formData.type_besoin === 'commerce' ? 'responsable' : 'contact';
  const contactPrenomLabel =
    formData.type_besoin === 'commerce' ? 'Prénom du responsable' : 'Prénom du contact';

  const handleSubmit = async () => {
    setSubmitted(true);

    // Validation : tout est requis sauf email.
    if (!formData.nom_complet.trim()) {
      Alert.alert('Erreur', `${nomLabel} est obligatoire`);
      return;
    }
    if (!formData.telephone.trim()) {
      Alert.alert('Erreur', 'Le téléphone est obligatoire');
      return;
    }
    if (!formData.adresse.trim()) {
      Alert.alert('Erreur', 'L\'adresse est obligatoire');
      return;
    }
    if (showContact && !formData.nom_contact.trim()) {
      Alert.alert('Erreur', `Le nom du ${contactLabel} est obligatoire`);
      return;
    }
    if (showContact && !formData.prenom_contact.trim()) {
      Alert.alert('Erreur', `Le ${contactPrenomLabel.toLowerCase()} est obligatoire`);
      return;
    }

    setLoading(true);
    try {
      if (isEditing) {
        await updateEmployeur(employeurId, formData);
        Alert.alert('Succès', 'Employeur modifié avec succès');
      } else {
        await createEmployeur(formData);
        Alert.alert('Succès', 'Employeur enregistré avec succès');
      }
      navigation.goBack();
    } catch (error) {
      console.error('Error saving employeur:', error);
      Alert.alert('Erreur', "Une erreur est survenue lors de l'enregistrement");
    } finally {
      setLoading(false);
    }
  };

  // ── Documents : logique d'ajout (identique à la fiche employé) ──
  const requestLibraryPermission = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', "Autorisez l'accès à la galerie dans les réglages de l'app.");
      return false;
    }
    return true;
  };

  const openDocTypePicker = () => {
    if (!employeurId) {
      Alert.alert('Info', "Enregistrez d'abord l'employeur avant d'ajouter des documents.");
      return;
    }
    setShowDocTypePicker(true);
  };

  const pickDocType = (type: string) => {
    setDocTypePending(type);
    setShowDocTypePicker(false);
    setShowDocSourcePicker(true);
  };

  const uploadPendingDocument = async (imageUri: string) => {
    if (!employeurId || !docTypePending) return;
    setDocsLoading(true);
    try {
      await uploadEmployeurDocument(employeurId, docTypePending, imageUri);
      setDocTypePending(null);
      const docs = await getDocumentsByEmployeur(employeurId);
      setDocuments(docs || []);
    } catch (e) {
      console.warn('uploadEmployeurDocument error:', e);
      Alert.alert('Erreur', "Échec de l'ajout du document.");
    } finally {
      setDocsLoading(false);
    }
  };

  const handleDocWeb = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file || !employeurId || !docTypePending) return;
    setDocsLoading(true);
    try {
      await uploadEmployeurDocument(employeurId, docTypePending, file);
      setDocTypePending(null);
      const docs = await getDocumentsByEmployeur(employeurId);
      setDocuments(docs || []);
    } catch (err) {
      console.warn('handleDocWeb error:', err);
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
          const docs = await getDocumentsByEmployeur(employeurId);
          setDocuments(docs || []);
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <AppHeader title={isEditing ? "Modifier l'employeur" : 'Nouvel employeur'} showBack onBack={() => navigation.goBack()} />
        {/* ─── Section: Informations de l'employeur ─── */}
        <View style={card}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Text style={sectionIconText}>E</Text>
            </View>
            <Text style={sectionTitle}>Informations de l'employeur</Text>
          </View>

          <Text style={infoLabel}>Type d'employeur</Text>
          <SegmentedButtons
            value={formData.type_besoin}
            onValueChange={(v) => setFormData({ ...formData, type_besoin: v as EmployeurType })}
            buttons={[
              { value: 'particulier', label: 'Particulier' },
              { value: 'entreprise', label: 'Entreprise' },
              { value: 'commerce', label: 'Commerce' },
            ]}
            style={styles.segmented}
          />

          <FormField
            label={nomLabel}
            value={formData.nom_complet}
            onChangeText={updateField('nom_complet')}
            required
            error={submitted && !formData.nom_complet.trim() ? 'Ce champ est requis' : undefined}
            placeholder={nomPlaceholder}
            autoCapitalize="words"
          />

          <FormField
            label="Adresse"
            value={formData.adresse}
            onChangeText={updateField('adresse')}
            required
            error={submitted && !formData.adresse.trim() ? 'Ce champ est requis' : undefined}
            placeholder={formData.type_besoin === 'particulier' ? 'Adresse du domicile' : "Adresse de l'établissement"}
            multiline
            numberOfLines={2}
            autoCapitalize="sentences"
          />

          <FormField
            label="Téléphone"
            value={formData.telephone}
            onChangeText={updateField('telephone')}
            required
            error={submitted && !formData.telephone.trim() ? 'Ce champ est requis' : undefined}
            placeholder="Ex: 01 02 03 04 05"
            keyboardType="phone-pad"
          />

          <FormField
            label="Email (optionnel)"
            value={formData.email}
            onChangeText={updateField('email')}
            placeholder={formData.type_besoin === 'particulier' ? 'Ex: fatou.diallo@email.com' : 'Ex: contact@entreprise.com'}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        {/* ─── Section: Personne de contact (entreprise + commerce) ─── */}
        {showContact && (
          <View style={card}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIcon}>
                <Text style={sectionIconText}>C</Text>
              </View>
              <Text style={sectionTitle}>
                {formData.type_besoin === 'commerce' ? 'Responsable du commerce' : 'Personne de contact'}
              </Text>
            </View>

            <FormField
              label={`Nom du ${contactLabel}`}
              value={formData.nom_contact}
              onChangeText={updateField('nom_contact')}
              required
              error={submitted && !formData.nom_contact.trim() ? 'Ce champ est requis' : undefined}
              placeholder="Ex: Diallo"
              autoCapitalize="words"
            />

            <FormField
              label={contactPrenomLabel}
              value={formData.prenom_contact}
              onChangeText={updateField('prenom_contact')}
              required
              error={submitted && !formData.prenom_contact.trim() ? 'Ce champ est requis' : undefined}
              placeholder="Ex: Fatou"
              autoCapitalize="words"
            />

            {formData.type_besoin === 'entreprise' && (
              <FormField
                label="Fonction du contact (optionnel)"
                value={formData.fonction_contact}
                onChangeText={updateField('fonction_contact')}
                placeholder="Ex: RH, Directeur, Manager..."
                autoCapitalize="words"
              />
            )}
          </View>
        )}

        {/* ─── Section: Documents (édition uniquement) ─── */}
        {isEditing && (
          <View style={card}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIcon}>
                <Text style={sectionIconText}>D</Text>
              </View>
              <Text style={sectionTitle}>Documents</Text>
              <TouchableOpacity onPress={openDocTypePicker} disabled={docsLoading} style={styles.sectionAdd}>
                <Text style={{ color: Colors.primary, fontWeight: '600' }}>+ Ajouter</Text>
              </TouchableOpacity>
            </View>

            {documents.length === 0 ? (
              <Text style={styles.emptyHint}>Aucun document joint.</Text>
            ) : (
              documents.map((doc) => (
                <View key={doc.id} style={styles.docItem}>
                  <Text style={styles.docLabel}>
                    {getDocumentTypeIcon(doc.type)} {getDocumentTypeLabel(doc.type)}
                  </Text>
                  <TouchableOpacity onPress={() => removeDocument(doc.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={{ color: Colors.danger, fontSize: 12 }}>Supprimer</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}

        {/* ─── Section: Notes ─── */}
        <View style={card}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Text style={sectionIconText}>N</Text>
            </View>
            <Text style={sectionTitle}>Notes</Text>
          </View>

          <FormField
            label="Notes additionnelles"
            value={formData.notes}
            onChangeText={updateField('notes')}
            placeholder="Informations complémentaires..."
            multiline
            numberOfLines={4}
            autoCapitalize="sentences"
          />
        </View>

        {/* ─── Bouton de soumission ─── */}
        <SafeButton
          mode="contained"
          onPress={handleSubmit}
          loading={loading}
          disabled={loading}
          style={styles.submitButton}
        >
          {isEditing ? "Modifier l'employeur" : "Enregistrer l'employeur"}
        </SafeButton>
      </ScrollView>

      {/* ── Modale : choix du type de document (étape 1) ── */}
      <Modal
        visible={showDocTypePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDocTypePicker(false)}
      >
        <View style={docModal.backdrop}>
          <View style={docModal.sheet}>
            <Text style={docModal.title}>De quoi s'agit-il ?</Text>
            <Text style={docModal.subtitle}>Choisissez le type de document à ajouter</Text>
            {DOCUMENT_TYPES.map((t) => (
              <TouchableOpacity key={t.value} style={docModal.item} onPress={() => pickDocType(t.value)} activeOpacity={0.7}>
                <Text style={docModal.itemIcon}>{t.icon}</Text>
                <Text style={docModal.itemLabel}>{t.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[docModal.item, docModal.cancel]} onPress={() => setShowDocTypePicker(false)}>
              <Text style={[docModal.itemLabel, { color: '#999' }]}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Modale : source du document (étape 2) ── */}
      <Modal
        visible={showDocSourcePicker}
        transparent
        animationType="slide"
        onRequestClose={() => { setShowDocSourcePicker(false); setDocTypePending(null); }}
      >
        <View style={docModal.backdrop}>
          <View style={docModal.sheet}>
            <Text style={docModal.title}>
              {docTypePending ? getDocumentTypeIcon(docTypePending) + ' ' + getDocumentTypeLabel(docTypePending) : 'Document'}
            </Text>
            <Text style={docModal.subtitle}>Galerie ou appareil photo</Text>
            <TouchableOpacity
              style={docModal.item}
              onPress={async () => {
                setShowDocSourcePicker(false);
                if (!(await requestLibraryPermission())) return;
                try {
                  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.85 });
                  if (!result.canceled && result.assets[0]) uploadPendingDocument(result.assets[0].uri);
                  else setDocTypePending(null);
                } catch (e: any) {
                  Alert.alert('Erreur', e?.message || "Impossible d'ouvrir la galerie.");
                  setDocTypePending(null);
                }
              }}
            >
              <Text style={docModal.itemLabel}>Choisir dans la galerie</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={docModal.item}
              onPress={async () => {
                setShowDocSourcePicker(false);
                const { status } = await ImagePicker.requestCameraPermissionsAsync();
                if (status !== 'granted') { Alert.alert('Permission refusée', "Autorisez l'accès à l'appareil photo."); setDocTypePending(null); return; }
                try {
                  const result = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.85 });
                  if (!result.canceled && result.assets[0]) uploadPendingDocument(result.assets[0].uri);
                  else setDocTypePending(null);
                } catch (e: any) {
                  Alert.alert('Erreur', e?.message || "Impossible d'ouvrir l'appareil photo.");
                  setDocTypePending(null);
                }
              }}
            >
              <Text style={docModal.itemLabel}>Prendre une photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[docModal.item, docModal.cancel]} onPress={() => { setShowDocSourcePicker(false); setDocTypePending(null); }}>
              <Text style={[docModal.itemLabel, { color: '#999' }]}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Web : input file caché */}
      {Platform.OS === 'web' && showDocSourcePicker ? (
        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleDocWeb} />
      ) : null}
    </KeyboardAvoidingView>
  );
}

const card = {
  ...Shadows.card,
  backgroundColor: Colors.surface,
  borderRadius: Radius.lg,
  padding: Spacing.lg,
  marginBottom: Spacing.md,
};

const sectionIconText = {
  ...Typography.label,
  color: Colors.primary,
  fontSize: 14,
};

const sectionTitle = {
  ...Typography.h4,
  color: Colors.textPrimary,
  flex: 1,
};

const submitButtonLabel: TextStyle = {
  ...Typography.body,
  color: Colors.textOnPrimary,
  fontWeight: '600',
  fontSize: 16,
};

const infoLabel: TextStyle = {
  ...Typography.label,
  color: Colors.textTertiary,
  marginBottom: Spacing.xs,
  fontSize: 12,
  textTransform: 'uppercase' as const,
  letterSpacing: 0.5,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  segmented: {
    marginBottom: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: Radius.sm,
  },

  /* ─── Card / Section ─── */
  card,
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  sectionIconText,
  sectionTitle,
  sectionAdd: {
    marginLeft: 'auto',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },

  emptyHint: {
    color: Colors.textTertiary,
    fontSize: 13,
    fontStyle: 'italic',
  },
  docItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  docLabel: {
    color: Colors.textPrimary,
    fontSize: 14,
  },

  /* ─── Submit Button ─── */
  submitButton: {
    marginTop: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
  },
  submitButtonContent: {
    paddingVertical: Spacing.sm,
    height: 52,
  },
  submitButtonLabel,
});

const docModal = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, padding: Spacing.lg, paddingBottom: Spacing.xl },
  title: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  subtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.md },
  item: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  itemIcon: { fontSize: 22, width: 28, textAlign: 'center' },
  itemLabel: { fontSize: 15, color: Colors.textPrimary },
  cancel: { borderTopWidth: 1, borderTopColor: Colors.borderLight, marginTop: Spacing.sm },
});
