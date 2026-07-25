import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Home, Trophy, Users, MessageSquare, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { LoginModal } from './LoginModal';

const TABS = [
  { name: 'Home',        path: '/home',      icon: Home,          protected: false },
  { name: 'Games',       path: '/room/join', icon: Users,         protected: true  },
  { name: 'Leaderboard', path: '/leaderboard',icon: Trophy,       protected: false },
  { name: 'Chat',        path: '#chat',       icon: MessageSquare, protected: true  },
  { name: 'Profile',     path: '/profile',   icon: User,          protected: true  },
];

export function BottomNav() {
  const [location, setLocation] = useLocation();
  const { isSignedIn } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  const handleTab = (tab: typeof TABS[0]) => {
    if (tab.protected && !isSignedIn) {
      setPending(tab.path.startsWith('#') ? null : tab.path);
      setShowLogin(true);
      return;
    }
    if (!tab.path.startsWith('#')) setLocation(tab.path);
  };

  return (
    <>
      {showLogin && (
        <LoginModal
          message="এই ফিচার ব্যবহার করতে আগে লগইন করুন"
          onClose={() => { setShowLogin(false); setPending(null); }}
          onSuccess={() => {
            setShowLogin(false);
            if (pending) setLocation(pending);
            setPending(null);
          }}
        />
      )}

      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 pb-6 md:hidden">
        <div className="glass-panel rounded-full flex items-center justify-between px-2 py-2">
          {TABS.map(tab => {
            const isActive =
              location === tab.path ||
              (tab.path !== '#chat' && location.startsWith(tab.path) && tab.path !== '/home') ||
              (tab.path === '/home' && location === '/home');
            return (
              <button
                key={tab.name}
                onClick={() => handleTab(tab)}
                className={cn(
                  'flex flex-col items-center justify-center w-14 h-14 rounded-full transition-all cursor-pointer',
                  isActive
                    ? 'bg-gradient-to-tr from-[#FFD700] to-[#FFA500] text-[#1a0533] -translate-y-2 glow-box'
                    : 'text-[#a790c9] hover:text-white',
                )}
              >
                <tab.icon size={isActive ? 24 : 20} strokeWidth={isActive ? 2.5 : 2} />
                <span className={cn('text-[10px] mt-1 font-medium', isActive ? 'font-bold' : '')}>
                  {tab.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
