import React, { useState } from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator, View, Platform } from 'react-native';
import auth from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/components/Toast';
import { googleAuth } from '@/services/api';
import { hapticLight } from '@/utils/haptics';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

interface GoogleSignInButtonProps {
  onSuccess: (user: any) => void;
}

export default function GoogleSignInButton({ onSuccess }: GoogleSignInButtonProps) {
  const { colors } = useTheme();
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    hapticLight();
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const signInResult = await GoogleSignin.signIn();
      const idToken = signInResult?.data?.idToken;

      if (!idToken) {
        toast.error('Failed to get Google token');
        return;
      }

      // Create Firebase credential and sign in to get a Firebase idToken
      const googleCredential = auth.GoogleAuthProvider.credential(idToken);
      const userCredential = await auth().signInWithCredential(googleCredential);
      const firebaseIdToken = await userCredential.user.getIdToken();

      // Send Firebase idToken to our backend
      const data = await googleAuth(firebaseIdToken);
      if (data.success) {
        onSuccess(data.user);
      } else {
        toast.error(data.error || 'Google sign-in failed');
      }
    } catch (error: any) {
      if (
        error?.code === 'SIGN_IN_CANCELLED' ||
        error?.code === '12501' ||
        error?.message?.includes('canceled')
      ) {
        return;
      }
      console.error('Google sign-in error:', error);
      toast.error('Google sign-in failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={handleGoogleSignIn}
        onPressIn={() => { scale.value = withSpring(0.97); }}
        onPressOut={() => { scale.value = withSpring(1); }}
        disabled={isLoading}
        style={[
          styles.button,
          {
            backgroundColor: colors.surface2,
            borderColor: colors.borderPrimary,
            opacity: isLoading ? 0.6 : 1,
          },
        ]}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={colors.textPrimary} />
        ) : (
          <GoogleIcon />
        )}
        <Text style={[styles.text, { color: colors.textPrimary }]}>
          Continue with Google
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function GoogleIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <Path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <Path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <Path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  text: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
  },
});
