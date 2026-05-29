import React, { createContext, useContext, useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withDelay,
  runOnJS,
  FadeIn,
  FadeOut,
  SlideInUp,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import * as Haptics from 'expo-device';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
}

interface ToastContextType {
  show: (type: ToastType, title: string, description?: string) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextType>({
  show: () => {},
  success: () => {},
  error: () => {},
  info: () => {},
  warning: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: string) => void }) {
  const { colors } = useTheme();
  const translateX = useSharedValue(0);

  const iconMap = {
    success: CheckCircle2,
    error: XCircle,
    info: Info,
    warning: AlertTriangle,
  };

  const colorMap = {
    success: colors.success,
    error: colors.error,
    info: colors.info,
    warning: colors.warning,
  };

  const bgMap = {
    success: `${colors.success}18`,
    error: `${colors.error}18`,
    info: `${colors.info}18`,
    warning: `${colors.warning}18`,
  };

  const Icon = iconMap[toast.type];
  const tintColor = colorMap[toast.type];
  const bgTint = bgMap[toast.type];

  return (
    <Animated.View
      entering={SlideInUp.springify().damping(18).stiffness(200)}
      exiting={FadeOut.duration(200)}
      style={[
        styles.toastContainer,
        {
          backgroundColor: colors.surface1,
          borderColor: colors.borderPrimary,
          shadowColor: '#000',
        },
      ]}
    >
      <View style={[styles.iconContainer, { backgroundColor: bgTint }]}>
        <Icon size={18} color={tintColor} strokeWidth={2.2} />
      </View>
      <View style={styles.textContainer}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{toast.title}</Text>
        {toast.description && (
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            {toast.description}
          </Text>
        )}
      </View>
      <Pressable
        onPress={() => onDismiss(toast.id)}
        style={[styles.dismissButton, { backgroundColor: colors.surface2 }]}
        hitSlop={8}
      >
        <X size={12} color={colors.textTertiary} strokeWidth={2.5} />
      </Pressable>
    </Animated.View>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const counterRef = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((type: ToastType, title: string, description?: string) => {
    const id = `toast_${++counterRef.current}`;
    setToasts((prev) => [...prev.slice(-2), { id, type, title, description }]);

    setTimeout(() => {
      dismiss(id);
    }, 3500);
  }, [dismiss]);

  const success = useCallback((title: string, description?: string) => show('success', title, description), [show]);
  const error = useCallback((title: string, description?: string) => show('error', title, description), [show]);
  const info = useCallback((title: string, description?: string) => show('info', title, description), [show]);
  const warning = useCallback((title: string, description?: string) => show('warning', title, description), [show]);

  return (
    <ToastContext.Provider value={{ show, success, error, info, warning }}>
      {children}
      <View style={[styles.toastHost, { top: insets.top + 8 }]} pointerEvents="box-none">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  toastHost: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    gap: 8,
  },
  toastContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    gap: 10,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    letterSpacing: -0.2,
  },
  description: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11.5,
    lineHeight: 16,
  },
  dismissButton: {
    width: 22,
    height: 22,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
