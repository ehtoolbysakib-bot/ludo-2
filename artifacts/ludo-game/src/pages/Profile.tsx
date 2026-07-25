import React from 'react';
import { useLocation } from 'wouter';
import { ChevronLeft, LogOut, Coins, Mail, Phone, Star } from 'lucide-react';
import { useGetMe, useGetMyStats, getGetMeQueryKey, getGetMyStatsQueryKey } from '@workspace/api-client-react';
import { useAuth } from '@/lib/auth';
import { useQueryClient } from '@tanstack/react-query';
import { BottomNav } from '@/components/BottomNav';
import splashBg from '@/assets/splash_bg.webp';

export default function Profile() {
  const [, setLocation] = useLocation();
  const { logout, user: authUser } = useAuth();
  const queryClient = useQueryClient();

  const { data: user } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const { data: stats } = useGetMyStats({ query: { queryKey: getGetMyStatsQueryKey() } });

  // Use API user data first, fallback to auth context
  const profile = user || authUser;

  const handleLogout = async () => {
    await logout();
    queryClient.clear();
    setLocation('/');
  };

  return (
    <>
      <div className="fixed inset-0 z-0" style={{ backgroundImage: `url(${splashBg})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }} />
      <div className="fixed inset-0 z-0" style={{ background: 'linear-gradient(180deg, rgba(10,5,30,0.75) 0%, rgba(10,5,30,0.55) 40%, rgba(10,5,30,0.88) 100%)' }} />
    <div className="min-h-[100dvh] flex flex-col pb-28 relative z-10">
      {/* Header */}
      <div className="px-6 pt-6 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => setLocation('/home')} className="w-10 h-10 rounded-full bg-[#3a2382] flex items-center justify-center text-white active:scale-95 transition-transform">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-2xl font-bold text-white">Profile</h1>
        </div>
        <button onClick={handleLogout} className="w-10 h-10 rounded-full bg-[#FF4444]/20 flex items-center justify-center text-[#FF4444] hover:bg-[#FF4444]/30 active:scale-95 transition-all">
          <LogOut size={20} />
        </button>
      </div>

      <div className="px-6 flex-1 max-w-md w-full mx-auto">
        {/* Profile Card */}
        <div className="rounded-3xl text-center mb-6 mt-6 relative overflow-hidden"
          style={{ border: '1.5px solid rgba(255,215,0,0.3)', background: 'rgba(20,8,50,0.8)', backdropFilter: 'blur(14px)' }}>
          
          {/* Gold top bar */}
          <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg,transparent,#FFD700,transparent)' }} />

          {/* Avatar */}
          <div className="w-24 h-24 rounded-full mx-auto mt-8 relative"
            style={{ border: '3px solid #FFD700', padding: '3px', background: '#1d0f3d' }}>
            <img
              src={profile?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.displayName || 'player'}`}
              alt="Avatar"
              className="w-full h-full rounded-full object-cover"
            />
            {profile?.isAdmin && (
              <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-[#FF4444] flex items-center justify-center text-[10px] font-bold text-white shadow-lg">
                ★
              </div>
            )}
          </div>

          {/* Name & Info */}
          <div className="pt-4 pb-6 px-6">
            <h2 className="text-2xl font-black text-white">{profile?.displayName || 'Player'}</h2>

            {/* Email / Phone */}
            <div className="flex flex-col items-center gap-1 mt-2">
              {profile?.email && (
                <div className="flex items-center gap-1.5 text-[#a790c9] text-xs">
                  <Mail size={12} />
                  <span>{profile.email}</span>
                </div>
              )}
              {profile?.phone && (
                <div className="flex items-center gap-1.5 text-[#a790c9] text-xs">
                  <Phone size={12} />
                  <span>{profile.phone}</span>
                </div>
              )}
            </div>

            {/* Level + Coins Row */}
            <div className="flex items-center justify-center gap-3 mt-4">
              <div className="flex items-center gap-1.5 bg-[#FFA500]/15 text-[#FFA500] px-3.5 py-1.5 rounded-full text-sm font-bold">
                <Star size={14} />
                Level {profile?.level || 1}
              </div>
              <div className="flex items-center gap-1.5 bg-[#FFD700]/15 text-[#FFD700] px-3.5 py-1.5 rounded-full text-sm font-bold">
                <Coins size={14} />
                {profile?.coins ?? 0} coins
              </div>
            </div>
          </div>
        </div>

        {/* Stats Summary */}
        <h3 className="text-white font-bold text-lg mb-3 flex items-center gap-2">
          <span className="w-1 h-5 rounded-full bg-[#FFD700]" />
          Lifetime Stats
        </h3>
        <div className="rounded-2xl overflow-hidden mb-8"
          style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(20,8,50,0.7)', backdropFilter: 'blur(10px)' }}>
          <div className="grid grid-cols-2 divide-x divide-y" style={{ borderColor: 'rgba(92,62,184,0.4)' }}>
            <div className="p-5 text-center">
              <div className="text-3xl font-black text-white">{stats?.matches || 0}</div>
              <div className="text-[#a790c9] text-xs uppercase tracking-wider mt-1">Matches</div>
            </div>
            <div className="p-5 text-center">
              <div className="text-3xl font-black text-[#FFD700]">{profile?.coins ?? 0}</div>
              <div className="text-[#a790c9] text-xs uppercase tracking-wider mt-1">Coins</div>
            </div>
            <div className="p-5 text-center">
              <div className="text-3xl font-black text-[#44BB44]">{stats?.wins || 0}</div>
              <div className="text-[#a790c9] text-xs uppercase tracking-wider mt-1">Wins</div>
            </div>
            <div className="p-5 text-center">
              <div className="text-3xl font-black text-[#FF4444]">{stats?.losses || 0}</div>
              <div className="text-[#a790c9] text-xs uppercase tracking-wider mt-1">Losses</div>
            </div>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
    </>
  );
}
