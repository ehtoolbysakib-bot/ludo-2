import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import splashBg from '@/assets/splash_bg.webp';
import splashLogo from '@/assets/splash_logo.webp';

export default function SplashAndHome() {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<'enter' | 'idle' | 'exit'>('enter');
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Start loading bar after logo enters (0.8s delay)
    const barTimer = setTimeout(() => {
      const duration = 4000; // 4s for the bar (total ≈ 5s with entry)
      const interval = 40;
      const steps = duration / interval;
      let step = 0;

      const ticker = setInterval(() => {
        step++;
        // Ease-out curve: fast at start, slow near end
        const t = step / steps;
        setProgress(Math.min(t < 0.8 ? t * 1.05 : 0.84 + (t - 0.8) * 0.8, 1) * 100);

        if (step >= steps) {
          clearInterval(ticker);
          setPhase('exit');
          setTimeout(() => setLocation('/home'), 500);
        }
      }, interval);

      return () => clearInterval(ticker);
    }, 800);

    return () => clearTimeout(barTimer);
  }, [setLocation]);

  return (
    <>
      <style>{`
        @keyframes logoEnter {
          0%   { opacity: 0; transform: scale(0.55) translateY(30px); filter: brightness(2) drop-shadow(0 0 40px #FFD700); }
          60%  { opacity: 1; transform: scale(1.08) translateY(-6px); filter: brightness(1.3) drop-shadow(0 0 20px #FFD700cc); }
          80%  { transform: scale(0.97) translateY(2px); filter: brightness(1.1) drop-shadow(0 0 14px #FFD70099); }
          100% { opacity: 1; transform: scale(1) translateY(0); filter: brightness(1) drop-shadow(0 0 12px #FFD70088); }
        }
        @keyframes logoFloat {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-10px); }
        }
        @keyframes logoExit {
          0%   { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.18); }
        }
        @keyframes barGlow {
          0%, 100% { box-shadow: 0 0 8px 2px #FFD700aa; }
          50%       { box-shadow: 0 0 18px 5px #FFD700ff; }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes screenExit {
          from { opacity: 1; }
          to   { opacity: 0; }
        }
        .logo-enter   { animation: logoEnter 0.9s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        .logo-idle    { animation: logoFloat 3.5s ease-in-out infinite; filter: drop-shadow(0 0 14px #FFD70099); }
        .logo-exit    { animation: logoExit 0.45s ease-in forwards; }
        .screen-exit  { animation: screenExit 0.45s ease-in forwards; }
      `}</style>

      {/* Full-screen container */}
      <div
        className={`fixed inset-0 z-50 flex flex-col items-center justify-between overflow-hidden ${phase === 'exit' ? 'screen-exit' : ''}`}
        style={{
          background: '#0e0524',
        }}
      >
        {/* Background image — cover + subtle zoom pulse */}
        <div
          className="absolute inset-0 w-full h-full"
          style={{
            backgroundImage: `url(${splashBg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center bottom',
            backgroundRepeat: 'no-repeat',
          }}
        />

        {/* Dark gradient overlay so logo pops */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/55" />

        {/* ── Logo area — centred vertically in the upper 2/3 ── */}
        <div className="relative z-10 flex-1 flex items-center justify-center w-full px-6">
          <img
            src={splashLogo}
            alt="Anaya's Board"
            className={
              phase === 'enter' ? 'logo-enter'
              : phase === 'idle' ? 'logo-idle'
              : 'logo-exit'
            }
            onAnimationEnd={() => {
              if (phase === 'enter') setPhase('idle');
            }}
            style={{
              width: 'min(82vw, 380px)',
              maxHeight: '55vh',
              objectFit: 'contain',
              // knock out the near-black edges of the webp
              mixBlendMode: 'lighten',
            }}
          />
        </div>

        {/* ── Bottom area: loading bar + tagline ── */}
        <div
          className="relative z-10 w-full px-10 pb-14 flex flex-col items-center gap-3"
          style={{ animation: 'fadeInUp 0.6s 0.6s ease both' }}
        >
          {/* Tagline */}
          <p className="text-[#d4bfff] text-sm font-semibold tracking-widest uppercase opacity-80">
            Loading…
          </p>

          {/* Track */}
          <div className="w-full max-w-xs h-[6px] bg-white/10 rounded-full overflow-visible relative">
            {/* Fill */}
            <div
              className="absolute top-0 left-0 h-full rounded-full transition-[width] duration-75 ease-linear"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #b8860b, #FFD700, #FFF8A0, #FFD700, #b8860b)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.4s linear infinite, barGlow 1.2s ease-in-out infinite',
              }}
            />
            {/* Tip glow dot */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white transition-[left] duration-75 ease-linear"
              style={{
                left: `calc(${progress}% - 6px)`,
                boxShadow: '0 0 8px 3px #FFD700, 0 0 2px 1px #fff',
                display: progress < 2 ? 'none' : 'block',
              }}
            />
          </div>

          {/* Percent */}
          <p className="text-[#FFD700] text-xs font-bold tabular-nums">
            {Math.round(progress)}%
          </p>
        </div>
      </div>
    </>
  );
}
