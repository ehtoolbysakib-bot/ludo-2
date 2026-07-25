import React from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Coins, Shield } from 'lucide-react';
import { useCreateRoom } from '@workspace/api-client-react';
import { toast } from 'sonner';
import { BottomNav } from '@/components/BottomNav';
import splashBg from '@/assets/splash_bg.webp';

const BET_PRESETS = [0, 50, 100, 200, 500, 1000];

export default function CreateRoom() {
  const [players, setPlayers] = React.useState<number>(4);
  const [teamMode, setTeamMode] = React.useState<boolean>(false);
  const [betAmount, setBetAmount] = React.useState<number>(0);
  const [customBet, setCustomBet] = React.useState<string>('');
  const [, setLocation] = useLocation();
  const createRoom = useCreateRoom();

  // Reset teamMode when players count changes from 4
  React.useEffect(() => {
    if (players !== 4) setTeamMode(false);
  }, [players]);

  const effectiveBet = customBet !== '' ? Math.max(0, parseInt(customBet) || 0) : betAmount;

  const handleCreate = () => {
    createRoom.mutate(
      { data: { maxPlayers: players, teamMode: players === 4 ? teamMode : false, betAmount: effectiveBet } },
      {
        onSuccess: (room) => {
          toast.success('রুম তৈরি হয়েছে!');
          setLocation(`/room/${room.code}`);
        },
        onError: (err: any) => {
          toast.error(err.message || 'রুম তৈরি করতে সমস্যা হয়েছে');
        },
      }
    );
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
      <div className="min-h-[100dvh] flex flex-col pb-28 relative z-10">
        {/* Header */}
        <div className="p-6 flex items-center gap-4">
          <button
            onClick={() => setLocation('/home')}
            className="w-10 h-10 rounded-full bg-[#3a2382] flex items-center justify-center text-white active:scale-95"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-2xl font-bold text-white">রুম তৈরি করুন</h1>
        </div>

        <div className="flex-1 px-6 flex flex-col gap-5 max-w-md w-full mx-auto">
          {/* Player count */}
          <div className="glass-panel p-5 rounded-3xl">
            <p className="text-[#a790c9] text-xs uppercase tracking-widest font-bold mb-4">
              খেলোয়াড়ের সংখ্যা
            </p>
            <div className="flex justify-center gap-4">
              {[2, 3, 4].map((num) => (
                <button
                  key={num}
                  onClick={() => setPlayers(num)}
                  className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black transition-all ${
                    players === num
                      ? 'bg-[#FFD700] text-[#1a0533] glow-box scale-110'
                      : 'bg-[#3a2382] text-white border border-[#5c3eb8] hover:bg-[#4a2e9b]'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          {/* Team Mode — only for 4 players */}
          {players === 4 && (
            <div className="glass-panel p-5 rounded-3xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Shield size={18} className="text-[#FFD700]" />
                  <p className="text-white font-bold">টিম মোড</p>
                </div>
                <button
                  onClick={() => setTeamMode((v) => !v)}
                  className={`w-14 h-7 rounded-full transition-all relative ${
                    teamMode ? 'bg-[#FFD700]' : 'bg-[#3a2382] border border-[#5c3eb8]'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-6 h-6 rounded-full transition-all ${
                      teamMode ? 'left-7 bg-[#1a0533]' : 'left-0.5 bg-[#a790c9]'
                    }`}
                  />
                </button>
              </div>
              {teamMode ? (
                <div className="flex gap-3 mt-3">
                  {/* Team 1 */}
                  <div className="flex-1 rounded-2xl bg-[#1d0f3d] border border-[#3a2382] p-3 text-center">
                    <p className="text-xs text-[#a790c9] font-bold uppercase tracking-wider mb-2">দল ১</p>
                    <div className="flex justify-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#4444FF] inline-block border-2 border-white/20" />
                      <span className="w-5 h-5 rounded-full bg-[#44BB44] inline-block border-2 border-white/20" />
                    </div>
                    <p className="text-[10px] text-[#a790c9] mt-1">নীল &amp; সবুজ</p>
                  </div>
                  {/* VS */}
                  <div className="flex items-center justify-center px-1">
                    <span className="text-[#FFD700] font-black text-sm">VS</span>
                  </div>
                  {/* Team 2 */}
                  <div className="flex-1 rounded-2xl bg-[#1d0f3d] border border-[#3a2382] p-3 text-center">
                    <p className="text-xs text-[#a790c9] font-bold uppercase tracking-wider mb-2">দল ২</p>
                    <div className="flex justify-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#FF4444] inline-block border-2 border-white/20" />
                      <span className="w-5 h-5 rounded-full bg-[#FFD700] inline-block border-2 border-white/20" />
                    </div>
                    <p className="text-[10px] text-[#a790c9] mt-1">লাল &amp; হলুদ</p>
                  </div>
                </div>
              ) : (
                <p className="text-[#a790c9] text-xs">
                  চালু করলে কোনাকোনি ২টি দলে খেলা যাবে (নীল+সবুজ বনাম লাল+হলুদ)।
                </p>
              )}
            </div>
          )}

          {/* Bet Amount */}
          <div className="glass-panel p-5 rounded-3xl">
            <div className="flex items-center gap-2 mb-4">
              <Coins size={18} className="text-[#FFD700]" />
              <p className="text-white font-bold">বাজির পরিমাণ</p>
              {effectiveBet > 0 && (
                <span className="ml-auto text-[#FFD700] font-black text-lg">{effectiveBet} 🪙</span>
              )}
            </div>

            {/* Preset chips */}
            <div className="flex flex-wrap gap-2 mb-4">
              {BET_PRESETS.map((preset) => (
                <button
                  key={preset}
                  onClick={() => { setBetAmount(preset); setCustomBet(''); }}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                    betAmount === preset && customBet === ''
                      ? 'bg-[#FFD700] text-[#1a0533] glow-box scale-105'
                      : 'bg-[#3a2382] text-white border border-[#5c3eb8] hover:bg-[#4a2e9b]'
                  }`}
                >
                  {preset === 0 ? 'বাজি নেই' : `${preset} 🪙`}
                </button>
              ))}
            </div>

            {/* Custom amount */}
            <div className="relative">
              <input
                type="number"
                min={0}
                placeholder="নিজে লিখুন..."
                value={customBet}
                onChange={(e) => { setCustomBet(e.target.value); setBetAmount(0); }}
                className="w-full bg-[#1d0f3d] border border-[#5c3eb8] rounded-xl px-4 py-3 text-white placeholder-[#5c3eb8] focus:outline-none focus:border-[#FFD700] text-sm"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#a790c9] text-sm">🪙</span>
            </div>
          </div>

          {/* Create button */}
          <Button
            className="w-full h-14 text-xl"
            onClick={handleCreate}
            disabled={createRoom.isPending}
          >
            {createRoom.isPending ? 'তৈরি হচ্ছে...' : 'রুম তৈরি করুন ও কোড নিন'}
          </Button>
        </div>

        <BottomNav />
      </div>
    </>
  );
}
