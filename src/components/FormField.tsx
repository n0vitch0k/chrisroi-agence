import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { TextInput, HelperText } from 'react-native-paper';
import { Colors, Spacing, Radius, Typography } from '../theme';

interface FormFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  required?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  disabled?: boolean;
  right?: React.ReactNode;
  style?: ViewStyle;
}

export default function FormField({
  label,
  value,
  onChangeText,
  error,
  required,
  multiline,
  numberOfLines,
  placeholder,
  keyboardType,
  autoCapitalize,
  disabled,
  right,
  style,
}: FormFieldProps) {
  return (
    <View style={[styles.wrapper, style]}>
      <Text style={labelStyle}>
        {label}
        {required && <Text style={styles.required}> *</Text>}
      </Text>
      <TextInput
        mode="outlined"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        multiline={multiline}
        numberOfLines={numberOfLines}
        disabled={disabled}
        right={right}
        error={!!error}
        style={styles.input}
        outlineStyle={styles.inputOutline}
        contentStyle={multiline ? styles.multilineContent : undefined}
        theme={{
          colors: {
            primary: Colors.primary,
            outline: Colors.border,
            onSurfaceVariant: Colors.textTertiary,
          },
        }}
      />
      {error && <HelperText type="error" visible>{error}</HelperText>}
    </View>
  );
}

const labelStyle = {
  ...Typography.label,
  color: Colors.textSecondary,
  marginBottom: Spacing.sm,
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: Spacing.md,
  },
  label: labelStyle,
  required: {
    color: Colors.danger,
  },
  input: {
    backgroundColor: Colors.surface,
    fontSize: 15,
  },
  inputOutline: {
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  multilineContent: {
    minHeight: 80,
    paddingTop: 8,
  },
});
