import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { TextInput, Dialog, Portal, Button } from 'react-native-paper';
import { authenticateUser } from '../database/service';
import { checkHealth, getPocketBaseUrl, setPocketBaseUrl } from '../database/pocketbase';
import { logBackend } from '../utils/backendLogger';
import { Colors, Spacing, Radius, Shadows } from '../theme';
import SafeButton from '../components/SafeButton';

interface LoginScreenProps {
  onLogin: (user: { id: string; nom: string; prenom: string; email: string; role: string }) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showServerDialog, setShowServerDialog] = useState(false);
  const [serverUrl, setServerUrl] = useState(getPocketBaseUrl());
  const [testingServer, setTestingServer] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Erreur de saisie', 'Veuillez remplir l\'email et le mot de passe');
      return;
    }

    setLoading(true);
    logBackend('Login', `Tentative de connexion : ${email.trim()}`, 'info');

    // 1. Vérifier d'abord si le serveur répond
    logBackend('Login', 'Vérification du serveur...', 'info');
    const healthy = await checkHealth();

    if (!healthy) {
      logBackend('Login', '❌ Serveur injoignable, login abandonné', 'error');
      setLoading(false);
      Alert.alert(
        'Serveur inaccessible',
        `L'app essaie de joindre :\n${getPocketBaseUrl()}\n\nVérifiez que PocketBase est démarré et accessible.`
      );
      return;
    }

    try {
      logBackend('Login', 'Authentification en cours...', 'info');
      const user = await authenticateUser(email.trim(), password);
      if (user) {
        logBackend('Login', `✅ Connecté : ${user.prenom} ${user.nom} (${user.role})`, 'success');
        onLogin(user);
      } else {
        logBackend('Login', '⛔ Échec : identifiants incorrects', 'warn');
        Alert.alert(
          'Échec de connexion',
          'Email ou mot de passe incorrect\n\nVérifiez :\n• Email : admin@chrisroi.com\n• Mot de passe : chrisroi2024'
        );
      }
    } catch (error: any) {
      console.error('Login error:', error);
      logBackend('Login', `❌ Erreur : ${error?.message || error}`, 'error');

      // Messages d'erreur plus spécifiques
      let errorMessage = 'Une erreur est survenue lors de la connexion';

      if (error?.message?.includes('connect')) {
        errorMessage = 'Impossible de se connecter au serveur\n\nVérifiez que PocketBase est démarré sur le port 8090';
      } else if (error?.message?.includes('timeout')) {
        errorMessage = 'Le serveur met trop temps à répondre\n\nRéessayez ou vérifiez votre connexion';
      } else if (error?.message?.includes('404')) {
        errorMessage = 'Service d\'authentification indisponible\n\nRedémarrez PocketBase';
      }

      Alert.alert('Erreur technique', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleTestServer = async () => {
    setTestingServer(true);
    try {
      // Tester la nouvelle URL d'abord
      const previousUrl = getPocketBaseUrl();
      const urlToTest = serverUrl.replace(/\/+$/, '');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const resp = await fetch(`${urlToTest}/api/health`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (resp.ok) {
        await setPocketBaseUrl(urlToTest);
        setShowServerDialog(false);
        Alert.alert('Succès', `Serveur accessible : ${urlToTest}`);
      } else {
        Alert.alert('Erreur', `Réponse inattendue (${resp.status})`);
      }
    } catch {
      Alert.alert(
        'Serveur inaccessible',
        `Impossible de joindre ${serverUrl}\n\nVérifiez que PocketBase tourne et que l'URL est correcte.`
      );
    } finally {
      setTestingServer(false);
    }
  };

  const handleOpenServerDialog = () => {
    setServerUrl(getPocketBaseUrl());
    setShowServerDialog(true);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Entête branding */}
        <View style={styles.topSection}>
          <View style={styles.logoRing}>
            <View style={styles.logoInner}>
              <Text style={styles.logoText}>CR</Text>
            </View>
          </View>
          <Text style={styles.appName}>ChrisRoi Agence</Text>
          <Text style={styles.tagline}>Agence de Placement de Personnel</Text>
        </View>

        {/* Carte de connexion */}
        <View style={card}>
          <Text style={styles.cardTitle}>Connexion</Text>
          <Text style={styles.cardSubtitle}>
            Accédez à votre tableau de bord
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>EMAIL</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              mode="outlined"
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="admin@chrisroi.com"
              style={styles.input}
              outlineStyle={styles.inputOutline}
              left={<TextInput.Icon icon="email-outline" />}
              theme={{ colors: { primary: Colors.primary, outline: Colors.border, onSurfaceVariant: Colors.textTertiary } }}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>MOT DE PASSE</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              mode="outlined"
              secureTextEntry={!showPassword}
              placeholder="••••••••"
              style={styles.input}
              outlineStyle={styles.inputOutline}
              left={<TextInput.Icon icon="lock-outline" />}
              right={
                <TextInput.Icon
                  icon={showPassword ? 'eye-off' : 'eye'}
                  onPress={() => setShowPassword(!showPassword)}
                />
              }
              theme={{ colors: { primary: Colors.primary, outline: Colors.border, onSurfaceVariant: Colors.textTertiary } }}
            />
          </View>

          <SafeButton
            mode="contained"
            onPress={handleLogin}
            loading={loading}
            disabled={loading}
            style={styles.loginButton}
          >
            Se connecter
          </SafeButton>

          <View style={styles.divider} />

          <Text style={styles.hint}>
            Identifiants par défaut :
          </Text>
          <Text style={styles.hintDetail}>
            admin@chrisroi.com / chrisroi2024
          </Text>

          <SafeButton
            mode="text"
            onPress={handleOpenServerDialog}
            style={styles.serverButton}
            color={Colors.textOnPrimary}
          >
            Configurer le serveur
          </SafeButton>
        </View>
      </ScrollView>

      <Portal>
        <Dialog visible={showServerDialog} onDismiss={() => setShowServerDialog(false)} style={styles.dialog}>
          <Dialog.Title>Serveur PocketBase</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="URL du serveur"
              value={serverUrl}
              onChangeText={setServerUrl}
              mode="outlined"
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="http://192.168.1.100:8090"
              style={styles.dialogInput}
            />
            <Text style={styles.dialogHint}>
              Adresse IP du PC hébergeant PocketBase sur le réseau local (ex: 192.168.1.100)
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowServerDialog(false)}>Annuler</Button>
            <Button
              onPress={handleTestServer}
              loading={testingServer}
              disabled={testingServer || !serverUrl.trim()}
            >
              Tester &amp; Enregistrer
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </KeyboardAvoidingView>
  );
}

const card = {
  backgroundColor: Colors.surface,
  borderRadius: Radius.lg,
  padding: Spacing.xxl,
  ...Shadows.elevated,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxxl,
  },
  // ─── Entête ─────────────────────────────────────────────
  topSection: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  logoRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  logoInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  logoText: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: -0.5,
  },
  appName: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textOnPrimary,
    letterSpacing: -0.3,
  },
  tagline: {
    fontSize: 14,
    color: Colors.textOnPrimary,
    opacity: 0.85,
    marginTop: Spacing.xs,
  },
  // ─── Carte ──────────────────────────────────────────────
  card,
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  cardSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  // ─── Champs ─────────────────────────────────────────────
  inputGroup: {
    marginBottom: Spacing.md,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: Colors.surface,
    fontSize: 15,
  },
  inputOutline: {
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  // ─── Bouton ─────────────────────────────────────────────
  loginButton: {
    marginTop: Spacing.lg,
    borderRadius: Radius.sm,
    paddingVertical: 2,
  },
  loginButtonContent: {
    height: 48,
  },
  loginButtonLabel: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  // ─── Infos ──────────────────────────────────────────────
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: Spacing.xl,
  },
  hint: {
    fontSize: 12,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  hintDetail: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontWeight: '500',
  },
  serverButton: {
    marginTop: Spacing.md,
    alignSelf: 'center',
    opacity: 0.85,
  },
  dialog: {
    borderRadius: Radius.md,
  },
  dialogInput: {
    marginBottom: Spacing.sm,
  },
  dialogHint: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
});
