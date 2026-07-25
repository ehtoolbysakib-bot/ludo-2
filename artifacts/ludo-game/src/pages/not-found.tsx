import { useLocation } from 'wouter';
import splashBg from '@/assets/splash_bg.webp';

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <>
      <div className="fixed inset-0 z-0" style={{ backgroundImage: `url(${splashBg})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }} />
      <div className="fixed inset-0 z-0" style={{ background: 'linear-gradient(180deg, rgba(10,5,30,0.82) 0%, rgba(10,5,30,0.68) 40%, rgba(10,5,30,0.90) 100%)' }} />

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-8 text-center">
        {/* Decorative die */}
        <div className="w-24 h-24 mb-6 opacity-70">
          <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_20px_#FFD70088]">
            <rect x="5" y="5" width="90" height="90" rx="18" fill="#2d1b69" />
            <rect x="5" y="5" width="90" height="90" rx="18" fill="none" stroke="#FFD700" strokeWidth="3" />
            <text x="50" y="62" textAnchor="middle" fontSize="48" fill="#FFD700" fontWeight="bold">?</text>
          </svg>
        </div>

        <h1 className="text-8xl font-black text-[#FFD700] mb-2" style={{ textShadow: '0 0 40px #FFD70088' }}>404</h1>
        <h2 className="text-2xl font-black text-white mb-3">পেজ খুঁজে পাওয়া যায়নি!</h2>
        <p className="text-[#a790c9] text-base mb-8 max-w-xs">মনে হচ্ছে তুমি ভুল পথে এসে গেছ। চলো হোমে ফিরে যাই!</p>

        <button
          onClick={() => setLocation('/home')}
          className="px-8 py-4 rounded-2xl font-black text-lg text-[#1a0533] active:scale-95 transition-transform"
          style={{ background: 'linear-gradient(135deg,#FFD700,#FFA500)', boxShadow: '0 4px 24px #FFD70055' }}
        >
          🏠 হোমে ফিরে যাও
        </button>
      </div>
    </>
  );
}
