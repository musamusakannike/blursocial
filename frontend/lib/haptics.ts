/**
 * Web Haptics Utility
 * Uses the Vibration API: https://developer.mozilla.org/en-US/docs/Web/API/Vibration_API
 */

export const Haptics = {
  /**
   * Light impact (similar to iOS light haptic)
   */
  light: () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(10);
    }
  },

  /**
   * Medium impact (similar to iOS medium haptic)
   */
  medium: () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(20);
    }
  },

  /**
   * Success notification pattern
   */
  success: () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([10, 30, 10]);
    }
  },

  /**
   * Error notification pattern
   */
  error: () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([50, 50, 50]);
    }
  },
};
