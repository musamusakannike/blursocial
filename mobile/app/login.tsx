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

export default function LoginScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Glow position animation
  const glowTranslateX = useSharedValue(0);
  const glowScale = useSharedValue(1);

  useEffect(() => {
    glowTranslateX.value = withRepeat(withTiming(30, { duration: 6000 }), -1, true);
    glowScale.value = withRepeat(withTiming(1.15, { duration: 8000 }), -1, true);
  }, []);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      showToast('Please fill in all fields', 'error');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        showToast(data.error || 'Login failed', 'error');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      await storage.setItem(STORAGE_KEYS.USER, JSON.stringify(data.user));
      showToast('Welcome back!', 'success');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/dashboard');
    } catch (error) {
      console.error("[LOGIN ERROR]:", error);
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
      {/* Background ambient glow (Top-Right) */}
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
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to continue chatting anonymously</Text>
          </View>

          {/* Form wrapped in an elevated premium card */}
          <Card style={styles.formCard}>
            <View style={styles.form}>
              <Input
                label="Username"
                placeholder="Enter your username"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Input
                label="Password"
                placeholder="Enter your password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
              <Button
                onPress={handleLogin}
                isLoading={isLoading}
                size="lg"
                style={styles.loginButton}
              >
                Sign In
              </Button>
            </View>
          </Card>

          <View style={styles.footer}>
            <Text style={styles.footerText}>{"Don't have an account? "}</Text>
            <Pressable onPress={() => router.push('/register')}>
              <Text style={styles.footerLink}>Create one</Text>
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
  // Radial glow overlay at top-right
  radialGlow: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(255, 107, 157, 0.15)', // pink brand glow
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
  loginButton: {
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
