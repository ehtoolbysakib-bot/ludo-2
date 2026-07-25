import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useLocation } from 'wouter';
import { useGetMe, getGetMeQueryKey } from '@workspace/api-client-react';
import { LudoBoard, Token } from '@/components/LudoBoard';
import { ChevronLeft, Dices, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { COLORS, START_INDICES } from '@/lib/ludo-utils';
import splashBg from '@/assets/splash_bg.webp';

// ─── Server types ────────────────────────────────────────────────────────────
interface ServerGameToken {
  id: number;        // 0-3
  position: number;  // -1=home base, 0-51=main path (relative), 52-56=home run, 57=finished
  isHome: boolean;
  isFinished: boolean;
}
interface ServerPlayerState {
  clerkId: string;
  color: string;
  tokens: ServerGameToken[];
  isFinished: boolean;
}
interface ServerGameState {
  players: ServerPlayerState[];
  currentPlayerIndex: number;
  diceValue: number | null;
  phase: 'rolling' | 'moving' | 'finished';
  winner: string | null;
  lastMoveTokenId: number | null;
  extraTurn: boolean;
}

// ─── Coordinate conversion ────────────────────────────────────────────────────
function serverTokenToFrontend(t: ServerGameToken, color: string): Token {
  const key = color as keyof typeof START_INDICES;
  if (t.isHome) {
    return { id: `${color}-${t.id}`, color: color as any, state: 'home', position: 0 };
  }
  if (t.isFinished || t.position >= 57) {
    return { id: `${color}-${t.id}`, color: color as any, state: 'finished', position: 4 };
  }
  if (t.position >= 52) {
    return { id: `${color}-${t.id}`, color: color as any, state: 'finished', position: Math.min(t.position - 52, 4) };
  }
  const globalPos = (t.position + START_INDICES[key]) % 52;
  return { id: `${color}-${t.id}`, color: color as any, state: 'active', position: globalPos };
}

function buildTokensFromGs(gs: ServerGameState): Token[] {
  return gs.players.flatMap(p => p.tokens.map(t => serverTokenToFrontend(t, p.color)));
}

// ─── Animation path generator ────────────────────────────────────────────────
// Returns sequence of visual (state, position) values the token passes through.
function getMovePath(
  color: string,
  oldT: ServerGameToken,
  newT: ServerGameToken,
): Array<{ state: 'home' | 'active' | 'finished'; position: number }> {
  const key = color as keyof typeof START_INDICES;
  const frames: Array<{ state: 'home' | 'active' | 'finished'; position: number }> = [];
  const HOME_ENTRY_REL = 50; // relative position where piece leaves main path → home run

  if (newT.isFinished || newT.position >= 57) {
    // Animate to last home-run step as "finished"
    const startStep = oldT.position >= 52 ? oldT.position - 52 : 0;
    for (let s = startStep + 1; s <= 4; s++) frames.push({ state: 'finished', position: s });
    return frames;
  }

  // From home base → start square
  if (oldT.isHome && !newT.isHome) {
    frames.push({ state: 'active', position: START_INDICES[key] });
    return frames; // exiting with 1 or 6 lands exactly on start
  }

  // Both in home run
  if (oldT.position >= 52 && newT.position >= 52) {
    const startStep = oldT.position - 52;
    const endStep = newT.position - 52;
    for (let s = startStep + 1; s <= endStep; s++) frames.push({ state: 'finished', position: s });
    return frames;
  }

  // Main path → home run
  if (oldT.position < 52 && newT.position >= 52) {
    // Walk main path until HOME_ENTRY_REL
    let rel = oldT.position;
    let guard = 0;
    while (rel !== HOME_ENTRY_REL && guard < 52) {
      rel = (rel + 1) % 52;
      frames.push({ state: 'active', position: (rel + START_INDICES[key]) % 52 });
      guard++;
    }
    // Enter home run
    const endStep = newT.position - 52;
    for (let s = 0; s <= endStep; s++) frames.push({ state: 'finished', position: s });
    return frames;
  }

  // Main path → main path
  if (oldT.position < 52 && newT.position < 52) {
    let rel = oldT.position;
    const target = newT.position;
    let guard = 0;
    while (rel !== target && guard < 52) {
      rel = (rel + 1) % 52;
      frames.push({ state: 'active', position: (rel + START_INDICES[key]) % 52 });
      guard++;
    }
    return frames;
  }

  return frames;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function GameBoard() {
  const { code } = useParams();
  const [, setLocation] = useLocation();
  const { data: me } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });

  const wsRef = useRef<WebSocket | null>(null);
  const gameStateRef = useRef<ServerGameState | null>(null); // always current
  const animTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [gameState, setGameState] = useState<ServerGameState | null>(null);
  const [roomPlayers, setRoomPlayers] = useState<any[]>([]);
  const [myColor, setMyColor] = useState<string | null>(null);
  const [displayTokens, setDisplayTokens] = useState<Token[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);

  // Keep ref in sync
  const applyGameState = useCallback((gs: ServerGameState) => {
    gameStateRef.current = gs;
    setGameState(gs);
    setDisplayTokens(buildTokensFromGs(gs));
  }, []);

  // Play step-by-step animation for a moved token, then apply new state
  const animateMove = useCallback((
    prevGs: ServerGameState,
    newGs: ServerGameState,
  ) => {
    // Clear any running animation
    animTimersRef.current.forEach(clearTimeout);
    animTimersRef.current = [];

    const movedId = newGs.lastMoveTokenId;
    if (movedId === null) { applyGameState(newGs); return; }

    // The player who just moved is the one at the OLD currentPlayerIndex
    const movedPlayer = prevGs.players[prevGs.currentPlayerIndex];
    if (!movedPlayer) { applyGameState(newGs); return; }

    const oldToken = movedPlayer.tokens[movedId];
    const newPlayerGs = newGs.players.find(p => p.color === movedPlayer.color);
    if (!oldToken || !newPlayerGs) { applyGameState(newGs); return; }
    const newToken = newPlayerGs.tokens[movedId];

    const path = getMovePath(movedPlayer.color, oldToken, newToken);
    if (path.length === 0) { applyGameState(newGs); return; }

    setIsAnimating(true);

    // Base display: prev state tokens
    const baseTokens = buildTokensFromGs(prevGs);
    const tokenId = `${movedPlayer.color}-${movedId}`;

    path.forEach((frame, i) => {
      const t = setTimeout(() => {
        setDisplayTokens(prev =>
          prev.map(tok =>
            tok.id === tokenId
              ? { ...tok, state: frame.state, position: frame.position }
              : tok
          )
        );
      }, i * 140);
      animTimersRef.current.push(t);
    });

    // After all frames: apply final state
    const done = setTimeout(() => {
      setIsAnimating(false);
      applyGameState(newGs);
    }, path.length * 140 + 50);
    animTimersRef.current.push(done);

    // Start from base
    setDisplayTokens(baseTokens);
  }, [applyGameState]);

  // WebSocket connection
  useEffect(() => {
    if (!code || !me?.clerkId) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}/ws?room=${code}&clerkId=${me.clerkId}`);
    wsRef.current = socket;

    socket.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);

        if (msg.type === 'room_state') {
          if (msg.room?.players) setRoomPlayers(msg.room.players);
          if (msg.gameState) applyGameState(msg.gameState as ServerGameState);
        }
        if (msg.type === 'game_start') {
          if (msg.gameState) applyGameState(msg.gameState as ServerGameState);
        }
        if (msg.type === 'dice_rolled') {
          if (msg.gameState) applyGameState(msg.gameState as ServerGameState);
          if (msg.noMoves) toast.info('কোনো চাল নেই — পরবর্তী খেলোয়াড়ের পালা');
        }
        if (msg.type === 'token_moved') {
          const prev = gameStateRef.current;
          const next = msg.gameState as ServerGameState;
          if (prev) {
            animateMove(prev, next);
          } else {
            applyGameState(next);
          }
        }
        if (msg.type === 'room_update') {
          if (msg.players) setRoomPlayers(msg.players);
        }
      } catch {}
    };

    socket.onerror = () => toast.error('সংযোগে সমস্যা');
    return () => {
      socket.close();
      animTimersRef.current.forEach(clearTimeout);
    };
  }, [code, me?.clerkId, applyGameState, animateMove]);

  // Determine my color
  useEffect(() => {
    if (!gameState || !me?.clerkId) return;
    const mine = gameState.players.find(p => p.clerkId === me.clerkId);
    if (mine) setMyColor(mine.color);
  }, [gameState, me?.clerkId]);

  const sendWs = (msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(msg));
  };

  const currentPlayer = gameState?.players[gameState.currentPlayerIndex];
  const isMyTurn = !!myColor && currentPlayer?.clerkId === me?.clerkId && !isAnimating;

  // Allowed tokens to click
  const allowedTokenIds: string[] = [];
  if (gameState && isMyTurn && gameState.phase === 'moving' && gameState.diceValue != null) {
    const myP = gameState.players.find(p => p.clerkId === me?.clerkId);
    if (myP) {
      myP.tokens.forEach(t => {
        if (t.isFinished) return;
        // Allow exit on 6 or 1
        if (t.isHome && gameState.diceValue !== 6 && gameState.diceValue !== 1) return;
        if (t.position >= 52 && t.position + (gameState.diceValue ?? 0) > 57) return;
        allowedTokenIds.push(`${myP.color}-${t.id}`);
      });
    }
  }

  const rollDice = () => {
    if (!isMyTurn || gameState?.phase !== 'rolling') return;
    sendWs({ type: 'roll_dice' });
  };

  const handleTokenMove = (tokenId: string) => {
    if (!allowedTokenIds.includes(tokenId)) return;
    const parts = tokenId.split('-');
    const id = parseInt(parts[parts.length - 1], 10);
    sendWs({ type: 'move_token', tokenId: id });
  };

  const getPlayerInfo = (color: string) => {
    const gsPlayer = gameState?.players.find(p => p.color === color);
    const roomPlayer = roomPlayers.find(p => p.clerkId === gsPlayer?.clerkId);
    const isMe = gsPlayer?.clerkId === me?.clerkId;
    return {
      name: isMe ? 'You' : (roomPlayer?.displayName || color),
      avatar: roomPlayer?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${color}`,
    };
  };

  const activePlayers = gameState?.players || [];
  const turnColor = currentPlayer?.color ?? 'blue';

  // Corner layout: for 2 players → diagonal (player[0] top-left, player[1] bottom-right)
  let topLeft: string | null = null, topRight: string | null = null;
  let botLeft: string | null = null, botRight: string | null = null;

  const colorCorner: Record<string, 'tl' | 'tr' | 'bl' | 'br'> = {
    blue: 'tl', red: 'tr', yellow: 'bl', green: 'br',
  };

  if (activePlayers.length === 2) {
    topLeft  = activePlayers[0].color;
    botRight = activePlayers[1].color;
  } else {
    activePlayers.forEach(p => {
      const c = colorCorner[p.color] ?? 'tl';
      if (c === 'tl') topLeft  = p.color;
      if (c === 'tr') topRight = p.color;
      if (c === 'bl') botLeft  = p.color;
      if (c === 'br') botRight = p.color;
    });
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (!gameState) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-[#FFD700] border-t-transparent rounded-full animate-spin" />
        <p className="text-[#a790c9]">গেমে সংযুক্ত হচ্ছে…</p>
      </div>
    );
  }

  // ── Winner ───────────────────────────────────────────────────────────────
  if (gameState.phase === 'finished' && gameState.winner) {
    const winnerP = gameState.players.find(p => p.clerkId === gameState.winner);
    const iWon = gameState.winner === me?.clerkId;
    const winnerInfo = winnerP ? getPlayerInfo(winnerP.color) : null;
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-6 p-8 text-center">
        <div className="text-7xl">{iWon ? '🏆' : '🎮'}</div>
        <h1 className="text-4xl font-black text-white">{iWon ? 'তুমি জিতে গেছ!' : `${winnerInfo?.name} জিতেছে!`}</h1>
        <button onClick={() => setLocation('/home')}
          className="bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-[#1a0533] font-bold px-8 py-4 rounded-2xl text-xl">
          হোমে ফিরে যাও
        </button>
      </div>
    );
  }

  // ── Main game UI ─────────────────────────────────────────────────────────
  const badge = (color: string | null, fallback: 'left' | 'right') => {
    if (!color) return <div className={fallback === 'right' ? 'w-14 ml-auto' : 'w-14'} />;
    const info = getPlayerInfo(color);
    return (
      <PlayerBadge
        key={color}
        color={color}
        isTurn={turnColor === color}
        name={info.name}
        avatar={info.avatar}
      />
    );
  };

  return (
    <>
      <div className="fixed inset-0 z-0" style={{ backgroundImage: `url(${splashBg})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }} />
      <div className="fixed inset-0 z-0" style={{ background: 'linear-gradient(180deg, rgba(10,5,30,0.80) 0%, rgba(10,5,30,0.65) 40%, rgba(10,5,30,0.90) 100%)' }} />
    <div className="min-h-[100dvh] flex flex-col relative overflow-hidden z-10">
      <div className="absolute inset-0 opacity-20 mix-blend-screen transition-colors duration-1000 blur-[100px]"
        style={{ backgroundColor: COLORS[turnColor as keyof typeof COLORS] }} />

      {/* Header */}
      <div className="p-4 flex items-center justify-between z-10">
        <button onClick={() => setLocation('/home')}
          className="w-10 h-10 rounded-full bg-[#3a2382] flex items-center justify-center text-white active:scale-95 border border-[#5c3eb8]">
          <ChevronLeft size={24} />
        </button>
        <div className="glass-panel px-4 py-1.5 rounded-full font-bold text-white tracking-widest border border-[#5c3eb8]">
          ROOM: {code}
        </div>
        <button className="w-10 h-10 rounded-full bg-[#3a2382] flex items-center justify-center text-white border border-[#5c3eb8]">
          <MessageSquare size={20} />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4 z-10 w-full max-w-lg mx-auto">
        {/* Top badges */}
        <div className="w-full flex justify-between px-4 mb-4">
          {badge(topLeft, 'left')}
          {badge(topRight, 'right')}
        </div>

        {/* Board */}
        <LudoBoard
          tokens={displayTokens}
          onTokenClick={handleTokenMove}
          activeColor={turnColor}
          allowedTokens={allowedTokenIds}
        />

        {/* Bottom badges */}
        <div className="w-full flex justify-between px-4 mt-4">
          {badge(botLeft, 'left')}
          {badge(botRight, 'right')}
        </div>
      </div>

      {/* Controls */}
      <div className="p-6 z-10 mt-auto bg-gradient-to-t from-[#110524] to-transparent">
        <div className="glass-panel p-4 rounded-3xl flex items-center justify-between shadow-2xl">
          <div className="flex flex-col">
            <span className="text-[#a790c9] text-sm uppercase font-bold tracking-widest">
              {isMyTurn ? 'তোমার পালা' : `${turnColor.toUpperCase()}-এর পালা`}
            </span>
            <div className="text-2xl font-black" style={{ color: COLORS[turnColor as keyof typeof COLORS] }}>
              {gameState.phase === 'moving' && gameState.diceValue
                ? `${gameState.diceValue} উঠেছে!`
                : 'ছক্কা দাও…'}
            </div>
          </div>

          <button
            onClick={rollDice}
            disabled={!isMyTurn || gameState.phase !== 'rolling'}
            className={`w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-black transition-all shadow-2xl ${
              isMyTurn && gameState.phase === 'rolling'
                ? 'bg-gradient-to-tr from-[#FFD700] to-[#FFA500] text-[#1a0533] hover:scale-105 active:scale-95 animate-bounce'
                : 'bg-[#3a2382] text-white opacity-50 cursor-not-allowed'
            }`}
          >
            {gameState.diceValue ? gameState.diceValue : <Dices size={32} />}
          </button>
        </div>
      </div>
    </div>
    </>
  );
}

function PlayerBadge({ color, isTurn, name, avatar }: {
  color: string; isTurn: boolean; name: string; avatar: string;
}) {
  return (
    <div className={`flex flex-col items-center transition-all ${isTurn ? 'scale-110' : 'opacity-70'}`}>
      <div className="w-12 h-12 rounded-full border-4 overflow-hidden mb-1 relative"
        style={{ borderColor: COLORS[color as keyof typeof COLORS] }}>
        <img src={avatar} className="w-full h-full object-cover bg-[#1d0f3d]" alt={name} />
        {isTurn && <div className="absolute inset-0 bg-white opacity-20 animate-pulse" />}
      </div>
      <div className="text-xs font-bold text-white bg-[#1d0f3d] px-2 py-0.5 rounded-full border border-[#3a2382] shadow-xl truncate max-w-[80px] text-center">
        {name}
      </div>
    </div>
  );
}
