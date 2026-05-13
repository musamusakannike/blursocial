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
import { MessageCircle, Plus, Copy, ExternalLink, LogOut } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Button from '@/components/Button';
import Input from '@/components/Input';
import Card from '@/components/Card';
import { Durations } from '@/components/Durations';
import { Colors, Spacing, Radius } from '@/constants/Colors';
import { useToast } from '@/contexts/ToastContext';
import { storage, STORAGE_KEYS } from '@/utils/storage';
import { API_URL } from '@/constants/Config';
import { Room, User } from '@/types';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';

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
      <View style={styles.loadingContainer}>
        <MessageCircle size={48} color={Colors.accent.primary} strokeWidth={2} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <LinearGradient
            colors={[Colors.accent.primary, Colors.accent.secondary]}
            style={styles.headerLogo}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <MessageCircle size={20} color="#fff" strokeWidth={2.5} />
          </LinearGradient>
          <View>
            <Text style={styles.headerTitle}>Blur</Text>
            <Text style={styles.headerUsername}>{user?.username}</Text>
          </View>
        </View>
        <Pressable onPress={handleLogout} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <LogOut size={24} color={Colors.text.secondary} strokeWidth={2} />
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
          />
        }
      >
        <View style={styles.titleContainer}>
          <View>
            <Text style={styles.pageTitle}>Your Chat Rooms</Text>
            <Text style={styles.pageSubtitle}>Create and manage your anonymous chat rooms</Text>
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
              <MessageCircle size={48} color={Colors.accent.primary} strokeWidth={2} />
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
            {rooms.map((room) => (
              <Card key={room.id} style={styles.roomCard}>
                <Text style={styles.roomName} numberOfLines={1}>
                  {room.name}
                </Text>
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
                    <Copy size={16} color={Colors.text.primary} strokeWidth={2} />
                  </Button>
                  <Button
                    onPress={() => router.push(`/room/${room.slug}`)}
                    variant="primary"
                    size="sm"
                    style={styles.roomActionButton}
                  >
                    <ExternalLink size={16} color="#fff" strokeWidth={2} />
                  </Button>
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>

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
                placeholder="e.g., Team Discussion"
                value={roomName}
                onChangeText={setRoomName}
                autoCapitalize="words"
              />
              <Input
                label="Room Password"
                placeholder="Set a password for the room"
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
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
    alignItems: 'center',
    justifyContent: 'center',
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
    gap: Spacing.sm + 4,
  },
  headerLogo: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Manrope_600SemiBold',
    color: Colors.text.primary,
  },
  headerUsername: {
    fontSize: 12,
    fontFamily: 'Manrope_400Regular',
    color: Colors.text.secondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  titleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  pageTitle: {
    fontSize: 28,
    fontFamily: 'Manrope_700Bold',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  pageSubtitle: {
    fontSize: 14,
    fontFamily: 'Manrope_400Regular',
    color: Colors.text.secondary,
  },
  createButton: {
    borderRadius: Radius.md,
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
    width: 80,
    height: 80,
    borderRadius: Radius.full,
    backgroundColor: Colors.accent.glow,
    alignItems: 'center',
    justifyContent: 'center',
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
    gap: Spacing.md,
  },
  roomCard: {
    padding: Spacing.lg,
  },
  roomName: {
    fontSize: 18,
    fontFamily: 'Manrope_600SemiBold',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  roomDate: {
    fontSize: 12,
    fontFamily: 'Manrope_400Regular',
    color: Colors.text.tertiary,
    marginBottom: Spacing.md,
  },
  roomActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  roomActionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: Colors.bg.secondary,
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
  },
  modalForm: {
    gap: Spacing.lg,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.sm + 4,
    marginTop: Spacing.sm,
  },
  modalActionButton: {
    flex: 1,
  },
});
