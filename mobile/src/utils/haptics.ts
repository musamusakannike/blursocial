import { Platform } from 'react-native';

let Haptics: typeof import('expo-haptics') | null = null;

async function loadHaptics() {
  if (Platform.OS !== 'web') {
    Haptics = await import('expo-haptics');
  }
}

loadHaptics();

export const hapticLight = () => {
  Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

export const hapticMedium = () => {
  Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
};

export const hapticHeavy = () => {
  Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
};

export const hapticSuccess = () => {
  Haptics?.notificationAsync(Haptics.NotificationFeedbackType.Success);
};

export const hapticError = () => {
  Haptics?.notificationAsync(Haptics.NotificationFeedbackType.Error);
};

export const hapticWarning = () => {
  Haptics?.notificationAsync(Haptics.NotificationFeedbackType.Warning);
};

export const hapticSelection = () => {
  Haptics?.selectionAsync();
};
