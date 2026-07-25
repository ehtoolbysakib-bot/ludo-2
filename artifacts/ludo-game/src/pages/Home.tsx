import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { BottomNav } from '@/components/BottomNav';
import { LoginModal } from '@/components/LoginModal';
import {
  useGetMe, useGetMyStats, useClaimDailyReward,
  getGetMyStatsQueryKey, getGetMeQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { Coins, Trophy, Plus, Users, Gift, Star, Crown } from 'lucide-react';
import { toast } from 'sonner';
import splashBg from '@/assets/splash_bg.webp';
import splashLogo from '@/assets/splash_logo.webp';

/* ─── tiny SVG game pieces ──────────────────────────────────────────────────── */
const Piece = ({ color, className = '' }: { color: string; className?: string }) => (
  <svg viewBox="0 0 24 32" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="12" cy="28" rx="7" ry="3" fill={color} opacity=".4" />
    <path d="M12 2C9.24 2 7 4.24 7 7c0 2.1 1.21 3.93 3 4.79V14l-3 6h10l-3-6v-2.21A5.003 5.003 0 0 0 17 7c0-2.76-2.24-5-5-5Z" fill={color} />
    <path d="M12 2C9.24 2 7 4.24 7 7c0 2.1 1.21 3.93 3 4.79V14l-3 6h10l-3-6v-2.21A5.003 5.003 0 0 0 17 7c0-2.76-2.24-5-5-5Z" fill="white" opacity=".18" />
  </svg>
);

const DieFace = ({ n }: { n: number }) => {
  const dots: [number, number][] = {
    1: [[50, 50]],
    2: [[25, 25], [75, 75]],
    3: [[25, 25], [50, 50], [75, 75]],
    4: [[25, 25], [75, 25], [25, 75], [75, 75]],
    5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
    6: [[25, 20], [75, 20], [25, 50], [75, 50], [25, 80], [75, 80]],
  }[n] ?? [[50, 50]];
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <rect x="5" y="5" width="90" height="90" rx="18" fill="white" />
      <rect x="5" y="5" width="90" height="90" rx="18" fill="none" stroke="#e0c060" strokeWidth="3" />
      {dots.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="8" fill="#2d1b69" />
      ))}
    </svg>
  );
};

/* ─── stat pill ────────────────────────────────────────────────────────────── */
function StatPill({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="flex-1 rounded-2xl py-4 text-center relative overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${color}44` }}>
      <div className="text-2xl font-black" style={{ color }}>{value}</div>
      <div className="text-xs text-white/50 mt-0.5 font-medium">{label}</div>
    </div>
  );
}

/* ─── Home ───────────────────────────────────────────────────────────────────── */
export default function Home() {
  const [, setLocation] = useLocation();
  const { isSignedIn } = useAuth();
  const [loginTarget, setLoginTarget] = useState<'/room/create' | '/room/join' | null>(null);

  const { data: user } = useGetMe({ query: { enabled: isSignedIn, queryKey: getGetMeQueryKey() } });
  const { data: stats } = useGetMyStats({ query: { enabled: isSignedIn, queryKey: getGetMyStatsQueryKey() } });
  const claimReward = useClaimDailyReward();
  const queryClient = useQueryClient();

  const handleClaim = () => {
    claimReward.mutate(undefined, {
      onSuccess: (res) => {
        toast.success(`🎉 ${res.coinsEarned} coins পেয়েছ!`);
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMyStatsQueryKey() });
      },
      onError: (err: any) => { toast.error(err.message || 'আজকের reward আগেই নেওয়া হয়েছে!'); },
    });
  };

  const guardedNavigate = (path: '/room/create' | '/room/join') => {
    if (!isSignedIn) setLoginTarget(path);
    else setLocation(path);
  };

  return (
    <>
      {/* ── Background ── */}
      <div className="fixed inset-0 z-0"
        style={{ backgroundImage: `url(${splashBg})`, backgroundSize: 'cover', backgroundPosition: 'center bottom', backgroundRepeat: 'no-repeat' }} />
      <div className="fixed inset-0 z-0" style={{ background: 'linear-gradient(180deg, rgba(10,5,30,0.72) 0%, rgba(10,5,30,0.55) 40%, rgba(10,5,30,0.82) 100%)' }} />

      {/* ── Login modal ── */}
      {loginTarget && (
        <LoginModal
          onClose={() => setLoginTarget(null)}
          onSuccess={() => { setLoginTarget(null); setLocation('/home'); }}
        />
      )}

      {/* ── Scrollable content ── */}
      <div className="relative z-10 min-h-screen pb-28 flex flex-col">

        {/* ══ HEADER ══ */}
        <div className="flex items-center justify-between px-4 pt-5 pb-3">
          {/* Logo */}
          <img src={splashLogo} alt="Anaya's Board" className="h-14 object-contain"
            style={{ mixBlendMode: 'lighten', filter: 'drop-shadow(0 0 8px #FFD70066)' }} />

          {/* Right — user avatar or login */}
          {isSignedIn ? (
            <Link href="/profile">
              <div className="flex items-center gap-2.5 cursor-pointer">
                <div className="text-right">
                  <div className="text-white font-bold text-sm leading-tight">{user?.displayName || 'Player'}</div>
                  <div className="flex items-center gap-1 justify-end mt-0.5">
                    <Coins size={11} className="text-[#FFD700]" />
                    <span className="text-[#FFD700] text-xs font-bold">{user?.coins ?? 0}</span>
                    <span className="text-white/30 text-xs">·</span>
                    <Star size={11} className="text-[#FFA500]" />
                    <span className="text-white/70 text-xs">Lv {user?.level ?? 1}</span>
                  </div>
                </div>
                <div className="w-11 h-11 rounded-full overflow-hidden"
                  style={{ border: '2px solid #FFD700', padding: '2px', background: '#1d0f3d' }}>
                  <img src={user?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.displayName || 'player'}`}
                    alt="Avatar" className="w-full h-full rounded-full" />
                </div>
              </div>
            </Link>
          ) : (
            <button onClick={() => setLoginTarget('/room/create')}
              className="px-4 py-2 rounded-full text-sm font-bold text-[#FFD700] transition-colors"
              style={{ border: '1px solid #FFD70066', background: 'rgba(255,215,0,0.08)' }}>
              লগইন
            </button>
          )}
        </div>

        {/* decorative floating pieces (visual only) */}
        <div className="relative flex justify-center gap-4 mb-1 px-4 pointer-events-none select-none">
          {[
            { color: '#E63946', style: { animation: 'float1 3.2s ease-in-out infinite' } },
            { color: '#FFBA08', style: { animation: 'float1 3.8s 0.5s ease-in-out infinite' } },
            { color: '#06D6A0', style: { animation: 'float1 3s 1s ease-in-out infinite' } },
            { color: '#4361EE', style: { animation: 'float1 3.5s 0.3s ease-in-out infinite' } },
          ].map(({ color, style }, i) => (
            <Piece key={i} color={color} className="w-6 h-8 opacity-70 drop-shadow-lg" style={style as any} />
          ))}
        </div>

        {/* ══ MAIN ACTION CARD ══ */}
        <div className="px-4 mb-4">
          <div className="rounded-3xl overflow-hidden relative"
            style={{ border: '1.5px solid rgba(255,215,0,0.35)', background: 'rgba(20,8,50,0.72)', backdropFilter: 'blur(12px)' }}>
            {/* gold top border */}
            <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg,transparent,#FFD700,transparent)' }} />
            <div className="p-5">
              {/* die decoration top-right */}
              <div className="absolute top-4 right-4 w-12 h-12 opacity-25 pointer-events-none">
                <DieFace n={6} />
              </div>
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-1">
                  <Crown size={18} className="text-[#FFD700]" />
                  <span className="text-[#FFD700] font-black text-xl tracking-wide">খেলা শুরু</span>
                </div>
                <p className="text-white/60 text-sm">রুম তৈরি করো বা কোড দিয়ে যোগ দাও</p>
              </div>

              {/* piece colour strip */}
              <div className="flex gap-1.5 mb-5">
                {['#E63946','#FFBA08','#06D6A0','#4361EE'].map((c, i) => (
                  <div key={i} className="h-1.5 flex-1 rounded-full" style={{ background: c, boxShadow: `0 0 6px ${c}99` }} />
                ))}
              </div>

              <div className="flex gap-3">
                <button onClick={() => guardedNavigate('/room/create')}
                  className="flex-1 h-14 rounded-2xl flex items-center justify-center gap-2 text-lg font-black text-[#1a0533] active:scale-95 transition-transform"
                  style={{ background: 'linear-gradient(135deg,#FFD700,#FFA500)', boxShadow: '0 4px 20px #FFD70055' }}>
                  <Plus size={20} strokeWidth={3} /> রুম তৈরি
                </button>
                <button onClick={() => guardedNavigate('/room/join')}
                  className="flex-1 h-14 rounded-2xl flex items-center justify-center gap-2 text-lg font-black text-white active:scale-95 transition-transform"
                  style={{ background: 'rgba(255,255,255,0.1)', border: '1.5px solid rgba(255,255,255,0.2)' }}>
                  <Users size={20} /> যোগ দাও
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ══ STATS (signed-in only) ══ */}
        {isSignedIn && (
          <div className="px-4 mb-4">
            <div className="rounded-3xl overflow-hidden"
              style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(20,8,50,0.65)', backdropFilter: 'blur(10px)' }}>
              <div className="px-5 pt-4 pb-1 flex items-center gap-2">
                <Trophy size={16} className="text-[#FFD700]" />
                <span className="text-white font-bold text-base">তোমার রেকর্ড</span>
              </div>
              <div className="flex gap-2 p-4">
                <StatPill label="Matches" value={stats?.matches ?? 0} color="#a790c9" />
                <StatPill label="Wins" value={stats?.wins ?? 0} color="#06D6A0" />
                <StatPill label="Win %" value={`${Math.round((stats?.winRate ?? 0) * 100)}%`} color="#FFD700" />
                <StatPill label="Losses" value={stats?.losses ?? 0} color="#E63946" />
              </div>
            </div>
          </div>
        )}

        {/* ══ DAILY REWARD (signed-in only) ══ */}
        {isSignedIn && (
          <div className="px-4 mb-4">
            <div className="rounded-3xl overflow-hidden relative"
              style={{ border: '1px solid rgba(255,186,8,0.3)', background: 'rgba(20,8,50,0.65)', backdropFilter: 'blur(10px)' }}>
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg,#FFD700,#FF6B35)', boxShadow: '0 0 14px #FFD70055' }}>
                    <Gift size={20} className="text-white" />
                  </div>
                  <div>
                    <div className="text-white font-bold text-sm">Daily Reward</div>
                    <div className="text-white/50 text-xs">প্রতিদিন ফ্রি coins</div>
                  </div>
                </div>
                <button onClick={handleClaim} disabled={claimReward.isPending}
                  className="px-5 py-2.5 rounded-2xl font-black text-sm text-[#1a0533] disabled:opacity-50 active:scale-95 transition-transform"
                  style={{ background: 'linear-gradient(135deg,#FFD700,#FFA500)', boxShadow: '0 0 12px #FFD70066' }}>
                  {claimReward.isPending ? '...' : 'নাও'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ QUICK MENU ══ */}
        <div className="px-4 mb-4">
          <div className="rounded-3xl overflow-hidden"
            style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(20,8,50,0.65)', backdropFilter: 'blur(10px)' }}>
            <div className="px-5 pt-4 pb-2 text-white/60 text-xs font-bold uppercase tracking-widest">মেনু</div>
            {[
              { icon: '🏆', label: 'Leaderboard', sub: 'শীর্ষ খেলোয়াড়রা', path: '/leaderboard', accent: '#FFD700' },
              ...(isSignedIn ? [
                { icon: '👤', label: 'My Profile', sub: 'পরিসংখ্যান ও পুরস্কার', path: '/profile', accent: '#4361EE' },
              ] : []),
              ...(user?.isAdmin ? [
                { icon: '⚙️', label: 'Admin Panel', sub: 'ব্যবস্থাপনা', path: '/admin', accent: '#E63946' },
              ] : []),
            ].map((item, i, arr) => (
              <Link key={i} href={item.path}>
                <div className={`flex items-center justify-between px-5 py-4 active:bg-white/5 transition-colors cursor-pointer ${i < arr.length - 1 ? 'border-b border-white/5' : ''}`}>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl"
                      style={{ background: `${item.accent}1a`, border: `1px solid ${item.accent}33` }}>
                      {item.icon}
                    </div>
                    <div>
                      <div className="text-white font-bold text-sm">{item.label}</div>
                      <div className="text-white/40 text-xs">{item.sub}</div>
                    </div>
                  </div>
                  <div className="text-white/30 text-lg">›</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

      </div>

      {/* ── floating-piece animation ── */}
      <style>{`
        @keyframes float1 {
          0%,100% { transform: translateY(0px) rotate(-3deg); }
          50%      { transform: translateY(-8px) rotate(3deg); }
        }
      `}</style>

      <BottomNav />
    </>
  );
}
