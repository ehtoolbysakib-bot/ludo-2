import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronLeft, Hash } from 'lucide-react';
import { useJoinRoom } from '@workspace/api-client-react';
import { toast } from 'sonner';
import { BottomNav } from '@/components/BottomNav';
import splashBg from '@/assets/splash_bg.webp';

export default function JoinRoom() {
  const [code, setCode] = useState('');
  const [, setLocation] = useLocation();
  const joinRoom = useJoinRoom();

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || code.length < 4) {
      toast.error('Please enter a valid room code');
      return;
    }

    joinRoom.mutate({ code: code.toUpperCase() }, {
      onSuccess: (room) => {
        setLocation(`/room/${room.code}`);
      },
      onError: (err: any) => {
        toast.error(err.message || 'Room not found or full');
      }
    });
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
        <h1 className="text-2xl font-bold text-white">Join Room</h1>
      </div>

      <div className="flex-1 px-6 flex flex-col justify-center max-w-md w-full mx-auto">
        <div className="glass-panel p-8 rounded-3xl text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-tr from-[#4444FF] to-[#8888FF] rounded-full mx-auto mb-6 flex items-center justify-center shadow-[0_0_20px_rgba(68,68,255,0.5)]">
            <Hash size={40} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Enter Invite Code</h2>
          <p className="text-[#a790c9] mb-8">Ask the host for the 6-character room code to join.</p>

          <form onSubmit={handleJoin}>
            <Input 
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. A1B2C3"
              className="mb-8 text-center text-2xl font-bold uppercase tracking-widest h-16"
              maxLength={6}
            />

            <Button 
              type="submit"
              variant="secondary"
              className="w-full h-14 text-xl bg-[#4444FF] hover:bg-[#5555FF] text-white border-0 shadow-[0_0_15px_rgba(68,68,255,0.5)]" 
              disabled={joinRoom.isPending || code.length < 4}
            >
              {joinRoom.isPending ? 'Joining...' : 'Join Game'}
            </Button>
          </form>
        </div>
      </div>
      
      <BottomNav />
    </div>
    </>
  );
}
