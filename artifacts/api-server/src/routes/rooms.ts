import { Router, type IRouter } from "express";
import { eq, inArray } from "drizzle-orm";
import { db, usersTable, roomsTable } from "@workspace/db";
import {
  CreateRoomBody,
  CreateRoomResponse,
  GetRoomByCodeResponse,
  JoinRoomResponse,
} from "@workspace/api-zod";
import { generateRoomCode } from "../lib/roomCode";
import { broadcastAll, initGameState } from "../lib/gameWebSocket";

const router: IRouter = Router();

const requireAuth = (req: any, res: any, next: any) => {
  const userId = req.session?.userId as string | undefined;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.clerkId = userId;
  next();
};

// Use diagonal color pairs so 2-player games have players at opposite corners:
// blue (top-left) + green (bottom-right), then red + yellow for 3-4 player
const PLAYER_COLORS = ["blue", "green", "red", "yellow"];

function formatRoom(room: any) {
  return {
    id: room.id,
    code: room.code,
    hostId: room.hostId,
    status: room.status,
    maxPlayers: room.maxPlayers,
    teamMode: room.teamMode ?? false,
    betAmount: room.betAmount ?? 0,
    players: room.players || [],
    createdAt: room.createdAt instanceof Date ? room.createdAt.toISOString() : room.createdAt,
  };
}

// Create room
router.post("/rooms", requireAuth, async (req: any, res): Promise<void> => {
  const parsed = CreateRoomBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkId, req.clerkId));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // Generate unique room code
  let code = generateRoomCode();
  let attempts = 0;
  while (attempts < 10) {
    const existing = await db.select().from(roomsTable).where(eq(roomsTable.code, code));
    if (existing.length === 0) break;
    code = generateRoomCode();
    attempts++;
  }

  const hostPlayer = {
    clerkId: user.clerkId,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl ?? null,
    color: PLAYER_COLORS[0],
    isReady: false,
  };

  // teamMode only applies when maxPlayers === 4
  const teamMode = parsed.data.maxPlayers === 4 ? (parsed.data.teamMode ?? false) : false;
  const betAmount = parsed.data.betAmount ?? 0;

  // Check host has enough coins for the bet
  if (betAmount > 0 && user.coins < betAmount) {
    res.status(400).json({
      error: `আপনার ব্যালেন্স অপর্যাপ্ত। বাজি খেলতে ${betAmount} কয়েন দরকার, কিন্তু আপনার আছে মাত্র ${user.coins} কয়েন।`,
    });
    return;
  }

  const [room] = await db
    .insert(roomsTable)
    .values({
      code,
      hostId: user.clerkId,
      maxPlayers: parsed.data.maxPlayers,
      teamMode,
      betAmount,
      players: [hostPlayer],
    })
    .returning();

  res.status(201).json(CreateRoomResponse.parse(formatRoom(room)));
});

// Get room by code
router.get("/rooms/:code", async (req, res): Promise<void> => {
  const code = Array.isArray(req.params.code) ? req.params.code[0] : req.params.code;

  const [room] = await db
    .select()
    .from(roomsTable)
    .where(eq(roomsTable.code, code.toUpperCase()));

  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }

  res.json(GetRoomByCodeResponse.parse(formatRoom(room)));
});

// Join room
router.post("/rooms/:code/join", requireAuth, async (req: any, res): Promise<void> => {
  const code = Array.isArray(req.params.code) ? req.params.code[0] : req.params.code;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkId, req.clerkId));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [room] = await db
    .select()
    .from(roomsTable)
    .where(eq(roomsTable.code, code.toUpperCase()));

  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }

  if (room.status !== "waiting") {
    res.status(400).json({ error: "Game already started" });
    return;
  }

  const players = (room.players as any[]) || [];

  // Already in room
  if (players.some((p: any) => p.clerkId === user.clerkId)) {
    res.json(JoinRoomResponse.parse(formatRoom(room)));
    return;
  }

  if (players.length >= room.maxPlayers) {
    res.status(400).json({ error: "Room is full" });
    return;
  }

  const color = PLAYER_COLORS[players.length];
  const newPlayer = {
    clerkId: user.clerkId,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl ?? null,
    color,
    isReady: false,
  };

  const updatedPlayers = [...players, newPlayer];
  const [updated] = await db
    .update(roomsTable)
    .set({ players: updatedPlayers })
    .where(eq(roomsTable.code, code.toUpperCase()))
    .returning();

  res.json(JoinRoomResponse.parse(formatRoom(updated)));
});

// Start game
router.post("/rooms/:code/start", requireAuth, async (req: any, res): Promise<void> => {
  const code = Array.isArray(req.params.code) ? req.params.code[0] : req.params.code;

  const [room] = await db
    .select()
    .from(roomsTable)
    .where(eq(roomsTable.code, code.toUpperCase()));

  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }

  if (room.hostId !== req.clerkId) {
    res.status(403).json({ error: "Only the host can start the game" });
    return;
  }

  const players = (room.players as any[]) || [];
  if (players.length < 2) {
    res.status(400).json({ error: "খেলা শুরু করতে কমপক্ষে ২ জন খেলোয়াড় দরকার" });
    return;
  }

  if (room.status !== "waiting") {
    res.status(400).json({ error: "খেলা ইতোমধ্যে শুরু হয়েছে" });
    return;
  }

  // If there is a bet, verify every player has enough coins
  const betAmount = (room as any).betAmount ?? 0;
  if (betAmount > 0) {
    const clerkIds = players.map((p: any) => p.clerkId);
    const dbUsers = await db
      .select({ clerkId: usersTable.clerkId, displayName: usersTable.displayName, coins: usersTable.coins })
      .from(usersTable)
      .where(inArray(usersTable.clerkId, clerkIds));

    const broke = dbUsers.find((u) => u.coins < betAmount);
    if (broke) {
      res.status(400).json({
        error: `"${broke.displayName}"-এর ব্যালেন্স অপর্যাপ্ত। বাজি ${betAmount} কয়েন, কিন্তু তার আছে মাত্র ${broke.coins} কয়েন।`,
      });
      return;
    }
  }

  const gameState = initGameState(players);
  await db
    .update(roomsTable)
    .set({ status: "playing", gameState })
    .where(eq(roomsTable.code, code.toUpperCase()));

  broadcastAll(code.toUpperCase(), { type: "game_start", gameState });

  res.json({ ok: true });
});

// Leave room
router.post("/rooms/:code/leave", requireAuth, async (req: any, res): Promise<void> => {
  const code = Array.isArray(req.params.code) ? req.params.code[0] : req.params.code;

  const [room] = await db
    .select()
    .from(roomsTable)
    .where(eq(roomsTable.code, code.toUpperCase()));

  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }

  const players = (room.players as any[]) || [];
  const updatedPlayers = players.filter((p: any) => p.clerkId !== req.clerkId);

  if (updatedPlayers.length === 0) {
    // Delete room if empty
    await db.delete(roomsTable).where(eq(roomsTable.code, code.toUpperCase()));
  } else {
    // Transfer host if needed
    const newHostId = room.hostId === req.clerkId ? updatedPlayers[0].clerkId : room.hostId;
    await db
      .update(roomsTable)
      .set({ players: updatedPlayers, hostId: newHostId })
      .where(eq(roomsTable.code, code.toUpperCase()));
  }

  res.json({ ok: true });
});

export default router;
