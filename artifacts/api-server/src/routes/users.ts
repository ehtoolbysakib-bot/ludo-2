import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import {
  GetMeResponse,
  GetMyStatsResponse,
  GetLeaderboardResponse,
  ClaimDailyRewardResponse,
} from "@workspace/api-zod";

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

// Get current user
router.get("/users/me", requireAuth, async (req: any, res): Promise<void> => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkId, req.clerkId));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (user.isSuspended) {
    res.status(403).json({ error: "Account suspended" });
    return;
  }

  res.json(
    GetMeResponse.parse({
      ...user,
      email: user.email ?? null,
      lastDailyReward: user.lastDailyReward ?? null,
      createdAt: user.createdAt,
    }),
  );
});

// Claim daily reward
router.post(
  "/users/me/daily-reward",
  requireAuth,
  async (req: any, res): Promise<void> => {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.clerkId, req.clerkId));

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const now = new Date();
    const lastReward = user.lastDailyReward ? new Date(user.lastDailyReward) : null;
    if (lastReward) {
      const hoursSince = (now.getTime() - lastReward.getTime()) / (1000 * 60 * 60);
      if (hoursSince < 24) {
        res.status(400).json({ error: "Already claimed today" });
        return;
      }
    }

    const coinsEarned = 100 + Math.floor(Math.random() * 50);
    const [updated] = await db
      .update(usersTable)
      .set({ coins: user.coins + coinsEarned, lastDailyReward: now.toISOString() })
      .where(eq(usersTable.clerkId, req.clerkId))
      .returning();

    res.json(ClaimDailyRewardResponse.parse({ coins: updated.coins, coinsEarned }));
  },
);

// Get user stats
router.get(
  "/users/stats",
  requireAuth,
  async (req: any, res): Promise<void> => {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.clerkId, req.clerkId));

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const winRate = user.matches > 0 ? user.wins / user.matches : 0;

    res.json(
      GetMyStatsResponse.parse({
        wins: user.wins,
        losses: user.losses,
        matches: user.matches,
        level: user.level,
        coins: user.coins,
        winRate,
      }),
    );
  },
);

// Leaderboard
router.get("/users/leaderboard", async (_req, res): Promise<void> => {
  const users = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.isSuspended, false))
    .orderBy(desc(usersTable.wins), desc(usersTable.level))
    .limit(20);

  const leaderboard = users.map((u, i) => ({
    rank: i + 1,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl ?? null,
    wins: u.wins,
    level: u.level,
    coins: u.coins,
  }));

  res.json(GetLeaderboardResponse.parse(leaderboard));
});

export default router;
