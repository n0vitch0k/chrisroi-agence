import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Colors, Spacing, Radius, Shadows } from '../theme';
import SafeButton from './SafeButton';

type UrgentItem = {
  icon: string;
  title: string;
  description: string;
  onPress?: () => void;
};

type UrgentCardProps = {
  items: UrgentItem[];
  onViewAll?: () => void;
};

export default function UrgentCard({ items, onViewAll }: UrgentCardProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Actions prioritaires</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{items.length} à faire</Text>
        </View>
      </View>

      {items.map((item, index) => (
        <SafeButton key={index} style={styles.item} onPress={item.onPress ?? (() => {})}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>{item.icon}</Text>
          </View>
          <View style={styles.itemContent}>
            <Text style={styles.itemTitle}>{item.title}</Text>
            <Text style={styles.itemDescription}>{item.description}</Text>
          </View>
        </SafeButton>
      ))}

      {onViewAll && (
        <SafeButton onPress={onViewAll} style={styles.viewAll}>
          <Text style={styles.viewAllText}>Voir toutes les urgences →</Text>
        </SafeButton>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.danger,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    ...Shadows.soft,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textOnPrimary,
  },
  countBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  countText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  icon: {
    fontSize: 20,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textOnPrimary,
    marginBottom: 4,
  },
  itemDescription: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 18,
  },
  viewAll: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textOnPrimary,
    textAlign: 'center',
  },
});
