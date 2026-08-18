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
  getCommissionsAPercevoir,
  getAllEmployes,
  getAllEmployeurs,
  getAllContrats,
  getContratsFinProche,
  createFinContratAlertes,
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

// ─── Composant : UrgentCard (maquette V1) ───────────────────────
const UrgentCard = ({
  title,
  badgeText,
  badgeBg,
  badgeColor,
  meta,
  stat1Label,
  stat1Value,
  stat2Label,
  stat2Value,
  stat2ValueColor,
  actionLabel,
  actionBg,
  actionOnPress,
}: {
  title: string;
  badgeText: string;
  badgeBg: string;
  badgeColor: string;
  meta: string;
  stat1Label: string;
  stat1Value: string | number;
  stat2Label?: string;
  stat2Value?: string | number;
  stat2ValueColor?: string;
  actionLabel: string;
  actionBg: string;
  actionOnPress: () => void;
}) => (
  <View style={styles.urgentCard}>
    <View style={styles.urgentHead}>
      <Text style={styles.urgentTitle}>{title}</Text>
      <View style={[styles.urgentBadge, { backgroundColor: badgeBg }]}>
        <Text style={[styles.urgentBadgeText, { color: badgeColor }]}>{badgeText}</Text>
      </View>
    </View>
    <Text style={styles.urgentMeta}>{meta}</Text>
    <View style={styles.urgentStats}>
      <View style={styles.urgentStat}>
        <Text style={styles.urgentStatLabel}>{stat1Label}</Text>
        <Text style={styles.urgentStatValue}>{stat1Value}</Text>
      </View>
      {stat2Label && stat2Value !== undefined && (
        <View style={styles.urgentStat}>
          <Text style={styles.urgentStatLabel}>{stat2Label}</Text>
          <Text style={[styles.urgentStatValue, stat2ValueColor ? { color: stat2ValueColor } : undefined]}>{stat2Value}</Text>
        </View>
      )}
    </View>
    <TouchableOpacity style={[styles.urgentBtn, { backgroundColor: actionBg }]} onPress={actionOnPress} activeOpacity={0.7}>
      <Text style={styles.urgentBtnText}>{actionLabel}</Text>
    </TouchableOpacity>
  </View>
);

// ─── Screen ─────────────────────────────────────────────────────
export default function DashboardScreen({ user }: DashboardScreenProps) {
  const navigation = useNavigation<GlobalNavigationProp>();
  const insets = useSafeAreaInsets();
  const tabNavigation = navigation.getParent();
  const rootNavigation = tabNavigation?.getParent();
  const navigateTab = (screen: string, params?: any) => tabNavigation?.navigate(screen as any, params as any);
  const navigateRoot = (screen: string, params?: any) => rootNavigation?.navigate(screen as any, params as any);
  
  const [commissions, setCommissions] = useState<any[]>([]);
  const [contratsFinProche, setContratsFinProche] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [registreCounts, setRegistreCounts] = useState({ fiches: 0, contrats: 0, employeurs: 0 });

  const loadData = useCallback(async () => {
    try {
      const [commissionsData, employesData, employeursData, contratsData, finProcheData] = await Promise.all([
        getCommissionsAPercevoir(),
        getAllEmployes(),
        getAllEmployeurs(),
        getAllContrats(),
        getContratsFinProche(),
      ]);
      setCommissions(commissionsData || []);
      setContratsFinProche(finProcheData || []);
      setRegistreCounts({
        fiches: (employesData || []).length,
        contrats: (contratsData || []).length,
        employeurs: (employeursData || []).length,
      });
      createFinContratAlertes().catch(console.error);
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
  const totalCommissionEnAttente = commissions.reduce((s, c) => s + (c.commission_agence || 0), 0);
  const totalCommissionPerue = commissions.reduce((s, c) => s + (c.commission_payee ? c.commission_agence : 0), 0);

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
              {commissions.length > 0 && <View style={styles.badgeDot} />}
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
            onPress={() => navigateTab('ContratsStack', { screen: 'ContratForm' })}
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
            onPress={() => navigateTab('EmployeursStack', { screen: 'EmployeurForm' })}
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

        {/* ── Urgences (maquette V1) ── */}
        <Text style={styles.sectionTitle}>Urgences du jour</Text>

        {contratsFinProche.length > 0 ? (
          contratsFinProche.slice(0, 1).map((c: any) => {
            const jours = Math.ceil((new Date(c.date_fin).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            return (
              <UrgentCard
                key={c.id}
                title={`⏰ ${c.expand?.employe_id?.prenom || ''} ${c.expand?.employe_id?.nom || ''} · Fin dans ${jours}j`}
                badgeText="URGENT"
                badgeBg="#fdeaea"
                badgeColor="#b85454"
                meta={`${c.expand?.employeur_id?.nom_complet || 'Employeur'} · ${(c.salaire || 0).toLocaleString()} FCFA`}
                stat1Label="Commission"
                stat1Value={`${(c.commission_agence || 0).toLocaleString()} F`}
                stat2Label="Type"
                stat2Value={c.type_contrat === 'heberge' ? 'Hébergé' : c.type_contrat === 'non_heberge' ? 'Non hébergé' : 'Personnalisé'}
                actionLabel="📋 Proposer prolongation"
                actionBg="#b85454"
                actionOnPress={() => navigateTab('ContratsStack', { screen: 'ContratDetail', params: { id: c.id } })}
              />
            );
          })
        ) : (
          <UrgentCard
            title="Aucune urgence contrat"
            badgeText="OK"
            badgeBg="#e8f0dc"
            badgeColor="#5a7c3a"
            meta="Tous les contrats sont à bonne échéance"
            stat1Label="Contrats surveillés"
            stat1Value={registreCounts.contrats}
            actionLabel="Voir contrats"
            actionBg="#5a7c3a"
            actionOnPress={() => navigateTab('ContratsStack', { screen: 'ContratsList' })}
          />
        )}

        {commissions.length > 0 && (
          <UrgentCard
            title={`💰 ${commissions[0].expand?.employe_id?.prenom || ''} ${commissions[0].expand?.employe_id?.nom || ''} · Commission à percevoir`}
            badgeText="À FAIRE"
            badgeBg="#faf3d1"
            badgeColor="#b8860b"
            meta={`${(commissions[0].commission_agence || 0).toLocaleString()} FCFA · ${commissions[0].expand?.employeur_id?.nom_complet || 'Employeur'}`}
            stat1Label="Contrat"
            stat1Value={commissions[0].id?.slice(-8) || '—'}
            stat2Label="Échéance"
            stat2Value="Demain"
            stat2ValueColor="#b8860b"
            actionLabel="✓ Marquer perçu"
            actionBg="#5a7c3a"
            actionOnPress={() => navigateTab('SuiviStack', { screen: 'SuiviMain' })}
          />
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
  badgeDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#b85454',
    borderWidth: 2,
    borderColor: '#c45a2a',
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

  // ── Urgent Card (V1) ──
  urgentCard: {
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
    marginTop: 10,
  },
  urgentHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  urgentTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3d3530',
    flex: 1,
    marginRight: 8,
  },
  urgentBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  urgentBadgeText: { fontSize: 10, fontWeight: '700' },
  urgentMeta: { fontSize: 13, color: '#8a7d72', marginBottom: 14 },
  urgentStats: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  urgentStat: { flex: 1 },
  urgentStatLabel: { fontSize: 10, color: '#b8a99e', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  urgentStatValue: { fontSize: 15, fontWeight: '800', color: '#3d3530', marginTop: 2 },
  urgentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 12,
    borderRadius: 12,
  },
  urgentBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  // ── Empty state ──
  emptyState: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 20 },
  emptyIcon: { fontSize: 56, marginBottom: 16, opacity: 0.3 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#8a7d72', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#b8a99e', textAlign: 'center', lineHeight: 20 },
});
