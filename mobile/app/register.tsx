import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  withTiming,
  useAnimatedStyle,
  withRepeat,
} from 'react-native-reanimated';
import Button from '@/components/Button';
import Input from '@/components/Input';
import Card from '@/components/Card';
import Logo from '@/components/Logo';
import { Colors, Spacing, Radius } from '@/constants/Colors';
import { useToast } from '@/contexts/ToastContext';
import { storage, STORAGE_KEYS } from '@/utils/storage';
import { API_URL } from '@/constants/Config';
import * as Haptics from 'expo-haptics';

export default function RegisterScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Glow position animation
  const glowTranslateX = useSharedValue(0);
  const glowScale = useSharedValue(1);

  useEffect(() => {
    glowTranslateX.value = withRepeat(withTiming(-30, { duration: 6000 }), -1, true);
    glowScale.value = withRepeat(withTiming(1.15, { duration: 8000 }), -1, true);
  }, []);

  const handleRegister = async () => {
    if (!username.trim() || !password.trim() || !confirmPassword.trim()) {
      showToast('Please fill in all fields', 'error');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (password !== confirmPassword) {
      showToast('Passwords do not match', 'error');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (password.length < 6) {
      showToast('Password must be at least 6 characters', 'error');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        showToast(data.error || 'Registration failed', 'error');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      await storage.setItem(STORAGE_KEYS.USER, JSON.stringify(data.user));
      showToast('Account created successfully!', 'success');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/dashboard');
    } catch (error) {
      showToast('Something went wrong. Please try again.', 'error');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: glowTranslateX.value }, { scale: glowScale.value }],
  }));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Background ambient glow (Top-Left) */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <Animated.View style={[styles.radialGlow, glowStyle]} />
        <LinearGradient
          colors={['transparent', Colors.bg.primary]}
          style={StyleSheet.absoluteFillObject}
        />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft size={24} color={Colors.text.primary} strokeWidth={2.5} />
          </Pressable>

          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Logo size="lg" />
            </View>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join Blur and start chatting anonymously</Text>
          </View>

          {/* Form wrapped in an elevated premium card */}
          <Card style={styles.formCard}>
            <View style={styles.form}>
              <Input
                label="Username"
                placeholder="Choose a username"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Input
                label="Password"
                placeholder="Create a password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
              <Input
                label="Confirm Password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
              />
              <Button
                onPress={handleRegister}
                isLoading={isLoading}
                size="lg"
                style={styles.registerButton}
              >
                Create Account
              </Button>
            </View>
          </Card>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Pressable onPress={() => router.push('/login')}>
              <Text style={styles.footerLink}>Sign in</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
  },
  // Radial glow overlay at top-left
  radialGlow: {
    position: 'absolute',
    top: -80,
    left: -80,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(196, 69, 105, 0.12)', // coral/secondary pink glow
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  backButton: {
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
    alignSelf: 'flex-start',
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  logoContainer: {
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 32,
    fontFamily: 'Manrope_700Bold',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Manrope_400Regular',
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  formCard: {
    padding: Spacing.xl,
    backgroundColor: 'rgba(18, 22, 26, 0.8)', // glassmorphism blend
  },
  form: {
    gap: Spacing.lg,
  },
  registerButton: {
    marginTop: Spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.xl + 10,
  },
  footerText: {
    fontSize: 14,
    fontFamily: 'Manrope_400Regular',
    color: Colors.text.secondary,
  },
  footerLink: {
    fontSize: 14,
    fontFamily: 'Manrope_600SemiBold',
    color: Colors.accent.primary,
  },
});
