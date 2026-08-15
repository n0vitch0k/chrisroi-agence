import React, { useRef } from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  ViewStyle,
  StyleProp,
  Platform,
} from 'react-native';
import { Colors, Radius, Spacing } from '../theme';

interface SafeButtonProps {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  mode?: 'contained' | 'outlined' | 'text';
  style?: StyleProp<ViewStyle>;
  activeOpacity?: number;
  children: React.ReactNode;
  color?: string;
}

export default function SafeButton({
  onPress,
  loading = false,
  disabled = false,
  mode = 'contained',
  style,
  activeOpacity,
  children,
  color,
}: SafeButtonProps) {
  const btnColor = color || Colors.primary;
  const isDisabled = disabled || loading;
  const viewRef = useRef<any>(null);

  const containerStyle: ViewStyle[] = [];

  if (mode === 'contained') {
    containerStyle.push({
      backgroundColor: isDisabled ? Colors.disabled : btnColor,
      borderWidth: 0,
      paddingVertical: 14,
      paddingHorizontal: Spacing.xl,
      borderRadius: Radius.md,
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: isDisabled ? 'default' : 'pointer',
    } as ViewStyle);
  } else if (mode === 'outlined') {
    containerStyle.push({
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: isDisabled ? Colors.disabled : btnColor,
      paddingVertical: 14,
      paddingHorizontal: Spacing.xl,
      borderRadius: Radius.md,
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: isDisabled ? 'default' : 'pointer',
    } as ViewStyle);
  } else {
    containerStyle.push({
      backgroundColor: 'transparent',
      borderWidth: 0,
      paddingVertical: 8,
      paddingHorizontal: 0,
      borderRadius: Radius.md,
      minHeight: 36,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: isDisabled ? 'default' : 'pointer',
    } as ViewStyle);
  }

  if (style) containerStyle.push(style as ViewStyle);

  const textColor =
    mode === 'contained'
      ? Colors.textOnPrimary
      : btnColor;

  const runPress = () => {
    if (!isDisabled) onPress();
  };

  return (
    <Pressable
      ref={viewRef}
      onPress={runPress}
      disabled={isDisabled}
      android_ripple={mode === 'contained' ? { color: Colors.textOnPrimary + '33' } : undefined}
      style={({ pressed }) => [
        ...containerStyle,
        { opacity: pressed && !isDisabled ? 0.75 : 1 },
      ]}
      {...(Platform.OS === 'web' ? { onClick: runPress } : {})}
    >
      {loading && (
        <ActivityIndicator
          size="small"
          color={textColor}
          style={{ marginRight: 8 }}
        />
      )}
      <Text
        style={{
          fontSize: 15,
          fontWeight: '600',
          textAlign: 'center',
          color: isDisabled ? Colors.textOnDisabled : textColor,
        }}
      >
        {children}
      </Text>
    </Pressable>
  );
}
