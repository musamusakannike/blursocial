import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useRouter, Link } from 'expo-router';
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Eye, EyeOff, UserPlus } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/Toast';
import { registerUser } from '@/services/api';
import { hapticLight, hapticSuccess, hapticError, hapticWarning } from '@/utils/haptics';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import AppleSignInButton from '@/components/AppleSignInButton';

export default function RegisterScreen() {
  const { colors } = useTheme();
  const { login } = useAuth();
  const toast = useToast();
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const buttonScale = useSharedValue(1);

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const handleRegister = async () => {
    if (!username.trim() || !password.trim() || !confirmPassword.trim()) {
      toast.warning('Please fill in all fields');
      hapticWarning();
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      hapticError();
      return;
    }

    if (username.length < 3 || username.length > 20) {
      toast.warning('Username must be 3-20 characters');
      hapticWarning();
      return;
    }

    if (password.length < 6) {
      toast.warning('Password must be at least 6 characters');
      hapticWarning();
      return;
    }

    setIsLoading(true);
    hapticLight();

    try {
      const data = await registerUser(username.trim(), password);
      if (data.success) {
        hapticSuccess();
        toast.success('Account created!');
        login(data.user);
        router.replace('/(tabs)/dashboard');
      }
    } catch (err: any) {
      hapticError();
      const msg = err?.response?.data?.error || 'Registration failed';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSuccess = (user: any) => {
    hapticSuccess();
    toast.success('Signed in with Google!');
    login(user);
    router.replace('/(tabs)/dashboard');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.header}>
            <View style={[styles.logoMark, { backgroundColor: colors.accentPrimary }]}>
              <Text style={styles.logoText}>B</Text>
            </View>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Create Account</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Start creating anonymous chat rooms
            </Text>
          </Animated.View>

          {/* Form Card */}
          <Animated.View
            entering={FadeInDown.delay(200).springify()}
            style={[styles.card, { backgroundColor: colors.surface1, borderColor: colors.borderPrimary }]}
          >
            <GoogleSignInButton onSuccess={handleGoogleSuccess} />
            <AppleSignInButton onSuccess={handleGoogleSuccess} />

            {/* Divider */}
            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: colors.borderPrimary }]} />
              <Text style={[styles.dividerText, { color: colors.textTertiary }]}>or</Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.borderPrimary }]} />
            </View>

            {/* Username Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Username</Text>
              <View style={[styles.inputContainer, { borderColor: colors.borderPrimary, backgroundColor: colors.bgPrimary }]}>
                <TextInput
                  style={[styles.input, { color: colors.textPrimary }]}
                  placeholder="Choose a username"
                  placeholderTextColor={colors.textTertiary}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={20}
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />
              </View>
            </View>

            {/* Password Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Password</Text>
              <View style={[styles.inputContainer, { borderColor: colors.borderPrimary, backgroundColor: colors.bgPrimary }]}>
                <TextInput
                  ref={passwordRef}
                  style={[styles.input, { color: colors.textPrimary, flex: 1 }]}
                  placeholder="Create a password"
                  placeholderTextColor={colors.textTertiary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  returnKeyType="next"
                  onSubmitEditing={() => confirmRef.current?.focus()}
                />
                <Pressable
                  onPress={() => {
                    setShowPassword(!showPassword);
                    hapticLight();
                  }}
                  style={styles.eyeButton}
                  hitSlop={10}
                >
                  {showPassword ? (
                    <EyeOff size={18} color={colors.textTertiary} />
                  ) : (
                    <Eye size={18} color={colors.textTertiary} />
                  )}
                </Pressable>
              </View>
            </View>

            {/* Confirm Password */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Confirm Password</Text>
              <View style={[styles.inputContainer, { borderColor: colors.borderPrimary, backgroundColor: colors.bgPrimary }]}>
                <TextInput
                  ref={confirmRef}
                  style={[styles.input, { color: colors.textPrimary }]}
                  placeholder="Confirm your password"
                  placeholderTextColor={colors.textTertiary}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleRegister}
                />
              </View>
            </View>

            {/* Create Account Button */}
            <Animated.View style={buttonAnimatedStyle}>
              <Pressable
                onPress={handleRegister}
                onPressIn={() => { buttonScale.value = withSpring(0.96); }}
                onPressOut={() => { buttonScale.value = withSpring(1); }}
                disabled={isLoading}
                style={[
                  styles.primaryButton,
                  { backgroundColor: colors.accentPrimary, opacity: isLoading ? 0.6 : 1 },
                ]}
              >
                <UserPlus size={18} color="#fff" strokeWidth={2.2} />
                <Text style={styles.primaryButtonText}>
                  {isLoading ? 'Creating...' : 'Create Account'}
                </Text>
              </Pressable>
            </Animated.View>
          </Animated.View>

          {/* Footer */}
          <Animated.View entering={FadeInUp.delay(400).springify()} style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.textSecondary }]}>
              Already have an account?{' '}
            </Text>
            <Link href="/(auth)/login" asChild>
              <Pressable>
                <Text style={[styles.footerLink, { color: colors.accentPrimary }]}>Sign in</Text>
              </Pressable>
            </Link>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoMark: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoText: {
    fontSize: 24,
    fontFamily: 'Poppins_700Bold',
    color: '#fff',
    marginTop: 2,
  },
  title: {
    fontSize: 26,
    fontFamily: 'Poppins_700Bold',
    letterSpacing: -0.6,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    gap: 16,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 11,
    fontFamily: 'Poppins_500Medium',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontFamily: 'Poppins_500Medium',
    marginLeft: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    height: 50,
  },
  input: {
    flex: 1,
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
  },
  eyeButton: {
    padding: 4,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 14,
    gap: 8,
    marginTop: 4,
  },
  primaryButtonText: {
    color: '#fff',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
  },
  footerLink: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
  },
});
