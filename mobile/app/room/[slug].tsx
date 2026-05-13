import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { io, Socket } from 'socket.io-client';
import { ArrowLeft, Send, Smile, X, CornerUpLeft, Users, ArrowDown, Copy } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import uuid from 'react-native-uuid';

import Button from '@/components/Button';
import Input from '@/components/Input';
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

const QUICK_REACTIONS = ['👍', '😂', '❤️', '🔥', '🎉', '😮'];

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
  const [socket, setSocket] = useState<Socket | null>(null);
  const [clientId, setClientId] = useState<string>('');
  const [clientHash, setClientHash] = useState<string>('');
  const [activeReactionPicker, setActiveReactionPicker] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
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
      connectSocket();
      checkNotificationPreference();
    }

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [isVerified]);

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

  const connectSocket = () => {
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket'],
    });

    newSocket.on('connect', () => {
      console.log('Socket connected');
      newSocket.emit('join-room', slug);
    });

    newSocket.on('room-user-count', (count: number) => {
      setOnlineCount(count);
    });

    newSocket.on('new-message', (message: Message) => {
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

    newSocket.on('message-reactions-updated', (data: { messageId: string; reactions: ReactionSummary[] }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.messageId ? { ...msg, reactions: data.reactions } : msg
        )
      );
    });

    newSocket.on('error', (error: any) => {
      showToast(error.message || 'Socket error', 'error');
    });

    setSocket(newSocket);
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

  const handleSendMessage = () => {
    if (!newMessage.trim() || !socket) return;

    const tempId = uuid.v4() as string;
    const optimisticMessage: Message = {
      id: tempId,
      content: newMessage.trim(),
      timestamp: new Date(),
      tempId,
      isOptimistic: true,
      reactions: [],
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
    setNewMessage('');
    setReplyingTo(null);

    socket.emit('send-message', {
      roomSlug: slug,
      content: optimisticMessage.content,
      tempId,
      ...(replyingTo && {
        replyTo: {
          messageId: replyingTo.id,
          preview: replyingTo.content.substring(0, 100),
        },
      }),
    });

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scrollToBottom();
  };

  const handleReaction = (messageId: string, emoji: string) => {
    if (!socket || !clientId) return;

    const message = messages.find((m) => m.id === messageId);
    if (!message) return;

    const existingReaction = message.reactions.find((r) => r.emoji === emoji);
    const action = existingReaction?.reacted ? 'remove' : 'add';

    socket.emit('react-message', {
      roomSlug: slug,
      messageId,
      emoji,
      clientId,
      action,
    });

    setActiveReactionPicker(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

    return (
      <View>
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
        <Pressable
          onLongPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setActiveReactionPicker(item.id);
          }}
          style={[styles.messageBubble, item.isOptimistic && styles.optimisticMessage]}
        >
          {item.replyTo && (
            <View style={styles.replyPreview}>
              <CornerUpLeft size={14} color={Colors.text.tertiary} strokeWidth={2} />
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
                  <Text style={styles.reactionCount}>{reaction.count}</Text>
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
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <CornerUpLeft size={16} color={Colors.text.tertiary} strokeWidth={2} />
          </Pressable>
          <Pressable
            onPress={() => {
              setActiveReactionPicker(item.id);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Smile size={16} color={Colors.text.tertiary} strokeWidth={2} />
          </Pressable>
          <Pressable
            onPress={() => handleCopyMessage(item.content)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Copy size={16} color={Colors.text.tertiary} strokeWidth={2} />
          </Pressable>
        </View>
      </View>
    );
  };

  if (!isVerified) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.verifyContainer}
        >
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft size={24} color={Colors.text.primary} strokeWidth={2} />
          </Pressable>
          <Text style={styles.verifyTitle}>Enter Room Password</Text>
          <Text style={styles.verifySubtitle}>This room is password-protected</Text>
          <Input
            label="Password"
            placeholder="Enter the room password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            style={styles.verifyInput}
          />
          <Button onPress={handleVerify} isLoading={isVerifying} size="lg">
            Join Room
          </Button>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={24} color={Colors.text.primary} strokeWidth={2} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {roomName}
          </Text>
          <View style={styles.headerStatusContainer}>
            {onlineCount !== null && (
              <View style={styles.onlineCountContainer}>
                <Users size={12} color={Colors.text.tertiary} strokeWidth={2} />
                <Text style={styles.onlineCountText}>{onlineCount} online</Text>
              </View>
            )}
            <View style={styles.statusDotContainer}>
              <View style={styles.statusDot} />
              <Text style={styles.headerSubtitle}>Connected</Text>
            </View>
          </View>
        </View>
        <View style={{ width: 24 }} />
      </View>

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
            style={styles.scrollButton}
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

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {replyingTo && (
          <View style={styles.replyingToContainer}>
            <View style={styles.replyingToContent}>
              <CornerUpLeft size={16} color={Colors.accent.primary} strokeWidth={2} />
              <Text style={styles.replyingToText} numberOfLines={1}>
                Replying to: {replyingTo.content}
              </Text>
            </View>
            <Pressable onPress={() => setReplyingTo(null)}>
              <X size={20} color={Colors.text.secondary} strokeWidth={2} />
            </Pressable>
          </View>
        )}
        <View style={styles.inputContainer}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor={Colors.text.tertiary}
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            maxLength={1000}
          />
          <Pressable
            onPress={handleSendMessage}
            disabled={!newMessage.trim()}
            style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]}
          >
            <Send
              size={20}
              color={newMessage.trim() ? Colors.accent.primary : Colors.text.tertiary}
              strokeWidth={2}
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

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
  verifyContainer: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    gap: Spacing.lg,
  },
  backButton: {
    marginBottom: Spacing.md,
  },
  verifyTitle: {
    fontSize: 28,
    fontFamily: 'Manrope_700Bold',
    color: Colors.text.primary,
  },
  verifySubtitle: {
    fontSize: 16,
    fontFamily: 'Manrope_400Regular',
    color: Colors.text.secondary,
    marginBottom: Spacing.md,
  },
  verifyInput: {
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.bg.secondary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.primary,
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
    backgroundColor: Colors.success,
  },
  messagesList: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  messageContainer: {
    marginBottom: Spacing.lg,
  },
  messageTime: {
    fontSize: 12,
    fontFamily: 'Manrope_400Regular',
    color: Colors.text.tertiary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  messageBubble: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border.primary,
    padding: Spacing.md,
    maxWidth: '85%',
    alignSelf: 'flex-start',
  },
  optimisticMessage: {
    opacity: 0.6,
  },
  replyPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingBottom: Spacing.xs,
    marginBottom: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.secondary,
  },
  replyText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Manrope_400Regular',
    color: Colors.text.tertiary,
    fontStyle: 'italic',
  },
  messageText: {
    fontSize: 15,
    fontFamily: 'Manrope_400Regular',
    color: Colors.text.primary,
    lineHeight: 22,
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
    paddingVertical: 4,
    backgroundColor: Colors.bg.tertiary,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border.secondary,
  },
  reactionBadgeActive: {
    backgroundColor: Colors.accent.glow,
    borderColor: Colors.accent.primary,
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    fontSize: 12,
    fontFamily: 'Manrope_500Medium',
    color: Colors.text.secondary,
  },
  messageActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xs,
    paddingLeft: Spacing.sm,
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
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.bg.tertiary,
    borderRadius: Radius.md,
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
    borderRadius: Radius.md,
    backgroundColor: Colors.bg.tertiary,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  reactionPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactionPicker: {
    flexDirection: 'row',
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border.primary,
    padding: Spacing.sm,
    gap: Spacing.xs,
    ...Shadows.lg,
  },
  reactionPickerButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.sm,
    backgroundColor: Colors.bg.tertiary,
  },
  reactionPickerEmoji: {
    fontSize: 28,
  },
});
r',
    borderRadius: Radius.sm,
    backgroundColor: Colors.bg.tertiary,
  },
  reactionPickerEmoji: {
    fontSize: 28,
  },
});
ext.primary,
  },
  sendButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    backgroundColor: Colors.bg.tertiary,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  reactionPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactionPicker: {
    flexDirection: 'row',
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border.primary,
    padding: Spacing.sm,
    gap: Spacing.xs,
    ...Shadows.lg,
  },
  reactionPickerButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.sm,
    backgroundColor: Colors.bg.tertiary,
  },
  reactionPickerEmoji: {
    fontSize: 28,
  },
});
r',
    borderRadius: Radius.sm,
    backgroundColor: Colors.bg.tertiary,
  },
  reactionPickerEmoji: {
    fontSize: 28,
  },
});
