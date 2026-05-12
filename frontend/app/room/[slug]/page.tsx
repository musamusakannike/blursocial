'use client';

import { useState, useEffect, useRef, use, FormEvent, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import toast from 'react-hot-toast';
import {
  FiSend,
  FiMessageCircle,
  FiSmile,
  FiPlus,
  FiCornerUpLeft,
  FiX,
  FiArrowDown,
  FiCopy,
  FiUsers,
  FiAlertCircle,
} from 'react-icons/fi';
import Button from '@/components/Button';
import Input from '@/components/Input';
import { nanoid } from 'nanoid';
import Link from 'next/link';

type ReactionSummary = {
  emoji: string;
  count: number;
  reacted?: boolean;
  hashes?: string[];
};

const isReactionActive = (
  messageId: string,
  emoji: string,
  reaction: ReactionSummary,
  localMap: SetMap
) => {
  if (typeof reaction.reacted === 'boolean') return reaction.reacted;
  return localMap[messageId]?.has(emoji) ?? false;
};

interface Message {
  id: string;
  content: string;
  timestamp: Date;
  tempId?: string;
  isOptimistic?: boolean;
  reactions: ReactionSummary[];
  replyTo?: { messageId: string; preview: string };
}

type SetMap = Record<string, Set<string>>;

const CLIENT_ID_STORAGE_KEY = 'blur-chat-client-id';
const REACTION_STORAGE_PREFIX = 'blur-chat-room-reactions:';
const QUICK_REACTIONS = ['👍', '😂', '❤️', '🔥', '🎉', '😮'];

const getReactionStorageKey = (slug: string) => `${REACTION_STORAGE_PREFIX}${slug}`;

const cloneSetMap = (map: SetMap): SetMap =>
  Object.fromEntries(Object.entries(map).map(([k, s]) => [k, new Set(s)]));

const mutateSetMap = (map: SetMap, messageId: string, emoji: string, shouldAdd: boolean): SetMap => {
  const next = cloneSetMap(map);
  const current = new Set(next[messageId] ?? []);
  if (shouldAdd) current.add(emoji);
  else current.delete(emoji);
  if (current.size === 0) delete next[messageId];
  else next[messageId] = current;
  return next;
};

const serializeSetMap = (map: SetMap): Record<string, string[]> =>
  Object.fromEntries(Object.entries(map).map(([k, s]) => [k, Array.from(s)]));

const deserializeSetMap = (record: Record<string, string[]>): SetMap =>
  Object.fromEntries(Object.entries(record).map(([k, a]) => [k, new Set(a)]));

const buildSetMapFromMessages = (messageList: Message[]): SetMap => {
  const next: SetMap = {};
  messageList.forEach((message) => {
    const active = message.reactions.filter((r) => r.reacted).map((r) => r.emoji);
    if (active.length > 0) next[message.id] = new Set(active);
  });
  return next;
};

const cloneMessages = (messageList: Message[]): Message[] =>
  messageList.map((m) => ({
    ...m,
    reactions: m.reactions.map((r) => ({ ...r, hashes: r.hashes ? [...r.hashes] : undefined })),
  }));

// ── Long-press hook (mobile tap-to-react) ─────────────────────────────────────
function useLongPress(callback: () => void, ms = 500) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);

  const start = useCallback(() => {
    fired.current = false;
    timerRef.current = setTimeout(() => {
      fired.current = true;
      callback();
    }, ms);
  }, [callback, ms]);

  const cancel = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const click = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (fired.current) e.preventDefault();
    },
    []
  );

  return { onMouseDown: start, onMouseUp: cancel, onMouseLeave: cancel, onTouchStart: start, onTouchEnd: cancel, onClick: click };
}

// ── Message bubble ────────────────────────────────────────────────────────────
function MessageBubble({
  message,
  localReactions,
  activeReactionPicker,
  onReactionToggle,
  onSetReactionPicker,
  onReply,
}: {
  message: Message;
  localReactions: SetMap;
  activeReactionPicker: string | null;
  onReactionToggle: (messageId: string, emoji: string) => void;
  onSetReactionPicker: (id: string | null) => void;
  onReply: (message: Message) => void;
}) {
  const [showTime, setShowTime] = useState(false);
  const longPress = useLongPress(() => onSetReactionPicker(message.id));

  const copyMessage = () => {
    navigator.clipboard.writeText(message.content);
    toast.success('Copied!');
  };

  return (
    <div className={`animate-fade-in ${message.isOptimistic ? 'opacity-60' : ''}`}>
      <div
        className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-primary)] p-4 max-w-2xl shadow-sm hover:shadow-[var(--shadow-md)] transition-shadow group"
        {...longPress}
      >
        {message.replyTo && (
          <div className="mb-3 pl-3 border-l-2 border-[var(--accent-primary)] bg-[var(--accent-primary)]/5 rounded-r-lg p-2">
            <div className="flex items-center gap-1.5 mb-1">
              <FiCornerUpLeft className="w-3 h-3 text-[var(--accent-primary)]" />
              <span className="text-xs font-medium text-[var(--accent-primary)]">Replying to</span>
            </div>
            <p className="text-sm text-[var(--text-secondary)] line-clamp-2">{message.replyTo.preview}</p>
          </div>
        )}

        {/* Content row — timestamp hidden until hover */}
        <div className="flex items-start justify-between gap-4">
          <p className="text-[var(--text-primary)] break-words whitespace-pre-wrap flex-1">
            {message.content}
          </p>
          <span
            className={`text-[10px] uppercase tracking-[0.2em] text-[var(--text-tertiary)] whitespace-nowrap transition-opacity duration-200 ${
              showTime ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
            aria-label={message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          >
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Reactions + action buttons */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {message.reactions.map((reaction) => {
            const active = isReactionActive(message.id, reaction.emoji, reaction, localReactions);
            return (
              <button
                key={reaction.emoji}
                onClick={() => onReactionToggle(message.id, reaction.emoji)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-secondary)] ${
                  active
                    ? 'bg-[var(--accent-primary)]/15 border-[var(--accent-primary)] text-[var(--accent-primary)] shadow-[0_0_0_1px_var(--accent-primary)]'
                    : 'border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/5'
                }`}
                aria-pressed={active}
              >
                <span className="text-base leading-none">{reaction.emoji}</span>
                <span className="text-xs font-medium">{reaction.count}</span>
              </button>
            );
          })}

          {/* Reaction picker */}
          <div className="relative">
            <button
              type="button"
              onClick={() => onSetReactionPicker(activeReactionPicker === message.id ? null : message.id)}
              className="flex items-center justify-center w-8 h-8 rounded-full border border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-secondary)]"
              aria-label="Add reaction"
            >
              {activeReactionPicker === message.id ? <FiSmile className="w-4 h-4" /> : <FiPlus className="w-4 h-4" />}
            </button>

            {activeReactionPicker === message.id && (
              <div className="absolute bottom-full left-0 mb-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl shadow-[var(--shadow-lg)] p-2 flex gap-1 animate-scale-in z-10">
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => { onSetReactionPicker(null); onReactionToggle(message.id, emoji); }}
                    className="w-10 h-10 flex items-center justify-center text-xl rounded-lg hover:bg-[var(--accent-primary)]/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                    aria-label={`React with ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Reply */}
          <button
            type="button"
            onClick={() => onReply(message)}
            className="flex items-center justify-center w-8 h-8 rounded-full border border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-secondary)]"
            aria-label="Reply to message"
          >
            <FiCornerUpLeft className="w-4 h-4" />
          </button>

          {/* Copy message */}
          <button
            type="button"
            onClick={copyMessage}
            className="flex items-center justify-center w-8 h-8 rounded-full border border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-secondary)]"
            aria-label="Copy message"
          >
            <FiCopy className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page component ───────────────────────────────────────────────────────
export default function RoomPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [roomNotFound, setRoomNotFound] = useState(false);
  const [password, setPassword] = useState('');
  const [roomName, setRoomName] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientHash, setClientHash] = useState<string | null>(null);
  const [localReactions, setLocalReactions] = useState<SetMap>({});
  const [activeReactionPicker, setActiveReactionPicker] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastReadMessageIndex, setLastReadMessageIndex] = useState<number | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [onlineCount, setOnlineCount] = useState<number | null>(null);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const messagesRef = useRef<Message[]>([]);
  const clientIdRef = useRef<string | null>(null);
  const clientHashRef = useRef<string | null>(null);
  const localReactionsRef = useRef<SetMap>({});
  const hasLoadedReactionsRef = useRef(false);
  const pendingReactionsRef = useRef<Set<string>>(new Set());

  const getStorageKey = useCallback(() => getReactionStorageKey(resolvedParams.slug), [resolvedParams.slug]);

  const ensureClientIdentity = useCallback(() => {
    if (typeof window === 'undefined') return null;
    let stored = window.localStorage.getItem(CLIENT_ID_STORAGE_KEY);
    if (!stored) {
      stored = typeof window.crypto?.randomUUID === 'function' ? window.crypto.randomUUID() : nanoid();
      window.localStorage.setItem(CLIENT_ID_STORAGE_KEY, stored);
    }
    setClientId(stored);
    clientIdRef.current = stored;
    return stored;
  }, []);

  useEffect(() => { if (typeof window !== 'undefined') ensureClientIdentity(); }, [ensureClientIdentity]);
  useEffect(() => { clientIdRef.current = clientId; }, [clientId]);

  useEffect(() => {
    if (!clientId) return;
    if (typeof window === 'undefined' || !window.crypto?.subtle) { setClientHash(clientId); return; }
    let cancelled = false;
    (async () => {
      try {
        const buf = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(clientId));
        const hex = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
        if (!cancelled) setClientHash(hex);
      } catch { if (!cancelled) setClientHash(clientId); }
    })();
    return () => { cancelled = true; };
  }, [clientId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(getStorageKey());
      if (raw) {
        const d = deserializeSetMap(JSON.parse(raw) as Record<string, string[]>);
        localReactionsRef.current = d; setLocalReactions(d);
      } else { localReactionsRef.current = {}; setLocalReactions({}); }
    } catch { localReactionsRef.current = {}; setLocalReactions({}); }
    finally { hasLoadedReactionsRef.current = true; }
  }, [getStorageKey]);

  useEffect(() => { clientHashRef.current = clientHash; }, [clientHash]);

  useEffect(() => {
    localReactionsRef.current = localReactions;
    if (!hasLoadedReactionsRef.current || typeof window === 'undefined') return;
    window.localStorage.setItem(getStorageKey(), JSON.stringify(serializeSetMap(localReactions)));
  }, [localReactions, getStorageKey]);

  const mapServerMessage = useCallback((msg: any): Message => ({
    id: msg.id,
    content: msg.content,
    timestamp: new Date(msg.timestamp),
    tempId: msg.tempId,
    reactions: Array.isArray(msg.reactions)
      ? msg.reactions.map((r: any) => ({ emoji: r.emoji, count: r.count, reacted: Boolean(r.reacted), hashes: r.hashes }))
      : [],
    replyTo: msg.replyTo,
  }), []);

  const applyServerReactionSnapshot = useCallback((
    messageId: string,
    payload: Array<{ emoji: string; count: number; hashes?: string[]; reacted?: boolean }>
  ) => {
    const hashedId = clientHashRef.current;
    setMessages((prev) => {
      const next = prev.map((message) => {
        if (message.id !== messageId) return message;
        return {
          ...message,
          reactions: payload.map((r) => ({
            emoji: r.emoji,
            count: r.count,
            reacted: typeof r.reacted === 'boolean' ? r.reacted
              : hashedId && r.hashes ? r.hashes.includes(hashedId)
              : localReactionsRef.current[messageId]?.has(r.emoji) ?? false,
            hashes: r.hashes,
          })),
        };
      });
      messagesRef.current = next;
      return next;
    });

    if (payload.length === 0) {
      const next = cloneSetMap(localReactionsRef.current);
      if (next[messageId]) { delete next[messageId]; localReactionsRef.current = next; setLocalReactions(next); }
      return;
    }
    if (hashedId) {
      const next = cloneSetMap(localReactionsRef.current);
      delete next[messageId];
      payload.forEach((r) => { if (r.hashes?.includes(hashedId)) { if (!next[messageId]) next[messageId] = new Set(); next[messageId]!.add(r.emoji); } });
      localReactionsRef.current = next; setLocalReactions(next);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (socket) socket.disconnect();
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    };
  }, [socket]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    isAtBottomRef.current = isAtBottom;
    setShowScrollButton(!isAtBottom);
    if (isAtBottom) { setUnreadCount(0); setLastReadMessageIndex(messages.length - 1); }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    isAtBottomRef.current = true;
    setShowScrollButton(false);
    setUnreadCount(0);
    setLastReadMessageIndex(messages.length - 1);
  };

  useEffect(() => { if (isVerified && isAtBottomRef.current) scrollToBottom(); }, [messages, isVerified]);

  const handleVerifyPassword = async (e: FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    try {
      const response = await fetch(`/api/rooms/${resolvedParams.slug}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await response.json();
      if (response.status === 404) { setRoomNotFound(true); setIsVerifying(false); return; }
      if (!response.ok) { toast.error(data.error || 'Invalid password'); setIsVerifying(false); return; }
      setRoomName(data.room.name);
      await initializeRoom(data.room.id, ensureClientIdentity());
      setIsVerified(true);
    } catch (err) {
      toast.error('Something went wrong');
      setIsVerifying(false);
    }
  };

  const startPolling = () => {
    if (pollingRef.current) return;
    void fetchMessages();
    pollingRef.current = setInterval(fetchMessages, 4000);
  };

  const stopPolling = () => {
    if (!pollingRef.current) return;
    clearInterval(pollingRef.current);
    pollingRef.current = null;
  };

  const fetchMessages = async () => {
    try {
      const activeClientId = clientIdRef.current ?? ensureClientIdentity();
      const headers: HeadersInit = activeClientId ? { 'x-client-id': activeClientId } : {};
      const response = await fetch(`/api/rooms/${resolvedParams.slug}/messages`, { headers });
      if (!response.ok) return;
      const data = await response.json();
      const mapped = data.messages.map(mapServerMessage);
      setMessages(mapped); messagesRef.current = mapped;
      const synced = buildSetMapFromMessages(mapped);
      localReactionsRef.current = synced; setLocalReactions(synced);
    } catch (error) { console.error('Polling failed', error); }
  };

  const initializeRoom = async (roomId: string, providedClientId?: string | null) => {
    try {
      const activeClientId = providedClientId ?? clientIdRef.current ?? ensureClientIdentity();
      const headers: HeadersInit = activeClientId ? { 'x-client-id': activeClientId } : {};
      const messagesResponse = await fetch(`/api/rooms/${resolvedParams.slug}/messages`, { headers });
      const messagesData = await messagesResponse.json();
      if (messagesResponse.ok) {
        const mapped: Message[] = messagesData.messages.map(mapServerMessage);
        setMessages(mapped); messagesRef.current = mapped;
        const synced = buildSetMapFromMessages(mapped);
        localReactionsRef.current = synced; setLocalReactions(synced);
      }

      const newSocket = io({ path: '/socket.io', transports: ['websocket', 'polling'] });
      let socketConnected = false;

      newSocket.on('connect', () => {
        socketConnected = true;
        stopPolling();
        newSocket.emit('join-room', resolvedParams.slug);
      });

      newSocket.on('room-user-count', (count: number) => setOnlineCount(count));

      newSocket.on('new-message', (message: Message) => {
        setMessages((prev) => {
          const filtered = prev.filter((m) => m.tempId !== message.tempId);
          const mapped = mapServerMessage(message);
          const next = [...filtered, mapped];
          messagesRef.current = next;
          return next;
        });
        if (!isAtBottomRef.current) setUnreadCount((prev) => prev + 1);
      });

      newSocket.on('message-reactions-updated', (payload: { messageId: string; reactions: Array<{ emoji: string; count: number; hashes?: string[] }> }) => {
        applyServerReactionSnapshot(payload.messageId, payload.reactions);
      });

      newSocket.on('connect_error', () => {
        if (!socketConnected) startPolling();
      });
      newSocket.on('disconnect', () => {
        startPolling();
      });
      newSocket.on('error', (error: { message: string }) => toast.error(error.message));

      setSocket(newSocket);
      setIsVerifying(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    } catch {
      toast.error('Failed to join room');
      setIsVerifying(false);
    }
  };

  const sendMessageViaHttp = async (content: string, tempId: string, replyTo: Message | null = null) => {
    try {
      const response = await fetch(`/api/rooms/${resolvedParams.slug}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, tempId, ...(replyTo && { replyTo: { messageId: replyTo.id, preview: replyTo.content.substring(0, 100) } }) }),
      });
      if (!response.ok) throw new Error('Failed to send message');
      const { message } = await response.json();
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.tempId !== message.tempId);
        const mapped = mapServerMessage(message);
        const next = [...filtered, mapped];
        messagesRef.current = next;
        return next;
      });
    } catch { toast.error('Message failed to send'); }
  };

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    isAtBottomRef.current = true;
    setShowScrollButton(false);
    setUnreadCount(0);
    const tempId = nanoid();
    const optimisticMessage: Message = {
      id: tempId, content: newMessage, timestamp: new Date(), tempId, isOptimistic: true, reactions: [],
      replyTo: replyingTo ? { messageId: replyingTo.id, preview: replyingTo.content.substring(0, 100) } : undefined,
    };
    setMessages((prev) => [...prev, optimisticMessage]);
    const payload = { roomSlug: resolvedParams.slug, content: newMessage, tempId, ...(replyingTo && { replyTo: { messageId: replyingTo.id, preview: replyingTo.content.substring(0, 100) } }) };
    if (socket && socket.connected) socket.emit('send-message', payload);
    else await sendMessageViaHttp(newMessage, tempId, replyingTo);
    setNewMessage('');
    setReplyingTo(null);
    inputRef.current?.focus();
  };

  const handleReactionToggle = async (messageId: string, emoji: string) => {
    const activeClientId = clientIdRef.current ?? ensureClientIdentity();
    if (!activeClientId) { toast.error('Unable to identify client'); return; }
    const key = `${messageId}:${emoji}`;
    if (pendingReactionsRef.current.has(key)) return;
    const currentSet = localReactionsRef.current[messageId] ?? new Set<string>();
    const isAdding = !currentSet.has(emoji);
    const action: 'add' | 'remove' = isAdding ? 'add' : 'remove';
    const previousMessages = cloneMessages(messagesRef.current);
    const previousLocal = cloneSetMap(localReactionsRef.current);
    const mutatedLocal = mutateSetMap(localReactionsRef.current, messageId, emoji, isAdding);
    localReactionsRef.current = mutatedLocal; setLocalReactions(mutatedLocal);
    setMessages((prev) => {
      const next = prev.map((message) => {
        if (message.id !== messageId) return message;
        let found = false;
        const updated = message.reactions.map((r) => {
          if (r.emoji !== emoji) return r;
          found = true;
          const nextCount = isAdding ? r.count + 1 : Math.max(r.count - 1, 0);
          return { ...r, count: nextCount, reacted: isAdding ? true : nextCount > 0 ? r.reacted : false };
        });
        let nextReactions = updated;
        if (!found && isAdding) nextReactions = [...updated, { emoji, count: 1, reacted: true }];
        if (!isAdding) nextReactions = nextReactions.filter((r) => r.count > 0);
        return { ...message, reactions: nextReactions };
      });
      messagesRef.current = next; return next;
    });
    pendingReactionsRef.current.add(key);
    try {
      if (socket && socket.connected) {
        socket.emit('react-message', { roomSlug: resolvedParams.slug, messageId, emoji, action, clientId: activeClientId });
      } else {
        const response = await fetch(`/api/rooms/${resolvedParams.slug}/messages/${messageId}/reactions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-client-id': activeClientId },
          body: JSON.stringify({ emoji, action }),
        });
        if (!response.ok) throw new Error('Failed to update reactions');
        const data = await response.json();
        applyServerReactionSnapshot(messageId, data.reactions);
      }
    } catch {
      toast.error('Reaction failed');
      localReactionsRef.current = previousLocal; setLocalReactions(previousLocal);
      messagesRef.current = previousMessages; setMessages(previousMessages);
    } finally { pendingReactionsRef.current.delete(key); }
  };

  // ── Room not found ──────────────────────────────────────────────────────────
  if (roomNotFound) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-glow)] via-transparent to-transparent opacity-30" />
        <div className="relative w-full max-w-md text-center animate-scale-in">
          <div className="w-20 h-20 rounded-2xl bg-[var(--error)]/10 flex items-center justify-center mx-auto mb-6">
            <FiAlertCircle className="w-10 h-10 text-[var(--error)]" />
          </div>
          <h1 className="text-3xl font-bold mb-3">Room Not Found</h1>
          <p className="text-[var(--text-secondary)] mb-8">
            This room doesn't exist or has already expired. Check the link and try again.
          </p>
          <Link href="/">
            <Button variant="primary" size="lg">Back to Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  // ── Password gate ───────────────────────────────────────────────────────────
  if (!isVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-glow)] via-transparent to-transparent opacity-30" />
        <div className="relative w-full max-w-md animate-scale-in">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center mx-auto mb-4">
              <FiMessageCircle className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Enter Room</h1>
            <p className="text-[var(--text-secondary)]">This room is password protected</p>
          </div>
          <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-primary)] p-8 shadow-[var(--shadow-lg)]">
            <form onSubmit={handleVerifyPassword} className="space-y-5">
              <Input
                label="Room Password"
                type="password"
                placeholder="Enter the room password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
                disabled={isVerifying}
              />
              <Button type="submit" variant="primary" size="lg" className="w-full" isLoading={isVerifying}>
                {isVerifying ? 'Joining…' : 'Join Room'}
              </Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ── Chat UI ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col bg-[var(--bg-primary)]" style={{ height: '100dvh' }}>
      <header className="bg-[var(--bg-secondary)] border-b border-[var(--border-primary)] px-4 sm:px-6 py-4 shrink-0">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center">
              <FiMessageCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">{roomName}</h1>
              <p className="text-xs text-[var(--text-tertiary)]">Anonymous Chat</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {onlineCount !== null && (
              <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                <FiUsers className="w-3.5 h-3.5" />
                <span>{onlineCount} online</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse" />
              <span className="text-xs text-[var(--text-secondary)] hidden sm:inline">Connected</span>
            </div>
          </div>
        </div>
      </header>

      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 relative"
      >
        <div className="max-w-5xl mx-auto space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-[var(--accent-glow)] flex items-center justify-center mx-auto mb-4">
                <FiMessageCircle className="w-8 h-8 text-[var(--accent-primary)]" />
              </div>
              <p className="text-[var(--text-secondary)]">No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((message, index) => (
              <div key={message.id}>
                {lastReadMessageIndex !== null && index === lastReadMessageIndex + 1 && (
                  <div className="relative my-6 flex items-center gap-4">
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[var(--accent-primary)] to-transparent" />
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30">
                      <div className="w-2 h-2 rounded-full bg-[var(--accent-primary)]" />
                      <span className="text-xs font-semibold uppercase tracking-widest text-[var(--accent-primary)]">Unread Messages</span>
                      <div className="w-2 h-2 rounded-full bg-[var(--accent-primary)]" />
                    </div>
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[var(--accent-primary)] to-transparent" />
                  </div>
                )}
                <MessageBubble
                  message={message}
                  localReactions={localReactions}
                  activeReactionPicker={activeReactionPicker}
                  onReactionToggle={handleReactionToggle}
                  onSetReactionPicker={setActiveReactionPicker}
                  onReply={setReplyingTo}
                />
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {showScrollButton && (
          <div className="sticky bottom-4 w-full flex justify-end pr-4 sm:pr-6 pointer-events-none z-20">
            <button
              onClick={scrollToBottom}
              className="pointer-events-auto bg-[var(--accent-primary)] text-white border border-[var(--accent-primary)] rounded-full p-3 shadow-lg hover:bg-[var(--accent-primary)]/90 hover:shadow-xl transition-all focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/50 focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)] flex items-center justify-center gap-2 relative"
              aria-label={unreadCount > 0 ? `${unreadCount} unread messages, scroll to bottom` : 'Scroll to bottom'}
            >
              <FiArrowDown className="w-5 h-5" />
              {unreadCount > 0 && (
                <div className="flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded-full bg-white text-[var(--accent-primary)] text-xs font-bold">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </div>
              )}
            </button>
          </div>
        )}
      </div>

      <div className="bg-[var(--bg-secondary)] border-t border-[var(--border-primary)] px-4 sm:px-6 py-4 z-10 relative shrink-0">
        <form onSubmit={handleSendMessage} className="max-w-5xl mx-auto">
          {replyingTo && (
            <div className="mb-3 flex items-start gap-3 bg-[var(--accent-primary)]/5 border border-[var(--accent-primary)]/20 rounded-xl p-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <FiCornerUpLeft className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  <span className="text-xs font-semibold text-[var(--accent-primary)]">Replying to message</span>
                </div>
                <p className="text-sm text-[var(--text-secondary)] line-clamp-2">{replyingTo.content}</p>
              </div>
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                aria-label="Cancel reply"
              >
                <FiX className="w-4 h-4" />
              </button>
            </div>
          )}
          <div className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 px-4 py-3 rounded-xl bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-primary)] focus:shadow-[0_0_0_3px_var(--accent-glow)] transition-all"
              maxLength={1000}
            />
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={!newMessage.trim()}
              className="flex items-center gap-2 px-6"
            >
              <FiSend className="w-5 h-5" />
              <span className="hidden sm:inline">Send</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
