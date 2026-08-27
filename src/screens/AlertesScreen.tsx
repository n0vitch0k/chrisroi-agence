import React, { useState, useCallback } from 'react';
import type { AlertesModalNavigationProp, GlobalNavigationProp } from '../types/navigation';

import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
} from 'react-native';
import { Card } from 'react-native-paper';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  getAllAlertes,
  marquerAlerteLue,
  marquerToutesAlertesLues,
} from '../database/service';
import { formatDate } from '../utils/constants';
import SafeButton from '../components/SafeButton';
import AppHeader from '../components/AppHeader';
import { Colors, Spacing, Radius, Shadows } from '../theme';

const getAlertIcon = (type: string) => {
  switch (type) {
    case 'fin_contrat': return 'calendar-clock';
    case 'commission': return 'cash';
    default: return 'bell';
  }
};

const getAlertColor = (type: string) => {
  switch (type) {
    case 'fin_contrat': return Colors.danger;
    case 'commission': return '#C2185B';
    default: return Colors.warning;
  }
};

export default function AlertesScreen() {
  const navigation = useNavigation<GlobalNavigationProp>();
  const [alertes, setAlertes] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadAlertes = async () => {
    try {
      const results = await getAllAlertes();
      setAlertes(results || []);
    } catch (error) { console.error('Error loading alertes:', error); } finally { setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { loadAlertes(); }, []));
  const onRefresh = () => { setRefreshing(true); loadAlertes(); };

  const handleMarquerLue = async (id: string) => {
    try { await marquerAlerteLue(id); loadAlertes(); } catch (error) { console.error('Error marking alert as read:', error); }
  };

  const handleMarquerToutesLues = async () => {
    try { await marquerToutesAlertesLues(); loadAlertes(); } catch (error) { console.error('Error marking all as read:', error); }
  };

  const handlePress = (alerte: any) => {
    if (!alerte.lu) handleMarquerLue(alerte.id);
    if (alerte.contrat_id) navigation.navigate('ContratDocumentModal', { id: alerte.contrat_id, origin: { label: 'Alertes' } });
    else if (alerte.employe_id) navigation.navigate('EmployesStack', { screen: 'EmployeDetail', params: { id: alerte.employe_id } });
    else if (alerte.employeur_id) navigation.navigate('EmployesStack', { screen: 'EmployeurForm', params: { id: alerte.employeur_id } });
  };

  const alertesNonLues = alertes.filter((a) => !a.lu);

  const renderItem = ({ item }: { item: any }) => {
    const color = getAlertColor(item.type);
    return (
      <SafeButton style={styles.cardButton} onPress={() => handlePress(item)}>
        <Card style={[card, !item.lu && styles.cardUnread]}>
          <Card.Content style={styles.cardPad}>
            <View style={styles.cardRow}>
              <View style={[styles.iconCircle, { backgroundColor: color + '18' }]}>
                <Icon name={getAlertIcon(item.type) as any} size={22} color={color} />
              </View>
              <View style={styles.textBlock}>
                <Text style={[styles.title, !item.lu && { fontWeight: '700' }]}>{item.titre}</Text>
                <Text style={styles.message}>{item.message}</Text>
                <Text style={styles.date}>{formatDate(item.date_alerte)}</Text>
              </View>
              {!item.lu && <View style={styles.dot} />}
            </View>
          </Card.Content>
        </Card>
      </SafeButton>
    );
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Alertes" showBack onBack={() => navigation.goBack()} />
      {alertesNonLues.length > 0 && (
        <View style={styles.header}>
          <Text style={styles.headerText}>{alertesNonLues.length} alerte(s) non lue(s)</Text>
          <SafeButton mode="text" onPress={handleMarquerToutesLues} style={{ alignSelf: 'flex-end' }}>
            Tout marquer
          </SafeButton>
        </View>
      )}

      <FlatList
        data={alertes} renderItem={renderItem} keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="bell-off-outline" size={64} color={Colors.iconLight} />
            <Text style={styles.emptyTitle}>Aucune alerte</Text>
          </View>
        }
      />
    </View>
  );
}

const card = { marginBottom: Spacing.sm, borderRadius: Radius.md, backgroundColor: Colors.surface, ...Shadows.soft };

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  list: { padding: Spacing.lg },
  card: card,
  cardButton: { padding: 0, borderRadius: Radius.md, minHeight: 0 },
  cardUnread: { borderLeftWidth: 3, borderLeftColor: Colors.warning },
  cardPad: { paddingVertical: 4 },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start' },
  iconCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  textBlock: { flex: 1 },
  title: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  message: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  date: { fontSize: 11, color: Colors.textTertiary, marginTop: Spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary, marginLeft: Spacing.sm, marginTop: 6 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: Colors.textSecondary, marginTop: Spacing.lg },
});
