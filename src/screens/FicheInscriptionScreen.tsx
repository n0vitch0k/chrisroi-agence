import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  Platform,
  TouchableOpacity,
  Modal,
  PanResponder,
  Animated,
  Dimensions,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { FicheInscriptionNavigationProp } from '../types/navigation';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import { useAppHeader } from '../../App';
import AppHeader from '../components/AppHeader';
import SectionCard from '../components/SectionCard';
import FormField from '../components/FormField';
import SafeButton from '../components/SafeButton';
import A4Document from '../components/A4Document';
import { createEmploye, getEmployeById, updateEmploye, uploadScan, getScan, uploadEmployePhoto, getEmployePhotoUrl, isLocalPhotoUri, getDocumentsByEmploye, uploadDocument, deleteDocument, getDocumentTypeLabel, getDocumentTypeIcon, DOCUMENT_TYPES, getEntityHistory } from '../database/service';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as Sharing from 'expo-sharing';
import { printToFileAsync } from 'expo-print';
import { buildFichePapierHtml, FichePapierData, fileUriToDataUri } from '../utils/fichePrint';
import {
  CATEGORIES_EMPLOI,
  SITUATIONS_MATRIMONIALES,
  NIVEAUX_ETUDE,
  formatDate,
} from '../utils/constants';
import { Colors, Spacing, Radius, Typography } from '../theme';

// ─── Types ─────────────────────────────────────────────────
interface PersonneUrgence {
  nom: string;
  prenom: string;
  telephone: string;
}

interface Experience {
  entreprise: string;
  lieu: string;
  contact: string;
}

interface FormData {
  nom: string;
  prenom: string;
  date_naissance: string;
  lieu_naissance: string;
  sexe: string;
  telephone: string;
  lieu_residence: string;
  nationalite: string;
  situation_matrimoniale: string;
  religion: string;
  ethnie: string;
  niveau_etude: string;
  categorie_emploi: string;
  a_deja_travaille: boolean;
  experience_details: string;
  stages_effectues: string;
  formations: string;
  motivation: string;
  allergie_sante: string;
  intervention_chirurgicale: string;
  photo_uri: string;
}

// ─── EditableField ────────────────────────────────────────
// Petit champ éditable dans le document : souligné, clic → focus
function EditableField({
  value,
  onChangeText,
  placeholder,
  fieldStyle,
  multiline,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  fieldStyle?: any;
  multiline?: boolean;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#CCC"
      style={[docStyles.editableField, fieldStyle]}
      multiline={multiline}
      textAlignVertical={multiline ? 'top' : 'center'}
    />
  );
}

// ─── SignatureBox ─────────────────────────────────────────
// Ligne horizontale + nom/prénom en légende (plus de TextInput)
function SignatureBox({
  label,
  name,
}: {
  label: string;
  name?: string;
}) {
  return (
    <View style={docStyles.signatureBox}>
      <Text style={docStyles.signatureLabel}>{label}</Text>
      <View style={docStyles.signatureLine} />
      {name ? (
        <Text style={docStyles.signatureName}>{name}</Text>
      ) : null}
    </View>
  );
}

// ─── CheckboxInline ───────────────────────────────────────
function CheckboxInline({
  checked,
  label,
  onToggle,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <TouchableOpacity onPress={onToggle} style={docStyles.checkRow}>
      <View style={[docStyles.checkbox, checked && docStyles.checkboxChecked]}>
        {checked && <Icon name="check" size={12} color="#FFF" />}
      </View>
      <Text style={docStyles.checkLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ═══════════════════════════════════════════════════════════
//  ÉCRAN PRINCIPAL — FICHE D'INSCRIPTION
// ═══════════════════════════════════════════════════════════
export default function FicheInscriptionScreen() {
  const navigation = useNavigation<FicheInscriptionNavigationProp>();
  const route = useRoute<any>();
  const employeId = route.params?.id;
  const isEditing = !!employeId;
  const rootNavigation = navigation.getParent()?.getParent();
  const originLabel = route.params?.origin?.label;
  const headerTitle = isEditing
    ? (originLabel ? `Fiche d'inscription — depuis ${originLabel}` : "Fiche d'inscription")
    : "Nouvelle fiche d'inscription";

  const [loading, setLoading] = useState(false);

  // ── Verrouillage après inscription ───────────────────────
  // En mode CRÉATION (depuis le Dashboard), après un premier « Inscrire »
  // réussi, le formulaire passe en lecture-seule : plus aucun champ n'est
  // éditable et le bouton « Inscrire » est désactivé. Pour ré-éditer, il faut
  // repasser par « Modifier » sur l'écran Détail (qui remet isEditing=true,
  // donc le verrou ne s'active pas).
  // En mode ÉDITION (ouvert via Modifier), le verrou ne s'active jamais.
  const [locked, setLocked] = useState(false);

  // ── Validation date naissance ────────────────────────────
  const [dateError, setDateError] = useState<string | undefined>(undefined);

  // ── Onglet Numérique / Scanné ──────────────────────────
  const [activeTab, setActiveTab] = useState<'numerique' | 'scanne'>('numerique');
  const [scanData, setScanData] = useState<any>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  // ── Sélecteur de source photo ───────────────
  const [showSourcePicker, setShowSourcePicker] = useState(false);

  // ── Données du formulaire ──────────────────────────────
  const [formData, setFormData] = useState<FormData>({
    nom: '',
    prenom: '',
    date_naissance: '',
    lieu_naissance: '',
    sexe: 'feminin',
    telephone: '',
    lieu_residence: '',
    nationalite: '',
    situation_matrimoniale: 'celibataire',
    religion: '',
    ethnie: '',
    niveau_etude: '',
    categorie_emploi: 'serveuse',
    a_deja_travaille: false,
    experience_details: '',
    stages_effectues: '',
    formations: '',
    motivation: '',
    allergie_sante: '',
    intervention_chirurgicale: '',
    photo_uri: '',
  });

  const [pere, setPere] = useState({ nom: '', prenom: '', telephone: '', domicile: '' });
  const [mere, setMere] = useState({ nom: '', prenom: '', telephone: '', domicile: '' });
  const [personnesUrgence, setPersonnesUrgence] = useState<PersonneUrgence[]>([
    { nom: '', prenom: '', telephone: '' },
  ]);
  const [experiences, setExperiences] = useState<Experience[]>([
    { entreprise: '', lieu: '', contact: '' },
  ]);

  // ── Chargement mode édition ────────────────────────────
  useEffect(() => {
    if (employeId) loadEmploye();
  }, [employeId]);

  const loadEmploye = async () => {
    try {
      const employe = await getEmployeById(employeId);
      if (!employe) return;

      setFormData({
        nom: employe.nom || '',
        prenom: employe.prenom || '',
        date_naissance: employe.date_naissance || '',
        lieu_naissance: employe.lieu_naissance || '',
        sexe: employe.sexe || 'feminin',
        telephone: employe.telephone || '',
        lieu_residence: employe.lieu_residence || '',
        nationalite: employe.nationalite || '',
        situation_matrimoniale: employe.situation_matrimoniale || 'celibataire',
        religion: employe.religion || '',
        ethnie: employe.ethnie || '',
        niveau_etude: employe.niveau_etude || '',
        categorie_emploi: employe.categorie_emploi || 'serveuse',
        a_deja_travaille: !!employe.a_deja_travaille,
        experience_details: employe.experience_details || '',
        stages_effectues: employe.stages_effectues || '',
        formations: employe.formations || '',
        motivation: employe.motivation || '',
        allergie_sante: employe.allergie_sante || '',
        intervention_chirurgicale: employe.intervention_chirurgicale || '',
        photo_uri: employe.photo_uri || '',
      });
      // Photo d'identité : URL serveur (file field `photo`) prioritaire
      setPhotoUrl(getEmployePhotoUrl(employeId, employe.photo));

      (employe.parents || []).forEach((p: any) => {
        if (p.type === 'pere')
          setPere({ nom: p.nom || '', prenom: p.prenom || '', telephone: p.telephone || '', domicile: p.domicile || '' });
        if (p.type === 'mere')
          setMere({ nom: p.nom || '', prenom: p.prenom || '', telephone: p.telephone || '', domicile: p.domicile || '' });
      });

      if (employe.personnes_urgence?.length) {
        setPersonnesUrgence(employe.personnes_urgence.map((p: any) => ({
          nom: p.nom || '', prenom: p.prenom || '', telephone: p.telephone || '',
        })));
      }
      if (employe.experiences?.length) {
        setExperiences(employe.experiences.map((e: any) => ({
          entreprise: e.entreprise || '', lieu: e.lieu || '', contact: e.contact || '',
        })));
      }
    } catch (error) {
      console.error('Error loading employe:', error);
    }
  };

  // ── Enregistrement ──────────────────────────────────────
  const handleSave = async () => {
    if (!formData.nom.trim() || !formData.prenom.trim()) {
      Alert.alert('Champs requis', 'Le nom et le prénom sont obligatoires.');
      return;
    }

    if (formData.date_naissance) {
      const digits = formData.date_naissance.replace(/\D/g, '');
      if (digits.length !== 8) {
        Alert.alert('Date invalide', 'La date de naissance doit être au format AAAA-MM-JJ (ex: 1995-03-15).');
        return;
      }
      const annee = parseInt(digits.slice(0, 4), 10);
      const mois = parseInt(digits.slice(4, 6), 10);
      const jour = parseInt(digits.slice(6, 8), 10);
      if (annee < 1950 || annee > 2026 || mois < 1 || mois > 12 || jour < 1 || jour > 31) {
        Alert.alert('Date invalide', 'Vérifiez la date de naissance.');
        return;
      }
    }

    setLoading(true);
    try {
      const employeData = {
        ...formData,
        parents: [
          { type: 'pere', ...pere },
          { type: 'mere', ...mere },
        ],
        personnes_urgence: personnesUrgence.map((p, i) => ({ ...p, ordre: i + 1 })),
        experiences: experiences.map((e, i) => ({ ...e, ordre: i + 1 })),
      };

      let id: string;
      if (isEditing) {
        await updateEmploye(employeId, formData);
        id = employeId;
      } else {
        id = await createEmploye(employeData);
      }

      // Upload de la photo d'identité (file field `photo`) si une URI locale est présente
      if (formData.photo_uri && isLocalPhotoUri(formData.photo_uri)) {
        try {
          const filename = await uploadEmployePhoto(id, formData.photo_uri);
          if (filename) setPhotoUrl(getEmployePhotoUrl(id, filename));
        } catch (e) {
          console.warn('Upload photo échoué:', e);
        }
      }

      Alert.alert('Succès', isEditing ? 'Employé modifié' : 'Employé inscrit');

      // ── Upload des documents/scans mis en attente en mode CRÉATION ──
      // En création, l'employé vient d'être créé (id connu) : on upload tout
      // ce qui a été ajouté AVANT la sauvegarde (documents + scan).
      if (!isEditing) {
        try {
          for (const pd of pendingDocuments) {
            await uploadDocument(id, pd.type, pd.uri);
          }
          if (pendingScanUri) {
            await uploadScan('fiche_inscription', id, pendingScanUri);
          }
          // Recharger docs + scan pour affichage
          const docs = await getDocumentsByEmploye(id);
          setDocuments(docs || []);
          const updatedScan = await getScan('fiche_inscription', id);
          setScanData(updatedScan);
        } catch (e) {
          console.warn('Upload post-inscription échoué:', e);
        }
        // Verrouillage fort : le formulaire devient lecture-seule après inscription.
        setLocked(true);
        setPendingDocuments([]);
        setPendingScanUri(null);
      }
    } catch (error) {
      console.error('Error saving:', error);
      Alert.alert('Erreur', "Échec de l'enregistrement");
    } finally {
      setLoading(false);
    }
  };

  // ── Photo ──────────────────────────────────────────────

  // Ouvre la modale de choix de source (Galerie / Appareil photo)
  const pickImage = () => setShowSourcePicker(true);

  const requestLibraryPermission = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', "Autorisez l'accès à la galerie dans les réglages de l'app.");
      return false;
    }
    return true;
  };

  const requestCameraPermission = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', "Autorisez l'accès à l'appareil photo dans les réglages de l'app.");
      return false;
    }
    return true;
  };

  // Choix direct : galerie ou appareil → met l'image dans le champ photo (sans éditeur)
  const pickFromLibrary = async () => {
    setShowSourcePicker(false);
    if (!(await requestLibraryPermission())) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
        exif: true,
      });
      if (!result.canceled && result.assets[0]) {
        setFormData((prev) => ({ ...prev, photo_uri: result.assets[0].uri }));
        setPhotoUrl(null);
      }
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || "Impossible d'ouvrir la galerie.");
    }
  };

  const pickFromCamera = async () => {
    setShowSourcePicker(false);
    if (!(await requestCameraPermission())) return;
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
        exif: true,
      });
      if (!result.canceled && result.assets[0]) {
        setFormData((prev) => ({ ...prev, photo_uri: result.assets[0].uri }));
        setPhotoUrl(null);
      }
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || "Impossible d'ouvrir l'appareil photo.");
    }
  };


  // ── Scan du document signé ─────────────────────────────
  // Ouvrir l'appareil photo ou la galerie pour prendre une photo du document signé
  const handleScanDocument = async () => {
    try {
      setScanLoading(true);
      const ImagePicker = require('expo-image-picker').default;
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets[0]) {
        setScanLoading(false);
        return;
      }
      const imageUri = result.assets[0].uri;

      // Mode CRÉATION : on stocke le scan en attente (upload après handleSave)
      if (!employeId) {
        setPendingScanUri(imageUri);
        setScanLoading(false);
        Alert.alert('Scan en attente', "Le scan sera enregistré après l'inscription.");
        return;
      }
      // Upload vers PocketBase
      await uploadScan('fiche_inscription', employeId, imageUri);
      // Recharger le scan
      const updated = await getScan('fiche_inscription', employeId);
      setScanData(updated);
      Alert.alert('Scan ajouté', 'Le document scanné a été enregistré.');
      setScanLoading(false);
    } catch (_) {
      setScanLoading(false);
    }
  };

  // Sur web : fallback input type="file"
  const handleScanWeb = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Mode CRÉATION : on stocke le scan en attente (upload après handleSave)
    if (!employeId) {
      const reader = new FileReader();
      reader.onload = () => setPendingScanUri(reader.result as string);
      reader.readAsDataURL(file);
      Alert.alert('Scan en attente', "Le scan sera enregistré après l'inscription.");
      return;
    }
    try {
      setScanLoading(true);
      await uploadScan('fiche_inscription', employeId, file);
      const updated = await getScan('fiche_inscription', employeId);
      setScanData(updated);
      Alert.alert('Scan ajouté', 'Le document scanné a été enregistré.');
    } catch (_) {
      Alert.alert('Erreur', 'Échec de l\'upload du scan');
    } finally {
      setScanLoading(false);
    }
  };

  // Proposer le scan après impression
  const handleAfterPrint = () => {
    if (!isEditing) {
      Alert.alert(
        'Document imprimé',
        'Enregistrez d\'abord la fiche pour pouvoir scanner le document signé.',
      );
      return;
    }
    Alert.alert(
      'Scanner le document ?',
      'Voulez-vous scanner le document signé maintenant ?',
      [
        {
          text: 'Plus tard',
          style: 'cancel',
        },
        {
          text: 'Oui',
          onPress: () => handleScanDocument(),
        },
      ],
    );
  };

  // ── Génération de la fiche PAPIER (version stricte) en PDF ──
  // Flux validé : l'utilisateur génère la fiche papier (uniquement les champs
  // de la feuille physique) → aperçu → confirme « tout est en ordre » → partage.
  const handleDownloadFichePapier = async () => {
    try {
      // Photo : on l'embarque en data-URI base64 pour qu'elle s'imprime TOUJOURS
      // dans le PDF (expo-print n'embarque pas fiablement les images distantes).
      const photoSource = photoUrl || (formData.photo_uri && isLocalPhotoUri(formData.photo_uri) ? formData.photo_uri : null);
      const photoDataUri = photoSource ? await fileUriToDataUri(photoSource) : null;

      const data: FichePapierData = {
        date: new Date().toISOString().slice(0, 10),
        nom: formData.nom,
        prenom: formData.prenom,
        date_naissance: formData.date_naissance,
        lieu_naissance: formData.lieu_naissance,
        telephone: formData.telephone,
        lieu_residence: formData.lieu_residence,
        nationalite: formData.nationalite,
        sexe: formData.sexe,
        situation_matrimoniale: formData.situation_matrimoniale,
        religion: formData.religion,
        ethnie: formData.ethnie,
        categorie_emploi: formData.categorie_emploi,
        niveau_etude: formData.niveau_etude,
        deja_travaille: formData.a_deja_travaille,
        experience_details: formData.experience_details,
        allergie_sante: formData.allergie_sante,
        intervention_chirurgicale: formData.intervention_chirurgicale,
        photo: photoSource,
        photoDataUri,
        urgence: personnesUrgence.slice(0, 2).map((p) => ({
          nom: p.nom,
          prenom: p.prenom,
          telephone: p.telephone,
          lieu: undefined,
        })),
      };

      const html = buildFichePapierHtml(data);
      const { uri } = await printToFileAsync({ html, base64: false });

      if (Platform.OS === 'web') {
        // Sur web, printToFileAsync ouvre déjà l'aperçu navigateur.
        return;
      }

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
    }
  };

  // Charger le scan existant au montage (mode édition)
  useEffect(() => {
    if (employeId) {
      getScan('fiche_inscription', employeId).then(setScanData).catch(() => {});
    }
  }, [employeId]);

  // ── Documents associés ─────────────────────────────────
  const [documents, setDocuments] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [showDocTypePicker, setShowDocTypePicker] = useState(false);
  const [showDocSourcePicker, setShowDocSourcePicker] = useState(false);
  const [docTypePending, setDocTypePending] = useState<string | null>(null);
  const [docsLoading, setDocsLoading] = useState(false);
  // En mode CRÉATION, on ne peut pas uploader avant que l'employé existe.
  // On garde les documents/scans en attente et on les upload après handleSave.
  const [pendingDocuments, setPendingDocuments] = useState<{ type: string; uri: string }[]>([]);
  const [pendingScanUri, setPendingScanUri] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    if (!employeId) return;
    try {
      const docs = await getDocumentsByEmploye(employeId);
      setDocuments(docs || []);
    } catch (e) {
      console.warn('loadDocuments error:', e);
    }
  }, [employeId]);

  const loadHistory = useCallback(async () => {
    if (!employeId) return;
    try {
      const hist = await getEntityHistory('employe', employeId);
      setHistory(hist || []);
    } catch (e) {
      console.warn('loadHistory error:', e);
    }
  }, [employeId]);

  useEffect(() => {
    if (employeId) {
      loadDocuments();
      loadHistory();
    }
  }, [employeId, loadDocuments, loadHistory]);

  // Étape 1 : choix du type de document
  // En CRÉATION (pas encore d'employeId), on autorise quand même : le document
  // sera mis en attente et uploadé juste après l'inscription (handleSave).
  const openDocTypePicker = () => {
    setShowDocTypePicker(true);
  };

  // Étape 2 : après choix du type, ouvrir la source (galerie / photo)
  const pickDocType = (type: string) => {
    setDocTypePending(type);
    setShowDocTypePicker(false);
    setShowDocSourcePicker(true);
  };

  // Upload final du document (RN : URI locale)
  const uploadPendingDocument = async (imageUri: string) => {
    if (!docTypePending) return;
    // Mode CRÉATION : on stocke en attente (upload après handleSave)
    if (!employeId) {
      setPendingDocuments((prev) => [...prev, { type: docTypePending, uri: imageUri }]);
      setDocTypePending(null);
      return;
    }
    setDocsLoading(true);
    try {
      await uploadDocument(employeId, docTypePending, imageUri);
      setDocTypePending(null);
      await loadDocuments();
    } catch (e) {
      console.warn('uploadDocument error:', e);
      Alert.alert('Erreur', "Échec de l'ajout du document.");
    } finally {
      setDocsLoading(false);
    }
  };

  // Sur web : fallback input type="file"
  const handleDocWeb = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !docTypePending) return;
    // Mode CRÉATION : stocker en attente (upload après handleSave)
    if (!employeId) {
      // convertir File en data URL pour le garder côté web
      const reader = new FileReader();
      reader.onload = () => {
        setPendingDocuments((prev) => [...prev, { type: docTypePending, uri: reader.result as string }]);
      };
      reader.readAsDataURL(file);
      setDocTypePending(null);
      return;
    }
    setDocsLoading(true);
    try {
      await uploadDocument(employeId, docTypePending, file);
      setDocTypePending(null);
      await loadDocuments();
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
          loadDocuments();
        },
      },
    ]);
  };

  // ── Helpers ────────────────────────────────────────────
  const updateForm = (key: keyof FormData, value: any) =>
    setFormData({ ...formData, [key]: value });

  /** Reformate automatiquement la date : 8 chiffres → AAAA-MM-JJ */
  const handleDateChange = (raw: string) => {
    // Garder uniquement les chiffres
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 0) {
      setDateError(undefined);
      updateForm('date_naissance', '');
      return;
    }
    if (digits.length > 8) {
      setDateError('Date invalide (10 caractères max)');
      return;
    }
    // Formatage progressif AAAA-MM-JJ
    let formatted: string;
    if (digits.length <= 4) {
      formatted = digits;
    } else if (digits.length <= 6) {
      formatted = digits.slice(0, 4) + '-' + digits.slice(4);
    } else {
      formatted = digits.slice(0, 4) + '-' + digits.slice(4, 6) + '-' + digits.slice(6, 8);
    }
    setDateError(undefined);

    // Validation temps réel si on a les 8 chiffres
    if (digits.length === 8) {
      const annee = parseInt(digits.slice(0, 4), 10);
      const mois = parseInt(digits.slice(4, 6), 10);
      const jour = parseInt(digits.slice(6, 8), 10);
      if (annee < 1950 || annee > 2026) {
        setDateError('Année hors plage (1950-2026)');
        // Ne pas bloquer la saisie, juste afficher l'erreur
      } else if (mois < 1 || mois > 12) {
        setDateError('Mois invalide (01-12)');
      } else if (jour < 1 || jour > 31) {
        setDateError('Jour invalide (01-31)');
      } else {
        setDateError(undefined);
      }
    }

    updateForm('date_naissance', formatted);
  };

  // ════════════════════════════════════════════════════════
  //  RENDU — Formulaire numérique (saisie)
  // ════════════════════════════════════════════════════════
  const renderDigitalForm = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 40 }} keyboardShouldPersistTaps="handled"
      // Verrouillage fort : après inscription, tout le formulaire devient
      // non-interactif (champs, chips, photo, documents). Le bouton est géré séparément.
      pointerEvents={locked ? 'none' : 'auto'}
    >
      {/* ── Photo + Identité ── */}
      <SectionCard title="👤 Identité du candidat">
        <TouchableOpacity onPress={pickImage} style={digitalStyles.photoRow} activeOpacity={0.7}>
          {photoUrl || formData.photo_uri ? (
            <Image source={{ uri: photoUrl || formData.photo_uri }} style={digitalStyles.photoImg} resizeMode="cover" />
          ) : (
            <View style={digitalStyles.photoPlaceholder}>
              <Icon name="camera-plus-outline" size={28} color="#CCC" />
              <Text style={digitalStyles.photoHint}>Photo</Text>
            </View>
          )}
          <Text style={digitalStyles.photoTap}>Touchez pour changer</Text>
        </TouchableOpacity>
        <FormField label="Nom" value={formData.nom} onChangeText={(t) => updateForm('nom', t)} placeholder="Nom de famille" required />
        <FormField label="Prénom(s)" value={formData.prenom} onChangeText={(t) => updateForm('prenom', t)} placeholder="Prénom(s)" required />
        <View style={digitalStyles.row}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <FormField
              label="Date naissance"
              value={formData.date_naissance}
              onChangeText={(t) => handleDateChange(t)}
              placeholder="AAAA-MM-JJ"
              keyboardType="numeric"
              error={dateError}
              autoCapitalize="none"
            />
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <FormField label="Lieu naissance" value={formData.lieu_naissance} onChangeText={(t) => updateForm('lieu_naissance', t)} placeholder="Ville" />
          </View>
        </View>
        {dateError ? (
          <Text style={digitalStyles.dateError}>{dateError}</Text>
        ) : null}
        <FormField label="Téléphone" value={formData.telephone} onChangeText={(t) => updateForm('telephone', t)} keyboardType="phone-pad" placeholder="+225 XX XX XX XX" />
        <FormField label="Nationalité" value={formData.nationalite} onChangeText={(t) => updateForm('nationalite', t)} placeholder="Nationalité" />
        <FormField label="Résidence" value={formData.lieu_residence} onChangeText={(t) => updateForm('lieu_residence', t)} placeholder="Quartier, ville" />
        <FormField label="Religion" value={formData.religion} onChangeText={(t) => updateForm('religion', t)} placeholder="(optionnel)" />
        <FormField label="Ethnie" value={formData.ethnie} onChangeText={(t) => updateForm('ethnie', t)} placeholder="(optionnel)" />
        {/* Sexe */}
        <Text style={digitalStyles.fieldLabel}>Sexe</Text>
        <View style={digitalStyles.chipRow}>
          {[{ value: 'masculin', label: 'Masculin' }, { value: 'feminin', label: 'Féminin' }].map((s) => (
            <TouchableOpacity
              key={s.value}
              onPress={() => updateForm('sexe', s.value)}
              style={[digitalStyles.chip, formData.sexe === s.value && digitalStyles.chipActive]}
              activeOpacity={0.7}
            >
              <Text style={[digitalStyles.chipText, formData.sexe === s.value && digitalStyles.chipTextActive]}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </SectionCard>

      {/* ── Situation matrimoniale ── */}
      <SectionCard title="💍 Situation matrimoniale">
        <View style={digitalStyles.chipRow}>
          {SITUATIONS_MATRIMONIALES.map((s) => (
            <TouchableOpacity key={s.value} onPress={() => updateForm('situation_matrimoniale', s.value)} style={[digitalStyles.chip, formData.situation_matrimoniale === s.value && digitalStyles.chipActive]} activeOpacity={0.7}>
              <Text style={[digitalStyles.chipText, formData.situation_matrimoniale === s.value && digitalStyles.chipTextActive]}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </SectionCard>

      {/* ── Niveau d'études ── */}
      <SectionCard title="📚 Niveau d'études">
        <View style={digitalStyles.chipRow}>
          {NIVEAUX_ETUDE.map((niv) => (
            <TouchableOpacity key={niv.value} onPress={() => updateForm('niveau_etude', niv.value)} style={[digitalStyles.chip, formData.niveau_etude === niv.value && digitalStyles.chipActive]} activeOpacity={0.7}>
              <Text style={[digitalStyles.chipText, formData.niveau_etude === niv.value && digitalStyles.chipTextActive]}>{niv.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </SectionCard>

      {/* ── Parents ── */}
      <SectionCard title="👨‍👩‍👦 Parents">
        <Text style={digitalStyles.parentLabel}>Père</Text>
        <FormField label="Nom" value={pere.nom} onChangeText={(t) => setPere({ ...pere, nom: t })} placeholder="Nom du père" />
        <FormField label="Prénom" value={pere.prenom} onChangeText={(t) => setPere({ ...pere, prenom: t })} placeholder="Prénom" />
        <FormField label="Téléphone" value={pere.telephone} onChangeText={(t) => setPere({ ...pere, telephone: t })} keyboardType="phone-pad" placeholder="Téléphone" />
        <FormField label="Domicile" value={pere.domicile} onChangeText={(t) => setPere({ ...pere, domicile: t })} placeholder="Domicile" />
        <Text style={digitalStyles.parentLabel}>Mère</Text>
        <FormField label="Nom" value={mere.nom} onChangeText={(t) => setMere({ ...mere, nom: t })} placeholder="Nom de la mère" />
        <FormField label="Prénom" value={mere.prenom} onChangeText={(t) => setMere({ ...mere, prenom: t })} placeholder="Prénom" />
        <FormField label="Téléphone" value={mere.telephone} onChangeText={(t) => setMere({ ...mere, telephone: t })} keyboardType="phone-pad" placeholder="Téléphone" />
        <FormField label="Domicile" value={mere.domicile} onChangeText={(t) => setMere({ ...mere, domicile: t })} placeholder="Domicile" />
      </SectionCard>

      {/* ── Contacts d'urgence ── */}
      <SectionCard title="🚨 Personnes à contacter en cas d'urgence">
        {personnesUrgence.map((p, idx) => (
          <View key={idx} style={digitalStyles.urgenceRow}>
            <Text style={digitalStyles.urgenceTitle}>Contact {idx + 1}</Text>
            <FormField label="Nom" value={p.nom} onChangeText={(t) => { const n = [...personnesUrgence]; n[idx] = { ...n[idx], nom: t }; setPersonnesUrgence(n); }} placeholder="Nom" />
            <FormField label="Prénom" value={p.prenom} onChangeText={(t) => { const n = [...personnesUrgence]; n[idx] = { ...n[idx], prenom: t }; setPersonnesUrgence(n); }} placeholder="Prénom" />
            <FormField label="Téléphone" value={p.telephone} onChangeText={(t) => { const n = [...personnesUrgence]; n[idx] = { ...n[idx], telephone: t }; setPersonnesUrgence(n); }} keyboardType="phone-pad" placeholder="Téléphone" />
          </View>
        ))}
        <TouchableOpacity onPress={() => setPersonnesUrgence([...personnesUrgence, { nom: '', prenom: '', telephone: '' }])} style={digitalStyles.addBtn} activeOpacity={0.7}>
          <Icon name="plus-circle" size={16} color={Colors.primary} />
          <Text style={digitalStyles.addBtnText}>Ajouter un contact</Text>
        </TouchableOpacity>
      </SectionCard>

      {/* ── Expérience ── */}
      <SectionCard title="💼 Expérience professionnelle">
        <TouchableOpacity onPress={() => updateForm('a_deja_travaille', !formData.a_deja_travaille)} style={digitalStyles.checkRow} activeOpacity={0.7}>
          <View style={[digitalStyles.checkbox, formData.a_deja_travaille && digitalStyles.checkboxChecked]}>
            {formData.a_deja_travaille && <Icon name="check" size={12} color="#FFF" />}
          </View>
          <Text style={digitalStyles.checkLabel}>A déjà travaillé</Text>
        </TouchableOpacity>
        {experiences.map((exp, idx) => (
          <View key={idx} style={digitalStyles.expRow}>
            <Text style={digitalStyles.expTitle}>Exp. {idx + 1}</Text>
            <FormField label="Entreprise" value={exp.entreprise} onChangeText={(t) => { const n = [...experiences]; n[idx] = { ...n[idx], entreprise: t }; setExperiences(n); }} placeholder="Entreprise" />
            <View style={digitalStyles.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <FormField label="Lieu" value={exp.lieu} onChangeText={(t) => { const n = [...experiences]; n[idx] = { ...n[idx], lieu: t }; setExperiences(n); }} placeholder="Lieu" />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <FormField label="Contact" value={exp.contact} onChangeText={(t) => { const n = [...experiences]; n[idx] = { ...n[idx], contact: t }; setExperiences(n); }} placeholder="Contact" />
              </View>
            </View>
          </View>
        ))}
        <TouchableOpacity onPress={() => setExperiences([...experiences, { entreprise: '', lieu: '', contact: '' }])} style={digitalStyles.addBtn} activeOpacity={0.7}>
          <Icon name="plus-circle" size={16} color={Colors.primary} />
          <Text style={digitalStyles.addBtnText}>Ajouter une expérience</Text>
        </TouchableOpacity>
        <FormField label="Détails de l'expérience" value={formData.experience_details} onChangeText={(t) => updateForm('experience_details', t)} multiline numberOfLines={3} placeholder="Décrivez brièvement..." />
        <View style={digitalStyles.row}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <FormField label="Stages effectués" value={formData.stages_effectues} onChangeText={(t) => updateForm('stages_effectues', t)} multiline numberOfLines={2} placeholder="Stages" />
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <FormField label="Formations" value={formData.formations} onChangeText={(t) => updateForm('formations', t)} multiline numberOfLines={2} placeholder="Formations" />
          </View>
        </View>
      </SectionCard>

      {/* ── Santé ── */}
      <SectionCard title="🩺 Santé (pour la fiche papier)">
        <FormField
          label="Allergie ou problèmes de santé"
          value={formData.allergie_sante}
          onChangeText={(t) => updateForm('allergie_sante', t)}
          multiline
          numberOfLines={2}
          placeholder="Précisez ou laissez vide si aucun"
        />
        <FormField
          label="Intervention(s) chirurgicale(s) déjà subie(s)"
          value={formData.intervention_chirurgicale}
          onChangeText={(t) => updateForm('intervention_chirurgicale', t)}
          multiline
          numberOfLines={2}
          placeholder="Précisez ou laissez vide si aucune"
        />
      </SectionCard>

      {/* ── Emploi recherché ── */}
      <SectionCard title="🎯 Emploi recherché">
        <Text style={digitalStyles.fieldLabel}>Catégorie d'emploi</Text>
        <View style={digitalStyles.chipRow}>
          {CATEGORIES_EMPLOI.map((cat) => (
            <TouchableOpacity key={cat.value} onPress={() => updateForm('categorie_emploi', cat.value)} style={[digitalStyles.chip, formData.categorie_emploi === cat.value && digitalStyles.chipActive]} activeOpacity={0.7}>
              <Text style={[digitalStyles.chipText, formData.categorie_emploi === cat.value && digitalStyles.chipTextActive]}>{cat.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <FormField label="Motivation" value={formData.motivation} onChangeText={(t) => updateForm('motivation', t)} multiline numberOfLines={3} placeholder="Pourquoi souhaitez-vous travailler via notre agence ?" />
      </SectionCard>

      {/* ── Documents associés ── */}
      <SectionCard title="📎 Documents associés">
        <View style={digitalStyles.docHeader}>
          <TouchableOpacity style={digitalStyles.docAddBtn} onPress={openDocTypePicker} activeOpacity={0.7}>
            <Icon name="plus" size={16} color={Colors.primary} />
            <Text style={digitalStyles.docAddText}>Ajouter</Text>
          </TouchableOpacity>
          {!employeId && (
            <Text style={digitalStyles.docEmpty}>Sera enregistré après l'inscription.</Text>
          )}
        </View>
          {documents.length === 0 ? (
            <Text style={digitalStyles.docEmpty}>{docsLoading ? 'Chargement…' : 'Aucun document.'}</Text>
          ) : (
            <View style={digitalStyles.docList}>
              {documents.map((d) => (
                <View key={d.id} style={digitalStyles.docItem}>
                  <Text style={digitalStyles.docIcon}>{getDocumentTypeIcon(d.type)}</Text>
                  <Text style={digitalStyles.docLabel} numberOfLines={1}>{getDocumentTypeLabel(d.type)}</Text>
                  <TouchableOpacity onPress={() => removeDocument(d.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Icon name="close" size={16} color="#b85454" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </SectionCard>

      {/* ── Historique ── */}
      {history.length > 0 && (
        <SectionCard title="📜 Historique des actions">
          {history.map((h: any) => (
            <View key={h.id} style={digitalStyles.histRow}>
              <Icon name="history" size={14} color={Colors.textSecondary} />
              <View style={digitalStyles.histContent}>
                <Text style={digitalStyles.histText}>{h.description}</Text>
                <Text style={digitalStyles.histTime}>{h.user_display} • {formatDate(h.created)}</Text>
              </View>
            </View>
          ))}
        </SectionCard>
      )}

      {/* ── Bouton enregistrer ── */}
      <SafeButton onPress={handleSave} loading={loading} disabled={locked} style={digitalStyles.submitBtn}>
        {locked ? 'Inscription enregistrée' : isEditing ? 'Enregistrer les modifications' : 'Inscrire'}
      </SafeButton>
    </ScrollView>
  );

  // ════════════════════════════════════════════════════════
  //  RENDU DU DOCUMENT
  // ════════════════════════════════════════════════════════
  const renderDocument = () => (
    <View style={docStyles.page}>
      {/* ── En-tête ──────────────────────────── */}
      <View style={docStyles.header}>
        <View style={docStyles.headerLeft}>
          <Text style={docStyles.agencyName}>CHRISROI AGENCE</Text>
          <Text style={docStyles.docTitle}>FICHE D'INSCRIPTION</Text>
          <Text style={docStyles.docSubtitle}>Demandeur d'emploi</Text>
        </View>
        <View style={docStyles.headerRight}>
          <Text style={docStyles.fieldLabel}>N° dossier</Text>
          <View style={docStyles.fieldUnderline}>
            <Text style={docStyles.fieldPlaceholder}>CHR-____</Text>
          </View>
          <Text style={[docStyles.fieldLabel, { marginTop: 8 }]}>Date</Text>
          <View style={docStyles.fieldUnderline}>
            <Text style={docStyles.fieldValue}>
              {formatDate(new Date().toISOString())}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Section 1 : Identité ────────────── */}
      <View style={docStyles.section}>
        <Text style={docStyles.sectionTitle}>
          1. IDENTITÉ DU CANDIDAT
        </Text>

        <View style={docStyles.identityRow}>
          {/* Photo */}
          <View style={docStyles.photoArea}>
            <TouchableOpacity onPress={pickImage} style={docStyles.photoBox}>
              {photoUrl || formData.photo_uri ? (
                <Image
                  source={{ uri: photoUrl || formData.photo_uri }}
                  style={docStyles.photoImg}
                  resizeMode="cover"
                />
              ) : (
                <View style={docStyles.photoPlaceholder}>
                  <Icon name="camera-plus-outline" size={24} color="#CCC" />
                  <Text style={docStyles.photoHint}>Photo</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Infos principales */}
          <View style={docStyles.identityFields}>
            <View style={docStyles.docRow}>
              <Text style={docStyles.fieldLabel}>Nom :</Text>
              <EditableField
                value={formData.nom}
                onChangeText={(t) => updateForm('nom', t)}
                placeholder="Nom de famille"
                fieldStyle={docStyles.fieldWide}
              />
            </View>
            <View style={docStyles.docRow}>
              <Text style={docStyles.fieldLabel}>Prénom(s) :</Text>
              <EditableField
                value={formData.prenom}
                onChangeText={(t) => updateForm('prenom', t)}
                placeholder="Prénom(s)"
                fieldStyle={docStyles.fieldWide}
              />
            </View>
            <View style={docStyles.docRow}>
              <Text style={docStyles.fieldLabel}>Né(e) le :</Text>
              <EditableField
                value={formData.date_naissance}
                onChangeText={(t) => updateForm('date_naissance', t)}
                placeholder="JJ/MM/AAAA"
                fieldStyle={docStyles.fieldMedium}
              />
              <Text style={[docStyles.fieldLabel, { marginLeft: 8 }]}>À :</Text>
              <EditableField
                value={formData.lieu_naissance}
                onChangeText={(t) => updateForm('lieu_naissance', t)}
                placeholder="Lieu"
                fieldStyle={docStyles.fieldMedium}
              />
            </View>
          </View>
        </View>

        {/* Autres infos */}
        <View style={docStyles.infoGrid}>
          <View style={docStyles.infoItem}>
            <Text style={docStyles.fieldLabel}>Téléphone</Text>
            <EditableField
              value={formData.telephone}
              onChangeText={(t) => updateForm('telephone', t)}
              placeholder="+225 XX XX XX XX"
            />
          </View>
          <View style={docStyles.infoItem}>
            <Text style={docStyles.fieldLabel}>Nationalité</Text>
            <EditableField
              value={formData.nationalite}
              onChangeText={(t) => updateForm('nationalite', t)}
              placeholder="Nationalité"
            />
          </View>
          <View style={docStyles.infoItem}>
            <Text style={docStyles.fieldLabel}>Résidence</Text>
            <EditableField
              value={formData.lieu_residence}
              onChangeText={(t) => updateForm('lieu_residence', t)}
              placeholder="Quartier, ville"
            />
          </View>
          <View style={docStyles.infoItem}>
            <Text style={docStyles.fieldLabel}>Religion</Text>
            <EditableField
              value={formData.religion}
              onChangeText={(t) => updateForm('religion', t)}
              placeholder="(optionnelle)"
            />
          </View>
        </View>

        {/* Situation matrimoniale */}
        <Text style={[docStyles.fieldLabel, { marginTop: 12 }]}>Situation matrimoniale</Text>
        <View style={docStyles.checkGroup}>
          {SITUATIONS_MATRIMONIALES.map((s) => (
            <CheckboxInline
              key={s.value}
              checked={formData.situation_matrimoniale === s.value}
              label={s.label}
              onToggle={() => updateForm('situation_matrimoniale', s.value)}
            />
          ))}
        </View>

        {/* Niveau d'études */}
        <Text style={[docStyles.fieldLabel, { marginTop: 12 }]}>Niveau d'étude</Text>
        <View style={docStyles.chipRow}>
          {NIVEAUX_ETUDE.map((niv) => (
            <TouchableOpacity
              key={niv.value}
              onPress={() => updateForm('niveau_etude', niv.value)}
              style={[
                docStyles.chip,
                formData.niveau_etude === niv.value && docStyles.chipActive,
              ]}
            >
              <Text
                style={[
                  docStyles.chipText,
                  formData.niveau_etude === niv.value && docStyles.chipTextActive,
                ]}
              >
                {niv.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Section 2 : Parents ─────────────── */}
      <View style={docStyles.section}>
        <Text style={docStyles.sectionTitle}>2. PARENTS</Text>

        <View style={docStyles.parentRow}>
          <View style={docStyles.parentCol}>
            <Text style={docStyles.fieldLabel}>Père</Text>
            <EditableField
              value={pere.nom}
              onChangeText={(t) => setPere({ ...pere, nom: t })}
              placeholder="Nom"
            />
            <EditableField
              value={pere.prenom}
              onChangeText={(t) => setPere({ ...pere, prenom: t })}
              placeholder="Prénom"
            />
            <EditableField
              value={pere.telephone}
              onChangeText={(t) => setPere({ ...pere, telephone: t })}
              placeholder="Téléphone"
            />
            <EditableField
              value={pere.domicile}
              onChangeText={(t) => setPere({ ...pere, domicile: t })}
              placeholder="Domicile / Quartier"
            />
          </View>
          <View style={docStyles.parentCol}>
            <Text style={docStyles.fieldLabel}>Mère</Text>
            <EditableField
              value={mere.nom}
              onChangeText={(t) => setMere({ ...mere, nom: t })}
              placeholder="Nom"
            />
            <EditableField
              value={mere.prenom}
              onChangeText={(t) => setMere({ ...mere, prenom: t })}
              placeholder="Prénom"
            />
            <EditableField
              value={mere.telephone}
              onChangeText={(t) => setMere({ ...mere, telephone: t })}
              placeholder="Téléphone"
            />
            <EditableField
              value={mere.domicile}
              onChangeText={(t) => setMere({ ...mere, domicile: t })}
              placeholder="Domicile / Quartier"
            />
          </View>
        </View>
      </View>

      {/* ── Section 3 : Urgences ────────────── */}
      <View style={docStyles.section}>
        <Text style={docStyles.sectionTitle}>3. PERSONNES À CONTACTER EN CAS D'URGENCE</Text>

        {personnesUrgence.map((p, idx) => (
          <View key={idx} style={docStyles.urgenceRow}>
            <Text style={docStyles.fieldLabel}>Contact {idx + 1} :</Text>
            <EditableField
              value={p.nom}
              onChangeText={(t) => {
                const next = [...personnesUrgence];
                next[idx] = { ...next[idx], nom: t };
                setPersonnesUrgence(next);
              }}
              placeholder="Nom"
              fieldStyle={docStyles.fieldSmall}
            />
            <EditableField
              value={p.prenom}
              onChangeText={(t) => {
                const next = [...personnesUrgence];
                next[idx] = { ...next[idx], prenom: t };
                setPersonnesUrgence(next);
              }}
              placeholder="Prénom"
              fieldStyle={docStyles.fieldSmall}
            />
            <EditableField
              value={p.telephone}
              onChangeText={(t) => {
                const next = [...personnesUrgence];
                next[idx] = { ...next[idx], telephone: t };
                setPersonnesUrgence(next);
              }}
              placeholder="Téléphone"
              fieldStyle={docStyles.fieldSmall}
            />
            {idx === personnesUrgence.length - 1 && (
              <TouchableOpacity
                onPress={() =>
                  setPersonnesUrgence([...personnesUrgence, { nom: '', prenom: '', telephone: '' }])
                }
                style={docStyles.addBtn}
              >
                <Icon name="plus-circle" size={16} color={Colors.primary} />
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>

      {/* ── Section 4 : Expérience ──────────── */}
      <View style={docStyles.section}>
        <Text style={docStyles.sectionTitle}>4. EXPÉRIENCE PROFESSIONNELLE</Text>

        <View style={docStyles.checkRow}>
          <CheckboxInline
            checked={formData.a_deja_travaille}
            label="A déjà travaillé"
            onToggle={() => updateForm('a_deja_travaille', !formData.a_deja_travaille)}
          />
        </View>

        {experiences.map((exp, idx) => (
          <View key={idx} style={docStyles.expRow}>
            <Text style={docStyles.fieldLabel}>Exp. {idx + 1} :</Text>
            <EditableField
              value={exp.entreprise}
              onChangeText={(t) => {
                const next = [...experiences];
                next[idx] = { ...next[idx], entreprise: t };
                setExperiences(next);
              }}
              placeholder="Entreprise"
              fieldStyle={docStyles.fieldMedium}
            />
            <EditableField
              value={exp.lieu}
              onChangeText={(t) => {
                const next = [...experiences];
                next[idx] = { ...next[idx], lieu: t };
                setExperiences(next);
              }}
              placeholder="Lieu"
              fieldStyle={docStyles.fieldSmall}
            />
            <EditableField
              value={exp.contact}
              onChangeText={(t) => {
                const next = [...experiences];
                next[idx] = { ...next[idx], contact: t };
                setExperiences(next);
              }}
              placeholder="Contact"
              fieldStyle={docStyles.fieldSmall}
            />
            {idx === experiences.length - 1 && (
              <TouchableOpacity
                onPress={() =>
                  setExperiences([...experiences, { entreprise: '', lieu: '', contact: '' }])
                }
                style={docStyles.addBtn}
              >
                <Icon name="plus-circle" size={16} color={Colors.primary} />
              </TouchableOpacity>
            )}
          </View>
        ))}

        <Text style={[docStyles.fieldLabel, { marginTop: 12 }]}>Détails de l'expérience</Text>
        <EditableField
          value={formData.experience_details}
          onChangeText={(t) => updateForm('experience_details', t)}
          placeholder="Décrivez brièvement..."
          fieldStyle={docStyles.fieldBlock}
          multiline
        />

        <View style={docStyles.docRow}>
          <View style={docStyles.halfField}>
            <Text style={docStyles.fieldLabel}>Stages effectués</Text>
            <EditableField
              value={formData.stages_effectues}
              onChangeText={(t) => updateForm('stages_effectues', t)}
              placeholder="Stages"
              multiline
            />
          </View>
          <View style={docStyles.halfField}>
            <Text style={docStyles.fieldLabel}>Formations</Text>
            <EditableField
              value={formData.formations}
              onChangeText={(t) => updateForm('formations', t)}
              placeholder="Formations/certifications"
              multiline
            />
          </View>
        </View>
      </View>

      {/* ── Section 5 : Emploi recherché ────── */}
      <View style={docStyles.section}>
        <Text style={docStyles.sectionTitle}>5. EMPLOI RECHERCHÉ</Text>

        <Text style={docStyles.fieldLabel}>Catégorie d'emploi</Text>
        <View style={docStyles.chipRow}>
          {CATEGORIES_EMPLOI.map((cat) => (
            <TouchableOpacity
              key={cat.value}
              onPress={() => updateForm('categorie_emploi', cat.value)}
              style={[
                docStyles.chip,
                formData.categorie_emploi === cat.value && docStyles.chipActive,
              ]}
            >
              <Text
                style={[
                  docStyles.chipText,
                  formData.categorie_emploi === cat.value && docStyles.chipTextActive,
                ]}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[docStyles.fieldLabel, { marginTop: 12 }]}>Motivation</Text>
        <EditableField
          value={formData.motivation}
          onChangeText={(t) => updateForm('motivation', t)}
          placeholder="Pourquoi souhaitez-vous travailler via notre agence ?"
          fieldStyle={docStyles.fieldBlock}
          multiline
        />
      </View>

      {/* ── Documents associés ─────────────────── */}
      <View style={docStyles.section}>
        <View style={docStyles.docSectionHeader}>
          <Text style={docStyles.sectionTitle}>📎 DOCUMENTS ASSOCIÉS</Text>
          <TouchableOpacity style={docStyles.docAddBtn} onPress={openDocTypePicker} activeOpacity={0.7}>
            <Icon name="plus" size={16} color={Colors.primary} />
            <Text style={docStyles.docAddBtnText}>Ajouter</Text>
          </TouchableOpacity>
        </View>

        {documents.length === 0 ? (
          <Text style={docStyles.docEmpty}>
            {docsLoading ? 'Chargement…' : 'Aucun document pour le moment.'}
          </Text>
        ) : (
          <View style={docStyles.docList}>
            {documents.map((d) => (
              <View key={d.id} style={docStyles.docItem}>
                <Text style={docStyles.docItemIcon}>{getDocumentTypeIcon(d.type)}</Text>
                <Text style={docStyles.docItemLabel} numberOfLines={1}>
                  {getDocumentTypeLabel(d.type)}
                </Text>
                <TouchableOpacity
                  style={docStyles.docItemRemove}
                  onPress={() => removeDocument(d.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Icon name="close" size={16} color="#b85454" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* ── Historique des actions ── */}
      {history.length > 0 && (
        <View style={docStyles.section}>
          <Text style={docStyles.sectionTitle}>HISTORIQUE</Text>
          {history.map((h: any) => (
            <View key={h.id} style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              <Icon name="history" size={14} color={Colors.textSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, color: Colors.textPrimary }}>{h.description}</Text>
                <Text style={{ fontSize: 11, color: Colors.textTertiary }}>{h.user_display} • {formatDate(h.created)}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* ── Section 6 : Signature ───────────── */}
      <View style={docStyles.section}>
        <Text style={docStyles.sectionTitle}>6. SIGNATURE</Text>

        <View style={docStyles.signatureRow}>
          <SignatureBox
            label="Le candidat"
            name={formData.nom ? `${formData.prenom} ${formData.nom}` : ''}
          />
          <SignatureBox
            label="L'agent"
          />
        </View>
        <Text style={docStyles.signatureNote}>
          Je certifie l'exactitude des informations fournies ci-dessus.
        </Text>
      </View>
    </View>
  );

  // ════════════════════════════════════════════════════════
  //  RENDU — Onglets Numérique / Scanné
  // ════════════════════════════════════════════════════════
  const renderScanTab = () => {
    const hasScan = scanData?.imageUrl;

    return (
      <View style={{ flex: 1, padding: 20, alignItems: 'center', justifyContent: 'center' }}>
        {scanLoading ? (
          <Text style={docStyles.scanLoadingText}>Chargement...</Text>
        ) : hasScan ? (
          <View style={docStyles.scanPreview}>
            <Image
              source={{ uri: scanData.imageUrl }}
              style={docStyles.scanImage}
              resizeMode="contain"
            />
            <Text style={docStyles.scanDate}>
              Scanné le {new Date(scanData.created).toLocaleDateString('fr-FR')}
            </Text>
          </View>
        ) : (
          <View style={docStyles.scanEmpty}>
            <Icon name="file-document-outline" size={48} color="#CCC" />
            <Text style={docStyles.scanEmptyText}>Aucun scan pour ce document</Text>
            {Platform.OS === 'web' ? (
              <>
                <TouchableOpacity
                  style={docStyles.scanBtn}
                  onPress={() => {
                    const input = document.getElementById('scan-file-input');
                    if (input) input.click();
                  }}
                >
                  <Icon name="camera-plus-outline" size={20} color="#FFF" />
                  <Text style={docStyles.scanBtnText}>Scanner le document signé</Text>
                </TouchableOpacity>
                <input
                  id="scan-file-input"
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleScanWeb}
                />
              </>
            ) : (
              <TouchableOpacity
                style={docStyles.scanBtn}
                onPress={handleScanDocument}
              >
                <Icon name="camera-plus-outline" size={20} color="#FFF" />
                <Text style={docStyles.scanBtnText}>Scanner le document signé</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      {/* ── Header ─────────────────────────────────────── */}
      <AppHeader title={headerTitle} showBack onBack={() => navigation.goBack()} />
      {/* ── Barre d'actions liées (fiche existante) ── */}
      {isEditing && (
        <View style={docStyles.linkedActionsBar}>
          <TouchableOpacity
            style={docStyles.linkedActionBtn}
            onPress={() => rootNavigation?.navigate('ContratsStack' as any, {
              screen: 'ContratsList',
              params: undefined
            })}
          >
            <Icon name="file-document-outline" size={16} color="#1E88E5" />
            <Text style={docStyles.linkedActionText}>Voir les contrats</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Onglets Numérique / Scanné ──────────────────── */}
      <View style={docStyles.tabBar}>
        <TouchableOpacity
          style={[docStyles.tab, activeTab === 'numerique' && docStyles.tabActive]}
          onPress={() => setActiveTab('numerique')}
        >
          <Icon
            name="file-document-edit-outline"
            size={16}
            color={activeTab === 'numerique' ? Colors.primary : '#888'}
          />
          <Text style={[docStyles.tabText, activeTab === 'numerique' && docStyles.tabTextActive]}>
            Numérique
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[docStyles.tab, activeTab === 'scanne' && docStyles.tabActive]}
          onPress={() => setActiveTab('scanne')}
        >
          <Icon
            name="scanner"
            size={16}
            color={activeTab === 'scanne' ? Colors.primary : '#888'}
          />
          <Text style={[docStyles.tabText, activeTab === 'scanne' && docStyles.tabTextActive]}>
            Scanné
          </Text>
          {scanData?.imageUrl && <View style={docStyles.scanBadge} />}
        </TouchableOpacity>
      </View>

      {/* ── Contenu selon l'onglet ──────────────── */}
      {activeTab === 'numerique' ? (
        renderDigitalForm()
      ) : (
        renderScanTab()
      )}

      {/* ── Modale de choix de source photo ──────────── */}
      <Modal
        visible={showSourcePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSourcePicker(false)}
      >
        <View style={docStyles.modalBackdrop}>
          <View style={docStyles.sourceSheet}>
            <Text style={docStyles.sourceTitle}>Photo d'identité</Text>
            <TouchableOpacity style={docStyles.sourceItem} onPress={pickFromLibrary}>
              <Icon name="image-multiple-outline" size={22} color={Colors.primary} />
              <Text style={docStyles.sourceLabel}>Choisir dans la galerie</Text>
            </TouchableOpacity>
            <TouchableOpacity style={docStyles.sourceItem} onPress={pickFromCamera}>
              <Icon name="camera-outline" size={22} color={Colors.primary} />
              <Text style={docStyles.sourceLabel}>Prendre une photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[docStyles.sourceItem, docStyles.sourceCancel]}
              onPress={() => setShowSourcePicker(false)}
            >
              <Text style={[docStyles.sourceLabel, { color: '#999' }]}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Modale : choix du type de document (étape 1) ── */}
      <Modal
        visible={showDocTypePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDocTypePicker(false)}
      >
        <View style={docStyles.modalBackdrop}>
          <View style={docStyles.sourceSheet}>
            <Text style={docStyles.sourceTitle}>De quoi s'agit-il ?</Text>
            <Text style={docStyles.sourceSubtitle}>Choisissez le type de document à ajouter</Text>
            {DOCUMENT_TYPES.map((t) => (
              <TouchableOpacity
                key={t.value}
                style={docStyles.docTypeItem}
                onPress={() => pickDocType(t.value)}
                activeOpacity={0.7}
              >
                <Text style={docStyles.docTypeIcon}>{t.icon}</Text>
                <Text style={docStyles.sourceLabel}>{t.label}</Text>
                <Icon name="chevron-right" size={20} color="#ccc" />
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[docStyles.sourceItem, docStyles.sourceCancel]}
              onPress={() => setShowDocTypePicker(false)}
            >
              <Text style={[docStyles.sourceLabel, { color: '#999' }]}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Modale : source du document (étape 2) ── */}
      <Modal
        visible={showDocSourcePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDocSourcePicker(false)}
      >
        <View style={docStyles.modalBackdrop}>
          <View style={docStyles.sourceSheet}>
            <Text style={docStyles.sourceTitle}>
              {docTypePending ? getDocumentTypeIcon(docTypePending) + ' ' + getDocumentTypeLabel(docTypePending) : 'Document'}
            </Text>
            <Text style={docStyles.sourceSubtitle}>Galerie ou appareil photo</Text>
            <TouchableOpacity
              style={docStyles.sourceItem}
              onPress={async () => {
                setShowDocSourcePicker(false);
                if (!(await requestLibraryPermission())) return;
                try {
                  const result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    quality: 0.85,
                  });
                  if (!result.canceled && result.assets[0]) {
                    uploadPendingDocument(result.assets[0].uri);
                  }
                } catch (e: any) {
                  Alert.alert('Erreur', e?.message || "Impossible d'ouvrir la galerie.");
                }
              }}
            >
              <Icon name="image-multiple-outline" size={22} color={Colors.primary} />
              <Text style={docStyles.sourceLabel}>Choisir dans la galerie</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={docStyles.sourceItem}
              onPress={async () => {
                setShowDocSourcePicker(false);
                if (!(await requestCameraPermission())) return;
                try {
                  const result = await ImagePicker.launchCameraAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    quality: 0.85,
                  });
                  if (!result.canceled && result.assets[0]) {
                    uploadPendingDocument(result.assets[0].uri);
                  }
                } catch (e: any) {
                  Alert.alert('Erreur', e?.message || "Impossible d'ouvrir l'appareil photo.");
                }
              }}
            >
              <Icon name="camera-outline" size={22} color={Colors.primary} />
              <Text style={docStyles.sourceLabel}>Prendre une photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[docStyles.sourceItem, docStyles.sourceCancel]}
              onPress={() => {
                setShowDocSourcePicker(false);
                setDocTypePending(null);
              }}
            >
              <Text style={[docStyles.sourceLabel, { color: '#999' }]}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Web : input file caché pour l'ajout de document */}
      {Platform.OS === 'web' && showDocSourcePicker ? (
        <input
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleDocWeb}
        />
      ) : null}
    </View>
  );
};

// ═══════════════════════════════════════════════════════════
//  STYLES DU DOCUMENT
// ═══════════════════════════════════════════════════════════
const docStyles = StyleSheet.create({
  page: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 2,
    borderBottomColor: '#c45a2a',
    paddingBottom: 16,
    marginBottom: 16,
  },
  headerLeft: {},
  agencyName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#c45a2a',
    letterSpacing: 1,
  },
  docTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    marginTop: 4,
  },
  docSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  // Champs document
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    marginBottom: 2,
  },
  fieldUnderline: {
    borderBottomWidth: 1,
    borderBottomColor: '#999',
    minWidth: 100,
    paddingBottom: 2,
  },
  fieldPlaceholder: {
    fontSize: 12,
    color: '#AAA',
  },
  fieldValue: {
    fontSize: 12,
    color: '#333',
  },
  // Sections
  section: {
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#c45a2a',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  // Identité
  identityRow: {
    flexDirection: 'row',
    gap: 16,
  },
  photoArea: {
    width: 90,
    alignItems: 'center',
  },
  photoBox: {
    width: 80,
    height: 90,
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  photoImg: {
    width: 80,
    height: 90,
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoHint: {
    fontSize: 9,
    color: '#AAA',
    marginTop: 2,
  },
  identityFields: {
    flex: 1,
    gap: 6,
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  fieldWide: {
    flex: 1,
  },
  fieldMedium: {
    flex: 0.5,
  },
  fieldSmall: {
    flex: 0.3,
  },
  fieldBlock: {
    minHeight: 48,
  },
  // Grille infos
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  infoItem: {
    flex: 1,
    minWidth: '45%',
  },
  // Checkbox
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: '#999',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  checkboxChecked: {
    backgroundColor: '#c45a2a',
    borderColor: '#c45a2a',
  },
  checkLabel: {
    fontSize: 12,
    color: '#333',
  },
  // Chips
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DDD',
    backgroundColor: '#FAFAFA',
  },
  chipActive: {
    backgroundColor: '#c45a2a',
    borderColor: '#c45a2a',
  },
  chipText: {
    fontSize: 10,
    color: '#666',
  },
  chipTextActive: {
    color: '#FFF',
    fontWeight: '600',
  },
  // Parents
  parentRow: {
    flexDirection: 'row',
    gap: 16,
  },
  parentCol: {
    flex: 1,
    gap: 4,
  },
  // Urgences
  urgenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  addBtn: {
    marginLeft: 4,
    padding: 4,
  },
  // Expérience
  expRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  halfField: {
    flex: 1,
    marginRight: 8,
  },
  // Signature
  signatureRow: {
    flexDirection: 'row',
    gap: 32,
    marginTop: 8,
  },
  signatureBox: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 8,
  },
  signatureLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  signatureInput: {
    fontSize: 14,
    textAlign: 'center',
    color: '#333',
    fontFamily: 'cursive',
    minWidth: 150,
  },
  signatureLine: {
    width: '100%',
    height: 1,
    backgroundColor: '#999',
    marginTop: 4,
  },
  signatureName: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
    fontStyle: 'italic',
  },
  signatureNote: {
    fontSize: 10,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
  // ── Onglets Numérique / Scanné ─────────────────
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: Colors.primary,
    backgroundColor: '#FFF',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#888',
  },
  tabTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  scanBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#5a7c3a',
  },
  // ── Scan ───────────────────────────────────────
  scanPreview: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
  },
  scanImage: {
    width: '100%',
    height: '80%',
  },
  scanDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    fontStyle: 'italic',
  },
  scanEmpty: {
    alignItems: 'center',
    gap: 12,
  },
  scanEmptyText: {
    fontSize: 14,
    color: '#999',
    marginBottom: 4,
  },
  scanEmptyHint: {
    fontSize: 12,
    color: '#BBB',
    fontStyle: 'italic',
  },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: Radius.md,
    gap: 8,
  },
  scanBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  scanLoadingText: {
    fontSize: 14,
    color: '#999',
  },
  // Champs éditables
  editableField: {
    fontSize: 12,
    color: '#333',
    borderBottomWidth: 1,
    borderBottomColor: '#CCC',
    paddingVertical: 2,
    paddingHorizontal: 4,
    minWidth: 60,
    minHeight: 22,
  },

  // Navigation liée
  linkedActionsBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F8FAFE',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  linkedActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  linkedActionText: { fontSize: 12, fontWeight: '600', color: '#1E88E5' },
  linkedActionBtnPrimary: {
    backgroundColor: '#EEF1F7',
    borderColor: '#1b2a4a',
  },
  linkedActionTextPrimary: { color: '#1b2a4a' },

  // ── Modale choix source photo ──
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sourceSheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingBottom: 24,
  },
  sourceTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
  },
  sourceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  sourceLabel: { fontSize: 16, color: '#222' },
  sourceCancel: { borderBottomWidth: 0, justifyContent: 'center' },
  sourceSubtitle: { fontSize: 13, color: '#999', marginTop: -8, marginBottom: 8 },

  // ── Documents associés ───────────────────────────
  docSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  docAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: Colors.primary + '0d',
  },
  docAddBtnText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  docEmpty: { fontSize: 13, color: '#999', fontStyle: 'italic', marginTop: 8 },
  docList: { marginTop: 8, gap: 6 },
  docItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F0E4D6',
    backgroundColor: '#FEFAF5',
  },
  docItemIcon: { fontSize: 18 },
  docItemLabel: { flex: 1, fontSize: 14, color: '#3D3530' },
  docItemRemove: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FDECEC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docTypeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  docTypeIcon: { fontSize: 22 },

  // ── Éditeur photo (styles conservés pour compatibilité) ──
  editorRoot: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },
  editorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  editorTitle: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  editorCancel: { color: '#FF6B6B', fontSize: 15 },
  editorDone: { color: '#5a7c3a', fontSize: 15, fontWeight: '700' },
  editorStage: {
    overflow: 'hidden',
    borderRadius: 4,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorHint: {
    color: '#AAA',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 20,
    paddingHorizontal: 24,
  },
});

const digitalStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' as const },
  photoRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 16, marginBottom: 16 },
  photoImg: { width: 80, height: 80, borderRadius: 40 },
  photoPlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#f0f0f0', justifyContent: 'center' as const, alignItems: 'center' as const },
  photoHint: { fontSize: 11, color: '#CCC', marginTop: 4 },
  photoTap: { fontSize: 13, color: Colors.textSecondary },
  parentLabel: { fontSize: 14, fontWeight: '600' as const, color: Colors.textPrimary, marginTop: 8, marginBottom: 4 },
  fieldLabel: { fontSize: 12, fontWeight: '600' as const, color: Colors.textSecondary, marginBottom: 4, marginTop: 8 },
  chipRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F5F5F5' },
  chipActive: { backgroundColor: Colors.primary },
  chipText: { fontSize: 12, color: '#666' },
  chipTextActive: { color: '#FFF', fontWeight: '600' as const },
  urgenceRow: { marginTop: 8 },
  urgenceTitle: { fontSize: 12, fontWeight: '600' as const, color: Colors.textSecondary, marginBottom: 4 },
  expRow: { marginTop: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E0E0E0' },
  expTitle: { fontSize: 12, fontWeight: '600' as const, color: Colors.textSecondary, marginBottom: 4 },
  addBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, marginTop: 8 },
  addBtnText: { fontSize: 13, color: Colors.primary, fontWeight: '600' as const },
  checkRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, marginBottom: 8 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: '#CCC' },
  checkboxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkLabel: { fontSize: 14, color: Colors.textPrimary },
  docHeader: { flexDirection: 'row' as const, justifyContent: 'flex-end' as const },
  docAddBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: Colors.primary, borderRadius: 16 },
  docAddText: { fontSize: 13, fontWeight: '600' as const, color: Colors.primary },
  docEmpty: { fontSize: 13, color: '#999', fontStyle: 'italic' as const, marginTop: 8 },
  docList: { marginTop: 8, gap: 6 },
  docItem: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, paddingVertical: 6 },
  docIcon: { fontSize: 18 },
  docLabel: { flex: 1, fontSize: 13, color: Colors.textPrimary },
  histRow: { flexDirection: 'row' as const, gap: 8, marginBottom: 8 },
  histContent: { flex: 1 },
  histText: { fontSize: 13, color: Colors.textPrimary },
  histTime: { fontSize: 11, color: Colors.textTertiary, marginTop: 2 },
  submitBtn: { marginTop: 24 },
  dateError: { fontSize: 12, color: Colors.danger, marginTop: 4, marginLeft: 4 },
});
