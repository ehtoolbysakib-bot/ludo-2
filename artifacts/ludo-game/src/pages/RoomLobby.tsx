import React, { useEffect } from 'react';
import { useLocation, useParams } from 'wouter';
import { useGetRoomByCode, getGetRoomByCodeQueryKey, useGetMe, getGetMeQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Users, Copy, Shield, Coins, ArrowLeftRight } from 'lucide-react';
import { toast } from 'sonner';
import splashBg from '@/assets/splash_bg.webp';

const COLOR_LABEL: Record<string, string> = {
  blue: 'নীল',
  green: 'সবুজ',
  red: 'লাল',
  yellow: 'হলুদ',
};

const COLOR_HEX: Record<string, string> = {
  blue: '#4444FF',
  green: '#44BB44',
  red: '#FF4444',
  yellow: '#FFD700',
};

// Team 1 = blue + green, Team 2 = red + yellow
const TEAM1_COLORS = ['blue', 'green'];

export default function RoomLobby() {
  const { code } = useParams();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: me } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });

  const { data: room, isLoading } = useGetRoomByCode(code!, {
    query: {
      enabled: !!code,
      refetchInterval: 2000,
      queryKey: getGetRoomByCodeQueryKey(code!),
    },
  });

  useEffect(() => {
    if (room?.status === 'playing') {
      setLocation(`/game/${code}`);
    }
  }, [room?.status, code, setLocation]);

  const copyCode = () => {
    if (code) {
      navigator.clipboard.writeText(code);
      toast.success('রুম কোড কপি হয়েছে!');
    }
  };

  const isHost = room?.hostId === me?.clerkId;
  const canStart = isHost && (room?.players?.length || 0) >= 2;
  const [isStarting, setIsStarting] = React.useState(false);

  // Team swap state: first selected player's clerkId
  const [swapSelected, setSwapSelected] = React.useState<string | null>(null);
  const [isSwapping, setIsSwapping] = React.useState(false);

  const handleStart = async () => {
    if (!code || isStarting) return;
    setIsStarting(true);
    try {
      const res = await fetch(`/api/rooms/${code}/start`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error || 'খেলা শুরু করতে সমস্যা হয়েছে');
        setIsStarting(false);
        return;
      }
      setLocation(`/game/${code}`);
    } catch {
      toast.error('নেটওয়ার্ক সমস্যা, আবার চেষ্টা করুন');
      setIsStarting(false);
    }
  };

  const handlePlayerTap = async (clerkId: string) => {
    if (!isHost || !teamMode) return;

    // Deselect if tapping same player
    if (swapSelected === clerkId) {
      setSwapSelected(null);
      return;
    }

    // First selection
    if (!swapSelected) {
      setSwapSelected(clerkId);
      return;
    }

    // Second selection → perform swap
    setIsSwapping(true);
    try {
      const res = await fetch(`/api/rooms/${code}/swap-colors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clerkId1: swapSelected, clerkId2: clerkId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error || 'টিম পরিবর্তন করা যায়নি');
      } else {
        toast.success('টিম পরিবর্তন হয়েছে!');
        queryClient.invalidateQueries({ queryKey: getGetRoomByCodeQueryKey(code!) });
      }
    } catch {
      toast.error('নেটওয়ার্ক সমস্যা');
    } finally {
      setSwapSelected(null);
      setIsSwapping(false);
    }
  };

  if (isLoading && !room) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#FFD700] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-bold text-white mb-4">রুম পাওয়া যায়নি</h2>
        <Button onClick={() => setLocation('/home')}>হোমে যান</Button>
      </div>
    );
  }

  const betAmount: number = (room as any).betAmount ?? 0;
  const teamMode: boolean = (room as any).teamMode ?? false;
  const players: any[] = (room.players as any[]) || [];

  const team1 = players.filter((p) => TEAM1_COLORS.includes(p.color));
  const team2 = players.filter((p) => !TEAM1_COLORS.includes(p.color));

  return (
    <>
      <div
        className="fixed inset-0 z-0"
        style={{
          backgroundImage: `url(${splashBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />
      <div
        className="fixed inset-0 z-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(10,5,30,0.75) 0%, rgba(10,5,30,0.55) 40%, rgba(10,5,30,0.88) 100%)',
        }}
      />
      <div className="min-h-[100dvh] flex flex-col pb-10 relative z-10">
        {/* Header */}
        <div className="p-6 flex items-center justify-between">
          <button
            onClick={() => setLocation('/home')}
            className="w-10 h-10 rounded-full bg-[#3a2382] flex items-center justify-center text-white active:scale-95"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-xl font-bold text-white">লবি</h1>
          <div className="w-10" />
        </div>

        <div className="flex-1 px-6 flex flex-col max-w-md w-full mx-auto">
          {/* Room code card */}
          <div className="glass-panel p-6 rounded-3xl text-center mb-5">
            <div className="text-[#a790c9] text-xs uppercase tracking-widest mb-2 font-bold">
              রুম কোড
            </div>
            <div className="text-5xl font-black text-white tracking-widest mb-5 flex justify-center items-center gap-4">
              {code}
              <button onClick={copyCode} className="text-[#FFD700] hover:scale-110 transition-transform">
                <Copy size={24} />
              </button>
            </div>

            <p className="text-[#a790c9] text-sm mb-2">
              খেলোয়াড়দের জন্য অপেক্ষা করা হচ্ছে...
            </p>
            <div className="w-full bg-[#1d0f3d] h-2 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-gradient-to-r from-[#4444FF] to-[#8888FF] transition-all"
                style={{ width: `${(players.length / room.maxPlayers) * 100}%` }}
              />
            </div>
            <div className="text-white text-xs font-bold mb-4">
              {players.length} / {room.maxPlayers} জন যোগ দিয়েছে
            </div>

            {/* Info badges */}
            <div className="flex justify-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 bg-[#1d0f3d] border border-[#5c3eb8] rounded-full px-4 py-1.5">
                <Coins size={14} className="text-[#FFD700]" />
                <span className="text-sm text-[#FFD700] font-bold">
                  {betAmount > 0 ? `${betAmount} 🪙 বাজি` : 'বাজি নেই'}
                </span>
              </div>
              {teamMode && (
                <div className="flex items-center gap-1.5 bg-[#1d0f3d] border border-[#5c3eb8] rounded-full px-4 py-1.5">
                  <Shield size={14} className="text-[#FFD700]" />
                  <span className="text-sm text-[#FFD700] font-bold">টিম মোড</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Team Mode layout ── */}
          {teamMode ? (
            <>
              {isHost && (
                <p className="text-[#a790c9] text-xs text-center mb-3 flex items-center justify-center gap-1">
                  <ArrowLeftRight size={12} />
                  দুইজন খেলোয়াড়কে পর্যায়ক্রমে ট্যাপ করলে তাদের টিম অদলবদল হবে
                </p>
              )}

              <div className="flex gap-3 mb-5">
                {/* Team 1 */}
                <div className="flex-1">
                  <div className="text-xs font-bold uppercase tracking-wider text-center mb-2 text-[#a790c9]">
                    দল ১ <span className="text-[10px]">(নীল · সবুজ)</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {team1.map((p) => (
                      <TeamPlayerCard
                        key={p.clerkId}
                        player={p}
                        isHost={isHost}
                        isMe={p.clerkId === me?.clerkId}
                        isRoomHost={p.clerkId === room.hostId}
                        selected={swapSelected === p.clerkId}
                        swapping={isSwapping}
                        onTap={() => handlePlayerTap(p.clerkId)}
                      />
                    ))}
                    {/* Empty slot */}
                    {team1.length < 2 && (
                      <div className="border-2 border-dashed border-[#3a2382] p-3 rounded-2xl flex items-center gap-2 opacity-40">
                        <div className="w-9 h-9 rounded-full border-2 border-[#3a2382] bg-[#1d0f3d]" />
                        <span className="text-[#a790c9] text-sm">অপেক্ষমান...</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Divider */}
                <div className="flex flex-col items-center justify-center gap-1 px-1">
                  <div className="w-px flex-1 bg-[#3a2382]" />
                  <span className="text-[#FFD700] font-black text-xs">VS</span>
                  <div className="w-px flex-1 bg-[#3a2382]" />
                </div>

                {/* Team 2 */}
                <div className="flex-1">
                  <div className="text-xs font-bold uppercase tracking-wider text-center mb-2 text-[#a790c9]">
                    দল ২ <span className="text-[10px]">(লাল · হলুদ)</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {team2.map((p) => (
                      <TeamPlayerCard
                        key={p.clerkId}
                        player={p}
                        isHost={isHost}
                        isMe={p.clerkId === me?.clerkId}
                        isRoomHost={p.clerkId === room.hostId}
                        selected={swapSelected === p.clerkId}
                        swapping={isSwapping}
                        onTap={() => handlePlayerTap(p.clerkId)}
                      />
                    ))}
                    {/* Empty slots */}
                    {Array.from({ length: 2 - team2.length }).map((_, i) => (
                      <div
                        key={`t2-empty-${i}`}
                        className="border-2 border-dashed border-[#3a2382] p-3 rounded-2xl flex items-center gap-2 opacity-40"
                      >
                        <div className="w-9 h-9 rounded-full border-2 border-[#3a2382] bg-[#1d0f3d]" />
                        <span className="text-[#a790c9] text-sm">অপেক্ষমান...</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* ── Normal player list ── */
            <>
              <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                <Users size={20} className="text-[#FFD700]" /> খেলোয়াড়রা
              </h3>
              <div className="flex flex-col gap-3 mb-5">
                {players.map((p, i) => (
                  <div key={i} className="glass-panel p-4 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-full border-4 overflow-hidden bg-[#1d0f3d]"
                        style={{ borderColor: COLOR_HEX[p.color] || '#ccc' }}
                      >
                        <img
                          src={p.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.displayName}`}
                          alt={p.displayName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <div className="font-bold text-white text-base">{p.displayName}</div>
                        {p.clerkId === room.hostId && (
                          <div className="text-xs text-[#FFD700] uppercase font-bold tracking-wider">হোস্ট</div>
                        )}
                      </div>
                    </div>
                    {p.clerkId === me?.clerkId ? (
                      <div className="bg-[#44BB44]/20 text-[#44BB44] px-3 py-1 rounded-full text-xs font-bold">
                        আপনি
                      </div>
                    ) : (
                      <div className="text-[#a790c9] text-sm">যোগ দিয়েছে</div>
                    )}
                  </div>
                ))}
                {Array.from({ length: room.maxPlayers - players.length }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="border-2 border-dashed border-[#3a2382] p-4 rounded-2xl flex items-center gap-3 opacity-50"
                  >
                    <div className="w-12 h-12 rounded-full border-4 border-[#3a2382] bg-[#1d0f3d]" />
                    <div className="font-bold text-[#a790c9] text-lg">অপেক্ষমান...</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Start button */}
          <div className="mt-auto pt-4">
            {isHost ? (
              <Button
                className="w-full h-16 text-xl"
                onClick={handleStart}
                disabled={!canStart || isStarting}
              >
                {isStarting
                  ? 'শুরু হচ্ছে...'
                  : canStart
                  ? 'খেলা শুরু করুন'
                  : 'আরও খেলোয়াড়ের জন্য অপেক্ষা করুন...'}
              </Button>
            ) : (
              <div className="glass-panel p-4 rounded-xl text-center text-[#FFD700] font-bold animate-pulse">
                হোস্ট খেলা শুরু করার অপেক্ষায় আছেন...
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Small team player card component ── */
function TeamPlayerCard({
  player,
  isHost,
  isMe,
  isRoomHost,
  selected,
  swapping,
  onTap,
}: {
  player: any;
  isHost: boolean;
  isMe: boolean;
  isRoomHost: boolean;
  selected: boolean;
  swapping: boolean;
  onTap: () => void;
}) {
  return (
    <button
      onClick={isHost && !swapping ? onTap : undefined}
      disabled={swapping}
      className={`w-full glass-panel p-3 rounded-2xl flex items-center gap-2 text-left transition-all ${
        selected
          ? 'ring-2 ring-[#FFD700] scale-[1.03]'
          : isHost
          ? 'active:scale-95 hover:ring-1 hover:ring-[#5c3eb8]'
          : ''
      }`}
    >
      <div
        className="w-9 h-9 rounded-full border-[3px] overflow-hidden bg-[#1d0f3d] flex-shrink-0"
        style={{ borderColor: COLOR_HEX[player.color] || '#ccc' }}
      >
        <img
          src={player.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${player.displayName}`}
          alt={player.displayName}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-white text-sm truncate">{player.displayName}</div>
        <div className="text-[10px]" style={{ color: COLOR_HEX[player.color] }}>
          {COLOR_LABEL[player.color] || player.color}
          {isRoomHost && <span className="text-[#FFD700] ml-1">· হোস্ট</span>}
        </div>
      </div>
      {isMe && (
        <div className="bg-[#44BB44]/20 text-[#44BB44] px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0">
          আপনি
        </div>
      )}
      {selected && (
        <ArrowLeftRight size={14} className="text-[#FFD700] flex-shrink-0 animate-pulse" />
      )}
    </button>
  );
}
