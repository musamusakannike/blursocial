import React, { useState } from 'react';
import { View, TextInput, Text, StyleSheet, TextInputProps } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { Colors, Radius, Spacing, Shadows } from '@/constants/Colors';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

const Input: React.FC<InputProps> = ({ label, error, style, ...props }) => {
  const [isFocused, setIsFocused] = useState(false);
  const focusProgress = useSharedValue(0);

  const handleFocus = () => {
    setIsFocused(true);
    focusProgress.value = withTiming(1, { duration: 250 });
  };

  const handleBlur = () => {
    setIsFocused(false);
    focusProgress.value = withTiming(0, { duration: 250 });
  };

  const containerAnimatedStyle = useAnimatedStyle(() => {
    const borderColor = error
      ? Colors.status.error
      : interpolateColor(
          focusProgress.value,
          [0, 1],
          [Colors.border.primary, Colors.accent.primary]
        );

    const shadowOpacity = error
      ? 0.15
      : focusProgress.value * 0.4; // animate shadow opacity between 0 and 0.4

    return {
      borderColor,
      shadowColor: error ? Colors.status.error : Colors.accent.primary,
      shadowOpacity,
      shadowRadius: error ? 8 : focusProgress.value * 12,
      shadowOffset: { width: 0, height: 0 },
    };
  });

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <Animated.View
        style={[
          styles.inputContainer,
          containerAnimatedStyle,
        ]}
      >
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={Colors.text.tertiary}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...props}
        />
      </Animated.View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontFamily: 'Manrope_500Medium',
    color: Colors.text.secondary,
    marginBottom: Spacing.sm,
    letterSpacing: -0.1,
  },
  inputContainer: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.md,
    borderWidth: 1,
    elevation: 2, // backup for android elevation
  },
  input: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
    fontSize: 16,
    fontFamily: 'Manrope_400Regular',
    color: Colors.text.primary,
  },
  errorText: {
    fontSize: 12,
    fontFamily: 'Manrope_400Regular',
    color: Colors.status.error,
    marginTop: Spacing.xs,
  },
});

export default Input;
