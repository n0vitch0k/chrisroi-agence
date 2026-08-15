import React, { useState, useEffect } from 'react';
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
import type { ContratFormNavigationProp } from '../types/navigation';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import A4Document from '../components/A4Document';
import AppHeader from '../components/AppHeader';
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
} from '../database/service';
import { formatMoney } from '../utils/constants';
import { Colors, Spacing, Radius, Typography } from '../theme';

// ═══════════════════════════════════════════════════════════
//  TEXTE STATIQUE DU CONTRAT
// ═══════════════════════════════════════════════════════════

const RESPONSABILITES_EMPLOYE = [
  "L'employé est tenu de respecter son employeur dans l'exercice de ses fonctions.",
  "L'employé répondra de ses actes devant les autorités ou les juridictions compétentes pour les actes de vols, fraude, ou tout autres délits.",
  'Le présent contrat est conclu pour une durée de ___________________________',
  "Qui commence à courir à compter du ________20 \tsur une durée de",
];

const RESPONSABILITES_EMPLOYEUR = [
  "L'employeur est tenu de connaître le domicile des parents de son employé(e) dès la signature du contrat d'embauche.",
  "Toute tâche qui n'a pas été signalée à l'employé(e) à la signature du contrat entraîne l'annulation du contrat.",
  "L'employeur est tenu d'assurer les premiers soins en cas de maladie de l'employé(e) et d'aviser le plus tôt possible les parents de ce dernier.",
  "En cas de renvoi, l'employeur est tenu d'aviser CHRISROI AGENCE.",
  "L'employé(e) doit être payé au plus grand tard le 5 du mois.",
  "Les arriérés de salaires ne sont pas acceptés.",
  "CHRISROI AGENCE condamne les actes de vol, bagarres, maltraitance, privation de nourriture, violence verbale, harcèlement sexuel, viol et autre désagrément au lieu de service.",
  "En cas d'abandon de service ou défaillance de l'employé(e), CHRISROI AGENCE procèdera à un remplacement de personnel dans un délai d'une semaine maximum.",
];

const SITUATIONS = [
  { key: 'marie', label: 'Marié(e)' },
  { key: 'concubinage', label: 'Concubinage' },
  { key: 'celibataire', label: 'Célibataire' },
];

// ═══════════════════════════════════════════════════════════
//  COMPOSANTS RÉUTILISABLES
// ═══════════════════════════════════════════════════════════

function EditableField({
  value,
  onChangeText,
  placeholder,
  fieldStyle,
  multiline,
  editable = true,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  fieldStyle?: any;
  multiline?: boolean;
  editable?: boolean;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#CCC"
      style={[styles.editableField, fieldStyle]}
      multiline={multiline}
      textAlignVertical={multiline ? 'top' : 'center'}
      editable={editable}
    />
  );
}

function SignatureBox({
  label,
  name,
  subtext,
}: {
  label: string;
  name?: string;
  subtext?: string;
}) {
  return (
    <View style={styles.signatureBox}>
      <Text style={styles.signatureLabel}>{label}</Text>
      <View style={styles.signatureLine} />
      {name ? (
        <Text style={styles.signatureName}>{name}</Text>
      ) : null}
      {subtext ? (
        <Text style={styles.signatureSub}>{subtext}</Text>
      ) : null}
    </View>
  );
}

/** Checkbox toggle pour les choix mutuellement exclusifs (situation matrimoniale) */
function CheckboxGroup({
  options,
  selected,
  onSelect,
}: {
  options: { key: string; label: string }[];
  selected: string;
  onSelect: (key: string) => void;
}) {
  return (
    <View style={styles.checkboxRow}>
      {options.map((opt) => {
        const isChecked = selected === opt.key;
        return (
          <TouchableOpacity
            key={opt.key}
            onPress={() => onSelect(opt.key)}
            style={styles.checkboxItem}
          >
            <Text style={styles.checkboxBox}>{isChecked ? '■' : '□'}</Text>
            <Text style={styles.checkboxLabel}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** Checkbox binaire Oui/Non */
function BinaryCheck({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <View style={styles.binaryRow}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TouchableOpacity
        onPress={() => onChange(true)}
        style={styles.binaryOption}
      >
        <Text style={styles.checkboxBox}>{value ? '■' : '□'}</Text>
        <Text style={styles.checkboxLabel}>Oui</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => onChange(false)}
        style={styles.binaryOption}
      >
        <Text style={styles.checkboxBox}>{!value ? '■' : '□'}</Text>
        <Text style={styles.checkboxLabel}>Non</Text>
      </TouchableOpacity>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════
//  ÉCRAN PRINCIPAL
// ═══════════════════════════════════════════════════════════

const EMPTY_FORM = {
  // Employé
  employe_id: '',
  employe_nom: '',
  employe_prenom: '',
  employe_photo_url: '',
  date_naissance: '',
  lieu_naissance: '',
  lieu_habitation: '',
  situation_matrimoniale: 'celibataire',
  religion: '',
  ethnie: '',
  diplome: '',
  date_embauche: '',
  a_deja_travaille: false,
  contact_ancien_patron: '',
  // Parents
  pere_nom: '',
  mere_nom: '',
  domicile_parents: '',
  // Urgences
  urgence1_nom: '',
  urgence1_contact: '',
  urgence2_nom: '',
  urgence2_contact: '',
  urgence3_nom: '',
  urgence3_contact: '',
  // Employeur
  employeur_id: '',
  employeur_nom: '',
  employeur_domicile: '',
  employeur_contact: '',
  // Contrat
  numero_dossier: '',
  date_contrat: '',
  poste: '',
  salaire: '',
  commission_fixe: '15000',
  frais_transport: '5000',
  date_debut: '',
  duree: '',
  // Signatures
  signature_employe: '',
  signature_agence: '',
  signature_employeur: '',
};

export default function ContratDocumentScreen() {
  const navigation = useNavigation<ContratFormNavigationProp>();
  const route = useRoute<any>();
  const contratId = route.params?.id;
  const preselectedEmployeId = route.params?.employe_id;
  const rootNavigation = navigation.getParent()?.getParent();
  const tabNavigation = navigation.getParent();

  const [formData, setFormData] = useState<any>({ ...EMPTY_FORM });
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showEmployePicker, setShowEmployePicker] = useState(false);
  const [showEmployeurPicker, setShowEmployeurPicker] = useState(false);
  const [employes, setEmployes] = useState<any[]>([]);
  const [employeurs, setEmployeurs] = useState<any[]>([]);
  const [selectedEmploye, setSelectedEmploye] = useState<any>(null);
  const [selectedEmployeur, setSelectedEmployeur] = useState<any>(null);
  const [commissionTiers, setCommissionTiers] = useState(0);

  // ── Onglet Numérique / Scanné ──────────────────────────
  const [activeTab, setActiveTab] = useState<'numerique' | 'scanne'>('numerique');
  const [scanData, setScanData] = useState<any>(null);
  const [scanLoading, setScanLoading] = useState(false);

  const updateForm = (key: string, value: any) =>
    setFormData((prev: any) => ({ ...prev, [key]: value }));

  // Charger employés et employeurs au montage
  useEffect(() => {
    (async () => {
      try {
        const [emps, empurs] = await Promise.all([
          getAllEmployes(),
          getAllEmployeurs(),
        ]);
        setEmployes(emps);
        setEmployeurs(empurs);
      } catch (err) {
        console.error('Erreur chargement listes:', err);
      }
    })();
  }, []);

  // Si contrat existant (édition), charger les données
  useEffect(() => {
    if (!contratId) return;
    setIsEditing(true);
    (async () => {
      try {
        const contrat = await getContratById(contratId);
        if (!contrat) {
          Alert.alert('Erreur', 'Contrat introuvable');
          navigation.goBack();
          return;
        }

        // Charger l'employé complet (avec parents, urgences)
        const employe = contrat.employe_id
          ? await getEmployeById(
              typeof contrat.employe_id === 'string'
                ? contrat.employe_id
                : contrat.employe_id.id
            )
          : null;

        const employeur = contrat.employeur_id
          ? await getEmployeurById(
              typeof contrat.employeur_id === 'string'
                ? contrat.employeur_id
                : contrat.employeur_id.id
            )
          : null;

        // Parents
        const pere = employe?.parents?.find((p: any) => p.type === 'pere');
        const mere = employe?.parents?.find((p: any) => p.type === 'mere');
        const urgences = employe?.personnes_urgence || [];
        const experience = employe?.experiences?.[0];

        const salary = contrat.salaire || 0;
        const tiers = Math.round(salary / 3);

        setFormData({
          employe_id: employe?.id || contrat.employe_id || '',
          employe_nom: contrat.employe_nom || employe?.nom || '',
          employe_prenom: contrat.employe_prenom || employe?.prenom || '',
          date_naissance: employe?.date_naissance || '',
          lieu_naissance: employe?.lieu_naissance || '',
          lieu_habitation: contrat.domicile_employe || employe?.lieu_residence || '',
          situation_matrimoniale: employe?.situation_matrimoniale || 'celibataire',
          religion: employe?.religion || '',
          ethnie: employe?.ethnie || '',
          diplome: employe?.niveau_etude || '',
          date_embauche: contrat.date_debut || '',
          a_deja_travaille: !!employe?.a_deja_travaille,
          contact_ancien_patron: experience?.contact || '',
          pere_nom: pere ? `${pere.prenom || ''} ${pere.nom || ''}`.trim() : '',
          mere_nom: mere ? `${mere.prenom || ''} ${mere.nom || ''}`.trim() : '',
          domicile_parents: pere?.domicile || '',
          urgence1_nom: urgences[0] ? `${urgences[0].prenom || ''} ${urgences[0].nom || ''}`.trim() : '',
          urgence1_contact: urgences[0]?.telephone || '',
          urgence2_nom: urgences[1] ? `${urgences[1].prenom || ''} ${urgences[1].nom || ''}`.trim() : '',
          urgence2_contact: urgences[1]?.telephone || '',
          urgence3_nom: urgences[2] ? `${urgences[2].prenom || ''} ${urgences[2].nom || ''}`.trim() : '',
          urgence3_contact: urgences[2]?.telephone || '',
          employeur_id: employeur?.id || contrat.employeur_id || '',
          employeur_nom: contrat.nom_complet || employeur?.nom_complet || employeur?.raison_sociale || '',
          employeur_domicile: contrat.employeur_adresse || employeur?.adresse || '',
          employeur_contact: contrat.employeur_telephone || employeur?.telephone || '',
          numero_dossier: contrat.numero_dossier || '',
          date_contrat: contrat.date_contrat || '',
          poste: contrat.poste || '',
          salaire: salary > 0 ? String(salary) : '',
          commission_fixe: String(contrat.commission_fixe ?? 15000),
          frais_transport: String(contrat.frais_transport ?? 5000),
          date_debut: contrat.date_debut || '',
          duree: contrat.duree || '',
          signature_employe: contrat.signature_employe || '',
          signature_agence: contrat.signature_agence || '',
          signature_employeur: contrat.signature_employeur || '',
        });

        setCommissionTiers(tiers);
        setSelectedEmploye(employe);
        setSelectedEmployeur(employeur);
      } catch (err) {
        console.error('Erreur chargement contrat:', err);
        Alert.alert('Erreur', 'Impossible de charger le contrat');
      }
    })();
  }, [contratId]);

  // Si preselectedEmployeId (depuis la fiche), charger l'employé
  useEffect(() => {
    if (!preselectedEmployeId || contratId) return;
    (async () => {
      try {
        const emp = await getEmployeById(preselectedEmployeId);
        if (emp) {
          setSelectedEmploye(emp);
          fillEmployeData(emp);
        }
      } catch (err) {
        console.error('Erreur chargement employé pré-sélectionné:', err);
      }
    })();
  }, [preselectedEmployeId]);

  // Remplir les champs employé depuis la fiche
  const fillEmployeData = (emp: any) => {
    const pere = emp.parents?.find((p: any) => p.type === 'pere');
    const mere = emp.parents?.find((p: any) => p.type === 'mere');
    const urgences = emp.personnes_urgence || [];
    const experience = emp.experiences?.[0];

    setFormData((prev: any) => ({
      ...prev,
      employe_id: emp.id,
      employe_nom: emp.nom || '',
      employe_prenom: emp.prenom || '',
      employe_photo_url: getEmployePhotoUrl(emp.id, emp.photo),
      date_naissance: emp.date_naissance || '',
      lieu_naissance: emp.lieu_naissance || '',
      lieu_habitation: emp.lieu_residence || '',
      situation_matrimoniale: emp.situation_matrimoniale || 'celibataire',
      religion: emp.religion || '',
      ethnie: emp.ethnie || '',
      diplome: emp.niveau_etude || '',
      a_deja_travaille: !!emp.a_deja_travaille,
      contact_ancien_patron: experience?.contact || '',
      pere_nom: pere ? `${pere.prenom || ''} ${pere.nom || ''}`.trim() : '',
      mere_nom: mere ? `${mere.prenom || ''} ${mere.nom || ''}`.trim() : '',
      domicile_parents: pere?.domicile || '',
      urgence1_nom: urgences[0] ? `${urgences[0].prenom || ''} ${urgences[0].nom || ''}`.trim() : '',
      urgence1_contact: urgences[0]?.telephone || '',
      urgence2_nom: urgences[1] ? `${urgences[1].prenom || ''} ${urgences[1].nom || ''}`.trim() : '',
      urgence2_contact: urgences[1]?.telephone || '',
      urgence3_nom: urgences[2] ? `${urgences[2].prenom || ''} ${urgences[2].nom || ''}`.trim() : '',
      urgence3_contact: urgences[2]?.telephone || '',
    }));
  };

  // Calculer le tiers du salaire quand le salaire change
  useEffect(() => {
    const salary = parseFloat(formData.salaire) || 0;
    setCommissionTiers(Math.round(salary / 3));
  }, [formData.salaire]);

  // ── Sauvegarde ───────────────────────────────────────
  const handleSave = async () => {
    if (!formData.employe_id || !formData.employeur_id) {
      Alert.alert('Champs requis', 'Sélectionnez un employé et un employeur.');
      return;
    }

    setLoading(true);
    try {
      const contratData = {
        ...formData,
        salaire: parseFloat(formData.salaire) || 0,
        commission_fixe: parseInt(formData.commission_fixe) || 15000,
        frais_transport: parseInt(formData.frais_transport) || 5000,
        commission_agence: commissionTiers,
        domicile_employe: formData.lieu_habitation,
        notes: '',
      };

      if (isEditing) {
        await updateContrat(contratId, contratData);
      } else {
        await createContrat(contratData);
      }
      Alert.alert('Succès', isEditing ? 'Contrat modifié' : 'Contrat créé');
      // NE PAS naviguer — on reste sur la page pour impression/scan
    } catch (error) {
      console.error('Error saving contrat:', error);
      Alert.alert('Erreur', "Échec de l'enregistrement du contrat");
    } finally {
      setLoading(false);
    }
  };

  // ── Scan du document signé ─────────────────────────────
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

      const docId = isEditing ? contratId : null;
      if (!docId) {
        Alert.alert('Info', 'Enregistrez d\'abord le contrat avant de scanner.');
        setScanLoading(false);
        return;
      }
      await uploadScan('contrat', docId, imageUri);
      const updated = await getScan('contrat', docId);
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
    const docId = isEditing ? contratId : null;
    if (!docId) {
      Alert.alert('Info', 'Enregistrez d\'abord le contrat avant de scanner.');
      return;
    }
    try {
      setScanLoading(true);
      await uploadScan('contrat', docId, file);
      const updated = await getScan('contrat', docId);
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
        'Enregistrez d\'abord le contrat pour pouvoir scanner le document signé.',
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

  // Charger le scan existant au montage (mode édition)
  useEffect(() => {
    if (contratId) {
      getScan('contrat', contratId).then(setScanData).catch(() => {});
    }
  }, [contratId]);

  // ── Sélecteur employé ───────────────────────────────
  const handleSelectEmploye = async (item: any) => {
    // Toujours pré-remplir depuis le picker (garantit un remplissage visible
    // même si le fetch réseau échoue).
    setSelectedEmploye(item);
    setFormData((prev: any) => ({
      ...prev,
      employe_id: item.id,
      employe_nom: item.nom || '',
      employe_prenom: item.prenom || '',
      employe_photo_url: getEmployePhotoUrl(item.id, item.photo),
    }));
    try {
      const full = await getEmployeById(item.id);
      if (full) {
        setSelectedEmploye(full);
        fillEmployeData(full);
      }
    } catch (err) {
      console.warn('getEmployeById a échoué, utilisation des données du picker:', err);
    }
  };

  const handleSelectEmployeur = async (item: any) => {
    setSelectedEmployeur(item);
    setFormData((prev: any) => ({
      ...prev,
      employeur_id: item.id,
      employeur_nom: item.nom_complet || item.raison_sociale || item.nom || '',
      employeur_domicile: item.adresse || '',
      employeur_contact: item.telephone || '',
    }));
    // Enrichir si le picker ne contenait pas l'adresse/téléphone complets
    try {
      const full = await getEmployeurById(item.id);
      if (full) {
        setSelectedEmployeur(full);
        setFormData((prev: any) => ({
          ...prev,
          employeur_domicile: full.adresse || prev.employeur_domicile,
          employeur_contact: full.telephone || prev.employeur_contact,
          employeur_nom:
            full.nom_complet || full.raison_sociale || full.nom || prev.employeur_nom,
        }));
      }
    } catch {
      /* garde les données du picker */
    }
  };

  // ── Pickers modaux ─────────────────────────────────
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
        {/* Backdrop : frère du conteneur, ne capte PAS le tap sur les items */}
        <TouchableWithoutFeedback onPress={onDismiss}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {isEmploye ? 'Sélectionner un employé' : 'Sélectionner un employeur'}
            </Text>
            <TouchableOpacity onPress={onDismiss}>
              <Icon name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          {items.length === 0 ? (
            <View style={styles.modalEmpty}>
              <Text style={styles.modalEmptyText}>
                {isEmploye ? 'Aucun employé disponible' : 'Aucun employeur disponible'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const isSelected = item.id === selectedId;
                const label = isEmploye
                  ? `${item.prenom || ''} ${item.nom || ''}`
                  : item.nom_complet || item.raison_sociale || item.nom || '';
                const subtitle = isEmploye
                  ? item.categorie_emploi || ''
                  : item.telephone || '';
                return (
                  <TouchableOpacity
                    style={[styles.pickerItem, isSelected && styles.pickerItemSelected]}
                    onPress={() => {
                      onSelect(item);
                      onDismiss();
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerItemText,
                        isSelected && styles.pickerItemTextSelected,
                      ]}
                    >
                      {label}
                    </Text>
                    {subtitle ? (
                      <Text style={styles.pickerItemSub}>{subtitle}</Text>
                    ) : null}
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );

  // ══════════════════════════════════════════════════════
  //  RENDU DU DOCUMENT — PAGE 1 : EMPLOYÉ
  // ══════════════════════════════════════════════════════
  const renderPageHeader = (subtitle?: string) => (
    <View style={styles.headerBlock}>
      {/* ── En-tête agence ──────────────────────────── */}
      <View style={styles.agencyHeader}>
        <Image
          source={require('../../assets/logo-agence.jpg')}
          style={styles.agencyLogo}
          resizeMode="contain"
        />
        <View style={styles.agencyInfo}>
          <Text style={styles.agencyName}>CHRISROI AGENCE</Text>
          <Text style={styles.agencySlogan}>
            PLACEMENT DE PERSONNELS – SERVICE DE{' '}
            <Text style={styles.agencySlogan}>NETTOYAGE – COURTAGE IMMOBILIER</Text>
          </Text>
          <Text style={styles.agencyPhone}>
            Tel : +225 27 22 34 22 83 / +225 05 03 97 47 75
          </Text>
        </View>
      </View>
      <View style={styles.agencySeparator} />
      {/* ── DATE / DOSSIER ──────────────────────────── */}
      <View style={styles.headerRow}>
        <View style={styles.headerField}>
          <Text style={styles.headerLabel}>DATE :</Text>
          <EditableField
            value={formData.date_contrat}
            onChangeText={(t) => updateForm('date_contrat', t)}
            placeholder="__/__/____"
            fieldStyle={styles.headerValue}
          />
        </View>
        <View style={styles.headerField}>
          <Text style={styles.headerLabel}>DOSSIER N° :</Text>
          <Text style={styles.headerValue}>
            {formData.numero_dossier || `CHR-${new Date().getFullYear()}-____`}
          </Text>
        </View>
      </View>
      {subtitle && <Text style={styles.pageSubtitle}>{subtitle}</Text>}
    </View>
  );

  const renderPage1 = () => (
    <View>
      {renderPageHeader('EMPLOYE')}

      {/* ── Identité ──────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.identityRow}>
          <View style={styles.identityFields}>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Nom et prénoms :</Text>
              <Text style={styles.fieldValue}>
                {formData.employe_nom} {formData.employe_prenom}
                {!formData.employe_nom && (
                  <Text style={styles.placeholderInline}>___________________________</Text>
                )}
              </Text>
            </View>
          </View>

          {/* Photo d'identité */}
          <View style={styles.photoBoxContrat}>
            {formData.employe_photo_url ? (
              <Image
                source={{ uri: formData.employe_photo_url }}
                style={styles.photoImgContrat}
                resizeMode="cover"
              />
            ) : (
              <Text style={styles.photoPlaceholderContrat}>PHOTO</Text>
            )}
          </View>
        </View>

        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Date et lieu de naissance :</Text>
          <View style={styles.inlineFields}>
            <EditableField
              value={formData.date_naissance}
              onChangeText={(t) => updateForm('date_naissance', t)}
              placeholder="__/__/____"
              fieldStyle={styles.inlineFieldSmall}
            />
            <Text style={styles.inlineSep}>à</Text>
            <EditableField
              value={formData.lieu_naissance}
              onChangeText={(t) => updateForm('lieu_naissance', t)}
              placeholder="Lieu"
              fieldStyle={styles.inlineFieldMed}
            />
          </View>
        </View>

        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Lieu d'habitation :</Text>
          <EditableField
            value={formData.lieu_habitation}
            onChangeText={(t) => updateForm('lieu_habitation', t)}
            placeholder="______________________________"
            fieldStyle={styles.inlineFieldLarge}
          />
        </View>

        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Situation matrimoniale :</Text>
          <CheckboxGroup
            options={SITUATIONS}
            selected={formData.situation_matrimoniale}
            onSelect={(k) => updateForm('situation_matrimoniale', k)}
          />
        </View>

        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Religion :</Text>
          <EditableField
            value={formData.religion}
            onChangeText={(t) => updateForm('religion', t)}
            placeholder="_______________"
            fieldStyle={styles.inlineFieldMed}
          />
          <Text style={styles.fieldLabelInline}>Ethnie :</Text>
          <EditableField
            value={formData.ethnie}
            onChangeText={(t) => updateForm('ethnie', t)}
            placeholder="_______________"
            fieldStyle={styles.inlineFieldMed}
          />
          <Text style={styles.fieldLabelInline}>Diplôme :</Text>
          <EditableField
            value={formData.diplome}
            onChangeText={(t) => updateForm('diplome', t)}
            placeholder="_______________"
            fieldStyle={styles.inlineFieldMed}
          />
        </View>

        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Date d'embauche :</Text>
          <EditableField
            value={formData.date_embauche}
            onChangeText={(t) => updateForm('date_embauche', t)}
            placeholder="__/__/____"
            fieldStyle={styles.inlineFieldSmall}
          />
        </View>

        <Text style={styles.staticClause}>
          Valable pour un (1) mois et non remboursable.
        </Text>

        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>A déjà travaillé :</Text>
          <BinaryCheck
            value={formData.a_deja_travaille}
            onChange={(v) => updateForm('a_deja_travaille', v)}
          />
        </View>

        {formData.a_deja_travaille && (
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Si oui, contact ancien patron :</Text>
            <EditableField
              value={formData.contact_ancien_patron}
              onChangeText={(t) => updateForm('contact_ancien_patron', t)}
              placeholder="___________________________"
              fieldStyle={styles.inlineFieldLarge}
            />
          </View>
        )}
      </View>

      {/* ── Parents ──────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>PARENTS</Text>

        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Père :</Text>
          <EditableField
            value={formData.pere_nom}
            onChangeText={(t) => updateForm('pere_nom', t)}
            placeholder="______________________________"
            fieldStyle={styles.inlineFieldLarge}
          />
          <Text style={styles.fieldLabelInline}>Mère :</Text>
          <EditableField
            value={formData.mere_nom}
            onChangeText={(t) => updateForm('mere_nom', t)}
            placeholder="______________________________"
            fieldStyle={styles.inlineFieldLarge}
          />
        </View>

        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Domicile ou quartier du père :</Text>
          <EditableField
            value={formData.domicile_parents}
            onChangeText={(t) => updateForm('domicile_parents', t)}
            placeholder="________________________________"
            fieldStyle={styles.inlineFieldLarge}
          />
        </View>
      </View>

      {/* ── Personnes à contacter en cas d'urgence ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>PERSONNES À CONTACTER EN CAS D'URGENCE</Text>

        {[1, 2, 3].map((i) => (
          <View key={i} style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>{i}.</Text>
            <EditableField
              value={formData[`urgence${i}_nom`]}
              onChangeText={(t) => updateForm(`urgence${i}_nom`, t)}
              placeholder="Nom et prénoms"
              fieldStyle={styles.inlineFieldMed}
            />
            <Text style={styles.fieldLabelInline}>Contact :</Text>
            <EditableField
              value={formData[`urgence${i}_contact`]}
              onChangeText={(t) => updateForm(`urgence${i}_contact`, t)}
              placeholder="Téléphone"
              fieldStyle={styles.inlineFieldMed}
            />
          </View>
        ))}
      </View>

      {/* ── Responsabilités employé ───────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>RESPONSABILITÉS</Text>
        {RESPONSABILITES_EMPLOYE.map((clause, idx) => (
          <Text key={idx} style={styles.clauseItem}>
            {idx + 1}.  {clause}
          </Text>
        ))}
      </View>

      {/* ── Signatures page 1 ────────────────── */}
      <View style={styles.sigBlock}>
        <SignatureBox
          label="EMPLOYE"
          name={formData.signature_employe || undefined}
          subtext={
            formData.employe_nom
              ? `${formData.employe_prenom} ${formData.employe_nom}`.trim()
              : ''
          }
        />
        <SignatureBox
          label="CHRISROI AGENCE"
          name={formData.signature_agence || undefined}
          subtext="Agent ChrisRoi"
        />
        <SignatureBox
          label="EMPLOYEUR"
          name={formData.signature_employeur || undefined}
          subtext={formData.employeur_nom}
        />
      </View>
    </View>
  );

  // ══════════════════════════════════════════════════════
  //  RENDU DU DOCUMENT — PAGE 2 : EMPLOYEUR
  // ══════════════════════════════════════════════════════
  const renderPage2 = () => (
    <View>
      {/* ── Séparateur de page visuel ─────────── */}
      <View style={styles.pageBreak}>
        <View style={styles.pageBreakLine} />
        <Text style={styles.pageBreakText}>─ PAGE SUIVANTE ─</Text>
        <View style={styles.pageBreakLine} />
      </View>

      {renderPageHeader('EMPLOYEUR')}

      {/* ── Infos employeur ────────────────────── */}
      <View style={styles.section}>
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Nom et Prénoms :</Text>
          <Text style={styles.fieldValue}>
            {formData.employeur_nom || (
              <Text style={styles.placeholderInline}>___________________________</Text>
            )}
          </Text>
        </View>

        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Domicile et quartier :</Text>
          <EditableField
            value={formData.employeur_domicile}
            onChangeText={(t) => updateForm('employeur_domicile', t)}
            placeholder="______________________________"
            fieldStyle={styles.inlineFieldLarge}
          />
        </View>

        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Contact :</Text>
          <EditableField
            value={formData.employeur_contact}
            onChangeText={(t) => updateForm('employeur_contact', t)}
            placeholder="__________________"
            fieldStyle={styles.inlineFieldMed}
          />
        </View>

        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Emploi proposé :</Text>
          <EditableField
            value={formData.poste}
            onChangeText={(t) => updateForm('poste', t)}
            placeholder="______________________________"
            fieldStyle={styles.inlineFieldLarge}
          />
          <Text style={styles.fieldLabelInline}>Salaire proposé :</Text>
          <EditableField
            value={formData.salaire}
            onChangeText={(t) => updateForm('salaire', t)}
            placeholder="______"
            fieldStyle={styles.inlineFieldSmall}
          />
          <Text style={styles.fieldLabelInline}>F CFA</Text>
        </View>
      </View>

      {/* ── Commission et frais ───────────────── */}
      <View style={styles.section}>
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Commission :</Text>
          <EditableField
            value={formData.commission_fixe}
            onChangeText={(t) => updateForm('commission_fixe', t)}
            placeholder="15000"
            fieldStyle={styles.inlineFieldSmall}
          />
          <Text style={styles.fieldLabelInline}>FCFA</Text>
        </View>

        <Text style={styles.staticClause}>
          Commission : 15 000 FCFA - Valable pour un (1) mois et non remboursable. Transport pour le déplacement du personnel de l'agence (5000 FCFA)
        </Text>

        <View style={styles.fieldRow}>
          <EditableField
            value={formData.frais_transport}
            onChangeText={(t) => updateForm('frais_transport', t)}
            placeholder="5000"
            fieldStyle={styles.inlineFieldSmall}
          />
          <Text style={styles.fieldLabelInline}>FCFA</Text>
        </View>

        <View style={styles.tiersBox}>
          <Text style={styles.tiersLabel}>
            Le tiers (1/3) du sur le premier salaire (montant prélever par l'employeur
            sur le salaire de l'employé(e))
          </Text>
          <View style={styles.fieldRow}>
            <Text style={styles.tiersValue}>
              {commissionTiers > 0
                ? `${formatMoney(commissionTiers)} FCFA`
                : '__________________'}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Responsabilités employeur ────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>RESPONSABILITÉS</Text>
        {RESPONSABILITES_EMPLOYEUR.map((clause, idx) => (
          <Text key={idx} style={styles.clauseItem}>
            {idx + 1}.  {clause}
          </Text>
        ))}
      </View>

      {/* ── Signatures page 2 (identique) ─────── */}
      <View style={styles.sigBlock}>
        <SignatureBox
          label="EMPLOYE"
          name={formData.signature_employe || undefined}
          subtext={
            formData.employe_nom
              ? `${formData.employe_prenom} ${formData.employe_nom}`.trim()
              : ''
          }
        />
        <SignatureBox
          label="CHRISROI AGENCE"
          name={formData.signature_agence || undefined}
          subtext="Agent ChrisRoi"
        />
        <SignatureBox
          label="EMPLOYEUR"
          name={formData.signature_employeur || undefined}
          subtext={formData.employeur_nom}
        />
      </View>
    </View>
  );

  // ══════════════════════════════════════════════════════
  //  RENDU PRINCIPAL
  // ══════════════════════════════════════════════════════
  const renderDocument = () => (
    <View style={styles.documentContent}>
      {renderPage1()}
      {renderPage2()}
    </View>
  );

  // ── Onglet Scanné ─────────────────────────────────────
  const renderScanTab = () => {
    const hasScan = scanData?.imageUrl;

    return (
      <View style={{ flex: 1, padding: 20, alignItems: 'center', justifyContent: 'center' }}>
        {scanLoading ? (
          <Text style={styles.scanLoadingText}>Chargement...</Text>
        ) : hasScan ? (
          <View style={styles.scanPreview}>
            <Image
              source={{ uri: scanData.imageUrl }}
              style={styles.scanImage}
              resizeMode="contain"
            />
            <Text style={styles.scanDate}>
              Scanné le {new Date(scanData.created).toLocaleDateString('fr-FR')}
            </Text>
          </View>
        ) : (
          <View style={styles.scanEmpty}>
            <Icon name="file-document-outline" size={48} color="#CCC" />
            <Text style={styles.scanEmptyText}>Aucun scan pour ce document</Text>
            {isEditing ? (
              <>
                {Platform.OS === 'web' ? (
                  <>
                    <TouchableOpacity
                      style={styles.scanBtn}
                      onPress={() => {
                        const input = document.getElementById('scan-file-input-contrat');
                        if (input) input.click();
                      }}
                    >
                      <Icon name="camera-plus-outline" size={20} color="#FFF" />
                      <Text style={styles.scanBtnText}>Scanner le document signé</Text>
                    </TouchableOpacity>
                    <input
                      id="scan-file-input-contrat"
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleScanWeb}
                    />
                  </>
                ) : (
                  <TouchableOpacity
                    style={styles.scanBtn}
                    onPress={handleScanDocument}
                  >
                    <Icon name="camera-plus-outline" size={20} color="#FFF" />
                    <Text style={styles.scanBtnText}>Scanner le document signé</Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <Text style={styles.scanEmptyHint}>
                Enregistrez d'abord le contrat pour pouvoir scanner.
              </Text>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      {/* ── Header ─────────────────────────────────────── */}
      <AppHeader
        title={isEditing && formData.numero_dossier ? `Contrat #${formData.numero_dossier}` : 'Contrat de placement'}
        showBack
        onBack={() => navigation.goBack()}
      />
      {/* ── Barre de navigation liée (vue contrat existant) ── */}
      {isEditing && (selectedEmploye || selectedEmployeur) && (
        <View style={styles.linkedEntitiesBar}>
          {selectedEmploye && (
            <TouchableOpacity
              style={styles.linkedEntityChip}
              onPress={() =>
                rootNavigation?.navigate('FicheInscriptionModal', {
                  id: formData.employe_id,
                  origin: { label: 'Contrat' },
                })
              }
            >
              <Icon name="account" size={16} color="#2a7a7a" />
              <Text style={styles.linkedEntityText}>
                {selectedEmploye.prenom} {selectedEmploye.nom}
              </Text>
            </TouchableOpacity>
          )}
          {selectedEmployeur && (
            <TouchableOpacity
              style={styles.linkedEntityChip}
              onPress={() =>
                tabNavigation?.navigate('EmployeursStack' as any, {
                  screen: 'EmployeurDetail',
                  params: { id: formData.employeur_id },
                })
              }
            >
              <Icon name="office-building" size={16} color="#5a7c3a" />
              <Text style={styles.linkedEntityText}>
                {formData.employeur_nom}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Onglets Numérique / Scanné ──────────────────── */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'numerique' && styles.tabActive]}
          onPress={() => setActiveTab('numerique')}
        >
          <Icon
            name="file-document-edit-outline"
            size={16}
            color={activeTab === 'numerique' ? Colors.primary : '#888'}
          />
          <Text
            style={[styles.tabText, activeTab === 'numerique' && styles.tabTextActive]}
          >
            Numérique
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'scanne' && styles.tabActive]}
          onPress={() => setActiveTab('scanne')}
        >
          <Icon
            name="scanner"
            size={16}
            color={activeTab === 'scanne' ? Colors.primary : '#888'}
          />
          <Text
            style={[styles.tabText, activeTab === 'scanne' && styles.tabTextActive]}
          >
            Scanné
          </Text>
          {scanData?.imageUrl && <View style={styles.scanBadge} />}
        </TouchableOpacity>
      </View>

      {/* ── Contenu selon l'onglet ──────────────────────── */}
      {activeTab === 'numerique' ? (
        <>
          {/* Sélecteurs — visibles seulement tant qu'un choix n'est pas fait */}
          {(!formData.employe_id || !formData.employeur_id) && (
            <View style={styles.pickerSection}>
              <TouchableOpacity
                onPress={() => setShowEmployePicker(true)}
                style={styles.pickerTrigger}
              >
                <Text style={styles.fieldLabel}>Employé</Text>
                {selectedEmploye ? (
                  <Text style={styles.pickerValue}>
                    {selectedEmploye.prenom} {selectedEmploye.nom} —{' '}
                    {selectedEmploye.categorie_emploi || ''}
                  </Text>
                ) : (
                  <Text style={styles.pickerPlaceholder}>
                    👤 Tap pour sélectionner...
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowEmployeurPicker(true)}
                style={[styles.pickerTrigger, { marginTop: 8 }]}
              >
                <Text style={styles.fieldLabel}>Employeur</Text>
                {selectedEmployeur ? (
                  <Text style={styles.pickerValue}>
                    {selectedEmployeur.nom_complet ||
                      selectedEmployeur.raison_sociale ||
                      selectedEmployeur.nom}
                  </Text>
                ) : (
                  <Text style={styles.pickerPlaceholder}>
                    🏢 Tap pour sélectionner...
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          <A4Document
            title={
              isEditing
                ? 'Contrat de placement (modification)'
                : 'Nouveau contrat de placement'
            }
            onSave={handleSave}
            onPrint={handleSave}
            onAfterPrint={handleAfterPrint}
            pageCount={2}
          >
            {renderDocument()}
          </A4Document>
        </>
      ) : (
        renderScanTab()
      )}

      {renderPickerModal(
        showEmployePicker,
        () => setShowEmployePicker(false),
        employes,
        handleSelectEmploye,
        formData.employe_id,
        true,
      )}
      {renderPickerModal(
        showEmployeurPicker,
        () => setShowEmployeurPicker(false),
        employeurs,
        handleSelectEmployeur,
        formData.employeur_id,
        false,
      )}
    </View>
  );
}
// ═══════════════════════════════════════════════════════════
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
