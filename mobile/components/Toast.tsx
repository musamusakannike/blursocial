import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react-native';
import { Colors, Radius, Spacing, Shadows } from '@/constants/Colors';
import { ToastMessage } from '@/types';
import * as Haptics from 'expo-haptics';

interface ToastProps {
  toast: ToastMessage;
  onRemove: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ toast, onRemove }) => {
  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);

  useEffect(() => {
    Haptics.notificationAsync(
      toast.type === 'success'
        ? Haptics.NotificationFeedbackType.Success
        : toast.type === 'error'
        ? Haptics.NotificationFeedbackType.Error
        : Haptics.NotificationFeedbackType.Warning
    );

    translateY.value = withSpring(0, {
      damping: 15,
      stiffness: 150,
    });
    opacity.value = withTiming(1, { duration: 250 });

    return () => {
      translateY.value = withTiming(-100, { duration: 200 });
      opacity.value = withTiming(0, { duration: 200 });
    };
  }, []);

  const handleClose = () => {
    translateY.value = withTiming(-100, { duration: 200 }, () => {
      runOnJS(onRemove)(toast.id);
    });
    opacity.value = withTiming(0, { duration: 200 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const getIcon = () => {
    const iconProps = { size: 20, strokeWidth: 2.5 };
    switch (toast.type) {
      case 'success':
        return <CheckCircle {...iconProps} color={Colors.status.success} />;
      case 'error':
        return <XCircle {...iconProps} color={Colors.status.error} />;
      case 'warning':
        return <AlertTriangle {...iconProps} color={Colors.status.warning} />;
      default:
        return <Info {...iconProps} color={Colors.status.info} />;
    }
  };

  const getBorderColor = () => {
    switch (toast.type) {
      case 'success':
        return 'rgba(78, 205, 196, 0.3)';
      case 'error':
        return 'rgba(255, 107, 107, 0.3)';
      case 'warning':
        return 'rgba(255, 230, 109, 0.3)';
      default:
        return 'rgba(107, 157, 255, 0.3)';
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        animatedStyle,
        {
          borderColor: getBorderColor(),
        },
      ]}
    >
      <View style={styles.iconContainer}>{getIcon()}</View>
      <Text style={styles.message} numberOfLines={2}>
        {toast.message}
      </Text>
      <Pressable
        onPress={handleClose}
        style={styles.closeButton}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <X size={16} color={Colors.text.tertiary} strokeWidth={2.5} />
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md + 2,
    paddingVertical: Spacing.md - 2,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
    backgroundColor: 'rgba(18, 22, 26, 0.96)', // luxurious dark canvas base background
    ...Shadows.lg,
  },
  iconContainer: {
    marginRight: Spacing.sm + 2,
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Manrope_500Medium',
    color: Colors.text.primary,
    lineHeight: 20,
    letterSpacing: -0.1,
  },
  closeButton: {
    marginLeft: Spacing.sm,
    padding: 2,
  },
});

export default Toast;
