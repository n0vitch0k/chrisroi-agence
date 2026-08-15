import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Card } from 'react-native-paper';
import { Colors, Spacing, Radius, Shadows } from '../theme';

interface SectionCardProps {
  title?: string;
  subtitle?: string;
  accentColor?: string;
  children: React.ReactNode;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
}

export default function SectionCard({
  title,
  subtitle,
  accentColor,
  children,
  style,
  contentStyle,
}: SectionCardProps) {
  return (
    <Card style={[cardStyle, style]}>
      <View style={[styles.accent, accentColor ? { backgroundColor: accentColor } : styles.accentDefault]} />
      <Card.Content style={[styles.content, contentStyle]}>
        {title && (
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
        )}
        {children}
      </Card.Content>
    </Card>
  );
}

const cardStyle: ViewStyle = {
  backgroundColor: Colors.surface,
  borderRadius: Radius.md,
  marginBottom: Spacing.md,
  overflow: 'hidden',
  ...Shadows.card,
};

const styles = StyleSheet.create({
  card: cardStyle,
  accent: {
    height: 3,
  },
  accentDefault: {
    backgroundColor: Colors.primary,
  },
  content: {
    padding: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
