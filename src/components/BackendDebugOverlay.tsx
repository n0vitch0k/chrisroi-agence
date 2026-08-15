import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
} from 'react-native';
import {
  BackendLog,
  subscribeToLogs,
  clearBackendLogs,
  getBackendLogs,
} from '../utils/backendLogger';

const LEVEL_COLORS: Record<string, string> = {
  info: '#3498db',
  success: '#2ecc71',
  warn: '#f39c12',
  error: '#e74c3c',
};

const LEVEL_ICONS: Record<string, string> = {
  info: 'i',
  success: '✓',
  warn: '!',
  error: '✕',
};

export default function BackendDebugOverlay() {
  const [expanded, setExpanded] = useState(false);
  const [logs, setLogs] = useState<BackendLog[]>([]);
  const [badgeColor, setBadgeColor] = useState('#888');
  const scrollRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Charger les logs existants
    setLogs(getBackendLogs());

    // S'abonner aux nouveaux logs
    const unsub = subscribeToLogs((newLogs) => {
      setLogs(newLogs);
      // Défiler automatiquement vers le bas
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    });

    return unsub;
  }, []);

  // Couleur du badge = dernière erreur ou dernier succès
  useEffect(() => {
    if (logs.length === 0) return;
    const last = logs[logs.length - 1];
    setBadgeColor(LEVEL_COLORS[last.level] || '#888');
  }, [logs]);

  // Animation apparition
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {!expanded ? (
        // ── Badge réduit ───────────────────────────
        <TouchableOpacity
          style={[styles.badge, { backgroundColor: badgeColor }]}
          onPress={() => setExpanded(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.badgeText}>{logs.length}</Text>
        </TouchableOpacity>
      ) : (
        // ── Panneau déplié ──────────────────────────
        <View style={styles.panel}>
          {/* Header */}
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>🔍 Debug Backend</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity onPress={() => clearBackendLogs()} style={styles.headerBtn}>
                <Text style={styles.headerBtnText}>Effacer</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setExpanded(false)} style={styles.headerBtn}>
                <Text style={styles.headerBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Liste des logs */}
          <ScrollView
            ref={scrollRef}
            style={styles.logList}
            contentContainerStyle={styles.logContent}
          >
            {logs.length === 0 && (
              <Text style={styles.emptyText}>Aucun log pour l'instant...</Text>
            )}
            {logs.map((log) => (
              <View key={log.id} style={styles.logEntry}>
                <Text style={[styles.logIcon, { color: LEVEL_COLORS[log.level] }]}>
                  {LEVEL_ICONS[log.level]}
                </Text>
                <Text style={styles.logTime}>{log.timestamp}</Text>
                <Text style={styles.logStep}>{log.step}</Text>
                <Text style={styles.logDetail}>{log.detail}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'web' ? 60 : 80,
    right: 12,
    zIndex: 9999,
    elevation: 10,
  },
  // ── Badge réduit ──────────────────────────────
  badge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  badgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  // ── Panneau déplié ────────────────────────────
  panel: {
    width: 300,
    maxHeight: 350,
    backgroundColor: 'rgba(20, 20, 30, 0.95)',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  panelTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  headerBtnText: {
    color: '#88aaff',
    fontSize: 11,
  },
  // ── Logs ──────────────────────────────────────
  logList: {
    flex: 1,
  },
  logContent: {
    padding: 8,
  },
  emptyText: {
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
    fontSize: 12,
  },
  logEntry: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  logIcon: {
    width: 16,
    fontSize: 11,
    fontWeight: 'bold',
    marginRight: 4,
    marginTop: 1,
  },
  logTime: {
    color: '#666',
    fontSize: 9,
    marginRight: 6,
    marginTop: 2,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  logStep: {
    color: '#aac',
    fontSize: 11,
    fontWeight: '600',
    marginRight: 4,
    flexShrink: 0,
  },
  logDetail: {
    color: '#ccc',
    fontSize: 10,
    flex: 1,
  },
});
