import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  FlatList,
  Platform,
  Dimensions,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAvoidingView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeOut,
  SlideInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  ArrowLeft,
  Send,
  Lock,
  Eye,
  EyeOff,
  Reply,
  X,
  Smile,
  Ghost,
} from 'lucide-react-native';
import * as Ably from 'ably';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/components/Toast';
import {
  verifyRoom,
  fetchMessages,
  sendMessage,
  toggleReaction,
  getAblyToken,
  MessageData,
} from '@/services/api';
import { hapticLight, hapticMedium, hapticSelection, hapticSuccess, hapticError } from '@/utils/haptics';
import { nanoid } from 'nanoid/non-secure';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const REACTIONS = ['❤️', '😂', '👍', '🔥', '😮', '💀'];

let _cachedClientId: string | null = null;
function getSpectralId(): string {
  if (_cachedClientId) return _cachedClientId;
  _cachedClientId = nanoid(16);
  return _cachedClientId;
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getSenderColor(hash: string | null | undefined, colors: any): string {
  if (!hash) return colors.textTertiary;
  const palette = [
    '#FF6B9D', '#34D399', '#60A5FA', '#FBBF24',
    '#A78BFA', '#F87171', '#6EE7B7', '#93C5FD',
  ];
  return palette[hashCode(hash) % palette.length];
}

export default function RoomScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { colors, isDark } = useTheme();
  const toast = useToast();
  const router = useRouter();

  const [isVerified, setIsVerified] = useState(false);
  const [password, setPassword] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [roomName, setRoomName] = useState('');

  const [messages, setMessages] = useState<MessageData[]>([]);
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [ghostMode, setGhostMode] = useState(false);
  const [replyTo, setReplyTo] = useState<{ messageId: string; preview: string } | null>(null);
  const [showReactions, setShowReactions] = useState<string | null>(null);

  const clientId = useMemo(() => getSpectralId(), []);
  const flatListRef = useRef<FlatList>(null);
  const ablyClientRef = useRef<Ably.Realtime | null>(null);
  const channelRef = useRef<Ably.RealtimeChannel | null>(null);

  // Verify room password
  const handleVerify = async () => {
    if (!password.trim()) {
      toast.warning('Enter the room password');
      return;
    }
    setIsVerifying(true);
    hapticLight();
    try {
      const data = await verifyRoom(slug!, password);
      if (data.success) {
        hapticSuccess();
        setRoomName(data.room.name);
        setIsVerified(true);
      }
    } catch (err: any) {
      hapticError();
      toast.error(err?.response?.data?.error || 'Invalid password');
    } finally {
      setIsVerifying(false);
    }
  };

  // Load messages and setup Ably
  useEffect(() => {
    if (!isVerified || !slug) return;

    const loadMessages = async () => {
      try {
        const msgs = await fetchMessages(slug, clientId);
        setMessages(msgs);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
      } catch {
        toast.error('Failed to load messages');
      }
    };

    const setupAbly = async () => {
      try {
        const tokenData = await getAblyToken(clientId);
        const client = new Ably.Realtime({
          authCallback: async (_, callback) => {
            try {
              const t = await getAblyToken(clientId);
              callback(null, t);
            } catch (e: any) {
              callback(e, null);
            }
          },
          clientId,
        });

        // Use initial token for first connection
        ablyClientRef.current = client;
        const channel = client.channels.get(`room:${slug}`);
        channelRef.current = channel;

        channel.subscribe('new-message', (msg) => {
          const newMsg = msg.data as MessageData;
          setMessages((prev) => {
            // Deduplicate by tempId
            if (newMsg.tempId && prev.some((m) => m.tempId === newMsg.tempId)) {
              return prev.map((m) => (m.tempId === newMsg.tempId ? newMsg : m));
            }
            return [...prev, newMsg];
          });
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
        });

        channel.subscribe('reaction-update', (msg) => {
          const { messageId, reactions } = msg.data;
          setMessages((prev) =>
            prev.map((m) => (m.id === messageId ? { ...m, reactions } : m))
          );
        });
      } catch (err) {
        console.error('Ably setup error:', err);
      }
    };

    loadMessages();
    setupAbly();

    return () => {
      channelRef.current?.unsubscribe();
      ablyClientRef.current?.close();
    };
  }, [isVerified, slug, clientId, toast]);

  // Send message
  const handleSend = async () => {
    const text = messageText.trim();
    if (!text || isSending) return;

    hapticLight();
    setIsSending(true);
    const tempId = nanoid(8);

    // Optimistic add
    const optimisticMsg: MessageData = {
      id: tempId,
      content: text,
      timestamp: new Date().toISOString(),
      tempId,
      reactions: [],
      replyTo: replyTo || undefined,
      senderHash: ghostMode ? null : hashCode(clientId).toString(16),
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setMessageText('');
    setReplyTo(null);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);

    try {
      await sendMessage(
        slug!,
        text,
        tempId,
        ghostMode ? null : hashCode(clientId).toString(16),
        replyTo || undefined
      );
    } catch {
      toast.error('Failed to send message');
      setMessages((prev) => prev.filter((m) => m.tempId !== tempId));
    } finally {
      setIsSending(false);
    }
  };

  // Toggle reaction
  const handleReaction = async (messageId: string, emoji: string) => {
    hapticSelection();
    setShowReactions(null);
    try {
      const msg = messages.find((m) => m.id === messageId);
      const existing = msg?.reactions?.find((r) => r.emoji === emoji);
      const action = existing?.reacted ? 'remove' : 'add';
      await toggleReaction(slug!, messageId, emoji, action, clientId);
    } catch {
      toast.error('Reaction failed');
    }
  };

  // Password screen
  if (!isVerified) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <View style={styles.verifyContainer}>
          <Animated.View entering={FadeInDown.springify()} style={styles.verifyCard}>
            <View style={[styles.lockIcon, { backgroundColor: colors.accentGlow }]}>
              <Lock size={28} color={colors.accentPrimary} />
            </View>
            <Text style={[styles.verifyTitle, { color: colors.textPrimary }]}>
              Enter Room Password
            </Text>
            <Text style={[styles.verifySubtitle, { color: colors.textSecondary }]}>
              Room: /{slug}
            </Text>
            <View style={[styles.verifyInput, { borderColor: colors.borderPrimary, backgroundColor: colors.surface1 }]}>
              <TextInput
                style={[styles.input, { color: colors.textPrimary }]}
                placeholder="Password"
                placeholderTextColor={colors.textTertiary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleVerify}
              />
            </View>
            <Pressable
              onPress={handleVerify}
              disabled={isVerifying}
              style={[styles.verifyButton, { backgroundColor: colors.accentPrimary, opacity: isVerifying ? 0.6 : 1 }]}
            >
              <Text style={styles.verifyButtonText}>
                {isVerifying ? 'Verifying...' : 'Enter Room'}
              </Text>
            </Pressable>
            <Pressable onPress={() => router.back()} style={styles.backLink}>
              <Text style={[styles.backLinkText, { color: colors.textTertiary }]}>Go back</Text>
            </Pressable>
          </Animated.View>
        </View>
      </SafeAreaView>
    );
  }

  // Chat screen
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]} edges={['top']}>
      {/* Chat Header */}
      <View style={[styles.chatHeader, { borderBottomColor: colors.borderSecondary }]}>
        <Pressable onPress={() => { router.back(); hapticLight(); }} style={styles.backButton}>
          <ArrowLeft size={20} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.headerTitle}>
          <Text style={[styles.headerName, { color: colors.textPrimary }]} numberOfLines={1}>
            {roomName}
          </Text>
          <Text style={[styles.headerSlug, { color: colors.textTertiary }]}>/{slug}</Text>
        </View>
        <Pressable
          onPress={() => { setGhostMode(!ghostMode); hapticMedium(); }}
          style={[
            styles.ghostButton,
            { backgroundColor: ghostMode ? colors.accentGlow : colors.surface1 },
          ]}
        >
          <Ghost size={18} color={ghostMode ? colors.accentPrimary : colors.textTertiary} />
        </Pressable>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id || item.tempId || Math.random().toString()}
        renderItem={({ item }) => (
          <MessageBubble
            message={item}
            colors={colors}
            clientId={clientId}
            onReply={() => {
              setReplyTo({ messageId: item.id, preview: item.content.slice(0, 60) });
              hapticSelection();
            }}
            onShowReactions={() => setShowReactions(item.id)}
            isDark={isDark}
          />
        )}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        showsVerticalScrollIndicator={false}
        initialNumToRender={20}
        maxToRenderPerBatch={10}
        windowSize={10}
      />

      {/* Reaction picker */}
      {showReactions && (
        <Animated.View
          entering={SlideInDown.springify().damping(18)}
          exiting={FadeOut.duration(150)}
          style={[styles.reactionBar, { backgroundColor: colors.surface1, borderColor: colors.borderPrimary }]}
        >
          {REACTIONS.map((emoji) => (
            <Pressable
              key={emoji}
              onPress={() => handleReaction(showReactions, emoji)}
              style={styles.reactionEmoji}
            >
              <Text style={styles.emojiText}>{emoji}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => setShowReactions(null)} style={styles.reactionClose}>
            <X size={14} color={colors.textTertiary} />
          </Pressable>
        </Animated.View>
      )}

      {/* Input area */}
      <KeyboardStickyView offset={{ closed: 0, opened: 0 }}>
        <View style={[styles.inputArea, { backgroundColor: colors.bgPrimary, borderTopColor: colors.borderSecondary }]}>
          {replyTo && (
            <View style={[styles.replyBanner, { backgroundColor: colors.surface1 }]}>
              <Reply size={12} color={colors.accentPrimary} />
              <Text style={[styles.replyText, { color: colors.textSecondary }]} numberOfLines={1}>
                {replyTo.preview}
              </Text>
              <Pressable onPress={() => setReplyTo(null)}>
                <X size={14} color={colors.textTertiary} />
              </Pressable>
            </View>
          )}
          <View style={styles.inputRow}>
            <View style={[styles.textInputWrap, { backgroundColor: colors.surface1, borderColor: colors.borderPrimary }]}>
              <TextInput
                style={[styles.chatInput, { color: colors.textPrimary }]}
                placeholder={ghostMode ? 'Ghost message...' : 'Type a message...'}
                placeholderTextColor={colors.textTertiary}
                value={messageText}
                onChangeText={setMessageText}
                multiline
                maxLength={1000}
              />
            </View>
            <Pressable
              onPress={handleSend}
              disabled={!messageText.trim()}
              style={[
                styles.sendButton,
                {
                  backgroundColor: messageText.trim() ? colors.accentPrimary : colors.surface1,
                },
              ]}
            >
              <Send
                size={18}
                color={messageText.trim() ? '#fff' : colors.textTertiary}
                strokeWidth={2.2}
              />
            </Pressable>
          </View>
        </View>
      </KeyboardStickyView>
    </SafeAreaView>
  );
}

// ── Message Bubble ────────────────────────────────────────────────────────────

interface MessageBubbleProps {
  message: MessageData;
  colors: any;
  clientId: string;
  onReply: () => void;
  onShowReactions: () => void;
  isDark: boolean;
}

function MessageBubble({ message, colors, clientId, onReply, onShowReactions, isDark }: MessageBubbleProps) {
  const isMine = message.senderHash === hashCode(clientId).toString(16);
  const isGhost = !message.senderHash;
  const senderColor = getSenderColor(message.senderHash, colors);

  return (
    <Pressable
      onLongPress={() => { onShowReactions(); hapticMedium(); }}
      style={[
        styles.messageBubble,
        {
          backgroundColor: isMine
            ? isDark ? 'rgba(255,107,157,0.12)' : 'rgba(224,69,123,0.08)'
            : colors.surface1,
          borderColor: isMine ? colors.borderAccent : colors.borderPrimary,
          alignSelf: isMine ? 'flex-end' : 'flex-start',
          maxWidth: SCREEN_WIDTH * 0.78,
        },
      ]}
    >
      {/* Reply reference */}
      {message.replyTo && (
        <View style={[styles.replyRef, { borderLeftColor: colors.accentPrimary }]}>
          <Text style={[styles.replyRefText, { color: colors.textTertiary }]} numberOfLines={1}>
            {message.replyTo.preview}
          </Text>
        </View>
      )}

      {/* Sender indicator */}
      {!isMine && !isGhost && (
        <View style={[styles.senderDot, { backgroundColor: senderColor }]} />
      )}
      {isGhost && (
        <View style={styles.ghostLabel}>
          <Ghost size={10} color={colors.textTertiary} />
        </View>
      )}

      <Text style={[styles.messageText, { color: colors.textPrimary }]}>{message.content}</Text>

      {/* Reactions */}
      {message.reactions && message.reactions.length > 0 && (
        <View style={styles.reactionsRow}>
          {message.reactions.map((r, i) => (
            <View key={`${r.emoji}-${i}`} style={[styles.reactionPill, { backgroundColor: colors.surface2, borderColor: r.reacted ? colors.accentPrimary : colors.borderPrimary }]}>
              <Text style={styles.reactionPillEmoji}>{r.emoji}</Text>
              <Text style={[styles.reactionCount, { color: colors.textSecondary }]}>{r.count}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Quick actions */}
      <View style={styles.msgActions}>
        <Pressable onPress={onReply} hitSlop={6}>
          <Reply size={12} color={colors.textTertiary} />
        </Pressable>
        <Pressable onPress={onShowReactions} hitSlop={6}>
          <Smile size={12} color={colors.textTertiary} />
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Verify
  verifyContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  verifyCard: {
    alignItems: 'center',
    gap: 14,
  },
  lockIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  verifyTitle: {
    fontSize: 22,
    fontFamily: 'Poppins_700Bold',
    letterSpacing: -0.4,
  },
  verifySubtitle: {
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
  },
  verifyInput: {
    width: '100%',
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    justifyContent: 'center',
    marginTop: 8,
  },
  input: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
  },
  verifyButton: {
    width: '100%',
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyButtonText: {
    color: '#fff',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
  },
  backLink: {
    marginTop: 8,
  },
  backLinkText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
  },
  // Chat Header
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
  },
  headerName: {
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
    letterSpacing: -0.3,
  },
  headerSlug: {
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
  },
  ghostButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Messages
  messagesList: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 6,
  },
  messageBubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 6,
  },
  senderDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginBottom: 4,
  },
  ghostLabel: {
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    lineHeight: 20,
  },
  replyRef: {
    borderLeftWidth: 2,
    paddingLeft: 8,
    marginBottom: 6,
  },
  replyRefText: {
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
  },
  reactionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
  },
  reactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    gap: 3,
  },
  reactionPillEmoji: {
    fontSize: 12,
  },
  reactionCount: {
    fontSize: 10,
    fontFamily: 'Poppins_500Medium',
  },
  msgActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
    opacity: 0.6,
  },
  // Reaction bar
  reactionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 12,
    justifyContent: 'center',
  },
  reactionEmoji: {
    padding: 6,
  },
  emojiText: {
    fontSize: 22,
  },
  reactionClose: {
    padding: 6,
  },
  // Input
  inputArea: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 8 : 12,
    borderTopWidth: 1,
  },
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderRadius: 10,
    marginBottom: 8,
  },
  replyText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  textInputWrap: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    maxHeight: 120,
  },
  chatInput: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    lineHeight: 20,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

