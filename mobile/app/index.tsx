import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withDelay,
  withTiming,
  withRepeat,
} from 'react-native-reanimated';
import {
  Lock,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Button from '@/components/Button';
import Card from '@/components/Card';
import Logo from '@/components/Logo';
import { Colors, Spacing, Radius } from '@/constants/Colors';
import { storage, STORAGE_KEYS } from '@/utils/storage';

type FeatureItem = {
  icon: LucideIcon;
  title: string;
  description: string;
  isSpotlight?: boolean;
};

const features: FeatureItem[] = [
  {
    icon: Lock,
    title: 'Secure & Private',
    description: 'Password-protected rooms ensure only invited participants can join.',
  },
  {
    icon: Users,
    title: 'Fully Anonymous',
    description: 'No one knows who is speaking. Perfect for honest discussions.',
    isSpotlight: true, // middle card is spotlight, matching web
  },
  {
    icon: Zap,
    title: 'Real-time Messaging',
    description: 'Messages appear instantly for everyone in the room.',
  },
];

const FeatureCard: React.FC<{ feature: FeatureItem; index: number }> = ({ feature, index }) => {
  const translateY = useSharedValue(40);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(
      800 + index * 120,
      withSpring(0, { damping: 18, stiffness: 120 })
    );
    opacity.value = withDelay(800 + index * 120, withTiming(1, { duration: 400 }));
  }, [index]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const Icon = feature.icon;

  return (
    <Animated.View style={animatedStyle}>
      <Card
        variant={feature.isSpotlight ? 'spotlight' : 'default'}
        style={styles.featureCard}
      >
        <View
          style={[
            styles.featureIconContainer,
            feature.isSpotlight && styles.spotlightIconContainer,
          ]}
        >
          <Icon
            size={22}
            color={feature.isSpotlight ? '#fff' : Colors.accent.primary}
            strokeWidth={2.5}
          />
        </View>
        <View style={styles.featureContent}>
          <Text style={styles.featureTitle}>{feature.title}</Text>
          <Text style={styles.featureDescription}>{feature.description}</Text>
        </View>
      </Card>
    </Animated.View>
  );
};

export default function OnboardingScreen() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  // Background glow orb values
  const orb1X = useSharedValue(0);
  const orb1Y = useSharedValue(0);
  const orb2X = useSharedValue(0);
  const orb2Y = useSharedValue(0);

  // Text / Content reveal values
  const contentOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.5);
  const titleY = useSharedValue(30);
  const subtitleY = useSharedValue(30);
  const buttonsY = useSharedValue(35);

  useEffect(() => {
    checkAuth();
    // Run ambient animations for background orbs
    orb1X.value = withRepeat(withTiming(40, { duration: 9000 }), -1, true);
    orb1Y.value = withRepeat(withTiming(-30, { duration: 11000 }), -1, true);
    orb2X.value = withRepeat(withTiming(-30, { duration: 10000 }), -1, true);
    orb2Y.value = withRepeat(withTiming(40, { duration: 8000 }), -1, true);
  }, []);

  const checkAuth = async () => {
    try {
      const user = await storage.getItem(STORAGE_KEYS.USER);
      if (user) {
        router.replace('/dashboard');
        return;
      }
    } catch (error) {
      console.error('Auth check error:', error);
    } finally {
      setIsChecking(false);
      startAnimations();
    }
  };

  const startAnimations = () => {
    contentOpacity.value = withTiming(1, { duration: 500 });
    logoScale.value = withSpring(1, { damping: 14, stiffness: 100 });
    titleY.value = withDelay(150, withSpring(0, { damping: 16, stiffness: 120 }));
    subtitleY.value = withDelay(300, withSpring(0, { damping: 16, stiffness: 120 }));
    buttonsY.value = withDelay(500, withSpring(0, { damping: 16, stiffness: 120 }));
  };

  const orb1Style = useAnimatedStyle(() => ({
    transform: [{ translateX: orb1X.value }, { translateY: orb1Y.value }],
  }));

  const orb2Style = useAnimatedStyle(() => ({
    transform: [{ translateX: orb2X.value }, { translateY: orb2Y.value }],
  }));

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
    opacity: contentOpacity.value,
  }));

  const titleAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: titleY.value }],
    opacity: contentOpacity.value,
  }));

  const subtitleAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: subtitleY.value }],
    opacity: contentOpacity.value,
  }));

  const buttonsAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: buttonsY.value }],
    opacity: contentOpacity.value,
  }));

  if (isChecking) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient
          colors={[Colors.accent.primary, Colors.accent.secondary]}
          style={styles.loadingLogo}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Logo size="lg" />
        </LinearGradient>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Background orbs */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <Animated.View style={[styles.glowOrb1, orb1Style]} />
        <Animated.View style={[styles.glowOrb2, orb2Style]} />
        <LinearGradient
          colors={['transparent', Colors.bg.primary]}
          style={StyleSheet.absoluteFillObject}
        />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Animated.View style={[styles.logoWrapper, logoAnimatedStyle]}>
          <Logo size="lg" />
        </Animated.View>

        <Animated.View style={[styles.headerTextContainer, titleAnimatedStyle]}>
          <Text style={styles.title}>
            Anonymous Chat{'\n'}
            <Text style={styles.titleAccent}>Made Simple</Text>
          </Text>
        </Animated.View>

        <Animated.Text style={[styles.subtitle, subtitleAnimatedStyle]}>
          Create secure, password-protected chat rooms in seconds. Share the link, and chat
          anonymously with absolute confidentiality.
        </Animated.Text>

        <View style={styles.featuresContainer}>
          {features.map((feature, index) => (
            <FeatureCard key={feature.title} feature={feature} index={index} />
          ))}
        </View>
      </ScrollView>

      {/* Sticky button container at bottom */}
      <Animated.View style={[styles.buttonsContainer, buttonsAnimatedStyle]}>
        <Button onPress={() => router.push('/register')} size="lg" style={styles.button}>
          Create a Room
        </Button>
        <Button
          onPress={() => router.push('/login')}
          variant="secondary"
          size="lg"
          style={styles.button}
        >
          Sign In
        </Button>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingLogo: {
    width: 120,
    height: 120,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Ambient floating glowing orbs
  glowOrb1: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(255, 107, 157, 0.12)',
  },
  glowOrb2: {
    position: 'absolute',
    top: 200,
    left: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(196, 69, 105, 0.08)',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xl + 20,
  },
  logoWrapper: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  headerTextContainer: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 34,
    fontFamily: 'Manrope_700Bold',
    color: Colors.text.primary,
    textAlign: 'center',
    lineHeight: 42,
    letterSpacing: -0.8,
  },
  titleAccent: {
    color: Colors.accent.primary,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Manrope_400Regular',
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.sm,
  },
  featuresContainer: {
    gap: Spacing.md,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureIconContainer: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.accent.glow,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  spotlightIconContainer: {
    backgroundColor: Colors.accent.primary,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontFamily: 'Manrope_600SemiBold',
    color: Colors.text.primary,
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  featureDescription: {
    fontSize: 13.5,
    fontFamily: 'Manrope_400Regular',
    color: Colors.text.secondary,
    lineHeight: 18,
  },
  buttonsContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.md,
    backgroundColor: Colors.bg.primary,
  },
  button: {
    width: '100%',
  },
});