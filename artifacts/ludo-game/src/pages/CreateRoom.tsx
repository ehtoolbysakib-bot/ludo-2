import React from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Users } from 'lucide-react';
import { useCreateRoom } from '@workspace/api-client-react';
import { toast } from 'sonner';
import { BottomNav } from '@/components/BottomNav';
import splashBg from '@/assets/splash_bg.webp';

export default function CreateRoom() {
  const [players, setPlayers] = React.useState<number>(4);
  const [, setLocation] = useLocation();
  const createRoom = useCreateRoom();

  const handleCreate = () => {
    createRoom.mutate({ data: { maxPlayers: players } }, {
      onSuccess: (room) => {
        toast.success('Room created!');
        setLocation(`/room/${room.code}`);
      },
      onError: (err: any) => {
        toast.error(err.message || 'Failed to create room');
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
        <h1 className="text-2xl font-bold text-white">Create Room</h1>
      </div>

      <div className="flex-1 px-6 flex flex-col justify-center max-w-md w-full mx-auto">
        <div className="glass-panel p-8 rounded-3xl text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-tr from-[#FFD700] to-[#FFA500] rounded-full mx-auto mb-6 flex items-center justify-center glow-box">
            <Users size={40} className="text-[#1a0533]" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Host a Game</h2>
          <p className="text-[#a790c9] mb-8">Select how many players can join this room.</p>

          <div className="flex justify-center gap-4 mb-10">
            {[2, 3, 4].map((num) => (
              <button
                key={num}
                onClick={() => setPlayers(num)}
                className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black transition-all ${players === num ? 'bg-[#FFD700] text-[#1a0533] glow-box scale-110' : 'bg-[#3a2382] text-white border border-[#5c3eb8] hover:bg-[#4a2e9b]'}`}
              >
                {num}
              </button>
            ))}
          </div>

          <Button 
            className="w-full h-14 text-xl" 
            onClick={handleCreate}
            disabled={createRoom.isPending}
          >
            {createRoom.isPending ? 'Creating...' : 'Create & Get Code'}
          </Button>
        </div>
      </div>
      
      <BottomNav />
    </div>
    </>
  );
}
