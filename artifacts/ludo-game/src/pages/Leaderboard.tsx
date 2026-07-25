import React from 'react';
import { useLocation } from 'wouter';
import { ChevronLeft, Trophy, Medal } from 'lucide-react';
import { useGetLeaderboard, getGetLeaderboardQueryKey } from '@workspace/api-client-react';
import { BottomNav } from '@/components/BottomNav';
import splashBg from '@/assets/splash_bg.webp';

export default function Leaderboard() {
  const [, setLocation] = useLocation();
  const { data: leaderboard, isLoading } = useGetLeaderboard({ query: { queryKey: getGetLeaderboardQueryKey() } });

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1: return 'from-[#FFD700] to-[#FFA500] text-[#1a0533] glow-box';
      case 2: return 'from-[#E0E0E0] to-[#BDBDBD] text-[#1a0533] shadow-[0_0_15px_rgba(224,224,224,0.4)]';
      case 3: return 'from-[#CD7F32] to-[#A0522D] text-white shadow-[0_0_15px_rgba(205,127,50,0.4)]';
      default: return 'from-[#3a2382] to-[#2d1b69] text-white border border-[#5c3eb8]';
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-0" style={{ backgroundImage: `url(${splashBg})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }} />
      <div className="fixed inset-0 z-0" style={{ background: 'linear-gradient(180deg, rgba(10,5,30,0.75) 0%, rgba(10,5,30,0.55) 40%, rgba(10,5,30,0.88) 100%)' }} />
    <div className="min-h-[100dvh] flex flex-col pb-28 relative z-10">
      {/* Header */}
      <div className="p-6 flex items-center gap-4">
        <button onClick={() => setLocation('/home')} className="w-10 h-10 rounded-full bg-[#3a2382] flex items-center justify-center text-white active:scale-95">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Trophy className="text-[#FFD700]" /> Leaderboard
        </h1>
      </div>

      <div className="px-6 flex-1 max-w-md w-full mx-auto">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-12 h-12 border-4 border-[#FFD700] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {leaderboard?.map((player) => (
              <div key={player.rank} className={`rounded-2xl p-4 flex items-center gap-4 bg-gradient-to-r ${getRankColor(player.rank)}`}>
                <div className="w-8 flex justify-center font-black text-xl">
                  #{player.rank}
                </div>
                <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-current bg-[#1d0f3d]">
                  <img src={player.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${player.displayName}`} alt={player.displayName} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-lg leading-tight">{player.displayName}</div>
                  <div className="text-sm opacity-80 font-medium">Level {player.level}</div>
                </div>
                <div className="text-right">
                  <div className="font-black text-xl leading-tight">{player.wins}</div>
                  <div className="text-[10px] uppercase tracking-wider opacity-80">Wins</div>
                </div>
              </div>
            ))}
            {(!leaderboard || leaderboard.length === 0) && (
              <div className="text-center text-[#a790c9] py-10">No ranked players yet.</div>
            )}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
    </>
  );
}
