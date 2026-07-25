import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { db, usersTable, roomsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

interface Player {
  clerkId: string;
  displayName: string;
  avatarUrl: string | null;
  color: string;
  isReady: boolean;
}

interface GameToken {
  id: number; // 0-3
  position: number; // -1 = home base, 0-51 = board, 52-56 = home run, 57 = finished
  isHome: boolean;
  isFinished: boolean;
}

interface PlayerGameState {
  clerkId: string;
  color: string;
  tokens: GameToken[];
  isFinished: boolean;
}

interface GameState {
  players: PlayerGameState[];
  currentPlayerIndex: number;
  diceValue: number | null;
  phase: "rolling" | "moving" | "finished";
  winner: string | null;
  lastMoveTokenId: number | null;
  extraTurn: boolean;
}

interface RoomConnection {
  ws: WebSocket;
  clerkId: string;
  roomCode: string;
}

const roomConnections = new Map<string, RoomConnection[]>();

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
    if (conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(data);
    }
  }
}

// Standard Ludo path: 52 outer squares
// Safe squares: 0, 8, 13, 21, 26, 34, 39, 47 (corners + star squares)
const SAFE_SQUARES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

// Color start positions on main path
const COLOR_START: Record<string, number> = {
  red: 0,
  blue: 13,
  green: 26,
  yellow: 39,
};

// Color home column entry point
const HOME_ENTRY: Record<string, number> = {
  red: 50,
  blue: 11,
  green: 24,
  yellow: 37,
};

function getAbsolutePosition(relPos: number, color: string): number {
  return (relPos + COLOR_START[color]) % 52;
}

export function initGameState(players: Player[]): GameState {
  return {
    players: players.map(p => ({
      clerkId: p.clerkId,
      color: p.color,
      tokens: [0, 1, 2, 3].map(id => ({ id, position: -1, isHome: true, isFinished: false })),
      isFinished: false,
    })),
    currentPlayerIndex: 0,
    diceValue: null,
    phase: "rolling",
    winner: null,
    lastMoveTokenId: null,
    extraTurn: false,
  };
}

function canMoveToken(token: GameToken, dice: number, color: string): boolean {
  if (token.isFinished) return false;
  if (token.isHome) return dice === 6 || dice === 1;
  // In home run (52-56), can only move if won't overshoot
  if (token.position >= 52) {
    return token.position + dice <= 57;
  }
  return true;
}

function moveToken(gameState: GameState, playerIdx: number, tokenId: number): GameState {
  const gs = JSON.parse(JSON.stringify(gameState)) as GameState;
  const player = gs.players[playerIdx];
  const token = player.tokens[tokenId];
  const dice = gs.diceValue!;

  if (token.isHome && (dice === 6 || dice === 1)) {
    token.position = 0; // relative start
    token.isHome = false;
    gs.extraTurn = dice === 6; // extra turn only on 6
  } else if (!token.isHome && !token.isFinished) {
    const homeEntryRel = ((HOME_ENTRY[player.color] - COLOR_START[player.color]) + 52) % 52;
    const newPos = token.position + dice;

    if (token.position < homeEntryRel && newPos >= homeEntryRel) {
      // Enter home run
      const excess = newPos - homeEntryRel;
      token.position = 52 + excess;
    } else if (token.position >= 52) {
      token.position += dice;
    } else {
      token.position = newPos % 52;
    }

    // Check finished
    if (token.position >= 57) {
      token.position = 57;
      token.isFinished = true;
    }
  }

  // Check capture (only on main board 0-51)
  if (!token.isFinished && token.position < 52) {
    const absPos = getAbsolutePosition(token.position, player.color);
    if (!SAFE_SQUARES.has(absPos)) {
      for (let pi = 0; pi < gs.players.length; pi++) {
        if (pi === playerIdx) continue;
        const otherPlayer = gs.players[pi];
        for (const otherToken of otherPlayer.tokens) {
          if (!otherToken.isHome && !otherToken.isFinished && otherToken.position < 52) {
            const otherAbs = getAbsolutePosition(otherToken.position, otherPlayer.color);
            if (otherAbs === absPos) {
              otherToken.position = -1;
              otherToken.isHome = true;
              gs.extraTurn = true;
            }
          }
        }
      }
    }
  }

  // Check if player finished
  if (player.tokens.every(t => t.isFinished)) {
    player.isFinished = true;
    gs.winner = player.clerkId;
    gs.phase = "finished";
    gs.lastMoveTokenId = tokenId;
    return gs;
  }

  gs.lastMoveTokenId = tokenId;
  gs.extraTurn = gs.extraTurn || dice === 6;

  if (!gs.extraTurn) {
    // Next player
    let next = (playerIdx + 1) % gs.players.length;
    let tries = 0;
    while (gs.players[next].isFinished && tries < gs.players.length) {
      next = (next + 1) % gs.players.length;
      tries++;
    }
    gs.currentPlayerIndex = next;
  }

  gs.phase = "rolling";
  gs.diceValue = null;
  gs.extraTurn = false;

  return gs;
}

export function setupWebSocket(server: any) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url || "", "http://localhost");
    const roomCode = url.searchParams.get("room")?.toUpperCase();
    const clerkId = url.searchParams.get("clerkId");

    if (!roomCode || !clerkId) {
      ws.close(1008, "Missing room or clerkId");
      return;
    }

    logger.info({ roomCode, clerkId }, "WS connection");

    // Add to connections
    const conn: RoomConnection = { ws, clerkId, roomCode };
    if (!roomConnections.has(roomCode)) {
      roomConnections.set(roomCode, []);
    }
    roomConnections.get(roomCode)!.push(conn);

    // Send current room state
    try {
      const [room] = await db.select().from(roomsTable).where(eq(roomsTable.code, roomCode));
      if (room) {
        ws.send(JSON.stringify({ type: "room_state", room: {
          id: room.id, code: room.code, hostId: room.hostId,
          status: room.status, maxPlayers: room.maxPlayers,
          players: room.players, createdAt: room.createdAt,
        }, gameState: room.gameState }));
      }
    } catch (e) {
      logger.error({ e }, "Error fetching room on WS connect");
    }

    ws.on("message", async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        const [room] = await db.select().from(roomsTable).where(eq(roomsTable.code, roomCode));
        if (!room) return;

        if (msg.type === "ready") {
          const players = (room.players as Player[]).map(p =>
            p.clerkId === clerkId ? { ...p, isReady: true } : p
          );
          await db.update(roomsTable).set({ players }).where(eq(roomsTable.code, roomCode));
          broadcastAll(roomCode, { type: "room_update", players });
        }

        if (msg.type === "start_game" && room.hostId === clerkId) {
          const players = room.players as Player[];
          if (players.length < 2) return;
          const gameState = initGameState(players);
          await db.update(roomsTable)
            .set({ status: "playing", gameState })
            .where(eq(roomsTable.code, roomCode));
          broadcastAll(roomCode, { type: "game_start", gameState });
        }

        if (msg.type === "roll_dice" && room.status === "playing") {
          const gs = room.gameState as GameState;
          if (!gs) return;
          const currentPlayer = gs.players[gs.currentPlayerIndex];
          if (currentPlayer.clerkId !== clerkId) return;
          if (gs.phase !== "rolling") return;

          const diceValue = Math.floor(Math.random() * 6) + 1;
          const newGs: GameState = { ...gs, diceValue, phase: "moving" as const };

          // Check if any moves possible
          const hasMoves = currentPlayer.tokens.some(t =>
            canMoveToken(t, diceValue, currentPlayer.color)
          );

          if (!hasMoves) {
            // Skip turn
            let next = (gs.currentPlayerIndex + 1) % gs.players.length;
            let tries = 0;
            while (gs.players[next].isFinished && tries < gs.players.length) {
              next = (next + 1) % gs.players.length;
              tries++;
            }
            newGs.currentPlayerIndex = next;
            (newGs as any).phase = "rolling";
            (newGs as any).diceValue = null;
          }

          await db.update(roomsTable).set({ gameState: newGs }).where(eq(roomsTable.code, roomCode));
          broadcastAll(roomCode, { type: "dice_rolled", diceValue, gameState: newGs, noMoves: !hasMoves });
        }

        if (msg.type === "move_token" && room.status === "playing") {
          const gs = room.gameState as GameState;
          if (!gs) return;
          const currentPlayer = gs.players[gs.currentPlayerIndex];
          if (currentPlayer.clerkId !== clerkId) return;
          if (gs.phase !== "moving") return;
          if (gs.diceValue === null) return;

          const tokenId = msg.tokenId as number;
          const token = currentPlayer.tokens[tokenId];
          if (!canMoveToken(token, gs.diceValue, currentPlayer.color)) return;

          const newGs = moveToken(gs, gs.currentPlayerIndex, tokenId);
          const newStatus = newGs.phase === "finished" ? "finished" : "playing";
          await db.update(roomsTable).set({ gameState: newGs, status: newStatus }).where(eq(roomsTable.code, roomCode));
          broadcastAll(roomCode, { type: "token_moved", gameState: newGs });

          if (newGs.winner) {
            // Update stats
            try {
              for (const p of newGs.players) {
                const isWinner = p.clerkId === newGs.winner;
                await db.update(usersTable).set({
                  wins: isWinner ? (await db.select({ w: usersTable.wins }).from(usersTable).where(eq(usersTable.clerkId, p.clerkId)))[0]?.w + 1 || 1 : undefined,
                  matches: (await db.select({ m: usersTable.matches }).from(usersTable).where(eq(usersTable.clerkId, p.clerkId)))[0]?.m + 1 || 1,
                }).where(eq(usersTable.clerkId, p.clerkId));
              }
            } catch (e) {
              logger.error({ e }, "Error updating game stats");
            }
          }
        }

        if (msg.type === "chat") {
          const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
          broadcastAll(roomCode, {
            type: "chat_message",
            from: user?.displayName || "Player",
            message: (msg.message as string)?.slice(0, 200),
          });
        }

      } catch (e) {
        logger.error({ e }, "WS message error");
      }
    });

    ws.on("close", () => {
      const conns = roomConnections.get(roomCode) || [];
      roomConnections.set(
        roomCode,
        conns.filter(c => c !== conn)
      );
      broadcast(roomCode, { type: "player_disconnected", clerkId });
      logger.info({ roomCode, clerkId }, "WS disconnected");
    });
  });

  logger.info("WebSocket server setup on /ws");
  return wss;
}
