import React from 'react';
import { View, StyleSheet, ViewStyle, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Colors, Radius, Shadows, Spacing } from '@/constants/Colors';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  hover?: boolean;
  variant?: 'default' | 'spotlight';
}

const Card: React.FC<CardProps> = ({
  children,
  style,
  onPress,
  hover = false,
  variant = 'default',
}) => {
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    if (onPress && hover) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      scale.value = withSpring(0.98, { damping: 15, stiffness: 300 });
    }
  };

  const handlePressOut = () => {
    if (onPress && hover) {
      scale.value = withSpring(1, { damping: 15, stiffness: 300 });
    }
  };

  const handlePress = () => {
    if (onPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onPress();
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const isSpotlight = variant === 'spotlight';

  const renderBackground = () => {
    if (isSpotlight) {
      return (
        <LinearGradient
          colors={['rgba(255, 107, 157, 0.08)', 'rgba(18, 22, 26, 0.8)']}
          style={[StyleSheet.absoluteFillObject, styles.spotlightBg]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      );
    }
    return null;
  };

  if (onPress) {
    return (
      <AnimatedPressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.card,
          isSpotlight && styles.spotlightCard,
          animatedStyle,
          style,
        ]}
      >
        {renderBackground()}
        {children}
      </AnimatedPressable>
    );
  }

  return (
    <View style={[styles.card, isSpotlight && styles.spotlightCard, style]}>
      {renderBackground()}
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border.primary,
    padding: Spacing.lg,
    position: 'relative',
    overflow: 'hidden',
    ...Shadows.sm,
  },
  spotlightCard: {
    borderColor: 'rgba(255, 107, 157, 0.25)',
    shadowColor: Colors.accent.primary,
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 3,
  },
  spotlightBg: {
    borderRadius: Radius.lg - 1,
  },
});

export default Card;
