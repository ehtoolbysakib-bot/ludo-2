import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/lib/auth';
import splashBg from '@/assets/splash_bg.webp';

export default function SignInPage() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    setLoading(true);
    setError('');
    try {
      await login(username.trim());
      setLocation('/home');
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-0" style={{ backgroundImage: `url(${splashBg})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }} />
      <div className="fixed inset-0 z-0" style={{ background: 'linear-gradient(180deg, rgba(10,5,30,0.75) 0%, rgba(10,5,30,0.55) 40%, rgba(10,5,30,0.88) 100%)' }} />

    <div className="flex min-h-[100dvh] items-center justify-center p-4 relative z-10">
      <div className="relative w-full max-w-sm">
        <div className="glass-panel p-8 rounded-3xl border border-[#3a2382] shadow-2xl">
          {/* Logo */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-black text-gradient-gold glow-text">ANAYA'S</h1>
            <h2 className="text-2xl font-black text-white tracking-widest">BOARD</h2>
          </div>

          <h3 className="text-white font-bold text-xl text-center mb-2">Enter your name</h3>
          <p className="text-[#a790c9] text-sm text-center mb-6">
            Pick a display name to start playing
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Your name..."
              maxLength={30}
              autoFocus
              className="w-full bg-[#2d1b69] border border-[#5c3eb8] rounded-2xl px-5 py-4 text-white text-lg font-semibold placeholder-[#7a6ba0] focus:outline-none focus:border-[#FFD700] transition-colors"
            />

            {error && (
              <p className="text-[#FF4444] text-sm text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !username.trim()}
              className="w-full bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-[#1a0533] py-4 rounded-2xl font-black text-xl glow-box hover:brightness-110 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Entering...' : 'Play Now'}
            </button>
          </form>

          <p className="text-[#a790c9] text-xs text-center mt-6">
            No password needed — just pick a name and play!
          </p>
        </div>
      </div>
    </div>
    </>
  );
}
