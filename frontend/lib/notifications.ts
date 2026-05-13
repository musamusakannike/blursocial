/**
 * Web Notification Utility
 */

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.warn('This browser does not support desktop notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
};

export const showNotification = (title: string, options?: NotificationOptions) => {
  if (typeof window === 'undefined' || !('Notification' in window)) return;

  if (Notification.permission === 'granted' && document.hidden) {
    const notification = new Notification(title, {
      icon: '/icon.png', // Assuming icon exists
      ...options,
    });

    notification.onclick = function() {
      window.focus();
      this.close();
    };
  }
};

const NOTIFICATION_PREF_PREFIX = 'blur-notifications:';

export const isNotificationEnabledForRoom = (slug: string): boolean => {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(`${NOTIFICATION_PREF_PREFIX}${slug}`) === 'true';
};

export const setNotificationForRoom = (slug: string, enabled: boolean) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(`${NOTIFICATION_PREF_PREFIX}${slug}`, String(enabled));
};
