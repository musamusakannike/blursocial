'use client';

import {
  useState,
  useEffect,
  useRef,
  use,
  FormEvent,
  useCallback,
} from 'react';
import { io, Socket } from 'socket.io-client';
import toast from 'react-hot-toast';
import {
  FiSend,
  FiMessageCircle,
  FiSmile,
  FiCornerUpLeft,
  FiX,
  FiArrowDown,
  FiCopy,
  FiUsers,
  FiAlertCircle,
  FiEyeOff,
  FiMaximize,
  FiMinimize,
  FiHelpCircle,
  FiBell,
  FiBellOff,
  FiInfo,
  FiLogOut,
  FiMoreVertical,
} from 'react-icons/fi';
import Logo from '@/components/Logo';
import Button from '@/components/Button';
import Input from '@/components/Input';
import { nanoid } from 'nanoid';
import Link from 'next/link';
import { Haptics } from '@/lib/haptics';
import {
  requestNotificationPermission,
  showNotification,
  isNotificationEnabledForRoom,
  setNotificationForRoom,
} from '@/lib/notifications';
import { getSpectralProfile } from '@/lib/avatar';

// ── Types ─────────────────────────────────────────────────────────────────────

type ReactionSummary = {
  emoji: string;
  count: number;
  reacted?: boolean;
  hashes?: string[];
};

interface Message {
  id: string;
  content: string;
  timestamp: Date;
  tempId?: string;
  isOptimistic?: boolean;
  reactions: ReactionSummary[];
  replyTo?: { messageId: string; preview: string };
  senderHash?: string | null;
}

type SetMap = Record<string, Set<string>>;

type PanelType = 'info' | 'tutorial' | 'react' | null;

// ── Constants ─────────────────────────────────────────────────────────────────

const CLIENT_ID_STORAGE_KEY = 'blur-chat-client-id';
const REACTION_STORAGE_PREFIX = 'blur-chat-room-reactions:';
const QUICK_REACTIONS = ['👍', '😂', '❤️', '🔥', '🎉', '😮'];

const getReactionStorageKey = (slug: string) =>
  `${REACTION_STORAGE_PREFIX}${slug}`;

// ── Reaction helpers ──────────────────────────────────────────────────────────

const isReactionActive = (
  messageId: string,
  emoji: string,
  reaction: ReactionSummary,
  localMap: SetMap
) => {
  if (typeof reaction.reacted === 'boolean') return reaction.reacted;
  return localMap[messageId]?.has(emoji) ?? false;
};

const cloneSetMap = (map: SetMap): SetMap =>
  Object.fromEntries(Object.entries(map).map(([k, s]) => [k, new Set(s)]));

const mutateSetMap = (
  map: SetMap,
  messageId: string,
  emoji: string,
  shouldAdd: boolean
): SetMap => {
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
  Object.fromEntries(
    Object.entries(record).map(([k, a]) => [k, new Set(a)])
  );

const buildSetMapFromMessages = (messageList: Message[]): SetMap => {
  const next: SetMap = {};
  messageList.forEach((message) => {
    const active = message.reactions
      .filter((r) => r.reacted)
      .map((r) => r.emoji);
    if (active.length > 0) next[message.id] = new Set(active);
  });
  return next;
};

const cloneMessages = (messageList: Message[]): Message[] =>
  messageList.map((m) => ({
    ...m,
    reactions: m.reactions.map((r) => ({
      ...r,
      hashes: r.hashes ? [...r.hashes] : undefined,
    })),
  }));

// ── Long-press hook ───────────────────────────────────────────────────────────

function useLongPress(callback: () => void, ms = 480) {
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

  const click = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (fired.current) e.preventDefault();
  }, []);

  return {
    onMouseDown: start,
    onMouseUp: cancel,
    onMouseLeave: cancel,
    onTouchStart: start,
    onTouchEnd: cancel,
    onClick: click,
  };
}

// ── Avatar component ──────────────────────────────────────────────────────────

function Avatar({ senderHash }: { senderHash?: string | null }) {
  const isGhost = !senderHash;
  const profile = isGhost ? null : getSpectralProfile(senderHash);

  if (isGhost) {
    return (
      <div
        className="w-8 h-8 rounded-[10px] flex items-center justify-center text-[13px] border border-dashed border-[var(--border-primary)] bg-[var(--surface-1)]/30 shrink-0"
        title="Ghost Mode"
      >
        👻
      </div>
    );
  }

  return (
    <div
      className="w-8 h-8 rounded-[10px] flex items-center justify-center text-[11px] font-bold text-white shrink-0 border border-white/10"
      style={{
        background: `linear-gradient(135deg, ${profile!.gradient.start}, ${profile!.gradient.end})`,
        boxShadow: `0 0 10px ${profile!.gradient.start}33`,
      }}
      title={profile!.alias}
    >
      {profile!.initials}
    </div>
  );
}

// ── Message Bubble ────────────────────────────────────────────────────────────

function MessageBubble({
  message,
  localReactions,
  onReactionToggle,
  onLongPress,
  onReply,
}: {
  message: Message;
  localReactions: SetMap;
  onReactionToggle: (messageId: string, emoji: string) => void;
  onLongPress: (messageId: string) => void;
  onReply: (message: Message) => void;
}) {
  const isGhost = !message.senderHash;
  const profile = isGhost ? null : getSpectralProfile(message.senderHash);
  const longPress = useLongPress(() => onLongPress(message.id));

  return (
    <div
      className={`flex items-end gap-2 my-[3px] transition-opacity duration-300 ${
        message.isOptimistic ? 'opacity-50' : 'opacity-100'
      } animate-[slideUp_0.25s_cubic-bezier(0.34,1.56,0.64,1)]`}
    >
      {/* Avatar column */}
      <div className="w-8 shrink-0 flex items-end pb-1">
        <Avatar senderHash={message.senderHash} />
      </div>

      {/* Content column */}
      <div className="flex-1 min-w-0">
        {/* Alias */}
        {!isGhost && profile && (
          <div className="flex items-center gap-2 mb-1 pl-1">
            <span
              className="text-[11px] font-semibold tracking-[-0.01em] font-syne"
              style={{
                background: `linear-gradient(135deg, ${profile.gradient.start}, ${profile.gradient.end})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {profile.alias}
            </span>
            <span className="text-[10px] text-[var(--text-tertiary)]">
              {message.timestamp.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        )}

        {/* Bubble */}
        <div
          {...longPress}
          className={`relative p-3 rounded-[18px_18px_18px_4px] max-w-full text-[14.5px] leading-relaxed border cursor-default select-none active:scale-[0.98] transition-transform duration-100 ${
            isGhost
              ? 'bg-[var(--bg-primary)] border-dashed border-[var(--border-primary)]/50'
              : 'bg-[var(--surface-1)] border-[var(--border-primary)]'
          }`}
          onContextMenu={(e) => {
            e.preventDefault();
            onLongPress(message.id);
          }}
        >
          {/* Reply quote */}
          {message.replyTo && (
            <div className="mb-2.5 pl-2.5 border-l-2 border-[var(--accent-primary)] bg-[var(--accent-primary)]/5 rounded-r-lg p-2">
              <p className="text-[10px] font-semibold text-[var(--accent-primary)] uppercase tracking-[0.06em] mb-1 font-syne">
                ↩ Replying to
              </p>
              <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
                {message.replyTo.preview}
              </p>
            </div>
          )}

          <p className="text-[var(--text-primary)] break-words whitespace-pre-wrap">
            {message.content}
          </p>

          {/* Ghost timestamp */}
          {isGhost && (
            <span className="text-[10px] text-[var(--text-tertiary)] mt-1 block">
              {message.timestamp.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
        </div>

        {/* Reactions */}
        {message.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5 pl-1">
            {message.reactions.map((reaction) => {
              const active = isReactionActive(
                message.id,
                reaction.emoji,
                reaction,
                localReactions
              );
              return (
                <button
                  key={reaction.emoji}
                  onClick={() => onReactionToggle(message.id, reaction.emoji)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs transition-all active:scale-90 ${
                    active
                      ? 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)]/40 text-[var(--accent-primary)]'
                      : 'bg-[var(--surface-1)] border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--border-accent)]'
                  }`}
                >
                  <span className="text-sm leading-none">{reaction.emoji}</span>
                  <span className="font-medium">{reaction.count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Bottom Sheet Panel ────────────────────────────────────────────────────────

function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end items-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-[430px] bg-[var(--surface-1)] rounded-[28px_28px_0_0] border border-[var(--border-primary)] border-b-0 animate-[slideUp_0.28s_cubic-bezier(0.32,0.72,0,1)] max-h-[85vh] overflow-y-auto">
        {/* Handle */}
        <div className="w-9 h-1 rounded-full bg-[var(--border-primary)] mx-auto mt-3 mb-2" />
        {/* Title bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-primary)]">
          <h2 className="font-syne font-bold text-base tracking-[-0.02em]">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[var(--surface-2)] border border-[var(--border-primary)] flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors active:scale-90"
          >
            <FiX className="w-3.5 h-3.5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Tutorial Panel ────────────────────────────────────────────────────────────

const TUTORIAL_STEPS = [
  {
    icon: '👻',
    title: 'Ghost Mode',
    desc: 'Tap the ghost icon in the input bar to hide your alias and avatar entirely — maximum anonymity.',
  },
  {
    icon: '⬛',
    title: 'Long-press to react',
    desc: 'Hold down on any message bubble to reveal quick reactions and actions like reply and copy.',
  },
  {
    icon: '↩️',
    title: 'Reply to messages',
    desc: 'Long-press a message and tap Reply. A preview bar appears — tap ✕ to cancel.',
  },
  {
    icon: '⛶',
    title: 'Fullscreen mode',
    desc: 'Tap the maximize icon in the header for a distraction-free fullscreen experience.',
  },
  {
    icon: '🔔',
    title: 'Notifications',
    desc: 'Enable push notifications via the bell icon to stay notified even when the app is in the background.',
  },
  {
    icon: '📋',
    title: 'Copy messages',
    desc: 'Long-press any message and tap Copy to copy the text to your clipboard instantly.',
  },
];

function TutorialPanel({ onClose }: { onClose: () => void }) {
  return (
    <>
      {TUTORIAL_STEPS.map((step, i) => (
        <div
          key={i}
          className={`flex items-start gap-4 px-5 py-4 ${
            i < TUTORIAL_STEPS.length - 1
              ? 'border-b border-[var(--border-primary)]'
              : ''
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-[var(--surface-2)] border border-[var(--border-primary)] flex items-center justify-center text-lg shrink-0">
            {step.icon}
          </div>
          <div>
            <p className="font-syne font-semibold text-sm mb-1">{step.title}</p>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              {step.desc}
            </p>
          </div>
        </div>
      ))}
    </>
  );
}

// ── Reaction Sheet ─────────────────────────────────────────────────────────────

function ReactSheet({
  onReact,
  onReply,
  onCopy,
}: {
  onReact: (emoji: string) => void;
  onReply: () => void;
  onCopy: () => void;
}) {
  return (
    <div className="px-5 pb-6 pt-2">
      {/* Quick reactions */}
      <div className="flex justify-center gap-2 mb-4">
        {QUICK_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => onReact(emoji)}
            className="w-11 h-11 rounded-xl bg-[var(--surface-2)] border border-[var(--border-primary)] text-2xl flex items-center justify-center active:scale-90 transition-transform hover:bg-[var(--accent-primary)]/10 hover:border-[var(--accent-primary)]/30"
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={onReply}
          className="flex-1 h-11 rounded-xl bg-[var(--surface-2)] border border-[var(--border-primary)] flex items-center justify-center gap-2 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-accent)] transition-colors active:scale-95 font-syne"
        >
          <FiCornerUpLeft className="w-4 h-4" />
          Reply
        </button>
        <button
          onClick={onCopy}
          className="flex-1 h-11 rounded-xl bg-[var(--surface-2)] border border-[var(--border-primary)] flex items-center justify-center gap-2 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-accent)] transition-colors active:scale-95 font-syne"
        >
          <FiCopy className="w-4 h-4" />
          Copy
        </button>
      </div>
    </div>
  );
}

// ── Info Panel ────────────────────────────────────────────────────────────────

function InfoPanel({
  roomName,
  onlineCount,
  msgCount,
  notificationsEnabled,
  onToggleNotifications,
  slug,
  onClose,
}: {
  roomName: string;
  onlineCount: number | null;
  msgCount: number;
  notificationsEnabled: boolean;
  onToggleNotifications: () => void;
  slug: string;
  onClose: () => void;
}) {
  const rows = [
    { label: 'Room', value: roomName },
    { label: 'Messages', value: `${msgCount}` },
    {
      label: 'Online',
      value: onlineCount !== null ? `${onlineCount} users` : '—',
      valueClass: 'text-[var(--success)]',
    },
    { label: 'Mode', value: 'End-to-end anonymous' },
    { label: 'Password', value: 'Protected ✓', valueClass: 'text-[var(--success)]' },
  ];

  return (
    <div className="pb-2">
      {rows.map((r) => (
        <div
          key={r.label}
          className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border-primary)]"
        >
          <span className="text-[11px] font-syne uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
            {r.label}
          </span>
          <span className={`text-sm font-medium ${r.valueClass ?? ''}`}>
            {r.value}
          </span>
        </div>
      ))}

      {/* Notifications toggle */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border-primary)]">
        <span className="text-[11px] font-syne uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
          Notifications
        </span>
        <button
          onClick={onToggleNotifications}
          className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
            notificationsEnabled
              ? 'text-[var(--accent-primary)]'
              : 'text-[var(--text-tertiary)]'
          }`}
        >
          {notificationsEnabled ? (
            <FiBell className="w-4 h-4" />
          ) : (
            <FiBellOff className="w-4 h-4" />
          )}
          {notificationsEnabled ? 'On' : 'Off'}
        </button>
      </div>

      {/* Leave room */}
      <div className="px-5 pt-4 pb-2">
        <Link href="/">
          <button
            onClick={onClose}
            className="w-full h-11 rounded-xl bg-[var(--danger)]/8 border border-[var(--danger)]/20 text-[var(--danger)] text-sm font-semibold font-syne flex items-center justify-center gap-2 hover:bg-[var(--danger)]/12 transition-colors active:scale-[0.98]"
          >
            <FiLogOut className="w-4 h-4" />
            Leave Room
          </button>
        </Link>
      </div>
    </div>
  );
}

// ── Main Page Component ───────────────────────────────────────────────────────

export default function RoomPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = use(params);

  // ── State ──────────────────────────────────────────────────────────────────
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
  const [isGhostMode, setIsGhostMode] = useState(false);
  const [localReactions, setLocalReactions] = useState<SetMap>({});
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastReadMessageIndex, setLastReadMessageIndex] = useState<
    number | null
  >(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [onlineCount, setOnlineCount] = useState<number | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [hasAskedNotifications, setHasAskedNotifications] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activePanel, setActivePanel] = useState<PanelType>(null);
  const [activeLongPressMsg, setActiveLongPressMsg] = useState<string | null>(
    null
  );
  const [inputRows, setInputRows] = useState(1);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const roomNameRef = useRef<string>('');
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const messagesRef = useRef<Message[]>([]);
  const clientIdRef = useRef<string | null>(null);
  const clientHashRef = useRef<string | null>(null);
  const localReactionsRef = useRef<SetMap>({});
  const hasLoadedReactionsRef = useRef(false);
  const pendingReactionsRef = useRef<Set<string>>(new Set());

  const getStorageKey = useCallback(
    () => getReactionStorageKey(resolvedParams.slug),
    [resolvedParams.slug]
  );

  // ── Identity ───────────────────────────────────────────────────────────────

  const ensureClientIdentity = useCallback(() => {
    if (typeof window === 'undefined') return null;
    let stored = window.localStorage.getItem(CLIENT_ID_STORAGE_KEY);
    if (!stored) {
      stored =
        typeof window.crypto?.randomUUID === 'function'
          ? window.crypto.randomUUID()
          : nanoid();
      window.localStorage.setItem(CLIENT_ID_STORAGE_KEY, stored);
    }
    setClientId(stored);
    clientIdRef.current = stored;
    return stored;
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') ensureClientIdentity();
  }, [ensureClientIdentity]);

  useEffect(() => {
    clientIdRef.current = clientId;
  }, [clientId]);

  useEffect(() => {
    if (!clientId) return;
    if (typeof window === 'undefined' || !window.crypto?.subtle) {
      setClientHash(clientId);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const buf = await window.crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode(clientId)
        );
        const hex = Array.from(new Uint8Array(buf))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
        if (!cancelled) setClientHash(hex);
      } catch {
        if (!cancelled) setClientHash(clientId);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  // ── Reaction storage ───────────────────────────────────────────────────────

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(getStorageKey());
      if (raw) {
        const d = deserializeSetMap(
          JSON.parse(raw) as Record<string, string[]>
        );
        localReactionsRef.current = d;
        setLocalReactions(d);
      } else {
        localReactionsRef.current = {};
        setLocalReactions({});
      }
    } catch {
      localReactionsRef.current = {};
      setLocalReactions({});
    } finally {
      hasLoadedReactionsRef.current = true;
    }
  }, [getStorageKey]);

  useEffect(() => {
    clientHashRef.current = clientHash;
  }, [clientHash]);

  useEffect(() => {
    roomNameRef.current = roomName;
  }, [roomName]);

  useEffect(() => {
    localReactionsRef.current = localReactions;
    if (!hasLoadedReactionsRef.current || typeof window === 'undefined') return;
    window.localStorage.setItem(
      getStorageKey(),
      JSON.stringify(serializeSetMap(localReactions))
    );
  }, [localReactions, getStorageKey]);

  // ── Message mapping ────────────────────────────────────────────────────────

  const mapServerMessage = useCallback(
    (msg: any): Message => ({
      id: msg.id,
      content: msg.content,
      timestamp: new Date(msg.timestamp),
      tempId: msg.tempId,
      reactions: Array.isArray(msg.reactions)
        ? msg.reactions.map((r: any) => ({
            emoji: r.emoji,
            count: r.count,
            reacted: Boolean(r.reacted),
            hashes: r.hashes,
          }))
        : [],
      replyTo: msg.replyTo,
      senderHash: msg.senderHash,
    }),
    []
  );

  const applyServerReactionSnapshot = useCallback(
    (
      messageId: string,
      payload: Array<{
        emoji: string;
        count: number;
        hashes?: string[];
        reacted?: boolean;
      }>
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
              reacted:
                typeof r.reacted === 'boolean'
                  ? r.reacted
                  : hashedId && r.hashes
                  ? r.hashes.includes(hashedId)
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
        if (next[messageId]) {
          delete next[messageId];
          localReactionsRef.current = next;
          setLocalReactions(next);
        }
        return;
      }
      if (hashedId) {
        const next = cloneSetMap(localReactionsRef.current);
        delete next[messageId];
        payload.forEach((r) => {
          if (r.hashes?.includes(hashedId)) {
            if (!next[messageId]) next[messageId] = new Set();
            next[messageId]!.add(r.emoji);
          }
        });
        localReactionsRef.current = next;
        setLocalReactions(next);
      }
    },
    []
  );

  // ── Socket cleanup ─────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (socket) socket.disconnect();
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [socket]);

  // ── Notifications ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (isVerified) {
      const enabled = isNotificationEnabledForRoom(resolvedParams.slug);
      setNotificationsEnabled(enabled);

      if (!enabled && !hasAskedNotifications) {
        const timer = setTimeout(async () => {
          if (
            confirm(
              `Enable browser notifications for "${roomName}"?`
            )
          ) {
            const granted = await requestNotificationPermission();
            if (granted) {
              setNotificationsEnabled(true);
              setNotificationForRoom(resolvedParams.slug, true);
              toast.success('Notifications enabled!');
            }
          }
          setHasAskedNotifications(true);
        }, 5000);
        return () => clearTimeout(timer);
      }
    }
  }, [
    isVerified,
    roomName,
    resolvedParams.slug,
    hasAskedNotifications,
  ]);

  const handleToggleNotifications = async () => {
    if (notificationsEnabled) {
      setNotificationForRoom(resolvedParams.slug, false);
      setNotificationsEnabled(false);
      toast('Notifications off', { icon: '🔕' });
    } else {
      const granted = await requestNotificationPermission();
      if (granted) {
        setNotificationForRoom(resolvedParams.slug, true);
        setNotificationsEnabled(true);
        toast.success('Notifications enabled!');
      } else {
        toast.error('Notification permission denied');
      }
    }
  };

  // ── Fullscreen API ─────────────────────────────────────────────────────────

  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
      const target = document.documentElement;
      try {
        if (target.requestFullscreen) await target.requestFullscreen();
        else if ((target as any).webkitRequestFullscreen)
          await (target as any).webkitRequestFullscreen();
        setIsFullscreen(true);
        Haptics.light();
      } catch {
        // Fullscreen not supported
      }
    } else {
      try {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if ((document as any).webkitExitFullscreen)
          await (document as any).webkitExitFullscreen();
        setIsFullscreen(false);
        Haptics.light();
      } catch {
        // Ignore
      }
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => {
      const inFs =
        !!document.fullscreenElement ||
        !!(document as any).webkitFullscreenElement;
      setIsFullscreen(inFs);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
    };
  }, []);

  // ── Scroll ─────────────────────────────────────────────────────────────────

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } =
      scrollContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    isAtBottomRef.current = isAtBottom;
    setShowScrollButton(!isAtBottom);
    if (isAtBottom) {
      setUnreadCount(0);
      setLastReadMessageIndex(messages.length - 1);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    isAtBottomRef.current = true;
    setShowScrollButton(false);
    setUnreadCount(0);
    setLastReadMessageIndex(messages.length - 1);
  };

  useEffect(() => {
    if (isVerified && isAtBottomRef.current) scrollToBottom();
  }, [messages, isVerified]);

  // ── Room init & polling ────────────────────────────────────────────────────

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
      const activeClientId =
        clientIdRef.current ?? ensureClientIdentity();
      const headers: HeadersInit = activeClientId
        ? { 'x-client-id': activeClientId }
        : {};
      const response = await fetch(
        `/api/rooms/${resolvedParams.slug}/messages`,
        { headers }
      );
      if (!response.ok) return;
      const data = await response.json();
      const mapped = data.messages.map(mapServerMessage);
      setMessages(mapped);
      messagesRef.current = mapped;
      const synced = buildSetMapFromMessages(mapped);
      localReactionsRef.current = synced;
      setLocalReactions(synced);
    } catch (error) {
      console.error('Polling failed', error);
    }
  };

  const initializeRoom = async (
    roomId: string,
    providedClientId?: string | null
  ) => {
    try {
      const activeClientId =
        providedClientId ?? clientIdRef.current ?? ensureClientIdentity();
      const headers: HeadersInit = activeClientId
        ? { 'x-client-id': activeClientId }
        : {};
      const messagesResponse = await fetch(
        `/api/rooms/${resolvedParams.slug}/messages`,
        { headers }
      );
      const messagesData = await messagesResponse.json();
      if (messagesResponse.ok) {
        const mapped: Message[] = messagesData.messages.map(mapServerMessage);
        setMessages(mapped);
        messagesRef.current = mapped;
        const synced = buildSetMapFromMessages(mapped);
        localReactionsRef.current = synced;
        setLocalReactions(synced);
      }

      const newSocket = io({ path: '/socket.io', transports: ['websocket', 'polling'] });
      let socketConnected = false;

      newSocket.on('connect', () => {
        socketConnected = true;
        stopPolling();
        newSocket.emit('join-room', resolvedParams.slug);
      });

      newSocket.on('room-user-count', (count: number) =>
        setOnlineCount(count)
      );

      newSocket.on('new-message', (message: Message) => {
        setMessages((prev) => {
          const filtered = prev.filter((m) => m.tempId !== message.tempId);
          const mapped = mapServerMessage(message);
          const next = [...filtered, mapped];
          messagesRef.current = next;
          return next;
        });

        if (
          document.hidden &&
          isNotificationEnabledForRoom(resolvedParams.slug)
        ) {
          showNotification(
            `New message in ${roomNameRef.current || 'Blur Room'}`,
            { body: (message as any).content }
          );
        }

        if (!isAtBottomRef.current) {
          setUnreadCount((prev) => prev + 1);
          Haptics.light();
        }
      });

      newSocket.on(
        'message-reactions-updated',
        (payload: {
          messageId: string;
          reactions: Array<{
            emoji: string;
            count: number;
            hashes?: string[];
          }>;
        }) => {
          applyServerReactionSnapshot(payload.messageId, payload.reactions);
        }
      );

      newSocket.on('connect_error', () => {
        if (!socketConnected) startPolling();
      });
      newSocket.on('disconnect', () => {
        startPolling();
      });
      newSocket.on('error', (error: { message: string }) =>
        toast.error(error.message)
      );

      setSocket(newSocket);
      setIsVerifying(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    } catch {
      toast.error('Failed to join room');
      setIsVerifying(false);
    }
  };

  // ── Send message ───────────────────────────────────────────────────────────

  const sendMessageViaHttp = async (
    content: string,
    tempId: string,
    replyTo: Message | null = null,
    senderHash: string | null = null
  ) => {
    try {
      const response = await fetch(
        `/api/rooms/${resolvedParams.slug}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content,
            tempId,
            senderHash,
            ...(replyTo && {
              replyTo: {
                messageId: replyTo.id,
                preview: replyTo.content.substring(0, 100),
              },
            }),
          }),
        }
      );
      if (!response.ok) throw new Error('Failed to send message');
      const { message } = await response.json();
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.tempId !== message.tempId);
        const mapped = mapServerMessage(message);
        const next = [...filtered, mapped];
        messagesRef.current = next;
        return next;
      });
    } catch {
      toast.error('Message failed to send');
    }
  };

  const handleSendMessage = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!newMessage.trim()) return;
    isAtBottomRef.current = true;
    setShowScrollButton(false);
    setUnreadCount(0);
    const tempId = nanoid();
    const activeHash = isGhostMode ? null : clientHash;
    const optimisticMessage: Message = {
      id: tempId,
      content: newMessage,
      timestamp: new Date(),
      tempId,
      isOptimistic: true,
      reactions: [],
      senderHash: activeHash,
      replyTo: replyingTo
        ? {
            messageId: replyingTo.id,
            preview: replyingTo.content.substring(0, 100),
          }
        : undefined,
    };
    setMessages((prev) => [...prev, optimisticMessage]);
    const payload = {
      roomSlug: resolvedParams.slug,
      content: newMessage,
      tempId,
      senderHash: activeHash,
      ...(replyingTo && {
        replyTo: {
          messageId: replyingTo.id,
          preview: replyingTo.content.substring(0, 100),
        },
      }),
    };
    if (socket && socket.connected) socket.emit('send-message', payload);
    else
      await sendMessageViaHttp(newMessage, tempId, replyingTo, activeHash);
    Haptics.light();
    setNewMessage('');
    setInputRows(1);
    setReplyingTo(null);
    inputRef.current?.focus();
  };

  // ── Reaction toggle ────────────────────────────────────────────────────────

  const handleReactionToggle = async (messageId: string, emoji: string) => {
    const activeClientId =
      clientIdRef.current ?? ensureClientIdentity();
    if (!activeClientId) {
      toast.error('Unable to identify client');
      return;
    }
    const key = `${messageId}:${emoji}`;
    if (pendingReactionsRef.current.has(key)) return;
    const currentSet =
      localReactionsRef.current[messageId] ?? new Set<string>();
    const isAdding = !currentSet.has(emoji);
    const action: 'add' | 'remove' = isAdding ? 'add' : 'remove';
    const previousMessages = cloneMessages(messagesRef.current);
    const previousLocal = cloneSetMap(localReactionsRef.current);
    const mutatedLocal = mutateSetMap(
      localReactionsRef.current,
      messageId,
      emoji,
      isAdding
    );
    localReactionsRef.current = mutatedLocal;
    setLocalReactions(mutatedLocal);
    setMessages((prev) => {
      const next = prev.map((message) => {
        if (message.id !== messageId) return message;
        let found = false;
        const updated = message.reactions.map((r) => {
          if (r.emoji !== emoji) return r;
          found = true;
          const nextCount = isAdding ? r.count + 1 : Math.max(r.count - 1, 0);
          return {
            ...r,
            count: nextCount,
            reacted: isAdding
              ? true
              : nextCount > 0
              ? r.reacted
              : false,
          };
        });
        let nextReactions = updated;
        if (!found && isAdding)
          nextReactions = [...updated, { emoji, count: 1, reacted: true }];
        if (!isAdding)
          nextReactions = nextReactions.filter((r) => r.count > 0);
        return { ...message, reactions: nextReactions };
      });
      messagesRef.current = next;
      return next;
    });
    pendingReactionsRef.current.add(key);
    try {
      if (socket && socket.connected) {
        socket.emit('react-message', {
          roomSlug: resolvedParams.slug,
          messageId,
          emoji,
          action,
          clientId: activeClientId,
        });
      } else {
        const response = await fetch(
          `/api/rooms/${resolvedParams.slug}/messages/${messageId}/reactions`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-client-id': activeClientId,
            },
            body: JSON.stringify({ emoji, action }),
          }
        );
        if (!response.ok) throw new Error('Failed to update reactions');
        const data = await response.json();
        applyServerReactionSnapshot(messageId, data.reactions);
      }
    } catch {
      toast.error('Reaction failed');
      localReactionsRef.current = previousLocal;
      setLocalReactions(previousLocal);
      messagesRef.current = previousMessages;
      setMessages(previousMessages);
    } finally {
      pendingReactionsRef.current.delete(key);
    }
  };

  // ── Password verify ────────────────────────────────────────────────────────

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
      if (response.status === 404) {
        setRoomNotFound(true);
        setIsVerifying(false);
        return;
      }
      if (!response.ok) {
        toast.error(data.error || 'Invalid password');
        setIsVerifying(false);
        return;
      }
      setRoomName(data.room.name);
      await initializeRoom(data.room.id, ensureClientIdentity());
      setIsVerified(true);
    } catch {
      Haptics.error();
      toast.error('Something went wrong');
      setIsVerifying(false);
    }
  };

  // ── Long-press handler ─────────────────────────────────────────────────────

  const handleLongPress = (messageId: string) => {
    setActiveLongPressMsg(messageId);
    setActivePanel('react');
    Haptics.medium();
  };

  const closePanel = () => {
    setActivePanel(null);
    setActiveLongPressMsg(null);
  };

  // ── Input auto-resize ──────────────────────────────────────────────────────

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    const lines = e.target.value.split('\n').length;
    setInputRows(Math.min(lines, 4));
  };

  const handleInputKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // ── Render states ──────────────────────────────────────────────────────────

  if (roomNotFound) {
    return (
      <div className="min-h-screen flex items-center justify-center p-5">
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 50% 40% at 50% 30%, rgba(248,113,113,0.08), transparent)',
          }}
        />
        <div className="relative w-full max-w-md text-center animate-[scaleIn_0.3s_ease]">
          <div className="w-20 h-20 rounded-2xl bg-[var(--error)]/10 flex items-center justify-center mx-auto mb-6">
            <FiAlertCircle className="w-10 h-10 text-[var(--error)]" />
          </div>
          <h1 className="font-syne font-bold text-3xl mb-3 tracking-tight">
            Room Not Found
          </h1>
          <p className="text-[var(--text-secondary)] mb-8 leading-relaxed">
            This room doesn&apos;t exist or has already expired. Check the link
            and try again.
          </p>
          <Link href="/">
            <Button variant="primary" size="lg">
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!isVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center p-5">
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 60% 50% at 50% 30%, var(--accent-glow), transparent)',
          }}
        />
        <div className="relative w-full max-w-md animate-[scaleIn_0.3s_ease]">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-5">
              <Logo size="lg" href={null as any} />
            </div>
            <h1 className="font-syne font-bold text-3xl mb-2 tracking-tight">
              Enter Room
            </h1>
            <p className="text-[var(--text-secondary)]">
              This room is password protected
            </p>
          </div>
          <div className="bg-[var(--surface-1)] rounded-2xl border border-[var(--border-primary)] p-8 shadow-[var(--shadow-lg)]">
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
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                isLoading={isVerifying}
              >
                {isVerifying ? 'Joining…' : 'Join Room'}
              </Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ── Active message for long-press panels ───────────────────────────────────

  const activeLongPressMessage = activeLongPressMsg
    ? messages.find((m) => m.id === activeLongPressMsg) ?? null
    : null;

  // ── Chat UI ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Global keyframe animations injected once */}
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to   { opacity: 1; transform: scale(1);    }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        .chat-scrollbar::-webkit-scrollbar { width: 2px; }
        .chat-scrollbar::-webkit-scrollbar-thumb { background: var(--border-primary); border-radius: 2px; }
        .font-syne { font-family: 'Syne', sans-serif; }
      `}</style>

      <div className="fixed inset-0 flex flex-col bg-[var(--bg-primary)] max-w-[430px] mx-auto">

        {/* ── HEADER ─────────────────────────────────────────────────────── */}
        <header className="shrink-0 bg-[var(--surface-1)] border-b border-[var(--border-primary)] px-4 h-[58px] flex items-center justify-between z-20">
          {/* Left: icon + room info */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center shrink-0">
              <FiMessageCircle className="w-4.5 h-4.5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="font-syne font-bold text-[14px] tracking-[-0.02em] truncate leading-tight">
                {roomName}
              </h1>
              <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
                <span
                  className="w-1.5 h-1.5 rounded-full bg-[var(--success)] animate-pulse"
                />
                <span>Anonymous</span>
                {onlineCount !== null && (
                  <>
                    <span className="opacity-40">·</span>
                    <FiUsers className="w-3 h-3" />
                    <span>{onlineCount} online</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right: action buttons */}
          <div className="flex items-center gap-0.5 shrink-0">
            {/* Notifications */}
            <button
              onClick={handleToggleNotifications}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90 ${
                notificationsEnabled
                  ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)]'
              }`}
              title={
                notificationsEnabled
                  ? 'Disable notifications'
                  : 'Enable notifications'
              }
            >
              {notificationsEnabled ? (
                <FiBell className="w-4 h-4" />
              ) : (
                <FiBellOff className="w-4 h-4" />
              )}
            </button>

            {/* Fullscreen toggle */}
            <button
              onClick={toggleFullscreen}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90 ${
                isFullscreen
                  ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)]'
              }`}
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? (
                <FiMinimize className="w-4 h-4" />
              ) : (
                <FiMaximize className="w-4 h-4" />
              )}
            </button>

            {/* More / info */}
            <button
              onClick={() => setActivePanel('info')}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-all active:scale-90"
              title="Room info"
            >
              <FiMoreVertical className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* ── MESSAGES ───────────────────────────────────────────────────── */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto chat-scrollbar px-3 py-4 pb-3 relative"
        >
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center gap-4 px-6">
              <div className="w-14 h-14 rounded-2xl bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 flex items-center justify-center">
                <FiMessageCircle className="w-7 h-7 text-[var(--accent-primary)]" />
              </div>
              <div>
                <p className="font-syne font-bold text-lg tracking-tight mb-1">
                  Ghost town in here
                </p>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  Be the first to break the silence.
                  <br />
                  Messages vanish — no trace left behind.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-0.5">
              {messages.map((message, index) => (
                <div key={message.id}>
                  {/* "New messages" divider */}
                  {lastReadMessageIndex !== null &&
                    index === lastReadMessageIndex + 1 && (
                      <div className="flex items-center gap-3 my-4">
                        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[var(--accent-primary)]/40 to-transparent" />
                        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--accent-primary)] px-3 py-1 rounded-full bg-[var(--accent-primary)]/8 border border-[var(--accent-primary)]/20 font-syne">
                          New Messages
                        </span>
                        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[var(--accent-primary)]/40 to-transparent" />
                      </div>
                    )}

                  <MessageBubble
                    message={message}
                    localReactions={localReactions}
                    onReactionToggle={handleReactionToggle}
                    onLongPress={handleLongPress}
                    onReply={setReplyingTo}
                  />
                </div>
              ))}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ── SCROLL TO BOTTOM ────────────────────────────────────────────── */}
        {showScrollButton && (
          <div className="absolute bottom-[84px] right-3 z-20 pointer-events-none">
            <button
              onClick={scrollToBottom}
              className="pointer-events-auto w-10 h-10 rounded-full bg-[var(--accent-primary)] text-white flex items-center justify-center shadow-[0_4px_20px_rgba(124,92,252,0.5)] hover:scale-105 active:scale-90 transition-transform relative animate-[slideUp_0.2s_ease]"
              aria-label={
                unreadCount > 0
                  ? `${unreadCount} unread, scroll to bottom`
                  : 'Scroll to bottom'
              }
            >
              <FiArrowDown className="w-4.5 h-4.5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--danger)] text-white text-[10px] font-bold flex items-center justify-center border-2 border-[var(--bg-primary)]">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
          </div>
        )}

        {/* ── REPLY BAR ───────────────────────────────────────────────────── */}
        {replyingTo && (
          <div className="shrink-0 flex items-center gap-2.5 px-4 py-2.5 bg-[var(--surface-1)] border-t border-[var(--border-primary)] animate-[slideDown_0.2s_ease]">
            <div className="w-0.5 self-stretch rounded-full bg-[var(--accent-primary)] shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-[var(--accent-primary)] font-semibold uppercase tracking-[0.06em] mb-0.5 font-syne">
                ↩ Replying to
              </p>
              <p className="text-xs text-[var(--text-secondary)] truncate">
                {replyingTo.content}
              </p>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="w-6 h-6 rounded-full bg-[var(--surface-2)] border border-[var(--border-primary)] flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors active:scale-90 shrink-0"
            >
              <FiX className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* ── INPUT AREA ──────────────────────────────────────────────────── */}
        <div className="shrink-0 bg-[var(--surface-1)] border-t border-[var(--border-primary)] px-3 py-2.5 pb-[max(10px,env(safe-area-inset-bottom))] z-20">
          <div className="flex items-end gap-2">
            {/* Ghost mode toggle */}
            <button
              onClick={() => {
                setIsGhostMode((v) => !v);
                Haptics.light();
              }}
              className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all duration-200 shrink-0 active:scale-90 ${
                isGhostMode
                  ? 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)]/40 text-[var(--accent-primary)] shadow-[0_0_12px_var(--accent-glow)]'
                  : 'bg-[var(--bg-primary)] border-[var(--border-primary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:border-[var(--border-accent)]'
              }`}
              title={
                isGhostMode
                  ? 'Ghost Mode: Maximum Anonymity'
                  : 'Spectral Mode: Standard Anonymity'
              }
              aria-pressed={isGhostMode}
            >
              <FiEyeOff
                className={`w-4 h-4 transition-transform duration-200 ${
                  isGhostMode ? 'scale-110' : 'opacity-60'
                }`}
              />
            </button>

            {/* Textarea input */}
            <div
              className={`flex-1 flex items-end gap-1 px-3.5 py-2 rounded-[22px] border bg-[var(--bg-primary)] transition-all min-h-[44px] ${
                isGhostMode
                  ? 'border-dashed border-[var(--accent-primary)]/40 focus-within:border-[var(--accent-primary)] focus-within:shadow-[0_0_0_3px_var(--accent-glow)]'
                  : 'border-[var(--border-primary)] focus-within:border-[var(--accent-primary)] focus-within:shadow-[0_0_0_3px_var(--accent-glow)]'
              }`}
            >
              <textarea
                ref={inputRef}
                value={newMessage}
                onChange={handleInputChange}
                onKeyDown={handleInputKeyDown}
                placeholder={
                  isGhostMode
                    ? 'Ghost Mode: no alias, no trace…'
                    : 'Type anonymously…'
                }
                rows={inputRows}
                maxLength={1000}
                className="flex-1 bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] text-[14.5px] outline-none resize-none leading-relaxed py-0.5"
                style={{ maxHeight: '96px' }}
              />
              {/* Char counter — shows only near limit */}
              {newMessage.length > 800 && (
                <span
                  className={`text-[10px] self-end pb-0.5 font-mono shrink-0 ${
                    newMessage.length > 950
                      ? 'text-[var(--danger)]'
                      : newMessage.length > 900
                      ? 'text-amber-400'
                      : 'text-[var(--text-tertiary)]'
                  }`}
                >
                  {1000 - newMessage.length}
                </span>
              )}
            </div>

            {/* Send button */}
            <button
              onClick={handleSendMessage}
              disabled={!newMessage.trim()}
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all duration-150 active:scale-90 ${
                newMessage.trim()
                  ? 'bg-[var(--accent-primary)] text-white shadow-[0_4px_16px_rgba(124,92,252,0.4)] hover:shadow-[0_4px_20px_rgba(124,92,252,0.6)] hover:scale-105'
                  : 'bg-[var(--surface-2)] text-[var(--text-tertiary)] opacity-50 cursor-not-allowed'
              }`}
            >
              <FiSend className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── TUTORIAL FAB ────────────────────────────────────────────────── */}
        <button
          onClick={() => setActivePanel('tutorial')}
          className="fixed bottom-[84px] left-3 w-9 h-9 rounded-full bg-[var(--surface-2)] border border-[var(--border-primary)] flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors z-19 active:scale-90"
          title="How to use"
          style={{ zIndex: 19 }}
        >
          <FiHelpCircle className="w-4 h-4" />
        </button>
      </div>

      {/* ── BOTTOM SHEET PANELS ──────────────────────────────────────────── */}

      {/* Room Info */}
      <BottomSheet
        open={activePanel === 'info'}
        onClose={closePanel}
        title="Room Info"
      >
        <InfoPanel
          roomName={roomName}
          onlineCount={onlineCount}
          msgCount={messages.length}
          notificationsEnabled={notificationsEnabled}
          onToggleNotifications={handleToggleNotifications}
          slug={resolvedParams.slug}
          onClose={closePanel}
        />
      </BottomSheet>

      {/* Tutorial */}
      <BottomSheet
        open={activePanel === 'tutorial'}
        onClose={closePanel}
        title="How to use Blur Chat"
      >
        <TutorialPanel onClose={closePanel} />
      </BottomSheet>

      {/* React / long-press actions */}
      <BottomSheet
        open={activePanel === 'react'}
        onClose={closePanel}
        title="React"
      >
        <ReactSheet
          onReact={(emoji) => {
            if (activeLongPressMsg)
              handleReactionToggle(activeLongPressMsg, emoji);
            closePanel();
          }}
          onReply={() => {
            if (activeLongPressMessage) setReplyingTo(activeLongPressMessage);
            closePanel();
          }}
          onCopy={() => {
            if (activeLongPressMessage) {
              navigator.clipboard
                .writeText(activeLongPressMessage.content)
                .catch(() => {});
              toast.success('Copied!');
            }
            closePanel();
          }}
        />
      </BottomSheet>
    </>
  );
}