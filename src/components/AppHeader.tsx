// ─── AppHeader : header unique de l'app (politique de header MAQUETTE) ───
// Chaque écran rend SON header avec ce composant. La navigation ne rend JAMAIS
// de header natif (headerShown: false partout) → plus de double header,
// plus de flèche ← sous la barre de statut (le padding safe-area est intégré ici).
import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import { Colors, Typography, Spacing, Radius } from '../theme';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  /** Slot droit (icône, compteur, bouton…) — aligné à droite du titre. */
  right?: React.ReactNode;
  /** Fond du header (défaut : surface). */
  background?: string;
  /** Masque le fond (transparent) pour les écrans immersifs. */
  transparent?: boolean;
  /** Couleur de la flèche retour. */
  backColor?: string;
}

export default function AppHeader({
  title,
  subtitle,
  showBack = true,
  onBack,
  right,
  background = Colors.surface,
  transparent = false,
  backColor = Colors.primary,
}: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: transparent ? 'transparent' : background,
          paddingTop: Platform.OS === 'android' ? insets.top + 6 : insets.top + 4,
          borderBottomWidth: transparent ? 0 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      <View style={styles.row}>
        <View style={styles.left}>
          {showBack && (
            <Pressable
              onPress={onBack ?? (() => {})}
              hitSlop={14}
              style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.5 }]}
              accessibilityLabel="Retour"
            >
              <Icon name="chevron-left" size={30} color={backColor} />
            </Pressable>
          )}
        </View>
        <View style={styles.center}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View style={styles.right}>{right ?? null}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomColor: Colors.borderSoft,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingBottom: 8,
  },
  left: {
    width: 44,
    alignItems: 'flex-start',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.xs,
  },
  right: {
    width: 44,
    alignItems: 'flex-end',
  },
  backBtn: {
    padding: 2,
  },
  title: {
    ...Typography.h3,
    color: Colors.text,
  },
  subtitle: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 1,
  },
});
