import { GoogleSignin } from '@react-native-google-signin/google-signin';

// Configure Google Sign-In
// The WEB_CLIENT_ID should come from your Firebase Console:
// Authentication > Sign-in method > Google > Web client ID
GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || 'YOUR_WEB_CLIENT_ID',
  offlineAccess: true,
});
