import React, { useState } from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import auth from '@react-native-firebase/auth';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/components/Toast';
import { googleAuth } from '@/services/api';
import { hapticLight } from '@/utils/haptics';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

interface AppleSignInButtonProps {
  onSuccess: (user: any) => void;
}

export default function AppleSignInButton({ onSuccess }: AppleSignInButtonProps) {
  const { colors, isDark } = useTheme();
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (Platform.OS !== 'ios') return null;

  const handleAppleSignIn = async () => {
    setIsLoading(true);
    hapticLight();
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        toast.error('Apple sign-in failed');
        return;
      }

      // Create Firebase credential from Apple credential
      const { identityToken, authorizationCode } = credential;
      const appleCredential = auth.AppleAuthProvider.credential(
        identityToken,
        authorizationCode || ''
      );
      const userCredential = await auth().signInWithCredential(appleCredential);
      const firebaseIdToken = await userCredential.user.getIdToken();

      // Send to our backend (reusing google auth endpoint which accepts any Firebase idToken)
      const data = await googleAuth(firebaseIdToken);
      if (data.success) {
        onSuccess(data.user);
      } else {
        toast.error(data.error || 'Apple sign-in failed');
      }
    } catch (error: any) {
      if (error?.code === 'ERR_REQUEST_CANCELED') {
        return;
      }
      console.error('Apple sign-in error:', error);
      toast.error('Apple sign-in failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={handleAppleSignIn}
        onPressIn={() => { scale.value = withSpring(0.97); }}
        onPressOut={() => { scale.value = withSpring(1); }}
        disabled={isLoading}
        style={[
          styles.button,
          {
            backgroundColor: isDark ? '#fff' : '#000',
            opacity: isLoading ? 0.6 : 1,
          },
        ]}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={isDark ? '#000' : '#fff'} />
        ) : (
          <AppleIcon color={isDark ? '#000' : '#fff'} />
        )}
        <Text style={[styles.text, { color: isDark ? '#000' : '#fff' }]}>
          Continue with Apple
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function AppleIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill={color}>
      <Path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
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
    gap: 10,
  },
  text: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
  },
});
