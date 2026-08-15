import React, { useState, useEffect } from 'react';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { Card, TextInput, Button, Divider, Menu, IconButton } from 'react-native-paper';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import type { RootStackParamList } from '../types/navigation';
import type {
  DocumentType,
  ExtractedData,
  FicheInscriptionExtracted,
  ContratExtracted,
} from '../types/scan';
import * as service from '../database/service';
import { getPocketBase } from '../database/pocketbase';
import { Colors, Spacing, Radius, Typography, Shadows } from '../theme';
import SafeButton from '../components/SafeButton';
import AppHeader from '../components/AppHeader';

type Props = {
  route: {
    params: {
      imageUri: string;
      documentType: DocumentType;
      extracted: ExtractedData;
    };
  };
  navigation: NativeStackNavigationProp<RootStackParamList, 'ScanResult'>;
};

export default function ScanResultScreen({ route, navigation }: Props) {
  const { imageUri, documentType, extracted: initialExtracted } = route.params;
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // État éditable pour Fiche d'Inscription
  const [fiche, setFiche] = useState<FicheInscriptionExtracted>(
    documentType === 'fiche_inscription'
      ? (initialExtracted as FicheInscriptionExtracted)
      : undefined as any
  );
  // État éditable pour Contrat
  const [contrat, setContrat] = useState<ContratExtracted>(
    documentType === 'contrat'
      ? (initialExtracted as ContratExtracted)
      : undefined as any
  );

  const handleCreate = async () => {
    setSaving(true);
    try {
      if (documentType === 'fiche_inscription') {
        await createFicheInscription();
      } else {
        await createContrat();
      }
      setSaved(true);
      Alert.alert('Succès', 'Document créé avec succès.', [
        { text: 'OK', onPress: () => navigation.popToTop() },
      ]);
    } catch (error: any) {
      Alert.alert('Erreur', error?.message || 'Impossible de créer le document');
    } finally {
      setSaving(false);
    }
  };

  const createFicheInscription = async () => {
    // Anti-doublon : recherche d'un employé existant de même nom/prénom
    let employeId: string;
    const existing = await service.searchEmployes(
      `${fiche.prenom} ${fiche.nom}`
    );
    const exactMatch = (existing || []).find(
      (e: any) =>
        (e.nom || '').toLowerCase() === (fiche.nom || '').toLowerCase() &&
        (e.prenom || '').toLowerCase() === (fiche.prenom || '').toLowerCase()
    );

    if (exactMatch) {
      const reuse = await new Promise<boolean>((resolve) => {
        Alert.alert(
          'Employé existant détecté',
          `Un candidat « ${fiche.prenom} ${fiche.nom} » existe déjà. Voulez-vous réutiliser la fiche existante plutôt que d'en créer une nouvelle ?`,
          [
            { text: 'Créer une nouvelle fiche', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Réutiliser l\'existant', onPress: () => resolve(true) },
          ]
        );
      });
      if (reuse) {
        employeId = exactMatch.id;
        await service.uploadScan('fiche_inscription', employeId, imageUri);
        return;
      }
    }

    employeId = await service.createEmploye({
      nom: fiche.nom,
      prenom: fiche.prenom,
      date_naissance: fiche.date_naissance,
      telephone: fiche.telephone,
      adresse: fiche.adresse,
      lieu_residence: fiche.lieu_residence,
      nationalite: fiche.nationalite || '',
      categorie_emploi: fiche.categorie_emploi,
      situation_matrimoniale: fiche.situation_matrimoniale,
      niveau_etude: fiche.niveau_etude,
      religion: fiche.religion || '',
      peut_lire_ecrire: fiche.peut_lire_ecrire,
      taille: fiche.taille,
      poids: fiche.poids,
      photo_uri: '',
      lieux_naissance: '',
      a_deja_travaille: false,
      experience_details: '',
      stages_effectues: '',
      formations: '',
      motivation: '',
      parents: [],
      personnes_urgence: [{
        nom: fiche.personne_contact,
        telephone: fiche.contact_urgence,
      }],
    });

    if (fiche.experiences?.length) {
      for (const exp of fiche.experiences) {
        await service.addExperience(employeId, {
          entreprise: (exp as any).entreprise || '',
          lieu: (exp as any).lieu || '',
          duree: (exp as any).duree || '',
        });
      }
    }

    await service.uploadScan('fiche_inscription', employeId, imageUri);
  };

  const createContrat = async () => {
    // 1. Employé
    let employeId: string | null = null;
    const existingEmployes = await service.searchEmployes(
      contrat.employe_nom + ' ' + contrat.employe_prenom
    );
    if (existingEmployes?.length > 0) {
      employeId = existingEmployes[0].id;
    } else {
      employeId = await service.createEmploye({
        nom: contrat.employe_nom,
        prenom: contrat.employe_prenom,
        telephone: contrat.employe_telephone,
        adresse: contrat.employe_adresse,
        date_naissance: '',
        lieu_residence: contrat.employe_adresse,
        categorie_emploi: contrat.poste,
        situation_matrimoniale: 'celibataire',
        niveau_etude: '',
        peut_lire_ecrire: false,
        photo_uri: '',
        lieux_naissance: '',
        a_deja_travaille: false,
        experience_details: '',
        stages_effectues: '',
        formations: '',
        motivation: '',
        parents: [],
        personnes_urgence: [],
      });
    }

    // 2. Employeur
    let employeurId: string | null = null;
    try {
      const pb = getPocketBase();
      const empRecords = await pb.collection('employeurs').getFullList({
        filter: `nom_complet ~ "${contrat.employeur_nom_complet}"`,
        limit: 1,
      });
      if (empRecords?.length > 0) {
        employeurId = empRecords[0].id;
      }
    } catch {}
    if (!employeurId) {
      employeurId = await service.createEmployeur({
        nom_complet: contrat.employeur_nom_complet,
        type_besoin: contrat.employeur_type || 'particulier',
        telephone: contrat.employeur_telephone,
        adresse: contrat.employeur_adresse,
        email: '',
        nom_contact: '',
        prenom_contact: '',
        notes: '',
      });
    }

    // 3. Contrat (commission calculée dans createContrat)
    const contratId = await service.createContrat({
      employe_id: employeId,
      employeur_id: employeurId,
      poste: contrat.poste,
      type_contrat: contrat.type_contrat,
      date_debut: contrat.date_debut,
      date_fin: contrat.date_fin,
      duree: contrat.duree,
      salaire: contrat.salaire,
      notes: contrat.notes || '',
      domicile_employe: contrat.employe_adresse,
    });

    // 4. Upload scan
    await service.uploadScan('contrat', contratId, imageUri);
  };

  if (saved) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Icon name="check-circle" size={64} color={Colors.success} />
        <Text style={styles.successTitle}>Document créé !</Text>
        <SafeButton mode="contained" onPress={() => navigation.popToTop()}>
          Retour
        </SafeButton>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <AppHeader title="Résultat du scan" showBack onBack={() => navigation.goBack()} />
      {/* Aperçu du scan */}
      <Card style={styles.previewCard}>
        <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" />
        <Text style={styles.previewLabel}>
          {documentType === 'fiche_inscription' ? "Fiche d'inscription scannée" : 'Contrat scanné'}
        </Text>
      </Card>

      <Text style={styles.sectionTitle}>Informations extraites — Vérifiez avant de créer</Text>
      <Text style={styles.sectionHint}>Corrigez les éventuelles erreurs de lecture ci-dessous</Text>

      {documentType === 'fiche_inscription' ? (
        <FicheForm fiche={fiche} setFiche={setFiche} />
      ) : (
        <ContratForm contrat={contrat} setContrat={setContrat} />
      )}

      <SafeButton
        mode="contained"
        onPress={handleCreate}
        loading={saving}
        disabled={saving}
        style={styles.createButton}
      >
        {saving ? 'Création en cours...' : 'Créer le document'}
      </SafeButton>
    </ScrollView>
  );
}

// ─── Formulaire Fiche d'Inscription ──────────────────────────

function FicheForm({ fiche, setFiche }: { fiche: FicheInscriptionExtracted; setFiche: (f: any) => void }) {
  const f = (k: keyof FicheInscriptionExtracted) => ({
    value: String((fiche as any)[k] ?? ''),
    onChangeText: (t: string) => setFiche({ ...fiche, [k]: t }),
  });

  return (
    <Card style={styles.formCard}>
      <Card.Content>
        <Text style={styles.formSectionTitle}>Identité</Text>
        <View style={styles.row2}>
          <TextInput label="Nom" {...f('nom')} mode="outlined" style={styles.halfInput} outlineStyle={{ borderRadius: Radius.sm }} />
          <TextInput label="Prénom" {...f('prenom')} mode="outlined" style={styles.halfInput} outlineStyle={{ borderRadius: Radius.sm }} />
        </View>
        <TextInput label="Date de naissance" {...f('date_naissance')} mode="outlined" style={styles.fullInput} outlineStyle={{ borderRadius: Radius.sm }} placeholder="JJ/MM/AAAA" />
        <TextInput label="Téléphone" {...f('telephone')} mode="outlined" style={styles.fullInput} outlineStyle={{ borderRadius: Radius.sm }} keyboardType="phone-pad" />
        <TextInput label="Adresse" {...f('adresse')} mode="outlined" style={styles.fullInput} outlineStyle={{ borderRadius: Radius.sm }} multiline />
        <View style={styles.row2}>
          <TextInput label="Lieu de résidence" {...f('lieu_residence')} mode="outlined" style={styles.halfInput} outlineStyle={{ borderRadius: Radius.sm }} />
          <TextInput label="Nationalité" {...f('nationalite')} mode="outlined" style={styles.halfInput} outlineStyle={{ borderRadius: Radius.sm }} />
        </View>
        <View style={styles.row2}>
          <TextInput label="Ville d'origine" {...f('ville_origine')} mode="outlined" style={styles.halfInput} outlineStyle={{ borderRadius: Radius.sm }} />
          <TextInput label="Catégorie emploi" {...f('categorie_emploi')} mode="outlined" style={styles.halfInput} outlineStyle={{ borderRadius: Radius.sm }} />
        </View>

        <Divider style={styles.formDivider} />
        <Text style={styles.formSectionTitle}>Informations complémentaires</Text>
        <View style={styles.row2}>
          <TextInput label="Taille" {...f('taille')} mode="outlined" style={styles.halfInput} outlineStyle={{ borderRadius: Radius.sm }} />
          <TextInput label="Poids" {...f('poids')} mode="outlined" style={styles.halfInput} outlineStyle={{ borderRadius: Radius.sm }} />
        </View>
        <View style={styles.row2}>
          <TextInput label="Situation matrimoniale" {...f('situation_matrimoniale')} mode="outlined" style={styles.halfInput} outlineStyle={{ borderRadius: Radius.sm }} />
          <TextInput label="Niveau d'étude" {...f('niveau_etude')} mode="outlined" style={styles.halfInput} outlineStyle={{ borderRadius: Radius.sm }} />
        </View>
        <TextInput label="Religion" {...f('religion')} mode="outlined" style={styles.fullInput} outlineStyle={{ borderRadius: Radius.sm }} />

        <Divider style={styles.formDivider} />
        <Text style={styles.formSectionTitle}>Contact d'urgence</Text>
        <TextInput label="Personne à contacter" {...f('personne_contact')} mode="outlined" style={styles.fullInput} outlineStyle={{ borderRadius: Radius.sm }} />
        <TextInput label="Téléphone d'urgence" {...f('contact_urgence')} mode="outlined" style={styles.fullInput} outlineStyle={{ borderRadius: Radius.sm }} keyboardType="phone-pad" />

        <Divider style={styles.formDivider} />
        <Text style={styles.formSectionTitle}>Parents</Text>
        <View style={styles.row2}>
          <TextInput label="Nom du père" {...f('nom_pere')} mode="outlined" style={styles.halfInput} outlineStyle={{ borderRadius: Radius.sm }} />
          <TextInput label="Nom de la mère" {...f('nom_mere')} mode="outlined" style={styles.halfInput} outlineStyle={{ borderRadius: Radius.sm }} />
        </View>
      </Card.Content>
    </Card>
  );
}

// ─── Formulaire Contrat ─────────────────────────────────────

function ContratForm({ contrat, setContrat }: { contrat: ContratExtracted; setContrat: (c: any) => void }) {
  const c = (k: keyof ContratExtracted) => ({
    value: String((contrat as any)[k] ?? ''),
    onChangeText: (t: string) => setContrat({ ...contrat, [k]: t }),
  });

  return (
    <Card style={styles.formCard}>
      <Card.Content>
        <Text style={styles.formSectionTitle}>Employé</Text>
        <View style={styles.row2}>
          <TextInput label="Nom" {...c('employe_nom')} mode="outlined" style={styles.halfInput} outlineStyle={{ borderRadius: Radius.sm }} />
          <TextInput label="Prénom" {...c('employe_prenom')} mode="outlined" style={styles.halfInput} outlineStyle={{ borderRadius: Radius.sm }} />
        </View>
        <TextInput label="Téléphone" {...c('employe_telephone')} mode="outlined" style={styles.fullInput} outlineStyle={{ borderRadius: Radius.sm }} keyboardType="phone-pad" />
        <TextInput label="Adresse" {...c('employe_adresse')} mode="outlined" style={styles.fullInput} outlineStyle={{ borderRadius: Radius.sm }} multiline />

        <Divider style={styles.formDivider} />
        <Text style={styles.formSectionTitle}>Employeur</Text>
        <TextInput label="Nom complet" {...c('employeur_nom_complet')} mode="outlined" style={styles.fullInput} outlineStyle={{ borderRadius: Radius.sm }} />
        <TextInput label="Type" {...c('employeur_type')} mode="outlined" style={styles.fullInput} outlineStyle={{ borderRadius: Radius.sm }} placeholder="particulier / entreprise / commerce" />
        <TextInput label="Téléphone" {...c('employeur_telephone')} mode="outlined" style={styles.fullInput} outlineStyle={{ borderRadius: Radius.sm }} keyboardType="phone-pad" />
        <TextInput label="Adresse" {...c('employeur_adresse')} mode="outlined" style={styles.fullInput} outlineStyle={{ borderRadius: Radius.sm }} multiline />

        <Divider style={styles.formDivider} />
        <Text style={styles.formSectionTitle}>Contrat</Text>
        <TextInput label="Poste" {...c('poste')} mode="outlined" style={styles.fullInput} outlineStyle={{ borderRadius: Radius.sm }} />
        <TextInput label="Type de contrat" {...c('type_contrat')} mode="outlined" style={styles.fullInput} outlineStyle={{ borderRadius: Radius.sm }} placeholder="Hébergé sur place / Non hébergé / Personnalisé" />
        <View style={styles.row3}>
          <TextInput label="Début" {...c('date_debut')} mode="outlined" style={styles.thirdInput} outlineStyle={{ borderRadius: Radius.sm }} placeholder="JJ/MM/AAAA" />
          <TextInput label="Fin" {...c('date_fin')} mode="outlined" style={styles.thirdInput} outlineStyle={{ borderRadius: Radius.sm }} placeholder="JJ/MM/AAAA" />
          <TextInput label="Durée" {...c('duree')} mode="outlined" style={styles.thirdInput} outlineStyle={{ borderRadius: Radius.sm }} />
        </View>
        <TextInput
          label="Salaire (FCFA)"
          {...c('salaire')}
          mode="outlined"
          style={styles.fullInput}
          outlineStyle={{ borderRadius: Radius.sm }}
          keyboardType="numeric"
        />
        <TextInput label="Notes" {...c('notes')} mode="outlined" style={styles.fullInput} outlineStyle={{ borderRadius: Radius.sm }} multiline numberOfLines={3} />
      </Card.Content>
    </Card>
  );
}

// ─── Styles ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  scrollContent: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  previewCard: { borderRadius: Radius.md, overflow: 'hidden', backgroundColor: Colors.surface, ...Shadows.card, marginBottom: Spacing.lg },
  preview: { width: '100%', height: 200, backgroundColor: '#000' },
  previewLabel: { textAlign: 'center', padding: Spacing.sm, fontSize: 12, color: Colors.textSecondary },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  sectionHint: { fontSize: 13, color: Colors.textSecondary, marginBottom: Spacing.lg },
  formCard: { borderRadius: Radius.md, backgroundColor: Colors.surface, ...Shadows.card, marginBottom: Spacing.lg },
  formSectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.primary, marginBottom: Spacing.md, marginTop: Spacing.sm },
  formDivider: { marginVertical: Spacing.md },
  row2: { flexDirection: 'row', gap: Spacing.sm },
  row3: { flexDirection: 'row', gap: Spacing.sm },
  halfInput: { flex: 1, marginBottom: Spacing.md, backgroundColor: Colors.surface },
  thirdInput: { flex: 1, marginBottom: Spacing.md, backgroundColor: Colors.surface },
  fullInput: { marginBottom: Spacing.md, backgroundColor: Colors.surface },
  createButton: { borderRadius: Radius.md, paddingVertical: 4, marginTop: Spacing.sm },
  successTitle: { fontSize: 20, fontWeight: '700', color: Colors.success, marginVertical: Spacing.md },
});
