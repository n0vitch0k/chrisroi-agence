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
import {
  createEmployeur, getEmployeurById, updateEmployeur, patchEmployeurField,
} from '../database/service';
import {
  getDocumentsByEmployeur, uploadEmployeurDocument, deleteDocument,
  DOCUMENT_TYPES, getDocumentTypeLabel, getDocumentTypeIcon,
} from '../database/service';
import * as ImagePicker from 'expo-image-picker';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import { Colors, Spacing, Radius, Shadows, Typography } from '../theme';
import FormField from '../components/FormField';
import SafeButton from '../components/SafeButton';
import AppHeader from '../components/AppHeader';
import { SegmentedButtons } from 'react-native-paper';

// ── LockedField (C1) — pattern identique à ContratDocumentScreen ──
function LockedField({
  fieldKey,
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  numberOfLines,
  keyboardType,
  autoCapitalize,
  required,
  error,
  unlocked,
  onToggleLock,
  onPatch,
  isEditing,
}: {
  fieldKey: string;
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  multiline?: boolean;
  numberOfLines?: number;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  required?: boolean;
  error?: string | undefined;
  unlocked: boolean;
  onToggleLock: (key: string) => void;
  onPatch: (key: string, value: any) => Promise<void>;
  isEditing: boolean;
}) {
  const handleSavePatch = async () => {
    try {
      await onPatch(fieldKey, value);
      Alert.alert('Modifié', `${label} enregistré.`);
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Enregistrement impossible.');
      return;
    }
    onToggleLock(fieldKey);
  };
  return (
    <View style={empStyles.lockedRow}>
      <View style={{ flex: 1 }}>
        <FormField
          label={label}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          multiline={multiline}
          numberOfLines={numberOfLines}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          required={required}
          error={error}
          disabled={!unlocked}
        />
      </View>
      {isEditing && (
        <TouchableOpacity
          onPress={unlocked ? handleSavePatch : () => onToggleLock(fieldKey)}
          style={empStyles.lockBtn}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Icon
            name={unlocked ? 'check-circle' : 'lock'}
            size={22}
            color={unlocked ? Colors.success : Colors.textTertiary}
          />
        </TouchableOpacity>
      )}
    </View>
  );
}

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

  // ── Documents associés ──
  const [documents, setDocuments] = useState<any[]>([]);
  // Documents ajoutés AVANT la création : on les garde en mémoire et on les
  // uploade juste après le create (pattern identique à ContratDocumentScreen).
  const [pendingDocuments, setPendingDocuments] = useState<
    { type: string; uri: string; name?: string; mimeType?: string }[]
  >([]);
  const [showDocTypePicker, setShowDocTypePicker] = useState(false);
  const [showDocSourcePicker, setShowDocSourcePicker] = useState(false);
  const [docTypePending, setDocTypePending] = useState<string | null>(null);
  const [docsLoading, setDocsLoading] = useState(false);

  // C1 verrouillage : en édition, tous les champs sont locked par défaut ;
  // l'utilisateur clique 🔓 pour déverrouiller, modifie, puis ✅ pour valider.
  const [unlockedFields, setUnlockedFields] = useState<Set<string>>(new Set());
  const fieldUnlocked = (key: string) => !isEditing || unlockedFields.has(key);
  const toggleFieldLock = (key: string) =>
    setUnlockedFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const patchField = async (key: string, value: any) => {
    if (!employeurId) return;
    await patchEmployeurField(employeurId, key, value);
  };

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
      let createdId: string | undefined = employeurId;
      if (isEditing) {
        await updateEmployeur(employeurId, formData);
        Alert.alert('Succès', 'Employeur modifié avec succès');
      } else {
        createdId = await createEmployeur(formData);
        // Si des documents ont été ajoutés en attente, on les uploade maintenant.
        if (pendingDocuments.length > 0 && createdId) {
          let ok = 0, fail = 0;
          for (const p of pendingDocuments) {
            const rid = await uploadEmployeurDocument(
              createdId, p.type, p.uri, p.name, p.mimeType,
            );
            if (rid) ok++; else fail++;
          }
          setPendingDocuments([]);
          if (fail > 0) {
            Alert.alert(
              'Employeur créé',
              `${ok} document(s) ajouté(s), ${fail} échec(s).`,
            );
          } else if (ok > 0) {
            Alert.alert('Succès', `Employeur créé avec ${ok} document(s).`);
          } else {
            Alert.alert('Succès', 'Employeur enregistré avec succès');
          }
        } else {
          Alert.alert('Succès', 'Employeur enregistré avec succès');
        }
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
      // Mode création : les documents sont mis en attente et uploadés après save.
      setShowDocTypePicker(true);
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
    if (!docTypePending) return;
    setDocsLoading(true);
    try {
      if (employeurId) {
        // Édition : upload direct
        await uploadEmployeurDocument(employeurId, docTypePending, imageUri);
        const docs = await getDocumentsByEmployeur(employeurId);
        setDocuments(docs || []);
      } else {
        // Création : ajout en attente, sera uploadé après save
        setPendingDocuments((prev) => [
          ...prev,
          { type: docTypePending, uri: imageUri },
        ]);
      }
      setDocTypePending(null);
    } catch (e) {
      console.warn('uploadPendingDocument error:', e);
      Alert.alert('Erreur', "Échec de l'ajout du document.");
    } finally {
      setDocsLoading(false);
    }
  };

  const handleDocWeb = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file || !docTypePending) return;
    setDocsLoading(true);
    try {
      if (employeurId) {
        await uploadEmployeurDocument(employeurId, docTypePending, file);
        const docs = await getDocumentsByEmployeur(employeurId);
        setDocuments(docs || []);
      } else {
        // Création : on garde l'objet File pour l'upload différé
        setPendingDocuments((prev) => [
          ...prev,
          { type: docTypePending, uri: file },
        ]);
      }
      setDocTypePending(null);
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

  const removePendingDocument = (index: number) => {
    Alert.alert('Retirer ce document ?', "Il ne sera pas ajouté à l'employeur.", [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Retirer',
        style: 'destructive',
        onPress: () => {
          setPendingDocuments((prev) => prev.filter((_, i) => i !== index));
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

          <LockedField
            fieldKey="nom_complet"
            label={nomLabel}
            value={formData.nom_complet}
            onChangeText={updateField('nom_complet')}
            required
            error={submitted && !formData.nom_complet.trim() ? 'Ce champ est requis' : undefined}
            placeholder={nomPlaceholder}
            autoCapitalize="words"
            unlocked={fieldUnlocked('nom_complet')}
            onToggleLock={toggleFieldLock}
            onPatch={patchField}
            isEditing={isEditing}
          />

          <LockedField
            fieldKey="adresse"
            label="Adresse"
            value={formData.adresse}
            onChangeText={updateField('adresse')}
            required
            error={submitted && !formData.adresse.trim() ? 'Ce champ est requis' : undefined}
            placeholder={formData.type_besoin === 'particulier' ? 'Adresse du domicile' : "Adresse de l'établissement"}
            multiline
            numberOfLines={2}
            autoCapitalize="sentences"
            unlocked={fieldUnlocked('adresse')}
            onToggleLock={toggleFieldLock}
            onPatch={patchField}
            isEditing={isEditing}
          />

          <LockedField
            fieldKey="telephone"
            label="Téléphone"
            value={formData.telephone}
            onChangeText={updateField('telephone')}
            required
            error={submitted && !formData.telephone.trim() ? 'Ce champ est requis' : undefined}
            placeholder="Ex: 01 02 03 04 05"
            keyboardType="phone-pad"
            unlocked={fieldUnlocked('telephone')}
            onToggleLock={toggleFieldLock}
            onPatch={patchField}
            isEditing={isEditing}
          />

          <LockedField
            fieldKey="email"
            label="Email (optionnel)"
            value={formData.email}
            onChangeText={updateField('email')}
            placeholder={formData.type_besoin === 'particulier' ? 'Ex: fatou.diallo@email.com' : 'Ex: contact@entreprise.com'}
            keyboardType="email-address"
            autoCapitalize="none"
            unlocked={fieldUnlocked('email')}
            onToggleLock={toggleFieldLock}
            onPatch={patchField}
            isEditing={isEditing}
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

            <LockedField
              fieldKey="nom_contact"
              label={`Nom du ${contactLabel}`}
              value={formData.nom_contact}
              onChangeText={updateField('nom_contact')}
              required
              error={submitted && !formData.nom_contact.trim() ? 'Ce champ est requis' : undefined}
              placeholder="Ex: Diallo"
              autoCapitalize="words"
              unlocked={fieldUnlocked('nom_contact')}
              onToggleLock={toggleFieldLock}
              onPatch={patchField}
              isEditing={isEditing}
            />

            <LockedField
              fieldKey="prenom_contact"
              label={contactPrenomLabel}
              value={formData.prenom_contact}
              onChangeText={updateField('prenom_contact')}
              required
              error={submitted && !formData.prenom_contact.trim() ? 'Ce champ est requis' : undefined}
              placeholder="Ex: Fatou"
              autoCapitalize="words"
              unlocked={fieldUnlocked('prenom_contact')}
              onToggleLock={toggleFieldLock}
              onPatch={patchField}
              isEditing={isEditing}
            />

            {formData.type_besoin === 'entreprise' && (
              <LockedField
                fieldKey="fonction_contact"
                label="Fonction du contact (optionnel)"
                value={formData.fonction_contact}
                onChangeText={updateField('fonction_contact')}
                placeholder="Ex: RH, Directeur, Manager..."
                autoCapitalize="words"
                unlocked={fieldUnlocked('fonction_contact')}
                onToggleLock={toggleFieldLock}
                onPatch={patchField}
                isEditing={isEditing}
              />
            )}
          </View>
        )}

        {/* ─── Section: Documents (création + édition) ─── */}
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

          {isEditing ? (
            // Édition : on affiche les documents déjà uploadés
            documents.length === 0 ? (
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
            )
          ) : (
            // Création : on affiche les documents en attente (seront uploadés après save)
            pendingDocuments.length === 0 ? (
              <Text style={styles.emptyHint}>
                Aucun document. Ils seront ajoutés à l'employeur lors de l'enregistrement.
              </Text>
            ) : (
              <>
                <Text style={styles.pendingHint}>
                  {pendingDocuments.length} document(s) en attente — ajoutés à l'enregistrement.
                </Text>
                {pendingDocuments.map((p, idx) => (
                  <View key={idx} style={styles.docItem}>
                    <Text style={styles.docLabel}>
                      {getDocumentTypeIcon(p.type)} {getDocumentTypeLabel(p.type)}
                    </Text>
                    <TouchableOpacity onPress={() => removePendingDocument(idx)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={{ color: Colors.danger, fontSize: 12 }}>Retirer</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )
          )}
        </View>

        {/* ─── Section: Notes ─── */}
        <View style={card}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Text style={sectionIconText}>N</Text>
            </View>
            <Text style={sectionTitle}>Notes</Text>
          </View>

          <LockedField
            fieldKey="notes"
            label="Notes additionnelles"
            value={formData.notes}
            onChangeText={updateField('notes')}
            placeholder="Informations complémentaires..."
            multiline
            numberOfLines={4}
            autoCapitalize="sentences"
            unlocked={fieldUnlocked('notes')}
            onToggleLock={toggleFieldLock}
            onPatch={patchField}
            isEditing={isEditing}
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
  pendingHint: {
    color: Colors.primary,
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: Spacing.xs,
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

// ── Styles pour LockedField (C1) — alignés sur ContratDocumentScreen ──
const empStyles = StyleSheet.create({
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  lockBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
});
