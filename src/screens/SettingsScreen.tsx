import React, { useState } from 'react';
import type { SettingsModalNavProps } from '../types/navigation';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ViewStyle,
  TextStyle,
  TextInput,
  Modal,
  TouchableOpacity,
} from 'react-native';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { getAllUsers, createUser, getGeminiApiKey, saveGeminiApiKey } from '../database/service';
import { Colors, Spacing, Radius, Typography, Shadows } from '../theme';
import AppHeader from '../components/AppHeader';
import SafeButton from '../components/SafeButton';
import { getPocketBaseUrl, setPocketBaseUrl, resetPocketBase } from '../database/pocketbase';

const M = Colors;

interface SettingsScreenProps {
  user: {
    id: string;
    nom: string;
    prenom: string;
    email: string;
    role: string;
  };
  onLogout: () => void;
}

// ─── Composants internes ───────────────────────────────────
const Section = ({ title, children }: { title?: string; children: React.ReactNode }) => (
  <View style={styles.section}>
    {title && <Text style={styles.sectionTitle}>{title}</Text>}
    <View style={styles.sectionCard}>
      {children}
    </View>
  </View>
);

const MenuItem = ({ icon, title, subtitle, onPress }: { icon: string; title: string; subtitle: string; onPress?: () => void }) => (
  <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
    <View style={styles.menuIconWrap}>
      <Icon name={icon as any} size={22} color={M.icon} />
    </View>
    <View style={styles.menuTextBlock}>
      <Text style={styles.menuTitle}>{title}</Text>
      <Text style={styles.menuSubtitle}>{subtitle}</Text>
    </View>
    <Icon name="chevron-right" size={22} color={M.iconLight} />
  </TouchableOpacity>
);

export default function SettingsScreen({ user, onLogout }: SettingsScreenProps) {
  const navigation = useNavigation();
  const [users, setUsers] = useState<any[]>([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [serverUrl, setServerUrl] = useState(getPocketBaseUrl());
  const [showServerUrl, setShowServerUrl] = useState(false);
  const [editServerUrl, setEditServerUrl] = useState(serverUrl || 'http://192.168.1.5:8090');
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [geminiKey, setGeminiKey] = useState('');
  const [geminiKeyVisible, setGeminiKeyVisible] = useState(false);
  const [addingUser, setAddingUser] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [newUser, setNewUser] = useState({
    nom: '', prenom: '', email: '', mot_de_passe: '', role: 'agent',
  });

  const loadUsers = async () => {
    try { setUsers((await getAllUsers()) || []); } catch (error) { console.error('Error loading users:', error); }
  };

  React.useEffect(() => { loadUsers(); loadGeminiKey(); }, []);

  const loadGeminiKey = async () => {
    try {
      const key = await getGeminiApiKey();
      if (key) setGeminiKey(key);
    } catch (e) { /* ignoré */ }
  };

  const handleSaveGeminiKey = async () => {
    setSavingKey(true);
    try {
      await saveGeminiApiKey(geminiKey);
      setShowGeminiKey(false);
      Alert.alert('Succès', 'Clé API Gemini enregistrée.');
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de sauvegarder la clé.');
    } finally {
      setSavingKey(false);
    }
  };

  const handleTestConnection = async (url: string) => {
    setTestingConnection(true);
    setConnectionStatus('idle');
    try {
      const cleanUrl = url.replace(/\/+$/, '');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const resp = await fetch(`${cleanUrl}/api/health`, { signal: controller.signal });
      clearTimeout(timeout);
      setConnectionStatus(resp.ok ? 'ok' : 'error');
    } catch {
      setConnectionStatus('error');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveServerUrl = async () => {
    const cleanUrl = editServerUrl.trim().replace(/\/+$/, '');
    if (!cleanUrl) {
      Alert.alert('Erreur', 'Veuillez saisir une URL valide.');
      return;
    }
    await handleTestConnection(cleanUrl);
    await setPocketBaseUrl(cleanUrl);
    resetPocketBase();
    setServerUrl(cleanUrl);
    setShowServerUrl(false);
    Alert.alert(
      'Serveur enregistré',
      `URL définie sur ${cleanUrl}.\nRedémarrez l'application pour appliquer le changement.`,
    );
  };

  const handleAddUser = async () => {
    if (!newUser.nom || !newUser.prenom || !newUser.email || !newUser.mot_de_passe) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }
    setAddingUser(true);
    try {
      await createUser(newUser);
      setShowAddUser(false);
      setNewUser({ nom: '', prenom: '', email: '', mot_de_passe: '', role: 'agent' });
      loadUsers();
      Alert.alert('Succès', 'Utilisateur ajouté avec succès');
    } catch (error) {
      console.error('Error adding user:', error);
      Alert.alert('Erreur', "Une erreur est survenue lors de l'ajout");
    } finally {
      setAddingUser(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Déconnexion', 'Êtes-vous sûr de vouloir vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnexion', style: 'destructive', onPress: onLogout },
    ]);
  };

  const initials = `${user.prenom?.charAt(0) || ''}${user.nom?.charAt(0) || ''}`;

  return (
    <View style={styles.container}>
      <AppHeader title="Paramètres" showBack onBack={() => navigation.goBack()} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* ── Profil ── */}
        <View style={styles.profileCard}>
          <View style={[styles.avatar, { backgroundColor: M.primaryDark }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user.prenom} {user.nom}</Text>
            <Text style={styles.profileEmail}>{user.email}</Text>
            <Text style={styles.profileRole}>
              {user.role === 'admin' ? 'Administrateur' : 'Agent'}
            </Text>
          </View>
        </View>

        {/* ── Utilisateurs (admin) ── */}
        {user.role === 'admin' && (
          <Section title="Gestion des utilisateurs">
            <TouchableOpacity
              style={styles.addUserBtn}
              onPress={() => setShowAddUser(true)}
              activeOpacity={0.7}
            >
              <Icon name="account-plus" size={20} color={M.primary} />
              <Text style={styles.addUserText}>Ajouter un utilisateur</Text>
            </TouchableOpacity>
            {users.length === 0 ? (
              <Text style={styles.emptyUsers}>Aucun utilisateur</Text>
            ) : (
              users.map((u, index) => (
                <React.Fragment key={u.id}>
                  {index > 0 && <View style={styles.divider} />}
                  <View style={styles.userItem}>
                    <View style={[styles.userAvatar, {
                      backgroundColor: u.role === 'admin' ? M.primary : M.info + '22'
                    }]}>
                      <Text style={[styles.userAvatarText, {
                        color: u.role === 'admin' ? '#FFF' : M.info
                      }]}>
                        {(u.prenom || '?').charAt(0)}{(u.nom || '').charAt(0)}
                      </Text>
                    </View>
                    <View style={styles.userInfo}>
                      <Text style={styles.userName}>{u.prenom} {u.nom}</Text>
                      <Text style={styles.userEmail}>{u.email}</Text>
                    </View>
                    <View style={[styles.userRoleBadge, {
                      backgroundColor: u.role === 'admin' ? M.primaryLight : M.infoLight,
                    }]}>
                      <Text style={[styles.userRoleBadgeText, {
                        color: u.role === 'admin' ? M.primaryDark : M.info,
                      }]}>
                        {u.role === 'admin' ? 'Admin' : 'Agent'}
                      </Text>
                    </View>
                  </View>
                </React.Fragment>
              ))
            )}
          </Section>
        )}

        {/* ── Paramètres ── */}
        <Section title="Paramètres">
          <MenuItem
            icon="camera-document"
            title="Scanner"
            subtitle={geminiKey ? 'Clé API configurée ✓' : 'Configurer la clé API Gemini'}
            onPress={() => setShowGeminiKey(true)}
          />
          <View style={styles.divider} />
          <MenuItem
            icon="server-network"
            title="Serveur"
            subtitle={serverUrl || 'Non configuré'}
            onPress={() => {
              setEditServerUrl(serverUrl || 'http://192.168.1.5:8090');
              setConnectionStatus('idle');
              setShowServerUrl(true);
            }}
          />
          <View style={styles.divider} />
          <MenuItem
            icon="bell-outline"
            title="Notifications"
            subtitle="Gérer les alertes"
            onPress={() => Alert.alert('Notifications', 'Gestion des notifications — à implémenter.')}
          />
          <View style={styles.divider} />
          <MenuItem
            icon="database-outline"
            title="Sauvegarde"
            subtitle="Exporter les données"
            onPress={() => Alert.alert('Sauvegarde', 'Export des données — à implémenter.')}
          />
          <View style={styles.divider} />
          <MenuItem
            icon="information-outline"
            title="À propos"
            subtitle="ChrisRoi Agence v1.0.0"
            onPress={() => setShowAbout(true)}
          />
        </Section>

        {/* ── Déconnexion ── */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Icon name="logout" size={20} color="#fff" />
          <Text style={styles.logoutText}>Se déconnecter</Text>
        </TouchableOpacity>

        {/* ── Footer ── */}
        <Text style={styles.footer}>ChrisRoi Agence © {new Date().getFullYear()}</Text>
      </ScrollView>

      {/* ── Dialog ajout utilisateur ── */}
      <Modal visible={showAddUser} transparent animationType="fade" onRequestClose={() => setShowAddUser(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>Nouvel utilisateur</Text>
            <ScrollView style={styles.dialogScroll} contentContainerStyle={styles.dialogScrollContent}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nom</Text>
                <TextInput
                  value={newUser.nom}
                  onChangeText={(t) => setNewUser({ ...newUser, nom: t })}
                  style={styles.dialogInput}
                  placeholder="Ex: KONE"
                  placeholderTextColor={M.textDim}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Prénom</Text>
                <TextInput
                  value={newUser.prenom}
                  onChangeText={(t) => setNewUser({ ...newUser, prenom: t })}
                  style={styles.dialogInput}
                  placeholder="Ex: Fatou"
                  placeholderTextColor={M.textDim}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  value={newUser.email}
                  onChangeText={(t) => setNewUser({ ...newUser, email: t })}
                  style={styles.dialogInput}
                  placeholder="agent@chrisroi.com"
                  placeholderTextColor={M.textDim}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Mot de passe</Text>
                <TextInput
                  value={newUser.mot_de_passe}
                  onChangeText={(t) => setNewUser({ ...newUser, mot_de_passe: t })}
                  style={styles.dialogInput}
                  placeholder="Mot de passe temporaire"
                  placeholderTextColor={M.textDim}
                  secureTextEntry
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Rôle</Text>
                <View style={styles.roleSelector}>
                  <TouchableOpacity
                    style={[styles.roleChip, newUser.role === 'agent' && styles.roleChipActive]}
                    onPress={() => setNewUser({ ...newUser, role: 'agent' })}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.roleDot, { backgroundColor: newUser.role === 'agent' ? M.info : M.border }]} />
                    <Text style={[styles.roleChipText, newUser.role === 'agent' && styles.roleChipTextActive]}>Agent</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.roleChip, newUser.role === 'admin' && styles.roleChipActive]}
                    onPress={() => setNewUser({ ...newUser, role: 'admin' })}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.roleDot, { backgroundColor: newUser.role === 'admin' ? M.primary : M.border }]} />
                    <Text style={[styles.roleChipText, newUser.role === 'admin' && styles.roleChipTextActive]}>Admin</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
            <View style={styles.dialogActions}>
              <TouchableOpacity onPress={() => setShowAddUser(false)} style={styles.dialogBtn}>
                <Text style={styles.dialogBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAddUser}
                style={[styles.dialogBtn, styles.dialogBtnPrimary]}
                disabled={addingUser}
              >
                <Text style={[styles.dialogBtnText, styles.dialogBtnTextPrimary]}>
                  {addingUser ? 'Ajout...' : 'Ajouter'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Dialog clé API Gemini ── */}
      <Modal visible={showGeminiKey} transparent animationType="fade" onRequestClose={() => setShowGeminiKey(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>Clé API Gemini</Text>
            <View style={styles.dialogContent}>
              <Text style={styles.dialogDesc}>
                Entrez votre clé API Gemini (gratuite sur ai.google.dev). Utilisée pour scanner les documents.
              </Text>
              <TextInput
                value={geminiKey}
                onChangeText={setGeminiKey}
                style={styles.dialogInput}
                placeholder="AIza..."
                placeholderTextColor={M.textDim}
                secureTextEntry={!geminiKeyVisible}
                autoCapitalize="none"
              />
            </View>
            <View style={styles.dialogActions}>
              <TouchableOpacity onPress={() => setShowGeminiKey(false)} style={styles.dialogBtn}>
                <Text style={styles.dialogBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveGeminiKey}
                style={[styles.dialogBtn, styles.dialogBtnPrimary]}
                disabled={savingKey || !geminiKey.trim()}
              >
                <Text style={[styles.dialogBtnText, styles.dialogBtnTextPrimary]}>
                  {savingKey ? 'Enregistrement...' : 'Enregistrer'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Dialog À propos ── */}
      <Modal visible={showAbout} transparent animationType="fade" onRequestClose={() => setShowAbout(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>À propos</Text>
            <View style={[styles.dialogContent, { alignItems: 'center' }]}>
              <View style={[styles.menuIconWrap, { width: 56, height: 56, borderRadius: Radius.md }]}>
                <Icon name="home-city-outline" size={28} color={M.primary} />
              </View>
              <Text style={{ fontSize: 16, fontWeight: '700', color: M.text, marginTop: Spacing.sm }}>
                ChrisRoi Agence
              </Text>
              <Text style={{ fontSize: 12, color: M.textSecondary, marginBottom: Spacing.md }}>
                Agence de placement de personnel de maison
              </Text>
              <Text style={{ fontSize: 13, color: M.textSecondary, lineHeight: 19, textAlign: 'center' }}>
                Application de gestion des dossiers, contrats et commissions.
                {'\n\n'}Version 1.0.0 — Expo SDK 54 · PocketBase
              </Text>
            </View>
            <View style={styles.dialogActions}>
              <TouchableOpacity onPress={() => setShowAbout(false)} style={[styles.dialogBtn, styles.dialogBtnPrimary]}>
                <Text style={[styles.dialogBtnText, styles.dialogBtnTextPrimary]}>Fermer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Dialog URL serveur PocketBase ── */}
      <Modal visible={showServerUrl} transparent animationType="fade" onRequestClose={() => setShowServerUrl(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>Serveur PocketBase</Text>
            <View style={styles.dialogContent}>
              <Text style={styles.dialogDesc}>
                Adresse IP de votre ordinateur sur le réseau WiFi (ex: http://192.168.1.5:8090).
                Le téléphone et le PC doivent être sur le même WiFi.
              </Text>
              <TextInput
                value={editServerUrl}
                onChangeText={setEditServerUrl}
                style={styles.dialogInput}
                placeholder="http://192.168.1.5:8090"
                autoCapitalize="none"
                keyboardType="url"
                placeholderTextColor={M.textDim}
              />
              {connectionStatus === 'ok' && (
                <Text style={{ color: M.success, fontSize: 13, marginTop: Spacing.sm }}>
                  ✓ Connexion réussie
                </Text>
              )}
              {connectionStatus === 'error' && (
                <Text style={{ color: M.danger, fontSize: 13, marginTop: Spacing.sm }}>
                  ✗ Serveur injoignable (vérifiez l'IP, le port et le WiFi)
                </Text>
              )}
            </View>
            <View style={styles.dialogActions}>
              <TouchableOpacity onPress={() => setShowServerUrl(false)} style={styles.dialogBtn}>
                <Text style={styles.dialogBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleTestConnection(editServerUrl.trim())}
                style={styles.dialogBtn}
                disabled={testingConnection || !editServerUrl.trim()}
              >
                <Text style={styles.dialogBtnText}>
                  {testingConnection ? 'Test...' : 'Tester'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveServerUrl} style={[styles.dialogBtn, styles.dialogBtnPrimary]}>
                <Text style={[styles.dialogBtnText, styles.dialogBtnTextPrimary]}>Enregistrer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: M.bg },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg, paddingBottom: Spacing.xxl },

  // Profil
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: M.bgCard,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: M.border,
    ...Shadows.card,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#FFF', fontSize: 24, fontWeight: '700' },
  profileInfo: { marginLeft: Spacing.lg, flex: 1 },
  profileName: { fontSize: 18, fontWeight: '700', color: M.textPrimary },
  profileEmail: { fontSize: 12, color: M.textSecondary, marginTop: 2 },
  profileRole: { fontSize: 11, fontWeight: '600', color: M.primary, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.4 },

  // Sections
  section: { marginBottom: Spacing.lg },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: M.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: Spacing.sm,
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: M.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: M.border,
    ...Shadows.card,
    overflow: 'hidden',
  },

  // Bouton ajouter utilisateur
  addUserBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: M.borderSoft,
  },
  addUserText: { fontSize: 14, fontWeight: '600', color: M.primary },

  // Utilisateur item
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  userAvatarText: { fontSize: 14, fontWeight: '600' },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontWeight: '600', color: M.textPrimary },
  userEmail: { fontSize: 12, color: M.textSecondary, marginTop: 1 },
  userRoleBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  userRoleBadgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },

  emptyUsers: { fontSize: 14, color: M.textSecondary, textAlign: 'center', padding: Spacing.lg },

  // Divider
  divider: { height: 1, backgroundColor: M.borderSoft },

  // Menu items
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  menuIconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: M.bg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  menuTextBlock: { flex: 1 },
  menuTitle: { fontSize: 15, fontWeight: '600', color: M.textPrimary },
  menuSubtitle: { fontSize: 12, color: M.textSecondary, marginTop: 1 },

  // Déconnexion
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: M.danger,
    borderRadius: Radius.md,
    paddingVertical: 14,
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Footer
  footer: { textAlign: 'center', color: M.textTertiary, fontSize: 12 },

  // Dialogs
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(61,53,48,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  dialog: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '85%',
    backgroundColor: M.bgElevated,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: M.border,
    ...Shadows.elevated,
    overflow: 'hidden',
  },
  dialogTitle: { fontSize: 18, fontWeight: '700', color: M.textPrimary, padding: Spacing.lg, paddingBottom: 0 },
  dialogScroll: { maxHeight: 400 },
  dialogScrollContent: { padding: Spacing.lg },
  dialogContent: { marginBottom: Spacing.lg },
  dialogDesc: { fontSize: 13, color: M.textSecondary, marginBottom: Spacing.md, lineHeight: 18 },
  inputGroup: {
    marginBottom: Spacing.sm,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: M.textMuted,
    marginBottom: 4,
  },
  dialogInput: {
    backgroundColor: M.bg,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: M.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    color: M.text,
  },
  roleSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  roleChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: M.border,
    backgroundColor: M.bg,
  },
  roleChipActive: {
    borderColor: M.primary,
    backgroundColor: M.primaryDim,
  },
  roleDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  roleChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: M.textMuted,
  },
  roleChipTextActive: {
    color: M.primary,
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: M.borderSoft,
  },
  dialogBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.sm,
  },
  dialogBtnPrimary: {
    backgroundColor: M.primary,
  },
  dialogBtnText: { fontSize: 14, fontWeight: '600', color: M.textMuted },
  dialogBtnTextPrimary: { color: '#fff' },
});
