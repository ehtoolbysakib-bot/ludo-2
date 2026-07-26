import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { db, usersTable, roomsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

// ── Interfaces ───────────────────────────────────────────────────────────────

interface Player {
  clerkId: string;
  displayName: string;
  avatarUrl: string | null;
  color: string;
  isReady: boolean;
}

interface GameToken {
  id: number;       // 0–3
  position: number; // -1=home base, 0–51=board (relative), 52–56=home run, 57=finished
  isHome: boolean;
  isFinished: boolean;
}

interface PlayerGameState {
  clerkId: string;
  color: string;
  tokens: GameToken[];
  isFinished: boolean; // all 4 tokens done for this player
}

interface GameState {
  players: PlayerGameState[];
  currentPlayerIndex: number;  // who should roll
  movingPlayerIndex: number;   // who should move (may differ in team mode when roller is done)
  diceValue: number | null;
  phase: "rolling" | "moving" | "finished";
  winner: string | null;       // non-team: clerkId of winner
  winnerTeam: number | null;   // team mode: 1 or 2
  lastMoveTokenId: number | null;
  extraTurn: boolean;
  consecutiveSixes: number;
  teamMode: boolean;
}

interface RoomConnection {
  ws: WebSocket;
  clerkId: string;
  roomCode: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

// Safe squares: no captures allowed here
const SAFE_SQUARES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

// Absolute start positions for each color on the 52-square main path
const COLOR_START: Record<string, number> = {
  red: 0,
  blue: 13,
  green: 26,
  yellow: 39,
};

// Relative position (from COLOR_START) where a color enters its home run
const HOME_ENTRY: Record<string, number> = {
  red: 50,
  blue: 11,
  green: 24,
  yellow: 37,
};

// Team definitions: Team 1 = blue + green, Team 2 = red + yellow
const TEAM1_COLORS = new Set(["blue", "green"]);

// Player indices in PLAYER_COLORS order: blue=0, green=1, red=2, yellow=3
// Team-mode alternating turn: blue→red→green→yellow = 0→2→1→3
const TEAM_TURN_SEQUENCE = [0, 2, 1, 3];

// ── Connections & Timers ─────────────────────────────────────────────────────

const roomConnections = new Map<string, RoomConnection[]>();
const rollTimers = new Map<string, ReturnType<typeof setTimeout>>();
const moveTimers = new Map<string, ReturnType<typeof setTimeout>>();

// ── Broadcast helpers ─────────────────────────────────────────────────────────

function broadcast(roomCode: string, message: object, excludeClerkId?: string) {
  const conns = roomConnections.get(roomCode) || [];
  const data = JSON.stringify(message);
  for (const conn of conns) {
    if (conn.clerkId !== excludeClerkId && conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(data);
    }
  }
}

export function broadcastAll(roomCode: string, message: object) {
  const conns = roomConnections.get(roomCode) || [];
  const data = JSON.stringify(message);
  for (const conn of conns) {
    if (conn.ws.readyState === WebSocket.OPEN) conn.ws.send(data);
  }
}

// ── Team helpers ──────────────────────────────────────────────────────────────

function getTeamId(color: string): 1 | 2 {
  return TEAM1_COLORS.has(color) ? 1 : 2;
}

function getTeammateIdx(gs: GameState, playerIdx: number): number | null {
  if (!gs.teamMode) return null;
  const myTeam = getTeamId(gs.players[playerIdx].color);
  for (let i = 0; i < gs.players.length; i++) {
    if (i !== playerIdx && getTeamId(gs.players[i].color) === myTeam) return i;
  }
  return null;
}

function isTeamFinished(gs: GameState, teamId: 1 | 2): boolean {
  return gs.players.filter(p => getTeamId(p.color) === teamId).every(p => p.isFinished);
}

// ── Position helpers ──────────────────────────────────────────────────────────

function getAbsolutePosition(relPos: number, color: string): number {
  return (relPos + COLOR_START[color]) % 52;
}

// ── Turn helpers ──────────────────────────────────────────────────────────────

function nextPlayerIdx(gs: GameState, fromIdx: number): number {
  const n = gs.players.length;
  if (gs.teamMode && n === 4) {
    const pos = TEAM_TURN_SEQUENCE.indexOf(fromIdx);
    let next = TEAM_TURN_SEQUENCE[(pos + 1) % 4];
    for (let tries = 0; tries < 4; tries++) {
      if (!isTeamFinished(gs, getTeamId(gs.players[next].color))) break;
      const np = TEAM_TURN_SEQUENCE.indexOf(next);
      next = TEAM_TURN_SEQUENCE[(np + 1) % 4];
    }
    return next;
  }
  let next = (fromIdx + 1) % n;
  for (let tries = 0; tries < n; tries++) {
    if (!gs.players[next].isFinished) break;
    next = (next + 1) % n;
  }
  return next;
}

// In team mode, if the roller is finished, the teammate should move instead
function resolveMovingPlayerIdx(gs: GameState, currentIdx: number): number {
  if (!gs.teamMode) return currentIdx;
  if (gs.players[currentIdx].isFinished) {
    const tmIdx = getTeammateIdx(gs, currentIdx);
    if (tmIdx !== null && !gs.players[tmIdx].isFinished) return tmIdx;
  }
  return currentIdx;
}

// ── canMoveToken ──────────────────────────────────────────────────────────────

function canMoveToken(token: GameToken, dice: number, _color: string): boolean {
  if (token.isFinished) return false;
  if (token.isHome) return dice === 6; // only 6 exits base
  if (token.position >= 52) return token.position + dice <= 57;
  return true;
}

// ── Custom capture logic ──────────────────────────────────────────────────────
//
// Situation 2 (leaving a square): after the token moves away, if my remaining
// tokens at the OLD square ≤ opponents there → MY tokens get captured.
//
// Situation 1 (entering a square): after landing, if my count at the NEW square
// ≥ opponents there → all opponent tokens there get captured → extra turn.
//
// Order: first Situation 2, then Situation 1.
// Safe squares: neither situation applies.

interface CaptureResult {
  capturedOpponents: number; // how many opponent tokens were sent home
}

function processCaptures(
  gs: GameState,
  playerIdx: number,
  tokenId: number,
  oldRelPos: number, // relative pos before move (-1 = was in base)
): CaptureResult {
  const player = gs.players[playerIdx];
  const token = player.tokens[tokenId];
  let capturedOpponents = 0;

  const myTeam = gs.teamMode ? getTeamId(player.color) : null;

  // Helper: count tokens of a player at an absolute position (main board only)
  const countAt = (pi: number, absPos: number) =>
    gs.players[pi].tokens.filter(
      t => !t.isHome && !t.isFinished && t.position < 52 &&
        getAbsolutePosition(t.position, gs.players[pi].color) === absPos
    ).length;

  // ── Situation 2: old square ───────────────────────────────────────────────
  if (oldRelPos >= 0 && oldRelPos < 52) {
    const oldAbsPos = getAbsolutePosition(oldRelPos, player.color);
    if (!SAFE_SQUARES.has(oldAbsPos)) {
      // My remaining tokens at old square (excluding the moved one)
      const myRemaining = player.tokens.filter((t, ti) =>
        ti !== tokenId && !t.isHome && !t.isFinished && t.position < 52 &&
        getAbsolutePosition(t.position, player.color) === oldAbsPos
      ).length;

      if (myRemaining > 0) {
        let opponentCount = 0;
        for (let pi = 0; pi < gs.players.length; pi++) {
          const isOpponent = gs.teamMode
            ? getTeamId(gs.players[pi].color) !== myTeam
            : pi !== playerIdx;
          if (isOpponent) opponentCount += countAt(pi, oldAbsPos);
        }

        // My remaining ≤ opponents → my tokens get cut
        if (myRemaining <= opponentCount) {
          player.tokens.forEach((t, ti) => {
            if (ti !== tokenId && !t.isHome && !t.isFinished && t.position < 52 &&
              getAbsolutePosition(t.position, player.color) === oldAbsPos) {
              t.position = -1;
              t.isHome = true;
            }
          });
        }
      }
    }
  }

  // ── Situation 1: new square ───────────────────────────────────────────────
  const newPos = token.position;
  if (!token.isFinished && newPos >= 0 && newPos < 52) {
    const newAbsPos = getAbsolutePosition(newPos, player.color);
    if (!SAFE_SQUARES.has(newAbsPos)) {
      // My (team) count at new square
      let myCount = 0;
      if (gs.teamMode) {
        for (let pi = 0; pi < gs.players.length; pi++) {
          if (getTeamId(gs.players[pi].color) === myTeam) myCount += countAt(pi, newAbsPos);
        }
      } else {
        myCount = player.tokens.filter(
          t => !t.isHome && !t.isFinished && t.position < 52 &&
            getAbsolutePosition(t.position, player.color) === newAbsPos
        ).length;
      }

      // Opponent count at new square
      let opponentCount = 0;
      for (let pi = 0; pi < gs.players.length; pi++) {
        const isOpponent = gs.teamMode
          ? getTeamId(gs.players[pi].color) !== myTeam
          : pi !== playerIdx;
        if (isOpponent) opponentCount += countAt(pi, newAbsPos);
      }

      // My count ≥ opponents → capture all opponent tokens there
      if (opponentCount > 0 && myCount >= opponentCount) {
        for (let pi = 0; pi < gs.players.length; pi++) {
          const isOpponent = gs.teamMode
            ? getTeamId(gs.players[pi].color) !== myTeam
            : pi !== playerIdx;
          if (isOpponent) {
            gs.players[pi].tokens.forEach(t => {
              if (!t.isHome && !t.isFinished && t.position < 52 &&
                getAbsolutePosition(t.position, gs.players[pi].color) === newAbsPos) {
                t.position = -1;
                t.isHome = true;
                capturedOpponents++;
              }
            });
          }
        }
      }
    }
  }

  return { capturedOpponents };
}

// ── moveToken ─────────────────────────────────────────────────────────────────

interface MoveResult {
  gs: GameState;
  capturedCount: number;
  exitedBase: boolean;
  reachedHome: boolean;
}

function moveToken(gameState: GameState, playerIdx: number, tokenId: number): MoveResult {
  const gs = JSON.parse(JSON.stringify(gameState)) as GameState;
  const player = gs.players[playerIdx];
  const token = player.tokens[tokenId];
  const dice = gs.diceValue!;

  const oldRelPos = token.position;
  let exitedBase = false;
  let reachedHome = false;

  // ── Move ──────────────────────────────────────────────────────────────────
  if (token.isHome && dice === 6) {
    token.position = 0;
    token.isHome = false;
    exitedBase = true;
  } else if (!token.isHome && !token.isFinished) {
    const homeEntryRel = ((HOME_ENTRY[player.color] - COLOR_START[player.color]) + 52) % 52;
    const newPos = token.position + dice;

    if (token.position < homeEntryRel && newPos >= homeEntryRel) {
      token.position = 52 + (newPos - homeEntryRel);
    } else if (token.position >= 52) {
      token.position += dice;
    } else {
      token.position = newPos % 52;
    }

    if (token.position >= 57) {
      token.position = 57;
      token.isFinished = true;
      reachedHome = true;
    }
  }

  // ── Captures ──────────────────────────────────────────────────────────────
  let capturedCount = 0;
  if (!reachedHome) {
    const result = processCaptures(gs, playerIdx, tokenId, oldRelPos);
    capturedCount = result.capturedOpponents;
  }

  // ── Player finished? ──────────────────────────────────────────────────────
  if (player.tokens.every(t => t.isFinished)) player.isFinished = true;

  // ── Win condition ─────────────────────────────────────────────────────────
  if (gs.teamMode) {
    if (isTeamFinished(gs, 1)) { gs.winnerTeam = 1; gs.phase = "finished"; }
    else if (isTeamFinished(gs, 2)) { gs.winnerTeam = 2; gs.phase = "finished"; }
  } else {
    if (player.isFinished) { gs.winner = player.clerkId; gs.phase = "finished"; }
  }

  gs.lastMoveTokenId = tokenId;

  if (gs.phase !== "finished") {
    const shouldGetExtraTurn = capturedCount > 0 || dice === 6;

    if (shouldGetExtraTurn) {
      // Stay on same roller; update moving player in case teammate now needs to move
      gs.movingPlayerIndex = resolveMovingPlayerIdx(gs, gs.currentPlayerIndex);
    } else {
      gs.consecutiveSixes = 0;
      const next = nextPlayerIdx(gs, gs.currentPlayerIndex);
      gs.currentPlayerIndex = next;
      gs.movingPlayerIndex = resolveMovingPlayerIdx(gs, next);
    }

    gs.phase = "rolling";
    gs.diceValue = null;
  }

  return { gs, capturedCount, exitedBase, reachedHome };
}

// ── initGameState ─────────────────────────────────────────────────────────────

export function initGameState(players: Player[], teamMode: boolean = false): GameState {
  const startIdx = Math.floor(Math.random() * players.length);
  return {
    players: players.map(p => ({
      clerkId: p.clerkId,
      color: p.color,
      tokens: [0, 1, 2, 3].map(id => ({ id, position: -1, isHome: true, isFinished: false })),
      isFinished: false,
    })),
    currentPlayerIndex: startIdx,
    movingPlayerIndex: startIdx,
    diceValue: null,
    phase: "rolling",
    winner: null,
    winnerTeam: null,
    lastMoveTokenId: null,
    extraTurn: false,
    consecutiveSixes: 0,
    teamMode,
  };
}

// ── Timer helpers ─────────────────────────────────────────────────────────────

function clearRollTimer(roomCode: string) {
  const t = rollTimers.get(roomCode);
  if (t) { clearTimeout(t); rollTimers.delete(roomCode); }
}

function clearMoveTimer(roomCode: string) {
  const t = moveTimers.get(roomCode);
  if (t) { clearTimeout(t); moveTimers.delete(roomCode); }
}

function startRollTimer(roomCode: string, gs: GameState) {
  clearRollTimer(roomCode);
  clearMoveTimer(roomCode);
  const clerkId = gs.players[gs.currentPlayerIndex].clerkId;

  rollTimers.set(roomCode, setTimeout(async () => {
    try {
      const [room] = await db.select().from(roomsTable).where(eq(roomsTable.code, roomCode));
      if (!room || room.status !== "playing") return;
      const currentGs = room.gameState as GameState;
      if (!currentGs || currentGs.phase !== "rolling") return;
      if (currentGs.players[currentGs.currentPlayerIndex].clerkId !== clerkId) return;
      await performRoll(roomCode, currentGs);
    } catch (e) { logger.error({ e }, "Auto-roll error"); }
  }, 10_000));
}

function startMoveTimer(roomCode: string, gs: GameState) {
  clearMoveTimer(roomCode);
  const movingClerkId = gs.players[gs.movingPlayerIndex].clerkId;
  const movingIdx = gs.movingPlayerIndex;
  const diceValue = gs.diceValue!;

  moveTimers.set(roomCode, setTimeout(async () => {
    try {
      const [room] = await db.select().from(roomsTable).where(eq(roomsTable.code, roomCode));
      if (!room || room.status !== "playing") return;
      const currentGs = room.gameState as GameState;
      if (!currentGs || currentGs.phase !== "moving" || currentGs.diceValue !== diceValue) return;
      if (currentGs.players[currentGs.movingPlayerIndex].clerkId !== movingClerkId) return;

      const movingPlayer = currentGs.players[movingIdx];
      const validToken = movingPlayer.tokens.find(t => canMoveToken(t, diceValue, movingPlayer.color));

      if (!validToken) {
        // No valid moves — advance turn
        const next = nextPlayerIdx(currentGs, currentGs.currentPlayerIndex);
        const newGs: GameState = {
          ...currentGs,
          currentPlayerIndex: next,
          movingPlayerIndex: resolveMovingPlayerIdx(currentGs, next),
          phase: "rolling",
          diceValue: null,
        };
        await db.update(roomsTable).set({ gameState: newGs }).where(eq(roomsTable.code, roomCode));
        broadcastAll(roomCode, { type: "token_moved", gameState: newGs, capturedCount: 0, exitedBase: false, reachedHome: false });
        startRollTimer(roomCode, newGs);
        return;
      }

      const result = moveToken(currentGs, movingIdx, validToken.id);
      const newStatus = result.gs.phase === "finished" ? "finished" : "playing";
      await db.update(roomsTable).set({ gameState: result.gs, status: newStatus }).where(eq(roomsTable.code, roomCode));
      broadcastAll(roomCode, {
        type: "token_moved",
        gameState: result.gs,
        capturedCount: result.capturedCount,
        exitedBase: result.exitedBase,
        reachedHome: result.reachedHome,
      });
      if (result.gs.phase !== "finished") startRollTimer(roomCode, result.gs);
    } catch (e) { logger.error({ e }, "Auto-move error"); }
  }, 10_000));
}

// ── performRoll ───────────────────────────────────────────────────────────────

async function performRoll(roomCode: string, gs: GameState, forcedValue?: number) {
  clearRollTimer(roomCode);
  clearMoveTimer(roomCode);

  const diceValue = forcedValue ?? Math.floor(Math.random() * 6) + 1;

  // Deep copy
  const newGs: GameState = JSON.parse(JSON.stringify(gs));
  newGs.diceValue = diceValue;

  // Consecutive sixes check
  if (diceValue === 6) {
    newGs.consecutiveSixes = (gs.consecutiveSixes || 0) + 1;
    if (newGs.consecutiveSixes >= 3) {
      // Cancel turn
      newGs.consecutiveSixes = 0;
      const next = nextPlayerIdx(newGs, newGs.currentPlayerIndex);
      newGs.currentPlayerIndex = next;
      newGs.movingPlayerIndex = resolveMovingPlayerIdx(newGs, next);
      newGs.phase = "rolling";
      newGs.diceValue = null;

      await db.update(roomsTable).set({ gameState: newGs }).where(eq(roomsTable.code, roomCode));
      broadcastAll(roomCode, { type: "dice_rolled", diceValue, gameState: newGs, noMoves: false, turnCancelled: true });
      startRollTimer(roomCode, newGs);
      return;
    }
  } else {
    newGs.consecutiveSixes = 0;
  }

  newGs.phase = "moving";

  // Check if moving player has valid moves
  const movingPlayer = newGs.players[newGs.movingPlayerIndex];
  const hasMoves = movingPlayer.tokens.some(t => canMoveToken(t, diceValue, movingPlayer.color));

  if (!hasMoves) {
    const next = nextPlayerIdx(newGs, newGs.currentPlayerIndex);
    newGs.currentPlayerIndex = next;
    newGs.movingPlayerIndex = resolveMovingPlayerIdx(newGs, next);
    newGs.phase = "rolling";
    newGs.diceValue = null;
    if (diceValue !== 6) newGs.consecutiveSixes = 0;

    await db.update(roomsTable).set({ gameState: newGs }).where(eq(roomsTable.code, roomCode));
    broadcastAll(roomCode, { type: "dice_rolled", diceValue, gameState: newGs, noMoves: true });
    startRollTimer(roomCode, newGs);
    return;
  }

  await db.update(roomsTable).set({ gameState: newGs }).where(eq(roomsTable.code, roomCode));
  broadcastAll(roomCode, { type: "dice_rolled", diceValue, gameState: newGs, noMoves: false });
  startMoveTimer(roomCode, newGs);
}

// ── WebSocket server ──────────────────────────────────────────────────────────

export function setupWebSocket(server: any) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url || "", "http://localhost");
    const roomCode = url.searchParams.get("room")?.toUpperCase();
    const clerkId = url.searchParams.get("clerkId");

    if (!roomCode || !clerkId) { ws.close(1008, "Missing room or clerkId"); return; }

    logger.info({ roomCode, clerkId }, "WS connection");

    const conn: RoomConnection = { ws, clerkId, roomCode };
    if (!roomConnections.has(roomCode)) roomConnections.set(roomCode, []);
    roomConnections.get(roomCode)!.push(conn);

    // Send current room state to the connecting client
    try {
      const [room] = await db.select().from(roomsTable).where(eq(roomsTable.code, roomCode));
      if (room) {
        ws.send(JSON.stringify({
          type: "room_state",
          room: {
            id: room.id, code: room.code, hostId: room.hostId,
            status: room.status, maxPlayers: room.maxPlayers,
            teamMode: room.teamMode ?? false,
            players: room.players, createdAt: room.createdAt,
          },
          gameState: room.gameState,
        }));
      }
    } catch (e) { logger.error({ e }, "Error fetching room on WS connect"); }

    ws.on("message", async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        const [room] = await db.select().from(roomsTable).where(eq(roomsTable.code, roomCode));
        if (!room) return;

        // ── ready ────────────────────────────────────────────────────────────
        if (msg.type === "ready") {
          const players = (room.players as Player[]).map(p =>
            p.clerkId === clerkId ? { ...p, isReady: true } : p
          );
          await db.update(roomsTable).set({ players }).where(eq(roomsTable.code, roomCode));
          broadcastAll(roomCode, { type: "room_update", players });
        }

        // ── start_game ────────────────────────────────────────────────────────
        if (msg.type === "start_game" && room.hostId === clerkId) {
          const players = room.players as Player[];
          if (players.length < 2) return;
          const gameState = initGameState(players, room.teamMode ?? false);
          await db.update(roomsTable).set({ status: "playing", gameState }).where(eq(roomsTable.code, roomCode));
          broadcastAll(roomCode, { type: "game_start", gameState });
          startRollTimer(roomCode, gameState);
        }

        // ── roll_dice ─────────────────────────────────────────────────────────
        if (msg.type === "roll_dice" && room.status === "playing") {
          const gs = room.gameState as GameState;
          if (!gs || gs.phase !== "rolling") return;
          if (gs.players[gs.currentPlayerIndex].clerkId !== clerkId) return;
          await performRoll(roomCode, gs);
        }

        // ── set_dice_value (admin only, for testing) ──────────────────────────
        if (msg.type === "set_dice_value" && room.status === "playing") {
          const gs = room.gameState as GameState;
          if (!gs || gs.phase !== "rolling") return;
          if (gs.players[gs.currentPlayerIndex].clerkId !== clerkId) return;
          const [user] = await db.select({ isAdmin: usersTable.isAdmin }).from(usersTable).where(eq(usersTable.clerkId, clerkId));
          if (!user?.isAdmin) return;
          const value = Math.min(6, Math.max(1, Math.floor(Number(msg.value)) || 1));
          await performRoll(roomCode, gs, value);
        }

        // ── move_token ────────────────────────────────────────────────────────
        if (msg.type === "move_token" && room.status === "playing") {
          const gs = room.gameState as GameState;
          if (!gs || gs.phase !== "moving" || gs.diceValue === null) return;

          // Accept from the moving player (may be different from roller in team mode)
          const movingPlayer = gs.players[gs.movingPlayerIndex];
          if (movingPlayer.clerkId !== clerkId) return;

          const tokenId = msg.tokenId as number;
          const token = movingPlayer.tokens[tokenId];
          if (!canMoveToken(token, gs.diceValue, movingPlayer.color)) return;

          clearMoveTimer(roomCode);

          const result = moveToken(gs, gs.movingPlayerIndex, tokenId);
          const newStatus = result.gs.phase === "finished" ? "finished" : "playing";
          await db.update(roomsTable).set({ gameState: result.gs, status: newStatus }).where(eq(roomsTable.code, roomCode));
          broadcastAll(roomCode, {
            type: "token_moved",
            gameState: result.gs,
            capturedCount: result.capturedCount,
            exitedBase: result.exitedBase,
            reachedHome: result.reachedHome,
          });

          if (result.gs.phase === "finished") {
            // Update stats
            try {
              for (const p of result.gs.players) {
                const isWinner = result.gs.teamMode
                  ? result.gs.winnerTeam === getTeamId(p.color)
                  : p.clerkId === result.gs.winner;
                const [cur] = await db.select({ wins: usersTable.wins, matches: usersTable.matches })
                  .from(usersTable).where(eq(usersTable.clerkId, p.clerkId));
                if (!cur) continue;
                await db.update(usersTable).set({
                  wins: isWinner ? cur.wins + 1 : cur.wins,
                  matches: cur.matches + 1,
                }).where(eq(usersTable.clerkId, p.clerkId));
              }
            } catch (e) { logger.error({ e }, "Error updating game stats"); }
          } else {
            startRollTimer(roomCode, result.gs);
          }
        }

        // ── chat ──────────────────────────────────────────────────────────────
        if (msg.type === "chat") {
          const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
          broadcastAll(roomCode, {
            type: "chat_message",
            from: user?.displayName || "Player",
            message: (msg.message as string)?.slice(0, 200),
          });
        }

      } catch (e) { logger.error({ e }, "WS message error"); }
    });

    ws.on("close", () => {
      const conns = roomConnections.get(roomCode) || [];
      roomConnections.set(roomCode, conns.filter(c => c !== conn));
      broadcast(roomCode, { type: "player_disconnected", clerkId });
      logger.info({ roomCode, clerkId }, "WS disconnected");
    });
  });

  logger.info("WebSocket server setup on /ws");
  return wss;
}
