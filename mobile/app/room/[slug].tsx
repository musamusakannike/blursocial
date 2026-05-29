import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Ably from 'ably';
import { ArrowLeft, Send, Smile, X, CornerUpLeft, Users, ArrowDown, Copy, EyeOff } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import uuid from 'react-native-uuid';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
} from 'react-native-reanimated';

import { LinearGradient } from 'expo-linear-gradient';
import Button from '@/components/Button';
import Input from '@/components/Input';
import Card from '@/components/Card';
import Logo from '@/components/Logo';
import { Colors, Spacing, Radius, Shadows } from '@/constants/Colors';
import { useToast } from '@/contexts/ToastContext';
import { API_URL, SOCKET_URL } from '@/constants/Config';
import { Message, ReactionSummary } from '@/types';
import { storage, STORAGE_KEYS } from '@/utils/storage';
import {
  registerForPushNotificationsAsync,
  isNotificationEnabledForRoom,
  setNotificationForRoom,
  scheduleLocalNotification,
} from '@/utils/notifications';
import * as Haptics from 'expo-haptics';
import { getSpectralProfile } from '@/utils/avatar';

const QUICK_REACTIONS = ['👍', '😂', '❤️', '🔥', '🎉', '😮'];

// Custom wrapper to add slide up & scale spring entrances to each new message (animate-message)
const AnimatedMessageItem: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const scale = useSharedValue(0.92);
  const translateY = useSharedValue(12);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 160 });
    translateY.value = withSpring(0, { damping: 15, stiffness: 160 });
    opacity.value = withTiming(1, { duration: 250 });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
};

export default function RoomScreen() {
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { showToast } = useToast();

  const [isVerifying, setIsVerifying] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [password, setPassword] = useState('');
  const [roomName, setRoomName] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [realtime, setRealtime] = useState<any>(null);
  const [clientId, setClientId] = useState<string>('');
  const [clientHash, setClientHash] = useState<string>('');
  const [activeReactionPicker, setActiveReactionPicker] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [isGhostMode, setIsGhostMode] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [hasAskedNotifications, setHasAskedNotifications] = useState(false);
  const [onlineCount, setOnlineCount] = useState<number | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastReadMessageIndex, setLastReadMessageIndex] = useState<number | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const isAtBottomRef = useRef(true);
  const messagesRef = useRef<Message[]>([]);

  // Glow position animation for password gate
  const glowTranslateX = useSharedValue(0);
  const glowScale = useSharedValue(1);

  useEffect(() => {
    glowTranslateX.value = withRepeat(withTiming(30, { duration: 6000 }), -1, true);
    glowScale.value = withRepeat(withTiming(1.15, { duration: 8000 }), -1, true);
  }, []);

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isAtBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 100;
    isAtBottomRef.current = isAtBottom;
    setShowScrollButton(!isAtBottom);
    
    if (isAtBottom) {
      setUnreadCount(0);
      setLastReadMessageIndex(messages.length - 1);
    }
  };

  const scrollToBottom = () => {
    flatListRef.current?.scrollToEnd({ animated: true });
    isAtBottomRef.current = true;
    setShowScrollButton(false);
    setUnreadCount(0);
    setLastReadMessageIndex(messages.length - 1);
  };

  useEffect(() => {
    verifyRoom();
    initializeClientId();
  }, []);

  useEffect(() => {
    if (isVerified) {
      connectAbly();
      checkNotificationPreference();
    }

    return () => {
      if (realtime) {
        realtime.close();
      }
    };
  }, [isVerified, realtime]);

  const initializeClientId = async () => {
    let id = await storage.getItem(STORAGE_KEYS.CLIENT_ID);
    if (!id) {
      id = uuid.v4() as string;
      await storage.setItem(STORAGE_KEYS.CLIENT_ID, id);
    }
    setClientId(id);

    const hash = await hashClientId(id);
    setClientHash(hash);
  };

  const hashClientId = async (id: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(id);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  };

  const verifyRoom = async () => {
    try {
      const response = await fetch(`${API_URL}/api/rooms/${slug}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (response.ok) {
        setRoomName(data.room.name);
        setIsVerified(true);
        await fetchMessages();
      } else {
        setIsVerifying(false);
      }
    } catch (error) {
      setIsVerifying(false);
      showToast('Failed to connect to room', 'error');
    }
  };

  const handleVerify = async () => {
    if (!password.trim()) {
      showToast('Please enter the room password', 'error');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setIsVerifying(true);
    await verifyRoom();
  };

  const fetchMessages = async () => {
    try {
      const response = await fetch(`${API_URL}/api/rooms/${slug}/messages`);
      const data = await response.json();

      if (response.ok) {
        setMessages(data.messages);
        messagesRef.current = data.messages;
        setLastReadMessageIndex(data.messages.length - 1);
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  const connectAbly = () => {
    if (!clientId) return;

    const newRealtime = new Ably.Realtime({
      authUrl: `${API_URL}/api/ably-auth?clientId=${encodeURIComponent(clientId)}`,
    });

    const channel = newRealtime.channels.get(`room:${slug}`);

    newRealtime.connection.on('connected', async () => {
      console.log('Ably connected');
      try {
        await channel.presence.enter();
        const members = await channel.presence.get();
        setOnlineCount(members.length);
      } catch (err) {
        console.error('Failed to enter presence:', err);
      }
    });

    // Track online count via Presence
    channel.presence.subscribe(() => {
      channel.presence.get().then((members) => {
        setOnlineCount(members.length);
      }).catch((err) => {
        console.error('Failed to get presence members:', err);
      });
    });

    // Subscribe to message broadcasts
    channel.subscribe('new-message', (messageEvent) => {
      const message = messageEvent.data as Message;
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.tempId !== message.tempId);
        return [...filtered, message];
      });

      if (notificationsEnabled) {
        scheduleLocalNotification(
          `New message in ${roomName}`,
          message.content.substring(0, 100),
          { roomSlug: slug }
        );
      }

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    // Subscribe to reaction broadcasts
    channel.subscribe('message-reactions-updated', (messageEvent) => {
      const payload = messageEvent.data as { messageId: string; reactions: ReactionSummary[] };
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === payload.messageId ? { ...msg, reactions: payload.reactions } : msg
        )
      );
    });

    newRealtime.connection.on('failed', () => {
      showToast('Real-time connection failed', 'error');
    });

    setRealtime(newRealtime);
  };

  const checkNotificationPreference = async () => {
    const enabled = await isNotificationEnabledForRoom(slug);
    setNotificationsEnabled(enabled);

    if (!enabled && !hasAskedNotifications) {
      setTimeout(() => {
        askForNotifications();
      }, 2000);
    }
  };

  const askForNotifications = () => {
    Alert.alert(
      'Enable Notifications?',
      `Would you like to receive push notifications for new messages in "${roomName}"?`,
      [
        {
          text: 'No Thanks',
          style: 'cancel',
          onPress: () => {
            setHasAskedNotifications(true);
            setNotificationForRoom(slug, false);
          },
        },
        {
          text: 'Enable',
          onPress: async () => {
            const token = await registerForPushNotificationsAsync();
            if (token) {
              setNotificationsEnabled(true);
              setHasAskedNotifications(true);
              await setNotificationForRoom(slug, true);
              showToast('Notifications enabled!', 'success');
            } else {
              showToast('Failed to enable notifications', 'error');
            }
          },
        },
      ]
    );
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    const tempId = uuid.v4() as string;
    const activeHash = isGhostMode ? null : clientHash;
    const optimisticMessage: Message = {
      id: tempId,
      content: newMessage.trim(),
      timestamp: new Date(),
      tempId,
      isOptimistic: true,
      reactions: [],
      senderHash: activeHash,
      ...(replyingTo && {
        replyTo: {
          messageId: replyingTo.id,
          preview: replyingTo.content.substring(0, 100),
        },
      }),
    };

    setMessages((prev) => {
      const next = [...prev, optimisticMessage];
      messagesRef.current = next;
      return next;
    });
    const messageContent = newMessage.trim();
    setNewMessage('');
    setReplyingTo(null);

    try {
      const response = await fetch(`${API_URL}/api/rooms/${slug}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: messageContent,
          tempId,
          senderHash: activeHash,
          ...(replyingTo && {
            replyTo: {
              messageId: replyingTo.id,
              preview: replyingTo.content.substring(0, 100),
            },
          }),
        }),
      });

      if (!response.ok) throw new Error('Failed to send message');
    } catch (err) {
      showToast('Failed to send message', 'error');
      // Revert optimistic insert
      setMessages((prev) => prev.filter((m) => m.tempId !== tempId));
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scrollToBottom();
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!clientId) return;

    const message = messages.find((m) => m.id === messageId);
    if (!message) return;

    const existingReaction = message.reactions.find((r) => r.emoji === emoji);
    const action = existingReaction?.reacted ? 'remove' : 'add';

    // Optimistic UI update
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== messageId) return msg;
        const updatedReactions = msg.reactions.map((r) => {
          if (r.emoji !== emoji) return r;
          const nextCount = action === 'add' ? r.count + 1 : Math.max(r.count - 1, 0);
          return {
            ...r,
            count: nextCount,
            reacted: action === 'add' ? true : nextCount > 0 ? r.reacted : false,
          };
        }).filter((r) => r.count > 0);

        const found = msg.reactions.some((r) => r.emoji === emoji);
        if (!found && action === 'add') {
          updatedReactions.push({ emoji, count: 1, reacted: true });
        }
        return { ...msg, reactions: updatedReactions };
      })
    );

    setActiveReactionPicker(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const response = await fetch(`${API_URL}/api/rooms/${slug}/messages/${messageId}/reactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': clientId,
        },
        body: JSON.stringify({ emoji, action }),
      });

      if (!response.ok) throw new Error('Failed to update reaction');
    } catch (err) {
      showToast('Failed to update reaction', 'error');
      fetchMessages();
    }
  };

  const handleCopyMessage = async (content: string) => {
    await Clipboard.setStringAsync(content);
    showToast('Message copied!', 'success');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isFirstInGroup =
      index === 0 ||
      new Date(messages[index - 1].timestamp).getTime() - new Date(item.timestamp).getTime() >
        60000;

    const showUnreadDivider = lastReadMessageIndex !== null && index === lastReadMessageIndex + 1;

    const isGhost = !item.senderHash;
    const profile = !isGhost ? getSpectralProfile(item.senderHash) : null;

    return (
      <AnimatedMessageItem>
        {showUnreadDivider && (
          <View style={styles.unreadDivider}>
            <View style={styles.unreadDividerLine} />
            <View style={styles.unreadBadge}>
              <View style={styles.unreadDot} />
              <Text style={styles.unreadText}>UNREAD MESSAGES</Text>
            </View>
            <View style={styles.unreadDividerLine} />
          </View>
        )}
        <View style={styles.messageContainer}>
          {isFirstInGroup && (
            <Text style={styles.messageTime}>
              {new Date(item.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          )}

          <View style={styles.messageRow}>
            {/* Avatar Column */}
            {!isGhost && profile ? (
              <LinearGradient
                colors={[profile.gradient.start, profile.gradient.end]}
                style={styles.avatarGradient}
              >
                <Text style={styles.avatarText}>{profile.initials}</Text>
              </LinearGradient>
            ) : (
              <View style={styles.ghostAvatar}>
                <EyeOff size={12} color={Colors.text.tertiary} style={{ opacity: 0.5 }} />
              </View>
            )}

            {/* Bubble Column */}
            <View style={styles.bubbleColumn}>
              {/* Visual Alias Name */}
              {!isGhost && profile && (
                <Text style={[styles.aliasText, { color: profile.gradient.start }]}>
                  {profile.alias}
                </Text>
              )}

              <Pressable
                onLongPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setActiveReactionPicker(item.id);
                }}
                style={[
                  styles.messageBubble, 
                  isGhost && styles.ghostMessageBubble,
                  item.isOptimistic && styles.optimisticMessage
                ]}
              >
                {item.replyTo && (
                  <View style={styles.replyPreview}>
                    <CornerUpLeft size={12} color={Colors.text.tertiary} strokeWidth={2.5} style={{ marginRight: 4 }} />
                    <Text style={styles.replyText} numberOfLines={1}>
                      {item.replyTo.preview}
                    </Text>
                  </View>
                )}
                <Text style={styles.messageText}>{item.content}</Text>
                {item.reactions.length > 0 && (
                  <View style={styles.reactionsContainer}>
                    {item.reactions.map((reaction, idx) => (
                      <Pressable
                        key={idx}
                        onPress={() => handleReaction(item.id, reaction.emoji)}
                        style={[
                          styles.reactionBadge,
                          reaction.reacted && styles.reactionBadgeActive,
                        ]}
                      >
                        <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
                        <Text
                          style={[
                            styles.reactionCount,
                            reaction.reacted && styles.reactionCountActive,
                          ]}
                        >
                          {reaction.count}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </Pressable>

              <View style={styles.messageActions}>
                <Pressable
                  onPress={() => {
                    setReplyingTo(item);
                    inputRef.current?.focus();
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={styles.messageActionBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <CornerUpLeft size={14} color={Colors.text.tertiary} strokeWidth={2.5} />
                </Pressable>
                <Pressable
                  onPress={() => {
                    setActiveReactionPicker(item.id);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={styles.messageActionBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Smile size={14} color={Colors.text.tertiary} strokeWidth={2.5} />
                </Pressable>
                <Pressable
                  onPress={() => handleCopyMessage(item.content)}
                  style={styles.messageActionBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Copy size={14} color={Colors.text.tertiary} strokeWidth={2.5} />
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </AnimatedMessageItem>
    );
  };

  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: glowTranslateX.value }, { scale: glowScale.value }],
  }));

  if (!isVerified) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Background glow overlay */}
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
          <Animated.View style={[styles.radialGlow, glowStyle]} />
          <LinearGradient
            colors={['transparent', Colors.bg.primary]}
            style={StyleSheet.absoluteFillObject}
          />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.verifyContainer}
        >
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft size={24} color={Colors.text.primary} strokeWidth={2.5} />
          </Pressable>

          <View style={styles.verifyHeader}>
            <Logo size="lg" />
            <Text style={styles.verifyTitle}>Room Protected</Text>
            <Text style={styles.verifySubtitle}>Enter the room password to join the chat</Text>
          </View>

          <Card style={styles.verifyCard}>
            <Input
              label="Password"
              placeholder="Enter the room password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              style={styles.verifyInput}
            />
            <Button
              onPress={handleVerify}
              isLoading={isVerifying}
              size="lg"
              style={styles.verifyBtn}
            >
              Join Room
            </Button>
          </Card>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header bar */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.headerCircleBtn}
        >
          <ArrowLeft size={20} color={Colors.text.primary} strokeWidth={2.5} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {roomName}
          </Text>
          <View style={styles.headerStatusContainer}>
            {onlineCount !== null && (
              <View style={styles.onlineCountContainer}>
                <Users size={12} color={Colors.text.tertiary} strokeWidth={2.5} />
                <Text style={styles.onlineCountText}>{onlineCount} online</Text>
              </View>
            )}
            <View style={styles.statusDotContainer}>
              <View style={styles.statusDot} />
              <Text style={styles.headerSubtitle}>Connected</Text>
            </View>
          </View>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Messages list container */}
      <View style={styles.listContainer}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        />

        {showScrollButton && (
          <Pressable
            style={[styles.scrollButton, Shadows.glow]}
            onPress={scrollToBottom}
          >
            <ArrowDown size={20} color="#FFFFFF" strokeWidth={2.5} />
            {unreadCount > 0 && (
              <View style={styles.scrollBadge}>
                <Text style={styles.scrollBadgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </Pressable>
        )}
      </View>

      {/* Bottom input section */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {replyingTo && (
          <View style={styles.replyingToContainer}>
            <View style={styles.replyingToContent}>
              <CornerUpLeft size={16} color={Colors.accent.primary} strokeWidth={2.5} />
              <Text style={styles.replyingToText} numberOfLines={1}>
                Replying to: {replyingTo.content}
              </Text>
            </View>
            <Pressable onPress={() => setReplyingTo(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={20} color={Colors.text.secondary} strokeWidth={2.5} />
            </Pressable>
          </View>
        )}
        <View style={styles.inputContainer}>
          {/* Ghost Mode Toggle */}
          <Pressable
            onPress={() => {
              setIsGhostMode(!isGhostMode);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={[
              styles.ghostToggleButton,
              isGhostMode && styles.ghostToggleButtonActive,
            ]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <EyeOff
              size={18}
              color={isGhostMode ? '#FFF' : Colors.text.tertiary}
              strokeWidth={2.5}
            />
          </Pressable>

          <TextInput
            ref={inputRef}
            style={[
              styles.input,
              isGhostMode && styles.ghostInput
            ]}
            placeholder={isGhostMode ? "Ghost Mode active (no name/avatar)..." : "Type your message anonymously..."}
            placeholderTextColor={Colors.text.tertiary}
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            maxLength={1000}
          />
          <Pressable
            onPress={handleSendMessage}
            disabled={!newMessage.trim()}
            style={[
              styles.sendButton,
              newMessage.trim() ? styles.sendButtonActive : styles.sendButtonDisabled,
            ]}
          >
            <Send
              size={18}
              color={newMessage.trim() ? '#fff' : Colors.text.tertiary}
              strokeWidth={2.5}
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* Reactions Overlay */}
      <Modal
        visible={activeReactionPicker !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveReactionPicker(null)}
      >
        <Pressable style={styles.reactionPickerOverlay} onPress={() => setActiveReactionPicker(null)}>
          <View style={styles.reactionPicker}>
            {QUICK_REACTIONS.map((emoji) => (
              <Pressable
                key={emoji}
                onPress={() => activeReactionPicker && handleReaction(activeReactionPicker, emoji)}
                style={styles.reactionPickerButton}
              >
                <Text style={styles.reactionPickerEmoji}>{emoji}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
  },
  // Radial glow overlay at top-right
  radialGlow: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(255, 107, 157, 0.12)',
  },
  verifyContainer: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  backButton: {
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
    alignSelf: 'flex-start',
  },
  verifyHeader: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  verifyTitle: {
    fontSize: 28,
    fontFamily: 'Manrope_700Bold',
    color: Colors.text.primary,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
    letterSpacing: -0.6,
  },
  verifySubtitle: {
    fontSize: 15,
    fontFamily: 'Manrope_400Regular',
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  verifyCard: {
    padding: Spacing.xl,
    backgroundColor: 'rgba(18, 22, 26, 0.8)',
    gap: Spacing.lg,
  },
  verifyInput: {
    width: '100%',
  },
  verifyBtn: {
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md - 2,
    backgroundColor: Colors.bg.secondary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.primary,
  },
  headerCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: Spacing.md,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Manrope_600SemiBold',
    color: Colors.text.primary,
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: 'Manrope_400Regular',
    color: Colors.text.secondary,
  },
  headerStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: 2,
  },
  onlineCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  onlineCountText: {
    fontSize: 12,
    fontFamily: 'Manrope_400Regular',
    color: Colors.text.tertiary,
  },
  statusDotContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.status.success,
  },
  listContainer: {
    flex: 1,
    position: 'relative',
  },
  messagesList: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl + 20,
  },
  messageContainer: {
    marginBottom: Spacing.md + 4,
  },
  messageTime: {
    fontSize: 11,
    fontFamily: 'Manrope_400Regular',
    color: Colors.text.tertiary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
    letterSpacing: 0.2,
  },
  messageBubble: {
    backgroundColor: 'rgba(18, 22, 26, 0.75)',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md - 2,
    maxWidth: '85%',
    alignSelf: 'flex-start',
    ...Shadows.sm,
  },
  optimisticMessage: {
    opacity: 0.6,
  },
  replyPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: Spacing.xs,
    marginBottom: Spacing.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.secondary,
  },
  replyText: {
    flex: 1,
    fontSize: 12.5,
    fontFamily: 'Manrope_400Regular',
    color: Colors.text.tertiary,
    fontStyle: 'italic',
  },
  messageText: {
    fontSize: 15.5,
    fontFamily: 'Manrope_400Regular',
    color: Colors.text.primary,
    lineHeight: 22,
    letterSpacing: -0.1,
  },
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  reactionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    backgroundColor: Colors.bg.tertiary,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border.secondary,
  },
  reactionBadgeActive: {
    backgroundColor: Colors.accent.glow,
    borderColor: Colors.accent.primary,
  },
  reactionEmoji: {
    fontSize: 13,
  },
  reactionCount: {
    fontSize: 11,
    fontFamily: 'Manrope_600SemiBold',
    color: Colors.text.secondary,
  },
  reactionCountActive: {
    color: Colors.accent.primary,
  },
  messageActions: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginTop: Spacing.xs + 2,
    paddingLeft: Spacing.xs,
  },
  messageActionBtn: {
    padding: 2,
  },
  scrollButton: {
    position: 'absolute',
    bottom: Spacing.lg,
    right: Spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99,
  },
  scrollBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: Colors.status.error,
    borderRadius: Radius.full,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: 'Manrope_700Bold',
  },
  replyingToContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.bg.secondary,
    borderTopWidth: 1,
    borderTopColor: Colors.border.primary,
  },
  replyingToContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  replyingToText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Manrope_400Regular',
    color: Colors.text.secondary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.bg.secondary,
    borderTopWidth: 1,
    borderTopColor: Colors.border.primary,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    backgroundColor: Colors.bg.tertiary,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border.primary,
    fontSize: 15,
    fontFamily: 'Manrope_400Regular',
    color: Colors.text.primary,
  },
  sendButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  sendButtonActive: {
    backgroundColor: Colors.accent.primary,
  },
  sendButtonDisabled: {
    backgroundColor: Colors.bg.tertiary,
    opacity: 0.5,
  },
  reactionPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactionPicker: {
    flexDirection: 'row',
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border.primary,
    padding: Spacing.md,
    gap: Spacing.sm,
    ...Shadows.lg,
  },
  reactionPickerButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    backgroundColor: Colors.bg.tertiary,
  },
  reactionPickerEmoji: {
    fontSize: 28,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  avatarGradient: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 12,
    fontFamily: 'Manrope_700Bold',
    color: '#FFFFFF',
  },
  ghostAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.border.primary,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleColumn: {
    flex: 1,
    alignItems: 'flex-start',
  },
  aliasText: {
    fontSize: 12.5,
    fontFamily: 'Manrope_700Bold',
    marginBottom: 4,
    paddingLeft: 2,
  },
  ghostMessageBubble: {
    backgroundColor: 'rgba(18, 22, 26, 0.45)',
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 107, 157, 0.3)',
  },
  ghostInput: {
    borderStyle: 'dashed',
    borderColor: Colors.accent.primary,
  },
  ghostToggleButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.lg,
    backgroundColor: Colors.bg.tertiary,
    borderWidth: 1,
    borderColor: Colors.border.primary,
  },
  ghostToggleButtonActive: {
    backgroundColor: Colors.accent.primary,
    borderColor: Colors.accent.primary,
  },
  unreadDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.md,
  },
  unreadDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 107, 107, 0.25)',
  },
  unreadBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 4,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)',
    marginHorizontal: Spacing.sm,
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.status.error,
    marginRight: 6,
  },
  unreadText: {
    fontSize: 10,
    fontFamily: 'Manrope_700Bold',
    color: Colors.status.error,
    letterSpacing: 0.5,
  },
});
