'use client';

import { useState, useEffect, useCallback, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  FiMessageCircle,
  FiPlus,
  FiCopy,
  FiLogOut,
  FiExternalLink,
  FiTrash2,
  FiAlertTriangle,
} from 'react-icons/fi';
import Button from '@/components/Button';
import Input from '@/components/Input';
import Card from '@/components/Card';
import { Durations } from '@/components/Durations';

interface Room {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  expiresAt?: Date | null;
}

// ── Expiry countdown ──────────────────────────────────────────────────────────
function useCountdown(expiresAt?: Date | null) {
  const [label, setLabel] = useState('');

  useEffect(() => {
    if (!expiresAt) return;

    const target = new Date(expiresAt).getTime();

    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) {
        setLabel('Expired');
        return;
      }
      const totalMinutes = Math.floor(diff / 60000);
      const days = Math.floor(totalMinutes / 1440);
      const hours = Math.floor((totalMinutes % 1440) / 60);
      const minutes = totalMinutes % 60;

      if (days > 0) setLabel(`${days}d ${hours}h left`);
      else if (hours > 0) setLabel(`${hours}h ${minutes}m left`);
      else setLabel(`${minutes}m left`);
    };

    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return label;
}

// ── Skeleton card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-primary)] p-6 animate-pulse">
      <div className="flex justify-between items-start mb-3">
        <div className="h-5 w-40 bg-[var(--bg-elevated)] rounded-lg" />
        <div className="h-5 w-16 bg-[var(--bg-elevated)] rounded-md" />
      </div>
      <div className="h-3 w-28 bg-[var(--bg-elevated)] rounded mb-2" />
      <div className="h-3 w-36 bg-[var(--bg-elevated)] rounded mb-6" />
      <div className="flex gap-2">
        <div className="flex-1 h-9 bg-[var(--bg-elevated)] rounded-xl" />
        <div className="flex-1 h-9 bg-[var(--bg-elevated)] rounded-xl" />
      </div>
    </div>
  );
}

// ── Room card ─────────────────────────────────────────────────────────────────
function RoomCard({
  room,
  onCopy,
  onDelete,
}: {
  room: Room;
  onCopy: (slug: string) => void;
  onDelete: (room: Room) => void;
}) {
  const countdown = useCountdown(room.expiresAt);

  return (
    <Card hover className="p-6 animate-fade-in flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-start mb-2 gap-2">
          <h3 className="text-lg font-semibold truncate flex-1">{room.name}</h3>
          {!room.expiresAt ? (
            <span className="shrink-0 text-[10px] uppercase tracking-wider px-2 py-1 rounded-md bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border border-green-500/20">
              Permanent
            </span>
          ) : (
            <span className="shrink-0 text-[10px] uppercase tracking-wider px-2 py-1 rounded-md bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border border-[var(--accent-primary)]/20">
              Temporary
            </span>
          )}
        </div>

        <p className="text-sm text-[var(--text-tertiary)] mb-1">
          Created {new Date(room.createdAt).toLocaleDateString()}
        </p>

        <p className="text-xs mb-4">
          {room.expiresAt ? (
            <span className="text-[var(--error)]">{countdown || 'Calculating…'}</span>
          ) : (
            <span className="text-[var(--text-tertiary)]">No expiration set</span>
          )}
        </p>
      </div>

      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onCopy(room.slug)}
          className="flex-1 flex items-center justify-center gap-2"
        >
          <FiCopy className="w-4 h-4" />
          Copy Link
        </Button>
        <Link href={`/room/${room.slug}`} className="flex-1">
          <Button
            variant="primary"
            size="sm"
            className="w-full flex items-center justify-center gap-2"
          >
            <FiExternalLink className="w-4 h-4" />
            Open
          </Button>
        </Link>
        <button
          onClick={() => onDelete(room)}
          className="flex items-center justify-center w-9 h-9 rounded-xl border border-[var(--border-primary)] text-[var(--text-tertiary)] hover:border-[var(--error)] hover:text-[var(--error)] hover:bg-[var(--error)]/5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--error)]"
          aria-label={`Delete room ${room.name}`}
        >
          <FiTrash2 className="w-4 h-4" />
        </button>
      </div>
    </Card>
  );
}

// ── Delete confirmation modal ─────────────────────────────────────────────────
function DeleteModal({
  room,
  onConfirm,
  onCancel,
  isDeleting,
}: {
  room: Room;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in"
      onClick={onCancel}
    >
      <div
        className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-primary)] p-8 max-w-sm w-full shadow-[var(--shadow-lg)] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[var(--error)]/10 flex items-center justify-center shrink-0">
            <FiAlertTriangle className="w-5 h-5 text-[var(--error)]" />
          </div>
          <h2 className="text-xl font-bold">Delete Room</h2>
        </div>
        <p className="text-[var(--text-secondary)] mb-6">
          Are you sure you want to delete <span className="font-semibold text-[var(--text-primary)]">{room.name}</span>? This will permanently remove the room and all its messages.
        </p>
        <div className="flex gap-3">
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={onCancel}
            className="flex-1"
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 px-6 py-3 rounded-xl bg-[var(--error)] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isDeleting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Deleting…
              </>
            ) : (
              <>
                <FiTrash2 className="w-4 h-4" />
                Delete
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ username: string } | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [duration, setDuration] = useState('24');
  const [roomName, setRoomName] = useState('');
  const [roomPassword, setRoomPassword] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<Room | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const checkAuth = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me');
      const data = await response.json();
      if (!data.user) {
        router.push('/login');
        return;
      }
      setUser(data.user);
    } catch {
      router.push('/login');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const fetchRooms = useCallback(async () => {
    try {
      const response = await fetch('/api/rooms');
      const data = await response.json();
      if (response.ok) setRooms(data.rooms);
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
    }
  }, []);

  useEffect(() => {
    checkAuth();
    fetchRooms();
  }, [checkAuth, fetchRooms]);

  const handleCreateRoom = async (e: FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: roomName, password: roomPassword, duration: parseInt(duration) }),
      });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to create room');
        return;
      }

      toast.success('Room created successfully!');
      setRooms((prev) => [data.room, ...prev]);
      setShowCreateModal(false);
      setRoomName('');
      setRoomPassword('');
      setDuration('24');
    } catch {
      toast.error('Something went wrong');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteRoom = async () => {
    if (!roomToDelete) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/rooms/${roomToDelete.slug}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || 'Failed to delete room');
        return;
      }
      setRooms((prev) => prev.filter((r) => r.id !== roomToDelete.id));
      toast.success('Room deleted');
      setRoomToDelete(null);
    } catch {
      toast.error('Something went wrong');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      toast.success('Logged out successfully');
      router.push('/');
    } catch {
      toast.error('Failed to logout');
    }
  };

  const copyRoomLink = (slug: string) => {
    const link = `${window.location.origin}/room/${slug}`;
    navigator.clipboard.writeText(link);
    toast.success('Link copied to clipboard!');
  };

  // ── Skeleton loading ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen">
        <nav className="bg-[var(--bg-secondary)] border-b border-[var(--border-primary)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[var(--bg-elevated)] animate-pulse" />
                <div className="h-5 w-12 bg-[var(--bg-elevated)] rounded animate-pulse" />
              </div>
              <div className="h-8 w-20 bg-[var(--bg-elevated)] rounded-xl animate-pulse" />
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <div className="h-8 w-48 bg-[var(--bg-elevated)] rounded-lg animate-pulse mb-2" />
              <div className="h-4 w-64 bg-[var(--bg-elevated)] rounded animate-pulse" />
            </div>
            <div className="h-10 w-32 bg-[var(--bg-elevated)] rounded-xl animate-pulse" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <nav className="bg-[var(--bg-secondary)] border-b border-[var(--border-primary)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center">
                <FiMessageCircle className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-semibold">Blur</span>
            </Link>
            <div className="flex items-center gap-4">
              <span className="text-sm text-[var(--text-secondary)]">{user?.username}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="flex items-center gap-2"
              >
                <FiLogOut className="w-4 h-4" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Your Chat Rooms</h1>
            <p className="text-[var(--text-secondary)]">
              Create and manage your anonymous chat rooms
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 w-full sm:w-auto"
          >
            <FiPlus className="w-5 h-5" />
            Create Room
          </Button>
        </div>

        {rooms.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 rounded-full bg-[var(--accent-glow)] flex items-center justify-center mx-auto mb-4">
                <FiMessageCircle className="w-8 h-8 text-[var(--accent-primary)]" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No rooms yet</h3>
              <p className="text-[var(--text-secondary)] mb-6">
                Create your first chat room to get started
              </p>
              <Button
                variant="primary"
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 mx-auto"
              >
                <FiPlus className="w-5 h-5" />
                Create Your First Room
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {rooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                onCopy={copyRoomLink}
                onDelete={setRoomToDelete}
              />
            ))}
          </div>
        )}
      </main>

      {/* Create Room Modal — closes on backdrop click */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-primary)] p-8 max-w-md w-full shadow-[var(--shadow-lg)] animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold mb-6">Create New Room</h2>
            <form onSubmit={handleCreateRoom} className="space-y-5">
              <Input
                label="Room Name"
                type="text"
                placeholder="e.g., Team Discussion"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                required
                minLength={3}
                maxLength={50}
              />
              <Input
                label="Room Password"
                type="password"
                placeholder="Set a password for the room"
                value={roomPassword}
                onChange={(e) => setRoomPassword(e.target.value)}
                required
                minLength={4}
              />
              <Durations value={duration} onChange={setDuration} />
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={isCreating}
                  className="flex-1"
                >
                  Create Room
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {roomToDelete && (
        <DeleteModal
          room={roomToDelete}
          onConfirm={handleDeleteRoom}
          onCancel={() => setRoomToDelete(null)}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
}
