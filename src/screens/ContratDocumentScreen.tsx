import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  StyleSheet,
  Alert,
  TouchableOpacity,
  TouchableWithoutFeedback,
  FlatList,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { ContratDocumentNavigationProp } from '../types/navigation';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { printToFileAsync } from 'expo-print';
import A4Document from '../components/A4Document';
import AppHeader from '../components/AppHeader';
import FormField from '../components/FormField';
import SafeButton from '../components/SafeButton';
import { buildContratHtml } from '../utils/contratPrint';
import {
  createContrat,
  updateContrat,
  getContratById,
  getEmployeById,
  getEmployeurById,
  getAllEmployes,
  getAllEmployeurs,
  uploadScan,
  getScan,
  getEmployePhotoUrl,
  patchContratField,
  getDocumentsByContrat,
  uploadContratDocument,
  deleteDocument,
  getDocumentTypeLabel,
  getDocumentTypeIcon,
  DOCUMENT_TYPES,
} from '../database/service';
import { Colors, Spacing, Radius } from '../theme';
import { DocumentViewerOverlay, useDocumentViewer } from '../components/DocumentViewer';

// ── Helpers ──────────────────────────────────────────────────
function calcAge(dateNaissance?: string | null): number | null {
  if (!dateNaissance) return null;
  const d = new Date(String(dateNaissance));
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 ? age : null;
}

// ── LockedField (C1) ───────────────────────────────────────
function LockedField({
  fieldKey,
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  numberOfLines,
  keyboardType,
  required,
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
  required?: boolean;
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
    <View>
      <View style={[digitalStyles.lockedRow, !unlocked && digitalStyles.lockedRowLocked]}>
        <FormField
          label={label}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          multiline={multiline}
          numberOfLines={numberOfLines}
          keyboardType={keyboardType}
          required={required}
          disabled={!unlocked}
          style={{ flex: 1 }}
        />
        {isEditing && (
          <TouchableOpacity
            onPress={unlocked ? handleSavePatch : () => onToggleLock(fieldKey)}
            style={digitalStyles.lockBtn}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Icon name={unlocked ? 'check-circle' : 'lock'} size={20} color={unlocked ? Colors.success : Colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function LockToggle({
  fieldKey,
  unlocked,
  onToggleLock,
  onPatch,
  isEditing,
  currentValue,
}: {
  fieldKey: string;
  unlocked: boolean;
  onToggleLock: (key: string) => void;
  onPatch: (key: string, value: any) => Promise<void>;
  isEditing: boolean;
  currentValue: any;
}) {
  const handleValidate = async () => {
    try {
      await onPatch(fieldKey, currentValue);
      Alert.alert('Modifié', 'Champ enregistré.');
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Enregistrement impossible.');
      return;
    }
    onToggleLock(fieldKey);
  };
  return (
    <TouchableOpacity
      onPress={unlocked ? handleValidate : () => onToggleLock(fieldKey)}
      style={digitalStyles.lockToggleRow}
      activeOpacity={0.7}
    >
      <Icon name={unlocked ? 'check-circle' : 'lock'} size={14} color={unlocked ? Colors.success : Colors.textTertiary} />
      <Text style={[digitalStyles.lockToggleText, unlocked && { color: Colors.success }]}>
        {unlocked ? 'Valider' : 'Déverrouiller'}
      </Text>
    </TouchableOpacity>
  );
}

// ── EMPTY_FORM prestation (snapshot) ────────────────────────
const EMPTY_FORM = {
  employe_id: '',
  employe_nom: '',
  employe_prenom: '',
  employe_photo_url: '',
  employe_age: '',
  employe_sexe: 'Masculin',
  employe_adresse_actuelle: '',
  employe_piece_reference: '',
  employeur_id: '',
  employeur_nom: '',
  client_domicile: '',
  client_piece_numero: '',
  client_piece_date: '',
  numero_dossier: '',
  date_signature: '',
  poste: '',
  commission_fixe: '15000',
  frais_transport: '5000',
  retenue_salaire_montant: '',
  salaire: '',
  duree: '3 mois',
  date_contrat: '',
  date_debut: '',
  signature_employe: '',
  signature_agence: '',
  signature_employeur: '',
};

export default function ContratDocumentScreen() {
  const navigation = useNavigation<ContratDocumentNavigationProp>();
  const route = useRoute<any>();
  const contratId = route.params?.id;
  const preselectedEmployeId = route.params?.employe_id;

  const [formData, setFormData] = useState<any>({ ...EMPTY_FORM });
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showEmployePicker, setShowEmployePicker] = useState(false);
  const [showEmployeurPicker, setShowEmployeurPicker] = useState(false);
  const [employes, setEmployes] = useState<any[]>([]);
  const [employeurs, setEmployeurs] = useState<any[]>([]);
  const [selectedEmploye, setSelectedEmploye] = useState<any>(null);
  const [selectedEmployeur, setSelectedEmployeur] = useState<any>(null);

  const [activeTab, setActiveTab] = useState<'numerique' | 'scanne'>('numerique');
  const [scanData, setScanData] = useState<any>(null);
  const [scanLoading, setScanLoading] = useState(false);

  // C1 verrouillage
  const [unlockedFields, setUnlockedFields] = useState<Set<string>>(new Set());
  const fieldUnlocked = (key: string) => !isEditing || unlockedFields.has(key);
  const toggleFieldLock = (key: string) =>
    setUnlockedFields((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  const patchField = async (key: string, value: any) => {
    if (!contratId) return;
    await patchContratField(contratId, key, value);
  };

  // Annexes contrat
  const [documents, setDocuments] = useState<any[]>([]);
  const [pendingDocuments, setPendingDocuments] = useState<{ type: string; uri: string; name?: string; mimeType?: string }[]>([]);
  const DOC_DELETE_PIN = '0000';
  const [pinVisible, setPinVisible] = useState(false);
  const [pinValue, setPinValue] = useState('');
  const [pinTargetDocId, setPinTargetDocId] = useState<string | null>(null);
  const docViewer = useDocumentViewer();

  const requestDeleteDocument = (docId: string) => {
    setPinTargetDocId(docId);
    setPinValue('');
    setPinVisible(true);
  };
  const confirmDeleteDocument = async () => {
    if (pinValue !== DOC_DELETE_PIN) {
      Alert.alert('Code PIN incorrect', 'La suppression est annulée.');
      setPinVisible(false);
      setPinTargetDocId(null);
      return;
    }
    const id = pinTargetDocId;
    setPinVisible(false);
    setPinTargetDocId(null);
    if (id) await doRemoveDocument(id);
  };
  const doRemoveDocument = async (docId: string) => {
    try {
      await deleteDocument(docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Suppression impossible.');
    }
  };
  const openDocumentViewer = (doc: any) => {
    const uri = doc?.imageUrl || doc?.uri;
    if (!uri) return;
    docViewer.open({ uri, label: getDocumentTypeLabel(doc.type), fileName: doc?.nomFichier || doc?.file || null, mimeType: doc?.mimeType || null });
  };
  const loadDocuments = useCallback(async () => {
    if (!contratId) return;
    try {
      const docs = await getDocumentsByContrat(contratId);
      setDocuments(docs || []);
    } catch (e) { console.warn('loadDocuments contrat error', e); }
  }, [contratId]);

  useEffect(() => { if (contratId) loadDocuments(); }, [contratId, loadDocuments]);

  const updateForm = (key: string, value: any) => setFormData((prev: any) => ({ ...prev, [key]: value }));

  // Charger listes
  useEffect(() => {
    (async () => {
      try {
        const [emps, empurs] = await Promise.all([getAllEmployes(), getAllEmployeurs()]);
        setEmployes(emps);
        setEmployeurs(empurs);
      } catch (err) { console.error('Erreur chargement listes:', err); }
    })();
  }, []);

  // Edition : charger contrat
  useEffect(() => {
    if (!contratId) return;
    setIsEditing(true);
    (async () => {
      try {
        const contrat = await getContratById(contratId);
        if (!contrat) { Alert.alert('Erreur', 'Contrat introuvable'); navigation.goBack(); return; }
        const employe = contrat.employe_id ? await getEmployeById(typeof contrat.employe_id === 'string' ? contrat.employe_id : contrat.employe_id.id) : null;
        const employeur = contrat.employeur_id ? await getEmployeurById(typeof contrat.employeur_id === 'string' ? contrat.employeur_id : contrat.employeur_id.id) : null;
        setFormData({
          employe_id: employe?.id || contrat.employe_id || '',
          employe_nom: contrat.employe_nom || employe?.nom || '',
          employe_prenom: contrat.employe_prenom || employe?.prenom || '',
          employe_photo_url: employe ? getEmployePhotoUrl(employe.id, employe.photo) : '',
          employe_age: contrat.employe_age ? String(contrat.employe_age) : (calcAge(employe?.date_naissance) ? String(calcAge(employe?.date_naissance)) : ''),
          employe_sexe: contrat.employe_sexe || employe?.sexe || 'Masculin',
          employe_adresse_actuelle: contrat.employe_adresse_actuelle || employe?.lieu_residence || '',
          employe_piece_reference: contrat.employe_piece_reference || employe?.piece_reference || '',
          employeur_id: employeur?.id || contrat.employeur_id || '',
          employeur_nom: contrat.client_nom_snapshot || employeur?.nom_complet || contrat.nom_complet || '',
          client_domicile: contrat.client_domicile || employeur?.adresse || '',
          client_piece_numero: contrat.client_piece_numero || employeur?.piece_numero || '',
          client_piece_date: contrat.client_piece_date || employeur?.piece_date || '',
          numero_dossier: contrat.numero_dossier || '',
          date_signature: contrat.date_signature || contrat.date_contrat || '',
          poste: contrat.poste || '',
          commission_fixe: String(contrat.commission_fixe ?? 15000),
          frais_transport: String(contrat.frais_transport ?? 5000),
          retenue_salaire_montant: contrat.retenue_salaire_montant ? String(contrat.retenue_salaire_montant) : (contrat.salaire ? String(Math.round(Number(contrat.salaire)/3)) : ''),
          salaire: contrat.salaire ? String(contrat.salaire) : '',
          duree: contrat.duree || '3 mois',
          date_contrat: contrat.date_contrat || '',
          date_debut: contrat.date_debut || '',
          signature_employe: contrat.signature_employe || '',
          signature_agence: contrat.signature_agence || '',
          signature_employeur: contrat.signature_employeur || '',
        });
        setSelectedEmploye(employe);
        setSelectedEmployeur(employeur);
      } catch (err) { console.error('Erreur chargement contrat:', err); Alert.alert('Erreur', 'Impossible de charger le contrat'); }
    })();
  }, [contratId, navigation]);

  useEffect(() => {
    if (!preselectedEmployeId || contratId) return;
    (async () => {
      try {
        const emp = await getEmployeById(preselectedEmployeId);
        if (emp) { setSelectedEmploye(emp); fillEmployeData(emp); }
      } catch {}
    })();
  }, [preselectedEmployeId, contratId]);

  const fillEmployeData = (emp: any) => {
    const age = calcAge(emp.date_naissance);
    setFormData((prev: any) => ({
      ...prev,
      employe_id: emp.id,
      employe_nom: emp.nom || '',
      employe_prenom: emp.prenom || '',
      employe_photo_url: getEmployePhotoUrl(emp.id, emp.photo),
      employe_age: age ? String(age) : prev.employe_age,
      employe_sexe: emp.sexe || prev.employe_sexe,
      employe_adresse_actuelle: emp.lieu_residence || prev.employe_adresse_actuelle,
      employe_piece_reference: emp.piece_reference || prev.employe_piece_reference,
    }));
  };

  const handleSelectEmploye = async (item: any) => {
    setSelectedEmploye(item);
    setFormData((prev: any) => ({ ...prev, employe_id: item.id, employe_nom: item.nom || '', employe_prenom: item.prenom || '', employe_photo_url: getEmployePhotoUrl(item.id, item.photo) }));
    try {
      const full = await getEmployeById(item.id);
      if (full) { setSelectedEmploye(full); fillEmployeData(full); }
    } catch (err) { console.warn('getEmployeById fail', err); }
  };

  const handleSelectEmployeur = async (item: any) => {
    setSelectedEmployeur(item);
    setFormData((prev: any) => ({ ...prev, employeur_id: item.id, employeur_nom: item.nom_complet || item.raison_sociale || item.nom || '', client_domicile: item.adresse || '', client_piece_numero: item.piece_numero || prev.client_piece_numero, client_piece_date: item.piece_date || prev.client_piece_date }));
    try {
      const full = await getEmployeurById(item.id);
      if (full) {
        setSelectedEmployeur(full);
        setFormData((prev: any) => ({ ...prev, client_domicile: full.adresse || prev.client_domicile, client_piece_numero: (full as any).piece_numero || prev.client_piece_numero, client_piece_date: (full as any).piece_date || prev.client_piece_date, employeur_nom: full.nom_complet || full.raison_sociale || full.nom || prev.employeur_nom }));
      }
    } catch {}
  };

  // Sauvegarde
  const handleSave = async () => {
    if (!formData.employe_id || !formData.employeur_id) { Alert.alert('Champs requis', 'Sélectionnez un employé et un client.'); return; }
    if (!formData.poste.trim()) { Alert.alert('Champs requis', 'Le poste attribué est obligatoire.'); return; }
    setLoading(true);
    try {
      const payload: any = {
        employe_id: formData.employe_id,
        employeur_id: formData.employeur_id,
        poste: formData.poste,
        date_signature: formData.date_signature || new Date().toISOString(),
        date_contrat: formData.date_signature || formData.date_contrat || new Date().toISOString(),
        date_debut: formData.date_signature || formData.date_debut || new Date().toISOString(),
        duree: formData.duree || '3 mois',
        commission_fixe: parseInt(formData.commission_fixe) || 15000,
        frais_transport: parseInt(formData.frais_transport) || 5000,
        retenue_salaire_montant: parseInt(formData.retenue_salaire_montant) || (formData.salaire ? Math.round(parseFloat(formData.salaire)/3) : 0),
        salaire: parseFloat(formData.salaire) || 0,
        client_domicile: formData.client_domicile,
        client_piece_numero: formData.client_piece_numero,
        client_piece_date: formData.client_piece_date,
        employe_age: parseInt(formData.employe_age) || null,
        employe_sexe: formData.employe_sexe,
        employe_adresse_actuelle: formData.employe_adresse_actuelle,
        employe_piece_reference: formData.employe_piece_reference,
      };
      let id = contratId;
      if (isEditing && contratId) {
        await updateContrat(contratId, payload);
      } else {
        id = await createContrat(payload);
        setIsEditing(true);
        // @ts-ignore navigation
        navigation.setParams?.({ id });
      }
      // Upload pending annexes si création
      if (pendingDocuments.length > 0 && id) {
        let ok = 0, fail = 0;
        for (const p of pendingDocuments) {
          const rid = await uploadContratDocument(id, p.type, p.uri, p.name, p.mimeType);
          if (rid) ok++; else fail++;
        }
        setPendingDocuments([]);
        if (id) { const docs = await getDocumentsByContrat(id); setDocuments(docs || []); }
        if (fail > 0) Alert.alert('Contrat créé', `${ok} annexe(s) ajoutée(s), ${fail} échec(s).`);
        else if (ok > 0) Alert.alert('Succès', `Contrat créé avec ${ok} annexe(s).`);
        else Alert.alert('Succès', 'Contrat créé');
      } else {
        Alert.alert('Succès', isEditing ? 'Contrat modifié' : 'Contrat créé');
      }
    } catch (e: any) { console.error('save contrat', e); Alert.alert('Erreur', e?.message || "Échec de l'enregistrement"); }
    finally { setLoading(false); }
  };

  const handlePrint = async () => {
    try {
      const c: any = {
        numero_dossier: formData.numero_dossier || `CHR-${new Date().getFullYear()}-XXXX`,
        poste: formData.poste,
        date_signature: formData.date_signature,
        date_contrat: formData.date_signature || formData.date_contrat,
        client_domicile: formData.client_domicile,
        client_piece_numero: formData.client_piece_numero,
        client_piece_date: formData.client_piece_date,
        employe_age: formData.employe_age,
        employe_sexe: formData.employe_sexe,
        employe_adresse_actuelle: formData.employe_adresse_actuelle,
        employe_piece_reference: formData.employe_piece_reference,
        frais_transport: formData.frais_transport,
        retenue_salaire_montant: formData.retenue_salaire_montant,
        salaire: formData.salaire,
      };
      const html = buildContratHtml({ contrat: c, employe: selectedEmploye, employeur: selectedEmployeur });
      if (Platform.OS === 'web') {
        const w = window.open('', '_blank');
        if (w) { w.document.write(html); w.document.close(); w.print(); }
        return;
      }
      const { uri } = await printToFileAsync({ html, base64: false });
      const can = await Sharing.isAvailableAsync();
      if (can) await Sharing.shareAsync(uri, { dialogTitle: 'Contrat de prestation' });
      else Alert.alert('PDF prêt', uri);
    } catch (e: any) { Alert.alert('Erreur', e?.message || 'Impression impossible'); }
  };

  // Scan
  const handleScanDocument = async () => {
    try {
      setScanLoading(true);
      const camPerm = await ImagePicker.requestCameraPermissionsAsync();
      if (camPerm.status !== 'granted') {
        const libPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (libPerm.status !== 'granted') { Alert.alert('Permission refusée', "Autorisez l'appareil photo ou la galerie."); setScanLoading(false); return; }
        const libRes = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.85, allowsEditing: false });
        if (libRes.canceled || !libRes.assets[0]) { setScanLoading(false); return; }
        const docId = isEditing ? contratId : null;
        if (!docId) { Alert.alert('Info', "Enregistrez d'abord le contrat avant de scanner."); setScanLoading(false); return; }
        await uploadScan('contrat', docId, libRes.assets[0].uri);
        setScanData(await getScan('contrat', docId));
        Alert.alert('Scan ajouté', 'Document scanné enregistré.');
        setScanLoading(false); return;
      }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.85, allowsEditing: false });
      if (result.canceled || !result.assets[0]) { setScanLoading(false); return; }
      const docId = isEditing ? contratId : null;
      if (!docId) { Alert.alert('Info', "Enregistrez d'abord le contrat avant de scanner."); setScanLoading(false); return; }
      await uploadScan('contrat', docId, result.assets[0].uri);
      setScanData(await getScan('contrat', docId));
      Alert.alert('Scan ajouté', 'Document scanné enregistré.');
      setScanLoading(false);
    } catch (e: any) { console.warn('[scan-contrat]', e?.message); Alert.alert('Scan', e?.message || 'Le scan a échoué.'); setScanLoading(false); }
  };
  const handleScanWeb = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return; (e.target as HTMLInputElement).value = '';
    const docId = isEditing ? contratId : null;
    if (!docId) { Alert.alert('Info', "Enregistrez d'abord le contrat avant de scanner."); return; }
    try { setScanLoading(true); await uploadScan('contrat', docId, file); setScanData(await getScan('contrat', docId)); Alert.alert('Scan ajouté', 'Document scanné enregistré.'); } catch (err: any) { Alert.alert('Erreur', err?.message || "Échec de l'upload"); } finally { setScanLoading(false); }
  };
  useEffect(() => { if (contratId) getScan('contrat', contratId).then(setScanData).catch(()=>{}); }, [contratId]);

  const handleSelectPicker = (isEmploye: boolean, item: any, onDismiss: () => void) => {
    if (isEmploye) handleSelectEmploye(item); else handleSelectEmployeur(item);
    onDismiss();
  };

  // Annexes handlers
  const handleAddAnnexe = async (type: string, uri: string, name?: string, mimeType?: string) => {
    if (!isEditing || !contratId) {
      setPendingDocuments((prev) => [...prev, { type, uri, name, mimeType }]);
      return;
    }
    const id = await uploadContratDocument(contratId, type, uri, name, mimeType);
    if (id) { const docs = await getDocumentsByContrat(contratId); setDocuments(docs || []); }
    else Alert.alert('Erreur', "Échec de l'ajout d'annexe");
  };
  const handlePickAnnexe = async (type: string) => {
    try {
      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        input.onchange = async () => {
          const f = input.files?.[0]; if (!f) return;
          await handleAddAnnexe(type, f as any, f.name, f.type);
        };
        input.click(); return;
      }
      const res = await DocumentPicker.getDocumentAsync({ type: ['image/*','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'], copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.[0]) return;
      const a = res.assets[0];
      await handleAddAnnexe(type, a.uri, a.name, a.mimeType || undefined);
    } catch (e: any) { Alert.alert('Erreur', e?.message || 'Sélection impossible'); }
  };

  const renderPickerModal = (
    visible: boolean,
    onDismiss: () => void,
    items: any[],
    onSelect: (item: any) => void,
    selectedId: string,
    isEmploye: boolean,
  ) => (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.modalOverlay}>
        <TouchableWithoutFeedback onPress={onDismiss}><View style={StyleSheet.absoluteFill} /></TouchableWithoutFeedback>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{isEmploye ? 'Sélectionner un employé' : 'Sélectionner un client'}</Text>
            <TouchableOpacity onPress={onDismiss}><Icon name="close" size={22} color={Colors.textSecondary} /></TouchableOpacity>
          </View>
          {items.length === 0 ? (
            <View style={styles.modalEmpty}><Text style={styles.modalEmptyText}>{isEmploye ? 'Aucun employé' : 'Aucun client'}</Text></View>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const isSelected = item.id === selectedId;
                const label = isEmploye ? `${item.prenom || ''} ${item.nom || ''}`.trim() : item.nom_complet || item.raison_sociale || item.nom || '';
                const subtitle = isEmploye ? item.categorie_emploi || '' : item.telephone || '';
                return (
                  <TouchableOpacity style={[styles.pickerItem, isSelected && styles.pickerItemSelected]} onPress={() => { onSelect(item); onDismiss(); }}>
                    <Text style={[styles.pickerItemText, isSelected && styles.pickerItemTextSelected]}>{label}</Text>
                    {subtitle ? <Text style={styles.pickerItemSub}>{subtitle}</Text> : null}
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );

  const renderScanTab = () => {
    const hasScan = scanData?.imageUrl;
    return (
      <View style={{ flex: 1, padding: 0 }}>
        {scanLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}><Text style={{ color: Colors.textSecondary }}>Chargement...</Text></View>
        ) : hasScan ? (
          <View style={{ flex: 1 }}>
            <TouchableOpacity onPress={() => docViewer.open({ uri: scanData.imageUrl, label: 'Scan contrat signé', fileName: null, mimeType: 'image/jpeg' })} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0a0f', minHeight: 380 }}>
              <Image source={{ uri: scanData.imageUrl }} style={{ width: '100%', height: 420 }} resizeMode="contain" />
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: 10, padding: 14 }}>
              <SafeButton onPress={handleScanDocument} mode="outlined" style={{ flex: 1 }}>Remplacer</SafeButton>
              <SafeButton onPress={async () => {
                try {
                  const isRemote = /^https?:\/\//i.test(scanData.imageUrl);
                  let localUri = scanData.imageUrl;
                  if (isRemote) {
                    const tmp = (FileSystem as any).cacheDirectory + `scan_contrat_${contratId}.jpg`;
                    const dl = await (FileSystem as any).downloadAsync(scanData.imageUrl, tmp);
                    localUri = dl.uri;
                  }
                  const can = await Sharing.isAvailableAsync();
                  if (can) await (Sharing as any).shareAsync(localUri, { dialogTitle: 'Scan contrat signé' });
                } catch (e: any) { Alert.alert('Scan', e?.message || 'Téléchargement impossible.'); }
              }} mode="contained" style={{ flex: 1 }}><Icon name="download-outline" size={16} color="#fff" /><Text style={{ color: "#fff", fontWeight: "600", marginLeft: 6 }}>Télécharger</Text></SafeButton>
            </View>
          </View>
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 }}>
            <Icon name="file-image-outline" size={48} color={Colors.textTertiary} />
            <Text style={{ color: Colors.textSecondary, textAlign: 'center' }}>Aucun scan. Enregistrez d'abord le contrat puis scannez le document signé.</Text>
            <SafeButton onPress={handleScanDocument} mode="contained"><Icon name="camera" size={18} color="#fff" /><Text style={{ color: "#fff", fontWeight: "600", marginLeft: 6 }}>Scanner le document signé</Text></SafeButton>
            {Platform.OS === 'web' && (
              <View style={{ width: '100%', alignItems: 'center' }}>
                <Text style={{ fontSize: 12, color: Colors.textSecondary, marginBottom: 8 }}>ou importer un fichier</Text>
                <input type="file" accept="image/*,application/pdf" onChange={handleScanWeb as any} style={{ fontSize: 14 } as any} />
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  // ── Rendu numérique prestation ──────────────────────────
  const renderNumerique = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
      {/* En-tête prestation */}
      <View style={digitalStyles.headerCard}>
        <Text style={digitalStyles.headerTitle}>Contrat de prestation de service</Text>
        <Text style={digitalStyles.headerSub}>Réf. {formData.numero_dossier || `CHR-${new Date().getFullYear()}-XXXX`} • 3 mois de suivi • Art. 1-10</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <View style={digitalStyles.badge}><Text style={digitalStyles.badgeText}>CRA 500k • RCCM CI-2023-0063618S</Text></View>
        </View>
      </View>

      {/* Client (ex-employeur) */}
      <View style={digitalStyles.sectionCard}>
        <View style={digitalStyles.sectionHead}>
          <Text style={digitalStyles.sectionTitle}>Client</Text>
          <TouchableOpacity onPress={() => setShowEmployeurPicker(true)} style={digitalStyles.pickBtn}>
            <Icon name="account-search" size={16} color={Colors.primary} /><Text style={digitalStyles.pickBtnText}>{selectedEmployeur ? 'Changer' : 'Choisir un client'}</Text>
          </TouchableOpacity>
        </View>
        {selectedEmployeur ? <Text style={digitalStyles.pickHint}>{selectedEmployeur.nom_complet || selectedEmployeur.nom} • {selectedEmployeur.telephone || ''}</Text> : <Text style={digitalStyles.pickHintMuted}>Sélectionnez un client existant pour pré-remplir — sinon saisissez manuellement.</Text>}
        <LockedField fieldKey="employeur_nom" label="Nom complet du client *" value={formData.employeur_nom} onChangeText={(t) => updateForm('employeur_nom', t)} placeholder="Nom du client" required unlocked={fieldUnlocked('employeur_nom')} onToggleLock={toggleFieldLock} onPatch={patchField} isEditing={isEditing} />
        <LockedField fieldKey="client_domicile" label="Domicilié à *" value={formData.client_domicile} onChangeText={(t) => updateForm('client_domicile', t)} placeholder="Adresse du client" required unlocked={fieldUnlocked('client_domicile')} onToggleLock={toggleFieldLock} onPatch={patchField} isEditing={isEditing} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><LockedField fieldKey="client_piece_numero" label="Pièce n° *" value={formData.client_piece_numero} onChangeText={(t) => updateForm('client_piece_numero', t)} placeholder="N° pièce" required unlocked={fieldUnlocked('client_piece_numero')} onToggleLock={toggleFieldLock} onPatch={patchField} isEditing={isEditing} /></View>
          <View style={{ flex: 1 }}><LockedField fieldKey="client_piece_date" label="Délivrée le" value={formData.client_piece_date} onChangeText={(t) => updateForm('client_piece_date', t)} placeholder="JJ/MM/AAAA" unlocked={fieldUnlocked('client_piece_date')} onToggleLock={toggleFieldLock} onPatch={patchField} isEditing={isEditing} /></View>
        </View>
      </View>

      {/* Employé concerné */}
      <View style={digitalStyles.sectionCard}>
        <View style={digitalStyles.sectionHead}>
          <Text style={digitalStyles.sectionTitle}>Employé mis en relation</Text>
          <TouchableOpacity onPress={() => setShowEmployePicker(true)} style={digitalStyles.pickBtn}>
            <Icon name="account-search" size={16} color={Colors.primary} /><Text style={digitalStyles.pickBtnText}>{selectedEmploye ? 'Changer' : 'Choisir un employé'}</Text>
          </TouchableOpacity>
        </View>
        {selectedEmploye ? <Text style={digitalStyles.pickHint}>{selectedEmploye.prenom} {selectedEmploye.nom} • {selectedEmploye.telephone || ''}</Text> : <Text style={digitalStyles.pickHintMuted}>Sélectionnez un employé existant — âge/sexe/adresse/pièce se pré-remplissent.</Text>}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><LockedField fieldKey="employe_nom" label="Nom" value={formData.employe_nom} onChangeText={(t) => updateForm('employe_nom', t)} placeholder="Nom" unlocked={fieldUnlocked('employe_nom')} onToggleLock={toggleFieldLock} onPatch={patchField} isEditing={isEditing} /></View>
          <View style={{ flex: 1 }}><LockedField fieldKey="employe_prenom" label="Prénom" value={formData.employe_prenom} onChangeText={(t) => updateForm('employe_prenom', t)} placeholder="Prénom" unlocked={fieldUnlocked('employe_prenom')} onToggleLock={toggleFieldLock} onPatch={patchField} isEditing={isEditing} /></View>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><LockedField fieldKey="employe_age" label="Âge" value={formData.employe_age} onChangeText={(t) => updateForm('employe_age', t)} placeholder="ex: 27" keyboardType="numeric" unlocked={fieldUnlocked('employe_age')} onToggleLock={toggleFieldLock} onPatch={patchField} isEditing={isEditing} /></View>
          <View style={{ flex: 1 }}>
            <Text style={digitalStyles.fieldLabel}>Sexe</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
              {['Masculin','Féminin'].map((v) => {
                const sel = formData.employe_sexe === v;
                const unlocked = fieldUnlocked('employe_sexe');
                return (
                  <TouchableOpacity key={v} disabled={!unlocked} onPress={() => unlocked && updateForm('employe_sexe', v)} style={[digitalStyles.chip, sel && digitalStyles.chipSel, !unlocked && { opacity: 0.5 }]}>
                    <Text style={[digitalStyles.chipText, sel && digitalStyles.chipTextSel]}>{v}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {isEditing && <LockToggle fieldKey="employe_sexe" unlocked={fieldUnlocked('employe_sexe')} onToggleLock={toggleFieldLock} onPatch={patchField} isEditing={isEditing} currentValue={formData.employe_sexe} />}
          </View>
        </View>
        <LockedField fieldKey="poste" label="Poste attribué *" value={formData.poste} onChangeText={(t) => updateForm('poste', t)} placeholder="Ex: Nounou, aide ménagère..." required unlocked={fieldUnlocked('poste')} onToggleLock={toggleFieldLock} onPatch={patchField} isEditing={isEditing} />
        <LockedField fieldKey="employe_adresse_actuelle" label="Adresse actuelle de résidence" value={formData.employe_adresse_actuelle} onChangeText={(t) => updateForm('employe_adresse_actuelle', t)} placeholder="Quartier, commune..." unlocked={fieldUnlocked('employe_adresse_actuelle')} onToggleLock={toggleFieldLock} onPatch={patchField} isEditing={isEditing} />
        <LockedField fieldKey="employe_piece_reference" label="Pièce d'identité / Référence" value={formData.employe_piece_reference} onChangeText={(t) => updateForm('employe_piece_reference', t)} placeholder="N° CNI / passeport..." unlocked={fieldUnlocked('employe_piece_reference')} onToggleLock={toggleFieldLock} onPatch={patchField} isEditing={isEditing} />
      </View>

      {/* Prix prestation */}
      <View style={digitalStyles.sectionCard}>
        <Text style={digitalStyles.sectionTitle}>Prix de la prestation (Art. 3 & 8)</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><LockedField fieldKey="commission_fixe" label="Prix prestation" value={formData.commission_fixe} onChangeText={(t) => updateForm('commission_fixe', t)} placeholder="15000" keyboardType="numeric" unlocked={fieldUnlocked('commission_fixe')} onToggleLock={toggleFieldLock} onPatch={patchField} isEditing={isEditing} /></View>
          <View style={{ flex: 1 }}><LockedField fieldKey="frais_transport" label="Frais transport (Art. 3)" value={formData.frais_transport} onChangeText={(t) => updateForm('frais_transport', t)} placeholder="5000" keyboardType="numeric" unlocked={fieldUnlocked('frais_transport')} onToggleLock={toggleFieldLock} onPatch={patchField} isEditing={isEditing} /></View>
        </View>
        <LockedField fieldKey="retenue_salaire_montant" label="Retenue 1er mois sur salaire net (Art. 8) — à reverser à l'agence" value={formData.retenue_salaire_montant} onChangeText={(t) => updateForm('retenue_salaire_montant', t)} placeholder="Ex: 26667" keyboardType="numeric" unlocked={fieldUnlocked('retenue_salaire_montant')} onToggleLock={toggleFieldLock} onPatch={patchField} isEditing={isEditing} />
        <Text style={digitalStyles.helpText}>Payable espèces ou Mobile Money dès signature (non remboursable). Retenue = montant prélevé par le client sur le salaire net du 1er mois.</Text>
        <LockedField fieldKey="salaire" label="Salaire net employé (aide calcul retenue = 1/3 si vide)" value={formData.salaire} onChangeText={(t) => { updateForm('salaire', t); const n = parseFloat(t); if (!isNaN(n) && n > 0 && !formData.retenue_salaire_montant) updateForm('retenue_salaire_montant', String(Math.round(n/3))); }} placeholder="Ex: 80000" keyboardType="numeric" unlocked={fieldUnlocked('salaire')} onToggleLock={toggleFieldLock} onPatch={patchField} isEditing={isEditing} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><LockedField fieldKey="date_signature" label="Date de signature" value={formData.date_signature} onChangeText={(t) => updateForm('date_signature', t)} placeholder="JJ/MM/AAAA" unlocked={fieldUnlocked('date_signature')} onToggleLock={toggleFieldLock} onPatch={patchField} isEditing={isEditing} /></View>
          <View style={{ flex: 1 }}><LockedField fieldKey="duree" label="Durée suivi" value={formData.duree} onChangeText={(t) => updateForm('duree', t)} placeholder="3 mois" unlocked={fieldUnlocked('duree')} onToggleLock={toggleFieldLock} onPatch={patchField} isEditing={isEditing} /></View>
        </View>
      </View>

      {/* Annexes contrat */}
      <View style={digitalStyles.sectionCard}>
        <View style={digitalStyles.sectionHead}>
          <Text style={digitalStyles.sectionTitle}>Documents annexes au contrat</Text>
          <Text style={digitalStyles.sectionHint}>{isEditing ? `${documents.length} fichier(s)` : `${pendingDocuments.length} en attente`}</Text>
        </View>
        <Text style={digitalStyles.helpText}>Ajoutez des annexes (PDF, Word, photos) : pièces jointes au contrat. En création elles partent après enregistrement.</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {DOCUMENT_TYPES.slice(0, 6).map((dt) => (
            <TouchableOpacity key={dt.value} onPress={() => handlePickAnnexe(dt.value)} style={digitalStyles.docTypeChip}>
              <Text style={digitalStyles.docTypeIcon}>{dt.icon}</Text>
              <Text style={digitalStyles.docTypeLabel}>{dt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity onPress={() => handlePickAnnexe('autre')} style={[digitalStyles.docTypeChip, { marginTop: 8 }]}>
          <Text style={digitalStyles.docTypeIcon}>📎</Text><Text style={digitalStyles.docTypeLabel}>Autre document</Text>
        </TouchableOpacity>
        {/* Liste */}
        <View style={{ marginTop: 12 }}>
          {(isEditing ? documents : pendingDocuments).length === 0 ? (
            <Text style={digitalStyles.pickHintMuted}>Aucune annexe pour l'instant.</Text>
          ) : (
            (isEditing ? documents : pendingDocuments).map((doc: any, idx: number) => (
              <View key={doc.id || `pending-${idx}`} style={digitalStyles.docRow}>
                <TouchableOpacity onPress={() => openDocumentViewer(doc)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={digitalStyles.docTypeIcon}>{getDocumentTypeIcon(doc.type)}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={digitalStyles.docRowTitle} numberOfLines={1}>{getDocumentTypeLabel(doc.type)} {doc.nomFichier ? `• ${doc.nomFichier}` : doc.name ? `• ${doc.name}` : ''}</Text>
                    <Text style={digitalStyles.docRowSub}>{doc.type}</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => isEditing ? requestDeleteDocument(doc.id) : setPendingDocuments((p) => p.filter((_, i) => i !== idx))} style={digitalStyles.docDeleteBtn}>
                  <Icon name="trash-can-outline" size={18} color={Colors.danger} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => openDocumentViewer(doc)} style={digitalStyles.docViewBtn}>
                  <Icon name="eye-outline" size={18} color={Colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={async () => {
                  try {
                    const uri = doc.imageUrl || doc.uri;
                    if (!uri) return;
                    const isRemote = /^https?:\/\//i.test(uri);
                    let localUri = uri;
                    if (isRemote) {
                      const name = doc.nomFichier || doc.name || `annexe_${Date.now()}.pdf`;
                      const tmp = (FileSystem as any).cacheDirectory + name.replace(/[^a-zA-Z0-9._-]/g,'_');
                      const dl = await (FileSystem as any).downloadAsync(uri, tmp);
                      localUri = dl.uri;
                    }
                    const can = await Sharing.isAvailableAsync();
                    if (can) await Sharing.shareAsync(localUri);
                  } catch (e: any) { Alert.alert('Téléchargement', e?.message || 'Impossible'); }
                }} style={digitalStyles.docViewBtn}>
                  <Icon name="download-outline" size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </View>

      {/* Actions */}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
        <SafeButton onPress={handleSave} loading={loading} mode="contained" style={{ flex: 1 }}>{isEditing ? "Enregistrer" : "Créer le contrat"}</SafeButton>
        <SafeButton onPress={handlePrint} mode="outlined" style={{ flex: 1 }}><Icon name="file-pdf-box" size={18} color={Colors.primary} /><Text style={{ color: Colors.primary, fontWeight: "600", marginLeft: 6 }}>Imprimer PDF</Text></SafeButton>
      </View>
      <Text style={digitalStyles.helpText}>Le PDF reprend fidèlement les 10 articles (3 pages) avec en-tête/pied répétés. Tous les champs ci-dessus sont verrouillés après création (C1).</Text>
    </ScrollView>
  );

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <AppHeader title={isEditing ? 'Contrat de prestation' : 'Nouveau contrat'} showBack />
      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity onPress={() => setActiveTab('numerique')} style={[styles.tab, activeTab === 'numerique' && styles.tabActive]}>
          <Icon name="file-document-edit-outline" size={16} color={activeTab === 'numerique' ? Colors.primary : Colors.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'numerique' && styles.tabTextActive]}>Numérique</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setActiveTab('scanne')} style={[styles.tab, activeTab === 'scanne' && styles.tabActive]}>
          <Icon name="scanner" size={16} color={activeTab === 'scanne' ? Colors.primary : Colors.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'scanne' && styles.tabTextActive]}>Scanné</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'numerique' ? renderNumerique() : renderScanTab()}

      {renderPickerModal(showEmployePicker, () => setShowEmployePicker(false), employes, handleSelectEmploye, formData.employe_id, true)}
      {renderPickerModal(showEmployeurPicker, () => setShowEmployeurPicker(false), employeurs, handleSelectEmployeur, formData.employeur_id, false)}

      {/* PIN suppression annexe */}
      <Modal visible={pinVisible} transparent animationType="fade" onRequestClose={() => setPinVisible(false)}>
        <View style={digitalStyles.pinOverlay}>
          <View style={digitalStyles.pinCard}>
            <Text style={digitalStyles.pinTitle}>Code PIN requis</Text>
            <Text style={digitalStyles.pinSub}>Saisissez le code à 4 chiffres pour supprimer cette annexe.</Text>
            <TextInput value={pinValue} onChangeText={setPinValue} placeholder="••••" placeholderTextColor="#9aa" keyboardType="numeric" maxLength={4} secureTextEntry style={digitalStyles.pinInput} />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <TouchableOpacity onPress={() => setPinVisible(false)} style={[digitalStyles.pinBtn, { backgroundColor: Colors.surface }]}><Text style={digitalStyles.pinBtnText}>Annuler</Text></TouchableOpacity>
              <TouchableOpacity onPress={confirmDeleteDocument} style={[digitalStyles.pinBtn, { backgroundColor: Colors.danger }]}><Text style={[digitalStyles.pinBtnText, { color: '#fff' }]}>Supprimer</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <DocumentViewerOverlay viewerDoc={docViewer.doc} onClose={docViewer.close} onDownload={docViewer.download} downloading={docViewer.downloading} />
    </View>
  );
}

// ── Styles repris/adaptés de ContratDocumentScreen + Fiche verrouillage ─
const digitalStyles = StyleSheet.create({
  headerCard: { backgroundColor: '#0c1f3f', borderRadius: 12, padding: 14, marginBottom: 12 },
  headerTitle: { color: '#fff', fontWeight: '800', fontSize: 15 },
  headerSub: { color: '#cbd5e1', fontSize: 11, marginTop: 4 },
  badge: { backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { color: '#e2e8f0', fontSize: 10, fontWeight: '700' },
  sectionCard: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontWeight: '800', color: Colors.textPrimary, fontSize: 13 },
  sectionHint: { fontSize: 11, color: Colors.textSecondary },
  pickBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#eef2ff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  pickBtnText: { color: Colors.primary, fontWeight: '700', fontSize: 12 },
  pickHint: { fontSize: 12, color: Colors.textSecondary, marginBottom: 8 },
  pickHintMuted: { fontSize: 12, color: Colors.textTertiary, marginBottom: 8, fontStyle: 'italic' },
  lockedRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 6 },
  lockedRowLocked: { opacity: 0.96 },
  lockBtn: { padding: 8, borderRadius: 8, backgroundColor: '#f1f5f9', marginBottom: 6 },
  lockToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  lockToggleText: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600' },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.3 },
  helpText: { fontSize: 11, color: Colors.textSecondary, marginTop: 6, lineHeight: 14 },
  chip: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#cbd5e1', alignItems: 'center', backgroundColor: '#fff' },
  chipSel: { backgroundColor: '#0c1f3f', borderColor: '#0c1f3f' },
  chipText: { fontWeight: '700', color: Colors.textSecondary, fontSize: 12 },
  chipTextSel: { color: '#fff' },
  docTypeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999 },
  docTypeIcon: { fontSize: 14 },
  docTypeLabel: { fontSize: 11, fontWeight: '700', color: Colors.textPrimary },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  docRowTitle: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary },
  docRowSub: { fontSize: 10, color: Colors.textSecondary },
  docDeleteBtn: { padding: 6, borderRadius: 8, backgroundColor: '#fef2f2' },
  docViewBtn: { padding: 6, borderRadius: 8, backgroundColor: '#f1f5f9' },
  pinOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 20 } as any,
  pinCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, width: '100%', maxWidth: 360 } as any,
  pinTitle: { fontWeight: '800', fontSize: 14, color: '#111' } as any,
  pinSub: { fontSize: 12, color: '#666', marginTop: 6 } as any,
  pinInput: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10, marginTop: 10, fontSize: 16, textAlign: 'center', letterSpacing: 6 } as any,
  pinBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' } as any,
  pinBtnText: { fontWeight: '700', fontSize: 12 } as any,
});


const styles = StyleSheet.create({
  // ── Document scroll ─────────────────
  documentScroll: {
    flex: 1,
  },
  documentContent: {
    paddingBottom: 40,
  },

  // ── Agence header ──────────────────
  agencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  agencyLogo: {
    width: 45,
    height: 45,
    borderRadius: 8,
    marginRight: 10,
  },
  agencyInfo: {
    flex: 1,
  },
  agencyName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#c45a2a',
    letterSpacing: 1,
  },
  agencySlogan: {
    fontSize: 9,
    color: '#777',
    lineHeight: 13,
  },
  agencyPhone: {
    fontSize: 9,
    color: '#555',
    marginTop: 2,
  },
  agencySeparator: {
    height: 1,
    backgroundColor: '#c45a2a',
    marginBottom: 8,
  },

  // ── Header ─────────────────────────
  headerBlock: {
    borderBottomWidth: 2,
    borderBottomColor: '#c45a2a',
    paddingBottom: 10,
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerField: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#c45a2a',
    marginRight: 4,
  },
  headerValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    borderBottomWidth: 1,
    borderBottomColor: '#CCC',
    minWidth: 80,
    paddingVertical: 1,
    paddingHorizontal: 4,
  },
  pageSubtitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#c45a2a',
    textAlign: 'center',
    marginTop: 10,
    letterSpacing: 2,
  },

  // ── Page break ─────────────────────
  pageBreak: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  pageBreakLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#CCC',
    borderStyle: 'dashed',
  },
  pageBreakText: {
    fontSize: 9,
    color: '#AAA',
    marginHorizontal: 12,
    letterSpacing: 1,
  },

  // ── Sections ───────────────────────
  section: {
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#c45a2a',
    marginBottom: 8,
    letterSpacing: 0.5,
  },

  // ── Field rows ─────────────────────
  fieldRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: 6,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  identityFields: {
    flex: 1,
    marginRight: 12,
  },
  photoBoxContrat: {
    width: 70,
    height: 80,
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFAFA',
    overflow: 'hidden',
  },
  photoImgContrat: {
    width: 70,
    height: 80,
  },
  photoPlaceholderContrat: {
    fontSize: 9,
    color: '#BBB',
    fontWeight: '600',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#555',
  },
  fieldLabelInline: {
    fontSize: 11,
    fontWeight: '600',
    color: '#555',
    marginLeft: 8,
  },
  fieldValue: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
  },
  placeholderInline: {
    color: '#CCC',
    fontSize: 12,
  },

  // ── Inline fields ──────────────────
  inlineFields: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  inlineSep: {
    fontSize: 11,
    color: '#888',
    marginHorizontal: 4,
  },
  inlineFieldSmall: {
    fontSize: 12,
    color: '#333',
    borderBottomWidth: 1,
    borderBottomColor: '#CCC',
    paddingVertical: 1,
    paddingHorizontal: 4,
    minWidth: 60,
  },
  inlineFieldMed: {
    fontSize: 12,
    color: '#333',
    borderBottomWidth: 1,
    borderBottomColor: '#CCC',
    paddingVertical: 1,
    paddingHorizontal: 4,
    minWidth: 100,
    flex: 1,
  },
  inlineFieldLarge: {
    fontSize: 12,
    color: '#333',
    borderBottomWidth: 1,
    borderBottomColor: '#CCC',
    paddingVertical: 1,
    paddingHorizontal: 4,
    minWidth: 120,
    flex: 1,
  },

  // ── Checkboxes ────────────────────
  checkboxRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxBox: {
    fontSize: 16,
    color: '#c45a2a',
    marginRight: 4,
  },
  checkboxLabel: {
    fontSize: 11,
    color: '#444',
  },
  binaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 4,
  },
  binaryOption: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // ── Clauses / static text ──────────
  staticClause: {
    fontSize: 11,
    color: '#555',
    fontStyle: 'italic',
    marginVertical: 6,
  },
  clauseItem: {
    fontSize: 10.5,
    color: '#444',
    lineHeight: 16,
    marginBottom: 4,
    paddingLeft: 4,
  },

  // ── Tiers / commission ─────────────
  tiersBox: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#F0F4FF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D0D8F0',
  },
  tiersLabel: {
    fontSize: 10.5,
    color: '#555',
    lineHeight: 16,
  },
  tiersValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#c45a2a',
    marginTop: 4,
  },

  // ── Signatures ─────────────────────
  sigBlock: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  signatureBox: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 8,
  },
  signatureLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  signatureInput: {
    fontSize: 14,
    textAlign: 'center',
    color: '#333',
    fontFamily: Platform.OS === 'web' ? 'cursive' : undefined,
    minWidth: 80,
    borderBottomWidth: 1,
    borderBottomColor: '#CCC',
    paddingVertical: 2,
  },
  signatureLine: {
    width: '100%',
    height: 1,
    backgroundColor: '#999',
    marginTop: 4,
  },
  signatureName: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
    fontStyle: 'italic',
  },
  signatureSub: {
    fontSize: 9,
    color: '#AAA',
    marginTop: 1,
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
  scanPreviewFull: { flex: 1, width: '100%', padding: 10, alignItems: 'center' },
  scanImageWrap: { width: '100%', flex: 1, minHeight: 380, borderRadius: Radius.md, overflow: 'hidden', backgroundColor: '#F5F0EB' },
  scanImageFull: { width: '100%', height: '100%' },
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
  scanActions: { flexDirection: 'row', gap: 10, marginTop: 12, justifyContent: 'center' },
  scanBtnSecondary: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: Colors.primary, backgroundColor: '#FFF' },
  scanBtnSecondaryText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  // ── Pickers (employee/employer selection) ──
  pickerSection: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  pickerTrigger: {
    padding: 10,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 6,
    backgroundColor: '#FAFAFA',
  },
  pickerValue: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  pickerPlaceholder: {
    fontSize: 13,
    color: '#AAA',
  },
  pickerItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  pickerItemSelected: {
    backgroundColor: '#E8F0FE',
  },
  pickerItemText: {
    fontSize: 14,
    color: '#333',
  },
  pickerItemTextSelected: {
    fontWeight: '700',
    color: '#c45a2a',
  },
  pickerItemSub: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },

  // ── Editable field (generic) ──────
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

  // ── Modals ────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '85%',
    maxHeight: '70%',
    backgroundColor: '#FFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  modalEmpty: {
    padding: 40,
    alignItems: 'center',
  },
  modalEmptyText: {
    fontSize: 14,
    color: '#999',
  },

  // ── Navigation liée ────────────────
  linkedEntitiesBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F8FAFE',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  linkedEntityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  linkedEntityText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
});
