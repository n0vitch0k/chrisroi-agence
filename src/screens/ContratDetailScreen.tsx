import React, { useState, useCallback, useEffect } from 'react';
import type { ContratDetailNavigationProp } from '../types/navigation';

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Linking,
} from 'react-native';
import { Chip } from 'react-native-paper';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import AppHeader from '../components/AppHeader';
import { getContratById, terminerContrat, marquerCommissionPayee, getEntityHistory } from '../database/service';
import { formatDate, formatDateOr, formatMoney, getStatutColor, getStatutLabel, daysRemaining, getTypeContratLabel } from '../utils/constants';
import { nativePrintAsync } from '../utils/nativePrint';
import { buildContratHtml } from '../utils/contratPrint';
import { Colors, Spacing, Radius, Shadows } from '../theme';
import SafeButton from '../components/SafeButton';

const printAsync = nativePrintAsync;

export default function ContratDetailScreen() {
  const navigation = useNavigation<ContratDetailNavigationProp>();
  const route = useRoute<any>();
  const contratId = route.params?.id;
  const [contrat, setContrat] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);

  const loadContrat = async () => {
    try {
      const data = await getContratById(contratId);
      setContrat(data);
      if (data?.numero_dossier) {
        navigation.setOptions({ title: `Contrat #${data.numero_dossier}` });
      }
      const hist = await getEntityHistory('contrat', contratId);
      setHistory(hist || []);
    } catch (error) { console.error('Error loading contrat:', error); }
  };

  useFocusEffect(useCallback(() => { loadContrat(); }, [contratId]));

  const headerTitle = contrat?.numero_dossier ? `Contrat #${contrat.numero_dossier}` : 'Détail contrat';

  const handleTerminer = () => {
    Alert.alert('Terminer le contrat', 'Êtes-vous sûr de vouloir terminer ce contrat ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Terminer', onPress: async () => {
        try { await terminerContrat(contratId); loadContrat(); }
        catch (error) { Alert.alert('Erreur', 'Une erreur est survenue'); }
      }},
    ]);
  };

  const handlePrint = async () => {
    if (!contrat) return;
    const html = buildContratHtml({ contrat });
    try { await printAsync({ html }); } catch (error) { Alert.alert('Erreur', "Impossible d'imprimer le contrat"); }
  };

  const handleMarquerCommissionPayee = async () => {
    try {
      await marquerCommissionPayee(contratId);
      Alert.alert('Succès', 'Commission marquée comme payée');
      loadContrat();
    } catch (error) {
      Alert.alert('Erreur', 'Une erreur est survenue');
    }
  };

  useEffect(() => { loadContrat(); }, [contratId]);

  if (!contrat) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={{ color: Colors.textSecondary }}>Chargement...</Text>
      </View>
    );
  }

  const remaining = daysRemaining(contrat.date_fin);
  const statusColor = getStatutColor(contrat.statut);
  const commissionPayee = contrat.commission_payee;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <AppHeader title={headerTitle} showBack onBack={() => navigation.goBack()} />
      {/* ── Contenu ─────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerActions}>
            <SafeButton style={styles.headerActionButton} onPress={handlePrint}>
              <Icon name="printer-outline" size={20} color={Colors.textOnPrimary} />
            </SafeButton>
            <SafeButton style={styles.headerActionButton} onPress={() => Alert.alert('Options', 'Actions du contrat')}>
              <Icon name="dots-vertical" size={20} color={Colors.textOnPrimary} />
            </SafeButton>
          </View>
        </View>
        <Text style={styles.numero}>{contrat.numero_dossier}</Text>
        <Text style={styles.poste}>{contrat.poste}</Text>
        <View style={styles.statusRow}>
          <Chip mode="outlined" textStyle={{ color: statusColor, fontWeight: '600', fontSize: 12 }}
            style={[styles.statusChip, { borderColor: statusColor }]}>
            {getStatutLabel(contrat.statut)}
          </Chip>
          {remaining !== null && contrat.statut === 'en_cours' && (
            <View style={[styles.remainBadge, remaining <= 7 && styles.remainBadgeUrgent]}>
              <Text style={styles.remainText}>{remaining <= 7 ? '⚠️ Fin dans ' : ''}{remaining}j</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>💰 Situation financière</Text>
          </View>
          <View style={styles.moneyCard}>
            <Text style={styles.moneyLabel}>Commission à percevoir</Text>
            <Text style={styles.moneyValue}>{formatMoney(contrat.commission_agence)}</Text>
            <Text style={styles.moneySub}>1/3 du salaire · {commissionPayee ? 'Payée' : 'Non payée'}</Text>
          </View>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Salaire</Text>
              <Text style={styles.infoValue}>{formatMoney(contrat.salaire)}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Frais dossier</Text>
              <Text style={styles.infoValue}>{formatMoney(contrat.frais_dossier)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>👥 Parties</Text>
            <SafeButton style={styles.sectionLinkButton} onPress={() => navigation.navigate('EmployesStack', { screen: 'EmployeDetail', params: { id: contrat.employe_id } })}>
              <Text style={styles.sectionLink}>Voir profils</Text>
            </SafeButton>
          </View>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Employé</Text>
              <Text style={styles.infoValue}>{contrat.employe_nom} {contrat.employe_prenom}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Employeur</Text>
              <Text style={styles.infoValue}>{contrat.nom_complet}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Poste</Text>
              <Text style={styles.infoValue}>{contrat.poste}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Type</Text>
              <Text style={styles.infoValue}>{getTypeContratLabel(contrat.type_contrat)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📅 Dates clés</Text>
          </View>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Début</Text>
              <Text style={styles.infoValue}>{formatDate(contrat.date_debut)}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Fin</Text>
              <Text style={styles.infoValue}>{formatDateOr(contrat.date_fin, 'Non définie')}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📜 Historique</Text>
          </View>
          <View style={styles.timeline}>
            <View style={styles.timelineItem}>
              <View style={styles.timelineDot} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineDate}>Création</Text>
                <Text style={styles.timelineTitle}>Contrat créé</Text>
                <Text style={styles.timelineDesc}>{contrat.employe_nom} affecté à {contrat.nom_complet}</Text>
              </View>
            </View>
            <View style={styles.timelineItem}>
              <View style={styles.timelineDot} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineDate}>Commission</Text>
                <Text style={styles.timelineTitle}>Alerte commission créée</Text>
                <Text style={styles.timelineDesc}>{formatMoney(contrat.commission_agence)} à percevoir</Text>
              </View>
            </View>
            {remaining !== null && remaining <= 7 && (
              <View style={styles.timelineItem}>
                <View style={styles.timelineDot} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineDate}>Fin proche</Text>
                  <Text style={styles.timelineTitle}>Fin de contrat imminente</Text>
                  <Text style={styles.timelineDesc}>Proposer une prolongation</Text>
                </View>
              </View>
            )}
            {history.map((h: any) => (
              <View key={h.id} style={styles.timelineItem}>
                <View style={styles.timelineDot} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineTitle}>{h.description}</Text>
                  <Text style={styles.timelineDesc}>Par {h.user_display}</Text>
                  <Text style={styles.timelineDate}>{h.created}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>⚡ Actions</Text>
          </View>
          <View style={styles.actionGrid}>
            <SafeButton style={styles.actionButton} onPress={() => {
              const phone = contrat.employe_telephone || contrat.employeur_telephone;
              if (!phone) { Alert.alert('Appel', `Aucun numéro pour ${contrat.employe_nom}`); return; }
              Linking.openURL(`tel:${phone.replace(/[^+\d]/g, '')}`).catch(() => Alert.alert('Appel', `Impossible d'appeler ${phone}`));
            }}>
              <Icon name="phone" size={22} color={Colors.textOnPrimary} />
              <Text style={styles.actionLabel}>Appeler</Text>
            </SafeButton>
            <SafeButton style={StyleSheet.flatten([styles.actionButton, styles.actionButtonSuccess])} onPress={handleMarquerCommissionPayee} disabled={commissionPayee}>
              <Icon name="check-circle" size={22} color={Colors.textOnPrimary} />
              <Text style={styles.actionLabel}>Commission payée</Text>
            </SafeButton>
            <SafeButton style={StyleSheet.flatten([styles.actionButton, styles.actionButtonWarning])} onPress={() => navigation.navigate('ContratDocument', { id: contratId })}>
              <Icon name="refresh" size={22} color={Colors.textOnPrimary} />
              <Text style={styles.actionLabel}>Prolonger</Text>
            </SafeButton>
            <SafeButton style={StyleSheet.flatten([styles.actionButton, styles.actionButtonDanger])} onPress={handleTerminer}>
              <Icon name="stop-circle" size={22} color={Colors.textOnPrimary} />
              <Text style={styles.actionLabel}>Terminer</Text>
            </SafeButton>
          </View>
        </View>

        {contrat.notes && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>📝 Notes</Text>
            </View>
            <Text style={styles.notes}>{contrat.notes}</Text>
          </View>
        )}
      </View>

      <View style={styles.bottomActions}>
        <SafeButton style={styles.bottomBtnSecondary} onPress={() => navigation.navigate('ContratDocument', { id: contratId })}>
          <Text style={styles.bottomBtnText}>Modifier</Text>
        </SafeButton>
        <SafeButton style={styles.bottomBtnPrimary} onPress={handlePrint}>
          <Text style={[styles.bottomBtnText, styles.bottomBtnTextPrimary]}>Imprimer contrat</Text>
        </SafeButton>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingBottom: 100 },
  header: {
    backgroundColor: Colors.primary,
    paddingTop: Spacing.xl + 10,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    borderBottomLeftRadius: Radius.xl,
    borderBottomRightRadius: Radius.xl,
    ...Shadows.soft,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  headerActionButton: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  numero: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: Spacing.xs,
    fontWeight: '600',
  },
  poste: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textOnPrimary,
    marginBottom: Spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  statusChip: {
    height: 28,
    borderRadius: 14,
  },
  remainBadge: {
    backgroundColor: Colors.warning,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
  },
  remainBadgeUrgent: {
    backgroundColor: Colors.danger,
  },
  remainText: {
    color: Colors.textOnPrimary,
    fontWeight: '700',
    fontSize: 12,
  },
  content: {
    padding: Spacing.lg,
  },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.soft,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  sectionLink: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
  },
  sectionLinkButton: {
    padding: 0,
  },
  moneyCard: {
    backgroundColor: Colors.success,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  moneyLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: Spacing.xs,
  },
  moneyValue: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textOnPrimary,
  },
  moneySub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginTop: Spacing.xs,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  infoItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  infoLabel: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontWeight: '600',
    textTransform: 'uppercase' as const,
    marginBottom: Spacing.xs,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  timeline: {
    paddingLeft: Spacing.md,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingBottom: Spacing.lg,
    marginBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    position: 'relative',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
    marginTop: 4,
    marginLeft: 2,
  },
  timelineContent: {
    flex: 1,
  },
  timelineDate: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  timelineDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  actionButton: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  actionButtonSuccess: {
    backgroundColor: Colors.success,
  },
  actionButtonWarning: {
    backgroundColor: Colors.warning,
  },
  actionButtonDanger: {
    backgroundColor: Colors.danger,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },
  notes: {
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  bottomBtnSecondary: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  bottomBtnPrimary: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  bottomBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  bottomBtnTextPrimary: {
    color: Colors.textOnPrimary,
  },
});
