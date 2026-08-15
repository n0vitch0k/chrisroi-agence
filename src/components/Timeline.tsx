import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Colors, Spacing, Radius } from '../theme';

type TimelineItem = {
  icon: string;
  time: string;
  title: string;
  description: string;
  variant: 'red' | 'orange' | 'blue' | 'green';
};

type TimelineProps = {
  items: TimelineItem[];
};

const variantStyles = {
  red: {
    iconBg: Colors.dangerLight,
    icon: Colors.danger,
  },
  orange: {
    iconBg: Colors.warningLight,
    icon: Colors.warning,
  },
  blue: {
    iconBg: Colors.primaryLight,
    icon: Colors.primary,
  },
  green: {
    iconBg: Colors.successLight,
    icon: Colors.success,
  },
};

export default function Timeline({ items }: TimelineProps) {
  return (
    <View style={styles.container}>
      {items.map((item, index) => {
        const style = variantStyles[item.variant];
        return (
          <View key={index} style={[styles.item, index === items.length - 1 && styles.lastItem]}>
            <View style={[styles.iconContainer, { backgroundColor: style.iconBg }]}>
              <Text style={styles.icon}>{item.icon}</Text>
            </View>
            <View style={styles.content}>
              <Text style={styles.time}>{item.time}</Text>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.description}>{item.description}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.sm,
  },
  item: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingBottom: Spacing.lg,
    marginBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    position: 'relative',
  },
  lastItem: {
    paddingBottom: 0,
    marginBottom: 0,
    borderBottomWidth: 0,
  },
  iconContainer: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  icon: {
    fontSize: 18,
  },
  content: {
    flex: 1,
  },
  time: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '600',
    marginBottom: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
});
