import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Card } from 'react-native-paper';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import { Colors, Spacing, Radius, Typography, Shadows } from '../theme';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: string;
  color?: string;
  trend?: { value: string; positive: boolean };
  style?: ViewStyle;
  onPress?: () => void;
}

export default function StatCard({ label, value, icon, color = Colors.primary, trend, style, onPress }: StatCardProps) {
  return (
    <Card style={[cardStyle, style]} onPress={onPress}>
      <Card.Content style={styles.content}>
        <View style={[styles.iconWrap, { backgroundColor: color + '15' }]}>
          <Icon name={icon} size={22} color={color} />
        </View>
        <Text style={valueStyle}>{value}</Text>
        <Text style={labelStyle}>{label}</Text>
        {trend && (
          <View style={styles.trendRow}>
            <Icon
              name={trend.positive ? 'trending-up' : 'trending-down'}
              size={14}
              color={trend.positive ? Colors.success : Colors.danger}
            />
            <Text style={[trendStyle, { color: trend.positive ? Colors.success : Colors.danger }]}>
              {trend.value}
            </Text>
          </View>
        )}
      </Card.Content>
    </Card>
  );
}

const cardStyle: ViewStyle = {
  flex: 1,
  backgroundColor: Colors.surface,
  borderRadius: Radius.md,
  ...Shadows.card,
};

const valueStyle: TextStyle = {
  ...Typography.number,
  color: Colors.textPrimary,
  marginBottom: 2,
};

const labelStyle: TextStyle = {
  ...Typography.caption,
  color: Colors.textSecondary,
  textAlign: 'center',
};

const trendStyle: TextStyle = {
  ...Typography.caption,
  fontWeight: '600' as const,
};

const styles = StyleSheet.create({
  card: cardStyle,
  content: {
    padding: Spacing.lg,
    alignItems: 'center',
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  value: valueStyle,
  label: labelStyle,
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
    gap: 3,
  },
  trend: trendStyle,
});
