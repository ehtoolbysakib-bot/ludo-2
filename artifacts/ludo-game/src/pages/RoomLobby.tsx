import React, { useEffect } from 'react';
import { useLocation, useParams } from 'wouter';
import { useGetRoomByCode, getGetRoomByCodeQueryKey, useGetMe, getGetMeQueryKey } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Users, Copy, Shield, Coins } from 'lucide-react';
import { toast } from 'sonner';
import splashBg from '@/assets/splash_bg.webp';

export default function RoomLobby() {
  const { code } = useParams();
  const [, setLocation] = useLocation();
  const { data: me } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });

  // Poll room data every 2 seconds to see who joins
  const { data: room, isLoading } = useGetRoomByCode(code!, {
    query: {
      enabled: !!code,
      refetchInterval: 2000,
      queryKey: getGetRoomByCodeQueryKey(code!),
    },
  });

  // Redirect to game board once playing
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

  if (isLoading && !room) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#FFD700] border-t-transparent rounded-full animate-spin"></div>
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

  // Ludo colors
  const colorMap: Record<string, string> = {
    red: '#FF4444',
    blue: '#4444FF',
    green: '#44BB44',
    yellow: '#FFD700',
  };

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
          <div className="w-10"></div>
        </div>

        <div className="flex-1 px-6 flex flex-col max-w-md w-full mx-auto">
          {/* Room code card */}
          <div className="glass-panel p-6 rounded-3xl text-center mb-5 relative">
            <div className="text-[#a790c9] text-xs uppercase tracking-widest mb-2 font-bold">
              রুম কোড
            </div>
            <div className="text-5xl font-black text-white tracking-widest mb-5 flex justify-center items-center gap-4">
              {code}
              <button
                onClick={copyCode}
                className="text-[#FFD700] hover:scale-110 transition-transform"
              >
                <Copy size={24} />
              </button>
            </div>

            <p className="text-[#a790c9] text-sm mb-2">খেলোয়াড়দের জন্য অপেক্ষা করা হচ্ছে...</p>
            <div className="w-full bg-[#1d0f3d] h-2 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-gradient-to-r from-[#4444FF] to-[#8888FF] transition-all"
                style={{
                  width: `${((room.players?.length || 0) / room.maxPlayers) * 100}%`,
                }}
              ></div>
            </div>
            <div className="text-white text-xs font-bold mb-4">
              {room.players?.length || 0} / {room.maxPlayers} জন যোগ দিয়েছে
            </div>

            {/* Info badges — always visible */}
            <div className="flex justify-center gap-3 flex-wrap">
              {/* Bet badge — always show */}
              <div className="flex items-center gap-1.5 bg-[#1d0f3d] border border-[#5c3eb8] rounded-full px-4 py-1.5">
                <Coins size={14} className="text-[#FFD700]" />
                <span className="text-sm text-[#FFD700] font-bold">
                  {betAmount > 0 ? `${betAmount} 🪙 বাজি` : 'বাজি নেই'}
                </span>
              </div>

              {/* Team mode badge — only when active */}
              {teamMode && (
                <div className="flex items-center gap-1.5 bg-[#1d0f3d] border border-[#5c3eb8] rounded-full px-4 py-1.5">
                  <Shield size={14} className="text-[#FFD700]" />
                  <span className="text-sm text-[#FFD700] font-bold">টিম মোড</span>
                </div>
              )}
            </div>
          </div>

          {/* Players section */}
          <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
            <Users size={20} className="text-[#FFD700]" /> খেলোয়াড়রা
          </h3>

          <div className="flex flex-col gap-3 flex-1">
            {room.players?.map((p, i) => (
              <div
                key={i}
                className="glass-panel p-4 rounded-2xl flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-full border-4 overflow-hidden bg-[#1d0f3d]"
                    style={{ borderColor: colorMap[p.color] || '#ccc' }}
                  >
                    <img
                      src={
                        p.avatarUrl ||
                        `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.displayName}`
                      }
                      alt={p.displayName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <div className="font-bold text-white text-lg">{p.displayName}</div>
                    {p.clerkId === room.hostId && (
                      <div className="text-xs text-[#FFD700] uppercase font-bold tracking-wider">
                        হোস্ট
                      </div>
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

            {/* Empty slots */}
            {Array.from({
              length: room.maxPlayers - (room.players?.length || 0),
            }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="border-2 border-dashed border-[#3a2382] p-4 rounded-2xl flex items-center gap-3 opacity-50"
              >
                <div className="w-12 h-12 rounded-full border-4 border-[#3a2382] bg-[#1d0f3d]"></div>
                <div className="font-bold text-[#a790c9] text-lg">অপেক্ষমান...</div>
              </div>
            ))}
          </div>

          <div className="mt-8">
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
