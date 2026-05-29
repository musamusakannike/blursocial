import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  RefreshControl,
  TextInput,
  Modal,
  Platform,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeOut,
  SlideInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  Layout,
} from 'react-native-reanimated';
import {
  Plus,
  LogOut,
  Trash2,
  MessageCircle,
  Clock,
  Sun,
  Moon,
  Lock,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/Toast';
import { fetchRooms, createRoom, deleteRoom, RoomData } from '@/services/api';
import { hapticLight, hapticMedium, hapticSuccess, hapticError, hapticSelection } from '@/utils/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const { width } = Dimensions.get('window');

export default function DashboardScreen() {
  const { colors, toggleTheme, isDark } = useTheme();
  const { user, logout } = useAuth();
  const toast = useToast();
  const router = useRouter();

  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<RoomData | null>(null);

  // Create room form
  const [roomName, setRoomName] = useState('');
  const [roomPassword, setRoomPassword] = useState('');
  const [roomDuration, setRoomDuration] = useState(0);
  const [isCreating, setIsCreating] = useState(false);

  const loadRooms = useCallback(async () => {
    try {
      const data = await fetchRooms();
      setRooms(data);
    } catch (err: any) {
      toast.error('Failed to load rooms');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    hapticLight();
    loadRooms();
  }, [loadRooms]);

  const handleCreateRoom = async () => {
    if (!roomName.trim()) {
      toast.warning('Room name is required');
      return;
    }
    if (!roomPassword.trim() || roomPassword.length < 4) {
      toast.warning('Password must be at least 4 characters');
      return;
    }

    setIsCreating(true);
    hapticLight();

    try {
      const data = await createRoom(roomName.trim(), roomPassword, roomDuration);
      if (data.room) {
        hapticSuccess();
        toast.success('Room created!');
        setShowCreateModal(false);
        setRoomName('');
        setRoomPassword('');
        setRoomDuration(0);
        loadRooms();
      }
    } catch (err: any) {
      hapticError();
      toast.error(err?.response?.data?.error || 'Failed to create room');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteRoom = async () => {
    if (!selectedRoom) return;
    hapticMedium();
    try {
      await deleteRoom(selectedRoom.slug);
      hapticSuccess();
      toast.success('Room deleted');
      setShowDeleteModal(false);
      setSelectedRoom(null);
      loadRooms();
    } catch (err: any) {
      hapticError();
      toast.error(err?.response?.data?.error || 'Failed to delete room');
    }
  };

  const handleLogout = async () => {
    hapticLight();
    try {
      await logout();
      router.replace('/(auth)/login');
    } catch {
      toast.error('Logout failed');
    }
  };

  const navigateToRoom = (slug: string) => {
    hapticSelection();
    router.push(`/(tabs)/room/${slug}`);
  };

  const renderRoomItem = ({ item, index }: { item: RoomData; index: number }) => {
    const isExpiring = item.expiresAt && new Date(item.expiresAt) > new Date();
    return (
      <Animated.View
        entering={FadeInDown.delay(index * 60).springify().damping(16)}
        layout={Layout.springify()}
      >
        <Pressable
          onPress={() => navigateToRoom(item.slug)}
          onLongPress={() => {
            hapticMedium();
            setSelectedRoom(item);
            setShowDeleteModal(true);
          }}
          style={({ pressed }) => [
            styles.roomCard,
            {
              backgroundColor: colors.surface1,
              borderColor: pressed ? colors.borderAccent : colors.borderPrimary,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
          ]}
        >
          <View style={[styles.roomIcon, { backgroundColor: colors.accentGlow }]}>
            <MessageCircle size={18} color={colors.accentPrimary} strokeWidth={2} />
          </View>
          <View style={styles.roomInfo}>
            <Text style={[styles.roomName, { color: colors.textPrimary }]} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={styles.roomMeta}>
              {isExpiring && (
                <View style={styles.metaTag}>
                  <Clock size={10} color={colors.warning} />
                  <Text style={[styles.metaText, { color: colors.warning }]}>Temporary</Text>
                </View>
              )}
              <Text style={[styles.metaText, { color: colors.textTertiary }]}>
                /{item.slug}
              </Text>
            </View>
          </View>
          <Lock size={14} color={colors.textTertiary} />
        </Pressable>
      </Animated.View>
    );
  };

  const ListHeader = () => (
    <View style={styles.listHeader}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
        Your Rooms ({rooms.length})
      </Text>
    </View>
  );

  const EmptyList = () => (
    <Animated.View entering={FadeInDown.delay(200)} style={styles.emptyContainer}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.surface2 }]}>
        <MessageCircle size={32} color={colors.textTertiary} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>No rooms yet</Text>
      <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
        Create your first anonymous chat room
      </Text>
    </Animated.View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accentPrimary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      {/* Header */}
      <Animated.View entering={FadeInDown.springify()} style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: colors.textTertiary }]}>Welcome back</Text>
          <Text style={[styles.username, { color: colors.textPrimary }]}>
            {user?.username || 'Anonymous'}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => { toggleTheme(); hapticSelection(); }}
            style={[styles.iconButton, { backgroundColor: colors.surface1 }]}
          >
            {isDark ? (
              <Sun size={18} color={colors.textSecondary} />
            ) : (
              <Moon size={18} color={colors.textSecondary} />
            )}
          </Pressable>
          <Pressable
            onPress={handleLogout}
            style={[styles.iconButton, { backgroundColor: colors.surface1 }]}
          >
            <LogOut size={18} color={colors.error} />
          </Pressable>
        </View>
      </Animated.View>

      {/* Room List */}
      <FlatList
        data={rooms}
        renderItem={renderRoomItem}
        keyExtractor={(item) => item.id || item.slug}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={EmptyList}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.accentPrimary}
          />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Floating Create Button */}
      <AnimatedPressable
        entering={FadeInUp.delay(300).springify()}
        onPress={() => { setShowCreateModal(true); hapticLight(); }}
        style={[styles.fab, { backgroundColor: colors.accentPrimary }]}
      >
        <Plus size={22} color="#fff" strokeWidth={2.5} />
      </AnimatedPressable>

      {/* Create Room Modal */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowCreateModal(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[styles.modalContent, { backgroundColor: colors.bgElevated, borderColor: colors.borderPrimary }]}
          >
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Create Room</Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Room Name</Text>
              <TextInput
                style={[styles.modalInput, { color: colors.textPrimary, borderColor: colors.borderPrimary, backgroundColor: colors.bgPrimary }]}
                placeholder="e.g. Study Group"
                placeholderTextColor={colors.textTertiary}
                value={roomName}
                onChangeText={setRoomName}
                maxLength={50}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Password</Text>
              <TextInput
                style={[styles.modalInput, { color: colors.textPrimary, borderColor: colors.borderPrimary, backgroundColor: colors.bgPrimary }]}
                placeholder="Minimum 4 characters"
                placeholderTextColor={colors.textTertiary}
                value={roomPassword}
                onChangeText={setRoomPassword}
                secureTextEntry
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Duration</Text>
              <View style={styles.durationRow}>
                {[
                  { label: 'Permanent', value: 0 },
                  { label: '1h', value: 60 },
                  { label: '24h', value: 1440 },
                  { label: '7d', value: 10080 },
                ].map((opt) => (
                  <Pressable
                    key={opt.value}
                    onPress={() => { setRoomDuration(opt.value); hapticSelection(); }}
                    style={[
                      styles.durationChip,
                      {
                        backgroundColor: roomDuration === opt.value ? colors.accentPrimary : colors.surface1,
                        borderColor: roomDuration === opt.value ? colors.accentPrimary : colors.borderPrimary,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.durationText,
                        { color: roomDuration === opt.value ? '#fff' : colors.textSecondary },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setShowCreateModal(false)}
                style={[styles.modalButton, { backgroundColor: colors.surface1, borderColor: colors.borderPrimary, borderWidth: 1 }]}
              >
                <Text style={[styles.modalButtonText, { color: colors.textSecondary }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleCreateRoom}
                disabled={isCreating}
                style={[styles.modalButton, { backgroundColor: colors.accentPrimary, opacity: isCreating ? 0.6 : 1 }]}
              >
                <Text style={[styles.modalButtonText, { color: '#fff' }]}>
                  {isCreating ? 'Creating...' : 'Create'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowDeleteModal(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[styles.modalContent, { backgroundColor: colors.bgElevated, borderColor: colors.borderPrimary }]}
          >
            <View style={[styles.deleteIconWrap, { backgroundColor: `${colors.error}15` }]}>
              <Trash2 size={24} color={colors.error} />
            </View>
            <Text style={[styles.modalTitle, { color: colors.textPrimary, textAlign: 'center' }]}>
              Delete Room?
            </Text>
            <Text style={[styles.deleteDescription, { color: colors.textSecondary }]}>
              "{selectedRoom?.name}" and all its messages will be permanently deleted.
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setShowDeleteModal(false)}
                style={[styles.modalButton, { backgroundColor: colors.surface1, borderColor: colors.borderPrimary, borderWidth: 1 }]}
              >
                <Text style={[styles.modalButtonText, { color: colors.textSecondary }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleDeleteRoom}
                style={[styles.modalButton, { backgroundColor: colors.error }]}
              >
                <Text style={[styles.modalButtonText, { color: '#fff' }]}>Delete</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  greeting: {
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  username: {
    fontSize: 22,
    fontFamily: 'Poppins_700Bold',
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  listHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Poppins_500Medium',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  roomCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
    gap: 12,
  },
  roomIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomInfo: {
    flex: 1,
    gap: 2,
  },
  roomName: {
    fontSize: 15,
    fontFamily: 'Poppins_600SemiBold',
    letterSpacing: -0.2,
  },
  roomMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaText: {
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 8,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
  },
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowColor: '#FF6B9D',
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    gap: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Poppins_700Bold',
    letterSpacing: -0.3,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontFamily: 'Poppins_500Medium',
    marginLeft: 2,
  },
  modalInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
  },
  durationRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  durationChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  durationText: {
    fontSize: 12,
    fontFamily: 'Poppins_500Medium',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
  },
  deleteIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  deleteDescription: {
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
});
