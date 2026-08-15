import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Spacing } from '../theme';

interface InfoRowProps {
  icon?: string;
  label: string;
  value: string;
  style?: ViewStyle;
}

export default function InfoRow({ label, value, style }: InfoRowProps) {
  return (
    <View style={[styles.row, style]}>
      <View style={styles.labelWrap}>
        <View style={styles.labelDot} />
        <View style={styles.labelText}>
          {typeof label === 'string' ? (
            <Text style={styles.label}>{label}</Text>
          ) : (
            label
          )}
        </View>
      </View>
      {typeof value === 'string' ? (
        <Text style={styles.value}>{value}</Text>
      ) : (
        value
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  labelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.md,
  },
  labelDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.primary,
    marginRight: Spacing.sm,
    marginTop: 8,
  },
  labelText: {
    flex: 1,
  },
  label: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  value: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '500',
    textAlign: 'right',
    flex: 1,
    lineHeight: 18,
  },
});
