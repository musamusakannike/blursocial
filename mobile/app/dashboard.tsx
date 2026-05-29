import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Plus, Copy, ExternalLink, LogOut, Clock, Infinity as InfinityIcon } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import Button from '@/components/Button';
import Input from '@/components/Input';
import Card from '@/components/Card';
import { Durations } from '@/components/Durations';
import Logo from '@/components/Logo';
import { Colors, Spacing, Radius } from '@/constants/Colors';
import { useToast } from '@/contexts/ToastContext';
import { storage, STORAGE_KEYS } from '@/utils/storage';
import { API_URL } from '@/constants/Config';
import { Room, User } from '@/types';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';

// Custom Skeleton Pulse Card for Loading State
const SkeletonCard: React.FC<{ index: number }> = ({ index }) => {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withDelay(
      index * 100,
      withRepeat(withTiming(0.7, { duration: 800 }), -1, true)
    );
  }, [index]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Card style={styles.roomCard}>
      <Animated.View style={[styles.skeletonTitle, animatedStyle]} />
      <Animated.View style={[styles.skeletonSubtitle, animatedStyle]} />
      <View style={styles.roomActions}>
        <Animated.View style={[styles.skeletonButton, animatedStyle]} />
        <Animated.View style={[styles.skeletonButton, animatedStyle]} />
      </View>
    </Card>
  );
};

export default function DashboardScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [roomPassword, setRoomPassword] = useState('');
  const [roomDuration, setRoomDuration] = useState(24);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const userData = await storage.getItem(STORAGE_KEYS.USER);
      if (!userData) {
        router.replace('/');
        return;
      }
      setUser(JSON.parse(userData));
      await fetchRooms();
    } catch (error) {
      router.replace('/');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRooms = async () => {
    try {
      const response = await fetch(`${API_URL}/api/rooms`);
      const data = await response.json();

      if (response.ok) {
        setRooms(data.rooms);
      }
    } catch (error) {
      showToast('Failed to fetch rooms', 'error');
    }
  };

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchRooms();
    setIsRefreshing(false);
  }, []);

  const handleCreateRoom = async () => {
    if (!roomName.trim() || !roomPassword.trim()) {
      showToast('Please fill in all fields', 'error');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (roomName.length < 3) {
      showToast('Room name must be at least 3 characters', 'error');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (roomPassword.length < 4) {
      showToast('Password must be at least 4 characters', 'error');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setIsCreating(true);

    try {
      const response = await fetch(`${API_URL}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: roomName, 
          password: roomPassword,
          duration: roomDuration
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        showToast(data.error || 'Failed to create room', 'error');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      showToast('Room created successfully!', 'success');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setRooms([data.room, ...rooms]);
      setShowCreateModal(false);
      setRoomName('');
      setRoomPassword('');
    } catch (error) {
      showToast('Something went wrong', 'error');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleLogout = async () => {
    try {
      await storage.removeItem(STORAGE_KEYS.USER);
      showToast('Logged out successfully', 'success');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/');
    } catch (error) {
      showToast('Failed to logout', 'error');
    }
  };

  const copyRoomLink = async (slug: string) => {
    const link = `blur://room/${slug}`;
    await Clipboard.setStringAsync(link);
    showToast('Link copied to clipboard!', 'success');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Skeleton navbar */}
        <View style={styles.header}>
          <Logo size="sm" />
          <View style={styles.skeletonCircle} />
        </View>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.titleContainer}>
            <View>
              <View style={styles.skeletonTextTitle} />
              <View style={styles.skeletonTextSubtitle} />
            </View>
            <View style={styles.skeletonSquare} />
          </View>
          <View style={styles.roomsGrid}>
            <SkeletonCard index={0} />
            <SkeletonCard index={1} />
            <SkeletonCard index={2} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Navigation header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Logo size="sm" />
          <Text style={styles.headerUsername}>• {user?.username}</Text>
        </View>
        <Pressable
          onPress={handleLogout}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.logoutButton}
        >
          <LogOut size={20} color={Colors.text.secondary} strokeWidth={2.5} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.accent.primary}
            colors={[Colors.accent.primary]}
          />
        }
      >
        <View style={styles.titleContainer}>
          <View>
            <Text style={styles.pageTitle}>Chat Rooms</Text>
            <Text style={styles.pageSubtitle}>Create and manage your private chat spaces</Text>
          </View>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setShowCreateModal(true);
            }}
            style={styles.createButton}
          >
            <LinearGradient
              colors={[Colors.accent.primary, Colors.accent.secondary]}
              style={styles.createButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Plus size={24} color="#fff" strokeWidth={2.5} />
            </LinearGradient>
          </Pressable>
        </View>

        {rooms.length === 0 ? (
          <Card style={styles.emptyCard}>
            <View style={styles.emptyIconContainer}>
              <Logo size="lg" />
            </View>
            <Text style={styles.emptyTitle}>No rooms yet</Text>
            <Text style={styles.emptySubtitle}>Create your first chat room to get started</Text>
            <Button
              onPress={() => setShowCreateModal(true)}
              size="md"
              style={styles.emptyButton}
            >
              Create Your First Room
            </Button>
          </Card>
        ) : (
          <View style={styles.roomsGrid}>
            {rooms.map((room) => {
              const isPermanent = room.duration === 0;

              return (
                <Card key={room.id} style={styles.roomCard}>
                  <View style={styles.roomCardHeader}>
                    <Text style={styles.roomName} numberOfLines={1}>
                      {room.name}
                    </Text>
                    {/* Badge container */}
                    <View
                      style={[
                        styles.badge,
                        isPermanent ? styles.badgePermanent : styles.badgeTemporary,
                      ]}
                    >
                      {isPermanent ? (
                        <InfinityIcon size={12} color={Colors.status.success} style={styles.badgeIcon} />
                      ) : (
                        <Clock size={12} color={Colors.accent.primary} style={styles.badgeIcon} />
                      )}
                      <Text
                        style={[
                          styles.badgeText,
                          isPermanent ? styles.badgeTextPermanent : styles.badgeTextTemporary,
                        ]}
                      >
                        {isPermanent ? 'PERMANENT' : 'TEMPORARY'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.roomDate}>
                    Created {new Date(room.createdAt).toLocaleDateString()}
                  </Text>
                  <View style={styles.roomActions}>
                    <Button
                      onPress={() => copyRoomLink(room.slug)}
                      variant="secondary"
                      size="sm"
                      style={styles.roomActionButton}
                    >
                      <Copy size={16} color={Colors.text.primary} strokeWidth={2.5} />
                    </Button>
                    <Button
                      onPress={() => router.push(`/room/${room.slug}`)}
                      variant="primary"
                      size="sm"
                      style={styles.roomActionButton}
                    >
                      <ExternalLink size={16} color="#fff" strokeWidth={2.5} />
                    </Button>
                  </View>
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Modal Overhaul */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setShowCreateModal(false)} />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create New Room</Text>
            <View style={styles.modalForm}>
              <Input
                label="Room Name"
                placeholder="e.g., Team Sync"
                value={roomName}
                onChangeText={setRoomName}
                autoCapitalize="words"
              />
              <Input
                label="Room Password"
                placeholder="Set access password"
                value={roomPassword}
                onChangeText={setRoomPassword}
                secureTextEntry
                autoCapitalize="none"
              />
              <Durations 
                value={roomDuration}
                onChange={setRoomDuration}
              />
              <View style={styles.modalActions}>
                <Button
                  onPress={() => setShowCreateModal(false)}
                  variant="ghost"
                  size="md"
                  style={styles.modalActionButton}
                >
                  Cancel
                </Button>
                <Button
                  onPress={handleCreateRoom}
                  isLoading={isCreating}
                  size="md"
                  style={styles.modalActionButton}
                >
                  Create Room
                </Button>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.bg.secondary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.primary,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerUsername: {
    fontSize: 13,
    fontFamily: 'Manrope_500Medium',
    color: Colors.text.tertiary,
    marginLeft: Spacing.xs,
  },
  logoutButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl + 40,
  },
  titleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  pageTitle: {
    fontSize: 28,
    fontFamily: 'Manrope_700Bold',
    color: Colors.text.primary,
    marginBottom: 2,
    letterSpacing: -0.8,
  },
  pageSubtitle: {
    fontSize: 14,
    fontFamily: 'Manrope_400Regular',
    color: Colors.text.secondary,
  },
  createButton: {
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  createButtonGradient: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    padding: Spacing.xxl,
    alignItems: 'center',
  },
  emptyIconContainer: {
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: 'Manrope_600SemiBold',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Manrope_400Regular',
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  emptyButton: {
    marginTop: Spacing.sm,
  },
  roomsGrid: {
    gap: Spacing.md + 2,
  },
  roomCard: {
    padding: Spacing.lg,
    backgroundColor: 'rgba(18, 22, 26, 0.65)',
  },
  roomCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: 4,
  },
  roomName: {
    flex: 1,
    fontSize: 18,
    fontFamily: 'Manrope_600SemiBold',
    color: Colors.text.primary,
    letterSpacing: -0.2,
  },
  roomDate: {
    fontSize: 12,
    fontFamily: 'Manrope_400Regular',
    color: Colors.text.tertiary,
    marginBottom: Spacing.md,
  },
  roomActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  roomActionButton: {
    flex: 1,
    borderRadius: Radius.full,
  },
  // Badge Styles (matching web)
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  badgeIcon: {
    marginRight: 4,
  },
  badgePermanent: {
    backgroundColor: 'rgba(78, 205, 196, 0.08)',
    borderColor: 'rgba(78, 205, 196, 0.3)',
  },
  badgeTemporary: {
    backgroundColor: 'rgba(255, 107, 157, 0.08)',
    borderColor: 'rgba(255, 107, 157, 0.3)',
  },
  badgeText: {
    fontSize: 10,
    fontFamily: 'Manrope_700Bold',
    letterSpacing: 0.5,
  },
  badgeTextPermanent: {
    color: Colors.status.success,
  },
  badgeTextTemporary: {
    color: Colors.accent.primary,
  },
  // Modal Overhaul Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: 'rgba(18, 22, 26, 0.98)',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border.primary,
    padding: Spacing.xl,
  },
  modalTitle: {
    fontSize: 24,
    fontFamily: 'Manrope_700Bold',
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
    letterSpacing: -0.6,
  },
  modalForm: {
    gap: Spacing.lg,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  modalActionButton: {
    flex: 1,
  },
  // Skeleton Styles
  skeletonCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  skeletonSquare: {
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  skeletonTextTitle: {
    width: 140,
    height: 24,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 6,
  },
  skeletonTextSubtitle: {
    width: 220,
    height: 14,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  skeletonTitle: {
    width: '50%',
    height: 18,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: Spacing.sm,
  },
  skeletonSubtitle: {
    width: '30%',
    height: 12,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: Spacing.lg,
  },
  skeletonButton: {
    flex: 1,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
});
