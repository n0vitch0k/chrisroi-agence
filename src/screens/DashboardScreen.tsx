import React, { useCallback, useEffect, useState } from 'react';
import type { GlobalNavigationProp } from '../types/navigation';

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getAllEmployes,
  getAllEmployeurs,
  getAllContrats,
} from '../database/service';
import { Colors, Shadows } from '../theme';

// ─── Thème unique (Warm Earth V5) ─────────────────────────────────
const M = { ...Colors, shadow: Shadows.card.shadowColor } as const;

// ─── Types ──────────────────────────────────────────────────────
interface DashboardScreenProps {
  user: { id: string; nom: string; prenom: string; email: string; role: string };
}

// ─── Composant : QuickAction (maquette V1) ──────────────────────
const QuickAction = ({
  icon,
  iconBg,
  iconColor,
  title,
  sub,
  badgeText,
  badgeBg,
  badgeColor,
  onPress,
}: {
  icon: string;
  iconBg: string;
  iconColor: string;
  title: string;
  sub: string;
  badgeText?: string;
  badgeBg?: string;
  badgeColor?: string;
  onPress: () => void;
}) => (
  <TouchableOpacity style={styles.quickAction} onPress={onPress} activeOpacity={0.7}>
    <View style={[styles.quickIcon, { backgroundColor: iconBg }]}>
      <Text style={[styles.quickIconText, { color: iconColor }]}>{icon}</Text>
    </View>
    <Text style={styles.quickTitle}>{title}</Text>
    <Text style={styles.quickSub}>{sub}</Text>
    {badgeText && badgeBg && badgeColor && (
      <View style={[styles.quickBadge, { backgroundColor: badgeBg }]}>
        <Text style={[styles.quickBadgeText, { color: badgeColor }]}>{badgeText}</Text>
      </View>
    )}
  </TouchableOpacity>
);

// ─── Composant : DossierRow ─────────────────────────────────────
const DossierRow = ({
  icon,
  iconBg,
  iconColor,
  label,
  count,
  onPress,
}: {
  icon: string;
  iconBg: string;
  iconColor: string;
  label: string;
  count: string;
  onPress: () => void;
}) => (
  <TouchableOpacity style={styles.dossierRow} onPress={onPress} activeOpacity={0.7}>
    <View style={[styles.dossierRowIcon, { backgroundColor: iconBg }]}>
      <Icon name={icon as any} size={18} color={iconColor} />
    </View>
    <View style={styles.dossierRowInfo}>
      <Text style={styles.dossierRowLabel}>{label}</Text>
      <Text style={styles.dossierRowCount}>{count}</Text>
    </View>
    <Icon name="chevron-right" size={18} color={M.textDim} />
  </TouchableOpacity>
);

// ─── Screen ─────────────────────────────────────────────────────
export default function DashboardScreen({ user }: DashboardScreenProps) {
  const navigation = useNavigation<GlobalNavigationProp>();
  const insets = useSafeAreaInsets();
  const tabNavigation = navigation.getParent();
  const rootNavigation = tabNavigation?.getParent();
  const navigateTab = (screen: string, params?: any) => tabNavigation?.navigate(screen as any, params as any);
  const navigateRoot = (screen: string, params?: any) => rootNavigation?.navigate(screen as any, params as any);
  
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [registreCounts, setRegistreCounts] = useState({ fiches: 0, contrats: 0, employeurs: 0 });

  const loadData = useCallback(async () => {
    try {
      const [employesData, employeursData, contratsData] = await Promise.all([
        getAllEmployes(),
        getAllEmployeurs(),
        getAllContrats(),
      ]);
      setRegistreCounts({
        fiches: (employesData || []).length,
        contrats: (contratsData || []).length,
        employeurs: (employeursData || []).length,
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(() => { setRefreshing(true); loadData(); }, [loadData]);

  const totalRegistre = registreCounts.fiches + registreCounts.contrats + registreCounts.employeurs;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={M.primary} />}
    >
      {/* ── Header gradient orange (maquette V1) ── */}
      <View style={[styles.header, { paddingTop: insets.top + 50 }]}>
        {/* Cercles décoratifs */}
        <View style={styles.headerCircleTop} />
        <View style={styles.headerCircleBottom} />

        <View style={styles.headerTop}>
          <View style={styles.brand}>
            <View style={styles.brandLogo}>
              <Text style={styles.brandText}>CR</Text>
            </View>
            <Text style={styles.brandName}>ChrisRoi Agence</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigateRoot('AlertesModal')} activeOpacity={0.7}>
              <Icon name="bell-outline" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigateRoot('JournalModal')} activeOpacity={0.7}>
              <Icon name="text-box-outline" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigateRoot('SettingsModal')} activeOpacity={0.7}>
              <Icon name="cog-outline" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.greeting}>Bonjour,</Text>
        <Text style={styles.userName}>{user.prenom} {user.nom}</Text>
      </View>

      <View style={styles.content}>

        {/* ── Quick Actions (grille 2x2, maquette V1) ── */}
        <Text style={styles.sectionTitle}>Actions rapides</Text>
        <View style={styles.quickGrid}>
          <QuickAction
            icon="👤"
            iconBg="#fdebd8"
            iconColor="#c45a2a"
            title="Inscrire"
            sub="Nouvelle fiche"
            badgeText={registreCounts.fiches > 0 ? `${registreCounts.fiches} fiches` : undefined}
            badgeBg="#fdebd8"
            badgeColor="#c45a2a"
            onPress={() => navigateRoot('FicheInscriptionModal')}
          />
          <QuickAction
            icon="📄"
            iconBg="#e8f0dc"
            iconColor="#5a7c3a"
            title="Contrat"
            sub="Placement"
            badgeText={registreCounts.contrats > 0 ? `${registreCounts.contrats} actifs` : undefined}
            badgeBg="#e8f0dc"
            badgeColor="#5a7c3a"
            onPress={() => navigateTab('EmployesStack', { screen: 'ContratDocument' })}
          />
          <QuickAction
            icon="📸"
            iconBg="#faf3d1"
            iconColor="#b8860b"
            title="Scanner"
            sub="OCR / Photo"
            onPress={() => navigateRoot('Scan')}
          />
          <QuickAction
            icon="🏢"
            iconBg="#d8ecec"
            iconColor="#2a7a7a"
            title="Employeur"
            sub="Entreprise"
            badgeText={registreCounts.employeurs > 0 ? `${registreCounts.employeurs} inscrits` : undefined}
            badgeBg="#d8ecec"
            badgeColor="#2a7a7a"
            onPress={() => navigateTab('EmployesStack', { screen: 'EmployeurForm' })}
          />
        </View>

        {/* ── Dossiers (carte unifiée, maquette V1) ── */}
        <Text style={styles.sectionTitle}>Dossiers</Text>
        <TouchableOpacity
          style={styles.dossierCard}
          onPress={() => navigateTab('EmployesStack', { screen: 'EmployesList' })}
          activeOpacity={0.7}
        >
          <View style={styles.dossierIcon}>
            <Text style={styles.dossierIconText}>📁</Text>
          </View>
          <View style={styles.dossierText}>
            <Text style={styles.dossierName}>Tous les dossiers</Text>
            <Text style={styles.dossierSub}>{totalRegistre} dossier{totalRegistre !== 1 ? 's' : ''} actif{totalRegistre !== 1 ? 's' : ''}</Text>
          </View>
          <Icon name="chevron-right" size={20} color={M.textDim} />
        </TouchableOpacity>

        {totalRegistre === 0 && !loading && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📁</Text>
            <Text style={styles.emptyTitle}>Aucun dossier</Text>
            <Text style={styles.emptyText}>Ajoutez des candidats, contrats ou employeurs pour commencer.</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fdf8f3' },

  // ── Header gradient orange (V1) ──
  header: {
    backgroundColor: '#c45a2a',
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    position: 'relative',
    overflow: 'hidden',
  },
  headerCircleTop: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  headerCircleBottom: {
    position: 'absolute',
    bottom: 20,
    left: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    position: 'relative',
    zIndex: 1,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  brandLogo: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  brandName: { fontSize: 19, fontWeight: '700', color: '#fff' },
  headerActions: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  greeting: { fontSize: 14, color: 'rgba(255,255,255,0.75)', fontStyle: 'italic' },
  userName: { fontSize: 24, fontWeight: '700', color: '#fff', marginTop: 2, letterSpacing: -0.3 },

  // ── Contenu ──
  content: { padding: 20, paddingBottom: 40 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8a7d72',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 12,
    marginLeft: 4,
  },

  // ── Quick Actions (grille 2x2, V1) ──
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickAction: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#eedec9',
    shadowColor: 'rgba(61,53,48,0.04)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  quickIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  quickIconText: { fontSize: 22 },
  quickTitle: { fontSize: 14, fontWeight: '700', color: '#3d3530' },
  quickSub: { fontSize: 11, color: '#b8a99e', marginTop: 2 },
  quickBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 8,
  },
  quickBadgeText: { fontSize: 10, fontWeight: '600' },

  // ── Dossier Card (V1) ──
  dossierCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#eedec9',
    shadowColor: 'rgba(61,53,48,0.04)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    paddingHorizontal: 18,
    paddingVertical: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  dossierIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#e8f0dc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dossierIconText: { fontSize: 22 },
  dossierText: { flex: 1 },
  dossierName: { fontSize: 17, fontWeight: '800', color: '#3d3530' },
  dossierSub: { fontSize: 12, color: '#5a7c3a', fontWeight: '600' },
  dossierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  dossierRowIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  dossierRowInfo: { flex: 1 },
  dossierRowLabel: { fontSize: 15, fontWeight: '600', color: '#3d3530' },
  dossierRowCount: { fontSize: 12, color: '#b8a99e' },
  dossierDivider: { height: 1, backgroundColor: '#f5ebe0', marginHorizontal: 18 },

  // ── Empty state ──
  emptyState: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 20 },
  emptyIcon: { fontSize: 56, marginBottom: 16, opacity: 0.3 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#8a7d72', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#b8a99e', textAlign: 'center', lineHeight: 20 },
});
