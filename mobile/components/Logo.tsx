import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MessageCircle } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Radius, Spacing } from '@/constants/Colors';

interface LogoProps {
  size?: 'sm' | 'lg';
}

export default function Logo({ size = 'sm' }: LogoProps) {
  const isLarge = size === 'lg';
  const containerSize = isLarge ? 80 : 40;
  const iconSize = isLarge ? 40 : 20;
  const logoRadius = isLarge ? Radius.lg : Radius.sm;
  const fontSize = isLarge ? 32 : 18;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.accent.primary, Colors.accent.secondary]}
        style={[
          styles.logoContainer,
          {
            width: containerSize,
            height: containerSize,
            borderRadius: logoRadius,
          },
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <MessageCircle size={iconSize} color="#fff" strokeWidth={2.5} />
      </LinearGradient>
      <Text style={[styles.text, { fontSize }]}>Blur</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + 2,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontFamily: 'Manrope_700Bold',
    color: Colors.text.primary,
    letterSpacing: -0.5,
  },
});
