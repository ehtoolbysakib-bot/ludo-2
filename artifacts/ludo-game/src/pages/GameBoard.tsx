import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useLocation } from 'wouter';
import { useGetMe, getGetMeQueryKey } from '@workspace/api-client-react';
import { LudoBoard, Token } from '@/components/LudoBoard';
import { ChevronLeft, Dices, MessageSquare, Dice1, Dice2, Dice3, Dice4, Dice5, Dice6 } from 'lucide-react';
import { toast } from 'sonner';
import { COLORS, START_INDICES } from '@/lib/ludo-utils';
import splashBg from '@/assets/splash_bg.webp';

// Audio assets
import gutKatleUrl from '@/assets/guti_katle.mp3';
import ghorThekeUrl from '@/assets/ghor_theke_ber_hole.mp3';
import ghoreGeleUrl from '@/assets/ghore_gele.mp3';

const TEAM1_COLORS = ['blue', 'green'];

// ─── Server types ────────────────────────────────────────────────────────────
interface ServerGameToken {
  id: number;
  position: number; // -1=home base, 0-51=board (relative), 52-56=home run, 57=finished
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
  currentPlayerIndex: number;  // who should roll
  movingPlayerIndex: number;   // who should move (may differ in team mode)
  diceValue: number | null;
  phase: 'rolling' | 'moving' | 'finished';
  winner: string | null;
  winnerTeam: number | null;
  lastMoveTokenId: number | null;
  extraTurn: boolean;
  consecutiveSixes: number;
  teamMode: boolean;
}

// ─── Coordinate conversion ────────────────────────────────────────────────────
function serverTokenToFrontend(t: ServerGameToken, color: string): Token {
  const key = color as keyof typeof START_INDICES;
  if (t.isHome) return { id: `${color}-${t.id}`, color: color as any, state: 'home', position: 0 };
  if (t.isFinished || t.position >= 57) return { id: `${color}-${t.id}`, color: color as any, state: 'finished', position: 4 };
  if (t.position >= 52) return { id: `${color}-${t.id}`, color: color as any, state: 'finished', position: Math.min(t.position - 52, 4) };
  const globalPos = (t.position + START_INDICES[key]) % 52;
  return { id: `${color}-${t.id}`, color: color as any, state: 'active', position: globalPos };
}

function buildTokensFromGs(gs: ServerGameState): Token[] {
  return gs.players.flatMap(p => p.tokens.map(t => serverTokenToFrontend(t, p.color)));
}

// ─── Animation path ───────────────────────────────────────────────────────────
function getMovePath(
  color: string,
  oldT: ServerGameToken,
  newT: ServerGameToken,
): Array<{ state: 'home' | 'active' | 'finished'; position: number }> {
  const key = color as keyof typeof START_INDICES;
  const frames: Array<{ state: 'home' | 'active' | 'finished'; position: number }> = [];
  const HOME_ENTRY_REL = 50;

  if (newT.isFinished || newT.position >= 57) {
    const startStep = oldT.position >= 52 ? oldT.position - 52 : 0;
    for (let s = startStep + 1; s <= 4; s++) frames.push({ state: 'finished', position: s });
    return frames;
  }

  if (oldT.isHome && !newT.isHome) {
    frames.push({ state: 'active', position: START_INDICES[key] });
    return frames;
  }

  if (oldT.position >= 52 && newT.position >= 52) {
    const startStep = oldT.position - 52;
    const endStep = newT.position - 52;
    for (let s = startStep + 1; s <= endStep; s++) frames.push({ state: 'finished', position: s });
    return frames;
  }

  if (oldT.position < 52 && newT.position >= 52) {
    let rel = oldT.position;
    let guard = 0;
    while (rel !== HOME_ENTRY_REL && guard < 52) {
      rel = (rel + 1) % 52;
      frames.push({ state: 'active', position: (rel + START_INDICES[key]) % 52 });
      guard++;
    }
    const endStep = newT.position - 52;
    for (let s = 0; s <= endStep; s++) frames.push({ state: 'finished', position: s });
    return frames;
  }

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
  const gameStateRef = useRef<ServerGameState | null>(null);
  const animTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [gameState, setGameState] = useState<ServerGameState | null>(null);
  const [roomPlayers, setRoomPlayers] = useState<any[]>([]);
  const [myColor, setMyColor] = useState<string | null>(null);
  const [displayTokens, setDisplayTokens] = useState<Token[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);

  // Turn timer countdown (0-10)
  const [timeLeft, setTimeLeft] = useState<number>(10);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Admin dice control
  const [adminDiceInput, setAdminDiceInput] = useState<string>('');
  const isAdmin = !!(me as any)?.isAdmin;

  // Audio refs
  const audioCaptureRef = useRef<HTMLAudioElement>(null);
  const audioExitRef = useRef<HTMLAudioElement>(null);
  const audioHomeRef = useRef<HTMLAudioElement>(null);

  const playAudio = useCallback((ref: React.RefObject<HTMLAudioElement | null>) => {
    if (ref.current) {
      ref.current.currentTime = 0;
      ref.current.play().catch(() => {});
    }
  }, []);

  // Keep ref in sync
  const applyGameState = useCallback((gs: ServerGameState) => {
    gameStateRef.current = gs;
    setGameState(gs);
    setDisplayTokens(buildTokensFromGs(gs));
  }, []);

  // Animate token move
  const animateMove = useCallback((
    prevGs: ServerGameState,
    newGs: ServerGameState,
    capturedCount: number,
    exitedBase: boolean,
    reachedHome: boolean,
  ) => {
    animTimersRef.current.forEach(clearTimeout);
    animTimersRef.current = [];

    const movedId = newGs.lastMoveTokenId;
    if (movedId === null) { applyGameState(newGs); return; }

    // The player who moved was at the OLD movingPlayerIndex
    const movedPlayerColor = prevGs.players[prevGs.movingPlayerIndex]?.color;
    const movedPlayer = prevGs.players.find(p => p.color === movedPlayerColor);
    if (!movedPlayer) { applyGameState(newGs); return; }

    const oldToken = movedPlayer.tokens[movedId];
    const newPlayerGs = newGs.players.find(p => p.color === movedPlayer.color);
    if (!oldToken || !newPlayerGs) { applyGameState(newGs); return; }
    const newToken = newPlayerGs.tokens[movedId];

    const path = getMovePath(movedPlayer.color, oldToken, newToken);
    if (path.length === 0) {
      // Play audio immediately
      if (capturedCount > 0) playAudio(audioCaptureRef);
      else if (exitedBase) playAudio(audioExitRef);
      else if (reachedHome) playAudio(audioHomeRef);
      applyGameState(newGs);
      return;
    }

    setIsAnimating(true);
    const baseTokens = buildTokensFromGs(prevGs);
    const tokenId = `${movedPlayer.color}-${movedId}`;

    path.forEach((frame, i) => {
      const t = setTimeout(() => {
        setDisplayTokens(prev =>
          prev.map(tok => tok.id === tokenId ? { ...tok, state: frame.state, position: frame.position } : tok)
        );
      }, i * 140);
      animTimersRef.current.push(t);
    });

    const done = setTimeout(() => {
      // Play audio after animation
      if (capturedCount > 0) playAudio(audioCaptureRef);
      else if (exitedBase) playAudio(audioExitRef);
      else if (reachedHome) playAudio(audioHomeRef);
      setIsAnimating(false);
      applyGameState(newGs);
    }, path.length * 140 + 50);
    animTimersRef.current.push(done);

    setDisplayTokens(baseTokens);
  }, [applyGameState, playAudio]);

  // Turn countdown timer
  useEffect(() => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    if (!gameState || gameState.phase !== 'rolling' || isAnimating) {
      setTimeLeft(10);
      return;
    }

    setTimeLeft(10);
    let remaining = 10;
    timerIntervalRef.current = setInterval(() => {
      remaining -= 1;
      setTimeLeft(remaining);
      if (remaining <= 0) {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      }
    }, 1000);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [gameState?.currentPlayerIndex, gameState?.phase, isAnimating]);

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
        if (msg.type === 'room_update') {
          if (msg.players) setRoomPlayers(msg.players);
        }
        if (msg.type === 'dice_rolled') {
          if (msg.gameState) applyGameState(msg.gameState as ServerGameState);
          if (msg.noMoves) toast.info('কোনো চাল নেই — পরবর্তী পালা');
          if (msg.turnCancelled) toast.warning('৩ বার ছক্কা! পালা বাতিল হয়েছে');
        }
        if (msg.type === 'token_moved') {
          const prev = gameStateRef.current;
          const next = msg.gameState as ServerGameState;
          if (prev) {
            animateMove(prev, next, msg.capturedCount ?? 0, msg.exitedBase ?? false, msg.reachedHome ?? false);
          } else {
            applyGameState(next);
          }
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

  const rollingPlayer = gameState?.players[gameState.currentPlayerIndex];
  const movingPlayer  = gameState?.players[gameState?.movingPlayerIndex ?? gameState?.currentPlayerIndex];

  const isMyRollTurn = !!me?.clerkId && rollingPlayer?.clerkId === me.clerkId && !isAnimating;
  const isMyMoveTurn = !!me?.clerkId && movingPlayer?.clerkId === me.clerkId && !isAnimating;

  // Which tokens can the current moving player click?
  const allowedTokenIds: string[] = [];
  if (gameState && isMyMoveTurn && gameState.phase === 'moving' && gameState.diceValue != null) {
    const myP = movingPlayer;
    if (myP) {
      myP.tokens.forEach(t => {
        if (t.isFinished) return;
        if (t.isHome && gameState.diceValue !== 6) return; // only 6 exits base
        if (t.position >= 52 && t.position + (gameState.diceValue ?? 0) > 57) return;
        allowedTokenIds.push(`${myP.color}-${t.id}`);
      });
    }
  }

  const rollDice = () => {
    if (!isMyRollTurn || gameState?.phase !== 'rolling') return;
    sendWs({ type: 'roll_dice' });
  };

  const handleAdminSetDice = () => {
    const v = parseInt(adminDiceInput, 10);
    if (isNaN(v) || v < 1 || v > 6) return;
    if (!isMyRollTurn || gameState?.phase !== 'rolling') return;
    sendWs({ type: 'set_dice_value', value: v });
    setAdminDiceInput('');
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
  const turnColor = rollingPlayer?.color ?? 'blue';
  // The moving player might differ in team mode
  const moveColor = movingPlayer?.color ?? turnColor;

  // Corner layout
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

  // ── Winner screen ─────────────────────────────────────────────────────────
  if (gameState.phase === 'finished') {
    let iWon = false;
    let winnerLabel = '';

    if (gameState.teamMode && gameState.winnerTeam) {
      const myTeam = myColor ? (TEAM1_COLORS.includes(myColor) ? 1 : 2) : null;
      iWon = myTeam === gameState.winnerTeam;
      const winTeamColors = gameState.winnerTeam === 1 ? ['blue', 'green'] : ['red', 'yellow'];
      const winNames = winTeamColors.map(c => {
        const p = gameState.players.find(pl => pl.color === c);
        const rp = roomPlayers.find(r => r.clerkId === p?.clerkId);
        return rp?.displayName || c;
      });
      winnerLabel = `দল জিতেছে: ${winNames.join(' ও ')}`;
    } else if (gameState.winner) {
      const winnerP = gameState.players.find(p => p.clerkId === gameState.winner);
      iWon = gameState.winner === me?.clerkId;
      const rp = roomPlayers.find(r => r.clerkId === gameState.winner);
      winnerLabel = iWon ? 'তুমি জিতে গেছ!' : `${rp?.displayName || winnerP?.color} জিতেছে!`;
    }

    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-6 p-8 text-center">
        <div className="text-7xl">{iWon ? '🏆' : '🎮'}</div>
        <h1 className="text-4xl font-black text-white">{iWon ? 'তুমি জিতে গেছ!' : winnerLabel}</h1>
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
    const isRoller = color === turnColor;
    const isMover = color === moveColor && gameState.phase === 'moving';
    return (
      <PlayerBadge
        key={color}
        color={color}
        isTurn={isRoller}
        isMoving={isMover && !isRoller}
        name={info.name}
        avatar={info.avatar}
      />
    );
  };

  // Dice face label
  const diceLabel = () => {
    if (gameState.phase === 'moving' && gameState.diceValue) return `${gameState.diceValue} উঠেছে!`;
    return 'ছক্কা দাও…';
  };

  // Turn info text
  const turnText = () => {
    const rollerName = isMyRollTurn ? 'তোমার' : `${turnColor.toUpperCase()}-এর`;
    if (gameState.phase === 'moving' && gameState.teamMode &&
      gameState.movingPlayerIndex !== gameState.currentPlayerIndex) {
      const moverInfo = getPlayerInfo(moveColor);
      return `${moverInfo.name} চাল দেবে`;
    }
    return `${rollerName} পালা`;
  };

  return (
    <>
      {/* Audio elements */}
      <audio ref={audioCaptureRef} src={gutKatleUrl} preload="auto" />
      <audio ref={audioExitRef} src={ghorThekeUrl} preload="auto" />
      <audio ref={audioHomeRef} src={ghoreGeleUrl} preload="auto" />

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
          <div className="glass-panel p-4 rounded-3xl shadow-2xl flex flex-col gap-3">
            {/* Main row: turn info + dice */}
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-[#a790c9] text-sm uppercase font-bold tracking-widest">
                  {turnText()}
                </span>
                <div className="text-2xl font-black" style={{ color: COLORS[moveColor as keyof typeof COLORS] }}>
                  {diceLabel()}
                </div>

                {/* Countdown timer — shown when rolling phase */}
                {gameState.phase === 'rolling' && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="flex gap-0.5">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <div
                          key={i}
                          className="h-1.5 w-3 rounded-full transition-all"
                          style={{
                            backgroundColor: i < timeLeft
                              ? (timeLeft <= 3 ? '#FF4444' : '#FFD700')
                              : 'rgba(255,255,255,0.1)',
                          }}
                        />
                      ))}
                    </div>
                    <span className={`text-xs font-bold ${timeLeft <= 3 ? 'text-[#FF4444]' : 'text-[#a790c9]'}`}>
                      {timeLeft}s
                    </span>
                  </div>
                )}

                {/* Consecutive sixes indicator */}
                {gameState.consecutiveSixes > 0 && (
                  <div className="flex items-center gap-1 mt-0.5">
                    {Array.from({ length: gameState.consecutiveSixes }).map((_, i) => (
                      <span key={i} className="text-base">🎲</span>
                    ))}
                    <span className="text-[10px] text-[#FF4444] font-bold uppercase tracking-wider">
                      {gameState.consecutiveSixes === 2 ? 'আরেকটা ছক্কা হলে পালা বাতিল!' : 'টানা ছক্কা'}
                    </span>
                  </div>
                )}
              </div>

              {/* Dice button */}
              <button
                onClick={rollDice}
                disabled={!isMyRollTurn || gameState.phase !== 'rolling'}
                className={`w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-black transition-all shadow-2xl ${
                  isMyRollTurn && gameState.phase === 'rolling'
                    ? 'bg-gradient-to-tr from-[#FFD700] to-[#FFA500] text-[#1a0533] hover:scale-105 active:scale-95 animate-bounce'
                    : 'bg-[#3a2382] text-white opacity-50 cursor-not-allowed'
                }`}
              >
                {gameState.diceValue ? gameState.diceValue : <Dices size={32} />}
              </button>
            </div>

            {/* Admin dice control */}
            {isAdmin && isMyRollTurn && gameState.phase === 'rolling' && (
              <div className="flex items-center gap-2 border-t border-[#3a2382] pt-3">
                <span className="text-[10px] text-[#FF4444] font-bold uppercase tracking-wider">
                  🛡 Admin
                </span>
                <div className="flex gap-2 flex-1">
                  {[1, 2, 3, 4, 5, 6].map(v => (
                    <button
                      key={v}
                      onClick={() => {
                        sendWs({ type: 'set_dice_value', value: v });
                      }}
                      className="flex-1 h-9 rounded-xl text-sm font-black text-[#1a0533] active:scale-95 transition-transform"
                      style={{ background: 'linear-gradient(135deg,#FFD700,#FFA500)' }}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function PlayerBadge({ color, isTurn, isMoving, name, avatar }: {
  color: string;
  isTurn: boolean;
  isMoving: boolean;
  name: string;
  avatar: string;
}) {
  return (
    <div className={`flex flex-col items-center transition-all ${isTurn ? 'scale-110' : isMoving ? 'scale-105' : 'opacity-70'}`}>
      <div className="w-12 h-12 rounded-full border-4 overflow-hidden mb-1 relative"
        style={{ borderColor: COLORS[color as keyof typeof COLORS] }}>
        <img src={avatar} className="w-full h-full object-cover bg-[#1d0f3d]" alt={name} />
        {(isTurn || isMoving) && <div className="absolute inset-0 bg-white opacity-20 animate-pulse" />}
      </div>
      <div className="text-xs font-bold text-white bg-[#1d0f3d] px-2 py-0.5 rounded-full border border-[#3a2382] shadow-xl truncate max-w-[80px] text-center">
        {name}
      </div>
      {isMoving && !isTurn && (
        <div className="text-[9px] text-[#FFD700] font-bold mt-0.5">চাল দেবে</div>
      )}
    </div>
  );
}
