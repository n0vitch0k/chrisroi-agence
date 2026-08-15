import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { ContratFormNavigationProp } from '../types/navigation';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import AppHeader from '../components/AppHeader';
import SectionCard from '../components/SectionCard';
import SafeButton from '../components/SafeButton';
import FormField from '../components/FormField';
import { createContrat, getAllEmployes, getAllEmployeurs } from '../database/service';
import { formatMoney } from '../utils/constants';
import { Colors, Spacing, Radius, Typography, Shadows } from '../theme';

const TYPES_CONTRAT = [
  { value: 'heberge', label: 'Hébergé sur place' },
  { value: 'non_heberge', label: 'Non hébergé' },
  { value: 'personnalise', label: 'Personnalisé' },
];

// ─── Types ─────────────────────────────────────────────────
interface FormData {
  employe_id: string;
  employeur_id: string;
  date_contrat: string;
  poste: string;
  type_contrat: string;
  date_debut: string;
  date_fin: string;
  salaire: string;
  commission_fixe: string;
  frais_transport: string;
  notes: string;
}

// ─── Composants réutilisables ──────────────────────────────
function SelectField({
  label,
  value,
  options,
  onSelect,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onSelect: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const selectedLabel = options.find((o) => o.value === value)?.label;

  return (
    <View style={styles.fieldWrapper}>
      <Text style={styles.label}>
        {label}
        {required && <Text style={styles.required}> *</Text>}
      </Text>
      <TouchableOpacity style={styles.selectInput} onPress={() => setShowPicker(true)} activeOpacity={0.7}>
        <Text style={[styles.selectText, !selectedLabel && styles.placeholder]}>
          {selectedLabel || placeholder || 'Sélectionner...'}
        </Text>
        <Icon name="chevron-down" size={20} color={Colors.icon} />
      </TouchableOpacity>

      <Modal visible={showPicker} transparent animationType="fade" onRequestClose={() => setShowPicker(false)}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowPicker(false)}>
          <View style={styles.pickerModal}>
            <Text style={styles.pickerTitle}>{label}</Text>
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.pickerOption, item.value === value && styles.pickerOptionSelected]}
                  onPress={() => { onSelect(item.value); setShowPicker(false); }}
                >
                  <Text style={[styles.pickerOptionText, item.value === value && styles.pickerOptionTextSelected]}>
                    {item.label}
                  </Text>
                  {item.value === value && <Icon name="check" size={18} color={Colors.primary} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ─── Screen ─────────────────────────────────────────────────
export default function ContratFormScreen() {
  const navigation = useNavigation<ContratFormNavigationProp>();
  const route = useRoute();

  const [formData, setFormData] = useState<FormData>({
    employe_id: '',
    employeur_id: '',
    date_contrat: new Date().toISOString().substring(0, 10),
    poste: '',
    type_contrat: 'heberge',
    date_debut: '',
    date_fin: '',
    salaire: '',
    commission_fixe: '15000',
    frais_transport: '5000',
    notes: '',
  });

  const [employes, setEmployes] = useState<any[]>([]);
  const [employeurs, setEmployeurs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  // Charger employés et employeurs au montage
  React.useEffect(() => {
    (async () => {
      try {
        const [emp, empr] = await Promise.all([getAllEmployes(), getAllEmployeurs()]);
        setEmployes(emp || []);
        setEmployeurs(empr || []);
      } catch (e) { console.error(e); }
    })();
  }, []);

  const update = (field: keyof FormData, value: string) => setFormData((p) => ({ ...p, [field]: value }));

  const handleSubmit = async () => {
    if (!formData.employe_id || !formData.employeur_id || !formData.salaire) {
      Alert.alert('Champs requis', 'Veuillez remplir l\'employé, l\'employeur et le salaire.');
      return;
    }
    setLoading(true);
    try {
      const id = await createContrat({
        ...formData,
        salaire: Number(formData.salaire),
        commission_fixe: Number(formData.commission_fixe),
        frais_transport: Number(formData.frais_transport),
      });
      setSavedId(id);
      Alert.alert('Contrat créé', 'Le contrat a été enregistré avec succès.', [
        { text: 'OK', onPress: () => {} },
      ]);
    } catch (e: any) {
      Alert.alert('Erreur', e.message || 'Impossible de créer le contrat.');
    } finally {
      setLoading(false);
    }
  };

  const employesOptions = employes.map((e) => ({ value: e.id, label: `${e.prenom} ${e.nom}` }));
  const employeursOptions = employeurs.map((e) => ({ value: e.id, label: e.nom_complet }));

  return (
    <View style={styles.container}>
      <AppHeader title="Nouveau contrat" showBack onBack={() => navigation.goBack()} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Sélection Employé */}
        <SectionCard title="👤 Employé">
          <SelectField
            label="Employé"
            value={formData.employe_id}
            options={employesOptions}
            onSelect={(v) => update('employe_id', v)}
            placeholder="Sélectionner un employé..."
            required
          />
        </SectionCard>

        {/* Sélection Employeur */}
        <SectionCard title="🏢 Employeur">
          <SelectField
            label="Employeur"
            value={formData.employeur_id}
            options={employeursOptions}
            onSelect={(v) => update('employeur_id', v)}
            placeholder="Sélectionner un employeur..."
            required
          />
        </SectionCard>

        {/* Détails du contrat */}
        <SectionCard title="📄 Détails du contrat">
          <FormField label="Poste" value={formData.poste} onChangeText={(v) => update('poste', v)} placeholder="Ex: Nounou, Chauffeur..." required />
          <SelectField
            label="Type de contrat"
            value={formData.type_contrat}
            options={TYPES_CONTRAT}
            onSelect={(v) => update('type_contrat', v)}
            required
          />
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <FormField label="Date début" value={formData.date_debut} onChangeText={(v) => update('date_debut', v)} placeholder="AAAA-MM-JJ" required />
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <FormField label="Date fin" value={formData.date_fin} onChangeText={(v) => update('date_fin', v)} placeholder="AAAA-MM-JJ" />
            </View>
          </View>
          <FormField label="Salaire (FCFA)" value={formData.salaire} onChangeText={(v) => update('salaire', v)} keyboardType="numeric" placeholder="Ex: 45000" required />
        </SectionCard>

        {/* Commission & Frais */}
        <SectionCard title="💰 Commission & Frais">
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <FormField label="Commission fixe" value={formData.commission_fixe} onChangeText={(v) => update('commission_fixe', v)} keyboardType="numeric" placeholder="15000" />
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <FormField label="Frais transport" value={formData.frais_transport} onChangeText={(v) => update('frais_transport', v)} keyboardType="numeric" placeholder="5000" />
            </View>
          </View>
          {formData.salaire ? (
            <View style={styles.commissionPreview}>
              <Icon name="calculator-variant" size={16} color={Colors.primary} />
              <Text style={styles.commissionText}>
                Commission agence : <Text style={styles.commissionValue}>{formatMoney(Math.round(Number(formData.salaire) / 3))} FCFA</Text>
              </Text>
            </View>
          ) : null}
        </SectionCard>

        {/* Notes */}
        <SectionCard title="📝 Notes">
          <FormField label="Notes" value={formData.notes} onChangeText={(v) => update('notes', v)} multiline numberOfLines={3} placeholder="Informations complémentaires..." />
        </SectionCard>

        <SafeButton onPress={handleSubmit} loading={loading} style={styles.submitBtn}>
          Créer le contrat
        </SafeButton>

        {savedId && (
          <TouchableOpacity
            style={styles.viewDocumentBtn}
            onPress={() => navigation.navigate('ContratDocument', { id: savedId })}
            activeOpacity={0.7}
          >
            <Icon name="file-document-outline" size={18} color={Colors.primary} />
            <Text style={styles.viewDocumentText}>Voir le document (A4)</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg, paddingBottom: 40 },

  // Row
  row: { flexDirection: 'row', alignItems: 'flex-start' },

  // Commission preview
  commissionPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primaryDim,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.sm,
  },
  commissionText: { fontSize: 13, color: Colors.textSecondary },
  commissionValue: { fontWeight: '700', color: Colors.primary },

  // Select
  fieldWrapper: { marginBottom: Spacing.md },
  label: { ...Typography.label, color: Colors.textSecondary, marginBottom: Spacing.sm },
  required: { color: Colors.danger },
  selectInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
  },
  selectText: { fontSize: 15, color: Colors.text, flex: 1 },
  placeholder: { color: Colors.textTertiary },

  // Picker modal
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  pickerModal: { width: '85%', maxWidth: 360, maxHeight: '70%', backgroundColor: Colors.surface, borderRadius: Radius.xl, paddingVertical: Spacing.lg, ...Shadows.elevated },
  pickerTitle: { ...Typography.h3, color: Colors.text, marginBottom: Spacing.md, paddingHorizontal: Spacing.lg },
  pickerOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderLight },
  pickerOptionSelected: { backgroundColor: Colors.primaryDim },
  pickerOptionText: { fontSize: 15, color: Colors.text },
  pickerOptionTextSelected: { color: Colors.primary, fontWeight: '600' },

  // Submit
  submitBtn: { marginTop: Spacing.lg },
  viewDocumentBtn: {
    marginTop: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 14,
  },
  viewDocumentText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
});
