import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { ChevronLeft, Search, Ban, ShieldAlert, Coins, Users, Trophy, Activity, Lock, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth';
import splashBg from '@/assets/splash_bg.webp';

const ADMIN_PASSWORD = 'Sakib@7890';

interface AdminUser {
  id: number;
  clerkId: string;
  email: string;
  phone: string | null;
  displayName: string;
  avatarUrl: string | null;
  gender: string;
  coins: number;
  level: number;
  wins: number;
  losses: number;
  matches: number;
  isSuspended: boolean;
  isAdmin: boolean;
  createdAt: string;
}

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalGames: number;
  totalRooms: number;
  totalCoinsInCirculation: number;
}

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(path, { credentials: 'include', ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Error');
  return data;
}

/* ── Password Gate ─────────────────────────────────────────────────────────── */
function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [, setLocation] = useLocation();
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pw === ADMIN_PASSWORD) {
      onUnlock();
    } else {
      setError('পাসওয়ার্ড ভুল হয়েছে!');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setPw('');
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center p-4 relative z-10">
      <div className={`w-full max-w-sm transition-transform ${shake ? 'animate-shake' : ''}`}>
        <div className="rounded-3xl overflow-hidden"
          style={{ border: '1.5px solid rgba(255,215,0,0.3)', background: 'rgba(20,8,50,0.85)', backdropFilter: 'blur(16px)' }}>
          {/* gold top bar */}
          <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg,transparent,#FFD700,transparent)' }} />

          <div className="p-8">
            {/* Icon */}
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
              style={{ background: 'linear-gradient(135deg,#FF4444,#cc0000)', boxShadow: '0 0 24px #FF444466' }}>
              <Lock size={28} className="text-white" />
            </div>

            <h1 className="text-2xl font-black text-white text-center mb-1">Admin Panel</h1>
            <p className="text-[#a790c9] text-sm text-center mb-8">প্রবেশ করতে পাসওয়ার্ড দিন</p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={pw}
                  onChange={e => { setPw(e.target.value); setError(''); }}
                  placeholder="পাসওয়ার্ড লিখুন..."
                  autoFocus
                  className="w-full rounded-2xl px-5 py-4 text-white font-semibold placeholder-[#7a6ba0] focus:outline-none transition-colors pr-12"
                  style={{ background: '#2d1b69', border: `1.5px solid ${error ? '#FF4444' : '#5c3eb8'}` }}
                />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#a790c9] hover:text-white transition-colors">
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {error && (
                <p className="text-[#FF4444] text-sm text-center font-semibold">{error}</p>
              )}

              <button type="submit" disabled={!pw}
                className="w-full h-14 rounded-2xl font-black text-lg text-[#1a0533] disabled:opacity-40 active:scale-95 transition-all"
                style={{ background: 'linear-gradient(135deg,#FFD700,#FFA500)', boxShadow: '0 4px 20px #FFD70044' }}>
                প্রবেশ করুন
              </button>

              <button type="button" onClick={() => setLocation('/home')}
                className="text-[#a790c9] text-sm text-center hover:text-white transition-colors">
                ← হোমে ফিরে যাও
              </button>
            </form>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%      { transform: translateX(-8px); }
          40%      { transform: translateX(8px); }
          60%      { transform: translateX(-6px); }
          80%      { transform: translateX(6px); }
        }
        .animate-shake { animation: shake 0.45s ease; }
      `}</style>
    </div>
  );
}

/* ── Coins Modal ───────────────────────────────────────────────────────────── */
function CoinsModal({ user, onClose, onDone }: { user: AdminUser; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(amount);
    if (!amount || isNaN(n)) return;
    setLoading(true);
    try {
      await apiFetch(`/api/admin/users/${user.clerkId}/coins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: n }),
      });
      toast.success(`${user.displayName}-এর ব্যালেন্সে ${n > 0 ? '+' : ''}${n} coins আপডেট হয়েছে`);
      onDone();
    } catch (e: any) {
      toast.error(e.message);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-xs rounded-3xl overflow-hidden"
        style={{ border: '1.5px solid rgba(255,215,0,0.3)', background: 'rgba(20,8,50,0.95)', backdropFilter: 'blur(16px)' }}>
        <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg,transparent,#FFD700,transparent)' }} />
        <div className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <img src={user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.displayName}`}
              alt="" className="w-10 h-10 rounded-full" style={{ border: '2px solid #FFD700' }} />
            <div>
              <div className="text-white font-bold">{user.displayName}</div>
              <div className="text-[#FFD700] text-sm font-bold flex items-center gap-1">
                <Coins size={12} /> বর্তমান: {user.coins.toLocaleString()} coins
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-[#a790c9] text-xs font-bold uppercase tracking-wider mb-2 block">
                Coins পরিমাণ (ঋণাত্মক হলে কাটবে)
              </label>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="যেমন: 500 বা -100"
                autoFocus
                className="w-full rounded-2xl px-4 py-3 text-white font-bold placeholder-[#7a6ba0] focus:outline-none"
                style={{ background: '#2d1b69', border: '1.5px solid #5c3eb8' }}
              />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose}
                className="flex-1 h-12 rounded-2xl font-bold text-white border border-white/20 active:scale-95 transition-transform"
                style={{ background: 'rgba(255,255,255,0.08)' }}>
                বাতিল
              </button>
              <button type="submit" disabled={!amount || loading}
                className="flex-1 h-12 rounded-2xl font-black text-[#1a0533] disabled:opacity-40 active:scale-95 transition-all"
                style={{ background: 'linear-gradient(135deg,#FFD700,#FFA500)' }}>
                {loading ? '...' : 'আপডেট'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ── Admin Panel ───────────────────────────────────────────────────────────── */
export default function Admin() {
  const [, setLocation] = useLocation();
  const { user: me } = useAuth();
  const [unlocked, setUnlocked] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [coinsTarget, setCoinsTarget] = useState<AdminUser | null>(null);

  const limit = 10;

  const loadUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      const data = await apiFetch(`/api/admin/users?${params}`);
      setUsers(data.users);
      setTotal(data.total);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await apiFetch('/api/admin/stats');
      setStats(data);
    } catch { /* ignore */ }
  };

  useEffect(() => { if (unlocked) { loadUsers(); } }, [page, search, unlocked]);
  useEffect(() => { if (unlocked) { loadStats(); } }, [unlocked]);

  const handleSuspend = async (clerkId: string, suspended: boolean) => {
    try {
      await apiFetch(`/api/admin/users/${clerkId}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suspended }),
      });
      toast.success(suspended ? 'ব্যবহারকারী সাসপেন্ড করা হয়েছে' : 'সাসপেনশন তুলে নেওয়া হয়েছে');
      loadUsers();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <>
      <div className="fixed inset-0 z-0" style={{ backgroundImage: `url(${splashBg})`, backgroundSize: 'cover', backgroundPosition: 'center bottom', backgroundRepeat: 'no-repeat' }} />
      <div className="fixed inset-0 z-0" style={{ background: 'linear-gradient(180deg, rgba(10,5,30,0.82) 0%, rgba(10,5,30,0.68) 40%, rgba(10,5,30,0.90) 100%)' }} />

      {/* Coins modal */}
      {coinsTarget && (
        <CoinsModal
          user={coinsTarget}
          onClose={() => setCoinsTarget(null)}
          onDone={() => { setCoinsTarget(null); loadUsers(); loadStats(); }}
        />
      )}

      {!unlocked ? (
        <PasswordGate onUnlock={() => setUnlocked(true)} />
      ) : (
        <div className="min-h-[100dvh] flex flex-col relative z-10">
          {/* Header */}
          <div className="p-4 flex items-center gap-4 border-b border-[#3a2382]" style={{ background: 'rgba(26,5,51,0.85)', backdropFilter: 'blur(10px)' }}>
            <button onClick={() => setLocation('/home')}
              className="w-10 h-10 rounded-full bg-[#3a2382] flex items-center justify-center text-white active:scale-95">
              <ChevronLeft size={22} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-[#FF4444] flex items-center gap-2">
                <ShieldAlert size={20} /> Admin Panel
              </h1>
              <p className="text-xs text-[#a790c9]">স্বাগতম, {me?.displayName || 'Admin'}</p>
            </div>
            <button onClick={() => setUnlocked(false)} className="ml-auto flex items-center gap-1.5 text-xs text-[#a790c9] hover:text-white transition-colors px-3 py-1.5 rounded-full border border-white/10">
              <Lock size={12} /> লক করুন
            </button>
          </div>

          <div className="p-4 flex-1 max-w-5xl w-full mx-auto space-y-4">

            {/* Stats cards */}
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'মোট ব্যবহারকারী', value: stats.totalUsers, icon: Users, color: '#4361EE' },
                  { label: 'সক্রিয়', value: stats.activeUsers, icon: Activity, color: '#06D6A0' },
                  { label: 'মোট খেলা', value: stats.totalGames, icon: Trophy, color: '#FFD700' },
                  { label: 'মোট Coins', value: stats.totalCoinsInCirculation.toLocaleString(), icon: Coins, color: '#FFA500' },
                ].map(s => (
                  <div key={s.label} className="rounded-2xl p-4 flex items-center gap-3"
                    style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${s.color}33` }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${s.color}22` }}>
                      <s.icon size={18} style={{ color: s.color }} />
                    </div>
                    <div>
                      <div className="font-black text-lg text-white leading-none">{s.value}</div>
                      <div className="text-xs text-[#a790c9] mt-0.5">{s.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a790c9]" size={18} />
              <Input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="নাম, ইমেইল বা ফোন দিয়ে খুঁজুন..."
                className="pl-10"
              />
            </div>

            {/* Table */}
            <div className="glass-panel rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-[#2d1b69]">
                      <th className="p-3 font-bold text-[#a790c9]">ব্যবহারকারী</th>
                      <th className="p-3 font-bold text-[#a790c9]">Level</th>
                      <th className="p-3 font-bold text-[#a790c9]">Coins</th>
                      <th className="p-3 font-bold text-[#a790c9]">W/L</th>
                      <th className="p-3 font-bold text-[#a790c9]">স্ট্যাটাস</th>
                      <th className="p-3 font-bold text-[#a790c9] text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#3a2382]">
                    {loading ? (
                      <tr><td colSpan={6} className="p-8 text-center text-white/60">লোড হচ্ছে...</td></tr>
                    ) : users.length === 0 ? (
                      <tr><td colSpan={6} className="p-8 text-center text-white/60">কোনো ব্যবহারকারী পাওয়া যায়নি</td></tr>
                    ) : users.map(user => (
                      <tr key={user.id} className="hover:bg-[#3a2382]/30 transition-colors">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <img
                              src={user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.displayName}`}
                              alt="" className="w-8 h-8 rounded-full flex-shrink-0"
                              style={{ border: '1px solid #3a2382' }}
                            />
                            <div>
                              <div className="text-white font-bold flex items-center gap-1">
                                {user.displayName}
                                {user.isAdmin && <span className="text-[8px] bg-[#FF4444]/30 text-[#FF4444] px-1.5 py-0.5 rounded font-bold">ADMIN</span>}
                              </div>
                              <div className="text-xs text-[#a790c9]">{user.email || user.phone || '—'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-white font-bold">{user.level}</td>
                        <td className="p-3 text-[#FFD700] font-bold">{user.coins.toLocaleString()}</td>
                        <td className="p-3 text-white">{user.wins}/{user.losses}</td>
                        <td className="p-3">
                          {user.isSuspended ? (
                            <span className="bg-[#FF4444]/20 text-[#FF4444] px-2 py-1 rounded text-xs font-bold">সাসপেন্ড</span>
                          ) : (
                            <span className="bg-[#44BB44]/20 text-[#44BB44] px-2 py-1 rounded text-xs font-bold">সক্রিয়</span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex justify-end gap-1.5">
                            <button onClick={() => setCoinsTarget(user)}
                              className="h-7 px-3 rounded-lg text-xs font-bold flex items-center gap-1 active:scale-95 transition-transform"
                              style={{ background: 'rgba(255,215,0,0.15)', border: '1px solid #FFD70044', color: '#FFD700' }}>
                              <Coins size={12} /> Coins
                            </button>
                            <Button
                              size="sm"
                              variant={user.isSuspended ? 'secondary' : 'danger'}
                              onClick={() => handleSuspend(user.clerkId, !user.isSuspended)}
                              className="h-7 px-2 text-xs"
                            >
                              <Ban size={12} className="mr-1" /> {user.isSuspended ? 'Unban' : 'Ban'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-3 border-t border-[#3a2382] flex justify-between items-center text-[#a790c9] text-sm">
                <div>মোট: {total}</div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← আগে</Button>
                  <span className="py-1 px-2 text-white">{page}</span>
                  <Button size="sm" variant="ghost" disabled={users.length < limit} onClick={() => setPage(p => p + 1)}>পরে →</Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
