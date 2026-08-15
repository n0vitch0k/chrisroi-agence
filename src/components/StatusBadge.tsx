import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Colors, Spacing, Radius, Typography } from '../theme';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'default' | 'primary';

const variantColors: Record<BadgeVariant, { bg: string; text: string; dot: string }> = {
  success: { bg: Colors.successLight, text: Colors.successDark, dot: Colors.success },
  warning: { bg: Colors.warningLight, text: Colors.warningDark, dot: Colors.warning },
  danger: { bg: Colors.dangerLight, text: Colors.dangerDark, dot: Colors.danger },
  info: { bg: Colors.infoLight, text: Colors.infoDark, dot: Colors.info },
  default: { bg: Colors.borderLight, text: Colors.textSecondary, dot: Colors.textTertiary },
  primary: { bg: Colors.primaryLight, text: Colors.primaryDark, dot: Colors.primary },
};

interface StatusBadgeProps {
  label: string;
  variant?: BadgeVariant;
  dot?: boolean;
  style?: ViewStyle;
}

export default function StatusBadge({ label, variant = 'default', dot = true, style }: StatusBadgeProps) {
  const colors = variantColors[variant] || variantColors.default;

  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }, style]}>
      {dot && <View style={[styles.dot, { backgroundColor: colors.dot }]} />}
      <Text style={[labelStyle, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

const labelStyle: TextStyle = {
  ...Typography.caption,
  fontWeight: '600' as const,
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  label: labelStyle,
});
