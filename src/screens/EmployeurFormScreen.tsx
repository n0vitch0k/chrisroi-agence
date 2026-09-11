import React, { useState, useEffect } from 'react';
import type { EmployeurFormNavigationProp } from '../types/navigation';

import {
  Alert,
  Image,
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
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import { DocumentViewerOverlay, useDocumentViewer } from '../components/DocumentViewer';
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
    salaire_propose: '',
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
  const docViewer = useDocumentViewer();

  const openViewerFor = (d: any, fallbackUri?: string | null) => {
    const uri = d?.imageUrl || fallbackUri;
    if (!uri) return;
    docViewer.open({ uri, label: getDocumentTypeLabel(d.type), fileName: d?.nomFichier || d?.file || d?.name || null, mimeType: d?.mimeType || null });
  };

  const handleDownloadDoc = async (d: any) => {
    const uri = d?.imageUrl;
    if (!uri) { Alert.alert('Document', 'Aucun fichier à télécharger.'); return; }
    try {
      const name = d?.nomFichier || d?.file || `document_${d.id || Date.now()}`;
      let localUri = uri;
      if (/^https?:\/\//i.test(uri)) {
        const safe = String(name).replace(/[^a-zA-Z0-9._-]/g, '_');
        const tmp = FileSystem.cacheDirectory + safe;
        const dl = await FileSystem.downloadAsync(uri, tmp);
        localUri = dl.uri;
      }
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) await Sharing.shareAsync(localUri, { dialogTitle: getDocumentTypeLabel(d.type) });
      else Alert.alert('Document', localUri);
    } catch (e: any) {
      Alert.alert('Téléchargement', e?.message || 'Impossible de télécharger.');
    }
  };

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
        salaire_propose: data.salaire_propose ? String(data.salaire_propose) : '',
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

  const uploadPendingDocument = async (imageUri: string, fileName?: string, mimeType?: string) => {
    if (!docTypePending) return;
    setDocsLoading(true);
    try {
      if (employeurId) {
        // Édition : upload direct, avec retour explicite (comme en création)
        const docId = await uploadEmployeurDocument(employeurId, docTypePending, imageUri, fileName, mimeType);
        if (docId) {
          const docs = await getDocumentsByEmployeur(employeurId);
          setDocuments(docs || []);
          Alert.alert('Document ajouté', 'Le document a bien été enregistré.');
        } else {
          Alert.alert('Erreur', "Échec de l'ajout du document.");
        }
      } else {
        // Création : ajout en attente, sera uploadé après save
        setPendingDocuments((prev) => [
          ...prev,
          { type: docTypePending, uri: imageUri, name: fileName, mimeType },
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
            fieldKey="salaire_propose"
            label="Salaire proposé"
            value={formData.salaire_propose}
            onChangeText={updateField('salaire_propose')}
            placeholder="Ex: 80000"
            keyboardType="numeric"
            unlocked={fieldUnlocked('salaire_propose')}
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
            // Édition : grille comme EmployeDetail (vignettes + visionneuse + téléchargement)
            documents.length === 0 ? (
              <Text style={styles.emptyHint}>{docsLoading ? 'Chargement…' : 'Aucun document joint.'}</Text>
            ) : (
              <View style={styles.docGrid}>
                {documents.map((doc) => (
                  <TouchableOpacity key={doc.id} style={styles.docTile} onPress={() => openViewerFor(doc)} activeOpacity={0.78} disabled={!doc.imageUrl}>
                    {doc.imageUrl ? (
                      /\.(pdf|doc|docx)$/i.test(doc.nomFichier || doc.file || '') ? (
                        <View style={styles.docThumbPlaceholder}>
                          <Icon name={/\.pdf$/i.test(doc.nomFichier || doc.file || '') ? 'file-pdf-box' : 'file-word-outline'} size={30} color={Colors.primary} />
                        </View>
                      ) : (
                        <Image source={{ uri: doc.imageUrl }} style={styles.docThumb} resizeMode="cover" />
                      )
                    ) : (
                      <View style={styles.docThumbPlaceholder}>
                        <Text style={{ fontSize: 26 }}>{getDocumentTypeIcon(doc.type)}</Text>
                      </View>
                    )}
                    <Text style={styles.docTileLabel} numberOfLines={1}>
                      {getDocumentTypeLabel(doc.type)}
                    </Text>
                    {doc.imageUrl ? (
                      <TouchableOpacity
                        style={styles.docTileDownload}
                        onPress={() => handleDownloadDoc(doc)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Icon name="download-outline" size={13} color={Colors.primary} />
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                      style={styles.docTileRemove}
                      onPress={() => removeDocument(doc.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Icon name="close" size={14} color="#b85454" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </View>
            )
          ) : (
            // Création : vignettes des documents en attente (URIs locales visualisables)
            pendingDocuments.length === 0 ? (
              <Text style={styles.emptyHint}>
                Aucun document. Ils seront ajoutés à l'employeur lors de l'enregistrement.
              </Text>
            ) : (
              <>
                <Text style={styles.pendingHint}>
                  {pendingDocuments.length} document(s) en attente — ajoutés à l'enregistrement.
                </Text>
                <View style={styles.docGrid}>
                  {pendingDocuments.map((p, idx) => (
                    <TouchableOpacity key={idx} style={styles.docTile} onPress={() => { if (typeof p.uri === 'string') openViewerFor(p, p.uri); }} activeOpacity={0.78} disabled={typeof p.uri !== 'string'}>
                      {typeof p.uri === 'string' && !/\.pdf$/i.test(p.name || p.uri) ? (
                        <Image source={{ uri: p.uri }} style={styles.docThumb} resizeMode="cover" />
                      ) : (
                        <View style={styles.docThumbPlaceholder}>
                          <Text style={{ fontSize: 26 }}>{getDocumentTypeIcon(p.type)}</Text>
                        </View>
                      )}
                      <Text style={styles.docTileLabel} numberOfLines={1}>
                        {getDocumentTypeLabel(p.type)}
                      </Text>
                      <TouchableOpacity
                        style={styles.docTileRemove}
                        onPress={() => removePendingDocument(idx)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Icon name="close" size={14} color="#b85454" />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                </View>
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
                  if (!result.canceled && result.assets[0]) uploadPendingDocument(result.assets[0].uri, (result.assets[0] as any).fileName, (result.assets[0] as any).mimeType);
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
                  if (!result.canceled && result.assets[0]) uploadPendingDocument(result.assets[0].uri, (result.assets[0] as any).fileName, (result.assets[0] as any).mimeType);
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
      <DocumentViewerOverlay viewerDoc={docViewer.doc} onClose={docViewer.close} onDownload={docViewer.download} downloading={docViewer.downloading} />
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
    width: '100%',
    maxWidth: 800,
    alignSelf: 'center',
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
  /* ─── Grille documents (parité EmployeDetail) ─── */
  docGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  docTile: { width: '30%', alignItems: 'center', marginBottom: Spacing.md },
  docThumb: { width: '100%', aspectRatio: 0.75, borderRadius: Radius.sm, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.borderLight },
  docThumbPlaceholder: { width: '100%', aspectRatio: 0.75, borderRadius: Radius.sm, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.borderLight, alignItems: 'center', justifyContent: 'center' },
  docTileLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 4, textAlign: 'center' },
  docTileRemove: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: '#FDECEC', alignItems: 'center', justifyContent: 'center' },
  docTileDownload: { position: 'absolute', top: 4, left: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: Colors.primary + '30', alignItems: 'center', justifyContent: 'center' },

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
