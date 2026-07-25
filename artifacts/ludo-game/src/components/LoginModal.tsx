import React, { useState } from 'react';
import { X, Eye, EyeOff, ChevronLeft, User, Lock, Phone } from 'lucide-react';
import { useAuth, type RegisterData } from '@/lib/auth';
import { useQueryClient } from '@tanstack/react-query';
import { getGetMeQueryKey } from '@workspace/api-client-react';
import splashLogo from '@/assets/splash_logo.webp';

type Mode = 'login' | 'register';
type RegStep = 'name' | 'emailOrPhone' | 'gender' | 'password';

const REG_STEPS: RegStep[] = ['name', 'emailOrPhone', 'gender', 'password'];

interface Props {
  onClose: () => void;
  onSuccess: () => void;
  message?: string; // e.g. "আগে লগইন করুন"
}

export function LoginModal({ onClose, onSuccess, message }: Props) {
  const { login, register } = useAuth();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<Mode>('login');
  const [step, setStep] = useState<RegStep>('name');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPw, setShowPw] = useState(false);

  // fields
  const [name, setName] = useState('');
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | ''>('');
  const [password, setPassword] = useState('');

  const stepIdx = REG_STEPS.indexOf(step);

  const switchMode = (m: Mode) => {
    setMode(m);
    setStep('name');
    setError('');
  };

  /* ─── Register steps ─────────────────────────────── */
  const next = () => {
    setError('');
    if (step === 'name') {
      if (!name.trim() || name.trim().length < 2) { setError('নামটি কমপক্ষে ২ অক্ষরের হতে হবে'); return; }
      setStep('emailOrPhone');
    } else if (step === 'emailOrPhone') {
      if (!emailOrPhone.trim()) { setError('ইমেইল বা ফোন নাম্বার দিন'); return; }
      setStep('gender');
    } else if (step === 'gender') {
      if (!gender) { setError('লিঙ্গ সিলেক্ট করুন'); return; }
      setStep('password');
    }
  };

  const back = () => {
    if (step === 'emailOrPhone') setStep('name');
    else if (step === 'gender') setStep('emailOrPhone');
    else if (step === 'password') setStep('gender');
  };

  /* ─── Submit ──────────────────────────────────────── */
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(emailOrPhone, password);
      } else {
        const data: RegisterData = { name, emailOrPhone, gender: gender as 'male' | 'female', password };
        await register(data);
      }
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'কিছু একটা সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  /* ─── Shared input style ─────────────────────────── */
  const inputCls = "w-full rounded-2xl py-4 text-white placeholder-[#7a6ba0] focus:outline-none focus:ring-1 focus:ring-[#FFD700]";
  const inputStyle = { background: 'rgba(255,255,255,0.07)', border: '1px solid #5c3eb8' };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 sm:p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
        style={{ border: '1.5px solid #FFD70066', background: 'linear-gradient(160deg,#1d0f3d 0%,#2d1b69 100%)' }}>

        {/* gold strip */}
        <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg,#b8860b,#FFD700,#FFF8A0,#FFD700,#b8860b)' }} />

        <div className="p-6">
          {/* Close */}
          <button onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors">
            <X size={15} />
          </button>

          {/* Logo */}
          <div className="flex justify-center mb-3">
            <img src={splashLogo} alt="Anaya's Board" className="h-14 object-contain"
              style={{ filter: 'drop-shadow(0 0 10px #FFD70088)' }} />
          </div>

          {/* Optional message */}
          {message && (
            <p className="text-center text-[#FFD700] font-bold text-sm mb-3">{message}</p>
          )}

          {/* Mode tabs */}
          <div className="flex bg-white/5 rounded-2xl p-1 mb-5">
            {(['login', 'register'] as Mode[]).map(m => (
              <button key={m} onClick={() => switchMode(m)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${mode === m ? 'text-[#1a0533]' : 'text-white/60 hover:text-white'}`}
                style={mode === m ? { background: 'linear-gradient(135deg,#FFD700,#FFA500)' } : {}}>
                {m === 'login' ? 'লগইন' : 'রেজিস্টার'}
              </button>
            ))}
          </div>

          {/* ── LOGIN ─────────────────────────────── */}
          {mode === 'login' && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="relative">
                <Phone size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#a790c9]" />
                <input type="text" value={emailOrPhone} onChange={e => setEmailOrPhone(e.target.value)}
                  placeholder="ইমেইল বা ফোন নাম্বার" autoFocus
                  className={`${inputCls} pl-11 pr-5`} style={inputStyle} />
              </div>
              <div className="relative">
                <Lock size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#a790c9]" />
                <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="পাসওয়ার্ড"
                  className={`${inputCls} pl-11 pr-12`} style={inputStyle} />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#a790c9] hover:text-white">
                  {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>

              {error && <p className="text-[#FF4444] text-sm text-center animate-pulse">{error}</p>}

              <button type="submit" disabled={loading || !emailOrPhone || !password}
                className="w-full py-4 rounded-2xl font-black text-lg text-[#1a0533] disabled:opacity-50 active:scale-95 transition-transform mt-1"
                style={{ background: 'linear-gradient(90deg,#b8860b,#FFD700,#FFF8A0,#FFD700,#b8860b)', boxShadow: '0 0 16px #FFD70066' }}>
                {loading ? 'লগইন হচ্ছে...' : '🎲 লগইন'}
              </button>
            </form>
          )}

          {/* ── REGISTER ──────────────────────────── */}
          {mode === 'register' && (
            <div className="flex flex-col gap-3">
              {/* progress dots */}
              <div className="flex justify-center gap-2 mb-1">
                {REG_STEPS.map((s, i) => (
                  <div key={s} className="rounded-full transition-all duration-300"
                    style={{
                      width: i === stepIdx ? 20 : 8, height: 8,
                      background: i < stepIdx ? '#FFD700' : i === stepIdx ? 'linear-gradient(90deg,#FFD700,#FFA500)' : 'rgba(255,255,255,0.2)',
                    }} />
                ))}
              </div>

              {/* Step: Name */}
              {step === 'name' && (
                <div className="flex flex-col gap-3">
                  <p className="text-white/70 text-sm text-center">তোমার নাম কী?</p>
                  <div className="relative">
                    <User size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#a790c9]" />
                    <input type="text" value={name} onChange={e => setName(e.target.value)}
                      placeholder="তোমার নাম" maxLength={30} autoFocus
                      onKeyDown={e => e.key === 'Enter' && next()}
                      className={`${inputCls} pl-11 pr-5`} style={inputStyle} />
                  </div>
                  {error && <p className="text-[#FF4444] text-sm text-center">{error}</p>}
                  <button onClick={next}
                    className="w-full py-3.5 rounded-2xl font-black text-base text-[#1a0533] active:scale-95 transition-transform"
                    style={{ background: 'linear-gradient(135deg,#FFD700,#FFA500)' }}>
                    পরবর্তী →
                  </button>
                </div>
              )}

              {/* Step: Email/Phone */}
              {step === 'emailOrPhone' && (
                <div className="flex flex-col gap-3">
                  <p className="text-white/70 text-sm text-center">ইমেইল বা ফোন নাম্বার দাও</p>
                  <div className="relative">
                    <Phone size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#a790c9]" />
                    <input type="text" value={emailOrPhone} onChange={e => setEmailOrPhone(e.target.value)}
                      placeholder="ইমেইল বা ফোন" autoFocus
                      onKeyDown={e => e.key === 'Enter' && next()}
                      className={`${inputCls} pl-11 pr-5`} style={inputStyle} />
                  </div>
                  {error && <p className="text-[#FF4444] text-sm text-center">{error}</p>}
                  <div className="flex gap-2">
                    <button onClick={back}
                      className="px-4 py-3.5 rounded-2xl text-white/60 hover:text-white flex items-center transition-colors"
                      style={{ border: '1px solid rgba(255,255,255,0.15)' }}>
                      <ChevronLeft size={18} />
                    </button>
                    <button onClick={next}
                      className="flex-1 py-3.5 rounded-2xl font-black text-base text-[#1a0533] active:scale-95 transition-transform"
                      style={{ background: 'linear-gradient(135deg,#FFD700,#FFA500)' }}>
                      পরবর্তী →
                    </button>
                  </div>
                </div>
              )}

              {/* Step: Gender */}
              {step === 'gender' && (
                <div className="flex flex-col gap-3">
                  <p className="text-white/70 text-sm text-center">তুমি কে?</p>
                  <div className="flex gap-3">
                    {(['male', 'female'] as const).map(g => (
                      <button key={g} onClick={() => setGender(g)}
                        className="flex-1 py-5 rounded-2xl flex flex-col items-center gap-2 transition-all active:scale-95"
                        style={{
                          background: gender === g ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.05)',
                          border: gender === g ? '2px solid #FFD700' : '1px solid rgba(255,255,255,0.15)',
                        }}>
                        <span className="text-4xl">{g === 'male' ? '👦' : '👧'}</span>
                        <span className={`text-sm font-bold ${gender === g ? 'text-[#FFD700]' : 'text-white/70'}`}>
                          {g === 'male' ? 'ছেলে' : 'মেয়ে'}
                        </span>
                      </button>
                    ))}
                  </div>
                  {error && <p className="text-[#FF4444] text-sm text-center">{error}</p>}
                  <div className="flex gap-2">
                    <button onClick={back}
                      className="px-4 py-3.5 rounded-2xl text-white/60 hover:text-white flex items-center transition-colors"
                      style={{ border: '1px solid rgba(255,255,255,0.15)' }}>
                      <ChevronLeft size={18} />
                    </button>
                    <button onClick={next} disabled={!gender}
                      className="flex-1 py-3.5 rounded-2xl font-black text-base text-[#1a0533] disabled:opacity-50 active:scale-95 transition-transform"
                      style={{ background: 'linear-gradient(135deg,#FFD700,#FFA500)' }}>
                      পরবর্তী →
                    </button>
                  </div>
                </div>
              )}

              {/* Step: Password */}
              {step === 'password' && (
                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                  <p className="text-white/70 text-sm text-center">একটা পাসওয়ার্ড দাও</p>
                  <div className="relative">
                    <Lock size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#a790c9]" />
                    <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)" autoFocus
                      className={`${inputCls} pl-11 pr-12`} style={inputStyle} />
                    <button type="button" onClick={() => setShowPw(v => !v)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#a790c9] hover:text-white">
                      {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                  {error && <p className="text-[#FF4444] text-sm text-center">{error}</p>}
                  <div className="flex gap-2">
                    <button type="button" onClick={back}
                      className="px-4 py-3.5 rounded-2xl text-white/60 hover:text-white flex items-center transition-colors"
                      style={{ border: '1px solid rgba(255,255,255,0.15)' }}>
                      <ChevronLeft size={18} />
                    </button>
                    <button type="submit" disabled={loading || !password || password.length < 6}
                      className="flex-1 py-3.5 rounded-2xl font-black text-base text-[#1a0533] disabled:opacity-50 active:scale-95 transition-transform"
                      style={{ background: 'linear-gradient(90deg,#b8860b,#FFD700,#FFF8A0,#FFD700,#b8860b)', boxShadow: '0 0 14px #FFD70066' }}>
                      {loading ? 'হচ্ছে...' : '🎲 রেজিস্টার'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          <p className="text-center text-white/25 text-xs mt-4">
            অ্যাকাউন্ট তৈরি করুন বা লগইন করুন এবং খেলা উপভোগ করুন
          </p>
        </div>
      </div>
    </div>
  );
}
