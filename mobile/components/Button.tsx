import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Colors, Radius, Shadows, Spacing } from '@/constants/Colors';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ButtonProps {
  onPress: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const Button: React.FC<ButtonProps> = ({
  onPress,
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  style,
  textStyle,
}) => {
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    if (!disabled && !isLoading) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      scale.value = withSpring(0.96, { damping: 15, stiffness: 300 });
    }
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  const handlePress = () => {
    if (!disabled && !isLoading) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onPress();
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const sizeStyles = {
    sm: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      minHeight: 40,
    },
    md: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm + 2,
      minHeight: 44,
    },
    lg: {
      paddingHorizontal: Spacing.xl - Spacing.xs,
      paddingVertical: Spacing.md - 2,
      minHeight: 50,
    },
  } as const;

  const textSizes = {
    sm: 13,
    md: 15,
    lg: 16,
  } as const;

  const renderContent = () => {
    if (isLoading) {
      return (
        <ActivityIndicator
          color={variant === 'primary' || variant === 'destructive' ? '#fff' : Colors.accent.primary}
        />
      );
    }

    return (
      <Text
        style={[
          styles.text,
          { fontSize: textSizes[size] },
          variant === 'primary' && styles.primaryText,
          variant === 'destructive' && styles.destructiveText,
          variant === 'secondary' && styles.secondaryText,
          variant === 'ghost' && styles.ghostText,
          textStyle,
        ]}
      >
        {children}
      </Text>
    );
  };

  if (variant === 'primary') {
    return (
      <AnimatedPressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || isLoading}
        style={[animatedStyle, styles.base, styles.pill, sizeStyles[size], disabled && styles.disabled, style]}
      >
        <LinearGradient
          colors={[Colors.accent.primary, Colors.accent.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[StyleSheet.absoluteFillObject, styles.gradientBackground]}
        />
        {renderContent()}
      </AnimatedPressable>
    );
  }

  if (variant === 'destructive') {
    return (
      <AnimatedPressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || isLoading}
        style={[animatedStyle, styles.base, styles.pill, sizeStyles[size], disabled && styles.disabled, style]}
      >
        <LinearGradient
          colors={[Colors.status.error, '#C43535']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[StyleSheet.absoluteFillObject, styles.gradientBackground]}
        />
        {renderContent()}
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || isLoading}
      style={[
        animatedStyle,
        styles.base,
        variant === 'secondary' ? styles.pill : styles.rect,
        sizeStyles[size],
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && styles.ghost,
        disabled && styles.disabled,
        style,
      ]}
    >
      {renderContent()}
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pill: {
    borderRadius: Radius.full,
  },
  rect: {
    borderRadius: Radius.md,
  },
  gradientBackground: {
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
  },
  secondary: {
    backgroundColor: Colors.bg.secondary,
    borderWidth: 1,
    borderColor: Colors.border.primary,
    ...Shadows.sm,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontFamily: 'Manrope_600SemiBold',
    letterSpacing: -0.2,
  },
  primaryText: {
    color: '#fff',
  },
  destructiveText: {
    color: '#fff',
  },
  secondaryText: {
    color: Colors.text.primary,
  },
  ghostText: {
    color: Colors.text.secondary,
  },
});

export default Button;
