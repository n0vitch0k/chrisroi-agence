import React, { useState, useCallback } from 'react';
import type { EmployeurDetailNavigationProp } from '../types/navigation';

import {
  Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View,
  ViewStyle, Modal, Platform,
} from 'react-native';
import { Card, Chip, Divider, Menu } from 'react-native-paper';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import AppHeader from '../components/AppHeader';
import {
  getEmployeurById, deleteEmployeur, getContratsByEmployeur,
  getDocumentsByEmployeur, uploadEmployeurDocument, deleteDocument,
  DOCUMENT_TYPES, getDocumentTypeLabel, getDocumentTypeIcon,
} from '../database/service';
import { formatDate, getTypeBesoinLabel } from '../utils/constants';
import { Colors, Spacing, Radius, Shadows } from '../theme';
import SafeButton from '../components/SafeButton';

export default function EmployeurDetailScreen() {
  const navigation = useNavigation<EmployeurDetailNavigationProp>();
  const route = useRoute<any>();
  const rootNavigation = navigation.getParent()?.getParent();
  const employeurId = route.params?.id;
  const [employeur, setEmployeur] = useState<any | null>(null);
  const [contrats, setContrats] = useState<any[]>([]);
  const [menuVisible, setMenuVisible] = useState(false);

  // ── Documents associés ─────────────────────────────────
  const [documents, setDocuments] = useState<any[]>([]);
  const [showDocTypePicker, setShowDocTypePicker] = useState(false);
  const [showDocSourcePicker, setShowDocSourcePicker] = useState(false);
  const [docTypePending, setDocTypePending] = useState<string | null>(null);
  const [docsLoading, setDocsLoading] = useState(false);

  const loadData = async () => {
    try {
      const data = await getEmployeurById(employeurId);
      setEmployeur(data || null);
      if (data?.nom_complet) {
        navigation.setOptions({ title: data.nom_complet });
      }
      const c = await getContratsByEmployeur(employeurId);
      setContrats(c || []);
    } catch (error) { console.error('Error loading employeur:', error); }
  };

  const loadDocuments = useCallback(async () => {
    try {
      const docs = await getDocumentsByEmployeur(employeurId);
      setDocuments(docs || []);
    } catch (e) {
      console.warn('loadDocuments error:', e);
    }
  }, [employeurId]);

  useFocusEffect(useCallback(() => { loadData(); loadDocuments(); }, [employeurId, loadDocuments]));

  // Header custom : titre = nom de l'employeur.
  const headerTitle = employeur?.nom_complet || 'Employeur';

  const handleDelete = () => {
    Alert.alert('Confirmer la suppression', 'Êtes-vous sûr de vouloir supprimer cet employeur ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          try {
            await deleteEmployeur(employeurId);
            navigation.goBack();
          } catch (error) {
            console.error('Error deleting employeur:', error);
            Alert.alert('Erreur', 'Une erreur est survenue');
          }
        },
      },
    ]);
  };

  if (!employeur) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={{ color: Colors.textSecondary }}>Chargement...</Text>
      </View>
    );
  }

  const InfoRow = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
    <View style={styles.infoRow}>
      <Icon name={icon as any} size={17} color={Colors.iconLight} style={styles.infoIcon} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '-'}</Text>
    </View>
  );

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
      await loadDocuments();
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

  return (
      <ScrollView style={styles.container}>
        <AppHeader title={headerTitle} showBack onBack={() => navigation.goBack()} />
        {/* ── Entête ─────────────────────────────────────── */}
      <View style={header}>
        <View style={[styles.avatar, { backgroundColor: Colors.primaryLight + 'CC' }]}>
          <Icon name={employeur.type_besoin === 'particulier' ? 'account' : 'office-building'} size={28} color={Colors.primaryDark} />
        </View>
        <Text style={styles.name}>{employeur.nom_complet}</Text>
        <Text style={styles.sector}>{getTypeBesoinLabel(employeur.type_besoin)}</Text>
        <View style={styles.actionsRow}>
          <SafeButton mode="contained"
           onPress={() => navigation.navigate('EmployeurForm', { id: employeurId })}
            style={styles.editBtn}>
            Modifier
          </SafeButton>
          <Menu visible={menuVisible} onDismiss={() => setMenuVisible(false)}
            anchor={
              <TouchableOpacity style={styles.moreBtn} onPress={() => setMenuVisible(true)}>
                <Icon name="dots-vertical" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            }>
            <Menu.Item onPress={() => { setMenuVisible(false); handleDelete(); }}
              title="Supprimer" leadingIcon="delete" titleStyle={{ color: Colors.danger }} />
          </Menu>
        </View>
      </View>

        {/* ── Coordonnées ────────────────────────────────── */}
        <Card style={card}>
          <View style={styles.accent} />
          <Card.Content style={styles.cardContent}>
            <Text style={styles.blockTitle}>Coordonnées</Text>
            <InfoRow icon="map-marker" label="Adresse" value={employeur.adresse} />
            <InfoRow icon="phone" label="Téléphone" value={employeur.telephone} />
            <InfoRow icon="email" label="Email" value={employeur.email} />
          </Card.Content>
        </Card>

        {/* ── Contact (entreprise + commerce uniquement) ──────── */}
        {employeur.type_besoin !== 'particulier' && (employeur.nom_contact || employeur.prenom_contact || employeur.fonction_contact) && (
          <Card style={card}>
            <View style={[styles.accent, { backgroundColor: Colors.info }]} />
            <Card.Content style={styles.cardContent}>
              <Text style={styles.blockTitle}>
                {employeur.type_besoin === 'commerce' ? 'Responsable du commerce' : 'Personne de contact'}
              </Text>
              <InfoRow icon="account" label="Nom" value={employeur.nom_contact} />
              <InfoRow icon="badge-account" label="Prénom" value={employeur.prenom_contact} />
              {employeur.fonction_contact && (
                <InfoRow icon="briefcase" label="Fonction" value={employeur.fonction_contact} />
              )}
            </Card.Content>
          </Card>
        )}

        {/* ── Documents ─────────────────────────────────── */}
        <Card style={card}>
          <View style={[styles.accent, { backgroundColor: Colors.primary }]} />
          <Card.Content style={styles.cardContent}>
            <View style={styles.blockHeaderRow}>
              <Text style={styles.blockTitle}>Documents</Text>
              <TouchableOpacity onPress={openDocTypePicker} disabled={docsLoading}>
                <Icon name="plus-circle" size={22} color={Colors.primary} />
              </TouchableOpacity>
            </View>

            {documents.length === 0 ? (
              <Text style={styles.emptyHint}>Aucun document joint.</Text>
            ) : (
              documents.map((doc) => (
                <View key={doc.id} style={styles.docItem}>
                  <Icon name="file-document-outline" size={22} color={Colors.primary} />
                  <View style={styles.docInfo}>
                    <Text style={styles.docLabel}>
                      {getDocumentTypeIcon(doc.type)} {getDocumentTypeLabel(doc.type)}
                    </Text>
                    {doc.imageUrl ? (
                      <Text style={styles.docLink}>Voir le document</Text>
                    ) : null}
                  </View>
                  <TouchableOpacity onPress={() => removeDocument(doc.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Icon name="trash-can-outline" size={20} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </Card.Content>
        </Card>

        {/* ── Notes ──────────────────────────────────────── */}
        {!!employeur.notes && (
          <Card style={card}>
            <View style={styles.accent} />
            <Card.Content style={styles.cardContent}>
              <Text style={styles.blockTitle}>Notes</Text>
              <Text style={styles.notes}>{employeur.notes}</Text>
            </Card.Content>
          </Card>
        )}

        {/* ── Employés liés ─────────────────────────────────── */}
        {contrats.length > 0 && (
          <Card style={card}>
            <View style={[styles.accent, { backgroundColor: Colors.primary }]} />
            <Card.Content style={styles.cardContent}>
              <Text style={styles.blockTitle}>Employés placés ({[...new Set(contrats.map((c:any) => c.employe_id))].length})</Text>
              {contrats.map((contrat: any) => (
                <TouchableOpacity key={contrat.id}
                  onPress={() => rootNavigation?.navigate('FicheInscriptionModal', {
                    id: contrat.employe_id,
                    origin: { label: employeur?.nom_complet || 'Employeur' }
                  })}
                  style={styles.employeItem}
                >
                  <View style={styles.employeRow}>
                    <View style={[styles.employeAvatar, { backgroundColor: Colors.primaryLight }]}>
                      <Icon name="account" size={18} color={Colors.primaryDark} />
                    </View>
                    <View style={styles.employeInfo}>
                      <Text style={styles.employeName}>
                        {contrat.employe_prenom} {contrat.employe_nom}
                      </Text>
                      <Text style={styles.employePoste}>{contrat.poste || contrat.employe_categorie || ''}</Text>
                    </View>
                    <Chip mode="outlined" compact style={styles.miniChip}
                      textStyle={{ fontSize: 10, color: '#666' }}>
                      {contrat.numero_dossier || '-'}
                    </Chip>
                  </View>
                </TouchableOpacity>
              ))}
            </Card.Content>
          </Card>
        )}

        <View style={{ height: Spacing.xxl }} />

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
          onRequestClose={() => { setShowDocSourcePicker(false); setDocTypePending(null); }}
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
                      mediaTypes: 'images',
                      quality: 0.85,
                    });
                    if (!result.canceled && result.assets[0]) {
                      uploadPendingDocument(result.assets[0].uri);
                    } else {
                      setDocTypePending(null);
                    }
                  } catch (e: any) {
                    Alert.alert('Erreur', e?.message || "Impossible d'ouvrir la galerie.");
                    setDocTypePending(null);
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
                  const { status } = await ImagePicker.requestCameraPermissionsAsync();
                  if (status !== 'granted') {
                    Alert.alert('Permission refusée', "Autorisez l'accès à l'appareil photo.");
                    setDocTypePending(null);
                    return;
                  }
                  try {
                    const result = await ImagePicker.launchCameraAsync({
                      mediaTypes: 'images',
                      quality: 0.85,
                    });
                    if (!result.canceled && result.assets[0]) {
                      uploadPendingDocument(result.assets[0].uri);
                    } else {
                      setDocTypePending(null);
                    }
                  } catch (e: any) {
                    Alert.alert('Erreur', e?.message || "Impossible d'ouvrir l'appareil photo.");
                    setDocTypePending(null);
                  }
                }}
              >
                <Icon name="camera-outline" size={22} color={Colors.primary} />
                <Text style={docStyles.sourceLabel}>Prendre une photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[docStyles.sourceItem, docStyles.sourceCancel]}
                onPress={() => { setShowDocSourcePicker(false); setDocTypePending(null); }}
              >
                <Text style={[docStyles.sourceLabel, { color: '#999' }]}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Web : input file caché pour l'ajout de document */}
        {Platform.OS === 'web' && showDocSourcePicker ? (
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleDocWeb} />
        ) : null}
      </ScrollView>
  );
}

const header: ViewStyle = { alignItems: 'center', padding: Spacing.xl, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border, ...Shadows.soft };
const card: ViewStyle = { marginHorizontal: Spacing.lg, marginTop: Spacing.lg, backgroundColor: Colors.surface, borderRadius: Radius.md, overflow: 'hidden', ...Shadows.card };

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  name: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  sector: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.lg, gap: Spacing.sm },
  editBtn: { flex: 1, borderRadius: Radius.md },
  moreBtn: { padding: Spacing.sm, marginLeft: Spacing.xs },

  accent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: Colors.primary },
  cardContent: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  blockTitle: { fontSize: 16, color: Colors.textPrimary, marginBottom: Spacing.sm, fontWeight: '600' },
  blockHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },

  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  infoIcon: { marginRight: Spacing.sm, width: 20 },
  infoLabel: { width: 90, color: Colors.textSecondary, fontSize: 13 },
  infoValue: { flex: 1, color: Colors.textPrimary, fontSize: 14, fontWeight: '500' },

  notes: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },

  emptyHint: { color: Colors.textTertiary, fontSize: 13, fontStyle: 'italic', marginTop: 4 },
  docItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  docInfo: { flex: 1 },
  docLabel: { color: Colors.textPrimary, fontSize: 14 },
  docLink: { color: Colors.primary, fontSize: 12, marginTop: 2 },

  employeItem: { paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  employeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  employeAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  employeInfo: { flex: 1 },
  employeName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  employePoste: { color: Colors.textSecondary, fontSize: 12 },
  miniChip: { height: 24 },
});

// Styles partagés pour les modales de documents
const docStyles = StyleSheet.create({
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sourceSheet: { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, padding: Spacing.lg, paddingBottom: Spacing.xl },
  sourceTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  sourceSubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.md },
  sourceItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  sourceCancel: { borderTopWidth: 1, borderTopColor: Colors.borderLight, marginTop: Spacing.sm },
  sourceLabel: { fontSize: 15, color: Colors.textPrimary },
  docTypeItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  docTypeIcon: { fontSize: 22, width: 28, textAlign: 'center' },
});
